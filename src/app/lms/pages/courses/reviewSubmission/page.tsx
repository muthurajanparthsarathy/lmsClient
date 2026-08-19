"use client";
import { getToken } from "@/lib/session";

import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { API_BASE_URL } from '@/lib/http';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Search,
  Code,
  X,
  RefreshCw,
  FileCode,
  Users,
  Award,
  ArrowLeft,
  Copy,
  ChevronLeft,
  ChevronRight,
  Home,
  Folder,
  Layers,
  CheckCircle,
  Clock,
  Send,
  Play,
  Loader2,
  Terminal,
  FileText,
  MessageSquare,
  FileQuestion,
  Check,
  User,
  Trash2,
  Maximize2,
  Minimize2,
  AlertCircle,
  MoreVertical,
  Lock,
  Unlock,
  XCircle,
  Filter,
  Pencil,
  Eye,
  Sun,
  Moon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSearchParams, useRouter } from 'next/navigation';
import { useSectionHref } from '@/lib/sectionRoute';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast, Toaster } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import StaffFrontendReview from './components/StaffFrontendReview';
import StaffCodeReview from './components/StaffCodeReview';
import { NotionPagesViewer, PageData as NotionPageData } from '@/app/lms/component/student/OthersNotionEditor';
import { RerunButton } from '@/components/rerun/RerunButton';

// Dynamically Import Monaco Editor
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-500 text-xs">
      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading Editor...
    </div>
  )
});

// Font Configuration
const inter = Inter({ subsets: ['latin'] });

// API CONFIG
// Was hardcoded to https://lmsserver-yeve.onrender.com, which made grading (every
// /users/update/submission-score POST) work only on a developer machine.
const BACKEND_API_URL = API_BASE_URL;
const PISTON_API_URL = process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston/execute";

// --- INTERFACES ---
interface MCQOption {
  _id?: string;
  text: string;
  isCorrect: boolean;
  imageUrl?: string;
}

interface ExerciseQuestion {
  _id: string;
  title?: string;
  description?: string | { text?: string; imageUrl?: string; contentBlocks?: any[] };
  points?: number;
  score?: number;
  timeLimit?: number;
  memoryLimit?: number;
  difficulty?: string;
  sampleInput?: string;
  sampleOutput?: string;
  constraints?: string[];
  hints?: Array<{
    hintText: string;
    pointsDeduction: number;
    isPublic: boolean;
    sequence: number;
  }>;
  solutions?: {
    startedCode: string;
    functionName: string;
    language: string;
  };
  questionType?: 'MCQ' | 'Programming';
  mcqQuestionTitle?: string | any[];
  mcqQuestionDescription?: string;
  mcqQuestionType?: 'multiple_choice' | 'dropdown' | 'short_answer' | 'essay' | 'checkboxes' | 'multiple_select' | 'true_false' | 'numeric' | 'matching' | 'ordering';
  matchingPairs?: Array<{ left: string; right: string; _id?: string }>;
  orderingItems?: Array<{ text: string; order: number; _id?: string }>;
  trueFalseAnswer?: boolean | null;
  numericAnswer?: number | null;
  numericTolerance?: number | null;
  mcqQuestionDifficulty?: string;
  mcqQuestionOptions?: MCQOption[];
  mcqQuestionCorrectAnswers?: string[];
  mcqQuestionTimeLimit?: number;
  mcqQuestionScore?: number;
  // Others question fields
  othersQuestionType?: 'notion' | 'file-upload';
  notionSettings?: {
    allowBold?: boolean;
    allowItalic?: boolean;
    allowUnderline?: boolean;
    allowOrderedList?: boolean;
    allowUnorderedList?: boolean;
    allowHeading?: boolean;
    allowLink?: boolean;
    allowImage?: boolean;
  };
  fileUploadSettings?: {
    allowedTypes?: string[];
    maxFiles?: number;
    maxFileSizeMB?: number;
  };
  othersDescription?: {
    text?: string;
    html?: string;
    images?: Array<string | { url: string; alt?: string; alignment?: string; sizePercent?: number }>;
    attachments?: Array<{ name: string; url: string; mimeType: string }>;
  };
  // content blocks system (new)
  questionContent?: Array<{
    id: string; type: 'text' | 'image';
    value?: string; url?: string;
    alignment?: 'left' | 'center' | 'right'; sizePercent?: number;
  }>;
  // top-level attachments (mirrors othersDescription.attachments)
  attachments?: Array<{ name: string; url: string; mimeType: string }>;
  // legacy image fields (backward compat)
  descriptionImageUrl?: string;
  descriptionImageAlignment?: 'left' | 'center' | 'right';
  descriptionImageSizePercent?: number;
}

interface Exercise {
  _id: string;
  exerciseInformation: {
    exerciseId: string;
    exerciseName: string;
    description: string;
    exerciseLevel: 'beginner' | 'intermediate' | 'advanced';
    totalPoints: number;
    totalQuestions: number;
    estimatedTime: number;
    totalMarksMCQ?: number;
    totalMarksProgramming?: number;
    totalMarks?: number;
  };
  programmingSettings: {
    selectedModule: string;
    selectedLanguages: string[];
    levelConfiguration: {
      levelType: 'levelBased' | 'general';
      levelBased?: {
        easy: number;
        medium: number;
        hard: number;
      };
      general?: number;
    };
  };
  scoreSettings?: {
    scoreType: string;
    levelBasedMarks?: {
      easy: number;
      medium: number;
      hard: number;
    };
    evenMarks?: number;
    totalMarks?: number;
    separateMarks?: {
      general?: number[];
      levelBased?: {
        easy?: number[];
        medium?: number[];
        hard?: number[];
      };
    };
    levelScoringConfiguration?: {
      easy?: { totalMarks: number; marksPerQuestion: number; questionCount: number };
      medium?: { totalMarks: number; marksPerQuestion: number; questionCount: number };
      hard?: { totalMarks: number; marksPerQuestion: number; questionCount: number };
    };
  };
  questions: ExerciseQuestion[];
  exerciseType?: 'MCQ' | 'Programming' | 'Combined' | 'Other';
  nodeType?: string;
  createdAt: string;
  questionConfiguration?: {
    mcqQuestionConfiguration?: {
      totalMcqQuestions: number;
      marksPerQuestion: number;
      mcqTotalMarks: number;
      scoringType: string;
    };
    programmingQuestionConfiguration?: {
      questionConfigType: string;
      generalQuestionCount?: number;
      scoreSettings?: any;
    };
  };
  _category?: string;
  _subcategory?: string;
  _topicId?: string;
  _moduleId?: string;
  _subModuleId?: string;
  _subTopicId?: string;
  isGraded?: boolean;

}

interface SubmissionQuestion {
  _id: string;
  questionId: string;
  codeAnswer: string;
  language: string;
  isCorrect: boolean;
  score: number;
  status: 'attempted' | 'evaluated' | 'pending';
  attemScore: number;
  submittedAt: string;
  feedback?: string;
  tags?: string[];
  timeTaken?: number;
  memoryUsed?: number;
  attemptCount?: number;
  nodeType?: string;
  files?: Array<{
    id: string;
    filename: string;
    content: string;
    language: string;
    path: string;
    folderPath: string;
    isEntryPoint?: boolean;
  }>;
  folders?: Array<{
    id: string;
    name: string;
    path: string;
    parentPath: string;
    depth: number;
  }>;
  othersFiles?: Array<{
    name: string;
    url: string;
    mimeType: string;
  }>;
}

interface ExerciseAnswer {
  _id: string;
  exerciseId: string;
  questions: SubmissionQuestion[];
  nodeId: string;
  nodeName: string;
  nodeType: string;
  subcategory: string;
  createdAt: string;
  lateSubmission?: boolean;
  lastTestSubmittedAt?: string;
  userAttempts?: number;
  testSubmissions?: number;
  // How the most recent submission happened + the stored reason (only set for AUTO)
  submitType?: 'USER' | 'AUTO';
  autoSubmitReason?: string;
}

interface UserCourse {
  courseId: string;
  answers?: {
    We_Do?: any;
    You_Do?: any;
  };
  lastAccessed: string;
  _id: string;
}

interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  profile: string;
  role: {
    renameRole: string;
  };
  department?: string;
  courses?: UserCourse[];
  permissions?: any[];
}

interface Participant {
  _id: string;
  user: User;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface CourseModule {
  _id: string;
  title: string;
  pedagogy?: any;
  subModules?: Array<{
    _id: string;
    title: string;
    pedagogy?: any;
    topics?: Array<{
      _id: string;
      title: string;
      pedagogy?: any;
      subTopics?: Array<{
        _id: string;
        title: string;
        pedagogy?: any;
      }>;
    }>;
  }>;
  topics?: Array<{
    _id: string;
    title: string;
    pedagogy?: any;
    subTopics?: Array<{
      _id: string;
      title: string;
      pedagogy?: any;
    }>;
  }>;
}

interface CourseData {
  _id: string;
  courseName: string;
  courseCode?: string;
  modules: CourseModule[];
  batchAndParticipants: Array<{
    _id?: string;
    batchName?: string;
    users?: Participant[];
  }>;
}

interface BreadcrumbItem {
  title: string;
  icon: React.ReactNode;
  type: 'course' | 'module' | 'submodule' | 'topic' | 'subtopic' | 'exercise' | 'analytics' | 'grading';
}

interface LogEntry {
  id: string;
  type: 'stdout' | 'stderr' | 'stdin' | 'system';
  content: string;
  timestamp: number;
}

interface FrontendSubmissionData {
  _id: string;
  exerciseId: string;
  questionId: string;
  files: Array<{
    id: string;
    filename: string;
    content: string;
    language: string;
    path: string;
    folderPath: string;
    isEntryPoint?: boolean;
  }>;
  folders: Array<{
    id: string;
    name: string;
    path: string;
    parentPath: string;
    depth: number;
  }>;
  status: string;
  score?: number;
  feedback?: string;
  submittedAt: string;
  attemptCount: number;
  participantName?: string;
  participantEmail?: string;
  lateSubmission?: boolean;
  lastTestSubmittedAt?: string;
}

// --- HELPER FUNCTIONS ---
const extractMCQTitleText = (title: string | any[] | undefined): string => {
  if (!title) return "MCQ Question";
  if (typeof title === 'string') return title;
  if (Array.isArray(title)) {
    const textBlocks = title
      .filter(block => block.type === 'text')
      .map(block => block.value)
      .join(' ');
    return textBlocks || "MCQ Question";
  }
  return "MCQ Question";
};

const getQuestionTitle = (question: ExerciseQuestion): string => {
  if (!question) return "Question";
  if ((question.questionType?.toLowerCase() === 'mcq') || (!question.title && question.mcqQuestionTitle)) {
    return extractMCQTitleText(question.mcqQuestionTitle);
  }
  return question.title || "Programming Question";
};

const getQuestionDescription = (question: ExerciseQuestion): string => {
  if (!question) return "";
  if ((question.questionType?.toLowerCase() === 'mcq') || (!question.title && question.mcqQuestionDescription)) {
    return question.mcqQuestionDescription || "";
  }
  if (question.description) {
    if (typeof question.description === 'string') return question.description;
    if (typeof question.description === 'object' && question.description.text) {
      if (Array.isArray(question.description.text)) {
        return question.description.text
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.value)
          .join(' ');
      }
      return question.description.text;
    }
  }
  return "";
};

const getQuestionMaxScore = (exercise: Exercise, question: ExerciseQuestion): number => {
  if (question.mcqQuestionScore && question.mcqQuestionScore > 0) return question.mcqQuestionScore;
  if (question.score && question.score > 0) return question.score;
  if (question.points && question.points > 0) return question.points;

  if (exercise.scoreSettings) {
    const { scoreType, levelBasedMarks, evenMarks, totalMarks, separateMarks, levelScoringConfiguration } = exercise.scoreSettings;

    if (scoreType === 'separateMarks' && separateMarks) {
      const questionIndex = exercise.questions.findIndex(q => q._id === question._id);
      if (questionIndex !== -1) {
        if (separateMarks.general && separateMarks.general[questionIndex] !== undefined) {
          return separateMarks.general[questionIndex];
        }
        const diff = (question.difficulty || question.mcqQuestionDifficulty || 'easy').toLowerCase();
        if (diff.includes('easy') && separateMarks.levelBased?.easy && separateMarks.levelBased.easy[questionIndex] !== undefined) {
          return separateMarks.levelBased.easy[questionIndex];
        }
        if (diff.includes('medium') && separateMarks.levelBased?.medium && separateMarks.levelBased.medium[questionIndex] !== undefined) {
          return separateMarks.levelBased.medium[questionIndex];
        }
        if (diff.includes('hard') && separateMarks.levelBased?.hard && separateMarks.levelBased.hard[questionIndex] !== undefined) {
          return separateMarks.levelBased.hard[questionIndex];
        }
      }
    }

    if (scoreType === 'levelBasedMarks' && levelBasedMarks) {
      const diff = (question.difficulty || question.mcqQuestionDifficulty || 'easy').toLowerCase();
      if (diff.includes('easy')) return levelBasedMarks.easy || 10;
      if (diff.includes('medium')) return levelBasedMarks.medium || 15;
      if (diff.includes('hard')) return levelBasedMarks.hard || 20;
    }

    if (scoreType === 'levelBasedMarks' && levelScoringConfiguration) {
      const diff = (question.difficulty || question.mcqQuestionDifficulty || 'easy').toLowerCase();
      if (diff.includes('easy') && levelScoringConfiguration.easy) return levelScoringConfiguration.easy.marksPerQuestion || 10;
      if (diff.includes('medium') && levelScoringConfiguration.medium) return levelScoringConfiguration.medium.marksPerQuestion || 15;
      if (diff.includes('hard') && levelScoringConfiguration.hard) return levelScoringConfiguration.hard.marksPerQuestion || 20;
    }

    if (scoreType === 'evenMarks') {
      if (evenMarks !== undefined && evenMarks > 0) return evenMarks;
      if (totalMarks && exercise.questions.length > 0) return parseFloat((totalMarks / exercise.questions.length).toFixed(2));
    }
  }

  if (exercise.questionConfiguration?.mcqQuestionConfiguration) {
    const mcqConfig = exercise.questionConfiguration.mcqQuestionConfiguration;
    if (mcqConfig.scoringType === 'equalDistribution' && mcqConfig.marksPerQuestion) return mcqConfig.marksPerQuestion;
    if (mcqConfig.scoringType === 'questionSpecific' && question.mcqQuestionScore) return question.mcqQuestionScore;
  }

  if (exercise.questionConfiguration?.programmingQuestionConfiguration?.scoreSettings) {
    const progConfig = exercise.questionConfiguration.programmingQuestionConfiguration.scoreSettings;
    if (progConfig.scoreType === 'evenMarks' && progConfig.evenMarks) return progConfig.evenMarks;
    if (progConfig.scoreType === 'levelBasedMarks' && progConfig.levelBasedMarks) {
      const diff = (question.difficulty || 'easy').toLowerCase();
      if (diff.includes('easy')) return progConfig.levelBasedMarks.easy || 10;
      if (diff.includes('medium')) return progConfig.levelBasedMarks.medium || 15;
      if (diff.includes('hard')) return progConfig.levelBasedMarks.hard || 20;
    }
  }

  return 10;
};

const getDynamicExerciseTotal = (exercise: Exercise | null): number => {
  if (!exercise || !exercise.questions || exercise.questions.length === 0) return 0;

  // Prefer the stored totalMarks from exerciseInformation (covers Combined/Section-based)
  if (exercise.exerciseInformation?.totalMarks && exercise.exerciseInformation.totalMarks > 0) {
    return exercise.exerciseInformation.totalMarks;
  }

  if (exercise.scoreSettings) {
    const { scoreType, totalMarks, evenMarks, levelBasedMarks, levelScoringConfiguration } = exercise.scoreSettings;
    if (totalMarks && totalMarks > 0) return totalMarks;
    if (scoreType === 'evenMarks' && evenMarks) return evenMarks * exercise.questions.length;
    if (scoreType === 'levelBasedMarks') {
      let total = 0;
      exercise.questions.forEach(q => {
        const diff = (q.difficulty || q.mcqQuestionDifficulty || 'easy').toLowerCase();
        if (levelScoringConfiguration) {
          if (diff.includes('easy') && levelScoringConfiguration.easy) total += levelScoringConfiguration.easy.marksPerQuestion || 10;
          else if (diff.includes('medium') && levelScoringConfiguration.medium) total += levelScoringConfiguration.medium.marksPerQuestion || 15;
          else if (diff.includes('hard') && levelScoringConfiguration.hard) total += levelScoringConfiguration.hard.marksPerQuestion || 20;
          else total += 10;
        } else if (levelBasedMarks) {
          if (diff.includes('easy')) total += levelBasedMarks.easy || 10;
          else if (diff.includes('medium')) total += levelBasedMarks.medium || 15;
          else if (diff.includes('hard')) total += levelBasedMarks.hard || 20;
          else total += 10;
        } else total += 10;
      });
      return total;
    }
  }

  if (exercise.questionConfiguration?.mcqQuestionConfiguration) {
    const mcqConfig = exercise.questionConfiguration.mcqQuestionConfiguration;
    if (mcqConfig.mcqTotalMarks && mcqConfig.mcqTotalMarks > 0) return mcqConfig.mcqTotalMarks;
    if (mcqConfig.scoringType === 'equalDistribution' && mcqConfig.marksPerQuestion) return mcqConfig.marksPerQuestion * exercise.questions.length;
  }

  return exercise.questions.reduce((acc, q) => acc + getQuestionMaxScore(exercise, q), 0);
};

const isQuestionMCQ = (q: ExerciseQuestion | null): boolean => {
  if (!q) return false;
  // Handle both uppercase 'MCQ' (regular exercises) and lowercase 'mcq' (section-based)
  return (q.questionType?.toLowerCase() === 'mcq') || (!q.title && !!q.mcqQuestionTitle);
};

// Returns true ONLY when this is a real frontend (HTML/CSS/JS) submission.
// Multi-file Core Programming (Python, etc.) ALSO has a `files` array, so we
// must inspect the exercise's selectedModule + the actual file languages.
const isFrontendQuestion = (
  question: ExerciseQuestion,
  submission?: SubmissionQuestion | null,
  exercise?: ExerciseData | null,
): boolean => {
  if (!question) return false;

  const selectedModule = (exercise?.programmingSettings?.selectedModule || '').toLowerCase();
  // Hard exclusion: Core Programming is NEVER frontend, even if it has files[].
  if (selectedModule === 'core programming' || selectedModule === 'database') return false;

  if (submission && submission.files && submission.files.length > 0) {
    // Verify at least one file is a frontend language before classifying as frontend.
    const FRONTEND_LANGS = new Set(['html', 'css', 'javascript', 'typescript']);
    const FRONTEND_EXTS = new Set(['html', 'htm', 'css', 'js', 'jsx', 'ts', 'tsx']);
    const hasFrontendFile = submission.files.some((f: any) => {
      const lang = String(f.language || '').toLowerCase();
      if (FRONTEND_LANGS.has(lang)) return true;
      const ext = (f.filename || '').split('.').pop()?.toLowerCase() || '';
      return FRONTEND_EXTS.has(ext);
    });
    if (hasFrontendFile) return true;
    // files[] present but none are frontend → not a frontend submission
    return false;
  }

  // No submission yet — fall back to question metadata heuristics
  if (selectedModule === 'frontend') return true;

  const title = (question.title || '').toLowerCase();
  const description = (getQuestionDescription(question) || '').toLowerCase();
  const frontendKeywords = ['html', 'css', 'javascript', 'frontend', 'web', 'react', 'vue', 'angular', 'ui', 'interface', 'website', 'page'];
  const hasFrontendKeyword = frontendKeywords.some(keyword =>
    title.includes(keyword) || description.includes(keyword)
  );

  if (question.solutions?.language) {
    const lang = question.solutions.language.toLowerCase();
    const frontendLangs = ['html', 'css', 'javascript', 'typescript', 'react', 'vue', 'angular'];
    if (frontendLangs.includes(lang)) return true;
  }

  return hasFrontendKeyword;
};

// True when this is a Core Programming multi-file submission (e.g. Python).
// We treat this as a CODE review (not frontend preview).
const isCoreProgrammingMultiFileQuestion = (
  submission?: SubmissionQuestion | null,
  exercise?: ExerciseData | null,
): boolean => {
  const selectedModule = (exercise?.programmingSettings?.selectedModule || '').toLowerCase();
  if (selectedModule !== 'core programming') return false;
  if (!submission?.files || submission.files.length === 0) return false;
  return true;
};

const isOthersQuestion = (question: ExerciseQuestion | null, submission?: SubmissionQuestion | null): boolean => {
  if (!question) return false;
  // Only "notion" and "file-upload" are real Others types; "text" is a programming question default
  if (question.othersQuestionType === 'notion' || question.othersQuestionType === 'file-upload') return true;
  if (submission?.nodeType === 'others_notion' || submission?.nodeType === 'others_file') return true;
  if (submission?.othersFiles && submission.othersFiles.length > 0) return true;
  return false;
};

const isStudent = (user: User | null | undefined): boolean => {
  // Guard against orphan participants — a batch record can have a stale
  // participant entry whose user was deleted; `user` is then null and reading
  // `.role` crashed the whole page during the filter pass.
  if (!user) return false;
  const role = user.role?.renameRole?.toLowerCase() || '';
  return role === 'student';
};

const ScoreIndicator = ({ score, maxScore }: { score: number; maxScore: number }) => {
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full absolute left-0 transition-all duration-500 ${percentage >= 80 ? 'bg-emerald-500' : percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, percentage)}%` }} />
      </div>
      <span className={`text-[11px] font-semibold text-slate-600 ${inter.className}`}>
        {score} / {maxScore}
      </span>
    </div>
  );
};

const InteractiveTerminal = ({ isOpen, onClose, logs, isWaitingForInput, onInputSubmit, isRunning, language, onClear, inputPlaceholder = "Type input here..." }: any) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    if (isWaitingForInput && inputRef.current) setTimeout(() => inputRef.current?.focus(), 50);
  }, [logs, isWaitingForInput, isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fixed z-[100] flex flex-col shadow-2xl rounded-lg overflow-hidden border border-slate-800 bg-slate-950 ${inter.className} transition-all duration-300 ease-in-out animate-in slide-in-from-bottom-6`}
      style={isMaximized ? { top: '20px', left: '20px', right: '20px', bottom: '20px', width: 'auto', height: 'auto' } : { bottom: '32px', right: '32px', width: '500px', height: '400px' }}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-emerald-500" />
          <div>
            <span className={`text-xs font-bold text-slate-200 block ${inter.className}`}>Console Output</span>
            <span className="text-[10px] text-slate-500 font-mono uppercase">{language} • {isRunning ? 'Running' : 'Idle'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onClear} className="h-6 w-6 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded"><Trash2 className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setIsMaximized(!isMaximized)} className="h-6 w-6 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded">{isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}</Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-6 w-6 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded"><X className="w-3.5 h-3.5" /></Button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1 custom-scrollbar bg-slate-950 cursor-text">
        {logs.map((log: any) => (
          <div key={log.id} className="break-all whitespace-pre-wrap leading-relaxed">
            {log.type === 'stdout' && <span className="text-slate-300">{log.content}</span>}
            {log.type === 'stderr' && <span className="text-rose-400">{log.content}</span>}
            {log.type === 'system' && <span className="text-emerald-600/70 italic select-none">➜ {log.content}</span>}
            {log.type === 'stdin' && <span className="text-amber-400 font-bold flex items-start gap-1"><span className="text-slate-600 select-none">$</span> {log.content}</span>}
          </div>
        ))}
        {isRunning && !isWaitingForInput && <div className="flex items-center gap-2 mt-2"><Loader2 className="w-3 h-3 text-emerald-500 animate-spin" /><span className="text-slate-500 italic">Processing...</span></div>}
        {isWaitingForInput && (
          <form onSubmit={(e) => { e.preventDefault(); onInputSubmit(inputValue); setInputValue(""); }} className="flex items-center gap-2 mt-2">
            <span className="text-amber-500 font-bold select-none">{">"}</span>
            <input ref={inputRef} type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="flex-1 bg-transparent border-none outline-none text-amber-400 font-bold placeholder:text-slate-700/50 caret-amber-400" placeholder={inputPlaceholder} autoComplete="off" autoFocus />
          </form>
        )}
      </div>
    </div>
  );
};

