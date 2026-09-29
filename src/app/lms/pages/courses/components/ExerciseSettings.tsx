import { getToken } from "@/lib/session";
import React, { useEffect, useState, useCallback, useMemo, useRef, ChangeEvent } from 'react';
import {
  X, ChevronRight, Settings2, FileCode,
  ArrowLeft, ArrowRight, Code, FileText,
  Layers, Calendar, Bell, Award,
  Plus, Minus, Loader2, Mail,
  MessageCircle, Clock, Lock, Eye,
  ChevronDown, ChevronUp, Shuffle,
  Check, List, Terminal,
  AlertCircle, CircleAlert, Info, Calculator,
  Home, HelpCircle,
  Shield, UserCheck, Users, EyeOff,
  Hash,
  Book,
  FolderOpen,
  Circle,
  ChevronLeft,
  Database,
  Zap,
  Sparkles,
  ArrowUpRight,
  Square,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exerciseApi } from '@/app/lms/pages/courses/api/exercise';
// These saves use the native `fetch`, which the axios batch interceptor cannot
// see — the batch has to be put on the URL by hand. See withBatchUrl.
import { withBatchUrl } from '@/app/lms/pages/courses/api/resourceBatch';
import TipTapEditor from '../../../component/tiptopEditor';
// Shown when the X is clicked with edits that have not been written to the DB yet.
import { DiscardChangesDialog } from '@/app/lms/shared/ui/DiscardChangesDialog';

// ─── Shared design tokens, helpers, step components ──────────────────────────
// Step renders progressively extracted into ExerciseSettings/steps/* — see
// ExerciseSettings/shared/* for the tokens, fonts and reusable UI primitives
// shared across the shell and every step.
import { D as sharedColors, FONT, injectFonts } from '../uploadcourseresources/components/youdo/assessments/shared/tokens';
const D = { ...sharedColors, orange: '#EE6A22', orangeDark: '#D65A16', orangeLight: '#FDF0E9', orangeMed: '#FADFCE', orangeGlow: '#FADFCE', border: '#e0e5eb', border2: '#b6c0cb', surface: '#f7f9fc', surface2: '#f1f5f9' };
import {
  InfoTooltip, OInput, ONumberInput, OToggle, PortalDropdown,
  ExpandableSection, TimePicker, SectionLabel, ODropdown,
  SpinField, MonthDropField, DateRowPicker, GradeRow,
} from '../uploadcourseresources/components/youdo/assessments/shared/UIComponents';
import { isApproximatelyEqual, formatDecimal } from '../uploadcourseresources/components/youdo/assessments/shared/utils';
import { ScheduleStep } from '../../../component/ExerciseSettings/steps/ScheduleStep';
import assignmentStyles from '../../../component/ExerciseSettings/AssignmentSettings.module.css';
import { CompactSettingsContext, SettingsHelp } from '../../../component/ExerciseSettings/SettingsHelp';
import { SettingsPreview } from '../../../component/ExerciseSettings/SettingsPreview';
import { NotificationsStep } from '../../../component/ExerciseSettings/steps/NotificationsStep';
import { CombinedConfigStep } from '../../../component/ExerciseSettings/steps/CombinedConfigStep';
import { ExerciseTypeStep } from '../../../component/ExerciseSettings/steps/ExerciseTypeStep';
import { GradeSettingsStep } from '../../../component/ExerciseSettings/steps/GradeSettingsStep';
import { ExerciseDetailsStep } from '../../../component/ExerciseSettings/steps/ExerciseDetailsStep';
// Evaluation Method (Test Case / AI) — shared with the You_Do Create Assessment
// wizard so both surfaces capture and store the identical `evaluationMethod`.
import {
  EvaluationMethodConfig,
  LiveInteractionOption,
  DEFAULT_EVALUATION_METHOD,
  normalizeEvaluationMethod,
  type EvaluationMethodSetting,
} from '../coursesdetailedview/components/EvaluationMethodConfig';
// Shared Question Source picker — replaces the dropdown+conditional-checkbox
// pattern with a single always-visible checkbox row, storage contract
// unchanged. Same component the youdo Create Assessment modal uses.
import { QuestionSourcePicker } from '../uploadcourseresources/components/youdo/assessments/questionsource/QuestionSourcePicker';
import { API_ORIGIN } from '@/lib/apiBase'

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface ExercisePayload {
  configurationType: 'manual';
  tabType: "I_Do" | "We_Do" | "You_Do";
  subcategory: string;
  exerciseType: 'MCQ' | 'Programming' | 'Combined' | 'Other';
  programmingSettings?: { selectedModule: string; selectedLanguages: string[] };
  exerciseInformation: {
    exerciseId: string; exerciseName: string; description: string;
    exerciseLevel: 'beginner' | 'intermediate' | 'expert';
    totalDuration: number; totalMarks: number;
  };
  totalMarksMCQ?: number;
  totalMarksProgramming?: number;
  questionConfiguration: {
    mcqConfig?: {
      questionConfigType: 'general'; generalQuestionCount: number;
      scoreSettings: { scoreType: 'equalDistribution' | 'questionSpecific'; equalDistribution: number; totalMarks: number };
      attemptLimitEnabled: boolean; submissionAttempts: number;
    };
    programmingConfig?: {
      questionConfigType: 'general' | 'levelBased' | 'selectionLevel';
      generalQuestionCount?: number;
      levelBasedCounts?: { easy: number; medium: number; hard: number };
      selectionLevelCounts?: { easy: number; medium: number; hard: number };
      scoreSettings: {
        scoreType: 'equalDistribution' | 'questionSpecific' | 'levelSpecific';
        equalDistribution: number;
        questionSpecific?: { general: number[]; levelBased: { easy: number[]; medium: number[]; hard: number[] } };
        levelBasedMarks?: { easy: number; medium: number; hard: number };
        levelScoringConfiguration?: {
          easy?: { type: 'question_specific' | 'level_specific'; totalMarks?: number; marksPerQuestion?: number; questionCount?: number };
          medium?: { type: 'question_specific' | 'level_specific'; totalMarks?: number; marksPerQuestion?: number; questionCount?: number };
          hard?: { type: 'question_specific' | 'level_specific'; totalMarks?: number; marksPerQuestion?: number; questionCount?: number };
        };
        totalMarks: number;
      };
      questionFlow: 'freeFlow' | 'controlled';
      attemptLimitEnabled: boolean; submissionAttempts: number;
    };
  };
  /**
   * How submissions get evaluated — 'testcase' or 'ai'. Captured and persisted
   * here only; the grading pipeline reads it later. See
   * ./evaluation/EvaluationMethodConfig for the full shape.
   */
  evaluationMethod?: EvaluationMethodSetting;
  availabilityPeriod: {
    startDate: string | null;
    endDate: string | null;          // submission deadline
    cutOffDate?: string | null;      // optional late boundary
    cutOffEnabled?: boolean;
    gracePeriodEnabled: boolean;
    gracePeriodAllowed?: boolean;
    gracePeriodDate?: string | null;
    extendedDays?: number;
    remindGradeBy?: string | null;   // ← add
    remindGradeByEnabled?: boolean;  // ← add
    requiresAdminApproval?: boolean; // students see exercise only after admin approves
  };
  notificationSettings: {
    notifyUsers: boolean; notifyGmail: boolean; notifyWhatsApp: boolean; gradeSheet: boolean;
  };
}

/** 'We_Do' -> 'We Do', 'problem_solving' -> 'Problem Solving'. Tab and
 *  subcategory both travel as slugs; the breadcrumb shows them as words. */
function titleiseKey(key: string): string {
  return String(key || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\w/g, (ch) => ch.toUpperCase());
}

interface HierarchyData {
  courseName: string; moduleName: string; submoduleName: string;
  topicName: string; subtopicName: string; nodeType: string; level: number;
}

interface ExerciseSettingsProps {
  hierarchyData: HierarchyData; nodeId: string; nodeName: string; nodeType: string;
  subcategory: string; onSave: (exerciseData: ExercisePayload) => void; onClose: () => void;
  isEditing?: boolean; tabType?: 'I_Do' | 'We_Do' | 'You_Do'; initialData?: any; exercise_Id?: string;
  /**
   * `initialData` carries a TEMPLATE / COMMAND seed rather than a saved
   * exercise. Set by CreateExerciseLauncher so the hydration effects below
   * (which already know how to map a document into formData) run for a NEW
   * exercise too.
   *
   * Deliberately separate from `isEditing`: that flag also locks the Exercise
   * Type dropdown, locks Config Strategy, makes `exercise_Id` the save target,
   * and skips the past-date rule — none of which apply to a fresh exercise.
   * A seeded exercise is still a CREATE in every respect.
   */
  isSeeded?: boolean;
  /**
   * Where this exercise came from — e.g. "Programming Assessment" or
   * "Copied from Java Week 3". Rendered as a pill in the app bar.
   * PURELY PRESENTATIONAL: it never enters formData or any payload.
   */
  seedLabel?: string;
  configuredLanguages?: { coreProgram?: string[]; frontend?: string[]; database?: string[] };
  /** When true (opened from ProgrammingQuestionForm), the Config Strategy dropdown is locked */
  lockConfigStrategy?: boolean;
  /**
   * Phase 3 — parent callback opened from the Add Questions sub-view when the
   * teacher picks a source authoring action. Optional; when omitted, the buttons
   * prompt the teacher to save settings first and use the existing authoring
   * flow externally. The mode identifies which existing UI to open:
   *   scratch-manual → AddQuestionForm / ProgrammingQuestionForm
   *   scratch-bank   → Question Bank picker
   *   ai             → GenerateQuestion / GenerateProgFamilyAI
   */
  onOpenQuestionAuthor?: (mode: 'scratch-manual' | 'scratch-bank' | 'ai') => void;
}

interface Step {
  id: number; title: string; subtitle: string; completed: boolean; active: boolean;
  icon: React.ReactNode; indentLevel?: number; isChild?: boolean;
}

interface ValidationErrors {
  exerciseType?: string; selectedModule?: string; selectedLanguages?: string;
  exerciseId?: string; exerciseName?: string; description?: string;
  totalDuration?: string; totalMarks?: string; totalMarksMCQ?: string; totalMarksProgramming?: string;
  mcqGeneralQuestionCount?: string; mcqMarksPerQuestion?: string; mcqTotalMarks?: string;
  programmingGeneralQuestionCount?: string; programmingMarksPerQuestion?: string;
  programmingLevelCounts?: string; programmingLevelCounts_Easy?: string;
  programmingLevelCounts_Medium?: string; programmingLevelCounts_Hard?: string;
  programmingTotalMarks?: string; programmingLevelScoring?: Record<string, string>;
  startDate?: string; endDate?: string; gracePeriod?: string;[key: string]: any;
  exerciseLevel?: string;

}

// Which validationErrors keys belong to which step. Drives the rail's
// "N issue(s)" line, the section header's issue pill and the Fix-before-
// continuing banner — all three read the SAME map, so a step can never claim
// to be clean in one place and faulty in another. Mirrors the field lists
// validateCurrentStep already pushes into touchedFields.
const STEP_ERROR_FIELDS: Record<string, string[]> = {
  'Exercise Details': [
    'exerciseType', 'selectedModule', 'selectedLanguages', 'exerciseName',
    'exerciseLevel', 'totalDuration', 'totalMarks', 'totalMarksMCQ', 'totalMarksProgramming',
  ],
  'Question Configuration': [
    'mcqGeneralQuestionCount', 'mcqMarksPerQuestion', 'mcqTotalMarks',
    'programmingGeneralQuestionCount', 'programmingMarksPerQuestion', 'programmingLevelCounts',
    'programmingLevelCounts_Easy', 'programmingLevelCounts_Medium', 'programmingLevelCounts_Hard',
    'programmingTotalMarks', 'programmingLevelScoring',
    'othersGeneralQuestionCount', 'othersMarksPerQuestion', 'othersLevelCounts',
    'othersLevelCounts_Easy', 'othersLevelCounts_Medium', 'othersLevelCounts_Hard',
    'othersTotalMarks', 'othersLevelScoring',
  ],
  'Schedule': ['startDate', 'endDate', 'gracePeriod', 'cutOffDate', 'remindGradeBy'],
  'Grade Settings': ['mcqGradeToPass', 'programmingGrade', 'programmingGradeToPass', 'gradeBands'],
}


// All UI primitives & helpers now live in ./ExerciseSettings/shared/*

// =============================================================================
// PHASE 4 — Third-Party provider registry
// =============================================================================
// Adapter-shaped registry. Real providers implement `search()` / `importBatch()`
// against their own API. `sampleBank` is a shipped stub so the UI + wiring work
// end-to-end without external integrations; replace with real providers as they
// come online. Provider tag stored on each question as `thirdParty:<id>`.
type ThirdPartyProviderStatus = 'connected' | 'coming_soon' | 'not_configured';
interface ThirdPartyProvider {
  id: string;
  name: string;
  description: string;
  status: ThirdPartyProviderStatus;
  icon?: React.ReactNode;
}
const THIRD_PARTY_PROVIDERS: ThirdPartyProvider[] = [
  { id: 'sampleBank', name: 'Sample Bank', description: 'Curated starter set — a built-in demo provider.', status: 'connected' },
  { id: 'leetcode', name: 'LeetCode', description: 'Industry-standard interview questions.', status: 'coming_soon' },
  { id: 'hackerrank', name: 'HackerRank', description: 'Skill-based programming challenges.', status: 'coming_soon' },
  { id: 'codechef', name: 'CodeChef', description: 'Competitive programming problems.', status: 'coming_soon' },
];

// =============================================================================
// SPEC STYLE PRIMITIVES (demo design system) — styling constants only.
// Cards, pills, notes and the difficulty-matrix palette used by the STEP 2
// configuration renderers (MCQ / Programming / Others). Values come from
// scratchpad/demo-design-spec.md; D.* tokens are preferred where one fits.
// =============================================================================
// STEP-2/3 restyle (2026-09-01): flattened the card chrome so every section
// reads like Step 1's ExerciseDetailsStep — orange section heading + hairline
// divider + fields directly beneath, no nested border-box. The old
// bordered-card look created a visual cage inside each step that fought the
// clean single-column rhythm of the redesigned modal.
const SPEC_CARD: React.CSSProperties = { background: 'transparent', border: 'none', borderRadius: 0 };
const SPEC_CARD_H: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 8px', background: 'transparent', borderBottom: `1px solid ${D.border}`, marginBottom: 10 };
const SPEC_CARD_T: React.CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '-.005em', textTransform: 'none', color: D.orange };
const SPEC_CARD_B: React.CSSProperties = { padding: 0, fontSize: 13 };
const specPill = (bg: string, line: string, text: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 23, padding: '0 9px',
  borderRadius: 999, fontSize: 10.8, fontWeight: 600, whiteSpace: 'nowrap',
  background: bg, border: `1px solid ${line}`, color: text,
});
const SPEC_PILL = {
  green:  specPill('#ECFDF3', '#C7EBD5', '#046C4E'),
  amber:  specPill('#FFFAEB', '#F5DFA8', '#B54708'),
  red:    specPill('#FEF3F2', '#FBD3CE', '#D92D20'),
  blue:   specPill('#EFF6FF', '#CFE0FB', '#175CD3'),
  grey:   specPill('#F4F4F5', '#E7E5E4', '#57606E'),
};
const specNote = (bg: string, line: string, text: string): React.CSSProperties => ({
  display: 'flex', gap: 8, padding: '8px 10px', borderRadius: 8,
  fontSize: 11.4, lineHeight: 1.5, background: bg, border: `1px solid ${line}`, color: text,
});
const SPEC_NOTE = {
  info: specNote('#EFF6FF', '#CFE0FB', '#1B4DA8'),
  ok:   specNote('#ECFDF3', '#C7EBD5', '#046C4E'),
  warn: specNote('#FFFAEB', '#F5DFA8', '#B54708'),
  bad:  specNote('#FEF3F2', '#FBD3CE', '#912018'),
};
// Spec field label: 11.5px/600 dark-slate, 6px below-gap — Step 1 FieldLabel parity
const SPEC_LABEL: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 600, color: '#101828', marginBottom: 6 };

// Help text for the difficulty-matrix row labels, so each row explains itself
// the same way a General field does.
const MATRIX_HELP = {
  questions: 'How many questions to draw from this difficulty level.',
  distribution: 'Same Marks gives every question in the level the same value. Individual lets you set each question’s marks while creating it.',
  marks: 'Marks per question for this level — or the level’s total when Mark Distribution is set to Individual.',
  total: 'Questions × marks for this level. Derived automatically, never typed.',
} as const;

// A matrix row label: text on the left, teal ? tooltip beside it — the same
// pairing the General section's field labels use.
const MatrixLabel: React.FC<{ children: React.ReactNode; help: string; style?: React.CSSProperties; className?: string }> =
  ({ children, help, style, className }) => (
    <div className={className} style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span>{children}</span>
      <SettingsHelp content={help} />
    </div>
  );

// ── StepEmptyState ───────────────────────────────────────────────────────────
// Shown when a section cannot be filled in yet because an earlier one has not
// been answered. The step used to render a blank panel in this case, which
// read as a broken screen; this names the section to visit first instead.
const StepEmptyState: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className={assignmentStyles.generalFields} style={{ paddingTop: 4, paddingBottom: 16 }}>
    <div className="es-note" style={{ ...SPEC_NOTE.info, margin: 0 }}>
      <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  </div>
);

// ── ConfigRow ────────────────────────────────────────────────────────────────
// Same row shape as the General section's FormRow (ExerciseDetailsStep):
// label + required star + teal ? on the left, control + helper on the right,
// using the identical AssignmentSettings.module.css classes so Question
// Configuration reads exactly like General.
const ConfigRow: React.FC<{
  label: React.ReactNode; help?: string; required?: boolean;
  note?: React.ReactNode; error?: string; children: React.ReactNode;
}> = ({ label, help, required, note, error, children }) => (
  <div className={assignmentStyles.fieldRow}>
    <div className={assignmentStyles.fieldLabel}>
      <label>{label}{required && <span className={assignmentStyles.required} aria-label="required">*</span>}</label>
      {help && <SettingsHelp content={help} />}
    </div>
    <div className={assignmentStyles.fieldControl}>
      {children}
      {note && <p className={assignmentStyles.fieldNote}>{note}</p>}
      {error && <p className={assignmentStyles.fieldError} role="alert">{error}</p>}
    </div>
  </div>
);

// Label adapter for EvaluationMethodConfig when it sits inside a ConfigRow:
// the row already carries the "Evaluation method" label, so the component's
// own title is suppressed; its nested "Evaluation Criteria" caption (AI mode)
// still renders as a small heading with the teal ? tooltip.
const EvalMethodLabel: React.FC<{ children: React.ReactNode; required?: boolean; info?: string; className?: string }> =
  ({ children, required, info }) => (
    children === 'Evaluation Method' ? null : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 6px' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#263746' }}>
          {children}{required && <span style={{ color: '#b42318', marginLeft: 4 }}>*</span>}
        </span>
        {info && <SettingsHelp content={info} />}
      </div>
    )
  );
