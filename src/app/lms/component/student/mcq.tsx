'use client';
import { getToken } from "@/lib/session";

import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft, ChevronRight, Home, CheckCircle, Flag, ArrowLeft,
  AlertCircle, XCircle, ChevronDown, ChevronUp, BookOpen,
  File, Layers, Clock, Target, Check, Code, HelpCircle, Info, Filter,
  Type, AlignLeft, Hash, Shuffle, ArrowRight, ArrowLeft as ArrowLeftIcon,
  GripVertical, Sparkles, Brain, Award, Timer, BarChart, Bookmark,
  Circle, CircleDot, PenTool, ListChecks, Grid3x3, Maximize2, Minimize2
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import ExerciseInfoModals, { ExerciseInfoButtons } from './ExerciseInfoModals';

// ── Design tokens ─────────────────────────────────────────────────────────
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
interface ContentBlock {
  id?: string;
  type: string;
  value?: string;
  url?: string;
  bgColor?: string;
  alignment?: string;
  sizePercent?: number;
  width?: number;
  height?: number;
}
interface MCQQuestion {
  _id: string; questionType: string; mcqQuestionTitle: ContentBlock[] | string;
  mcqQuestionDescription: string; mcqQuestionType: string;
  mcqQuestionDifficulty: string; mcqQuestionScore: number;
  mcqQuestionTimeLimit: number; isActive: boolean;
  mcqQuestionOptionsPerRow: number; mcqQuestionRequired: boolean;
  mcqQuestionOptions: MCQOption[]; mcqQuestionCorrectAnswers: string[];
  hints: any[]; testCases: any[]; constraints: any[];
  trueFalseAnswer?: boolean | null; numericAnswer?: number | null;
  numericTolerance?: number | null; matchingPairs?: MatchingPair[];
  orderingItems?: OrderingItem[]; shortAnswer?: string; essayAnswer?: string;
}
interface ExerciseData {
  _id: string; exerciseType: string; configurationType: any;
  isGraded?: boolean;
  exerciseInformation: {
    exerciseId: string; exerciseName: string; description: string;
    exerciseLevel: string; totalDuration: number; totalMarks: number; _id: string;
  };
  questionConfiguration: {
    mcqQuestionConfiguration: {
      totalMcqQuestions: number; marksPerQuestion: number; mcqTotalMarks: number;
      attemptLimitEnabled: boolean; submissionAttempts: number; shuffleQuestions: boolean;
    };
  };
  availabilityPeriod: any; notificatonandGradeSettings: any;
  questions: MCQQuestion[]; createdAt: string; createdBy: string;
  version: number; updatedAt: string; entity: any; location: any;
}
interface Answer {
  questionId: string; optionId?: string; optionText?: string;
  textAnswer?: string; isCorrect?: boolean; score?: number; status?: string;
  matchingAnswers?: { left: string; right: string; }[];
  orderingAnswers?: { itemId: string; order: number; }[];
  numericAnswer?: number; booleanAnswer?: boolean;
}
type FilterType = 'all' | 'flagged' | 'answered' | 'answeredFlagged' | 'required';

// ── Auto-correction helpers (short answer / essay word-overlap grading) ───
const STOPWORDS = new Set(['the','a','an','is','are','was','were','be','been','being','and','or','of','to','in','on','at','for','with','it','its','this','that','as','by','from','will','can','has','have','had','not','but','they','their','there','then','than','these','those','which','what','when','where','who','how','also','into','about','over','after','before','between','out','up','down','off','again','more','most','some','such','only','own','same','so','too','very','just','should','now','do','does','did','you','your','we','our','he','she','his','her','them','if','because','while','during','each','few','both','any','all','no','nor','other','here','why','am','i','me','my']);
const significantWords = (s: string): Set<string> =>
  new Set((s.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => w.length > 2 && !STOPWORDS.has(w)));
// Fraction (0..1) of the model answer's significant words present in the student's text.
const wordOverlap = (student: string, expected: string): number => {
  const exp = significantWords(expected);
  if (exp.size === 0) return 0;
  const stu = significantWords(student);
  let hit = 0; exp.forEach(w => { if (stu.has(w)) hit++; });
  return hit / exp.size;
};
const TEXT_MATCH_THRESHOLD = 0.7; // ≥70% keyword overlap → correct (full marks)
const gradeTextAnswer = (student: string, expected: string): boolean =>
  !!expected.trim() && wordOverlap(student, expected) >= TEXT_MATCH_THRESHOLD;
const gradeMatching = (given: { left: string; right: string }[], correct: MatchingPair[]): boolean => {
  if (!correct.length || given.length !== correct.length) return false;
  return correct.every(p => { const match = given.find(a => a.left === p.left); return !!match && match.right === p.right; });
};
const gradeOrdering = (given: { itemId: string; order: number }[], correct: OrderingItem[]): boolean => {
  if (!correct.length || given.length !== correct.length) return false;
  return given.every(a => { const item = correct.find(it => it._id === a.itemId); return !!item && item.order === a.order; });
};

// ── Helper function to decode HTML entities ────────────────────────────────
const decodeHTMLEntities = (text: string) => {
  if (!text) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
};

