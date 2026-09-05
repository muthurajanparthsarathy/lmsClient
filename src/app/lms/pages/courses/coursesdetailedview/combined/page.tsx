"use client";
import { getToken } from "@/lib/session";

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Loader2, CheckCircle, FileText, Code, XCircle, Monitor, Database,
  Flag, ChevronLeft, ChevronRight, Timer, AlertCircle, PanelRightClose, PanelRightOpen,
} from 'lucide-react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import dynamic from 'next/dynamic';
import ExerciseInfoModals, { ExerciseInfoButtons } from '@/app/lms/component/student/ExerciseInfoModals';
import { Loading } from '@/components/loading-ui/loading';

const MCQQuestion = dynamic(() => import('./mcq'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"><Loading size="size-8" color="blue" /></div>,
});
const ProgrammingQuestion = dynamic(() => import('./program-section'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"><Loading size="size-8" color="blue" /></div>,
});
const FrontendQuestion = dynamic(() => import('./frontend'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"><Loading size="size-8" color="blue" /></div>,
});
const SqlEditor = dynamic(() => import('./sql'), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center"><Loading size="size-8" color="blue" /></div>,
});

// ── Design tokens (matches mcq.tsx) ─────────────────────────────────────────
const T = {
  orange: '#F27757',
  orangeDark: '#E0623F',
  orangeGlow: 'rgba(242,119,87,0.22)',
  orangeLight: 'rgba(242,119,87,0.08)',
  textMain: '#1a1a2e',
  textSub: '#6b6b7e',
  textMuted: '#9b9bae',
  textHint: '#bcbccc',
  border: '#eaeaef',
  borderLight: '#f4f4f7',
  bg: '#ffffff',
  pageBg: '#f9f9fb',
  green: '#22c55e',
  greenLight: 'rgba(34,197,94,0.09)',
  greenDark: '#16a34a',
  red: '#ef4444',
  redLight: 'rgba(239,68,68,0.09)',
  amber: '#f59e0b',
  amberLight: 'rgba(245,158,11,0.09)',
  blue: '#3b82f6',
  blueLight: 'rgba(59,130,246,0.09)',
  purple: '#8b5cf6',
  purpleLight: 'rgba(139,92,246,0.09)',
} as const;

const TOP_BAR_H = 56;
const BOTTOM_BAR_H = 64;

// ── Right Panel (mirrors mcq.tsx QuestionPanel) ───────────────────────────────
const CombinedQuestionPanel = ({
  questions,
  currentIndex,
  completedQuestions,
  flaggedQuestions,
  onJump,
  timeLeft,
  totalDuration,
  onClose,
}: {
  questions: any[];
  currentIndex: number;
  completedQuestions: Set<number>;
  flaggedQuestions: Set<number>;
  onJump: (i: number) => void;
  timeLeft: number;
  totalDuration: number;
  onClose?: () => void;
}) => {
  const getStatus = (idx: number) => {
    const isCompleted = completedQuestions.has(idx);
    const isFlagged = flaggedQuestions.has(idx);
    if (idx === currentIndex) return 'current';
    if (isCompleted && isFlagged) return 'completedFlagged';
    if (isCompleted) return 'completed';
    if (isFlagged) return 'flagged';
    return 'unanswered';
  };

  const fmtTime = (s: number) => {
    if (s <= 0) return '00:00';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const timerPct = totalDuration > 0 ? Math.max(0, (timeLeft / (totalDuration * 60)) * 100) : 100;
  const timerIsDanger = totalDuration > 0 && timeLeft < 60;
  const timerIsWarning = totalDuration > 0 && timeLeft < 300 && !timerIsDanger;
  const timerCol = timerIsDanger ? T.red : timerIsWarning ? T.amber : T.green;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Timer row — Timer label/value sit in a flex column on the LEFT, X is
          a separate sibling on the RIGHT. This way the progress bar (which
          lives inside the left column) ends exactly where MM:SS ends instead
          of stretching under the close button. */}
      {(totalDuration > 0 || onClose) && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 12 }}>
          {/* Left column: Time Left header + progress bar (auto-shrinks to leave X room) */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {totalDuration > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Timer size={13} style={{ color: timerCol }} />
                    <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>Time Left</span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: timerCol, animation: timerIsDanger ? 'pulse 1s ease-in-out infinite' : 'none' }}>
                    {fmtTime(timeLeft)}
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 99, background: T.borderLight, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${timerPct}%`, background: timerCol, borderRadius: 99, transition: 'width 1s linear' }} />
                </div>
              </>
            )}
          </div>

          {/* Right: close X — sibling of the timer column so the progress bar
              ends at MM:SS and does NOT extend under this button. */}
          {onClose && (
            <button
              onClick={onClose}
              title="Close right panel"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, padding: 0, borderRadius: 5, border: `1px solid ${T.red}40`, background: 'transparent', color: T.red, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'all 0.13s' }}
            >
              <XCircle size={12} />
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', marginBottom: 10 }}>
        {[
          { v: questions.length, label: 'Total', col: T.textSub },
          { v: completedQuestions.size, label: 'Done', col: T.green },
          { v: questions.length - completedQuestions.size, label: 'Left', col: T.textMuted },
          { v: flaggedQuestions.size, label: 'Flagged', col: T.amber },
        ].map(({ v, label, col }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: col }}>{v}</span>
            <span style={{ fontSize: 11, color: T.textHint, fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: T.borderLight, marginBottom: 10 }} />
      <p style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
        {questions.length} Questions
      </p>

      {/* Question grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
        {questions.map((_, i) => {
          const status = getStatus(i);
          let bg: string = T.pageBg, col: string = T.textSub, bdr: string = T.border;
          if (status === 'current')           { bg = T.blue;        col = '#fff';       bdr = T.blue; }
          else if (status === 'completed')    { bg = T.greenLight;  col = T.greenDark;  bdr = T.green + '80'; }
          else if (status === 'flagged')      { bg = T.amberLight;  col = T.amber;      bdr = T.amber + '80'; }
          else if (status === 'completedFlagged') { bg = T.orangeLight; col = T.orange; bdr = T.orange + '80'; }
          const isFlagged = flaggedQuestions.has(i);
          return (
            <button
              key={i}
              onClick={() => onJump(i)}
              style={{ aspectRatio: '1', borderRadius: 8, border: `1.5px solid ${bdr}`, background: bg, color: col, fontSize: 12, fontWeight: 700, cursor: 'pointer', position: 'relative', fontFamily: 'inherit', transition: 'all 0.12s' }}
            >
              {i + 1}
              {isFlagged && (
                <span style={{ position: 'absolute', top: -5, right: -5, fontSize: 10, lineHeight: 1, color: T.amber, filter: 'drop-shadow(0 0 2px rgba(245,158,11,0.5))' }}>⚑</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.borderLight}`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px' }}>
        {[
          { dot: T.blue,   lbl: 'Current' },
          { dot: T.green,  lbl: 'Done' },
          { dot: T.amber,  lbl: 'Flagged' },
          { dot: T.orange, lbl: 'Both', op: 0.55 },
        ].map(({ dot, lbl, op }) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, opacity: op || 1, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: T.textSub }}>{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const CombinedExerciseMixed = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [exerciseData, setExerciseData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState<Set<number>>(new Set());
  const [exerciseCompleted, setExerciseCompleted] = useState(false);
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, any>>({});
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Holds the active code/sql/frontend question's own submit fn, registered by the child
  const questionSubmitRef = useRef<null | (() => void | Promise<void>)>(null);

  const exerciseId  = searchParams.get('exerciseId')  || '';
  const courseId    = searchParams.get('courseId')    || '';
  const category    = searchParams.get('category')    || '';
  const subcategory = searchParams.get('subcategory') || '';
  const nodeId      = searchParams.get('nodeId')      || '';
  const nodeName    = searchParams.get('nodeName')    || '';
  const nodeType    = searchParams.get('nodeType')    || 'exercise';
  const studentId   = searchParams.get('studentId')   || '';
  const courseName  = searchParams.get('courseName')  || '';
  const hierarchy   = searchParams.get('hierarchy')   || '';
  const exerciseName = searchParams.get('exerciseName') || '';

  // ── helpers ────────────────────────────────────────────────────────────────
  const isFrontendModule = () => exerciseData?.programmingSettings?.selectedModule === 'Frontend';

  const getQuestionType = (question: any) => {
    if (isFrontendModule() && question.questionType === 'programming') return 'frontend';
    if (question.questionType === 'programming' && question.solutions?.language === 'sql') return 'sql';
    return question.questionType;
  };

  const processQuestions = (questions: any[]) => {
    if (!questions || !exerciseData) return questions;
    return questions.map((q: any) => ({ ...q, _processedType: getQuestionType(q) }));
  };

  const processedQuestions = exerciseData ? processQuestions(exerciseData.questions || []) : [];
  const totalQuestions = processedQuestions.length;

  // ── timer ──────────────────────────────────────────────────────────────────
  const startTimer = (duration: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(duration * 60);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchExerciseData = async () => {
      try {
        setIsLoading(true);
        if (!exerciseId) throw new Error('Exercise ID is required');
        const token = getToken() || localStorage.getItem('token') || '';
        if (!token) throw new Error('Authentication token not found');

        const response = await fetch(`http://localhost:5533/exercise/${exerciseId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data.message?.[0]?.key === 'success' && data.data?.exercise) {
          const ex = data.data.exercise;
          if (ex.exerciseType !== 'Combined') throw new Error(`Not a Combined exercise. Type: ${ex.exerciseType}`);
          setExerciseData(ex);

          const dur = ex.exerciseInformation?.totalDuration || 0;
          setTotalDuration(dur);
          if (dur > 0) startTimer(dur);

          const savedFlagged = localStorage.getItem(`combined_flagged_${exerciseId}`);
          if (savedFlagged) {
            try { setFlaggedQuestions(new Set(JSON.parse(savedFlagged))); } catch {}
          }
        } else {
          throw new Error(data.message?.[0]?.value || 'Failed to load exercise data');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load exercise from server');
        toast.error(err.message || 'Failed to load exercise');
      } finally {
        setIsLoading(false);
      }
    };

    if (exerciseId) fetchExerciseData();
    else { setError('Exercise ID is missing'); setIsLoading(false); }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [exerciseId]);

  useEffect(() => {
    if (!exerciseId) return;
    if (flaggedQuestions.size > 0)
      localStorage.setItem(`combined_flagged_${exerciseId}`, JSON.stringify([...flaggedQuestions]));
    else
      localStorage.removeItem(`combined_flagged_${exerciseId}`);
  }, [flaggedQuestions, exerciseId]);

  // ── handlers ───────────────────────────────────────────────────────────────
  // Return to the EXACT spot: re-open the same node + tab + activity (exercise list).
  const goToExerciseList = () => {
    if (!courseId) { router.back(); return; }
    const method = category === 'We_Do' ? 'we-do' : category === 'I_Do' ? 'i-do' : category === 'You_Do' ? 'you-do' : '';
    const qp = new URLSearchParams();
    if (nodeId) qp.set('restoreNodeId', nodeId);
    if (method) qp.set('method', method);
    if (subcategory) qp.set('activity', subcategory);
    router.push(`/lms/pages/courses/coursesdetailedview/${courseId}?${qp.toString()}`);
  };
  const handleBack = () => goToExerciseList();

  const handleNextQuestion = () => {
    questionSubmitRef.current = null; // active child unmounts/changes; drop its submit
    if (currentQuestionIndex < processedQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      setExerciseCompleted(true);
      toast.success('All questions completed!');
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      questionSubmitRef.current = null;
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleJumpToQuestion = (index: number) => {
    if (index >= 0 && index < processedQuestions.length) {
      questionSubmitRef.current = null;
      setCurrentQuestionIndex(index);
    }
  };

  const toggleFlag = () => {
    setFlaggedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(currentQuestionIndex)) {
        next.delete(currentQuestionIndex);
        toast.info('Question unmarked for review');
      } else {
        next.add(currentQuestionIndex);
        toast.info('Question marked for review');
      }
      return next;
    });
  };

  const handleMcqAnswer = (questionId: string, answer: any) => {
    setMcqAnswers(prev => ({ ...prev, [questionId]: answer }));
    setCompletedQuestions(prev => new Set([...prev, currentQuestionIndex]));
  };

  const handleProgrammingComplete = () => setCompletedQuestions(prev => new Set([...prev, currentQuestionIndex]));
  const handleFrontendComplete = () => setCompletedQuestions(prev => new Set([...prev, currentQuestionIndex]));
  const handleSqlComplete = () => setCompletedQuestions(prev => new Set([...prev, currentQuestionIndex]));

  const submitCurrentMcqAnswer = async () => {
    const currentQuestion = processedQuestions[currentQuestionIndex];
    if (!currentQuestion) return;
    const answer = mcqAnswers[currentQuestion._id];
    if (!answer) { toast.error('Please select an answer first'); return; }

    try {
      const token = getToken() || localStorage.getItem('token') || '';
      const formData = new FormData();
      formData.append('courseId', courseId);
      formData.append('exerciseId', exerciseId);
      formData.append('questionId', currentQuestion._id);
      formData.append('category', category);
      formData.append('subcategory', subcategory);
      formData.append('nodeId', nodeId);
      formData.append('nodeName', nodeName || exerciseData?.exerciseInformation?.exerciseName || 'Combined Exercise');
      formData.append('nodeType', nodeType);
      formData.append('code', answer?.text || answer?.optionText || '');
      formData.append('score', '0');
      formData.append('status', 'attempted');
      formData.append('language', 'text');

      const response = await fetch('http://localhost:5533/courses/answers/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (response.ok) {
        setCompletedQuestions(prev => new Set([...prev, currentQuestionIndex]));
        handleNextQuestion();
      } else {
        throw new Error('Failed to submit answer');
      }
    } catch {
      toast.error('Failed to save answer');
    }
  };

  const handleSubmitQuestion = async () => {
    const currentQuestion = processedQuestions[currentQuestionIndex];
    if (!currentQuestion) return;

    const qType = currentQuestion._processedType || currentQuestion.questionType;
    if (qType === 'mcq') {
      // MCQ saves the answer (status 'attempted') then advances — no isTestSubmission.
      await submitCurrentMcqAnswer();
    } else if (questionSubmitRef.current) {
      // Programming / Frontend / SQL run their own submit (status 'submitted', no
      // isTestSubmission) which itself marks complete + advances on success.
      await questionSubmitRef.current();
    } else {
      // Fallback: just mark complete and advance.
      setCompletedQuestions(prev => new Set([...prev, currentQuestionIndex]));
      handleNextQuestion();
    }
  };

  const submitSqlAnswer = async (query: string, result: any) => {
    try {
      const currentQuestion = processedQuestions[currentQuestionIndex];
      if (!currentQuestion) return;
      const token = getToken() || localStorage.getItem('token') || '';
      if (!token) { toast.error('Please login to submit'); return; }
      if (!query.trim()) { toast.warning('Please write a SQL query first'); return; }

      const files = [{
        id: `sql-file-${Date.now()}`, filename: 'query.sql', content: query, language: 'sql',
        path: '/query.sql', folderPath: '/', isEntryPoint: true,
        lastModified: new Date().toISOString(), size: Buffer.byteLength(query, 'utf8'),
      }];

      const response = await fetch('http://localhost:5533/courses/answers/submit-multiple-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          courseId, exerciseId, questionId: currentQuestion._id,
          questionTitle: currentQuestion.title || 'SQL Question',
          exerciseName: exerciseData?.exerciseInformation?.exerciseName || 'SQL Exercise',
          category, subcategory, selectedProgrammingLanguage: 'sql',
          nodeId, nodeName, nodeType, files, folders: [], status: 'submitted', score: 0,
          attemptCount: 1, queryResult: result || null, studentId: studentId || 'unknown_student',
          projectStructure: { totalFiles: 1, sqlFiles: 1, entryPoints: ['query.sql'], folderCount: 0, hasFolders: false, fileDistribution: { sql: 1 } },
        }),
      });
      const data = await response.json();
      if (data.success) {
        handleSqlComplete();
        handleNextQuestion();
      } else {
        throw new Error(data.message || 'Submission failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit SQL answer');
    }
  };

  // ── Auto-submit when the timer expires.
  //    No confirmation dialog — when time hits 00:00 we just submit and
  //    redirect back to where the student clicked Start (module → topic →
  //    method tab → activity list), exactly the same path as manual submit.
  //    Guarded by `autoSubmitFiredRef` so we never submit twice even if the
  //    effect re-runs (e.g. React strict mode double-invoke). ─────────────────
  const autoSubmitFiredRef = useRef(false);
  useEffect(() => {
    if (autoSubmitFiredRef.current) return;
    if (isTestSubmitted) return;
    if (totalDuration <= 0) return;     // exercise has no time limit
    if (timeLeft !== 0) return;          // not at 00:00 yet
    autoSubmitFiredRef.current = true;
    try { sessionStorage.setItem('lms_submit_toast', `Time's up — "${exerciseName || exerciseData?.exerciseInformation?.exerciseName || 'Exercise'}" auto-submitted`); } catch {}
    toast.info("Time's up — submitting your exercise…");
    // Close the confirm dialog if it happened to be open
    setShowSubmitConfirm(false);
    handleFinalTestSubmission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, totalDuration, isTestSubmitted]);

  // ── Submit the whole exercise. THIS is the only place isTestSubmission='true'
  //    is sent, so it's the only action that flips the exercise to "Submitted"
  //    in exercises.tsx. Submit Question never sends that flag. ──────────────
  const handleFinalTestSubmission = async () => {
    if (isTestSubmitted) return;
    try {
      const token = getToken() || localStorage.getItem('token') || '';
      const lastQuestion = processedQuestions[processedQuestions.length - 1];
      const formData = new FormData();
      formData.append('courseId', courseId);
      formData.append('exerciseId', exerciseId);
      formData.append('questionId', lastQuestion._id);
      formData.append('code', '');
      formData.append('score', '0');
      formData.append('status', 'submitted');
      formData.append('category', category);
      formData.append('subcategory', subcategory);
      formData.append('nodeId', nodeId);
      formData.append('nodeName', nodeName);
      formData.append('nodeType', nodeType);
      formData.append('language', 'text');
      formData.append('isTestSubmission', 'true'); // ← THE KEY FLAG (Submit Exercise only)

      const response = await fetch('http://localhost:5533/courses/answers/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      if (response.ok) {
        setIsTestSubmitted(true);
        if (timerRef.current) clearInterval(timerRef.current);
        if (exerciseId) localStorage.removeItem(`combined_flagged_${exerciseId}`);
        try { sessionStorage.setItem('lms_submit_toast', `"${exerciseName || exerciseData?.exerciseInformation?.exerciseName || 'Exercise'}" submitted successfully`); } catch {}
        // Go straight back to the exercises list — its Start button now shows "Submitted".
        setTimeout(() => goToExerciseList(), 800);
      } else {
        throw new Error('Final submission failed');
      }
    } catch {
      toast.error('Failed to submit exercise. Please try again.');
    }
  };

  // ── Submit Exercise confirmation dialog (shared by header + completion screen) ──
  const unansweredCount = Math.max(0, totalQuestions - completedQuestions.size);
  const submitConfirmDialog = showSubmitConfirm ? (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setShowSubmitConfirm(false); }}
    >
      <div style={{ background: T.bg, borderRadius: 16, width: '100%', maxWidth: 400, overflow: 'hidden', boxShadow: '0 20px 56px rgba(0,0,0,0.18)', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: T.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={18} style={{ color: T.orange }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: T.textMain, margin: 0 }}>Submit Exercise?</h3>
            <p style={{ fontSize: 12, color: T.textMuted, margin: '2px 0 0' }}>This finalizes your submission and can't be undone.</p>
          </div>
        </div>
        <div style={{ padding: '16px 22px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: completedQuestions.size, label: 'Answered', col: T.green },
              { v: unansweredCount, label: 'Unanswered', col: T.textMuted },
              { v: flaggedQuestions.size, label: 'Flagged', col: T.amber },
            ].map(({ v, label, col }) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: T.pageBg, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{v}</div>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
          {unansweredCount > 0 && (
            <p style={{ fontSize: 12, color: T.textSub, margin: '14px 0 0', lineHeight: 1.5 }}>
              You still have <b>{unansweredCount}</b> unanswered question{unansweredCount > 1 ? 's' : ''}. You can submit now, but those won't be graded.
            </p>
          )}
        </div>
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowSubmitConfirm(false)}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Keep working
          </button>
          <button
            onClick={() => { setShowSubmitConfirm(false); handleFinalTestSubmission(); }}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: T.green, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 3px 14px rgba(34,197,94,0.25)' }}
          >
            <CheckCircle size={15} /> Submit Exercise
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── loading / error ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-orange-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Combined Exercise…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Unable to Load Exercise</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={handleBack} className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700 w-full">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!exerciseData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">No Exercise Data</h2>
          <button onClick={handleBack} className="bg-orange-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-700">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── completion screen ──────────────────────────────────────────────────────
  if (exerciseCompleted) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <ToastContainer position="top-right" />
        {submitConfirmDialog}
        <div style={{ textAlign: 'center', maxWidth: 360, width: '100%' }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, margin: '0 auto 24px', background: isTestSubmitted ? T.greenLight : T.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={36} style={{ color: isTestSubmitted ? T.green : T.orange }} />
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 800, color: T.textMain, marginBottom: 10 }}>
            {isTestSubmitted ? 'Exercise Submitted!' : 'All Done!'}
          </h2>
          <p style={{ fontSize: 14, color: T.textSub, marginBottom: 32, lineHeight: 1.6 }}>
            {isTestSubmitted
              ? 'Your exercise has been submitted successfully.'
              : `You have answered all ${totalQuestions} questions. Submit your exercise to finalize.`}
          </p>

          {!isTestSubmitted && (
            <button
              onClick={() => setShowSubmitConfirm(true)}
              style={{ padding: '14px 36px', borderRadius: 14, background: T.green, color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(34,197,94,0.3)', width: '100%', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <CheckCircle size={18} /> Submit Exercise
            </button>
          )}

          <button
            onClick={handleBack}
            style={{ padding: '12px 28px', borderRadius: 12, background: 'transparent', color: T.textSub, fontSize: 14, fontWeight: 600, border: `1.5px solid ${T.border}`, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
          >
            Return to Course
          </button>
        </div>
      </div>
    );
  }

  // ── derived values ─────────────────────────────────────────────────────────
  const currentQuestion = processedQuestions[currentQuestionIndex];
  if (!currentQuestion) return null;

  const questionType = currentQuestion._processedType || currentQuestion.questionType;
  const isMcqQuestion         = questionType === 'mcq';
  const isProgrammingQuestion = questionType === 'programming';
  const isFrontendQuestion    = questionType === 'frontend';
  const isSqlQuestion         = questionType === 'sql';
  const isCurrentFlagged = flaggedQuestions.has(currentQuestionIndex);
  const isLastQuestion = currentQuestionIndex === totalQuestions - 1;
  const hasMcqAnswer = !!mcqAnswers[currentQuestion._id];

  // Q-type info for non-MCQ meta row
  const getQTypeInfo = (type: string) => {
    switch (type) {
      case 'programming': return { icon: Code, color: T.greenDark, bg: T.greenLight, label: 'Programming' };
      case 'frontend':    return { icon: Monitor, color: T.purple, bg: T.purpleLight, label: 'Frontend' };
      case 'sql':         return { icon: Database, color: T.orange, bg: T.orangeLight, label: 'SQL' };
      default:            return { icon: FileText, color: T.textSub, bg: T.pageBg, label: 'Question' };
    }
  };
  const qTypeInfo = getQTypeInfo(questionType);
  const QTypeIcon = qTypeInfo.icon;

  // Breadcrumb — minimal inline, like mcq.tsx
  const makeBreadcrumbs = () => {
    const items: { label: string; active?: boolean }[] = [];
    if (courseName && courseName !== 'undefined') items.push({ label: courseName });
    if (hierarchy && hierarchy !== 'undefined') {
      hierarchy.split(',').forEach(n => { if (n.trim()) items.push({ label: n.trim() }); });
    }
    if (category && category !== 'undefined') items.push({ label: category.replace(/_/g, ' ') });
    if (subcategory && subcategory !== 'undefined') items.push({ label: subcategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) });
    const name = exerciseName || exerciseData?.exerciseInformation?.exerciseName;
    if (name) items.push({ label: name, active: true });
    return items;
  };
  const breadcrumbs = makeBreadcrumbs();

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: T.pageBg,
      fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
      color: T.textMain,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.45;} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);} }
        .comb-s::-webkit-scrollbar { width: 7px; }
        .comb-s::-webkit-scrollbar-track { background: #e4e4ed; border-radius: 99px; }
        .comb-s::-webkit-scrollbar-thumb { background: #9b9bae; border-radius: 99px; }
        .comb-s::-webkit-scrollbar-thumb:hover { background: #6b6b7e; }
        .btn-prev:hover:not(:disabled) { border-color: ${T.orange}!important; color: ${T.orange}!important; }
        .btn-next:hover { filter: brightness(1.06); }
        .btn-skip:hover:not(:disabled) { border-color: ${T.orange}!important; color: ${T.orange}!important; }
      `}</style>

      <ToastContainer position="top-right" />

      {submitConfirmDialog}

      {/* Exercise Info + Score/Question Overview modals (reflect both MCQ & programming) */}
      <ExerciseInfoModals
        exercise={exerciseData}
        showDetailsModal={showDetailsModal}
        setShowDetailsModal={setShowDetailsModal}
        showOverviewModal={showOverviewModal}
        setShowOverviewModal={setShowOverviewModal}
        solvedQuestions={completedQuestions}
      />

      {/* ═══ TOP BAR ═══ */}
      <div style={{ flexShrink: 0, height: TOP_BAR_H, background: T.bg, borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', zIndex: 50 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', gap: 12 }}>

          {/* Left: breadcrumb (back button intentionally removed — students leave
              via Submit Exercise so they don't accidentally lose progress). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, flex: 1 }}>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, overflow: 'hidden' }}>
              {breadcrumbs.map((b, i, arr) => (
                <React.Fragment key={i}>
                  <span style={{ fontSize: 12, fontWeight: b.active ? 700 : 500, color: b.active ? T.orange : T.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: b.active ? 200 : 120 }}>
                    {b.label}
                  </span>
                  {i < arr.length - 1 && (
                    <ChevronRight size={12} style={{ color: T.border, margin: '0 5px', flexShrink: 0 }} />
                  )}
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Center: Exercise Info + Score/Question Overview buttons
              + compact timer (only when right sidebar is hidden) + sidebar toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, gap: 8 }}>
            <ExerciseInfoButtons
              onDetailsClick={() => setShowDetailsModal(true)}
              onOverviewClick={() => setShowOverviewModal(true)}
              isGraded={exerciseData?.isGraded !== false}
              detailsActive={showDetailsModal}
              overviewActive={showOverviewModal}
            />

            {/* Compact timer — shows ONLY when the right sidebar is collapsed,
                so the student still sees the clock without the full panel. */}
            {!showRightSidebar && totalDuration > 0 && (() => {
              const isDanger = timeLeft < 60;
              const isWarn = timeLeft < 300 && !isDanger;
              const col = isDanger ? T.red : isWarn ? T.amber : T.green;
              const fmt = (s: number) => {
                if (s <= 0) return '00:00';
                const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
                if (h > 0) return `${h}h ${m}m`;
                return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
              };
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: `1px solid ${col}40`, background: isDanger ? T.amberLight : 'transparent' }}>
                  <Timer size={12} style={{ color: col }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 800, color: col, animation: isDanger ? 'pulse 1s ease-in-out infinite' : 'none' }}>
                    {fmt(timeLeft)}
                  </span>
                </div>
              );
            })()}

            {/* Toggle right sidebar — styled to match Score Overview button exactly */}
            <button
              onClick={() => setShowRightSidebar(v => !v)}
              title={showRightSidebar ? 'Hide Question Navigator' : 'Show Question Navigator'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textSub, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.13s' }}
            >
              {showRightSidebar
                ? <PanelRightClose style={{ width: 13, height: 13 }} />
                : <PanelRightOpen style={{ width: 13, height: 13 }} />}
              {showRightSidebar ? 'Hide Questions' : 'Show Questions'}
            </button>
          </div>

          {/* Right: stats + submit exercise */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, justifyContent: 'flex-end' }}>
            {!isTestSubmitted ? (
              <button
                onClick={() => setShowSubmitConfirm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: 'none', background: T.green, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 14px rgba(34,197,94,0.25)', flexShrink: 0 }}
              >
                <CheckCircle size={14} /> Submit Exercise
              </button>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 10, background: T.greenLight, color: T.greenDark, fontSize: 13, fontWeight: 700, border: `1px solid ${T.green}30` }}>
                <CheckCircle size={14} /> Submitted
              </span>
            )}
          </div>
        </div>

      </div>

      {/* ═══ BODY ═══ */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>

        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Q-meta row — now shown ONLY for SQL. MCQ, Frontend, and Programming
              each render their own Q-number + Flag in their question's header
              (saves the wasted 52px above the editor). */}
          {!isMcqQuestion && !isFrontendQuestion && !isProgrammingQuestion && (
            <div style={{ flexShrink: 0, height: 52, background: T.bg, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', gap: 10, zIndex: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                  <span style={{ fontSize: 10, color: T.textHint, fontWeight: 700, letterSpacing: '0.05em' }}>Q</span>
                  <span style={{ fontSize: 26, fontWeight: 900, color: T.orange, lineHeight: 1, letterSpacing: '-0.03em', margin: '0 2px' }}>{currentQuestionIndex + 1}</span>
                  <span style={{ fontSize: 12, color: T.textHint }}>/{totalQuestions}</span>
                </div>
                <div style={{ width: 1, height: 18, background: T.border }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, background: qTypeInfo.bg }}>
                  <QTypeIcon size={11} style={{ color: qTypeInfo.color }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: qTypeInfo.color }}>{qTypeInfo.label}</span>
                </div>
              </div>
              <button
                onClick={toggleFlag}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${isCurrentFlagged ? T.amber : T.border}`, background: isCurrentFlagged ? T.amberLight : 'transparent', color: isCurrentFlagged ? T.amber : T.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s' }}
              >
                <Flag size={12} fill={isCurrentFlagged ? T.amber : 'none'} />
                {isCurrentFlagged ? 'Flagged' : 'Flag'}
              </button>
            </div>
          )}

          {/* Question content */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {isMcqQuestion ? (
              <MCQQuestion
                key={currentQuestion._id}
                question={currentQuestion}
                selectedAnswer={mcqAnswers[currentQuestion._id]}
                onAnswerSelect={(answer) => handleMcqAnswer(currentQuestion._id, answer)}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={totalQuestions}
                isFlagged={isCurrentFlagged}
                onFlagToggle={(isFlagged) => {
                  setFlaggedQuestions(prev => {
                    const next = new Set(prev);
                    if (isFlagged) next.add(currentQuestionIndex);
                    else next.delete(currentQuestionIndex);
                    return next;
                  });
                }}
              />
            ) : isProgrammingQuestion ? (
              <ProgrammingQuestion
                key={currentQuestion._id}
                question={currentQuestion}
                courseId={courseId}
                exerciseId={exerciseId}
                category={category}
                subcategory={subcategory}
                nodeId={nodeId}
                nodeName={nodeName}
                nodeType={nodeType}
                studentId={studentId}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={totalQuestions}
                isFlagged={isCurrentFlagged}
                onFlagToggle={toggleFlag}
                isGraded={exerciseData?.isGraded !== false}
                onComplete={() => handleProgrammingComplete()}
                onNext={handleNextQuestion}
                isLastQuestion={isLastQuestion}
                registerSubmit={(fn) => { questionSubmitRef.current = fn; }}
              />
            ) : isFrontendQuestion ? (
              <FrontendQuestion
                key={currentQuestion._id}
                question={currentQuestion}
                courseId={courseId}
                exerciseId={exerciseId}
                category={category}
                subcategory={subcategory}
                nodeId={nodeId}
                nodeName={nodeName}
                nodeType={nodeType}
                studentId={studentId}
                questionNumber={currentQuestionIndex + 1}
                totalQuestions={totalQuestions}
                isFlagged={isCurrentFlagged}
                onFlagToggle={toggleFlag}
                onComplete={() => handleFrontendComplete()}
                onNext={handleNextQuestion}
                isLastQuestion={isLastQuestion}
                registerSubmit={(fn) => { questionSubmitRef.current = fn; }}
              />
            ) : isSqlQuestion ? (
              <div className="h-full">
                <SqlEditor
                  key={currentQuestion._id}
                  question={currentQuestion}
                  courseId={courseId}
                  category={category}
                  subcategory={subcategory}
                  nodeId={nodeId}
                  nodeName={nodeName}
                  nodeType={nodeType}
                  studentId={studentId}
                  initialQuery={currentQuestion.starterCode || currentQuestion.solutions?.startedCode || `-- ${currentQuestion.description || 'Write your SQL query here'}\n\n`}
                  theme="light"
                  showSubmitButton={true}
                  submitLabel="Submit Answer"
                  showDatabaseControls={true}
                  onSubmit={submitSqlAnswer}
                  registerSubmit={(fn) => { questionSubmitRef.current = fn; }}
                />
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <FileText size={48} style={{ color: T.textHint, margin: '0 auto 16px' }} />
                  <p style={{ fontSize: 14, color: T.textMuted }}>Unknown question type</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — collapsible. The toggle button lives in the top bar
            (next to Score Overview); when hidden, a compact timer appears there
            so the student can still see the clock. */}
        {showRightSidebar && (
        <div
          className="comb-s"
          style={{ flexShrink: 0, width: 270, minHeight: 0, borderLeft: `1px solid ${T.border}`, background: T.bg, overflowY: 'auto', padding: '16px 14px 20px 14px' }}
        >
          <CombinedQuestionPanel
            questions={processedQuestions}
            currentIndex={currentQuestionIndex}
            completedQuestions={completedQuestions}
            flaggedQuestions={flaggedQuestions}
            onJump={handleJumpToQuestion}
            timeLeft={timeLeft}
            totalDuration={totalDuration}
            onClose={() => setShowRightSidebar(false)}
          />
        </div>
        )}
      </div>

      {/* ═══ BOTTOM NAV BAR ═══ */}
      <div style={{ flexShrink: 0, height: BOTTOM_BAR_H, background: T.bg, borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10, zIndex: 50 }}>

        {/* Step dots — left/flex */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
          {processedQuestions.slice(
            Math.max(0, currentQuestionIndex - 4),
            Math.min(totalQuestions, currentQuestionIndex + 5)
          ).map((_, relIdx) => {
            const absIdx = Math.max(0, currentQuestionIndex - 4) + relIdx;
            const isCurr = absIdx === currentQuestionIndex;
            const isDone = completedQuestions.has(absIdx);
            return (
              <button
                key={absIdx}
                onClick={() => handleJumpToQuestion(absIdx)}
                style={{ width: isCurr ? 18 : 6, height: 6, borderRadius: 99, background: isCurr ? T.orange : isDone ? T.green : T.border, border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0, flexShrink: 0 }}
              />
            );
          })}
        </div>

        {/* Previous — next to Next */}
        <button
          onClick={handlePreviousQuestion}
          disabled={currentQuestionIndex === 0}
          className="btn-prev"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: currentQuestionIndex === 0 ? T.textHint : T.textSub, fontSize: 12, fontWeight: 600, cursor: currentQuestionIndex === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.13s', flexShrink: 0 }}
        >
          <ChevronLeft size={13} /> Previous
        </button>

        {/* Skip (Next without submitting) */}
        <button
          onClick={handleNextQuestion}
          disabled={isLastQuestion}
          className="btn-skip"
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 7, border: `1px solid ${T.border}`, background: 'transparent', color: isLastQuestion ? T.textHint : T.textSub, fontSize: 12, fontWeight: 600, cursor: isLastQuestion ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.13s', flexShrink: 0, marginRight: 16 }}
        >
          Next <ChevronRight size={13} />
        </button>

        {/* Submit Question — primary action */}
        <button
          onClick={handleSubmitQuestion}
          disabled={isMcqQuestion && !hasMcqAnswer}
          className="btn-next"
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, border: 'none', background: (isMcqQuestion && !hasMcqAnswer) ? T.pageBg : T.orange, color: (isMcqQuestion && !hasMcqAnswer) ? T.textHint : '#fff', fontSize: 12, fontWeight: 700, cursor: (isMcqQuestion && !hasMcqAnswer) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.13s', boxShadow: (isMcqQuestion && !hasMcqAnswer) ? 'none' : `0 2px 8px ${T.orangeGlow}`, flexShrink: 0 }}
        >
          {isMcqQuestion && !hasMcqAnswer
            ? <><AlertCircle size={12} /> Select Answer</>
            : isLastQuestion
              ? <><CheckCircle size={12} /> Submit Question</>
              : <>Submit Question <ChevronRight size={13} /></>
          }
        </button>
      </div>
    </div>
  );
};

// Wrapper with Suspense
const CombinedExerciseMixedWrapper = () => (
  <Suspense fallback={
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-orange-600 animate-spin" />
    </div>
  }>
    <CombinedExerciseMixed />
  </Suspense>
);

export default CombinedExerciseMixedWrapper;
