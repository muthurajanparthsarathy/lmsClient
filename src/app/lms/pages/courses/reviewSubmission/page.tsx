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
import {
  Code,
  X,
  FileCode,
  Users,
  Award,
  ArrowLeft,
  Copy,
  Home,
  Folder,
  Layers,
  CheckCircle,
  Play,
  Loader2,
  Terminal,
  FileText,
  FileQuestion,
  Check,
  User,
  Trash2,
  Maximize2,
  Minimize2,
  AlertCircle,
  Unlock,
  ChevronsLeftRight,
} from "lucide-react";
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
// Terminal + Test Result panel shared with the multi-file student editor —
// the review console renders exactly the same two-tab surface (Terminal /
// Test Result) so trainer and student see the same evaluation shape.
import BottomPanel, {
  type TestResultCase as MFTestResultCase,
  type TestResultState as MFTestResultState,
} from '@/app/lms/pages/courses/coursesdetailedview/components/multi-file/BottomPanel';
import { type TermLine as MFTermLine } from '@/app/lms/pages/courses/coursesdetailedview/components/multi-file/RunTerminal';
// Same AI grader the student-side editors call so the review console's
// AI-based Run Code path lands on the identical breakdown shape.
import { evaluateWithAi } from '@/app/lms/pages/courses/coursesdetailedview/components/lib/aiEvaluator';
import { NotionPagesViewer, PageData as NotionPageData } from '@/app/lms/pages/courses/reviewSubmission/components/OthersNotionEditor';
// ── Grading Console shell ────────────────────────────────────────────────────
// Presentational only: they take derived view data + callbacks and render the
// three-column console. All fetching, scoring and persistence stays in this
// file, which is what stops the screen re-forking into a second grading UI.
import {
  AppHeader,
  AssessmentQuestionSidebar,
  QuestionHeader,
  CodeWorkspace,
  languageFromFilename,
  // InputOutputPanel — retired in favour of the multi-file editor's
  // BottomPanel (terminal + test result tabs). Kept in the barrel until
  // every consumer is off it, but we no longer import it here.
  SubmissionHistory,
  OverallMarksCard,
  ManualMarkOverride,
  FeedbackCard,
  GradingActions,
} from './components/console';
import type {
  CodeTabId,
  ConsoleBreadcrumb,
  ConsoleFile,
  ConsoleLogLine,
  ConsoleQuestion,
  ConsoleStudent,
  ConsoleTestCase,
  Difficulty,
  QuestionFilterOption,
  QuestionKind,
  SubmissionAttempt,
} from './components/console';

const QUESTION_FILTERS: QuestionFilterOption[] = [
  { value: 'all', label: 'All Questions' },
  { value: 'easy', label: 'Easy', tone: '#12A15C' },
  { value: 'medium', label: 'Medium', tone: '#DE8100' },
  { value: 'hard', label: 'Hard', tone: '#DE3450' },
];

/**
 * A loadable portrait URL, or undefined so the avatar falls back to initials.
 *
 * `user.profile` (UserModel, a plain String) holds whatever the signup /
 * edit-profile flow wrote, and that is not always a ready-to-use URL:
 *
 *   • "default" — the sentinel for an account that never uploaded one. As an
 *     <img src> it just produced an empty circle.
 *   • an absolute Supabase URL — what userAuth.js writes today
 *     (`${SUPABASE_URL}/storage/v1/object/public/smartlms/users/profile/<file>`).
 *     Used as-is.
 *   • a bare filename or a storage-relative path — older rows. Rebuilt against
 *     the current storage origin so they resolve instead of 404-ing against
 *     the Next app's own origin.
 */
// Moved to @/lib/avatarUrl so the Live Dashboard, the review header, and the
// student picker all resolve profile URLs identically. Kept the local alias
// so every existing call site in this file keeps compiling with no rename.
import { resolveAvatarUrl } from '@/lib/avatarUrl';

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

// ── Grading panel resize ─────────────────────────────────────────────────────
// Width of the right-hand grading rail (Overall Marks / Mark / Feedback). The
// bounds keep both sides usable: below ~340px the Feedback tabs wrap and the
// marks ring crowds its label, above ~720px the centre code workspace starts
// losing more than it gains.
const RIGHT_PANEL_DEFAULT_WIDTH = 440;
const RIGHT_PANEL_MIN_WIDTH = 340;
const RIGHT_PANEL_MAX_WIDTH = 720;
const RIGHT_PANEL_WIDTH_KEY = 'reviewSubmission.gradingPanelWidth';
const clampPanelWidth = (w: number): number =>
  Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(RIGHT_PANEL_MIN_WIDTH, Math.round(w)));

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
    // The You Do assessment form saves the Skill Set here, not in programmingSettings
    selectedLanguages?: string[];
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
  // How submissions to this exercise are scored. "manual" means a trainer has
  // to grade every submission by hand; "testcase" / "ai" mean the score was
  // already computed at Submit time, so the trainer is only ever looking at a
  // result, not producing one. Absent on legacy exercises authored before the
  // field existed — those keep the manual (Review / Start Grading) treatment.
  evaluationMethod?: {
    method?: 'manual' | 'testcase' | 'ai';
    ai?: {
      criteria?: string[];
      testCasesCountMode?: 'common' | 'perQuestion';
      testCasesCount?: number;
    };
  } | null;
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
  exercise?: Exercise | null,
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

// Monaco language id → a filename extension, matching the inline ternaries
// the authoring screens already use (ProblemSolving.tsx, pistonHelpers.ts).
const extForLanguage = (lang?: string): string => {
  switch ((lang || '').toLowerCase()) {
    case 'python': return 'py';
    case 'javascript': return 'js';
    case 'typescript': return 'ts';
    case 'java': return 'java';
    case 'cpp': case 'c++': return 'cpp';
    case 'csharp': case 'c#': return 'cs';
    case 'c': return 'c';
    case 'go': return 'go';
    case 'sql': return 'sql';
    default: return 'txt';
  }
};

// A single-file submission, rendered as the one-entry file list the code
// review pane expects.
//
// The two submit paths store DIFFERENT shapes and only one of them was ever
// read here:
//
//   • /courses/answers/submit-multiple-files → `files[]` + `folders[]`
//     (multi-file editor, frontend compiler, DB query editor)
//   • /courses/answers/submit                → `codeAnswer` STRING, no files
//     (the You Do assessment code editor — answer.js builds `questionAnswer`
//     with codeAnswer/language/score and no `files` key at all; the
//     `files: [{ path: 'main', … }]` you see nearby in that controller is a
//     throwaway argument to judgeCode(), never persisted)
//
// StaffCodeReview only ever received `frontendSubmissionData.files`, so every
// assessment submitted through the standard code editor rendered "No files. /
// No code submission for this question" — while the student's code sat in
// Mongo under `codeAnswer` the whole time. Synthesizing the file here fixes
// the submissions already stored, which a change to the write path could not.
const filesFromCodeAnswer = (
  submission: SubmissionQuestion,
): FrontendSubmissionData['files'] => {
  const code = typeof submission.codeAnswer === 'string' ? submission.codeAnswer : '';
  if (!code.trim()) return [];
  const language = submission.language || 'plaintext';
  const filename = `solution.${extForLanguage(language)}`;
  return [{
    id: `${submission.questionId}-main`,
    filename,
    content: code,
    language,
    path: `/${filename}`,
    folderPath: '/',
    isEntryPoint: true,
  }];
};

