import { ExercisePayload } from '@/app/lms/component/ExerciseSettings';
import axios from 'axios';

const BASE_URL = 'https://lmsserver-yeve.onrender.com';

export type EntityType = 'modules' | 'submodules' | 'topics' | 'subtopics';

export interface HierarchyData {
  courseName: string;
  moduleName: string;
  submoduleName: string;
  topicName: string;
  subtopicName: string;
  nodeType: EntityType;
  level: number;
}

export interface LevelCounts {
  easy: number;
  medium: number;
  hard: number;
}

// ============ SCORE SETTINGS INTERFACES ============
export interface MCQScoreSettings {
  totalMcqQuestions: number;
  marksPerQuestion: number
  mcqTotalMarks: number;
}

export interface ProgrammingScoreSettings {
  scoreType: 'evenMarks' | 'separateMarks' | 'levelBasedMarks';
  evenMarks: number;
  separateMarks: {
    general: number[];
    levelBased: {
      easy: number[];
      medium: number[];
      hard: number[];
    };
  };
  levelBasedMarks: {
    easy: number;
    medium: number;
    hard: number;
  };
  totalMarks: number;
}

// ============ CONFIGURATION INTERFACES ============
export interface MCQConfig {
  questionConfigType: 'general';
  generalQuestionCount: number;
  scoreSettings: MCQScoreSettings;
  attemptLimitEnabled: boolean;
  submissionAttempts: number;
}

export interface ProgrammingConfig {
  questionConfigType: 'general' | 'levelBased' | 'selectionLevel';
  generalQuestionCount?: number;
  levelBasedCounts?: LevelCounts;
  selectionLevelCounts?: LevelCounts;
  scoreSettings: ProgrammingScoreSettings;
  questionFlow: 'freeFlow' | 'controlled';
  attemptLimitEnabled: boolean;
  submissionAttempts: number;
}

export interface QuestionConfiguration {
  mcqConfig?: MCQConfig;
  programmingConfig?: ProgrammingConfig;
}

// ============ OTHER INTERFACES ============
export interface AvailabilityPeriod {
  startDate: string;
  endDate: string;
  gracePeriodEnabled: boolean;
  gracePeriodDate?: string;
}

export interface NotificationSettings {
  notifyUsers: boolean;
  notifyGmail: boolean;
  notifyWhatsApp: boolean;
  gradeSheet: boolean;
}

export interface NotificationGradeSettings {
  notifyUsers: boolean;
  notifyGmail: boolean;
  notifyWhatsApp: boolean;
  gradeSheet: boolean;
}

export interface ExerciseInformation {
  exerciseId: string;
  exerciseName: string;
  description: string;
  exerciseLevel: 'beginner' | 'intermediate' | 'expert';
  totalDuration: number;
}

export interface ProgrammingSettings {
  selectedModule: string;
  selectedLanguages: string[];
}

// ============ BACKEND PAYLOAD INTERFACE ============
// This is what the backend expects
export interface APIExercisePayload {
  configurationType: 'manual';
  tabType: "I_Do" | "We_Do" | "You_Do";
  subcategory: string;
  exerciseType: 'MCQ' | 'Programming' | 'Combined';
  programmingSettings?: ProgrammingSettings;
  exerciseInformation: ExerciseInformation;
  questionConfiguration?: {
    levelType?: 'general' | 'levelBased';
    general?: number;
    levelBased?: LevelCounts;
    questionFlow?: 'freeFlow' | 'controlled';
    attemptLimitEnabled?: boolean;
    submissionAttempts?: number;
    // Combined exercise specific
    mcqCount?: number;
    mcqAttemptLimitEnabled?: boolean;
    mcqSubmissionAttempts?: number;
    mcqScoreSettings?: MCQScoreSettings;
    programmingScoreSettings?: ProgrammingScoreSettings;
  };
  availabilityPeriod: AvailabilityPeriod;
  notificationGradeSettings: NotificationGradeSettings;
  // No separate scoreSettings at top level - all score settings are inside questionConfiguration
}

// ============ UI PAYLOAD INTERFACE ============
// This is what the UI sends (matches ExerciseSettings component)
export interface UIExercisePayload {
  configurationType: 'manual';
  tabType: "I_Do" | "We_Do" | "You_Do";
  subcategory: string;
  exerciseType: 'MCQ' | 'Programming' | 'Combined';
  programmingSettings?: ProgrammingSettings;
  exerciseInformation: ExerciseInformation;
  questionConfiguration?: QuestionConfiguration;
  availabilityPeriod: AvailabilityPeriod;
  notificationSettings: NotificationSettings; // UI sends notificationSettings
}

export interface ExerciseResponse {
  message: Array<{ key: string; value: string }>;
  data: {
    exercise: any;
    subcategory: string;
    section: string;
    entityType: EntityType;
    entityId: string;
    totalExercises: number;
  };
}


export const modelMap: Record<EntityType, { path: string }> = {
  modules: { path: 'modules' },
  submodules: { path: 'submodules' },
  topics: { path: 'topics' },
  subtopics: { path: 'subtopics' }
};

const getEntityPath = (entityType: EntityType): string => {
  const entity = modelMap[entityType];
  if (!entity) {
    console.error('Invalid entity type:', entityType);
    throw new Error(`Invalid entity type: ${entityType}`);
  }
  return entity.path;
};

export const exerciseApi = {

  // 1. ADD EXERCISE (Already updated)

  addExercise: async (
    entityType: EntityType,
    entityId: string,
    exerciseData: ExercisePayload
  ): Promise<ExerciseResponse> => {
    try {
      console.log('📥 Received exercise data from UI:', exerciseData);

      // Build the payload according to backend expectations
      const payload: any = {
        tabType: exerciseData.tabType,
        subcategory: exerciseData.subcategory,
        exerciseType: exerciseData.exerciseType,
        configurationType: {
          mcqMode: exerciseData.exerciseType === 'MCQ',
          programmingMode: exerciseData.exerciseType === 'Programming',
          combinedMode: exerciseData.exerciseType === 'Combined',
          otherMode: exerciseData.exerciseType === 'Other',
        },
        exerciseInformation: {
          exerciseId: exerciseData.exerciseInformation.exerciseId || `EX${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          exerciseName: exerciseData.exerciseInformation.exerciseName,
          description: exerciseData.exerciseInformation.description || '',
          exerciseLevel: exerciseData.exerciseInformation.exerciseLevel || 'beginner',
          totalDuration: exerciseData.exerciseInformation.totalDuration || 60,
          totalMarks: exerciseData.exerciseInformation.totalMarks,
        },
        availabilityPeriod: {
          startDate: exerciseData.availabilityPeriod.startDate,
          endDate: exerciseData.availabilityPeriod.endDate,  // ← Always include endDate
          dueDate: exerciseData.availabilityPeriod.endDate,  // ← Keep dueDate for backward compatibility
          dueDateEnabled: true,
          cutoffEnabled: !!(exerciseData.availabilityPeriod as any).cutoffEnabled,
          cutOffDate: (exerciseData.availabilityPeriod as any).cutoffEnabled
            ? ((exerciseData.availabilityPeriod as any).cutOffDate || null)
            : null,
          remindGradeByEnabled: !!(exerciseData.availabilityPeriod as any).remindGradeByEnabled,
          remindGradeBy: (exerciseData.availabilityPeriod as any).remindGradeByEnabled
            ? ((exerciseData.availabilityPeriod as any).remindGradeBy || null)
            : null,
          gracePeriodEnabled: exerciseData.availabilityPeriod.gracePeriodEnabled || false,
          gracePeriodAllowed: exerciseData.availabilityPeriod.gracePeriodEnabled || false,
          gracePeriodDate: exerciseData.availabilityPeriod.gracePeriodDate || null,
          extendedDays: (exerciseData.availabilityPeriod as any).extendedDays || 0,
        }, notificationSettings: {
          notifyUsers: exerciseData.notificationSettings?.notifyUsers || false,
          notifyGmail: exerciseData.notificationSettings?.notifyGmail || false,
          notifyWhatsApp: exerciseData.notificationSettings?.notifyWhatsApp || false,
          gradeSheet: exerciseData.notificationSettings?.gradeSheet || true
        },

        // ADD THIS:
        gradeSettings: {
          mcqGrade: (exerciseData as any).gradeSettings?.mcqGrade || null,
          mcqGradeToPass: (exerciseData as any).gradeSettings?.mcqGradeToPass
            ? Number((exerciseData as any).gradeSettings.mcqGradeToPass)
            : null,
          programmingGrade: (exerciseData as any).gradeSettings?.programmingGrade || null,
          programmingGradeToPass: (exerciseData as any).gradeSettings?.programmingGradeToPass
            ? Number((exerciseData as any).gradeSettings.programmingGradeToPass)
            : null,
          combinedGrade: (exerciseData as any).gradeSettings?.combinedGrade || null,
          combinedGradeToPass: (exerciseData as any).gradeSettings?.combinedGradeToPass
            ? Number((exerciseData as any).gradeSettings.combinedGradeToPass)
            : null,

          separateMarks: (exerciseData as any).gradeSettings?.separateMarks ?? false,
          // NEW difficulty pass fields:
          difficultyPassEnabled: (exerciseData as any).gradeSettings?.difficultyPassEnabled ?? false,
          easyPassMark: (exerciseData as any).gradeSettings?.easyPassMark ?? null,
          mediumPassMark: (exerciseData as any).gradeSettings?.mediumPassMark ?? null,
          hardPassMark: (exerciseData as any).gradeSettings?.hardPassMark ?? null,

        },
        additionalOptions: {
          anonymousSubmissions: (exerciseData as any).additionalOptions?.anonymousSubmissions ?? false,
          hideGraderIdentity: (exerciseData as any).additionalOptions?.hideGraderIdentity ?? false,
        },
        questions: []
      };

      // Add programming settings if applicable
      if (exerciseData.exerciseType === 'Programming' || exerciseData.exerciseType === 'Combined') {
        payload.programmingSettings = {
          selectedModule: exerciseData.programmingSettings?.selectedModule || '',
          selectedLanguages: exerciseData.programmingSettings?.selectedLanguages || []
        };
      }

      // Initialize questionConfiguration
      payload.questionConfiguration = {};

      // ============ HANDLE MCQ CONFIGURATION ============
      if (exerciseData.exerciseType === 'MCQ' && exerciseData.questionConfiguration?.mcqConfig) {
        const mcqConfig = exerciseData.questionConfiguration.mcqConfig;
        const scoreType = mcqConfig.scoreSettings?.scoreType || 'equalDistribution';
        let marksPerQuestion = 0;
        let mcqTotalMarks = 0;

        if (scoreType === 'equalDistribution') {
          marksPerQuestion = mcqConfig.scoreSettings?.equalDistribution || 0;
          mcqTotalMarks = (mcqConfig.generalQuestionCount || 0) * marksPerQuestion;
        } else {
          // Question Specific mode - use the totalMarks from frontend
          marksPerQuestion = 0;
          mcqTotalMarks = mcqConfig.scoreSettings?.totalMarks || 0;
        }

        payload.questionConfiguration.mcqConfig = {
          questionConfigType: 'general',
          generalQuestionCount: mcqConfig.generalQuestionCount || 0,
          scoreSettings: {
            scoreType: scoreType,
            equalDistribution: marksPerQuestion,
            totalMarks: mcqTotalMarks
          },
          mcqTotalMarks: mcqTotalMarks,
          marksPerQuestion: marksPerQuestion,
          totalMcqQuestions: mcqConfig.generalQuestionCount || 0,
          attemptLimitEnabled: mcqConfig.attemptLimitEnabled || false,
          submissionAttempts: mcqConfig.submissionAttempts || 1,
          scoringType: scoreType,
          shuffleQuestions: true
        };

        // ✅ Set total marks for MCQ mode
      }

      // ============ HANDLE PROGRAMMING CONFIGURATION ============
      else if (exerciseData.exerciseType === 'Programming' && exerciseData.questionConfiguration?.programmingConfig) {
        const progConfig = exerciseData.questionConfiguration.programmingConfig;

        // Map frontend terminology to backend terminology
        let backendQuestionConfigType;
        switch (progConfig.questionConfigType) {
          case 'levelBased':
            backendQuestionConfigType = 'levelBased';
            break;
          case 'selectionLevel':
            backendQuestionConfigType = 'selectionLevel';
            break;
          default:
            backendQuestionConfigType = progConfig.questionConfigType;
        }

        // Calculate total marks for Programming mode
        let progTotalMarks = 0;

        if (progConfig.questionConfigType === 'general') {
          if (progConfig.scoreSettings?.scoreType === 'equalDistribution') {
            progTotalMarks = (progConfig.generalQuestionCount || 0) * (progConfig.scoreSettings.equalDistribution || 0);
          }
        } else if (progConfig.questionConfigType === 'levelBased' || progConfig.questionConfigType === 'selectionLevel') {
          const counts = progConfig.questionConfigType === 'selectionLevel'
            ? progConfig.selectionLevelCounts
            : progConfig.levelBasedCounts;

          const levelScoring = progConfig.scoreSettings?.levelScoringConfiguration;

          (['easy', 'medium', 'hard']).forEach(level => {
            const count = counts[level] || 0;
            if (count === 0) return;

            const scoring = levelScoring[level];
            if (scoring) {
              if (scoring.type === 'level_specific' && scoring.marksPerQuestion) {
                progTotalMarks += count * scoring.marksPerQuestion;
              } else if (scoring.type === 'question_specific' && scoring.totalMarks) {
                progTotalMarks += scoring.totalMarks;
              }
            }
          });
        }

        // Process level scoring configuration if present
        const levelScoringConfig = progConfig.scoreSettings?.levelScoringConfiguration;

        // Map frontend score type to backend score type
        let backendScoreType;
        if (progConfig.questionConfigType === 'levelBased' || progConfig.questionConfigType === 'selectionLevel') {
          backendScoreType = 'levelBasedMarks';
        } else {
          switch (progConfig.scoreSettings?.scoreType) {
            case 'equalDistribution':
              backendScoreType = 'evenMarks';
              break;
            case 'questionSpecific':
              backendScoreType = 'separateMarks';
              break;
            case 'levelSpecific':
              backendScoreType = 'levelBasedMarks';
              break;
            default:
              backendScoreType = progConfig.scoreSettings?.scoreType;
          }
        }

        // Process scoring based on approach
        let levelBasedMarks = { easy: 0, medium: 0, hard: 0 };
        let separateMarks = {
          general: [],
          levelBased: { easy: [], medium: [], hard: [] }
        };
        let evenMarks = 0;

        if (progConfig.questionConfigType === 'general') {
          // General configuration
          if (progConfig.scoreSettings?.scoreType === 'equalDistribution') {
            evenMarks = progConfig.scoreSettings.equalDistribution || 0;
          } else if (progConfig.scoreSettings?.scoreType === 'questionSpecific') {
            separateMarks.general = progConfig.scoreSettings.questionSpecific.general || [];
          }
        } else if (progConfig.questionConfigType === 'levelBased' || progConfig.questionConfigType === 'selectionLevel') {
          // Level-based configuration with new scoring approach
          const counts = progConfig.questionConfigType === 'selectionLevel'
            ? progConfig.selectionLevelCounts
            : progConfig.levelBasedCounts;

          if (levelScoringConfig) {
            // Calculate based on new scoring configuration
            (['easy', 'medium', 'hard']).forEach(level => {
              const count = counts[level] || 0;
              const scoring = levelScoringConfig[level];

              if (scoring?.type === 'level_specific' && scoring.marksPerQuestion) {
                levelBasedMarks[level] = scoring.marksPerQuestion;
                // Calculate totalMarks for each level
                const levelTotal = count * scoring.marksPerQuestion;
                levelScoringConfig[level].totalMarks = levelTotal;
              } else if (scoring?.type === 'question_specific' && scoring.totalMarks) {
                // For question-specific, totalMarks is already provided
                levelBasedMarks[level] = count > 0 ? scoring.totalMarks / count : 0;
              }
            });
          } else {
            // Fallback to old levelBasedMarks calculation
            levelBasedMarks = progConfig.scoreSettings?.levelBasedMarks || { easy: 0, medium: 0, hard: 0 };
          }
        }

        // Backend expects programmingConfig object
        const programmingConfig: any = {
          questionConfigType: backendQuestionConfigType || 'general',
          scoreSettings: {
            scoreType: backendScoreType || 'evenMarks',
            evenMarks: evenMarks,
            separateMarks: separateMarks,
            levelBasedMarks: levelBasedMarks,
            levelScoringConfiguration: levelScoringConfig,
            totalMarks: progTotalMarks
          },
          questionFlow: progConfig.questionFlow || 'freeFlow',
          attemptLimitEnabled: progConfig.attemptLimitEnabled || false,
          submissionAttempts: progConfig.submissionAttempts || 1,
          allowCodeExecution: true,
          enableTestCases: true,
          showSampleCases: true
        };

        // Add counts based on configuration type
        if (progConfig.questionConfigType === 'general') {
          programmingConfig.generalQuestionCount = progConfig.generalQuestionCount || 0;
          programmingConfig.generalMarksPerQuestion = progConfig.scoreSettings?.equalDistribution || 0;
        } else if (progConfig.questionConfigType === 'levelBased') {
          programmingConfig.levelBasedCounts = progConfig.levelBasedCounts || { easy: 0, medium: 0, hard: 0 };
        } else if (progConfig.questionConfigType === 'selectionLevel') {
          programmingConfig.selectionLevelCounts = progConfig.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
        }

        payload.questionConfiguration.programmingConfig = programmingConfig;

        // ✅ Set total marks for Programming mode
      }

      // ============ HANDLE COMBINED CONFIGURATION ============
      else if (exerciseData.exerciseType === 'Combined' && exerciseData.questionConfiguration) {
        const combinedConfig = exerciseData.questionConfiguration;

        // Calculate MCQ total marks
        let mcqTotalMarks = 0;
        if (combinedConfig.mcqConfig) {
          const mcqConfig = combinedConfig.mcqConfig;
          const scoreType = mcqConfig.scoreSettings?.scoreType || 'equalDistribution';
          let marksPerQuestion = 0;

          if (scoreType === 'equalDistribution') {
            marksPerQuestion = mcqConfig.scoreSettings?.equalDistribution || 0;
            mcqTotalMarks = (mcqConfig.generalQuestionCount || 0) * marksPerQuestion;
          } else {
            marksPerQuestion = 0;
            mcqTotalMarks = mcqConfig.scoreSettings?.totalMarks || 0;
          }

          payload.questionConfiguration.mcqConfig = {
            questionConfigType: 'general',
            generalQuestionCount: mcqConfig.generalQuestionCount || 0,
            scoreSettings: {
              scoreType: scoreType,
              equalDistribution: mcqConfig.scoreSettings?.equalDistribution || 0,
              totalMarks: mcqTotalMarks
            },
            mcqTotalMarks: mcqTotalMarks,
            marksPerQuestion: marksPerQuestion,
            totalMcqQuestions: mcqConfig.generalQuestionCount || 0,
            attemptLimitEnabled: mcqConfig.attemptLimitEnabled || false,
            submissionAttempts: mcqConfig.submissionAttempts || 1,
            scoringType: scoreType,
            shuffleQuestions: true
          };
        }

        // Calculate Programming total marks
        let progTotalMarks = 0;
        if (combinedConfig.programmingConfig) {
          const progConfig = combinedConfig.programmingConfig;

          // Map frontend terminology to backend terminology
          let backendQuestionConfigType;
          switch (progConfig.questionConfigType) {
            case 'levelBased':
              backendQuestionConfigType = 'levelBased';
              break;
            case 'selectionLevel':
              backendQuestionConfigType = 'selectionLevel';
              break;
            default:
              backendQuestionConfigType = progConfig.questionConfigType;
          }

          // Calculate total marks
          if (progConfig.questionConfigType === 'general') {
            if (progConfig.scoreSettings?.scoreType === 'equalDistribution') {
              progTotalMarks = (progConfig.generalQuestionCount || 0) * (progConfig.scoreSettings.equalDistribution || 0);
            }
          } else if (progConfig.questionConfigType === 'levelBased' || progConfig.questionConfigType === 'selectionLevel') {
            const counts = progConfig.questionConfigType === 'selectionLevel'
              ? progConfig.selectionLevelCounts
              : progConfig.levelBasedCounts;

            const levelScoring = progConfig.scoreSettings?.levelScoringConfiguration;

            (['easy', 'medium', 'hard']).forEach(level => {
              const count = counts[level] || 0;
              if (count === 0) return;

              const scoring = levelScoring[level];
              if (scoring) {
                if (scoring.type === 'level_specific' && scoring.marksPerQuestion) {
                  progTotalMarks += count * scoring.marksPerQuestion;
                } else if (scoring.type === 'question_specific' && scoring.totalMarks) {
                  progTotalMarks += scoring.totalMarks;
                }
              }
            });
          }

          // Process level scoring configuration
          const levelScoringConfig = progConfig.scoreSettings?.levelScoringConfiguration;

          // Map score type
          let backendScoreType;
          if (progConfig.questionConfigType === 'levelBased' || progConfig.questionConfigType === 'selectionLevel') {
            backendScoreType = 'levelBasedMarks';
          } else {
            switch (progConfig.scoreSettings?.scoreType) {
              case 'equalDistribution':
                backendScoreType = 'evenMarks';
                break;
              case 'questionSpecific':
                backendScoreType = 'separateMarks';
                break;
              case 'levelSpecific':
                backendScoreType = 'levelBasedMarks';
                break;
              default:
                backendScoreType = progConfig.scoreSettings?.scoreType;
            }
          }

          let levelBasedMarks = { easy: 0, medium: 0, hard: 0 };
          let separateMarks = {
            general: [],
            levelBased: { easy: [], medium: [], hard: [] }
          };
          let evenMarks = 0;

          if (progConfig.questionConfigType === 'general') {
            if (progConfig.scoreSettings?.scoreType === 'equalDistribution') {
              evenMarks = progConfig.scoreSettings.equalDistribution || 0;
            } else if (progConfig.scoreSettings?.scoreType === 'questionSpecific') {
              separateMarks.general = progConfig.scoreSettings.questionSpecific.general || [];
            }
          } else if (progConfig.questionConfigType === 'levelBased' || progConfig.questionConfigType === 'selectionLevel') {
            const counts = progConfig.questionConfigType === 'selectionLevel'
              ? progConfig.selectionLevelCounts
              : progConfig.levelBasedCounts;

            if (levelScoringConfig) {
              (['easy', 'medium', 'hard']).forEach(level => {
                const count = counts[level] || 0;
                const scoring = levelScoringConfig[level];

                if (scoring?.type === 'level_specific' && scoring.marksPerQuestion) {
                  levelBasedMarks[level] = scoring.marksPerQuestion;
                  const levelTotal = count * scoring.marksPerQuestion;
                  levelScoringConfig[level].totalMarks = levelTotal;
                } else if (scoring?.type === 'question_specific' && scoring.totalMarks) {
                  levelBasedMarks[level] = count > 0 ? scoring.totalMarks / count : 0;
                }
              });
            } else {
              levelBasedMarks = progConfig.scoreSettings?.levelBasedMarks || { easy: 0, medium: 0, hard: 0 };
            }
          }

          const programmingConfig: any = {
            questionConfigType: backendQuestionConfigType || 'general',
            scoreSettings: {
              scoreType: backendScoreType || 'evenMarks',
              evenMarks: evenMarks,
              separateMarks: separateMarks,
              levelBasedMarks: levelBasedMarks,
              levelScoringConfiguration: levelScoringConfig,
              totalMarks: progTotalMarks
            },
            questionFlow: progConfig.questionFlow || 'freeFlow',
            attemptLimitEnabled: progConfig.attemptLimitEnabled || false,
            submissionAttempts: progConfig.submissionAttempts || 1,
            allowCodeExecution: true,
            enableTestCases: true,
            showSampleCases: true
          };

          if (progConfig.questionConfigType === 'general') {
            programmingConfig.generalQuestionCount = progConfig.generalQuestionCount || 0;
            programmingConfig.generalMarksPerQuestion = progConfig.scoreSettings?.equalDistribution || 0;
          } else if (progConfig.questionConfigType === 'levelBased') {
            programmingConfig.levelBasedCounts = progConfig.levelBasedCounts || { easy: 0, medium: 0, hard: 0 };
          } else if (progConfig.questionConfigType === 'selectionLevel') {
            programmingConfig.selectionLevelCounts = progConfig.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
          }

          payload.questionConfiguration.programmingConfig = programmingConfig;
        }

        // ✅ Set total marks for Combined mode (MCQ + Programming)
      }

      // ============ HANDLE OTHERS CONFIGURATION ============
      else if (exerciseData.exerciseType === 'Other') {
        const othersConfig = (exerciseData.questionConfiguration as any)?.othersQuestionConfiguration;
        if (othersConfig) {
          payload.questionConfiguration.othersQuestionConfiguration = othersConfig;
        }
      }

      // Debug log to verify payload structure
      console.log('🔍 Programming config in payload:', payload.questionConfiguration?.programmingConfig);
      console.log('🌐 Transformed payload for backend:', JSON.stringify(payload, null, 2));
      console.log('✅ Total Marks being sent:', payload.exerciseInformation.totalMarks);

      const entityPath = getEntityPath(entityType);
      const url = `${BASE_URL}/exercise/add/${entityPath}/${entityId}`;
      const token = localStorage.getItem("smartcliff_token");

      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const response = await axios.put(
        url,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
          },
          timeout: 30000,
        }
      );

      console.log('✅ Exercise added successfully:', response.data);
      return response.data;

    } catch (error: any) {
      console.error('❌ Error adding exercise:', error);

      if (error.response) {
        console.error('❌ Server response:', error.response.data);
        console.error('❌ Server status:', error.response.status);

        if (error.response.data?.message) {
          console.error('❌ Error messages:', error.response.data.message);
        }

        throw new Error(
          `Server error (${error.response.status}): ${typeof error.response.data === 'object'
            ? JSON.stringify(error.response.data)
            : error.response.data
          }`
        );
      } else if (error.request) {
        throw new Error('No response received from server. Please check your connection.');
      } else {
        throw error;
      }
    }
  },



  
youDoAddExercise: async (
  entityType: EntityType,
  entityId: string,
  exerciseData: any
): Promise<ExerciseResponse> => {
  try {
    console.log('📥 Received exercise data from UI:', exerciseData);

    // The payload from CreateAssessmentModal already has the correct structure
    // for the backend controller. We just need to ensure it's formatted properly.
    
    const payload = { ...exerciseData };
    
    // Ensure tabType is set correctly
    if (!payload.tabType) {
      payload.tabType = 'You_Do';
    }

    // Ensure subcategory is set
    if (!payload.subcategory && exerciseData.subcategory) {
      payload.subcategory = exerciseData.subcategory;
    }

    // Parse dates if they're objects with day/month/year
    const formatDate = (dateObj: any) => {
      if (!dateObj) return null;
      if (typeof dateObj === 'string') return dateObj;
      if (dateObj.year && dateObj.month && dateObj.day) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${dateObj.year}-${pad(dateObj.month)}-${pad(dateObj.day)}T${pad(dateObj.hour || 0)}:${pad(dateObj.minute || 0)}`;
      }
      return null;
    };

    // Format dates in availabilityPeriod if they exist as objects
    if (payload.availabilityPeriod) {
      if (payload.availabilityPeriod.startDate && typeof payload.availabilityPeriod.startDate === 'object') {
        payload.availabilityPeriod.startDate = formatDate(payload.availabilityPeriod.startDate);
      }
      if (payload.availabilityPeriod.endDate && typeof payload.availabilityPeriod.endDate === 'object') {
        payload.availabilityPeriod.endDate = formatDate(payload.availabilityPeriod.endDate);
      }
      if (payload.availabilityPeriod.cutOffDate && typeof payload.availabilityPeriod.cutOffDate === 'object') {
        payload.availabilityPeriod.cutOffDate = formatDate(payload.availabilityPeriod.cutOffDate);
      }
      if (payload.availabilityPeriod.gracePeriodDate && typeof payload.availabilityPeriod.gracePeriodDate === 'object') {
        payload.availabilityPeriod.gracePeriodDate = formatDate(payload.availabilityPeriod.gracePeriodDate);
      }
    }

    // Debug log to verify payload structure
    console.log('🌐 Transformed payload for backend:', JSON.stringify(payload, null, 2));

    const entityPath = getEntityPath(entityType);
    const url = `${BASE_URL}/you-do/exercise/add/${entityPath}/${entityId}`;
    const token = localStorage.getItem("smartcliff_token");

    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await axios.put(
      url,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000,
      }
    );

    console.log('✅ Exercise added successfully:', response.data);
    return response.data;

  } catch (error: any) {
    console.error('❌ Error adding exercise:', error);

    if (error.response) {
      console.error('❌ Server response:', error.response.data);
      console.error('❌ Server status:', error.response.status);

      if (error.response.data?.message) {
        console.error('❌ Error messages:', error.response.data.message);
      }

      throw new Error(
        `Server error (${error.response.status}): ${typeof error.response.data === 'object'
          ? JSON.stringify(error.response.data)
          : error.response.data
        }`
      );
    } else if (error.request) {
      throw new Error('No response received from server. Please check your connection.');
    } else {
      throw error;
    }
  }
},
// 5. UPDATE YOU DO EXERCISE (New function for you-do update endpoint)
updateYouDoExercise: async (
  entityType: EntityType,
  entityId: string,
  exerciseId: string,
  exerciseData: any
): Promise<any> => {
  try {
    console.log('🔄 Updating YouDo exercise:', {
      entityType,
      entityId,
      exerciseId,
      data: exerciseData
    });

    // The payload already contains all the necessary fields including:
    // - isSectionBased
    // - sections
    // - sectionConfigs
    // - securitySettings
    // - testType
    // etc.
    const payload = { ...exerciseData };

    // Ensure required fields are present
    if (!payload.tabType) {
      payload.tabType = 'You_Do';
    }

    // Format dates if they're objects with day/month/year
    const formatDate = (dateObj: any) => {
      if (!dateObj) return null;
      if (typeof dateObj === 'string') return dateObj;
      if (dateObj.year && dateObj.month && dateObj.day) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${dateObj.year}-${pad(dateObj.month)}-${pad(dateObj.day)}T${pad(dateObj.hour || 0)}:${pad(dateObj.minute || 0)}`;
      }
      return null;
    };

    // Format dates in availabilityPeriod if they exist as objects
    if (payload.availabilityPeriod) {
      if (payload.availabilityPeriod.startDate && typeof payload.availabilityPeriod.startDate === 'object') {
        payload.availabilityPeriod.startDate = formatDate(payload.availabilityPeriod.startDate);
      }
      if (payload.availabilityPeriod.endDate && typeof payload.availabilityPeriod.endDate === 'object') {
        payload.availabilityPeriod.endDate = formatDate(payload.availabilityPeriod.endDate);
      }
      if (payload.availabilityPeriod.cutOffDate && typeof payload.availabilityPeriod.cutOffDate === 'object') {
        payload.availabilityPeriod.cutOffDate = formatDate(payload.availabilityPeriod.cutOffDate);
      }
      if (payload.availabilityPeriod.gracePeriodDate && typeof payload.availabilityPeriod.gracePeriodDate === 'object') {
        payload.availabilityPeriod.gracePeriodDate = formatDate(payload.availabilityPeriod.gracePeriodDate);
      }
    }

    // Format sectionConfigs if needed (ensure it's an object)
    if (payload.sectionConfigs && typeof payload.sectionConfigs !== 'object') {
      try {
        payload.sectionConfigs = JSON.parse(payload.sectionConfigs);
      } catch (e) {
        console.warn('Failed to parse sectionConfigs:', e);
      }
    }

    // Ensure sections is an array
    if (payload.sections && !Array.isArray(payload.sections)) {
      try {
        payload.sections = JSON.parse(payload.sections);
      } catch (e) {
        payload.sections = [];
      }
    }

    console.log('🌐 Transformed YouDo update payload:', JSON.stringify(payload, null, 2));

    const entityPath = getEntityPath(entityType);
    const url = `${BASE_URL}/you-do/exercise/update/${entityPath}/${entityId}/${exerciseId}`;
    const token = localStorage.getItem("smartcliff_token");

    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await axios.put(
      url,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000,
      }
    );

    console.log('✅ YouDo exercise updated successfully:', response.data);
    return response.data;

  } catch (error: any) {
    console.error('❌ Error updating YouDo exercise:', {
      entityType,
      entityId,
      exerciseId,
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    if (error.response) {
      throw new Error(
        `Server error (${error.response.status}): ${JSON.stringify(error.response.data)}`
      );
    } else if (error.request) {
      throw new Error('No response received from server. Please check your connection.');
    } else {
      throw error;
    }
  }
},

// 8. GET YOU DO EXERCISES (Fetch exercises for Assessment component)
getYouDoExercises: async (
  entityType: EntityType,
  entityId: string,
  tabType: 'I_Do' | 'We_Do' | 'You_Do' = 'You_Do',
  subcategory: string,
  // Resources by Batch. Passed explicitly by the caller that owns the batch
  // strip so the request matches the cache key it was made under; omitted
  // elsewhere, where the axios interceptor still supplies the module value.
  batchId?: string
): Promise<any> => {
  try {
    console.log('📋 Fetching YouDo exercises:', {
      entityType,
      entityId,
      tabType,
      subcategory,
      batchId
    });

    const entityPath = getEntityPath(entityType);
    const url =
      `${BASE_URL}/you-do/exercise/getAll/${entityPath}/${entityId}?tabType=${tabType}&subcategory=${subcategory}` +
      (batchId ? `&batchId=${encodeURIComponent(batchId)}` : '');
    const token = localStorage.getItem("smartcliff_token");

    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const response = await axios.get(
      url,
      {
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000,
      }
    );

    console.log('✅ YouDo exercises fetched successfully:', response.data);
    return response.data;

  } catch (error: any) {
    console.error('❌ Error fetching YouDo exercises:', {
      entityType,
      entityId,
      tabType,
      subcategory,
      error: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    if (error.response) {
      throw new Error(
        `Server error (${error.response.status}): ${JSON.stringify(error.response.data)}`
      );
    } else if (error.request) {
      throw new Error('No response received from server. Please check your connection.');
    } else {
      throw error;
    }
  }
},
  // 2. GET EXERCISES (Updated)
  getExercises: async (
    entityType: EntityType,
    entityId: string,
    section: 'I_Do' | 'We_Do' | 'You_Do' = 'We_Do',
    subcategory?: string,
    // Question-Bank-style optional pagination. Passing `page` switches the
    // endpoint into paginated mode: the server applies the list's filters +
    // newest-first sort and returns ONE slice plus pager totals under
    // `data.pagination`. Without `page` the response is the original full
    // exercises[] array, unchanged — every existing caller keeps working.
    opts?: {
      page?: number;
      limit?: number;
      search?: string;
      exerciseType?: string;
      status?: string;
    }
  ): Promise<ExerciseResponse> => {
    try {
      const params = new URLSearchParams();
      params.append('section', section);
      if (subcategory) params.append('subcategory', subcategory);
      if (opts?.page !== undefined) {
        params.append('page', String(opts.page));
        if (opts.limit !== undefined) params.append('limit', String(opts.limit));
        if (opts.search) params.append('search', opts.search);
        if (opts.exerciseType) params.append('exerciseType', opts.exerciseType);
        if (opts.status) params.append('status', opts.status);
      }

      const entityPath = getEntityPath(entityType);
      const url = `${BASE_URL}/exercise/get/${entityPath}/${entityId}?${params.toString()}`;

      console.log('🔗 Fetching exercises:', {
        url,
        entityType,
        entityId,
        section,
        subcategory
      });

      const token = localStorage.getItem("smartcliff_token");
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const response = await axios.get(
        url,
        {
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
          },
          timeout: 30000,
        }
      );

      console.log('✅ Exercises fetched successfully:', {
        totalExercises: response.data?.data?.totalExercises || 0,
        exercisesCount: response.data?.data?.exercises?.length || 0
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching exercises:', {
        entityType,
        entityId,
        section,
        subcategory,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 401:
            throw new Error('Authentication failed. Please log in again.');
          case 403:
            throw new Error('You do not have permission to access these exercises.');
          case 404:
            throw new Error(`No exercises found for ${entityType} with ID: ${entityId}`);
          default:
            throw new Error(
              `Failed to fetch exercises (${status}): ${typeof data === 'object' ? JSON.stringify(data) : data
              }`
            );
        }
      } else if (error.request) {
        throw new Error('No response received from server. Please check your network connection.');
      } else {
        throw error;
      }
    }
  },

  // 3. GET EXERCISE BY ID (New)
  getExerciseById: async (exerciseId: string): Promise<any> => {
    try {
      const url = `${BASE_URL}/exercise/${exerciseId}`;

      console.log('🔍 Fetching exercise by ID:', {
        exerciseId,
        url
      });

      const token = localStorage.getItem("smartcliff_token");
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const response = await axios.get(url, {
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000,
      });

      console.log('✅ Exercise fetched by ID:', {
        exerciseId: response.data?.data?.exercise?.exerciseId,
        name: response.data?.data?.exercise?.exerciseName
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching exercise by ID:', error);

      if (error.response?.status === 404) {
        throw new Error(`Exercise with ID ${exerciseId} not found`);
      }
      throw error;
    }
  },

  // 4. UPDATE EXERCISE (Fixed to match backend expectations)
  updateExercise: async (
    entityType: EntityType,
    entityId: string,
    exerciseId: string,
    exerciseData: ExercisePayload
  ): Promise<any> => {
    try {
      console.log('🔄 Updating exercise:', {
        entityType,
        entityId,
        exerciseId,
        data: exerciseData
      });

      const payload: any = {
        tabType: exerciseData.tabType,
        subcategory: exerciseData.subcategory,
        exerciseType: exerciseData.exerciseType,
        configurationType: {
          mcqMode: exerciseData.exerciseType === 'MCQ',
          programmingMode: exerciseData.exerciseType === 'Programming',
          combinedMode: exerciseData.exerciseType === 'Combined',
          otherMode: exerciseData.exerciseType === 'Other',
        },
        exerciseInformation: {
          exerciseId: exerciseData.exerciseInformation.exerciseId || `EX${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
          exerciseName: exerciseData.exerciseInformation.exerciseName,
          description: exerciseData.exerciseInformation.description || '',
          exerciseLevel: exerciseData.exerciseInformation.exerciseLevel || 'beginner',
          totalDuration: exerciseData.exerciseInformation.totalDuration || 60,
          totalMarks: exerciseData.exerciseInformation.totalMarks,
        },
        availabilityPeriod: {
          startDate: exerciseData.availabilityPeriod.startDate,
          endDate: exerciseData.availabilityPeriod.endDate,
          dueDate: exerciseData.availabilityPeriod.endDate,
          dueDateEnabled: true,
          cutoffEnabled: !!(exerciseData.availabilityPeriod as any).cutoffEnabled,
          cutOffDate: (exerciseData.availabilityPeriod as any).cutoffEnabled
            ? ((exerciseData.availabilityPeriod as any).cutOffDate || null)
            : null,
          remindGradeByEnabled: !!(exerciseData.availabilityPeriod as any).remindGradeByEnabled,
          remindGradeBy: (exerciseData.availabilityPeriod as any).remindGradeByEnabled
            ? ((exerciseData.availabilityPeriod as any).remindGradeBy || null)
            : null,
          gracePeriodEnabled: exerciseData.availabilityPeriod.gracePeriodEnabled || false,
          gracePeriodAllowed: exerciseData.availabilityPeriod.gracePeriodEnabled || false,
          gracePeriodDate: exerciseData.availabilityPeriod.gracePeriodDate || null,
          extendedDays: (exerciseData.availabilityPeriod as any).extendedDays || 0,
        },
        // ============ FIXED: Complete notificationSettings with grader fields ============
     // In the addExercise and updateExercise methods, update the notificationSettings section:
// In the addExercise and updateExercise methods, update the notificationSettings section:
notificationSettings: {
  notifyUsers: exerciseData.notificationSettings?.notifyUsers || false,
  notifyGmail: exerciseData.notificationSettings?.notifyGmail || false,
  notifyWhatsApp: exerciseData.notificationSettings?.notifyWhatsApp || false,
  gradeSheet: exerciseData.notificationSettings?.gradeSheet || true,
  
  // Grader submission notifications with channels
  notifyGradersSubmissions: (exerciseData as any).notificationSettings?.notifyGradersSubmissions ?? false,
  notifyGradersSubmissionsChannels: {
    dashboard: (exerciseData as any).notificationSettings?.notifyGradersSubmissionsChannels?.dashboard ?? false,
    gmail: (exerciseData as any).notificationSettings?.notifyGradersSubmissionsChannels?.gmail ?? false,
    whatsapp: (exerciseData as any).notificationSettings?.notifyGradersSubmissionsChannels?.whatsapp ?? false,
  },
  
  // Grader late submission notifications with channels
  notifyGradersLateSubmissions: (exerciseData as any).notificationSettings?.notifyGradersLateSubmissions ?? false,
  notifyGradersLateSubmissionsChannels: {
    dashboard: (exerciseData as any).notificationSettings?.notifyGradersLateSubmissionsChannels?.dashboard ?? false,
    gmail: (exerciseData as any).notificationSettings?.notifyGradersLateSubmissionsChannels?.gmail ?? false,
    whatsapp: (exerciseData as any).notificationSettings?.notifyGradersLateSubmissionsChannels?.whatsapp ?? false,
  },
  
  // Student notifications with channels
  notifyStudent: (exerciseData as any).notificationSettings?.notifyStudent ?? true,
  notifyStudentChannels: {
    dashboard: (exerciseData as any).notificationSettings?.notifyStudentChannels?.dashboard ?? false,
    gmail: (exerciseData as any).notificationSettings?.notifyStudentChannels?.gmail ?? false,
    whatsapp: (exerciseData as any).notificationSettings?.notifyStudentChannels?.whatsapp ?? false,
  },
},
        // ============ Complete gradeSettings with difficulty pass fields ============
        gradeSettings: {
          mcqGrade: (exerciseData as any).gradeSettings?.mcqGrade || null,
          mcqGradeToPass: (exerciseData as any).gradeSettings?.mcqGradeToPass
            ? Number((exerciseData as any).gradeSettings.mcqGradeToPass)
            : null,
          programmingGrade: (exerciseData as any).gradeSettings?.programmingGrade || null,
          programmingGradeToPass: (exerciseData as any).gradeSettings?.programmingGradeToPass
            ? Number((exerciseData as any).gradeSettings.programmingGradeToPass)
            : null,
          combinedGrade: (exerciseData as any).gradeSettings?.combinedGrade || null,
          combinedGradeToPass: (exerciseData as any).gradeSettings?.combinedGradeToPass
            ? Number((exerciseData as any).gradeSettings.combinedGradeToPass)
            : null,
          separateMarks: (exerciseData as any).gradeSettings?.separateMarks ?? false,
          // NEW difficulty pass fields:
          difficultyPassEnabled: (exerciseData as any).gradeSettings?.difficultyPassEnabled ?? false,
          easyPassMark: (exerciseData as any).gradeSettings?.easyPassMark ?? null,
          mediumPassMark: (exerciseData as any).gradeSettings?.mediumPassMark ?? null,
          hardPassMark: (exerciseData as any).gradeSettings?.hardPassMark ?? null,
        },
        additionalOptions: {
          anonymousSubmissions: (exerciseData as any).additionalOptions?.anonymousSubmissions ?? false,
          hideGraderIdentity: (exerciseData as any).additionalOptions?.hideGraderIdentity ?? false,
        },
        questions: []
      };


      // Add programming settings if applicable
      if ((exerciseData.exerciseType === 'Programming' || exerciseData.exerciseType === 'Combined') && exerciseData.programmingSettings) {
        payload.programmingSettings = {
          selectedModule: exerciseData.programmingSettings.selectedModule || '',
          selectedLanguages: exerciseData.programmingSettings.selectedLanguages || []
        };
      }

      // ============ HANDLE MCQ CONFIGURATION ============
      if ((exerciseData.exerciseType === 'MCQ' || exerciseData.exerciseType === 'Combined') && exerciseData.questionConfiguration?.mcqConfig) {
        const mcqConfig = exerciseData.questionConfiguration.mcqConfig;
        const scoreType = mcqConfig.scoreSettings?.scoreType || 'equalDistribution';
        let marksPerQuestion = 0;
        let mcqTotalMarks = 0;

        if (scoreType === 'equalDistribution') {
          marksPerQuestion = mcqConfig.scoreSettings?.equalDistribution || 0;
          mcqTotalMarks = (mcqConfig.generalQuestionCount || 0) * marksPerQuestion;
        } else {
          marksPerQuestion = 0;
          mcqTotalMarks = mcqConfig.scoreSettings?.totalMarks || 0;
        }

        payload.questionConfiguration.mcqConfig = {
          questionConfigType: 'general',
          generalQuestionCount: mcqConfig.generalQuestionCount || 0,
          scoreSettings: {
            scoreType: scoreType,
            equalDistribution: marksPerQuestion,
            totalMarks: mcqTotalMarks
          },
          attemptLimitEnabled: mcqConfig.attemptLimitEnabled || false,
          submissionAttempts: mcqConfig.submissionAttempts || 1,
          // Additional fields for backend
          mcqTotalMarks: mcqTotalMarks,
          marksPerQuestion: marksPerQuestion,
          totalMcqQuestions: mcqConfig.generalQuestionCount || 0,
          scoringType: scoreType,
          shuffleQuestions: true
        };
      }

      // ============ HANDLE PROGRAMMING CONFIGURATION ============
      if ((exerciseData.exerciseType === 'Programming' || exerciseData.exerciseType === 'Combined') && exerciseData.questionConfiguration?.programmingConfig) {
        const progConfig = exerciseData.questionConfiguration.programmingConfig;

        // Map frontend terminology to backend terminology
        let backendQuestionConfigType;
        switch (progConfig.questionConfigType) {
          case 'levelBased':
            backendQuestionConfigType = 'levelBased';
            break;
          case 'selectionLevel':
            backendQuestionConfigType = 'selectionLevel';
            break;
          default:
            backendQuestionConfigType = progConfig.questionConfigType;
        }

        // Calculate total marks for Programming mode
        let progTotalMarks = 0;

        if (progConfig.questionConfigType === 'general') {
          if (progConfig.scoreSettings?.scoreType === 'equalDistribution') {
            progTotalMarks = (progConfig.generalQuestionCount || 0) * (progConfig.scoreSettings.equalDistribution || 0);
          }
        } else if (progConfig.questionConfigType === 'levelBased' || progConfig.questionConfigType === 'selectionLevel') {
          const counts = progConfig.questionConfigType === 'selectionLevel'
            ? progConfig.selectionLevelCounts
            : progConfig.levelBasedCounts;

          const levelScoring = progConfig.scoreSettings?.levelScoringConfiguration;

          if (levelScoring) {
            (['easy', 'medium', 'hard']).forEach(level => {
              const count = counts[level] || 0;
              if (count === 0) return;

              const scoring = levelScoring[level];
              if (scoring) {
                if (scoring.type === 'level_specific' && scoring.marksPerQuestion) {
                  progTotalMarks += count * scoring.marksPerQuestion;
                } else if (scoring.type === 'question_specific' && scoring.totalMarks) {
                  progTotalMarks += scoring.totalMarks;
                }
              }
            });
          }
        }

        // Map frontend score type to backend score type
        let backendScoreType;
        if (progConfig.questionConfigType === 'levelBased' || progConfig.questionConfigType === 'selectionLevel') {
          backendScoreType = 'levelBasedMarks';
        } else {
          switch (progConfig.scoreSettings?.scoreType) {
            case 'equalDistribution':
              backendScoreType = 'evenMarks';
              break;
            case 'questionSpecific':
              backendScoreType = 'separateMarks';
              break;
            case 'levelSpecific':
              backendScoreType = 'levelBasedMarks';
              break;
            default:
              backendScoreType = progConfig.scoreSettings?.scoreType;
          }
        }

        // Process level scoring configuration
        const levelScoringConfig = progConfig.scoreSettings?.levelScoringConfiguration;

        // Process scoring based on approach
        let levelBasedMarks = { easy: 0, medium: 0, hard: 0 };
        let separateMarks = {
          general: [],
          levelBased: { easy: [], medium: [], hard: [] }
        };
        let evenMarks = 0;

        if (progConfig.questionConfigType === 'general') {
          if (progConfig.scoreSettings?.scoreType === 'equalDistribution') {
            evenMarks = progConfig.scoreSettings.equalDistribution || 0;
          } else if (progConfig.scoreSettings?.scoreType === 'questionSpecific') {
            separateMarks.general = progConfig.scoreSettings.questionSpecific?.general || [];
          }
        } else if (progConfig.questionConfigType === 'levelBased' || progConfig.questionConfigType === 'selectionLevel') {
          const counts = progConfig.questionConfigType === 'selectionLevel'
            ? progConfig.selectionLevelCounts
            : progConfig.levelBasedCounts;

          // REPLACE this block in updateExercise controller:
          if (levelScoringConfig && (qConfigType === 'levelBased' || qConfigType === 'selectionLevel')) {
            const counts = qConfigType === 'selectionLevel'
              ? progCfg.selectionLevelCounts
              : progCfg.levelBasedCounts;
            ['easy', 'medium', 'hard'].forEach(l => {
              const c = counts?.[l] || 0;
              if (!c) return;
              const s = levelScoringConfig[l];
              if (!s) return;

              // ✅ Always set questionCount
              levelScoringConfig[l].questionCount = c;

              if (s.type === 'level_specific' && s.marksPerQuestion) {
                levelBasedMarks[l] = s.marksPerQuestion;
                // ✅ Always recompute totalMarks
                levelScoringConfig[l].totalMarks = c * s.marksPerQuestion;
              } else if (s.type === 'question_specific' && s.totalMarks) {
                levelBasedMarks[l] = c > 0 ? s.totalMarks / c : 0;
                // totalMarks already set by frontend for question_specific
              }
            });
          } else {
            levelBasedMarks = progConfig.scoreSettings?.levelBasedMarks || { easy: 0, medium: 0, hard: 0 };
          }
        }

        // Build programming config object
        const programmingConfig: any = {
          questionConfigType: backendQuestionConfigType || 'general',
          attemptLimitEnabled: progConfig.attemptLimitEnabled || false,
          submissionAttempts: progConfig.submissionAttempts || 1,
          questionFlow: progConfig.questionFlow || 'freeFlow',
          allowCodeExecution: true,
          enableTestCases: true,
          showSampleCases: true,
          scoreSettings: {
            scoreType: backendScoreType || 'evenMarks',
            evenMarks: evenMarks,
            separateMarks: separateMarks,
            levelBasedMarks: levelBasedMarks,
            levelScoringConfiguration: levelScoringConfig,
            totalMarks: progTotalMarks
          }
        };

        // Add counts based on configuration type
        if (progConfig.questionConfigType === 'general') {
          programmingConfig.generalQuestionCount = progConfig.generalQuestionCount || 0;
          programmingConfig.generalMarksPerQuestion = progConfig.scoreSettings?.equalDistribution || 0;
        } else if (progConfig.questionConfigType === 'levelBased') {
          programmingConfig.levelBasedCounts = progConfig.levelBasedCounts || { easy: 0, medium: 0, hard: 0 };
        } else if (progConfig.questionConfigType === 'selectionLevel') {
          programmingConfig.selectionLevelCounts = progConfig.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
        }

        payload.questionConfiguration.programmingConfig = programmingConfig;
      }

      // ============ HANDLE OTHERS CONFIGURATION ============
      if (exerciseData.exerciseType === 'Other') {
        const othersConfig = (exerciseData.questionConfiguration as any)?.othersQuestionConfiguration;
        if (othersConfig) {
          payload.questionConfiguration.othersQuestionConfiguration = othersConfig;
        }
      }

      console.log('🌐 Transformed update payload:', JSON.stringify(payload, null, 2));

      const entityPath = getEntityPath(entityType);
      const url = `${BASE_URL}/exercise/update/${entityPath}/${entityId}/${exerciseId}`;
      const token = localStorage.getItem("smartcliff_token");

      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const response = await axios.put(
        url,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
          },
          timeout: 30000,
        }
      );

      console.log('✅ Exercise updated successfully:', response.data);
      return response.data;

    } catch (error: any) {
      console.error('❌ Error updating exercise:', {
        entityType,
        entityId,
        exerciseId,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      if (error.response) {
        throw new Error(
          `Server error (${error.response.status}): ${JSON.stringify(error.response.data)}`
        );
      } else if (error.request) {
        throw new Error('No response received from server. Please check your connection.');
      } else {
        throw error;
      }
    }
  },

  // 5. DELETE EXERCISE (Updated)
  deleteExercise: async (
    entityType: EntityType,
    entityId: string,
    exerciseId: string,
    section: 'I_Do' | 'We_Do' | 'You_Do' = 'We_Do',
    subcategory?: string
  ): Promise<any> => {
    try {
      const params = new URLSearchParams();
      params.append('tabType', section);
      if (subcategory) params.append('subcategory', subcategory);

      const entityPath = getEntityPath(entityType);
      const url = `${BASE_URL}/exercise/delete/${entityPath}/${entityId}/${exerciseId}?${params.toString()}`;

      console.log('🗑️ Deleting exercise:', {
        url,
        entityType,
        entityId,
        exerciseId,
        section,
        subcategory
      });

      const token = localStorage.getItem("smartcliff_token");
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const response = await axios.delete(
        url,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 15000,
        }
      );

      console.log('✅ Exercise deleted successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error deleting exercise:', {
        entityType,
        entityId,
        exerciseId,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      if (error.response) {
        throw new Error(
          `Server error (${error.response.status}): ${JSON.stringify(error.response.data)}`
        );
      } else if (error.request) {
        throw new Error('No response received from server. Please check your connection.');
      } else {
        throw error;
      }
    }
  },

  // 6. GET SUBCATEGORIES (Updated)
  getSubcategories: async (
    entityType: EntityType,
    entityId: string,
    section: 'I_Do' | 'We_Do' | 'You_Do' = 'We_Do'
  ): Promise<any> => {
    try {
      const params = new URLSearchParams();
      params.append('section', section);

      const entityPath = getEntityPath(entityType);
      const url = `${BASE_URL}/exercise/subcategories/${entityPath}/${entityId}?${params.toString()}`;

      console.log('📋 Fetching subcategories:', {
        url,
        entityType,
        entityId,
        section
      });

      const token = localStorage.getItem("smartcliff_token");
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const response = await axios.get(
        url,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 15000,
        }
      );

      console.log('✅ Subcategories fetched successfully:', {
        count: response.data?.data?.subcategories?.length || 0
      });

      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching subcategories:', error);
      throw error;
    }
  },

  // 7. GET EXERCISE STATISTICS (New)
  getExerciseStatistics: async (
    entityType: EntityType,
    entityId: string,
    section?: 'I_Do' | 'We_Do' | 'You_Do'
  ): Promise<any> => {
    try {
      let url = `${BASE_URL}/exercise/statistics/${getEntityPath(entityType)}/${entityId}`;

      if (section) {
        url += `?section=${section}`;
      }

      console.log('📊 Fetching exercise statistics:', {
        url,
        entityType,
        entityId,
        section
      });

      const token = localStorage.getItem("smartcliff_token");
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const response = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        timeout: 30000,
      });

      console.log('✅ Exercise statistics fetched:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error fetching exercise statistics:', error);
      // Return default statistics if API fails
      return {
        data: {
          totalExercises: 0,
          bySection: { 'I_Do': 0, 'We_Do': 0, 'You_Do': 0 },
          byType: { 'MCQ': 0, 'Programming': 0, 'Combined': 0 },
          byStatus: { 'active': 0, 'inactive': 0, 'scheduled': 0 }
        }
      };
    }
  }

};