// ── Enhanced Content Block Renderer with proper HTML support ────────────────
const ContentBlockRenderer: React.FC<{ title: ContentBlock[] | string }> = ({ title }) => {
  const renderHTML = (html: string) => {
    if (!html) return null;
    // First decode HTML entities if needed
    let decoded = html;
    if (html.includes('&nbsp;') || html.includes('&lt;') || html.includes('&gt;') || html.includes('&amp;')) {
      decoded = decodeHTMLEntities(html);
    }
    // Remove scripts for security
    const cleanHtml = decoded.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
  };

  if (Array.isArray(title)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
        {title.map((block, idx) => {
          // Text block
          if (block.type === 'text' && block.value) {
            // Determine if this is likely a heading (contains h1-h6 tags)
            const isHeading = /<h[1-6][^>]*>/.test(block.value);
            const isBold = /<b>|<strong>/.test(block.value) && !isHeading;
            
            return (
              <div 
                key={block.id || idx} 
                style={{ 
                  fontSize: isHeading ? 20 : isBold ? 16 : 15,
                  fontWeight: isHeading ? 700 : isBold ? 600 : 500,
                  color: T.textMain, 
                  lineHeight: 1.5,
                  marginBottom: 8
                }}
              >
                {renderHTML(block.value)}
              </div>
            );
          }
          
          // Code block
          if (block.type === 'code' && block.value) {
            const bgColor = block.bgColor || '#1e1e1e';
            const isDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(bgColor);
            
            return (
              <div key={block.id || idx} style={{ margin: '8px 0' }}>
                <div style={{
                  padding: '6px 12px',
                  background: isDark ? '#2d2d2d' : '#f5f5f5',
                  borderTopLeftRadius: 8,
                  borderTopRightRadius: 8,
                  borderBottom: `1px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`,
                  fontSize: 11,
                  color: isDark ? '#888' : '#666',
                  fontFamily: 'monospace'
                }}>
                  Code
                </div>
                <pre style={{
                  margin: 0,
                  padding: '12px 16px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  fontFamily: "'Fira Code', 'Cascadia Code', 'Courier New', monospace",
                  color: isDark ? '#d4d4d4' : '#1a1a2e',
                  background: bgColor,
                  borderRadius: '0 0 8px 8px',
                  overflow: 'auto',
                  maxWidth: '100%',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {block.value}
                </pre>
              </div>
            );
          }
          
          // Image block
          if (block.type === 'image' && block.url) {
            const alignment = block.alignment || 'center';
            const justifyContent = 
              alignment === 'left' ? 'flex-start' : 
              alignment === 'right' ? 'flex-end' : 
              'center';
            const sizePercent = block.sizePercent || 60;
            
            return (
              <div key={block.id || idx} style={{ display: 'flex', justifyContent, margin: '12px 0' }}>
                <img 
                  src={block.url} 
                  alt="Question content" 
                  style={{
                    width: `${sizePercent}%`,
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: 8,
                    border: `1px solid ${T.border}`,
                    objectFit: 'contain'
                  }}
                  onError={(e) => {
                    console.error('Failed to load image:', block.url);
                    e.currentTarget.style.display = 'none';
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
  
  // Handle string title (fallback for backwards compatibility)
  if (typeof title === 'string' && title) {
    const hasHtml = /<[a-z][\s\S]*>/i.test(title);
    if (hasHtml) {
      return (
        <div 
          style={{ fontSize: 16, fontWeight: 500, color: T.textMain, lineHeight: 1.6, marginBottom: 8 }}
          dangerouslySetInnerHTML={{ __html: title }}
        />
      );
    }
    return <div style={{ fontSize: 16, fontWeight: 500, color: T.textMain, lineHeight: 1.6, marginBottom: 8 }}>{title}</div>;
  }
  
  return null;
};

// ── Option atoms ──────────────────────────────────────────────────────────
const OptionImage = ({ option, lbl }:{ option: MCQOption; lbl: string }) => {
  if(!option.imageUrl||!option.imageUrl.trim()) return null;
  const justify=option.imageAlignment==='left'?'flex-start':option.imageAlignment==='right'?'flex-end':'center';
  const widthPct=option.imageSizePercent&&option.imageSizePercent>0?option.imageSizePercent:60;
  return (
    <div style={{ marginTop:8,display:'flex',justifyContent:justify }}>
      <img src={option.imageUrl} alt={`Option ${lbl}`} style={{ width:`${widthPct}%`,height:'auto',maxWidth:'100%',borderRadius:8,border:`1px solid ${T.border}`,display:'block' }} onError={e=>{e.currentTarget.style.display='none';}} />
    </div>
  );
};

const RadioOption = ({ option, checked, onChange, index, disabled }:{ option:MCQOption; checked:boolean; onChange:()=>void; index:number; disabled?:boolean }) => {
  const lbl=String.fromCharCode(65+index);
  return (
    <label style={{ display:'flex',alignItems:'flex-start',gap:12,padding:'13px 16px',borderRadius:12,cursor:disabled?'default':'pointer',border:`1.5px solid ${checked?T.orange:T.border}`,background:checked?T.orangeLight:T.bg,transition:'all 0.15s',userSelect:'none' }}>
      <input type="radio" checked={checked} onChange={onChange} className="sr-only" disabled={disabled} />
      <div style={{ flexShrink:0,width:20,height:20,borderRadius:'50%',marginTop:1,border:`2px solid ${checked?T.orange:T.border}`,background:checked?T.orange:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s' }}>
        {checked&&<div style={{ width:7,height:7,borderRadius:'50%',background:'#fff' }} />}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ flexShrink:0,width:20,height:20,borderRadius:6,background:checked?T.orange:T.pageBg,color:checked?'#fff':T.textMuted,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,transition:'all 0.15s' }}>{lbl}</span>
          <span style={{ fontSize:14,color:checked?T.textMain:T.textSub,fontWeight:checked?600:400 }}>{option.text}</span>
        </div>
        <OptionImage option={option} lbl={lbl} />
      </div>
    </label>
  );
};

const CheckboxOption = ({ option, checked, onChange, index, disabled }:{ option:MCQOption; checked:boolean; onChange:()=>void; index:number; disabled?:boolean }) => {
  const lbl=String.fromCharCode(65+index);
  return (
    <label style={{ display:'flex',alignItems:'flex-start',gap:12,padding:'13px 16px',borderRadius:12,cursor:disabled?'default':'pointer',border:`1.5px solid ${checked?T.purple:T.border}`,background:checked?T.purpleLight:T.bg,transition:'all 0.15s',userSelect:'none' }}>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" disabled={disabled} />
      <div style={{ flexShrink:0,width:20,height:20,borderRadius:5,marginTop:1,border:`2px solid ${checked?T.purple:T.border}`,background:checked?T.purple:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s' }}>
        {checked&&<Check size={11} color="#fff" />}
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ flexShrink:0,width:20,height:20,borderRadius:6,background:checked?T.purple:T.pageBg,color:checked?'#fff':T.textMuted,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,transition:'all 0.15s' }}>{lbl}</span>
          <span style={{ fontSize:14,color:checked?T.textMain:T.textSub,fontWeight:checked?600:400 }}>{option.text}</span>
        </div>
        <OptionImage option={option} lbl={lbl} />
      </div>
    </label>
  );
};

const TrueFalse = ({ value, onChange, disabled }:{ value:boolean|null; onChange:(v:boolean)=>void; disabled?:boolean }) => (
  <div style={{ display:'flex',gap:12 }}>
    {[{v:true,label:'True',icon:'✓'},{v:false,label:'False',icon:'✕'}].map(({v,label,icon})=>{
      const isActive=value===v; const col=v?T.green:T.red; const colLight=v?T.greenLight:T.redLight;
      return (
        <button key={label} onClick={()=>!disabled&&onChange(v)}
          style={{ flex:1,padding:'14px 20px',borderRadius:12,cursor:disabled?'default':'pointer',border:`1.5px solid ${isActive?col:T.border}`,background:isActive?colLight:T.bg,display:'flex',alignItems:'center',justifyContent:'center',gap:8,fontSize:14,fontWeight:600,color:isActive?col:T.textSub,transition:'all 0.15s',fontFamily:'inherit' }}>
          <span style={{ width:26,height:26,borderRadius:'50%',background:isActive?col:T.pageBg,color:isActive?'#fff':T.textMuted,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,transition:'all 0.15s' }}>{icon}</span>
          {label}
        </button>
      );
    })}
  </div>
);

const DropdownSelect = ({ options, selectedValue, onChange, disabled }:{ options:MCQOption[]; selectedValue:string|null; onChange:(id:string)=>void; disabled?:boolean }) => {
  const [open,setOpen]=useState(false); const ref=useRef<HTMLDivElement>(null);
  const selected=options.find(o=>o._id===selectedValue);
  useEffect(()=>{ const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h); },[]);
  return (
    <div ref={ref} style={{ position:'relative',maxWidth:480 }}>
      <button type="button" onClick={()=>!disabled&&setOpen(!open)}
        style={{ width:'100%',padding:'13px 16px',borderRadius:12,border:`1.5px solid ${open?T.orange:T.border}`,background:T.bg,display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,fontSize:14,color:selected?T.textMain:T.textHint,fontWeight:selected?500:400,cursor:disabled?'not-allowed':'pointer',fontFamily:'inherit',transition:'all 0.15s',boxShadow:open?`0 0 0 3px ${T.orangeLight}`:'none' }}>
        <span>{selected?selected.text:'Select an answer…'}</span>
        <ChevronDown size={16} style={{ color:T.textMuted,transform:open?'rotate(180deg)':'none',transition:'transform 0.2s' }} />
      </button>
      {open&&!disabled&&(
        <div style={{ position:'absolute',top:'calc(100% + 6px)',left:0,right:0,zIndex:50,background:T.bg,borderRadius:12,border:`1.5px solid ${T.border}`,boxShadow:'0 8px 32px rgba(0,0,0,0.10)',overflow:'hidden',maxHeight:260,overflowY:'auto' }}>
          {options.map((opt,idx)=>(
            <button key={opt._id} type="button" onClick={()=>{ onChange(opt._id); setOpen(false); }}
              style={{ width:'100%',padding:'11px 16px',textAlign:'left',background:selectedValue===opt._id?T.orangeLight:'transparent',border:'none',borderBottom:`1px solid ${T.borderLight}`,fontSize:14,color:T.textMain,cursor:'pointer',display:'flex',alignItems:'center',gap:10,fontFamily:'inherit',transition:'background 0.1s' }}>
              <span style={{ width:20,height:20,borderRadius:5,flexShrink:0,background:selectedValue===opt._id?T.orange:T.pageBg,color:selectedValue===opt._id?'#fff':T.textMuted,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>{String.fromCharCode(65+idx)}</span>
              {opt.text}
              {selectedValue===opt._id&&<Check size={14} style={{ marginLeft:'auto',color:T.orange }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ShortAnswerInput = ({ value, onChange, disabled }:{ value:string; onChange:(v:string)=>void; disabled?:boolean }) => (
  <div style={{ position:'relative',maxWidth:520 }}>
    <input type="text" value={value} onChange={e=>onChange(e.target.value)} placeholder="Type your answer here…" disabled={disabled}
      style={{ width:'100%',padding:'13px 44px 13px 16px',borderRadius:12,border:`1.5px solid ${T.border}`,background:disabled?T.pageBg:T.bg,fontSize:14,color:T.textMain,fontFamily:'inherit',outline:'none',transition:'all 0.15s',boxSizing:'border-box' as const }}
      onFocus={e=>{ e.target.style.borderColor=T.orange; e.target.style.boxShadow=`0 0 0 3px ${T.orangeLight}`; }}
      onBlur={e=>{ e.target.style.borderColor=T.border; e.target.style.boxShadow='none'; }} />
    <PenTool size={15} style={{ position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',color:T.textHint,pointerEvents:'none' }} />
  </div>
);

const EssayInput = ({ value, onChange, disabled }:{ value:string; onChange:(v:string)=>void; disabled?:boolean }) => (
  <div style={{ position:'relative',maxWidth:640 }}>
    <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder="Write your detailed answer here…" disabled={disabled} rows={5}
      style={{ width:'100%',padding:'13px 16px',borderRadius:12,border:`1.5px solid ${T.border}`,background:disabled?T.pageBg:T.bg,fontSize:14,color:T.textMain,fontFamily:'inherit',resize:'vertical',outline:'none',transition:'all 0.15s',boxSizing:'border-box' as const }}
      onFocus={e=>{ e.target.style.borderColor=T.orange; e.target.style.boxShadow=`0 0 0 3px ${T.orangeLight}`; }}
      onBlur={e=>{ e.target.style.borderColor=T.border; e.target.style.boxShadow='none'; }} />
  </div>
);

const NumericInput = ({ value, onChange, tolerance, disabled }:{ value:number|null; onChange:(v:number)=>void; tolerance?:number|null; disabled?:boolean }) => {
  const [raw,setRaw]=useState(value?.toString()||'');
  return (
    <div style={{ maxWidth:280 }}>
      <div style={{ position:'relative' }}>
        <input type="number" value={raw} step="any" disabled={disabled} placeholder="Enter a number…"
          onChange={e=>{ setRaw(e.target.value); if(e.target.value.trim()&&!isNaN(Number(e.target.value))) onChange(Number(e.target.value)); }}
          style={{ width:'100%',padding:'13px 44px 13px 16px',borderRadius:12,border:`1.5px solid ${T.border}`,background:disabled?T.pageBg:T.bg,fontSize:14,color:T.textMain,fontFamily:'inherit',outline:'none',transition:'all 0.15s',boxSizing:'border-box' as const }}
          onFocus={e=>{ e.target.style.borderColor=T.orange; e.target.style.boxShadow=`0 0 0 3px ${T.orangeLight}`; }}
          onBlur={e=>{ e.target.style.borderColor=T.border; e.target.style.boxShadow='none'; }} />
        <Hash size={15} style={{ position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',color:T.textHint }} />
      </div>
      {tolerance&&tolerance>0&&<p style={{ fontSize:11,color:T.textMuted,marginTop:5 }}>Tolerance: ±{tolerance}</p>}
    </div>
  );
};

const MatchingWidget = ({ pairs, answers, onChange, disabled }:{ pairs:MatchingPair[]; answers:{left:string;right:string;}[]; onChange:(a:{left:string;right:string;}[])=>void; disabled?:boolean }) => {
  const [rights,setRights]=useState<string[]>([]);
  const [matches,setMatches]=useState<Map<string,string>>(new Map());
  const [dragged,setDragged]=useState<string|null>(null);
  useEffect(()=>{ const r=pairs.map(p=>p.right); setRights([...r].sort(()=>Math.random()-0.5)); const m=new Map<string,string>(); answers.forEach(a=>m.set(a.left,a.right)); setMatches(m); },[pairs]);
  const doMatch=(left:string,right:string)=>{ if(disabled) return; const m=new Map(matches); m.forEach((v,k)=>{ if(v===right) m.delete(k); }); m.set(left,right); setMatches(m); onChange(Array.from(m.entries()).map(([l,r])=>({left:l,right:r}))); };
  return (
    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,maxWidth:640 }}>
      <div>
        <p style={{ fontSize:11,fontWeight:700,color:T.textMuted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8 }}>Items</p>
        {pairs.map((p,i)=>{ const matched=matches.has(p.left); return (
          <div key={i} draggable={!disabled} onDragStart={()=>setDragged(p.left)} onDragEnd={()=>setDragged(null)}
            style={{ padding:'10px 14px',marginBottom:6,borderRadius:10,border:`1.5px solid ${matched?T.green:T.border}`,background:matched?T.greenLight:T.bg,cursor:disabled?'default':'grab',display:'flex',alignItems:'center',gap:8,fontSize:13,color:T.textMain,opacity:dragged===p.left?0.45:1 }}>
            <GripVertical size={13} style={{ color:T.textHint,flexShrink:0 }} />
            <span style={{ flex:1 }}>{p.left}</span>
            {matched&&<span style={{ fontSize:10,color:T.greenDark,fontWeight:600 }}>✓</span>}
          </div>
        ); })}
      </div>
      <div>
        <p style={{ fontSize:11,fontWeight:700,color:T.textMuted,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8 }}>Match to</p>
        {rights.map((r,i)=>{ const ml=Array.from(matches.entries()).find(([,v])=>v===r)?.[0]; return (
          <div key={i} onDragOver={e=>e.preventDefault()} onDrop={()=>{ if(dragged&&!disabled) doMatch(dragged,r); }}
            style={{ padding:'10px 14px',marginBottom:6,borderRadius:10,border:`1.5px solid ${ml?T.green:T.border}`,background:ml?T.greenLight:T.pageBg,cursor:disabled?'default':'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,fontSize:13,color:T.textMain }}
            onClick={()=>{ if(disabled) return; const free=pairs.map(p=>p.left).find(l=>!matches.has(l)); if(free) doMatch(free,r); }}>
            <span>{r}</span>
            {ml&&<span style={{ fontSize:11,color:T.greenDark,fontWeight:600 }}>← {ml}</span>}
          </div>
        ); })}
      </div>
      {!disabled&&<button onClick={()=>{ setMatches(new Map()); onChange([]); }} style={{ gridColumn:'1 / -1',border:'none',background:'none',color:T.textMuted,fontSize:12,cursor:'pointer',textAlign:'left',fontFamily:'inherit',padding:'4px 0' }}>↺ Clear all matches</button>}
    </div>
  );
};

const OrderingWidget = ({ items, answers, onChange, disabled }:{ items:OrderingItem[]; answers:{itemId:string;order:number;}[]; onChange:(a:{itemId:string;order:number;}[])=>void; disabled?:boolean }) => {
  const [ordered,setOrdered]=useState<OrderingItem[]>([]);
  const [dragIdx,setDragIdx]=useState<number|null>(null);
  useEffect(()=>{ if(answers.length>0){ const s=[...items].sort((a,b)=>{ const aa=answers.find(x=>x.itemId===a._id); const bb=answers.find(x=>x.itemId===b._id); return (aa?.order||0)-(bb?.order||0); }); setOrdered(s); } else { setOrdered([...items].sort((a,b)=>a.order-b.order)); } },[items]);
  const handleDragOver=(e:React.DragEvent,idx:number)=>{ e.preventDefault(); if(dragIdx===null||disabled) return; const arr=[...ordered]; const [item]=arr.splice(dragIdx,1); arr.splice(idx,0,item); setOrdered(arr); setDragIdx(idx); };
  return (
    <div style={{ maxWidth:520 }}>
      {ordered.map((item,i)=>(
        <div key={item._id} draggable={!disabled} onDragStart={()=>setDragIdx(i)} onDragOver={e=>handleDragOver(e,i)}
          onDragEnd={()=>{ setDragIdx(null); onChange(ordered.map((it,idx)=>({itemId:it._id,order:idx+1}))); }}
          style={{ display:'flex',alignItems:'center',gap:12,padding:'11px 14px',marginBottom:6,borderRadius:10,border:`1.5px solid ${T.border}`,background:T.bg,cursor:disabled?'default':'grab',opacity:dragIdx===i?0.45:1,fontSize:13,color:T.textMain }}>
          <GripVertical size={15} style={{ color:T.textHint,flexShrink:0 }} />
          <span style={{ flex:1 }}>{item.text}</span>
          <span style={{ width:24,height:24,borderRadius:6,flexShrink:0,background:T.orangeLight,color:T.orange,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700 }}>#{i+1}</span>
        </div>
      ))}
    </div>
  );
};

// ── Dialogs ───────────────────────────────────────────────────────────────
const TimeUpDialog = ({ onConfirm }:{ onConfirm:()=>void }) => (
  <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16 }}>
    <div style={{ background:T.bg,borderRadius:20,padding:'40px 32px',maxWidth:380,width:'100%',textAlign:'center' }}>
      <div style={{ width:64,height:64,borderRadius:20,background:T.redLight,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px' }}><Timer size={28} style={{ color:T.red }} /></div>
      <h3 style={{ fontSize:20,fontWeight:800,color:T.textMain,marginBottom:8 }}>Time's Up!</h3>
      <p style={{ fontSize:14,color:T.textSub,marginBottom:24,lineHeight:1.6 }}>The allotted time has expired. Your answers will be automatically submitted.</p>
      <button onClick={onConfirm} style={{ padding:'12px 28px',borderRadius:12,background:T.red,color:'#fff',fontSize:14,fontWeight:700,border:'none',cursor:'pointer',fontFamily:'inherit' }}>View Results</button>
    </div>
  </div>
);

const SubmitDialog = ({ unansweredCount,flaggedCount,unansweredIndices,flaggedIndices,requiredUnansweredIndices,onConfirm,onCancel,onNavigateToQuestion }:{
  unansweredCount:number; flaggedCount:number; unansweredIndices:number[]; flaggedIndices:number[];
  requiredUnansweredIndices:number[]; onConfirm:()=>void; onCancel:()=>void; onNavigateToQuestion:(i:number)=>void;
}) => {
  const [expanded,setExpanded]=useState<string|null>(null);
  const req=requiredUnansweredIndices.length;
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200,padding:16 }}>
      <div style={{ background:T.bg,borderRadius:20,maxWidth:420,width:'100%',overflow:'hidden' }}>
        <div style={{ padding:'20px 24px',borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:'flex',alignItems:'center',gap:12 }}>
            <div style={{ width:40,height:40,borderRadius:12,background:T.orangeLight,display:'flex',alignItems:'center',justifyContent:'center' }}><AlertCircle size={18} style={{ color:T.orange }} /></div>
            <div>
              <h3 style={{ fontSize:16,fontWeight:800,color:T.textMain,margin:0 }}>Submit Assessment?</h3>
              <p style={{ fontSize:12,color:T.textMuted,margin:'2px 0 0' }}>{req>0?`${req} required question(s) unanswered`:'Review before submitting'}</p>
            </div>
          </div>
        </div>
        <div style={{ padding:'16px 24px',maxHeight:'55vh',overflowY:'auto' }}>
          {[
            { key:'required',items:requiredUnansweredIndices,label:'Required Unanswered',color:T.red,bg:T.redLight },
            { key:'unanswered',items:unansweredIndices,label:'Unanswered',color:T.orange,bg:T.orangeLight },
            { key:'flagged',items:flaggedIndices,label:'Flagged',color:T.amber,bg:T.amberLight },
          ].filter(s=>s.items.length>0).map(sec=>(
            <div key={sec.key} style={{ marginBottom:10 }}>
              <button onClick={()=>setExpanded(expanded===sec.key?null:sec.key)}
                style={{ width:'100%',padding:'10px 14px',borderRadius:10,background:sec.bg,border:'none',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                <span style={{ fontSize:13,fontWeight:600,color:sec.color }}>{sec.label} ({sec.items.length})</span>
                {expanded===sec.key?<ChevronUp size={14} style={{ color:sec.color }} />:<ChevronDown size={14} style={{ color:sec.color }} />}
              </button>
              {expanded===sec.key&&(
                <div style={{ display:'flex',flexWrap:'wrap',gap:6,padding:'12px 0 4px' }}>
                  {sec.items.map(idx=>(
                    <button key={idx} onClick={()=>{ onNavigateToQuestion(idx); onCancel(); }}
                      style={{ width:36,height:36,borderRadius:8,border:`1px solid ${sec.color}40`,background:sec.bg,color:sec.color,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
                      {idx+1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding:'16px 24px',borderTop:`1px solid ${T.border}`,display:'flex',gap:10 }}>
          <button onClick={onCancel} style={{ flex:1,padding:'12px',borderRadius:12,border:`1.5px solid ${T.border}`,background:'transparent',color:T.textSub,fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>Keep reviewing</button>
          <button onClick={onConfirm} disabled={req>0} style={{ flex:1,padding:'12px',borderRadius:12,border:'none',background:req>0?T.pageBg:T.orange,color:req>0?T.textHint:'#fff',fontSize:14,fontWeight:700,cursor:req>0?'not-allowed':'pointer',fontFamily:'inherit' }}>Submit now</button>
        </div>
      </div>
    </div>
  );
};

const CompletionScreen = ({ onClose, timeUp }:{ onClose:()=>void; timeUp?:boolean }) => (
  <div style={{ minHeight:'calc(100vh * var(--ui-scale-inv, 1))',background:T.pageBg,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
    <div style={{ textAlign:'center',maxWidth:360 }}>
      <div style={{ width:80,height:80,borderRadius:24,margin:'0 auto 24px',background:timeUp?T.redLight:T.orangeLight,display:'flex',alignItems:'center',justifyContent:'center' }}>
        {timeUp?<Timer size={36} style={{ color:T.red }} />:<CheckCircle size={36} style={{ color:T.orange }} />}
      </div>
      <h2 style={{ fontSize:26,fontWeight:800,color:T.textMain,marginBottom:10 }}>{timeUp?"Time's Up!":'All done!'}</h2>
      <p style={{ fontSize:14,color:T.textSub,marginBottom:32,lineHeight:1.6 }}>{timeUp?'Your answers were automatically submitted.':'Your assessment has been submitted successfully.'}</p>
      <button onClick={onClose} style={{ padding:'14px 36px',borderRadius:14,background:T.orange,color:'#fff',fontSize:15,fontWeight:700,border:'none',cursor:'pointer',fontFamily:'inherit',boxShadow:`0 4px 16px ${T.orangeGlow}` }}>Return to Course</button>
    </div>
  </div>
);

const LoadingScreen = () => (
  <div style={{ minHeight:'calc(100vh * var(--ui-scale-inv, 1))',background:T.pageBg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16 }}>
    <div style={{ width:44,height:44,borderRadius:'50%',border:`3px solid ${T.border}`,borderTopColor:T.orange,animation:'spin 0.7s linear infinite' }} />
    <p style={{ fontSize:14,color:T.textMuted,fontFamily:'inherit' }}>Loading assessment…</p>
    <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
  </div>
);

// ── Right panel ───────────────────────────────────────────────────────────
const QuestionPanel = ({
  questions,currentIndex,answers,flaggedQuestions,onJump,
  selectedDifficulty,onDifficultyChange,difficultyCounts,
  timeLeft,totalDuration,questionFilter,onFilterChange,filterCounts,hasRequiredQuestions,
}:{
  questions:MCQQuestion[]; currentIndex:number; answers:Map<string,Answer>;
  flaggedQuestions:Set<number>; onJump:(i:number)=>void;
  selectedDifficulty:string|null; onDifficultyChange:(d:string|null)=>void;
  difficultyCounts:{easy:number;medium:number;hard:number;total:number};
  timeLeft?:number; totalDuration?:number;
  questionFilter:FilterType; onFilterChange:(f:FilterType)=>void;
  filterCounts:Record<string,number>; hasRequiredQuestions:boolean;
}) => {
  const isAnswered=(q:MCQQuestion)=>{
    switch(q.mcqQuestionType){
      case 'multiple_select': return Array.from(answers.values()).some(a=>a?.questionId===q._id);
      case 'short_answer': case 'essay': { const a=answers.get(q._id); return !!(a?.textAnswer?.trim()); }
      case 'true_false': return answers.get(q._id)?.booleanAnswer!==undefined;
      case 'numeric': return answers.get(q._id)?.numericAnswer!==undefined;
      case 'matching': { const a=answers.get(q._id); return !!(a?.matchingAnswers?.length); }
      case 'ordering': { const a=answers.get(q._id); return !!(a?.orderingAnswers?.length); }
      default: return answers.has(q._id);
    }
  };
  const getStatus=(idx:number)=>{
    const q=questions[idx]; const ans=isAnswered(q); const flagged=flaggedQuestions.has(idx);
    if(ans&&flagged) return 'answeredFlagged';
    if(q.mcqQuestionRequired&&!ans) return 'required';
    if(ans) return 'answered'; if(flagged) return 'flagged'; return 'unanswered';
  };
  const filtered=questions.map((q,i)=>({q,i})).filter(({i})=>{ const s=getStatus(i); return questionFilter==='all'||s===questionFilter; });
  const fmtTime=(s:number)=>{ if(s<=0) return '00:00'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; if(h>0) return `${h}h ${m}m`; return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
  const timerPct=totalDuration&&timeLeft!==undefined?Math.max(0,(timeLeft/(totalDuration*60))*100):0;
  const td=(timeLeft||0)<60; const tw=(timeLeft||0)<300&&!td;
  const tcol=td?T.red:tw?T.amber:T.green;
  const chip=(key:string,lbl:string,cnt:number,col:string)=>(
    <button key={key} onClick={()=>onFilterChange(key as FilterType)}
      style={{ padding:'4px 10px',borderRadius:99,fontSize:12,fontWeight:600,cursor:'pointer',border:`1.5px solid ${questionFilter===key?col:T.border}`,background:questionFilter===key?col+'18':'transparent',color:questionFilter===key?col:T.textMuted,fontFamily:'inherit',display:'flex',alignItems:'center',gap:4,flexShrink:0 }}>
      {lbl}
      <span style={{ minWidth:17,height:17,borderRadius:99,padding:'0 4px',background:questionFilter===key?col:T.pageBg,color:questionFilter===key?'#fff':T.textMuted,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center' }}>{cnt}</span>
    </button>
  );

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:0 }}>
      {/* Timer */}
      {timeLeft!==undefined&&(totalDuration||0)>0&&(
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5 }}>
            <div style={{ display:'flex',alignItems:'center',gap:5 }}><Timer size={13} style={{ color:tcol }} /><span style={{ fontSize:12,color:T.textMuted,fontWeight:600 }}>Time Left</span></div>
            <span style={{ fontFamily:'monospace',fontSize:15,fontWeight:800,color:tcol,animation:td?'pulse 1s ease-in-out infinite':'none' }}>{fmtTime(timeLeft)}</span>
          </div>
          <div style={{ height:4,borderRadius:99,background:T.borderLight,overflow:'hidden' }}>
            <div style={{ height:'100%',width:`${timerPct}%`,background:tcol,borderRadius:99,transition:'width 1s linear' }} />
          </div>
        </div>
      )}
      <select value={selectedDifficulty??''} onChange={e=>onDifficultyChange(e.target.value||null)}
        style={{ width:'100%',padding:'8px 10px',borderRadius:9,border:`1.5px solid ${T.border}`,background:T.bg,fontSize:12,color:T.textSub,fontFamily:'inherit',outline:'none',marginBottom:10,cursor:'pointer' }}>
        <option value="">All difficulties</option>
        <option value="easy">Easy ({difficultyCounts.easy})</option>
        <option value="medium">Medium ({difficultyCounts.medium})</option>
        <option value="hard">Hard ({difficultyCounts.hard})</option>
      </select>
      <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginBottom:10 }}>
        {chip('all','All',filterCounts.all,T.textSub)}
        {chip('answered','Done',filterCounts.answered,T.green)}
        {chip('flagged','⚑',filterCounts.flagged,T.amber)}
        {chip('answeredFlagged','✓⚑',filterCounts.answeredFlagged,T.orange)}
        {hasRequiredQuestions&&chip('required','Req',filterCounts.required,T.red)}
      </div>
      <div style={{ height:1,background:T.borderLight,marginBottom:10 }} />
      <p style={{ fontSize:12,color:T.textMuted,fontWeight:700,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.05em' }}>{filtered.length} / {questions.length} questions</p>
      {filtered.length>0?(
        <div style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:5 }}>
          {filtered.map(({q,i})=>{
            const status=getStatus(i); const isCurrent=i===currentIndex; const isFlagged=flaggedQuestions.has(i);
            let bg=T.pageBg,col=T.textSub,bdr=T.border;
            if(isCurrent)                      { bg=T.blue;        col='#fff';      bdr=T.blue; }
            else if(status==='answered')        { bg=T.greenLight;  col=T.greenDark; bdr=T.green+'80'; }
            else if(status==='flagged')         { bg=T.amberLight;  col=T.amber;     bdr=T.amber+'80'; }
            else if(status==='answeredFlagged') { bg=T.orangeLight; col=T.orange;    bdr=T.orange+'80'; }
            else if(status==='required')        { bg=T.redLight;    col=T.red;       bdr=T.red+'80'; }
            return (
              <button key={q._id} onClick={()=>onJump(i)}
                style={{ aspectRatio:'1',borderRadius:8,border:`1.5px solid ${bdr}`,background:bg,color:col,fontSize:12,fontWeight:700,cursor:'pointer',position:'relative',fontFamily:'inherit',transition:'all 0.12s' }}>
                {i+1}
                {isFlagged&&<span style={{ position:'absolute',top:-5,right:-5,fontSize:10,lineHeight:1,color:T.amber,filter:'drop-shadow(0 0 2px rgba(245,158,11,0.5))' }}>⚑</span>}
                {q.mcqQuestionRequired&&status!=='answered'&&status!=='answeredFlagged'&&<span style={{ position:'absolute',bottom:-3,left:-3,width:8,height:8,borderRadius:'50%',background:T.red,border:`2px solid ${T.bg}` }} />}
              </button>
            );
          })}
        </div>
      ):(
        <div style={{ textAlign:'center',paddingTop:16 }}>
          <p style={{ fontSize:12,color:T.textHint }}>No questions match</p>
          <button onClick={()=>onFilterChange('all')} style={{ marginTop:6,fontSize:12,color:T.orange,background:'none',border:'none',cursor:'pointer',fontFamily:'inherit' }}>Clear filter</button>
        </div>
      )}
      <div style={{ marginTop:12,paddingTop:10,borderTop:`1px solid ${T.borderLight}`,display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px 12px' }}>
        {[{dot:T.blue,lbl:'Current'},{dot:T.green,lbl:'Answered'},{dot:T.amber,lbl:'Flagged'},{dot:T.orange,lbl:'Ans+Flag',op:0.55},{dot:T.red,lbl:'Required'}].map(({dot,lbl,op})=>(
          <div key={lbl} style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ width:8,height:8,borderRadius:'50%',background:dot,opacity:op||1,flexShrink:0 }} />
            <span style={{ fontSize:11,color:T.textSub }}>{lbl}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// MAIN MCQ COMPONENT
// ─────────────────────────────────────────────────────────────────────────
interface MCQProps {
  exercise?:any; courseId?:string; courseName?:string; nodeId?:string; nodeName?:string;
  nodeType?:string; onCloseExercise?:()=>void; category?:string; subcategory?:string;
  studentId?:string; moduleName?:string; topicName?:string; hierarchy?:string[];
}

const MCQ = ({ exercise:propExercise, courseId='', courseName='Course', nodeId='', nodeName='', nodeType='', onCloseExercise, category='Course', subcategory='Assessment', hierarchy=[] }:MCQProps) => {
  const router=useRouter();
  const searchParams=useSearchParams();

  const [currentQuestionIndex,setCurrentQuestionIndex]=useState(0);
  const [questions,setQuestions]=useState<MCQQuestion[]>([]);
  const [filteredQuestions,setFilteredQuestions]=useState<MCQQuestion[]>([]);
  const [selectedDifficulty,setSelectedDifficulty]=useState<string|null>(null);
  const [questionFilter,setQuestionFilter]=useState<FilterType>('all');
  const [selectedRadioOption,setSelectedRadioOption]=useState<string|null>(null);
  const [selectedCheckboxOptions,setSelectedCheckboxOptions]=useState<Set<string>>(new Set());
  const [selectedDropdownOption,setSelectedDropdownOption]=useState<string|null>(null);
  const [trueFalseValue,setTrueFalseValue]=useState<boolean|null>(null);
  const [shortAnswerText,setShortAnswerText]=useState('');
  const [essayText,setEssayText]=useState('');
  const [numericValue,setNumericValue]=useState<number|null>(null);
  const [matchingAnswers,setMatchingAnswers]=useState<{left:string;right:string;}[]>([]);
  const [orderingAnswers,setOrderingAnswers]=useState<{itemId:string;order:number;}[]>([]);
  const [quizStarted,setQuizStarted]=useState(false);
  const [quizCompleted,setQuizCompleted]=useState(false);
  const [isSubmitting,setIsSubmitting]=useState(false);
  const [showSubmitDialog,setShowSubmitDialog]=useState(false);
  const [showTimeUpDialog,setShowTimeUpDialog]=useState(false);
  const [answers,setAnswers]=useState<Map<string,Answer>>(new Map());
  const [flaggedQuestions,setFlaggedQuestions]=useState<Set<number>>(new Set());
  const [loading,setLoading]=useState(true);
  const [exerciseData,setExerciseData]=useState<ExerciseData|null>(null);
  const [timeLeft,setTimeLeft]=useState(0);
  const [totalDuration,setTotalDuration]=useState(0);
  const timerRef=useRef<NodeJS.Timeout|null>(null);
  const answersRef=useRef<Map<string,Answer>>(new Map());
  const scrollRef=useRef<HTMLDivElement>(null);

  const urlCourseId=searchParams.get('courseId');
  const urlExerciseId=searchParams.get('exerciseId');
  const urlExerciseName=searchParams.get('exerciseName');
  const urlSubcategory=searchParams.get('subcategory');
  const urlCategory=searchParams.get('category');

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  
  const startTimer=(duration:number)=>{
    if(timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(duration*60);
    timerRef.current=setInterval(()=>{ setTimeLeft(prev=>{ if(prev<=1){ clearInterval(timerRef.current!); handleTimeUp(); return 0; } return prev-1; }); },1000);
  };

  const handleTimeUp = async () => {
    if (quizCompleted || isSubmitting) return;
    setIsSubmitting(true);
    await saveCurrentAnswer();
    await sendFinalSubmission();
    if (timerRef.current) clearInterval(timerRef.current);
    if (exerciseData?._id) {
      localStorage.removeItem(`mcq_answers_${exerciseData._id}`);
      localStorage.removeItem(`mcq_flagged_${exerciseData._id}`);
    }
    setQuizCompleted(true);
    try { sessionStorage.setItem('lms_submit_toast', `Time's up! "${exerciseTitle}" submitted successfully.`); } catch {}
    setTimeout(() => { if (onCloseExercise) onCloseExercise(); else router.back(); }, 1000);
  };

  const sendFinalSubmission = async () => {
    try {
      const token = getToken() || localStorage.getItem('token') || '';
      const fCId = urlCourseId || courseId;
      if (!fCId || !exerciseData?._id) return;

      const lastQ = questions[questions.length - 1];
      if (!lastQ) return;

      const fd = new FormData();
      fd.append('courseId', fCId);
      fd.append('exerciseId', exerciseData._id);
      fd.append('questionId', lastQ._id);
      fd.append('code', '');
      fd.append('score', '0');
      fd.append('status', 'submitted');
      fd.append('category', urlCategory || category);
      fd.append('subcategory', urlSubcategory || subcategory);
      fd.append('nodeId', nodeId || '');
      fd.append('nodeName', exerciseData.exerciseInformation?.exerciseName || 'MCQ Assessment');
      fd.append('nodeType', nodeType || 'mcq');
      fd.append('language', 'text');
      fd.append('isTestSubmission', 'true');

      await fetch('http://localhost:5533/courses/answers/submit', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      });
    } catch (e) {
      console.error('Error sending final submission flag:', e);
    }
  };

  useEffect(()=>{
    const fetch_=async()=>{
      try{
        setLoading(true);
        const finalId=urlExerciseId||propExercise?._id;
        if(!finalId){ toast.error('Exercise ID is required'); setLoading(false); return; }
        const token=getToken()||localStorage.getItem('token')||'';
        const res=await fetch(`http://localhost:5533/exercise/${finalId}`,{ method:'GET',headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'} });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const data=await res.json();
        if(data.message?.[0]?.key==='success'&&data.data?.exercise){
          const ex=data.data.exercise as ExerciseData;
          setExerciseData(ex);
          const dur=ex.exerciseInformation?.totalDuration||0;
          setTotalDuration(dur); if(dur>0) startTimer(dur);
          let qs=[...ex.questions];
          if(ex.questionConfiguration?.mcqQuestionConfiguration?.shuffleQuestions) qs=qs.sort(()=>Math.random()-0.5);
          setQuestions(qs); setFilteredQuestions(qs);
          const saved=localStorage.getItem(`mcq_answers_${finalId}`);
          if(saved){ try{ const m=new Map(Object.entries(JSON.parse(saved))) as Map<string,Answer>; answersRef.current=m; setAnswers(m); if(qs[0]) loadAnswersForQuestion(qs[0],m); }catch(e){} }
          const savedF=localStorage.getItem(`mcq_flagged_${finalId}`);
          if(savedF){ try{ setFlaggedQuestions(new Set(JSON.parse(savedF))); }catch(e){} }
          setQuizStarted(true);
        }
      }catch(e){
        toast.error('Failed to load assessment');
        if(propExercise){ let qs=[...propExercise.questions]; if(propExercise.questionConfiguration?.mcqQuestionConfiguration?.shuffleQuestions) qs=qs.sort(()=>Math.random()-0.5); setQuestions(qs); setFilteredQuestions(qs); const d=propExercise.exerciseInformation?.totalDuration||0; setTotalDuration(d); if(d>0) startTimer(d); setQuizStarted(true); setExerciseData(propExercise); }
      }finally{ setLoading(false); }
    };
    fetch_();
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current); };
  },[urlExerciseId,propExercise]);

  const loadAnswersForQuestion=(q:MCQQuestion,map:Map<string,Answer>)=>{
    setSelectedRadioOption(null); setSelectedCheckboxOptions(new Set()); setSelectedDropdownOption(null); setTrueFalseValue(null); setShortAnswerText(''); setEssayText(''); setNumericValue(null); setMatchingAnswers([]); setOrderingAnswers([]);
    const a=map.get(q._id);
    switch(q.mcqQuestionType){
      case 'multiple_choice': setSelectedRadioOption(a?.optionId||null); break;
      case 'multiple_select': { const s=new Set<string>(); map.forEach(v=>{ if(v?.questionId===q._id) s.add(v.optionId||''); }); setSelectedCheckboxOptions(s); break; }
      case 'dropdown': setSelectedDropdownOption(a?.optionId||null); break;
      case 'true_false': setTrueFalseValue(a?.booleanAnswer??null); break;
      case 'short_answer': setShortAnswerText(a?.textAnswer||''); break;
      case 'essay': setEssayText(a?.textAnswer||''); break;
      case 'numeric': setNumericValue(a?.numericAnswer??null); break;
      case 'matching': setMatchingAnswers(Array.isArray(a?.matchingAnswers)?a!.matchingAnswers!:[]); break;
      case 'ordering': setOrderingAnswers(Array.isArray(a?.orderingAnswers)?a!.orderingAnswers!:[]); break;
    }
    if(scrollRef.current) scrollRef.current.scrollTop=0;
  };

  useEffect(()=>{
    if(selectedDifficulty){ const f=questions.filter(q=>q.mcqQuestionDifficulty===selectedDifficulty); setFilteredQuestions(f); if(currentQuestionIndex>=f.length){ setCurrentQuestionIndex(0); if(f.length>0) loadAnswersForQuestion(f[0],answersRef.current); } }
    else { setFilteredQuestions(questions); }
  },[selectedDifficulty,questions]);

  const persistAnswers=(updated:Map<string,Answer>)=>{ setAnswers(updated); answersRef.current=updated; if(exerciseData?._id) localStorage.setItem(`mcq_answers_${exerciseData._id}`,JSON.stringify(Object.fromEntries(updated))); };

  const handleOptionSelect=(optionId:string)=>{
    if(quizCompleted) return;
    const q=filteredQuestions[currentQuestionIndex];
    const marks=exerciseData?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion||q.mcqQuestionScore||10;
    if(q.mcqQuestionType==='multiple_choice'){
      setSelectedRadioOption(optionId); const opt=q.mcqQuestionOptions.find(o=>o._id===optionId); if(!opt) return;
      const ic=opt.isCorrect===true; const m=new Map(answers); m.set(q._id,{questionId:q._id,optionId:opt._id,optionText:opt.text,isCorrect:ic,score:ic?marks:0,status:ic?'solved':'attempted'}); persistAnswers(m);
    } else if(q.mcqQuestionType==='multiple_select'){
      setSelectedCheckboxOptions(prev=>{ const next=new Set(prev); const m=new Map(answers); if(next.has(optionId)){ next.delete(optionId); m.forEach((v,k)=>{ if(v.questionId===q._id&&v.optionId===optionId) m.delete(k); }); } else { next.add(optionId); const opt=q.mcqQuestionOptions.find(o=>o._id===optionId); if(opt){ const ic=opt.isCorrect; m.set(`${q._id}_${optionId}`,{questionId:q._id,optionId:opt._id,optionText:opt.text,isCorrect:ic,score:ic?marks:0,status:'attempted'}); } } persistAnswers(m); return next; });
    } else if(q.mcqQuestionType==='dropdown'){
      setSelectedDropdownOption(optionId); const opt=q.mcqQuestionOptions.find(o=>o._id===optionId); if(!opt) return;
      const ic=opt.isCorrect===true; const m=new Map(answers); m.set(q._id,{questionId:q._id,optionId:opt._id,optionText:opt.text,isCorrect:ic,score:ic?marks:0,status:ic?'solved':'attempted'}); persistAnswers(m);
    }
  };

  const handleTrueFalseChange=(value:boolean)=>{ setTrueFalseValue(value); const q=filteredQuestions[currentQuestionIndex]; const ic=q.trueFalseAnswer===value; const marks=exerciseData?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion||q.mcqQuestionScore||10; const m=new Map(answers); m.set(q._id,{questionId:q._id,booleanAnswer:value,isCorrect:ic,score:ic?marks:0,status:ic?'solved':'attempted'}); persistAnswers(m); };
  const handleShortAnswerChange=(value:string)=>{ setShortAnswerText(value); const q=filteredQuestions[currentQuestionIndex]; const m=new Map(answers); if(!value.trim()) m.delete(q._id); else { const ic=gradeTextAnswer(value,q.shortAnswer||''); const marks=exerciseData?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion||q.mcqQuestionScore||10; m.set(q._id,{questionId:q._id,textAnswer:value,isCorrect:ic,score:ic?marks:0,status:ic?'solved':'attempted'}); } persistAnswers(m); };
  const handleEssayChange=(value:string)=>{ setEssayText(value); const q=filteredQuestions[currentQuestionIndex]; const m=new Map(answers); if(!value.trim()) m.delete(q._id); else { const ic=gradeTextAnswer(value,q.essayAnswer||q.shortAnswer||''); const marks=exerciseData?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion||q.mcqQuestionScore||10; m.set(q._id,{questionId:q._id,textAnswer:value,isCorrect:ic,score:ic?marks:0,status:ic?'solved':'attempted'}); } persistAnswers(m); };
  const handleNumericChange=(value:number)=>{ setNumericValue(value); const q=filteredQuestions[currentQuestionIndex]; const ca=q.numericAnswer||0; const tol=q.numericTolerance||0; const ic=Math.abs(value-ca)<=tol; const marks=exerciseData?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion||q.mcqQuestionScore||10; const m=new Map(answers); m.set(q._id,{questionId:q._id,numericAnswer:value,isCorrect:ic,score:ic?marks:0,status:ic?'solved':'attempted'}); persistAnswers(m); };
  const handleMatchingChange=(na:{left:string;right:string;}[])=>{ setMatchingAnswers(na); const q=filteredQuestions[currentQuestionIndex]; const correct=q.matchingPairs||[]; let ok=na.length===correct.length; if(ok) for(const p of correct){ const match=na.find(a=>a.left===p.left); if(!match||match.right!==p.right){ok=false;break;} } const marks=exerciseData?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion||q.mcqQuestionScore||10; const m=new Map(answers); m.set(q._id,{questionId:q._id,matchingAnswers:na,isCorrect:ok,score:ok?marks:0,status:na.length>0?(ok?'solved':'attempted'):'skipped'}); persistAnswers(m); };
  const handleOrderingChange=(na:{itemId:string;order:number;}[])=>{ setOrderingAnswers(na); const q=filteredQuestions[currentQuestionIndex]; const correct=q.orderingItems||[]; let ok=na.length===correct.length; if(ok) for(let i=0;i<na.length;i++){ const item=correct.find(it=>it._id===na[i].itemId); if(!item||item.order!==na[i].order){ok=false;break;} } const marks=exerciseData?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion||q.mcqQuestionScore||10; const m=new Map(answers); m.set(q._id,{questionId:q._id,orderingAnswers:na,isCorrect:ok,score:ok?marks:0,status:na.length>0?(ok?'solved':'attempted'):'skipped'}); persistAnswers(m); };

  const toggleFlag=(index:number)=>{ const actual=filteredQuestions[index]; const ai=questions.findIndex(q=>q._id===actual._id); setFlaggedQuestions(prev=>{ const next=new Set(prev); next.has(ai)?next.delete(ai):next.add(ai); if(exerciseData?._id) localStorage.setItem(`mcq_flagged_${exerciseData._id}`,JSON.stringify([...next])); return next; }); };

  const saveCurrentAnswer=async()=>{
    if(!filteredQuestions[currentQuestionIndex]||!exerciseData) return;
    const q=filteredQuestions[currentQuestionIndex];
    try{
      const token=getToken()||localStorage.getItem('token')||'';
      const fCId=urlCourseId||courseId; const fCat=urlCategory||category; const fSub=urlSubcategory||subcategory;
      if(!fCId||!exerciseData._id) return;
      const marks=exerciseData.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion||q.mcqQuestionScore||10;
      const sub=async(fd:FormData)=>{ await fetch('http://localhost:5533/courses/answers/submit',{method:'POST',headers:{'Authorization':`Bearer ${token}`},body:fd}); };
      const base=(nt:string,lang:string)=>{ const fd=new FormData(); fd.append('courseId',fCId); fd.append('exerciseId',exerciseData._id); fd.append('questionId',q._id); fd.append('category',fCat); fd.append('subcategory',fSub); fd.append('nodeId',nodeId||''); fd.append('nodeName',exerciseData.exerciseInformation?.exerciseName||'MCQ Assessment'); fd.append('nodeType',nt); fd.append('language',lang); return fd; };
      switch(q.mcqQuestionType){
        case 'multiple_choice': if(selectedRadioOption){ const opt=q.mcqQuestionOptions.find(o=>o._id===selectedRadioOption); if(opt){ const ic=opt.isCorrect===true; const fd=base('mcq','text'); fd.append('code',opt.text); fd.append('score',(ic?marks:0).toString()); fd.append('status',ic?'solved':'attempted'); await sub(fd); } } break;
        case 'multiple_select': if(selectedCheckboxOptions.size>0){ const selected=q.mcqQuestionOptions.filter(o=>selectedCheckboxOptions.has(o._id)); const correctOpts=q.mcqQuestionOptions.filter(o=>o.isCorrect===true); const allCorrect=correctOpts.length>0&&selected.length===correctOpts.length&&selected.every(o=>o.isCorrect===true); const fd=base('mcq','text'); fd.append('code',selected.map(o=>o.text).join(' || ')); fd.append('score',(allCorrect?marks:0).toString()); fd.append('status',allCorrect?'solved':'attempted'); await sub(fd); } break;
        case 'dropdown': if(selectedDropdownOption){ const opt=q.mcqQuestionOptions.find(o=>o._id===selectedDropdownOption); if(opt){ const ic=opt.isCorrect===true; const fd=base('mcq','text'); fd.append('code',opt.text); fd.append('score',(ic?marks:0).toString()); fd.append('status',ic?'solved':'attempted'); await sub(fd); } } break;
        case 'true_false': if(trueFalseValue!==null){ const ic=q.trueFalseAnswer===trueFalseValue; const fd=base('true_false','text'); fd.append('code',trueFalseValue?'true':'false'); fd.append('score',(ic?marks:0).toString()); fd.append('status',ic?'solved':'attempted'); await sub(fd); } break;
        case 'short_answer': if(shortAnswerText.trim()){ const ic=gradeTextAnswer(shortAnswerText,q.shortAnswer||''); const fd=base('short_answer','text'); fd.append('code',shortAnswerText); fd.append('score',(ic?marks:0).toString()); fd.append('status',ic?'solved':'attempted'); await sub(fd); } break;
        case 'essay': if(essayText.trim()){ const ic=gradeTextAnswer(essayText,q.essayAnswer||q.shortAnswer||''); const fd=base('essay','text'); fd.append('code',essayText); fd.append('score',(ic?marks:0).toString()); fd.append('status',ic?'solved':'attempted'); await sub(fd); } break;
        case 'numeric': if(numericValue!==null){ const ca=q.numericAnswer||0; const tol=q.numericTolerance||0; const ic=Math.abs(numericValue-ca)<=tol; const fd=base('numeric','text'); fd.append('code',numericValue.toString()); fd.append('score',(ic?marks:0).toString()); fd.append('status',ic?'solved':'attempted'); await sub(fd); } break;
        case 'matching': if(matchingAnswers.length>0){ const ok=gradeMatching(matchingAnswers,q.matchingPairs||[]); const fd=base('matching','json'); fd.append('code',JSON.stringify(matchingAnswers)); fd.append('score',(ok?marks:0).toString()); fd.append('status',ok?'solved':'attempted'); await sub(fd); } break;
        case 'ordering': if(orderingAnswers.length>0){ const ok=gradeOrdering(orderingAnswers,q.orderingItems||[]); const fd=base('ordering','json'); fd.append('code',JSON.stringify(orderingAnswers)); fd.append('score',(ok?marks:0).toString()); fd.append('status',ok?'solved':'attempted'); await sub(fd); } break;
      }
    }catch(e){ console.error('Error saving answer:',e); }
  };

  const isQuestionAnswered=(q:MCQQuestion):boolean=>{
    switch(q.mcqQuestionType){
      case 'multiple_select': return Array.from(answers.values()).some(a=>a?.questionId===q._id);
      case 'short_answer': case 'essay': { const a=answers.get(q._id); return !!(a?.textAnswer?.trim()); }
      case 'true_false': return answers.get(q._id)?.booleanAnswer!==undefined;
      case 'numeric': return answers.get(q._id)?.numericAnswer!==undefined;
      case 'matching': { const a=answers.get(q._id); return !!(a?.matchingAnswers?.length); }
      case 'ordering': { const a=answers.get(q._id); return !!(a?.orderingAnswers?.length); }
      default: return answers.has(q._id);
    }
  };

  const getAnsweredCount=()=>questions.filter(isQuestionAnswered).length;
  
  const submitQuiz = async () => {
    if (quizCompleted || isSubmitting) return;
    setIsSubmitting(true);
    setShowSubmitDialog(false);
    await saveCurrentAnswer();
    await sendFinalSubmission();
    if (timerRef.current) clearInterval(timerRef.current);
    if (exerciseData?._id) {
      localStorage.removeItem(`mcq_answers_${exerciseData._id}`);
      localStorage.removeItem(`mcq_flagged_${exerciseData._id}`);
    }
    setQuizCompleted(true);
    try { sessionStorage.setItem('lms_submit_toast', `"${exerciseTitle}" submitted successfully`); } catch {}
    setTimeout(() => { if (onCloseExercise) onCloseExercise(); else router.back(); }, 800);
  };
  
  const handleSubmitClick=()=>{ const ua=questions.length-getAnsweredCount(); if(ua>0) setShowSubmitDialog(true); else submitQuiz(); };
  const handlePrev=async()=>{ if(currentQuestionIndex<=0) return; await saveCurrentAnswer(); loadAnswersForQuestion(filteredQuestions[currentQuestionIndex-1],answersRef.current); setCurrentQuestionIndex(p=>p-1); };
  const handleNext=async()=>{ await saveCurrentAnswer(); if(currentQuestionIndex<filteredQuestions.length-1){ loadAnswersForQuestion(filteredQuestions[currentQuestionIndex+1],answersRef.current); setCurrentQuestionIndex(p=>p+1); } };
  const handleJumpToQuestion=async(index:number)=>{ if(index<0||index>=filteredQuestions.length) return; await saveCurrentAnswer(); loadAnswersForQuestion(filteredQuestions[index],answersRef.current); setCurrentQuestionIndex(index); setShowSubmitDialog(false); };
  const handleBack=()=>{ if(onCloseExercise) onCloseExercise(); else router.back(); };
  const handleTimeUpConfirm=()=>{ setShowTimeUpDialog(false); setQuizCompleted(true); };

  // Computed
  const difficultyCounts={ easy:questions.filter(q=>q.mcqQuestionDifficulty==='easy').length, medium:questions.filter(q=>q.mcqQuestionDifficulty==='medium').length, hard:questions.filter(q=>q.mcqQuestionDifficulty==='hard').length, total:questions.length };
  const unansweredIndices=filteredQuestions.map((q,i)=>({q,i})).filter(({q})=>!isQuestionAnswered(q)).map(({i})=>i);
  const requiredUnansweredIndices=filteredQuestions.map((q,i)=>({q,i})).filter(({q})=>!isQuestionAnswered(q)&&q.mcqQuestionRequired).map(({i})=>i);
  const hasRequiredUnanswered=requiredUnansweredIndices.length>0;
  const hasRequiredQuestions=questions.some(q=>q.mcqQuestionRequired);
  const flaggedIndices=Array.from(flaggedQuestions).filter(idx=>{ const q=questions[idx]; return q&&filteredQuestions.some(fq=>fq._id===q._id); }).map(idx=>filteredQuestions.findIndex(fq=>fq._id===questions[idx]._id)).filter(i=>i!==-1).sort((a,b)=>a-b);
  const answeredCount=getAnsweredCount();
  const unansweredCount=questions.length-answeredCount;
  const allAnswered=unansweredCount===0;
  const progressPct=Math.round((answeredCount/Math.max(1,questions.length))*100);
  const filterCounts={
    all:filteredQuestions.length,
    answered:filteredQuestions.filter(q=>{ const i=questions.findIndex(o=>o._id===q._id); return isQuestionAnswered(q)&&!flaggedQuestions.has(i); }).length,
    flagged:filteredQuestions.filter(q=>{ const i=questions.findIndex(o=>o._id===q._id); return !isQuestionAnswered(q)&&flaggedQuestions.has(i); }).length,
    answeredFlagged:filteredQuestions.filter(q=>{ const i=questions.findIndex(o=>o._id===q._id); return isQuestionAnswered(q)&&flaggedQuestions.has(i); }).length,
    required:filteredQuestions.filter(q=>{ const i=questions.findIndex(o=>o._id===q._id); return !isQuestionAnswered(q)&&q.mcqQuestionRequired; }).length,
  };
  const flaggedForSidebar=new Set(Array.from(flaggedQuestions).map(gi=>questions[gi]?._id).filter(id=>id&&filteredQuestions.some(q=>q._id===id)).map(id=>filteredQuestions.findIndex(q=>q._id===id)).filter(i=>i!==-1));

  if(loading) return <LoadingScreen />;
  if(quizCompleted) return <div style={{ minHeight:'calc(100vh * var(--ui-scale-inv, 1))', background:T.pageBg }}><ToastContainer position="top-right" /></div>;
  if(!quizStarted||filteredQuestions.length===0) return (
    <div style={{ minHeight:'calc(100vh * var(--ui-scale-inv, 1))',background:T.pageBg,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
      <div style={{ textAlign:'center',maxWidth:320 }}>
        <AlertCircle size={40} style={{ color:T.amber,marginBottom:16 }} />
        <h2 style={{ fontSize:20,fontWeight:800,color:T.textMain,marginBottom:8 }}>{selectedDifficulty?`No ${selectedDifficulty} questions`:'No Questions Found'}</h2>
        {selectedDifficulty&&<button onClick={()=>setSelectedDifficulty(null)} style={{ padding:'10px 24px',borderRadius:10,background:T.orange,color:'#fff',border:'none',cursor:'pointer',fontSize:14,fontWeight:600,fontFamily:'inherit' }}>Show All</button>}
      </div>
    </div>
  );

  const cq=filteredQuestions[currentQuestionIndex];
  const exerciseTitle=exerciseData?.exerciseInformation?.exerciseName||urlExerciseName||'Assessment';
  const finalCategory=urlCategory||category;
  const finalSubcategory=urlSubcategory||subcategory;
  const diff=DIFF_CFG[cq.mcqQuestionDifficulty]??{text:T.orange,bg:T.orangeLight,dot:T.orange};
  const qt=QTYPE_CFG[cq.mcqQuestionType]??{label:cq.mcqQuestionType,color:T.textMuted,bg:T.pageBg};
  const isFlagged=flaggedQuestions.has(questions.findIndex(q=>q._id===cq._id));
  const timerIsDanger=timeLeft<60; const timerIsWarning=timeLeft<300&&!timerIsDanger;
  const timerCol=timerIsDanger?T.red:timerIsWarning?T.amber:T.orange;
  const timerPct=totalDuration>0?Math.max(0,(timeLeft/(totalDuration*60))*100):100;
  const fmtClock=(s:number)=>{ if(s<=0) return '00:00'; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60; if(h>0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; };
  const getGridCols=()=>{ const p=cq.mcqQuestionOptionsPerRow||2; if(p===1) return 'repeat(1,1fr)'; if(p===3) return 'repeat(3,1fr)'; if(p===4) return 'repeat(4,1fr)'; return 'repeat(2,1fr)'; };
  const isLastQ=currentQuestionIndex>=filteredQuestions.length-1;

  return (
    <div style={{ position:'fixed',inset:0,background:T.pageBg,fontFamily:"'Poppins',-apple-system,BlinkMacSystemFont,sans-serif",color:T.textMain,display:'flex',flexDirection:'column',overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        *{box-sizing:border-box;}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.45;}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        .mcq-fade{animation:fadeIn 0.2s ease;}
        .mcq-s::-webkit-scrollbar{width:7px;}
        .mcq-s::-webkit-scrollbar-track{background:#e4e4ed;border-radius:99px;}
        .mcq-s::-webkit-scrollbar-thumb{background:#9b9bae;border-radius:99px;}
        .mcq-s::-webkit-scrollbar-thumb:hover{background:#6b6b7e;}
        .btn-prev:hover:not(:disabled){border-color:${T.orange}!important;color:${T.orange}!important;}
        .btn-next:hover{background:${T.orangeDark}!important;}
        .btn-flag:hover{border-color:${T.amber}!important;color:${T.amber}!important;background:${T.amberLight}!important;}
        .submit-ok:hover{filter:brightness(1.06);}
      `}</style>

      <ToastContainer position="top-right" />
      {showSubmitDialog&&<SubmitDialog unansweredCount={unansweredCount} flaggedCount={flaggedQuestions.size} unansweredIndices={unansweredIndices} flaggedIndices={flaggedIndices} requiredUnansweredIndices={requiredUnansweredIndices} onConfirm={submitQuiz} onCancel={()=>setShowSubmitDialog(false)} onNavigateToQuestion={handleJumpToQuestion} />}
      
      <ExerciseInfoModals
        exercise={exerciseData}
        showDetailsModal={showDetailsModal}
        setShowDetailsModal={setShowDetailsModal}
        showOverviewModal={showOverviewModal}
        setShowOverviewModal={setShowOverviewModal}
        solvedQuestions={new Set(
          questions
            .map((q, i) => ({ q, i }))
            .filter(({ q }) => isQuestionAnswered(q))
            .map(({ i }) => i)
        )}
      />

      {/* ═══ TOP BAR (fixed height) ═══ */}
      <div style={{ flexShrink:0,height:TOP_BAR_H,background:T.bg,borderBottom:`1px solid ${T.border}`,display:'flex',flexDirection:'column',zIndex:50 }}>
        <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',gap:12 }}>
          
          {/* Left — back + logo + breadcrumb */}
          <div style={{ display:'flex',alignItems:'center',gap:0,minWidth:0,flex:1 }}>
            <nav style={{ display:'flex',alignItems:'center',gap:0,minWidth:0,overflow:'hidden' }}>
              {[{label:courseName!=='Course'&&courseName?courseName:null},...hierarchy.map(seg=>({label:seg})),{label:finalCategory&&finalCategory!=='Course'?(finalCategory==='We_Do'?'We Do':finalCategory==='I_Do'?'I Do':finalCategory==='You_Do'?'You Do':finalCategory.replace(/_/g,' ')):null},{label:exerciseTitle,active:true}].filter(b=>b.label).map((b,i,arr)=>(
                <React.Fragment key={i}>
                  <span style={{ fontSize:12,fontWeight:b.active?700:500,color:b.active?T.orange:T.textSub,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:b.active?200:110 }}>{b.label}</span>
                  {i<arr.length-1&&<ChevronRight size={12} style={{ color:T.border,margin:'0 5px',flexShrink:0 }} />}
                </React.Fragment>
              ))}
            </nav>
          </div>

          {/* Right — buttons + timer + stats */}
          <div style={{ display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
            <ExerciseInfoButtons
              onDetailsClick={() => setShowDetailsModal(true)}
              onOverviewClick={() => setShowOverviewModal(true)}
              isGraded={exerciseData?.isGraded !== false}
            />

            <div style={{ width:1,height:18,background:T.border }} />

            {/* Stats — Total / Done / Left / Flagged */}
            {[
              {v:questions.length,    label:'Total',  col:T.textSub},
              {v:answeredCount,       label:'Done',   col:T.green},
              {v:unansweredCount,     label:'Left',   col:T.textMuted},
              {v:flaggedQuestions.size,label:'Flagged',col:T.amber}
            ].map(({v,label,col})=>(
              <div key={label} style={{ display:'flex',alignItems:'center',gap:3 }}>
                <span style={{ fontSize:14,fontWeight:800,color:col }}>{v}</span>
                <span style={{ fontSize:10,color:T.textHint,fontWeight:600 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Progress line */}
        <div style={{ height:2,background:T.borderLight }}>
          <div style={{ height:'100%',width:`${progressPct}%`,background:`linear-gradient(90deg,${T.orange},${T.orangeDark})`,transition:'width 0.5s ease' }} />
        </div>
      </div>

      {/* ═══ BODY ═══ */}
      <div style={{ flex:1,minHeight:0,overflow:'hidden',display:'flex' }}>

        {/* Left: Question column */}
        <div style={{ flex:1,minWidth:0,minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden' }}>

          {/* ── Sticky Q-meta row ── */}
          <div style={{ flexShrink:0,height:Q_META_H,background:T.bg,borderBottom:`1px solid ${T.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 28px',gap:10,zIndex:20 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ display:'flex',alignItems:'baseline',gap:2 }}>
                <span style={{ fontSize:10,color:T.textHint,fontWeight:700,letterSpacing:'0.05em' }}>Q</span>
                <span style={{ fontSize:26,fontWeight:900,color:T.orange,lineHeight:1,letterSpacing:'-0.03em',margin:'0 2px' }}>{currentQuestionIndex+1}</span>
                <span style={{ fontSize:12,color:T.textHint }}>/{filteredQuestions.length}</span>
              </div>
              <div style={{ width:1,height:18,background:T.border }} />
              <div style={{ display:'flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:99,background:diff.bg }}>
                <div style={{ width:5,height:5,borderRadius:'50%',background:diff.dot }} />
                <span style={{ fontSize:10,fontWeight:700,color:diff.text,textTransform:'capitalize' as const }}>{cq.mcqQuestionDifficulty}</span>
              </div>
              {cq.mcqQuestionType !== 'multiple_choice' && (
                <div style={{ padding:'3px 9px',borderRadius:99,background:qt.bg }}>
                  <span style={{ fontSize:10,fontWeight:700,color:qt.color }}>{qt.label}</span>
                </div>
              )}
              {exerciseData?.isGraded !== false && (
                <div style={{ display:'flex',alignItems:'center',gap:3,padding:'3px 9px',borderRadius:99,background:T.amberLight }}>
                  <Award size={10} style={{ color:T.amber }} />
                  <span style={{ fontSize:10,fontWeight:700,color:T.amber }}>{exerciseData?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion || cq.mcqQuestionScore} marks</span>
                </div>
              )}
              {cq.mcqQuestionRequired&&(
                <div style={{ display:'flex',alignItems:'center',gap:3,padding:'3px 9px',borderRadius:99,background:T.redLight }}>
                  <AlertCircle size={9} style={{ color:T.red }} />
                  <span style={{ fontSize:10,fontWeight:700,color:T.red }}>Required</span>
                </div>
              )}
            </div>
            <button onClick={()=>toggleFlag(currentQuestionIndex)} className="btn-flag"
              style={{ display:'flex',alignItems:'center',gap:6,padding:'6px 13px',borderRadius:99,border:`1.5px solid ${isFlagged?T.amber:T.border}`,background:isFlagged?T.amberLight:'transparent',color:isFlagged?T.amber:T.textMuted,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.13s' }}>
              <Flag size={12} fill={isFlagged?T.amber:'none'} />
              {isFlagged?'Flagged':'Flag'}
            </button>
          </div>

          {/* ── Scrollable question content ── */}
          <div ref={scrollRef} className="mcq-fade mcq-s" key={currentQuestionIndex}
            style={{ flex:1,minHeight:0,overflowY:'auto',padding:'24px 28px' }}>
            {/* Use the enhanced ContentBlockRenderer for the question title */}
            <div style={{ marginBottom:8 }}><ContentBlockRenderer title={cq.mcqQuestionTitle} /></div>
            {cq.mcqQuestionDescription && (
              <div style={{ display:'flex',gap:10,padding:'10px 14px',borderRadius:10,background:T.blueLight,border:`1px solid ${T.blue}20`,marginBottom:14 }}>
                <Info size={13} style={{ color:T.blue,flexShrink:0,marginTop:2 }} />
                <p style={{ fontSize:13,color:T.textSub,margin:0,lineHeight:1.6 }} dangerouslySetInnerHTML={{ __html: cq.mcqQuestionDescription }} />
              </div>
            )}
            <p style={{ fontSize:11,color:T.textHint,marginBottom:20,display:'flex',alignItems:'center',gap:5 }}>
              <HelpCircle size={11} style={{ color:T.textHint }} />
              {HINT_TEXT[cq.mcqQuestionType]??'Answer the question.'}
            </p>
            {/* Answer area */}
            {cq.mcqQuestionType==='true_false'&&<TrueFalse value={trueFalseValue} onChange={handleTrueFalseChange} disabled={quizCompleted} />}
            {cq.mcqQuestionType==='dropdown'&&<DropdownSelect options={cq.mcqQuestionOptions} selectedValue={selectedDropdownOption} onChange={handleOptionSelect} disabled={quizCompleted} />}
            {cq.mcqQuestionType==='short_answer'&&<ShortAnswerInput value={shortAnswerText} onChange={handleShortAnswerChange} disabled={quizCompleted} />}
            {cq.mcqQuestionType==='essay'&&<EssayInput value={essayText} onChange={handleEssayChange} disabled={quizCompleted} />}
            {cq.mcqQuestionType==='numeric'&&<NumericInput value={numericValue} onChange={handleNumericChange} tolerance={cq.numericTolerance} disabled={quizCompleted} />}
            {cq.mcqQuestionType==='matching'&&cq.matchingPairs&&<MatchingWidget pairs={cq.matchingPairs} answers={matchingAnswers} onChange={handleMatchingChange} disabled={quizCompleted} />}
            {cq.mcqQuestionType==='ordering'&&cq.orderingItems&&<OrderingWidget items={cq.orderingItems} answers={orderingAnswers} onChange={handleOrderingChange} disabled={quizCompleted} />}
            {(cq.mcqQuestionType==='multiple_choice'||cq.mcqQuestionType==='multiple_select')&&(
              <div style={{ display:'grid',gridTemplateColumns:getGridCols(),gap:10 }}>
                {cq.mcqQuestionOptions?.map((option,idx)=>(
                  cq.mcqQuestionType==='multiple_select'
                    ?<CheckboxOption key={option._id} option={option} checked={selectedCheckboxOptions.has(option._id)} onChange={()=>handleOptionSelect(option._id)} index={idx} disabled={quizCompleted} />
                    :<RadioOption key={option._id} option={option} checked={selectedRadioOption===option._id} onChange={()=>handleOptionSelect(option._id)} index={idx} disabled={quizCompleted} />
                ))}
              </div>
            )}
            <div style={{ height:20 }} />
          </div>
        </div>

        {/* Right: Compact question panel */}
        <div style={{ flexShrink:0,width:270,minHeight:0,borderLeft:`1px solid ${T.border}`,background:T.bg,overflowY:'auto',padding:'16px 14px 20px 14px' }} className="mcq-s">
          <QuestionPanel
            questions={filteredQuestions} currentIndex={currentQuestionIndex}
            answers={answers} flaggedQuestions={flaggedForSidebar} onJump={handleJumpToQuestion}
            selectedDifficulty={selectedDifficulty} onDifficultyChange={setSelectedDifficulty}
            difficultyCounts={difficultyCounts} timeLeft={timeLeft} totalDuration={totalDuration}
            questionFilter={questionFilter} onFilterChange={setQuestionFilter}
            filterCounts={filterCounts} hasRequiredQuestions={hasRequiredQuestions}
          />
        </div>
      </div>

      {/* ═══ BOTTOM NAV BAR ═══ */}
      <div style={{ flexShrink:0,height:BOTTOM_BAR_H,background:T.bg,borderTop:`1px solid ${T.border}`,display:'flex',alignItems:'center',padding:'0 28px',gap:16,zIndex:50 }}>
        <button onClick={handlePrev} disabled={currentQuestionIndex===0} className="btn-prev"
          style={{ display:'flex',alignItems:'center',gap:7,padding:'10px 20px',borderRadius:10,border:`1.5px solid ${T.border}`,background:'transparent',color:currentQuestionIndex===0?T.textHint:T.textSub,fontSize:13,fontWeight:600,cursor:currentQuestionIndex===0?'not-allowed':'pointer',fontFamily:'inherit',transition:'all 0.13s',flexShrink:0 }}>
          <ChevronLeft size={15} /> Previous
        </button>

        <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,overflow:'hidden' }}>
          {filteredQuestions.slice(Math.max(0,currentQuestionIndex-4),Math.min(filteredQuestions.length,currentQuestionIndex+5)).map((_,relIdx)=>{
            const absIdx=Math.max(0,currentQuestionIndex-4)+relIdx;
            const isCurr=absIdx===currentQuestionIndex;
            const isDone=isQuestionAnswered(filteredQuestions[absIdx]);
            return (
              <button key={absIdx} onClick={()=>handleJumpToQuestion(absIdx)}
                style={{ width:isCurr?22:7,height:7,borderRadius:99,background:isCurr?T.orange:isDone?T.green:T.border,border:'none',cursor:'pointer',transition:'all 0.2s',padding:0,flexShrink:0 }} />
            );
          })}
        </div>

        {!isLastQ?(
          <button onClick={handleNext} className="btn-next"
            style={{ display:'flex',alignItems:'center',gap:7,padding:'10px 22px',borderRadius:10,border:'none',background:T.orange,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.13s',boxShadow:`0 3px 14px ${T.orangeGlow}`,flexShrink:0 }}>
            Next <ChevronRight size={15} />
          </button>
        ):(
          <button onClick={handleSubmitClick} disabled={isSubmitting||hasRequiredUnanswered} className={(!isSubmitting&&!hasRequiredUnanswered)?'submit-ok':''}
            style={{ display:'flex',alignItems:'center',gap:7,padding:'10px 22px',borderRadius:10,border:'none',background:hasRequiredUnanswered?T.pageBg:allAnswered?T.green:T.orange,color:hasRequiredUnanswered?T.textHint:'#fff',fontSize:13,fontWeight:700,cursor:hasRequiredUnanswered?'not-allowed':'pointer',fontFamily:'inherit',transition:'all 0.13s',boxShadow:hasRequiredUnanswered?'none':`0 3px 14px ${T.orangeGlow}`,flexShrink:0 }}>
            {isSubmitting?<><div style={{ width:13,height:13,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.6s linear infinite' }} />Submitting…</>:hasRequiredUnanswered?<><AlertCircle size={14} />Answer required</>:<><CheckCircle size={14} />Submit</>}
          </button>
        )}
      </div>
    </div>
  );
};

export default MCQ;