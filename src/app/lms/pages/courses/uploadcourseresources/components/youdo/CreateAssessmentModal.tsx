// CreateAssessmentModal.tsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { X, Sparkles, Settings2, ArrowLeft, ArrowRight, FileText, Loader2, Check, Lock, Shield, Layers, ClipboardList, FolderOpen } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { exerciseApi } from '@/apiServices/exercise';
import TipTapEditor from '@/app/lms/component/tiptopEditor';
import { D, injectFonts, getEntityType, isApproximatelyEqual, formatDecimal, moduleLanguages, mcqScoringOptions, generateCalendarDays } from './assessments/constants';
import { ExerciseSettingsProps, HierarchyData, Step, ValidationErrors, FormDataType } from './assessments/types';
import { MCQConfiguration } from './assessments/QuestionConfigurationSteps';
import { ScheduleStep } from './assessments/ScheduleStep';
import { NotificationsStep } from './assessments/NotificationsStep';
import { GradeSettingsStep } from './assessments/GradeSettingsStep';
import { InfoTooltip, OInput, ONumberInput, OToggle, ODropdown, GradeRow, DateRowPicker } from './assessments/UIComponents';
import { ExerciseDetailsStep, SectionItem, ExerciseDetailsStepRef } from './assessments/ExerciseDetailsStep';
import { SecuritySettings, SecuritySettingsData, defaultSecuritySettings } from './assessments/SecuritySettings';
import { courseDataApi } from '@/apiServices/coursesData';
import { ProgrammingConfiguration } from './assessments/ProgrammingConfiguration';
import { CombinedConfiguration } from './assessments/CombinedConfiguration';
import { OthersConfiguration } from './assessments/OthersConfiguration';
import { SectionConfigurationStep, SectionConfigurationStepRef } from './assessments/SectionConfiguration';
import SelectAssessmentContentStep from './assessments/SelectAssessmentContentStep';
import {
  QuestionSourceStep, emptyCustomDist,
  QuestionSource, CustomSubSource, CustomDistribution, CustomCell,
  CustomDistributionBySection,
} from './assessments/QuestionSourceStep';
// Evaluation Method (Test Case / AI) — same component + stored shape as the
// We_Do ExerciseSettings wizard, so both surfaces persist identical config.
import {
  DEFAULT_EVALUATION_METHOD,
  normalizeEvaluationMethod,
} from '@/app/lms/component/evaluation/EvaluationMethodConfig';

// Derive which steps already have saved data from the raw exercise object.
// Determine which steps are "saved" for an exercise being edited.
// The sidebar/footer track saved steps by their TITLE (stable across the dynamic
// step layout), mirroring ExerciseSettings.tsx. The backend persists this as the
// `stepsSaved` string array, so prefer it directly. For legacy exercises saved
// before `stepsSaved` existed, fall back to inferring from the persisted data —
// reading the BACKEND field names (e.g. mcqQuestionConfiguration.totalMcqQuestions).
// A stored source only counts as a completed Question Source step when it is
// actually valid — 'custom' needs its two-sub-source minimum, same as the
// step's own gate, or the sidebar would show Completed for a broken config.
function hasValidStoredSource(exercise: any): boolean {
  if (!exercise.questionSource) return false;
  return exercise.questionSource !== 'custom' ||
    (Array.isArray(exercise.customSources) && exercise.customSources.length >= 2);
}

function computeEditSavedSteps(exercise: any): Set<string> {
  // Primary: the explicit list of steps the user saved (authoritative).
  if (Array.isArray(exercise.stepsSaved) && exercise.stepsSaved.length > 0) {
    const fromSaved = new Set<string>(exercise.stepsSaved);
    // Back-compat: a source persisted before the Question Source step existed
    // (or via the We_Do settings modal) counts as that step being done.
    if (hasValidStoredSource(exercise)) fromSaved.add('Question Source');
    return fromSaved;
  }

  // Fallback: infer from persisted data for legacy records.
  const saved = new Set<string>(['Exercise Details']); // exercise exists ⇒ step 1 saved
  const info = exercise.exerciseInformation || {};
  const qCfg = exercise.questionConfiguration || {};
  const mcqCfg = qCfg.mcqQuestionConfiguration || qCfg.mcqConfig || {};
  const progCfg = qCfg.programmingQuestionConfiguration || qCfg.programmingConfig || {};
  const otherCfg = qCfg.othersQuestionConfiguration || qCfg.othersConfig || {};
  const schedule = exercise.availabilityPeriod || {};

  const sectionBased =
    exercise.isSectionBased === true ||
    info.isSectionBased === true ||
    exercise.exerciseType === 'SectionBased' ||
    info.exerciseType === 'SectionBased';

  if (sectionBased) {
    if ((exercise.sections || []).length > 0) saved.add('Section Details');
  } else {
    // Backend renames MCQ count → totalMcqQuestions; programming keeps generalQuestionCount.
    const hasMCQ  = (mcqCfg.totalMcqQuestions || mcqCfg.generalQuestionCount || 0) > 0;
    const hasProg = (progCfg.generalQuestionCount  || 0) > 0 ||
                    (progCfg.levelBasedCounts?.easy || 0) > 0 ||
                    (progCfg.levelBasedCounts?.medium || 0) > 0 ||
                    (progCfg.selectionLevelCounts?.easy || 0) > 0;
    const hasOther = (otherCfg.generalQuestionCount || 0) > 0 ||
                     (otherCfg.levelBasedCounts?.easy || 0) > 0;
    if (hasMCQ || hasProg || hasOther) saved.add('Question Configuration');
  }

  if (hasValidStoredSource(exercise)) saved.add('Question Source');
  if (schedule.startDate && schedule.endDate) saved.add('Schedule');

  return saved;
}