// --- OTHERS REVIEW PANEL ---
const OthersReviewPanel = ({
  question,
  submission,
  inter,
}: {
  question: ExerciseQuestion;
  submission: SubmissionQuestion | null;
  inter: any;
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);

  const othersType = question.othersQuestionType ||
    (submission?.nodeType === 'others_notion' ? 'notion' : submission?.nodeType === 'others_file' ? 'file-upload' : null);

  const hasFiles = submission?.othersFiles && submission.othersFiles.length > 0;
  const hasNotionAnswer = othersType === 'notion' && submission?.codeAnswer;

  // Parse multi-page notion answer if present
  const notionPages: NotionPageData[] | null = (() => {
    if (!submission?.codeAnswer) return null;
    const raw = submission.codeAnswer;
    if (typeof raw !== 'string' || !raw.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.type === 'notionPages' && Array.isArray(parsed.pages)) return parsed.pages as NotionPageData[];
    } catch { /* not JSON */ }
    return null;
  })();

  // For text/csv files, fetch content
  const fetchTextContent = async (url: string) => {
    setTextLoading(true);
    try {
      const res = await fetch(url);
      const text = await res.text();
      setTextContent(text);
    } catch {
      setTextContent('Unable to load file content.');
    } finally {
      setTextLoading(false);
    }
  };

  const renderFileViewer = (file: { name: string; url: string; mimeType: string }, idx: number) => {
    const mime = file.mimeType?.toLowerCase() || '';
    const name = file.name?.toLowerCase() || '';

    const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
    const isImage = mime.startsWith('image/');
    const isDocx = mime.includes('wordprocessingml') || name.endsWith('.docx') || name.endsWith('.doc');
    const isXlsx = mime.includes('spreadsheetml') || name.endsWith('.xlsx') || name.endsWith('.xls');
    const isPptx = mime.includes('presentationml') || name.endsWith('.pptx') || name.endsWith('.ppt');
    const isOffice = isDocx || isXlsx || isPptx;
    const isText = mime.includes('text/plain') || name.endsWith('.txt') || name.endsWith('.csv') || mime.includes('text/csv');

    return (
      <div key={idx} className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-semibold text-slate-700 ${inter.className}`}>{file.name}</span>
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wide flex items-center gap-1"
          >
            ↗ Open
          </a>
        </div>
        {isPdf && (
          <iframe
            src={file.url}
            className="w-full rounded-lg border border-slate-200"
            style={{ height: 520 }}
            title={file.name}
          />
        )}
        {isImage && (
          <img
            src={file.url}
            alt={file.name}
            className="max-w-full rounded-lg border border-slate-200 object-contain"
            style={{ maxHeight: 480 }}
          />
        )}
        {isOffice && (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`}
            className="w-full rounded-lg border border-slate-200"
            style={{ height: 520 }}
            title={file.name}
          />
        )}
        {isText && (
          <div>
            {textContent === null && !textLoading && (
              <button
                onClick={() => fetchTextContent(file.url)}
                className="text-xs text-indigo-600 hover:underline"
              >
                Load file content
              </button>
            )}
            {textLoading && <div className="text-xs text-slate-500">Loading...</div>}
            {textContent !== null && (
              <pre className="bg-slate-900 text-slate-200 text-xs p-4 rounded-lg overflow-auto max-h-80 font-mono">
                {textContent}
              </pre>
            )}
          </div>
        )}
        {!isPdf && !isImage && !isOffice && !isText && (
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
              <FileCode className="h-5 w-5 text-slate-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">{file.name}</p>
              <p className="text-xs text-slate-500">{file.mimeType || 'Unknown type'}</p>
            </div>
            <a
              href={file.url}
              download={file.name}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs font-bold text-white bg-slate-900 hover:bg-indigo-600 px-3 py-1.5 rounded-md transition-colors"
            >
              Download
            </a>
          </div>
        )}
      </div>
    );
  };

  const [showDetailModal, setShowDetailModal] = useState(false);

  // Collect all attachments from both top-level and othersDescription
  const allAttachments = (() => {
    const combined = [
      ...(question.attachments || []),
      ...(question.othersDescription?.attachments || []),
    ];
    return combined.filter((a, i, arr) => arr.findIndex(x => x.url === a.url) === i);
  })();

  // Check whether there's any content to show in the modal
  const hasDescription = !!(
    (question.questionContent && question.questionContent.length > 0) ||
    question.othersDescription?.html ||
    question.othersDescription?.text ||
    (question.othersDescription?.images && question.othersDescription.images.length > 0) ||
    question.descriptionImageUrl
  );
  const hasViewMore = hasDescription || allAttachments.length > 0;

  const getAttachmentIcon = (mime: string) => {
    if (!mime) return '📎';
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('word') || mime.includes('doc')) return '📝';
    if (mime.includes('excel') || mime.includes('sheet')) return '📊';
    if (mime.includes('powerpoint') || mime.includes('presentation')) return '📋';
    if (mime.startsWith('image/')) return '🖼️';
    if (mime.startsWith('video/')) return '🎥';
    return '📎';
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">
      {/* Question header — title only + View More button */}
      <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
        <span className={`text-[9px] font-bold text-orange-500 uppercase tracking-widest mb-2 block ${inter.className}`}>
          {othersType === 'notion' ? 'Written Response' : othersType === 'file-upload' ? 'File Upload' : 'Others'} • {question.points || question.score || 10} Mark
        </span>
        <div className="flex items-start justify-between gap-3">
          <h2 className={`text-sm font-semibold text-slate-800 leading-relaxed flex-1 ${inter.className}`}>
            {question.title || 'Question'}
          </h2>
          {hasViewMore && (
            <button
              onClick={() => setShowDetailModal(true)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide transition-all bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-200 hover:border-orange-300 ${inter.className}`}
            >
              <Layers className="w-3 h-3" />
              View More
            </button>
          )}
        </div>
        {allAttachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {allAttachments.map((att, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 border border-orange-200 text-[10px] font-semibold text-orange-700">
                <span>{getAttachmentIcon(att.mimeType)}</span>
                <span className="max-w-[100px] truncate">{att.name}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Question Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className={`max-w-2xl rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-white ${inter.className}`}>
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className={`text-[9px] font-bold text-orange-500 uppercase tracking-widest block mb-1 ${inter.className}`}>
                  {othersType === 'notion' ? 'Written Response' : othersType === 'file-upload' ? 'File Upload' : 'Others'} • {question.points || question.score || 10} points
                </span>
                <DialogTitle className={`text-sm font-bold text-slate-900 leading-snug ${inter.className}`}>
                  {question.title || 'Question'}
                </DialogTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowDetailModal(false)}
                className="h-8 w-8 p-0 rounded-full hover:bg-slate-200 shrink-0">
                <X className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh]">
            <div className="px-6 py-5 space-y-5">

              {/* Description + Images */}
              {hasDescription && (
                <div>
                  <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 ${inter.className}`}>
                    Description
                  </p>
                  <div className="space-y-3">
                    {question.questionContent && question.questionContent.length > 0 ? (
                      question.questionContent.map((cb, i) => {
                        if (cb.type === 'text' && cb.value) {
                          return (
                            <div key={cb.id || i}
                              className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: cb.value }}
                            />
                          );
                        }
                        if (cb.type === 'image' && cb.url) {
                          const justify = cb.alignment === 'left' ? 'flex-start' : cb.alignment === 'right' ? 'flex-end' : 'center';
                          return (
                            <div key={cb.id || i} style={{ display: 'flex', justifyContent: justify }}>
                              <img src={cb.url} alt=""
                                style={{ width: `${cb.sizePercent || 60}%`, height: 'auto', borderRadius: 10, border: '1.5px solid #e2e8f0', display: 'block' }}
                              />
                            </div>
                          );
                        }
                        return null;
                      })
                    ) : (
                      <>
                        {question.othersDescription?.html && (
                          <div className="text-sm text-slate-700 leading-relaxed prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: question.othersDescription.html }} />
                        )}
                        {question.othersDescription?.text && !question.othersDescription?.html && (
                          <p className="text-sm text-slate-700 leading-relaxed">{question.othersDescription.text}</p>
                        )}
                        {question.othersDescription?.images && question.othersDescription.images.length > 0 && (
                          <div className="flex flex-col gap-3">
                            {question.othersDescription.images.map((entry, i) => {
                              const imgUrl = typeof entry === 'string' ? entry : entry.url;
                              const imgSize = typeof entry === 'object' && typeof entry.sizePercent === 'number' ? entry.sizePercent : 60;
                              const imgAlign = typeof entry === 'object' ? (entry.alignment || 'center') : 'center';
                              const justify = imgAlign === 'left' ? 'flex-start' : imgAlign === 'right' ? 'flex-end' : 'center';
                              return (
                                <div key={i} style={{ display: 'flex', justifyContent: justify }}>
                                  <img src={imgUrl} alt=""
                                    style={{ width: `${imgSize}%`, height: 'auto', borderRadius: 10, border: '1.5px solid #e2e8f0', display: 'block', objectFit: 'contain' }} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {question.descriptionImageUrl && (
                          <div style={{
                            display: 'flex',
                            justifyContent: question.descriptionImageAlignment === 'left' ? 'flex-start'
                              : question.descriptionImageAlignment === 'right' ? 'flex-end' : 'center',
                          }}>
                            <img src={question.descriptionImageUrl} alt=""
                              style={{ width: `${question.descriptionImageSizePercent || 60}%`, height: 'auto', borderRadius: 10, border: '1.5px solid #e2e8f0', display: 'block' }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Attachments */}
              {allAttachments.length > 0 && (
                <div>
                  <p className={`text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 ${inter.className}`}>
                    Attachments
                  </p>
                  <div className="flex flex-col gap-2">
                    {allAttachments.map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 transition-all group no-underline">
                        <span className="text-xl shrink-0">{getAttachmentIcon(att.mimeType)}</span>
                        <span className="flex-1 text-xs font-semibold text-slate-700 group-hover:text-indigo-700 truncate">{att.name}</span>
                        <span className={`text-[10px] font-bold text-indigo-500 uppercase tracking-wide shrink-0 ${inter.className}`}>Open ↗</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </ScrollArea>

          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
            <Button onClick={() => setShowDetailModal(false)}
              className={`bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wide px-5 rounded-lg h-9 hover:bg-indigo-600 transition-colors ${inter.className}`}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Response */}
      <div>
        <h3 className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ${inter.className}`}>
          Student Response
        </h3>

        {!submission ? (
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <AlertCircle className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Student has not submitted a response for this question.</span>
          </div>
        ) : othersType === 'notion' || hasNotionAnswer ? (
          /* Notion answer — either multi-page or plain HTML */
          notionPages ? (
            /* Multi-page Notion answer — Word-like page cards */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                  📄 {notionPages.length} Page{notionPages.length !== 1 ? 's' : ''}
                </span>
              </div>
              <NotionPagesViewer pages={notionPages} isDark={false} />
            </div>
          ) : (
            /* Plain HTML notion answer (legacy simple editor) */
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              {submission.codeAnswer ? (
                <div
                  className="text-sm text-slate-800 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: submission.codeAnswer }}
                />
              ) : (
                <p className="text-xs text-slate-400 italic">No content written.</p>
              )}
            </div>
          )
        ) : hasFiles ? (
          /* File upload — render each file inline */
          <div>
            {submission.othersFiles!.map((file, idx) => renderFileViewer(file, idx))}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <AlertCircle className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">No response data found.</span>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function EnhancedSubmissionReview() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Back goes to the upload screen in the section this console was opened
  // from — Courses or Course Structure both mount this page.
  const sectionHref = useSectionHref();

  const [courseId] = useState(searchParams.get('courseId') || '');
  const exerciseId = searchParams.get('exerciseId');

  // ── Single-student "direct grading" mode ───────────────────────────────────
  // When the page is opened from the Live Dashboard's StudentRow "Check
  // Answers" menu item, the URL carries a `studentId`. In that mode we:
  //   1. Skip the participants-list view entirely (the user just picked a
  //      student from the dashboard — sending them to ANOTHER list view is
  //      pointless).
  //   2. Auto-invoke `handleStartGrading` for that student as soon as both
  //      the participants and the target exercise have loaded.
  //   3. Re-route the "Exit Panel" button and the "All graded!" follow-up
  //      back to the Live Dashboard instead of the (now hidden) list.
  //
  // When `studentId` is absent, the legacy entry-point behavior is preserved.
  const studentIdParam = searchParams.get('studentId');
  const returnToParam = searchParams.get('returnTo'); // e.g. "liveDashboard"
  const isSingleStudentMode = !!studentIdParam;
  // Guard so the auto-grade effect runs once per studentId — not on every
  // participants-state mutation triggered by the grading flow itself.
  const hasAutoStartedGradingRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [search, setSearch] = useState('');
  // Pagination for the student list so the table fits the viewport
  // instead of scrolling the whole page.
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<ExerciseAnswer | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<ExerciseQuestion | null>(null);
  const [submissionQuestion, setSubmissionQuestion] = useState<SubmissionQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(10);
  // Programming / code / others questions get an auto-graded score from
  // `verifyTestCasesAndScore` (code-editor) so the input is read-only by
  // default — the grader clicks the pencil icon to override. The lock
  // resets whenever the grader navigates to a different question.
  const [isScoreEditable, setIsScoreEditable] = useState(false);
  // Helper — Manual-eval exercises should default to editable so the grader
  // can type the score directly instead of clicking the pencil first. Reads
  // the exercise's stored evaluationMethod (falls through to false when
  // absent / non-manual so auto-corrected values stay locked as before).
  const isManualEvalExercise = (ex: any): boolean => {
    const m = ex?.evaluationMethod?.method
      || ex?.evaluationMethod
      || ex?.evaluationSettings?.method
      || '';
    return String(m).toLowerCase() === 'manual';
  };
  const [viewMode, setViewMode] = useState<'list' | 'grading'>('list');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [modalQuestion, setModalQuestion] = useState<ExerciseQuestion | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [questionListMinimized, setQuestionListMinimized] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [gradingStats, setGradingStats] = useState({ graded: 0, pending: 0, total: 0, averageScore: 0 });
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [assessmentVideoUrl, setAssessmentVideoUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  // Code-viewer theme. Defaults to LIGHT ('vs') because the review screen sits
  // inside a light-mode admin console and a black editor slab in the middle
  // fights the surrounding surface. Trainers who prefer the dark editor can
  // flip it from the toolbar toggle on the right side of the code toolbar; the
  // choice persists across sessions.
  const [codeTheme, setCodeTheme] = useState<'vs' | 'vs-dark'>(() => {
    if (typeof window === 'undefined') return 'vs';
    return (localStorage.getItem('lms_review_code_theme') as 'vs' | 'vs-dark') || 'vs';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('lms_review_code_theme', codeTheme);
  }, [codeTheme]);
  const codeIsDark = codeTheme === 'vs-dark';
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([]);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [executionLanguage, setExecutionLanguage] = useState('javascript');
  const inputResolverRef = useRef<((value: string) => void) | null>(null);
  const [pyodideReady, setPyodideReady] = useState(false);
  const pyodideRef = useRef<any>(null);

  const [isFrontendReview, setIsFrontendReview] = useState(false);
  const [isCodeMultiFileReview, setIsCodeMultiFileReview] = useState(false);
  const [frontendSubmissionData, setFrontendSubmissionData] = useState<FrontendSubmissionData | null>(null);
  const [isOthersReview, setIsOthersReview] = useState(false);
const isNonGraded = !!(
  selectedExercise?.isGraded === false ||  // Now this will detect isGraded: false
  getDynamicExerciseTotal(selectedExercise) === 0
);
  // --- HELPER: Map Language for Monaco ---
  const getMonacoLanguage = (lang: string) => {
    const languageMap: { [key: string]: string } = {
      javascript: 'javascript',
      typescript: 'typescript',
      python: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      csharp: 'csharp',
      sql: 'sql',
      plsql: 'sql'
    };
    return languageMap[lang?.toLowerCase()] || 'javascript';
  };

  const getQuestionDisplayDifficulty = (q: ExerciseQuestion): string => {
    const raw = q.difficulty || q.mcqQuestionDifficulty || '';
    return raw.toLowerCase();
  };

  const getQuestionLabel = (q: ExerciseQuestion): string =>
    isQuestionMCQ(q) ? extractMCQTitleText(q.mcqQuestionTitle) : (q.title || 'Question');

  const extractFrontendSubmissionFromAnswers = (participant: Participant, questionId: string): FrontendSubmissionData | null => {
    const answers = getExerciseAnswersForSelectedExercise(participant);

    for (const answer of answers) {
      const submission = answer.questions.find(q => q.questionId === questionId);
      if (submission && submission.files && submission.files.length > 0) {
        return {
          _id: submission._id,
          exerciseId: answer.exerciseId,
          questionId: submission.questionId,
          files: submission.files,
          folders: submission.folders || [],
          status: submission.status,
          score: submission.score,
          feedback: submission.feedback,
          submittedAt: submission.submittedAt,
          attemptCount: answer.userAttempts || submission.attemptCount || 1,
          participantName: `${participant.user.firstName} ${participant.user.lastName}`,
          participantEmail: participant.user.email,
          lateSubmission: !!answer.lateSubmission,
          lastTestSubmittedAt: answer.lastTestSubmittedAt,
        };
      }
    }

    return null;
  };

  // Look up the exercise-level late flag for the currently selected participant+exercise
  // (used by the single-file standard code view, which has no FrontendSubmissionData).
  const getCurrentAnswerMeta = (): { attemptCount: number; submittedAt?: string; lateSubmission: boolean; lastTestSubmittedAt?: string } | null => {
    if (!selectedParticipant || !selectedQuestion) return null;
    const answers = getExerciseAnswersForSelectedExercise(selectedParticipant);
    for (const answer of answers) {
      const submission = answer.questions.find(q => q.questionId === selectedQuestion._id);
      if (submission) {
        return {
          attemptCount: answer.userAttempts || submission.attemptCount || 1,
          submittedAt: submission.submittedAt,
          lateSubmission: !!answer.lateSubmission,
          lastTestSubmittedAt: answer.lastTestSubmittedAt,
        };
      }
    }
    return null;
  };

  // --- COLLECT EXERCISES WITH METADATA (SUPPORTS ALL HIERARCHY COMBINATIONS) ---
  const collectExercisesWithMetadata = (courseData: CourseData): Exercise[] => {
    const allExercises: Exercise[] = [];

    if (!courseData.modules) return allExercises;

    const collect = (
      list: Exercise[] | undefined,
      cat: string,
      sub: string,
      moduleId?: string,
      subModuleId?: string,
      topicId?: string,
      subTopicId?: string
    ) => {
      if (!list || !Array.isArray(list)) return;

      list.forEach((ex: any) => {
        const exerciseWithMeta: Exercise = {
  _id: ex._id || Math.random().toString(),
  exerciseInformation: {
    exerciseId: ex.exerciseInformation?.exerciseId || ex._id || "EX_UNKNOWN",
    exerciseName: ex.exerciseInformation?.exerciseName || "Unnamed Exercise",
    description: ex.exerciseInformation?.description || ex.description || "",
    exerciseLevel: ex.exerciseInformation?.exerciseLevel || 'intermediate',
    totalPoints: ex.exerciseInformation?.totalPoints || ex.totalPoints || 0,
    totalQuestions: ex.questions?.length || 0,
    estimatedTime: ex.exerciseInformation?.estimatedTime || ex.totalDuration || 60,
    totalMarksMCQ: ex.exerciseInformation?.totalMarksMCQ || 0,
    totalMarksProgramming: ex.exerciseInformation?.totalMarksProgramming || 0,
    totalMarks: ex.exerciseInformation?.totalMarks || 0
  },
  programmingSettings: ex.programmingSettings || {
    selectedModule: 'Core Programming',
    selectedLanguages: ['Python'],
    levelConfiguration: {
      levelType: 'general',
      general: 0
    }
  },
  scoreSettings: ex.scoreSettings || ex.questionConfiguration?.programmingQuestionConfiguration?.scoreSettings,
  questionConfiguration: ex.questionConfiguration,
  questions: ex.questions || [],
  nodeType: ex.nodeType || 'exercise',
  createdAt: ex.createdAt || new Date().toISOString(),
  _category: cat,
  _subcategory: sub,
  _moduleId: moduleId,
  _subModuleId: subModuleId,
  _topicId: topicId,
  _subTopicId: subTopicId,
  exerciseType: ex.exerciseType || 'Programming',  // Add this line
  isGraded: ex.isGraded !== undefined ? ex.isGraded : true  // ADD THIS LINE - default to true
};
        allExercises.push(exerciseWithMeta);
      });
    };

    // Recursive function to traverse all hierarchy levels
    const traverseModules = (modules: any[]) => {
      modules.forEach((module: any) => {
        const moduleId = module._id;

        // Check if module has direct We_Do/You_Do at module level
        if (module.pedagogy) {
          const p = module.pedagogy;
          collect(p.We_Do?.assignments, 'We_Do', 'assignments', moduleId, undefined, undefined, undefined);

          collect(p.We_Do?.assignment, 'We_Do', 'assignment', moduleId, undefined, undefined, undefined);
          collect(p.We_Do?.practical, 'We_Do', 'practical', moduleId, undefined, undefined, undefined);
          collect(p.We_Do?.project_development, 'We_Do', 'project_development', moduleId, undefined, undefined, undefined);
          collect(p.We_Do?.assessments, 'We_Do', 'assessments', moduleId, undefined, undefined, undefined);
          collect(p.We_Do?.assesments, 'We_Do', 'assesments', moduleId, undefined, undefined, undefined);
          collect(p.You_Do?.practical, 'You_Do', 'practical', moduleId, undefined, undefined, undefined);
          collect(p.You_Do?.project_development, 'You_Do', 'project_development', moduleId, undefined, undefined, undefined);
          collect(p.You_Do?.assessments, 'You_Do', 'assessments', moduleId, undefined, undefined, undefined);
          collect(p.You_Do?.assesments, 'You_Do', 'assesments', moduleId, undefined, undefined, undefined);
          collect(p.You_Do?.assesment, 'You_Do', 'assesment', moduleId, undefined, undefined, undefined);
        }

        // Check if module has direct topics (without submodules)
        if (module.topics && Array.isArray(module.topics)) {
          module.topics.forEach((topic: any) => {
            const topicId = topic._id;
            const p = topic.pedagogy;
            if (p) {
              collect(p.We_Do?.assignments, 'We_Do', 'assignments', moduleId, undefined, topicId, undefined);

              collect(p.We_Do?.assignment, 'We_Do', 'assignment', moduleId, undefined, topicId, undefined);
              collect(p.We_Do?.practical, 'We_Do', 'practical', moduleId, undefined, topicId, undefined);
              collect(p.We_Do?.project_development, 'We_Do', 'project_development', moduleId, undefined, topicId, undefined);
              collect(p.We_Do?.assessments, 'We_Do', 'assessments', moduleId, undefined, topicId, undefined);
              collect(p.We_Do?.assesments, 'We_Do', 'assesments', moduleId, undefined, topicId, undefined);
              collect(p.You_Do?.practical, 'You_Do', 'practical', moduleId, undefined, topicId, undefined);
              collect(p.You_Do?.project_development, 'You_Do', 'project_development', moduleId, undefined, topicId, undefined);
              collect(p.You_Do?.assessments, 'You_Do', 'assessments', moduleId, undefined, topicId, undefined);
              collect(p.You_Do?.assesments, 'You_Do', 'assesments', moduleId, undefined, topicId, undefined);
              collect(p.You_Do?.assesment, 'You_Do', 'assesment', moduleId, undefined, topicId, undefined);
            }

            // Check if topic has subTopics
            if (topic.subTopics && Array.isArray(topic.subTopics)) {
              topic.subTopics.forEach((subTopic: any) => {
                const subTopicId = subTopic._id;
                const p = subTopic.pedagogy;
                if (p) {
                  collect(p.We_Do?.assignments, 'We_Do', 'assignments', moduleId, undefined, topicId, subTopicId);

                  collect(p.We_Do?.assignment, 'We_Do', 'assignment', moduleId, undefined, topicId, subTopicId);
                  collect(p.We_Do?.practical, 'We_Do', 'practical', moduleId, undefined, topicId, subTopicId);
                  collect(p.We_Do?.project_development, 'We_Do', 'project_development', moduleId, undefined, topicId, subTopicId);
                  collect(p.We_Do?.assessments, 'We_Do', 'assessments', moduleId, undefined, topicId, subTopicId);
                  collect(p.We_Do?.assesments, 'We_Do', 'assesments', moduleId, undefined, topicId, subTopicId);
                  collect(p.You_Do?.practical, 'You_Do', 'practical', moduleId, undefined, topicId, subTopicId);
                  collect(p.You_Do?.project_development, 'You_Do', 'project_development', moduleId, undefined, topicId, subTopicId);
                  collect(p.You_Do?.assessments, 'You_Do', 'assessments', moduleId, undefined, topicId, subTopicId);
                  collect(p.You_Do?.assesments, 'You_Do', 'assesments', moduleId, undefined, topicId, subTopicId);
                  collect(p.You_Do?.assesment, 'You_Do', 'assesment', moduleId, undefined, topicId, subTopicId);
                }
              });
            }
          });
        }

        // Traverse submodules
        if (module.subModules && Array.isArray(module.subModules)) {
          module.subModules.forEach((subModule: any) => {
            const subModuleId = subModule._id;

            // Check if submodule has direct We_Do/You_Do at submodule level
            if (subModule.pedagogy) {
              const p = subModule.pedagogy;
              collect(p.We_Do?.assignments, 'We_Do', 'assignments', moduleId, subModuleId, undefined, undefined);

              collect(p.We_Do?.assignment, 'We_Do', 'assignment', moduleId, subModuleId, undefined, undefined);
              collect(p.We_Do?.practical, 'We_Do', 'practical', moduleId, subModuleId, undefined, undefined);
              collect(p.We_Do?.project_development, 'We_Do', 'project_development', moduleId, subModuleId, undefined, undefined);
              collect(p.We_Do?.assessments, 'We_Do', 'assessments', moduleId, subModuleId, undefined, undefined);
              collect(p.We_Do?.assesments, 'We_Do', 'assesments', moduleId, subModuleId, undefined, undefined);
              collect(p.You_Do?.practical, 'You_Do', 'practical', moduleId, subModuleId, undefined, undefined);
              collect(p.You_Do?.project_development, 'You_Do', 'project_development', moduleId, subModuleId, undefined, undefined);
              collect(p.You_Do?.assessments, 'You_Do', 'assessments', moduleId, subModuleId, undefined, undefined);
              collect(p.You_Do?.assesments, 'You_Do', 'assesments', moduleId, subModuleId, undefined, undefined);
              collect(p.You_Do?.assesment, 'You_Do', 'assesment', moduleId, subModuleId, undefined, undefined);
            }

            // Check if submodule has direct topics
            if (subModule.topics && Array.isArray(subModule.topics)) {
              subModule.topics.forEach((topic: any) => {
                const topicId = topic._id;
                const p = topic.pedagogy;
                if (p) {
                  collect(p.We_Do?.assignments, 'We_Do', 'assignments', moduleId, subModuleId, topicId, undefined);

                  collect(p.We_Do?.assignment, 'We_Do', 'assignment', moduleId, subModuleId, topicId, undefined);
                  collect(p.We_Do?.practical, 'We_Do', 'practical', moduleId, subModuleId, topicId, undefined);
                  collect(p.We_Do?.project_development, 'We_Do', 'project_development', moduleId, subModuleId, topicId, undefined);
                  collect(p.We_Do?.assessments, 'We_Do', 'assessments', moduleId, subModuleId, topicId, undefined);
                  collect(p.We_Do?.assesments, 'We_Do', 'assesments', moduleId, subModuleId, topicId, undefined);
                  collect(p.You_Do?.practical, 'You_Do', 'practical', moduleId, subModuleId, topicId, undefined);
                  collect(p.You_Do?.project_development, 'You_Do', 'project_development', moduleId, subModuleId, topicId, undefined);
                  collect(p.You_Do?.assessments, 'You_Do', 'assessments', moduleId, subModuleId, topicId, undefined);
                  collect(p.You_Do?.assesments, 'You_Do', 'assesments', moduleId, subModuleId, topicId, undefined);
                  collect(p.You_Do?.assesment, 'You_Do', 'assesment', moduleId, subModuleId, topicId, undefined);
                }

                // Check if topic has subTopics
                if (topic.subTopics && Array.isArray(topic.subTopics)) {
                  topic.subTopics.forEach((subTopic: any) => {
                    const subTopicId = subTopic._id;
                    const p = subTopic.pedagogy;
                    if (p) {
                      collect(p.We_Do?.assignments, 'We_Do', 'assignments', moduleId, subModuleId, topicId, subTopicId);

                      collect(p.We_Do?.assignment, 'We_Do', 'assignment', moduleId, subModuleId, topicId, subTopicId);
                      collect(p.We_Do?.practical, 'We_Do', 'practical', moduleId, subModuleId, topicId, subTopicId);
                      collect(p.We_Do?.project_development, 'We_Do', 'project_development', moduleId, subModuleId, topicId, subTopicId);
                      collect(p.We_Do?.assessments, 'We_Do', 'assessments', moduleId, subModuleId, topicId, subTopicId);
                      collect(p.We_Do?.assesments, 'We_Do', 'assesments', moduleId, subModuleId, topicId, subTopicId);
                      collect(p.You_Do?.practical, 'You_Do', 'practical', moduleId, subModuleId, topicId, subTopicId);
                      collect(p.You_Do?.project_development, 'You_Do', 'project_development', moduleId, subModuleId, topicId, subTopicId);
                      collect(p.You_Do?.assessments, 'You_Do', 'assessments', moduleId, subModuleId, topicId, subTopicId);
                      collect(p.You_Do?.assesments, 'You_Do', 'assesments', moduleId, subModuleId, topicId, subTopicId);
                      collect(p.You_Do?.assesment, 'You_Do', 'assesment', moduleId, subModuleId, topicId, subTopicId);
                    }
                  });
                }
              });
            }
          });
        }
      });
    };

    // Start traversal from modules
    traverseModules(courseData.modules);

    console.log(`Collected ${allExercises.length} exercises with metadata`);
    console.log("Exercises found:", allExercises.map(ex => ({
      id: ex._id,
      exerciseId: ex.exerciseInformation?.exerciseId,
      name: ex.exerciseInformation?.exerciseName,
      category: ex._category,
      subcategory: ex._subcategory,
      moduleId: ex._moduleId,
      subModuleId: ex._subModuleId,
      topicId: ex._topicId,
      subTopicId: ex._subTopicId,
      questions: ex.questions?.length,
      totalMarks: getDynamicExerciseTotal(ex)
    })));

    return allExercises;
  };

  // --- BUILD BREADCRUMB WITH ALL HIERARCHY LEVELS ---
  const buildBreadcrumb = (exercise: Exercise) => {
    if (!courseData || !exercise) return;

    const breadcrumbItems: BreadcrumbItem[] = [
      {
        title: courseData.courseName || 'Course',
        icon: <Home className="h-3.5 w-3.5" />,
        type: 'course'
      }
    ];

    // Find the location in course structure
    if (exercise._moduleId) {
      const module = courseData.modules.find(m => m._id === exercise._moduleId);
      if (module) {
        breadcrumbItems.push(
          { title: module.title, icon: <Layers className="h-3.5 w-3.5" />, type: 'module' }
        );

        // Check for submodule
        if (exercise._subModuleId) {
          const subModule = module.subModules?.find(sm => sm._id === exercise._subModuleId);
          if (subModule) {
            breadcrumbItems.push(
              { title: subModule.title, icon: <Folder className="h-3.5 w-3.5" />, type: 'submodule' }
            );
          }
        }

        // Check for topic
        if (exercise._topicId) {
          let topic = null;

          if (exercise._subModuleId) {
            const subModule = module.subModules?.find(sm => sm._id === exercise._subModuleId);
            if (subModule && subModule.topics) {
              topic = subModule.topics.find(t => t._id === exercise._topicId);
            }
          } else if (module.topics) {
            topic = module.topics.find(t => t._id === exercise._topicId);
          }

          if (topic) {
            breadcrumbItems.push(
              { title: topic.title, icon: <FileCode className="h-3.5 w-3.5" />, type: 'topic' }
            );
          }
        }

        // Check for subtopic
        if (exercise._subTopicId) {
          let subTopic = null;

          // Find subtopic in the hierarchy
          if (exercise._topicId) {
            let topic = null;

            if (exercise._subModuleId) {
              const subModule = module.subModules?.find(sm => sm._id === exercise._subModuleId);
              if (subModule && subModule.topics) {
                topic = subModule.topics.find(t => t._id === exercise._topicId);
              }
            } else if (module.topics) {
              topic = module.topics.find(t => t._id === exercise._topicId);
            }

            if (topic && topic.subTopics) {
              subTopic = topic.subTopics.find(st => st._id === exercise._subTopicId);
            }
          }

          if (subTopic) {
            breadcrumbItems.push(
              { title: subTopic.title, icon: <FileCode className="h-3.5 w-3.5" />, type: 'subtopic' }
            );
          }
        }
      }
    }

    // Add exercise and grading console
    breadcrumbItems.push(
      {
        title: exercise.exerciseInformation.exerciseName,
        icon: <FileCode className="h-3.5 w-3.5" />,
        type: 'exercise'
      },
      {
        title: 'Grading Console',
        icon: <Award className="h-3.5 w-3.5" />,
        type: 'grading'
      }
    );

    setBreadcrumb(breadcrumbItems);
  };

  // --- EFFECTS ---
  // (Course data is fetched by the `useQuery` declared below — no manual
  // useEffect needed here. The query auto-runs when `courseId` changes.)

  useEffect(() => {
    if (exercises.length > 0 && exerciseId) {
      const exercise = exercises.find(ex =>
        ex._id === exerciseId ||
        ex.exerciseInformation?.exerciseId === exerciseId ||
        (ex._id && ex._id.includes(exerciseId)) ||
        (ex.exerciseInformation?.exerciseId && ex.exerciseInformation.exerciseId.includes(exerciseId))
      );

      if (exercise) {
        setSelectedExercise(exercise);
        buildBreadcrumb(exercise);
        calculateGradingStats();
      } else {
        if (exercises.length > 0) {
          setSelectedExercise(exercises[0]);
          buildBreadcrumb(exercises[0]);
          calculateGradingStats();
        }
      }
    }
  }, [exerciseId, exercises]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (saveSuccess) {
      timer = setTimeout(() => { setSaveSuccess(false); }, 2000);
    }
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  // ── Single-student direct-grading auto-trigger ─────────────────────────────
  // Once the participants list and the target exercise have loaded, if a
  // `studentId` is in the URL, find that participant and jump straight to
  // their grading view. Runs at most once per studentId (the ref guard
  // prevents re-triggering when participants state mutates during grading,
  // e.g. after a score save).
  useEffect(() => {
    if (!isSingleStudentMode) return;
    if (hasAutoStartedGradingRef.current) return;
    if (!selectedExercise) return;
    if (!participants || participants.length === 0) return;

    // Backend uses `_id` for User document ids; the dashboard passes the
    // user id (StudentProgress.id). Match against the user side, with a
    // fallback to the participant document id in case any caller passes
    // that instead.
    const target = participants.find((p) =>
      p.user?._id === studentIdParam || p._id === studentIdParam
    );

    if (!target) {
      // Studen id didn't resolve — surface clearly, but don't strand the
      // user on a hidden empty page. Let `viewMode` fall through to 'list'
      // so they at least see the participants table.
      toast.error('Could not find that student in this assessment.');
      hasAutoStartedGradingRef.current = true;
      return;
    }

    hasAutoStartedGradingRef.current = true;
    handleStartGrading(target);
  }, [isSingleStudentMode, selectedExercise, participants, studentIdParam]);

  // --- DATA FETCHING & LOGIC ---
  const initEngines = async () => {
    try {
      if (!pyodideReady && (window as any).loadPyodide) {
        const pyodide = await (window as any).loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/" });
        pyodideRef.current = pyodide;
        setPyodideReady(true);
      }
    } catch (e) {
      console.error("Pyodide Load Error", e);
    }
    (window as any).getReactInput = () => new Promise((resolve) => {
      setIsWaitingForInput(true);
      inputResolverRef.current = resolve;
    });
  };

  const addLog = (type: LogEntry['type'], content: string) => {
    setTerminalLogs(prev => [...prev, {
      id: Math.random().toString(36).substring(7),
      type,
      content,
      timestamp: Date.now()
    }]);
  };

  const clearTerminal = () => setTerminalLogs([]);

  const handleTerminalInput = (value: string) => {
    addLog('stdin', value);
    if (inputResolverRef.current) {
      inputResolverRef.current(value);
      inputResolverRef.current = null;
    }
    setIsWaitingForInput(false);
  };

  const calculateGradingStats = () => {
    if (!selectedExercise) return;

    let studentsWithSubmissions = 0;
    let studentsGraded = 0;
    let totalScoreSum = 0;
    let totalMaxPointsSum = 0;

    participants.forEach(participant => {
      const answers = getExerciseAnswersForSelectedExercise(participant);
      const hasSubmissions = answers.length > 0 && answers.some(a => a.questions && a.questions.length > 0);

      if (hasSubmissions) {
        studentsWithSubmissions++;

        const isGraded = answers.some(a =>
          a.questions.some(q => q.status === 'evaluated')
        );

        if (isGraded) studentsGraded++;

        answers.forEach(a => {
          a.questions.forEach(q => {
            if (q.status === 'evaluated') {
              totalScoreSum += q.score;
              const questionDetails = selectedExercise.questions.find(sq => sq._id === q.questionId);
              totalMaxPointsSum += questionDetails ?
                getQuestionMaxScore(selectedExercise, questionDetails) : 0;
            }
          });
        });
      }
    });

    const averageScore = totalMaxPointsSum > 0 ?
      Math.round((totalScoreSum / totalMaxPointsSum) * 100) : 0;

    setGradingStats({
      graded: studentsGraded,
      total: studentsWithSubmissions,
      pending: studentsWithSubmissions - studentsGraded,
      averageScore
    });
  };

  // ── React Query: course-data fetch ────────────────────────────────────────
  // Caches the heavy `/getAll/courses-data/review/:courseId` payload so that
  // re-entering the page (e.g. from the Live Dashboard "Check Answers" menu,
  // or after switching tabs) shows the previous data INSTANTLY while a
  // background revalidation runs. `staleTime: 2min` covers the typical
  // grading session — within that window the cached payload is treated as
  // fresh, no re-fetch on remount.
  const queryClient = useQueryClient();

  const fetchCourseDataRequest = async (id: string): Promise<CourseData> => {
    const response = await fetch(`${BACKEND_API_URL}/getAll/courses-data/review/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to load course data');
    }
    return result.data as CourseData;
  };

  const {
    data: courseQueryData,
    isLoading: isCourseLoading,
    isError: isCourseError,
    error: courseQueryError,
  } = useQuery<CourseData, Error>({
    queryKey: courseId ? queryKeys.reviewSubmission.courseData(courseId) : ['reviewSubmission', 'courseData', 'none'],
    queryFn: () => fetchCourseDataRequest(courseId),
    enabled: !!courseId,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Loading flag drives the full-page spinner. Once a query result exists
  // (even if it's stale), we drop the spinner — the background refetch
  // (`isCourseFetching`) is silent and the UI keeps showing data.
  useEffect(() => {
    setLoading(isCourseLoading && !courseQueryData);
  }, [isCourseLoading, courseQueryData]);

  // Surface query errors via the existing toast UX. Re-fires only when
  // `courseQueryError.message` changes, so we don't spam on rerenders.
  useEffect(() => {
    if (isCourseError && courseQueryError) {
      console.error('Failed to load course data:', courseQueryError);
      toast.error(courseQueryError.message || 'Failed to load course data');
    }
  }, [isCourseError, courseQueryError]);

  // Whenever fresh course data arrives (or comes back from cache), rebuild
  // the derived state: exercises list, selected exercise, breadcrumb,
  // sorted-participants list, grading stats. The body of this effect is the
  // exact logic that used to live in the old imperative `fetchCourseData`.
  useEffect(() => {
    if (!courseQueryData) return;

    setCourseData(courseQueryData);
    const allExercises = collectExercisesWithMetadata(courseQueryData);
    setExercises(allExercises);

    let targetExercise: Exercise | undefined;

    if (exerciseId && allExercises.length > 0) {
      targetExercise = allExercises.find(ex => {
        if (ex._id === exerciseId) return true;
        if (ex.exerciseInformation?.exerciseId === exerciseId) return true;
        if (ex._id && ex._id.includes(exerciseId)) return true;
        if (ex.exerciseInformation?.exerciseId && ex.exerciseInformation.exerciseId.includes(exerciseId)) return true;
        if (ex.exerciseInformation?.exerciseName?.toLowerCase() === exerciseId.toLowerCase()) return true;
        return false;
      });
    }

    if (!targetExercise && allExercises.length > 0) {
      targetExercise = allExercises[0];
    }

    if (targetExercise) {
      setSelectedExercise(targetExercise);
      buildBreadcrumb(targetExercise);

      const studentParticipants = (courseQueryData.batchAndParticipants || [])
        .flatMap((b: any) => b?.users || [])
        .filter((p: Participant) => isStudent(p.user));

      const sortedParticipants = studentParticipants.sort((a: any, b: any) => {
        const aHas = getExerciseAnswersForExercise(a, targetExercise).length > 0;
        const bHas = getExerciseAnswersForExercise(b, targetExercise).length > 0;
        return aHas && !bHas ? -1 : !aHas && bHas ? 1 : 0;
      });

      setParticipants(sortedParticipants);
      calculateGradingStats();
    } else {
      const studentParticipants = (courseQueryData.batchAndParticipants || [])
        .flatMap((b: any) => b?.users || [])
        .filter((p: Participant) => isStudent(p.user));
      setParticipants(studentParticipants);
    }
  }, [courseQueryData, exerciseId]);

  // Thin invalidation helper kept under the legacy name so the rest of the
  // file (e.g. `handleUnlockExercise`) can keep calling `fetchCourseData()`
  // and get a server refetch via React Query without further changes.
  const fetchCourseData = () => {
    if (!courseId) return;
    queryClient.invalidateQueries({
      queryKey: queryKeys.reviewSubmission.courseData(courseId),
    });
  };

  const handleUnlockExercise = async (participantId: string, targetExerciseId: string) => {
    if (!selectedExercise || !courseId) {
      toast.error("Missing course or exercise data");
      return;
    }

    const targetCategory = selectedExercise._category || 'We_Do';
    const targetSubcategory = selectedExercise._subcategory || 'assignments';

    const token = getToken() || '';
    const loadingToast = toast.loading("Unlocking exercise...");

    try {
      const payload = {
        targetUserId: participantId,
        courseId: courseId,
        exerciseId: targetExerciseId,
        category: targetCategory,
        subcategory: targetSubcategory,
        status: 'in-progress',
        isLocked: false,
        reason: "Unlocked by Instructor via Grading Console"
      };

      const response = await fetch(`${BACKEND_API_URL}/exercise/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        toast.dismiss(loadingToast);
        toast.success("Exercise unlocked successfully");
        fetchCourseData();
      } else {
        throw new Error(result.message || "Failed to unlock");
      }
    } catch (error: any) {
      console.error("Unlock error:", error);
      toast.dismiss(loadingToast);
      toast.error(error.message || "Error unlocking exercise");
    }
  };

  const getExerciseAnswersForExercise = (participant: Participant, exercise: Exercise | undefined): ExerciseAnswer[] => {
    if (!exercise) return [];
    const allAnswers = getExerciseAnswers(participant);
    return allAnswers.filter(answer => {
      if (answer.exerciseId === exercise._id) return true;
      if (answer.exerciseId === exercise.exerciseInformation?.exerciseId) return true;
      if (exercise._id && answer.exerciseId.includes(exercise._id)) return true;
      return false;
    });
  };

  const fetchAssessmentVideo = async (participantId: string, exerciseId: string) => {
    if (!selectedExercise || !courseId) {
      toast.error("Missing course or exercise data");
      return null;
    }

    const targetCategory = selectedExercise._category || 'We_Do';
    const targetSubcategory = selectedExercise._subcategory || 'assignments';

    try {
      setIsLoadingVideo(true);
      const token = getToken() || '';
      const response = await fetch(
        `${BACKEND_API_URL}/exercise/status?` +
        `targetUserId=${participantId}&` +
        `courseId=${courseId}&` +
        `exerciseId=${exerciseId}&` +
        `category=${targetCategory}&` +
        `subcategory=${targetSubcategory}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        const screenRecording = result.data?.screenRecording;
        if (screenRecording && screenRecording !== 'empty') {
          if (screenRecording.startsWith('http')) {
            setAssessmentVideoUrl(screenRecording);
          } else {
            setAssessmentVideoUrl(`${BACKEND_API_URL}/${screenRecording}`);
          }
        } else {
          setAssessmentVideoUrl(null);
          toast.info("No screen recording available for this assessment");
        }
      } else {
        setAssessmentVideoUrl(null);
        toast.error("Could not load assessment video");
      }
    } catch (error: any) {
      console.error("Error fetching assessment video:", error);
      setAssessmentVideoUrl(null);
      toast.error(error.message || "Failed to load video");
    } finally {
      setIsLoadingVideo(false);
    }
  };

  const handleViewAssessmentVideo = async (participantId: string, exerciseId: string) => {
    setAssessmentVideoUrl(null);
    setShowVideoModal(true);
    await fetchAssessmentVideo(participantId, exerciseId);
  };

  const renderBreadcrumb = () => (
    <nav aria-label="Breadcrumb" className="flex items-center select-none">
      <ol className="flex items-center flex-wrap gap-y-0.5">
        {breadcrumb.map((item, index) => (
          <li key={index} className="flex items-center" style={{ animationDelay: `${index * 30}ms` }}>
            {index > 0 && <ChevronRight className="h-3 w-3 text-slate-300 mx-0.5 shrink-0" />}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors duration-150 ${index === breadcrumb.length - 1 ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-700 cursor-pointer'}`}
              title={item.title}
            >
              <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">{item.icon}</span>
              <span className={`text-[11px] font-medium ${inter.className} ${index === breadcrumb.length - 1 ? 'text-indigo-600' : 'text-slate-500'}`}>
                {item.title}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );

  const getExerciseAnswers = (participant: Participant): ExerciseAnswer[] => {
    if (!participant.user.courses) return [];
    const course = participant.user.courses.find(c => c.courseId === courseId);
    if (!course || !course.answers) return [];

    const extractAll = (catObj: any): ExerciseAnswer[] => {
      if (!catObj) return [];
      const answers: ExerciseAnswer[] = [];
      if (catObj.assignments && Array.isArray(catObj.assignments)) answers.push(...catObj.assignments);
      // Every spelling variant the writers use:
      //   'assessment'   — current default for code-editor / MCQ / SectionBasedTestPage
      //   'Assessment'   — same key with the leading capital preserved
      //   'assessments'  — plural variant
      //   'assesment' / 'assesments' — legacy typos still in older records
      //   'assignment'   — SINGULAR: what answer.js actually writes for We Do.
      //                    `exerciseKey = subcategory`, and the We_Do
      //                    subcategory is derived from the course label
      //                    "Assignment" -> "assignment". Omitting it made every
      //                    programming submission read as "Not Submitted Yet"
      //                    with "No Code Found" in the editor pane.
      const otherCategories = ['assignment', 'practical', 'project_development', 'assessment', 'Assessment', 'assessments', 'assesments', 'assesment'];
      otherCategories.forEach(cat => {
        if (catObj[cat] && Array.isArray(catObj[cat])) answers.push(...catObj[cat]);
      });
      return answers;
    };

    // Iterate every category (I_Do / We_Do / You_Do — and anything future)
    // instead of hardcoding two. Previously I_Do was missing, so any student
    // whose submission landed under I_Do showed as "Not Submitted Yet" on the
    // review screen even though their files were in Mongo.
    const all: ExerciseAnswer[] = [];
    Object.values(course.answers).forEach((catObj) => {
      all.push(...extractAll(catObj));
    });
    return all;
  };

  const getExerciseAnswersForSelectedExercise = (participant: Participant): ExerciseAnswer[] => {
    const all = getExerciseAnswers(participant);
    if (!selectedExercise) return all;
    // Use the SAME defensive comparison as getExerciseAnswersForExercise above:
    // some submissions store exerciseId as the Exercise document _id, others as
    // exerciseInformation.exerciseId (legacy / different code path). The strict
    // `===` version missed the latter, so those students showed up as
    // "Not Submitted Yet" on the participant list even though their answers
    // were in Mongo. String() coerces ObjectId-vs-string mismatches too.
    const exId = String(selectedExercise._id || "");
    const exInfoId = String(selectedExercise.exerciseInformation?.exerciseId || "");
    return all.filter(a => {
      const aid = String(a.exerciseId || "");
      if (!aid) return false;
      if (exId && aid === exId) return true;
      if (exInfoId && aid === exInfoId) return true;
      if (exId && aid.includes(exId)) return true;
      return false;
    });
  };

  const getSubmissionForQuestion = (questionId: string): SubmissionQuestion | null => {
    if (!selectedParticipant) return null;
    const answers = getExerciseAnswersForSelectedExercise(selectedParticipant);
    for (const answer of answers) {
      const submission = answer.questions.find(q => q.questionId === questionId);
      if (submission) return submission;
    }
    return null;
  };

  const saveFrontendGrade = async (scoreValue: number, feedbackValue: string): Promise<boolean> => {
    if (!selectedQuestion || !selectedParticipant || !selectedExercise || !frontendSubmissionData) {
      toast.error('Missing required data');
      return false;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const token = getToken() || '';
      const categoryToSend = selectedExercise._category || 'We_Do';
      const subcategoryToSend = selectedExercise._subcategory || 'assignments';

      const payload = {
        courseId,
        exerciseId: selectedExercise._id,
        exerciseName: selectedExercise.exerciseInformation.exerciseName,
        participantId: selectedParticipant.user._id,
        questionId: selectedQuestion._id,
        questionTitle: getQuestionTitle(selectedQuestion),
        score: scoreValue,
        totalScore: maxScore,
        feedback: feedbackValue,
        status: 'evaluated',
        language: 'html/css/javascript',
        category: categoryToSend,
        subcategory: subcategoryToSend
      };

      const response = await fetch(`${BACKEND_API_URL}/users/update/submission-score`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok && !result.success) {
        throw new Error(result.message || 'Failed to save grade');
      }

      // Fall back to whichever answer group actually contains this
      // question — `selectedAnswer` is null on many code-editor flows, and
      // the old `if (selectedAnswer)` guard would silently drop the entire
      // local-state patch, leaving Overall Score + input stuck at 0.
      const updatedParticipants = [...participants];
      const pIdx = updatedParticipants.findIndex(p => p._id === selectedParticipant._id);

      if (pIdx !== -1) {
        const participant = updatedParticipants[pIdx];
        const answers = getExerciseAnswers(participant);
        const targetAnswerGroup = selectedAnswer
          ? answers.find(a => a._id === selectedAnswer._id)
          : answers.find(a => a.questions.some(q => q.questionId === selectedQuestion._id));

        if (targetAnswerGroup) {
          const qIdx = targetAnswerGroup.questions.findIndex(q => q.questionId === selectedQuestion._id);
          if (qIdx !== -1) {
            targetAnswerGroup.questions[qIdx] = {
              ...targetAnswerGroup.questions[qIdx],
              score: scoreValue,
              totalScore: maxScore,
              feedback: feedbackValue,
              status: 'evaluated'
            };
          } else {
            // No prior submission row for this question yet — append one so
            // the aggregate picks it up. (Trainer entering a manual score
            // on a not-yet-attempted question is unusual but possible.)
            targetAnswerGroup.questions.push({
              _id: Math.random().toString(),
              questionId: selectedQuestion._id,
              codeAnswer: '',
              language: 'html/css/javascript',
              isCorrect: (scoreValue / (maxScore || 1)) * 100 >= 60,
              score: scoreValue,
              totalScore: maxScore,
              status: 'evaluated',
              attemScore: 0,
              submittedAt: new Date().toISOString(),
              feedback: feedbackValue
            });
          }
          setParticipants(updatedParticipants);
          // Refresh `selectedParticipant` too — the Overall Score header
          // and getSubmissionForQuestion() both read from this sibling
          // state, so without a re-set the display stays at 0/total.
          setSelectedParticipant({ ...updatedParticipants[pIdx] });
        }
      }

      setSaveSuccess(true);
      // Re-lock the input after a successful save — the persisted value is
      // now authoritative; further edits require clicking the pencil again.
      setIsScoreEditable(isManualEvalExercise(selectedExercise));
      // Toast label follows which review flow triggered this save so
      // Programming (multi-file) doesn't get the misleading "Frontend" copy.
      toast.success(isCodeMultiFileReview
        ? 'Programming assessment graded successfully'
        : 'Frontend assessment graded successfully');
      return true;
    } catch (err) {
      console.error('Save frontend grade error:', err);
      toast.error('Failed to save grade');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartGrading = async (participant: Participant) => {
    setSaveSuccess(false);
    setSelectedParticipant(participant);
    setIsFrontendReview(false);
    setIsCodeMultiFileReview(false);
    setFrontendSubmissionData(null);
    setIsOthersReview(false);

    if (!selectedExercise) return;

    const answers = getExerciseAnswersForSelectedExercise(participant);

    let targetQuestion = selectedExercise.questions[0];
    let submissionFound: SubmissionQuestion | null = null;
    let activeAnswerGroup: ExerciseAnswer | null = null;

    if (answers.length > 0) {
      for (const question of selectedExercise.questions) {
        for (const ans of answers) {
          const sub = ans.questions?.find(q =>
            q.questionId === question._id && (q.codeAnswer || q.isCorrect !== undefined || (q.othersFiles && q.othersFiles.length > 0))
          );
          if (sub) {
            targetQuestion = question;
            submissionFound = sub;
            activeAnswerGroup = ans;
            break;
          }
        }
        if (submissionFound) break;
      }

      if (!submissionFound && targetQuestion) {
        for (const ans of answers) {
          const sub = ans.questions?.find(q => q.questionId === targetQuestion._id);
          if (sub) {
            submissionFound = sub;
            activeAnswerGroup = ans;
            break;
          }
        }
      }
    }

    if (targetQuestion) {
      const initMax = getQuestionMaxScore(selectedExercise, targetQuestion);
      const initScore = submissionFound
        ? (isQuestionMCQ(targetQuestion) && submissionFound.status !== 'evaluated'
          ? (submissionFound.isCorrect ? initMax : 0)
          : Math.min(submissionFound.score || 0, initMax))
        : 0;
      setSelectedAnswer(activeAnswerGroup || answers[0] || null);
      setSubmissionQuestion(submissionFound);
      setSelectedQuestion(targetQuestion);
      setScore(initScore);
      setMaxScore(initMax);
      // Pre-graded → locked input; pencil icon unlocks for override.
      setIsScoreEditable(isManualEvalExercise(selectedExercise));
      setFeedbackText(submissionFound?.feedback || '');
      setCurrentQuestionIndex(selectedExercise.questions.findIndex(q => q._id === targetQuestion._id));

      if (isOthersQuestion(targetQuestion, submissionFound)) {
        setIsOthersReview(true);
      } else if (isCoreProgrammingMultiFileQuestion(submissionFound, selectedExercise) && submissionFound) {
        const codeData = extractFrontendSubmissionFromAnswers(participant, targetQuestion._id);
        if (codeData) {
          setFrontendSubmissionData(codeData);
          setIsCodeMultiFileReview(true);
        }
      } else if (isFrontendQuestion(targetQuestion, submissionFound, selectedExercise) && submissionFound) {
        const frontendData = extractFrontendSubmissionFromAnswers(participant, targetQuestion._id);
        if (frontendData) {
          setFrontendSubmissionData(frontendData);
          setIsFrontendReview(true);
        }
      }
    }

    setViewMode('grading');
  };

  const handleStudentChange = (id: string) => {
    const p = participants.find(p => p._id === id);
    if (p) handleStartGrading(p);
  };

  const handleNextStudent = () => {
    if (!selectedParticipant) return;
    const idx = participants.findIndex(p => p._id === selectedParticipant._id);
    if (idx < participants.length - 1) {
      handleStartGrading(participants[idx + 1]);
    } else {
      toast.success('End of list');
    }
  };

  const handlePrevStudent = () => {
    if (!selectedParticipant) return;
    const idx = participants.findIndex(p => p._id === selectedParticipant._id);
    if (idx > 0) {
      handleStartGrading(participants[idx - 1]);
    }
  };

  const getCurrentStudentIndex = () =>
    selectedParticipant ? participants.findIndex(p => p._id === selectedParticipant._id) : 0;

  const getTotalStudents = () => participants.length;

  const handleQuestionClick = async (question: ExerciseQuestion, index: number) => {
    setSaveSuccess(false);
    setSelectedQuestion(question);
    setCurrentQuestionIndex(index);
    setIsFrontendReview(false);
    setIsCodeMultiFileReview(false);
    setFrontendSubmissionData(null);
    setIsOthersReview(false);
    // Lock the score input again — the new question's auto-graded value
    // should be displayed read-only until the grader explicitly overrides.
    setIsScoreEditable(isManualEvalExercise(selectedExercise));

    if (selectedExercise) {
      const allowedMax = getQuestionMaxScore(selectedExercise, question);
      setMaxScore(allowedMax);

      const submission = getSubmissionForQuestion(question._id);

      if (submission) {
        setSubmissionQuestion(submission);

        if (isQuestionMCQ(question)) {
          const autoScore = submission.isCorrect ? allowedMax : 0;
          setScore(autoScore);
        } else {
          const existingScore = Math.min(submission.score || 0, allowedMax);
          setScore(existingScore);
        }

        setFeedbackText(submission.feedback || '');

        if (isOthersQuestion(question, submission)) {
          setIsOthersReview(true);
        } else if (isCoreProgrammingMultiFileQuestion(submission, selectedExercise) && selectedParticipant) {
          const codeData = extractFrontendSubmissionFromAnswers(selectedParticipant, question._id);
          if (codeData) {
            setFrontendSubmissionData(codeData);
            setIsCodeMultiFileReview(true);
          }
        } else if (isFrontendQuestion(question, submission, selectedExercise) && selectedParticipant) {
          const frontendData = extractFrontendSubmissionFromAnswers(selectedParticipant, question._id);
          if (frontendData) {
            setFrontendSubmissionData(frontendData);
            setIsFrontendReview(true);
          }
        }
      } else {
        setSubmissionQuestion(null);
        setScore(0);
        setFeedbackText('');
        // Check if question itself is Others type even without submission
        if (isOthersQuestion(question, null)) {
          setIsOthersReview(true);
        }
      }
    }
  };

  const getGradeSettings = (exercise: Exercise | null): any => {
    if (!exercise) return null;
    if ((exercise as any).gradeSettings) return (exercise as any).gradeSettings;
    if (exercise.questionConfiguration?.programmingQuestionConfiguration?.gradeSettings) return exercise.questionConfiguration.programmingQuestionConfiguration.gradeSettings;
    if ((exercise as any).settings?.grade) return (exercise as any).settings.grade;
    return null;
  };

  const getStatusDot = (sub: SubmissionQuestion | null) => {
    if (!sub) return 'bg-slate-300';
    if (sub.status === 'evaluated') return 'bg-emerald-500';
    const hasContent = !!(
      sub.codeAnswer ||
      (sub.othersFiles && sub.othersFiles.length > 0) ||
      (sub.files && sub.files.length > 0) ||
      (sub.isCorrect !== undefined && sub.isCorrect !== null)
    );
    return hasContent ? 'bg-amber-500' : 'bg-slate-300';
  };

  const saveGrade = async (): Promise<boolean> => {
    if (isQuestionMCQ(selectedQuestion)) {
      if (!selectedQuestion || !selectedParticipant || !selectedExercise) {
        toast.error('Missing required data');
        return false;
      }

      setIsSaving(true);
      setSaveSuccess(false);

      try {
        const token = getToken() || '';
        const categoryToSend = selectedExercise._category || 'We_Do';
        const subcategoryToSend = selectedExercise._subcategory || 'assignments';

        const payload = {
          courseId,
          exerciseId: selectedExercise._id,
          exerciseName: selectedExercise.exerciseInformation.exerciseName,
          participantId: selectedParticipant.user._id,
          questionId: selectedQuestion._id,
          questionTitle: getQuestionTitle(selectedQuestion),
          score,
          totalScore: maxScore,
          feedback: feedbackText,
          status: 'evaluated',
          language: 'text',
          category: categoryToSend,
          subcategory: subcategoryToSend
        };

        const response = await fetch(`${BACKEND_API_URL}/users/update/submission-score`, {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok && !result.success) {
          throw new Error(result.message || 'Failed to save feedback');
        }

        const updatedParticipants = [...participants];
        const pIdx = updatedParticipants.findIndex(p => p._id === selectedParticipant._id);

        if (pIdx !== -1) {
          const participant = updatedParticipants[pIdx];
          const answers = getExerciseAnswers(participant);
          // Fall back to the group containing this question — same fix as
          // saveFrontendGrade / non-MCQ saveGrade: the old `selectedAnswer
          // ? ... : -1` guard nuked the refresh when selectedAnswer was
          // null, leaving Overall Score stuck at 0/total.
          const targetAnswerGroup = selectedAnswer
            ? answers.find(a => a._id === selectedAnswer._id)
            : answers.find(a => a.questions.some(q => q.questionId === selectedQuestion._id));

          if (targetAnswerGroup) {
            const qIdx = targetAnswerGroup.questions.findIndex(q => q.questionId === selectedQuestion._id);
            if (qIdx !== -1) {
              targetAnswerGroup.questions[qIdx] = {
                ...targetAnswerGroup.questions[qIdx],
                score,
                totalScore: maxScore,
                feedback: feedbackText,
                status: 'evaluated'
              };
            }
            setParticipants(updatedParticipants);
            // Also refresh `selectedParticipant` — the Overall Score header
            // and getSubmissionForQuestion() both read from this separate
            // state, so without a re-set they keep the stale pre-save copy
            // and the display never advances off "0 / total".
            setSelectedParticipant({ ...updatedParticipants[pIdx] });
          }
        }

        setSaveSuccess(true);
        toast.success('Feedback saved successfully');
        return true;
      } catch (err) {
        console.error('Save feedback error:', err);
        toast.error('Failed to save feedback');
        return false;
      } finally {
        setIsSaving(false);
      }
    }

    if (!selectedQuestion || !selectedParticipant || !selectedExercise) {
      toast.error('Missing required data');
      return false;
    }

    if (score > maxScore) {
      toast.error(`Score cannot exceed ${maxScore}`);
      setScore(maxScore);
      return false;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const token = getToken() || '';
      let submissionLanguage = 'plaintext';
      const answers = getExerciseAnswers(selectedParticipant);
      const targetAnswerGroup = selectedAnswer ||
        answers.find(a => a.questions.some(q => q.questionId === selectedQuestion._id));

      if (targetAnswerGroup) {
        const qSub = targetAnswerGroup.questions.find(q => q.questionId === selectedQuestion._id);
        if (qSub && qSub.language) submissionLanguage = qSub.language;
      }

      const categoryToSend = selectedExercise._category || 'We_Do';
      const subcategoryToSend = selectedExercise._subcategory || 'assignments';

      const payload = {
        courseId,
        exerciseId: selectedExercise._id,
        exerciseName: selectedExercise.exerciseInformation.exerciseName,
        participantId: selectedParticipant.user._id,
        questionId: selectedQuestion._id,
        questionTitle: getQuestionTitle(selectedQuestion),
        score,
        totalScore: maxScore,
        feedback: feedbackText,
        status: 'evaluated',
        language: submissionLanguage,
        category: categoryToSend,
        subcategory: subcategoryToSend
      };

      const response = await fetch(`${BACKEND_API_URL}/users/update/submission-score`, {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok && !result.success) {
        throw new Error(result.message || 'Failed to save');
      }

      const updatedParticipants = [...participants];
      const pIdx = updatedParticipants.findIndex(p => p._id === selectedParticipant._id);

      if (pIdx !== -1) {
        const participant = updatedParticipants[pIdx];
        const answers = getExerciseAnswers(participant);
        // Fall back to the answer group that ACTUALLY contains this
        // question — the old `selectedAnswer ? ... : -1` gate silently
        // dropped the whole patch (and the selectedParticipant refresh)
        // whenever selectedAnswer was null, which happens routinely on the
        // Programming code-editor flow. Same failure mode as saveFrontendGrade.
        const targetAnswerGroup = selectedAnswer
          ? answers.find(a => a._id === selectedAnswer._id)
          : answers.find(a => a.questions.some(q => q.questionId === selectedQuestion._id));

        if (targetAnswerGroup) {
          const qIdx = targetAnswerGroup.questions.findIndex(q => q.questionId === selectedQuestion._id);

          if (qIdx !== -1) {
            targetAnswerGroup.questions[qIdx] = {
              ...targetAnswerGroup.questions[qIdx],
              score,
              totalScore: maxScore,
              feedback: feedbackText,
              isCorrect: (score / maxScore) * 100 >= 60,
              status: 'evaluated'
            };
          } else {
            targetAnswerGroup.questions.push({
              _id: Math.random().toString(),
              questionId: selectedQuestion._id,
              codeAnswer: "",
              language: submissionLanguage,
              isCorrect: (score / maxScore) * 100 >= 60,
              score,
              totalScore: maxScore,
              status: 'evaluated',
              attemScore: 0,
              submittedAt: new Date().toISOString(),
              feedback: feedbackText
            });
          }

          setParticipants(updatedParticipants);
          // Same reason as the MCQ branch — `selectedParticipant` is a
          // sibling state and drives Overall Score + re-hydration on
          // navigation, so refresh it too or the input reverts to 0.
          setSelectedParticipant({ ...updatedParticipants[pIdx] });
        }
      }

      setSaveSuccess(true);
      // Re-lock the input after a successful save — the persisted value is
      // now authoritative; further edits require clicking the pencil again.
      setIsScoreEditable(isManualEvalExercise(selectedExercise));
      return true;
    } catch (err) {
      console.error('Save grade error:', err);
      toast.error('Failed to save');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndNext = async () => {
    if (await saveGrade()) {
      setTimeout(() => {
        if (selectedExercise && currentQuestionIndex < selectedExercise.questions.length - 1) {
          handleQuestionClick(
            selectedExercise.questions[currentQuestionIndex + 1],
            currentQuestionIndex + 1
          );
        } else {
          if (getCurrentStudentIndex() < getTotalStudents() - 1) {
            handleNextStudent();
          } else {
            toast.success('All graded!');
            // Single-student mode has no list to fall back to — return to
            // the Live Dashboard the user came from.
            if (isSingleStudentMode) handleBack();
            else setViewMode('list');
          }
        }
      }, 800);
    }
  };

  const handleBack = () => {
    // Single-student mode came from the Live Dashboard. Route back there
    // so the user lands in their original context (the student list with
    // the same selected node + assessment). Forward the originating params
    // so the dashboard can rebuild itself without another LS lookup.
    if (returnToParam === 'liveDashboard') {
      const params = new URLSearchParams();
      // Copy the context params the dashboard needs back.
      const passthrough = [
        'courseId', 'nodeId', 'nodeType', 'moduleName', 'submoduleName',
        'topicName', 'subtopicName', 'tabType', 'subcategory',
      ];
      for (const key of passthrough) {
        const v = searchParams.get(key);
        if (v) params.set(key, v);
      }
      // The dashboard reads either assessmentId or exerciseId — pass both
      // for safety, mirroring how `goBackToCourses` was built on the
      // dashboard side.
      const exId = searchParams.get('exerciseId');
      if (exId) { params.set('assessmentId', exId); params.set('exerciseId', exId); }
      router.push(`/lms/pages/courses/liveDashboard?${params.toString()}`);
      return;
    }
    // Legacy path: bounce back to the courses upload page with the
    // localStorage-restore flag so the user lands in the right node + tab.
    const params = new URLSearchParams(window.location.search);
    params.set('fromAnalytics', 'true');
    // Promote the "source" context to the "active" fields upload page reads.
    // Without this, back navigation always dropped the trainer onto I Do /
    // the default subcategory even when they'd opened the review from
    // We Do / You Do — because `sourceTab` was preserved but ignored.
    const srcTab = params.get('sourceTab');
    const srcSub = params.get('sourceSubcategory');
    if (srcTab) params.set('activeTab', srcTab);
    if (srcSub) params.set('activeSubcategory', srcSub);
    router.push(`${sectionHref('uploadcourseresources')}?${params.toString()}`);
  };

  const initiateRunCode = async () => {
    if (!submissionQuestion?.codeAnswer) {
      toast.error('No code to execute');
      return;
    }

    const lang = submissionQuestion.language || 'javascript';
    setExecutionLanguage(lang);
    setShowTerminal(true);
    clearTerminal();

    if (lang === 'python') {
      if (!pyodideReady) {
        toast.loading("Loading Python...", { duration: 2000 });
        await initEngines();
      }

      setIsExecuting(true);
      addLog('system', 'Initializing Python...');

      try {
        pyodideRef.current.setStdout({ batched: (msg: string) => addLog('stdout', msg) });
        pyodideRef.current.setStderr({ batched: (msg: string) => addLog('stderr', msg) });

        const preamble = `
import js
import asyncio
import builtins

async def _async_input(prompt=""):
    if prompt: print(prompt, end="")
    return await js.getReactInput()

builtins.input = _async_input
`;

        await pyodideRef.current.runPythonAsync(
          preamble + "\n" + submissionQuestion.codeAnswer.replace(/input\s*\(/g, "await input(")
        );

        addLog('system', 'Execution Finished');
      } catch (err: any) {
        addLog('stderr', err.message || String(err));
      } finally {
        setIsExecuting(false);
        setIsWaitingForInput(false);
      }

      return;
    }

    setIsExecuting(true);
    addLog('system', `Preparing ${lang}...`);

    const needsInput = ['java', 'c', 'cpp'].some(l => lang.includes(l)) &&
      (submissionQuestion.codeAnswer.includes('Scanner') ||
        submissionQuestion.codeAnswer.includes('scanf') ||
        submissionQuestion.codeAnswer.includes('cin'));

    let stdin = "";
    if (needsInput) {
      addLog('system', 'Batch Input Required. Enter inputs separated by spaces/newlines.');
      setIsWaitingForInput(true);
      stdin = await new Promise<string>((resolve) => {
        inputResolverRef.current = resolve;
      });
      addLog('system', 'Input received.');
    }

    try {
      const getPistonLang = (l: string) => {
        const langMap: { [key: string]: any } = {
          javascript: { language: "javascript", version: "18.15.0" },
          java: { language: "java", version: "15.0.2" },
          cpp: { language: "cpp", version: "10.2.0" },
          c: { language: "c", version: "10.2.0" },
          python: { language: "python", version: "3.10.0" }
        };
        return langMap[l] || { language: "javascript", version: "18.15.0" };
      };

      const config = getPistonLang(lang);
      const res = await fetch(PISTON_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: config.language,
          version: config.version,
          files: [{ content: submissionQuestion.codeAnswer }],
          stdin
        })
      });

      const data = await res.json();
      if (data.run) {
        if (data.run.stdout) addLog('stdout', data.run.stdout);
        if (data.run.stderr) addLog('stderr', data.run.stderr);
        addLog('system', `Exited (Time: ${data.run.time || 0}ms)`);
      } else {
        addLog('stderr', 'Execution failed.');
      }
    } catch (err: any) {
      addLog('stderr', `Execution failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
      setIsWaitingForInput(false);
    }
  };

  // Helper: compute submission status for a participant
  const getParticipantStatus = (p: Participant): 'not_submitted' | 'review' | 'evaluated' => {
    const answers = getExerciseAnswersForSelectedExercise(p);
    const hasSubmissions = answers.length > 0;
    if (!hasSubmissions) return 'not_submitted';

    const allQuestions = selectedExercise?.questions || [];
    const isPureMCQ = selectedExercise?.exerciseType === 'MCQ' ||
      (allQuestions.length > 0 && allQuestions.every(q => isQuestionMCQ(q)));

    let totalAnsweredQuestions = 0;
    allQuestions.forEach(question => {
      const sub = (() => {
        for (const ans of answers) {
          const s = ans.questions.find(q => q.questionId === question._id);
          if (s) return s;
        }
        return null;
      })();
      const hasAnswer = !!(sub?.codeAnswer || sub?.files?.length || sub?.othersFiles?.length ||
        (sub && sub.isCorrect !== undefined && sub.isCorrect !== null));
      if (sub && hasAnswer) totalAnsweredQuestions++;
    });
    const allQuestionsAnswered = totalAnsweredQuestions === allQuestions.length;

    let isEval = false;
    if (isPureMCQ) {
      isEval = allQuestionsAnswered && hasSubmissions;
    } else {
      let allProgEval = true;
      allQuestions.forEach(question => {
        const sub = (() => {
          for (const ans of answers) {
            const s = ans.questions.find(q => q.questionId === question._id);
            if (s) return s;
          }
          return null;
        })();
        if (!isQuestionMCQ(question)) {
          if (sub?.status !== 'evaluated') allProgEval = false;
        } else {
          const hasAns = !!(sub?.codeAnswer || sub?.files?.length ||
            (sub && sub.isCorrect !== undefined && sub.isCorrect !== null));
          if (!hasAns) allProgEval = false;
        }
      });
      isEval = allProgEval && allQuestionsAnswered;
    }

    return isEval ? 'evaluated' : 'review';
  };

  // Filtered participants - only students
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      // search filter
      if (search) {
        const fullName = `${p.user.firstName} ${p.user.lastName}`.toLowerCase();
        const email = p.user.email.toLowerCase();
        const searchLower = search.toLowerCase();
        if (!fullName.includes(searchLower) && !email.includes(searchLower)) return false;
      }
      // status filter
      if (statusFilter !== 'all') {
        const status = getParticipantStatus(p);
        if (status !== statusFilter) return false;
      }
      return true;
    });
  }, [participants, search, statusFilter, selectedExercise]);

  // Pagination slice + page-count derived from the filtered list
  const totalPages = Math.max(1, Math.ceil(filteredParticipants.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const paginatedParticipants = filteredParticipants.slice(pageStart, pageStart + PAGE_SIZE);
  // Reset to page 1 when the filter/search/exercise changes so we never land
  // on an out-of-range page.
  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, selectedExercise]);

  const filteredQuestions = useMemo(() => {
    if (!selectedExercise) return [];
    return difficultyFilter === 'all'
      ? selectedExercise.questions
      : selectedExercise.questions.filter(q =>
        getQuestionDisplayDifficulty(q) === difficultyFilter.toLowerCase()
      );
  }, [selectedExercise, difficultyFilter]);

  // Calculate stats for display
  const enrollmentCount = participants.length;
  const submissionsCount = participants.filter(p => {
    const answers = getExerciseAnswersForSelectedExercise(p);
    return answers.length > 0 && answers.some(a => a.questions && a.questions.length > 0);
  }).length;
  const evaluatedCount = participants.filter(p => {
    const answers = getExerciseAnswersForSelectedExercise(p);
    return answers.some(a => a.questions.some(q => q.status === 'evaluated'));
  }).length;
  const pendingCount = submissionsCount - evaluatedCount;

  // --- RENDER LOADING ---
  // Show the full-page spinner during the initial data fetch. In
  // single-student mode we ALSO keep the spinner up until the auto-grade
  // effect has finished selecting the participant — otherwise the grading
  // view renders for one render with `selectedParticipant: null` and
  // momentarily shows an empty header/breadcrumb.
  if (loading || (isSingleStudentMode && !selectedParticipant)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  // --- RENDER NO EXERCISE FOUND ---
  if (!selectedExercise) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-slate-500 p-6">
        <AlertCircle className="w-16 h-16 mb-4 text-slate-400" />
        <h3 className={`text-xl font-bold text-slate-700 mb-3 ${inter.className}`}>
          Exercise Not Found
        </h3>
        <p className="mb-6 max-w-md text-center text-slate-600">
          The requested exercise could not be found.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" onClick={handleBack} className={`${inter.className}`}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back to Course
          </Button>
          {exercises.length > 0 && (
            <Button onClick={() => {
              setSelectedExercise(exercises[0]);
              buildBreadcrumb(exercises[0]);
              calculateGradingStats();
            }} className={`bg-indigo-600 hover:bg-indigo-700 ${inter.className}`}>
              Load First Available Exercise
            </Button>
          )}
        </div>
      </div>
    );
  }

  // --- MAIN RENDER ---
  return (
    <div className={`h-screen flex flex-col bg-white overflow-hidden ${inter.className}`}>
      <Toaster position="top-center" richColors />
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"
        onLoad={initEngines}
        strategy="afterInteractive"
      />

      <InteractiveTerminal
        isOpen={showTerminal}
        onClose={() => setShowTerminal(false)}
        logs={terminalLogs}
        isRunning={isExecuting}
        isWaitingForInput={isWaitingForInput}
        onInputSubmit={handleTerminalInput}
        language={executionLanguage}
        onClear={clearTerminal}
      />

      {/* HEADER */}
      <div className="flex-none z-50 border-b border-slate-100 bg-white px-6 py-2.5">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 flex-1 mr-4 min-w-0">
            {viewMode !== 'grading' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBack}
                className="h-6 w-6 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            )}
            {renderBreadcrumb()}
          </div>
          <div className="flex items-center shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchCourseData}
              className={`h-7 px-3 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors ${inter.className}`}
            >
              <RefreshCw className={`h-3 w-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-hidden relative">
        {/* In single-student mode the list view is suppressed entirely. The
            auto-grade effect above flips viewMode to 'grading' as soon as
            data lands; until then we render a lightweight loading frame
            instead of momentarily flashing the participants table. */}
        {(viewMode === 'list' && !isSingleStudentMode) ? (
          /* STUDENT LIST VIEW */
          <div className="flex flex-col h-full bg-white">
            {/* Search Bar */}
            <div className="flex-none px-6 py-5 border-b border-slate-100 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className={`text-lg font-bold text-slate-900 mb-1 ${inter.className}`}>
                    Repository Review
                  </h1>
                  <div className={`flex items-center gap-3 text-xs ${inter.className}`}>
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-600">ID:</span> {selectedExercise.exerciseInformation.exerciseId}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">
                      <span className="font-semibold text-slate-600">
                        {selectedExercise._category === 'You_Do' ? 'Assessment Name:' : 'Assignment Name:'}
                      </span>{' '}{selectedExercise.exerciseInformation.exerciseName}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status Filter */}
                  <div className="relative flex items-center">
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none z-10" />
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className={`h-9 pl-8 pr-3 text-xs border border-slate-200 rounded-md bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none cursor-pointer ${inter.className} ${statusFilter !== 'all' ? 'border-indigo-300 text-indigo-600 bg-indigo-50' : ''}`}
                    >
                      <option value="all">All Status</option>
                      <option value="not_submitted">Not Submitted</option>
                      <option value="review">Review</option>
                      <option value="evaluated">Evaluated</option>
                    </select>
                  </div>
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Search students..."
                      className="pl-9 h-9 text-xs w-56 border-slate-200 rounded-md focus:ring-2 focus:ring-indigo-500/20 bg-white"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {/* Rerun — re-score every student's stored code against current test cases */}
                  {selectedExercise?._id && (
                    <RerunButton
                      variant="primary"
                      label="Rerun"
                      title="Re-run scoring for all students against the current test cases"
                      courseId={courseId}
                      exerciseId={selectedExercise._id}
                      category={(selectedExercise._category || 'We_Do') as 'I_Do' | 'We_Do' | 'You_Do'}
                      subcategory={selectedExercise._subcategory || 'assignment'}
                      nodeId={searchParams.get('nodeId') || ''}
                      nodeType={searchParams.get('nodeType') || 'topic'}
                      onCompleted={() => queryClient.invalidateQueries({ queryKey: queryKeys.reviewSubmission.all })}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* STUDENT LIST TABLE — scrolls internally, page controls fixed below */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className={`w-12 px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center ${inter.className}`}>No.</TableHead>
                    <TableHead className={`px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${inter.className}`}>Name</TableHead>
                    <TableHead className={`px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${inter.className}`}>Email</TableHead>
                    {/* Submit Type / Reason only apply to You Do assessments (proctoring + auto-submit), not We Do assignments */}
                    {selectedExercise._category === 'You_Do' && (
                      <>
                        <TableHead className={`px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center ${inter.className}`}>Submit Type</TableHead>
                        <TableHead className={`px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${inter.className}`}>Reason</TableHead>
                      </>
                    )}
                    <TableHead className={`px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${inter.className}`}>Status</TableHead>
                    <TableHead className={`px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center ${inter.className}`}>Submitted Date</TableHead>
                    <TableHead className={`px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center ${inter.className}`}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedParticipants.map((participant, indexInPage) => {
                    const index = pageStart + indexInPage;
                    const getSubmissionForParticipantQuestion = (participant: Participant, questionId: string): SubmissionQuestion | null => {
                      const participantAnswers = getExerciseAnswersForSelectedExercise(participant);
                      for (const answer of participantAnswers) {
                        const submission = answer.questions.find(q => q.questionId === questionId);
                        if (submission) return submission;
                      }
                      return null;
                    };

                    const answers = getExerciseAnswersForSelectedExercise(participant);
                    const hasSubmissions = answers.length > 0;

                    let totalScore = 0;
                    let totalAnsweredQuestions = 0;
                    let allQuestionsAnswered = true;

                    const allQuestions = selectedExercise.questions;

                    allQuestions.forEach(question => {
                      const submission = getSubmissionForParticipantQuestion(participant, question._id);
                      const hasAnswer = !!(
                        submission?.codeAnswer ||
                        submission?.files?.length ||
                        submission?.othersFiles?.length ||
                        (submission && submission.isCorrect !== undefined && submission.isCorrect !== null)
                      );
                      if (submission && hasAnswer) {
                        totalAnsweredQuestions++;
                        const questionMax = getQuestionMaxScore(selectedExercise, question);
                        const subScore = Number(submission.score) || 0;
                        if (submission.status === 'evaluated') {
                          totalScore += Math.min(subScore, questionMax);
                        } else if (isQuestionMCQ(question)) {
                          totalScore += submission.isCorrect ? questionMax : 0;
                        } else {
                          totalScore += Math.min(subScore, questionMax);
                        }
                      } else {
                        allQuestionsAnswered = false;
                      }
                    });

                    const max = getDynamicExerciseTotal(selectedExercise);

                    const isPureMCQ = selectedExercise.exerciseType === 'MCQ' ||
                      (selectedExercise.questions.length > 0 &&
                        selectedExercise.questions.every(q => isQuestionMCQ(q)));

                    let isEvaluated = false;
                    if (isPureMCQ) {
                      isEvaluated = allQuestionsAnswered && hasSubmissions;
                    } else {
                      let allProgrammingEvaluated = true;
                      allQuestions.forEach(question => {
                        const submission = getSubmissionForParticipantQuestion(participant, question._id);
                        if (!isQuestionMCQ(question)) {
                          if (submission?.status !== 'evaluated') {
                            allProgrammingEvaluated = false;
                          }
                        } else {
                          const hasAns = !!(
                            submission?.codeAnswer ||
                            submission?.files?.length ||
                            (submission && submission.isCorrect !== undefined && submission.isCorrect !== null)
                          );
                          if (!hasAns) allProgrammingEvaluated = false;
                        }
                      });
                      isEvaluated = allProgrammingEvaluated && allQuestionsAnswered;
                    }

                    let passFailStatus: 'pass' | 'fail' | 'pending' = 'pending';
                    if (hasSubmissions && allQuestionsAnswered) {
                      const percentage = (totalScore / max) * 100;
                      passFailStatus = percentage >= 50 ? 'pass' : 'fail';
                    }

                    return (
                      <TableRow key={participant._id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors group">
                        <TableCell className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold text-slate-400 group-hover:text-indigo-500 ${inter.className}`}>
                            {String(index + 1).padStart(2, '0')}
                          </span>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 bg-slate-800 flex items-center justify-center text-white text-[10px] font-bold rounded-md shadow-sm ${inter.className}`}>
                              {participant.user.firstName[0]}{participant.user.lastName[0]}
                            </div>
                            <span className={`text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors ${inter.className}`}>
                              {participant.user.firstName} {participant.user.lastName}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <span className="text-xs text-slate-500 font-medium">
                            {participant.user.email}
                          </span>
                        </TableCell>
                        {/* Submit Type / Reason only apply to You Do assessments (proctoring + auto-submit), not We Do assignments */}
                        {selectedExercise._category === 'You_Do' && (
                          <>
                            {/* Submit Type — USER (manual) vs AUTO (system auto-submit) */}
                            <TableCell className="px-4 py-3 text-center">
                              {hasSubmissions ? (
                                answers[0]?.submitType === 'AUTO' ? (
                                  <Badge className={`font-bold text-[9px] uppercase tracking-wider py-0.5 px-2 border-none rounded bg-rose-50 text-rose-600 ${inter.className}`}>
                                    AUTO
                                  </Badge>
                                ) : (
                                  <Badge className={`font-bold text-[9px] uppercase tracking-wider py-0.5 px-2 border-none rounded bg-emerald-50 text-emerald-600 ${inter.className}`}>
                                    USER
                                  </Badge>
                                )
                              ) : (
                                <span className={`text-[10px] text-slate-400 ${inter.className}`}>—</span>
                              )}
                            </TableCell>
                            {/* Reason — stored auto-submit reason for AUTO; otherwise a dash */}
                            <TableCell className="px-4 py-3">
                              {hasSubmissions && answers[0]?.submitType === 'AUTO' && answers[0]?.autoSubmitReason ? (
                                <span className={`text-xs text-slate-600 ${inter.className}`}>
                                  {answers[0].autoSubmitReason}
                                </span>
                              ) : (
                                <span className={`text-[10px] text-slate-400 ${inter.className}`}>—</span>
                              )}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="px-4 py-3">
                          {hasSubmissions ? (
                            <Badge className={`font-bold text-[9px] uppercase tracking-wider py-0.5 px-2 border-none rounded ${isEvaluated ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"} ${inter.className}`}>
                              {isEvaluated ? 'Evaluated' : 'Review'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className={`text-[9px] uppercase tracking-wider font-bold text-slate-400 bg-slate-50 border-slate-200 py-0.5 px-2 rounded ${inter.className}`}>
                              Not Submitted
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-center">
                          {hasSubmissions && answers[0]?.createdAt ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-xs text-slate-700 ${inter.className}`}>
                                {new Date(answers[0].createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                              <span className={`text-[10px] text-slate-600 ${inter.className}`}>
                                {(() => { const d = new Date(answers[0].createdAt); const h = d.getHours(); const m = String(d.getMinutes()).padStart(2,'0'); const ampm = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return `${h12}:${m} ${ampm}`; })()}
                              </span>
                              {answers[0].lateSubmission && (
                                <span className={`mt-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-full ${inter.className}`}>
                                  Late Submission
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className={`text-[10px] text-slate-500 ${inter.className}`}>—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            {!hasSubmissions ? (
                              <Button
                                size="sm"
                                disabled
                                className={`h-8 w-36 text-[10px] font-bold rounded-md shadow-sm bg-red-100 text-red-500 border border-red-200 cursor-not-allowed ${inter.className}`}
                              >
                                Not Submitted Yet
                              </Button>
                            ) : (isEvaluated || isNonGraded) ? (
                              <Button
                                size="sm"
                                onClick={() => handleStartGrading(participant)}
                                className={`h-8 w-36 text-[10px] font-bold rounded-md transition-all shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white border-transparent ${inter.className}`}
                              >
                                View Details
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleStartGrading(participant)}
                                className={`h-8 w-36 text-[10px] font-bold rounded-md transition-all shadow-sm bg-orange-500 hover:bg-orange-600 text-white border-transparent ${inter.className}`}
                              >
                                Start Grading
                              </Button>
                            )}

                            {/* Per-row Rerun — only for students who actually submitted */}
                            {hasSubmissions && selectedExercise?._id && (
                              <RerunButton
                                variant="icon"
                                title={`Re-run scoring for ${participant.user.firstName || participant.user.email}`}
                                courseId={courseId}
                                exerciseId={selectedExercise._id}
                                category={(selectedExercise._category || 'We_Do') as 'I_Do' | 'We_Do' | 'You_Do'}
                                subcategory={selectedExercise._subcategory || 'assignment'}
                                nodeId={searchParams.get('nodeId') || ''}
                                nodeType={searchParams.get('nodeType') || 'topic'}
                                singleUserId={participant.user._id}
                                singleUserName={`${participant.user.firstName || ''} ${participant.user.lastName || ''}`.trim() || participant.user.email}
                                onCompleted={() => queryClient.invalidateQueries({ queryKey: queryKeys.reviewSubmission.all })}
                              />
                            )}
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center shrink-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  className="text-xs font-medium cursor-pointer text-slate-600 focus:text-emerald-600 focus:bg-emerald-50"
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    const pId = participant.user._id;
                                    const exId = selectedExercise._id;
                                    setTimeout(() => handleViewAssessmentVideo(pId, exId), 80);
                                  }}
                                >
                                  <Play className="mr-2 h-3.5 w-3.5" />
                                  <span>Assessment Video</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination footer — fixed at the bottom of the list card, does not scroll with the table */}
            {filteredParticipants.length > 0 && (
              <div className="flex-none flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-white">
                <div className={`text-xs text-slate-500 ${inter.className}`}>
                  Showing <span className="font-semibold text-slate-700">{pageStart + 1}</span>
                  {'–'}
                  <span className="font-semibold text-slate-700">{Math.min(pageStart + PAGE_SIZE, filteredParticipants.length)}</span>
                  {' of '}
                  <span className="font-semibold text-slate-700">{filteredParticipants.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 h-8 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  {(() => {
                    // Render at most 5 page buttons centered on the current page.
                    const windowSize = 5;
                    let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
                    let end = Math.min(totalPages, start + windowSize - 1);
                    start = Math.max(1, end - windowSize + 1);
                    const pages = [];
                    for (let i = start; i <= end; i++) pages.push(i);
                    return pages.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`min-w-[32px] h-8 rounded-md text-xs font-semibold px-2 border ${
                          p === currentPage
                            ? 'bg-orange-500 text-white border-orange-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    ));
                  })()}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 h-8 rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* GRADING VIEW */
          <div className="h-full overflow-hidden bg-white flex flex-col">
            <div className="flex-none border-b border-slate-200 bg-white px-2 py-1">
              <div className="grid grid-cols-3 items-center w-full bg-white px-6 py-3">
                {/* LEFT — Back + Overall Score */}
                <div className="flex items-center gap-4 justify-self-start">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => (isSingleStudentMode ? handleBack() : setViewMode('list'))}
                    className={`h-9 px-4 text-xs font-bold text-slate-600 border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 transition-all duration-200 rounded-full group ${inter.className}`}
                  >
                    <ArrowLeft className="h-3.5 w-3.5 mr-2 text-slate-400 group-hover:text-rose-500 transition-colors" />
                    {isSingleStudentMode ? 'Back to Dashboard' : 'Exit Panel'}
                  </Button>

                  {/* Overall Score — inline, no progress bar */}
                  {!isNonGraded && selectedExercise && selectedParticipant && (() => {
                    const allQuestions = selectedExercise.questions || [];
                    const answers = getExerciseAnswersForSelectedExercise(selectedParticipant);
                    let earned = 0;
                    const total = getDynamicExerciseTotal(selectedExercise);
                    // A student with no submission has no score — showing
                    // "0 / 20" here read as a graded zero (pct 0 also picks the
                    // neutral tone below, so it looked deliberate). Every
                    // sibling cell in the participant table already guards on
                    // hasSubmissions; this header was the one that did not.
                    //
                    // Test for an ANSWERED QUESTION, not for the presence of an
                    // exerciseProgress doc: opening this panel makes the server
                    // mint an empty `status:"in-progress"` record with
                    // `questions: []` for the student being viewed, so
                    // `answers.length > 0` becomes true for people who never
                    // attempted anything.
                    const hasRealAnswer = answers.some(a =>
                      (a.questions || []).some(s =>
                        !!(s?.codeAnswer || s?.files?.length || s?.othersFiles?.length ||
                          (s && s.isCorrect !== undefined && s.isCorrect !== null))
                      )
                    );
                    if (!hasRealAnswer) {
                      return (
                        <div className={`flex items-center gap-2.5 pl-4 border-l border-slate-300 ${inter.className}`}>
                          <Award className="h-5 w-5 text-slate-300" />
                          <div className="flex flex-col leading-none">
                            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-widest mb-1">
                              Overall Score
                            </span>
                            <span className="text-sm font-bold text-slate-400">Not attempted</span>
                          </div>
                        </div>
                      );
                    }
                    allQuestions.forEach(q => {
                      const qMax = getQuestionMaxScore(selectedExercise, q);
                      let sub: SubmissionQuestion | null = null;
                      for (const ans of answers) {
                        const s = ans.questions.find(x => x.questionId === q._id);
                        if (s) { sub = s; break; }
                      }
                      if (!sub) return;
                      const subScore = Number(sub.score) || 0;
                      if (sub.status === 'evaluated') {
                        earned += Math.min(subScore, qMax);
                      } else if (isQuestionMCQ(q)) {
                        earned += sub.isCorrect ? qMax : 0;
                      } else {
                        earned += Math.min(subScore, qMax);
                      }
                    });
                    const pct = total > 0 ? (earned / total) * 100 : 0;
                    const numTone = pct >= 80 ? 'text-emerald-700' : pct >= 60 ? 'text-amber-700' : pct > 0 ? 'text-rose-700' : 'text-slate-900';
                    return (
                      <div className={`flex items-center gap-2.5 pl-4 border-l border-slate-300 ${inter.className}`}>
                        <Award className="h-5 w-5 text-amber-600" />
                        <div className="flex flex-col leading-none">
                          <span className="text-[11px] font-bold text-slate-800 uppercase tracking-widest mb-1">
                            Overall Score
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className={`text-2xl font-extrabold tracking-tight ${numTone}`}>{earned}</span>
                            <span className="text-base font-bold text-slate-700">/</span>
                            <span className="text-lg font-extrabold text-slate-900">{total}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* CENTER — Prev | Student Selector | Next */}
                <div className="flex items-center gap-2 justify-self-center">
                  <Button size="sm" onClick={handlePrevStudent} disabled={getCurrentStudentIndex() === 0} className={`h-9 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-full shadow-sm transition-all ${inter.className}`}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Prev
                  </Button>
                  <Select value={selectedParticipant?._id} onValueChange={handleStudentChange}>
                    <SelectTrigger className={`h-9 border border-slate-200 bg-slate-50 focus:ring-0 px-3 min-w-[220px] text-xs font-bold text-slate-700 justify-between rounded-full hover:border-indigo-300 hover:bg-white transition-all ${inter.className}`}>
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200">
                          <User className="h-3 w-3 text-indigo-500" />
                        </div>
                        <span>
                          {selectedParticipant
                            ? `${selectedParticipant.user.firstName} ${selectedParticipant.user.lastName}`
                            : "Select Student"
                          }
                        </span>
                      </div>
                    </SelectTrigger>
                    <SelectContent align="center" className="max-h-[300px]">
                      {participants.map(p => (
                        <SelectItem key={p._id} value={p._id} className={`text-xs font-medium cursor-pointer py-2 ${inter.className}`}>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                            </div>
                            <span>{p.user.firstName} {p.user.lastName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={handleNextStudent} disabled={getCurrentStudentIndex() === getTotalStudents() - 1} className={`h-9 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 rounded-full shadow-sm transition-all ${inter.className}`}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* RIGHT — spacer */}
                <div className="justify-self-end" />
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* QUESTION SIDEBAR */}
              <div className={`${questionListMinimized ? 'w-14' : 'w-72'} border-r border-slate-100 bg-white transition-all duration-300 flex flex-col`}>
                {!questionListMinimized ? (
                  <>
                    <div className="p-4 border-b border-slate-50 flex-shrink-0">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className={`text-xs font-bold text-slate-700 ${inter.className}`}>
                          Assessment Questions
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => setQuestionListMinimized(true)} className="h-6 w-6 p-0 hover:bg-slate-50 rounded-md text-slate-400">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Label className={`text-xs font-semibold text-slate-700 whitespace-nowrap ${inter.className}`}>
                          Select Level
                        </Label>
                        <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                          <SelectTrigger className="h-8 text-xs font-semibold border-slate-200 rounded-md bg-slate-50/50 flex-1">
                            <SelectValue placeholder="All" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Questions</SelectItem>
                            <SelectItem value="easy">Easy Level</SelectItem>
                            <SelectItem value="medium">Medium Level</SelectItem>
                            <SelectItem value="hard">Hard Level</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-0 py-2 space-y-0 custom-scrollbar">
                      {filteredQuestions.map((question, index) => {
                        const submission = getSubmissionForQuestion(question._id);
                        const isCurrent = selectedQuestion?._id === question._id;
                        const hasSubmission = !!(
                          submission?.codeAnswer ||
                          submission?.files?.length ||
                          submission?.othersFiles?.length ||
                          (submission && submission.isCorrect !== undefined && submission.isCorrect !== null)
                        );
                        const allowedMax = selectedExercise ? getQuestionMaxScore(selectedExercise, question) : question.points || 10;

                        const getDiffStyle = (diff: string) => {
                          switch (diff?.toLowerCase()) {
                            case 'hard': return 'text-rose-600 bg-rose-50 border-rose-100';
                            case 'medium': return 'text-amber-600 bg-amber-50 border-amber-100';
                            default: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
                          }
                        };

                        const qIsMCQ = isQuestionMCQ(question);
                        const qDiff = getQuestionDisplayDifficulty(question);
                        const qLabel = getQuestionLabel(question);
                        const isFrontend = isFrontendQuestion(question, submission);
                        const qIsOthers = isOthersQuestion(question, submission);

                        return (
                          <div key={question._id} onClick={() => handleQuestionClick(question, index)} className={`group flex items-center justify-between gap-3 px-4 py-3 cursor-pointer border-b border-slate-100 last:border-0 transition-colors ${isCurrent ? 'bg-indigo-50' : 'hover:bg-slate-50'} ${!hasSubmission ? 'opacity-90' : ''}`}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDot(submission)}`} />
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${inter.className} ${isCurrent ? 'text-indigo-600' : 'text-slate-400'}`}>{index + 1}.</span>
                                  <span className={`px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wide ${qIsOthers ? 'bg-orange-100 text-orange-600' : isFrontend ? 'bg-emerald-100 text-emerald-600' : qIsMCQ ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {qIsOthers ? 'Others' : isFrontend ? 'Frontend' : qIsMCQ ? 'MCQ' : 'Code'}
                                  </span>
                                </div>
                                <span className={`text-xs font-medium truncate ${isCurrent ? 'text-indigo-900' : 'text-slate-700'}`}>{qLabel}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {qDiff && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getDiffStyle(qDiff)}`}>{qDiff}</span>}
                              {!isNonGraded && (() => {
                                let displayScore = 0;
                                if (submission) {
                                  if (submission.status === 'evaluated') {
                                    displayScore = Number(submission.score) || 0;
                                  } else if (qIsMCQ) {
                                    displayScore = submission.isCorrect ? allowedMax : 0;
                                  } else {
                                    displayScore = Number(submission.score) || 0;
                                  }
                                }
                                return (
                                  <span className={`text-[10px] font-bold ${displayScore > 0 ? 'text-indigo-600' : 'text-slate-400'} ${inter.className}`}>
                                    {displayScore} / {allowedMax}
                                  </span>
                                );
                              })()}
                              {/* Per-row "View Question" trigger — opens the
                                  existing Question Profile modal (which was
                                  wired up but had no trigger anywhere). Stop
                                  propagation so this doesn't also fire the
                                  row's handleQuestionClick. */}
                              <button
                                type="button"
                                title="View question details"
                                aria-label={`View question ${index + 1}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalQuestion(question);
                                  setShowQuestionModal(true);
                                }}
                                className="h-6 w-6 flex items-center justify-center rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center pt-4 space-y-3">
                    <Button variant="ghost" size="sm" onClick={() => setQuestionListMinimized(false)} className="h-8 w-8 rounded-full">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    {selectedExercise?.questions.map((_, index) => {
                      const submission = getSubmissionForQuestion(selectedExercise.questions[index]._id);
                      const hasSubmission = !!(
                        submission?.codeAnswer ||
                        submission?.files?.length ||
                        submission?.othersFiles?.length ||
                        (submission && submission.isCorrect !== undefined && submission.isCorrect !== null)
                      );
                      const isCurrent = selectedQuestion?._id === selectedExercise.questions[index]._id;
                      return (
                        <div key={index} onClick={() => handleQuestionClick(selectedExercise.questions[index], index)} className={`w-8 h-8 flex items-center justify-center rounded-md text-[10px] font-bold transition-all cursor-pointer ${inter.className} ${isCurrent ? 'bg-indigo-600 text-white' : !hasSubmission ? 'bg-rose-50 text-rose-300 border border-rose-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
                          {index + 1}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CENTRAL AREA */}
              <div className="flex-1 overflow-hidden">
                {/* Route to StaffCodeReview when the exercise is Core
                    Programming and the current question isn't MCQ, even if
                    the student never submitted. Keeping the component mounted
                    across question navigation means fullscreen state survives
                    when the trainer jumps to a question with no code. */}
                {selectedQuestion && !isQuestionMCQ(selectedQuestion) && (selectedExercise?.programmingSettings?.selectedModule || "").toLowerCase() === "core programming" ? (
                  <StaffCodeReview
                    // No key — the component stays mounted while the trainer
                    // walks through students and questions, so fullscreen,
                    // theme, sidebar view, terminal height all survive.
                    // Per-submission cleanup inside StaffCodeReview resets
                    // tabs / running / terminal via useEffect on submissionId.
                    submissionId={frontendSubmissionData?._id || `${selectedParticipant?.user?._id || 'p'}-${selectedQuestion._id}`}
                    selectedLanguages={selectedExercise?.programmingSettings?.selectedLanguages || []}
                    files={frontendSubmissionData?.files || []}
                    folders={frontendSubmissionData?.folders || []}
                    questionTitle={getQuestionTitle(selectedQuestion)}
                    submittedAt={frontendSubmissionData?.submittedAt}
                    attemptCount={frontendSubmissionData?.attemptCount}
                    lateSubmission={frontendSubmissionData?.lateSubmission}
                    lastTestSubmittedAt={frontendSubmissionData?.lastTestSubmittedAt}
                    // ── Full question detail — mirrors the multi-file editor
                    // student panel so trainer + student see the same fields
                    // (title, badges, description, sample I/O from testCases,
                    // constraints, hints, MCQ options).
                    questionNode={(() => {
                      const q = selectedQuestion!
                      const qMax = selectedExercise ? getQuestionMaxScore(selectedExercise, q) : (q.points || 0)
                      const qIsMCQ = isQuestionMCQ(q)
                      const desc = getQuestionDescription(q)
                      const rawDesc: any = (q as any)?.description
                      const descHtml = typeof rawDesc === "string"
                        ? rawDesc
                        : (rawDesc && typeof rawDesc.text === "string" ? rawDesc.text : "")
                      // Sample examples — same 3-tier fallback as
                      // multi-file-code-editor.tsx:
                      //   1) testCases with isSample && !isHidden
                      //   2) any non-hidden testCases
                      //   3) legacy sampleInput / sampleOutput
                      const _tcs: any[] = (q as any)?.testCases || []
                      const _explicit = _tcs.filter((tc) => tc.isSample === true && tc.isHidden !== true)
                      const _visible = _explicit.length > 0
                        ? _explicit
                        : _tcs.filter((tc) => tc.isHidden !== true)
                      const examples: Array<{ input: string; output: string; explanation?: string }> = _visible.length > 0
                        ? _visible
                            .map((tc: any) => ({
                              input: tc.input ?? tc.testInput ?? "",
                              output: tc.expectedOutput ?? tc.output ?? tc.expected ?? "",
                              explanation: tc.explanation || undefined,
                            }))
                            .filter((e) => e.input || e.output)
                        : (q.sampleInput || q.sampleOutput)
                          ? [{ input: q.sampleInput || "", output: q.sampleOutput || "" }]
                          : []
                      // Constraints + hints — trainer-side sees ALL hints
                      // (public gate is only for students), so no isPublic
                      // filter here.
                      const constraints: string[] = ((q as any)?.constraints || [])
                        .filter((c: any) => c && (typeof c === "string" ? c.trim() : true))
                        .map((c: any) => (typeof c === "string" ? c : (c.text || String(c))))
                      const hints: string[] = ((q as any)?.hints || [])
                        .map((h: any) => (typeof h === "string" ? h : (h.hintText || h.text || "")))
                        .filter(Boolean)
                      const diffClass = q.difficulty === "easy"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : q.difficulty === "medium"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : q.difficulty === "hard"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                      return (
                        <div className="p-4 flex flex-col gap-4 text-slate-800">
                          {/* Title + badges */}
                          <div>
                            <h2 className="text-sm font-bold mb-2 text-gray-900 leading-snug">
                              {getQuestionTitle(q)}
                            </h2>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${qIsMCQ ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'bg-indigo-100 text-indigo-700 border border-indigo-200'}`}>
                                {qIsMCQ ? 'MCQ' : 'Programming'}
                              </span>
                              {q.difficulty && (
                                <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-semibold border ${diffClass}`}>
                                  {q.difficulty.toUpperCase()}
                                </span>
                              )}
                              {qMax > 0 && (
                                <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99 }} className="bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold">
                                  {qMax} {qMax === 1 ? "mark" : "marks"}
                                </span>
                              )}
                              {!qIsMCQ && q.timeLimit != null && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
                                  Time · {q.timeLimit}s
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Description */}
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <FileText className="w-3.5 h-3.5 text-orange-500" />
                              <h3 className="text-[12px] font-semibold text-gray-900">Description</h3>
                            </div>
                            {descHtml ? (
                              <div
                                className="prose prose-sm max-w-none text-gray-800 text-[12.5px] leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: descHtml }}
                              />
                            ) : desc ? (
                              <p className="text-[12.5px] leading-relaxed text-gray-800 whitespace-pre-wrap">
                                {desc}
                              </p>
                            ) : (
                              <p className="text-[12px] italic text-slate-400">No description provided.</p>
                            )}
                          </div>

                          {/* MCQ options + correct answer highlight */}
                          {qIsMCQ && q.mcqQuestionOptions && q.mcqQuestionOptions.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <h3 className="text-[12px] font-semibold text-gray-900">Options &amp; Correct Answer</h3>
                              </div>
                              <div className="space-y-1.5">
                                {q.mcqQuestionOptions.map((opt: any, idx: number) => {
                                  const isCorrect = opt.isCorrect || (q.mcqQuestionCorrectAnswers || []).includes(opt.text)
                                  return (
                                    <div key={idx} className={`flex items-center gap-2 px-2.5 py-2 rounded border ${isCorrect ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                                      <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${isCorrect ? 'border-emerald-400 text-emerald-700 bg-emerald-100' : 'border-slate-300 text-slate-500'}`}>
                                        {String.fromCharCode(65 + idx)}
                                      </span>
                                      <span className={`text-[12px] flex-1 ${isCorrect ? 'font-semibold text-emerald-800' : 'text-slate-700'}`}>{opt.text}</span>
                                      {isCorrect && <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wide">✓</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Sample Input & Output — testCase-aware */}
                          {examples.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <Terminal className="w-3.5 h-3.5 text-green-500" />
                                <h3 className="text-[12px] font-semibold text-gray-900">Sample Input &amp; Output</h3>
                              </div>
                              <div className="flex flex-col gap-3">
                                {examples.map((ex, ei) => (
                                  <div key={ei}>
                                    <strong className="text-[11px] text-gray-600">Example {ei + 1}</strong>
                                    {ex.input && (
                                      <div className="mt-1">
                                        <div className="text-[10px] font-medium text-gray-700 mb-0.5">Input:</div>
                                        <pre className="bg-gray-50 border border-gray-200 p-2 rounded text-[11px] overflow-x-auto whitespace-pre-wrap font-mono">{ex.input}</pre>
                                      </div>
                                    )}
                                    {ex.output && (
                                      <div className="mt-1.5">
                                        <div className="text-[10px] font-medium text-gray-700 mb-0.5">Output:</div>
                                        <pre className="bg-gray-50 border border-gray-200 p-2 rounded text-[11px] overflow-x-auto whitespace-pre-wrap font-mono">{ex.output}</pre>
                                      </div>
                                    )}
                                    {ex.explanation && (
                                      <div className="mt-1.5 text-[11px] text-slate-600 italic">
                                        {ex.explanation}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Constraints */}
                          {constraints.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                                <h3 className="text-[12px] font-semibold text-gray-900">Constraints</h3>
                              </div>
                              <ul className="list-disc pl-4 text-[11px] text-gray-700 leading-relaxed">
                                {constraints.map((c, i) => <li key={i}>{c}</li>)}
                              </ul>
                            </div>
                          )}

                          {/* Hints */}
                          {hints.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1.5 mb-2">
                                <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                                <h3 className="text-[12px] font-semibold text-gray-900">Hints</h3>
                              </div>
                              {hints.map((h, hi) => (
                                <div key={hi} className="text-[11px] px-2.5 py-1.5 rounded mb-1 bg-orange-50 text-orange-800 border border-orange-100">
                                  💡 {h}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                    // ── Student nav — same handlers the top-bar nav uses,
                    // surfaced inside the review pane for quick access.
                    currentStudentName={selectedParticipant
                      ? `${selectedParticipant.user.firstName || ""} ${selectedParticipant.user.lastName || ""}`.trim() || selectedParticipant.user.email
                      : undefined}
                    studentPosition={`${getCurrentStudentIndex() + 1} / ${getTotalStudents()}`}
                    onPrevStudent={handlePrevStudent}
                    onNextStudent={handleNextStudent}
                    hasPrevStudent={getCurrentStudentIndex() > 0}
                    hasNextStudent={getCurrentStudentIndex() < getTotalStudents() - 1}
                    // ── Question nav — walks the filtered list the sidebar
                    // uses, so filters and inline nav agree on ordering.
                    questionPosition={(() => {
                      const idx = filteredQuestions.findIndex((q) => q._id === selectedQuestion._id)
                      return idx >= 0 ? `${idx + 1} / ${filteredQuestions.length}` : undefined
                    })()}
                    onPrevQuestion={() => {
                      const idx = filteredQuestions.findIndex((q) => q._id === selectedQuestion._id)
                      if (idx > 0) handleQuestionClick(filteredQuestions[idx - 1], idx - 1)
                    }}
                    onNextQuestion={() => {
                      const idx = filteredQuestions.findIndex((q) => q._id === selectedQuestion._id)
                      if (idx >= 0 && idx < filteredQuestions.length - 1) {
                        handleQuestionClick(filteredQuestions[idx + 1], idx + 1)
                      }
                    }}
                    hasPrevQuestion={filteredQuestions.findIndex((q) => q._id === selectedQuestion._id) > 0}
                    hasNextQuestion={(() => {
                      const idx = filteredQuestions.findIndex((q) => q._id === selectedQuestion._id)
                      return idx >= 0 && idx < filteredQuestions.length - 1
                    })()}
                  />
                ) : isFrontendReview && frontendSubmissionData && selectedQuestion ? (
                  <StaffFrontendReview
                    key={selectedQuestion._id}
                    onBack={() => {
                      setIsFrontendReview(false);
                      setFrontendSubmissionData(null);
                    }}
                    submission={{
                      files: frontendSubmissionData.files,
                      folders: frontendSubmissionData.folders,
                      questionId: frontendSubmissionData.questionId,
                      exerciseId: frontendSubmissionData.exerciseId,
                      status: frontendSubmissionData.status,
                      score: frontendSubmissionData.score,
                      feedback: frontendSubmissionData.feedback,
                      submittedAt: frontendSubmissionData.submittedAt,
                      attemptCount: frontendSubmissionData.attemptCount,
                      participantName: frontendSubmissionData.participantName,
                      participantEmail: frontendSubmissionData.participantEmail
                    }}
                    title={getQuestionTitle(selectedQuestion)}
                    initialFiles={frontendSubmissionData.files}
                    initialFolders={frontendSubmissionData.folders}
                    isLoadingSubmission={false}
                    selectedLanguages={selectedExercise?.programmingSettings?.selectedLanguages || ['html', 'css', 'javascript']}
                    questionTitle={getQuestionTitle(selectedQuestion)}
                    questionId={selectedQuestion._id}
                    exerciseId={selectedExercise?._id}
                    exerciseName={selectedExercise?.exerciseInformation?.exerciseName}
                    participantId={selectedParticipant?.user?._id}
                    category={selectedExercise?._category}
                    subcategory={selectedExercise?._subcategory}
                  />
                ) : isOthersReview && selectedQuestion ? (
                  /* OTHERS QUESTION REVIEW */
                  <OthersReviewPanel
                    question={selectedQuestion}
                    submission={submissionQuestion}
                    inter={inter}
                  />
                ) : isQuestionMCQ(selectedQuestion) ? (
                  /* MCQ QUESTION VIEW — type-aware */
                  <div className="h-full overflow-y-auto custom-scrollbar px-6 py-5 space-y-4">
                    {/* Question header */}
                    <div className="bg-slate-100 rounded-xl p-5 border border-slate-200">
                      <h2 className={`text-sm font-semibold text-slate-900 leading-relaxed ${inter.className}`}>
                        <span className="font-bold text-slate-700 mr-1">{currentQuestionIndex + 1}.</span>
                        {getQuestionTitle(selectedQuestion)}
                      </h2>
                      {getQuestionDescription(selectedQuestion) && (
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          {getQuestionDescription(selectedQuestion)}
                        </p>
                      )}
                    </div>

                    {/* No submission */}
                    {!submissionQuestion?.codeAnswer && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-amber-400 bg-amber-50 shadow-sm animate-in fade-in slide-in-from-top-1 duration-300">
                        <div className="h-8 w-8 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <div className={`text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-0.5 ${inter.className}`}>
                            Not Answered
                          </div>
                          <div className="text-xs font-semibold text-amber-900">
                            Student has not submitted an answer for this question
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── MATCHING ── */}
                    {selectedQuestion?.mcqQuestionType === 'matching' && submissionQuestion?.codeAnswer && (() => {
                      let studentPairs: { left: string; right: string }[] = [];
                      try { studentPairs = JSON.parse(submissionQuestion.codeAnswer); } catch {}
                      const correctPairs = selectedQuestion.matchingPairs || [];

                      return (
                        <div className="space-y-2">
                          <p className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ${inter.className}`}>
                            Matching Pairs
                          </p>
                          {/* Column headers */}
                          <div className="grid grid-cols-3 gap-3 px-3 pb-1">
                            <span className={`text-[10px] font-bold text-slate-400 uppercase tracking-wide ${inter.className}`}>Left Item</span>
                            <span className={`text-[10px] font-bold text-slate-400 uppercase tracking-wide ${inter.className}`}>Student's Match</span>
                            <span className={`text-[10px] font-bold text-slate-400 uppercase tracking-wide ${inter.className}`}>Correct Match</span>
                          </div>
                          {correctPairs.map((correctPair, idx) => {
                            const studentPair = studentPairs.find(sp => sp.left === correctPair.left);
                            const studentRight = studentPair?.right ?? '—';
                            const isCorrect = studentRight === correctPair.right;
                            return (
                              <div key={idx} className={`grid grid-cols-3 gap-3 items-center px-4 py-3 rounded-xl border-2 ${isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
                                {/* Left item */}
                                <div className="flex items-center gap-2">
                                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isCorrect ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-200 text-rose-700'}`}>
                                    {String.fromCharCode(65 + idx)}
                                  </span>
                                  <span className="text-sm font-medium text-slate-800">{correctPair.left}</span>
                                </div>
                                {/* Student's answer */}
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{studentRight}</span>
                                  <span className={`text-base font-bold ${isCorrect ? 'text-emerald-500' : 'text-rose-500'}`}>{isCorrect ? '✓' : '✗'}</span>
                                </div>
                                {/* Correct answer */}
                                <div>
                                  <span className="text-sm font-semibold text-emerald-700">{correctPair.right}</span>
                                </div>
                              </div>
                            );
                          })}
                          {/* Summary badge */}
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg mt-1 ${submissionQuestion.isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                            <span className={`text-[11px] font-bold ${submissionQuestion.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {submissionQuestion.isCorrect ? '✓ All pairs correct' : '✗ Some pairs incorrect'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* ── SHORT ANSWER / ESSAY ── */}
                    {(selectedQuestion?.mcqQuestionType === 'short_answer' || selectedQuestion?.mcqQuestionType === 'essay') && submissionQuestion?.codeAnswer && (
                      <div>
                        <p className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ${inter.className}`}>Student's Answer</p>
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{submissionQuestion.codeAnswer}</p>
                        </div>
                        {selectedQuestion.mcqQuestionType === 'short_answer' && (selectedQuestion as any).shortAnswer && (
                          <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            <p className={`text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1 ${inter.className}`}>Expected Answer</p>
                            <p className="text-sm font-semibold text-emerald-800">{(selectedQuestion as any).shortAnswer}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── TRUE / FALSE ── */}
                    {selectedQuestion?.mcqQuestionType === 'true_false' && submissionQuestion?.codeAnswer && (() => {
                      const studentVal = submissionQuestion.codeAnswer.toLowerCase() === 'true';
                      const correctVal = selectedQuestion.trueFalseAnswer;
                      const isCorrect = correctVal !== null && correctVal !== undefined ? studentVal === correctVal : submissionQuestion.isCorrect;
                      return (
                        <div className="space-y-2.5">
                          <p className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ${inter.className}`}>Student's Answer</p>
                          {['true', 'false'].map(val => {
                            const isStudentChoice = submissionQuestion.codeAnswer.toLowerCase() === val;
                            const isCorrectChoice = correctVal !== null && correctVal !== undefined ? (correctVal === (val === 'true')) : (isStudentChoice && submissionQuestion.isCorrect);
                            let cls = 'border-slate-200 bg-white';
                            let label = '';
                            if (isCorrectChoice && isStudentChoice) { cls = 'border-emerald-400 bg-emerald-50'; label = '✓ Correct'; }
                            else if (isCorrectChoice) { cls = 'border-emerald-200 bg-emerald-50/40'; label = 'Correct Answer'; }
                            else if (isStudentChoice) { cls = 'border-rose-400 bg-rose-50'; label = '✗ Wrong'; }
                            return (
                              <div key={val} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 ${cls}`}>
                                <span className="text-sm font-semibold text-slate-800 capitalize">{val}</span>
                                {label && <span className={`text-[10px] font-bold uppercase tracking-wide ${isCorrectChoice ? 'text-emerald-600' : 'text-rose-600'} ${inter.className}`}>{label}</span>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* ── NUMERIC ── */}
                    {selectedQuestion?.mcqQuestionType === 'numeric' && submissionQuestion?.codeAnswer && (() => {
                      const studentNum = parseFloat(submissionQuestion.codeAnswer);
                      const correctNum = selectedQuestion.numericAnswer;
                      const tol = selectedQuestion.numericTolerance ?? 0;
                      const isCorrect = correctNum !== null && correctNum !== undefined
                        ? Math.abs(studentNum - correctNum) <= tol
                        : submissionQuestion.isCorrect;
                      return (
                        <div className="space-y-2">
                          <p className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest ${inter.className}`}>Student's Answer</p>
                          <div className={`flex items-center justify-between px-5 py-4 rounded-xl border-2 ${isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}>
                            <span className={`text-xl font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>{submissionQuestion.codeAnswer}</span>
                            <span className={`text-[11px] font-bold uppercase tracking-wide ${isCorrect ? 'text-emerald-600' : 'text-rose-600'} ${inter.className}`}>
                              {isCorrect ? '✓ Correct' : '✗ Wrong'}
                            </span>
                          </div>
                          {correctNum !== null && correctNum !== undefined && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-50 border border-slate-200">
                              <span className={`text-[10px] text-slate-500 ${inter.className}`}>Correct answer:</span>
                              <span className="text-sm font-bold text-emerald-700">{correctNum}</span>
                              {tol > 0 && <span className="text-[10px] text-slate-400">± {tol}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── ORDERING ── */}
                    {selectedQuestion?.mcqQuestionType === 'ordering' && submissionQuestion?.codeAnswer && (() => {
                      let studentOrder: { itemId: string; order: number }[] = [];
                      try { studentOrder = JSON.parse(submissionQuestion.codeAnswer); } catch {}
                      const correctItems = selectedQuestion.orderingItems || [];
                      const sorted = [...studentOrder].sort((a, b) => a.order - b.order);
                      return (
                        <div className="space-y-2">
                          <p className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ${inter.className}`}>Student's Order</p>
                          {sorted.map((item, idx) => {
                            const matchedItem = correctItems.find(ci => ci._id === item.itemId);
                            const correctItem = correctItems.find(ci => ci.order === idx + 1);
                            const isCorrect = matchedItem && correctItem && matchedItem._id === correctItem._id;
                            return (
                              <div key={idx} className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${isCorrect ? 'bg-emerald-200 text-emerald-700' : 'bg-rose-200 text-rose-700'}`}>{idx + 1}</span>
                                <span className="text-sm font-medium text-slate-800 flex-1">{matchedItem?.text || item.itemId}</span>
                                <span className={`text-base font-bold ${isCorrect ? 'text-emerald-500' : 'text-rose-400'}`}>{isCorrect ? '✓' : '✗'}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* ── MULTIPLE CHOICE / DROPDOWN / CHECKBOXES / default ── */}
                    {(!selectedQuestion?.mcqQuestionType ||
                      ['multiple_choice', 'dropdown', 'checkboxes', 'multiple_select'].includes(selectedQuestion.mcqQuestionType)) &&
                      submissionQuestion?.codeAnswer && (
                      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border ${submissionQuestion.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                        <User className={`h-3.5 w-3.5 shrink-0 ${submissionQuestion.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`} />
                        <span className={`text-xs font-semibold ${submissionQuestion.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>Student answered:</span>
                        <span className={`text-xs font-bold ${submissionQuestion.isCorrect ? 'text-emerald-900' : 'text-rose-900'}`}>"{submissionQuestion.codeAnswer}"</span>
                        <span className={`ml-auto text-[10px] font-bold uppercase tracking-wide ${submissionQuestion.isCorrect ? 'text-emerald-600' : 'text-rose-600'} ${inter.className}`}>
                          {submissionQuestion.isCorrect ? '✓ Correct' : '✗ Wrong'}
                        </span>
                      </div>
                    )}

                    {/* Options list — for multiple_choice / dropdown / checkboxes */}
                    {(!selectedQuestion?.mcqQuestionType ||
                      ['multiple_choice', 'dropdown', 'checkboxes', 'multiple_select'].includes(selectedQuestion.mcqQuestionType)) &&
                      (selectedQuestion?.mcqQuestionOptions || []).length > 0 && (
                      <div className="space-y-2.5">
                        {(selectedQuestion?.mcqQuestionOptions || []).map((option, idx) => {
                          const studentAnswer = submissionQuestion?.codeAnswer || '';
                          const isStudentChoice = !!studentAnswer && option.text.trim() === studentAnswer.trim();
                          const isCorrectOpt = option.isCorrect ||
                            (selectedQuestion?.mcqQuestionCorrectAnswers || []).includes(option.text);

                          let containerCls = 'border-slate-200 bg-white';
                          let labelText = '';
                          let labelCls = '';
                          let letterCls = 'border-slate-300 text-slate-500 bg-slate-50';

                          if (isCorrectOpt && isStudentChoice) {
                            containerCls = 'border-emerald-400 bg-emerald-50';
                            labelText = '✓ Correct Answer';
                            labelCls = 'text-emerald-600 font-bold';
                            letterCls = 'border-emerald-400 text-emerald-700 bg-emerald-100';
                          } else if (isCorrectOpt) {
                            containerCls = 'border-emerald-200 bg-emerald-50/40';
                            labelText = 'Correct Answer';
                            labelCls = 'text-emerald-500 font-medium';
                            letterCls = 'border-emerald-300 text-emerald-600 bg-emerald-50';
                          } else if (isStudentChoice) {
                            containerCls = 'border-rose-400 bg-rose-50';
                            labelText = '✗ Student\'s Choice';
                            labelCls = 'text-rose-600 font-bold';
                            letterCls = 'border-rose-400 text-rose-700 bg-rose-100';
                          }

                          return (
                            <div key={idx} className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border-2 transition-all ${containerCls}`}>
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shrink-0 ${letterCls}`}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span className="text-sm font-medium text-slate-800 leading-snug">{option.text}</span>
                                {option.imageUrl && <img src={option.imageUrl} alt="" className="h-10 w-auto rounded object-contain ml-2" />}
                              </div>
                              {labelText && (
                                <span className={`text-[10px] uppercase tracking-wide shrink-0 ${labelCls} ${inter.className}`}>
                                  {labelText}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* STANDARD MONACO EDITOR VIEW */
                  <div className="h-full flex flex-col">
                    {/* Submission meta strip — Attempt · Submitted · LATE */}
                    {(() => {
                      const meta = getCurrentAnswerMeta();
                      if (!meta) return null;
                      return (
                        <div className="flex items-center justify-end gap-2 px-4 py-2 border-b shrink-0" style={{ background: "#f8f9fa", borderColor: "#e5e7eb" }}>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "#f3f4f6", color: "#374151" }}>
                            Attempt {meta.attemptCount}
                          </span>
                          {meta.submittedAt && (
                            <span className="px-2 py-0.5 rounded text-[11px]" style={{ background: "#f3f4f6", color: "#6b7280" }}>
                              Submitted {new Date(meta.submittedAt).toLocaleString()}
                            </span>
                          )}
                          {meta.lateSubmission && (
                            <span
                              className="px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1 animate-pulse"
                              style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fca5a5" }}
                              title={meta.lastTestSubmittedAt ? `Submitted late at ${new Date(meta.lastTestSubmittedAt).toLocaleString()}` : "Late submission"}
                            >
                              ⚠ LATE SUBMISSION
                              {meta.lastTestSubmittedAt && (
                                <span className="font-medium ml-1" style={{ color: "#7f1d1d" }}>
                                  {new Date(meta.lastTestSubmittedAt).toLocaleString()}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {/* Toolbar — surfaces flip with the editor theme so the
                        toolbar doesn't stay dark over a white editor pane. */}
                    <div className={`flex items-center justify-between px-4 py-2 border-b shrink-0 ${codeIsDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${codeIsDark ? 'text-slate-400' : 'text-slate-600'} ${inter.className}`}>
                          {submissionQuestion?.language || 'Code'}
                        </span>
                        {submissionQuestion?.language && (
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${codeIsDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-200 text-slate-600'} ${inter.className}`}>
                            {submissionQuestion.language}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {submissionQuestion?.codeAnswer && (
                          <Button
                            size="sm"
                            onClick={initiateRunCode}
                            disabled={isExecuting}
                            className={`h-7 px-3 text-[10px] font-bold uppercase tracking-wide bg-emerald-600 hover:bg-emerald-500 text-white rounded-md transition-all ${inter.className}`}
                          >
                            {isExecuting ? (
                              <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Running...</>
                            ) : (
                              <><Play className="w-3 h-3 mr-1.5" />Run Code</>
                            )}
                          </Button>
                        )}
                        {showTerminal ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowTerminal(false)}
                            className={`h-7 px-3 text-[10px] font-bold rounded-md ${codeIsDark ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800' : 'text-slate-600 hover:text-red-600 hover:bg-slate-200'} ${inter.className}`}
                          >
                            <X className="w-3 h-3 mr-1.5" />Console
                          </Button>
                        ) : terminalLogs.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowTerminal(true)}
                            className={`h-7 px-3 text-[10px] font-bold rounded-md ${codeIsDark ? 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800' : 'text-slate-600 hover:text-emerald-700 hover:bg-slate-200'} ${inter.className}`}
                          >
                            <Terminal className="w-3 h-3 mr-1.5" />Console
                          </Button>
                        )}
                        <div className={`flex items-center gap-2 ml-2 pl-2 border-l ${codeIsDark ? 'border-slate-800' : 'border-slate-300'}`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${codeIsDark ? 'text-slate-500' : 'text-slate-600'} ${inter.className}`}>Ready</span>
                          <Separator orientation="vertical" className={`h-3 ${codeIsDark ? 'bg-slate-800' : 'bg-slate-300'}`} />
                          <span className={`text-[9px] font-bold uppercase tracking-widest ${codeIsDark ? 'text-indigo-400' : 'text-indigo-600'} ${inter.className}`}>UTF-8</span>
                          {/* Theme toggle — right-most so it sits at the far
                              right of the code toolbar, matching the user's
                              "theme place rightside" ask. Persists via
                              localStorage; the whole toolbar plus editor,
                              empty state and MonacoEditor `theme` prop all
                              read the same codeIsDark flag. */}
                          <button
                            type="button"
                            onClick={() => setCodeTheme(codeIsDark ? 'vs' : 'vs-dark')}
                            title={codeIsDark ? 'Switch to light theme' : 'Switch to dark theme'}
                            aria-label="Toggle code editor theme"
                            aria-pressed={codeIsDark}
                            className={`ml-1 h-6 w-6 flex items-center justify-center rounded-md transition-colors ${codeIsDark ? 'text-amber-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-200'}`}
                          >
                            {codeIsDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Editor or empty state */}
                    {submissionQuestion?.codeAnswer ? (
                      <div className="flex-1 w-full">
                        <MonacoEditor
                          height="100%"
                          language={getMonacoLanguage(submissionQuestion.language || 'javascript')}
                          theme={codeTheme}
                          value={submissionQuestion.codeAnswer}
                          options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 13,
                            padding: { top: 16, bottom: 16 },
                            lineNumbers: 'on',
                            renderLineHighlight: 'all',
                            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                            fontLigatures: true,
                          }}
                        />
                      </div>
                    ) : (
                      <div className={`flex-1 flex flex-col items-center justify-center text-center ${codeIsDark ? 'bg-slate-950' : 'bg-white'}`}>
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 border ${codeIsDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                          <Code className={`h-6 w-6 ${codeIsDark ? 'text-slate-600' : 'text-slate-400'}`} />
                        </div>
                        <h4 className={`text-sm font-bold uppercase tracking-widest mb-1 ${codeIsDark ? 'text-slate-400' : 'text-slate-600'} ${inter.className}`}>
                          No Code Found
                        </h4>
                        <p className={`text-xs max-w-xs font-medium leading-relaxed ${codeIsDark ? 'text-slate-600' : 'text-slate-500'}`}>
                          The student has not submitted any code for this question yet.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

             {/* GRADING SIDEBAR - Only show when exercise is graded */}
{!isNonGraded && (
  // w-96 (was w-72): the Question Score row's `whitespace-nowrap` label plus
  // the pencil button and the `<input> / maxScore` triplet pushed past 288px
  // as soon as the max hit two digits, producing a horizontal scrollbar
  // instead of wrapping. w-96 fits the row + the Test Case card + Feedback
  // textarea without overflow at every max score in this app.
  <div className="w-96 shrink-0 flex flex-col bg-white min-h-0 border-l border-slate-100 overflow-x-hidden">
    <div className="p-5 flex-1 overflow-y-auto overflow-x-hidden min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-slate-900 [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb:hover]:bg-slate-500" style={{ scrollbarColor: '#475569 #0f172a', scrollbarWidth: 'thin' }}>
      {/* Grading Header */}
      <div>
        <h3 className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 ${inter.className}`}>
          <Award className="h-3.5 w-3.5 text-amber-500" />
          Grading
        </h3>

        {/* Current Question Mark — MCQ (read-only) */}
        {isQuestionMCQ(selectedQuestion) && submissionQuestion && (
          <div className={`mb-4 flex items-center justify-between py-2 ${inter.className}`}>
            <div className="flex items-center gap-2">
              {submissionQuestion.isCorrect
                ? <CheckCircle className="h-5 w-5 text-emerald-600" />
                : submissionQuestion.codeAnswer
                  ? <XCircle className="h-5 w-5 text-rose-600" />
                  : <Lock className="h-5 w-5 text-slate-400" />}
              <span className="text-sm font-bold text-slate-700">Question Score</span>
            </div>
            <span className={`text-xl font-extrabold tracking-tight ${submissionQuestion.isCorrect ? 'text-emerald-700' : submissionQuestion.codeAnswer ? 'text-rose-700' : 'text-slate-500'}`}>
              {submissionQuestion.isCorrect ? maxScore : 0} <span className="text-base text-slate-400 font-bold">/ {maxScore}</span>
            </span>
          </div>
        )}

        {/* Current Question Mark — Programming / Frontend / Code / Others.
            Locked by default: the score is pre-populated from the code-editor's
            auto-grader (`verifyTestCasesAndScore`). The grader clicks the
            pencil icon next to the input to unlock and override the value. */}
        {!isQuestionMCQ(selectedQuestion) && (
          <div className={`mb-4 flex items-center justify-between gap-2 py-2 ${inter.className}`}>
            <span className="text-sm font-bold text-slate-700 whitespace-nowrap">Question Score</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsScoreEditable((v) => !v)}
                title={isScoreEditable ? 'Lock score (auto-corrected)' : 'Edit score (override auto-corrected value)'}
                aria-label={isScoreEditable ? 'Lock score' : 'Edit score'}
                aria-pressed={isScoreEditable}
                className={`flex items-center justify-center h-8 w-8 rounded-md border-2 transition-colors ${
                  isScoreEditable
                    ? 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-indigo-600'
                }`}
              >
                {isScoreEditable
                  ? <Lock className="w-3.5 h-3.5" />
                  : <Pencil className="w-3.5 h-3.5" />}
              </button>
              <Input
                type="number"
                min="0"
                max={maxScore}
                value={score}
                readOnly={!isScoreEditable}
                onChange={(e) => {
                  if (!isScoreEditable) return;
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                  setScore(Math.min(maxScore, Math.max(0, val)));
                }}
                className={`h-10 w-20 border-2 text-lg font-extrabold text-center px-1 ${inter.className} ${
                  isScoreEditable
                    ? 'bg-white border-indigo-300 text-slate-900 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-700 cursor-not-allowed'
                }`}
              />
              <span className="text-lg font-bold text-slate-400">/</span>
              <span className="text-xl font-extrabold text-slate-700 min-w-[28px]">{maxScore}</span>
            </div>
          </div>
        )}

        {/* ── Evaluation Breakdown card ───────────────────────────────────
            Shown when the student's Submit was auto-evaluated (Test Case or
            AI). Purely informational — the trainer's score input above stays
            authoritative; overriding it here keeps the AI/Test Case breakdown
            on the answer document as historical record. */}
        {!isQuestionMCQ(selectedQuestion) && submissionQuestion && (submissionQuestion as any).evaluationBreakdown && (() => {
          const b: any = (submissionQuestion as any).evaluationBreakdown;
          const method = b?.method;
          const isTC = method === 'testcase';
          const isAI = method === 'ai';
          const aiFailed = isAI && !!b?.ai?.failed;
          return (
            <div className={`mb-4 rounded-xl border p-3 ${aiFailed ? 'border-amber-300 bg-amber-50/60' : isAI ? 'border-indigo-200 bg-indigo-50/40' : 'border-emerald-200 bg-emerald-50/40'} ${inter.className}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${aiFailed ? 'bg-amber-100 text-amber-800' : isAI ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}`}>
                  {isAI ? 'AI Evaluation' : 'Test Case Auto-Score'}
                </span>
                {aiFailed && (
                  <span className="text-[10px] font-bold text-amber-700">Grader failed — grade manually</span>
                )}
              </div>
              {isTC && (
                <div className="text-xs font-semibold text-slate-700">
                  Passed <span className="text-emerald-700 font-extrabold">{b?.testcase?.passed ?? 0}</span>
                  {' / '}
                  <span className="text-slate-700">{b?.testcase?.total ?? 0}</span>
                  {' test cases'}
                </div>
              )}
              {isAI && !aiFailed && (
                <div className="space-y-2">
                  {/* Score split summary: two halves that total the score input */}
                  {(Number(b?.ai?.criteriaPortion) > 0 || Number(b?.ai?.testCasePortion) > 0) && (
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 pb-1 border-b border-indigo-100">
                      <span>Criteria portion: <span className="text-indigo-700">{Number(b?.ai?.criteriaPortion || 0).toFixed(2)}</span></span>
                      <span>Test-case portion: <span className="text-indigo-700">{Number(b?.ai?.testCasePortion || 0).toFixed(2)}</span></span>
                    </div>
                  )}

                  {Array.isArray(b?.ai?.criteria) && b.ai.criteria.length > 0 && b.ai.criteria.map((c: any, i: number) => {
                    const label = ({
                      correctness: 'Correctness',
                      codeQuality: 'Code Quality',
                      efficiency: 'Efficiency',
                      readability: 'Readability',
                      edgeCases: 'Edge Cases',
                      bestPractices: 'Best Practices',
                    } as Record<string, string>)[c.key] || c.key;
                    const pct = Math.max(0, Math.min(100, Number(c.percentage) || 0));
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 mb-0.5">
                          <span>{label}</span>
                          <span>
                            <span className="text-slate-900">{pct}%</span>
                            <span className="text-slate-400 mx-1">·</span>
                            <span className="text-indigo-700">{Number(c.score || 0).toFixed(2)}</span>
                            <span className="text-slate-400"> / {Number(b?.ai?.perCriterionMax || 0).toFixed(2)}</span>
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div className="h-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                        {c.comment && (
                          <p className="text-[10.5px] italic text-slate-600 mt-0.5">{c.comment}</p>
                        )}
                      </div>
                    );
                  })}

                  {/* AI Test Cases — expandable panel. Shows count + one row per
                      case (question-authored vs AI-generated), the AI's verdict,
                      and its 1-line comment. */}
                  {Array.isArray(b?.ai?.testCases) && b.ai.testCases.length > 0 && (
                    <details className="mt-2 rounded-lg border border-indigo-100 bg-white">
                      <summary className="cursor-pointer px-2 py-1.5 text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span>AI Test Cases</span>
                        <span>
                          <span className="text-emerald-700">{b.ai.passedTestCases}</span>
                          <span className="text-slate-400"> / {b.ai.totalTestCases} passed</span>
                        </span>
                      </summary>
                      <div className="border-t border-indigo-100 max-h-[240px] overflow-y-auto divide-y divide-slate-100">
                        {b.ai.testCases.map((tc: any, i: number) => (
                          <div key={i} className="px-2 py-1.5 text-[10px]">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="font-bold text-slate-700">#{(tc.index ?? i) + 1}</span>
                              <span className="flex items-center gap-1.5">
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${tc.source === 'ai' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                  {tc.source === 'ai' ? 'AI' : 'Q'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${tc.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                  {tc.passed ? '✓ Pass' : '✗ Fail'}
                                </span>
                              </span>
                            </div>
                            {tc.input && (
                              <div className="text-slate-500"><span className="font-semibold text-slate-600">input:</span> <span className="font-mono break-all">{tc.input.length > 80 ? tc.input.slice(0, 80) + '…' : tc.input}</span></div>
                            )}
                            {tc.expectedOutput && (
                              <div className="text-slate-500"><span className="font-semibold text-slate-600">expected:</span> <span className="font-mono break-all">{tc.expectedOutput.length > 80 ? tc.expectedOutput.slice(0, 80) + '…' : tc.expectedOutput}</span></div>
                            )}
                            {tc.comment && (
                              <div className="italic text-slate-500 mt-0.5">{tc.comment}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {b?.ai?.model && (
                    <p className="text-[9px] text-slate-400 mt-1">Model: {b.ai.model}</p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Feedback Section */}
        <div className="flex-1 flex flex-col min-h-0 bg-indigo-50/40 border border-indigo-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-[11px] font-bold text-indigo-700 uppercase tracking-widest flex items-center gap-1.5 ${inter.className}`}>
              <MessageSquare className="h-3.5 w-3.5 text-indigo-600" />
              Feedback
            </h3>
            <span className={`text-[9px] font-semibold text-indigo-500 uppercase tracking-wide ${inter.className}`}>
              Required
            </span>
          </div>
          <Textarea
            placeholder="✍ Write your feedback for the student here..."
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            className="flex-1 min-h-[140px] bg-white border-2 border-indigo-200 rounded-lg p-3 text-sm font-medium text-slate-800 placeholder:text-indigo-400 placeholder:font-medium resize-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-500 transition-all custom-scrollbar shadow-inner"
          />
          <div className={`text-[10px] text-slate-500 mt-1.5 text-right ${inter.className}`}>
            {feedbackText.length} characters
          </div>
        </div>

        {/* Save Buttons - Only for non-MCQ questions */}
        {!isQuestionMCQ(selectedQuestion) && (
          <div className="pt-4 border-t border-slate-50 relative">
            {saveSuccess && (
              <div className="absolute -top-3 left-0 right-0 flex justify-center animate-in slide-in-from-bottom-2 fade-in duration-300 pointer-events-none">
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-emerald-100">
                  <Check className="h-3 w-3" />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${inter.className}`}>Saved</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedExercise && currentQuestionIndex > 0) {
                    handleQuestionClick(
                      selectedExercise.questions[currentQuestionIndex - 1],
                      currentQuestionIndex - 1
                    );
                  } else if (getCurrentStudentIndex() > 0) {
                    handlePrevStudent();
                  }
                }}
                disabled={
                  isSaving ||
                  (currentQuestionIndex === 0 && getCurrentStudentIndex() === 0)
                }
                className={`flex-1 h-10 text-xs border-2 border-slate-200 bg-white text-slate-700 rounded-md hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${inter.className}`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              <Button
                variant="outline"
                onClick={(isFrontendReview || isCodeMultiFileReview) && frontendSubmissionData
                  ? () => saveFrontendGrade(score, feedbackText)
                  : () => saveGrade()
                }
                disabled={isSaving}
                className={`flex-1 h-10 text-xs border-2 border-indigo-300 bg-white text-indigo-700 rounded-md hover:bg-indigo-50 hover:border-indigo-400 transition-all ${inter.className}`}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                onClick={() => {
                  if (selectedExercise && currentQuestionIndex < selectedExercise.questions.length - 1) {
                    handleQuestionClick(
                      selectedExercise.questions[currentQuestionIndex + 1],
                      currentQuestionIndex + 1
                    );
                  } else if (getCurrentStudentIndex() < getTotalStudents() - 1) {
                    handleNextStudent();
                  } else {
                    toast.success('All graded!');
                    if (isSingleStudentMode) handleBack();
                    else setViewMode('list');
                  }
                }}
                disabled={isSaving}
                className={`flex-1 h-10 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition-all ${inter.className}`}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* MCQ Submit Feedback Buttons */}
        {isQuestionMCQ(selectedQuestion) && (
          <div className="pt-4 border-t border-slate-50 relative">
            {saveSuccess && (
              <div className="absolute -top-3 left-0 right-0 flex justify-center animate-in slide-in-from-bottom-2 fade-in duration-300 pointer-events-none">
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm border border-emerald-100">
                  <Check className="h-3 w-3" />
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${inter.className}`}>Saved</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 mb-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedExercise && currentQuestionIndex > 0) {
                    handleQuestionClick(
                      selectedExercise.questions[currentQuestionIndex - 1],
                      currentQuestionIndex - 1
                    );
                  } else if (getCurrentStudentIndex() > 0) {
                    handlePrevStudent();
                  }
                }}
                disabled={
                  isSaving ||
                  (currentQuestionIndex === 0 && getCurrentStudentIndex() === 0)
                }
                className={`flex-1 h-10 text-xs border-2 border-slate-200 bg-white text-slate-700 rounded-md hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${inter.className}`}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Prev
              </Button>
              <Button
                variant="outline"
                onClick={() => saveGrade()}
                disabled={isSaving}
                className={`flex-1 h-10 text-xs border-2 border-indigo-300 bg-white text-indigo-700 rounded-md hover:bg-indigo-50 hover:border-indigo-400 transition-all ${inter.className}`}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                onClick={() => {
                  if (selectedExercise && currentQuestionIndex < selectedExercise.questions.length - 1) {
                    handleQuestionClick(
                      selectedExercise.questions[currentQuestionIndex + 1],
                      currentQuestionIndex + 1
                    );
                  } else if (getCurrentStudentIndex() < getTotalStudents() - 1) {
                    handleNextStudent();
                  } else {
                    toast.success('All graded!');
                    if (isSingleStudentMode) handleBack();
                    else setViewMode('list');
                  }
                }}
                disabled={isSaving}
                className={`flex-1 h-10 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-sm transition-all ${inter.className}`}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
)}
            </div>
          </div>
        )}
      </div>

      {/* QUESTION MODAL */}
      <Dialog open={showQuestionModal} onOpenChange={setShowQuestionModal}>
        <DialogContent className={`max-w-3xl rounded-xl border-none shadow-2xl p-0 overflow-hidden bg-white ${inter.className}`}>
          <div className="flex flex-col h-full">
            <DialogHeader className="p-6 pb-4 border-b border-slate-50">
              <div className="flex items-center justify-between">
                <DialogTitle className={`text-lg font-bold text-slate-900 uppercase tracking-tight ${inter.className}`}>Question Profile</DialogTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowQuestionModal(false)} className="rounded-full h-8 w-8 p-0"><X className="h-4 w-4" /></Button>
              </div>
            </DialogHeader>
            {(modalQuestion || selectedQuestion) ? (() => {
              const q = modalQuestion || selectedQuestion!;
              const qMax = selectedExercise ? getQuestionMaxScore(selectedExercise, q) : (q.points || 0);
              const qIsMCQ = isQuestionMCQ(q);
              return (
                <ScrollArea className="flex-1 p-6 max-h-[70vh] custom-scrollbar">
                  <div className="space-y-5">
                    <div className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${qIsMCQ ? 'bg-violet-800 text-violet-200' : 'bg-indigo-800 text-indigo-200'}`}>
                          {qIsMCQ ? 'MCQ' : 'Programming'}
                        </span>
                      </div>
                      <h2 className={`text-base font-bold text-white mb-3 leading-tight ${inter.className}`}>{getQuestionTitle(q)}</h2>
                      <div className="flex flex-wrap gap-2">
                        <Badge className={`bg-white text-slate-950 font-bold text-[9px] uppercase tracking-wide border-none px-2.5 py-0.5 ${inter.className}`}>{qMax} Points</Badge>
                        {!qIsMCQ && q.timeLimit != null && (<Badge variant="outline" className={`border-slate-800 text-slate-400 font-bold text-[9px] uppercase tracking-wide px-2.5 py-0.5 ${inter.className}`}>Time: {q.timeLimit}s</Badge>)}
                        {qIsMCQ && q.mcqQuestionDifficulty && (<Badge variant="outline" className={`border-slate-800 text-slate-400 font-bold text-[9px] uppercase tracking-wide px-2.5 py-0.5 ${inter.className}`}>{q.mcqQuestionDifficulty}</Badge>)}
                      </div>
                    </div>

                    {getQuestionDescription(q) && (
                      <div>
                        <h3 className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 ${inter.className}`}>{qIsMCQ ? 'Question Description' : 'Context & Requirements'}</h3>
                        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">{getQuestionDescription(q)}</p>
                      </div>
                    )}

                    {qIsMCQ && q.mcqQuestionOptions && q.mcqQuestionOptions.length > 0 && (
                      <div>
                        <h3 className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 ${inter.className}`}>Options &amp; Correct Answer</h3>
                        <div className="space-y-2">
                          {q.mcqQuestionOptions.map((opt, idx) => {
                            const isCorrect = opt.isCorrect || (q.mcqQuestionCorrectAnswers || []).includes(opt.text);
                            return (
                              <div key={idx} className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 ${isCorrect ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                                <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shrink-0 ${isCorrect ? 'border-emerald-400 text-emerald-700 bg-emerald-100' : 'border-slate-300 text-slate-500 bg-slate-50'}`}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                                <span className={`text-sm flex-1 ${isCorrect ? 'font-semibold text-emerald-800' : 'font-medium text-slate-700'}`}>{opt.text}</span>
                                {isCorrect && (<span className={`text-[10px] font-bold text-emerald-600 uppercase tracking-wide ${inter.className}`}>✓ Correct</span>)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {!qIsMCQ && (
                      <div className="grid grid-cols-2 gap-4">
                        {q.sampleInput && (
                          <div className="space-y-2">
                            <h3 className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest ${inter.className}`}>Input Pattern</h3>
                            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800"><pre className="text-[10px] font-mono text-emerald-400 whitespace-pre-wrap">{q.sampleInput}</pre></div>
                          </div>
                        )}
                        {q.sampleOutput && (
                          <div className="space-y-2">
                            <h3 className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest ${inter.className}`}>Expected Output</h3>
                            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800"><pre className="text-[10px] font-mono text-indigo-400 whitespace-pre-wrap">{q.sampleOutput}</pre></div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              );
            })() : null}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setShowQuestionModal(false)} className={`bg-slate-900 text-white font-bold text-[10px] uppercase tracking-wide px-6 rounded-md h-9 ${inter.className}`}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ASSESSMENT VIDEO MODAL */}
      <Dialog open={showVideoModal} onOpenChange={(open) => { if (!open) { setShowVideoModal(false); setAssessmentVideoUrl(null); setIsLoadingVideo(false); setTimeout(() => { document.body.style.pointerEvents = ''; }, 100); } }}>
        <DialogContent
          className={`max-w-5xl rounded-2xl border-none shadow-2xl p-0 overflow-hidden ${inter.className}`}
          style={{ background: '#0a0a0f' }}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col">
            {/* ── Header ── */}
            <DialogHeader className="px-5 py-3.5 border-b border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                    <Play className="h-3.5 w-3.5 text-white fill-white" />
                  </div>
                  <div>
                    <DialogTitle className={`text-sm font-bold text-white ${inter.className}`}>
                      Assessment Screen Recording
                    </DialogTitle>
                    {selectedParticipant && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {selectedParticipant.user.firstName} {selectedParticipant.user.lastName}
                        {selectedExercise && <span className="text-slate-600"> · {selectedExercise.exerciseInformation.exerciseName}</span>}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => { setShowVideoModal(false); setAssessmentVideoUrl(null); setIsLoadingVideo(false); }}
                  className="rounded-full h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            {/* ── Video area ── */}
            <div className="relative" style={{ background: '#000', minHeight: 420 }}>
              {isLoadingVideo ? (
                <div className="flex flex-col items-center justify-center h-[420px] gap-3">
                  <div className="w-12 h-12 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                  <span className="text-slate-400 text-sm font-medium">Loading recording…</span>
                </div>

              ) : assessmentVideoUrl ? (
                <div className="relative w-full">
                  {/* Red dot live/rec indicator that fades out */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
                    <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: 'none' }} />
                    <span className="text-[10px] font-bold text-white tracking-widest">RECORDING</span>
                  </div>
                  <video
                    key={assessmentVideoUrl}
                    controls
                    autoPlay={false}
                    className="w-full"
                    style={{ maxHeight: '70vh', display: 'block', background: '#000' }}
                    controlsList="nodownload"
                    preload="metadata"
                    onError={(e) => {
                      // If mp4 fails, the webm source below is tried automatically
                      console.warn('Video source error, trying alternate format');
                    }}
                  >
                    {/* Primary source — detect format from URL */}
                    <source
                      src={assessmentVideoUrl}
                      type={
                        assessmentVideoUrl.includes('.webm') || assessmentVideoUrl.includes('webm')
                          ? 'video/webm'
                          : assessmentVideoUrl.includes('.mp4')
                          ? 'video/mp4'
                          : 'video/webm'  /* Cloudinary recordings from hook are always webm */
                      }
                    />
                    {/* Fallback for browsers that need the other type */}
                    <source src={assessmentVideoUrl} type="video/mp4" />
                    <source src={assessmentVideoUrl} type="video/webm" />
                    <p className="text-slate-400 text-sm p-8 text-center">
                      Your browser does not support video playback.
                      <a href={assessmentVideoUrl} target="_blank" rel="noopener noreferrer"
                        className="ml-2 text-indigo-400 underline">Download recording</a>
                    </p>
                  </video>
                </div>

              ) : (
                <div className="flex flex-col items-center justify-center h-[420px] text-center px-8 gap-4">
                  <div className="w-18 h-18 flex items-center justify-center rounded-2xl mb-2"
                    style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
                    <FileQuestion className="h-8 w-8 text-slate-600" />
                  </div>
                  <div>
                    <h4 className={`text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 ${inter.className}`}>
                      No Recording Available
                    </h4>
                    <p className="text-sm text-slate-600 max-w-sm leading-relaxed">
                      No screen recording was found for this student's assessment session.
                      The student may not have enabled screen sharing, or the recording is still processing.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            {assessmentVideoUrl && (
              <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between gap-3"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  This recording was captured automatically during the assessment session for proctoring purposes.
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={assessmentVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:bg-white/10 transition-colors ${inter.className}`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in new tab
                  </a>
                  <Button
                    onClick={() => { setShowVideoModal(false); setAssessmentVideoUrl(null); setIsLoadingVideo(false); }}
                    className={`bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wide px-5 rounded-md h-8 ${inter.className}`}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
            {!assessmentVideoUrl && !isLoadingVideo && (
              <div className="px-5 py-3 border-t border-white/10 flex justify-end"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <Button
                  onClick={() => { setShowVideoModal(false); setAssessmentVideoUrl(null); setIsLoadingVideo(false); }}
                  className={`bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wide px-5 rounded-md h-8 ${inter.className}`}
                >
                  Close
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}