// types.tsx
import { ReactNode } from "react";
import { SecuritySettingsData } from "./SecuritySettings";
import type { EvaluationMethodSetting } from "@/app/lms/component/evaluation/EvaluationMethodConfig";

export interface ExercisePayload {
  configurationType: "manual";
  tabType: "I_Do" | "We_Do" | "You_Do";
  subcategory: string;
  exerciseType: "MCQ";
  exerciseInformation: {
    exerciseId: string;
    exerciseName: string;
    description: string;
    exerciseLevel: "beginner" | "intermediate" | "expert";
    totalDuration: number;
    totalMarks: number;
  };
  totalMarksMCQ?: number;
  questionConfiguration: any;
  availabilityPeriod: any;
  notificationSettings: any;
  securitySettings: SecuritySettingsData;
}

export interface HierarchyData {
  courseName: string;
  moduleName: string;
  submoduleName: string;
  topicName: string;
  subtopicName: string;
  nodeType: string;
  level: number;
}

export interface ExerciseSettingsProps {
  hierarchyData: HierarchyData;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  subcategory: string;
onSave?: (payload: any) => void;
  onClose: () => void;
  isEditing?: boolean;
  tabType?: "I_Do" | "We_Do" | "You_Do";
  initialData?: any;
  exercise_Id?: string;
  exerciseData?: any;   // pre-loaded raw exercise — skips API fetch on edit
  courseId?: string;
  // Node-scoped skill set (the topic's own testConfiguration). Preferred over
  // the whole-course config when rendering the Skill Set chips.
  configuredLanguages?: { coreProgram?: string[]; frontend?: string[]; database?: string[] };
  // Which Mock/Final tab the create flow was launched from — pre-selects the
  // Test Type in Exercise Details so the new assessment lands on that tab.
  defaultTestType?: "mock" | "final";
}
// assessments/types.ts - Add these to existing types

export interface BaseConfigProps {
  formData: FormDataType;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationErrors>>;
  validationErrors: ValidationErrors;
  touchedFields: Set<string>;
  markTouched: (field: string) => void;
  InfoTooltip: React.FC<{ content: string; side?: string }>;
  SectionLabel: React.FC<{ children: React.ReactNode; required?: boolean; info?: string }>;
  ODropdown: React.FC<any>;
  ONumberInput: React.FC<any>;
  OToggle: React.FC<any>;
  OInput: React.FC<any>;
  D: any;
  mcqScoringOptions: { value: string; label: string }[];
  configOptions: { value: string; label: string }[];
  questionFlowOptions: { value: string; label: string; description: string; icon: React.ReactNode }[];
  getProgrammingTotalQuestions?: () => number;
  programmingAllocatedMarks?: number;
  programmingLevelMismatch?: string | null;
  shouldShowScoringSection?: boolean;
  othersAllocatedMarks?: number;
  othersLevelMismatch?: string | null;
  othersShouldShowScoringSection?: boolean;
  updateLevelScoringConfig?: (level: 'easy' | 'medium' | 'hard', updates: any) => void;
  updateOthersLevelScoringConfig?: (level: 'easy' | 'medium' | 'hard', updates: any) => void;
  setExpandedSections?: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedSections?: Set<string>;
  combinedConfigTab?: 'mcq' | 'programming';
  setCombinedConfigTab?: React.Dispatch<React.SetStateAction<'mcq' | 'programming'>>;
}
export interface Step {
  id: number;
  title: string;
  subtitle: string;
  completed: boolean;
  active: boolean;
  icon: React.ReactNode;
  indentLevel?: number;
  isChild?: boolean;
}

export interface ValidationErrors {
  exerciseType?: string;
  selectedModule?: string;
  selectedLanguages?: string;
  exerciseId?: string;
  exerciseName?: string;
  description?: string;
  totalDuration?: string;
  totalMarks?: string;
  totalMarksMCQ?: string;
  mcqGeneralQuestionCount?: string;
  mcqMarksPerQuestion?: string;
  mcqTotalMarks?: string;
  startDate?: string;
  endDate?: string;
  gracePeriod?: string;
  [key: string]: any;
}

export interface FormDataType {
  // Supports every exercise type the form can hold ('' = unset, used while
  // section-based hides the type selector). Previously typed as only "" | "MCQ",
  // which produced spurious "no overlap" errors on every Programming/Combined/Other check.
  exerciseType: "" | "MCQ" | "Programming" | "Combined" | "Other" | "SectionBased";
  selectedModule: string;
  selectedLanguages: string[];
  exerciseId: string;
    testType?: "practice" | "mock" | "final";  // ← ADD THIS

  exerciseName: string;
  description: string;
  exerciseLevel: "beginner" | "intermediate" | "expert";
  totalDuration: number;
  totalMarks: number;
  totalMarksMCQ: number;
  totalMarksProgramming: number;
  mcqConfig: any;
  // Question-config blocks for the non-MCQ exercise types + section-based state.
  programmingConfig: any;
  othersConfig: any;
  isSectionBased?: boolean;
  sections?: any[];
  sectionConfigs?: Record<string, any>;
  // Legacy aliases for the Combined per-part marks (kept for back-compat with
  // any caller still reading them; canonical fields are totalMarksMCQ/Programming).
  mcqMarks?: number;
  programmingMarks?: number;
  schedule: any;
  notifyUsers: boolean;
  notifyGmail: boolean;
  notifyWhatsApp: boolean;
  gradeSheet: boolean;
  notifications: {
    notifyGradersSubmissions: boolean;
    notifyGradersLateSubmissions: boolean;
    notifyStudent: boolean;
  };
  grades: {
    mcqGrade: number | null;
    mcqGradeToPass: number | null;
    combinedGrade: number | null;
    combinedGradeToPass: number | null;
    separateMarks: boolean;
    // Master toggle for the Mark / Mark to Pass fields. When false, the
    // Total Mark and Mark to Pass inputs are hidden and skipped during
    // validation — the exercise simply has no pass/fail threshold.
    // Defaults to true to preserve existing behaviour.
    enablePassMark?: boolean;
    // Per-section pass mark when the exercise is section-based (Part A / B / C …).
    // Key is the section id; value must be > 0 and strictly less than that
    // section's totalMarks (e.g. Part A total 50 → max pass mark 49).
    sectionPassMarks?: Record<string, number | null>;
    // Grade-level "Section Based" split (independent of the Exercise Details
    // section-based): when on, grading is broken into named parts each with its
    // own total + pass mark. Persisted so editing restores the toggle + parts.
    sectionBased?: boolean;
    sections?: Array<{ id: string; name: string; totalMarks: number | null; passMark: number | null }>;
    // Optional separate programming pass mark (used by GradeSettingsStep's
    // separate-marks layout).
    programmingGradeToPass?: number | null;
  };
  additionalOptions: {
    anonymousSubmissions: boolean;
    hideGraderIdentity: boolean;
  };
  securitySettings: SecuritySettingsData;
  // Evaluation Method config — test case or AI. Stored only; consumed by
  // the grading pipeline later.
  evaluationMethod: EvaluationMethodSetting;
  sectionBasedDuration?: boolean;
  // Select Assessment Content step — persisted so the student attend flow
  // can scope questions to the chosen topics and show the instructions.
  selectedTopics: Array<{ id: string; title: string; level: number }>;
  instructions: string;
}



export interface SectionBasedConfig {
  sectionName: string;
  difficulty: 'easy' | 'medium' | 'hard';
  totalMarks: number;
  questionCount: number;
  marksPerQuestion: number;
}

export interface SectionScoringConfig {
  sections: {
    [sectionId: string]: {
      name: string;
      difficulty: 'easy' | 'medium' | 'hard';
      marksPerQuestion: number;
      questionCount: number;
      totalMarks: number;
    };
  };
  totalSections: number;
  totalQuestions: number;
  totalMarks: number;
}



