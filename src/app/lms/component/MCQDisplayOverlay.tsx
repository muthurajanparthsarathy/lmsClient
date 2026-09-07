import { useState, useEffect, useRef } from "react";
import {
  CheckCircle, XCircle, ChevronRight, ChevronLeft,
  HelpCircle, Award, RotateCcw, Play, X
} from "lucide-react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (isNaN(seconds) || seconds === undefined) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// ─── Single Question Card ──────────────────────────────────────────────────────
function QuestionCard({ question, questionIndex, totalQuestions, onNext, onPrev, onFinish, isLast }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [shake, setShake] = useState(false);

  const options = question.mcqQuestion?.options || [];
  const correctAnswers = question.mcqQuestion?.correctAnswers || [];
  const questionTitle = question.mcqQuestion?.questionTitle || "Question";
  const explanation = question.mcqQuestion?.explanation || "";
  const questionImageUrl = question.mcqQuestion?.questionImageUrl || null;
  const optionsPerRow = question.mcqQuestion?.mcqQuestionOptionsPerRow || 1;

  const isCorrectOption = (opt) => {
    const text = opt.text || Object.values(opt).filter(v => typeof v === "string" && v !== "null").join("");
    return correctAnswers.includes(text);
  };

  const getOptionText = (opt) => {
    if (opt.text !== undefined) return opt.text;
    return Object.entries(opt)
      .filter(([k]) => !["isCorrect", "imageUrl", "_id", "imageAlignment", "imageSizePercent"].includes(k))
      .map(([, v]) => v)
      .join("");
  };

  const handleSelect = (idx) => {
    if (revealed) return;
    setSelectedOption(idx);
    const opt = options[idx];
    if (!isCorrectOption(opt)) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  const handleReveal = () => {
    if (selectedOption === null) return;
    setRevealed(true);
  };

  const getOptionState = (idx) => {
    const opt = options[idx];
    const correct = isCorrectOption(opt);
    if (!revealed) {
      return selectedOption === idx ? "selected" : "idle";
    }
    if (correct) return "correct";
    if (selectedOption === idx && !correct) return "wrong";
    return "dimmed";
  };

  const optionStateStyles = {
    idle: "border-white/20 bg-white/5 text-white hover:border-violet-400/60 hover:bg-violet-500/10 cursor-pointer",
    selected: "border-violet-400 bg-violet-500/20 text-white cursor-pointer ring-2 ring-violet-400/30",
    correct: "border-emerald-400 bg-emerald-500/20 text-emerald-300",
    wrong: "border-red-400 bg-red-500/20 text-red-300",
    dimmed: "border-white/10 bg-white/3 text-white/40",
  };

  const gridClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2",
  }[Math.min(optionsPerRow, 4)] || "grid-cols-1";

  const allCorrect = revealed && selectedOption !== null && isCorrectOption(options[selectedOption]);

  return (
    <div className={`flex flex-col h-full transition-all duration-300 ${shake ? "animate-shake" : ""}`}>
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5 mb-4">
        {Array.from({ length: totalQuestions }).map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-300 ${
              i === questionIndex
                ? "w-6 h-2 bg-violet-400"
                : i < questionIndex
                ? "w-2 h-2 bg-emerald-400"
                : "w-2 h-2 bg-white/20"
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-violet-500/30 border border-violet-400/40 flex items-center justify-center">
            <span className="text-[11px] font-black text-violet-300">{questionIndex + 1}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white leading-relaxed">{questionTitle}</p>
            {questionImageUrl && (
              <img src={questionImageUrl} alt="Question" className="mt-2 rounded-lg max-h-28 object-contain border border-white/10" />
            )}
          </div>
        </div>
      </div>

      {/* Options */}
      <div className={`grid ${gridClass} gap-2 flex-1 overflow-y-auto`}>
        {options.map((opt, idx) => {
          const state = getOptionState(idx);
          const text = getOptionText(opt);
          const imgUrl = opt.imageUrl;
          return (
            <button
              key={opt._id?.$oid || idx}
              onClick={() => handleSelect(idx)}
              disabled={revealed}
              className={`relative rounded-xl border-2 p-3 text-left transition-all duration-200 text-xs font-medium flex flex-col gap-1.5 ${optionStateStyles[state]}`}
            >
              <div className="flex items-center gap-2">
                <span className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center text-[9px] font-black transition-all ${
                  state === "selected" ? "border-violet-400 bg-violet-400 text-white" :
                  state === "correct" ? "border-emerald-400 bg-emerald-400 text-white" :
                  state === "wrong" ? "border-red-400 bg-red-400 text-white" :
                  "border-white/30 text-white/50"
                }`}>
                  {String.fromCharCode(65 + idx)}
                </span>
                <span className="flex-1 leading-relaxed">{text || "(no text)"}</span>
                {revealed && state === "correct" && <CheckCircle className="flex-shrink-0 h-4 w-4 text-emerald-400" />}
                {revealed && state === "wrong" && <XCircle className="flex-shrink-0 h-4 w-4 text-red-400" />}
              </div>
              {imgUrl && (
                <img
                  src={imgUrl}
                  alt=""
                  style={{ width: `${opt.imageSizePercent || 100}%`, textAlign: opt.imageAlignment || "left" }}
                  className="rounded-lg border border-white/10 mt-1"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {revealed && explanation && (
        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 flex-shrink-0">
          <p className="text-[11px] font-semibold text-amber-300 mb-1">Explanation</p>
          <p className="text-xs text-amber-100/80 leading-relaxed">{explanation}</p>
        </div>
      )}

      {/* Result feedback */}
      {revealed && (
        <div className={`mt-2 py-2 px-3 rounded-lg flex items-center gap-2 flex-shrink-0 ${
          allCorrect ? "bg-emerald-500/15 border border-emerald-400/30" : "bg-red-500/15 border border-red-400/30"
        }`}>
          {allCorrect
            ? <><CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" /><span className="text-xs text-emerald-300 font-semibold">Correct!</span></>
            : <><XCircle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" /><span className="text-xs text-red-300 font-semibold">Incorrect — correct answer highlighted above</span></>
          }
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-3 flex-shrink-0">
        <button
          onClick={onPrev}
          disabled={questionIndex === 0}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </button>

        {!revealed ? (
          <button
            onClick={handleReveal}
            disabled={selectedOption === null}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-900/40"
          >
            Check Answer
          </button>
        ) : isLast ? (
          <button
            onClick={onFinish}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-900/40"
          >
            <Play className="h-3.5 w-3.5" /> Resume Video
          </button>
        ) : (
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-900/40"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Summary Screen ────────────────────────────────────────────────────────────
function SummaryScreen({ questions, answers, onResumeVideo, onRetry }) {
  const correct = answers.filter((a, i) => {
    if (a === null) return false;
    const opts = questions[i].mcqQuestion?.options || [];
    const opt = opts[a];
    const ca = questions[i].mcqQuestion?.correctAnswers || [];
    const text = opt?.text || Object.values(opt || {}).filter(v => typeof v === "string").join("");
    return ca.includes(text);
  }).length;

  const total = questions.length;
  const pct = Math.round((correct / total) * 100);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 py-4">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
          <circle cx="40" cy="40" r="34" fill="none"
            stroke={pct >= 70 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171"}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 34}`}
            strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black text-white">{pct}%</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-base font-bold text-white mb-1">
          {pct >= 70 ? "Great job! 🎉" : pct >= 40 ? "Keep going! 💪" : "Review needed 📚"}
        </p>
        <p className="text-xs text-white/60">{correct} of {total} correct</p>
      </div>

      <div className="flex gap-3 w-full">
        <button onClick={onRetry} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border border-white/20 text-white/80 hover:bg-white/10 transition-all">
          <RotateCcw className="h-3.5 w-3.5" /> Retry
        </button>
        <button onClick={onResumeVideo} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-900/40">
          <Play className="h-3.5 w-3.5" /> Resume
        </button>
      </div>
    </div>
  );
}

// ─── Main MCQ Display Overlay ──────────────────────────────────────────────────
/**
 * Props:
 *  - questions: array of mcqQuestion objects at current timestamp
 *  - timestamp: number (seconds)
 *  - onResume: () => void — called when student finishes or skips
 *  - onDismiss: () => void — called when X is clicked (skip quiz)
 */
export default function MCQDisplayOverlay({ questions, timestamp, onResume, onDismiss }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(() => new Array(questions.length).fill(null));
  const [showSummary, setShowSummary] = useState(false);


  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(i => i + 1);
  };
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  };

  const handleFinish = () => {
    if (questions.length === 1) {
      onResume();
    } else {
      setShowSummary(true);
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setAnswers(new Array(questions.length).fill(null));
    setShowSummary(false);
  };

  const handleResume = () => {
    setVisible(false);
    setTimeout(onResume, 200);
  };

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 200);
  };

  if (!questions || questions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/70 backdrop-blur-sm pointer-events-auto transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={handleDismiss}
      />

      {/* Panel */}
      <div
        className={`relative pointer-events-auto w-full max-w-md mx-4 transition-all duration-300 ${
          visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-4"
        }`}
        style={{
          background: "linear-gradient(135deg, rgba(15,10,40,0.97) 0%, rgba(25,15,60,0.97) 100%)",
          border: "1px solid rgba(139,92,246,0.3)",
          borderRadius: "20px",
          boxShadow: "0 0 60px rgba(139,92,246,0.25), 0 25px 50px rgba(0,0,0,0.6)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Decorative gradient top bar */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[20px]"
          style={{ background: "linear-gradient(90deg, transparent, #8b5cf6, #a78bfa, #8b5cf6, transparent)" }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center">
              <HelpCircle className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <p className="text-[11px] font-black text-violet-300 uppercase tracking-widest">Quiz Time</p>
              <p className="text-[10px] text-white/40 font-mono">
                @ {formatTime(timestamp)} · {questions.length} question{questions.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
            title="Skip quiz"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="mx-5 h-px bg-white/10 flex-shrink-0" />

        {/* Body */}
        <div className="flex-1 overflow-hidden px-5 py-4">
          {showSummary ? (
            <SummaryScreen
              questions={questions}
              answers={answers}
              onResumeVideo={handleResume}
              onRetry={handleRetry}
            />
          ) : (
            <QuestionCard
              question={questions[currentIndex]}
              questionIndex={currentIndex}
              totalQuestions={questions.length}
              onNext={handleNext}
              onPrev={handlePrev}
              onFinish={handleFinish}
              isLast={currentIndex === questions.length - 1}
            />
          )}
        </div>
      </div>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.5s ease; }
      `}</style>
    </div>
  );
}