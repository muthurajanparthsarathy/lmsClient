// TestYourSkills.tsx - Complete file with all question types support, delete confirmation, and bulk delete
"use client";
import { getToken } from "@/lib/session";

import React, { useState, useEffect } from "react";
import {
  BookOpen, CheckCircle, Clock, Play, Trophy,
  ChevronRight, MoreVertical, Plus, Edit2, Trash2,
  List, Layers, Calendar, BarChart2, Star,
  Eye, AlertCircle, RefreshCw, Loader2, X,
  Search, FileText, Database, Upload, Sparkles,
  CheckSquare,
  AlignLeft,
  ClipboardList,
  Info,
  ChevronLeft,
  GripVertical,
  Hash,
  PenTool,
  Flag,
  ArrowLeft,
  Target,
  Check
} from "lucide-react";
import CreateTestModal from "./testyouskillscomponents/CreateTestModal";
import { youDoMcqApi, getEntityTypeFromNodeType } from "@/apiServices/pedagogyAndModuleAdd/testYourSkillsApi";
// Resources by Batch — used by the raw `fetch` below, which the axios
// interceptor cannot reach. `getActiveBatchId` also keys the reload effect so
// the list refetches when the batch strip changes.
import { withBatchBody, getActiveBatchId } from "@/apiServices/resourceBatch";
import { toast } from "react-hot-toast";
import AddQuestionViaDocument from "@/app/lms/component/AddQuestionViaDocument";
import { questionBankService } from "@/apiServices/questionBankService";
import TestYourSKillsQuestionBanklist from "./testyouskillscomponents/TestYourSKillsQuestionBanklist";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  green:     "#059669",
  greenDark: "#047857",
  greenLight:"rgba(5,150,105,0.08)",
  greenMid:  "rgba(5,150,105,0.15)",
  greenGlow: "rgba(5,150,105,0.22)",
  textMain:  "#1a1a2e",
  textSub:   "#6b6b7e",
  textMuted: "#8b8b9e",
  textHint:  "#bcbccc",
  border:    "#ece9f1",
  bg:        "#ffffff",
  pageBg:    "#faf9fc",
  warm:      "#f0fdf9",
  orange:    "#F27757",
  orangeLight: "rgba(242,119,87,0.08)",
  orangeDark: "#E0623F",
  purple:    "#8b5cf6",
  purpleLight: "rgba(139,92,246,0.08)",
  blue:      "#FB923C",
  blueLight: "rgba(251,146,60,0.08)",
  red:       "#ef4444",
  redLight:  "rgba(239,68,68,0.08)",
  amber:     "#f59e0b",
  amberLight:"rgba(245,158,11,0.08)",
};

// ─── Props ────────────────────────────────────────────────────────────────────
export interface YouDoProps {
  nodeId: string;
  nodeName: string;
  subcategory: string;
  subcategoryLabel: string;
  courseId?: string; 
  nodeType: string;
  hierarchyData: {
    courseName: string;
    moduleName: string;
    submoduleName: string;
    topicName: string;
    subtopicName: string;
    nodeType: string;
    level: number;
  };
  configuredLanguages?: { coreProgram?: string[]; frontend?: string[]; database?: string[] };
  onRefresh?: () => Promise<void>;
  /**
   * Resources by Batch — the batch currently selected in the strip above.
   * Threaded down as a prop rather than read from module state so that a batch
   * switch re-renders this subtree and the exercise list's cache key changes
   * with it. "" when the course has no batches or the section is shared.
   */
  batchId?: string;
}

// ─── Question record - each question is a separate row ────────────────────────
interface QuestionRecord {
  id: string;
  testItemKey: string;
  title: string;
  type: string;
  duration: number;
  marks: number;
  level: string;
  status: "active" | "draft" | "ended";
  createdAt: string;
  sequence: number;
  questionData?: any;
}

// ─── Type Meta with display labels ────────────────────────────────────────────
const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  multiple_choice: { icon: <List size={11} />, color: T.blue, bg: T.blueLight, label: "Multiple Choice" },
  multiple_select: { icon: <CheckSquare size={11} />, color: T.purple, bg: T.purpleLight, label: "Multiple Select" },
  true_false: { icon: <CheckCircle size={11} />, color: T.green, bg: T.greenLight, label: "True/False" },
  short_answer: { icon: <AlignLeft size={11} />, color: T.amber, bg: T.amberLight, label: "Short Answer" },
  essay: { icon: <BookOpen size={11} />, color: T.textSub, bg: T.pageBg, label: "Essay" },
  matching: { icon: <List size={11} />, color: T.purple, bg: T.purpleLight, label: "Matching" },
  ordering: { icon: <List size={11} />, color: T.blue, bg: T.blueLight, label: "Ordering" },
  numeric: { icon: <Hash size={11} />, color: T.green, bg: T.greenLight, label: "Numeric" },
  dropdown: { icon: <List size={11} />, color: T.orange, bg: T.orangeLight, label: "Dropdown" },
};

const LEVEL_COLORS: Record<string, string> = {
  easy: "#10b981",
  medium: "#f59e0b",
  hard: "#ef4444",
};

// ─── Helper Functions ─────────────────────────────────────────────────────────
const getTypeLabel = (type: string): string => {
  const mapping: Record<string, string> = {
    multiple_choice: "Multiple Choice",
    multiple_select: "Multiple Select",
    true_false: "True/False",
    short_answer: "Short Answer",
    essay: "Essay",
    matching: "Matching",
    ordering: "Ordering",
    numeric: "Numeric",
    dropdown: "Dropdown",
  };
  return mapping[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const renderRichContent = (title: any) => {
  if (!title) return <span className="text-gray-400 italic">No content</span>;
  
  if (typeof title === 'string') {
    return <div dangerouslySetInnerHTML={{ __html: title }} />;
  }
  
  if (Array.isArray(title)) {
    return (
      <div className="space-y-3">
        {title.map((block: any, idx: number) => {
          if (block.type === 'text') {
            return <div key={idx} dangerouslySetInnerHTML={{ __html: block.value || '' }} />;
          }
          if (block.type === 'code') {
            return (
              <pre key={idx} style={{ 
                background: block.bgColor || '#1e1e1e', 
                padding: '12px', 
                borderRadius: '8px', 
                overflow: 'auto', 
                marginTop: '8px',
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
  
  if (typeof title === 'object' && title?.text) {
    return <div dangerouslySetInnerHTML={{ __html: title.text }} />;
  }
  
  return <span>{String(title)}</span>;
};

// ─── DropMenu Component ───────────────────────────────────────────────────────
const DropMenu: React.FC<{ children: React.ReactNode; upward?: boolean }> = ({ children, upward }) => (
  <div
    className={`absolute right-0 w-40 z-[200] ${upward ? "bottom-full mb-1" : "top-full mt-1"}`}
    style={{
      background: T.bg, border: `1px solid ${T.border}`, borderRadius: 12,
      boxShadow: "0 10px 32px rgba(0,0,0,0.10)", padding: 4,
      animation: "tsFadeIn 0.12s cubic-bezier(0.16,1,0.3,1) both",
    }}
    onClick={e => e.stopPropagation()}
  >
    {children}
  </div>
);

const DropItem: React.FC<{
  icon: React.ReactNode; label: string; color?: string; divider?: boolean; onClick: () => void;
}> = ({ icon, label, color, divider, onClick }) => (
  <button
    type="button" onClick={onClick}
    className="flex items-center gap-2 w-full px-2.5 py-2 text-[11px] font-semibold rounded-lg"
    style={{
      color: color || T.textSub,
      borderTop: divider ? `1px solid ${T.border}` : "none",
      marginTop: divider ? 3 : 0,
      background: "transparent", transition: "all 0.12s",
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = color ? `${color}10` : T.pageBg; (e.currentTarget as HTMLElement).style.color = color || T.textMain; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = color || T.textSub; }}
  >
    {icon}{label}
  </button>
);

// ─── Delete Confirmation Modal Component (Single Delete) ───────────────────────
const DeleteConfirmationModal: React.FC<{
  isOpen: boolean;
  questionTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, questionTitle, onCancel, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[2100] flex items-center justify-center"
      style={{ background: 'rgba(26,26,46,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ border: '1px solid var(--lms-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fee2e2' }}>
              <Trash2 className="h-5 w-5" style={{ color: '#ef4444' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: T.textMain }}>Delete Question</h3>
              <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>This action cannot be undone.</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex items-start gap-3 mb-6">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium" style={{ color: T.textMain }}>
                Are you sure you want to delete this question?
              </p>
              <p className="text-xs mt-1" style={{ color: T.textMuted }}>
                "<span className="font-semibold" style={{ color: T.orange }}>{questionTitle.length > 80 ? questionTitle.substring(0, 80) + '...' : questionTitle}</span>"
              </p>
              <p className="text-xs mt-3" style={{ color: T.textMuted }}>
                This will permanently remove the question from the test. 
                Students will no longer see this question.
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, color: T.textSub }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bg; e.currentTarget.style.borderColor = T.border; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.pageBg; e.currentTarget.style.borderColor = T.border; }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white"
              style={{ background: '#ef4444', boxShadow: '0 2px 8px rgba(239,68,68,0.22)' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}
            >
              Delete Question
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Bulk Delete Confirmation Modal Component ─────────────────────────────────
const BulkDeleteConfirmationModal: React.FC<{
  isOpen: boolean;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, count, onCancel, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[2100] flex items-center justify-center"
      style={{ background: 'rgba(26,26,46,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ border: '1px solid var(--lms-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#fee2e2' }}>
              <Trash2 className="h-5 w-5" style={{ color: '#ef4444' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: T.textMain }}>Delete Questions</h3>
              <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>This action cannot be undone.</p>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="flex items-start gap-3 mb-6">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium" style={{ color: T.textMain }}>
                Are you sure you want to delete {count} selected question{count !== 1 ? 's' : ''}?
              </p>
              <p className="text-xs mt-3" style={{ color: T.textMuted }}>
                This will permanently remove the selected questions from the test. 
                Students will no longer see these questions.
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, color: T.textSub }}
              onMouseEnter={e => { e.currentTarget.style.background = T.bg; e.currentTarget.style.borderColor = T.border; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.pageBg; e.currentTarget.style.borderColor = T.border; }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white"
              style={{ background: '#ef4444', boxShadow: '0 2px 8px rgba(239,68,68,0.22)' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}
            >
              Delete {count} Question{count !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Create Option Modal Component ────────────────────────────────────────────
const CreateOptionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectFromScratch: () => void;
  onSelectFromBank: () => void;
  onSelectFromDocument: () => void;
}> = ({ isOpen, onClose, onSelectFromScratch, onSelectFromBank, onSelectFromDocument }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: 'rgba(26,26,46,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ border: '1px solid var(--lms-border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3 border-b" style={{ borderColor: T.border }}>
          <h3 className="text-base font-bold" style={{ color: T.textMain }}>Add Question</h3>
          <p className="text-xs mt-1" style={{ color: T.textMuted }}>Choose how you want to create questions</p>
        </div>

        <div className="p-4 space-y-3">
          <button
            onClick={onSelectFromScratch}
            className="w-full flex items-start gap-4 p-4 rounded-xl transition-all text-left"
            style={{ background: T.bg, border: `1.5px solid ${T.border}`, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.green; e.currentTarget.style.background = T.greenLight; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.bg; }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e8f5e9', color: T.green }}>
              <Plus size={20} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: T.textMain }}>Create From Scratch</p>
              <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>Build from scratch with custom content</p>
            </div>
          </button>

          <button
            onClick={onSelectFromBank}
            className="w-full flex items-start gap-4 p-4 rounded-xl transition-all text-left"
            style={{ background: T.bg, border: `1.5px solid ${T.border}`, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.purple; e.currentTarget.style.background = T.purpleLight; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.bg; }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f3e8ff', color: T.purple }}>
              <Database size={20} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: T.textMain }}>From Question Bank</p>
              <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>Import from existing question repository</p>
            </div>
          </button>

          <button
            onClick={onSelectFromDocument}
            className="w-full flex items-start gap-4 p-4 rounded-xl transition-all text-left"
            style={{ background: T.bg, border: `1.5px solid ${T.border}`, transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.amber; e.currentTarget.style.background = T.amberLight; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.bg; }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fef3c7', color: T.amber }}>
              <Upload size={20} strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: T.textMain }}>From Document</p>
              <p className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>Bulk import from JSON, CSV, TXT</p>
            </div>
          </button>
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, color: T.textSub }}
            onMouseEnter={e => { e.currentTarget.style.background = T.bg; e.currentTarget.style.borderColor = T.border; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.pageBg; e.currentTarget.style.borderColor = T.border; }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Preview Modal Component (Supports All Question Types) ─────────────────────
const PreviewModal: React.FC<{
  isOpen: boolean;
  questions: QuestionRecord[];
  onClose: () => void;
  testTitle?: string;
}> = ({ isOpen, questions, onClose, testTitle = "Test Preview" }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  if (!isOpen || questions.length === 0) return null;
  
  const currentQuestion = questions[currentIndex];
  const questionData = currentQuestion?.questionData;
  const qType = questionData?.mcqQuestionType || currentQuestion?.type;
  
  const renderOptionsPreview = () => {
    const options = questionData?.mcqQuestionOptions || [];
    
    if (qType === 'multiple_choice') {
      return (
        <div className="space-y-2 mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Options:</p>
          {options.map((opt: any, idx: number) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#f9f9fb', border: `1px solid ${opt.isCorrect ? T.green : T.border}` }}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${opt.isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                {opt.isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="flex-1">
                {opt.imageUrl && (
                  <div style={{ textAlign: opt.imageAlignment || 'left', marginBottom: '8px' }}>
                    <img src={opt.imageUrl} alt="Option" style={{ maxWidth: `${opt.imageSizePercent || 60}%`, borderRadius: '8px' }} />
                  </div>
                )}
                <span className="text-sm" style={{ color: '#1a1a2e' }}>{opt.text || `Option ${idx + 1}`}</span>
              </div>
              {opt.isCorrect && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Correct</span>
              )}
            </div>
          ))}
        </div>
      );
    }
    
    if (qType === 'multiple_select') {
      return (
        <div className="space-y-2 mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Options (Select all that apply):</p>
          {options.map((opt: any, idx: number) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#f9f9fb', border: `1px solid ${opt.isCorrect ? T.green : T.border}` }}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${opt.isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                {opt.isCorrect && <CheckCircle className="h-2.5 w-2.5 text-white" />}
              </div>
              <div className="flex-1">
                {opt.imageUrl && (
                  <div style={{ textAlign: opt.imageAlignment || 'left', marginBottom: '8px' }}>
                    <img src={opt.imageUrl} alt="Option" style={{ maxWidth: `${opt.imageSizePercent || 60}%`, borderRadius: '8px' }} />
                  </div>
                )}
                <span className="text-sm" style={{ color: '#1a1a2e' }}>{opt.text || `Option ${idx + 1}`}</span>
              </div>
              {opt.isCorrect && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Correct</span>
              )}
            </div>
          ))}
        </div>
      );
    }
    
    if (qType === 'true_false') {
      const answer = questionData?.trueFalseAnswer;
      return (
        <div className="space-y-2 mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Correct Answer:</p>
          <div className="flex gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${answer === true ? 'bg-green-100 border border-green-500' : 'bg-gray-100'}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${answer === true ? 'border-green-500 bg-green-500' : 'border-gray-400'}`}>
                {answer === true && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium">True</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${answer === false ? 'bg-green-100 border border-green-500' : 'bg-gray-100'}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${answer === false ? 'border-green-500 bg-green-500' : 'border-gray-400'}`}>
                {answer === false && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium">False</span>
            </div>
          </div>
        </div>
      );
    }
    
    if (qType === 'short_answer') {
      return (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Expected Answer (for reference):</p>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-600">{questionData?.shortAnswer || questionData?.mcqQuestionCorrectAnswers?.[0] || 'No answer key provided'}</p>
          </div>
        </div>
      );
    }
    
    if (qType === 'essay') {
      return (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Essay Question (Manual Grading Required)</p>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-sm text-gray-600">Students will provide a detailed written response.</p>
          </div>
        </div>
      );
    }
    
    if (qType === 'numeric') {
      const answer = questionData?.numericAnswer;
      const tolerance = questionData?.numericTolerance;
      return (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Correct Answer:</p>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-sm font-medium">{answer}</p>
            {tolerance && tolerance > 0 && (
              <p className="text-xs text-gray-500 mt-1">Acceptable range: ±{tolerance}</p>
            )}
          </div>
        </div>
      );
    }
    
    if (qType === 'matching') {
      const pairs = questionData?.matchingPairs || [];
      return (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Matching Pairs:</p>
          <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-gray-50 border border-gray-200">
            {pairs.map((pair: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-200">
                <span className="text-sm font-medium">{pair.left}</span>
                <ChevronRight size={14} className="text-gray-400" />
                <span className="text-sm">{pair.right}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (qType === 'ordering') {
      const items = questionData?.orderingItems || [];
      const sortedItems = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
      return (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Correct Order:</p>
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            {sortedItems.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 p-2 border-b border-gray-100">
                <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                <span className="text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (qType === 'dropdown') {
      const options = questionData?.mcqQuestionOptions || [];
      const correctOption = options.find((opt: any) => opt.isCorrect);
      return (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500 mb-2">Correct Answer:</p>
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm font-medium text-green-700">{correctOption?.text || 'Not specified'}</p>
          </div>
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="fixed inset-0 z-[2000] flex flex-col" style={{ background: '#f9f9fb' }}>
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3" style={{ borderBottom: '1.5px solid #eaeaef', background: '#fff' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: T.purple }}>
            <Eye className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#1a1a2e' }}>{testTitle}</p>
            <p className="text-[10px]" style={{ color: '#9b9bae' }}>Preview all questions and answers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50">
            <span className="text-xs font-semibold text-gray-500">Questions</span>
            <span className="text-xs font-bold text-purple-500">{currentIndex + 1}/{questions.length}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>
      
      <div className="flex-shrink-0 px-6 py-3 bg-white border-b" style={{ borderColor: '#eaeaef' }}>
        <div className="flex gap-2 flex-wrap">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${currentIndex === idx ? 'text-white' : ''}`}
              style={{
                background: currentIndex === idx ? T.purple : '#f0f0f7',
                color: currentIndex === idx ? '#fff' : '#6b6b7e',
                border: currentIndex === idx ? 'none' : '1px solid #e4e4ed'
              }}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: '#f0f0f7', color: '#6b6b7e' }}>
              {getTypeLabel(qType || 'multiple_choice')}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ 
              background: `${LEVEL_COLORS[currentQuestion?.level || 'medium']}12`, 
              color: LEVEL_COLORS[currentQuestion?.level || 'medium'] 
            }}>
              {(currentQuestion?.level || 'medium').toUpperCase()}
            </span>
            <span className="text-[10px]" style={{ color: '#9b9bae' }}>{currentQuestion?.marks || 1} pts</span>
          </div>
          
          <div className="mb-6 p-5 rounded-xl" style={{ background: '#fff', border: '1px solid #e4e4ed', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {renderRichContent(questionData?.mcqQuestionTitle)}
          </div>
          
          {questionData?.mcqQuestionDescription && (
            <div className="mb-4 p-3 rounded-lg" style={{ background: T.blueLight, border: `1px solid ${T.blue}30` }}>
              <p className="text-xs font-semibold text-orange-600 mb-1">📌 Description</p>
              <div dangerouslySetInnerHTML={{ __html: questionData.mcqQuestionDescription }} className="text-sm text-gray-600" />
            </div>
          )}
          
          {renderOptionsPreview()}
          
          {questionData?.explanation && (
            <div className="mt-6 p-4 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-bold text-orange-600">Explanation</span>
              </div>
              <p className="text-xs leading-relaxed text-gray-600" dangerouslySetInnerHTML={{ __html: questionData.explanation }} />
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white">
        <button
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: '#f9f9fb', border: '1.5px solid #e4e4ed', color: '#6b6b7e' }}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>
        {currentIndex < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: T.purple }}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: '#16a34a' }}
          >
            <CheckCircle className="h-3.5 w-3.5" /> Done
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Mock Test Modal Component (Supports All Question Types) ───────────────────
interface MockTestModalProps {
  isOpen: boolean;
  questions: QuestionRecord[];
  onClose: () => void;
  testTitle?: string;
}

const MockTestModal: React.FC<MockTestModalProps> = ({ isOpen, questions, onClose, testTitle = "Mock Test" }) => {
  // All useState hooks at top level
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(60 * questions.length);
  const [testStarted, setTestStarted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Local state for each question type
  const [selectedRadio, setSelectedRadio] = useState<string | null>(null);
  const [selectedCheckboxes, setSelectedCheckboxes] = useState<Set<string>>(new Set());
  const [selectedDropdown, setSelectedDropdown] = useState<string | null>(null);
  const [trueFalseValue, setTrueFalseValue] = useState<boolean | null>(null);
  const [shortAnswerText, setShortAnswerText] = useState('');
  const [essayText, setEssayText] = useState('');
  const [numericValue, setNumericValue] = useState<string>('');
  const [matchingAnswers, setMatchingAnswers] = useState<{ left: string; right: string; }[]>([]);
  const [orderingAnswers, setOrderingAnswers] = useState<{ itemId: string; order: number; }[]>([]);
  
  // State for ordering and matching
  const [orderedItems, setOrderedItems] = useState<any[]>([]);
  const [matchingPairs, setMatchingPairs] = useState<any[]>([]);
  const [matchingRightItems, setMatchingRightItems] = useState<string[]>([]);
  const [currentMatches, setCurrentMatches] = useState<{ left: string; right: string; }[]>([]);
  
  const currentQuestion = questions[currentIndex];
  const questionData = currentQuestion?.questionData;
  const qType = questionData?.mcqQuestionType || currentQuestion?.type;
  const totalPossibleScore = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
  
  // Effect for ordering
  useEffect(() => {
    const items = questionData?.orderingItems || [];
    if (orderingAnswers.length > 0) {
      const sorted = [...items].sort((a, b) => {
        const aOrder = orderingAnswers.find(o => o.itemId === a._id)?.order || 0;
        const bOrder = orderingAnswers.find(o => o.itemId === b._id)?.order || 0;
        return aOrder - bOrder;
      });
      setOrderedItems(sorted);
    } else {
      setOrderedItems([...items]);
    }
  }, [currentQuestion, questionData, orderingAnswers]);
  
  // Effect for matching
  useEffect(() => {
    const pairs = questionData?.matchingPairs || [];
    setMatchingPairs(pairs);
    setMatchingRightItems([...pairs.map((p: any) => p.right)].sort(() => Math.random() - 0.5));
    setCurrentMatches(matchingAnswers);
  }, [currentQuestion, questionData, matchingAnswers]);
  
  // Load answers when switching questions
  useEffect(() => {
    if (!testStarted || submitted) return;
    
    const savedAnswer = answers[currentQuestion?.id];
    if (savedAnswer) {
      switch (qType) {
        case 'multiple_choice':
          setSelectedRadio(savedAnswer);
          break;
        case 'multiple_select':
          setSelectedCheckboxes(new Set(savedAnswer || []));
          break;
        case 'dropdown':
          setSelectedDropdown(savedAnswer);
          break;
        case 'true_false':
          setTrueFalseValue(savedAnswer);
          break;
        case 'short_answer':
          setShortAnswerText(savedAnswer || '');
          break;
        case 'essay':
          setEssayText(savedAnswer || '');
          break;
        case 'numeric':
          setNumericValue(savedAnswer || '');
          break;
        case 'matching':
          setMatchingAnswers(savedAnswer || []);
          setCurrentMatches(savedAnswer || []);
          break;
        case 'ordering':
          setOrderingAnswers(savedAnswer || []);
          break;
      }
    } else {
      // Reset for new question
      setSelectedRadio(null);
      setSelectedCheckboxes(new Set());
      setSelectedDropdown(null);
      setTrueFalseValue(null);
      setShortAnswerText('');
      setEssayText('');
      setNumericValue('');
      setMatchingAnswers([]);
      setOrderingAnswers([]);
      setCurrentMatches([]);
    }
  }, [currentIndex, currentQuestion?.id, qType, testStarted, submitted, answers]);
  
  // Timer
  useEffect(() => {
    if (!testStarted || submitted || timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [testStarted, submitted, timeRemaining]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const saveCurrentAnswer = () => {
    let answerValue: any = null;
    
    switch (qType) {
      case 'multiple_choice':
        answerValue = selectedRadio;
        break;
      case 'multiple_select':
        answerValue = Array.from(selectedCheckboxes);
        break;
      case 'dropdown':
        answerValue = selectedDropdown;
        break;
      case 'true_false':
        answerValue = trueFalseValue;
        break;
      case 'short_answer':
        answerValue = shortAnswerText;
        break;
      case 'essay':
        answerValue = essayText;
        break;
      case 'numeric':
        answerValue = numericValue;
        break;
      case 'matching':
        answerValue = currentMatches;
        break;
      case 'ordering':
        answerValue = orderingAnswers;
        break;
    }
    
    if (answerValue !== null && answerValue !== '' && 
        (Array.isArray(answerValue) ? answerValue.length > 0 : true)) {
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: answerValue }));
    }
  };
  
  const handleNext = () => {
    saveCurrentAnswer();
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const handlePrev = () => {
    saveCurrentAnswer();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const isAnswerCorrect = (question: QuestionRecord, userAnswer: any): boolean => {
    const qd = question.questionData;
    const type = qd?.mcqQuestionType || question.type;
    
    if (!userAnswer) return false;
    
    switch (type) {
      case 'multiple_choice': {
        const options = qd?.mcqQuestionOptions || [];
        const correctOption = options.find((opt: any) => opt.isCorrect);
        return userAnswer === correctOption?.text || userAnswer === correctOption?._id;
      }
      case 'multiple_select': {
        const options = qd?.mcqQuestionOptions || [];
        const correctOptions = options.filter((opt: any) => opt.isCorrect).map((opt: any) => opt.text);
        const userAnswers = Array.isArray(userAnswer) ? userAnswer : [];
        return correctOptions.length === userAnswers.length && 
               correctOptions.every(opt => userAnswers.includes(opt));
      }
      case 'true_false': {
        const correctAnswer = qd?.trueFalseAnswer;
        return userAnswer === correctAnswer;
      }
      case 'short_answer': {
        const correctAnswer = (qd?.shortAnswer || qd?.mcqQuestionCorrectAnswers?.[0] || '').toLowerCase().trim();
        return userAnswer.toLowerCase().trim() === correctAnswer;
      }
      case 'numeric': {
        const correctAnswer = qd?.numericAnswer;
        const tolerance = qd?.numericTolerance || 0;
        const numAnswer = parseFloat(userAnswer);
        return !isNaN(numAnswer) && Math.abs(numAnswer - correctAnswer) <= tolerance;
      }
      case 'dropdown': {
        const options = qd?.mcqQuestionOptions || [];
        const correctOption = options.find((opt: any) => opt.isCorrect);
        return userAnswer === correctOption?.text || userAnswer === correctOption?._id;
      }
      case 'matching': {
        const correctPairs = qd?.matchingPairs || [];
        if (!Array.isArray(userAnswer) || userAnswer.length !== correctPairs.length) return false;
        for (const pair of correctPairs) {
          const match = userAnswer.find((a: any) => a.left === pair.left);
          if (!match || match.right !== pair.right) return false;
        }
        return true;
      }
      case 'ordering': {
        const correctItems = qd?.orderingItems || [];
        const sortedCorrect = [...correctItems].sort((a, b) => a.order - b.order);
        if (!Array.isArray(userAnswer) || userAnswer.length !== sortedCorrect.length) return false;
        for (let i = 0; i < userAnswer.length; i++) {
          if (userAnswer[i].itemId !== sortedCorrect[i]._id) return false;
        }
        return true;
      }
      default:
        return false;
    }
  };
  
  const handleSubmit = () => {
    saveCurrentAnswer();
    
    let earnedScore = 0;
    for (const q of questions) {
      const userAnswer = answers[q.id];
      if (isAnswerCorrect(q, userAnswer)) {
        earnedScore += q.marks || 1;
      }
    }
    
    setTotalScore(earnedScore);
    setScore(Math.round((earnedScore / totalPossibleScore) * 100));
    setSubmitted(true);
    setShowResults(true);
    
    toast.success(`Test completed! Score: ${earnedScore}/${totalPossibleScore}`);
  };
  
  const handleStart = () => {
    setTestStarted(true);
    setCurrentIndex(0);
    setAnswers({});
    setSubmitted(false);
    setShowResults(false);
    setTimeRemaining(60 * questions.length);
    // Reset all answer states
    setSelectedRadio(null);
    setSelectedCheckboxes(new Set());
    setSelectedDropdown(null);
    setTrueFalseValue(null);
    setShortAnswerText('');
    setEssayText('');
    setNumericValue('');
    setMatchingAnswers([]);
    setOrderingAnswers([]);
    setCurrentMatches([]);
  };
  
  const getAnswerStatus = () => {
    const answer = answers[currentQuestion?.id];
    if (!answer) return 'unanswered';
    if (Array.isArray(answer) && answer.length === 0) return 'unanswered';
    return 'answered';
  };
  
  // renderQuestionInput as pure rendering function
  const renderQuestionInput = () => {
    const options = questionData?.mcqQuestionOptions || [];
    
    switch (qType) {
      case 'multiple_choice':
        return (
          <div className="space-y-3">
            {options.map((opt: any, idx: number) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selectedRadio === opt.text || selectedRadio === opt._id;
              return (
                <label
                  key={opt._id || idx}
                  className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all border-2 ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-purple-200'}`}
                  onClick={() => setSelectedRadio(opt.text || opt._id)}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">{letter}</span>
                      <span className="text-sm text-gray-700">{opt.text}</span>
                    </div>
                    {opt.imageUrl && (
                      <img src={opt.imageUrl} alt="Option" className="mt-2 rounded-lg max-w-[200px]" />
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        );
        
      case 'multiple_select':
        return (
          <div className="space-y-3">
            {options.map((opt: any, idx: number) => {
              const letter = String.fromCharCode(65 + idx);
              const isSelected = selectedCheckboxes.has(opt.text) || selectedCheckboxes.has(opt._id);
              return (
                <label
                  key={opt._id || idx}
                  className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all border-2 ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-200'}`}
                  onClick={() => {
                    const newSet = new Set(selectedCheckboxes);
                    const value = opt.text || opt._id;
                    if (newSet.has(value)) {
                      newSet.delete(value);
                    } else {
                      newSet.add(value);
                    }
                    setSelectedCheckboxes(newSet);
                  }}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'}`}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">{letter}</span>
                      <span className="text-sm text-gray-700">{opt.text}</span>
                    </div>
                    {opt.imageUrl && (
                      <img src={opt.imageUrl} alt="Option" className="mt-2 rounded-lg max-w-[200px]" />
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        );
        
      case 'true_false':
        return (
          <div className="flex gap-4">
            {[
              { value: true, label: 'True', icon: '✓', color: T.green },
              { value: false, label: 'False', icon: '✕', color: T.red }
            ].map(({ value, label, icon, color }) => (
              <button
                key={label}
                onClick={() => setTrueFalseValue(value)}
                className={`flex-1 py-4 px-6 rounded-xl font-semibold transition-all border-2 ${trueFalseValue === value ? `border-${color === T.green ? 'green' : 'red'}-500 bg-${color === T.green ? 'green' : 'red'}-50` : 'border-gray-200 hover:border-gray-300'}`}
              >
                <span className={`text-lg mr-2 ${trueFalseValue === value ? `text-${color === T.green ? 'green' : 'red'}-600` : 'text-gray-400'}`}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        );
        
      case 'short_answer':
        return (
          <textarea
            value={shortAnswerText}
            onChange={(e) => setShortAnswerText(e.target.value)}
            placeholder="Type your short answer here..."
            className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none resize-y min-h-[120px]"
          />
        );
        
      case 'essay':
        return (
          <textarea
            value={essayText}
            onChange={(e) => setEssayText(e.target.value)}
            placeholder="Write your detailed answer here..."
            className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none resize-y min-h-[200px]"
          />
        );
        
      case 'numeric':
        return (
          <div className="relative">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="number"
              value={numericValue}
              onChange={(e) => setNumericValue(e.target.value)}
              placeholder="Enter your numeric answer..."
              className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none"
            />
          </div>
        );
        
      case 'dropdown':
        return (
          <select
            value={selectedDropdown || ''}
            onChange={(e) => setSelectedDropdown(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none bg-white"
          >
            <option value="">Select an answer...</option>
            {options.map((opt: any, idx: number) => (
              <option key={opt._id || idx} value={opt.text || opt._id}>
                {String.fromCharCode(65 + idx)}. {opt.text}
              </option>
            ))}
          </select>
        );
        
      case 'matching': {
        const handleMatch = (left: string, right: string) => {
          const existing = currentMatches.find(m => m.left === left);
          if (existing) {
            const updated = currentMatches.map(m => m.left === left ? { left, right } : m);
            setCurrentMatches(updated);
            setMatchingAnswers(updated);
          } else {
            const updated = [...currentMatches, { left, right }];
            setCurrentMatches(updated);
            setMatchingAnswers(updated);
          }
        };
        
        const removeMatch = (left: string) => {
          const updated = currentMatches.filter(m => m.left !== left);
          setCurrentMatches(updated);
          setMatchingAnswers(updated);
        };
        
        const leftItems = matchingPairs.map((p: any) => p.left);
        
        return (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-semibold mb-3">Items</p>
              {leftItems.map((left: string, idx: number) => {
                const matched = currentMatches.find(m => m.left === left);
                return (
                  <div
                    key={`left-${left}-${idx}`}
                    className="p-3 mb-2 rounded-lg border-2 border-gray-200 bg-white cursor-pointer hover:border-purple-300 transition-all"
                    onClick={() => matched && removeMatch(left)}
                  >
                    <span className="text-sm">{left}</span>
                    {matched && (
                      <span className="float-right text-xs text-green-600">→ {matched.right}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div>
              <p className="text-sm font-semibold mb-3">Match to</p>
              {matchingRightItems.map((right: string, idx: number) => {
                const matchedBy = currentMatches.find(m => m.right === right);
                return (
                  <div
                    key={`right-${right}-${idx}`}
                    className="p-3 mb-2 rounded-lg border-2 border-gray-200 bg-gray-50 cursor-pointer hover:border-purple-300 transition-all"
                    onClick={() => {
                      const unmatchedLeft = leftItems.find((l: string) => !currentMatches.find(m => m.left === l));
                      if (unmatchedLeft && !matchedBy) {
                        handleMatch(unmatchedLeft, right);
                      }
                    }}
                  >
                    <span className="text-sm">{right}</span>
                    {matchedBy && (
                      <span className="float-right text-xs text-green-600">← {matchedBy.left}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      }
        
      case 'ordering': {
        const handleDragStart = (e: React.DragEvent, idx: number) => {
          e.dataTransfer.setData('text/plain', idx.toString());
        };
        
        const handleDragOver = (e: React.DragEvent) => {
          e.preventDefault();
        };
        
        const handleDrop = (e: React.DragEvent, targetIdx: number) => {
          e.preventDefault();
          const sourceIdx = parseInt(e.dataTransfer.getData('text/plain'));
          if (sourceIdx === targetIdx) return;
          
          const newOrder = [...orderedItems];
          const [moved] = newOrder.splice(sourceIdx, 1);
          newOrder.splice(targetIdx, 0, moved);
          setOrderedItems(newOrder);
          
          const newAnswers = newOrder.map((item, idx) => ({
            itemId: item._id || item.id || `item-${idx}`,
            order: idx + 1
          }));
          setOrderingAnswers(newAnswers);
        };
        
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-3">Drag and drop to arrange in the correct order:</p>
            {orderedItems.map((item, idx) => {
              const uniqueKey = item._id || item.id || `ordering-item-${idx}-${item.text}`;
              return (
                <div
                  key={uniqueKey}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, idx)}
                  className="flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 bg-white cursor-grab active:cursor-grabbing hover:border-purple-300 transition-all"
                >
                  <GripVertical className="h-5 w-5 text-gray-400" />
                  <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">{idx + 1}</span>
                  <span className="text-sm">{item.text}</span>
                </div>
              );
            })}
          </div>
        );
      }
        
      default:
        return <p className="text-gray-500">Question type not supported</p>;
    }
  };
  
  if (!isOpen) return null;
  
  if (!testStarted) {
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center" style={{ background: 'rgba(26,26,46,0.75)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" style={{ border: '1px solid var(--lms-border)' }}>
          <div className="px-6 py-5 border-b" style={{ borderColor: T.border }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: T.greenLight }}>
                <ClipboardList className="h-5 w-5" style={{ color: T.green }} />
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: T.textMain }}>{testTitle}</h3>
                <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>Test your knowledge with {questions.length} questions</p>
              </div>
            </div>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl" style={{ background: T.pageBg }}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.textMuted }}>Total Questions</p>
                <p className="text-2xl font-bold mt-1" style={{ color: T.textMain }}>{questions.length}</p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: T.pageBg }}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.textMuted }}>Total Marks</p>
                <p className="text-2xl font-bold mt-1" style={{ color: T.textMain }}>{totalPossibleScore}</p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: T.pageBg }}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.textMuted }}>Duration</p>
                <p className="text-2xl font-bold mt-1" style={{ color: T.textMain }}>{questions.length} min</p>
              </div>
              <div className="p-4 rounded-xl" style={{ background: T.pageBg }}>
                <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: T.textMuted }}>Passing Score</p>
                <p className="text-2xl font-bold mt-1" style={{ color: T.textMain }}>70%</p>
              </div>
            </div>
            
            <div className="p-4 rounded-xl" style={{ background: T.blueLight, border: `1px solid ${T.blue}30` }}>
              <p className="text-xs font-semibold text-orange-600 mb-1">📋 Question Types Included:</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {Array.from(new Set(questions.map(q => getTypeLabel(q.type)))).map(type => (
                  <span key={type} className="text-xs px-2 py-1 rounded-full bg-white border border-orange-200 text-orange-600">{type}</span>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3 pt-4">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, color: T.textSub }}>
                Cancel
              </button>
              <button onClick={handleStart} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white" style={{ background: T.green, boxShadow: `0 2px 8px ${T.greenGlow}` }}>
                Start Test
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (showResults) {
    const percentage = score || 0;
    const passed = percentage >= 70;
    
    return (
      <div className="fixed inset-0 z-[2000] flex items-center justify-center" style={{ background: 'rgba(26,26,46,0.75)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" style={{ border: '1px solid var(--lms-border)' }}>
          <div className="px-6 py-5 border-b" style={{ borderColor: T.border }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: passed ? T.greenLight : '#fee2e2' }}>
                {passed ? <Trophy className="h-5 w-5" style={{ color: T.green }} /> : <AlertCircle className="h-5 w-5" style={{ color: '#ef4444' }} />}
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: T.textMain }}>Test Results</h3>
                <p className="text-xs mt-0.5" style={{ color: passed ? T.green : '#ef4444' }}>
                  {passed ? 'Congratulations! You passed the test.' : 'Keep practicing! You can try again.'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="p-6 text-center">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="w-32 h-32 rounded-full flex items-center justify-center" style={{ background: T.pageBg }}>
                <div>
                  <p className="text-3xl font-bold" style={{ color: passed ? T.green : '#ef4444' }}>{Math.round(percentage)}%</p>
                  <p className="text-xs mt-1" style={{ color: T.textMuted }}>Score</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 rounded-xl" style={{ background: T.pageBg }}>
                <p className="text-[10px] font-bold uppercase" style={{ color: T.textMuted }}>Correct Answers</p>
                <p className="text-xl font-bold mt-1" style={{ color: T.green }}>{Math.round(totalScore / (totalPossibleScore / questions.length))} / {questions.length}</p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: T.pageBg }}>
                <p className="text-[10px] font-bold uppercase" style={{ color: T.textMuted }}>Total Score</p>
                <p className="text-xl font-bold mt-1" style={{ color: T.textMain }}>{totalScore} / {totalPossibleScore}</p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={handleStart} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all" style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, color: T.textSub }}>
                Retry
              </button>
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all text-white" style={{ background: T.green }}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 z-[2000] flex flex-col" style={{ background: '#f9f9fb' }}>
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-white border-b" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: T.greenLight }}>
            <ClipboardList className="h-4 w-4" style={{ color: T.green }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: T.textMain }}>{testTitle}</p>
            <p className="text-[10px]" style={{ color: T.textMuted }}>Question {currentIndex + 1} of {questions.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: T.textMuted }} />
            <span className={`text-sm font-mono font-bold ${timeRemaining < 60 ? 'text-red-500' : ''}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
          <button onClick={handleSubmit} className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: T.green }}>
            Submit
          </button>
        </div>
      </div>
      
      <div className="flex-shrink-0 px-6 py-3 bg-white border-b" style={{ borderColor: T.border }}>
        <div className="flex gap-1.5 flex-wrap">
          {questions.map((q, idx) => {
            const status = answers[q.id] ? 'answered' : 'unanswered';
            const isActive = idx === currentIndex;
            return (
              <button
                key={q.id}
                onClick={() => {
                  saveCurrentAnswer();
                  setCurrentIndex(idx);
                }}
                className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${isActive ? 'text-white' : status === 'answered' ? 'text-green-600' : ''}`}
                style={{
                  background: isActive ? T.green : status === 'answered' ? T.greenLight : T.pageBg,
                  color: isActive ? '#fff' : status === 'answered' ? T.green : T.textMuted,
                  border: `1.5px solid ${isActive ? T.green : T.border}`
                }}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: T.pageBg, color: T.textMuted }}>
              {getTypeLabel(qType || 'multiple_choice')}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${LEVEL_COLORS[currentQuestion?.level || 'medium']}12`, color: LEVEL_COLORS[currentQuestion?.level || 'medium'] }}>
              {(currentQuestion?.level || 'medium').toUpperCase()}
            </span>
            <span className="text-[10px]" style={{ color: T.textMuted }}>{currentQuestion?.marks || 1} pts</span>
          </div>
          
          <div className="mb-6 p-4 rounded-lg" style={{ background: T.pageBg, border: `1px solid ${T.border}` }}>
            {renderRichContent(questionData?.mcqQuestionTitle)}
          </div>
          
          {questionData?.mcqQuestionDescription && (
            <div className="mb-4 p-3 rounded-lg" style={{ background: T.blueLight, border: `1px solid ${T.blue}30` }}>
              <div dangerouslySetInnerHTML={{ __html: questionData.mcqQuestionDescription }} className="text-sm text-gray-600" />
            </div>
          )}
          
          {renderQuestionInput()}
        </div>
      </div>
      
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-white border-t" style={{ borderColor: T.border }}>
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
          style={{ background: T.pageBg, border: `1.5px solid ${T.border}`, color: T.textSub }}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>
        <div className="text-xs text-gray-400">
          {getAnswerStatus() === 'answered' ? '✓ Answered' : '◯ Not answered'}
        </div>
        {currentIndex < questions.length - 1 ? (
          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: T.green }}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: T.green }}
          >
            Submit Test <CheckCircle className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TestYourSkills({
  nodeId,
  nodeName,
  subcategory,
  subcategoryLabel,
  courseId,
  nodeType,
  hierarchyData,
  configuredLanguages,
  onRefresh,
}: YouDoProps) {
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showCreateOptionModal, setShowCreateOptionModal] = useState(false);
  const [showMockTestModal, setShowMockTestModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionRecord | null>(null);
  const [editingQuestionData, setEditingQuestionData] = useState<any>(null);
  const [openDrop, setOpenDrop] = useState<string | null>(null);
  const [dropUpward, setDropUpward] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fullQuestionData, setFullQuestionData] = useState<any[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [allQuestionsForModal, setAllQuestionsForModal] = useState<any[]>([]);
  const [isLoadingModal, setIsLoadingModal] = useState(false);
  const [showQuestionBankModal, setShowQuestionBankModal] = useState(false);
  const [existingQuestionIdsForBank, setExistingQuestionIdsForBank] = useState<string[]>([]);
  
  // State for single delete confirmation
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionRecord | null>(null);
  
  // State for bulk delete
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Helper function to get entity path
 

  // Selection handlers
  const handleSelectQuestion = (questionId: string, checked: boolean) => {
    setSelectedQuestions(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(questionId);
      } else {
        newSet.delete(questionId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredQuestions.map(q => q.id);
      setSelectedQuestions(new Set(allIds));
    } else {
      setSelectedQuestions(new Set());
    }
  };

  const handleBulkDelete = () => {
    if (selectedQuestions.size === 0) {
      toast.error('Please select questions to delete');
      return;
    }
    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedQuestions.size === 0) return;
    
    setShowBulkDeleteConfirm(false);
    setIsLoading(true);
    
    try {
      const entityType = getEntityTypeFromNodeType(nodeType);
      let successCount = 0;
      let errorCount = 0;
      
      for (const questionId of selectedQuestions) {
        const question = questions.find(q => q.id === questionId);
        if (question) {
          try {
            await youDoMcqApi.deleteQuestion(entityType, nodeId, question.testItemKey, question.id);
            successCount++;
          } catch (err) {
            console.error('Failed to delete question:', question.title, err);
            errorCount++;
          }
        }
      }
      
      await loadQuestions();
      if (onRefresh) await onRefresh();
      setSelectedQuestions(new Set());
      
      if (successCount > 0) {
        toast.success(`${successCount} question(s) deleted successfully!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
      } else if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} question(s)`);
      }
    } catch (err: any) {
      console.error("Failed to delete questions:", err);
      toast.error(err.message || "Failed to delete questions");
    } finally {
      setIsLoading(false);
    }
  };

  const cancelBulkDelete = () => {
    setShowBulkDeleteConfirm(false);
  };

  const handleAddFromQuestionBank = async () => {
    const existingIds = questions.map(q => q.id);
    setExistingQuestionIdsForBank(existingIds);
    setShowQuestionBankModal(true);
  };

const handleBankQuestionsSelected = async (selectedQuestions: any[]) => {
  setShowQuestionBankModal(false);
  setIsLoading(true);
  
  try {
    const entityType = getEntityTypeFromNodeType(nodeType);
    const testItemKey = "test_your_skills"; // Use consistent testItemKey
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const bankQuestion of selectedQuestions) {
      try {
        // Determine question type
        let mcqType = bankQuestion.mcqQuestionType || bankQuestion.questionType || 'multiple_choice';
        if (mcqType === 'mcq') mcqType = 'multiple_choice';
        
        // Extract question title
        let questionTitle = '';
        if (bankQuestion.mcqQuestionTitle) {
          if (typeof bankQuestion.mcqQuestionTitle === 'string') {
            questionTitle = bankQuestion.mcqQuestionTitle;
          } else if (bankQuestion.mcqQuestionTitle.text) {
            questionTitle = bankQuestion.mcqQuestionTitle.text;
          } else if (Array.isArray(bankQuestion.mcqQuestionTitle)) {
            questionTitle = bankQuestion.mcqQuestionTitle
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.value || '')
              .join(' ')
              .replace(/<[^>]*>/g, '');
          }
        } else if (bankQuestion.questionTitle) {
          questionTitle = bankQuestion.questionTitle;
        } else if (bankQuestion.title) {
          questionTitle = bankQuestion.title;
        }
        
        // Build options array
        let options: any[] = [];
        let correctAnswers: string[] = [];
        
        if (bankQuestion.mcqQuestionOptions && Array.isArray(bankQuestion.mcqQuestionOptions)) {
          options = bankQuestion.mcqQuestionOptions.map((opt: any) => ({
            text: opt.text || '',
            isCorrect: opt.isCorrect || false,
            imageUrl: opt.imageUrl || null,
            imageAlignment: opt.imageAlignment || 'left',
            imageSizePercent: opt.imageSizePercent || 60
          }));
          correctAnswers = options.filter((opt: any) => opt.isCorrect).map((opt: any) => opt.text);
        } else if (bankQuestion.options && Array.isArray(bankQuestion.options)) {
          options = bankQuestion.options.map((opt: any, idx: number) => ({
            text: typeof opt === 'string' ? opt : (opt.text || `Option ${idx + 1}`),
            isCorrect: opt.isCorrect === true,
            imageUrl: opt.imageUrl || null,
            imageAlignment: opt.imageAlignment || 'left',
            imageSizePercent: opt.imageSizePercent || 60
          }));
          correctAnswers = options.filter((opt: any) => opt.isCorrect).map((opt: any) => opt.text);
        }
        
        // Fallback for correct answers
        if (correctAnswers.length === 0 && bankQuestion.mcqQuestionCorrectAnswers) {
          correctAnswers = bankQuestion.mcqQuestionCorrectAnswers;
        }
        
        // Set difficulty
        let difficulty = bankQuestion.mcqQuestionDifficulty || bankQuestion.difficulty || 'medium';
        difficulty = difficulty.toLowerCase();
        if (!['easy', 'medium', 'hard'].includes(difficulty)) difficulty = 'medium';
        
        // Set score
        const score = bankQuestion.mcqQuestionScore || bankQuestion.score || 1;
        
        // Build the question data payload
        const questionData: any = {
          mcqQuestionType: mcqType,
          mcqQuestionTitle: questionTitle || 'Untitled Question',
          mcqQuestionDescription: bankQuestion.mcqQuestionDescription || bankQuestion.description || '',
          mcqQuestionOptions: options,
          mcqQuestionCorrectAnswers: correctAnswers,
          mcqQuestionScore: score,
          mcqQuestionDifficulty: difficulty,
          isActive: true,
          explanation: bankQuestion.explanation || '',
          testSettings: { timeLimit: 60 }
        };
        
        // Handle specific question types
        if (mcqType === 'true_false') {
          questionData.trueFalseAnswer = correctAnswers[0] === 'true';
        }
        if (mcqType === 'short_answer') {
          questionData.shortAnswer = correctAnswers[0] || '';
        }
        if (mcqType === 'numeric') {
          questionData.numericAnswer = parseFloat(correctAnswers[0]) || 0;
          questionData.numericTolerance = bankQuestion.numericTolerance || 0;
        }
        if (mcqType === 'matching' && bankQuestion.matchingPairs) {
          questionData.matchingPairs = bankQuestion.matchingPairs;
        }
        if (mcqType === 'ordering' && bankQuestion.orderingItems) {
          questionData.orderingItems = bankQuestion.orderingItems;
        }
        
        // Create the test data for a single question
        // This will be appended to existing test_your_skills questions
        const testData = {
          title: questionTitle.substring(0, 50),
          description: `Question imported from bank`,
          timeLimit: 60,
          passingScore: 70,
          attemptLimit: 3,
          shuffleQuestions: false,
          showResults: true,
          pointsPerQuestion: score,
          questionsData: [questionData], // Single question array
          // Resources by Batch — this is a raw `fetch`, so the axios
          // interceptor that stamps the batch onto every other call does not
          // see it. Without this the question is written to the shared,
          // course-level container and every batch would get it.
          ...withBatchBody({}),
        };

        const token = getToken();
        const entityPath = getEntityTypeFromNodeType(nodeType);
        const path = getEntityPath(entityPath);
        
        // IMPORTANT: Use the same testItemKey "test_your_skills" for all questions
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://lmsserver-yeve.onrender.com'}/you-do/createquestion/${path}/${nodeId}/you-do/${testItemKey}/mcq`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(testData)
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to create question`);
        }
        
        successCount++;
        
      } catch (err) {
        console.error('Failed to create question:', err);
        errorCount++;
      }
    }
    
    // Refresh the questions list
    await loadQuestions();
    if (onRefresh) await onRefresh();
    
    // Show result toast
    if (successCount > 0) {
      toast.success(`${successCount} question(s) added from bank!${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
    } else if (errorCount > 0) {
      toast.error(`Failed to add ${errorCount} question(s) from bank`);
    }
    
  } catch (err: any) {
    console.error("Failed to add questions from bank:", err);
    toast.error(err.message || "Failed to add questions from bank");
  } finally {
    setIsLoading(false);
  }
};

// Helper function to get entity path (add this if not already present)
const getEntityPath = (entityType: string): string => {
  const pathMap: Record<string, string> = {
    'modules': 'modules',
    'module': 'modules',
    'submodules': 'submodules',
    'submodule': 'submodules',
    'topics': 'topics',
    'topic': 'topics',
    'subtopics': 'subtopics',
    'subtopic': 'subtopics'
  };
  return pathMap[entityType] || 'topics';
};
const loadQuestions = async () => {
  if (!nodeId?.trim()) {
    setQuestions([]);
    setIsLoading(false);
    return;
  }
  
  setIsLoading(true);
  setError(null);
  try {
    const entityType = getEntityTypeFromNodeType(nodeType);
    // This should get all questions under test_your_skills
    const response = await youDoMcqApi.getAllQuestions(entityType, nodeId);
    
    // Handle different response structures
    let questionsData = [];
    if (response.data) {
      questionsData = response.data;
    } else if (response.questions) {
      questionsData = response.questions;
    } else if (Array.isArray(response)) {
      questionsData = response;
    } else {
      questionsData = [];
    }
    
    setFullQuestionData(questionsData);
    
    const transformedQuestions: QuestionRecord[] = questionsData.map((q: any) => {
      let title = "Untitled Question";
      
      if (typeof q.mcqQuestionTitle === 'string') {
        title = q.mcqQuestionTitle.replace(/<[^>]*>/g, '').trim();
      } else if (Array.isArray(q.mcqQuestionTitle)) {
        const textBlocks = q.mcqQuestionTitle
          .filter((block: any) => block.type === 'text')
          .map((block: any) => {
            const value = block.value || '';
            return value.replace(/<[^>]*>/g, '').trim();
          })
          .filter(Boolean)
          .join(' ');
        title = textBlocks || "Untitled Question";
      } else if (q.mcqQuestionTitle && typeof q.mcqQuestionTitle === 'object') {
        title = q.mcqQuestionTitle.value || q.mcqQuestionTitle.text || "Untitled Question";
      }
      
      return {
        id: q._id || q.questionId,
        testItemKey: q.testItemKey || "test_your_skills",
        title: title,
        type: q.mcqQuestionType || "multiple_choice",
        duration: q.testSettings?.timeLimit || 60,
        marks: q.mcqQuestionScore || 1,
        level: q.mcqQuestionDifficulty || "medium",
        status: q.isActive ? "active" : "draft",
        createdAt: q.createdAt || new Date().toISOString(),
        sequence: q.sequence || 0,
        questionData: q,
      };
    });
    
    const sorted = transformedQuestions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    setQuestions(sorted);
    
  } catch (err: any) {
    console.error("Failed to load questions:", err);
    setError(err.message || "Failed to load questions");
    if (err.message?.includes('not found') || err.response?.status === 404) {
      setQuestions([]);
      setError(null);
    }
  } finally {
    setIsLoading(false);
  }
};

  // Resources by Batch — the active batch is a dependency of this list, not
  // just of the request. Without it the questions loaded for the previously
  // selected batch stay on screen after the batch strip is switched, and the
  // switch looks like it did nothing.
  useEffect(() => {
    loadQuestions();
  }, [nodeId, nodeType, getActiveBatchId()]);

  const loadQuestionsForModal = async () => {
    if (!nodeId?.trim()) return [];
    
    setIsLoadingModal(true);
    try {
      const entityType = getEntityTypeFromNodeType(nodeType);
      const response = await youDoMcqApi.getAllQuestions(entityType, nodeId);
      const questionsData = response.data || [];
      
      const mapApiTypeToInternal = (type: string): string => {
        const mapping: Record<string, string> = {
          multiple_choice: 'multiple-choice',
          multiple_select: 'multiple-select',
          true_false: 'true-false',
          short_answer: 'short-answer',
          essay: 'paragraph',
          matching: 'matching',
          ordering: 'ordering',
          numeric: 'numeric',
          dropdown: 'dropdown'
        };
        return mapping[type] || 'multiple-choice';
      };
      
      const existingQuestions = questionsData.map((q: any, idx: number) => {
        let questionContent: any[] = [];
        let questionText = '';
        
        if (q.mcqQuestionTitle) {
          if (typeof q.mcqQuestionTitle === 'string') {
            questionText = q.mcqQuestionTitle;
            questionContent = [{ id: `txt-${idx}`, type: 'text', value: q.mcqQuestionTitle }];
          } else if (Array.isArray(q.mcqQuestionTitle)) {
            questionContent = q.mcqQuestionTitle;
            questionText = q.mcqQuestionTitle
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.value || '')
              .join(' ')
              .replace(/<[^>]*>/g, '')
              .trim();
          }
        }
        
        const options = (q.mcqQuestionOptions || []).map((opt: any, optIdx: number) => ({
          id: opt._id || `opt-${idx}-${optIdx}`,
          text: opt.text || '',
          isCorrect: opt.isCorrect || false,
          imageUrl: opt.imageUrl || '',
          imageAlignment: opt.imageAlignment || 'center',
          imageSizePercent: opt.imageSizePercent || 60,
        }));
        
        return {
          id: q._id,
          dbId: q._id,
          origin: 'db',
          type: mapApiTypeToInternal(q.mcqQuestionType || 'multiple_choice'),
          questionText: questionText,
          title: questionText || 'Untitled Question',
          questionContent: questionContent,
          options: options,
          score: q.mcqQuestionScore || 0,
          difficulty: (q.mcqQuestionDifficulty || 'medium') as 'easy' | 'medium' | 'hard' | '',
          hasExplanation: !!(q.explanation || q.mcqQuestionDescription),
          explanation: q.explanation || q.mcqQuestionDescription || '',
          isRequired: q.mcqQuestionRequired || false,
          hasOtherOption: q.hasOtherOption || false,
          optionsPerRow: q.mcqQuestionOptionsPerRow || 1,
          questionImageUrl: q.mcqQuestionImageUrl || '',
          questionImageAlignment: q.mcqQuestionImageAlignment || 'center',
          questionImageSizePercent: q.mcqQuestionImageSizePercent || 60,
          trueFalseAnswer: q.trueFalseAnswer ?? null,
          shortAnswer: q.shortAnswer || '',
          numericAnswer: q.numericAnswer ?? null,
          numericTolerance: q.numericTolerance ?? null,
          matchingPairs: (q.matchingPairs || []).map((p: any, pi: number) => ({
            id: `pair-${idx}-${pi}`,
            left: p.left || '',
            right: p.right || ''
          })),
          orderingItems: (q.orderingItems || []).map((item: any, oi: number) => ({
            id: `ord-${idx}-${oi}`,
            text: item.text || '',
            order: item.order || oi + 1
          })),
          isActive: true,
          sequence: idx,
          isDirty: false,
        };
      });
      
      setAllQuestionsForModal(existingQuestions);
      return existingQuestions;
    } catch (err) {
      console.error("Failed to load questions for modal:", err);
      return [];
    } finally {
      setIsLoadingModal(false);
    }
  };

  const handleAddQuestion = () => {
    setEditingQuestion(null);
    setShowCreateOptionModal(true);
  };

  const handleAddQuestionFromScratch = async () => {
    setEditingQuestion(null);
    setIsLoadingModal(true);
    
    try {
      const entityType = getEntityTypeFromNodeType(nodeType);
      const response = await youDoMcqApi.getAllQuestions(entityType, nodeId);
      const questionsData = response.data || [];
      
      const mapApiTypeToInternal = (type: string): string => {
        const mapping: Record<string, string> = {
          multiple_choice: 'multiple-choice',
          multiple_select: 'multiple-select',
          true_false: 'true-false',
          short_answer: 'short-answer',
          essay: 'paragraph',
          matching: 'matching',
          ordering: 'ordering',
          numeric: 'numeric',
          dropdown: 'dropdown'
        };
        return mapping[type] || 'multiple-choice';
      };
      
      const existingQuestions = questionsData.map((q: any, idx: number) => {
        let questionContent: any[] = [];
        let questionText = '';
        
        if (q.mcqQuestionTitle) {
          if (typeof q.mcqQuestionTitle === 'string') {
            questionText = q.mcqQuestionTitle;
            questionContent = [{ id: `txt-${idx}`, type: 'text', value: q.mcqQuestionTitle }];
          } else if (Array.isArray(q.mcqQuestionTitle)) {
            questionContent = q.mcqQuestionTitle;
            questionText = q.mcqQuestionTitle
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.value || '')
              .join(' ')
              .replace(/<[^>]*>/g, '')
              .trim();
          }
        }
        
        const options = (q.mcqQuestionOptions || []).map((opt: any, optIdx: number) => ({
          id: opt._id || `opt-${idx}-${optIdx}`,
          text: opt.text || '',
          isCorrect: opt.isCorrect || false,
          imageUrl: opt.imageUrl || '',
          imageAlignment: opt.imageAlignment || 'center',
          imageSizePercent: opt.imageSizePercent || 60,
        }));
        
        return {
          id: q._id,
          dbId: q._id,
          origin: 'db',
          type: mapApiTypeToInternal(q.mcqQuestionType || 'multiple_choice'),
          questionText: questionText,
          title: questionText || 'Untitled Question',
          questionContent: questionContent,
          options: options,
          score: q.mcqQuestionScore || 0,
          difficulty: (q.mcqQuestionDifficulty || 'medium') as 'easy' | 'medium' | 'hard' | '',
          hasExplanation: !!(q.explanation || q.mcqQuestionDescription),
          explanation: q.explanation || q.mcqQuestionDescription || '',
          isRequired: q.mcqQuestionRequired || false,
          hasOtherOption: q.hasOtherOption || false,
          optionsPerRow: q.mcqQuestionOptionsPerRow || 1,
          questionImageUrl: q.mcqQuestionImageUrl || '',
          questionImageAlignment: q.mcqQuestionImageAlignment || 'center',
          questionImageSizePercent: q.mcqQuestionImageSizePercent || 60,
          trueFalseAnswer: q.trueFalseAnswer ?? null,
          shortAnswer: q.shortAnswer || '',
          numericAnswer: q.numericAnswer ?? null,
          numericTolerance: q.numericTolerance ?? null,
          matchingPairs: (q.matchingPairs || []).map((p: any, pi: number) => ({
            id: `pair-${idx}-${pi}`,
            left: p.left || '',
            right: p.right || ''
          })),
          orderingItems: (q.orderingItems || []).map((item: any, oi: number) => ({
            id: `ord-${idx}-${oi}`,
            text: item.text || '',
            order: item.order || oi + 1
          })),
          isActive: true,
          sequence: idx,
          isDirty: false,
        };
      });
      
      setEditingQuestionData(existingQuestions);
      setShowModal(true);
    } catch (err: any) {
      console.error("Failed to load existing questions:", err);
      setEditingQuestionData([]);
      setShowModal(true);
    } finally {
      setIsLoadingModal(false);
    }
  };

  const handleDocumentUpload = () => {
    setShowCreateOptionModal(false);
    setShowDocumentModal(true);
  };

  const handleDocumentClose = () => {
    setShowDocumentModal(false);
  };

  const handleDocumentInserted = async (count: number) => {
    toast.success(`${count} question(s) added via document!`);
    await loadQuestions();
    if (onRefresh) await onRefresh();
    setShowDocumentModal(false);
  };

  const handleEdit = async (question: QuestionRecord) => {
    try {
      let existingQuestions = allQuestionsForModal;
      if (existingQuestions.length === 0) {
        existingQuestions = await loadQuestionsForModal();
      }
      
      if (existingQuestions.length === 0) {
        toast.error('No questions found to edit.');
        return;
      }
      
      setEditingQuestion(question);
      setEditingQuestionData(existingQuestions);
      setShowModal(true);
      setOpenDrop(null);
    } catch (err: any) {
      console.error("Failed to load questions for edit:", err);
      toast.error(err.message || "Failed to load questions");
    }
  };

  // Single delete with confirmation
  const handleDelete = (question: QuestionRecord) => {
    setQuestionToDelete(question);
    setShowDeleteConfirmModal(true);
    setOpenDrop(null);
  };

  const confirmDelete = async () => {
    if (!questionToDelete) return;
    
    setShowDeleteConfirmModal(false);
    setIsLoading(true);
    
    try {
      const entityType = getEntityTypeFromNodeType(nodeType);
      await youDoMcqApi.deleteQuestion(entityType, nodeId, questionToDelete.testItemKey, questionToDelete.id);
      await loadQuestions();
      if (onRefresh) await onRefresh();
      toast.success('Question deleted successfully!');
      setQuestionToDelete(null);
    } catch (err: any) {
      console.error("Failed to delete question:", err);
      toast.error(err.message || "Failed to delete question");
    } finally {
      setIsLoading(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setQuestionToDelete(null);
  };

  const handleStartQuestion = (question: QuestionRecord) => {
    setFullQuestionData([question.questionData]);
    setShowMockTestModal(true);
    setOpenDrop(null);
  };

  const handleMockTest = () => {
    if (questions.length === 0) {
      toast.error('No questions available. Please add questions first.');
      return;
    }
    setShowMockTestModal(true);
    setOpenDrop(null);
  };

  const handleViewResults = (question: QuestionRecord) => {
    toast.success(`Viewing results for: ${question.title}`);
    setOpenDrop(null);
  };

  React.useEffect(() => {
    const h = (e: MouseEvent) => { 
      if (!(e.target as Element).closest(".ts-dd")) setOpenDrop(null); 
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggleDrop = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (openDrop === id) { setOpenDrop(null); return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropUpward(window.innerHeight - rect.bottom < 180);
    setOpenDrop(id);
  };

  const getFilteredQuestions = () => {
    let filtered = questions;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(qs => 
        qs.title.toLowerCase().includes(q) || 
        qs.id.toLowerCase().includes(q)
      );
    }
    return filtered;
  };

  const filteredQuestions = getFilteredQuestions();
  
  // Table header styles
  const thCls = "text-[9px] font-black uppercase tracking-[0.12em]";
  
  const rowBase: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "40px minmax(0,2.5fr) 120px 120px 100px 90px 80px",
    gap: 12, 
    alignItems: "center",
    padding: "11px 16px",
    borderBottom: `1px solid ${T.border}`,
    transition: "all 0.14s",
    borderLeft: "2.5px solid transparent",
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ background: T.bg }}>
        <Loader2 size={32} className="animate-spin" style={{ color: T.green }} />
        <p className="mt-3 text-sm font-medium" style={{ color: T.textMuted }}>Loading questions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ background: T.bg }}>
        <AlertCircle size={32} style={{ color: "#ef4444" }} />
        <p className="mt-3 text-sm font-medium" style={{ color: "#ef4444" }}>{error}</p>
        <button
          onClick={loadQuestions}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: T.green, color: "#fff" }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: "'Poppins',-apple-system,sans-serif", background: T.bg }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 py-3.5"
        style={{ background: T.bg, borderBottom: `1px solid ${T.border}`, borderLeft: `3px solid ${T.green}` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: T.greenLight, border: `1px solid ${T.green}25` }}
          >
            <BookOpen size={16} style={{ color: T.green }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold tracking-tight" style={{ color: T.textMain }}>
              {subcategoryLabel}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] font-semibold" style={{ color: T.textHint }}>{hierarchyData.courseName}</span>
              {nodeName && (
                <>
                  <ChevronRight size={8} style={{ color: T.textHint }} />
                  <span className="text-[10px] font-semibold" style={{ color: T.green }}>{nodeName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Selection controls */}
          {filteredQuestions.length > 0 && (
            <div className="flex items-center gap-3 mr-2">
          
              
              {selectedQuestions.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white"
                  style={{ background: '#ef4444', boxShadow: '0 2px 6px rgba(239,68,68,0.3)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}
                >
                  <Trash2 size={12} />
                  Delete ({selectedQuestions.size})
                </button>
              )}
            </div>
          )}
          
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#bcbccc' }} />
            <input
              placeholder="Search questions…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-7 pr-7 h-7 w-44 text-[12px] rounded-lg outline-none transition-all"
              style={{ background: '#fafafa', border: '1.5px solid #e4e4ed', color: '#1a1a2e' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#F27757'; e.currentTarget.style.background = '#fff'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e4e4ed'; e.currentTarget.style.background = '#fafafa'; }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X size={11} style={{ color: '#bcbccc' }} />
              </button>
            )}
          </div>

          <button
            onClick={loadQuestions}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11.5px] font-medium"
            style={{ background: T.pageBg, color: T.textSub, border: `1px solid ${T.border}` }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.green; (e.currentTarget as HTMLElement).style.color = T.green; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.border; (e.currentTarget as HTMLElement).style.color = T.textSub; }}
          >
            <RefreshCw size={12} /> Refresh
          </button>

          <button
            onClick={() => setShowPreviewModal(true)}
            disabled={questions.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11.5px] font-bold text-white flex-shrink-0"
            style={{ 
              background: '#6366f1', 
              boxShadow: '0 3px 12px rgba(99,102,241,0.22)',
              opacity: questions.length === 0 ? 0.5 : 1,
              cursor: questions.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Eye size={13} strokeWidth={2.5} />
            Preview ({questions.length})
          </button>

          <button
            onClick={handleMockTest}
            disabled={questions.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11.5px] font-bold text-white flex-shrink-0"
            style={{ 
              background: '#8b5cf6', 
              boxShadow: '0 3px 12px rgba(139,92,246,0.22)',
              opacity: questions.length === 0 ? 0.5 : 1,
              cursor: questions.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <ClipboardList size={13} strokeWidth={2.5} />
            Mock Test ({questions.length})
          </button>

          <button
            onClick={handleAddQuestion}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11.5px] font-bold text-white flex-shrink-0"
            style={{ background: T.green, boxShadow: `0 3px 12px ${T.greenGlow}`, transition: "all 0.18s" }}
          >
            <Plus size={13} strokeWidth={2.5} />
            Add Question
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: `${T.border} transparent` }}>
        {searchQuery && (
          <div className="flex items-center gap-2 px-4 py-1.5 mx-4 mt-3 mb-3 rounded-lg" style={{ background: 'rgba(242,119,87,0.05)', border: '1px solid rgba(242,119,87,0.15)' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#F27757' }}>Filtering:</span>
            <button onClick={() => setSearchQuery('')} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(242,119,87,0.1)', color: '#F27757' }}>
              "{searchQuery}" <X size={9} />
            </button>
            <span className="text-[10px] ml-auto" style={{ color: '#F27757' }}>{filteredQuestions.length} result{filteredQuestions.length !== 1 ? 's' : ''}</span>
          </div>
        )}

        {/* Flush list — no card margins, the table runs edge to edge. */}
        <div style={{ background: T.bg }}>

          {/* Table Header - with Select All checkbox */}
          <div
            style={{
              ...rowBase,
              background: T.pageBg,
              borderBottom: `1px solid ${T.border}`,
              borderLeft: "2.5px solid transparent",
              padding: "8px 16px",
            }}
          >
            {/* Select All Checkbox Column */}
            <div className={thCls}>
              <input
                type="checkbox"
                checked={selectedQuestions.size === filteredQuestions.length && filteredQuestions.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
              />
            </div>
            <div className={thCls}>Question</div>
            <div className={thCls}>Created</div>
            <div className={thCls}>Type</div>
            <div className={thCls}>Difficulty</div>
            <div className={thCls}>Status</div>
            <div className={thCls}>Actions</div>
          </div>

          {filteredQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: T.greenLight, border: `1.5px dashed ${T.green}40` }}>
                <BookOpen size={22} style={{ color: T.green }} strokeWidth={1.5} />
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: T.green, color: "#fff" }}>
                  <Plus size={10} strokeWidth={3} />
                </div>
              </div>
              <p className="text-[14px] font-bold mb-1" style={{ color: T.textMain }}>{searchQuery ? 'No matching questions' : 'No Questions Yet'}</p>
              <p className="text-[11px] font-medium mb-5 max-w-[220px] leading-relaxed" style={{ color: T.textMuted }}>
                {searchQuery ? 'Try adjusting your search query.' : 'Add your first question to start evaluating students\' skills.'}
              </p>
              {!searchQuery && (
                <button onClick={handleAddQuestion} className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[11px] font-bold text-white" style={{ background: T.green, boxShadow: `0 4px 12px ${T.greenGlow}` }}>
                  <Plus size={12} strokeWidth={2.5} />Add Question
                </button>
              )}
            </div>
          ) : (
            filteredQuestions.map((question, idx) => {
              const typeMeta = TYPE_META[question.type] || TYPE_META.multiple_choice;
              const lc = LEVEL_COLORS[question.level] || T.textMuted;
              const isLast = idx === filteredQuestions.length - 1;
              const createdDate = question.createdAt ? new Date(question.createdAt).toLocaleDateString() : 'N/A';
              const isSelected = selectedQuestions.has(question.id);

              return (
                <div
                  key={question.id}
                  style={{
                    ...rowBase,
                    borderBottom: isLast ? "none" : `1px solid ${T.border}`,
                    background: T.bg,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.warm; (e.currentTarget as HTMLElement).style.borderLeftColor = T.green; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.bg; (e.currentTarget as HTMLElement).style.borderLeftColor = "transparent"; }}
                >
                  {/* Checkbox Column */}
                  <div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleSelectQuestion(question.id, e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Question Column */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[12px] font-bold truncate" style={{ color: T.textMain }}>{question.title}</span>
                    <span className="text-[9.5px] font-medium" style={{ color: T.textHint }}>{question.id.slice(-8)}</span>
                  </div>

                  {/* Created Column */}
                  <div className="text-[10.5px] font-medium" style={{ color: T.textMuted }}>
                    {createdDate}
                  </div>

                  {/* Type Column */}
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide" style={{ background: typeMeta.bg, color: typeMeta.color }}>
                      {typeMeta.icon}{typeMeta.label}
                    </span>
                  </div>

                  {/* Difficulty Column */}
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide" style={{ background: `${lc}12`, color: lc }}>
                      {question.level.charAt(0).toUpperCase() + question.level.slice(1)}
                    </span>
                  </div>

                  {/* Status Column */}
                  <div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide" style={{ background: T.greenLight, color: T.green }}>
                      {question.status === "active" ? "Active" : "Draft"}
                    </span>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center justify-end relative ts-dd">
                    <button
                      type="button"
                      onClick={e => toggleDrop(question.id, e)}
                      className="p-1.5 rounded-lg"
                      style={{ color: T.textHint, transition: "all 0.12s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.pageBg; (e.currentTarget as HTMLElement).style.color = T.textMain; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = T.textHint; }}
                    >
                      <MoreVertical size={13} />
                    </button>

                    {openDrop === question.id && (
                      <DropMenu upward={dropUpward}>
                        <DropItem icon={<Play size={11} />} label="Start" onClick={() => handleStartQuestion(question)} />
                        <DropItem icon={<Edit2 size={11} />} label="Edit" onClick={() => handleEdit(question)} />
                        <DropItem icon={<Trash2 size={11} />} label="Delete" color="#ef4444" divider onClick={() => handleDelete(question)} />
                      </DropMenu>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateOptionModal
        isOpen={showCreateOptionModal}
        onClose={() => setShowCreateOptionModal(false)}
        onSelectFromScratch={() => {
          setShowCreateOptionModal(false);
          handleAddQuestionFromScratch();
        }}
        onSelectFromBank={() => {
          setShowCreateOptionModal(false);
          handleAddFromQuestionBank();
        }}
        onSelectFromDocument={() => {
          handleDocumentUpload();
        }}
      />
      
      {showModal && (
        <CreateTestModal
          breadcrumbs={[
            { name: hierarchyData.courseName, type: 'course' },
            { name: hierarchyData.moduleName, type: 'module' },
            ...(hierarchyData.submoduleName ? [{ name: hierarchyData.submoduleName, type: 'submodule' }] : []),
            { name: hierarchyData.topicName || nodeName, type: 'topic' },
          ].filter(Boolean)}
          onClose={() => { 
            setShowModal(false); 
            setEditingQuestion(null); 
            setEditingQuestionData(null);
          }}
          defaultTopic={hierarchyData.topicName || nodeName}
          nodeId={nodeId}
          nodeType={nodeType}
          onSave={async (questions) => {
            console.log('Questions saved:', questions);
            setIsLoading(true);
            try {
              await loadQuestions();
              await loadQuestionsForModal();
              if (onRefresh) await onRefresh();
              toast.success('Question(s) added successfully!');
            } catch (err) {
              console.error('Failed to refresh:', err);
              toast.error('Failed to save question');
            } finally {
              setIsLoading(false);
              setShowModal(false);
              setEditingQuestion(null);
              setEditingQuestionData(null);
            }
          }}
          initialQuestions={editingQuestionData || []}
          testName=""
          testDescription=""
          editingTest={null}
        />
      )}

      {showDocumentModal && (
        <AddQuestionViaDocument
          exerciseData={{
            exerciseId: "test_your_skills",
            exerciseName: subcategoryLabel,
            exerciseLevel: "medium",
            nodeId: nodeId,
            nodeName: nodeName,
            nodeType: nodeType,
            subcategory: subcategory,
            fullExerciseData: {}
          }}
          tabType="You_Do"
          onClose={handleDocumentClose}
          onInserted={handleDocumentInserted}
          breadcrumbs={[
            { name: hierarchyData.courseName, type: 'course' },
            { name: hierarchyData.moduleName, type: 'module' },
            ...(hierarchyData.submoduleName ? [{ name: hierarchyData.submoduleName, type: 'submodule' }] : []),
            { name: hierarchyData.topicName || nodeName, type: 'topic' },
          ].filter(Boolean)}
        />
      )}
      
      {showQuestionBankModal && (
        <TestYourSKillsQuestionBanklist
          exerciseData={{
            exerciseId: nodeId,
            exerciseName: subcategoryLabel,
            exerciseLevel: "medium",
            nodeId: nodeId,
            nodeName: nodeName,
            subcategory: subcategory,
            nodeType: nodeType,
            fullExerciseData: hierarchyData,
            exerciseType: "MCQ"
          }}
          tabType="You_Do"
          onClose={() => setShowQuestionBankModal(false)}
          onBack={() => {
            setShowQuestionBankModal(false);
            setShowCreateOptionModal(true);
          }}
          onSelect={handleBankQuestionsSelected}
          existingQuestionIds={existingQuestionIdsForBank}
          existingQuestions={questions}
        />
      )}
      
      <PreviewModal
        isOpen={showPreviewModal}
        questions={questions}
        onClose={() => setShowPreviewModal(false)}
        testTitle={`${subcategoryLabel} - Question Preview`}
      />

      <MockTestModal
        isOpen={showMockTestModal}
        questions={questions}
        onClose={() => setShowMockTestModal(false)}
        testTitle={`${subcategoryLabel} - Mock Test`}
      />

      {/* Single Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteConfirmModal}
        questionTitle={questionToDelete?.title || ''}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      {/* Bulk Delete Confirmation Modal */}
      <BulkDeleteConfirmationModal
        isOpen={showBulkDeleteConfirm}
        count={selectedQuestions.size}
        onConfirm={confirmBulkDelete}
        onCancel={cancelBulkDelete}
      />
      
      <style jsx global>{`
        @keyframes tsFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}