'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Flag, AlertCircle, Info, CheckCircle2, ChevronDown, ChevronUp,
  HelpCircle, Award, Grid3x3, ArrowLeft, ChevronRight, ChevronLeft,
  Timer, GraduationCap, GripVertical, Check, Hash, PenTool, XCircle
} from 'lucide-react';
import { Montserrat, Inter } from 'next/font/google';

// Configure Google Fonts
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-montserrat',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
});

// ── Design tokens (matches the student view) ─────────────────────────────
const T = {
  orange: '#F27757',
  orangeDark: '#E0623F',
  orangeGlow: 'rgba(242,119,87,0.22)',
  orangeLight: 'rgba(242,119,87,0.08)',
  orangeMid: 'rgba(242,119,87,0.15)',
  textMain: '#1a1a2e',
  textSub: '#6b6b7e',
  textMuted: '#9b9bae',
  textHint: '#bcbccc',
  border: '#eaeaef',
  borderLight: '#f4f4f7',
  bg: '#ffffff',
  pageBg: '#f9f9fb',
  green: '#22c55e',
  greenLight: 'rgba(34,197,94,0.09)',
  greenDark: '#16a34a',
  red: '#ef4444',
  redLight: 'rgba(239,68,68,0.09)',
  amber: '#f59e0b',
  amberLight: 'rgba(245,158,11,0.09)',
  blue: '#3b82f6',
  blueLight: 'rgba(59,130,246,0.09)',
  purple: '#8b5cf6',
  purpleLight: 'rgba(139,92,246,0.09)',
} as const;

const DIFFICULTY_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  easy: { text: T.greenDark, bg: T.greenLight, dot: T.green },
  medium: { text: '#b45309', bg: T.amberLight, dot: T.amber },
  hard: { text: '#dc2626', bg: T.redLight, dot: T.red },
};

const QTYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  multiple_choice: { label: 'Single Choice', color: T.blue, bg: T.blueLight },
  multiple_select: { label: 'Multi Select', color: T.purple, bg: T.purpleLight },
  true_false: { label: 'True / False', color: T.green, bg: T.greenLight },
  dropdown: { label: 'Dropdown', color: T.orange, bg: T.orangeLight },
  short_answer: { label: 'Short Answer', color: T.amber, bg: T.amberLight },
  essay: { label: 'Essay', color: T.textSub, bg: T.pageBg },
  numeric: { label: 'Numeric', color: T.green, bg: T.greenLight },
};

const HINT_TEXT: Record<string, string> = {
  multiple_choice: 'Choose one answer.',
  multiple_select: 'Select all that apply.',
  true_false: 'Choose True or False.',
  dropdown: 'Pick from the dropdown.',
  short_answer: 'Type a brief answer.',
  essay: 'Write a detailed answer.',
  numeric: 'Enter your numeric answer.',
};

interface MCQOption {
  _id: string;
  text: string;
  isCorrect: boolean;
  imageUrl: string | null;
  imageAlignment: string;
  imageSizePercent: number;
}

interface QuestionData {
  _id: string;
  questionType: string;
  mcqQuestionTitle: string;
  mcqQuestionDescription: string;
  mcqQuestionType: string;
  mcqQuestionDifficulty: string;
  mcqQuestionScore: number;
  mcqQuestionTimeLimit: number;
  isActive: boolean;
  mcqQuestionOptionsPerRow: number;
  mcqQuestionRequired: boolean;
  mcqQuestionOptions: MCQOption[];
  mcqQuestionCorrectAnswers: string[];
  hints: any[];
  testCases: any[];
  constraints: any[];
  trueFalseAnswer?: boolean | null;
  numericAnswer?: number | null;
  numericTolerance?: number | null;
}

interface AnswerData {
  questionId: string;
  optionId?: string;
  optionText?: string;
  textAnswer?: string;
  isCorrect?: boolean;
  booleanAnswer?: boolean;
  numericAnswer?: number;
}

interface MCQQuestionProps {
  question: QuestionData;
  selectedAnswer: AnswerData | null;
  onAnswerSelect: (answer: AnswerData) => void;
  questionNumber?: number;
  totalQuestions?: number;
  onFlagToggle?: (isFlagged: boolean) => void;
  isFlagged?: boolean;
  disabled?: boolean;
}

// ── Content Block Renderer (handles HTML title) ──────────────────────────
const ContentBlockRenderer: React.FC<{ title: unknown }> = ({ title }) => {
  if (typeof title === 'string') {
    return <div style={{ fontSize: 18, fontWeight: 700, color: T.textMain, lineHeight: 1.65, marginBottom: 8 }} dangerouslySetInnerHTML={{ __html: title }} />;
  }
  if (Array.isArray(title)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
        {(title as { type: string; value?: string; url?: string; bgColor?: string; alignment?: string; sizePercent?: number }[]).map((cb, i) => {
          if (cb.type === 'text' && cb.value) {
            return <div key={i} style={{ fontSize: 18, fontWeight: 700, color: T.textMain, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: cb.value }} />;
          }
          if (cb.type === 'image' && cb.url) {
            const justify = cb.alignment === 'left' ? 'flex-start' : cb.alignment === 'right' ? 'flex-end' : 'center';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: justify, margin: '8px 0' }}>
                <img src={cb.url} alt="" style={{ width: `${cb.sizePercent || 60}%`, height: 'auto', borderRadius: 12, border: `1px solid ${T.border}`, display: 'block' }} />
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }
  return null;
};

// ── Info Tooltip ─────────────────────────────────────────────────────────
const InfoTooltip: React.FC<{ content: string; side?: 'top' | 'right' | 'bottom' | 'left' }> = ({ content, side = 'top' }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className="relative inline-block ml-1 align-middle">
      <span
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors cursor-help"
        aria-label="Information"
      >
        <Info size={12} />
      </span>
      {showTooltip && (
        <div className={`absolute z-50 w-48 p-2 text-xs bg-gray-900 text-white rounded shadow-xl leading-relaxed transition-opacity duration-200 ${side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
          {content}
          <div className={`absolute ${side === 'top' ? 'top-full left-2 border-4 border-transparent border-t-gray-900' : 'bottom-full left-2 border-4 border-transparent border-b-gray-900'}`} />
        </div>
      )}
    </div>
  );
};

// ── Radio Option (with image support) ────────────────────────────────────
const RadioOption = ({ option, checked, onChange, index, disabled }: { option: MCQOption; checked: boolean; onChange: () => void; index: number; disabled?: boolean }) => {
  const lbl = String.fromCharCode(65 + index);
  const hasImage = option.imageUrl && option.imageUrl.trim() !== '';

  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '13px 16px',
        borderRadius: 12,
        cursor: disabled ? 'default' : 'pointer',
        border: `1.5px solid ${checked ? T.orange : T.border}`,
        background: checked ? T.orangeLight : T.bg,
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" disabled={disabled} />
      <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', marginTop: 1, border: `2px solid ${checked ? T.orange : T.border}`, background: checked ? T.orange : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
        {checked && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: checked ? T.orange : T.pageBg, color: checked ? '#fff' : T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, transition: 'all 0.15s' }}>{lbl}</span>
          <span style={{ fontSize: 14, color: checked ? T.textMain : T.textSub, fontWeight: checked ? 600 : 400 }}>{option.text}</span>
        </div>
        {hasImage && (
          <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
            <img src={option.imageUrl!} alt={`Option ${lbl}`} style={{ width: '100%', height: 96, objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          </div>
        )}
      </div>
    </label>
  );
};

// ── Checkbox Option ──────────────────────────────────────────────────────
const CheckboxOption = ({ option, checked, onChange, index, disabled }: { option: MCQOption; checked: boolean; onChange: () => void; index: number; disabled?: boolean }) => {
  const lbl = String.fromCharCode(65 + index);
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '13px 16px',
        borderRadius: 12,
        cursor: disabled ? 'default' : 'pointer',
        border: `1.5px solid ${checked ? T.purple : T.border}`,
        background: checked ? T.purpleLight : T.bg,
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" disabled={disabled} />
      <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, marginTop: 1, border: `2px solid ${checked ? T.purple : T.border}`, background: checked ? T.purple : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
        {checked && <Check size={11} color="#fff" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: checked ? T.purple : T.pageBg, color: checked ? '#fff' : T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, transition: 'all 0.15s' }}>{lbl}</span>
          <span style={{ fontSize: 14, color: checked ? T.textMain : T.textSub, fontWeight: checked ? 600 : 400 }}>{option.text}</span>
        </div>
      </div>
    </label>
  );
};

// ── True/False ───────────────────────────────────────────────────────────
const TrueFalse = ({ value, onChange, disabled }: { value: boolean | null; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    {[
      { v: true, label: 'True', icon: '✓' },
      { v: false, label: 'False', icon: '✕' },
    ].map(({ v, label, icon }) => {
      const isActive = value === v;
      const col = v ? T.green : T.red;
      const colLight = v ? T.greenLight : T.redLight;
      return (
        <button
          key={label}
          onClick={() => !disabled && onChange(v)}
          style={{
            flex: 1,
            padding: '14px 20px',
            borderRadius: 12,
            cursor: disabled ? 'default' : 'pointer',
            border: `1.5px solid ${isActive ? col : T.border}`,
            background: isActive ? colLight : T.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 600,
            color: isActive ? col : T.textSub,
            transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: isActive ? col : T.pageBg, color: isActive ? '#fff' : T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{icon}</span>
          {label}
        </button>
      );
    })}
  </div>
);

// ── Dropdown Select ──────────────────────────────────────────────────────
const DropdownSelect = ({ options, selectedValue, onChange, disabled }: { options: MCQOption[]; selectedValue: string | null; onChange: (id: string) => void; disabled?: boolean }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o._id === selectedValue);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', maxWidth: 480 }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        style={{
          width: '100%',
          padding: '13px 16px',
          borderRadius: 12,
          border: `1.5px solid ${open ? T.orange : T.border}`,
          background: T.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          fontSize: 14,
          color: selected ? T.textMain : T.textHint,
          fontWeight: selected ? 500 : 400,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s',
          boxShadow: open ? `0 0 0 3px ${T.orangeLight}` : 'none',
        }}
      >
        <span>{selected ? selected.text : 'Select an answer…'}</span>
        <ChevronDown size={16} style={{ color: T.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && !disabled && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: T.bg, borderRadius: 12, border: `1.5px solid ${T.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
          {options.map((opt, idx) => (
            <button
              key={opt._id}
              type="button"
              onClick={() => { onChange(opt._id); setOpen(false); }}
              style={{
                width: '100%',
                padding: '11px 16px',
                textAlign: 'left',
                background: selectedValue === opt._id ? T.orangeLight : 'transparent',
                border: 'none',
                borderBottom: `1px solid ${T.borderLight}`,
                fontSize: 14,
                color: T.textMain,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontFamily: 'inherit',
              }}
            >
              <span style={{ width: 20, height: 20, borderRadius: 5, flexShrink: 0, background: selectedValue === opt._id ? T.orange : T.pageBg, color: selectedValue === opt._id ? '#fff' : T.textMuted, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{String.fromCharCode(65 + idx)}</span>
              {opt.text}
              {selectedValue === opt._id && <Check size={14} style={{ marginLeft: 'auto', color: T.orange }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Short Answer Input ───────────────────────────────────────────────────
const ShortAnswerInput = ({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
  <div style={{ position: 'relative', maxWidth: 520 }}>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Type your answer here…"
      disabled={disabled}
      style={{
        width: '100%',
        padding: '13px 44px 13px 16px',
        borderRadius: 12,
        border: `1.5px solid ${T.border}`,
        background: disabled ? T.pageBg : T.bg,
        fontSize: 14,
        color: T.textMain,
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'all 0.15s',
        boxSizing: 'border-box' as const,
      }}
      onFocus={e => { e.target.style.borderColor = T.orange; e.target.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
      onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
    />
    <PenTool size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: T.textHint, pointerEvents: 'none' }} />
  </div>
);

// ── Essay Input ──────────────────────────────────────────────────────────
const EssayInput = ({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
  <div style={{ maxWidth: 640 }}>
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Write your detailed answer here…"
      disabled={disabled}
      rows={5}
      style={{
        width: '100%',
        padding: '13px 16px',
        borderRadius: 12,
        border: `1.5px solid ${T.border}`,
        background: disabled ? T.pageBg : T.bg,
        fontSize: 14,
        color: T.textMain,
        fontFamily: 'inherit',
        resize: 'vertical',
        outline: 'none',
        transition: 'all 0.15s',
        boxSizing: 'border-box' as const,
      }}
      onFocus={e => { e.target.style.borderColor = T.orange; e.target.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
      onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
    />
  </div>
);

// ── Numeric Input ────────────────────────────────────────────────────────
const NumericInput = ({ value, onChange, tolerance, disabled }: { value: number | null; onChange: (v: number) => void; tolerance?: number | null; disabled?: boolean }) => {
  const [raw, setRaw] = useState(value?.toString() || '');
  return (
    <div style={{ maxWidth: 280 }}>
      <div style={{ position: 'relative' }}>
        <input
          type="number"
          value={raw}
          step="any"
          disabled={disabled}
          placeholder="Enter a number…"
          onChange={e => { setRaw(e.target.value); if (e.target.value.trim() && !isNaN(Number(e.target.value))) onChange(Number(e.target.value)); }}
          style={{
            width: '100%',
            padding: '13px 44px 13px 16px',
            borderRadius: 12,
            border: `1.5px solid ${T.border}`,
            background: disabled ? T.pageBg : T.bg,
            fontSize: 14,
            color: T.textMain,
            fontFamily: 'inherit',
            outline: 'none',
            transition: 'all 0.15s',
            boxSizing: 'border-box' as const,
          }}
          onFocus={e => { e.target.style.borderColor = T.orange; e.target.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
          onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
        />
        <Hash size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: T.textHint }} />
      </div>
      {tolerance && tolerance > 0 && <p style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>Tolerance: ±{tolerance}</p>}
    </div>
  );
};

// ── Main MCQQuestion Component ───────────────────────────────────────────
const MCQQuestion: React.FC<MCQQuestionProps> = ({
  question,
  selectedAnswer,
  onAnswerSelect,
  questionNumber = 1,
  totalQuestions = 1,
  onFlagToggle,
  isFlagged = false,
  disabled = false,
}) => {
  const [flagged, setFlagged] = useState(isFlagged);
  const [selectedRadioOption, setSelectedRadioOption] = useState<string | null>(null);
  const [selectedCheckboxOptions, setSelectedCheckboxOptions] = useState<Set<string>>(new Set());
  const [selectedDropdownOption, setSelectedDropdownOption] = useState<string | null>(null);
  const [trueFalseValue, setTrueFalseValue] = useState<boolean | null>(null);
  const [shortAnswerText, setShortAnswerText] = useState('');
  const [essayText, setEssayText] = useState('');
  const [numericValue, setNumericValue] = useState<number | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Hydration safety
  useEffect(() => setIsClient(true), []);

  // Load answer into local state when question changes or selectedAnswer updates
  useEffect(() => {
    if (!selectedAnswer) {
      setSelectedRadioOption(null);
      setSelectedCheckboxOptions(new Set());
      setSelectedDropdownOption(null);
      setTrueFalseValue(null);
      setShortAnswerText('');
      setEssayText('');
      setNumericValue(null);
      return;
    }

    // Handle different answer types
    if (selectedAnswer.optionId && question.mcqQuestionType === 'multiple_choice') {
      setSelectedRadioOption(selectedAnswer.optionId);
    } else if (selectedAnswer.optionId && question.mcqQuestionType === 'multiple_select') {
      setSelectedCheckboxOptions(new Set([selectedAnswer.optionId]));
    } else if (selectedAnswer.optionId && question.mcqQuestionType === 'dropdown') {
      setSelectedDropdownOption(selectedAnswer.optionId);
    } else if (selectedAnswer.booleanAnswer !== undefined) {
      setTrueFalseValue(selectedAnswer.booleanAnswer);
    } else if (selectedAnswer.textAnswer !== undefined) {
      if (question.mcqQuestionType === 'short_answer') setShortAnswerText(selectedAnswer.textAnswer);
      if (question.mcqQuestionType === 'essay') setEssayText(selectedAnswer.textAnswer);
    } else if (selectedAnswer.numericAnswer !== undefined) {
      setNumericValue(selectedAnswer.numericAnswer);
    }
  }, [selectedAnswer, question]);

  const diff = DIFFICULTY_COLORS[question.mcqQuestionDifficulty] ?? { text: T.textSub, bg: T.pageBg, dot: T.textMuted };
  const qt = QTYPE_LABELS[question.mcqQuestionType] ?? { label: question.mcqQuestionType, color: T.textMuted, bg: T.pageBg };

  const handleFlagToggle = () => {
    if (disabled) return;
    const newFlaggedState = !flagged;
    setFlagged(newFlaggedState);
    onFlagToggle?.(newFlaggedState);
  };

  // ── Answer handlers ─────────────────────────────────────────────────────
  const handleRadioSelect = (optionId: string) => {
    if (disabled) return;
    const option = question.mcqQuestionOptions.find(opt => opt._id === optionId);
    if (!option) return;
    setSelectedRadioOption(optionId);
    onAnswerSelect({
      questionId: question._id,
      optionId: option._id,
      optionText: option.text,
      isCorrect: option.isCorrect,
    });
  };

  const handleCheckboxSelect = (optionId: string) => {
    if (disabled) return;
    const option = question.mcqQuestionOptions.find(opt => opt._id === optionId);
    if (!option) return;
    setSelectedCheckboxOptions(prev => {
      const next = new Set(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.add(optionId);
      }
      // For multiple select, we send the selected option
      onAnswerSelect({
        questionId: question._id,
        optionId: option._id,
        optionText: option.text,
        isCorrect: option.isCorrect,
      });
      return next;
    });
  };

  const handleDropdownSelect = (optionId: string) => {
    if (disabled) return;
    const option = question.mcqQuestionOptions.find(opt => opt._id === optionId);
    if (!option) return;
    setSelectedDropdownOption(optionId);
    onAnswerSelect({
      questionId: question._id,
      optionId: option._id,
      optionText: option.text,
      isCorrect: option.isCorrect,
    });
  };

  const handleTrueFalseChange = (value: boolean) => {
    if (disabled) return;
    setTrueFalseValue(value);
    onAnswerSelect({
      questionId: question._id,
      booleanAnswer: value,
      isCorrect: question.trueFalseAnswer === value,
    });
  };

  const handleShortAnswerChange = (value: string) => {
    if (disabled) return;
    setShortAnswerText(value);
    onAnswerSelect({
      questionId: question._id,
      textAnswer: value,
      isCorrect: false,
    });
  };

  const handleEssayChange = (value: string) => {
    if (disabled) return;
    setEssayText(value);
    onAnswerSelect({
      questionId: question._id,
      textAnswer: value,
      isCorrect: false,
    });
  };

  const handleNumericChange = (value: number) => {
    if (disabled) return;
    setNumericValue(value);
    const tolerance = question.numericTolerance || 0;
    const isCorrect = Math.abs(value - (question.numericAnswer || 0)) <= tolerance;
    onAnswerSelect({
      questionId: question._id,
      numericAnswer: value,
      isCorrect,
    });
  };

  // Get grid columns based on options per row
  const getGridCols = () => {
    const perRow = question.mcqQuestionOptionsPerRow || 2;
    if (perRow === 1) return 'repeat(1, 1fr)';
    if (perRow === 3) return 'repeat(3, 1fr)';
    if (perRow === 4) return 'repeat(4, 1fr)';
    return 'repeat(2, 1fr)';
  };

  // Check if answer is selected (for the footer)
  const hasAnswer = () => {
    if (!selectedAnswer) return false;
    if (selectedAnswer.optionId) return true;
    if (selectedAnswer.booleanAnswer !== undefined) return true;
    if (selectedAnswer.textAnswer?.trim()) return true;
    if (selectedAnswer.numericAnswer !== undefined) return true;
    return false;
  };

  // Get selected letter for display
  const getSelectedLetter = () => {
    if (!selectedAnswer?.optionId) return null;
    const idx = question.mcqQuestionOptions.findIndex(opt => opt._id === selectedAnswer.optionId);
    if (idx === -1) return null;
    return String.fromCharCode(65 + idx);
  };

  if (!isClient) {
    return <div style={{ minHeight: '100vh', background: T.pageBg }} />;
  }

  return (
    <div className={`w-full h-full flex flex-col ${montserrat.variable} ${inter.variable} font-sans`} style={{ background: T.pageBg, fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <style jsx global>{`
        .font-montserrat { font-family: var(--font-montserrat), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .font-inter { font-family: var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .mcq-fade { animation: fadeIn 0.2s ease; }
      `}</style>

      <div className="w-full h-full flex flex-col overflow-hidden">

        {/* ── Question Header (matches student view) ── */}
        <div style={{ flexShrink: 0, background: T.bg, borderBottom: `1px solid ${T.border}`, padding: '16px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Question number */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: 10, color: T.textHint, fontWeight: 700, letterSpacing: '0.05em' }}>Q</span>
                <span style={{ fontSize: 28, fontWeight: 900, color: T.orange, lineHeight: 1, letterSpacing: '-0.03em', margin: '0 2px' }}>{questionNumber}</span>
                <span style={{ fontSize: 12, color: T.textHint }}>/{totalQuestions}</span>
              </div>
              <div style={{ width: 1, height: 20, background: T.border }} />
              {/* Difficulty badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 99, background: diff.bg }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: diff.dot }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: diff.text, textTransform: 'capitalize' as const }}>{question.mcqQuestionDifficulty}</span>
              </div>
              {/* Question type badge */}
              <div style={{ padding: '4px 10px', borderRadius: 99, background: qt.bg }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: qt.color }}>{qt.label}</span>
              </div>
              {/* Score badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 99, background: T.amberLight }}>
                <Award size={10} style={{ color: T.amber }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: T.amber }}>{question.mcqQuestionScore} pts</span>
              </div>
              {/* Required badge */}
              {question.mcqQuestionRequired && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '4px 10px', borderRadius: 99, background: T.redLight }}>
                  <AlertCircle size={9} style={{ color: T.red }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.red }}>Required</span>
                </div>
              )}
            </div>
            {/* Flag button */}
            <button
              onClick={handleFlagToggle}
              disabled={disabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 99,
                border: `1.5px solid ${flagged ? T.amber : T.border}`,
                background: flagged ? T.amberLight : 'transparent',
                color: flagged ? T.amber : T.textMuted,
                fontSize: 12,
                fontWeight: 700,
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.13s',
              }}
            >
              <Flag size={12} fill={flagged ? T.amber : 'none'} />
              {flagged ? 'Flagged' : 'Flag for Review'}
              <InfoTooltip content="Flag this question to review later" side="top" />
            </button>
          </div>
        </div>

        {/* ── Scrollable Question Content ── */}
        <div className="mcq-fade" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px' }}>
          {/* Title */}
          <ContentBlockRenderer title={question.mcqQuestionTitle} />

          {/* Description (with info box) */}
          {question.mcqQuestionDescription && (
            <div style={{ display: 'flex', gap: 10, padding: '12px 16px', borderRadius: 10, background: T.blueLight, border: `1px solid ${T.blue}20`, marginBottom: 20 }}>
              <Info size={14} style={{ color: T.blue, flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 13, color: T.textSub, margin: 0, lineHeight: 1.6 }}>{question.mcqQuestionDescription}</p>
            </div>
          )}

          {/* Hint */}
          <p style={{ fontSize: 12, color: T.textHint, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 5 }}>
            <HelpCircle size={11} style={{ color: T.textHint }} />
            {HINT_TEXT[question.mcqQuestionType] ?? 'Answer the question.'}
          </p>

          {/* ── Answer Area ── */}
          {question.mcqQuestionType === 'true_false' && (
            <TrueFalse value={trueFalseValue} onChange={handleTrueFalseChange} disabled={disabled} />
          )}

          {question.mcqQuestionType === 'dropdown' && (
            <DropdownSelect options={question.mcqQuestionOptions} selectedValue={selectedDropdownOption} onChange={handleDropdownSelect} disabled={disabled} />
          )}

          {question.mcqQuestionType === 'short_answer' && (
            <ShortAnswerInput value={shortAnswerText} onChange={handleShortAnswerChange} disabled={disabled} />
          )}

          {question.mcqQuestionType === 'essay' && (
            <EssayInput value={essayText} onChange={handleEssayChange} disabled={disabled} />
          )}

          {question.mcqQuestionType === 'numeric' && (
            <NumericInput value={numericValue} onChange={handleNumericChange} tolerance={question.numericTolerance} disabled={disabled} />
          )}

          {(question.mcqQuestionType === 'multiple_choice' || question.mcqQuestionType === 'multiple_select') && (
            <div style={{ display: 'grid', gridTemplateColumns: getGridCols(), gap: 12 }}>
              {question.mcqQuestionOptions.map((option, idx) =>
                question.mcqQuestionType === 'multiple_select' ? (
                  <CheckboxOption
                    key={option._id}
                    option={option}
                    checked={selectedCheckboxOptions.has(option._id)}
                    onChange={() => handleCheckboxSelect(option._id)}
                    index={idx}
                    disabled={disabled}
                  />
                ) : (
                  <RadioOption
                    key={option._id}
                    option={option}
                    checked={selectedRadioOption === option._id}
                    onChange={() => handleRadioSelect(option._id)}
                    index={idx}
                    disabled={disabled}
                  />
                )
              )}
            </div>
          )}

          <div style={{ height: 24 }} />
        </div>

        {/* ── Footer: Selected Answer Status ── */}
        <div style={{ flexShrink: 0, padding: '14px 28px', background: T.bg, borderTop: `1px solid ${T.border}` }}>
          {hasAnswer() ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 size={18} style={{ color: T.green, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: T.textSub }}>
                Selected:{' '}
                <span style={{ fontWeight: 700, color: T.greenDark }}>
                  {selectedAnswer?.textAnswer ? (
                    `"${selectedAnswer.textAnswer.substring(0, 50)}${selectedAnswer.textAnswer.length > 50 ? '…' : ''}"`
                  ) : selectedAnswer?.booleanAnswer !== undefined ? (
                    selectedAnswer.booleanAnswer ? 'True' : 'False'
                  ) : selectedAnswer?.numericAnswer !== undefined ? (
                    selectedAnswer.numericAnswer
                  ) : getSelectedLetter() ? (
                    <span style={{ background: T.orangeLight, padding: '2px 8px', borderRadius: 20, color: T.orange }}>Option {getSelectedLetter()}</span>
                  ) : (
                    'Answer recorded'
                  )}
                </span>
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} style={{ color: T.textMuted }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: T.textMuted }}>Not answered yet</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MCQQuestion;