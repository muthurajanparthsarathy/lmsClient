"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft,
  Clock, Send, AlertTriangle, Loader2, Trophy,
  BookOpen, Zap, X, Check, ArrowRight, RotateCcw
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface MCQOption {
  _id: string;
  text: string;
  isCorrect?: boolean;
  imageUrl: string | null;
  imageAlignment: "left" | "center" | "right";
  imageSizePercent: number;
}

interface Question {
  _id: string;
  questionType: "mcq" | "programming";
  mcqQuestionTitle?: string;
  mcqQuestionDescription?: string;
  mcqQuestionType?: "multiple_choice" | "checkboxes" | "short_answer" | "essay" | "dropdown";
  mcqQuestionDifficulty?: "easy" | "medium" | "hard";
  mcqQuestionScore?: number;
  mcqQuestionOptionsPerRow?: number;
  mcqQuestionRequired?: boolean;
  mcqQuestionOptions?: MCQOption[];
}

interface LiveQuestionData {
  _id: string;
  link: string;
  tabType?: string;
  subCategory?: string;
  duration?: number;
  questions: Question[];
  allowRetake: boolean;
  shuffleQuestions: boolean;
  showResultImmediately: boolean;
  status: string;
}

interface AnswerState {
  [questionId: string]: string | string[];
}

interface SubmitResult {
  isCorrect: boolean;
  scoreObtained: number;
  totalScore: number;
  percentageScore: number;
}

type PageState = "loading" | "error" | "active" | "submitting" | "completed";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5533";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getToken = () =>
  typeof window !== "undefined" ? localStorage.getItem("smartcliff_token") || "" : "";

