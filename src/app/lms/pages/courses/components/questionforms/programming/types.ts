// Core types for the Programming question authoring flow.
// Extracted 2026-08-30 from the monolithic ProgrammingQuestionForm.tsx.

export type Diff = 'easy' | 'medium' | 'hard';

export interface TC {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  isSample: boolean;
  description: string;
  // Function-mode structured inputs: { paramName: valueLiteral }. Coexists with
  // input/expectedOutput so a question can flip between modes without data loss
  // and legacy full-program TCs still work when read back.
  functionInputs?: Record<string, string>;
}

// Function-contract parameter (name + language-agnostic data type).
export interface FunctionParam { id: string; name: string; type: string; }

export interface FunctionContract {
  functionName: string;
  returnType: string;
  params: FunctionParam[];
}

export type ProgContentBlock =
  | { id: string; type: 'text'; value: string }
  | { id: string; type: 'image'; url: string; alignment: 'left' | 'center' | 'right'; sizePercent: number }
  | { id: string; type: 'code'; value: string; language: string; bgColor: string };

export interface FlowQuestion {
  __localId: string;
  _id?: string;
  title: string;                               // always plain string (server compat)
  description: any;                            // array of ProgContentBlock[] on server, or legacy object
  difficulty: string;
  score: number;
  testCases: any[];
  constraints: string[];
  hints: any[];
  timeLimit: number;
  memoryLimit: number;
  questionType: string;
  isSaved: boolean;
  isDirty?: boolean;
  isPreExisting?: boolean;
  // Per-question source tag: 'scratch-manual' | 'scratch-bank' | 'ai' | 'thirdParty:<providerId>' | null.
  // Survives to the DB via mkPayload → onSave → API.
  source?: string | null;
  // Section-based exercises: which section this question belongs to.
  sectionId?: string | null;
  // Origin id of the Question Bank doc this was imported from — null for
  // authored questions. Persisted so re-importing the same bank question is
  // rejected as a duplicate (client picker + server validateQuestionQuota).
  bankQuestionId?: string | null;
  // Per-question AI test case count (evaluationMethod 'ai' + perQuestion mode);
  // null = not set / legacy questions.
  aiTestCasesCount?: number | null;
  // Link questions: ONE external URL replaces the authored content — students
  // get the URL in an iframe instead of the question+compiler workspace.
  isLinkQuestion?: boolean;
  questionLink?: string;
  // Code Setup — Starter is shown to students when an attempt begins.
  // Solution is the reference solution used for validation; never leaks to the learner UI.
  starterCode?: string;
  solutionCode?: string;
  codeSetupLanguage?: string;
  // ── Execution Setup ────────────────────────────────────────────────────
  // Absent on legacy questions → dbQuestionToFlow defaults executionType to
  // 'fullProgram' so existing stdin/stdout test cases keep working.
  executionType?: 'function' | 'fullProgram';
  functionContract?: FunctionContract;
  // Blank editor / auto-generated skeleton / teacher-provided custom starter.
  // Absent → 'blank' for fullProgram and 'generated' for function (see hydration).
  startingExperience?: 'blank' | 'generated' | 'custom';
  // Author-provided taxonomy (2026-08-30 UI redesign). Frontend-persisted
  // through the flow + save payload; server persistence depends on
  // `exerciseAndQuestion.js` addQuestion / updateQuestion Object.assign
  // whitelisting these fields — until then they're stored client-side only
  // for the current authoring session.
  category?: string;
  tags?: string[];
}

// Preset options for the Question details → Category dropdown. Keep this list
// short and semi-generic; the field is optional so unfamiliar categories map
// to '' (Uncategorised). If the school demands custom taxonomies later, wire
// the choices to a settings-provided list instead of this hard-coded array.
export const QUESTION_CATEGORIES = [
  'Basic Programming',
  'Data Structures',
  'Algorithms',
  'Strings',
  'Math',
  'Arrays',
  'Recursion',
  'Sorting & Searching',
  'Dynamic Programming',
  'Graphs & Trees',
  'Object-Oriented Design',
  'Databases & SQL',
  'System Design',
  'Debugging',
  'Other',
] as const;
export type QuestionCategory = typeof QUESTION_CATEGORIES[number] | '';

export interface ProgrammingQuestionFormProps {
  exerciseData: any;
  tabType: string;
  initialData?: any;
  isEditing?: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<any>;
  onDeleteQuestion?: (questionId: string) => Promise<any>;
  isSaving: boolean;
  saveProgress: number;
  saveMessage: string;
  lockedDifficulty?: 'easy' | 'medium' | 'hard';
  onEditExercise?: () => void;
  sectionData?: any;
  // Bank questions to pre-load into the flow on open (review-then-save).
  initialBankQuestions?: any[];
  // Source tag stamped on initialBankQuestions ('scratch-bank' | 'thirdParty').
  // Set by the caller that opened the bank picker (Other Platform vs Question Bank).
  initialBankSource?: string;
  approval?: any;
  approvalContext?: { entityType: string; entityId: string; tabType: 'We_Do' | 'You_Do'; subcategory: string; exerciseId: string; questionId: string };
  onQueryResolved?: () => void;
  /**
   * When set, the form auto-opens the matching source modal on mount so the
   * teacher lands on the right authoring surface (AI generator / bank picker)
   * instead of a blank editor. 'manual' leaves the form open normally.
   *   'ai'         → opens the AI generator
   *   'bank'       → opens the Question Bank picker
   *   'thirdParty' → treated as bank for now (Third Party provider search
   *                   opens inside the bank/provider UI)
   *   'manual' | undefined → normal blank-form landing
   */
  autoOpenSource?: 'manual' | 'ai' | 'bank' | 'thirdParty';
}
