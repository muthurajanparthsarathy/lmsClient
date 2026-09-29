import React, { useState, useEffect, useCallback } from 'react';
import { hostOf } from '@/lib/frameEmbed';
import {
  X, ChevronLeft, ChevronRight, Eye, Code2, Database,
  CheckSquare, AlignLeft, List, ToggleLeft, Hash, Shuffle,
  ArrowUpDown, Type, FileText, Check, AlertCircle, Clock,
  Star, Layers, BookOpen, Zap, Circle
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface McqOption {
  text: string;
  isCorrect: boolean;
  imageUrl: string | null;
  imageAlignment: string;
  imageSizePercent: number;
  _id: string;
}

interface MatchingPair {
  left: string;
  right: string;
  _id: string;
}

interface OrderingItem {
  text: string;
  order: number;
  _id: string;
}

interface Question {
  _id: string;
  questionType: 'mcq' | 'programming' | 'frontend' | 'database';
  mcqQuestionTitle?: string;
  mcqQuestionDescription?: string;
  mcqQuestionType?:
    | 'multiple_choice'
    | 'checkboxes'
    | 'multiple_select'
    | 'dropdown'
    | 'short_answer'
    | 'essay'
    | 'true_false'
    | 'matching'
    | 'ordering'
    | 'numeric';
  mcqQuestionDifficulty?: 'easy' | 'medium' | 'hard';
  mcqQuestionScore?: number;
  mcqQuestionTimeLimit?: number;
  mcqQuestionOptions?: McqOption[];
  mcqQuestionCorrectAnswers?: string[];
  mcqQuestionOptionsPerRow?: number;
  trueFalseAnswer?: boolean | null;
  shortAnswer?: string;
  numericAnswer?: number | null;
  numericTolerance?: number | null;
  matchingPairs?: MatchingPair[];
  orderingItems?: OrderingItem[];
  hasExplanation?: boolean;
  title?: string;
  description?: any;
  difficulty?: 'easy' | 'medium' | 'hard';
  score?: number;
  sampleInput?: string;
  sampleOutput?: string;
  constraints?: string[];
  hints?: any[];
  testCases?: any[];
  timeLimit?: number;
  memoryLimit?: number;
  isActive?: boolean;
  sequence?: number;
}

interface QuestionPreviewProps {
  question: Question;
  allQuestions?: Question[];
  onClose: () => void;
  onNavigate?: (question: Question) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const stripHtml = (html: string): string => (html || '').replace(/<[^>]*>/g, '').trim();

const getTitle = (q: Question): string => {
  if (q.questionType === 'mcq') {
    const t = q.mcqQuestionTitle;
    if (Array.isArray(t)) {
      return t.filter((cb: any) => cb.type === 'text')
        .map((cb: any) => (cb.value || '').replace(/<[^>]*>/g, '').trim())
        .filter(Boolean).join(' ') || 'Untitled Question';
    }
    return stripHtml(typeof t === 'string' ? t : '') || 'Untitled Question';
  }
  return stripHtml(q.title || '') || 'Untitled Question';
};
const getDifficulty = (q: Question): 'easy' | 'medium' | 'hard' =>
  (q.questionType === 'mcq' ? q.mcqQuestionDifficulty : q.difficulty) || 'medium';

const getScore = (q: Question): number =>
  (q.questionType === 'mcq' ? q.mcqQuestionScore : q.score) || 0;

const getDescription = (q: Question): string => {
  if (q.questionType === 'mcq') return q.mcqQuestionDescription || '';
  if (!q.description) return '';
  if (typeof q.description === 'string') return q.description;
  return (q.description as any).text || '';
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const DiffBadge: React.FC<{ level: string }> = ({ level }) => {
  const cfg: Record<string, string> = {
    easy: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    hard: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return (
    <span className={`inline-flex items-center text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full border ${cfg[level] || cfg.medium}`}>
      {level}
    </span>
  );
};

const TypeLabel: React.FC<{ type: string; subType?: string }> = ({ type, subType }) => {
  const labels: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    multiple_choice: { icon: <Circle size={11} />, label: 'Multiple Choice', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    checkboxes: { icon: <CheckSquare size={11} />, label: 'Checkboxes', color: 'text-violet-600 bg-violet-50 border-violet-200' },
    multiple_select: { icon: <CheckSquare size={11} />, label: 'Multi-Select', color: 'text-violet-600 bg-violet-50 border-violet-200' },
    dropdown: { icon: <List size={11} />, label: 'Dropdown', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    short_answer: { icon: <Type size={11} />, label: 'Short Answer', color: 'text-teal-600 bg-teal-50 border-teal-200' },
    essay: { icon: <FileText size={11} />, label: 'Essay', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
    true_false: { icon: <ToggleLeft size={11} />, label: 'True / False', color: 'text-orange-600 bg-orange-50 border-orange-200' },
    matching: { icon: <Shuffle size={11} />, label: 'Matching', color: 'text-pink-600 bg-pink-50 border-pink-200' },
    ordering: { icon: <ArrowUpDown size={11} />, label: 'Ordering', color: 'text-lime-600 bg-lime-50 border-lime-200' },
    numeric: { icon: <Hash size={11} />, label: 'Numeric', color: 'text-red-600 bg-red-50 border-red-200' },
    programming: { icon: <Code2 size={11} />, label: 'Programming', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    frontend: { icon: <Layers size={11} />, label: 'Frontend', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    database: { icon: <Database size={11} />, label: 'Database', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  };
  const key = subType || type;
  const cfg = labels[key] || labels.programming;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
};

// ─── Question Type Renderers ───────────────────────────────────────────────────

const MultipleChoiceRenderer: React.FC<{ question: Question; multi?: boolean }> = ({ question, multi = false }) => {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const options = question.mcqQuestionOptions || [];
  const correct = question.mcqQuestionCorrectAnswers || [];
  const perRow = question.mcqQuestionOptionsPerRow || 1;

  const toggle = (text: string) => {
    if (submitted) return;
    if (multi) {
      setSelected(prev => prev.includes(text) ? prev.filter(s => s !== text) : [...prev, text]);
    } else {
      setSelected([text]);
    }
  };

  const check = () => {
    if (!selected.length) return;
    setSubmitted(true);
  };

  const reset = () => { setSelected([]); setSubmitted(false); };

  const getOptionState = (opt: McqOption) => {
    if (!submitted) {
      if (selected.includes(opt.text)) return 'selected';
      return 'idle';
    }
    if (opt.isCorrect && selected.includes(opt.text)) return 'correct';
    if (opt.isCorrect && !selected.includes(opt.text)) return 'missed';
    if (!opt.isCorrect && selected.includes(opt.text)) return 'wrong';
    return 'idle';
  };

  const stateClasses: Record<string, string> = {
    idle: 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer',
    selected: 'border-blue-400 bg-blue-50 shadow-sm cursor-pointer',
    correct: 'border-emerald-400 bg-emerald-50',
    missed: 'border-amber-400 bg-amber-50',
    wrong: 'border-red-400 bg-red-50',
  };

  const gridClass = perRow === 2 ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2';

  return (
    <div>
      <div className={gridClass}>
        {options.map((opt, i) => {
          const state = getOptionState(opt);
          return (
            <div
              key={opt._id || i}
              onClick={() => toggle(opt.text)}
              className={`flex items-start gap-2.5 p-3 rounded-xl border-2 transition-all duration-150 select-none ${stateClasses[state]}`}
            >
              <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                state === 'selected' ? 'border-blue-500 bg-blue-500' :
                state === 'correct' ? 'border-emerald-500 bg-emerald-500' :
                state === 'missed' ? 'border-amber-500 bg-amber-100' :
                state === 'wrong' ? 'border-red-400 bg-red-100' :
                'border-slate-300'
              }`}>
                {(state === 'selected' || state === 'correct') && <div className="w-2 h-2 rounded-full bg-white" />}
                {state === 'wrong' && <X size={10} className="text-red-400" />}
                {state === 'missed' && <Check size={10} className="text-amber-500" />}
              </div>
              <span className={`text-[13px] leading-snug ${
                state === 'correct' ? 'text-emerald-800 font-medium' :
                state === 'wrong' ? 'text-red-700' :
                state === 'missed' ? 'text-amber-800 font-medium' :
                'text-slate-700'
              }`}>{stripHtml(opt.text)}</span>
              {submitted && opt.isCorrect && (
                <span className="ml-auto flex-shrink-0">
                  <Check size={13} className="text-emerald-500" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2">
        {!submitted ? (
          <button
            onClick={check}
            disabled={!selected.length}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Check Answer
          </button>
        ) : (
          <>
            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${
              correct.every(c => selected.includes(c)) && selected.every(s => correct.includes(s))
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {correct.every(c => selected.includes(c)) && selected.every(s => correct.includes(s))
                ? <><Check size={12} /> Correct!</>
                : <><X size={12} /> Incorrect</>
              }
            </div>
            <button onClick={reset} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition-colors">
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const DropdownRenderer: React.FC<{ question: Question }> = ({ question }) => {
  const [selected, setSelected] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const options = question.mcqQuestionOptions || [];
  const correct = question.mcqQuestionCorrectAnswers || [];

  const isCorrect = correct.includes(selected);

  return (
    <div className="space-y-3">
      <div className="relative">
        <select
          value={selected}
          onChange={e => { setSelected(e.target.value); setSubmitted(false); }}
          disabled={submitted}
          className={`w-full px-3 py-2.5 text-sm border-2 rounded-xl appearance-none bg-white transition-all outline-none cursor-pointer ${
            submitted && isCorrect ? 'border-emerald-400 bg-emerald-50' :
            submitted && !isCorrect ? 'border-red-400 bg-red-50' :
            'border-slate-200 hover:border-blue-300 focus:border-blue-400'
          }`}
        >
          <option value="">— Select an answer —</option>
          {options.map((opt, i) => (
            <option key={opt._id || i} value={opt.text}>{stripHtml(opt.text)}</option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
          <ChevronLeft size={14} className="rotate-[-90deg]" />
        </div>
      </div>

      {!submitted ? (
        <button
          onClick={() => { if (selected) setSubmitted(true); }}
          disabled={!selected}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Check Answer
        </button>
      ) : (
        <div className="space-y-2">
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg w-fit ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {isCorrect ? <><Check size={12} /> Correct!</> : <><X size={12} /> Incorrect — Correct: {correct.join(', ')}</>}
          </div>
          <button onClick={() => { setSelected(''); setSubmitted(false); }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg transition-colors">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

const TrueFalseRenderer: React.FC<{ question: Question }> = ({ question }) => {
  const [selected, setSelected] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const correctAnswer = question.trueFalseAnswer;
  const isCorrect = submitted && selected === correctAnswer;

  const getState = (value: boolean) => {
    if (!submitted) return selected === value ? 'selected' : 'idle';
    if (value === correctAnswer) return 'correct';
    if (selected === value && value !== correctAnswer) return 'wrong';
    return 'idle';
  };

  const stateClasses: Record<string, string> = {
    idle: 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 cursor-pointer text-slate-700',
    selected: 'border-blue-400 bg-blue-50 text-blue-700 cursor-pointer',
    correct: 'border-emerald-400 bg-emerald-50 text-emerald-700',
    wrong: 'border-red-400 bg-red-50 text-red-600',
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map(val => {
          const state = getState(val);
          return (
            <div
              key={String(val)}
              onClick={() => { if (!submitted) { setSelected(val); } }}
              className={`flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all font-semibold text-sm select-none ${stateClasses[state]}`}
            >
              {state === 'correct' && <Check size={14} />}
              {state === 'wrong' && <X size={14} />}
              {val ? 'True' : 'False'}
            </div>
          );
        })}
      </div>
      {selected !== null && !submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Check Answer
        </button>
      ) : submitted ? (
        <div className="flex gap-2 items-center">
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {isCorrect ? <><Check size={12} /> Correct!</> : <><X size={12} /> Incorrect — Answer is {correctAnswer ? 'True' : 'False'}</>}
          </div>
          <button onClick={() => { setSelected(null); setSubmitted(false); }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg">
            Try Again
          </button>
        </div>
      ) : null}
    </div>
  );
};

const ShortAnswerRenderer: React.FC<{ question: Question; isEssay?: boolean }> = ({ question, isEssay = false }) => {
  const [value, setValue] = useState('');

  return (
    <div className="space-y-2">
      {isEssay ? (
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Type your essay response here..."
          rows={6}
          className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white resize-none leading-relaxed"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Type your answer here..."
          className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 bg-white"
        />
      )}
      <p className="text-[10px] text-slate-400 flex items-center gap-1">
        <AlertCircle size={10} />
        This question is manually graded by the instructor.
      </p>
    </div>
  );
};

const NumericRenderer: React.FC<{ question: Question }> = ({ question }) => {
  const [value, setValue] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const correctAnswer = question.numericAnswer;
  const tolerance = question.numericTolerance || 0;

  const check = () => {
    const num = parseFloat(value);
    if (!isNaN(num)) setSubmitted(true);
  };

  const isCorrect = submitted && correctAnswer !== null && correctAnswer !== undefined &&
    Math.abs(parseFloat(value) - correctAnswer) <= tolerance;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="number"
            value={value}
            onChange={e => { setValue(e.target.value); setSubmitted(false); }}
            placeholder="Enter numeric answer..."
            disabled={submitted}
            className={`w-full pl-8 pr-3 py-2.5 text-sm border-2 rounded-xl focus:outline-none transition-all ${
              submitted && isCorrect ? 'border-emerald-400 bg-emerald-50' :
              submitted && !isCorrect ? 'border-red-400 bg-red-50' :
              'border-slate-200 focus:border-blue-400'
            }`}
          />
        </div>
        {tolerance > 0 && !submitted && (
          <span className="text-[11px] text-slate-400 whitespace-nowrap">± {tolerance} tolerance</span>
        )}
      </div>

      {!submitted ? (
        <button
          onClick={check}
          disabled={!value}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Check Answer
        </button>
      ) : (
        <div className="flex gap-2 flex-wrap items-center">
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {isCorrect
              ? <><Check size={12} /> Correct! ({value})</>
              : <><X size={12} /> Incorrect — Expected: {correctAnswer}{tolerance > 0 ? ` ± ${tolerance}` : ''}</>
            }
          </div>
          <button onClick={() => { setValue(''); setSubmitted(false); }} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

const MatchingRenderer: React.FC<{ question: Question }> = ({ question }) => {
  const pairs = question.matchingPairs || [];
  const [userMatches, setUserMatches] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);

  // Shuffle right side for the puzzle
  const [shuffledRight] = useState(() => [...pairs].sort(() => Math.random() - 0.5));

  const handleLeftClick = (left: string) => {
    if (submitted) return;
    setSelectedLeft(prev => prev === left ? null : left);
  };

  const handleRightClick = (right: string) => {
    if (submitted || !selectedLeft) return;
    setUserMatches(prev => ({ ...prev, [selectedLeft]: right }));
    setSelectedLeft(null);
  };

  const correctCount = pairs.filter(p => userMatches[p.left] === p.right).length;
  const isFullyCorrect = submitted && correctCount === pairs.length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {/* Left column */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Prompts</p>
          {pairs.map((pair, i) => {
            const isSelected = selectedLeft === pair.left;
            const isMatched = !!userMatches[pair.left];
            const isCorrectMatch = submitted && userMatches[pair.left] === pair.right;
            const isWrongMatch = submitted && isMatched && !isCorrectMatch;
            return (
              <div
                key={pair._id || i}
                onClick={() => handleLeftClick(pair.left)}
                className={`px-3 py-2 rounded-lg border-2 text-sm cursor-pointer transition-all select-none ${
                  isSelected ? 'border-blue-500 bg-blue-50 text-blue-700' :
                  isCorrectMatch ? 'border-emerald-400 bg-emerald-50 text-emerald-700' :
                  isWrongMatch ? 'border-red-400 bg-red-50 text-red-600' :
                  isMatched ? 'border-slate-300 bg-slate-50 text-slate-600' :
                  'border-slate-200 bg-white hover:border-blue-300 text-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span>{pair.left}</span>
                  {isMatched && <span className="text-[10px] text-slate-400 font-medium">→ {userMatches[pair.left]}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right column */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {selectedLeft ? <span className="text-blue-600 animate-pulse">Select match for "{selectedLeft}"</span> : 'Answers'}
          </p>
          {shuffledRight.map((pair, i) => {
            const isUsed = Object.values(userMatches).includes(pair.right);
            const correctPair = pairs.find(p => p.right === pair.right);
            const isCorrectMatch = submitted && correctPair && userMatches[correctPair.left] === pair.right;
            return (
              <div
                key={pair._id || i}
                onClick={() => handleRightClick(pair.right)}
                className={`px-3 py-2 rounded-lg border-2 text-sm transition-all select-none ${
                  isCorrectMatch ? 'border-emerald-400 bg-emerald-50 text-emerald-700' :
                  submitted && isUsed ? 'border-red-300 bg-red-50 text-red-600' :
                  selectedLeft && !isUsed ? 'border-blue-200 bg-blue-50/50 hover:border-blue-400 cursor-pointer text-slate-700' :
                  isUsed ? 'border-slate-200 bg-slate-50 text-slate-400' :
                  'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {pair.right}
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(userMatches).length === pairs.length && !submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Check Matches
        </button>
      ) : submitted ? (
        <div className="flex gap-2 flex-wrap items-center">
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${isFullyCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isFullyCorrect ? <><Check size={12} /> All Correct!</> : <><Star size={12} /> {correctCount}/{pairs.length} Correct</>}
          </div>
          <button onClick={() => { setUserMatches({}); setSubmitted(false); setSelectedLeft(null); }}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg">
            Try Again
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">Click a prompt on the left, then its matching answer on the right.</p>
      )}
    </div>
  );
};

const OrderingRenderer: React.FC<{ question: Question }> = ({ question }) => {
  const items = question.orderingItems || [];
  const [ordered, setOrdered] = useState(() => [...items].sort(() => Math.random() - 0.5));
  const [submitted, setSubmitted] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDragStart = (i: number) => setDragIdx(i);
  const handleDragOver = (e: React.DragEvent, i: number) => { e.preventDefault(); setDragOver(i); };
  const handleDrop = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setDragOver(null); return; }
    const updated = [...ordered];
    const [moved] = updated.splice(dragIdx, 1);
    updated.splice(i, 0, moved);
    setOrdered(updated);
    setDragIdx(null);
    setDragOver(null);
  };

  const correctOrder = [...items].sort((a, b) => a.order - b.order);
  const isCorrect = submitted && ordered.every((item, i) => item.text === correctOrder[i]?.text);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-400">Drag items to arrange them in the correct order.</p>
      <div className="space-y-2">
        {ordered.map((item, i) => {
          const isCorrectPos = submitted && item.text === correctOrder[i]?.text;
          const isWrongPos = submitted && !isCorrectPos;
          return (
            <div
              key={item._id || i}
              draggable={!submitted}
              onDragStart={() => handleDragStart(i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={e => handleDrop(e, i)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all select-none ${
                dragOver === i ? 'border-blue-400 bg-blue-50 scale-[1.02]' :
                isCorrectPos ? 'border-emerald-400 bg-emerald-50' :
                isWrongPos ? 'border-red-300 bg-red-50' :
                'border-slate-200 bg-white hover:border-slate-300 cursor-grab active:cursor-grabbing'
              }`}
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                isCorrectPos ? 'bg-emerald-200 text-emerald-700' :
                isWrongPos ? 'bg-red-200 text-red-600' :
                'bg-slate-100 text-slate-500'
              }`}>{i + 1}</div>
              <span className={`text-sm flex-1 ${isCorrectPos ? 'text-emerald-800' : isWrongPos ? 'text-red-700' : 'text-slate-700'}`}>
                {item.text}
              </span>
              {submitted && isWrongPos && (
                <span className="text-[10px] text-red-400">
                  Should be #{correctOrder.findIndex(c => c.text === item.text) + 1}
                </span>
              )}
              {!submitted && <span className="text-slate-300 text-xs">⠿</span>}
            </div>
          );
        })}
      </div>

      {!submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          Check Order
        </button>
      ) : (
        <div className="flex gap-2 flex-wrap items-center">
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {isCorrect ? <><Check size={12} /> Perfect Order!</> : <><AlertCircle size={12} /> Not quite right</>}
          </div>
          <button onClick={() => { setOrdered([...items].sort(() => Math.random() - 0.5)); setSubmitted(false); }}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};

const ProgrammingRenderer: React.FC<{ question: Question }> = ({ question }) => {
  const desc = getDescription(question);
  const constraints = question.constraints || [];
  const hints = question.hints || [];
  const testCases = question.testCases || [];
  const [showHints, setShowHints] = useState(false);

  // Link questions: the external URL IS the question — preview the framed
  // page with an open-in-new-tab escape hatch (some sites refuse framing).
  const linkUrl = (question as any).isLinkQuestion && (question as any).questionLink;
  if (linkUrl) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-orange-50 border border-orange-200 rounded-full text-orange-700 font-semibold">
            Link question
          </span>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-blue-600 hover:underline break-all"
          >
            {linkUrl} ↗
          </a>
        </div>
        {/* No iframe — link questions always open on the external site;
            students get the same open-in-new-tab flow. */}
        <div className="flex flex-col items-center justify-center gap-3 p-10 text-center rounded-lg border border-dashed border-slate-300 bg-slate-50">
          <div className="text-[14px] font-bold text-slate-700">This question opens on {hostOf(linkUrl)}</div>
          <p className="text-[12px] text-slate-500 max-w-md">
            Students get an "Open the problem" button, solve it on the site, then press Submit Question here.
          </p>
          <a
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-orange-500 text-white text-[12.5px] font-semibold hover:bg-orange-600"
          >
            Open the problem ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Description */}
      {desc && (
        <div className="text-sm text-slate-700 leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: desc }} />
        </div>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-2">
        {question.timeLimit && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-slate-600">
            <Clock size={10} /> {question.timeLimit / 1000}s time limit
          </span>
        )}
        {question.memoryLimit && (
          <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full text-slate-600">
            <Zap size={10} /> {question.memoryLimit}MB memory
          </span>
        )}
      </div>

      {/* Sample I/O */}
      {(question.sampleInput || question.sampleOutput) && (
        <div className="grid grid-cols-2 gap-3">
          {question.sampleInput && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Sample Input</p>
              <pre className="bg-slate-900 text-slate-300 text-xs p-3 rounded-lg font-mono overflow-x-auto leading-relaxed">
                {question.sampleInput}
              </pre>
            </div>
          )}
          {question.sampleOutput && (
            <div>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Sample Output</p>
              <pre className="bg-slate-900 text-emerald-400 text-xs p-3 rounded-lg font-mono overflow-x-auto leading-relaxed">
                {question.sampleOutput}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Constraints */}
      {constraints.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Constraints</p>
          <ul className="space-y-1">
            {constraints.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                <span className="text-blue-400 mt-0.5">•</span>
                <span className="font-mono">{typeof c === 'string' ? c : JSON.stringify(c)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Test Cases */}
      {testCases.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Test Cases ({testCases.length})
          </p>
          <div className="space-y-2">
            {testCases.slice(0, 3).map((tc, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Input</p>
                  <pre className="text-[11px] font-mono text-slate-600">{tc.input || '—'}</pre>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Expected</p>
                  <pre className="text-[11px] font-mono text-emerald-600">{tc.expectedOutput || tc.output || '—'}</pre>
                </div>
              </div>
            ))}
            {testCases.length > 3 && (
              <p className="text-[11px] text-slate-400">+{testCases.length - 3} more test cases hidden</p>
            )}
          </div>
        </div>
      )}

      {/* Hints */}
      {hints.length > 0 && (
        <div>
          <button
            onClick={() => setShowHints(v => !v)}
            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700 font-medium transition-colors"
          >
            <BookOpen size={12} />
            {showHints ? 'Hide' : 'Show'} Hints ({hints.length})
          </button>
          {showHints && (
            <div className="mt-2 space-y-2">
              {hints.map((hint, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] font-bold text-amber-600 mt-0.5">#{i + 1}</span>
                  <p className="text-xs text-amber-800">{hint.hintText || hint.text || String(hint)}</p>
                  {hint.pointsDeduction > 0 && (
                    <span className="ml-auto text-[10px] text-amber-500 shrink-0">-{hint.pointsDeduction} pts</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Answer key panel ──────────────────────────────────────────────────────────

const AnswerKey: React.FC<{ question: Question }> = ({ question }) => {
  const subType = question.mcqQuestionType;

  if (subType === 'true_false') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Answer:</span>
        <span className={`font-bold px-2.5 py-1 rounded-lg ${question.trueFalseAnswer ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {question.trueFalseAnswer ? 'True' : 'False'}
        </span>
      </div>
    );
  }

  if (subType === 'numeric') {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500">Answer:</span>
        <span className="font-bold text-slate-800">{question.numericAnswer}</span>
        {question.numericTolerance != null && question.numericTolerance > 0 && (
          <span className="text-slate-400">± {question.numericTolerance}</span>
        )}
      </div>
    );
  }

  if (subType === 'matching') {
    const pairs = question.matchingPairs || [];
    if (!pairs.length) return null;
    return (
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Correct Matches:</span>
        <div className="flex flex-wrap gap-1.5">
          {pairs.map((p, i) => (
            <span key={i} className="text-[11px] px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
              {p.left} → {p.right}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (subType === 'ordering') {
    const sorted = [...(question.orderingItems || [])].sort((a, b) => a.order - b.order);
    if (!sorted.length) return null;
    return (
      <div className="space-y-1">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Correct Order:</span>
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((item, i) => (
            <span key={i} className="text-[11px] px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg">
              {i + 1}. {item.text}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const answers = question.mcqQuestionCorrectAnswers || [];
  if (!answers.length) return null;

  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
        Correct Answer{answers.length > 1 ? 's' : ''}:
      </span>
      <div className="flex flex-wrap gap-1.5">
        {answers.map((a, i) => (
          <span key={i} className="text-[11px] px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg font-medium">
            {stripHtml(a)}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Main renderer dispatcher ──────────────────────────────────────────────────
// ─── Content Block Renderer ───────────────────────────────────────────────────
const CODE_BG_COLORS = [
  { value: '#1e1e1e', dark: true }, { value: '#f6f8fa', dark: false },
  { value: '#272822', dark: true }, { value: '#282a36', dark: true },
  { value: '#fdf6e3', dark: false }, { value: '#2e3440', dark: true },
];

function highlightCode(code: string, dark: boolean): string {
  const kw = ['function','return','if','else','for','while','let','const','var','class','import','export','default','new','this','typeof','true','false','null','undefined','async','await'];
  const kwC = dark ? '#569cd6' : '#0000cd';
  const strC = dark ? '#ce9178' : '#a31515';
  const cmtC = dark ? '#6a9955' : '#008000';
  const numC = dark ? '#b5cea8' : '#098658';
  return code
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/(\/\/.*$)/gm, `<span style="color:${cmtC}">$1</span>`)
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, `<span style="color:${strC}">$1</span>`)
    .replace(/\b(\d+\.?\d*)\b/g, `<span style="color:${numC}">$1</span>`)
    .replace(new RegExp(`\\b(${kw.join('|')})\\b`,'g'), `<span style="color:${kwC};font-weight:600">$1</span>`);
}

const ContentBlockRenderer: React.FC<{ content: any[] }> = ({ content }) => {
  return (
    <div className="space-y-2">
      {content.map((cb: any, i: number) => {
        if (cb.type === 'text') {
          if (!cb.value) return null;
          return (
            <div key={i}
              className="text-base font-semibold text-slate-900 leading-snug [&_strong]:font-bold [&_em]:italic [&_u]:underline"
              dangerouslySetInnerHTML={{ __html: cb.value }}
            />
          );
        }

        if (cb.type === 'code') {
          const bg = cb.bgColor || '#1e1e1e';
          const isDark = CODE_BG_COLORS.find(c => c.value === bg)?.dark ?? true;
          const textColor = isDark ? '#d4d4d4' : '#24292e';
          const headerBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
          return (
            <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '1.5px solid #e4e4ed' }}>
              {/* mac-style header */}
              <div style={{ background: headerBg, borderBottom: '1px solid rgba(128,128,128,0.2)', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                {['#ff5f57','#febc2e','#28c840'].map(c => (
                  <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
                ))}
                <span style={{ fontSize: 10, color: isDark ? '#888' : '#666', marginLeft: 4, fontFamily: 'monospace' }}>
                  {cb.language || 'code'}
                </span>
              </div>
              <pre
                style={{
                  margin: 0, padding: '12px 16px', fontSize: 13, lineHeight: 1.7,
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  color: textColor, background: bg,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all', overflowX: 'auto',
                }}
                dangerouslySetInnerHTML={{ __html: highlightCode(cb.value || '', isDark) }}
              />
            </div>
          );
        }

        if (cb.type === 'image' && cb.url) {
          const justify = cb.alignment === 'left' ? 'flex-start' : cb.alignment === 'right' ? 'flex-end' : 'center';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: justify }}>
              <img
                src={cb.url}
                alt=""
                style={{
                  width: `${cb.sizePercent || 60}%`,
                  height: 'auto',
                  borderRadius: 8,
                  border: '1.5px solid #e4e4ed',
                  display: 'block',
                }}
              />
            </div>
          );
        }

        return null;
      })}
    </div>
  );
};
const QuestionBody: React.FC<{ question: Question }> = ({ question }) => {
  if (question.questionType !== 'mcq') {
    return <ProgrammingRenderer question={question} />;
  }

  switch (question.mcqQuestionType) {
    case 'multiple_choice':
      return <MultipleChoiceRenderer question={question} />;
    case 'checkboxes':
    case 'multiple_select':
      return <MultipleChoiceRenderer question={question} multi />;
    case 'dropdown':
      return <DropdownRenderer question={question} />;
    case 'true_false':
      return <TrueFalseRenderer question={question} />;
    case 'short_answer':
      return <ShortAnswerRenderer question={question} />;
    case 'essay':
      return <ShortAnswerRenderer question={question} isEssay />;
    case 'numeric':
      return <NumericRenderer question={question} />;
    case 'matching':
      return <MatchingRenderer question={question} />;
    case 'ordering':
      return <OrderingRenderer question={question} />;
    default:
      return <MultipleChoiceRenderer question={question} />;
  }
};

// ─── Main Component ────────────────────────────────────────────────────────────

const QuestionPreview: React.FC<QuestionPreviewProps> = ({
  question,
  allQuestions = [],
  onClose,
  onNavigate,
}) => {
  const currentIndex = allQuestions.findIndex(q => q._id === question._id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allQuestions.length - 1;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && hasPrev && onNavigate) onNavigate(allQuestions[currentIndex - 1]);
    if (e.key === 'ArrowRight' && hasNext && onNavigate) onNavigate(allQuestions[currentIndex + 1]);
  }, [onClose, hasPrev, hasNext, onNavigate, allQuestions, currentIndex]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const title = getTitle(question);
  const diff = getDifficulty(question);
  const score = getScore(question);
  const desc = question.questionType === 'mcq' ? question.mcqQuestionDescription : '';
  const subType = question.questionType === 'mcq' ? question.mcqQuestionType : question.questionType;
  const isMcq = question.questionType === 'mcq';
  const timeLimit = isMcq ? question.mcqQuestionTimeLimit : question.timeLimit;

  const showAnswerKey = isMcq && !['short_answer', 'essay'].includes(question.mcqQuestionType || '');

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">

        {/* ── Header ── */}
        <div className="flex-none flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex-shrink-0 p-2 bg-blue-100 rounded-xl">
              <Eye size={15} className="text-blue-600" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preview</span>
                {allQuestions.length > 0 && (
                  <span className="text-[10px] text-slate-300">
                    {currentIndex + 1} / {allQuestions.length}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Interactive question preview</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Navigate buttons */}
            {allQuestions.length > 1 && (
              <>
                <button
                  onClick={() => hasPrev && onNavigate?.(allQuestions[currentIndex - 1])}
                  disabled={!hasPrev}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => hasNext && onNavigate?.(allQuestions[currentIndex + 1])}
                  disabled={!hasNext}
                  className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={14} />
                </button>
              </>
            )}
            <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">

            {/* Question meta */}
            <div className="flex flex-wrap items-center gap-2">
              <TypeLabel type={question.questionType} subType={subType} />
              <DiffBadge level={diff} />
              {score > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  <Star size={9} /> {score} pts
                </span>
              )}
              {timeLimit && timeLimit > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 bg-slate-50 text-slate-500 rounded-full border border-slate-200">
                  <Clock size={9} /> {timeLimit >= 1000 ? `${timeLimit / 1000}s` : `${timeLimit}ms`}
                </span>
              )}
            </div>

               <div>
              {question.questionType === 'mcq' && Array.isArray(question.mcqQuestionTitle) ? (
                <ContentBlockRenderer content={question.mcqQuestionTitle} />
              ) : (
                <h2 className="text-base font-semibold text-slate-900 leading-snug">
                  {title.includes('<') ? (
                    <span dangerouslySetInnerHTML={{ __html: title }} />
                  ) : title}
                </h2>
              )}
              {desc && (
                <p className="mt-2 text-[12px] text-slate-500 leading-relaxed border-l-2 border-slate-200 pl-3">
                  {stripHtml(desc)}
                </p>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100" />

            {/* Question interactive body — key forces full remount on question change */}
            <QuestionBody key={question._id} question={question} />

            {/* Answer Key (for MCQ types that have definitive answers) */}
            {showAnswerKey && (
              <details className="group">
                <summary className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer select-none list-none transition-colors">
                  <div className="w-4 h-4 rounded flex items-center justify-center bg-slate-100 group-open:bg-emerald-100 transition-colors">
                    <Check size={10} className="text-slate-400 group-open:text-emerald-600 transition-colors" />
                  </div>
                  <span className="group-open:text-emerald-600 transition-colors">View Answer Key</span>
                </summary>
                <div className="mt-3 p-3 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                  <AnswerKey question={question} />
                </div>
              </details>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex-none flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/60">
          <div className="text-[10px] text-slate-400">
            {allQuestions.length > 1 && (
              <span>Use <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px]">←</kbd> <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px]">→</kbd> to navigate · <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px]">Esc</kbd> to close</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 rounded-lg transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionPreview;