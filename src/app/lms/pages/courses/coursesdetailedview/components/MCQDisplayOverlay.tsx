import { useState, useEffect } from "react";
import { CheckCircle, XCircle, ChevronRight, ChevronLeft, Clock, Award } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// ─── Single Question Card ─────────────────────────────────────────────────────
function QuestionCard({ question, questionIndex, totalQuestions, onNext, onPrev, onFinish, isLast, isFirst }) {
  const [selectedOption, setSelectedOption] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [shake, setShake] = useState(false);

  const mcq = question.mcqQuestion || {};
  const options = mcq.options || [];
  const correctAnswers = mcq.correctAnswers || [];
  const questionTitle = mcq.questionTitle || "Question";
  const explanation = mcq.explanation || "";
  const optionsPerRow = mcq.mcqQuestionOptionsPerRow || 1;

  const isCorrectOption = (opt) => correctAnswers.includes(opt.text);

  const handleSelect = (idx) => {
    if (revealed) return;
    setSelectedOption(idx);
    if (!isCorrectOption(options[idx])) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleReveal = () => {
    if (selectedOption === null) return;
    setRevealed(true);
  };

  const handleNext = () => {
    if (isLast) onFinish();
    else onNext();
  };

  const getOptionState = (idx) => {
    const opt = options[idx];
    const correct = isCorrectOption(opt);
    if (!revealed) return selectedOption === idx ? "selected" : "idle";
    if (correct) return "correct";
    if (selectedOption === idx && !correct) return "wrong";
    return "dimmed";
  };

  const optionStyles = {
    idle: "border-slate-200 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer shadow-sm hover:shadow-md",
    selected: "border-indigo-500 bg-indigo-50 text-indigo-800 shadow-md ring-2 ring-indigo-200 cursor-pointer",
    correct: "border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm",
    wrong: "border-red-400 bg-red-50 text-red-700 shadow-sm",
    dimmed: "border-slate-100 bg-slate-50 text-slate-400 opacity-60",
  };

  const gridCols = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2" };

  const allAnswered = selectedOption !== null;
  const isCorrectAnswer = selectedOption !== null && isCorrectOption(options[selectedOption]);

  return (
    <div className={shake ? "animate-shake" : ""}>
      {/* Question number inline with title */}
      <div className="mb-6">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-slate-900 text-lg font-semibold leading-snug tracking-tight">
            <span className="text-indigo-600 font-bold mr-1">{questionIndex + 1}.</span>
            {questionTitle}
          </span>
          {revealed && (
            <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold mt-0.5 ${
              isCorrectAnswer
                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                : "bg-red-100 text-red-700 border border-red-200"
            }`}>
              {isCorrectAnswer
                ? <><CheckCircle className="w-3 h-3" /> Correct</>
                : <><XCircle className="w-3 h-3" /> Incorrect</>}
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-slate-400 tracking-wide">
          Question {questionIndex + 1} of {totalQuestions}
        </span>
      </div>

      <div className="h-px bg-slate-100 mb-5" />

      {/* Options */}
      <div className={`grid ${gridCols[optionsPerRow] || "grid-cols-1"} gap-2.5 mb-6`}>
        {options.map((opt, idx) => {
          const state = getOptionState(idx);
          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-sm text-left
                transition-all duration-200 ${optionStyles[state]}`}
            >
              <div className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold
                transition-all duration-200
                ${state === "correct" ? "bg-emerald-500 text-white" :
                  state === "wrong"   ? "bg-red-400 text-white" :
                  state === "selected"? "bg-indigo-500 text-white" :
                                        "bg-slate-100 text-slate-500"}`}>
                {state === "correct" ? <CheckCircle className="w-3.5 h-3.5" /> :
                 state === "wrong"   ? <XCircle className="w-3.5 h-3.5" /> :
                 String.fromCharCode(65 + idx)}
              </div>
              <span className="font-medium leading-snug">{opt.text}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {revealed && explanation && (
        <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1 h-4 rounded-full bg-blue-400" />
            <p className="text-blue-700 text-xs font-semibold uppercase tracking-wider">Explanation</p>
          </div>
          <p className="text-blue-800 text-sm leading-relaxed pl-3">{explanation}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600
            hover:bg-slate-200 hover:text-slate-800 transition-all text-sm font-medium
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>

        <div className="flex-1 flex justify-center">
          {!revealed ? (
            <button
              onClick={handleReveal}
              disabled={!allAnswered}
              className="px-8 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold
                shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all
                disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              Check Answer
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-8 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600
                text-white text-sm font-semibold shadow-lg shadow-emerald-200 transition-all"
            >
              {isLast
                ? <>Resume Video <ChevronRight className="w-4 h-4" /></>
                : <>Next Question <ChevronRight className="w-4 h-4" /></>}
            </button>
          )}
        </div>

        <div className="w-24" />
      </div>
    </div>
  );
}

// ─── Main Overlay ─────────────────────────────────────────────────────────────
export default function MCQDisplayOverlay({ questions, timestamp, onResume, onDismiss }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    setCurrentIndex(0);
  }, [questions]);

  const handleNext = () => { if (currentIndex < questions.length - 1) setCurrentIndex(i => i + 1); };
  const handlePrev = () => { if (currentIndex > 0) setCurrentIndex(i => i - 1); };
  const handleFinish = () => onResume();

  if (!questions || questions.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        @keyframes overlayIn {
          from { opacity: 0; transform: scale(0.96) translateY(10px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        .overlay-card { animation: overlayIn 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>

      {/* Backdrop */}
      <div
        className="absolute inset-0 z-20 flex items-center justify-center p-6"
        style={{ background: "rgba(15,23,42,0.60)", backdropFilter: "blur(8px)" }}
      >
        {/* Wide white card */}
        <div
          className="overlay-card w-full bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxWidth: "680px", maxHeight: "88vh" }}
        >
          {/* ── Top bar ── */}
          <div className="flex items-center justify-between px-7 py-4 bg-white border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-4">
              {/* Icon + label */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
                  <Award className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-bold text-slate-900 tracking-tight">Knowledge Check</span>
              </div>

              <div className="w-px h-5 bg-slate-200" />

              {/* Progress dots */}
              <div className="flex items-center gap-1.5">
                {questions.map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${
                      i === currentIndex ? "w-5 h-2 bg-indigo-500" :
                      i < currentIndex   ? "w-2 h-2 bg-emerald-400" :
                                           "w-2 h-2 bg-slate-200"
                    }`}
                  />
                ))}
              </div>

              {/* Timestamp */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                <Clock className="w-3 h-3 text-slate-400" />
                <span className="text-xs font-semibold text-slate-500">{formatTime(timestamp)}</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-slate-100 flex-shrink-0">
            <div
              className="h-full bg-indigo-500 transition-all duration-500 ease-out"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto px-8 py-7">
            <QuestionCard
              key={currentIndex}
              question={questions[currentIndex]}
              questionIndex={currentIndex}
              totalQuestions={questions.length}
              onNext={handleNext}
              onPrev={handlePrev}
              onFinish={handleFinish}
              isLast={currentIndex === questions.length - 1}
              isFirst={currentIndex === 0}
            />
          </div>
        </div>
      </div>
    </>
  );
}