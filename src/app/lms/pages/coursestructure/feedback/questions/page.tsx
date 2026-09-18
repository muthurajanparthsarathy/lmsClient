// app/lms/pages/coursestructure/feedback/questions/page.tsx
//
// Manage Questions — dedicated page for a feedback form's questions. Adding
// happens in a maximized bulk-add modal: "Add Question" opens 5 numbered
// empty questions filled like a form, more can be appended (6, 7, …), and one
// Save persists them all at once. Editing an existing question uses a smaller
// modal. The rating scale (min / max / labels / style) was defined when the
// form was created; every rating question added here inherits it.

'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Poppins } from 'next/font/google';
import {
  Home,
  BookMarked,
  MessageSquare,
  ListChecks,
  AlertCircle,
  ArrowLeft,
  Plus,
  Trash2,
  Type,
  Star,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import DashboardLayout from '../../../../component/layout';
import { StaffLayout } from '../../../../component/stafflayout/staff-layout';
import { getUserRole } from '../../coursestructurecomponents/types/util';
import { FeedbackQuestion, QuestionType, RatingStyle, RatingConfig } from '../types/feedback';
import { useGetFeedbackById, useUpdateFeedback } from '../hooks/useFeedback';
import { CategorySelect } from '../feedbackComponts/CategorySelect';
import {
  inputCls,
  labelCls,
  sectionHeaderCls,
  RatingScalePreview,
  DEFAULT_RATING_LABELS,
} from '../feedbackComponts/feedbackForm';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-poppins',
});

const defaultScale = (): RatingConfig => ({
  minRating: 1,
  maxRating: 5,
  ratingLabels: Object.values(DEFAULT_RATING_LABELS),
});

const STYLE_OPTIONS: { style: RatingStyle; label: string }[] = [
  { style: 'number', label: 'Number (1, 2, 3…)' },
  { style: 'star', label: 'Star (★ ★ ★ ★ ★)' },
  { style: 'emoji', label: 'Emoji (😞 😐 🙂 😀 🤩)' },
];

const styleLabel = (s: RatingStyle) =>
  STYLE_OPTIONS.find((o) => o.style === s)?.label || s;

// ─────────────────────────────────────────────────────────────────────────────
// QuestionModal — edit modal for an existing question. Fields: category,
// question text, answer type, rating style, required. The rating scale itself
// is form-level and shown read-only via the preview line. New questions are
// added via the inline bulk builder on the page, not here.
// ─────────────────────────────────────────────────────────────────────────────
interface QuestionModalProps {
  index: number;
  question: FeedbackQuestion;
  scale: RatingConfig;
  ratingMode: 'single' | 'custom';
  allowedStyles: RatingStyle[];
  existingCategories: string[];
  categoryQuestionCounts: Record<string, number>;
  onClose: () => void;
  onSubmit: (q: FeedbackQuestion) => void;
  onAddCategory: (cat: string) => void;
  onDeleteCategory: (cat: string) => void;
  onRenameCategory: (oldName: string, newName: string) => void;
}

const QuestionModal: React.FC<QuestionModalProps> = ({
  index,
  question,
  scale,
  ratingMode,
  allowedStyles,
  existingCategories,
  categoryQuestionCounts,
  onClose,
  onSubmit,
  onAddCategory,
  onDeleteCategory,
  onRenameCategory,
}) => {
  const [text, setText] = useState(question.questionText);
  const [type, setType] = useState<QuestionType>(question.questionType);
  const [required, setRequired] = useState(question.isRequired);
  const [category, setCategory] = useState(question.category || '');
  const [ratingStyle, setRatingStyle] = useState<RatingStyle>(
    ratingMode === 'single'
      ? allowedStyles[0] || 'number'
      : question.ratingStyle || allowedStyles[0] || 'number'
  );
  const textInputRef = useRef<HTMLInputElement>(null);

  // Esc closes + body scroll lock while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handleSave = () => {
    if (!text.trim()) {
      toast.error('Question text is required');
      return;
    }

    const rawCat = category.trim();
    const canonicalCat = rawCat
      ? existingCategories.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ?? rawCat
      : '';

    const built: FeedbackQuestion = {
      questionText: text.trim(),
      questionType: type,
      isRequired: required,
      order: question.order,
      ...(canonicalCat ? { category: canonicalCat } : {}),
    };
    if (type === 'rating') {
      built.ratingConfig = { ...scale };
      built.ratingStyle = ratingStyle;
    } else {
      built.maxLength = question.maxLength ?? 500;
      built.placeholder = question.placeholder || 'Enter your answer ';
    }

    onSubmit(built);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Edit Question {index + 1}
            </div>
            <h2 className="text-[14px] font-semibold text-gray-900 dark:text-white tracking-tight truncate mt-0.5">
              {question.questionText}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                Category{' '}
                <span className="text-gray-400 normal-case font-normal">(optional)</span>
              </label>
              <CategorySelect
                value={category}
                onChange={setCategory}
                categories={existingCategories}
                questionCounts={categoryQuestionCounts}
                onAddCategory={onAddCategory}
                onDeleteCategory={(cat) => {
                  onDeleteCategory(cat);
                  if (category === cat) setCategory('');
                }}
                onRenameCategory={(oldName, newName) => {
                  onRenameCategory(oldName, newName);
                  if (category === oldName) setCategory(newName);
                }}
              />
            </div>
            <div>
              <label className={labelCls}>Answer type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as QuestionType)}
                className={inputCls}
              >
                <option value="rating">Rating scale</option>
                <option value="text">Text answer</option>
              </select>
            </div>
          </div>

          {type === 'rating' && (
            <div>
              <label className={labelCls}>Rating style</label>
              {ratingMode === 'single' ? (
                <div
                  className={`${inputCls} flex items-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 cursor-not-allowed`}
                  title="Set on the feedback form — all questions use this style"
                >
                  {styleLabel(ratingStyle)}
                </div>
              ) : (
                <select
                  value={ratingStyle}
                  onChange={(e) => setRatingStyle(e.target.value as RatingStyle)}
                  className={inputCls}
                >
                  {STYLE_OPTIONS.filter((o) => allowedStyles.includes(o.style)).map((o) => (
                    <option key={o.style} value={o.style}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              <div className="mt-1">
                <RatingScalePreview
                  min={scale.minRating}
                  max={scale.maxRating}
                  style={ratingStyle}
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>
              Question text <span className="text-red-500">*</span>
            </label>
            <input
              ref={textInputRef}
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
              className={inputCls}
              autoFocus
            />
          </div>

          <label className="inline-flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300 select-none pt-1">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Required
          </label>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40">
          <button
            type="button"
            onClick={onClose}
            className="h-8 px-3 text-[12px] font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ManageQuestionsPage() {
  return (
    <Suspense
      fallback={
        <div className={`${poppins.className} flex justify-center items-center h-screen bg-white`}>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
        </div>
      }
    >
      <ManageQuestionsContent />
    </Suspense>
  );
}

function ManageQuestionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = searchParams.get('courseId') || '';
  const feedbackId = searchParams.get('feedbackId') || '';

  const [userRole, setUserRole] = useState<string>('');
  useEffect(() => {
    setUserRole(getUserRole());
  }, []);

  const { data: feedback, isLoading, isError } = useGetFeedbackById(feedbackId);
  const updateMutation = useUpdateFeedback();

  // Local working copy of the questions, synced from the server document.
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  useEffect(() => {
    if (feedback) setQuestions(feedback.questions || []);
  }, [feedback]);

  const scale: RatingConfig = feedback?.ratingScale?.maxRating
    ? feedback.ratingScale
    : defaultScale();

  // Rating mode set when the form was created. 'single' locks every rating
  // question to the form's one style; 'custom' lets each question pick from
  // the allowed list. Forms saved before modes existed keep free choice.
  const ratingMode: 'single' | 'custom' =
    scale.ratingMode || (scale.ratingStyle ? 'single' : 'custom');
  const allowedStyles: RatingStyle[] =
    ratingMode === 'single'
      ? [scale.ratingStyle || 'number']
      : scale.allowedRatingStyles?.length
      ? scale.allowedRatingStyles
      : ['number', 'star', 'emoji'];

  // Index of the question being edited in the modal, or null.
  const [editIndex, setEditIndex] = useState<number | null>(null);

  // ── Bulk add builder ───────────────────────────────────────────────────────
  // "Add Question" opens a set of empty draft rows; the user fills as many as
  // they want (adding more rows as needed) and one Save persists them all.
  type DraftQuestion = {
    questionText: string;
    category: string;
    questionType: QuestionType;
    // '' in custom mode = not chosen yet — the type must be picked per
    // question before saving.
    ratingStyle: RatingStyle | '';
    isRequired: boolean;
  };

  const formRatingStyle: RatingStyle = allowedStyles[0] || 'number';

  const emptyDraft = (from?: DraftQuestion): DraftQuestion => ({
    questionText: '',
    // New rows reuse the previous row's category / type so a batch of similar
    // questions doesn't need re-selecting every time. The rating style is NOT
    // inherited in custom mode — it must be chosen per question.
    category: from?.category ?? '',
    questionType: from?.questionType ?? 'rating',
    ratingStyle: ratingMode === 'single' ? formRatingStyle : '',
    isRequired: from?.isRequired ?? true,
  });

  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const builderOpen = drafts.length > 0;

  const openBuilder = () => {
    // Open the bulk-add modal pre-filled with 5 numbered empty questions —
    // like a paper form; more can be appended one by one.
    if (!builderOpen) setDrafts(Array.from({ length: 5 }, () => emptyDraft()));
  };

  const addDraftRow = () =>
    setDrafts((prev) => [...prev, emptyDraft(prev[prev.length - 1])]);

  const updateDraft = (i: number, patch: Partial<DraftQuestion>) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  const removeDraftRow = (i: number) =>
    setDrafts((prev) => prev.filter((_, idx) => idx !== i));

  const saveDrafts = () => {
    const filled = drafts.filter((d) => d.questionText.trim());
    if (filled.length === 0) {
      toast.error('Enter at least one question before saving');
      return;
    }
    if (ratingMode === 'custom') {
      // Custom mode: every rating question must say which type it uses.
      const missingAt = drafts.findIndex(
        (d) => d.questionText.trim() && d.questionType === 'rating' && !d.ratingStyle
      );
      if (missingAt !== -1) {
        toast.error(`Select a rating type for question ${missingAt + 1}`);
        return;
      }
    }
    const built = filled.map((d, i) => {
      const rawCat = d.category.trim();
      const canonicalCat = rawCat
        ? existingCategories.find((c) => c.toLowerCase() === rawCat.toLowerCase()) ?? rawCat
        : '';
      const q: FeedbackQuestion = {
        questionText: d.questionText.trim(),
        questionType: d.questionType,
        isRequired: d.isRequired,
        order: questions.length + i + 1,
        ...(canonicalCat ? { category: canonicalCat } : {}),
      };
      if (d.questionType === 'rating') {
        q.ratingConfig = { ...scale };
        // Single mode locks every question to the form's one style; custom
        // mode was validated above, so the style is set.
        q.ratingStyle =
          ratingMode === 'single' ? formRatingStyle : (d.ratingStyle as RatingStyle);
      } else {
        q.maxLength = 500;
        q.placeholder = 'Enter your answer ';
      }
      return q;
    });
    persist([...questions, ...built]);
    setDrafts([]);
    toast.success(`${built.length} question${built.length === 1 ? '' : 's'} added`);
  };

  // Categories added via the dropdown that no question uses yet.
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);

  const existingCategories = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [
      ...questions.map((q) => q.category).filter((v): v is string => !!v),
      ...pendingCategories,
    ]) {
      const key = c.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(c);
      }
    }
    return out;
  })();

  const categoryQuestionCounts: Record<string, number> = {};
  questions.forEach((q) => {
    if (q.category) {
      categoryQuestionCounts[q.category] = (categoryQuestionCounts[q.category] || 0) + 1;
    }
  });

  // Persist a new questions array to the server and reflect it locally.
  const persist = (next: FeedbackQuestion[]) => {
    setQuestions(next);
    updateMutation.mutate({ id: feedbackId, data: { questions: next } });
  };

  const handleAddCategory = (cat: string) => {
    setPendingCategories((prev) =>
      prev.some((c) => c.toLowerCase() === cat.toLowerCase()) ? prev : [...prev, cat]
    );
    toast.success(`Category "${cat}" added`);
  };

  const handleDeleteCategory = (cat: string) => {
    setPendingCategories((prev) => prev.filter((c) => c !== cat));
    if (questions.some((q) => q.category === cat)) {
      persist(questions.map((q) => (q.category === cat ? { ...q, category: undefined } : q)));
    }
    setDrafts((prev) => prev.map((d) => (d.category === cat ? { ...d, category: '' } : d)));
    toast.success(`Category "${cat}" removed`);
  };

  const handleRenameCategory = (oldName: string, newName: string) => {
    const match = existingCategories.find(
      (c) => c !== oldName && c.toLowerCase() === newName.toLowerCase()
    );
    const canonical = match ?? newName;
    setPendingCategories((prev) => {
      const next = prev.map((c) => (c === oldName ? canonical : c));
      return next.filter(
        (c, i) => next.findIndex((o) => o.toLowerCase() === c.toLowerCase()) === i
      );
    });
    if (questions.some((q) => q.category === oldName)) {
      persist(
        questions.map((q) => (q.category === oldName ? { ...q, category: canonical } : q))
      );
    }
    setDrafts((prev) =>
      prev.map((d) => (d.category === oldName ? { ...d, category: canonical } : d))
    );
    toast.success(
      match ? `Merged "${oldName}" into "${canonical}"` : `Renamed to "${canonical}"`
    );
  };

  const saveEditedQuestion = (index: number, updated: FeedbackQuestion) => {
    const next = [...questions];
    next[index] = { ...updated, order: next[index]?.order ?? index + 1 };
    persist(next);
    setEditIndex(null);
    toast.success('Question updated');
  };

  const removeQuestion = (index: number) => {
    persist(questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i + 1 })));
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const next = [...questions];
    const temp = next[index];
    next[index] = next[newIndex];
    next[newIndex] = temp;
    persist(next.map((q, i) => ({ ...q, order: i + 1 })));
  };

  const getQuestionTypeIcon = (type: QuestionType) =>
    type === 'rating' ? <Star className="h-3 w-3" /> : <Type className="h-3 w-3" />;

  const getQuestionTypeLabel = (type: QuestionType) => (type === 'rating' ? 'Rating' : 'Text');

  const backToList = () => {
    router.push(
      `/lms/pages/coursestructure/feedback${courseId ? `?courseId=${courseId}` : ''}`
    );
  };

  const scaleLabels = scale.ratingLabels || [];

  const pageContent = (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`${poppins.className} h-full flex flex-col bg-white dark:bg-gray-950 overflow-hidden`}
    >
      {/* Breadcrumb */}
      <div className="px-4 pt-2">
        <Breadcrumb>
          <BreadcrumbList className="text-[11px]">
            <BreadcrumbItem>
              <BreadcrumbLink
                href={
                  userRole === 'admin' || userRole === 'ldhead' || userRole === 'subhead' || userRole === 'programcoordinator'
                    ? '/lms/pages/admindashboard'
                    : '/lms/pages/staffdashboard'
                }
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                <Home className="h-3 w-3" />
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-gray-300 dark:text-gray-600" />
            <BreadcrumbItem>
              <BreadcrumbLink
                href="/lms/pages/coursestructure"
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                <BookMarked className="h-3 w-3" />
                Courses
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-gray-300 dark:text-gray-600" />
            <BreadcrumbItem>
              <BreadcrumbLink
                href={`/lms/pages/coursestructure/feedback${courseId ? `?courseId=${courseId}` : ''}`}
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                <MessageSquare className="h-3 w-3" />
                Feedback
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="text-gray-300 dark:text-gray-600" />
            <BreadcrumbItem>
              <BreadcrumbPage className="flex items-center gap-1 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                <ListChecks className="h-3 w-3" />
                Manage Questions
              </BreadcrumbPage>
            </BreadcrumbItem>
            {feedback?.feedbackTitle && (
              <>
                <BreadcrumbSeparator className="text-gray-300 dark:text-gray-600" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 max-w-[240px] truncate">
                    {feedback.feedbackTitle}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Title row */}
      <div className="px-4 pt-1.5 pb-2 flex items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={backToList}
            className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors shrink-0"
            title="Back to feedback forms"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold text-gray-900 dark:text-white tracking-tight leading-tight truncate">
              {feedback?.feedbackTitle || 'Manage Questions'}
            </h1>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-2">
              <span>
                <span className="font-medium text-gray-400 dark:text-gray-500">Scale:</span>{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {scale.minRating}–{scale.maxRating}
                </span>
              </span>
              {scaleLabels.length > 0 && (
                <span className="truncate">
                  {scale.minRating} {scaleLabels[0]} … {scale.maxRating}{' '}
                  {scaleLabels[scaleLabels.length - 1]}
                </span>
              )}
              <span>
                <span className="font-medium text-gray-400 dark:text-gray-500">Type:</span>{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {ratingMode === 'single'
                    ? `${formRatingStyle} (all questions)`
                    : allowedStyles.join(' / ')}
                </span>
              </span>
              <span className="text-gray-400 dark:text-gray-500">
                (set when the form was created)
              </span>
            </div>
          </div>
        </div>
        {feedbackId && feedback && (
          <button
            onClick={openBuilder}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[12px] font-medium transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Question
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto px-4 py-4">
        {!feedbackId ? (
          <div className="max-w-md mx-auto mt-16 text-center">
            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No feedback form selected — go back to the list and choose Manage Questions.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          </div>
        ) : isError || !feedback ? (
          <div className="max-w-md mx-auto mt-16 text-center">
            <AlertCircle className="h-6 w-6 text-red-500 mx-auto mb-2" />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Could not load this feedback form.
            </p>
          </div>
        ) : (
          <div className="w-full">
            <section>
              <h3 className={sectionHeaderCls}>
                Questions{' '}
                <span className="text-gray-400 normal-case">({questions.length})</span>
              </h3>
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-md">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800 w-10">
                        #
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800">
                        Question
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800">
                        Category
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800">
                        Type
                      </th>
                      <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-800">
                        Rating Style
                      </th>
                      <th className="px-4 py-2 text-right text-[11px] font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {questions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center">
                          <p className="text-[12px] text-gray-400 dark:text-gray-500 mb-3">
                            No questions added yet.
                          </p>
                          <button
                            onClick={openBuilder}
                            className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px] font-medium border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add your first questions
                          </button>
                        </td>
                      </tr>
                    ) : (
                      questions.map((question, index) => (
                        <tr
                          key={index}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-3 py-2.5 whitespace-nowrap border-r border-gray-200 dark:border-gray-800">
                            <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 border-r border-gray-200 dark:border-gray-800">
                            <p className="text-[13px] text-gray-900 dark:text-white line-clamp-2">
                              {question.questionText}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap border-r border-gray-200 dark:border-gray-800">
                            {question.category ? (
                              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                {question.category}
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap border-r border-gray-200 dark:border-gray-800">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                              {getQuestionTypeIcon(question.questionType)}
                              {getQuestionTypeLabel(question.questionType)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap border-r border-gray-200 dark:border-gray-800">
                            {question.questionType === 'rating' ? (
                              <span className="text-[12px] text-gray-700 dark:text-gray-300 capitalize">
                                {question.ratingStyle || 'number'}
                                <span className="ml-1.5 text-[11px] text-gray-400">
                                  ({scale.minRating}–{scale.maxRating})
                                </span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => moveQuestion(index, 'up')}
                                disabled={index === 0}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                                title="Move up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestion(index, 'down')}
                                disabled={index === questions.length - 1}
                                className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                                title="Move down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditIndex(index)}
                                className="p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                                title="Edit question"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeQuestion(index)}
                                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                                title="Remove"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Bulk add modal — maximized; numbered questions filled like a form,
          one Save persists them all. */}
      {builderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-800 w-[96vw] max-w-6xl h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Add Questions
                </div>
                {feedback?.feedbackTitle && (
                  <div className="text-[13px] font-semibold text-gray-900 dark:text-white mt-0.5 truncate max-w-[60vw]">
                    {feedback.feedbackTitle}
                  </div>
                )}
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  Fill the questions below like a form — add more if needed, then save them
                  all at once.{' '}
                  <span className="font-medium text-gray-600 dark:text-gray-300">
                    {drafts.filter((d) => d.questionText.trim()).length} of {drafts.length}{' '}
                    filled
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrafts([])}
                aria-label="Close"
                className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body — numbered question blocks with breathing room */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-5 max-w-4xl mx-auto">
                {drafts.map((draft, i) => (
                  <div
                    key={i}
                    className="rounded-md border border-gray-200 dark:border-gray-800 p-4 bg-gray-50/40 dark:bg-gray-900/40"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-gray-700 dark:text-gray-200">
                        <span className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-indigo-600 text-white text-[11px]">
                          {i + 1}
                        </span>
                        Question {i + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <label
                          className="inline-flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 select-none"
                          title="Required"
                        >
                          <input
                            type="checkbox"
                            checked={draft.isRequired}
                            onChange={(e) => updateDraft(i, { isRequired: e.target.checked })}
                            className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          onClick={() => removeDraftRow(i)}
                          disabled={drafts.length === 1}
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed rounded"
                          title="Remove this question"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      value={draft.questionText}
                      onChange={(e) => updateDraft(i, { questionText: e.target.value })}
                      className={inputCls}
                      placeholder={`Enter question ${i + 1}…`}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                      <div>
                        <label className={labelCls}>
                          Category{' '}
                          <span className="text-gray-400 normal-case font-normal">
                            (optional)
                          </span>
                        </label>
                        <CategorySelect
                          value={draft.category}
                          onChange={(cat) => updateDraft(i, { category: cat })}
                          categories={existingCategories}
                          questionCounts={categoryQuestionCounts}
                          onAddCategory={handleAddCategory}
                          onDeleteCategory={handleDeleteCategory}
                          onRenameCategory={handleRenameCategory}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Answer type</label>
                        <select
                          value={draft.questionType}
                          onChange={(e) =>
                            updateDraft(i, { questionType: e.target.value as QuestionType })
                          }
                          className={inputCls}
                        >
                          <option value="rating">Rating scale</option>
                          <option value="text">Text answer</option>
                        </select>
                      </div>
                      {draft.questionType === 'rating' && (
                        <div>
                          <label className={labelCls}>
                            Rating type{' '}
                            {ratingMode === 'custom' && <span className="text-red-500">*</span>}
                          </label>
                          {ratingMode === 'single' ? (
                            <div
                              className={`${inputCls} flex items-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 cursor-not-allowed`}
                              title="Set on the feedback form — all questions use this style"
                            >
                              {styleLabel(formRatingStyle)}
                            </div>
                          ) : (
                            <select
                              value={draft.ratingStyle}
                              onChange={(e) =>
                                updateDraft(i, { ratingStyle: e.target.value as RatingStyle })
                              }
                              className={`${inputCls} ${
                                draft.questionText.trim() && !draft.ratingStyle
                                  ? 'border-red-300 dark:border-red-800'
                                  : ''
                              }`}
                            >
                              <option value="" disabled>
                                Select rating type…
                              </option>
                              {STYLE_OPTIONS.filter((o) =>
                                allowedStyles.includes(o.style)
                              ).map((o) => (
                                <option key={o.style} value={o.style}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Next question appears right below the last one */}
                <button
                  type="button"
                  onClick={addDraftRow}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-9 text-[12px] font-medium border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add question {drafts.length + 1}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40">
              <button
                type="button"
                onClick={() => setDrafts([])}
                className="h-8 px-3 text-[12px] font-medium text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDrafts}
                disabled={updateMutation.isPending}
                className="inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Check className="h-3.5 w-3.5" />
                Save all ({drafts.filter((d) => d.questionText.trim()).length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit question modal */}
      {editIndex !== null && questions[editIndex] && (
        <QuestionModal
          index={editIndex}
          question={questions[editIndex]}
          scale={scale}
          ratingMode={ratingMode}
          allowedStyles={allowedStyles}
          existingCategories={existingCategories}
          categoryQuestionCounts={categoryQuestionCounts}
          onClose={() => setEditIndex(null)}
          onSubmit={(q) => saveEditedQuestion(editIndex, q)}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
          onRenameCategory={handleRenameCategory}
        />
      )}
    </motion.div>
  );

  if (
    userRole === 'admin' ||
    userRole === 'ldhead' ||
    userRole === 'subhead' ||
    userRole === 'programcoordinator'
  ) {
    return <DashboardLayout>{pageContent}</DashboardLayout>;
  }

  return <StaffLayout>{pageContent}</StaffLayout>;
}
