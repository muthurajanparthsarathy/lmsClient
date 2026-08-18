import React, { useEffect, useState } from 'react';
import {
    ArrowLeft, ArrowRight, CheckCircle, X,
    Code, FileText, Layers, Shuffle,
    Calendar, Settings, Check,
    Plus, Minus,
    Loader2, Mail, MessageCircle, Clock,
    Lock, Eye, Bell, Award,
    ChevronRight, Home, BookOpen, Folder, Activity,
    ChevronDown,
    ShuffleIcon
} from 'lucide-react';
import { toast } from 'react-toastify';
import { exerciseApi } from '../../../../apiServices/exercise'; // Your API service

// Define the complete payload interface matching the API
export interface ExercisePayload {
    configurationType: 'practice' | 'manual';
    tabType: "I_Do" | "We_Do" | "You_Do";
    subcategory: string;
    
    // From Step 2: Module Selection
    programmingSettings: {
        selectedModule: string;
        selectedLanguages: string[];
    };
    
    // From Step 3: Exercise Details
    exerciseInformation: {
        exerciseId: string;
        exerciseName: string;
        description: string;
        exerciseLevel: 'beginner' | 'intermediate' | 'expert';
        totalDuration: number; // In minutes
    };
    
    // From Step 4: Question Configuration
    questionConfiguration: {
        questionConfigType: 'general' | 'levelBased' | 'selectionLevel';
        generalQuestionCount?: number;
        levelBasedCounts?: {
            easy: number;
            medium: number;
            hard: number;
        };
        selectionLevelCounts?: {
            easy: number;
            medium: number;
            hard: number;
        };
        questionFlow: 'freeFlow' | 'controlled';
        attemptLimitEnabled: boolean;
        submissionAttempts: number;
    };
    
    // From Step 4: Score Configuration
    scoreSettings: {
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
    };
    
    // From Step 5: Schedule Availability
    availabilityPeriod: {
        startDate: string;
        endDate: string;
        gracePeriodEnabled: boolean;
        gracePeriodDate?: string;
    };
    
    // From Step 6: Grade & Notifications
    notificationGradeSettings: {
        notifyUsers: boolean;
        notifyGmail: boolean;
        notifyWhatsApp: boolean;
        gradeSheet: boolean;
    };
}

interface ManualSettingsProps {
    onComplete: (data?: ExercisePayload) => void; // Optional for API call
    onCancel: () => void;
    tabType: 'I_Do' | 'We_Do' | 'You_Do';
    hierarchyData?: {
        courseName?: string;
        moduleName?: string;
        submoduleName?: string;
        topicName?: string;
        subtopicName?: string;
        nodeType?: string;
        level?: number;
        nodeName?: string;
    };
    subcategoryLabel?: string;
    nodeId: string;
    nodeType: string;
    onBack: () => void;
    entityType: 'modules' | 'submodules' | 'topics' | 'subtopics'; // Added entityType
}

interface Step {
    id: number;
    title: string;
    subtitle: string;
    completed: boolean;
    active: boolean;
    icon: React.ReactNode;
}

const ManualSettings: React.FC<ManualSettingsProps> = ({
    onComplete,
    onCancel,
    tabType,
    subcategoryLabel,
    hierarchyData = {},
    onBack,
    nodeId,
    nodeType,
    entityType
}) => {
    const [currentStep, setCurrentStep] = useState(2);
    const [isLoading, setIsLoading] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const [isScoringOpen, setIsScoringOpen] = useState(false);
    const [currentScoringLabel, setCurrentScoringLabel] = useState('Even Marks - All questions equal marks');
    const [isQuestionFlowOpen, setIsQuestionFlowOpen] = useState(false);

    // Form data state
    const [formData, setFormData] = useState({
        selectedModule: '',
        selectedLanguages: [] as string[],
        exerciseId: `EX${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        exerciseName: '',
        description: '',
        exerciseLevel: 'intermediate' as 'beginner' | 'intermediate' | 'expert',
        totalDuration: 60, // Default 1 hour in minutes
        questionConfigType: 'general' as 'general' | 'levelBased' | 'selectionLevel',
        generalQuestionCount: 5,
        selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
        levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
        questionFlow: 'freeFlow' as 'freeFlow' | 'controlled',
        attemptLimitEnabled: false,
        submissionAttempts: 1,
        startDate: today,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        gracePeriodEnabled: false,
        gracePeriodDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notifyUsers: false,
        notifyGmail: false,
        notifyWhatsApp: false,
        gradeSheet: true,
        scoreSettings: {
            scoreType: 'evenMarks' as 'evenMarks' | 'separateMarks' | 'levelBasedMarks',
            evenMarks: 10,
            separateMarks: {
                general: [] as number[],
                levelBased: {
                    easy: [] as number[],
                    medium: [] as number[],
                    hard: [] as number[]
                }
            },
            levelBasedMarks: {
                easy: 10,
                medium: 15,
                hard: 20
            },
            totalMarks: 0
        }
    });

    useEffect(() => {
        const scoringOptions = [
            { value: 'evenMarks', label: 'Even Marks - All questions equal marks' },
            { value: 'separateMarks', label: 'Separate Marks - Individual question marks' },
            ...(formData.questionConfigType === 'levelBased' || formData.questionConfigType === 'selectionLevel'
                ? [{ value: 'levelBasedMarks', label: 'Level Based Marks - Marks by difficulty' }]
                : [])
        ];

        const currentOption = scoringOptions.find(opt => opt.value === formData.scoreSettings?.scoreType);
        if (currentOption) {
            setCurrentScoringLabel(currentOption.label);
        }
    }, [formData.scoreSettings?.scoreType, formData.questionConfigType]);

    const steps: Step[] = [
        { id: 2, title: 'Module', subtitle: 'Languages', completed: currentStep > 2, active: currentStep === 2, icon: <Code size={16} /> },
        { id: 3, title: 'Details', subtitle: 'Info & Time', completed: currentStep > 3, active: currentStep === 3, icon: <FileText size={16} /> },
        { id: 4, title: 'Questions', subtitle: 'Configuration', completed: currentStep > 4, active: currentStep === 4, icon: <Layers size={16} /> },
        { id: 5, title: 'Schedule', subtitle: 'Dates', completed: currentStep > 5, active: currentStep === 5, icon: <Calendar size={16} /> },
        { id: 6, title: 'Grade', subtitle: 'Review', completed: currentStep > 6, active: currentStep === 6, icon: <Settings size={16} /> },
    ];

    const moduleLanguages: Record<string, { name: string; icon: string }[]> = {
        'Core Programming': [
            { name: 'C', icon: '/active-images/c.png' },
            { name: 'C++', icon: '/active-images/cpp.png' },
            { name: 'Java', icon: '/active-images/java.png' },
            { name: 'Python', icon: '/active-images/python.png' },
            { name: 'C#', icon: '/active-images/csharp.png' }
        ],
        'Frontend': [
            { name: 'HTML', icon: '/active-images/html.png' },
            { name: 'CSS', icon: '/active-images/css.png' },
            { name: 'JavaScript', icon: '/active-images/javascript.png' },
            { name: 'TypeScript', icon: '/active-images/typescript.png' },
            { name: 'React', icon: '/active-images/react.png' },
            { name: 'Vue', icon: '/active-images/vue.png' },
            { name: 'Angular', icon: '/active-images/angular.png' }
        ],
        'Database': [
            { name: 'SQL', icon: '/active-images/sql.png' },
            { name: 'PL/SQL', icon: '/active-images/plsql.png' },
            { name: 'MongoDB', icon: '/active-images/mongodb.png' },
            { name: 'PostgreSQL', icon: '/active-images/postgresql.png' },
            { name: 'MySQL', icon: '/active-images/mysql.png' }
        ]
    };

    // --- Validation ---
    const validateCurrentStep = (): boolean => {
        switch (currentStep) {
            case 2:
                return formData.selectedModule.trim() !== '' && formData.selectedLanguages.length > 0;
            case 3:
                return (
                    formData.exerciseId.trim() !== '' &&
                    formData.exerciseName.trim() !== '' &&
                    formData.description.trim() !== '' &&
                    formData.totalDuration > 0
                );
            case 4:
                if (formData.questionConfigType === 'general') {
                    return formData.generalQuestionCount > 0;
                }
                const counts = formData.questionConfigType === 'selectionLevel'
                    ? formData.selectionLevelCounts
                    : formData.levelBasedCounts;
                return (counts.easy + counts.medium + counts.hard) > 0;
            case 5:
                const start = new Date(formData.startDate);
                const end = new Date(formData.endDate);
                if (start >= end) return false;
                if (formData.gracePeriodEnabled) return new Date(formData.gracePeriodDate) >= end;
                return true;
            case 6:
                return true;
            default:
                return false;
        }
    };

    const handleNext = () => {
        if (!validateCurrentStep()) {
            toast.error('Please complete all required fields correctly.', { position: "top-right", autoClose: 2000 });
            return;
        }

        if (currentStep < 6) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        if (currentStep > 2) {
            setCurrentStep(currentStep - 1);
        } else {
            onBack();
        }
    };

 const handleComplete = async () => {
    if (validateCurrentStep()) {
        setIsLoading(true);

        try {
            // Calculate total marks
            const totalQuestions = getTotalQuestions();
            let totalMarks = 0;

            // Prepare score settings based on selected type
            let scoreSettings: any = {
                scoreType: formData.scoreSettings?.scoreType,
                totalMarks: 0
            };

            if (formData.scoreSettings?.scoreType === 'evenMarks') {
                totalMarks = formData.scoreSettings.evenMarks * totalQuestions;
                scoreSettings = {
                    ...scoreSettings,
                    scoreType: 'evenMarks',
                    evenMarks: formData.scoreSettings.evenMarks,
                    // Set other mark types to null/empty
                    separateMarks: {
                        general: [],
                        levelBased: {
                            easy: [],
                            medium: [],
                            hard: []
                        }
                    },
                    levelBasedMarks: {
                        easy: null,
                        medium: null,
                        hard: null
                    },
                    totalMarks: totalMarks
                };
            } else if (formData.scoreSettings?.scoreType === 'levelBasedMarks') {
                const counts = formData.questionConfigType === 'selectionLevel'
                    ? formData.selectionLevelCounts
                    : formData.levelBasedCounts;
                totalMarks =
                    (counts.easy * formData.scoreSettings.levelBasedMarks.easy) +
                    (counts.medium * formData.scoreSettings.levelBasedMarks.medium) +
                    (counts.hard * formData.scoreSettings.levelBasedMarks.hard);
                    
                scoreSettings = {
                    ...scoreSettings,
                    scoreType: 'levelBasedMarks',
                    evenMarks: null,
                    separateMarks: {
                        general: [],
                        levelBased: {
                            easy: [],
                            medium: [],
                            hard: []
                        }
                    },
                    levelBasedMarks: {
                        easy: formData.scoreSettings.levelBasedMarks.easy,
                        medium: formData.scoreSettings.levelBasedMarks.medium,
                        hard: formData.scoreSettings.levelBasedMarks.hard
                    },
                    totalMarks: totalMarks
                };
            } else if (formData.scoreSettings?.scoreType === 'separateMarks') {
                // For separate marks, we just send empty/default values
                // The actual marks will be set during question creation
                scoreSettings = {
                    ...scoreSettings,
                    scoreType: 'separateMarks',
                    evenMarks: null,
                    separateMarks: {
                        general: [], // This will be populated during question creation
                        levelBased: {
                            easy: [],
                            medium: [],
                            hard: []
                        }
                    },
                    levelBasedMarks: {
                        easy: null,
                        medium: null,
                        hard: null
                    },
                    totalMarks: 0 // Will be calculated later when questions are added
                };
            }

            // Prepare the complete payload
            const exercisePayload: ExercisePayload = {
                configurationType: 'manual',
                tabType: tabType,
                subcategory: subcategoryLabel || '',
                programmingSettings: {
                    selectedModule: formData.selectedModule,
                    selectedLanguages: formData.selectedLanguages
                },
                exerciseInformation: {
                    exerciseId: formData.exerciseId,
                    exerciseName: formData.exerciseName,
                    description: formData.description,
                    exerciseLevel: formData.exerciseLevel,
                    totalDuration: formData.totalDuration
                },
                questionConfiguration: {
                    questionConfigType: formData.questionConfigType,
                    ...(formData.questionConfigType === 'general' && {
                        generalQuestionCount: formData.generalQuestionCount
                    }),
                    ...(formData.questionConfigType === 'levelBased' && {
                        levelBasedCounts: formData.levelBasedCounts
                    }),
                    ...(formData.questionConfigType === 'selectionLevel' && {
                        selectionLevelCounts: formData.selectionLevelCounts
                    }),
                    questionFlow: formData.questionFlow,
                    attemptLimitEnabled: formData.attemptLimitEnabled,
                    submissionAttempts: formData.submissionAttempts
                },
                scoreSettings: scoreSettings,
                availabilityPeriod: {
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    gracePeriodEnabled: formData.gracePeriodEnabled,
                    ...(formData.gracePeriodEnabled && {
                        gracePeriodDate: formData.gracePeriodDate
                    })
                },
                notificationGradeSettings: {
                    notifyUsers: formData.notifyUsers,
                    notifyGmail: formData.notifyGmail,
                    notifyWhatsApp: formData.notifyWhatsApp,
                    gradeSheet: formData.gradeSheet
                }
            };

            console.log('📦 Sending exercise payload:', exercisePayload);

            // Call the API directly
            const response = await exerciseApi.addExercise(
                entityType,
                nodeId,
                exercisePayload
            );

            console.log('✅ Exercise created successfully:', response);
            
            toast.success('Exercise created successfully!', {
                position: "top-right",
                autoClose: 3000,
            });

            // Notify parent component of completion
            onComplete();
            
        } catch (error: any) {
            console.error('❌ Error creating exercise:', error);
            toast.error(`Failed to create exercise: ${error.message}`, {
                position: "top-right",
                autoClose: 5000,
            });
        } finally {
            setIsLoading(false);
        }
    }
};

    const toggleLanguage = (language: string) => {
        setFormData(prev => ({
            ...prev,
            selectedLanguages: prev.selectedLanguages.includes(language)
                ? prev.selectedLanguages.filter(l => l !== language)
                : [...prev.selectedLanguages, language]
        }));
    };

    const toggleAllLanguages = () => {
        const currentLanguages = moduleLanguages[formData.selectedModule]?.map(lang => lang.name) || [];
        const allSelected = currentLanguages.every(lang => formData.selectedLanguages.includes(lang));
        setFormData(prev => ({
            ...prev,
            selectedLanguages: allSelected ? [] : [...currentLanguages]
        }));
    };

    const getTotalQuestions = (): number => {
        if (formData.questionConfigType === 'general') {
            return formData.generalQuestionCount;
        }
        const counts = formData.questionConfigType === 'selectionLevel'
            ? formData.selectionLevelCounts
            : formData.levelBasedCounts;
        return counts.easy + counts.medium + counts.hard;
    };

    // Question Flow Options
    const questionFlowOptions = [
        {
            value: 'freeFlow',
            label: 'Free Flow',
            description: 'Users can attempt questions in any order and navigate freely',
            icon: <Shuffle size={14} className="text-blue-500" />
        },
        {
            value: 'controlled',
            label: 'Controlled Flow',
            description: 'Users must follow a specific sequence; navigation is restricted',
            icon: <Lock size={14} className="text-purple-500" />
        }
    ];

    // --- Score Options Renderer ---
    const renderScoreOptions = () => {
        const totalQuestions = getTotalQuestions();
        const counts = formData.questionConfigType === 'selectionLevel'
            ? formData.selectionLevelCounts
            : formData.levelBasedCounts;

        const scoringOptions = [
            { value: 'evenMarks', label: 'Even Marks - All questions equal marks' },
            { value: 'separateMarks', label: 'Separate Marks - Individual question marks' },
            ...(formData.questionConfigType === 'levelBased' || formData.questionConfigType === 'selectionLevel'
                ? [{ value: 'levelBasedMarks', label: 'Level Based Marks - Marks by difficulty' }]
                : [])
        ];

        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 rounded-lg p-2">
                        <Award size={18} className="text-gray-700" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900">Scoring Configuration</h4>
                        <p className="text-xs text-gray-500">Configure how marks will be awarded</p>
                    </div>
                </div>

                {/* Scoring Type Selection */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                        Scoring Type
                    </label>
                    <div className="relative w-auto inline-block">
                        <button
                            type="button"
                            onClick={() => setIsScoringOpen(!isScoringOpen)}
                            className={`
                                relative flex items-center justify-between
                                px-3 py-2
                                bg-white
                                border border-gray-200
                                rounded-lg
                                text-left text-sm text-gray-800
                                shadow-sm
                                transition-all duration-150 ease-in-out
                                hover:shadow hover:border-purple-300
                                focus:outline-none focus:ring-1 focus:ring-purple-200
                                ${isScoringOpen ? 'ring-1 ring-purple-200 border-purple-400' : ''}
                                min-w-[280px] max-w-[350px]
                            `}
                        >
                            <span className="block truncate text-sm">{currentScoringLabel}</span>
                            <span className={`ml-2 flex items-center pointer-events-none transition-transform duration-200 ${isScoringOpen ? 'rotate-180' : ''}`}>
                                <svg className="h-3.5 w-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </span>
                        </button>

                        {isScoringOpen && (
                            <div className="absolute z-50 mt-1 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in-95 duration-75 min-w-[280px] max-w-[350px]">
                                <div className="py-1">
                                    {scoringOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                const newType = option.value as 'evenMarks' | 'separateMarks' | 'levelBasedMarks';
                                                setFormData(prev => ({
                                                    ...prev,
                                                    scoreSettings: {
                                                        ...prev.scoreSettings!,
                                                        scoreType: newType
                                                    }
                                                }));
                                                setCurrentScoringLabel(option.label);
                                                setIsScoringOpen(false);
                                            }}
                                            className={`
                                                w-full text-left block px-3 py-2 text-sm transition-colors duration-100 hover:bg-gray-50
                                                ${formData.scoreSettings?.scoreType === option.value
                                                    ? 'bg-purple-50 text-purple-700 font-medium'
                                                    : 'text-gray-600 hover:text-gray-900'}
                                            `}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${formData.scoreSettings?.scoreType === option.value ? 'bg-purple-500' : 'bg-gray-300'}`} />
                                                <span className="truncate">{option.label}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Configuration Details */}
                <div className="border border-gray-200 rounded-lg p-4 bg-white">
                    {/* Even Marks Configuration */}
                    {formData.scoreSettings?.scoreType === 'evenMarks' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Marks Per Question
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={formData.scoreSettings.evenMarks}
                                        onChange={(e) => {
                                            const marks = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
                                            setFormData(prev => ({
                                                ...prev,
                                                scoreSettings: {
                                                    ...prev.scoreSettings!,
                                                    evenMarks: marks,
                                                    totalMarks: marks * totalQuestions
                                                }
                                            }));
                                        }}
                                        className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <span className="text-sm text-gray-500">marks per question</span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-gray-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">Total Marks:</span>
                                    <span className="text-lg font-bold text-gray-900">
                                        {formData.scoreSettings.evenMarks} × {totalQuestions} = {formData.scoreSettings.evenMarks * totalQuestions}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Separate Marks Configuration */}
                    {formData.scoreSettings?.scoreType === 'separateMarks' && (
                        <div className="space-y-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <FileText size={16} className="text-gray-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h5 className="text-sm font-medium text-gray-900 mb-1">Separate Marks Configuration</h5>
                                        <p className="text-xs text-gray-600">
                                            Marks will be configured individually for each question during question creation.
                                            Total marks will be calculated automatically based on individual question marks.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Level Based Marks Configuration */}
                    {formData.scoreSettings?.scoreType === 'levelBasedMarks' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Easy Level */}
                                {counts.easy > 0 && (
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-700">Easy Level</span>
                                                    <span className="text-xs text-gray-500">{counts.easy} questions</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        value={formData.scoreSettings.levelBasedMarks.easy}
                                                        onChange={(e) => {
                                                            const marks = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                scoreSettings: {
                                                                    ...prev.scoreSettings!,
                                                                    levelBasedMarks: {
                                                                        ...prev.scoreSettings!.levelBasedMarks,
                                                                        easy: marks
                                                                    }
                                                                }
                                                            }));
                                                        }}
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                    <span className="text-sm text-gray-500">marks</span>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Subtotal: <span className="font-medium">
                                                    {formData.scoreSettings.levelBasedMarks.easy * counts.easy} marks
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Medium Level */}
                                {counts.medium > 0 && (
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-700">Medium Level</span>
                                                    <span className="text-xs text-gray-500">{counts.medium} questions</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        value={formData.scoreSettings.levelBasedMarks.medium}
                                                        onChange={(e) => {
                                                            const marks = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                scoreSettings: {
                                                                    ...prev.scoreSettings!,
                                                                    levelBasedMarks: {
                                                                        ...prev.scoreSettings!.levelBasedMarks,
                                                                        medium: marks
                                                                    }
                                                                }
                                                            }));
                                                        }}
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                    <span className="text-sm text-gray-500">marks</span>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Subtotal: <span className="font-medium">
                                                    {formData.scoreSettings.levelBasedMarks.medium * counts.medium} marks
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Hard Level */}
                                {counts.hard > 0 && (
                                    <div className="border border-gray-200 rounded-lg p-4">
                                        <div className="space-y-3">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium text-gray-700">Hard Level</span>
                                                    <span className="text-xs text-gray-500">{counts.hard} questions</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        value={formData.scoreSettings.levelBasedMarks.hard}
                                                        onChange={(e) => {
                                                            const marks = Math.min(100, Math.max(1, parseInt(e.target.value) || 1));
                                                            setFormData(prev => ({
                                                                ...prev,
                                                                scoreSettings: {
                                                                    ...prev.scoreSettings!,
                                                                    levelBasedMarks: {
                                                                        ...prev.scoreSettings!.levelBasedMarks,
                                                                        hard: marks
                                                                    }
                                                                }
                                                            }));
                                                        }}
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                                    />
                                                    <span className="text-sm text-gray-500">marks</span>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                Subtotal: <span className="font-medium">
                                                    {formData.scoreSettings.levelBasedMarks.hard * counts.hard} marks
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Total Marks Calculation */}
                            <div className="pt-4 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm font-medium text-gray-700">Total Marks</div>
                                        <div className="text-xs text-gray-500">Calculated based on level configuration</div>
                                    </div>
                                    <div className="text-xl font-bold text-blue-700">
                                        {(
                                            (counts.easy * formData.scoreSettings.levelBasedMarks.easy) +
                                            (counts.medium * formData.scoreSettings.levelBasedMarks.medium) +
                                            (counts.hard * formData.scoreSettings.levelBasedMarks.hard)
                                        ).toLocaleString()} marks
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // --- Render Steps ---
    const renderStep2 = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Module Selection */}
            <div className="inline-block">
                <select
                    value={formData.selectedModule || ''}
                    onChange={(e) => setFormData(prev => ({
                        ...prev,
                        selectedModule: e.target.value,
                        selectedLanguages: []
                    }))}
                    className="text-sm border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[180px]"
                >
                    <option value="">Select Module</option>
                    <option value="Core Programming">Core Programming</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Database">Database</option>
                </select>
            </div>

            {/* Selected Module Languages */}
            {formData.selectedModule && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase text-slate-500">Programming Languages</h4>
                        <button
                            type="button"
                            onClick={toggleAllLanguages}
                            className="text-[10px] font-medium text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                        >
                            {moduleLanguages[formData.selectedModule]?.every(lang => formData.selectedLanguages.includes(lang.name)) ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {moduleLanguages[formData.selectedModule]?.map(language => {
                            const isSelected = formData.selectedLanguages.includes(language.name);
                            return (
                                <div
                                    key={language.name}
                                    onClick={() => toggleLanguage(language.name)}
                                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-medium transition-all ${isSelected ? 'bg-white border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                        }`}
                                >
                                    <div className={`w-3 h-3 rounded-sm border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-400'
                                        }`}>
                                        {isSelected && <Check size={8} className="text-white" />}
                                    </div>
                                    <div className="w-4 h-4 flex items-center justify-center">
                                        <img
                                            src={language.icon}
                                            alt={language.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                    {language.name}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );

    const renderStep3 = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Exercise ID</label>
                    <input
                        type="text"
                        value={formData.exerciseId}
                        onChange={(e) => setFormData(prev => ({ ...prev, exerciseId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Exercise Name</label>
                    <input
                        type="text"
                        value={formData.exerciseName}
                        onChange={(e) => setFormData(prev => ({ ...prev, exerciseName: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Array Logic"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Description</label>
                <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none h-20 resize-none"
                    placeholder="Brief description of the exercise..."
                />
            </div>

            <div className="grid grid-cols-2 gap-4 ">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Difficulty Level</label>
                    <div className="flex p-1 bg-gray-100 rounded-lg">
                        {(['beginner', 'intermediate', 'expert'] as const).map(level => (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, exerciseLevel: level }))}
                                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-medium rounded transition-all ${formData.exerciseLevel === level ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                                    }`}
                            >
                                {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-1 mt-1">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600">Total Duration</label>
                        <span className="text-[10px] text-gray-400 font-medium">in minutes</span>
                    </div>

                    <div className="relative">
                        <input
                            type="number"
                            value={formData.totalDuration}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                totalDuration: Math.max(1, parseInt(e.target.value) || 1)
                            }))}
                            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="Enter duration in minutes"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="text-gray-500 text-sm">minutes</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const configOptions = [
        { label: 'General Configuration', value: 'general' },
        { label: 'Level-Based Configuration', value: 'levelBased' },
        { label: 'Selection Level Configuration', value: 'selectionLevel' }
    ];

    const [isConfigOpen, setIsConfigOpen] = useState(false);

    const currentConfigLabel = configOptions.find(opt => opt.value === formData.questionConfigType)?.label || 'Select Type';
    
    const renderStep4 = () => {
        const totalQuestions = getTotalQuestions();
        const currentFlowOption = questionFlowOptions.find(opt => opt.value === formData.questionFlow);

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Row 1: Configuration Type with appropriate inputs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {/* Left Column - Configuration Type */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-medium text-gray-700 mb-1 ml-0.5">
                            Configuration Type
                        </label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsConfigOpen(!isConfigOpen)}
                                className={`
                                relative w-full flex items-center justify-between
                                px-3 py-2
                                bg-white
                                border border-gray-200
                                rounded-lg
                                text-left text-sm text-gray-800
                                shadow-sm
                                transition-all duration-150 ease-in-out
                                hover:shadow hover:border-purple-300
                                focus:outline-none focus:ring-1 focus:ring-purple-200
                                ${isConfigOpen ? 'ring-1 ring-purple-200 border-purple-400' : ''}
                            `}
                            >
                                <span className="block truncate text-sm">{currentConfigLabel}</span>
                                <span className={`ml-2 flex items-center pointer-events-none transition-transform duration-200 ${isConfigOpen ? 'rotate-180' : ''}`}>
                                    <svg className="h-3.5 w-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </span>
                            </button>

                            {isConfigOpen && (
                                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in-95 duration-75">
                                    <div className="py-0.5">
                                        {configOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => {
                                                    const newType = option.value as 'general' | 'levelBased' | 'selectionLevel';
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        questionConfigType: newType,
                                                        generalQuestionCount: 0,
                                                        selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
                                                        levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
                                                    }));
                                                    setIsConfigOpen(false);
                                                }}
                                                className={`
                                                w-full text-left block px-3 py-1.5 text-sm transition-colors duration-100
                                                ${formData.questionConfigType === option.value
                                                        ? 'bg-purple-50 text-purple-700 font-medium'
                                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                            `}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {isConfigOpen && (
                            <div
                                className="fixed inset-0 z-40 bg-transparent"
                                onClick={() => setIsConfigOpen(false)}
                            />
                        )}
                    </div>

                    {/* Right Column - Dynamic based on Configuration Type */}
                    {formData.questionConfigType === 'general' ? (
                        /* GENERAL MODE: Total Questions input */
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-gray-700 mb-1 ml-0.5">
                                Total Questions
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.generalQuestionCount}
                                    onChange={(e) =>
                                        setFormData(prev => ({
                                            ...prev,
                                            generalQuestionCount: Math.max(1, parseInt(e.target.value) || 1),
                                        }))
                                    }
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                                    placeholder="Enter total questions"
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                    <span className="text-gray-500 text-xs">questions</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* LEVEL-BASED or SELECTION-BASED MODE: Easy/Medium/Hard inputs */
                        <div className="space-y-1.5">
                            <div className="grid grid-cols-3 gap-2">
                                {['easy', 'medium', 'hard'].map(level => {
                                    const l = level as keyof typeof formData.selectionLevelCounts;
                                    const counts =
                                        formData.questionConfigType === 'selectionLevel'
                                            ? formData.selectionLevelCounts
                                            : formData.levelBasedCounts;

                                    const count = counts[l];

                                    const levelStyles = {
                                        easy: { label: 'Easy', color: 'text-emerald-700' },
                                        medium: { label: 'Medium', color: 'text-amber-700' },
                                        hard: { label: 'Hard', color: 'text-rose-700' }
                                    };

                                    const style = levelStyles[l];

                                    return (
                                        <div key={l} className="space-y-0.5">
                                            <label className={`text-xs font-medium ${style.color}`}>
                                                {style.label}
                                            </label>
                                            <div className="flex items-center gap-0.5">
                                                <button
                                                    onClick={() => {
                                                        const newCounts = { ...counts, [l]: Math.max(0, count - 1) };
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            [formData.questionConfigType === 'selectionLevel'
                                                                ? 'selectionLevelCounts'
                                                                : 'levelBasedCounts']: newCounts,
                                                        }));
                                                    }}
                                                    className={`
                                                    w-7 h-7 flex items-center justify-center border rounded
                                                    transition-colors duration-150 flex-shrink-0
                                                    ${count === 0
                                                            ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                                                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100'
                                                        }
                                                `}
                                                    disabled={count === 0}
                                                >
                                                    <Minus size={12} />
                                                </button>

                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={count}
                                                    onChange={(e) => {
                                                        const value = Math.max(0, parseInt(e.target.value) || 0);
                                                        const newCounts = { ...counts, [l]: value };
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            [formData.questionConfigType === 'selectionLevel'
                                                                ? 'selectionLevelCounts'
                                                                : 'levelBasedCounts']: newCounts,
                                                        }));
                                                    }}
                                                    className="w-full px-1.5 py-1 text-center text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none"
                                                />

                                                <button
                                                    onClick={() => {
                                                        const newCounts = { ...counts, [l]: count + 1 };
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            [formData.questionConfigType === 'selectionLevel'
                                                                ? 'selectionLevelCounts'
                                                                : 'levelBasedCounts']: newCounts,
                                                        }));
                                                    }}
                                                    className="
                                                    w-7 h-7 flex items-center justify-center border border-gray-300 rounded
                                                    bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400
                                                    active:bg-gray-100 transition-colors duration-150 flex-shrink-0
                                                "
                                                >
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Row 2: Total Questions Summary */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-gray-800">
                                Total Questions Summary
                            </div>
                            <div className="text-xs text-gray-600 mt-0.5">
                                {formData.questionConfigType === 'general'
                                    ? 'Total questions configured'
                                    : 'Configured across all difficulty levels'}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <div className="text-2xl font-bold text-gray-900">
                                {totalQuestions}
                            </div>
                            <span className="text-sm text-gray-600">questions</span>
                        </div>
                    </div>

                    {/* Distribution Summary (only for level-based) */}
                    {formData.questionConfigType !== 'general' && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="text-sm text-gray-600">
                                <span className="font-medium">Distribution:</span>
                                <span className="ml-2">
                                    Easy: {formData.questionConfigType === 'selectionLevel'
                                        ? formData.selectionLevelCounts.easy
                                        : formData.levelBasedCounts.easy},
                                    Medium: {formData.questionConfigType === 'selectionLevel'
                                        ? formData.selectionLevelCounts.medium
                                        : formData.levelBasedCounts.medium},
                                    Hard: {formData.questionConfigType === 'selectionLevel'
                                        ? formData.selectionLevelCounts.hard
                                        : formData.levelBasedCounts.hard}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Row 3: Score Configuration Options */}
                <div className="space-y-6">
                    <div className="rounded-lg bg-white">
                        {renderScoreOptions()}
                    </div>
                </div>

                {/* Row 4: Question Flow Selection */}
                <div className="flex items-center gap-3">
                    <div className="bg-gray-100 rounded-lg p-2">
                        <ShuffleIcon size={18} className="text-gray-700" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-gray-900">Question Flow</h4>
                        <p className="text-xs text-gray-500">Configure question format flow</p>
                    </div>
                </div>
                <div className="space-y-1.5 pb-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1 ml-0.5">
                        Question Flow
                    </label>

                    <div className="relative max-w-xs">
                        <button
                            type="button"
                            onClick={() => setIsQuestionFlowOpen(!isQuestionFlowOpen)}
                            className={`
                            w-full flex items-center justify-between
                            px-3 py-2
                            bg-white
                            border border-gray-300
                            rounded-lg
                            text-left text-sm text-gray-800
                            shadow-sm
                            transition-all duration-150 ease-in-out
                            hover:shadow hover:border-purple-300
                            focus:outline-none focus:ring-1 focus:ring-purple-200
                            ${isQuestionFlowOpen ? 'ring-1 ring-purple-200 border-purple-400' : ''}
                        `}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded ${formData.questionFlow === 'freeFlow' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                                    {formData.questionFlow === 'freeFlow' ?
                                        <Shuffle size={14} className="text-blue-600" /> :
                                        <Lock size={14} className="text-purple-600" />
                                    }
                                </div>
                                <span>{formData.questionFlow === 'freeFlow' ? 'Free Flow' : 'Controlled Flow'}</span>
                            </div>
                            <span className={`ml-2 flex items-center pointer-events-none transition-transform duration-200 ${isQuestionFlowOpen ? 'rotate-180' : ''}`}>
                                <svg className="h-3.5 w-3.5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </span>
                        </button>

                        {isQuestionFlowOpen && (
                            <div className="absolute z-40 w-full mt-1 bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden ring-1 ring-black ring-opacity-5 animate-in fade-in zoom-in-95 duration-75">
                                <div className="py-1">
                                    {questionFlowOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    questionFlow: option.value as 'freeFlow' | 'controlled'
                                                }));
                                                setIsQuestionFlowOpen(false);
                                            }}
                                            className={`
                                            w-full text-left block px-3 py-2 text-sm transition-colors duration-100
                                            ${formData.questionFlow === option.value
                                                    ? 'bg-purple-50 text-purple-700 font-medium'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                                        `}
                                        >
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1 rounded ${option.value === 'freeFlow' ? 'bg-blue-100' : 'bg-purple-100'}`}>
                                                    {option.icon}
                                                </div>
                                                <span>{option.label}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {isQuestionFlowOpen && (
                        <div
                            className="fixed inset-0 z-30 bg-transparent"
                            onClick={() => setIsQuestionFlowOpen(false)}
                        />
                    )}

                    {/* Compact Description */}
                    <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-50 rounded border border-gray-100">
                        {formData.questionFlow === 'freeFlow' ? (
                            <div className="flex items-start gap-2">
                                <Shuffle size={12} className="text-blue-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <span className="font-medium text-gray-900">Free Flow:</span> Users can navigate freely, skip questions, and go back and forth.
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2">
                                <Lock size={12} className="text-purple-500 mt-0.5 flex-shrink-0" />
                                <div>
                                    <span className="font-medium text-gray-900">Controlled Flow:</span> Users must follow sequence, cannot go back to previous questions.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderStep5 = () => {
        // Calculate days between dates
        const calculateDaysBetween = (startDate: string, endDate: string): number => {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end.getTime() - start.getTime());
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        };

        const gracePeriodDays = formData.gracePeriodEnabled
            ? calculateDaysBetween(formData.endDate, formData.gracePeriodDate)
            : 0;

        return (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600">Start Date</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full px-3 py-2 pl-9 text-xs font-medium bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <Calendar size={14} className="absolute left-3 top-2.5 text-gray-500" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-gray-600">End Date</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    endDate: e.target.value,
                                    gracePeriodDate: formData.gracePeriodEnabled
                                        ? new Date(new Date(e.target.value).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                        : prev.gracePeriodDate
                                }))}
                                min={formData.startDate}
                                className="w-full px-3 py-2 pl-9 text-xs font-medium bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                            <Calendar size={14} className="absolute left-3 top-2.5 text-gray-500" />
                        </div>
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Clock size={16} className="text-purple-600" />
                            <div>
                                <h4 className="text-xs font-bold text-gray-900">Grace Period</h4>
                                <p className="text-[10px] text-gray-500">Allow late submissions after end date</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.gracePeriodEnabled}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    gracePeriodEnabled: e.target.checked,
                                    gracePeriodDate: e.target.checked
                                        ? new Date(new Date(prev.endDate).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                        : prev.gracePeriodDate
                                }))}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                    </div>

                    {formData.gracePeriodEnabled && (
                        <div className="animate-in slide-in-from-top-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase">
                                    Grace Period Deadline
                                </label>
                                {gracePeriodDays > 0 && (
                                    <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                        {gracePeriodDays} day{gracePeriodDays !== 1 ? 's' : ''} after end date
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="date"
                                    value={formData.gracePeriodDate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, gracePeriodDate: e.target.value }))}
                                    min={formData.endDate}
                                    className="flex-1 px-3 py-2 text-xs bg-gray-50 border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 outline-none"
                                />
                                <div className="text-xs text-gray-500 min-w-[100px]">
                                    {gracePeriodDays > 0 ? (
                                        <span className="text-purple-600 font-medium">
                                            +{gracePeriodDays} day{gracePeriodDays !== 1 ? 's' : ''}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">Same as end date</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderStep6 = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                {/* Main Notifications Toggle */}
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell size={16} className="text-blue-600" />
                        <div>
                            <h4 className="text-xs font-bold text-gray-800">Notifications</h4>
                            <p className="text-[10px] text-gray-500">Send notifications to users</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer w-12 h-6">
                        <input
                            type="checkbox"
                            checked={formData.notifyUsers}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                notifyUsers: e.target.checked,
                                notifyGmail: e.target.checked ? prev.notifyGmail : false,
                                notifyWhatsApp: e.target.checked ? prev.notifyWhatsApp : false
                            }))}
                            className="sr-only peer"
                        />
                        <div className="w-12 h-6 bg-gray-300 peer-checked:bg-blue-600 rounded-full peer-focus:outline-none transition-colors duration-200">
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${formData.notifyUsers ? 'translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                </div>

                {/* Notification Channels */}
                <div className={`p-3 space-y-2 transition-all duration-200 ${formData.notifyUsers ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="text-[10px] text-gray-500 mb-2 px-1">Select notification channels:</div>

                    {/* Gmail Channel */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-50 rounded-lg">
                                <Mail size={16} className="text-red-500" />
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-700">Email Notifications</div>
                                <div className="text-[10px] text-gray-500">Send notifications via Gmail</div>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer w-12 h-6">
                            <input
                                type="checkbox"
                                checked={formData.notifyGmail}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    notifyGmail: e.target.checked
                                }))}
                                disabled={!formData.notifyUsers}
                                className="sr-only peer"
                            />
                            <div className={`w-12 h-6 rounded-full transition-colors duration-200 ${formData.notifyUsers ? 'cursor-pointer' : 'cursor-not-allowed'} ${formData.notifyGmail ? 'bg-green-500' : 'bg-gray-300'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${formData.notifyGmail ? 'translate-x-6' : ''}`}></div>
                            </div>
                        </label>
                    </div>

                    {/* WhatsApp Channel */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg">
                                <MessageCircle size={16} className="text-green-500" />
                            </div>
                            <div>
                                <div className="text-xs font-medium text-gray-700">WhatsApp Notifications</div>
                                <div className="text-[10px] text-gray-500">Send notifications via WhatsApp</div>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer w-12 h-6">
                            <input
                                type="checkbox"
                                checked={formData.notifyWhatsApp}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    notifyWhatsApp: e.target.checked
                                }))}
                                disabled={!formData.notifyUsers}
                                className="sr-only peer"
                            />
                            <div className={`w-12 h-6 rounded-full transition-colors duration-200 ${formData.notifyUsers ? 'cursor-pointer' : 'cursor-not-allowed'} ${formData.notifyWhatsApp ? 'bg-green-500' : 'bg-gray-300'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${formData.notifyWhatsApp ? 'translate-x-6' : ''}`}></div>
                            </div>
                        </label>
                    </div>

                    {/* Status Message */}
                    <div className="mt-3 p-2 bg-gray-50 rounded text-center">
                        <div className="text-[10px] text-gray-600">
                            {formData.notifyUsers ? (
                                formData.notifyGmail || formData.notifyWhatsApp ? (
                                    <span className="text-green-600 font-medium">
                                        ✓ Notifications will be sent via {[
                                            formData.notifyGmail && "Email",
                                            formData.notifyWhatsApp && "WhatsApp"
                                        ].filter(Boolean).join(' & ')}
                                    </span>
                                ) : (
                                    <span className="text-yellow-600">
                                        ⚠ Notifications enabled but no channel selected
                                    </span>
                                )
                            ) : (
                                <span className="text-gray-500">Notifications are disabled</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Grade Sheet Option */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Award size={16} className="text-yellow-600" />
                        <div>
                            <h4 className="text-xs font-bold text-gray-800">Grade Sheet</h4>
                            <p className="text-[10px] text-gray-500">Provide detailed grade sheet to users</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer w-12 h-6">
                        <input
                            type="checkbox"
                            checked={formData.gradeSheet}
                            onChange={(e) => setFormData(prev => ({ ...prev, gradeSheet: e.target.checked }))}
                            className="sr-only peer"
                        />
                        <div className="w-12 h-6 bg-gray-300 peer-checked:bg-yellow-500 rounded-full transition-colors duration-200">
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${formData.gradeSheet ? 'translate-x-6' : ''}`}></div>
                        </div>
                    </label>
                </div>

                <div className="p-3">
                    <div className="text-[10px] text-gray-500">
                        Enable to provide detailed grade sheet to users after submission, including scores, correct answers, and performance analysis.
                    </div>
                </div>
            </div>
        </div>
    );

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 2: return renderStep2();
            case 3: return renderStep3();
            case 4: return renderStep4();
            case 5: return renderStep5();
            case 6: return renderStep6();
            default: return renderStep2();
        }
    };

    const getQuestionSummary = () => {
        if (formData.questionConfigType === 'general') {
            return `General (${formData.generalQuestionCount} questions)`;
        }
        const counts = formData.questionConfigType === 'selectionLevel'
            ? formData.selectionLevelCounts
            : formData.levelBasedCounts;
        const total = counts.easy + counts.medium + counts.hard;
        const parts = [];
        if (counts.easy > 0) parts.push(`${counts.easy} Easy`);
        if (counts.medium > 0) parts.push(`${counts.medium} Medium`);
        if (counts.hard > 0) parts.push(`${counts.hard} Hard`);
        return parts.length > 0 ? `${total} total (${parts.join(', ')})` : 'None configured';
    };

    const getNotificationSummary = () => {
        if (!formData.notifyUsers) return 'Disabled';
        const channels = [];
        if (formData.notifyGmail) channels.push('Gmail');
        if (formData.notifyWhatsApp) channels.push('WhatsApp');
        return channels.length > 0 ? channels.join(' & ') : 'Enabled (No channel selected)';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
            <div className="bg-white w-full max-w-7xl h-[95vh] md:h-[96vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
                    <div className="flex-1 min-w-0">
                        {/* Breadcrumb with icons */}
                        <div className="flex items-center text-sm text-gray-600 mb-2 overflow-x-auto gap-2">
                            <div className="flex items-center gap-1">
                                <Home size={14} className="text-gray-400" />
                                <span>Home</span>
                            </div>

                            {hierarchyData?.courseName && (
                                <>
                                    <ChevronRight size={12} className="text-gray-300" />
                                    <div className="flex items-center gap-1 text-blue-600">
                                        <BookOpen size={14} />
                                        <span>{hierarchyData.courseName}</span>
                                    </div>
                                </>
                            )}

                            {hierarchyData?.topicName && (
                                <>
                                    <ChevronRight size={12} className="text-gray-300" />
                                    <div className="flex items-center gap-1 text-purple-600">
                                        <Folder size={14} />
                                        <span>{hierarchyData.topicName}</span>
                                    </div>
                                </>
                            )}

                            {subcategoryLabel && (
                                <>
                                    <ChevronRight size={12} className="text-gray-300" />
                                    <div className="flex items-center gap-1 text-amber-600">
                                        <Activity size={14} />
                                        <span>{subcategoryLabel}</span>
                                    </div>
                                </>
                            )}

                            <ChevronRight size={12} className="text-gray-300" />
                            <div className="flex items-center gap-1 text-gray-900 font-medium">
                                <Settings size={14} />
                                <span>Manual Configuration</span>
                            </div>
                        </div>

                        {/* Title and info */}
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-gray-900">Manual Exercise Configuration</h2>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>Pedagogy: {tabType}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={onCancel}
                        className="p-2 text-gray-500 hover:text-gray-700 ml-4"
                    >
                        <X size={18} />
                    </button>
                </div>
                
                {/* Content Body */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <aside className="w-64 bg-slate-50 border-r border-slate-200 hidden md:flex flex-col">
                        <div className="p-6 overflow-y-auto h-full">
                            <div className="relative pl-2">
                                <div className="absolute left-8 top-6 bottom-6 w-0.5 bg-slate-200" />
                                <div className="space-y-6">
                                    {steps.map((step) => (
                                        <div
                                            key={step.id}
                                            className={`relative flex items-center gap-4 z-10 transition-all duration-300 p-2 rounded-xl border border-transparent
                                                ${step.active
                                                    ? 'bg-white shadow-sm border-slate-100 -ml-2 pl-4'
                                                    : 'hover:bg-slate-100/50'
                                                }`}
                                        >
                                            {/* Circle Indicator */}
                                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-300 bg-white
                                                ${step.active
                                                    ? 'border-blue-600 ring-4 ring-blue-50 scale-110'
                                                    : step.completed
                                                        ? 'border-green-500 bg-green-50'
                                                        : 'border-slate-300'
                                                }`}
                                            >
                                                {step.completed && <Check size={14} className="text-green-600" />}
                                                {step.active && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse" />}
                                                {!step.completed && !step.active && <div className="w-2 h-2 bg-slate-300 rounded-full" />}
                                            </div>

                                            {/* Text Content */}
                                            <div className={`transition-opacity ${step.active ? 'opacity-100' : 'opacity-70'}`}>
                                                <h4 className={`text-sm font-bold ${step.active ? 'text-slate-800' : 'text-slate-500'}`}>
                                                    {step.title}
                                                </h4>
                                                <p className="text-xs text-slate-400 font-medium">{step.subtitle}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Right Content */}
                    <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                        {/* Scrollable Area */}
                        <div className="flex-1 overflow-hidden mt-1 mb-16 mx-5">
                            <div className="max-w-5xl mx-auto h-full overflow-y-auto p-4">
                                <div className="mb-3">
                                    <h1 className="text-xl font-bold text-gray-900">
                                        {currentStep === 2 && 'Module Selection'}
                                        {currentStep === 3 && 'Basic Details'}
                                        {currentStep === 4 && 'Question Configuration'}
                                        {currentStep === 5 && 'Schedule Availability'}
                                        {currentStep === 6 && 'Grade Settings'}
                                    </h1>
                                    <p className="text-xs text-gray-500">
                                        {currentStep === 2 && 'Select programming module and languages'}
                                        {currentStep === 3 && 'Enter exercise details and time settings'}
                                        {currentStep === 4 && 'Configure question types, flow, and attempts'}
                                        {currentStep === 5 && 'Define exercise availability dates'}
                                        {currentStep === 6 && 'Review settings and configure notifications'}
                                    </p>
                                </div>
                                <div className="pb-8">
                                    {renderCurrentStep()}
                                </div>
                            </div>
                        </div>

                        {/* Sticky Footer */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex items-center justify-between z-20 shadow-sm">
                            <button
                                onClick={handleBack}
                                disabled={currentStep === 2 || isLoading}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs transition-all ${currentStep === 2
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                <ArrowLeft size={14} />
                                Back
                            </button>

                            <div className="flex items-center gap-3">
                                {/* Show Eye icon only on last step */}
                                {currentStep === 6 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowSummaryModal(true)}
                                        className="p-2.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="View Configuration Summary"
                                    >
                                        <Eye size={18} />
                                    </button>
                                )}
                                <button
                                    onClick={handleNext}
                                    disabled={isLoading || !validateCurrentStep()}
                                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-xs shadow-sm transition-all active:scale-95 ${validateCurrentStep()
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {isLoading ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : currentStep === 6 ? (
                                        'Create Exercise'
                                    ) : (
                                        <>
                                            Next
                                            <ArrowRight size={14} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Modal */}
            {showSummaryModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <FileText size={18} className="text-blue-600" />
                                <h3 className="font-bold text-gray-900 text-sm">Configuration Summary</h3>
                            </div>
                            <button onClick={() => setShowSummaryModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <div className="space-y-4">
                                {/* Basic Info Group */}
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">General Information</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Module</div>
                                            <div className="text-sm font-semibold text-gray-900 truncate">{formData.selectedModule || 'Not selected'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Duration</div>
                                            <div className="text-sm font-semibold text-gray-900">{formData.totalDuration} minutes</div>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-[10px] text-gray-500 mb-0.5">Languages</div>
                                            <div className="text-sm font-semibold text-gray-900">{formData.selectedLanguages.join(', ') || 'None selected'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Config Group */}
                                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Configuration Settings</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Question Config</div>
                                            <div className="text-sm font-semibold text-gray-900">{getQuestionSummary()}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Question Flow</div>
                                            <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                                {formData.questionFlow === 'freeFlow' ? (
                                                    <>
                                                        <Shuffle size={14} className="text-blue-500" />
                                                        Free Flow
                                                    </>
                                                ) : (
                                                    <>
                                                        <Lock size={14} className="text-purple-500" />
                                                        Controlled Flow
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Submission Attempts</div>
                                            <div className="text-sm font-semibold text-gray-900">{formData.attemptLimitEnabled ? `${formData.submissionAttempts} allowed` : 'Unlimited'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Grade Sheet</div>
                                            <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                                <Award size={14} className={formData.gradeSheet ? 'text-yellow-500' : 'text-gray-400'} />
                                                {formData.gradeSheet ? 'Enabled' : 'Disabled'}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Notifications</div>
                                            <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                                <Bell size={14} className={formData.notifyUsers ? 'text-blue-500' : 'text-gray-400'} />
                                                {getNotificationSummary()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-right">
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                Close Summary
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManualSettings;