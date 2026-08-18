'use client';

import React, { useState } from 'react';
import {
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  Zap,
  TestTube,
  Tag,
  Terminal,
  BookOpen,
  HelpCircle,
  Columns,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  X,
  List,
  CheckSquare,
  ToggleLeft,
  AlignLeft,
  ChevronDown as ChevronDownIcon,
  Equal,
  ArrowUpDown,
  Binary,
  Hash,
  Plus,
  Minus,
  Layout,
  Database,
} from 'lucide-react';
import { Question, MCQOption, MatchingPair, OrderingItem } from '@/apiServices/type/question';
import { motion, AnimatePresence } from 'framer-motion';

interface QuestionListProps {
  questions: Question[];
  onEdit: (question: Question) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: boolean) => void;
  isLoading?: boolean;
  compact?: boolean;
}

const QuestionList: React.FC<QuestionListProps> = ({
  questions,
  onEdit,
  onDelete,
  onToggleStatus,
  isLoading,
  compact = true,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  const handleToggle = async (id: string, currentStatus: boolean) => {
    setTogglingId(id);
    try {
      await onToggleStatus(id, !currentStatus);
    } finally {
      setTogglingId(null);
    }
  };

  const getDifficultyBadge = (difficulty?: string) => {
    const styles: Record<string, string> = {
      Easy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      Medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      Hard: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
      easy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
      medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
      hard: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
    };
    const key = difficulty || 'Easy';
    return styles[key] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  // Case-insensitive MCQ check — handles both new ('mcq') and legacy ('MCQ') data.
  const isMcqQuestion = (question: Question) => (question.questionType || '').toLowerCase() === 'mcq';

  // Get question type icon and label
  const getQuestionTypeInfo = (question: Question) => {
    const qt = (question.questionType || '').toLowerCase();
    if (qt === 'frontend') {
      return { icon: <Layout size={10} />, label: 'Frontend', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
    }
    if (qt === 'database') {
      return { icon: <Database size={10} />, label: 'Database', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' };
    }
    if (qt === 'programming') {
      return { icon: <Hash size={10} />, label: 'Programming', color: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300' };
    }

    const mcqType = question.mcqQuestionType;
    switch (mcqType) {
      case 'multiple_choice':
        return { icon: <List size={10} />, label: 'Multiple Choice', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' };
      case 'multiple_select':
        return { icon: <CheckSquare size={10} />, label: 'Multiple Select', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
      case 'true_false':
        return { icon: <ToggleLeft size={10} />, label: 'True/False', color: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300' };
      case 'short_answer':
        return { icon: <AlignLeft size={10} />, label: 'Short Answer', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' };
      case 'essay':
        return { icon: <BookOpen size={10} />, label: 'Essay', color: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300' };
      case 'dropdown':
        return { icon: <ChevronDownIcon size={10} />, label: 'Dropdown', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' };
      case 'matching':
        return { icon: <Equal size={10} />, label: 'Matching', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' };
      case 'ordering':
        return { icon: <ArrowUpDown size={10} />, label: 'Ordering', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300' };
      case 'numeric':
        return { icon: <Binary size={10} />, label: 'Numeric', color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' };
      default:
        return { icon: <List size={10} />, label: 'MCQ', color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300' };
    }
  };

  // Helper function to get the plain text from mcqQuestionTitle
  const getQuestionTitleText = (question: Question): string => {
    if (!isMcqQuestion(question)) {
      return question.title || 'Untitled Programming Question';
    }
    
    // For MCQ, mcqQuestionTitle is an object
    if (question.mcqQuestionTitle) {
      if (typeof question.mcqQuestionTitle === 'string') {
        return question.mcqQuestionTitle;
      }
      // It's an object with a text property
      return question.mcqQuestionTitle.text || 'Untitled MCQ';
    }
    
    return 'Untitled Question';
  };

  // Helper function to get HTML content (for rendering with dangerouslySetInnerHTML)
  const getQuestionTitleHtml = (question: Question): string => {
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

  // Helper function to get question image URL
  const getQuestionImageUrl = (question: Question): string | null => {
    if (!isMcqQuestion(question)) return null;
    
    if (question.mcqQuestionTitle && typeof question.mcqQuestionTitle === 'object') {
      return question.mcqQuestionTitle.imageUrl || null;
    }
    
    return null;
  };

  // Helper function to get question image alignment
  const getQuestionImageAlignment = (question: Question): 'left' | 'center' | 'right' => {
    if (!isMcqQuestion(question)) return 'center';
    
    if (question.mcqQuestionTitle && typeof question.mcqQuestionTitle === 'object') {
      return question.mcqQuestionTitle.imageAlignment || 'center';
    }
    
    return 'center';
  };

  // Helper function to get question image size
  const getQuestionImageSize = (question: Question): number => {
    if (!isMcqQuestion(question)) return 60;
    
    if (question.mcqQuestionTitle && typeof question.mcqQuestionTitle === 'object') {
      return question.mcqQuestionTitle.imageSizePercent || 60;
    }
    
    return 60;
  };

  // Helper function to get description text
  const getDescriptionText = (question: Question): string => {
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

  // Helper function to get explanation HTML
  const getExplanationHtml = (question: Question): string => {
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

  // Helper function to strip HTML
  const stripHtml = (html: string) => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  // Image Preview Modal
  const ImagePreviewModal = ({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 dark:bg-black/90 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="relative max-w-4xl max-h-[90vh]"
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white hover:text-gray-300 p-2"
        >
          <X size={24} />
        </button>
        <img
          src={imageUrl}
          alt="Preview"
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
          onClick={e => e.stopPropagation()}
        />
      </motion.div>
    </motion.div>
  );

  // Render MCQ Options
  const renderMCQOptions = (options: MCQOption[], correctAnswers: string[], optionsPerRow: number = 1) => {
    return (
      <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${optionsPerRow}, minmax(0, 1fr))` }}>
        {options.map((opt, optIdx) => {
          const isCorrect = correctAnswers.includes(opt.text);
          return (
            <div
              key={opt.id || opt._id || optIdx}
              className={`flex flex-col rounded-lg border overflow-hidden ${
                isCorrect
                  ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700'
                  : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
              }`}
            >
              {opt.imageUrl && (
                <div
                  className="relative w-full bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 cursor-pointer group"
                  style={{
                    display: 'flex',
                    justifyContent:
                      opt.imageAlignment === 'left'
                        ? 'flex-start'
                        : opt.imageAlignment === 'right'
                        ? 'flex-end'
                        : 'center',
                    padding: '8px',
                  }}
                  onClick={() => setPreviewImage(opt.imageUrl!)}
                >
                  <div style={{ width: `${opt.imageSizePercent || 60}%` }}>
                    <img
                      src={opt.imageUrl}
                      alt={`Option ${String.fromCharCode(65 + optIdx)}`}
                      className="w-full h-auto rounded border border-gray-200 dark:border-gray-700 group-hover:border-indigo-400 dark:group-hover:border-indigo-500 transition-all"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <ZoomIn size={16} className="text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-900 rounded-full p-1" />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1.5 p-2">
                <span
                  className={`w-4 h-4 flex items-center justify-center text-[9px] rounded-full shrink-0 ${
                    isCorrect
                      ? 'bg-emerald-500 text-white dark:bg-emerald-600'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {String.fromCharCode(65 + optIdx)}
                </span>
                <span className="text-[10px] flex-1 break-words text-gray-900 dark:text-gray-100">
                  {opt.text}
                </span>
                {isCorrect && <Check size={10} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render True/False
  const renderTrueFalse = (trueFalseAnswer: boolean | null | undefined) => {
    return (
      <div className="flex gap-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
          trueFalseAnswer === true 
            ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
        }`}>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            trueFalseAnswer === true ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
          }`}>
            {trueFalseAnswer === true && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
          <span className="text-xs font-medium">True</span>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
          trueFalseAnswer === false 
            ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-700'
            : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
        }`}>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
            trueFalseAnswer === false ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
          }`}>
            {trueFalseAnswer === false && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
          <span className="text-xs font-medium">False</span>
        </div>
      </div>
    );
  };

  // Render Matching Pairs
  const renderMatchingPairs = (pairs: MatchingPair[] = []) => {
    return (
      <div className="space-y-1.5">
        {pairs.map((pair, idx) => (
          <div key={pair.id || pair._id || idx} className="flex items-center gap-2 text-[10px]">
            <span className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[9px] font-bold shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 bg-white dark:bg-gray-900 p-1.5 rounded border border-gray-200 dark:border-gray-700">
              {pair.left || '—'}
            </div>
            <Equal size={12} className="text-gray-400 shrink-0" />
            <div className="flex-1 bg-emerald-50 dark:bg-emerald-900/20 p-1.5 rounded border border-emerald-200 dark:border-emerald-800">
              {pair.right || '—'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render Ordering Items
  const renderOrderingItems = (items: OrderingItem[] = []) => {
    const sortedItems = [...items].sort((a, b) => a.order - b.order);
    return (
      <div className="space-y-1.5">
        {sortedItems.map((item, idx) => (
          <div key={item.id || item._id || idx} className="flex items-center gap-2 text-[10px]">
            <span className="w-5 h-5 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 flex items-center justify-center text-[9px] font-bold shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 bg-white dark:bg-gray-900 p-1.5 rounded border border-gray-200 dark:border-gray-700">
              {item.text || '—'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render Numeric Answer
  const renderNumericAnswer = (answer: number | null | undefined, tolerance: number | null | undefined) => {
    if (answer === null || answer === undefined) {
      return <div className="text-xs text-gray-500">No answer set</div>;
    }
    
    return (
      <div className="flex items-center gap-3">
        <div className="bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700">
          <span className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
            {answer}
          </span>
        </div>
        {tolerance && tolerance > 0 && (
          <>
            <span className="text-gray-400">±</span>
            <div className="bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
              <span className="text-xs font-mono text-amber-600 dark:text-amber-400">{tolerance}</span>
            </div>
            <div className="text-[9px] text-gray-500">
              Range: {(answer - tolerance).toFixed(2)} to {(answer + tolerance).toFixed(2)}
            </div>
          </>
        )}
      </div>
    );
  };

  // Render Short Answer
  const renderShortAnswer = (shortAnswer: string | undefined) => {
    return (
      <div className="bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
        <span className="text-[10px] text-gray-500 block mb-0.5">Expected Answer:</span>
        <span className="text-xs text-gray-900 dark:text-gray-100">
          {shortAnswer || 'No expected answer provided'}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 size={20} className="animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="text-center p-6">
        <BookOpen size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-xs text-gray-500 dark:text-gray-400">No questions found</p>
      </div>
    );
  }

  return (
    <>
      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
        )}
      </AnimatePresence>

      <div className="space-y-1.5">
        {questions.map((q, idx) => {
          const isMCQ = isMcqQuestion(q);
          const typeInfo = getQuestionTypeInfo(q);
          
          // Get the correct title using the helper functions
          const plainTitle = getQuestionTitleText(q);
          const htmlTitle = getQuestionTitleHtml(q);
          const questionImageUrl = getQuestionImageUrl(q);
          const questionImageAlignment = getQuestionImageAlignment(q);
          const questionImageSize = getQuestionImageSize(q);
          const description = getDescriptionText(q);
          const explanation = getExplanationHtml(q);
          
          // Get question-specific data
          const category = q.questionCategory || 'Uncategorized';
          const difficulty = isMCQ ? q.mcqQuestionDifficulty || 'medium' : q.difficulty || 'Medium';
          const score = isMCQ ? q.mcqQuestionScore || 10 : q.score || 0;
          const timeLimit = isMCQ ? q.mcqQuestionTimeLimit || 0 : q.timeLimit || 0;
          const optionsPerRow = isMCQ ? q.mcqQuestionOptionsPerRow || 1 : null;
          const isRequired = isMCQ ? q.mcqQuestionRequired || false : false;
          
          // MCQ specific data
          const options = isMCQ ? q.mcqQuestionOptions || [] : [];
          const correctAnswers = isMCQ ? q.mcqQuestionCorrectAnswers || [] : [];
          const optionsWithImages = options.filter((opt: MCQOption) => opt.imageUrl).length;
          
          // Type-specific data
          const mcqType = q.mcqQuestionType;
          const trueFalseAnswer = q.trueFalseAnswer;
          const shortAnswer = q.shortAnswer;
          const matchingPairs = q.matchingPairs;
          const orderingItems = q.orderingItems;
          const numericAnswer = q.numericAnswer;
          const numericTolerance = q.numericTolerance;

          return (
            <motion.div
              key={q._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
            >
              {/* Header */}
              <div className="p-2.5">
                <div className="flex items-start gap-2">
                  {/* Index */}
                  <span className="text-[10px] font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded shrink-0 text-gray-600 dark:text-gray-400">
                    #{idx + 1}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Badges Row */}
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${typeInfo.color}`}>
                        {typeInfo.icon}
                        {typeInfo.label}
                      </span>

                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${getDifficultyBadge(difficulty)}`}>
                        {typeof difficulty === 'string'
                          ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase()
                          : 'Medium'}
                      </span>

                      <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded flex items-center gap-0.5 text-gray-700 dark:text-gray-300">
                        <Tag size={8} />
                        {category}
                      </span>

                      {isMCQ && (
                        <>
                          <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded flex items-center gap-0.5">
                            <Zap size={8} />
                            {score} pts
                          </span>

                          {isRequired && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 rounded">
                              Required
                            </span>
                          )}

                          {optionsWithImages > 0 && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 rounded flex items-center gap-0.5">
                              <ImageIcon size={8} />
                              {optionsWithImages} img
                            </span>
                          )}

                          {questionImageUrl && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded flex items-center gap-0.5">
                              <ImageIcon size={8} />
                              Question img
                            </span>
                          )}
                        </>
                      )}

                      {!isMCQ && score > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded flex items-center gap-0.5">
                          <Zap size={8} />
                          {score} pts
                        </span>
                      )}
                    </div>

                    {/* Title - using plain text for display */}
                    <h4 className="text-xs font-medium leading-tight mb-1 text-gray-900 dark:text-gray-100">
                      {plainTitle || 'Untitled Question'}
                    </h4>

                    {/* Question Image Preview in header */}
                    {questionImageUrl && (
                      <div className="mb-1">
                        <div 
                          className="cursor-pointer inline-block"
                          onClick={() => setPreviewImage(questionImageUrl!)}
                        >
                          <img
                            src={questionImageUrl}
                            alt="Question"
                            className="max-h-16 rounded border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition-all"
                            style={{
                              width: `${questionImageSize}%`,
                              display: 'block',
                              margin: questionImageAlignment === 'center' ? '0 auto' : 
                                      questionImageAlignment === 'right' ? '0 0 0 auto' : '0'
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Meta Row */}
                    <div className="flex items-center gap-2 text-[9px] text-gray-500 dark:text-gray-400 flex-wrap">
                      <span className="flex items-center gap-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${q.isActive ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
                        {q.isActive ? 'Active' : 'Inactive'}
                      </span>

                      {isMCQ && options && (
                        <>
                          <span className="flex items-center gap-0.5">
                            <List size={9} />
                            {options.length} opts
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Columns size={9} />
                            {optionsPerRow}/row
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Check size={9} />
                            {correctAnswers.length} correct
                          </span>
                          {timeLimit > 0 && (
                            <span className="flex items-center gap-0.5">⏱ {timeLimit}ms</span>
                          )}
                        </>
                      )}

                      {!isMCQ && q.testCases && (
                        <span className="flex items-center gap-0.5">
                          <TestTube size={9} />
                          {q.testCases.length} tests
                        </span>
                      )}

                      {/* Type-specific meta info */}
                      {mcqType === 'matching' && matchingPairs && (
                        <span className="flex items-center gap-0.5">
                          <Equal size={9} />
                          {matchingPairs.length} pairs
                        </span>
                      )}
                      {mcqType === 'ordering' && orderingItems && (
                        <span className="flex items-center gap-0.5">
                          <ArrowUpDown size={9} />
                          {orderingItems.length} items
                        </span>
                      )}
                      {mcqType === 'true_false' && (
                        <span className="flex items-center gap-0.5">
                          <ToggleLeft size={9} />
                          {trueFalseAnswer !== null && trueFalseAnswer !== undefined ? 'Answered' : 'Not set'}
                        </span>
                      )}
                      {mcqType === 'numeric' && numericAnswer !== null && numericAnswer !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <Binary size={9} />
                          Answer: {numericAnswer}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {/* Toggle */}
                    <button
                      onClick={() => q._id && handleToggle(q._id, q.isActive || false)}
                      disabled={togglingId === q._id}
                      className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                        q.isActive
                          ? 'bg-emerald-500 dark:bg-emerald-600'
                          : 'bg-gray-300 dark:bg-gray-600'
                      } ${togglingId === q._id ? 'opacity-50' : ''}`}
                    >
                      <span
                        className={`inline-block h-3 w-3 transform rounded-full bg-white dark:bg-gray-200 shadow transition-transform ${
                          q.isActive ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => onEdit(q)}
                      className="p-1 text-gray-400 hover:text-blue-600 dark:text-gray-500 dark:hover:text-blue-400 rounded"
                    >
                      <Edit2 size={13} />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => q._id && onDelete(q._id)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 rounded"
                    >
                      <Trash2 size={13} />
                    </button>

                    {/* Expand */}
                    <button
                      onClick={() => setExpandedId(expandedId === q._id ? null : q._id || null)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 rounded"
                    >
                      {expandedId === q._id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>
                </div>

                {/* Preview Description */}
                {expandedId !== q._id && description && compact && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-1 pl-1 border-l-2 border-gray-200 dark:border-gray-700">
                    {stripHtml(description).substring(0, 100)}
                    {stripHtml(description).length > 100 ? '...' : ''}
                  </p>
                )}
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {expandedId === q._id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-2.5 text-xs"
                  >
                    {isMCQ ? (
                      <div className="space-y-3">
                        {/* Full Question HTML */}
                        {htmlTitle && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                              Question:
                            </p>
                            <div
                              className="text-[10px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 prose prose-sm max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: htmlTitle }}
                            />
                          </div>
                        )}

                        {/* Question Image */}
                        {questionImageUrl && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                              Question Image:
                            </p>
                            <div 
                              className="cursor-pointer inline-block"
                              onClick={() => setPreviewImage(questionImageUrl)}
                            >
                              <img
                                src={questionImageUrl}
                                alt="Question"
                                className="max-h-32 rounded border border-gray-200 dark:border-gray-700 hover:border-indigo-400 transition-all"
                                style={{
                                  width: `${questionImageSize}%`,
                                  display: 'block',
                                  margin: questionImageAlignment === 'center' ? '0 auto' : 
                                          questionImageAlignment === 'right' ? '0 0 0 auto' : '0'
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Render based on question type */}
                        {mcqType === 'multiple_choice' || mcqType === 'multiple_select' || mcqType === 'dropdown' ? (
                          <>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
                                  Options ({options.length}) - {optionsPerRow} per row
                                </p>
                                {optionsWithImages > 0 && (
                                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
                                    {optionsWithImages} option(s) with images
                                  </span>
                                )}
                              </div>
                              {renderMCQOptions(options, correctAnswers, optionsPerRow || 1)}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[9px]">
                              <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Check size={10} />
                                Correct: {correctAnswers.join(', ')}
                              </span>
                            </div>
                          </>
                        ) : mcqType === 'true_false' ? (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Correct Answer:
                            </p>
                            {renderTrueFalse(trueFalseAnswer)}
                          </div>
                        ) : mcqType === 'short_answer' ? (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Answer Key:
                            </p>
                            {renderShortAnswer(shortAnswer)}
                          </div>
                        ) : mcqType === 'essay' ? (
                          <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p className="text-[10px] text-amber-700 dark:text-amber-300">
                              Essay questions are graded manually. No automatic answer key.
                            </p>
                          </div>
                        ) : mcqType === 'matching' ? (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Matching Pairs ({matchingPairs?.length || 0}):
                            </p>
                            {renderMatchingPairs(matchingPairs)}
                          </div>
                        ) : mcqType === 'ordering' ? (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Correct Order ({orderingItems?.length || 0} items):
                            </p>
                            {renderOrderingItems(orderingItems)}
                          </div>
                        ) : mcqType === 'numeric' ? (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Numeric Answer:
                            </p>
                            {renderNumericAnswer(numericAnswer, numericTolerance)}
                          </div>
                        ) : null}

                        {/* Explanation */}
                        {explanation && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                              Explanation:
                            </p>
                            <div
                              className="text-[10px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 prose prose-sm max-w-none dark:prose-invert"
                              dangerouslySetInnerHTML={{ __html: explanation }}
                            />
                          </div>
                        )}

                        {/* Additional metadata */}
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-200 dark:border-gray-700">
                          {timeLimit > 0 && (
                            <span className="text-[9px] bg-white dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                              ⏱ Time Limit: {timeLimit}ms
                            </span>
                          )}
                          {isRequired && (
                            <span className="text-[9px] bg-white dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-red-600 dark:text-red-400">
                              Required Question
                            </span>
                          )}
                          {q.mcqQuestionDifficulty && (
                            <span className="text-[9px] bg-white dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                              Difficulty: {q.mcqQuestionDifficulty}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Programming question details
                      <div className="space-y-2">
                        {q.description && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                              Description
                            </p>
                            <p className="text-[10px] text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700">
                              {q.description}
                            </p>
                          </div>
                        )}

                        {(q.sampleInput || q.sampleOutput) && (
                          <div className="grid grid-cols-2 gap-2">
                            {q.sampleInput && (
                              <div className="bg-gray-900 dark:bg-gray-950 p-1.5 rounded">
                                <p className="text-[8px] text-gray-400 mb-0.5 flex items-center gap-1">
                                  <Terminal size={8} /> Sample Input
                                </p>
                                <pre className="text-[9px] text-gray-100 dark:text-gray-300 font-mono whitespace-pre-wrap">
                                  {q.sampleInput}
                                </pre>
                              </div>
                            )}
                            {q.sampleOutput && (
                              <div className="bg-gray-900 dark:bg-gray-950 p-1.5 rounded">
                                <p className="text-[8px] text-gray-400 mb-0.5 flex items-center gap-1">
                                  <Terminal size={8} /> Sample Output
                                </p>
                                <pre className="text-[9px] text-gray-100 dark:text-gray-300 font-mono whitespace-pre-wrap">
                                  {q.sampleOutput}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}

                        {q.testCases && q.testCases.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                              Test Cases ({q.testCases.length})
                            </p>
                            <div className="space-y-1">
                              {q.testCases.slice(0, 3).map((tc, tcIdx) => (
                                <div
                                  key={tcIdx}
                                  className="bg-white dark:bg-gray-900 p-1.5 rounded border border-gray-200 dark:border-gray-700 text-[9px]"
                                >
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className="font-mono text-gray-600 dark:text-gray-400">
                                      #{tcIdx + 1}
                                    </span>
                                    <span
                                      className={`px-1 rounded text-[8px] ${
                                        tc.isHidden
                                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                                      }`}
                                    >
                                      {tc.isHidden ? 'Hidden' : 'Public'}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    <div className="text-gray-700 dark:text-gray-300">
                                      <span className="text-gray-500 dark:text-gray-400">Input:</span>{' '}
                                      <span className="font-mono">{tc.input || '—'}</span>
                                    </div>
                                    <div className="text-gray-700 dark:text-gray-300">
                                      <span className="text-gray-500 dark:text-gray-400">Output:</span>{' '}
                                      <span className="font-mono">{tc.expectedOutput || '—'}</span>
                                    </div>
                                  </div>
                                  {tc.points > 0 && (
                                    <div className="text-[8px] text-amber-600 dark:text-amber-400 mt-0.5">
                                      Points: {tc.points}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {q.testCases.length > 3 && (
                                <p className="text-[8px] text-gray-500 dark:text-gray-400 text-center">
                                  +{q.testCases.length - 3} more test cases
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {q.constraints && q.constraints.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                              Constraints
                            </p>
                            <ul className="list-disc list-inside text-[9px] text-gray-700 dark:text-gray-300 space-y-0.5">
                              {q.constraints.slice(0, 3).map((constraint, cIdx) => (
                                <li key={cIdx}>{constraint}</li>
                              ))}
                              {q.constraints.length > 3 && (
                                <li className="text-gray-500">+{q.constraints.length - 3} more</li>
                              )}
                            </ul>
                          </div>
                        )}

                        {(q.timeLimit || q.memoryLimit) && (
                          <div className="flex gap-2 text-[9px] pt-1 border-t border-gray-200 dark:border-gray-700">
                            {q.timeLimit && (
                              <span className="bg-white dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                                ⏱ Time: {q.timeLimit}ms
                              </span>
                            )}
                            {q.memoryLimit && (
                              <span className="bg-white dark:bg-gray-900 px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400">
                                💾 Memory: {q.memoryLimit}MB
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </>
  );
};

export default QuestionList;