// Difficulty-matrix palette (level column tints / 7×7 dots / level text)
const SPEC_LEVEL_TINT = { easy: '#F7FDF9', medium: '#FFFCF5', hard: '#FFFAF9' } as const;
const SPEC_LEVEL_DOT  = { easy: '#0F9D58', medium: '#F0A415', hard: '#E0503C' } as const;
const SPEC_LEVEL_TEXT = { easy: '#046C4E', medium: '#B54708', hard: '#B42318' } as const;
const SPEC_DOT: React.CSSProperties = { width: 7, height: 7, borderRadius: '50%', flexShrink: 0, display: 'inline-block' };
// Matrix container: 110px row-label column + 3 level columns, radius 10
const SPEC_MATRIX: React.CSSProperties = { display: 'grid', gridTemplateColumns: '110px repeat(3, minmax(0,1fr))', border: `1px solid ${D.border2}`, borderRadius: 10, overflow: 'hidden', background: '#fff' };
const SPEC_MATRIX_CELL: React.CSSProperties = { padding: '7px 9px' };
const SPEC_MATRIX_HCELL: React.CSSProperties = { ...SPEC_MATRIX_CELL, fontSize: 10.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#57606E', background: '#FCFBFA' };
const SPEC_MATRIX_RLABEL: React.CSSProperties = { ...SPEC_MATRIX_CELL, fontSize: 11.5, fontWeight: 600, color: '#57606E', display: 'flex', alignItems: 'center', borderTop: `1px solid ${D.border}` };
// Spec select (small input variant + right chevron), used for matrix Score Type cells
const SPEC_SELECT: React.CSSProperties = {
  width: '100%', height: 30, borderRadius: 8, border: `1px solid ${D.border2}`, background: '#fff',
  color: D.textMain, fontSize: 12, padding: '0 28px 0 11px', outline: 'none',
  appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
};
// Spec toggle switch (35×20, green on) — the Programming attempt-limit switch
const specSwitchTrack = (on: boolean): React.CSSProperties => ({
  position: 'relative', width: 35, height: 20, borderRadius: 999, border: 'none', padding: 0,
  cursor: 'pointer', flexShrink: 0, background: on ? '#0F9D58' : '#DEDAD5', transition: 'background .16s',
});
const specSwitchKnob = (on: boolean): React.CSSProperties => ({
  position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%', background: '#fff',
  boxShadow: '0 1px 3px rgba(0,0,0,.25)', transform: on ? 'translateX(15px)' : 'none', transition: 'transform .16s',
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const ExerciseSettings: React.FC<ExerciseSettingsProps> = ({
  hierarchyData, nodeId, nodeName, nodeType, subcategory, onSave, onClose,
  isEditing = false, tabType = 'We_Do', initialData, exercise_Id, configuredLanguages,
  lockConfigStrategy = false, onOpenQuestionAuthor, isSeeded = false, seedLabel,
}) => {
  // Editing OR seeded — both mean "there is a document to hydrate formData
  // from". Everything else about `isEditing` stays exactly as it was.
  const shouldHydrate = isEditing || isSeeded;
  // Lock Config Strategy if:
  // 1. Opened from ProgrammingQuestionForm (lockConfigStrategy prop), OR
  // 2. Editing AND 'Question Configuration' step was already saved (config already committed)
  // Computed after savedSteps is declared below — see isConfigStrategyLocked usage.
  injectFonts();
  console.log('[ExerciseSettings] configuredLanguages prop:', configuredLanguages);


  const [currentStep, setCurrentStep] = useState(1);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(() => new Set([1, 2, 3]));
  // Steps that failed the last Complete-setup attempt. Drives the red ring on
  // the section card; cleared on the next successful save.
  const [errorStepIds, setErrorStepIds] = useState<Set<number>>(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [savedSteps, setSavedSteps] = useState<Set<string>>(new Set());
  // Config Strategy is locked when opened from ProgrammingQuestionForm OR when editing
  // and the Question Configuration step was already saved (config already committed to DB)
  // Config Strategy lock (2026-09-18): only lock when explicitly opened from
  // ProgrammingQuestionForm with `lockConfigStrategy`. Editing an existing
  // exercise no longer auto-locks the strategy — the trainer can change it
  // and confirm the reset via the warning modal ([[warningModal]]).
  const isConfigStrategyLocked = lockConfigStrategy;
  // Tracks steps that have been SAVED to DB with all required fields filled
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isLocked, setIsLocked] = useState(false);
  // Tracks the DB _id created during the step-save flow (create mode only)
  const [localExerciseId, setLocalExerciseId] = useState<string | null>(exercise_Id || null);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [activePicker, setActivePicker] = useState<{ field: string | null; type: string | null }>({ field: null, type: null });
  // Schedule popup state lives inside the extracted ScheduleStep component now.
  const [mcqScoringOpen, setMcqScoringOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isScoringOpen, setIsScoringOpen] = useState(false);
  // For Combined exercise type: track which tab is active in the unified Question Configuration step
  const [combinedConfigTab, setCombinedConfigTab] = useState<'mcq' | 'programming'>('mcq');
  // Add Questions is its own wizard step now (right after Question
  // Configuration) — the old Pattern/Add Questions/Preview sub-views are gone.
  // Phase 6 — Save-decision modal state + persisted teacher choice.
  const [saveDecisionOpen, setSaveDecisionOpen] = useState(false);
  const [saveToBank, setSaveToBank] = useState<boolean>(false);
  const [askSaveDecisionNextTime, setAskSaveDecisionNextTime] = useState<boolean>(true);
  // Pre-save preview confirmation — only surfaces on first-time creation once
  // validation has passed, so the trainer can eyeball the finished exercise
  // before it hits the server.
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  // Destructive-change warning modal — replaces the noisy native
  // window.confirm() with a styled amber/red warning card. `onConfirm` runs
  // if the trainer clicks Continue; otherwise the change is discarded.
  const [warningModal, setWarningModal] = useState<{
    title: string; body: string; confirmLabel?: string; onConfirm: () => void;
  } | null>(null);
  type QuestionSource = '' | 'scratch' | 'ai' | 'thirdParty' | 'custom';
  const [questionSource, setQuestionSource] = useState<QuestionSource>('');
  // Scratch has two entry points (manual add + question bank pick). Tracked
  // separately so Phase 3 can flip between them inside the Add Questions view.
  type ScratchMode = '' | 'manual' | 'bank';
  const [scratchMode, setScratchMode] = useState<ScratchMode>('');
  // Phase 5 — Custom-mode distribution matrix (E/M/H × Scratch/AI/ThirdParty).
  // Only meaningful when questionSource === 'custom'. Seeded on edit-load if the
  // exercise doc carries a customDistribution.
  type CustomCell = { scratch: number; ai: number; thirdParty: number };
  interface CustomDistribution { easy: CustomCell; medium: CustomCell; hard: CustomCell }
  const emptyCustomDist = (): CustomDistribution => ({
    easy: { scratch: 0, ai: 0, thirdParty: 0 },
    medium: { scratch: 0, ai: 0, thirdParty: 0 },
    hard: { scratch: 0, ai: 0, thirdParty: 0 },
  });
  const [customDistribution, setCustomDistribution] = useState<CustomDistribution>(emptyCustomDist);
  // Which sub-sources the teacher wants to combine when questionSource === 'custom'.
  // Minimum two required (fewer than that = just pick that single source directly).
  type CustomSubSource = 'scratch' | 'ai' | 'thirdParty';
  const [customSources, setCustomSources] = useState<CustomSubSource[]>([]);
  // Combined exercises: the MCQ part may have its OWN source, separate from
  // the (programming-part) questionSource above. '' = inherit ("Same as
  // Programming") — fully backward compatible. Its Custom split is a single
  // cell (MCQ has no difficulty rows), persisted as customDistributionMcq.
  const [questionSourceMcq, setQuestionSourceMcq] = useState<QuestionSource>('');
  const [customSourcesMcq, setCustomSourcesMcq] = useState<CustomSubSource[]>([]);
  const [customDistributionMcq, setCustomDistributionMcq] = useState<CustomCell>({ scratch: 0, ai: 0, thirdParty: 0 });
  // Sub-nav inside Custom: 'matrix' shows the 3×3 grid; the source values open
  // the source-scoped authoring view scoped to that cell's quota.
  type CustomSubNav = 'matrix' | 'scratch' | 'ai' | 'thirdParty';
  const [customSubNav, setCustomSubNav] = useState<CustomSubNav>('matrix');
  const [isOpen, setIsOpen] = useState(false);
  const [isFlowOpen, setIsFlowOpen] = useState(false);
  const configBtnRef = useRef<HTMLButtonElement>(null);
  // Stores the initialData reference that was last used to seed completedSteps
  // Allows re-initialization when a different exercise is opened for editing
  const completedStepsInitialized = useRef<any>(null);
  const levelScoringBtnRefs = useRef<{ easy: HTMLButtonElement | null; medium: HTMLButtonElement | null; hard: HTMLButtonElement | null }>({ easy: null, medium: null, hard: null });
  const [levelScoringOpen, setLevelScoringOpen] = useState<{ easy: boolean; medium: boolean; hard: boolean }>({ easy: false, medium: false, hard: false });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['configuration']));
  // Add this near other useState declarations (around line 550-600)
  // Locking rule (2026-09-18): editing stays OPEN after the exercise is saved.
  // We only freeze the form once a real student has attempted the assignment,
  // because that is when config changes would corrupt existing submissions.
  // Backend field names vary across seeds; we accept any of the common ones,
  // and any truthy value on `initialData.locked` acts as an explicit override.
  const hasStudentAttempts = !!(
    (initialData as any)?.hasStudentAttempts ||
    (initialData as any)?.attemptedByStudents ||
    Number((initialData as any)?.studentAttemptCount || 0) > 0 ||
    Number((initialData as any)?.attemptsCount || 0) > 0 ||
    Number((initialData as any)?.studentsAttempted || 0) > 0 ||
    (initialData as any)?.exerciseInformation?.hasStudentAttempts ||
    (initialData as any)?.locked
  );
  const [isLockedForEdit, setIsLockedForEdit] = useState(isEditing && hasStudentAttempts);
  const [progScoringRevealed, setProgScoringRevealed] = useState<{ easy: boolean; medium: boolean; hard: boolean }>({ easy: false, medium: false, hard: false });
  const handleToggleSection = useCallback((id: string) => {
    setExpandedSections(prev => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); if (id === 'scoring') setLevelScoringOpen({ easy: false, medium: false, hard: false }); }
      else n.add(id);
      return n;
    });
  }, []);

  const [formData, setFormData] = useState({
    exerciseType: '' as 'MCQ' | 'Programming' | 'Combined' | 'Other' | '',
    selectedModule: '', selectedLanguages: [] as string[],
    exerciseId: `EX${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    exerciseName: '', description: '',
    // Author-written instructions rendered on the student pre-start page.
    // Round-trips through the server (exerciseSchema has strict:false, so
    // no schema change needed). Empty → the pre-start page auto-generates
    // a paragraph from duration / language / question count so students
    // still see something useful.
    instructions: '',
    exerciseLevel: '' as 'beginner' | 'intermediate' | 'expert',
    isGraded: false,
    totalDuration: 60, totalMarks: 0, totalMarksMCQ: 0, totalMarksProgramming: 0,
    mcqConfig: {
      questionConfigType: 'general' as const, generalQuestionCount: 0,
      scoreSettings: { scoreType: 'equalDistribution' as 'equalDistribution' | 'questionSpecific', equalDistribution: 0, totalMarks: 0 },
      attemptLimitEnabled: false, submissionAttempts: 1,
    },
    programmingConfig: {
      questionConfigType: '' as '' | 'general' | 'levelBased' | 'selectionLevel',
      // Phase 1 — Pattern target (strict E+M+H===Total when >0). Seeded from
      // existing counts on edit-load so pre-Phase-1 exercises stay valid.
      patternTotal: 0,
      generalQuestionCount: 0, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
      levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
      scoreSettings: {
        scoreType: 'equalDistribution' as 'equalDistribution' | 'questionSpecific' | 'levelSpecific',
        equalDistribution: 0,
        questionSpecific: { general: [] as number[], levelBased: { easy: [] as number[], medium: [] as number[], hard: [] as number[] } },
        levelBasedMarks: { easy: 0, medium: 0, hard: 0 },
        levelScoringConfiguration: {
          easy: { type: 'level_specific' as 'question_specific' | 'level_specific', marksPerQuestion: 0, totalMarks: undefined as number | undefined, questionCount: 0 },
          medium: { type: 'level_specific' as 'question_specific' | 'level_specific', marksPerQuestion: 0, totalMarks: undefined as number | undefined, questionCount: 0 },
          hard: { type: 'level_specific' as 'question_specific' | 'level_specific', marksPerQuestion: 0, totalMarks: undefined as number | undefined, questionCount: 0 },
        },
        totalMarks: 0,
      },
      questionFlow: 'freeFlow' as 'freeFlow' | 'controlled', attemptLimitEnabled: false, submissionAttempts: 1,
      compilerFileMode: 'multiple' as 'single' | 'multiple',
    },
    // Exercise-level evaluation config. Defaults to test case, which is
    // exactly how every pre-existing exercise behaved.
    evaluationMethod: DEFAULT_EVALUATION_METHOD as EvaluationMethodSetting,
    othersConfig: {
      questionConfigType: 'general' as 'general' | 'levelBased' | 'selectionLevel',
      // Phase 1 — Pattern target for Others (mirrors programmingConfig.patternTotal).
      patternTotal: 0,
      scoringType: 'equalDistribution' as 'equalDistribution' | 'questionSpecific' | 'levelBased',
      totalQuestions: 0,
      marksPerQuestion: 0,
      generalQuestionCount: 0,
      selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
      levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
      levelBasedMarks: { easy: 0, medium: 0, hard: 0 },
      scoreSettings: {
        scoreType: 'equalDistribution' as 'equalDistribution' | 'questionSpecific' | 'levelSpecific',
        equalDistribution: 0,
        questionSpecific: { general: [] as number[], levelBased: { easy: [] as number[], medium: [] as number[], hard: [] as number[] } },
        levelBasedMarks: { easy: 0, medium: 0, hard: 0 },
        levelScoringConfiguration: {
          easy: { type: 'level_specific' as 'question_specific' | 'level_specific', marksPerQuestion: 0, totalMarks: undefined as number | undefined, questionCount: 0 },
          medium: { type: 'level_specific' as 'question_specific' | 'level_specific', marksPerQuestion: 0, totalMarks: undefined as number | undefined, questionCount: 0 },
          hard: { type: 'level_specific' as 'question_specific' | 'level_specific', marksPerQuestion: 0, totalMarks: undefined as number | undefined, questionCount: 0 },
        },
        totalMarks: 0,
      },
      questionFlow: 'freeFlow' as 'freeFlow' | 'controlled',
      attemptLimitEnabled: false,
      submissionAttempts: 1,
    },
    schedule: {
      allowSubmissions: true,

      startDate: (() => {
        const t = new Date();
        return {
          day: t.getDate(),
          month: t.getMonth() + 1,
          year: t.getFullYear(),
          hour: t.getHours(),    // current hour
          minute: t.getMinutes() // current minute
        };
      })(),
      endDate: (() => {
        const t = new Date(Date.now() + 86400000);
        return {
          day: t.getDate(),
          month: t.getMonth() + 1,
          year: t.getFullYear(),
          hour: t.getHours(),    // current hour (of tomorrow)
          minute: t.getMinutes() // current minute (of tomorrow)
        };
      })(),

      cutOffDate: { day: 0, month: 0, year: 0, hour: 23, minute: 59 },
      remindGradeByEnabled: false,
      remindGradeBy: { day: 0, month: 0, year: 0, hour: 0, minute: 0 },
      gracePeriodEnabled: false,
      gracePeriodDate: { day: 0, month: 0, year: 0, hour: 23, minute: 59 },
      requiresAdminApproval: false,
      approvalScope: 'settings',
    },
    notifyUsers: true, notifyGmail: false, notifyWhatsApp: false, gradeSheet: true,
    notifications: {
      notifyGradersSubmissions: false,
      notifyGradersSubmissionsChannels: { dashboard: false, gmail: false, whatsapp: false },
      notifyGradersLateSubmissions: false,
      notifyGradersLateSubmissionsChannels: { dashboard: false, gmail: false, whatsapp: false },
      notifyStudent: true,
notifyStudentChannels: { dashboard: true, gmail: false, whatsapp: false },
    },
    grades: {
      mcqGrade: null as number | null,
      mcqGradeToPass: null as number | null,
      programmingGrade: null as number | null,
      programmingGradeToPass: null as number | null,
      combinedGrade: null as number | null,
      combinedGradeToPass: null as number | null,
      separateMarks: false,
      // NEW:
      difficultyPassEnabled: false,
      // Programming-side per-difficulty pass marks (existing fields).
      easyPassMark: null as number | null,
      mediumPassMark: null as number | null,
      hardPassMark: null as number | null,
      // MCQ-side per-difficulty pass marks (Combined exercises store MCQ
      // pass marks SEPARATELY from Programming pass marks).
      mcqEasyPassMark: null as number | null,
      mcqMediumPassMark: null as number | null,
      mcqHardPassMark: null as number | null,
      overallMarkToPassEnabled: false,
      overallMarkToPass: null as number | null,
    },
    additionalOptions: {
      anonymousSubmissions: false,
      hideGraderIdentity: false,
    },
    allQuestionsRequired: false,
  });

  // ── Unsaved-changes guard ──────────────────────────────────────────────────
  // The wizard writes each step to the DB as you go, so "unsaved" here means
  // "changed since the last successful step save" — not "changed since the
  // modal opened". Closing right after a Save must NOT nag; typing a single
  // character after it must.
  //
  // Dirtiness is a serialized snapshot compared against a baseline rather than
  // a flag set from the field handlers: the form state is one deep object
  // written from ~80 call sites across five step components, and a flag would
  // have to be threaded through every one of them.
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const dirtySnapshot = useMemo(() => JSON.stringify({
    formData,
    questionSource, scratchMode, customSources, customDistribution,
    questionSourceMcq, customSourcesMcq, customDistributionMcq,
  }), [
    formData,
    questionSource, scratchMode, customSources, customDistribution,
    questionSourceMcq, customSourcesMcq, customDistributionMcq,
  ]);
  // Mirror for the callbacks below, which must read the snapshot without taking
  // it as a dependency (performSave would otherwise rebuild on every keystroke).
  const dirtySnapshotRef = useRef(dirtySnapshot);
  dirtySnapshotRef.current = dirtySnapshot;
  const dirtyBaselineRef = useRef<string | null>(null);
  // Until the user physically touches the modal, every formData change is the
  // form setting itself up — edit-mode hydration, the configured-language
  // auto-select, the marks/grade auto-calcs — so the baseline keeps tracking it.
  // The first pointerdown/keydown inside the modal freezes it; from then on a
  // differing snapshot means the user changed something. Freezing on real input
  // rather than on a timer means no arbitrary "hydration should be done by now"
  // window to get wrong, and a slow async hydration cannot masquerade as an edit.
  const dirtyArmedRef = useRef(false);
  const armDirtyTracking = useCallback(() => { dirtyArmedRef.current = true; }, []);

  useEffect(() => {
    if (!dirtyArmedRef.current) dirtyBaselineRef.current = dirtySnapshot;
  }, [dirtySnapshot]);

  /** Re-baseline after a successful save — those edits are on the server now. */
  const markDirtyBaseline = useCallback(() => {
    dirtyBaselineRef.current = dirtySnapshotRef.current;
  }, []);

  const hasUnsavedChanges = useCallback(
    () => dirtyBaselineRef.current !== null && dirtySnapshotRef.current !== dirtyBaselineRef.current,
    [],
  );

  /** X-button close: always ask whether to save, discard or keep editing. */
  const requestClose = useCallback(() => {
    if (hasUnsavedChanges()) setShowDiscardConfirm(true);
    else onClose();
  }, [hasUnsavedChanges, onClose]);

  // Pure-MCQ exercises have no Other Platform import path (the MCQ question
  // form only offers Manual / Bank / AI), so the source picker hides that
  // option for MCQ. If the exercise type is switched to MCQ after Other
  // Platform was picked, clear the now-hidden selection so an unusable
  // source is never persisted.
  useEffect(() => {
    if (formData.exerciseType !== 'MCQ') return;
    if (questionSource === 'thirdParty') setQuestionSource('');
    if (customSources.includes('thirdParty')) {
      setCustomSources(prev => prev.filter(s => s !== 'thirdParty'));
      setCustomDistribution(d => ({
        easy: { ...d.easy, thirdParty: 0 },
        medium: { ...d.medium, thirdParty: 0 },
        hard: { ...d.hard, thirdParty: 0 },
      }));
    }
  }, [formData.exerciseType, questionSource, customSources]);

  // ── Populate formData when editing, or from a template/command seed ────────
  useEffect(() => {
    if (!shouldHydrate || !initialData) return;
    const ex = initialData as any;
    if (ex.isDraft && ex.draftConfiguration?.formData) {
      const draft = ex.draftConfiguration;
      setFormData(prev => ({ ...prev, ...draft.formData, exerciseId: ex.exerciseInformation?.exerciseId || draft.formData.exerciseId }));
      setQuestionSource(draft.questionSource || '');
      setScratchMode(draft.scratchMode || 'manual');
      setCustomSources(draft.customSources || []);
      if (draft.customDistribution) setCustomDistribution(draft.customDistribution);
      setQuestionSourceMcq(draft.questionSourceMcq || '');
      setCustomSourcesMcq(draft.customSourcesMcq || []);
      if (draft.customDistributionMcq) setCustomDistributionMcq(draft.customDistributionMcq);
      setSaveToBank(draft.saveToBank || false);
      setSavedSteps(new Set(ex.stepsSaved || []));
      return;
    }
    const info = ex.exerciseInformation ?? {};
    const progSettings = ex.programmingSettings ?? {};
    const qc = ex.questionConfiguration ?? {};
    const mcqCfg = qc.mcqQuestionConfiguration ?? {};
    const progCfg = qc.programmingQuestionConfiguration ?? qc.programmingConfig ?? {};
    const avail = ex.availabilityPeriod ?? {};
    const notif = ex.notificationSettings ?? ex.notificatonandGradeSettings ?? {};

    const parseDate = (str: string | undefined, fb: any) => {
      if (!str) return fb;
      try { const d = new Date(str); if (isNaN(d.getTime())) return fb; return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), hour: d.getHours(), minute: d.getMinutes() }; } catch { return fb; }
    };
    const today = new Date(), nw = new Date(), tw = new Date();
    nw.setDate(today.getDate() + 7); tw.setDate(today.getDate() + 14);
    const dS = { day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear(), hour: 0, minute: 0 };
    const dE = { day: nw.getDate(), month: nw.getMonth() + 1, year: nw.getFullYear(), hour: 23, minute: 59 };
    const dG = { day: tw.getDate(), month: tw.getMonth() + 1, year: tw.getFullYear(), hour: 23, minute: 59 };

    const mcqScoreType: 'equalDistribution' | 'questionSpecific' = (mcqCfg.scoringType === 'equalDistribution' || mcqCfg.scoringType === 'evenMarks') ? 'equalDistribution' : mcqCfg.scoringType === 'questionSpecific' ? 'questionSpecific' : 'equalDistribution';
    const progConfigType = (progCfg.questionConfigType as any) || 'general';
    const normLevel = (lvl: any) => {
      if (!lvl) return { type: 'level_specific' as const, marksPerQuestion: 0, totalMarks: undefined, questionCount: 0 };
      return { type: (lvl.type === 'question_specific' ? 'question_specific' : 'level_specific') as any, marksPerQuestion: lvl.marksPerQuestion ?? 0, totalMarks: lvl.totalMarks as number | undefined, questionCount: lvl.questionCount ?? 0 };
    };
    const levelScoringCfg = progCfg.scoreSettings?.levelScoringConfiguration ?? {};
    const evenMarksVal = progCfg.generalMarksPerQuestion ?? progCfg.scoreSettings?.evenMarks ?? progCfg.scoreSettings?.equalDistribution ?? 0;

    setFormData(prev => ({
      ...prev,
      exerciseType: (ex.exerciseType as any) || '',
      isGraded: ex.isGraded !== false,
      selectedModule: progSettings.selectedModule ?? prev.selectedModule,
      selectedLanguages: Array.isArray(progSettings.selectedLanguages) ? progSettings.selectedLanguages : prev.selectedLanguages,
      exerciseId: info.exerciseId ?? prev.exerciseId,
      exerciseName: info.exerciseName ?? '',
      description: typeof info.description === 'string' ? info.description : (info.description?.text ?? ''),
      instructions: typeof ex.instructions === 'string' ? ex.instructions : (prev.instructions ?? ''),
      exerciseLevel: (info.exerciseLevel as any) ?? 'intermediate',
      totalDuration: info.totalDuration ?? 60,
      totalMarks: info.totalMarks ?? 0,
      totalMarksMCQ: info.totalMarksMCQ ?? 0,
      totalMarksProgramming: info.totalMarksProgramming ?? 0,
      allQuestionsRequired: ex.questionBehavior?.allQuestionsRequired ?? true,
      // Absent on exercises created before the feature — normalize() maps those
      // to test-case-only at 100%, matching their existing behaviour.
      evaluationMethod: normalizeEvaluationMethod(ex.evaluationMethod),
      mcqConfig: { questionConfigType: 'general', generalQuestionCount: mcqCfg.totalMcqQuestions ?? 0, scoreSettings: { scoreType: mcqScoreType, equalDistribution: mcqCfg.marksPerQuestion ?? 0, totalMarks: mcqCfg.mcqTotalMarks ?? 0 }, attemptLimitEnabled: mcqCfg.attemptLimitEnabled ?? false, submissionAttempts: mcqCfg.submissionAttempts ?? 1 },
      programmingConfig: {
        questionConfigType: progConfigType,
        // Phase 1 — seed patternTotal from stored value, else derive from counts
        // so pre-Phase-1 exercises pass the strict E+M+H===Total check on load.
        patternTotal: progCfg.patternTotal ?? (
          progConfigType === 'levelBased'
            ? (progCfg.levelBasedCounts?.easy ?? 0) + (progCfg.levelBasedCounts?.medium ?? 0) + (progCfg.levelBasedCounts?.hard ?? 0)
            : progConfigType === 'selectionLevel'
              ? (progCfg.selectionLevelCounts?.easy ?? 0) + (progCfg.selectionLevelCounts?.medium ?? 0) + (progCfg.selectionLevelCounts?.hard ?? 0)
              : 0
        ),
        generalQuestionCount: progCfg.generalQuestionCount ?? 0,
        selectionLevelCounts: { easy: progCfg.selectionLevelCounts?.easy ?? 0, medium: progCfg.selectionLevelCounts?.medium ?? 0, hard: progCfg.selectionLevelCounts?.hard ?? 0 },
        levelBasedCounts: { easy: progCfg.levelBasedCounts?.easy ?? 0, medium: progCfg.levelBasedCounts?.medium ?? 0, hard: progCfg.levelBasedCounts?.hard ?? 0 },
        scoreSettings: {
          scoreType: 'equalDistribution', equalDistribution: evenMarksVal,
          questionSpecific: { general: progCfg.scoreSettings?.separateMarks?.general ?? [], levelBased: { easy: progCfg.scoreSettings?.separateMarks?.levelBased?.easy ?? [], medium: progCfg.scoreSettings?.separateMarks?.levelBased?.medium ?? [], hard: progCfg.scoreSettings?.separateMarks?.levelBased?.hard ?? [] } },
          levelBasedMarks: { easy: progCfg.scoreSettings?.levelBasedMarks?.easy ?? 0, medium: progCfg.scoreSettings?.levelBasedMarks?.medium ?? 0, hard: progCfg.scoreSettings?.levelBasedMarks?.hard ?? 0 },
          levelScoringConfiguration: { easy: normLevel(levelScoringCfg.easy), medium: normLevel(levelScoringCfg.medium), hard: normLevel(levelScoringCfg.hard) },
          totalMarks: progCfg.scoreSettings?.totalMarks ?? 0,
        },
        questionFlow: (progCfg.questionFlow as any) ?? 'freeFlow', attemptLimitEnabled: progCfg.attemptLimitEnabled ?? false, submissionAttempts: progCfg.submissionAttempts ?? 1,
        compilerFileMode: (progCfg.compilerFileMode as any) ?? 'multiple',
      },
      othersConfig: {
        questionConfigType: (qc.othersQuestionConfiguration?.questionConfigType as any) ?? 'general',
        // Phase 1 — seed patternTotal from stored value else sum counts
        patternTotal: qc.othersQuestionConfiguration?.patternTotal ?? (
          (qc.othersQuestionConfiguration?.questionConfigType === 'levelBased')
            ? (qc.othersQuestionConfiguration?.levelBasedCounts?.easy ?? 0) + (qc.othersQuestionConfiguration?.levelBasedCounts?.medium ?? 0) + (qc.othersQuestionConfiguration?.levelBasedCounts?.hard ?? 0)
            : (qc.othersQuestionConfiguration?.questionConfigType === 'selectionLevel')
              ? (qc.othersQuestionConfiguration?.selectionLevelCounts?.easy ?? 0) + (qc.othersQuestionConfiguration?.selectionLevelCounts?.medium ?? 0) + (qc.othersQuestionConfiguration?.selectionLevelCounts?.hard ?? 0)
              : 0
        ),
        generalQuestionCount: qc.othersQuestionConfiguration?.generalQuestionCount ?? 0,
        selectionLevelCounts: { easy: qc.othersQuestionConfiguration?.selectionLevelCounts?.easy ?? 0, medium: qc.othersQuestionConfiguration?.selectionLevelCounts?.medium ?? 0, hard: qc.othersQuestionConfiguration?.selectionLevelCounts?.hard ?? 0 },
        levelBasedCounts: { easy: qc.othersQuestionConfiguration?.levelBasedCounts?.easy ?? 0, medium: qc.othersQuestionConfiguration?.levelBasedCounts?.medium ?? 0, hard: qc.othersQuestionConfiguration?.levelBasedCounts?.hard ?? 0 },
        scoreSettings: {
          scoreType: 'equalDistribution',
          equalDistribution: qc.othersQuestionConfiguration?.generalMarksPerQuestion ?? qc.othersQuestionConfiguration?.scoreSettings?.evenMarks ?? 0,
          questionSpecific: { general: qc.othersQuestionConfiguration?.scoreSettings?.separateMarks?.general ?? [], levelBased: { easy: qc.othersQuestionConfiguration?.scoreSettings?.separateMarks?.levelBased?.easy ?? [], medium: qc.othersQuestionConfiguration?.scoreSettings?.separateMarks?.levelBased?.medium ?? [], hard: qc.othersQuestionConfiguration?.scoreSettings?.separateMarks?.levelBased?.hard ?? [] } },
          levelBasedMarks: { easy: qc.othersQuestionConfiguration?.scoreSettings?.levelBasedMarks?.easy ?? 0, medium: qc.othersQuestionConfiguration?.scoreSettings?.levelBasedMarks?.medium ?? 0, hard: qc.othersQuestionConfiguration?.scoreSettings?.levelBasedMarks?.hard ?? 0 },
          levelScoringConfiguration: { easy: normLevel(qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.easy), medium: normLevel(qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.medium), hard: normLevel(qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.hard) },
          totalMarks: qc.othersQuestionConfiguration?.scoreSettings?.totalMarks ?? 0,
        },
        questionFlow: (qc.othersQuestionConfiguration?.questionFlow as any) ?? 'freeFlow',
        attemptLimitEnabled: qc.othersQuestionConfiguration?.attemptLimitEnabled ?? false,
        submissionAttempts: qc.othersQuestionConfiguration?.submissionAttempts ?? 1,
      },
      schedule: { allowSubmissions: true, startDate: parseDate(avail.startDate, dS), endDate: parseDate(avail.endDate || avail.dueDate, dE), cutOffEnabled: avail.cutOffEnabled ?? avail.cutoffEnabled ?? false, cutOffDate: parseDate(avail.cutOffDate, dE), remindGradeByEnabled: avail.remindGradeByEnabled ?? !!avail.remindGradeBy, remindGradeBy: parseDate(avail.remindGradeBy, dG), gracePeriodEnabled: avail.gracePeriodAllowed ?? false, gracePeriodDate: parseDate(avail.gracePeriodDate, dG), requiresAdminApproval: avail.requiresAdminApproval ?? false, approvalScope: avail.approvalScope || 'settings' },
      notifyUsers: notif.notifyUsers ?? true, notifyGmail: notif.notifyGmail ?? false, notifyWhatsApp: notif.notifyWhatsApp ?? false, gradeSheet: notif.gradeSheet ?? true,
      notifications: {
        notifyGradersSubmissions: notif.notifyGradersSubmissions ?? false,
        notifyGradersSubmissionsChannels: {
          dashboard: notif.notifyGradersSubmissionsChannels?.dashboard ?? false,
          gmail: notif.notifyGradersSubmissionsChannels?.gmail ?? false,
          whatsapp: notif.notifyGradersSubmissionsChannels?.whatsapp ?? false,
        },
        notifyGradersLateSubmissions: notif.notifyGradersLateSubmissions ?? false,
        notifyGradersLateSubmissionsChannels: {
          dashboard: notif.notifyGradersLateSubmissionsChannels?.dashboard ?? false,
          gmail: notif.notifyGradersLateSubmissionsChannels?.gmail ?? false,
          whatsapp: notif.notifyGradersLateSubmissionsChannels?.whatsapp ?? false,
        },
        notifyStudent: notif.notifyStudent ?? true,
        // Dashboard defaults ON, as for a new assignment and the other load
        // path — an assignment saved before channels were stored reopens
        // with the same box ticked it was created with.
        notifyStudentChannels: {
          dashboard: notif.notifyStudentChannels?.dashboard ?? true,
          gmail: notif.notifyStudentChannels?.gmail ?? false,
          whatsapp: notif.notifyStudentChannels?.whatsapp ?? false,
        },
      },
      grades: { mcqGrade: ex.gradeSettings?.mcqGrade ?? null, mcqGradeToPass: ex.gradeSettings?.mcqGradeToPass ?? null, programmingGrade: ex.gradeSettings?.programmingGrade ?? null, programmingGradeToPass: ex.gradeSettings?.programmingGradeToPass ?? null, combinedGrade: ex.gradeSettings?.combinedGrade ?? null, combinedGradeToPass: ex.gradeSettings?.combinedGradeToPass ?? null, separateMarks: ex.gradeSettings?.separateMarks ?? false, difficultyPassEnabled: ex.gradeSettings?.difficultyPassEnabled ?? false, easyPassMark: ex.gradeSettings?.easyPassMark ?? null, mediumPassMark: ex.gradeSettings?.mediumPassMark ?? null, hardPassMark: ex.gradeSettings?.hardPassMark ?? null, mcqEasyPassMark: ex.gradeSettings?.mcqEasyPassMark ?? null, mcqMediumPassMark: ex.gradeSettings?.mcqMediumPassMark ?? null, mcqHardPassMark: ex.gradeSettings?.mcqHardPassMark ?? null, overallMarkToPassEnabled: ex.gradeSettings?.overallMarkToPassEnabled ?? false, overallMarkToPass: ex.gradeSettings?.overallMarkToPass ?? null, gradeBands: Array.isArray(ex.gradeSettings?.gradeBands) ? ex.gradeSettings.gradeBands : undefined },
      additionalOptions: { anonymousSubmissions: ex.additionalOptions?.anonymousSubmissions ?? false, hideGraderIdentity: ex.additionalOptions?.hideGraderIdentity ?? false },
    }));
    setCurrentStep(1);
    setValidationErrors({});
    setTouchedFields(new Set());
    // Union the persisted saved-steps with whatever is already saved in this
    // session. These populate effects re-run whenever the parent hands us a new
    // `initialData` reference — if that snapshot is stale (taken before a step
    // was just saved), a plain replace would wipe the fresh save and the sidebar
    // would flip the step back to "Pending". Merging never drops a saved step.
    // Back-compat: docs saved before Add Questions became its own step only
    // carry 'Question Configuration' in stepsSaved — treat a picked source as
    // an already-saved Add Questions step so the sidebar doesn't flip it back
    // to Pending.
    setSavedSteps(prev => {
      const merged = new Set<string>([...prev, ...(Array.isArray(ex.stepsSaved) ? ex.stepsSaved : [])]);
      if (merged.has('Question Configuration') && ex.questionSource) merged.add('Add Questions');
      return merged;
    });
    // Phase 2 — hydrate persisted questionSource so edit-mode reopens on the
    // same source the teacher previously picked.
    if (ex.questionSource && typeof ex.questionSource === 'string') {
      setQuestionSource(ex.questionSource as QuestionSource);
    }
    // Phase 5 — hydrate custom-mode distribution.
    if (ex.customDistribution && typeof ex.customDistribution === 'object') {
      const cd = ex.customDistribution;
      setCustomDistribution({
        easy: { scratch: cd.easy?.scratch ?? 0, ai: cd.easy?.ai ?? 0, thirdParty: cd.easy?.thirdParty ?? 0 },
        medium: { scratch: cd.medium?.scratch ?? 0, ai: cd.medium?.ai ?? 0, thirdParty: cd.medium?.thirdParty ?? 0 },
        hard: { scratch: cd.hard?.scratch ?? 0, ai: cd.hard?.ai ?? 0, thirdParty: cd.hard?.thirdParty ?? 0 },
      });
    }
    // Hydrate the teacher's chosen sub-sources for Custom mode.
    if (Array.isArray(ex.customSources)) {
      setCustomSources(ex.customSources.filter((s: any) => s === 'scratch' || s === 'ai' || s === 'thirdParty'));
    }
    // Phase 6 — hydrate saveToBank preference.
    if (typeof ex.saveToBank === 'boolean') setSaveToBank(ex.saveToBank);
    // Combined: per-part MCQ source ('' = inherit the programming source).
    if (ex.questionSourceMcq && typeof ex.questionSourceMcq === 'string') {
      setQuestionSourceMcq(ex.questionSourceMcq as QuestionSource);
    }
    if (Array.isArray(ex.customSourcesMcq)) {
      setCustomSourcesMcq(ex.customSourcesMcq.filter((s: any) => s === 'scratch' || s === 'ai'));
    }
    if (ex.customDistributionMcq && typeof ex.customDistributionMcq === 'object') {
      setCustomDistributionMcq({
        scratch: ex.customDistributionMcq.scratch ?? 0,
        ai: ex.customDistributionMcq.ai ?? 0,
        thirdParty: ex.customDistributionMcq.thirdParty ?? 0,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldHydrate, initialData]);

  // In ExerciseSettings component, replace the schedule initialization part (around line 580-620)

  useEffect(() => {
    if (!shouldHydrate || !initialData) return;
    const ex = initialData as any;
    if (ex.isDraft && ex.draftConfiguration?.formData) return;
    const info = ex.exerciseInformation ?? {};
    const progSettings = ex.programmingSettings ?? {};
    const qc = ex.questionConfiguration ?? {};
    const mcqCfg = qc.mcqQuestionConfiguration ?? {};
    const progCfg = qc.programmingQuestionConfiguration ?? qc.programmingConfig ?? {};
    const avail = ex.availabilityPeriod ?? {};
    const notif = ex.notificationSettings ?? ex.notificatonandGradeSettings ?? {};

    // FIXED: parseDate returns null for missing dates instead of fallback
    const parseDate = (str: string | undefined): { day: number; month: number; year: number; hour: number; minute: number } | null => {
      if (!str) return null;
      try {
        const d = new Date(str);
        if (isNaN(d.getTime())) return null;
        return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), hour: d.getHours(), minute: d.getMinutes() };
      } catch { return null; }
    };

    // Parse dates, but don't use fallbacks
    const startDate = parseDate(avail.startDate);
    const endDate = parseDate(avail.endDate || avail.dueDate);   // new field || old field
    const cutOffDate = parseDate(avail.cutOffDate);
    const graceDate = parseDate(avail.gracePeriodDate);

    setFormData(prev => ({
      ...prev,
      exerciseType: (ex.exerciseType as any) || '',
      isGraded: ex.isGraded !== false,
      selectedModule: progSettings.selectedModule ?? prev.selectedModule,
      selectedLanguages: Array.isArray(progSettings.selectedLanguages) ? progSettings.selectedLanguages : prev.selectedLanguages,
      exerciseId: info.exerciseId ?? prev.exerciseId,
      exerciseName: info.exerciseName ?? '',
      description: typeof info.description === 'string' ? info.description : (info.description?.text ?? ''),
      instructions: typeof ex.instructions === 'string' ? ex.instructions : (prev.instructions ?? ''),
      exerciseLevel: (info.exerciseLevel as any) ?? 'intermediate',
      totalDuration: info.totalDuration ?? 60,
      totalMarks: info.totalMarks ?? 0,
      totalMarksMCQ: info.totalMarksMCQ ?? 0,
      totalMarksProgramming: info.totalMarksProgramming ?? 0,
      allQuestionsRequired: ex.questionBehavior?.allQuestionsRequired ?? true,
      // See the first hydration effect above — same normalize-on-load contract.
      evaluationMethod: normalizeEvaluationMethod(ex.evaluationMethod),
      mcqConfig: {
        questionConfigType: 'general',
        generalQuestionCount: mcqCfg.totalMcqQuestions ?? 0,
        scoreSettings: {
          scoreType: (mcqCfg.scoringType === 'equalDistribution' || mcqCfg.scoringType === 'evenMarks') ? 'equalDistribution' :
            mcqCfg.scoringType === 'questionSpecific' ? 'questionSpecific' : 'equalDistribution',
          equalDistribution: mcqCfg.marksPerQuestion ?? 0,
          totalMarks: mcqCfg.mcqTotalMarks ?? 0
        },
        attemptLimitEnabled: mcqCfg.attemptLimitEnabled ?? false,
        submissionAttempts: mcqCfg.submissionAttempts ?? 1
      },
      programmingConfig: {
        questionConfigType: (progCfg.questionConfigType as any) || 'general',
        // Phase 1 — seed patternTotal (see first hydration effect above)
        patternTotal: progCfg.patternTotal ?? (
          progCfg.questionConfigType === 'levelBased'
            ? (progCfg.levelBasedCounts?.easy ?? 0) + (progCfg.levelBasedCounts?.medium ?? 0) + (progCfg.levelBasedCounts?.hard ?? 0)
            : progCfg.questionConfigType === 'selectionLevel'
              ? (progCfg.selectionLevelCounts?.easy ?? 0) + (progCfg.selectionLevelCounts?.medium ?? 0) + (progCfg.selectionLevelCounts?.hard ?? 0)
              : 0
        ),
        generalQuestionCount: progCfg.generalQuestionCount ?? 0,
        selectionLevelCounts: { easy: progCfg.selectionLevelCounts?.easy ?? 0, medium: progCfg.selectionLevelCounts?.medium ?? 0, hard: progCfg.selectionLevelCounts?.hard ?? 0 },
        levelBasedCounts: { easy: progCfg.levelBasedCounts?.easy ?? 0, medium: progCfg.levelBasedCounts?.medium ?? 0, hard: progCfg.levelBasedCounts?.hard ?? 0 },
        scoreSettings: {
          scoreType: 'equalDistribution',
          equalDistribution: progCfg.generalMarksPerQuestion ?? progCfg.scoreSettings?.evenMarks ?? 0,
          questionSpecific: {
            general: progCfg.scoreSettings?.separateMarks?.general ?? [],
            levelBased: {
              easy: progCfg.scoreSettings?.separateMarks?.levelBased?.easy ?? [],
              medium: progCfg.scoreSettings?.separateMarks?.levelBased?.medium ?? [],
              hard: progCfg.scoreSettings?.separateMarks?.levelBased?.hard ?? []
            }
          },
          levelBasedMarks: { easy: progCfg.scoreSettings?.levelBasedMarks?.easy ?? 0, medium: progCfg.scoreSettings?.levelBasedMarks?.medium ?? 0, hard: progCfg.scoreSettings?.levelBasedMarks?.hard ?? 0 },
          levelScoringConfiguration: {
            easy: { type: (progCfg.scoreSettings?.levelScoringConfiguration?.easy?.type as any) || 'level_specific', marksPerQuestion: progCfg.scoreSettings?.levelScoringConfiguration?.easy?.marksPerQuestion ?? 0, totalMarks: progCfg.scoreSettings?.levelScoringConfiguration?.easy?.totalMarks, questionCount: progCfg.scoreSettings?.levelScoringConfiguration?.easy?.questionCount ?? 0 },
            medium: { type: (progCfg.scoreSettings?.levelScoringConfiguration?.medium?.type as any) || 'level_specific', marksPerQuestion: progCfg.scoreSettings?.levelScoringConfiguration?.medium?.marksPerQuestion ?? 0, totalMarks: progCfg.scoreSettings?.levelScoringConfiguration?.medium?.totalMarks, questionCount: progCfg.scoreSettings?.levelScoringConfiguration?.medium?.questionCount ?? 0 },
            hard: { type: (progCfg.scoreSettings?.levelScoringConfiguration?.hard?.type as any) || 'level_specific', marksPerQuestion: progCfg.scoreSettings?.levelScoringConfiguration?.hard?.marksPerQuestion ?? 0, totalMarks: progCfg.scoreSettings?.levelScoringConfiguration?.hard?.totalMarks, questionCount: progCfg.scoreSettings?.levelScoringConfiguration?.hard?.questionCount ?? 0 },
          },
          totalMarks: progCfg.scoreSettings?.totalMarks ?? 0,
        },
        questionFlow: (progCfg.questionFlow as any) ?? 'freeFlow',
        attemptLimitEnabled: progCfg.attemptLimitEnabled ?? false,
        submissionAttempts: progCfg.submissionAttempts ?? 1,
        compilerFileMode: (progCfg.compilerFileMode as any) ?? 'multiple',
      },
      othersConfig: {
        questionConfigType: (qc.othersQuestionConfiguration?.questionConfigType as any) ?? 'general',
        // Phase 1 — seed patternTotal (see first hydration effect above)
        patternTotal: qc.othersQuestionConfiguration?.patternTotal ?? (
          (qc.othersQuestionConfiguration?.questionConfigType === 'levelBased')
            ? (qc.othersQuestionConfiguration?.levelBasedCounts?.easy ?? 0) + (qc.othersQuestionConfiguration?.levelBasedCounts?.medium ?? 0) + (qc.othersQuestionConfiguration?.levelBasedCounts?.hard ?? 0)
            : (qc.othersQuestionConfiguration?.questionConfigType === 'selectionLevel')
              ? (qc.othersQuestionConfiguration?.selectionLevelCounts?.easy ?? 0) + (qc.othersQuestionConfiguration?.selectionLevelCounts?.medium ?? 0) + (qc.othersQuestionConfiguration?.selectionLevelCounts?.hard ?? 0)
              : 0
        ),
        generalQuestionCount: qc.othersQuestionConfiguration?.generalQuestionCount ?? 0,
        selectionLevelCounts: { easy: qc.othersQuestionConfiguration?.selectionLevelCounts?.easy ?? 0, medium: qc.othersQuestionConfiguration?.selectionLevelCounts?.medium ?? 0, hard: qc.othersQuestionConfiguration?.selectionLevelCounts?.hard ?? 0 },
        levelBasedCounts: { easy: qc.othersQuestionConfiguration?.levelBasedCounts?.easy ?? 0, medium: qc.othersQuestionConfiguration?.levelBasedCounts?.medium ?? 0, hard: qc.othersQuestionConfiguration?.levelBasedCounts?.hard ?? 0 },
        scoreSettings: {
          scoreType: 'equalDistribution',
          equalDistribution: qc.othersQuestionConfiguration?.generalMarksPerQuestion ?? qc.othersQuestionConfiguration?.scoreSettings?.evenMarks ?? 0,
          questionSpecific: { general: qc.othersQuestionConfiguration?.scoreSettings?.separateMarks?.general ?? [], levelBased: { easy: qc.othersQuestionConfiguration?.scoreSettings?.separateMarks?.levelBased?.easy ?? [], medium: qc.othersQuestionConfiguration?.scoreSettings?.separateMarks?.levelBased?.medium ?? [], hard: qc.othersQuestionConfiguration?.scoreSettings?.separateMarks?.levelBased?.hard ?? [] } },
          levelBasedMarks: { easy: qc.othersQuestionConfiguration?.scoreSettings?.levelBasedMarks?.easy ?? 0, medium: qc.othersQuestionConfiguration?.scoreSettings?.levelBasedMarks?.medium ?? 0, hard: qc.othersQuestionConfiguration?.scoreSettings?.levelBasedMarks?.hard ?? 0 },
          levelScoringConfiguration: {
            easy: { type: (qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.easy?.type as any) || 'level_specific', marksPerQuestion: qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.easy?.marksPerQuestion ?? 0, totalMarks: qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.easy?.totalMarks, questionCount: qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.easy?.questionCount ?? 0 },
            medium: { type: (qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.medium?.type as any) || 'level_specific', marksPerQuestion: qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.medium?.marksPerQuestion ?? 0, totalMarks: qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.medium?.totalMarks, questionCount: qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.medium?.questionCount ?? 0 },
            hard: { type: (qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.hard?.type as any) || 'level_specific', marksPerQuestion: qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.hard?.marksPerQuestion ?? 0, totalMarks: qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.hard?.totalMarks, questionCount: qc.othersQuestionConfiguration?.scoreSettings?.levelScoringConfiguration?.hard?.questionCount ?? 0 },
          },
          totalMarks: qc.othersQuestionConfiguration?.scoreSettings?.totalMarks ?? 0,
        },
        questionFlow: (qc.othersQuestionConfiguration?.questionFlow as any) ?? 'freeFlow',
        attemptLimitEnabled: qc.othersQuestionConfiguration?.attemptLimitEnabled ?? false,
        submissionAttempts: qc.othersQuestionConfiguration?.submissionAttempts ?? 1,
      },
      schedule: {
        allowSubmissions: true,
        startDate: startDate || { day: 0, month: 0, year: 0, hour: 0, minute: 0 },
        endDate: endDate || { day: 0, month: 0, year: 0, hour: 0, minute: 0 },
        cutOffEnabled: avail.cutOffEnabled ?? avail.cutoffEnabled ?? false,
        cutOffDate: cutOffDate || { day: 0, month: 0, year: 0, hour: 23, minute: 59 },
        remindGradeByEnabled: avail.remindGradeByEnabled ?? false,
        remindGradeBy: parseDate(avail.remindGradeBy) || { day: 0, month: 0, year: 0, hour: 0, minute: 0 },
        gracePeriodEnabled: avail.gracePeriodAllowed ?? false,
        gracePeriodDate: graceDate || { day: 0, month: 0, year: 0, hour: 0, minute: 0 },
        requiresAdminApproval: avail.requiresAdminApproval ?? false,
        approvalScope: avail.approvalScope || 'settings',
      },
      notifyUsers: notif.notifyUsers ?? true,
      notifyGmail: notif.notifyGmail ?? false,
      notifyWhatsApp: notif.notifyWhatsApp ?? false,
      gradeSheet: notif.gradeSheet ?? true,
      notifications: {
        notifyGradersSubmissions: notif.notifyGradersSubmissions ?? false,
        notifyGradersSubmissionsChannels: {
          dashboard: notif.notifyGradersSubmissionsChannels?.dashboard ?? false,
          gmail: notif.notifyGradersSubmissionsChannels?.gmail ?? false,
          whatsapp: notif.notifyGradersSubmissionsChannels?.whatsapp ?? false,
        },
        notifyGradersLateSubmissions: notif.notifyGradersLateSubmissions ?? false,
        notifyGradersLateSubmissionsChannels: {
          dashboard: notif.notifyGradersLateSubmissionsChannels?.dashboard ?? false,
          gmail: notif.notifyGradersLateSubmissionsChannels?.gmail ?? false,
          whatsapp: notif.notifyGradersLateSubmissionsChannels?.whatsapp ?? false,
        },
        notifyStudent: notif.notifyStudent ?? true,
      notifyStudentChannels: {
  dashboard: notif.notifyStudentChannels?.dashboard ?? true,
  gmail: notif.notifyStudentChannels?.gmail ?? false,
  whatsapp: notif.notifyStudentChannels?.whatsapp ?? false,
},
      },
      grades: { mcqGrade: ex.gradeSettings?.mcqGrade ?? null, mcqGradeToPass: ex.gradeSettings?.mcqGradeToPass ?? null, programmingGrade: ex.gradeSettings?.programmingGrade ?? null, programmingGradeToPass: ex.gradeSettings?.programmingGradeToPass ?? null, combinedGrade: ex.gradeSettings?.combinedGrade ?? null, combinedGradeToPass: ex.gradeSettings?.combinedGradeToPass ?? null, separateMarks: ex.gradeSettings?.separateMarks ?? false, difficultyPassEnabled: ex.gradeSettings?.difficultyPassEnabled ?? false, easyPassMark: ex.gradeSettings?.easyPassMark ?? null, mediumPassMark: ex.gradeSettings?.mediumPassMark ?? null, hardPassMark: ex.gradeSettings?.hardPassMark ?? null, mcqEasyPassMark: ex.gradeSettings?.mcqEasyPassMark ?? null, mcqMediumPassMark: ex.gradeSettings?.mcqMediumPassMark ?? null, mcqHardPassMark: ex.gradeSettings?.mcqHardPassMark ?? null, overallMarkToPassEnabled: ex.gradeSettings?.overallMarkToPassEnabled ?? false, overallMarkToPass: ex.gradeSettings?.overallMarkToPass ?? null, gradeBands: Array.isArray(ex.gradeSettings?.gradeBands) ? ex.gradeSettings.gradeBands : undefined },
      additionalOptions: { anonymousSubmissions: ex.additionalOptions?.anonymousSubmissions ?? false, hideGraderIdentity: ex.additionalOptions?.hideGraderIdentity ?? false },
    }));
    setCurrentStep(1);
    setValidationErrors({});
    setTouchedFields(new Set());
    // Union the persisted saved-steps with whatever is already saved in this
    // session. These populate effects re-run whenever the parent hands us a new
    // `initialData` reference — if that snapshot is stale (taken before a step
    // was just saved), a plain replace would wipe the fresh save and the sidebar
    // would flip the step back to "Pending". Merging never drops a saved step.
    // Back-compat: docs saved before Add Questions became its own step only
    // carry 'Question Configuration' in stepsSaved — treat a picked source as
    // an already-saved Add Questions step so the sidebar doesn't flip it back
    // to Pending.
    setSavedSteps(prev => {
      const merged = new Set<string>([...prev, ...(Array.isArray(ex.stepsSaved) ? ex.stepsSaved : [])]);
      if (merged.has('Question Configuration') && ex.questionSource) merged.add('Add Questions');
      return merged;
    });
    if (ex.questionSource && typeof ex.questionSource === 'string') {
      setQuestionSource(ex.questionSource as QuestionSource);
    }
    // Phase 5 — hydrate custom-mode distribution.
    if (ex.customDistribution && typeof ex.customDistribution === 'object') {
      const cd = ex.customDistribution;
      setCustomDistribution({
        easy: { scratch: cd.easy?.scratch ?? 0, ai: cd.easy?.ai ?? 0, thirdParty: cd.easy?.thirdParty ?? 0 },
        medium: { scratch: cd.medium?.scratch ?? 0, ai: cd.medium?.ai ?? 0, thirdParty: cd.medium?.thirdParty ?? 0 },
        hard: { scratch: cd.hard?.scratch ?? 0, ai: cd.hard?.ai ?? 0, thirdParty: cd.hard?.thirdParty ?? 0 },
      });
    }
    // Hydrate the teacher's chosen sub-sources for Custom mode.
    if (Array.isArray(ex.customSources)) {
      setCustomSources(ex.customSources.filter((s: any) => s === 'scratch' || s === 'ai' || s === 'thirdParty'));
    }
    // Phase 6 — hydrate saveToBank preference.
    if (typeof ex.saveToBank === 'boolean') setSaveToBank(ex.saveToBank);
    // Combined: per-part MCQ source ('' = inherit the programming source).
    if (ex.questionSourceMcq && typeof ex.questionSourceMcq === 'string') {
      setQuestionSourceMcq(ex.questionSourceMcq as QuestionSource);
    }
    if (Array.isArray(ex.customSourcesMcq)) {
      setCustomSourcesMcq(ex.customSourcesMcq.filter((s: any) => s === 'scratch' || s === 'ai'));
    }
    if (ex.customDistributionMcq && typeof ex.customDistributionMcq === 'object') {
      setCustomDistributionMcq({
        scratch: ex.customDistributionMcq.scratch ?? 0,
        ai: ex.customDistributionMcq.ai ?? 0,
        thirdParty: ex.customDistributionMcq.thirdParty ?? 0,
      });
    }
  }, [shouldHydrate, initialData]);

  // Find this useEffect (around line 850-920) that seeds completedSteps
  useEffect(() => {
    if (!isEditing || !initialData || !formData.exerciseType || steps.length === 0) return;
    if (completedStepsInitialized.current === initialData) return;
    completedStepsInitialized.current = initialData;

    const ids = new Set<number>();
    steps.forEach(step => {
      let filled = false;
      switch (step.title) {
        case 'Exercise Details': {
          if (!formData.exerciseType) { filled = false; break; }
          if ((formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') &&
            (!formData.selectedModule || formData.selectedLanguages.length === 0)) { filled = false; break; }
          const base = !!(formData.exerciseName?.trim() && formData.totalDuration > 0);
          filled = formData.isGraded === false ? base
            : formData.exerciseType === 'Combined'
              ? base && formData.totalMarksMCQ > 0 && formData.totalMarksProgramming > 0
              : base && formData.totalMarks > 0;
          break;
        }
        case 'Question Configuration': {
          const cfg = formData.programmingConfig;
          const progFilled = cfg.questionConfigType === 'general'
            ? cfg.generalQuestionCount > 0
            : (() => { const counts = cfg.questionConfigType === 'selectionLevel' ? cfg.selectionLevelCounts : cfg.levelBasedCounts; return counts.easy > 0 || counts.medium > 0 || counts.hard > 0; })();
          // Phase 1 — pattern balance also required when patternTotal is set.
          const patternOk = !patternTotalMismatch;
          if (formData.exerciseType === 'MCQ') { filled = formData.mcqConfig.generalQuestionCount > 0; break; }
          if (formData.exerciseType === 'Programming') { filled = progFilled && patternOk; break; }
          if (formData.exerciseType === 'Other') {
            const oc = formData.othersConfig;
            if (oc.questionConfigType === 'general') { filled = oc.generalQuestionCount > 0; break; }
            if (oc.questionConfigType === 'levelBased') {
              const counts = oc.levelBasedCounts || { easy: 0, medium: 0, hard: 0 };
              filled = counts.easy > 0 && counts.medium > 0 && counts.hard > 0 && patternOk; break;
            }
            if (oc.questionConfigType === 'selectionLevel') {
              const counts = oc.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
              filled = (counts.easy > 0 || counts.medium > 0 || counts.hard > 0) && patternOk; break;
            }
            filled = false; break;
          }
          if (formData.exerciseType === 'Combined') { filled = formData.mcqConfig.generalQuestionCount > 0 && progFilled && patternOk; break; }
          filled = true; break;
        }
        case 'Add Questions': {
          // Source picked (Custom needs ≥2 sub-sources) — read from the doc so
          // this pass doesn't race the state hydration above.
          const exq: any = initialData as any;
          const src = exq?.questionSource;
          filled = !!src && (src !== 'custom' || (Array.isArray(exq?.customSources) && exq.customSources.length >= 2));
          break;
        }
        case 'Schedule': {
          const sched = formData.schedule as any;
          filled = !!(sched.startDate?.year > 0 && sched.endDate?.year > 0);
          break;
        }
        case 'Notifications':
        case 'Notification': {
          // Green tick — Mark to Pass is optional, so just check that Grade Settings was visited/saved
          if (formData.exerciseType === 'MCQ') filled = true;
          else if (formData.exerciseType === 'Other') filled = true;
          else if (formData.exerciseType === 'Programming') filled = (formData.grades.programmingGrade ?? 0) > 0;
          else if (formData.exerciseType === 'Combined') filled = true;
          else filled = false;
          break;
        }
        case 'Grade Settings':
          // Mark to Pass is optional — only Mark (programmingGrade) is required for Programming type
          if (formData.exerciseType === 'MCQ')
            filled = true;
          else if (formData.exerciseType === 'Other')
            filled = true;
          else if (formData.exerciseType === 'Programming')
            filled = (formData.grades.programmingGrade ?? 0) > 0;
          else if (formData.exerciseType === 'Combined')
            filled = true;
          break;
        default:
          filled = true;
      }
      if (filled) ids.add(step.id);
    });

    setCompletedSteps(new Set(ids));

  }, [isEditing, initialData, formData.exerciseType, formData.exerciseName, formData.totalDuration,
    formData.totalMarks, formData.totalMarksMCQ, formData.totalMarksProgramming,
    formData.selectedModule, formData.selectedLanguages, formData.mcqConfig.generalQuestionCount,
    formData.programmingConfig, formData.othersConfig, formData.schedule, formData.grades]);
  // Add this helper near the top of ExerciseSettings (or wherever language selection lives):

  const flatLanguages = useMemo(() => {
    if (!configuredLanguages) return [];
    return [
      ...(configuredLanguages.coreProgram ?? []),
      ...(configuredLanguages.frontend ?? []),
      ...(configuredLanguages.database ?? []),
    ].filter(Boolean);
  }, [configuredLanguages]);

  const hasPreConfiguredLanguages = flatLanguages.length > 0;

  // Auto-select all configured languages when configuredLanguages is provided
  // Replace the existing useEffect that auto-selects configured languages (around line 780-795)
  useEffect(() => {
    if (hasPreConfiguredLanguages && flatLanguages.length > 0) {
      // Determine module category based on where the first language comes from
      let detectedModule = '';
      if (configuredLanguages?.coreProgram?.length) detectedModule = 'Core Programming';
      else if (configuredLanguages?.frontend?.length) detectedModule = 'Frontend';
      else if (configuredLanguages?.database?.length) detectedModule = 'Database';

      setFormData(prev => ({
        ...prev,
        selectedLanguages: flatLanguages,
        selectedModule: detectedModule || prev.selectedModule,
      }));

      // Clear validation errors for these fields
      setValidationErrors(prev => {
        const e = { ...prev };
        delete e.selectedModule;
        delete e.selectedLanguages;
        return e;
      });
    }
  }, [hasPreConfiguredLanguages, flatLanguages.join(',')]);

  const moduleLanguages: Record<string, { name: string; icon: string }[]> = {
    'Core Programming': [
      { name: 'C', icon: '/active-images/c.png' }, { name: 'C++', icon: '/active-images/cpp.png' },
      { name: 'Java', icon: '/active-images/java.png' }, { name: 'Python', icon: '/active-images/python.png' },
      { name: 'C#', icon: '/active-images/csharp.png' },
    ],
    'Frontend': [
      { name: 'HTML', icon: '/active-images/html.png' }, { name: 'CSS', icon: '/active-images/css.png' },
      { name: 'JavaScript', icon: '/active-images/javascript.png' }, { name: 'Bootstrap', icon: '/active-images/bootstrap.png' },
      { name: 'TypeScript', icon: '/active-images/typescript.png' }, { name: 'React', icon: '/active-images/react.png' },
    ],
    'Database': [{ name: 'SQL', icon: '/active-images/sql.png' }, { name: 'MongoDB', icon: '/active-images/mongodb.png' }],
  };

  const getFilteredLanguages = (category: string): { name: string; icon: string }[] => {
    const all = moduleLanguages[category] || [];
    if (!configuredLanguages) return all;
    const categoryKey = category === 'Core Programming' ? 'coreProgram' : category === 'Frontend' ? 'frontend' : 'database';
    const allowed = configuredLanguages[categoryKey as keyof typeof configuredLanguages];
    if (!allowed) return all;
    return all.filter(l => allowed.includes(l.name));
  };

  const mcqScoringOptions = useMemo(() => [
    { value: 'equalDistribution', label: 'Equal Distribution' },
    { value: 'questionSpecific', label: 'Question Specific' },
  ], []);

  const configOptions = useMemo(() => [
    { label: 'General Configuration', value: 'general' },
    { label: 'Level Based Configuration', value: 'levelBased' },
    { label: 'Selection Level Configuration', value: 'selectionLevel' },
  ], []);

  const questionFlowOptions = useMemo(() => [
    { value: 'freeFlow', label: 'Free Flow', description: 'Users can attempt questions in any order', icon: <Shuffle size={14} /> },
    { value: 'controlled', label: 'Controlled Flow', description: 'Users must follow specific sequence', icon: <Lock size={14} /> },
  ], []);

  const levelScoringOptions = useMemo(() => [
    { value: 'level_specific', label: 'Same Marks' },
    { value: 'question_specific', label: 'Individual' },
  ], []);

  // ── Steps ──────────────────────────────────────────────────────────────────
  const getSteps = (): Step[] => {
    const steps: Step[] = [];
    let next = 1;
    const did = next;
    steps.push({ id: did, title: 'Exercise Details', subtitle: 'Type, Info & Time', completed: currentStep > did, active: currentStep === did, icon: <FileText size={12} /> }); next = did + 1;
    // Question Configuration is always present in the sidebar regardless of
    // whether an exercise type has been chosen yet — the subtitle adapts once
    // the user picks a type, and Combined uses tabs internally.
    {
      const qid = next; steps.push({
        id: qid,
        title: 'Question Configuration',
        subtitle: formData.exerciseType === 'MCQ' ? 'MCQ Questions'
          : formData.exerciseType === 'Programming' ? 'Programming Questions'
          : formData.exerciseType === 'Other' ? 'Other Questions'
          : formData.exerciseType === 'Combined' ? 'MCQ + Programming'
          : 'Configure Questions',
        completed: currentStep > qid,
        active: currentStep === qid,
        icon: <List size={12} />,
      });
      next = qid + 1;
    }
    // Add Questions — owns the Question Source picker, Custom distribution and
    // question authoring/attachment. Split out of Question Configuration.
    const aid = next; steps.push({ id: aid, title: 'Add Questions', subtitle: 'Source & Questions', completed: currentStep > aid, active: currentStep === aid, icon: <FolderOpen size={12} /> }); next = aid + 1;
    const sid = next; steps.push({ id: sid, title: 'Schedule', subtitle: 'Dates & Times', completed: currentStep > sid, active: currentStep === sid, icon: <Calendar size={12} /> }); next = sid + 1;
    const nid = next; steps.push({ id: nid, title: 'Notifications', subtitle: 'Alerts & Notify', completed: currentStep > nid, active: currentStep === nid, icon: <Bell size={12} /> }); next = nid + 1;
    if (formData.isGraded !== false) {
      const gid = next; steps.push({ id: gid, title: 'Grade Settings', subtitle: 'Marks & Grading', completed: currentStep > gid, active: currentStep === gid, icon: <Award size={12} /> });
    }
    return steps;
  };

  const steps = useMemo(() => getSteps(), [formData.exerciseType, formData.isGraded, currentStep]);

  // ── Non-graded pins Evaluation Method to Manual ───────────────────────────
  // A non-graded exercise records no score, so there is nothing to evaluate and
  // the Question Configuration step hides the picker entirely. The pin has to
  // live HERE rather than inside EvaluationMethodConfig: hiding the picker
  // unmounts it, so its own guard can no longer run — and a trainer who picks
  // Test Case or AI and only THEN flips Graded off would otherwise save an
  // exercise with an auto-evaluator still armed behind a control they can no
  // longer see. Every payload builder reads formData, so pinning it here covers
  // the full save and the step-scoped one alike.
  useEffect(() => {
    if (formData.isGraded !== false) return;
    if (formData.evaluationMethod?.method === 'manual') return;
    setFormData(prev => ({
      ...prev,
      // AI criteria are left untouched — inert under Manual, and kept so
      // flipping Graded back on restores the trainer's choices.
      evaluationMethod: { ...prev.evaluationMethod, method: 'manual' },
    }));
  }, [formData.isGraded, formData.evaluationMethod?.method]);

  // ── Auto-calc marks ────────────────────────────────────────────────────────
  useEffect(() => {
    if ((formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') && formData.programmingConfig.questionConfigType === 'general' && formData.programmingConfig.scoreSettings.scoreType === 'equalDistribution') {
      const qc = formData.programmingConfig.generalQuestionCount;
      const total = formData.exerciseType === 'Combined' ? formData.totalMarksProgramming : formData.totalMarks;
      if (qc > 0 && total > 0) setFormData(prev => ({ ...prev, programmingConfig: { ...prev.programmingConfig, scoreSettings: { ...prev.programmingConfig.scoreSettings, equalDistribution: total / qc } } }));
    }
  }, [formData.exerciseType, formData.totalMarks, formData.totalMarksProgramming, formData.programmingConfig.generalQuestionCount, formData.programmingConfig.questionConfigType, formData.programmingConfig.scoreSettings.scoreType]);

  useEffect(() => {
    if ((formData.exerciseType === 'MCQ' || formData.exerciseType === 'Combined') && formData.mcqConfig.scoreSettings.scoreType === 'equalDistribution') {
      const qc = formData.mcqConfig.generalQuestionCount;
      const total = formData.exerciseType === 'Combined' ? formData.totalMarksMCQ : formData.totalMarks;
      if (qc > 0 && total > 0) setFormData(prev => ({ ...prev, mcqConfig: { ...prev.mcqConfig, scoreSettings: { ...prev.mcqConfig.scoreSettings, equalDistribution: total / qc } } }));
    }
  }, [formData.exerciseType, formData.totalMarks, formData.totalMarksMCQ, formData.mcqConfig.generalQuestionCount, formData.mcqConfig.scoreSettings.scoreType]);

  // RESTORED: Auto-sync mcqConfig totalMarks for question specific mode
  useEffect(() => {
    if (formData.exerciseType === 'MCQ' && formData.mcqConfig.scoreSettings.scoreType === 'questionSpecific' && formData.totalMarks > 0) {
      setFormData(prev => ({
        ...prev,
        mcqConfig: { ...prev.mcqConfig, scoreSettings: { ...prev.mcqConfig.scoreSettings, totalMarks: prev.totalMarks } }
      }));
    }
  }, [formData.exerciseType, formData.totalMarks, formData.mcqConfig.scoreSettings.scoreType]);


  // Replace the existing auto-sync useEffect with this corrected version
  useEffect(() => {
    if ((formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') &&
      formData.programmingConfig.questionConfigType === 'general' &&
      formData.programmingConfig.scoreSettings.scoreType === 'equalDistribution') {

      const qc = formData.programmingConfig.generalQuestionCount;
      const total = formData.exerciseType === 'Combined' ? formData.totalMarksProgramming : formData.totalMarks;

      // Only calculate if both values are valid
      if (qc > 0 && total > 0) {
        const newMarksPerQuestion = total / qc;
        const currentMarks = formData.programmingConfig.scoreSettings.equalDistribution;

        // Check if update is needed (avoid infinite loops)
        const needsUpdate = Math.abs(currentMarks - newMarksPerQuestion) > 0.01;

        if (needsUpdate) {
          setFormData(prev => ({
            ...prev,
            programmingConfig: {
              ...prev.programmingConfig,
              scoreSettings: {
                ...prev.programmingConfig.scoreSettings,
                equalDistribution: newMarksPerQuestion
              }
            }
          }));
        }
      }
    }
  }, [formData.exerciseType, formData.totalMarks, formData.totalMarksProgramming,
  formData.programmingConfig.generalQuestionCount,
  formData.programmingConfig.questionConfigType,
  formData.programmingConfig.scoreSettings.scoreType]);

  useEffect(() => {
    if (formData.exerciseType === 'Other' &&
      formData.othersConfig.questionConfigType === 'general' &&
      formData.othersConfig.scoreSettings.scoreType === 'equalDistribution') {
      const qc = formData.othersConfig.generalQuestionCount;
      const total = formData.totalMarks;
      if (qc > 0 && total > 0) {
        const newMpq = total / qc;
        if (Math.abs(formData.othersConfig.scoreSettings.equalDistribution - newMpq) > 0.01) {
          setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, scoreSettings: { ...prev.othersConfig.scoreSettings, equalDistribution: newMpq } } }));
        }
      }
    }
  }, [formData.exerciseType, formData.totalMarks, formData.othersConfig.generalQuestionCount, formData.othersConfig.questionConfigType, formData.othersConfig.scoreSettings.scoreType]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const programmingAllocatedMarks = useMemo(() => {
    let m = 0;
    const pc = formData.programmingConfig;
    if (pc.questionConfigType === 'general') { if (pc.scoreSettings.scoreType === 'equalDistribution') m = pc.generalQuestionCount * pc.scoreSettings.equalDistribution; }
    else {
      const counts = pc.questionConfigType === 'selectionLevel' ? pc.selectionLevelCounts : pc.levelBasedCounts;
      const ls = pc.scoreSettings.levelScoringConfiguration;
      (['easy', 'medium', 'hard'] as const).forEach(l => {
        const c = counts[l] || 0; if (!c) return;
        const s = ls[l];
        if (s) { if (s.type === 'level_specific' && s.marksPerQuestion) m += c * s.marksPerQuestion; else if (s.type === 'question_specific' && s.totalMarks) m += s.totalMarks; }
      });
    }
    return m;
  }, [formData.programmingConfig]);

  const mcqAllocatedMarks = useMemo(() => {
    if (formData.mcqConfig.scoreSettings.scoreType === 'equalDistribution') return formData.mcqConfig.generalQuestionCount * formData.mcqConfig.scoreSettings.equalDistribution;
    return formData.mcqConfig.scoreSettings.totalMarks || 0;
  }, [formData.mcqConfig]);

  const programmingLevelMismatch = useMemo((): string | null => {
    if (formData.exerciseType !== 'Programming' && formData.exerciseType !== 'Combined') return null;
    const ct = formData.programmingConfig.questionConfigType;
    if (ct === 'general') return null;
    const total = formData.exerciseType === 'Combined' ? (formData.totalMarksProgramming ?? 0) : (formData.totalMarks ?? 0);
    if (total <= 0) return null;
    const ls = formData.programmingConfig.scoreSettings?.levelScoringConfiguration;
    if (!ls) return null;
    const getSum = (counts: any) => {
      let s = 0;
      (['easy', 'medium', 'hard'] as const).forEach(l => {
        const c = counts?.[l] ?? 0; if (!c) return;
        const sc = ls?.[l]; if (!sc) return;
        s += sc.type === 'level_specific' ? (sc.marksPerQuestion ?? 0) * c : sc.totalMarks ?? 0;
      });
      return s;
    };
    if (ct === 'levelBased') {
      const counts = formData.programmingConfig.levelBasedCounts ?? { easy: 0, medium: 0, hard: 0 };
      if ((counts.easy ?? 0) <= 0 || (counts.medium ?? 0) <= 0 || (counts.hard ?? 0) <= 0) return null;
      // All three levels must have marks configured — a level with count > 0 but 0 marks is invalid
      const missingMarks = (['easy', 'medium', 'hard'] as const).filter(l => {
        const c = counts[l] ?? 0; if (!c) return false;
        const sc = ls?.[l];
        if (!sc) return true;
        return sc.type === 'level_specific' ? !(sc.marksPerQuestion && sc.marksPerQuestion > 0) : !(sc.totalMarks && sc.totalMarks > 0);
      });
      if (missingMarks.length > 0) return `Please enter marks for: ${missingMarks.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')}`;
      const sum = getSum(counts); if (sum <= 0) return null;
      return isApproximatelyEqual(sum, total) ? null : `Level totals sum to ${sum} but total is ${total}.`;
    }
    if (ct === 'selectionLevel') {
      const counts = formData.programmingConfig.selectionLevelCounts ?? { easy: 0, medium: 0, hard: 0 };
      const active = (['easy', 'medium', 'hard'] as const).filter(l => (counts?.[l] ?? 0) > 0);
      if (!active.length) return null;
      const sum = getSum(counts); if (sum <= 0) return null;
      return isApproximatelyEqual(sum, total) ? null : `Selected totals sum to ${sum} but total is ${total}.`;
    }
    return null;
  }, [formData.exerciseType, formData.totalMarks, formData.totalMarksProgramming, formData.programmingConfig]);

  const othersAllocatedMarks = useMemo(() => {
    let m = 0;
    const oc = formData.othersConfig;
    if (oc.questionConfigType === 'general') { if (oc.scoreSettings.scoreType === 'equalDistribution') m = oc.generalQuestionCount * oc.scoreSettings.equalDistribution; }
    else {
      const counts = oc.questionConfigType === 'selectionLevel' ? oc.selectionLevelCounts : oc.levelBasedCounts;
      const ls = oc.scoreSettings.levelScoringConfiguration;
      (['easy', 'medium', 'hard'] as const).forEach(l => {
        const c = counts[l] || 0; if (!c) return;
        const s = ls[l];
        if (s) { if (s.type === 'level_specific' && s.marksPerQuestion) m += c * s.marksPerQuestion; else if (s.type === 'question_specific' && s.totalMarks) m += s.totalMarks; }
      });
    }
    return m;
  }, [formData.othersConfig]);



  // Add this helper near the top of ExerciseSettings (after the existing computed values)
  // Place it after the `othersAllocatedMarks` useMemo

  const levelTotalsFromConfig = useMemo(() => {
    const et = formData.exerciseType;
    if (et !== 'Programming' && et !== 'Other' && et !== 'Combined') return null;

    const cfg = et === 'Other' ? formData.othersConfig : formData.programmingConfig;
    const ct = cfg.questionConfigType;
    if (ct === 'general') return null;

    const counts = ct === 'selectionLevel'
      ? (cfg as any).selectionLevelCounts
      : (cfg as any).levelBasedCounts;

    const ls = cfg.scoreSettings?.levelScoringConfiguration;
    if (!ls) return null;

    const result: { easy: number; medium: number; hard: number } = { easy: 0, medium: 0, hard: 0 };

    (['easy', 'medium', 'hard'] as const).forEach(level => {
      const count = counts?.[level] ?? 0;
      if (!count) return;
      const s = ls[level];
      if (!s) return;
      if (s.type === 'level_specific' && s.marksPerQuestion) result[level] = count * s.marksPerQuestion;
      else if (s.type === 'question_specific' && s.totalMarks) result[level] = s.totalMarks;
    });

    // Only return if at least one level is non-zero
    if (result.easy === 0 && result.medium === 0 && result.hard === 0) return null;
    return result;
  }, [
    formData.exerciseType,
    formData.programmingConfig.questionConfigType,
    formData.programmingConfig.levelBasedCounts,
    formData.programmingConfig.selectionLevelCounts,
    formData.programmingConfig.scoreSettings?.levelScoringConfiguration,
    formData.othersConfig.questionConfigType,
    formData.othersConfig.levelBasedCounts,
    formData.othersConfig.selectionLevelCounts,
    formData.othersConfig.scoreSettings?.levelScoringConfiguration,
  ]);



  const othersLevelMismatch = useMemo((): string | null => {
    if (formData.exerciseType !== 'Other') return null;
    const ct = formData.othersConfig.questionConfigType;
    if (ct === 'general') return null;
    const total = formData.totalMarks ?? 0;
    if (total <= 0) return null;
    const ls = formData.othersConfig.scoreSettings?.levelScoringConfiguration;
    if (!ls) return null;
    const getSum = (counts: any) => {
      let s = 0;
      (['easy', 'medium', 'hard'] as const).forEach(l => {
        const c = counts?.[l] ?? 0; if (!c) return;
        const sc = ls?.[l]; if (!sc) return;
        s += sc.type === 'level_specific' ? (sc.marksPerQuestion ?? 0) * c : sc.totalMarks ?? 0;
      });
      return s;
    };
    if (ct === 'levelBased') {
      const counts = formData.othersConfig.levelBasedCounts ?? { easy: 0, medium: 0, hard: 0 };
      if ((counts.easy ?? 0) <= 0 || (counts.medium ?? 0) <= 0 || (counts.hard ?? 0) <= 0) return null;
      // All three levels must have marks configured — a level with count > 0 but 0 marks is invalid
      const missingMarks = (['easy', 'medium', 'hard'] as const).filter(l => {
        const c = counts[l] ?? 0; if (!c) return false;
        const sc = ls?.[l];
        if (!sc) return true;
        return sc.type === 'level_specific' ? !(sc.marksPerQuestion && sc.marksPerQuestion > 0) : !(sc.totalMarks && sc.totalMarks > 0);
      });
      if (missingMarks.length > 0) return `Please enter marks for: ${missingMarks.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')}`;
      const sum = getSum(counts); if (sum <= 0) return null;
      return isApproximatelyEqual(sum, total) ? null : `Level totals sum to ${sum} but total is ${total}.`;
    }
    if (ct === 'selectionLevel') {
      const counts = formData.othersConfig.selectionLevelCounts ?? { easy: 0, medium: 0, hard: 0 };
      const active = (['easy', 'medium', 'hard'] as const).filter(l => (counts?.[l] ?? 0) > 0);
      if (!active.length) return null;
      const sum = getSum(counts); if (sum <= 0) return null;
      return isApproximatelyEqual(sum, total) ? null : `Selected totals sum to ${sum} but total is ${total}.`;
    }
    return null;
  }, [formData.exerciseType, formData.totalMarks, formData.othersConfig]);

  // ── Phase 1: strict pattern-total validators ────────────────────────────────
  // When patternTotal > 0 in Level-Based / Selection-Level modes, enforce
  // E + M + H === patternTotal. Returns an error string or null.
  const patternTotalMismatch = useMemo((): { config: 'programming' | 'others'; message: string } | null => {
    const et = formData.exerciseType;
    if (et !== 'Programming' && et !== 'Combined' && et !== 'Other') return null;

    const check = (
      cfg: { questionConfigType: string; patternTotal?: number; levelBasedCounts: { easy: number; medium: number; hard: number }; selectionLevelCounts: { easy: number; medium: number; hard: number } },
      configLabel: 'programming' | 'others',
    ): { config: 'programming' | 'others'; message: string } | null => {
      const target = cfg.patternTotal ?? 0;
      if (target <= 0) return null;
      const ct = cfg.questionConfigType;
      if (ct !== 'levelBased' && ct !== 'selectionLevel') return null;
      const counts = ct === 'levelBased' ? cfg.levelBasedCounts : cfg.selectionLevelCounts;
      const sum = (counts?.easy ?? 0) + (counts?.medium ?? 0) + (counts?.hard ?? 0);
      if (sum === target) return null;
      const diff = target - sum;
      const msg = diff > 0
        ? `Easy + Medium + Hard (${sum}) is ${diff} short of Total (${target}).`
        : `Easy + Medium + Hard (${sum}) exceeds Total (${target}) by ${Math.abs(diff)}.`;
      return { config: configLabel, message: msg };
    };

    if (et === 'Other') return check(formData.othersConfig as any, 'others');
    return check(formData.programmingConfig as any, 'programming');
  }, [
    formData.exerciseType,
    formData.programmingConfig.patternTotal,
    formData.programmingConfig.questionConfigType,
    formData.programmingConfig.levelBasedCounts,
    formData.programmingConfig.selectionLevelCounts,
    (formData.othersConfig as any).patternTotal,
    formData.othersConfig.questionConfigType,
    formData.othersConfig.levelBasedCounts,
    formData.othersConfig.selectionLevelCounts,
  ]);

  // RESTORED: levelBasedWarningBadge
  const levelBasedWarningBadge = useMemo((): React.ReactNode | null => {
    const configType = formData.programmingConfig.questionConfigType;
    if (configType !== 'levelBased') return null;
    const c = formData.programmingConfig.levelBasedCounts;
    const filled = [c.easy, c.medium, c.hard].filter(v => v > 0).length;
    if (filled === 0 || filled === 3) return null;
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
        style={{ background: D.amber + '15', border: `1px solid ${D.amber}30`, color: D.amber }}>
        <AlertCircle size={10} />All 3 levels required
      </span>
    );
  }, [formData.programmingConfig.questionConfigType, formData.programmingConfig.levelBasedCounts]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getEntityType = useCallback((nt: string) => {
    const m: Record<string, any> = { module: 'modules', submodule: 'submodules', topic: 'topics', subtopic: 'subtopics' };
    return m[nt?.toLowerCase()] || 'topics';
  }, []);

  const getBreadcrumbs = useCallback(() => {
    const c: { name: string; type: string }[] = [];
    if (hierarchyData.courseName?.trim()) c.push({ name: hierarchyData.courseName, type: 'course' });
    if (hierarchyData.moduleName?.trim()) c.push({ name: hierarchyData.moduleName, type: 'module' });
    if (hierarchyData.submoduleName?.trim()) c.push({ name: hierarchyData.submoduleName, type: 'submodule' });
    if (hierarchyData.topicName?.trim()) c.push({ name: hierarchyData.topicName, type: 'topic' });
    if (hierarchyData.subtopicName?.trim()) c.push({ name: hierarchyData.subtopicName, type: 'subtopic' });
    // The last two answer "which activity am I authoring?", which the course
    // path alone does not: the same topic carries an I Do, a We Do and a You
    // Do, each with its own subcategories. Both arrive as keys ('We_Do',
    // 'assignment'), so they are titled for display here.
    if (tabType) c.push({ name: titleiseKey(tabType), type: 'tab' });
    if (subcategory?.trim()) c.push({ name: titleiseKey(subcategory), type: 'subcategory' });
    return c;
  }, [hierarchyData, tabType, subcategory]);

  const breadcrumbs = useMemo(() => getBreadcrumbs(), [getBreadcrumbs]);

  const getProgrammingTotalQuestions = useCallback(() => {
    if (formData.programmingConfig.questionConfigType === 'general') return formData.programmingConfig.generalQuestionCount;
    if (formData.programmingConfig.questionConfigType === 'levelBased') { const c = formData.programmingConfig.levelBasedCounts; return c.easy + c.medium + c.hard; }
    if (formData.programmingConfig.questionConfigType === 'selectionLevel') { const c = formData.programmingConfig.selectionLevelCounts; return c.easy + c.medium + c.hard; }
    return 0;
  }, [formData.programmingConfig]);

  const getOthersTotalQuestions = useCallback(() => {
    if (formData.othersConfig.questionConfigType === 'general') return formData.othersConfig.generalQuestionCount;
    if (formData.othersConfig.questionConfigType === 'levelBased') { const c = formData.othersConfig.levelBasedCounts; return c.easy + c.medium + c.hard; }
    if (formData.othersConfig.questionConfigType === 'selectionLevel') { const c = formData.othersConfig.selectionLevelCounts; return c.easy + c.medium + c.hard; }
    return 0;
  }, [formData.othersConfig]);

  // RESTORED: calculateAllocatedMarks
  const calculateAllocatedMarks = useCallback((): number => {
    if (formData.exerciseType === 'MCQ') return mcqAllocatedMarks;
    if (formData.exerciseType === 'Programming') return programmingAllocatedMarks;
    if (formData.exerciseType === 'Other') return othersAllocatedMarks;
    if (formData.exerciseType === 'Combined') return mcqAllocatedMarks + programmingAllocatedMarks;
    return 0;
  }, [formData.exerciseType, mcqAllocatedMarks, programmingAllocatedMarks, othersAllocatedMarks]);

  const validateTotalMarks = useCallback(() => {
    if (formData.exerciseType === 'Combined') return (mcqAllocatedMarks + programmingAllocatedMarks) === formData.totalMarks;
    if (formData.exerciseType === 'MCQ') { if (formData.mcqConfig.scoreSettings.scoreType === 'equalDistribution') return isApproximatelyEqual(mcqAllocatedMarks, formData.totalMarks); return true; }
    if (formData.exerciseType === 'Programming') return isApproximatelyEqual(programmingAllocatedMarks, formData.totalMarks);
    if (formData.exerciseType === 'Other') return isApproximatelyEqual(othersAllocatedMarks, formData.totalMarks);
    return false;
  }, [formData.exerciseType, mcqAllocatedMarks, programmingAllocatedMarks, othersAllocatedMarks, formData.totalMarks, formData.mcqConfig.scoreSettings.scoreType]);

  // ── Mark auto-population: sync grade fields from total marks ─────────────
  useEffect(() => {
    const et = formData.exerciseType;
    if (et === 'MCQ') {
      const mcqGrade = formData.totalMarks || null;
      setFormData(prev => ({ ...prev, grades: { ...prev.grades, mcqGrade } }));
    } else if (et === 'Programming') {
      const programmingGrade = programmingAllocatedMarks || null;
      setFormData(prev => ({ ...prev, grades: { ...prev.grades, programmingGrade } }));
    } else if (et === 'Other') {
      // Mark for Others is auto from totalMarks (same value shown in the disabled Mark field)
      const programmingGrade = formData.totalMarks || null;
      setFormData(prev => ({ ...prev, grades: { ...prev.grades, programmingGrade } }));
    } else if (et === 'Combined') {
      const mcqGrade = formData.totalMarksMCQ || null;
      const programmingGrade = programmingAllocatedMarks || null;
      const combinedGrade = ((formData.totalMarksMCQ || 0) + (formData.totalMarksProgramming || 0)) || null;
      setFormData(prev => ({ ...prev, grades: { ...prev.grades, mcqGrade, programmingGrade, combinedGrade } }));
    }
  }, [formData.exerciseType, formData.totalMarks, formData.totalMarksMCQ, formData.totalMarksProgramming, programmingAllocatedMarks]);

  // ── Validation functions ───────────────────────────────────────────────────
  const validateExerciseType = useCallback(() => (!formData.exerciseType ? 'Please select an exercise type' : undefined), [formData.exerciseType]);
  const validateModule = useCallback(() => {
    const e: any = {};
    if (!formData.selectedModule) e.module = 'Please select a module';
    if (!formData.selectedLanguages.length) e.languages = 'Please select at least one language';
    return e;
  }, [formData.selectedModule, formData.selectedLanguages]);

  const validateExerciseDetails = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    if (!formData.exerciseName.trim()) e.exerciseName = 'Exercise name is required';
    if (!formData.exerciseLevel) e.exerciseLevel = 'Difficulty level is required';  // ← add this

    if (formData.totalDuration <= 0) e.totalDuration = 'Duration must be greater than 0';

    // Skip marks validation for Non-Graded exercises
    if (formData.isGraded === false) return e;

    // For "Other" type, totalMarks is required but no module/language validation
    if (formData.exerciseType === 'Combined') {
      if (formData.totalMarksMCQ <= 0) e.totalMarksMCQ = 'MCQ total marks must be greater than 0';
      if (formData.totalMarksProgramming <= 0) e.totalMarksProgramming = 'Programming total marks must be greater than 0';
    } else if (formData.exerciseType === 'Other') {
      if (formData.totalMarks <= 0) e.totalMarks = 'Total marks must be greater than 0';
    } else if (formData.totalMarks <= 0) {
      e.totalMarks = 'Total marks must be greater than 0';
    }

    return e;
  }, [formData.exerciseName, formData.exerciseLevel, formData.totalDuration, formData.totalMarks, formData.exerciseType, formData.totalMarksMCQ, formData.totalMarksProgramming, formData.isGraded]);

  const validateMCQConfiguration = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    const isCombined = formData.exerciseType === 'Combined';
    if (formData.isGraded === false) {
      if (formData.mcqConfig.generalQuestionCount <= 0) e.mcqGeneralQuestionCount = 'Number of questions must be greater than 0';
      return e;
    }
    if (formData.mcqConfig.scoreSettings.scoreType === 'equalDistribution') {
      if (formData.mcqConfig.generalQuestionCount <= 0) e.mcqGeneralQuestionCount = 'Number of questions must be greater than 0';
      if (formData.mcqConfig.scoreSettings.equalDistribution <= 0) { e.mcqMarksPerQuestion = 'Marks per question must be greater than 0'; }
      else {
        const alloc = formData.mcqConfig.generalQuestionCount * formData.mcqConfig.scoreSettings.equalDistribution;
        if (isCombined) { if (!isApproximatelyEqual(alloc, formData.totalMarksMCQ)) e.mcqTotalMarks = `MCQ allocated (${alloc.toFixed(2)}) must equal MCQ total (${formData.totalMarksMCQ})`; }
        else { if (!isApproximatelyEqual(alloc, formData.totalMarks)) e.totalMarks = `Total marks (${formData.totalMarks}) must equal MCQ marks (${alloc.toFixed(2)})`; }
      }
    } else {
      if (isCombined && formData.totalMarksMCQ <= 0) e.mcqTotalMarks = 'MCQ total marks must be greater than 0';
      if (!isCombined) {
        if (!formData.mcqConfig.scoreSettings.totalMarks || !isApproximatelyEqual(formData.mcqConfig.scoreSettings.totalMarks, formData.totalMarks))
          e.totalMarks = `Total marks (${formData.totalMarks}) must equal MCQ total marks`;
      }
    }
    return e;
  }, [formData.mcqConfig, formData.exerciseType, formData.totalMarks, formData.totalMarksMCQ, formData.isGraded]);

  const validateProgrammingConfiguration = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    const isCombined = formData.exerciseType === 'Combined';
    const tot = isCombined ? formData.totalMarksProgramming : formData.totalMarks;

    if (!formData.programmingConfig.questionConfigType) {
      e.programmingGeneralQuestionCount = 'Please select a Config Strategy';
      return e;
    }

    if (formData.programmingConfig.questionConfigType === 'general') {
      if (formData.programmingConfig.generalQuestionCount <= 0)
        e.programmingGeneralQuestionCount = 'Number of questions must be greater than 0';
      if (formData.isGraded === false) return e;
    } else {
      if (formData.isGraded === false) {
        const counts = formData.programmingConfig.questionConfigType === 'selectionLevel'
          ? formData.programmingConfig.selectionLevelCounts
          : formData.programmingConfig.levelBasedCounts;
        if (formData.programmingConfig.questionConfigType === 'levelBased') {
          if (counts.easy <= 0) e.programmingLevelCounts_Easy = 'Easy count required';
          if (counts.medium <= 0) e.programmingLevelCounts_Medium = 'Medium count required';
          if (counts.hard <= 0) e.programmingLevelCounts_Hard = 'Hard count required';
        } else if (!(['easy', 'medium', 'hard'] as const).some(l => counts[l] > 0)) {
          e.programmingLevelCounts = 'Select at least one difficulty level';
        }
        return e;
      }
    }

    // Early return if no total marks to validate against
    if (tot <= 0) return e;

    if (formData.programmingConfig.questionConfigType === 'general') {
      // Validate question count
      if (formData.programmingConfig.generalQuestionCount <= 0) {
        e.programmingGeneralQuestionCount = 'Number of questions must be greater than 0';
      }

      if (formData.programmingConfig.scoreSettings.scoreType === 'equalDistribution') {
        const eq = formData.programmingConfig.scoreSettings.equalDistribution;

        // Only validate marks if question count is valid
        if (formData.programmingConfig.generalQuestionCount > 0) {
          if (!eq || eq <= 0) {
            e.programmingMarksPerQuestion = 'Marks per question must be greater than 0';
          } else {
            const alloc = formData.programmingConfig.generalQuestionCount * eq;
            if (!isApproximatelyEqual(alloc, tot) && tot > 0) {
              e.programmingTotalMarks = `Allocated (${alloc.toFixed(2)}) must equal total (${tot})`;
            }
          }
        }
      }
    } else if (formData.programmingConfig.questionConfigType === 'levelBased') {
      const counts = formData.programmingConfig.levelBasedCounts;

      // Validate counts
      if (counts.easy <= 0) e.programmingLevelCounts_Easy = 'Easy count required';
      if (counts.medium <= 0) e.programmingLevelCounts_Medium = 'Medium count required';
      if (counts.hard <= 0) e.programmingLevelCounts_Hard = 'Hard count required';

      // Check if any counts are provided
      if (counts.easy <= 0 && counts.medium <= 0 && counts.hard <= 0) {
        e.programmingLevelCounts = 'At least one question count must be greater than 0';
      }

      // Validate scoring configuration
      const ls = formData.programmingConfig.scoreSettings.levelScoringConfiguration;
      const le: Record<string, string> = {};

      (['easy', 'medium', 'hard'] as const).forEach(level => {
        if (counts[level] <= 0) return;
        const s = ls[level];
        if (!s) {
          le[level] = 'Scoring not configured';
          return;
        }
        if (s.type === 'level_specific' && (!s.marksPerQuestion || s.marksPerQuestion <= 0)) {
          le[level] = 'Marks per question must be > 0';
        } else if (s.type === 'question_specific' && (!s.totalMarks || s.totalMarks <= 0)) {
          le[level] = 'Total marks must be > 0';
        }
      });

      if (Object.keys(le).length) e.programmingLevelScoring = le;

    } else if (formData.programmingConfig.questionConfigType === 'selectionLevel') {
      const counts = formData.programmingConfig.selectionLevelCounts;
      const active = (['easy', 'medium', 'hard'] as const).filter(l => counts[l] > 0);

      if (!active.length) {
        e.programmingLevelCounts = 'Select at least one difficulty level and provide question count';
        return e;
      }

      const ls = formData.programmingConfig.scoreSettings.levelScoringConfiguration;
      const le: Record<string, string> = {};

      active.forEach(level => {
        const s = ls[level];
        if (!s) {
          le[level] = 'Scoring not configured';
          return;
        }
        if (s.type === 'level_specific' && (!s.marksPerQuestion || s.marksPerQuestion <= 0)) {
          le[level] = 'Marks per question must be > 0';
        } else if (s.type === 'question_specific' && (!s.totalMarks || s.totalMarks <= 0)) {
          le[level] = 'Total marks must be > 0';
        }
      });

      if (Object.keys(le).length) e.programmingLevelScoring = le;
    }

    return e;
  }, [formData.programmingConfig, formData.totalMarks, formData.totalMarksProgramming, formData.exerciseType, formData.isGraded]);

  const validateOthersConfiguration = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    const tot = formData.totalMarks;
    if (tot <= 0) return e;

    const oc = formData.othersConfig;

    if (oc.questionConfigType === 'general') {
      if (oc.generalQuestionCount <= 0) {
        e.othersGeneralQuestionCount = 'Number of questions must be greater than 0';
      }
      if (oc.scoreSettings.scoreType === 'equalDistribution') {
        const eq = oc.scoreSettings.equalDistribution;
        if (oc.generalQuestionCount > 0) {
          if (!eq || eq <= 0) {
            e.othersMarksPerQuestion = 'Marks per question must be greater than 0';
          } else {
            const alloc = oc.generalQuestionCount * eq;
            if (!isApproximatelyEqual(alloc, tot) && tot > 0) {
              e.othersTotalMarks = `Allocated (${alloc.toFixed(2)}) must equal total (${tot})`;
            }
          }
        }
      }
    } else if (oc.questionConfigType === 'levelBased') {
      const counts = oc.levelBasedCounts;
      if (counts.easy <= 0) e.othersLevelCounts_Easy = 'Easy count required';
      if (counts.medium <= 0) e.othersLevelCounts_Medium = 'Medium count required';
      if (counts.hard <= 0) e.othersLevelCounts_Hard = 'Hard count required';

      if (counts.easy <= 0 && counts.medium <= 0 && counts.hard <= 0) {
        e.othersLevelCounts = 'At least one question count must be greater than 0';
      }

      const ls = oc.scoreSettings.levelScoringConfiguration;
      const le: Record<string, string> = {};
      (['easy', 'medium', 'hard'] as const).forEach(level => {
        if (counts[level] <= 0) return;
        const s = ls[level];
        if (!s) { le[level] = 'Scoring not configured'; return; }
        if (s.type === 'level_specific' && (!s.marksPerQuestion || s.marksPerQuestion <= 0)) {
          le[level] = 'Marks per question must be > 0';
        } else if (s.type === 'question_specific' && (!s.totalMarks || s.totalMarks <= 0)) {
          le[level] = 'Total marks must be > 0';
        }
      });
      if (Object.keys(le).length) e.othersLevelScoring = le;

    } else if (oc.questionConfigType === 'selectionLevel') {
      const counts = oc.selectionLevelCounts;
      const active = (['easy', 'medium', 'hard'] as const).filter(l => counts[l] > 0);
      if (!active.length) {
        e.othersLevelCounts = 'Select at least one difficulty level and provide question count';
        return e;
      }
      const ls = oc.scoreSettings.levelScoringConfiguration;
      const le: Record<string, string> = {};
      active.forEach(level => {
        const s = ls[level];
        if (!s) { le[level] = 'Scoring not configured'; return; }
        if (s.type === 'level_specific' && (!s.marksPerQuestion || s.marksPerQuestion <= 0)) {
          le[level] = 'Marks per question must be > 0';
        } else if (s.type === 'question_specific' && (!s.totalMarks || s.totalMarks <= 0)) {
          le[level] = 'Total marks must be > 0';
        }
      });
      if (Object.keys(le).length) e.othersLevelScoring = le;
    }

    return e;
  }, [formData.othersConfig, formData.totalMarks]);
  // RESTORED: validateCombinedMode
  const validateCombinedMode = useCallback((): ValidationErrors => {
    const errors: ValidationErrors = {};
    if (!isApproximatelyEqual(mcqAllocatedMarks, formData.totalMarksMCQ)) {
      errors.mcqTotalMarks = `MCQ allocated (${mcqAllocatedMarks.toFixed(2)}) must equal MCQ total marks (${formData.totalMarksMCQ})`;
    }
    if (!isApproximatelyEqual(programmingAllocatedMarks, formData.totalMarksProgramming)) {
      errors.programmingTotalMarks = `Programming allocated (${programmingAllocatedMarks.toFixed(2)}) must equal Programming total marks (${formData.totalMarksProgramming})`;
    }
    return errors;
  }, [mcqAllocatedMarks, programmingAllocatedMarks, formData.totalMarksMCQ, formData.totalMarksProgramming]);

  const validateSchedule = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    const sd = formData.schedule.startDate;
    const ed = (formData.schedule as any).endDate;      // submission deadline
    const cod = (formData.schedule as any).cutOffDate;   // optional late boundary
    const gd = formData.schedule.gracePeriodDate;

    const startSelected = sd.day > 0 && sd.month > 0 && sd.year > 0;
    const endSelected = ed && ed.day > 0 && ed.month > 0 && ed.year > 0;
    const cutOffSelected = cod && cod.day > 0 && cod.month > 0 && cod.year > 0;
    const graceSelected = gd.day > 0 && gd.month > 0 && gd.year > 0;

    // Start Date validation
    if (!startSelected) {
      e.startDate = 'Start date & time is required';
    } else if (!isEditing) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDay = new Date(sd.year, sd.month - 1, sd.day);
      startDay.setHours(0, 0, 0, 0);
      if (startDay < today) e.startDate = 'Start date cannot be in the past';
    }

    // End Date (submission deadline) validation — always required
    if (!endSelected) {
      e.endDate = 'End date & time is required';
    } else if (startSelected) {
      const startDT0 = new Date(sd.year, sd.month - 1, sd.day, sd.hour || 0, sd.minute || 0);
      const endDT0 = new Date(ed.year, ed.month - 1, ed.day, ed.hour || 0, ed.minute || 0);
      if (endDT0 <= startDT0) e.endDate = 'End date & time must be after start date & time';
    }

    // Cut-off Date validation — only when toggle is enabled
    if ((formData.schedule as any).cutOffEnabled) {
      if (!cutOffSelected) {
        e.cutOffDate = 'Cut-off date & time is required';
      } else if (endSelected) {
        const endDT = new Date(ed.year, ed.month - 1, ed.day, ed.hour || 0, ed.minute || 0);
        const codDT = new Date(cod.year, cod.month - 1, cod.day, cod.hour ?? 23, cod.minute ?? 59);
        if (codDT <= endDT) {
          e.cutOffDate = 'Cut-off date & time must be after end date & time';
        }
      }
    }

    // Grace Period validation
    if (formData.schedule.gracePeriodEnabled) {
      if (!graceSelected) {
        e.gracePeriod = 'Grace period date & time is required';
      } else if (cutOffSelected && (formData.schedule as any).cutOffEnabled) {
        const codDT = new Date(cod.year, cod.month - 1, cod.day, cod.hour ?? 23, cod.minute ?? 59);
        const graceDT = new Date(gd.year, gd.month - 1, gd.day, gd.hour ?? 23, gd.minute ?? 59);
        if (codDT >= graceDT) {
          e.gracePeriod = 'Grace period must be after cut-off date & time';
        }
      }
    }

    return e;
  }, [formData.schedule, isEditing]);

  const validateGradeSettings = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    if (formData.isGraded === false) return e;
    const et = formData.exerciseType;
    const g = formData.grades;

    // If difficulty pass is enabled, skip the top-level Mark to Pass validation
    const skipTopLevelPass = g.difficultyPassEnabled;

    if (et === 'MCQ') {
      const autoGrade = formData.totalMarks;
      // Mark to Pass is optional — only validate "cannot exceed" when provided
      if (g.mcqGradeToPass && autoGrade > 0 && g.mcqGradeToPass > autoGrade) {
        e.mcqGradeToPass = `Cannot exceed Mark (${autoGrade})`;
      }
    }

    if (et === 'Programming') {
      if (!g.programmingGrade || g.programmingGrade <= 0) e.programmingGrade = 'Mark is required';
      // Mark to Pass is optional — only validate "cannot exceed" when provided
      if (g.programmingGradeToPass && g.programmingGrade && g.programmingGradeToPass > g.programmingGrade) {
        e.programmingGradeToPass = `Cannot exceed Mark (${g.programmingGrade})`;
      }
    }

    if (et === 'Other') {
      const autoGrade = formData.totalMarks || 0;
      // Mark to Pass is optional — only validate "cannot exceed" when provided
      if (g.programmingGradeToPass && autoGrade > 0 && g.programmingGradeToPass > autoGrade) {
        e.programmingGradeToPass = `Cannot exceed Mark (${autoGrade})`;
      }
    }

    if (et === 'Combined') {
      if (g.separateMarks) {
        const autoMCQ = formData.totalMarksMCQ || 0;
        const autoProg = formData.totalMarksProgramming || 0;
        // Mark to Pass is optional — only validate "cannot exceed" when provided
        if (g.mcqGradeToPass && autoMCQ > 0 && g.mcqGradeToPass > autoMCQ)
          e.mcqGradeToPass = `Cannot exceed MCQ Mark (${autoMCQ})`;
        if (g.programmingGradeToPass && autoProg > 0 && g.programmingGradeToPass > autoProg)
          e.programmingGradeToPass = `Cannot exceed Programming Mark (${autoProg})`;
      } else {
        const autoGrade = (formData.totalMarksMCQ || 0) + (formData.totalMarksProgramming || 0);
        // Mark to Pass is optional — only validate "cannot exceed" when provided
        if (g.combinedGradeToPass && autoGrade > 0 && g.combinedGradeToPass > autoGrade) {
          e.combinedGradeToPass = `Cannot exceed Mark (${autoGrade})`;
        }
      }
    }

    // Difficulty pass marks validation (unchanged)
    if (g.difficultyPassEnabled && levelTotalsFromConfig) {
      (['easy', 'medium', 'hard'] as const).forEach(level => {
        const total = levelTotalsFromConfig[level];
        if (!total) return;
        const passKey = `${level}PassMark` as 'easyPassMark' | 'mediumPassMark' | 'hardPassMark';
        const val = g[passKey];
        if (!val || val <= 0) {
          (e as any)[`${level}PassMark`] = `${level.charAt(0).toUpperCase() + level.slice(1)} pass mark is required`;
        } else if (val > total) {
          (e as any)[`${level}PassMark`] = `Cannot exceed ${level} total (${total})`;
        }
      });
    }

    return e;
  }, [formData.grades, formData.exerciseType, formData.totalMarks, formData.totalMarksMCQ, formData.totalMarksProgramming, levelTotalsFromConfig, formData.isGraded]);
  // ── Step completion tracking ───────────────────────────────────────────────
  const isStepCompleted = useCallback((stepId: number): boolean => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return false;

    switch (step.title) {
      case 'Exercise Details': {
        if (!formData.exerciseType) return false;
        if ((formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') &&
          (!formData.selectedModule || formData.selectedLanguages.length === 0)) return false;
        const base = !!(formData.exerciseName?.trim() && formData.totalDuration > 0);
        if (formData.exerciseType === 'Combined') {
          return base && formData.totalMarksMCQ > 0 && formData.totalMarksProgramming > 0;
        }
        if (formData.exerciseType === 'Other') {
          return base && formData.totalMarks > 0;
        }
        return base && formData.totalMarks > 0;
      }
      // ... rest of cases
    }
  }, [steps, formData, validateProgrammingConfiguration, programmingLevelMismatch,
    validateOthersConfiguration, othersLevelMismatch, validateGradeSettings, completedSteps]);

  const progressPercent = useMemo(() => {
    if (isLocked) return 100;
    if (steps.length === 0) return 0;
    // 🔥 Use savedSteps instead of completedSteps for progress
    const done = steps.filter(s => savedSteps.has(s.title)).length;
    return Math.min(99, Math.round((done / steps.length) * 100));
  }, [steps, savedSteps, isLocked]);
  const isFullyCompleted = isLocked;

  const markTouched = useCallback((f: string) => setTouchedFields(prev => new Set(prev).add(f)), []);
  const markAllTouched = useCallback((fields: string[]) => setTouchedFields(prev => { const n = new Set(prev); fields.forEach(f => n.add(f)); return n; }), []);

  const validateCurrentStep = useCallback((): boolean => {
    const step = steps.find(s => s.id === currentStep);
    if (!step) return true;
    let errors: ValidationErrors = {};
    const fields: string[] = [];

    switch (step.title) {
      case 'Exercise Details': {
        if (!formData.exerciseType) {
          errors.exerciseType = 'Please select an exercise type';
          fields.push('exerciseType');
        }

        // Validate module/languages for Programming and Combined
        if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
          if (!formData.selectedModule) {
            errors.selectedModule = 'Please select a module';
            fields.push('selectedModule');
          }
          if (formData.selectedLanguages.length === 0) {
            errors.selectedLanguages = 'Please select at least one language';
            fields.push('selectedLanguages');
          }
        }

        errors = { ...errors, ...validateExerciseDetails() };
        fields.push('exerciseName', 'exerciseLevel', 'totalDuration', 'totalMarks');
        if (formData.exerciseType === 'Combined') fields.push('totalMarksMCQ', 'totalMarksProgramming');
        break;
      }
      case 'Question Configuration': {
        if (formData.exerciseType === 'MCQ' || formData.exerciseType === 'Combined') {
          errors = { ...errors, ...validateMCQConfiguration() };
          fields.push('mcqGeneralQuestionCount', 'mcqMarksPerQuestion', 'mcqTotalMarks');
        }
        if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
          errors = { ...errors, ...validateProgrammingConfiguration() };
          if (formData.isGraded !== false && programmingLevelMismatch) errors.programmingTotalMarks = programmingLevelMismatch;
          fields.push('programmingGeneralQuestionCount', 'programmingMarksPerQuestion',
            'programmingLevelCounts', 'programmingLevelCounts_Easy',
            'programmingLevelCounts_Medium', 'programmingLevelCounts_Hard', 'programmingTotalMarks');
        }
        if (formData.exerciseType === 'Other') {
          errors = { ...errors, ...validateOthersConfiguration() };
          if (formData.isGraded !== false && othersLevelMismatch) errors.othersTotalMarks = othersLevelMismatch;
          fields.push('othersGeneralQuestionCount', 'othersMarksPerQuestion',
            'othersLevelCounts', 'othersLevelCounts_Easy',
            'othersLevelCounts_Medium', 'othersLevelCounts_Hard', 'othersTotalMarks');
        }
        break;
      }
      // Schedule, Notification — free, no validation
      default:
        return true;
    }

    setValidationErrors(prev => ({ ...prev, ...errors }));
    markAllTouched(fields);
    return Object.keys(errors).length === 0;
  }, [currentStep, steps, formData.exerciseType, formData.selectedModule, formData.selectedLanguages, formData.isGraded,
    validateExerciseDetails, validateMCQConfiguration, validateProgrammingConfiguration, validateOthersConfiguration,
    markAllTouched, programmingLevelMismatch, othersLevelMismatch]);

  // ── buildFullPayload — shared by step-save and handleComplete ───────────────
  const buildFullPayload = useCallback(() => {
    // Convert the user's LOCAL date/time pieces into an unambiguous UTC
    // ISO string. Previously this returned a bare `"YYYY-MM-DDTHH:mm"`
    // with no timezone marker, so each runtime read it differently:
    // the browser as local time, the Node server as its local time, the
    // DB as UTC. That's what turned "18:00 today" (IST) into
    // "23:34" on the student side — the server treated the naive string
    // as UTC and the browser then rendered it back as local (+5:30).
    // `new Date(y, m-1, d, h, mi)` creates a Date in the trainer's LOCAL
    // clock; `.toISOString()` emits a proper `…Z` UTC value that every
    // consumer (server, DB, student's `new Date(iso)`) agrees on.
    const toIso = (y: number, m: number, d: number, h: number, mi: number) =>
      new Date(y, m - 1, d, h, mi).toISOString();
    const sd = formData.schedule.startDate;
    const startDT = (sd.day > 0 && sd.month > 0 && sd.year > 0)
      ? toIso(sd.year, sd.month, sd.day, sd.hour || 0, sd.minute || 0)
      : null;
    const ed = (formData.schedule as any).endDate;
    const endDT = (ed && ed.day > 0 && ed.month > 0 && ed.year > 0)
      ? toIso(ed.year, ed.month, ed.day, ed.hour || 0, ed.minute || 0)
      : null;
    const cod = (formData.schedule as any).cutOffDate;
    const cutOffDT = (cod && cod.day > 0 && cod.month > 0 && cod.year > 0)
      ? toIso(cod.year, cod.month, cod.day, cod.hour || 23, cod.minute || 59)
      : null;
    const gd = formData.schedule.gracePeriodDate;
    const graceDT = (formData.schedule.gracePeriodEnabled && gd.day > 0 && gd.month > 0 && gd.year > 0)
      ? toIso(gd.year, gd.month, gd.day, gd.hour || 23, gd.minute || 59)
      : null;
    const rgb = (formData.schedule as any).remindGradeBy;
    const remindDT = (rgb && rgb.day > 0 && rgb.month > 0 && rgb.year > 0 && (formData.schedule as any).remindGradeByEnabled)
      ? toIso(rgb.year, rgb.month, rgb.day, rgb.hour || 0, rgb.minute || 0)
      : null;

    let mcqTotalMarks = 0;
    let progTotalMarks = 0;
    if (formData.exerciseType === 'MCQ' || formData.exerciseType === 'Combined') {
      mcqTotalMarks = formData.mcqConfig.scoreSettings.scoreType === 'equalDistribution'
        ? formData.mcqConfig.generalQuestionCount * (formData.mcqConfig.scoreSettings.equalDistribution || 0)
        : formData.mcqConfig.scoreSettings.totalMarks || 0;
    }
    if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
      progTotalMarks = programmingAllocatedMarks;
    }

    const payload: any = {
      tabType,
      subcategory,
      exerciseType: formData.exerciseType,
      configurationType: {
        mcqMode: formData.exerciseType === 'MCQ' || formData.exerciseType === 'Combined',
        programmingMode: formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined',
        combinedMode: formData.exerciseType === 'Combined',
        otherMode: formData.exerciseType === 'Other',
      },
      isGraded: formData.isGraded !== false,
      // Top-level author instructions — persists via the controller's
      // existing whitelist (exerciseSchema is strict:false so no schema
      // change is needed). Empty string is legal — the pre-start page
      // will auto-generate from settings when nothing is authored.
      instructions: formData.instructions || '',
      stepsSaved: [...savedSteps],
      // Phase 2 — teacher's chosen question source (empty until picked).
      questionSource: questionSource || null,
      // Phase 5 — custom-mode distribution (only meaningful when source === 'custom').
      customDistribution: questionSource === 'custom' ? customDistribution : null,
      // Custom-mode sub-source selection (which of Scratch/AI/ThirdParty to combine).
      customSources: questionSource === 'custom' ? customSources : [],
      // Phase 6 — teacher's Save-to-Bank preference for questions attached here.
      saveToBank,
      // Evaluation method. Always sent so a later MCQ→Programming type
      // switch already has a coherent config in place.
      evaluationMethod: formData.evaluationMethod,
      // Combined-only: the MCQ part's own source (null = same as programming)
      // and its single-cell Custom split. OMITTED (not nulled) while Custom is
      // mis-configured (<2 sub-sources) — the footer Save has no step gate, so
      // omission keeps the stored values instead of persisting an unusable
      // state (the server preserves absent fields). Non-Combined always sends
      // the null trio so a type switch clears any Combined leftovers.
      ...(formData.exerciseType !== 'Combined'
        ? { questionSourceMcq: null, customSourcesMcq: [], customDistributionMcq: null }
        : (questionSourceMcq !== 'custom' || customSourcesMcq.length >= 2
            ? {
                questionSourceMcq: questionSourceMcq || null,
                customSourcesMcq: questionSourceMcq === 'custom' ? customSourcesMcq : [],
                customDistributionMcq: questionSourceMcq === 'custom' ? customDistributionMcq : null,
              }
            : {})),
      exerciseInformation: {
        exerciseId: formData.exerciseId || `EX${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        exerciseName: formData.exerciseName,
        description: formData.description || '',
        exerciseLevel: formData.exerciseLevel || 'beginner',
        totalDuration: formData.totalDuration || 60,
        totalMarks: formData.isGraded === false ? null : formData.exerciseType === 'Combined'
          ? (formData.totalMarksMCQ + formData.totalMarksProgramming)
          : formData.totalMarks,
           totalMarksMCQ: formData.exerciseType === 'Combined' ? formData.totalMarksMCQ : 0,
      totalMarksProgramming: formData.exerciseType === 'Combined' ? formData.totalMarksProgramming : 0,
      },
      // ...(formData.exerciseType === 'Combined' && {
      //   totalMarksMCQ: formData.totalMarksMCQ,
      //   totalMarksProgramming: formData.totalMarksProgramming,
      // }),
      availabilityPeriod: {
        startDate: startDT,
        endDate: endDT,
        cutOffEnabled: !!(formData.schedule as any).cutOffEnabled,
        cutOffDate: (formData.schedule as any).cutOffEnabled ? cutOffDT : null,
        remindGradeByEnabled: !!(formData.schedule as any).remindGradeByEnabled,
        remindGradeBy: (formData.schedule as any).remindGradeByEnabled ? remindDT : null,
        gracePeriodEnabled: formData.schedule.gracePeriodEnabled,
        gracePeriodAllowed: formData.schedule.gracePeriodEnabled,
        ...(formData.schedule.gracePeriodEnabled && graceDT && { gracePeriodDate: graceDT }),
        extendedDays: 0,
        requiresAdminApproval: !!(formData.schedule as any).requiresAdminApproval,
        approvalScope: (formData.schedule as any).approvalScope === 'settings_and_questions'
          ? 'settings_and_questions'
          : 'settings',
      },
      notificationSettings: {
        // Global notification settings
        notifyUsers: formData.notifyUsers || false,
        notifyGmail: formData.notifyGmail || false,
        notifyWhatsApp: formData.notifyWhatsApp || false,
        gradeSheet: formData.gradeSheet !== undefined ? formData.gradeSheet : true,

        // Grader submissions with channel settings
        notifyGradersSubmissions: formData.notifications.notifyGradersSubmissions,
        notifyGradersSubmissionsChannels: {
          dashboard: formData.notifications.notifyGradersSubmissionsChannels?.dashboard ?? false,
          gmail: formData.notifications.notifyGradersSubmissionsChannels?.gmail ?? false,
          whatsapp: formData.notifications.notifyGradersSubmissionsChannels?.whatsapp ?? false,
        },

        // Grader late submissions with channel settings
        notifyGradersLateSubmissions: formData.notifications.notifyGradersLateSubmissions,
        notifyGradersLateSubmissionsChannels: {
          dashboard: formData.notifications.notifyGradersLateSubmissionsChannels?.dashboard ?? false,
          gmail: formData.notifications.notifyGradersLateSubmissionsChannels?.gmail ?? false,
          whatsapp: formData.notifications.notifyGradersLateSubmissionsChannels?.whatsapp ?? false,
        },

        // Student notifications with channel settings
        notifyStudent: formData.notifications.notifyStudent,
        notifyStudentChannels: {
          dashboard: formData.notifications.notifyStudentChannels?.dashboard ?? false,
          gmail: formData.notifications.notifyStudentChannels?.gmail ?? false,
          whatsapp: formData.notifications.notifyStudentChannels?.whatsapp ?? false,
        },
      },
      // FIXED: always send all grade fields, never conditionally strip difficulty pass marks
      gradeSettings: {
        mcqGrade: formData.grades.mcqGrade || null,
        mcqGradeToPass: formData.grades.mcqGradeToPass ? Number(formData.grades.mcqGradeToPass) : null,
        programmingGrade: formData.grades.programmingGrade || null,
        programmingGradeToPass: formData.grades.programmingGradeToPass ? Number(formData.grades.programmingGradeToPass) : null,
        combinedGrade: formData.grades.combinedGrade || null,
        combinedGradeToPass: formData.grades.combinedGradeToPass ? Number(formData.grades.combinedGradeToPass) : null,
        separateMarks: formData.grades.separateMarks ?? false,
        difficultyPassEnabled: formData.grades.difficultyPassEnabled ?? false,
        easyPassMark: formData.grades.easyPassMark !== null ? Number(formData.grades.easyPassMark) : null,
        mediumPassMark: formData.grades.mediumPassMark !== null ? Number(formData.grades.mediumPassMark) : null,
        hardPassMark: formData.grades.hardPassMark !== null ? Number(formData.grades.hardPassMark) : null,
        // MCQ per-difficulty pass marks (Combined exercise: MCQ + Programming stored separately).
        mcqEasyPassMark: formData.grades.mcqEasyPassMark !== null ? Number(formData.grades.mcqEasyPassMark) : null,
        mcqMediumPassMark: formData.grades.mcqMediumPassMark !== null ? Number(formData.grades.mcqMediumPassMark) : null,
        mcqHardPassMark: formData.grades.mcqHardPassMark !== null ? Number(formData.grades.mcqHardPassMark) : null,
        overallMarkToPassEnabled: formData.grades.overallMarkToPassEnabled ?? false,
        overallMarkToPass: formData.grades.overallMarkToPassEnabled && formData.grades.overallMarkToPass !== null ? Number(formData.grades.overallMarkToPass) : null,
        // Grade bands (labelled % ranges) — persisted so editing restores them.
        // Send undefined (not []) when empty so saved exercises keep falling back
        // to the recommended defaults instead of persisting an empty scale.
        gradeBands: Array.isArray((formData.grades as any).gradeBands) && (formData.grades as any).gradeBands.length
          ? (formData.grades as any).gradeBands
          : undefined,
      },
      additionalOptions: {
        anonymousSubmissions: formData.additionalOptions.anonymousSubmissions,
        hideGraderIdentity: formData.additionalOptions.hideGraderIdentity,
      },
      questionBehavior: {
        allQuestionsRequired: formData.allQuestionsRequired,
      },
      questions: [],
    };

    if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
      payload.programmingSettings = {
        selectedModule: formData.selectedModule || '',
        selectedLanguages: formData.selectedLanguages || [],
      };
    }

    const buildProgConfig = (pc: typeof formData.programmingConfig, sTotal: number) => {
      let bst = 'evenMarks';
      if (pc.questionConfigType === 'levelBased' || pc.questionConfigType === 'selectionLevel') {
        bst = 'levelBasedMarks';
      } else if (pc.scoreSettings?.scoreType === 'equalDistribution') {
        bst = 'evenMarks';
      } else if (pc.scoreSettings?.scoreType === 'questionSpecific') {
        bst = 'separateMarks';
      } else if (pc.scoreSettings?.scoreType === 'levelSpecific') {
        bst = 'levelBasedMarks';
      }

      // FIX: always derive questionCount from the actual count fields, never trust stale DB value
      const actualCounts =
        pc.questionConfigType === 'levelBased'
          ? pc.levelBasedCounts
          : pc.questionConfigType === 'selectionLevel'
            ? pc.selectionLevelCounts
            : { easy: 0, medium: 0, hard: 0 };

      const rawLsc = pc.scoreSettings?.levelScoringConfiguration;
      const syncedLevelScoringConfig = rawLsc
        ? {
          easy: {
            ...(rawLsc.easy || { type: 'level_specific', marksPerQuestion: 0, totalMarks: undefined }),
            questionCount: actualCounts?.easy || 0,
          },
          medium: {
            ...(rawLsc.medium || { type: 'level_specific', marksPerQuestion: 0, totalMarks: undefined }),
            questionCount: actualCounts?.medium || 0,
          },
          hard: {
            ...(rawLsc.hard || { type: 'level_specific', marksPerQuestion: 0, totalMarks: undefined }),
            questionCount: actualCounts?.hard || 0,
          },
        }
        : undefined;

      const cfg: any = {
        questionConfigType: pc.questionConfigType,
        scoreSettings: {
          scoreType: bst,
          evenMarks:
            pc.scoreSettings?.scoreType === 'equalDistribution'
              ? pc.scoreSettings.equalDistribution
              : 0,
          separateMarks: pc.scoreSettings?.questionSpecific || {
            general: [],
            levelBased: { easy: [], medium: [], hard: [] },
          },
          levelBasedMarks: pc.scoreSettings?.levelBasedMarks || {
            easy: 0,
            medium: 0,
            hard: 0,
          },
          levelScoringConfiguration: syncedLevelScoringConfig,
          totalMarks: sTotal,
        },
        questionFlow: pc.questionFlow || 'freeFlow',
        attemptLimitEnabled: pc.attemptLimitEnabled || false,
        submissionAttempts: pc.submissionAttempts || 1,
        // Compiler file mode is no longer user-selectable — the backend always
        // receives 'multiple' as the default (UI selector was removed).
        compilerFileMode: 'multiple',
        allowCodeExecution: true,
        enableTestCases: true,
        showSampleCases: true,
      };

      if (pc.questionConfigType === 'general') {
        cfg.generalQuestionCount = pc.generalQuestionCount || 0;
        cfg.generalMarksPerQuestion = pc.scoreSettings?.equalDistribution || 0;
      } else if (pc.questionConfigType === 'levelBased') {
        cfg.levelBasedCounts = pc.levelBasedCounts || { easy: 0, medium: 0, hard: 0 };
      } else if (pc.questionConfigType === 'selectionLevel') {
        cfg.selectionLevelCounts = pc.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
      }

      // Phase 1 — persist the strict pattern target so it survives reload.
      if ((pc as any).patternTotal && (pc as any).patternTotal > 0) {
        cfg.patternTotal = (pc as any).patternTotal;
      }

      return cfg;
    };

    if (formData.exerciseType === 'MCQ') {
      payload.questionConfiguration = {
        mcqConfig: {
          questionConfigType: 'general',
          generalQuestionCount: formData.mcqConfig.generalQuestionCount || 0,
          scoreSettings: {
            scoreType: formData.mcqConfig.scoreSettings?.scoreType || 'equalDistribution',
            equalDistribution: formData.mcqConfig.scoreSettings?.equalDistribution || 0,
            totalMarks: mcqTotalMarks,
          },
          attemptLimitEnabled: formData.mcqConfig.attemptLimitEnabled || false,
          submissionAttempts: formData.mcqConfig.submissionAttempts || 1,
          mcqTotalMarks,
          marksPerQuestion: formData.mcqConfig.scoreSettings?.equalDistribution || 0,
          totalMcqQuestions: formData.mcqConfig.generalQuestionCount || 0,
          scoringType: formData.mcqConfig.scoreSettings?.scoreType || 'equalDistribution',
          shuffleQuestions: true,
        },
      };
    } else if (formData.exerciseType === 'Programming') {
      payload.questionConfiguration = {
        programmingConfig: buildProgConfig(formData.programmingConfig, progTotalMarks),
      };
    } else if (formData.exerciseType === 'Other') {
      payload.questionConfiguration = {
        othersQuestionConfiguration: buildProgConfig(formData.othersConfig as any, formData.totalMarks),
      };
    } else if (formData.exerciseType === 'Combined') {
      payload.questionConfiguration = {
        mcqConfig: {
          questionConfigType: 'general',
          generalQuestionCount: formData.mcqConfig.generalQuestionCount || 0,
          scoreSettings: {
            scoreType: formData.mcqConfig.scoreSettings?.scoreType || 'equalDistribution',
            equalDistribution: formData.mcqConfig.scoreSettings?.equalDistribution || 0,
            totalMarks: formData.totalMarksMCQ,
          },
          attemptLimitEnabled: formData.mcqConfig.attemptLimitEnabled || false,
          submissionAttempts: formData.mcqConfig.submissionAttempts || 1,
          mcqTotalMarks: formData.totalMarksMCQ,
          marksPerQuestion: formData.mcqConfig.scoreSettings?.equalDistribution || 0,
          totalMcqQuestions: formData.mcqConfig.generalQuestionCount || 0,
          scoringType: formData.mcqConfig.scoreSettings?.scoreType || 'equalDistribution',
          shuffleQuestions: true,
        },
        programmingConfig: buildProgConfig(formData.programmingConfig, formData.totalMarksProgramming),
      };
    }

    return payload;
  }, [formData, tabType, subcategory, programmingAllocatedMarks, savedSteps, questionSource, customDistribution, customSources, saveToBank, questionSourceMcq, customSourcesMcq, customDistributionMcq]);

  // ── performCompleteSave — the actual API call that finalises the exercise.
  // Split out of handleComplete so the preview-confirm modal can call it after
  // the trainer clicks Confirm on the first-time-creation summary.
  const performCompleteSave = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!tabType || !subcategory) throw new Error('Missing required fields: tabType or subcategory');
      if (!formData.exerciseName) throw new Error('Exercise name is required');

      const basePayload = { ...buildFullPayload(), completeSetup: true };
      basePayload.stepsSaved = steps.map(s => s.title);
      const finalId = localExerciseId || (isEditing ? exercise_Id : null);

      const entityPath = getEntityType(nodeType);
      const BASE_URL = `${API_ORIGIN}`;
      const token = getToken();

      if (!token) throw new Error('No authentication token found. Please log in again.');

      let response: any;
      if (finalId) {
        const res = await fetch(
          withBatchUrl(`${BASE_URL}/exercise/update/${entityPath}/${nodeId}/${finalId}`),
          { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(basePayload) }
        );
        if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(`Server error (${res.status}): ${JSON.stringify(errData)}`); }
        response = await res.json();
      } else {
        const res = await fetch(
          withBatchUrl(`${BASE_URL}/exercise/add/${entityPath}/${nodeId}`),
          { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(basePayload) }
        );
        if (!res.ok) { const errData = await res.json().catch(() => ({})); throw new Error(`Server error (${res.status}): ${JSON.stringify(errData)}`); }
        response = await res.json();
        const newId = response?.data?.exercise?._id || response?.data?._id || response?._id;
        if (newId) setLocalExerciseId(newId);
      }

      toast.success(
        isEditing ? 'Exercise updated successfully!' : 'Exercise created successfully!',
        { position: 'top-right', duration: 3000, id: 'exercise-save-success', style: { minWidth: '250px', fontWeight: 600 } }
      );

      setIsLocked(true);
      setCompletedSteps(new Set(steps.map(s => s.id)));
      setSavedSteps(new Set(steps.map(s => s.title)));
      setTimeout(() => {
        setIsLoading(false);
        onClose();
        onSave(basePayload);
      }, 1500);
      setTimeout(() => { toast.dismiss('exercise-save-success'); }, 3200);
    } catch (error: any) {
      console.error('❌ Error in performCompleteSave:', error);
      const friendlyMsg = isEditing
        ? 'Unable to update exercise. Please review your inputs and try again.'
        : 'Unable to create exercise. Please review your inputs and try again.';
      toast.error(friendlyMsg, { position: 'top-right', duration: 4000, id: 'exercise-error' });
      setIsLoading(false);
    }
  }, [tabType, subcategory, formData.exerciseName, buildFullPayload, steps, localExerciseId, isEditing, exercise_Id,
      getEntityType, nodeType, nodeId, onSave, onClose]);

  // ── handleComplete ──────────────────────────────────────────────────────────
  const handleComplete = useCallback(async () => {
    let allErrors: ValidationErrors = {};
    const allFields: string[] = [];

    if (!formData.exerciseType) allErrors.exerciseType = 'Please select an exercise type';
    if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
      if (!formData.selectedModule) allErrors.selectedModule = 'Please select a module';
      if (formData.selectedLanguages.length === 0) allErrors.selectedLanguages = 'Please select at least one language';
    }
    const detailsErrors = validateExerciseDetails();
    allErrors = { ...allErrors, ...detailsErrors };
    allFields.push('exerciseType', 'selectedModule', 'selectedLanguages', 'exerciseName', 'totalDuration', 'totalMarks');
    if (formData.exerciseType === 'Combined') allFields.push('totalMarksMCQ', 'totalMarksProgramming');

    if (formData.exerciseType === 'MCQ' || formData.exerciseType === 'Combined') {
      const mcqErrors = validateMCQConfiguration();
      allErrors = { ...allErrors, ...mcqErrors };
      allFields.push('mcqGeneralQuestionCount', 'mcqMarksPerQuestion', 'mcqTotalMarks');
    }

    if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
      const progErrors = validateProgrammingConfiguration();
      allErrors = { ...allErrors, ...progErrors };
      if (formData.isGraded !== false && programmingLevelMismatch) allErrors.programmingTotalMarks = programmingLevelMismatch;
      allFields.push('programmingGeneralQuestionCount', 'programmingMarksPerQuestion',
        'programmingLevelCounts', 'programmingLevelCounts_Easy',
        'programmingLevelCounts_Medium', 'programmingLevelCounts_Hard', 'programmingTotalMarks');
    }

    if (formData.exerciseType === 'Other') {
      const othErrors = validateOthersConfiguration();
      allErrors = { ...allErrors, ...othErrors };
      if (formData.isGraded !== false && othersLevelMismatch) allErrors.othersTotalMarks = othersLevelMismatch;
      allFields.push('othersGeneralQuestionCount', 'othersMarksPerQuestion',
        'othersLevelCounts', 'othersLevelCounts_Easy',
        'othersLevelCounts_Medium', 'othersLevelCounts_Hard', 'othersTotalMarks',
        'scoring_others_easy', 'scoring_others_medium', 'scoring_others_hard');
    }

    const scheduleErrors = validateSchedule();
    allErrors = { ...allErrors, ...scheduleErrors };
    allFields.push('startDate', 'endDate');
    if ((formData.schedule as any).cutOffEnabled) allFields.push('cutOffDate');

    if (formData.isGraded !== false) {
      const gradeErrors = validateGradeSettings();
      allErrors = { ...allErrors, ...gradeErrors };
      allFields.push('programmingGrade', 'programmingGradeToPass', 'mcqGrade', 'mcqGradeToPass', 'combinedGrade', 'combinedGradeToPass');
    }

    if (Object.keys(allErrors).length > 0) {
      setValidationErrors(prev => ({ ...prev, ...allErrors }));
      markAllTouched(allFields);

      const incompleteSteps: string[] = [];
      if (allErrors.exerciseType || allErrors.selectedModule || allErrors.selectedLanguages ||
        allErrors.exerciseName || allErrors.totalDuration || allErrors.totalMarks ||
        allErrors.totalMarksMCQ || allErrors.totalMarksProgramming)
        incompleteSteps.push('Exercise Details');
      if (allErrors.mcqGeneralQuestionCount || allErrors.mcqMarksPerQuestion || allErrors.mcqTotalMarks ||
        allErrors.programmingGeneralQuestionCount || allErrors.programmingMarksPerQuestion ||
        allErrors.programmingLevelCounts || allErrors.programmingLevelCounts_Easy ||
        allErrors.programmingLevelCounts_Medium || allErrors.programmingLevelCounts_Hard ||
        allErrors.programmingTotalMarks || allErrors.programmingLevelScoring ||
        allErrors.othersGeneralQuestionCount || allErrors.othersMarksPerQuestion ||
        allErrors.othersLevelCounts || allErrors.othersLevelCounts_Easy ||
        allErrors.othersLevelCounts_Medium || allErrors.othersLevelCounts_Hard ||
        allErrors.othersTotalMarks || allErrors.othersLevelScoring)
        incompleteSteps.push('Question Configuration');
      if (allErrors.startDate || allErrors.endDate || allErrors.cutOffDate || allErrors.gracePeriod)
        incompleteSteps.push('Schedule');
      if (formData.isGraded !== false && (allErrors.programmingGrade || allErrors.programmingGradeToPass ||
        allErrors.mcqGradeToPass || allErrors.combinedGradeToPass))
        incompleteSteps.push('Grade Settings');

      const firstInvalidStep = steps.find(step => incompleteSteps.includes(step.title));
      if (firstInvalidStep) {
        setExpandedSteps(previous => new Set(previous).add(firstInvalidStep.id));
        setCurrentStep(firstInvalidStep.id);
        setErrorStepIds(new Set(steps.filter(s => incompleteSteps.includes(s.title)).map(s => s.id)));
        // Scroll after the expand has painted, then put focus on the first
        // invalid control so a keyboard user lands on the actual problem.
        window.setTimeout(() => {
          const header = document.getElementById(`assignment-section-${firstInvalidStep.id}`);
          header?.scrollIntoView({ behavior: "smooth", block: "start" });
          const panel = document.getElementById(`assignment-panel-${firstInvalidStep.id}`);
          const firstBad = panel?.querySelector<HTMLElement>(
            "[aria-invalid=\"true\"], input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])"
          );
          firstBad?.focus({ preventScroll: true });
        }, 120);
      }

      toast.error(
        incompleteSteps.length > 0
          ? `Please complete: ${incompleteSteps.join(' · ')}`
          : 'Please complete all required fields',
        { position: 'top-right', duration: 5000, id: 'validation-error' }
      );
      return;
    }

    setErrorStepIds(new Set());
    // First-time creation: gate the final commit behind a preview + confirm
    // modal so the trainer eyeballs everything before it hits the server.
    // Edit mode skips the extra step — the user already sees the values live.
    if (!isEditing) {
      setConfirmSaveOpen(true);
      return;
    }
    await performCompleteSave();
  }, [
    validateExerciseDetails,
    validateMCQConfiguration,
    validateProgrammingConfiguration,
    validateOthersConfiguration,
    validateSchedule,
    validateGradeSettings,
    programmingLevelMismatch,
    othersLevelMismatch,
    formData.exerciseType,
    formData.selectedModule,
    formData.selectedLanguages,
    formData.schedule,
    isEditing,
    markAllTouched,
    steps,
    performCompleteSave,
  ]);

  const hasStepRequiredFieldsFilled = useCallback((stepId: number): boolean => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return true;
    switch (step.title) {
      case 'Exercise Details': {
        if (!formData.exerciseType) return false;

        // Programming and Combined require module/languages
        if ((formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') &&
          (!formData.selectedModule || formData.selectedLanguages.length === 0)) return false;

        const base = !!(formData.exerciseName?.trim() && formData.totalDuration > 0);
        if (formData.exerciseType === 'Combined')
          return base && formData.totalMarksMCQ > 0 && formData.totalMarksProgramming > 0;
        return base && formData.totalMarks > 0;
      }
      case 'Question Configuration': {
        const cfg = formData.programmingConfig;
        const progFilled = cfg.questionConfigType === 'general'
          ? cfg.generalQuestionCount > 0
          : (() => { const counts = cfg.questionConfigType === 'selectionLevel' ? cfg.selectionLevelCounts : cfg.levelBasedCounts; return counts.easy > 0 || counts.medium > 0 || counts.hard > 0; })();
        if (formData.exerciseType === 'MCQ') return formData.mcqConfig.generalQuestionCount > 0;
        if (formData.exerciseType === 'Programming') return progFilled;
        if (formData.exerciseType === 'Other') {
          const oc = formData.othersConfig;
          if (oc.questionConfigType === 'general') return oc.generalQuestionCount > 0;
          const counts = oc.questionConfigType === 'selectionLevel' ? oc.selectionLevelCounts : oc.levelBasedCounts;
          return counts.easy > 0 || counts.medium > 0 || counts.hard > 0;
        }
        if (formData.exerciseType === 'Combined') return formData.mcqConfig.generalQuestionCount > 0 && progFilled;
        return true;
      }
      case 'Add Questions':
        return !!questionSource && (questionSource !== 'custom' || customSources.length >= 2) &&
          // Combined: a separated MCQ source with Custom needs both sub-sources.
          (formData.exerciseType !== 'Combined' || questionSourceMcq !== 'custom' || customSourcesMcq.length >= 2);
      case 'Schedule': {
        const sched = formData.schedule as any;
        return !!(sched.startDate?.year > 0 && sched.endDate?.year > 0);
      }
      case 'Notifications':
      case 'Notification':
        return true;
      case 'Grade Settings':
        return Object.keys(validateGradeSettings()).length === 0;
      default:
        return true;
    }
  }, [steps, formData, validateGradeSettings, questionSource, customSources, questionSourceMcq, customSourcesMcq]);

  // handleSave is declared below this point, but the "not saved yet" notice
  // wants to offer Save as an action. A ref bridges the gap without moving
  // either definition (handleSave depends on a lot of what sits between them).
  const saveNowRef = useRef<(() => void) | null>(null);

  const handleNext = useCallback(() => {
    const step = steps.find(s => s.id === currentStep);

    // ── Step 1 gate ──────────────────────────────────────────────────────
    // Next used to be DISABLED until Exercise Details was saved. A dead
    // button explains nothing: people fill the form, press Next, and nothing
    // happens — there is no way to tell "not allowed yet" from "broken".
    // So Next is always clickable now, and the reason is spoken out loud,
    // with the fix one click away inside the notice itself.
    if (step?.title === 'Exercise Details' && !savedSteps.has('Exercise Details')) {
      toast.custom((t) => (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            width: 380, maxWidth: '92vw',
            padding: '14px 14px 14px 16px',
            background: '#FFFFFF',
            border: '1px solid #FFE1D1',
            borderLeft: `4px solid ${D.orange}`,
            borderRadius: 12,
            boxShadow: '0 12px 32px rgba(16,24,40,.16)',
            // Slide down + settle, reversing on the way out. Driven off
            // t.visible rather than a keyframe so the notice carries its own
            // animation and does not depend on the modal's <style> block
            // still being mounted.
            opacity: t.visible ? 1 : 0,
            transform: t.visible ? 'translateY(0) scale(1)' : 'translateY(-14px) scale(.96)',
            transition: 'opacity 220ms cubic-bezier(.21,1.02,.73,1), transform 220ms cubic-bezier(.21,1.02,.73,1)',
          }}
        >
          <span
            aria-hidden
            className="warning-pulse"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, flexShrink: 0, borderRadius: '50%',
              background: '#FFF3EC', color: D.orange,
            }}
          >
            <FileText size={15} />
          </span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#101828', lineHeight: 1.3 }}>
              Save before continuing
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#667085', lineHeight: 1.45 }}>
              Your exercise details have not been saved yet. Save them to unlock the next step.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                onClick={() => { toast.dismiss(t.id); saveNowRef.current?.(); }}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: D.orange, color: '#FFFFFF',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  boxShadow: `0 4px 12px ${D.orangeGlow}`,
                }}
              >
                Save now
              </button>
              <button
                type="button"
                onClick={() => toast.dismiss(t.id)}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  border: '1px solid #E4E7EC', background: '#FFFFFF',
                  color: '#475467', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Not yet
              </button>
            </div>
          </div>
        </div>
      ), { position: 'top-right', duration: 5000, id: 'save-step-1-first' });
      return;
    }

    // Question Configuration gate — cannot advance while E+M+H ≠ patternTotal.
    if (step?.title === 'Question Configuration' && patternTotalMismatch) {
      toast.error(patternTotalMismatch.message, { position: 'top-right', duration: 3200, id: 'pattern-mismatch' });
      return;
    }
    // Add Questions gate — a source must be picked before moving on; Custom
    // must have ≥2 sub-sources ticked.
    if (step?.title === 'Add Questions') {
      if (!questionSource) { toast('Pick a Question Source first.', { icon: 'ℹ️', position: 'top-right', duration: 2600, id: 'need-source' }); return; }
      if (questionSource === 'custom' && customSources.length < 2) { toast('Custom needs at least two sources ticked.', { icon: 'ℹ️', position: 'top-right', duration: 2800, id: 'need-2-sources' }); return; }
      if (formData.exerciseType === 'Combined' && questionSourceMcq === 'custom' && customSourcesMcq.length < 2) {
        toast('MCQ Custom needs both sources ticked.', { icon: 'ℹ️', position: 'top-right', duration: 2800, id: 'need-2-mcq-sources' }); return;
      }
    }

    // Mark current step as completed when navigating away
    if (hasStepRequiredFieldsFilled(currentStep)) {
      setCompletedSteps(prev => new Set(prev).add(currentStep));
    }

    // Special handling for Notifications step
    if (step?.title === 'Notifications' || step?.title === 'Notification') {
      setSavedSteps(prev => new Set(prev).add(step.title));
    }

    if (currentStep < steps[steps.length - 1]?.id) {
      const ci = steps.findIndex(s => s.id === currentStep);
      if (ci < steps.length - 1) {
        const nextId = steps[ci + 1].id;
        setExpandedSteps(previous => new Set(previous).add(nextId));
        setCurrentStep(nextId);
      }
    }
  }, [currentStep, steps, savedSteps, setCompletedSteps, setSavedSteps, hasStepRequiredFieldsFilled, patternTotalMismatch, questionSource, customSources, questionSourceMcq, customSourcesMcq, formData.exerciseType]);
  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      const ci = steps.findIndex(s => s.id === currentStep);
      if (ci > 0) setCurrentStep(steps[ci - 1].id);
    }
  }, [currentStep, steps]);

  // ── Field-only completeness check (no saved-state dependency) ────────────────
  // Returns true if the step's required fields are filled (used for guidance navigation)

  // ── Shared save logic ────────────────────────────────────────────────────────
  // ── buildStepScopedPayload ─────────────────────────────────────────────────
  // Update path: send ONLY the fields owned by the current step so the backend's
  // merge logic preserves data from steps the user hasn't reached yet. This avoids
  // 500s where empty/partial later-step data fails Mongoose validation.
  const buildStepScopedPayload = useCallback((stepTitle: string) => {
    const full: any = buildFullPayload();
    const base: any = {
      tabType: full.tabType,
      subcategory: full.subcategory,
      exerciseType: full.exerciseType,
      isGraded: full.isGraded,
      stepsSaved: full.stepsSaved,
      configurationType: full.configurationType,
    };
    switch (stepTitle) {
      case 'Exercise Details':
        base.exerciseInformation = full.exerciseInformation;
        if (full.programmingSettings) base.programmingSettings = full.programmingSettings;
        break;
      case 'Question Configuration':
        base.questionConfiguration = full.questionConfiguration;
        base.exerciseInformation = full.exerciseInformation; // totals live here
        if (full.programmingSettings) base.programmingSettings = full.programmingSettings;
        if (full.questionBehavior) base.questionBehavior = full.questionBehavior;
        // The Evaluation Method block renders inside this step, so its config
        // has to ride along — a step-scoped save omitting it would leave the
        // teacher's choice unsaved.
        base.evaluationMethod = full.evaluationMethod;
        break;
      case 'Add Questions':
        // Source, Custom split and bank preference belong to this step now
        // (moved out of Question Configuration so a QC re-save can't null them).
        base.questionSource = full.questionSource;
        base.customSources = full.customSources;
        base.customDistribution = full.customDistribution;
        base.saveToBank = full.saveToBank;
        // Combined-only MCQ-part source fields ride with the same step.
        base.questionSourceMcq = full.questionSourceMcq;
        base.customSourcesMcq = full.customSourcesMcq;
        base.customDistributionMcq = full.customDistributionMcq;
        break;
      case 'Schedule':
        base.availabilityPeriod = full.availabilityPeriod;
        break;
      case 'Notifications':
      case 'Notification':
        base.notificationSettings = full.notificationSettings;
        break;
      case 'Grade Settings':
        base.gradeSettings = full.gradeSettings;
        if (full.additionalOptions) base.additionalOptions = full.additionalOptions;
        break;
      default:
        // Unknown step → fall back to full payload (safe).
        return full;
    }
    return base;
  }, [buildFullPayload]);

  const performSave = useCallback(async (afterSave?: () => void) => {
    if (isLocked) return;
    setIsSavingStep(true);
    try {
      if (!formData.exerciseName?.trim()) {
        setValidationErrors(prev => ({ ...prev, exerciseName: 'Enter an assignment name to save.' }));
        markAllTouched(['exerciseName']);
        setExpandedSteps(previous => new Set(previous).add(1));
        toast.error('Enter an assignment name to save.');
        return false;
      }
      const currentId = localExerciseId || (isEditing ? exercise_Id : null);
      const payload = {
        tabType, subcategory, saveAsDraft: true,
        exerciseInformation: { exerciseName: formData.exerciseName.trim(), exerciseId: formData.exerciseId },
        draftConfiguration: { ...JSON.parse(dirtySnapshotRef.current), saveToBank },
      };

      // FIXED: declare before if/else
      const entityPath = getEntityType(nodeType);
      const BASE_URL = `${API_ORIGIN}`;
      const token = getToken();

      if (!token) throw new Error('No authentication token found. Please log in again.');

      let response: any;

      if (currentId) {
        const res = await fetch(
          withBatchUrl(`${BASE_URL}/exercise/update/${entityPath}/${nodeId}/${currentId}`),
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(`Server error (${res.status}): ${JSON.stringify(errData)}`);
        }
        response = await res.json();
      } else {
        const res = await fetch(
          withBatchUrl(`${BASE_URL}/exercise/add/${entityPath}/${nodeId}`),
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(`Server error (${res.status}): ${JSON.stringify(errData)}`);
        }
        response = await res.json();

        const newId = response?.data?.exercise?._id || response?.data?._id || response?._id;
        if (newId) setLocalExerciseId(newId);
      }

      setSavedSteps(new Set(['Exercise Details']));
      // Clear all validation errors on successful save — sidebar indicators reset
      setValidationErrors({});
      setTouchedFields(new Set());
      // Everything on screen is on the server now, so closing is lossless until
      // the next edit.
      markDirtyBaseline();

      afterSave?.();
      return true;
    } catch (err: any) {
      const msg = err?.message || 'Failed to save';
      toast.error(`Save failed: ${msg}`, { position: 'top-right', duration: 4000, id: 'step-save-err' });
      return false;
    } finally {
      setIsSavingStep(false);
    }
  }, [
    isLocked, tabType, subcategory, saveToBank, formData.exerciseId, markAllTouched,
    buildFullPayload,
    buildStepScopedPayload,
    savedSteps,
    localExerciseId,
    isEditing,
    exercise_Id,
    formData.exerciseName,
    formData.exerciseType,
    getEntityType,
    nodeType,
    nodeId,
    currentStep,
    steps,
    isStepCompleted,
    patternTotalMismatch,
    markDirtyBaseline,
  ]);
  // ← Added isStepCompleted to deps
  // ── handleSaveAndNext — save current step to DB then advance ────────────────
  const handleSaveAndNext = useCallback(async () => {
    await performSave(() => {
      toast.success('Step saved!', { position: 'top-right', duration: 1800, id: 'step-save-ok' });
      handleNext();
    });
  }, [performSave, handleNext]);

  // ── flagAllStepIssues — non-blocking sibling of handleComplete's validator ──
  // Runs every step's validator, marks the offending fields touched so their
  // red messages surface in-place, rings every incomplete section, expands and
  // scrolls to the first one so the user sees where to go. Used by
  // handleSave — Save changes now surfaces problems the same way Complete
  // setup does, but still lets the draft persist regardless.
  const flagAllStepIssues = useCallback(() => {
    let allErrors: ValidationErrors = {};
    const allFields: string[] = [];

    if (!formData.exerciseType) allErrors.exerciseType = 'Please select an exercise type';
    if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
      if (!formData.selectedModule) allErrors.selectedModule = 'Please select a module';
      if (formData.selectedLanguages.length === 0) allErrors.selectedLanguages = 'Please select at least one language';
    }
    allErrors = { ...allErrors, ...validateExerciseDetails() };
    allFields.push('exerciseType', 'selectedModule', 'selectedLanguages', 'exerciseName', 'exerciseLevel', 'totalDuration', 'totalMarks');
    if (formData.exerciseType === 'Combined') allFields.push('totalMarksMCQ', 'totalMarksProgramming');

    if (formData.exerciseType === 'MCQ' || formData.exerciseType === 'Combined') {
      allErrors = { ...allErrors, ...validateMCQConfiguration() };
      allFields.push('mcqGeneralQuestionCount', 'mcqMarksPerQuestion', 'mcqTotalMarks');
    }
    if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
      allErrors = { ...allErrors, ...validateProgrammingConfiguration() };
      if (formData.isGraded !== false && programmingLevelMismatch) allErrors.programmingTotalMarks = programmingLevelMismatch;
      allFields.push('programmingGeneralQuestionCount', 'programmingMarksPerQuestion',
        'programmingLevelCounts', 'programmingLevelCounts_Easy',
        'programmingLevelCounts_Medium', 'programmingLevelCounts_Hard', 'programmingTotalMarks');
    }
    if (formData.exerciseType === 'Other') {
      allErrors = { ...allErrors, ...validateOthersConfiguration() };
      if (formData.isGraded !== false && othersLevelMismatch) allErrors.othersTotalMarks = othersLevelMismatch;
      allFields.push('othersGeneralQuestionCount', 'othersMarksPerQuestion',
        'othersLevelCounts', 'othersLevelCounts_Easy',
        'othersLevelCounts_Medium', 'othersLevelCounts_Hard', 'othersTotalMarks');
    }

    allErrors = { ...allErrors, ...validateSchedule() };
    allFields.push('startDate', 'endDate');
    if ((formData.schedule as any).cutOffEnabled) allFields.push('cutOffDate');

    if (formData.isGraded !== false) {
      allErrors = { ...allErrors, ...validateGradeSettings() };
      allFields.push('programmingGrade', 'programmingGradeToPass', 'mcqGrade', 'mcqGradeToPass', 'combinedGrade', 'combinedGradeToPass');
    }

    if (Object.keys(allErrors).length === 0) {
      setErrorStepIds(new Set());
      return { hasErrors: false, firstInvalidStepId: null as number | null };
    }

    setValidationErrors(prev => ({ ...prev, ...allErrors }));
    markAllTouched(allFields);

    const incompleteSteps: string[] = [];
    if (allErrors.exerciseType || allErrors.selectedModule || allErrors.selectedLanguages ||
      allErrors.exerciseName || allErrors.totalDuration || allErrors.totalMarks ||
      allErrors.totalMarksMCQ || allErrors.totalMarksProgramming)
      incompleteSteps.push('Exercise Details');
    if (allErrors.mcqGeneralQuestionCount || allErrors.mcqMarksPerQuestion || allErrors.mcqTotalMarks ||
      allErrors.programmingGeneralQuestionCount || allErrors.programmingMarksPerQuestion ||
      allErrors.programmingLevelCounts || allErrors.programmingLevelCounts_Easy ||
      allErrors.programmingLevelCounts_Medium || allErrors.programmingLevelCounts_Hard ||
      allErrors.programmingTotalMarks || allErrors.programmingLevelScoring ||
      allErrors.othersGeneralQuestionCount || allErrors.othersMarksPerQuestion ||
      allErrors.othersLevelCounts || allErrors.othersLevelCounts_Easy ||
      allErrors.othersLevelCounts_Medium || allErrors.othersLevelCounts_Hard ||
      allErrors.othersTotalMarks || allErrors.othersLevelScoring)
      incompleteSteps.push('Question Configuration');
    if (allErrors.startDate || allErrors.endDate || allErrors.cutOffDate || allErrors.gracePeriod)
      incompleteSteps.push('Schedule');
    if (formData.isGraded !== false && (allErrors.programmingGrade || allErrors.programmingGradeToPass ||
      allErrors.mcqGradeToPass || allErrors.combinedGradeToPass))
      incompleteSteps.push('Grade Settings');

    const invalidStepIds = new Set(steps.filter(s => incompleteSteps.includes(s.title)).map(s => s.id));
    setErrorStepIds(invalidStepIds);
    const firstInvalidStep = steps.find(step => incompleteSteps.includes(step.title));
    if (firstInvalidStep) {
      // Expand the section, activate it, then wait two paints so the accordion
      // animation has finished and the field it hosts is actually in the DOM
      // and measurable before we scroll to it.
      setExpandedSteps(previous => new Set(previous).add(firstInvalidStep.id));
      setCurrentStep(firstInvalidStep.id);
      requestAnimationFrame(() => window.setTimeout(() => {
        const panel = document.getElementById(`assignment-panel-${firstInvalidStep.id}`);
        // Prefer the first invalid control so the user lands directly on the
        // thing that needs filling; fall back to the section header so we
        // never fail silently on a section that has no focusable input yet
        // (e.g. Add Questions before a source is picked).
        const firstBad = (panel?.querySelector<HTMLElement>('[aria-invalid="true"]')
          ?? panel?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled])'))
          ?? document.getElementById(`assignment-section-${firstInvalidStep.id}`);
        firstBad?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (firstBad instanceof HTMLElement && firstBad.tagName !== 'BUTTON') {
          try { firstBad.focus({ preventScroll: true }); } catch { /* focus is best-effort */ }
        }
      }, 200));
    }
    return { hasErrors: true, firstInvalidStepId: firstInvalidStep?.id ?? null };
  }, [formData, validateExerciseDetails, validateMCQConfiguration, validateProgrammingConfiguration,
      validateOthersConfiguration, validateSchedule, validateGradeSettings,
      programmingLevelMismatch, othersLevelMismatch, markAllTouched, steps]);

  // ── handleSave — save all steps data so far, stay on current step ───────────
  // Persists the draft, then surfaces any outstanding issues (red rings +
  // scroll) so the user can see exactly what still needs finishing without
  // being blocked from saving. Skips the network call entirely when the name
  // is missing (the server requires it) — flag + scroll still runs so the
  // user is taken to the empty name field automatically.
  const handleSave = useCallback(async () => {
    const hasName = !!formData.exerciseName?.trim();
    if (!hasName) {
      const result = flagAllStepIssues();
      toast.error('Enter an assignment name — highlighted below.', {
        position: 'top-right', duration: 3500, id: 'save-has-issues',
      });
      return false;
    }
    const ok = await performSave(() => {
      toast.success('Progress saved. Complete setup when you’re ready.', {
        position: 'top-right', duration: 2400, id: 'step-save-ok',
      });
    });
    // performSave clears touched/errors on success — flag AFTER so the visible
    // state reflects what is still incomplete right now.
    const result = flagAllStepIssues();
    if (result.hasErrors) {
      toast.error('Some sections still need attention — highlighted in red.', {
        position: 'top-right', duration: 3500, id: 'save-has-issues',
      });
    }
    return ok;
  }, [performSave, flagAllStepIssues, formData.exerciseName]);

  // Lets the "Save before continuing" notice (raised in handleNext, which is
  // defined above handleSave) run the same save the footer button runs.
  useEffect(() => { saveNowRef.current = handleSave; }, [handleSave]);

  // ── Section click — every step is freely editable from the start.
  //    Previously all non-General steps were gated behind saving Step 1; the
  //    UX now unlocks every card so trainers can fill Availability, Question
  //    Source and Notifications without saving General first.
  const handleStepClick = useCallback((targetStepId: number) => {
    setExpandedSteps(previous => {
      const next = new Set(previous);
      const wasOpen = next.has(targetStepId);
      if (wasOpen) {
        next.delete(targetStepId);
        // Leaving a section is the natural moment to judge it: mark its fields
        // touched so anything missing turns red there and then, rather than
        // staying silent until Complete setup.
        const fields = STEP_ERROR_FIELDS[steps.find(s => s.id === targetStepId)?.title ?? ""] ?? [];
        if (fields.length) setTouchedFields(prev => { const n = new Set(prev); fields.forEach(x => n.add(x)); return n; });
      } else next.add(targetStepId);
      return next;
    });
    setCurrentStep(targetStepId);
  }, [savedSteps, steps]);

  // FIXED: handleSelectExerciseType - restored programming config reset from old version
  const handleSelectExerciseType = useCallback((type: 'MCQ' | 'Programming' | 'Combined' | 'Other') => {
    // In edit mode, switching the exercise type wipes the entire question
    // pool + config that was chosen for the previous type — warn the trainer
    // before we throw that work away.
    if (isEditing && formData.exerciseType && formData.exerciseType !== type) {
      setWarningModal({
        title: 'Change assignment type?',
        body: `Switching from "${formData.exerciseType}" to "${type}" will remove all attached questions and reset the question configuration for this exercise. This cannot be undone.`,
        confirmLabel: 'Change type',
        onConfirm: () => { applyExerciseTypeChange(type); },
      });
      return;
    }
    applyExerciseTypeChange(type);
  }, [isEditing, formData.exerciseType]);

  // The actual state changes for exerciseType — extracted so both the
  // no-confirmation path and the warning-modal Continue button can call it.
  const applyExerciseTypeChange = useCallback((type: 'MCQ' | 'Programming' | 'Combined' | 'Other') => {
    // Leaving Combined discards the MCQ-part source trio — otherwise a stale
    // questionSourceMcq persisted during the Combined phase would linger in
    // state (the payload also nulls it for non-Combined types).
    if (type !== 'Combined') {
      setQuestionSourceMcq('');
      setCustomSourcesMcq([]);
      setCustomDistributionMcq({ scratch: 0, ai: 0, thirdParty: 0 });
    }
    setFormData(prev => ({
      ...prev,
      exerciseType: type,
      // Reset module and languages for MCQ only
      ...((type === 'MCQ') && {
        selectedModule: '',
        selectedLanguages: []
      }),
      // Initialize programming config with defaults for Other (same as Programming)
      ...((type === 'Other') && {
        programmingConfig: {
          ...prev.programmingConfig,
          questionConfigType: '' as any,
          generalQuestionCount: 0,
          selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
          levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
          scoreSettings: {
            ...prev.programmingConfig.scoreSettings,
            equalDistribution: 0
          }
        }
      }),
      // Initialize programming config with defaults
      ...((type === 'Programming') && {
        programmingConfig: {
          ...prev.programmingConfig,
          questionConfigType: '' as any,
          generalQuestionCount: 0,
          selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
          levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
          scoreSettings: {
            ...prev.programmingConfig.scoreSettings,
            equalDistribution: 0
          }
        }
      }),
      // Initialize combined mode with both sections configured
      ...(type === 'Combined' && {
        programmingConfig: {
          ...prev.programmingConfig,
          questionConfigType: 'general',
          generalQuestionCount: prev.programmingConfig.generalQuestionCount || 0,
          scoreSettings: {
            ...prev.programmingConfig.scoreSettings,
            equalDistribution: prev.totalMarksProgramming > 0 && prev.programmingConfig.generalQuestionCount > 0
              ? prev.totalMarksProgramming / prev.programmingConfig.generalQuestionCount
              : 0
          }
        },
        mcqConfig: {
          ...prev.mcqConfig,
          generalQuestionCount: prev.mcqConfig.generalQuestionCount || 0,
          scoreSettings: {
            ...prev.mcqConfig.scoreSettings,
            equalDistribution: prev.totalMarksMCQ > 0 && prev.mcqConfig.generalQuestionCount > 0
              ? prev.totalMarksMCQ / prev.mcqConfig.generalQuestionCount
              : prev.mcqConfig.scoreSettings.equalDistribution || 0
          }
        }
      }),
    }));

    setValidationErrors(prev => {
      const e = { ...prev };
      delete e.exerciseType;
      delete e.selectedModule;
      delete e.selectedLanguages;
      return e;
    });

    setCurrentStep(1);
  }, []);
  // FIXED: removed isEditing guard on language toggles (matching old behavior)
  const toggleLanguage = useCallback((lang: string) => {
    setFormData(prev => ({ ...prev, selectedLanguages: prev.selectedLanguages.includes(lang) ? prev.selectedLanguages.filter(l => l !== lang) : [...prev.selectedLanguages, lang] }));
    setValidationErrors(prev => { const e = { ...prev }; delete e.selectedLanguages; return e; });
  }, []);

  const toggleAllLanguages = useCallback(() => {
    const cur = getFilteredLanguages(formData.selectedModule)?.map(l => l.name) || [];
    const all = cur.every(l => formData.selectedLanguages.includes(l));
    setFormData(prev => ({ ...prev, selectedLanguages: all ? [] : [...cur] }));
    setValidationErrors(prev => { const e = { ...prev }; delete e.selectedLanguages; return e; });
  }, [formData.selectedModule, formData.selectedLanguages]);

  const updateLevelScoringConfig = useCallback((level: 'easy' | 'medium' | 'hard', updates: Partial<any>) => {
    setFormData(prev => ({ ...prev, programmingConfig: { ...prev.programmingConfig, scoreSettings: { ...prev.programmingConfig.scoreSettings, levelScoringConfiguration: { ...prev.programmingConfig.scoreSettings.levelScoringConfiguration, [level]: { ...prev.programmingConfig.scoreSettings.levelScoringConfiguration[level], ...updates } } } } }));
    setValidationErrors(prev => {
      const ne = { ...prev };
      if (prev.programmingLevelScoring) { const ns = { ...prev.programmingLevelScoring }; delete ns[level]; if (!Object.keys(ns).length) delete ne.programmingLevelScoring; else ne.programmingLevelScoring = ns; }
      delete ne.programmingTotalMarks; return ne;
    });
  }, []);

  const updateOthersLevelScoringConfig = useCallback((level: 'easy' | 'medium' | 'hard', updates: Partial<any>) => {
    setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, scoreSettings: { ...prev.othersConfig.scoreSettings, levelScoringConfiguration: { ...prev.othersConfig.scoreSettings.levelScoringConfiguration, [level]: { ...prev.othersConfig.scoreSettings.levelScoringConfiguration[level], ...updates } } } } }));
    setValidationErrors(prev => {
      const ne = { ...prev };
      if (prev.othersLevelScoring) { const ns = { ...prev.othersLevelScoring }; delete ns[level]; if (!Object.keys(ns).length) delete ne.othersLevelScoring; else ne.othersLevelScoring = ns; }
      delete ne.othersTotalMarks; return ne;
    });
  }, []);

  const shouldShowScoringSection = useMemo(() => {
    const ct = formData.programmingConfig.questionConfigType;
    if (ct === 'general') return false;
    if (ct === 'levelBased') { const c = formData.programmingConfig.levelBasedCounts; return c.easy > 0 && c.medium > 0 && c.hard > 0; }
    if (ct === 'selectionLevel') { const c = formData.programmingConfig.selectionLevelCounts; return c.easy > 0 || c.medium > 0 || c.hard > 0; }
    return false;
  }, [formData.programmingConfig]);

  const othersShouldShowScoringSection = useMemo(() => {
    const ct = formData.othersConfig.questionConfigType;
    if (ct === 'general') return false;
    if (ct === 'levelBased') { const c = formData.othersConfig.levelBasedCounts; return c.easy > 0 && c.medium > 0 && c.hard > 0; }
    if (ct === 'selectionLevel') { const c = formData.othersConfig.selectionLevelCounts; return c.easy > 0 || c.medium > 0 || c.hard > 0; }
    return false;
  }, [formData.othersConfig]);

  useEffect(() => {
    if (shouldShowScoringSection) {
      setExpandedSections(prev => new Set(prev).add('scoring'));
    }
  }, [shouldShowScoringSection]);

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const generateCalendarDays = useCallback((year: number, month: number) => {
    const dim = new Date(year, month, 0).getDate();
    const fd = new Date(year, month - 1, 1).getDay();
    const days: (number | null)[] = [];
    for (let i = 0; i < fd; i++) days.push(null);
    for (let i = 1; i <= dim; i++) days.push(i);
    return days;
  }, []);

  const isDateDisabled = useCallback((year: number, month: number, day: number, fieldKey: string): boolean => {
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);

    // For start date: cannot be in the past
    if (fieldKey === 'startDate' && !isEditing) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date < today;
    }

    // For cutOffDate: cannot be before endDate
    if (fieldKey === 'cutOffDate') {
      const endDate = (formData.schedule as any).endDate;
      if (endDate && endDate.day > 0 && endDate.month > 0 && endDate.year > 0) {
        const endDateTime = new Date(endDate.year, endDate.month - 1, endDate.day);
        endDateTime.setHours(0, 0, 0, 0);
        return date < endDateTime;
      }
      const startDate = formData.schedule.startDate;
      if (startDate.day > 0 && startDate.month > 0 && startDate.year > 0) {
        const startDateTime = new Date(startDate.year, startDate.month - 1, startDate.day);
        startDateTime.setHours(0, 0, 0, 0);
        return date < startDateTime;
      }
    }

    // For grace period: cannot be before cutOffDate (or endDate if no cutOff)
    if (fieldKey === 'gracePeriodDate' && formData.schedule.gracePeriodEnabled) {
      const cutOffDate = (formData.schedule as any).cutOffDate;
      const refDate = ((formData.schedule as any).cutOffEnabled && cutOffDate?.day > 0)
        ? cutOffDate
        : (formData.schedule as any).endDate;
      if (refDate && refDate.day > 0 && refDate.month > 0 && refDate.year > 0) {
        const refDT = new Date(refDate.year, refDate.month - 1, refDate.day);
        refDT.setHours(0, 0, 0, 0);
        return date < refDT;
      }
    }

    return false;
  }, [isEditing, formData.schedule.startDate, formData.schedule, formData.schedule.gracePeriodEnabled]);


  // ==========================================================================
  // RENDER: Exercise Type Step
  // ==========================================================================
  const renderExerciseType = useCallback(() => (
    <ExerciseTypeStep
      formData={formData}
      validationErrors={validationErrors}
      touchedFields={touchedFields}
      onSelectType={handleSelectExerciseType}
    />
  ), [formData.exerciseType, validationErrors, touchedFields, handleSelectExerciseType]);
  // ==========================================================================
  // RENDER: Exercise Details
  // ==========================================================================
  const renderExerciseDetails = useCallback(() => (
    <ExerciseDetailsStep
      formData={formData}
      setFormData={setFormData}
      validationErrors={validationErrors}
      setValidationErrors={setValidationErrors}
      touchedFields={touchedFields}
      markTouched={markTouched}
      handleSelectExerciseType={handleSelectExerciseType}
      configuredLanguages={configuredLanguages}
      isLockedForEdit={isLockedForEdit}
      steps={steps}
      savedSteps={savedSteps}
    />
  ), [formData, validationErrors, touchedFields, markTouched, handleSelectExerciseType, configuredLanguages, isLockedForEdit, steps, savedSteps, setFormData, setValidationErrors]);
  // ==========================================================================
  // RENDER: MCQ Configuration (RESTORED: question specific mode info)
  // ==========================================================================
  const renderMCQConfiguration = useCallback(() => {
    const isMCQScoringLocked = savedSteps.has('Question Configuration');

    const isEqual = formData.mcqConfig.scoreSettings.scoreType === 'equalDistribution';
    const isCombined = formData.exerciseType === 'Combined';
    const totalToUse = isCombined ? formData.totalMarksMCQ : formData.totalMarks;
    const allocated = isEqual ? formData.mcqConfig.generalQuestionCount * formData.mcqConfig.scoreSettings.equalDistribution : 0;
    const isMatch = isEqual ? isApproximatelyEqual(allocated, totalToUse) : true;
    const mcqRemainingMarks = Math.max(0, totalToUse - (isEqual ? allocated : 0));
    return (
      <div className="es-step" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* MCQ heading — Combined tabs only */}
        {isCombined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EFF6FF', color: D.blue, flexShrink: 0 }}><List size={13} /></div>
            <h3 style={{ fontSize: 12.6, fontWeight: 700, color: D.textMain }}>MCQ Configuration</h3>
          </div>
        )}

        {/* ── QUESTIONS & SCORING ── */}
        <div style={SPEC_CARD}>
          <div className="es-card-h" style={SPEC_CARD_H}>
            <span style={SPEC_CARD_T}>Questions &amp; Scoring</span>
            {formData.isGraded !== false && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <span className="es-pill" style={SPEC_PILL.blue}>
                  Total <strong>{totalToUse}</strong>
                </span>
                <span className="es-pill" style={isEqual && allocated > 0 ? SPEC_PILL.green : SPEC_PILL.grey}>
                  Used <strong>{isEqual ? formatDecimal(allocated) : '—'}</strong>
                </span>
                <span className="es-pill" style={!isEqual ? SPEC_PILL.grey : (mcqRemainingMarks === 0 ? SPEC_PILL.green : (mcqRemainingMarks > 0 ? SPEC_PILL.amber : SPEC_PILL.red))}>
                  Remaining <strong>{isEqual ? formatDecimal(mcqRemainingMarks) : '—'}</strong>
                </span>
              </div>
            )}
          </div>
          <div className="es-card-b" style={{ ...SPEC_CARD_B, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {/* One ConfigRow per field — same .fieldRow shape as General. */}
          <div className={assignmentStyles.generalFields}>
            {/* Scoring Type — hidden when Non-Graded */}
            {formData.isGraded !== false && (
              <ConfigRow label="Scoring type" required
                help="Equal Distribution splits marks evenly across all questions; Question Specific lets you set marks per question individually"
                note={isEqual ? 'All questions will have equal marks, auto-calculated from total.' : 'Set individual marks per question when creating them.'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 280 }}>
                    <ODropdown
                      value={formData.mcqConfig.scoreSettings.scoreType}
                      options={mcqScoringOptions}
                      disabled={isMCQScoringLocked}
                      onChange={v => {
                        const tot = isCombined ? formData.totalMarksMCQ : formData.totalMarks;
                        setFormData(prev => ({ ...prev, mcqConfig: { ...prev.mcqConfig, scoreSettings: { ...prev.mcqConfig.scoreSettings, scoreType: v as any, equalDistribution: v === 'equalDistribution' && prev.mcqConfig.generalQuestionCount > 0 ? tot / prev.mcqConfig.generalQuestionCount : 0, totalMarks: tot } } }));
                      }}
                    />
                  </div>
                  {isMCQScoringLocked && <span className="es-pill" style={SPEC_PILL.amber}>Locked</span>}
                </div>
              </ConfigRow>
            )}

            {/* Total Questions — always visible */}
            <ConfigRow label="Total questions" required help="Total number of MCQ questions"
              error={touchedFields.has('mcqGeneralQuestionCount') ? validationErrors.mcqGeneralQuestionCount : undefined}>
              <div style={{ width: 140 }}>
                <ONumberInput value={formData.mcqConfig.generalQuestionCount}
                  liveUpdate
                  onChange={v => {
                    const tot = isCombined ? formData.totalMarksMCQ : formData.totalMarks;
                    setFormData(prev => ({ ...prev, mcqConfig: { ...prev.mcqConfig, generalQuestionCount: v, scoreSettings: { ...prev.mcqConfig.scoreSettings, equalDistribution: v > 0 && tot > 0 ? tot / v : 0 } } }));
                    if (v > 0) setValidationErrors(prev => { const e = { ...prev }; delete e.mcqGeneralQuestionCount; return e; });
                  }}
                  onBlur={() => markTouched('mcqGeneralQuestionCount')} min={0} placeholder="e.g. 10" />
              </div>
            </ConfigRow>

            {/* Marks Per Question — graded + equal distribution only */}
            {formData.isGraded !== false && isEqual && (
              <ConfigRow label="Marks per question" help="Auto-calculated: total marks divided by total questions"
                note={formData.mcqConfig.generalQuestionCount > 0 && formData.mcqConfig.scoreSettings.equalDistribution > 0
                  ? `${totalToUse} ÷ ${formData.mcqConfig.generalQuestionCount} = ${formatDecimal(formData.mcqConfig.scoreSettings.equalDistribution)}`
                  : 'Calculated automatically'}>
                <input readOnly className={assignmentStyles.shortInput}
                  value={formatDecimal(formData.mcqConfig.scoreSettings.equalDistribution)} />
              </ConfigRow>
            )}
          </div>

          {/* Question Specific Mode info — graded only */}
          {formData.isGraded !== false && !isEqual && (
            <div className="es-note" style={SPEC_NOTE.info}>
              <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontWeight: 700 }}>Question Specific Mode</div>
                <div>
                  Assign individual marks per question when creating them. Sum must equal <strong>{totalToUse}</strong>.
                  Question count is not tracked in this mode.
                </div>
              </div>
            </div>
          )}

          {formData.isGraded !== false && validationErrors.totalMarks && touchedFields.has('totalMarks') && !isCombined && (
            <div className="es-note" style={SPEC_NOTE.bad}>
              <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} /><span>{validationErrors.totalMarks}</span>
            </div>
          )}
          </div>
        </div>

        {/* ── ATTEMPTS ── */}
        <div style={SPEC_CARD}>
          <div className="es-card-h" style={SPEC_CARD_H}>
            <span style={SPEC_CARD_T}>Attempts</span>
          </div>
          <div className="es-card-b" style={{ ...SPEC_CARD_B, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div className={`${assignmentStyles.generalFields} es-subfields`}>
              <ConfigRow label="Attempt limit"
                help="When ON, students can submit only a limited number of times. When OFF, they can attempt this exercise any number of times."
                note={formData.mcqConfig.attemptLimitEnabled ? undefined : 'Students can attempt this exercise any number of times.'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
                  <button type="button" role="switch" aria-checked={formData.mcqConfig.attemptLimitEnabled}
                    onClick={() => setFormData(prev => ({ ...prev, mcqConfig: { ...prev.mcqConfig, attemptLimitEnabled: !prev.mcqConfig.attemptLimitEnabled, submissionAttempts: !prev.mcqConfig.attemptLimitEnabled ? prev.mcqConfig.submissionAttempts : 1 } }))}
                    style={{
                      position: 'relative', width: 35, height: 20, borderRadius: 999, border: 'none',
                      cursor: 'pointer', flexShrink: 0, transition: 'background .16s',
                      background: formData.mcqConfig.attemptLimitEnabled ? D.emerald : '#DEDAD5',
                    }}>
                    <span style={{
                      position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
                      background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'transform .16s',
                      transform: formData.mcqConfig.attemptLimitEnabled ? 'translateX(15px)' : 'none',
                    }} />
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: formData.mcqConfig.attemptLimitEnabled ? D.emerald : D.textHint }}>
                    {formData.mcqConfig.attemptLimitEnabled ? 'Enabled' : 'Off'}
                  </span>
                </div>
              </ConfigRow>
              {formData.mcqConfig.attemptLimitEnabled && (
                <ConfigRow label="Attempts allowed" help="Maximum number of times a student can submit their MCQ answers (1–10)">
                  <div style={{ width: 140 }}>
                    <ONumberInput
                      value={formData.mcqConfig.submissionAttempts}
                      onChange={v => setFormData(prev => ({ ...prev, mcqConfig: { ...prev.mcqConfig, submissionAttempts: Math.max(1, Math.min(10, v)) } }))}
                      min={1} max={10} />
                  </div>
                </ConfigRow>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [formData.mcqConfig, formData.totalMarks, formData.totalMarksMCQ, formData.exerciseType, mcqScoringOptions, validationErrors, touchedFields, markTouched]);

  // ==========================================================================
  // RENDER: Others Configuration
  // ==========================================================================
  // ==========================================================================
  // RENDER: Others Configuration (EXACT MATCH to Programming UI)
  // ==========================================================================
  // ==========================================================================
  // RENDER: Others Configuration (FIXED)
  // ==========================================================================
  const renderOthersConfiguration = useCallback(() => {
    const totalToUse = formData.totalMarks;
    const isMatch = isApproximatelyEqual(othersAllocatedMarks, totalToUse);
    const total = formData.exerciseType === 'Combined' ? (formData.totalMarksProgramming ?? 0) : (formData.totalMarks ?? 0);

    const progUsedMarks = othersAllocatedMarks;
    const progRemainingMarks = Math.max(0, totalToUse - progUsedMarks);

    const renderScoringConfiguration = () => {
      const counts = formData.othersConfig.questionConfigType === 'selectionLevel'
        ? formData.othersConfig.selectionLevelCounts
        : formData.othersConfig.levelBasedCounts;
      const ls = formData.othersConfig.scoreSettings.levelScoringConfiguration;
      const scoringErrors = (validationErrors.othersLevelScoring as Record<string, string>) || {};
      const levelStyles = {
        easy: { label: 'Easy', color: D.emerald, bg: D.emerald + '10', border: D.border2 },
        medium: { label: 'Medium', color: D.amber, bg: D.amber + '10', border: D.border2 },
        hard: { label: 'Hard', color: D.red, bg: D.red + '10', border: D.border2 },
      };
      const activeLevels = (['easy', 'medium', 'hard'] as const).filter(l => counts[l] > 0);

      return (
        <div className="grid grid-cols-3 gap-2">
          {activeLevels.map(level => {
            const count = counts[level];
            const scoring = ls[level];
            const style = levelStyles[level];
            const hasError = touchedFields.has(`scoring_others_${level}`) && !!scoringErrors[level];
            const isQSpec = scoring?.type === 'question_specific';
            const total = isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0) * count;

            return (
              <div key={level} className="p-2.5 rounded-lg border flex flex-col gap-1.5"
                style={{
                  background: hasError ? '#fff2f2' : style.bg,
                  borderColor: hasError ? D.red + '40' : style.border
                }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold" style={{ color: style.color, fontFamily: FONT }}>{style.label}</span>
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: style.color + '20', color: style.color }}>{count} Question</span>
                </div>
                <div>
                  <div className="text-[9px] font-semibold mb-1" style={{ color: D.textMuted }}>TYPE</div>
                  <ODropdown
                    value={scoring?.type || 'level_specific'}
                    options={[
                      { value: 'level_specific',    label: 'Same Marks' },
                      { value: 'question_specific', label: 'Individual' },
                    ]}
                    onChange={v => updateOthersLevelScoringConfig(level, {
                      type: v as any,
                      ...(v === 'level_specific'
                        ? { marksPerQuestion: 2, totalMarks: undefined }
                        : { totalMarks: 10, marksPerQuestion: undefined }),
                    })}
                  />
                </div>
                <div>
                  <div className="text-[9px] font-semibold mb-1" style={{ color: D.textMuted }}>{isQSpec ? 'TOTAL MARKS' : 'PER QUESTION'}</div>
                  <ONumberInput value={isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0)}
                    onChange={v => updateOthersLevelScoringConfig(level, isQSpec ? { totalMarks: v } : { marksPerQuestion: v })}
                    liveUpdate
                    className="text-xs" />
                </div>
                <div className="text-[10px] text-center font-semibold pt-1 border-t" style={{ borderColor: D.border2, color: style.color }}>
                  = {total} marks
                </div>
                {hasError && <p className="text-[10px]" style={{ color: D.red }}>{scoringErrors[level]}</p>}
              </div>
            );
          })}
        </div>
      );
    };

    const levelColors = { easy: D.emerald, medium: D.amber, hard: D.red };
    const scoringCounts = formData.othersConfig.questionConfigType === 'selectionLevel'
      ? formData.othersConfig.selectionLevelCounts
      : formData.othersConfig.levelBasedCounts;
    const ls = formData.othersConfig.scoreSettings.levelScoringConfiguration;
    const scoringErrors = (validationErrors.othersLevelScoring as Record<string, string>) || {};
    const activeScoringLevels = (['easy', 'medium', 'hard'] as const).filter(l => scoringCounts[l] > 0);

    return (
      <div className="es-step" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* Heading */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: D.surface2, color: D.textSub, flexShrink: 0 }}>
            <FolderOpen size={13} />
          </div>
          <div>
            <h3 style={{ fontSize: 12.6, fontWeight: 700, color: D.textMain }}>Others Configuration</h3>
            <p style={{ fontSize: 11, color: D.textMuted }}>File upload, Notion, and custom tasks</p>
          </div>
        </div>

        {/* ── QUESTIONS & SCORING ── */}
        <div style={SPEC_CARD}>
          <div className="es-card-h" style={SPEC_CARD_H}>
            <span style={SPEC_CARD_T}>Questions &amp; Scoring</span>
            {formData.othersConfig.questionConfigType !== 'general' && formData.isGraded !== false && (
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <span className="es-pill" style={SPEC_PILL.blue}>
                  Total <strong>{totalToUse}</strong>
                </span>
                <span className="es-pill" style={progUsedMarks > 0 ? SPEC_PILL.green : SPEC_PILL.grey}>
                  Used <strong>{formatDecimal(progUsedMarks)}</strong>
                </span>
                <span className="es-pill" style={progRemainingMarks === 0 ? SPEC_PILL.green : (progRemainingMarks > 0 ? SPEC_PILL.amber : SPEC_PILL.red)}>
                  Remaining <strong>{formatDecimal(progRemainingMarks)}</strong>
                </span>
              </div>
            )}
          </div>
          <div className="es-card-b" style={{ ...SPEC_CARD_B, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {formData.othersConfig.questionConfigType === 'general' ? (
              /* ── GENERAL: each field its own row (label left, control right)
                 like the General section. Rendered as a Fragment so each field
                 div is a direct child of .es-card-b and picks up the 2-col
                 label|control CSS. */
              <div className={assignmentStyles.generalFields}>
                <ConfigRow label="Config strategy" required
                  help="General: fixed question count; Level Based: questions by difficulty (Easy/Medium/Hard); Selection Level: pick up to 2 difficulty levels">
                  <div style={{ width: 280 }}>
                    <ODropdown value={formData.othersConfig.questionConfigType} options={configOptions}
                      onChange={v => {
                        const applyChange = () => {
                          setFormData(prev => ({
                            ...prev,
                            othersConfig: {
                              ...prev.othersConfig,
                              questionConfigType: v as any,
                              ...(v === 'general'
                                ? { generalQuestionCount: 0, levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                                : { levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                              )
                            }
                          }));
                          setLevelScoringOpen({ easy: false, medium: false, hard: false });
                        };
                        if (isEditing && formData.othersConfig.questionConfigType &&
                            formData.othersConfig.questionConfigType !== v) {
                          setWarningModal({
                            title: 'Change Config strategy?',
                            body: 'This will reset the question counts and per-level scoring for this exercise, and any questions attached under the previous strategy will be detached.',
                            confirmLabel: 'Change strategy',
                            onConfirm: applyChange,
                          });
                          return;
                        }
                        applyChange();
                      }} />
                  </div>
                </ConfigRow>
                <ConfigRow label="Total questions" required help="Total number of questions in this exercise"
                  error={touchedFields.has('othersGeneralQuestionCount') ? validationErrors.othersGeneralQuestionCount : undefined}>
                  <div style={{ width: 140 }}>
                    <ONumberInput value={formData.othersConfig.generalQuestionCount}
                      onChange={v => {
                        if (v > 0) setValidationErrors(prev => { const e = { ...prev }; delete e.othersGeneralQuestionCount; return e; });
                        setFormData(prev => ({
                          ...prev,
                          othersConfig: {
                            ...prev.othersConfig,
                            generalQuestionCount: v,
                            scoreSettings: {
                              ...prev.othersConfig.scoreSettings,
                              equalDistribution: v > 0 && totalToUse > 0 ? totalToUse / v : 0
                            }
                          }
                        }));
                      }}
                      onBlur={() => markTouched('othersGeneralQuestionCount')} min={0} placeholder="e.g. 5" />
                  </div>
                </ConfigRow>
                <ConfigRow label="Marks per question" help="Auto-calculated: total marks divided by total questions"
                  note="Calculated automatically">
                  <input readOnly className={assignmentStyles.shortInput}
                    value={formData.othersConfig.scoreSettings.equalDistribution > 0 ? formatDecimal(formData.othersConfig.scoreSettings.equalDistribution) : '0'} />
                </ConfigRow>
              </div>
            ) : (
              /* ── LEVEL BASED / SELECTION LEVEL ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Config Strategy — standalone row */}
                <div style={{ maxWidth: 340 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                    <span style={{ ...SPEC_LABEL, marginBottom: 0 }}>
                      Config Strategy <span style={{ color: D.orange }}>*</span>
                    </span>
                    <InfoTooltip content="General: fixed question count; Level Based: questions by difficulty (Easy/Medium/Hard); Selection Level: pick up to 2 difficulty levels" side="right" />
                  </div>
                  <ODropdown value={formData.othersConfig.questionConfigType} options={configOptions}
                    onChange={v => {
                      setFormData(prev => ({
                        ...prev,
                        othersConfig: {
                          ...prev.othersConfig,
                          questionConfigType: v as any,
                          ...(v === 'general'
                            ? { generalQuestionCount: 0, levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                            : { levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                          )
                        }
                      }));
                      setLevelScoringOpen({ easy: false, medium: false, hard: false });
                    }} />
                </div>
                {/* Pattern total — compact: input + live sum chip only. */}
                {(() => {
                  const c = formData.othersConfig.questionConfigType === 'levelBased'
                    ? formData.othersConfig.levelBasedCounts
                    : formData.othersConfig.selectionLevelCounts;
                  const sum = (c.easy || 0) + (c.medium || 0) + (c.hard || 0);
                  const target = (formData.othersConfig as any).patternTotal || 0;
                  const balanced = target > 0 && sum === target;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Hash size={12} style={{ color: D.textMuted }} />
                        <span style={{ ...SPEC_LABEL, marginBottom: 0 }}>
                          Total Questions <span style={{ color: D.orange }}>*</span>
                        </span>
                        <InfoTooltip content="Total pattern size. Easy + Medium + Hard must equal this." side="right" />
                      </div>
                      <div style={{ width: 96 }}>
                        <ONumberInput
                          value={target === 0 ? ('' as any) : target}
                          liveUpdate
                          min={0}
                          placeholder="e.g. 15"
                          onChange={v => {
                            setFormData(prev => ({
                              ...prev,
                              othersConfig: { ...prev.othersConfig, patternTotal: v || 0 } as any
                            }));
                          }}
                        />
                      </div>
                      <span className="es-pill" style={balanced ? SPEC_PILL.green : SPEC_PILL.amber}>
                        {balanced ? '✓' : '⚠'} E + M + H = <strong>{sum}</strong>{target > 0 ? <> / {target}</> : null}
                      </span>
                    </div>
                  );
                })()}
                {/* Level mismatch — bad note (marks pills live in the card header) */}
                {othersLevelMismatch && (
                  <div className="es-note" style={SPEC_NOTE.bad}>
                    <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>{othersLevelMismatch}</span>
                  </div>
                )}

                {(() => {
                  const isSelLevel = formData.othersConfig.questionConfigType === 'selectionLevel';
                  const bodyCell = (level: 'easy' | 'medium' | 'hard'): React.CSSProperties => ({ ...SPEC_MATRIX_CELL, background: SPEC_LEVEL_TINT[level], borderTop: `1px solid ${D.border}` });
                  return (
                    <div>
                      {/* Difficulty matrix — 110px row-label column + 3 tinted level columns */}
                      <div className="es-matrix-grid" style={SPEC_MATRIX}>
                        {/* Header row */}
                        <div style={SPEC_MATRIX_HCELL} />
                        {(['easy', 'medium', 'hard'] as const).map(level => {
                          if (isSelLevel) {
                            const checked = (formData.othersConfig.selectionLevelCounts?.[level] ?? 0) > 0;
                            return (
                              <div key={level} style={{ ...SPEC_MATRIX_HCELL, background: SPEC_LEVEL_TINT[level] }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                  <input type="checkbox" checked={checked} onChange={e => {
                                    const nc = { ...formData.othersConfig.selectionLevelCounts, [level]: e.target.checked ? 1 : 0 };
                                    const active = (['easy', 'medium', 'hard'] as const).filter(l => nc[l] > 0).length;
                                    if (active > 2) setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, questionConfigType: 'levelBased', levelBasedCounts: { easy: nc.easy > 0 ? nc.easy : 1, medium: nc.medium > 0 ? nc.medium : 1, hard: nc.hard > 0 ? nc.hard : 1 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } } }));
                                    else setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, selectionLevelCounts: nc } }));
                                  }} style={{ width: 13, height: 13, accentColor: SPEC_LEVEL_DOT[level] }} />
                                  <span style={{ ...SPEC_DOT, background: SPEC_LEVEL_DOT[level] }} />
                                  <span style={{ color: SPEC_LEVEL_TEXT[level] }}>{level}</span>
                                </label>
                              </div>
                            );
                          }
                          return (
                            <div key={level} style={{ ...SPEC_MATRIX_HCELL, background: SPEC_LEVEL_TINT[level], display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ ...SPEC_DOT, background: SPEC_LEVEL_DOT[level] }} />
                              <span style={{ color: SPEC_LEVEL_TEXT[level] }}>{level}</span>
                            </div>
                          );
                        })}
                        {/* Row 1: Questions */}
                        <MatrixLabel style={SPEC_MATRIX_RLABEL} help={MATRIX_HELP.questions}>Questions</MatrixLabel>
                        {(['easy', 'medium', 'hard'] as const).map(level => {
                          const checked = isSelLevel ? (formData.othersConfig.selectionLevelCounts?.[level] ?? 0) > 0 : true;
                          const ek = `othersLevelCounts_${level.charAt(0).toUpperCase() + level.slice(1)}`;
                          const val = isSelLevel
                            ? (formData.othersConfig.selectionLevelCounts?.[level] === 0 ? ('' as any) : formData.othersConfig.selectionLevelCounts?.[level])
                            : (formData.othersConfig.levelBasedCounts?.[level] === 0 ? ('' as any) : formData.othersConfig.levelBasedCounts?.[level]);
                          const handleChange = isSelLevel
                            ? (v: number) => setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, selectionLevelCounts: { ...prev.othersConfig.selectionLevelCounts, [level]: v } } }))
                            : (v: number) => { setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, levelBasedCounts: { ...prev.othersConfig.levelBasedCounts, [level]: v } } })); if (v > 0) setValidationErrors(prev => { const e = { ...prev }; delete e[ek]; return e; }); setTouchedFields(prev => { const n = new Set(prev); n.delete('scoring_others_easy'); n.delete('scoring_others_medium'); n.delete('scoring_others_hard'); return n; }); };
                          return (
                            <div key={level} style={bodyCell(level)}>
                              <ONumberInput value={val} onChange={handleChange}
                                onBlur={isSelLevel ? undefined : () => markTouched('othersLevelCounts')}
                                disabled={isSelLevel && !checked} min={0}
                                placeholder={isSelLevel && !checked ? '—' : 'Count'}
                                error={!isSelLevel ? validationErrors[ek] : undefined}
                                touched={!isSelLevel ? touchedFields.has('othersLevelCounts') : undefined} />
                            </div>
                          );
                        })}
                        {formData.isGraded !== false && (<>
                        {/* Row 2: Marking */}
                        <MatrixLabel style={SPEC_MATRIX_RLABEL} help={MATRIX_HELP.distribution}>Mark Distribution</MatrixLabel>
                        {(['easy', 'medium', 'hard'] as const).map(level => {
                          const count = scoringCounts[level];
                          const scoring = ls[level];
                          const hasError = touchedFields.has(`scoring_others_${level}`) && !!scoringErrors[level];
                          return (
                            <div key={level} style={{ ...bodyCell(level), opacity: count === 0 ? 0.4 : 1, pointerEvents: count === 0 ? 'none' : 'auto' }}>
                              <ODropdown
                                value={scoring?.type || 'level_specific'}
                                options={[
                                  { value: 'level_specific',    label: 'Same Marks' },
                                  { value: 'question_specific', label: 'Individual' },
                                ]}
                                error={hasError ? 'invalid' : undefined}
                                touched={hasError}
                                onChange={v => updateOthersLevelScoringConfig(level, {
                                  type: v as any,
                                  ...(v === 'level_specific'
                                    ? { marksPerQuestion: 2, totalMarks: undefined }
                                    : { totalMarks: 10, marksPerQuestion: undefined }),
                                })}
                              />
                            </div>
                          );
                        })}
                        {/* Row 3: Marks */}
                        <MatrixLabel style={SPEC_MATRIX_RLABEL} help={MATRIX_HELP.marks}>Marks</MatrixLabel>
                        {(['easy', 'medium', 'hard'] as const).map(level => {
                          const count = scoringCounts[level];
                          const scoring = ls[level];
                          const isQSpec = scoring?.type === 'question_specific';
                          const hasError = touchedFields.has(`scoring_others_${level}`) && !!scoringErrors[level];
                          return (
                            <div key={level} style={{ ...bodyCell(level), opacity: count === 0 ? 0.4 : 1, pointerEvents: count === 0 ? 'none' : 'auto' }}>
                              <div className="es-marks-cell" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ONumberInput value={isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0)}
                                  onChange={v => updateOthersLevelScoringConfig(level, isQSpec ? { totalMarks: v } : { marksPerQuestion: v })}
                                  liveUpdate />
                                <span style={{ fontSize: 10.5, color: D.textMuted, whiteSpace: 'nowrap' }}>
                                  {isQSpec ? 'Total' : '/ Question'}
                                </span>
                              </div>
                              {hasError && <span style={{ fontSize: 11.4, color: D.red }}>{scoringErrors[level]}</span>}
                            </div>
                          );
                        })}
                        {/* Row 4: Calculated Total — derived, text only */}
                        <MatrixLabel style={SPEC_MATRIX_RLABEL} help={MATRIX_HELP.total}>Calculated Total</MatrixLabel>
                        {(['easy', 'medium', 'hard'] as const).map(level => {
                          const count = scoringCounts[level];
                          if (count === 0) return <div key={level} style={bodyCell(level)} />;
                          const scoring = ls[level];
                          const isQSpec = scoring?.type === 'question_specific';
                          const mpq = scoring?.marksPerQuestion || 0;
                          return (
                            <div key={level} style={{ ...bodyCell(level), fontSize: 12.6, fontWeight: 600, color: SPEC_LEVEL_TEXT[level] }}>
                              {isQSpec ? (
                                <div>{formatDecimal(scoring?.totalMarks || 0)} Marks</div>
                              ) : (
                                <>
                                  <div>{formatDecimal(count * mpq)} Marks</div>
                                  <div style={{ fontSize: 10.5, fontWeight: 400, color: D.textMuted }}>
                                    {count} × {formatDecimal(mpq)}
                                  </div>
                                </>
                              )}
                            </div>
                          );
                        })}
                        </>)}
                      </div>
                      {!isSelLevel && validationErrors.othersLevelCounts && touchedFields.has('othersLevelCounts') && (
                        <p style={{ marginTop: 5, fontSize: 11.4, color: D.red }}>{validationErrors.othersLevelCounts}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* ── QUESTION FLOW · ATTEMPTS — one ConfigRow per field, same
            .fieldRow shape as the General section. ── */}
        <div className={`${assignmentStyles.generalFields} es-subfields`}
          style={othersLevelMismatch ? { opacity: 0.4, pointerEvents: 'none' as const } : undefined}>
          <ConfigRow label="Question flow" required
            help="Free Flow lets students answer in any order; Controlled Flow locks the sequence.">
            <div style={{
              display: 'flex', background: D.surface2, border: `1px solid ${D.border2}`,
              borderRadius: 8, padding: 3, gap: 3, height: 40, boxSizing: 'border-box', maxWidth: 420,
            }}>
              {questionFlowOptions.map(opt => {
                const sel = formData.othersConfig.questionFlow === opt.value;
                return (
                  <button key={opt.value} type="button" aria-pressed={sel}
                    onClick={() => setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, questionFlow: opt.value as any } }))}
                    style={{
                      flex: 1, height: '100%', border: 'none', borderRadius: 5, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      fontSize: 13, fontWeight: 600,
                      background: sel ? '#fff' : 'transparent',
                      color: sel ? D.orangeDark : D.textMuted,
                      boxShadow: sel ? '0 1px 3px rgba(15,23,42,.1)' : 'none',
                      transition: 'all .16s',
                    }}>
                    <span style={{ display: 'inline-flex' }}>{opt.icon}</span>{opt.label}
                  </button>
                );
              })}
            </div>
          </ConfigRow>
        </div>

        <div className={`${assignmentStyles.generalFields} es-subfields`}>
          <ConfigRow label="Attempt limit"
            help="When ON, students can submit only a limited number of times. When OFF, they can attempt this exercise any number of times."
            note={formData.othersConfig.attemptLimitEnabled ? undefined : 'Students can attempt this exercise any number of times.'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
              <button type="button" role="switch" aria-checked={formData.othersConfig.attemptLimitEnabled}
                onClick={() => setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, attemptLimitEnabled: !prev.othersConfig.attemptLimitEnabled, submissionAttempts: !prev.othersConfig.attemptLimitEnabled ? prev.othersConfig.submissionAttempts : 1 } }))}
                style={{
                  position: 'relative', width: 35, height: 20, borderRadius: 999, border: 'none',
                  cursor: 'pointer', flexShrink: 0, transition: 'background .16s',
                  background: formData.othersConfig.attemptLimitEnabled ? D.emerald : '#DEDAD5',
                }}>
                <span style={{
                  position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'transform .16s',
                  transform: formData.othersConfig.attemptLimitEnabled ? 'translateX(15px)' : 'none',
                }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: formData.othersConfig.attemptLimitEnabled ? D.emerald : D.textHint }}>
                {formData.othersConfig.attemptLimitEnabled ? 'Enabled' : 'Off'}
              </span>
            </div>
          </ConfigRow>
          {formData.othersConfig.attemptLimitEnabled && (
            <ConfigRow label="Attempts allowed" help="Maximum number of submission attempts allowed per student (1–10)">
              <div style={{ width: 140 }}>
                <ONumberInput
                  value={formData.othersConfig.submissionAttempts}
                  onChange={v => setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, submissionAttempts: Math.max(1, Math.min(10, v)) } }))}
                  min={1} max={10} />
              </div>
            </ConfigRow>
          )}
        </div>

        {validationErrors.othersTotalMarks && touchedFields.has('othersTotalMarks') && (
          <div className="es-note" style={SPEC_NOTE.bad}>
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} /><span>{validationErrors.othersTotalMarks}</span>
          </div>
        )}
      </div>
    );
  }, [formData, validationErrors, touchedFields, markTouched, othersAllocatedMarks, othersLevelMismatch, othersShouldShowScoringSection, questionFlowOptions, updateOthersLevelScoringConfig, configOptions]);
  // ==========================================================================
  // ALL QUESTIONS REQUIRED (shared row)
  // ==========================================================================
  // Rendered in two places: paired beside Attempt Limit inside the Programming
  // config, and as a standalone strip under MCQ / Other / Combined. Kept as one
  // node so the two copies cannot drift apart. Label / toggle / status metrics
  // match the Attempt Limit row exactly so the pair lines up side by side.
  const allQuestionsRequiredRow = useMemo(() => (
    <ConfigRow label="All questions required"
      help="When ON, students must complete every question before they can submit. When OFF, partial submission is allowed."
      note={formData.allQuestionsRequired ? 'Students must answer every question before submitting.' : 'Partial submissions are allowed.'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
        <button type="button" role="switch" aria-checked={formData.allQuestionsRequired}
          onClick={() => setFormData(prev => ({ ...prev, allQuestionsRequired: !prev.allQuestionsRequired }))}
          style={{
            position: 'relative', width: 35, height: 20, borderRadius: 999, border: 'none',
            cursor: 'pointer', flexShrink: 0, transition: 'background .16s',
            background: formData.allQuestionsRequired ? D.emerald : '#DEDAD5',
          }}>
          <span style={{
            position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
            background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'transform .16s',
            transform: formData.allQuestionsRequired ? 'translateX(15px)' : 'none',
          }} />
        </button>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: formData.allQuestionsRequired ? D.emerald : D.textHint,
        }}>
          {formData.allQuestionsRequired ? 'Enabled' : 'Off'}
        </span>
      </div>
    </ConfigRow>
  ), [formData.allQuestionsRequired]);

  // ==========================================================================
  // RENDER: Programming Configuration
  // ==========================================================================
  const renderProgrammingConfiguration = useCallback(() => {
    const totalQs = getProgrammingTotalQuestions();
    const isCombined = formData.exerciseType === 'Combined';
    const totalToUse = isCombined ? formData.totalMarksProgramming : formData.totalMarks;
    const isMatch = isApproximatelyEqual(programmingAllocatedMarks, totalToUse);

    const levelColors = { easy: D.emerald, medium: D.amber, hard: D.red };
    const scoringCounts = formData.programmingConfig.questionConfigType === 'selectionLevel'
      ? formData.programmingConfig.selectionLevelCounts
      : formData.programmingConfig.levelBasedCounts;
    const ls = formData.programmingConfig.scoreSettings.levelScoringConfiguration;
    const scoringErrors = (validationErrors.programmingLevelScoring as Record<string, string>) || {};

    // Helper to update count and sync marks
    const updateLevelCount = (level: 'easy' | 'medium' | 'hard', newCount: number) => {
      if (formData.programmingConfig.questionConfigType === 'levelBased') {
        // Update levelBasedCounts
        const newCounts = {
          ...formData.programmingConfig.levelBasedCounts,
          [level]: newCount
        };

        // Get current scoring config for this level
        const currentScoring = ls[level] || { type: 'level_specific', marksPerQuestion: 5, questionCount: 0 };

        // Calculate new total marks
        const easyTotal = (newCounts.easy || 0) * (ls.easy?.marksPerQuestion || 0);
        const mediumTotal = (newCounts.medium || 0) * (ls.medium?.marksPerQuestion || 0);
        const hardTotal = (newCounts.hard || 0) * (ls.hard?.marksPerQuestion || 0);
        const newTotalMarks = easyTotal + mediumTotal + hardTotal;

        // Update scoring config with new question count
        const updatedScoring = {
          ...ls,
          [level]: {
            ...currentScoring,
            questionCount: newCount
          }
        };

        setFormData(prev => ({
          ...prev,
          programmingConfig: {
            ...prev.programmingConfig,
            levelBasedCounts: newCounts,
            scoreSettings: {
              ...prev.programmingConfig.scoreSettings,
              levelScoringConfiguration: updatedScoring,
              totalMarks: newTotalMarks
            }
          }
        }));

        // Clear validation errors
        if (newCount > 0) {
          setValidationErrors(prev => {
            const e = { ...prev };
            delete e[`programmingLevelCounts_${level.charAt(0).toUpperCase() + level.slice(1)}`];
            return e;
          });
        }
      }
    };

    // Helper to update marks and recalculate totals
    const updateLevelMarks = (level: 'easy' | 'medium' | 'hard', marksPerQuestion: number) => {
      if (formData.programmingConfig.questionConfigType === 'levelBased') {
        const counts = formData.programmingConfig.levelBasedCounts;
        const currentScoring = ls[level] || { type: 'level_specific', marksPerQuestion: 5, questionCount: counts[level] };

        // Calculate new total marks
        const easyTotal = (counts.easy || 0) * (level === 'easy' ? marksPerQuestion : (ls.easy?.marksPerQuestion || 0));
        const mediumTotal = (counts.medium || 0) * (level === 'medium' ? marksPerQuestion : (ls.medium?.marksPerQuestion || 0));
        const hardTotal = (counts.hard || 0) * (level === 'hard' ? marksPerQuestion : (ls.hard?.marksPerQuestion || 0));
        const newTotalMarks = easyTotal + mediumTotal + hardTotal;

        // Update scoring config
        const updatedScoring = {
          ...ls,
          [level]: {
            ...currentScoring,
            marksPerQuestion: marksPerQuestion,
            type: 'level_specific'
          }
        };

        setFormData(prev => ({
          ...prev,
          programmingConfig: {
            ...prev.programmingConfig,
            scoreSettings: {
              ...prev.programmingConfig.scoreSettings,
              levelScoringConfiguration: updatedScoring,
              levelBasedMarks: {
                ...prev.programmingConfig.scoreSettings.levelBasedMarks,
                [level]: marksPerQuestion
              },
              totalMarks: newTotalMarks
            }
          }
        }));

        // Clear validation errors
        setValidationErrors(prev => {
          const e = { ...prev };
          delete e.programmingTotalMarks;
          if (prev.programmingLevelScoring) {
            const ns = { ...prev.programmingLevelScoring };
            delete ns[level];
            if (Object.keys(ns).length) e.programmingLevelScoring = ns;
            else delete e.programmingLevelScoring;
          }
          return e;
        });
      }
    };

    // Helper for selection level updates
    const updateSelectionLevelCount = (level: 'easy' | 'medium' | 'hard', newCount: number) => {
      const newCounts = {
        ...formData.programmingConfig.selectionLevelCounts,
        [level]: newCount
      };

      // Calculate total marks from active levels
      const easyTotal = (newCounts.easy || 0) * (ls.easy?.marksPerQuestion || 0);
      const mediumTotal = (newCounts.medium || 0) * (ls.medium?.marksPerQuestion || 0);
      const hardTotal = (newCounts.hard || 0) * (ls.hard?.marksPerQuestion || 0);
      const newTotalMarks = easyTotal + mediumTotal + hardTotal;

      // Update scoring config with new question count for this level
      const updatedScoring = {
        ...ls,
        [level]: {
          ...ls[level],
          questionCount: newCount
        }
      };

      setFormData(prev => ({
        ...prev,
        programmingConfig: {
          ...prev.programmingConfig,
          selectionLevelCounts: newCounts,
          scoreSettings: {
            ...prev.programmingConfig.scoreSettings,
            levelScoringConfiguration: updatedScoring,
            totalMarks: newTotalMarks
          }
        }
      }));
    };

    const progUsedMarks = programmingAllocatedMarks;
    const progRemainingMarks = Math.max(0, totalToUse - progUsedMarks);

    // Level column tints + dot colors, per the demo's difficulty matrix.
    const LV = {
      easy: { label: 'Easy', dot: '#0F9D58', text: '#046C4E', tint: '#F7FDF9' },
      medium: { label: 'Medium', dot: '#F0A415', text: '#B54708', tint: '#FFFCF5' },
      hard: { label: 'Hard', dot: '#E0503C', text: '#B42318', tint: '#FFFAF9' },
    } as const;
    const MATRIX_LABEL: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: '#57606E' };
    const MCELL: React.CSSProperties = { padding: '7px 9px', borderBottom: `1px solid ${D.border}` };
    const MROW: React.CSSProperties = { display: 'grid', gridTemplateColumns: '110px repeat(3, minmax(0,1fr))' };
    const SELECT_STYLE: React.CSSProperties = {
      width: '100%', height: 34, padding: '0 28px 0 11px', borderRadius: 8,
      border: `1px solid ${D.border2}`, background: '#fff', color: D.textMain,
      fontSize: 12.6, outline: 'none', appearance: 'none',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' fill='none' stroke='%236B7280' stroke-width='1.4' stroke-linecap='round'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    };

    const isSelLevel = formData.programmingConfig.questionConfigType === 'selectionLevel';
    const isLevelMode = formData.programmingConfig.questionConfigType === 'levelBased' || isSelLevel;
    const mCounts = isSelLevel
      ? formData.programmingConfig.selectionLevelCounts
      : formData.programmingConfig.levelBasedCounts;
    // Mark Distribution / Marks / Calculated Total are always on screen in
    // level mode. They used to appear only once every difficulty had a count,
    // which hid the scoring controls behind a step the trainer had not been
    // told about. Levels with a zero count still dim their own cells, so an
    // unused level cannot be edited by accident.
    const showScoringRows = true;
    const patternTarget = formData.programmingConfig.patternTotal || 0;
    const patternSum = (mCounts.easy || 0) + (mCounts.medium || 0) + (mCounts.hard || 0);
    const patternBalanced = patternTarget > 0 && patternSum === patternTarget;
    const anyQuestionSpecific = (['easy', 'medium', 'hard'] as const)
      .some(l => (mCounts[l] || 0) > 0 && ls[l]?.type === 'question_specific');

    // Which levels are missing their marks. Same predicate programmingLevelMismatch
    // uses, so the field-level message and the gate can never disagree — this
    // only decides WHERE the error is shown, never whether it fires.
    const marksMissing = (l: 'easy' | 'medium' | 'hard'): boolean => {
      if ((mCounts[l] || 0) <= 0) return false;
      const sc = ls?.[l];
      if (!sc) return true;
      return sc.type === 'level_specific'
        ? !(sc.marksPerQuestion && sc.marksPerQuestion > 0)
        : !(sc.totalMarks && sc.totalMarks > 0);
    };
    // The banner keeps only what has no single field to attach to. The
    // "Please enter marks for: X" case now lives in the X column's own input.
    const mismatchIsPerField = !!programmingLevelMismatch
      && programmingLevelMismatch.startsWith('Please enter marks for:');

    // The demo's ± stepper.

    return (
      <div className="es-step" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {isCombined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: D.surface2, color: D.textSub, flexShrink: 0 }}>
              <Terminal size={13} />
            </div>
            <h3 style={{ fontSize: 12.6, fontWeight: 700, color: D.textMain }}>Programming Configuration</h3>
          </div>
        )}

        {/* ── Config Strategy · Total Questions · Marks / question ──
            One ConfigRow per field (label left, control right) — the same
            .fieldRow shape the General section uses. */}
        <div className={assignmentStyles.generalFields}>
          <ConfigRow label="Config strategy" required
            help="General: fixed question count; Level Based: questions by difficulty (Easy/Medium/Hard); Selection Level: pick up to 2 difficulty levels"
            note={isConfigStrategyLocked ? 'Config strategy is locked once questions have been added.' : undefined}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 280 }}>
                <ODropdown
                  value={formData.programmingConfig.questionConfigType}
                  options={configOptions}
                  disabled={isConfigStrategyLocked}
                  onChange={isConfigStrategyLocked ? () => { } : v => {
                    const applyChange = () => {
                      setFormData(prev => ({
                        ...prev,
                        programmingConfig: {
                          ...prev.programmingConfig,
                          questionConfigType: v as any,
                          ...(v === 'general'
                            ? { generalQuestionCount: 0, levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                            : { levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                          )
                        }
                      }));
                      setLevelScoringOpen({ easy: false, medium: false, hard: false });
                    };
                    if (isEditing && formData.programmingConfig.questionConfigType &&
                        formData.programmingConfig.questionConfigType !== v) {
                      setWarningModal({
                        title: 'Change Config strategy?',
                        body: 'This will reset the question counts and per-level scoring for this exercise, and any questions attached under the previous strategy will be detached.',
                        confirmLabel: 'Change strategy',
                        onConfirm: applyChange,
                      });
                      return;
                    }
                    applyChange();
                  }}
                />
              </div>
              {isConfigStrategyLocked && <span className="es-pill" style={SPEC_PILL.amber}>Locked</span>}
            </div>
          </ConfigRow>

          {formData.programmingConfig.questionConfigType === 'general' && (<>
            <ConfigRow label="Total questions" required help="Total number of programming questions in this exercise"
              error={touchedFields.has('programmingGeneralQuestionCount') ? validationErrors.programmingGeneralQuestionCount : undefined}>
              <div style={{ width: 140 }}>
                <ONumberInput
                  value={formData.programmingConfig.generalQuestionCount}
                  liveUpdate
                  onChange={v => {
                    if (v > 0) setValidationErrors(prev => { const e = { ...prev }; delete e.programmingGeneralQuestionCount; return e; });
                    setFormData(prev => {
                      const tot = prev.exerciseType === 'Combined' ? prev.totalMarksProgramming : prev.totalMarks;
                      return {
                        ...prev,
                        programmingConfig: {
                          ...prev.programmingConfig,
                          generalQuestionCount: v,
                          scoreSettings: { ...prev.programmingConfig.scoreSettings, equalDistribution: v > 0 && tot > 0 ? tot / v : 0 }
                        }
                      };
                    });
                  }}
                  onBlur={() => markTouched('programmingGeneralQuestionCount')}
                  min={0}
                  placeholder="e.g. 5"
                />
              </div>
            </ConfigRow>
            {formData.isGraded !== false && (
              <ConfigRow label="Marks per question" help="Auto-calculated: total marks divided by total questions"
                note="Calculated automatically">
                <input readOnly className={assignmentStyles.shortInput}
                  value={formatDecimal(formData.programmingConfig.scoreSettings.equalDistribution || 0)} />
              </ConfigRow>
            )}
          </>)}

          {isLevelMode && (
            <ConfigRow label="Total questions" required
              help="Total pattern size. Easy + Medium + Hard must equal this.">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ width: 140 }}>
                  <ONumberInput
                    value={patternTarget === 0 ? ('' as any) : patternTarget}
                    liveUpdate min={0} placeholder="e.g. 15"
                    onChange={v => setFormData(prev => ({
                      ...prev,
                      programmingConfig: { ...prev.programmingConfig, patternTotal: v || 0 }
                    }))}
                  />
                </div>
                <span style={{
                  ...(patternBalanced ? SPEC_PILL.green : (patternTarget > 0 ? SPEC_PILL.amber : SPEC_PILL.grey)),
                  height: 30,
                }}>
                  {patternBalanced ? '✓' : patternTarget > 0 ? '⚠' : ''} E + M + H = {patternSum}{patternTarget > 0 ? ` / ${patternTarget}` : ''}
                </span>
              </div>
            </ConfigRow>
          )}
        </div>

        {formData.programmingConfig.questionConfigType === '' ? (
          <div className="es-note" style={SPEC_NOTE.warn}>
            <span>⚠</span>
            <span>Please select a Config Strategy above to configure questions and scoring.</span>
          </div>
        ) : (<>

          {/* ── QUESTIONS & SCORING ──
              Hidden in General mode entirely: Total Questions and
              Marks / question already sit in the top row, so the section
              body has nothing to render and the header pills duplicate the
              tally that is one row away. Level Based / Selection Level
              keep the section because they need the difficulty matrix and
              the pills contextualise its per-level marks. */}
          {isLevelMode && (
          <div style={SPEC_CARD}>
            <div className="es-card-h" style={SPEC_CARD_H}>
              <span style={SPEC_CARD_T}>Questions &amp; Scoring</span>
              {formData.isGraded !== false && (
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <span className="es-pill" style={SPEC_PILL.blue}>Total <strong>{totalToUse}</strong></span>
                  <span className="es-pill" style={progUsedMarks > 0 ? SPEC_PILL.green : SPEC_PILL.grey}>
                    Used <strong>{formatDecimal(progUsedMarks)}</strong>
                  </span>
                  <span className="es-pill" style={progRemainingMarks === 0 ? SPEC_PILL.green : (progRemainingMarks > 0 ? SPEC_PILL.amber : SPEC_PILL.red)}>
                    Remaining <strong>{formatDecimal(progRemainingMarks)}</strong>
                  </span>
                </div>
              )}
            </div>

            <div className="es-card-b" style={{ ...SPEC_CARD_B, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(<>
                {/* ── Difficulty matrix ── */}
                <div className="es-matrix-wrap" style={{ border: `1px solid ${D.border2}`, borderRadius: 10, overflow: 'hidden' }}>
                  {/* Header */}
                  <div className="es-matrix" style={MROW}>
                    <div className="es-mcell" style={{ ...MCELL, background: '#FCFBFA' }} />
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      const checked = (formData.programmingConfig.selectionLevelCounts?.[level] ?? 0) > 0;
                      return (
                        <div key={level} style={{ ...MCELL, background: LV[level].tint }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {isSelLevel && (
                              <input type="checkbox" checked={checked}
                                onChange={e => {
                                  const nc = { ...formData.programmingConfig.selectionLevelCounts, [level]: e.target.checked ? 1 : 0 };
                                  const active = (['easy', 'medium', 'hard'] as const).filter(l => nc[l] > 0).length;
                                  if (active > 2) {
                                    setFormData(prev => ({
                                      ...prev,
                                      programmingConfig: {
                                        ...prev.programmingConfig,
                                        questionConfigType: 'levelBased',
                                        levelBasedCounts: { easy: nc.easy > 0 ? nc.easy : 1, medium: nc.medium > 0 ? nc.medium : 1, hard: nc.hard > 0 ? nc.hard : 1 },
                                        selectionLevelCounts: { easy: 0, medium: 0, hard: 0 }
                                      }
                                    }));
                                  } else {
                                    setFormData(prev => ({
                                      ...prev,
                                      programmingConfig: { ...prev.programmingConfig, selectionLevelCounts: nc }
                                    }));
                                  }
                                }}
                                style={{ width: 15, height: 15, accentColor: D.orange, cursor: 'pointer' }} />
                            )}
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: LV[level].dot, flex: 'none' }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: LV[level].text }}>{LV[level].label}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Questions */}
                  <div className="es-matrix" style={MROW}>
                    <MatrixLabel className="es-mcell" style={{ ...MCELL, ...MATRIX_LABEL }} help={MATRIX_HELP.questions}>Questions</MatrixLabel>
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      const checked = isSelLevel ? (formData.programmingConfig.selectionLevelCounts?.[level] ?? 0) > 0 : true;
                      const val = isSelLevel
                        ? (formData.programmingConfig.selectionLevelCounts?.[level] ?? 0)
                        : (formData.programmingConfig.levelBasedCounts?.[level] ?? 0);
                      return (
                        <div key={level} style={{ ...MCELL, background: LV[level].tint }}>
                          <ONumberInput
                            value={val}
                            liveUpdate
                            min={0}
                            disabled={isSelLevel && !checked}
                            placeholder={isSelLevel && !checked ? "—" : "Count"}
                            onChange={v => { if (isSelLevel) updateSelectionLevelCount(level, v); else updateLevelCount(level, v); }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {formData.isGraded !== false && showScoringRows && (<>
                    {/* Marking */}
                    <div className="es-matrix" style={MROW}>
                      <MatrixLabel className="es-mcell" style={{ ...MCELL, ...MATRIX_LABEL }} help={MATRIX_HELP.distribution}>Mark Distribution</MatrixLabel>
                      {(['easy', 'medium', 'hard'] as const).map(level => {
                        const count = scoringCounts[level];
                        const scoring = ls[level];
                        const isDisabled = isSelLevel ? count === 0 : false;
                        return (
                          <div key={level} style={{ ...MCELL, background: LV[level].tint, opacity: isDisabled ? 0.4 : 1, pointerEvents: isDisabled ? 'none' : 'auto' }}>
                            <ODropdown
                              value={scoring?.type || 'level_specific'}
                              options={[
                                { value: 'level_specific',    label: 'Same Marks' },
                                { value: 'question_specific', label: 'Individual' },
                              ]}
                              onChange={v => updateLevelScoringConfig(level, {
                                type: v as any,
                                ...(v === 'level_specific'
                                  ? { marksPerQuestion: scoring?.marksPerQuestion || 0, totalMarks: undefined }
                                  : { totalMarks: scoring?.totalMarks || 0, marksPerQuestion: undefined }
                                )
                              })}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* Marks */}
                    <div className="es-matrix" style={MROW}>
                      <MatrixLabel className="es-mcell" style={{ ...MCELL, ...MATRIX_LABEL }} help={MATRIX_HELP.marks}>Marks</MatrixLabel>
                      {(['easy', 'medium', 'hard'] as const).map(level => {
                        const count = scoringCounts[level];
                        const scoring = ls[level];
                        const isQSpec = scoring?.type === 'question_specific';
                        const isDisabled = isSelLevel ? count === 0 : false;
                        return (
                          <div key={level} style={{ ...MCELL, background: LV[level].tint, opacity: isDisabled ? 0.4 : 1, pointerEvents: isDisabled ? 'none' : 'auto' }}>
                            <div className="es-marks-cell" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <ONumberInput
                              value={isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0)}
                              liveUpdate
                              // Errors belong on the field, not in a banner
                              // below the matrix — the border reddens and the
                              // message sits directly under the offending cell.
                              error={scoringErrors[level] || (marksMissing(level) ? 'Enter marks' : undefined)}
                              touched
                              onChange={v => {
                                if (isQSpec) {
                                  updateLevelScoringConfig(level, { totalMarks: v });
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    programmingConfig: {
                                      ...prev.programmingConfig,
                                      scoreSettings: {
                                        ...prev.programmingConfig.scoreSettings,
                                        levelScoringConfiguration: {
                                          ...prev.programmingConfig.scoreSettings.levelScoringConfiguration,
                                          [level]: { ...prev.programmingConfig.scoreSettings.levelScoringConfiguration[level], marksPerQuestion: v }
                                        }
                                      }
                                    }
                                  }));
                                }
                              }}
                            />
                            {/* The unit sits beside the number so a column can
                                never be misread — one may hold a pot for the
                                level while its neighbour holds a rate. */}
                            <span style={{ fontSize: 10.5, color: D.textMuted, whiteSpace: 'nowrap' }}>
                              {isQSpec ? 'Total' : '/ Question'}
                            </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Calculated Total — DERIVED, never an input */}
                    <div className="es-matrix" style={MROW}>
                      <MatrixLabel className="es-mcell" style={{ ...MCELL, ...MATRIX_LABEL, borderBottom: 'none' }} help={MATRIX_HELP.total}>Calculated Total</MatrixLabel>
                      {(['easy', 'medium', 'hard'] as const).map(level => {
                        const count = scoringCounts[level] || 0;
                        const scoring = ls[level];
                        const isQSpec = scoring?.type === 'question_specific';
                        return (
                          <div key={level} style={{ ...MCELL, background: LV[level].tint, borderBottom: 'none' }}>
                            {/* Value only — the "split equally across N" /
                                "N marks across N" sublines were redundant with
                                the Questions row directly above. */}
                            {count === 0 ? (
                              <span style={{ fontSize: 12.6, color: D.textHint }}>—</span>
                            ) : isQSpec ? (
                              <div style={{ fontSize: 12.6, fontWeight: 600, color: D.textMain }}>
                                {formatDecimal(scoring?.totalMarks || 0)} Marks
                              </div>
                            ) : (
                              <>
                                <div style={{ fontSize: 12.6, fontWeight: 600, color: D.textMain }}>
                                  {formatDecimal(count * (scoring?.marksPerQuestion || 0))} Marks
                                </div>
                                {/* The arithmetic underneath — the cheapest
                                    possible explanation of where it came from. */}
                                <div style={{ fontSize: 10.5, color: D.textMuted }}>
                                  {count} × {formatDecimal(scoring?.marksPerQuestion || 0)}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>)}
                </div>

                {!isSelLevel && validationErrors.programmingLevelCounts && touchedFields.has('programmingLevelCounts') && (
                  <p style={{ fontSize: 11.4, color: D.red }}>{validationErrors.programmingLevelCounts}</p>
                )}

                {formData.isGraded !== false && showScoringRows && (
                  <div className="es-note" style={SPEC_NOTE.info}>
                    <span>ⓘ</span>
                    <span>{anyQuestionSpecific
                      ? 'A level set to Individual holds a total here — you assign each question’s share while creating it.'
                      : 'Same Marks gives every question in a level the same value, so the total is simply questions × marks.'}</span>
                  </div>
                )}

                {formData.isGraded !== false && programmingLevelMismatch && !mismatchIsPerField && (
                  <div className="es-note" style={SPEC_NOTE.bad}>
                    <span>⚠</span>
                    <span>{programmingLevelMismatch}</span>
                  </div>
                )}
              </>)}
            </div>
          </div>
          )}

          {/* ── EVALUATION METHOD · QUESTION FLOW ──
              Both fields share a label rhythm (11px/600 #101828 with a 5px
              gap under it) and their control below is 34px tall, so the
              labels and control tops both align across the two columns.
              Column order swapped 2026-09-01 — Evaluation Method leads the
              row, Question Flow sits on the right.

              A NON-GRADED exercise drops the Evaluation Method card entirely
              (see EvaluationMethodConfig's `graded` prop — nothing is scored,
              so the stored method is pinned to Manual and the question is not
              worth asking). Question Flow then takes the full width rather
              than sitting beside an empty cell. */}
          <div className="es-2col" style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 12 }}>
            {formData.isGraded !== false && (
            <div className={`${assignmentStyles.generalFields} es-subfields`}>
              <ConfigRow label="Evaluation method" required
                help="How programming submissions are scored — against the question's test cases, or by an AI evaluator.">
                <div style={{ maxWidth: 420 }}>
                  <EvaluationMethodConfig
                    value={formData.evaluationMethod}
                    onChange={next => setFormData(prev => ({ ...prev, evaluationMethod: next }))}
                    D={D}
                    ODropdown={ODropdown}
                    SectionLabel={EvalMethodLabel}
                    font={FONT}
                    graded
                    dense
                  />
                  <LiveInteractionOption
                    value={formData.evaluationMethod}
                    onChange={next => setFormData(prev => ({ ...prev, evaluationMethod: next }))}
                    D={D}
                    font={FONT}
                  />
                </div>
              </ConfigRow>
            </div>
            )}
            {/* Non-graded: no evaluation to pick, but students still run code,
                so the live compiler option stays available on its own row. */}
            {formData.isGraded === false && (
            <div className={`${assignmentStyles.generalFields} es-subfields`}>
              <ConfigRow label="Code execution"
                help="How students run their code in the editor.">
                <div style={{ maxWidth: 420 }}>
                  <LiveInteractionOption
                    value={formData.evaluationMethod}
                    onChange={next => setFormData(prev => ({ ...prev, evaluationMethod: next }))}
                    D={D}
                    font={FONT}
                  />
                </div>
              </ConfigRow>
            </div>
            )}

            <div className={`${assignmentStyles.generalFields} es-subfields`}
              style={programmingLevelMismatch ? { opacity: 0.4, pointerEvents: 'none' as const } : undefined}>
              <ConfigRow label="Question flow" required
                help="Free Flow lets students answer in any order; Controlled Flow locks the sequence.">
                <div style={{
                  display: 'flex', background: D.surface2, border: `1px solid ${D.border2}`,
                  borderRadius: 8, padding: 3, gap: 3, height: 40, boxSizing: 'border-box', maxWidth: 420,
                }}>
                  {questionFlowOptions.map(opt => {
                    const sel = formData.programmingConfig.questionFlow === opt.value;
                    return (
                      <button key={opt.value} type="button" aria-pressed={sel}
                        onClick={() => setFormData(prev => ({ ...prev, programmingConfig: { ...prev.programmingConfig, questionFlow: opt.value as any } }))}
                        style={{
                          flex: 1, height: '100%', border: 'none', borderRadius: 5, cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                          fontSize: 13, fontWeight: 600,
                          background: sel ? '#fff' : 'transparent',
                          color: sel ? D.orangeDark : D.textMuted,
                          boxShadow: sel ? '0 1px 3px rgba(15,23,42,.1)' : 'none',
                        }}>
                        <span style={{ display: 'inline-flex' }}>{opt.icon}</span>{opt.label}
                      </button>
                    );
                  })}
                </div>
              </ConfigRow>
            </div>
          </div>

          {/* ── ATTEMPT LIMIT · ALL QUESTIONS REQUIRED ──
              One 2-col row so the two toggles sit on the same line. Combined
              renders this same config inside its Programming tab and keeps the
              standalone All Questions Required strip below the tabs, so there
              it stays a single full-width card. */}
          <div className={`${assignmentStyles.generalFields} es-subfields`}>
            <ConfigRow label="Attempt limit"
              help="When ON, students can submit only a limited number of times. When OFF, they can attempt this exercise any number of times."
              note={formData.programmingConfig.attemptLimitEnabled ? undefined : 'Students can attempt this exercise any number of times.'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40 }}>
                <button type="button" role="switch" aria-checked={formData.programmingConfig.attemptLimitEnabled}
                  onClick={() => setFormData(prev => ({ ...prev, programmingConfig: { ...prev.programmingConfig, attemptLimitEnabled: !prev.programmingConfig.attemptLimitEnabled, submissionAttempts: !prev.programmingConfig.attemptLimitEnabled ? (prev.programmingConfig.submissionAttempts > 1 ? prev.programmingConfig.submissionAttempts : 2) : 1 } }))}
                  style={{
                    position: 'relative', width: 35, height: 20, borderRadius: 999, border: 'none',
                    cursor: 'pointer', flexShrink: 0, transition: 'background .16s',
                    background: formData.programmingConfig.attemptLimitEnabled ? D.emerald : '#DEDAD5',
                  }}>
                  <span style={{
                    position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
                    background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'transform .16s',
                    transform: formData.programmingConfig.attemptLimitEnabled ? 'translateX(15px)' : 'none',
                  }} />
                </button>
                <span style={{
                  fontSize: 13, fontWeight: 600,
                  color: formData.programmingConfig.attemptLimitEnabled ? D.emerald : D.textHint,
                }}>
                  {formData.programmingConfig.attemptLimitEnabled ? 'Enabled' : 'Off'}
                </span>
              </div>
            </ConfigRow>

            {formData.programmingConfig.attemptLimitEnabled && (
              <ConfigRow label="Attempts allowed" help="Maximum number of code submissions allowed per student (1–10)">
                <div style={{ width: 140 }}>
                  <ONumberInput
                    value={formData.programmingConfig.submissionAttempts}
                    onChange={v => setFormData(prev => ({ ...prev, programmingConfig: { ...prev.programmingConfig, submissionAttempts: Math.max(1, Math.min(10, v)) } }))}
                    min={1} max={10} />
                </div>
              </ConfigRow>
            )}

            {!isCombined && allQuestionsRequiredRow}
          </div>

          {validationErrors.programmingTotalMarks && touchedFields.has('programmingTotalMarks') && (
            <div className="es-note" style={SPEC_NOTE.bad}>
              <span>⚠</span><span>{validationErrors.programmingTotalMarks}</span>
            </div>
          )}
        </>)}
      </div>
    );
  }, [
    formData,
    validationErrors,
    touchedFields,
    markTouched,
    programmingAllocatedMarks,
    programmingLevelMismatch,
    getProgrammingTotalQuestions,
    questionFlowOptions,
    updateLevelScoringConfig,
    configOptions,
    allQuestionsRequiredRow,
  ]);
  // ==========================================================================
  // RENDER: Schedule — matches ScheduleStep.tsx layout (compact, orange palette)
  // ==========================================================================
  const renderScheduleConfiguration = useCallback(() => (
    <ScheduleStep
      formData={formData}
      setFormData={setFormData}
      validationErrors={validationErrors}
      setValidationErrors={setValidationErrors}
      touchedFields={touchedFields}
      isEditing={!!isEditing}
    />
  ), [formData, validationErrors, touchedFields, isEditing, setFormData, setValidationErrors]);
  // ==========================================================================
  // RENDER: Notification Settings
  // ==========================================================================
const renderNotifications = useCallback(() => (
  <NotificationsStep formData={formData} setFormData={setFormData} />
), [formData.notifications, formData.isGraded, setFormData]);
  // ==========================================================================
  // RENDER: Grade Settings
  // ==========================================================================

  const renderGradeSettings = useCallback(() => (
    <GradeSettingsStep
      formData={formData}
      setFormData={setFormData}
      validationErrors={validationErrors}
      setValidationErrors={setValidationErrors}
      touchedFields={touchedFields}
      markTouched={markTouched}
      levelTotalsFromConfig={levelTotalsFromConfig}
    />
  ), [formData, validationErrors, touchedFields, levelTotalsFromConfig, markTouched, setFormData, setValidationErrors]);
  // ==========================================================================
  // RENDER: Combined Question Configuration (tabbed MCQ + Programming)
  // ==========================================================================
  const renderCombinedConfiguration = useCallback(() => (
    <CombinedConfigStep
      combinedConfigTab={combinedConfigTab}
      setCombinedConfigTab={setCombinedConfigTab}
      validationErrors={validationErrors}
      mcqContent={renderMCQConfiguration()}
      programmingContent={renderProgrammingConfiguration()}
    />
  ), [combinedConfigTab, setCombinedConfigTab, validationErrors, renderMCQConfiguration, renderProgrammingConfiguration]);

  // ==========================================================================
  // RENDER: Current Step
  // ==========================================================================
  const renderCurrentStep = useCallback((stepId = currentStep) => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return null;
    switch (step.title) {
      case 'Exercise Details': return renderExerciseDetails();
      case 'Question Configuration': {
        let typeConfig: React.ReactNode = null;
        if (formData.exerciseType === 'MCQ') typeConfig = renderMCQConfiguration();
        else if (formData.exerciseType === 'Programming') typeConfig = renderProgrammingConfiguration();
        else if (formData.exerciseType === 'Combined') typeConfig = renderCombinedConfiguration();
        else if (formData.exerciseType === 'Other') typeConfig = renderOthersConfiguration();
        if (!typeConfig) return (
          <StepEmptyState>
            Choose an <strong>Assignment type</strong> in the <strong>General</strong> section first —
            the question settings shown here depend on it.
          </StepEmptyState>
        );

        return (
          <>
            {/* Step-2 header removed 2026-09-01 — the modal's right-pane
                header already renders "Question configuration" + subtitle
                for this substep, so the inline h2 duplicated it. */}
            {typeConfig}
            {/* Programming pairs this beside its Attempt Limit card inside
                renderProgrammingConfiguration; MCQ / Other / Combined keep it
                as a standalone strip here. */}
            {formData.exerciseType !== 'Programming' && (
              <div className={`${assignmentStyles.generalFields} es-subfields`}>{allQuestionsRequiredRow}</div>
            )}
          </>
        );
      }
      case 'Add Questions': {
        if (!formData.exerciseType) return (
          <StepEmptyState>
            Choose an <strong>Assignment type</strong> in the <strong>General</strong> section first —
            the available question sources depend on it.
          </StepEmptyState>
        );
        {
          const needsStrategy =
            (formData.exerciseType === 'Programming' && !formData.programmingConfig.questionConfigType)
            || (formData.exerciseType === 'Other' && !formData.othersConfig.questionConfigType);
          if (needsStrategy) return (
            <StepEmptyState>
              Pick a <strong>Config strategy</strong> in <strong>Question Configuration</strong> first,
              so we know how many questions to collect and at which difficulty.
            </StepEmptyState>
          );
        }
        // Guard the Question sources UI behind the marks + level counts the
        // sources will be measured against. Without a total, the source
        // picker cannot tell the trainer how many questions still need
        // filling; without per-level counts (for Level Based / Selection
        // Level), the E/M/H quotas are undefined.
        {
          const gradedMode = formData.isGraded !== false;
          const totalMarksMissing = gradedMode && (formData.exerciseType === 'Combined'
            ? ((formData.totalMarksMCQ || 0) <= 0 || (formData.totalMarksProgramming || 0) <= 0)
            : ((formData.totalMarks || 0) <= 0));

          const pc = formData.programmingConfig;
          const oc: any = formData.othersConfig;
          const usesLevel = (cfg: any) =>
            cfg?.questionConfigType === 'levelBased' || cfg?.questionConfigType === 'selectionLevel';
          const levelSum = (cfg: any) => {
            if (!usesLevel(cfg)) return 1; // not a level strategy — treat as satisfied
            const counts = cfg.questionConfigType === 'selectionLevel' ? cfg.selectionLevelCounts : cfg.levelBasedCounts;
            return (counts?.easy || 0) + (counts?.medium || 0) + (counts?.hard || 0);
          };
          const generalMissing = (cfg: any) => cfg?.questionConfigType === 'general' && (cfg?.generalQuestionCount || 0) <= 0;

          let levelCountsMissing = false;
          if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
            if (usesLevel(pc) && levelSum(pc) <= 0) levelCountsMissing = true;
            if (generalMissing(pc)) levelCountsMissing = true;
          }
          if (formData.exerciseType === 'Other') {
            if (usesLevel(oc) && levelSum(oc) <= 0) levelCountsMissing = true;
            if (generalMissing(oc)) levelCountsMissing = true;
          }
          if (formData.exerciseType === 'MCQ' || formData.exerciseType === 'Combined') {
            if ((formData.mcqConfig?.generalQuestionCount || 0) <= 0) levelCountsMissing = true;
          }

          if (totalMarksMissing || levelCountsMissing) {
            const missingBits: string[] = [];
            if (totalMarksMissing) missingBits.push('Total marks');
            if (levelCountsMissing) missingBits.push('question counts');
            return (
              <StepEmptyState>
                Set <strong>{missingBits.join(' and ')}</strong> in <strong>Question Configuration</strong> first —
                the source picker uses them to tell you how many questions still need attaching per difficulty.
              </StepEmptyState>
            );
          }
        }
        // Attached questions come from the saved exercise (initialData.questions).
        // Newly created exercises won't have any yet — the teacher must save first.
        const attached: any[] = Array.isArray((initialData as any)?.questions) ? (initialData as any).questions : [];
        const diffOf = (q: any): 'easy' | 'medium' | 'hard' | 'unknown' => {
          const d = (q?.difficulty ?? q?.exerciseLevel ?? '').toString().toLowerCase();
          return d === 'easy' || d === 'medium' || d === 'hard' ? d : 'unknown';
        };
        const filled = { easy: 0, medium: 0, hard: 0 } as Record<'easy' | 'medium' | 'hard', number>;
        const bySource = { scratch: 0, ai: 0, thirdParty: 0 } as Record<'scratch' | 'ai' | 'thirdParty', number>;
        attached.forEach(q => {
          const d = diffOf(q);
          if (d !== 'unknown') filled[d] += 1;
          const s = (q?.source ?? '').toString();
          if (s.startsWith('scratch')) bySource.scratch += 1;
          else if (s === 'ai') bySource.ai += 1;
          else if (s.startsWith('thirdParty')) bySource.thirdParty += 1;
        });
        const filledTotal = filled.easy + filled.medium + filled.hard;

        // Pattern targets (per-difficulty) — Programming/Other with Level-Based/Selection-Level
        const pc = formData.programmingConfig;
        const oc: any = formData.othersConfig;
        const target = (() => {
          if (formData.exerciseType === 'MCQ') return { total: formData.mcqConfig.generalQuestionCount, easy: 0, medium: 0, hard: 0 };
          if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
            // General config: the quota is generalQuestionCount alone. A stale
            // patternTotal (left over from a Level-Based phase — the switch
            // handlers never clear it and its input isn't rendered in General
            // mode) must not leak in, and stale level counts must not force
            // the per-difficulty matrix shape.
            if ((pc.questionConfigType || 'general') === 'general') {
              return { total: pc.generalQuestionCount || 0, easy: 0, medium: 0, hard: 0 };
            }
            const t = pc.patternTotal || getProgrammingTotalQuestions() || 0;
            const counts = pc.questionConfigType === 'selectionLevel' ? pc.selectionLevelCounts : pc.levelBasedCounts;
            return { total: t, easy: counts.easy || 0, medium: counts.medium || 0, hard: counts.hard || 0 };
          }
          if (formData.exerciseType === 'Other') {
            if ((oc.questionConfigType || 'general') === 'general') {
              return { total: oc.generalQuestionCount || 0, easy: 0, medium: 0, hard: 0 };
            }
            const t = oc.patternTotal || getOthersTotalQuestions() || 0;
            const counts = oc.questionConfigType === 'selectionLevel' ? oc.selectionLevelCounts : oc.levelBasedCounts;
            return { total: t, easy: counts.easy || 0, medium: counts.medium || 0, hard: counts.hard || 0 };
          }
          return { total: 0, easy: 0, medium: 0, hard: 0 };
        })();

        const isBank = questionSource !== 'ai';
        const sourceIcon = questionSource === 'ai' ? <Sparkles size={16} style={{ color: D.orange }} />
          : questionSource === 'thirdParty' ? <Database size={16} style={{ color: D.orange }} />
          : questionSource === 'custom' ? <Layers size={16} style={{ color: D.orange }} />
          : <FileText size={16} style={{ color: D.orange }} />;
        const sourceLabel = questionSource === 'ai' ? 'AI Automation'
          : questionSource === 'scratch' ? 'Manual'
          : questionSource === 'thirdParty' ? 'Other Platform'
          : questionSource === 'custom' ? 'Custom'
          : '';

        const openAuthor = (mode: 'scratch-manual' | 'scratch-bank' | 'ai') => {
          if (!localExerciseId && !exercise_Id) {
            toast('Save the settings first — then add questions.', { position: 'top-right', duration: 2800, icon: 'ℹ️', id: 'save-first-authoring' });
            return;
          }
          if (onOpenQuestionAuthor) onOpenQuestionAuthor(mode);
          else toast('Question authoring will open in the parent screen.', { position: 'top-right', duration: 2800, icon: 'ℹ️', id: 'no-authoring-handler' });
        };

        // Pure-MCQ exercises hide Other Platform — the MCQ question form has no
        // thirdParty import path, so offering it would dead-end at Add Question.
        const noThirdParty = formData.exerciseType === 'MCQ';

        return (
          <div className="px-10 pt-4 pb-6 space-y-4">
            {/* Question Source picker — one always-visible checkbox row,
                shared with the You_Do assessment modal. Ticking one source
                = single-source exercise; ticking two or three = Custom
                combine. The picker derives the (questionSource, customSources)
                storage from the checkbox set, so downstream (Add Question
                quota gating, buildFullPayload, Custom distribution matrix
                below) reads exactly what it always did. */}
            <div style={{ paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#263746' }}>Where the questions come from</span>
                <SettingsHelp content="Pick where students' questions will come from: Manual (author your own), AI Automation (generate with AI), Other Platform (import from a question bank), or Custom (combine two or more sources). Hover any option below for a one-line summary of what it does." />
              </div>
              <QuestionSourcePicker
                value={{ primary: questionSource, sub: customSources }}
                onChange={next => {
                  setQuestionSource(next.primary);
                  setCustomSources(next.sub);
                  // Zero the column of any un-ticked source so stale counts
                  // from a prior Custom split don't linger invisibly in
                  // `customDistribution` and turn the grand total red.
                  const prev = new Set<CustomSubSource>(customSources);
                  const cur = new Set<CustomSubSource>(next.sub);
                  (['scratch', 'ai', 'thirdParty'] as const).forEach(src => {
                    if (prev.has(src) && !cur.has(src)) {
                      setCustomDistribution(d => ({
                        easy:   { ...d.easy,   [src]: 0 },
                        medium: { ...d.medium, [src]: 0 },
                        hard:   { ...d.hard,   [src]: 0 },
                      }));
                    }
                  });
                }}
                D={D}
                hideThirdParty={noThirdParty}
                title={formData.exerciseType === 'Combined' ? 'Programming sources' : 'Question sources'}
                required
                emptyHint="Pick a source to see how to add questions."
                font={FONT}
              />
            </div>

            {/* Combined: the MCQ part's own source. Empty state (nothing
                ticked, primary === '') means "inherit the Programming
                source" — exposed as the "Same as Programming" chip. Ticking
                Manual and/or AI overrides that. When both are on, the
                single-row splitter below sums to the MCQ question count
                (MCQ has no difficulty levels). */}
            {formData.exerciseType === 'Combined' && (() => {
              const mcqSubOptions: Array<{ id: CustomSubSource; label: string }> = [
                { id: 'scratch', label: 'Manual' },
                { id: 'ai', label: 'AI Automation' },
              ];
              const mcqTotal = formData.mcqConfig.generalQuestionCount || 0;
              const mcqSplitSum = customDistributionMcq.scratch + customDistributionMcq.ai + customDistributionMcq.thirdParty;
              const showMcqSplit = questionSourceMcq === 'custom' && customSourcesMcq.length >= 2 && mcqTotal > 0;
              const bumpMcq = (c: CustomSubSource, delta: number) =>
                setCustomDistributionMcq(prev => ({ ...prev, [c]: Math.max(0, (prev as any)[c] + delta) }));
              return (
                <div className="px-3 py-2.5 rounded-md" style={{ background: '#FAFAF7', border: `1px solid ${D.border}` }}>
                  <QuestionSourcePicker
                    value={{ primary: questionSourceMcq, sub: customSourcesMcq }}
                    onChange={next => {
                      setQuestionSourceMcq(next.primary);
                      setCustomSourcesMcq(next.sub);
                      const prev = new Set<CustomSubSource>(customSourcesMcq);
                      const cur = new Set<CustomSubSource>(next.sub);
                      (['scratch', 'ai', 'thirdParty'] as const).forEach(src => {
                        if (prev.has(src) && !cur.has(src)) {
                          setCustomDistributionMcq(d => ({ ...d, [src]: 0 }));
                        }
                      });
                    }}
                    D={D}
                    // MCQ mirror never offers Other Platform (MCQ form has no
                    // thirdParty import path). "Same as Programming" appears
                    // as the leftmost chip and represents the inherit state.
                    hideThirdParty
                    allowInherit
                    label="MCQ Source"
                    font={FONT}
                  />
                  {showMcqSplit && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <span className="text-[11px] font-bold" style={{ color: D.textMain, fontFamily: FONT }}>MCQ Questions:</span>
                      {mcqSubOptions.filter(o => customSourcesMcq.includes(o.id)).map(o => (
                        <span key={o.id} className="inline-flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold" style={{ color: D.textMuted }}>{o.label}</span>
                          <button type="button" onClick={() => bumpMcq(o.id, -1)} disabled={(customDistributionMcq as any)[o.id] === 0}
                            className="w-5 h-5 rounded flex items-center justify-center"
                            style={{ border: `1px solid ${D.border}`, background: '#fff', color: D.textMuted, cursor: (customDistributionMcq as any)[o.id] === 0 ? 'not-allowed' : 'pointer', opacity: (customDistributionMcq as any)[o.id] === 0 ? 0.5 : 1 }}>
                            <Minus size={10} />
                          </button>
                          <span className="w-6 text-center text-[11px] font-bold" style={{ color: D.textMain }}>{(customDistributionMcq as any)[o.id]}</span>
                          <button type="button" onClick={() => bumpMcq(o.id, +1)} disabled={mcqSplitSum >= mcqTotal}
                            className="w-5 h-5 rounded flex items-center justify-center"
                            style={{ border: `1px solid ${D.border}`, background: '#fff', color: D.orange, cursor: mcqSplitSum >= mcqTotal ? 'not-allowed' : 'pointer', opacity: mcqSplitSum >= mcqTotal ? 0.5 : 1 }}>
                            <Plus size={10} />
                          </button>
                        </span>
                      ))}
                      <span className="text-[11px] font-bold" style={{ color: mcqSplitSum === mcqTotal ? D.emerald : D.red }}>
                        {mcqSplitSum} / {mcqTotal} {mcqSplitSum === mcqTotal && <Check size={10} style={{ display: 'inline' }} />}
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Custom distribution table — for Custom with ≥2 sub-sources.
                Level-Based / Selection-Level patterns split per difficulty
                (rows = E/M/H). MCQ and General-count configs have no levels,
                so they get a single "Questions" row whose split lives in the
                neutral 'medium' bucket — the same bucket every difficulty-less
                question is normalized into when quota slices are counted. */}
            {questionSource === 'custom' && customSources.length >= 2 && target.total > 0 && (() => {
              const activeCols: CustomSubSource[] = (['scratch', 'ai', 'thirdParty'] as CustomSubSource[]).filter(c => customSources.includes(c));
              const colLabel = (c: CustomSubSource) => c === 'scratch' ? 'Manual' : c === 'ai' ? 'AI Automation' : 'Other Platform';
              const hasLevels = (target.easy + target.medium + target.hard) > 0;
              const rowCaption = (r: 'easy' | 'medium' | 'hard') => (hasLevels ? r : r === 'medium' ? 'Questions' : r);
              const rowTarget: Record<'easy' | 'medium' | 'hard', number> = hasLevels
                ? { easy: target.easy, medium: target.medium, hard: target.hard }
                : { easy: 0, medium: target.total, hard: 0 };
              const rowSum = (r: 'easy' | 'medium' | 'hard') =>
                activeCols.reduce((s, c) => s + customDistribution[r][c], 0);
              // Single-row mode still shows any bucket that HOLDS counts (stale
              // split from a level-based phase) so the red grand total always
              // has a visible, decrementable cause — same rule as the
              // assessment modal's QuestionSourceStep.
              const matrixRows: Array<'easy' | 'medium' | 'hard'> = (['easy', 'medium', 'hard'] as const)
                .filter(r => hasLevels || r === 'medium' || rowSum(r) > 0);
              const colSum = (c: CustomSubSource) =>
                customDistribution.easy[c] + customDistribution.medium[c] + customDistribution.hard[c];
              // Grand total counts ALL buckets (not just visible rows) so a
              // stale split left over from a config switch shows red instead
              // of silently persisting.
              const grandSum = rowSum('easy') + rowSum('medium') + rowSum('hard');
              const grandBalanced = grandSum === target.total &&
                (['easy', 'medium', 'hard'] as const).every(r => rowSum(r) === rowTarget[r]);
              const bump = (r: 'easy' | 'medium' | 'hard', c: 'scratch' | 'ai' | 'thirdParty', delta: number) => {
                setCustomDistribution(prev => {
                  const next = { ...prev, [r]: { ...prev[r], [c]: Math.max(0, prev[r][c] + delta) } };
                  return next;
                });
              };
              return (
                <div className="rounded-md" style={{ background: '#FAFAF7', border: `1px solid ${D.border}` }}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: D.border }}>
                    <div className="flex items-center gap-1.5">
                      <Layers size={12} style={{ color: D.textMuted }} />
                      <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: D.textMuted, fontFamily: FONT }}>Distribution</span>
                    </div>
                    <span className="text-[13px] font-semibold" style={{ color: grandBalanced ? D.emerald : D.red }}>
                      {grandSum} / {target.total} {grandBalanced && <Check size={10} style={{ display: 'inline' }} />}
                    </span>
                  </div>
                  <div className="overflow-hidden">
                    <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#fff' }}>
                          <th className="px-2 py-1.5 text-left font-semibold" style={{ color: D.textMuted, borderBottom: `1px solid ${D.border}` }}></th>
                          {activeCols.map(col => (
                            <th key={col} className="px-2 py-1.5 text-center font-semibold" style={{ color: D.textMain, borderBottom: `1px solid ${D.border}` }}>{colLabel(col)}</th>
                          ))}
                          <th className="px-2 py-1.5 text-center font-semibold" style={{ color: D.textMuted, borderBottom: `1px solid ${D.border}` }}>Row / Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matrixRows.map(row => {
                          const rColor = !hasLevels ? D.textMain : row === 'easy' ? D.emerald : row === 'medium' ? D.amber : D.red;
                          const rBalanced = rowSum(row) === rowTarget[row];
                          return (
                            <tr key={row}>
                              <td className="px-2 py-1.5 font-semibold capitalize" style={{ color: rColor, borderBottom: `1px solid ${D.border}` }}>
                                <span className="inline-flex items-center gap-1">
                                  <Circle size={8} fill={rColor} style={{ color: rColor }} /> {rowCaption(row)}
                                </span>
                              </td>
                              {activeCols.map(col => (
                                <td key={col} className="px-2 py-1.5 text-center" style={{ borderBottom: `1px solid ${D.border}` }}>
                                  <div className="inline-flex items-center gap-1">
                                    <button type="button" onClick={() => bump(row, col, -1)}
                                      disabled={customDistribution[row][col] === 0}
                                      className="w-5 h-5 rounded flex items-center justify-center"
                                      style={{ border: `1px solid ${D.border}`, background: '#fff', color: D.textMuted, cursor: customDistribution[row][col] === 0 ? 'not-allowed' : 'pointer', opacity: customDistribution[row][col] === 0 ? 0.5 : 1 }}>
                                      <Minus size={10} />
                                    </button>
                                    <span className="w-6 text-center font-semibold" style={{ color: D.textMain }}>{customDistribution[row][col]}</span>
                                    <button type="button" onClick={() => bump(row, col, +1)}
                                      disabled={rowSum(row) >= rowTarget[row]}
                                      className="w-5 h-5 rounded flex items-center justify-center"
                                      style={{ border: `1px solid ${D.border}`, background: '#fff', color: D.orange, cursor: rowSum(row) >= rowTarget[row] ? 'not-allowed' : 'pointer', opacity: rowSum(row) >= rowTarget[row] ? 0.5 : 1 }}>
                                      <Plus size={10} />
                                    </button>
                                  </div>
                                </td>
                              ))}
                              <td className="px-2 py-1.5 text-center font-semibold" style={{ color: rBalanced ? D.emerald : D.red, borderBottom: `1px solid ${D.border}` }}>
                                {rowSum(row)} / {rowTarget[row]} {rBalanced && <Check size={10} style={{ display: 'inline' }} />}
                              </td>
                            </tr>
                          );
                        })}
                        {/* Column totals */}
                        <tr style={{ background: '#fff' }}>
                          <td className="px-2 py-1.5 font-semibold uppercase text-[12px]" style={{ color: D.textMuted }}>Column</td>
                          {activeCols.map(col => (
                            <td key={col} className="px-2 py-1.5 text-center font-semibold" style={{ color: D.textMain }}>{colSum(col)}</td>
                          ))}
                          <td className="px-2 py-1.5 text-center font-semibold" style={{ color: grandBalanced ? D.emerald : D.red }}>
                            {grandSum} / {target.total}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="px-3 py-2 border-t flex items-center justify-between" style={{ borderColor: D.border }}>
                    <button type="button" onClick={() => {
                      // Split each difficulty as evenly as possible across active sources.
                      const n = Math.max(1, activeCols.length);
                      const next = {
                        easy: { scratch: 0, ai: 0, thirdParty: 0 },
                        medium: { scratch: 0, ai: 0, thirdParty: 0 },
                        hard: { scratch: 0, ai: 0, thirdParty: 0 },
                      };
                      (['easy', 'medium', 'hard'] as const).forEach(r => {
                        const t = rowTarget[r];
                        const base = Math.floor(t / n);
                        const rem = t - base * n;
                        activeCols.forEach((col, i) => {
                          next[r][col] = base + (i < rem ? 1 : 0);
                        });
                      });
                      setCustomDistribution(next);
                    }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                      style={{ background: 'transparent', color: D.orange, border: `1px solid ${D.orange}` }}>
                      <Shuffle size={11} /> Split evenly
                    </button>
                    <button type="button" onClick={() => setCustomDistribution({
                      easy: { scratch: 0, ai: 0, thirdParty: 0 },
                      medium: { scratch: 0, ai: 0, thirdParty: 0 },
                      hard: { scratch: 0, ai: 0, thirdParty: 0 },
                    })}
                      className="text-[11px] font-semibold underline" style={{ color: D.textMuted }}>Reset</button>
                  </div>
                </div>
              );
            })()}

          </div>
        );
      }
      case 'Schedule': return renderScheduleConfiguration();
      case 'Notifications': return renderNotifications();
      case 'Grade Settings': return renderGradeSettings();
      default: return null;
    }
  }, [steps, currentStep, formData.exerciseType, formData.allQuestionsRequired, formData.mcqConfig.generalQuestionCount, formData.programmingConfig, formData.othersConfig, questionSource, customSources, customDistribution, saveDecisionOpen, patternTotalMismatch, getProgrammingTotalQuestions, getOthersTotalQuestions, initialData, localExerciseId, exercise_Id, onOpenQuestionAuthor, renderExerciseDetails, renderMCQConfiguration, renderProgrammingConfiguration, renderOthersConfiguration, renderCombinedConfiguration, renderScheduleConfiguration, renderNotifications, renderGradeSettings, allQuestionsRequiredRow]);
  // ==========================================================================
  // MAIN RENDER
  // ==========================================================================
  const BreadcrumbArrow = () => <span className="mx-1" style={{ color: D.orange, fontWeight: 700, fontSize: 13 }}>»</span>;
  const isLastStep = currentStep === steps[steps.length - 1]?.id;
  // Finish is only allowed once the LAST step (Notifications for non-graded,
  // Grade Settings for graded) has been explicitly saved via its Save button.
  const lastStepTitle = steps[steps.length - 1]?.title ?? '';
  const isLastStepSaved = !!lastStepTitle && savedSteps.has(lastStepTitle);
  const currentStepTitle = (() => {
    const step = steps.find(s => s.id === currentStep);
    if (step?.title === 'Question Configuration') {
      return formData.exerciseType === 'MCQ'
        ? 'MCQ Configuration'
        : formData.exerciseType === 'Programming'
          ? 'Programming Configuration'
          : formData.exerciseType === 'Other'
            ? 'Others Configuration'
            : 'Question Configuration';
    }
    return step?.title ?? '';
  })();

  const step1Id = steps.find(s => s.title === 'Exercise Details')?.id ?? 1;
  const step1Unlocked = savedSteps.has('Exercise Details');
  const isOnStep1 = currentStep === step1Id;
  const busy = isLoading || isSavingStep;

  // ── Issue map: step title → the messages that step is currently failing on ──
  // Only TOUCHED fields count, so a form the teacher hasn't submitted yet stays
  // quiet; the moment Next/Save runs validateCurrentStep (which marks the
  // step's fields touched) the same errors light up the rail, the header pill
  // and the banner together.
  const stepIssues = useMemo(() => {
    const out: Record<string, string[]> = {};
    Object.entries(STEP_ERROR_FIELDS).forEach(([title, fields]) => {
      const msgs: string[] = [];
      fields.forEach(f => {
        const v = validationErrors[f];
        if (!v || !touchedFields.has(f)) return;
        if (typeof v === 'string') msgs.push(v);
        // programmingLevelScoring / othersLevelScoring hold a per-level record.
        else if (typeof v === 'object') Object.values(v).forEach(m => { if (typeof m === 'string' && m) msgs.push(m); });
      });
      out[title] = Array.from(new Set(msgs));
    });
    return out;
  }, [validationErrors, touchedFields]);
  const previewErrors = {
    ...validateExerciseDetails(),
    ...((formData.exerciseType === 'MCQ' || formData.exerciseType === 'Combined') ? validateMCQConfiguration() : {}),
    ...((formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') ? validateProgrammingConfiguration() : {}),
    ...(formData.exerciseType === 'Other' ? validateOthersConfiguration() : {}),
    ...validateSchedule(),
    ...(formData.isGraded !== false ? validateGradeSettings() : {}),
  };
  // Total-question count that the preview stat tile uses — recomputed here so
  // "no questions set" surfaces as its own line in the Unfinished setup list,
  // not just as a red "—" in the tile. Matches the questionCount prop below.
  const previewQuestionCount = formData.exerciseType === 'MCQ'
    ? formData.mcqConfig.generalQuestionCount
    : formData.exerciseType === 'Other'
      ? getOthersTotalQuestions()
      : getProgrammingTotalQuestions() + (formData.exerciseType === 'Combined' ? formData.mcqConfig.generalQuestionCount : 0);
  // Best-guess mapping from a preview issue message to the accordion step
  // that owns it. Keyword-based so we do not have to keep parallel arrays for
  // every validator string; whichever pattern hits first wins.
  const handleIssueJump = useCallback((issue: string) => {
    const lower = issue.toLowerCase();
    const stepTitle =
      lower.includes('assignment type') || lower.includes('exercise type') ? 'Exercise Details'
      : lower.includes('exercise name') || lower.includes('assignment name') ? 'Exercise Details'
      : lower.includes('difficulty level') ? 'Exercise Details'
      : lower.includes('duration') ? 'Exercise Details'
      : lower.includes('module') || lower.includes('language') ? 'Exercise Details'
      : lower.includes('total marks') || lower.includes('mcq total') || lower.includes('programming total') ? 'Exercise Details'
      : lower.includes('question source') || lower.includes('sources') ? 'Add Questions'
      : lower.includes('total number of questions') ? 'Question Configuration'
      : lower.includes('config strategy') || lower.includes('question count') || lower.includes('marks per question')
        || lower.includes('level') || lower.includes('scoring') ? 'Question Configuration'
      : lower.includes('start') || lower.includes('end date') || lower.includes('cut-off') || lower.includes('grade by') || lower.includes('date') ? 'Schedule'
      : lower.includes('pass') || lower.includes('grade') ? 'Grade Settings'
      : null;
    const target = stepTitle ? steps.find(step => step.title === stepTitle) : null;
    if (!target) return;
    setExpandedSteps(prev => new Set(prev).add(target.id));
    setCurrentStep(target.id);
    // Wait for the accordion to paint the newly-expanded panel before we
    // scroll to it, then flip data-flash so the orange keyframe animation
    // fires. Cleared on the next tick so re-clicking replays the animation.
    requestAnimationFrame(() => window.setTimeout(() => {
      const card = document.getElementById(`assignment-section-${target.id}`)?.closest('.es-acc-card') as HTMLElement | null;
      const header = document.getElementById(`assignment-section-${target.id}`);
      header?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (card) {
        card.setAttribute('data-flash', 'true');
        window.setTimeout(() => card.removeAttribute('data-flash'), 1500);
      }
    }, 180));
  }, [steps]);
  // Preview issues, ordered the way the trainer must fix them: type → module
  // → config strategy → question counts → source → dates → grade. The "Set
  // the total number of questions" line only fires AFTER a strategy is
  // picked — before that, the strategy message covers it.
  const needsConfigStrategy = (
    (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') && !formData.programmingConfig.questionConfigType
  ) || (formData.exerciseType === 'Other' && !formData.othersConfig.questionConfigType);
  const previewIssues = (() => {
    // Bucket per-step so we can order them predictably instead of shuffling
    // together whatever came out of Object.values.
    const bucketed: Record<string, string[]> = {
      details: [], strategy: [], counts: [], source: [], schedule: [], grade: [], other: [],
    };
    Object.entries(previewErrors).forEach(([field, value]) => {
      const push = (msg: string) => {
        if (field === 'exerciseName' || field === 'exerciseLevel' || field === 'exerciseType' ||
            field === 'selectedModule' || field === 'selectedLanguages' || field === 'totalDuration' ||
            field === 'totalMarks' || field === 'totalMarksMCQ' || field === 'totalMarksProgramming') bucketed.details.push(msg);
        else if (msg.toLowerCase().includes('config strategy')) bucketed.strategy.push(msg);
        else if (field.toLowerCase().includes('level') || field.toLowerCase().includes('scoring') ||
                 field.toLowerCase().includes('questioncount') || field.toLowerCase().includes('marks')) bucketed.counts.push(msg);
        else if (field === 'startDate' || field === 'endDate' || field === 'cutOffDate' || field === 'gracePeriod') bucketed.schedule.push(msg);
        else if (field.toLowerCase().includes('grade') || field.toLowerCase().includes('pass')) bucketed.grade.push(msg);
        else bucketed.other.push(msg);
      };
      if (typeof value === 'string') push(value);
      else Object.values(value || {}).forEach(v => { if (typeof v === 'string') push(v); });
    });

    const out: string[] = [];
    if (!formData.exerciseType) out.push('Choose an assignment type to configure questions.');
    out.push(...bucketed.details);
    if (needsConfigStrategy) out.push('Please select a Config Strategy in Question Configuration.');
    // "Set the total number of questions" only applies to General strategy —
    // for Level Based / Selection Level, the total is derived from the E/M/H
    // counts, and those already surface their own per-level errors below.
    // Otherwise the trainer sees a redundant "set total" line even after
    // they've entered a level count.
    const usesGeneralStrategy =
      formData.exerciseType === 'MCQ'
      || (formData.exerciseType === 'Programming' && formData.programmingConfig.questionConfigType === 'general')
      || (formData.exerciseType === 'Other' && formData.othersConfig.questionConfigType === 'general')
      || (formData.exerciseType === 'Combined' && formData.programmingConfig.questionConfigType === 'general');
    if (formData.exerciseType && !needsConfigStrategy && usesGeneralStrategy && !previewQuestionCount) {
      out.push('Set the total number of questions.');
    }
    out.push(...bucketed.strategy);
    out.push(...bucketed.counts);
    if (patternTotalMismatch) out.push(patternTotalMismatch.message);
    if (formData.isGraded !== false) {
      if (programmingLevelMismatch) out.push(programmingLevelMismatch);
      if (othersLevelMismatch) out.push(othersLevelMismatch);
    }
    if (!questionSource) out.push('Choose a question source.');
    out.push(...bucketed.schedule);
    out.push(...bucketed.grade);
    out.push(...bucketed.other);
    return Array.from(new Set(out));
  })();
  const currentIssues = stepIssues[currentStepTitle === 'MCQ Configuration'
    || currentStepTitle === 'Programming Configuration'
    || currentStepTitle === 'Others Configuration'
    ? 'Question Configuration'
    : currentStepTitle] ?? [];

  // ── Rail summary — the three numbers that answer "what am I building?" ──────
  const summary = useMemo(() => {
    const et = formData.exerciseType;
    let questions = 0;
    if (et === 'MCQ') questions = formData.mcqConfig.generalQuestionCount || 0;
    else if (et === 'Programming') questions = getProgrammingTotalQuestions();
    else if (et === 'Other') questions = getOthersTotalQuestions();
    else if (et === 'Combined') questions = (formData.mcqConfig.generalQuestionCount || 0) + getProgrammingTotalQuestions();
    const total = et === 'Combined'
      ? (formData.totalMarksMCQ || 0) + (formData.totalMarksProgramming || 0)
      : (formData.totalMarks || 0);
    return {
      questions,
      used: calculateAllocatedMarks(),
      total,
      type: et || '—',
    };
  }, [formData.exerciseType, formData.mcqConfig.generalQuestionCount, formData.totalMarks,
    formData.totalMarksMCQ, formData.totalMarksProgramming,
    getProgrammingTotalQuestions, getOthersTotalQuestions, calculateAllocatedMarks]);

  // The rail's fourth summary row. Reads whichever config owns attempts for
  // the current type — it derives, it never writes.
  const attemptsSummary = useMemo(() => {
    const cfg = formData.exerciseType === 'MCQ' ? formData.mcqConfig
      : formData.exerciseType === 'Other' ? formData.othersConfig
        : formData.programmingConfig;
    return cfg?.attemptLimitEnabled ? String(cfg.submissionAttempts || 1) : 'Unlimited';
  }, [formData.exerciseType, formData.mcqConfig, formData.othersConfig, formData.programmingConfig]);

  // ── Sidebar display model — 2026-09-01 rebuild ──────────────────────────────
  // Per user: the sidebar shows EVERY dynamic substep, not merged groups.
  // We reuse the existing `steps` array but map each step's internal title
  // onto a mockup-styled display title + subtitle + right-pane page header.
  // Nothing about save payloads, validation, or gating changes.
  //
  //   • Exercise Details         → "Assignment Details"  (page: "Assignment setup")
  //   • Question Configuration   → "Question Configuration"
  //   • Add Questions            → "Add Questions"
  //   • Schedule                 → "Schedule"
  //   • Notifications            → "Notifications"
  //   • Grade Settings           → "Grade Settings"     (only when isGraded)
  type StepMeta = { title: string; description: string; pageHeader: string; pageSubtitle: string };
  const STEP_META: Record<string, StepMeta> = useMemo(() => ({
    'Exercise Details': {
      title: 'General',
      description: '',
      pageHeader: 'Basic details',
      pageSubtitle: '',
    },
    'Question Configuration': {
      title: 'Question Configuration',
      description: '',
      pageHeader: 'Question configuration',
      pageSubtitle: 'Define the number of questions, difficulty mix, and scoring rules.',
    },
    'Add Questions': {
      title: 'Question sources',
      description: '',
      pageHeader: 'Question sources',
      pageSubtitle: 'Pick a source and attach the questions students will answer.',
    },
    Schedule: {
      title: 'Availability',
      description: '',
      pageHeader: 'Schedule & availability',
      pageSubtitle: 'Control access, timing, deadlines and marking reminders.',
    },
    Notifications: {
      title: 'Notifications',
      description: '',
      pageHeader: 'Notifications',
      pageSubtitle: 'Choose who is notified and when reminders are sent.',
    },
    'Grade Settings': {
      title: 'Grade',
      description: '',
      pageHeader: 'Grade Settings',
      pageSubtitle: 'Configure passing score, mark distribution and grading rules.',
    },
  }), []);

  const currentStepMeta = useMemo(() => {
    const st = steps.find(s => s.id === currentStep);
    const key = st?.title ?? '';
    return STEP_META[key] ?? {
      title: key || 'Step',
      description: '',
      pageHeader: key || 'Step',
      pageSubtitle: '',
    };
  }, [steps, currentStep, STEP_META]);
  const currentStepIdx = useMemo(() => steps.findIndex(s => s.id === currentStep), [steps, currentStep]);
  const firstStepId = steps[0]?.id ?? 1;

  // Save status chip — mockup: green dot + label. `Saved just now` after any
  // successful step save; `Saving…` while a save is in flight.
  const saveStatusLabel = isSavingStep
    ? 'Saving…'
    : savedSteps.size > 0
      ? 'Saved just now'
      : 'Not saved yet';
  const saveStatusColor = isSavingStep
    ? '#F97316'
    : savedSteps.size > 0
      ? '#12B76A'
      : '#98A2B3';

  return (
    <div className="fixed inset-0 flex items-stretch justify-stretch z-50" style={{ background: '#FFFFFF', fontFamily: FONT }}
      // Arms the unsaved-changes baseline. Capture phase so it lands before the
      // handler that actually mutates state — the baseline has to freeze on the
      // value as it was *before* this interaction.
      onPointerDownCapture={armDirtyTracking}
      onKeyDownCapture={armDirtyTracking}>
      {/* Unsaved-changes guard on the X — three-way prompt: Save, Discard, or
          Cancel. Save runs the current-step Save (same as the footer button)
          and then closes; Discard closes without saving; Cancel keeps the
          wizard open so the trainer can keep editing. Inline so it can call
          handleSave without going through a shared dialog signature. */}
      {showDiscardConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="close-confirm-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDiscardConfirm(false); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, fontFamily: FONT,
          }}>
          <div style={{
            background: '#fff', borderRadius: 12,
            width: '100%', maxWidth: 420,
            boxShadow: '0 24px 60px rgba(15,23,42,.22)',
            border: '1px solid #E4E7EC', overflow: 'hidden',
          }}>
            <div style={{ padding: '22px 24px 8px', textAlign: 'left' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#FEF3C7', color: '#B45309',
                display: 'grid', placeItems: 'center',
                marginBottom: 14,
              }}>
                <AlertCircle size={20} />
              </div>
              <h3 id="close-confirm-title" style={{
                margin: 0, fontSize: 16, fontWeight: 700,
                color: '#101828', letterSpacing: '-.005em',
              }}>
                Save changes before closing?
              </h3>
              <p style={{
                margin: '6px 0 0', fontSize: 13.5, color: '#475467', lineHeight: 1.5,
              }}>
                You have unsaved changes. Save them, or discard and close.
              </p>
            </div>
            <div style={{
              display: 'flex', justifyContent: 'flex-end',
              gap: 8, padding: '14px 20px 18px',
            }}>
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid #D0D5DD', background: '#fff',
                  color: '#344054', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setShowDiscardConfirm(false); onClose(); }}
                style={{
                  padding: '8px 14px', borderRadius: 8,
                  border: '1px solid #EF4444', background: '#fff',
                  color: '#EF4444', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer',
                }}>
                Discard
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowDiscardConfirm(false);
                  if (await handleSave()) onClose();
                }}
                disabled={busy}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: 'none', background: D.orange,
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                  boxShadow: `0 4px 12px ${D.orangeGlow}`,
                }}>
                {isSavingStep ? 'Saving…' : 'Save & close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 6 — Save Decision modal (Use only / Use + Save to Bank) */}
      {saveDecisionOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden" style={{ boxShadow: '0 24px 48px rgba(0,0,0,0.25)', fontFamily: FONT }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: D.border }}>
              <span className="text-[13px] font-bold" style={{ color: D.textMain }}>What do you want to do with these questions?</span>
              <button type="button" onClick={() => setSaveDecisionOpen(false)} className="p-1 rounded hover:bg-gray-100">
                <X size={14} style={{ color: D.textMuted }} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {[
                { id: false, title: 'Use in this exercise only', desc: "Questions are added to this exercise and won't appear in the Question Bank." },
                { id: true, title: 'Use in this exercise AND save to Question Bank', desc: 'Also stored in the bank so you can reuse them. Each question keeps its source tag.' },
              ].map(opt => {
                const selected = saveToBank === opt.id;
                return (
                  <button key={String(opt.id)} type="button" onClick={() => setSaveToBank(opt.id)}
                    className="w-full text-left rounded-lg p-3 transition-all"
                    style={{ background: '#fff', border: `${selected ? 2 : 1}px solid ${selected ? D.orange : D.border}`, cursor: 'pointer' }}>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: selected ? D.orange : '#fff', border: `1px solid ${selected ? D.orange : D.border}` }}>
                        {selected && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
                      </span>
                      <div>
                        <div className="text-[12px] font-bold" style={{ color: D.textMain }}>{opt.title}</div>
                        <div className="text-[11px]" style={{ color: D.textMuted }}>{opt.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
              <label className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: D.textMuted }}>
                <input type="checkbox" checked={askSaveDecisionNextTime}
                  onChange={e => setAskSaveDecisionNextTime(e.target.checked)}
                  style={{ accentColor: D.orange }} />
                Ask me next time
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t" style={{ borderColor: D.border }}>
              <button type="button" onClick={() => setSaveDecisionOpen(false)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold"
                style={{ background: 'transparent', color: D.textMuted, border: `1px solid ${D.border}` }}>Cancel</button>
              <button type="button" onClick={() => {
                setSaveDecisionOpen(false);
                toast.success(saveToBank ? 'Questions attached and saved to Question Bank.' : 'Questions attached to this exercise.', { position: 'top-right', duration: 2400, id: 'save-decision-ok' });
                void performSave();
              }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-semibold"
                style={{ background: D.orange, color: '#fff' }}>
                <Check size={12} /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}


      <CompactSettingsContext.Provider value={true}>
      <div className={`es-main es-acc-main ${assignmentStyles.reference} ${assignmentStyles.compact}`}
        role="dialog" aria-modal="true" aria-labelledby="assignment-settings-title"
        style={{ width: '100%', height: '100%', minHeight: 0, background: '#fff' }}>
          <header className={assignmentStyles.header}>
            <button type="button" onClick={requestClose} aria-label="Back to assignments" className={assignmentStyles.backButton}>
              <ArrowLeft size={16} strokeWidth={2.25} />
              <span>Back</span>
            </button>
            <nav className={assignmentStyles.breadcrumbs} aria-label="Assignment location">
              <Home size={13} aria-hidden="true" />
              {breadcrumbs.map((crumb, index) => <React.Fragment key={`${crumb.type}-${index}`}>
                {index > 0 && <ChevronRight size={12} aria-hidden="true" />}
                <span title={crumb.name}>{crumb.name}</span>
              </React.Fragment>)}
              <ChevronRight size={12} aria-hidden="true" />
              <span aria-current="page">{isEditing ? 'Edit assignment' : 'New assignment'}</span>
            </nav>
            <h1 id="assignment-settings-title" style={{
              position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
              overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
            }}>
              {isEditing ? 'Edit' : 'New'} {subcategory === 'assignment' ? 'Assignment' : 'Exercise'}
            </h1>
          </header>
          <div className={assignmentStyles.workspace}>
          <main className={`es-acc-scroll ${assignmentStyles.editorPane}`} aria-label="Assignment settings">
          <div className={assignmentStyles.accordionToolbar}>
            <span>Assignment settings</span>
            <div>
              <button type="button" onClick={() => setExpandedSteps(new Set(steps.map(step => step.id)))} disabled={steps.every(step => expandedSteps.has(step.id))}>Expand all</button>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={() => setExpandedSteps(new Set())} disabled={expandedSteps.size === 0}>Collapse all</button>
            </div>
          </div>
          {isLocked && <p className={assignmentStyles.lockedNote}>This assignment has been submitted and is now read-only.</p>}
          {steps.map(step => {
            const isOpen = expandedSteps.has(step.id);
            const meta = STEP_META[step.title];
            const title = meta?.title || step.title;
            // Every step is editable from the start. Locking only happens when
            // the whole exercise is read-only (post-submission).
            const stepLocked = false;
            const issues = stepIssues[step.title] || [];
            const activate = () => {
              if (!stepLocked && !isLocked) setCurrentStep(step.id);
            };
            return (
              <section key={step.id} className="es-acc-card" data-open={isOpen}
                data-error={(issues.length > 0 || errorStepIds.has(step.id)) || undefined}>
                <h2 style={{ margin: 0 }}>
                  <button id={`assignment-section-${step.id}`} type="button" className="es-acc-head"
                    onClick={() => handleStepClick(step.id)} aria-expanded={isOpen}
                    aria-controls={`assignment-panel-${step.id}`}>
                    <span className="es-acc-badge" aria-hidden="true">
                      <ChevronRight size={26} strokeWidth={2} className="es-acc-badge-chev" />
                    </span>
                    <span className="es-acc-title-text">{title}</span>
                  </button>
                </h2>
                <div className={assignmentStyles.accordionMotion} data-expanded={isOpen} inert={!isOpen}>
                  <div className={assignmentStyles.accordionClip}>
                  <div id={`assignment-panel-${step.id}`} role="region"
                    aria-labelledby={`assignment-section-${step.id}`} className="es-acc-body"
                    onFocusCapture={activate} onPointerDownCapture={activate}>
                    {stepLocked && <p className={assignmentStyles.lockedNote}>Save General before editing this section.</p>}
                    <fieldset disabled={stepLocked || isLocked} className={assignmentStyles.sectionFields}>
                      <div className="es-acc-body-content">{renderCurrentStep(step.id)}</div>
                    </fieldset>
                    {issues.length > 0 && <div role="alert" className={assignmentStyles.issues}>
                      {issues.map((issue, index) => <p key={index}>{issue}</p>)}
                    </div>}
                  </div>
                  </div>
                </div>
              </section>
            );
          })}
        </main>
        <SettingsPreview issues={previewIssues} onIssueClick={handleIssueJump} allocatedMarks={calculateAllocatedMarks()} formData={formData} questionSource={questionSource} customSources={customSources}
          questionCount={formData.exerciseType === 'MCQ' ? formData.mcqConfig.generalQuestionCount
            : formData.exerciseType === 'Other' ? getOthersTotalQuestions()
            : getProgrammingTotalQuestions() + (formData.exerciseType === 'Combined' ? formData.mcqConfig.generalQuestionCount : 0)}
          location={hierarchyData.topicName || hierarchyData.moduleName || hierarchyData.courseName || nodeName} />
        </div>
        <footer className={assignmentStyles.footer}>
          <span className={assignmentStyles.draftHint}>Only the assignment name is needed to save progress.</span>
          <span className={assignmentStyles.saveLabel}>
            {isLocked ? 'Submitted' : `Editing: ${STEP_META[currentStepTitle]?.title || currentStepTitle}`}
          </span>
          {!isLocked && <button type="button" className={assignmentStyles.primary} onClick={handleComplete} disabled={busy}>
            {isLoading ? 'Saving…' : isEditing ? 'Save changes' : 'Save'}
          </button>}
        </footer>
      </div>
      {warningModal && (
        <div role="presentation"
          onClick={() => setWarningModal(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 95,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="warning-modal-title" aria-describedby="warning-modal-body"
            onClick={event => event.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12,
              width: 'min(480px, 100%)',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
              borderTop: '4px solid #D92D20',
            }}>
            <div style={{
              padding: '18px 20px 6px', display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#FEE4E2', color: '#B42318',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <AlertCircle size={22} strokeWidth={2.2} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h2 id="warning-modal-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#101828', lineHeight: 1.3 }}>
                  {warningModal.title}
                </h2>
                <p id="warning-modal-body" style={{ margin: '6px 0 0', fontSize: 12.5, color: '#475467', lineHeight: 1.55 }}>
                  {warningModal.body}
                </p>
              </div>
            </div>
            <div style={{
              padding: '14px 20px 16px', display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button type="button" onClick={() => setWarningModal(null)}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: '1px solid #d0d5dd',
                  background: '#fff', color: '#344054', fontSize: 12.5, fontWeight: 600,
                  cursor: 'pointer',
                }}>Cancel</button>
              <button type="button"
                onClick={() => { const fn = warningModal.onConfirm; setWarningModal(null); fn(); }}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: '1px solid #B42318',
                  background: '#D92D20', color: '#fff', fontSize: 12.5, fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(217, 45, 32, 0.35)',
                  cursor: 'pointer',
                }}>
                {warningModal.confirmLabel ?? 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmSaveOpen && (
        <div role="presentation"
          onClick={() => !isLoading && setConfirmSaveOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 90,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
          <div role="dialog" aria-modal="true" aria-labelledby="confirm-save-title"
            onClick={event => event.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 12,
              width: 'min(560px, 100%)', maxHeight: '86vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden',
            }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#FDF0E9',
            }}>
              <CircleAlert size={20} style={{ color: '#EE6A22' }} />
              <div>
                <h2 id="confirm-save-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#263746' }}>Review before saving</h2>
                <p style={{ margin: 0, fontSize: 12, color: '#57606E' }}>Confirm the details below to create this assignment.</p>
              </div>
            </div>
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 8, columnGap: 12, fontSize: 12.5, color: '#263746' }}>
                <dt style={{ color: '#57606E' }}>Name</dt><dd style={{ margin: 0, fontWeight: 600 }}>{formData.exerciseName || '—'}</dd>
                <dt style={{ color: '#57606E' }}>Type</dt><dd style={{ margin: 0, fontWeight: 600 }}>{formData.exerciseType || '—'}</dd>
                <dt style={{ color: '#57606E' }}>Difficulty</dt><dd style={{ margin: 0, fontWeight: 600, textTransform: 'capitalize' }}>{formData.exerciseLevel || '—'}</dd>
                <dt style={{ color: '#57606E' }}>Duration</dt><dd style={{ margin: 0, fontWeight: 600 }}>{formData.totalDuration || 0} minutes</dd>
                {formData.isGraded !== false && (
                  <>
                    <dt style={{ color: '#57606E' }}>Total marks</dt>
                    <dd style={{ margin: 0, fontWeight: 600 }}>
                      {formData.exerciseType === 'Combined'
                        ? `${Number(formData.totalMarksMCQ || 0) + Number(formData.totalMarksProgramming || 0)} (${formData.totalMarksMCQ || 0} MCQ + ${formData.totalMarksProgramming || 0} Programming)`
                        : (formData.totalMarks || 0)}
                    </dd>
                  </>
                )}
                <dt style={{ color: '#57606E' }}>Questions</dt>
                <dd style={{ margin: 0, fontWeight: 600 }}>
                  {formData.exerciseType === 'MCQ' ? formData.mcqConfig.generalQuestionCount
                    : formData.exerciseType === 'Other' ? getOthersTotalQuestions()
                    : getProgrammingTotalQuestions() + (formData.exerciseType === 'Combined' ? formData.mcqConfig.generalQuestionCount : 0)}
                </dd>
                <dt style={{ color: '#57606E' }}>Grading</dt><dd style={{ margin: 0, fontWeight: 600 }}>{formData.isGraded !== false ? 'Graded' : 'Non-graded'}</dd>
                <dt style={{ color: '#57606E' }}>Question source</dt><dd style={{ margin: 0, fontWeight: 600, textTransform: 'capitalize' }}>{questionSource || '—'}</dd>
              </dl>
              <p style={{ margin: '14px 0 0', fontSize: 11.5, color: '#57606E', lineHeight: 1.5 }}>
                Once saved, the assignment will be created and visible to students according to the schedule. You can still edit it afterwards.
              </p>
            </div>
            <div style={{
              padding: '12px 20px', borderTop: '1px solid #e5e7eb',
              display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button type="button" onClick={() => setConfirmSaveOpen(false)} disabled={isLoading}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: '1px solid #d9dfe5',
                  background: '#fff', color: '#263746', fontSize: 12.5, fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}>Cancel</button>
              <button type="button"
                onClick={async () => { setConfirmSaveOpen(false); await performCompleteSave(); }}
                disabled={isLoading}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: '1px solid #D65A16',
                  background: '#EE6A22', color: '#fff', fontSize: 12.5, fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(238, 106, 34, 0.35)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                }}>
                <Check size={13} style={{ verticalAlign: '-2px', marginRight: 6 }} />
                {isLoading ? 'Saving…' : 'Confirm & save'}
              </button>
            </div>
          </div>
        </div>
      )}
      </CompactSettingsContext.Provider>
    </div>
  );
};

export default ExerciseSettings;
