import { getToken } from "@/lib/session";
import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, FileCode, RefreshCw, Loader2, Trash2,
  ChevronLeft, ChevronRight, MoreVertical, Calendar, Code,
  AlertTriangle, X, Zap, CheckCircle, Edit3, BarChart3, Clock,
  Laptop, Code2, Search,
  FileText, Database, Eye, PlayCircle, CheckCircle2, Check,
  ArrowLeft, GraduationCap, Award, HelpCircle, Info, XCircle,
  Terminal as TerminalIcon, RotateCcw, Flag, AlertCircle, ArrowRight,
  Maximize2, Minimize2, File as FileIcon, FolderPlus, FilePlus,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSectionHref } from '@/lib/sectionRoute';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });
import toast from 'react-hot-toast';  // instead of react-toastify
// import 'react-toastify/dist/ReactToastify.css';
import AddQuestionViaDocument from './AddQuestionViaDocument';

import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@radix-ui/react-select';

import ExerciseSettings from './ExerciseSettings';
import Questions from './QuestionsView';
import AddQuestionForm from './questionforms/AddQuestionForm';
import { exerciseApi, EntityType } from '@/apiServices/exercise';
import { resubmitExerciseForApproval } from '@/apiServices/userService';
import QuestionBankSelector from './questionforms/mcq/QuestionBankSelector';
import { Play } from 'next/font/google';
import { useQueryClient } from '@tanstack/react-query';
import TableFooter from '@/app/lms/shared/listing/TableFooter';

// ─── Design tokens (parity with QuestionsView) ────────────────────────────────
const JKT: React.CSSProperties = {
  fontFamily: "'Poppins', 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};


const isProgrammingType = (q: Question) =>
  q.questionType === 'programming' || q.questionType === 'database' || q.questionType === 'others';

// Pure `nodeType` → `EntityType` map. Lives at module scope so the render
// path can call it before its old in-component declaration would have
// initialised (the exercises cache key needs it during the first render).
const getEntityType = (nt: string): EntityType => {
  const map: Record<string, EntityType> = {
    module: 'modules', modules: 'modules',
    submodule: 'submodules', submodules: 'submodules',
    topic: 'topics', topics: 'topics',
    subtopic: 'subtopics', subtopics: 'subtopics',
  };
  return map[(nt || '').toLowerCase().trim()] || 'topics';
};
// ─────────────────────────────────────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface HierarchyData {
  courseName: string;
  moduleName: string;
  submoduleName: string;
  topicName: string;
  subtopicName: string;
  nodeType: string;
  level: number;
}

interface Question {
  _id: string;
  questionType: 'mcq' | 'programming';
  mcqQuestionScore?: number;
  score?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  [key: string]: any;
}

interface Exercise {
  _id: string;
  isGraded?: boolean;
  exerciseInformation: {
    exerciseId: string;
    exerciseName: string;
    description: string;
    exerciseLevel: 'beginner' | 'intermediate' | 'expert';
    totalDuration: number;
    totalMarks: number;
    totalMarksMCQ?: number;
    totalMarksProgramming?: number;
  };
  exerciseType: 'MCQ' | 'Programming' | 'Combined';
  tabType: 'I_Do' | 'We_Do' | 'You_Do';
  subcategory: string;
  configurationType: any;
  programmingSettings?: {
    selectedModule: string;
    selectedLanguages: string[];
  };
  questionConfiguration?: {
    mcqQuestionConfiguration?: {
      totalMcqQuestions: number;
      marksPerQuestion: number;
      mcqTotalMarks: number;
      scoringType?: string;
    };
    programmingQuestionConfiguration?: {
      questionConfigType: 'levelBased' | 'selectionLevel' | 'general';
      generalQuestionCount?: number;
      generalMarksPerQuestion?: number;
      levelBasedCounts?: { easy?: number; medium?: number; hard?: number };
      selectionLevelCounts?: { easy?: number; medium?: number; hard?: number };
      scoreSettings?: {
        totalMarks?: number;
        scoreType?: string;
        evenMarks?: number;
        levelBasedMarks?: { easy?: number; medium?: number; hard?: number };
        levelScoringConfiguration?: {
          easy?: { questionCount: number; totalMarks: number; marksPerQuestion: number; type?: string };
          medium?: { questionCount: number; totalMarks: number; marksPerQuestion: number; type?: string };
          hard?: { questionCount: number; totalMarks: number; marksPerQuestion: number; type?: string };
        };
      };
      allowCodeExecution?: boolean;
      enableTestCases?: boolean;
    };
  };
  availabilityPeriod?: {
    startDate?: string;
    endDate?: string;
    gracePeriodAllowed?: boolean;
    gracePeriodDate?: string;
    remainedMe?: string;
  };
  notificatonandGradeSettings?: {
    notifyUsers?: boolean;
    notifyGmail?: boolean;
    notifyWhatsApp?: boolean;
    gradeSheet?: boolean;
  };
  createdAt: string;
  updatedAt?: string;
  questions?: Question[];
  approvalWorkflow?: any;
}

