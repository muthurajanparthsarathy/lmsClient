// validators/sectionValidator.ts

import { formatDecimal } from "./constants";


export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

export interface MarksValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

// ============================================
// CORE VALIDATION FUNCTIONS
// ============================================

export const validateNumberField = (
  value: number,
  fieldName: string,
  min: number = 1,
  max: number = Infinity,
  required: boolean = true
): string | null => {
  if (required && (value === undefined || value === null)) {
    return `${fieldName} is required`;
  }
  if (value === undefined || value === null) return null;
  
  if (isNaN(value)) {
    return `${fieldName} must be a valid number`;
  }
  if (value < min) {
    return `${fieldName} must be at least ${min}`;
  }
  if (value > max) {
    return `${fieldName} cannot exceed ${max}`;
  }
  if (!Number.isInteger(value) && fieldName.includes('Question')) {
    return `${fieldName} must be a whole number`;
  }
  if (value % 0.5 !== 0 && fieldName.includes('Marks')) {
    return `${fieldName} can be in increments of 0.5 marks`;
  }
  return null;
};

export const validateSectionName = (
  name: string,
  existingNames: string[],
  currentId?: string
): string | null => {
  const trimmedName = name?.trim();
  
  if (!trimmedName) {
    return 'Section name is required';
  }
  if (trimmedName.length < 2) {
    return 'Section name must be at least 2 characters';
  }
  if (trimmedName.length > 100) {
    return 'Section name cannot exceed 100 characters';
  }
  
  // Allow alphanumeric, spaces, hyphens, underscores, dots, commas, parentheses, ampersands
  const validPattern = /^[a-zA-Z0-9\s\-_.,()&]+$/;
  if (!validPattern.test(trimmedName)) {
    return 'Use only letters, numbers, spaces, and basic punctuation (. , - _ & () )';
  }
  
  // Check for duplicates
  const duplicateCheck = existingNames.filter((n, idx) => 
    n?.toLowerCase() === trimmedName.toLowerCase() && 
    (!currentId || idx.toString() !== currentId)
  );
  if (duplicateCheck.length > 0) {
    return 'Section name must be unique across all sections';
  }
  
  return null;
};

export const validateExerciseType = (type: string): string | null => {
  const validTypes = ['MCQ', 'Programming', 'Combined', 'Other'];
  if (!type) {
    return 'Exercise type is required';
  }
  if (!validTypes.includes(type)) {
    return `Invalid exercise type. Must be: ${validTypes.join(', ')}`;
  }
  return null;
};

// ============================================
// MCQ CONFIGURATION VALIDATION
// ============================================

export const validateMCQConfig = (
  config: any,
  sectionId: string,
  totalMarks?: number,
  availableMarks?: number
): Record<string, string> => {
  const errors: Record<string, string> = {};
  
  if (!config) {
    errors.mcqConfig = 'MCQ configuration is required';
    return errors;
  }
  
  // Question count validation
  const qCount = config.generalQuestionCount;
  if (qCount === undefined || qCount === null) {
    errors.mcqQuestionCount = 'Number of questions is required';
  } else {
    const qCountError = validateNumberField(qCount, 'Questions', 1, 200, true);
    if (qCountError) errors.mcqQuestionCount = qCountError;
  }
  
  // Score settings validation
  if (!config.scoreSettings) {
    errors.mcqScoreSettings = 'Score settings are required';
  } else {
    const validScoreTypes = ['equalDistribution', 'questionSpecific'];
    if (!config.scoreSettings.scoreType) {
      errors.mcqScoreType = 'Score type is required';
    } else if (!validScoreTypes.includes(config.scoreSettings.scoreType)) {
      errors.mcqScoreType = `Invalid score type. Must be: ${validScoreTypes.join(', ')}`;
    }
    
    // Equal distribution marks validation
    if (config.scoreSettings.scoreType === 'equalDistribution') {
      const marksPerQ = config.scoreSettings.equalDistribution;
      if (marksPerQ === undefined || marksPerQ === null) {
        errors.mcqMarksPerQuestion = 'Marks per question is required';
      } else {
        const marksError = validateNumberField(marksPerQ, 'Marks per question', 0.5, 100, true);
        if (marksError) errors.mcqMarksPerQuestion = marksError;
        
        // Check if marks × questions exceeds available marks
        const qCount_num = config.generalQuestionCount || 0;
        const calculatedTotal = qCount_num * marksPerQ;
        if (availableMarks && calculatedTotal > availableMarks) {
          errors.mcqTotalExceed = `Total marks (${formatDecimal(calculatedTotal)}) exceeds available (${formatDecimal(availableMarks)})`;
        }
      }
    }
  }
  
  // Attempt limit validation
  if (config.attemptLimitEnabled) {
    const attempts = config.submissionAttempts;
    if (attempts === undefined || attempts === null) {
      errors.mcqAttempts = 'Submission attempts is required';
    } else {
      const attemptsError = validateNumberField(attempts, 'Submission attempts', 1, 10, true);
      if (attemptsError) errors.mcqAttempts = attemptsError;
    }
  }
  
  return errors;
};

