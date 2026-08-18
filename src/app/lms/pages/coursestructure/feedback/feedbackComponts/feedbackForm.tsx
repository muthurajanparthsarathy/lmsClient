// components/FeedbackForm.tsx
//
// Create / edit a feedback form as a TWO-STEP wizard (same model as
// ExerciseSettings): Step 1 = configuration — title, description, batch,
// trainer, rating scale, schedule; Step 2 = questions organised in tabs —
// "General" first, plus one tab per category ("Add Category" asks a name and
// opens a new tab). A card is just the question text + required; a
// per-question rating type appears only when Step 1's feedback type is
// Custom. One save at the end persists the form AND its questions together;
// edit reopens the same two steps pre-filled.

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Check,
  ListChecks,
  Settings2,
} from 'lucide-react';
import { Feedback, FeedbackQuestion, QuestionType, RatingStyle } from '../types/feedback';
import { useCourseRosterQuery } from '@/queries/courseRoster';
import { useCreateFeedback, useUpdateFeedback, useGetAllFeedback } from '../hooks/useFeedback';
import toast from 'react-hot-toast';
import TipTapEditor from '../../../../component/tiptopEditor';

interface FeedbackFormProps {
  courseId: string;
  feedback?: Feedback | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const inputCls =
  'w-full h-9 px-3 text-[13px] border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors';
export const labelCls =
  'block text-[11px] font-medium text-gray-600 dark:text-gray-300 mb-1 uppercase tracking-wide';
export const sectionHeaderCls =
  'text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3';

// Thin scrollbar for the step-content pane (sidebar stays fixed).
const scrollCls =
  '[scrollbar-width:thin] [scrollbar-color:#cbd5e1_transparent] ' +
  '[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full ' +
  'hover:[&::-webkit-scrollbar-thumb]:bg-gray-400 ' +
  'dark:[&::-webkit-scrollbar-thumb]:bg-gray-600 dark:hover:[&::-webkit-scrollbar-thumb]:bg-gray-500';

// Ready-made feedback titles; "custom" in the select frees a text input.
const TITLE_PRESETS = ['Beginning of Course', 'Mid of Course', 'End of Course'];

export const EMOJI_SCALE = ['😞', '😐', '🙂', '😀', '🤩'];

// Pick the emoji for a rating value, spread proportionally across the scale
// so any min/max range maps onto the 5 emojis.
export const emojiForValue = (value: number, min: number, max: number) => {
  if (max <= min) return EMOJI_SCALE[EMOJI_SCALE.length - 1];
  const idx = Math.round(((value - min) / (max - min)) * (EMOJI_SCALE.length - 1));
  return EMOJI_SCALE[Math.min(Math.max(idx, 0), EMOJI_SCALE.length - 1)];
};

// Default labels pre-filled for a fresh form — the user can edit or clear
// them. Keyed by rating value, matching the classic 1–5 scale.
export const DEFAULT_RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent',
};

// ─────────────────────────────────────────────────────────────────────────────
// RatingScalePreview — plain-English line showing exactly what students will
// see, adapted to the chosen rating style.
// ─────────────────────────────────────────────────────────────────────────────
export const RatingScalePreview: React.FC<{
  min: number;
  max: number;
  style: RatingStyle;
}> = ({ min, max, style }) => {
  const stars = (n: number) => '★'.repeat(Math.min(Math.max(n, 1), 10));

  return (
    <p className="text-[10px] text-gray-400 dark:text-gray-500">
      Students will rate from{' '}
      {style === 'star' ? (
        <>
          <span className="text-amber-500 tracking-tight">{stars(min)}</span>{' '}
          <span className="font-medium text-gray-600 dark:text-gray-300">
            ({min} star{min === 1 ? '' : 's'} — lowest)
          </span>{' '}
          to <span className="text-amber-500 tracking-tight">{stars(max)}</span>{' '}
          <span className="font-medium text-gray-600 dark:text-gray-300">
            ({max} star{max === 1 ? '' : 's'} — highest)
          </span>
        </>
      ) : style === 'emoji' ? (
        <>
          <span className="text-[13px] align-middle">{EMOJI_SCALE[0]}</span>{' '}
          <span className="font-medium text-gray-600 dark:text-gray-300">({min} — lowest)</span>{' '}
          to <span className="text-[13px] align-middle">{EMOJI_SCALE[EMOJI_SCALE.length - 1]}</span>{' '}
          <span className="font-medium text-gray-600 dark:text-gray-300">({max} — highest)</span>
        </>
      ) : (
        <>
          <span className="font-medium text-gray-600 dark:text-gray-300">{min}</span> (lowest) to{' '}
          <span className="font-medium text-gray-600 dark:text-gray-300">{max}</span> (highest)
        </>
      )}
      .
    </p>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RatingLabelsEditor — one row per rating value (min → max) with the value on
// the left and a text label on the right, e.g. 1 = Poor, 5 = Excellent. The
// left badge follows the chosen rating type: numbers, stars (★, ★★, …) or
// emojis, so the admin labels exactly what students will see.
// ─────────────────────────────────────────────────────────────────────────────
export const RatingLabelsEditor: React.FC<{
  min: number;
  max: number;
  labels: Record<number, string>;
  style?: RatingStyle;
  onChange: (value: number, label: string) => void;
}> = ({ min, max, labels, style = 'number', onChange }) => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const values = Array.from({ length: Math.min(hi - lo + 1, 10) }, (_, i) => lo + i);

  const badge = (v: number) => {
    if (style === 'star') {
      return (
        <span className="text-amber-500 text-[11px] tracking-tight leading-none">
          {'★'.repeat(v)}
        </span>
      );
    }
    if (style === 'emoji') {
      return <span className="text-[15px] leading-none">{emojiForValue(v, lo, hi)}</span>;
    }
    return <>{v}</>;
  };

  return (
    <div>
      <label className={labelCls}>
        Rating labels <span className="text-red-500">*</span>
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {values.map((v) => (
          <div key={v} className="flex items-center gap-2">
            <span
              className={`h-9 shrink-0 inline-flex items-center justify-center px-2 text-[12px] font-semibold rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 ${
                style === 'number' ? 'w-9 px-0' : 'min-w-[36px]'
              }`}
              title={`Rating value ${v}`}
            >
              {badge(v)}
            </span>
            <input
              type="text"
              value={labels[v] ?? ''}
              onChange={(e) => onChange(v, e.target.value)}
              placeholder={
                v === lo ? 'e.g. Poor' : v === hi ? 'e.g. Excellent' : `Label for ${v}`
              }
              className={inputCls}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Stored ratingLabels array (index 0 = min rating) → per-value map for editing.
// Falls back to the defaults so the editor opens with valid, editable values.
const labelsToMap = (
  minRating: number,
  ratingLabels?: string[]
): Record<number, string> => {
  const out: Record<number, string> = {};
  (ratingLabels || []).forEach((label, i) => {
    if (label) out[minRating + i] = label;
  });
  return Object.keys(out).length > 0 ? out : { ...DEFAULT_RATING_LABELS };
};

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  courseId,
  feedback,
  onSuccess,
  onCancel,
}) => {
  // '' = nothing picked yet, a preset's text, or 'custom' (free typing).
  const [titleChoice, setTitleChoice] = useState<string>('');

  const [formData, setFormData] = useState({
    feedbackTitle: '',
    feedbackDescription: '',
    isPublished: false,
    isAnonymousAllowed: true,
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    // Extra submission window after endDate — a plain date; the number of
    // grace days is derived from the gap to endDate.
    gracePeriodEndDate: '',
    maxAttempts: 1,
    batchId: '' as string,
    batchName: '' as string,
    trainerId: '' as string,
    trainerName: '' as string,
    trainerEmail: '' as string,
  });

  // ── Form-level rating scale ────────────────────────────────────────────────
  const [scaleMin, setScaleMin] = useState(1);
  const [scaleMax, setScaleMax] = useState(5);
  // single: one rating type for every question; custom: questions choose from
  // the checked types.
  const [ratingMode, setRatingMode] = useState<'single' | 'custom'>('single');
  const [scaleStyle, setScaleStyle] = useState<RatingStyle>('number');
  const [allowedStyles, setAllowedStyles] = useState<RatingStyle[]>(['number']);
  const [scaleLabels, setScaleLabels] = useState<Record<number, string>>({
    ...DEFAULT_RATING_LABELS,
  });

  const toggleAllowedStyle = (style: RatingStyle) =>
    setAllowedStyles((prev) =>
      prev.includes(style) ? prev.filter((s) => s !== style) : [...prev, style]
    );

  // ── Two-step wizard: 1 = configuration, 2 = questions ─────────────────────
  const [step, setStep] = useState<1 | 2>(1);

  // ── Step 2 — question cards (one card per question) ────────────────────────
  type DraftQuestion = {
    questionText: string;
    category: string;
    questionType: QuestionType;
    // '' = follow the form's single style; in custom mode a type must be
    // picked per question before saving.
    ratingStyle: RatingStyle | '';
    isRequired: boolean;
  };

  const emptyDraft = (category = ''): DraftQuestion => ({
    questionText: '',
    // The card's category is the tab it was added on ('' = General).
    category,
    questionType: 'rating',
    ratingStyle: '',
    isRequired: true,
  });

  const [drafts, setDrafts] = useState<DraftQuestion[]>([emptyDraft()]);
  // Category tabs created via "Add Category" that no card uses yet.
  const [pendingCategories, setPendingCategories] = useState<string[]>([]);
  // '' = the General tab; otherwise the category tab currently in view.
  const [activeCategory, setActiveCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // New questions land on whichever tab is open.
  const addDraftRow = () => setDrafts((prev) => [...prev, emptyDraft(activeCategory)]);

  const isInTab = (d: DraftQuestion, cat: string) =>
    cat ? d.category === cat : !d.category.trim();

  const updateDraft = (i: number, patch: Partial<DraftQuestion>) =>
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));

  // Removing the last remaining card resets it to a fresh empty one — the
  // step always shows at least one question card.
  const removeDraftRow = (i: number) =>
    setDrafts((prev) =>
      prev.length > 1 ? prev.filter((_, idx) => idx !== i) : [emptyDraft()]
    );

  const existingCategories = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of [
      ...drafts.map((d) => d.category).filter(Boolean),
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

  // Filled-question count shown on each tab.
  const tabQuestionCount = (cat: string) =>
    drafts.filter((d) => d.questionText.trim() && isInTab(d, cat)).length;

  // "Add Category" → ask the name → Save creates (and opens) that tab.
  const saveNewCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      toast.error('Enter a category name');
      return;
    }
    if (name.toLowerCase() === 'general') {
      toast.error('"General" already exists as the default tab');
      return;
    }
    const existing = existingCategories.find((c) => c.toLowerCase() === name.toLowerCase());
    if (!existing) setPendingCategories((prev) => [...prev, name]);
    setActiveCategory(existing ?? name);
    setNewCategoryName('');
    setShowAddCategory(false);
  };

  // Removing a category tab keeps its questions — they move to General.
  const deleteCategoryTab = (cat: string) => {
    setPendingCategories((prev) => prev.filter((c) => c !== cat));
    setDrafts((prev) => prev.map((d) => (d.category === cat ? { ...d, category: '' } : d)));
    if (activeCategory === cat) setActiveCategory('');
  };

  const STYLE_LABELS: Record<RatingStyle, string> = {
    number: 'Number (1, 2, 3…)',
    star: 'Star (★ ★ ★ ★ ★)',
    emoji: 'Emoji (😞 😐 🙂 😀 🤩)',
  };
  const STYLE_SHORT: Record<RatingStyle, string> = {
    number: 'Number',
    star: 'Star',
    emoji: 'Emoji',
  };

  // ── Batches of this course (and each batch's trainers) ────────────────────
  // Same source as the Course Batches page: course.batchAndParticipants.
  // Picking a batch is mandatory — the form belongs to that batch and the
  // trainer dropdown only offers trainers enrolled in the chosen batch.
  type CourseTrainer = { _id: string; firstName: string; lastName: string; email: string };
  type CourseBatch = { _id: string; batchName: string; trainers: CourseTrainer[] };
  // Derived from the shared roster entry (queries/courseRoster.ts) — this used
  // to be its own raw fetch of the FULL course payload.
  const { data: roster, isLoading: batchesLoading } = useCourseRosterQuery(courseId || '');

  const batches: CourseBatch[] = useMemo(() => {
    const course: any = roster;
    if (!course) return [];
    const rawBatches: any[] = course?.batchAndParticipants || [];
    const parsed: CourseBatch[] = rawBatches
      .filter((b) => String(b?.batchName || '').trim())
      .map((b) => {
        const batchTrainers: CourseTrainer[] = [];
        (b?.users || []).forEach((entry: any) => {
          const u = entry?.user || entry;
          const role =
            typeof u?.role === 'string'
              ? u.role
              : u?.role?.renameRole || u?.role?.name || '';
          if (String(role).toLowerCase() !== 'trainer') return;
          const id = String(u?._id || u?.id || '');
          if (!id || batchTrainers.some((t) => t._id === id)) return;
          batchTrainers.push({
            _id: id,
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            email: u.email || '',
          });
        });
        return {
          _id: String(b?._id || ''),
          batchName: String(b.batchName).trim(),
          trainers: batchTrainers,
        };
      });

    // Batches picked from the client at course creation, by course type
    // (degree-program → course.batch, skilling → course.skillingBatches).
    // When present, ONLY those are offered; a picked batch the Batches
    // page hasn't materialised yet appears without an id (saved by name).
    const picked: string[] = (
      course?.studentType === 'degree-program'
        ? [course?.batch]
        : course?.studentType === 'skilling'
          ? course?.skillingBatches || []
          : []
    )
      .map((n: any) => String(n || '').trim())
      .filter(Boolean);

    if (picked.length > 0) {
      const byName = new Map(parsed.map((b) => [b.batchName.toLowerCase(), b]));
      return picked.map(
        (name) =>
          byName.get(name.toLowerCase()) || { _id: '', batchName: name, trainers: [] }
      );
    }
    // Legacy course without a client batch selection — offer whatever
    // batches exist on the course document.
    return parsed;
  }, [roster]);

  // Resolve the chosen batch by id, falling back to the stored name so forms
  // saved before batches had ids (or after a re-import) still match up.
  const selectedBatch =
    batches.find((b) => b._id && b._id === formData.batchId) ||
    batches.find(
      (b) => b.batchName.toLowerCase() === formData.batchName.trim().toLowerCase()
    ) ||
    null;
  const trainers = selectedBatch?.trainers ?? [];

  const createMutation = useCreateFeedback();
  const updateMutation = useUpdateFeedback();

  const isEditing = !!feedback;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  // Feedback forms already created for this course — used to show this
  // form's sequence number (e.g. "Feedback #4" when 3 already exist).
  const { data: courseFeedbacks } = useGetAllFeedback(courseId || undefined);
  const feedbackNumber = (() => {
    const list = Array.isArray(courseFeedbacks) ? courseFeedbacks : [];
    if (isEditing && feedback) {
      const idx = list.findIndex((f: any) => f._id === feedback._id);
      return idx >= 0 ? idx + 1 : list.length || 1;
    }
    return list.length + 1;
  })();

  useEffect(() => {
    if (feedback) {
      const startDateTime = feedback.startDate ? new Date(feedback.startDate) : null;
      const endDateTime = feedback.endDate ? new Date(feedback.endDate) : null;

      setTitleChoice(
        TITLE_PRESETS.includes(feedback.feedbackTitle)
          ? feedback.feedbackTitle
          : feedback.feedbackTitle
          ? 'custom'
          : ''
      );

      setFormData({
        feedbackTitle: feedback.feedbackTitle,
        feedbackDescription: feedback.feedbackDescription || '',
        isPublished: feedback.isPublished,
        isAnonymousAllowed: feedback.isAnonymousAllowed,
        startDate: startDateTime ? startDateTime.toISOString().split('T')[0] : '',
        startTime: startDateTime ? startDateTime.toTimeString().slice(0, 5) : '',
        endDate: endDateTime ? endDateTime.toISOString().split('T')[0] : '',
        endTime: endDateTime ? endDateTime.toTimeString().slice(0, 5) : '',
        gracePeriodEndDate: (feedback as any).gracePeriodEndDate
          ? new Date((feedback as any).gracePeriodEndDate).toISOString().split('T')[0]
          : '',
        maxAttempts: feedback.maxAttempts,
        batchId: (feedback as any).batchId?.toString?.() || (feedback as any).batchId || '',
        batchName: (feedback as any).batchName || '',
        trainerId: (feedback as any).trainerId?.toString?.() || (feedback as any).trainerId || '',
        trainerName: (feedback as any).trainerName || '',
        trainerEmail: (feedback as any).trainerEmail || '',
      });

      const min = feedback.ratingScale?.minRating ?? 1;
      const max = feedback.ratingScale?.maxRating ?? 5;
      setScaleMin(min);
      setScaleMax(max);
      setScaleStyle(feedback.ratingScale?.ratingStyle || 'number');
      setRatingMode(feedback.ratingScale?.ratingMode || 'single');
      setAllowedStyles(
        feedback.ratingScale?.allowedRatingStyles?.length
          ? feedback.ratingScale.allowedRatingStyles
          : [feedback.ratingScale?.ratingStyle || 'number']
      );
      setScaleLabels(labelsToMap(min, feedback.ratingScale?.ratingLabels));

      // Step 2 mirrors the saved questions — the same two steps, pre-filled
      // exactly as created.
      const savedDrafts: DraftQuestion[] = (feedback.questions || []).map((q) => ({
        questionText: q.questionText || '',
        category: q.category || '',
        questionType: q.questionType || 'rating',
        ratingStyle: (q.ratingStyle as RatingStyle) || '',
        isRequired: q.isRequired !== false,
      }));
      setDrafts(savedDrafts.length > 0 ? savedDrafts : [emptyDraft()]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  // ── Step 1 validation — every configuration field ──────────────────────────
  const validateConfig = (): boolean => {
    if (!formData.feedbackTitle.trim()) {
      toast.error('Please select or enter a feedback title');
      return false;
    }

    if (!formData.batchName.trim()) {
      toast.error('Please select the batch this feedback is for');
      return false;
    }

    if (!formData.trainerId) {
      toast.error('Please select a trainer for this feedback');
      return false;
    }

    // Rating scale validation — labels are mandatory for every value.
    const values = Array.from(
      { length: Math.max(scaleMax - scaleMin + 1, 1) },
      (_, i) => scaleMin + i
    );
    const labelArr = values.map((v) => (scaleLabels[v] || '').trim());
    const missing = values.filter((_, i) => !labelArr[i]);
    if (scaleMax <= scaleMin) {
      toast.error('Maximum rating must be greater than minimum rating');
      return false;
    }
    if (missing.length > 0) {
      toast.error(
        `Please add a rating label for ${missing.length === 1 ? 'value' : 'values'} ${missing.join(', ')}`
      );
      return false;
    }

    // Schedule validation — start + end are always both required.
    if (!formData.startDate || !formData.startTime) {
      toast.error('Please set the start date & time');
      return false;
    }
    if (!formData.endDate || !formData.endTime) {
      toast.error('Please set the end date & time');
      return false;
    }
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
    if (isNaN(startDateTime.getTime())) {
      toast.error('Invalid start date/time');
      return false;
    }
    if (isNaN(endDateTime.getTime())) {
      toast.error('Invalid end date/time');
      return false;
    }
    if (endDateTime <= startDateTime) {
      toast.error('End date/time must be after start date/time');
      return false;
    }

    // Grace period — a plain date after the end date, extending submissions.
    if (formData.gracePeriodEndDate) {
      const graceDate = new Date(`${formData.gracePeriodEndDate}T23:59:59`);
      if (isNaN(graceDate.getTime())) {
        toast.error('Invalid grace period date');
        return false;
      }
      if (graceDate <= endDateTime) {
        toast.error('Grace period must be after the end date');
        return false;
      }
    }

    if (ratingMode === 'custom' && allowedStyles.length === 0) {
      toast.error('Select at least one rating type for the custom mode');
      return false;
    }

    return true;
  };

  const composeRatingScale = () => {
    const values = Array.from(
      { length: Math.max(scaleMax - scaleMin + 1, 1) },
      (_, i) => scaleMin + i
    );
    return {
      minRating: scaleMin,
      maxRating: scaleMax,
      ratingLabels: values.map((v) => (scaleLabels[v] || '').trim()),
      ratingMode,
      // In single mode the one chosen type applies everywhere; in custom mode
      // the first checked type is the default and questions pick among all of
      // the checked ones.
      ratingStyle: ratingMode === 'single' ? scaleStyle : allowedStyles[0],
      allowedRatingStyles: ratingMode === 'single' ? [scaleStyle] : allowedStyles,
    };
  };

  // Step 1 → Step 2 only when the configuration is complete.
  const handleNext = () => {
    if (validateConfig()) setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Enter on Step 1 advances instead of submitting.
    if (step === 1) {
      handleNext();
      return;
    }

    // Config may have been edited via Back — re-check before saving.
    if (!validateConfig()) {
      setStep(1);
      return;
    }

    // ── Step 2 validation — the question cards ───────────────────────────────
    const filledDrafts = drafts.filter((d) => d.questionText.trim());
    if (filledDrafts.length === 0) {
      toast.error('Add at least one question');
      return;
    }
    if (ratingMode === 'custom') {
      // Custom mode: every rating question must say which type it uses.
      const missing = drafts.find(
        (d) => d.questionText.trim() && d.questionType === 'rating' && !d.ratingStyle
      );
      if (missing) {
        // Jump to the tab holding the incomplete question.
        setActiveCategory(missing.category.trim() ? missing.category : '');
        toast.error(`Select a rating type for "${missing.questionText.trim()}"`);
        return;
      }
    }

    const ratingScale = composeRatingScale();

    const builtQuestions: FeedbackQuestion[] = filledDrafts.map((d, i) => {
      const rawCat = d.category.trim();
      const q: FeedbackQuestion = {
        questionText: d.questionText.trim(),
        questionType: d.questionType,
        isRequired: d.isRequired,
        order: i + 1,
        ...(rawCat ? { category: rawCat } : {}),
      };
      if (d.questionType === 'rating') {
        q.ratingConfig = { ...ratingScale };
        q.ratingStyle =
          ratingMode === 'single' ? scaleStyle : (d.ratingStyle as RatingStyle);
      } else {
        q.maxLength = 500;
        q.placeholder = 'Enter your answer ';
      }
      return q;
    });

    const payload: any = {
      questions: builtQuestions,
      courseId,
      feedbackTitle: formData.feedbackTitle,
      feedbackDescription: formData.feedbackDescription,
      ratingScale,
      isAnonymousAllowed: formData.isAnonymousAllowed,
      maxAttempts: formData.maxAttempts,
      batchId: formData.batchId || null,
      batchName: formData.batchName.trim(),
      trainerId: formData.trainerId || null,
      trainerName: formData.trainerName || '',
      trainerEmail: formData.trainerEmail || '',
    };

    // The server auto-publishes when the window starts and closes it when
    // the window (or its grace period) ends. A start that's already in the
    // past publishes immediately.
    const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
    payload.isPublished = startDateTime <= new Date();
    payload.startDate = startDateTime.toISOString();
    payload.endDate = new Date(`${formData.endDate}T${formData.endTime}`).toISOString();
    if (formData.gracePeriodEndDate) {
      payload.gracePeriodEndDate = new Date(
        `${formData.gracePeriodEndDate}T23:59:59`
      ).toISOString();
      payload.gracePeriodDays = gracePeriodDays ?? undefined;
    }

    try {
      if (isEditing && feedback) {
        await updateMutation.mutateAsync({ id: feedback._id, data: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      onSuccess?.();
    } catch {
      // handled by mutation
    }
  };

  const currentDateTime = (() => {
    const now = new Date();
    return {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().slice(0, 5),
    };
  })();

  // Whole days between the end date and the grace-period date, e.g. end on
  // the 13th + grace date the 15th = 2 days grace.
  const gracePeriodDays = (() => {
    if (!formData.endDate || !formData.gracePeriodEndDate) return null;
    const end = new Date(formData.endDate);
    const grace = new Date(formData.gracePeriodEndDate);
    const diff = Math.round((grace.getTime() - end.getTime()) / 86400000);
    return diff > 0 ? diff : null;
  })();

  return (
    <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col gap-3">
      <div className="flex-1 min-h-0 flex">
        {/* ── Step sidebar (ExerciseSettings model): fixed on the left,
            content scrolls on the right. ── */}
        <aside className="w-44 sm:w-52 shrink-0 border-r border-gray-100 dark:border-gray-800 pr-3 py-1 flex flex-col gap-1 select-none">
          <div className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2 mb-1">
            Steps
          </div>
          {(
            [
              {
                id: 1 as const,
                title: 'Configuration',
                subtitle: 'Title, batch, scale & schedule',
                icon: <Settings2 className="h-3 w-3" />,
              },
              {
                id: 2 as const,
                title: 'Questions',
                subtitle: 'One card per question',
                icon: <ListChecks className="h-3 w-3" />,
              },
            ]
          ).map((s, idx) => {
            const active = step === s.id;
            const done = s.id === 1 && step === 2;
            return (
              <div key={s.id} className="relative">
                {idx > 0 && (
                  <div
                    className={`absolute left-[18px] -top-1.5 h-2 w-px ${
                      step === 2 ? 'bg-emerald-200 dark:bg-emerald-900' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => (s.id === 1 ? setStep(1) : step === 1 && handleNext())}
                  title={active ? s.title : `Go to ${s.title}`}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-all border-l-2 ${
                    active
                      ? 'bg-indigo-50/70 dark:bg-indigo-900/20 border-indigo-600'
                      : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/40'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                      done
                        ? 'bg-emerald-500 text-white'
                        : active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" strokeWidth={3} /> : s.icon}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block text-[11px] font-bold truncate leading-tight ${
                        active
                          ? 'text-indigo-700 dark:text-indigo-300'
                          : done
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {s.title}
                    </span>
                    {active && (
                      <span className="block text-[9px] mt-0.5 font-medium text-indigo-400 dark:text-indigo-500 truncate">
                        {s.subtitle}
                      </span>
                    )}
                  </span>
                  {done && (
                    <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Done
                    </span>
                  )}
                </button>
              </div>
            );
          })}

          {/* Progress — mirrors ExerciseSettings' sidebar footer */}
          <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 px-2">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Progress
              </span>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                Step {step} of 2
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full bg-indigo-600 transition-all duration-300 ${
                  step === 2 ? 'w-full' : 'w-1/2'
                }`}
              />
            </div>
            {step === 2 && (
              <div className="mt-2 px-2 py-1.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-900/20">
                <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 dark:text-indigo-500 mb-0.5">
                  Questions
                </div>
                <div className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                  {drafts.filter((d) => d.questionText.trim()).length} added
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── Step content — scrolls independently of the sidebar ── */}
        <div className={`flex-1 min-w-0 overflow-y-auto pl-5 pr-2 ${scrollCls}`}>
      {step === 1 && (
      <div className="space-y-6">
      {/* Basic Information */}
      <section>
        <h3 className={sectionHeaderCls}>Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <label className={labelCls}>
              Feedback Term <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <select
                required
                value={titleChoice}
                onChange={(e) => {
                  const v = e.target.value;
                  setTitleChoice(v);
                  // Presets store their text directly; custom starts blank so
                  // the user types their own title.
                  setFormData({
                    ...formData,
                    feedbackTitle: v === 'custom' ? '' : v,
                  });
                }}
                className={inputCls}
              >
                <option value="" disabled>
                  Select feedback title…
                </option>
                {TITLE_PRESETS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="custom">Custom (type your own)</option>
              </select>
              {titleChoice === 'custom' && (
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.feedbackTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, feedbackTitle: e.target.value })
                  }
                  className={inputCls}
                  placeholder="Type your feedback title…"
                />
              )}
            </div>
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Description</label>
            <TipTapEditor
              value={formData.feedbackDescription}
              onChange={(html: string) =>
                setFormData({ ...formData, feedbackDescription: html })
              }
              placeholder="Short description shown to students (optional)"
              minHeight="100px"
              maxHeight="180px"
              showToolbar={true}
              editable={true}
            />
          </div>

          {/* Batch — mandatory; the form belongs to ONE batch of the course */}
          <div className="md:col-span-3">
            <label className={labelCls}>
              Select batch <span className="text-red-500">*</span>
            </label>
            {batchesLoading ? (
              <div className={`${inputCls} flex items-center text-gray-400`}>Loading batches…</div>
            ) : batches.length === 0 ? (
              <div
                className={`${inputCls} flex items-center text-red-600 border-red-200 bg-red-50/40`}
              >
                No batches in this course — create a batch on the Course Batches page first.
              </div>
            ) : (
              <select
                required
                value={selectedBatch ? selectedBatch._id || selectedBatch.batchName : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const b = batches.find((x) => (x._id || x.batchName) === v);
                  // Changing batch clears the trainer — the dropdown below
                  // only offers the new batch's trainers.
                  setFormData({
                    ...formData,
                    batchId: b?._id || '',
                    batchName: b?.batchName || '',
                    trainerId: '',
                    trainerName: '',
                    trainerEmail: '',
                  });
                }}
                className={`${inputCls} ${selectedBatch ? '' : 'text-gray-400'}`}
              >
                <option value="">— Select batch —</option>
                {batches.map((b) => (
                  <option
                    key={b._id || b.batchName}
                    value={b._id || b.batchName}
                    className="text-gray-900"
                  >
                    {b.batchName}
                  </option>
                ))}
              </select>
            )}
            {selectedBatch && (
              <p className="text-[10px] text-gray-400 mt-1">
                This feedback will be listed under{' '}
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {selectedBatch.batchName}
                </span>
                .
              </p>
            )}
          </div>

          {/* Trainer — only trainers of the selected batch */}
          <div className="md:col-span-3">
            <label className={labelCls}>
              Select trainer <span className="text-red-500">*</span>
            </label>
            {batchesLoading ? (
              <div className={`${inputCls} flex items-center text-gray-400`}>Loading trainers…</div>
            ) : !selectedBatch ? (
              <div className={`${inputCls} flex items-center text-gray-400`}>
                Select a batch first — trainers come from the chosen batch.
              </div>
            ) : trainers.length === 0 ? (
              <div
                className={`${inputCls} flex items-center text-red-600 border-red-200 bg-red-50/40`}
              >
                No trainers enrolled in this batch — assign a trainer to the batch first.
              </div>
            ) : (
              <select
                required
                value={formData.trainerId}
                onChange={(e) => {
                  const id = e.target.value;
                  const t = trainers.find((tr) => tr._id === id);
                  setFormData({
                    ...formData,
                    trainerId: id,
                    trainerName: t ? `${t.firstName} ${t.lastName}`.trim() : '',
                    trainerEmail: t?.email || '',
                  });
                }}
                className={`${inputCls} ${
                  formData.trainerId ? '' : 'text-gray-400'
                }`}
              >
                <option value="">— Select trainer —</option>
                {trainers.map((t) => {
                  const name = `${t.firstName} ${t.lastName}`.trim() || 'Unnamed trainer';
                  return (
                    <option key={t._id} value={t._id} className="text-gray-900">
                      {name}
                      {t.email ? ` · ${t.email}` : ''}
                    </option>
                  );
                })}
              </select>
            )}
            {formData.trainerId && (
              <p className="text-[10px] text-gray-400 mt-1">
                This feedback is about{' '}
                <span className="font-medium text-gray-600 dark:text-gray-300">
                  {formData.trainerName}
                </span>
                .
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Rating scale */}
      <section className="border-t border-gray-100 dark:border-gray-800 pt-5">
        {/* Feedback type — Number / Star / Emoji apply to every question;
            Custom re-opens the per-question type picker below. */}
        <div className="mb-4">
          <label className={labelCls}>
            Feedback type <span className="text-red-500">*</span>
          </label>
          <select
            value={ratingMode === 'custom' ? 'custom' : scaleStyle}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'custom') {
                setRatingMode('custom');
              } else {
                setRatingMode('single');
                setScaleStyle(value as RatingStyle);
              }
            }}
            className={`${inputCls} max-w-xs`}
          >
            <option value="number">Number (1, 2, 3…)</option>
            <option value="star">Star (★ ★ ★ ★ ★)</option>
            <option value="emoji">Emoji (😞 😐 🙂 😀 🤩)</option>
            <option value="custom">Custom — pick per question from selected types</option>
          </select>
        </div>

        <div className="space-y-4">
          {ratingMode === 'custom' && (
            <div>
           
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
                {(
                  [
                    { style: 'number' as RatingStyle, label: 'Number (1, 2, 3…)' },
                    { style: 'star' as RatingStyle, label: 'Star (★ ★ ★ ★ ★)' },
                    { style: 'emoji' as RatingStyle, label: 'Emoji (😞 😐 🙂 😀 🤩)' },
                  ]
                ).map(({ style, label }) => (
                  <label
                    key={style}
                    className="inline-flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300 select-none"
                  >
                    <input
                      type="checkbox"
                      checked={allowedStyles.includes(style)}
                      onChange={() => toggleAllowedStyle(style)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Min / max */}
          <div className="grid grid-cols-2 gap-3 md:max-w-md">
            <div>
              <label className={labelCls}>
                Minimum rating <span className="text-red-500">*</span>{' '}
                <span className="text-gray-400 normal-case font-normal">(lowest)</span>
              </label>
              <input
                type="number"
                min={1}
                max={9}
                value={scaleMin}
                onChange={(e) => setScaleMin(parseInt(e.target.value) || 1)}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                Maximum rating <span className="text-red-500">*</span>{' '}
                <span className="text-gray-400 normal-case font-normal">(highest)</span>
              </label>
              <input
                type="number"
                min={2}
                max={10}
                value={scaleMax}
                onChange={(e) => setScaleMax(parseInt(e.target.value) || 5)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Row 2 — what students will see */}
          <div className="space-y-0.5">
            {ratingMode === 'single' ? (
              <RatingScalePreview min={scaleMin} max={scaleMax} style={scaleStyle} />
            ) : allowedStyles.length === 0 ? (
              <p className="text-[10px] text-red-500">
                Select at least one rating type above.
              </p>
            ) : (
              allowedStyles.map((s) => (
                <RatingScalePreview key={s} min={scaleMin} max={scaleMax} style={s} />
              ))
            )}
          </div>

          {/* Row 3 — labels per rating value */}
          <RatingLabelsEditor
            min={scaleMin}
            max={scaleMax}
            labels={scaleLabels}
            // Custom mode shares one set of labels across the selected
            // types, so the editor shows neutral number badges.
            style={ratingMode === 'single' ? scaleStyle : 'number'}
            onChange={(value, label) =>
              setScaleLabels((prev) => ({ ...prev, [value]: label }))
            }
          />
        </div>
      </section>

      {/* Schedule & settings */}
      <section className="border-t border-gray-100 dark:border-gray-800 pt-5">
        <h3 className={sectionHeaderCls}>Schedule &amp; Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Start — one picker for day, month, year and time together */}
          <div>
            <label className={labelCls}>
              Start date &amp; time <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="datetime-local"
                value={
                  formData.startDate && formData.startTime
                    ? `${formData.startDate}T${formData.startTime}`
                    : ''
                }
                onChange={(e) => {
                  const [date = '', time = ''] = e.target.value.split('T');
                  setFormData({ ...formData, startDate: date, startTime: time.slice(0, 5) });
                }}
                min={`${currentDateTime.date}T${currentDateTime.time}`}
                className={`${inputCls} pl-8`}
              />
            </div>
          </div>

          {/* End — one picker for day, month, year and time together */}
          <div>
            <label className={labelCls}>
              End date &amp; time <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="datetime-local"
                value={
                  formData.endDate && formData.endTime
                    ? `${formData.endDate}T${formData.endTime}`
                    : ''
                }
                onChange={(e) => {
                  const [date = '', time = ''] = e.target.value.split('T');
                  setFormData({
                    ...formData,
                    endDate: date,
                    endTime: time.slice(0, 5),
                    gracePeriodEndDate: '',
                  });
                }}
                min={
                  formData.startDate && formData.startTime
                    ? `${formData.startDate}T${formData.startTime}`
                    : `${currentDateTime.date}T${currentDateTime.time}`
                }
                className={`${inputCls} pl-8`}
              />
            </div>
          </div>

          {/* Grace period — extra days to submit after the end date */}
          <div>
            <label className={labelCls}>
              Grace period until{' '}
              <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={formData.gracePeriodEndDate}
                onChange={(e) =>
                  setFormData({ ...formData, gracePeriodEndDate: e.target.value })
                }
                min={formData.endDate || currentDateTime.date}
                disabled={!formData.endDate}
                className={`${inputCls} pl-8 disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            </div>
            {gracePeriodDays !== null ? (
              <p className="text-[10px] text-gray-400 mt-1">
                {gracePeriodDays} extra day{gracePeriodDays === 1 ? '' : 's'} to submit after
                the end date.
              </p>
            ) : (
              <p className="text-[10px] text-gray-400 mt-1">
                Pick a date after the end date to extend submissions.
              </p>
            )}
          </div>

          {/* Max attempts — always starts its own row below the grace period */}
          <div className="md:col-start-1">
            <label className={labelCls}>
              Max Attempts <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              value={formData.maxAttempts}
              onChange={(e) =>
                setFormData({ ...formData, maxAttempts: parseInt(e.target.value) || 1 })
              }
              className={inputCls}
            />
          </div>

          {/* Toggles */}
          <div className="md:col-span-2 flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
            <label className="inline-flex items-center gap-2 text-[12px] text-gray-700 dark:text-gray-300 select-none">
              <input
                type="checkbox"
                checked={formData.isAnonymousAllowed}
                onChange={(e) =>
                  setFormData({ ...formData, isAnonymousAllowed: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Allow anonymous submissions
            </label>
          </div>
        </div>
      </section>
      </div>
      )}

      {/* ── Step 2 — Questions: General tab + one tab per category ── */}
      {step === 2 && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className={`${sectionHeaderCls} mb-0 flex items-center gap-1.5`}>
              <ListChecks className="h-3.5 w-3.5 text-indigo-500" />
              Questions
              <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-[10px] font-semibold normal-case">
                {drafts.filter((d) => d.questionText.trim()).length}
              </span>
            </h3>
            {/* Feedback type from Step 1 — shown once, common to all questions */}
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              Scale {scaleMin}–{scaleMax} ·{' '}
              {ratingMode === 'single'
                ? STYLE_SHORT[scaleStyle]
                : allowedStyles.map((s) => STYLE_SHORT[s]).join(' / ')}
            </span>
          </div>

          {/* Tab bar — General first, then categories, "Add Category" beside */}
          <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 dark:border-gray-800">
            {['', ...existingCategories].map((cat) => {
              const active = activeCategory === cat;
              const count = tabQuestionCount(cat);
              return (
                <button
                  key={cat || '__general__'}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 -mb-px text-[12px] font-medium rounded-t-md border-b-2 transition-colors ${
                    active
                      ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-900/20'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                  }`}
                >
                  {cat || 'General'}
                  {count > 0 && (
                    <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-[9px] font-semibold">
                      {count}
                    </span>
                  )}
                  {cat && (
                    <span
                      role="button"
                      title={`Remove "${cat}" — its questions move to General`}
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCategoryTab(cat);
                      }}
                      className="ml-0.5 text-gray-400 hover:text-red-500 leading-none"
                    >
                      ×
                    </span>
                  )}
                </button>
              );
            })}

            {/* Add Category — asks the name; Save opens the new tab */}
            {showAddCategory ? (
              <div className="inline-flex items-center gap-1 ml-1 py-1">
                <input
                  autoFocus
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveNewCategory();
                    }
                    if (e.key === 'Escape') {
                      setShowAddCategory(false);
                      setNewCategoryName('');
                    }
                  }}
                  placeholder="Category name…"
                  className="h-7 w-40 px-2 text-[12px] border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={saveNewCategory}
                  className="h-7 px-2.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategoryName('');
                  }}
                  className="h-7 px-2 text-[11px] font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddCategory(true)}
                className="ml-1 inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-md transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Category
              </button>
            )}
          </div>

          {/* Single mode: the common rating scale every question uses */}
          {ratingMode === 'single' && (
            <div className="mt-2">
              <RatingScalePreview min={scaleMin} max={scaleMax} style={scaleStyle} />
            </div>
          )}

          {/* Cards of the active tab only */}
          <div className="space-y-3 mt-3">
            {(() => {
              const visible = drafts
                .map((d, i) => ({ d, i }))
                .filter(({ d }) => isInTab(d, activeCategory));

              if (visible.length === 0) {
                return (
                  <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-4 text-center text-[12px] text-gray-400">
                    No questions in {activeCategory ? `"${activeCategory}"` : 'General'} yet —
                    add one below.
                  </div>
                );
              }

              return visible.map(({ d, i }, pos) => (
                <div
                  key={i}
                  className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center h-5 px-2 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 text-[11px] font-semibold">
                      Question {pos + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeDraftRow(i)}
                      title="Remove question"
                      className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    value={d.questionText}
                    onChange={(e) => updateDraft(i, { questionText: e.target.value })}
                    placeholder={`Type question ${pos + 1}…`}
                    className={inputCls}
                  />

                  <div className="flex flex-wrap items-end gap-x-5 gap-y-2 mt-2">
                    {/* Custom feedback type (Step 1) → each question picks its
                        own rating type; single mode shows the type once above. */}
                    {ratingMode === 'custom' && (
                      <div className="w-full sm:w-56">
                        <label className={labelCls}>Rating type</label>
                        <select
                          value={d.ratingStyle}
                          onChange={(e) =>
                            updateDraft(i, { ratingStyle: e.target.value as RatingStyle | '' })
                          }
                          className={`${inputCls} ${d.ratingStyle ? '' : 'text-gray-400'}`}
                        >
                          <option value="">— Select type —</option>
                          {allowedStyles.map((s) => (
                            <option key={s} value={s} className="text-gray-900">
                              {STYLE_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <label className="inline-flex items-center gap-2 h-9 text-[12px] text-gray-700 dark:text-gray-300 select-none">
                      <input
                        type="checkbox"
                        checked={d.isRequired}
                        onChange={(e) => updateDraft(i, { isRequired: e.target.checked })}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Required
                    </label>
                  </div>

                  {ratingMode === 'custom' && (
                    <div className="mt-1.5">
                      <RatingScalePreview
                        min={scaleMin}
                        max={scaleMax}
                        style={(d.ratingStyle || allowedStyles[0] || 'number') as RatingStyle}
                      />
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>

          <button
            type="button"
            onClick={addDraftRow}
            className="mt-3 w-full h-9 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-800 hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add question{activeCategory ? ` to "${activeCategory}"` : ''}
          </button>
        </div>
      )}
        </div>
      </div>

      {/* ── Footer: step dots + navigation (ExerciseSettings model) ── */}
      <div className="shrink-0 flex items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span
              className={`h-1.5 rounded-full transition-all duration-200 ${
                step === 1 ? 'w-4 bg-indigo-600' : 'w-1.5 bg-emerald-500'
              }`}
            />
            <span
              className={`h-1.5 rounded-full transition-all duration-200 ${
                step === 2 ? 'w-4 bg-indigo-600' : 'w-1.5 bg-gray-200 dark:bg-gray-700'
              }`}
            />
          </div>
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
            Step <span className="text-indigo-600 dark:text-indigo-400">{step}</span> / 2
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-7 px-3 text-[12px] font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            Cancel
          </button>
          {step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          {step === 1 ? (
            // key + preventDefault: this button sits where the submit button
            // renders on step 2 — without them React reuses the DOM node,
            // the click's default action fires on the morphed submit button
            // and the form saves & closes immediately.
            <button
              key="wizard-next"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                handleNext();
              }}
              className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors"
            >
              Next
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              key="wizard-submit"
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting && (
                <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {isEditing
                ? isSubmitting
                  ? 'Updating…'
                  : 'Update Feedback'
                : isSubmitting
                ? 'Creating…'
                : 'Create Feedback'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
