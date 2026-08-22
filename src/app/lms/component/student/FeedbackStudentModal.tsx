import { getToken } from "@/lib/session";
// components/FeedbackStudentModal.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Send, CheckCircle, MessageSquare,
  ChevronLeft, ChevronRight,
  Star, Pencil,
} from 'lucide-react';
import { Poppins } from 'next/font/google';
import { Feedback } from '@/app/lms/pages/coursestructure/feedback/types/feedback';
import toast from 'react-hot-toast';
import { useSubmitStudentResponse } from '../../pages/coursestructure/feedback/hooks/useFeedback';
import TipTapEditor from '../tiptopEditor';

// Strip HTML tags to count visible characters for the rich-text answer.
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

interface FeedbackStudentModalProps {
  feedback: Feedback | null;
  isOpen: boolean;
  onClose: () => void;
  courseId: string;
  // 'modal' (default) floats over the current page with a backdrop;
  // 'page' renders as a normal full page for the dedicated feedback route.
  variant?: 'modal' | 'page';
}

interface AnswerData {
  answer: any;
  reason: string;
}

const thinScroll =
  '[scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] ' +
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full ' +
  'hover:[&::-webkit-scrollbar-thumb]:bg-gray-400';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components defined OUTSIDE the parent so they are stable across renders.
// ─────────────────────────────────────────────────────────────────────────────

interface RatingInputProps {
  question: any;
  selectedAnswer: any;
  onAnswer: (qText: string, value: any) => void;
}

// Emoji ladder — worst → best. We pick a slice that fits the question's value
// range so a 1–3 scale uses the first three and 1–5 uses all five.
const EMOJI_LADDER = ['😞', '🙁', '😐', '🙂', '😀', '🤩'];

