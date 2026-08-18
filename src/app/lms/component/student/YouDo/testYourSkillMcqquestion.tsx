'use client';
import { getToken } from "@/lib/session";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, CheckCircle, Flag, ArrowLeft,
  AlertCircle, ChevronDown, ChevronUp, GraduationCap,
  Check, Clock, Target, HelpCircle, Info,
  ArrowRight, GripVertical, Timer, BarChart, Award,
  Circle, PenTool, Hash, Grid3x3, Filter, X
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ── Design tokens ────────────────────────────────────────────────────────
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

const DIFF_CFG: Record<string, { text: string; bg: string; dot: string }> = {
  easy:   { text: T.greenDark, bg: T.greenLight, dot: T.green },
  medium: { text: '#b45309',   bg: T.amberLight, dot: T.amber },
  hard:   { text: '#dc2626',   bg: T.redLight,   dot: T.red   },
};

const QTYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  multiple_choice: { label: 'Single Choice', color: T.blue,    bg: T.blueLight   },
  multiple_select: { label: 'Multi Select',  color: T.purple,  bg: T.purpleLight },
  true_false:      { label: 'True / False',  color: T.green,   bg: T.greenLight  },
  dropdown:        { label: 'Dropdown',      color: T.orange,  bg: T.orangeLight },
  short_answer:    { label: 'Short Answer',  color: T.amber,   bg: T.amberLight  },
  essay:           { label: 'Essay',         color: T.textSub, bg: T.pageBg      },
  matching:        { label: 'Matching',      color: T.purple,  bg: T.purpleLight },
  ordering:        { label: 'Ordering',      color: T.blue,    bg: T.blueLight   },
  numeric:         { label: 'Numeric',       color: T.green,   bg: T.greenLight  },
};

const HINT_TEXT: Record<string, string> = {
  multiple_choice: 'Choose one answer.',
  multiple_select: 'Select all that apply.',
  true_false:      'Choose True or False.',
  dropdown:        'Pick from the dropdown.',
  short_answer:    'Type a brief answer.',
  essay:           'Write a detailed answer.',
  numeric:         'Enter your numeric answer.',
  matching:        'Drag left items onto right items to match.',
  ordering:        'Drag items to arrange in the correct order.',
};

const TOP_BAR_H    = 56;
const Q_META_H     = 52;
const BOTTOM_BAR_H = 64;

// ── Types ─────────────────────────────────────────────────────────────────
interface MCQOption {
  _id: string; text: string; isCorrect: boolean;
  imageUrl: string | null; imageAlignment: string; imageSizePercent: number;
}
interface MatchingPair  { left: string; right: string; _id: string; }
interface OrderingItem  { text: string; order: number; _id: string; }

interface MCQQuestion {
  _id: string; questionType: string; mcqQuestionTitle: any;
  mcqQuestionDescription: string; mcqQuestionType: string;
  mcqQuestionDifficulty: string; mcqQuestionScore: number;
  mcqQuestionTimeLimit: number; isActive: boolean;
  mcqQuestionOptionsPerRow: number; mcqQuestionRequired: boolean;
  mcqQuestionOptions: MCQOption[]; mcqQuestionCorrectAnswers: string[];
  hints: any[]; testCases: any[]; constraints: any[];
  trueFalseAnswer?: boolean | null; numericAnswer?: number | null;
  numericTolerance?: number | null; matchingPairs?: MatchingPair[];
  orderingItems?: OrderingItem[]; shortAnswer?: string;
  title?: string;
  explanation?: string;
}

interface Answer {
  questionId: string; optionId?: string; optionText?: string;
  textAnswer?: string; isCorrect?: boolean; score?: number; status?: string;
  matchingAnswers?: { left: string; right: string; }[];
  orderingAnswers?: { itemId: string; order: number; }[];
  numericAnswer?: number; booleanAnswer?: boolean;
}

interface YouDoConfig {
  timeLimit?: number;
  passingScore?: number;
  attemptLimit?: number;
  shuffleQuestions?: boolean;
  showResults?: boolean;
  pointsPerQuestion?: number;
  totalPoints?: number;
}

interface YouDoMCQProps {
  courseId: string;
  nodeId: string;
  nodeName?: string;
  nodeType?: string;
  courseName?: string;
  activity?: string;
  category?: string;
  subcategory?: string;
  onCloseExercise?: () => void;
  inlineQuestions?: MCQQuestion[];
  inlineConfig?: YouDoConfig;
}

// ── Filter types ──────────────────────────────────────────────────────────
type DifficultyFilter = 'all' | 'easy' | 'medium' | 'hard';
type StatusFilter = 'all' | 'done' | 'flagged' | 'ans_flag';

// ── Shuffle function ──────────────────────────────────────────────────────
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// ── Back Confirmation Modal ──────────────────────────────────────────────
const BackConfirmationModal = ({ onConfirm, onCancel, unansweredCount }: { onConfirm: () => void; onCancel: () => void; unansweredCount: number }) => {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
      <div style={{ background: T.bg, borderRadius: 20, maxWidth: 420, width: '100%', padding: '28px 24px', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: `1px solid ${T.border}` }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: T.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertCircle size={28} style={{ color: T.orange }} />
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 800, color: T.textMain, marginBottom: 8 }}>Exit Test?</h3>
        <p style={{ fontSize: 14, color: T.textSub, marginBottom: 16, lineHeight: 1.6 }}>
          You have <strong style={{ color: T.orange }}>{unansweredCount}</strong> unanswered question{unansweredCount !== 1 ? 's' : ''}.
          <br />
          Your progress will be lost.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button 
            onClick={onCancel} 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              borderRadius: 12, 
              border: `1.5px solid ${T.border}`, 
              background: T.bg, 
              color: T.textSub, 
              fontSize: 14, 
              fontWeight: 600, 
              cursor: 'pointer', 
              fontFamily: 'inherit',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.pageBg; e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = T.bg; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub; }}
          >
            Continue Test
          </button>
          <button 
            onClick={onConfirm} 
            style={{ 
              flex: 1, 
              padding: '12px 16px', 
              borderRadius: 12, 
              border: 'none', 
              background: T.orange, 
              color: '#fff', 
              fontSize: 14, 
              fontWeight: 700, 
              cursor: 'pointer', 
              fontFamily: 'inherit',
              transition: 'all 0.2s',
              boxShadow: `0 4px 12px ${T.orangeGlow}`
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = T.orangeDark; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = T.orange; }}
          >
            Exit Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Content Block Renderer ────────────────────────────────────────────────
const ContentBlockRenderer: React.FC<{ title: unknown }> = ({ title }) => {
  if (Array.isArray(title)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 }}>
        {(title as { type: string; value?: string; url?: string; bgColor?: string; alignment?: string; sizePercent?: number }[]).map((cb, i) => {
          if (cb.type === 'text') {
            if (!cb.value) return null;
            return <div key={i} style={{ fontSize: 16, fontWeight: 700, color: T.textMain, lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: cb.value }} />;
          }
          if (cb.type === 'code') {
            const bg = cb.bgColor || '#f5f5f5';
            const isDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(bg);
            return (
              <div key={i} style={{ display: 'inline-block', maxWidth: '100%', margin: '4px 0' }}>
                <pre style={{ margin: 0, padding: '10px 16px', fontSize: 13, lineHeight: 1.7, fontFamily: 'Menlo,Monaco,"Courier New",monospace', color: isDark ? '#d4d4d4' : '#1a1a2e', background: bg, borderRadius: 8, border: `1.5px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`, whiteSpace: 'pre', display: 'inline-block', width: '400px', maxWidth: '800px', overflowX: 'auto', boxSizing: 'border-box' as const }}>{cb.value || ''}</pre>
              </div>
            );
          }
          if (cb.type === 'image' && cb.url) {
            const justify = cb.alignment === 'left' ? 'flex-start' : cb.alignment === 'right' ? 'flex-end' : 'center';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: justify }}>
                <img src={cb.url} alt="" style={{ width: `${cb.sizePercent || 60}%`, height: 'auto', borderRadius: 8, border: `1px solid ${T.border}`, display: 'block' }} />
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  }
  return <div style={{ fontSize: 16, fontWeight: 700, color: T.textMain, lineHeight: 1.65, marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: typeof title === 'string' ? title : '' }} />;
};

// ── HTML Content Renderer for Description ─────────────────────────────────
const HtmlContent: React.FC<{ content: string }> = ({ content }) => {
  if (!content) return null;
  return (
    <div 
      className="html-description"
      dangerouslySetInnerHTML={{ __html: content }}
      style={{ 
        fontSize: 13, 
        color: T.textSub, 
        lineHeight: 1.6,
        margin: 0
      }}
    />
  );
};

const DescriptionRenderer: React.FC<{ description: string }> = ({ description }) => {
  if (!description) return null;
  
  // Check if description contains HTML tags
  const hasHtml = /<[a-z][\s\S]*>/i.test(description);
  
  return (
    <div style={{ 
      display: 'flex', 
      gap: 10, 
      padding: '10px 14px', 
      borderRadius: 10, 
      background: T.blueLight, 
      border: `1px solid ${T.blue}20`, 
      marginBottom: 14 
    }}>
      <Info size={13} style={{ color: T.blue, flexShrink: 0, marginTop: 2 }} />
      {hasHtml ? (
        <HtmlContent content={description} />
      ) : (
        <p style={{ fontSize: 13, color: T.textSub, margin: 0, lineHeight: 1.6 }}>{description}</p>
      )}
    </div>
  );
};

// ── Option atoms ──────────────────────────────────────────────────────────
const RadioOption = ({ option, checked, onChange, index, disabled }: { option: MCQOption; checked: boolean; onChange: () => void; index: number; disabled?: boolean }) => {
  const lbl = String.fromCharCode(65 + index);
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderRadius: 12, cursor: disabled ? 'default' : 'pointer', border: `1.5px solid ${checked ? T.orange : T.border}`, background: checked ? T.orangeLight : T.bg, transition: 'all 0.15s', userSelect: 'none' }}>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" disabled={disabled} />
      <div style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', marginTop: 1, border: `2px solid ${checked ? T.orange : T.border}`, background: checked ? T.orange : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
        {checked && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 6, background: checked ? T.orange : T.pageBg, color: checked ? '#fff' : T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, transition: 'all 0.15s' }}>{lbl}</span>
          <span style={{ fontSize: 14, color: checked ? T.textMain : T.textSub, fontWeight: checked ? 600 : 400 }}>{option.text}</span>
        </div>
        {option.imageUrl?.trim() && (
          <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', border: `1px solid ${T.border}` }}>
            <img src={option.imageUrl} alt={`Option ${lbl}`} style={{ width: '100%', height: 96, objectFit: 'cover' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
          </div>
        )}
      </div>
    </label>
  );
};

const CheckboxOption = ({ option, checked, onChange, index, disabled }: { option: MCQOption; checked: boolean; onChange: () => void; index: number; disabled?: boolean }) => {
  const lbl = String.fromCharCode(65 + index);
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderRadius: 12, cursor: disabled ? 'default' : 'pointer', border: `1.5px solid ${checked ? T.purple : T.border}`, background: checked ? T.purpleLight : T.bg, transition: 'all 0.15s', userSelect: 'none' }}>
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

const TrueFalse = ({ value, onChange, disabled }: { value: boolean | null; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <div style={{ display: 'flex', gap: 12 }}>
    {[{ v: true, label: 'True', icon: '✓' }, { v: false, label: 'False', icon: '✕' }].map(({ v, label, icon }) => {
      const isActive = value === v; const col = v ? T.green : T.red; const colLight = v ? T.greenLight : T.redLight;
      return (
        <button key={label} onClick={() => !disabled && onChange(v)}
          style={{ flex: 1, padding: '14px 20px', borderRadius: 12, cursor: disabled ? 'default' : 'pointer', border: `1.5px solid ${isActive ? col : T.border}`, background: isActive ? colLight : T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: isActive ? col : T.textSub, transition: 'all 0.15s', fontFamily: 'inherit' }}>
          <span style={{ width: 26, height: 26, borderRadius: '50%', background: isActive ? col : T.pageBg, color: isActive ? '#fff' : T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, transition: 'all 0.15s' }}>{icon}</span>
          {label}
        </button>
      );
    })}
  </div>
);

const DropdownSelect = ({ options, selectedValue, onChange, disabled }: { options: MCQOption[]; selectedValue: string | null; onChange: (id: string) => void; disabled?: boolean }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find(o => o._id === selectedValue);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);
  return (
    <div ref={ref} style={{ position: 'relative', maxWidth: 480 }}>
      <button type="button" onClick={() => !disabled && setOpen(!open)}
        style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: `1.5px solid ${open ? T.orange : T.border}`, background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 14, color: selected ? T.textMain : T.textHint, fontWeight: selected ? 500 : 400, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', boxShadow: open ? `0 0 0 3px ${T.orangeLight}` : 'none' }}>
        <span>{selected ? selected.text : 'Select an answer…'}</span>
        <ChevronDown size={16} style={{ color: T.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && !disabled && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: T.bg, borderRadius: 12, border: `1.5px solid ${T.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: 260, overflowY: 'auto' }}>
          {options.map((opt, idx) => (
            <button key={opt._id} type="button" onClick={() => { onChange(opt._id); setOpen(false); }}
              style={{ width: '100%', padding: '11px 16px', textAlign: 'left', background: selectedValue === opt._id ? T.orangeLight : 'transparent', border: 'none', borderBottom: `1px solid ${T.borderLight}`, fontSize: 14, color: T.textMain, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}>
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

const ShortAnswerInput = ({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
  <div style={{ position: 'relative', maxWidth: 520 }}>
    <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder="Type your answer here…" disabled={disabled}
      style={{ width: '100%', padding: '13px 44px 13px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: disabled ? T.pageBg : T.bg, fontSize: 14, color: T.textMain, fontFamily: 'inherit', outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' as const }}
      onFocus={e => { e.target.style.borderColor = T.orange; e.target.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
      onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }} />
    <PenTool size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: T.textHint, pointerEvents: 'none' }} />
  </div>
);

const EssayInput = ({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) => (
  <div style={{ position: 'relative', maxWidth: 640 }}>
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Write your detailed answer here…" disabled={disabled} rows={5}
      style={{ width: '100%', padding: '13px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: disabled ? T.pageBg : T.bg, fontSize: 14, color: T.textMain, fontFamily: 'inherit', resize: 'vertical', outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' as const }}
      onFocus={e => { e.target.style.borderColor = T.orange; e.target.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
      onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }} />
  </div>
);

const NumericInput = ({ value, onChange, tolerance, disabled }: { value: number | null; onChange: (v: number) => void; tolerance?: number | null; disabled?: boolean }) => {
  const [raw, setRaw] = useState(value?.toString() || '');
  return (
    <div style={{ maxWidth: 280 }}>
      <div style={{ position: 'relative' }}>
        <input type="number" value={raw} step="any" disabled={disabled} placeholder="Enter a number…"
          onChange={e => { setRaw(e.target.value); if (e.target.value.trim() && !isNaN(Number(e.target.value))) onChange(Number(e.target.value)); }}
          style={{ width: '100%', padding: '13px 44px 13px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: disabled ? T.pageBg : T.bg, fontSize: 14, color: T.textMain, fontFamily: 'inherit', outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' as const }}
          onFocus={e => { e.target.style.borderColor = T.orange; e.target.style.boxShadow = `0 0 0 3px ${T.orangeLight}`; }}
          onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }} />
        <Hash size={15} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: T.textHint }} />
      </div>
      {tolerance && tolerance > 0 && <p style={{ fontSize: 11, color: T.textMuted, marginTop: 5 }}>Tolerance: ±{tolerance}</p>}
    </div>
  );
};

const MatchingWidget = ({ pairs, answers, onChange, disabled }: { pairs: MatchingPair[]; answers: { left: string; right: string; }[]; onChange: (a: { left: string; right: string; }[]) => void; disabled?: boolean }) => {
  const [rights, setRights] = useState<string[]>([]);
  const [matches, setMatches] = useState<Map<string, string>>(new Map());
  const [dragged, setDragged] = useState<string | null>(null);
  
  useEffect(() => { 
    const shuffledRights = [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5);
    setRights(shuffledRights); 
    const m = new Map<string, string>(); 
    answers.forEach(a => m.set(a.left, a.right)); 
    setMatches(m); 
  }, [pairs, answers]);
  
  const doMatch = (left: string, right: string) => { 
    if (disabled) return; 
    const m = new Map(matches); 
    m.forEach((v, k) => { 
      if (v === right) m.delete(k); 
    }); 
    m.set(left, right); 
    setMatches(m); 
    onChange(Array.from(m.entries()).map(([l, r]) => ({ left: l, right: r }))); 
  };
  
  const removeMatch = (left: string) => {
    if (disabled) return;
    const m = new Map(matches);
    m.delete(left);
    setMatches(m);
    onChange(Array.from(m.entries()).map(([l, r]) => ({ left: l, right: r })));
  };
  
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Items</p>
        {pairs.map((p) => { 
          const matched = matches.has(p.left); 
          return (
            <div 
              key={p._id || p.left} 
              draggable={!disabled && !matched} 
              onDragStart={() => setDragged(p.left)} 
              onDragEnd={() => setDragged(null)}
              style={{ 
                padding: '10px 14px', 
                marginBottom: 6, 
                borderRadius: 10, 
                border: `1.5px solid ${matched ? T.green : T.border}`, 
                background: matched ? T.greenLight : T.bg, 
                cursor: disabled ? 'default' : (matched ? 'pointer' : 'grab'), 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                fontSize: 13, 
                color: T.textMain, 
                opacity: dragged === p.left ? 0.45 : 1,
                transition: 'all 0.2s'
              }}
              onClick={() => matched && removeMatch(p.left)}
            >
              <GripVertical size={13} style={{ color: T.textHint, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{p.left}</span>
              {matched && (
                <span style={{ fontSize: 10, color: T.greenDark, fontWeight: 600 }}>
                  ✓ matched
                </span>
              )}
            </div>
          ); 
        })}
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Match to</p>
        {rights.map((r, idx) => { 
          const matchedLeft = Array.from(matches.entries()).find(([, v]) => v === r)?.[0]; 
          return (
            <div 
              key={idx} 
              onDragOver={e => e.preventDefault()} 
              onDrop={() => { 
                if (dragged && !disabled && !matches.has(dragged)) {
                  doMatch(dragged, r);
                }
              }}
              style={{ 
                padding: '10px 14px', 
                marginBottom: 6, 
                borderRadius: 10, 
                border: `1.5px solid ${matchedLeft ? T.green : T.border}`, 
                background: matchedLeft ? T.greenLight : T.pageBg, 
                cursor: disabled ? 'default' : 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                gap: 8, 
                fontSize: 13, 
                color: T.textMain,
                transition: 'all 0.2s'
              }}
              onClick={() => { 
                if (disabled) return; 
                const freeLeft = pairs.map(p => p.left).find(l => !matches.has(l)); 
                if (freeLeft && !matches.has(freeLeft)) {
                  doMatch(freeLeft, r);
                }
              }}
            >
              <span>{r}</span>
              {matchedLeft && (
                <span style={{ fontSize: 11, color: T.greenDark, fontWeight: 600 }}>
                  ← {matchedLeft}
                </span>
              )}
            </div>
          ); 
        })}
      </div>
      {!disabled && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, marginTop: 8 }}>
          <button 
            onClick={() => { 
              setMatches(new Map()); 
              onChange([]); 
            }} 
            style={{ 
              border: 'none', 
              background: 'none', 
              color: T.orange, 
              fontSize: 12, 
              cursor: 'pointer', 
              fontFamily: 'inherit', 
              padding: '4px 0',
              textDecoration: 'underline'
            }}>
            ↺ Clear all matches
          </button>
        </div>
      )}
    </div>
  );
};

const OrderingWidget = ({ items, answers, onChange, disabled }: { items: OrderingItem[]; answers: { itemId: string; order: number; }[]; onChange: (a: { itemId: string; order: number; }[]) => void; disabled?: boolean }) => {
  const [ordered, setOrdered] = useState<OrderingItem[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  
  useEffect(() => { 
    if (answers.length > 0) { 
      const sorted = [...items].sort((a, b) => { 
        const aa = answers.find(x => x.itemId === a._id); 
        const bb = answers.find(x => x.itemId === b._id); 
        return (aa?.order || 0) - (bb?.order || 0); 
      }); 
      setOrdered(sorted); 
    } else { 
      setOrdered([...items].sort((a, b) => a.order - b.order)); 
    } 
  }, [items, answers]);
  
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    if (disabled) return;
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e: React.DragEvent, idx: number) => { 
    e.preventDefault(); 
    if (dragIdx === null || disabled) return; 
    if (dragIdx === idx) return;
    
    const arr = [...ordered]; 
    const [item] = arr.splice(dragIdx, 1); 
    arr.splice(idx, 0, item); 
    setOrdered(arr); 
    setDragIdx(idx); 
  };
  
  const handleDragEnd = () => { 
    if (disabled) return;
    setDragIdx(null); 
    const newOrder = ordered.map((it, idx) => ({ 
      itemId: it._id, 
      order: idx + 1 
    })); 
    onChange(newOrder); 
  };
  
  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 8, fontSize: 12, color: T.textMuted }}>
        Drag and drop items to arrange in the correct order
      </div>
      {ordered.map((item, i) => (
        <div 
          key={item._id} 
          draggable={!disabled} 
          onDragStart={(e) => handleDragStart(e, i)}
          onDragOver={(e) => handleDragOver(e, i)}
          onDragEnd={handleDragEnd}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '11px 14px', 
            marginBottom: 6, 
            borderRadius: 10, 
            border: `1.5px solid ${dragIdx === i ? T.orange : T.border}`, 
            background: dragIdx === i ? T.orangeLight : T.bg, 
            cursor: disabled ? 'default' : 'grab', 
            opacity: dragIdx === i ? 0.7 : 1, 
            fontSize: 13, 
            color: T.textMain,
            transition: 'all 0.2s'
          }}>
          <GripVertical size={15} style={{ color: T.textHint, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{item.text}</span>
          <span style={{ 
            width: 24, 
            height: 24, 
            borderRadius: 6, 
            flexShrink: 0, 
            background: T.orangeLight, 
            color: T.orange, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: 11, 
            fontWeight: 700 
          }}>
            #{i + 1}
          </span>
        </div>
      ))}
      {!disabled && ordered.length > 0 && (
        <button 
          onClick={() => { 
            const defaultOrder = [...items].sort((a, b) => a.order - b.order);
            setOrdered(defaultOrder);
            onChange(defaultOrder.map((it, idx) => ({ itemId: it._id, order: idx + 1 })));
          }} 
          style={{ 
            marginTop: 8,
            border: 'none', 
            background: 'none', 
            color: T.orange, 
            fontSize: 12, 
            cursor: 'pointer', 
            textAlign: 'left', 
            fontFamily: 'inherit', 
            padding: '4px 0',
            textDecoration: 'underline'
          }}>
          ↺ Reset to original order
        </button>
      )}
    </div>
  );
};

// ── Result screen ─────────────────────────────────────────────────────────
const YouDoResultScreen = ({
  questions, answers, config, onClose, onRetry
}: {
  questions: MCQQuestion[];
  answers: Map<string, Answer>;
  config: YouDoConfig;
  onClose: () => void;
  onRetry: () => void;
}) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Helper function to get selected options for a multiple select question
  const getSelectedOptionsForQuestion = (questionId: string): string[] => {
    const selected: string[] = [];
    answers.forEach((value, key) => {
      if (value?.questionId === questionId && value.optionId) {
        selected.push(value.optionId);
      }
    });
    return selected;
  };

  // Calculate score properly for all question types
  let score = 0; 
  let maxScore = 0;
  
  questions.forEach(q => {
    const pts = q.mcqQuestionScore || config.pointsPerQuestion || 1;
    maxScore += pts;
    
    if (q.mcqQuestionType === 'multiple_select') {
      const selectedOptions = getSelectedOptionsForQuestion(q._id);
      const correctOptions = q.mcqQuestionOptions
        .filter(opt => opt.isCorrect)
        .map(opt => opt._id);
      
      const isFullyCorrect = correctOptions.length === selectedOptions.length && 
        correctOptions.every(id => selectedOptions.includes(id));
      
      if (isFullyCorrect) {
        score += pts;
      }
    } else {
      const ans = answers.get(q._id);
      if (ans?.isCorrect === true) {
        score += pts;
      }
    }
  });

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const passed = pct >= (config.passingScore || 70);

  const getUserAnswerText = (q: MCQQuestion): string => {
    if (q.mcqQuestionType === 'multiple_select') {
      const selectedOptions: string[] = [];
      answers.forEach((value, key) => {
        if (value?.questionId === q._id && value.optionId) {
          const opt = q.mcqQuestionOptions?.find(o => o._id === value.optionId);
          if (opt) selectedOptions.push(opt.text);
        }
      });
      return selectedOptions.length > 0 ? selectedOptions.join(', ') : 'Not answered';
    }
    
    const ans = answers.get(q._id);
    if (!ans) return 'Not answered';
    
    switch (q.mcqQuestionType) {
      case 'multiple_choice':
      case 'dropdown': {
        const option = q.mcqQuestionOptions?.find(opt => opt._id === ans.optionId);
        return option ? option.text : 'Not answered';
      }
      case 'true_false':
        return ans.booleanAnswer ? 'True' : 'False';
      case 'short_answer':
      case 'essay':
        return ans.textAnswer || 'Not answered';
      case 'numeric':
        return ans.numericAnswer?.toString() || 'Not answered';
      case 'matching': {
        if (!ans.matchingAnswers?.length) return 'Not answered';
        return ans.matchingAnswers.map(m => `${m.left} → ${m.right}`).join(', ');
      }
      case 'ordering': {
        if (!ans.orderingAnswers?.length) return 'Not answered';
        const orderedItems = ans.orderingAnswers
          .sort((a, b) => a.order - b.order)
          .map(o => {
            const item = q.orderingItems?.find(i => i._id === o.itemId);
            return item?.text || o.itemId;
          });
        return orderedItems.join(' → ');
      }
      default:
        return 'Answered';
    }
  };

  const getCorrectAnswerText = (q: MCQQuestion): string => {
    switch (q.mcqQuestionType) {
      case 'multiple_choice':
      case 'dropdown': {
        const correctOptions = q.mcqQuestionOptions?.filter(opt => opt.isCorrect);
        return correctOptions?.map(opt => opt.text).join(', ') || 'Not specified';
      }
      case 'multiple_select': {
        const correctOptions = q.mcqQuestionOptions?.filter(opt => opt.isCorrect);
        return correctOptions?.map(opt => opt.text).join(', ') || 'Not specified';
      }
      case 'true_false':
        return q.trueFalseAnswer ? 'True' : 'False';
      case 'short_answer':
        return q.shortAnswer || q.mcqQuestionCorrectAnswers?.[0] || 'Not specified';
      case 'essay':
        return 'Manual grading required';
      case 'numeric':
        return q.numericAnswer?.toString() || 'Not specified';
      case 'matching': {
        if (!q.matchingPairs?.length) return 'Not specified';
        return q.matchingPairs.map(p => `${p.left} → ${p.right}`).join(', ');
      }
      case 'ordering': {
        if (!q.orderingItems?.length) return 'Not specified';
        const orderedItems = [...q.orderingItems].sort((a, b) => a.order - b.order);
        return orderedItems.map(item => item.text).join(' → ');
      }
      default:
        return 'Not specified';
    }
  };

  const isAnswerCorrect = (q: MCQQuestion): boolean => {
    if (q.mcqQuestionType === 'multiple_select') {
      const selectedOptions = getSelectedOptionsForQuestion(q._id);
      const correctOptions = q.mcqQuestionOptions
        .filter(opt => opt.isCorrect)
        .map(opt => opt._id);
      
      return correctOptions.length === selectedOptions.length && 
        correctOptions.every(id => selectedOptions.includes(id));
    }
    
    const ans = answers.get(q._id);
    if (!ans) return false;
    return ans.isCorrect === true;
  };

  const getQuestionResult = (q: MCQQuestion): 'correct' | 'incorrect' | 'unanswered' => {
    if (q.mcqQuestionType === 'multiple_select') {
      const selectedCount = getSelectedOptionsForQuestion(q._id).length;
      if (selectedCount === 0) return 'unanswered';
    } else {
      const ans = answers.get(q._id);
      if (!ans) return 'unanswered';
    }
    
    if (isAnswerCorrect(q)) return 'correct';
    return 'incorrect';
  };

  const handleDone = () => {
    if (onClose) onClose();
  };

  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      background: T.pageBg, 
      fontFamily: "'Poppins',-apple-system,BlinkMacSystemFont,sans-serif", 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      zIndex: 1000
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap'); *{box-sizing:border-box;} .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;}`}</style>
      
      <div style={{ 
        flexShrink: 0, 
        height: TOP_BAR_H, 
        background: T.bg, 
        borderBottom: `1px solid ${T.border}`, 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 24px', 
        gap: 16,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${T.orange},${T.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={13} color="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800, color: T.textMain }}>You Do — Results</span>
        </div>
      </div>

      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '32px 24px',
        position: 'relative'
      }}>
        <div style={{ 
          maxWidth: 480, 
          margin: '0 auto 32px', 
          background: T.bg, 
          borderRadius: 20, 
          border: `1.5px solid ${T.border}`, 
          padding: '32px 28px', 
          textAlign: 'center', 
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)' 
        }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px', background: passed ? T.greenLight : T.redLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {passed ? <CheckCircle size={32} style={{ color: T.green }} /> : <AlertCircle size={32} style={{ color: T.red }} />}
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: T.textMain, margin: '0 0 8px' }}>{pct}%</h2>
          <p style={{ fontSize: 14, color: passed ? T.greenDark : T.red, fontWeight: 700, margin: '0 0 20px' }}>
            {passed ? '🎉 Passed!' : 'Keep practicing!'}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Score', val: `${score}/${maxScore}`, col: T.orange },
              { label: 'Correct', val: `${questions.filter(q => getQuestionResult(q) === 'correct').length}`, col: T.green },
              { label: 'Incorrect', val: `${questions.filter(q => getQuestionResult(q) === 'incorrect').length}`, col: T.red },
            ].map(({ label, val, col }) => (
              <div key={label} style={{ padding: '12px', background: T.pageBg, borderRadius: 12, border: `1px solid ${T.borderLight}` }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: col, margin: '0 0 3px' }}>{val}</p>
                <p style={{ fontSize: 11, color: T.textMuted, margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button 
              onClick={onRetry} 
              style={{ 
                flex: 1, 
                padding: '12px', 
                borderRadius: 12, 
                border: `1.5px solid ${T.border}`, 
                background: 'transparent', 
                color: T.textSub, 
                fontSize: 14, 
                fontWeight: 600, 
                cursor: 'pointer', 
                fontFamily: 'inherit',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.pageBg; e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.color = T.orange; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textSub; }}
            >
              Retry
            </button>
            <button 
              onClick={handleDone} 
              style={{ 
                flex: 1, 
                padding: '12px', 
                borderRadius: 12, 
                border: 'none', 
                background: T.orange, 
                color: '#fff', 
                fontSize: 14, 
                fontWeight: 700, 
                cursor: 'pointer', 
                fontFamily: 'inherit', 
                boxShadow: `0 3px 12px ${T.orangeGlow}`,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.orangeDark; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = T.orange; }}
            >
              Done
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: T.textMain, margin: '0 0 16px' }}>Question Review</h3>
          {questions.map((q, idx) => {
            const result = getQuestionResult(q);
            const isExpanded = expandedIdx === idx;
            const resultCol = result === 'correct' ? T.green : result === 'incorrect' ? T.red : T.textMuted;
            const resultBg = result === 'correct' ? T.greenLight : result === 'incorrect' ? T.redLight : T.pageBg;
            const resultIcon = result === 'correct' ? '✓' : result === 'incorrect' ? '✕' : '—';
            const title = q.mcqQuestionTitle || (q as any).title;
            const userAnswer = getUserAnswerText(q);
            const correctAnswer = getCorrectAnswerText(q);
            const isEssayType = q.mcqQuestionType === 'essay';
            
            return (
              <div 
                key={q._id} 
                style={{ 
                  marginBottom: 10, 
                  background: T.bg, 
                  borderRadius: 14, 
                  border: `1.5px solid ${result === 'correct' ? T.green + '40' : result === 'incorrect' ? T.red + '40' : T.border}`, 
                  overflow: 'hidden',
                  transition: 'all 0.2s'
                }}
              >
                <button 
                  onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  style={{ 
                    width: '100%', 
                    padding: '14px 18px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    background: 'transparent', 
                    border: 'none', 
                    cursor: 'pointer', 
                    fontFamily: 'inherit', 
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = T.pageBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: resultBg, color: resultCol, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, border: `1px solid ${resultCol}40` }}>{resultIcon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Q{idx + 1}: {Array.isArray(title) ? (title[0] as any)?.value || 'Question' : (typeof title === 'string' ? title : 'Question')}
                  </span>
                  <span style={{ fontSize: 11, color: resultCol, fontWeight: 700, flexShrink: 0 }}>
                    {result === 'correct' ? `+${q.mcqQuestionScore || 1} pts` : result === 'incorrect' ? '0 pts' : 'Skipped'}
                  </span>
                  {isExpanded ? <ChevronUp size={14} style={{ color: T.textMuted, flexShrink: 0 }} /> : <ChevronDown size={14} style={{ color: T.textMuted, flexShrink: 0 }} />}
                </button>
                
                {isExpanded && (
                  <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${T.borderLight}` }}>
                    <div style={{ paddingTop: 14 }}><ContentBlockRenderer title={title} /></div>
                    
                    {/* Description with HTML support */}
                    {q.mcqQuestionDescription && (
                      <div style={{ marginTop: 8, marginBottom: 12, padding: '8px 12px', background: T.blueLight, borderRadius: 8, border: `1px solid ${T.blue}20` }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: T.blue, marginBottom: 4 }}>📌 Description</p>
                        <div dangerouslySetInnerHTML={{ __html: q.mcqQuestionDescription }} style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }} />
                      </div>
                    )}
                    
                    {/* User's Answer Section */}
                    <div style={{ 
                      marginTop: 12, 
                      padding: '10px 14px', 
                      borderRadius: 10, 
                      background: result === 'correct' ? T.greenLight : T.redLight,
                      border: `1px solid ${result === 'correct' ? T.green + '40' : T.red + '40'}`
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: result === 'correct' ? T.greenDark : T.red, marginBottom: 4 }}>
                        📝 Your Answer:
                      </p>
                      <p style={{ fontSize: 13, color: T.textMain, margin: 0, lineHeight: 1.5 }}>
                        {userAnswer}
                      </p>
                    </div>
                    
                    {/* Correct Answer Section (not for essay type) */}
                    {!isEssayType && (
                      <div style={{ 
                        marginTop: 10, 
                        padding: '10px 14px', 
                        borderRadius: 10, 
                        background: T.greenLight, 
                        border: `1px solid ${T.green}40`
                      }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: T.greenDark, marginBottom: 4 }}>
                          ✓ Correct Answer:
                        </p>
                        <p style={{ fontSize: 13, color: T.greenDark, margin: 0, lineHeight: 1.5 }}>
                          {correctAnswer}
                        </p>
                      </div>
                    )}
                    
                    {/* Explanation Section */}
                    {q.explanation && (
                      <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: T.blueLight, border: `1px solid ${T.blue}30` }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: T.blue, marginBottom: 4 }}>💡 Explanation</p>
                        <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.6, margin: 0 }}>{q.explanation}</p>
                      </div>
                    )}
                    
                    {/* For multiple select, show which options were correct */}
                    {q.mcqQuestionType === 'multiple_select' && q.mcqQuestionOptions && (
                      <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: T.pageBg, border: `1px solid ${T.border}` }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: T.textSub, marginBottom: 4 }}>Options:</p>
                        {q.mcqQuestionOptions.map(opt => {
                          const isSelected = getSelectedOptionsForQuestion(q._id).includes(opt._id);
                          const isCorrectOpt = opt.isCorrect;
                          let statusColor = T.textMuted;
                          let statusText = '';
                          
                          if (isCorrectOpt && isSelected) {
                            statusColor = T.green;
                            statusText = '✓ Correct & Selected';
                          } else if (isCorrectOpt && !isSelected) {
                            statusColor = T.red;
                            statusText = '✗ Correct but not selected';
                          } else if (!isCorrectOpt && isSelected) {
                            statusColor = T.red;
                            statusText = '✗ Incorrect selection';
                          } else {
                            statusColor = T.textMuted;
                            statusText = '○ Not selected';
                          }
                          
                          return (
                            <div key={opt._id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                              <span style={{ fontSize: 12, color: statusColor }}>{opt.text}</span>
                              <span style={{ fontSize: 10, color: statusColor, marginLeft: 'auto' }}>{statusText}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
};

// ── Submit Dialog ──────────────────────────────────────────────────────────
const YouDoSubmitDialog = ({ unansweredCount, onConfirm, onCancel }: { unansweredCount: number; onConfirm: () => void; onCancel: () => void }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }}>
    <div style={{ background: T.bg, borderRadius: 20, maxWidth: 380, width: '100%', padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: T.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <AlertCircle size={22} style={{ color: T.orange }} />
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: T.textMain, marginBottom: 8 }}>Submit Quiz?</h3>
      {unansweredCount > 0 && (
        <p style={{ fontSize: 13, color: T.textSub, marginBottom: 20, lineHeight: 1.6 }}>
          You have <strong>{unansweredCount}</strong> unanswered question{unansweredCount > 1 ? 's' : ''}. Submit anyway?
        </p>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textSub, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Keep going</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: T.orange, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Submit</button>
      </div>
    </div>
  </div>
);

const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
    <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${T.border}`, borderTopColor: T.orange, animation: 'spin 0.7s linear infinite' }} />
    <p style={{ fontSize: 14, color: T.textMuted, fontFamily: 'inherit' }}>Loading quiz…</p>
    <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
  </div>
);

// ── Right Panel ────────────────────────────────────────────────────────────
interface RightPanelProps {
  questions: MCQQuestion[];
  currentIndex: number;
  answers: Map<string, Answer>;
  flaggedQuestions: Set<number>;
  isQuestionAnswered: (q: MCQQuestion) => boolean;
  onJump: (idx: number) => void;
  config: YouDoConfig;
  difficultyFilter: DifficultyFilter;
  setDifficultyFilter: (d: DifficultyFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  timeLeft: number;
  totalDuration: number;
}

const RightPanel: React.FC<RightPanelProps> = ({
  questions, currentIndex, answers, flaggedQuestions,
  isQuestionAnswered, onJump, config,
  difficultyFilter, setDifficultyFilter,
  statusFilter, setStatusFilter,
  timeLeft, totalDuration,
}) => {
  const totalQ       = questions.length;
  const doneCount    = questions.filter(isQuestionAnswered).length;
  const flagCount    = flaggedQuestions.size;
  const ansFlagCount = questions.filter((q, i) => isQuestionAnswered(q) && flaggedQuestions.has(i)).length;

  const easyCnt = questions.filter(q => q.mcqQuestionDifficulty === 'easy').length;
  const medCnt  = questions.filter(q => q.mcqQuestionDifficulty === 'medium').length;
  const hardCnt = questions.filter(q => q.mcqQuestionDifficulty === 'hard').length;

  const filteredIndices = questions.reduce<number[]>((acc, q, i) => {
    if (difficultyFilter !== 'all' && q.mcqQuestionDifficulty !== difficultyFilter) return acc;
    if (statusFilter === 'done'     && !isQuestionAnswered(q)) return acc;
    if (statusFilter === 'flagged'  && !flaggedQuestions.has(i)) return acc;
    if (statusFilter === 'ans_flag' && !(isQuestionAnswered(q) && flaggedQuestions.has(i))) return acc;
    acc.push(i);
    return acc;
  }, []);

  const noFilters = difficultyFilter === 'all' && statusFilter === 'all';
  const clearFilters = () => { setDifficultyFilter('all'); setStatusFilter('all'); };

  const fmtClock = (s: number) => {
    if (s <= 0) return '00:00';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  const timerPct = totalDuration > 0 ? Math.max(0, (timeLeft / (totalDuration * 60)) * 100) : 0;
  const timerCol = timeLeft < 60 ? T.red : timeLeft < 300 ? T.amber : T.green;

  const statusChips: { key: StatusFilter; label: string; count: number; icon: string; activeBg: string }[] = [
    { key: 'all',      label: 'All',     count: totalQ,      icon: '⊙', activeBg: T.orange },
    { key: 'done',     label: 'Done',    count: doneCount,   icon: '✓', activeBg: T.green  },
    { key: 'flagged',  label: 'Flagged', count: flagCount,   icon: '⚑', activeBg: T.amber  },
    { key: 'ans_flag', label: '✓⚑',     count: ansFlagCount, icon: '', activeBg: T.purple },
  ];

  return (
    <div
      style={{
        flexShrink: 0, width: 230, minHeight: 0,
        borderLeft: `1px solid ${T.border}`,
        background: T.bg,
        overflowY: 'auto',
        padding: '14px 12px 24px',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}
      className="yd-s"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${T.borderLight}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Grid3x3 size={13} style={{ color: T.orange }} />
          <span style={{ fontSize: 13, fontWeight: 800, color: T.textMain }}>Questions</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.orange, background: T.orangeLight, padding: '3px 9px', borderRadius: 99 }}>
          {doneCount}/{totalQ}
        </span>
      </div>

      {totalDuration > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 12px', borderRadius: 10, border: `1px solid ${T.borderLight}`, background: T.pageBg }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Clock size={12} style={{ color: timerCol }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.textSub }}>Time Left</span>
            </div>
            <span style={{
              fontSize: 13, fontWeight: 800, color: timerCol,
              fontVariantNumeric: 'tabular-nums',
              animation: timeLeft < 60 ? 'pulse 1s infinite' : undefined,
            }}>
              {fmtClock(timeLeft)}
            </span>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: T.borderLight, overflow: 'hidden' }}>
            <div style={{
              width: `${timerPct}%`, height: '100%',
              background: timerCol, borderRadius: 99,
              transition: 'width 1s linear',
            }} />
          </div>
        </div>
      )}

      <div style={{ marginBottom: 10 }}>
        <div style={{ position: 'relative' }}>
          <select
            value={difficultyFilter}
            onChange={e => setDifficultyFilter(e.target.value as DifficultyFilter)}
            style={{
              width: '100%', padding: '7px 28px 7px 10px',
              borderRadius: 8,
              border: `1.5px solid ${difficultyFilter !== 'all' ? T.orange : T.border}`,
              background: T.bg, fontSize: 12, color: T.textMain,
              fontFamily: 'inherit', fontWeight: 600,
              cursor: 'pointer', appearance: 'none', outline: 'none',
            }}
          >
            <option value="all">All difficulties</option>
            <option value="easy">Easy ({easyCnt})</option>
            <option value="medium">Medium ({medCnt})</option>
            <option value="hard">Hard ({hardCnt})</option>
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: T.textMuted, pointerEvents: 'none' }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {statusChips.map(({ key, label, count, icon, activeBg }) => {
          const isActive = statusFilter === key;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 9px', borderRadius: 99,
                border: `1.5px solid ${isActive ? activeBg : T.border}`,
                background: isActive ? activeBg : T.pageBg,
                color: isActive ? '#fff' : T.textSub,
                fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.13s',
              }}
            >
              {icon && <span style={{ fontSize: 10 }}>{icon}</span>}
              <span>{label}</span>
              <span style={{
                fontSize: 10, fontWeight: 800,
                background: isActive ? 'rgba(255,255,255,0.25)' : T.border,
                color: isActive ? '#fff' : T.textMuted,
                padding: '1px 5px', borderRadius: 99,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {!noFilters && (
        <button
          onClick={clearFilters}
          style={{
            width: '100%', marginBottom: 10,
            padding: '5px 10px', borderRadius: 8,
            border: `1.5px solid ${T.orange}`,
            background: T.orangeLight, color: T.orange,
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}
        >
          <X size={11} /> Clear filters
        </button>
      )}

      <div style={{ height: 1, background: T.borderLight, marginBottom: 8 }} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px', marginBottom: 10 }}>
        {[
          { dot: T.orange,   lbl: 'Current',  border: undefined },
          { dot: T.green,    lbl: 'Answered', border: undefined },
          { dot: T.amber,    lbl: 'Flagged',  border: undefined },
          { dot: T.pageBg,   lbl: 'Pending',  border: T.border  },
          { dot: T.purple,   lbl: 'Ans+Flag', border: undefined },
        ].map(({ dot, lbl, border }) => (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: dot, border: border ? `1px solid ${border}` : undefined, flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: T.textSub }}>{lbl}</span>
          </div>
        ))}
      </div>

      {!noFilters && (
        <p style={{ fontSize: 10, color: T.textMuted, marginBottom: 8 }}>
          Showing {filteredIndices.length} of {totalQ} questions
        </p>
      )}

      {filteredIndices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ fontSize: 12, color: T.textMuted, margin: '0 0 8px' }}>No questions match</p>
          <button onClick={clearFilters} style={{ fontSize: 11, color: T.orange, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', padding: 0 }}>
            Clear filter
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5 }}>
          {filteredIndices.map(i => {
            const q        = questions[i];
            const isCurr   = i === currentIndex;
            const isAns    = isQuestionAnswered(q);
            const isFlag   = flaggedQuestions.has(i);
            const isAnsFlag = isAns && isFlag;

            let bg = T.pageBg, col = T.textSub, bdr = T.border;
            if      (isCurr)    { bg = T.orange;      col = '#fff';      bdr = T.orange;        }
            else if (isAnsFlag) { bg = T.purpleLight;  col = T.purple;    bdr = T.purple + '80'; }
            else if (isAns)     { bg = T.greenLight;   col = T.greenDark; bdr = T.green + '80';  }
            else if (isFlag)    { bg = T.amberLight;   col = T.amber;     bdr = T.amber + '80';  }

            return (
              <button
                key={i}
                onClick={() => onJump(i)}
                title={`Q${i + 1}${isFlag ? ' • Flagged' : ''}${isAns ? ' • Answered' : ''}`}
                style={{
                  aspectRatio: '1', borderRadius: 8,
                  border: `1.5px solid ${bdr}`,
                  background: bg, color: col,
                  fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', position: 'relative',
                  fontFamily: 'inherit', transition: 'all 0.12s',
                }}
              >
                {i + 1}
                {isFlag && !isCurr && (
                  <span style={{ position: 'absolute', top: -4, right: -4, fontSize: 9, color: T.amber }}>⚑</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {(config.passingScore || (config.timeLimit && config.timeLimit > 0)) && (
        <div style={{ marginTop: 14, padding: '10px 12px', background: T.pageBg, borderRadius: 10, border: `1px solid ${T.borderLight}` }}>
          {config.passingScore && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart size={11} style={{ color: T.orange }} />
              <span style={{ fontSize: 11, color: T.textSub }}>Pass: {config.passingScore}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
const StudentTestYourSkillsMCQQuestion: React.FC<YouDoMCQProps> = ({
  courseId, nodeId, nodeName = '', nodeType = 'topic', courseName = 'Course',
  activity = 'test_your_skills', category = 'You_Do', subcategory = '',
  onCloseExercise, inlineQuestions, inlineConfig,
}) => {
  const router = useRouter();
  const [questions, setQuestions]               = useState<MCQQuestion[]>([]);
  const [originalQuestions, setOriginalQuestions] = useState<MCQQuestion[]>([]);
  const [config, setConfig]                     = useState<YouDoConfig>({});
  const [currentIndex, setCurrentIndex]         = useState(0);
  const [answers, setAnswers]                   = useState<Map<string, Answer>>(new Map());
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set());
  const [loading, setLoading]                   = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [quizCompleted, setQuizCompleted]       = useState(false);
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [timeLeft, setTimeLeft]                 = useState(0);
  const [totalDuration, setTotalDuration]       = useState(0);
  const [showBackConfirmation, setShowBackConfirmation] = useState(false);

  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>('all');
  const [statusFilter, setStatusFilter]         = useState<StatusFilter>('all');

  const timerRef  = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [selectedRadioOption, setSelectedRadioOption]           = useState<string | null>(null);
  const [selectedCheckboxOptions, setSelectedCheckboxOptions]   = useState<Set<string>>(new Set());
  const [selectedDropdownOption, setSelectedDropdownOption]     = useState<string | null>(null);
  const [trueFalseValue, setTrueFalseValue]                     = useState<boolean | null>(null);
  const [shortAnswerText, setShortAnswerText]                   = useState('');
  const [essayText, setEssayText]                               = useState('');
  const [numericValue, setNumericValue]                         = useState<number | null>(null);
  const [matchingAnswers, setMatchingAnswers]                   = useState<{ left: string; right: string; }[]>([]);
  const [orderingAnswers, setOrderingAnswers]                   = useState<{ itemId: string; order: number; }[]>([]);

  const answersRef = useRef<Map<string, Answer>>(new Map());

  const normalizeQuestion = (q: any): MCQQuestion => ({
    _id: q._id?.$oid || q._id || `q-${Math.random().toString(36).slice(2)}`,
    questionType: q.questionType || 'mcq',
    mcqQuestionTitle: q.mcqQuestionTitle || q.title || 'Question',
    mcqQuestionDescription: q.mcqQuestionDescription || '',
    mcqQuestionType: q.mcqQuestionType || 'multiple_choice',
    mcqQuestionDifficulty: q.mcqQuestionDifficulty || 'medium',
    mcqQuestionScore: q.mcqQuestionScore || q.score || 1,
    mcqQuestionTimeLimit: q.mcqQuestionTimeLimit || 2000,
    isActive: q.isActive !== false,
    mcqQuestionOptionsPerRow: q.mcqQuestionOptionsPerRow || 1,
    mcqQuestionRequired: q.mcqQuestionRequired || false,
    mcqQuestionOptions: (q.mcqQuestionOptions || []).map((o: any, idx: number) => ({
      _id: o._id?.$oid || o._id || `opt-${idx}-${Math.random().toString(36).slice(2)}`,
      text: o.text || '',
      isCorrect: o.isCorrect || false,
      imageUrl: o.imageUrl || null,
      imageAlignment: o.imageAlignment || 'center',
      imageSizePercent: o.imageSizePercent || 60,
    })),
    mcqQuestionCorrectAnswers: q.mcqQuestionCorrectAnswers || [],
    hints: q.hints || [],
    testCases: q.testCases || [],
    constraints: q.constraints || [],
    trueFalseAnswer: q.trueFalseAnswer ?? null,
    numericAnswer: q.numericAnswer ?? null,
    numericTolerance: q.numericTolerance ?? null,
    matchingPairs: (q.matchingPairs || []).map((pair: any, idx: number) => ({
      left: pair.left,
      right: pair.right,
      _id: pair._id || pair.id || `pair-${idx}`
    })),
    orderingItems: (q.orderingItems || []).map((item: any, idx: number) => ({
      text: item.text,
      order: item.order || idx + 1,
      _id: item._id || item.id || `item-${idx}`
    })),
    shortAnswer: q.shortAnswer || '',
    explanation: q.explanation || '',
  });

  const startTimer = (durationMinutes: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTotalDuration(durationMinutes);
    setTimeLeft(durationMinutes * 60);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleAutoSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleAutoSubmit = () => {
    if (quizCompleted || isSubmitting) return;
    setIsSubmitting(true);
    toast.info("Time's up! Submitting…");
    setTimeout(() => { setQuizCompleted(true); setIsSubmitting(false); }, 800);
  };

  const persistAnswers = (updated: Map<string, Answer>) => {
    setAnswers(updated);
    answersRef.current = updated;
  };

  const loadAnswersForQuestion = (q: MCQQuestion, map: Map<string, Answer>) => {
    setSelectedRadioOption(null);
    setSelectedCheckboxOptions(new Set());
    setSelectedDropdownOption(null);
    setTrueFalseValue(null);
    setShortAnswerText('');
    setEssayText('');
    setNumericValue(null);
    setMatchingAnswers([]);
    setOrderingAnswers([]);
    
    switch (q.mcqQuestionType) {
      case 'multiple_choice':
        setSelectedRadioOption(map.get(q._id)?.optionId || null);
        break;
      case 'multiple_select': {
        const s = new Set<string>();
        map.forEach((value, key) => {
          if (value?.questionId === q._id && value.optionId) {
            s.add(value.optionId);
          }
        });
        setSelectedCheckboxOptions(s);
        break;
      }
      case 'dropdown':
        setSelectedDropdownOption(map.get(q._id)?.optionId || null);
        break;
      case 'true_false':
        setTrueFalseValue(map.get(q._id)?.booleanAnswer ?? null);
        break;
      case 'short_answer':
        setShortAnswerText(map.get(q._id)?.textAnswer || '');
        break;
      case 'essay':
        setEssayText(map.get(q._id)?.textAnswer || '');
        break;
      case 'numeric':
        setNumericValue(map.get(q._id)?.numericAnswer ?? null);
        break;
      case 'matching':
        setMatchingAnswers(map.get(q._id)?.matchingAnswers || []);
        break;
      case 'ordering':
        setOrderingAnswers(map.get(q._id)?.orderingAnswers || []);
        break;
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  const handleOptionSelect = (optionId: string) => {
    if (quizCompleted) return;
    const q = questions[currentIndex];
    const pts = q.mcqQuestionScore || config.pointsPerQuestion || 1;
    
    if (q.mcqQuestionType === 'multiple_choice') {
      setSelectedRadioOption(optionId);
      const opt = q.mcqQuestionOptions.find(o => o._id === optionId);
      if (!opt) return;
      const ic = opt.isCorrect === true;
      const m = new Map(answers);
      m.set(q._id, { 
        questionId: q._id, 
        optionId: opt._id, 
        optionText: opt.text, 
        isCorrect: ic, 
        score: ic ? pts : 0, 
        status: ic ? 'solved' : 'attempted' 
      });
      persistAnswers(m);
    } 
    else if (q.mcqQuestionType === 'multiple_select') {
      setSelectedCheckboxOptions(prev => {
        const next = new Set(prev);
        const m = new Map(answers);
        
        if (next.has(optionId)) {
          next.delete(optionId);
          const toDelete: string[] = [];
          m.forEach((value, key) => {
            if (value.questionId === q._id && value.optionId === optionId) {
              toDelete.push(key);
            }
          });
          toDelete.forEach(key => m.delete(key));
        } else {
          next.add(optionId);
          const opt = q.mcqQuestionOptions.find(o => o._id === optionId);
          if (opt) {
            const uniqueKey = `${q._id}_${optionId}`;
            m.set(uniqueKey, { 
              questionId: q._id, 
              optionId: opt._id, 
              optionText: opt.text, 
              isCorrect: opt.isCorrect, 
              score: opt.isCorrect ? pts : 0, 
              status: 'attempted' 
            });
          }
        }
        
        persistAnswers(m);
        return next;
      });
    } 
    else if (q.mcqQuestionType === 'dropdown') {
      setSelectedDropdownOption(optionId);
      const opt = q.mcqQuestionOptions.find(o => o._id === optionId);
      if (!opt) return;
      const ic = opt.isCorrect === true;
      const m = new Map(answers);
      m.set(q._id, { 
        questionId: q._id, 
        optionId: opt._id, 
        optionText: opt.text, 
        isCorrect: ic, 
        score: ic ? pts : 0, 
        status: ic ? 'solved' : 'attempted' 
      });
      persistAnswers(m);
    }
  };

  const handleTrueFalseChange = (value: boolean) => {
    setTrueFalseValue(value);
    const q = questions[currentIndex]; 
    const ic = q.trueFalseAnswer === value; 
    const pts = q.mcqQuestionScore || config.pointsPerQuestion || 1;
    const m = new Map(answers); 
    m.set(q._id, { 
      questionId: q._id, 
      booleanAnswer: value, 
      isCorrect: ic, 
      score: ic ? pts : 0, 
      status: ic ? 'solved' : 'attempted' 
    }); 
    persistAnswers(m);
  };

  const handleShortAnswerChange = (value: string) => {
    setShortAnswerText(value);
    const q = questions[currentIndex];
    const pts = q.mcqQuestionScore || config.pointsPerQuestion || 1;
    
    let correctAnswer = q.shortAnswer || '';
    if (!correctAnswer && q.mcqQuestionCorrectAnswers && q.mcqQuestionCorrectAnswers.length > 0) {
      correctAnswer = q.mcqQuestionCorrectAnswers[0];
    }
    
    const isCorrect = value.trim().toLowerCase() === correctAnswer.trim().toLowerCase();
    
    const m = new Map(answers);
    if (!value.trim()) {
      m.delete(q._id);
    } else {
      m.set(q._id, {
        questionId: q._id,
        textAnswer: value,
        isCorrect: isCorrect,
        score: isCorrect ? pts : 0,
        status: isCorrect ? 'solved' : 'attempted'
      });
    }
    persistAnswers(m);
  };

  const handleEssayChange = (value: string) => {
    setEssayText(value);
    const q = questions[currentIndex];
    const pts = q.mcqQuestionScore || config.pointsPerQuestion || 1;
    
    let keywords: string[] = [];
    if (q.mcqQuestionCorrectAnswers && q.mcqQuestionCorrectAnswers.length > 0) {
      keywords = q.mcqQuestionCorrectAnswers.map(ans => ans.toLowerCase().trim());
    }
    if (q.shortAnswer) {
      keywords.push(q.shortAnswer.toLowerCase().trim());
    }
    
    let isCorrect = false;
    let score = 0;
    
    if (keywords.length > 0 && value.trim()) {
      const lowerValue = value.toLowerCase();
      const matchedKeywords = keywords.filter(keyword => lowerValue.includes(keyword));
      if (matchedKeywords.length > 0) {
        score = Math.round((matchedKeywords.length / keywords.length) * pts);
        isCorrect = score >= (pts / 2);
      }
    }
    
    const m = new Map(answers);
    if (!value.trim()) {
      m.delete(q._id);
    } else {
      m.set(q._id, {
        questionId: q._id,
        textAnswer: value,
        isCorrect: isCorrect,
        score: score,
        status: keywords.length > 0 ? (isCorrect ? 'solved' : 'attempted') : 'submitted'
      });
    }
    persistAnswers(m);
  };

  const handleNumericChange = (value: number) => {
    setNumericValue(value); 
    const q = questions[currentIndex]; 
    const ca = q.numericAnswer || 0; 
    const tol = q.numericTolerance || 0; 
    const ic = Math.abs(value - ca) <= tol; 
    const pts = q.mcqQuestionScore || config.pointsPerQuestion || 1;
    const m = new Map(answers); 
    m.set(q._id, { 
      questionId: q._id, 
      numericAnswer: value, 
      isCorrect: ic, 
      score: ic ? pts : 0, 
      status: ic ? 'solved' : 'attempted' 
    }); 
    persistAnswers(m);
  };

  const handleMatchingChange = (na: { left: string; right: string; }[]) => {
    setMatchingAnswers(na); 
    const q = questions[currentIndex]; 
    const correct = q.matchingPairs || []; 
    let ok = na.length === correct.length; 
    if (ok) for (const p of correct) { 
      const match = na.find(a => a.left === p.left); 
      if (!match || match.right !== p.right) { 
        ok = false; 
        break; 
      } 
    } 
    const pts = q.mcqQuestionScore || config.pointsPerQuestion || 1;
    const m = new Map(answers); 
    m.set(q._id, { 
      questionId: q._id, 
      matchingAnswers: na, 
      isCorrect: ok, 
      score: ok ? pts : 0, 
      status: na.length > 0 ? (ok ? 'solved' : 'attempted') : 'skipped' 
    }); 
    persistAnswers(m);
  };

  const handleOrderingChange = (na: { itemId: string; order: number; }[]) => {
    setOrderingAnswers(na); 
    const q = questions[currentIndex]; 
    const correct = q.orderingItems || []; 
    let ok = na.length === correct.length; 
    if (ok) for (let i = 0; i < na.length; i++) { 
      const item = correct.find(it => it._id === na[i].itemId); 
      if (!item || item.order !== na[i].order) { 
        ok = false; 
        break; 
      } 
    } 
    const pts = q.mcqQuestionScore || config.pointsPerQuestion || 1;
    const m = new Map(answers); 
    m.set(q._id, { 
      questionId: q._id, 
      orderingAnswers: na, 
      isCorrect: ok, 
      score: ok ? pts : 0, 
      status: na.length > 0 ? (ok ? 'solved' : 'attempted') : 'skipped' 
    }); 
    persistAnswers(m);
  };

  const isQuestionAnswered = (q: MCQQuestion): boolean => {
    switch (q.mcqQuestionType) {
      case 'multiple_select': 
        let hasSelection = false;
        answers.forEach((value, key) => {
          if (value?.questionId === q._id && value.optionId) {
            hasSelection = true;
          }
        });
        return hasSelection;
      case 'short_answer': 
      case 'essay': 
        const answer = answers.get(q._id)?.textAnswer;
        return !!(answer && answer.trim().length > 0);
      case 'true_false': 
        return answers.get(q._id)?.booleanAnswer !== undefined;
      case 'numeric': 
        return answers.get(q._id)?.numericAnswer !== undefined;
      case 'matching': 
        return !!(answers.get(q._id)?.matchingAnswers?.length);
      case 'ordering': 
        return !!(answers.get(q._id)?.orderingAnswers?.length);
      default: 
        return answers.has(q._id);
    }
  };

  // Calculate unanswered count for the confirmation modal - after isQuestionAnswered is defined
  const unansweredCount = useMemo(() => {
    return questions.filter(q => !isQuestionAnswered(q)).length;
  }, [questions, answers]);

  const toggleFlag = (index: number) => {
    setFlaggedQuestions(prev => { 
      const next = new Set(prev); 
      next.has(index) ? next.delete(index) : next.add(index); 
      return next; 
    });
  };

  const handlePrev = () => {
    if (currentIndex <= 0) return;
    loadAnswersForQuestion(questions[currentIndex - 1], answersRef.current);
    setCurrentIndex(p => p - 1);
  };
  
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      loadAnswersForQuestion(questions[currentIndex + 1], answersRef.current);
      setCurrentIndex(p => p + 1);
    }
  };
  
  const handleJump = (idx: number) => {
    loadAnswersForQuestion(questions[idx], answersRef.current);
    setCurrentIndex(idx);
  };
  
  const handleBackConfirmation = () => {
    // Show confirmation dialog if there are unanswered questions
    if (unansweredCount > 0) {
      setShowBackConfirmation(true);
    } else {
      // No unanswered questions, exit immediately
      executeBack();
    }
  };
  
  const executeBack = () => {
    // Clear timer to prevent memory leaks
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // If parent provided close handler, use it first (for modal/popup mode)
    if (onCloseExercise) {
      onCloseExercise();
      return;
    }
    
    // Otherwise try to navigate back using router
    try {
      router.back();
    } catch (error) {
      console.error('Failed to navigate back:', error);
    }
  };
  
  const handleSubmitClick = () => {
    const unanswered = questions.filter(q => !isQuestionAnswered(q)).length;
    if (unanswered > 0) { 
      setShowSubmitDialog(true); 
      return; 
    }
    finishQuiz();
  };
  
  const finishQuiz = () => {
    setIsSubmitting(true); 
    setShowSubmitDialog(false);
    setTimeout(() => { 
      if (timerRef.current) clearInterval(timerRef.current); 
      setQuizCompleted(true); 
      setIsSubmitting(false); 
    }, 400);
  };
  
  const handleRetry = () => {
    setAnswers(new Map()); 
    answersRef.current = new Map(); 
    setCurrentIndex(0);
    setQuizCompleted(false); 
    setFlaggedQuestions(new Set());
    setDifficultyFilter('all'); 
    setStatusFilter('all');
    
    if (config.shuffleQuestions && originalQuestions.length > 0) {
      const reshuffled = shuffleArray(originalQuestions);
      setQuestions(reshuffled);
    }
    
    setSelectedRadioOption(null);
    setSelectedCheckboxOptions(new Set());
    setSelectedDropdownOption(null);
    setTrueFalseValue(null);
    setShortAnswerText('');
    setEssayText('');
    setNumericValue(null);
    setMatchingAnswers([]);
    setOrderingAnswers([]);
    
    if (config.timeLimit && config.timeLimit > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      startTimer(config.timeLimit);
    }
    
    if (questions.length > 0) {
      loadAnswersForQuestion(questions[0], new Map());
    }
  };

  // Load questions with shuffle on every start
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        if (inlineQuestions && inlineQuestions.length > 0) {
          const normalized = inlineQuestions.map(normalizeQuestion);
          setOriginalQuestions(normalized);
          const cfg = inlineConfig || {};
          
          const shouldShuffle = cfg.shuffleQuestions === true;
          if (shouldShuffle) {
            const shuffled = shuffleArray(normalized);
            setQuestions(shuffled);
          } else {
            setQuestions(normalized);
          }
          
          setConfig(cfg);
          if (cfg.timeLimit && cfg.timeLimit > 0) startTimer(cfg.timeLimit);
          setLoading(false);
          return;
        }
        
        const token = getToken() || localStorage.getItem('token') || '';
        const entityTypeToPath: Record<string, string> = { topic: 'topics', subtopic: 'subtopics', submodule: 'submodules', module: 'modules' };
        const path = entityTypeToPath[nodeType] || 'topics';
        const res = await fetch(`http://localhost:5533/you-do/getAllQuestions/${path}/${nodeId}/you-do`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const raw = data?.data?.questions || data?.questions || data?.data || data || [];
        const cfg: YouDoConfig = {
          timeLimit: data?.data?.timeLimit || data?.timeLimit || 0,
          passingScore: data?.data?.passingScore || data?.passingScore || 70,
          attemptLimit: data?.data?.attemptLimit || data?.attemptLimit || 1,
          shuffleQuestions: data?.data?.shuffleQuestions || data?.shuffleQuestions || false,
          showResults: data?.data?.showResults !== false,
          pointsPerQuestion: data?.data?.pointsPerQuestion || data?.pointsPerQuestion || 1,
          totalPoints: data?.data?.totalPoints || data?.totalPoints,
        };
        const normalized = (Array.isArray(raw) ? raw : []).map(normalizeQuestion).filter(q => q.isActive !== false);
        setOriginalQuestions(normalized);
        
        const shouldShuffle = cfg.shuffleQuestions === true;
        if (shouldShuffle) {
          const shuffled = shuffleArray(normalized);
          setQuestions(shuffled);
        } else {
          setQuestions(normalized);
        }
        
        setConfig(cfg);
        if (cfg.timeLimit && cfg.timeLimit > 0) startTimer(cfg.timeLimit);
      } catch (err) {
        console.error('YouDoMCQ: Failed to load questions', err);
        toast.error('Failed to load quiz questions');
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [nodeId, nodeType, inlineQuestions]);

  const answeredCount  = questions.filter(isQuestionAnswered).length;
  const progressPct   = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  if (loading) return <LoadingScreen />;
  if (quizCompleted && config.showResults !== false) {
    return <YouDoResultScreen questions={questions} answers={answers} config={config} onClose={executeBack} onRetry={handleRetry} />;
  }
  if (questions.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: T.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Poppins',-apple-system,BlinkMacSystemFont,sans-serif" }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <AlertCircle size={40} style={{ color: T.amber, marginBottom: 16 }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: T.textMain, marginBottom: 8 }}>No Questions Found</h2>
          <p style={{ fontSize: 14, color: T.textSub, marginBottom: 24 }}>No questions have been configured for this activity yet.</p>
          <button onClick={executeBack} style={{ padding: '10px 24px', borderRadius: 10, background: T.orange, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>Go Back</button>
        </div>
      </div>
    );
  }

  const cq   = questions[currentIndex];
  const diff = DIFF_CFG[cq.mcqQuestionDifficulty] ?? { text: T.orange, bg: T.orangeLight, dot: T.orange };
  const qt   = QTYPE_CFG[cq.mcqQuestionType]      ?? { label: cq.mcqQuestionType, color: T.textMuted, bg: T.pageBg };
  const isFlagged = flaggedQuestions.has(currentIndex);
  const isLastQ   = currentIndex >= questions.length - 1;

  const getGridCols = () => {
    const p = cq.mcqQuestionOptionsPerRow || 1;
    if (p === 1) return 'repeat(1,1fr)';
    if (p === 3) return 'repeat(3,1fr)';
    if (p === 4) return 'repeat(4,1fr)';
    return 'repeat(2,1fr)';
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: T.pageBg, fontFamily: "'Poppins',-apple-system,BlinkMacSystemFont,sans-serif", color: T.textMain, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.45;}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        .yd-fade{animation:fadeIn 0.2s ease;}
        .yd-s::-webkit-scrollbar{width:5px;}
        .yd-s::-webkit-scrollbar-track{background:#e4e4ed;border-radius:99px;}
        .yd-s::-webkit-scrollbar-thumb{background:#9b9bae;border-radius:99px;}
        .yd-s::-webkit-scrollbar-thumb:hover{background:#6b6b7e;}
        .yd-btn-prev:hover:not(:disabled){border-color:${T.orange}!important;color:${T.orange}!important;}
        .yd-btn-next:hover{background:${T.orangeDark}!important;}
      `}</style>

      <ToastContainer position="top-right" />
      
      {/* Back Confirmation Modal */}
      {showBackConfirmation && (
        <BackConfirmationModal 
          onConfirm={() => {
            setShowBackConfirmation(false);
            executeBack();
          }}
          onCancel={() => setShowBackConfirmation(false)}
          unansweredCount={unansweredCount}
        />
      )}
      
      {showSubmitDialog && (
        <YouDoSubmitDialog unansweredCount={unansweredCount} onConfirm={finishQuiz} onCancel={() => setShowSubmitDialog(false)} />
      )}

      <div style={{ flexShrink: 0, height: TOP_BAR_H, background: T.bg, borderBottom: `1px solid ${T.border}`, display: 'flex', flexDirection: 'column', zIndex: 50 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, flex: 1 }}>
            {onCloseExercise && (
              <button onClick={handleBackConfirmation} className="yd-btn-prev"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textSub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s', flexShrink: 0, marginRight: 14 }}>
                <ArrowLeft size={13} /> Back
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, marginRight: 14 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg,${T.orange},${T.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 10px ${T.orangeGlow}` }}>
                <Target size={13} color="#fff" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.textMain }}>Test Your Skills</span>
            </div>
            <div style={{ width: 1, height: 18, background: T.border, marginRight: 14, flexShrink: 0 }} />
            <nav style={{ display: 'flex', alignItems: 'center', gap: 0, minWidth: 0, overflow: 'hidden' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: T.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                {nodeName || 'Quiz'}
              </span>
            </nav>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: T.textSub }}>
              <span><span style={{ fontWeight: 700, color: T.textMain }}>{questions.length}</span> Total</span>
              <span><span style={{ fontWeight: 700, color: T.green }}>{answeredCount}</span> Done</span>
              <span><span style={{ fontWeight: 700, color: T.textSub }}>{questions.length - answeredCount}</span> Left</span>
              <span><span style={{ fontWeight: 700, color: T.amber }}>{flaggedQuestions.size}</span> Flagged</span>
            </div>
          </div>
        </div>
        <div style={{ height: 2, background: T.borderLight }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: `linear-gradient(90deg,${T.orange},${T.orangeDark})`, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flexShrink: 0, height: Q_META_H, background: T.bg, borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', gap: 10, zIndex: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <span style={{ fontSize: 10, color: T.textHint, fontWeight: 700, letterSpacing: '0.05em' }}>Q</span>
                <span style={{ fontSize: 26, fontWeight: 900, color: T.orange, lineHeight: 1, letterSpacing: '-0.03em', margin: '0 2px' }}>{currentIndex + 1}</span>
                <span style={{ fontSize: 12, color: T.textHint }}>/{questions.length}</span>
              </div>
              <div style={{ width: 1, height: 18, background: T.border }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, background: diff.bg }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: diff.dot }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: diff.text, textTransform: 'capitalize' as const }}>{cq.mcqQuestionDifficulty}</span>
              </div>
              <div style={{ padding: '3px 9px', borderRadius: 99, background: qt.bg }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: qt.color }}>{qt.label}</span>
              </div>
             
              {cq.mcqQuestionRequired && (
                <div style={{ padding: '3px 9px', borderRadius: 99, background: T.redLight, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 10, color: T.red }}>✱</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: T.red }}>Required</span>
                </div>
              )}
            </div>
            <button onClick={() => toggleFlag(currentIndex)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${isFlagged ? T.amber : T.border}`, background: isFlagged ? T.amberLight : 'transparent', color: isFlagged ? T.amber : T.textMuted, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s' }}>
              <Flag size={12} fill={isFlagged ? T.amber : 'none'} />
              {isFlagged ? 'Flagged' : 'Flag'}
            </button>
          </div>

          <div ref={scrollRef} className="yd-fade yd-s" key={currentIndex}
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px 28px' }}>
            <div style={{ marginBottom: 8 }}><ContentBlockRenderer title={cq.mcqQuestionTitle} /></div>
            
            {/* Description with HTML support */}
            {cq.mcqQuestionDescription && <DescriptionRenderer description={cq.mcqQuestionDescription} />}
            
            <p style={{ fontSize: 11, color: T.textHint, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
              <HelpCircle size={11} style={{ color: T.textHint }} />
              {HINT_TEXT[cq.mcqQuestionType] ?? 'Answer the question.'}
            </p>

            {cq.mcqQuestionType === 'true_false'  && <TrueFalse value={trueFalseValue} onChange={handleTrueFalseChange} disabled={quizCompleted} />}
            {cq.mcqQuestionType === 'dropdown'    && <DropdownSelect options={cq.mcqQuestionOptions} selectedValue={selectedDropdownOption} onChange={handleOptionSelect} disabled={quizCompleted} />}
            {cq.mcqQuestionType === 'short_answer' && <ShortAnswerInput value={shortAnswerText} onChange={handleShortAnswerChange} disabled={quizCompleted} />}
            {cq.mcqQuestionType === 'essay'       && <EssayInput value={essayText} onChange={handleEssayChange} disabled={quizCompleted} />}
            {cq.mcqQuestionType === 'numeric'     && <NumericInput value={numericValue} onChange={handleNumericChange} tolerance={cq.numericTolerance} disabled={quizCompleted} />}
            {cq.mcqQuestionType === 'matching'    && cq.matchingPairs && <MatchingWidget pairs={cq.matchingPairs} answers={matchingAnswers} onChange={handleMatchingChange} disabled={quizCompleted} />}
            {cq.mcqQuestionType === 'ordering'    && cq.orderingItems && <OrderingWidget items={cq.orderingItems} answers={orderingAnswers} onChange={handleOrderingChange} disabled={quizCompleted} />}
            {(cq.mcqQuestionType === 'multiple_choice' || cq.mcqQuestionType === 'multiple_select') && (
              <div style={{ display: 'grid', gridTemplateColumns: getGridCols(), gap: 10 }}>
                {cq.mcqQuestionOptions?.map((option, idx) => (
                  cq.mcqQuestionType === 'multiple_select'
                    ? <CheckboxOption key={option._id} option={option} checked={selectedCheckboxOptions.has(option._id)} onChange={() => handleOptionSelect(option._id)} index={idx} disabled={quizCompleted} />
                    : <RadioOption    key={option._id} option={option} checked={selectedRadioOption === option._id}       onChange={() => handleOptionSelect(option._id)} index={idx} disabled={quizCompleted} />
                ))}
              </div>
            )}
            <div style={{ height: 20 }} />
          </div>
        </div>

        <RightPanel
          questions={questions}
          currentIndex={currentIndex}
          answers={answers}
          flaggedQuestions={flaggedQuestions}
          isQuestionAnswered={isQuestionAnswered}
          onJump={handleJump}
          config={config}
          difficultyFilter={difficultyFilter}
          setDifficultyFilter={setDifficultyFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          timeLeft={timeLeft}
          totalDuration={totalDuration}
        />
      </div>

      <div style={{ flexShrink: 0, height: BOTTOM_BAR_H, background: T.bg, borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, zIndex: 50 }}>
        <button onClick={handlePrev} disabled={currentIndex === 0} className="yd-btn-prev"
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 20px', borderRadius: 10, border: `1.5px solid ${T.border}`, background: 'transparent', color: currentIndex === 0 ? T.textHint : T.textSub, fontSize: 13, fontWeight: 600, cursor: currentIndex === 0 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.13s', flexShrink: 0 }}>
          <ChevronLeft size={15} /> Previous
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, overflow: 'hidden' }}>
          {questions.slice(Math.max(0, currentIndex - 4), Math.min(questions.length, currentIndex + 5)).map((_, relIdx) => {
            const absIdx = Math.max(0, currentIndex - 4) + relIdx;
            const isCurr = absIdx === currentIndex;
            const isDone = isQuestionAnswered(questions[absIdx]);
            return (
              <button key={absIdx} onClick={() => handleJump(absIdx)}
                style={{ width: isCurr ? 22 : 7, height: 7, borderRadius: 99, background: isCurr ? T.orange : isDone ? T.green : T.border, border: 'none', cursor: 'pointer', transition: 'all 0.2s', padding: 0, flexShrink: 0 }} />
            );
          })}
        </div>

        {!isLastQ ? (
          <button onClick={handleNext} className="yd-btn-next"
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 10, border: 'none', background: T.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.13s', boxShadow: `0 3px 14px ${T.orangeGlow}`, flexShrink: 0 }}>
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button onClick={handleSubmitClick} disabled={isSubmitting}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '10px 22px', borderRadius: 10, border: 'none', background: answeredCount === questions.length ? T.green : T.orange, color: '#fff', fontSize: 13, fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.13s', boxShadow: `0 3px 14px ${T.orangeGlow}`, flexShrink: 0 }}>
            {isSubmitting
              ? <><div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} />Submitting…</>
              : <><CheckCircle size={14} />Submit</>
            }
          </button>
        )}
      </div>
    </div>
  );
};

export default StudentTestYourSkillsMCQQuestion;