const CreateAssessmentModal: React.FC<ExerciseSettingsProps> = ({
  hierarchyData, nodeId, nodeName, nodeType, subcategory, courseId, onSave = () => {}, onClose,
  isEditing = false, tabType = 'You_Do', initialData, exercise_Id, exerciseData: preloadedExercise, configuredLanguages,
  defaultTestType
}) => {
  injectFonts();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  // Distinct from isLoading (which is also used by the Finish button save
  // path). Tracks ONLY the initial-edit fetch → populate sequence so we can
  // cover the modal body with a spinner instead of showing empty fields the
  // trainer thinks are the real state.
  const [isHydratingEdit, setIsHydratingEdit] = useState<boolean>(false);
  // Saved/completed steps are tracked by step TITLE (stable across the dynamic
  // step layout) and persisted to the backend via `stepsSaved`. Mirrors ExerciseSettings.
  const [savedSteps, setSavedSteps] = useState<Set<string>>(new Set());
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isLocked, setIsLocked] = useState(false);
  const [localExerciseId, setLocalExerciseId] = useState<string | null>(exercise_Id || null);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [activePicker, setActivePicker] = useState<{ field: string | null; type: string | null }>({ field: null, type: null });
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['configuration']));
  const [combinedConfigTab, setCombinedConfigTab] = useState<'mcq' | 'programming'>('mcq');
  
  // ── Question Source (parity with ExerciseSettings' Add Questions step) ──
  // Persisted TOP-LEVEL on the exercise doc (questionSource / customSources /
  // customDistribution / saveToBank — the exact contract ExerciseSettings
  // writes), because Manage Test's AddQuestionForm gates its Manual/Bank/AI/
  // Other Platform entries from fullExerciseData.questionSource.
  const [questionSource, setQuestionSource] = useState<QuestionSource>('');
  const [customSources, setCustomSources] = useState<CustomSubSource[]>([]);
  const [customDistribution, setCustomDistribution] = useState<CustomDistribution>(emptyCustomDist());
  // Per-section Custom-mix allocation for section-based assessments. Keyed by
  // section id; each entry mirrors the aggregate `customDistribution` shape.
  // Non-section assessments leave this empty and use the aggregate matrix above.
  const [customDistributionBySection, setCustomDistributionBySection] = useState<CustomDistributionBySection>({});
  const [saveToBank, setSaveToBank] = useState(false);
  // Combined-only: the MCQ part's own source ('' = inherit the programming
  // source) with its single-cell Custom split (Manual/AI counts).
  const [questionSourceMcq, setQuestionSourceMcq] = useState<QuestionSource>('');
  const [customSourcesMcq, setCustomSourcesMcq] = useState<CustomSubSource[]>([]);
  const [customDistributionMcq, setCustomDistributionMcq] = useState<CustomCell>({ scratch: 0, ai: 0, thirdParty: 0 });

  // Section-based state
  const [isSectionBased, setIsSectionBased] = useState(false);
  const [isSectionBasedDuration, setIsSectionBasedDuration] = useState(false);
  const [exerciseSections, setExerciseSections] = useState<SectionItem[]>([]);
  const exerciseDetailsStepRef = useRef<ExerciseDetailsStepRef>(null);
  const sectionConfigurationStepRef = useRef<SectionConfigurationStepRef>(null);
  // Guard: populate the form from the loaded exercise ONCE per exercise.
  // Without this, a re-rendered `exerciseData` (parent computes it inline via
  // rawExercises.find) re-runs the loader and clobbers in-progress edits
  // (e.g. the Camera Proctoring toggle reverting on save).
  const populatedForIdRef = useRef<string | null>(null);

  const [courseConfig, setCourseConfig] = useState<{
    coreProgram: string[];
    frontend: string[];
    database: string[];
  }>({
    coreProgram: [],
    frontend: [],
    database: []
  });
  const [isLoadingCourse, setIsLoadingCourse] = useState(false);

  const [formData, setFormData] = useState<FormDataType>({
    exerciseType: 'MCQ',
    // Pre-selected from the Mock/Final tab the trainer launched Create from.
    // On edit, the loader below overwrites this with the stored testType.
    testType: defaultTestType || 'mock',
    selectedModule: '', selectedLanguages: [],
    exerciseId: `EX${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    exerciseName: '', description: '',
    exerciseLevel: 'intermediate',
    totalDuration: 60, totalMarks: 0, totalMarksMCQ: 0, totalMarksProgramming: 0,
    mcqConfig: {
      questionConfigType: 'general',
      generalQuestionCount: 0,
      sectionConfig: {
        sections: {},
        totalSections: 0,
        totalQuestions: 0,
        totalMarks: 0
      },
      scoreSettings: { 
        scoreType: 'equalDistribution',
        equalDistribution: 0, 
        totalMarks: 0 
      },
      attemptLimitEnabled: false, 
      submissionAttempts: 1,
    },
    programmingConfig: {
      questionConfigType: 'general', generalQuestionCount: 0,
      selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
      levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
      sectionConfig: {
        sections: {},
        totalSections: 0,
        totalQuestions: 0,
        totalMarks: 0
      },
      scoreSettings: {
        scoreType: 'equalDistribution', equalDistribution: 0,
        questionSpecific: { general: [], levelBased: { easy: [], medium: [], hard: [] } },
        levelBasedMarks: { easy: 0, medium: 0, hard: 0 },
        levelScoringConfiguration: {
          easy: { type: 'level_specific', marksPerQuestion: 0, totalMarks: undefined, questionCount: 0 },
          medium: { type: 'level_specific', marksPerQuestion: 0, totalMarks: undefined, questionCount: 0 },
          hard: { type: 'level_specific', marksPerQuestion: 0, totalMarks: undefined, questionCount: 0 },
        },
        totalMarks: 0,
      },
      questionFlow: 'freeFlow', attemptLimitEnabled: false, submissionAttempts: 1,
    },
    othersConfig: {
      questionConfigType: 'general', generalQuestionCount: 0,
      selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
      levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
      sectionConfig: {
        sections: {},
        totalSections: 0,
        totalQuestions: 0,
        totalMarks: 0
      },
      scoreSettings: {
        scoreType: 'equalDistribution', equalDistribution: 0,
        questionSpecific: { general: [], levelBased: { easy: [], medium: [], hard: [] } },
        levelBasedMarks: { easy: 0, medium: 0, hard: 0 },
        levelScoringConfiguration: {
          easy: { type: 'level_specific', marksPerQuestion: 0, totalMarks: undefined, questionCount: 0 },
          medium: { type: 'level_specific', marksPerQuestion: 0, totalMarks: undefined, questionCount: 0 },
          hard: { type: 'level_specific', marksPerQuestion: 0, totalMarks: undefined, questionCount: 0 },
        },
        totalMarks: 0,
      },
      questionFlow: 'freeFlow', attemptLimitEnabled: false, submissionAttempts: 1,
    },
    schedule: {
      allowSubmissions: true,
      startDate: { day: 0, month: 0, year: 0, hour: 0, minute: 0 },
      endDate: { day: 0, month: 0, year: 0, hour: 0, minute: 0 },
      cutOffEnabled: false,
      cutOffDate: { day: 0, month: 0, year: 0, hour: 23, minute: 59 },
      remindGradeByEnabled: false,
      remindGradeBy: { day: 0, month: 0, year: 0, hour: 0, minute: 0 },
      gracePeriodEnabled: false,
      gracePeriodDate: { day: 0, month: 0, year: 0, hour: 23, minute: 59 },
      requiresAdminApproval: false,
      approvalScope: 'settings',
    },
    securitySettings: defaultSecuritySettings,
    // Test case is the historical behaviour and stays the default.
    // You_Do assessments default to Test Case — this preserves the historical
    // auto-scoring behaviour: pre-feature You_Do assessments always ran the
    // question's test cases at Submit and posted the computed score. The
    // shared DEFAULT_EVALUATION_METHOD is Manual (the safer overall default),
    // which is what We_Do exercises get.
    evaluationMethod: { ...DEFAULT_EVALUATION_METHOD, method: 'testcase' as const },
    notifyUsers: true, notifyGmail: false, notifyWhatsApp: false, gradeSheet: true,
    notifications: {
      notifyGradersSubmissions: false,
      notifyGradersLateSubmissions: false,
      notifyStudent: true,
    },
    grades: {
      mcqGrade: null, mcqGradeToPass: null,
      combinedGrade: null, combinedGradeToPass: null,
      separateMarks: false,
    },
    additionalOptions: {
      anonymousSubmissions: false,
      hideGraderIdentity: false,
    },
    sectionConfigs: {},
    isSectionBased: false,
    sections: [],
    // Final step — selected course topics + assessment instructions (persisted).
    selectedTopics: [],
    instructions: '',
  });

  // Live course module hierarchy (for the "Select Assessment Content" step tree).
  const [courseModules, setCourseModules] = useState<any[]>([]);

  const updateLevelScoringConfig = useCallback((level: 'easy' | 'medium' | 'hard', updates: any) => {
    setFormData(prev => ({
      ...prev,
      programmingConfig: {
        ...prev.programmingConfig,
        scoreSettings: {
          ...prev.programmingConfig.scoreSettings,
          levelScoringConfiguration: {
            ...prev.programmingConfig.scoreSettings.levelScoringConfiguration,
            [level]: { ...prev.programmingConfig.scoreSettings.levelScoringConfiguration[level], ...updates }
          }
        }
      }
    }));
  }, []);

  const updateOthersLevelScoringConfig = useCallback((level: 'easy' | 'medium' | 'hard', updates: any) => {
    setFormData(prev => ({
      ...prev,
      othersConfig: {
        ...prev.othersConfig,
        scoreSettings: {
          ...prev.othersConfig.scoreSettings,
          levelScoringConfiguration: {
            ...prev.othersConfig.scoreSettings.levelScoringConfiguration,
            [level]: { ...prev.othersConfig.scoreSettings.levelScoringConfiguration[level], ...updates }
          }
        }
      }
    }));
  }, []);

  const getProgrammingTotalQuestions = useCallback(() => {
    const pc = formData.programmingConfig;
    if (pc.questionConfigType === 'general') return pc.generalQuestionCount;
    if (pc.questionConfigType === 'levelBased') {
      const c = pc.levelBasedCounts;
      return c.easy + c.medium + c.hard;
    }
    if (pc.questionConfigType === 'selectionLevel') {
      const c = pc.selectionLevelCounts;
      return c.easy + c.medium + c.hard;
    }
    return 0;
  }, [formData.programmingConfig]);

  const programmingAllocatedMarks = useMemo(() => {
    let m = 0;
    const pc = formData.programmingConfig;
    if (pc.questionConfigType === 'general') {
      if (pc.scoreSettings.scoreType === 'equalDistribution') {
        m = pc.generalQuestionCount * pc.scoreSettings.equalDistribution;
      }
    } else {
      const counts = pc.questionConfigType === 'selectionLevel' ? pc.selectionLevelCounts : pc.levelBasedCounts;
      const ls = pc.scoreSettings.levelScoringConfiguration;
      (['easy', 'medium', 'hard'] as const).forEach(l => {
        const c = counts[l] || 0;
        if (!c) return;
        const s = ls[l];
        if (s) {
          if (s.type === 'level_specific' && s.marksPerQuestion) m += c * s.marksPerQuestion;
          else if (s.type === 'question_specific' && s.totalMarks) m += s.totalMarks;
        }
      });
    }
    return m;
  }, [formData.programmingConfig]);

  const othersAllocatedMarks = useMemo(() => {
    let m = 0;
    const oc = formData.othersConfig;
    if (oc.questionConfigType === 'general') {
      if (oc.scoreSettings.scoreType === 'equalDistribution') {
        m = oc.generalQuestionCount * oc.scoreSettings.equalDistribution;
      }
    } else {
      const counts = oc.questionConfigType === 'selectionLevel' ? oc.selectionLevelCounts : oc.levelBasedCounts;
      const ls = oc.scoreSettings.levelScoringConfiguration;
      (['easy', 'medium', 'hard'] as const).forEach(l => {
        const c = counts[l] || 0;
        if (!c) return;
        const s = ls[l];
        if (s) {
          if (s.type === 'level_specific' && s.marksPerQuestion) m += c * s.marksPerQuestion;
          else if (s.type === 'question_specific' && s.totalMarks) m += s.totalMarks;
        }
      });
    }
    return m;
  }, [formData.othersConfig]);

  const programmingLevelMismatch = useMemo((): string | null => {
    const et = formData.exerciseType;
    if (et !== 'Programming' && et !== 'Combined') return null;
    const ct = formData.programmingConfig.questionConfigType;
    if (ct === 'general') return null;
    const total = et === 'Combined' ? formData.totalMarksProgramming : formData.totalMarks;
    if (total <= 0) return null;
    const ls = formData.programmingConfig.scoreSettings?.levelScoringConfiguration;
    if (!ls) return null;
    
    const getSum = (counts: any) => {
      let s = 0;
      (['easy', 'medium', 'hard'] as const).forEach(l => {
        const c = counts?.[l] ?? 0;
        if (!c) return;
        const sc = ls?.[l];
        if (!sc) return;
        s += sc.type === 'level_specific' ? (sc.marksPerQuestion ?? 0) * c : sc.totalMarks ?? 0;
      });
      return s;
    };
    
    if (ct === 'levelBased') {
      const counts = formData.programmingConfig.levelBasedCounts;
      if (counts.easy <= 0 || counts.medium <= 0 || counts.hard <= 0) return null;
      const sum = getSum(counts);
      if (sum <= 0) return null;
      return isApproximatelyEqual(sum, total) ? null : `Level totals sum to ${sum} but total is ${total}.`;
    }
    
    if (ct === 'selectionLevel') {
      const counts = formData.programmingConfig.selectionLevelCounts;
      const active = (['easy', 'medium', 'hard'] as const).filter(l => counts?.[l] > 0);
      if (!active.length) return null;
      const sum = getSum(counts);
      if (sum <= 0) return null;
      return isApproximatelyEqual(sum, total) ? null : `Selected totals sum to ${sum} but total is ${total}.`;
    }
    return null;
  }, [formData.exerciseType, formData.totalMarks, formData.totalMarksProgramming, formData.programmingConfig]);

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
        const c = counts?.[l] ?? 0;
        if (!c) return;
        const sc = ls?.[l];
        if (!sc) return;
        s += sc.type === 'level_specific' ? (sc.marksPerQuestion ?? 0) * c : sc.totalMarks ?? 0;
      });
      return s;
    };
    
    if (ct === 'levelBased') {
      const counts = formData.othersConfig.levelBasedCounts;
      if (counts.easy <= 0 || counts.medium <= 0 || counts.hard <= 0) return null;
      const sum = getSum(counts);
      if (sum <= 0) return null;
      return isApproximatelyEqual(sum, total) ? null : `Level totals sum to ${sum} but total is ${total}.`;
    }
    
    if (ct === 'selectionLevel') {
      const counts = formData.othersConfig.selectionLevelCounts;
      const active = (['easy', 'medium', 'hard'] as const).filter(l => counts?.[l] > 0);
      if (!active.length) return null;
      const sum = getSum(counts);
      if (sum <= 0) return null;
      return isApproximatelyEqual(sum, total) ? null : `Selected totals sum to ${sum} but total is ${total}.`;
    }
    return null;
  }, [formData.exerciseType, formData.totalMarks, formData.othersConfig]);

  const shouldShowScoringSection = useMemo(() => {
    const ct = formData.programmingConfig.questionConfigType;
    if (ct === 'general') return false;
    if (ct === 'levelBased') {
      const c = formData.programmingConfig.levelBasedCounts;
      return c.easy > 0 && c.medium > 0 && c.hard > 0;
    }
    if (ct === 'selectionLevel') {
      const c = formData.programmingConfig.selectionLevelCounts;
      return c.easy > 0 || c.medium > 0 || c.hard > 0;
    }
    return false;
  }, [formData.programmingConfig]);

  const othersShouldShowScoringSection = useMemo(() => {
    const ct = formData.othersConfig.questionConfigType;
    if (ct === 'general') return false;
    if (ct === 'levelBased') {
      const c = formData.othersConfig.levelBasedCounts;
      return c.easy > 0 && c.medium > 0 && c.hard > 0;
    }
    if (ct === 'selectionLevel') {
      const c = formData.othersConfig.selectionLevelCounts;
      return c.easy > 0 || c.medium > 0 || c.hard > 0;
    }
    return false;
  }, [formData.othersConfig]);

  useEffect(() => {
    const fetchCourseData = async () => {
      let extractedCourseId = null;
      
      if (courseId) {
        extractedCourseId = courseId;
      } else if ((hierarchyData as any)?.courseId) {
        extractedCourseId = (hierarchyData as any).courseId;
      } else if ((hierarchyData as any)?.course?._id) {
        extractedCourseId = (hierarchyData as any).course._id;
      } else if (nodeType === 'course' && nodeId) {
        extractedCourseId = nodeId;
      }
      
      if (!extractedCourseId) {
        return;
      }

      setIsLoadingCourse(true);
      try {
        const response = await courseDataApi.getById(extractedCourseId).queryFn();
        const courseData = response?.data || response;

        if (courseData && Array.isArray(courseData.modules)) {
          setCourseModules(courseData.modules);
        }

        if (courseData && courseData.testConfiguration) {
          setCourseConfig({
            coreProgram: courseData.testConfiguration.coreProgram || [],
            frontend: courseData.testConfiguration.frontend || [],
            database: courseData.testConfiguration.database || []
          });
        }
      } catch (error) {
        console.error('Failed to fetch course configuration:', error);
        toast.error('Failed to load course configuration');
      } finally {
        setIsLoadingCourse(false);
      }
    };

    if (hierarchyData || nodeId || courseId) {
      fetchCourseData();
    }
  }, [hierarchyData, nodeId, nodeType, courseId]);

  // Prefer the node-scoped configuredLanguages prop (the topic's OWN
  // testConfiguration — e.g. just html/css/js) over the whole-course config
  // fetched below as a fallback. This mirrors how ExerciseSettings receives its
  // node-scoped languages, so the Skill Set chips match it exactly.
  const effectiveConfig = useMemo(() => {
    const hasProp = !!(
      configuredLanguages &&
      ((configuredLanguages.coreProgram?.length ?? 0) ||
        (configuredLanguages.frontend?.length ?? 0) ||
        (configuredLanguages.database?.length ?? 0))
    );
    return hasProp
      ? {
          coreProgram: configuredLanguages!.coreProgram ?? [],
          frontend: configuredLanguages!.frontend ?? [],
          database: configuredLanguages!.database ?? [],
        }
      : courseConfig;
  }, [configuredLanguages, courseConfig]);

  const getFilteredLanguages = useCallback((category: string) => {
    let languages: string[] = [];

    if (category === "Core Programming") {
      languages = effectiveConfig.coreProgram || [];
    } else if (category === "Frontend") {
      languages = effectiveConfig.frontend || [];
    } else if (category === "Database") {
      languages = effectiveConfig.database || [];
    }

    const languageMap: Record<string, { name: string; icon: string }> = {
      c: { name: "C", icon: "" }, cpp: { name: "C++", icon: "" },
      java: { name: "Java", icon: "" }, python: { name: "Python", icon: "" },
      html: { name: "HTML", icon: "" }, css: { name: "CSS", icon: "" },
      js: { name: "JavaScript", icon: "" }, react: { name: "React", icon: "" },
      next: { name: "Next.js", icon: "" }, sql: { name: "SQL", icon: "" },
      mongodb: { name: "MongoDB", icon: "" },
    };

    return languages.map(lang => ({
      name: languageMap[lang]?.name || lang,
      icon: languageMap[lang]?.icon || ""
    }));
  }, [effectiveConfig]);

  const hasPreConfiguredLanguages = useMemo(() => {
    return !!(effectiveConfig.coreProgram?.length || effectiveConfig.frontend?.length || effectiveConfig.database?.length);
  }, [effectiveConfig]);

  const flatLanguages = useMemo(() => {
    return [
      ...(effectiveConfig.coreProgram || []),
      ...(effectiveConfig.frontend || []),
      ...(effectiveConfig.database || [])
    ];
  }, [effectiveConfig]);

  // Auto-select all configured languages as the assessment's Skill Set —
  // mirrors ExerciseSettings. ExerciseDetailsStep shows the Skill Set read-only
  // as chips, so the selection must be applied here for it to be saved.
  useEffect(() => {
    if (!hasPreConfiguredLanguages || flatLanguages.length === 0) return;
    let detectedModule = '';
    if (effectiveConfig.coreProgram?.length) detectedModule = 'Core Programming';
    else if (effectiveConfig.frontend?.length) detectedModule = 'Frontend';
    else if (effectiveConfig.database?.length) detectedModule = 'Database';
    setFormData(prev => ({
      ...prev,
      selectedLanguages: flatLanguages,
      selectedModule: detectedModule || prev.selectedModule,
    }));
    setValidationErrors(prev => {
      const e = { ...prev };
      delete e.selectedModule;
      delete e.selectedLanguages;
      return e;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPreConfiguredLanguages, flatLanguages.join(',')]);

  const mcqScoringOptionsConst = useMemo(() => [
    { value: 'equalDistribution', label: 'Equal Distribution' },
    { value: 'questionSpecific', label: 'Question Specific' },
  ], []);

  const configOptions = useMemo(() => [
    { label: 'General Configuration', value: 'general' },
    { label: 'Level Based Configuration', value: 'levelBased' },
    { label: 'Selection Level Configuration', value: 'selectionLevel' },
  ], []);

  const questionFlowOptions = useMemo(() => [
    { value: 'freeFlow', label: 'Free Flow', description: 'Users can attempt questions in any order', icon: null },
    { value: 'controlled', label: 'Controlled Flow', description: 'Users must follow specific sequence', icon: null },
  ], []);

  useEffect(() => {
    const loadExerciseData = async () => {
      if (!isEditing) return;

      // Populate ONCE per exercise — never clobber the user's in-progress edits
      // when the parent re-renders and hands us a new `exerciseData` reference.
      const loadKey = String(
        exercise_Id ||
        (preloadedExercise && (preloadedExercise._id || preloadedExercise.id)) ||
        'edit'
      );
      if (populatedForIdRef.current === loadKey) return;
      populatedForIdRef.current = loadKey;

      // ── Cache-first hydration (new) ──
      // When the parent hands us the row's already-loaded exercise, populate
      // from it INSTANTLY so the modal opens with the fields filled in — no
      // full-card "Loading assessment… Fetching your saved settings and
      // questions" overlay to sit through. Then fire a silent background
      // refresh so any edits saved elsewhere still land, without a loader
      // and without a toast if it fails (the preloaded copy is on screen).
      //
      // The old primary path always did a loud fetch first and toasted
      // "Failed to load exercise data" whenever the network was slow or the
      // request failed, which is exactly the "so much time taking, some time
      // failed to fetch" the trainer reported. The stale-data guard the old
      // comment worried about is still covered: the background refresh below
      // overrides the preloaded values as soon as fresh data arrives.
      if (preloadedExercise) {
        populateFormFromExercise(preloadedExercise);
        const savedSet = computeEditSavedSteps(preloadedExercise);
        setSavedSteps(savedSet);
        setCompletedSteps(savedSet);
        setIsHydratingEdit(false);

        if (exercise_Id) {
          try {
            const response = await exerciseApi.getExerciseById(exercise_Id);
            const exerciseData = response?.data?.exercise || response?.data || response;
            if (exerciseData) {
              populateFormFromExercise(exerciseData);
              const savedSet2 = computeEditSavedSteps(exerciseData);
              setSavedSteps(savedSet2);
              setCompletedSteps(savedSet2);
            }
          } catch (error) {
            // Silent fail — the preloaded row's data is already on screen,
            // so the user isn't blocked. Log for debugging only.
            console.warn('Background refresh failed for exercise', exercise_Id, error);
          }
        }
        return;
      }

      // ── No preloaded copy → loud fetch with the overlay ──
      // This is the fresh-open path (e.g. deep link straight into edit
      // without going through the list). The overlay is warranted here
      // because there's nothing to render underneath it.
      if (exercise_Id) {
        setIsHydratingEdit(true);
        setIsLoading(true);
        try {
          const response = await exerciseApi.getExerciseById(exercise_Id);
          const exerciseData = response?.data?.exercise || response?.data || response;
          if (exerciseData) {
            populateFormFromExercise(exerciseData);
            const savedSet = computeEditSavedSteps(exerciseData);
            setSavedSteps(savedSet);
            setCompletedSteps(savedSet);
          }
        } catch (error) {
          console.error('Failed to load exercise data:', error);
          toast.error('Failed to load exercise data');
        } finally {
          setIsLoading(false);
          setIsHydratingEdit(false);
        }
        return;
      }

      // No source at all — clear the flag anyway so we don't strand the spinner.
      setIsHydratingEdit(false);
    };

    loadExerciseData();
  }, [isEditing, exercise_Id, preloadedExercise]);

  // Sync isSectionBasedDuration state with formData.sectionBasedDuration
  useEffect(() => {
    if (formData.sectionBasedDuration !== undefined) {
      setIsSectionBasedDuration(formData.sectionBasedDuration);
    }
  }, [formData.sectionBasedDuration]);

  const populateFormFromExercise = useCallback((exercise: any) => {
    const info = exercise.exerciseInformation || {};
    const schedule = exercise.availabilityPeriod || {};
    const notifications = exercise.notificationSettings || {};
    const gradeSettings = exercise.gradeSettings || {};
    const additionalOptions = exercise.additionalOptions || {};
    const questionConfig = exercise.questionConfiguration || {};

    // ── Question Source hydration (top-level fields, same as ExerciseSettings) ──
    if (exercise.questionSource && typeof exercise.questionSource === 'string') {
      setQuestionSource(exercise.questionSource as QuestionSource);
    }
    if (Array.isArray(exercise.customSources)) {
      setCustomSources(exercise.customSources.filter(
        (s: any): s is CustomSubSource => s === 'scratch' || s === 'ai' || s === 'thirdParty'));
    }
    if (exercise.customDistribution && typeof exercise.customDistribution === 'object') {
      const d = exercise.customDistribution;
      setCustomDistribution({
        easy: { scratch: d?.easy?.scratch ?? 0, ai: d?.easy?.ai ?? 0, thirdParty: d?.easy?.thirdParty ?? 0 },
        medium: { scratch: d?.medium?.scratch ?? 0, ai: d?.medium?.ai ?? 0, thirdParty: d?.medium?.thirdParty ?? 0 },
        hard: { scratch: d?.hard?.scratch ?? 0, ai: d?.hard?.ai ?? 0, thirdParty: d?.hard?.thirdParty ?? 0 },
      });
    }
    // Section-based per-section distribution — hydrate each entry defensively so
    // a partial payload from an older exercise still yields a valid shape.
    if (exercise.customDistributionBySection && typeof exercise.customDistributionBySection === 'object') {
      const src = exercise.customDistributionBySection as Record<string, any>;
      const hydrated: CustomDistributionBySection = {};
      Object.keys(src).forEach(sid => {
        const dd = src[sid] || {};
        hydrated[sid] = {
          easy:   { scratch: dd?.easy?.scratch   ?? 0, ai: dd?.easy?.ai   ?? 0, thirdParty: dd?.easy?.thirdParty   ?? 0 },
          medium: { scratch: dd?.medium?.scratch ?? 0, ai: dd?.medium?.ai ?? 0, thirdParty: dd?.medium?.thirdParty ?? 0 },
          hard:   { scratch: dd?.hard?.scratch   ?? 0, ai: dd?.hard?.ai   ?? 0, thirdParty: dd?.hard?.thirdParty   ?? 0 },
        };
      });
      setCustomDistributionBySection(hydrated);
    }
    if (typeof exercise.saveToBank === 'boolean') setSaveToBank(exercise.saveToBank);
    // Combined-only MCQ-part source hydration ('' = inherit).
    if (exercise.questionSourceMcq && typeof exercise.questionSourceMcq === 'string') {
      setQuestionSourceMcq(exercise.questionSourceMcq as QuestionSource);
    }
    if (Array.isArray(exercise.customSourcesMcq)) {
      setCustomSourcesMcq(exercise.customSourcesMcq.filter(
        (s: any): s is CustomSubSource => s === 'scratch' || s === 'ai'));
    }
    if (exercise.customDistributionMcq && typeof exercise.customDistributionMcq === 'object') {
      setCustomDistributionMcq({
        scratch: exercise.customDistributionMcq.scratch ?? 0,
        ai: exercise.customDistributionMcq.ai ?? 0,
        thirdParty: exercise.customDistributionMcq.thirdParty ?? 0,
      });
    }

    // Support both naming conventions the backend may use
    const mcqConfig =
      questionConfig.mcqConfig ||
      questionConfig.mcqQuestionConfiguration ||
      {};
    const programmingConfig =
      questionConfig.programmingConfig ||
      questionConfig.programmingQuestionConfiguration ||
      {};
    const othersConfig =
      questionConfig.othersQuestionConfiguration ||
      questionConfig.othersConfig ||
      {};

    const sectionConfigsData = exercise.sectionConfigs || {};
    // A deliberate "off" save — isSectionBased:false together with a real (non
    // 'SectionBased') exerciseType — wins over the leftover-data inference below.
    // Otherwise stale sections/configs that weren't fully cleared on the backend
    // would keep re-enabling the toggle on edit even after the user turned it off.
    const explicitlyOff =
      (exercise.isSectionBased === false || info.isSectionBased === false) &&
      exercise.exerciseType !== 'SectionBased' &&
      info.exerciseType !== 'SectionBased';
    // Detect section-based from EVERY signal the saved exercise can carry — the
    // flag alone is unreliable (older data / trimmed list payloads), so also
    // treat exerciseType === 'SectionBased' and the presence of section
    // configs/sections as section-based. Without this the toggle loaded false
    // on edit even for a clearly section-based test.
    const isSectionBasedVal = !explicitlyOff && (
      exercise.isSectionBased === true ||
      info.isSectionBased === true ||
      exercise.exerciseType === 'SectionBased' ||
      info.exerciseType === 'SectionBased' ||
      (sectionConfigsData && Object.keys(sectionConfigsData).length > 0) ||
      (Array.isArray(exercise.sections) && exercise.sections.length > 0));

    // Sections list for the Exercise Details list + validation. Prefer the
    // stored `sections` array; if it's missing but section configs exist,
    // derive the list from the configs so the step isn't empty.
    let sectionsData: any[] = Array.isArray(exercise.sections) ? exercise.sections : [];
    if (sectionsData.length === 0 && Object.keys(sectionConfigsData).length > 0) {
      sectionsData = Object.entries(sectionConfigsData).map(([key, cfg]: [string, any]) => ({
        id: cfg?.id || key,
        name: cfg?.name || key,
        order: cfg?.sectionNumber ?? cfg?.order ?? 0,
        totalMarks: cfg?.totalMarks ?? 0,
        totalDuration: cfg?.totalDuration ?? cfg?.duration ?? 0,
      })).sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    // 'SectionBased' is a storage value, not a valid form exerciseType —
    // fall back to root exercise.exerciseType or 'MCQ' so type buttons render properly
    let exerciseTypeVal: string =
      info.exerciseType || exercise.exerciseType || 'MCQ';
    if (exerciseTypeVal === 'SectionBased') exerciseTypeVal = 'MCQ';

    const parseDate = (dateStr: string) => {
      if (!dateStr) return { day: 0, month: 0, year: 0, hour: 0, minute: 0 };
      const date = new Date(dateStr);
      return {
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        hour: date.getHours(),
        minute: date.getMinutes(),
      };
    };

    setFormData(prev => ({
      ...prev,

      // ── Exercise Details ───────────────────────────────────────────
      exerciseType: exerciseTypeVal as FormDataType['exerciseType'],
      testType: info.testType || 'mock',
      exerciseId: info.exerciseId || prev.exerciseId,
      exerciseName: info.exerciseName || '',
      description: info.description || '',
      exerciseLevel: info.exerciseLevel || 'intermediate',
      totalDuration: info.totalDuration || 60,
      totalMarks: info.totalMarks || 0,
      totalMarksMCQ: info.totalMarksMCQ || 0,
      totalMarksProgramming: info.totalMarksProgramming || 0,
      selectedModule: info.selectedModule || '',
      selectedLanguages: info.selectedLanguages || [],
      isSectionBased: isSectionBasedVal,
      sectionBasedDuration: info.sectionBasedDuration || false,
      sections: sectionsData,
      sectionConfigs: exercise.sectionConfigs || {},

      // ── MCQ question config ────────────────────────────────────────
      // The backend stores MCQ under DIFFERENT field names than the form uses:
      //   generalQuestionCount        → totalMcqQuestions
      //   scoreSettings.scoreType     → scoringType (flattened)
      //   scoreSettings.equalDistribution → marksPerQuestion
      //   scoreSettings.totalMarks    → mcqTotalMarks
      // Read both shapes so an edit restores the saved Total Questions / marks
      // instead of showing 0 (the bug where saved MCQ count came back empty).
      mcqConfig: {
        ...prev.mcqConfig,
        questionConfigType: mcqConfig.questionConfigType || 'general',
        generalQuestionCount: mcqConfig.generalQuestionCount ?? mcqConfig.totalMcqQuestions ?? 0,
        sectionConfig: mcqConfig.sectionConfig || prev.mcqConfig.sectionConfig,
        scoreSettings: {
          ...prev.mcqConfig.scoreSettings,
          ...(mcqConfig.scoreSettings || {}),
          scoreType:
            mcqConfig.scoreSettings?.scoreType || mcqConfig.scoringType ||
            prev.mcqConfig.scoreSettings.scoreType || 'equalDistribution',
          equalDistribution:
            mcqConfig.scoreSettings?.equalDistribution ?? mcqConfig.marksPerQuestion ??
            prev.mcqConfig.scoreSettings.equalDistribution ?? 0,
          totalMarks:
            mcqConfig.scoreSettings?.totalMarks ?? mcqConfig.mcqTotalMarks ??
            prev.mcqConfig.scoreSettings.totalMarks ?? 0,
        },
        attemptLimitEnabled: mcqConfig.attemptLimitEnabled || false,
        submissionAttempts: mcqConfig.submissionAttempts || 1,
      },

      // ── Programming question config ────────────────────────────────
      // Programming keeps generalQuestionCount, but the backend renames the
      // score type (equalDistribution→evenMarks, questionSpecific→separateMarks)
      // and stores marks-per-question as evenMarks/generalMarksPerQuestion. Map
      // them back so the general "Marks Per Question" auto-calc isn't lost on edit.
      programmingConfig: {
        ...prev.programmingConfig,
        questionConfigType: programmingConfig.questionConfigType || 'general',
        generalQuestionCount: programmingConfig.generalQuestionCount || 0,
        selectionLevelCounts:
          programmingConfig.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 },
        levelBasedCounts:
          programmingConfig.levelBasedCounts || { easy: 0, medium: 0, hard: 0 },
        scoreSettings: programmingConfig.scoreSettings ? {
          ...prev.programmingConfig.scoreSettings,
          ...programmingConfig.scoreSettings,
          scoreType:
            programmingConfig.scoreSettings.scoreType === 'evenMarks' ? 'equalDistribution'
            : programmingConfig.scoreSettings.scoreType === 'separateMarks' ? 'questionSpecific'
            : programmingConfig.scoreSettings.scoreType === 'levelBasedMarks' ? 'equalDistribution'
            : (programmingConfig.scoreSettings.scoreType || prev.programmingConfig.scoreSettings.scoreType),
          equalDistribution:
            programmingConfig.scoreSettings.equalDistribution
            ?? programmingConfig.scoreSettings.evenMarks
            ?? programmingConfig.generalMarksPerQuestion
            ?? prev.programmingConfig.scoreSettings.equalDistribution ?? 0,
        } : prev.programmingConfig.scoreSettings,
        questionFlow: programmingConfig.questionFlow || 'freeFlow',
        attemptLimitEnabled: programmingConfig.attemptLimitEnabled || false,
        submissionAttempts: programmingConfig.submissionAttempts || 1,
      },

      // ── Others question config ─────────────────────────────────────
      othersConfig: {
        ...prev.othersConfig,
        questionConfigType: othersConfig.questionConfigType || 'general',
        generalQuestionCount: othersConfig.generalQuestionCount || 0,
        selectionLevelCounts:
          othersConfig.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 },
        levelBasedCounts:
          othersConfig.levelBasedCounts || { easy: 0, medium: 0, hard: 0 },
        scoreSettings:
          othersConfig.scoreSettings || prev.othersConfig.scoreSettings,
        questionFlow: othersConfig.questionFlow || 'freeFlow',
        attemptLimitEnabled: othersConfig.attemptLimitEnabled || false,
        submissionAttempts: othersConfig.submissionAttempts || 1,
      },

      // ── Schedule ───────────────────────────────────────────────────
      schedule: {
        ...prev.schedule,
        allowSubmissions:
          schedule.allowSubmissions !== undefined ? schedule.allowSubmissions : true,
        startDate: parseDate(schedule.startDate),
        endDate: parseDate(schedule.endDate),
        cutOffEnabled: schedule.cutOffEnabled || false,
        cutOffDate: parseDate(schedule.cutOffDate),
        gracePeriodEnabled: schedule.gracePeriodEnabled || false,
        gracePeriodDate: parseDate(schedule.gracePeriodDate),
        remindGradeByEnabled: schedule.remindGradeByEnabled || false,
        remindGradeBy: parseDate(schedule.remindGradeBy),
        requiresAdminApproval: schedule.requiresAdminApproval ?? false,
        approvalScope: schedule.approvalScope || 'settings',
      },

      // ── Security Settings ──────────────────────────────────────────
      // Merge defaults so older assessments (saved before newer fields like
      // faceMonitoringDetection existed) still have every field defined —
      // otherwise NumberInputs flip uncontrolled→controlled.
      securitySettings: { ...defaultSecuritySettings, ...(exercise.securitySettings || {}) },

      // ── Evaluation Method ──────────────────────────────────────────
      // Absent on assessments created before the feature — normalize() maps
      // those to test-case-only at 100%, matching their existing behaviour.
      evaluationMethod: normalizeEvaluationMethod(exercise.evaluationMethod),

      // ── Notifications ──────────────────────────────────────────────
      notifyUsers: notifications.notifyUsers || false,
      notifyGmail: notifications.notifyGmail || false,
      notifyWhatsApp: notifications.notifyWhatsApp || false,
      gradeSheet:
        notifications.gradeSheet !== undefined ? notifications.gradeSheet : true,
      notifications: {
        notifyGradersSubmissions: notifications.notifyGradersSubmissions || false,
        notifyGradersLateSubmissions:
          notifications.notifyGradersLateSubmissions || false,
        notifyStudent:
          notifications.notifyStudent !== undefined
            ? notifications.notifyStudent
            : true,
      },

      // ── Grades / Grade Settings ─────────────────────────────────────
      grades: {
        ...prev.grades,
        // Hydrate master toggle. Older saved exercises won't have this field
        // so default to true to preserve their existing behaviour.
        enablePassMark: gradeSettings.enablePassMark !== false,
        mcqGrade: gradeSettings.mcqGrade ?? null,
        mcqGradeToPass: gradeSettings.mcqGradeToPass ?? null,
        combinedGrade: gradeSettings.combinedGrade ?? null,
        combinedGradeToPass: gradeSettings.combinedGradeToPass ?? null,
        separateMarks: gradeSettings.separateMarks || false,
        // Hydrate per-section pass marks if the saved exercise has them.
        sectionPassMarks: gradeSettings.sectionPassMarks || prev.grades.sectionPassMarks || {},
        // Hydrate the grade-level "Section Based" split (toggle + parts) so
        // editing shows the parts/pass-marks the user entered.
        sectionBased: gradeSettings.sectionBased === true,
        sections: Array.isArray(gradeSettings.sections) ? gradeSettings.sections : (prev.grades.sections || []),
        // Hydrate grade bands so editing shows the saved ranges (else the
        // component falls back to the recommended defaults).
        gradeBands: Array.isArray(gradeSettings.gradeBands) ? gradeSettings.gradeBands : ((prev.grades as any).gradeBands || undefined),
      },

      // ── Additional Options ─────────────────────────────────────────
      additionalOptions: {
        anonymousSubmissions: additionalOptions.anonymousSubmissions || false,
        hideGraderIdentity: additionalOptions.hideGraderIdentity || false,
      },

      // ── Select Assessment Content (last step) ──────────────────────
      selectedTopics: Array.isArray(exercise.selectedTopics) ? exercise.selectedTopics : [],
      instructions: typeof exercise.instructions === 'string' ? exercise.instructions : '',
    }));

    // Always sync isSectionBasedDuration regardless of whether sections are present
    if (isSectionBasedVal) {
      setIsSectionBased(true);
      setIsSectionBasedDuration(info.sectionBasedDuration || false);
      if (sectionsData.length > 0) {
        setExerciseSections(sectionsData);
      }
    }
  }, []);

  const toggleLanguage = useCallback((lang: string) => {
    setFormData(prev => ({ ...prev, selectedLanguages: prev.selectedLanguages.includes(lang) ? prev.selectedLanguages.filter(l => l !== lang) : [...prev.selectedLanguages, lang] }));
    setValidationErrors(prev => { const e = { ...prev }; delete e.selectedLanguages; return e; });
  }, []);

  const markTouched = useCallback((f: string) => setTouchedFields(prev => new Set(prev).add(f)), []);
  const markAllTouched = useCallback((fields: string[]) => setTouchedFields(prev => { const n = new Set(prev); fields.forEach(f => n.add(f)); return n; }), []);

  const handleSelectExerciseType = useCallback((type: "MCQ" | "Programming" | "Combined" | "Other") => {
    // Leaving Combined discards the MCQ-part source trio (payload also nulls
    // it for non-Combined types) so stale state can't outlive the switch.
    if (type !== 'Combined') {
      setQuestionSourceMcq('');
      setCustomSourcesMcq([]);
      setCustomDistributionMcq({ scratch: 0, ai: 0, thirdParty: 0 });
    }
    setFormData(prev => ({
      ...prev,
      exerciseType: type,
      selectedModule: '',
      selectedLanguages: [],
    }));
  }, []);

  const getSteps = useCallback((): Step[] => {
    const steps: Step[] = [];
    let next = 1;
    steps.push({ id: next, title: 'Exercise Details', subtitle: 'Info & Time', completed: currentStep > next, active: currentStep === next, icon: <FileText size={12} /> }); 
    next++;
    
    if (isSectionBased) {
      steps.push({ id: next, title: 'Section Details', subtitle: 'Configure Sections', completed: currentStep > next, active: currentStep === next, icon: <Layers size={12} /> }); 
      next++;
    }
     if (!isSectionBased) {
    steps.push({ id: next, title: 'Question Configuration', subtitle: 'Configure Questions', completed: currentStep > next, active: currentStep === next, icon: <FileText size={12} /> });
    next++;
  }
    steps.push({ id: next, title: 'Question Source', subtitle: 'Where questions come from', completed: currentStep > next, active: currentStep === next, icon: <FolderOpen size={12} /> });
    next++;
    steps.push({ id: next, title: 'Schedule', subtitle: 'Dates & Times', completed: currentStep > next, active: currentStep === next, icon: <FileText size={12} /> });
    next++;
    steps.push({ id: next, title: 'Security Settings', subtitle: 'Test Security', completed: currentStep > next, active: currentStep === next, icon: <Shield size={12} /> }); 
    next++;
    steps.push({ id: next, title: 'Notifications', subtitle: 'Alerts & Notify', completed: currentStep > next, active: currentStep === next, icon: <FileText size={12} /> }); 
    next++;
    steps.push({ id: next, title: 'Grade Settings', subtitle: 'Marks & Grading', completed: currentStep > next, active: currentStep === next, icon: <FileText size={12} /> });
    next++;
    steps.push({ id: next, title: 'Select Assessment Content', subtitle: 'Topics & Instructions', completed: currentStep > next, active: currentStep === next, icon: <ClipboardList size={12} /> });

    return steps;
  }, [currentStep, isSectionBased]);

  const steps = useMemo(() => getSteps(), [getSteps]);

  const validateExerciseDetails = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    if (!formData.exerciseName.trim()) e.exerciseName = 'Exercise name is required';
    if (formData.totalDuration <= 0) e.totalDuration = 'Duration must be greater than 0';
    if (formData.totalMarks <= 0 && !isSectionBased) e.totalMarks = 'Total marks must be greater than 0';
    if (!isSectionBased && !formData.exerciseType) e.exerciseType = 'Exercise type is required';
    return e;
  }, [formData.exerciseName, formData.totalDuration, formData.totalMarks, formData.exerciseType, isSectionBased]);

  const validateGradeSettings = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    const g = formData.grades;

    // Master toggle off → no pass-mark fields are shown, so nothing to validate.
    if (g.enablePassMark === false) return e;

    // Mark to Pass is optional everywhere — saving with no value is allowed.
    // Only validate the ceiling when the user actually entered a value.

    // ── Section-based: one overall Mark to Pass (optional). If provided,
    // must be strictly less than the aggregated total (sum of every part's
    // totalMarks). Per-section pass marks (sectionPassMarks) are also
    // optional and validated against their own part's total.
    if (isSectionBased) {
      const aggregatedTotal = exerciseSections.reduce(
        (sum, s) => sum + Number(s.totalMarks || 0),
        0
      );
      const v = g.combinedGradeToPass;
      if (v != null && !Number.isNaN(v) && v > 0 && aggregatedTotal > 0 && v >= aggregatedTotal) {
        e.combinedGradeToPass = `Mark to Pass must be less than Total Mark (${aggregatedTotal}) — max ${aggregatedTotal - 1}`;
      }
      return e;
    }

    // ── Non-section path: pass mark is optional; only enforce ceiling.
    const autoGrade = formData.totalMarks;
    if (g.mcqGradeToPass != null && g.mcqGradeToPass > 0 && autoGrade > 0 && g.mcqGradeToPass > autoGrade) {
      e.mcqGradeToPass = `Cannot exceed Mark (${autoGrade})`;
    }
    return e;
  }, [formData.grades, formData.totalMarks, isSectionBased, exerciseSections]);

  const validateSections = useCallback((): ValidationErrors => {
    const e: ValidationErrors = {};
    if (isSectionBased) {
      if (exerciseSections.length === 0) {
        e.sections = 'At least one section is required';
      }
      exerciseSections.forEach((section, idx) => {
        if (!section.name.trim()) {
          e[`section_${section.id}_name`] = `Section ${idx + 1} name is required`;
        }
      });
    }
    return e;
  }, [isSectionBased, exerciseSections]);

  const isStepCompleted = useCallback((stepId: number): boolean => {
    const step = steps.find(s => s.id === stepId);
    if (!step) return false;
    switch (step.title) {
      case 'Exercise Details': {
        const base = !!(formData.exerciseName?.trim() && formData.totalDuration > 0);
        if (isSectionBased) {
          return base && exerciseSections.length > 0 && exerciseSections.every(s => s.name.trim());
        }
        return base && formData.totalMarks > 0 && !!formData.exerciseType;
      }
      case 'Section Details':
        return exerciseSections.length > 0 && exerciseSections.every(s => s.name.trim());
      case 'Question Configuration': {
        const et = formData.exerciseType;
        if (et === 'MCQ') return formData.mcqConfig.generalQuestionCount > 0;
        if (et === 'Programming') return formData.programmingConfig.generalQuestionCount > 0 ||
          formData.programmingConfig.levelBasedCounts.easy > 0 ||
          formData.programmingConfig.levelBasedCounts.medium > 0 ||
          formData.programmingConfig.selectionLevelCounts.easy > 0;
        if (et === 'Combined') return formData.mcqConfig.generalQuestionCount > 0 &&
          (formData.programmingConfig.generalQuestionCount > 0 ||
          formData.programmingConfig.levelBasedCounts.easy > 0);
        if (et === 'Other') return formData.othersConfig.generalQuestionCount > 0 ||
          formData.othersConfig.levelBasedCounts.easy > 0;
        return false;
      }
      case 'Question Source':
        // Same gate as ExerciseSettings: a source is required, and Custom
        // needs at least two sub-sources ticked (per part for Combined).
        return !!questionSource && (questionSource !== 'custom' || customSources.length >= 2) &&
          (formData.exerciseType !== 'Combined' || questionSourceMcq !== 'custom' || customSourcesMcq.length >= 2);
      case 'Schedule': {
        const sched = formData.schedule as any;
        return !!(sched.startDate?.year > 0 && sched.endDate?.year > 0);
      }
      case 'Security Settings': return true;
      case 'Grade Settings': return Object.keys(validateGradeSettings()).length === 0;
      default: return true;
    }
  }, [steps, formData, validateGradeSettings, isSectionBased, exerciseSections, questionSource, customSources, questionSourceMcq, customSourcesMcq]);

  const handleNext = useCallback(() => {
    const currentTitle = steps.find(s => s.id === currentStep)?.title;
    // Mirror ExerciseSettings: never advance past Question Source with a
    // mis-configured Custom mix (that state must stay unreachable).
    if (currentTitle === 'Question Source' && questionSource === 'custom' && customSources.length < 2) {
      toast('Custom needs at least two sources ticked.', { icon: 'ℹ️', position: 'top-right', duration: 2800, id: 'need-2-sources' });
      return;
    }
    if (currentTitle === 'Question Source' && formData.exerciseType === 'Combined' && questionSourceMcq === 'custom' && customSourcesMcq.length < 2) {
      toast('MCQ Custom needs both sources ticked.', { icon: 'ℹ️', position: 'top-right', duration: 2800, id: 'need-2-mcq-sources' });
      return;
    }
    if (currentTitle && isStepCompleted(currentStep)) setCompletedSteps(prev => new Set(prev).add(currentTitle));
    if (currentStep < steps[steps.length - 1]?.id) {
      const ci = steps.findIndex(s => s.id === currentStep);
      if (ci < steps.length - 1) setCurrentStep(steps[ci + 1].id);
    }
  }, [currentStep, steps, isStepCompleted, questionSource, customSources, questionSourceMcq, customSourcesMcq, formData.exerciseType]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      const ci = steps.findIndex(s => s.id === currentStep);
      if (ci > 0) setCurrentStep(steps[ci - 1].id);
    }
  }, [currentStep, steps]);

// Returns the payload fields owned by a single step title.
const fieldsForStep = (stepTitle: string, full: any): Record<string, any> => {
  switch (stepTitle) {
    case 'Exercise Details':
      return {
        exerciseInformation: full.exerciseInformation,
        sections: full.sections,
        sectionConfigs: full.sectionConfigs,
        configurationType: full.configurationType,
      };
    case 'Section Details':
      return {
        sections: full.sections,
        sectionConfigs: full.sectionConfigs,
      };
    case 'Question Configuration':
      // The Evaluation Method block renders inside this step, so its config has
      // to ride along — a step-scoped save omitting it would leave the
      // teacher's Test Case / AI choice unsaved.
      return {
        questionConfiguration: full.questionConfiguration,
        evaluationMethod: full.evaluationMethod,
      };
    case 'Question Source': {
      // Top-level fields, deliberately owned by their own step (mirrors
      // ExerciseSettings) so re-saving Question Configuration can't null them.
      // buildFullPayload omits the source trio while Custom is mis-configured —
      // only forward them when actually present so the DB state stays untouched.
      const out: Record<string, any> = { saveToBank: full.saveToBank };
      if ('questionSource' in full) {
        out.questionSource = full.questionSource;
        out.customSources = full.customSources;
        out.customDistribution = full.customDistribution;
        // Section-based Custom mix — must ride along on the step's own save,
        // otherwise the trainer's per-section matrix edits are silently
        // dropped on Save & Next for existing exercises. The full payload's
        // conditional inclusion contract (section-based + custom only) is
        // preserved because buildFullPayload guards the key's presence.
        if ('customDistributionBySection' in full) {
          out.customDistributionBySection = full.customDistributionBySection;
        }
      }
      if ('questionSourceMcq' in full) {
        out.questionSourceMcq = full.questionSourceMcq;
        out.customSourcesMcq = full.customSourcesMcq;
        out.customDistributionMcq = full.customDistributionMcq;
      }
      return out;
    }
    case 'Schedule':
      return { availabilityPeriod: full.availabilityPeriod };
    case 'Security Settings':
      return { securitySettings: full.securitySettings };
    case 'Notifications':
      return { notificationSettings: full.notificationSettings };
    case 'Grade Settings':
      return { gradeSettings: full.gradeSettings };
    case 'Select Assessment Content':
      return { selectedTopics: full.selectedTopics, instructions: full.instructions };
    default:
      return {};
  }
};

// Build a payload that includes all steps from Step 1 up to (and including)
// currentStepTitle. Steps after the current one are intentionally omitted so
// they are never overwritten in the DB until the user explicitly saves them.
// The backend starts with the stored exercise and only overwrites fields that
// are present in req.body, so absent steps are preserved unchanged.
const extractStepsUpToPayload = (currentStepTitle: string | undefined, orderedStepTitles: string[], full: any): Record<string, any> => {
  const currentIndex = currentStepTitle ? orderedStepTitles.indexOf(currentStepTitle) : -1;
  const titlesToInclude = currentIndex >= 0 ? orderedStepTitles.slice(0, currentIndex + 1) : [];

  const merged: Record<string, any> = {
    tabType: full.tabType,
    subcategory: full.subcategory,
    stepsSaved: full.stepsSaved,
    exerciseType: full.exerciseType,
    isSectionBased: full.isSectionBased,
  };

  for (const title of titlesToInclude) {
    Object.assign(merged, fieldsForStep(title, full));
  }

  return merged;
};

const buildFullPayload = useCallback((overrideSectionConfigs?: Record<string, any>) => {
  // Serialize the picker's local wall-clock fields as an unambiguous UTC ISO
  // instant. Previously these went out as a naive "YYYY-MM-DDTHH:mm" string with
  // no timezone, so the SERVER's timezone reinterpreted it — which shifted the
  // start/end dates every time the exercise was re-saved (e.g. saving Grade
  // Settings). toISOString() pins the exact instant so it round-trips losslessly.
  const dvToIso = (d: any) =>
    (d && d.day > 0 && d.month > 0 && d.year > 0)
      ? new Date(d.year, d.month - 1, d.day, d.hour || 0, d.minute || 0).toISOString()
      : null;
  const sd = formData.schedule.startDate;
  const startDT = dvToIso(sd);
  const ed = (formData.schedule as any).endDate;
  const endDT = dvToIso(ed);

  // Use override if provided, otherwise use formData.sectionConfigs
  const sectionConfigsToUse = overrideSectionConfigs || formData.sectionConfigs;

  const payload: any = {
    tabType,
    subcategory,
    // Persist which steps the user has explicitly saved (by title). Save paths
    // override this with the freshly-merged set; included here so a full save
    // (Finish) and any direct buildFullPayload call always carry current progress.
    stepsSaved: [...savedSteps],
    exerciseType: isSectionBased ? 'SectionBased' : formData.exerciseType,
    isSectionBased,
    // When section-based is off, send empty sections/configs so the exercise is not
    // re-detected as section-based on reload (detection treats non-empty configs as section-based).
    sections: isSectionBased ? exerciseSections : [],
    sectionConfigs: isSectionBased ? sectionConfigsToUse : {},  // Use the override when on
    configurationType: { mcqMode: formData.exerciseType === 'MCQ' },

    // Question Source — same top-level contract as ExerciseSettings so the
    // Manage Test / AddQuestionForm source gates and per-source quotas work.
    // OMITTED (not nulled) while Custom is mis-configured (<2 sub-sources):
    // sidebar navigation can bypass the step gates, and any later-step save
    // re-sends these fields — omission keeps the stored values on update and
    // defaults to null on create, so the invalid state is never persisted.
    ...(questionSource !== 'custom' || customSources.length >= 2
      ? {
          questionSource: questionSource || null,
          customDistribution: questionSource === 'custom' ? customDistribution : null,
          customSources: questionSource === 'custom' ? customSources : [],
          // Section-based per-section allocation. Non-section flow sends {}.
          // Downstream (QuestionsTest routing) reads this to gate Add Question
          // per section+difficulty+source.
          customDistributionBySection: (isSectionBased && questionSource === 'custom')
            ? customDistributionBySection
            : {},
        }
      : {}),
    // Combined-only MCQ-part source — same omit-while-invalid rule.
    ...(formData.exerciseType === 'Combined' && !isSectionBased
      ? (questionSourceMcq !== 'custom' || customSourcesMcq.length >= 2
          ? {
              questionSourceMcq: questionSourceMcq || null,
              customSourcesMcq: questionSourceMcq === 'custom' ? customSourcesMcq : [],
              customDistributionMcq: questionSourceMcq === 'custom' ? customDistributionMcq : null,
            }
          : {})
      : { questionSourceMcq: null, customSourcesMcq: [], customDistributionMcq: null }),
    saveToBank,

    // Final step — selected course topics + assessment instructions (persisted so
    // the student attend flow can scope and brief the test).
    selectedTopics: formData.selectedTopics || [],
    instructions: formData.instructions || '',
    
    // ... rest of the payload remains the same
    exerciseInformation: { 
      exerciseId: formData.exerciseId, 
      exerciseName: formData.exerciseName, 
      testType: formData.testType || 'mock',
      description: formData.description || '', 
      exerciseLevel: formData.exerciseLevel || 'beginner', 
      totalDuration: formData.totalDuration || 60, 
      totalMarks: formData.totalMarks,
      totalMarksMCQ: formData.totalMarksMCQ || 0,
      totalMarksProgramming: formData.totalMarksProgramming || 0,
      exerciseType: isSectionBased ? 'SectionBased' : formData.exerciseType,
      selectedModule: formData.selectedModule,
      selectedLanguages: formData.selectedLanguages,
      isSectionBased,
      sectionBasedDuration: formData.sectionBasedDuration || false,
    },
    
    securitySettings: formData.securitySettings,

    // Evaluation method (test case or AI). Always sent so the stored config
    // stays coherent across exercise-type switches.
    evaluationMethod: formData.evaluationMethod,

    availabilityPeriod: {
      startDate: startDT,
      endDate: endDT,
      cutOffEnabled: !!(formData.schedule as any).cutOffEnabled,
      // Was sent as a raw {day,month,…} object the server couldn't parse — now a
      // proper ISO instant like the others.
      cutOffDate: (formData.schedule as any).cutOffEnabled ? dvToIso((formData.schedule as any).cutOffDate) : null,
      gracePeriodEnabled: formData.schedule.gracePeriodEnabled,
      gracePeriodAllowed: formData.schedule.gracePeriodEnabled,
      gracePeriodDate: formData.schedule.gracePeriodEnabled ? dvToIso((formData.schedule as any).gracePeriodDate) : null,
      extendedDays: 0,
      requiresAdminApproval: !!(formData.schedule as any).requiresAdminApproval,
      approvalScope: (formData.schedule as any).approvalScope === 'settings_and_questions'
        ? 'settings_and_questions'
        : 'settings',
    },
    notificationSettings: { 
      notifyUsers: formData.notifyUsers || false, 
      notifyGmail: formData.notifyGmail || false, 
      notifyWhatsApp: formData.notifyWhatsApp || false, 
      gradeSheet: formData.gradeSheet !== undefined ? formData.gradeSheet : true, 
      notifyGradersSubmissions: formData.notifications.notifyGradersSubmissions, 
      notifyGradersLateSubmissions: formData.notifications.notifyGradersLateSubmissions, 
      notifyStudent: formData.notifications.notifyStudent 
    },
    gradeSettings: {
      // Master toggle. When false, downstream consumers should treat the
      // exercise as having no pass/fail threshold and ignore the mark fields.
      enablePassMark: formData.grades.enablePassMark !== false,
      mcqGrade: formData.grades.mcqGrade || null,
      mcqGradeToPass: formData.grades.mcqGradeToPass || null,
      // The section-based AND combined "Mark to Pass" field binds to
      // combinedGradeToPass in GradeSettingsStep — it was never sent before, so
      // the overall pass mark was lost on save (showing "—" downstream).
      combinedGradeToPass: formData.grades.combinedGradeToPass || null,
      programmingGradeToPass: (formData.grades as any).programmingGradeToPass || null,
      // Grade-level "Section Based" split (Part A / Part B … each with its own
      // total + pass mark) — toggle + parts. Persisted so editing restores them.
      sectionBased: !!(formData.grades as any).sectionBased,
      sections: Array.isArray((formData.grades as any).sections) ? (formData.grades as any).sections : [],
      // Grade bands (labelled % ranges) — persisted so editing restores them.
      // Send undefined (not []) when empty so saved exercises keep falling back
      // to the recommended defaults instead of persisting an empty scale.
      gradeBands: Array.isArray((formData.grades as any).gradeBands) && (formData.grades as any).gradeBands.length
        ? (formData.grades as any).gradeBands
        : undefined,
      // Persist per-section pass marks when the exercise is section-based.
      // Shape: { [sectionId]: number } — keyed by SectionItem.id so the
      // backend can map back to the section that owns the pass mark.
      ...(isSectionBased ? { sectionPassMarks: formData.grades.sectionPassMarks || {} } : {}),
    },
    additionalOptions: { 
      anonymousSubmissions: formData.additionalOptions.anonymousSubmissions, 
      hideGraderIdentity: formData.additionalOptions.hideGraderIdentity 
    },
    questionConfiguration: {
      mcqConfig: {
        questionConfigType: formData.mcqConfig.questionConfigType,
        generalQuestionCount: formData.mcqConfig.generalQuestionCount,
        scoreSettings: formData.mcqConfig.scoreSettings,
        attemptLimitEnabled: formData.mcqConfig.attemptLimitEnabled,
        submissionAttempts: formData.mcqConfig.submissionAttempts
      }
    },
    questions: [],
  };
  
    if (!isSectionBased) {
      if (formData.exerciseType === 'Programming' || formData.exerciseType === 'Combined') {
        payload.questionConfiguration.programmingConfig = {
          questionConfigType: formData.programmingConfig.questionConfigType,
          generalQuestionCount: formData.programmingConfig.generalQuestionCount,
          selectionLevelCounts: formData.programmingConfig.selectionLevelCounts,
          levelBasedCounts: formData.programmingConfig.levelBasedCounts,
          scoreSettings: formData.programmingConfig.scoreSettings,
          questionFlow: formData.programmingConfig.questionFlow,
          attemptLimitEnabled: formData.programmingConfig.attemptLimitEnabled,
          submissionAttempts: formData.programmingConfig.submissionAttempts,
        };
      }
      
      if (formData.exerciseType === 'Other') {
        payload.questionConfiguration.othersQuestionConfiguration = {
          questionConfigType: formData.othersConfig.questionConfigType,
          generalQuestionCount: formData.othersConfig.generalQuestionCount,
          selectionLevelCounts: formData.othersConfig.selectionLevelCounts,
          levelBasedCounts: formData.othersConfig.levelBasedCounts,
          scoreSettings: formData.othersConfig.scoreSettings,
          questionFlow: formData.othersConfig.questionFlow,
          attemptLimitEnabled: formData.othersConfig.attemptLimitEnabled,
          submissionAttempts: formData.othersConfig.submissionAttempts,
        };
      }
    }
    
    // 🔒 TEMP DIAGNOSTIC — what securitySettings is actually being sent on save.
    console.log('🔒 SAVE securitySettings →', JSON.stringify(payload.securitySettings));
    return payload;
}, [formData, tabType, subcategory, isSectionBased, exerciseSections, savedSteps, questionSource, customDistribution, customSources, saveToBank, questionSourceMcq, customSourcesMcq, customDistributionMcq]);
  const performSave = useCallback(async (afterSave?: () => void) => {
    if (isLocked) return;

    // The final step now has its own plain "Save" button (alongside "Finish"),
    // so it persists like any other step instead of nudging the user.

    setIsSavingStep(true);
    try {
      // Merge the step being saved (by title) into the saved set and persist it
      // so the sidebar shows this step — and only steps actually saved — as
      // Completed on the next edit. Compute the merge here so the payload carries
      // the up-to-date set (state updates are async).
      const currentTitle = steps.find(s => s.id === currentStep)?.title;
      const mergedSaved = new Set(savedSteps);
      if (currentTitle) mergedSaved.add(currentTitle);

      const currentId = localExerciseId || (isEditing ? exercise_Id : null);
      if (!currentId && !formData.exerciseName?.trim()) {
        toast('Enter an exercise name to save', { position: 'top-right', duration: 2500, icon: 'ℹ️' });
        setIsSavingStep(false);
        return;
      }

      const fullPayload = buildFullPayload();
      fullPayload.stepsSaved = [...mergedSaved];

      // Option B: for existing exercises send all steps from Step 1 up to the
      // current step. Steps after the current one are omitted so they are never
      // overwritten in the DB until the user explicitly saves them.
      // For new exercises (first create) we still send the full payload so the
      // backend has enough data to build the complete document.
      const orderedTitles = steps.map(s => s.title);
      const payload = currentId ? extractStepsUpToPayload(currentTitle, orderedTitles, fullPayload) : fullPayload;

      let response: any;
      if (currentId) {
        response = await exerciseApi.updateYouDoExercise(getEntityType(nodeType), nodeId, currentId, payload);
      } else {
        response = await exerciseApi.youDoAddExercise(getEntityType(nodeType), nodeId, payload);
        const newId = response?.data?.exercise?._id || response?.data?._id || response?._id;
        if (newId) setLocalExerciseId(newId);
      }
      setSavedSteps(mergedSaved);
      if (currentTitle) setCompletedSteps(prev => new Set(prev).add(currentTitle));
      afterSave?.();
    } catch (err: any) {
      toast.error(`Save failed: ${err?.response?.data?.message || err?.message || 'Failed to save'}`, { position: 'top-right', duration: 4000 });
    } finally { setIsSavingStep(false); }
  }, [isLocked, buildFullPayload, localExerciseId, isEditing, exercise_Id, formData.exerciseName, getEntityType, nodeType, nodeId, currentStep, steps, savedSteps]);

const handleSave = useCallback(async () => {
  const currentTitle = steps.find(s => s.id === currentStep)?.title;

  // The final step persists via this plain Save too (so the user can Save, go
  // back to review earlier steps, then click Finish). Finish = save + close.

  if (currentTitle === 'Grade Settings') {
    // Grade Settings is no longer the last step, so a plain Save must persist.
    // Validate the pass-mark ceiling first so we never store an invalid value.
    const gradeErrors = validateGradeSettings();
    if (Object.keys(gradeErrors).length > 0) {
      setValidationErrors(prev => ({ ...prev, ...gradeErrors }));
      const msg = gradeErrors.combinedGradeToPass || gradeErrors.mcqGradeToPass;
      if (gradeErrors.combinedGradeToPass) markTouched('combinedGradeToPass');
      if (gradeErrors.mcqGradeToPass) markTouched('mcqGradeToPass');
      if (msg) toast.error(String(msg), { position: 'top-right', duration: 4000 });
      return;
    }
    await performSave(() => {
      toast.success('Grade settings saved!', { position: 'top-right', duration: 1800 });
    });
    return;
  }

  if (currentTitle === 'Question Source') {
    // Same rules as ExerciseSettings' Add Questions step.
    if (!questionSource) {
      toast('Pick a Question Source first.', { icon: 'ℹ️', position: 'top-right', duration: 2600, id: 'need-source' });
      return;
    }
    if (questionSource === 'custom' && customSources.length < 2) {
      toast('Custom needs at least two sources ticked.', { icon: 'ℹ️', position: 'top-right', duration: 2800, id: 'need-2-sources' });
      return;
    }
    if (formData.exerciseType === 'Combined' && questionSourceMcq === 'custom' && customSourcesMcq.length < 2) {
      toast('MCQ Custom needs both sources ticked.', { icon: 'ℹ️', position: 'top-right', duration: 2800, id: 'need-2-mcq-sources' });
      return;
    }
    await performSave(() => {
      toast.success('Question source saved!', { position: 'top-right', duration: 1800 });
    });
    return;
  }

  if (currentTitle === 'Notifications' || currentTitle === 'Notification') {
    // Persist to the backend (not just mark the step done) — same fix as the
    // Security Settings step, which previously only saved on Finish.
    await performSave(() => {
      toast.success('Notifications settings saved!', { position: 'top-right', duration: 1800 });
    });
    return;
  }

  if (currentTitle === 'Security Settings') {
    // Persist to the backend (not just mark the step done) so editing + Save
    // actually updates securitySettings — previously only Finish saved them.
    await performSave(() => {
      toast.success('Security settings saved!', { position: 'top-right', duration: 1800 });
    });
    return;
  }

  if (currentTitle === 'Section Details') {
    // ── STEP 1: Validate section names/details ─────────────────────
    const sectionErrors = validateSections();
    if (Object.keys(sectionErrors).length > 0) {
      setValidationErrors(prev => ({ ...prev, ...sectionErrors }));
      toast.error('Please complete all section details', { position: 'top-right', duration: 3000 });
      return;
    }

    // ── STEP 2: Validate all exercise types are selected ───────────
    if (isSectionBased && sectionConfigurationStepRef.current) {
      const exerciseTypeValidation = sectionConfigurationStepRef.current.validateAllExerciseTypesSelected();
      if (!exerciseTypeValidation.isValid) {
        toast.error(
          exerciseTypeValidation.error || 'Please select exercise type for all sections',
          { position: 'top-right', duration: 4000 }
        );
        return;
      }
    }

    // ── STEP 3: Validate marks match for every section ─────────────
    // This blocks save if any section's entered marks ≠ allocated marks
    if (isSectionBased && sectionConfigurationStepRef.current) {
      const marksValid = sectionConfigurationStepRef.current.validateAndShowAllErrors();
      if (!marksValid) {
        // Toast messages are already shown inside validateAndShowAllErrors
        // with section names e.g. "Part B: Total entered marks (27) must match allocated marks (50)"
        return;
      }
    }

    // ── STEP 4: All validations passed — proceed to save ──────────
    setIsSavingStep(true);
    try {
      const currentId = localExerciseId || (isEditing ? exercise_Id : null);

      // Wait for formData sectionConfigs to be in sync
      await new Promise(resolve => setTimeout(resolve, 50));

      const mergedSaved = new Set(savedSteps);
      if (currentTitle) mergedSaved.add(currentTitle);

      const payload = buildFullPayload();
      payload.stepsSaved = [...mergedSaved];

      let response: any;
      if (currentId) {
        response = await exerciseApi.updateYouDoExercise(getEntityType(nodeType), nodeId, currentId, payload);
      } else {
        response = await exerciseApi.youDoAddExercise(getEntityType(nodeType), nodeId, payload);
        const newId = response?.data?.exercise?._id || response?.data?._id || response?._id;
        if (newId) setLocalExerciseId(newId);
      }

      setSavedSteps(mergedSaved);
      if (currentTitle) setCompletedSteps(prev => new Set(prev).add(currentTitle));
      toast.success('Section configuration saved!', { position: 'top-right', duration: 1800 });
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(
        `Save failed: ${err?.response?.data?.message || err?.message || 'Failed to save'}`,
        { position: 'top-right', duration: 4000 }
      );
    } finally {
      setIsSavingStep(false);
    }
    return;
  }

  // ── All other steps ────────────────────────────────────────────────
  let errors: ValidationErrors = {};
  if (currentTitle === 'Exercise Details') {
    const detailsErrors = validateExerciseDetails();
    errors = { ...errors, ...detailsErrors };

    if (isSectionBased && exerciseDetailsStepRef.current) {
      const sectionValidation = exerciseDetailsStepRef.current.validateSectionBased();
      if (!sectionValidation.isValid) {
        toast.error(
          sectionValidation.error || 'Section validation failed',
          { position: 'top-right', duration: 4000 }
        );
        return;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    setValidationErrors(prev => ({ ...prev, ...errors }));
    markAllTouched(['exerciseName', 'totalDuration', 'totalMarks', 'exerciseType']);
    return;
  }

  await performSave(() => {
    toast.success('Saved!', { position: 'top-right', duration: 1800 });
  });
}, [
  steps,
  currentStep,
  validateExerciseDetails,
  validateSections,
  validateGradeSettings,
  markTouched,
  performSave,
  markAllTouched,
  buildFullPayload,
  localExerciseId,
  isEditing,
  exercise_Id,
  nodeType,
  nodeId,
  isSectionBased,
  savedSteps,
  questionSource,
  customSources,
  questionSourceMcq,
  customSourcesMcq,
  formData.exerciseType,
]);



const handleComplete = useCallback(async () => {
    if (isLoading) return;

    let allErrors: ValidationErrors = {};
    const detailsErrors = validateExerciseDetails();
    allErrors = { ...allErrors, ...detailsErrors };
    const gradeErrors = validateGradeSettings();
    allErrors = { ...allErrors, ...gradeErrors };

    // Surface section-based Mark to Pass validation as a toast so it's not
    // silently hidden behind the inline field error (Grade Settings step may
    // not be visible when Save & Finish is clicked from a different step).
    if (isSectionBased && gradeErrors.combinedGradeToPass) {
      setValidationErrors(prev => ({ ...prev, ...gradeErrors }));
      markTouched('combinedGradeToPass');
      toast.error(String(gradeErrors.combinedGradeToPass), { position: 'top-right', duration: 4000 });
      return;
    }

    // Validate section-based exercises
    if (isSectionBased && exerciseDetailsStepRef.current) {
      const sectionValidation = exerciseDetailsStepRef.current.validateSectionBased();
      if (!sectionValidation.isValid) {
        toast.error(sectionValidation.error || 'Section validation failed', { position: 'top-right', duration: 4000 });
        return;
      }
    }

    // Validate that all sections have exercise type selected
    if (isSectionBased && sectionConfigurationStepRef.current) {
      const exerciseTypeValidation = sectionConfigurationStepRef.current.validateAllExerciseTypesSelected();
      if (!exerciseTypeValidation.isValid) {
        toast.error(exerciseTypeValidation.error || 'Please select exercise type for all sections', { position: 'top-right', duration: 4000 });
        return;
      }
    }

    setIsLoading(true);
    try {
      // Finish = every step is saved. Persist all step titles so a later edit
      // shows the whole sidebar as Completed.
      const allTitles = steps.map(s => s.title);
      const basePayload = buildFullPayload();
      basePayload.stepsSaved = allTitles;
      const finalId = localExerciseId || (isEditing ? exercise_Id : null);

      let response;
      if (finalId) {
        response = await exerciseApi.updateYouDoExercise(getEntityType(nodeType), nodeId, finalId, basePayload);
      } else {
        response = await exerciseApi.youDoAddExercise(getEntityType(nodeType), nodeId, basePayload);
        const newId = response?.data?.exercise?._id || response?.data?._id || response?._id;
        if (newId) setLocalExerciseId(newId);
      }

      // THE single save confirmation for this flow. It lives here, not in the
      // parents' onSave, because this is the component that performed the
      // write and it is the only place all three consumers share — the Others
      // question form has no toast of its own. `id` keeps a double-invoke from
      // stacking two copies of the same message.
      toast.success(
        isEditing ? 'Assessment updated successfully!' : 'Assessment created successfully!',
        { id: 'assessment-save-ok' },
      );
      setIsLocked(true);
      setCompletedSteps(new Set(allTitles));
      setSavedSteps(new Set(allTitles));
      
      if (typeof onSave === 'function') {
        await onSave(basePayload);
      }
      
      setIsLoading(false);
      onClose();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to save exercise');
      setIsLoading(false);
    }
  }, [validateExerciseDetails, validateGradeSettings, validateSections, isEditing, exercise_Id, getEntityType, nodeType, nodeId, onSave, onClose, buildFullPayload, localExerciseId, steps, isLoading, isSectionBased]);

  const handleStepClick = useCallback((targetStepId: number) => {
    if (targetStepId === currentStep) return;
    const step1Id = steps.find(s => s.title === 'Exercise Details')?.id ?? 1;
    // In edit mode all steps are already persisted — allow free navigation
    const step1Unlocked = isEditing || savedSteps.has('Exercise Details');
    if (!step1Unlocked && targetStepId !== step1Id) return;
    setCurrentStep(targetStepId);
  }, [currentStep, steps, savedSteps, isEditing]);

  const isDateDisabled = useCallback((year: number, month: number, day: number, fieldKey: string): boolean => {
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    if (fieldKey === 'startDate' && !isEditing) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      return date < today;
    }
    return false;
  }, [isEditing]);

  const SectionLabel = useCallback(({ children, required, info }: { children: React.ReactNode; required?: boolean; info?: string }) => (
    <div className="flex items-center gap-1 mb-1">
      <label className="text-xs font-semibold" style={{ color: D.textSub, fontFamily: "'Poppins','Poppins',sans-serif" }}>{children}</label>
      {required && <span className="text-xs font-bold" style={{ color: D.orange }}>*</span>}
      {info && <InfoTooltip content={info} />}
    </div>
  ), []);

  const renderCurrentStep = useCallback(() => {
    const step = steps.find(s => s.id === currentStep);
    if (!step) return null;

    // Note: course configuration loads in the background (used by later steps
    // for language/module options). The Exercise Details inputs don't depend on
    // it, so we render the form immediately instead of gating it behind a loader.

    const sharedConfigProps = {
      formData,
      setFormData,
      setValidationErrors,
      validationErrors,
      touchedFields,
      markTouched,
      InfoTooltip,
      SectionLabel,
      ODropdown,
      ONumberInput,
      OToggle,
      OInput,
      D,
      mcqScoringOptions: mcqScoringOptionsConst,
      configOptions,
      questionFlowOptions,
      getProgrammingTotalQuestions,
      programmingAllocatedMarks,
      programmingLevelMismatch,
      shouldShowScoringSection,
      othersAllocatedMarks,
      othersLevelMismatch,
      othersShouldShowScoringSection,
      updateLevelScoringConfig,
      updateOthersLevelScoringConfig,
      setExpandedSections,
      expandedSections,
      combinedConfigTab,
      setCombinedConfigTab,
    };
    
    switch (step.title) {
      case 'Exercise Details':
        return <ExerciseDetailsStep
          ref={exerciseDetailsStepRef}
          formData={formData}
          setFormData={setFormData}
          setValidationErrors={setValidationErrors}
          validationErrors={validationErrors}
          touchedFields={touchedFields}
          markTouched={markTouched}
          handleSelectExerciseType={handleSelectExerciseType}
          toggleLanguage={toggleLanguage}
          configuredLanguages={effectiveConfig}
          hasPreConfiguredLanguages={hasPreConfiguredLanguages}
          flatLanguages={flatLanguages}
          getFilteredLanguages={getFilteredLanguages}
          TipTapEditor={TipTapEditor}
          OInput={OInput}
          ONumberInput={ONumberInput}
          SectionLabel={SectionLabel}
          onSectionsChange={setExerciseSections}
          isSectionBasedProp={isSectionBased}
          onSectionBasedChange={setIsSectionBased}
          sectionsProp={exerciseSections}
          isSectionBasedDurationProp={isSectionBasedDuration}
          onSectionBasedDurationChange={setIsSectionBasedDuration}
        />;
        case 'Question Configuration':
if (formData.exerciseType === 'MCQ') {
  return <MCQConfiguration {...sharedConfigProps} configOptions={configOptions} />;
}
  if (formData.exerciseType === 'Programming') {
    return <ProgrammingConfiguration {...sharedConfigProps} />;
  }
  if (formData.exerciseType === 'Combined') {
    return <CombinedConfiguration {...sharedConfigProps} />;
  }
  if (formData.exerciseType === 'Other') {
    return <OthersConfiguration {...sharedConfigProps} />;
  }
  return null;
        
      case 'Section Details':
        return (
          <SectionConfigurationStep
            ref={sectionConfigurationStepRef}
            sections={exerciseSections}
            formData={formData}
            setFormData={setFormData}
            setValidationErrors={setValidationErrors}
            validationErrors={validationErrors}
            touchedFields={touchedFields}
            markTouched={markTouched}
            InfoTooltip={InfoTooltip}
            SectionLabel={SectionLabel}
            ODropdown={ODropdown}
            ONumberInput={ONumberInput}
            OToggle={OToggle}
            OInput={OInput}
            configOptions={configOptions}
            questionFlowOptions={questionFlowOptions}
            mcqScoringOptions={mcqScoringOptionsConst}
          />
        );
        
      case 'Question Source':
        return (
          <QuestionSourceStep
            questionSource={questionSource}
            setQuestionSource={setQuestionSource}
            customSources={customSources}
            setCustomSources={setCustomSources}
            customDistribution={customDistribution}
            setCustomDistribution={setCustomDistribution}
            questionSourceMcq={questionSourceMcq}
            setQuestionSourceMcq={setQuestionSourceMcq}
            customSourcesMcq={customSourcesMcq}
            setCustomSourcesMcq={setCustomSourcesMcq}
            customDistributionMcq={customDistributionMcq}
            setCustomDistributionMcq={setCustomDistributionMcq}
            formData={formData}
            isSectionBased={isSectionBased}
            InfoTooltip={InfoTooltip}
            ODropdown={ODropdown}
            customDistributionBySection={customDistributionBySection}
            setCustomDistributionBySection={setCustomDistributionBySection}
          />
        );

      case 'Schedule':
        return <ScheduleStep
          formData={formData}
          setFormData={setFormData}
          setValidationErrors={setValidationErrors}
          validationErrors={validationErrors} 
          touchedFields={touchedFields} 
          isEditing={isEditing} 
          activePicker={activePicker}
          setActivePicker={setActivePicker}
          DateRowPicker={DateRowPicker} 
          isDateDisabled={isDateDisabled} 
        />;
        
      case 'Security Settings':
        return (
          <SecuritySettings
            value={formData.securitySettings}
            onChange={(settings) => setFormData(prev => ({ ...prev, securitySettings: settings }))}
            disabled={isLocked}
          />
        );
        
      case 'Notifications':
        return <NotificationsStep formData={formData} setFormData={setFormData} D={D} />;
        
      case 'Grade Settings':
        return <GradeSettingsStep formData={formData} setFormData={setFormData} validationErrors={validationErrors} touchedFields={touchedFields} markTouched={markTouched} D={D} GradeRow={GradeRow} isSectionBased={isSectionBased} exerciseSections={exerciseSections} />;

      case 'Select Assessment Content':
        return (
          <SelectAssessmentContentStep
            D={D}
            modules={courseModules}
            selectedTopics={formData.selectedTopics || []}
            onChangeSelected={(next) => setFormData(prev => ({ ...prev, selectedTopics: next }))}
            instructions={formData.instructions || ''}
            onChangeInstructions={(v) => setFormData(prev => ({ ...prev, instructions: v }))}
            securitySettings={formData.securitySettings as any}
            TipTapEditor={TipTapEditor}
          />
        );

      default:
        return null;
    }
  }, [steps, currentStep, formData, validationErrors, touchedFields, markTouched, handleSelectExerciseType, toggleLanguage, hasPreConfiguredLanguages, flatLanguages, getFilteredLanguages, effectiveConfig, isLoadingCourse, TipTapEditor, OInput, ONumberInput, InfoTooltip, ODropdown, OToggle, mcqScoringOptionsConst, isEditing, DateRowPicker, isDateDisabled, GradeRow, SectionLabel, updateLevelScoringConfig, updateOthersLevelScoringConfig, configOptions, questionFlowOptions, getProgrammingTotalQuestions, programmingAllocatedMarks, programmingLevelMismatch, shouldShowScoringSection, othersAllocatedMarks, othersLevelMismatch, othersShouldShowScoringSection, expandedSections, setExpandedSections, combinedConfigTab, setCombinedConfigTab, isSectionBased, exerciseSections, courseModules, questionSource, customSources, customDistribution, customDistributionBySection, saveToBank, questionSourceMcq, customSourcesMcq, customDistributionMcq]);

  const getBreadcrumbs = useCallback(() => {
    const c = [];
    if (hierarchyData.courseName?.trim()) c.push({ name: hierarchyData.courseName, type: 'course' });
    if (hierarchyData.moduleName?.trim()) c.push({ name: hierarchyData.moduleName, type: 'module' });
    if (hierarchyData.submoduleName?.trim()) c.push({ name: hierarchyData.submoduleName, type: 'submodule' });
    if (hierarchyData.topicName?.trim()) c.push({ name: hierarchyData.topicName, type: 'topic' });
    if (hierarchyData.subtopicName?.trim()) c.push({ name: hierarchyData.subtopicName, type: 'subtopic' });
    return c;
  }, [hierarchyData]);

  const breadcrumbs = useMemo(() => getBreadcrumbs(), [getBreadcrumbs]);
  const step1Id = steps.find(s => s.title === 'Exercise Details')?.id ?? 1;
  // When editing an existing exercise all steps are already saved — unlock entire sidebar
  const step1Unlocked = isEditing || savedSteps.has('Exercise Details');
  const isLastStep = currentStep === steps[steps.length - 1]?.id;
  const isOnStep1 = currentStep === step1Id;
  const busy = isLoading || isSavingStep;

  const BreadcrumbArrow = () => <span className="mx-1" style={{ color: D.orange, fontWeight: 700, fontSize: 13 }}>»</span>;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(30,41,59,0.55)', backdropFilter: 'blur(6px)', fontFamily: "'Poppins','Poppins',sans-serif" }}>
      {/* Global style: font enforcement + dark scrollbar utility for step components that reference it */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        .es-main, .es-main * { font-family: 'Poppins','Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif !important; }
        .es-main ::-webkit-scrollbar { width: 6px; height: 6px; }
        .es-main ::-webkit-scrollbar-track { background: transparent; }
        .es-main ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
        .es-main ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .ca-dark-scroll { scrollbar-color: #cbd5e1 transparent; scrollbar-width: thin; }
        .ca-dark-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .ca-dark-scroll::-webkit-scrollbar-track { background: transparent; }
        .ca-dark-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
        .ca-dark-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* ── CARD (white outer with padding — cream sidebar sits inside, white shows as natural border) ── */}
      <div className="es-main w-full max-w-7xl flex overflow-hidden p-3 relative"
        style={{ height: '96vh', borderRadius: 24, background: '#ffffff', boxShadow: '0 30px 80px rgba(15,23,42,0.30), 0 8px 24px rgba(15,23,42,0.12)' }}>
        {/* ── Initial-edit hydration overlay ── */}
        {/* When the trainer clicks Edit, the modal mounts with empty form state */}
        {/* and immediately fires getExerciseById → populateFormFromExercise. Until */}
        {/* that fetch lands, the fields render as blanks — which looks like the */}
        {/* modal is broken and prompts the trainer to click Edit again. This */}
        {/* overlay covers the whole card during hydration so the wait is legible. */}
        {isEditing && isHydratingEdit && (
          <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center rounded-3xl"
            style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(2px)' }}>
            <div className="w-10 h-10 border-[3px] rounded-full animate-spin mb-3"
              style={{ borderColor: D.orange, borderTopColor: 'transparent' }} />
            <p className="text-[13px] font-semibold" style={{ color: D.textMain }}>Loading assessment…</p>
            <p className="text-[11px] mt-1" style={{ color: D.textMuted }}>Fetching your saved settings and questions.</p>
          </div>
        )}

        {/* ── SIDEBAR (cream bg — white padding on the outer card shows as border around it) ── */}
        <aside className="w-72 flex-shrink-0 flex flex-col overflow-y-auto ca-dark-scroll rounded-2xl"
          style={{ background: '#faf3ea' }}>
          {/* Brand */}
          <div className="flex items-center gap-2.5 px-7 pt-7 pb-8">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: isEditing ? D.amber + '20' : D.orange, boxShadow: `0 4px 12px ${D.orangeGlow}` }}>
              {isEditing ? <Settings2 size={15} style={{ color: D.amber }} /> : <Sparkles size={15} className="text-white" />}
            </div>
            <div className="text-[16px] font-extrabold leading-tight" style={{ color: D.textMain }}>
              {isEditing ? 'Edit Assessment' : 'Create Assessment'}
            </div>
          </div>

          {/* Step list */}
          <div className="flex-1 px-7">
            {steps.map((step, idx) => {
              const active = step.active;
              const isStepSaved = savedSteps.has(step.title);
              const isLocked_step = step.title !== 'Exercise Details' && !step1Unlocked;
              const stepHasError = step.title === 'Exercise Details' && !!(validationErrors.exerciseName || validationErrors.totalDuration || validationErrors.totalMarks);
              const done = !active && isStepSaved;
              const isLast = idx === steps.length - 1;

              // Current: solid orange filled  |  Completed: outlined orange with check  |  Pending/Locked: outlined grey
              const circleBg = active ? D.orange : '#ffffff';
              const circleColor = active ? '#ffffff' : done ? D.orange : D.textMuted;
              const circleBorder = active ? D.orange : done ? D.orange : '#cbd5e1';
              const titleColor = active ? D.textMain : isLocked_step ? D.textHint : done ? D.textMain : D.textSub;
              const descText = (step as any).subtitle || '';

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleStepClick(step.id)}
                  disabled={isLocked_step}
                  className="w-full flex items-stretch gap-3 text-left focus:outline-none"
                  style={{ cursor: isLocked_step ? 'not-allowed' : 'pointer', opacity: isLocked_step ? 0.55 : 1 }}
                  title={isLocked_step ? 'Please complete Exercise Details first' : step.title}
                >
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold border-2 transition-all"
                      style={{ background: circleBg, color: circleColor, borderColor: circleBorder, boxShadow: active ? `0 4px 10px ${D.orangeGlow}` : 'none' }}>
                      {isLocked_step ? <Lock size={11} /> : done ? <Check size={13} strokeWidth={3} /> : (idx + 1)}
                    </div>
                    {!isLast && (
                      <div className="w-0.5 flex-1 my-1" style={{ background: done ? D.orange + '80' : '#d0d7e2', minHeight: 22 }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pb-6 pt-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="text-[13px] font-bold leading-tight truncate" style={{ color: titleColor }}>
                        {step.title}
                      </div>
                      {stepHasError && !isLocked_step && (
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-black flex-shrink-0"
                          style={{ background: D.red, color: '#fff', lineHeight: 1 }} title="Required fields missing">!</span>
                      )}
                    </div>
                    {descText && (
                      <div className="text-[11px] mt-0.5 leading-snug" style={{ color: isLocked_step ? D.textHint : D.textMuted }}>
                        {descText}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

        </aside>

        {/* ── RIGHT PANE (flush white, sidebar alone floats as a bordered card) ── */}
        <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: '#ffffff' }}>

          {/* Floating close (Back moved to bottom action row) */}
          <button onClick={onClose}
            className="absolute top-5 right-8 z-10 w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-100"
            style={{ color: D.textMuted }}>
            <X size={18} />
          </button>

          {/* Compact step meta header */}
          <div className="px-10 pb-3 flex-shrink-0 pt-5">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold mb-0.5" style={{ color: D.textMuted }}>
                  Step {steps.findIndex(s => s.id === currentStep) + 1}/{steps.length}
                </div>
                <h2 className="text-[20px] font-extrabold leading-tight tracking-tight" style={{ color: D.textMain }}>
                  {steps.find(s => s.id === currentStep)?.title}
                </h2>
              </div>
              {savedSteps.has(steps.find(s => s.id === currentStep)?.title || '') && (
                <span className="flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 mt-1"
                  style={{ background: D.emerald + '12', color: D.emerald, border: `1px solid ${D.emerald}25`, marginRight: 44 }}>
                  <Check size={10} strokeWidth={3} />Saved
                </span>
              )}
            </div>
            <div className="mt-3 border-t" style={{ borderColor: D.border }} />
          </div>

          {/* Content + inline actions (single scroll container) */}
          <div className="flex-1 overflow-y-auto ca-dark-scroll flex flex-col">
            {isLocked && (
              <div className="mx-8 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: D.emerald + '12', border: `1px solid ${D.emerald}35` }}>
                <Lock size={12} style={{ color: D.emerald }} />
                <span className="text-xs font-semibold" style={{ color: D.emerald }}>
                  This exercise has been submitted and is now read-only.
                </span>
              </div>
            )}
            <div style={isLocked ? { pointerEvents: 'none', userSelect: 'none', opacity: 0.82 } : {}}>
              {renderCurrentStep()}
            </div>

            {/* Inline actions — Back on left, Save/Next/Finish on right */}
            <div className="mt-auto flex items-center justify-between gap-3 px-10 pb-8 pt-4 flex-shrink-0">
              {currentStep > 1 ? (
                <button onClick={handleBack} disabled={busy}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-all border disabled:opacity-50 hover:bg-slate-50"
                  style={{ borderColor: D.border2, color: D.textSub, background: '#ffffff' }}>
                  <ArrowLeft size={14} /> Back
                </button>
              ) : <div />}
              <div className="flex items-center gap-3">
              {!isLocked && (
                <button onClick={handleSave} disabled={busy}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg text-[13px] font-bold transition-all border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-50"
                  style={{ borderColor: D.emerald, color: D.emerald, background: '#ffffff', minWidth: 100 }}>
                  {isSavingStep ? <><Loader2 size={13} className="animate-spin" />Saving…</> : <><FileText size={13} />Save</>}
                </button>
              )}
              {!isLastStep && (
                <button onClick={handleNext} disabled={busy || (isOnStep1 && !step1Unlocked)}
                  className="flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-[14px] font-bold text-white transition-all cursor-pointer disabled:opacity-40"
                  style={{ background: '#0f172a', boxShadow: '0 8px 20px rgba(15,23,42,0.25)', minWidth: 130 }}>
                  Next <ArrowRight size={15} />
                </button>
              )}
              {isLastStep && !isLocked && (
                <button onClick={handleComplete} disabled={busy}
                  className="flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-[14px] font-bold text-white transition-all cursor-pointer disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${D.emerald}, #059669)`, boxShadow: `0 8px 20px ${D.emerald}40`, minWidth: 130 }}>
                  {isLoading ? <><Loader2 size={15} className="animate-spin" />Finishing…</> : <><Check size={15} strokeWidth={3} />Finish</>}
                </button>
              )}
              {isLocked && (
                <span className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-[13px] font-bold"
                  style={{ background: D.emerald + '15', color: D.emerald, border: `1px solid ${D.emerald}40` }}>
                  <Check size={13} strokeWidth={3} />Submitted
                </span>
              )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateAssessmentModal;