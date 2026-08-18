import React, { useState } from 'react';
import {
    ArrowLeft, ArrowRight, CheckCircle, X,
    Code, FileText, Layers,
    Calendar, Settings, Check,
    Plus, Minus,
    Loader2, Clock,
    Eye, ChevronRight, Home, BookOpen, Folder, Activity,
    ChevronDown
} from 'lucide-react';
import { toast } from 'react-toastify';

interface PracticeSettingsProps {
    onComplete: (data: PracticeConfigurationData) => void;
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
}

export interface PracticeConfigurationData {
    selectedModule: string;
    selectedLanguages: string[];
    exerciseId: string;
    exerciseName: string;
    description: string;
    exerciseLevel: 'beginner' | 'intermediate' | 'expert';
    totalDuration: number;
    questionConfigType: 'general' | 'levelBased' | 'selectionLevel';
    generalQuestionCount: number;
    selectionLevelCounts: {
        easy: number;
        medium: number;
        hard: number;
    };
    levelBasedCounts: {
        easy: number;
        medium: number;
        hard: number;
    };
    questionFlow: 'freeFlow' | 'levelBased';
    attemptLimitEnabled: boolean;
    submissionAttempts: number;
    startDate: string;
    endDate: string;
    gracePeriodEnabled: boolean;
    gracePeriodDate: string;
}

interface Step {
    id: number;
    title: string;
    subtitle: string;
    completed: boolean;
    active: boolean;
    icon: React.ReactNode;
}

const PracticeSettings: React.FC<PracticeSettingsProps> = ({
    onComplete,
    onCancel,
    tabType,
    subcategoryLabel,
    hierarchyData = {}
}) => {
    const [currentStep, setCurrentStep] = useState(2);
    const [isLoading, setIsLoading] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    const today = new Date().toISOString().split('T')[0];
    const dateOfCreation = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const [practiceData, setPracticeData] = useState<PracticeConfigurationData>({
        selectedModule: '',
        selectedLanguages: [],
        exerciseId: `PR${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
        exerciseName: '',
        description: '',
        exerciseLevel: 'intermediate',
        totalDuration: 1,
        questionConfigType: 'general',
        generalQuestionCount: 5,
        selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
        levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
        questionFlow: 'freeFlow',
        attemptLimitEnabled: false,
        submissionAttempts: 1,
        startDate: today,
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        gracePeriodEnabled: false,
        gracePeriodDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    const steps: Step[] = [
        { id: 2, title: 'Module', subtitle: 'Languages', completed: currentStep > 2, active: currentStep === 2, icon: <Code size={16} /> },
        { id: 3, title: 'Details', subtitle: 'Info & Time', completed: currentStep > 3, active: currentStep === 3, icon: <FileText size={16} /> },
        { id: 4, title: 'Questions', subtitle: 'Configuration', completed: currentStep > 4, active: currentStep === 4, icon: <Layers size={16} /> },
        { id: 5, title: 'Schedule', subtitle: 'Dates', completed: currentStep > 5, active: currentStep === 5, icon: <Calendar size={16} /> },
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
                return practiceData.selectedModule.trim() !== '' && practiceData.selectedLanguages.length > 0;
            case 3:
                return (
                    practiceData.exerciseId.trim() !== '' &&
                    practiceData.exerciseName.trim() !== '' &&
                    practiceData.description.trim() !== '' &&
                    practiceData.totalDuration > 0
                );
            case 4:
                if (practiceData.questionConfigType === 'general') {
                    return practiceData.generalQuestionCount > 0;
                }
                const counts = practiceData.questionConfigType === 'selectionLevel'
                    ? practiceData.selectionLevelCounts
                    : practiceData.levelBasedCounts;
                return (counts.easy + counts.medium + counts.hard) > 0;
            case 5:
                const start = new Date(practiceData.startDate);
                const end = new Date(practiceData.endDate);
                if (start >= end) return false;
                if (practiceData.gracePeriodEnabled) return new Date(practiceData.gracePeriodDate) >= end;
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

        if (currentStep < 5) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleBack = () => currentStep > 2 && setCurrentStep(currentStep - 1);

    const handleComplete = () => {
        if (validateCurrentStep()) {
            setIsLoading(true);

            // Convert hours to minutes for the API
            const durationInMinutes = practiceData.totalDuration * 60;

            // Prepare the data to send back to ExerciseSettings
            const completedData: PracticeConfigurationData = {
                ...practiceData,
                totalDuration: durationInMinutes,
            };

            setTimeout(() => {
                onComplete(completedData);
            }, 500);
        }
    };

    const toggleLanguage = (language: string) => {
        setPracticeData(prev => ({
            ...prev,
            selectedLanguages: prev.selectedLanguages.includes(language)
                ? prev.selectedLanguages.filter(l => l !== language)
                : [...prev.selectedLanguages, language]
        }));
    };

    const toggleAllLanguages = () => {
        const currentLanguages = moduleLanguages[practiceData.selectedModule]?.map(lang => lang.name) || [];
        const allSelected = currentLanguages.every(lang => practiceData.selectedLanguages.includes(lang));
        setPracticeData(prev => ({
            ...prev,
            selectedLanguages: allSelected ? [] : [...currentLanguages]
        }));
    };

    const getTotalQuestions = (): number => {
        if (practiceData.questionConfigType === 'general') {
            return practiceData.generalQuestionCount;
        }
        const counts = practiceData.questionConfigType === 'selectionLevel'
            ? practiceData.selectionLevelCounts
            : practiceData.levelBasedCounts;
        return counts.easy + counts.medium + counts.hard;
    };

    // --- Render Steps ---
    const renderStep2 = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Module Selection */}
            <div className="inline-block">
                <select
                    value={practiceData.selectedModule || ''}
                    onChange={(e) => setPracticeData(prev => ({
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
            {practiceData.selectedModule && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-bold uppercase text-slate-500">Programming Languages</h4>
                        <button
                            type="button"
                            onClick={toggleAllLanguages}
                            className="text-[10px] font-medium text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                        >
                            {moduleLanguages[practiceData.selectedModule]?.every(lang => practiceData.selectedLanguages.includes(lang.name)) ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {moduleLanguages[practiceData.selectedModule]?.map(language => {
                            const isSelected = practiceData.selectedLanguages.includes(language.name);
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
                                    {/* Add language icon */}
                                    <div className="w-4 h-4 flex items-center justify-center">
                                        <img
                                            src={language.icon}
                                            alt={language.name}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                // Fallback if image doesn't exist
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
                        value={practiceData.exerciseId}
                        onChange={(e) => setPracticeData(prev => ({ ...prev, exerciseId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Exercise Name</label>
                    <input
                        type="text"
                        value={practiceData.exerciseName}
                        onChange={(e) => setPracticeData(prev => ({ ...prev, exerciseName: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="e.g. Array Logic"
                    />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600">Description</label>
                <textarea
                    value={practiceData.description}
                    onChange={(e) => setPracticeData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-300 rounded-lg focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none h-20 resize-none"
                    placeholder="Brief description of the exercise..."
                />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Difficulty Level</label>
                    <div className="flex p-1 bg-gray-100 rounded-lg">
                        {(['beginner', 'intermediate', 'expert'] as const).map(level => (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setPracticeData(prev => ({ ...prev, exerciseLevel: level }))}
                                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-medium rounded transition-all ${practiceData.exerciseLevel === level ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                                    }`}
                            >
                                {level.charAt(0).toUpperCase() + level.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-gray-600">Total Duration</label>
                        <span className="text-[10px] text-gray-400 font-medium">in minutes</span>
                    </div>

                    <div className="flex items-center bg-white border border-gray-300 rounded-lg h-9 hover:border-gray-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                        <button
                            type="button"
                            onClick={() => setPracticeData(prev => ({
                                ...prev,
                                totalDuration: Math.max(5, prev.totalDuration - 5)
                            }))}
                            className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-l-lg border-r border-gray-100 transition-colors"
                        >
                            <Minus size={14} />
                        </button>

                        <input
                            type="number"
                            min="5"
                            step="5"
                            value={practiceData.totalDuration}
                            onChange={(e) => setPracticeData(prev => ({
                                ...prev,
                                totalDuration: Math.max(0, parseInt(e.target.value) || 0)
                            }))}
                            className="flex-1 text-center bg-transparent text-sm font-bold text-gray-700 outline-none appearance-none"
                        />

                        <button
                            type="button"
                            onClick={() => setPracticeData(prev => ({
                                ...prev,
                                totalDuration: prev.totalDuration + 5
                            }))}
                            className="w-10 h-full flex items-center justify-center text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-r-lg border-l border-gray-100 transition-colors"
                        >
                            <Plus size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderStep4 = () => {
        const totalQuestions = getTotalQuestions();

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                {/* Configuration Type */}
                <div className="space-y-2 mt-5">
                    <label className="block text-sm font-semibold text-gray-800">
                        Configuration Type
                    </label>
                    <select
                        value={practiceData.questionConfigType}
                        onChange={(e) => {
                            const newType = e.target.value as 'general' | 'levelBased' | 'selectionLevel';
                            setPracticeData(prev => ({
                                ...prev,
                                questionConfigType: newType,
                                generalQuestionCount: 0,
                                selectionLevelCounts: { easy: 0, medium: 0, hard: 0 },
                                levelBasedCounts: { easy: 0, medium: 0, hard: 0 },
                            }));
                        }}
                        className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
                    >
                        <option value="general">General Configuration</option>
                        <option value="levelBased">Level-Based Configuration</option>
                        <option value="selectionLevel">Selection Level Configuration</option>
                    </select>
                </div>



                {/* Question Count Configuration */}
                <div className="space-y-6">

                    {/* GENERAL CONFIGURATION */}
                    {practiceData.questionConfigType === 'general' ? (
                        <div className="p-5 border border-gray-200 rounded-lg bg-white">
                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-gray-800">
                                    Total Questions
                                </label>
                                <div className="relative max-w-xs">
                                    <input
                                        type="number"
                                        min="1"
                                        value={practiceData.generalQuestionCount}
                                        onChange={(e) =>
                                            setPracticeData(prev => ({
                                                ...prev,
                                                generalQuestionCount: Math.max(1, parseInt(e.target.value) || 1),
                                            }))
                                        }
                                        className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-colors"
                                        placeholder="Enter total number of questions"
                                    />
                                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                        <span className="text-gray-500 text-sm">questions</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (

                        /* LEVEL-BASED CONFIGURATION */
                        <div className="mt-4 rounded-lg bg-white">
                            <h4 className="text-sm font-semibold text-gray-800 mb-3">
                                {practiceData.questionConfigType === 'levelBased'
                                    ? 'Configure Questions by Difficulty Level'
                                    : 'Configure Selection Level Questions'}
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {['easy', 'medium', 'hard'].map(level => {
                                    const l = level as keyof typeof practiceData.selectionLevelCounts;
                                    const counts =
                                        practiceData.questionConfigType === 'selectionLevel'
                                            ? practiceData.selectionLevelCounts
                                            : practiceData.levelBasedCounts;

                                    const count = counts[l];

                                    // Professional color scheme
                                    const levelStyles = {
                                        easy: {
                                            label: 'Easy',
                                            color: 'text-emerald-700',
                                            bg: 'bg-emerald-50',
                                            border: 'border-emerald-200',
                                            icon: '●'
                                        },
                                        medium: {
                                            label: 'Medium',
                                            color: 'text-amber-700',
                                            bg: 'bg-amber-50',
                                            border: 'border-amber-200',
                                            icon: '●'
                                        },
                                        hard: {
                                            label: 'Hard',
                                            color: 'text-rose-700',
                                            bg: 'bg-rose-50',
                                            border: 'border-rose-200',
                                            icon: '●'
                                        }
                                    };

                                    const style = levelStyles[l];

                                    return (
                                        <div key={l} className={`p-4 rounded-lg border ${style.border} ${style.bg}`}>
                                            <div className="space-y-4">
                                                {/* Level Header */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-xs ${style.color}`}>{style.icon}</span>
                                                        <h5 className={`text-sm font-semibold ${style.color}`}>
                                                            {style.label}
                                                        </h5>
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        <span className="font-medium">{count}</span> selected
                                                    </div>
                                                </div>

                                                {/* Counter Controls */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            onClick={() => {
                                                                const newCounts = { ...counts, [l]: Math.max(0, count - 1) };
                                                                setPracticeData(prev => ({
                                                                    ...prev,
                                                                    [practiceData.questionConfigType === 'selectionLevel'
                                                                        ? 'selectionLevelCounts'
                                                                        : 'levelBasedCounts']: newCounts,
                                                                }));
                                                            }}
                                                            className={`
                              w-8 h-8 flex items-center justify-center border rounded
                              transition-colors duration-150
                              ${count === 0
                                                                    ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                                                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 active:bg-gray-100'
                                                                }
                            `}
                                                            disabled={count === 0}
                                                        >
                                                            <Minus size={16} />
                                                        </button>

                                                        <div className="flex-1 mx-3">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={count}
                                                                onChange={(e) => {
                                                                    const value = Math.max(0, parseInt(e.target.value) || 0);
                                                                    const newCounts = { ...counts, [l]: value };
                                                                    setPracticeData(prev => ({
                                                                        ...prev,
                                                                        [practiceData.questionConfigType === 'selectionLevel'
                                                                            ? 'selectionLevelCounts'
                                                                            : 'levelBasedCounts']: newCounts,
                                                                    }));
                                                                }}
                                                                className="w-full px-3 py-2 text-center text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none"
                                                            />
                                                        </div>

                                                        <button
                                                            onClick={() => {
                                                                const newCounts = { ...counts, [l]: count + 1 };
                                                                setPracticeData(prev => ({
                                                                    ...prev,
                                                                    [practiceData.questionConfigType === 'selectionLevel'
                                                                        ? 'selectionLevelCounts'
                                                                        : 'levelBasedCounts']: newCounts,
                                                                }));
                                                            }}
                                                            className="
                              w-8 h-8 flex items-center justify-center border border-gray-300 rounded
                              bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400
                              active:bg-gray-100 transition-colors duration-150
                            "
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    </div>

                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {practiceData.questionConfigType !== 'general' && (
                                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mt-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-gray-800">
                                                Total Questions Summary
                                            </div>
                                            <div className="text-xs text-gray-600 mt-0.5">
                                                Configured across all difficulty levels
                                            </div>
                                        </div>
                                        <div className="flex items-baseline gap-1">
                                            <div className="text-2xl font-bold text-gray-900">
                                                {totalQuestions}
                                            </div>
                                            <span className="text-sm text-gray-600">questions</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {/* Distribution Summary */}
                            <div className="mt-6 pt-6 border-t border-gray-200">
                                <div className="text-sm text-gray-600">
                                    <span className="font-medium">Distribution:</span>
                                    <span className="ml-2">
                                        Easy: {practiceData.questionConfigType === 'selectionLevel'
                                            ? practiceData.selectionLevelCounts.easy
                                            : practiceData.levelBasedCounts.easy},
                                        Medium: {practiceData.questionConfigType === 'selectionLevel'
                                            ? practiceData.selectionLevelCounts.medium
                                            : practiceData.levelBasedCounts.medium},
                                        Hard: {practiceData.questionConfigType === 'selectionLevel'
                                            ? practiceData.selectionLevelCounts.hard
                                            : practiceData.levelBasedCounts.hard}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
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

    const gracePeriodDays = practiceData.gracePeriodEnabled 
        ? calculateDaysBetween(practiceData.endDate, practiceData.gracePeriodDate)
        : 0;

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-600">Start Date</label>
                    <div className="relative">
                        <input
                            type="date"
                            value={practiceData.startDate}
                            onChange={(e) => setPracticeData(prev => ({ ...prev, startDate: e.target.value }))}
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
                            value={practiceData.endDate}
                            onChange={(e) => setPracticeData(prev => ({ 
                                ...prev, 
                                endDate: e.target.value,
                                gracePeriodDate: practiceData.gracePeriodEnabled 
                                    ? new Date(new Date(e.target.value).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                                    : prev.gracePeriodDate
                            }))}
                            min={practiceData.startDate}
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
                            checked={practiceData.gracePeriodEnabled}
                            onChange={(e) => setPracticeData(prev => ({
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

                {practiceData.gracePeriodEnabled && (
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
                                value={practiceData.gracePeriodDate}
                                onChange={(e) => setPracticeData(prev => ({ ...prev, gracePeriodDate: e.target.value }))}
                                min={practiceData.endDate}
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
                        
                        <div className="text-[10px] text-gray-400 pt-1">
                            <div className="flex items-center gap-1">
                                <Calendar size={10} />
                                <span>End Date: {practiceData.endDate}</span>
                                <ChevronRight size={10} className="mx-1" />
                                <span>Grace End: {practiceData.gracePeriodDate}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

    const renderCurrentStep = () => {
        switch (currentStep) {
            case 2: return renderStep2();
            case 3: return renderStep3();
            case 4: return renderStep4();
            case 5: return renderStep5();
            default: return renderStep2();
        }
    };

    const getQuestionSummary = () => {
        if (practiceData.questionConfigType === 'general') {
            return `General (${practiceData.generalQuestionCount} questions)`;
        }
        const counts = practiceData.questionConfigType === 'selectionLevel'
            ? practiceData.selectionLevelCounts
            : practiceData.levelBasedCounts;
        const total = counts.easy + counts.medium + counts.hard;
        const parts = [];
        if (counts.easy > 0) parts.push(`${counts.easy} Easy`);
        if (counts.medium > 0) parts.push(`${counts.medium} Medium`);
        if (counts.hard > 0) parts.push(`${counts.hard} Hard`);
        return parts.length > 0 ? `${total} total (${parts.join(', ')})` : 'None configured';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
            <style>{`
  /* Custom Scrollbar Styles */
  .custom-scrollbar::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 10px;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 10px;
    border: 2px solid #f1f5f9;
  }
  
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
  
  /* For Firefox */
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #94a3b8 #f1f5f9;
  }
`}</style>

            <div className="bg-white w-full max-w-7xl h-[95vh] md:h-[96vh] rounded-xl shadow-2xl overflow-hidden flex flex-col">
                {/* Minimal Header with Icons */}
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

                            {hierarchyData?.moduleName && (
                                <>
                                    <ChevronRight size={12} className="text-gray-300" />
                                    <div className="flex items-center gap-1 text-green-600">
                                        <Folder size={14} />
                                        <span>{hierarchyData.moduleName}</span>
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
                                <span>Practice Configuration</span>
                            </div>
                        </div>

                        {/* Title and info */}
                        <div className="flex items-center gap-3">
                            <h2 className="text-lg font-semibold text-gray-900">Practice Exercise Settings</h2>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <span>Date: {dateOfCreation}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
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
                        <div className="p-6 custom-scrollbar-thin overflow-y-auto h-full">
                            <div className="relative pl-2">

                                {/* --- FIX START: Adjusted vertical line --- */}
                                {/* Changed top-4 to top-6 (24px) and bottom-12 to bottom-6 (24px) */}
                                {/* This calculates: 8px Padding + 16px (Half of 32px circle) = 24px Center */}
                                <div className="absolute left-8 top-6 bottom-6 w-0.5 bg-slate-200" />
                                {/* --- FIX END --- */}

                                <div className="space-y-6">
                                    {steps.map((step, index) => (
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
                    <div className="flex-1 flex flex-col min-w-0 bg-white relative ">
                        {/* Scrollable Area */}
                        <div className="flex-1 overflow-hidden mt-3 mb-16 mx-5"> {/* CHANGED: Added mb-16 to create space for footer */}
                            <div className="max-w-5xl mx-auto h-full overflow-y-auto custom-scrollbar p-4">
                                <div className="mb-3">
                                    <h1 className="text-xl font-bold text-gray-900">
                                        {currentStep === 2 && 'Module Selection'}
                                        {currentStep === 3 && 'Basic Details'}
                                        {currentStep === 4 && 'Question Configuration'}
                                        {currentStep === 5 && 'Schedule Availability'}
                                    </h1>
                                    <p className="text-xs text-gray-500">
                                        {currentStep === 2 && 'Select programming module and languages'}
                                        {currentStep === 3 && 'Enter exercise details and time settings'}
                                        {currentStep === 4 && 'Configure question types and flow'}
                                        {currentStep === 5 && 'Define exercise availability dates'}
                                    </p>
                                </div>
                                <div className="pb-8"> {/* CHANGED: Added pb-8 to create padding at bottom */}
                                    {renderCurrentStep()}
                                </div>
                            </div>
                        </div>

                        {/* Sticky Footer */}
                        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 flex items-center justify-between z-20 shadow-sm"> {/* CHANGED: Added shadow-sm */}
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
                                {currentStep === 5 && (
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
                                        ? 'bg-green-600 text-white hover:bg-green-700'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {isLoading ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : currentStep === 5 ? (
                                        'Complete Practice Setup'
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
                                <FileText size={18} className="text-green-600" />
                                <h3 className="font-bold text-gray-900 text-sm">Practice Configuration Summary</h3>
                            </div>
                            <button onClick={() => setShowSummaryModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar-thin">
                            <div className="space-y-4">
                                {/* Basic Info Group */}
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                    <h4 className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">General Information</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Module</div>
                                            <div className="text-sm font-semibold text-gray-900 truncate">{practiceData.selectedModule || 'Not selected'}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Duration</div>
                                            <div className="text-sm font-semibold text-gray-900">{practiceData.totalDuration} minutes</div>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-[10px] text-gray-500 mb-0.5">Languages</div>
                                            <div className="text-sm font-semibold text-gray-900">{practiceData.selectedLanguages.join(', ') || 'None selected'}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Schedule Group */}
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                    <h4 className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">Schedule Settings</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">Start Date</div>
                                            <div className="text-sm font-semibold text-gray-900">{practiceData.startDate}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-gray-500 mb-0.5">End Date</div>
                                            <div className="text-sm font-semibold text-gray-900">{practiceData.endDate}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-[10px] text-gray-500 mb-0.5">Grace Period</div>
                                            <div className={`text-sm font-semibold flex items-center gap-2 ${practiceData.gracePeriodEnabled ? 'text-green-700' : 'text-gray-500'}`}>
                                                {practiceData.gracePeriodEnabled ? (
                                                    <>
                                                        <CheckCircle size={14} />
                                                        Enabled (Until {practiceData.gracePeriodDate})
                                                    </>
                                                ) : (
                                                    'Disabled'
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Config Group */}
                                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                                    <h4 className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">Question Configuration</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <div className="text-[10px] text-gray-500 mb-0.5">Question Configuration</div>
                                            <div className="text-sm font-semibold text-gray-900">{getQuestionSummary()}</div>
                                        </div>
                                        <div className="col-span-2">
                                            <div className="text-[10px] text-gray-500 mb-0.5">Difficulty Level</div>
                                            <div className="text-sm font-semibold text-gray-900">{practiceData.exerciseLevel.charAt(0).toUpperCase() + practiceData.exerciseLevel.slice(1)}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-5 py-3 bg-green-50 border-t border-green-100 text-right">
                            <button
                                onClick={() => setShowSummaryModal(false)}
                                className="px-4 py-2 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
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

export default PracticeSettings;