/** Does this submission have code the Core Programming review pane can show? */
// True when this is a Core Programming multi-file submission (e.g. Python).
// We treat this as a CODE review (not frontend preview).
const isCoreProgrammingMultiFileQuestion = (
  submission?: SubmissionQuestion | null,
  exercise?: Exercise | null,
): boolean => {
  const selectedModule = (exercise?.programmingSettings?.selectedModule || '').toLowerCase();
  if (selectedModule !== 'core programming') return false;
  if (submission?.files && submission.files.length > 0) return true;
  // Single-file submissions carry only `codeAnswer` — see filesFromCodeAnswer.
  return typeof submission?.codeAnswer === 'string' && submission.codeAnswer.trim().length > 0;
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
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<ExerciseAnswer | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<ExerciseQuestion | null>(null);
  const [submissionQuestion, setSubmissionQuestion] = useState<SubmissionQuestion | null>(null);
  const [score, setScore] = useState(0);
  const [maxScore, setMaxScore] = useState(10);
  // ── Score input draft ─────────────────────────────────────────────────────
  // `score` stays the numeric source of truth (it is what gets saved and what
  // every other read uses), but the INPUT is driven by this text draft.
  //
  // The input used to be `type="number"` bound straight to `score`, which made
  // it miserable to type into: clearing the field parsed to 0, so the value
  // snapped to "0" and the next digit landed after it ("05"); the number
  // spinner hijacked the scroll wheel over the field; and `parseInt` refused
  // the fractional scores that evenMarks (totalMarks / questionCount) and AI
  // grading both produce. It is now `type="text"` with numeric parsing.
  //
  // `null` means "mirror the committed number". A string is exactly what the
  // grader has typed, kept verbatim so in-progress values ("", "8.") survive
  // re-render instead of being rewritten mid-keystroke.
  const [scoreDraft, setScoreDraft] = useState<string | null>(null);
  // Drop the draft when the grader moves to another question or student —
  // that score came from elsewhere, so the input must show it, not the text
  // left over from the previous one.
  useEffect(() => {
    setScoreDraft(null);
  }, [selectedQuestion?._id, selectedParticipant?._id]);
  const clampScore = (n: number): number => Math.min(maxScore, Math.max(0, n));
  // Helper — reads the exercise's stored evaluation method. Manual-eval
  // exercises require a mark before Save, which is what the Manual Mark
  // Override card's REQUIRED / OPTIONAL label reflects.
  // Reads the exercise's stored evaluation method. Returns '' when the
  // exercise predates the field (73 of the 92 live exercises at time of
  // writing) or stores something unrecognised — callers must decide what an
  // unknown method means for them rather than guessing here.
  const getExerciseEvalMethod = (ex: any): 'manual' | 'testcase' | 'ai' | '' => {
    const raw = ex?.evaluationMethod?.method
      || ex?.evaluationMethod
      || ex?.evaluationSettings?.method
      || '';
    const m = String(raw).toLowerCase();
    return m === 'manual' || m === 'testcase' || m === 'ai' ? m : '';
  };
  const isManualEvalExercise = (ex: any): boolean =>
    getExerciseEvalMethod(ex) === 'manual';
  // Test-case and AI exercises are scored by the pipeline at Submit time, so
  // there is no grading for the trainer to do — the row shows "Auto Evaluated"
  // and "View Details" instead of "Review" / "Start Grading". Only an EXPLICIT
  // testcase/ai method flips this: an exercise with no `evaluationMethod` is
  // left on the manual path so legacy exercises don't silently lose their
  // Start Grading button. Trainers can still override a score from inside the
  // console — this only changes how the list advertises the work.
  const isAutoEvalExercise = (ex: any): boolean => {
    const m = getExerciseEvalMethod(ex);
    return m === 'testcase' || m === 'ai';
  };
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [modalQuestion, setModalQuestion] = useState<ExerciseQuestion | null>(null);
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [feedbackText, setFeedbackText] = useState('');
  const [gradingStats, setGradingStats] = useState({ graded: 0, pending: 0, total: 0, averageScore: 0 });
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Bumped after every successful grade save. Read by the memos behind the
  // Overall Marks ring, the per-question sidebar score chips, and the
  // question status dots — all three walk `selectedParticipant.user.courses…
  // answers…questions[i].score`, and even though `saveGrade` rebuilds the
  // participant reference the memos can otherwise skip recomputing if they
  // land in the same render batch as an unrelated state settle. Bumping a
  // dedicated counter makes the recompute unambiguous.
  const [gradeSaveTick, setGradeSaveTick] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  // Test-case detail modal — opens when the trainer clicks the "Passed
  // X / Y test cases" summary on an auto-scored submission. Shows every
  // case (passed AND failed), split into two lists, with input /
  // expected / actual for each.
  const [tcModal, setTcModal] = useState<{ cases: any[]; passed: number; total: number; title?: string } | null>(null);
  const [assessmentVideoUrl, setAssessmentVideoUrl] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  // The console's code slab has ONE appearance — the dark navy editor the
  // design specifies — so the old per-trainer 'vs' / 'vs-dark' preference (and
  // the toolbar toggle that set it) is gone. The header's sun / moon control
  // is the app-wide theme, not the editor's.
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([]);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [executionLanguage, setExecutionLanguage] = useState('javascript');
  const inputResolverRef = useRef<((value: string) => void) | null>(null);
  const [pyodideReady, setPyodideReady] = useState(false);
  const pyodideRef = useRef<any>(null);

  // ── BottomPanel state (Terminal + Test Result) ───────────────────────────
  // The panel is collapsed by default. Run Code opens it, and stays open
  // through the run so the trainer sees output live. Which tab it opens on
  // follows the exercise's evaluation method (see `bottomMode` memo below).
  const [bottomOpen, setBottomOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'test-result'>('terminal');
  const [testResult, setTestResult] = useState<MFTestResultState | null>(null);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState<number>(0);
  const [lastRuntimeMs, setLastRuntimeMs] = useState<number | null>(null);
  // The trainer types plain-text into this box when the exercise wants a
  // sample stdin they'll edit. Live Python runs read from the terminal's
  // interactive line, not this — that's why it's a separate value.
  const [terminalStdin, setTerminalStdin] = useState<string>("");

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
      if (!submission) continue;
      // Multi-file submissions carry `files[]`; the standard code editor
      // stores the source in `codeAnswer` alone, so build the one-file list
      // from that instead of reporting "no submission".
      const files = submission.files && submission.files.length > 0
        ? submission.files
        : filesFromCodeAnswer(submission);
      if (files.length > 0) {
        return {
          _id: submission._id,
          exerciseId: answer.exerciseId,
          questionId: submission.questionId,
          files,
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

    // Every exercise hanging off ONE node's pedagogy, whatever its
    // subcategory is called.
    //
    // `pedagogy.We_Do` / `pedagogy.You_Do` are open Maps on the server
    // (moduleModal.js: `We_Do: { type: Map, of: [exerciseSchema] }`), and the
    // key is just the course's own subcategory LABEL lowercased with spaces
    // underscored — "Assessment" -> "assessment", "Case Study" ->
    // "case_study". Admins configure those labels in Dynamic Field Settings ▸
    // Pedagogy, so the key space is open-ended by design.
    //
    // This used to be five copy-pasted blocks of hand-written `collect(...)`
    // calls, one per hierarchy level, each naming ~10 subcategories — and they
    // disagreed with each other: You_Do never listed `assignments` or
    // `assignment`, We_Do never listed `assesment`, and NONE of them listed
    // `assessment`, the correctly-spelled singular that is the default key for
    // the code editor, MCQ and section-based test flows. An exercise stored
    // under a key nobody had typed into the list was invisible here: the
    // exerciseId lookup missed it, the page silently fell back to the first
    // exercise it did find, and the trainer was shown the wrong assessment's
    // questions — or none at all.
    //
    // Reading the node's OWN keys removes the guesswork: a new subcategory
    // added in settings shows up in the grading console without a code change.
    const collectNode = (
      pedagogy: any,
      moduleId?: string,
      subModuleId?: string,
      topicId?: string,
      subTopicId?: string,
    ) => {
      if (!pedagogy || typeof pedagogy !== 'object') return;
      // I_Do is reading material, never graded, and is stripped server-side
      // for this endpoint anyway.
      (['We_Do', 'You_Do'] as const).forEach((cat) => {
        const bucket = pedagogy[cat];
        if (!bucket || typeof bucket !== 'object') return;
        Object.keys(bucket).forEach((sub) => {
          const list = bucket[sub];
          if (!Array.isArray(list)) return;
          collect(list, cat, sub, moduleId, subModuleId, topicId, subTopicId);
        });
      });
    };

    // Recursive function to traverse all hierarchy levels
    const traverseModules = (modules: any[]) => {
      modules.forEach((module: any) => {
        const moduleId = module._id;

        // Check if module has direct We_Do/You_Do at module level
        if (module.pedagogy) {
          const p = module.pedagogy;
          collectNode(p, moduleId, undefined, undefined, undefined);
        }

        // Check if module has direct topics (without submodules)
        if (module.topics && Array.isArray(module.topics)) {
          module.topics.forEach((topic: any) => {
            const topicId = topic._id;
            const p = topic.pedagogy;
            if (p) {
              collectNode(p, moduleId, undefined, topicId, undefined);
            }

            // Check if topic has subTopics
            if (topic.subTopics && Array.isArray(topic.subTopics)) {
              topic.subTopics.forEach((subTopic: any) => {
                const subTopicId = subTopic._id;
                const p = subTopic.pedagogy;
                if (p) {
                  collectNode(p, moduleId, undefined, topicId, subTopicId);
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
              collectNode(p, moduleId, subModuleId, undefined, undefined);
            }

            // Check if submodule has direct topics
            if (subModule.topics && Array.isArray(subModule.topics)) {
              subModule.topics.forEach((topic: any) => {
                const topicId = topic._id;
                const p = topic.pedagogy;
                if (p) {
                  collectNode(p, moduleId, subModuleId, topicId, undefined);
                }

                // Check if topic has subTopics
                if (topic.subTopics && Array.isArray(topic.subTopics)) {
                  topic.subTopics.forEach((subTopic: any) => {
                    const subTopicId = subTopic._id;
                    const p = subTopic.pedagogy;
                    if (p) {
                      collectNode(p, moduleId, subModuleId, topicId, subTopicId);
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
        // Auto-scored exercises aren't a grading queue — the trainer is
        // reading a result, not producing one.
        title: isAutoEvalExercise(exercise) ? 'Submission Details' : 'Grading Console',
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

  // ── Direct-grading auto-trigger ────────────────────────────────────────────
  // This page has no participants list any more, so it must pick a learner on
  // its own the moment the data lands:
  //
  //   • `studentId` in the URL (Live Dashboard ▸ Review) → exactly that
  //     learner. This is the flow the trainer explicitly asked for.
  //   • no `studentId` (course-structure ▸ Review on an exercise) → the first
  //     learner who actually has a submission, falling back to the first
  //     enrolled learner. The header's Prev / picker / Next moves from there.
  //
  // Runs at most once per mount (the ref guard) so the participants-state
  // mutations the grading flow itself causes — e.g. after a score save —
  // don't yank the trainer back to the auto-picked learner.
  useEffect(() => {
    if (hasAutoStartedGradingRef.current) return;
    if (!selectedExercise) return;
    if (!participants || participants.length === 0) return;

    if (isSingleStudentMode) {
      // Backend uses `_id` for User document ids; the dashboard passes the
      // user id (StudentProgress.id). Match against the user side, with a
      // fallback to the participant document id in case any caller passes
      // that instead.
      const target = participants.find((p) =>
        p.user?._id === studentIdParam || p._id === studentIdParam
      );
      if (target) {
        hasAutoStartedGradingRef.current = true;
        handleStartGrading(target);
        return;
      }
      // Student id didn't resolve. Say so, then fall through to the
      // first-learner pick below rather than stranding the trainer on a
      // permanently empty console.
      toast.error('Could not find that student in this assessment.');
    }

    const withSubmission = participants.find(
      (p) => getExerciseAnswersForSelectedExercise(p).length > 0
    );
    hasAutoStartedGradingRef.current = true;
    handleStartGrading(withSubmission || participants[0]);
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

  // Fetches + opens the proctoring recording for one learner. Its only caller
  // was the removed participants list's ⋮ ▸ Assessment Video; the Live
  // Dashboard's own ⋮ ▸ Video Assessment covers that need now. Kept (with the
  // modal below) so re-attaching a trigger is a one-line change.
  const handleViewAssessmentVideo = async (participantId: string, exerciseId: string) => {
    setAssessmentVideoUrl(null);
    setShowVideoModal(true);
    await fetchAssessmentVideo(participantId, exerciseId);
  };

  const getExerciseAnswers = (participant: Participant): ExerciseAnswer[] => {
    if (!participant.user.courses) return [];
    const course = participant.user.courses.find(c => c.courseId === courseId);
    if (!course || !course.answers) return [];

    // Every submission bucket under one pedagogy category, whatever its
    // subcategory is called.
    //
    // `answers.We_Do` / `answers.You_Do` are open Maps keyed verbatim by
    // whatever the client sent as `subcategory` — answer.js does
    // `exerciseKey = subcategory` and stores it with no normalisation. There
    // is therefore no fixed key set to enumerate.
    //
    // This was an allowlist of eight spellings, and it was the reason
    // submissions kept reading as "Not Submitted Yet" with "No Code Found" in
    // the editor pane: a course whose subcategory label was anything else —
    // a custom one from Dynamic Field Settings ▸ Pedagogy, or just a spelling
    // nobody had added yet — had its answers dropped on the floor even though
    // they were sitting in Mongo. Every fix to it was another string appended
    // to the list. Reading the object's own keys ends that.
    const extractAll = (catObj: any): ExerciseAnswer[] => {
      if (!catObj || typeof catObj !== 'object') return [];
      const answers: ExerciseAnswer[] = [];
      Object.values(catObj).forEach((bucket) => {
        if (Array.isArray(bucket)) answers.push(...(bucket as ExerciseAnswer[]));
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

  /**
   * Mirrors a just-persisted grade onto the state the UI reads.
   *
   * The mark is displayed from two independent places — the participant's
   * answer tree (rail row + Overall Marks ring) and `submissionQuestion`
   * (Submission History's Mark / Status) — so a save has to touch both or it
   * looks like it did nothing.
   */
  const applySavedGradeLocally = (scoreValue: number, feedbackValue: string) => {
    setSubmissionQuestion((prev) =>
      prev
        ? ({
            ...prev,
            score: scoreValue,
            totalScore: maxScore,
            feedback: feedbackValue,
            status: 'evaluated',
          } as SubmissionQuestion)
        : prev,
    );
  };

  /**
   * Immutable, deep, always-succeeds local patch.
   *
   * The old inline mutation had a fatal edge case: when the student has not
   * yet saved ANY answer for this exercise, `getExerciseAnswers(participant)`
   * returns [], `targetAnswerGroup` comes back undefined, and the entire
   * mutation is skipped. The trainer's grade lives only on the server, the
   * memos see stale local data, and the UI keeps showing 0/50. This helper
   * always lands the grade locally:
   *   • if the exercise already has an answer group with this question row
   *     → replace that row (fresh object)
   *   • if the answer group exists but the question row doesn't
   *     → append a fresh row
   *   • if no answer group exists at all
   *     → create the whole exercise-answer skeleton, including the
   *       {category}/{subcategory} keys the tree uses
   * Every level from participant down to the mutated question gets a fresh
   * object/array reference so React's `useMemo` equality checks can't miss
   * the change even under the shallowest possible comparison.
   */
  const patchParticipantWithGrade = (
    p: Participant,
    exerciseId: string,
    questionId: string,
    scoreValue: number,
    feedbackValue: string,
    maxScoreValue: number,
    category: string,
    subcategory: string,
    language: string,
    submittedAt?: string,
  ): Participant => {
    const cat = category || 'We_Do';
    const sub = subcategory || 'assignments';
    const gradedRow = {
      score: scoreValue,
      totalScore: maxScoreValue,
      feedback: feedbackValue,
      isCorrect: maxScoreValue > 0 ? (scoreValue / maxScoreValue) * 100 >= 60 : false,
      status: 'evaluated' as const,
    };

    // Immutable walk downward — clone every container that contains something
    // we changed. Everything else keeps its old reference so unrelated memos
    // don't invalidate.
    const oldUser: any = p.user || {};
    const oldCourses: any[] = Array.isArray(oldUser.courses) ? oldUser.courses : [];
    let courseIdx = oldCourses.findIndex((c: any) => String(c?.courseId) === String(courseId));
    const oldCourse: any = courseIdx >= 0 ? oldCourses[courseIdx] : { courseId };
    const oldAnswers: any = oldCourse.answers && typeof oldCourse.answers === 'object' ? oldCourse.answers : {};
    const oldCatObj: any = oldAnswers[cat] && typeof oldAnswers[cat] === 'object' ? oldAnswers[cat] : {};

    // Locate the answer bucket for this exercise. The subcategory key is the
    // canonical spot; if the historic data used a different subcategory key
    // for this same exercise, walk every bucket to find the row.
    let existingBucketKey: string | null = null;
    let existingBucket: any[] = [];
    let existingGroupIdx = -1;
    const bucketKeys = Object.keys(oldCatObj);
    for (const key of bucketKeys) {
      const list = oldCatObj[key];
      if (!Array.isArray(list)) continue;
      const gi = list.findIndex((g: any) => String(g?.exerciseId) === String(exerciseId));
      if (gi !== -1) {
        existingBucketKey = key;
        existingBucket = list;
        existingGroupIdx = gi;
        break;
      }
    }

    // Build the fresh answer group (either updated or brand-new). Question
    // list is built immutably too.
    const oldGroup: any = existingGroupIdx !== -1 ? existingBucket[existingGroupIdx] : { exerciseId, questions: [] };
    const oldQuestions: any[] = Array.isArray(oldGroup.questions) ? oldGroup.questions : [];
    const qRowIdx = oldQuestions.findIndex((q: any) => String(q?.questionId) === String(questionId));

    const newQuestion = qRowIdx !== -1
      ? { ...oldQuestions[qRowIdx], ...gradedRow }
      : {
          _id: Math.random().toString(),
          questionId,
          codeAnswer: '',
          language: language || 'text',
          attemScore: 0,
          submittedAt: submittedAt || new Date().toISOString(),
          ...gradedRow,
        };
    const newQuestions = qRowIdx !== -1
      ? oldQuestions.map((q, i) => (i === qRowIdx ? newQuestion : q))
      : [...oldQuestions, newQuestion];
    const newGroup = { ...oldGroup, questions: newQuestions };
    const bucketKey = existingBucketKey || sub;
    const oldBucketForKey = Array.isArray(oldCatObj[bucketKey]) ? oldCatObj[bucketKey] : [];
    const newBucket = existingGroupIdx !== -1
      ? oldBucketForKey.map((g: any, i: number) => (i === existingGroupIdx ? newGroup : g))
      : [...oldBucketForKey, newGroup];

    const newCatObj = { ...oldCatObj, [bucketKey]: newBucket };
    const newAnswers = { ...oldAnswers, [cat]: newCatObj };
    const newCourse = { ...oldCourse, answers: newAnswers };
    const newCourses = courseIdx >= 0
      ? oldCourses.map((c, i) => (i === courseIdx ? newCourse : c))
      : [...oldCourses, newCourse];
    const newUser = { ...oldUser, courses: newCourses };
    return { ...p, user: newUser };
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

      // Always land the grade locally via the immutable helper so the memos
      // behind the Overall Marks ring and the sidebar chips see the change
      // on THIS render — even for the trainer-scores-a-never-attempted-
      // question edge case where the old inline mutation used to bail out.
      {
        const pIdx = participants.findIndex(p => p._id === selectedParticipant._id);
        if (pIdx !== -1) {
          const patched = patchParticipantWithGrade(
            participants[pIdx] as Participant,
            selectedExercise._id,
            selectedQuestion._id,
            scoreValue,
            feedbackValue,
            maxScore,
            categoryToSend,
            subcategoryToSend,
            'html/css/javascript',
          );
          const updatedParticipants = participants.map((p, i) => (i === pIdx ? patched : p));
          setParticipants(updatedParticipants);
          setSelectedParticipant(patched);
        }
      }

      applySavedGradeLocally(scoreValue, feedbackValue);
      // Refetch is deliberately dropped from the happy path — the patch above
      // has the authoritative shape and any refetch would just race with it.

      // Same story as saveGrade — bump the tick so the Overall ring + sidebar
      // per-question scores repaint without waiting for another selection.
      setGradeSaveTick((t) => t + 1);
      setSaveSuccess(true);
      // Question-scoped toast — the trainer just graded one question, so the
      // notification names that question. `currentQuestionIndex` is 0-based;
      // the ordinal shown here (Q1, Q2 …) matches the sidebar strip and the
      // question number pill inside the console.
      toast.success(`Question ${currentQuestionIndex + 1} saved`);
      return true;
    } catch (err) {
      console.error('Save frontend grade error:', err);
      toast.error('Failed to save grade');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartGrading = async (
    participant: Participant,
    opts?: { keepQuestion?: boolean },
  ) => {
    setSaveSuccess(false);
    setSelectedParticipant(participant);
    setIsFrontendReview(false);
    setIsCodeMultiFileReview(false);
    setFrontendSubmissionData(null);
    setIsOthersReview(false);

    if (!selectedExercise) return;

    const answers = getExerciseAnswersForSelectedExercise(participant);

    // Student navigation pins the question: the trainer is comparing the same
    // problem across learners, so we look up THIS question in the new
    // student's answers instead of jumping to their first answered one.
    const pinnedQuestion = opts?.keepQuestion
      ? selectedExercise.questions.find(q => q._id === selectedQuestion?._id) || null
      : null;

    let targetQuestion = pinnedQuestion || selectedExercise.questions[0];
    let submissionFound: SubmissionQuestion | null = null;
    let activeAnswerGroup: ExerciseAnswer | null = null;

    if (answers.length > 0 && pinnedQuestion) {
      for (const ans of answers) {
        const sub = ans.questions?.find(q => q.questionId === pinnedQuestion._id);
        if (sub) {
          submissionFound = sub;
          activeAnswerGroup = ans;
          break;
        }
      }
    } else if (answers.length > 0) {
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
  };

  // All three entry points keep the question — switching learner never
  // switches problem. (Only the initial auto-select, which calls
  // handleStartGrading with no options, is allowed to pick the question.)
  const handleStudentChange = (id: string) => {
    const p = participants.find(p => p._id === id);
    if (p) handleStartGrading(p, { keepQuestion: true });
  };

  const handleNextStudent = () => {
    if (!selectedParticipant) return;
    const idx = participants.findIndex(p => p._id === selectedParticipant._id);
    if (idx < participants.length - 1) {
      handleStartGrading(participants[idx + 1], { keepQuestion: true });
    } else {
      toast.success('End of list');
    }
  };

  const handlePrevStudent = () => {
    if (!selectedParticipant) return;
    const idx = participants.findIndex(p => p._id === selectedParticipant._id);
    if (idx > 0) {
      handleStartGrading(participants[idx - 1], { keepQuestion: true });
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
    if ((exercise.questionConfiguration?.programmingQuestionConfiguration as any)?.gradeSettings) return (exercise.questionConfiguration!.programmingQuestionConfiguration as any).gradeSettings;
    if ((exercise as any).settings?.grade) return (exercise as any).settings.grade;
    return null;
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

        {
          const pIdx = participants.findIndex(p => p._id === selectedParticipant._id);
          if (pIdx !== -1) {
            const patched = patchParticipantWithGrade(
              participants[pIdx] as Participant,
              selectedExercise._id,
              selectedQuestion._id,
              score,
              feedbackText,
              maxScore,
              categoryToSend,
              subcategoryToSend,
              'text',
            );
            const updatedParticipants = participants.map((p, i) => (i === pIdx ? patched : p));
            setParticipants(updatedParticipants);
            setSelectedParticipant(patched);
          }
        }

        applySavedGradeLocally(score, feedbackText);
        // Same reason as the non-MCQ branch below — nudge the memos.
        setGradeSaveTick((t) => t + 1);
        setSaveSuccess(true);
        toast.success(`Question ${currentQuestionIndex + 1} saved`);
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

      {
        const pIdx = participants.findIndex(p => p._id === selectedParticipant._id);
        if (pIdx !== -1) {
          const patched = patchParticipantWithGrade(
            participants[pIdx] as Participant,
            selectedExercise._id,
            selectedQuestion._id,
            score,
            feedbackText,
            maxScore,
            categoryToSend,
            subcategoryToSend,
            submissionLanguage,
          );
          const updatedParticipants = participants.map((p, i) => (i === pIdx ? patched : p));
          setParticipants(updatedParticipants);
          setSelectedParticipant(patched);
        }
      }

      applySavedGradeLocally(score, feedbackText);

      // Force the Overall Marks ring and the sidebar per-question scores to
      // pick up the mutation on THIS render. Both memos have this tick in
      // their deps, and bumping it here means the trainer sees the new mark
      // instantly instead of "still 0 / total" until the next click.
      setGradeSaveTick((t) => t + 1);
      setSaveSuccess(true);
      // Same question-scoped toast as the MCQ / frontend paths — every save
      // now emits the same "Question N saved" line so trainers get one
      // consistent confirmation regardless of question type.
      toast.success(`Question ${currentQuestionIndex + 1} saved`);
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
            // Nothing left to grade and no list to fall back to — leave the
            // console the same way Back does.
            handleBack();
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
      // Section-relative, like the upload-page fallback below: the dashboard
      // is mounted under both /lms/pages/courses and /lms/pages/coursestructure,
      // and Back must not move the user out of the section they came from — an
      // admin's `coursestructure` grant does not cover the `courses` copy.
      router.push(`${sectionHref('liveDashboard')}?${params.toString()}`);
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

  /**
   * Executes a submission.
   *
   * With no options it runs the stored answer and drives the modal
   * InteractiveTerminal — the behaviour every caller had before the console
   * shell existed. The console passes `useIoPanel` instead, so output lands in
   * its own Input / Output panel, and supplies the editor's working copy plus
   * the stdin already typed there (which also skips the blocking "batch input
   * required" prompt, since the input is in hand).
   */
  const initiateRunCode = async (opts?: {
    source?: string;
    language?: string;
    stdin?: string;
    useIoPanel?: boolean;
  }) => {
    const source = opts?.source ?? submissionQuestion?.codeAnswer ?? '';
    if (!source.trim()) {
      toast.error('No code to execute');
      return;
    }

    const lang = (opts?.language || submissionQuestion?.language || 'javascript').toLowerCase();
    setExecutionLanguage(lang);
    if (!opts?.useIoPanel) setShowTerminal(true);
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
          preamble + "\n" + source.replace(/input\s*\(/g, "await input(")
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

    // Only prompt for stdin when the caller has not already supplied it —
    // the console's I/O panel collects it up front, so blocking on the modal
    // terminal there would strand the run behind a hidden dialog.
    const needsInput = opts?.stdin === undefined &&
      ['java', 'c', 'cpp'].some(l => lang.includes(l)) &&
      (source.includes('Scanner') ||
        source.includes('scanf') ||
        source.includes('cin'));

    let stdin = opts?.stdin ?? "";
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
          files: [{ content: source }],
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

  const filteredQuestions = useMemo(() => {
    if (!selectedExercise) return [];
    return difficultyFilter === 'all'
      ? selectedExercise.questions
      : selectedExercise.questions.filter(q =>
        getQuestionDisplayDifficulty(q) === difficultyFilter.toLowerCase()
      );
  }, [selectedExercise, difficultyFilter]);

  // ── GRADING CONSOLE VIEW MODEL ────────────────────────────────────────────
  // Everything below turns fetched exercise / participant / submission state
  // into the flat props `components/console` renders. That shell is purely
  // presentational, so this is the only place that knows how a submission
  // becomes a list row, a ring, a history line or a mark.

  const [codeTab, setCodeTab] = useState<CodeTabId>('editor');
  // Per-file working copies, keyed by path. A trainer can tweak a file and hit
  // Run to test a hypothesis; nothing is written back (saveGrade only persists
  // score + feedback) and Reset drops every draft.
  const [fileDrafts, setFileDrafts] = useState<Record<string, string>>({});
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [runLanguage, setRunLanguage] = useState('java');
  const [ioOpen, setIoOpen] = useState(false);
  const [stdinText, setStdinText] = useState('');
  const [feedbackTab, setFeedbackTab] = useState<'write' | 'quick'>('write');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [moveToNextAfterSave, setMoveToNextAfterSave] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Grading panel width ───────────────────────────────────────────────────
  // The right rail (Overall Marks ▸ Mark ▸ Feedback ▸ Save) used to be a hard
  // w-[440px]. On a laptop that leaves the code workspace too narrow to read a
  // long line without horizontal scrolling, and on a wide monitor it wastes
  // the space. The divider between the centre column and the rail is now a
  // drag handle, and the width a trainer settles on is remembered per browser
  // so it survives moving to the next student (which remounts this page).
  const [gradingPanelWidth, setGradingPanelWidth] = useState(RIGHT_PANEL_DEFAULT_WIDTH);
  const [isResizingGradingPanel, setIsResizingGradingPanel] = useState(false);
  const gradingResizeStartXRef = useRef(0);
  const gradingResizeStartWidthRef = useRef(RIGHT_PANEL_DEFAULT_WIDTH);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(RIGHT_PANEL_WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) setGradingPanelWidth(clampPanelWidth(stored));
  }, []);

  const handleGradingResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    gradingResizeStartXRef.current = e.clientX;
    gradingResizeStartWidthRef.current = gradingPanelWidth;
    setIsResizingGradingPanel(true);
  };

  useEffect(() => {
    if (!isResizingGradingPanel) return;

    // Dragging LEFT widens the rail, so the delta is inverted against the
    // pointer — the handle sits on the panel's left edge.
    const onMove = (e: MouseEvent) => {
      const delta = gradingResizeStartXRef.current - e.clientX;
      setGradingPanelWidth(clampPanelWidth(gradingResizeStartWidthRef.current + delta));
    };
    const onUp = () => setIsResizingGradingPanel(false);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    // Without these the drag selects the text it passes over and the cursor
    // flickers back to a caret whenever the pointer leaves the 6px handle.
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingGradingPanel]);

  // Persist only once the drag ends, not on every mousemove frame.
  useEffect(() => {
    if (isResizingGradingPanel) return;
    window.localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(gradingPanelWidth));
  }, [isResizingGradingPanel, gradingPanelWidth]);
  // Fullscreen sizes the editor off the real viewport instead of a CSS calc so
  // Monaco (which needs a pixel height) doesn't have to re-measure on mount.
  const [viewportHeight, setViewportHeight] = useState(928);
  useEffect(() => {
    const sync = () => setViewportHeight(window.innerHeight);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  /**
   * The submitted files, exactly as handed in.
   *
   * `files[]` wins over `codeAnswer` whenever it exists: a multi-file
   * submission stores the real sources in `files[]` and leaves a metadata
   * placeholder ("Multi-file project with N files") in `codeAnswer`, which is
   * NOT code and must never reach the editor.
   */
  const submittedFiles: ConsoleFile[] = useMemo(() => {
    const raw: any[] = (submissionQuestion?.files?.length
      ? submissionQuestion.files
      : frontendSubmissionData?.files) || [];

    if (raw.length > 0) {
      return raw.map((f) => {
        const path = String(f.path || f.filename || 'file').replace(/^\/+/, '');
        const name = String(f.filename || path.split('/').pop() || 'file');
        return {
          path,
          name,
          language: String(f.language || languageFromFilename(name)).toLowerCase(),
          content: typeof f.content === 'string' ? f.content : '',
          isEntryPoint: !!f.isEntryPoint,
        };
      });
    }

    // Single-file answers carry the source in `codeAnswer` alone.
    const code = submissionQuestion?.codeAnswer || '';
    if (!code.trim()) return [];
    const lang = (submissionQuestion?.language || 'plaintext').toLowerCase();
    const name = `solution.${extForLanguage(lang)}`;
    return [{ path: name, name, language: lang, content: code, isEntryPoint: true }];
  }, [submissionQuestion, frontendSubmissionData]);

  /** Submitted files with any unsaved trainer edits layered on top. */
  const workingFiles: ConsoleFile[] = useMemo(
    () => submittedFiles.map((f) => ({ ...f, content: fileDrafts[f.path] ?? f.content })),
    [submittedFiles, fileDrafts],
  );

  const activeFile = useMemo(
    () => workingFiles.find((f) => f.path === selectedFilePath) || workingFiles[0] || null,
    [workingFiles, selectedFilePath],
  );

  // Open the entry point (or the first file) whenever the submission changes.
  useEffect(() => {
    const entry = submittedFiles.find((f) => f.isEntryPoint) || submittedFiles[0];
    setSelectedFilePath(entry?.path || '');
  }, [submittedFiles]);

  const exerciseLanguages = useMemo(() => {
    const configured = (selectedExercise?.programmingSettings?.selectedLanguages || []) as string[];
    return Array.from(
      new Set(
        [...configured, submissionQuestion?.language]
          .filter(Boolean)
          .map((l) => String(l).toLowerCase()),
      ),
    );
  }, [selectedExercise, submissionQuestion?.language]);

  useEffect(() => {
    setFileDrafts({});
    setCodeTab('editor');
    setFeedbackTab('write');
    setFeedbackOpen(false);
    setStdinText('');
    setWorkspaceExpanded(false);
  }, [selectedQuestion?._id, selectedParticipant?._id]);

  useEffect(() => {
    setRunLanguage((submissionQuestion?.language || exerciseLanguages[0] || 'java').toLowerCase());
  }, [submissionQuestion?.language, exerciseLanguages]);

  const consoleQuestions: ConsoleQuestion[] = useMemo(() => {
    if (!selectedExercise) return [];
    const all = selectedExercise.questions || [];
    return filteredQuestions.map((q) => {
      // The row must carry its index in the UNFILTERED list — that is what
      // handleQuestionClick and the Previous / Next arrows both index by.
      const trueIndex = Math.max(0, all.findIndex((x) => x._id === q._id));
      const submission = getSubmissionForQuestion(q._id);
      const qMax = getQuestionMaxScore(selectedExercise, q);
      const qIsMCQ = isQuestionMCQ(q);
      let displayScore = 0;
      if (submission) {
        if (submission.status === 'evaluated') displayScore = Number(submission.score) || 0;
        else if (qIsMCQ) displayScore = submission.isCorrect ? qMax : 0;
        else displayScore = Number(submission.score) || 0;
      }
      const kind: QuestionKind = isOthersQuestion(q, submission)
        ? 'OTHERS'
        : isFrontendQuestion(q, submission, selectedExercise as any)
          ? 'FRONTEND'
          : qIsMCQ
            ? 'MCQ'
            : 'CODE';
      return {
        id: q._id,
        index: trueIndex,
        number: trueIndex + 1,
        title: getQuestionLabel(q),
        kind,
        difficulty: getQuestionDisplayDifficulty(q) as Difficulty,
        score: displayScore,
        maxScore: qMax,
        hasSubmission: !!(
          submission?.codeAnswer ||
          submission?.files?.length ||
          submission?.othersFiles?.length ||
          (submission && submission.isCorrect !== undefined && submission.isCorrect !== null)
        ),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredQuestions, selectedExercise, selectedParticipant, gradeSaveTick]);

  /** Assessment-wide total behind the Overall Marks ring. */
  const overallMarks = useMemo(() => {
    if (!selectedExercise || !selectedParticipant) {
      return { earned: 0, total: 0, attempted: false };
    }
    const allQuestions = selectedExercise.questions || [];
    const answers = getExerciseAnswersForSelectedExercise(selectedParticipant);
    const total = getDynamicExerciseTotal(selectedExercise);
    // "Attempted" here gates whether we bother walking the earned-marks
    // accumulator below. It used to look at student-side signals ONLY —
    // codeAnswer, files, othersFiles, or an MCQ isCorrect flag — which
    // meant a Manual-evaluation exercise where the student saved a blank
    // submission and the trainer then hand-scored it stayed at 0 forever:
    // no content signal, no walk, no earned. Add two trainer-side signals
    // (`status === 'evaluated'` and any non-zero `score`) so a manually
    // graded row flips the ring the moment the mark lands.
    const attempted = answers.some((a) =>
      (a.questions || []).some((s) =>
        !!(s?.codeAnswer || s?.files?.length || s?.othersFiles?.length ||
          (s && s.isCorrect !== undefined && s.isCorrect !== null) ||
          s?.status === 'evaluated' ||
          (typeof s?.score === 'number' && s.score > 0))
      )
    );
    let earned = 0;
    if (attempted) {
      allQuestions.forEach((q) => {
        const qMax = getQuestionMaxScore(selectedExercise, q);
        let sub: SubmissionQuestion | null = null;
        for (const ans of answers) {
          const s = ans.questions.find((x) => x.questionId === q._id);
          if (s) { sub = s; break; }
        }
        if (!sub) return;
        const subScore = Number(sub.score) || 0;
        if (sub.status === 'evaluated') earned += Math.min(subScore, qMax);
        else if (isQuestionMCQ(q)) earned += sub.isCorrect ? qMax : 0;
        else earned += Math.min(subScore, qMax);
      });
    }
    return { earned: Math.round(earned * 100) / 100, total, attempted };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExercise, selectedParticipant, gradeSaveTick]);

  /** Submission History rows. The answer document keeps only the latest
   *  attempt per question, so this is a one-row table by design — the count
   *  in the Attempt column is what says how many tries it took. */
  const submissionAttempts: SubmissionAttempt[] = useMemo(() => {
    if (!submissionQuestion) return [];
    const meta = getCurrentAnswerMeta();
    const breakdown: any = (submissionQuestion as any).evaluationBreakdown;
    const passed = breakdown?.testcase?.passed ?? breakdown?.ai?.passedTestCases ?? null;
    const totalCases = breakdown?.testcase?.total ?? breakdown?.ai?.totalTestCases ?? null;
    const when = submissionQuestion.submittedAt || meta?.submittedAt;
    const mark = isQuestionMCQ(selectedQuestion)
      ? (submissionQuestion.isCorrect ? maxScore : 0)
      : Math.min(Number(submissionQuestion.score) || 0, maxScore);
    return [{
      attempt: meta?.attemptCount ?? submissionQuestion.attemptCount ?? 1,
      submittedOn: when ? new Date(when).toLocaleString('en-GB') : '—',
      status: submissionQuestion.status === 'evaluated' ? 'Evaluated' : 'Submitted',
      testCasesPassed: passed != null ? Number(passed) : null,
      testCasesTotal: totalCases != null ? Number(totalCases) : null,
      mark,
      maxMark: maxScore,
    }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionQuestion, selectedQuestion, maxScore, selectedParticipant]);

  const problemHtml = useMemo(() => {
    if (!selectedQuestion) return '';
    const raw: any = (selectedQuestion as any).description;
    if (typeof raw === 'string' && raw.trim()) return raw;
    const plain = getQuestionDescription(selectedQuestion);
    if (!plain) return '';
    // Rich-text questions already store markup; plain ones need a paragraph so
    // the panel's typography rules have something to hang off.
    return /<[a-z][\s\S]*>/i.test(plain) ? plain : `<p>${plain}</p>`;
  }, [selectedQuestion]);

  const consoleConstraints = useMemo(
    () => (((selectedQuestion as any)?.constraints || []) as any[])
      .map((c) => (typeof c === 'string' ? c : c?.text || String(c ?? '')))
      .filter((c: string) => !!c && !!c.trim()),
    [selectedQuestion],
  );

  const consoleHints = useMemo(
    () => (((selectedQuestion as any)?.hints || []) as any[])
      .map((h) => (typeof h === 'string' ? h : h?.hintText || h?.text || ''))
      .filter(Boolean),
    [selectedQuestion],
  );

  const consoleTestCases: ConsoleTestCase[] = useMemo(() => {
    const cases: any[] = ((selectedQuestion as any)?.testCases || []);
    if (cases.length > 0) {
      return cases.map((tc) => ({
        input: tc.input ?? tc.testInput ?? '',
        expectedOutput: tc.expectedOutput ?? tc.output ?? tc.expected ?? '',
        isHidden: tc.isHidden === true,
        explanation: tc.explanation || undefined,
      }));
    }
    if (selectedQuestion?.sampleInput || selectedQuestion?.sampleOutput) {
      return [{
        input: selectedQuestion.sampleInput || '',
        expectedOutput: selectedQuestion.sampleOutput || '',
      }];
    }
    return [];
  }, [selectedQuestion]);

  const consoleSolution = useMemo(() => {
    const q: any = selectedQuestion;
    if (typeof q?.solutionCode === 'string' && q.solutionCode.trim()) return q.solutionCode;
    if (typeof q?.solution === 'string' && q.solution.trim()) return q.solution;
    return '';
  }, [selectedQuestion]);

  const consoleLines: ConsoleLogLine[] = useMemo(
    () => terminalLogs.map((l) => ({ type: l.type, content: l.content })),
    [terminalLogs],
  );

  // ── Evaluation-method resolution + BottomPanel mode ──────────────────────
  // Mirrors the student-side `resolveEvaluationMethod` decision so the trainer
  // sees the exact same evaluation surface the student was graded against.
  // Legacy exercises (evaluationMethod not set) default to 'testcase' for a
  // You_Do assessment and 'manual' otherwise.
  const evalMethod: 'manual' | 'testcase' | 'ai' = useMemo(() => {
    const stored = (selectedExercise as any)?.evaluationMethod?.method;
    if (stored === 'manual' || stored === 'testcase' || stored === 'ai') return stored;
    const cat = (selectedExercise as any)?._category || '';
    return cat === 'You_Do' ? 'testcase' : 'manual';
  }, [selectedExercise]);

  // Manual → the panel is a plain terminal (no pass/fail chip). Test Case /
  // AI → the panel shows the Test Result surface with case chips + score.
  const bottomMode: 'terminal' | 'test-result' = evalMethod === 'manual' ? 'terminal' : 'test-result';

  // Adapt the review console's per-log type to the multi-file terminal's
  // TermLine shape. `stdin` is a distinct kind on the multi-file side so
  // typed input is echoed differently from stdout.
  const termLines: MFTermLine[] = useMemo(
    () => terminalLogs.map((l, i): MFTermLine => {
      const kind: MFTermLine['kind'] =
        l.type === 'stderr' ? 'stderr' :
          l.type === 'system' ? 'system' :
            (l.type as string) === 'error' ? 'error' :
              (l.type as string) === 'success' ? 'success' :
                (l.type as string) === 'info' ? 'info' :
                  l.type === 'stdin' ? 'stdin' : 'stdout';
      return { id: `t${i}`, kind, text: String(l.content ?? '') };
    }),
    [terminalLogs],
  );

  const headerStudents: ConsoleStudent[] = useMemo(
    () => participants.map((p) => ({
      id: p._id,
      name: `${p.user?.firstName || ''} ${p.user?.lastName || ''}`.trim() || p.user?.email || 'Student',
      role: p.user?.role?.renameRole || 'Student',
      avatarUrl: resolveAvatarUrl(p.user?.profile),
      initials: `${p.user?.firstName?.[0] || '?'}${p.user?.lastName?.[0] || ''}`.toUpperCase(),
    })),
    [participants],
  );

  const headerStudent = useMemo(
    () => headerStudents.find((s) => s.id === selectedParticipant?._id) || null,
    [headerStudents, selectedParticipant],
  );

  const consoleCrumbs: ConsoleBreadcrumb[] = useMemo(
    // Every level stays on screen and truncates individually. Collapsing the
    // middle into a single "…" hid exactly the crumbs that identify WHERE the
    // assessment lives, which is the reason to read the trail at all.
    () => breadcrumb.map((b) => b.title).filter(Boolean).map((label) => ({ label })),
    [breadcrumb],
  );

  const totalQuestions = selectedExercise?.questions?.length || 0;

  const goToQuestionIndex = (index: number) => {
    if (!selectedExercise) return;
    const q = selectedExercise.questions?.[index];
    if (q) handleQuestionClick(q, index);
  };

  // ── Manual Mark Override input ───────────────────────────────────────────
  // Shares `score` / `scoreDraft` with the rest of the page: the draft string
  // is what the trainer typed, `score` is what gets saved.
  const markInputValue = scoreDraft ?? String(score);

  const handleMarkInput = (raw: string) => {
    // Only accept text that can still grow into a mark — digits with at most
    // one decimal point. Anything else is dropped rather than parsed to NaN.
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
    const parsed = Number.parseFloat(raw);
    const value = Number.isFinite(parsed) ? parsed : 0;
    const clamped = clampScore(value);
    setScore(clamped);
    setScoreDraft(value === clamped ? raw : String(clamped));
  };

  const stepMark = (delta: number) => {
    setScore(clampScore(Math.round((score + delta) * 100) / 100));
    setScoreDraft(null);
  };

  // ── Piston helper: run one code sample against one stdin ────────────────
  // Extracted so the test-case-based mode can loop over every case without
  // re-tripping the interactive stdin plumbing initiateRunCode carries. Keeps
  // the same PISTON_API_URL + language map the original path uses.
  const pistonRunOnce = async (
    source: string,
    lang: string,
    stdin: string,
  ): Promise<{ stdout: string; stderr: string; runtimeMs: number | null; ok: boolean }> => {
    const langMap: Record<string, { language: string; version: string }> = {
      javascript: { language: "javascript", version: "18.15.0" },
      java: { language: "java", version: "15.0.2" },
      cpp: { language: "cpp", version: "10.2.0" },
      c: { language: "c", version: "10.2.0" },
      python: { language: "python", version: "3.10.0" },
    };
    const cfg = langMap[lang] || { language: 'javascript', version: '18.15.0' };
    try {
      const t0 = Date.now();
      const res = await fetch(PISTON_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: cfg.language,
          version: cfg.version,
          files: [{ content: source }],
          stdin,
        }),
      });
      const dt = Date.now() - t0;
      const data = await res.json();
      return {
        stdout: String(data?.run?.stdout ?? ''),
        stderr: String(data?.run?.stderr ?? ''),
        runtimeMs: dt,
        ok: res.ok,
      };
    } catch (err: any) {
      return { stdout: '', stderr: err?.message || 'Execution failed.', runtimeMs: null, ok: false };
    }
  };

  // Normalize two outputs before comparing — trailing whitespace and blank
  // final newline are the two things Piston consistently disagrees with
  // trainer-authored expected values on, and treating them as equal here is
  // what the server judge already does in codeJudge.js.
  const outputsMatch = (actual: string, expected: string): boolean => {
    const norm = (s: string) => (s ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
    return norm(actual) === norm(expected);
  };

  // Read this question's authored test cases + max marks in a single place so
  // the run/AI paths don't diverge on how they discover data.
  const currentQuestionTestCases = useMemo((): Array<{ input: string; expectedOutput: string; hidden: boolean }> => {
    const q: any = selectedQuestion;
    const raw = Array.isArray(q?.testCases) ? q.testCases : [];
    return raw
      .filter((t: any) => t && (typeof t.input === 'string' || typeof t.expectedOutput === 'string'))
      .map((t: any) => ({
        input: String(t.input ?? ''),
        expectedOutput: String(t.expectedOutput ?? ''),
        hidden: !!t.hidden,
      }));
  }, [selectedQuestion]);

  // ── Test-Case mode: run every configured test case via Piston ──────────
  const runAllTestCasesViaPiston = async (source: string, lang: string) => {
    if (currentQuestionTestCases.length === 0) {
      addLog('system', 'No test cases configured for this question.');
      return;
    }
    setTestResult({
      status: 'evaluating',
      cases: [],
      message: 'Running your code against every configured test case…',
    });
    let passed = 0;
    const cases: MFTestResultCase[] = [];
    for (let i = 0; i < currentQuestionTestCases.length; i++) {
      const tc = currentQuestionTestCases[i];
      const r = await pistonRunOnce(source, lang, tc.input);
      const actual = r.stdout || r.stderr || '';
      const ok = !r.stderr && outputsMatch(r.stdout, tc.expectedOutput);
      if (ok) passed += 1;
      cases.push({
        index: i,
        hidden: tc.hidden,
        passed: ok,
        unlocked: !tc.hidden,
        input: tc.hidden ? '' : tc.input,
        expectedOutput: tc.hidden ? '' : tc.expectedOutput,
        actualOutput: actual,
        errorMessage: r.stderr || undefined,
      });
    }
    const total = currentQuestionTestCases.length;
    setTestResult({
      status: passed === total ? 'accepted' : passed === 0 ? 'wrong-answer' : 'partial',
      cases,
      passedCount: passed,
      totalCount: total,
      score: maxScore > 0 ? Math.round((passed / total) * maxScore * 100) / 100 : 0,
      maxMarks: maxScore || null,
    });
    setSelectedCaseIndex(0);
  };

  // ── AI mode: send the code to the existing AI grader ───────────────────
  const runAiEvaluation = async (source: string, lang: string) => {
    setTestResult({ status: 'evaluating', cases: [], message: 'AI grader is scoring this submission…' });
    try {
      const q: any = selectedQuestion;
      // evaluateWithAi's input shape — reuse the same fields the multi-file
      // editor passes so the breakdown matches exactly.
      const result: any = await evaluateWithAi({
        code: source,
        language: lang,
        question: q,
        exercise: selectedExercise as any,
        maxMarks: maxScore || 0,
      } as any);
      // Map the grader's returned shape to a TestResultState. `evaluateWithAi`
      // hands back `breakdown` (criteria + testCases arrays); we surface both
      // in the same order the multi-file editor's BottomPanel expects.
      const cases: MFTestResultCase[] = Array.isArray(result?.breakdown?.testCases)
        ? result.breakdown.testCases.map((tc: any, i: number) => ({
            index: Number(tc?.index) ?? i,
            hidden: false,
            passed: !!tc?.passed,
            unlocked: true,
            source: tc?.source === 'ai' ? 'ai' : 'question',
            comment: typeof tc?.comment === 'string' ? tc.comment : undefined,
            input: typeof tc?.input === 'string' ? tc.input : '',
            expectedOutput: typeof tc?.expectedOutput === 'string' ? tc.expectedOutput : '',
            actualOutput: '',
          }))
        : [];
      const passedCount = Number(result?.breakdown?.passedTestCases) || cases.filter(c => c.passed).length;
      const totalCount = Number(result?.breakdown?.totalTestCases) || cases.length;
      setTestResult({
        status: result?.failed ? 'submission-failed'
          : passedCount === totalCount && totalCount > 0 ? 'accepted'
          : passedCount === 0 ? 'wrong-answer' : 'partial',
        cases,
        passedCount,
        totalCount,
        score: typeof result?.score === 'number' ? result.score : null,
        maxMarks: maxScore || null,
        ai: {
          criteria: Array.isArray(result?.breakdown?.criteria)
            ? result.breakdown.criteria.map((c: any) => ({
                key: String(c?.key || ''),
                label: String(c?.label || c?.key || ''),
                percentage: Number(c?.percentage) || 0,
                score: Number(c?.score) || 0,
                maxScore: Number(c?.maxScore) || 0,
                comment: typeof c?.comment === 'string' ? c.comment : undefined,
              }))
            : [],
          perCriterionMax: Number(result?.breakdown?.perCriterionMax) || 0,
          criteriaPortion: Number(result?.breakdown?.criteriaPortion) || 0,
          testCasePortion: Number(result?.breakdown?.testCasePortion) || 0,
          criteriaWeightPct: Number(result?.breakdown?.criteriaWeightPct) || 50,
          testCaseWeightPct: Number(result?.breakdown?.testCaseWeightPct) || 50,
          passedTestCases: passedCount,
          totalTestCases: totalCount,
          model: typeof result?.breakdown?.model === 'string' ? result.breakdown.model : undefined,
          failed: !!result?.failed,
        },
      });
      setSelectedCaseIndex(0);
    } catch (err: any) {
      setTestResult({
        status: 'submission-failed',
        cases: [],
        message: err?.message || 'AI grader was unreachable.',
      });
    }
  };

  // ── Run Code orchestrator ─────────────────────────────────────────────
  // Opens the BottomPanel, picks the right tab, then routes:
  //   • Python                → Pyodide (interactive stdin in the terminal)
  //   • Non-Python, Manual    → Piston with the first sample stdin, output to terminal
  //   • Non-Python, Test Case → Piston, loop every case, populate testResult
  //   • Non-Python, AI        → evaluateWithAi, populate testResult with breakdown
  const runConsoleCode = async () => {
    const source = activeFile?.content || '';
    const lang = ((activeFile?.language as string) || runLanguage || 'javascript').toLowerCase();
    if (!source.trim()) {
      toast.error('No code to execute');
      return;
    }
    setBottomOpen(true);
    setBottomTab(evalMethod === 'manual' ? 'terminal' : 'test-result');
    setLastRuntimeMs(null);

    if (lang === 'python') {
      // Python keeps its historical route: Pyodide via initiateRunCode, which
      // owns the interactive input line + stdout streaming.
      setBottomTab('terminal');
      return initiateRunCode({ source, language: lang, stdin: terminalStdin, useIoPanel: true });
    }

    if (evalMethod === 'testcase') {
      await runAllTestCasesViaPiston(source, lang);
      return;
    }
    if (evalMethod === 'ai') {
      await runAiEvaluation(source, lang);
      return;
    }
    // Manual — one-shot Piston run against the first authored test case's
    // input (if the trainer configured one) or an empty stdin otherwise.
    // No batch input box means we can't ask the trainer to type stdin here;
    // for a program that reads input, the first configured sample is the
    // only signal we have. Programs that don't read input just print and
    // land in the terminal exactly as before.
    const seed = currentQuestionTestCases[0]?.input || '';
    clearTerminal();
    addLog('system', `Preparing ${lang}…`);
    const r = await pistonRunOnce(source, lang, seed);
    setLastRuntimeMs(r.runtimeMs);
    if (r.stdout) addLog('stdout', r.stdout);
    if (r.stderr) addLog('stderr', r.stderr);
    addLog('system', r.ok ? 'Execution finished.' : 'Execution failed.');
  };

  const resetConsoleCode = () => {
    setFileDrafts({});
    toast.success('Restored the submitted code');
  };

  const handleConsoleSave = async () => {
    const ok = (isFrontendReview || isCodeMultiFileReview) && frontendSubmissionData
      ? await saveFrontendGrade(score, feedbackText)
      : await saveGrade();
    if (!ok || !moveToNextAfterSave) return;
    // Let the "Saved" state land before the console swaps question.
    setTimeout(() => {
      if (selectedExercise && currentQuestionIndex < selectedExercise.questions.length - 1) {
        goToQuestionIndex(currentQuestionIndex + 1);
      } else if (getCurrentStudentIndex() < getTotalStudents() - 1) {
        handleNextStudent();
      } else {
        toast.success('All graded!');
      }
    }, 700);
  };

  /** Cancel = discard unsaved grading edits, not leave the console. */
  const handleConsoleCancel = () => {
    if (submissionQuestion) {
      setScore(isQuestionMCQ(selectedQuestion)
        ? (submissionQuestion.isCorrect ? maxScore : 0)
        : Math.min(Number(submissionQuestion.score) || 0, maxScore));
      setFeedbackText(submissionQuestion.feedback || '');
    } else {
      setScore(0);
      setFeedbackText('');
    }
    setScoreDraft(null);
    setFileDrafts({});
    setFeedbackTab('write');
  };

  // The editor slab takes whatever the viewport has left after the header,
  // question row, tabs, toolbar and I/O bar — the console should read as an
  // IDE, not a page with an editor parked in the middle of it.
  const consoleEditorHeight = workspaceExpanded
    ? Math.max(320, viewportHeight - 150)
    : Math.max(320, viewportHeight - 470);

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
  // Show the full-page spinner during the initial data fetch AND until the
  // auto-select effect has picked a learner — the console is the only view
  // here, and rendering it with `selectedParticipant: null` flashes an empty
  // header/breadcrumb. The two extra conditions are what stop that spinner
  // from becoming permanent: no participants → the empty state below, no
  // resolved exercise → the "Exercise Not Found" state below. Both are cases
  // the auto-select effect deliberately bails out of.
  if (loading || (!selectedParticipant && participants.length > 0 && !!selectedExercise)) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  // --- RENDER NO LEARNERS ---
  // Nobody is enrolled, so there is no submission to grade. Deliberately
  // checked BEFORE the exercise guard: an empty roster is the more useful
  // thing to report, and it is the case the removed list view used to cover
  // by rendering an empty table.
  if (!loading && participants.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center text-slate-500 p-6">
        <Users className="w-16 h-16 mb-4 text-slate-300" />
        <h3 className={`text-xl font-bold text-slate-700 mb-3 ${inter.className}`}>
          No learners to review
        </h3>
        <p className="mb-6 max-w-md text-center text-slate-600">
          Nobody is enrolled in this course yet, so there are no submissions to grade.
        </p>
        <Button variant="outline" onClick={handleBack} className={`${inter.className}`}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
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

      {/* ── GRADING CONSOLE ──────────────────────────────────────────────
          Three columns under one fixed app header: the question rail, the
          submission workspace, and the grading controls. Every piece is a
          presentational component from `components/console`; this file owns
          all the state they read and every callback they fire. */}
      <AppHeader
        crumbs={consoleCrumbs}
        onHome={handleBack}
        student={headerStudent}
        students={headerStudents}
        onStudentChange={handleStudentChange}
        // STUDENT navigation only. Question navigation is QuestionHeader's
        // Previous / Next — the two must never share a handler.
        studentPosition={getTotalStudents() ? getCurrentStudentIndex() + 1 : 0}
        studentTotal={getTotalStudents()}
        onPrevStudent={handlePrevStudent}
        onNextStudent={handleNextStudent}
        canPrevStudent={getCurrentStudentIndex() > 0}
        canNextStudent={getCurrentStudentIndex() < getTotalStudents() - 1}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden bg-white">
        <AssessmentQuestionSidebar
          questions={consoleQuestions}
          selectedId={selectedQuestion?._id || null}
          filter={difficultyFilter}
          filterOptions={QUESTION_FILTERS}
          onFilterChange={setDifficultyFilter}
          onSelect={(q) => goToQuestionIndex(q.index)}
          onPreview={(q) => {
            setModalQuestion(selectedExercise?.questions?.find((x) => x._id === q.id) || null);
            setShowQuestionModal(true);
          }}
          showScore={!isNonGraded}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />

        <div className="flex min-w-0 flex-1 gap-3 overflow-hidden px-4 py-3.5">
          {/* ── CENTRE: question + submission ─────────────────────────── */}
          <div
            className={
              workspaceExpanded
                ? 'fixed inset-0 z-[60] flex min-h-0 flex-col gap-3 overflow-y-auto bg-white p-3 custom-scrollbar'
                : 'flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5 custom-scrollbar'
            }
          >
            <QuestionHeader
              number={currentQuestionIndex + 1}
              title={selectedQuestion ? getQuestionTitle(selectedQuestion) : 'No question selected'}
              difficulty={selectedQuestion ? getQuestionDisplayDifficulty(selectedQuestion) : ''}
              onPrev={() => goToQuestionIndex(currentQuestionIndex - 1)}
              onNext={() => goToQuestionIndex(currentQuestionIndex + 1)}
              canPrev={currentQuestionIndex > 0}
              canNext={currentQuestionIndex < totalQuestions - 1}
              expanded={workspaceExpanded}
              onToggleExpand={() => setWorkspaceExpanded((v) => !v)}
            />

            {!selectedQuestion ? (
              <div className="flex flex-none flex-col items-center justify-center gap-2 rounded-[10px] border border-[#DEE7F3] bg-white py-20 text-center">
                <FileQuestion className="h-8 w-8 text-[#8090AF]" />
                <span className="text-[13.5px] font-semibold text-[#39496B]">
                  Pick a question from the list to start grading
                </span>
              </div>
            ) : isFrontendReview && frontendSubmissionData ? (
              <div
                className="flex-none overflow-hidden rounded-[10px] border border-[#DEE7F3] bg-white"
                style={{ height: consoleEditorHeight + 97 }}
              >
                  <StaffFrontendReview
                    key={selectedQuestion._id}
                    onBack={() => {
                      setIsFrontendReview(false);
                      setFrontendSubmissionData(null);
                    }}
                    submission={{
                      files: frontendSubmissionData.files as any,
                      folders: frontendSubmissionData.folders as any,
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
                    initialFiles={frontendSubmissionData.files as any}
                    initialFolders={frontendSubmissionData.folders as any}
                    isLoadingSubmission={false}
                    selectedLanguages={[
                      ...(selectedExercise?.programmingSettings?.selectedLanguages || []),
                      ...(selectedExercise?.exerciseInformation?.selectedLanguages || []),
                    ]}
                    questionTitle={getQuestionTitle(selectedQuestion)}
                    questionId={selectedQuestion._id}
                    exerciseId={selectedExercise?._id}
                    exerciseName={selectedExercise?.exerciseInformation?.exerciseName}
                    participantId={selectedParticipant?.user?._id}
                    category={selectedExercise?._category}
                    subcategory={selectedExercise?._subcategory}
                  />
              </div>
            ) : isOthersReview ? (
              <div
                className="flex-none overflow-auto rounded-[10px] border border-[#DEE7F3] bg-white"
                style={{ height: consoleEditorHeight + 97 }}
              >
                <OthersReviewPanel
                  question={selectedQuestion}
                  submission={submissionQuestion}
                  inter={inter}
                />
              </div>
            ) : isQuestionMCQ(selectedQuestion) ? (
              <>
                  <div className="flex-none space-y-4 rounded-[10px] border border-[#DEE7F3] bg-white px-5 py-4">
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
                <SubmissionHistory
                  attempts={submissionAttempts}
                  onView={() => {
                    setModalQuestion(selectedQuestion);
                    setShowQuestionModal(true);
                  }}
                />
              </>
            ) : (
              <>
                <CodeWorkspace
                  activeTab={codeTab}
                  onTabChange={setCodeTab}
                  files={workingFiles}
                  selectedPath={activeFile?.path || ''}
                  onSelectFile={setSelectedFilePath}
                  onFileContentChange={(path, content) =>
                    setFileDrafts((drafts) => ({ ...drafts, [path]: content }))
                  }
                  toMonacoLanguage={getMonacoLanguage}
                  projectName={selectedQuestion ? getQuestionLabel(selectedQuestion) : 'submission'}
                  language={runLanguage}
                  languages={exerciseLanguages}
                  onLanguageChange={setRunLanguage}
                  onRun={runConsoleCode}
                  onReset={resetConsoleCode}
                  running={isExecuting}
                  descriptionHtml={problemHtml}
                  constraints={consoleConstraints}
                  hints={consoleHints}
                  testCases={consoleTestCases}
                  solution={consoleSolution}
                  editorHeight={consoleEditorHeight}
                  expanded={workspaceExpanded}
                  onToggleExpand={() => setWorkspaceExpanded((v) => !v)}
                />

                {/* Terminal + Test Result — same two-tab surface the multi-file
                    student editor uses. Collapsed by default; Run Code opens
                    it and picks the tab that matches the exercise's
                    evaluation method. */}
                <div className="border-t border-[#E7EEF8] bg-white">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBottomOpen((v) => !v)}
                        className="flex h-6 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2 text-[11.5px] font-semibold text-[#39496B] transition-colors hover:bg-[#F7FAFF]"
                        aria-expanded={bottomOpen}
                        aria-label={bottomOpen ? 'Hide terminal' : 'Show terminal'}
                      >
                        {bottomOpen ? '▾' : '▸'} {bottomMode === 'terminal' ? 'Terminal' : 'Test Result'}
                      </button>
                      {evalMethod !== 'manual' && (
                        <span className="rounded-[5px] bg-[#EEF2F8] px-2 py-[2px] text-[10px] font-semibold uppercase tracking-wide text-[#66789C]">
                          {evalMethod === 'ai' ? 'AI graded' : 'Test-case graded'}
                        </span>
                      )}
                    </div>
                    {isExecuting && (
                      <span className="text-[11px] font-medium text-[#B54708]">Running…</span>
                    )}
                  </div>
                  {bottomOpen && (
                    <div style={{ height: 260 }}>
                      <BottomPanel
                        activeTab={bottomTab}
                        onTabChange={setBottomTab}
                        mode={bottomMode}
                        testResult={testResult}
                        termLines={termLines}
                        running={isExecuting}
                        stdin={terminalStdin}
                        lastRuntime={lastRuntimeMs}
                        setStdin={setTerminalStdin}
                        onClearTerm={clearTerminal}
                        // `interactive` is FORCED to true regardless of
                        // language. That does two things at once:
                        //   • Python — Pyodide's live input line stays wired
                        //     to `handleTerminalInput`, so when the running
                        //     program hits `input()` the trainer types straight
                        //     into the terminal (same UX as the multi-file
                        //     student editor).
                        //   • Non-Python — the "Test case input (stdin)"
                        //     batch textarea RunTerminal shows in
                        //     interactive=false mode is hidden entirely. Piston
                        //     runs still get stdin (they read from the test
                        //     case's own `input`, not a trainer-typed box),
                        //     so nothing about test-case scoring is affected.
                        interactive={true}
                        awaitingInput={isWaitingForInput}
                        inputPrompt={inputPrompt}
                        onSubmitInput={handleTerminalInput}
                        selectedCaseIndex={selectedCaseIndex}
                        onSelectCase={setSelectedCaseIndex}
                      />
                    </div>
                  )}
                </div>

                <SubmissionHistory
                  attempts={submissionAttempts}
                  onView={() => {
                    const breakdown: any = (submissionQuestion as any)?.evaluationBreakdown;
                    const cases: any[] = Array.isArray(breakdown?.testcase?.cases)
                      ? breakdown.testcase.cases
                      : [];
                    // Prefer the recorded per-case results; fall back to the
                    // question profile when the submission was graded manually.
                    if (cases.length > 0) {
                      setTcModal({
                        cases,
                        passed: Number(breakdown?.testcase?.passed ?? 0),
                        total: Number(breakdown?.testcase?.total ?? cases.length),
                        title: selectedQuestion ? getQuestionTitle(selectedQuestion) : '',
                      });
                    } else {
                      setModalQuestion(selectedQuestion);
                      setShowQuestionModal(true);
                    }
                  }}
                />
              </>
            )}
          </div>

          {/* ── RESIZE HANDLE ─────────────────────────────────────────────
              Splits the centre workspace from the grading rail. Double-click
              snaps back to the default width, which is the only way out once a
              trainer has dragged it to an extreme. */}
          {!isNonGraded && !workspaceExpanded && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize grading panel"
              onMouseDown={handleGradingResizeStart}
              onDoubleClick={() => setGradingPanelWidth(RIGHT_PANEL_DEFAULT_WIDTH)}
              title="Drag to resize • double-click to reset"
              className={`group relative -mx-1.5 flex w-3 flex-none cursor-col-resize items-center justify-center ${
                isResizingGradingPanel ? 'text-[#2563EB]' : 'text-[#8090AF]'
              }`}
            >
              <span
                className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 rounded-full transition-colors ${
                  isResizingGradingPanel ? 'bg-[#2563EB]' : 'bg-[#DEE7F3] group-hover:bg-[#2563EB]'
                }`}
              />
              <span
                className={`relative flex h-8 w-3.5 items-center justify-center rounded-[4px] border bg-white shadow-sm transition-colors ${
                  isResizingGradingPanel
                    ? 'border-[#2563EB]'
                    : 'border-[#DEE7F3] group-hover:border-[#2563EB]'
                }`}
              >
                <ChevronsLeftRight className="h-3 w-3" />
              </span>
            </div>
          )}

          {/* ── RIGHT: grading controls ───────────────────────────────── */}
          {!isNonGraded && !workspaceExpanded && (
            <div
              style={{ width: gradingPanelWidth }}
              className="flex min-h-0 flex-none flex-col gap-3 overflow-y-auto pr-0.5 custom-scrollbar"
            >
              <OverallMarksCard
                earned={overallMarks.earned}
                total={overallMarks.total}
                attempted={overallMarks.attempted}
              />

              <ManualMarkOverride
                value={markInputValue}
                onValueChange={handleMarkInput}
                onCommit={() => setScoreDraft(null)}
                onStep={stepMark}
                max={maxScore}
                // Only test-case / AI exercises carry a machine score for this
                // mark to override; manual and legacy exercises are graded here,
                // so nothing about this field is optional there.
                optional={isAutoEvalExercise(selectedExercise)}
                // MCQ marks come straight from the answer key — there is no
                // partial credit to award, so the field is read-only there.
                disabled={isQuestionMCQ(selectedQuestion)}
              />

              <FeedbackCard
                value={feedbackText}
                onChange={setFeedbackText}
                tab={feedbackTab}
                onTabChange={setFeedbackTab}
                open={feedbackOpen}
                onToggleOpen={() => setFeedbackOpen((v) => !v)}
              />

              <GradingActions
                moveToNext={moveToNextAfterSave}
                onMoveToNextChange={setMoveToNextAfterSave}
                onCancel={handleConsoleCancel}
                onSave={handleConsoleSave}
                saving={isSaving}
                saved={saveSuccess}
              />
            </div>
          )}
        </div>
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

                    {!qIsMCQ && (() => {
                      // ALL non-hidden testCases, falling back to the legacy
                      // sampleInput / sampleOutput pair — same rule as the
                      // grading panel, so the modal never shows fewer cases.
                      const mTcs: any[] = ((q as any)?.testCases || []).filter((tc: any) => tc.isHidden !== true)
                      const mPairs: Array<{ input: string; output: string }> = mTcs.length > 0
                        ? mTcs
                            .map((tc: any) => ({ input: tc.input ?? tc.testInput ?? '', output: tc.expectedOutput ?? tc.output ?? '' }))
                            .filter((p: any) => p.input || p.output)
                        : (q.sampleInput || q.sampleOutput)
                          ? [{ input: q.sampleInput || '', output: q.sampleOutput || '' }]
                          : []
                      return mPairs.length > 0 ? (
                        <div className="space-y-3">
                          {mPairs.map((p, pi) => (
                            <div key={pi} className="grid grid-cols-2 gap-4">
                              {p.input && (
                                <div className="space-y-2">
                                  <h3 className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest ${inter.className}`}>Input Pattern{mPairs.length > 1 ? ` — Test ${pi + 1}` : ''}</h3>
                                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800"><pre className="text-[10px] font-mono text-emerald-400 whitespace-pre-wrap">{p.input}</pre></div>
                                </div>
                              )}
                              {p.output && (
                                <div className="space-y-2">
                                  <h3 className={`text-[10px] font-bold text-slate-500 uppercase tracking-widest ${inter.className}`}>Expected Output{mPairs.length > 1 ? ` — Test ${pi + 1}` : ''}</h3>
                                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800"><pre className="text-[10px] font-mono text-indigo-400 whitespace-pre-wrap">{p.output}</pre></div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null
                    })()}
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

      {/* ── Test-case details modal — opens from the "Passed X / Y test
             cases" summary on an auto-scored submission. Splits every
             case into Passed / Failed lists with input / expected /
             actual for each. Replaces the earlier hover-only tooltip
             that only surfaced failed cases. ── */}
      <Dialog open={!!tcModal} onOpenChange={(open) => { if (!open) setTcModal(null); }}>
        <DialogContent className={`max-w-2xl rounded-2xl ${inter.className}`}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700">
                <CheckCircle className="w-3.5 h-3.5" />
              </span>
              Test Case Details
              {tcModal?.title && <span className="text-[11px] font-medium text-slate-500 truncate">· {tcModal.title}</span>}
            </DialogTitle>
          </DialogHeader>
          {tcModal && (() => {
            const passedCases = tcModal.cases.filter((c: any) => c?.passed);
            const failedCases = tcModal.cases.filter((c: any) => !c?.passed);
            const renderCase = (c: any, i: number, kind: 'pass' | 'fail') => (
              <div key={`${kind}-${i}`} className="border border-slate-200 rounded-lg p-2.5 bg-white">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-bold text-[11px] text-slate-700">Test #{(c.index ?? i) + 1}</span>
                  {c.hidden && (
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-500">Hidden</span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase ${kind === 'pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {kind === 'pass' ? '✓ Pass' : '✗ Fail'}
                  </span>
                </div>
                {String(c.input || '') !== '' && (
                  <div className="text-[11px] text-slate-500 mb-0.5"><span className="font-semibold text-slate-600">input:</span> <span className="font-mono break-all whitespace-pre-wrap">{String(c.input).length > 300 ? String(c.input).slice(0, 300) + '…' : c.input}</span></div>
                )}
                <div className="text-[11px] text-slate-500 mb-0.5"><span className="font-semibold text-slate-600">expected:</span> <span className="font-mono break-all whitespace-pre-wrap">{String(c.expectedOutput ?? '').length > 300 ? String(c.expectedOutput).slice(0, 300) + '…' : (c.expectedOutput ?? '')}</span></div>
                <div className={`text-[11px] mb-0 ${kind === 'pass' ? 'text-emerald-700' : 'text-rose-600'}`}><span className="font-semibold">got:</span> <span className="font-mono break-all whitespace-pre-wrap">{String(c.actualOutput ?? '').length > 300 ? String(c.actualOutput).slice(0, 300) + '…' : (String(c.actualOutput ?? '') || '(no output)')}</span></div>
              </div>
            );
            return (
              <div className="max-h-[65vh] overflow-y-auto space-y-4 pt-2">
                <div className="flex items-center justify-between text-[12px] font-bold">
                  <span className="text-emerald-700">Passed: {tcModal.passed}</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-slate-700">Total: {tcModal.total}</span>
                  {failedCases.length > 0 && (
                    <span className="text-rose-600">Failed: {failedCases.length}</span>
                  )}
                </div>
                {tcModal.cases.length === 0 ? (
                  <p className="text-[12px] text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-lg">
                    Per-case details aren't stored on this submission (scored before detail recording was added). Use Rerun to re-score and capture them.
                  </p>
                ) : (
                  <>
                    {failedCases.length > 0 && (
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-rose-700 mb-1.5">Failed ({failedCases.length})</p>
                        <div className="space-y-1.5">
                          {failedCases.map((c, i) => renderCase(c, i, 'fail'))}
                        </div>
                      </div>
                    )}
                    {passedCases.length > 0 && (
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-1.5">Passed ({passedCases.length})</p>
                        <div className="space-y-1.5">
                          {passedCases.map((c, i) => renderCase(c, i, 'pass'))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })()}
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