// ============================================
// PROGRAMMING CONFIGURATION VALIDATION
// ============================================

export const validateProgrammingConfig = (
  config: any,
  sectionId: string,
  totalMarks?: number,
  availableMarks?: number
): Record<string, string> => {
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
  
  // ===== GENERAL CONFIG VALIDATION =====
  if (config.questionConfigType === 'general') {
    const qCount = config.generalQuestionCount;
    if (qCount === undefined || qCount === null) {
      errors.progQuestionCount = 'Number of questions is required';
    } else {
      const qCountError = validateNumberField(qCount, 'Questions', 1, 100, true);
      if (qCountError) errors.progQuestionCount = qCountError;
    }
    
    const marksPerQ = config.scoreSettings?.equalDistribution;
    if (marksPerQ === undefined || marksPerQ === null) {
      errors.progMarksPerQuestion = 'Marks per question is required';
    } else {
      const marksError = validateNumberField(marksPerQ, 'Marks per question', 0.5, 100, true);
      if (marksError) errors.progMarksPerQuestion = marksError;
      
      // Check total marks
      const qCount_num = config.generalQuestionCount || 0;
      const calculatedTotal = qCount_num * marksPerQ;
      if (availableMarks && calculatedTotal > availableMarks) {
        errors.progTotalExceed = `Total marks (${formatDecimal(calculatedTotal)}) exceeds available (${formatDecimal(availableMarks)})`;
      }
    }
  }
  
  // ===== LEVEL BASED CONFIG VALIDATION =====
  if (config.questionConfigType === 'levelBased') {
    const counts = config.levelBasedCounts || { easy: 0, medium: 0, hard: 0 };
    const totalQuestions = (counts.easy || 0) + (counts.medium || 0) + (counts.hard || 0);
    
    if (totalQuestions <= 0) {
      errors.progLevelCounts = 'At least one question across difficulty levels is required';
    }
    if (totalQuestions > 100) {
      errors.progLevelCounts = 'Maximum 100 questions across all difficulty levels';
    }
    
    // Validate each active level
    const levels = ['easy', 'medium', 'hard'] as const;
    let totalCalculatedMarks = 0;
    
    for (const level of levels) {
      const count = counts[level];
      if (count > 0) {
        const scoring = config.levelScoring?.[level];
        
        if (!scoring) {
          errors[`progScoring${level}`] = `Scoring configuration required for ${level} questions`;
          continue;
        }
        
        if (!scoring.type) {
          errors[`progScoringType${level}`] = `Score type required for ${level} questions`;
        } else if (!['level_specific', 'question_specific'].includes(scoring.type)) {
          errors[`progScoringType${level}`] = `Invalid score type for ${level}`;
        }
        
        if (scoring.type === 'level_specific') {
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
            errors[`progTotalMarks${level}`] = `Total marks required for ${level} questions`;
          } else if (total > 500) {
            errors[`progTotalMarks${level}`] = `Total marks for ${level} cannot exceed 500`;
          } else {
            totalCalculatedMarks += total;
          }
        }
      }
    }
    
    // Check total marks against available
    if (availableMarks && totalCalculatedMarks > availableMarks) {
      errors.progLevelTotalExceed = `Total marks (${formatDecimal(totalCalculatedMarks)}) exceeds available (${formatDecimal(availableMarks)})`;
    }
  }
  
  // ===== SELECTION LEVEL CONFIG VALIDATION =====
  if (config.questionConfigType === 'selectionLevel') {
    const counts = config.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
    const enabledLevels = Object.entries(counts).filter(([_, count]) => Number(count) > 0).length;
    
    if (enabledLevels === 0) {
      errors.progSelectionLevels = 'At least one difficulty level must be selected';
    }
    if (enabledLevels > 2) {
      errors.progSelectionLevels = 'Maximum 2 difficulty levels can be selected';
    }
    
    // Validate selected levels
    const levels = ['easy', 'medium', 'hard'] as const;
    let totalCalculatedMarks = 0;
    
    for (const level of levels) {
      const count = counts[level];
      if (count > 0) {
        if (count < 1) {
          errors[`progSelectedCount${level}`] = `At least 1 question required for ${level}`;
        }
        if (count > 50) {
          errors[`progSelectedCount${level}`] = `Maximum 50 questions for ${level}`;
        }
        
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
    
    // Check total marks against available
    if (availableMarks && totalCalculatedMarks > availableMarks) {
      errors.progSelectionTotalExceed = `Total marks (${formatDecimal(totalCalculatedMarks)}) exceeds available (${formatDecimal(availableMarks)})`;
    }
  }
  
  // ===== COMMON VALIDATIONS =====
  const validFlows = ['freeFlow', 'controlled'];
  if (!config.questionFlow) {
    errors.progQuestionFlow = 'Question flow is required';
  } else if (!validFlows.includes(config.questionFlow)) {
    errors.progQuestionFlow = `Invalid question flow. Must be: ${validFlows.join(', ')}`;
  }
  
  // Attempt limit validation
  if (config.attemptLimitEnabled) {
    const attempts = config.submissionAttempts;
    if (attempts === undefined || attempts === null) {
      errors.progAttempts = 'Submission attempts is required';
    } else {
      const attemptsError = validateNumberField(attempts, 'Submission attempts', 1, 10, true);
      if (attemptsError) errors.progAttempts = attemptsError;
    }
  }
  
  return errors;
};

// ============================================
// SECTION TOTAL MARKS VALIDATION
// ============================================

export const validateSectionTotals = (
  section: any,
  totalAvailableMarks: number
): MarksValidationResult => {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  
  const sectionMarks = section.totalMarks || 0;
  
  if (sectionMarks <= 0) {
    errors.totalMarks = 'Section total marks must be greater than 0';
  } else if (sectionMarks < 1) {
    errors.totalMarks = 'Minimum section marks is 1';
  }
  
  if (totalAvailableMarks > 0) {
    if (sectionMarks > totalAvailableMarks) {
      errors.totalMarks = `Section total (${formatDecimal(sectionMarks)}) exceeds available marks (${formatDecimal(totalAvailableMarks)})`;
    } else if (sectionMarks === totalAvailableMarks && Object.keys(errors).length === 0) {
      warnings.totalMarks = `Section uses 100% of total marks`;
    } else if (sectionMarks > totalAvailableMarks * 0.8) {
      warnings.totalMarks = `Section uses ${formatDecimal((sectionMarks / totalAvailableMarks) * 100)}% of total marks`;
    }
  }
  
  return { isValid: Object.keys(errors).length === 0, errors, warnings };
};

// ============================================
// COMPLETE SECTION VALIDATION
// ============================================

export const validateSectionConfiguration = (
  section: any,
  totalAvailableMarks: number,
  existingSectionNames: string[]
): ValidationResult => {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};
  
  // Validate name
  const nameError = validateSectionName(
    section.name,
    existingSectionNames.filter(n => n !== section.name),
    section.id
  );
  if (nameError) errors.name = nameError;
  
  // Validate exercise type
  const typeError = validateExerciseType(section.exerciseType);
  if (typeError) errors.exerciseType = typeError;
  
  // Validate totals
  const { errors: totalErrors, warnings: totalWarnings } = validateSectionTotals(
    section,
    totalAvailableMarks
  );
  Object.assign(errors, totalErrors);
  Object.assign(warnings, totalWarnings);
  
  // Validate based on exercise type
  if (section.exerciseType === 'MCQ') {
    const mcqErrors = validateMCQConfig(
      section.mcqConfig,
      section.id,
      section.totalMarks,
      totalAvailableMarks
    );
    Object.assign(errors, mcqErrors);
  } 
  else if (section.exerciseType === 'Programming') {
    const progErrors = validateProgrammingConfig(
      section.programmingConfig,
      section.id,
      section.totalMarks,
      totalAvailableMarks
    );
    Object.assign(errors, progErrors);
  } 
  else if (section.exerciseType === 'Combined') {
    // Validate MCQ part
    if (!section.mcqConfig) {
      errors.combinedMCQConfig = 'MCQ configuration is required';
    } else {
      const mcqErrors = validateMCQConfig(
        section.mcqConfig,
        section.id,
        section.totalMarks,
        totalAvailableMarks
      );
      Object.assign(errors, mcqErrors);
    }
    
    // Validate Programming part
    if (!section.programmingConfig) {
      errors.combinedProgConfig = 'Programming configuration is required';
    } else {
      const progErrors = validateProgrammingConfig(
        section.programmingConfig,
        section.id,
        section.totalMarks,
        totalAvailableMarks
      );
      Object.assign(errors, progErrors);
    }
  } 
  else if (section.exerciseType === 'Other') {
    if (!section.totalMarks || section.totalMarks <= 0) {
      errors.otherMarks = 'Total marks is required for Other exercise type';
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    warnings
  };
};

// ============================================
// GLOBAL SECTIONS VALIDATION
// ============================================

export const validateAllSections = (
  sections: Record<string, any>,
  totalAvailableMarks: number
): { isValid: boolean; errors: string[]; warnings: string[]; sectionErrors: Record<string, Record<string, string>> } => {
  const globalErrors: string[] = [];
  const globalWarnings: string[] = [];
  const sectionErrors: Record<string, Record<string, string>> = {};
  const sectionNames = Object.values(sections).map(s => s.name);
  
  let totalAllocatedMarks = 0;
  let configuredSectionsCount = 0;
  
  // Validate each section
  for (const [id, section] of Object.entries(sections)) {
    const result = validateSectionConfiguration(section, totalAvailableMarks, sectionNames);
    
    if (Object.keys(result.errors).length > 0) {
      sectionErrors[id] = result.errors;
    }
    
    if (section.exerciseType && section.totalMarks > 0) {
      configuredSectionsCount++;
      totalAllocatedMarks += section.totalMarks;
    }
  }
  
  // Global validations
  if (totalAvailableMarks > 0) {
    if (Math.abs(totalAllocatedMarks - totalAvailableMarks) > 0.01) {
      if (totalAllocatedMarks > totalAvailableMarks) {
        globalErrors.push(
          `Total allocated marks (${formatDecimal(totalAllocatedMarks)}) exceed exercise total (${formatDecimal(totalAvailableMarks)}) by ${formatDecimal(Math.abs(totalAllocatedMarks - totalAvailableMarks))} marks`
        );
      } else {
        globalErrors.push(
          `Total allocated marks (${formatDecimal(totalAllocatedMarks)}) are less than exercise total (${formatDecimal(totalAvailableMarks)}) by ${formatDecimal(Math.abs(totalAllocatedMarks - totalAvailableMarks))} marks`
        );
      }
    } else if (totalAllocatedMarks === totalAvailableMarks) {
      globalWarnings.push(`Perfect! Total marks match exactly: ${formatDecimal(totalAllocatedMarks)} marks`);
    }
  }
  
  if (configuredSectionsCount === 0 && Object.keys(sections).length > 0 && totalAvailableMarks > 0) {
    globalErrors.push('At least one section must be fully configured');
  }
  
  return {
    isValid: globalErrors.length === 0 && Object.keys(sectionErrors).length === 0,
    errors: globalErrors,
    warnings: globalWarnings,
    sectionErrors
  };
};

// ============================================
// REAL-TIME CALCULATION UTILITIES
// ============================================

export const calculateSectionTotal = (section: any): number => {
  if (!section?.exerciseType) return 0;
  
  switch (section.exerciseType) {
    case 'MCQ': {
      const config = section.mcqConfig;
      if (!config) return 0;
      
      if (config.scoreSettings?.scoreType === 'equalDistribution') {
        return (config.generalQuestionCount || 0) * (config.scoreSettings?.equalDistribution || 0);
      }
      return section.totalMarks || 0;
    }
    
    case 'Programming': {
      const config = section.programmingConfig;
      if (!config) return 0;
      
      if (config.questionConfigType === 'general') {
        return (config.generalQuestionCount || 0) * (config.scoreSettings?.equalDistribution || 0);
      }
      
      if (config.questionConfigType === 'levelBased') {
        let total = 0;
        const counts = config.levelBasedCounts || {};
        const scoring = config.levelScoring || {};
        
        if (counts.easy > 0 && scoring.easy) {
          total += scoring.easy.type === 'level_specific'
            ? counts.easy * (scoring.easy.marksPerQuestion || 0)
            : (scoring.easy.totalMarks || 0);
        }
        if (counts.medium > 0 && scoring.medium) {
          total += scoring.medium.type === 'level_specific'
            ? counts.medium * (scoring.medium.marksPerQuestion || 0)
            : (scoring.medium.totalMarks || 0);
        }
        if (counts.hard > 0 && scoring.hard) {
          total += scoring.hard.type === 'level_specific'
            ? counts.hard * (scoring.hard.marksPerQuestion || 0)
            : (scoring.hard.totalMarks || 0);
        }
        return total;
      }
      
      if (config.questionConfigType === 'selectionLevel') {
        let total = 0;
        const counts = config.selectionLevelCounts || {};
        const scoring = config.levelScoring || {};
        
        if (counts.easy > 0 && scoring.easy) {
          total += scoring.easy.type === 'level_specific'
            ? counts.easy * (scoring.easy.marksPerQuestion || 0)
            : (scoring.easy.totalMarks || 0);
        }
        if (counts.medium > 0 && scoring.medium) {
          total += scoring.medium.type === 'level_specific'
            ? counts.medium * (scoring.medium.marksPerQuestion || 0)
            : (scoring.medium.totalMarks || 0);
        }
        if (counts.hard > 0 && scoring.hard) {
          total += scoring.hard.type === 'level_specific'
            ? counts.hard * (scoring.hard.marksPerQuestion || 0)
            : (scoring.hard.totalMarks || 0);
        }
        return total;
      }
      
      return section.totalMarks || 0;
    }
    
    case 'Combined': {
      let total = 0;
      // Add MCQ total
      if (section.mcqConfig?.scoreSettings?.scoreType === 'equalDistribution') {
        total += (section.mcqConfig.generalQuestionCount || 0) * (section.mcqConfig.scoreSettings?.equalDistribution || 0);
      }
      // Add Programming total
      if (section.programmingConfig?.questionConfigType === 'general') {
        total += (section.programmingConfig.generalQuestionCount || 0) * (section.programmingConfig.scoreSettings?.equalDistribution || 0);
      }
      return total > 0 ? total : section.totalMarks || 0;
    }
    
    default:
      return section.totalMarks || 0;
  }
};