const RatingInput: React.FC<RatingInputProps> = ({ question, selectedAnswer, onAnswer }) => {
  const min = question.ratingConfig?.minRating ?? 1;
  const max = question.ratingConfig?.maxRating ?? 5;
  const labels = question.ratingConfig?.ratingLabels ?? [];
  const style: 'number' | 'star' | 'emoji' = question.ratingStyle || 'number';
  const count = max - min + 1;
  const values = Array.from({ length: count }, (_, i) => min + i);

  // The label stored for a value on the form's rating scale — shown only
  // after the student picks, so the scale itself stays clean.
  const labelFor = (val: any): string =>
    typeof val === 'number' ? labels[val - min] || '' : '';
  const selectedLabel = labelFor(selectedAnswer);

  // ── Star style ─────────────────────────────────────────────────────────
  if (style === 'star') {
    return (
      <div className="mt-2.5">
        <div className="flex items-center gap-1">
          {values.map((val) => {
            const active = typeof selectedAnswer === 'number' && selectedAnswer >= val;
            return (
              <button
                key={val}
                onClick={() => onAnswer(question.questionText, val)}
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
          {typeof selectedAnswer === 'number' && (
            <span className="ml-2 text-2xs text-gray-500">
              {selectedAnswer} / {max}
              {selectedLabel && (
                <span className="ml-1.5 font-semibold text-amber-600">{selectedLabel}</span>
              )}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Emoji style ────────────────────────────────────────────────────────
  if (style === 'emoji') {
    // Distribute the available emojis across the scale so the first emoji
    // maps to `min` and the last to `max` regardless of how many steps.
    const pickEmoji = (i: number) => {
      if (count <= 1) return EMOJI_LADDER[EMOJI_LADDER.length - 1];
      const t = i / (count - 1);
      const idx = Math.round(t * (EMOJI_LADDER.length - 1));
      return EMOJI_LADDER[idx];
    };
    return (
      <div className="mt-2.5">
        <div className="flex flex-wrap gap-2">
          {values.map((val, i) => {
            const active = selectedAnswer === val;
            return (
              <button
                key={val}
                onClick={() => onAnswer(question.questionText, val)}
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
        {selectedLabel && (
          <p className="text-2xs font-semibold text-indigo-600 mt-1.5">{selectedLabel}</p>
        )}
      </div>
    );
  }

  // ── Number style (default) ─────────────────────────────────────────────
  return (
    <div className="mt-2.5">
      <div className="flex flex-wrap gap-1.5">
        {values.map((val) => {
          const active = selectedAnswer === val;
          return (
            <button
              key={val}
              onClick={() => onAnswer(question.questionText, val)}
              className={`w-9 h-9 rounded-md text-sm font-medium border transition-colors
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

      {selectedLabel && (
        <p className="text-2xs font-semibold text-indigo-600 mt-1.5">{selectedLabel}</p>
      )}
    </div>
  );
};

interface TextInputProps {
  question: any;
  value: string;
  onAnswer: (qText: string, value: any) => void;
}

const TextInput: React.FC<TextInputProps> = ({ question, value, onAnswer }) => {
  const max = question.maxLength || 500;
  const textLen = htmlTextLength(value || '');
  return (
    <div className="mt-2.5 feedback-tiptap">
      <TipTapEditor
        value={value || ''}
        onChange={(html: string) => {
          // Treat an editor with only whitespace / empty tags as truly empty
          // so the "required answered" check keeps working unchanged.
          const text = htmlTextLength(html).valueOf();
          onAnswer(question.questionText, text > 0 ? html : '');
        }}
        placeholder={question.placeholder || 'Type your answer here…'}
        minHeight="140px"
        maxHeight="260px"
        showToolbar={true}
        editable={true}
      />
      <p
        className={`text-2xs text-right mt-1 ${
          textLen > max * 0.9 ? 'text-amber-600' : 'text-gray-400'
        }`}
      >
        {textLen} / {max}
      </p>
    </div>
  );
};

interface QuestionCardProps {
  question: any;
  index: number;
  answerData: AnswerData | undefined;
  onAnswer: (qText: string, value: any) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  answerData,
  onAnswer,
}) => {
  const answer = answerData?.answer;
  const isDone = answer !== undefined && answer !== '';
  const isRating = question.questionType === 'rating';

  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        {/* Number badge */}
        {/* Number badge — stays a number after answering; only the color
            flips to show it's done. */}
        <div
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-2xs font-semibold transition-colors
            ${isDone ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          {/* Question header */}
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-900 leading-snug">
              {question.questionText}
              {question.isRequired && <span className="text-red-500 ml-0.5">*</span>}
            </p>
            {!isRating && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded uppercase tracking-wide bg-sky-50 text-sky-700">
                <Pencil className="w-3 h-3" />
                Text
              </span>
            )}
          </div>

          {/* Answer input */}
          {isRating ? (
            <RatingInput question={question} selectedAnswer={answer} onAnswer={onAnswer} />
          ) : (
            <TextInput question={question} value={answer || ''} onAnswer={onAnswer} />
          )}
        </div>
      </div>
    </div>
  );
};

interface OverallSectionProps {
  feedback: Feedback;
  value: string;
  onChange: (val: string) => void;
}

const OverallSection: React.FC<OverallSectionProps> = ({ feedback, value, onChange }) => (
  <div className="py-4">
    <div className="flex items-center gap-2 mb-1">
      <MessageSquare className="w-3.5 h-3.5 text-indigo-500" />
      <p className="text-sm font-medium text-gray-900">
        {(feedback as any).overallReasonLabel || 'Additional comments'}
        <span className="text-2xs font-normal text-gray-400 ml-1.5">(optional)</span>
      </p>
    </div>
    <p className="text-2xs text-gray-500 mb-2 ml-5">
      Share any extra thoughts, suggestions, or feedback about this course.
    </p>
    <div className="feedback-tiptap">
      <TipTapEditor
        value={value}
        onChange={(html: string) => {
          // Only whitespace / empty tags counts as empty.
          onChange(htmlTextLength(html) > 0 ? html : '');
        }}
        placeholder={(feedback as any).overallReasonPlaceholder || 'Your thoughts here…'}
        minHeight="100px"
        maxHeight="200px"
        showToolbar={true}
        editable={true}
      />
    </div>
    <p className="text-2xs text-gray-400 text-right mt-1">
      {htmlTextLength(value)} characters
    </p>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main modal component
// ─────────────────────────────────────────────────────────────────────────────

export const FeedbackStudentModal: React.FC<FeedbackStudentModalProps> = ({
  feedback,
  isOpen,
  onClose,
  courseId,
  variant = 'modal',
}) => {
  const isPage = variant === 'page';
  // Modal floats over the page; page variant is a plain white full page —
  // no card, no backdrop.
  const wrapperCls = isPage
    ? 'min-h-screen bg-white flex items-stretch justify-center'
    : 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-5';
  const cardCls = isPage
    ? 'bg-white w-full max-w-7xl h-screen flex flex-col overflow-hidden'
    : 'bg-white rounded-xl w-full max-w-7xl h-[92vh] max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden';
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerData>>({});
  const [overallReason, setOverall] = useState('');
  const [mode, setMode] = useState<'overview' | 'step'>('overview');
  const [isSubmitted, setSubmitted] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);

  const submitMutation = useSubmitStudentResponse();

  useEffect(() => {
    if (isOpen && feedback) {
      setStep(0);
      setAnswers({});
      setOverall('');
      setSubmitted(false);
      setMode('overview');
    }
  }, [isOpen, feedback]);

  const setAnswer = useCallback(
    (qText: string, value: any) =>
      setAnswers((p) => ({ ...p, [qText]: { ...p[qText], answer: value } })),
    []
  );

  if (!feedback || !isOpen) return null;

  const questions = feedback.questions || [];
  const totalRequired = questions.filter((q) => q.isRequired).length;
  const answeredReq = questions.filter(
    (q) =>
      q.isRequired &&
      answers[q.questionText]?.answer !== undefined &&
      answers[q.questionText]?.answer !== ''
  ).length;
  const progressPct = totalRequired > 0 ? Math.round((answeredReq / totalRequired) * 100) : 0;
  const allDone = progressPct === 100;
  const allowOverall = (feedback as any).allowOverallReason !== false;
  const isLastStep = step === questions.length - 1;

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const missing = questions.filter(
      (q) =>
        q.isRequired &&
        (!answers[q.questionText] ||
          answers[q.questionText].answer === '' ||
          answers[q.questionText].answer === undefined)
    );
    if (missing.length) {
      toast.error('Answer all required questions before submitting.');
      return;
    }

    const token = getToken() || localStorage.getItem('token');
    if (!token) {
      toast.error('Please login again to submit feedback');
      return;
    }

    setSubmitting(true);
    try {
      await submitMutation.mutateAsync({
        feedbackId: (feedback as any)._id,
        data: {
          answers: Object.entries(answers).map(([questionText, d]) => ({
            questionText,
            answer: d.answer,
            reason: d.reason || '',
          })),
          overallReason: overallReason || '',
        },
      });
      setSubmitted(true);
      toast.success('Feedback submitted.');
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 3000);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        toast.error(
          err?.response?.data?.message?.[0]?.value || 'Failed to submit. Please try again.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (isSubmitted) {
    return (
      <div
        className={`${poppins.className} ${
          isPage
            ? 'min-h-screen bg-white flex items-center justify-center p-4'
            : 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4'
        }`}
      >
        <div
          className={`bg-white px-8 py-10 text-center max-w-sm w-full ${
            isPage ? '' : 'rounded-xl shadow-2xl border border-gray-200'
          }`}
        >
          <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-md font-semibold text-gray-900 mb-1.5">Feedback submitted</h3>
          <p className="text-xs text-gray-500">
            Your responses have been recorded. Thank you for your feedback.
          </p>
          <div className="mt-5 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full w-full animate-pulse" />
          </div>
          <p className="text-2xs text-gray-400 mt-2 uppercase tracking-wide">
            Closing automatically…
          </p>
        </div>
      </div>
    );
  }

  // ── Main modal ──────────────────────────────────────────────────────────────
  const visibleQuestions = mode === 'step' ? [questions[step]] : questions;

  // Group visible questions by category, preserving each question's original
  // index in the full questions list so numbering / step semantics stay intact.
  const groupedVisible: { category: string | null; items: { q: any; idx: number }[] }[] = (() => {
    const groups: { category: string | null; items: { q: any; idx: number }[] }[] = [];
    const map = new Map<string, number>();
    visibleQuestions.forEach((q, i) => {
      const realIdx = mode === 'step' ? step : i;
      const cat = (q as any).category?.trim?.() || null;
      const key = cat || '__ungrouped__';
      let gIdx = map.get(key);
      if (gIdx === undefined) {
        gIdx = groups.length;
        map.set(key, gIdx);
        groups.push({ category: cat, items: [] });
      }
      groups[gIdx].items.push({ q, idx: realIdx });
    });
    return groups;
  })();

  return (
    <div className={`${poppins.className} ${wrapperCls}`}>
      <div className={cardCls}>
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center text-2xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                  Feedback
                </span>
                <span className="text-2xs text-gray-400">
                  {questions.length} question{questions.length !== 1 ? 's' : ''}
                </span>
              </div>
              <h2 className="text-md font-semibold text-gray-900 leading-tight tracking-tight truncate">
                {(feedback as any).feedbackTitle}
              </h2>
              {(feedback as any).feedbackDescription && (
                <div
                  className="text-2xs text-gray-500 mt-0.5 line-clamp-1 [&_p]:inline"
                  // Description is rich text (TipTap HTML)
                  dangerouslySetInnerHTML={{ __html: (feedback as any).feedbackDescription }}
                />
              )}
            </div>
            {!isPage && (
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-2xs mb-1">
              <span className="text-gray-500 uppercase tracking-wide">
                {answeredReq}/{totalRequired} required
              </span>
              <span className="font-semibold text-indigo-600">{progressPct}%</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Step dots */}
            {mode === 'step' && (
              <div className="flex items-center gap-1 mt-2">
                {questions.map((q, i) => {
                  const done =
                    answers[q.questionText]?.answer !== undefined &&
                    answers[q.questionText]?.answer !== '';
                  const active = i === step;
                  return (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      className={`h-1 rounded-full transition-all duration-200 cursor-pointer
                        ${active ? 'w-5 bg-indigo-600' : done ? 'w-2.5 bg-indigo-300' : 'w-2.5 bg-gray-200'}`}
                      aria-label={`Question ${i + 1}`}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div className={`flex-1 overflow-y-auto px-6 py-2 bg-white ${thinScroll}`}>
          {groupedVisible.map((group, gIdx) => (
            <div
              key={(group.category ?? '__ungrouped__') + '-' + gIdx}
              className={gIdx > 0 ? 'mt-4 pt-4 border-t border-gray-100' : ''}
            >
              {group.category && (
                <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-indigo-700">
                    {group.category}
                  </span>
                  <span className="h-px flex-1 bg-gradient-to-r from-indigo-200 to-transparent" />
                  <span className="text-2xs text-gray-400">
                    {group.items.length} question{group.items.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              <div className="divide-y divide-gray-100">
                {group.items.map(({ q, idx }) => (
                  <QuestionCard
                    key={q._id?.$oid || q.questionText}
                    question={q}
                    index={idx}
                    answerData={answers[q.questionText]}
                    onAnswer={setAnswer}
                  />
                ))}
              </div>
            </div>
          ))}

          {allowOverall && (mode === 'overview' || (mode === 'step' && isLastStep)) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <OverallSection feedback={feedback} value={overallReason} onChange={setOverall} />
            </div>
          )}
        </div>

        {/* ── Footer — buttons centered, status pinned left ── */}
        <div className="relative flex-shrink-0 px-5 py-2.5 border-t border-gray-100 bg-gray-50 flex items-center justify-center gap-3">
          {/* Status */}
          <div className="absolute left-5 hidden sm:flex items-center gap-1.5 min-w-0 max-w-[38%]">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors ${
                allDone ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            />
            <span className="text-2xs text-gray-600 truncate">
              {allDone
                ? 'Ready to submit'
                : `${totalRequired - answeredReq} required remaining`}
            </span>
          </div>

          {/* Controls — centered */}
          <div className="flex items-center justify-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => {
                setMode(mode === 'overview' ? 'step' : 'overview');
                setStep(0);
              }}
              className="text-2xs font-medium text-gray-600 hover:text-indigo-600 transition-colors h-7 px-2.5 rounded-md hover:bg-white border border-transparent hover:border-gray-200"
            >
              {mode === 'overview' ? 'Step-by-step' : 'Overview'}
            </button>

            {mode === 'step' && (
              <>
                <button
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="inline-flex items-center gap-1 h-7 px-2.5 text-2xs font-medium rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>
                {!isLastStep && (
                  <button
                    onClick={() => setStep((s) => Math.min(questions.length - 1, s + 1))}
                    className="inline-flex items-center gap-1 h-7 px-2.5 text-2xs font-medium rounded-md border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !allDone}
              className={`inline-flex items-center gap-1.5 h-7 px-3.5 rounded-md text-2xs font-semibold transition-colors
                ${allDone
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Sending…
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  Submit
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
