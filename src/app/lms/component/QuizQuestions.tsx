"use client";

import React, { useState } from 'react';
import {
  Plus,
  X,
  FileText,
  Edit3,
  MoreVertical,
  Power,
  Copy,
  Trash2,
  Save,
  Search,
  Filter,
  BookOpen
} from 'lucide-react';

interface QuizQuestion {
  id: string;
  title: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  enabled: boolean;
}

const QuizQuestions: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([
    {
      id: 'quiz-1',
      title: 'JavaScript Basics',
      question: 'What is the output of: console.log(typeof null)?',
      options: ['"object"', '"null"', '"undefined"', '"boolean"'],
      correctAnswer: 0,
      explanation: 'In JavaScript, typeof null returns "object" due to a historical bug in the language.',
      difficulty: 'easy',
      tags: ['javascript', 'types'],
      enabled: true
    }
  ]);

  const [currentQuizQuestion, setCurrentQuizQuestion] = useState<QuizQuestion>({
    id: '',
    title: '',
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    explanation: '',
    difficulty: 'medium',
    tags: [],
    enabled: true
  });

  // New state for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const difficultyOptions = [
    { value: 'easy', label: 'Easy', color: 'text-green-600 bg-green-50' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600 bg-yellow-50' },
    { value: 'hard', label: 'Hard', color: 'text-red-600 bg-red-50' }
  ];

  // Filter questions based on search, difficulty and status
  const filteredQuizQuestions = quizQuestions.filter(question => {
    const matchesSearch = question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesDifficulty = difficultyFilter === 'all' || question.difficulty === difficultyFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'enabled' && question.enabled) ||
                         (statusFilter === 'disabled' && !question.enabled);
    
    return matchesSearch && matchesDifficulty && matchesStatus;
  });

  const handleAddQuizQuestion = () => {
    setCurrentQuizQuestion({
      id: Date.now().toString(),
      title: '',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
      difficulty: 'medium',
      tags: [],
      enabled: true
    });
    setShowModal(true);
  };

  const handleSaveQuestion = () => {
    if (!currentQuizQuestion.title.trim() || !currentQuizQuestion.question.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    if (currentQuizQuestion.options.some(opt => !opt.trim())) {
      alert('Please fill in all options');
      return;
    }

    const updatedQuizQuestions = quizQuestions.some(q => q.id === currentQuizQuestion.id)
      ? quizQuestions.map(q => q.id === currentQuizQuestion.id ? currentQuizQuestion : q)
      : [...quizQuestions, currentQuizQuestion];

    setQuizQuestions(updatedQuizQuestions);
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setCurrentQuizQuestion({
      id: '',
      title: '',
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: '',
      difficulty: 'medium',
      tags: [],
      enabled: true
    });
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      const newTag = e.currentTarget.value.trim();
      if (!currentQuizQuestion.tags.includes(newTag)) {
        setCurrentQuizQuestion(prev => ({
          ...prev,
          tags: [...prev.tags, newTag]
        }));
      }
      e.currentTarget.value = '';
    }
  };

  const removeTag = (tagToRemove: string) => {
    setCurrentQuizQuestion(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleQuizOptionChange = (index: number, value: string) => {
    const newOptions = [...currentQuizQuestion.options];
    newOptions[index] = value;
    setCurrentQuizQuestion(prev => ({
      ...prev,
      options: newOptions
    }));
  };

  const toggleQuestionStatus = (id: string) => {
    setQuizQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, enabled: !q.enabled } : q
    ));
  };

  const duplicateQuestion = (id: string) => {
    const questionToDuplicate = quizQuestions.find(q => q.id === id);
    if (questionToDuplicate) {
      const duplicatedQuestion = {
        ...questionToDuplicate,
        id: Date.now().toString(),
        title: `${questionToDuplicate.title} (Copy)`,
        enabled: true
      };
      setQuizQuestions(prev => [...prev, duplicatedQuestion]);
    }
  };

  const deleteQuestion = (id: string) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      setQuizQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  const toggleDropdown = (id: string) => {
    setActiveDropdown(activeDropdown === id ? null : id);
  };

  return (
    <div>
      {/* Enhanced Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-3">
          <button
            onClick={handleAddQuizQuestion}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
          >
            <Plus size={18} />
            Add Quiz Question
          </button>
        </div>
      </div>

      {/* Enhanced Filters Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-3">
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              <Filter size={18} />
              More Filters
            </button>
          </div>
        </div>

        {/* Additional Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <input
                  type="text"
                  placeholder="Filter by tags..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Question Type</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm">
                  <option value="all">All Types</option>
                  <option value="multiple">Multiple Choice</option>
                  <option value="truefalse">True/False</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuizQuestions.map((question) => (
          <div key={question.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText size={20} className="text-green-600" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900 truncate text-sm">{question.title}</h3>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      difficultyOptions.find(d => d.value === question.difficulty)?.color
                    }`}>
                      {question.difficulty}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      question.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {question.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-2 line-clamp-2">{question.question}</p>
                  
                  <div className="flex flex-wrap gap-1">
                    {question.tags.slice(0, 4).map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                    {question.tags.length > 4 && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                        +{question.tags.length - 4}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Enhanced Actions Dropdown */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => toggleDropdown(question.id)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MoreVertical size={18} />
                </button>
                
                {activeDropdown === question.id && (
                  <div className="absolute right-0 top-12 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
                    <button
                      onClick={() => {
                        toggleQuestionStatus(question.id);
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <Power size={16} />
                      {question.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => {
                        duplicateQuestion(question.id);
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <Copy size={16} />
                      Duplicate
                    </button>
                    <button
                      onClick={() => {
                        setCurrentQuizQuestion(question);
                        setShowModal(true);
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                      <Edit3 size={16} />
                      Edit
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={() => {
                        deleteQuestion(question.id);
                        setActiveDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 text-sm"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredQuizQuestions.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No quiz questions found</h3>
            <p className="text-gray-500 mb-4 text-sm">No questions match your current filters.</p>
            <button
              onClick={handleAddQuizQuestion}
              className="text-green-600 hover:text-green-700 font-medium text-sm"
            >
              Create your first quiz question
            </button>
          </div>
        )}
      </div>

      {/* Quiz Question Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {currentQuizQuestion.id ? 'Edit Quiz Question' : 'Create Quiz Question'}
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Create a multiple choice quiz question
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveQuestion}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <Save size={16} />
                  Save
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6 bg-gray-50">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Question Title *
                      </label>
                      <input
                        type="text"
                        value={currentQuizQuestion.title}
                        onChange={(e) => setCurrentQuizQuestion(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter question title..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Difficulty
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {difficultyOptions.map(({ value, label, color }) => (
                          <button
                            key={value}
                            onClick={() => setCurrentQuizQuestion(prev => ({ ...prev, difficulty: value as any }))}
                            className={`p-2 text-center rounded-lg border transition-all text-sm font-medium ${
                              currentQuizQuestion.difficulty === value
                                ? `${color} border-current shadow-sm`
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Question */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Question *
                    </label>
                    <textarea
                      value={currentQuizQuestion.question}
                      onChange={(e) => setCurrentQuizQuestion(prev => ({ ...prev, question: e.target.value }))}
                      placeholder="Enter the question..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  {/* Options */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      Options *
                    </label>
                    <div className="space-y-3">
                      {currentQuizQuestion.options.map((option, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="correctAnswer"
                            checked={currentQuizQuestion.correctAnswer === index}
                            onChange={() => setCurrentQuizQuestion(prev => ({ ...prev, correctAnswer: index }))}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleQuizOptionChange(index, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          />
                          <span className="text-sm text-gray-500 font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                            {String.fromCharCode(65 + index)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Explanation */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Explanation
                    </label>
                    <textarea
                      value={currentQuizQuestion.explanation}
                      onChange={(e) => setCurrentQuizQuestion(prev => ({ ...prev, explanation: e.target.value }))}
                      placeholder="Explain why the correct answer is right..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </div>

                  {/* Tags */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Tags
                    </label>
                    <div className="border border-gray-300 rounded-lg p-3 min-h-[42px] bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                      <div className="flex flex-wrap gap-1 mb-2">
                        {currentQuizQuestion.tags.map(tag => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium"
                          >
                            {tag}
                            <button
                              onClick={() => removeTag(tag)}
                              className="hover:text-green-600 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Add tag and press Enter..."
                        onKeyDown={handleTagInput}
                        className="w-full border-none focus:ring-0 p-0 placeholder-gray-400 text-sm"
                      />
                    </div>
                  </div>

                  {/* Enable/Disable Toggle */}
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentQuizQuestion.enabled}
                        onChange={(e) => setCurrentQuizQuestion(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-900">Enable this question</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizQuestions;