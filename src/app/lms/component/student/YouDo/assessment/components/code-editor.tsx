"use client"
import { getToken } from "@/lib/session";
import { hostOf } from "@/lib/frameEmbed";

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useRouter } from 'next/navigation';
import { useExamLiveEmitter } from './useExamLiveEmitter';
import ScreenShareGuard from './ScreenShareGuard';
import TestMessageBell from './TestMessageBell';
import { setSharedScreenStream, markScreenCaptureStarting, clearScreenCaptureInProgress } from './screenStreamStore';

// Then, inside your CodeEditor component, add the router hook:

import {
    Play, RotateCcw, CheckCircle2, Maximize2, Minimize2,  // Add this
    X, Code, FileText, AlertCircle, Terminal, Menu, ChevronRight, ChevronLeft, Search, AlertTriangle, CheckCircle, XCircle, Lock, ArrowUpDown, X as XIcon, Loader2, SkipForward, Clock, ShieldAlert, Camera, Video, Save, LogOut, Trash2, Shield, Mic, MicOff, ShieldCheck, UserCheck, Monitor, Info, Send, ListChecks,
    Award,
    BarChart3
} from "lucide-react"
import dynamic from 'next/dynamic'
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css'
import Script from 'next/script'
import ExerciseInfoModals, { ExerciseInfoButtons } from './ExerciseInfoModals'
// Evaluation Method wiring — shared with the We_Do editor. `resolveEvaluationMethod`
// gives the method with the per-tab legacy fallback; `evaluateWithAi` runs the
// Gemini call for AI grading. Manual and AI are new for You_Do; Test Case is
// unchanged (this file already implemented it).
import { resolveEvaluationMethod } from '@/lib/resolveEvaluationMethod';
import { evaluateWithAi } from '@/lib/aiEvaluator';
import { useAssessmentSecurity, normalizeSecurityConfig } from './useAssessmentSecurity'
import { useScreenRecording } from './useScreenRecording'
import { useFaceProctor } from './useFaceProctor'

// Piston API configuration
// Self-hosted Piston (Docker, port 2000) via NEXT_PUBLIC_PISTON_URL; falls back to the public API.
const PISTON_API_URL = process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston/execute"

// Cloudinary configuration for recording
const CLOUDINARY_CLOUD_NAME = "dusxfgvhi";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;
const CLOUDINARY_PRESET = "dusxfgvhi";

const MonacoEditor = dynamic(
    () => import('@monaco-editor/react'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                    <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-xs text-gray-600">Loading Editor...</p>
                </div>
            </div>
        )
    }
)

interface ToastNotification {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    duration: number;
}

interface ExerciseInformation {
    exerciseId: string
    exerciseName: string
    description: string
    exerciseLevel: "beginner" | "medium" | "hard"
    _id: string
    totalPoints?: number
    totalQuestions?: number
    estimatedTime?: number
    totalMarksProgramming?: number
    totalMarks?: number
    totalDuration?: number
}

interface ProgrammingSettings {
    selectedModule: string
    selectedLanguages: string[]
    _id: string
    levelConfiguration?: {
        levelBased?: {
            easy: number
            medium: number
            hard: number
        }
        levelType: string
        general: number
    }
}

interface CompilerSettings {
    allowCopyPaste: boolean
    autoSuggestion: boolean
    autoCloseBrackets: boolean
    _id: string
    theme?: string
    fontSize?: number
    tabSize?: number
}

interface AvailabilityPeriod {
    startDate: string
    endDate: string
    gracePeriodAllowed: boolean
    gracePeriodDate: string | null
    _id: string
}

interface QuestionBehavior {
    shuffleQuestions: boolean
    allowNext: boolean
    allowSkip: boolean
    attemptLimitEnabled: boolean
    maxAttempts: number
    _id: string
    showPoints?: boolean
    showDifficulty?: boolean
    allowHintUsage?: boolean
    allowTestRun?: boolean
}

interface ManualEvaluation {
    enabled: boolean
    submissionNeeded: boolean
    _id: string
}

interface EvaluationSettings {
    practiceMode: boolean
    manualEvaluation: ManualEvaluation
    aiEvaluation: boolean
    automationEvaluation: boolean
    _id: string
    passingScore?: number
    showResultsImmediately?: boolean
    allowReview?: boolean
}

interface GroupSettings {
    groupSettingsEnabled: boolean
    showExistingUsers: boolean
    selectedGroups: any[]
    chatEnabled: boolean
    _id: string
    collaborationEnabled?: boolean
}

interface ExerciseQuestion {
    _id: string
    title: string
    description: string | {
        text: string
        imageUrl: string | null
        imageAlignment: string
        imageSizePercent: number
    }
    difficulty: "easy" | "medium" | "hard" | "beginner" | "intermediate" | "advanced"
    sampleInput: string
    sampleOutput: string
    points: number
    score?: number
    constraints: string[]
    hints: Array<{
        hintText: string
        pointsDeduction: number
        isPublic: boolean
        sequence: number
        _id: string
    }>
    testCases: Array<{
        input: string
        expectedOutput: string
        isSample: boolean
        isHidden: boolean
        points: number
        explanation?: string
        _id: string
    }>
    solutions: {
        startedCode?: string
        staetedCode?: string
        functionName: string
        language: string
        _id: string
    }
    timeLimit: number
    memoryLimit: number
    isActive: boolean
    sequence: number
    createdAt: string
    updatedAt: string
    allowedLanguages?: string[]
}

interface Exercise {
    _id: string
    exerciseInformation: ExerciseInformation
    programmingSettings: ProgrammingSettings
    compilerSettings: CompilerSettings
    availabilityPeriod: AvailabilityPeriod
    questionBehavior: QuestionBehavior
    evaluationSettings: EvaluationSettings
    groupSettings: GroupSettings
    createdAt: string
    updatedAt: string
    version?: number
    questions: ExerciseQuestion[]
    courseId?: string
    exerciseType?: string
    gradeSettings?: {
        programmingGradeToPass?: number
        combinedGradeToPass?: number
    }
    questionConfiguration?: {
        programmingQuestionConfiguration?: {
            questionFlow?: 'freeFlow' | 'controlled'
            questionConfigType?: 'general' | 'levelBased' | 'selectionLevel'
            scoreSettings?: {
                scoreType?: string          // 'evenMarks' | 'levelBasedMarks'
                evenMarks?: number          // used when scoreType === 'evenMarks'
                levelBasedMarks?: Record<string, number>  // legacy: { easy: n, medium: n, hard: n }
                levelScoringConfiguration?: {
                    easy?: { type?: string; marksPerQuestion?: number; totalMarks?: number; questionCount?: number }
                    medium?: { type?: string; marksPerQuestion?: number; totalMarks?: number; questionCount?: number }
                    hard?: { type?: string; marksPerQuestion?: number; totalMarks?: number; questionCount?: number }
                }
            }
        }
    }
    securitySettings?: {
        timerEnabled?: boolean
        timerDuration?: number
        cameraMicEnabled?: boolean
        fullScreenMode?: boolean
        tabSwitchAllowed?: boolean
        maxTabSwitches?: number
        disableClipboard?: boolean
        screenRecordingEnabled?: boolean
    }
}

interface ProblemData {
    id: number
    title: string
    description: string
    difficulty: "Easy" | "Medium" | "Hard"
    examples: Array<{
        input: string
        output: string
        explanation?: string
    }>
    constraints: string[]
    initialCode: string
    hints?: string[]
    solution?: string
}

interface LogEntry {
    id: string;
    type: 'stdout' | 'stderr' | 'stdin' | 'system' | 'error' | 'warning' | 'success' | 'info';
    content: string;
    timestamp: number;
}

interface SecuritySettings {
    timerEnabled?: boolean;
    timerDuration?: number;
    cameraMicEnabled?: boolean;
    fullScreenMode?: boolean;
    tabSwitchAllowed?: boolean;
    maxTabSwitches?: number;
    disableClipboard?: boolean;
    screenRecordingEnabled?: boolean;
    // Extra flags surfaced in the SecurityAgreementModal bullet list. Same
    // names as the normalised config (see normalizeSecurityConfig in
    // ./useAssessmentSecurity); we forward them through the modal's prop
    // instead of reading the parent's closure (`_normSecurity`), which was
    // throwing ReferenceError once the modal was extracted into its own
    // component.
    preventRightClick?: boolean;
    preventDevTools?: boolean;
    preventBackNavigation?: boolean;
    preventBrowserClose?: boolean;
}

// In your CodeEditor component, update the interface
interface CodeEditorProps {
    exercise?: Exercise;
    defaultProblems?: ProblemData[];
    onDropdownCollapsed?: () => void;
    breadcrumbCollapsed?: boolean;
    onBreadcrumbCollapseToggle?: () => void;
    theme?: "light" | "dark";
    courseId?: string;
    nodeId?: string;
    nodeName?: string;
    nodeType?: string;
    subcategory?: string;
    category?: string;
    studentId?: string;
    onBack?: () => void;
    // Add these new props
    onCloseExercise?: () => void; // Renamed for clarity
    onResetExercise?: () => void; // Alternative: specific function to reset exercise
    courseName?: string
    hierarchy?: string[]
    onNavigateToBreadcrumb?: (level: 'course' | 'hierarchy' | 'category') => void
    resetProgress?: boolean
    /** When true: suppresses internal assessment-mode security modal and browser fullscreen */
    embedded?: boolean
    /** When true: skip the security-agreement modal and auto-start (the You-Do
     * instructions page already showed the security rules). Enforcement still runs. */
    skipSecurityModal?: boolean
    /** Section mode: called when Next is pressed on the LAST problem (e.g. Combined → next part). */
    onCrossNext?: () => void
    /** Section mode: called when Prev is pressed on the FIRST problem (e.g. Combined → back to MCQ). */
    onCrossPrev?: () => void
    /** Label for the last-problem cross button (e.g. "Next Section" / "Submit Test"). Defaults to "Next". */
    crossNextLabel?: string
    /** Combined mode: callback to open the Submit Test dialog from the parent. */
    onSubmitTest?: () => void
    /** When provided, display this value (seconds) as timer instead of starting own countdown. */
    externalTimeLeft?: number
}
// Render a ProgContentBlock[] array to HTML
const renderBlocksToHtml = (blocks: any[]): string =>
    blocks.map((block: any) => {
        if (block.type === 'text') return block.value || '';
        if (block.type === 'code') {
            const escaped = (block.value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre style="background:${block.bgColor || '#f5f5f5'};border-radius:8px;padding:10px 14px;font-size:12.5px;font-family:ui-monospace,monospace;overflow-x:auto;line-height:1.6;margin:6px 0"><code class="language-${block.language || ''}">${escaped}</code></pre>`;
        }
        if (block.type === 'image') {
            const align = block.alignment === 'right' ? 'flex-end' : block.alignment === 'center' ? 'center' : 'flex-start';
            return `<div style="display:flex;justify-content:${align};margin:6px 0"><img src="${block.url}" alt="" style="max-width:${block.sizePercent || 100}%;border-radius:8px;border:1px solid #e4e4ed" /></div>`;
        }
        return '';
    }).join('');

// Helper to extract description HTML from rich blocks or fallback to description.text
// Helper to extract description HTML from rich blocks or fallback to description.text
const getDescriptionHtml = (question: ExerciseQuestion): string => {
    // Priority 1: description is an object with text array (new format)
    if (typeof question.description === 'object' && question.description !== null) {
        const desc = question.description as any;

        // Check if description.text is an array of blocks
        if (Array.isArray(desc.text) && desc.text.length > 0) {
            return renderBlocksToHtml(desc.text);
        }

        // Check if description has direct contentBlocks
        if (Array.isArray(desc.contentBlocks) && desc.contentBlocks.length > 0) {
            return renderBlocksToHtml(desc.contentBlocks);
        }

        // If description.text is a string, use it
        if (typeof desc.text === 'string' && desc.text.trim()) {
            let html = desc.text;
            if (desc.imageUrl) {
                html += `<img src="${desc.imageUrl}" style="max-width:${desc.imageSizePercent || 100}%;display:block;margin-top:8px;border-radius:8px" />`;
            }
            return html;
        }
    }

    // Priority 2: description is directly a ProgContentBlock[] array (old format)
    if (Array.isArray(question.description) && (question.description as any[]).length > 0) {
        return renderBlocksToHtml(question.description as any[]);
    }

    // Priority 3: programmingQuestionDescription (legacy field — backward compat)
    if (Array.isArray((question as any).programmingQuestionDescription) &&
        (question as any).programmingQuestionDescription.length > 0) {
        return renderBlocksToHtml((question as any).programmingQuestionDescription);
    }

    // Priority 4: plain string fallback
    if (typeof question.description === 'string') {
        return question.description;
    }

    return 'Solve the question';
};
const convertExerciseToProblems = (exercise: Exercise): ProblemData[] => {
    if (!exercise.questions || exercise.questions.length === 0) {
        return [{
            id: 1,
            title: exercise.exerciseInformation.exerciseName || "Exercise",
            description: exercise.exerciseInformation.description || "Complete the exercise",
            difficulty: (exercise.exerciseInformation.exerciseLevel.charAt(0).toUpperCase() + exercise.exerciseInformation.exerciseLevel.slice(1)) as "Easy" | "Medium" | "Hard",
            examples: [],
            constraints: [],
            initialCode: exercise.questions?.[0]?.solutions?.startedCode || exercise.questions?.[0]?.solutions?.staetedCode || `// Write your solution here\nfunction solution() {\n    // Your code here\n    return null;\n}`,
            hints: exercise.questions?.[0]?.hints?.map(h => h.hintText) || [],
            solution: exercise.questions?.[0]?.solutions?.startedCode || exercise.questions?.[0]?.solutions?.staetedCode
        }];
    }

    return exercise.questions.map((question, index) => ({
        id: index + 1,
        title: question.title || `Question ${index + 1}`,
        description: getDescriptionHtml(question),   // ← use helper
        difficulty: (question?.difficulty?.charAt(0).toUpperCase() + question?.difficulty?.slice(1)) as "Easy" | "Medium" | "Hard",
        examples: question.testCases
            ?.filter(tc => tc.isSample && !tc.isHidden)
            .map(tc => ({
                input: tc.input,
                output: tc.expectedOutput,
                explanation: tc.explanation || "Sample test case"
            })) || (question.sampleInput ? [{
                input: question.sampleInput,
                output: question.sampleOutput,
                explanation: "Sample input and output"
            }] : []),
        constraints: question.constraints || [],
        initialCode: question.solutions?.startedCode || question.solutions?.staetedCode ||
            (() => {
                // Generate a function stub: name from solutions.functionName, param
                // count inferred from the first test case (one input line = one arg).
                const fn = (question.solutions?.functionName || 'main').replace(/[^A-Za-z0-9_]/g, '') || 'main';
                const firstInput = String(
                    question.testCases?.find((t: any) => !t.isHidden)?.input ??
                    question.testCases?.[0]?.input ?? ''
                );
                const argCount = Math.max(1, firstInput.split('\n').filter((l: string) => l.trim() !== '').length);
                const params = Array.from({ length: argCount }, (_, i) => String.fromCharCode(97 + i)).join(', ');
                return `# Write your solution here — return the answer (no input()/print() needed)\ndef ${fn}(${params}):\n    # Your code here\n    return None`;
            })(),
        hints: question.hints?.map(h => h.hintText) || [],
    }));
};

const getPistonLanguage = (language: string): { language: string; version: string } => {
    const languageMap: { [key: string]: { language: string; version: string } } = {
        javascript: { language: "javascript", version: "18.15.0" },
        python: { language: "python", version: "3.10.0" },
        java: { language: "java", version: "15.0.2" },
        cpp: { language: "cpp", version: "10.2.0" },
        c: { language: "c", version: "10.2.0" },
        csharp: { language: "csharp", version: "6.12.0" },
        typescript: { language: "typescript", version: "5.0.3" }
    };
    return languageMap[language.toLowerCase()] || { language: "javascript", version: "18.15.0" };
};

// Security Agreement Modal Component
const SecurityAgreementModal = ({
    isOpen,
    onAgree,
    onCancel,
    securitySettings,
    theme = "light"
}: {
    isOpen: boolean;
    onAgree: () => void;
    onCancel: () => void;
    securitySettings: SecuritySettings;
    theme?: "light" | "dark";
}) => {
    if (!isOpen) return null;

    const themeClasses = theme === 'dark'
        ? 'bg-gray-900 text-white border-gray-700'
        : 'bg-white text-gray-900 border-gray-300';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className={`w-full max-w-lg rounded-xl shadow-2xl border p-6 ${themeClasses}`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                        <ShieldCheck className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Assessment Security Agreement</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Please review and agree to the security measures</p>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <Monitor className="w-4 h-4" /> Security Features
                        </h3>
                        <ul className="space-y-2 text-sm">
                            {/* In SecurityAgreementModal component, around line ~160 */}
                            {securitySettings.timerEnabled ? (
                                <li className="flex items-center gap-2 text-green-700">
                                    <Clock className="w-3 h-3 text-orange-500" />
                                    <span>Timed Assessment: {securitySettings.timerDuration || 30} minutes</span>
                                </li>
                            ) : (
                                <li className="flex items-center gap-2 text-gray-400">
                                    <Clock className="w-3 h-3" />
                                    <span>Timed Assessment: Disabled</span>
                                </li>
                            )}
                            {securitySettings.fullScreenMode ? (
                                <li className="flex items-center gap-2 text-purple-700">
                                    <Maximize2 className="w-3 h-3 text-purple-500" />
                                    <span>Full Screen Mode Required</span>
                                </li>
                            ) : null}
                            {securitySettings.cameraMicEnabled ? (
                                <li className="flex items-center gap-2 text-green-700">
                                    <Camera className="w-3 h-3 text-green-500" />
                                    <span>Camera &amp; Microphone Monitoring</span>
                                </li>
                            ) : null}
                            {securitySettings.screenRecordingEnabled ? (
                                <li className="flex items-center gap-2 text-red-700">
                                    <Video className="w-3 h-3 text-red-500" />
                                    <span>Screen Recording Active</span>
                                </li>
                            ) : null}
                            {securitySettings.tabSwitchAllowed === false ? (
                                <li className="flex items-center gap-2 text-yellow-700">
                                    <Lock className="w-3 h-3 text-yellow-500" />
                                    <span>Tab Switching Restricted (max {securitySettings.maxTabSwitches ?? 3})</span>
                                </li>
                            ) : null}
                            {securitySettings.disableClipboard ? (
                                <li className="flex items-center gap-2 text-orange-700">
                                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                                    <span>Copy / Paste Disabled</span>
                                </li>
                            ) : null}
                            {securitySettings.preventRightClick ? (
                                <li className="flex items-center gap-2 text-orange-700">
                                    <AlertTriangle className="w-3 h-3 text-orange-500" />
                                    <span>Right-click Disabled</span>
                                </li>
                            ) : null}
                            {securitySettings.preventDevTools ? (
                                <li className="flex items-center gap-2 text-red-700">
                                    <Shield className="w-3 h-3 text-red-500" />
                                    <span>Developer Tools Blocked</span>
                                </li>
                            ) : null}
                            {securitySettings.preventBackNavigation ? (
                                <li className="flex items-center gap-2 text-yellow-700">
                                    <Lock className="w-3 h-3 text-yellow-500" />
                                    <span>Back Navigation Locked</span>
                                </li>
                            ) : null}
                            {securitySettings.preventBrowserClose ? (
                                <li className="flex items-center gap-2 text-yellow-700">
                                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                    <span>Browser Close Warning Enabled</span>
                                </li>
                            ) : null}
                        </ul>
                    </div>

                    {/* <div className={`p-4 rounded-lg border ${theme === 'dark' ? 'border-yellow-800 bg-yellow-900/10' : 'border-yellow-300 bg-yellow-50'}`}>
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500" />
                            Important Instructions
                        </h4>
                        <ul className="text-sm space-y-1">
                            <li>• You must allow screen recording when prompted</li>
                            <li>• Keep your camera on throughout the assessment</li>
                            <li>• Do not switch tabs or windows during the assessment</li>
                            <li>• Do not use external resources unless permitted</li>
                            <li>• Complete all questions within the time limit</li>
                            <li>• Violations may result in automatic termination</li>
                        </ul>
                    </div> */}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium border transition-colors ${theme === 'dark'
                            ? 'border-gray-700 text-gray-300 hover:bg-gray-800'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                    >
                        Cancel Assessment  {/* Text changed from "Cancel" to "Cancel Assessment" */}
                    </button>
                    <button
                        onClick={onAgree}
                        className="flex-1 py-2.5 px-4 rounded-lg font-medium bg-orange-600 text-white hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <ShieldCheck className="w-4 h-4" />
                        I Understand & Agree
                    </button>
                </div>
            </div>
        </div>
    );
};
// Add this component near the SecurityAgreementModal component
const ExitConfirmationModal = ({
    isOpen,
    onConfirm,
    onCancel,
    theme = "light"
}: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    theme?: "light" | "dark";
}) => {
    if (!isOpen) return null;

    const themeClasses = theme === 'dark'
        ? 'bg-gray-900 text-white border-gray-700'
        : 'bg-white text-gray-900 border-gray-300';

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className={`w-full max-w-md rounded-xl shadow-2xl border p-6 ${themeClasses}`}>
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">Exit Assessment?</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Are you sure you want to leave the assessment?
                        </p>
                    </div>
                </div>

                <div className="mb-6">
                    <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                        <h4 className="font-semibold mb-2">⚠️ Important Notice</h4>
                        <ul className="text-sm space-y-2">
                            <li className="flex items-start gap-2">
                                <div className="mt-0.5">•</div>
                                <span>Your progress will be saved up to this point</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="mt-0.5">•</div>
                                <span>You cannot resume this assessment once exited</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <div className="mt-0.5">•</div>
                                <span>This action may be recorded and reviewed</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className={`flex-1 py-2.5 px-4 rounded-lg font-medium border transition-colors ${theme === 'dark'
                            ? 'border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                    >
                        Continue Assessment
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2.5 px-4 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Exit Assessment
                    </button>
                </div>
            </div>
        </div>
    );
};
// Interactive Terminal Component
const InteractiveTerminal = ({
    isOpen,
    onClose,
    logs,
    isWaitingForInput,
    onInputSubmit,
    isRunning,
    language,
    onClear,
    theme = "light"
}: any) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [inputValue, setInputValue] = useState("");
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        if (isWaitingForInput && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50);
    }, [logs, isWaitingForInput, isOpen]);

    if (!isOpen) return null;

    const themeClasses = theme === 'dark'
        ? 'bg-slate-950 text-slate-300 border-slate-800'
        : 'bg-white text-gray-800 border-gray-300';

    return (
        <div className={`fixed z-[100] flex flex-col shadow-2xl rounded-lg overflow-hidden border transition-all duration-300 ease-in-out font-sans animate-in slide-in-from-bottom-10 ${themeClasses}`}
            style={isMaximized ? { top: '20px', left: '20px', right: '20px', bottom: '20px', width: 'auto', height: 'auto' } : { bottom: '20px', right: '20px', width: '600px', height: '400px' }}>

            <div className={`flex items-center justify-between px-4 py-2 border-b ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-gray-100 border-gray-300'}`}>
                <div className="flex items-center gap-2.5">
                    <Terminal className={`w-4 h-4 ${theme === 'dark' ? 'text-emerald-500' : 'text-green-600'}`} />
                    <div>
                        <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-gray-800'}`}>Console Output</span>
                        <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-gray-600'} font-mono uppercase`}>
                            {language || 'unknown'} • {isRunning ? 'Running...' : 'Idle'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onClear}
                        className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                        title="Clear"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-indigo-400 hover:bg-slate-800' : 'text-gray-500 hover:text-orange-600 hover:bg-gray-200'}`}
                        title="Maximize"
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={onClose}
                        className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'text-slate-500 hover:text-red-400 hover:bg-slate-800' : 'text-gray-500 hover:text-red-600 hover:bg-gray-200'}`}
                        title="Close"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className={`flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 scrollbar-thin ${theme === 'dark' ? 'bg-slate-950 text-slate-300 scrollbar-thumb-slate-700' : 'bg-white text-gray-800 scrollbar-thumb-gray-300'}`}
            >
                {logs.length === 0 && !isRunning && (
                    <div className={`italic ${theme === 'dark' ? 'text-slate-600' : 'text-gray-500'}`}>
                        Ready to execute. Click 'Run' to start.
                    </div>
                )}

                {logs.map((log: LogEntry) => (
                    <div key={log.id} className="break-all whitespace-pre-wrap leading-relaxed">
                        {log.type === 'stdout' && <span className={theme === 'dark' ? 'text-slate-300' : 'text-gray-700'}>{log.content}</span>}
                        {log.type === 'stderr' && <span className="text-rose-600 dark:text-rose-400">{log.content}</span>}
                        {log.type === 'system' && <span className={`italic select-none ${theme === 'dark' ? 'text-emerald-400' : 'text-green-600'}`}>➜ {log.content}</span>}
                        {log.type === 'stdin' && <span className={`font-bold flex items-start gap-1 ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
                            <span className={theme === 'dark' ? 'text-slate-600' : 'text-gray-500'}>$</span> {log.content}
                        </span>}
                        {log.type === 'error' && <span className="text-red-600 dark:text-red-400">{log.content}</span>}
                        {log.type === 'warning' && <span className="text-yellow-600 dark:text-yellow-400">{log.content}</span>}
                        {log.type === 'success' && <span className="text-green-600 dark:text-green-400">{log.content}</span>}
                        {log.type === 'info' && <span className="text-blue-600 dark:text-blue-400">{log.content}</span>}
                    </div>
                ))}

                {isRunning && !isWaitingForInput && (
                    <div className="flex items-center gap-2 mt-2">
                        <Loader2 className="w-3 h-3 text-emerald-500 animate-spin" />
                        <span className={theme === 'dark' ? 'text-slate-500' : 'text-gray-500'}>Executing...</span>
                    </div>
                )}

                {isWaitingForInput && (
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            onInputSubmit(inputValue);
                            setInputValue("");
                        }}
                        className={`flex items-center gap-2 mt-2 border-t pt-2 ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'}`}
                    >
                        <span className="text-amber-500 font-bold select-none animate-pulse">{">"}</span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            className={`flex-1 bg-transparent border-none outline-none font-bold placeholder:${theme === 'dark' ? 'text-slate-700' : 'text-gray-400'} caret-amber-400`}
                            placeholder="Type input and press Enter..."
                            autoComplete="off"
                            autoFocus
                        />
                    </form>
                )}
            </div>
        </div>
    );
};

