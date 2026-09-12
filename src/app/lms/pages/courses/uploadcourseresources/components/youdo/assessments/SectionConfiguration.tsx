import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  Plus,
  Trash2,
  AlertCircle,
  Check,
  Calculator,
  Layers,
  AlertTriangle,
  Settings,
  List,
  Terminal
} from "lucide-react";
import { toast } from "react-hot-toast";
import { D, formatDecimal } from "./constants";
import { FormDataType, ValidationErrors } from "./types";

// ============================================
// VALIDATION UTILITIES
// ============================================

interface SectionValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

const validateSectionNameLocal = (name: string, existingNames: string[], currentId?: string): string | null => {
  if (!name || name.trim() === '') {
    return 'Section name is required';
  }
  if (name.length < 2) {
    return 'Section name must be at least 2 characters';
  }
  if (name.length > 100) {
    return 'Section name cannot exceed 100 characters';
  }
  if (!/^[a-zA-Z0-9\s\-_.,()&]+$/.test(name)) {
    return 'Section name contains invalid characters. Use only letters, numbers, spaces, and basic punctuation';
  }

  const duplicateCheck = existingNames.filter((n, idx) =>
    n.toLowerCase() === name.toLowerCase() &&
    (!currentId || idx.toString() !== currentId)
  );
  // if (duplicateCheck.length > 0) {
  //   return 'Section name must be unique across all sections';
  // }
  return null;
};

const validateExerciseTypeLocal = (type: string): string | null => {
  const validTypes = ['MCQ', 'Programming', 'Combined', 'Other'];
  if (!type) {
    return 'Exercise type is required';
  }
  if (!validTypes.includes(type)) {
    return `Invalid exercise type. Must be one of: ${validTypes.join(', ')}`;
  }
  return null;
};

const validateMCQConfigLocal = (config: any, totalMarks: number, availableMarks?: number): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!config) {
    errors.mcqConfig = 'MCQ configuration is required';
    return errors;
  }

  if (config.generalQuestionCount === undefined || config.generalQuestionCount === null) {
    errors.mcqQuestionCount = 'Number of questions is required';
  } else if (config.generalQuestionCount > 200) {
    errors.mcqQuestionCount = 'Maximum 200 MCQ questions per section';
  }

  if (!config.scoreSettings) {
    errors.mcqScoreSettings = 'Score settings are required';
  } else {
    const validScoreTypes = ['equalDistribution', 'questionSpecific'];
    if (!config.scoreSettings.scoreType) {
      errors.mcqScoreType = 'Score type is required';
    } else if (!validScoreTypes.includes(config.scoreSettings.scoreType)) {
      errors.mcqScoreType = `Invalid score type. Must be: ${validScoreTypes.join(', ')}`;
    }

    if (config.scoreSettings.scoreType === 'equalDistribution') {
      const marksPerQ = config.scoreSettings.equalDistribution;
      const qCount = config.generalQuestionCount || 0;
      if (qCount > 0) {
        if (marksPerQ === undefined || marksPerQ === null || marksPerQ <= 0) {
          errors.mcqMarksPerQuestion = 'Marks per question must be greater than 0';
        } else if (marksPerQ > 100) {
          errors.mcqMarksPerQuestion = 'Marks per question cannot exceed 100';
        } else if (availableMarks) {
          const calculatedTotal = qCount * marksPerQ;
          if (calculatedTotal > availableMarks) {
            errors.mcqTotalExceed = `Total marks (${formatDecimal(calculatedTotal)}) exceeds available (${formatDecimal(availableMarks)})`;
          }
        }
      }
    }

    if (config.scoreSettings.scoreType === 'questionSpecific') {
      if (availableMarks && availableMarks > 0 && availableMarks < 0.5) {
        errors.totalMarks = 'Minimum total marks is 0.5';
      }
    }

    if (config.scoreSettings.scoreType === 'questionSpecific') {
      if (totalMarks <= 0) {
        errors.totalMarks = 'Section total marks must be greater than 0';
      } else if (totalMarks < 0.5) {
        errors.totalMarks = 'Minimum total marks is 0.5';
      } else if (availableMarks && totalMarks > availableMarks) {
        errors.totalMarks = `Section total (${formatDecimal(totalMarks)}) exceeds available marks (${formatDecimal(availableMarks)})`;
      }
    }
  }

  if (config.attemptLimitEnabled) {
    const attempts = config.submissionAttempts;
    if (!attempts || attempts < 1) {
      errors.mcqAttempts = 'Submission attempts must be at least 1';
    } else if (attempts > 10) {
      errors.mcqAttempts = 'Maximum submission attempts is 10';
    } else if (!Number.isInteger(attempts)) {
      errors.mcqAttempts = 'Submission attempts must be a whole number';
    }
  }

  return errors;
};

const validateProgrammingConfigLocal = (config: any, totalMarks: number, availableMarks?: number): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!config) {
    errors.programmingConfig = 'Programming configuration is required';
    return errors;
  }

  const validConfigTypes = ['general', 'levelBased', 'selectionLevel'];
  if (!config.questionConfigType) {
    errors.progConfigType = 'Question config type is required';
  } else if (!validConfigTypes.includes(config.questionConfigType)) {
    errors.progConfigType = `Invalid config type. Must be: ${validConfigTypes.join(', ')}`;
  }

  if (config.questionConfigType === 'general') {
    const qCount = config.generalQuestionCount || 0;
    if (config.generalQuestionCount === undefined || config.generalQuestionCount === null) {
      errors.progQuestionCount = 'Number of questions is required';
    } else if (config.generalQuestionCount > 100) {
      errors.progQuestionCount = 'Maximum 100 programming questions per section';
    }

    if (qCount > 0) {
      const marksPerQ = config.scoreSettings?.equalDistribution;
      if (marksPerQ === undefined || marksPerQ === null || marksPerQ <= 0) {
        errors.progMarksPerQuestion = 'Marks per question must be greater than 0';
      } else if (marksPerQ > 100) {
        errors.progMarksPerQuestion = 'Marks per question cannot exceed 100';
      } else {
        const calculatedTotal = qCount * marksPerQ;
        if (availableMarks && calculatedTotal > availableMarks) {
          errors.progTotalExceed = `Total marks (${formatDecimal(calculatedTotal)}) exceeds available (${formatDecimal(availableMarks)})`;
        }
      }
    }
  }

  if (config.questionConfigType === 'levelBased') {
    const counts = config.levelBasedCounts || { easy: 0, medium: 0, hard: 0 };
    const totalQuestions = (counts.easy || 0) + (counts.medium || 0) + (counts.hard || 0);

    if (totalQuestions > 100) {
      errors.progLevelCounts = 'Maximum 100 questions across all difficulty levels';
    }

    const levels = ['easy', 'medium', 'hard'] as const;
    let totalCalculatedMarks = 0;

    for (const level of levels) {
      const count = counts[level];
      if (count > 0) {
        const scoring = config.levelScoring?.[level];
        if (!scoring) {
          errors[`progScoring${level}`] = `Scoring configuration required for ${level} questions`;
        } else if (!scoring.type) {
          errors[`progScoringType${level}`] = `Score type required for ${level} questions`;
        } else if (scoring.type === 'level_specific') {
          const marks = scoring.marksPerQuestion;
          if (!marks || marks <= 0) {
            errors[`progMarksPerQuestion${level}`] = `Marks per question required for ${level} questions`;
          } else if (marks > 50) {
            errors[`progMarksPerQuestion${level}`] = `Marks per question for ${level} cannot exceed 50`;
          } else {
            totalCalculatedMarks += count * marks;
          }
        } else if (scoring.type === 'question_specific') {
          const total = scoring.totalMarks;
          if (!total || total <= 0) {
            errors[`progTotalMarks${level}`] = `Total marks required for ${level} questions with question-specific scoring`;
          } else if (total > 500) {
            errors[`progTotalMarks${level}`] = `Total marks for ${level} cannot exceed 500`;
          } else {
            totalCalculatedMarks += total;
          }
        }
      }
    }

    if (availableMarks && totalCalculatedMarks > availableMarks) {
      errors.progLevelTotalExceed = `Total marks (${formatDecimal(totalCalculatedMarks)}) exceeds available (${formatDecimal(availableMarks)})`;
    }
  }

  if (config.questionConfigType === 'selectionLevel') {
    const counts = config.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
    const enabledLevels = Object.entries(counts).filter(([_, count]) => Number(count) > 0).length;

    if (enabledLevels > 2) {
      errors.progSelectionLevels = 'Maximum 2 difficulty levels can be selected';
    }

    const levels = ['easy', 'medium', 'hard'] as const;
    let totalCalculatedMarks = 0;

    for (const level of levels) {
      const count = counts[level];
      if (count > 0) {
        const scoring = config.levelScoring?.[level];
        if (!scoring) {
          errors[`progSelectedScoring${level}`] = `Scoring required for ${level} questions`;
        } else if (scoring.type === 'level_specific') {
          const marks = scoring.marksPerQuestion;
          if (!marks || marks <= 0) {
            errors[`progSelectedMarks${level}`] = `Marks per question required for ${level}`;
          } else if (marks > 50) {
            errors[`progSelectedMarks${level}`] = `Marks per question for ${level} cannot exceed 50`;
          } else {
            totalCalculatedMarks += count * marks;
          }
        } else if (scoring.type === 'question_specific') {
          const total = scoring.totalMarks;
          if (!total || total <= 0) {
            errors[`progSelectedTotal${level}`] = `Total marks required for ${level}`;
          } else if (total > 500) {
            errors[`progSelectedTotal${level}`] = `Total marks for ${level} cannot exceed 500`;
          } else {
            totalCalculatedMarks += total;
          }
        }
      }
    }

    if (availableMarks && totalCalculatedMarks > availableMarks) {
      errors.progSelectionTotalExceed = `Total marks (${formatDecimal(totalCalculatedMarks)}) exceeds available (${formatDecimal(availableMarks)})`;
    }
  }

  const validFlows = ['freeFlow', 'controlled'];
  if (!config.questionFlow) {
    errors.progQuestionFlow = 'Question flow is required';
  } else if (!validFlows.includes(config.questionFlow)) {
    errors.progQuestionFlow = `Invalid question flow. Must be: ${validFlows.join(', ')}`;
  }

  if (config.attemptLimitEnabled) {
    const attempts = config.submissionAttempts;
    if (!attempts || attempts < 1) {
      errors.progAttempts = 'Submission attempts must be at least 1';
    } else if (attempts > 10) {
      errors.progAttempts = 'Maximum submission attempts is 10';
    } else if (!Number.isInteger(attempts)) {
      errors.progAttempts = 'Submission attempts must be a whole number';
    }
  }

  return errors;
};

const validateSectionTotalsLocal = (
  section: any,
  totalAvailableMarks: number
): { errors: Record<string, string>; warnings: Record<string, string> } => {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  if (section.exerciseType === 'Combined') {
    return { errors, warnings };
  }

  if (totalAvailableMarks <= 0) {
    warnings.totalMarks = 'Total marks not set in exercise details. Please set total marks first.';
  } else {
    const sectionMarks = section.totalMarks || 0;
    if (sectionMarks <= 0) {
      errors.totalMarks = 'Section total marks must be greater than 0';
    }
    if (sectionMarks > totalAvailableMarks) {
      errors.totalMarks = `Section total (${formatDecimal(sectionMarks)}) exceeds available marks (${formatDecimal(totalAvailableMarks)})`;
    }
  }

  return { errors, warnings };
};

const validateSectionConfigurationLocal = (
  section: any,
  totalAvailableMarks: number,
  existingSectionNames: string[]
): SectionValidationResult => {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  const nameError = validateSectionNameLocal(section.name, existingSectionNames);
  if (nameError) errors.name = nameError;

  const typeError = validateExerciseTypeLocal(section.exerciseType);
  if (typeError) errors.exerciseType = typeError;

  const { errors: totalErrors, warnings: totalWarnings } = validateSectionTotalsLocal(section, totalAvailableMarks);
  Object.assign(errors, totalErrors);
  Object.assign(warnings, totalWarnings);

  if (section.exerciseType === 'MCQ') {
    const mcqErrors = validateMCQConfigLocal(section.mcqConfig, section.totalMarks, totalAvailableMarks);
    Object.assign(errors, mcqErrors);
  } else if (section.exerciseType === 'Programming') {
    const progErrors = validateProgrammingConfigLocal(section.programmingConfig, section.totalMarks, totalAvailableMarks);
    Object.assign(errors, progErrors);
  } else if (section.exerciseType === 'Combined') {
    const mcqAvailable = section.mcqSectionMarks || 0;
    const progAvailable = section.programmingSectionMarks || 0;

    if (mcqAvailable <= 0) {
      errors.combinedMCQMarks = 'MCQ marks must be greater than 0';
    }
    if (progAvailable <= 0) {
      errors.combinedProgMarks = 'Programming marks must be greater than 0';
    }

    if (!section.mcqConfig) {
      errors.combinedMCQConfig = 'MCQ configuration is required for combined section';
    } else {
      const mcqErrors = validateMCQConfigLocal(section.mcqConfig, mcqAvailable, mcqAvailable);
      Object.assign(errors, mcqErrors);
    }

    if (!section.programmingConfig) {
      errors.combinedProgConfig = 'Programming configuration is required for combined section';
    } else {
      const progErrors = validateProgrammingConfigLocal(section.programmingConfig, progAvailable, progAvailable);
      Object.assign(errors, progErrors);
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
};

// ============================================
// MAIN COMPONENT
// ============================================

interface Section {
  id: string;
  name: string;
  exerciseType: "MCQ" | "Programming" | "Combined" | "Other" | "";
  difficulty: 'easy' | 'medium' | 'hard';
  totalMarks: number;
  sectionNumber: number;
  mcqSectionMarks?: number;
  programmingSectionMarks?: number;
  mcqConfig?: {
    generalQuestionCount: number;
    scoreSettings: {
      scoreType: string;
      equalDistribution: number;
    };
    attemptLimitEnabled: boolean;
    submissionAttempts: number;
  };
  programmingConfig?: {
    questionConfigType: string;
    generalQuestionCount: number;
    levelBasedCounts: { easy: number; medium: number; hard: number };
    selectionLevelCounts: { easy: number; medium: number; hard: number };
    levelScoring?: {
      easy?: { type: string; marksPerQuestion?: number; totalMarks?: number };
      medium?: { type: string; marksPerQuestion?: number; totalMarks?: number };
      hard?: { type: string; marksPerQuestion?: number; totalMarks?: number };
    };
    scoreSettings: { equalDistribution: number };
    questionFlow: string;
    attemptLimitEnabled: boolean;
    submissionAttempts: number;
  };
  errors?: {
    name?: string;
    exerciseType?: string;
    totalMarks?: string;
    [key: string]: string | undefined;
  };
}

interface SectionConfigurationStepProps {
  sections: Array<{
    id: string;
    name: string;
    order: number;
    description?: string;
    totalMarks?: number;
    totalDuration?: number;
  }>;
  formData: FormDataType;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationErrors>>;
  validationErrors: ValidationErrors;
  touchedFields: Set<string>;
  markTouched: (field: string) => void;
  InfoTooltip: any;
  SectionLabel: any;
  ODropdown: any;
  ONumberInput: any;
  OToggle: any;
  OInput: any;
  configOptions: any;
  questionFlowOptions: any;
  mcqScoringOptions: any;
}

export interface SectionConfigurationStepRef {
  validateAllExerciseTypesSelected: () => { isValid: boolean; error?: string };
  validateAndShowAllErrors: () => boolean;
}

export const SectionConfigurationStep = forwardRef<SectionConfigurationStepRef, SectionConfigurationStepProps>(({
  sections: initialSections,
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
  configOptions,
  questionFlowOptions,
  mcqScoringOptions,
}, ref) => {
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [newSectionName, setNewSectionName] = useState('');
  const [showAddSection, setShowAddSection] = useState(false);
  const [sectionErrors, setSectionErrors] = useState<Record<string, Section['errors']>>({});
  const [sectionWarnings, setSectionWarnings] = useState<Record<string, Record<string, string>>>({});
  const [combinedConfigTab, setCombinedConfigTab] = useState<'mcq' | 'programming'>('mcq');
  const [globalValidationErrors, setGlobalValidationErrors] = useState<string[]>([]);
  const [hasAttemptedSave, setHasAttemptedSave] = useState(false);

  const isUpdatingFromConfig = useRef<boolean>(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialized = useRef<boolean>(false);
  const isSyncingToParent = useRef<boolean>(false);

  const getTotalAvailableMarks = useCallback(() => {
    const exerciseType = formData.exerciseType;
    if (exerciseType === 'Combined') {
      return (formData.mcqMarks || 0) + (formData.programmingMarks || 0);
    }
    return formData.totalMarks || 0;
  }, [formData.exerciseType, formData.totalMarks, formData.mcqMarks, formData.programmingMarks]);

  const totalAvailableMarks = getTotalAvailableMarks();

  const [sectionConfigs, setSectionConfigs] = useState<Record<string, Section>>(() => {
    const initial: Record<string, Section> = {};
    const existingConfigs = formData.sectionConfigs || {};

    initialSections.forEach((section, idx) => {
      const key = section.name;
      if (existingConfigs[key]) {
        initial[key] = existingConfigs[key];
      } else {
        initial[key] = {
          id: key,
          name: section.name,
          exerciseType: "",
          difficulty: 'medium',
          totalMarks: section.totalMarks || 0,
          sectionNumber: idx + 1,
          mcqConfig: {
            generalQuestionCount: 0,
            scoreSettings: {
              scoreType: 'equalDistribution',
              equalDistribution: 0
            },
            attemptLimitEnabled: false,
            submissionAttempts: 1
          },
          programmingConfig: {
            questionConfigType: 'general',
            generalQuestionCount: 0,
            levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
            selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
            levelScoring: {
              easy: { type: 'level_specific', marksPerQuestion: 0 },
              medium: { type: 'level_specific', marksPerQuestion: 0 },
              hard: { type: 'level_specific', marksPerQuestion: 0 }
            },
            scoreSettings: { equalDistribution: 0 },
            questionFlow: 'freeFlow',
            attemptLimitEnabled: false,
            submissionAttempts: 1
          }
        };
      }
    });

    return initial;
  });

  const calculateTotalSectionMarks = useCallback(() => {
    return initialSections.reduce((sum, s) => sum + (s.totalMarks || 0), 0);
  }, [initialSections]);

  const totalSectionMarks = calculateTotalSectionMarks();
  const isMarksMatch = totalAvailableMarks > 0 && Math.abs(totalSectionMarks - totalAvailableMarks) < 0.01;
  const marksDifference = totalSectionMarks - totalAvailableMarks;

  const calculateSectionTotalImmediate = useCallback((section: Section): number => {
    if (!section.exerciseType) return 0;

    switch (section.exerciseType) {
      case 'MCQ': {
        const mcqConfig = section.mcqConfig;
        if (!mcqConfig) return 0;

        const isEqual = mcqConfig.scoreSettings?.scoreType === 'equalDistribution';
        if (isEqual) {
          return mcqConfig.generalQuestionCount * (mcqConfig.scoreSettings?.equalDistribution || 0);
        }
        return section.totalMarks || 0;
      }

      case 'Programming': {
        const progConfig = section.programmingConfig;
        if (!progConfig) return 0;

        const configType = progConfig.questionConfigType;
        if (configType === 'general') {
          return progConfig.generalQuestionCount * (progConfig.scoreSettings?.equalDistribution || 0);
        } else if (configType === 'levelBased') {
          let total = 0;
          const counts = progConfig.levelBasedCounts;
          const scoring = progConfig.levelScoring;

          if (counts?.easy > 0 && scoring?.easy) {
            total += scoring.easy.type === 'level_specific'
              ? counts.easy * (scoring.easy.marksPerQuestion || 0)
              : (scoring.easy.totalMarks || 0);
          }
          if (counts?.medium > 0 && scoring?.medium) {
            total += scoring.medium.type === 'level_specific'
              ? counts.medium * (scoring.medium.marksPerQuestion || 0)
              : (scoring.medium.totalMarks || 0);
          }
          if (counts?.hard > 0 && scoring?.hard) {
            total += scoring.hard.type === 'level_specific'
              ? counts.hard * (scoring.hard.marksPerQuestion || 0)
              : (scoring.hard.totalMarks || 0);
          }
          return total;
        } else if (configType === 'selectionLevel') {
          let total = 0;
          const counts = progConfig.selectionLevelCounts;
          const scoring = progConfig.levelScoring;

          if (counts?.easy > 0 && scoring?.easy) {
            total += scoring.easy.type === 'level_specific'
              ? counts.easy * (scoring.easy.marksPerQuestion || 0)
              : (scoring.easy.totalMarks || 0);
          }
          if (counts?.medium > 0 && scoring?.medium) {
            total += scoring.medium.type === 'level_specific'
              ? counts.medium * (scoring.medium.marksPerQuestion || 0)
              : (scoring.medium.totalMarks || 0);
          }
          if (counts?.hard > 0 && scoring?.hard) {
            total += scoring.hard.type === 'level_specific'
              ? counts.hard * (scoring.hard.marksPerQuestion || 0)
              : (scoring.hard.totalMarks || 0);
          }
          return total;
        }
        return section.totalMarks || 0;
      }

      case 'Combined': {
        const mcqSlice = section.mcqSectionMarks || 0;
        const progSlice = section.programmingSectionMarks || 0;
        if (mcqSlice > 0 || progSlice > 0) {
          return mcqSlice + progSlice;
        }
        let total = 0;
        if (section.mcqConfig?.scoreSettings?.scoreType === 'equalDistribution') {
          total += section.mcqConfig.generalQuestionCount * (section.mcqConfig.scoreSettings?.equalDistribution || 0);
        }
        if (section.programmingConfig?.questionConfigType === 'general') {
          total += (section.programmingConfig.generalQuestionCount || 0) * (section.programmingConfig.scoreSettings?.equalDistribution || 0);
        }
        return total > 0 ? total : section.totalMarks || 0;
      }

      default:
        return section.totalMarks || 0;
    }
  }, []);

  const updateSectionTotalImmediate = useCallback((sectionId: string) => {
    const section = sectionConfigs[sectionId];
    if (!section) return;

    const newTotal = calculateSectionTotalImmediate(section);

    if (Math.abs(newTotal - (section.totalMarks || 0)) > 0.01) {
      isUpdatingFromConfig.current = true;

      setSectionConfigs(prev => ({
        ...prev,
        [sectionId]: { ...section, totalMarks: newTotal }
      }));

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        const updatedSection = { ...section, totalMarks: newTotal };
        const sectionNames = Object.values(sectionConfigs).map(s => s.name);
        const result = validateSectionConfigurationLocal(updatedSection, totalAvailableMarks, sectionNames);

        const displayErrors: Section['errors'] = {};
        if (result.errors.name) displayErrors.name = result.errors.name;
        if (result.errors.exerciseType) displayErrors.exerciseType = result.errors.exerciseType;
        if (result.errors.totalMarks) displayErrors.totalMarks = result.errors.totalMarks;

        const typeSpecificErrors = [
          'mcqQuestionCount', 'mcqMarksPerQuestion', 'mcqScoreType', 'mcqAttempts',
          'progQuestionCount', 'progMarksPerQuestion', 'progConfigType', 'progQuestionFlow', 'progAttempts',
          'progLevelCounts', 'progSelectionLevels', 'progScoringEasy', 'progScoringMedium', 'progScoringHard',
          'progScoringTypeEasy', 'progScoringTypeMedium', 'progScoringTypeHard',
          'progMarksPerQuestionEasy', 'progMarksPerQuestionMedium', 'progMarksPerQuestionHard',
          'progTotalMarksEasy', 'progTotalMarksMedium', 'progTotalMarksHard',
          'progSelectedScoringEasy', 'progSelectedScoringMedium', 'progSelectedScoringHard',
          'progSelectedMarksEasy', 'progSelectedMarksMedium', 'progSelectedMarksHard',
          'progSelectedTotalEasy', 'progSelectedTotalMedium', 'progSelectedTotalHard',
          'mcqTotalExceed', 'progTotalExceed', 'progLevelTotalExceed', 'progSelectionTotalExceed',
          'combinedMCQConfig', 'combinedProgConfig', 'otherMarks',
          'combinedMCQMarks', 'combinedProgMarks', 'combinedTotalExceed'
        ];

        typeSpecificErrors.forEach(errorKey => {
          if (result.errors[errorKey]) {
            displayErrors[errorKey] = result.errors[errorKey];
          }
        });

        setSectionErrors(prev => ({
          ...prev,
          [sectionId]: Object.keys(displayErrors).length > 0 ? displayErrors : undefined
        }));

        setSectionWarnings(prev => ({
          ...prev,
          [sectionId]: Object.keys(result.warnings).length > 0 ? result.warnings : undefined
        }));

        isUpdatingFromConfig.current = false;
      }, 50);
    }
  }, [sectionConfigs, calculateSectionTotalImmediate, totalAvailableMarks]);

  const validateAllSectionsGlobal = useCallback((showGlobalWarnings = false) => {
    const sectionNames = Object.values(sectionConfigs).map(s => s.name);

    const newSectionErrors: Record<string, Section['errors']> = {};
    const newSectionWarnings: Record<string, Record<string, string>> = {};

    if (showGlobalWarnings) {
      Object.entries(sectionConfigs).forEach(([id, section]) => {
        const result = validateSectionConfigurationLocal(section, totalAvailableMarks, sectionNames);

        const displayErrors: Section['errors'] = {};
        if (result.errors.name) displayErrors.name = result.errors.name;
        if (result.errors.exerciseType) displayErrors.exerciseType = result.errors.exerciseType;
        if (result.errors.totalMarks) displayErrors.totalMarks = result.errors.totalMarks;

        const typeSpecificErrors = [
          'mcqQuestionCount', 'mcqMarksPerQuestion', 'mcqScoreType', 'mcqAttempts',
          'progQuestionCount', 'progMarksPerQuestion', 'progConfigType', 'progQuestionFlow', 'progAttempts',
          'progLevelCounts', 'progSelectionLevels', 'progScoringEasy', 'progScoringMedium', 'progScoringHard',
          'progScoringTypeEasy', 'progScoringTypeMedium', 'progScoringTypeHard',
          'progMarksPerQuestionEasy', 'progMarksPerQuestionMedium', 'progMarksPerQuestionHard',
          'progTotalMarksEasy', 'progTotalMarksMedium', 'progTotalMarksHard',
          'progSelectedScoringEasy', 'progSelectedScoringMedium', 'progSelectedScoringHard',
          'progSelectedMarksEasy', 'progSelectedMarksMedium', 'progSelectedMarksHard',
          'progSelectedTotalEasy', 'progSelectedTotalMedium', 'progSelectedTotalHard',
          'mcqTotalExceed', 'progTotalExceed', 'progLevelTotalExceed', 'progSelectionTotalExceed',
          'combinedMCQConfig', 'combinedProgConfig', 'otherMarks',
          'combinedMCQMarks', 'combinedProgMarks', 'combinedTotalExceed'
        ];

        typeSpecificErrors.forEach(errorKey => {
          if (result.errors[errorKey]) displayErrors[errorKey] = result.errors[errorKey];
        });

        if (Object.keys(displayErrors).length > 0) newSectionErrors[id] = displayErrors;
        if (Object.keys(result.warnings).length > 0) newSectionWarnings[id] = result.warnings;
      });

      setSectionErrors(newSectionErrors);
      setSectionWarnings(newSectionWarnings);
    }

    const allErrors: string[] = [];

    if (showGlobalWarnings && totalAvailableMarks > 0) {
      if (!isMarksMatch) {
        if (totalSectionMarks > totalAvailableMarks) {
          allErrors.push(`❌ MARKS OVERFLOW: Total allocated (${formatDecimal(totalSectionMarks)}) exceeds exercise total (${formatDecimal(totalAvailableMarks)}) by ${formatDecimal(Math.abs(marksDifference))} marks.`);
        } else {
          allErrors.push(`⚠️ MARKS REMAINING: Total allocated (${formatDecimal(totalSectionMarks)}) less than exercise total (${formatDecimal(totalAvailableMarks)}) by ${formatDecimal(Math.abs(marksDifference))} marks.`);
        }
      }
    }

    setGlobalValidationErrors(showGlobalWarnings ? allErrors.filter(e => !e.startsWith('✅')) : []);

    if (showGlobalWarnings) {
      const hasErrors = allErrors.some(e => e.startsWith('❌') || e.startsWith('⚠️'));
      if (hasErrors) {
        setValidationErrors(prev => ({
          ...prev,
          sectionConfiguration: allErrors.filter(e => !e.startsWith('✅')).join('; ')
        }));
      } else {
        setValidationErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.sectionConfiguration;
          return newErrors;
        });
      }
    }
  }, [sectionConfigs, totalAvailableMarks, totalSectionMarks, isMarksMatch, marksDifference, setValidationErrors]);


  useEffect(() => {
    if (!isUpdatingFromConfig.current) {
      validateAllSectionsGlobal(false);
    }
  }, [validateAllSectionsGlobal]);
  // Initialize sections from props - only run once
  useEffect(() => {
    if (!isInitialized.current && initialSections.length > 0) {
      const newConfigs: Record<string, Section> = {};
      const existingConfigs = formData.sectionConfigs || {};

      initialSections.forEach((section, idx) => {
        const key = section.name;
        if (existingConfigs[key]) {
          newConfigs[key] = existingConfigs[key];
        } else {
          newConfigs[key] = {
            id: key,
            name: section.name,
            exerciseType: "",
            difficulty: 'medium',
            totalMarks: 0,
            sectionNumber: idx + 1,
            mcqConfig: {
              generalQuestionCount: 0,
              scoreSettings: {
                scoreType: 'equalDistribution',
                equalDistribution: 0
              },
              attemptLimitEnabled: false,
              submissionAttempts: 1
            },
            programmingConfig: {
              questionConfigType: 'general',
              generalQuestionCount: 0,
              levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
              selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
              levelScoring: {
                easy: { type: 'level_specific', marksPerQuestion: 0 },
                medium: { type: 'level_specific', marksPerQuestion: 0 },
                hard: { type: 'level_specific', marksPerQuestion: 0 }
              },
              scoreSettings: { equalDistribution: 0 },
              questionFlow: 'freeFlow',
              attemptLimitEnabled: false,
              submissionAttempts: 1
            }
          };
        }
      });

      setSectionConfigs(newConfigs);

      const firstKey = Object.keys(newConfigs)[0];
      if (firstKey) {
        setActiveTabId(firstKey);
      }

      isInitialized.current = true;
    }
  }, [initialSections, formData.sectionConfigs]);

  // Sync to parent formData - with prevention of infinite loop
  useEffect(() => {
    if (isInitialized.current && !isSyncingToParent.current) {
      isSyncingToParent.current = true;
      setFormData(prev => ({
        ...prev,
        sectionConfigs: sectionConfigs,
        isSectionBased: true,
      }));
      setTimeout(() => {
        isSyncingToParent.current = false;
      }, 0);
    }
  }, [sectionConfigs, setFormData]);

  const validateAndShowErrors = useCallback((section: Section, sectionId: string, force = false) => {
    if (!hasAttemptedSave && !force) return true;

    const sectionNames = Object.values(sectionConfigs).map(s => s.name);
    const result = validateSectionConfigurationLocal(section, totalAvailableMarks, sectionNames);

    const displayErrors: Section['errors'] = {};
    if (result.errors.name) displayErrors.name = result.errors.name;
    if (result.errors.exerciseType) displayErrors.exerciseType = result.errors.exerciseType;
    if (result.errors.totalMarks) displayErrors.totalMarks = result.errors.totalMarks;

    const typeSpecificErrors = [
      'mcqQuestionCount', 'mcqMarksPerQuestion', 'mcqScoreType', 'mcqAttempts',
      'progQuestionCount', 'progMarksPerQuestion', 'progConfigType', 'progQuestionFlow', 'progAttempts',
      'progLevelCounts', 'progSelectionLevels',
      'progScoringeasy', 'progScoringmedium', 'progScoringhard',
      'progScoringTypeeasy', 'progScoringTypemedium', 'progScoringTypehard',
      'progMarksPerQuestioneasy', 'progMarksPerQuestionmedium', 'progMarksPerQuestionhard',
      'progTotalMarkseasy', 'progTotalMarksmedium', 'progTotalMarkshard',
      'progSelectedScoringeasy', 'progSelectedScoringmedium', 'progSelectedScoringhard',
      'progSelectedMarkseasy', 'progSelectedMarksmedium', 'progSelectedMarkshard',
      'progSelectedTotaleasy', 'progSelectedTotalmedium', 'progSelectedTotalhard',
      'mcqTotalExceed', 'progTotalExceed', 'progLevelTotalExceed', 'progSelectionTotalExceed',
      'combinedMCQMarks', 'combinedProgMarks', 'combinedTotalExceed',
      'combinedMCQConfig', 'combinedProgConfig', 'otherMarks'
    ];

    typeSpecificErrors.forEach(errorKey => {
      if (result.errors[errorKey]) {
        displayErrors[errorKey] = result.errors[errorKey];
      }
    });

    setSectionErrors(prev => ({
      ...prev,
      [sectionId]: Object.keys(displayErrors).length > 0 ? displayErrors : undefined
    }));

    setSectionWarnings(prev => ({
      ...prev,
      [sectionId]: Object.keys(result.warnings).length > 0 ? result.warnings : undefined
    }));

    return result.isValid;
  }, [sectionConfigs, totalAvailableMarks, hasAttemptedSave]);
  const updateSection = useCallback((sectionId: string, field: keyof Section, value: any) => {
    const section = sectionConfigs[sectionId];
    if (!section) return;

    let updatedSection = { ...section, [field]: value };

    if (
      (field === 'mcqSectionMarks' || field === 'programmingSectionMarks') &&
      updatedSection.exerciseType === 'Combined'
    ) {
      updatedSection.totalMarks =
        (updatedSection.mcqSectionMarks || 0) + (updatedSection.programmingSectionMarks || 0);
    }

    setSectionConfigs(prev => ({ ...prev, [sectionId]: updatedSection }));
    if (field === 'exerciseType' && !hasAttemptedSave) {
      setSectionErrors(prev => ({ ...prev, [sectionId]: undefined }));
    }
    if (field === 'mcqConfig' || field === 'programmingConfig') {
      updateSectionTotalImmediate(sectionId);
    }

    if (hasAttemptedSave) {
      validateAndShowErrors(updatedSection, sectionId);
    }
  }, [sectionConfigs, updateSectionTotalImmediate, validateAndShowErrors, hasAttemptedSave]);
  const handleMCQUpdate = useCallback((sectionId: string, updates: any) => {
    const section = sectionConfigs[sectionId];
    if (!section) return;

    const newConfig = { ...section.mcqConfig, ...updates };

    setSectionConfigs(prev => ({
      ...prev,
      [sectionId]: { ...section, mcqConfig: newConfig }
    }));

    updateSectionTotalImmediate(sectionId);

    setTimeout(() => {
      if (!hasAttemptedSave) return;
      const newTotal = calculateSectionTotalImmediate({ ...section, mcqConfig: newConfig });
      const updatedSection = {
        ...section,
        mcqConfig: newConfig,
        totalMarks: section.exerciseType === 'Combined'
          ? (section.mcqSectionMarks || 0) + (section.programmingSectionMarks || 0)
          : newTotal
      };
      validateAndShowErrors(updatedSection, sectionId);
    }, 10);
  }, [sectionConfigs, updateSectionTotalImmediate, calculateSectionTotalImmediate, validateAndShowErrors, hasAttemptedSave]);

  const handleProgrammingUpdate = useCallback((sectionId: string, updates: any) => {
    const section = sectionConfigs[sectionId];
    if (!section) return;

    const newConfig = { ...section.programmingConfig, ...updates };

    const sectionAllocatedMarks = section.exerciseType === 'Combined'
      ? (section.programmingSectionMarks || 0)
      : (initialSections.find(s => s.name === section.name)?.totalMarks || 0);

    let newTotal = 0;

    if (updates.levelBasedCounts || updates.selectionLevelCounts || updates.levelScoring) {
      const counts = updates.levelBasedCounts || updates.selectionLevelCounts || newConfig.levelBasedCounts || newConfig.selectionLevelCounts || {};
      const scoring = updates.levelScoring || newConfig.levelScoring;

      (['easy', 'medium', 'hard'] as const).forEach(level => {
        const count = counts[level] || 0;
        if (count > 0 && scoring?.[level]) {
          const levelScoring = scoring[level];
          if (levelScoring.type === 'level_specific') {
            newTotal += count * (levelScoring.marksPerQuestion || 0);
          } else if (levelScoring.type === 'question_specific') {
            newTotal += levelScoring.totalMarks || 0;
          }
        }
      });

      if (newTotal > sectionAllocatedMarks && sectionAllocatedMarks > 0) {
        toast.error(`Total marks (${formatDecimal(newTotal)}) exceed section allocated marks (${formatDecimal(sectionAllocatedMarks)})`, { position: 'top-right', duration: 4000 });
      }
    }

    setSectionConfigs(prev => ({
      ...prev,
      [sectionId]: { ...section, programmingConfig: newConfig }
    }));

    updateSectionTotalImmediate(sectionId);
    setTimeout(() => {
      if (!hasAttemptedSave) return;
      const newTotal = calculateSectionTotalImmediate({ ...section, programmingConfig: newConfig });
      const updatedSection = {
        ...section,
        programmingConfig: newConfig,
        totalMarks: section.exerciseType === 'Combined'
          ? (section.mcqSectionMarks || 0) + (section.programmingSectionMarks || 0)
          : newTotal
      };
      validateAndShowErrors(updatedSection, sectionId);
    }, 10);
  }, [sectionConfigs, updateSectionTotalImmediate, calculateSectionTotalImmediate, validateAndShowErrors, initialSections, hasAttemptedSave]);
  const addSection = useCallback(() => {
    if (!newSectionName.trim()) return;

    const sectionName = newSectionName.trim();
    const existingNames = Object.values(sectionConfigs).map(s => s.name);

    const sectionNameError = validateSectionNameLocal(sectionName, existingNames);

    if (sectionNameError) {
      toast.error(sectionNameError);
      return;
    }

    const newSectionId = sectionName;

    if (sectionConfigs[newSectionId]) {
      toast.error(`Section "${sectionName}" already exists`);
      return;
    }

    const newSection: Section = {
      id: newSectionId,
      name: sectionName,
      exerciseType: "",
      difficulty: 'medium',
      totalMarks: 0,
      sectionNumber: Object.keys(sectionConfigs).length + 1,
      mcqConfig: {
        generalQuestionCount: 0,
        scoreSettings: {
          scoreType: 'equalDistribution',
          equalDistribution: 0
        },
        attemptLimitEnabled: false,
        submissionAttempts: 1
      },
      programmingConfig: {
        questionConfigType: 'general',
        generalQuestionCount: 0,
        levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
        selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
        levelScoring: {
          easy: { type: 'level_specific', marksPerQuestion: 0 },
          medium: { type: 'level_specific', marksPerQuestion: 0 },
          hard: { type: 'level_specific', marksPerQuestion: 0 }
        },
        scoreSettings: { equalDistribution: 0 },
        questionFlow: 'freeFlow',
        attemptLimitEnabled: false,
        submissionAttempts: 1
      }
    };

    const parentSections = [...initialSections, {
      id: newSectionId,
      name: sectionName,
      order: initialSections.length + 1,
      description: ''
    }];

    setFormData(prev => ({
      ...prev,
      sections: parentSections
    }));

    setSectionConfigs(prev => ({ ...prev, [newSectionId]: newSection }));
    setActiveTabId(newSectionId);
    setNewSectionName('');
    setShowAddSection(false);
  }, [newSectionName, sectionConfigs, initialSections, setFormData]);

  const removeSection = useCallback((sectionId: string) => {
    if (Object.keys(sectionConfigs).length <= 1) return;

    const { [sectionId]: _, ...remainingSections } = sectionConfigs;

    const renumberedSections: Record<string, Section> = {};
    let newNumber = 1;
    Object.values(remainingSections).forEach(section => {
      renumberedSections[section.id] = {
        ...section,
        sectionNumber: newNumber++
      };
    });

    const parentSections = initialSections.filter(s => s.id !== sectionId);
    setFormData(prev => ({
      ...prev,
      sections: parentSections
    }));

    setSectionConfigs(renumberedSections);

    const firstTabId = Object.keys(renumberedSections)[0];
    if (firstTabId) {
      setActiveTabId(firstTabId);
    }

    setSectionErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[sectionId];
      return newErrors;
    });
    setSectionWarnings(prev => {
      const newWarnings = { ...prev };
      delete newWarnings[sectionId];
      return newWarnings;
    });
  }, [sectionConfigs, initialSections, setFormData]);

  const totalQuestions = Object.values(sectionConfigs).reduce((sum, config) => {
    if (!config.exerciseType) return sum;
    switch (config.exerciseType) {
      case 'MCQ':
        return sum + (config.mcqConfig?.generalQuestionCount || 0);
      case 'Programming':
        const progConfig = config.programmingConfig;
        if (progConfig?.questionConfigType === 'general') {
          return sum + (progConfig.generalQuestionCount || 0);
        } else {
          const counts = progConfig?.levelBasedCounts || { easy: 0, medium: 0, hard: 0 };
          return sum + (counts.easy + counts.medium + counts.hard);
        }
      default:
        return sum;
    }
  }, 0);

  const configuredCount = Object.values(sectionConfigs).filter(c => c.exerciseType && c.totalMarks > 0).length;

  const exerciseTypeOptions = [
    { value: "MCQ", label: "MCQ", color: D.orange },
    { value: "Programming", label: "Prog.", color: D.blue || D.orange },
    { value: "Combined", label: "Combined", color: D.emerald },
    { value: "Other", label: "Other", color: D.textMuted },
  ];

  const activeSection = sectionConfigs[activeTabId];
  const activeErrors = activeSection ? sectionErrors[activeTabId] : undefined;
  const activeWarnings = activeSection ? sectionWarnings[activeTabId] : undefined;
  const sortedSections = Object.values(sectionConfigs).sort((a, b) => a.sectionNumber - b.sectionNumber);



  // ============================================
  // FUNCTION 1: calculateEnteredMarks (NEW — add before getSectionValidationStatus)
  // ============================================

const calculateEnteredMarks = useCallback((section: Section): {
  isExactMatch: boolean;
  enteredTotal: number;
  allocatedTotal: number;
  subErrors: Array<{ part: string; entered: number; allocated: number }>;
} => {
  const allocatedTotal = initialSections.find(s => s.name === section.name)?.totalMarks || 0;
  const subErrors: Array<{ part: string; entered: number; allocated: number }> = [];

  if (!section.exerciseType) {
    return { isExactMatch: false, enteredTotal: 0, allocatedTotal, subErrors };
  }

  if (allocatedTotal <= 0) {
    return { isExactMatch: false, enteredTotal: 0, allocatedTotal, subErrors };
  }

  // ── Helper: calculate MCQ entered total ───────────────────────
  const calcMCQTotal = (mcqConfig: any, available: number): number => {
    if (!mcqConfig) return 0;
    if (mcqConfig.scoreSettings?.scoreType === 'equalDistribution') {
      const qCount = mcqConfig.generalQuestionCount || 0;
      const marksPerQ = available > 0 && qCount > 0 ? available / qCount : 0;
      return qCount * marksPerQ;
    }
    // questionSpecific — marks are locked to available total, always treated as matching
    return available;
  };

  // ── Helper: calculate Programming entered total ───────────────
  const calcProgTotal = (progConfig: any): number => {
    if (!progConfig) return 0;
    const configType = progConfig.questionConfigType || 'general';

    if (configType === 'general') {
      const qCount = progConfig.generalQuestionCount || 0;
      const marksPerQ = progConfig.scoreSettings?.equalDistribution || 0;
      return qCount * marksPerQ;
    }

    // levelBased or selectionLevel — sum across easy/medium/hard
    const counts =
      configType === 'levelBased'
        ? (progConfig.levelBasedCounts || { easy: 0, medium: 0, hard: 0 })
        : (progConfig.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 });

    const scoring = progConfig.levelScoring;
    let total = 0;

    (['easy', 'medium', 'hard'] as const).forEach(level => {
      const count = counts[level] || 0;
      if (count > 0 && scoring?.[level]) {
        const ls = scoring[level];
        if (ls.type === 'level_specific') {
          total += count * (ls.marksPerQuestion || 0);
        } else if (ls.type === 'question_specific') {
          total += ls.totalMarks || 0;
        }
      }
    });

    return total;
  };

  let enteredTotal = 0;

  switch (section.exerciseType) {

    case 'MCQ': {
      // MCQ equal distribution: questionCount × (allocatedTotal / questionCount) = allocatedTotal
      // We check: questionCount > 0 AND marksPerQ > 0 AND their product = allocatedTotal
      const mcqConfig = section.mcqConfig;
      if (!mcqConfig) {
        enteredTotal = 0;
        break;
      }
      if (mcqConfig.scoreSettings?.scoreType === 'equalDistribution') {
        const qCount = mcqConfig.generalQuestionCount || 0;
        const marksPerQ = mcqConfig.scoreSettings?.equalDistribution || 0;
        enteredTotal = qCount * marksPerQ;
      } else {
        // questionSpecific — treat as matching allocated
        enteredTotal = allocatedTotal;
      }
      break;
    }

    case 'Programming': {
      enteredTotal = calcProgTotal(section.programmingConfig);
      break;
    }

    case 'Combined': {
      const mcqSlice = section.mcqSectionMarks || 0;
      const progSlice = section.programmingSectionMarks || 0;
      enteredTotal = mcqSlice + progSlice;

      // Level 1 check: outer split must equal allocated total first
      const outerMatch = Math.abs(enteredTotal - allocatedTotal) < 0.01;

      if (outerMatch) {
        // Level 2 check: MCQ sub-config must equal mcqSlice
        if (mcqSlice > 0) {
          const mcqConfig = section.mcqConfig;
          let mcqCalc = 0;
          if (mcqConfig?.scoreSettings?.scoreType === 'equalDistribution') {
            const qCount = mcqConfig.generalQuestionCount || 0;
            const marksPerQ = mcqConfig.scoreSettings?.equalDistribution || 0;
            mcqCalc = qCount * marksPerQ;
          } else {
            // questionSpecific — locked to slice, treat as matching
            mcqCalc = mcqSlice;
          }
          if (Math.abs(mcqCalc - mcqSlice) >= 0.01) {
            subErrors.push({
              part: 'MCQ',
              entered: mcqCalc,
              allocated: mcqSlice
            });
          }
        }

        // Level 2 check: Programming sub-config must equal progSlice
        if (progSlice > 0) {
          const progCalc = calcProgTotal(section.programmingConfig);
          if (Math.abs(progCalc - progSlice) >= 0.01) {
            subErrors.push({
              part: 'Programming',
              entered: progCalc,
              allocated: progSlice
            });
          }
        }
      }
      break;
    }

    case 'Other': {
      // Other type — no marks config required, treat as always matching
      enteredTotal = allocatedTotal;
      break;
    }

    default:
      return { isExactMatch: false, enteredTotal: 0, allocatedTotal, subErrors };
  }

  const outerMatch = Math.abs(enteredTotal - allocatedTotal) < 0.01;
  const isExactMatch = outerMatch && subErrors.length === 0;

  return { isExactMatch, enteredTotal, allocatedTotal, subErrors };
}, [initialSections]);

// ============================================
// FUNCTION 2: getSectionValidationStatus (REPLACE EXISTING)
// ============================================

const getSectionValidationStatus = (sectionId: string) => {
  const errors = sectionErrors[sectionId];
  const config = sectionConfigs[sectionId];

  // No exercise type selected yet — empty grey dot
  if (!config?.exerciseType) return 'empty';

  // Has field-level validation errors — red
  if (errors && Object.keys(errors).length > 0) return 'error';

  const { isExactMatch, allocatedTotal } = calculateEnteredMarks(config);

  // Allocated marks not set yet in Exercise Details — amber warning
  if (allocatedTotal <= 0) return 'partial';

  // Marks entered but don't exactly match allocated — amber warning
  if (!isExactMatch) return 'partial';

  // All checks passed — green tick ✅
  return 'valid';
};


  const isTotalMarksSet = totalAvailableMarks > 0;

  // Validation function to check if all sections have exercise type selected
  const validateAllExerciseTypesSelected = useCallback((): { isValid: boolean; error?: string } => {
    const sectionsWithoutType = Object.values(sectionConfigs).filter(section => !section.exerciseType || section.exerciseType === "");

    if (sectionsWithoutType.length > 0) {
      const sectionNames = sectionsWithoutType.map(s => s.name || `Section ${s.sectionNumber}`).join(", ");
      return {
        isValid: false,
        error: `Please select exercise type for all sections. Missing: ${sectionNames}`
      };
    }

    return { isValid: true };
  }, [sectionConfigs]);

  // Expose validation function to parent via ref
// ============================================
// FUNCTION 3: useImperativeHandle (REPLACE ENTIRE EXISTING BLOCK)
// ============================================

useImperativeHandle(ref, () => ({
  validateAllExerciseTypesSelected,

  validateAndShowAllErrors: (): boolean => {
    setHasAttemptedSave(true);
    validateAllSectionsGlobal(true);

    const errors: string[] = [];

    Object.values(sectionConfigs).forEach(section => {
      const sectionLabel = section.name || `Section ${section.sectionNumber}`;

      // ── 1. Exercise type not selected ──────────────────────────────
      if (!section.exerciseType || section.exerciseType === '') {
        errors.push(`"${sectionLabel}": Exercise type not selected`);
        return;
      }

      const { isExactMatch, enteredTotal, allocatedTotal, subErrors } = calculateEnteredMarks(section);

      // ── 2. Allocated marks not set ─────────────────────────────────
      if (allocatedTotal <= 0) {
        errors.push(
          `"${sectionLabel}": Allocated marks not set. Please set marks in Exercise Details first.`
        );
        return;
      }

      // ── 3. Outer total does not match allocated ────────────────────
      if (Math.abs(enteredTotal - allocatedTotal) >= 0.01) {
        errors.push(
          `"${sectionLabel}": Total entered marks (${formatDecimal(enteredTotal)}) must match allocated marks (${formatDecimal(allocatedTotal)})`
        );
        return; // no point checking sub-errors if outer split is wrong
      }

      // ── 4. Sub-section errors (Combined inner MCQ / Programming) ───
      if (subErrors.length > 0) {
        subErrors.forEach(sub => {
          errors.push(
            `"${sectionLabel}" [${sub.part}]: Total entered marks (${formatDecimal(sub.entered)}) must match allocated marks (${formatDecimal(sub.allocated)})`
          );
        });
        return;
      }
    });

    // ── 5. Global cross-section marks balance ──────────────────────
    if (totalAvailableMarks > 0 && !isMarksMatch) {
      if (totalSectionMarks > totalAvailableMarks) {
        errors.push(
          `Marks overflow: total allocated (${formatDecimal(totalSectionMarks)}) exceeds exercise total (${formatDecimal(totalAvailableMarks)}) by ${formatDecimal(Math.abs(marksDifference))} marks`
        );
      } else {
        errors.push(
          `Marks remaining: ${formatDecimal(Math.abs(marksDifference))} marks unallocated — sections total ${formatDecimal(totalSectionMarks)} but exercise needs ${formatDecimal(totalAvailableMarks)}`
        );
      }
    }

    // ── 6. Show toasts with section names ─────────────────────────
    if (errors.length > 0) {
      errors.slice(0, 3).forEach((err, i) => {
        setTimeout(() => {
          toast.error(err, { position: 'top-right', duration: 6000 });
        }, i * 400);
      });

      if (errors.length > 3) {
        setTimeout(() => {
          toast.error(
            `...and ${errors.length - 3} more issue(s). Check all sections.`,
            { position: 'top-right', duration: 6000 }
          );
        }, 3 * 400);
      }

      return false; // ← BLOCKS SAVE
    }

    return true; // ← ALLOWS SAVE
  }
}));

  // MCQ Configuration Component
  const renderMCQConfig = (section: Section, availableMarks?: number) => {
    const effectiveTotal = availableMarks ?? totalAvailableMarks;
    const isEqual = section.mcqConfig?.scoreSettings?.scoreType === 'equalDistribution';

    return (
      <div className="space-y-3 mt-2">
        <div className="">
      <div className="mb-3">
  <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: D.textMuted }}>Scoring Type</label>
  <div className="max-w-[220px]">
    <ODropdown
      value={section.mcqConfig?.scoreSettings?.scoreType || 'equalDistribution'}
      options={mcqScoringOptions}
      onChange={(v: string) => {
        if (v === 'questionSpecific') {
          handleMCQUpdate(section.id, {
            scoreSettings: { ...section.mcqConfig?.scoreSettings, scoreType: v }
          });
        } else {
          handleMCQUpdate(section.id, {
            scoreSettings: {
              ...section.mcqConfig?.scoreSettings,
              scoreType: v,
              equalDistribution: v === 'equalDistribution' && section.mcqConfig?.generalQuestionCount > 0
                ? effectiveTotal / (section.mcqConfig?.generalQuestionCount || 1)
                : 0
            }
          });
        }
      }}
    />
  </div>
  {activeErrors?.mcqScoreType && (
    <p className="mt-1 text-[10px]" style={{ color: D.red }}>{activeErrors.mcqScoreType}</p>
  )}
</div>
          {isEqual ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: D.textMuted }}>Questions <span style={{ color: D.red }}>*</span></label>
                  <ONumberInput
                    value={section.mcqConfig?.generalQuestionCount || 0}
                    onChange={(v: number) => {
                      handleMCQUpdate(section.id, {
                        generalQuestionCount: v,
                        scoreSettings: {
                          ...section.mcqConfig?.scoreSettings,
                          equalDistribution: v > 0 && effectiveTotal > 0 ? effectiveTotal / v : 0,
                        }
                      });
                    }}
                    min={1}
                    max={200}
                    placeholder="10"
                  />
                  {activeErrors?.mcqQuestionCount && (
                    <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>{activeErrors.mcqQuestionCount}</p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: D.textMuted }}>Marks/Q <span className="text-[9px] font-normal">(auto)</span></label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formatDecimal(section.mcqConfig?.scoreSettings?.equalDistribution || 0)}
                      disabled
                      readOnly
                      className="w-full px-2 py-1.5 text-xs rounded-lg border"
                      style={{ borderColor: D.border, background: D.surface, color: D.textMuted }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: D.orange }}>Auto</span>
                  </div>
                </div>
              </div>
              {activeErrors?.mcqTotalExceed && (
                <div className="mt-2 p-1.5 rounded text-[10px] flex items-center gap-1" style={{ background: D.red + '10', color: D.red }}>
                  <AlertCircle size={11} />
                  <span>{activeErrors.mcqTotalExceed}</span>
                </div>
              )}
              {section.mcqConfig?.generalQuestionCount > 0 && effectiveTotal > 0 && (
                <div className="mt-2 px-2 py-1 rounded text-[10px] flex items-center gap-1.5" style={{ background: D.blue + '10', color: D.blue }}>
                  <Calculator size={10} />
                  <span>{section.mcqConfig.generalQuestionCount} × {formatDecimal(section.mcqConfig.scoreSettings?.equalDistribution || 0)} = <strong>{formatDecimal(section.mcqConfig.generalQuestionCount * (section.mcqConfig.scoreSettings?.equalDistribution || 0))}</strong> marks</span>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: D.textMuted }}>Section Total Marks <span style={{ color: D.red }}>*</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatDecimal(effectiveTotal || 0)}
                    disabled
                    readOnly
                    className="w-full px-2 py-1.5 text-xs rounded-lg border"
                    style={{ borderColor: D.border, background: D.surface, color: D.textMuted }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: D.orange }}>Fixed</span>
                </div>
                {effectiveTotal <= 0 && (
                  <p className="mt-0.5 text-[10px]" style={{ color: D.amber }}>Set total marks in Exercise Details first</p>
                )}
              </div>
              <div className="px-2 py-1.5 rounded text-[10px]" style={{ background: D.blue + '10', color: D.blue }}>
                📝 Individual question marks set in next step · Sum must equal <strong>{formatDecimal(effectiveTotal || 0)}</strong>
              </div>
            </div>
          )}

          <div className="mt-3 pt-2 border-t" style={{ borderColor: D.border }}>
            <OToggle
              enabled={section.mcqConfig?.attemptLimitEnabled || false}
              onChange={(v: boolean) => {
                handleMCQUpdate(section.id, {
                  attemptLimitEnabled: v,
                  submissionAttempts: v ? (section.mcqConfig?.submissionAttempts || 1) : 1
                });
              }}
              label="Attempt Limit"
              description="Restrict submission attempts"
            />
            {section.mcqConfig?.attemptLimitEnabled && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] font-semibold" style={{ color: D.textMuted }}>Attempts</label>
                <div className="w-20">
                  <ONumberInput
                    value={section.mcqConfig?.submissionAttempts || 1}
                    onChange={(v: number) => {
                      handleMCQUpdate(section.id, { submissionAttempts: Math.max(1, Math.min(10, v)) });
                    }}
                    min={1}
                    max={10}
                  />
                </div>
                {activeErrors?.mcqAttempts && (
                  <p className="text-[10px]" style={{ color: D.red }}>{activeErrors.mcqAttempts}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  // Programming Configuration Component
  const renderProgrammingConfig = (section: Section, availableMarks?: number) => {
    const effectiveTotal = availableMarks ?? totalAvailableMarks;
    const configType = section.programmingConfig?.questionConfigType || 'general';
    const isGeneral = configType === 'general';
    const isLevelBased = configType === 'levelBased';
    const isSelectionLevel = configType === 'selectionLevel';

    const calculateLevelBasedTotal = () => {
      if (!isLevelBased && !isSelectionLevel) return 0;
      const counts = isLevelBased
        ? (section.programmingConfig?.levelBasedCounts || { easy: 0, medium: 0, hard: 0 })
        : (section.programmingConfig?.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 });
      const scoring = section.programmingConfig?.levelScoring;
      let total = 0;
      (['easy', 'medium', 'hard'] as const).forEach(level => {
        const count = counts[level];
        if (count > 0 && scoring?.[level]) {
          const ls = scoring[level];
          if (ls.type === 'level_specific') total += count * (ls.marksPerQuestion || 0);
          else if (ls.type === 'question_specific') total += ls.totalMarks || 0;
        }
      });
      return total;
    };

    const levelBasedTotal = calculateLevelBasedTotal();
    const exceedsSectionAllocated = effectiveTotal > 0 && levelBasedTotal > effectiveTotal;

    const getSelectedLevels = () => {
      if (!isSelectionLevel) return [];
      const counts = section.programmingConfig?.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
      return (['easy', 'medium', 'hard'] as const).filter(level => counts[level] > 0);
    };

    const selectedLevels = getSelectedLevels();

  return (
      <div className="space-y-3 mt-2">
        <div className="">
          {/* {effectiveTotal > 0 && (
            <div className="mb-3 px-2 py-1.5 rounded flex items-center gap-1.5 text-[10px]" style={{ background: D.orange + '12', color: D.orange }}>
              <Calculator size={10} />
              <span>Allocated for this section: <strong>{formatDecimal(effectiveTotal)} marks</strong></span>
            </div>
          )} */}

          {exceedsSectionAllocated && (
            <div className="mb-2 p-2 rounded flex items-start gap-1.5" style={{ background: D.red + '10', border: `1px solid ${D.red}25` }}>
              <AlertCircle size={11} style={{ color: D.red, flexShrink: 0, marginTop: 1 }} />
              <p className="text-[10px]" style={{ color: D.red }}>
                Total ({formatDecimal(levelBasedTotal)}) exceeds allocated ({formatDecimal(effectiveTotal)}) marks
              </p>
            </div>
          )}

          <div className="mb-3">
            <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: D.textMuted }}>Config Strategy</label>
            <ODropdown
              value={section.programmingConfig?.questionConfigType || 'general'}
              options={configOptions}
              onChange={(v: string) => {
                handleProgrammingUpdate(section.id, {
                  questionConfigType: v,
                  ...(v === 'general'
                    ? { generalQuestionCount: 0, levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                    : v === 'levelBased'
                      ? { levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                      : { selectionLevelCounts: { easy: 0, medium: 0, hard: 0 }, levelBasedCounts: { easy: 0, medium: 0, hard: 0 } }
                  )
                });
              }}
            />
            {sectionErrors[section.id]?.progConfigType && (
              <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>{sectionErrors[section.id].progConfigType}</p>
            )}
          </div>

          {isGeneral && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: D.textMuted }}>Questions <span style={{ color: D.red }}>*</span></label>
                <ONumberInput
                  value={section.programmingConfig?.generalQuestionCount || 0}
                  onChange={(v: number) => {
                    handleProgrammingUpdate(section.id, {
                      generalQuestionCount: v,
                      scoreSettings: {
                        ...section.programmingConfig?.scoreSettings,
                        equalDistribution: v > 0 && effectiveTotal > 0 ? effectiveTotal / v : 0,
                      }
                    });
                  }}
                  min={1}
                  max={100}
                  placeholder="5"
                />
                {sectionErrors[section.id]?.progQuestionCount && (
                  <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>{sectionErrors[section.id].progQuestionCount}</p>
                )}
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: D.textMuted }}>Marks/Q <span className="text-[9px] font-normal">(auto)</span></label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatDecimal(section.programmingConfig?.scoreSettings?.equalDistribution || 0)}
                    disabled
                    readOnly
                    className="w-full px-2 py-1.5 text-xs rounded-lg border"
                    style={{ borderColor: D.border, background: D.surface, color: D.textMuted }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: D.orange }}>Auto</span>
                </div>
                {sectionErrors[section.id]?.progMarksPerQuestion && (
                  <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>{sectionErrors[section.id].progMarksPerQuestion}</p>
                )}
              </div>
              {section.programmingConfig?.generalQuestionCount > 0 && effectiveTotal > 0 && (
                <div className="col-span-2 px-2 py-1 rounded text-[10px] flex items-center gap-1.5" style={{ background: D.orange + '10', color: D.orange }}>
                  <Calculator size={10} />
                  <span>{section.programmingConfig.generalQuestionCount} × {formatDecimal(section.programmingConfig.scoreSettings?.equalDistribution || 0)} = <strong>{formatDecimal(section.programmingConfig.generalQuestionCount * (section.programmingConfig.scoreSettings?.equalDistribution || 0))}</strong> marks</span>
                </div>
              )}
            </div>
          )}

          {isLevelBased && (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-1.5">
                <div className="text-[10px] font-semibold pt-1" style={{ color: D.textMuted }}>Level</div>
                {(['easy', 'medium', 'hard'] as const).map(level => {
                  const levelColor = level === 'easy' ? D.emerald : level === 'medium' ? D.amber : D.red;
                  return (
                    <div key={level} className="text-center text-[10px] font-semibold capitalize px-1 py-0.5 rounded" style={{ background: levelColor + '12', color: levelColor }}>
                      {level}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-4 gap-1.5 items-center">
                <div className="text-[10px]" style={{ color: D.textMuted }}>Questions</div>
                {(['easy', 'medium', 'hard'] as const).map(level => {
                  const counts = section.programmingConfig?.levelBasedCounts;
                  return (
                    <div key={level}>
                      <ONumberInput
                        value={counts?.[level] || 0}
                        onChange={(v: number) => {
                          handleProgrammingUpdate(section.id, { levelBasedCounts: { ...counts, [level]: v } });
                        }}
                        min={0}
                        max={100}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </div>

              {sectionErrors[section.id]?.progLevelCounts && (
                <p className="text-[10px]" style={{ color: D.red }}>{sectionErrors[section.id].progLevelCounts}</p>
              )}

              <div className="grid grid-cols-4 gap-1.5 items-center">
                <div className="text-[10px]" style={{ color: D.textMuted }}>Score</div>
                {(['easy', 'medium', 'hard'] as const).map(level => {
                  const counts = section.programmingConfig?.levelBasedCounts;
                  const hasQ = (counts?.[level] || 0) > 0;
                  const scoring = section.programmingConfig?.levelScoring?.[level];
                  return (
                    <div key={level} style={{ opacity: !hasQ ? 0.35 : 1 }}>
                      <select
                        value={scoring?.type || 'level_specific'}
                        onChange={(e) => {
                          handleProgrammingUpdate(section.id, {
                            levelScoring: {
                              ...section.programmingConfig?.levelScoring,
                              [level]: {
                                type: e.target.value,
                                ...(e.target.value === 'level_specific'
                                  ? { marksPerQuestion: scoring?.marksPerQuestion || 0, totalMarks: undefined }
                                  : { totalMarks: scoring?.totalMarks || 0, marksPerQuestion: undefined })
                              }
                            }
                          });
                        }}
                        disabled={!hasQ}
                        className="w-full px-1 py-1 text-[10px] rounded border outline-none"
                        style={{ borderColor: D.border, background: '#fff', color: D.textMain }}
                      >
                        <option value="level_specific">Per Q - level specific</option>
                        <option value="question_specific">Question Specific</option>
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-4 gap-1.5 items-center">
                <div className="text-[10px]" style={{ color: D.textMuted }}>Marks</div>
                {(['easy', 'medium', 'hard'] as const).map(level => {
                  const counts = section.programmingConfig?.levelBasedCounts;
                  const count = counts?.[level] || 0;
                  const scoring = section.programmingConfig?.levelScoring?.[level];
                  const isQSpec = scoring?.type === 'question_specific';
                  return (
                    <div key={level} style={{ opacity: count === 0 ? 0.35 : 1, pointerEvents: count === 0 ? 'none' : 'auto' }}>
                      <ONumberInput
                        value={isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0)}
                        onChange={(v: number) => {
                          handleProgrammingUpdate(section.id, {
                            levelScoring: {
                              ...section.programmingConfig?.levelScoring,
                              [level]: { ...scoring, ...(isQSpec ? { totalMarks: v } : { marksPerQuestion: v }) }
                            }
                          });
                        }}
                        min={0}
                        step={0.5}
                        placeholder="0"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-4 gap-1.5 items-center">
                <div className="text-[10px]" style={{ color: D.textMuted }}>Total</div>
                {(['easy', 'medium', 'hard'] as const).map(level => {
                  const counts = section.programmingConfig?.levelBasedCounts;
                  const count = counts?.[level] || 0;
                  if (count === 0) return <div key={level} className="text-center text-[10px]" style={{ color: D.textMuted }}>—</div>;
                  const scoring = section.programmingConfig?.levelScoring?.[level];
                  const isQSpec = scoring?.type === 'question_specific';
                  const total = isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0) * count;
                  const levelColor = level === 'easy' ? D.emerald : level === 'medium' ? D.amber : D.red;
                  return (
                    <div key={level} className="text-center text-[10px] font-semibold py-0.5 rounded" style={{ background: levelColor + '10', color: levelColor }}>
                      {formatDecimal(total)}
                    </div>
                  );
                })}
              </div>

              {(isLevelBased || isSelectionLevel) && levelBasedTotal > 0 && (
                <div className="px-2 py-1 rounded text-[10px] flex items-center gap-1.5" style={{ background: exceedsSectionAllocated ? D.red + '10' : D.orange + '10', color: exceedsSectionAllocated ? D.red : D.orange }}>
                  <Calculator size={10} />
                  <span>Total: <strong>{formatDecimal(levelBasedTotal)}</strong> / {formatDecimal(effectiveTotal)} marks</span>
                </div>
              )}
            </div>
          )}

          {isSelectionLevel && (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: D.textMuted }}>Select Levels (max 2)</label>
                <div className="flex gap-2">
                  {(['easy', 'medium', 'hard'] as const).map(level => {
                    const counts = section.programmingConfig?.selectionLevelCounts;
                    const isSelected = (counts?.[level] || 0) > 0;
                    const levelColor = level === 'easy' ? D.emerald : level === 'medium' ? D.amber : D.red;
                    const selectedCount = Object.values(counts || {}).filter(v => v > 0).length;
                    const isDisabled = !isSelected && selectedCount >= 2;
                    return (
                      <label
                        key={level}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-semibold capitalize cursor-pointer transition-all"
                        style={{
                          borderColor: isSelected ? levelColor : D.border,
                          background: isSelected ? `${levelColor}12` : D.bg,
                          color: isSelected ? levelColor : D.textMuted,
                          opacity: isDisabled ? 0.4 : 1,
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          borderWidth: isSelected ? 1.5 : 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={(e) => {
                            const newCounts = { ...counts, [level]: e.target.checked ? 1 : 0 };
                            handleProgrammingUpdate(section.id, {
                              selectionLevelCounts: newCounts,
                              levelScoring: {
                                ...section.programmingConfig?.levelScoring,
                                [level]: e.target.checked ? { type: 'level_specific', marksPerQuestion: 0 } : undefined
                              }
                            });
                          }}
                          className="w-3 h-3 rounded"
                        />
                        {level}
                      </label>
                    );
                  })}
                </div>
                {sectionErrors[section.id]?.progSelectionLevels && (
                  <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>{sectionErrors[section.id].progSelectionLevels}</p>
                )}
              </div>

              {selectedLevels.length > 0 && (
                <div className="space-y-2 mt-1">
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `80px repeat(${selectedLevels.length}, 1fr)` }}>
                    <div className="text-[10px]" style={{ color: D.textMuted }}></div>
                    {selectedLevels.map(level => {
                      const levelColor = level === 'easy' ? D.emerald : level === 'medium' ? D.amber : D.red;
                      return (
                        <div key={level} className="text-center text-[10px] font-semibold capitalize px-1 py-0.5 rounded" style={{ background: levelColor + '12', color: levelColor }}>
                          {level}
                        </div>
                      );
                    })}
                  </div>

                  {(['Questions', 'Score', 'Marks', 'Total'] as const).map((rowLabel) => (
                    <div key={rowLabel} className="grid gap-1.5 items-center" style={{ gridTemplateColumns: `80px repeat(${selectedLevels.length}, 1fr)` }}>
                      <div className="text-[10px]" style={{ color: D.textMuted }}>{rowLabel}</div>
                      {selectedLevels.map(level => {
                        const counts = section.programmingConfig?.selectionLevelCounts;
                        const count = counts?.[level] || 0;
                        const scoring = section.programmingConfig?.levelScoring?.[level];
                        const isQSpec = scoring?.type === 'question_specific';
                        const levelColor = level === 'easy' ? D.emerald : level === 'medium' ? D.amber : D.red;

                        if (rowLabel === 'Questions') {
                          return (
                            <div key={level}>
                              <ONumberInput
                                value={count}
                                onChange={(v: number) => {
                                  handleProgrammingUpdate(section.id, { selectionLevelCounts: { ...counts, [level]: v } });
                                }}
                                min={1}
                                max={50}
                                placeholder="0"
                              />
                            </div>
                          );
                        }
                        if (rowLabel === 'Score') {
                          return (
                            <div key={level}>
                              <select
                                value={scoring?.type || 'level_specific'}
                                onChange={(e) => {
                                  handleProgrammingUpdate(section.id, {
                                    levelScoring: {
                                      ...section.programmingConfig?.levelScoring,
                                      [level]: {
                                        type: e.target.value,
                                        ...(e.target.value === 'level_specific'
                                          ? { marksPerQuestion: scoring?.marksPerQuestion || 0, totalMarks: undefined }
                                          : { totalMarks: scoring?.totalMarks || 0, marksPerQuestion: undefined })
                                      }
                                    }
                                  });
                                }}
                                className="w-full px-1 py-1 text-[10px] rounded border outline-none"
                                style={{ borderColor: D.border, background: '#fff', color: D.textMain }}
                              >
                                <option value="level_specific">Per Q - level specific</option>
                                <option value="question_specific">Question Specific</option>
                              </select>
                            </div>
                          );
                        }
                        if (rowLabel === 'Marks') {
                          return (
                            <div key={level}>
                              <ONumberInput
                                value={isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0)}
                                onChange={(v: number) => {
                                  handleProgrammingUpdate(section.id, {
                                    levelScoring: {
                                      ...section.programmingConfig?.levelScoring,
                                      [level]: { ...scoring, ...(isQSpec ? { totalMarks: v } : { marksPerQuestion: v }) }
                                    }
                                  });
                                }}
                                min={0}
                                step={0.5}
                                placeholder="0"
                              />
                            </div>
                          );
                        }
                        if (rowLabel === 'Total') {
                          const total = isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0) * count;
                          return (
                            <div key={level} className="text-center text-[10px] font-semibold py-0.5 rounded" style={{ background: levelColor + '10', color: levelColor }}>
                              {formatDecimal(total)}
                            </div>
                          );
                        }
                        return null;
                      })}
                    </div>
                  ))}

                  {levelBasedTotal > 0 && (
                    <div className="px-2 py-1 rounded text-[10px] flex items-center gap-1.5" style={{ background: exceedsSectionAllocated ? D.red + '10' : D.orange + '10', color: exceedsSectionAllocated ? D.red : D.orange }}>
                      <Calculator size={10} />
                      <span>Total: <strong>{formatDecimal(levelBasedTotal)}</strong> / {formatDecimal(effectiveTotal)} marks</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
<div className="mt-3">
            <label className="text-[10px] font-semibold uppercase tracking-wide mb-1 block" style={{ color: D.textMuted }}>Question Flow</label>
            <div className="flex gap-2">
              {questionFlowOptions.map((opt: any) => {
                const isSelected = section.programmingConfig?.questionFlow === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleProgrammingUpdate(section.id, { questionFlow: opt.value })}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border"
                    style={{
                      borderColor: isSelected ? D.orange : D.border,
                      background: isSelected ? D.orange + '12' : D.bg,
                      color: isSelected ? D.orange : D.textMuted,
                      borderWidth: isSelected ? 1.5 : 1
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {sectionErrors[section.id]?.progQuestionFlow && (
              <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>{sectionErrors[section.id].progQuestionFlow}</p>
            )}
          </div>
          <div className="mt-3 pt-2 border-t" style={{ borderColor: D.border }}>
            <OToggle
              enabled={section.programmingConfig?.attemptLimitEnabled || false}
              onChange={(v: boolean) => {
                handleProgrammingUpdate(section.id, {
                  attemptLimitEnabled: v,
                  submissionAttempts: v ? (section.programmingConfig?.submissionAttempts || 1) : 1
                });
              }}
              label="Attempt Limit"
              description="Restrict submission attempts"
            />
            {section.programmingConfig?.attemptLimitEnabled && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-[10px] font-semibold" style={{ color: D.textMuted }}>Attempts</label>
                <div className="w-20">
                  <ONumberInput
                    value={section.programmingConfig?.submissionAttempts || 1}
                    onChange={(v: number) => {
                      handleProgrammingUpdate(section.id, { submissionAttempts: Math.max(1, Math.min(10, v)) });
                    }}
                    min={1}
                    max={10}
                  />
                </div>
                {sectionErrors[section.id]?.progAttempts && (
                  <p className="text-[10px]" style={{ color: D.red }}>{sectionErrors[section.id].progAttempts}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Combined Configuration Component
const renderCombinedConfig = (section: Section) => {
  const mcqMarks = section.mcqSectionMarks ?? 0;
  const progMarks = section.programmingSectionMarks ?? 0;
  const combinedTotal = mcqMarks + progMarks;

  const sectionAllocatedMarks = initialSections.find(s => s.name === section.name)?.totalMarks || 0;

  const isOver = sectionAllocatedMarks > 0 && combinedTotal > sectionAllocatedMarks;
  const isMatch = sectionAllocatedMarks > 0 && Math.abs(combinedTotal - sectionAllocatedMarks) < 0.01;

  // ── Only show sub-config tabs when outer split exactly matches ──
  const showSubConfig = isMatch;

  return (
    <div className="space-y-4 mt-4">

      {/* ── Outer split inputs: MCQ marks + Programming marks ── */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="p-3 rounded-lg border"
          style={{ background: (D.blue || '#185FA5') + '08', borderColor: (D.blue || '#185FA5') + '30' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <List size={14} style={{ color: D.blue || '#185FA5' }} />
            <span className="text-xs font-semibold" style={{ color: D.textMain }}>MCQ marks</span>
            <span style={{ color: D.red }}>*</span>
          </div>
          <ONumberInput
            value={mcqMarks}
            onChange={(v: number) => updateSection(section.id, 'mcqSectionMarks', v)}
            min={0}
            max={sectionAllocatedMarks}
            step={0.5}
            placeholder="e.g. 25"
          />
          {activeErrors?.combinedMCQMarks && (
            <div
              className="mt-1 p-1.5 rounded text-xs flex items-start gap-1"
              style={{ background: D.red + '10', color: D.red }}
            >
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{activeErrors.combinedMCQMarks}</span>
            </div>
          )}
          <p className="text-[10px] mt-1" style={{ color: D.textMuted }}>
            Marks allocated for MCQ questions
          </p>
        </div>

        <div
          className="p-3 rounded-lg border"
          style={{ background: D.orange + '08', borderColor: D.orange + '30' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} style={{ color: D.orange }} />
            <span className="text-xs font-semibold" style={{ color: D.textMain }}>Programming marks</span>
            <span style={{ color: D.red }}>*</span>
          </div>
          <ONumberInput
            value={progMarks}
            onChange={(v: number) => updateSection(section.id, 'programmingSectionMarks', v)}
            min={0}
            max={sectionAllocatedMarks}
            step={0.5}
            placeholder="e.g. 25"
          />
          {activeErrors?.combinedProgMarks && (
            <div
              className="mt-1 p-1.5 rounded text-xs flex items-start gap-1"
              style={{ background: D.red + '10', color: D.red }}
            >
              <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
              <span>{activeErrors.combinedProgMarks}</span>
            </div>
          )}
          <p className="text-[10px] mt-1" style={{ color: D.textMuted }}>
            Marks allocated for programming questions
          </p>
        </div>
      </div>

      {/* ── Running total row ── */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
        style={{
          background: isMatch
            ? D.emerald + '12'
            : isOver
              ? D.red + '12'
              : D.surface,
          border: `0.5px solid ${isMatch ? D.emerald + '40' : isOver ? D.red + '40' : D.border}`,
          color: isMatch ? D.emerald : isOver ? D.red : D.textMuted,
        }}
      >
        <Calculator size={13} />
        <span>
          MCQ <strong>{formatDecimal(mcqMarks)}</strong> + Programming{' '}
          <strong>{formatDecimal(progMarks)}</strong> ={' '}
          <strong>{formatDecimal(combinedTotal)}</strong>
          {sectionAllocatedMarks > 0 && (
            <span> / {formatDecimal(sectionAllocatedMarks)} allocated</span>
          )}
        </span>
        {isMatch && <Check size={13} className="ml-auto" />}
        {isOver && <AlertCircle size={13} className="ml-auto" />}
      </div>

      {/* ── GATE: Only show sub-config after outer split matches exactly ── */}
      {!showSubConfig ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed"
          style={{ borderColor: D.border, background: D.surface }}
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: D.amber + '15' }}
          >
            <AlertTriangle size={20} style={{ color: D.amber }} />
          </div>
          <p className="text-xs font-bold" style={{ color: D.textMain }}>
            MCQ + Programming must equal {formatDecimal(sectionAllocatedMarks)} marks
          </p>
          <p className="text-[11px] text-center px-6" style={{ color: D.textMuted }}>
            {combinedTotal === 0
              ? `Enter MCQ marks and Programming marks above. They must add up to ${formatDecimal(sectionAllocatedMarks)}.`
              : `Current total is ${formatDecimal(combinedTotal)}. Adjust the values above to match ${formatDecimal(sectionAllocatedMarks)}.`
            }
          </p>
          {combinedTotal > 0 && sectionAllocatedMarks > 0 && (
            <div
              className="mt-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
              style={{
                background: isOver ? D.red + '12' : D.orange + '12',
                color: isOver ? D.red : D.orange,
              }}
            >
              {isOver
                ? `Over by ${formatDecimal(combinedTotal - sectionAllocatedMarks)} marks`
                : `Short by ${formatDecimal(sectionAllocatedMarks - combinedTotal)} marks`
              }
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── Sub-config tabs (only visible when outer split = allocated) ── */}
          <div
            className="flex items-center gap-0 border-b"
            style={{ borderColor: D.border }}
          >
            <button
              type="button"
              onClick={() => setCombinedConfigTab('mcq')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px"
              style={{
                borderBottomColor: combinedConfigTab === 'mcq' ? D.orange : 'transparent',
                color: combinedConfigTab === 'mcq' ? D.orange : D.textMuted,
              }}
            >
              <List size={11} />
              MCQ config
            </button>
            <button
              type="button"
              onClick={() => setCombinedConfigTab('programming')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px"
              style={{
                borderBottomColor: combinedConfigTab === 'programming' ? D.orange : 'transparent',
                color: combinedConfigTab === 'programming' ? D.orange : D.textMuted,
              }}
            >
              <Terminal size={11} />
              Programming config
            </button>
          </div>

          {(activeErrors?.combinedMCQConfig || activeErrors?.combinedProgConfig) && (
            <div
              className="p-2 rounded-lg text-xs"
              style={{ background: D.red + '10', color: D.red }}
            >
              <AlertCircle size={12} className="inline mr-1" />
              {activeErrors?.combinedMCQConfig || activeErrors?.combinedProgConfig}
            </div>
          )}

          <div className="pt-3">
            {combinedConfigTab === 'mcq'
              ? renderMCQConfig(section, mcqMarks)
              : renderProgrammingConfig(section, progMarks)
            }
          </div>
        </>
      )}
    </div>
  );
};

  const renderExerciseConfiguration = (section: Section) => {
    const sectionAllocatedMarks = initialSections.find(s => s.name === section.name)?.totalMarks || 0;

    switch (section.exerciseType) {
      case 'MCQ':
        return renderMCQConfig(section, sectionAllocatedMarks);
      case 'Programming':
        return renderProgrammingConfig(section, sectionAllocatedMarks);
      case 'Combined':
        return renderCombinedConfig(section);
      case 'Other':
        return (
          <div className="mt-4 p-4 rounded-lg" style={{ background: D.textMuted + '08', border: `1px solid ${D.textMuted}20` }}>
            <p className="text-sm" style={{ color: D.textMain }}>
              Other exercise type - No additional configuration required.
            </p>
            <p className="text-xs mt-2" style={{ color: D.textMuted }}>
              You can add questions manually in the next step.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <Layers size={16} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold leading-tight" style={{ color: D.textMain }}>Section Configuration</h2>
            <p className="text-xs mt-0.5" style={{ color: D.textMuted }}>Organize the exercise into sections with their own questions and marks.</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: D.orange }}>{sortedSections.length}</div>
            <div className="text-[9px]" style={{ color: D.textMuted }}>Sections</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: configuredCount === sortedSections.length ? D.emerald : D.amber }}>
              {configuredCount}/{sortedSections.length}
            </div>
            <div className="text-[9px]" style={{ color: D.textMuted }}>Ready</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold" style={{ color: D.orange }}>{totalQuestions}</div>
            <div className="text-[9px]" style={{ color: D.textMuted }}>Questions</div>
          </div>
        </div>
      </div>

      {!isTotalMarksSet && (
        <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: D.amber + '15', borderLeft: `3px solid ${D.amber}` }}>
          <AlertTriangle size={16} style={{ color: D.amber }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: D.amber }}>Total Marks Not Set</p>
            <p className="text-[10px] mt-0.5" style={{ color: D.textMuted }}>
              Please go to Exercise Details and set the total marks before configuring sections.
            </p>
          </div>
        </div>
      )}


      <div className="border-b" style={{ borderColor: D.border }}>
        <div className="flex flex-wrap items-center gap-1">
          {sortedSections.map((section) => {
            const status = getSectionValidationStatus(section.id);
            const isActive = activeTabId === section.id;

            let statusIcon = null;
            if (status === 'error') {
              statusIcon = <AlertCircle size={12} style={{ color: D.red }} />;
            } else if (status === 'valid') {
              statusIcon = <Check size={12} style={{ color: D.emerald }} />;
            } else if (status === 'partial') {
              statusIcon = <AlertTriangle size={12} style={{ color: D.amber }} />;
            } else {
              statusIcon = <div className="w-2 h-2 rounded-full" style={{ background: D.textMuted }} />;
            }

            const allocatedForSection = initialSections.find(s => s.name === section.name)?.totalMarks ?? section.totalMarks;
            const exceedsTotal = totalAvailableMarks > 0 && allocatedForSection > totalAvailableMarks;

            return (
              <button
                key={section.id}
                onClick={() => setActiveTabId(section.id)}
                className="relative group flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all"
                style={{
                  color: isActive ? D.orange : D.textMuted,
                  borderBottom: isActive ? `2px solid ${D.orange}` : 'none',
                  background: isActive ? `${D.orangeLight}` : 'transparent'
                }}
              >
         {statusIcon}
                <span className="max-w-[150px] truncate">
                  {section.name || `Section ${section.sectionNumber}`}
                </span>
                {exceedsTotal && (
                  <span className="ml-1 text-[8px] font-bold bg-red-100 text-red-600 px-1 rounded">OVER</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
{activeSection ? (
  <div className="" style={{ borderColor: D.border, background: '#fff' }}>
    {/* REMOVED the duplicate header section */}
    
    <div className="space-y-3">
     <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: D.textMuted }}>
            Exercise Type <span style={{ color: D.red }}>*</span>
          </label>
          {(() => {
            const allocatedMarks = initialSections.find(s => s.name === activeSection.name)?.totalMarks ?? activeSection.totalMarks;
            return allocatedMarks > 0 ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: D.blue + '10', color: D.blue }}>
                Total: {formatDecimal(allocatedMarks)} marks
              </span>
            ) : null;
          })()}
        </div>
        <div className="flex gap-1.5">
          {exerciseTypeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateSection(activeSection.id, 'exerciseType', opt.value as any)}
              className="flex-1 px-2 py-1.5 rounded text-[10px] font-semibold transition-all border"
              style={{
                borderColor: activeSection.exerciseType === opt.value ? opt.color : D.border,
                background: activeSection.exerciseType === opt.value ? `${opt.color}10` : D.bg,
                color: activeSection.exerciseType === opt.value ? opt.color : D.textMuted,
                borderWidth: activeSection.exerciseType === opt.value ? 1.5 : 1
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {activeErrors?.exerciseType && (
          <p className="mt-1 text-[10px]" style={{ color: D.red }}>{activeErrors.exerciseType}</p>
        )}
      </div>

      {activeSection.exerciseType && isTotalMarksSet && renderExerciseConfiguration(activeSection)}

      {activeSection.exerciseType && !isTotalMarksSet && (
        <div className="p-2 rounded text-center text-[10px]" style={{ background: D.amber + '10', color: D.amber }}>
          ⚠️ Set total marks in Exercise Details to enable configuration
        </div>
      )}

      {!activeSection.exerciseType && (
        <div className="p-2 rounded text-center text-[10px]" style={{ background: D.blue + '08', color: D.textMuted }}>
          Select an exercise type above to configure this section
        </div>
      )}

      {activeErrors && Object.keys(activeErrors).length > 0 && (
        <div className="p-2 rounded space-y-1" style={{ background: D.red + '08', borderLeft: `2px solid ${D.red}` }}>
          {Object.entries(activeErrors).map(([key, error]) => (
            <div key={key} className="flex items-start gap-1.5 text-[10px]" style={{ color: D.red }}>
              <AlertCircle size={11} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {activeWarnings && Object.keys(activeWarnings).length > 0 && (
        <div className="p-2 rounded space-y-1" style={{ background: D.amber + '08' }}>
          {Object.entries(activeWarnings).map(([key, warning]) => (
            <div key={key} className="flex items-start gap-1.5 text-[10px]" style={{ color: D.amber }}>
              <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
) : (
  <div className="text-center py-8 rounded-lg border-2 border-dashed" style={{ borderColor: D.border }}>
    <Layers size={32} style={{ color: D.textMuted, margin: '0 auto 8px', opacity: 0.4 }} />
    <p className="text-xs" style={{ color: D.textMuted }}>No sections available</p>
  </div>
)}
      {sortedSections.length > 0 && (
        <div className="pt-4 border-t" style={{ borderColor: D.border }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calculator size={14} style={{ color: D.textMuted }} />
              <span className="text-xs" style={{ color: D.textMuted }}>
                {configuredCount} of {sortedSections.length} sections configured
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs" style={{ color: D.textMuted }}>Total Allocated: </span>
              <span className="text-base font-bold" style={{ color: isTotalMarksSet && !isMarksMatch ? D.red : D.orange }}>
                {formatDecimal(totalSectionMarks)}
              </span>
              {isTotalMarksSet && (
                <span className="text-xs ml-1" style={{ color: D.textMuted }}>/ {formatDecimal(totalAvailableMarks)} marks</span>
              )}
            </div>
          </div>

          <div className="mt-2 w-full h-1.5 rounded-full overflow-hidden" style={{ background: D.border }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${isTotalMarksSet ? Math.min(100, (totalSectionMarks / totalAvailableMarks) * 100) : 0}%`,
                background: isTotalMarksSet && isMarksMatch ? D.emerald : isTotalMarksSet && totalSectionMarks > totalAvailableMarks ? D.red : D.orange
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

SectionConfigurationStep.displayName = 'SectionConfigurationStep';