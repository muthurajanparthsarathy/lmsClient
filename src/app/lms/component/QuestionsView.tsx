import { getToken } from "@/lib/session";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, RefreshCw,
  ArrowLeft, Eye,
  Search, Filter, Code2,
  MoreVertical, Edit3,
  Loader,
  X, Database, AlertTriangle,
  CheckCircle, Trash2,
  ChevronLeft, ChevronRight,
  FileText,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import AddQuestionForm from './questionforms/AddQuestionForm';
import { questionApi } from '@/apiServices/question';
import { exerciseApi } from '@/apiServices/exercise';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import AddQuestionViaDocument from './AddQuestionViaDocument';

import RichTextDisplay from './RichTextDisplay';
import QuestionBankSelector from './questionforms/mcq/QuestionBankSelector';
import DocQuestionPicker from './questionforms/DocQuestionPicker';
import { parseProgrammingFile } from './questionforms/parseQuestionsTxt';
import QuestionPreview from './QuestionPreview';
import ProgrammingQuestionForm from './questionforms/ProgrammingQuestionForm';
import GenerateMCQAIQuestion from './questionforms/mcq/GenerateMCQAIQuestion';

// ─── Design tokens (Login page parity) ────────────────────────────────────────
const JKT: React.CSSProperties = {
  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
};

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface Exercise {
  _id: string;
  exerciseType: 'MCQ' | 'Programming' | 'Combined' | 'Other';
  configurationType: { mcqMode: boolean; programmingMode: boolean; combinedMode: boolean };
  exerciseInformation: {
    exerciseName: string; exerciseId: string; description?: string;
    exerciseLevel: 'beginner' | 'intermediate' | 'expert'; totalDuration: number;
  };
  programmingSettings?: { selectedModule?: string; selectedLanguages?: string[] };
  questionConfiguration?: { mcqQuestionConfiguration?: any; programmingQuestionConfiguration?: any };
  questions: Question[];
  createdAt: string; updatedAt: string;
}

export interface Question {
  _id: string;
  questionType: 'mcq' | 'programming' | 'frontend' | 'database';
  questionTitle?: string; options?: string[]; correctAnswer?: string;
  title?: string; description?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  points?: number; score?: number;
  sampleInput?: string; sampleOutput?: string;
  constraints?: string[];
  hints?: Array<{ hintText: string; pointsDeduction: number; isPublic: boolean; sequence: number }>;
  testCases?: Array<any>; databaseTestCases?: Array<any>;
  solutions?: { startedCode: string; functionName: string; language: string };
  timeLimit?: number; memoryLimit?: number;
  isActive: boolean; sequence: number;
  createdAt?: string; updatedAt?: string;
  moduleType?: string; isFrontend?: boolean; isDatabase?: boolean; isProgramming?: boolean;
  browserDatabaseConfig?: any; databaseType?: string; metadata?: any; questionNumber?: number;
  mcqQuestionTitle?: string; mcqQuestionDescription?: string; mcqQuestionType?: string;
  mcqQuestionDifficulty?: 'easy' | 'medium' | 'hard';
  mcqQuestionScore?: number; mcqQuestionTimeLimit?: number;
  mcqQuestionOptions?: Array<{
    text: string; isCorrect: boolean; imageUrl: string | null;
    imageAlignment: string; imageSizePercent: number; _id: string;
  }>;
  mcqQuestionCorrectAnswers?: string[];
  mcqQuestionOptionsPerRow?: number; mcqQuestionRequired?: boolean;
  // Origin id of the Question Bank doc this question was imported from —
  // fed to the picker's id-check so re-imports are flagged as duplicates.
  bankQuestionId?: string | null;
}

interface QuestionsProps {
  exercise: Exercise; nodeId: string; nodeName: string;
  subcategory: string; nodeType: string; onBack: () => void;
  tabType: string; hierarchyData?: any; isModal?: boolean;
  onClose?: () => void; quickAddMode?: boolean;
  onEditExercise?: (exercise: Exercise) => void;
  breadcrumbs?: any[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';
const stripHtml = (html: string) => (html || '').replace(/<[^>]*>/g, '');

// ─── Component ─────────────────────────────────────────────────────────────────
const Questions: React.FC<QuestionsProps> = ({
  hierarchyData, exercise, breadcrumbs, nodeId, nodeName,
  subcategory, nodeType, tabType, onBack,
  isModal = false, onClose, quickAddMode = false, onEditExercise,
}) => {

  // ── State ──────────────────────────────────────────────────────────────────
  const [questions, setQuestions]               = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [showAddQuestion, setShowAddQuestion]   = useState(false);
  // Which source the child form should auto-open on mount ('manual' = normal
  // blank form; 'ai' = AI generator opens; 'bank' = Question Bank picker
  // opens; 'thirdParty' = Third Party provider search opens). Set by the
  // click handler based on the exercise's questionSource, so AI-alone or
  // Third-Party-alone exercises never show an empty form first.
  const [nextFormAutoOpen, setNextFormAutoOpen] = useState<'manual' | 'ai' | 'bank' | 'thirdParty'>('manual');
  const [showQuestionBank, setShowQuestionBank] = useState(false);
  const [qbankFromMCQOpts, setQbankFromMCQOpts] = useState(false);
  // Which source tag the currently-open import path stamps on questions —
  // 'thirdParty' via Other Platform, 'scratch-manual' for document uploads,
  // 'ai' for the AI-review funnel, scratch-bank otherwise. Anything
  // 'scratch*' bills the Manual quota slice.
  const [bankSourceTag, setBankSourceTag] = useState<'scratch-bank' | 'thirdParty' | 'scratch-manual' | 'ai'>('scratch-bank');
  const [currentPage, setCurrentPage]           = useState(1);
  const [searchTerm, setSearchTerm]             = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<'all'|'easy'|'medium'|'hard'>('all');
  const [filterType, setFilterType]             = useState<'all'|'mcq'|'programming'|'frontend'|'database'>('all');
  const [includeInactive, setIncludeInactive]   = useState(false);
  const [hoveredRow, setHoveredRow]             = useState<string | null>(null);

  const [editingQuestion, setEditingQuestion]               = useState<Question | null>(null);
  const [showEditQuestionModal, setShowEditQuestionModal]   = useState(false);
  const [showDeleteQuestionModal, setShowDeleteQuestionModal] = useState(false);
  const [questionToDelete, setQuestionToDelete]             = useState<Question | null>(null);
  const [deletingQuestion, setDeletingQuestion]             = useState(false);
  const [showAddOption, setShowAddOption]                   = useState(false);
  const [previewQuestion, setPreviewQuestion]               = useState<Question | null>(null);

  const [showDuplicateConfirmation, setShowDuplicateConfirmation] = useState(false);
  const [duplicateQuestions, setDuplicateQuestions]         = useState<{ original: Question; duplicate: Question }[]>([]);
  const [pendingBankQuestions, setPendingBankQuestions]     = useState<Question[]>([]);
  // Bank questions handed to AddQuestionForm to pre-load for review-then-save.
  const [bankReviewQuestions, setBankReviewQuestions]       = useState<Question[]>([]);
  const [editingDuplicateQuestion, setEditingDuplicateQuestion] = useState<Question | null>(null);
  const [showEditDuplicateModal, setShowEditDuplicateModal] = useState(false);
  const [isAddingQuestions, setIsAddingQuestions]           = useState(false);
  const [currentEditIndex, setCurrentEditIndex]             = useState(0);
  const [editingMode, setEditingMode]                       = useState<'edit'|'add'>('add');
const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [showGenerateAI, setShowGenerateAI] = useState(false);
  // Programming upload-via-document: parsed questions awaiting the trainer's
  // quota-capped selection (DocQuestionPicker). MCQ keeps its own
  // AddQuestionViaDocument flow, which has a server-backed selection stage.
  const [docPickerQuestions, setDocPickerQuestions] = useState<any[] | null>(null);
  const progDocInputRef = useRef<HTMLInputElement>(null);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [autoItemsPerPage, setAutoItemsPerPage] = useState(10);
  const [showSlotInfo, setShowSlotInfo]         = useState(false);
  // Full exercise data fetched from API — ensures questionConfiguration is always fresh
  const [fullExData, setFullExData]             = useState<any>(null);
const [showProgrammingForm, setShowProgrammingForm] = useState(false);
const [selectedProgrammingQuestion, setSelectedProgrammingQuestion] = useState<any>(null);
  // ── Dynamic rows ──────────────────────────────────────────────────────────


// ── Dynamic rows ──────────────────────────────────────────────────────────
useEffect(() => {
  const calcRows = () => {
    const c = tableContainerRef.current; if (!c) return;
    const firstRow  = c.querySelector('tbody tr') as HTMLElement | null;
    const headerRow = c.querySelector('thead tr') as HTMLElement | null;
    const rh = firstRow  ? firstRow.getBoundingClientRect().height  : 56;
    const hh = headerRow ? headerRow.getBoundingClientRect().height : 42;
    setAutoItemsPerPage(Math.max(1, Math.floor((c.clientHeight - hh) / rh)));
  };
  const t1 = setTimeout(calcRows, 50), t2 = setTimeout(calcRows, 300);
  const ro = new ResizeObserver(calcRows);
  if (tableContainerRef.current) ro.observe(tableContainerRef.current);
  return () => { clearTimeout(t1); clearTimeout(t2); ro.disconnect(); };
}, [loadingQuestions]);

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => { if (!quickAddMode) fetchQuestions(); }, [exercise._id, includeInactive, quickAddMode]);
  useEffect(() => () => { setEditingQuestion(null); setShowEditQuestionModal(false); }, []);
  useEffect(() => {
    setEditingQuestion(null); setShowEditQuestionModal(false);
    setQuestionToDelete(null); setShowDeleteQuestionModal(false);
  }, [exercise._id]);

  // Fetch full exercise data (with questionConfiguration / scoring) on mount and when exercise changes
  useEffect(() => {
    let cancelled = false;
    const fetchFull = async () => {
      try {
        const res = await exerciseApi.getExerciseById(exercise._id);
        const ex = res?.data?.exercise || res?.data || res?.exercise || null;
        if (ex && !cancelled) setFullExData(ex);
      } catch {
        // fall back to the prop — no error shown
      }
    };
    fetchFull();
    return () => { cancelled = true; };
  }, [exercise._id]);

  // ── Helpers ────────────────────────────────────────────────────────────────
 const getTitle = (q: Question) => {
    if (q.questionType === 'mcq') {
      const t = q.mcqQuestionTitle;
      if (Array.isArray(t)) {
        // extract text from content blocks
        return t.filter((cb: any) => cb.type === 'text')
          .map((cb: any) => (cb.value || '').replace(/<[^>]*>/g, '').trim())
          .filter(Boolean).join(' ') || 'Untitled MCQ';
      }
      return (typeof t === 'string' ? t : '') || 'Untitled MCQ';
    }
    return q.title || q.questionTitle || 'Untitled Question';
  };  const getDesc  = (q: Question) => {
    if (q.questionType === 'mcq') return q.mcqQuestionDescription || '';
    if (q.description) {
      if (typeof q.description === 'string') return q.description.replace(/<[^>]*>/g, '').substring(0, 120);
      // Pure array format: [{ type:'text', value:'...' }, ...]
      if (Array.isArray(q.description)) {
        const text = (q.description as any[]).filter(b => b.type === 'text').map(b => b.value || '').join(' ').replace(/<[^>]*>/g, '').trim();
        return text.substring(0, 120) || 'No description provided';
      }
      // Legacy object format: { text: '...', contentBlocks: [...] }
      if (typeof (q.description as any).text === 'string') return (q.description as any).text.replace(/<[^>]*>/g, '').substring(0, 120);
    }
    return 'No description provided';
  };
  const getDiff  = (q: Question) => q.questionType === 'mcq' ? q.mcqQuestionDifficulty || 'medium' : q.difficulty || 'medium';
const getScore = (q: Question) => Math.round(q.questionType === 'mcq' ? q.mcqQuestionScore || 0 : q.score || q.points || 0);
  const getOptDisplay = (q: Question) => {
    if (q.questionType !== 'mcq' || !q.mcqQuestionOptions) return [];
    return q.mcqQuestionOptions.map(o => { const t = o.text.replace(/<[^>]*>/g, '').trim(); return t.length > 18 ? t.substring(0, 18) + '…' : t; });
  };
  const hasMcqQs = useCallback((qs: Question[]) => qs.some(q => q.questionType === 'mcq'), []);

  // ── Badges ────────────────────────────────────────────────────────────────
  const TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
    mcq:         { label: 'MCQ',      color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', dot: 'bg-purple-400'  },
    programming: { label: 'Coding',   color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   dot: 'bg-blue-400'    },
    frontend:    { label: 'Frontend', color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  dot: 'bg-amber-400'   },
    database:    { label: 'Database', color: 'text-emerald-700',bg: 'bg-emerald-50', border: 'border-emerald-200',dot: 'bg-emerald-400' },
  };
  const TypeBadge = ({ type }: { type: string }) => {
    const c = TYPE_CFG[type] || TYPE_CFG.programming;
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.color} ${c.bg} ${c.border}`}
        style={{ ...JKT, letterSpacing: '0.01em' }}>
        <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />{c.label}
      </span>
    );
  };

  const DIFF_CFG: Record<string, { bg: string; text: string; border: string }> = {
    easy:   { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    medium: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
    hard:   { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    },
  };
  const DiffBadge = ({ level }: { level: string }) => {
    const c = DIFF_CFG[level] || DIFF_CFG.medium;
    return (
      <span className={`inline-flex items-center text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}
        style={JKT}>{level}</span>
    );
  };

  // Source identification badge — maps the stored `source` tag to the display
  // labels used in Exercise Settings. Legacy questions (no tag) show nothing.
  const SRC_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    manual:     { label: 'Manual',         color: '#475569', bg: 'rgba(100,116,139,0.08)', border: '#e2e8f0' },
    bank:       { label: 'Bank',           color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  border: '#e9d5ff' },
    ai:         { label: 'AI',             color: '#6366f1', bg: 'rgba(99,102,241,0.08)',  border: '#c7d2fe' },
    thirdParty: { label: 'Other Platform', color: '#0d9488', bg: 'rgba(13,148,136,0.08)',  border: '#99f6e4' },
  };
  const SourceBadge = ({ source }: { source?: string | null }) => {
    const s = (source ?? '').toString();
    if (!s) return null;
    const key = s === 'ai' ? 'ai'
      : s.startsWith('thirdParty') ? 'thirdParty'
      : s === 'scratch-bank' ? 'bank'
      : s.startsWith('scratch') ? 'manual'
      : null;
    if (!key) return null;
    const c = SRC_CFG[key];
    return (
      <span className="inline-flex items-center shrink-0 text-[9px] font-bold uppercase px-1.5 py-[1px] rounded-full"
        style={{ ...JKT, letterSpacing: '0.03em', color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
        title={`Question source: ${c.label}`}>
        {c.label}
      </span>
    );
  };

  // ── Slot helpers ──────────────────────────────────────────────────────────
  // Always use freshly fetched fullExData when available so quota display stays
  // in sync after exercise settings are changed without a browser reload.
  const effectiveQConfig = fullExData?.questionConfiguration ?? exercise?.questionConfiguration;

  const calcRemaining = () => {
    const mc = effectiveQConfig?.mcqQuestionConfiguration;
    if (!mc || (mc.scoringType || 'equalDistribution') !== 'equalDistribution') return -1;
    return Math.max(0, (mc.totalMcqQuestions || 0) - questions.filter(q => q.questionType === 'mcq').length);
  };
  const calcMarksPerQ = () => effectiveQConfig?.mcqQuestionConfiguration?.marksPerQuestion || 0;

  const isMcqAddDisabled = () => {
    const mc = effectiveQConfig?.mcqQuestionConfiguration;
    if (!mc) return false;
    const st = mc.scoringType || 'equalDistribution';
    const mqQs = questions.filter(q => q.questionType === 'mcq');
    if (st === 'equalDistribution') { const t = mc.totalMcqQuestions || 0; return t > 0 && mqQs.length >= t; }
    if (st === 'questionSpecific')  { const t = mc.mcqTotalMarks || 0; return t > 0 && mqQs.reduce((s, q) => s + (q.mcqQuestionScore || 0), 0) >= t; }
    return false;
  };

  // ── FIXED: isProgGeneralFull now handles selectionLevel ──────────────────
  const isProgGeneralFull = () => {
    const pc = effectiveQConfig?.programmingQuestionConfiguration;
    if (!pc) return false;
    const configType = pc.questionConfigType || 'general';

    if (configType === 'general') {
      const t = pc.generalQuestionCount || 0;
      if (!t) return false;
      return questions.filter(q => q.questionType !== 'mcq' && q.isActive !== false).length >= t;
    }

    if (configType === 'levelBased') {
      const c = pc.levelBasedCounts || {};
      const total = (c.easy || 0) + (c.medium || 0) + (c.hard || 0);
      if (!total) return false;
      return questions.filter(q => q.questionType !== 'mcq' && q.isActive !== false).length >= total;
    }

    if (configType === 'selectionLevel') {
      const c = pc.selectionLevelCounts || {};
      // Only consider difficulties that have a quota > 0
      const activeDiffs = (['easy', 'medium', 'hard'] as const).filter(d => (c[d] || 0) > 0);
      if (!activeDiffs.length) return false;
      // Button is disabled ONLY when ALL active difficulty quotas are individually full
      return activeDiffs.every(d => {
        const quota = c[d] || 0;
        const used = questions.filter(q =>
          q.questionType !== 'mcq' &&
          q.isActive !== false &&
          (q.difficulty || 'medium') === d
        ).length;
        return used >= quota;
      });
    }

    return false;
  };


  const isOthersFull = (): boolean => {
  if (exercise.exerciseType !== 'Other') return false;
  const oc = effectiveQConfig?.othersQuestionConfiguration;
  if (!oc) return false;
  const cfgType = oc.questionConfigType || 'general';
  const othersQs = questions.filter(q => q.questionType === 'others');

  if (cfgType === 'general') {
    const total = oc.generalQuestionCount || 0;
    return total > 0 && othersQs.length >= total;
  }
  // levelBased / selectionLevel
  const counts = oc.levelBasedCounts || oc.selectionLevelCounts || {};
  const total = (counts.easy || 0) + (counts.medium || 0) + (counts.hard || 0);
  return total > 0 && othersQs.length >= total;
};
  // ── NEW: per-difficulty full check for selectionLevel ────────────────────
  const isSelectionLevelDiffFull = (diff: 'easy' | 'medium' | 'hard'): boolean => {
    const pc = effectiveQConfig?.programmingQuestionConfiguration;
    if (!pc || pc.questionConfigType !== 'selectionLevel') return false;
    const quota = (pc.selectionLevelCounts || {})[diff] || 0;
    if (!quota) return false;
    const used = questions.filter(q =>
      q.questionType !== 'mcq' &&
      q.isActive !== false &&
      (q.difficulty || 'medium') === diff
    ).length;
    return used >= quota;
  };

  // ── FIXED: getProgSlotInfo now handles selectionLevel with byDifficulty ──
  const getProgSlotInfo = (): {
    used: number;
    total: number;
    byDifficulty?: Record<string, { used: number; total: number }>;
  } => {
    const pc = effectiveQConfig?.programmingQuestionConfiguration;
    if (!pc) return { used: 0, total: 0 };
    const configType = pc.questionConfigType || 'general';
    const progQs = questions.filter(q => q.questionType !== 'mcq' && q.isActive !== false);
    const used = progQs.length;

    if (configType === 'general') {
      return { used, total: pc.generalQuestionCount || 0 };
    }

    if (configType === 'levelBased') {
      const c = pc.levelBasedCounts || {};
      const total = (c.easy || 0) + (c.medium || 0) + (c.hard || 0);
      const byDifficulty: Record<string, { used: number; total: number }> = {};
      (['easy', 'medium', 'hard'] as const).forEach(d => {
        if ((c[d] || 0) > 0) {
          byDifficulty[d] = {
            used: progQs.filter(q => (q.difficulty || 'medium') === d).length,
            total: c[d],
          };
        }
      });
      return { used, total, byDifficulty };
    }

    if (configType === 'selectionLevel') {
      const c = pc.selectionLevelCounts || {};
      const total = (c.easy || 0) + (c.medium || 0) + (c.hard || 0);
      const byDifficulty: Record<string, { used: number; total: number }> = {};
      (['easy', 'medium', 'hard'] as const).forEach(d => {
        if ((c[d] || 0) > 0) {
          byDifficulty[d] = {
            used: progQs.filter(q => (q.difficulty || 'medium') === d).length,
            total: c[d],
          };
        }
      });
      return { used, total, byDifficulty };
    }

    return { used, total: 0 };
  };

  const strSimilarity = (s1: string, s2: string) => {
    if (!s1 || !s2) return 0; if (s1 === s2) return 1;
    const w1 = s1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const w2 = s2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (!w1.length || !w2.length) return 0;
    return w1.filter(w => w2.includes(w)).length / new Set([...w1, ...w2]).size;
  };

  // ── API ────────────────────────────────────────────────────────────────────
  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const qp = new URLSearchParams(); if (includeInactive) qp.append('includeInactive', 'true');
      const pm: Record<string, string> = { module: 'modules', submodule: 'submodules', topic: 'topics', subtopic: 'subtopics' };
      const pnt = pm[nodeType.toLowerCase()] || nodeType;
      const res = await fetch(`${API_BASE_URL}/questions-get/${pnt}/${nodeId}/${exercise._id}?${qp}`, {
        headers: {
          'Content-Type': 'application/json', Accept: 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      let fetched: Question[] = [];
      if (result.data?.questions) fetched = result.data.questions;
      else if (Array.isArray(result.data)) fetched = result.data;
      else if (Array.isArray(result.questions)) fetched = result.questions;
      else if (Array.isArray(exercise.questions)) fetched = exercise.questions;
      fetched = [...fetched].reverse().map((q, i) => ({ ...q, questionNumber: fetched.length - i }));
      setQuestions(fetched); setCurrentPage(1);
    } catch {
      setQuestions(Array.isArray(exercise.questions)
        ? [...exercise.questions].reverse().map((q, i) => ({ ...q, questionNumber: exercise.questions.length - i }))
        : []);
      toast.error('Failed to load questions.', { position: 'top-right' });
    } finally { setLoadingQuestions(false); }
  };

  // In Questions.tsx, update the handleAction function:

const handleAction = async (type: string, q: Question) => {
  if (type === 'edit') {
    try {
      await fetchQuestions(); 
      
      // Find the latest version of the question
      const latestQuestion = questions.find(x => x._id === q._id) || q;
      
      // Ensure questionType is explicitly set
      if (!latestQuestion.questionType) {
        // Determine question type from fields if not explicitly set
        if (latestQuestion.mcqQuestionTitle || latestQuestion.mcqQuestionOptions) {
          latestQuestion.questionType = 'mcq';
        } else if (latestQuestion.isFrontend) {
          latestQuestion.questionType = 'frontend';
        } else if (latestQuestion.isDatabase) {
          latestQuestion.questionType = 'database';
        } else {
          latestQuestion.questionType = 'programming';
        }
      }
      
      setEditingQuestion(latestQuestion);
      setShowEditQuestionModal(true);
    } catch {
      setEditingQuestion(q);
      setShowEditQuestionModal(true);
    }
  } else if (type === 'delete') { 
    setQuestionToDelete(q); 
    setShowDeleteQuestionModal(true); 
  } else if (type === 'preview') { 
    setPreviewQuestion(q); 
  }
};

  const handleDeleteConfirm = async () => {
    if (!questionToDelete) return;
    setDeletingQuestion(true);
    try {
      const pm: Record<string, string> = { module: 'modules', submodule: 'submodules', topic: 'topics', subtopic: 'subtopics' };
      await questionApi.deleteQuestion(pm[nodeType.toLowerCase()] as any, nodeId, exercise._id, questionToDelete._id, tabType, subcategory);
      setQuestions(prev => prev.filter(q => q._id !== questionToDelete._id));
      setShowDeleteQuestionModal(false);
      setQuestionToDelete(null);
      await fetchQuestions();
      toast.success('Question deleted successfully', { id: 'delete-success' });
    } catch (err) {
      toast.error('Delete failed', { id: 'delete-error' });
      setShowDeleteQuestionModal(false);
      setQuestionToDelete(null);
    } finally {
      setDeletingQuestion(false);
    }
  };

  // Refresh full exercise data (e.g. after edit-exercise settings are changed from inside the form)
  const refreshFullExData = useCallback(async () => {
    try {
      const res = await exerciseApi.getExerciseById(exercise._id);
      const ex = res?.data?.exercise || res?.data || res?.exercise || null;
      if (ex) setFullExData(ex);
    } catch { /* ignore */ }
  }, [exercise._id]);

  const handleQuestionSaved = async (saved: any) => {
    const isSaveAndNext = saved?.__saveAndNext === true;
    const isUpdate = saved?.__isUpdate === true;
    if (editingQuestion && saved._id && !isSaveAndNext) {
      setQuestions(prev => prev.map(q => q._id === editingQuestion._id ? { ...q, ...saved } : q));
      toast.success('Question updated!', { id: 'question-save' });
      setShowEditQuestionModal(false); setEditingQuestion(null); await fetchQuestions();
    } else if (editingDuplicateQuestion) {
      const upd = [...duplicateQuestions];
      if (upd[currentEditIndex]) upd[currentEditIndex] = { ...upd[currentEditIndex], duplicate: { ...upd[currentEditIndex].duplicate, ...saved } };
      setDuplicateQuestions(upd);
      toast.success('Duplicate updated!');
      setShowEditDuplicateModal(false); setEditingDuplicateQuestion(null);
      if (currentEditIndex < duplicateQuestions.length - 1) {
        if (window.confirm(`Edit next duplicate (${currentEditIndex + 2} of ${duplicateQuestions.length})?`)) {
          const ni = currentEditIndex + 1; setCurrentEditIndex(ni); setEditingDuplicateQuestion(duplicateQuestions[ni].duplicate); setShowEditDuplicateModal(true);
        } else { setShowDuplicateConfirmation(true); setCurrentEditIndex(0); }
      } else { toast.success('All duplicates edited!'); setShowDuplicateConfirmation(true); setCurrentEditIndex(0); }
    } else {
      await fetchQuestions();
      toast.success(
        isSaveAndNext ? (isUpdate ? 'Updated — continue!' : 'Saved — continue!') : (isUpdate ? 'Question updated!' : 'Question created!')
      );
      if (!isSaveAndNext) { setShowAddQuestion(false); setShowQuestionBank(false); if (quickAddMode) setTimeout(() => onClose?.(), 1500); }
    }
  };

  const addSingle = async (q: Question): Promise<boolean> => {
    try {
      const pm: Record<string, any> = { module: 'modules', submodule: 'submodules', topic: 'topics', subtopic: 'subtopics' };
      const pnt = pm[nodeType.toLowerCase()] || 'topics', qt = q.questionType?.toLowerCase() || '';
      const data = qt === 'mcq' ? {
        questionType: 'mcq',mcqQuestionTitle: Array.isArray(q.mcqQuestionTitle)
          ? q.mcqQuestionTitle
          : (q.mcqQuestionTitle || q.questionTitle || ''),        mcqQuestionDescription: q.mcqQuestionDescription || q.description || '', mcqQuestionType: q.mcqQuestionType || 'multiple_choice',
        mcqQuestionDifficulty: q.mcqQuestionDifficulty || q.difficulty || 'medium', mcqQuestionScore: q.mcqQuestionScore || q.score || 10,
        mcqQuestionTimeLimit: q.mcqQuestionTimeLimit || q.timeLimit || 2000, isActive: true,
        mcqQuestionOptionsPerRow: q.mcqQuestionOptionsPerRow || 1, mcqQuestionOptions: q.mcqQuestionOptions || [],
        mcqQuestionCorrectAnswers: q.mcqQuestionCorrectAnswers || [], mcqQuestionRequired: q.mcqQuestionRequired || false,
        sequence: questions.length + 1,
      } : {
        questionType: 'programming', title: q.title || q.questionTitle || '', description: q.description || '',
        difficulty: q.difficulty || 'medium', score: q.score || q.points || 10, timeLimit: q.timeLimit || 2000,
        memoryLimit: q.memoryLimit || 256, isActive: true, testCases: q.testCases || [],
        sampleInput: q.sampleInput || '', sampleOutput: q.sampleOutput || '',
        solutions: q.solutions || { startedCode: '', functionName: 'main', language: 'python' },
        constraints: q.constraints || [], hints: q.hints || [], sequence: questions.length + 1,
      };
      await questionApi.addQuestion(pnt, nodeId, exercise._id, data, tabType, subcategory); return true;
    } catch { return false; }
  };

  const addBatch = async (qs: Question[]) => {
    let sc = 0, ec = 0;
    for (const q of qs) { const ok = await addSingle(q); if (ok) sc++; else ec++; await new Promise(r => setTimeout(r, 200)); }
    return { successCount: sc, errorCount: ec };
  };

 const handleBankSelect = async (selected: Question[]) => {
  if (!selected.length) return;
  
  // Accept every supported question type — MCQ plus the programming family
  // (core programming, frontend and database). The bank selector already filters
  // to the exercise's module type, so this only guards against questions with a
  // missing/unknown type.
  const acceptedTypes = ['mcq', 'programming', 'frontend', 'database'];
  const acceptedQuestions = selected.filter(q =>
    acceptedTypes.includes((q.questionType || '').toLowerCase())
  );

  if (acceptedQuestions.length === 0) {
    toast('Please select valid questions from the bank.', { icon: '⚠️' });
    return;
  }

  // Open the matching question form (per exercise module) with the selected questions
  // pre-loaded into its flow — the teacher reviews each and Save & Continues, so nothing
  // is silently added or missed. (No confirm popup, no direct bulk-add.)
  // Other Platform flow: keep the form re-opening the bank picker after every
  // save (never a blank editor) — scratch-bank keeps the default manual flow.
  setNextFormAutoOpen(bankSourceTag === 'thirdParty' ? 'thirdParty' : 'manual');
  setShowQuestionBank(false);
  setBankReviewQuestions(acceptedQuestions);
  setShowAddQuestion(true);
};

  const handleDupConfirm = async (action: 'addAll' | 'skip' | 'edit') => {
    setShowDuplicateConfirmation(false);
    if (action === 'addAll') {
      const all = [...pendingBankQuestions, ...duplicateQuestions.map(d => d.duplicate)];
      if (!all.length) { toast('No questions to add.', { icon: 'ℹ️' }); return; }
      setIsAddingQuestions(true); const tid = toast.loading(`Adding ${all.length} question(s)…`);
      const r = await addBatch(all); toast.dismiss(tid); setIsAddingQuestions(false);
      if (r.successCount > 0) toast.success(`${r.successCount} added!`);
      setShowQuestionBank(false); await fetchQuestions(); setDuplicateQuestions([]); setPendingBankQuestions([]);
    } else if (action === 'skip') {
      if (pendingBankQuestions.length > 0) {
        setIsAddingQuestions(true); const tid = toast.loading(`Adding ${pendingBankQuestions.length} unique…`);
        const r = await addBatch(pendingBankQuestions); toast.dismiss(tid); setIsAddingQuestions(false);
        if (r.successCount > 0) toast.success(`${r.successCount} added!`);
        if (duplicateQuestions.length > 0) toast(`${duplicateQuestions.length} duplicate(s) skipped.`, { icon: 'ℹ️' });
      } else toast('No new questions to add.', { icon: 'ℹ️' });
      setShowQuestionBank(false); await fetchQuestions(); setDuplicateQuestions([]); setPendingBankQuestions([]);
    } else if (action === 'edit' && duplicateQuestions.length > 0) {
      setEditingMode('edit'); setCurrentEditIndex(0);
      setEditingDuplicateQuestion(duplicateQuestions[0].duplicate); setShowEditDuplicateModal(true);
    }
  };

  const handleEditDupComplete = () => {
    setShowEditDuplicateModal(false); setEditingDuplicateQuestion(null);
    if (duplicateQuestions.length > 0 && currentEditIndex < duplicateQuestions.length - 1) {
      if (window.confirm(`${duplicateQuestions.length - currentEditIndex - 1} more. Continue?`)) {
        const ni = currentEditIndex + 1; setCurrentEditIndex(ni); setEditingDuplicateQuestion(duplicateQuestions[ni].duplicate); setShowEditDuplicateModal(true);
      } else setShowDuplicateConfirmation(true);
    } else setShowDuplicateConfirmation(true);
  };

  const getEvalSettings = () => ({
    practiceMode: effectiveQConfig?.programmingQuestionConfiguration?.allowCodeExecution || false,
    manualEvaluation: { enabled: false }, aiEvaluation: false,
    automationEvaluation: effectiveQConfig?.programmingQuestionConfiguration?.enableTestCases || false,
  });

  // ── Filtering & Pagination ─────────────────────────────────────────────────
  const filteredQs = questions.filter(q => {
    const t = getTitle(q).toLowerCase(), d = getDesc(q).toLowerCase(), diff = getDiff(q);
    return (!searchTerm || t.includes(searchTerm.toLowerCase()) || d.includes(searchTerm.toLowerCase()))
      && (filterDifficulty === 'all' || diff === filterDifficulty)
      && (filterType === 'all' || q.questionType === filterType);
  });

  const itemsPerPage = autoItemsPerPage;
  const totalPages   = Math.max(1, Math.ceil(filteredQs.length / itemsPerPage));
  const safePage     = Math.min(currentPage, totalPages);
  const startIdx     = (safePage - 1) * itemsPerPage;
  const pagedQs      = filteredQs.slice(startIdx, startIdx + itemsPerPage);
  const showMcqCol   = hasMcqQs(filteredQs);

  // ── Exercise type ─────────────────────────────────────────────────────────
  const isCombined = exercise.exerciseType?.toLowerCase() === 'combined' || exercise.configurationType?.combinedMode === true;
  const isPureMCQ  = !isCombined && (exercise.exerciseType?.toLowerCase() === 'mcq' || (exercise.configurationType?.mcqMode === true && !exercise.configurationType?.programmingMode));
const isPureProg = !isCombined && (
  exercise.exerciseType?.toLowerCase() === 'programming' ||
  (exercise.configurationType?.programmingMode === true && !exercise.configurationType?.mcqMode)
);

// Frontend / Database are sub-modules of a "programming" exercise
// (programmingSettings.selectedModule). Map them so the question-bank selector
// shows the matching specific type instead of lumping everything into "programming".
const progModule = (exercise.programmingSettings?.selectedModule || '').toLowerCase();
const progBankFilterType: 'programming' | 'frontend' | 'database' =
  progModule === 'frontend'
    ? 'frontend'
    : (progModule === 'database' || ['mysql', 'sqlite', 'postgresql', 'mongodb'].includes(progModule))
      ? 'database'
      : 'programming';

// ── Question Source enforcement for the "Add Question" popup ─────────────────
// The exercise's questionSource (from Settings) decides which of the four
// popup buttons are rendered (Manual / Bank / AI / Document-upload). Null /
// unset falls back to allow-all so pre-Phase-2 exercises keep working.
// Prefer the freshly-fetched exercise doc (fullExData) — the `exercise` prop
// is a snapshot from the list and goes stale when the trainer edits the
// Question Source settings and comes straight back here.
const _qSourceRaw = ((fullExData ?? exercise) as any).questionSource || null;
const _customSourcesRaw: string[] = Array.isArray(((fullExData ?? exercise) as any).customSources)
  ? ((fullExData ?? exercise) as any).customSources
  : [];
const allowedSources = (() => {
  const s = _qSourceRaw;
  if (s === 'scratch') return { manual: true, bank: true, ai: false, thirdParty: false, upload: true };
  if (s === 'ai') return { manual: false, bank: false, ai: true, thirdParty: false, upload: false };
  if (s === 'thirdParty') return { manual: false, bank: true, ai: false, thirdParty: true, upload: false };
  if (s === 'custom') {
    const has = (x: string) => _customSourcesRaw.includes(x);
    return { manual: has('scratch'), bank: has('scratch') || has('thirdParty'), ai: has('ai'), thirdParty: has('thirdParty'), upload: has('scratch') };
  }
  return { manual: true, bank: true, ai: true, thirdParty: true, upload: true };
})();

// Generic "Question Bank" is scratch's second entry point. Other Platform
// (thirdParty) gets its OWN popup button that opens the same picker but stamps
// imports with the thirdParty tag + its own quota slice — so the generic
// button only shows when scratch itself is allowed.
const bankViaScratch = (() => {
  const s = _qSourceRaw;
  if (!s) return true; // legacy exercises — allow all
  if (s === 'scratch') return true;
  if (s === 'custom') return _customSourcesRaw.includes('scratch');
  return false;
})();

// Per-source open-slot summary for the Add-Question popup. Programming
// splits per difficulty; MCQ and General-count configs have a single-row
// Custom split that lives entirely in the distribution's 'medium' bucket
// (the neutral bucket difficulty-less questions normalize into), so their
// per-source allocation is the source's TOTAL across all buckets.
// Never null. Where no count is configured the value is Infinity, so callers
// always read a number instead of treating "a config shape I don't recognise"
// as "unlimited" — the hole that let Combined exercises enforce nothing at all.
type SrcKey = 'scratch' | 'ai' | 'thirdParty';
const UNCAPPED: Record<SrcKey, number> = { scratch: Infinity, ai: Infinity, thirdParty: Infinity };
const sourceRemaining: Record<SrcKey, number> = (() => {
  const srcDoc: any = (fullExData ?? exercise) as any;
  const dist: any = srcDoc.questionSource === 'custom' ? srcDoc.customDistribution : null;
  const distTotal = dist ? (['easy', 'medium', 'hard'] as const).reduce((s, r) =>
    s + (dist[r]?.scratch || 0) + (dist[r]?.ai || 0) + (dist[r]?.thirdParty || 0), 0) : 0;
  const srcMatch = (x: any, srcKey: SrcKey) => {
    const s = ((x as any).source ?? '').toString();
    return srcKey === 'ai' ? s === 'ai' : srcKey === 'thirdParty' ? s.startsWith('thirdParty') : s.startsWith('scratch');
  };
  const allocFor = (srcKey: SrcKey) =>
    (dist?.easy?.[srcKey] || 0) + (dist?.medium?.[srcKey] || 0) + (dist?.hard?.[srcKey] || 0);
  const diffOf = (q: any) => { const dd = (q?.difficulty || '').toString().toLowerCase(); return dd === 'easy' || dd === 'hard' ? dd : 'medium'; };
  // Deactivated questions free their slot, the same way the programming paths
  // have always treated them. The MCQ paths used to count them forever.
  const active = (q: any) => q.isActive !== false;
  // Flat split (MCQ / General): the source's allocation is its total across all
  // three buckets, since difficulty-less questions normalize into 'medium'.
  const flatBySrc = (existing: any[], overall: number): Record<SrcKey, number> => {
    if (!dist || distTotal <= 0) return { scratch: overall, ai: overall, thirdParty: overall };
    const by = (srcKey: SrcKey) => {
      const usedSrc = existing.filter((x: any) => srcMatch(x, srcKey)).length;
      return Math.min(overall, Math.max(0, allocFor(srcKey) - usedSrc));
    };
    return { scratch: by('scratch'), ai: by('ai'), thirdParty: by('thirdParty') };
  };

  const mcqSlice = (): Record<SrcKey, number> => {
    const mc: any = effectiveQConfig?.mcqQuestionConfiguration;
    // questionSpecific MCQ is marks-budgeted, not count-capped — isMcqAddDisabled
    // owns that cap, so leave the count uncapped here rather than guess at one.
    if (!mc || (mc.scoringType || 'equalDistribution') === 'questionSpecific') return UNCAPPED;
    const totalQuota = mc.totalMcqQuestions || 0;
    if (totalQuota <= 0) return UNCAPPED;
    const existing = (questions || []).filter((q: any) => (q.questionType || '').toLowerCase() === 'mcq' && active(q));
    return flatBySrc(existing, Math.max(0, totalQuota - existing.length));
  };

  const progSlice = (): Record<SrcKey, number> => {
    const progCfg: any = effectiveQConfig?.programmingQuestionConfiguration;
    if (!progCfg) return UNCAPPED;
    const cfgType: string = progCfg.questionConfigType || 'general';
    const fam = ['programming', 'frontend', 'database'];
    const existing = (questions || []).filter((q: any) => fam.includes((q.questionType || '').toLowerCase()) && active(q));
    const perDiffRemaining: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 0, hard: 0 };
    let overall = 0;
    if (cfgType === 'general') {
      const total = progCfg.generalQuestionCount || 0;
      if (total <= 0) return UNCAPPED;
      overall = Math.max(0, total - existing.length);
      return flatBySrc(existing, overall);
    }
    let configured = 0;
    (['easy', 'medium', 'hard'] as const).forEach(d => {
      const quota = cfgType === 'selectionLevel'
        ? (progCfg.selectionLevelCounts?.[d] || 0)
        : (progCfg.levelBasedCounts?.[d] || progCfg.scoreSettings?.levelScoringConfiguration?.[d]?.questionCount || 0);
      configured += quota;
      const added = existing.filter((x: any) => diffOf(x) === d).length;
      perDiffRemaining[d] = Math.max(0, quota - added);
      overall += perDiffRemaining[d];
    });
    if (configured <= 0) return UNCAPPED;
    const by = (srcKey: SrcKey) => {
      if (!dist || distTotal <= 0) return overall;
      let sum = 0;
      (['easy', 'medium', 'hard'] as const).forEach(d => {
        const usedSrc = existing.filter((x: any) => diffOf(x) === d && srcMatch(x, srcKey)).length;
        sum += Math.min(perDiffRemaining[d], Math.max(0, (dist[d]?.[srcKey] || 0) - usedSrc));
      });
      return sum;
    };
    return { scratch: by('scratch'), ai: by('ai'), thirdParty: by('thirdParty') };
  };

  const othersSlice = (): Record<SrcKey, number> => {
    const oc: any = effectiveQConfig?.othersQuestionConfiguration;
    if (!oc) return UNCAPPED;
    const counts = oc.levelBasedCounts || oc.selectionLevelCounts || {};
    const total = (oc.questionConfigType || 'general') === 'general'
      ? (oc.generalQuestionCount || 0)
      : ((counts.easy || 0) + (counts.medium || 0) + (counts.hard || 0));
    if (total <= 0) return UNCAPPED;
    const existing = (questions || []).filter((q: any) => (q.questionType || '').toLowerCase() === 'others' && active(q));
    return flatBySrc(existing, Math.max(0, total - existing.length));
  };

  if (isPureMCQ) return mcqSlice();
  if (isPureProg) return progSlice();
  if (isCombined) {
    // A Combined exercise may spend a source on either family, so a source is
    // exhausted only once BOTH are. This branch previously returned null, which
    // is exactly why Combined assessments enforced no quota anywhere.
    const m = mcqSlice(), p = progSlice();
    return { scratch: m.scratch + p.scratch, ai: m.ai + p.ai, thirdParty: m.thirdParty + p.thirdParty };
  }
  if ((exercise.exerciseType || '').toLowerCase() === 'other') return othersSlice();
  return UNCAPPED;
})();
const srcQuotaFull = {
  scratch: sourceRemaining.scratch <= 0,
  ai: sourceRemaining.ai <= 0,
  thirdParty: sourceRemaining.thirdParty <= 0,
};
// Small amber marker rendered on quota-exhausted popup options.
const QuotaFullChip = () => (
  <span className="inline-flex items-center shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
    style={{ ...JKT, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', letterSpacing: '0.03em' }}>
    Quota full
  </span>
);

// Open-slot quota handed to the bank selector so it blocks over-selection at tick time.
// General → one total cap; levelBased / selectionLevel → per-difficulty caps.
// remaining = configured count − questions of that difficulty already in the exercise.
const bankSelectionQuota = (() => {
  const srcKeyOf = () => (bankSourceTag === 'thirdParty' ? 'thirdParty' as const : 'scratch' as const);
  const srcDoc: any = (fullExData ?? exercise) as any;
  const distAny: any = srcDoc.questionSource === 'custom' ? srcDoc.customDistribution : null;
  const distAnyTotal = distAny ? (['easy', 'medium', 'hard'] as const).reduce((s, r) =>
    s + (distAny[r]?.scratch || 0) + (distAny[r]?.ai || 0) + (distAny[r]?.thirdParty || 0), 0) : 0;
  const allocTotalFor = (srcKey: 'scratch' | 'ai' | 'thirdParty') =>
    (distAny?.easy?.[srcKey] || 0) + (distAny?.medium?.[srcKey] || 0) + (distAny?.hard?.[srcKey] || 0);
  const srcMatches = (q: any, srcKey: 'scratch' | 'thirdParty') => {
    const s = ((q as any).source ?? '').toString();
    return srcKey === 'thirdParty' ? s.startsWith('thirdParty') : s.startsWith('scratch');
  };
  // Cap for every config shape the branches below don't model — Combined,
  // Other, marks-budgeted MCQ. Handing the picker `undefined` meant "no cap",
  // which is how a Manual quota of 2 could still be filled with 5 bank picks.
  // Only a genuinely unconfigured exercise (remaining === Infinity) passes
  // without one.
  const fallback = (() => {
    const rem = sourceRemaining[srcKeyOf()];
    return Number.isFinite(rem)
      ? { mode: 'general' as const, remainingTotal: Math.max(0, rem) }
      : undefined;
  })();

  // MCQ: count-capped only under equalDistribution; the Custom split (single
  // "Questions" row) further narrows the cap to this source's total slice.
  if (isPureMCQ) {
    const mc: any = effectiveQConfig?.mcqQuestionConfiguration;
    if (!mc || (mc.scoringType || 'equalDistribution') === 'questionSpecific') return fallback;
    const total = mc.totalMcqQuestions || 0;
    if (total <= 0) return fallback;
    const existingMcq = (questions || []).filter((q: any) => (q.questionType || '').toLowerCase() === 'mcq' && q.isActive !== false);
    let remaining = Math.max(0, total - existingMcq.length);
    if (distAny && distAnyTotal > 0) {
      const srcKey = srcKeyOf();
      const usedSrc = existingMcq.filter((q: any) => srcMatches(q, srcKey)).length;
      remaining = Math.min(remaining, Math.max(0, allocTotalFor(srcKey) - usedSrc));
    }
    return { mode: 'general' as const, remainingTotal: remaining };
  }

  if (!isPureProg) return fallback;
  const progCfg: any = effectiveQConfig?.programmingQuestionConfiguration;
  if (!progCfg) return fallback;
  const cfgType: string = progCfg.questionConfigType || 'general';
  const family = ['programming', 'frontend', 'database'];
  const existing = (questions || []).filter((q: any) => family.includes((q.questionType || '').toLowerCase()) && q.isActive !== false);
  const diffOf = (q: any) => {
    const d = (q?.difficulty || '').toString().toLowerCase();
    return d === 'easy' || d === 'hard' ? d : 'medium';
  };
  if (cfgType === 'general') {
    const total = progCfg.generalQuestionCount || 0;
    let remaining = Math.max(0, total - existing.length);
    // Single-row Custom split narrows General configs too.
    if (distAny && distAnyTotal > 0) {
      const srcKey = srcKeyOf();
      const usedSrc = existing.filter((q: any) => srcMatches(q, srcKey)).length;
      remaining = Math.min(remaining, Math.max(0, allocTotalFor(srcKey) - usedSrc));
    }
    return { mode: 'general' as const, remainingTotal: remaining };
  }
  const quotaFor = (d: 'easy' | 'medium' | 'hard') =>
    cfgType === 'selectionLevel'
      ? (progCfg.selectionLevelCounts?.[d] || 0)
      : (progCfg.levelBasedCounts?.[d] || progCfg.scoreSettings?.levelScoringConfiguration?.[d]?.questionCount || 0);
  const addedFor = (d: 'easy' | 'medium' | 'hard') => existing.filter((q: any) => diffOf(q) === d).length;
  // Custom-mix refinement: when the exercise carries a per-difficulty source
  // distribution, every difficulty is further capped by the slice owned by the
  // source this picker imports as (scratch-bank vs thirdParty).
  // Reuse the distribution resolved at the top of this function. It reads
  // `fullExData ?? exercise`; re-deriving it from the bare `exercise` prop here
  // used the pre-edit snapshot, so a trainer who lowered the quota and came
  // straight back still got the old cap in the picker.
  const dist: any = distAny;
  const distTotal = distAnyTotal;
  const srcKey = srcKeyOf();
  const srcAddedFor = (d: 'easy' | 'medium' | 'hard') => existing.filter((q: any) => {
    if (diffOf(q) !== d) return false;
    const s = ((q as any).source ?? '').toString();
    return srcKey === 'thirdParty' ? s.startsWith('thirdParty') : s.startsWith('scratch');
  }).length;
  const remFor = (d: 'easy' | 'medium' | 'hard') => {
    const base = Math.max(0, quotaFor(d) - addedFor(d));
    if (!dist || distTotal <= 0) return base;
    return Math.min(base, Math.max(0, (dist[d]?.[srcKey] || 0) - srcAddedFor(d)));
  };
  return {
    mode: 'difficulty' as const,
    remainingByDifficulty: {
      easy: remFor('easy'),
      medium: remFor('medium'),
      hard: remFor('hard'),
    },
  };
})();

const isPureOthers = !isCombined && exercise.exerciseType?.toLowerCase() === 'other';
  const isExerciseGraded = fullExData?.isGraded !== false;
  const progGenFull = isProgGeneralFull();
  const mcqDisabled = isMcqAddDisabled();
  const progSlot    = getProgSlotInfo();
  const progFull    = progSlot.total > 0 && progSlot.used >= progSlot.total;

const addBtnDisabled = isAddingQuestions || (() => {
  if (isCombined)    return mcqDisabled && progFull;
  if (isPureMCQ)     return mcqDisabled;
  if (isPureProg)    return progGenFull;
  if (isPureOthers)  return isOthersFull();
  return false;
})();
  const getMcqBannerText = (): string | null => {
    if (!mcqDisabled) return null;
    const mc = effectiveQConfig?.mcqQuestionConfiguration; if (!mc) return null;
    const st = mc.scoringType || 'equalDistribution';
    if (st === 'equalDistribution') { const t = mc.totalMcqQuestions || 0, u = questions.filter(q => q.questionType === 'mcq').length; return `All ${t} MCQ slots filled (${u}/${t}). Delete a question to add a new one.`; }
    if (st === 'questionSpecific')  { const t = mc.mcqTotalMarks || 0, u = questions.filter(q => q.questionType === 'mcq').reduce((s, q) => s + (q.mcqQuestionScore || 0), 0); return `All ${t} marks allocated (${u}/${t} used). Delete or reduce marks to add more.`; }
    return null;
  };

  // Combined banner pills
  const mcqCfg         = effectiveQConfig?.mcqQuestionConfiguration;
  const mcqScoringType = mcqCfg?.scoringType || 'equalDistribution';
  const mcqQsForBanner = questions.filter(q => q.questionType === 'mcq');
  const mcqTotal       = mcqScoringType === 'questionSpecific' ? mcqCfg?.mcqTotalMarks || 0 : mcqCfg?.totalMcqQuestions || 0;
  const mcqUsed        = mcqScoringType === 'questionSpecific' ? mcqQsForBanner.reduce((s, q) => s + (q.mcqQuestionScore || 0), 0) : mcqQsForBanner.length;
  const mcqUnit        = mcqScoringType === 'questionSpecific' ? 'marks' : 'questions';

  const getPageNums = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const p: (number | '...')[] = [];
    if (safePage <= 4) p.push(1, 2, 3, 4, 5, '...', totalPages);
    else if (safePage >= totalPages - 3) p.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    else p.push(1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages);
    return p;
  };

  // ─── Overlay backdrop helper ───────────────────────────────────────────────
  const Backdrop = ({ zIndex = 100 }: { zIndex?: number }) => (
    <div className="fixed inset-0" style={{ zIndex, background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(4px)' }} />
  );

  // ─── Add Question Option Modal (Updated for both MCQ and Programming) ─────────
  // ── Upload via Document ────────────────────────────────────────────────
  // MCQ keeps the server-parsed AddQuestionViaDocument modal (it has its own
  // selection stage). Programming parses the .txt client-side, then opens the
  // quota-capped DocQuestionPicker; the chosen subset feeds AddQuestionForm's
  // review-then-save funnel stamped 'scratch-manual' (Manual quota slice).
  // Only true code-programming exercises take the client-side .txt path —
  // frontend/database-module exercises have their own in-form doc uploads
  // with the right parsers, and routing them through parseProgrammingFile
  // would hand the picks to a form that drops them.
  const docProgEligible = isPureProg && progBankFilterType === 'programming';

  const openDocFlow = () => {
    setShowAddOption(false);
    if (docProgEligible) {
      setBankSourceTag('scratch-manual');
      progDocInputRef.current?.click();
    } else {
      setShowDocumentUpload(true);
    }
  };

  // Shared routing for the "Add Question" affordance. Used by both the header
  // "+" button and the empty-state "Add First Question" button so both paths
  // honour `questionSource` identically — previously the empty state jumped
  // straight into AddQuestionForm without reading source config, so a stale
  // `nextFormAutoOpen` from an earlier AI click landed the trainer on the AI
  // generator instead of the source chooser popup.
  //
  // Source-aware branches (verbatim from the header "+" body):
  //   • Combined              → open the form directly (Combined has its own type tabs)
  //   • availableCount === 0  → open the form with the source's auto-open
  //   • usableCount === 1     → skip the popup, open the one usable option
  //   • otherwise             → show the chooser popup (setShowAddOption)
  //
  // Reads (fullExData ?? exercise) for questionSource / customSources so the
  // autoIntent stays in sync with `allowedSources` above after a settings edit.
  const routeAddQuestion = React.useCallback(() => {
    if (addBtnDisabled) return;
    // Combined exercises open the form directly; it handles its own MCQ /
    // Programming tabs and its source gating lives inside AddQuestionForm.
    if (isCombined) {
      // Explicit reset — without this, a stale 'ai' from a prior interaction
      // would auto-open the AI generator on the programming tab.
      setNextFormAutoOpen('manual');
      setShowAddQuestion(true);
      return;
    }
    const canScratch = allowedSources.manual;
    const canBank = bankViaScratch && (isPureMCQ || isPureProg || isCombined);
    const canAI = allowedSources.ai && (isPureMCQ || isCombined || isPureProg);
    const canOther = allowedSources.thirdParty && (isPureMCQ || isPureProg || isCombined);
    const canDoc = allowedSources.upload && (isPureMCQ || docProgEligible);
    const availableCount = [canScratch, canBank, canAI, canOther, canDoc].filter(Boolean).length;
    // Quota-full options are still SHOWN in the popup (disabled, with a
    // "Quota full" marker) but never auto-skipped into.
    const usableScratch = canScratch && !srcQuotaFull.scratch;
    const usableBank = canBank && !srcQuotaFull.scratch;
    const usableAI = canAI && !srcQuotaFull.ai;
    const usableOther = canOther && !srcQuotaFull.thirdParty;
    const usableDoc = canDoc && !srcQuotaFull.scratch;
    const usableCount = [usableScratch, usableBank, usableAI, usableOther, usableDoc].filter(Boolean).length;
    // Compute the intent: which source should the child form auto-open?
    // Falls back to 'manual' when the source doesn't map to a specific modal.
    // Read `fullExData ?? exercise` (not the stale `exercise` snapshot) so the
    // intent stays consistent with allowedSources after a settings edit.
    const _srcDoc: any = (fullExData ?? exercise) as any;
    const _qs = (_srcDoc.questionSource || null) as string | null;
    const _cs: string[] = Array.isArray(_srcDoc.customSources) ? _srcDoc.customSources : [];
    const autoIntent: 'manual' | 'ai' | 'bank' | 'thirdParty' =
      _qs === 'ai' ? 'ai'
      : _qs === 'thirdParty' ? 'thirdParty'
      : _qs === 'scratch' ? 'manual'
      : _qs === 'custom' && _cs.length === 1
        ? (_cs[0] === 'ai' ? 'ai' : _cs[0] === 'thirdParty' ? 'thirdParty' : 'manual')
        : 'manual';

    if (availableCount === 0) {
      // Empty popup would be useless — open the form with the source's
      // preferred auto-open. E.g. Programming + AI-alone opens the form
      // AND the AI generator on mount (no blank editor in between).
      setNextFormAutoOpen(autoIntent);
      setShowAddQuestion(true);
      return;
    }
    if (usableCount === 1) {
      if (usableScratch) { setNextFormAutoOpen('manual'); setShowAddQuestion(true); }
      else if (usableBank) { setBankSourceTag('scratch-bank'); setQbankFromMCQOpts(true); setShowQuestionBank(true); }
      else if (usableAI) {
        // Pure Programming AI lives inside the question form — open the
        // form with the AI generator auto-opened (never a blank editor).
        if (isPureProg) { setNextFormAutoOpen('ai'); setShowAddQuestion(true); }
        else setShowGenerateAI(true);
      }
      else if (usableOther) {
        // Other Platform alone → straight to the bank picker; imports
        // are stamped thirdParty and the teacher only chooses from it.
        setBankSourceTag('thirdParty'); setQbankFromMCQOpts(true); setShowQuestionBank(true);
      }
      else if (usableDoc) openDocFlow();
      return;
    }
    // Multi-option: show the source chooser popup.
    setShowAddOption(true);
  }, [
    addBtnDisabled, isCombined, isPureMCQ, isPureProg,
    allowedSources, bankViaScratch, docProgEligible, srcQuotaFull,
    fullExData, exercise,
    // setters are stable; listed for lint completeness
    setNextFormAutoOpen, setShowAddQuestion, setShowAddOption,
    setShowQuestionBank, setBankSourceTag, setQbankFromMCQOpts, setShowGenerateAI,
    openDocFlow,
  ]);

  const handleProgDocSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    try {
      const parsed = await parseProgrammingFile(file);
      if (!parsed.length) {
        toast.error('No questions found in the document. Check the .txt format (Title:/Description:/Input:/Output: blocks).');
        return;
      }
      setDocPickerQuestions(parsed.map((q, i) => ({ ...q, _previewId: `doc-${i}` })));
    } catch (err: any) {
      toast.error(err?.message || 'Could not read the document');
    }
  };

  const AddQuestionOptions = () => {
    // Header context label: "Assignment"/"Assessment" (spelling drift included)
    // derived from the subcategory; anything else gets its prettified name.
    const subcatNoun = /assess?ments?/i.test(subcategory || '') ? 'Assessment'
      : /assignments?/i.test(subcategory || '') ? 'Assignment'
      : subcategory ? subcategory.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) : 'Exercise';

    // Compact option row — replaces the old p-4 cards with a small minimal
    // list row (same gating/quota semantics, just denser UI).
    const Row = ({ full, onClick, iconBg, icon, accent, title, sub, badge }: {
      full?: boolean; onClick: () => void; iconBg: string; icon: React.ReactNode;
      accent: string; title: React.ReactNode; sub: React.ReactNode; badge?: React.ReactNode;
    }) => (
      <button onClick={() => { if (full) return; onClick(); }}
        className="group w-full text-left rounded-lg px-3 py-2 transition-all flex items-center gap-2.5"
        style={{ border: '1px solid #e4e4ed', cursor: full ? 'not-allowed' : 'pointer', background: full ? '#fafafa' : '#fff', opacity: full ? 0.6 : 1 }}
        onMouseEnter={e => { if (full) return; e.currentTarget.style.borderColor = accent; e.currentTarget.style.background = `${accent}08`; }}
        onMouseLeave={e => { if (full) return; e.currentTarget.style.borderColor = '#e4e4ed'; e.currentTarget.style.background = '#fff'; }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg }}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: '#1a1a2e' }}>{title}{badge}</div>
          <div className="text-[10px] truncate" style={{ color: full ? '#d97706' : '#8b8b9e' }}>{sub}</div>
        </div>
        {!full && <ChevronRight size={13} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all" style={{ color: accent }} />}
      </button>
    );

    return (
    <>
      <Backdrop zIndex={100} />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
          style={{ ...JKT, border: '1px solid #e4e4ed', pointerEvents: 'auto', boxShadow: '0 20px 60px rgba(26,26,46,0.18), 0 4px 16px rgba(242,119,87,0.08)' }}>

          {/* Header */}
          <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: '1px solid #e4e4ed' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                {/* Context lines — replaces the full breadcrumb trail: just the
                    topic and the assignment/assessment this question goes into. */}
                <div className="mb-1.5 space-y-0.5">
                  <div className="text-[10px]" style={{ color: '#6b6b7e' }}>
                    Topic: <span className="font-semibold" style={{ color: '#1a1a2e' }}>{nodeName || '—'}</span>
                  </div>
                  <div className="text-[10px]" style={{ color: '#6b6b7e' }}>
                    {subcatNoun} name: <span className="font-semibold" style={{ color: '#F27757' }}>{exercise?.exerciseInformation?.exerciseName || '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(242,119,87,0.1)' }}>
                    <Plus size={11} style={{ color: '#F27757' }} />
                  </div>
                  <h2 className="text-[13.5px] font-bold" style={{ color: '#1a1a2e' }}>Add Question</h2>
                </div>
                <p className="text-[10.5px]" style={{ color: '#8b8b9e' }}>
                  {isPureMCQ ? 'Add MCQ to this exercise' : isPureProg ? 'Add Programming question to this exercise' : 'Choose how to add questions'}
                </p>
              </div>
              <button onClick={() => setShowAddOption(false)}
                style={{ cursor: 'pointer', color: '#bcbccc', padding: '4px', borderRadius: '8px', lineHeight: 0, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#6b6b7e'; e.currentTarget.style.background = '#f5f5f8'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#bcbccc'; e.currentTarget.style.background = 'transparent'; }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Choices — filtered by exercise's questionSource (Manual / AI / Other Platform / Custom) */}
          <div className="p-3 space-y-1.5">
            {/* Safety net: if source filtering hides every button, tell the
                teacher instead of showing an empty popup. Click handler above
                also short-circuits this path before opening the popup, so
                this only shows on the rare re-open route (e.g. "Back" from
                Question Bank picker after settings changed). */}
            {(() => {
              const showScratch = allowedSources.manual;
              const showBank = bankViaScratch && (isPureMCQ || isPureProg || isCombined);
              const showAI = allowedSources.ai && (isPureMCQ || isCombined || isPureProg);
              const showOther = allowedSources.thirdParty && (isPureMCQ || isPureProg || isCombined);
              const showDoc = allowedSources.upload && (isPureMCQ || docProgEligible);
              const noneVisible = !showScratch && !showBank && !showAI && !showOther && !showDoc;
              if (!noneVisible) return null;
              return (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[12px]" style={{ color: '#92400e' }}>
                  <p className="font-semibold mb-1">No matching add-question option for this exercise.</p>
                  <p className="text-[11px]">
                    The exercise's Source (in Settings) doesn't map to any button that works here. Open the question form directly, or change the Source in Exercise Settings.
                  </p>
                </div>
              );
            })()}
            {/* Create New From Scratch — hidden when questionSource forbids manual;
                disabled (visible) when the Manual quota slice is exhausted. */}
            {allowedSources.manual && (() => { const full = srcQuotaFull.scratch; return (
              <Row
                full={full}
                onClick={() => { setNextFormAutoOpen('manual'); setShowAddOption(false); setShowAddQuestion(true); }}
                accent="#F27757"
                iconBg="rgba(242,119,87,0.1)"
                icon={<Plus size={14} style={{ color: '#F27757' }} />}
                title="Create Question From Scratch"
                badge={full && <QuotaFullChip />}
                sub={full ? 'All Manual slots in the distribution are used' : isPureProg ? 'Build a programming question from scratch' : 'Build from scratch with custom content'}
              />
            ); })()}

            {/* Question Bank — scratch's second entry point; hidden when scratch is forbidden;
                disabled (visible) when the Manual quota slice is exhausted. */}
            {bankViaScratch && (isPureMCQ || isPureProg || exercise.exerciseType !== 'mcq') && (() => { const full = srcQuotaFull.scratch; return (
              <Row
                full={full}
                onClick={() => { setBankSourceTag('scratch-bank'); setQbankFromMCQOpts(true); setShowAddOption(false); setShowQuestionBank(true); }}
                accent="#a855f7"
                iconBg="rgba(168,85,247,0.08)"
                icon={<Database size={14} className="text-purple-600" />}
                title="Create Question From Question Bank"
                badge={full && <QuotaFullChip />}
                sub={full ? 'All Manual slots in the distribution are used' : isPureProg ? 'Import programming questions from repository' : 'Import from existing question repository'}
              />
            ); })()}

            {/* Other Platform — same bank picker, but imports are stamped
                thirdParty and capped by the Other Platform quota slice.
                Disabled (visible) when that slice is exhausted. */}
            {allowedSources.thirdParty && (isPureMCQ || isPureProg || isCombined) && (() => { const full = srcQuotaFull.thirdParty; return (
              <Row
                full={full}
                onClick={() => { setBankSourceTag('thirdParty'); setQbankFromMCQOpts(true); setShowAddOption(false); setShowQuestionBank(true); }}
                accent="#0d9488"
                iconBg="rgba(13,148,136,0.08)"
                icon={<Database size={14} style={{ color: '#0d9488' }} />}
                title="Import From Other Platform"
                badge={full && <QuotaFullChip />}
                sub={full ? 'All Other Platform slots in the distribution are used' : 'Pick platform-imported questions — counted against the Other Platform quota'}
              />
            ); })()}

            {/* Generate with AI — hidden when questionSource forbids AI. Pure
                Programming routes through the form's AI generator (autoOpenSource)
                instead of the MCQ AI modal. Disabled (visible) when the AI
                quota slice is exhausted. */}
            {allowedSources.ai && (isPureMCQ || isCombined || isPureProg) && (() => { const full = srcQuotaFull.ai; return (
              <Row
                full={full}
                onClick={() => {
                  setShowAddOption(false);
                  if (isPureProg) { setNextFormAutoOpen('ai'); setShowAddQuestion(true); }
                  else setShowGenerateAI(true);
                }}
                accent="#6366f1"
                iconBg="linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))"
                icon={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2l2.39 5.7L20 9.27l-4.5 4.07L17 20l-5-3-5 3 1.5-6.66L4 9.27l5.61-1.57L12 2z" stroke="url(#aiGrad)" strokeWidth="1.6" strokeLinejoin="round" />
                    <defs>
                      <linearGradient id="aiGrad" x1="4" y1="2" x2="20" y2="20" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#6366f1" />
                        <stop offset="1" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                }
                title="Generate with AI"
                badge={full ? <QuotaFullChip /> : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}>NEW</span>}
                sub={full ? 'All AI slots in the distribution are used' : <>Let AI draft {isPureMCQ ? 'MCQs' : isPureProg ? 'programming questions' : 'questions'} from a topic — review and pick per slot</>}
              />
            ); })()}

            {/* Add via Document — hidden when questionSource forbids upload.
                Counts against the Manual quota slice (imports are stamped
                'scratch-manual'), so it shares the scratch full-state. */}
            {allowedSources.upload && (isPureMCQ || docProgEligible) && (() => { const full = srcQuotaFull.scratch; return (
              <Row
                full={full}
                onClick={openDocFlow}
                accent="#0891b2"
                iconBg="rgba(8,145,178,0.08)"
                icon={<FileText size={14} style={{ color: '#0891b2' }} />}
                title="Create Question From Document"
                badge={full && <QuotaFullChip />}
                sub={full ? 'All Manual slots in the distribution are used' : isPureProg ? 'Upload a .txt — pick which parsed questions to import' : 'Bulk import from JSON · CSV · TXT'}
              />
            ); })()}
          </div>

          <div className="px-3 pb-3">
            <button onClick={() => setShowAddOption(false)}
              className="w-full py-2 rounded-lg text-[11.5px] font-medium transition-all"
              style={{ ...JKT, border: '1px solid #e4e4ed', color: '#6b6b7e', background: '#fafafa', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fafafa')}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
    );
  };

  // ─── Duplicate Confirmation Dialog ────────────────────────────────────────
  const DuplicateConfirmationDialog = () => {
    if (!showDuplicateConfirmation) return null;
    return (
      <>
        <Backdrop zIndex={150} />
        <div className="fixed inset-0 z-[151] flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            style={{ ...JKT, border: '1px solid #e4e4ed', pointerEvents: 'auto', boxShadow: '0 20px 60px rgba(26,26,46,0.18)' }}>
            <div className="p-5 border-b border-amber-100 bg-amber-50/60">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-xl"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <h3 className="text-[13px] font-bold" style={{ color: '#1a1a2e' }}>Duplicate Questions Detected</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: '#6b6b7e' }}>{duplicateQuestions.length} question(s) already exist</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              {duplicateQuestions.length > 0 && (
                <div className="max-h-40 overflow-y-auto mb-4 rounded-xl divide-y" style={{ border: '1px solid #e4e4ed' }}>
                  {duplicateQuestions.map((item, i) => (
                    <div key={i} className="px-3 py-2.5">
                      <p className="text-[12px] font-semibold" style={{ color: '#1a1a2e' }}>#{i + 1} — {getTitle(item.duplicate)}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#bcbccc' }}>Matches: "{getTitle(item.original)}"</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-xl p-4 space-y-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <p className="text-[12px] font-semibold text-amber-800">What would you like to do?</p>
                {[
                  { val: 'addAll', label: 'Add All Anyway',  desc: `Add all ${duplicateQuestions.length + pendingBankQuestions.length} including duplicates` },
                  { val: 'skip',  label: 'Skip Duplicates',  desc: `Add only ${pendingBankQuestions.length} unique questions` },
                  { val: 'edit',  label: 'Edit Duplicates',  desc: 'Edit each duplicate before adding' },
                ].map(o => (
                  <label key={o.val} className="flex items-start gap-3" style={{ cursor: 'pointer' }}>
                    <input type="radio" name="dupAction" value={o.val} defaultChecked={o.val === 'skip'}
                      className="mt-1" style={{ accentColor: '#F27757', cursor: 'pointer' }} />
                    <div>
                      <span className="text-[12px] font-semibold text-amber-900">{o.label}</span>
                      <p className="text-[10px] text-amber-700">{o.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button disabled={isAddingQuestions}
                className="px-4 py-1.5 text-[12px] rounded-xl transition-all disabled:opacity-50"
                style={{ ...JKT, border: '1.5px solid #e4e4ed', color: '#6b6b7e', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f8')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { setShowDuplicateConfirmation(false); setDuplicateQuestions([]); setPendingBankQuestions([]); }}>
                Cancel
              </button>
              <button disabled={isAddingQuestions}
                className="px-4 py-1.5 text-[12px] font-semibold rounded-xl text-white flex items-center gap-1.5 disabled:opacity-70 transition-all"
                style={{ ...JKT, background: '#d97706', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#b45309')}
                onMouseLeave={e => (e.currentTarget.style.background = '#d97706')}
                onClick={() => { const el = document.querySelector('input[name="dupAction"]:checked') as HTMLInputElement; handleDupConfirm((el?.value || 'skip') as any); }}>
                {isAddingQuestions ? <><Loader className="h-3 w-3 animate-spin" />Processing…</> : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
  <div className="h-full flex flex-col overflow-hidden" style={{ ...JKT, background: '#ffffff', color: '#1a1a2e' }}>
  {/* Header - fixed height */}
<div className="flex-none flex items-center justify-between px-4 py-2.5 bg-white" style={{ borderBottom: '1px solid #e4e4ed' }}>
  <div className="flex items-center gap-2.5 min-w-0 flex-1">
    {/* Back */}
    <button onClick={onBack}
      className="h-7 w-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
      style={{ color: '#8b8b9e', cursor: 'pointer' }}
      title="Go back"
      onMouseEnter={e => { e.currentTarget.style.color = '#1a1a2e'; e.currentTarget.style.background = '#f5f5f8'; }}
      onMouseLeave={e => { e.currentTarget.style.color = '#8b8b9e'; e.currentTarget.style.background = 'transparent'; }}>
      <ArrowLeft size={15} />
    </button>

    {/* Title + ID — single row */}
    <div className="flex items-center gap-3 min-w-0 flex-wrap">
      <span className="text-[11px] font-medium flex-shrink-0" style={{ color: '#8b8b9e', ...JKT }}>
        Id: <span style={{ color: '#1a1a2e', fontWeight: 600 }}>{exercise.exerciseInformation.exerciseId || exercise._id}</span>
      </span>
      <span style={{ color: '#d4d4de', flexShrink: 0 }}>·</span>
      <span className="text-[11px] font-medium flex-shrink-0" style={{ color: '#8b8b9e', ...JKT }}>
        Exercise name: <span style={{ color: '#1a1a2e', fontWeight: 600 }}>{exercise.exerciseInformation.exerciseName}</span>
      </span>
      <span style={{ color: '#d4d4de', flexShrink: 0 }}>·</span>
      <span className="text-[11px] font-medium flex-shrink-0" style={{ color: '#8b8b9e', ...JKT }}>
        Exercise type: <span style={{ color: '#1a1a2e', fontWeight: 600 }}>
          {isCombined ? 'Combined' : isPureMCQ ? 'MCQ' : isPureProg ? 'Programming' : isPureOthers ? 'Other' : (exercise.exerciseType || '')}
        </span>
      </span>
    </div>
  </div>

  <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
    {/* Search */}
    <div className="relative">
      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#bcbccc' }} />
      <input placeholder="Search questions…" value={searchTerm}
        onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
        className="pl-7 pr-7 h-7 w-40 sm:w-52 text-[12px] rounded-lg outline-none transition-all"
        style={{ ...JKT, background: '#fafafa', border: '1.5px solid #e4e4ed', color: '#1a1a2e', cursor: 'text' }}
        onFocus={e => { e.currentTarget.style.borderColor = '#F27757'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(242,119,87,0.1)'; e.currentTarget.style.background = '#fff'; }}
        onBlur={e => { e.currentTarget.style.borderColor = '#e4e4ed'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = '#fafafa'; }} />
      {searchTerm && (
        <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
          style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#bcbccc', cursor: 'pointer', lineHeight: 0, border: 'none', background: 'none', padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#F27757')}
          onMouseLeave={e => (e.currentTarget.style.color = '#bcbccc')}
          title="Clear search">
          <X size={11} />
        </button>
      )}
    </div>

    <div className="h-4 w-px" style={{ background: '#e4e4ed' }} />

    {/* Refresh */}
    <button onClick={fetchQuestions} disabled={loadingQuestions || isAddingQuestions}
      title="Refresh questions"
      className="h-7 w-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
      style={{ color: '#8b8b9e', cursor: 'pointer' }}
      onMouseEnter={e => { if (!loadingQuestions) { e.currentTarget.style.color = '#F27757'; e.currentTarget.style.background = 'rgba(242,119,87,0.08)'; } }}
      onMouseLeave={e => { e.currentTarget.style.color = '#8b8b9e'; e.currentTarget.style.background = 'transparent'; }}>
      <RefreshCw size={13} className={loadingQuestions ? 'animate-spin' : ''} style={{ color: loadingQuestions ? '#F27757' : undefined }} />
    </button>

    {/* Filter */}
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button title="Filter questions"
          className="h-7 w-7 rounded-lg flex items-center justify-center transition-all"
          style={{
            color: (filterDifficulty !== 'all' || filterType !== 'all') ? '#F27757' : '#8b8b9e',
            background: (filterDifficulty !== 'all' || filterType !== 'all') ? 'rgba(242,119,87,0.08)' : 'transparent',
            border: (filterDifficulty !== 'all' || filterType !== 'all') ? '1px solid rgba(242,119,87,0.2)' : '1px solid transparent',
            cursor: 'pointer',
          }}>
          <Filter size={13} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" style={{ ...JKT, border: '1px solid #e4e4ed', boxShadow: '0 8px 24px rgba(26,26,46,0.12)' }}>
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wide" style={{ color: '#8b8b9e' }}>Difficulty</DropdownMenuLabel>
        {(['all', 'easy', 'medium', 'hard'] as const).map(d => (
          <DropdownMenuItem key={d} className="text-xs" style={{ color: filterDifficulty === d ? '#F27757' : '#1a1a2e', fontWeight: filterDifficulty === d ? '600' : '400', cursor: 'pointer' }}
            onClick={() => { setFilterDifficulty(d); setCurrentPage(1); }}>
            {d === 'all' ? 'All Difficulties' : d.charAt(0).toUpperCase() + d.slice(1)}
            {filterDifficulty === d && <CheckCircle size={10} className="ml-auto" style={{ color: '#F27757' }} />}
          </DropdownMenuItem>
        ))}
        {isCombined && (
          <>
            <DropdownMenuSeparator style={{ background: '#e4e4ed' }} />
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wide" style={{ color: '#8b8b9e' }}>Type</DropdownMenuLabel>
            {(['all', 'mcq', 'programming', 'frontend', 'database'] as const).map(t => (
              <DropdownMenuItem key={t} className="text-xs" style={{ color: filterType === t ? '#F27757' : '#1a1a2e', fontWeight: filterType === t ? '600' : '400', cursor: 'pointer' }}
                onClick={() => { setFilterType(t); setCurrentPage(1); }}>
                {t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}
                {filterType === t && <CheckCircle size={10} className="ml-auto" style={{ color: '#F27757' }} />}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {(filterDifficulty !== 'all' || filterType !== 'all') && (
          <>
            <DropdownMenuSeparator style={{ background: '#e4e4ed' }} />
            <DropdownMenuItem className="text-xs text-rose-500" style={{ cursor: 'pointer' }}
              onClick={() => { setFilterDifficulty('all'); setFilterType('all'); setCurrentPage(1); }}>
              <X size={11} className="mr-1.5" /> Clear Filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    {/* ── Add Question button + Slot tooltip ── */}
    <div className="relative flex-shrink-0"
      onMouseEnter={() => { if (!isAddingQuestions) setShowSlotInfo(true); }}
      onMouseLeave={() => setShowSlotInfo(false)}>

      <button
        onClick={routeAddQuestion}
        title={addBtnDisabled ? 'All slots are filled' : 'Add a new question'}
        className="h-7 px-3 text-[12px] font-semibold rounded-lg flex items-center gap-1 transition-all select-none"
        style={
          isAddingQuestions
            ? { ...JKT, background: '#f5f5f8', color: '#bcbccc', border: '1px solid #e4e4ed', cursor: 'not-allowed' }
            : addBtnDisabled
              ? { ...JKT, background: '#fffbeb', color: '#d97706', border: '1.5px solid #fde68a', cursor: 'not-allowed' }
              : { ...JKT, background: '#F27757', color: '#fff', boxShadow: '0 2px 8px rgba(242,119,87,0.3)', cursor: 'pointer' }
        }
        onMouseEnter={e => {
          if (!addBtnDisabled && !isAddingQuestions) {
            e.currentTarget.style.background = '#e0623f';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(242,119,87,0.4)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }
        }}
        onMouseLeave={e => {
          if (!addBtnDisabled && !isAddingQuestions) {
            e.currentTarget.style.background = '#F27757';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(242,119,87,0.3)';
            e.currentTarget.style.transform = 'none';
          }
        }}>
        {isAddingQuestions ? (
          <><Loader size={12} className="animate-spin" /><span className="hidden sm:inline">Adding…</span></>
        ) : addBtnDisabled ? (
          <><AlertTriangle size={13} /><span className="hidden sm:inline">Slot Full</span></>
        ) : (
          <><Plus size={13} strokeWidth={2.5} /><span className="hidden sm:inline">Add Question</span></>
        )}
      </button>

      {/* ── Slot tooltip (shown on hover always) ── */}
      {showSlotInfo && !isAddingQuestions && (
        <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-2xl overflow-hidden"
          style={{ ...JKT, border: addBtnDisabled ? '1px solid #fde68a' : '1px solid #e4e4ed', width: '240px', boxShadow: '0 12px 40px rgba(26,26,46,0.16)' }}>

          <div className="px-3 py-2 flex items-center gap-2"
            style={{ background: addBtnDisabled ? 'linear-gradient(135deg,#fffbeb,#fef3c7)' : 'linear-gradient(135deg,#f7f7fb,#f0f0f7)', borderBottom: addBtnDisabled ? '1px solid #fde68a' : '1px solid #e4e4ed' }}>
            {addBtnDisabled
              ? <AlertTriangle size={13} style={{ color: '#d97706', flexShrink: 0 }} />
              : <Plus size={13} style={{ color: '#F27757', flexShrink: 0 }} />}
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: addBtnDisabled ? '#92400e' : '#1a1a2e' }}>
              {addBtnDisabled ? 'Slots Full' : 'Question Quota'}
            </p>
          </div>

          <div className="p-3 space-y-3">
            {(isCombined || isPureMCQ) && (() => {
              const mc = effectiveQConfig?.mcqQuestionConfiguration;
              const st = mc?.scoringType || 'equalDistribution';
              const mqQs = questions.filter(q => q.questionType === 'mcq');
              const used = st === 'questionSpecific' ? mqQs.reduce((s, q) => s + (q.mcqQuestionScore || 0), 0) : mqQs.length;
              const total = st === 'questionSpecific' ? mc?.mcqTotalMarks || 0 : mc?.totalMcqQuestions || 0;
              const unit = st === 'questionSpecific' ? 'marks' : 'questions';
              const percentage = total > 0 ? (used / total) * 100 : 0;
              const isFull = total > 0 && used >= total;
              const scoringBadge = {
                label: st === 'questionSpecific' ? 'Question Specific' : 'Equal Distribution',
                color: st === 'questionSpecific' ? '#8b5cf6' : '#fb923c',
                bg: st === 'questionSpecific' ? '#ede9fe' : '#fff7ed',
                border: st === 'questionSpecific' ? '#ddd6fe' : '#ffedd5',
              };
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-semibold" style={{ color: '#1a1a2e' }}>MCQ</span>
                    <span className="text-[11px] font-medium" style={{ color: isFull ? '#ef4444' : '#6b6b7e' }}>{used}/{total} {unit}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: '#f0f0f5' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${percentage}%`, background: isFull ? '#ef4444' : '#F27757' }} />
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                    style={{ background: scoringBadge.bg, color: scoringBadge.color, border: `1px solid ${scoringBadge.border}`, fontWeight: 500 }}>
                    {scoringBadge.label}
                  </span>
                </div>
              );
            })()}

            {(isCombined || isPureProg) && (() => {
              const { used, total, byDifficulty } = getProgSlotInfo();
              const pc = effectiveQConfig?.programmingQuestionConfiguration;
              const configType = pc?.questionConfigType || 'general';
              const isFull = total > 0 && used >= total;
              const configBadge = configType === 'levelBased'
                ? { label: 'Level Based', color: '#8b5cf6', bg: '#ede9fe', border: '#ddd6fe' }
                : configType === 'selectionLevel'
                ? { label: 'Selection Level', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' }
                : { label: 'General', color: '#fb923c', bg: '#fff7ed', border: '#ffedd5' };
              const diffColor: Record<string, { text: string; bar: string }> = {
                easy:   { text: '#16a34a', bar: '#4ade80' },
                medium: { text: '#d97706', bar: '#fbbf24' },
                hard:   { text: '#7c3aed', bar: '#a78bfa' },
              };
              return (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-semibold" style={{ color: '#1a1a2e' }}>Programming</span>
                    {total > 0
                      ? <span className="text-[11px] font-medium" style={{ color: isFull ? '#ef4444' : '#6b6b7e' }}>{used}/{total} questions</span>
                      : <span className="text-[11px]" style={{ color: '#8b8b9e' }}>{used} questions</span>}
                  </div>
                  {byDifficulty && Object.keys(byDifficulty).length > 0 ? (
                    <div className="space-y-1.5 mb-2">
                      {Object.entries(byDifficulty).map(([d, slot]) => {
                        const pct = slot.total > 0 ? (slot.used / slot.total) * 100 : 0;
                        const full = slot.total > 0 && slot.used >= slot.total;
                        return (
                          <div key={d}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] capitalize font-medium" style={{ color: (diffColor[d] ?? diffColor.medium).text }}>{d}</span>
                              <span className="text-[10px]" style={{ color: full ? '#ef4444' : '#6b6b7e' }}>{slot.used}/{slot.total}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f0f0f5' }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: full ? '#ef4444' : (diffColor[d] ?? diffColor.medium).bar }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : total > 0 ? (
                    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: '#f0f0f5' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${total > 0 ? (used / total) * 100 : 0}%`, background: isFull ? '#ef4444' : '#fb923c' }} />
                    </div>
                  ) : null}
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                    style={{ background: configBadge.bg, color: configBadge.color, border: `1px solid ${configBadge.border}`, fontWeight: 500 }}>
                    {configBadge.label}
                  </span>
                </div>
              );
            })()}

  {isPureOthers  && (() => {
    const oc = effectiveQConfig?.othersQuestionConfiguration;
    const cfgType = oc?.questionConfigType || 'general';
    const othersQs = questions.filter(q => q.questionType === 'others');
    const used = othersQs.length;
    const total = cfgType === 'general'
      ? (oc?.generalQuestionCount || 0)
      : ((oc?.levelBasedCounts?.easy || 0) + (oc?.levelBasedCounts?.medium || 0) + (oc?.levelBasedCounts?.hard || 0))
        || ((oc?.selectionLevelCounts?.easy || 0) + (oc?.selectionLevelCounts?.medium || 0) + (oc?.selectionLevelCounts?.hard || 0));
    const isFull = total > 0 && used >= total;

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold" style={{ color: '#1a1a2e' }}>Others</span>
          {total > 0
            ? <span className="text-[11px] font-medium" style={{ color: isFull ? '#ef4444' : '#6b6b7e' }}>{used}/{total} questions</span>
            : <span className="text-[11px]" style={{ color: '#8b8b9e' }}>{used} questions</span>}
        </div>
        {total > 0 && (
          <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: '#f0f0f5' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (used / total) * 100)}%`, background: isFull ? '#ef4444' : '#16a34a' }} />
          </div>
        )}
      </div>
    );
  })()}

            <p className="text-[10px] pt-1 font-medium" style={{ color: addBtnDisabled ? '#d97706' : '#F27757', borderTop: '1px solid #f0f0f5' }}>
              {addBtnDisabled ? '⚠ Delete a question to free up a slot' : '→ Click to add question'}
            </p>
          </div>
        </div>
      )}
    </div>
    {/* ── /Add Question ── */}
  </div>
</div>
      {/* ══ Active filters bar ══ */}
      {(filterDifficulty !== 'all' || filterType !== 'all' || searchTerm) && (
        <div className="flex-none flex items-center gap-2 px-4 py-1.5"
          style={{ background: 'rgba(242,119,87,0.05)', borderBottom: '1px solid rgba(242,119,87,0.15)' }}>
          <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#F27757' }}>Filters:</span>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all"
              style={{ background: 'rgba(242,119,87,0.1)', color: '#F27757', border: '1px solid rgba(242,119,87,0.2)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(242,119,87,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(242,119,87,0.1)')}>
              "{searchTerm}" <X size={9} />
            </button>
          )}
          {filterDifficulty !== 'all' && (
            <button onClick={() => setFilterDifficulty('all')}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full capitalize transition-all"
              style={{ background: 'rgba(242,119,87,0.1)', color: '#F27757', border: '1px solid rgba(242,119,87,0.2)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(242,119,87,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(242,119,87,0.1)')}>
              {filterDifficulty} <X size={9} />
            </button>
          )}
          {filterType !== 'all' && (
            <button onClick={() => setFilterType('all')}
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full capitalize transition-all"
              style={{ background: 'rgba(242,119,87,0.1)', color: '#F27757', border: '1px solid rgba(242,119,87,0.2)', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(242,119,87,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(242,119,87,0.1)')}>
              {filterType} <X size={9} />
            </button>
          )}
          <span className="text-[10px] ml-auto" style={{ color: '#F27757' }}>
            {filteredQs.length} result{filteredQs.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ══ Table area ══════════════════════════════════════════════════════ */}
<div ref={tableContainerRef} className="flex-1 min-h-0 bg-white overflow-auto">
        {loadingQuestions ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 border-4 rounded-full" style={{ borderColor: '#f5f5f8' }} />
              <div className="absolute inset-0 border-4 rounded-full animate-spin" style={{ borderColor: '#F27757', borderTopColor: 'transparent' }} />
            </div>
            <p className="text-[12px] font-medium" style={{ color: '#8b8b9e' }}>Loading questions…</p>
          </div>
        ) : pagedQs.length > 0 ? (
          <table className="w-full border-collapse text-sm table-fixed">
            {/* ── thead ── */}
            <thead>
              <tr style={{ background: '#fafbfc', borderBottom: '1px solid #eef0f4' }}>
                {[
                  { label: '#',          cls: 'w-10 pl-4 pr-2' },
                  { label: 'Question',   cls: 'w-[28%] px-3' },
                  ...(showMcqCol ? [{ label: 'Options', cls: 'w-[22%] px-3' }] : []),
                  ...((isCombined || isPureOthers) ? [{ label: 'Type', cls: 'w-20 px-3' }] : []),
                  { label: 'Difficulty', cls: 'w-20 px-3' },
                  ...(isExerciseGraded ? [{ label: 'Marks', cls: 'w-16 px-3 text-center' }] : []),
                  { label: 'Actions',    cls: 'w-14 px-3 text-center' },
                ].map(h => (
                  <th key={h.label}
                    className={`py-2.5 text-left select-none ${h.cls}`}
                    style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: '#64748B', ...JKT }}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>

            {/* ── tbody ── */}
            <tbody>
              {pagedQs.map((q, idx) => {
                const title     = getTitle(q);
                const desc      = getDesc(q);
                const diff      = getDiff(q);
                const score     = getScore(q);
                const isMcq     = q.questionType === 'mcq';
                const opts      = getOptDisplay(q);
                const rowNum    = startIdx + idx + 1;
                const isHovered = hoveredRow === q._id;
                const isEven    = idx % 2 === 1;

                return (
                  <tr key={q._id}
                    style={{
                      borderBottom: '1px solid #f0f0f5',
                      background: isHovered
                        ? 'linear-gradient(90deg, rgba(242,119,87,0.06) 0%, rgba(242,119,87,0.03) 100%)'
                        : '#ffffff',
                      transition: 'background 0.15s ease, box-shadow 0.15s ease',
                      boxShadow: isHovered ? 'inset 3px 0 0 #F27757' : 'none',
                      cursor: 'default',
                    }}
                    onMouseEnter={() => setHoveredRow(q._id)}
                    onMouseLeave={() => setHoveredRow(null)}>

                    {/* # */}
                    <td className="pl-4 pr-2 py-2.5 align-middle">
                      {rowNum === 1 && currentPage === 1 ? (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-mono font-bold" style={{ color: '#F27757' }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#F27757' }} />
                          {rowNum}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono" style={{ color: isHovered ? '#F27757' : '#bcbccc', transition: 'color 0.15s', fontWeight: isHovered ? '600' : '400' }}>
                          {rowNum}
                        </span>
                      )}
                    </td>

                    {/* Title + desc */}
                    <td className="px-3 py-2.5 align-middle min-w-0" style={{ cursor: 'default' }}>
                      <div className="flex flex-col justify-center">
                        <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[12px] font-semibold truncate block" title={stripHtml(title)}
                          style={{ color: isHovered ? '#e0623f' : '#1a1a2e', transition: 'color 0.15s' }}>
                          <span>{typeof title === 'string' ? title.replace(/<[^>]*>/g, '') : title}</span>
                        </span>
                        <SourceBadge source={(q as any).source} />
                        </span>
                        <span className="text-[10px] truncate block mt-0.5" style={{ color: '#8b8b9e' }}>
                          {stripHtml(desc)}
                        </span>
                      </div>
                    </td>

                    {/* MCQ options */}
                    {showMcqCol && (
                      <td className="px-3 py-2.5 align-middle">
                        {isMcq && opts.length > 0 ? (
                          <div className="flex items-center gap-1 overflow-hidden">
                            {opts.slice(0, 2).map((opt, i) => (
                              <span key={i}
                                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded shrink-0 max-w-[90px]"
                                style={q.mcqQuestionOptions?.[i]?.isCorrect
                                  ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }
                                  : { background: '#fafafa', border: '1px solid #e4e4ed', color: '#6b6b7e' }}>
                                <span className="font-mono font-bold w-3">{String.fromCharCode(65 + i)}.</span>
                                <span className="truncate">{opt}</span>
                              </span>
                            ))}
                            {opts.length > 2 && <span className="text-[9px] shrink-0" style={{ color: '#bcbccc' }}>+{opts.length - 2}</span>}
                          </div>
                        ) : isMcq ? (
                          <span className="text-[10px] italic" style={{ color: '#bcbccc' }}>No options</span>
                        ) : (
                          <span className="text-[10px]" style={{ color: '#e4e4ed' }}>—</span>
                        )}
                      </td>
                    )}

                    {(isCombined || isPureOthers) && (
                      <td className="px-3 py-2.5 align-middle"><TypeBadge type={q.questionType} /></td>
                    )}
                    <td className="px-3 py-2.5 align-middle"><DiffBadge level={diff} /></td>

                    {isExerciseGraded && (
                      <td className="px-3 py-2.5 align-middle text-center">
                        <span className="block text-center text-[11px] font-medium" style={{ color: score > 0 ? '#1a1a2e' : '#e4e4ed', ...JKT }}>
                          {score > 0 ? Math.round(score) : '—'}
                        </span>
                      </td>
                    )}

                    {/* Actions */}
                    <td className="px-3 py-2.5 align-middle text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button title="More actions"
                            className="h-6 w-6 rounded-lg flex items-center justify-center transition-all"
                            style={{ color: isHovered ? '#F27757' : '#bcbccc', background: isHovered ? 'rgba(242,119,87,0.1)' : 'transparent', cursor: 'pointer', border: 'none' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#F27757'; e.currentTarget.style.background = 'rgba(242,119,87,0.12)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = isHovered ? '#F27757' : '#bcbccc'; e.currentTarget.style.background = isHovered ? 'rgba(242,119,87,0.1)' : 'transparent'; }}>
                            <MoreVertical size={13} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40"
                          style={{ ...JKT, border: '1px solid #e4e4ed', boxShadow: '0 8px 24px rgba(26,26,46,0.12)' }}>
                          <DropdownMenuItem className="text-xs gap-2" style={{ color: '#1a1a2e', cursor: 'pointer' }}
                            onClick={() => handleAction('edit', q)}>
                            <Edit3 className="h-3.5 w-3.5" style={{ color: '#F27757' }} /> Edit Question
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs gap-2" style={{ color: '#1a1a2e', cursor: 'pointer' }}
                            onClick={() => handleAction('preview', q)}>
                            <Eye className="h-3.5 w-3.5" style={{ color: '#8b8b9e' }} /> Preview
                          </DropdownMenuItem>
                          <DropdownMenuSeparator style={{ background: '#e4e4ed' }} />
                          <DropdownMenuItem className="text-xs gap-2 text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleAction('delete', q)}>
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* ── Empty state ── */
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="mb-4 p-5 rounded-2xl" style={{ background: 'rgba(242,119,87,0.06)', border: '1.5px dashed rgba(242,119,87,0.25)' }}>
              <Code2 size={32} style={{ color: 'rgba(242,119,87,0.4)' }} />
            </div>
            <h3 className="text-[14px] font-bold mb-1" style={{ color: '#1a1a2e' }}>
              {searchTerm || filterDifficulty !== 'all' || filterType !== 'all' ? 'No matching questions' : 'No questions yet'}
            </h3>
            <p className="text-[12px] mb-5 max-w-xs leading-relaxed" style={{ color: '#8b8b9e' }}>
              {searchTerm || filterDifficulty !== 'all' || filterType !== 'all'
                ? 'Try adjusting your search or clearing filters.'
                : 'Get started by adding your first question to this exercise.'}
            </p>
            {!addBtnDisabled && !searchTerm && filterDifficulty === 'all' && filterType === 'all' && (
              <button
                // Empty-state now routes through the same source-aware handler
                // as the header "+" button, so `questionSource` decides whether
                // to show the chooser popup, jump straight to the one usable
                // source, or open the form with the auto-open source. Previously
                // this branched on exercise TYPE alone and inherited a stale
                // `nextFormAutoOpen` value, causing "straight to AI" after a
                // prior AI click.
                onClick={routeAddQuestion}
                className="h-8 px-5 gap-1.5 text-white text-[12px] font-semibold rounded-xl flex items-center transition-all"
                style={{ ...JKT, background: '#F27757', boxShadow: '0 2px 8px rgba(242,119,87,0.3)', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#e0623f'; e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(242,119,87,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#F27757'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(242,119,87,0.3)'; }}>
                <Plus size={14} /> Add First Question
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ Pagination ══════════════════════════════════════════════════════ */}
      {filteredQs.length > 0 && (
        <div className="flex-none bg-white px-4 py-2 flex items-center justify-between" style={{ borderTop: '1px solid #e4e4ed' }}>
          <div className="text-[11px]" style={{ color: '#8b8b9e', ...JKT }}>
            Showing{' '}
            <span className="font-semibold" style={{ color: '#1a1a2e' }}>{startIdx + 1}</span>
            {' '}–{' '}
            <span className="font-semibold" style={{ color: '#1a1a2e' }}>{Math.min(startIdx + itemsPerPage, filteredQs.length)}</span>
            {' '}of{' '}
            <span className="font-semibold" style={{ color: '#1a1a2e' }}>{filteredQs.length}</span>
            {' '}questions
            {questions.length !== filteredQs.length && <span style={{ color: '#bcbccc' }}> (filtered from {questions.length})</span>}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                title="Previous page"
                className="h-6 w-6 rounded-md flex items-center justify-center transition-all disabled:opacity-30"
                style={{ color: '#8b8b9e', cursor: safePage === 1 ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (safePage !== 1) { e.currentTarget.style.color = '#F27757'; e.currentTarget.style.background = 'rgba(242,119,87,0.08)'; } }}
                onMouseLeave={e => { e.currentTarget.style.color = '#8b8b9e'; e.currentTarget.style.background = 'transparent'; }}>
                <ChevronLeft size={13} />
              </button>
              <div className="flex gap-0.5">
                {getPageNums().map((p, i) =>
                  p === '...' ? (
                    <span key={`e-${i}`} className="px-1 text-[11px] self-center" style={{ color: '#bcbccc' }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setCurrentPage(p as number)}
                      title={`Page ${p}`}
                      className="h-6 w-6 rounded-md text-[11px] font-semibold transition-all"
                      style={safePage === p
                        ? { ...JKT, background: '#F27757', color: '#fff', boxShadow: '0 2px 6px rgba(242,119,87,0.35)', cursor: 'default' }
                        : { ...JKT, color: '#6b6b7e', cursor: 'pointer' }}
                      onMouseEnter={e => { if (safePage !== p) { e.currentTarget.style.background = 'rgba(242,119,87,0.08)'; e.currentTarget.style.color = '#F27757'; } }}
                      onMouseLeave={e => { if (safePage !== p) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b6b7e'; } }}>
                      {p}
                    </button>
                  )
                )}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                title="Next page"
                className="h-6 w-6 rounded-md flex items-center justify-center transition-all disabled:opacity-30"
                style={{ color: '#8b8b9e', cursor: safePage === totalPages ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (safePage !== totalPages) { e.currentTarget.style.color = '#F27757'; e.currentTarget.style.background = 'rgba(242,119,87,0.08)'; } }}
                onMouseLeave={e => { e.currentTarget.style.color = '#8b8b9e'; e.currentTarget.style.background = 'transparent'; }}>
                <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══ Modals ══ */}
      {showAddOption && <AddQuestionOptions />}

    {showQuestionBank && (
  <QuestionBankSelector
    exerciseData={{
      exerciseId: exercise._id,
      exerciseName: exercise.exerciseInformation.exerciseName,
      exerciseLevel: exercise.exerciseInformation.exerciseLevel || 'intermediate',
      nodeId, nodeName, subcategory, nodeType,
      fullExerciseData: exercise,
      exerciseType: exercise.exerciseType,
    }}
    tabType={tabType}
    onClose={() => { setShowQuestionBank(false); setQbankFromMCQOpts(false); }}
    onBack={qbankFromMCQOpts ? () => { setShowQuestionBank(false); setQbankFromMCQOpts(false); setShowAddOption(true); } : undefined}
    onSelect={handleBankSelect}
    existingQuestionIds={questions.flatMap(q => [q._id, q.bankQuestionId]).filter(Boolean) as string[]}
    existingQuestions={questions}
    remainingQuestions={calcRemaining()}
    marksPerQuestion={calcMarksPerQ()}
    filterByType={isPureProg ? progBankFilterType : isPureMCQ ? 'mcq' : 'all'}
    selectionQuota={bankSelectionQuota}
    bankSource={bankSourceTag === 'thirdParty' ? 'otherPlatform' : 'bank'}
  />
)}

      {/* AI MCQ generator — opens from the AddQuestionOptions modal.
          Selection happens inside this modal (it has built-in checkbox selection
          honoring the slot quota). On save, the selected questions are mapped to
          the MCQ Question shape and piped into the AddQuestionForm review queue
          so each one is reviewed/edited before it lands in its slot. */}
      {showGenerateAI && (
        <GenerateMCQAIQuestion
          externalOpen={true}
          onExternalOpenHandled={() => { /* handled internally — nothing to do here */ }}
          breadcrumbs={(breadcrumbs as any) || []}
          exerciseData={{
            exerciseId: exercise._id,
            exerciseName: exercise.exerciseInformation.exerciseName,
            exerciseLevel: exercise.exerciseInformation.exerciseLevel || 'intermediate',
            selectedLanguages: exercise.programmingSettings?.selectedLanguages || [],
            nodeId, nodeName, subcategory, nodeType,
            exerciseType: isPureMCQ ? 'MCQ' : (exercise.exerciseType as string) || 'MCQ',
            topic: nodeName,
            fullExerciseData: { ...exercise, ...(fullExData || {}), questions },
          }}
          // Slot quota wiring so the modal blocks over-selection at tick time.
          // Custom-mix exercises further narrow the cap to the AI slice.
          scoringType={(effectiveQConfig?.mcqQuestionConfiguration?.scoringType as any) || 'equalDistribution'}
          maxSelectableCount={(() => {
            if (effectiveQConfig?.mcqQuestionConfiguration?.scoringType === 'questionSpecific') return -1;
            const base = calcRemaining();
            if (base < 0) return base;
            return sourceRemaining ? Math.min(base, sourceRemaining.ai) : base;
          })()}
          marksPerQuestion={calcMarksPerQ()}
          remainingMarks={(() => {
            const mc = effectiveQConfig?.mcqQuestionConfiguration;
            if (!mc || mc.scoringType !== 'questionSpecific') return -1;
            const used = questions
              .filter(q => q.questionType === 'mcq')
              .reduce((s, q) => s + (q.mcqQuestionScore || 0), 0);
            return Math.max(0, (mc.mcqTotalMarks || 0) - used);
          })()}
          onClose={() => setShowGenerateAI(false)}
          onSave={(aiQuestions) => {
            const mapped: Question[] = (aiQuestions || []).map((q: any, i: number) => {
              // For true-false, synthesize the two options from trueFalseAnswer.
              let rawOptions: { text: string; isCorrect: boolean; id?: string }[] = [];
              if (q.type === 'true-false') {
                rawOptions = [
                  { text: 'True',  isCorrect: q.trueFalseAnswer === true },
                  { text: 'False', isCorrect: q.trueFalseAnswer === false },
                ];
              } else if (Array.isArray(q.options)) {
                rawOptions = q.options.map((o: any) => ({ text: String(o.text ?? ''), isCorrect: !!o.isCorrect, id: o.id }));
              }
              const mcqOpts = rawOptions.map((o, idx) => ({
                text: o.text,
                isCorrect: o.isCorrect,
                imageUrl: null,
                imageAlignment: '',
                imageSizePercent: 0,
                _id: o.id || `ai-opt-${i}-${idx}`,
              }));
              const correctAnswers = mcqOpts.filter(o => o.isCorrect).map(o => o.text);
              const mcqType = q.type === 'multiple-select'
                ? 'multiple_select'
                : q.type === 'true-false'
                  ? 'true_false'
                  : q.type === 'dropdown'
                    ? 'dropdown'
                    : 'multiple_choice';
              return {
                _id: q.id || `ai-${Date.now()}-${i}`,
                questionType: 'mcq',
                // Provenance tag — flows through the review queue into the
                // MCQ form's blocks and is persisted on save.
                source: 'ai',
                mcqQuestionTitle: String(q.title || ''),
                mcqQuestionDescription: String(q.description || q.explanation || ''),
                mcqQuestionType: mcqType,
                mcqQuestionDifficulty: (q.difficulty as any) || 'medium',
                mcqQuestionScore: Number(q.points) || calcMarksPerQ() || 1,
                mcqQuestionTimeLimit: 2000,
                mcqQuestionOptions: mcqOpts,
                mcqQuestionCorrectAnswers: correctAnswers,
                mcqQuestionOptionsPerRow: q.optionsPerRow || 1,
                mcqQuestionRequired: false,
                isActive: true,
                sequence: questions.length + i + 1,
              } as Question;
            });

            setShowGenerateAI(false);
            if (mapped.length === 0) {
              toast('No questions selected.', { icon: 'ℹ️' });
              return;
            }
            // The review funnel's tag must match this flow — the MCQ form
            // stamps blocks with initialBankSource, and a stale bank tag
            // here would bill AI picks to the wrong slice.
            setBankSourceTag('ai');
            setBankReviewQuestions(mapped);
            setShowAddQuestion(true);
            toast.success(`${mapped.length} AI question${mapped.length > 1 ? 's' : ''} ready — review and save each into its slot.`);
          }}
        />
      )}

      {showAddQuestion && (
        <AddQuestionForm
          key={`add-${exercise._id}`}
          exerciseData={{
            exerciseId: exercise._id, _id: exercise._id, exerciseName: exercise.exerciseInformation.exerciseName,
            exerciseLevel: exercise.exerciseInformation.exerciseLevel || 'intermediate',
            selectedLanguages: exercise.programmingSettings?.selectedLanguages || [], evaluationSettings: getEvalSettings(),
            nodeId, nodeName, subcategory, nodeType,
            fullExerciseData: { ...exercise, ...(fullExData || {}), questions, hierarchyData },
            exerciseType: exercise.exerciseType, programmingSettings: exercise.programmingSettings, subcategoryLabel: subcategory,
          }}
          breadcrumbs={breadcrumbs} tabType={tabType}
          onClose={() => {
            // Close the form SYNCHRONOUSLY so X / Cancel feel instant. Previously
            // this awaited Promise.all([fetchQuestions, refreshFullExData]) BEFORE
            // hiding the form, so on a slow network the teacher clicked X, nothing
            // moved (2 network round-trips in flight), clicked again, still nothing,
            // and only the third click seemed to work — each click was starting
            // another Promise.all chain behind the scenes.
            // State first, refresh after — the QuestionsView list refreshes as
            // the promises land; the tiny stale window is invisible in practice.
            setShowAddQuestion(false);
            setBankReviewQuestions([]);
            // Reset the auto-open flag so a subsequent Add Question click
            // starts from a clean 'manual' state instead of inheriting the
            // last-used source. Without this, `routeAddQuestion` still
            // computes autoIntent correctly, but the flag would linger for
            // any other code path that reads it.
            setNextFormAutoOpen('manual');
            // Fire refresh in the background. Errors are swallowed on close —
            // there's nothing meaningful to surface here; the next mount refetches.
            Promise.all([fetchQuestions(), refreshFullExData()]).catch(() => {});
          }}
          onSave={handleQuestionSaved} onOpenQuestionBank={() => { setShowAddQuestion(false); setShowQuestionBank(true); }}
          onOpenDocumentUpload={() => { setShowAddQuestion(false); setShowDocumentUpload(true); }}
          onMCQBankSelect={async (qs) => { setShowAddQuestion(false); await handleBankSelect(qs); }}
          showTypeSelector={isCombined} remainingQuestions={calcRemaining()} marksPerQuestion={calcMarksPerQ()}
          onEditExercise={() => {
            // Instant close — same rationale as onClose above. The refresh runs
            // in the background; onEditExercise navigates away to the settings
            // wizard so a fresh fetch on return is expected regardless.
            setShowAddQuestion(false);
            if (onEditExercise) onEditExercise(exercise);
            refreshFullExData().catch(() => {});
          }}
          shouldRefreshOnMount={true} initialBankQuestions={bankReviewQuestions}
          initialBankSource={bankSourceTag}
          autoOpenSource={nextFormAutoOpen} />
      )}

{showEditQuestionModal && editingQuestion && (
  <AddQuestionForm
    key={`edit-${editingQuestion._id}`}
    exerciseData={{
      exerciseId: exercise._id,
      exerciseName: exercise.exerciseInformation.exerciseName,
      exerciseLevel: exercise.exerciseInformation.exerciseLevel || 'intermediate',
      selectedLanguages: exercise.programmingSettings?.selectedLanguages || [],
      evaluationSettings: getEvalSettings(),
      nodeId, nodeName, subcategory, nodeType,
      fullExerciseData: { ...exercise, ...(fullExData || {}), questions, hierarchyData },
      exerciseType: exercise.exerciseType,
      programmingSettings: exercise.programmingSettings,
      subcategoryLabel: subcategory,
    }}
    tabType={tabType}
    initialData={editingQuestion}
    isEditing={true}
    initialQuestionId={editingQuestion._id}
    onClose={() => {
      // Instant close — see the AddQuestionForm onClose above for rationale.
      setShowEditQuestionModal(false);
      setEditingQuestion(null);
      fetchQuestions().catch(() => {});
    }}
    onSave={handleQuestionSaved}
    onOpenQuestionBank={() => {
      setShowEditQuestionModal(false);
      setShowQuestionBank(true);
    }}
    onEditExercise={() => {
      setShowEditQuestionModal(false);
      setShowAddQuestion(false);
      if (onEditExercise) onEditExercise(exercise);
    }}
  />
)}
      {showEditDuplicateModal && editingDuplicateQuestion && (
        <AddQuestionForm
          exerciseData={{
            exerciseId: exercise._id, exerciseName: exercise.exerciseInformation.exerciseName,
            exerciseLevel: exercise.exerciseInformation.exerciseLevel || 'intermediate',
            selectedLanguages: exercise.programmingSettings?.selectedLanguages || [], evaluationSettings: getEvalSettings(),
            nodeId, nodeName, subcategory, nodeType,
            fullExerciseData: { ...exercise, ...(fullExData || {}), hierarchyData },
            exerciseType: exercise.exerciseType, programmingSettings: exercise.programmingSettings,
          }}
          breadcrumbs={breadcrumbs} tabType={tabType}
          onClose={handleEditDupComplete} onSave={handleQuestionSaved}
          initialData={editingDuplicateQuestion} isEditing={true}
          onOpenQuestionBank={() => { setShowEditDuplicateModal(false); setShowQuestionBank(true); }} />
      )}


{showDocumentUpload && (
  <AddQuestionViaDocument
    exerciseData={{
      exerciseId:      exercise._id,
      exerciseName:    exercise.exerciseInformation.exerciseName,
      exerciseLevel:   exercise.exerciseInformation.exerciseLevel || 'intermediate',
      nodeId,
      nodeName,
      nodeType,
      subcategory,
      fullExerciseData: exercise,
    }}
    tabType={tabType}
    breadcrumbs={breadcrumbs}
    sliceRemaining={sourceRemaining ? sourceRemaining.scratch : undefined}
    onClose={() => setShowDocumentUpload(false)}
    onInserted={async (count) => {
      await fetchQuestions();
      toast.success(`${count} question${count !== 1 ? 's' : ''} added via document`);
    }}
  />
)}

      {/* Programming upload-via-document: hidden picker input + quota-capped
          selection modal. Confirmed picks feed the same review-then-save
          funnel as bank imports, stamped 'scratch-manual' (Manual quota). */}
      <input
        ref={progDocInputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={handleProgDocSelected}
      />
      {docPickerQuestions && (
        <DocQuestionPicker
          questions={docPickerQuestions}
          selectionQuota={bankSelectionQuota}
          onClose={() => setDocPickerQuestions(null)}
          onConfirm={(selected) => {
            setDocPickerQuestions(null);
            setNextFormAutoOpen('manual');
            setBankReviewQuestions(selected as any);
            setShowAddQuestion(true);
          }}
        />
      )}



      <DuplicateConfirmationDialog />

      {previewQuestion && (
        <QuestionPreview question={previewQuestion} allQuestions={filteredQs}
          onClose={() => setPreviewQuestion(null)} onNavigate={q => setPreviewQuestion(q)} />
      )}

      {/* ── Delete Modal ── */}
      {showDeleteQuestionModal && questionToDelete && (
        <>
          <Backdrop zIndex={60} />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              style={{ ...JKT, border: '1px solid #e4e4ed', pointerEvents: 'auto', boxShadow: '0 20px 60px rgba(26,26,46,0.18)' }}>
              <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid #fee2e2', background: 'linear-gradient(135deg,#fff5f5,#fff)' }}>
                <div className="p-2 bg-red-100 rounded-xl"><Trash2 className="h-4 w-4 text-red-600" /></div>
                <div>
                  <h3 className="text-[13px] font-bold" style={{ color: '#1a1a2e' }}>Delete Question</h3>
                  <p className="text-[11px]" style={{ color: '#8b8b9e' }}>This action cannot be undone</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-[12px] mb-3" style={{ color: '#6b6b7e' }}>Are you sure you want to permanently delete this question?</p>
                <div className="p-3 rounded-xl" style={{ background: '#fafafa', border: '1px solid #e4e4ed' }}>
                  <p className="text-[12px] font-semibold truncate" style={{ color: '#1a1a2e' }}>"{getTitle(questionToDelete)}"</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <TypeBadge type={questionToDelete.questionType} />
                    <DiffBadge level={getDiff(questionToDelete)} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 px-4 pb-4">
                <button onClick={() => { setShowDeleteQuestionModal(false); setQuestionToDelete(null); }}
                  disabled={deletingQuestion}
                  className="flex-1 py-2 text-[12px] rounded-xl transition-all disabled:opacity-50"
                  style={{ ...JKT, border: '1.5px solid #e4e4ed', color: '#6b6b7e', background: '#fff', cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fafafa'; e.currentTarget.style.borderColor = '#d0d0de'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e4e4ed'; }}>
                  Cancel
                </button>
                <button onClick={handleDeleteConfirm} disabled={deletingQuestion}
                  className="flex-1 py-2 text-[12px] font-semibold text-white rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-70 transition-all"
                  style={{ ...JKT, background: '#ef4444', cursor: deletingQuestion ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (!deletingQuestion) e.currentTarget.style.background = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}>
                  {deletingQuestion ? <><Loader className="h-3 w-3 animate-spin" />Deleting…</> : <><Trash2 className="h-3 w-3" />Delete Question</>}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {showProgrammingForm && selectedProgrammingQuestion && (
  <ProgrammingQuestionForm
    exerciseData={{
      exerciseId: exercise._id,
      exerciseName: exercise.exerciseInformation.exerciseName,
      exerciseLevel: exercise.exerciseInformation.exerciseLevel || 'intermediate',
      nodeId,
      nodeName,
      subcategory,
      nodeType,
      fullExerciseData: exercise,
      exerciseType: exercise.exerciseType,
      programmingSettings: exercise.programmingSettings,
    }}
    tabType={tabType}
    initialData={selectedProgrammingQuestion}
    isEditing={false}
    onClose={() => {
      setShowProgrammingForm(false);
      setSelectedProgrammingQuestion(null);
    }}
    onSave={async (savedData) => {
      await fetchQuestions();
      setShowProgrammingForm(false);
      setSelectedProgrammingQuestion(null);
      toast.success('Programming question added successfully!');
      return savedData;
    }}
    isSaving={false}
    saveProgress={0}
    saveMessage=""
    onEditExercise={onEditExercise}
    sectionData={null}
  />
)}
    </div>
  );
};

export default Questions;