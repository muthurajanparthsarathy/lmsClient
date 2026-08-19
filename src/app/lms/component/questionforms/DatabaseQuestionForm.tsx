import { getToken } from "@/lib/session";
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X, Plus, Trash2, Save, Loader2, Check, AlertCircle,
  Eye, Database, Award, GraduationCap, ChevronDown, ChevronUp,
  AlertTriangle, Play, Terminal, Hash, Table, FileText, Zap,
  CheckCircle2, ArrowRight, Flag, BarChart3, Code, Image,
  CloudUpload, Loader, ChevronLeft, ChevronRight, Edit2,
  Layers, ArrowLeftRight, BookOpen, Clock, Target, Sparkles,
  Settings,
} from 'lucide-react';
import { parseDatabaseFile } from '@/app/lms/component/questionforms/parseQuestionsTxt';
import { toast } from 'react-toastify';
import QuestionBankSelector from './mcq/QuestionBankSelector';
import GenerateProgFamilyAI from './GenerateProgFamilyAI';

// ─── FONT INJECTION ────────────────────────────────────────────────────────────
const injectFonts = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href =
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap';
    document.head.appendChild(link);
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --lms-orange:        #F27757;
        --lms-orange-dark:   #e0623f;
        --lms-orange-glow:   rgba(242,119,87,0.22);
        --lms-orange-light:  rgba(242,119,87,0.08);
        --lms-orange-50:     #FEF3EF;
        --lms-orange-100:    #FDDDD4;
        --lms-text-main:     #1a1a2e;
        --lms-text-sec:      #3a3a52;
        --lms-text-muted:    #55556e;
        --lms-text-hint:     #9a9ab0;
        --lms-border:        #e4e4ed;
        --lms-border-hover:  #d0d0de;
        --lms-bg-white:      #ffffff;
        --lms-bg-surface:    #f7f7fb;
        --lms-bg-surface2:   #f0f0f7;
        --lms-success:       #16a34a;
        --lms-success-bg:    #f0fdf4;
        --lms-success-bdr:   #bbf7d0;
        --lms-danger:        #e53e3e;
        --lms-danger-bg:     #fff5f5;
        --lms-danger-bdr:    #fed7d7;
        --lms-info:          #F97316;
        --lms-info-bg:       #FFF7ED;
        --lms-info-bdr:      #FED7AA;
        --lms-warning:       #d97706;
        --lms-warning-bg:    #fffbeb;
        --lms-warning-bdr:   #fde68a;
        --lms-violet:        #7c3aed;
        --lms-violet-bg:     #f5f3ff;
        --lms-violet-bdr:    #ddd6fe;
        --lms-teal:          #0d9488;
        --lms-radius-sm:     8px;
        --lms-radius-md:     10px;
        --lms-radius-lg:     14px;
        --lms-font:          'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
        --lms-shadow-sm:     0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        --lms-shadow-md:     0 4px 14px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
      }

      .dbq-root { font-family: var(--lms-font) !important; }
      .dbq-root .font-mono { font-family: ui-monospace, monospace; }

      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--lms-border); border-radius: 4px; }

      .lms-breadcrumb-sep { color: var(--lms-orange); margin: 0 3px; font-weight: 700; font-size: 13px; font-family: var(--lms-font); }
      .lms-crumb {
        position: relative; font-family: var(--lms-font);
        font-size: 12.5px; font-weight: 600; cursor: default;
      }
      .lms-crumb[data-tip]:hover::before {
        content: attr(data-tip);
        position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
        background: #1a1a2e; color: #ffffff !important;
        font-family: var(--lms-font); font-size: 10px; font-weight: 700;
        white-space: nowrap; padding: 4px 9px; border-radius: 5px;
        pointer-events: none; z-index: 9999;
        letter-spacing: 0.04em; box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }
      .lms-crumb[data-tip]:hover::after {
        content: '';
        position: absolute; top: calc(100% + 2px); left: 50%; transform: translateX(-50%);
        border: 5px solid transparent; border-bottom-color: #1a1a2e;
        pointer-events: none; z-index: 9999;
      }

      .lms-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 14px; border-radius: var(--lms-radius-md);
        font-family: var(--lms-font); font-size: 12.5px; font-weight: 600;
        border: 1.5px solid; cursor: pointer; transition: all 0.15s;
        white-space: nowrap;
      }
      .lms-btn-orange {
        background: var(--lms-orange); color: white; border-color: transparent;
        box-shadow: 0 2px 8px var(--lms-orange-glow);
      }
      .lms-btn-orange:hover:not(:disabled) {
        background: var(--lms-orange-dark);
        box-shadow: 0 3px 12px rgba(242,119,87,0.35); transform: translateY(-1px);
      }
      .lms-btn-orange:disabled { opacity: 0.55; cursor: not-allowed; }
      .lms-btn-ghost-violet {
        background: var(--lms-bg-white); color: var(--lms-violet);
        border-color: var(--lms-violet-bdr);
      }
      .lms-btn-ghost-violet:hover { background: var(--lms-violet-bg); }
      .lms-btn-slate {
        background: var(--lms-bg-white); color: var(--lms-text-sec);
        border-color: var(--lms-border);
      }
      .lms-btn-slate:hover { background: var(--lms-bg-surface2); }

      .lms-icon-btn {
        width: 32px; height: 32px; border: 1.5px solid; border-radius: var(--lms-radius-sm);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.15s; background: none; flex-shrink: 0;
      }
      .lms-icon-btn-red { border-color: var(--lms-danger-bdr); background: var(--lms-danger-bg); color: var(--lms-danger); }
      .lms-icon-btn-red:hover { background: #fed7d7; }

      .lms-header-logo-mark {
        width: 34px; height: 34px; background: var(--lms-orange);
        border-radius: 9px; display: flex; align-items: center;
        justify-content: center; flex-shrink: 0;
        box-shadow: 0 3px 10px var(--lms-orange-glow);
      }

      .lms-badge {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 4px 10px; border-radius: 20px;
        font-size: 11.5px; font-weight: 600; border: 1.5px solid;
        font-family: var(--lms-font);
      }
      .lms-badge-amber { background: var(--lms-warning-bg); color: var(--lms-warning); border-color: var(--lms-warning-bdr); }
      .lms-badge-violet { background: var(--lms-violet-bg); color: var(--lms-violet); border-color: var(--lms-violet-bdr); }
      .lms-badge-green { background: var(--lms-success-bg); color: var(--lms-success); border-color: var(--lms-success-bdr); }
      .lms-badge-orange { background: var(--lms-orange-50); color: #c85a30; border-color: var(--lms-orange-100); }
      .lms-badge-indigo { background: var(--lms-info-bg); color: var(--lms-info); border-color: var(--lms-info-bdr); }

      .lms-progress-bar { height: 6px; background: var(--lms-bg-surface2); border-radius: 3px; overflow: hidden; margin-top: 8px; }
      .lms-progress-fill { height: 100%; border-radius: 3px; background: var(--lms-orange); transition: width 0.4s; }

      .lms-sidebar-section-title {
        display: flex; align-items: center; gap: 7px;
        font-size: 12px; font-weight: 700; color: var(--lms-text-main);
        margin-bottom: 10px; font-family: var(--lms-font);
      }
      .lms-marks-row {
        display: flex; align-items: center; justify-content: space-between; padding: 3.5px 0;
      }
      .lms-marks-label { font-size: 12px; font-weight: 600; color: var(--lms-text-sec); font-family: var(--lms-font); }
      .lms-marks-value { font-size: 12.5px; font-weight: 700; font-family: var(--lms-font); }
      .lms-detail-row {
        display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; padding: 3px 0;
      }
      .lms-detail-label {
        font-size: 12px; font-weight: 600; color: var(--lms-text-sec);
        text-transform: none; letter-spacing: 0.01em; font-family: var(--lms-font);
      }
      .lms-detail-value {
        font-size: 12px; font-weight: 700; color: var(--lms-text-main); font-family: var(--lms-font);
      }

      .lms-modal-backdrop {
        position: fixed; inset: 0; z-index: 200;
        background: rgba(26,26,46,0.45); backdrop-filter: blur(3px);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      .lms-modal {
        background: var(--lms-bg-white); border-radius: var(--lms-radius-lg);
        box-shadow: 0 20px 60px rgba(0,0,0,0.18); max-width: 420px; width: 100%;
        border: 1.5px solid var(--lms-border); overflow: hidden;
      }
      .lms-modal-header {
        display: flex; align-items: center; gap: 10px;
        padding: 14px 18px; border-bottom: 1.5px solid var(--lms-border);
      }
      .lms-modal-icon {
        width: 32px; height: 32px; border-radius: var(--lms-radius-sm);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .lms-modal-body { padding: 16px 18px; }

      .lms-section-label {
        font-size: 10.5px; font-weight: 700; color: var(--lms-text-main);
        text-transform: uppercase; letter-spacing: 0.07em;
        font-family: var(--lms-font); margin-bottom: 8px;
      }
      .lms-section-label.lms-label-err { color: var(--lms-danger) !important; }

      .lms-sidebar-scroll { scrollbar-width: thin; scrollbar-color: #8e8ea0 var(--lms-bg-surface2); }
      .lms-sidebar-scroll::-webkit-scrollbar { width: 6px; }
      .lms-sidebar-scroll::-webkit-scrollbar-track { background: var(--lms-bg-surface2); border-radius: 3px; }
      .lms-sidebar-scroll::-webkit-scrollbar-thumb { background: #8e8ea0; border-radius: 3px; }
      .lms-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #6b6b7e; }

      .lms-cancel-btn {
        padding: 8px 16px; border-radius: var(--lms-radius-md);
        border: 1.5px solid var(--lms-border); background: var(--lms-bg-white);
        color: var(--lms-text-sec); font-family: var(--lms-font);
        font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.15s;
      }
      .lms-cancel-btn:hover { background: var(--lms-bg-surface2); }

      .lms-nav-btn {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 7px 14px; border-radius: var(--lms-radius-md);
        font-family: var(--lms-font); font-size: 12.5px; font-weight: 600;
        border: 1.5px solid var(--lms-border); background: var(--lms-bg-white);
        color: var(--lms-text-sec); cursor: pointer; transition: all 0.15s;
      }
      .lms-nav-btn:hover:not(:disabled) { background: var(--lms-bg-surface); border-color: var(--lms-border-hover); }
      .lms-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }

      .lms-input {
        width: 100%; padding: 9px 12px; font-size: 13.5px;
        border-radius: var(--lms-radius-md); border: 1.5px solid var(--lms-border);
        background: var(--lms-bg-white); color: var(--lms-text-main);
        font-family: var(--lms-font); outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .lms-input:focus { border-color: var(--lms-orange); box-shadow: 0 0 0 3px var(--lms-orange-light); }
      .lms-input::placeholder { color: var(--lms-text-hint); font-weight: 400; }
      .lms-input:disabled { background: var(--lms-bg-surface); color: var(--lms-text-muted); cursor: not-allowed; }
      .lms-input.err { border-color: var(--lms-danger); background: #fff5f5; }

      .lms-textarea {
        width: 100%; padding: 9px 12px; font-size: 13.5px;
        border-radius: var(--lms-radius-md); border: 1.5px solid var(--lms-border);
        background: var(--lms-bg-white); color: var(--lms-text-main);
        font-family: var(--lms-font); outline: none; resize: none;
        transition: border-color 0.15s, box-shadow 0.15s; line-height: 1.6;
      }
      .lms-textarea:focus { border-color: var(--lms-orange); box-shadow: 0 0 0 3px var(--lms-orange-light); }
      .lms-textarea::placeholder { color: var(--lms-text-hint); font-weight: 400; }
      .lms-textarea:disabled { background: var(--lms-bg-surface); color: var(--lms-text-muted); cursor: not-allowed; }
      .lms-textarea.err { border-color: var(--lms-danger); background: #fff5f5; }
      .lms-textarea.mono { font-family: ui-monospace, monospace; font-size: 12px; }

      .lms-fmt-btn {
        padding: 5px; border: none; background: none; cursor: pointer;
        color: var(--lms-text-muted); border-radius: 7px; transition: all 0.12s;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-family: var(--lms-font);
      }
      .lms-fmt-btn:hover { background: var(--lms-bg-surface2); color: var(--lms-text-main); }
      .lms-fmt-btn.active { background: var(--lms-orange-100); color: #c85a30; }

      [data-placeholder]:empty:before {
        content: attr(data-placeholder);
        color: var(--lms-text-hint, #aaa);
        pointer-events: none;
        font-weight: 400;
      }

      .dbq-run-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 16px; border-radius: var(--lms-radius-md);
        border: none; background: #16a34a; color: white;
        font-family: var(--lms-font); font-size: 12.5px; font-weight: 700;
        cursor: pointer; transition: all 0.15s;
        box-shadow: 0 2px 8px rgba(22,163,74,0.22);
      }
      .dbq-run-btn:hover:not(:disabled) { background: #15803d; transform: translateY(-1px); box-shadow: 0 3px 10px rgba(22,163,74,0.3); }
      .dbq-run-btn:disabled { background: #d4d4e2; box-shadow: none; cursor: not-allowed; }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  };
})();

// ─── Types ─────────────────────────────────────────────────────────────────────
interface DatabaseQuestionFormProps {
  exerciseData: any;
  tabType: string;
  initialData?: any;
  isEditing?: boolean;
  onClose: () => void;
  onSave: (questionData: any) => Promise<any>;
  onDeleteQuestion?: (questionId: string) => Promise<any>;
  isSaving: boolean;
  saveProgress: number;
  saveMessage: string;
  lockedDifficulty?: 'easy' | 'medium' | 'hard';
  onEditExercise?: () => void;
  sectionData?: any;
}

interface HintItem { hintText: string; pointsDeduction: number; isPublic: boolean; }

interface DBQuestion {
  __localId: string;
  _id?: string;
  title: string;
  description: any;
  difficulty: 'easy' | 'medium' | 'hard';
  score: number;
  sampleQuery: string;
  sampleResult: any;
  constraints: string[];
  hints: any[];
  questionType: string;
  isSaved: boolean;
  isDirty?: boolean;
  isPreExisting?: boolean;
}

type ProgContentBlock =
  | { id: string; type: 'text'; value: string }
  | { id: string; type: 'image'; url: string; alignment: 'left' | 'center' | 'right'; sizePercent: number }
  | { id: string; type: 'code'; value: string; language: string; bgColor: string };

const mkProgTextBlock = (id?: string): ProgContentBlock => ({
  id: id || `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  type: 'text', value: ''
});

const blocksToDescription = (blocks: ProgContentBlock[]): any => {
  const textParts = blocks.filter(b => b.type === 'text').map(b => (b as any).value).join('\n').trim();
  const imgBlock = blocks.find(b => b.type === 'image') as any;
  return {
    text: textParts,
    imageUrl: imgBlock?.url || null,
    imageAlignment: imgBlock?.alignment || 'left',
    imageSizePercent: imgBlock?.sizePercent || 100,
    contentBlocks: blocks,
  };
};

const descToBlocks = (description: any): ProgContentBlock[] => {
  if (!description) return [mkProgTextBlock()];
  if (description.contentBlocks && Array.isArray(description.contentBlocks) && description.contentBlocks.length > 0) {
    return description.contentBlocks.map((b: any) => ({
      ...b,
      id: b.id || `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      value: b.value || '',
    }));
  }
  if (typeof description === 'string') {
    return [{ id: `pb-${Date.now()}`, type: 'text', value: description }];
  }
  if (description.text) {
    return [{ id: `pb-${Date.now()}`, type: 'text', value: description.text }];
  }
  return [mkProgTextBlock()];
};

const DS: Record<string, { text: string; bg: string; border: string; dot: string; solid: any; pill: any; bar: string }> = {
  easy: {
    text: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '#16a34a', bar: '#16a34a',
    solid: { background: '#16a34a', color: 'white' },
    pill: { background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' },
  },
  medium: {
    text: '#d97706', bg: '#fffbeb', border: '#fde68a', dot: '#d97706', bar: '#d97706',
    solid: { background: '#d97706', color: 'white' },
    pill: { background: '#fffbeb', color: '#d97706', border: '1.5px solid #fde68a' },
  },
  hard: {
    text: '#e53e3e', bg: '#fff5f5', border: '#fed7d7', dot: '#e53e3e', bar: '#e53e3e',
    solid: { background: '#e53e3e', color: 'white' },
    pill: { background: '#fff5f5', color: '#e53e3e', border: '1.5px solid #fed7d7' },
  },
};

const mkLocalId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const fmtMark = (n: number): string => parseFloat(n.toFixed(2)).toString();

const dbQuestionToFlow = (q: any): DBQuestion => ({
  __localId: q._id ? `db-${q._id}` : mkLocalId(),
  _id: q._id,
  title: typeof q.title === 'string' ? q.title : '',
  description: q.description || { text: '' },
  difficulty: q.difficulty || 'medium',
  score: q.score || q.points || 0,
  sampleQuery: q.sampleQuery || '',
  sampleResult: q.sampleResult || [mkProgTextBlock()],
  constraints: q.constraints || [],
  hints: q.hints || [],
  questionType: 'database',
  isSaved: true,
  isDirty: false,
  isPreExisting: true,
});

// ─── SQL Result Table ──────────────────────────────────────────────────────────
// The SqlResultTable component should be properly defined as a function component
const SqlResultTable: React.FC<{ rows: Record<string, any>[]; columns: string[] }> = ({ rows, columns }) => {
  return React.createElement('div', { style: { overflowX: 'auto' } },
    React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'ui-monospace, monospace' } },
      React.createElement('thead', null,
        React.createElement('tr', { style: { background: '#7C2D12' } },
          columns.map(col => React.createElement('th', { key: col, style: { padding: '5px 10px', textAlign: 'left', color: '#FED7AA', fontWeight: 700, borderRight: '1px solid #C2410C', whiteSpace: 'nowrap' } }, col))
        )
      ),
      React.createElement('tbody', null,
        rows.map((row, ri) => 
          React.createElement('tr', { key: ri, style: { background: ri % 2 === 0 ? '#0f172a' : '#111827', borderBottom: '1px solid #7C2D12' } },
            columns.map(col => 
              React.createElement('td', { key: col, style: { padding: '4px 10px', color: '#e2e8f0', borderRight: '1px solid #7C2D12', whiteSpace: 'nowrap' } },
                row[col] === null ? React.createElement('span', { style: { color: '#64748b', fontStyle: 'italic' } }, 'NULL') : String(row[col])
              )
            )
          )
        )
      )
    )
  );
};

// ─── Image Upload Modal ────────────────────────────────────────────────────────
const ImageUploadModal: React.FC<{
  onUpload: (url: string) => void;
  onClose: () => void;
}> = ({ onUpload, onClose }) => {
  const [tab, setTab] = useState<'upload' | 'url'>('upload');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [urlValue, setUrlValue] = useState('');
  const [urlError, setUrlError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const doUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    setUploading(true); setError('');
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append('image', file);
      const res = await fetch('https://lmsserver-yeve.onrender.com/upload/question-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Upload failed');
      onUpload(json.url);
    } catch (e: any) {
      setError(e.message || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) doUpload(file);
  };

  const handleInsertUrl = () => {
    const trimmed = urlValue.trim();
    if (!trimmed) { setUrlError('Please enter an image URL.'); return; }
    if (!/^https?:\/\/.+/i.test(trimmed)) { setUrlError('URL must start with http:// or https://'); return; }
    setUrlError('');
    onUpload(trimmed);
  };

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? 'var(--lms-orange)' : 'var(--lms-text-sec)',
    borderBottom: active ? '2px solid var(--lms-orange)' : '2px solid transparent',
    paddingBottom: 10, paddingTop: 10, paddingLeft: 4, paddingRight: 4,
    background: 'none', cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(26,26,46,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        style={{ border: '1px solid var(--lms-border)' }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <span className="text-sm font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Insert Image</span>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" style={{ color: 'var(--lms-text-muted)' }} />
          </button>
        </div>
        <div className="flex items-center gap-5 px-5 border-b" style={{ borderColor: 'var(--lms-border)' }}>
          <button type="button" style={TAB_STYLE(tab === 'upload')} onClick={() => { setTab('upload'); setError(''); }}>Upload</button>
          <button type="button" style={TAB_STYLE(tab === 'url')} onClick={() => { setTab('url'); setUrlError(''); }}>By URL</button>
        </div>
        <div className="p-5">
          {tab === 'upload' ? (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className="flex flex-col items-center justify-center gap-3 rounded-xl py-9 transition-all"
                style={{ border: `2px dashed ${dragging ? 'var(--lms-orange)' : 'var(--lms-border)'}`, background: dragging ? 'var(--lms-orange-light)' : 'var(--lms-bg-surface)' }}>
                {uploading ? (
                  <>
                    <Loader className="h-8 w-8 animate-spin" style={{ color: 'var(--lms-orange)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>Uploading…</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="h-8 w-8" style={{ color: dragging ? 'var(--lms-orange)' : 'var(--lms-text-hint)' }} />
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Drag & drop image here</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>PNG, JPG, GIF, WEBP supported</p>
                    </div>
                    <div className="flex items-center gap-2 w-full px-4">
                      <div className="flex-1 h-px" style={{ background: 'var(--lms-border)' }} />
                      <span className="text-xs" style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>or</span>
                      <div className="flex-1 h-px" style={{ background: 'var(--lms-border)' }} />
                    </div>
                    <button type="button" onClick={() => inputRef.current?.click()}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                      style={{ background: 'var(--lms-orange)', color: '#fff', fontFamily: 'var(--lms-font)' }}>
                      Browse Files
                    </button>
                    <input ref={inputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f); e.target.value = ''; }} />
                  </>
                )}
              </div>
              {error && (
                <div className="mt-2.5 flex items-center gap-1.5 text-xs" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
                Only use images that you have the license to use.
              </p>
              <div className="flex gap-2">
                <input type="text" value={urlValue}
                  onChange={e => { setUrlValue(e.target.value); if (urlError) setUrlError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleInsertUrl(); }}
                  placeholder="Paste URL of image..."
                  autoFocus
                  className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-all"
                  style={{ borderColor: urlError ? 'var(--lms-danger)' : 'var(--lms-border)', fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)' }}
                />
              </div>
              {urlError && (
                <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{urlError}
                </div>
              )}
              <div className="flex justify-end mt-4">
                <button type="button" onClick={handleInsertUrl}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: urlValue.trim() ? 'var(--lms-orange)' : 'var(--lms-border)', color: urlValue.trim() ? '#fff' : 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)', cursor: urlValue.trim() ? 'pointer' : 'default' }}>
                  Insert Image
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Image Block Component ─────────────────────────────────────────────────────
const ImageBlock: React.FC<{
  block: ProgContentBlock & { type: 'image' };
  onUpdate: (patch: Partial<ProgContentBlock>) => void;
  onRemove: () => void;
  disabled?: boolean;
}> = ({ block, onUpdate, onRemove, disabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [liveSize, setLiveSize] = useState(block.sizePercent || 60);
  const startX = useRef(0);
  const startSize = useRef(0);
  const side = useRef<'left' | 'right'>('right');

  useEffect(() => { setLiveSize(block.sizePercent || 60); }, [block.sizePercent]);

  const onMouseDown = (e: React.MouseEvent, s: 'left' | 'right') => {
    if (disabled) return;
    e.preventDefault(); e.stopPropagation();
    startX.current = e.clientX;
    startSize.current = liveSize;
    side.current = s;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const parentW = containerRef.current?.parentElement?.clientWidth || 600;
      const dx = ev.clientX - startX.current;
      const delta = (dx / parentW) * 100;
      const newSize = Math.min(100, Math.max(10,
        side.current === 'right' ? startSize.current + delta : startSize.current - delta
      ));
      setLiveSize(Math.round(newSize));
    };
    const onUp = () => {
      onUpdate({ sizePercent: liveSize } as any);
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const justify = block.alignment === 'left' ? 'flex-start' : block.alignment === 'right' ? 'flex-end' : 'center';

  const DiagArrow = ({ rotate }: { rotate: number }) => (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: `rotate(${rotate}deg)`, display: 'block', pointerEvents: 'none' }}>
      <line x1="1" y1="9" x2="9" y2="1" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" />
      <polyline points="5,1 9,1 9,5" fill="none" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="5,9 1,9 1,5" fill="none" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const cornerBase: React.CSSProperties = {
    position: 'absolute', width: 16, height: 16, background: 'white',
    border: '1.5px solid var(--lms-orange)', borderRadius: 3, zIndex: 10,
    userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: (hovered || dragging) && !disabled ? 1 : 0,
    transition: 'opacity 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  };

  return (
    <div style={{ display: 'flex', justifyContent: justify, position: 'relative', margin: '4px 0' }}
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}>
      <div style={{ width: `${liveSize}%`, position: 'relative', transition: dragging ? 'none' : 'width 0.1s', minWidth: 60 }}>
        <img src={block.url} alt="" draggable={false}
          style={{ width: '100%', height: 'auto', borderRadius: 8, border: `1.5px solid ${dragging ? 'var(--lms-orange)' : 'var(--lms-border)'}`, display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
        {!disabled && <>
          <div style={{ ...cornerBase, top: -7, left: -7, cursor: 'nwse-resize' }} onMouseDown={e => onMouseDown(e, 'left')}><DiagArrow rotate={0} /></div>
          <div style={{ ...cornerBase, top: -7, right: -7, cursor: 'nesw-resize' }} onMouseDown={e => onMouseDown(e, 'right')}><DiagArrow rotate={90} /></div>
          <div style={{ ...cornerBase, bottom: -7, left: -7, cursor: 'nesw-resize' }} onMouseDown={e => onMouseDown(e, 'left')}><DiagArrow rotate={90} /></div>
          <div style={{ ...cornerBase, bottom: -7, right: -7, cursor: 'nwse-resize' }} onMouseDown={e => onMouseDown(e, 'right')}><DiagArrow rotate={0} /></div>
        </>}
        {dragging && (
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--lms-font)', pointerEvents: 'none', zIndex: 20 }}>
            {liveSize}%
          </div>
        )}
        {!disabled && (
          <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 4, zIndex: 20, opacity: (hovered || dragging) ? 1 : 0, transition: 'opacity 0.15s' }}>
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} type="button" onClick={() => onUpdate({ alignment: a } as any)}
                style={{ width: 22, height: 22, borderRadius: 5, border: '1.5px solid', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--lms-font)', background: block.alignment === a ? 'var(--lms-orange)' : 'white', borderColor: block.alignment === a ? 'var(--lms-orange)' : 'var(--lms-border)', color: block.alignment === a ? 'white' : 'var(--lms-text-muted)' }}>
                {a[0].toUpperCase()}
              </button>
            ))}
            <button type="button" onClick={onRemove}
              style={{ width: 22, height: 22, borderRadius: 5, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={11} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Code Block Component ──────────────────────────────────────────────────────
const PROG_CODE_THEMES = [
  { label: 'Light', bg: '#f5f5f5' }, { label: 'Dark', bg: '#1e1e1e' },
  { label: 'Dracula', bg: '#282a36' }, { label: 'Monokai', bg: '#272822' },
];

const highlightAutoP = (code: string, bgColor: string): string => {
  const dark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(bgColor);
  const kwC = dark ? '#569cd6' : '#0000ff';
  const strC = dark ? '#ce9178' : '#a31515';
  const cmtC = '#6a9955';
  const numC = dark ? '#b5cea8' : '#098658';
  const kw = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW', 'DATABASE'];
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(--.*$)/gm, `<span style="color:${cmtC}">$1</span>`)
    .replace(/\/\*[\s\S]*?\*\//g, `<span style="color:${cmtC}">$1</span>`)
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, `<span style="color:${strC}">$1</span>`)
    .replace(/\b(\d+\.?\d*)\b/g, `<span style="color:${numC}">$1</span>`)
    .replace(new RegExp(`\\b(${kw.join('|')})\\b`, 'gi'), `<span style="color:${kwC};font-weight:600">$1</span>`);
};

const CodeBlock: React.FC<{
  block: ProgContentBlock & { type: 'code' };
  onUpdate: (patch: Partial<ProgContentBlock>) => void;
  onRemove: () => void;
  disabled?: boolean;
}> = ({ block, onUpdate, onRemove, disabled }) => {
  const [editing, setEditing] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedWidth = (block as any).width;
  const savedHeight = (block as any).height;
  const [liveWidth, setLiveWidth] = useState<number | undefined>(savedWidth);
  const [liveHeight, setLiveHeight] = useState<number | undefined>(savedHeight);
  const bg = block.bgColor || '#f5f5f5';
  const isDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(bg);
  const textColor = isDark ? '#d4d4d4' : '#1a1a2e';

  return (
    <div className="relative my-2 group/code" style={{
      borderRadius: 8, border: `1.5px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`,
      background: bg, overflow: 'visible', display: 'inline-block',
      width: liveWidth ? `${liveWidth}px` : 'fit-content', minWidth: 200,
      position: 'relative',
    }}>
      {!disabled && (
        <button type="button" onClick={onRemove} style={{
          position: 'absolute', top: 7, right: 10, zIndex: 10,
          background: isDark ? '#ffffff' : '#eb0303',
          border: `1px solid ${isDark ? '#444' : '#d0d0d0'}`,
          borderRadius: 6, padding: '3px 6px', fontSize: 10,
          color: isDark ? '#000000' : '#ffffff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', opacity: 0, transition: 'opacity 0.15s',
        }} className="group-hover/code:!opacity-100">
          <X size={10} />
        </button>
      )}
      {editing && !disabled ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <textarea
            ref={textareaRef}
            value={block.value}
            onChange={e => onUpdate({ value: e.target.value } as any)}
            onMouseMove={() => {
              if (textareaRef.current) {
                setLiveWidth(textareaRef.current.offsetWidth);
                setLiveHeight(textareaRef.current.offsetHeight);
              }
            }}
            onBlur={() => {
              if (textareaRef.current) {
                onUpdate({ width: textareaRef.current.offsetWidth, height: textareaRef.current.offsetHeight } as any);
              }
              setEditing(false);
            }}
            placeholder="-- Write your SQL query here..."
            spellCheck={false}
            autoFocus
            style={{
              display: 'block', width: liveWidth ? `${liveWidth}px` : '400px',
              height: liveHeight ? `${liveHeight}px` : '120px', minWidth: 200,
              background: 'transparent', border: 'none', outline: 'none',
              padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              color: textColor, resize: 'both', overflow: 'auto',
              boxSizing: 'border-box', whiteSpace: 'pre', minHeight: 42,
            }}
          />
          <div style={{
            position: 'absolute', bottom: 4, right: 4, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: 4,
            background: 'var(--lms-orange)', opacity: 0.85, zIndex: 10,
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 5L5 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 9H5V5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>
      ) : (
        <pre onClick={() => { if (!disabled) setEditing(true); }} style={{
          margin: 0, padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace', color: textColor,
          whiteSpace: 'pre', cursor: disabled ? 'default' : 'text', display: 'block',
          width: savedWidth ? `${savedWidth}px` : '100%',
          height: savedHeight ? `${savedHeight}px` : undefined, minWidth: 200,
          background: 'transparent', overflowX: 'auto',
        }} dangerouslySetInnerHTML={{ __html: highlightAutoP(block.value || '', bg) }} />
      )}
      {!disabled && (
        <div className="group-hover/code:!opacity-100" style={{
          opacity: 0, transition: 'opacity 0.15s', display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderTop: `1px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
        }}>
          {PROG_CODE_THEMES.map(theme => (
            <button key={theme.label} type="button" title={theme.label}
              onClick={() => onUpdate({ bgColor: theme.bg } as any)}
              style={{
                width: 14, height: 14, borderRadius: '50%', background: theme.bg,
                border: bg === theme.bg ? '2px solid var(--lms-orange)' : `2px solid ${isDark ? '#555' : '#d0d0d0'}`,
                cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s',
              }} onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')} />
          ))}
          <div style={{ width: 1, height: 12, background: isDark ? '#444' : '#e0e0e0', margin: '0 2px' }} />
          <input type="text" value={block.language || ''} onChange={e => onUpdate({ language: e.target.value } as any)}
            style={{ fontSize: 10, fontFamily: 'monospace', color: isDark ? '#888' : '#999', background: 'transparent', border: 'none', outline: 'none', width: 70 }} />
        </div>
      )}
    </div>
  );
};

// ─── Description Editor ────────────────────────────────────────────────────────
const DescriptionEditor: React.FC<{
  blocks: ProgContentBlock[];
  onChange: (blocks: ProgContentBlock[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
}> = ({ blocks, onChange, disabled, hasError, placeholder = "Describe the database problem clearly. Include table schemas, sample data, and expected query results." }) => {
  const mkId = () => `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const [showImgModal, setShowImgModal] = useState(false);
  const [fmtState, setFmtState] = useState({ bold: false, italic: false, underline: false });
  const editRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastSetValues = useRef<Map<string, string>>(new Map());

  const updateBlock = (id: string, patch: Partial<ProgContentBlock>) => {
    onChange(blocks.map(b => b.id === id ? ({ ...b, ...patch } as ProgContentBlock) : b));
  };
  const removeBlock = (id: string) => {
    const next = blocks.filter(b => b.id !== id);
    onChange(next.length > 0 ? next : [{ id: mkId(), type: 'text', value: '' }]);
  };

  useEffect(() => {
    blocks.forEach(b => {
      if (b.type !== 'text') return;
      const el = editRefs.current.get(b.id);
      if (!el) return;
      const html = (b as any).value || '';
      if (lastSetValues.current.get(b.id) === html) return;
      el.innerHTML = html;
      lastSetValues.current.set(b.id, html);
    });
  });

  const trackFmt = () => {
    setFmtState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
    });
  };

  const applyFmt = (cmd: string) => {
    document.execCommand(cmd);
    trackFmt();
    const focused = document.activeElement as HTMLDivElement;
    if (focused) {
      const entry = [...editRefs.current.entries()].find(([, el]) => el === focused);
      if (entry) {
        const [id] = entry;
        const html = focused.innerHTML;
        lastSetValues.current.set(id, html);
        updateBlock(id, { value: html } as any);
      }
    }
  };

  const hasImage = blocks.some(b => b.type === 'image');

  return (
    <div>
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 0 6px' }}>
          <button type="button" className="lms-fmt-btn" title="Bold"
            onMouseDown={e => { e.preventDefault(); applyFmt('bold'); }}
            style={{ fontWeight: 700, color: fmtState.bold ? 'var(--lms-orange)' : undefined, background: fmtState.bold ? 'rgba(255,107,53,0.08)' : undefined }}>B</button>
          <button type="button" className="lms-fmt-btn" title="Italic"
            onMouseDown={e => { e.preventDefault(); applyFmt('italic'); }}
            style={{ fontStyle: 'italic', color: fmtState.italic ? 'var(--lms-orange)' : undefined, background: fmtState.italic ? 'rgba(255,107,53,0.08)' : undefined }}>I</button>
          <button type="button" className="lms-fmt-btn" title="Underline"
            onMouseDown={e => { e.preventDefault(); applyFmt('underline'); }}
            style={{ textDecoration: 'underline', color: fmtState.underline ? 'var(--lms-orange)' : undefined, background: fmtState.underline ? 'rgba(255,107,53,0.08)' : undefined }}>U</button>
          <div style={{ width: 1, height: 16, background: 'var(--lms-border)', margin: '0 2px' }} />
          <button type="button" className="lms-fmt-btn" title="Insert code block"
            onClick={() => onChange([...blocks, { id: mkId(), type: 'code', value: '', language: 'sql', bgColor: '#1e1e1e' }])}>
            <Code size={13} />
          </button>
          <button type="button" className="lms-fmt-btn" title={hasImage ? 'Remove existing image first' : 'Insert image'}
            disabled={hasImage} style={{ opacity: hasImage ? 0.4 : 1, cursor: hasImage ? 'not-allowed' : 'pointer' }}
            onClick={() => { if (!hasImage) setShowImgModal(true); }}>
            <Image size={13} />
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {blocks.map((b) => {
          if (b.type === 'text') return (
            <div key={b.id}
              ref={el => { if (el) { editRefs.current.set(b.id, el); lastSetValues.current.delete(b.id); } else { editRefs.current.delete(b.id); } }}
              contentEditable={!disabled} suppressContentEditableWarning
              data-placeholder={placeholder}
              onInput={e => {
                const html = (e.currentTarget as HTMLDivElement).innerHTML;
                lastSetValues.current.set(b.id, html);
                updateBlock(b.id, { value: html } as any);
              }} onKeyUp={trackFmt} onMouseUp={trackFmt}
              style={{
                fontFamily: 'var(--lms-font)', fontSize: 15, fontWeight: 500, lineHeight: 1.65,
                color: hasError ? 'var(--lms-danger)' : 'var(--lms-text-main)', background: 'transparent',
                border: 'none', borderBottom: `2px solid ${hasError ? 'var(--lms-danger)' : disabled ? 'var(--lms-border)' : 'var(--lms-orange)'}`,
                borderRadius: 0, outline: 'none', width: '100%', padding: '4px 0 6px',
                minHeight: 80, cursor: disabled ? 'not-allowed' : 'text',
                boxSizing: 'border-box', wordBreak: 'break-word',
              }}
            />
          );
          if (b.type === 'image') return (
            <ImageBlock key={b.id} block={b as any} onUpdate={patch => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} disabled={disabled} />
          );
          if (b.type === 'code') return (
            <CodeBlock key={b.id} block={b as any} onUpdate={patch => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} disabled={disabled} />
          );
          return null;
        })}
      </div>
      {showImgModal && (
        <ImageUploadModal onUpload={url => {
          onChange([...blocks, { id: mkId(), type: 'image', url, alignment: 'center', sizePercent: 70 }]);
          setShowImgModal(false);
        }} onClose={() => setShowImgModal(false)} />
      )}
    </div>
  );
};

// ─── Breadcrumb Component ─────────────────────────────────────────────────────
const capFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const Breadcrumb: React.FC<{
  hierarchyData: any; tabType: string; subcategory?: string; subcategoryLabel?: string;
  exerciseName?: string; actionLabel: string; questionLabel?: string;
}> = ({ hierarchyData, tabType, subcategory, subcategoryLabel, exerciseName, actionLabel, questionLabel }) => {
  const crumbs: { text: string; tip: string }[] = [];
  if (hierarchyData?.courseName) crumbs.push({ text: hierarchyData.courseName, tip: 'Course' });
  if (hierarchyData?.moduleName) crumbs.push({ text: hierarchyData.moduleName, tip: 'Module' });
  if (hierarchyData?.submoduleName) crumbs.push({ text: hierarchyData.submoduleName, tip: 'Sub-module' });
  if (hierarchyData?.topicName) crumbs.push({ text: hierarchyData.topicName, tip: 'Topic' });
  if (hierarchyData?.subtopicName) crumbs.push({ text: hierarchyData.subtopicName, tip: 'Sub-topic' });

  const Sep = () => <li><span className="lms-breadcrumb-sep">»</span></li>;

  return (
    <nav style={{ fontFamily: 'var(--lms-font)' }}>
      <ol className="flex items-center flex-wrap gap-y-0.5">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            <li><span className="lms-crumb" data-tip={c.tip} style={{ color: 'var(--lms-text-sec)' }}>{capFirst(c.text)}</span></li>
            <Sep />
          </React.Fragment>
        ))}
        {tabType && (<><li><span className="lms-crumb" data-tip="Category" style={{ color: 'var(--lms-text-sec)' }}>{capFirst(tabType.replace(/_/g, ' '))}</span></li><Sep /></>)}
        {(subcategoryLabel || subcategory) && (<><li><span className="lms-crumb" data-tip="Sub-category" style={{ color: 'var(--lms-orange)' }}>{capFirst(subcategoryLabel || subcategory || '')}</span></li><Sep /></>)}
        {exerciseName && (<><li><span className="lms-crumb" data-tip="Exercise" style={{ color: 'var(--lms-text-main)', verticalAlign: 'bottom' }}><span style={{ maxWidth: 140, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{capFirst(exerciseName)}</span></span></li><Sep /></>)}
        <li><span style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>{capFirst(actionLabel)}{questionLabel && questionLabel !== actionLabel && (<span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>· {questionLabel}</span>)}</span></li>
      </ol>
    </nav>
  );
};

// ─── Preview Modal (rich, like programming form) ───────────────────────────────
const PreviewModal: React.FC<{
  questions: DBQuestion[];
  currentIndex: number;
  isGeneral: boolean;
  exerciseData: any;
  onJump: (idx: number) => void;
  onDelete: (localId: string) => void;
  onClose: () => void;
  onDone: () => void;
  hierarchyData: any;
  tabType: string;
  subcategory?: string;
  subcategoryLabel?: string;
  exerciseName: string;
  actionLabel: string;
  questionLabel: string;
  currentDiff: 'easy' | 'medium' | 'hard';
  score: number;
  generalMPQ: number;
  displayScore: number;
  totalSlots: number;
  createdCount: number;
  remainingSlots: number;
  usedMarks: number;
  remainingMarks: number;
  totalMarksForDiff: number;
  totalSlotsAll: number;
  createdCountAll: number;
  remainingSlotsAll: number;
  totalMarksAll: number;
  usedMarksAll: number;
  isScoreEditable: (d: 'easy' | 'medium' | 'hard') => boolean;
  getFixedScore: (d: 'easy' | 'medium' | 'hard') => number;
  getConfiguredDiffs: () => Array<'easy' | 'medium' | 'hard'>;
  getRemainingSlots: (d?: 'easy' | 'medium' | 'hard') => number;
  getDbQuestionsForDiff: (d?: 'easy' | 'medium' | 'hard') => DBQuestion[];
  getQuotaForDiff: (d: 'easy' | 'medium' | 'hard') => number;
  getCreatedCount: (d?: 'easy' | 'medium' | 'hard') => number;
  getTotalMarksForDiff: (d: 'easy' | 'medium' | 'hard') => number;
  onDiffRowClick: (d: 'easy' | 'medium' | 'hard') => void;
  cfgType: string;
}> = ({
  questions, currentIndex, isGeneral, exerciseData,
  onJump, onDelete, onClose, onDone,
  hierarchyData, tabType, subcategory, subcategoryLabel,
  exerciseName, actionLabel, questionLabel,
  currentDiff, score, generalMPQ, displayScore,
  totalSlots, createdCount, remainingSlots,
  usedMarks, remainingMarks, totalMarksForDiff,
  totalSlotsAll, createdCountAll, remainingSlotsAll,
  totalMarksAll, usedMarksAll,
  isScoreEditable, getFixedScore, getConfiguredDiffs,
  getRemainingSlots, getDbQuestionsForDiff, getQuotaForDiff,
  getCreatedCount, getTotalMarksForDiff, onDiffRowClick, cfgType,
}) => {
  const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{ localId: string; title: string } | null>(null);
  const [filterDiff, setFilterDiff] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [sidebarTab, setSidebarTab] = useState<'details' | 'overview' | null>(null);

  const s = DS[currentDiff] || DS.medium;
  const subExerciseIsGraded = exerciseData?.fullExerciseData?.isGraded !== false;

  const savedQuestions = questions.filter(q => !!(q._id || q.isSaved || q.isPreExisting));
  const availableDiffs = (['easy', 'medium', 'hard'] as const).filter(d =>
    savedQuestions.some(q => q.difficulty === d)
  );

  const filteredSavedQuestions = savedQuestions.filter(q =>
    filterDiff === 'all' ? true : q.difficulty === filterDiff
  );

  const renderBlock = (b: any, bi: number) => {
    if (b.type === 'text' && b.value?.trim())
      return <p key={bi} style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 400, color: 'var(--lms-text-main)', margin: 0, lineHeight: 1.75, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: b.value }} />;
    if (b.type === 'image')
      return (
        <div key={bi} style={{ display: 'flex', justifyContent: b.alignment === 'right' ? 'flex-end' : b.alignment === 'center' ? 'center' : 'flex-start' }}>
          <img src={b.url} alt="" style={{ width: `${b.sizePercent || 70}%`, maxWidth: '100%', borderRadius: 8, border: '1px solid var(--lms-border)' }} />
        </div>
      );
    if (b.type === 'code') {
      const isDk = ['#1e1e1e', '#282a36', '#272822'].includes(b.bgColor);
      return <pre key={bi} style={{ background: b.bgColor || '#f5f5f5', color: isDk ? '#d4d4d4' : '#1a1a2e', fontFamily: 'ui-monospace,monospace', fontSize: 12, padding: '12px 16px', borderRadius: 8, margin: 0, overflowX: 'auto', lineHeight: 1.6 }}>{b.value}</pre>;
    }
    return null;
  };

  return (
    <>
      {/* Exercise Details Modal */}
      {sidebarTab === 'details' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSidebarTab(null); }}>
          <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-bg-surface)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><FileText size={14} style={{ color: 'var(--lms-text-sec)' }} /><span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Details</span></div>
              <button type="button" onClick={() => setSidebarTab(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}><X size={15} /></button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {exerciseData?.fullExerciseData?.exerciseInformation?.exerciseId && (
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Exercise ID</span>
                  <span className="lms-detail-value" style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--lms-violet)', fontSize: 11 }}>{exerciseData.fullExerciseData.exerciseInformation.exerciseId}</span>
                </div>
              )}
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Exercise Name</span>
                <span className="lms-detail-value" style={{ color: 'var(--lms-orange)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exerciseName || 'Untitled'}</span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Exercise Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11 }}>Database</span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Configuration</span>
                <span className="lms-detail-value" style={{ fontSize: 11 }}>{isGeneral ? 'General' : cfgType === 'levelBased' ? 'Level Based' : 'Selection Level'}</span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Assessment Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11, fontWeight: 700, color: subExerciseIsGraded ? 'var(--lms-success)' : 'var(--lms-warning)' }}>{subExerciseIsGraded ? 'Graded' : 'Non-Graded'}</span>
              </div>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setSidebarTab(null)} className="lms-cancel-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Overview Modal */}
      {sidebarTab === 'overview' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSidebarTab(null); }}>
          <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 400, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-info-bg)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><BarChart3 size={14} style={{ color: 'var(--lms-info)' }} /><span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Overview</span></div>
              <button type="button" onClick={() => setSidebarTab(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}><X size={15} /></button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--lms-border)' }}>
                <div className="lms-sidebar-section-title" style={{ marginBottom: 8 }}><Hash size={12} style={{ color: 'var(--lms-orange)' }} /><span>Overall Questions</span></div>
                <div className="lms-marks-row"><span className="lms-marks-label">Total Questions</span><span className="lms-marks-value" style={{ fontSize: 12, fontWeight: 700 }}>{totalSlotsAll}</span></div>
                <div className="lms-marks-row"><span className="lms-marks-label">Created</span><span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{createdCountAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlotsAll}</span></span></div>
                <div className="lms-marks-row"><span className="lms-marks-label">Remaining</span><span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlotsAll}</span></div>
                {totalSlotsAll > 0 && (<div className="lms-progress-bar"><div className="lms-progress-fill" style={{ width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`, background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} /></div>)}
              </div>
              {subExerciseIsGraded && totalMarksAll > 0 && (
                <div style={{ padding: '12px 16px' }}>
                  <div className="lms-sidebar-section-title" style={{ marginBottom: 8 }}><Award size={12} style={{ color: 'var(--lms-violet)' }} /><span>Overall Marks</span></div>
                  <div className="lms-marks-row"><span className="lms-marks-label">Total Marks</span><span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{totalMarksAll}</span></div>
                  <div className="lms-marks-row"><span className="lms-marks-label">Marks Used</span><span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>{fmtMark(usedMarksAll)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMarksAll}</span></span></div>
                  <div className="lms-marks-row"><span className="lms-marks-label">Remaining Marks</span><span className="lms-marks-value" style={{ color: (totalMarksAll - usedMarksAll) <= 0 ? 'var(--lms-success)' : 'var(--lms-text-main)', fontSize: 12 }}>{fmtMark(Math.max(0, totalMarksAll - usedMarksAll))}</span></div>
                  {totalMarksAll > 0 && (<div className="lms-progress-bar"><div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedMarksAll / totalMarksAll) * 100)}%`, background: usedMarksAll >= totalMarksAll ? 'var(--lms-success)' : 'var(--lms-orange)' }} /></div>)}
                </div>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setSidebarTab(null)} className="lms-cancel-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Preview Modal */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150, padding: 12 }}>
        <div style={{ width: '96vw', maxWidth: 1400, height: '96vh', display: 'flex', flexDirection: 'column', background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', border: '1.5px solid var(--lms-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--lms-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Eye size={16} style={{ color: 'white' }} /></div>
              <div style={{ width: 1, height: 20, background: 'var(--lms-border)', flexShrink: 0 }} />
              <Breadcrumb hierarchyData={hierarchyData} tabType={tabType} subcategory={subcategory} subcategoryLabel={subcategoryLabel} exerciseName={exerciseName} actionLabel="Preview" questionLabel={questionLabel} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)' }}>
                <Hash size={11} style={{ color: 'var(--lms-text-hint)' }} />
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-text-main)' }}>
                  {filteredSavedQuestions.length}{filterDiff !== 'all' ? `/${savedQuestions.length}` : ''} question{savedQuestions.length !== 1 ? 's' : ''}
                </span>
              </div>
              {!isGeneral && (
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <select value={filterDiff} onChange={e => setFilterDiff(e.target.value as any)} style={{
                    fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600,
                    border: `1.5px solid ${filterDiff !== 'all' ? (DS[filterDiff]?.border || 'var(--lms-border)') : 'var(--lms-border)'}`,
                    borderRadius: 20, padding: '5px 28px 5px 12px', cursor: 'pointer', outline: 'none',
                    background: filterDiff !== 'all' ? (DS[filterDiff]?.bg || 'var(--lms-bg-surface)') : 'var(--lms-bg-surface)',
                    color: filterDiff !== 'all' ? (DS[filterDiff]?.text || 'var(--lms-text-sec)') : 'var(--lms-text-sec)',
                    appearance: 'none', minWidth: 140,
                  }}>
                    <option value="all">All difficulties</option>
                    {(['easy', 'medium', 'hard'] as const).map(d => (<option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)} ({savedQuestions.filter(q => q.difficulty === d).length})</option>))}
                  </select>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
                    style={{ position: 'absolute', right: 9, pointerEvents: 'none', width: 11, height: 11, color: filterDiff !== 'all' ? DS[filterDiff]?.text : 'var(--lms-text-sec)' }}>
                    <path d="M2 4l4 4 4-4" />
                  </svg>
                </div>
              )}
              <button onClick={onClose} style={{ padding: 8, borderRadius: 8, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', cursor: 'pointer' }}><X size={15} style={{ color: 'var(--lms-danger)' }} /></button>
            </div>
          </div>

          {/* Preview banner */}
          <div style={{ padding: '5px 20px', background: 'var(--lms-info-bg)', borderBottom: '1.5px solid var(--lms-info-bdr)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Eye size={11} style={{ color: 'var(--lms-info)' }} />
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, fontWeight: 700, color: 'var(--lms-info)', letterSpacing: 0.4, textTransform: 'uppercase' }}>Preview — Read Only</span>
            {filterDiff !== 'all' && (<span style={{ ...DS[filterDiff]?.pill, fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20, textTransform: 'capitalize', marginLeft: 4 }}>Filtered: {filterDiff}</span>)}
          </div>

          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

            {/* Questions list */}
            <div className="lms-sidebar-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredSavedQuestions.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--lms-text-hint)', gap: 12, paddingTop: 60 }}>
                  <Eye size={40} style={{ opacity: 0.15 }} />
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 600 }}>{filterDiff !== 'all' ? `No ${filterDiff} questions saved yet` : 'No saved questions yet'}</p>
                </div>
              ) : (
                filteredSavedQuestions.map((q, filteredIdx) => {
                  const originalIdx = questions.findIndex(x => x.__localId === q.__localId);
                  const ds = DS[q.difficulty] || DS.medium;
                  const isActive = originalIdx === currentIndex;
                  const isExpanded = expandedSet.has(filteredIdx);
                  const titleText = q.title || 'Untitled';
                  const qNum = (() => {
                    if (isGeneral) return filteredIdx + 1;
                    const sameD = filteredSavedQuestions.filter(x => x.difficulty === q.difficulty);
                    return sameD.findIndex(x => x.__localId === q.__localId) + 1;
                  })();

                  const descBlocksArray = Array.isArray(q.description) ? q.description : descToBlocks(q.description);
                  const srBlocksArray = Array.isArray(q.sampleResult) ? q.sampleResult : descToBlocks(q.sampleResult);

                  return (
                    <div key={q.__localId} style={{
                      border: isActive ? `2px solid var(--lms-orange)` : '1.5px solid var(--lms-border)',
                      borderRadius: 12, boxShadow: isActive ? '0 0 0 3px var(--lms-orange-light)' : '0 1px 4px rgba(0,0,0,0.05)',
                      transition: 'border-color 0.15s, box-shadow 0.15s', flexShrink: 0,
                    }}>
                      <div style={{ padding: '12px 14px', background: isActive ? 'var(--lms-orange-50)' : 'var(--lms-bg-white)', borderRadius: isExpanded ? '10px 10px 0 0' : 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            width: 30, height: 30, borderRadius: 9, fontSize: 12, fontWeight: 800,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            fontFamily: 'var(--lms-font)', background: isActive ? 'var(--lms-orange)' : ds.bg,
                            color: isActive ? 'white' : ds.text, border: `2px solid ${isActive ? 'transparent' : ds.border}`,
                          }}>{qNum}</span>
                          <p style={{ flex: 1, minWidth: 0, fontFamily: 'var(--lms-font)', fontSize: 13.5, fontWeight: 700, color: 'var(--lms-text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleText}</p>
                          {q._id && (<span style={{ fontFamily: 'var(--lms-font)', fontSize: 9, fontWeight: 700, color: 'var(--lms-success)', background: 'var(--lms-success-bg)', border: '1px solid var(--lms-success-bdr)', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>SAVED</span>)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                          {!isGeneral && (<span style={{ ...ds.pill, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, textTransform: 'capitalize' as const, flexShrink: 0 }}>{q.difficulty}</span>)}
                          {subExerciseIsGraded && (<span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', flexShrink: 0 }}>{q.score} marks</span>)}
                          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', flexShrink: 0 }}>Database</span>
                          <div style={{ flex: 1 }} />
                          <button onClick={() => { onJump(originalIdx); onClose(); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'var(--lms-warning-bg)', color: 'var(--lms-warning)', fontSize: 11, fontWeight: 700, border: '1.5px solid var(--lms-warning-bdr)', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--lms-font)', flexShrink: 0 }}><Edit2 size={11} /> Edit</button>
                          <button onClick={() => setDeleteTarget({ localId: q.__localId, title: titleText })} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', fontSize: 11, fontWeight: 700, border: '1.5px solid var(--lms-danger-bdr)', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--lms-font)', flexShrink: 0 }}><Trash2 size={11} /> Delete</button>
                          <button onClick={() => setExpandedSet(prev => { const n = new Set(prev); n.has(filteredIdx) ? n.delete(filteredIdx) : n.add(filteredIdx); return n; })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${isExpanded ? 'var(--lms-violet-bdr)' : 'var(--lms-border)'}`, background: isExpanded ? 'var(--lms-violet-bg)' : 'var(--lms-bg-surface)', cursor: 'pointer', color: isExpanded ? 'var(--lms-violet)' : 'var(--lms-text-muted)', flexShrink: 0 }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div style={{ borderTop: '1.5px solid var(--lms-border)', borderRadius: '0 0 10px 10px', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Description */}
                          <div>
                            <p className="lms-section-label" style={{ marginBottom: 6 }}>Description</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--lms-bg-white)', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--lms-border)' }}>
                              {descBlocksArray.map(renderBlock)}
                            </div>
                          </div>
                          {/* Sample Query */}
                          {q.sampleQuery && (
                            <div>
                              <p className="lms-section-label">Sample Query</p>
                              <pre style={{ background: '#1e1e1e', color: '#d4d4d4', fontFamily: 'ui-monospace,monospace', fontSize: 12, padding: '12px 16px', borderRadius: 10, overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>{q.sampleQuery}</pre>
                            </div>
                          )}
                          {/* Expected Result */}
                          <div>
                            <p className="lms-section-label">Expected Result</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--lms-bg-white)', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--lms-border)' }}>
                              {srBlocksArray.map(renderBlock)}
                            </div>
                          </div>
                          {/* Constraints */}
                          {q.constraints?.filter(c => c?.trim()).length > 0 && (
                            <div>
                              <p className="lms-section-label">Constraints</p>
                              <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {q.constraints.filter(c => c?.trim()).map((c, ci) => (<li key={ci} style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-main)' }}>{c}</li>))}
                              </ul>
                            </div>
                          )}
                          {/* Hints */}
                          {q.hints?.length > 0 && (
                            <div>
                              <p className="lms-section-label">Hints</p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {q.hints.map((h: any, hi: number) => (
                                  <div key={hi} style={{ padding: '8px 12px', background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)', borderRadius: 8 }}>
                                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-warning)', fontWeight: 700 }}>Hint {hi + 1}: </span>
                                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-main)' }}>{h.hintText}</span>
                                    {h.pointsDeduction > 0 && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginLeft: 8 }}>(-{h.pointsDeduction} pts)</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Sidebar - same as programming form */}
            <div style={{ width: 280, flexShrink: 0, borderLeft: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

              {/* Two action buttons */}
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1.5px solid var(--lms-border)', flexShrink: 0, background: 'var(--lms-bg-surface)' }}>
                <button onClick={() => setSidebarTab('details')} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
                  borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                  border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                }} onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-orange)'; b.style.background = 'var(--lms-orange-50)'; b.style.color = '#c85a30'; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-orange-50)', border: '1.5px solid var(--lms-orange-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={14} style={{ color: 'var(--lms-orange)' }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Details</div><div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>ID, type, config, duration</div></div>
                  <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                </button>
                <button onClick={() => setSidebarTab('overview')} style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px',
                  borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                  border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                }} onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-info-bdr)'; b.style.background = 'var(--lms-info-bg)'; b.style.color = 'var(--lms-info)'; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BarChart3 size={14} style={{ color: 'var(--lms-info)' }} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Overview</div><div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>Quota, marks, progress</div></div>
                  <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                </button>
              </div>

              {/* Stats */}
              <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>
                {(() => {
                  const activeDiff = filterDiff === 'all' ? null : filterDiff as 'easy' | 'medium' | 'hard';
                  const diffSlots = activeDiff ? getQuotaForDiff(activeDiff) : 0;
                  const diffCreated = activeDiff ? getCreatedCount(activeDiff) : 0;
                  const diffRemaining = activeDiff ? getRemainingSlots(activeDiff) : 0;
                  const diffMarksTotal = activeDiff ? getTotalMarksForDiff(activeDiff) : 0;
                  const diffMarksUsed = activeDiff ? savedQuestions.filter(q => q.difficulty === activeDiff).reduce((acc, q) => acc + (q.score || 0), 0) : 0;
             
             
                  const diffFixedScore = activeDiff ? getFixedScore(activeDiff) : 0;
                  const diffDS = activeDiff ? (DS[activeDiff] || DS.medium) : null;

                  return (
                    <>
                      {/* Difficulty Questions */}
                      {activeDiff && (
                        <div style={{ marginBottom: 14 }}>
                          <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}><Hash size={12} style={{ color: diffDS.text }} /><span style={{ textTransform: 'capitalize', color: diffDS.text }}>{activeDiff} Questions</span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Total</span><span className="lms-marks-value" style={{ fontSize: 12 }}>{diffSlots}</span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Created</span><span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{diffCreated}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{diffSlots}</span></span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Remaining</span><span className="lms-marks-value" style={{ color: diffRemaining === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{diffRemaining}</span></div>
                          {diffSlots > 0 && (<div className="lms-progress-bar"><div className="lms-progress-fill" style={{ width: `${Math.min(100, (diffCreated / diffSlots) * 100)}%`, background: diffRemaining === 0 ? 'var(--lms-success)' : diffDS.bar }} /></div>)}
                        </div>
                      )}
                      {/* Difficulty Marks */}
                      {activeDiff && subExerciseIsGraded && diffMarksTotal > 0 && (
                        <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14, marginBottom: 14 }}>
                          <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}><Award size={12} style={{ color: diffDS.text }} /><span style={{ textTransform: 'capitalize', color: diffDS.text }}>{activeDiff} Marks</span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Total Mark</span><span className="lms-marks-value" style={{ fontSize: 12 }}>{diffMarksTotal}</span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Mark Per Question</span><span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{diffFixedScore}{isScoreEditable(activeDiff) ? <span className="lms-badge lms-badge-violet" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3 }}>Custom</span> : <span className="lms-badge" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3, background: 'var(--lms-bg-surface)', color: 'var(--lms-text-muted)', borderColor: 'var(--lms-border)' }}>Fixed</span>}</span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Used Marks</span><span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>{fmtMark(diffMarksUsed)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{diffMarksTotal}</span></span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Remaining Marks</span><span className="lms-marks-value" style={{ color: (diffMarksTotal - diffMarksUsed) <= 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>{fmtMark(Math.max(0, diffMarksTotal - diffMarksUsed))}</span></div>
                          <div className="lms-progress-bar"><div className="lms-progress-fill" style={{ width: `${Math.min(100, (diffMarksUsed / diffMarksTotal) * 100)}%`, background: diffMarksUsed >= diffMarksTotal ? 'var(--lms-success)' : diffDS.bar }} /></div>
                        </div>
                      )}
                      {/* Overall Questions */}
                      <div style={{ borderTop: activeDiff ? '1.5px solid var(--lms-border)' : 'none', paddingTop: activeDiff ? 14 : 0, marginBottom: 14 }}>
                        <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}><Hash size={12} style={{ color: 'var(--lms-orange)' }} /><span>Overall Questions</span></div>
                        <div className="lms-marks-row"><span className="lms-marks-label">Total Questions</span><span className="lms-marks-value" style={{ fontSize: 12 }}>{totalSlotsAll}</span></div>
                        <div className="lms-marks-row"><span className="lms-marks-label">Created</span><span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{createdCountAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlotsAll}</span></span></div>
                        <div className="lms-marks-row"><span className="lms-marks-label">Remaining</span><span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlotsAll}</span></div>
                        {totalSlotsAll > 0 && (<div className="lms-progress-bar"><div className="lms-progress-fill" style={{ width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`, background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} /></div>)}
                      </div>
                      {/* Overall Marks */}
                      {subExerciseIsGraded && totalMarksAll > 0 && (
                        <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14 }}>
                          <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}><Award size={12} style={{ color: 'var(--lms-orange)' }} /><span>Overall Marks</span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Marks Per Question</span><span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{isGeneral ? generalMPQ : displayScore}</span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Total Questions</span><span className="lms-marks-value" style={{ fontSize: 12 }}>{totalSlotsAll}</span></div>
                          <div className="lms-marks-row"><span className="lms-marks-label">Total Marks</span><span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{totalMarksAll}</span></div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 20px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--lms-bg-white)' }}>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)' }}>{questions.filter(q => q.isSaved).length} saved · {questions.filter(q => !q.isSaved).length} unsaved</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onClose} className="lms-cancel-btn">Continue Editing</button>
              <button onClick={onDone} className="lms-btn lms-btn-orange"><Check size={13} /> Done</button>
            </div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="lms-modal-backdrop">
          <div className="lms-modal">
            <div className="lms-modal-header" style={{ background: 'var(--lms-danger-bg)', borderBottom: '1.5px solid var(--lms-danger-bdr)' }}>
              <div className="lms-modal-icon" style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}><AlertTriangle size={16} style={{ color: 'var(--lms-danger)' }} /></div>
              <div><h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Delete Question?</h2><p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This action cannot be undone</p></div>
            </div>
            <div className="lms-modal-body">
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>Are you sure you want to delete <strong style={{ color: 'var(--lms-text-main)' }}>"{deleteTarget.title || 'this question'}"</strong>?</p>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', fontWeight: 600 }}>This will permanently remove it.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setDeleteTarget(null)} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
                <button onClick={() => { onDelete(deleteTarget.localId); setDeleteTarget(null); }} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-danger)', color: 'white', border: 'none', boxShadow: 'none' }}><Trash2 size={13} /> Yes, Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─── Delete Confirm Dialog ─────────────────────────────────────────────────────
const DeleteConfirmDialog: React.FC<{
  questionTitle: string; onConfirm: () => void; onCancel: () => void;
}> = ({ questionTitle, onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: 'var(--lms-danger-bg)', borderBottom: '1.5px solid var(--lms-danger-bdr)' }}>
        <div className="lms-modal-icon" style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}><AlertTriangle size={16} style={{ color: 'var(--lms-danger)' }} /></div>
        <div><h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Delete Question?</h2><p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This action cannot be undone</p></div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>Are you sure you want to delete <strong style={{ color: 'var(--lms-text-main)' }}>"{questionTitle || 'this question'}"</strong>?</p>
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', fontWeight: 600 }}>This will permanently remove it.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-danger)', color: 'white', border: 'none', boxShadow: 'none' }}><Trash2 size={13} /> Yes, Delete</button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Close Confirm Dialog ─────────────────────────────────────────────────────
const CloseConfirmDialog: React.FC<{
  hasUnsavedChanges: boolean; hasSavedQuestions: boolean;
  onConfirm: () => void; onCancel: () => void;
}> = ({ hasUnsavedChanges, hasSavedQuestions, onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: hasUnsavedChanges ? 'var(--lms-warning-bg)' : 'var(--lms-bg-surface)' }}>
        <div className="lms-modal-icon" style={{ background: hasUnsavedChanges ? 'var(--lms-warning-bg)' : 'var(--lms-bg-surface2)', border: `1.5px solid ${hasUnsavedChanges ? 'var(--lms-warning-bdr)' : 'var(--lms-border)'}` }}><X size={16} style={{ color: hasUnsavedChanges ? 'var(--lms-warning)' : 'var(--lms-text-sec)' }} /></div>
        <div><h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>{hasUnsavedChanges ? 'Unsaved Changes' : 'Close Form?'}</h2><p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>{hasUnsavedChanges ? 'You have unsaved changes' : 'Are you sure you want to close?'}</p></div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6 }}>{hasUnsavedChanges ? <><span>The current question has </span><strong style={{ color: 'var(--lms-warning)' }}>unsaved changes</strong><span> that will be lost if you close now.</span>{hasSavedQuestions && <span style={{ display: 'block', marginTop: 8, color: 'var(--lms-text-muted)' }}>Previously saved questions will remain intact.</span>}</> : hasSavedQuestions ? <>Are you sure you want to close? Your saved questions will remain intact.</> : <>Are you sure you want to close this form? No questions have been saved yet.</>}</p>
        {hasUnsavedChanges && (<div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)', borderRadius: 'var(--lms-radius-md)' }}><AlertTriangle size={12} style={{ color: 'var(--lms-warning)', marginTop: 2, flexShrink: 0 }} /><p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-warning)' }}>Tip: Click <strong>Cancel</strong> to go back and save your changes first.</p></div>)}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Keep Editing</button>
          <button onClick={onConfirm} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: hasUnsavedChanges ? 'var(--lms-warning)' : 'var(--lms-text-main)', boxShadow: 'none', borderColor: 'transparent' }}><X size={13} />{hasUnsavedChanges ? 'Discard & Close' : 'Yes, Close'}</button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Clear Confirm Dialog ─────────────────────────────────────────────────────
