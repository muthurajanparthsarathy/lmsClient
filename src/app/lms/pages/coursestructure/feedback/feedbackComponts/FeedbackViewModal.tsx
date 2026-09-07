// components/FeedbackViewModal.tsx
// Admin-side preview of how a published feedback form will appear to students.
// Visual language matches FeedbackStudentModal + the rest of the feedback
// module: Poppins, indigo accent, flat questions with hairline dividers,
// compact rating buttons, sticky header/footer, thin custom scrollbar.

import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  Send,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  MessageSquare,
  Pencil,
} from 'lucide-react';
import { Poppins } from 'next/font/google';
import { Feedback } from '../types/feedback';
import TipTapEditor from '../../../../component/tiptopEditor';

// Strip HTML tags to count visible characters for rich-text answers.
const htmlTextLength = (html: string): number => {
  if (!html) return 0;
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, '').length;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').length;
};

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const thinScroll =
  '[scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] ' +
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full ' +
  'hover:[&::-webkit-scrollbar-thumb]:bg-gray-400';

interface FeedbackViewModalProps {
  feedback: Feedback | null;
  isOpen: boolean;
  onClose: () => void;
}

interface AnswerWithReason {
  answer: any;
  reason: string;
}

type ViewMode = 'overview' | 'step';

export const FeedbackViewModal: React.FC<FeedbackViewModalProps> = ({
  feedback,
  isOpen,
  onClose,
}) => {
  const [mode, setMode] = useState<ViewMode>('overview');
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerWithReason>>({});
  const [overallReason, setOverallReason] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Reset state on open/close.
  useEffect(() => {
    if (isOpen) {
      setMode('overview');
      setCurrentStep(0);
      setAnswers({});
      setOverallReason('');
      setIsSubmitted(false);
    }
  }, [isOpen]);

  // Esc closes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!feedback || !isOpen) return null;

  const questions = feedback.questions || [];
  const allowOverallReason = (feedback as any).allowOverallReason !== false;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const setAnswer = (qText: string, value: any) =>
    setAnswers((p) => ({ ...p, [qText]: { ...p[qText], answer: value } }));

  const handleSubmit = () => {
    const required = questions.filter(
      (q) =>
        q.isRequired &&
        (!answers[q.questionText] ||
          answers[q.questionText].answer === '' ||
          answers[q.questionText].answer === undefined)
    );
    if (required.length) {
      alert(`Please answer all required questions (${required.length} remaining)`);
      return;
    }
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      onClose();
    }, 2500);
  };

  // ── Stats ────────────────────────────────────────────────────────────────
  const totalRequired = questions.filter((q) => q.isRequired).length;
  const answeredRequired = questions.filter(
    (q) =>
      q.isRequired &&
      answers[q.questionText]?.answer !== undefined &&
      answers[q.questionText]?.answer !== ''
  ).length;
  const progress = totalRequired > 0 ? Math.round((answeredRequired / totalRequired) * 100) : 0;
  const allDone = progress === 100;
  const isLastStep = currentStep === questions.length - 1;

  // ── Group questions by category (admin can preview the grouping too) ─────
  type Group = { category: string | null; items: { q: any; idx: number }[] };
  const visibleQuestions = mode === 'step' ? [questions[currentStep]] : questions;
  const groups: Group[] = (() => {
    const out: Group[] = [];
    const map = new Map<string, number>();
    visibleQuestions.forEach((q, i) => {
      const realIdx = mode === 'step' ? currentStep : i;
      const cat = (q as any).category?.trim?.() || null;
      const key = cat || '__ungrouped__';
      let g = map.get(key);
      if (g === undefined) {
        g = out.length;
        map.set(key, g);
        out.push({ category: cat, items: [] });
      }
      out[g].items.push({ q, idx: realIdx });
    });
    return out;
  })();

  // ── Renderers ────────────────────────────────────────────────────────────
  const RatingInput = ({ question }: { question: any }) => {
    const min = question.ratingConfig?.minRating ?? 1;
    const max = question.ratingConfig?.maxRating ?? 5;
    const labels = question.ratingConfig?.ratingLabels ?? [];
    const selected = answers[question.questionText]?.answer;
    const style: 'number' | 'star' | 'emoji' = question.ratingStyle || 'number';
    const count = max - min + 1;
    const values = Array.from({ length: count }, (_, i) => min + i);
    const EMOJIS = ['😞', '🙁', '😐', '🙂', '😀', '🤩'];
    const pickEmoji = (i: number) => {
      if (count <= 1) return EMOJIS[EMOJIS.length - 1];
      const t = i / (count - 1);
      return EMOJIS[Math.round(t * (EMOJIS.length - 1))];
    };

    // The stored label for the picked value — shown only after selection so
    // the scale stays clean (mirrors the student view).
    const selectedLabel =
      typeof selected === 'number' ? labels[selected - min] || '' : '';
    const labelStrip = selectedLabel && (
      <p className="text-[11px] font-semibold text-indigo-600 mt-1.5">{selectedLabel}</p>
    );

    if (style === 'star') {
      return (
        <div className="mt-2.5">
          <div className="flex items-center gap-1">
            {values.map((val) => {
              const active = typeof selected === 'number' && selected >= val;
              return (
                <button
                  key={val}
                  onClick={() => setAnswer(question.questionText, val)}
                  aria-label={`Rate ${val} of ${max}`}
                  className="p-0.5 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-7 h-7 ${
                      active
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-200 hover:text-amber-300'
                    }`}
                  />
                </button>
              );
            })}
            {typeof selected === 'number' && (
              <span className="ml-2 text-[11px] text-gray-500">
                {selected} / {max}
                {selectedLabel && (
                  <span className="ml-1.5 font-semibold text-amber-600">{selectedLabel}</span>
                )}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (style === 'emoji') {
      return (
        <div className="mt-2.5">
          <div className="flex flex-wrap gap-2">
            {values.map((val, i) => {
              const active = selected === val;
              return (
                <button
                  key={val}
                  onClick={() => setAnswer(question.questionText, val)}
                  aria-label={`Rate ${val} of ${max}`}
                  className={`w-11 h-11 rounded-full border text-[22px] leading-none flex items-center justify-center transition-all
                    ${
                      active
                        ? 'bg-indigo-50 border-indigo-400 scale-110'
                        : 'bg-white border-gray-200 hover:border-indigo-300 grayscale opacity-60 hover:grayscale-0 hover:opacity-100'
                    }`}
                >
                  {pickEmoji(i)}
                </button>
              );
            })}
          </div>
          {labelStrip}
        </div>
      );
    }

    return (
      <div className="mt-2.5">
        <div className="flex flex-wrap gap-1.5">
          {values.map((val) => {
            const active = selected === val;
            return (
              <button
                key={val}
                onClick={() => setAnswer(question.questionText, val)}
                className={`w-9 h-9 rounded-md text-[13px] font-medium border transition-colors
                  ${
                    active
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-400 hover:text-indigo-600'
                  }`}
              >
                {val}
              </button>
            );
          })}
        </div>
        {labelStrip}
      </div>
    );
  };

  const TextAnswer = ({ question }: { question: any }) => {
    const value = answers[question.questionText]?.answer || '';
    const max = question.maxLength || 500;
    const textLen = htmlTextLength(value);
    return (
      <div className="mt-2.5 feedback-tiptap">
        <TipTapEditor
          value={value}
          onChange={(html: string) => {
            // Only whitespace / empty tags counts as empty.
            setAnswer(question.questionText, htmlTextLength(html) > 0 ? html : '');
          }}
          placeholder={question.placeholder || 'Type your answer here…'}
          minHeight="140px"
          maxHeight="260px"
          showToolbar={true}
          editable={true}
        />
        <p
          className={`text-[10px] text-right mt-1 ${
            textLen > max * 0.9 ? 'text-amber-600' : 'text-gray-400'
          }`}
        >
          {textLen} / {max}
        </p>
      </div>
    );
  };

  const QuestionRow = ({ question, index }: { question: any; index: number }) => {
    const answerData = answers[question.questionText];
    const answer = answerData?.answer;
    const isDone = answer !== undefined && answer !== '';
    const isRating = question.questionType === 'rating';

    return (
      <div className="py-4 first:pt-0 last:pb-0">
        <div className="flex items-start gap-3">
          {/* Number badge — stays a number after answering; only the color
              flips to show it's done (mirrors the student view). */}
          <div
            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors
              ${isDone ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}
          >
            {index + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] font-medium text-gray-900 leading-snug">
                {question.questionText}
                {question.isRequired && <span className="text-red-500 ml-0.5">*</span>}
              </p>
              {!isRating && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide bg-sky-50 text-sky-700">
                  <Pencil className="w-3 h-3" />
                  Text
                </span>
              )}
            </div>

            {isRating ? <RatingInput question={question} /> : <TextAnswer question={question} />}
          </div>
        </div>
      </div>
    );
  };

  const OverallSection = () => (
    <div className="py-4">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
        <p className="text-[13px] font-medium text-gray-900">
          {(feedback as any).overallReasonLabel || 'Additional comments'}
          <span className="text-[11px] font-normal text-gray-400 ml-1.5">(optional)</span>
        </p>
      </div>
      <p className="text-[11px] text-gray-500 mb-2 ml-5">
        Share any extra thoughts, suggestions, or feedback about this course.
      </p>
      <div className="feedback-tiptap">
        <TipTapEditor
          value={overallReason}
          onChange={(html: string) => {
            // Only whitespace / empty tags counts as empty.
            setOverallReason(htmlTextLength(html) > 0 ? html : '');
          }}
          placeholder={(feedback as any).overallReasonPlaceholder || 'Your thoughts here…'}
          minHeight="100px"
          maxHeight="200px"
          showToolbar={true}
          editable={true}
        />
      </div>
      <p className="text-[10px] text-gray-400 text-right mt-1">
        {htmlTextLength(overallReason)} characters
      </p>
    </div>
  );

  // ── Success screen ───────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div
        className={`${poppins.className} fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4`}
      >
        <div className="bg-white rounded-xl px-8 py-10 text-center max-w-sm w-full shadow-2xl border border-gray-200">
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-[15px] font-semibold text-gray-900 mb-1.5">Preview submitted</h3>
          <p className="text-[12px] text-gray-500">
            This was a preview — no responses were saved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${poppins.className} fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-5`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl w-full max-w-7xl h-[92vh] max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Preview
                </span>
                <span className="text-[11px] text-gray-400">
                  {questions.length} question{questions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <h2 className="text-[15px] font-semibold text-gray-900 leading-tight tracking-tight truncate">
                {feedback.feedbackTitle}
              </h2>
              {feedback.feedbackDescription && (
                <div
                  className="text-[11px] text-gray-500 mt-0.5 line-clamp-1 [&_p]:inline"
                  // Description is rich text (TipTap HTML)
                  dangerouslySetInnerHTML={{ __html: feedback.feedbackDescription }}
                />
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-gray-500 uppercase tracking-wide">
                {answeredRequired}/{totalRequired} required
              </span>
              <span className="font-semibold text-indigo-600">{progress}%</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>

            {mode === 'step' && (
              <div className="flex items-center gap-1 mt-2">
                {questions.map((q, i) => {
                  const done =
                    answers[q.questionText]?.answer !== undefined &&
                    answers[q.questionText]?.answer !== '';
                  const active = i === currentStep;
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentStep(i)}
                      className={`h-1 rounded-full transition-all duration-200 cursor-pointer
                        ${
                          active
                            ? 'w-5 bg-indigo-600'
                            : done
                            ? 'w-2.5 bg-indigo-300'
                            : 'w-2.5 bg-gray-200'
                        }`}
                      aria-label={`Question ${i + 1}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className={`flex-1 overflow-y-auto px-6 py-2 bg-white ${thinScroll}`}>
          {groups.map((group, gIdx) => (
            <div
              key={(group.category ?? '__ungrouped__') + '-' + gIdx}
              className={gIdx > 0 ? 'mt-4 pt-4 border-t border-gray-100' : ''}
            >
              {group.category && (
                <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-indigo-700">
                    {group.category}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
                  <span className="text-[10px] text-gray-400">
                    {group.items.length} question{group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <div className="divide-y divide-gray-100">
                {group.items.map(({ q, idx }) => (
                  <QuestionRow key={q._id?.$oid || q.questionText} question={q} index={idx} />
                ))}
              </div>
            </div>
          ))}

          {allowOverallReason && (mode === 'overview' || (mode === 'step' && isLastStep)) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <OverallSection />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                allDone ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            />
            <span className="text-[11px] text-gray-600 truncate">
              {allDone
                ? 'Ready to submit'
                : `${totalRequired - answeredRequired} required remaining`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => {
                setMode(mode === 'overview' ? 'step' : 'overview');
                setCurrentStep(0);
              }}
              className="text-[11px] font-medium text-gray-600 hover:text-indigo-600 transition-colors h-7 px-2.5 rounded-md hover:bg-white border border-transparent hover:border-gray-200"
            >
              {mode === 'overview' ? 'Step-by-step' : 'Overview'}
            </button>

            {mode === 'step' && (
              <>
                <button
                  onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
                  disabled={currentStep === 0}
                  className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>
                {!isLastStep && (
                  <button
                    onClick={() =>
                      setCurrentStep((s) => Math.min(questions.length - 1, s + 1))
                    }
                    className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </>
            )}

            <button
              onClick={handleSubmit}
              disabled={!allDone}
              className={`inline-flex items-center gap-1.5 h-7 px-3.5 rounded-md text-[11px] font-semibold transition-colors
                ${
                  allDone
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              <Send className="w-3 h-3" />
              Submit Feedback
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
