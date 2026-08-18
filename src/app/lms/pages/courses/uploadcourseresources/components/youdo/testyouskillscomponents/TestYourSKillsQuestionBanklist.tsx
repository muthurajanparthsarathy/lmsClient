import React, { useState, useEffect } from 'react';
import { X, Search, Filter, Loader, Check, ChevronRight, ChevronLeft, BookOpen, Code, Database, Layout, AlertCircle, Eye, Info, CheckCircle } from 'lucide-react';
import { questionBankService } from '@/apiServices/questionBankService';
import { toast } from 'react-toastify';

interface Question {
  _id: string;
  questionCategory?: string;
  questionType?: string;
  mcqQuestionType?: string;
  mcqQuestionTitle?: any;
  questionTitle?: string;
  title?: string;
  description?: string;
  mcqQuestionDescription?: string;
  options?: any[];
  mcqQuestionOptions?: any[];
  score?: number;
  mcqQuestionScore?: number;
  difficulty?: string;
  mcqQuestionDifficulty?: string;
  explanation?: string;
  correctAnswer?: string;
  mcqQuestionCorrectAnswers?: string[];
  mcqQuestionTimeLimit?: number;
  mcqQuestionRequired?: boolean;
  mcqQuestionImageUrl?: string;
  mcqQuestionImageAlignment?: string;
  mcqQuestionImageSizePercent?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface QuestionBankSelectorProps {
  exerciseData: {
    exerciseId: string;
    exerciseName: string;
    exerciseLevel: string;
    nodeId: string;
    nodeName: string;
    subcategory: string;
    nodeType: string;
    fullExerciseData: any;
    exerciseType: string;
  };
  tabType: string;
  onClose: () => void;
  onBack?: () => void;
  onSelect: (selectedQuestions: Question[]) => void;
  existingQuestionIds: string[];
  existingQuestions: Question[];
}

// Question Detail Modal Component
const QuestionDetailModal: React.FC<{
  isOpen: boolean;
  question: Question | null;
  onClose: () => void;
}> = ({ isOpen, question, onClose }) => {
  if (!isOpen || !question) return null;

  const renderRichContent = (content: any) => {
    if (!content) return <span className="text-gray-400 italic">No content</span>;
    
    if (typeof content === 'string') {
      return <div dangerouslySetInnerHTML={{ __html: content }} />;
    }
    
    if (typeof content === 'object' && content !== null) {
      if (content.text) {
        return <div dangerouslySetInnerHTML={{ __html: content.text }} />;
      }
      if (Array.isArray(content)) {
        return (
          <div className="space-y-3">
            {content.map((block: any, idx: number) => {
              if (block.type === 'text') {
                return <div key={idx} dangerouslySetInnerHTML={{ __html: block.value || '' }} />;
              }
              if (block.type === 'code') {
                return (
                  <pre key={idx} style={{ 
                    background: '#1e1e1e', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    overflow: 'auto',
                    color: '#d4d4d4'
                  }}>
                    <code>{block.value || ''}</code>
                  </pre>
                );
              }
              if (block.type === 'image' && block.url) {
                return (
                  <div key={idx} style={{ textAlign: block.alignment || 'center', margin: '10px 0' }}>
                    <img 
                      src={block.url} 
                      alt="Question content" 
                      style={{ 
                        maxWidth: `${block.sizePercent || 60}%`, 
                        borderRadius: '8px',
                        border: '1px solid #e4e4ed'
                      }} 
                    />
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      }
    }
    
    return <span>{String(content)}</span>;
  };

  const getQuestionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      'multiple_choice': 'Single Select',
      'multiple_select': 'Multiple Select',
      'true_false': 'True/False',
      'short_answer': 'Short Answer',
      'essay': 'Essay',
      'dropdown': 'Dropdown',
      'matching': 'Matching',
      'ordering': 'Ordering',
      'numeric': 'Numeric'
    };
    return types[type] || type || 'Unknown';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch(difficulty?.toLowerCase()) {
      case 'easy': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'hard': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Question Details</h3>
              <p className="text-xs text-gray-500">View complete question information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Question Type Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getDifficultyColor(question.mcqQuestionDifficulty || question.difficulty || 'medium')}`}>
              {(question.mcqQuestionDifficulty || question.difficulty || 'MEDIUM').toUpperCase()}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 border border-purple-200">
              {getQuestionTypeLabel(question.mcqQuestionType || question.questionType)}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
              Score: {question.mcqQuestionScore || question.score || 1} pts
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
              Category: {question.questionCategory || 'General'}
            </span>
          </div>

          {/* Question Title/Content */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-5 bg-purple-500 rounded-full"></span>
              Question
            </h4>
            <div className="text-gray-900 prose max-w-none">
              {renderRichContent(question.mcqQuestionTitle || question.questionTitle || question.title)}
            </div>
            
            {/* Question Image if exists */}
            {(question.mcqQuestionImageUrl || (question.mcqQuestionTitle?.imageUrl)) && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-2">Question Image:</p>
                <div style={{ 
                  textAlign: question.mcqQuestionImageAlignment || question.mcqQuestionTitle?.imageAlignment || 'center',
                  margin: '10px 0'
                }}>
                  <img 
                    src={question.mcqQuestionImageUrl || question.mcqQuestionTitle?.imageUrl}
                    alt="Question"
                    style={{ 
                      maxWidth: `${question.mcqQuestionImageSizePercent || question.mcqQuestionTitle?.imageSizePercent || 60}%`,
                      borderRadius: '8px',
                      border: '1px solid #e4e4ed'
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Description if exists */}
          {(question.mcqQuestionDescription || question.description) && (
            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Description
              </h4>
              <p className="text-sm text-gray-700">
                {renderRichContent(question.mcqQuestionDescription || question.description)}
              </p>
            </div>
          )}

          {/* Options */}
          {(question.mcqQuestionOptions?.length > 0 || question.options?.length > 0) && (
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-1 h-5 bg-green-500 rounded-full"></span>
                Options
              </h4>
              <div className="space-y-3">
                {(question.mcqQuestionOptions || question.options || []).map((opt: any, idx: number) => (
                  <div 
                    key={idx}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      opt.isCorrect 
                        ? 'border-green-400 bg-green-50' 
                        : 'border-gray-200 bg-white hover:border-purple-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        opt.isCorrect 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <p className="text-sm font-medium text-gray-900">{opt.text}</p>
                          {opt.isCorrect && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              Correct Answer
                            </span>
                          )}
                        </div>
                        
                        {/* Option Image */}
                        {opt.imageUrl && (
                          <div style={{ 
                            textAlign: opt.imageAlignment || 'left',
                            marginTop: '8px'
                          }}>
                            <img 
                              src={opt.imageUrl}
                              alt={`Option ${String.fromCharCode(65 + idx)}`}
                              style={{ 
                                maxWidth: `${opt.imageSizePercent || 60}%`,
                                borderRadius: '8px',
                                border: '1px solid #e4e4ed'
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correct Answers Summary */}
          {question.mcqQuestionCorrectAnswers && question.mcqQuestionCorrectAnswers.length > 0 && (
            <div className="bg-green-50 rounded-xl p-5 border border-green-200">
              <h4 className="text-sm font-semibold text-green-800 mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Correct Answer{question.mcqQuestionCorrectAnswers.length > 1 ? 's' : ''}
              </h4>
              <div className="flex flex-wrap gap-2">
                {question.mcqQuestionCorrectAnswers.map((answer: string, idx: number) => (
                  <span key={idx} className="px-3 py-1.5 rounded-lg bg-white border border-green-200 text-green-700 text-sm font-medium">
                    {answer}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Explanation if exists */}
          {question.explanation && (
            <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
              <h4 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Explanation
              </h4>
              <p className="text-sm text-gray-700">{question.explanation}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Metadata</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Question ID:</span>
                <p className="text-gray-900 font-mono text-xs break-all">{question._id}</p>
              </div>
              
              <div>
                <span className="text-gray-500">Required:</span>
                <p className="text-gray-900">{question.mcqQuestionRequired !== false ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <span className="text-gray-500">Created:</span>
                <p className="text-gray-900">{question.createdAt ? new Date(question.createdAt).toLocaleString() : 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-5 py-2 border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 rounded-xl text-sm font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const TestYourSKillsQuestionBanklist: React.FC<QuestionBankSelectorProps> = ({
  exerciseData,
  tabType,
  onClose,
  onBack,
  onSelect,
  existingQuestionIds,
  existingQuestions = []
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [selectedQuestionForDetail, setSelectedQuestionForDetail] = useState<Question | null>(null);
  const [showQuestionDetailModal, setShowQuestionDetailModal] = useState(false);

  useEffect(() => {
    fetchQuestionBank();
  }, []);

  const fetchQuestionBank = async () => {
    setLoading(true);
    try {
      const response = await questionBankService.getAllQuestions({
        isActive: true
      });

      if (response && response.success) {
        // Test Your Skills runs MCQs only — drop the Programming/Frontend/
        // Database questions this screen cannot add. Filtered here rather than
        // via the API's questionType param because that compares exact strings
        // and the bank stores BOTH "mcq" and legacy "MCQ" (see the schema enum),
        // so asking the server for one casing would hide the other's questions.
        // The Select All count and action both read this list, so it has to be
        // the filtered one.
        const questionsData = (response.questions || []).filter(
          (q: Question) => (q.questionType || '').toLowerCase() === 'mcq'
        );
        setQuestions(questionsData);

        if (questionsData.length === 0) {
          toast.info('No MCQ questions found in question bank');
        }
      } else {
        setQuestions([]);
        toast.info('No questions found in question bank');
      }
    } catch (error: any) {
      console.error('Error fetching question bank:', error);
      toast.error(error.response?.data?.message || 'Failed to load question bank');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateStringSimilarity = (str1: string, str2: string): number => {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;
    
    const words1 = str1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const words2 = str2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(w => words2.includes(w));
    const totalWords = new Set([...words1, ...words2]);
    
    return commonWords.length / totalWords.size;
  };

  const getQuestionTitle = (question: any): string => {
    if (question.mcqQuestionTitle) {
      if (typeof question.mcqQuestionTitle === 'object' && question.mcqQuestionTitle !== null) {
        if (question.mcqQuestionTitle.text) {
          return question.mcqQuestionTitle.text.replace(/<[^>]*>/g, '').trim();
        }
        if (Array.isArray(question.mcqQuestionTitle)) {
          return question.mcqQuestionTitle
            .filter((cb: any) => cb.type === 'text')
            .map((cb: any) => (cb.value || '').replace(/<[^>]*>/g, '').trim())
            .filter(Boolean)
            .join(' ');
        }
      }
      if (typeof question.mcqQuestionTitle === 'string') {
        return question.mcqQuestionTitle.replace(/<[^>]*>/g, '').trim();
      }
    }
    
    const title = question.questionText || question.title || '';
    
    if (typeof title === 'string') {
      return title.replace(/<[^>]*>/g, '').trim();
    }
    
    if (Array.isArray(title)) {
      return title
        .filter((cb: any) => cb.type === 'text')
        .map((cb: any) => (cb.value || '').replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)
        .join(' ');
    }
    
    return 'Untitled Question';
  };

  const getQuestionSubType = (question: any): string => {
    const type = question.mcqQuestionType || question.questionType || '';
    if (type === 'multiple_select' || type === 'multiple-select' || type === 'checkboxes') {
      return 'Multiple Select';
    }
    if (type === 'multiple_choice' || type === 'multiple-choice' || type === 'radio') {
      return 'Single Select';
    }
    return '';
  };

  const getQuestionDescription = (question: any): string => {
    if (question.questionType?.toLowerCase() === 'mcq') {
      const desc = question.mcqQuestionDescription;
      
      if (desc && typeof desc === 'object' && desc !== null) {
        if (desc.text) {
          return desc.text.replace(/<[^>]*>/g, '').trim();
        }
        if (Array.isArray(desc)) {
          return desc
            .filter((cb: any) => cb.type === 'text')
            .map((cb: any) => (cb.value || '').replace(/<[^>]*>/g, '').trim())
            .filter(Boolean)
            .join(' ');
        }
      }
      
      if (typeof desc === 'string') {
        return desc.replace(/<[^>]*>/g, '').trim();
      }
      
      return 'Multiple Choice Question';
    }
    
    const description = question.description;
    if (typeof description === 'string') {
      return description.replace(/<[^>]*>/g, '').substring(0, 120);
    }
    
    if (description && typeof description === 'object' && description !== null) {
      if (description.text) {
        return description.text.replace(/<[^>]*>/g, '').substring(0, 120);
      }
      if (Array.isArray(description)) {
        const text = description
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.value || '')
          .join(' ')
          .replace(/<[^>]*>/g, '')
          .trim();
        return text.substring(0, 120) || 'No description provided';
      }
    }
    
    return 'No description provided';
  };

  const isDuplicate = (bankQuestion: Question): boolean => {
    if (existingQuestionIds.includes(bankQuestion._id)) {
      return true;
    }
    
    const bankTitle = getQuestionTitle(bankQuestion).toLowerCase().trim();
    
    return existingQuestions.some(existingQ => {
      const existingTitle = getQuestionTitle(existingQ).toLowerCase().trim();
      
      if (existingTitle === bankTitle) {
        return true;
      }
      
      if (existingTitle.length > 20 && bankTitle.length > 20) {
        const similarity = calculateStringSimilarity(existingTitle, bankTitle);
        return similarity > 0.8;
      }
      
      return false;
    });
  };

  const handleViewDetails = (question: Question) => {
    setSelectedQuestionForDetail(question);
    setShowQuestionDetailModal(true);
  };

  // `questions` is already MCQ-only (see fetchQuestionBank), so search is the
  // only thing left to narrow by.
  const getFilteredQuestions = () => {
    return questions.filter(q => {
      const title = getQuestionTitle(q);
      const description = getQuestionDescription(q);
      const searchLower = searchTerm.toLowerCase();
      return searchTerm === '' ||
        (title && title.toLowerCase().includes(searchLower)) ||
        (description && description.toLowerCase().includes(searchLower));
    });
  };

  const handleSelectAll = () => {
    const filtered = getFilteredQuestions();
    if (selectAll) {
      setSelectedQuestions(new Set());
    } else {
      const newSelected = new Set<string>();
      filtered.forEach(q => newSelected.add(q._id));
      setSelectedQuestions(newSelected);
    }
    setSelectAll(!selectAll);
  };

  const handleSelectQuestion = (questionId: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
    setSelectAll(false);
  };

  const handleAddSelected = () => {
    const selectedQuestionsList = questions.filter(q => selectedQuestions.has(q._id));
    onSelect(selectedQuestionsList);
  };

  const getQuestionTypeIcon = (type?: string) => {
    const typeLower = type?.toLowerCase() || '';
    switch(typeLower) {
      case 'mcq': return <BookOpen className="h-4 w-4 text-purple-600" />;
      case 'programming': return <Code className="h-4 w-4 text-blue-600" />;
      case 'frontend': return <Layout className="h-4 w-4 text-amber-600" />;
      case 'database': return <Database className="h-4 w-4 text-emerald-600" />;
      default: return <BookOpen className="h-4 w-4 text-gray-600" />;
    }
  };

  const getQuestionTypeBadge = (type?: string) => {
    const typeLower = type?.toLowerCase() || '';
    const styles: Record<string, string> = {
      mcq: 'bg-purple-100 text-purple-800 border-purple-200',
      programming: 'bg-blue-100 text-blue-800 border-blue-200',
      frontend: 'bg-amber-100 text-amber-800 border-amber-200',
      database: 'bg-emerald-100 text-emerald-800 border-emerald-200'
    };
    return styles[typeLower] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const filteredQuestions = getFilteredQuestions();

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
<div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                  style={{ background: 'rgba(168,85,247,0.08)', color: '#7c3aed', border: '1px solid rgba(168,85,247,0.2)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.08)'; }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-900">Question Bank</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Select questions to add to "{exerciseData.exerciseName}"
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Search and Filter */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                />
              </div>
              {/* Test Your Skills takes MCQs only, so there is nothing to pick
                  between — a type dropdown here would just offer options that
                  always return nothing. State what the list is instead. */}
              <span
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-purple-200 bg-purple-50 text-purple-800"
                title="Test Your Skills supports MCQ questions only"
              >
                <Filter className="h-4 w-4" />
                MCQ only
              </span>
            </div>
          </div>

          {/* Question List */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <h3 className="text-sm font-medium text-gray-900 mb-1">No questions found</h3>
                <p className="text-sm text-gray-500">
                  {questions.length === 0
                    ? 'No MCQ questions in the question bank yet'
                    : searchTerm
                      ? 'No MCQ matches your search'
                      : 'No matching questions found'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Select All Row */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Select All ({filteredQuestions.length} question{filteredQuestions.length !== 1 ? 's' : ''})
                    </span>
                  </label>
                </div>

                {filteredQuestions.map((question) => {
                  const title = getQuestionTitle(question);
                  const description = getQuestionDescription(question);
                  const isDuplicateQuestion = isDuplicate(question);
                  const isSelected = selectedQuestions.has(question._id);
                  const questionType = question.questionType?.toLowerCase() || '';
                  const subType = getQuestionSubType(question);

                  return (
                    <div
                      key={question._id}
                      className={`flex items-start gap-3 p-3 border rounded-lg transition-all ${
                        isDuplicateQuestion 
                          ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' 
                          : isSelected 
                            ? 'border-purple-400 bg-purple-50 cursor-pointer' 
                            : 'border-gray-200 hover:border-purple-200 hover:bg-purple-50/50 cursor-pointer'
                      }`}
                      onClick={() => !isDuplicateQuestion && handleSelectQuestion(question._id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => !isDuplicateQuestion && handleSelectQuestion(question._id)}
                        disabled={isDuplicateQuestion}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50"
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getQuestionTypeBadge(question.questionType)}`}>
                            {question.questionType?.toUpperCase() || 'UNKNOWN'}
                          </span>
                          
                          {/* Sub-type badge - Single Select or Multiple Select */}
                          {subType && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                              subType === 'Multiple Select' 
                                ? 'bg-blue-100 text-blue-700' 
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {subType}
                            </span>
                          )}
                          
                          {/* Duplicate indicator */}
                          {isDuplicateQuestion && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Already exists
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {title}
                              {isDuplicateQuestion && <span className="ml-2 text-amber-600 text-xs">(Duplicate)</span>}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {description}
                            </p>
                          </div>
                          
                          {/* View Details Button */}
                          {!isDuplicateQuestion && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(question);
                              }}
                              className="flex-shrink-0 p-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                              title="View full details"
                            >
                              <Eye className="h-4 w-4 text-gray-400 hover:text-purple-600" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isSelected && !isDuplicateQuestion && (
                        <Check className="h-5 w-5 text-purple-600 flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="text-sm text-gray-600">
              {selectedQuestions.size} question{selectedQuestions.size !== 1 ? 's' : ''} selected
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelected}
                disabled={selectedQuestions.size === 0}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:opacity-90 transition-opacity"
              >
                Add Selected
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Question Detail Modal */}
      <QuestionDetailModal
        isOpen={showQuestionDetailModal}
        question={selectedQuestionForDetail}
        onClose={() => setShowQuestionDetailModal(false)}
      />
    </>
  );
};

export default TestYourSKillsQuestionBanklist;