const authHeaders = () => ({
  "Content-Type": "application/json",
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

// ─── Timer ────────────────────────────────────────────────────────────────────
function useTimer(durationMinutes?: number) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = durationMinutes ? durationMinutes * 60 - elapsed : null;
  const fmt = (s: number) => {
    const m = Math.floor(Math.abs(s) / 60).toString().padStart(2, "0");
    const sec = (Math.abs(s) % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return { elapsed, remaining, fmt };
}

// ─── Difficulty badge ─────────────────────────────────────────────────────────
function DifficultyBadge({ level }: { level?: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    easy: { label: "Easy", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    medium: { label: "Medium", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    hard: { label: "Hard", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  };
  const cfg = map[level || "medium"];
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.5px",
      textTransform: "uppercase", padding: "2px 8px", borderRadius: 99,
      color: cfg.color, backgroundColor: cfg.bg,
      border: `1px solid ${cfg.color}30`,
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Result Screen ────────────────────────────────────────────────────────────
function ResultScreen({
  attempt, totalQuestions, onRetry
}: {
  attempt: any; totalQuestions: number; onRetry?: () => void;
}) {
  const pct = Math.round(attempt?.percentageScore || 0);
  const passed = pct >= 60;

  const ring = 220;
  const r = 90;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif", padding: 24,
    }}>
      <div style={{
        maxWidth: 480, width: "100%",
        background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 24,
        padding: "40px 32px", textAlign: "center",
        boxShadow: "0 40px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Score ring */}
        <div style={{ position: "relative", display: "inline-flex", marginBottom: 28 }}>
          <svg width={ring} height={ring} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={ring / 2} cy={ring / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
            <circle cx={ring / 2} cy={ring / 2} r={r} fill="none"
              stroke={passed ? "#10b981" : "#f59e0b"} strokeWidth={14}
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              style={{ transition: "stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1)" }}
            />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: "white", lineHeight: 1 }}>{pct}%</span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 4 }}>Score</span>
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          {passed
            ? <Trophy size={28} color="#f59e0b" style={{ marginBottom: 8 }} />
            : <AlertTriangle size={28} color="#f59e0b" style={{ marginBottom: 8 }} />}
        </div>
        <h2 style={{ color: "white", fontSize: 26, fontWeight: 800, margin: "0 0 8px" }}>
          {passed ? "Well Done!" : "Keep Practising"}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, margin: "0 0 32px" }}>
          {passed ? "You passed this assessment." : "You can do better next time."}
        </p>

        {/* Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12, marginBottom: 32,
        }}>
          {[
            { label: "Score", value: `${attempt?.totalScore || 0}/${attempt?.maxScore || totalQuestions}` },
            { label: "Questions", value: totalQuestions },
            { label: "Answered", value: attempt?.answers?.length || 0 },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.06)", borderRadius: 12,
              padding: "14px 10px", border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "white" }}>{value}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {onRetry && (
          <button onClick={onRetry} style={{
            display: "flex", alignItems: "center", gap: 8,
            justifyContent: "center", width: "100%",
            padding: "13px 0", borderRadius: 12,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", color: "white", fontSize: 14,
            fontWeight: 700, cursor: "pointer",
            boxShadow: "0 8px 24px rgba(99,102,241,0.4)",
          }}>
            <RotateCcw size={16} /> Try Again
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LiveMCQPage() {
  const params = useParams();
  const router = useRouter();
  const link = params?.link as string;

  // ── Page & data state ──────────────────────────────────────────────────────
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [quizData, setQuizData] = useState<LiveQuestionData | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [finalAttempt, setFinalAttempt] = useState<any>(null);

  // ── Navigation & answer state ───────────────────────────────────────────────
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, SubmitResult>>({});
  const [submittingQ, setSubmittingQ] = useState<string | null>(null);
  const [questionStartTimes, setQuestionStartTimes] = useState<Record<string, number>>({});

  const { elapsed, remaining, fmt } = useTimer(quizData?.duration);

  // ── Auth check + fetch quiz ───────────────────────────────────────────────
  useEffect(() => {
    if (!link) return;
    const token = getToken();
    if (!token) {
      // Redirect to login with the current URL as the redirect param
      const encoded = encodeURIComponent(window.location.href);
      router.replace(`/login?redirect=${encoded}`);
      return;
    }
    fetchQuiz();
  }, [link]);

  // ── Track question start time ──────────────────────────────────────────────
  useEffect(() => {
    if (!quizData) return;
    const q = quizData.questions[currentIdx];
    if (q && !questionStartTimes[q._id]) {
      setQuestionStartTimes(p => ({ ...p, [q._id]: Date.now() }));
    }
  }, [currentIdx, quizData]);

  // ── Auto-submit when timer runs out ───────────────────────────────────────
  useEffect(() => {
    if (remaining !== null && remaining <= 0 && pageState === "active") {
      handleSubmitTest();
    }
  }, [remaining, pageState]);

  // ── Fetch quiz data ────────────────────────────────────────────────────────
  const fetchQuiz = async () => {
    try {
      setPageState("loading");
      const res = await fetch(`${API}/link/${link}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Quiz not found");
      setQuizData(data.data);

      // Start attempt
      const attemptRes = await fetch(`${API}/link/${link}/start`, {
        method: "POST", headers: authHeaders(),
      });
      const attemptData = await attemptRes.json();
      if (!attemptRes.ok || !attemptData.success) throw new Error(attemptData.message || "Could not start attempt");

      setAttemptId(attemptData.data._id);
      // If continuing a previous attempt, restore answers
      if (attemptData.data.answers?.length) {
        const restored: AnswerState = {};
        attemptData.data.answers.forEach((a: any) => { restored[a.questionId] = a.answer; });
        setAnswers(restored);
      }
      setPageState("active");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong");
      setPageState("error");
    }
  };

  // ── Submit single answer ───────────────────────────────────────────────────
  const submitAnswer = useCallback(async (questionId: string, answer: string | string[]) => {
    if (!attemptId) return;
    setSubmittingQ(questionId);
    const q = quizData?.questions.find(q => q._id === questionId);
    const timeSpent = questionStartTimes[questionId]
      ? Math.floor((Date.now() - questionStartTimes[questionId]) / 1000)
      : 0;

    try {
      const res = await fetch(`${API}/attempt/${attemptId}/submit-answer`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          questionId,
          answer,
          questionType: q?.questionType || "mcq",
          timeSpent,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSubmittedAnswers(p => ({ ...p, [questionId]: data.data }));
      }
    } catch { /* silent - answer stored locally */ }
    finally { setSubmittingQ(null); }
  }, [attemptId, quizData, questionStartTimes]);

  // ── Handle option select ───────────────────────────────────────────────────
  const handleSelect = (questionId: string, optionText: string, isCheckbox: boolean) => {
    setAnswers(prev => {
      let next: string | string[];
      if (isCheckbox) {
        const cur = (prev[questionId] as string[]) || [];
        next = cur.includes(optionText) ? cur.filter(v => v !== optionText) : [...cur, optionText];
      } else {
        next = optionText;
      }
      submitAnswer(questionId, next);
      return { ...prev, [questionId]: next };
    });
  };

  // ── Navigate ───────────────────────────────────────────────────────────────
  const goTo = (idx: number) => {
    if (!quizData) return;
    if (idx < 0 || idx >= quizData.questions.length) return;
    setCurrentIdx(idx);
  };

  // ── Submit full test ───────────────────────────────────────────────────────
  const handleSubmitTest = async () => {
    if (!attemptId) return;
    setPageState("submitting");
    try {
      const res = await fetch(`${API}/attempt/${attemptId}/submit-test`, {
        method: "POST", headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Submit failed");
      setFinalAttempt(data.data);
      setPageState("completed");
    } catch (err: any) {
      setErrorMsg(err.message);
      setPageState("error");
    }
  };

  // ─── Render states ──────────────────────────────────────────────────────────

  if (pageState === "loading") {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0f",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 16, fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          border: "3px solid rgba(99,102,241,0.2)",
          borderTop: "3px solid #6366f1",
          animation: "spin 0.8s linear infinite",
        }} />
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Loading your quiz…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0f",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 16, fontFamily: "'DM Sans', sans-serif", padding: 24,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle size={28} color="#ef4444" />
        </div>
        <h2 style={{ color: "white", margin: 0, fontSize: 20 }}>Oops!</h2>
        <p style={{ color: "rgba(255,255,255,0.5)", margin: 0, textAlign: "center", maxWidth: 320 }}>{errorMsg}</p>
        <button onClick={fetchQuiz} style={{
          padding: "10px 24px", borderRadius: 10,
          background: "#6366f1", border: "none", color: "white",
          fontWeight: 700, cursor: "pointer", fontSize: 14,
        }}>
          Try Again
        </button>
      </div>
    );
  }

  if (pageState === "completed" && finalAttempt) {
    return (
      <ResultScreen
        attempt={finalAttempt}
        totalQuestions={quizData?.questions.length || 0}
        onRetry={quizData?.allowRetake ? fetchQuiz : undefined}
      />
    );
  }

  if (!quizData || pageState === "submitting") {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0a0f",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 16, fontFamily: "'DM Sans', sans-serif",
      }}>
        <Loader2 size={40} color="#6366f1" style={{ animation: "spin 1s linear infinite" }} />
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Submitting your test…</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const questions = quizData.questions;
  const totalQ = questions.length;
  const currentQ = questions[currentIdx];
  const answeredCount = Object.keys(answers).filter(k => {
    const a = answers[k];
    return Array.isArray(a) ? a.length > 0 : !!a;
  }).length;
  const isLastQ = currentIdx === totalQ - 1;
  const currentAnswer = answers[currentQ._id];
  const isCheckbox = currentQ.mcqQuestionType === "checkboxes";
  const isAnswered = isCheckbox
    ? Array.isArray(currentAnswer) && currentAnswer.length > 0
    : !!currentAnswer;
  const submitResult = submittedAnswers[currentQ._id];
  const cols = currentQ.mcqQuestionOptionsPerRow || 1;

  const timerColor = remaining === null ? "#6366f1"
    : remaining > 120 ? "#10b981"
      : remaining > 60 ? "#f59e0b"
        : "#ef4444";

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(160deg, #0d0d1a 0%, #12122a 40%, #0d0d1a 100%)",
        fontFamily: "'DM Sans', sans-serif",
        color: "white",
        display: "flex", flexDirection: "column",
      }}>

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <header style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 24px",
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          backdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 100,
          flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Zap size={16} color="white" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>Live MCQ</div>
              {quizData.subCategory && (
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {quizData.tabType} · {quizData.subCategory}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {remaining !== null && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 8,
                background: `${timerColor}18`,
                border: `1px solid ${timerColor}35`,
              }}>
                <Clock size={13} color={timerColor} />
                <span style={{ fontSize: 13, fontWeight: 700, color: timerColor, fontFamily: "'DM Mono', monospace" }}>
                  {fmt(remaining)}
                </span>
              </div>
            )}

            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
              <BookOpen size={13} color="rgba(255,255,255,0.5)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.8)", fontFamily: "'DM Mono', monospace" }}>
                {answeredCount}/{totalQ}
              </span>
            </div>

            <button
              onClick={handleSubmitTest}
              disabled={pageState === "submitting"}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 9, border: "none",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "white", fontSize: 12, fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(16,185,129,0.3)",
                opacity: pageState === "submitting" ? 0.6 : 1,
              }}
            >
              <Send size={13} />
              Submit Test
            </button>
          </div>
        </header>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── Question nav sidebar ──────────────────────────────────────── */}
          <aside style={{
            width: 220, flexShrink: 0,
            background: "rgba(255,255,255,0.02)",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            padding: "20px 12px",
            overflowY: "auto",
            display: "flex", flexDirection: "column", gap: 8,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 }}>
              Questions
            </div>
            {questions.map((q, i) => {
              const ans = answers[q._id];
              const answered = Array.isArray(ans) ? ans.length > 0 : !!ans;
              const isCurrent = i === currentIdx;

              let bg = "rgba(255,255,255,0.04)";
              let border = "rgba(255,255,255,0.08)";
              if (isCurrent) { bg = "rgba(99,102,241,0.2)"; border = "rgba(99,102,241,0.6)"; }
              else if (answered) { bg = "rgba(16,185,129,0.1)"; border = "rgba(16,185,129,0.3)"; }

              return (
                <button key={q._id} onClick={() => goTo(i)} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 10px", borderRadius: 8,
                  background: bg, border: `1px solid ${border}`,
                  cursor: "pointer", textAlign: "left", transition: "all 0.15s",
                  width: "100%",
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: isCurrent ? "rgba(99,102,241,0.3)" : answered ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800,
                    color: isCurrent ? "#a5b4fc" : answered ? "#6ee7b7" : "rgba(255,255,255,0.4)",
                  }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, color: isCurrent ? "white" : answered ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
                      fontWeight: isCurrent ? 600 : 400,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {q.mcqQuestionTitle?.slice(0, 26) || `Q${i + 1}`}
                      {(q.mcqQuestionTitle?.length || 0) > 26 ? "…" : ""}
                    </div>
                  </div>
                  {answered && !isCurrent && (
                    <Check size={12} color="#10b981" style={{ flexShrink: 0 }} />
                  )}
                </button>
              );
            })}

            <div style={{ marginTop: "auto", paddingTop: 16 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
                Progress {Math.round((answeredCount / totalQ) * 100)}%
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99 }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  background: "linear-gradient(90deg, #6366f1, #10b981)",
                  width: `${(answeredCount / totalQ) * 100}%`,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
          </aside>

          {/* ── Question area ─────────────────────────────────────────────── */}
          <main style={{
            flex: 1, overflowY: "auto",
            padding: "32px 40px",
            display: "flex", flexDirection: "column", gap: 24,
            maxWidth: 860,
          }}>
            <div style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 18,
              padding: "28px 32px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    minWidth: 36, height: 36, borderRadius: 10,
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 800, color: "white",
                  }}>{currentIdx + 1}</div>
                  <div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>
                      Question {currentIdx + 1} of {totalQ}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <DifficultyBadge level={currentQ.mcqQuestionDifficulty} />
                      {currentQ.mcqQuestionScore !== undefined && (
                        <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700 }}>
                          {currentQ.mcqQuestionScore} pt{currentQ.mcqQuestionScore !== 1 ? "s" : ""}
                        </span>
                      )}
                      {currentQ.mcqQuestionRequired && (
                        <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 700 }}>Required</span>
                      )}
                    </div>
                  </div>
                </div>

                {submitResult && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                    padding: "6px 12px", borderRadius: 99,
                    background: submitResult.isCorrect ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                    border: `1px solid ${submitResult.isCorrect ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
                    fontSize: 12, fontWeight: 700,
                    color: submitResult.isCorrect ? "#6ee7b7" : "#fca5a5",
                  }}>
                    {submitResult.isCorrect ? <CheckCircle2 size={13} /> : <X size={13} />}
                    {submitResult.isCorrect ? "Correct" : "Incorrect"}
                    {` · ${submitResult.scoreObtained} pt`}
                  </div>
                )}
              </div>

              <h2 style={{
                fontSize: 18, fontWeight: 700, color: "white",
                lineHeight: 1.55, margin: "0 0 24px",
                borderLeft: "3px solid #6366f1", paddingLeft: 16,
              }}>
                {currentQ.mcqQuestionTitle}
              </h2>

              {currentQ.mcqQuestionDescription && (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 20px", paddingLeft: 16 }}>
                  {currentQ.mcqQuestionDescription}
                </p>
              )}

              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 14, paddingLeft: 16, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {isCheckbox ? "Select all that apply" : "Select one answer"}
                {submittingQ === currentQ._id && (
                  <span style={{ marginLeft: 8, color: "#6366f1" }}>
                    <Loader2 size={10} style={{ display: "inline", animation: "spin 1s linear infinite" }} /> Saving…
                  </span>
                )}
              </div>

              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.min(cols, 2)}, 1fr)`,
                gap: 10,
              }}>
                {(currentQ.mcqQuestionOptions || []).map((opt, oi) => {
                  const selected = isCheckbox
                    ? (Array.isArray(currentAnswer) ? currentAnswer.includes(opt.text) : false)
                    : currentAnswer === opt.text;

                  const borderColor = selected ? "#6366f1" : "rgba(255,255,255,0.08)";
                  const bgColor = selected ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.03)";

                  return (
                    <button
                      key={opt._id}
                      onClick={() => handleSelect(currentQ._id, opt.text, isCheckbox)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "14px 16px", borderRadius: 12,
                        background: bgColor,
                        border: `1.5px solid ${borderColor}`,
                        cursor: "pointer", textAlign: "left",
                        transition: "all 0.15s",
                        position: "relative",
                        boxShadow: selected ? `0 0 0 1px rgba(99,102,241,0.3), inset 0 1px 0 rgba(255,255,255,0.05)` : "none",
                      }}
                      onMouseEnter={e => { if (!selected) (e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"); (e.currentTarget.style.background = selected ? bgColor : "rgba(255,255,255,0.06)"); }}
                      onMouseLeave={e => { (e.currentTarget.style.borderColor = borderColor); (e.currentTarget.style.background = bgColor); }}
                    >
                      <div style={{
                        width: 20, height: 20, flexShrink: 0,
                        borderRadius: isCheckbox ? 5 : "50%",
                        border: `2px solid ${selected ? "#6366f1" : "rgba(255,255,255,0.2)"}`,
                        background: selected ? "#6366f1" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.15s",
                      }}>
                        {selected && <Check size={11} color="white" strokeWidth={3} />}
                      </div>

                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: "rgba(255,255,255,0.4)", marginRight: 6, flexShrink: 0,
                      }}>
                        {String.fromCharCode(65 + oi)}.
                      </span>

                      {opt.imageUrl && (
                        <img src={opt.imageUrl} alt="" style={{
                          width: `${opt.imageSizePercent || 100}%`, maxHeight: 80,
                          objectFit: "contain", borderRadius: 6, marginBottom: 4,
                        }} />
                      )}

                      <span style={{
                        flex: 1, fontSize: 14, fontWeight: selected ? 600 : 400,
                        color: selected ? "white" : "rgba(255,255,255,0.75)",
                        lineHeight: 1.45,
                      }}>
                        {opt.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Navigation ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 32 }}>
              <button
                onClick={() => goTo(currentIdx - 1)}
                disabled={currentIdx === 0}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 20px", borderRadius: 10,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: currentIdx === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.8)",
                  cursor: currentIdx === 0 ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                <ChevronLeft size={15} /> Previous
              </button>

              <div style={{ display: "flex", gap: 6 }}>
                {questions.map((q, i) => {
                  const ans = answers[q._id];
                  const answered = Array.isArray(ans) ? ans.length > 0 : !!ans;
                  return (
                    <button key={q._id} onClick={() => goTo(i)} style={{
                      width: i === currentIdx ? 20 : 8, height: 8,
                      borderRadius: 99, border: "none", cursor: "pointer",
                      background: i === currentIdx ? "#6366f1" : answered ? "#10b981" : "rgba(255,255,255,0.15)",
                      transition: "all 0.2s",
                      padding: 0,
                    }} />
                  );
                })}
              </div>

              {isLastQ ? (
                <button
                  onClick={handleSubmitTest}
                  disabled={pageState === "submitting"}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 22px", borderRadius: 10,
                    background: "linear-gradient(135deg, #10b981, #059669)",
                    border: "none",
                    color: "white", fontSize: 13, fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(16,185,129,0.35)",
                  }}
                >
                  <Send size={14} /> Submit Test
                </button>
              ) : (
                <button
                  onClick={() => goTo(currentIdx + 1)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 20px", borderRadius: 10,
                    background: isAnswered
                      ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                      : "rgba(255,255,255,0.05)",
                    border: isAnswered ? "none" : "1px solid rgba(255,255,255,0.1)",
                    color: isAnswered ? "white" : "rgba(255,255,255,0.8)",
                    cursor: "pointer", fontSize: 13, fontWeight: 600,
                    boxShadow: isAnswered ? "0 4px 16px rgba(99,102,241,0.3)" : "none",
                  }}
                >
                  Next <ChevronRight size={15} />
                </button>
              )}
            </div>
          </main>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg) } }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        `}</style>
      </div>
    </>
  );
}