interface ProblemSolvingProps {
  nodeId: string;
  nodeName: string;
  subcategory: string;
  subcategoryLabel: string;
  hierarchyData: HierarchyData;
  onRefresh?: () => Promise<void>;
  activeTab: 'I_Do' | 'We_Do' | 'You_Do';
  nodeType: string;
  courseId: string;
  configuredLanguages?: { coreProgram?: string[]; frontend?: string[]; database?: string[] };
  isHeaderHidden?: boolean;
  onShowHeader?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helper functions (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const calculateTotalMCQScore = (ex: Exercise): number =>
  (ex.questions ?? []).filter(q => q.questionType === 'mcq')
    .reduce((s, q) => s + (q.mcqQuestionScore ?? 0), 0);

const calculateTotalProgrammingScore = (ex: Exercise): number =>
  (ex.questions ?? []).filter(isProgrammingType)
    .reduce((s, q) => s + (q.score ?? 0), 0);


const getMCQQuestionCount = (ex: Exercise): number =>
  (ex.questions ?? []).filter(q => q.questionType === 'mcq').length;

const getProgrammingCountByDiff = (ex: Exercise, diff: 'easy' | 'medium' | 'hard'): number =>
  (ex.questions ?? []).filter(q => isProgrammingType(q) && q.difficulty === diff).length;
const getProgrammingScoreByDiff = (ex: Exercise, diff: 'easy' | 'medium' | 'hard'): number =>
  (ex.questions ?? [])
    .filter(q => isProgrammingType(q) && q.difficulty === diff)
    .reduce((s, q) => s + (q.score ?? 0), 0);

const calculateTotalScore = (ex: Exercise): number =>
  (ex.questions ?? []).reduce((s, q) =>
    s + (q.questionType === 'mcq' ? (q.mcqQuestionScore ?? 0) : isProgrammingType(q) ? (q.score ?? 0) : 0), 0);

// Approval snapshot for the trainer's list — mirrors the transform used by
// the You_Do assessment list. `status` is null when no workflow is attached
// (nothing to show). `hasRejectedQuestions` covers per-question rejects,
// which don't flip the workflow's overallStatus.
const getApprovalInfo = (ex: Exercise) => {
  const wf: any = ex.approvalWorkflow;
  let status: 'in_progress' | 'approved' | 'rejected' | null = null;
  let stepRole: string | null = null;
  let rejectionMessage: string | null = null;
  let rejectedByRole: string | null = null;
  if (wf && Array.isArray(wf.steps) && wf.steps.length > 0) {
    status = wf.overallStatus || 'in_progress';
    if (status === 'in_progress') {
      stepRole = wf.steps[(wf.currentStep || 1) - 1]?.roleName || null;
    } else if (status === 'rejected') {
      const rejStep = wf.steps.find((s: any) => s.status === 'rejected');
      rejectionMessage = rejStep?.comment || null;
      rejectedByRole = rejStep?.roleName || null;
    }
  }
  const hasRejectedQuestions = (ex.questions ?? []).some((q: any) => q?.approval?.status === 'rejected');
  const resubmissionCount = wf?.resubmissionCount || 0;
  return { status, stepRole, rejectionMessage, rejectedByRole, hasRejectedQuestions, resubmissionCount };
};

const getRemainingMarks = (ex: Exercise): number =>
  Math.max(0, (ex.exerciseInformation?.totalMarks ?? 0) - calculateTotalScore(ex));

const getScoreUsagePercentage = (ex: Exercise): number => {
  const total = ex.exerciseInformation?.totalMarks ?? 0;
  if (total === 0) return 0;
  return Math.min(100, (calculateTotalScore(ex) / total) * 100);
};

const canAddMCQInCombined = (ex: Exercise): { canAdd: boolean; reason?: string } => {
  const cfg = ex.questionConfiguration?.mcqQuestionConfiguration;
  if (!cfg) return { canAdd: false, reason: 'MCQ configuration not found' };
  const count = getMCQQuestionCount(ex);
  const score = calculateTotalMCQScore(ex);
  if (count >= cfg.totalMcqQuestions)
    return { canAdd: false, reason: `MCQ limit reached (${count}/${cfg.totalMcqQuestions})` };
  if (score >= cfg.mcqTotalMarks)
    return { canAdd: false, reason: `MCQ marks limit reached (${score}/${cfg.mcqTotalMarks})` };
  return { canAdd: true };
};

const canAddProgrammingInCombined = (
  ex: Exercise,
  diff: 'easy' | 'medium' | 'hard'
): { canAdd: boolean; reason?: string; remainingCount?: number; remainingMarks?: number } => {
  const progCfg = ex.questionConfiguration?.programmingQuestionConfiguration;
  if (!progCfg) return { canAdd: false, reason: 'Programming configuration not found' };
  const configType = progCfg.questionConfigType;
  if (configType === 'general') {
    const maxQ = progCfg.generalQuestionCount ?? Infinity;
    const maxM = progCfg.scoreSettings?.totalMarks ?? 0;
    const curCnt = (ex.questions ?? []).filter(isProgrammingType).length;
    const curScr = calculateTotalProgrammingScore(ex);
    if (curCnt >= maxQ) return { canAdd: false, reason: `Programming limit reached (${curCnt}/${maxQ})`, remainingCount: 0 };
    if (maxM > 0 && curScr >= maxM) return { canAdd: false, reason: `Programming marks limit reached (${curScr}/${maxM})`, remainingMarks: 0 };
    return {
      canAdd: true,
      remainingCount: maxQ === Infinity ? undefined : (maxQ as number) - curCnt,
      remainingMarks: maxM > 0 ? maxM - curScr : undefined,
    };
  }
  if (configType === 'levelBased') {
    const lc = progCfg.scoreSettings?.levelScoringConfiguration?.[diff];
    if (!lc) return { canAdd: false, reason: `${diff} level not configured` };
    const cnt = getProgrammingCountByDiff(ex, diff);
    const scr = getProgrammingScoreByDiff(ex, diff);
    const isQspec = (lc as any).type === 'question_specific';
    if (cnt >= lc.questionCount) return { canAdd: false, reason: `${diff} count limit (${cnt}/${lc.questionCount})`, remainingCount: 0, remainingMarks: lc.totalMarks - scr };
    if (!isQspec && scr >= lc.totalMarks) return { canAdd: false, reason: `${diff} marks limit (${scr}/${lc.totalMarks})`, remainingCount: lc.questionCount - cnt, remainingMarks: 0 };
    return { canAdd: true, remainingCount: lc.questionCount - cnt, remainingMarks: isQspec ? undefined : lc.totalMarks - scr };
  }
  if (configType === 'selectionLevel') {
    const sel = progCfg.selectionLevelCounts ?? {};
    if (!sel[diff] || sel[diff] === 0) return { canAdd: false, reason: `${diff} level not enabled` };
    const cnt = getProgrammingCountByDiff(ex, diff);
    const max = sel[diff]!;
    if (cnt >= max) return { canAdd: false, reason: `${diff} count limit (${cnt}/${max})`, remainingCount: 0 };
    return { canAdd: true, remainingCount: max - cnt };
  }
  return { canAdd: false, reason: 'Unknown config type' };
};

const canAddAnyQuestionInCombined = (ex: Exercise): {
  canAddMCQ: boolean; canAddProgramming: boolean;
  mcqReason?: string; programmingReason?: string; hasAnyAvailable: boolean;
} => {
  const mcqChk = canAddMCQInCombined(ex);
  const progCfg = ex.questionConfiguration?.programmingQuestionConfiguration;
  let canAddProg = false, progReason = '';
  if (!progCfg) {
    progReason = 'Programming configuration not found';
  } else {
    const ct = progCfg.questionConfigType;
    if (ct === 'general') {
      const maxQ = progCfg.generalQuestionCount ?? Infinity;
      const curCnt = (ex.questions ?? []).filter(isProgrammingType).length;

      if (curCnt >= maxQ) { progReason = `Programming limit (${curCnt}/${maxQ})`; canAddProg = false; }
      else { canAddProg = true; progReason = `${maxQ - curCnt} questions remaining`; }
    } else if (ct === 'levelBased') {
      const lc = progCfg.scoreSettings?.levelScoringConfiguration;
      const diffs: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
      const reasons: string[] = [];
      diffs.forEach(d => {
        if ((lc as any)?.[d]) { const r = canAddProgrammingInCombined(ex, d); if (r.canAdd) canAddProg = true; else reasons.push(`${d}: ${r.reason}`); }
      });
      progReason = reasons.join('; ');
    } else if (ct === 'selectionLevel') {
      const sel = progCfg.selectionLevelCounts ?? {};
      const diffs: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
      const reasons: string[] = [];
      diffs.forEach(d => {
        if ((sel[d] ?? 0) > 0) { const r = canAddProgrammingInCombined(ex, d); if (r.canAdd) canAddProg = true; else reasons.push(`${d}: ${r.reason}`); }
      });
      progReason = reasons.join('; ');
    }
  }
  return { canAddMCQ: mcqChk.canAdd, canAddProgramming: canAddProg, mcqReason: mcqChk.reason, programmingReason: progReason, hasAnyAvailable: mcqChk.canAdd || canAddProg };
};

const hasReachedMaxMarks = (ex: Exercise): boolean => {
  if (ex.exerciseType === 'Combined') {
    const { canAddMCQ, canAddProgramming } = canAddAnyQuestionInCombined(ex);
    return !canAddMCQ && !canAddProgramming;
  }
  if (ex.exerciseType === 'Programming' || ex.exerciseType === 'Other') {
    const progCfg = ex.questionConfiguration?.programmingQuestionConfiguration;
    if (progCfg?.questionConfigType === 'general' && progCfg.generalQuestionCount != null) {
      const curCnt = (ex.questions ?? []).filter(isProgrammingType).length;
      return curCnt >= progCfg.generalQuestionCount;
    }
    if (progCfg?.questionConfigType === 'levelBased' || progCfg?.questionConfigType === 'selectionLevel') {
      const diffs: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
      return diffs.every(d => !canAddProgrammingInCombined(ex, d).canAdd);
    }
  }
  return calculateTotalScore(ex) >= (ex.exerciseInformation?.totalMarks ?? 0);
};

// Returns true only when all required exercise settings fields are filled
const isExerciseComplete = (ex: Exercise): boolean => {
  if (!ex.exerciseType) return false;
  if (!ex.exerciseInformation?.exerciseName?.trim()) return false;
  if (!ex.availabilityPeriod?.startDate) return false;

  if (ex.isGraded !== false) {
    if (ex.exerciseType === 'Combined') {
      if ((ex.exerciseInformation?.totalMarksMCQ ?? 0) <= 0) return false;
      if ((ex.exerciseInformation?.totalMarksProgramming ?? 0) <= 0) return false;
    } else {
      if ((ex.exerciseInformation?.totalMarks ?? 0) <= 0) return false;
    }
  }

  const saved: string[] = Array.isArray((ex as any).stepsSaved)
    ? (ex as any).stepsSaved
    : [];

  const requiredSteps = [
    'Exercise Details',
    'Question Configuration',
    'Schedule',
    'Notifications',
  ];

  // Accept both "Mark Settings" and "Grade Settings"
  if (ex.isGraded !== false) requiredSteps.push('Grade Settings');

  return requiredSteps.every(step => saved.includes(step));
};
interface LevelDetail {
  available: boolean; current: number; max: number;
  currentMarks: number; maxMarks: number;
  remainingCount: number; remainingMarks?: number; reason: string;
}

interface ProgrammingStatusFull {
  available: boolean;
  configType: 'general' | 'levelBased' | 'selectionLevel' | 'unknown';
  generalCurrent?: number; generalMax?: number;
  generalCurrentMarks?: number; generalMaxMarks?: number;
  generalRemainingCount?: number; generalRemainingMarks?: number;
  marksPerQuestion?: number;
  levels: Record<string, LevelDetail>;
  reason: string;
}

const buildProgrammingStatus = (exercise: Exercise): ProgrammingStatusFull => {
  const progCfg = exercise.questionConfiguration?.programmingQuestionConfiguration;
  const empty: ProgrammingStatusFull = { available: false, configType: 'unknown', levels: {}, reason: 'Programming configuration not found' };
  if (!progCfg) return empty;
  const ct = progCfg.questionConfigType;
  const allProgQuestions = (exercise.questions ?? []).filter(isProgrammingType);
  if (ct === 'general') {
    const maxQ = progCfg.generalQuestionCount ?? 0;
    const maxM = progCfg.scoreSettings?.totalMarks ?? 0;
    const marksPerQ = progCfg.generalMarksPerQuestion ?? progCfg.scoreSettings?.evenMarks ?? 0;
    const curCnt = allProgQuestions.length;
    const curScr = calculateTotalProgrammingScore(exercise);
    const available = maxQ > 0 ? curCnt < maxQ : true;
    return {
      available, configType: 'general',
      generalCurrent: curCnt, generalMax: maxQ > 0 ? maxQ : undefined,
      generalCurrentMarks: curScr, generalMaxMarks: maxM > 0 ? maxM : undefined,
      generalRemainingCount: maxQ > 0 ? Math.max(0, maxQ - curCnt) : undefined,
      generalRemainingMarks: maxM > 0 ? Math.max(0, maxM - curScr) : undefined,
      marksPerQuestion: marksPerQ > 0 ? marksPerQ : undefined,
      levels: {},
      reason: available ? '' : (maxQ > 0 && curCnt >= maxQ ? `Question limit reached (${curCnt}/${maxQ})` : `Marks limit reached (${curScr}/${maxM})`),
    };
  }
  if (ct === 'levelBased') {
    const lscfg = progCfg.scoreSettings?.levelScoringConfiguration ?? {};
    const diffs: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
    let anyAvail = false;
    const levels: Record<string, LevelDetail> = {};
    diffs.forEach(d => {
      const lc = (lscfg as any)[d];
      if (!lc || lc.questionCount === 0) return;
      const cnt = getProgrammingCountByDiff(exercise, d);
      const scr = getProgrammingScoreByDiff(exercise, d);
      const isQspec = lc.type === 'question_specific';
      const countAvail = cnt < lc.questionCount, marksAvail = isQspec || scr < lc.totalMarks;
      const avail = countAvail && marksAvail;
      if (avail) anyAvail = true;
      levels[d] = { available: avail, current: cnt, max: lc.questionCount, currentMarks: scr, maxMarks: lc.totalMarks, remainingCount: Math.max(0, lc.questionCount - cnt), remainingMarks: isQspec ? undefined : Math.max(0, lc.totalMarks - scr), reason: !countAvail ? `Count full (${cnt}/${lc.questionCount})` : !marksAvail ? `Marks full (${scr}/${lc.totalMarks})` : '' };
    });
    return { available: anyAvail, configType: 'levelBased', levels, reason: anyAvail ? '' : 'All difficulty slots filled' };
  }
  if (ct === 'selectionLevel') {
    const sel = progCfg.selectionLevelCounts ?? {};
    const diffs: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
    let anyAvail = false;
    const levels: Record<string, LevelDetail> = {};
    diffs.forEach(d => {
      const max = (sel as any)[d] ?? 0;
      if (max === 0) return;
      const cnt = getProgrammingCountByDiff(exercise, d);
      const scr = getProgrammingScoreByDiff(exercise, d);
      const avail = cnt < max;
      if (avail) anyAvail = true;
      levels[d] = { available: avail, current: cnt, max, currentMarks: scr, maxMarks: 0, remainingCount: Math.max(0, max - cnt), reason: avail ? '' : `Count full (${cnt}/${max})` };
    });
    return { available: anyAvail, configType: 'selectionLevel', levels, reason: anyAvail ? '' : 'All difficulty slots filled' };
  }
  return empty;
};



// Add this new component before ProblemSolving component or in a separate file

// ─────────────────────────────────────────────────────────────────────────────
// ExerciseMockPreviewModal - Full exercise mock preview with all questions
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ExerciseMockPreviewModal - Matches ProgrammingMockModal layout exactly
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// ExerciseMockPreviewModal - Full exercise mock preview with all questions
// ─────────────────────────────────────────────────────────────────────────────

interface ExerciseMockPreviewModalProps {
  exercise: Exercise;
  onClose: () => void;
  configuredLanguages?: { coreProgram?: string[]; frontend?: string[]; database?: string[] };
}

interface ConsoleLine {
  id: string;
  type: 'output' | 'error' | 'system' | 'input';
  text: string;
}

// ── MCQ design tokens (mirrors mcq.tsx) ──────────────────────────────────
const MCQ_T = {
  orange:'#F27757', orangeDark:'#E0623F', orangeGlow:'rgba(242,119,87,0.22)',
  orangeLight:'rgba(242,119,87,0.08)',
  textMain:'#1a1a2e', textSub:'#6b6b7e', textMuted:'#9b9bae', textHint:'#bcbccc',
  border:'#eaeaef', borderLight:'#f4f4f7', bg:'#ffffff', pageBg:'#f9f9fb',
  green:'#22c55e', greenLight:'rgba(34,197,94,0.09)', greenDark:'#16a34a',
  red:'#ef4444', redLight:'rgba(239,68,68,0.09)',
  amber:'#f59e0b', amberLight:'rgba(245,158,11,0.09)',
  blue:'#fb923c', blueLight:'rgba(251,146,60,0.09)',
  purple:'#8b5cf6', purpleLight:'rgba(139,92,246,0.09)',
} as const;
const MCQ_FONT = "'Poppins',-apple-system,BlinkMacSystemFont,sans-serif";
const MCQ_DIFF: Record<string,{text:string;bg:string;dot:string}> = {
  easy:{text:MCQ_T.greenDark,bg:MCQ_T.greenLight,dot:MCQ_T.green},
  medium:{text:'#b45309',bg:MCQ_T.amberLight,dot:MCQ_T.amber},
  hard:{text:'#dc2626',bg:MCQ_T.redLight,dot:MCQ_T.red},
};

const MCQ_HINT_TEXT: Record<string, string> = {
  multiple_choice: 'Choose one answer.',
  multiple_select: 'Select all that apply.',
  true_false: 'Choose True or False.',
  dropdown: 'Pick from the dropdown.',
  short_answer: 'Type a brief answer.',
  essay: 'Write a detailed answer.',
  numeric: 'Enter your numeric answer.',
  matching: 'Drag left items onto right items to match.',
  ordering: 'Drag items to arrange in the correct order.',
};

// Local content-block renderer — mirrors mcq.tsx's ContentBlockRenderer (preview-only, no side-effects)
const decodeHTMLEntities = (text: string) => {
  if (!text) return '';
  if (typeof document === 'undefined') return text;
  const ta = document.createElement('textarea');
  ta.innerHTML = text;
  return ta.value;
};
const PreviewContentBlocks: React.FC<{ title: any }> = ({ title }) => {
  const T = MCQ_T;
  const renderHTML = (html: string) => {
    if (!html) return null;
    let decoded = html;
    if (html.includes('&nbsp;') || html.includes('&lt;') || html.includes('&gt;') || html.includes('&amp;')) {
      decoded = decodeHTMLEntities(html);
    }
    const clean = decoded.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return <div dangerouslySetInnerHTML={{ __html: clean }} />;
  };
  if (Array.isArray(title)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
        {title.map((b: any, i: number) => {
          if (b.type === 'text' && b.value) {
            const isHeading = /<h[1-6][^>]*>/.test(b.value);
            const isBold = /<b>|<strong>/.test(b.value) && !isHeading;
            return (
              <div key={b.id || i}
                style={{ fontSize: isHeading ? 18 : isBold ? 16 : 15, fontWeight: isHeading ? 700 : isBold ? 600 : 500, color: T.textMain, lineHeight: 1.55 }}>
                {renderHTML(b.value)}
              </div>
            );
          }
          if (b.type === 'code' && b.value) {
            return (
              <pre key={b.id || i} style={{ margin: 0, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.65, fontFamily: 'Menlo,Monaco,monospace', color: '#d4d4d4', background: b.bgColor || '#1e1e1e', borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre' as const }}>
                {b.value}
              </pre>
            );
          }
          if (b.type === 'image' && b.url) {
            const align = b.alignment === 'right' ? 'flex-end' : b.alignment === 'center' ? 'center' : 'flex-start';
            return (
              <div key={b.id || i} style={{ display: 'flex', justifyContent: align as any }}>
                <img src={b.url} alt="" style={{ maxWidth: `${b.sizePercent || 60}%`, height: 'auto', borderRadius: 8, border: `1px solid ${T.border}` }} />
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 16, fontWeight: 600, color: T.textMain, lineHeight: 1.55 }}>
      {renderHTML(typeof title === 'string' ? title : '')}
    </div>
  );
};

// ── Frontend mock body (HTML/CSS/JS tabbed editor + live iframe preview) ──
// Defined as a separate component so its hooks don't run inside conditional branches.
interface FrontendMockBodyProps {
  currentIndex: number;
  allQuestions: any[];
  setCurrentIndex: (n: number) => void;
  onClose: () => void;
  exercise: Exercise;
  currentQ: any;
  renderTypedTopChrome: (typeLabel: string, langSelector?: React.ReactNode) => React.ReactNode;
  renderTypedProblemPanel: () => React.ReactNode;
  TYPED_FONT: string;
}
const FrontendMockBody: React.FC<FrontendMockBodyProps> = ({
  currentIndex, allQuestions, setCurrentIndex, onClose, exercise, currentQ,
  renderTypedTopChrome, renderTypedProblemPanel, TYPED_FONT,
}) => {
  const [html, setHtml] = useState<string>(currentQ?.starterHtml || currentQ?.html || '<h1>Hello, world!</h1>\n<p>Edit me on the HTML tab.</p>');
  const [css, setCss] = useState<string>(currentQ?.starterCss || currentQ?.css || 'body { font-family: system-ui, sans-serif; padding: 24px; color: #1a1a2e; }\nh1 { color: #F27757; }');
  const [js, setJs] = useState<string>(currentQ?.starterJs || currentQ?.js || '// Write JS here\nconsole.log("ready");');
  const [activeTab, setActiveTab] = useState<'html'|'css'|'js'>('html');
  const [previewKey, setPreviewKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset on question change
  useEffect(() => {
    setHtml(currentQ?.starterHtml || currentQ?.html || '<h1>Hello, world!</h1>\n<p>Edit me on the HTML tab.</p>');
    setCss(currentQ?.starterCss || currentQ?.css || 'body { font-family: system-ui, sans-serif; padding: 24px; color: #1a1a2e; }\nh1 { color: #F27757; }');
    setJs(currentQ?.starterJs || currentQ?.js || '// Write JS here\nconsole.log("ready");');
    setActiveTab('html');
    setPreviewKey(k => k + 1);
  }, [currentIndex]);

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}<script>try{${js}}catch(e){document.body.insertAdjacentHTML('beforeend','<pre style=\\'color:#dc2626;font-family:ui-monospace,monospace;font-size:12px;padding:8px;background:#fef2f2;border:1px solid #fecaca;border-radius:4px;margin-top:12px\\'>'+(e&&e.message?e.message:String(e))+'</pre>');}</script></body></html>`;

  const tabs: { id: 'html'|'css'|'js'; label: string; lang: string; color: string }[] = [
    { id: 'html', label: 'index.html', lang: 'html', color: '#F27757' },
    { id: 'css', label: 'style.css', lang: 'css', color: '#3b82f6' },
    { id: 'js', label: 'script.js', lang: 'javascript', color: '#f59e0b' },
  ];
  const activeContent = activeTab === 'html' ? html : activeTab === 'css' ? css : js;
  const setActiveContent = (v: string) => {
    if (activeTab === 'html') setHtml(v);
    else if (activeTab === 'css') setCss(v);
    else setJs(v);
  };

  return (
    <div style={{ position: 'fixed' as const, inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column' as const, background: '#f8f9fa', fontFamily: TYPED_FONT, overflow: 'hidden' }}>
      <style>{`
        .mock-prose, .mock-prose * { text-align: left !important; }
        .mock-prose p { margin: 0 0 8px 0; }
        .mock-prose pre { background:#f5f5f5; border-radius:6px; padding:10px 12px; font-family:ui-monospace,monospace; font-size:12.5px; overflow-x:auto; }
        .mock-prose code { background:#f5f5f5; padding:1px 5px; border-radius:4px; font-family:ui-monospace,monospace; font-size:12.5px; }
        .mock-s::-webkit-scrollbar { width:7px; height:7px; }
        .mock-s::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:99px; }
      `}</style>
      {renderTypedTopChrome('Frontend')}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: '28%', minWidth: 300, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>PROBLEM</span>
            {allQuestions.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)} disabled={currentIndex === 0}
                  style={{ padding: '0 8px', height: 24, borderRadius: 5, border: '1px solid #c7d2fe', background: currentIndex === 0 ? '#f5f5f5' : '#eef2ff', color: currentIndex === 0 ? '#9ca3af' : '#4338ca', fontSize: 11, fontWeight: 500, cursor: currentIndex === 0 ? 'not-allowed' as const : 'pointer' as const, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  <ChevronLeft size={11}/> Prev
                </button>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', minWidth: 34, textAlign: 'center' as const }}>{currentIndex + 1}/{allQuestions.length}</span>
                <button onClick={() => currentIndex < allQuestions.length - 1 && setCurrentIndex(currentIndex + 1)} disabled={currentIndex >= allQuestions.length - 1}
                  style={{ padding: '0 8px', height: 24, borderRadius: 5, border: '1px solid #fed7aa', background: currentIndex >= allQuestions.length - 1 ? '#f5f5f5' : '#fff7ed', color: currentIndex >= allQuestions.length - 1 ? '#9ca3af' : '#ea580c', fontSize: 11, fontWeight: 500, cursor: currentIndex >= allQuestions.length - 1 ? 'not-allowed' as const : 'pointer' as const, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  Next <ChevronRight size={11}/>
                </button>
              </div>
            )}
          </div>
          {renderTypedProblemPanel()}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', background: '#fff' }}>
          <div style={{ flexShrink: 0, height: 38, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'stretch', background: '#fafafa' }}>
            {tabs.map(t => {
              const active = activeTab === t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 16px', background: active ? '#fff' : 'transparent', borderRight: '1px solid #e5e7eb', borderBottom: active ? `2px solid ${t.color}` : '2px solid transparent', color: active ? '#1a1a2e' : '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' as const, fontFamily: TYPED_FONT }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color }}/>
                  {t.label}
                </button>
              );
            })}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px' }}>
              <button onClick={() => setPreviewKey(k => k + 1)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 14px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' as const, fontFamily: TYPED_FONT }}>
                <PlayCircle size={12}/> Run
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <div style={{ flex: 1, minWidth: 0, borderRight: '1px solid #e5e7eb' }}>
              <MonacoEditor
                key={`mock-fe-${currentIndex}-${activeTab}`}
                height="100%"
                language={activeTab === 'html' ? 'html' : activeTab === 'css' ? 'css' : 'javascript'}
                value={activeContent}
                onChange={(v) => setActiveContent(v || '')}
                theme="vs-dark"
                options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on' as const, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: 'on' as const, padding: { top: 10 } }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' as const, background: '#fff' }}>
              <div style={{ flexShrink: 0, padding: '6px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Eye size={12} style={{ color: '#fb923c' }}/>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', letterSpacing: '0.04em' }}>PREVIEW</span>
              </div>
              <iframe key={previewKey} ref={iframeRef} title="Frontend Preview" sandbox="allow-scripts" srcDoc={srcDoc}
                style={{ flex: 1, border: 'none', background: '#fff' }}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExerciseMockPreviewModal: React.FC<ExerciseMockPreviewModalProps> = ({
  exercise,
  onClose,
  configuredLanguages,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [code, setCode] = useState('');
  const [lang, setLang] = useState('python');
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [consoleInput, setConsoleInput] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  // MCQ mock state
  const [selectedOptions, setSelectedOptions] = useState<Map<number,string>>(new Map());
  const [revealedSet, setRevealedSet] = useState<Set<number>>(new Set());
  // Programming mock layout state (mirrors code-editor.tsx visual chrome)
  const [showTerminal, setShowTerminal] = useState(true);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [progSidebarTab, setProgSidebarTab] = useState<'files'|'search'>('files');
  const [progDifficultyFilter, setProgDifficultyFilter] = useState<'all'|'easy'|'medium'|'hard'>('all');
  const [showProgInfoModal, setShowProgInfoModal] = useState(false);
  const [showProgScoreModal, setShowProgScoreModal] = useState(false);

  const pyodideRef = useRef<any>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);
  const inputResolverRef = useRef<((v: string) => void) | null>(null);
  const mockScrollRef = useRef<HTMLDivElement>(null);

  // Get all questions from exercise
  const allQuestions = exercise.questions || [];
  const currentQ = allQuestions[currentIndex];

  // Get available languages from props or default
  const availableLanguages = configuredLanguages?.coreProgram || ['python', 'javascript', 'java', 'cpp'];

  // Get all programming questions (for language selector consistency)
  const programmingQuestions = allQuestions.filter(q =>
    q.questionType === 'programming' || q.questionType === 'database'
  );

  // For non-programming questions (MCQ), we show different right panel content
  // ── Routing detection ──
  // The real student app routes by exercise.programmingSettings.selectedModule
  // (see coursesdetailedview/[id]/page.tsx handleExerciseSelect line 1421+):
  //   selectedModule === 'Frontend'  → frontendCompiler.tsx
  //   selectedModule === 'Database'  → db-queryEditor.tsx
  //   selectedModule === 'Core Programming' (default) → code-editor.tsx / multi-file-code-editor.tsx
  //   exerciseType === 'Other'      → OthersExam.tsx
  //   exerciseType === 'MCQ'        → mcq.tsx
  const selectedModule: string = exercise?.programmingSettings?.selectedModule || '';
  const isFrontendExercise = selectedModule === 'Frontend';
  const isDatabaseExercise = selectedModule === 'Database';
  const isOthersExercise = exercise?.exerciseType === 'Other';
  const isMultiFileExercise = exercise?.questionConfiguration?.programmingQuestionConfiguration?.compilerFileMode === 'multiple';
  // A programming-typed question routes by its EXERCISE settings, not by questionType.
  const isCurrentMCQ = currentQ?.questionType === 'mcq';
  // "Coding type" = anything that isn't MCQ — routed further by exercise selectedModule.
  const isCurrentCodingQ = !!currentQ && currentQ.questionType !== 'mcq';
  // Per-question routing (computed per current question, but driven by exercise settings):
  const isCurrentFrontend = isCurrentCodingQ && isFrontendExercise;
  const isCurrentDatabase = isCurrentCodingQ && isDatabaseExercise;
  const isCurrentOthers   = isOthersExercise && !isCurrentMCQ;
  // Core Programming path (single vs multi)
  const isCurrentProgramming = isCurrentCodingQ && !isFrontendExercise && !isDatabaseExercise && !isOthersExercise;
  const isCurrentMultiFile   = isCurrentProgramming && isMultiFileExercise;
  // After Others/SQL/Frontend mocks were built, no question type is unsupported
  const isUnsupportedType = false;
  const unsupportedTypeLabel = 'this type';

  // Pyodide setup for Python execution
  useEffect(() => {
    if (lang === 'python' && !pyodideReady && !pyodideRef.current) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js';
      script.onload = async () => {
        try {
          const pyodide = await (window as any).loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });
          pyodideRef.current = pyodide;
          setPyodideReady(true);
        } catch (e) { console.warn('Pyodide load error:', e); }
      };
      document.head.appendChild(script);
    }
  }, [lang]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLines]);

  useEffect(() => {
    if (waitingForInput) consoleInputRef.current?.focus();
  }, [waitingForInput]);

  // Reset console when switching questions
  useEffect(() => {
    setCode('');
    setConsoleLines([]);
    setWaitingForInput(false);
    setIsRunning(false);
    inputResolverRef.current = null;
    setConsoleInput('');
  }, [currentIndex]);

  // Map mock language id → Monaco language id (hoisted so both early-return and renderRightPanel can use it)
  const getMonacoLang = (l: string): string => {
    const m: Record<string, string> = {
      javascript: 'javascript', typescript: 'typescript', python: 'python',
      java: 'java', cpp: 'cpp', c: 'c', csharp: 'csharp', go: 'go', rust: 'rust',
      php: 'php', ruby: 'ruby', kotlin: 'kotlin', swift: 'swift', sql: 'sql',
    };
    return m[l.toLowerCase()] || 'plaintext';
  };

  const mkLineId = () => `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const appendLine = (type: ConsoleLine['type'], text: string) => {
    setConsoleLines(prev => [...prev, { id: mkLineId(), type, text }]);
  };

  const streamText = async (text: string, type: 'output' | 'error' = 'output') => {
    if (!text) return;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== '' || i < lines.length - 1) {
        appendLine(type, lines[i]);
        await new Promise(r => setTimeout(r, 35));
      }
    }
  };

  const submitInput = () => {
    if (!waitingForInput || !inputResolverRef.current) return;
    const val = consoleInput;
    appendLine('input', val);
    setConsoleInput('');
    setWaitingForInput(false);
    const resolve = inputResolverRef.current;
    inputResolverRef.current = null;
    resolve(val);
  };

  const PISTON_API_URL = process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston/execute";

  const getPistonLang = (lang: string): { language: string; version: string } => {
    const map: Record<string, { language: string; version: string }> = {
      javascript: { language: 'javascript', version: '18.15.0' },
      python: { language: 'python', version: '3.10.0' },
      java: { language: 'java', version: '15.0.2' },
      cpp: { language: 'cpp', version: '10.2.0' },
      c: { language: 'c', version: '10.2.0' },
      csharp: { language: 'csharp', version: '6.12.0' },
      typescript: { language: 'typescript', version: '5.0.3' },
    };
    return map[lang.toLowerCase()] || { language: 'javascript', version: '18.15.0' };
  };

  const executeCode = async () => {
    if (!code.trim()) { appendLine('system', '⚠ Please write some code first.'); return; }
    setConsoleLines([{ id: mkLineId(), type: 'system', text: `▶ Running ${lang}…` }]);
    setIsRunning(true);
    setWaitingForInput(false);
    inputResolverRef.current = null;

    try {
      if (lang === 'python') {
        if (!pyodideReady || !pyodideRef.current) {
          appendLine('system', '⌛ Python runtime loading… Please wait and try again.');
          setIsRunning(false);
          return;
        }
        pyodideRef.current.setStdin({
          readline: () => new Promise<string>(resolve => {
            setWaitingForInput(true);
            inputResolverRef.current = (val: string) => resolve(val + '\n');
          })
        });
        const outLines: string[] = [];
        const errLines: string[] = [];
        pyodideRef.current.setStdout({ batched: (s: string) => { outLines.push(s); } });
        pyodideRef.current.setStderr({ batched: (s: string) => { errLines.push(s); } });
        try {
          const runPromise = pyodideRef.current.runPythonAsync(code);
          const flushInterval = setInterval(() => {
            if (outLines.length > 0) {
              const pending = outLines.splice(0);
              pending.forEach(s => {
                s.split('\n').forEach((line, i, arr) => {
                  if (line !== '' || i < arr.length - 1) {
                    setConsoleLines(prev => [...prev, { id: mkLineId(), type: 'output', text: line }]);
                  }
                });
              });
            }
          }, 50);
          await runPromise;
          clearInterval(flushInterval);
          const remaining = outLines.splice(0);
          for (const s of remaining) await streamText(s, 'output');
          for (const s of errLines) await streamText(s, 'error');
          appendLine('system', '✓ Process finished (exit 0)');
        } catch (e: any) {
          const remaining = outLines.splice(0);
          for (const s of remaining) await streamText(s, 'output');
          await streamText(e.message || String(e), 'error');
          appendLine('system', '✗ Process exited with error');
        }
      } else {
        const pistonLang = getPistonLang(lang);
        const resp = await fetch(PISTON_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: pistonLang.language, version: pistonLang.version,
            files: [{ name: 'main', content: code }],
            stdin: consoleInput, args: [],
            compile_timeout: 10000, run_timeout: 8000,
            compile_memory_limit: -1, run_memory_limit: -1,
          }),
        });
        const data = await resp.json();
        if (data.run) {
          const out = (data.run.output || '').trim();
          const err = (data.run.stderr || '').trim();
          if (out) await streamText(out, 'output');
          if (err) await streamText(err, 'error');
          if (!out && !err) appendLine('system', '(no output)');
          appendLine('system', `✓ Process finished (exit ${data.run.code ?? 0})`);
        } else {
          appendLine('error', 'Execution failed — unexpected API response');
        }
      }
    } catch (e: any) {
      appendLine('error', `Network error: ${e.message}`);
    } finally {
      setIsRunning(false);
      setWaitingForInput(false);
      inputResolverRef.current = null;
    }
  };

  // Get difficulty style
  const DS: Record<string, any> = {
    easy: { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', dot: '#16a34a' },
    medium: { bg: '#fffbeb', border: '#fde68a', text: '#d97706', dot: '#d97706' },
    hard: { bg: '#fff5f5', border: '#fed7d7', text: '#e53e3e', dot: '#e53e3e' },
  };

  // Helper to extract plain text from HTML content (also handles content-block arrays and {text} objects)
  const extractPlainText = (input: any): string => {
    if (!input) return '';
    let html = '';
    if (typeof input === 'string') html = input;
    else if (Array.isArray(input)) {
      // Content blocks array — pull text from text-type blocks, ignore code/image for plain-text extraction
      html = input.map((b: any) => (b && b.type === 'text' && typeof b.value === 'string') ? b.value : '').join(' ');
    }
    else if (typeof input === 'object') {
      if (Array.isArray(input.text)) html = input.text.map((b: any) => (b && b.type === 'text' && typeof b.value === 'string') ? b.value : '').join(' ');
      else if (typeof input.text === 'string') html = input.text;
      else if (typeof input.html === 'string') html = input.html;
      else return '';
    }
    else return '';
    if (typeof document === 'undefined') return html;
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  // Helper to get question title from various formats
  const getQuestionTitle = (q: any): string => {
    if (q.mcqQuestionTitle) {
      if (Array.isArray(q.mcqQuestionTitle)) {
        const textBlocks = q.mcqQuestionTitle.filter((cb: any) => cb.type === 'text' && cb.value);
        return textBlocks.map((cb: any) => extractPlainText(cb.value)).join(' ');
      }
      if (typeof q.mcqQuestionTitle === 'string') {
        return extractPlainText(q.mcqQuestionTitle);
      }
    }
    if (q.questionTitle) return extractPlainText(q.questionTitle);
    if (q.title) return extractPlainText(q.title);
    return 'Question';
  };

  // Helper to get question description
  // Convert a content-block array ({id, type, value} | {type, url, ...}) to an HTML string
  const contentBlocksToHtml = (blocks: any[]): string => {
    if (!Array.isArray(blocks)) return '';
    return blocks.map((b: any) => {
      if (!b) return '';
      if (b.type === 'text' && b.value) return String(b.value);
      if (b.type === 'code' && b.value) {
        const escaped = String(b.value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<pre style="background:${b.bgColor || '#1e1e1e'};color:#d4d4d4;border-radius:8px;padding:10px 14px;font-family:ui-monospace,monospace;font-size:12.5px;overflow-x:auto;line-height:1.6;margin:6px 0;"><code>${escaped}</code></pre>`;
      }
      if (b.type === 'image' && b.url) {
        const align = b.alignment === 'right' ? 'flex-end' : b.alignment === 'center' ? 'center' : 'flex-start';
        return `<div style="display:flex;justify-content:${align};margin:6px 0"><img src="${b.url}" alt="" style="max-width:${b.sizePercent || 100}%;border-radius:8px;border:1px solid #e4e4ed" /></div>`;
      }
      return '';
    }).join('');
  };

  // Always returns a string — handles plain strings, {text} objects, AND content-block arrays.
  const getQuestionDescription = (q: any): string => {
    const tryExtract = (v: any): string | null => {
      if (v == null) return null;
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return contentBlocksToHtml(v);
      if (typeof v === 'object') {
        if (Array.isArray(v.text)) return contentBlocksToHtml(v.text);
        if (Array.isArray(v.contentBlocks)) return contentBlocksToHtml(v.contentBlocks);
        if (typeof v.text === 'string') return v.text;
        if (typeof v.html === 'string') return v.html;
      }
      return null;
    };
    return (
      tryExtract(q.mcqQuestionDescription) ??
      tryExtract(q.description) ??
      ''
    );
  };

  // Helper to get options from MCQ question
  const getMCQOptions = (q: any): any[] => {
    let options = q.mcqQuestionOptions || [];
    if (options.length === 0 && q.options) {
      options = q.options;
    }
    return options.map((opt: any, idx: number) => ({
      label: opt.text || opt.label || `Option ${idx + 1}`,
      value: opt.value || opt.text || `opt_${idx}`,
      isCorrect: opt.isCorrect || false,
    }));
  };

  const isMCQExercise = exercise.exerciseType?.toLowerCase() === 'mcq' ||
    (allQuestions.length > 0 && allQuestions.every((q: any) => q.questionType === 'mcq'));

  // Generic answer setter — supports all MCQ question types (single id, set of ids, boolean, number, string)
  const handleMockAnswer = (qIdx: number, answer: any, autoReveal: boolean = true) => {
    if (revealedSet.has(qIdx)) return;
    setSelectedOptions(prev => new Map(prev).set(qIdx, answer));
    if (autoReveal) {
      setRevealedSet(prev => new Set(prev).add(qIdx));
      if (mockScrollRef.current) mockScrollRef.current.scrollTop = 0;
    }
  };
  // Back-compat shim used by old code paths (multiple_choice click)
  const handleMockSelect = (optionId: string) => handleMockAnswer(currentIndex, optionId, true);

  // Correctness check that handles every MCQ question type
  const isMCQAnswerCorrect = (q: any, ans: any): boolean => {
    if (!q || ans === undefined || ans === null) return false;
    const type = q.mcqQuestionType || 'multiple_choice';
    const opts: any[] = q.mcqQuestionOptions || [];
    switch (type) {
      case 'multiple_choice':
      case 'dropdown':
        return opts.find((o: any) => o._id === ans)?.isCorrect === true;
      case 'multiple_select': {
        const set: Set<string> = ans instanceof Set ? ans : new Set(Array.isArray(ans) ? ans : []);
        const correct = opts.filter((o: any) => o.isCorrect === true);
        if (correct.length === 0 || correct.length !== set.size) return false;
        return correct.every((o: any) => set.has(o._id));
      }
      case 'true_false':
        return typeof q.trueFalseAnswer === 'boolean' && ans === q.trueFalseAnswer;
      case 'numeric': {
        const n = Number(ans);
        const expected = Number(q.numericAnswer);
        if (!Number.isFinite(n) || !Number.isFinite(expected)) return false;
        return Math.abs(n - expected) <= (Number(q.numericTolerance) || 0);
      }
      case 'matching': {
        const given: { left: string; right: string }[] = Array.isArray(ans) ? ans : [];
        const pairs = q.matchingPairs || [];
        if (!pairs.length || given.length !== pairs.length) return false;
        return pairs.every((p: any) => given.find(g => g.left === p.left)?.right === p.right);
      }
      case 'ordering': {
        const given: { itemId: string; order: number }[] = Array.isArray(ans) ? ans : [];
        const items = q.orderingItems || [];
        if (!items.length || given.length !== items.length) return false;
        return given.every(a => items.find((it: any) => it._id === a.itemId)?.order === a.order);
      }
      case 'short_answer':
      case 'essay':
        // Text answers — preview only, not auto-graded
        return false;
      default:
        return false;
    }
  };

  // Reset scroll on question change
  useEffect(() => {
    if (mockScrollRef.current) mockScrollRef.current.scrollTop = 0;
  }, [currentIndex]);

  // ── MCQ mock render (mirrors mcq.tsx layout) ──────────────────────────
  if (isMCQExercise && currentQ) {
    const T = MCQ_T;
    const diff = MCQ_DIFF[currentQ.mcqQuestionDifficulty || 'medium'] ?? MCQ_DIFF.medium;
    const isRevealed = revealedSet.has(currentIndex);
    const currentAnswer = selectedOptions.get(currentIndex);
    const options: any[] = currentQ.mcqQuestionOptions || [];
    const qType: string = currentQ.mcqQuestionType || 'multiple_choice';
    const answeredCount = revealedSet.size;
    const correctCount = Array.from(revealedSet).filter(idx =>
      isMCQAnswerCorrect(allQuestions[idx], selectedOptions.get(idx))
    ).length;
    const isLastQ = currentIndex >= allQuestions.length - 1;
    const progressPct = Math.round((answeredCount / Math.max(1, allQuestions.length)) * 100);
    const currentIsCorrect = isRevealed ? isMCQAnswerCorrect(currentQ, currentAnswer) : false;
    const isTextType = qType === 'short_answer' || qType === 'essay';

    const getGridStatus = (idx: number) => {
      if (!revealedSet.has(idx)) return 'unanswered';
      const q = allQuestions[idx];
      const ans = selectedOptions.get(idx);
      const t = q?.mcqQuestionType || 'multiple_choice';
      if (t === 'short_answer' || t === 'essay') return 'answered';
      return isMCQAnswerCorrect(q, ans) ? 'correct' : 'wrong';
    };

    return (
      <div style={{position:'fixed',inset:0,background:T.pageBg,fontFamily:MCQ_FONT,color:T.textMain,display:'flex',flexDirection:'column',overflow:'hidden',zIndex:300}}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
          *{box-sizing:border-box;}
          @keyframes mockFadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
          .mock-fade{animation:mockFadeIn 0.2s ease;}
          .mock-s::-webkit-scrollbar{width:7px;}
          .mock-s::-webkit-scrollbar-track{background:#e4e4ed;border-radius:99px;}
          .mock-s::-webkit-scrollbar-thumb{background:#9b9bae;border-radius:99px;}
          .mock-btn-prev:hover:not(:disabled){border-color:${T.orange}!important;color:${T.orange}!important;}
          .mock-btn-next:hover{background:${T.orangeDark}!important;}
        `}</style>

        {/* TOP BAR */}
        <div style={{flexShrink:0,height:56,background:T.bg,borderBottom:`1px solid ${T.border}`,display:'flex',flexDirection:'column',zIndex:50}}>
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',gap:12}}>
            <div style={{display:'flex',alignItems:'center',gap:0,minWidth:0,flex:1}}>
              <button onClick={onClose} className="mock-btn-prev" style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:8,border:`1.5px solid ${T.border}`,background:'transparent',color:T.textSub,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:MCQ_FONT,transition:'all 0.13s',flexShrink:0,marginRight:14}}>
                <ArrowLeft size={13}/> Back
              </button>
              <div style={{display:'flex',alignItems:'center',gap:7,flexShrink:0,marginRight:14}}>
                <div style={{width:28,height:28,borderRadius:8,background:`linear-gradient(135deg,${T.orange},${T.orangeDark})`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 3px 10px ${T.orangeGlow}`}}>
                  <GraduationCap size={13} color="#fff"/>
                </div>
                <span style={{fontSize:13,fontWeight:800,color:T.textMain,letterSpacing:'-0.02em'}}>SmartCliff</span>
              </div>
              <div style={{width:1,height:18,background:T.border,marginRight:14,flexShrink:0}}/>
              <span style={{fontSize:12,fontWeight:500,color:T.textMuted,flexShrink:0}}>Mock Preview</span>
              <ChevronRight size={12} style={{color:T.border,margin:'0 5px',flexShrink:0}}/>
              <span style={{fontSize:12,fontWeight:700,color:T.orange,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:200}}>{exercise.exerciseInformation?.exerciseName}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
              {[
                {v:allQuestions.length, label:'Total',   col:T.textSub},
                {v:answeredCount,       label:'Done',    col:T.green},
                {v:correctCount,        label:'Correct', col:T.orange},
                {v:answeredCount-correctCount, label:'Wrong', col:T.red},
              ].map(({v,label,col})=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:3}}>
                  <span style={{fontSize:14,fontWeight:800,color:col}}>{v}</span>
                  <span style={{fontSize:10,color:T.textHint,fontWeight:600}}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{height:2,background:T.borderLight}}>
            <div style={{height:'100%',width:`${progressPct}%`,background:`linear-gradient(90deg,${T.orange},${T.orangeDark})`,transition:'width 0.5s ease'}}/>
          </div>
        </div>

        {/* BODY */}
        <div style={{flex:1,minHeight:0,overflow:'hidden',display:'flex'}}>
          {/* Left: Question */}
          <div style={{flex:1,minWidth:0,minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
            {/* Q-meta row */}
            <div style={{flexShrink:0,height:52,background:T.bg,borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',padding:'0 28px',gap:10,zIndex:20}}>
              <div style={{display:'flex',alignItems:'baseline',gap:2}}>
                <span style={{fontSize:10,color:T.textHint,fontWeight:700,letterSpacing:'0.05em'}}>Q</span>
                <span style={{fontSize:26,fontWeight:900,color:T.orange,lineHeight:1,letterSpacing:'-0.03em',margin:'0 2px'}}>{currentIndex+1}</span>
                <span style={{fontSize:12,color:T.textHint}}>/{allQuestions.length}</span>
              </div>
              <div style={{width:1,height:18,background:T.border}}/>
              <div style={{display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:99,background:diff.bg}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:diff.dot}}/>
                <span style={{fontSize:10,fontWeight:700,color:diff.text,textTransform:'capitalize' as const}}>{currentQ.mcqQuestionDifficulty||'medium'}</span>
              </div>
              {exercise.isGraded !== false && (exercise.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion || currentQ.mcqQuestionScore) ? (
                <div style={{display:'flex',alignItems:'center',gap:3,padding:'3px 9px',borderRadius:99,background:T.amberLight}}>
                  <Award size={10} style={{color:T.amber}}/>
                  <span style={{fontSize:10,fontWeight:700,color:T.amber}}>{exercise.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion || currentQ.mcqQuestionScore} marks</span>
                </div>
              ) : null}
              {isRevealed && !isTextType && (
                <div style={{display:'flex',alignItems:'center',gap:3,padding:'3px 9px',borderRadius:99,background:currentIsCorrect?T.greenLight:T.redLight}}>
                  {currentIsCorrect
                    ? <><CheckCircle2 size={10} style={{color:T.greenDark}}/><span style={{fontSize:10,fontWeight:700,color:T.greenDark}}>Correct</span></>
                    : <><XCircle size={10} style={{color:T.red}}/><span style={{fontSize:10,fontWeight:700,color:T.red}}>Wrong</span></>
                  }
                </div>
              )}
              {isRevealed && isTextType && (
                <div style={{display:'flex',alignItems:'center',gap:3,padding:'3px 9px',borderRadius:99,background:T.blueLight}}>
                  <CheckCircle2 size={10} style={{color:T.blue}}/>
                  <span style={{fontSize:10,fontWeight:700,color:T.blue}}>Answered</span>
                </div>
              )}
              {qType !== 'multiple_choice' && (
                <div style={{padding:'3px 9px',borderRadius:99,background:T.purpleLight}}>
                  <span style={{fontSize:10,fontWeight:700,color:T.purple,textTransform:'capitalize' as const}}>{String(qType).replace(/_/g,' ')}</span>
                </div>
              )}
            </div>

            {/* Scrollable question content */}
            <div ref={mockScrollRef} className="mock-fade mock-s" key={currentIndex} style={{flex:1,minHeight:0,overflowY:'auto',padding:'24px 28px'}}>
              <div style={{marginBottom:8}}><PreviewContentBlocks title={currentQ.mcqQuestionTitle}/></div>
              {(() => {
                const descHtmlStr = getQuestionDescription(currentQ);
                if (!descHtmlStr) return null;
                return (
                  <div style={{display:'flex',gap:10,padding:'10px 14px',borderRadius:10,background:T.blueLight,border:`1px solid ${T.blue}20`,marginBottom:14}}>
                    <Info size={13} style={{color:T.blue,flexShrink:0,marginTop:2}}/>
                    <div style={{fontSize:13,color:T.textSub,margin:0,lineHeight:1.6,flex:1}} dangerouslySetInnerHTML={{__html:descHtmlStr}}/>
                  </div>
                );
              })()}
              {!isRevealed && (
                <p style={{fontSize:11,color:T.textHint,marginBottom:16,display:'flex',alignItems:'center',gap:5}}>
                  <HelpCircle size={11} style={{color:T.textHint}}/>
                  {MCQ_HINT_TEXT[qType] || 'Answer the question.'}
                </p>
              )}

              {/* ── Answer area: routes by question type ── */}
              {(qType === 'multiple_choice' || qType === 'multiple_select') && (
                <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.max(1, Math.min(4, currentQ.mcqQuestionOptionsPerRow || 1))},1fr)`,gap:10}}>
                  {options.map((opt: any, idx: number) => {
                    const lbl = String.fromCharCode(65+idx);
                    const selSet: Set<string> = qType === 'multiple_select'
                      ? (currentAnswer instanceof Set ? currentAnswer : new Set<string>())
                      : new Set<string>();
                    const isSelected = qType === 'multiple_select'
                      ? selSet.has(opt._id)
                      : opt._id === currentAnswer;
                    const isCorrect = opt.isCorrect === true;
                    let border = T.border, bg = T.bg, dotBorder = T.border, dotBg = 'transparent';
                    let dotInner: string|null = null, textCol = T.textSub, lblBg = T.pageBg, lblCol = T.textMuted;
                    if (!isRevealed && isSelected) {
                      border=T.orange; bg=T.orangeLight; dotBorder=T.orange; dotBg=T.orange; dotInner='#fff'; textCol=T.textMain; lblBg=T.orange; lblCol='#fff';
                    } else if (isRevealed && isCorrect) {
                      border=T.green; bg=T.greenLight; dotBorder=T.green; dotBg=T.green; dotInner='#fff'; textCol=T.textMain; lblBg=T.green; lblCol='#fff';
                    } else if (isRevealed && isSelected && !isCorrect) {
                      border=T.red; bg=T.redLight; dotBorder=T.red; dotBg=T.red; dotInner='#fff'; textCol=T.textMain; lblBg=T.red; lblCol='#fff';
                    }
                    const onClick = () => {
                      if (isRevealed) return;
                      if (qType === 'multiple_select') {
                        const next = new Set(selSet);
                        if (next.has(opt._id)) next.delete(opt._id); else next.add(opt._id);
                        handleMockAnswer(currentIndex, next, false);
                      } else {
                        handleMockAnswer(currentIndex, opt._id, true);
                      }
                    };
                    return (
                      <div key={opt._id||idx} onClick={onClick}
                        style={{display:'flex',alignItems:'flex-start',gap:12,padding:'13px 16px',borderRadius:12,cursor:isRevealed?'default':'pointer',border:`1.5px solid ${border}`,background:bg,transition:'all 0.15s',userSelect:'none' as const,position:'relative' as const}}>
                        <div style={{flexShrink:0,width:20,height:20,borderRadius:qType==='multiple_select'?6:'50%',marginTop:1,border:`2px solid ${dotBorder}`,background:dotBg,display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s'}}>
                          {dotInner && (qType==='multiple_select'
                            ? <Check size={12} color={dotInner}/>
                            : <div style={{width:7,height:7,borderRadius:'50%',background:dotInner}}/>)}
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:'flex',alignItems:'center',gap:8}}>
                            <span style={{flexShrink:0,width:20,height:20,borderRadius:6,background:lblBg,color:lblCol,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,transition:'all 0.15s'}}>{lbl}</span>
                            <span style={{fontSize:14,color:textCol,fontWeight:(isSelected||isCorrect)?600:400}}>{opt.text}</span>
                          </div>
                        </div>
                        {isRevealed && isCorrect && <CheckCircle2 size={15} style={{color:T.greenDark,position:'absolute',right:14,top:'50%',transform:'translateY(-50%)'}}/>}
                        {isRevealed && isSelected && !isCorrect && <XCircle size={15} style={{color:T.red,position:'absolute',right:14,top:'50%',transform:'translateY(-50%)'}}/>}
                      </div>
                    );
                  })}
                  {qType === 'multiple_select' && !isRevealed && currentAnswer instanceof Set && currentAnswer.size > 0 && (
                    <button onClick={()=>{ setRevealedSet(prev=>new Set(prev).add(currentIndex)); if(mockScrollRef.current) mockScrollRef.current.scrollTop=0; }}
                      style={{marginTop:6,padding:'10px 18px',borderRadius:10,border:'none',background:T.orange,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:`0 3px 14px ${T.orangeGlow}`,justifySelf:'start'}}>
                      Check Answer
                    </button>
                  )}
                </div>
              )}

              {qType === 'true_false' && (() => {
                const sel = typeof currentAnswer === 'boolean' ? currentAnswer : null;
                const correctVal = typeof currentQ.trueFalseAnswer === 'boolean' ? currentQ.trueFalseAnswer : null;
                return (
                  <div style={{display:'flex',gap:12}}>
                    {[true,false].map(val => {
                      const isSel = sel === val;
                      const isCorrect = correctVal === val;
                      let border = T.border, bg = T.bg, col = T.textSub;
                      if (!isRevealed && isSel) { border=T.orange; bg=T.orangeLight; col=T.textMain; }
                      else if (isRevealed && isCorrect) { border=T.green; bg=T.greenLight; col=T.textMain; }
                      else if (isRevealed && isSel && !isCorrect) { border=T.red; bg=T.redLight; col=T.textMain; }
                      return (
                        <button key={String(val)} disabled={isRevealed}
                          onClick={()=>handleMockAnswer(currentIndex, val, true)}
                          style={{flex:1,padding:'18px 24px',borderRadius:12,border:`1.5px solid ${border}`,background:bg,color:col,fontSize:16,fontWeight:700,cursor:isRevealed?'default':'pointer',transition:'all 0.15s',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                          {val ? <CheckCircle2 size={18}/> : <XCircle size={18}/>}
                          {val ? 'True' : 'False'}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {qType === 'dropdown' && (
                <div>
                  <select value={(typeof currentAnswer === 'string' ? currentAnswer : '')} disabled={isRevealed}
                    onChange={(e)=>handleMockAnswer(currentIndex, e.target.value, true)}
                    style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1.5px solid ${T.border}`,background:T.bg,color:T.textMain,fontSize:14,fontFamily:MCQ_FONT,outline:'none',cursor:isRevealed?'default':'pointer'}}>
                    <option value="">Select an option…</option>
                    {options.map((opt:any,i:number)=><option key={opt._id||i} value={opt._id}>{opt.text}</option>)}
                  </select>
                  {isRevealed && (
                    <div style={{marginTop:12,padding:'10px 14px',borderRadius:10,background:T.greenLight,border:`1px solid ${T.green}40`}}>
                      <span style={{fontSize:11,fontWeight:700,color:T.greenDark}}>Correct: </span>
                      <span style={{fontSize:13,color:T.textMain}}>{options.find((o:any)=>o.isCorrect)?.text}</span>
                    </div>
                  )}
                </div>
              )}

              {qType === 'short_answer' && (
                <div>
                  <input type="text" value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                    disabled={isRevealed} placeholder="Type your answer…"
                    onChange={(e)=>setSelectedOptions(prev=>new Map(prev).set(currentIndex,e.target.value))}
                    style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1.5px solid ${T.border}`,background:T.bg,color:T.textMain,fontSize:14,fontFamily:MCQ_FONT,outline:'none'}}/>
                  {!isRevealed && typeof currentAnswer === 'string' && currentAnswer.trim() && (
                    <button onClick={()=>setRevealedSet(prev=>new Set(prev).add(currentIndex))}
                      style={{marginTop:10,padding:'8px 16px',borderRadius:8,border:'none',background:T.orange,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>Submit Answer</button>
                  )}
                  {isRevealed && (currentQ.shortAnswer || currentQ.expectedAnswer) && (
                    <div style={{marginTop:12,padding:'10px 14px',borderRadius:10,background:T.blueLight,border:`1px solid ${T.blue}40`}}>
                      <span style={{fontSize:11,fontWeight:700,color:T.blue}}>Expected: </span>
                      <span style={{fontSize:13,color:T.textMain}}>{currentQ.shortAnswer || currentQ.expectedAnswer}</span>
                    </div>
                  )}
                </div>
              )}

              {qType === 'essay' && (
                <div>
                  <textarea value={typeof currentAnswer === 'string' ? currentAnswer : ''}
                    disabled={isRevealed} placeholder="Write your answer…" rows={6}
                    onChange={(e)=>setSelectedOptions(prev=>new Map(prev).set(currentIndex,e.target.value))}
                    style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1.5px solid ${T.border}`,background:T.bg,color:T.textMain,fontSize:14,fontFamily:MCQ_FONT,outline:'none',resize:'vertical' as const,lineHeight:1.6}}/>
                  {!isRevealed && typeof currentAnswer === 'string' && currentAnswer.trim() && (
                    <button onClick={()=>setRevealedSet(prev=>new Set(prev).add(currentIndex))}
                      style={{marginTop:10,padding:'8px 16px',borderRadius:8,border:'none',background:T.orange,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>Submit Answer</button>
                  )}
                  {isRevealed && (currentQ.essayAnswer || currentQ.expectedAnswer) && (
                    <div style={{marginTop:12,padding:'10px 14px',borderRadius:10,background:T.blueLight,border:`1px solid ${T.blue}40`}}>
                      <p style={{fontSize:11,fontWeight:700,color:T.blue,margin:0,marginBottom:4}}>Model Answer:</p>
                      <p style={{fontSize:13,color:T.textMain,margin:0,whiteSpace:'pre-wrap' as const}}>{currentQ.essayAnswer || currentQ.expectedAnswer}</p>
                    </div>
                  )}
                </div>
              )}

              {qType === 'numeric' && (
                <div>
                  <input type="number" value={typeof currentAnswer === 'number' ? currentAnswer : (typeof currentAnswer === 'string' ? currentAnswer : '')}
                    disabled={isRevealed} placeholder="Enter a number…"
                    onChange={(e)=>setSelectedOptions(prev=>new Map(prev).set(currentIndex,e.target.value))}
                    style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`1.5px solid ${isRevealed ? (currentIsCorrect?T.green:T.red) : T.border}`,background:isRevealed ? (currentIsCorrect?T.greenLight:T.redLight) : T.bg,color:T.textMain,fontSize:14,fontFamily:MCQ_FONT,outline:'none'}}/>
                  {!isRevealed && currentAnswer !== undefined && currentAnswer !== '' && (
                    <button onClick={()=>setRevealedSet(prev=>new Set(prev).add(currentIndex))}
                      style={{marginTop:10,padding:'8px 16px',borderRadius:8,border:'none',background:T.orange,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>Check Answer</button>
                  )}
                  {isRevealed && currentQ.numericAnswer !== undefined && currentQ.numericAnswer !== null && (
                    <div style={{marginTop:12,padding:'10px 14px',borderRadius:10,background:T.greenLight,border:`1px solid ${T.green}40`}}>
                      <span style={{fontSize:11,fontWeight:700,color:T.greenDark}}>Correct: </span>
                      <span style={{fontSize:13,color:T.textMain}}>{currentQ.numericAnswer}{currentQ.numericTolerance ? ` (±${currentQ.numericTolerance})` : ''}</span>
                    </div>
                  )}
                </div>
              )}

              {qType === 'matching' && (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(currentQ.matchingPairs || []).map((p:any,i:number)=>(
                    <div key={p._id||i} style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:10,alignItems:'center',padding:'10px 14px',borderRadius:10,background:T.pageBg,border:`1px solid ${T.border}`}}>
                      <span style={{fontSize:13,color:T.textMain,fontWeight:600}}>{p.left}</span>
                      <ArrowRight size={14} style={{color:T.textMuted}}/>
                      <span style={{fontSize:13,color:isRevealed?T.greenDark:T.textHint,fontWeight:isRevealed?700:500}}>
                        {isRevealed ? p.right : '???'}
                      </span>
                    </div>
                  ))}
                  {!isRevealed && (
                    <button onClick={()=>{ handleMockAnswer(currentIndex, (currentQ.matchingPairs||[]).map((p:any)=>({left:p.left,right:p.right})), true); }}
                      style={{marginTop:6,padding:'10px 18px',borderRadius:10,border:'none',background:T.orange,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:`0 3px 14px ${T.orangeGlow}`,alignSelf:'flex-start' as const}}>
                      Reveal Matches
                    </button>
                  )}
                </div>
              )}

              {qType === 'ordering' && (
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {(currentQ.orderingItems || []).slice().sort((a:any,b:any)=>(isRevealed ? (a.order-b.order) : 0)).map((it:any,i:number)=>(
                    <div key={it._id||i} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:10,background:T.bg,border:`1.5px solid ${isRevealed?T.green:T.border}`}}>
                      <span style={{width:24,height:24,borderRadius:6,background:isRevealed?T.green:T.pageBg,color:isRevealed?'#fff':T.textMuted,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800}}>
                        {isRevealed ? i+1 : '·'}
                      </span>
                      <span style={{fontSize:13,color:T.textMain}}>{it.text}</span>
                    </div>
                  ))}
                  {!isRevealed && (
                    <button onClick={()=>{ handleMockAnswer(currentIndex, (currentQ.orderingItems||[]).map((it:any)=>({itemId:it._id, order:it.order})), true); }}
                      style={{marginTop:6,padding:'10px 18px',borderRadius:10,border:'none',background:T.orange,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',boxShadow:`0 3px 14px ${T.orangeGlow}`,alignSelf:'flex-start' as const}}>
                      Reveal Order
                    </button>
                  )}
                </div>
              )}

              <div style={{height:20}}/>
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{flexShrink:0,width:270,minHeight:0,borderLeft:`1px solid ${T.border}`,background:T.bg,overflowY:'auto',padding:'16px 14px 20px 14px'}} className="mock-s">
            <p style={{fontSize:10,fontWeight:700,color:T.textMuted,marginBottom:10,textTransform:'uppercase' as const,letterSpacing:'0.05em',fontFamily:MCQ_FONT}}>{allQuestions.length} Questions</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5,marginBottom:12}}>
              {allQuestions.map((_: any, i: number) => {
                const status = getGridStatus(i);
                const isCurr = i === currentIndex;
                let bg=T.pageBg, col=T.textSub, bdr=T.border;
                if(isCurr){bg=T.blue;col='#fff';bdr=T.blue;}
                else if(status==='correct'){bg=T.greenLight;col=T.greenDark;bdr=T.green+'80';}
                else if(status==='wrong'){bg=T.redLight;col=T.red;bdr=T.red+'80';}
                return (
                  <button key={i} onClick={()=>setCurrentIndex(i)}
                    style={{aspectRatio:'1',borderRadius:8,border:`1.5px solid ${bdr}`,background:bg,color:col,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:MCQ_FONT,transition:'all 0.12s'}}>
                    {i+1}
                  </button>
                );
              })}
            </div>
            <div style={{height:1,background:T.borderLight,marginBottom:10}}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px 12px'}}>
              {[{dot:T.blue,lbl:'Current'},{dot:T.greenDark,lbl:'Correct'},{dot:T.red,lbl:'Wrong'},{dot:T.textHint,lbl:'Unanswered'}].map(({dot,lbl})=>(
                <div key={lbl} style={{display:'flex',alignItems:'center',gap:5}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:dot,flexShrink:0}}/>
                  <span style={{fontSize:11,color:T.textSub,fontFamily:MCQ_FONT}}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOTTOM NAV */}
        <div style={{flexShrink:0,height:64,background:T.bg,borderTop:`1px solid ${T.border}`,display:'flex',alignItems:'center',padding:'0 28px',gap:16,zIndex:50}}>
          <button onClick={()=>currentIndex>0&&setCurrentIndex(p=>p-1)} disabled={currentIndex===0} className="mock-btn-prev"
            style={{display:'flex',alignItems:'center',gap:7,padding:'10px 20px',borderRadius:10,border:`1.5px solid ${T.border}`,background:'transparent',color:currentIndex===0?T.textHint:T.textSub,fontSize:13,fontWeight:600,cursor:currentIndex===0?'not-allowed':'pointer',fontFamily:MCQ_FONT,transition:'all 0.13s',flexShrink:0}}>
            <ChevronLeft size={15}/> Previous
          </button>
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,overflow:'hidden'}}>
            {allQuestions.slice(Math.max(0,currentIndex-4),Math.min(allQuestions.length,currentIndex+5)).map((_: any,relIdx: number)=>{
              const absIdx=Math.max(0,currentIndex-4)+relIdx;
              const isCurr=absIdx===currentIndex;
              const isDone=revealedSet.has(absIdx);
              return <button key={absIdx} onClick={()=>setCurrentIndex(absIdx)} style={{width:isCurr?22:7,height:7,borderRadius:99,background:isCurr?T.orange:isDone?T.green:T.border,border:'none',cursor:'pointer',transition:'all 0.2s',padding:0,flexShrink:0}}/>;
            })}
          </div>
          {!isLastQ
            ? <button onClick={()=>setCurrentIndex(p=>p+1)} className="mock-btn-next"
                style={{display:'flex',alignItems:'center',gap:7,padding:'10px 22px',borderRadius:10,border:'none',background:T.orange,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:MCQ_FONT,transition:'all 0.13s',boxShadow:`0 3px 14px ${T.orangeGlow}`,flexShrink:0}}>
                Next <ChevronRight size={15}/>
              </button>
            : <button onClick={onClose}
                style={{display:'flex',alignItems:'center',gap:7,padding:'10px 22px',borderRadius:10,border:'none',background:T.green,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:MCQ_FONT,boxShadow:'0 3px 14px rgba(34,197,94,0.25)',flexShrink:0}}>
                <CheckCircle2 size={14}/> Done
              </button>
          }
        </div>
      </div>
    );
  }
  // ── End MCQ mock ─────────────────────────────────────────────────────────

  // ── Programming + Multi-file mock view (mirrors code-editor.tsx / multi-file-code-editor.tsx — no submit, no proctoring, no timer) ──
  if (isCurrentProgramming && currentQ) {
    const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    const T2 = {
      bg: '#ffffff', pageBg: '#f8f9fa', border: '#e5e7eb', borderSoft: '#f0f0f0',
      textMain: '#1a1a2e', textSub: '#6b7280', textMuted: '#9ca3af', textHint: '#bcbccc',
      blue: '#fb923c', blueLight: '#ffedd5', blueDark: '#f97316',
      green: '#22c55e', greenDark: '#16a34a', greenLight: '#dcfce7',
      orange: '#F27757', orangeDark: '#e0623f',
      red: '#ef4444', amber: '#f59e0b',
    } as const;
    const PROG_DIFF: Record<string, { bg: string; text: string; border: string }> = {
      easy:   { bg: '#dcfce7', text: '#16a34a', border: '#86efac' },
      medium: { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
      hard:   { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
    };
    const diffStyle = PROG_DIFF[currentQ.difficulty || 'medium'] || PROG_DIFF.medium;
    const titleText = extractPlainText(currentQ.title || '') || extractPlainText(currentQ.questionTitle || '') || 'Programming Question';
    const rawDesc = getQuestionDescription(currentQ);
    const descHtml = /<[a-z][^>]*>/i.test(rawDesc);
    const sampleTcs = currentQ.testCases?.filter((tc: any) => tc.isSample && (tc.input?.trim() || tc.expectedOutput?.trim())) || [];
    const hasConstraints = Array.isArray(currentQ.constraints) && currentQ.constraints.some((c: any) => {
      const s = typeof c === 'string' ? c : (c && typeof c.text === 'string' ? c.text : extractPlainText(c));
      return s && s.trim();
    });
    const marks = currentQ.score || currentQ.points || 0;

    const fileExt = lang === 'python' ? 'py' : lang === 'javascript' ? 'js' : lang === 'typescript' ? 'ts' : lang === 'java' ? 'java' : lang === 'cpp' ? 'cpp' : lang === 'csharp' ? 'cs' : lang === 'c' ? 'c' : 'txt';
    const fileName = `main.${fileExt}`;

    // Build examples list — be forgiving with the data shape:
    //   1. Prefer explicit samples (isSample === true && !isHidden) — code-editor.tsx style
    //   2. Otherwise fall back to any non-hidden testCases (some questions don't flag samples)
    //   3. Otherwise fall back to the legacy sampleInput/sampleOutput strings
    const _tcs: any[] = currentQ.testCases || [];
    const _explicitSamples = _tcs.filter((tc: any) => tc.isSample === true && tc.isHidden !== true);
    const _visibleTcs = _explicitSamples.length > 0
      ? _explicitSamples
      : _tcs.filter((tc: any) => tc.isHidden !== true);
    const examples: Array<{ input: string; output: string; explanation?: string }> = _visibleTcs.length > 0
      ? _visibleTcs.map((tc: any) => ({
          input: tc.input ?? tc.testInput ?? '',
          output: tc.expectedOutput ?? tc.output ?? tc.expected ?? '',
          explanation: tc.explanation || 'Sample test case',
        })).filter(e => e.input || e.output)
      : (currentQ.sampleInput || currentQ.sampleOutput)
        ? [{ input: currentQ.sampleInput || '', output: currentQ.sampleOutput || '', explanation: 'Sample input and output' }]
        : [];
    const hintsList: string[] = (currentQ.hints || [])
      .filter((h: any) => h && (h.isPublic === undefined || h.isPublic === true))
      .map((h: any) => {
        if (typeof h === 'string') return h;
        const raw = h && (h.hintText ?? h.text ?? '');
        if (typeof raw === 'string') return raw;
        return extractPlainText(raw);
      })
      .filter((s: any) => typeof s === 'string' && s.length > 0);
    const langLabel = (lang.charAt(0).toUpperCase() + lang.slice(1));
    const difficultyDisplay = currentQ.difficulty ? (currentQ.difficulty.charAt(0).toUpperCase() + currentQ.difficulty.slice(1)) : '';

    const goPrev = () => { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); };
    const goNext = () => { if (currentIndex < allQuestions.length - 1) setCurrentIndex(currentIndex + 1); };

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', background: T2.pageBg, fontFamily: FONT, overflow: 'hidden' }}>
        <style>{`
          .mock-prose, .mock-prose * { text-align: left !important; }
          .mock-prose p { margin: 0 0 8px 0; }
          .mock-prose pre { background: #f5f5f5; border-radius: 6px; padding: 10px 12px; font-family: ui-monospace,monospace; font-size: 12.5px; overflow-x: auto; }
          .mock-prose code { background: #f5f5f5; padding: 1px 5px; border-radius: 4px; font-family: ui-monospace,monospace; font-size: 12.5px; }
          .mock-prose ul, .mock-prose ol { padding-left: 22px; margin: 4px 0; }
          .mock-prose li { margin: 3px 0; }
          .mock-s::-webkit-scrollbar { width: 7px; height: 7px; }
          .mock-s::-webkit-scrollbar-track { background: transparent; }
          .mock-s::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
          .mock-s::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
          .term-s::-webkit-scrollbar { width: 7px; height: 7px; }
          .term-s::-webkit-scrollbar-track { background: #111; }
          .term-s::-webkit-scrollbar-thumb { background: #404040; border-radius: 99px; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>

        {/* ── TOP NAV ── */}
        <div style={{ flexShrink: 0, height: 44, background: T2.bg, borderBottom: `1px solid ${T2.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: T2.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Code size={13} color="#fff"/>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T2.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Exercise Mock Preview — {exercise.exerciseInformation?.exerciseName}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', overflowX: 'auto', maxWidth: '50%' }}>
            {allQuestions.map((q: any, i: number) => {
              const isCurr = i === currentIndex;
              const dd = PROG_DIFF[q.difficulty || 'medium'] || PROG_DIFF.medium;
              return (
                <button key={i} onClick={() => setCurrentIndex(i)}
                  style={{ height: 26, minWidth: 36, padding: '0 8px', borderRadius: 6, border: `1.5px solid ${isCurr ? dd.border : T2.border}`, background: isCurr ? dd.bg : '#f8f8f8', color: isCurr ? dd.text : T2.textSub, fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: FONT }}>
                  {i + 1}<span style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase' }}>{(q.difficulty || 'm')[0]}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={lang} onChange={(e) => setLang(e.target.value)}
              style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, border: `1px solid ${T2.border}`, borderRadius: 6, padding: '4px 8px', background: T2.bg, color: T2.textMain, cursor: 'pointer', outline: 'none' }}>
              {availableLanguages.map(l => <option key={l} value={l.toLowerCase()}>{l}</option>)}
            </select>
            <button onClick={onClose} title="Close"
              style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T2.border}`, background: '#f8f8f8', color: T2.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13}/>
            </button>
          </div>
        </div>

        {/* ── SUB-TOOLBAR (Difficulty / file badge / Exercise Info / Score Overview) ── */}
        <div style={{ flexShrink: 0, height: 44, background: T2.bg, borderBottom: `1px solid ${T2.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: T2.textSub, fontWeight: 600 }}>Difficulty</span>
            <select value={progDifficultyFilter} onChange={(e) => setProgDifficultyFilter(e.target.value as any)}
              style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, border: `1px solid ${T2.border}`, borderRadius: 6, padding: '4px 10px', background: T2.bg, color: T2.textMain, cursor: 'pointer', outline: 'none' }}>
              <option value="all">All difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div style={{ padding: '4px 10px', borderRadius: 99, background: T2.blueLight, color: T2.blueDark, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <FileIcon size={11}/> 1 file
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setShowProgInfoModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: `1px solid ${T2.border}`, background: T2.bg, color: T2.textSub, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              <Info size={12}/> Exercise Info
            </button>
            <button onClick={() => setShowProgScoreModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: `1px solid ${T2.border}`, background: T2.bg, color: T2.textSub, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
              <BarChart3 size={12}/> Score Overview
            </button>
          </div>
        </div>

        {/* ── BODY: PROBLEM | activity bar | EXPLORER | EDITOR + TERMINAL ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>

          {/* PROBLEM panel */}
          <div style={{ width: '28%', minWidth: 280, flexShrink: 0, background: T2.bg, borderRight: `1px solid ${T2.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Problem header — matches multi-file-code-editor.tsx exactly */}
            <div style={{ flexShrink: 0, padding: '8px 12px', borderBottom: `1px solid ${T2.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: T2.bg }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PROBLEM</span>
              </div>
              {allQuestions.length > 1 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={goPrev} disabled={currentIndex === 0}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '0 8px', height: 24, borderRadius: 5, border: '1px solid #c7d2fe', background: currentIndex === 0 ? '#f5f5f5' : '#eef2ff', color: currentIndex === 0 ? '#9ca3af' : '#4338ca', fontSize: 11, fontWeight: 500, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentIndex === 0 ? 0.5 : 1 }}>
                    <ChevronLeft size={11}/> Prev
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', minWidth: 34, textAlign: 'center' }}>{currentIndex + 1}/{allQuestions.length}</span>
                  <button onClick={goNext} disabled={currentIndex >= allQuestions.length - 1}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '0 8px', height: 24, borderRadius: 5, border: '1px solid #fed7aa', background: currentIndex >= allQuestions.length - 1 ? '#f5f5f5' : '#fff7ed', color: currentIndex >= allQuestions.length - 1 ? '#9ca3af' : '#ea580c', fontSize: 11, fontWeight: 500, cursor: currentIndex >= allQuestions.length - 1 ? 'not-allowed' : 'pointer', opacity: currentIndex >= allQuestions.length - 1 ? 0.5 : 1 }}>
                    Next <ChevronRight size={11}/>
                  </button>
                </div>
              ) : (
                <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'ui-monospace,monospace' }}>Q {currentIndex + 1}/{allQuestions.length || 1}</span>
              )}
            </div>

            {/* Problem content — matches code-editor.tsx left panel exactly */}
            <div className="mock-s" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
              {/* Header: Q badge + Language pill + Title + difficulty/marks badges */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#ffedd5', color: '#ea580c', fontFamily: FONT, whiteSpace: 'nowrap' as const }}>
                    Q {currentIndex + 1} / {allQuestions.length}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: '#f3f4f6', color: '#4b5563', fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap' as const }}>
                    {langLabel}
                  </span>
                </div>
                <h1 style={{ fontFamily: FONT, margin: '0 0 6px 0', fontSize: 18, fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>{titleText || 'Problem'}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {difficultyDisplay && (
                    <span style={{
                      padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                      background: difficultyDisplay === 'Easy' ? '#dcfce7' : difficultyDisplay === 'Medium' ? '#fef3c7' : '#fee2e2',
                      color: difficultyDisplay === 'Easy' ? '#166534' : difficultyDisplay === 'Medium' ? '#854d0e' : '#991b1b',
                    }}>
                      {difficultyDisplay}
                    </span>
                  )}
                  {marks > 0 && (
                    <span style={{ fontSize: 11, fontFamily: FONT, fontWeight: 600, padding: '2px 9px', borderRadius: 99, background: '#dcfce7', color: '#15803d', whiteSpace: 'nowrap' as const }}>
                      {marks} {marks === 1 ? 'mark' : 'marks'}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <FileText size={15} style={{ color: '#fb923c' }}/>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Description</h3>
                </div>
                {rawDesc ? (
                  descHtml ? (
                    <div className="mock-prose" style={{ fontSize: 12.5, lineHeight: 1.8, color: '#374151' }}
                         dangerouslySetInnerHTML={{ __html: rawDesc }}/>
                  ) : (
                    <p style={{ fontSize: 12.5, lineHeight: 1.8, color: '#374151', margin: 0, whiteSpace: 'pre-wrap' as const }}>{rawDesc}</p>
                  )
                ) : (
                  <p style={{ fontSize: 12.5, color: '#9ca3af', margin: 0, fontStyle: 'italic' as const }}>Solve the problem using the editor on the right.</p>
                )}
              </div>

              {/* Sample Input & Output */}
              {examples.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <TerminalIcon size={15} style={{ color: '#22c55e' }}/>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Sample Input &amp; Output</h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {examples.map((ex, ei) => (
                      <div key={ei}>
                        <strong style={{ fontSize: 12, color: '#4b5563' }}>Example {ei + 1}</strong>
                        <div style={{ marginTop: 5, marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 3 }}>Input:</div>
                          <div style={{ padding: 8, borderRadius: 5, fontFamily: 'ui-monospace,monospace', fontSize: 12, background: '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb', whiteSpace: 'pre-wrap' as const }}>{ex.input}</div>
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#374151', marginBottom: 3 }}>Output:</div>
                          <div style={{ padding: 8, borderRadius: 5, fontFamily: 'ui-monospace,monospace', fontSize: 12, background: '#f3f4f6', color: '#111827', border: '1px solid #e5e7eb', whiteSpace: 'pre-wrap' as const }}>{ex.output}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Constraints */}
              {hasConstraints && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <AlertCircle size={15} style={{ color: '#eab308' }}/>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Constraints</h3>
                  </div>
                  <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {currentQ.constraints.map((c: any) => typeof c === 'string' ? c : (c && typeof c.text === 'string' ? c.text : extractPlainText(c))).filter((c: string) => c && c.trim()).map((c: string, ci: number) => (
                      <li key={ci} style={{ padding: '5px 10px', borderRadius: 4, fontFamily: 'ui-monospace,monospace', fontSize: 12, color: '#374151', background: '#f9fafb' }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hints */}
              {hintsList.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <AlertCircle size={15} style={{ color: '#fb923c' }}/>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Hints</h3>
                  </div>
                  {hintsList.map((h, hi) => (
                    <div key={hi} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 4, marginBottom: 4, background: '#fff7ed', color: '#9a3412', border: '1px solid #ffedd5' }}>
                      💡 {h}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Activity bar — VS Code style dark rail */}
          <div style={{ flexShrink: 0, width: 44, background: '#1e293b', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
            {([
              { key: 'files' as const, Icon: FileText, label: 'Explorer (files)' },
              { key: 'search' as const, Icon: Search, label: 'Search across files' },
            ]).map(({ key, Icon, label }) => {
              const active = progSidebarTab === key;
              return (
                <button key={key} title={label}
                  onClick={() => setProgSidebarTab(key)}
                  style={{ height: 44, position: 'relative' as const, color: active ? '#fff' : '#94a3b8', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {active && <span style={{ position: 'absolute' as const, left: 0, top: 6, bottom: 6, width: 2, background: '#fff', borderRadius: 2 }}/>}
                  <Icon size={20}/>
                </button>
              );
            })}
          </div>

          {/* Explorer panel */}
          <div style={{ flexShrink: 0, width: 200, background: T2.bg, borderRight: `1px solid ${T2.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, height: 36, padding: '0 12px', borderBottom: `1px solid ${T2.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: T2.textSub, letterSpacing: '0.04em' }}>
                {progSidebarTab === 'files' ? 'EXPLORER' : 'SEARCH'}
              </span>
              {progSidebarTab === 'files' && (
                <div style={{ display: 'flex', gap: 2 }}>
                  <button title="New file (preview)"
                    style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', color: T2.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FilePlus size={12}/>
                  </button>
                  <button title="New folder (preview)"
                    style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', color: T2.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FolderPlus size={12}/>
                  </button>
                </div>
              )}
            </div>
            <div className="mock-s" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 0' }}>
              {progSidebarTab === 'files' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: T2.blueLight, color: T2.blueDark, cursor: 'pointer' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600 }}>
                    <FileIcon size={13}/> {fileName}
                  </span>
                  <button onClick={executeCode} disabled={isRunning}
                    style={{ fontSize: 9.5, fontWeight: 700, color: T2.green, background: 'transparent', border: 'none', cursor: isRunning ? 'not-allowed' : 'pointer', padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em' }}>
                    RUN
                  </button>
                </div>
              ) : (
                <div style={{ padding: '8px 12px' }}>
                  <input placeholder="Search files…" disabled
                    style={{ width: '100%', fontSize: 12, padding: '5px 8px', border: `1px solid ${T2.border}`, borderRadius: 5, background: T2.pageBg, color: T2.textMuted, outline: 'none' }}/>
                  <p style={{ fontSize: 11, color: T2.textMuted, marginTop: 8 }}>Search not available in preview.</p>
                </div>
              )}
            </div>
          </div>

          {/* Editor + Terminal column */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: T2.bg }}>
            {/* Editor toolbar */}
            <div style={{ flexShrink: 0, height: 40, borderBottom: `1px solid ${T2.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T2.pageBg, padding: '0 8px 0 0' }}>
              {/* File tab */}
              <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', background: T2.bg, borderRight: `1px solid ${T2.border}`, borderBottom: `2px solid ${T2.blue}`, height: '100%' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: T2.blue, display: 'inline-block' }}/>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T2.textMain, fontFamily: FONT }}>{fileName}</span>
                </div>
              </div>
              {/* Right-side action buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={executeCode} disabled={isRunning}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: 'none', background: isRunning ? '#e5e7eb' : T2.green, color: isRunning ? T2.textMuted : '#fff', fontSize: 12, fontWeight: 700, cursor: isRunning ? 'not-allowed' : 'pointer', fontFamily: FONT, transition: 'all 0.13s' }}>
                  {isRunning ? <Loader2 size={12} className="animate-spin"/> : <PlayCircle size={12}/>}
                  {isRunning ? 'Running...' : 'Run'}
                </button>
                <button title="Visualize (preview only)" disabled
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${T2.border}`, background: T2.bg, color: T2.textMuted, fontSize: 11.5, fontWeight: 600, cursor: 'not-allowed', opacity: 0.6, fontFamily: FONT }}>
                  <Eye size={12}/> Visualize
                </button>
                <button onClick={() => setShowTerminal(p => !p)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 6, border: `1px solid ${showTerminal ? T2.blue : T2.border}`, background: showTerminal ? T2.blueLight : T2.bg, color: showTerminal ? T2.blueDark : T2.textSub, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}>
                  <TerminalIcon size={12}/> Terminal
                </button>
                <button onClick={() => { setCode(''); setConsoleLines([]); }} disabled={isRunning} title="Reset code & console"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, border: `1px solid ${T2.border}`, background: T2.bg, color: T2.textSub, fontSize: 11, fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.5 : 1, fontFamily: FONT }}>
                  <RotateCcw size={11}/> Reset
                </button>
                <button onClick={() => setIsEditorFullscreen(p => !p)} title={isEditorFullscreen ? 'Exit fullscreen' : 'Fullscreen editor'}
                  style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${T2.border}`, background: T2.bg, color: T2.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isEditorFullscreen ? <Minimize2 size={13}/> : <Maximize2 size={13}/>}
                </button>
              </div>
            </div>

            {/* Monaco editor */}
            <div style={{ flex: showTerminal && !isEditorFullscreen ? 1 : 1, minHeight: 0, position: 'relative' }}>
              <MonacoEditor
                key={`mock-prog-editor-${currentIndex}-${lang}`}
                height="100%"
                language={getMonacoLang(lang)}
                value={code}
                onChange={(v) => setCode(v || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13.5,
                  fontFamily: 'ui-monospace, "Courier New", monospace',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on',
                  padding: { top: 12 },
                }}
              />
            </div>

            {/* Terminal */}
            {showTerminal && !isEditorFullscreen && (
              <div style={{ flexShrink: 0, height: 220, background: '#0f0f0f', borderTop: `1px solid ${T2.border}`, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flexShrink: 0, height: 30, padding: '0 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1a1a1a', background: '#0a0a0a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <TerminalIcon size={11} style={{ color: '#10b981' }}/>
                    <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5, fontWeight: 700, color: '#e5e7eb', letterSpacing: '0.04em' }}>TERMINAL</span>
                    {isRunning && <Loader2 size={10} className="animate-spin" style={{ color: '#10b981' }}/>}
                  </div>
                  <button onClick={() => setConsoleLines([])}
                    style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Clear">
                    <Trash2 size={11}/>
                  </button>
                </div>
                <div className="term-s" style={{ flex: 1, overflowY: 'auto', padding: '8px 14px', fontFamily: 'ui-monospace,monospace', fontSize: 12, lineHeight: 1.65, color: '#e5e7eb' }}>
                  {consoleLines.length === 0 && !isRunning && (
                    <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Ready. Press Run to execute your program.</span>
                  )}
                  {consoleLines.map(line => (
                    <div key={line.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', color: line.type === 'error' ? '#f87171' : line.type === 'input' ? '#fbbf24' : line.type === 'system' ? '#10b981' : '#e5e7eb' }}>
                      <span style={{ opacity: 0.55, fontSize: 10, marginTop: 2, flexShrink: 0 }}>
                        {line.type === 'input' ? '$' : line.type === 'error' ? '✗' : line.type === 'system' ? '➜' : '›'}
                      </span>
                      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.text || ' '}</span>
                    </div>
                  ))}
                  <div ref={consoleEndRef}/>
                </div>
                {/* Stdin */}
                {lang === 'python' ? (
                  <div style={{ flexShrink: 0, borderTop: `1px solid ${waitingForInput ? '#fb923c' : '#1a1a1a'}`, background: waitingForInput ? '#29170c' : '#0a0a0a', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, fontWeight: 700, color: waitingForInput ? '#fdba74' : '#404040' }}>›</span>
                    <input ref={consoleInputRef} value={consoleInput}
                      onChange={(e) => setConsoleInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitInput(); }}
                      placeholder={waitingForInput ? 'Type input and press Enter…' : 'Waiting for input()…'}
                      disabled={!waitingForInput}
                      style={{ flex: 1, fontFamily: 'ui-monospace,monospace', fontSize: 12, background: 'transparent', border: 'none', outline: 'none', color: '#e5e7eb', opacity: waitingForInput ? 1 : 0.4 }}/>
                    {waitingForInput && (
                      <button onClick={submitInput}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 5, border: 'none', background: '#fb923c', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        Enter ↵
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ flexShrink: 0, borderTop: '1px solid #1a1a1a', background: '#0a0a0a', padding: '6px 12px' }}>
                    <span style={{ fontFamily: FONT, fontSize: 9, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stdin (optional)</span>
                    <textarea value={consoleInput} onChange={(e) => setConsoleInput(e.target.value)}
                      placeholder="Provide input here before running…" rows={2} disabled={isRunning}
                      style={{ width: '100%', marginTop: 3, fontFamily: 'ui-monospace,monospace', fontSize: 11.5, background: '#0f0f0f', border: '1px solid #1f2937', borderRadius: 5, outline: 'none', color: '#e5e7eb', padding: '5px 8px', resize: 'none' as const, boxSizing: 'border-box' as const, opacity: isRunning ? 0.5 : 1 }}/>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Exercise Info modal */}
        {showProgInfoModal && (
          <div onClick={() => setShowProgInfoModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ width: 440, maxWidth: '90vw', background: T2.bg, borderRadius: 10, boxShadow: '0 20px 50px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T2.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T2.textMain }}>Exercise Information</span>
                <button onClick={() => setShowProgInfoModal(false)}
                  style={{ width: 26, height: 26, borderRadius: 5, border: 'none', background: T2.pageBg, color: T2.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={13}/>
                </button>
              </div>
              <div style={{ padding: 16, fontSize: 13, color: T2.textMain, lineHeight: 1.7 }}>
                <p style={{ margin: '0 0 6px 0' }}><b>Name:</b> {exercise.exerciseInformation?.exerciseName}</p>
                <p style={{ margin: '0 0 6px 0' }}><b>Level:</b> {exercise.exerciseInformation?.exerciseLevel || '—'}</p>
                <p style={{ margin: '0 0 6px 0' }}><b>Duration:</b> {exercise.exerciseInformation?.totalDuration ? `${exercise.exerciseInformation.totalDuration} min` : '—'}</p>
                <p style={{ margin: '0 0 6px 0' }}><b>Total marks:</b> {exercise.exerciseInformation?.totalMarks ?? '—'}</p>
                <p style={{ margin: '0 0 6px 0' }}><b>Questions:</b> {allQuestions.length}</p>
              </div>
            </div>
          </div>
        )}
        {/* Score Overview modal */}
        {showProgScoreModal && (
          <div onClick={() => setShowProgScoreModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={(e) => e.stopPropagation()}
              style={{ width: 440, maxWidth: '90vw', background: T2.bg, borderRadius: 10, boxShadow: '0 20px 50px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T2.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T2.textMain }}>Score Overview</span>
                <button onClick={() => setShowProgScoreModal(false)}
                  style={{ width: 26, height: 26, borderRadius: 5, border: 'none', background: T2.pageBg, color: T2.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={13}/>
                </button>
              </div>
              <div style={{ padding: 16, fontSize: 13, color: T2.textMain, lineHeight: 1.7 }}>
                {allQuestions.map((q: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < allQuestions.length - 1 ? `1px solid ${T2.borderSoft}` : 'none' }}>
                    <span>Q{i + 1} — {extractPlainText(q.title || q.questionTitle || '') || 'Question'}</span>
                    <span style={{ fontWeight: 700, color: T2.greenDark }}>{q.score || q.points || q.mcqQuestionScore || 0} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  // ── End Programming mock view ──────────────────────────────────────────────

  // ── Shared chrome for typed mocks (SQL / Frontend / Others) ─────────────────
  const TYPED_FONT = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  // Shared top bar + sub-toolbar (no Submit; only Close + question pills + lang/type label)
  const renderTypedTopChrome = (typeLabel: string, langSelector?: React.ReactNode) => (
    <>
      <div style={{ flexShrink: 0, height: 44, background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: '#F27757', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Code size={13} color="#fff"/>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Exercise Mock Preview — {exercise.exerciseInformation?.exerciseName}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' as const, overflowX: 'auto', maxWidth: '50%' }}>
          {allQuestions.map((q: any, i: number) => {
            const isCurr = i === currentIndex;
            return (
              <button key={i} onClick={() => setCurrentIndex(i)}
                style={{ height: 26, minWidth: 36, padding: '0 8px', borderRadius: 6, border: `1.5px solid ${isCurr ? '#F27757' : '#e5e7eb'}`, background: isCurr ? 'rgba(242,119,87,0.08)' : '#f8f8f8', color: isCurr ? '#e0623f' : '#6b7280', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: TYPED_FONT }}>
                {i + 1}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {langSelector}
          <span style={{ padding: '4px 10px', borderRadius: 99, background: '#eef2ff', color: '#4338ca', fontSize: 11, fontWeight: 600 }}>{typeLabel}</span>
          <button onClick={onClose} title="Close"
            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f8f8f8', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13}/>
          </button>
        </div>
      </div>
    </>
  );

  // Shared problem panel content (reused by SQL/Frontend/Others) — compact layout
  const renderTypedProblemPanel = () => {
    const titleText = extractPlainText(currentQ.title || '') || extractPlainText(currentQ.questionTitle || '') || 'Question';
    const rawDesc = getQuestionDescription(currentQ);
    const descHtml = /<[a-z][^>]*>/i.test(rawDesc);
    const marks = currentQ.score || currentQ.points || 0;
    const hasConstraints = Array.isArray(currentQ.constraints) && currentQ.constraints.some((c: any) => {
      const s = typeof c === 'string' ? c : (c && typeof c.text === 'string' ? c.text : extractPlainText(c));
      return s && s.trim();
    });
    const hintsList: string[] = (currentQ.hints || [])
      .filter((h: any) => h && (h.isPublic === undefined || h.isPublic === true))
      .map((h: any) => {
        if (typeof h === 'string') return h;
        const raw = h && (h.hintText ?? h.text ?? '');
        if (typeof raw === 'string') return raw;
        return extractPlainText(raw);
      })
      .filter((s: any) => typeof s === 'string' && s.length > 0);
    return (
      <div className="mock-s" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 22, fontFamily: TYPED_FONT }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: '#ffedd5', color: '#ea580c' }}>
              Q {currentIndex + 1} / {allQuestions.length}
            </span>
          </div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: 18, fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>{titleText}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {currentQ.difficulty && (
              <span style={{
                padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 500,
                background: currentQ.difficulty === 'easy' ? '#dcfce7' : currentQ.difficulty === 'medium' ? '#fef3c7' : '#fee2e2',
                color: currentQ.difficulty === 'easy' ? '#166534' : currentQ.difficulty === 'medium' ? '#854d0e' : '#991b1b',
                textTransform: 'capitalize' as const,
              }}>
                {currentQ.difficulty}
              </span>
            )}
            {marks > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 99, background: '#dcfce7', color: '#15803d' }}>
                {marks} {marks === 1 ? 'mark' : 'marks'}
              </span>
            )}
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <FileText size={15} style={{ color: '#fb923c' }}/>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Description</h3>
          </div>
          {rawDesc ? (
            descHtml
              ? <div className="mock-prose" style={{ fontSize: 12.5, lineHeight: 1.8, color: '#374151' }} dangerouslySetInnerHTML={{ __html: rawDesc }}/>
              : <p style={{ fontSize: 12.5, lineHeight: 1.8, color: '#374151', margin: 0, whiteSpace: 'pre-wrap' as const }}>{rawDesc}</p>
          ) : (
            <p style={{ fontSize: 12.5, color: '#9ca3af', margin: 0, fontStyle: 'italic' as const }}>Solve the question using the editor on the right.</p>
          )}
        </div>
        {hasConstraints && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AlertCircle size={15} style={{ color: '#eab308' }}/>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Constraints</h3>
            </div>
            <ul style={{ paddingLeft: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {currentQ.constraints.map((c: any) => typeof c === 'string' ? c : (c && typeof c.text === 'string' ? c.text : extractPlainText(c))).filter((c: string) => c && c.trim()).map((c: string, ci: number) => (
                <li key={ci} style={{ padding: '5px 10px', borderRadius: 4, fontFamily: 'ui-monospace,monospace', fontSize: 12, color: '#374151', background: '#f9fafb' }}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {hintsList.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AlertCircle size={15} style={{ color: '#fb923c' }}/>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>Hints</h3>
            </div>
            {hintsList.map((h, hi) => (
              <div key={hi} style={{ fontSize: 12, padding: '8px 12px', borderRadius: 4, marginBottom: 4, background: '#fff7ed', color: '#9a3412', border: '1px solid #ffedd5' }}>💡 {h}</div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── SQL / Database mock view (mirrors db-queryEditor.tsx — no real DB execution) ──
  if (isCurrentDatabase && currentQ) {
    return (
      <div style={{ position: 'fixed' as const, inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column' as const, background: '#f8f9fa', fontFamily: TYPED_FONT, overflow: 'hidden' }}>
        <style>{`
          .mock-prose, .mock-prose * { text-align: left !important; }
          .mock-prose p { margin: 0 0 8px 0; }
          .mock-prose pre { background:#f5f5f5; border-radius:6px; padding:10px 12px; font-family:ui-monospace,monospace; font-size:12.5px; overflow-x:auto; }
          .mock-prose code { background:#f5f5f5; padding:1px 5px; border-radius:4px; font-family:ui-monospace,monospace; font-size:12.5px; }
          .mock-s::-webkit-scrollbar { width:7px; height:7px; }
          .mock-s::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:99px; }
        `}</style>
        {renderTypedTopChrome('SQL')}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: '32%', minWidth: 300, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>PROBLEM</span>
              {allQuestions.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)} disabled={currentIndex === 0}
                    style={{ padding: '0 8px', height: 24, borderRadius: 5, border: '1px solid #c7d2fe', background: currentIndex === 0 ? '#f5f5f5' : '#eef2ff', color: currentIndex === 0 ? '#9ca3af' : '#4338ca', fontSize: 11, fontWeight: 500, cursor: currentIndex === 0 ? 'not-allowed' as const : 'pointer' as const, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <ChevronLeft size={11}/> Prev
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', minWidth: 34, textAlign: 'center' as const }}>{currentIndex + 1}/{allQuestions.length}</span>
                  <button onClick={() => currentIndex < allQuestions.length - 1 && setCurrentIndex(currentIndex + 1)} disabled={currentIndex >= allQuestions.length - 1}
                    style={{ padding: '0 8px', height: 24, borderRadius: 5, border: '1px solid #fed7aa', background: currentIndex >= allQuestions.length - 1 ? '#f5f5f5' : '#fff7ed', color: currentIndex >= allQuestions.length - 1 ? '#9ca3af' : '#ea580c', fontSize: 11, fontWeight: 500, cursor: currentIndex >= allQuestions.length - 1 ? 'not-allowed' as const : 'pointer' as const, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    Next <ChevronRight size={11}/>
                  </button>
                </div>
              )}
            </div>
            {renderTypedProblemPanel()}
            {currentQ.sampleQuery && (
              <div style={{ borderTop: '1px solid #e5e7eb', padding: '10px 14px', background: '#f9fafb' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Database size={12} style={{ color: '#fb923c' }}/>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Sample Query</span>
                </div>
                <pre style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, background: '#1e293b', color: '#e2e8f0', padding: 10, borderRadius: 6, margin: 0, overflowX: 'auto' }}>{currentQ.sampleQuery}</pre>
              </div>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', background: '#fff' }}>
            <div style={{ flexShrink: 0, height: 40, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Database size={14} style={{ color: '#fb923c' }}/>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1a2e' }}>query.sql</span>
              </div>
              <button onClick={() => { setConsoleLines([{ id: mkLineId(), type: 'system', text: '▶ Query executed (mock preview — no real database)' }]); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' as const, fontFamily: TYPED_FONT }}>
                <PlayCircle size={12}/> Run Query
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <MonacoEditor
                key={`mock-sql-${currentIndex}`}
                height="100%"
                language="sql"
                value={code}
                onChange={(v) => setCode(v || '')}
                theme="vs-dark"
                options={{ minimap: { enabled: false }, fontSize: 13.5, lineNumbers: 'on' as const, scrollBeyondLastLine: false, automaticLayout: true, tabSize: 2, wordWrap: 'on' as const, padding: { top: 12 } }}
              />
            </div>
            <div style={{ flexShrink: 0, height: 180, background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const }}>
              <div style={{ flexShrink: 0, padding: '6px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TerminalIcon size={12} style={{ color: '#10b981' }}/>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', letterSpacing: '0.04em' }}>RESULTS</span>
                <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 'auto' }}>Preview only — connect to a database for live results</span>
              </div>
              <div className="mock-s" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                {consoleLines.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' as const, margin: 0 }}>Run your query to see a sample results pane here.</p>
                ) : (
                  consoleLines.map(line => (
                    <div key={line.id} style={{ fontSize: 12, color: '#374151', fontFamily: 'ui-monospace,monospace' }}>{line.text}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // ── End SQL mock ───────────────────────────────────────────────────────────

  // ── Frontend mock view (mirrors frontendCompiler.tsx — HTML/CSS/JS + live iframe preview) ──
  if (isCurrentFrontend && currentQ) {
    // Use the existing `code` state for HTML; we keep CSS/JS local for the mock.
    return (
      <FrontendMockBody
        currentIndex={currentIndex}
        allQuestions={allQuestions}
        setCurrentIndex={setCurrentIndex}
        onClose={onClose}
        exercise={exercise}
        currentQ={currentQ}
        renderTypedTopChrome={renderTypedTopChrome}
        renderTypedProblemPanel={renderTypedProblemPanel}
        TYPED_FONT={TYPED_FONT}
      />
    );
  }
  // ── End Frontend mock ──────────────────────────────────────────────────────

  // ── Others mock view (mirrors OthersExam.tsx — file-upload / notion) ──
  if (isCurrentOthers && currentQ) {
    const othersType: string = currentQ.othersQuestionType || currentQ.questionSubType || 'file-upload';
    const fileSettings = currentQ.fileUploadSettings || {};
    const notionSettings = currentQ.notionSettings || {};
    const allowedTypes: string[] = fileSettings.allowedFileTypes || ['*'];
    const maxFiles: number = fileSettings.allowMultiple ? (fileSettings.maxFiles || 5) : 1;
    return (
      <div style={{ position: 'fixed' as const, inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column' as const, background: '#f8f9fa', fontFamily: TYPED_FONT, overflow: 'hidden' }}>
        <style>{`
          .mock-prose, .mock-prose * { text-align: left !important; }
          .mock-prose p { margin: 0 0 8px 0; }
          .mock-s::-webkit-scrollbar { width:7px; height:7px; }
          .mock-s::-webkit-scrollbar-thumb { background:#d1d5db; border-radius:99px; }
        `}</style>
        {renderTypedTopChrome(othersType === 'notion' ? 'Notion' : 'File Upload')}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: '38%', minWidth: 320, flexShrink: 0, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>PROBLEM</span>
              {allQuestions.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)} disabled={currentIndex === 0}
                    style={{ padding: '0 8px', height: 24, borderRadius: 5, border: '1px solid #c7d2fe', background: currentIndex === 0 ? '#f5f5f5' : '#eef2ff', color: currentIndex === 0 ? '#9ca3af' : '#4338ca', fontSize: 11, fontWeight: 500, cursor: currentIndex === 0 ? 'not-allowed' as const : 'pointer' as const, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    <ChevronLeft size={11}/> Prev
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', minWidth: 34, textAlign: 'center' as const }}>{currentIndex + 1}/{allQuestions.length}</span>
                  <button onClick={() => currentIndex < allQuestions.length - 1 && setCurrentIndex(currentIndex + 1)} disabled={currentIndex >= allQuestions.length - 1}
                    style={{ padding: '0 8px', height: 24, borderRadius: 5, border: '1px solid #fed7aa', background: currentIndex >= allQuestions.length - 1 ? '#f5f5f5' : '#fff7ed', color: currentIndex >= allQuestions.length - 1 ? '#9ca3af' : '#ea580c', fontSize: 11, fontWeight: 500, cursor: currentIndex >= allQuestions.length - 1 ? 'not-allowed' as const : 'pointer' as const, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    Next <ChevronRight size={11}/>
                  </button>
                </div>
              )}
            </div>
            {renderTypedProblemPanel()}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', background: '#fff', padding: 24 }}>
            {othersType === 'file-upload' ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 12, justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ width: '100%', maxWidth: 520, border: '2px dashed #d1d5db', borderRadius: 10, padding: '40px 24px', textAlign: 'center' as const, background: '#fafafa' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <FileIcon size={26} style={{ color: '#fb923c' }}/>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px 0' }}>Drop files here or click to upload</p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                    Allowed: {allowedTypes.includes('*') ? 'Any file type' : allowedTypes.join(', ')}
                  </p>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Max files: {maxFiles}{fileSettings.maxFileSize ? ` • Max size: ${fileSettings.maxFileSize}MB` : ''}</p>
                  <button disabled
                    style={{ marginTop: 14, padding: '8px 18px', borderRadius: 6, border: 'none', background: '#fb923c', color: '#fff', fontSize: 12, fontWeight: 600, opacity: 0.7, cursor: 'not-allowed' as const }}>
                    Choose Files
                  </button>
                </div>
                <p style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' as const, textAlign: 'center' as const }}>Preview only — uploads disabled in mock</p>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <FileText size={14} style={{ color: '#a855f7' }}/>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1a2e' }}>Notion-style answer</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: '#9ca3af' }}>Preview only — read-only here</span>
                </div>
                <div className="mock-s" style={{ flex: 1, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, background: '#fff' }}>
                  <p style={{ fontSize: 13, color: '#9ca3af', fontStyle: 'italic' as const, margin: 0 }}>
                    Student would write their answer here using a Notion-style block editor. Allowed blocks based on settings:
                  </p>
                  <ul style={{ fontSize: 12, color: '#374151', marginTop: 10 }}>
                    {notionSettings.allowBold !== false && <li>Bold</li>}
                    {notionSettings.allowItalic !== false && <li>Italic</li>}
                    {notionSettings.allowUnderline !== false && <li>Underline</li>}
                    {notionSettings.allowHeadings !== false && <li>Headings</li>}
                    {notionSettings.allowLists !== false && <li>Lists</li>}
                    {notionSettings.allowImages && <li>Images</li>}
                    {notionSettings.allowCode && <li>Code blocks</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  // ── End Others mock ────────────────────────────────────────────────────────

  // Render left panel content
  const renderLeftPanel = () => {
    if (!currentQ) return null;

    const diffStyle = DS[currentQ.difficulty || 'medium'] || DS.medium;
    const sampleTcs = currentQ.testCases?.filter((tc: any) => tc.isSample && (tc.input?.trim() || tc.expectedOutput?.trim())) || [];
    const hasConstraints = Array.isArray(currentQ.constraints) && currentQ.constraints.some((c: any) => {
      const s = typeof c === 'string' ? c : (c && typeof c.text === 'string' ? c.text : extractPlainText(c));
      return s && s.trim();
    });

    // For MCQ, show options
    if (isCurrentMCQ) {
      const options = getMCQOptions(currentQ);
      const isMultipleSelect = currentQ.mcqQuestionType === 'multiple_select';
      const questionTitle = getQuestionTitle(currentQ);
      const questionDescription = getQuestionDescription(currentQ);
      const questionScore = currentQ.mcqQuestionScore || currentQ.score || 0;

      return (
        <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {/* Title row */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600, color: '#999' }}>
                  {currentIndex + 1} / {allQuestions.length}
                </span>
                {currentQ.difficulty && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize',
                    backgroundColor: diffStyle.bg, color: diffStyle.text, border: `1px solid ${diffStyle.border}`
                  }}>
                    {currentQ.difficulty}
                  </span>
                )}
                <span style={{ fontSize: 10, color: '#999', fontFamily: 'var(--lms-font)' }}>
                  {questionScore} pts
                </span>
              </div>
              <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 20, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3, margin: 0 }}>
                {questionTitle}
              </h2>
            </div>

            <div style={{ height: 1, background: '#e5e5e5' }} />

            {/* Description */}
            {questionDescription && (
              <div>
                {/<[a-z][^>]*>/i.test(questionDescription) ? (
                  <div className="mock-prose" style={{ fontFamily: 'var(--lms-font)', fontSize: 13.5, lineHeight: 1.8, color: '#4a4a4a' }}
                       dangerouslySetInnerHTML={{ __html: questionDescription }}/>
                ) : (
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 13.5, lineHeight: 1.8, color: '#4a4a4a', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {questionDescription}
                  </p>
                )}
              </div>
            )}

            {/* Options */}
            {options.length > 0 && (
              <div>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>
                  Select your answer{isMultipleSelect ? '(s)' : ''}:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {options.map((opt: any, optIdx: number) => (
                    <label
                      key={optIdx}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 14px', borderRadius: 8,
                        border: `1.5px solid var(--lms-border)`,
                        cursor: 'pointer', transition: 'all 0.15s',
                        background: '#fff',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#F27757';
                        e.currentTarget.style.backgroundColor = 'rgba(242,119,87,0.04)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--lms-border)';
                        e.currentTarget.style.backgroundColor = '#fff';
                      }}
                    >
                      <input
                        type={isMultipleSelect ? 'checkbox' : 'radio'}
                        name={`mcq-${currentIndex}`}
                        value={opt.value}
                        style={{ marginTop: 2, accentColor: '#F27757' }}
                      />
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, color: '#1a1a2e', lineHeight: 1.5 }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Programming question left panel
    const questionTitle = extractPlainText(currentQ.title || '') || extractPlainText(currentQ.questionTitle || '') || 'Programming Question';
    const questionDescription = getQuestionDescription(currentQ);
    const descriptionIsHtml = /<[a-z][^>]*>/i.test(questionDescription);

    return (
      <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Title row */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600, color: '#999' }}>
                {currentIndex + 1} / {allQuestions.length}
              </span>
              {currentQ.difficulty && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize',
                  backgroundColor: diffStyle.bg, color: diffStyle.text, border: `1px solid ${diffStyle.border}`
                }}>
                  {currentQ.difficulty}
                </span>
              )}
              <span style={{ fontSize: 10, color: '#999', fontFamily: 'var(--lms-font)' }}>
                {currentQ.score || 0} pts
              </span>
            </div>
            <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 20, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3, margin: 0 }}>
              {questionTitle}
            </h2>
          </div>

          <div style={{ height: 1, background: '#e5e5e5' }} />

          {/* Description */}
          {questionDescription && (
            <div>
              {descriptionIsHtml ? (
                <div className="mock-prose" style={{ fontFamily: 'var(--lms-font)', fontSize: 13.5, lineHeight: 1.8, color: '#4a4a4a' }}
                     dangerouslySetInnerHTML={{ __html: questionDescription }}/>
              ) : (
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 13.5, lineHeight: 1.8, color: '#4a4a4a', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {questionDescription}
                </p>
              )}
            </div>
          )}

          {/* Examples/Sample Test Cases */}
          {sampleTcs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {sampleTcs.map((tc: any, ti: number) => (
                <div key={ti}>
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>
                    Example {ti + 1}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tc.input?.trim() && (
                      <div style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e5e5' }}>
                        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Input</p>
                        <pre style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5, color: '#1a1a2e', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{tc.input}</pre>
                      </div>
                    )}
                    {tc.expectedOutput?.trim() && (
                      <div style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e5e5' }}>
                        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Output</p>
                        <pre style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5, color: '#1a1a2e', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{tc.expectedOutput}</pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Constraints */}
          {hasConstraints && (
            <div>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Constraints
              </p>
              <ul style={{ paddingLeft: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none' }}>
                {currentQ.constraints.map((c: any) => typeof c === 'string' ? c : (c && typeof c.text === 'string' ? c.text : extractPlainText(c))).filter((c: string) => c && c.trim()).map((c: string, ci: number) => (
                  <li key={ci} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#F27757', fontSize: 12, marginTop: 1, flexShrink: 0 }}>•</span>
                    <code style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5, color: '#3a3a52', lineHeight: 1.6 }}>{c}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render right panel (editor + console) - routes by question type
  const renderRightPanel = () => {
    if (isCurrentMCQ) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fefefe', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <CheckCircle2 size={48} style={{ color: '#22c55e', marginBottom: 16 }} />
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 14, color: '#1a1a2e', fontWeight: 600 }}>MCQ Question</p>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: '#8b8b9e', marginTop: 8 }}>
              Select your answer from the options on the left
            </p>
          </div>
        </div>
      );
    }

    if (isUnsupportedType) {
      return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fefefe', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '40px', maxWidth: 420 }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Eye size={26} style={{ color: '#a855f7' }}/>
            </div>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 14, color: '#1a1a2e', fontWeight: 700 }}>
              {unsupportedTypeLabel} preview
            </p>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: '#8b8b9e', marginTop: 8, lineHeight: 1.6 }}>
              Live preview for <b>{unsupportedTypeLabel}</b> questions is coming soon. The question content is shown on the left so you can verify the prompt, test cases, and constraints.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fefefe' }}>
        {/* Toolbar */}
        <div style={{
          flexShrink: 0,
          padding: '0 12px',
          height: 44,
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: '#fafafa'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Code size={14} style={{ color: '#fb923c' }}/>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>Code</span>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5, color: '#999', background: '#fff', padding: '2px 8px', borderRadius: 4, border: '1px solid #e5e5e5' }}>
              {`solution.${lang === 'python' ? 'py' : lang === 'javascript' ? 'js' : lang === 'typescript' ? 'ts' : lang === 'java' ? 'java' : lang === 'cpp' ? 'cpp' : lang === 'csharp' ? 'cs' : lang}`}
            </span>
            {lang === 'python' && !pyodideReady && (
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={10} className="animate-spin" />
                <span>Loading runtime…</span>
              </span>
            )}
            {lang === 'python' && pyodideReady && (
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                <span>Ready</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={() => { setCode(''); setConsoleLines([]); }}
              disabled={isRunning}
              title="Reset code & console"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 6,
                border: '1px solid #d1d5db', background: '#fff',
                color: '#6b7280', fontFamily: 'var(--lms-font)',
                fontSize: 11, fontWeight: 600, cursor: isRunning ? 'not-allowed' : 'pointer',
                opacity: isRunning ? 0.5 : 1, transition: 'all 0.15s',
              }}
            >
              <RotateCcw size={11}/> Reset
            </button>
            <button
              onClick={executeCode}
              disabled={isRunning}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 16px',
                borderRadius: 6,
                border: 'none',
                background: isRunning ? '#e5e5e5' : '#F27757',
                color: isRunning ? '#999' : 'white',
                fontFamily: 'var(--lms-font)',
                fontSize: 12,
                fontWeight: 700,
                cursor: isRunning ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                boxShadow: isRunning ? 'none' : '0 2px 6px rgba(242,119,87,0.3)',
              }}
            >
              {isRunning ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <PlayCircle size={12}/>
                  <span>Run Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Code editor — Monaco */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', borderBottom: '1px solid #e5e5e5' }}>
          <MonacoEditor
            key={`mock-editor-${currentIndex}-${lang}`}
            height="100%"
            language={getMonacoLang(lang)}
            value={code}
            onChange={(v) => setCode(v || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13.5,
              fontFamily: 'ui-monospace, "Courier New", monospace',
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              padding: { top: 12 },
            }}
          />
        </div>

        {/* Console */}
        <div style={{ flexShrink: 0, height: 220, display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
          <div style={{
            flexShrink: 0, padding: '0 14px', height: 34, borderBottom: '1px solid #e5e5e5',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isRunning ? '#16a34a' : waitingForInput ? '#d97706' : '#ccc',
              transition: 'background 0.2s'
            }} />
            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5, fontWeight: 600, color: '#999' }}>
              {waitingForInput ? 'stdin' : isRunning ? 'running' : 'console'}
            </span>
            {consoleLines.length > 0 && (
              <button onClick={() => setConsoleLines([])}
                style={{
                  marginLeft: 'auto', fontFamily: 'var(--lms-font)', fontSize: 10,
                  color: '#999', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s'
                }}>
                clear
              </button>
            )}
          </div>

          <div style={{
            flex: 1, overflowY: 'auto', padding: '8px 14px',
            fontFamily: 'ui-monospace, monospace', fontSize: 12,
            lineHeight: 1.7, scrollbarWidth: 'thin'
          }}>
            {consoleLines.length === 0 && !isRunning && (
              <span style={{ color: '#ccc', fontStyle: 'italic', fontSize: 11 }}>
                Run your code to see output here…
              </span>
            )}
            {consoleLines.map(line => (
              <div key={line.id} style={{
                color: line.type === 'error' ? '#dc2626' : line.type === 'input' ? '#fb923c' : line.type === 'system' ? '#999' : '#1a1a2e',
                display: 'flex', alignItems: 'flex-start', gap: 6,
              }}>
                <span style={{ flexShrink: 0, opacity: 0.6, fontSize: 10, marginTop: 2 }}>
                  {line.type === 'input' ? '›' : line.type === 'error' ? '✗' : line.type === 'system' ? '#' : '$'}
                </span>
                <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.text || '\u00A0'}</span>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>

          {/* Input area for Python */}
          {lang === 'python' ? (
            <div style={{
              flexShrink: 0, borderTop: `1px solid ${waitingForInput ? '#fb923c' : '#e5e5e5'}`,
              background: waitingForInput ? '#fff7ed' : '#fafafa',
              padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s'
            }}>
              <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, fontWeight: 700, color: waitingForInput ? '#fb923c' : '#ccc', flexShrink: 0 }}>›</span>
              <input
                ref={consoleInputRef}
                value={consoleInput}
                onChange={e => setConsoleInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitInput(); }}
                placeholder={waitingForInput ? 'Type input and press Enter…' : 'Waiting for input()…'}
                disabled={!waitingForInput}
                style={{
                  flex: 1, fontFamily: 'ui-monospace,monospace', fontSize: 12,
                  background: 'transparent', border: 'none', outline: 'none',
                  color: '#1a1a2e', opacity: waitingForInput ? 1 : 0.3
                }}
              />
              {waitingForInput && (
                <button onClick={submitInput}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 5, border: '1px solid #fb923c',
                    background: '#fb923c', color: 'white', fontFamily: 'var(--lms-font)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer'
                  }}>
                  Enter ↵
                </button>
              )}
            </div>
          ) : (
            <div style={{ flexShrink: 0, borderTop: '1px solid #e5e5e5', background: '#fafafa', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 9, fontWeight: 700, color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stdin</span>
              <textarea
                value={consoleInput}
                onChange={e => setConsoleInput(e.target.value)}
                placeholder={'Provide input here before running…'}
                rows={2}
                disabled={isRunning}
                style={{
                  width: '100%', fontFamily: 'ui-monospace,monospace', fontSize: 11.5,
                  background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 5,
                  outline: 'none', color: '#1a1a2e', padding: '5px 8px',
                  resize: 'none', boxSizing: 'border-box', opacity: isRunning ? 0.4 : 1
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column',
      background: '#f5f5f5', overflow: 'hidden', fontFamily: 'var(--lms-font)'
    }}>
      {/* ── TOP NAV ── */}
      <div style={{
        flexShrink: 0, height: 44, borderBottom: '1px solid #e5e5e5', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#ffffff'
      }}>
        {/* Left: logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6, background: '#F27757',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Code size={13} style={{ color: 'white' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#333', fontFamily: 'var(--lms-font)', letterSpacing: 0.2 }}>
            Exercise Mock Preview — {exercise.exerciseInformation?.exerciseName}
          </span>
        </div>

        {/* Center: question pills with difficulty */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', maxWidth: '50%', overflowX: 'auto' }}>
          {allQuestions.map((q, i) => {
            const ds = DS[q.difficulty || 'medium'] || DS.medium;
            const isActive = i === currentIndex;
            const isProg = q.questionType === 'programming' || q.questionType === 'database';
            return (
              <button key={i} onClick={() => setCurrentIndex(i)}
                style={{
                  height: 26, minWidth: 26, padding: '0 8px', borderRadius: 6,
                  border: `1.5px solid ${isActive ? ds.border : '#e5e5e5'}`,
                  background: isActive ? ds.bg : '#f8f8f8',
                  color: isActive ? ds.text : '#666',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--lms-font)', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                {i + 1}
                {!isProg && <span style={{ fontSize: 9 }}>📝</span>}
                {q.difficulty && <span style={{ fontSize: 9, opacity: 0.8, textTransform: 'capitalize' }}>{q.difficulty[0]}</span>}
              </button>
            );
          })}
        </div>

        {/* Right: lang select + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isCurrentProgramming && (
            <select value={lang} onChange={e => setLang(e.target.value)}
              style={{
                fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600,
                border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 8px',
                background: '#ffffff', color: '#333', cursor: 'pointer', outline: 'none'
              }}>
              {availableLanguages.map(l => <option key={l} value={l.toLowerCase()}>{l}</option>)}
            </select>
          )}
          <button onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e5e5',
              background: '#f8f8f8', color: '#666', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
            }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── BODY: Left (42%) + Right (58%) ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel - Problem description (42%) */}
        <div style={{ width: '42%', flexShrink: 0, borderRight: '1px solid #e5e5e5', background: '#ffffff' }}>
          {renderLeftPanel()}
        </div>

        {/* Right Panel - Editor + Console (58%) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {renderRightPanel()}
        </div>
      </div>

      {/* ── FOOTER: Prev / Next ── */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid #e5e5e5', padding: '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff'
      }}>
        <button onClick={() => { if (currentIndex > 0) setCurrentIndex(currentIndex - 1); }} disabled={currentIndex === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px',
            borderRadius: 6, border: '1px solid #e5e5e5', background: '#f8f8f8',
            color: currentIndex === 0 ? '#ccc' : '#666', fontSize: 11, fontWeight: 600,
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--lms-font)', transition: 'all 0.15s'
          }}>
          <ChevronLeft size={12} /> Prev
        </button>
        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: '#999' }}>
          <span style={{ color: '#F27757', fontWeight: 700 }}>{currentIndex + 1}</span>
          <span style={{ margin: '0 4px' }}>/</span>
          {allQuestions.length}
        </span>
        {currentIndex < allQuestions.length - 1 ? (
          <button onClick={() => setCurrentIndex(currentIndex + 1)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px',
              borderRadius: 6, border: '1px solid #e5e5e5', background: '#f8f8f8',
              color: '#666', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--lms-font)', transition: 'all 0.15s'
            }}>
            Next <ChevronRight size={12} />
          </button>
        ) : (
          <button onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 14px',
              borderRadius: 6, border: 'none', background: '#F27757',
              color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--lms-font)'
            }}>
            <Check size={12} /> Done
          </button>
        )}
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

const ProblemSolving: React.FC<ProblemSolvingProps> = (props) => {
  const router = useRouter();
  const sectionHref = useSectionHref();
  const { nodeId, nodeName, subcategory, subcategoryLabel, hierarchyData, activeTab, nodeType, courseId, configuredLanguages, isHeaderHidden = false, onShowHeader } = props;

  // React Query cache — used ONLY to survive an unmount/remount cycle. The
  // list itself still lives in local `exercises` state so the surrounding
  // optimistic-update code (delete, edit, add) doesn't have to change. On
  // remount we seed the state from cache instantly (no loader) and refresh
  // in the background; the cache is refreshed after every successful fetch.
  //
  // Fixes the "listing assignment and assessment again and again loading"
  // bug: switching We_Do → You_Do → We_Do used to unmount this component
  // and lose the local state, so remount fell back to the empty initial
  // state and fired a fresh network call. With the cache, the second
  // We_Do visit paints from memory.
  const queryClient = useQueryClient();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [showAddQuestionOptions, setShowAddQuestionOptions] = useState(false);
  const [qbankFromMCQOpts, setQbankFromMCQOpts] = useState(false);

  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [showQuestions, setShowQuestions] = useState(false);

  const [selectedExerciseForAdd, setSelectedExerciseForAdd] = useState<Exercise | null>(null);
  const [fullExerciseForAdd, setFullExerciseForAdd] = useState<any>(null);
  const [exerciseToDelete, setExerciseToDelete] = useState<Exercise | null>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  /** true when ExerciseSettings is opened from ProgrammingQuestionForm — locks Config Strategy */
  const [lockConfigStrategy, setLockConfigStrategy] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingQuestions, setIsAddingQuestions] = useState(false);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [submissionStatusMap, setSubmissionStatusMap] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  // Add this state with your other useState declarations
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 10,
  });

  // Auto-fit page size — measure the tbody scroll region and pick the
  // largest itemsPerPage that fits without overflow, so the "9 assignments
  // but only 8 shown because the last one hides behind the pagination bar"
  // bug becomes impossible: overflowing rows land on the next page instead
  // of being clipped by the pager. Turns off the moment the user picks a
  // page size manually — their choice sticks after that.
  const tableBodyRef = useRef<HTMLDivElement | null>(null);
  const [autoFitPageSize, setAutoFitPageSize] = useState(true);

  // Derive readable subcategory labels for search placeholder + "New" button.
  // Plural form is used in "Search …" / column headers; singular for "+ New …".
  // Falls back to a basic trailing-s strip when subcategoryLabel is set
  // (e.g. "Assignments" → "Assignment"), or to a sensible default per subcat.
  const subLabelPlural = subcategoryLabel || (subcategory ? subcategory.replace(/_/g, ' ') : 'Items');
  const subLabelSingular = (() => {
    if (subcategory === 'self_work') return 'Self Work';
    if (subcategory === 'Assignments') return 'Assignment';
    if (subLabelPlural.endsWith('s') && subLabelPlural.length > 3) return subLabelPlural.slice(0, -1);
    return subLabelPlural;
  })();


  useEffect(() => {
    if (configuredLanguages) {
      console.log('✅ Programming Languages loaded in ProblemSolving:', {
        coreProgram: configuredLanguages.coreProgram,
        frontend: configuredLanguages.frontend,
        database: configuredLanguages.database
      });
    } else {
      console.log('⚠️ ProblemSolving: No configuredLanguages received');
    }
  }, [configuredLanguages]);  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (showQuestions) { setShowQuestions(false); setSelectedExercise(null); }
    setShowSettingsModal(false); setShowDeleteModal(false);
    setExerciseToDelete(null); setEditingExercise(null);
    setShowAddQuestionModal(false); setSelectedExerciseForAdd(null);
    setSubmissionStatusMap({});
  }, [nodeId, subcategory, activeTab]);

  // Cache key: any two calls with the same (entityType, entityId, tab,
  // subcategory) share a cached list. `courseId` is part of the key so a
  // different course's cache can never leak in (nodeId collisions are
  // theoretically possible across courses).
  const exercisesCacheKey = React.useMemo(
    () => [
      'problemSolvingExercises',
      getEntityType(nodeType),
      nodeId,
      activeTab,
      subcategory,
      courseId || '',
    ] as const,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nodeType, nodeId, activeTab, subcategory, courseId],
  );

  useEffect(() => {
    if (!showQuestions && subcategory?.trim()) {
      // Cache hit → paint immediately, then refresh silently in the
      // background so the user never sees a loader on a revisit. Cache
      // miss → fall through to the loud fetch (spinner + first paint).
      const cached = queryClient.getQueryData<Exercise[]>(exercisesCacheKey);
      if (cached && cached.length > 0) {
        setExercises(cached);
        setLoadingExercises(false);
        fetchExercises({ silent: true });
      } else {
        fetchExercises();
      }
    }
    else { setExercises([]); setLoadingExercises(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, subcategory, nodeType, activeTab, showQuestions]);



  useEffect(() => {
    const q = searchQuery.toLowerCase();
    const filtered = exercises.filter(ex => {
      const matchesType = !exerciseTypeFilter || ex.exerciseType === exerciseTypeFilter;
      const matchesSearch =
        !searchQuery ||
        ex.exerciseInformation?.exerciseName?.toLowerCase().includes(q) ||
        ex.exerciseInformation?.exerciseId?.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pagination.itemsPerPage) || 1;
    setPagination(prev => ({
      ...prev,
      totalItems,
      totalPages,
      currentPage: Math.min(prev.currentPage, totalPages),
    }));
  }, [searchQuery, exerciseTypeFilter, exercises]);

  // ResizeObserver on the tbody scroll region — recomputes the fitting
  // page size whenever the workspace resizes. ROW_H matches the h-11 body
  // row; SAFETY drops half a row so the last visible row can never land
  // right at the pager's border and clip.
  useEffect(() => {
    if (!autoFitPageSize) return;
    const el = tableBodyRef.current;
    if (!el) return;
    const ROW_H = 44;
    const SAFETY = Math.round(ROW_H / 2);
    const compute = () => {
      const budget = Math.max(0, el.clientHeight - SAFETY);
      const fits = Math.max(3, Math.min(50, Math.floor(budget / ROW_H)));
      setPagination(prev => (prev.itemsPerPage === fits ? prev : { ...prev, itemsPerPage: fits, currentPage: 1 }));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFitPageSize, loadingExercises]);

  // In ProblemSolving component (add near the top of the component)
  useEffect(() => {
    if (configuredLanguages) {
      console.log('ProblemSolving - Programming Languages:', {
        coreProgram: configuredLanguages.coreProgram,
        frontend: configuredLanguages.frontend,
        database: configuredLanguages.database
      });
    }
  }, [configuredLanguages]);


  useEffect(() => {
    if (configuredLanguages) {
      console.log('ProblemSolving - Programming Languages:', {
        coreProgram: configuredLanguages.coreProgram,
        frontend: configuredLanguages.frontend,
        database: configuredLanguages.database
      });
    } else {
      console.log('ProblemSolving - No configuredLanguages received');
    }
  }, [configuredLanguages]);

  // ── Utilities ──────────────────────────────────────────────────────────────
  // `getEntityType` was moved to module scope (see near the top of the file)
  // so `exercisesCacheKey` (a useMemo declared earlier in the render) can
  // call it without hitting the TDZ. Existing call sites read the module
  // export unchanged — no rename needed.

  const getBreadcrumbs = () => {
    const crumbs: { name: string; type: string }[] = [];
    if (hierarchyData?.courseName) crumbs.push({ name: hierarchyData.courseName, type: 'course' });
    if (hierarchyData?.moduleName) crumbs.push({ name: hierarchyData.moduleName, type: 'module' });
    if (hierarchyData?.submoduleName) crumbs.push({ name: hierarchyData.submoduleName, type: 'submodule' });
    if (hierarchyData?.topicName) crumbs.push({ name: hierarchyData.topicName, type: 'topic' });
    if (hierarchyData?.subtopicName) crumbs.push({ name: hierarchyData.subtopicName, type: 'subtopic' });
    if (activeTab) crumbs.push({ name: activeTab.replace('_', ' '), type: 'tab' });
    if (subcategory) crumbs.push({ name: subcategoryLabel || subcategory, type: 'subcategory' });
    return crumbs;
  };

  const getEvaluationSettings = (ex: Exercise) => ({
    practiceMode: ex.questionConfiguration?.programmingQuestionConfiguration?.allowCodeExecution ?? false,
    manualEvaluation: { enabled: false }, aiEvaluation: false,
    automationEvaluation: ex.questionConfiguration?.programmingQuestionConfiguration?.enableTestCases ?? false,
  });

  // Rejection viewer + explicit resubmit — parity with the You_Do assessment
  // list. Resubmit resets the workflow to step 1 (in_progress) and flips every
  // question approval back to pending on the server.
  const [rejectionViewer, setRejectionViewer] = useState<Exercise | null>(null);
  const [resubmittingId, setResubmittingId] = useState<string | null>(null);
  const handleResubmit = async (ex: Exercise) => {
    if (resubmittingId) return;
    const token = getToken();
    if (!token) { toast.error("You're not signed in — please log in again."); return; }
    setResubmittingId(ex._id);
    try {
      const resp = await resubmitExerciseForApproval({
        entityType: getEntityType(nodeType) as any,
        entityId: nodeId,
        tabType: activeTab as any,
        subcategory,
        exerciseId: ex._id,
      }, token);
      toast.success(resp?.message || 'Resubmitted for approval');
      await fetchExercises();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to resubmit for approval');
    } finally {
      setResubmittingId(null);
    }
  };

  const fetchExercises = async (opts: { silent?: boolean } = {}): Promise<Exercise[]> => {
    if (!subcategory?.trim()) {
      setExercises([]);
      setLoadingExercises(false);
      return [];
    }
    // Silent = fired from the cache-hit path — the previous rows are
    // already on screen, so a loader would just flicker.
    if (!opts.silent) setLoadingExercises(true);
    try {
      const resp = await exerciseApi.getExercises(getEntityType(nodeType), nodeId, activeTab, subcategory);
      const list: Exercise[] = (resp.data?.exercises ?? []).map((ex: Exercise) => ({
        ...ex,
        // Guarantee every question has a questionType so score helpers never skip them
        questions: (ex.questions ?? []).map(q => ({
          ...q,
          questionType: q.questionType ?? 'mcq', // fallback — adjust default if needed
        })),
      }));

      const sorted = [...list].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setExercises(sorted);
      // Persist into the React Query cache so a later remount at the same
      // (node, tab, subcategory) reads instantly without a loader.
      queryClient.setQueryData<Exercise[]>(exercisesCacheKey, sorted);

      // Compute pagination AFTER applying current filters (match getFilteredExercises logic)
      const q = searchQuery.toLowerCase();
      const filtered = sorted.filter(ex => {
        const matchesType = !exerciseTypeFilter || ex.exerciseType === exerciseTypeFilter;
        const matchesSearch =
          !searchQuery ||
          ex.exerciseInformation?.exerciseName?.toLowerCase().includes(q) ||
          ex.exerciseInformation?.exerciseId?.toLowerCase().includes(q);
        return matchesType && matchesSearch;
      });

      const totalItems = filtered.length;
      const totalPages = Math.ceil(totalItems / pagination.itemsPerPage) || 1;
      setPagination(prev => ({
        ...prev,
        totalItems,
        totalPages,
        currentPage: Math.min(prev.currentPage, totalPages),
      }));

      fetchSubmissionStatuses(sorted);
      return sorted;
    } catch (error) {
      console.error('Error fetching exercises:', error);
      toast.error('Failed to fetch exercises');
      setExercises([]);
      return [];
    } finally {
      if (!opts.silent) setLoadingExercises(false);
    }
  };

  const fetchSubmissionStatuses = async (exerciseList: Exercise[]) => {
    if (!exerciseList.length || !courseId || !activeTab || !subcategory) return;
    try {
      const token = getToken();
      if (!token) return;
      const ids = exerciseList.map(e => e._id).join(',');
      const params = new URLSearchParams({ courseId, tabType: activeTab, subcategory, exerciseIds: ids });
      const resp = await fetch(
        `https://lmsserver-yeve.onrender.com/analytics/exercise-submission-status?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!resp.ok) return;
      const json = await resp.json();
      if (json.success && json.data) setSubmissionStatusMap(json.data);
    } catch { /* silent — button just stays disabled */ }
  };

  const refreshExercisesAndUpdateSelected = async (): Promise<Exercise | null> => {
    if (!subcategory?.trim()) return null;
    try {
      const resp = await exerciseApi.getExercises(getEntityType(nodeType), nodeId, activeTab, subcategory);
      const list: Exercise[] = resp.data?.exercises ?? [];
      setExercises(list);
      setPagination(p => ({ ...p, totalItems: list.length, totalPages: Math.ceil(list.length / p.itemsPerPage) }));
      const targetId = selectedExerciseForAdd?._id;
      if (targetId) {
        const fresh = list.find(e => e._id === targetId);
        if (fresh) { setSelectedExerciseForAdd(fresh); return fresh; }
      }
      return null;
    } catch { return null; }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAddQuestion = async (ex: Exercise) => {
    // Fetch full exercise data (with questionConfiguration / scoring) before opening the form
    let freshEx: any = ex;
    try {
      const res = await exerciseApi.getExerciseById(ex._id);
      const fetched = res?.data?.exercise || res?.data || res?.exercise;
      if (fetched) freshEx = { ...ex, ...fetched };
    } catch { /* fall back to the list exercise */ }

    if (freshEx.exerciseType === 'Combined') {
      const { canAddMCQ, canAddProgramming } = canAddAnyQuestionInCombined(freshEx);
      if (!canAddMCQ && !canAddProgramming) { toast.warning('Cannot add more questions. All limits reached.'); return; }
      setSelectedExerciseForAdd(freshEx); setFullExerciseForAdd(freshEx); setShowAddQuestionModal(true);
    } else if (freshEx.exerciseType === 'MCQ') {
      if (hasReachedMaxMarks(freshEx)) { toast.warning(`Cannot add more questions. Total marks (${freshEx.exerciseInformation.totalMarks}) already achieved.`); return; }
      setSelectedExerciseForAdd(freshEx); setFullExerciseForAdd(freshEx); setShowAddQuestionOptions(true);
    } else {
      if (hasReachedMaxMarks(freshEx)) {
        const progCfg = freshEx.questionConfiguration?.programmingQuestionConfiguration;
        const isGeneral = progCfg?.questionConfigType === 'general';
        const typeLabel = freshEx.exerciseType === 'Other' ? 'Other' : 'Programming';
        toast.warning(isGeneral
          ? `Cannot add more questions. ${typeLabel} question limit (${progCfg?.generalQuestionCount}) reached.`
          : 'Cannot add more questions. All difficulty slots are filled.');
        return;
      }
      setSelectedExerciseForAdd(freshEx); setFullExerciseForAdd(freshEx); setShowAddQuestionModal(true);
    }
  };

  const handleQuestionBankSelect = async (selectedQuestions: Question[]) => {
    if (!selectedQuestions.length || !selectedExerciseForAdd) return;
    setIsAddingQuestions(true);
    const tid = toast.loading(`Adding ${selectedQuestions.length} question(s)...`);
    try {
      let ok = 0, fail = 0;
      for (const q of selectedQuestions) {
        try {
          const data = q.questionType === 'mcq' ? {
            questionType: 'mcq', mcqQuestionTitle: q.mcqQuestionTitle || q.questionTitle,
            mcqQuestionDescription: q.mcqQuestionDescription || q.description, mcqQuestionType: q.mcqQuestionType || 'multiple_choice',
            mcqQuestionDifficulty: q.mcqQuestionDifficulty || q.difficulty, mcqQuestionScore: q.mcqQuestionScore || q.score || 10,
            mcqQuestionOptions: q.mcqQuestionOptions, mcqQuestionCorrectAnswers: q.mcqQuestionCorrectAnswers,
            mcqQuestionOptionsPerRow: q.mcqQuestionOptionsPerRow || 1, mcqQuestionRequired: q.mcqQuestionRequired || false, isActive: true,
          } : {
            questionType: 'programming', title: q.title || q.questionTitle, description: q.description,
            difficulty: q.difficulty || 'medium', score: q.score || q.points || 10, testCases: q.testCases || [],
            solutions: q.solutions, isActive: true,
          };
          await exerciseApi.addQuestion(getEntityType(nodeType), nodeId, selectedExerciseForAdd._id, data, activeTab, subcategory);
          ok++;
        } catch { fail++; }
      }
      toast.dismiss(tid);
      if (ok) toast.success(`${ok} question(s) added!`);
      if (fail) toast.warning(`${fail} question(s) failed.`);
      if (ok) await fetchExercises();
    } catch { toast.dismiss(tid); toast.error('Failed to add questions from bank'); }
    finally { setIsAddingQuestions(false); setShowQuestionBank(false); setSelectedExerciseForAdd(null); }
  };

  const handleNewExercise = () => {
    if (!subcategory) { toast.error('Please select a subcategory first'); return; }
    setEditingExercise(null); setIsEditing(false); setShowSettingsModal(true);
  };

  const handleEditExercise = (ex: Exercise) => { setEditingExercise(ex); setIsEditing(true); setShowSettingsModal(true); };
  const handleDeleteConfirm = async () => {
    if (!exerciseToDelete) return;
    setDeleting(true);
    try {
      await exerciseApi.deleteExercise(
        getEntityType(nodeType),
        nodeId,
        exerciseToDelete._id,
        activeTab,
        subcategory
      );

      // Update exercises list
      const updatedExercises = exercises.filter(e => e._id !== exerciseToDelete._id);
      setExercises(updatedExercises);

      // Get filtered exercises based on search query
      const filteredExercises = updatedExercises.filter(ex => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return ex.exerciseInformation?.exerciseName?.toLowerCase().includes(q) ||
          ex.exerciseInformation?.exerciseId?.toLowerCase().includes(q);
      });

      // Calculate new pagination values
      const newTotalItems = filteredExercises.length;
      const newTotalPages = Math.ceil(newTotalItems / pagination.itemsPerPage);

      // If current page is greater than new total pages, move to the last available page
      let newCurrentPage = pagination.currentPage;
      if (newCurrentPage > newTotalPages) {
        newCurrentPage = Math.max(1, newTotalPages);
      }

      // Update pagination state
      setPagination(prev => ({
        ...prev,
        totalItems: newTotalItems,
        totalPages: newTotalPages,
        currentPage: newCurrentPage
      }));

      setShowDeleteModal(false);
      setExerciseToDelete(null);
      toast.success('Exercise deleted successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete exercise.');
    } finally {
      setDeleting(false);
    }
  };
  const handleAnalytics = (ex: Exercise) => {
    localStorage.setItem('lms_returning_from_analytics', 'true');
    localStorage.setItem('lms_sidebar_collapsed', 'true');
    localStorage.setItem('lms_selected_tab', activeTab || 'We_Do');
    localStorage.setItem('lms_selected_subcategory', subcategory);
    localStorage.setItem('lms_selected_node_id', nodeId);
    localStorage.setItem('lms_selected_node_name', nodeName);
    const q = new URLSearchParams({
      exerciseId: ex._id, nodeId, nodeType,
      sourceTab: activeTab || 'We_Do', sourceSubcategory: subcategory, courseId,
      moduleName: hierarchyData.moduleName || '',
      // Review, and the way back out of it, stay in the section the trainer is
      // working in — this screen is mounted under both Courses and Course
      // Structure.
      returnUrl: sectionHref('uploadcourseresources'),
    }).toString();
    router.push(`${sectionHref('reviewSubmission')}?${q}`);
  };

  const handleSaveSettings = async () => {
    const prevExerciseId = selectedExerciseForAdd?._id;
    const wasEditing = isEditing;
    const editedExerciseId = editingExercise?._id;

    setShowSettingsModal(false);
    setEditingExercise(null);
    setIsEditing(false);
    setLockConfigStrategy(false);
    setIsLoading(true);

    try {
      const freshExercises = await fetchExercises(); // single, awaited fetch

      if (prevExerciseId) {
        const refreshed = freshExercises.find(e => e._id === prevExerciseId);
        if (refreshed) {
          setSelectedExerciseForAdd(refreshed);
          // Also update fullExerciseForAdd so its questionConfiguration doesn't stale-override
          setFullExerciseForAdd(refreshed);
        }
      }
      if (wasEditing && editedExerciseId) {
        const refreshed = freshExercises.find(e => e._id === editedExerciseId);
        if (refreshed) {
          if (selectedExercise?._id === editedExerciseId) setSelectedExercise(refreshed);
          if (selectedExerciseForAdd?._id === editedExerciseId) {
            setSelectedExerciseForAdd(refreshed);
            setFullExerciseForAdd(refreshed);
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing after save:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionSaved = async (savedData?: any) => {
    const isSaveAndNext = savedData?.__saveAndNext === true;
    const isUpdate = savedData?.__isUpdate === true;
    if (isSaveAndNext) {
      const freshExercise = await refreshExercisesAndUpdateSelected();
      if (freshExercise) setSelectedExerciseForAdd(freshExercise);
      toast.success(isUpdate ? 'Question updated — continue!' : 'Question saved — continue!', { autoClose: 1500 });
    } else {
      toast.success(isUpdate ? 'Question updated successfully' : 'Question saved successfully');
      setShowAddQuestionModal(false); setSelectedExerciseForAdd(null);
      await fetchExercises();
    }
  };

  const handleAction = (type: string, ex: Exercise) => {
    switch (type) {
      case 'edit': handleEditExercise(ex); break;
      case 'manageQuestions': setSelectedExercise(ex); setShowQuestions(true); break;
      case 'addQuestion': handleAddQuestion(ex); break;
      case 'delete': setExerciseToDelete(ex); setShowDeleteModal(true); break;
      case 'review': handleAnalytics(ex); break;
      default: toast.info('Feature coming soon');
    }
  };

  const getExerciseStatus = (ex: Exercise): string => {
    if (!isExerciseComplete(ex)) return 'Incomplete';
    const questions = ex.questions ?? [];
    const qc = ex.questionConfiguration;
    const mcqCfg: any = (qc as any)?.mcqQuestionConfiguration ?? null;
    const progCfg: any = (qc as any)?.programmingQuestionConfiguration ?? null;
    const mcqQuestions = questions.filter(q => q.questionType === 'mcq');
    const progQuestions = questions.filter(q =>
      q.questionType === 'programming' || q.questionType === 'database' || q.questionType === 'others'
    );
    let maxQ = 0, curQ = 0;
    if (ex.exerciseType === 'MCQ') {
      maxQ = mcqCfg?.totalMcqQuestions ?? 0;
      curQ = mcqQuestions.length;
    } else if (ex.exerciseType === 'Programming') {
      const ct = progCfg?.questionConfigType;
      const counts = progCfg?.levelBasedCounts ?? progCfg?.selectionLevelCounts ?? {};
      maxQ = ct === 'general' ? (progCfg?.generalQuestionCount ?? 0)
        : (((counts as any).easy ?? 0) + ((counts as any).medium ?? 0) + ((counts as any).hard ?? 0));
      curQ = progQuestions.length;
    } else if (ex.exerciseType === 'Combined') {
      const ct = progCfg?.questionConfigType;
      const counts = progCfg?.levelBasedCounts ?? progCfg?.selectionLevelCounts ?? {};
      const progMax = ct === 'general' ? (progCfg?.generalQuestionCount ?? 0)
        : (((counts as any).easy ?? 0) + ((counts as any).medium ?? 0) + ((counts as any).hard ?? 0));
      maxQ = (mcqCfg?.totalMcqQuestions ?? 0) + progMax;
      curQ = mcqQuestions.length + progQuestions.length;
    }
    if (maxQ > 0 && curQ < maxQ) return 'Incomplete';
    return 'Completed';
  };

  const getFilteredExercises = () => {
    let f = exercises;
    if (exerciseTypeFilter) {
      f = f.filter(ex => ex.exerciseType === exerciseTypeFilter);
    }
    if (statusFilter) {
      f = f.filter(ex => getExerciseStatus(ex) === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      f = f.filter(ex =>
        ex.exerciseInformation?.exerciseName?.toLowerCase().includes(q) ||
        ex.exerciseInformation?.exerciseId?.toLowerCase().includes(q)
      );
    }
    return f;
  };
  const getPaginatedExercises = () => {
    const f = getFilteredExercises();
    const s = (pagination.currentPage - 1) * pagination.itemsPerPage;
    return f.slice(s, s + pagination.itemsPerPage);
  };

  // ── UI sub-components ──────────────────────────────────────────────────────

  const renderLevelBadge = (level = 'intermediate') => {
    const label = level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
    return (
      <span style={{
        fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
        textTransform: 'uppercase' as const, letterSpacing: '0.05em',
        background: 'transparent', color: '#64748b',
        border: '1px solid #eef0f4', whiteSpace: 'nowrap' as const,
        fontFamily: JKT.fontFamily,
      }}>
        {label}
      </span>
    );
  };


  // ── Status bars ────────────────────────────────────────────────────
  // AFTER (entire component replacement)
 const ScoreProgress = ({ exercise }: { exercise: Exercise }) => {
  // Check if exercise settings are complete
  const exerciseSettingsComplete = isExerciseComplete(exercise);

  const questions = exercise.questions ?? [];
  const qc = exercise.questionConfiguration;
  const mcqCfg: any = (qc as any)?.mcqQuestionConfiguration ?? null;
  const progCfg: any = (qc as any)?.programmingQuestionConfiguration ?? null;
  const mcqQuestions = questions.filter(q => q.questionType === 'mcq');
  const progQuestions = questions.filter(q =>
    q.questionType === 'programming' || q.questionType === 'database' || q.questionType === 'others'
  );

  let questionsComplete = true;
  let curQ = 0, maxQ = 0;

  if (exercise.exerciseType === 'MCQ') {
    maxQ = mcqCfg?.totalMcqQuestions ?? 0;
    curQ = mcqQuestions.length;
    if (maxQ > 0 && curQ < maxQ) questionsComplete = false;
  } else if (exercise.exerciseType === 'Programming') {
    const ct = progCfg?.questionConfigType;
    const counts = progCfg?.levelBasedCounts ?? progCfg?.selectionLevelCounts ?? {};
    maxQ = ct === 'general'
      ? (progCfg?.generalQuestionCount ?? 0)
      : (((counts as any).easy ?? 0) + ((counts as any).medium ?? 0) + ((counts as any).hard ?? 0));
    curQ = progQuestions.length;
    if (maxQ > 0 && curQ < maxQ) questionsComplete = false;
  } else if (exercise.exerciseType === 'Combined') {
    const ct = progCfg?.questionConfigType;
    const counts = progCfg?.levelBasedCounts ?? progCfg?.selectionLevelCounts ?? {};
    const progMax = ct === 'general'
      ? (progCfg?.generalQuestionCount ?? 0)
      : (((counts as any).easy ?? 0) + ((counts as any).medium ?? 0) + ((counts as any).hard ?? 0));
    maxQ = (mcqCfg?.totalMcqQuestions ?? 0) + progMax;
    curQ = mcqQuestions.length + progQuestions.length;
    if (maxQ > 0 && curQ < maxQ) questionsComplete = false;
  }

  // Determine final status
  const isComplete = exerciseSettingsComplete && questionsComplete;

  // Color configurations
  const completeStyle = {
    bg: 'rgba(34, 197, 94, 0.08)',
    text: '#16a34a',
    border: 'rgba(34, 197, 94, 0.2)',
    dot: '#22c55e',
    label: 'Complete',
    icon: CheckCircle,
  };

  const incompleteStyle = {
    bg: 'rgba(242, 119, 87, 0.08)',
    text: '#e0623f',
    border: 'rgba(242, 119, 87, 0.2)',
    dot: '#F27757',
    label: 'Incomplete',
    icon: AlertTriangle,
  };

  const style = isComplete ? completeStyle : incompleteStyle;
  const StatusIcon = style.icon;

  // Build tooltip message
  let tooltipMessage = '';
  if (!exerciseSettingsComplete) {
    tooltipMessage = 'Exercise settings are incomplete';
  } else if (!questionsComplete) {
    tooltipMessage = `${curQ} of ${maxQ} questions added`;
  } else {
    tooltipMessage = 'Exercise is fully configured';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 600,
              fontFamily: JKT.fontFamily,
              background: style.bg,
              color: style.text,
              border: `1px solid ${style.border}`,
              cursor: 'default',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            <StatusIcon size={12} strokeWidth={2.5} style={{ color: style.dot, flexShrink: 0 }} />
            <span>{style.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="text-xs bg-white text-gray-900 border border-gray-200 shadow-lg"
          style={{ fontFamily: JKT.fontFamily }}
        >
          <div className="p-1.5">
            <p className="text-[11px] font-semibold mb-1.5" style={{ color: '#1a1a2e' }}>
              {tooltipMessage}
            </p>
            {!exerciseSettingsComplete ? (
              <p className="text-[10px]" style={{ color: '#8b8b9e' }}>
                Complete all settings first
              </p>
            ) : !questionsComplete && maxQ > 0 ? (
              <div>
                <div className="h-1.5 rounded-full overflow-hidden w-36" style={{ background: '#f0f0f5' }}>
                  <div className="h-full rounded-full" style={{
                    width: `${Math.min(100, (curQ / maxQ) * 100)}%`,
                    background: isComplete ? '#22c55e' : '#F27757',
                  }} />
                </div>
                <p className="text-[10px] mt-1" style={{ color: '#8b8b9e' }}>
                  {Math.round((curQ / maxQ) * 100)}% complete
                </p>
              </div>
            ) : (
              <p className="text-[10px]" style={{ color: '#16a34a' }}>
                All requirements met ✓
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
  // ── Type badge ─────────────────────────────────────────────────────────────
  // AFTER
  const ExerciseTypeBadge = ({ type }: { type: string }) => (
    <span style={{
      fontSize: 12, fontWeight: 500, color: '#64748b',
      fontFamily: JKT.fontFamily,
    }}>
      {type}
    </span>
  );

  // ── Programming Tooltip Content ─────────────────────────────────────────────
  const ProgrammingTooltipDetail = ({ exercise, status }: { exercise: Exercise; status: ProgrammingStatusFull }) => {
    const diffColors: Record<string, { dot: string; text: string; bar: string; badge: string }> = {
      easy: { dot: '#22c55e', text: '#16a34a', bar: '#4ade80', badge: '#f0fdf4' },
      medium: { dot: '#f59e0b', text: '#d97706', bar: '#fbbf24', badge: '#fffbeb' },
      hard: { dot: '#f43f5e', text: '#e11d48', bar: '#fb7185', badge: '#fff1f2' },
    };

    if (status.configType === 'general') {
      const cur = status.generalCurrent ?? 0, max = status.generalMax;
      const curMarks = status.generalCurrentMarks ?? 0, maxMarks = status.generalMaxMarks;
      const remaining = status.generalRemainingCount, remainingMarks = status.generalRemainingMarks;
      const marksPerQ = status.marksPerQuestion;
      const pct = max ? Math.min(100, (cur / max) * 100) : 0;
      const isFull = max !== undefined && cur >= max;
      return (
        <div className="space-y-2" style={JKT}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: status.available ? '#22c55e' : '#bcbccc' }} />
              <span className="font-semibold text-[12px]" style={{ color: '#1a1a2e' }}>Programming</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>General</span>
            </div>
            {isFull && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>Full</span>}
          </div>
          {max !== undefined && (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px]">
                <span style={{ color: '#8b8b9e' }}>Questions</span>
                <span className="font-bold tabular-nums" style={{ color: isFull ? '#e11d48' : '#1a1a2e' }}>{cur}/{max}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f0f0f5' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isFull ? '#ef4444' : 'linear-gradient(90deg,#F27757,#e0623f)' }} />
              </div>
              {remaining !== undefined && remaining > 0 && <p className="text-[10px] font-medium" style={{ color: '#16a34a' }}>✓ {remaining} question{remaining !== 1 ? 's' : ''} remaining</p>}
            </div>
          )}
          {maxMarks !== undefined && maxMarks > 0 && (
            <div className="flex items-center justify-between text-[11px] pt-1" style={{ borderTop: '1px solid #f0f0f5' }}>
              <span style={{ color: '#8b8b9e' }}>Marks used</span>
              <span className="font-semibold" style={{ color: '#1a1a2e' }}>{curMarks}/{maxMarks}</span>
            </div>
          )}
          {remainingMarks !== undefined && remainingMarks > 0 && <p className="text-[10px]" style={{ color: '#8b8b9e' }}>{remainingMarks} marks remaining</p>}
          {marksPerQ !== undefined && marksPerQ > 0 && <p className="text-[10px]" style={{ color: '#fb923c' }}>{marksPerQ} marks per question</p>}
        </div>
      );
    }

    const levelEntries = Object.entries(status.levels);
    if (levelEntries.length === 0) {
      return (
        <div className="flex items-center gap-1.5" style={JKT}>
          <div className="w-2 h-2 rounded-full" style={{ background: status.available ? '#22c55e' : '#bcbccc' }} />
          <span className="font-semibold text-[12px]" style={{ color: '#1a1a2e' }}>Programming</span>
          {!status.available && <span className="text-[10px]" style={{ color: '#e11d48' }}>{status.reason}</span>}
        </div>
      );
    }

    const modeLabel = status.configType === 'levelBased' ? 'Level Based' : 'Selection Level';
    return (
      <div className="space-y-2" style={JKT}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: status.available ? '#22c55e' : '#bcbccc' }} />
            <span className="font-semibold text-[12px]" style={{ color: '#1a1a2e' }}>Programming</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(242,119,87,0.08)', color: '#e0623f', border: '1px solid rgba(242,119,87,0.2)' }}>{modeLabel}</span>
          </div>
          {!status.available && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>Full</span>}
        </div>
        <div className="space-y-1.5">
          {levelEntries.map(([diff, detail]) => {
            const c = diffColors[diff] ?? diffColors.medium;
            const pct = detail.max > 0 ? Math.min(100, (detail.current / detail.max) * 100) : 0;
            const isFull = !detail.available;
            return (
              <div key={diff} className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                    <span className="text-[11px] font-medium capitalize" style={{ color: isFull ? '#8b8b9e' : c.text }}>{diff}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: isFull ? '#ef4444' : '#1a1a2e' }}>{detail.current}/{detail.max}</span>
                    {detail.remainingMarks !== undefined && detail.max > 0 && <span className="text-[10px]" style={{ color: '#bcbccc' }}>({detail.currentMarks}/{detail.maxMarks} marks)</span>}
                    {isFull && <span className="text-[9px] px-1 py-0.5 rounded font-semibold" style={{ background: c.badge, color: c.text, border: `1px solid ${c.bar}30` }}>Full</span>}
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f0f0f5' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isFull ? '#d1d5db' : c.bar }} />
                </div>
                {!isFull && detail.remainingCount > 0 && (
                  <p className="text-[10px]" style={{ color: c.text }}>
                    {detail.remainingCount} slot{detail.remainingCount !== 1 ? 's' : ''} left
                    {detail.remainingMarks !== undefined && ` · ${detail.remainingMarks} marks left`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Action Menu ─────────────────────────────────────────────────────────────
  // Inside ProblemSolving component, update the ActionMenu to add Mock Preview:

  const ActionMenu = ({ exercise }: { exercise: Exercise }) => {
    const exerciseComplete = isExerciseComplete(exercise);
    const [showMockPreview, setShowMockPreview] = useState(false);
    const approval = getApprovalInfo(exercise);

    const isCombinedEx = exercise.exerciseType === 'Combined';
    const progCfg = exercise.questionConfiguration?.programmingQuestionConfiguration;
    const isGeneralMode = progCfg?.questionConfigType === 'general';
    const progStatus = buildProgrammingStatus(exercise);
    let isAddDisabled = false, addDisabledReason = '';
    let mcqStatus = { available: false, reason: '' };

    if (isCombinedEx) {
      const mc = canAddMCQInCombined(exercise);
      mcqStatus = { available: mc.canAdd, reason: mc.reason ?? '' };
      isAddDisabled = !mcqStatus.available && !progStatus.available;
      if (isAddDisabled) addDisabledReason = 'All question type limits reached';
    } else {
      isAddDisabled = hasReachedMaxMarks(exercise);
      if (isAddDisabled) addDisabledReason = isGeneralMode ? `Programming question limit (${progCfg?.generalQuestionCount}) reached` : 'All question slots are filled';
    }

    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ps-action-btn">
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72" style={{ ...JKT, border: '1px solid #e4e4ed', boxShadow: '0 8px 32px rgba(26,26,46,0.14)' }}>

            {/* NEW: Mock Preview - Only show when exercise is complete */}
            {exerciseComplete && exercise.questions && exercise.questions.length > 0 && (
              <>
                <DropdownMenuItem
                  onClick={() => setShowMockPreview(true)}
                  className="cursor-pointer text-xs gap-2"
                  style={{ color: '#1a1a2e', fontFamily: JKT.fontFamily }}>
                  <Eye className="h-3.5 w-3.5" style={{ color: '#a855f7' }} />
                  Mock Preview
                  <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>
                    {exercise.questions.length} Qs
                  </span>
                </DropdownMenuItem>
                <Separator className="my-1" style={{ height: '1px', background: '#e4e4ed', display: 'block' }} />
              </>
            )}

            {/* Review Submissions - Only show when exercise is complete */}
            {exerciseComplete && (
              <>
                <DropdownMenuItem
                  onClick={() => handleAction('review', exercise)}
                  className="cursor-pointer text-xs gap-2"
                  disabled={!submissionStatusMap[exercise._id]}
                  style={{ color: '#1a1a2e', fontFamily: JKT.fontFamily }}>
                  <BarChart3 className="h-3.5 w-3.5" style={{ color: submissionStatusMap[exercise._id] ? '#fb923c' : '#bcbccc' }} />
                  Review Submissions
                </DropdownMenuItem>
                <Separator className="my-1" style={{ height: '1px', background: '#e4e4ed', display: 'block' }} />
              </>
            )}

            {/* Manage Exercise - Only show when exercise is complete */}
            {exerciseComplete && (
              <>
                <DropdownMenuItem
                  onClick={() => handleAction('manageQuestions', exercise)}
                  className="cursor-pointer text-xs gap-2"
                  style={{ color: '#1a1a2e', fontFamily: JKT.fontFamily }}>
                  <FileCode className="h-3.5 w-3.5" style={{ color: '#F27757' }} />
                  Manage Exercise
                  <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(242,119,87,0.1)', color: '#e0623f', border: '1px solid rgba(242,119,87,0.2)' }}>
                    {exercise.questions?.length ?? 0}
                  </span>
                </DropdownMenuItem>
                <Separator className="my-1" style={{ height: '1px', background: '#e4e4ed', display: 'block' }} />
              </>
            )}

            {/* Continue Incomplete Exercise OR Edit Exercise based on completion status */}
            {exerciseComplete ? (
              <DropdownMenuItem
                onClick={() => handleAction('edit', exercise)}
                className="cursor-pointer text-xs gap-2"
                style={{ color: '#1a1a2e', fontFamily: JKT.fontFamily }}>
                <Edit3 className="h-3.5 w-3.5" style={{ color: '#fb923c' }} />
                Edit Exercise
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => handleAction('edit', exercise)}
                className="cursor-pointer text-xs gap-2"
                style={{ color: '#F27757', fontFamily: JKT.fontFamily }}>
                <Edit3 className="h-3.5 w-3.5" style={{ color: '#F27757' }} />
                Edit Exercise
              </DropdownMenuItem>
            )}

            {approval.status === 'rejected' && (
              <DropdownMenuItem
                onClick={() => setRejectionViewer(exercise)}
                className="cursor-pointer text-xs gap-2"
                style={{ color: '#dc2626', fontFamily: JKT.fontFamily }}>
                <AlertTriangle className="h-3.5 w-3.5" style={{ color: '#dc2626' }} />
                See rejection
              </DropdownMenuItem>
            )}
            {(approval.status === 'rejected' || approval.hasRejectedQuestions) && (
              <DropdownMenuItem
                onClick={() => handleResubmit(exercise)}
                disabled={!!resubmittingId}
                className="cursor-pointer text-xs gap-2"
                style={{ color: '#4f46e5', fontFamily: JKT.fontFamily }}>
                <RefreshCw className={`h-3.5 w-3.5 ${resubmittingId === exercise._id ? 'animate-spin' : ''}`} style={{ color: '#4f46e5' }} />
                {resubmittingId === exercise._id ? 'Requesting…' : 'Request Approval'}
              </DropdownMenuItem>
            )}

            <Separator className="my-1" style={{ height: '1px', background: '#e4e4ed', display: 'block' }} />

            <DropdownMenuItem onClick={() => handleAction('delete', exercise)} className="cursor-pointer text-xs gap-2 text-red-600 focus:text-red-600" style={{ fontFamily: JKT.fontFamily }}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mock Preview Modal */}
        {showMockPreview && (
          <ExerciseMockPreviewModal
            exercise={exercise}
            configuredLanguages={configuredLanguages}
            onClose={() => setShowMockPreview(false)}
          />
        )}



      </>
    );
  };

  // ── AddQuestionOptions modal (MCQ only) ─────────────────────────────────────
  /**
   * Drop-in replacement for the AddQuestionOptions component inside ProblemSolving.tsx.
   *
   * Changes vs original:
   *   • Adds a third option: "Add Questions via Document"
   *   • Uses the onOpenDocumentUpload callback to trigger the new modal
   *   • Import additions needed in ProblemSolving.tsx:
   *       import { FileText, Database } from 'lucide-react';  // add to existing import
   *       import AddQuestionViaDocument from './AddQuestionViaDocument';
   */

  // ── AddQuestionOptions ─────────────────────────────────────────────────────────
  // Replace the existing component definition in ProblemSolving.tsx with this one.

  const AddQuestionOptions = ({ exercise, onClose: closeOpts }: { exercise: Exercise; onClose: () => void }) => {

    const crumbs = getBreadcrumbs();

    const options = [
      {
        label: "Create New Question",
        sub: "Build an MCQ question from scratch",
        accent: "#F27757",
        bg: "rgba(242,119,87,0.1)",
        Icon: Plus,
        onClick: () => {
          setSelectedExerciseForAdd(exercise);
          setShowAddQuestionModal(true);
          closeOpts();
        },
      },
      {
        label: "Choose from Question Bank",
        sub: "Select existing MCQ questions",
        accent: "#a855f7",
        bg: "rgba(168,85,247,0.08)",
        Icon: Database,
        onClick: () => {
          setSelectedExerciseForAdd(exercise);
          setQbankFromMCQOpts(true);
          setShowQuestionBank(true);
          closeOpts();
        },
      },
      {
        label: "Add Questions via Document",
        sub: "Bulk import from JSON · CSV · TXT",
        accent: "#0891b2",
        bg: "rgba(8,145,178,0.08)",
        Icon: FileText,
        onClick: () => {
          setSelectedExerciseForAdd(exercise);
          setShowDocumentUpload(true);   // ← this instead
          closeOpts();
        },
      },
    ];

    return (
      <>
        <div
          className="fixed inset-0"
          style={{ zIndex: 100, background: "rgba(26,26,46,0.45)", backdropFilter: "blur(4px)" }}
        />
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 101, pointerEvents: "none" }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
            style={{
              ...JKT,
              border: "1px solid #e4e4ed",
              pointerEvents: "auto",
              boxShadow: "0 20px 60px rgba(26,26,46,0.18), 0 4px 16px rgba(242,119,87,0.08)",
            }}
          >
            {/* Header */}
            <div className="p-5 pb-4" style={{ borderBottom: "1px solid #e4e4ed" }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  {crumbs.length > 0 && (
                    <div className="flex items-center flex-wrap gap-0.5 mb-2">
                      {crumbs.map((c, i) => (
                        <span key={i} className="flex items-center gap-0.5">
                          {i > 0 && (
                            <span style={{ color: "#F27757" }} className="mx-1 text-sm">
                              ›
                            </span>
                          )}
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: c.type === "subcategory" ? "#F27757" : "#6b6b7e" }}
                          >
                            {c.name}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-0.5">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(242,119,87,0.1)" }}
                    >
                      <Plus size={13} style={{ color: "#F27757" }} />
                    </div>
                    <h2 className="text-[15px] font-bold" style={{ color: "#1a1a2e" }}>
                      Add Question
                    </h2>
                  </div>
                  <p className="text-[11px]" style={{ color: "#8b8b9e" }}>
                    Choose how to add MCQ questions
                  </p>
                </div>
                <button
                  onClick={closeOpts}
                  style={{
                    cursor: "pointer",
                    color: "#bcbccc",
                    padding: "4px",
                    borderRadius: "8px",
                    lineHeight: 0,
                    border: "none",
                    background: "transparent",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#6b6b7e";
                    e.currentTarget.style.background = "#f5f5f8";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#bcbccc";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Option buttons */}
            <div className="p-4 space-y-2.5">
              {options.map(({ label, sub, accent, bg, Icon, onClick }) => (
                <button
                  key={label}
                  onClick={onClick}
                  className="group w-full text-left rounded-xl p-4 transition-all"
                  style={{ border: "1.5px solid #e4e4ed", cursor: "pointer", background: "#fff" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accent;
                    e.currentTarget.style.background = `${accent}08`;
                    e.currentTarget.style.boxShadow = `0 2px 12px ${accent}20`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#e4e4ed";
                    e.currentTarget.style.background = "#fff";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: bg }}
                    >
                      <Icon size={18} style={{ color: accent }} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-semibold" style={{ color: "#1a1a2e" }}>
                        {label}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: "#8b8b9e" }}>
                        {sub}
                      </div>
                    </div>
                    <ChevronRight
                      size={15}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                      style={{ color: accent }}
                    />
                  </div>
                </button>
              ))}
            </div>

            {/* Cancel */}
            <div className="px-4 pb-4">
              <button
                onClick={closeOpts}
                className="w-full py-2.5 rounded-xl text-[12px] font-medium transition-all"
                style={{
                  ...JKT,
                  border: "1px solid #e4e4ed",
                  color: "#6b6b7e",
                  background: "#fafafa",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fafafa")}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };
  // ── Scrollbar style injection ──────────────────────────────────────────────
  const ScrollbarStyles = () => (
    <style>{`
      .ps-table-scroll {
        scrollbar-width: thin;
        scrollbar-color: #ece9f1 transparent;
      }
      .ps-table-scroll::-webkit-scrollbar { width: 5px; height: 5px; }
      .ps-table-scroll::-webkit-scrollbar-track { background: transparent; }
      .ps-table-scroll::-webkit-scrollbar-thumb { background: #ece9f1; border-radius: 99px; }
      .ps-table-scroll::-webkit-scrollbar-thumb:hover { background: #F27757; }
      .ps-action-btn { color: #bcbccc; background: transparent; border: none; cursor: pointer; border-radius: 8px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background 0.15s; }
      .ps-action-btn:hover { color: #F27757 !important; background: rgba(242,119,87,0.1) !important; }
    `}</style>
  );

  // ── Questions view ─────────────────────────────────────────────────────────
  if (showQuestions && selectedExercise) {
    return (
      <Questions
        exercise={selectedExercise} nodeId={nodeId} nodeName={nodeName}
        subcategory={subcategory} nodeType={nodeType} tabType={activeTab}
        hierarchyData={hierarchyData} breadcrumbs={getBreadcrumbs()}
        onBack={() => { setShowQuestions(false); setSelectedExercise(null); fetchExercises(); }}
        onEditExercise={(exercise) => {
          setShowQuestions(false); setEditingExercise(exercise);
          setIsEditing(true); setShowSettingsModal(true); setSelectedExercise(null);
        }}
      />
    );
  }

  const filtered = getFilteredExercises();
  const paginated = getPaginatedExercises();

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col"
      style={{ ...JKT, background: '#ffffff', color: '#1a1a2e', height: '100%', minHeight: 0 }}>
      <ScrollbarStyles />

      {/* ══ Toolbar ══════════════════════════════════════════════════════
          Repainted onto the Client Management pattern: no wrapping card /
          border-bottom (that produced the stray horizontal line above the
          list), h-8 pill controls on the design system tokens (`h-8
          rounded-control border-hairline-strong bg-surface text-xs`), and
          the primary action is separated from the secondary tools by a
          slim vertical divider — same rhythm CM, UM and Service Mapping
          share. Padding matches the table area below so nothing steps out
          of the workspace gutter. */}
      <div className="px-3 sm:px-4 md:px-6 pt-3 pb-2 flex items-center gap-2 flex-wrap min-w-0 flex-shrink-0">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
          <input
            placeholder={`Search ${subLabelPlural}`}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPagination(p => ({ ...p, currentPage: 1 })); }}
            className="h-8 w-full pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Type filter select — CM's secondary control shape */}
        <select
          value={exerciseTypeFilter ?? ''}
          onChange={e => setExerciseTypeFilter(e.target.value || null)}
          className={`h-8 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150 ${exerciseTypeFilter ? 'border-brand bg-brand-wash text-brand-strong' : ''}`}
          style={{ minWidth: 120 }}
        >
          <option value="">All Types</option>
          <option value="MCQ">MCQ</option>
          <option value="Programming">Programming</option>
          <option value="Combined">Combined</option>
        </select>

        {/* Status filter select */}
        <select
          value={statusFilter ?? ''}
          onChange={e => setStatusFilter(e.target.value || null)}
          className={`h-8 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150 ${statusFilter ? 'border-brand bg-brand-wash text-brand-strong' : ''}`}
          style={{ minWidth: 110 }}
        >
          <option value="">All Status</option>
          <option value="Completed">Completed</option>
          <option value="Incomplete">Incomplete</option>
        </select>

        {/* Secondary-action cluster pushed right — icon-and-label pills on
            the same h-8 shape as the toolbar controls. */}
        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {isHeaderHidden && onShowHeader && (
            <button
              type="button"
              onClick={onShowHeader}
              title="Show header"
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Show header</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchExercises()}
            disabled={loadingExercises || !subcategory}
            title="Refresh"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingExercises ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Divider before the primary action — matches the Add-button
            treatment on the other admin lists. */}
        <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5" aria-hidden />

        {/* New {Subcategory} — primary action */}
        <button
          type="button"
          onClick={handleNewExercise}
          disabled={isLoading || !subcategory}
          title={`Create new ${subLabelSingular.toLowerCase()}`}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} strokeWidth={2.4} />}
          <span className="text-xs font-semibold hidden sm:inline">New {subLabelSingular}</span>
        </button>
      </div>

      {/* Active search filter chip — sits BELOW the toolbar, in the same
          horizontal gutter, so it doesn't crowd the search box row. */}
      {searchQuery && (
        <div className="flex-none flex items-center gap-2 px-3 sm:px-4 md:px-6 pb-2 flex-wrap min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-strong">Filtering:</span>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-brand-500/30 bg-brand-wash text-2xs font-medium text-brand-strong hover:bg-brand-100 transition-colors duration-150"
          >
            "{searchQuery}" <X size={11} />
          </button>
          <span className="text-2xs ml-auto text-subtle tabular-nums">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ══ Table area ════════════════════════════════════════════════════
          Wrapped with a horizontal gutter (`px-3 sm:px-4 md:px-6`) so the
          list has small left/right breathing space instead of running edge
          to edge, and `overflow-x-hidden` guards against any accidental
          horizontal scroll on narrow viewports. Header and body live in
          separate scroll contexts so the header stays pinned. */}
      <div style={{ position: 'relative', flex: '1 1 0', minHeight: '200px', display: 'flex', flexDirection: 'column' }}
           className="px-3 sm:px-4 md:px-6 overflow-x-hidden">
        {loadingExercises ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="relative">
              <div className="w-10 h-10 border-4 rounded-full" style={{ borderColor: '#f5f5f8' }} />
              <div className="absolute inset-0 border-4 rounded-full animate-spin" style={{ borderColor: '#F27757', borderTopColor: 'transparent' }} />
            </div>
            <p className="text-[12px] font-medium" style={{ color: '#8b8b9e', ...JKT }}>
              {activeTab === 'We_Do' ? 'Loading Assignment…'
                : activeTab === 'You_Do' ? 'Loading Assessment…'
                : `Loading ${subLabelSingular}…`}
            </p>
          </div>
        ) : paginated.length > 0 ? (
          <>
            {/* ── Header row — DataTable metrics: h-8, text-[10px] uppercase
                tracking-wider, subtle text, bg-canvas, hairline bottom
                border. Kept in a separate <table> so `sticky top: 0` on the
                body's own thead isn't needed — the body scrolls inside its
                own div and the header stays pinned above it. */}
            <div className="flex-shrink-0 bg-canvas border-b border-hairline">
              <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <thead>
                  <tr>
                    {[
                      { label: '#', align: 'left' as const, className: 'pl-4 pr-2' },
                      { label: 'Assignment ID', align: 'left' as const, className: 'px-3' },
                      { label: 'Assignment Name', align: 'left' as const, className: 'px-3' },
                      { label: 'Type', align: 'left' as const, className: 'px-3' },
                      { label: 'Created', align: 'left' as const, className: 'px-3' },
                      { label: 'Status', align: 'left' as const, className: 'px-3' },
                      { label: 'Actions', align: 'right' as const, className: 'pl-2 pr-4' },
                    ].map(h => (
                      <th key={h.label}
                        className={`${h.className} h-8 text-[10px] font-semibold uppercase tracking-wider text-subtle align-middle whitespace-nowrap`}
                        style={{ textAlign: h.align }}>
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>

            {/* ── Scrollable tbody — DataTable metrics: h-11, text-[12px],
                text-body, hairline dividers, hover:bg-row-hover. */}
            <div ref={tableBodyRef} className="ps-table-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '4%' }} />
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '30%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '21%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
                <tbody>
                  {paginated.map((ex, idx) => {
                    const rowNum = (pagination.currentPage - 1) * pagination.itemsPerPage + idx + 1;
                    return (
                      <tr key={ex._id}
                          className="border-b border-hairline bg-surface hover:bg-row-hover transition-colors duration-150">

                        {/* # */}
                        <td className="h-11 pl-4 pr-2 align-middle text-[12px] text-faint tabular-nums">
                          {rowNum}
                        </td>

                        {/* Assignment ID */}
                        <td className="h-11 px-3 align-middle text-[12px] text-subtle">
                          <span style={{ fontFamily: 'ui-monospace, monospace' }} className="truncate block" title={ex.exerciseInformation.exerciseId}>
                            {ex.exerciseInformation.exerciseId}
                          </span>
                        </td>

                        {/* Assignment Name */}
                        <td className="h-11 px-3 align-middle text-[12px] text-body">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate" title={ex.exerciseInformation.exerciseName}>
                              {ex.exerciseInformation.exerciseName}
                            </span>
                            {(() => {
                              const a = getApprovalInfo(ex);
                              if (!a.status) return null;
                              const isReRequest = a.status === 'in_progress' && a.resubmissionCount > 0;
                              const meta = a.status === 'approved'
                                ? { label: 'Approved', color: '#059669', bg: 'rgba(5,150,105,0.10)' }
                                : a.status === 'rejected'
                                  ? { label: 'Rejected', color: '#dc2626', bg: 'rgba(220,38,38,0.10)' }
                                  : isReRequest
                                    ? { label: a.stepRole ? `Re-requested · ${a.stepRole}` : 'Re-requested', color: '#6d28d9', bg: 'rgba(109,40,217,0.10)' }
                                    : { label: a.stepRole ? `Waiting: ${a.stepRole}` : 'Waiting Approval', color: '#b45309', bg: 'rgba(245,158,11,0.12)' };
                              return (
                                <span
                                  title={
                                    a.status === 'in_progress'
                                      ? `${isReRequest ? 'Approval re-requested' : 'Pending approval'}${a.stepRole ? ` from ${a.stepRole}` : ''} — students cannot see this yet.`
                                      : a.status === 'approved'
                                        ? 'Approved — visible to students.'
                                        : 'Rejected — not visible to students.'
                                  }
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '2px 7px', borderRadius: 999,
                                    fontSize: 9, fontWeight: 700, whiteSpace: 'nowrap',
                                    background: meta.bg, color: meta.color,
                                    flexShrink: 0,
                                  }}
                                >
                                  <Clock size={9} strokeWidth={2.5} />
                                  {meta.label}
                                </span>
                              );
                            })()}
                          </div>
                        </td>

                        {/* Type */}
                        <td className="h-11 px-3 align-middle text-[12px] text-body">
                          <ExerciseTypeBadge type={ex.exerciseType} />
                        </td>

                        {/* Created */}
                        <td className="h-11 px-3 align-middle text-[12px] text-body">
                          <div className="flex items-center gap-1.5">
                            <Calendar size={11} className="text-faint flex-shrink-0" />
                            <span>{new Date(ex.createdAt).toLocaleDateString('en-GB')}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="h-11 px-3 align-middle text-[12px] text-body">
                          <ScoreProgress exercise={ex} />
                        </td>

                        {/* Actions */}
                        <td className="h-11 pl-2 pr-4 align-middle text-right">
                          <ActionMenu exercise={ex} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* ── Empty state ── */
          <div className="flex flex-col items-center justify-center text-center py-16 p-8">
            <div className="mb-4 p-5 rounded-2xl"
              style={{ background: 'rgba(242,119,87,0.06)', border: '1.5px dashed rgba(242,119,87,0.25)' }}>
              <FileCode size={32} style={{ color: 'rgba(242,119,87,0.4)' }} />
            </div>
            <h3 className="text-[14px] font-bold mb-1" style={{ color: '#1a1a2e', ...JKT }}>
              {searchQuery ? 'No matching exercises' : 'No exercises yet'}
            </h3>
            <p className="text-[12px] mb-5 max-w-xs leading-relaxed" style={{ color: '#8b8b9e', ...JKT }}>
              {searchQuery ? 'Try adjusting your search query.'
                : !subcategory ? 'Please select a subcategory.'
                  : `Create your first exercise for ${activeTab?.replace('_', ' ')}.`}
            </p>
            {subcategory && !searchQuery && (
              <button onClick={handleNewExercise}
                className="h-8 px-5 gap-1.5 text-white text-[12px] font-semibold rounded-xl flex items-center transition-all"
                style={{ ...JKT, background: '#F27757', boxShadow: '0 2px 8px rgba(242,119,87,0.3)', cursor: 'pointer', border: 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e0623f'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(242,119,87,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F27757'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(242,119,87,0.3)'; }}>
                <Plus size={14} /> Create Exercise
              </button>
            )}
          </div>
        )}
      </div>
      {/* ══ Pagination ════════════════════════════════════════════════════
          Swapped from the bespoke chevron / page-button strip to the shared
          TableFooter — same one Client Management, User Management and
          Service Mapping use — so all four admin lists read as one system.
          `flex-shrink-0` keeps it pinned at the workspace's bottom edge. */}
      {filtered.length > 0 && (
        <div className="flex-shrink-0 border-t border-hairline bg-surface px-3 sm:px-4 md:px-6">
          <TableFooter
            from={pagination.totalItems === 0 ? 0 : (pagination.currentPage - 1) * pagination.itemsPerPage + 1}
            to={Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)}
            total={pagination.totalItems}
            pageSize={pagination.itemsPerPage}
            onPageSize={(n) => {
              // Manual pick pins the size and stops the auto-fit observer
              // from overriding on the next resize — respect the choice.
              setAutoFitPageSize(false);
              setPagination(prev => ({ ...prev, itemsPerPage: n, currentPage: 1 }));
            }}
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPage={(p) => setPagination(prev => ({ ...prev, currentPage: Math.min(Math.max(1, p), prev.totalPages) }))}
          />
        </div>
      )}

      {/* ══ MODALS ══════════════════════════════════════════════════════ */}

      {showAddQuestionOptions && selectedExerciseForAdd && (
        <AddQuestionOptions exercise={selectedExerciseForAdd} onClose={() => setShowAddQuestionOptions(false)} />
      )}

      {showQuestionBank && selectedExerciseForAdd && (
        <div className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 80, background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto"
            style={{ border: '1px solid #e4e4ed' }}>
            <QuestionBankSelector
              exerciseData={{
                exerciseId: selectedExerciseForAdd._id,
                exerciseName: selectedExerciseForAdd.exerciseInformation.exerciseName,
                exerciseLevel: selectedExerciseForAdd.exerciseInformation.exerciseLevel || 'intermediate',
                nodeId, nodeName, subcategory, nodeType,
                fullExerciseData: { ...selectedExerciseForAdd, hierarchyData },
                exerciseType: selectedExerciseForAdd.exerciseType,
              }}
              tabType={activeTab}
              onClose={() => { setShowQuestionBank(false); setQbankFromMCQOpts(false); setSelectedExerciseForAdd(null); }}
              onBack={qbankFromMCQOpts ? () => { setShowQuestionBank(false); setQbankFromMCQOpts(false); setShowAddQuestionOptions(true); } : undefined}
              onSelect={handleQuestionBankSelect}
              existingQuestionIds={selectedExerciseForAdd.questions?.map(q => q._id) || []}
              existingQuestions={selectedExerciseForAdd.questions || []}
            />
          </div>
        </div>
      )}

      {showAddQuestionModal && selectedExerciseForAdd && (
        <AddQuestionForm
          exerciseData={{
            exerciseId: selectedExerciseForAdd._id,
            exerciseName: selectedExerciseForAdd.exerciseInformation.exerciseName,
            exerciseLevel: selectedExerciseForAdd.exerciseInformation.exerciseLevel || 'intermediate',
            selectedLanguages: selectedExerciseForAdd.programmingSettings?.selectedLanguages || [],
            evaluationSettings: getEvaluationSettings(selectedExerciseForAdd),
            nodeId, nodeName, subcategory, nodeType,
            exerciseType: selectedExerciseForAdd.exerciseType,
            fullExerciseData: {
              ...selectedExerciseForAdd,
              ...(fullExerciseForAdd || {}),
              exerciseType: selectedExerciseForAdd.exerciseType,
              hierarchyData,
            },
            programmingSettings: selectedExerciseForAdd.programmingSettings,
          }}
          breadcrumbs={getBreadcrumbs()}
          tabType={activeTab}
          onClose={async () => { setShowAddQuestionModal(false); setSelectedExerciseForAdd(null); setFullExerciseForAdd(null); await fetchExercises(); }}
          onSave={handleQuestionSaved}
          onOpenQuestionBank={() => { setShowAddQuestionModal(false); setShowQuestionBank(true); }}
          onOpenDocumentUpload={() => { setShowAddQuestionModal(false); setShowDocumentUpload(true); }}
          onMCQBankSelect={async (qs) => { setShowAddQuestionModal(false); await handleQuestionBankSelect(qs); }}
          showTypeSelector={selectedExerciseForAdd.exerciseType === 'Combined'}
          onEditExercise={() => {
            // Open ExerciseSettings on top of ProgrammingQuestionForm with Config Strategy locked
            if (selectedExerciseForAdd) {
              setLockConfigStrategy(true);
              handleEditExercise(selectedExerciseForAdd);
            }
          }}
        />
      )}

      {showDocumentUpload && selectedExerciseForAdd && (
        <AddQuestionViaDocument
          exerciseData={{
            exerciseId: selectedExerciseForAdd._id,
            exerciseName: selectedExerciseForAdd.exerciseInformation.exerciseName,
            exerciseLevel: selectedExerciseForAdd.exerciseInformation.exerciseLevel || "intermediate",
            nodeId: nodeId,
            nodeName: nodeName,
            nodeType: nodeType,
            subcategory: subcategory,
            fullExerciseData: selectedExerciseForAdd,
          }}
          tabType={activeTab}
          breadcrumbs={getBreadcrumbs()}
          onClose={() => {
            setShowDocumentUpload(false);
            setSelectedExerciseForAdd(null);
          }}
          onInserted={async (count) => {
            await fetchExercises();
            toast.success(`${count} question${count !== 1 ? "s" : ""} added via document`);
          }}
        />
      )}


      {showSettingsModal && (
        <ExerciseSettings
          hierarchyData={hierarchyData} nodeId={nodeId} nodeName={nodeName}
          subcategory={subcategory} nodeType={nodeType} level={hierarchyData.level}
          tabType={activeTab} onSave={handleSaveSettings}
          onClose={async () => { setShowSettingsModal(false); setEditingExercise(null); setIsEditing(false); setLockConfigStrategy(false); await fetchExercises(); }}
          isEditing={isEditing} exercise_Id={editingExercise?._id} initialData={editingExercise ?? undefined}
          configuredLanguages={configuredLanguages}
          lockConfigStrategy={lockConfigStrategy}
          onOpenQuestionAuthor={(mode) => {
            // Route the Add Questions sub-view actions into this page's existing
            // authoring modals (they already know how to build exerciseData and
            // handle save/back). Close settings first so only one modal is open.
            const ex = editingExercise as any;
            if (!ex?._id) return;
            setShowSettingsModal(false);
            setSelectedExerciseForAdd(ex);
            setFullExerciseForAdd(ex);
            if (mode === 'scratch-bank') setShowQuestionBank(true);
            else setShowAddQuestionModal(true);
          }}
        />
      )}

      {/* Delete Modal */}
      {/* Delete Modal */}
      {showDeleteModal && exerciseToDelete && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 60, background: 'rgba(26,26,46,0.5)', backdropFilter: 'blur(4px)' }} />
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 61, pointerEvents: 'none' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              style={{ ...JKT, border: '1px solid #e4e4ed', pointerEvents: 'auto', boxShadow: '0 20px 60px rgba(26,26,46,0.18)' }}>

              {/* Header with red gradient */}
              <div className="flex items-center gap-3 p-4"
                style={{ borderBottom: '1px solid #fee2e2', background: 'linear-gradient(135deg,#fff5f5,#fff)' }}>
                <div className="p-2 bg-red-100 rounded-xl">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <h3 className="text-[13px] font-bold" style={{ color: '#1a1a2e' }}>Delete Exercise</h3>
                  <p className="text-[11px]" style={{ color: '#8b8b9e' }}>This action cannot be undone</p>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <p className="text-[12px] mb-3" style={{ color: '#6b6b7e' }}>
                  Are you sure you want to permanently delete this exercise?
                </p>
                <div className="p-3 rounded-xl" style={{ background: '#fafafa', border: '1px solid #e4e4ed' }}>
                  <p className="text-[12px] font-semibold truncate" style={{ color: '#1a1a2e' }}>
                    "{exerciseToDelete.exerciseInformation.exerciseName}"
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <ExerciseTypeBadge type={exerciseToDelete.exerciseType} />
                  </div>
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex gap-2 px-4 pb-4">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setExerciseToDelete(null);
                  }}
                  disabled={deleting}
                  className="flex-1 py-2 text-[12px] rounded-xl transition-all disabled:opacity-50"
                  style={{
                    ...JKT,
                    border: '1.5px solid #e4e4ed',
                    color: '#6b6b7e',
                    background: '#fff',
                    cursor: deleting ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={e => {
                    if (!deleting) {
                      e.currentTarget.style.background = '#fafafa';
                      e.currentTarget.style.borderColor = '#d0d0de';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#fff';
                    e.currentTarget.style.borderColor = '#e4e4ed';
                  }}>
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex-1 py-2 text-[12px] font-semibold text-white rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-70 transition-all"
                  style={{
                    ...JKT,
                    background: '#ef4444',
                    cursor: deleting ? 'not-allowed' : 'pointer'
                  }}
                  onMouseEnter={e => {
                    if (!deleting) e.currentTarget.style.background = '#dc2626';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#ef4444';
                  }}>
                  {deleting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3 w-3" />
                      Delete Exercise
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rejection message viewer — shown when the trainer clicks "See rejection".
          Parity with the You_Do assessment list. */}
      {rejectionViewer && (() => {
        const a = getApprovalInfo(rejectionViewer);
        return (
          <div className="fixed inset-0 flex items-center justify-center z-[1000]" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
              <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid #e4e4ed' }}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                    <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                  </div>
                  <h3 className="text-base font-bold" style={{ color: '#1a1a2e' }}>Rejection message</h3>
                </div>
                <button onClick={() => setRejectionViewer(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                  <X size={16} style={{ color: '#8b8b9e' }} />
                </button>
              </div>
              <div className="p-5">
                <p className="text-xs uppercase tracking-wide font-semibold mb-1" style={{ color: '#8b8b9e' }}>
                  Rejected by {a.rejectedByRole || 'approver'}
                </p>
                <p className="text-sm font-semibold mb-3" style={{ color: '#1a1a2e' }}>
                  {rejectionViewer.exerciseInformation?.exerciseName}
                </p>
                <div className="p-3 rounded-lg text-sm whitespace-pre-wrap" style={{ background: 'rgba(245,158,11,0.08)', color: '#1a1a2e', border: '1px solid rgba(245,158,11,0.2)' }}>
                  {a.rejectionMessage || '(no message provided)'}
                </div>
                <p className="text-xs mt-3" style={{ color: '#8b8b9e' }}>
                  Edit the exercise to address the feedback, then use "Request Approval" in the row menu — it goes back through the chain as a re-request.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 p-4" style={{ borderTop: '1px solid #e4e4ed', background: '#fafafa' }}>
                <button
                  onClick={() => setRejectionViewer(null)}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                  style={{ color: '#6b6b7e', background: '#fff', border: '1px solid #e4e4ed' }}
                >
                  Close
                </button>
                <button
                  onClick={() => { const target = rejectionViewer; setRejectionViewer(null); handleAction('edit', target); }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all flex items-center gap-2"
                  style={{ background: '#6366f1' }}
                >
                  <Edit3 size={14} />
                  Edit exercise
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default ProblemSolving;