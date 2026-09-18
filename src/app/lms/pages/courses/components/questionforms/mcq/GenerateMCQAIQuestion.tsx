// components/question/GenerateMCQAIQuestion.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  X, Sparkles, Loader2, CheckCircle, AlertCircle,
  ChevronDown, Edit2, RefreshCw, Plus, Trash2,
  Bot, Save, Zap, SlidersHorizontal, Wand2,
  List, CheckSquare, ToggleLeft, AlignLeft, BookOpen,
  Equal, MoveVertical, Binary, ChevronDown as ChevronDownIcon
} from 'lucide-react';

// ─── FONT INJECTION ───────────────────────────────────────────────────────────
const injectFonts = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.textContent = `
      /* ─── LMS DESIGN TOKENS ─────────────────────────────────────────────── */
      :root {
        --lms-orange:        #F27757;
        --lms-orange-dark:   #e0623f;
        --lms-orange-glow:   rgba(242,119,87,0.22);
        --lms-orange-light:  rgba(242,119,87,0.08);
        --lms-orange-50:     #FEF3EF;
        --lms-orange-100:    #FDDDD4;
        --lms-text-main:     #1a1a2e;
        --lms-text-sec:      #6b6b7e;
        --lms-text-muted:    #8b8b9e;
        --lms-text-hint:     #bcbccc;
        --lms-border:        #e4e4ed;
        --lms-border-hover:  #d0d0de;
        --lms-bg-white:      #ffffff;
        --lms-bg-surface:    #f7f7fb;
        --lms-bg-surface2:   #f0f0f7;
        --lms-success:       #16a34a;
        --lms-success-bg:    #f0fdf4;
        --lms-success-bdr:   #bbf7d0;
        --lms-danger:        #e53e3e;
        --lms-danger-bg:     #fff5f5;
        --lms-danger-bdr:    #fed7d7;
        --lms-info:          #f97316;
        --lms-info-bg:       #fff7ed;
        --lms-info-bdr:      #fed7aa;
        --lms-warning:       #d97706;
        --lms-warning-bg:    #fffbeb;
        --lms-warning-bdr:   #fde68a;
        --lms-violet:        #7c3aed;
        --lms-violet-bg:     #f5f3ff;
        --lms-violet-bdr:    #ddd6fe;
        --lms-radius-sm:     8px;
        --lms-radius-md:     10px;
        --lms-radius-lg:     14px;
        --lms-font:          'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
        --lms-shadow-sm:     0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        --lms-shadow-md:     0 4px 14px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
      }

      .ai-gen-root { font-family: var(--lms-font) !important; }

      .ai-sidebar-scroll::-webkit-scrollbar { width: 4px; }
      .ai-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
      .ai-sidebar-scroll::-webkit-scrollbar-thumb { background: var(--lms-border); border-radius: 4px; }
      .ai-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: var(--lms-border-hover); }

      /* ─── BREADCRUMB ────────────────────────────────────────────────────── */
      .lms-breadcrumb-sep { color: var(--lms-orange); margin: 0 3px; font-weight: 700; font-size: 13px; }

      /* ─── TOGGLE ────────────────────────────────────────────────────────── */
      .lms-toggle-track {
        position: relative; display: inline-block;
        width: 34px; height: 18px; flex-shrink: 0;
      }
      .lms-toggle-track input { opacity: 0; width: 0; height: 0; }
      .lms-toggle-slider {
        position: absolute; inset: 0;
        background: var(--lms-border-hover); border-radius: 18px;
        transition: background 0.2s; cursor: pointer;
      }
      .lms-toggle-slider::before {
        content: ''; position: absolute;
        width: 14px; height: 14px; border-radius: 50%; background: white;
        left: 2px; top: 2px; transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      }
      .lms-toggle-track input:checked + .lms-toggle-slider { background: var(--lms-orange); }
      .lms-toggle-track input:checked + .lms-toggle-slider::before { transform: translateX(16px); }

      /* ─── RANGE SLIDER ──────────────────────────────────────────────────── */
      .lms-range { width: 100%; height: 4px; accent-color: var(--lms-orange); cursor: pointer; }

      /* ─── MODAL ─────────────────────────────────────────────────────────── */
      .lms-modal-backdrop-ai {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(26,26,46,0.45); backdrop-filter: blur(2px);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }

      /* ─── SECTION LABEL ─────────────────────────────────────────────────── */
      .lms-section-label-ai {
        font-size: 10px; font-weight: 700; color: var(--lms-text-hint);
        text-transform: uppercase; letter-spacing: 0.08em;
        font-family: var(--lms-font);
      }
    `;
    document.head.appendChild(style);
  };
})();

// ─── GEMINI API CONFIGURATION ──────────────────────────────────────────────
// Read from env only — never hard-code a key in source (GitHub Push
// Protection blocks commits containing real GCP/Google API keys). Set
// NEXT_PUBLIC_GEMINI_API_KEY in .env.local for local dev and in your
// deployment env for production. Same shape as `questionforms/geminiClient.ts`.
const GEMINI_API_KEY: string =
  (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_GEMINI_API_KEY) || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_API_URL_FALLBACK = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;

// ─── TYPES ─────────────────────────────────────────────────────────────────
type QuestionType =
  | 'multiple-choice'
  | 'multiple-select'
  | 'true-false'
  | 'short-answer'
  | 'paragraph'
  | 'matching'
  | 'ordering'
  | 'numeric'
  | 'dropdown';

interface Breadcrumb { name: string; type: string; }

interface ExerciseData {
  exerciseId?: string;
  exerciseName?: string;
  exerciseLevel?: string;
  selectedLanguages?: string[];
  nodeId?: string;
  nodeName?: string;
  subcategory?: string;
  nodeType?: string;
  exerciseType?: string;
  topic?: string;
  fullExerciseData?: any;
}

export interface GeneratedQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  type: QuestionType;
  options?: { id: string; text: string; isCorrect: boolean; }[];
  matchingPairs?: { id: string; prompt: string; answer: string; }[];
  orderingItems?: { id: string; text: string; }[];
  numericAnswer?: number | null;
  numericTolerance?: number;
  trueFalseAnswer?: boolean | null;
  explanation: string;
  selected?: boolean;
  isEditing?: boolean;
  correctAnswer?: string;
  optionsPerRow?: 1 | 2 | 3 | 4;
}

interface GenerateMCQAIQuestionProps {
  breadcrumbs: Breadcrumb[];
  exerciseData: ExerciseData;
  onClose: () => void;
  onSave: (questions: GeneratedQuestion[]) => void;
  buttonClassName?: string;
  buttonText?: string | React.ReactNode;
  isRegeneratingDuplicates?: boolean;
  duplicateTopic?: string;
  numberOfDuplicates?: number;
  onRegenerationComplete?: (questions: GeneratedQuestion[]) => void;
  // For equalDistribution: limits how many can be selected
  // For questionSpecific: pass -1 (no slot limit — always allow up to 5)
  maxSelectableCount?: number;
  scoringType?: 'equalDistribution' | 'questionSpecific';
  marksPerQuestion?: number;
  remainingMarks?: number;
  // When true, opens the modal programmatically from the parent (no button click needed)
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
}

interface ApiError { message: string; details?: string; }

interface GenerationSettings {
  numQuestions: number;
  questionType: QuestionType | '';
  numOptions: number;
  numPairs: number;
  numItems: number;
  includeExplanations: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
}

interface TypeMeta {
  label: string;
  group: 'Choice' | 'Text' | 'Complex';
  hasOptions: boolean;
  hasCustomCount: boolean;
  description: string;
  icon: React.ReactNode;
}

const TYPE_CONFIG: Record<QuestionType, TypeMeta> = {
  'multiple-choice': { label: 'Multiple Choice', group: 'Choice',  hasOptions: true,  hasCustomCount: true,  description: 'One correct answer',        icon: <List size={11} /> },
  'multiple-select': { label: 'Multiple Select', group: 'Choice',  hasOptions: true,  hasCustomCount: true,  description: '1–3 correct answers',       icon: <CheckSquare size={11} /> },
  'true-false':      { label: 'True / False',    group: 'Choice',  hasOptions: false, hasCustomCount: false, description: 'True or False',             icon: <ToggleLeft size={11} /> },
  'dropdown':        { label: 'Dropdown',         group: 'Choice',  hasOptions: true,  hasCustomCount: true,  description: 'One correct answer',        icon: <ChevronDownIcon size={11} /> },
  'short-answer':    { label: 'Short Answer',     group: 'Text',    hasOptions: false, hasCustomCount: false, description: 'Brief text answer',         icon: <AlignLeft size={11} /> },
  'paragraph':       { label: 'Essay',            group: 'Text',    hasOptions: false, hasCustomCount: false, description: 'Detailed written response', icon: <BookOpen size={11} /> },
  'matching':        { label: 'Matching',         group: 'Complex', hasOptions: false, hasCustomCount: true,  description: 'Match prompt to answer',    icon: <Equal size={11} /> },
  'ordering':        { label: 'Ordering',         group: 'Complex', hasOptions: false, hasCustomCount: true,  description: 'Arrange in sequence',       icon: <MoveVertical size={11} /> },
  'numeric':         { label: 'Numeric',          group: 'Complex', hasOptions: false, hasCustomCount: false, description: 'Number answer',             icon: <Binary size={11} /> },
};

const TYPE_GROUPS: Array<'Choice' | 'Text' | 'Complex'> = ['Choice', 'Text', 'Complex'];

// ─── Difficulty config ────────────────────────────────────────────────────────
const DIFF_CFG = {
  easy:   { label: 'Easy',   color: 'var(--lms-success)', bg: 'var(--lms-success-bg)', border: 'var(--lms-success-bdr)', solid: '#16a34a' },
  medium: { label: 'Medium', color: 'var(--lms-warning)', bg: 'var(--lms-warning-bg)', border: 'var(--lms-warning-bdr)', solid: '#d97706' },
  hard:   { label: 'Hard',   color: 'var(--lms-danger)',  bg: 'var(--lms-danger-bg)',  border: 'var(--lms-danger-bdr)',  solid: '#e53e3e' },
};

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
const AIBreadcrumb: React.FC<{ breadcrumbs: Breadcrumb[]; exerciseName?: string }> = ({
  breadcrumbs, exerciseName,
}) => (
  <nav style={{ fontFamily: 'var(--lms-font)' }}>
    <ol className="flex items-center flex-wrap gap-y-0.5">
      {breadcrumbs.map((crumb, idx) => (
        <React.Fragment key={idx}>
          <li><span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lms-text-sec)', maxWidth: 100, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{crumb.name}</span></li>
          <li><span className="lms-breadcrumb-sep">»</span></li>
        </React.Fragment>
      ))}
      {exerciseName && (
        <>
          <li><span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--lms-text-main)', maxWidth: 120, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{exerciseName}</span></li>
          <li><span className="lms-breadcrumb-sep">»</span></li>
        </>
      )}
      <li>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>AI Question Generator</span>
      </li>
    </ol>
  </nav>
);

// ─── REBUILD QUESTION FOR NEW TYPE ───────────────────────────────────────────
const rebuildQuestionForType = (q: GeneratedQuestion, newType: QuestionType): GeneratedQuestion => {
  const base = { ...q, type: newType };
  switch (newType) {
    case 'multiple-choice':
    case 'multiple-select':
    case 'dropdown': {
      const existing = q.options && q.options.length >= 2 ? q.options : [
        { id: 'a', text: 'Option A', isCorrect: true },
        { id: 'b', text: 'Option B', isCorrect: false },
        { id: 'c', text: 'Option C', isCorrect: false },
        { id: 'd', text: 'Option D', isCorrect: false },
      ];
      let opts = existing.map(o => ({ ...o }));
      if (newType === 'multiple-choice' || newType === 'dropdown') {
        const hasOne = opts.filter(o => o.isCorrect).length === 1;
        if (!hasOne) opts = opts.map((o, i) => ({ ...o, isCorrect: i === 0 }));
      }
      return { ...base, options: opts, trueFalseAnswer: undefined, matchingPairs: undefined, orderingItems: undefined, numericAnswer: undefined };
    }
    case 'true-false':
      return { ...base, trueFalseAnswer: base.trueFalseAnswer ?? true, options: undefined, matchingPairs: undefined, orderingItems: undefined, numericAnswer: undefined };
    case 'short-answer':
    case 'paragraph':
      return { ...base, options: undefined, matchingPairs: undefined, orderingItems: undefined, numericAnswer: undefined, trueFalseAnswer: undefined };
    case 'matching': {
      const existing = q.matchingPairs && q.matchingPairs.length >= 2 ? q.matchingPairs : [
        { id: 'a', prompt: 'Prompt 1', answer: 'Answer 1' },
        { id: 'b', prompt: 'Prompt 2', answer: 'Answer 2' },
        { id: 'c', prompt: 'Prompt 3', answer: 'Answer 3' },
        { id: 'd', prompt: 'Prompt 4', answer: 'Answer 4' },
      ];
      return { ...base, matchingPairs: existing, options: undefined, orderingItems: undefined, numericAnswer: undefined, trueFalseAnswer: undefined };
    }
    case 'ordering': {
      const existing = q.orderingItems && q.orderingItems.length >= 2 ? q.orderingItems : [
        { id: 'a', text: 'Step 1' }, { id: 'b', text: 'Step 2' },
        { id: 'c', text: 'Step 3' }, { id: 'd', text: 'Step 4' },
      ];
      return { ...base, orderingItems: existing, options: undefined, matchingPairs: undefined, numericAnswer: undefined, trueFalseAnswer: undefined };
    }
    case 'numeric':
      return { ...base, numericAnswer: base.numericAnswer ?? 0, numericTolerance: base.numericTolerance ?? 0, options: undefined, matchingPairs: undefined, orderingItems: undefined, trueFalseAnswer: undefined };
    default:
      return base;
  }
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────
const GenerateMCQAIQuestion: React.FC<GenerateMCQAIQuestionProps> = ({
  breadcrumbs = [], // ← THIS IS THE MOST IMPORTANT FIX - default to empty array
  exerciseData,
  onClose,
  onSave,
  buttonClassName = '',
  buttonText = 'Generate with AI',
  isRegeneratingDuplicates = false,
  duplicateTopic = '',
  numberOfDuplicates = 0,
  onRegenerationComplete,
  maxSelectableCount = -1,
  scoringType = 'equalDistribution',
  marksPerQuestion = 0,
  remainingMarks,
  externalOpen = false,
  onExternalOpenHandled,
}) => {
  injectFonts();

  const [showModal, setShowModal]                   = useState(false);
  const [loading, setLoading]                       = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [topicInput, setTopicInput]                 = useState('');
  const [apiError, setApiError]                     = useState<ApiError | null>(null);
  const [editingQuestion, setEditingQuestion]       = useState<GeneratedQuestion | null>(null);
  const [selectAll, setSelectAll]                   = useState(false);
  const [showRightSidebar, setShowRightSidebar]     = useState(true);
  const [showCancelConfirm, setShowCancelConfirm]   = useState(false);
  const [showTypeDropdown, setShowTypeDropdown]     = useState(false);

  const [settings, setSettings] = useState<GenerationSettings>({
    numQuestions: 5,
    questionType: mapExerciseTypeToQuestionType(exerciseData.exerciseType),
    numOptions: 4,
    numPairs: 4,
    numItems: 4,
    includeExplanations: true,
    difficulty: mapExerciseLevelToDifficulty(exerciseData.exerciseLevel),
  });

  const abortControllerRef   = useRef<AbortController | null>(null);
  const modalRef             = useRef<HTMLDivElement>(null);
  const hasShownLimitWarning = useRef(false);

  const exerciseName =
    exerciseData?.exerciseName ||
    exerciseData?.fullExerciseData?.exerciseInformation?.exerciseName ||
    exerciseData?.nodeName || '';

  // ─── HELPERS ───────────────────────────────────────────────────────────────
  function mapExerciseTypeToQuestionType(exerciseType?: string): QuestionType {
    if (!exerciseType) return 'multiple-choice';
    const t = exerciseType.toLowerCase();
    if (t.includes('multiple') || t.includes('mcq') || t.includes('choice')) return 'multiple-choice';
    if (t.includes('checkbox') || t.includes('multi-select') || t.includes('multiple-select')) return 'multiple-select';
    if (t.includes('true') || t.includes('false') || t.includes('boolean')) return 'true-false';
    if (t.includes('dropdown') || t.includes('select')) return 'dropdown';
    if (t.includes('short') || t.includes('brief')) return 'short-answer';
    if (t.includes('paragraph') || t.includes('essay') || t.includes('long')) return 'paragraph';
    if (t.includes('match')) return 'matching';
    if (t.includes('order') || t.includes('sequence')) return 'ordering';
    if (t.includes('numeric') || t.includes('number')) return 'numeric';
    return 'multiple-choice';
  }

  function mapExerciseLevelToDifficulty(level?: string): 'easy' | 'medium' | 'hard' {
    if (!level) return 'medium';
    const lvl = level.toLowerCase();
    if (lvl.includes('easy') || lvl.includes('beginner')) return 'easy';
    if (lvl.includes('hard') || lvl.includes('advanced') || lvl.includes('difficult')) return 'hard';
    return 'medium';
  }

  // KEY CHANGE: For questionSpecific, points are always 0 (left empty — user fills in the form)
  // For equalDistribution, use marksPerQuestion
  const getPointsForQuestion = (): number => {
    if (scoringType === 'equalDistribution') return marksPerQuestion > 0 ? marksPerQuestion : 0;
    // questionSpecific: leave as 0 / undefined — user sets marks individually in the form
    return 0;
  };

  // Always allow generating up to 5 questions regardless of mode.
  // Slot/mark limits are only enforced at "Add Selected" time.
  const getMaxAllowedQuestions = (): number => 5;

  const getRandomCorrectCount = (): number => Math.floor(Math.random() * 3) + 1;

  // Never block the Generate button — limits only apply at "Add Selected"
  const cannotGenerate = false;

  // ─── RESET ─────────────────────────────────────────────────────────────────
  const resetModalToInitial = () => {
    setGeneratedQuestions([]);
    setEditingQuestion(null);
    setApiError(null);
    setSelectAll(false);
    const course = breadcrumbs.find(b => b.type === 'course')?.name || '';
    const module = breadcrumbs.find(b => b.type === 'module')?.name || '';
    const topic  = breadcrumbs.find(b => b.type === 'topic')?.name || exerciseData.nodeName || exerciseData.topic || '';
    setTopicInput([course, module, topic].filter(Boolean).join(' - '));
    setSettings({
      numQuestions: 5,
      questionType: mapExerciseTypeToQuestionType(exerciseData.exerciseType),
      numOptions: 4, numPairs: 4, numItems: 4,
      includeExplanations: true,
      difficulty: mapExerciseLevelToDifficulty(exerciseData.exerciseLevel),
    });
  };

  // ─── PROMPT BUILDER ────────────────────────────────────────────────────────
  const buildPrompt = (questionCount: number, mode: 'initial' | 'additional' | 'regenerate' = 'initial'): string => {
    const breadcrumbsText = breadcrumbs.map(b => `${b.type}: ${b.name}`).join(' → ');
    const typeLabel = mode === 'additional' ? 'ADDITIONAL ' : mode === 'regenerate' ? 'NEW ' : '';
    const { questionType, difficulty, includeExplanations, numOptions, numPairs, numItems } = settings;
    const explNote = includeExplanations ? 'Include an explanation for each question.' : 'Set explanation to empty string "".';
    const base = `Topic: "${topicInput}"\nLearning Path: ${breadcrumbsText}\nDifficulty: ${difficulty}\nGenerate EXACTLY ${questionCount} ${typeLabel}UNIQUE question${questionCount > 1 ? 's' : ''}.\n${explNote}\nReturn ONLY a valid JSON array — no markdown, no extra text.`;
    switch (questionType) {
      case 'multiple-choice': case 'dropdown':
        return `${base}\nType: ${questionType === 'dropdown' ? 'Dropdown' : 'Multiple Choice'} — EXACTLY ONE option correct, EXACTLY ${numOptions} options total.\nFormat: [{"title":"...","description":"...","options":[{"text":"...","isCorrect":true},{"text":"...","isCorrect":false},...(${numOptions} total)],"explanation":"..."}]`;
      case 'multiple-select':
        return `${base}\nType: Multiple Select — mark EXACTLY 1, 2, or 3 options correct (NEVER 0, NEVER all), EXACTLY ${numOptions} options total.\nFormat: [{"title":"...","description":"...","options":[{"text":"...","isCorrect":true/false},...(${numOptions} total)],"explanation":"..."}]`;
      case 'true-false':
        return `${base}\nType: True/False — trueFalseAnswer must be boolean true or false.\nFormat: [{"title":"...","description":"...","trueFalseAnswer":true,"explanation":"..."}]`;
      case 'short-answer':
        return `${base}\nType: Short Answer — correctAnswer is a word or short phrase.\nFormat: [{"title":"...","description":"...","correctAnswer":"...","explanation":"..."}]`;
      case 'paragraph':
        return `${base}\nType: Essay/Paragraph — correctAnswer is a sample answer or key points.\nFormat: [{"title":"...","description":"...","correctAnswer":"Sample answer or key points...","explanation":"..."}]`;
      case 'matching':
        return `${base}\nType: Matching — provide EXACTLY ${numPairs} prompt-answer pairs.\nFormat: [{"title":"...","description":"...","matchingPairs":[{"prompt":"...","answer":"..."},...(${numPairs} total)],"explanation":"..."}]`;
      case 'ordering':
        return `${base}\nType: Ordering/Sequence — provide EXACTLY ${numItems} items in the CORRECT order (first to last).\nFormat: [{"title":"...","description":"...","orderingItems":[{"text":"First step"},...(${numItems} total)],"explanation":"..."}]`;
      case 'numeric':
        return `${base}\nType: Numeric — numericAnswer is a number, numericTolerance is the acceptable margin (0 for exact).\nFormat: [{"title":"...","description":"...","numericAnswer":42,"numericTolerance":0,"explanation":"..."}]`;
      default:
        return `${base}\nFormat: [{"title":"...","description":"...","options":[{"text":"...","isCorrect":true/false}],"explanation":"..."}]`;
    }
  };

  // ─── EFFECTS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const course = breadcrumbs.find(b => b.type === 'course')?.name || '';
    const module = breadcrumbs.find(b => b.type === 'module')?.name || '';
    const topic  = breadcrumbs.find(b => b.type === 'topic')?.name || exerciseData.nodeName || exerciseData.topic || '';
    const suggestedTopic = [course, module, topic].filter(Boolean).join(' - ');
    if (suggestedTopic && !topicInput) setTopicInput(suggestedTopic);
  }, [breadcrumbs, exerciseData]);

  useEffect(() => {
    if (!showModal || !isRegeneratingDuplicates) return;
    if (duplicateTopic.trim()) setTopicInput(duplicateTopic.trim());
    if (numberOfDuplicates > 0) setSettings(prev => ({ ...prev, numQuestions: Math.max(1, Math.min(5, numberOfDuplicates)) }));
  }, [showModal, isRegeneratingDuplicates, duplicateTopic, numberOfDuplicates]);

  useEffect(() => {
    if (isRegeneratingDuplicates) setShowModal(true);
  }, [isRegeneratingDuplicates]);

  // Open modal when parent sets externalOpen=true, then notify parent it was handled
  useEffect(() => {
    if (externalOpen) {
      resetModalToInitial();
      setShowModal(true);
      onExternalOpenHandled?.();
    }
  }, [externalOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        if (!loading) handleCloseWithConfirm();
      }
    };
    if (showModal) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showModal, loading]);





  // In GenerateMCQAIQuestion.tsx, update the useEffect on line ~442

useEffect(() => {
  // Add safety check for breadcrumbs
  const safeBreadcrumbs = breadcrumbs || [];
  const course = safeBreadcrumbs.find((b: any) => b?.type === 'course')?.name || '';
  const module = safeBreadcrumbs.find((b: any) => b?.type === 'module')?.name || '';
  const topic = safeBreadcrumbs.find((b: any) => b?.type === 'topic')?.name || 
                exerciseData?.nodeName || 
                exerciseData?.topic || '';
  const suggestedTopic = [course, module, topic].filter(Boolean).join(' - ');
  if (suggestedTopic && !topicInput) setTopicInput(suggestedTopic);
}, [breadcrumbs, exerciseData, topicInput]);
  // No clamping needed — slider is always 1–5 for both modes

  // ─── CLOSE / CONFIRM ───────────────────────────────────────────────────────
  const handleCloseWithConfirm = () => {
    if (generatedQuestions.length > 0 || topicInput) setShowCancelConfirm(true);
    else handleClose();
  };
  const handleConfirmDiscard = () => { handleClose(); setShowCancelConfirm(false); };
  const handleKeepEditing    = () => setShowCancelConfirm(false);
  const handleClose = () => {
    if (!loading) {
      setShowModal(false); setGeneratedQuestions([]); setEditingQuestion(null);
      setApiError(null); setShowCancelConfirm(false); onClose();
    }
  };

  // ─── GEMINI API ────────────────────────────────────────────────────────────
  const callGeminiAI = async (prompt: string): Promise<string> => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setApiError(null);
    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, topK: 1, topP: 0.95, maxOutputTokens: 8192 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
        signal: abortControllerRef.current.signal,
      });
      if (!response.ok) return await callGeminiAIFallback(prompt);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('No response generated from AI');
      return text;
    } catch (error: any) {
      if (error.name === 'AbortError') return 'Request was cancelled.';
      setApiError({ message: 'Failed to connect to AI service', details: error.message });
      return await callGeminiAIFallback(prompt);
    }
  };

  const callGeminiAIFallback = async (prompt: string): Promise<string> => {
    try {
      const response = await fetch(GEMINI_API_URL_FALLBACK, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, topK: 1, topP: 0.95, maxOutputTokens: 4096 } }),
      });
      if (!response.ok) throw new Error(`Fallback API failed: ${response.status}`);
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
    } catch (error: any) {
      setApiError({ message: 'Both AI services failed', details: error.message });
      throw error;
    }
  };

  // ─── FORMAT OPTIONS ────────────────────────────────────────────────────────
  const formatOptions = (rawOptions: any[], type: QuestionType, targetCount: number) => {
    const isMultiSelect = type === 'multiple-select';
    if (!rawOptions || !Array.isArray(rawOptions) || rawOptions.length === 0) {
      const defaults = Array.from({ length: targetCount }, (_, i) => {
        const l = String.fromCharCode(65 + i);
        return { id: l.toLowerCase(), text: `Option ${l}`, isCorrect: false };
      });
      if (isMultiSelect) {
        const n = getRandomCorrectCount();
        Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, n).forEach(i => { if (defaults[i]) defaults[i].isCorrect = true; });
      } else { defaults[Math.floor(Math.random() * targetCount)].isCorrect = true; }
      return defaults;
    }
    let formatted = rawOptions.map((opt, i) => ({
      id: String.fromCharCode(97 + i),
      text: (opt.text || opt.content || opt.value || `Option ${String.fromCharCode(65 + i)}`).trim(),
      isCorrect: opt.isCorrect === true,
    }));
    if (isMultiSelect) {
      const count = formatted.filter(o => o.isCorrect).length;
      if (count === 0 || count === formatted.length) {
        const n = Math.min(getRandomCorrectCount(), formatted.length - 1);
        const idxs = Array.from({ length: formatted.length }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, Math.max(1, n));
        formatted = formatted.map((o, i) => ({ ...o, isCorrect: idxs.includes(i) }));
      }
    } else {
      const count = formatted.filter(o => o.isCorrect).length;
      if (count !== 1) {
        formatted = formatted.map(o => ({ ...o, isCorrect: false }));
        formatted[Math.floor(Math.random() * formatted.length)].isCorrect = true;
      }
    }
    return formatted;
  };

  // ─── PARSE AI RESPONSE ─────────────────────────────────────────────────────
  const parseAIResponse = (response: string, questionCount: number): GeneratedQuestion[] => {
    try {
      const clean = response.trim().replace(/```json\s*/gi,'').replace(/```\s*/gi,'');
      const start = clean.indexOf('['); const end = clean.lastIndexOf(']');
      if (start === -1 || end === -1 || end <= start) return [];
      const parsed = JSON.parse(clean.substring(start, end+1));
      if (!Array.isArray(parsed)) return [];
      return parsed.map((q, index) => {
        const type = settings.questionType as QuestionType || 'multiple-choice';
        const base: GeneratedQuestion = {
          id: `gen-${Date.now()}-${index}-${Math.random().toString(36).substr(2,4)}`,
          title: q.title || `${topicInput} - Question ${index+1}`,
          description: q.description || q.question || `Question about ${topicInput}`,
          difficulty: settings.difficulty,
          // KEY CHANGE: points always 0 for questionSpecific (user fills in form)
          points: getPointsForQuestion(),
          type, explanation: settings.includeExplanations ? (q.explanation || '') : '',
          selected: true, isEditing: false,
        };
        switch (type) {
          case 'multiple-choice': case 'multiple-select': case 'dropdown': {
            const options = formatOptions(q.options || [], type, settings.numOptions);
            return { ...base, options, correctAnswer: options.filter(o=>o.isCorrect).map(o=>o.text).join(', ') };
          }
          case 'true-false':
            return { ...base, trueFalseAnswer: typeof q.trueFalseAnswer === 'boolean' ? q.trueFalseAnswer : null, correctAnswer: typeof q.trueFalseAnswer === 'boolean' ? String(q.trueFalseAnswer) : '' };
          case 'short-answer': case 'paragraph':
            return { ...base, correctAnswer: q.correctAnswer || '' };
          case 'matching': {
            const pairs = Array.isArray(q.matchingPairs) && q.matchingPairs.length > 0
              ? q.matchingPairs.map((p: any, i: number) => ({ id: String.fromCharCode(97+i), prompt: p.prompt||`Prompt ${i+1}`, answer: p.answer||`Answer ${i+1}` }))
              : Array.from({ length: settings.numPairs }, (_, i) => ({ id: String.fromCharCode(97+i), prompt: `Prompt ${i+1}`, answer: `Answer ${i+1}` }));
            return { ...base, matchingPairs: pairs };
          }
          case 'ordering': {
            const items = Array.isArray(q.orderingItems) && q.orderingItems.length > 0
              ? q.orderingItems.map((item: any, i: number) => ({ id: String.fromCharCode(97+i), text: typeof item==='string' ? item : (item.text||`Step ${i+1}`) }))
              : Array.from({ length: settings.numItems }, (_, i) => ({ id: String.fromCharCode(97+i), text: `Step ${i+1}` }));
            return { ...base, orderingItems: items };
          }
          case 'numeric':
            return { ...base, numericAnswer: typeof q.numericAnswer === 'number' ? q.numericAnswer : null, numericTolerance: typeof q.numericTolerance === 'number' ? q.numericTolerance : 0, correctAnswer: q.numericAnswer != null ? String(q.numericAnswer) : '' };
          default: return base;
        }
      });
    } catch (e) { console.error('Failed to parse AI response:', e); return []; }
  };

  // ─── TEMPLATE (fallback) ───────────────────────────────────────────────────
  const createTemplateQuestion = (index: number, overrideType?: QuestionType): GeneratedQuestion => {
    const type = overrideType || (settings.questionType as QuestionType) || 'multiple-choice';
    const base: GeneratedQuestion = {
      id: `gen-template-${Date.now()}-${index}-${Math.random().toString(36).substr(2,4)}`,
      title: `${topicInput || 'Question'} - ${index}`,
      description: `Create a ${settings.difficulty} level ${TYPE_CONFIG[type].label} question about ${topicInput || 'this topic'}.`,
      difficulty: settings.difficulty,
      // KEY CHANGE: points always 0 for questionSpecific
      points: getPointsForQuestion(),
      type, explanation: settings.includeExplanations ? 'Please provide an explanation for the correct answer.' : '',
      selected: true, isEditing: false,
    };
    switch (type) {
      case 'multiple-choice': case 'multiple-select': case 'dropdown': {
        const isMultiSelect = type === 'multiple-select'; const count = settings.numOptions; let options;
        if (isMultiSelect) {
          const n = Math.min(getRandomCorrectCount(), count - 1);
          const idxs = Array.from({ length: count }, (_, i) => i).sort(() => Math.random()-0.5).slice(0, Math.max(1, n));
          options = Array.from({ length: count }, (_, i) => { const l = String.fromCharCode(65+i); return { id: l.toLowerCase(), text: `Option ${l}`, isCorrect: idxs.includes(i) }; });
        } else {
          const ci = Math.floor(Math.random() * count);
          options = Array.from({ length: count }, (_, i) => { const l = String.fromCharCode(65+i); return { id: l.toLowerCase(), text: `Option ${l}`, isCorrect: i === ci }; });
        }
        return { ...base, options, correctAnswer: options.filter(o=>o.isCorrect).map(o=>o.text).join(', ') };
      }
      case 'true-false':   return { ...base, trueFalseAnswer: true, correctAnswer: 'true' };
      case 'short-answer': return { ...base, correctAnswer: 'Expected answer here' };
      case 'paragraph':    return { ...base, correctAnswer: 'Sample answer or key points...' };
      case 'matching':     return { ...base, matchingPairs: Array.from({ length: settings.numPairs }, (_, i) => ({ id: String.fromCharCode(97+i), prompt: `Prompt ${i+1}`, answer: `Answer ${i+1}` })) };
      case 'ordering':     return { ...base, orderingItems: Array.from({ length: settings.numItems }, (_, i) => ({ id: String.fromCharCode(97+i), text: `Step ${i+1}` })) };
      case 'numeric':      return { ...base, numericAnswer: 0, numericTolerance: 0, correctAnswer: '0' };
      default:             return base;
    }
  };

  // ─── GENERATE ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!topicInput.trim()) { setApiError({ message: 'Please enter a topic for the questions' }); return; }
    if (!settings.questionType) { setApiError({ message: 'Please select a question type first' }); return; }
    // No slot/mark blocking here — limits enforced only at "Add Selected"

    setLoading(true); setApiError(null); setGeneratedQuestions([]);
    const count = settings.numQuestions;
    try {
      const aiResponse = await callGeminiAI(buildPrompt(count, 'initial'));
      let final = parseAIResponse(aiResponse, count);
      if (final.length < count) final = [...final, ...Array.from({ length: count - final.length }, (_, i) => createTemplateQuestion(final.length+i+1))];
      final = final.slice(0, count);
      // equalDistribution: auto-select only up to remaining slots; questionSpecific: all selected
      setGeneratedQuestions(final.map((q, i) => ({
        ...q,
        selected: scoringType === 'equalDistribution' && maxSelectableCount >= 0
          ? i < maxSelectableCount
          : true,
      })));
    } catch {
      const fallback = Array.from({ length: count }, (_, i) => createTemplateQuestion(i+1));
      setGeneratedQuestions(fallback.map((q, i) => ({
        ...q,
        selected: scoringType === 'equalDistribution' && maxSelectableCount >= 0
          ? i < maxSelectableCount
          : true,
      })));
    } finally { setLoading(false); }
  };

  const handleAddMore = async () => {
    if (!topicInput.trim()) return;
    if (!settings.questionType) { setApiError({ message: 'Please select a question type first' }); return; }
    // No blocking — limits enforced at "Add Selected"
    const count = settings.numQuestions; setLoading(true); setApiError(null);
    try {
      const aiResponse = await callGeminiAI(buildPrompt(count, 'additional'));
      const parsed = parseAIResponse(aiResponse, count);
      const newQs = (parsed.length > 0 ? parsed.slice(0, count) : Array.from({ length: count }, (_, i) => createTemplateQuestion(generatedQuestions.length+i+1))).map((q, i) => ({ ...q, id: `gen-${Date.now()}-${i}-${Math.random().toString(36).substr(2,4)}`, selected: false }));
      setGeneratedQuestions(prev => [...prev, ...newQs]);
    } catch {
      setGeneratedQuestions(prev => [...prev, ...Array.from({ length: count }, (_, i) => ({ ...createTemplateQuestion(prev.length+i+1), selected: false }))]);
    } finally { setLoading(false); }
  };

  const handleRegenerateSelected = async () => {
    const selected = generatedQuestions.filter(q => q.selected);
    if (selected.length === 0) { setApiError({ message: 'Please select at least one question to regenerate' }); return; }
    const count = selected.length; setLoading(true); setApiError(null);
    try {
      const aiResponse = await callGeminiAI(buildPrompt(count, 'regenerate'));
      const parsed = parseAIResponse(aiResponse, count);
      const selectedIds = selected.map(q => q.id);
      const newQs = (parsed.length > 0 ? parsed.slice(0, count) : Array.from({ length: count }, (_, i) => createTemplateQuestion(i+1))).map((q, i) => ({ ...q, id: `gen-${Date.now()}-${i}-${Math.random().toString(36).substr(2,4)}`, selected: true }));
      setGeneratedQuestions(prev => [...prev.filter(q => !selectedIds.includes(q.id)), ...newQs]);
    } catch {
      const selectedIds = selected.map(q => q.id);
      setGeneratedQuestions(prev => [...prev.filter(q => !selectedIds.includes(q.id)), ...Array.from({ length: count }, (_, i) => ({ ...createTemplateQuestion(i+1), selected: true }))]);
    } finally { setLoading(false); }
  };

  // ─── CHANGE QUESTION TYPE ─────────────────────────────────────────────────
  const handleChangeQuestionType = (questionId: string, newType: QuestionType) => {
    setGeneratedQuestions(prev => prev.map(q => q.id === questionId ? rebuildQuestionForType(q, newType) : q));
    if (editingQuestion?.id === questionId) setEditingQuestion(prev => prev ? rebuildQuestionForType(prev, newType) : null);
  };

  // ─── EDITING ───────────────────────────────────────────────────────────────
  const startEditing  = (q: GeneratedQuestion) => setEditingQuestion({ ...q, isEditing: true });
  const cancelEditing = () => setEditingQuestion(null);
  const saveEditing   = () => {
    if (editingQuestion) {
      setGeneratedQuestions(prev => prev.map(q => q.id === editingQuestion.id ? { ...editingQuestion, isEditing: false } : q));
      setEditingQuestion(null);
    }
  };
  const updateEditingQuestion = (field: string, value: any) => {
    if (editingQuestion) setEditingQuestion({ ...editingQuestion, [field]: value });
  };
  const updateEditingOption = (optionId: string, field: string, value: any) => {
    if (!editingQuestion?.options) return;
    let opts = editingQuestion.options.map(o => o.id === optionId ? { ...o, [field]: value } : o);
    if (field === 'isCorrect' && value === true && (editingQuestion.type === 'multiple-choice' || editingQuestion.type === 'dropdown'))
      opts = opts.map(o => ({ ...o, isCorrect: o.id === optionId }));
    if (editingQuestion.type === 'multiple-select') {
      const count = opts.filter(o => o.isCorrect).length;
      if (count === opts.length) opts = opts.map(o => ({ ...o, isCorrect: o.id === optionId }));
      if (count === 0) opts = opts.map(o => ({ ...o, isCorrect: o.id === optionId ? true : o.isCorrect }));
    }
    setEditingQuestion({ ...editingQuestion, options: opts });
  };

  // ─── SELECTION ─────────────────────────────────────────────────────────────
  const toggleQuestionSelection = (questionId: string) => {
    setGeneratedQuestions(prev => {
      const question = prev.find(q => q.id === questionId);
      if (!question) return prev;
      // equalDistribution: don't allow checking beyond remaining slots
      if (scoringType === 'equalDistribution' && maxSelectableCount >= 0 && !question.selected) {
        const currentSelected = prev.filter(q => q.selected).length;
        if (currentSelected >= maxSelectableCount) return prev; // silently block — footer shows the reason
      }
      return prev.map(q => q.id === questionId ? { ...q, selected: !q.selected } : q);
    });
  };

  const toggleSelectAll = () => {
    const newVal = !selectAll; setSelectAll(newVal);
    setGeneratedQuestions(prev => {
      if (scoringType === 'equalDistribution' && maxSelectableCount >= 0) {
        return prev.map((q, i) => ({ ...q, selected: newVal ? i < maxSelectableCount : false }));
      }
      return prev.map(q => ({ ...q, selected: newVal }));
    });
  };

  useEffect(() => {
    if (generatedQuestions.length > 0) {
      const selectedCount = generatedQuestions.filter(q => q.selected).length;
      if (scoringType === 'equalDistribution' && maxSelectableCount >= 0) {
        // "all" means all available slots are filled
        setSelectAll(selectedCount >= maxSelectableCount && maxSelectableCount > 0);
      } else {
        setSelectAll(generatedQuestions.every(q => q.selected));
      }
    }
  }, [generatedQuestions, scoringType, maxSelectableCount]);

  const deleteQuestion = (id: string) => setGeneratedQuestions(prev => prev.filter(q => q.id !== id));

  const addCustomQuestion = () => {
    const q = { ...createTemplateQuestion(generatedQuestions.length+1), id: `custom-${Date.now()}-${Math.random().toString(36).substr(2,4)}`, isEditing: true, selected: false };
    setGeneratedQuestions(prev => [...prev, q]); setEditingQuestion(q);
  };

  const handleSave = () => {
    const selected = generatedQuestions.filter(q => q.selected);
    if (selected.length === 0) { setApiError({ message: 'Please select at least one question to add' }); return; }

    // ── Enforce limits only at "Add Selected" time ──
    if (scoringType === 'equalDistribution' && maxSelectableCount >= 0 && selected.length > maxSelectableCount) {
      setApiError({ message: `Only ${maxSelectableCount} question slot${maxSelectableCount !== 1 ? 's' : ''} remaining. Please deselect ${selected.length - maxSelectableCount} question${selected.length - maxSelectableCount !== 1 ? 's' : ''}.` });
      return;
    }
    // For questionSpecific: no count limit — all selected go through (marks validated in form)

    const formattedSelected = selected.map(q => ({
      ...q,
      options: q.options?.map(opt => ({ id: opt.id || `opt-${Date.now()}-${Math.random()}`, text: opt.text || '', isCorrect: opt.isCorrect || false, imageAlignment: 'center', imageSizePercent: 60 })) || [],
      questionImageAlignment: 'center', questionImageSizePercent: 60, optionsPerRow: 1,
      // For questionSpecific: pass score as 0 so form leaves it empty for user to fill
      points: scoringType === 'questionSpecific' ? 0 : q.points,
    }));
    if (isRegeneratingDuplicates && onRegenerationComplete) onRegenerationComplete(formattedSelected);
    else onSave(formattedSelected);
    resetModalToInitial(); setShowModal(false); onClose();
  };

  const selectedCount = generatedQuestions.filter(q => q.selected).length;
  const currentTypeMeta = settings.questionType ? TYPE_CONFIG[settings.questionType as QuestionType] : null;
  const maxAllowed = getMaxAllowedQuestions();

  // ─── INLINE STYLES ────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--lms-font)', fontSize: 12, border: '1.5px solid var(--lms-border)',
    borderRadius: 'var(--lms-radius-sm)', padding: '6px 10px', outline: 'none',
    background: 'var(--lms-bg-white)', color: 'var(--lms-text-main)', width: '100%',
    transition: 'border-color 0.15s',
  };
  const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'none', lineHeight: 1.6 };

  // ─── QUESTION PREVIEW ──────────────────────────────────────────────────────
  const renderQuestionPreview = (question: GeneratedQuestion) => {
    const diff = DIFF_CFG[question.difficulty];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--lms-text-main)', flex: 1, lineHeight: 1.5 }}>{question.title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <select value={question.type} onChange={e => handleChangeQuestionType(question.id, e.target.value as QuestionType)}
              style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600, color: 'var(--lms-violet)', borderBottom: '1.5px solid var(--lms-border)', background: 'transparent', outline: 'none', cursor: 'pointer', paddingBottom: 2, paddingRight: 16, appearance: 'none' }}>
              {TYPE_GROUPS.map(group => (
                <optgroup key={group} label={group}>
                  {(Object.entries(TYPE_CONFIG) as [QuestionType, TypeMeta][]).filter(([,cfg]) => cfg.group === group).map(([type, cfg]) => (
                    <option key={type} value={type}>{cfg.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>{diff.label}</span>
            {question.type === 'multiple-select' && (
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--lms-violet-bg)', color: 'var(--lms-violet)', border: '1px solid var(--lms-violet-bdr)' }}>
                {question.options?.filter(o=>o.isCorrect).length||0}/{question.options?.length||0} ✓
              </span>
            )}
          </div>
        </div>

        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, color: 'var(--lms-text-sec)', lineHeight: 1.55 }}>{question.description}</p>

        {(question.type === 'multiple-choice' || question.type === 'multiple-select' || question.type === 'dropdown') && question.options && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {question.options.map(opt => (
              <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 8, background: opt.isCorrect ? 'var(--lms-success-bg)' : 'var(--lms-bg-surface)', border: `1.5px solid ${opt.isCorrect ? 'var(--lms-success-bdr)' : 'var(--lms-border)'}` }}>
                {question.type === 'multiple-select' ? (
                  <div style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${opt.isCorrect ? 'var(--lms-success)' : 'var(--lms-border-hover)'}`, background: opt.isCorrect ? 'var(--lms-success)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {opt.isCorrect && <svg style={{ width: 8, height: 8 }} viewBox="0 0 20 20" fill="white"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                  </div>
                ) : (
                  <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${opt.isCorrect ? 'var(--lms-success)' : 'var(--lms-border-hover)'}`, background: opt.isCorrect ? 'var(--lms-success)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {opt.isCorrect && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />}
                  </div>
                )}
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: opt.isCorrect ? 'var(--lms-success)' : 'var(--lms-text-sec)', fontWeight: opt.isCorrect ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.text}</span>
              </div>
            ))}
          </div>
        )}

        {question.type === 'true-false' && (
          <div style={{ display: 'flex', gap: 8 }}>
            {[true, false].map(val => (
              <div key={String(val)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: question.trueFalseAnswer === val ? 'var(--lms-success-bg)' : 'var(--lms-bg-surface)', border: `1.5px solid ${question.trueFalseAnswer === val ? 'var(--lms-success-bdr)' : 'var(--lms-border)'}` }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${question.trueFalseAnswer === val ? 'var(--lms-success)' : 'var(--lms-border-hover)'}`, background: question.trueFalseAnswer === val ? 'var(--lms-success)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {question.trueFalseAnswer === val && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />}
                </div>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 600, color: question.trueFalseAnswer === val ? 'var(--lms-success)' : 'var(--lms-text-sec)' }}>{val ? 'True' : 'False'}</span>
              </div>
            ))}
          </div>
        )}

        {(question.type === 'short-answer' || question.type === 'paragraph') && (
          <div style={{ background: 'var(--lms-success-bg)', border: '1.5px solid var(--lms-success-bdr)', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, fontWeight: 700, color: 'var(--lms-success)' }}>Answer: </span>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-success)' }}>{question.correctAnswer || '—'}</span>
          </div>
        )}

        {question.type === 'matching' && question.matchingPairs && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {question.matchingPairs.map(pair => (
              <div key={pair.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span style={{ fontFamily: 'var(--lms-font)', padding: '4px 8px', background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)', borderRadius: 6, color: 'var(--lms-info)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pair.prompt}</span>
                <span style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }}>→</span>
                <span style={{ fontFamily: 'var(--lms-font)', padding: '4px 8px', background: 'var(--lms-success-bg)', border: '1.5px solid var(--lms-success-bdr)', borderRadius: 6, color: 'var(--lms-success)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pair.answer}</span>
              </div>
            ))}
          </div>
        )}

        {question.type === 'ordering' && question.orderingItems && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {question.orderingItems.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)', borderRadius: 8 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--lms-info-bg)', color: 'var(--lms-info)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--lms-font)' }}>{i+1}</span>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-main)' }}>{item.text}</span>
              </div>
            ))}
          </div>
        )}

        {question.type === 'numeric' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--lms-success-bg)', border: '1.5px solid var(--lms-success-bdr)', borderRadius: 8 }}>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, fontWeight: 700, color: 'var(--lms-success)' }}>Answer:</span>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-success)' }}>{question.numericAnswer ?? '—'}</span>
              {(question.numericTolerance ?? 0) > 0 && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-success)' }}>± {question.numericTolerance}</span>}
            </div>
          </div>
        )}

        {settings.includeExplanations && question.explanation && (
          <div style={{ background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-info)' }}>💡 {question.explanation}</span>
          </div>
        )}
      </div>
    );
  };

  // ─── QUESTION EDITOR ───────────────────────────────────────────────────────
  const renderQuestionEditor = (question: GeneratedQuestion) => {
    const isEditing = editingQuestion?.id === question.id;
    if (!isEditing) return renderQuestionPreview(question);
    const eq = editingQuestion!;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'var(--lms-violet-bg)', borderRadius: 'var(--lms-radius-md)', border: '1.5px solid var(--lms-violet-bdr)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--lms-violet)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Edit2 size={12} /> Editing
            </span>
            <select value={eq.type}
              onChange={e => {
                const rebuilt = rebuildQuestionForType(eq, e.target.value as QuestionType);
                setEditingQuestion(rebuilt);
                setGeneratedQuestions(prev => prev.map(q => q.id === eq.id ? { ...rebuilt, isEditing: true } : q));
              }}
              style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600, color: 'var(--lms-violet)', borderBottom: '1.5px solid var(--lms-violet-bdr)', background: 'transparent', outline: 'none', cursor: 'pointer' }}>
              {TYPE_GROUPS.map(group => (
                <optgroup key={group} label={group}>
                  {(Object.entries(TYPE_CONFIG) as [QuestionType, TypeMeta][]).filter(([,cfg]) => cfg.group === group).map(([type, cfg]) => (
                    <option key={type} value={type}>{cfg.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveEditing} style={{ padding: '4px 12px', background: 'var(--lms-violet)', color: 'white', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>Save</button>
            <button onClick={cancelEditing} style={{ padding: '4px 12px', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', fontSize: 11, fontWeight: 600, border: '1.5px solid var(--lms-border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>Cancel</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input type="text" value={eq.title || ''} onChange={e => updateEditingQuestion('title', e.target.value)} placeholder="Question title..." style={inputStyle} />
          <textarea value={eq.description || ''} onChange={e => updateEditingQuestion('description', e.target.value)} rows={2} placeholder="Enter question text..." style={textareaStyle} />
        </div>

        {(eq.type === 'short-answer' || eq.type === 'paragraph') && (
          <div>
            <label style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>{eq.type === 'short-answer' ? 'Correct Answer' : 'Sample Answer'}</label>
            {eq.type === 'short-answer'
              ? <input type="text" value={eq.correctAnswer || ''} onChange={e => updateEditingQuestion('correctAnswer', e.target.value)} style={inputStyle} />
              : <textarea value={eq.correctAnswer || ''} onChange={e => updateEditingQuestion('correctAnswer', e.target.value)} rows={2} style={textareaStyle} />}
          </div>
        )}

        {(eq.type === 'multiple-choice' || eq.type === 'multiple-select' || eq.type === 'dropdown') && eq.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Options</label>
            {eq.options.map(opt => (
              <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={() => updateEditingOption(opt.id, 'isCorrect', !opt.isCorrect)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                  {eq.type === 'multiple-select' ? (
                    <div style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${opt.isCorrect ? 'var(--lms-success)' : 'var(--lms-border-hover)'}`, background: opt.isCorrect ? 'var(--lms-success)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {opt.isCorrect && <svg style={{ width: 8, height: 8 }} viewBox="0 0 20 20" fill="white"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                    </div>
                  ) : (
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${opt.isCorrect ? 'var(--lms-success)' : 'var(--lms-border-hover)'}`, background: opt.isCorrect ? 'var(--lms-success)' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {opt.isCorrect && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'white' }} />}
                    </div>
                  )}
                </button>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--lms-text-hint)', width: 16 }}>{opt.id.toUpperCase()}</span>
                <input type="text" value={opt.text} onChange={e => updateEditingOption(opt.id, 'text', e.target.value)} style={{ ...inputStyle, flex: 1, padding: '4px 8px' }} />
              </div>
            ))}
          </div>
        )}

        {eq.type === 'true-false' && (
          <div>
            <label style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Correct Answer</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[true, false].map(val => (
                <button key={String(val)} type="button" onClick={() => updateEditingQuestion('trueFalseAnswer', val)}
                  style={{ flex: 1, padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1.5px solid ${eq.trueFalseAnswer === val ? 'var(--lms-success-bdr)' : 'var(--lms-border)'}`, background: eq.trueFalseAnswer === val ? 'var(--lms-success-bg)' : 'var(--lms-bg-white)', color: eq.trueFalseAnswer === val ? 'var(--lms-success)' : 'var(--lms-text-sec)', cursor: 'pointer', fontFamily: 'var(--lms-font)', transition: 'all 0.15s' }}>
                  {val ? 'True' : 'False'}
                </button>
              ))}
            </div>
          </div>
        )}

        {eq.type === 'matching' && eq.matchingPairs && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Matching Pairs</label>
            {eq.matchingPairs.map((pair, i) => (
              <div key={pair.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-hint)', width: 20 }}>{i+1}.</span>
                <input type="text" value={pair.prompt} onChange={e => { const pairs = [...eq.matchingPairs!]; pairs[i] = { ...pairs[i], prompt: e.target.value }; updateEditingQuestion('matchingPairs', pairs); }} placeholder="Prompt..." style={{ ...inputStyle, flex: 1, padding: '4px 8px' }} />
                <span style={{ color: 'var(--lms-text-hint)', fontSize: 12, flexShrink: 0 }}>→</span>
                <input type="text" value={pair.answer} onChange={e => { const pairs = [...eq.matchingPairs!]; pairs[i] = { ...pairs[i], answer: e.target.value }; updateEditingQuestion('matchingPairs', pairs); }} placeholder="Answer..." style={{ ...inputStyle, flex: 1, padding: '4px 8px' }} />
              </div>
            ))}
          </div>
        )}

        {eq.type === 'ordering' && eq.orderingItems && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Correct Order</label>
            {eq.orderingItems.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--lms-info-bg)', color: 'var(--lms-info)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'var(--lms-font)' }}>{i+1}</span>
                <input type="text" value={item.text} onChange={e => { const items = [...eq.orderingItems!]; items[i] = { ...items[i], text: e.target.value }; updateEditingQuestion('orderingItems', items); }} style={{ ...inputStyle, flex: 1, padding: '4px 8px' }} />
              </div>
            ))}
          </div>
        )}

        {eq.type === 'numeric' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>Numeric Answer</label>
              <input type="number" value={eq.numericAnswer ?? ''} onChange={e => updateEditingQuestion('numericAnswer', e.target.value === '' ? null : Number(e.target.value))} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>Tolerance (±)</label>
              <input type="number" min="0" step="0.1" value={eq.numericTolerance ?? 0} onChange={e => updateEditingQuestion('numericTolerance', Number(e.target.value))} style={inputStyle} />
            </div>
          </div>
        )}

        {settings.includeExplanations && (
          <div>
            <label style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>Explanation</label>
            <textarea value={eq.explanation || ''} onChange={e => updateEditingQuestion('explanation', e.target.value)} rows={2} style={textareaStyle} />
          </div>
        )}
      </div>
    );
  };

  // ─── SETTINGS SIDEBAR ──────────────────────────────────────────────────────
  const renderSettingsSidebar = () => {
    const qType = settings.questionType as QuestionType | '';
    const typeMeta = qType ? TYPE_CONFIG[qType] : null;

    return (
      <div className="ai-sidebar-scroll"
        style={{ flexShrink: 0, overflowY: 'auto', borderLeft: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', transition: 'width 0.2s', width: showRightSidebar ? 256 : 0, overflow: showRightSidebar ? 'auto' : 'hidden' }}>
        {showRightSidebar && (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Settings</span>
              <button onClick={() => setShowRightSidebar(false)} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)' }}>
                <X size={14} />
              </button>
            </div>

            {/* Question Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>Question Type</label>
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowTypeDropdown(v => !v)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 'var(--lms-radius-md)', border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, color: 'var(--lms-text-main)', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {typeMeta ? (
                      <><span style={{ color: 'var(--lms-text-muted)' }}>{typeMeta.icon}</span><span>{typeMeta.label}</span></>
                    ) : (
                      <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }}>Select question type…</span>
                    )}
                  </span>
                  <ChevronDown size={13} style={{ color: 'var(--lms-text-muted)', transform: showTypeDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
                {showTypeDropdown && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)', boxShadow: 'var(--lms-shadow-md)', overflow: 'hidden' }}>
                    {TYPE_GROUPS.map(group => {
                      const groupTypes = (Object.entries(TYPE_CONFIG) as [QuestionType, TypeMeta][]).filter(([,cfg]) => cfg.group === group);
                      return (
                        <div key={group}>
                          <div style={{ padding: '6px 12px 4px', fontFamily: 'var(--lms-font)', fontSize: 9.5, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'var(--lms-bg-surface)' }}>{group}</div>
                          {groupTypes.map(([type, cfg]) => (
                            <button key={type} onClick={() => { setSettings(prev => ({ ...prev, questionType: type })); setShowTypeDropdown(false); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: settings.questionType === type ? 'var(--lms-orange-50)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--lms-font)', transition: 'background 0.1s', textAlign: 'left' }}>
                              <span style={{ color: settings.questionType === type ? 'var(--lms-orange)' : 'var(--lms-text-muted)' }}>{cfg.icon}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11.5, fontWeight: settings.questionType === type ? 700 : 500, color: settings.questionType === type ? '#c85a30' : 'var(--lms-text-main)' }}>{cfg.label}</div>
                                <div style={{ fontSize: 10, color: 'var(--lms-text-hint)' }}>{cfg.description}</div>
                              </div>
                              {settings.questionType === type && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lms-orange)', flexShrink: 0 }} />}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {exerciseData.exerciseType && (
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)' }}>From exercise: <strong>{exerciseData.exerciseType}</strong></p>
              )}
            </div>

            {/* Number of Options */}
            {typeMeta?.hasCustomCount && qType && ['multiple-choice','multiple-select','dropdown'].includes(qType) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>Number of Options</label>
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', background: 'var(--lms-orange-50)', padding: '2px 8px', borderRadius: 8 }}>{settings.numOptions}</span>
                </div>
                <input type="range" min="2" max="8" value={settings.numOptions} onChange={e => setSettings(prev => ({ ...prev, numOptions: parseInt(e.target.value) }))} className="lms-range" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--lms-font)', fontSize: 9.5, color: 'var(--lms-text-hint)' }}><span>2</span><span>4</span><span>6</span><span>8</span></div>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)' }}>Each question will have {settings.numOptions} answer choices</p>
              </div>
            )}

            {/* Number of Pairs */}
            {qType === 'matching' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>Number of Pairs</label>
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', background: 'var(--lms-orange-50)', padding: '2px 8px', borderRadius: 8 }}>{settings.numPairs}</span>
                </div>
                <input type="range" min="2" max="8" value={settings.numPairs} onChange={e => setSettings(prev => ({ ...prev, numPairs: parseInt(e.target.value) }))} className="lms-range" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--lms-font)', fontSize: 9.5, color: 'var(--lms-text-hint)' }}><span>2</span><span>4</span><span>6</span><span>8</span></div>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)' }}>{settings.numPairs} rows × 2 columns</p>
              </div>
            )}

            {/* Number of Items */}
            {qType === 'ordering' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>Number of Items</label>
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', background: 'var(--lms-orange-50)', padding: '2px 8px', borderRadius: 8 }}>{settings.numItems}</span>
                </div>
                <input type="range" min="2" max="8" value={settings.numItems} onChange={e => setSettings(prev => ({ ...prev, numItems: parseInt(e.target.value) }))} className="lms-range" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--lms-font)', fontSize: 9.5, color: 'var(--lms-text-hint)' }}><span>2</span><span>4</span><span>6</span><span>8</span></div>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)' }}>{settings.numItems} items to order</p>
              </div>
            )}

            {/* Questions to Generate */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>Questions to Generate</label>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', background: 'var(--lms-orange-50)', padding: '2px 8px', borderRadius: 8 }}>{settings.numQuestions}</span>
              </div>
              <input
                type="range" min="1" max="5" value={settings.numQuestions}
                onChange={e => setSettings(prev => ({ ...prev, numQuestions: parseInt(e.target.value) }))}
                className="lms-range"
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--lms-font)', fontSize: 9.5, color: 'var(--lms-text-hint)' }}>
                <span>1</span><span>3</span><span>5</span>
              </div>
              {/* Info note per scoring type */}
              {scoringType === 'equalDistribution' && maxSelectableCount >= 0 && (
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)' }}>
                  {maxSelectableCount} slot{maxSelectableCount !== 1 ? 's' : ''} remaining — select only what fits when adding
                </p>
              )}
              {scoringType === 'questionSpecific' && (
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-info)', fontWeight: 600 }}>
                  Scores set individually in the question form
                </p>
              )}
            </div>

            {/* Difficulty */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>Difficulty</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {(['easy','medium','hard'] as const).map(d => {
                  const cfg = DIFF_CFG[d];
                  const isActive = settings.difficulty === d;
                  return (
                    <button key={d} onClick={() => setSettings(prev => ({ ...prev, difficulty: d }))}
                      style={{ padding: '6px 0', borderRadius: 8, fontSize: 10.5, fontWeight: 700, textTransform: 'capitalize', border: `1.5px solid ${isActive ? cfg.border : 'var(--lms-border)'}`, background: isActive ? cfg.bg : 'var(--lms-bg-surface)', color: isActive ? cfg.color : 'var(--lms-text-muted)', cursor: 'pointer', fontFamily: 'var(--lms-font)', transition: 'all 0.15s' }}>
                      {d}
                    </button>
                  );
                })}
              </div>
              {exerciseData.exerciseLevel && (
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)' }}>From level: <strong>{exerciseData.exerciseLevel}</strong></p>
              )}
            </div>

            {/* Include Explanations */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <div>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>Explanations</p>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)' }}>Add answer explanations</p>
              </div>
              <label className="lms-toggle-track">
                <input type="checkbox" checked={settings.includeExplanations} onChange={() => setSettings(prev => ({ ...prev, includeExplanations: !prev.includeExplanations }))} />
                <span className="lms-toggle-slider" />
              </label>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="ai-gen-root">
      {/* ── TRIGGER BUTTON — hidden when controlled externally via externalOpen ── */}
      {buttonText !== null && (
        <button
          onClick={() => { resetModalToInitial(); setShowModal(true); }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90 shadow-sm ${buttonClassName}`}
          style={{ fontFamily: 'var(--lms-font)' }}
          disabled={cannotGenerate}
        >
          {typeof buttonText === 'string' ? (
            <><Wand2 size={13} />{buttonText}{cannotGenerate ? ' (Limit reached)' : ''}</>
          ) : buttonText}
        </button>
      )}

      {/* ── MODAL ── */}
      {showModal && (
        <div className="lms-modal-backdrop-ai">
          <div ref={modalRef} style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 960, border: '1.5px solid var(--lms-border)', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'var(--lms-bg-white)', borderBottom: '1.5px solid var(--lms-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--lms-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px var(--lms-orange-glow)' }}>
                  <Sparkles size={16} style={{ color: 'white' }} />
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--lms-border)', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}><AIBreadcrumb breadcrumbs={breadcrumbs} exerciseName={exerciseName} /></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                {apiError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)', borderRadius: 'var(--lms-radius-md)', padding: '6px 12px', maxWidth: 260 }}>
                    <AlertCircle size={12} style={{ color: 'var(--lms-danger)', flexShrink: 0 }} />
                    <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apiError.message}</p>
                  </div>
                )}
                <button onClick={resetModalToInitial} title="Reset"
                  style={{ padding: 8, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', transition: 'background 0.15s' }}>
                  <RefreshCw size={14} />
                </button>
                <button onClick={() => setShowRightSidebar(!showRightSidebar)} title="Toggle settings"
                  style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: showRightSidebar ? 'var(--lms-orange-50)' : 'none', color: showRightSidebar ? 'var(--lms-orange)' : 'var(--lms-text-muted)' }}>
                  <SlidersHorizontal size={14} />
                </button>
                <button onClick={handleCloseWithConfirm} disabled={loading}
                  style={{ padding: 8, borderRadius: 8, border: 'none', background: 'none', cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--lms-text-muted)', opacity: loading ? 0.5 : 1 }}>
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* ── CANCEL CONFIRM OVERLAY ── */}
            {showCancelConfirm && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 110, background: 'rgba(26,26,46,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--lms-radius-lg)' }}>
                <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 20, maxWidth: 360, margin: 16, border: '1.5px solid var(--lms-border)' }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--lms-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <AlertCircle size={16} style={{ color: 'var(--lms-warning)' }} />
                    </div>
                    <div>
                      <h4 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)', marginBottom: 4 }}>Discard changes?</h4>
                      <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', marginBottom: 14, lineHeight: 1.6 }}>
                        {generatedQuestions.length > 0
                          ? `You have ${generatedQuestions.length} generated question${generatedQuestions.length !== 1 ? 's' : ''} that will be lost.`
                          : 'Your unsaved changes will be lost.'}
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleKeepEditing} style={{ flex: 1, padding: '7px 0', border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', borderRadius: 10, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>Keep Editing</button>
                        <button onClick={handleConfirmDiscard} style={{ flex: 1, padding: '7px 0', border: 'none', background: 'var(--lms-danger)', color: 'white', borderRadius: 10, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>Discard</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── BODY ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }} onClick={() => showTypeDropdown && setShowTypeDropdown(false)}>
              <div style={{ flex: 1, overflowY: 'auto', background: 'var(--lms-bg-white)' }}>

                {generatedQuestions.length === 0 ? (
                  /* Empty state / generate prompt */
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: 32 }}>
                    <div style={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 16 }}>

                      {/* API error banner */}
                      {apiError && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)', borderRadius: 'var(--lms-radius-md)', padding: '10px 14px' }}>
                          <AlertCircle size={14} style={{ color: 'var(--lms-danger)', flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-danger)' }}>{apiError.message}</p>
                            {apiError.details && <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-danger)', marginTop: 2 }}>{apiError.details}</p>}
                          </div>
                        </div>
                      )}

                      {/* Limit warning — only for equalDistribution */}
                      {cannotGenerate && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)', borderRadius: 'var(--lms-radius-md)', padding: '10px 14px' }}>
                          <AlertCircle size={14} style={{ color: 'var(--lms-warning)', flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-warning)' }}>No more questions can be added</p>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-warning)', marginTop: 2 }}>You've reached the maximum number of questions allowed for this exercise.</p>
                          </div>
                        </div>
                      )}

                      {/* KEY CHANGE: questionSpecific info note — scores set individually */}
                      {scoringType === 'questionSpecific' && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)', borderRadius: 'var(--lms-radius-md)', padding: '10px 14px' }}>
                          <Bot size={14} style={{ color: 'var(--lms-info)', flexShrink: 0, marginTop: 1 }} />
                          <div>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-info)' }}>Custom scoring mode</p>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-info)', marginTop: 2 }}>
                              Questions will be added without scores. Set each question's marks individually in the form before saving.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Hero */}
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--lms-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 4px 16px var(--lms-orange-glow)' }}>
                          <Zap size={24} style={{ color: 'white' }} />
                        </div>
                        <div>
                          <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 16, fontWeight: 800, color: 'var(--lms-text-main)' }}>Generate Questions</h2>
                          <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-muted)' }}>Enter a topic and let AI create questions for you</p>
                        </div>
                      </div>

                      {/* Topic input */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-text-sec)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Topic <span style={{ color: 'var(--lms-danger)' }}>*</span>
                        </label>
                        <input type="text" value={topicInput} onChange={e => setTopicInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !loading && topicInput.trim() && settings.questionType && handleGenerate()}
                          placeholder="e.g., React Hooks, JavaScript Closures, Photosynthesis..."
                          disabled={loading || cannotGenerate} autoFocus
                          style={{ fontFamily: 'var(--lms-font)', fontSize: 13, padding: '10px 14px', border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)', outline: 'none', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-main)', transition: 'all 0.15s', width: '100%', opacity: loading || cannotGenerate ? 0.6 : 1 }}
                          onFocus={e => { e.target.style.borderColor = 'var(--lms-orange)'; e.target.style.boxShadow = '0 0 0 3px var(--lms-orange-light)'; e.target.style.background = 'var(--lms-bg-white)'; }}
                          onBlur={e => { e.target.style.borderColor = 'var(--lms-border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--lms-bg-surface)'; }}
                        />
                      </div>

                      {/* No type selected hint */}
                      {!settings.questionType && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--lms-orange-50)', border: '1.5px solid var(--lms-orange-100)', borderRadius: 'var(--lms-radius-md)', padding: '8px 12px' }}>
                          <SlidersHorizontal size={13} style={{ color: 'var(--lms-orange)', flexShrink: 0 }} />
                          <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: '#c85a30' }}>
                            <strong>Select a question type</strong> in Settings → to get started
                          </p>
                        </div>
                      )}

                      {/* Generate button */}
                      <button onClick={handleGenerate} disabled={loading || !topicInput.trim() || !settings.questionType || cannotGenerate}
                        style={{ width: '100%', padding: '11px 0', background: 'var(--lms-orange)', color: 'white', border: 'none', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 13.5, fontWeight: 700, cursor: loading || !topicInput.trim() || !settings.questionType || cannotGenerate ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 2px 8px var(--lms-orange-glow)', opacity: loading || !topicInput.trim() || !settings.questionType || cannotGenerate ? 0.6 : 1, transition: 'all 0.15s' }}>
                        {loading ? (
                          <><Loader2 size={15} className="animate-spin" />Generating {settings.numQuestions} questions...</>
                        ) : (
                          <><Sparkles size={15} />Generate {settings.numQuestions} {settings.questionType ? TYPE_CONFIG[settings.questionType as QuestionType].label : ''} question{settings.numQuestions > 1 ? 's' : ''}</>
                        )}
                      </button>

                      {/* Summary pill */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)', padding: '8px 12px' }}>
                        <Bot size={13} style={{ color: 'var(--lms-text-muted)', flexShrink: 0 }} />
                        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)' }}>
                          <strong style={{ color: 'var(--lms-text-main)' }}>{settings.numQuestions}</strong> to generate ·{' '}
                          <strong style={{ color: 'var(--lms-text-main)' }}>{settings.questionType ? TYPE_CONFIG[settings.questionType as QuestionType].label : '—'}</strong> ·{' '}
                          <strong style={{ color: 'var(--lms-text-main)', textTransform: 'capitalize' }}>{settings.difficulty}</strong>
                          {currentTypeMeta?.hasCustomCount && settings.questionType && ['multiple-choice','multiple-select','dropdown'].includes(settings.questionType) && (
                            <> · <strong style={{ color: 'var(--lms-text-main)' }}>{settings.numOptions} options</strong></>
                          )}
                          {settings.questionType === 'matching' && <> · <strong style={{ color: 'var(--lms-text-main)' }}>{settings.numPairs} pairs</strong></>}
                          {settings.questionType === 'ordering' && <> · <strong style={{ color: 'var(--lms-text-main)' }}>{settings.numItems} items</strong></>}
                          {/* KEY CHANGE: show scoring note */}
                          {scoringType === 'questionSpecific' && <> · <strong style={{ color: 'var(--lms-info)' }}>scores set in form</strong></>}
                          {scoringType === 'equalDistribution' && marksPerQuestion > 0 && <> · <strong style={{ color: 'var(--lms-text-main)' }}>{marksPerQuestion} marks each</strong></>}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Generated questions list */
                  <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* KEY CHANGE: Banner for questionSpecific reminding user to set scores */}
                    {scoringType === 'questionSpecific' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)', borderRadius: 'var(--lms-radius-md)', padding: '8px 14px', marginBottom: 4 }}>
                        <AlertCircle size={13} style={{ color: 'var(--lms-info)', flexShrink: 0 }} />
                        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-info)', fontWeight: 600 }}>
                          These questions will be added without scores. You'll set each question's marks in the form.
                        </p>
                      </div>
                    )}

                    {generatedQuestions.map((question, index) => (
                      <div key={question.id} style={{
                        borderRadius: 'var(--lms-radius-md)',
                        border: editingQuestion?.id === question.id
                          ? '1.5px solid var(--lms-violet-bdr)'
                          : question.selected
                            ? '1.5px solid var(--lms-success-bdr)'
                            : '1.5px solid var(--lms-border)',
                        background: editingQuestion?.id === question.id ? 'var(--lms-violet-bg)' : question.selected ? 'var(--lms-success-bg)' : 'var(--lms-bg-white)',
                        overflow: 'hidden', transition: 'all 0.15s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 2 }}>
                            <input type="checkbox" checked={question.selected} onChange={() => toggleQuestionSelection(question.id)}
                              style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--lms-orange)' }} disabled={cannotGenerate} />
                            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--lms-text-hint)', width: 20 }}>Q{index+1}</span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>{renderQuestionEditor(question)}</div>
                          {editingQuestion?.id !== question.id && (
                            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
                              <button onClick={() => startEditing(question)}
                                style={{ padding: 5, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', transition: 'all 0.15s' }}
                                title="Edit">
                                <Edit2 size={12} />
                              </button>
                              <button onClick={() => deleteQuestion(question.id)}
                                style={{ padding: 5, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', transition: 'all 0.15s' }}
                                title="Delete">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Slot warning shown in footer — nothing needed here */}
                  </div>
                )}
              </div>

              {/* Settings sidebar */}
              {renderSettingsSidebar()}
            </div>

            {/* ── FOOTER ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px', borderTop: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', flexShrink: 0 }}>
              {/* Left side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {generatedQuestions.length > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={selectAll} onChange={toggleSelectAll}
                      style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--lms-orange)' }}
                      disabled={generatedQuestions.length === 0} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, color: 'var(--lms-text-main)' }}>
                      All
                      <span style={{ fontFamily: 'var(--lms-font)', fontWeight: 400, color: 'var(--lms-text-muted)', marginLeft: 4 }}>
                        ({selectedCount}/{generatedQuestions.length})
                      </span>
                    </span>
                  </label>
                )}
                {generatedQuestions.length > 0 ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--lms-font)', fontSize: 11.5, color: 'var(--lms-text-muted)' }}>
                    <CheckCircle size={12} style={{ color: 'var(--lms-success)' }} />{generatedQuestions.length} generated
                  </span>
                ) : (
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, color: 'var(--lms-text-muted)' }}>Configure settings and generate</span>
                )}
                {/* equalDistribution: show slot status */}
                {generatedQuestions.length > 0 && scoringType === 'equalDistribution' && maxSelectableCount >= 0 && (
                  selectedCount > maxSelectableCount ? (
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={12} />Deselect {selectedCount - maxSelectableCount} — only {maxSelectableCount} slot{maxSelectableCount !== 1 ? 's' : ''} left
                    </span>
                  ) : selectedCount === maxSelectableCount ? (
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle size={12} />{selectedCount}/{maxSelectableCount} slots filled — ready to add
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600, color: 'var(--lms-warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={12} />{selectedCount} selected · {maxSelectableCount - selectedCount} slot{maxSelectableCount - selectedCount !== 1 ? 's' : ''} still free
                    </span>
                  )
                )}
              </div>

              {/* Right side */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {generatedQuestions.length > 0 && (
                  <>
                    {/* Custom */}
                    <button onClick={addCustomQuestion}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', borderRadius: 'var(--lms-radius-md)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lms-font)', transition: 'all 0.15s' }}>
                      <Plus size={12} /> Custom
                    </button>

                    {/* Add More */}
                    <button onClick={handleAddMore} disabled={loading || !topicInput.trim()}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1.5px solid var(--lms-violet-bdr)', background: 'var(--lms-violet-bg)', color: 'var(--lms-violet)', borderRadius: 'var(--lms-radius-md)', fontSize: 12, fontWeight: 600, cursor: loading || !topicInput.trim() ? 'not-allowed' : 'pointer', fontFamily: 'var(--lms-font)', opacity: loading || !topicInput.trim() ? 0.5 : 1, transition: 'all 0.15s' }}>
                      {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                      Add {settings.numQuestions} More
                    </button>

                    {/* Regen */}
                    <button onClick={handleRegenerateSelected} disabled={loading || selectedCount === 0}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1.5px solid var(--lms-warning-bdr)', background: 'var(--lms-warning-bg)', color: 'var(--lms-warning)', borderRadius: 'var(--lms-radius-md)', fontSize: 12, fontWeight: 600, cursor: loading || selectedCount === 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--lms-font)', opacity: loading || selectedCount === 0 ? 0.5 : 1, transition: 'all 0.15s' }}>
                      {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Regen ({selectedCount})
                    </button>

                    {/* Cancel */}
                    <button onClick={handleCloseWithConfirm} disabled={loading}
                      style={{ padding: '6px 12px', border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', borderRadius: 'var(--lms-radius-md)', fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--lms-font)', opacity: loading ? 0.5 : 1, transition: 'all 0.15s' }}>
                      Cancel
                    </button>

                    {/* Add Selected — disabled only if nothing selected or over slot limit for equalDistribution */}
                    {(() => {
                      const overLimit = scoringType === 'equalDistribution' && maxSelectableCount >= 0 && selectedCount > maxSelectableCount;
                      const disabled = selectedCount === 0 || overLimit;
                      return (
                        <button onClick={handleSave} disabled={disabled}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', border: 'none', background: 'var(--lms-orange)', color: 'white', borderRadius: 'var(--lms-radius-md)', fontSize: 12, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--lms-font)', opacity: disabled ? 0.5 : 1, boxShadow: '0 2px 8px var(--lms-orange-glow)', transition: 'all 0.15s' }}>
                          <Save size={12} />
                          Add {selectedCount > 0 ? selectedCount : ''} Selected
                        </button>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default GenerateMCQAIQuestion;