const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif";

const InfoRow = ({ label, value, theme, mono }: { label: string; value?: string | null; theme: string; mono?: boolean }) => {
    if (value == null || value === '') return null;
    return (
        <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: '12px 0',
            borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
        }}>
            <span style={{
                fontSize: 12.5,
                color: theme === 'dark' ? 'rgba(255,255,255,0.7)' : '#475569',
                fontWeight: 500,
                flexShrink: 0,
                minWidth: 110,
                lineHeight: 1.5,
            }}>
                {label}
            </span>
            <span style={{
                fontSize: 12.5,
                color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
                fontWeight: 600,
                textAlign: 'right',
                fontFamily: mono ? 'ui-monospace, monospace' : 'inherit',
                wordBreak: 'break-all',
                flex: 1,
                lineHeight: 1.5,
            }}>
                {value}
            </span>
        </div>
    );
};
export default function CodeEditor({
    exercise,
    defaultProblems,
    onDropdownCollapsed,
    breadcrumbCollapsed,
    onBreadcrumbCollapseToggle,
    theme = "light",
    courseId = "",
    nodeId = "",
    nodeName = "",
    nodeType = "",
    subcategory = "",
    category = "We_Do",
    studentId = "unknown_student",
    onBack,
    // Add these new props
    onCloseExercise,
    onResetExercise,
    courseName,
    hierarchy,
    onNavigateToBreadcrumb,
    resetProgress = false,
    embedded = false,
    skipSecurityModal = false,
    onCrossNext,
    onCrossPrev,
    crossNextLabel,
    onSubmitTest,
    externalTimeLeft,
}: CodeEditorProps) {
    // --- Security State ---
    const [isAssessmentMode, setIsAssessmentMode] = useState(false);
    const [showSecurityAgreement, setShowSecurityAgreement] = useState(false);
    const [hasAgreedToSecurity, setHasAgreedToSecurity] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [isTerminated, setIsTerminated] = useState(false);
    const [terminationReason, setTerminationReason] = useState("");
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [exerciseTimeLeft, setExerciseTimeLeft] = useState<number | null>(null);
    const hasExternalTimer = externalTimeLeft !== undefined;
    useEffect(() => {
        if (hasExternalTimer) setExerciseTimeLeft(externalTimeLeft!);
    }, [externalTimeLeft, hasExternalTimer]);
    const [tabSwitchCount, setTabSwitchCount] = useState(0);
    const [showTerminal, setShowTerminal] = useState(false);
    const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([]);
    const [isWaitingForInput, setIsWaitingForInput] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [isInFullscreenMode, setIsInFullscreenMode] = useState(false);
    const [micEnabled, setMicEnabled] = useState(true);
    const [pyodideReady, setPyodideReady] = useState(false);
    const pyodideRef = useRef<any>(null);
    const [showSearch, setShowSearch] = useState(false);
    const [selectedDifficulty, setSelectedDifficulty] = useState('all');
    // --- Core State ---
    const [code, setCode] = useState("")
    const [selectedLanguage, setSelectedLanguage] = useState("javascript")
    const [output, setOutput] = useState("")
    const [isRunning, setIsRunning] = useState(false)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [currentProblemIndex, setCurrentProblemIndex] = useState(0)
    const [showSidebar, setShowSidebar] = useState(false)
    const [leftPanelWidth, setLeftPanelWidth] = useState(40)
    const [isResizing, setIsResizing] = useState(false)
    const [searchQuery, setSearchQuery] = useState("")
    const editorRef = useRef<HTMLDivElement>(null)
    const descriptionRef = useRef<HTMLDivElement>(null)
    const [editorReady, setEditorReady] = useState(false)
    const [isHorizontalResizing, setIsHorizontalResizing] = useState(false)
    const [showCopyWarning, setShowCopyWarning] = useState(false)
    const [currentQuestion, setCurrentQuestion] = useState<ExerciseQuestion | null>(null)
    const [toasts, setToasts] = useState<ToastNotification[]>([]);
    const [isLoadingAttempts, setIsLoadingAttempts] = useState(false);
    const [userAttempts, setUserAttempts] = useState(0);
    const [attemptsLoaded, setAttemptsLoaded] = useState(false);
    const [solvedQuestions, setSolvedQuestions] = useState<Set<number>>(new Set());
    const [skippedQuestions, setSkippedQuestions] = useState<Set<number>>(new Set());
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showOverviewModal, setShowOverviewModal] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const submittedScoresRef = useRef<Record<string, number>>({});
    const timeUpHandledRef = useRef(false);
    // --- Available Languages ---
    const [availableLanguages, setAvailableLanguages] = useState<string[]>(["javascript", "python", "java", "cpp", "c", "csharp"]);

    // --- Image Modal State ---
    const [modalImage, setModalImage] = useState<{ url: string; alt: string } | null>(null);
    const [rightPanelSplit, setRightPanelSplit] = useState(75);

    // ── Bottom-panel tab + structured test-case results (Test Results table) ──
    const [bottomTab, setBottomTab] = useState<'console' | 'results'>('console');
    const [testResults, setTestResults] = useState<{
        caseNo: number; input: string; expected: string; actual: string;
        status: 'passed' | 'failed' | 'skipped'; time: string; isHidden: boolean;
    }[]>([]);

    useEffect(() => {
        console.log(currentQuestion)
    }, [currentQuestion])
    // --- Refs ---
    const currentQuestionRef = useRef<string>("");
    const editorInstanceRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const recordedChunksRef = useRef<Blob[]>([]);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameRef = useRef<number | null>(null);
    const screenVideoRef = useRef<HTMLVideoElement>(null);
    const isTestSubmittingRef = useRef(false);
    const inputResolverRef = useRef<((value: string) => void) | null>(null);
    const [showExitConfirmation, setShowExitConfirmation] = useState(false);
    const [pendingExitAction, setPendingExitAction] = useState<(() => void) | null>(null);
    const [showExerciseInfo, setShowExerciseInfo] = useState(false);
    const [showBackConfirm, setShowBackConfirm] = useState(false);
    const [pendingNavLevel, setPendingNavLevel] = useState<'course' | 'hierarchy' | 'category' | null>(null);
    const [showOutput, setShowOutput] = useState(false);
    const outputScrollRef = useRef<HTMLDivElement>(null);

    // Add these with your existing state variables
    // Add these with your existing state variables
    const [sortBy, setSortBy] = useState<'default' | 'difficulty' | 'title'>('default');
    const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all');
    const problems = useMemo(() => {
        return exercise
            ? convertExerciseToProblems(exercise)
            : (defaultProblems || [])
    }, [exercise, defaultProblems])
    const problem = problems.length > 0 ? problems[currentProblemIndex] : null
    const router = useRouter();

    // ── Live Dashboard emitter (student → teacher). assessmentId = exercise _id. ──
    const live = useExamLiveEmitter(exercise?._id ? String(exercise._id) : "", problems.length);

    // --- Full exercise data (re-fetched to get complete exerciseInformation fields) ---
    const [fullExercise, setFullExercise] = useState<Exercise | null>(exercise || null);
    useEffect(() => {
        setFullExercise(exercise || null);
        if (!exercise?._id) return;
        // Always re-fetch so totalMarks / totalMarksProgramming are complete
        const token = getToken() || localStorage.getItem('token') || '';
        fetch(`http://localhost:5533/exercise/${exercise._id}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (!data) return;
                const full = data.data || data.exercise || data;
                if (full?._id) {
                    // Keep the prop's questions array (already resolved) but use full exerciseInformation
                    setFullExercise({ ...full, questions: exercise.questions ?? full.questions });
                }
            })
            .catch(() => { /* keep prop data */ });
    }, [exercise?._id]);

    // Convenience alias — use fullExercise everywhere for display fields
    const exData = fullExercise ?? exercise;

    // --- Security Configuration ---
    // Normalise backend field names → legacy aliases used throughout this component
    const _rawSecurity = exercise?.securitySettings || {};
    const _normSecurity = normalizeSecurityConfig(_rawSecurity);
    const securitySettings = {
        timerEnabled: _normSecurity.timerEnabled,
        timerDuration: _normSecurity.timerDuration,
        cameraMicEnabled: _normSecurity.cameraMicEnabled,
        fullScreenMode: _normSecurity.fullScreenMode,
        tabSwitchAllowed: _normSecurity.tabSwitchAllowed,
        maxTabSwitches: _normSecurity.maxTabSwitches,
        disableClipboard: _normSecurity.disableClipboard,
        screenRecordingEnabled: _normSecurity.screenRecordingEnabled,
        // Forwarded so SecurityAgreementModal can render the extra bullets
        // without reaching into this component's closure (which crashed with
        // `_normSecurity is not defined` after the modal was extracted).
        preventRightClick: _normSecurity.preventRightClick,
        preventDevTools: _normSecurity.preventDevTools,
        preventBackNavigation: _normSecurity.preventBackNavigation,
        preventBrowserClose: _normSecurity.preventBrowserClose,
    };

    // Extra security features not handled by the legacy code — use the hook
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // Shared proctor recorder, used for the camera-only path when screen capture
    // is off. The screen path keeps its own implementation further down.
    const { startRecording: startProctorRecording, stopRecording: stopProctorRecording } = useScreenRecording();

    useAssessmentSecurity({
        config: _normSecurity,
        isActive: isAssessmentMode && hasStarted,
        // This editor runs its own exercise-level countdown, so the hook only
        // fires the warning — the effect on exerciseTimeLeft owns the submit.
        externalSecondsLeft: exerciseTimeLeft,
        onTabSwitchViolation: (count, max) => {
            // Warn on every switch, not just the last one: terminating without
            // warning gave the student no chance to correct course.
            showToast({ type: 'warning', title: `Tab switch ${count}/${max}`, message: 'Continued violations will end the assessment.', duration: 4000 });
            if (count >= max) handleTermination('Maximum tab switches exceeded', 'terminated');
        },
        onTimeWarning: (secs) => {
            showToast({ type: 'warning', title: `⏰ ${secs}s remaining`, message: 'Assessment will auto-submit soon', duration: 6000 });
        },
    });

    // ── Face proctoring: warn on no-face / multiple persons, then auto-submit ──
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useFaceProctor({
        isActive: isAssessmentMode && hasStarted,
        multiFaceEnabled: !!(_normSecurity as any).multipleFaceDetection,
        multiFaceLimit: (_normSecurity as any).faceWarningLimit ?? 3,
        noFaceEnabled: !!(_normSecurity as any).faceMonitoringDetection,
        noFaceLimit: (_normSecurity as any).faceMonitoringWarningLimit ?? 3,
        intervalSeconds: 10,
        onWarning: ({ reason, count, limit }) => {
            showToast({ type: 'warning', title: `⚠️ ${reason} (${count}/${limit})`, message: 'Continued violations will auto-submit', duration: 4000 });
        },
        onLimitReached: (reason) => { handleTermination(reason, 'terminated'); },
    });

    // Resolve question flow: new field (questionFlow) takes priority over legacy allowNext boolean.
    // DB default for questionFlow is 'freeFlow', so unknown = free.
    const isFreeFlow: boolean = (() => {
        const qFlow = exercise?.questionConfiguration?.programmingQuestionConfiguration?.questionFlow;
        if (qFlow === 'freeFlow') return true;
        if (qFlow === 'controlled') return false;
        // Fallback to legacy allowNext boolean (default true = free)
        return exercise?.questionBehavior?.allowNext ?? true;
    })();

    // ── Difficulty jump buttons ──
    // Map of difficulty → [first index in problems array, total count]
    const difficultyMap = useMemo<Record<string, { firstIndex: number; count: number }>>(() => {
        const map: Record<string, { firstIndex: number; count: number }> = {};
        problems.forEach((_, i) => {
            const diff = (exercise?.questions?.[i]?.difficulty || '').toLowerCase();
            if (!diff) return;
            if (!map[diff]) map[diff] = { firstIndex: i, count: 0 };
            map[diff].count += 1;
        });
        return map;
    }, [problems, exercise?.questions]);

    // Ordered list of difficulties that actually have questions
    const availableDifficulties = useMemo(
        () => (['easy', 'medium', 'hard'] as const).filter(d => !!difficultyMap[d]),
        [difficultyMap]
    );

    const jumpToDifficulty = (diff: string) => {
        const entry = difficultyMap[diff];
        if (entry) setCurrentProblemIndex(entry.firstIndex);
    };


    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isHorizontalResizing) return;
            const container = editorRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const relY = ((e.clientY - rect.top) / rect.height) * 100;
            setRightPanelSplit(Math.min(Math.max(25, relY), 85));
        };
        const handleMouseUp = () => setIsHorizontalResizing(false);
        if (isHorizontalResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isHorizontalResizing]);


    const currentDiff = (exercise?.questions?.[currentProblemIndex]?.difficulty || '').toLowerCase();

    // Helper function to escape HTML
    const escapeHtml = (text: string): string => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    // Expose global function for images to call
    useEffect(() => {
        (window as any).openImageModal = (url: string, alt: string) => {
            setModalImage({ url, alt });
        };

        return () => {
            delete (window as any).openImageModal;
        };
    }, []);

    // Close modal with Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && modalImage) {
                setModalImage(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [modalImage]);

    // Function to render description with clickable images
    const renderDescriptionWithClickableImages = (description: any): string => {
        if (!description) return '<div>No description provided</div>';

        // Helper to make images in HTML clickable
        const makeImagesClickable = (html: string): string => {
            return html.replace(
                /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
                (match, before, src, after) => {
                    return `<img ${before} src="${src}" ${after} style="cursor:pointer;transition:transform 0.2s, box-shadow 0.2s;max-width:100%;border-radius:8px;" 
                            onclick="window.openImageModal('${src}', 'Question Image')"
                            onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';"
                            onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none';" />`;
                }
            );
        };

        // If description is already HTML string, process it
        if (typeof description === 'string') {
            return makeImagesClickable(description);
        }

        // If description is an object with text property
        if (typeof description === 'object' && description.text) {
            let html = '';
            if (typeof description.text === 'string') {
                html += makeImagesClickable(escapeHtml(description.text));
            } else if (Array.isArray(description.text)) {
                // Handle array of blocks
                description.text.forEach((block: any) => {
                    if (block.type === 'text') {
                        html += `<div class="text-block" style="margin-bottom: 12px; line-height: 1.6;">${escapeHtml(block.value || '')}</div>`;
                    } else if (block.type === 'image') {
                        html += `<div style="display:flex;justify-content:${block.alignment === 'right' ? 'flex-end' : block.alignment === 'center' ? 'center' : 'flex-start'};margin:12px 0;">
                                  <img 
                                    src="${block.url}" 
                                    alt="Question image" 
                                    style="max-width:${block.sizePercent || 100}%;border-radius:8px;cursor:pointer;transition:transform 0.2s, box-shadow 0.2s;" 
                                    onclick="window.openImageModal('${block.url}', 'Question Image')"
                                    onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';"
                                    onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none';"
                                  />
                                </div>`;
                    }
                });
            }
            if (description.imageUrl) {
                html += `<div style="margin:12px 0;">
                          <img 
                            src="${description.imageUrl}" 
                            alt="Question image" 
                            style="max-width:${description.imageSizePercent || 100}%;border-radius:8px;cursor:pointer;transition:transform 0.2s, box-shadow 0.2s;" 
                            onclick="window.openImageModal('${description.imageUrl}', 'Question Image')"
                            onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';"
                            onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none';"
                          />
                        </div>`;
            }
            return html;
        }

        // If description is an array directly
        if (Array.isArray(description)) {
            let html = '';
            description.forEach((block: any) => {
                if (block.type === 'text') {
                    html += `<div class="text-block" style="margin-bottom: 12px; line-height: 1.6;">${escapeHtml(block.value || '')}</div>`;
                } else if (block.type === 'image') {
                    html += `<div style="display:flex;justify-content:${block.alignment === 'right' ? 'flex-end' : block.alignment === 'center' ? 'center' : 'flex-start'};margin:12px 0;">
                              <img 
                                src="${block.url}" 
                                alt="Question image" 
                                style="max-width:${block.sizePercent || 100}%;border-radius:8px;cursor:pointer;transition:transform 0.2s, box-shadow 0.2s;" 
                                onclick="window.openImageModal('${block.url}', 'Question Image')"
                                onmouseover="this.style.transform='scale(1.02)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';"
                                onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none';"
                              />
                            </div>`;
                }
            });
            return html;
        }

        return '<div>No description provided</div>';
    };

    const ImageModal = ({ image, onClose, theme }: { image: { url: string; alt: string } | null; onClose: () => void; theme: string }) => {
        useEffect(() => {
            if (image) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = 'unset';
            }
            return () => {
                document.body.style.overflow = 'unset';
            };
        }, [image]);

        if (!image) return null;

        return (
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            >
                <div
                    className={`relative flex flex-col rounded-xl shadow-2xl border overflow-hidden ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
                    style={{ width: '600px', height: '500px', maxWidth: '90vw', maxHeight: '85vh' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Fixed Header - never shrinks */}
                    <div
                        className={`flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0 ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}
                        style={{ height: '42px' }}
                    >
                        <span className={`text-xs font-semibold truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            🖼️ {image.alt || 'Question Image'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                                onClick={() => window.open(image.url, '_blank')}
                                className={`h-6 px-2 text-[10px] rounded flex items-center gap-1 transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`}
                            >
                                <Maximize2 className="w-3 h-3" />
                                Full
                            </button>
                            <button
                                onClick={onClose}
                                className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${theme === 'dark' ? 'hover:bg-red-900/50 text-gray-400 hover:text-red-400' : 'hover:bg-red-100 text-gray-500 hover:text-red-600'}`}
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Fixed Image Area - always exactly fills remaining space */}
                    <div
                        className={`flex-1 overflow-auto flex items-center justify-center ${theme === 'dark' ? 'bg-gray-950' : 'bg-gray-100'}`}
                        style={{ height: 'calc(500px - 42px)' }}
                    >
                        <img
                            src={image.url}
                            alt={image.alt}
                            style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain',
                                borderRadius: '4px',
                                display: 'block',
                            }}
                        />
                    </div>
                </div>
            </div>
        );
    };

    // Determine if assessment mode is active (You Do category)
    useEffect(() => {
        // When embedded in SectionBasedTestPage the parent handles security.
        // Disable all assessment-mode behaviour so we don't show a second
        // security modal or request browser fullscreen for every section.
        if (embedded) {
            setIsAssessmentMode(false);
            setHasStarted(true);
            return;
        }

        const normCategory = (category || "").replace(/_/g, ' ').toLowerCase().trim();
        const isYouDoCategory = normCategory === 'you do';

        setIsAssessmentMode(isYouDoCategory);

        // Show security agreement if You Do category — unless the instructions
        // page already showed the rules (skipSecurityModal), in which case the
        // auto-start effect below begins the assessment directly.
        if (isYouDoCategory && !hasAgreedToSecurity && !skipSecurityModal) {
            setShowSecurityAgreement(true);
        }

        if (!isAssessmentMode) {
            setHasStarted(true); // Auto-start if not assessment mode
        }
    }, [category, hasAgreedToSecurity, embedded, skipSecurityModal]);

    // Auto-start when the security modal is skipped. Waits until assessment mode
    // is committed so startAssessment() doesn't early-return, then runs the same
    // path the agreement button would (fullscreen / proctoring still apply).
    useEffect(() => {
        if (skipSecurityModal && isAssessmentMode && !hasStarted && !hasAgreedToSecurity && !embedded) {
            setHasAgreedToSecurity(true);
            setShowSecurityAgreement(false);
            startAssessment();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [skipSecurityModal, isAssessmentMode, hasStarted, hasAgreedToSecurity, embedded]);
    const normalizeLanguageName = (lang: string): string => {
        const normalized = lang.toLowerCase();
        if (normalized.includes('python')) return 'python';
        if (normalized.includes('java') && !normalized.includes('javascript')) return 'java';
        if (normalized.includes('javascript') || normalized.includes('js')) return 'javascript';
        if (normalized.includes('c++') || normalized.includes('cpp')) return 'cpp';
        if (normalized === 'c' || normalized.includes('c ')) return 'c';
        if (normalized.includes('c#') || normalized.includes('csharp')) return 'csharp';
        if (normalized.includes('typescript') || normalized.includes('ts')) return 'typescript';
        return normalized;
    };


    // --- Initialize ---
    useEffect(() => {
        if (exercise?.questions && exercise.questions.length > 0) {
            const question = exercise.questions[currentProblemIndex];
            setCurrentQuestion(question || null);
            currentQuestionRef.current = question?._id || "";

            // Get available languages for THIS SPECIFIC QUESTION
            let allowedLanguages: string[] = [];

            // 1. Check if question has specific allowed languages
            if (question?.allowedLanguages && question.allowedLanguages.length > 0) {
                allowedLanguages = question.allowedLanguages.map(lang => lang.toLowerCase());
            }

            // 2. If not, use the exercise's programming settings
            if (allowedLanguages.length === 0 && exercise.programmingSettings?.selectedLanguages) {
                allowedLanguages = exercise.programmingSettings.selectedLanguages.map(lang => lang.toLowerCase());
            }

            // 3. If still empty, default to the question's solution language
            if (allowedLanguages.length === 0 && question?.solutions?.language) {
                allowedLanguages = [question.solutions.language.toLowerCase()];
            }

            // 4. If still empty, use a sensible default based on available languages
            if (allowedLanguages.length === 0) {
                allowedLanguages = ["javascript", "python", "java", "cpp", "c", "csharp"];
            }

            // Normalize language names
            const normalizedLanguages = allowedLanguages.map(lang => {
                const normalized = lang.toLowerCase();
                if (normalized.includes('python')) return 'python';
                if (normalized.includes('java') && !normalized.includes('javascript')) return 'java';
                if (normalized.includes('javascript') || normalized.includes('js')) return 'javascript';
                if (normalized.includes('c++') || normalized.includes('cpp')) return 'cpp';
                if (normalized === 'c' || normalized.includes('c ')) return 'c';
                if (normalized.includes('c#') || normalized.includes('csharp')) return 'csharp';
                if (normalized.includes('typescript') || normalized.includes('ts')) return 'typescript';
                return normalized;
            });

            // Remove duplicates
            const uniqueLanguages = Array.from(new Set(normalizedLanguages)).filter(lang => lang && lang.trim() !== "");

            setAvailableLanguages(uniqueLanguages);

            // Set initial language - use question's solution language if available and allowed
            if (question?.solutions?.language) {
                const lang = question.solutions.language.toLowerCase();
                const normalizedLang = normalizeLanguageName(lang);

                if (uniqueLanguages.includes(normalizedLang)) {
                    setSelectedLanguage(normalizedLang);
                } else if (uniqueLanguages.length > 0) {
                    setSelectedLanguage(uniqueLanguages[0]);
                }
            } else if (uniqueLanguages.length > 0) {
                setSelectedLanguage(uniqueLanguages[0]);
            }
        } else {
            setCurrentQuestion(null);
            currentQuestionRef.current = "";

            // Default languages if no exercise
            setAvailableLanguages(["javascript", "python", "java", "cpp", "c", "csharp"]);
            setSelectedLanguage("javascript");
        }

        if (problem?.initialCode) {
            setCode(problem.initialCode)
            setOutput("")
        } else {
            setCode(`// Start coding here...
function solve() {
    // Your solution goes here
    return null;
}`)
        }
    }, [problem, exercise, currentProblemIndex])


    // --- Pyodide Initialization ---
    const initPyodide = async () => {
        if (!pyodideReady && (window as any).loadPyodide) {
            try {
                const pyodide = await (window as any).loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
                });
                pyodideRef.current = pyodide;
                setPyodideReady(true);

                // Setup async input for Python
                (window as any).getReactInput = () => new Promise((resolve) => {
                    setIsWaitingForInput(true);
                    inputResolverRef.current = resolve;
                });
            } catch (e) {
                console.error("Pyodide Load Error", e);
            }
        }
    };

    // --- Toast System ---
    const showToast = (notification: Omit<ToastNotification, 'id'>) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newToast = { ...notification, id };
        setToasts(prev => [...prev, newToast]);
        setTimeout(() => {
            setToasts(prev => prev.filter(toast => toast.id !== id));
        }, notification.duration);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    // --- User Progress ---
    const fetchUserProgress = useCallback(async (questionId?: string) => {
        const targetQuestionId = questionId || currentQuestion?._id;
        if (!exercise || !targetQuestionId) return;

        if (questionId && currentQuestionRef.current !== questionId) {
            return;
        }

        try {
            setIsLoadingAttempts(true);
            const token = getToken() || localStorage.getItem('token') || '';

            const params = new URLSearchParams({
                courseId: courseId || (exercise.courseId ? exercise.courseId.toString() : ""),
                exerciseId: exercise._id,
                questionId: targetQuestionId,
                category: category || "We_Do",
                subcategory: subcategory || ""
            });

            const response = await fetch(`http://localhost:5533/courses/answers/single?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (currentQuestionRef.current !== targetQuestionId) {
                return;
            }

            if (response.ok) {
                const data = await response.json();
                console.log('[retest-prefill] code-editor /single →', { sent: { category: category || 'We_Do', subcategory: subcategory || '', exerciseId: exercise._id, questionId: targetQuestionId }, got: data });
                if (data.success && data.data) {
                    setUserAttempts(data.attempts || 0);
                    setAttemptsLoaded(true);

                    if (!resetProgress && data.data && data.data !== "null" && data.data.trim() !== "") {
                        setCode(data.data);
                    }

                    if (data.status === 'solved') {
                        setSolvedQuestions(prev => {
                            const newSet = new Set(prev);
                            newSet.add(currentProblemIndex);
                            return newSet;
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch progress for question:", error);
            setAttemptsLoaded(true);
        } finally {
            setIsLoadingAttempts(false);
        }
    }, [courseId, exercise, currentQuestion, category, subcategory, currentProblemIndex]);

    // Fetch progress on mount
    useEffect(() => {
        if (currentQuestion?._id) {
            fetchUserProgress(currentQuestion._id);
        }
    }, [currentQuestion?._id]);

    // Mark exercise as in-progress in localStorage so exercises list can offer Resume/Start Fresh
    useEffect(() => {
        if (exercise?._id) {
            localStorage.setItem('ex_in_progress_' + exercise._id, '1');
        }
    }, [exercise?._id]);



    useEffect(() => {
        // ── Fullscreen state sync + ESC handling ───────────────────────────
        // This effect used to do three things on fullscreen-exit:
        //   1. Sync local state (kept).
        //   2. Pop up ExitConfirmationModal (REMOVED — auto-prompting on a
        //      passive event was a UX trap; the toolbar "Exit" button still
        //      uses the modal for the explicit-intent case).
        //   3. Auto re-enter fullscreen (moved into the dedicated effect
        //      below, which is correctly gated on securitySettings.fullScreenMode).
        // ESC suppression now also respects the security setting — if the
        // teacher didn't require fullscreen, ESC must work normally.
        const handleFullscreenChange = () => {
            const isFullscreen = !!document.fullscreenElement;
            setIsFullscreen(isFullscreen);
            setIsInFullscreenMode(isFullscreen);
        }

        // Swallow ESC ONLY when fullscreen is genuinely required AND the
        // assessment is live. Otherwise let the browser handle it.
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                isAssessmentMode &&
                hasStarted &&
                securitySettings.fullScreenMode &&
                e.key === 'Escape' &&
                document.fullscreenElement
            ) {
                e.preventDefault();
                e.stopPropagation();
            }
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('keydown', handleKeyDown, true);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('keydown', handleKeyDown, true);
        }
    }, [isAssessmentMode, hasStarted, securitySettings.fullScreenMode]);

    // Add a function to handle assessment cancellation
    const handleCancelAssessment = () => {
        // Stop recording if active
        if (isRecording) {
            stopScreenRecording();
        }

        // Exit fullscreen
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
        }

        // Reset all assessment states
        setIsAssessmentMode(false);
        setHasAgreedToSecurity(false);
        setHasStarted(false);
        setIsLocked(false);
        setShowExitConfirmation(false);

        // Call the close exercise callback
        if (onCloseExercise) {
            onCloseExercise();
        } else if (onBack) {
            onBack();
        }

        showToast({
            type: 'info',
            title: 'Assessment Cancelled',
            message: 'Returning to exercises...',
            duration: 3000
        });
    };

    // Add this after line ~610
    useEffect(() => {
        console.log("📋 SECURITY SETTINGS:", {
            category: category,
            isAssessmentMode: isAssessmentMode,
            hasStarted: hasStarted,
            securitySettings: securitySettings,
            exerciseSecurity: exercise?.securitySettings,
            // Detailed breakdown:
            timerEnabled: securitySettings.timerEnabled,
            timerDuration: securitySettings.timerDuration,
            cameraMicEnabled: securitySettings.cameraMicEnabled,
            fullScreenMode: securitySettings.fullScreenMode,
            tabSwitchAllowed: securitySettings.tabSwitchAllowed,
            maxTabSwitches: securitySettings.maxTabSwitches,
            disableClipboard: securitySettings.disableClipboard,
            screenRecordingEnabled: securitySettings.screenRecordingEnabled,
        });

        // Also log category detection
        console.log("📊 CATEGORY ANALYSIS:", {
            rawCategory: category,
            normalized: (category || "").replace(/_/g, ' ').toLowerCase().trim(),
            isYouDo: (category || "").replace(/_/g, ' ').toLowerCase().trim() === 'you do'
        });
    }, [exercise, category, isAssessmentMode, hasStarted]);
    // --- Security Effects ---
    // Fullscreen enforcement: only run when the teacher actually required it.
    // Previously this effect attached its listener unconditionally and warned
    // the student "Fullscreen Required" + auto re-entered fullscreen even when
    // the assessment's security settings had `fullScreenMode: false`. Gate the
    // whole thing on the setting so disabled = no listener, no toast, no
    // re-entry.
    useEffect(() => {
        if (!securitySettings.fullScreenMode) return;

        const handleFullscreenChange = () => {
            const isFullscreen = !!document.fullscreenElement;
            setIsFullscreen(isFullscreen);
            setIsInFullscreenMode(isFullscreen);

            if (isAssessmentMode && hasStarted && !isFullscreen) {
                showToast({
                    type: 'warning',
                    title: 'Fullscreen Required',
                    message: 'Please return to fullscreen mode',
                    duration: 3000
                });
                setTimeout(() => {
                    document.documentElement.requestFullscreen().catch(() => { });
                }, 1000);
            }
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [isAssessmentMode, hasStarted, securitySettings.fullScreenMode])

    // --- Tab Switch Detection ---
    // Removed: this useEffect ran a SECOND visibilitychange listener that
    // ignored `securitySettings.preventTabSwitch` / `tabSwitchAllowed`, so
    // every assessment terminated after the default 3 switches even when
    // the teacher had explicitly allowed tab switching. The same enforcement
    // already lives in `useAssessmentSecurity` (gated correctly on
    // `config.preventTabSwitch`) — the local count + toast UX is now driven
    // by that hook's `onTabSwitchViolation` callback below. Keeping both
    // also risked a duplicate `handleTermination` call (and a double submit)
    // on the legitimate restricted-mode path.

    // --- Timer Implementation ---
    // --- Timer Implementation ---
    useEffect(() => {
        if (!isAssessmentMode || !hasStarted) return;

        // Check if timer is enabled in security settings
        const shouldStartTimer = securitySettings.timerEnabled;

        if (shouldStartTimer) {
            const duration = securitySettings.timerDuration || 60; // Default to 60 minutes if not specified
            setTimeLeft(duration * 60); // Convert minutes to seconds

            const timer = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev === null || prev <= 0) {
                        clearInterval(timer);
                        handleTimeUpAutoSubmit();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearInterval(timer);
        } else {
            // Timer is disabled, set timeLeft to null
            setTimeLeft(null);
        }
    }, [isAssessmentMode, hasStarted, securitySettings.timerEnabled, securitySettings.timerDuration]);
    // --- Exercise-level countdown timer (driven by exerciseInformation.totalDuration) ---
    useEffect(() => {
        if (hasExternalTimer) return;
        const totalDuration = exercise?.exerciseInformation?.totalDuration;
        if (!totalDuration || totalDuration <= 0) {
            setExerciseTimeLeft(null);
            return;
        }
        const totalSeconds = totalDuration * 60;
        setExerciseTimeLeft(totalSeconds);
        const timer = setInterval(() => {
            setExerciseTimeLeft(prev => {
                if (prev === null || prev <= 0) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [exercise?.exerciseInformation?.totalDuration]);

    useEffect(() => {
        if (exerciseTimeLeft === 0 && !timeUpHandledRef.current) {
            handleTimeUpAutoSubmit();
        }
    }, [exerciseTimeLeft]);

    const formatTime = (seconds: number | null) => {
        if (seconds === null) return "No Limit";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatExerciseTime = (seconds: number | null): string => {
        if (seconds === null) return "--:--";
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    const addTerminalLog = (type: LogEntry['type'], content: string) => {
        setTerminalLogs(prev => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${prev.length}`,
            type,
            content,
            timestamp: Date.now()
        }]);
    };
    const clearTerminal = () => setTerminalLogs([]);

    const handleTerminalInput = (value: string) => {
        addTerminalLog('stdin', value);
        if (inputResolverRef.current) {
            inputResolverRef.current(value);
            inputResolverRef.current = null;
        }
        setIsWaitingForInput(false);
    };

    // --- Enhanced Screen Recording Implementation ---
    const startScreenRecording = async () => {
        if (!securitySettings.screenRecordingEnabled) {
            return;
        }

        try {
            addTerminalLog('system', '🎥 Starting screen recording...');

            // First request screen recording permission
            // Flag the open prompt so the Live Screen broadcaster reuses THIS
            // capture instead of opening a second screen-share prompt.
            markScreenCaptureStarting();
            const displayStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    mediaSource: 'screen',
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 15, max: 30 }
                },
                audio: securitySettings.cameraMicEnabled ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100,
                    channelCount: 2
                } : false
            }).catch((e: any) => { clearScreenCaptureInProgress(); throw e; });

            setScreenStream(displayStream);
            // Share this capture with the Live Screen broadcaster (single prompt).
            setSharedScreenStream(displayStream);
            displayStream.getVideoTracks().forEach(t => t.addEventListener('ended', () => setSharedScreenStream(null)));

            // Request camera ONLY if cameraMicEnabled is true
            let cameraStream: MediaStream | null = null;
            if (securitySettings.cameraMicEnabled) {
                try {
                    cameraStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            width: { ideal: 320, max: 640 },
                            height: { ideal: 240, max: 480 },
                            frameRate: { ideal: 15, max: 30 },
                            facingMode: 'user'
                        },
                        audio: micEnabled ? {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true,
                            sampleRate: 44100,
                            channelCount: 1
                        } : false
                    });

                    setCameraStream(cameraStream);

                    // Make sure the videoRef is current
                    if (videoRef.current) {
                        videoRef.current.srcObject = cameraStream;
                        videoRef.current.muted = true;
                        videoRef.current.autoplay = true;
                        videoRef.current.playsInline = true;

                        // Add event listeners to handle video playback
                        videoRef.current.onloadedmetadata = () => {
                            videoRef.current?.play().catch(e => {
                                console.warn("Autoplay prevented:", e);
                            });
                        };

                        // Force play after a short delay with user interaction fallback
                        const playWithFallback = () => {
                            if (videoRef.current) {
                                const playPromise = videoRef.current.play();
                                if (playPromise !== undefined) {
                                    playPromise.catch(() => {
                                        // Try playing with user interaction
                                        document.addEventListener('click', () => {
                                            videoRef.current?.play().catch(() => { });
                                        }, { once: true });
                                    });
                                }
                            }
                        };

                        setTimeout(playWithFallback, 500);
                    }

                    addTerminalLog('success', '📹 Camera access granted');
                } catch (err) {
                    console.warn("Camera access failed:", err);
                    addTerminalLog('warning', '📹 Camera access denied - continuing without camera');
                    showToast({
                        type: 'warning',
                        title: 'Camera Access Denied',
                        message: 'Screen recording will continue without camera',
                        duration: 4000
                    });
                }
            } else {
                addTerminalLog('info', '📹 Camera monitoring disabled in settings');
            }

            // Create canvas for compositing screen + camera
            const canvas = document.createElement('canvas');
            canvas.width = 1920;
            canvas.height = 1080;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');

            canvasRef.current = canvas;

            // Create video element for screen
            const screenVideo = document.createElement('video');
            screenVideo.srcObject = displayStream;
            screenVideo.autoplay = true;
            screenVideo.playsInline = true;
            screenVideo.onloadedmetadata = () => {
                screenVideo.play().catch(console.error);
            };
            screenVideoRef.current = screenVideo;

            const cameraVideo = videoRef.current;

            // Composite frames function
            const drawFrame = () => {
                if (!ctx || !screenVideo.videoWidth) return;

                try {
                    // Clear canvas
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Draw screen content
                    const screenAspect = screenVideo.videoWidth / screenVideo.videoHeight;
                    const canvasAspect = canvas.width / canvas.height;

                    let drawWidth, drawHeight, offsetX, offsetY;

                    if (screenAspect > canvasAspect) {
                        // Screen is wider than canvas
                        drawWidth = canvas.width;
                        drawHeight = canvas.width / screenAspect;
                        offsetX = 0;
                        offsetY = (canvas.height - drawHeight) / 2;
                    } else {
                        // Screen is taller than canvas
                        drawHeight = canvas.height;
                        drawWidth = canvas.height * screenAspect;
                        offsetX = (canvas.width - drawWidth) / 2;
                        offsetY = 0;
                    }

                    ctx.drawImage(screenVideo, offsetX, offsetY, drawWidth, drawHeight);

                    // Draw camera overlay ONLY if camera is enabled and available
                    if (securitySettings.cameraMicEnabled && cameraVideo && cameraVideo.srcObject) {
                        const camWidth = 320;
                        const camHeight = 240;
                        const padding = 20;
                        const cornerRadius = 10;

                        // Draw rounded rectangle background
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.beginPath();
                        ctx.roundRect(
                            canvas.width - camWidth - padding,
                            padding,
                            camWidth + 10,
                            camHeight + 10,
                            cornerRadius
                        );
                        ctx.fill();

                        // Draw camera feed with rounded corners
                        ctx.save();
                        ctx.beginPath();
                        ctx.roundRect(
                            canvas.width - camWidth - padding + 5,
                            padding + 5,
                            camWidth,
                            camHeight,
                            cornerRadius - 2
                        );
                        ctx.clip();
                        ctx.drawImage(
                            cameraVideo,
                            canvas.width - camWidth - padding + 5,
                            padding + 5,
                            camWidth,
                            camHeight
                        );
                        ctx.restore();

                        // Draw timestamp
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.font = 'bold 14px Arial';
                        ctx.fillText(
                            new Date().toLocaleTimeString(),
                            canvas.width - camWidth - padding + 15,
                            padding + 25
                        );

                        // Draw recording indicator
                        ctx.fillStyle = '#ef4444';
                        ctx.beginPath();
                        ctx.arc(
                            canvas.width - camWidth - padding + 10,
                            padding + 15,
                            5,
                            0,
                            Math.PI * 2
                        );
                        ctx.fill();
                    }

                    // Draw assessment info in bottom right
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                    ctx.font = '12px Arial';
                    const info = `You Do Assessment - ${courseId || 'Unknown Course'} - ${formatTime(timeLeft || 0)}`;
                    ctx.fillText(info, canvas.width - ctx.measureText(info).width - 10, canvas.height - 10);

                } catch (err) {
                    console.error('Error drawing frame:', err);
                }

                animationFrameRef.current = requestAnimationFrame(drawFrame);
            };

            // Wait for video to load before starting to draw
            screenVideo.onloadeddata = () => {
                drawFrame();
            };

            // Capture canvas stream
            const canvasStream = canvas.captureStream(15);

            // Add audio tracks
            const audioTracks = [];

            // Add screen audio if available
            if (displayStream.getAudioTracks().length > 0) {
                audioTracks.push(displayStream.getAudioTracks()[0]);
            }

            // Add camera/mic audio if available
            if (cameraStream?.getAudioTracks().length > 0) {
                audioTracks.push(cameraStream.getAudioTracks()[0]);
            }

            // Mix audio tracks if multiple sources
            if (audioTracks.length > 0) {
                canvasStream.addTrack(audioTracks[0]);
            }

            // Create media recorder
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                    ? 'video/webm;codecs=vp8'
                    : 'video/webm';

            const mediaRecorder = new MediaRecorder(canvasStream, {
                mimeType,
                videoBitsPerSecond: 2500000,
                audioBitsPerSecond: 128000
            });

            mediaRecorderRef.current = mediaRecorder;
            recordedChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }

                // Stop all tracks
                displayStream.getTracks().forEach(track => track.stop());
                if (cameraStream) {
                    cameraStream.getTracks().forEach(track => track.stop());
                }

                // Clean up camera preview
                if (videoRef.current) {
                    videoRef.current.srcObject = null;
                }
                setCameraStream(null);
                setScreenStream(null);

                // Save recording to Cloudinary
                await saveRecording();
            };

            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event);
                addTerminalLog('error', '❌ Recording error occurred');
            };

            mediaRecorder.start(1000); // Collect data every second
            setIsRecording(true);

            addTerminalLog('success', '✅ Recording started successfully');
            showToast({
                type: 'success',
                title: 'Recording Started',
                message: securitySettings.cameraMicEnabled
                    ? 'Screen recording with camera is now active'
                    : 'Screen recording is now active',
                duration: 3000
            });

        } catch (error) {
            console.error('Screen recording error:', error);
            addTerminalLog('error', `❌ Failed to start recording: ${error}`);
            showToast({
                type: 'error',
                title: 'Recording Failed',
                message: 'Could not start screen recording. Please check permissions.',
                duration: 5000
            });
        }
    };
    const stopScreenRecording = async () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('🎥 Stopping screen recording...');

            // Stop the recorder
            mediaRecorderRef.current.stop();
            setIsRecording(false);

            // Wait for recording to fully stop
            return new Promise<void>((resolve) => {
                if (mediaRecorderRef.current) {
                    mediaRecorderRef.current.onstop = async () => {
                        console.log('🎥 MediaRecorder stopped event fired');
                        await cleanupMediaStreams();
                        resolve();
                    };
                } else {
                    resolve();
                }

                // Timeout fallback
                setTimeout(() => {
                    console.log('🎥 Fallback cleanup after timeout');
                    cleanupMediaStreams();
                    resolve();
                }, 1000);
            });
        }
    };

    const cleanupMediaStreams = () => {
        // Stop all tracks
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            setCameraStream(null);
        }

        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            setScreenStream(null);
        }

        // Cancel animation frame
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        // Clean up video elements
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
        }
    };

    const saveRecording = async () => {
        try {
            setIsSaving(true);
            addTerminalLog('system', '💾 Saving recording to Cloudinary...');

            if (recordedChunksRef.current.length === 0) {
                throw new Error('No recording data available');
            }

            const blob = new Blob(recordedChunksRef.current, {
                type: mediaRecorderRef.current?.mimeType || 'video/webm'
            });

            // Generate unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `you_do_assessment_${courseId || 'unknown'}_${studentId}_${timestamp}.webm`;

            const formData = new FormData();
            formData.append('file', blob, filename);
            formData.append('upload_preset', CLOUDINARY_PRESET);
            formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
            formData.append('folder', 'you_do_assessments');
            formData.append('tags', `you_do,assessment,course:${courseId},student:${studentId}`);
            formData.append('context', JSON.stringify({
                course_id: courseId,
                student_id: studentId,
                exercise_id: exercise?._id,
                question_id: currentQuestion?._id,
                timestamp: new Date().toISOString(),
                category: 'You_Do',
                duration: Math.floor(blob.size / 2500000)
            }));

            const response = await fetch(CLOUDINARY_UPLOAD_URL, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.status}`);
            }

            const data = await response.json();

            addTerminalLog('success', `✅ Recording saved: ${data.secure_url}`);
            showToast({
                type: 'success',
                title: 'Recording Saved',
                message: 'Assessment recording has been uploaded successfully',
                duration: 3000
            });

            // Save recording URL to backend
            try {
                const token = getToken() || '';
                const saveResponse = await fetch('http://localhost:5533/assessment/recording', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        courseId,
                        exerciseId: exercise?._id,
                        questionId: currentQuestion?._id,
                        studentId,
                        recordingUrl: data.secure_url,
                        duration: Math.floor(blob.size / 2500000),
                        timestamp: new Date().toISOString(),
                        category: 'You_Do'
                    })
                });

                if (saveResponse.ok) {
                    addTerminalLog('success', '✅ Recording metadata saved to database');
                }
            } catch (backendError) {
                console.error('Failed to save recording metadata:', backendError);
            }

            // Clear recorded chunks
            recordedChunksRef.current = [];

        } catch (error) {
            console.error('Save recording error:', error);
            addTerminalLog('error', `❌ Failed to save recording: ${error}`);
            showToast({
                type: 'error',
                title: 'Upload Failed',
                message: 'Could not upload recording to Cloudinary',
                duration: 5000
            });
        } finally {
            setIsSaving(false);
        }
    };

    // --- Assessment Control ---
    const handleSecurityAgreement = () => {
        setHasAgreedToSecurity(true);
        setShowSecurityAgreement(false);
        startAssessment();
    };
    const getFilteredAndSortedProblems = useCallback(() => {
        let filtered = [...problems];

        // Apply difficulty filter
        if (filterDifficulty !== 'all') {
            filtered = filtered.filter(p => p.difficulty === filterDifficulty);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(query) ||
                (p.description?.toLowerCase().includes(query) || false)
            );
        }

        // Apply sorting
        switch (sortBy) {
            case 'difficulty':
                const difficultyOrder = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
                filtered.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
                break;
            case 'title':
                filtered.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'default':
            default:
                // Keep original order (by id/index)
                filtered.sort((a, b) => a.id - b.id);
                break;
        }

        return filtered;
    }, [problems, filterDifficulty, searchQuery, sortBy]);
    const startAssessment = async () => {
        if (!isAssessmentMode) return;

        setHasStarted(true);

        // Enter fullscreen ONLY if the teacher required it. Previously this
        // ran unconditionally and refused to start the assessment when the
        // request failed — which meant a student whose teacher had switched
        // "Require Fullscreen Mode" OFF still got prompted (and blocked if
        // they declined). Now: skip the request entirely when not required,
        // and treat a failed request as a warning rather than a hard stop.
        if (securitySettings.fullScreenMode) {
            try {
                await document.documentElement.requestFullscreen();
                setIsFullscreen(true);
                setIsInFullscreenMode(true);
            } catch (error) {
                console.error('Fullscreen error:', error);
                showToast({
                    type: 'error',
                    title: 'Fullscreen Required',
                    message: 'Assessment cannot start without fullscreen. Please enable it manually.',
                    duration: 5000
                });
                return; // Don't proceed if fullscreen fails AND was required
            }
        }

        // Start proctor recording. Screen capture wins when it's on; otherwise
        // Camera Proctoring alone still records the webcam — matching MCQ, SQL
        // and frontend, which previously recorded while this page recorded
        // nothing at all.
        if (securitySettings.screenRecordingEnabled) {
            await startScreenRecording();
            showToast({
                type: 'success',
                title: 'You Do Assessment Started',
                message: `Screen recording and camera are now active${securitySettings.timerEnabled ? ` (Timer: ${securitySettings.timerDuration || 60} minutes)` : ''}`,
                duration: 5000
            });
        } else if (securitySettings.cameraMicEnabled) {
            await startProctorRecording({
                courseId: courseId || (exercise?.courseId ? String(exercise.courseId) : ''),
                exerciseId: exercise?._id,
                studentId,
                category: 'You_Do',
                subcategory: subcategory || 'assessments',
                cameraOnly: true,
            }).catch(err => console.warn('Camera recording start failed:', err));
            showToast({
                type: 'success',
                title: 'You Do Assessment Started',
                message: 'Camera monitoring is now active',
                duration: 5000
            });
        } else {
            showToast({
                type: 'success',
                title: 'You Do Assessment Started',
                message: `Security features are now active${securitySettings.timerEnabled ? ` (Timer: ${securitySettings.timerDuration || 60} minutes)` : ''}`,
                duration: 5000
            });
        }

        // Log security settings
        console.log("Assessment started with settings:", {
            timerEnabled: securitySettings.timerEnabled,
            timerDuration: securitySettings.timerEnabled ? (securitySettings.timerDuration || 60) : 'disabled',
            cameraEnabled: securitySettings.cameraMicEnabled,
            screenRecording: securitySettings.screenRecordingEnabled,
            fullScreen: securitySettings.fullScreenMode
        });
    };

    const handleTermination = useCallback(async (reason: string, status: 'completed' | 'terminated' = 'terminated') => {
        // Set terminated state first
        setIsLocked(true);
        setIsTerminated(true);
        setTerminationReason(reason);

        // 1. STOP ALL RECORDINGS AND STREAMS FIRST
        await stopAllRecordingsAndStreams();

        let screenRecordingBlob: Blob | null = null;

        // 2. Create blob after stopping
        if (securitySettings.screenRecordingEnabled && recordedChunksRef.current.length > 0) {
            screenRecordingBlob = new Blob(recordedChunksRef.current, {
                type: mediaRecorderRef.current?.mimeType || 'video/webm'
            });
        }

        // 3. Exit fullscreen
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => { });
        }

        showToast({
            type: 'error',
            title: 'Assessment Terminated',
            message: reason,
            duration: 10000
        });

        // 4. Send data to backend
        try {
            const token = getToken() || '';
            const formData = new FormData();

            formData.append('courseId', courseId || '');
            formData.append('exerciseId', exercise?._id || '');
            formData.append('category', 'You_Do');
            formData.append('subcategory', subcategory || '');
            formData.append('status', status);
            formData.append('isLocked', 'true');
            formData.append('reason', reason || '');

            const userData = localStorage.getItem('userData');
            const targetUserId = userData ? JSON.parse(userData)._id : '';
            if (targetUserId) {
                formData.append('targetUserId', targetUserId);
            }

            // Add screen recording
            if (screenRecordingBlob) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `terminated_${courseId}_${studentId}_${exercise?._id}_${timestamp}.webm`;
                formData.append('screenRecording', screenRecordingBlob, filename);
            }

            await fetch('http://localhost:5533/exercise/lock', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            addTerminalLog('success', '✅ Exercise locked with recording successfully');

        } catch (error) {
            console.error('Failed to lock exercise:', error);
        }
    }, [courseId, exercise, subcategory, securitySettings.screenRecordingEnabled, studentId]);

    // Add this helper function to properly stop all recordings
    const stopAllRecordingsAndStreams = async () => {
        console.log('🛑 Stopping all recordings and streams...');

        // 0. Stop the shared camera-only recorder (no-op unless the camera-only
        // path started it). This is what uploads the clip to reviewSubmission.
        try { await stopProctorRecording(); } catch (e) { console.warn('proctor recorder stop failed', e); }

        // 1. Stop MediaRecorder if active
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log('🛑 Stopping media recorder...');
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }

        // 2. Cancel animation frame
        if (animationFrameRef.current) {
            console.log('🛑 Cancelling animation frame...');
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        // 3. Stop camera stream
        if (cameraStream) {
            console.log('🛑 Stopping camera stream...');
            cameraStream.getTracks().forEach(track => {
                track.stop();
                console.log(`🛑 Stopped camera track: ${track.kind}`);
            });
            setCameraStream(null);

            // Clear video element
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        }

        // 4. Stop screen stream
        if (screenStream) {
            console.log('🛑 Stopping screen stream...');
            screenStream.getTracks().forEach(track => {
                track.stop();
                console.log(`🛑 Stopped screen track: ${track.kind}`);
            });
            setScreenStream(null);
        }

        // 5. Clear screenVideoRef
        if (screenVideoRef.current) {
            screenVideoRef.current.srcObject = null;
        }

        // 6. Clear canvas
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
        }

        // 7. Reset input resolver
        if (inputResolverRef.current) {
            inputResolverRef.current('');
            inputResolverRef.current = null;
        }

        // 8. Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 500));

        console.log('✅ All recordings and streams stopped');
    };
    // --- Code Execution ---
    // Update the executeCode function around line ~730
    const executeCode = async (input: string = ""): Promise<{ output: string; error?: string; runtime?: number }> => {
        try {
            const pistonLang = getPistonLanguage(selectedLanguage);
            const currentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;

            // Check for Python execution with Pyodide
            if (selectedLanguage.toLowerCase() === 'python' && pyodideReady && pyodideRef.current) {
                // REMOVED: addTerminalLog('system', 'Running Python with Pyodide...');

                try {
                    // Setup stdout/stderr capture
                    pyodideRef.current.setStdout({
                        batched: (msg: string) => addTerminalLog('stdout', msg)
                    });
                    pyodideRef.current.setStderr({
                        batched: (msg: string) => addTerminalLog('stderr', msg)
                    });

                    // Handle input
                    if (input) {
                        const inputCode = currentCode.replace(/input\s*\(/g, `(${JSON.stringify(input)} + `);
                        await pyodideRef.current.runPythonAsync(inputCode);
                    } else {
                        await pyodideRef.current.runPythonAsync(currentCode);
                    }

                    return {
                        output: "", // Return empty string instead of success message
                        error: undefined,
                        runtime: 0
                    };
                } catch (err: any) {
                    return {
                        output: "",
                        error: err.message,
                        runtime: 0
                    };
                }
            }

            // Java requires filename to match the public class name exactly
            const getFileName = (lang: string, code: string): string => {
                if (lang === 'java') {
                    const match = code.match(/public\s+class\s+(\w+)/);
                    return match ? `${match[1]}.java` : 'Main.java';
                }
                const extMap: Record<string, string> = {
                    python: 'main.py', javascript: 'main.js', typescript: 'main.ts',
                    cpp: 'main.cpp', c: 'main.c', csharp: 'main.cs', go: 'main.go',
                    rust: 'main.rs', kotlin: 'main.kt', swift: 'main.swift',
                    php: 'main.php', ruby: 'main.rb', scala: 'main.scala',
                };
                return extMap[lang] || 'main';
            };

            const requestBody = {
                language: pistonLang.language,
                version: pistonLang.version,
                files: [
                    {
                        name: getFileName(pistonLang.language, currentCode),
                        content: currentCode
                    }
                ],
                stdin: input || "",
                args: [],
                compile_timeout: 10000,
                run_timeout: 3000, // self-hosted Piston caps run_timeout at 3000
                compile_memory_limit: -1,
                run_memory_limit: -1
            };

            // REMOVED: addTerminalLog('system', `Executing ${selectedLanguage} code...`);

            const response = await fetch(PISTON_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (data.run) {
                // Only add logs for actual output/errors, not success messages
                if (data.run.output) {
                    addTerminalLog('stdout', data.run.output.trim());
                }
                if (data.run.stderr) {
                    addTerminalLog('stderr', data.run.stderr);
                }
                // REMOVED: if (data.run.error) {
                // REMOVED:     addTerminalLog('error', data.run.error);
                // REMOVED: }

                return {
                    output: data.run.output?.trim() || "",
                    error: data.run.stderr || data.run.error,
                    runtime: data.run.time
                };
            } else {
                // Still show error if execution completely failed
                addTerminalLog('error', 'Execution failed');
                return {
                    output: "",
                    error: "Execution failed"
                };
            }
        } catch (error) {
            console.error("Piston API error:", error);
            addTerminalLog('error', `Execution error: ${error}`);
            return {
                output: "",
                error: `Execution error: ${error}`
            };
        }
    };

    // ── Test-case verification & auto-scoring ──────────────────────────────
    // Normalize program output for comparison: CRLF→LF, strip trailing
    // whitespace per line, trim leading/trailing blank lines.
    const normalizeOutput = (s: string): string =>
        (s || '').replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\s+$/, '')).join('\n').trim();

    // Silent Piston run used for grading — no terminal spam, compares stdout only.
    const runCodeForGrading = async (input: string, overrideCode?: string): Promise<{ output: string; error?: string }> => {
        const pistonLang = getPistonLanguage(selectedLanguage);
        const currentCode = overrideCode ?? (editorInstanceRef.current ? editorInstanceRef.current.getValue() : code);
        const getFileName = (lang: string, src: string): string => {
            if (lang === 'java') {
                const match = src.match(/public\s+class\s+(\w+)/);
                return match ? `${match[1]}.java` : 'Main.java';
            }
            const extMap: Record<string, string> = {
                python: 'main.py', javascript: 'main.js', typescript: 'main.ts',
                cpp: 'main.cpp', c: 'main.c', csharp: 'main.cs', go: 'main.go',
                rust: 'main.rs', kotlin: 'main.kt', swift: 'main.swift',
                php: 'main.php', ruby: 'main.rb', scala: 'main.scala',
            };
            return extMap[lang] || 'main';
        };
        const response = await fetch(PISTON_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language: pistonLang.language,
                version: pistonLang.version,
                files: [{ name: getFileName(pistonLang.language, currentCode), content: currentCode }],
                stdin: input || "",
                args: [],
                compile_timeout: 10000,
                run_timeout: 3000, // self-hosted Piston caps run_timeout at 3000
                compile_memory_limit: -1,
                run_memory_limit: -1
            })
        });
        const data = await response.json();
        if (data.compile && data.compile.code !== 0) {
            return { output: "", error: data.compile.stderr || data.compile.output || 'Compilation failed' };
        }
        if (data.run) {
            return { output: data.run.stdout ?? data.run.output ?? "", error: data.run.stderr || data.run.error || undefined };
        }
        return { output: "", error: data.message || 'Execution failed' };
    };

    // Max marks for the current question, mirroring the marks badge logic.
    const getCurrentQuestionMaxMarks = (): number => {
        const currentQ: any = exercise?.questions?.[currentProblemIndex] ?? currentQuestion;
        const ss: any = exercise?.questionConfiguration?.programmingQuestionConfiguration?.scoreSettings;
        const diff = (currentQ?.difficulty || '').toLowerCase();
        let m: number | null = null;
        if (ss?.scoreType === 'evenMarks') m = Number(ss.evenMarks) || null;
        else if (ss?.scoreType === 'levelBasedMarks' && ss.levelBasedMarks === 'level_specific') {
            const lc = ss.levelScoringConfiguration?.[diff];
            m = Number(lc?.marksPerQuestion) || Number(lc?.totalMarks) || null;
        } else {
            m = Number(currentQ?.points) || Number(currentQ?.score) || null;
        }
        if (m == null && ss?.levelScoringConfiguration) {
            m = Number(ss.levelScoringConfiguration?.[diff]?.marksPerQuestion) || null;
        }
        return m || 10;
    };

    // Run every test case against the student's code and convert the pass
    // ratio into marks: score = (passed / total) × maxMarks.
    const verifyTestCasesAndScore = async (): Promise<{ passed: number; total: number; score: number; maxMarks: number }> => {
        const liveQuestion: any = exercise?.questions?.[currentProblemIndex] ?? currentQuestion;
        const testCases: any[] = liveQuestion?.testCases || [];
        const maxMarks = getCurrentQuestionMaxMarks();
        if (testCases.length === 0) {
            addTerminalLog('warning', '⚠️ No test cases configured for this question — score not auto-evaluated.');
            return { passed: 0, total: 0, score: 0, maxMarks };
        }
        addTerminalLog('system', `🧪 Running ${testCases.length} test case${testCases.length > 1 ? 's' : ''}...`);
        let passed = 0;
        for (let i = 0; i < testCases.length; i++) {
            const tc = testCases[i];
            const label = tc.isHidden ? `Hidden test #${i + 1}` : `Test #${i + 1}`;
            try {
                const res = await runCodeForGrading(tc.input ?? '');
                const ok = normalizeOutput(res.output) === normalizeOutput(tc.expectedOutput ?? '');
                if (ok) {
                    passed++;
                    addTerminalLog('success', `✓ ${label} passed`);
                } else if (tc.isHidden) {
                    addTerminalLog('error', `✗ ${label} failed`);
                } else {
                    addTerminalLog('error', `✗ ${label} failed — expected: ${tc.expectedOutput ?? ''} | got: ${res.output?.trim() || res.error || '(no output)'}`);
                }
            } catch {
                addTerminalLog('error', `✗ ${label} failed (execution error)`);
            }
            // Soft rate-limit guard for the public Piston API
            if (i < testCases.length - 1) await new Promise(r => setTimeout(r, 300));
        }
        const score = Math.round((passed / testCases.length) * maxMarks * 100) / 100;
        addTerminalLog(passed === testCases.length ? 'success' : 'info', `🏁 Passed ${passed}/${testCases.length} — Score: ${score}/${maxMarks}`);
        return { passed, total: testCases.length, score, maxMarks };
    };

    // ── Function-model harness (LeetCode style) ────────────────────────────────
    // Wrap a student's function with a per-language driver so test inputs arrive as
    // ARGUMENTS, not stdin. Only Python today; other languages return null → the
    // grader runs the code raw (stdin/stdout I/O model), so nothing else changes.
    const buildHarness = (studentCode: string, language: string, functionName: string): string | null => {
        const fn = (functionName || 'main').replace(/[^A-Za-z0-9_]/g, '') || 'main';
        if (language.toLowerCase() === 'python') {
            return `${studentCode}

# ---- auto-generated test harness (do not edit) ----
import sys as _sys, json as _json
def _parse(_s):
    _s = _s.strip()
    try:
        return int(_s)
    except ValueError:
        pass
    try:
        return float(_s)
    except ValueError:
        pass
    try:
        return _json.loads(_s)
    except Exception:
        return _s
_args = [_parse(_x) for _x in _sys.stdin.read().splitlines()]
_res = ${fn}(*_args)
if isinstance(_res, bool):
    print(str(_res).lower())
elif isinstance(_res, (list, dict)):
    print(_json.dumps(_res))
else:
    print(_res)
`;
        }
        return null;
    };

    // Use the harness only when the code is written as a function (defines the entry
    // function AND doesn't read stdin) — so existing I/O-style code keeps working.
    const isFunctionStyle = (studentCode: string, functionName: string): boolean => {
        const fn = (functionName || 'main').replace(/[^A-Za-z0-9_]/g, '') || 'main';
        const defines = new RegExp(`def\\s+${fn}\\s*\\(`).test(studentCode);
        const readsStdin = /\binput\s*\(/.test(studentCode) || /sys\.stdin/.test(studentCode);
        return defines && !readsStdin;
    };

    // ── Run a set of test cases and collect per-case rows for the Test Results table ──
    // Uses the silent Piston grader (real stdout for every language) and wall-clock
    // times each case. Inputs/outputs are kept for all cases (hidden included), per
    // the "show everything" display choice for this exercise.
    const runCasesToResults = async (cases: any[]) => {
        const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const rows: typeof testResults = [];
        // Decide once whether to wrap the code in the function-model harness, so the
        // same program is used for every case. Falls back to raw (I/O) execution.
        const studentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;
        const liveQ: any = exercise?.questions?.[currentProblemIndex] ?? currentQuestion;
        const fnName = liveQ?.solutions?.functionName || 'main';
        const wrapped = isFunctionStyle(studentCode, fnName)
            ? buildHarness(studentCode, selectedLanguage, fnName)
            : null;
        for (let i = 0; i < cases.length; i++) {
            const tc = cases[i];
            const t0 = now();
            let actual = '';
            let status: 'passed' | 'failed' | 'skipped' = 'failed';
            try {
                const res = await runCodeForGrading(tc.input ?? '', wrapped ?? undefined);
                actual = (res.output ?? '').trim() || (res.error ? `Error: ${res.error}` : '');
                status = normalizeOutput(res.output) === normalizeOutput(tc.expectedOutput ?? '') ? 'passed' : 'failed';
            } catch {
                actual = '(execution error)';
                status = 'failed';
            }
            rows.push({
                caseNo: i + 1,
                input: tc.input ?? '',
                expected: tc.expectedOutput ?? '',
                actual,
                status,
                time: `${((now() - t0) / 1000).toFixed(2)}s`,
                isHidden: !!tc.isHidden,
            });
            // Soft rate-limit guard for the Piston API between cases
            if (i < cases.length - 1) await new Promise(r => setTimeout(r, 300));
        }
        return rows;
    };

    // Compile & Run → execute ONLY the sample (non-hidden) test cases.
    const compileAndRun = async () => {
        const liveQuestion: any = exercise?.questions?.[currentProblemIndex] ?? currentQuestion;
        const sampleCases: any[] = (liveQuestion?.testCases || []).filter((tc: any) => !tc.isHidden);
        if (sampleCases.length === 0) {
            showToast({ type: 'info', title: 'No sample test cases', message: 'This question has no visible sample test cases to run.', duration: 3000 });
            return;
        }
        setIsRunning(true);
        setShowTerminal(true);
        setBottomTab('results');
        setRightPanelSplit(prev => (prev > 60 ? 55 : prev));
        try {
            setTestResults(await runCasesToResults(sampleCases));
        } catch (err: any) {
            showToast({ type: 'error', title: 'Run failed', message: err?.message || 'Could not run the code.', duration: 4000 });
        } finally {
            setIsRunning(false);
        }
    };

    // Submit Code → execute ALL test cases (sample + hidden), show the full table,
    // auto-score by pass ratio and submit the result to the backend.
    const handleSubmitCode = async () => {
        if (exercise?.questionBehavior?.attemptLimitEnabled) {
            const max = exercise.questionBehavior.maxAttempts || 1;
            if (userAttempts >= max) {
                showToast({ type: 'error', title: 'Limit Reached', message: `Maximum attempts reached (${userAttempts}/${max}). You cannot submit again.`, duration: 4000 });
                return;
            }
        }
        const liveQuestion: any = exercise?.questions?.[currentProblemIndex] ?? currentQuestion;
        // Which evaluation method the trainer picked for this exercise. Only
        // Test Case actually needs a testCases array; Manual/AI go through
        // independently. Historically this handler bailed for testCases.length===0
        // — that's the correct behaviour for Test Case only; Manual+AI must
        // proceed without a test-case list.
        const { method, aiCriteria } = resolveEvaluationMethod(exercise, category);
        const allCases: any[] = liveQuestion?.testCases || [];
        if (method === 'testcase' && allCases.length === 0) {
            showToast({ type: 'info', title: 'No test cases', message: 'No test cases are configured for this question.', duration: 3000 });
            return;
        }
        setIsRunning(true);
        setShowTerminal(true);
        setBottomTab('results');
        setRightPanelSplit(prev => (prev > 60 ? 55 : prev));
        try {
            let submitScore = 0;
            let submitStatus: 'submitted' | 'solved' = 'submitted';
            let submitBreakdown: any = null;
            let toastMsg = '';

            if (method === 'testcase') {
                // ── Existing You_Do behaviour, now recorded as a breakdown too. ──
                const rows = await runCasesToResults(allCases);
                setTestResults(rows);
                const passed = rows.filter(r => r.status === 'passed').length;
                const total = rows.length;
                const maxMarks = getCurrentQuestionMaxMarks();
                submitScore = total > 0 ? Math.round((passed / total) * maxMarks * 100) / 100 : 0;
                submitStatus = (total > 0 && passed === total) ? 'solved' : 'submitted';
                submitBreakdown = { method: 'testcase', testcase: { passed, total } };
                toastMsg = `Passed ${passed}/${total} test cases${maxMarks ? ` · Score ${submitScore}/${maxMarks}` : ''}.`;
            } else if (method === 'ai') {
                addTerminalLog('system', '🤖 Running AI evaluation…');
                const maxMarks = getCurrentQuestionMaxMarks();
                const currentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;
                // Per-question mode: pass the specific question so the resolver
                // picks its `aiTestCasesCount` (falling back to the exercise's
                // count for legacy questions without the field).
                const { getAiTestCasesCountFor } = resolveEvaluationMethod(exercise, category);
                const aiTestCasesCount = getAiTestCasesCountFor(liveQuestion);
                const cachedGen = Array.isArray((liveQuestion as any)?.aiGeneratedTestCases)
                    ? (liveQuestion as any).aiGeneratedTestCases : [];
                const aiResult = await evaluateWithAi({
                    code: currentCode,
                    language: selectedLanguage,
                    question: {
                        title: liveQuestion?.title || (liveQuestion as any)?.questionTitle || '',
                        description: typeof liveQuestion?.description === 'string' ? liveQuestion.description : liveQuestion?.description?.text || '',
                        testCases: liveQuestion?.testCases || [],
                    },
                    criteria: aiCriteria,
                    maxMarks,
                    testCasesCount: aiTestCasesCount,
                    cachedGeneratedTestCases: cachedGen,
                });
                submitScore = aiResult.totalScore;
                submitStatus = 'submitted'; // AI never auto-marks 'solved' — trainer decides
                submitBreakdown = aiResult.breakdown;
                if (aiResult.newlyGeneratedTestCases && aiResult.newlyGeneratedTestCases.length > 0 && (liveQuestion as any)?._id) {
                    const token = getToken() || localStorage.getItem('token') || '';
                    fetch('http://localhost:5533/courses/answers/persist-ai-test-cases', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({
                            exerciseId: exercise?._id,
                            questionId: (liveQuestion as any)._id,
                            courseId,
                            nodeId,
                            nodeType,
                            category: category || 'You_Do',
                            subcategory,
                            testCases: aiResult.newlyGeneratedTestCases,
                            model: aiResult.breakdown.ai.model,
                        }),
                    }).catch(() => { /* silent */ });
                }
                if (aiResult.failed) {
                    showToast({
                        type: 'warning',
                        title: 'AI grader unavailable',
                        message: aiResult.errorMessage || 'AI grader failed. Your code was saved — trainer will grade manually.',
                        duration: 6000,
                    });
                    addTerminalLog('warning', `⚠️ ${aiResult.errorMessage || 'AI grader failed.'}`);
                    toastMsg = 'Code saved — AI grader unavailable, trainer will grade.';
                } else {
                    const b = aiResult.breakdown.ai;
                    addTerminalLog('success', `🏁 AI score: ${submitScore}/${maxMarks} — ${b.passedTestCases}/${b.totalTestCases} test cases passed`);
                    toastMsg = `AI evaluated: ${submitScore}/${maxMarks}`;
                }
            } else {
                // method === 'manual' — never run tests or AI, post code with score:0.
                addTerminalLog('info', '📝 Manual grading — your code was saved for the trainer to grade.');
                toastMsg = 'Your code was saved for manual grading.';
            }

            if (currentQuestion) {
                const qId = liveQuestion?._id || currentQuestion._id;
                await submitProgressToBackend(qId, submitStatus, submitScore, false, submitBreakdown);
                submittedScoresRef.current[qId] = submitScore;
            }
            setSolvedQuestions(prev => { const s = new Set(prev); s.add(currentProblemIndex); return s; });
            showToast({
                type: submitBreakdown?.ai?.failed ? 'warning' : 'success',
                title: 'Code Submitted',
                message: toastMsg,
                duration: 3500,
            });
        } catch (err: any) {
            showToast({ type: 'error', title: 'Submission Failed', message: err?.message || 'Could not submit your code.', duration: 4000 });
        } finally {
            setIsRunning(false);
        }
    };

    const doSubmitTest = async () => {
        if (isTestSubmittingRef.current) return;
        isTestSubmittingRef.current = true;
        try {
            if (currentQuestion) {
                const liveQuestion = exercise?.questions?.[currentProblemIndex];
                const qId = liveQuestion?._id || currentQuestion._id;

                if (solvedQuestions.has(currentProblemIndex) && submittedScoresRef.current[qId] != null) {
                    // Already Submit-scored this question earlier — reuse the stored
                    // score. We only need to flip status to submitted at the exercise
                    // level (isTestSubmission=true). Deliberately no re-run of AI/
                    // Test Case here: it would double-charge Gemini and double-run
                    // Piston for no new signal — the trainer will see the same result.
                    await submitProgressToBackend(qId, 'submitted', submittedScoresRef.current[qId], true);
                } else {
                    // First-time submit path — same branch logic as handleSubmitCode.
                    setShowTerminal(true);
                    const { method, aiCriteria } = resolveEvaluationMethod(exercise, category);
                    let submitScore = 0;
                    let submitStatus: 'submitted' | 'solved' = 'submitted';
                    let submitBreakdown: any = null;
                    if (method === 'testcase') {
                        const { passed, total, score } = await verifyTestCasesAndScore();
                        submitScore = score;
                        submitStatus = (total > 0 && passed === total) ? 'solved' : 'submitted';
                        submitBreakdown = { method: 'testcase', testcase: { passed, total } };
                    } else if (method === 'ai') {
                        addTerminalLog('system', '🤖 Running AI evaluation…');
                        const maxMarks = getCurrentQuestionMaxMarks();
                        const currentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;
                        // Per-question mode: pass the specific question so the resolver
                        // picks its `aiTestCasesCount` (falling back to the exercise's
                        // count for legacy questions without the field).
                        const { getAiTestCasesCountFor } = resolveEvaluationMethod(exercise, category);
                        const aiTestCasesCount = getAiTestCasesCountFor(liveQuestion);
                        const cachedGen = Array.isArray((liveQuestion as any)?.aiGeneratedTestCases)
                            ? (liveQuestion as any).aiGeneratedTestCases : [];
                        const aiResult = await evaluateWithAi({
                            code: currentCode,
                            language: selectedLanguage,
                            question: {
                                title: (liveQuestion as any)?.title || (liveQuestion as any)?.questionTitle || '',
                                description: typeof liveQuestion?.description === 'string' ? liveQuestion.description : liveQuestion?.description?.text || '',
                                testCases: liveQuestion?.testCases || [],
                            },
                            criteria: aiCriteria,
                            maxMarks,
                            testCasesCount: aiTestCasesCount,
                            cachedGeneratedTestCases: cachedGen,
                        });
                        submitScore = aiResult.totalScore;
                        submitBreakdown = aiResult.breakdown;
                        if (aiResult.newlyGeneratedTestCases && aiResult.newlyGeneratedTestCases.length > 0 && (liveQuestion as any)?._id) {
                            const token = getToken() || localStorage.getItem('token') || '';
                            fetch('http://localhost:5533/courses/answers/persist-ai-test-cases', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({
                                    exerciseId: exercise?._id,
                                    questionId: (liveQuestion as any)._id,
                                    courseId,
                                    nodeId,
                                    nodeType,
                                    category: category || 'You_Do',
                                    subcategory,
                                    testCases: aiResult.newlyGeneratedTestCases,
                                    model: aiResult.breakdown.ai.model,
                                }),
                            }).catch(() => { /* silent */ });
                        }
                        if (aiResult.failed) {
                            showToast({
                                type: 'warning',
                                title: 'AI grader unavailable',
                                message: aiResult.errorMessage || 'AI grader failed. Your code was saved — trainer will grade manually.',
                                duration: 6000,
                            });
                        }
                    }
                    // method === 'manual' → submitScore stays 0.
                    await submitProgressToBackend(qId, submitStatus, submitScore, true, submitBreakdown);
                    submittedScoresRef.current[qId] = submitScore;
                }
            }

            setSolvedQuestions(prev => { const newSet = new Set(prev); newSet.add(currentProblemIndex); return newSet; });
            if (exercise?._id) localStorage.removeItem('ex_in_progress_' + exercise._id);

            try { sessionStorage.setItem('lms_submit_toast', 'Test submitted successfully!'); } catch {}

            showToast({ type: 'success', title: 'Test Submitted', message: 'Your test has been submitted successfully.', duration: 3000 });

            setTimeout(() => {
                if (isAssessmentMode && hasStarted) {
                    if (isRecording) stopScreenRecording();
                    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                }
                if (onCloseExercise) onCloseExercise();
                else if (onBack) onBack();
            }, 1500);
        } catch (error: any) {
            isTestSubmittingRef.current = false;
            showToast({ type: 'error', title: 'Submission Failed', message: error.message || 'Could not submit test.', duration: 4000 });
        }
    };

    const handleTimeUpAutoSubmit = async () => {
        if (timeUpHandledRef.current) return;
        // "Auto-submit on Timeout" — on by default; when a teacher switches it
        // off the countdown still reaches zero, it just doesn't end the attempt.
        if (_normSecurity.autoSubmitOnTimeout === false) return;
        timeUpHandledRef.current = true;
        try {
            if (currentQuestion) {
                const liveQuestion = exercise?.questions?.[currentProblemIndex];
                const qId = liveQuestion?._id || currentQuestion._id;
                const { passed, total, score } = await verifyTestCasesAndScore();
                await submitProgressToBackend(
                    qId,
                    total > 0 && passed === total ? 'solved' : 'submitted',
                    score,
                    true
                );
                submittedScoresRef.current[qId] = score;
            }
            if (exercise?._id) localStorage.removeItem('ex_in_progress_' + exercise._id);

            try { sessionStorage.setItem('lms_submit_toast', 'Test auto-submitted — time expired.'); } catch {}

            showToast({ type: 'info', title: "Time's up!", message: 'Your test has been auto-submitted.', duration: 4000 });

            setTimeout(() => {
                if (isAssessmentMode && hasStarted) {
                    if (isRecording) stopScreenRecording();
                    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                }
                if (onCloseExercise) onCloseExercise();
                else if (onBack) onBack();
            }, 1200);
        } catch (error: any) {
            showToast({ type: 'error', title: 'Auto-submit failed', message: error.message || 'Could not auto-submit.', duration: 4000 });
        }
    };

    const runCode = async () => {
        // Check security setting first, then exercise setting
        // const isCopyPasteDisabled = securitySettings.disableClipboard === true;

        // if (isCopyPasteDisabled && isCopyPasteDetected(code)) {
        //     addTerminalLog('error', 'Copy-paste is not allowed for this exercise. Please type the code yourself.');
        //     return;
        // }

        // Then check exercise setting if security doesn't restrict it
        // if (!isCopyPasteDisabled && !exercise?.compilerSettings?.allowCopyPaste && isCopyPasteDetected(code)) {
        //     addTerminalLog('error', 'Copy-paste is not allowed for this exercise. Please type the code yourself.');
        //     return;
        // }

        setIsRunning(true);
        clearTerminal();

        setRightPanelSplit(60);

        try {
            const sampleInput = problem?.examples?.[0]?.input ||
                currentQuestion?.sampleInput ||
                "";

            const executionResult = await executeCode(sampleInput);



        } catch (error) {
            addTerminalLog('error', `Error: ${error}`);
        } finally {
            setIsRunning(false);
        }
    };
    // Add this useEffect to handle camera stream updates
    useEffect(() => {
        if (cameraStream && videoRef.current) {
            videoRef.current.srcObject = cameraStream;

            const playVideo = () => {
                if (videoRef.current && videoRef.current.paused) {
                    videoRef.current.play().catch(e => {
                        console.warn("Camera play failed:", e);
                    });
                }
            };

            // Try to play immediately
            playVideo();

            // Try again after a delay
            const timer = setTimeout(playVideo, 1000);

            return () => clearTimeout(timer);
        }
    }, [cameraStream]);
    // --- Submission ---
    const submitProgressToBackend = async (
        questionId: string,
        status = 'attempted',
        score = 0,
        isTestSubmission = false,  // ← NEW PARAM
        evaluationBreakdown: any = null, // per-question breakdown for Test Case / AI; null for Manual + nav-saves
        codeOverride?: string, // link questions: no editor mounted — send an explicit marker, never a stale editor buffer
    ) => {
        try {
            const currentCode = codeOverride !== undefined
                ? codeOverride
                : editorInstanceRef.current
                    ? editorInstanceRef.current.getValue()
                    : code;
            const currentCourseId = courseId || (exercise?.courseId
                ? exercise.courseId.toString()
                : "");
            if (!currentCourseId) {
                throw new Error('No courseId');
            }

            // Score is now the authoritative test-case-derived value from
            // verifyTestCasesAndScore (or 0 on a failed submit). Don't rewrite
            // it — the legacy "score>0 ? score : 100" fallback masked real zeros
            // and would falsely award full marks on solved status with maxMarks=0.
            const finalScore = Math.max(0, Number(score) || 0);

            const formData = new FormData();
            formData.append('courseId', currentCourseId);
            formData.append('exerciseId', exercise?._id || "");
            formData.append('questionId', questionId);
            formData.append('code', currentCode);
            formData.append('score', finalScore.toString());
            formData.append('status', status);
            formData.append('category', category || "We_Do");
            formData.append('subcategory', subcategory);
            formData.append('nodeId', nodeId || "");
            formData.append('nodeName', nodeName || "");
            formData.append('nodeType', nodeType || "");
            formData.append('language', selectedLanguage);
            formData.append('totalScore', getCurrentQuestionMaxMarks().toString());
            formData.append('attemptLimitEnabled', (exercise?.questionBehavior?.attemptLimitEnabled || false).toString());
            formData.append('maxAttempts', (exercise?.questionBehavior?.maxAttempts || 1).toString());
            formData.append('isTestSubmission', isTestSubmission.toString());
            if (evaluationBreakdown) {
                formData.append('evaluationBreakdown', JSON.stringify(evaluationBreakdown));
            }

            const token = getToken()
                || localStorage.getItem('token')
                || '';

            const response = await fetch('http://localhost:5533/courses/answers/submit', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            const result = await response.json();

            if (response.status === 403) {
                const errorMsg = result.message?.find((m: any) => m.key === 'error')?.value
                    || "Max attempts reached.";
                throw new Error(errorMsg);
            }

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            // Live dashboard: a real submission (not a nav-save) completes the question.
            if (status === 'submitted' || status === 'solved') {
                live.answerSaved(questionId);
            }

            // ── Sync userAttempts from backend ONLY on full test submission ──
            if (isTestSubmission && result.userAttempts != null) {
                setUserAttempts(result.userAttempts);
            }

            return result;

        } catch (error: any) {
            addTerminalLog('error', `❌ Submission failed: ${error.message}`);
            throw error;
        }
    };
    // const submitCode = async () => {
    //     if (isAssessmentMode && !hasStarted) {
    //         showToast({
    //             type: 'warning',
    //             title: 'Assessment Not Started',
    //             message: 'Please start the assessment first',
    //             duration: 3000
    //         });
    //         return;
    //     }

    //     // Check security setting first
    //     const isCopyPasteDisabled = securitySettings.disableClipboard === true;

    //     if (isCopyPasteDisabled && isCopyPasteDetected(code)) {
    //         addTerminalLog('error', 'Submission rejected: Copy-paste is not allowed for this exercise.');
    //         return;
    //     }

    //     // Then check exercise setting if security doesn't restrict it
    //     if (!isCopyPasteDisabled && !exercise?.compilerSettings?.allowCopyPaste && isCopyPasteDetected(code)) {
    //         addTerminalLog('error', 'Submission rejected: Copy-paste is not allowed for this exercise.');
    //         return;
    //     }

    //     // Check attempts
    //     if (exercise?.questionBehavior?.attemptLimitEnabled && currentQuestion) {
    //         const max = exercise.questionBehavior.maxAttempts || 1;
    //         if (userAttempts >= max) {
    //             const msg = `Maximum attempts reached (${userAttempts}/${max}). You cannot submit again.`;
    //             addTerminalLog('error', msg);
    //             showToast({
    //                 type: 'error',
    //                 title: 'Limit Reached',
    //                 message: msg,
    //                 duration: 4000
    //             });
    //             return;
    //         }
    //     }

    //     setIsRunning(true);
    //     setShowTerminal(true);
    //     clearTerminal();

    //     addTerminalLog('system', '🚀 Starting submission process...');

    //     try {
    //         // Prepare screen recording blob if available
    //         let screenRecordingBlob: Blob | undefined;
    //         if (securitySettings.screenRecordingEnabled && recordedChunksRef.current.length > 0) {
    //             screenRecordingBlob = new Blob(recordedChunksRef.current, {
    //                 type: mediaRecorderRef.current?.mimeType || 'video/webm'
    //             });
    //             addTerminalLog('system', `📹 Including screen recording with submission (${screenRecordingBlob.size} bytes)...`);
    //         }

    //         // Submit to backend with screen recording
    //         addTerminalLog('system', '💾 Saving progress to server for manual evaluation...');
    //         const submitResponse = await submitProgressToBackend(
    //             currentQuestion!._id,
    //             'submitted', // Use 'submitted' status for manual evaluation
    //             0, // Score will be assigned manually
    //             screenRecordingBlob
    //         );

    //         if (submitResponse && submitResponse.success) {
    //             // Update attempts
    //             setUserAttempts(prev => prev + 1);

    //             addTerminalLog('success', '✅ Code submitted for manual evaluation!');

    //             // Mark as submitted
    //             setSolvedQuestions(prev => {
    //                 const newSet = new Set(prev);
    //                 newSet.add(currentProblemIndex);
    //                 return newSet;
    //             });

    //             // Check if this is the last question
    //             const isLastQuestion = currentProblemIndex === problems.length - 1;

    //             // Auto-navigate if allowed (only if not last question)
    //             if (isFreeFlow && !isLastQuestion) {
    //                 let countdown = 3;

    //                 const countdownInterval = setInterval(() => {
    //                     addTerminalLog('system', `⏱️ Next question in ${countdown}...`);
    //                     countdown--;

    //                     if (countdown < 0) {
    //                         clearInterval(countdownInterval);
    //                         setCurrentProblemIndex(currentProblemIndex + 1);
    //                         addTerminalLog('system', '➡️ Moving to next question...');
    //                     }
    //                 }, 1000);
    //             }

    //             // Check if last question in assessment mode
    //             if (isAssessmentMode && isLastQuestion) {
    //                 addTerminalLog('success', '🎉 Assessment completed! All questions submitted.');

    //                 // Show completion message
    //                 showToast({
    //                     type: 'success',
    //                     title: 'Assessment Completed',
    //                     message: 'All questions have been submitted successfully!',
    //                     duration: 5000
    //                 });

    //                 // Stop recording if active
    //                 if (isRecording) {
    //                     await stopScreenRecording();
    //                 }

    //                 // Exit fullscreen if in fullscreen mode
    //                 if (document.fullscreenElement) {
    //                     await document.exitFullscreen();
    //                 }

    //                 // Add a delay before redirecting to let the user see the success message
    //                 setTimeout(() => {
    //                     // Redirect to the course detailed view
    //                     if (courseId) {
    //                         // router.refresh();

    //                         if (onCloseExercise) {
    //                             onCloseExercise();
    //                         }
    //                     } else {
    //                         // Fallback if no courseId is available
    //                         router.push('/lms/dashboard');
    //                     }
    //                 }, 2000);

    //             } else if (isLastQuestion && !isAssessmentMode) {
    //                 // For non-assessment mode, still redirect after last question
    //                 addTerminalLog('success', '✅ All questions completed!');

    //                 showToast({
    //                     type: 'success',
    //                     title: 'Exercise Completed',
    //                     message: 'All questions have been submitted!',
    //                     duration: 3000
    //                 });

    //                 setTimeout(() => {
    //                     if (courseId) {
    //                         if (onCloseExercise) {
    //                             onCloseExercise();
    //                         }
    //                     } else {
    //                         router.push('/lms/dashboard');
    //                     }
    //                 }, 2000);
    //             }

    //         }

    //     } catch (error: any) {
    //         console.error("Submission error:", error);
    //         addTerminalLog('error', `❌ ${error.message}`);
    //     } finally {
    //         setIsRunning(false);
    //     }
    // };



    const submitCode = async () => {
        if (exercise?.questionBehavior?.attemptLimitEnabled && currentQuestion) {
            const max = exercise.questionBehavior.maxAttempts || 1;
            if (userAttempts >= max) {
                const msg = `Maximum attempts reached (${userAttempts}/${max}). You cannot submit again.`;
                addTerminalLog('error', msg);
                showToast({ type: 'error', title: 'Limit Reached', message: msg, duration: 4000 });
                return;
            }
        }

        const isLastQuestion = currentProblemIndex === problems.length - 1;

        if (isLastQuestion && exercise?.questionBehavior?.allQuestionsRequired === true) {
            const missing: number[] = [];
            for (let i = 0; i < problems.length; i++) {
                if (i !== currentProblemIndex && !solvedQuestions.has(i)) missing.push(i + 1);
            }
            if (missing.length > 0) {
                showToast({
                    type: 'error',
                    title: 'Incomplete Submission',
                    message: `You must attempt all questions before submitting. Questions ${missing.join(', ')} remaining.`,
                    duration: 5000
                });
                return;
            }
        }

        setIsRunning(true);
        clearTerminal();

        try {
            const liveQuestion = exercise?.questions?.[currentProblemIndex];
            const liveQuestionId = liveQuestion?._id || currentQuestion?._id;

            // ── isTestSubmission true only on last question ──
            const submitResponse = await submitProgressToBackend(
                liveQuestionId!,
                'submitted',
                0,
                isLastQuestion  // ← true only for last question
            );

            if (submitResponse && submitResponse.success) {
                setSolvedQuestions(prev => {
                    const newSet = new Set(prev);
                    newSet.add(currentProblemIndex);
                    return newSet;
                });

                if (isLastQuestion) {
                    showToast({
                        type: 'success',
                        title: 'Exercise Completed',
                        message: 'All questions have been submitted!',
                        duration: 3000
                    });
                    setTimeout(() => {
                        if (onCloseExercise) onCloseExercise();
                        else router.push('/lms/dashboard');
                    }, 2000);
                } else {
                    showToast({
                        type: 'success',
                        title: 'Submitted',
                        message: 'Your answer has been submitted successfully.',
                        duration: 3000
                    });
                }
            }

        } catch (error: any) {
            console.error("Submission error:", error);
            addTerminalLog('error', `Submission failed: ${error.message}`);
        } finally {
            setIsRunning(false);
        }
    };
    const cycleSortOption = () => {
        const sortOptions: Array<'default' | 'difficulty' | 'title'> = ['default', 'difficulty', 'title'];
        const currentIndex = sortOptions.indexOf(sortBy);
        const nextIndex = (currentIndex + 1) % sortOptions.length;
        setSortBy(sortOptions[nextIndex]);
    };

    const getSortIcon = () => {
        switch (sortBy) {
            case 'difficulty':
                return '🟢🟡🔴'; // Representing Easy, Medium, Hard
            case 'title':
                return 'A-Z';
            case 'default':
            default:
                return '123';
        }
    };
    // --- Helper Functions ---
    const isCopyPasteDetected = (code: string): boolean => {
        // If disableClipboard is false, allow copy-paste
        if (securitySettings.disableClipboard === false) {
            return false;
        }

        // If exercise settings explicitly allow copy-paste
        if (exercise?.compilerSettings?.allowCopyPaste) {
            return false;
        }

        const trimmedCode = code.trim()
        const initialCode = problem?.initialCode?.trim() || ""

        if (trimmedCode === initialCode) return true

        const lines = trimmedCode.split('\n')
        const initialLines = initialCode.split('\n')

        let matchingLines = 0
        lines.forEach(line => {
            if (initialLines.some(initialLine => line.trim() === initialLine.trim())) {
                matchingLines++
            }
        })

        return matchingLines / lines.length > 0.7
    }
    const resetCode = () => {
        if (problem?.initialCode) {
            const currentCode = problem.initialCode;
            setCode(currentCode);
            if (editorInstanceRef.current) {
                editorInstanceRef.current.setValue(currentCode);
            }
            addTerminalLog('system', 'Code reset to initial state');
        }
    }

    const handleEditorChange = useCallback((value: string | undefined) => {
        setCode(value || "")
    }, [])

    const handleEditorDidMount = useCallback((editor: any) => {
        editorInstanceRef.current = editor;

        // Set initial code
        if (problem?.initialCode) {
            editor.setValue(problem.initialCode);
        }

        if (exercise?.compilerSettings) {
            editor.updateOptions({
                autoClosingBrackets: exercise.compilerSettings.autoCloseBrackets ? 'always' : 'languageDefined',
                autoClosingQuotes: exercise.compilerSettings.autoCloseBrackets ? 'always' : 'languageDefined',
                suggestOnTriggerCharacters: exercise.compilerSettings.autoSuggestion,
                quickSuggestions: exercise.compilerSettings.autoSuggestion,
                fontSize: exercise.compilerSettings.fontSize || 14,
                fontFamily: FONT,
                tabSize: exercise.compilerSettings.tabSize || 2,
                theme: exercise.compilerSettings.theme === 'dark' ? 'vs-dark' : 'vs'
            });
        }

        // Apply clipboard restrictions based on security settings
        const isCopyPasteDisabled = securitySettings.disableClipboard === true;

        if (isCopyPasteDisabled) {
            // Disable copy-paste in editor
            editor.onKeyDown((e: any) => {
                if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyC' || e.code === 'KeyV' || e.code === 'KeyX')) {
                    e.preventDefault();
                    e.stopPropagation();
                    showToast({
                        type: 'error',
                        title: 'Copy/Paste Disabled',
                        message: 'Copy-paste is not allowed in assessment mode',
                        duration: 3000
                    });
                }
            });

            // Also disable right-click context menu
            editor.onContextMenu((e: any) => {
                e.preventDefault();
                e.stopPropagation();
            });
        }

        setEditorReady(true);
        editor.focus();
    }, [exercise, problem, securitySettings.disableClipboard])
    const getLanguage = (lang: string) => {
        const languageMap: { [key: string]: string } = {
            javascript: 'javascript',
            typescript: 'typescript',
            python: 'python',
            java: 'java',
            cpp: 'cpp',
            c: 'c',
            csharp: 'csharp'
        };
        return languageMap[lang] || 'javascript';
    };

    const toggleFullscreen = async () => {
        // When embedded the parent SectionBasedTestPage already fills the screen.
        // Only toggle the CSS state (position:fixed on the root div) so the editor
        // expands inside its container — never request browser-native fullscreen.
        if (embedded) {
            setIsFullscreen(prev => !prev);
            return;
        }
        if (!document.fullscreenElement) {
            try { await document.documentElement.requestFullscreen(); } catch { }
            setIsFullscreen(true);
        } else {
            try { await document.exitFullscreen(); } catch { }
            setIsFullscreen(false);
        }
    }

    const isQuestionSolved = (questionIndex: number): boolean => {
        return solvedQuestions.has(questionIndex);
    };

    const skipCurrentQuestion = async () => {
        if (!exercise?.questionBehavior?.allowSkip) {
            addTerminalLog('error', 'Skipping questions is not allowed for this exercise.');
            return;
        }

        if (currentProblemIndex < problems.length - 1) {
            try {
                if (exercise && currentQuestion) {
                    await submitProgressToBackend(
                        currentQuestion._id,
                        'skipped',
                        0
                    );
                }

                setSkippedQuestions(prev => {
                    const newSet = new Set(prev);
                    newSet.add(currentProblemIndex);
                    return newSet;
                });

                setCurrentProblemIndex(currentProblemIndex + 1);
                addTerminalLog('info', '⏭️ Question skipped. Moving to next question.');

            } catch (error) {
                addTerminalLog('error', 'Failed to skip question. Please try again.');
            }
        }
    };

    const saveCurrentQuestionProgress = async () => {
        const liveQuestion = exercise?.questions?.[currentProblemIndex];
        const liveId = liveQuestion?._id || currentQuestion?._id;
        if (!liveId) return;
        // If this question was already submitted/solved, re-send its real score so
        // the nav-save doesn't clobber the earned marks with a 0 'attempted' write.
        const prior = submittedScoresRef.current[liveId];
        if (prior != null || solvedQuestions.has(currentProblemIndex)) {
            const status = solvedQuestions.has(currentProblemIndex) ? 'solved' : 'submitted';
            try { await submitProgressToBackend(liveId, status, prior ?? 0); } catch { /* ignore nav-save errors */ }
            return;
        }
        try { await submitProgressToBackend(liveId, 'attempted', 0); } catch { /* ignore nav-save errors */ }
    };

    const nextProblem = async () => {
        if (currentProblemIndex >= problems.length - 1) {
            // Last problem: in a Combined section delegate forward to the parent.
            if (onCrossNext) { await saveCurrentQuestionProgress(); onCrossNext(); }
            return;
        }
        await saveCurrentQuestionProgress();
        const fromId = problems[currentProblemIndex]?._id || null;
        const toId = problems[currentProblemIndex + 1]?._id || null;
        if (isFreeFlow) {
            live.questionChanged(fromId, toId);
            setCurrentProblemIndex(currentProblemIndex + 1);
        } else {
            if (solvedQuestions.has(currentProblemIndex)) {
                live.questionChanged(fromId, toId);
                setCurrentProblemIndex(currentProblemIndex + 1);
            } else {
                addTerminalLog('warning', 'Submit this question before moving to the next one (Controlled Flow).');
            }
        }
    };

    const prevProblem = async () => {
        if (currentProblemIndex > 0) {
            await saveCurrentQuestionProgress();
            live.questionChanged(problems[currentProblemIndex]?._id || null, problems[currentProblemIndex - 1]?._id || null);
            setCurrentProblemIndex(currentProblemIndex - 1);
        } else if (onCrossPrev) {
            // First problem: in a Combined section delegate back to the parent (→ MCQ).
            await saveCurrentQuestionProgress();
            onCrossPrev();
        }
    };

    const selectProblem = (index: number) => {
        if (index >= 0 && index < problems.length) {
            setCurrentProblemIndex(index)
            setShowSidebar(false)
        }
    }

    // Check exercise status on mount
    useEffect(() => {
        const checkExerciseStatus = async () => {
            if (!isAssessmentMode || !courseId || !exercise?._id) return;

            try {
                const token = getToken() || '';
                const response = await fetch(`http://localhost:5533/exercise/status?courseId=${courseId}&exerciseId=${exercise._id}&category=You_Do&subcategory=${subcategory}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        const { isLocked, status } = data.data;

                        // Already submitted → bounce back to the assessment list
                        // (course detailed view). Do NOT show the terminated screen
                        // or start the security/test flow — the attempt is done.
                        if (status === 'completed') {
                            setShowSecurityAgreement(false);
                            setIsAssessmentMode(false);
                            setHasStarted(false);
                            toast.info('You have already submitted this assessment.');
                            if (onCloseExercise) onCloseExercise();
                            else if (onBack) onBack();
                            else router.back();
                            return;
                        }

                        // Genuine termination (proctor lock or auto-submit violation)
                        // → show the Access Terminated screen.
                        if (isLocked || status === 'terminated') {
                            setIsLocked(true);
                            setIsTerminated(true);
                            setHasStarted(false);
                            setTerminationReason("Access Terminated.");
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to check exercise status:", error);
            }
        };

        checkExerciseStatus();
    }, [courseId, exercise?._id, subcategory, isAssessmentMode]);

    // Format language name for display
    const formatLanguageName = (lang: string) => {
        const languageNames: { [key: string]: string } = {
            javascript: 'JavaScript',
            typescript: 'TypeScript',
            python: 'Python',
            java: 'Java',
            cpp: 'C++',
            c: 'C',
            csharp: 'C#',
            js: 'JavaScript',
            ts: 'TypeScript',
            py: 'Python',
            cs: 'C#'
        };
        return languageNames[lang] || lang.charAt(0).toUpperCase() + lang.slice(1);
    };


    const submitConfirmDialog = showSubmitConfirm ? (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}
            onClick={(e: any) => { if (e.target === e.currentTarget) setShowSubmitConfirm(false); }}
        >
            <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', maxWidth: 440, width: '90%', boxShadow: '0 20px 50px rgba(0,0,0,0.15)', fontFamily: FONT }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fef9c3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle size={18} style={{ color: '#a16207' }} />
                    </div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: 0 }}>Submit Test?</h3>
                </div>
                <p style={{ fontSize: 13, color: '#475569', marginBottom: 20, lineHeight: 1.6 }}>
                    This will finalize your submission. You won't be able to change your answers afterwards.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button
                        onClick={() => setShowSubmitConfirm(false)}
                        style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'transparent', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        No, Continue Attending
                    </button>
                    <button
                        onClick={() => { setShowSubmitConfirm(false); doSubmitTest(); }}
                        style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: '#10b981', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 3px 14px rgba(16,185,129,0.25)' }}
                    >
                        Yes, Submit Test
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    // --- Render ---
    if (isTerminated || isLocked) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-white p-4">
                <div className="bg-zinc-800 p-8 rounded border border-red-600 max-w-md text-center shadow-2xl">
                    {isSaving ? (
                        <>
                            <Loader2 className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-spin" />
                            <h2 className="text-xl font-bold mb-2">Saving Session...</h2>
                            <p className="text-gray-400">Please wait while we save your assessment data.</p>
                        </>
                    ) : (
                        <>
                            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold mb-2">Access Terminated</h2>
                            <p className="mb-4 text-red-200">{terminationReason}</p>
                            <button
                                className="bg-zinc-700 px-6 py-2 rounded hover:bg-zinc-600 font-bold w-full"
                                onClick={onBack}
                            >
                                Return to Dashboard
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div
            ref={editorRef}
            className={`${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} border-gray-300 flex flex-col border ${isFullscreen ? 'rounded-none' : 'rounded-lg relative h-full min-h-0 flex-1'}`}
            style={{ fontFamily: FONT, ...(isFullscreen ? { position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 2147483647, overflow: 'hidden' } : {}) }}
        >
            {submitConfirmDialog}
            {/* Live Screen Monitoring — standalone code editor (parent owns it in section mode).
                Only active when proctoring screen recording is ON: live monitoring shares the
                same getDisplayMedia stream, so if recording is OFF we must NOT prompt for it. */}
            <ScreenShareGuard
                assessmentId={exercise?._id ? String(exercise._id) : ""}
                active={!embedded && isAssessmentMode && hasStarted && !!securitySettings.screenRecordingEnabled}
                courseId={courseId}
                waitForSharedStream={!!(securitySettings as any)?.screenRecordingEnabled}
            />

            {/* Proctor → student messaging is now a header bell (see breadcrumb row). */}

            {/* Security Agreement Modal */}
            <SecurityAgreementModal
                isOpen={showSecurityAgreement}
                onAgree={handleSecurityAgreement}
                onCancel={() => {
                    setShowSecurityAgreement(false);

                    // Reset all assessment states
                    setIsAssessmentMode(false);
                    setHasAgreedToSecurity(false);
                    setHasStarted(false);

                    // Call the appropriate callback
                    if (onCloseExercise) {
                        onCloseExercise(); // Use the new prop specifically for closing exercise
                    } else if (onBack) {
                        onBack(); // Fallback to onBack for backward compatibility
                    }

                    // Show a toast notification
                    showToast({
                        type: 'info',
                        title: 'Assessment Cancelled',
                        message: 'Returning to exercises...',
                        duration: 3000
                    });
                }}
                // Pass the actual security settings, not hardcoded ones
                securitySettings={securitySettings}
                theme={theme}
            />

            <ExitConfirmationModal
                isOpen={showExitConfirmation}
                onConfirm={() => {
                    if (pendingExitAction) {
                        pendingExitAction();
                    }
                    setShowExitConfirmation(false);
                    setPendingExitAction(null);
                }}
                onCancel={() => {
                    setShowExitConfirmation(false);
                    setPendingExitAction(null);
                    // Force back to fullscreen — but only when the teacher
                    // actually required fullscreen mode. If they didn't, the
                    // student dismissing the Exit dialog shouldn't suddenly
                    // get yanked into fullscreen.
                    if (
                        isAssessmentMode &&
                        hasStarted &&
                        securitySettings.fullScreenMode &&
                        !document.fullscreenElement
                    ) {
                        document.documentElement.requestFullscreen().catch(() => { });
                    }
                }}
                theme={theme}
            />
            {/* Pyodide Script */}
            <Script
                src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"
                onLoad={initPyodide}
                strategy="afterInteractive"
            />

            {showCopyWarning && !exercise?.compilerSettings?.allowCopyPaste && (
                <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-lg shadow-xl max-w-sm mx-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Lock className="w-5 h-5 text-red-500" />
                            <h3 className="text-sm font-semibold text-gray-900">Copy-Paste Disabled</h3>
                        </div>
                        <p className="text-xs text-gray-600 mb-3">
                            Copy-paste is not allowed for this exercise. Please type the code yourself to learn better.
                        </p>
                        <button
                            onClick={() => setShowCopyWarning(false)}
                            className="w-full py-2 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors"
                        >
                            I Understand
                        </button>
                    </div>
                </div>
            )}


            {isAssessmentMode && !hasStarted && !showSecurityAgreement && (
                <div className="absolute inset-0 z-[60] bg-zinc-900/95 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-zinc-800 rounded-lg shadow-2xl border border-zinc-700 p-6">
                        <h2 className="text-xl font-bold text-orange-400 flex items-center gap-2 mb-4">
                            <ShieldAlert className="w-5 h-5" /> You Do Assessment Mode
                        </h2>
                        {/* Around line ~1240 */}
                        <div className="space-y-3 mb-6 text-sm text-zinc-300">
                            <p><strong>Security Features Active:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                {securitySettings.timerEnabled ? (
                                    <li>Timed Assessment ({securitySettings.timerDuration || 60} minutes)</li>
                                ) : (
                                    <li>No Time Limit</li>
                                )}
                                {securitySettings.fullScreenMode && <li>Full Screen Required</li>}
                                {securitySettings.cameraMicEnabled && <li>Camera & Microphone Monitoring</li>}
                                {securitySettings.tabSwitchAllowed === false && <li>Tab Switching Restricted (max 3 switches)</li>}
                                {securitySettings.screenRecordingEnabled && <li>Screen Recording Active</li>}
                                {securitySettings.disableClipboard && <li>Copy/Paste Disabled</li>}
                            </ul>
                        </div>
                        <button
                            onClick={startAssessment}
                            className="w-full px-4 py-3 rounded bg-orange-600 hover:bg-orange-500 text-white font-bold"
                        >
                            Start Assessment
                        </button>
                        <button
                            className="w-full mt-3 px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-white font-medium"
                            onClick={onBack}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ── Persistent Exercise Info Strip ── */}
            {exercise && (
                <div style={{ flexShrink: 0, borderBottom: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}` }}>
              

                    {/* Back confirmation dialog */}
                    {showBackConfirm && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: theme === 'dark' ? '#1f2937' : '#fff', borderRadius: 12, padding: '28px 32px', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}` }}>
                                <p style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: theme === 'dark' ? '#f9fafb' : '#111827', marginBottom: 8 }}>Leave Exercise?</p>
                                <p style={{ fontFamily: FONT, fontSize: 13, color: theme === 'dark' ? '#9ca3af' : '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
                                    Your code is saved, but unsaved progress may be lost. Where would you like to go?
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <button onClick={() => { setShowBackConfirm(false); onNavigateToBreadcrumb?.('category'); }} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 600, padding: '9px 16px', borderRadius: 8, border: 'none', background: '#fb923c', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                                        Back to {category === 'We_Do' ? 'We Do' : category === 'I_Do' ? 'I Do' : category === 'You_Do' ? 'You Do' : 'exercise list'}
                                    </button>
                                    {(hierarchy || []).length > 0 && (
                                        <button onClick={() => { setShowBackConfirm(false); onNavigateToBreadcrumb?.('hierarchy'); }} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, padding: '9px 16px', borderRadius: 8, border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`, background: 'none', color: theme === 'dark' ? '#d1d5db' : '#374151', cursor: 'pointer', textAlign: 'left' }}>
                                            Back to {(hierarchy || []).slice(-1)[0] || 'Topic'}
                                        </button>
                                    )}
                                    <button onClick={() => { setShowBackConfirm(false); onNavigateToBreadcrumb?.('course'); }} style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, padding: '9px 16px', borderRadius: 8, border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`, background: 'none', color: theme === 'dark' ? '#d1d5db' : '#374151', cursor: 'pointer', textAlign: 'left' }}>
                                        Back to {courseName || 'Course'}
                                    </button>
                                    <button onClick={() => setShowBackConfirm(false)} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, padding: '8px 16px', borderRadius: 8, border: 'none', background: 'none', color: theme === 'dark' ? '#6b7280' : '#9ca3af', cursor: 'pointer' }}>
                                        Stay in Exercise
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Breadcrumb leave-confirm dialog */}
                    {pendingNavLevel !== null && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ background: theme === 'dark' ? '#1f2937' : '#fff', borderRadius: 12, padding: '28px 32px', width: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}` }}>
                                <p style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: theme === 'dark' ? '#f9fafb' : '#111827', marginBottom: 8 }}>Leave Exercise?</p>
                                <p style={{ fontFamily: FONT, fontSize: 13, color: theme === 'dark' ? '#9ca3af' : '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
                                    Your progress may not be saved if you leave now.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {/* PRIMARY — Stay (dominant, dark) */}
                                    <button
                                        onClick={() => setPendingNavLevel(null)}
                                        style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, padding: '11px 16px', borderRadius: 8, border: 'none', background: theme === 'dark' ? '#f9fafb' : '#111827', color: theme === 'dark' ? '#111827' : '#fff', cursor: 'pointer', textAlign: 'center' }}
                                    >
                                        Stay in Exercise
                                    </button>
                                    {/* SECONDARY — Leave (outlined) */}
                                    <button
                                        onClick={() => { onNavigateToBreadcrumb?.(pendingNavLevel); setPendingNavLevel(null); }}
                                        style={{ fontFamily: FONT, fontSize: 13, fontWeight: 500, padding: '10px 16px', borderRadius: 8, border: `1px solid ${theme === 'dark' ? '#374151' : '#d1d5db'}`, background: 'none', color: theme === 'dark' ? '#9ca3af' : '#6b7280', cursor: 'pointer', textAlign: 'center' }}
                                    >
                                        Leave
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Row 2 — Difficulty dropdown + stats pills */}
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 14px',
                            background: theme === 'dark' ? '#111827' : '#ffffff',
                            gap: 10,
                            flexWrap: 'wrap',
                        }}
                    >
                        {/* Left side — Difficulty Dropdown */}


                        {/* Center — Info Buttons (MCQ-style) */}
                        <ExerciseInfoButtons
                            onDetailsClick={() => setShowDetailsModal(true)}
                            onOverviewClick={() => setShowOverviewModal(true)}
                            isGraded={exData?.isGraded !== false}
                            detailsActive={showDetailsModal}
                            overviewActive={showOverviewModal}
                        />

                        {/* Right side — Total Marks badge + MCQ-style Timer */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            {/* Total Marks badge — always visible when graded */}
                            {exData?.isGraded !== false && (() => {
                                const _ss = exData?.questionConfiguration?.programmingQuestionConfiguration?.scoreSettings;
                                const _progCalc = _ss
                                    ? _ss.scoreType === 'evenMarks' && _ss.evenMarks
                                        ? _ss.evenMarks * (problems.length || 1)
                                        : (['easy', 'medium', 'hard'] as const).reduce(
                                            (s, d) => s + ((_ss.levelScoringConfiguration as any)?.[d]?.totalMarks || 0), 0
                                        )
                                    : 0;
                                const tm =
                                    exData?.exerciseInformation?.totalMarksProgramming ||
                                    exData?.exerciseInformation?.totalMarks ||
                                    exData?.exerciseInformation?.totalPoints ||
                                    _progCalc || 0;
                                return (
                                    <span style={{
                                        fontSize: 11, fontWeight: 600,
                                        padding: '3px 10px', borderRadius: 99,
                                        background: theme === 'dark' ? '#1a3a2a' : '#dcfce7',
                                        color: theme === 'dark' ? '#86efac' : '#15803d',
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        fontFamily: FONT, whiteSpace: 'nowrap',
                                    }}>
                                        <Award style={{ width: 12, height: 12 }} />
                                        Total marks: {tm}
                                    </span>
                                );
                            })()}

                            {/* MCQ-style timer with progress bar */}
                            {exerciseTimeLeft !== null && (exData?.exerciseInformation?.totalDuration || 0) > 0 && (() => {
                                const totalSecs = (exData?.exerciseInformation?.totalDuration || 0) * 60;
                                const pct = totalSecs > 0 ? Math.max(0, (exerciseTimeLeft / totalSecs) * 100) : 0;
                                const isDanger = exerciseTimeLeft < 60;
                                const isWarning = exerciseTimeLeft < 300 && !isDanger;
                                const tcol = isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#F27757';
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {/* Timer section */}
                                        <div style={{ minWidth: 130 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                    <Clock style={{ width: 12, height: 12, color: tcol }} />
                                                    <span style={{ fontSize: 11, color: '#9b9bae', fontWeight: 600, fontFamily: FONT }}>Time Left</span>
                                                </div>
                                                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14, fontWeight: 800, color: tcol, animation: isDanger ? 'pulse 1s ease-in-out infinite' : 'none' }}>
                                                    {formatExerciseTime(exerciseTimeLeft)}
                                                </span>
                                            </div>

                                            <div style={{ height: 4, borderRadius: 99, background: theme === 'dark' ? '#374151' : '#f4f4f7', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${pct}%`, background: tcol, borderRadius: 99, transition: 'width 1s linear' }} />
                                            </div>
                                        </div>

                                        {/* Right corner of breadcrumb row — Proctor bell + Submit Test */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                                            {/* Proctor message notification (ephemeral, test-only) — standalone only; section header owns it in section mode */}
                                            {!embedded && (
                                                <TestMessageBell assessmentId={exercise?._id ? String(exercise._id) : ""} />
                                            )}
                                            {/* Whole-test submit is hidden in section mode — the parent footer owns final submission */}
                                            {!embedded && (
                                                <button
                                                    onClick={() => {
                                                        // ── Attempt limit check ──
                                                        if (exercise?.questionBehavior?.attemptLimitEnabled) {
                                                            const max = exercise.questionBehavior.maxAttempts || 1;
                                                            if (userAttempts >= max) {
                                                                showToast({
                                                                    type: 'error',
                                                                    title: 'Limit Reached',
                                                                    message: `Maximum attempts reached (${userAttempts}/${max}). You cannot submit again.`,
                                                                    duration: 4000
                                                                });
                                                                return;
                                                            }
                                                        }

                                                        // ── allQuestionsRequired gate ──
                                                        if (exercise?.questionBehavior?.allQuestionsRequired === true) {
                                                            const missing: number[] = [];
                                                            for (let i = 0; i < problems.length; i++) {
                                                                if (i !== currentProblemIndex && !solvedQuestions.has(i)) missing.push(i + 1);
                                                            }
                                                            if (missing.length > 0) {
                                                                showToast({
                                                                    type: 'error',
                                                                    title: 'Incomplete Submission',
                                                                    message: `You must attempt all questions before submitting. Questions ${missing.join(', ')} remaining.`,
                                                                    duration: 5000
                                                                });
                                                                return;
                                                            }
                                                        }

                                                        setShowSubmitConfirm(true);
                                                    }}
                                                    disabled={isRunning}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                        padding: '6px 12px',
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: isRunning ? '#6b7280' : (theme === 'dark' ? '#059669' : '#10b981'),
                                                        color: 'white',
                                                        fontSize: '13px',
                                                        fontWeight: 500,
                                                        cursor: isRunning ? 'not-allowed' : 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        opacity: isRunning ? 0.7 : 1,
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = theme === 'dark' ? '#047857' : '#059669';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = theme === 'dark' ? '#059669' : '#10b981';
                                                    }}
                                                >
                                                   
                                                    Submit Test
                                                </button>
                                            )}
                                            {onSubmitTest && (
                                                <button
                                                    onClick={onSubmitTest}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 5,
                                                        padding: '6px 12px',
                                                        borderRadius: 6,
                                                        border: 'none',
                                                        background: '#10b981',
                                                        color: 'white',
                                                        fontSize: '12px',
                                                        fontWeight: 700,
                                                        cursor: 'pointer',
                                                        fontFamily: 'inherit',
                                                        boxShadow: '0 2px 8px rgba(16,185,129,0.25)',
                                                    }}
                                                >
                                                    Submit Test
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}


            <div className={`flex items-center justify-between p-2.5 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSidebar(!showSidebar)}
                        className={`flex items-center justify-center w-7 h-7 rounded transition-colors ${theme === 'dark' ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-200 text-gray-700'}`}
                        title={showSidebar ? 'Hide problems list' : 'Show problems list'}
                    >
                        {showSidebar ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                    </button>

                    {problems.length > 1 && (
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={prevProblem}
                                disabled={currentProblemIndex === 0 && !onCrossPrev}
                                className={`px-2.5 h-7 flex items-center justify-center gap-1 border rounded text-xs font-medium transition-colors ${theme === 'dark'
                                    ? 'border-indigo-500 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 disabled:text-indigo-700'
                                    : 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:text-indigo-300'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title="Previous Problem"
                            >
                                <ChevronLeft className="w-3 h-3" /> Prev
                            </button>
                            <span className={`text-xs font-semibold min-w-[40px] text-center ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`} aria-label={`Problem ${currentProblemIndex + 1} of ${problems.length}`}>
                                {currentProblemIndex + 1}/{problems.length}
                            </span>
                            <button
                                onClick={nextProblem}
                                disabled={(currentProblemIndex === problems.length - 1 && !onCrossNext) || (!isFreeFlow && !isQuestionSolved(currentProblemIndex))}
                                className={`px-2.5 h-7 flex items-center justify-center gap-1 border rounded text-xs font-medium transition-colors ${theme === 'dark'
                                    ? 'border-orange-500 bg-orange-900/50 hover:bg-orange-800 text-orange-200 disabled:text-orange-700'
                                    : 'border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-700 disabled:text-orange-300'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={currentProblemIndex === problems.length - 1 && onCrossNext ? (crossNextLabel || 'Next Section') : 'Next Problem'}
                            >
                                {currentProblemIndex === problems.length - 1 && onCrossNext ? (crossNextLabel || 'Next Section') : 'Next'} <ChevronRight className="w-3 h-3" />
                            </button>
                            {exercise?.questionBehavior?.allowSkip && (
                                <button
                                    onClick={skipCurrentQuestion}
                                    disabled={currentProblemIndex === problems.length - 1}
                                    className={`w-7 h-7 flex items-center justify-center border rounded transition-colors ${theme === 'dark'
                                        ? 'border-amber-500 bg-amber-900/50 hover:bg-amber-800 text-amber-200'
                                        : 'border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-700'
                                        }`}
                                    title="Skip Question"
                                    aria-label="Skip current question"
                                >
                                    <SkipForward className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {availableDifficulties.length > 0 && (
                            <>
                                <span style={{
                                    fontSize: 11,
                                    color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                                    fontFamily: FONT,
                                    fontWeight: 400,
                                }}>
                                    Difficulty
                                </span>

                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <select
                                        value={selectedDifficulty}
                                        onChange={(e) => {
                                            setSelectedDifficulty(e.target.value);
                                            if (e.target.value !== 'all') jumpToDifficulty(e.target.value);
                                        }}
                                        style={{
                                            appearance: 'none',
                                            WebkitAppearance: 'none',
                                            height: 28,
                                            padding: '0 28px 0 10px',
                                            borderRadius: 99,
                                            border: `1px solid ${selectedDifficulty === 'easy' ? '#16a34a' :
                                                selectedDifficulty === 'medium' ? '#d97706' :
                                                    selectedDifficulty === 'hard' ? '#dc2626' :
                                                        (theme === 'dark' ? '#374151' : '#d1d5db')
                                                }`,
                                            background: theme === 'dark' ? '#1f2937' : '#ffffff',
                                            color: selectedDifficulty === 'easy' ? '#16a34a' :
                                                selectedDifficulty === 'medium' ? '#d97706' :
                                                    selectedDifficulty === 'hard' ? '#dc2626' :
                                                        (theme === 'dark' ? '#9ca3af' : '#6b7280'),
                                            fontFamily: FONT,
                                            fontSize: 12,
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                            outline: 'none',
                                            transition: 'border-color 0.15s, color 0.15s',
                                        }}
                                    >
                                        <option value="all" style={{ color: theme === 'dark' ? '#e5e7eb' : '#374151', fontWeight: 600 }}>All difficulties</option>
                                        {availableDifficulties.map((diff) => {
                                            const label = diff.charAt(0).toUpperCase() + diff.slice(1);
                                            const count = difficultyMap[diff].count;
                                            const optColor = diff === 'easy' ? '#16a34a' : diff === 'medium' ? '#d97706' : diff === 'hard' ? '#dc2626' : (theme === 'dark' ? '#e5e7eb' : '#374151');
                                            return (
                                                <option key={diff} value={diff} style={{ color: optColor, fontWeight: 600, background: theme === 'dark' ? '#1f2937' : '#ffffff' }}>
                                                    {label} ({count})
                                                </option>
                                            );
                                        })}
                                    </select>

                                    {/* Custom chevron */}
                                    <svg
                                        viewBox="0 0 12 12"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        style={{
                                            position: 'absolute',
                                            right: 9,
                                            pointerEvents: 'none',
                                            width: 12,
                                            height: 12,
                                            color: selectedDifficulty === 'easy' ? '#16a34a' :
                                                selectedDifficulty === 'medium' ? '#d97706' :
                                                    selectedDifficulty === 'hard' ? '#dc2626' :
                                                        (theme === 'dark' ? '#9ca3af' : '#6b7280'),
                                        }}
                                    >
                                        <path d="M2 4l4 4 4-4" />
                                    </svg>
                                </div>

                            </>
                        )}
                    </div>

                    {/* In the main render, around line ~1430 */}
                    {isAssessmentMode && hasStarted && securitySettings.screenRecordingEnabled && (
                        <div className="flex items-center gap-2">
                            {/* Camera preview - only show if camera is enabled AND we have a stream */}
                            {securitySettings.cameraMicEnabled && cameraStream && (
                                <div className="fixed bottom-4 left-4 z-40 w-48 h-36 bg-black rounded-lg border-2 border-red-500 shadow-2xl overflow-hidden">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute top-2 left-2 flex items-center gap-1">
                                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                        <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">LIVE</span>
                                    </div>
                                </div>
                            )}

                            {/* Recording indicator */}
                            {isRecording && (
                                <div className="flex items-center gap-1 px-2 py-1 bg-red-900/50 rounded text-xs">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                    Recording
                                </div>
                            )}

                            {/* Timer display */}
                            {securitySettings.timerEnabled && timeLeft !== null && (
                                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                    <Clock className="w-3 h-3" />
                                    {formatTime(timeLeft)}
                                </div>
                            )}

                            {/* Mic toggle - only show if camera/mic is enabled */}
                            {securitySettings.cameraMicEnabled && (
                                <button
                                    onClick={() => setMicEnabled(!micEnabled)}
                                    className={`p-1.5 rounded ${micEnabled ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-400'}`}
                                    title={micEnabled ? "Microphone is on" : "Microphone is muted"}
                                >
                                    {micEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2" style={{ justifyContent: 'flex-end' }}>
                    {/* {isAssessmentMode && hasStarted && tabSwitchCount > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-yellow-900/50 rounded text-xs">
                            <AlertTriangle className="w-3 h-3" />
                            Tab Switches: {tabSwitchCount}/3
                        </div>
                    )} */}



                    {/* Language Selector */}
                    {/* Language Selector */}
                    <select
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        className={`h-7 text-xs border rounded px-1.5 ${theme === 'dark' ? 'bg-gray-800 text-white border-gray-600' : 'bg-white text-gray-900 border-gray-300'}`}
                        disabled={isAssessmentMode && hasStarted}
                    >
                        {availableLanguages.map((lang) => (
                            <option key={lang} value={lang}>
                                {formatLanguageName(lang)}
                                {lang === selectedLanguage ? " (Selected)" : ""}
                            </option>
                        ))}
                    </select>


                    {/* ── Prev / Submit / Next ── */}
                    {/* {problems.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`, paddingLeft: 8 }}>
                            {currentProblemIndex > 0 ? (
                                <button onClick={prevProblem} style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28, padding: '0 10px', fontSize: 12, fontFamily: FONT, fontWeight: 500, borderRadius: 6, border: `1px solid ${theme === 'dark' ? '#374151' : '#d1d5db'}`, background: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#d1d5db' : '#374151', cursor: 'pointer' }}>
                                    <ChevronLeft style={{ width: 13, height: 13 }} />Prev
                                </button>
                            ) : (
                                <div style={{ width: 64 }} /> 
                            )}

                            <button
                                onClick={submitCode}
                                disabled={isRunning || (exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1))}
                                style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28, padding: '0 14px', fontSize: 12, fontFamily: FONT, fontWeight: 600, borderRadius: 6, border: 'none', background: (exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1)) ? '#9ca3af' : '#22c55e', color: '#fff', cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.7 : 1 }}
                            >
                                {isRunning ? <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" /> : <CheckCircle style={{ width: 12, height: 12 }} />}
                                {(exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1)) ? 'Limit' : 'Submit'}
                            </button>

                            {currentProblemIndex < problems.length - 1 && (isFreeFlow || solvedQuestions.has(currentProblemIndex)) ? (
                                <button onClick={nextProblem} style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28, padding: '0 10px', fontSize: 12, fontFamily: FONT, fontWeight: 500, borderRadius: 6, border: `1px solid ${theme === 'dark' ? '#374151' : '#d1d5db'}`, background: theme === 'dark' ? '#1f2937' : '#fff', color: theme === 'dark' ? '#d1d5db' : '#374151', cursor: 'pointer' }}>
                                    Next<ChevronRight style={{ width: 13, height: 13 }} />
                                </button>
                            ) : (
                                <div style={{ width: 64 }} /> 
                        </div>
                    )} */}

{/* ── Compile & Run · Submit Code ── */}
<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <button
        onClick={compileAndRun}
        disabled={isRunning}
        title="Run the sample (visible) test cases only"
        style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: 6,
            height: 32, 
            padding: '0 16px',
            fontSize: 12, 
            fontFamily: FONT, 
            fontWeight: 500,
            borderRadius: 6,
            border: 'none',
            background: isRunning ? '#94a3b8' : '#f97316',
            color: '#ffffff',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            opacity: isRunning ? 0.6 : 1,
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
        onMouseEnter={(e) => {
            if (!isRunning) {
                e.currentTarget.style.background = '#ea580c';
            }
        }}
        onMouseLeave={(e) => {
            if (!isRunning) {
                e.currentTarget.style.background = '#f97316';
            }
        }}
    >
        {isRunning ? (
            <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
        ) : (
            <Play style={{ width: 13, height: 13, fill: 'currentColor' }} />
        )}
        Compile &amp; Run
    </button>

    <button
        onClick={handleSubmitCode}
        disabled={isRunning || (exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1))}
        title="Run all test cases (including hidden) and submit"
        style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: 6,
            height: 32, 
            padding: '0 16px',
            fontSize: 12, 
            fontFamily: FONT, 
            fontWeight: 500,
            borderRadius: 6,
            border: 'none',
            background: (exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1))
                ? '#94a3b8'
                : isRunning
                ? '#94a3b8'
                : '#059669',
            color: '#ffffff',
            cursor: (isRunning || (exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1))) 
                ? 'not-allowed' 
                : 'pointer',
            opacity: (isRunning || (exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1))) 
                ? 0.6 
                : 1,
            transition: 'all 0.15s ease',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
        }}
        onMouseEnter={(e) => {
            if (!isRunning && !(exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1))) {
                e.currentTarget.style.background = '#047857';
            }
        }}
        onMouseLeave={(e) => {
            if (!isRunning && !(exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1))) {
                e.currentTarget.style.background = '#059669';
            }
        }}
    >
        {isRunning ? (
            <Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />
        ) : (
            <Send style={{ width: 13, height: 13 }} />
        )}
        {(exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1)) 
            ? 'Limit Reached' 
            : 'Submit Code'}
    </button>
</div>
                    <div style={{ width: 1, height: 18, background: theme === 'dark' ? '#374151' : '#e5e7eb' }} />

                    {/* <button
                        onClick={runCode}
                        disabled={isRunning}
                        className="h-7 px-2 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
                        style={{ fontFamily: FONT }}
                    >
                        {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Run
                    </button> */}

                    <button
                        onClick={toggleFullscreen}
                        className={`w-7 h-7 flex items-center justify-center border rounded ${theme === 'dark' ? 'border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300' : 'border-gray-300 bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                    >
                        {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                {showSidebar && (
                    <div className={`w-80 border-r overflow-hidden flex flex-col ${theme === 'dark' ? 'border-gray-700 bg-gray-900' : 'border-gray-300 bg-white'}`}>
                        <div className={`p-3 border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                                    Problems ({getFilteredAndSortedProblems().length}/{problems.length})
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setShowSearch(!showSearch)}
                                        className={`p-1 ml-1 rounded transition-colors ${showSearch ? (theme === 'dark' ? 'bg-orange-700' : 'bg-orange-500') : (theme === 'dark' ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600')}`}
                                    >
                                        {showSearch ? <XIcon className="w-3.5 h-3.5 text-white" /> : <Search className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>

                            {showSearch && (
                                <div className="relative mb-3">
                                    <Search className={`absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`} />
                                    <input
                                        type="text"
                                        placeholder="Search problems..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className={`w-full pl-8 pr-6 py-1.5 text-xs border rounded focus:ring-1 focus:ring-orange-500 focus:outline-none ${theme === 'dark' ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-400' : 'border-gray-300 bg-gray-50 text-gray-900 placeholder-gray-500'}`}
                                        autoFocus
                                    />
                                    {searchQuery && (
                                        <button onClick={() => setSearchQuery("")} className="absolute right-1 top-1/2 transform -translate-y-1/2">
                                            <XIcon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-400'}`} />
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Filter and Sort Controls */}
                            <div className="flex items-center justify-between gap-3">
                                {/* Difficulty Filter Dropdown */}
                                <div className="flex-1">
                                    <select
                                        value={filterDifficulty}
                                        onChange={(e) => setFilterDifficulty(e.target.value as any)}
                                        className={`w-full text-xs border rounded px-2 py-1.5 ${theme === 'dark' ? 'bg-gray-800 border-gray-600 text-gray-300' : 'bg-white border-gray-300 text-gray-900'}`}
                                    >
                                        <option value="all">All Difficulties</option>
                                        <option value="Easy">Easy</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Hard">Hard</option>
                                    </select>
                                </div>

                                {/* Sort Icon Button */}
                                <button
                                    onClick={cycleSortOption}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded transition-colors ${theme === 'dark' ? 'border-gray-600 hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-100'}`}
                                    title={`Sort by: ${sortBy === 'default' ? 'Default Order' : sortBy === 'difficulty' ? 'Difficulty' : 'Title'}. Click to change.`}
                                >
                                    <ArrowUpDown className={`w-3.5 h-3.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`} />
                                    <span className={`font-medium ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                        {sortBy === 'default' ? 'Default' : sortBy === 'difficulty' ? 'Difficulty' : 'Title'}
                                    </span>
                                </button>
                            </div>

                            {/* Sort Indicator */}
                            <div className={`mt-2 text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} flex items-center justify-between`}>
                                <span>
                                    {filterDifficulty !== 'all' && `Filtered: ${filterDifficulty}`}
                                    {filterDifficulty === 'all' && 'Showing all difficulties'}
                                </span>
                                <span className="flex items-center gap-1">
                                    <span>Sort:</span>
                                    <span className={`px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}`}>
                                        {getSortIcon()}
                                    </span>
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {getFilteredAndSortedProblems().length === 0 ? (
                                <div className="p-4 text-center">
                                    <div className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                        No problems found
                                        {filterDifficulty !== 'all' && ` for "${filterDifficulty}" difficulty`}
                                        {searchQuery && ` matching "${searchQuery}"`}
                                    </div>
                                </div>
                            ) : (
                                getFilteredAndSortedProblems().map((p, index) => {
                                    const originalIndex = problems.findIndex(prob => prob.id === p.id);
                                    return (
                                        <button
                                            key={p.id}
                                            onClick={() => selectProblem(originalIndex)}
                                            className={`w-full p-3 text-left transition-colors border-b ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'} ${currentProblemIndex === originalIndex
                                                ? (theme === 'dark' ? 'bg-orange-900/20 border-l-2 border-l-orange-500' : 'bg-orange-50 border-l-2 border-l-orange-500')
                                                : (theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-50')}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                {/* Left: number + title */}
                                                <div className={`text-sm font-medium truncate flex-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                                                    {originalIndex + 1}. {p.title}
                                                </div>
                                                {/* Right: badges */}
                                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                                    {/* Difficulty */}
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${p.difficulty === 'Easy' ? (theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-800') : p.difficulty === 'Medium' ? (theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-800') : (theme === 'dark' ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-800')}`}>
                                                        {p.difficulty}
                                                    </span>
                                                    {/* Marks badge — hidden for non-graded */}
                                                    {exercise?.isGraded !== false && (() => {
                                                        const qMarks = exercise?.questions?.[originalIndex]?.score ?? exercise?.questions?.[originalIndex]?.points ?? null;
                                                        if (qMarks == null) return null;
                                                        return (
                                                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: theme === 'dark' ? '#1a3a2a' : '#dcfce7', color: theme === 'dark' ? '#86efac' : '#15803d', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                {qMarks} {qMarks === 1 ? 'mark' : 'marks'}
                                                            </span>
                                                        );
                                                    })()}
                                                    {/* Submitted badge — only after submission */}
                                                    {solvedQuestions.has(originalIndex) && (
                                                        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: theme === 'dark' ? '#14532d' : '#dcfce7', color: theme === 'dark' ? '#4ade80' : '#166534', fontWeight: 600, border: `1px solid ${theme === 'dark' ? '#166534' : '#86efac'}`, whiteSpace: 'nowrap' }}>
                                                            Submitted
                                                        </span>
                                                    )}
                                                    {/* Skipped badge */}
                                                    {skippedQuestions.has(originalIndex) && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600'}`}>
                                                            Skipped
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
                {/* ── Link questions: the external page IS the question — one
                    iframe replaces the question panel + compiler. Submits go
                    straight to submitProgressToBackend (no test-case run —
                    there are no test cases on a link question). ─────────── */}
                {(() => {
                    const liveQ: any = exercise?.questions?.[currentProblemIndex] ?? currentQuestion;
                    const isLinkQ = !!(liveQ?.isLinkQuestion && liveQ?.questionLink);
                    if (!isLinkQ) return null;
                    const linkUrl: string = liveQ.questionLink;
                    const attemptsMaxed = !!(exercise?.questionBehavior?.attemptLimitEnabled && userAttempts >= (exercise?.questionBehavior?.maxAttempts || 1));
                    const alreadySubmitted = solvedQuestions.has(currentProblemIndex);
                    return (
                        <div className="flex-1 h-full flex flex-col min-w-0">
                            <div className={`flex items-center gap-2 px-4 py-2 border-b flex-shrink-0 ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
                                <span style={{
                                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                                    background: theme === 'dark' ? '#7C2D12' : '#FFEDD5',
                                    color: theme === 'dark' ? '#FED7AA' : '#EA580C',
                                    fontFamily: FONT, whiteSpace: 'nowrap',
                                }}>
                                    Q {currentProblemIndex + 1} / {problems.length}
                                </span>
                                <span className={`text-[12.5px] font-semibold truncate ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`} style={{ fontFamily: FONT }} title={linkUrl}>
                                    {liveQ.title && liveQ.title !== linkUrl ? liveQ.title : 'Linked question'}
                                </span>
                                <div className="flex-1" />
                                <button
                                    onClick={() => window.open(linkUrl, '_blank', 'noopener,noreferrer')}
                                    className={`flex items-center gap-1.5 px-3 h-[30px] rounded-md text-[12px] font-semibold border transition-colors ${theme === 'dark' ? 'border-gray-600 text-gray-200 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
                                    style={{ fontFamily: FONT }}
                                    title="Open the problem site in a new browser tab"
                                >
                                    Open in new tab ↗
                                </button>
                                <button
                                    onClick={async () => {
                                        if (attemptsMaxed) {
                                            showToast({ type: 'error', title: 'Limit Reached', message: `Maximum attempts reached (${userAttempts}/${exercise?.questionBehavior?.maxAttempts || 1}).`, duration: 4000 });
                                            return;
                                        }
                                        try {
                                            await submitProgressToBackend(
                                                liveQ._id || currentQuestion?._id,
                                                'submitted', 0, false, null,
                                                `[Link question] Solved on external site: ${linkUrl}`,
                                            );
                                            setSolvedQuestions(prev => { const s = new Set(prev); s.add(currentProblemIndex); return s; });
                                            showToast({ type: 'success', title: 'Question Submitted', message: `Question ${currentProblemIndex + 1} submitted successfully.`, duration: 3000 });
                                            if (isFreeFlow && currentProblemIndex < problems.length - 1) {
                                                setTimeout(() => setCurrentProblemIndex(currentProblemIndex + 1), 1500);
                                            }
                                        } catch (error: any) {
                                            showToast({ type: 'error', title: 'Submission Failed', message: error.message || 'Could not submit question.', duration: 4000 });
                                        }
                                    }}
                                    disabled={attemptsMaxed}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 18px',
                                        fontSize: 12, fontFamily: FONT, fontWeight: 600, borderRadius: 6, border: 'none',
                                        background: attemptsMaxed ? '#9ca3af' : '#22c55e', color: '#fff',
                                        cursor: attemptsMaxed ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    <CheckCircle style={{ width: 13, height: 13 }} />
                                    {attemptsMaxed ? 'Limit Reached' : alreadySubmitted ? 'Submitted ✓' : 'Submit Question'}
                                </button>
                            </div>
                            {/* No iframe — link questions always open on the
                                external site (most judges refuse embedding
                                anyway); the card is the whole workspace. */}
                            <div className={`flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center ${theme === 'dark' ? 'bg-gray-950' : 'bg-gray-50'}`}>
                                <div className={`text-[15px] font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`} style={{ fontFamily: FONT }}>
                                    This question opens on {hostOf(linkUrl)}
                                </div>
                                <p className={`text-[12px] max-w-md ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ fontFamily: FONT }}>
                                    Open the problem in a new tab, solve it there, then come back and press
                                    <b> Submit Question</b>.
                                </p>
                                <button
                                    onClick={() => window.open(linkUrl, '_blank', 'noopener,noreferrer')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 22px',
                                        fontSize: 13, fontFamily: FONT, fontWeight: 700, borderRadius: 8, border: 'none',
                                        background: '#FB923C', color: '#fff', cursor: 'pointer',
                                    }}
                                >
                                    Open the problem ↗
                                </button>
                                <span className={`text-[11px] break-all max-w-md ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`} style={{ fontFamily: FONT }}>{linkUrl}</span>
                            </div>
                        </div>
                    );
                })()}
                {(() => { const lq: any = exercise?.questions?.[currentProblemIndex] ?? currentQuestion; return !(lq?.isLinkQuestion && lq?.questionLink); })() && (<>
                <div style={{ width: `${leftPanelWidth}%` }} className="h-full flex flex-col border-r border-gray-300 dark:border-gray-700 overflow-hidden">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className={`p-5 space-y-6 ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`}>
                            <div>
                                <h1 style={{ fontFamily: FONT }} className={`text-xl font-semibold mb-1.5 ${theme === 'dark' ? 'text-white' : 'text-gray-700'}`}>
                                    {currentProblemIndex + 1}. {problem?.title || "Problem"}
                                </h1>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Difficulty badge */}
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${problem?.difficulty === "Easy" ? (theme === 'dark' ? 'bg-green-900/30 text-green-300' : 'bg-green-100 text-green-800') : problem?.difficulty === "Medium" ? (theme === 'dark' ? 'bg-yellow-900/30 text-yellow-300' : 'bg-yellow-100 text-yellow-800') : (theme === 'dark' ? 'bg-red-900/30 text-red-300' : 'bg-red-100 text-red-800')}`}>
                                        {problem?.difficulty || "Easy"}
                                    </span>
                                    {/* Marks badge — hidden for non-graded */}
                                    {exercise?.isGraded !== false && (() => {
                                        const currentQ = currentQuestion ?? exercise?.questions?.[currentProblemIndex];
                                        const ss = exercise?.questionConfiguration?.programmingQuestionConfiguration?.scoreSettings;
                                        const diff = (currentQ?.difficulty || '').toLowerCase() as 'easy' | 'medium' | 'hard';
                                        let m: number | null = null;
                                        if (ss?.scoreType === 'evenMarks') m = ss.evenMarks ?? null;
                                        else if (ss?.scoreType === 'levelBasedMarks' && ss.levelBasedMarks === 'level_specific') {
                                            const lc = ss.levelScoringConfiguration?.[diff];
                                            m = lc?.marksPerQuestion ?? lc?.totalMarks ?? null;
                                        } else {
                                            m = Number(currentQ?.score) || Number(currentQ?.points) || null;
                                        }
                                        if (m == null) return null;
                                        return (
                                            <span style={{ fontSize: 11, fontFamily: FONT, fontWeight: 600, padding: '2px 9px', borderRadius: 99, background: theme === 'dark' ? '#1a3a2a' : '#dcfce7', color: theme === 'dark' ? '#86efac' : '#15803d', whiteSpace: 'nowrap' }}>
                                                {m} {m === 1 ? 'mark' : 'marks'}
                                            </span>
                                        );
                                    })()}
                                    {/* Attempts badge */}
                                    {exercise?.questionBehavior?.attemptLimitEnabled && (
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ${userAttempts >= (exercise.questionBehavior.maxAttempts || 1) ? (theme === 'dark' ? 'bg-red-900/30 text-red-300 border-red-800' : 'bg-red-100 text-red-800 border-red-200') : (theme === 'dark' ? 'bg-orange-900/30 text-orange-300 border-orange-800' : 'bg-orange-100 text-orange-800 border-orange-200')}`}>
                                            {userAttempts >= (exercise.questionBehavior.maxAttempts || 1) && <AlertTriangle className="w-3 h-3" />}
                                            Attempts: {userAttempts} / {exercise.questionBehavior.maxAttempts}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <FileText className={`w-4 h-4 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-500'}`} />
                                    <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Description</h3>
                                </div>
                                <div
                                    className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}
                                    style={{ lineHeight: '1.8' }}
                                    dangerouslySetInnerHTML={{ __html: renderDescriptionWithClickableImages(problem?.description || '') }}
                                />
                            </div>

                            {problem?.examples && problem.examples.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <Terminal className={`w-4 h-4 ${theme === 'dark' ? 'text-green-400' : 'text-green-500'}`} />
                                        <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Sample Input & Output</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {problem.examples.map((example, index) => (
                                            <div key={index}>
                                                <strong className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Example {index + 1}</strong>
                                                <div className="mt-1 mb-2">
                                                    <div className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>Input:</div>
                                                    <div className={`p-2 rounded font-mono text-xs ${theme === 'dark' ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-gray-100 text-gray-900 border border-gray-200'}`}>{example.input}</div>
                                                </div>
                                                <div className="mb-2">
                                                    <div className={`text-xs font-medium mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-700'}`}>Output:</div>
                                                    <div className={`p-2 rounded font-mono text-xs ${theme === 'dark' ? 'bg-gray-800 text-gray-300 border border-gray-700' : 'bg-gray-100 text-gray-900 border border-gray-200'}`}>{example.output}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {currentQuestion?.constraints && currentQuestion.constraints.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <AlertCircle className={`w-4 h-4 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-500'}`} />
                                        <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Constraints</h3>
                                    </div>
                                    <ul className={`space-y-1 text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {currentQuestion.constraints.map((c, i) => (
                                            <li key={i} className={`px-2 py-1 rounded font-mono ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                                                {c}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {currentQuestion?.hints && currentQuestion.hints.filter(h => h.isPublic).length > 0 && (
                                <div>
                                    <div className="flex items-center gap-1.5 mb-2">
                                        <AlertCircle className={`w-4 h-4 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-500'}`} />
                                        <h3 className={`text-sm font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Hints</h3>
                                    </div>
                                    {currentQuestion.hints.filter(h => h.isPublic).map((hint, i) => (
                                        <div key={i} className={`text-xs px-3 py-2 rounded mb-1 ${theme === 'dark' ? 'bg-orange-900/20 text-orange-300 border border-orange-800' : 'bg-orange-50 text-orange-800 border border-orange-100'}`}>
                                            💡 {hint.hintText}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {!showSidebar && (
                    <div
                        className="absolute top-0 bottom-0 z-10 hover:cursor-col-resize"
                        style={{ left: `calc(${leftPanelWidth}% - 2px)`, width: '4px' }}
                        onMouseDown={(e) => { setIsResizing(true); e.preventDefault(); }}
                    >
                        <div className={`h-full w-full ${theme === 'dark' ? 'bg-gray-700 hover:bg-orange-500' : 'bg-gray-300 hover:bg-orange-500'} transition-colors`}></div>
                    </div>
                )}

                <div className="flex flex-col flex-1 min-w-0 h-full" style={{ width: `${100 - leftPanelWidth}%` }}>

                    {/* ── Editor (top, resizable) ── */}
                    <div className="flex flex-col" style={{ height: `${rightPanelSplit}%`, minHeight: 0 }}>
                        <div className={`flex items-center justify-between p-2 border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'}`}>
                            <div className="flex items-center gap-1.5">
                                <Code className={`w-4 h-4 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-500'}`} />
                                <span className={`text-xs font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>Code</span>
                                <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-600'}`}>({formatLanguageName(selectedLanguage)})</span>
                            </div>
                            <button onClick={resetCode} className={`flex items-center gap-1 px-2 py-0.5 text-xs border rounded transition-colors ${theme === 'dark' ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600' : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                                <RotateCcw className="w-3.5 h-3.5" /> Reset
                            </button>
                        </div>
                        <div className="flex-1 min-h-0">
                            <MonacoEditor
                                key={`editor-${currentProblemIndex}-${selectedLanguage}`}
                                height="100%"
                                language={getLanguage(selectedLanguage)}
                                value={code}
                                onChange={handleEditorChange}
                                onMount={handleEditorDidMount}
                                theme={theme === 'dark' ? 'vs-dark' : 'vs'}
                                options={{
                                    minimap: { enabled: true },
                                    fontSize: 14,
                                    fontFamily: FONT,
                                    readOnly: isAssessmentMode && !hasStarted
                                }}
                            />
                        </div>
                    </div>

                    {/* ── Drag handle ── */}
                    <div
                        className={`h-2 flex items-center justify-center cursor-row-resize flex-shrink-0 transition-colors ${theme === 'dark' ? 'hover:bg-orange-900/40 bg-gray-800' : 'hover:bg-orange-100 bg-gray-100'}`}
                        onMouseDown={(e) => { setIsHorizontalResizing(true); e.preventDefault(); }}
                    >
                        <div className={`w-12 h-1 rounded-full ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'}`} />
                    </div>

                    {/* ── Console / Output (bottom, resizable) ── */}
                    <div className="flex flex-col flex-1 min-h-0" style={{ height: `${100 - rightPanelSplit}%` }}>
                        {/* Tab bar */}
                        <div className={`flex items-center justify-between gap-0 border-b flex-shrink-0 ${theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'}`}>
                            {/* Left side - Tabs */}
                            <div className="flex items-center gap-0">
                                <button
                                    onClick={() => setBottomTab('results')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 transition-colors ${bottomTab === 'results' ? `border-orange-500 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}` : `border-transparent ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}`}
                                >
                                    <ListChecks className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">Test Results</span>
                                    {testResults.length > 0 && (
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>{testResults.length}</span>
                                    )}
                                </button>
                                <button
                                    onClick={() => setBottomTab('console')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 transition-colors ${bottomTab === 'console' ? `border-orange-500 ${theme === 'dark' ? 'text-orange-400' : 'text-orange-600'}` : `border-transparent ${theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'}`}`}
                                >
                                    <Terminal className="w-3.5 h-3.5" />
                                    <span className="text-xs font-medium">Console</span>
                                    {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
                                </button>
                            </div>

                            {/* Right side - Buttons */}
                            <div className="flex items-center gap-2 mr-2">
                                {/* Submit moved to the header toolbar as "Submit Code" */}

                                {/* Clear button */}
                                <button
                                    onClick={clearTerminal}
                                    className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${theme === 'dark' ? 'text-gray-500 hover:text-gray-300 hover:bg-gray-700' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}
                                    title="Clear console"
                                >
                                    <Trash2 className="w-3 h-3" /> Clear
                                </button>
                            </div>
                        </div>

                        {/* ── Test Results table ── */}
                        {bottomTab === 'results' && (
                            <div className={`flex-1 overflow-auto ${theme === 'dark' ? 'bg-gray-950' : 'bg-white'}`} style={{ fontFamily: FONT }}>
                                {testResults.length === 0 ? (
                                    <div className={`flex items-center justify-center h-full text-xs italic ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
                                        {isRunning ? 'Running test cases…' : 'Click "Compile & Run" or "Submit Code" to see test results here.'}
                                    </div>
                                ) : (
                                    <div className="p-3">
                                        {/* Summary strip */}
                                        {(() => {
                                            const passed = testResults.filter(r => r.status === 'passed').length;
                                            const failed = testResults.filter(r => r.status === 'failed').length;
                                            const skipped = testResults.filter(r => r.status === 'skipped').length;
                                            const chip = (label: string, value: number, bg: string, color: string) => (
                                                <div className="flex items-center gap-1.5 px-3 py-1 rounded-md" style={{ background: bg }}>
                                                    <span className="text-[11px] font-semibold" style={{ color }}>{label}</span>
                                                    <span className="text-[11px] font-bold" style={{ color }}>{value}</span>
                                                </div>
                                            );
                                            return (
                                                <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                    {chip('Total', testResults.length, theme === 'dark' ? '#1f2937' : '#f3f4f6', theme === 'dark' ? '#d1d5db' : '#374151')}
                                                    {chip('Passed', passed, 'rgba(22,163,74,0.12)', '#16a34a')}
                                                    {chip('Failed', failed, 'rgba(239,68,68,0.12)', '#ef4444')}
                                                    {chip('Skipped', skipped, theme === 'dark' ? '#1f2937' : '#f3f4f6', theme === 'dark' ? '#9ca3af' : '#6b7280')}
                                                </div>
                                            );
                                        })()}
                                        {/* Table */}
                                        <div className={`rounded-lg border overflow-x-auto ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr className={theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}>
                                                        {['Test Case', 'Input', 'Expected Output', 'Your Output', 'Status', 'Time'].map(h => (
                                                            <th key={h} className={`px-3 py-2 text-[11px] font-bold uppercase tracking-wide ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ whiteSpace: 'nowrap' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {testResults.map((r, i) => (
                                                        <tr key={i} className={`border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-100'}`}>
                                                            <td className={`px-3 py-2 text-xs font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-800'}`} style={{ whiteSpace: 'nowrap' }}>
                                                                Test Case {r.caseNo}
                                                                {r.isHidden && <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>Hidden</span>}
                                                            </td>
                                                            <td className={`px-3 py-2 text-xs font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} style={{ maxWidth: 160, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.input || '—'}</td>
                                                            <td className={`px-3 py-2 text-xs font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`} style={{ maxWidth: 160, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{r.expected || '—'}</td>
                                                            <td className="px-3 py-2 text-xs font-mono" style={{ maxWidth: 160, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: r.status === 'passed' ? (theme === 'dark' ? '#86efac' : '#16a34a') : '#ef4444' }}>{r.actual || '—'}</td>
                                                            <td className="px-3 py-2 text-xs" style={{ whiteSpace: 'nowrap' }}>
                                                                {r.status === 'passed' ? (
                                                                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#16a34a' }}><CheckCircle className="w-3.5 h-3.5" />Passed</span>
                                                                ) : r.status === 'failed' ? (
                                                                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#ef4444' }}><XCircle className="w-3.5 h-3.5" />Failed</span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#9ca3af' }}>Skipped</span>
                                                                )}
                                                            </td>
                                                            <td className={`px-3 py-2 text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`} style={{ whiteSpace: 'nowrap' }}>{r.time}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Log output area */}
                        {bottomTab === 'console' && (
                            <div
                                className={`flex-1 overflow-y-auto p-3 font-mono text-xs custom-scrollbar ${theme === 'dark' ? 'bg-gray-950 text-slate-300' : 'bg-white text-gray-800'}`}
                            >
                                {terminalLogs.length === 0 && !isRunning && (
                                    <span className={`italic ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
                                        Run code to see output here...
                                    </span>
                                )}

                                {terminalLogs.map((log) => (
                                    <div key={log.id} className="whitespace-pre-wrap leading-relaxed break-all mb-0.5">
                                        {log.type === 'stdout' && <span className={theme === 'dark' ? 'text-slate-300' : 'text-gray-800'}>{log.content}</span>}
                                        {log.type === 'stderr' && <span className="text-red-500">{log.content}</span>}
                                        {log.type === 'error' && <span className="text-red-500">{log.content}</span>}
                                        {log.type === 'system' && <span className={theme === 'dark' ? 'text-emerald-400 italic' : 'text-green-600 italic'}>➜ {log.content}</span>}
                                        {log.type === 'success' && <span className="text-green-500">{log.content}</span>}
                                        {log.type === 'info' && <span className="text-blue-500">{log.content}</span>}
                                        {log.type === 'warning' && <span className="text-yellow-500">{log.content}</span>}
                                        {log.type === 'stdin' && <span className={theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}>$ {log.content}</span>}
                                    </div>
                                ))}

                                {isRunning && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />
                                        <span className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>Executing...</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>
                </>)}{/* end non-link question+editor split */}
                {/* ── Exercise Info Right Panel ── */}
                {/* {showExerciseInfo && exercise && (
                    <div style={{
                        width: 320,
                        borderLeft: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
                        background: theme === 'dark' ? '#0f172a' : '#fefce8',
                        display: 'flex', flexDirection: 'column',
                        overflow: 'hidden', flexShrink: 0,
                    }}>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '14px 20px',
                            borderBottom: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
                            flexShrink: 0,
                            background: theme === 'dark' ? '#1e293b' : '#ffffff',
                        }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>
                                📋 Exercise Information
                            </span>
                            <button
                                onClick={() => setShowExerciseInfo(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: theme === 'dark' ? '#94a3b8' : '#64748b',
                                    padding: 4,
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <X style={{ width: 16, height: 16 }} />
                            </button>
                        </div>

                        <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: 0 }}>

                            <div style={{ padding: '20px', background: theme === 'dark' ? '#1e293b' : '#f8fafc', borderBottom: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                    <span style={{ fontSize: 16 }}>📖</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: theme === 'dark' ? '#94a3b8' : '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Exercise Overview</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <InfoRow label="Name" value={exercise.exerciseInformation?.exerciseName} theme={theme} />
                                    <InfoRow label="Level" value={exercise.exerciseInformation?.exerciseLevel ? exercise.exerciseInformation.exerciseLevel.charAt(0).toUpperCase() + exercise.exerciseInformation.exerciseLevel.slice(1) : undefined} theme={theme} />
                                    {exercise.exerciseInformation?.totalDuration != null && (
                                        <InfoRow label="Duration" value={`${exercise.exerciseInformation.totalDuration} min`} theme={theme} />
                                    )}
                                    {(() => {
                                        const tm = exercise.exerciseInformation?.totalMarksProgramming ?? exercise.exerciseInformation?.totalMarks ?? exercise.exerciseInformation?.totalPoints;
                                        return tm != null ? <InfoRow label="Total Marks" value={`${tm}`} theme={theme} /> : null;
                                    })()}
                                    <InfoRow label="Questions" value={`${exercise.questions?.length ?? 0}`} theme={theme} />
                                    {exercise.programmingSettings?.selectedLanguages?.length > 0 && (
                                        <InfoRow label="Languages" value={exercise.programmingSettings.selectedLanguages.map((l: string) => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')} theme={theme} />
                                    )}
                                    {exercise.availabilityPeriod?.startDate && (
                                        <InfoRow label="From" value={new Date(exercise.availabilityPeriod.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} theme={theme} />
                                    )}
                                    {exercise.availabilityPeriod?.endDate && (
                                        <InfoRow label="Until" value={new Date(exercise.availabilityPeriod.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} theme={theme} />
                                    )}
                                </div>
                            </div>

                            {(() => {
                                const qConfig = exercise.questionConfiguration?.programmingQuestionConfiguration;
                                const configType = qConfig?.questionConfigType ?? 'general';
                                const ss = qConfig?.scoreSettings;
                                const isLevelBased = configType === 'levelBased' || configType === 'selectionLevel';

                                return (
                                    <div style={{ padding: '20px', background: theme === 'dark' ? '#0f172a' : '#ffffff', borderBottom: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                            <span style={{ fontSize: 16 }}>🗂️</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: theme === 'dark' ? '#94a3b8' : '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Questions Quota</span>
                                        </div>

                                        {!isLevelBased ? (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '10px 14px', borderRadius: 8,
                                                background: theme === 'dark' ? '#1e293b' : '#f1f5f9',
                                                border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
                                            }}>
                                                <span style={{ fontSize: 12, color: theme === 'dark' ? '#94a3b8' : '#64748b', fontWeight: 500 }}>Total Questions</span>
                                                <span style={{ fontSize: 18, fontWeight: 700, color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>
                                                    {exercise.questions?.length ?? 0}
                                                </span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                {(['easy', 'medium', 'hard'] as const).map(diff => {
                                                    const entry = difficultyMap[diff];
                                                    if (!entry) return null;
                                                    const lsc = ss?.levelScoringConfiguration?.[diff];
                                                    const marksPerQ = lsc?.marksPerQuestion ?? ss?.evenMarks ?? null;
                                                    const totalForDiff = lsc?.totalMarks ?? (marksPerQ != null ? marksPerQ * entry.count : null);

                                                    const colors = {
                                                        easy: { bg: theme === 'dark' ? '#052e16' : '#f0fdf4', border: theme === 'dark' ? '#166534' : '#bbf7d0', label: theme === 'dark' ? '#4ade80' : '#15803d', dot: '#16a34a' },
                                                        medium: { bg: theme === 'dark' ? '#1c1300' : '#fffbeb', border: theme === 'dark' ? '#78350f' : '#fde68a', label: theme === 'dark' ? '#fbbf24' : '#92400e', dot: '#d97706' },
                                                        hard: { bg: theme === 'dark' ? '#1f0a0a' : '#fff1f2', border: theme === 'dark' ? '#7f1d1d' : '#fecaca', label: theme === 'dark' ? '#f87171' : '#991b1b', dot: '#dc2626' },
                                                    }[diff];

                                                    return (
                                                        <div key={diff} style={{
                                                            display: 'flex', alignItems: 'center',
                                                            padding: '10px 14px', borderRadius: 8,
                                                            background: colors.bg,
                                                            border: `1px solid ${colors.border}`,
                                                            gap: 10,
                                                        }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
                                                            <span style={{ fontSize: 12, fontWeight: 600, color: colors.label, flex: 1, textTransform: 'capitalize' }}>{diff}</span>
                                                            <span style={{ fontSize: 13, fontWeight: 700, color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>
                                                                {entry.count} Q
                                                            </span>
                                                            {marksPerQ != null && (
                                                                <span style={{ fontSize: 11, color: theme === 'dark' ? '#64748b' : '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>
                                                                    × {marksPerQ} = {totalForDiff} marks
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                                {(() => {
                                                    const tm = exercise.exerciseInformation?.totalMarksProgramming ?? exercise.exerciseInformation?.totalMarks ?? exercise.exerciseInformation?.totalPoints;
                                                    if (!tm) return null;
                                                    return (
                                                        <div style={{
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            padding: '8px 14px', borderRadius: 8, marginTop: 4,
                                                            background: theme === 'dark' ? '#1e293b' : '#f8fafc',
                                                            border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
                                                        }}>
                                                            <span style={{ fontSize: 12, fontWeight: 600, color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>Total</span>
                                                            <span style={{ fontSize: 14, fontWeight: 700, color: theme === 'dark' ? '#f1f5f9' : '#0f172a' }}>{tm} marks</span>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                            {(() => {
                                const ss = exercise.questionConfiguration?.programmingQuestionConfiguration?.scoreSettings;
                                if (!ss?.scoreType) return null;
                                const isEven = ss.scoreType === 'evenMarks';
                                if (!isEven) return null;
                                return (
                                    <div style={{ padding: '20px', background: theme === 'dark' ? '#431407' : '#fff7ed', borderBottom: `1px solid ${theme === 'dark' ? '#7c2d12' : '#fed7aa'}` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <span style={{ fontSize: 16 }}>🎯</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: theme === 'dark' ? '#fdba74' : '#ea580c', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Marking Scheme</span>
                                        </div>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '10px 14px', borderRadius: 8,
                                            background: theme === 'dark' ? '#7c2d12' : '#ffedd5',
                                            border: `1px solid ${theme === 'dark' ? '#f97316' : '#fdba74'}`,
                                        }}>
                                            <span style={{ fontSize: 12, color: theme === 'dark' ? '#fdba74' : '#ea580c', fontWeight: 500 }}>Marks per question</span>
                                            <span style={{ fontSize: 18, fontWeight: 700, color: theme === 'dark' ? '#ffedd5' : '#c2410c' }}>{ss.evenMarks ?? '—'}</span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {exercise.evaluationSettings && (
                                <div style={{ padding: '20px', background: theme === 'dark' ? '#0f172a' : '#f8fafc' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                        <span style={{ fontSize: 16 }}>⚙️</span>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: theme === 'dark' ? '#94a3b8' : '#64748b', letterSpacing: '0.6px', textTransform: 'uppercase' }}>Evaluation</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <InfoRow label="Practice Mode" value={exercise.evaluationSettings.practiceMode ? 'Yes' : 'No'} theme={theme} />
                                        <InfoRow label="AI Evaluation" value={exercise.evaluationSettings.aiEvaluation ? 'Enabled' : 'Disabled'} theme={theme} />
                                        <InfoRow label="Auto Evaluation" value={exercise.evaluationSettings.automationEvaluation ? 'Enabled' : 'Disabled'} theme={theme} />
                                        {exercise.evaluationSettings.manualEvaluation?.enabled && (
                                            <InfoRow label="Manual Evaluation" value={exercise.evaluationSettings.manualEvaluation.submissionNeeded ? 'Submission required' : 'Enabled'} theme={theme} />
                                        )}
                                        {exercise.evaluationSettings.passingScore != null && (
                                            <InfoRow label="Passing Score" value={`${exercise.evaluationSettings.passingScore}%`} theme={theme} />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )} */}



            </div>

            {/* Toast Notifications */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`flex items-start gap-3 p-4 rounded-lg shadow-lg max-w-sm transition-all duration-300 ${toast.type === 'success' ? 'bg-green-50 border border-green-200' : toast.type === 'error' ? 'bg-red-50 border border-red-200' : toast.type === 'warning' ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-200'}`}
                    >
                        <div className={`flex-shrink-0 ${toast.type === 'success' ? 'text-green-500' : toast.type === 'error' ? 'text-red-500' : toast.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'}`}>
                            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : toast.type === 'error' ? <XCircle className="w-5 h-5" /> : toast.type === 'warning' ? <AlertTriangle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">{toast.title}</h4>
                            <p className="text-xs text-gray-600">{toast.message}</p>
                        </div>
                        <button onClick={() => removeToast(toast.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors">
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>


            {/* Image Modal */}
            <ImageModal
                image={modalImage}
                onClose={() => setModalImage(null)}
                theme={theme}
            />


            {/* Exercise Info + Score/Question Overview Modals (MCQ-style) */}
            {exData && (
                <ExerciseInfoModals
                    exercise={exData}
                    showDetailsModal={showDetailsModal}
                    setShowDetailsModal={setShowDetailsModal}
                    showOverviewModal={showOverviewModal}
                    setShowOverviewModal={setShowOverviewModal}
                    solvedQuestions={solvedQuestions}
                />
            )}

            {/* Exercise Details Modal — LEGACY INLINE (kept commented for reference) */}
            {false && showDetailsModal && exercise && (
                <div
                    style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setShowDetailsModal(false); }}>
                    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1.5px solid #e4e4ed', fontFamily: FONT }}>
                        <div style={{ padding: '13px 16px', borderBottom: '1.5px solid #e4e4ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f7f7fb', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <FileText size={14} style={{ color: '#3a3a52' }} />
                                <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Exercise Details</span>
                            </div>
                            <button type="button" onClick={() => setShowDetailsModal(false)}
                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a9ab0', display: 'flex', padding: 4, borderRadius: 6 }}>
                                <X size={15} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                            {exercise.exerciseInformation?.exerciseName && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Exercise Name</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#F27757', fontFamily: FONT, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exercise.exerciseInformation.exerciseName}</span>
                                </div>
                            )}
                            {exercise.exerciseInformation?.exerciseLevel && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Level</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: FONT, textTransform: 'capitalize' }}>{exercise.exerciseInformation.exerciseLevel}</span>
                                </div>
                            )}
                            {exercise.exerciseInformation?.totalDuration != null && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Duration</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: FONT }}>{exercise.exerciseInformation.totalDuration} min</span>
                                </div>
                            )}
                            {(() => {
                                const tm = exercise.exerciseInformation?.totalMarksProgramming ?? exercise.exerciseInformation?.totalMarks ?? exercise.exerciseInformation?.totalPoints;
                                return tm != null ? (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Total Marks</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: FONT }}>{tm}</span>
                                    </div>
                                ) : null;
                            })()}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Questions</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: FONT }}>{exercise.questions?.length ?? 0}</span>
                            </div>
                            {exercise.exerciseType && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Exercise Type</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: FONT, textTransform: 'capitalize' }}>{exercise.exerciseType}</span>
                                </div>
                            )}
                            {exercise.programmingSettings?.selectedLanguages?.length > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Languages</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: FONT }}>{exercise.programmingSettings.selectedLanguages.map((l: string) => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')}</span>
                                </div>
                            )}
                            {exercise.evaluationSettings && (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Practice Mode</span>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: exercise.evaluationSettings.practiceMode ? '#16a34a' : '#e53e3e', fontFamily: FONT }}>{exercise.evaluationSettings.practiceMode ? 'Yes' : 'No'}</span>
                                    </div>
                                    {exercise.evaluationSettings.passingScore != null && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Passing Score</span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: FONT }}>{exercise.evaluationSettings.passingScore}%</span>
                                        </div>
                                    )}
                                </>
                            )}
                            {exercise.availabilityPeriod?.startDate && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f7' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>From</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: FONT }}>{new Date(exercise.availabilityPeriod.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                            )}
                            {exercise.availabilityPeriod?.endDate && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 16px' }}>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Until</span>
                                    <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', fontFamily: FONT }}>{new Date(exercise.availabilityPeriod.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '10px 16px', borderTop: '1.5px solid #e4e4ed', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                            <button type="button" onClick={() => setShowDetailsModal(false)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 10, fontFamily: FONT, fontSize: 12, fontWeight: 600, border: '1.5px solid #e4e4ed', background: '#f7f7fb', color: '#3a3a52', cursor: 'pointer' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Exercise Overview Modal — LEGACY INLINE (disabled, replaced by ExerciseInfoModals above) */}
            {false && showOverviewModal && exercise && (() => {
                const configuredDiffs = (['easy', 'medium', 'hard'] as const).filter(d => difficultyMap[d]);
                const totalSlotsAll = configuredDiffs.length > 0
                    ? configuredDiffs.reduce((s, d) => s + (difficultyMap[d]?.count ?? 0), 0)
                    : problems.length;
                const solvedAll = solvedQuestions.size;
                const remainingAll = Math.max(0, totalSlotsAll - solvedAll);
                const totalMarksAll = exercise.exerciseInformation?.totalMarksProgramming ?? exercise.exerciseInformation?.totalMarks ?? exercise.exerciseInformation?.totalPoints ?? 0;
                const qConfig = exercise.questionConfiguration?.programmingQuestionConfiguration;
                const ss = qConfig?.scoreSettings;
                const isGeneral = !configuredDiffs.length || qConfig?.questionConfigType === 'general';

                return (
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
                        onClick={e => { if (e.target === e.currentTarget) setShowOverviewModal(false); }}>
                        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 400, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1.5px solid #e4e4ed', fontFamily: FONT }}>
                            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid #e4e4ed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff7ed', flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <BarChart3 size={14} style={{ color: '#f97316' }} />
                                    <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>Question and Marks details</span>
                                </div>
                                <button type="button" onClick={() => setShowOverviewModal(false)}
                                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9a9ab0', display: 'flex', padding: 4, borderRadius: 6 }}>
                                    <X size={15} />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {/* Overall Questions */}
                                <div style={{ padding: '12px 16px', borderBottom: '1.5px solid #e4e4ed' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#F27757', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: FONT }}>Overall Questions</span>
                                    </div>
                                    {[
                                        { label: 'Total Questions', value: totalSlotsAll, color: '#1a1a2e' },
                                        { label: 'Solved', value: solvedAll, denom: totalSlotsAll, color: '#7c3aed' },
                                        { label: 'Remaining', value: remainingAll, color: remainingAll === 0 ? '#16a34a' : '#d97706' },
                                    ].map(({ label, value, denom, color }) => (
                                        <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>{label}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: FONT }}>
                                                {value}{denom != null ? <span style={{ color: '#9a9ab0', fontWeight: 400, fontSize: 10 }}>/{denom}</span> : ''}
                                            </span>
                                        </div>
                                    ))}
                                    {totalSlotsAll > 0 && (
                                        <div style={{ height: 6, background: '#f0f0f7', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
                                            <div style={{ height: '100%', borderRadius: 3, background: remainingAll === 0 ? '#16a34a' : '#F27757', width: `${Math.min(100, (solvedAll / totalSlotsAll) * 100)}%`, transition: 'width 0.4s' }} />
                                        </div>
                                    )}
                                    {/* Per-difficulty breakdown */}
                                    {!isGeneral && configuredDiffs.length > 0 && (
                                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {configuredDiffs.map(d => {
                                                const count = difficultyMap[d]?.count ?? 0;
                                                const solvedD = [...solvedQuestions].filter(idx => (exercise.questions?.[idx]?.difficulty || '').toLowerCase() === d).length;
                                                const rem = count - solvedD;
                                                const diffColor = d === 'easy' ? '#16a34a' : d === 'medium' ? '#d97706' : '#e53e3e';
                                                return (
                                                    <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, borderLeft: `2px solid ${diffColor}`, marginBottom: 2 }}>
                                                        <span style={{ fontSize: 12, fontWeight: 600, color: diffColor, textTransform: 'capitalize', fontFamily: FONT }}>{d}</span>
                                                        <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT }}>
                                                            <span style={{ color: '#7c3aed' }}>{solvedD}</span>
                                                            <span style={{ color: '#9a9ab0', fontWeight: 400 }}>/{count}</span>
                                                            <span style={{ color: rem <= 0 ? '#16a34a' : '#9a9ab0', fontSize: 10, marginLeft: 6, fontWeight: 500 }}>{rem <= 0 ? '✓' : `${rem} left`}</span>
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Overall Marks */}
                                {totalMarksAll > 0 && (
                                    <div style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                            <Award size={12} style={{ color: '#7c3aed' }} />
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: FONT }}>Overall Marks</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#3a3a52', fontFamily: FONT }}>Total Marks</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', fontFamily: FONT }}>{totalMarksAll}</span>
                                        </div>
                                        {/* Per-difficulty marks */}
                                        {!isGeneral && configuredDiffs.length > 0 && (
                                            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                {configuredDiffs.map(d => {
                                                    const lsc = ss?.levelScoringConfiguration?.[d];
                                                    const count = difficultyMap[d]?.count ?? 0;
                                                    const perQ = lsc?.marksPerQuestion ?? ss?.evenMarks ?? null;
                                                    const total = lsc?.totalMarks ?? (perQ != null ? perQ * count : null);
                                                    const diffColor = d === 'easy' ? '#16a34a' : d === 'medium' ? '#d97706' : '#e53e3e';
                                                    return (
                                                        <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, borderLeft: `2px solid ${diffColor}`, marginBottom: 2 }}>
                                                            <span style={{ fontSize: 12, fontWeight: 600, color: diffColor, textTransform: 'capitalize', fontFamily: FONT }}>{d}</span>
                                                            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: FONT, color: '#1a1a2e' }}>
                                                                {total != null ? `${total} marks` : '—'}
                                                                {perQ != null && <span style={{ color: '#9a9ab0', fontSize: 10, marginLeft: 6 }}>{perQ}/q</span>}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {/* Even marks scheme */}
                                        {ss?.scoreType === 'evenMarks' && ss.evenMarks != null && (
                                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#fff7ed', border: '1.5px solid #fed7aa' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: 12, color: '#f97316', fontWeight: 600, fontFamily: FONT }}>Marks per question</span>
                                                    <span style={{ fontSize: 14, fontWeight: 700, color: '#c2410c', fontFamily: FONT }}>{ss.evenMarks}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={{ padding: '10px 16px', borderTop: '1.5px solid #e4e4ed', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                                <button type="button" onClick={() => setShowOverviewModal(false)}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 10, fontFamily: FONT, fontSize: 12, fontWeight: 600, border: '1.5px solid #e4e4ed', background: '#f7f7fb', color: '#3a3a52', cursor: 'pointer' }}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}


            {/* ← ADD THIS */}

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
                .custom-scrollbar { scrollbar-width: thin; scrollbar-color: ${theme === 'dark' ? '#4b5563 transparent' : '#9ca3af transparent'}; }
                .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: ${theme === 'dark' ? '#4b5563' : '#9ca3af'}; border-radius: 4px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: ${theme === 'dark' ? '#6b7280' : '#6b7280'}; }
              video {
        -webkit-transform: scaleX(-1);
        transform: scaleX(-1);
    }
    
    /* For camera preview only (not mirrored) */
    .camera-preview video {
        -webkit-transform: scaleX(1);
        transform: scaleX(1);
    }

          `}</style>
        </div>
    );
}