const ClearConfirmDialog: React.FC<{
  onConfirm: () => void; onCancel: () => void;
}> = ({ onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: 'var(--lms-warning-bg)', borderBottom: '1.5px solid var(--lms-warning-bdr)' }}>
        <div className="lms-modal-icon" style={{ background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)' }}><AlertCircle size={16} style={{ color: 'var(--lms-warning)' }} /></div>
        <div><h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Clear All Fields?</h2><p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This will reset the current question</p></div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>Are you sure you want to clear all fields for this question?</p>
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-warning)', fontWeight: 600 }}>Any unsaved content will be lost.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-warning)', color: 'white', border: 'none', boxShadow: 'none' }}><X size={13} /> Yes, Clear All</button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Edit Exercise Confirm Dialog ─────────────────────────────────────────────
const EditExerciseConfirmDialog: React.FC<{
  exerciseName?: string; onConfirm: () => void; onCancel: () => void;
}> = ({ exerciseName, onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: 'var(--lms-orange-50)', borderBottom: '1.5px solid var(--lms-orange-100)' }}>
        <div className="lms-modal-icon" style={{ background: 'var(--lms-orange-100)', border: '1.5px solid var(--lms-orange-100)' }}><Settings size={16} style={{ color: 'var(--lms-orange)' }} /></div>
        <div><h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Edit Exercise Settings?</h2><p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This will close the question form</p></div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6 }}>Do you want to edit the settings for <strong style={{ color: 'var(--lms-text-main)' }}>"{exerciseName || 'this exercise'}"</strong>?<span style={{ display: 'block', marginTop: 8, color: 'var(--lms-text-muted)' }}>The question form will be closed and you'll be taken to the exercise settings. Any unsaved question changes will be lost.</span></p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} className="lms-btn lms-btn-ghost-orange" style={{ flex: 1, justifyContent: 'center' }}><Settings size={13} /> Yes, Edit Exercise</button>
        </div>
      </div>
    </div>
  </div>
);

// ─── Mock SQL Preview Modal ───────────────────────────────────────────────────
const SqlMockModal: React.FC<{
  questions: DBQuestion[];
  exerciseIsGraded?: boolean;
  onClose: () => void;
}> = ({ questions, exerciseIsGraded = true, onClose }) => {
  const [idx, setIdx] = useState(0);
  const [sqlQuery, setSqlQuery] = useState('');
  const [sqlOutput, setSqlOutput] = useState<{
    type: 'idle' | 'running' | 'result' | 'error';
    message?: string;
    rows?: Record<string, any>[];
    columns?: string[];
    time?: number;
  }>({ type: 'idle' });

  const q = questions[idx];
  const ds = DS[q?.difficulty] || DS.medium;
  const descBlocks = q ? (Array.isArray(q.description) ? q.description : descToBlocks(q.description)) : [];
  const srBlocks = q ? (Array.isArray(q.sampleResult) ? q.sampleResult : descToBlocks(q.sampleResult)) : [];

  useEffect(() => {
    if (q?.sampleQuery) setSqlQuery(q.sampleQuery);
  }, [idx, q]);

  const runQuery = async () => {
    const query = sqlQuery.trim();
    if (!query) return;
    setSqlOutput({ type: 'running' });
    await new Promise(r => setTimeout(r, 600));
    const upper = query.toUpperCase();
    if (upper.includes('SELECT')) {
      setSqlOutput({
        type: 'result',
        rows: [{ id: 1, name: 'Alice', dept: 'Engineering' }, { id: 2, name: 'Bob', dept: 'Marketing' }],
        columns: ['id', 'name', 'dept'],
        time: Math.round(Math.random() * 40 + 5),
        message: '2 rows returned',
      });
    } else if (upper.match(/INSERT|UPDATE|DELETE/)) {
      setSqlOutput({ type: 'result', message: `✓ ${Math.floor(Math.random() * 3) + 1} row(s) affected`, time: Math.round(Math.random() * 20 + 3) });
    } else {
      setSqlOutput({ type: 'result', message: '✓ Query executed successfully', time: 2 });
    }
  };

  const renderBlock = (b: any, bi: number) => {
    if (b.type === 'text' && b.value?.trim())
      return <p key={bi} style={{ fontFamily: 'var(--lms-font)', fontSize: 13.5, lineHeight: 1.8, color: '#4a4a4a', margin: 0 }}>{b.value}</p>;
    if (b.type === 'image')
      return (<div key={bi} style={{ display: 'flex', justifyContent: b.alignment === 'right' ? 'flex-end' : b.alignment === 'center' ? 'center' : 'flex-start' }}><img src={b.url} alt="" style={{ width: `${b.sizePercent || 70}%`, borderRadius: 8, border: '1px solid #e5e5e5' }} /></div>);
    if (b.type === 'code') {
      const isDk = ['#1e1e1e', '#282a36', '#272822'].includes(b.bgColor);
      return <pre key={bi} style={{ background: b.bgColor || '#f5f5f5', color: isDk ? '#d4d4d4' : '#1a1a2e', fontFamily: 'ui-monospace,monospace', fontSize: 12.5, padding: '14px 16px', borderRadius: 10, overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>{b.value}</pre>;
    }
    return null;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', background: '#f5f5f5', overflow: 'hidden', fontFamily: 'var(--lms-font)' }}>
      {/* Top Nav */}
      <div style={{ flexShrink: 0, height: 44, borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--lms-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Database size={13} style={{ color: 'white' }} /></div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#333', fontFamily: 'var(--lms-font)' }}>SQL Mock Preview</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {questions.map((_, i) => {
            const isActive = i === idx;
            return (
              <button key={i} onClick={() => setIdx(i)} style={{
                height: 26, minWidth: 26, padding: '0 8px', borderRadius: 6,
                border: `1.5px solid ${isActive ? DS[questions[i].difficulty]?.border || '#e5e5e5' : '#e5e5e5'}`,
                background: isActive ? (DS[questions[i].difficulty]?.bg || '#f8f8f8') : '#f8f8f8',
                color: isActive ? (DS[questions[i].difficulty]?.text || '#666') : '#666',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--lms-font)',
              }}>{i + 1}</button>
            );
          })}
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e5e5', background: '#f8f8f8', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={13} /></button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Problem Panel */}
        <div style={{ width: '42%', flexShrink: 0, borderRight: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
          <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600, color: '#999' }}>{idx + 1} / {questions.length}</span>
              <span style={{ ...ds.pill, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>{q?.difficulty}</span>
              {exerciseIsGraded && q?.score > 0 && <span style={{ fontSize: 10, color: '#999' }}>{q.score} pts</span>}
            </div>
            <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 20, fontWeight: 800, color: '#1a1a2e', margin: '0 0 16px 0', lineHeight: 1.3 }}>{q?.title || 'Untitled'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{descBlocks.map(renderBlock)}</div>
            <div style={{ height: 1, background: '#e5e5e5', margin: '20px 0' }} />
            {q?.sampleQuery && (
              <div>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Sample Query</p>
                <pre style={{ background: '#f8f8f8', border: '1px solid #e5e5e5', borderRadius: 8, padding: '12px 14px', fontSize: 12.5, fontFamily: 'ui-monospace, monospace', color: '#1a1a2e', overflowX: 'auto', lineHeight: 1.6 }}>{q.sampleQuery}</pre>
              </div>
            )}
            <div style={{ marginTop: 20 }}>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Expected Result</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{srBlocks.map(renderBlock)}</div>
            </div>
            {q?.constraints?.filter(c => c.trim()).length > 0 && (
              <div style={{ marginTop: 20 }}>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Constraints</p>
                <ul style={{ margin: 0, paddingLeft: 16 }}>{q.constraints.filter(c => c.trim()).map((c, i) => (<li key={i} style={{ fontSize: 12.5, color: '#3a3a52', lineHeight: 1.6 }}>{c}</li>))}</ul>
              </div>
            )}
          </div>
        </div>

        {/* Right: SQL Editor + Console */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fefefe' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff' }}>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#999' }}>query.sql</span>
            <button className="dbq-run-btn" onClick={runQuery} disabled={sqlOutput.type === 'running'}>
              {sqlOutput.type === 'running' ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Running…</> : <><Play size={13} /> Run</>}
            </button>
          </div>
          <textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} placeholder="-- Write your SQL query here..." style={{
            flex: 0.55, background: '#fefefe', border: 'none', outline: 'none', color: '#1a1a2e',
            fontFamily: 'ui-monospace, "Courier New", monospace', fontSize: 13.5, lineHeight: 1.7,
            padding: '16px 18px', resize: 'none', boxSizing: 'border-box', borderBottom: '1px solid #e5e5e5',
          }} />
          <div style={{ flex: 0.45, display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid #e5e5e5', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: sqlOutput.type === 'running' ? '#16a34a' : '#ccc' }} />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#999' }}>Result</span>
              <button onClick={() => setSqlOutput({ type: 'idle' })} style={{ marginLeft: 'auto', fontSize: 10, color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>clear</button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
              {sqlOutput.type === 'idle' && <span style={{ color: '#ccc', fontSize: 11, fontStyle: 'italic' }}>Run a query to see results...</span>}
              {sqlOutput.type === 'running' && <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: '#16a34a' }} /><span>Running query...</span></div>}
              {sqlOutput.type === 'result' && (
                <div>
                  {sqlOutput.message && <div style={{ color: '#16a34a', marginBottom: 8 }}>{sqlOutput.message}</div>}
                  {sqlOutput.rows && sqlOutput.columns && sqlOutput.rows.length > 0 && (
                    <SqlResultTable rows={sqlOutput.rows} columns={sqlOutput.columns} />
                  )}
                  {sqlOutput.time && <div style={{ fontSize: 10, color: '#999', marginTop: 8 }}>⏱ {sqlOutput.time}ms</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #e5e5e5', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff' }}>
        <button onClick={() => idx > 0 && setIdx(idx - 1)} disabled={idx === 0} className="lms-nav-btn" style={{ opacity: idx === 0 ? 0.3 : 1 }}><ChevronLeft size={12} /> Prev</button>
        <span style={{ fontSize: 11, color: '#999' }}><span style={{ color: 'var(--lms-orange)', fontWeight: 700 }}>{idx + 1}</span> / {questions.length}</span>
        <button onClick={idx < questions.length - 1 ? () => setIdx(idx + 1) : onClose} className="lms-nav-btn" style={{ background: idx < questions.length - 1 ? '#f8f8f8' : 'var(--lms-orange)', color: idx < questions.length - 1 ? '#666' : 'white', borderColor: idx < questions.length - 1 ? '#e5e5e5' : 'transparent' }}>
          {idx < questions.length - 1 ? <>Next <ChevronRight size={12} /></> : <>Done <Check size={12} /></>}
        </button>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const DatabaseQuestionForm: React.FC<DatabaseQuestionFormProps> = ({
  exerciseData, tabType, initialData, isEditing = false,
  onClose, onSave, onDeleteQuestion, isSaving, saveProgress, saveMessage,
  lockedDifficulty, onEditExercise, sectionData,
}) => {
  injectFonts();

  // ── State ─────────────────────────────────────────────────────────────────
  const [dbQuestions, setDbQuestions] = useState<DBQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentDiff, setCurrentDiff] = useState<'easy' | 'medium' | 'hard'>(lockedDifficulty || 'medium');
  const [isEditMode, setIsEditMode] = useState(!!isEditing);

  // Form fields
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(lockedDifficulty || 'medium');
  const [score, setScore] = useState(0);
  const [constraints, setConstraints] = useState<string[]>(['']);
  const [hint, setHint] = useState('');
  const [extraHints, setExtraHints] = useState<HintItem[]>([]);
  const [sampleQuery, setSampleQuery] = useState('');
  const [descBlocks, setDescBlocks] = useState<ProgContentBlock[]>([mkProgTextBlock()]);
  const [sampleResultBlocks, setSampleResultBlocks] = useState<ProgContentBlock[]>([mkProgTextBlock()]);

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [showMockModal, setShowMockModal] = useState(false);
  const [showExtraHints, setShowExtraHints] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [showEditExerciseConfirm, setShowEditExerciseConfirm] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [saveOk, setSaveOk] = useState(false);
  const [validationToast, setValidationToast] = useState<string[]>([]);

  // Refs
  const titleRef = useRef<HTMLDivElement>(null);
  const serverIdMap = useRef<Map<string, string>>(new Map());
  const dbQuestionsRef = useRef<DBQuestion[]>([]);
  const currentIndexRef = useRef<number>(0);
  const formScrollRef = useRef<HTMLDivElement>(null);
  const stickyToolbarRef = useRef<HTMLDivElement>(null);
  const titleSectionRef = useRef<HTMLDivElement>(null);
  const descSectionRef = useRef<HTMLDivElement>(null);
  const constraintsSectionRef = useRef<HTMLDivElement>(null);
  const sampleQuerySectionRef = useRef<HTMLDivElement>(null);
  const sampleResultSectionRef = useRef<HTMLDivElement>(null);

  // Editor formatting state
  const [editorState, setEditorState] = useState({
    activeElement: null as HTMLElement | null,
    isBold: false,
    isItalic: false,
    isUnderline: false,
  });

  // ── Exercise config helpers ────────────────────────────────────────────────
  const progCfg = exerciseData?.fullExerciseData?.questionConfiguration?.programmingQuestionConfiguration;
  const cfgType = (progCfg?.questionConfigType as string) || 'general';
  const isGeneral = cfgType === 'general';

  // ── Question Source enforcement (see ProgrammingQuestionForm for the rule) ──
  const questionSourceRaw = exerciseData?.fullExerciseData?.questionSource;
  const customSourcesRaw: string[] = Array.isArray(exerciseData?.fullExerciseData?.customSources) ? exerciseData.fullExerciseData.customSources : [];
  const allowedSources = (() => {
    const s = questionSourceRaw || null;
    if (s === 'scratch') return { manual: true, bank: true, ai: false, thirdParty: false, upload: true };
    if (s === 'ai') return { manual: false, bank: false, ai: true, thirdParty: false, upload: false };
    if (s === 'thirdParty') return { manual: false, bank: true, ai: false, thirdParty: true, upload: false };
    if (s === 'custom') {
      const has = (x: string) => customSourcesRaw.includes(x);
      return { manual: has('scratch'), bank: has('scratch') || has('thirdParty'), ai: has('ai'), thirdParty: has('thirdParty'), upload: has('scratch') };
    }
    return { manual: true, bank: true, ai: true, thirdParty: true, upload: true };
  })();
  const generalQuestionCount: number = progCfg?.generalQuestionCount || 0;
  const generalTotalMarks: number = exerciseData?.fullExerciseData?.exerciseInformation?.totalMarksProgramming ||
    exerciseData?.fullExerciseData?.exerciseInformation?.totalMarks || 0;
  const generalMPQ: number = progCfg?.generalMarksPerQuestion ||
    progCfg?.scoreSettings?.evenMarks ||
    Math.floor(generalTotalMarks / Math.max(1, generalQuestionCount));
  const exerciseIsGraded = exerciseData?.fullExerciseData?.isGraded !== false;

  const getConfiguredDiffs = useCallback((): Array<'easy' | 'medium' | 'hard'> => {
    if (isGeneral) return [];
    if (cfgType === 'levelBased') {
      const lsc = progCfg?.scoreSettings?.levelScoringConfiguration || {};
      return (['easy', 'medium', 'hard'] as const).filter(d => (lsc[d]?.questionCount || progCfg?.levelBasedCounts?.[d] || 0) > 0);
    }
    if (cfgType === 'selectionLevel') {
      const sel = progCfg?.selectionLevelCounts || {};
      return (['easy', 'medium', 'hard'] as const).filter(d => (sel[d] || 0) > 0);
    }
    return [];
  }, [isGeneral, cfgType, progCfg]);

  const getQuotaForDiff = useCallback((d: 'easy' | 'medium' | 'hard'): number => {
    if (cfgType === 'levelBased') return progCfg?.scoreSettings?.levelScoringConfiguration?.[d]?.questionCount || progCfg?.levelBasedCounts?.[d] || 0;
    if (cfgType === 'selectionLevel') return progCfg?.selectionLevelCounts?.[d] || 0;
    return generalQuestionCount;
  }, [cfgType, progCfg, generalQuestionCount]);

  const getDbQuestionsForDiff = useCallback((d?: 'easy' | 'medium' | 'hard'): DBQuestion[] => {
    const all = dbQuestions;
    if (!d) return all;
    return all.filter(q => q.difficulty === d);
  }, [dbQuestions]);

  const getFixedScore = useCallback((d: 'easy' | 'medium' | 'hard'): number => {
    if (isGeneral) return generalMPQ;
    const lsc = progCfg?.scoreSettings?.levelScoringConfiguration?.[d];
    if (lsc?.type === 'level_specific') return lsc.marksPerQuestion || 0;
    return progCfg?.scoreSettings?.levelBasedMarks?.[d] || 0;
  }, [isGeneral, generalMPQ, progCfg]);

  const isScoreEditable = useCallback((d: 'easy' | 'medium' | 'hard'): boolean =>
    !isGeneral && progCfg?.scoreSettings?.levelScoringConfiguration?.[d]?.type === 'question_specific',
    [isGeneral, progCfg]);

  const getTotalMarksForDiff = useCallback((d: 'easy' | 'medium' | 'hard'): number => {
    const lsc = progCfg?.scoreSettings?.levelScoringConfiguration?.[d];
    if (lsc?.type === 'question_specific') return lsc.totalMarks || 0;
    if (lsc?.type === 'level_specific') return (lsc.marksPerQuestion || 0) * (lsc.questionCount || 0);
    return (progCfg?.scoreSettings?.levelBasedMarks?.[d] || 0) * getQuotaForDiff(d);
  }, [progCfg, getQuotaForDiff]);

  // Helper to check if current form has content
  const currentFormHasContent = useMemo((): boolean => {
    const descText = descBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
    const srText = sampleResultBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
    return !!(title.trim() || descText || sampleQuery.trim() || srText);
  }, [title, descBlocks, sampleQuery, sampleResultBlocks]);

  // Check if current question is already saved
  const currentAlreadySaved = useMemo((): boolean => {
    const currentQ = dbQuestions[currentIndex];
    return !!(currentQ?._id || currentQ?.isSaved || serverIdMap.current.has(currentQ?.__localId || ''));
  }, [dbQuestions, currentIndex, serverIdMap]);

  // Get created count including the current unsaved question if it has content
  const getCreatedCount = useCallback((d?: 'easy' | 'medium' | 'hard'): number => {
    const savedCount = getDbQuestionsForDiff(d).length;
    const shouldCountCurrent = !currentAlreadySaved && currentFormHasContent && (!d || currentDiff === d);
    return savedCount + (shouldCountCurrent ? 1 : 0);
  }, [getDbQuestionsForDiff, currentAlreadySaved, currentFormHasContent, currentDiff]);

  // Get used marks including current unsaved question
  const getDbMarksUsedForDiff = useCallback((d: 'easy' | 'medium' | 'hard'): number => {
    const savedMarks = getDbQuestionsForDiff(d).reduce((s, q) => s + (q.score || 0), 0);
    const currentScore = isGeneral ? generalMPQ : (isScoreEditable(d) ? score : getFixedScore(d));
    const shouldCountCurrent = !currentAlreadySaved && currentFormHasContent && currentDiff === d;
    return savedMarks + (shouldCountCurrent ? currentScore : 0);
  }, [getDbQuestionsForDiff, currentAlreadySaved, currentFormHasContent, currentDiff, score, isGeneral, generalMPQ, isScoreEditable, getFixedScore]);

  // Get remaining slots
  const getRemainingSlots = useCallback((d?: 'easy' | 'medium' | 'hard'): number => {
    if (isGeneral) return Math.max(0, generalQuestionCount - getCreatedCount());
    if (!d) return 0;
    return Math.max(0, getQuotaForDiff(d) - getCreatedCount(d));
  }, [isGeneral, generalQuestionCount, getQuotaForDiff, getCreatedCount]);

  // ── Totals for all difficulties ────────────────────────────────────────────
  const totalSlotsAll = isGeneral
    ? generalQuestionCount
    : getConfiguredDiffs().reduce((s, d) => s + getQuotaForDiff(d), 0);
  const createdCountAll = getCreatedCount();
  const remainingSlotsAll = Math.max(0, totalSlotsAll - createdCountAll);
  const usedMarksAll = getConfiguredDiffs().reduce((acc, d) => acc + getDbMarksUsedForDiff(d), 0);
  const totalMarksAll = exerciseData?.fullExerciseData?.exerciseInformation?.totalMarksProgramming ||
    exerciseData?.fullExerciseData?.exerciseInformation?.totalMarks || 0;

  // ── Current difficulty values ──────────────────────────────────────────────
  const totalSlots = isGeneral ? generalQuestionCount : getQuotaForDiff(currentDiff);
  const createdCount = getCreatedCount(currentDiff);
  const remainingSlots = Math.max(0, totalSlots - createdCount);
  const usedMarks = getDbMarksUsedForDiff(currentDiff);
  const totalMarksForDiff = getTotalMarksForDiff(currentDiff);
  const remainingMarks = isGeneral ? 0 : Math.max(0, totalMarksForDiff - usedMarks);
  const displayScore = isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff));

  // ── Mock enabled only when ALL required questions are saved ────────────────
  const isMockEnabled = totalSlotsAll <= 0 ? createdCountAll > 0 : createdCountAll >= totalSlotsAll;

  // ... rest of the component continues with buildInitialFlow, loadQuestionIntoForm, etc.
  // ── Build initial flow from exerciseData ───────────────────────────────────
  const buildInitialFlow = useCallback((): { questions: DBQuestion[]; startIndex: number } => {
    const existingQuestions = exerciseData?.fullExerciseData?.questions || [];
    const dbQuestionsFromExercise = existingQuestions.filter((q: any) => q.questionType === 'database');
    const convertedQuestions = dbQuestionsFromExercise.map(dbQuestionToFlow);

    if ((isEditing || initialData?._id) && initialData) {
      const alreadyExists = convertedQuestions.some(q => q._id === initialData._id);
      if (!alreadyExists) convertedQuestions.unshift(dbQuestionToFlow(initialData));
    }

    let startIdx = 0;
    if (isEditing && initialData?._id) {
      startIdx = convertedQuestions.findIndex(q => q._id === initialData._id);
      if (startIdx === -1) startIdx = 0;
    } else if (convertedQuestions.length > 0 && !isEditing) {
      startIdx = convertedQuestions.length;
    }

    if (convertedQuestions.length === 0 && !isEditing) {
      const emptyQ: DBQuestion = {
        __localId: mkLocalId(), title: '', description: [mkProgTextBlock()],
        difficulty: lockedDifficulty || 'medium',
        score: isGeneral ? generalMPQ : (isScoreEditable(lockedDifficulty || 'medium') ? 0 : getFixedScore(lockedDifficulty || 'medium')),
        sampleQuery: '', sampleResult: [mkProgTextBlock()], constraints: [], hints: [],
        questionType: 'database', isSaved: false, isDirty: false, isPreExisting: false,
      };
      convertedQuestions.push(emptyQ);
      startIdx = 0;
    }

    return { questions: convertedQuestions, startIndex: startIdx };
  }, [exerciseData, isEditing, initialData, lockedDifficulty, isGeneral, generalMPQ, isScoreEditable, getFixedScore]);







// Get created count INCLUDING current unsaved question
const getCreatedCountIncludingUnsaved = useCallback((d?: 'easy' | 'medium' | 'hard'): number => {
  const savedCount = getCreatedCount(d);
  
  const shouldCountCurrent = !currentAlreadySaved && 
    currentFormHasContent && 
    (!d || currentDiff === d);
  
  return savedCount + (shouldCountCurrent ? 1 : 0);
}, [getCreatedCount, currentAlreadySaved, currentFormHasContent, currentDiff]);

// Get used marks INCLUDING current unsaved question
const getUsedMarksIncludingUnsaved = useCallback((d: 'easy' | 'medium' | 'hard'): number => {
  const savedMarks = getDbMarksUsedForDiff(d);
  
  const currentScore = isGeneral ? generalMPQ : (isScoreEditable(d) ? score : getFixedScore(d));
  
  const shouldCountCurrent = !currentAlreadySaved && 
    currentFormHasContent && 
    currentDiff === d;
  
  return savedMarks + (shouldCountCurrent ? currentScore : 0);
}, [getDbMarksUsedForDiff, currentAlreadySaved, currentFormHasContent, currentDiff, score, isGeneral, generalMPQ, isScoreEditable, getFixedScore]);

// Overall totals INCLUDING unsaved current question
const createdCountAllIncludingUnsaved = useMemo((): number => {
  if (isGeneral) {
    return getCreatedCountIncludingUnsaved();
  }
  return getConfiguredDiffs().reduce((s, d) => s + getCreatedCountIncludingUnsaved(d), 0);
}, [isGeneral, getConfiguredDiffs, getCreatedCountIncludingUnsaved]);

const usedMarksAllIncludingUnsaved = useMemo((): number => {
  if (isGeneral) return 0;
  return getConfiguredDiffs().reduce((s, d) => s + getUsedMarksIncludingUnsaved(d), 0);
}, [isGeneral, getConfiguredDiffs, getUsedMarksIncludingUnsaved]);

const remainingSlotsAllIncludingUnsaved = useMemo((): number => {
  return Math.max(0, totalSlotsAll - createdCountAllIncludingUnsaved);
}, [totalSlotsAll, createdCountAllIncludingUnsaved]);

// For current difficulty
const createdCountIncludingUnsaved = useMemo((): number => {
  return getCreatedCountIncludingUnsaved(currentDiff);
}, [getCreatedCountIncludingUnsaved, currentDiff]);

const usedMarksIncludingUnsaved = useMemo((): number => {
  return getUsedMarksIncludingUnsaved(currentDiff);
}, [getUsedMarksIncludingUnsaved, currentDiff]);

const remainingSlotsIncludingUnsaved = useMemo((): number => {
  return Math.max(0, totalSlots - createdCountIncludingUnsaved);
}, [totalSlots, createdCountIncludingUnsaved]);

const remainingMarksIncludingUnsaved = useMemo((): number => {
  return Math.max(0, totalMarksForDiff - usedMarksIncludingUnsaved);
}, [totalMarksForDiff, usedMarksIncludingUnsaved]);




  const initialFlow = useMemo(() => buildInitialFlow(), [buildInitialFlow]);

  useEffect(() => {
    setDbQuestions(initialFlow.questions);
    dbQuestionsRef.current = initialFlow.questions;
    setCurrentIndex(initialFlow.startIndex);
    currentIndexRef.current = initialFlow.startIndex;
    initialFlow.questions.forEach(q => {
      if (q._id && q.__localId) serverIdMap.current.set(q.__localId, q._id);
    });
  }, [initialFlow]);

  // ── Load question into form ────────────────────────────────────────────────
  const loadQuestionIntoForm = useCallback((q: DBQuestion) => {
    setTitle(q.title || '');
    if (titleRef.current) titleRef.current.innerHTML = q.title || '';
    setDescBlocks(Array.isArray(q.description) ? q.description : descToBlocks(q.description));
    setSampleQuery(q.sampleQuery || '');
    setSampleResultBlocks(Array.isArray(q.sampleResult) ? q.sampleResult : descToBlocks(q.sampleResult));
    setConstraints(q.constraints?.length ? [...q.constraints] : ['']);
    if (q.hints?.length > 0) {
      const [first, ...rest] = q.hints;
      setHint(first?.hintText || '');
      setExtraHints(rest.map((h: any) => ({ hintText: h.hintText || '', pointsDeduction: h.pointsDeduction || 0, isPublic: h.isPublic !== false })));
      if (rest.length > 0) setShowExtraHints(true);
    } else {
      setHint('');
      setExtraHints([]);
    }
    setScore(q.score || 0);
    setDifficulty(q.difficulty || currentDiff);
    setCurrentDiff(q.difficulty || currentDiff);
    setErrs({});
    setTouched(new Set());
    setIsEditMode(!!(q._id));
  }, [currentDiff]);

  useEffect(() => {
    if (dbQuestions[currentIndex]) {
      loadQuestionIntoForm(dbQuestions[currentIndex]);
    }
  }, [currentIndex, dbQuestions, loadQuestionIntoForm]);

  useEffect(() => {
    dbQuestionsRef.current = dbQuestions;
  }, [dbQuestions]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // ── Helper functions ───────────────────────────────────────────────────────
  const getServerId = useCallback((q: DBQuestion | null | undefined): string | undefined => {
    if (!q) return undefined;
    const mapped = serverIdMap.current.get(q.__localId);
    if (mapped) return mapped;
    if (q._id) return q._id;
    return undefined;
  }, []);

  const registerSavedId = useCallback((localId: string, serverId: string) => {
    serverIdMap.current.set(localId, serverId);
    setDbQuestions(prev => {
      const next = prev.map(q =>
        q.__localId === localId ? { ...q, _id: serverId, isSaved: true, isDirty: false, isPreExisting: true } : q
      );
      dbQuestionsRef.current = next;
      return next;
    });
  }, []);

  const snapshotForm = useCallback((): DBQuestion => {
    const existing = dbQuestionsRef.current[currentIndexRef.current];
    const allHints = hint.trim()
      ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 }, ...extraHints.map((h, i) => ({ ...h, sequence: i + 1 }))]
      : extraHints.map((h, i) => ({ ...h, sequence: i }));
    const finalScore = isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff));
    const serverId = getServerId(existing);

    return {
      __localId: existing?.__localId || mkLocalId(),
      _id: serverId,
      title: title.trim() || '',
      description: blocksToDescription(descBlocks),
      difficulty: currentDiff,
      score: finalScore,
      sampleQuery: sampleQuery.trim(),
      sampleResult: sampleResultBlocks,
      constraints: constraints.filter(c => c.trim()),
      hints: allHints,
      questionType: 'database',
      isSaved: !!serverId || existing?.isSaved || false,
      isDirty: !!serverId,
      isPreExisting: !!serverId || existing?.isPreExisting || false,
    };
  }, [title, descBlocks, currentDiff, score, sampleQuery, sampleResultBlocks, constraints, hint, extraHints, isGeneral, generalMPQ, isScoreEditable, getFixedScore, getServerId]);

  const validate = useCallback((): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    const descText = descBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
    if (!descText && !descBlocks.some(b => b.type === 'image' || b.type === 'code')) e.description = 'Description is required';
    if (!sampleQuery.trim()) e.sampleQuery = 'Sample query is required';
    const srText = sampleResultBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
    if (!srText && !sampleResultBlocks.some(b => b.type === 'image')) e.sampleResult = 'Expected result is required';

    if (!isGeneral && isScoreEditable(currentDiff)) {
      const totalAllowed = totalMarksForDiff;
      const existingServerId = getServerId(dbQuestions[currentIndex]);
      const isEditExist = !!(existingServerId || isEditing);
      if (isEditExist && existingServerId) {
        const otherSum = getDbQuestionsForDiff(currentDiff).reduce((s, q) => q._id?.toString() === existingServerId ? s : s + (q.score || 0), 0);
        if (otherSum + score > totalAllowed + 0.01) e.score = `Max for this question: ${fmtMark(Math.max(0, totalAllowed - otherSum))}`;
      } else {
        const remaining = Math.max(0, totalAllowed - usedMarks);
        if (score > remaining + 0.01) e.score = `Score (${score}) exceeds remaining marks (${fmtMark(remaining)})`;
      }
      if (!e.score && score <= 0) e.score = 'Score must be greater than 0';
    } else if (!isGeneral && score <= 0 && getFixedScore(currentDiff) <= 0) {
      e.score = 'Score must be greater than 0';
    }
    return e;
  }, [title, descBlocks, sampleQuery, sampleResultBlocks, isGeneral, isScoreEditable, currentDiff, totalMarksForDiff, getServerId, dbQuestions, currentIndex, isEditing, score, getDbQuestionsForDiff, usedMarks, getFixedScore]);

  useEffect(() => {
    if (touched.size > 0) setErrs(validate());
  }, [title, descBlocks, sampleQuery, sampleResultBlocks, score, constraints, touched, validate]);

  const touch = (field: string) => setTouched(prev => new Set(prev).add(field));

  const scrollToFirstError = (errors: Record<string, string>) => {
    const order: { key: string; ref: React.RefObject<HTMLDivElement | null> }[] = [
      { key: 'title', ref: titleSectionRef },
      { key: 'description', ref: descSectionRef },
      { key: 'sampleQuery', ref: sampleQuerySectionRef },
      { key: 'sampleResult', ref: sampleResultSectionRef },
      { key: 'constraints', ref: constraintsSectionRef },
    ];
    for (const { key, ref } of order) {
      if (errors[key] && ref.current) {
        const container = formScrollRef.current;
        if (container) {
          const stickyHeight = (stickyToolbarRef.current?.offsetHeight ?? 60) + 8;
          const containerRect = container.getBoundingClientRect();
          const elementRect = ref.current.getBoundingClientRect();
          const scrollTop = container.scrollTop + (elementRect.top - containerRect.top) - stickyHeight;
          container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
        } else {
          ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        break;
      }
    }
    const messages = Object.values(errors);
    if (messages.length > 0) {
      setValidationToast(messages);
      setTimeout(() => setValidationToast([]), 3000);
    }
  };

  const hasUnsavedFormChanges = useMemo((): boolean => {
    const currentQ = dbQuestions[currentIndex];
    if (!currentQ || (!currentQ._id && !currentQ.isSaved)) return !!(title.trim() || descBlocks.some(b => b.type !== 'text' || (b as any).value?.trim()) || sampleQuery.trim());
    if (isEditMode && currentQ) {
      return title.trim() !== currentQ.title ||
        JSON.stringify(descBlocks) !== JSON.stringify(currentQ.description) ||
        score !== currentQ.score ||
        sampleQuery.trim() !== currentQ.sampleQuery ||
        JSON.stringify(sampleResultBlocks) !== JSON.stringify(currentQ.sampleResult);
    }
    return false;
  }, [dbQuestions, currentIndex, isEditMode, title, descBlocks, score, sampleQuery, sampleResultBlocks]);

  const hasSavedQuestionsInSession = useMemo((): boolean =>
    dbQuestions.some(q => q.isSaved || q._id || serverIdMap.current.has(q.__localId)),
    [dbQuestions]);

  const shouldConfirmClose = useMemo((): boolean => hasUnsavedFormChanges || hasSavedQuestionsInSession, [hasUnsavedFormChanges, hasSavedQuestionsInSession]);

  const handleCloseRequest = useCallback(() => { if (shouldConfirmClose) setShowCloseConfirm(true); else onClose(); }, [shouldConfirmClose, onClose]);
  const handleCloseConfirmed = useCallback(() => { setShowCloseConfirm(false); onClose(); }, [onClose]);
  const handleEditExerciseClick = useCallback(() => setShowEditExerciseConfirm(true), []);
  const handleEditExerciseConfirm = useCallback(() => { setShowEditExerciseConfirm(false); onEditExercise?.(); }, [onEditExercise]);

  const handleClearCurrentQuestion = useCallback(() => {
    setTitle('');
    if (titleRef.current) titleRef.current.innerHTML = '';
    setDescBlocks([mkProgTextBlock()]);
    setSampleQuery('');
    setSampleResultBlocks([mkProgTextBlock()]);
    setConstraints(['']);
    setHint('');
    setExtraHints([]);
    const defaultScore = isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff));
    setScore(defaultScore);
    setErrs({});
    setTouched(new Set());
    setIsEditMode(false);
    setShowClearConfirm(false);
  }, [isGeneral, generalMPQ, isScoreEditable, currentDiff, getFixedScore]);

  const handleDeleteCurrentQuestion = useCallback(async () => {
    const currentQ = dbQuestions[currentIndex];
    if (!currentQ) return;
    const serverId = serverIdMap.current.get(currentQ.__localId) || currentQ._id;
    const currentIdx = currentIndex;

    if (serverId && onDeleteQuestion) {
      try {
        await onDeleteQuestion(serverId as string);
      } catch (err) {
        console.error('Failed to delete question from DB:', err);
        setShowDeleteConfirm(false);
        return;
      }
    }

    setDbQuestions(prev => {
      const newFlow = prev.filter(q => q.__localId !== currentQ.__localId);
      dbQuestionsRef.current = newFlow;

      let newIndex = currentIdx;
      if (newFlow.length === 0) {
        const emptyQ: DBQuestion = {
          __localId: mkLocalId(), title: '', description: [mkProgTextBlock()],
          difficulty: currentDiff,
          score: isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)),
          sampleQuery: '', sampleResult: [mkProgTextBlock()], constraints: [], hints: [],
          questionType: 'database', isSaved: false, isDirty: false, isPreExisting: false,
        };
        newFlow.push(emptyQ);
        newIndex = 0;
      } else if (currentIdx >= newFlow.length) {
        newIndex = newFlow.length - 1;
      } else if (currentIdx > 0) {
        newIndex = currentIdx - 1;
      } else {
        newIndex = 0;
      }

      setTimeout(() => {
        setCurrentIndex(newIndex);
        currentIndexRef.current = newIndex;
        if (newFlow[newIndex]) {
          loadQuestionIntoForm(newFlow[newIndex]);
          if (newFlow[newIndex]?.difficulty) {
            setCurrentDiff(newFlow[newIndex].difficulty);
            setDifficulty(newFlow[newIndex].difficulty);
          }
        }
      }, 0);

      return newFlow;
    });

    serverIdMap.current.delete(currentQ.__localId);
    setShowDeleteConfirm(false);
  }, [dbQuestions, currentIndex, onDeleteQuestion, currentDiff, isGeneral, generalMPQ, isScoreEditable, getFixedScore, loadQuestionIntoForm]);

  const executeSave = useCallback(async (localId: string, payload: any, isSaveAndNext: boolean): Promise<string | undefined> => {
    const result = await onSave({ ...payload, __saveAndNext: isSaveAndNext, __isUpdate: !!payload._id, __questionId: payload._id, __editLocalId: localId });
    const savedId = result?._id || result?.data?._id || result?.questionId || result?.data?.questionId;
    if (savedId) registerSavedId(localId, savedId);
    const updatedFlow = dbQuestionsRef.current.map(q =>
      q.__localId === localId ? { ...q, ...payload, _id: savedId || q._id, isSaved: true, isDirty: false, isPreExisting: true } : q
    );
    dbQuestionsRef.current = updatedFlow;
    setDbQuestions(updatedFlow);
    return savedId;
  }, [onSave, registerSavedId]);

  const handleSave = useCallback(async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrs(validationErrors);
      setTouched(new Set(Object.keys(validationErrors)));
      scrollToFirstError(validationErrors);
      return;
    }
    const snap = snapshotForm();
    const localId = snap.__localId;
    const serverId = getServerId(dbQuestions[currentIndex]);
    if (serverId && !hasUnsavedFormChanges) return;
    try {
      await executeSave(localId, { ...snap, __preventClose: true }, false);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
      setIsEditMode(false);
    } catch (err) {
      console.error('Save error:', err);
    }
  }, [validate, snapshotForm, getServerId, dbQuestions, currentIndex, hasUnsavedFormChanges, executeSave]);

  const advanceAfterSave = useCallback((savedId: string | undefined) => {
    const flow = dbQuestionsRef.current;
    const idx = currentIndexRef.current;
    const nextIdx = idx + 1;

    if (nextIdx < flow.length) {
      setCurrentIndex(nextIdx);
      currentIndexRef.current = nextIdx;
      if (flow[nextIdx]?.difficulty) {
        setCurrentDiff(flow[nextIdx].difficulty);
        setDifficulty(flow[nextIdx].difficulty);
      }
      loadQuestionIntoForm(flow[nextIdx]);
      return;
    }

    if (isEditing) {
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
      return;
    }

    if (isGeneral) {
      if (getRemainingSlots() > 0) {
        const newQ: DBQuestion = {
          __localId: mkLocalId(), title: '', description: [mkProgTextBlock()],
          difficulty: currentDiff, score: generalMPQ, sampleQuery: '', sampleResult: [mkProgTextBlock()],
          constraints: [], hints: [], questionType: 'database', isSaved: false, isDirty: false, isPreExisting: false,
        };
        const newFlow = [...flow, newQ];
        dbQuestionsRef.current = newFlow; setDbQuestions(newFlow);
        setCurrentIndex(flow.length); currentIndexRef.current = flow.length;
        setTitle(''); if (titleRef.current) titleRef.current.innerHTML = '';
        setDescBlocks([mkProgTextBlock()]); setSampleQuery(''); setSampleResultBlocks([mkProgTextBlock()]);
        setConstraints(['']); setHint(''); setExtraHints([]); setScore(generalMPQ);
      } else {
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 2500);
      }
    } else {
      if (getRemainingSlots(currentDiff) > 0) {
        const defaultScore = isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff);
        const newQ: DBQuestion = {
          __localId: mkLocalId(), title: '', description: [mkProgTextBlock()],
          difficulty: currentDiff, score: defaultScore, sampleQuery: '', sampleResult: [mkProgTextBlock()],
          constraints: [], hints: [], questionType: 'database', isSaved: false, isDirty: false, isPreExisting: false,
        };
        const newFlow = [...flow, newQ];
        dbQuestionsRef.current = newFlow; setDbQuestions(newFlow);
        setCurrentIndex(flow.length); currentIndexRef.current = flow.length;
        setTitle(''); if (titleRef.current) titleRef.current.innerHTML = '';
        setDescBlocks([mkProgTextBlock()]); setSampleQuery(''); setSampleResultBlocks([mkProgTextBlock()]);
        setConstraints(['']); setHint(''); setExtraHints([]); setScore(defaultScore);
      } else {
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 2500);
      }
    }
  }, [isEditing, isGeneral, getRemainingSlots, generalMPQ, currentDiff, isScoreEditable, getFixedScore, loadQuestionIntoForm]);

  // ─── ADD QUESTION VIA — Build from Scratch · Question Bank · Generate AI · Upload via Document ──
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  // "Add Question via" dropdown — robust outside-click close (capture phase + ref
  // containment) so it fires even when the click lands on a stopPropagation element.
  useEffect(() => {
    if (!showAddDropdown) return;
    const close = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener('mousedown', close, true);
    return () => document.removeEventListener('mousedown', close, true);
  }, [showAddDropdown]);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Collapse any text-ish shape (string | {text} | {contentBlocks} | block[]) to
  // plain text, so bank/AI questions AND document questions all map cleanly.
  const incomingAsText = (v: any): string => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map((b: any) => b?.value ?? b?.text ?? '').filter(Boolean).join(' ').trim();
    if (typeof v === 'object') {
      if (typeof v.text === 'string') return v.text;
      if (Array.isArray(v.contentBlocks)) return v.contentBlocks.map((b: any) => b?.value ?? '').filter(Boolean).join(' ').trim();
    }
    return String(v);
  };

  // Build from Scratch — append a fresh blank DB question at the current diff.
  const addBlankDBQuestion = useCallback(() => {
    const flow = dbQuestionsRef.current;
    const remaining = isGeneral ? getRemainingSlots() : getRemainingSlots(currentDiff);
    if (remaining <= 0) { toast.warning('All question slots for this difficulty are filled.'); return; }
    const defaultScore = isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff));
    const newQ: DBQuestion = {
      __localId: mkLocalId(), title: '', description: [mkProgTextBlock()],
      difficulty: currentDiff, score: defaultScore, sampleQuery: '', sampleResult: [mkProgTextBlock()],
      constraints: [], hints: [], questionType: 'database', isSaved: false, isDirty: false, isPreExisting: false,
    };
    const newFlow = [...flow, newQ];
    dbQuestionsRef.current = newFlow; setDbQuestions(newFlow);
    setCurrentIndex(newFlow.length - 1); currentIndexRef.current = newFlow.length - 1;
    loadQuestionIntoForm(newQ);
  }, [isGeneral, getRemainingSlots, currentDiff, generalMPQ, isScoreEditable, getFixedScore, loadQuestionIntoForm]);

  // Map incoming questions (Question Bank · Generate AI · Document) → DBQuestion.
  const handleIncomingDBQuestions = useCallback((incoming: any[]) => {
    if (!incoming?.length) return;
    const flow = dbQuestionsRef.current;
    const toBlocks = (s: string) => [{ ...mkProgTextBlock(), value: s || '' }];
    const mapped: DBQuestion[] = incoming.map((q) => {
      const dl = String(q.difficulty || q.mcqQuestionDifficulty || '').toLowerCase();
      const diff = (['easy', 'medium', 'hard'].includes(dl) ? dl : currentDiff) as 'easy' | 'medium' | 'hard';
      const defaultScore = isGeneral ? generalMPQ : (isScoreEditable(diff) ? 0 : getFixedScore(diff));
      const sampleResult = Array.isArray(q.sampleResult) ? q.sampleResult : toBlocks(incomingAsText(q.sampleResult));
      return {
        __localId: mkLocalId(),
        title: incomingAsText(q.title ?? q.mcqQuestionTitle) || 'Untitled Database Question',
        description: Array.isArray(q.description) ? q.description : toBlocks(incomingAsText(q.description)),
        difficulty: diff,
        score: defaultScore,
        sampleQuery: incomingAsText(q.sampleQuery),
        sampleResult,
        constraints: Array.isArray(q.constraints) ? q.constraints : (q.constraints ? [String(q.constraints)] : []),
        hints: [],
        questionType: 'database',
        isSaved: false, isDirty: false, isPreExisting: false,
      };
    });
    const newFlow = [...flow, ...mapped];
    dbQuestionsRef.current = newFlow; setDbQuestions(newFlow);
    const startIdx = flow.length;
    setCurrentIndex(startIdx); currentIndexRef.current = startIdx;
    if (mapped[0]) setTimeout(() => loadQuestionIntoForm(mapped[0]), 80);
    toast.success(`${mapped.length} question${mapped.length > 1 ? 's' : ''} imported from the document.`);
  }, [isGeneral, generalMPQ, currentDiff, isScoreEditable, getFixedScore, loadQuestionIntoForm]);

  const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseDatabaseFile(file);
      if (!parsed.length) {
        toast.warning('No questions found — check the .txt format (Title:, Description:, Difficulty:, Query:, Result:).');
        return;
      }
      handleIncomingDBQuestions(parsed as any[]);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed — could not read the file.');
    }
  };

  const handleSaveAndContinue = useCallback(async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrs(validationErrors);
      setTouched(new Set(Object.keys(validationErrors)));
      scrollToFirstError(validationErrors);
      return;
    }

    const snap = snapshotForm();
    const localId = snap.__localId;
    const serverId = getServerId(dbQuestions[currentIndex]);
    const isLast = currentIndex === dbQuestions.length - 1;
    const hasRemainingSlots = isGeneral ? getRemainingSlots() > 0 : getRemainingSlots(currentDiff) > 0;

    if (isLast && !hasRemainingSlots) {
      if (serverId && !isEditMode && !hasUnsavedFormChanges) return;
      try {
        await executeSave(localId, { ...snap, __preventClose: true }, true);
        setSaveOk(true);
        setTimeout(() => setSaveOk(false), 2500);
        setIsEditMode(false);
        const updatedFlow = dbQuestionsRef.current.map(q =>
          q.__localId === localId ? { ...q, ...snap, _id: serverId, isSaved: true, isDirty: false } : q
        );
        dbQuestionsRef.current = updatedFlow;
        setDbQuestions(updatedFlow);
        return;
      } catch (err) {
        console.error('Save error:', err);
      }
      return;
    }

    if (serverId && !isEditMode && !hasUnsavedFormChanges) {
      advanceAfterSave(serverId);
      return;
    }

    let savedId: string | undefined;
    try {
      savedId = await executeSave(localId, snap, true);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
      setIsEditMode(false);
      advanceAfterSave(savedId);
    } catch (err) {
      console.error('Save error:', err);
    }
  }, [validate, snapshotForm, getServerId, dbQuestions, currentIndex, isEditMode, hasUnsavedFormChanges, executeSave, isGeneral, getRemainingSlots, currentDiff, advanceAfterSave]);

  const handlePrevious = useCallback(() => {
    const idx = currentIndexRef.current;
    if (idx <= 0) return;

    const snap = snapshotForm();
    const newFlow = [...dbQuestionsRef.current];
    newFlow[idx] = snap;
    dbQuestionsRef.current = newFlow;
    setDbQuestions(newFlow);

    const prevIdx = idx - 1;
    currentIndexRef.current = prevIdx;
    setCurrentIndex(prevIdx);
    if (newFlow[prevIdx]?.difficulty) {
      setCurrentDiff(newFlow[prevIdx].difficulty);
      setDifficulty(newFlow[prevIdx].difficulty);
    }
    loadQuestionIntoForm(newFlow[prevIdx]);
  }, [snapshotForm, loadQuestionIntoForm]);

  const handleNext = useCallback(() => {
    const idx = currentIndexRef.current;
    const flow = dbQuestionsRef.current;
    if (idx >= flow.length - 1) return;

    const snap = snapshotForm();
    const newFlow = [...flow];
    newFlow[idx] = snap;
    dbQuestionsRef.current = newFlow;
    setDbQuestions(newFlow);

    const nextIdx = idx + 1;
    currentIndexRef.current = nextIdx;
    setCurrentIndex(nextIdx);
    if (newFlow[nextIdx]?.difficulty) {
      setCurrentDiff(newFlow[nextIdx].difficulty);
      setDifficulty(newFlow[nextIdx].difficulty);
    }
    loadQuestionIntoForm(newFlow[nextIdx]);
  }, [snapshotForm, loadQuestionIntoForm]);

  const handleJumpTo = useCallback((idx: number) => {
    const curIdx = currentIndexRef.current;
    const flow = dbQuestionsRef.current;
    const snap = snapshotForm();
    const newFlow = [...flow];
    newFlow[curIdx] = snap;
    dbQuestionsRef.current = newFlow;
    setDbQuestions(newFlow);
    const targetQ = newFlow[idx];
    if (targetQ?.difficulty) {
      setCurrentDiff(targetQ.difficulty);
      setDifficulty(targetQ.difficulty);
    }
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
    loadQuestionIntoForm(newFlow[idx]);
  }, [snapshotForm, loadQuestionIntoForm]);

  const handleDeleteQuestion = useCallback(async (localId: string) => {
    const targetQ = dbQuestionsRef.current.find(q => q.__localId === localId);
    const serverId = serverIdMap.current.get(localId) || targetQ?._id;
    if (serverId && onDeleteQuestion) {
      try { await onDeleteQuestion(serverId as string); }
      catch (err) { console.error('Failed to delete question from DB:', err); return; }
    }
    setDbQuestions(prev => {
      const next = prev.filter(q => q.__localId !== localId);
      dbQuestionsRef.current = next;
      return next;
    });
    serverIdMap.current.delete(localId);
    const remainingFlow = dbQuestionsRef.current;
    const newIdx = Math.min(currentIndex, remainingFlow.length - 1);
    if (newIdx >= 0 && remainingFlow[newIdx]) {
      setCurrentIndex(newIdx);
      currentIndexRef.current = newIdx;
      loadQuestionIntoForm(remainingFlow[newIdx]);
    }
  }, [onDeleteQuestion, currentIndex, loadQuestionIntoForm]);

  const isLastQuestion = useMemo((): boolean => {
    const currentQ = dbQuestions[currentIndex];
    if (!currentQ) return getRemainingSlots(currentDiff) === 1;
    if (currentIndex < dbQuestions.length - 1) return false;
    const alreadySaved = !!(getServerId(currentQ) || currentQ.isSaved);
    const slots = getRemainingSlots(currentDiff);
    return alreadySaved ? slots === 0 : slots === 1;
  }, [dbQuestions, currentIndex, getRemainingSlots, currentDiff, getServerId]);

  const anyFormFieldHasContent = useMemo((): boolean => {
    const descText = descBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
    const srText = sampleResultBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
    return !!(title.trim() || descText || sampleQuery.trim() || srText);
  }, [title, descBlocks, sampleQuery, sampleResultBlocks]);

  const currentQ_forMock = dbQuestions[currentIndex];
  const currentAlreadySaved_forMock = !!(currentQ_forMock?.isSaved || currentQ_forMock?._id || serverIdMap.current.has(currentQ_forMock?.__localId));
  const effectiveTotalFilled = createdCountAll + (currentFormHasContent && !currentAlreadySaved_forMock ? 1 : 0);

  // Formatting helpers
  const updateFormattingState = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      isBold: document.queryCommandState('bold'),
      isItalic: document.queryCommandState('italic'),
      isUnderline: document.queryCommandState('underline'),
    }));
  }, []);

  const toggleBold = useCallback(() => { document.execCommand('bold', false); updateFormattingState(); }, [updateFormattingState]);
  const toggleItalic = useCallback(() => { document.execCommand('italic', false); updateFormattingState(); }, [updateFormattingState]);
  const toggleUnderline = useCallback(() => { document.execCommand('underline', false); updateFormattingState(); }, [updateFormattingState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey)) {
        const activeEl = document.activeElement;
        if (activeEl && activeEl.getAttribute('contenteditable') === 'true') {
          switch (e.key) {
            case 'b': e.preventDefault(); toggleBold(); break;
            case 'i': e.preventDefault(); toggleItalic(); break;
            case 'u': e.preventDefault(); toggleUnderline(); break;
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleBold, toggleItalic, toggleUnderline]);

  useEffect(() => {
    const handleSelectionChange = () => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
        updateFormattingState();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [updateFormattingState]);

  const hierarchyData = exerciseData?.fullExerciseData?.hierarchyData || {};
  const subcategory = exerciseData?.subcategory;
  const subcategoryLabel = exerciseData?.subcategoryLabel;
  const exerciseName = exerciseData?.exerciseName || exerciseData?.fullExerciseData?.exerciseInformation?.exerciseName || '';
  const actionLabel = 'Add Question';
  const globalQuestionNumber = currentIndex + 1;
  const diffStyle = DS[currentDiff] || DS.medium;
  const difficultyOptions = getConfiguredDiffs().length > 0 ? getConfiguredDiffs() : ['easy', 'medium', 'hard'];

  return (
    <div className="dbq-root" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'rgba(26,26,46,0.55)', backdropFilter: 'blur(2px)', overflow: 'hidden', fontFamily: 'var(--lms-font)' }}>
      
      {/* Validation Toast */}
      {validationToast.length > 0 && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          minWidth: 260, maxWidth: 340, display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#fff', border: '1.5px solid var(--lms-danger-bdr)',
          borderLeft: '4px solid var(--lms-danger)', borderRadius: 'var(--lms-radius-md)',
          padding: '12px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
          animation: 'lms-toast-slide-in 0.22s cubic-bezier(.4,0,.2,1)',
        }}>
          <AlertCircle size={15} style={{ color: 'var(--lms-danger)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-danger)', margin: '0 0 4px 0' }}>Please fix before saving:</p>
            <ul style={{ margin: 0, paddingLeft: 15 }}>{validationToast.map((msg, i) => (<li key={i} style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, color: '#555', fontWeight: 600, lineHeight: 1.6 }}>{msg}</li>))}</ul>
          </div>
          <button onClick={() => setValidationToast([])} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#aaa', flexShrink: 0 }}><X size={13} /></button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'var(--lms-bg-white)', overflow: 'hidden' }}>

        {/* HEADER */}
        <div style={{ background: 'var(--lms-bg-white)', borderBottom: '1.5px solid var(--lms-border)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <div className="lms-header-logo-mark"><GraduationCap size={16} style={{ color: 'white' }} /></div>
            <div style={{ width: 1, height: 20, background: 'var(--lms-border)', flexShrink: 0 }} />
            <span className="lms-badge" style={{ background: 'var(--lms-info-bg)', color: 'var(--lms-info)', borderColor: 'var(--lms-info-bdr)', fontSize: 10, padding: '3px 8px', flexShrink: 0 }}><Database size={9} /> Database</span>
            <div style={{ minWidth: 0, flex: 1, overflow: 'visible' }}>
              <Breadcrumb hierarchyData={hierarchyData} tabType={tabType} subcategory={subcategory} subcategoryLabel={subcategoryLabel} exerciseName={exerciseName} actionLabel={actionLabel} questionLabel={`Question #${globalQuestionNumber}`} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0, marginLeft: 12 }}>
            {/* ── Add Question via — Build from Scratch · Question Bank · Generate AI · Upload via Document ── */}
            {!isEditing && (
              <div ref={addDropdownRef} className="relative" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setShowAddDropdown(v => !v)}
                  className="inline-flex items-center justify-between gap-2"
                  style={{ minWidth: 150, height: 32, padding: '0 10px', borderRadius: 8, border: '1.5px solid #e4e4ed', background: '#fff', color: '#1a1a2e', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--lms-font)', cursor: 'pointer' }}
                >
                  Add Question via
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
                {showAddDropdown && (
                  <div className="absolute top-full right-0 mt-1.5 z-[9999] overflow-hidden" style={{ width: 220, background: '#fff', borderRadius: 12, border: '1px solid #e4e4ed', boxShadow: '0 8px 32px rgba(26,26,46,0.14)', fontFamily: 'var(--lms-font)' }}>
                    {/* 2. Question Bank — hidden when questionSource forbids bank browse */}
                    {allowedSources.bank && (
                    <button
                      onClick={() => { setShowAddDropdown(false); setShowBankSelector(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(124,58,237,0.1)' }}>
                        <BookOpen size={14} style={{ color: '#7c3aed' }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Question Bank</div>
                        <div className="text-[10px]" style={{ color: '#8b8b9e' }}>Pick from saved questions</div>
                      </div>
                    </button>
                    )}

                    {allowedSources.bank && allowedSources.ai && (
                      <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
                    )}

                    {/* 3. Generate AI — hidden when questionSource forbids AI */}
                    {allowedSources.ai && (
                    <button
                      onClick={() => { setShowAddDropdown(false); setShowAIModal(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)' }}>
                        <Sparkles size={14} style={{ color: '#10b981' }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Generate AI</div>
                        <div className="text-[10px]" style={{ color: '#8b8b9e' }}>Auto-generate with Gemini</div>
                      </div>
                    </button>
                    )}

                    {(allowedSources.bank || allowedSources.ai) && allowedSources.upload && (
                      <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
                    )}

                    {/* 4. Upload via Document — hidden when questionSource forbids upload */}
                    {allowedSources.upload && (
                    <button
                      onClick={() => { setShowAddDropdown(false); docInputRef.current?.click(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(8,145,178,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(8,145,178,0.1)' }}>
                        <CloudUpload size={14} style={{ color: '#0891b2' }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Upload via Document</div>
                        <div className="text-[10px]" style={{ color: '#8b8b9e' }}>Import from .txt file</div>
                      </div>
                    </button>
                    )}
                  </div>
                )}
                <input ref={docInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleDocumentSelected} />
              </div>
            )}
            {dbQuestions?.length > 0 && (
              <button onClick={() => setShowPreview(true)} className="lms-btn lms-btn-ghost-violet">
                <Eye size={12} /> Preview
                <span style={{ background: 'var(--lms-violet)', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20 }}>{dbQuestions.length}</span>
              </button>
            )}
            {onEditExercise && (
              <button onClick={handleEditExerciseClick} className="lms-btn lms-btn-ghost-orange"><Settings size={12} /> Edit Exercise</button>
            )}
            <button onClick={handleCloseRequest} style={{ padding: 8, borderRadius: 8, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', cursor: 'pointer', color: 'var(--lms-danger)' }}><X size={15} /></button>
          </div>
        </div>

        {/* DIFFICULTY SELECT BAR */}
        {!isGeneral && getConfiguredDiffs().length > 0 && (
          <div style={{ background: 'var(--lms-bg-surface)', borderBottom: '1.5px solid var(--lms-border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-text-sec)', flexShrink: 0 }}>Switch Difficulty:</span>
            <div style={{ position: 'relative', minWidth: 160 }}>
              <select
                value={currentDiff}
                onChange={e => {
                  const d = e.target.value as 'easy' | 'medium' | 'hard';
                  if (d === currentDiff) return;
                  const snap = snapshotForm();
                  const newFlow = [...dbQuestionsRef.current];
                  newFlow[currentIndexRef.current] = snap;
                  dbQuestionsRef.current = newFlow;
                  setDbQuestions(newFlow);
                  setCurrentDiff(d);
                  setDifficulty(d);
                  const existingForDiff = dbQuestions.find(q => q.difficulty === d);
                  if (existingForDiff) {
                    const idx = dbQuestions.findIndex(q => q.difficulty === d);
                    setCurrentIndex(idx);
                    currentIndexRef.current = idx;
                    loadQuestionIntoForm(existingForDiff);
                  } else {
                    const defaultScore = isScoreEditable(d) ? 0 : getFixedScore(d);
                    const newQ: DBQuestion = {
                      __localId: mkLocalId(), title: '', description: [mkProgTextBlock()],
                      difficulty: d, score: defaultScore, sampleQuery: '', sampleResult: [mkProgTextBlock()],
                      constraints: [], hints: [], questionType: 'database', isSaved: false, isDirty: false, isPreExisting: false,
                    };
                    const finalFlow = [...newFlow, newQ];
                    dbQuestionsRef.current = finalFlow;
                    setDbQuestions(finalFlow);
                    const newIdx = finalFlow.length - 1;
                    setCurrentIndex(newIdx);
                    currentIndexRef.current = newIdx;
                    setTitle('');
                    if (titleRef.current) titleRef.current.innerHTML = '';
                    setDescBlocks([mkProgTextBlock()]);
                    setSampleQuery('');
                    setSampleResultBlocks([mkProgTextBlock()]);
                    setConstraints(['']);
                    setHint('');
                    setExtraHints([]);
                    setScore(defaultScore);
                  }
                }}
                style={{
                  fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700,
                  border: `2px solid ${diffStyle.border}`, borderRadius: 'var(--lms-radius-md)',
                  padding: '6px 32px 6px 12px', cursor: 'pointer', outline: 'none',
                  background: diffStyle.bg, color: diffStyle.text, width: '100%', appearance: 'none',
                }}>
                {getConfiguredDiffs().map(d => {
                  const quota = getQuotaForDiff(d);
                  const used = getCreatedCount(d);
                  return <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)} ({used}/{quota}){getRemainingSlots(d) <= 0 && d !== currentDiff ? ' ✓' : ''}</option>;
                })}
              </select>
              <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: diffStyle.text, fontSize: 12 }}>▼</div>
            </div>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, color: remainingSlots > 0 ? diffStyle.text : 'var(--lms-success)' }}>
              {remainingSlots > 0 ? `${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} remaining` : '✓ All slots filled'}
            </span>
            {totalSlots > 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, maxWidth: 280 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--lms-bg-surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: diffStyle.bar, width: `${Math.min(100, (createdCount / totalSlots) * 100)}%`, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: 'var(--lms-text-muted)', flexShrink: 0 }}>{createdCount}/{totalSlots}</span>
              </div>
            )}
          </div>
        )}

        {/* BODY */}
        <div ref={formScrollRef} style={{ display: 'flex', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>

          {/* MAIN FORM */}
          <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--lms-bg-white)' }}>

            {/* Sticky Toolbar */}
            <div ref={stickyToolbarRef} style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--lms-bg-white)', paddingTop: 8, paddingBottom: 8, marginTop: -8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: dbQuestions[currentIndex]?._id ? 'var(--lms-success)' : 'var(--lms-orange)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 800, fontFamily: 'var(--lms-font)', flexShrink: 0,
                  boxShadow: `0 2px 8px ${dbQuestions[currentIndex]?._id ? 'rgba(22,163,74,0.25)' : 'var(--lms-orange-glow)'}`,
                }}>{globalQuestionNumber}</div>

                {/* B I U format buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleBold(); updateFormattingState(); }} className="lms-fmt-btn" style={{ padding: '6px 8px', borderRadius: '6px', border: `1.5px solid ${editorState.isBold ? 'var(--lms-orange)' : 'var(--lms-border)'}`, background: editorState.isBold ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)', color: editorState.isBold ? 'var(--lms-orange)' : 'var(--lms-text-sec)' }} title="Bold (Ctrl+B)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" /></svg>
                  </button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleItalic(); updateFormattingState(); }} className="lms-fmt-btn" style={{ padding: '6px 8px', borderRadius: '6px', border: `1.5px solid ${editorState.isItalic ? 'var(--lms-orange)' : 'var(--lms-border)'}`, background: editorState.isItalic ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)', color: editorState.isItalic ? 'var(--lms-orange)' : 'var(--lms-text-sec)' }} title="Italic (Ctrl+I)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="4" x2="10" y2="4" /><line x1="14" y1="20" x2="5" y2="20" /><line x1="15" y1="4" x2="9" y2="20" /></svg>
                  </button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); toggleUnderline(); updateFormattingState(); }} className="lms-fmt-btn" style={{ padding: '6px 8px', borderRadius: '6px', border: `1.5px solid ${editorState.isUnderline ? 'var(--lms-orange)' : 'var(--lms-border)'}`, background: editorState.isUnderline ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)', color: editorState.isUnderline ? 'var(--lms-orange)' : 'var(--lms-text-sec)' }} title="Underline (Ctrl+U)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 4v6a6 6 0 0 0 12 0V4" /><line x1="4" y1="20" x2="20" y2="20" /></svg>
                  </button>
                </div>

                {/* Difficulty pills */}
                {!isGeneral && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {difficultyOptions.map(d => (
                      <button key={d} type="button" onClick={() => { setDifficulty(d); setCurrentDiff(d); }}
                        style={{ padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${difficulty === d ? DS[d].border : 'var(--lms-border)'}`, background: difficulty === d ? DS[d].bg : 'var(--lms-bg-white)', color: difficulty === d ? DS[d].text : 'var(--lms-text-muted)', fontSize: 10.5, fontWeight: 700, fontFamily: 'var(--lms-font)', cursor: 'pointer', textTransform: 'capitalize' }}>{d}</button>
                    ))}
                  </div>
                )}

                <div style={{ flex: 1 }} />

                {/* Score input */}
                <div ref={titleSectionRef} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, padding: '4px 10px', borderRadius: 8, border: `1.5px solid ${errs.score && touched.has('score') ? 'var(--lms-danger)' : isScoreEditable(currentDiff) ? 'var(--lms-orange)' : 'var(--lms-border)'}`, background: errs.score && touched.has('score') ? 'var(--lms-danger-bg)' : isScoreEditable(currentDiff) ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)' }}>
                  <Award size={12} style={{ color: errs.score && touched.has('score') ? 'var(--lms-danger)' : 'var(--lms-orange)', flexShrink: 0 }} />
                  <input type="text" inputMode="numeric" readOnly={!isScoreEditable(currentDiff)} value={displayScore > 0 ? String(displayScore) : (score > 0 ? String(score) : '')} placeholder="0"
                    onChange={e => {
                      if (!isScoreEditable(currentDiff)) return;
                      const r = e.target.value;
                      if (/^\d*\.?\d*$/.test(r)) {
                        const n = parseFloat(r);
                        if (!isNaN(n) && n >= 0) setScore(n);
                        if (r === '') setScore(0);
                      }
                    }} onBlur={() => touch('score')}
                    style={{ width: 36, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, fontWeight: 700, color: errs.score && touched.has('score') ? 'var(--lms-danger)' : 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', textAlign: 'center', lineHeight: 1, padding: 0, margin: 0, cursor: isScoreEditable(currentDiff) ? 'text' : 'default' }} />
                  <span style={{ fontSize: 11, color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)', whiteSpace: 'nowrap', fontWeight: 600 }}>mark</span>
                  {(!isScoreEditable(currentDiff) || isGeneral) && (<span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--lms-font)', padding: '1px 6px', borderRadius: 20, background: 'var(--lms-bg-surface2)', color: 'var(--lms-text-muted)', border: '1px solid var(--lms-border)', marginLeft: 2 }}>Fixed</span>)}
                </div>
              </div>
            </div>

            {/* Problem Title */}
            <div ref={titleSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="lms-section-label" style={{ margin: 0 }}>Problem Title <span style={{ color: errs.title && touched.has('title') ? 'var(--lms-danger)' : 'var(--lms-text-muted)' }}>*</span></label>
                {errs.title && touched.has('title') && (<span style={{ fontSize: 11, color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>— {errs.title}</span>)}
              </div>
              <div ref={titleRef} contentEditable suppressContentEditableWarning data-placeholder="Enter database question title..."
                onInput={e => { const el = e.currentTarget; setTitle(el.innerText || ''); if (errs.title && el.innerText?.trim()) setErrs(p => { const n = { ...p }; delete n.title; return n; }); }}
                onBlur={() => touch('title')}
                style={{ fontFamily: 'var(--lms-font)', fontSize: 16, fontWeight: 600, lineHeight: 1.5, color: errs.title && touched.has('title') ? 'var(--lms-danger)' : 'var(--lms-text-main)', background: 'transparent', border: 'none', borderBottom: `2px solid ${errs.title && touched.has('title') ? 'var(--lms-danger)' : 'var(--lms-orange)'}`, borderRadius: 0, outline: 'none', width: '100%', padding: '4px 0 6px', minHeight: 36, wordBreak: 'break-word' }} />
            </div>

            {/* Problem Description */}
            <div ref={descSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="lms-section-label" style={{ margin: 0 }}>Problem Description <span style={{ color: 'var(--lms-danger)' }}>*</span></label>
                {errs.description && touched.has('description') && (<span style={{ fontSize: 11, color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>— {errs.description}</span>)}
              </div>
              <div onBlur={() => touch('description')}>
                <DescriptionEditor blocks={descBlocks} onChange={blocks => { setDescBlocks(blocks); if (errs.description) setErrs(p => { const n = { ...p }; delete n.description; return n; }); }} hasError={!!(errs.description && touched.has('description'))} placeholder="Describe the database problem clearly. Include table schemas, sample data, and expected query results." />
              </div>
            </div>

            {/* Sample Query */}
            <div ref={sampleQuerySectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="lms-section-label" style={{ margin: 0 }}>Sample Query <span style={{ color: 'var(--lms-danger)' }}>*</span></label>
                {errs.sampleQuery && touched.has('sampleQuery') && (<span style={{ fontSize: 11, color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>— {errs.sampleQuery}</span>)}
              </div>
              <textarea className={`lms-textarea mono${errs.sampleQuery && touched.has('sampleQuery') ? ' err' : ''}`} rows={5} placeholder="-- Example:\nSELECT employee_id, name, department\nFROM employees\nWHERE salary > 50000;" value={sampleQuery} onChange={e => { setSampleQuery(e.target.value); if (errs.sampleQuery && e.target.value.trim()) setErrs(p => { const n = { ...p }; delete n.sampleQuery; return n; }); }} onBlur={() => touch('sampleQuery')} style={{ borderRadius: 10, fontSize: 12.5, lineHeight: 1.7 }} />
            </div>

            {/* Expected Result */}
            <div ref={sampleResultSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="lms-section-label" style={{ margin: 0 }}>Expected Result <span style={{ color: 'var(--lms-danger)' }}>*</span></label>
                {errs.sampleResult && touched.has('sampleResult') && (<span style={{ fontSize: 11, color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>— {errs.sampleResult}</span>)}
              </div>
              <div onBlur={() => touch('sampleResult')}>
                <DescriptionEditor blocks={sampleResultBlocks} onChange={blocks => { setSampleResultBlocks(blocks); if (errs.sampleResult) setErrs(p => { const n = { ...p }; delete n.sampleResult; return n; }); }} hasError={!!(errs.sampleResult && touched.has('sampleResult'))} placeholder="Describe the expected result. Use table format or plain text." />
              </div>
            </div>

            {/* Constraints */}
            <div ref={constraintsSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label className={`lms-section-label${errs.constraints && touched.has('constraints') ? ' lms-label-err' : ''}`} style={{ margin: 0 }}>Constraints</label>
                  {errs.constraints && touched.has('constraints') && (<span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.constraints}</span>)}
                </div>
                <button onClick={() => setConstraints(p => [...p, ''])} className="lms-btn lms-btn-ghost-orange" style={{ padding: '4px 10px', fontSize: 11 }}><Plus size={11} /> Add</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {constraints.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input value={c} onChange={e => { const a = [...constraints]; a[i] = e.target.value; setConstraints(a); if (errs.constraints && a.some(x => x.trim())) setErrs(p => { const n = { ...p }; delete n.constraints; return n; }); }} placeholder="e.g. Table must have at least 3 rows" className={`lms-input${errs.constraints && touched.has('constraints') ? ' err' : ''}`} style={{ flex: 1 }} />
                    {constraints.length > 1 && (<button onClick={() => setConstraints(p => p.filter((_, idx) => idx !== i))} className="lms-icon-btn lms-icon-btn-red"><Trash2 size={13} /></button>)}
                  </div>
                ))}
              </div>
            </div>

            {/* Hint */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="lms-section-label" style={{ margin: 0 }}>Hint <span style={{ fontWeight: 400, color: 'var(--lms-text-hint)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(Optional)</span></label>
              <textarea className="lms-textarea" rows={2} value={hint} onChange={e => setHint(e.target.value)} placeholder="Give students a helpful hint..." />
            </div>

            {/* Extra Hints */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button type="button" onClick={() => setShowExtraHints(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>
                  <span className="lms-section-label" style={{ margin: 0 }}>Additional Hints</span>
                  <span style={{ fontSize: 10.5, color: 'var(--lms-text-muted)', fontWeight: 600 }}>({extraHints.length})</span>
                  {showExtraHints ? <ChevronUp size={13} style={{ color: 'var(--lms-text-muted)' }} /> : <ChevronDown size={13} style={{ color: 'var(--lms-text-muted)' }} />}
                </button>
                <button type="button" onClick={() => { setExtraHints(p => [...p, { hintText: '', pointsDeduction: 0, isPublic: true }]); setShowExtraHints(true); }} className="lms-btn lms-btn-ghost-orange" style={{ padding: '4px 10px', fontSize: 11 }}><Plus size={11} /> Add Hint</button>
              </div>
              {showExtraHints && extraHints.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {extraHints.map((h, i) => (
                    <div key={i} style={{ border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)', padding: 12, background: 'var(--lms-bg-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-text-sec)' }}>Hint {i + 2}</span>
                        <button type="button" onClick={() => setExtraHints(p => p.filter((_, idx) => idx !== i))} style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', background: 'none', border: 'none', cursor: 'pointer' }}>Remove</button>
                      </div>
                      <textarea className="lms-textarea" rows={2} value={h.hintText} onChange={e => setExtraHints(p => p.map((x, idx) => idx === i ? { ...x, hintText: e.target.value } : x))} placeholder="Hint text..." />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)' }}>Deduction: <input type="number" min="0" value={h.pointsDeduction} onChange={e => setExtraHints(p => p.map((x, idx) => idx === i ? { ...x, pointsDeduction: parseInt(e.target.value) || 0 } : x))} style={{ width: 40, padding: '2px 6px', borderRadius: 5, border: '1.5px solid var(--lms-border)', fontSize: 12, fontFamily: 'var(--lms-font)', outline: 'none' }} /> pts</div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)', cursor: 'pointer', userSelect: 'none' }}><input type="checkbox" checked={h.isPublic} onChange={e => setExtraHints(p => p.map((x, idx) => idx === i ? { ...x, isPublic: e.target.checked } : x))} style={{ width: 12, height: 12, accentColor: 'var(--lms-orange)' }} /> Public</label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Validation errors */}
            {Object.keys(errs).length > 0 && touched.size > 0 && (
              <div style={{ padding: '12px 14px', background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)', borderRadius: 'var(--lms-radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}><AlertCircle size={14} style={{ color: 'var(--lms-danger)' }} /><span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-danger)' }}>Fix before saving:</span></div>
                <ul style={{ marginLeft: 16, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>{Object.values(errs).map((e, i) => (<li key={i} style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-danger)' }}>{e}</li>))}</ul>
              </div>
            )}

            <div style={{ height: 8 }} />
          </div>

   {/* RIGHT SIDEBAR - Exactly matching ProgrammingQuestionForm */}
<div style={{ width: 280, flexShrink: 0, borderLeft: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
  <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>

    {/* For Level Based - Current Difficulty Section */}
    {!isGeneral && (
      <>
        {/* ── Current Difficulty Questions ── */}
        <div style={{ marginBottom: 14 }}>
          <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
            <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
            <span style={{ textTransform: 'capitalize' }}>{currentDiff} Questions</span>
          </div>
          <div className="lms-marks-row">
            <span className="lms-marks-label">Total</span>
            <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalSlots}</span>
          </div>
          <div className="lms-marks-row">
            <span className="lms-marks-label">Created</span>
            <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
              {createdCount}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlots}</span>
            </span>
          </div>
          <div className="lms-marks-row">
            <span className="lms-marks-label">Remaining</span>
            <span className="lms-marks-value" style={{ color: remainingSlots === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlots}</span>
          </div>
          {totalSlots > 0 && (
            <div className="lms-progress-bar" style={{ marginTop: 6 }}>
              <div className="lms-progress-fill" style={{
                width: `${Math.min(100, (createdCount / totalSlots) * 100)}%`,
                background: remainingSlots === 0 ? 'var(--lms-success)' : 'var(--lms-orange)'
              }} />
            </div>
          )}
        </div>

        {/* ── Current Difficulty Marks ── */}
        {exerciseIsGraded && totalMarksForDiff > 0 && (
          <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14, marginBottom: 14 }}>
            <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
              <Award size={12} style={{ color: 'var(--lms-orange)' }} />
              <span style={{ textTransform: 'capitalize' }}>{currentDiff} Marks</span>
            </div>
            <div className="lms-marks-row">
              <span className="lms-marks-label">Total Mark</span>
              <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalMarksForDiff}</span>
            </div>
            <div className="lms-marks-row">
              <span className="lms-marks-label">Mark Per Question</span>
              <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>
                {displayScore}
                {isScoreEditable(currentDiff)
                  ? <span className="lms-badge lms-badge-violet" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3 }}>Custom</span>
                  : <span className="lms-badge" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3, background: 'var(--lms-bg-surface)', color: 'var(--lms-text-muted)', borderColor: 'var(--lms-border)' }}>Fixed</span>}
              </span>
            </div>
            <div className="lms-marks-row">
              <span className="lms-marks-label">Used Marks</span>
              <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                {fmtMark(usedMarks)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMarksForDiff}</span>
              </span>
            </div>
            <div className="lms-marks-row">
              <span className="lms-marks-label">Remaining Marks</span>
              <span className="lms-marks-value" style={{ color: remainingMarks <= 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>{fmtMark(remainingMarks)}</span>
            </div>
            <div className="lms-progress-bar" style={{ marginTop: 6 }}>
              <div className="lms-progress-fill" style={{
                width: `${Math.min(100, (usedMarks / totalMarksForDiff) * 100)}%`,
                background: usedMarks >= totalMarksForDiff ? 'var(--lms-success)' : 'var(--lms-orange)'
              }} />
            </div>
          </div>
        )}
      </>
    )}

    {/* ── Overall Questions ── */}
    <div style={{ marginBottom: 14, borderTop: !isGeneral ? '1.5px solid var(--lms-border)' : 'none', paddingTop: !isGeneral ? 14 : 0 }}>
      <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
        <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
        <span>Overall Questions</span>
      </div>
      <div className="lms-marks-row">
        <span className="lms-marks-label">Total Questions</span>
        <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalSlotsAll}</span>
      </div>
      <div className="lms-marks-row">
        <span className="lms-marks-label">Created</span>
        <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
          {createdCountAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlotsAll}</span>
        </span>
      </div>
      <div className="lms-marks-row">
        <span className="lms-marks-label">Remaining</span>
        <span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlotsAll}</span>
      </div>
      {totalSlotsAll > 0 && (
        <div className="lms-progress-bar" style={{ marginTop: 6 }}>
          <div className="lms-progress-fill" style={{
            width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`,
            background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)'
          }} />
        </div>
      )}
    </div>

    {/* ── Overall Marks ── */}
    {exerciseIsGraded && (isGeneral ? generalMPQ > 0 : totalMarksAll > 0) && (
      <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14 }}>
        <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
          <Award size={12} style={{ color: 'var(--lms-orange)' }} />
          <span>Overall Marks</span>
        </div>
        <div className="lms-marks-row">
          <span className="lms-marks-label">Marks Per Question</span>
          <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{isGeneral ? generalMPQ : displayScore}</span>
        </div>
        <div className="lms-marks-row">
          <span className="lms-marks-label">Total Questions</span>
          <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalSlotsAll}</span>
        </div>
        <div className="lms-marks-row">
          <span className="lms-marks-label">Total Marks</span>
          <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{isGeneral ? generalTotalMarks : totalMarksAll}</span>
        </div>
      </div>
    )}

  </div>
</div>
        </div>

        {/* FOOTER */}
        <div style={{ background: 'var(--lms-bg-white)', borderTop: '1.5px solid var(--lms-border)', padding: '12px 20px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, flexShrink: 0 }}>

          {/* Left: saving indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isSaving && (<><Loader2 size={13} style={{ color: 'var(--lms-orange)' }} className="animate-spin" /><span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-orange)' }}>{saveMessage || 'Saving…'}</span><div style={{ width: 80, height: 4, background: 'var(--lms-bg-surface2)', borderRadius: 2, overflow: 'hidden', marginLeft: 4 }}><div style={{ height: '100%', background: 'var(--lms-orange)', borderRadius: 2, transition: 'width 0.3s', width: `${saveProgress}%` }} /></div></>)}
            {saveOk && !isSaving && (<div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'var(--lms-success-bg)', border: '1.5px solid var(--lms-success-bdr)' }}><Check size={13} style={{ color: 'var(--lms-success)' }} /><span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--lms-success)', fontFamily: 'var(--lms-font)' }}>Saved!</span></div>)}
          </div>

          {/* Center: action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {currentIndex > 0 && (<button onClick={handlePrevious} disabled={isSaving} className="lms-nav-btn"><ChevronLeft size={13} /> Previous</button>)}
            {currentIndex < dbQuestions.length - 1 && (<button onClick={handleNext} disabled={isSaving} className="lms-nav-btn">Next <ChevronRight size={13} /></button>)}
            <button onClick={handleSave} disabled={isSaving} className="lms-btn lms-btn-slate">{isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}Save</button>
            <button onClick={handleSaveAndContinue} disabled={isSaving} className="lms-btn lms-btn-orange" style={{
              background: isLastQuestion ? 'var(--lms-success)' : 'var(--lms-orange)',
              boxShadow: isLastQuestion ? '0 2px 8px rgba(22,163,74,0.25)' : '0 2px 8px var(--lms-orange-glow)',
            }}>
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : isLastQuestion ? <CheckCircle2 size={13} /> : <Zap size={13} />}
              {isLastQuestion ? (getServerId(dbQuestions[currentIndex]) ? 'Update & Finish' : 'Save & Finish') : (getServerId(dbQuestions[currentIndex]) ? 'Update & Continue' : 'Save & Continue')}
              {isLastQuestion ? <Flag size={11} /> : <ArrowRight size={11} />}
            </button>
            {dbQuestions.length > 0 && (<button onClick={() => setShowDeleteConfirm(true)} disabled={isSaving} className="lms-btn" style={{ background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', borderColor: 'var(--lms-danger-bdr)' }}><Trash2 size={12} /> Delete</button>)}
            {anyFormFieldHasContent && (<button onClick={() => setShowClearConfirm(true)} disabled={isSaving} className="lms-btn" style={{ background: 'var(--lms-warning-bg)', color: 'var(--lms-warning)', borderColor: 'var(--lms-warning-bdr)' }}><X size={12} /> Clear</button>)}
          </div>

          {/* Right: Mock + Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setShowMockModal(true)} disabled={!isMockEnabled} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 'var(--lms-radius-md)',
              fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, cursor: isMockEnabled ? 'pointer' : 'not-allowed',
              border: `1.5px solid ${isMockEnabled ? 'var(--lms-violet-bdr)' : 'var(--lms-border)'}`,
              background: isMockEnabled ? 'var(--lms-violet-bg)' : 'var(--lms-bg-surface)',
              color: isMockEnabled ? 'var(--lms-violet)' : 'var(--lms-text-hint)',
            }}><Eye size={13} /> Mock</button>
            <button type="button" onClick={handleCloseRequest} className="lms-cancel-btn"><X size={13} /> Close</button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showDetailsModal && exerciseData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowDetailsModal(false); }}>
          <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-bg-surface)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><FileText size={14} style={{ color: 'var(--lms-text-sec)' }} /><span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Details</span></div>
              <button type="button" onClick={() => setShowDetailsModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}><X size={15} /></button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {exerciseData.fullExerciseData?.exerciseInformation?.exerciseId && (<div className="lms-detail-row" style={{ padding: '8px 16px' }}><span className="lms-detail-label">Exercise ID</span><span className="lms-detail-value" style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--lms-violet)', fontSize: 11 }}>{exerciseData.fullExerciseData.exerciseInformation.exerciseId}</span></div>)}
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}><span className="lms-detail-label">Exercise Name</span><span className="lms-detail-value" style={{ color: 'var(--lms-orange)', fontSize: 11 }}>{exerciseName || 'Untitled'}</span></div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}><span className="lms-detail-label">Exercise Type</span><span className="lms-detail-value" style={{ fontSize: 11 }}>Database</span></div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}><span className="lms-detail-label">Configuration</span><span className="lms-detail-value" style={{ fontSize: 11 }}>{isGeneral ? 'General' : cfgType === 'levelBased' ? 'Level Based' : 'Selection Level'}</span></div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}><span className="lms-detail-label">Assessment Type</span><span className="lms-detail-value" style={{ fontSize: 11, fontWeight: 700, color: exerciseIsGraded ? 'var(--lms-success)' : 'var(--lms-warning)' }}>{exerciseIsGraded ? 'Graded' : 'Non-Graded'}</span></div>
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setShowDetailsModal(false)} className="lms-cancel-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {showOverviewModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowOverviewModal(false); }}>
          <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 400, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-info-bg)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><BarChart3 size={14} style={{ color: 'var(--lms-info)' }} /><span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Overview</span></div>
              <button type="button" onClick={() => setShowOverviewModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}><X size={15} /></button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--lms-border)' }}>
                <div className="lms-sidebar-section-title" style={{ marginBottom: 8 }}><Hash size={12} style={{ color: 'var(--lms-orange)' }} /><span>Overall Questions</span></div>
                <div className="lms-marks-row"><span className="lms-marks-label">Total Questions</span><span className="lms-marks-value" style={{ fontSize: 12, fontWeight: 700 }}>{totalSlotsAll}</span></div>
                <div className="lms-marks-row"><span className="lms-marks-label">Created</span><span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{createdCountAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlotsAll}</span></span></div>
                <div className="lms-marks-row"><span className="lms-marks-label">Remaining</span><span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlotsAll}</span></div>
                {totalSlotsAll > 0 && (<div className="lms-progress-bar" style={{ marginTop: 8, marginBottom: 15 }}><div className="lms-progress-fill" style={{ width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`, background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} /></div>)}
                {!isGeneral && getConfiguredDiffs().map(d => {
                  const quota = getQuotaForDiff(d);
                  const created = getCreatedCount(d);
                  const diffColor = d === 'easy' ? '#16a34a' : d === 'medium' ? '#d97706' : '#e53e3e';
                  return (
                    <div key={d} style={{ marginBottom: 8 }}>
                      <div className="lms-marks-row"><span className="lms-marks-label" style={{ textTransform: 'capitalize', color: diffColor, fontWeight: 700 }}>{d} <span style={{ fontSize: 10, fontWeight: 400, color: '#666' }}>({quota} question{quota !== 1 ? 's' : ''})</span></span><span className="lms-marks-value" style={{ fontSize: 12 }}><span style={{ color: '#7c3aed', fontWeight: 700 }}>{created}</span><span style={{ color: '#9a9ab0', fontWeight: 400 }}>/{quota}</span><span style={{ color: created >= quota ? '#16a34a' : '#666', fontSize: 10, marginLeft: 6 }}>{created >= quota ? '✓ Complete' : `${quota - created} remaining`}</span></span></div>
                      {quota > 0 && (<div className="lms-progress-bar" style={{ marginTop: 2 }}><div className="lms-progress-fill" style={{ width: `${Math.min(100, (created / quota) * 100)}%`, background: created >= quota ? '#16a34a' : diffColor }} /></div>)}
                    </div>
                  );
                })}
              </div>
              {exerciseIsGraded && totalMarksAll > 0 && (
                <div style={{ padding: '12px 16px' }}>
                  <div className="lms-sidebar-section-title" style={{ marginBottom: 8 }}><Award size={12} style={{ color: 'var(--lms-violet)' }} /><span>Overall Marks</span></div>
                  <div className="lms-marks-row"><span className="lms-marks-label">Total Marks</span><span className="lms-marks-value" style={{ color: '#7c3aed', fontSize: 12 }}>{totalMarksAll}</span></div>
                  <div className="lms-marks-row"><span className="lms-marks-label">Marks Used</span><span className="lms-marks-value" style={{ color: '#d97706', fontSize: 12 }}>{fmtMark(usedMarksAll)}<span style={{ color: '#9a9ab0', fontWeight: 400, fontSize: 10 }}>/{totalMarksAll}</span></span></div>
                  <div className="lms-marks-row"><span className="lms-marks-label">Remaining Marks</span><span className="lms-marks-value" style={{ color: (totalMarksAll - usedMarksAll) <= 0 ? '#16a34a' : '#1a1a2e', fontSize: 12 }}>{fmtMark(Math.max(0, totalMarksAll - usedMarksAll))}</span></div>
                  {totalMarksAll > 0 && (<div className="lms-progress-bar" style={{ marginTop: 8 }}><div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedMarksAll / totalMarksAll) * 100)}%`, background: usedMarksAll >= totalMarksAll ? '#16a34a' : '#d97706' }} /></div>)}
                  {!isGeneral && getConfiguredDiffs().map(d => {
                    const levelMarks = getTotalMarksForDiff(d);
                    const usedD = getDbMarksUsedForDiff(d);
                    const diffColor = d === 'easy' ? '#16a34a' : d === 'medium' ? '#d97706' : '#e53e3e';
                    return (
                      <div key={d} style={{ marginTop: 12, padding: '8px 10px', background: '#f8f8f8', borderRadius: 8, borderLeft: `3px solid ${diffColor}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: 12, color: diffColor }}>{d}</span>
                          <span style={{ fontSize: 10, color: '#666' }}>{getFixedScore(d)} per question</span>
                        </div>
                        <div className="lms-marks-row"><span className="lms-marks-label" style={{ fontSize: 11 }}>Total Marks</span><span className="lms-marks-value" style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>{levelMarks || 0}</span></div>
                        <div className="lms-marks-row"><span className="lms-marks-label" style={{ fontSize: 11 }}>Used Marks</span><span className="lms-marks-value" style={{ fontSize: 12, fontWeight: 700, color: usedD >= levelMarks && levelMarks > 0 ? '#16a34a' : '#d97706' }}>{fmtMark(usedD)}</span></div>
                        {levelMarks > 0 && (<div className="lms-progress-bar" style={{ marginTop: 4 }}><div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedD / levelMarks) * 100)}%`, background: usedD >= levelMarks ? '#16a34a' : diffColor }} /></div>)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setShowOverviewModal(false)} className="lms-cancel-btn">Close</button>
            </div>
          </div>
        </div>
      )}

      {showSectionModal && sectionData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSectionModal(false); }}>
          <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 420, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-violet-bg)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Layers size={14} style={{ color: 'var(--lms-violet)' }} /><span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Section Details</span></div>
              <button type="button" onClick={() => setShowSectionModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}><X size={15} /></button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: '#666', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase' }}>Section</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{sectionData.name || '—'}</div>
                {sectionData.description && <div style={{ fontSize: 11.5, color: '#555', marginTop: 4 }}>{sectionData.description}</div>}
              </div>
              <div className="lms-marks-row"><span className="lms-marks-label">Order</span><span className="lms-marks-value" style={{ fontSize: 12 }}>{sectionData.order || sectionData.sectionNumber || '—'}</span></div>
              <div className="lms-marks-row"><span className="lms-marks-label">Exercise Type</span><span className="lms-marks-value" style={{ color: '#7c3aed', fontSize: 12 }}>{sectionData.exerciseType || '—'}</span></div>
              <div className="lms-marks-row"><span className="lms-marks-label">Total Marks</span><span className="lms-marks-value" style={{ color: '#d97706', fontSize: 12 }}>{sectionData.totalMarks ?? '—'}</span></div>
              {sectionData.programmingConfig && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px solid var(--lms-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0d9488', marginBottom: 8, textTransform: 'uppercase' }}>Programming Config</div>
                  <div className="lms-marks-row"><span className="lms-marks-label">Mode</span><span className="lms-marks-value" style={{ fontSize: 12 }}>{sectionData.programmingConfig.questionConfigType || '—'}</span></div>
                  {sectionData.programmingConfig.questionConfigType === 'general' ? (
                    <div className="lms-marks-row"><span className="lms-marks-label">Questions</span><span className="lms-marks-value" style={{ fontSize: 12 }}>{sectionData.programmingConfig.generalQuestionCount ?? 0}</span></div>
                  ) : (
                    (['easy', 'medium', 'hard'] as const).map(level => (
                      <div key={level} className="lms-marks-row"><span className="lms-marks-label" style={{ textTransform: 'capitalize' }}>{level}</span><span className="lms-marks-value" style={{ fontSize: 12 }}>{sectionData.programmingConfig.levelBasedCounts?.[level] || 0}</span></div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setShowSectionModal(false)} className="lms-cancel-btn">Close</button>
            </div>
          </div>
        </div>
      )}
{showPreview && (
  <PreviewModal
    // Basic props
    questions={dbQuestions.filter(q => q.isSaved || q._id || serverIdMap.current.has(q.__localId))}
    currentIndex={currentIndex}
    isGeneral={isGeneral}
    exerciseData={exerciseData}
    onJump={handleJumpTo}
    onDelete={handleDeleteQuestion}
    onClose={() => setShowPreview(false)}
    onDone={handleCloseRequest}
    
    // Navigation & labels
    hierarchyData={hierarchyData}
    tabType={tabType}
    subcategory={subcategory}
    subcategoryLabel={subcategoryLabel}
    exerciseName={exerciseName}
    actionLabel="Preview"
    questionLabel={`${createdCountAllIncludingUnsaved} Question${createdCountAllIncludingUnsaved !== 1 ? 's' : ''}`}
    
    // Current question data
    currentDiff={currentDiff}
    score={score}
    generalMPQ={generalMPQ}
    displayScore={displayScore}
    
    // Current difficulty stats (WITH unsaved question counted)
    totalSlots={totalSlots}
    createdCount={createdCountIncludingUnsaved}
    remainingSlots={remainingSlotsIncludingUnsaved}
    usedMarks={usedMarksIncludingUnsaved}
    remainingMarks={remainingMarksIncludingUnsaved}
    totalMarksForDiff={totalMarksForDiff}
    
    // Overall stats (WITH unsaved question counted)
    totalSlotsAll={totalSlotsAll}
    createdCountAll={createdCountAllIncludingUnsaved}
    remainingSlotsAll={remainingSlotsAllIncludingUnsaved}
    totalMarksAll={totalMarksAll}
    usedMarksAll={usedMarksAllIncludingUnsaved}
    
    // Helper functions
    isScoreEditable={isScoreEditable}
    getFixedScore={getFixedScore}
    getConfiguredDiffs={getConfiguredDiffs}
    getRemainingSlots={getRemainingSlots}
    getDbQuestionsForDiff={getDbQuestionsForDiff}
    getQuotaForDiff={getQuotaForDiff}
    getCreatedCount={getCreatedCount}
    getTotalMarksForDiff={getTotalMarksForDiff}
    onDiffRowClick={() => {}}
    cfgType={cfgType}
  />
)}

      {showMockModal && (
        <SqlMockModal
          questions={(() => {
            const allDbQuestions = getDbQuestionsForDiff();
            const currentQ = dbQuestions[currentIndex];
            const currentAlreadySaved = currentQ && (currentQ.isSaved || currentQ._id || serverIdMap.current.has(currentQ.__localId));
            if (currentFormHasContent && !currentAlreadySaved) {
              const previewQ: DBQuestion = {
                __localId: 'mock-preview-current',
                _id: undefined,
                title: title.trim() || '',
                description: blocksToDescription(descBlocks),
                difficulty: currentDiff,
                score: isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff)),
                sampleQuery: sampleQuery.trim(),
                sampleResult: sampleResultBlocks,
                constraints: constraints.filter(c => c.trim()),
                hints: hint.trim() ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 }] : [],
                questionType: 'database',
                isSaved: false,
                isDirty: false,
              };
              return [...allDbQuestions, previewQ];
            }
            return allDbQuestions;
          })()}
          exerciseIsGraded={exerciseIsGraded}
          onClose={() => setShowMockModal(false)}
        />
      )}

      {showDeleteConfirm && (
        <DeleteConfirmDialog questionTitle={title || 'this question'} onConfirm={handleDeleteCurrentQuestion} onCancel={() => setShowDeleteConfirm(false)} />
      )}

      {showClearConfirm && (
        <ClearConfirmDialog onConfirm={handleClearCurrentQuestion} onCancel={() => setShowClearConfirm(false)} />
      )}

      {showCloseConfirm && (
        <CloseConfirmDialog hasUnsavedChanges={hasUnsavedFormChanges} hasSavedQuestions={hasSavedQuestionsInSession} onConfirm={handleCloseConfirmed} onCancel={() => setShowCloseConfirm(false)} />
      )}

      {showEditExerciseConfirm && (
        <EditExerciseConfirmDialog exerciseName={exerciseName} onConfirm={handleEditExerciseConfirm} onCancel={() => setShowEditExerciseConfirm(false)} />
      )}

      {/* ── Question Bank Selector ── */}
      {showBankSelector && (
        <div className="fixed inset-0 z-[9999]">
          <QuestionBankSelector
            exerciseData={{
              exerciseId: exerciseData?.exerciseId || exerciseData?.fullExerciseData?._id || exerciseData?.id || '',
              exerciseName: exerciseData?.exerciseName || exerciseData?.fullExerciseData?.exerciseInformation?.exerciseName || '',
              exerciseLevel: exerciseData?.fullExerciseData?.exerciseInformation?.exerciseLevel || 'intermediate',
              nodeId: exerciseData?.nodeId || '',
              nodeName: exerciseData?.nodeName || '',
              subcategory,
              nodeType: exerciseData?.nodeType || '',
              fullExerciseData: exerciseData?.fullExerciseData,
              exerciseType: exerciseData?.exerciseType || exerciseData?.fullExerciseData?.exerciseType || '',
            }}
            tabType={tabType}
            onClose={() => setShowBankSelector(false)}
            onBack={() => { setShowBankSelector(false); setShowAddDropdown(true); }}
            onSelect={(qs) => { setShowBankSelector(false); handleIncomingDBQuestions(qs as any[]); }}
            existingQuestionIds={(exerciseData?.fullExerciseData?.questions || []).map((q: any) => q._id)}
            existingQuestions={exerciseData?.fullExerciseData?.questions || []}
            filterByType="database"
          />
        </div>
      )}

      {/* ── AI Generation ── */}
      <GenerateProgFamilyAI
        formType="database"
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        initialDifficulty={(isGeneral ? 'medium' : currentDiff) as any}
        maxCount={isGeneral
          ? Math.max(1, getRemainingSlots() || 10)
          : Math.max(1, getRemainingSlots(currentDiff) || 10)}
        breadcrumbs={[
          hierarchyData?.courseName    && { name: hierarchyData.courseName,    type: 'course' },
          hierarchyData?.moduleName    && { name: hierarchyData.moduleName,    type: 'module' },
          hierarchyData?.submoduleName && { name: hierarchyData.submoduleName, type: 'submodule' },
          hierarchyData?.topicName     && { name: hierarchyData.topicName,     type: 'topic' },
          hierarchyData?.subtopicName  && { name: hierarchyData.subtopicName,  type: 'subtopic' },
        ].filter(Boolean) as { name: string; type: string }[]}
        exerciseName={exerciseName}
        onGenerated={(qs) => handleIncomingDBQuestions(qs as any[])}
      />
    </div>
  );
};

export default DatabaseQuestionForm;