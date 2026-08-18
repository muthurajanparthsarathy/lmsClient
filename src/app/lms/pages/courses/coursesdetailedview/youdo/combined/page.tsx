"use client";
import { getToken } from "@/lib/session";

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Loader2, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import CodeEditor from '@/app/lms/component/student/YouDo/assessment/components/code-editor';
import MCQ from '@/app/lms/component/student/YouDo/assessment/components/mcq';
import FrontendCompiler from '@/app/lms/component/student/YouDo/assessment/components/frontendCompiler';
import DbQueryEditor from '@/app/lms/component/student/YouDo/assessment/components/db-queryEditor';

// ── Embedded wrappers (CSS transform traps position:fixed children) ──────────
function EmbeddedMCQ(props: React.ComponentProps<typeof MCQ>) {
  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden", transform: "translateZ(0)" }}>
      <MCQ {...props} embedded={true} />
    </div>
  );
}

function EmbeddedProgComp({ Comp, ...props }: { Comp: React.ComponentType<any>; [k: string]: any }) {
  return (
    <div style={{ position: "relative", height: "100%", width: "100%", overflow: "hidden", transform: "translateZ(0)" }}>
      <Comp {...props} embedded={true} />
    </div>
  );
}

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  orange: '#F27757', orangeDark: '#E0623F',
  orangeLight: 'rgba(242,119,87,0.08)',
  textMain: '#1a1a2e', textSub: '#6b6b7e', textMuted: '#9b9bae', textHint: '#bcbccc',
  border: '#eaeaef', borderLight: '#f4f4f7', bg: '#ffffff', pageBg: '#f9f9fb',
  green: '#22c55e', greenLight: 'rgba(34,197,94,0.09)', greenDark: '#16a34a',
  red: '#ef4444', amber: '#f59e0b',
  purple: '#8b5cf6',
} as const;

// ── Main Component ───────────────────────────────────────────────────────────
const CombinedExercise = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const exerciseId   = searchParams.get('exerciseId')   || '';
  const courseId     = searchParams.get('courseId')     || '';
  const category     = searchParams.get('category')     || '';
  const subcategory  = searchParams.get('subcategory')  || '';
  const nodeId       = searchParams.get('nodeId')       || '';
  const nodeName     = searchParams.get('nodeName')     || '';
  const nodeType     = searchParams.get('nodeType')     || 'exercise';
  const exerciseName = searchParams.get('exerciseName') || '';

  // ── State ──────────────────────────────────────────────────────────────────
  const [exerciseData, setExerciseData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'mcq' | 'programming'>('mcq');
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSubmitFiredRef = useRef(false);

  // ── Fetch exercise ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        if (!exerciseId) throw new Error('Exercise ID is required');
        const token = getToken() || localStorage.getItem('token') || '';
        if (!token) throw new Error('Authentication token not found');

        const res = await fetch(`http://localhost:5533/exercise/${exerciseId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const data = await res.json();

        if (data.message?.[0]?.key === 'success' && data.data?.exercise) {
          const ex = data.data.exercise;
          setExerciseData(ex);
          const dur = ex.exerciseInformation?.totalDuration || 0;
          setTotalDuration(dur);
          if (dur > 0) {
            setTimeLeft(dur * 60);
            timerRef.current = setInterval(() => {
              setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
                return prev - 1;
              });
            }, 1000);
          }
        } else {
          throw new Error(data.message?.[0]?.value || 'Failed to load exercise data');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load exercise');
        toast.error(err.message || 'Failed to load exercise');
      } finally {
        setIsLoading(false);
      }
    };

    if (exerciseId) fetchData();
    else { setError('Exercise ID is missing'); setIsLoading(false); }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [exerciseId]);

  // ── Split questions into MCQ and Programming ───────────────────────────────
  const { mcqQuestions, progQuestions } = useMemo(() => {
    const all = (exerciseData?.questions || []).filter((q: any) => q.isActive !== false);
    return {
      mcqQuestions: all.filter((q: any) => (q.questionType || '').toLowerCase() === 'mcq'),
      progQuestions: all.filter((q: any) => (q.questionType || '').toLowerCase() === 'programming'),
    };
  }, [exerciseData]);

  // Start on programming if no MCQ questions
  useEffect(() => {
    if (exerciseData && mcqQuestions.length === 0 && progQuestions.length > 0) {
      setPhase('programming');
    }
  }, [exerciseData, mcqQuestions.length, progQuestions.length]);

  // ── Build exercise objects for embedded components ─────────────────────────
  const mcqExercise = useMemo(() => {
    if (!exerciseData) return null;
    const mcqCfg = exerciseData.questionConfiguration?.mcqQuestionConfiguration || {};
    return {
      ...exerciseData,
      questions: mcqQuestions,
      exerciseInformation: {
        ...exerciseData.exerciseInformation,
        totalDuration: totalDuration,
      },
      questionConfiguration: {
        mcqQuestionConfiguration: {
          totalMcqQuestions: mcqQuestions.length,
          generalQuestionCount: mcqQuestions.length,
          marksPerQuestion: mcqCfg?.marksPerQuestion || mcqCfg?.scoreSettings?.equalDistribution || 10,
          mcqTotalMarks: exerciseData.exerciseInformation?.totalMarksMCQ || 0,
          attemptLimitEnabled: mcqCfg?.attemptLimitEnabled ?? false,
          submissionAttempts: mcqCfg?.submissionAttempts ?? 1,
          shuffleQuestions: exerciseData.securitySettings?.shuffleQuestions ?? false,
        },
      },
    };
  }, [exerciseData, mcqQuestions, totalDuration]);

  const progExercise = useMemo(() => {
    if (!exerciseData) return null;
    return {
      ...exerciseData,
      questions: progQuestions,
      exerciseInformation: exerciseData.exerciseInformation,
      questionConfiguration: exerciseData.questionConfiguration,
    };
  }, [exerciseData, progQuestions]);

  // ── Pick programming component ─────────────────────────────────────────────
  const ProgComp = useMemo(() => {
    if (!exerciseData) return CodeEditor;
    const mod = (exerciseData.programmingSettings?.selectedModule || '').toLowerCase();
    const langs = (exerciseData.programmingSettings?.selectedLanguages || []).map((l: string) => l.toLowerCase());
    if (mod === 'frontend' || langs.some((l: string) => ['html', 'css', 'javascript', 'typescript', 'react', 'jsx', 'tsx'].includes(l)))
      return FrontendCompiler;
    if (mod === 'database' || langs.some((l: string) => ['sql', 'mysql', 'postgresql', 'mongodb'].includes(l)))
      return DbQueryEditor;
    return CodeEditor;
  }, [exerciseData]);

  // ── Navigate back to exercise list ─────────────────────────────────────────
  const goToExerciseList = useCallback(() => {
    if (!courseId) { router.back(); return; }
    const method = category === 'We_Do' ? 'we-do' : category === 'I_Do' ? 'i-do' : category === 'You_Do' ? 'you-do' : '';
    const qp = new URLSearchParams();
    if (nodeId) qp.set('restoreNodeId', nodeId);
    if (method) qp.set('method', method);
    if (subcategory) qp.set('activity', subcategory);
    router.push(`/lms/pages/courses/coursesdetailedview/${courseId}?${qp.toString()}`);
  }, [courseId, category, nodeId, subcategory, router]);

  // ── Final test submission ──────────────────────────────────────────────────
  const handleFinalSubmit = useCallback(async () => {
    if (isTestSubmitted) return;
    try {
      const token = getToken() || localStorage.getItem('token') || '';
      const allQuestions = [...mcqQuestions, ...progQuestions];
      const lastQ = allQuestions[allQuestions.length - 1];
      const fd = new FormData();
      fd.append('courseId', courseId);
      fd.append('exerciseId', exerciseId);
      fd.append('questionId', lastQ?._id || exerciseId);
      fd.append('code', '');
      fd.append('score', '0');
      fd.append('status', 'submitted');
      fd.append('category', category);
      fd.append('subcategory', subcategory);
      fd.append('nodeId', nodeId);
      fd.append('nodeName', nodeName);
      fd.append('nodeType', nodeType);
      fd.append('language', 'text');
      fd.append('isTestSubmission', 'true');

      const res = await fetch('http://localhost:5533/courses/answers/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });
      if (res.ok) {
        setIsTestSubmitted(true);
        if (timerRef.current) clearInterval(timerRef.current);
        try {
          sessionStorage.setItem('lms_submit_toast',
            `"${exerciseName || exerciseData?.exerciseInformation?.exerciseName || 'Exercise'}" submitted successfully`);
        } catch {}
        setTimeout(() => goToExerciseList(), 800);
      } else {
        throw new Error('Final submission failed');
      }
    } catch {
      toast.error('Failed to submit exercise. Please try again.');
    }
  }, [isTestSubmitted, mcqQuestions, progQuestions, courseId, exerciseId, category, subcategory, nodeId, nodeName, nodeType, exerciseName, exerciseData, goToExerciseList]);

  // ── Auto-submit on timer expiry ────────────────────────────────────────────
  useEffect(() => {
    if (autoSubmitFiredRef.current) return;
    if (isTestSubmitted) return;
    if (totalDuration <= 0) return;
    if (timeLeft !== 0) return;
    autoSubmitFiredRef.current = true;
    try {
      sessionStorage.setItem('lms_submit_toast',
        `Time's up — "${exerciseName || exerciseData?.exerciseInformation?.exerciseName || 'Exercise'}" auto-submitted`);
    } catch {}
    toast.info("Time's up — submitting your exercise…");
    setShowSubmitConfirm(false);
    handleFinalSubmit();
  }, [timeLeft, totalDuration, isTestSubmitted, handleFinalSubmit, exerciseName, exerciseData]);

  // ── Phase transitions ──────────────────────────────────────────────────────
  const handleMcqDone = useCallback(() => {
    if (progQuestions.length > 0) {
      setPhase('programming');
    } else {
      setShowSubmitConfirm(true);
    }
  }, [progQuestions.length]);

  const handleProgDone = useCallback(() => {
    setShowSubmitConfirm(true);
  }, []);

  // ── Submit confirmation dialog ─────────────────────────────────────────────
  const submitConfirmDialog = showSubmitConfirm ? (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={(e: any) => { if (e.target === e.currentTarget) setShowSubmitConfirm(false); }}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, overflow: 'hidden', boxShadow: '0 20px 56px rgba(0,0,0,0.18)', fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eaeaef', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: T.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertCircle size={18} style={{ color: T.orange }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: T.textMain, margin: 0 }}>Submit Test?</h3>
            <p style={{ fontSize: 12, color: T.textMuted, margin: '2px 0 0' }}>This finalizes your submission and can't be undone.</p>
          </div>
        </div>
        <div style={{ padding: '16px 22px' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { v: mcqQuestions.length, label: 'MCQ', col: T.purple },
              { v: progQuestions.length, label: 'Programming', col: T.greenDark },
            ].map(({ v, label, col }) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', padding: '10px 6px', borderRadius: 10, background: T.pageBg, border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: col }}>{v}</div>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #eaeaef', display: 'flex', gap: 10 }}>
          <button
            onClick={() => setShowSubmitConfirm(false)}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1.5px solid #eaeaef', background: 'transparent', color: T.textSub, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Keep working
          </button>
          <button
            onClick={() => { setShowSubmitConfirm(false); handleFinalSubmit(); }}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: T.green, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 3px 14px rgba(34,197,94,0.25)' }}
          >
            <CheckCircle size={15} /> Submit Test
          </button>
        </div>
      </div>
    </div>
  ) : null;

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading Combined Exercise…</p>
        </div>
      </div>
    );
  }

  if (error || !exerciseData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-md text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{error ? 'Unable to Load Exercise' : 'No Exercise Data'}</h2>
          {error && <p className="text-gray-600 mb-4">{error}</p>}
          <button onClick={() => router.back()} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 w-full">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.pageBg, fontFamily: "'Poppins', -apple-system, sans-serif", color: T.textMain, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ToastContainer position="top-right" />
      {submitConfirmDialog}


      {/* ═══ BODY — real embedded components ═══ */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {phase === 'mcq' && mcqQuestions.length > 0 && (
          <EmbeddedMCQ
            exercise={mcqExercise as any}
            courseId={courseId}
            nodeId={nodeId}
            category={category}
            subcategory={subcategory}
            onCrossNext={handleMcqDone}
            crossNextLabel={progQuestions.length > 0 ? "Next: Programming" : "Submit Test"}
            onSubmitTest={() => setShowSubmitConfirm(true)}
            externalTimeLeft={totalDuration > 0 ? timeLeft : undefined}
          />
        )}

        {phase === 'programming' && progQuestions.length > 0 && (
          <EmbeddedProgComp
            Comp={ProgComp}
            exercise={progExercise as any}
            courseId={courseId}
            category={category}
            subcategory={subcategory}
            nodeId={nodeId}
            onCrossPrev={mcqQuestions.length > 0 ? () => setPhase('mcq') : undefined}
            onCrossNext={handleProgDone}
            crossNextLabel="Submit Test"
            onSubmitTest={() => setShowSubmitConfirm(true)}
            externalTimeLeft={totalDuration > 0 ? timeLeft : undefined}
          />
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1;}50%{opacity:0.45;} }`}</style>
    </div>
  );
};

const CombinedExerciseWrapper = () => (
  <Suspense fallback={
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
    </div>
  }>
    <CombinedExercise />
  </Suspense>
);

export default CombinedExerciseWrapper;
