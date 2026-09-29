// Presentation-only helpers for the Question Bank page: field extraction and
// badge taxonomy ported from the legacy QuestionList card renderer. All the
// legacy-data tolerances survive verbatim — case-insensitive 'MCQ'/'mcq',
// 'Medium'/'medium' difficulty, string-or-object mcqQuestionTitle — because
// downstream data still arrives in both shapes.

import {
  AlignLeft,
  ArrowUpDown,
  Binary,
  BookOpen,
  CheckSquare,
  ChevronDown,
  Database,
  Equal,
  Hash,
  Layout,
  List,
  ToggleLeft,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Question } from '@/apiServices/type/question';
import type { StatusPillTone } from '@/app/lms/shared/ui';

// Case-insensitive MCQ check — handles both new ('mcq') and legacy ('MCQ') data.
export const isMcqQuestion = (question: Question) =>
  (question.questionType || '').toLowerCase() === 'mcq';

export type QuestionTypeInfo = {
  icon: LucideIcon;
  label: string;
  tone: StatusPillTone;
};

// One semantic tone per question family (the old renderer used 10+ ad-hoc
// Tailwind color pairs): MCQ subtypes read as info, programming as brand,
// frontend as warn, database as success. The subtype icon disambiguates.
export const getQuestionTypeInfo = (question: Question): QuestionTypeInfo => {
  const qt = (question.questionType || '').toLowerCase();
  if (qt === 'frontend') return { icon: Layout, label: 'Frontend', tone: 'warn' };
  if (qt === 'database') return { icon: Database, label: 'Database', tone: 'success' };
  if (qt === 'programming') return { icon: Hash, label: 'Programming', tone: 'brand' };

  switch (question.mcqQuestionType) {
    case 'multiple_choice':
      return { icon: List, label: 'Multiple Choice', tone: 'info' };
    case 'multiple_select':
      return { icon: CheckSquare, label: 'Multiple Select', tone: 'info' };
    case 'true_false':
      return { icon: ToggleLeft, label: 'True/False', tone: 'info' };
    case 'short_answer':
      return { icon: AlignLeft, label: 'Short Answer', tone: 'info' };
    case 'essay':
      return { icon: BookOpen, label: 'Essay', tone: 'info' };
    case 'dropdown':
      return { icon: ChevronDown, label: 'Dropdown', tone: 'info' };
    case 'matching':
      return { icon: Equal, label: 'Matching', tone: 'info' };
    case 'ordering':
      return { icon: ArrowUpDown, label: 'Ordering', tone: 'info' };
    case 'numeric':
      return { icon: Binary, label: 'Numeric', tone: 'info' };
    default:
      return { icon: List, label: 'MCQ', tone: 'info' };
  }
};

// Same fallbacks as the legacy list: MCQ difficulty defaults to 'medium',
// programming to 'Medium' (legacy casing tolerated by difficultyTone below).
export const getDifficulty = (question: Question): string =>
  isMcqQuestion(question)
    ? question.mcqQuestionDifficulty || 'medium'
    : question.difficulty || 'Medium';

export const difficultyTone = (difficulty?: string): StatusPillTone => {
  const d = (difficulty || '').toLowerCase();
  if (d === 'easy') return 'success';
  if (d === 'medium') return 'warn';
  if (d === 'hard') return 'danger';
  return 'neutral';
};

export const formatDifficulty = (difficulty?: string): string =>
  typeof difficulty === 'string' && difficulty
    ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase()
    : 'Medium';

// MCQ score defaults to 10, programming to 0 — same as the legacy badges.
export const getScore = (question: Question): number =>
  isMcqQuestion(question) ? question.mcqQuestionScore || 10 : question.score || 0;

// Plain text title (mcqQuestionTitle is string-or-object depending on data age).
export const getQuestionTitleText = (question: Question): string => {
  if (!isMcqQuestion(question)) {
    return question.title || 'Untitled Programming Question';
  }
  if (question.mcqQuestionTitle) {
    if (typeof question.mcqQuestionTitle === 'string') {
      return question.mcqQuestionTitle;
    }
    return question.mcqQuestionTitle.text || 'Untitled MCQ';
  }
  return 'Untitled Question';
};

// HTML content (rendered with dangerouslySetInnerHTML in the detail drawer).
export const getQuestionTitleHtml = (question: Question): string => {
  if (!isMcqQuestion(question)) {
    return question.title || 'Untitled Programming Question';
  }
  if (question.mcqQuestionTitle) {
    if (typeof question.mcqQuestionTitle === 'string') {
      return question.mcqQuestionTitle;
    }
    return question.mcqQuestionTitle.text || 'Untitled MCQ';
  }
  return 'Untitled Question';
};

export const getQuestionImageUrl = (question: Question): string | null => {
  if (!isMcqQuestion(question)) return null;
  if (question.mcqQuestionTitle && typeof question.mcqQuestionTitle === 'object') {
    return question.mcqQuestionTitle.imageUrl || null;
  }
  return null;
};

export const getQuestionImageAlignment = (
  question: Question
): 'left' | 'center' | 'right' => {
  if (!isMcqQuestion(question)) return 'center';
  if (question.mcqQuestionTitle && typeof question.mcqQuestionTitle === 'object') {
    return question.mcqQuestionTitle.imageAlignment || 'center';
  }
  return 'center';
};

export const getQuestionImageSize = (question: Question): number => {
  if (!isMcqQuestion(question)) return 60;
  if (question.mcqQuestionTitle && typeof question.mcqQuestionTitle === 'object') {
    return question.mcqQuestionTitle.imageSizePercent || 60;
  }
  return 60;
};

export const getDescriptionText = (question: Question): string => {
  if (!isMcqQuestion(question)) {
    return question.description || '';
  }
  if (question.mcqQuestionDescription) {
    if (typeof question.mcqQuestionDescription === 'string') {
      return question.mcqQuestionDescription;
    }
    return question.mcqQuestionDescription.text || '';
  }
  return '';
};

export const getExplanationHtml = (question: Question): string => {
  if (!isMcqQuestion(question)) {
    return '';
  }
  if (question.mcqQuestionDescription) {
    if (typeof question.mcqQuestionDescription === 'string') {
      return question.mcqQuestionDescription;
    }
    return question.mcqQuestionDescription.text || '';
  }
  return question.explanation || '';
};

// DOM-based strip (matches the legacy behavior for entities); the regex branch
// only runs during SSR where document is unavailable.
export const stripHtml = (html: string): string => {
  if (!html) return '';
  if (typeof document === 'undefined') return html.replace(/<[^>]*>/g, '');
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

// One-line summary for the table's Details column.
export const getQuestionMeta = (question: Question): string => {
  if (isMcqQuestion(question)) {
    const t = question.mcqQuestionType;
    if (t === 'matching') return `${question.matchingPairs?.length || 0} pairs`;
    if (t === 'ordering') return `${question.orderingItems?.length || 0} items`;
    if (t === 'true_false') {
      return question.trueFalseAnswer !== null && question.trueFalseAnswer !== undefined
        ? 'Answer set'
        : 'No answer set';
    }
    if (t === 'numeric') {
      return question.numericAnswer !== null && question.numericAnswer !== undefined
        ? `Answer: ${question.numericAnswer}`
        : 'No answer set';
    }
    if (t === 'short_answer') return question.shortAnswer ? 'Answer key set' : 'No answer key';
    if (t === 'essay') return 'Manual grading';
    const options = question.mcqQuestionOptions || [];
    const correct = question.mcqQuestionCorrectAnswers || [];
    return `${options.length} options · ${correct.length} correct`;
  }
  const qt = (question.questionType || '').toLowerCase();
  if (qt === 'frontend') return `${question.constraints?.length || 0} constraints`;
  if (qt === 'database') return 'SQL query';
  return `${question.testCases?.length || 0} test cases`;
};
