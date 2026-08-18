import { getToken } from "@/lib/session";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QuestionApprovalBanner, RequestApproveButton, deriveApprovalContext } from '../../QuestionApprovalBanner';
import ExerciseSettings from '../../ExerciseSettings';

// ─── FONT INJECTION ───────────────────────────────────────────────────────────
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
        --lms-orange: #F27757; --lms-orange-dark: #e0623f;
        --lms-orange-glow: rgba(242,119,87,0.22);
        --lms-orange-light: rgba(242,119,87,0.08);
        --lms-orange-50: #FEF3EF; --lms-orange-100: #FDDDD4;
        --lms-text-main: #1a1a2e; --lms-text-sec: #6b6b7e;
        --lms-text-muted: #8b8b9e; --lms-text-hint: #bcbccc;
        --lms-border: #e4e4ed; --lms-border-hover: #d0d0de;
        --lms-bg-white: #ffffff; --lms-bg-surface: #f7f7fb;
        --lms-bg-surface2: #f0f0f7;
        --lms-success: #16a34a; --lms-success-bg: #f0fdf4; --lms-success-bdr: #bbf7d0;
        --lms-danger: #e53e3e; --lms-danger-bg: #fff5f5; --lms-danger-bdr: #fed7d7;
        --lms-info: #F97316; --lms-info-bg: #FFF7ED; --lms-info-bdr: #FED7AA;
        --lms-warning: #d97706; --lms-warning-bg: #fffbeb; --lms-warning-bdr: #fde68a;
        --lms-violet: #7c3aed; --lms-violet-bg: #f5f3ff; --lms-violet-bdr: #ddd6fe;
        --lms-teal: #0d9488;
        --lms-radius-sm: 8px; --lms-radius-md: 10px; --lms-radius-lg: 14px;
        --lms-font: 'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
        --lms-shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        --lms-shadow-md: 0 4px 14px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
      }
      .lms-font { font-family: var(--lms-font) !important; }
      .lms-underline-select {
        -webkit-appearance: none; -moz-appearance: none; appearance: none;
        background: transparent; border: none;
        border-bottom: 1.5px solid var(--lms-border); border-radius: 0;
        padding: 4px 24px 4px 0; font-size: 13px; font-weight: 600;
        color: var(--lms-text-main); cursor: pointer; outline: none;
        transition: border-color 0.15s; font-family: var(--lms-font);
      }
      .lms-underline-select:focus { border-bottom-color: var(--lms-orange); }
      .lms-select-wrap { position: relative; display: inline-flex; align-items: center; }
      .lms-select-wrap .chevron-icon {
        position: absolute; right: 2px; top: 50%; transform: translateY(-50%);
        pointer-events: none; color: var(--lms-text-hint); width: 13px; height: 13px;
      }
      .lms-btn {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 14px; border-radius: var(--lms-radius-md);
        font-family: var(--lms-font); font-size: 12.5px; font-weight: 600;
        border: 1.5px solid; cursor: pointer; transition: all 0.15s;
        white-space: nowrap;
      }
      .lms-btn-orange { background: var(--lms-orange); color: white; border-color: transparent; box-shadow: 0 2px 8px var(--lms-orange-glow); }
      .lms-btn-orange:hover:not(:disabled) { background: var(--lms-orange-dark); box-shadow: 0 3px 12px rgba(242,119,87,0.35); transform: translateY(-1px); }
      .lms-btn-orange:disabled { opacity: 0.55; cursor: not-allowed; }
      .lms-btn-ghost-orange { background: var(--lms-bg-white); color: #c85a30; border-color: #f2b9a3; }
      .lms-btn-ghost-orange:hover { background: var(--lms-orange-50); }
      .lms-btn-ghost-violet { background: var(--lms-bg-white); color: var(--lms-violet); border-color: var(--lms-violet-bdr); }
      .lms-btn-ghost-violet:hover { background: var(--lms-violet-bg); }
      .lms-btn-slate { background: var(--lms-bg-white); color: var(--lms-text-sec); border-color: var(--lms-border); }
      .lms-btn-slate:hover { background: var(--lms-bg-surface2); }
      .lms-icon-btn {
        width: 32px; height: 32px; border: 1.5px solid; border-radius: var(--lms-radius-sm);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.15s; background: none; flex-shrink: 0;
      }
      .lms-icon-btn-violet { border-color: var(--lms-violet-bdr); background: var(--lms-violet-bg); color: var(--lms-violet); }
      .lms-icon-btn-violet:hover { background: #ede9fe; }
      .lms-icon-btn-slate { border-color: var(--lms-border); background: var(--lms-bg-surface); color: var(--lms-text-muted); }
      .lms-icon-btn-slate:hover { background: var(--lms-bg-surface2); color: var(--lms-text-main); }
      .lms-icon-btn-red { border-color: var(--lms-danger-bdr); background: var(--lms-danger-bg); color: var(--lms-danger); }
      .lms-icon-btn-red:hover { background: #fed7d7; }
      .lms-nav-btn {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 7px 14px; border-radius: var(--lms-radius-md);
        font-family: var(--lms-font); font-size: 12.5px; font-weight: 600;
        border: 1.5px solid var(--lms-border); background: var(--lms-bg-white);
        color: var(--lms-text-sec); cursor: pointer; transition: all 0.15s;
      }
      .lms-nav-btn:hover:not(:disabled) { background: var(--lms-bg-surface); border-color: var(--lms-border-hover); }
      .lms-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .lms-progress-bar { height: 6px; background: var(--lms-bg-surface2); border-radius: 3px; overflow: hidden; margin-top: 8px; }
      .lms-progress-fill { height: 100%; border-radius: 3px; background: var(--lms-orange); transition: width 0.4s; }
      .lms-marks-row { display: flex; align-items: center; justify-content: space-between; padding: 3.5px 0; }
      .lms-marks-label { font-size: 12px; font-weight: 600; color: var(--lms-text-sec); font-family: var(--lms-font); }
      .lms-marks-value { font-size: 12.5px; font-weight: 700; font-family: var(--lms-font); }
      .lms-detail-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; padding: 3px 0; }
      .lms-detail-label { font-size: 12px; font-weight: 600; color: var(--lms-text-sec); font-family: var(--lms-font); }
      .lms-detail-value { font-size: 12.5px; font-weight: 700; color: var(--lms-text-main); font-family: var(--lms-font); }
      .lms-sidebar-section-title { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: var(--lms-text-main); margin-bottom: 10px; font-family: var(--lms-font); }
      .lms-header-logo-mark { width: 34px; height: 34px; background: var(--lms-orange); border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 3px 10px var(--lms-orange-glow); }
      .lms-breadcrumb-sep { color: var(--lms-orange); margin: 0 3px; font-weight: 700; font-size: 13px; }
      .lms-badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600; border: 1.5px solid; font-family: var(--lms-font); }
      .lms-badge-amber { background: var(--lms-warning-bg); color: var(--lms-warning); border-color: var(--lms-warning-bdr); }
      .lms-badge-green { background: var(--lms-success-bg); color: var(--lms-success); border-color: var(--lms-success-bdr); }
      .lms-badge-orange { background: var(--lms-orange-50); color: #c85a30; border-color: var(--lms-orange-100); }
      .lms-tooltip-wrap { position: relative; }
      .lms-tooltip {
        position: absolute; bottom: calc(100% + 8px); left: 50%;
        transform: translateX(-50%); background: #1a1a2e; color: white;
        font-size: 11px; font-weight: 500; font-family: var(--lms-font);
        padding: 5px 10px; border-radius: 7px; white-space: nowrap;
        pointer-events: none; opacity: 0; transition: opacity 0.15s; z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      .lms-tooltip::after { content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 4px solid transparent; border-top-color: #1a1a2e; }
      .lms-tooltip-wrap:hover .lms-tooltip { opacity: 1; }
      .lms-tooltip-right { left: auto; right: 0; transform: none; }
      .lms-tooltip-right::after { left: auto; right: 10px; transform: none; }
      .lms-diff-underline-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: transparent; border: none;
        border-bottom: 1.5px solid var(--lms-border); border-radius: 0;
        padding: 4px 20px 4px 0; font-size: 13px; font-weight: 600;
        font-family: var(--lms-font); color: var(--lms-text-hint);
        cursor: pointer; outline: none; position: relative; transition: border-color 0.15s;
      }
      .lms-diff-underline-btn:hover { border-bottom-color: var(--lms-border-hover); }
      .lms-diff-underline-btn.has-value { color: var(--lms-text-main); }
      .lms-diff-underline-btn .diff-chevron { position: absolute; right: 0; top: 50%; transform: translateY(-50%); color: var(--lms-text-hint); width: 13px; height: 13px; }
      .lms-diff-dropdown {
        position: absolute; top: calc(100% + 6px); right: 0; z-index: 200;
        background: var(--lms-bg-white); border: 1.5px solid var(--lms-border);
        border-radius: var(--lms-radius-md); box-shadow: var(--lms-shadow-md);
        min-width: 160px; overflow: hidden; padding: 4px 0;
      }
      .lms-diff-dropdown-item {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px; font-size: 13px; font-weight: 500;
        font-family: var(--lms-font); cursor: pointer; color: var(--lms-text-main);
        transition: background 0.1s;
      }
      .lms-diff-dropdown-item:hover { background: var(--lms-bg-surface); }
      .lms-score-wrap { display: inline-flex; align-items: baseline; gap: 4px; border-bottom: 1.5px solid var(--lms-border); padding: 4px 0; transition: border-color 0.15s; }
      .lms-score-wrap:focus-within { border-bottom-color: var(--lms-orange); }
      .lms-score-wrap.score-err { border-bottom-color: var(--lms-danger); }
      .lms-score-input { width: 44px; background: transparent; border: none; outline: none; font-size: 13px; font-weight: 600; color: var(--lms-text-main); font-family: var(--lms-font); text-align: right; -moz-appearance: textfield; line-height: 1; padding: 0; margin: 0; }
      .lms-score-label { font-size: 13px; color: var(--lms-text-sec); font-family: var(--lms-font); white-space: nowrap; line-height: 1; }
      .lms-fmt-btn { padding: 5px; border: none; background: none; cursor: pointer; color: var(--lms-text-muted); border-radius: 7px; transition: all 0.12s; display: flex; align-items: center; justify-content: center; }
      .lms-fmt-btn:hover { background: var(--lms-bg-surface2); color: var(--lms-text-main); }
      .lms-fmt-btn.active { background: var(--lms-orange-100); color: #c85a30; }
      .lms-toggle-track { position: relative; display: inline-block; width: 30px; height: 17px; flex-shrink: 0; }
      .lms-toggle-track input { opacity: 0; width: 0; height: 0; }
      .lms-toggle-slider { position: absolute; inset: 0; background: var(--lms-border-hover); border-radius: 17px; transition: background 0.2s; cursor: pointer; }
      .lms-toggle-slider::before { content: ''; position: absolute; width: 13px; height: 13px; border-radius: 50%; background: white; left: 2px; top: 2px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.15); }
      .lms-toggle-track input:checked + .lms-toggle-slider { background: var(--lms-orange); }
      .lms-toggle-track input:checked + .lms-toggle-slider::before { transform: translateX(13px); }
      .lms-modal-backdrop { position: fixed; inset: 0; z-index: 200; background: rgba(26,26,46,0.45); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 16px; }
      .lms-modal { background: var(--lms-bg-white); border-radius: var(--lms-radius-lg); box-shadow: 0 20px 60px rgba(0,0,0,0.18); max-width: 420px; width: 100%; border: 1.5px solid var(--lms-border); overflow: hidden; }
      .lms-modal-header { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1.5px solid var(--lms-border); }
      .lms-modal-icon { width: 32px; height: 32px; border-radius: var(--lms-radius-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .lms-modal-body { padding: 16px 18px; }
      input[type="checkbox"] { accent-color: var(--lms-orange); }
      input[type="number"]::-webkit-inner-spin-button, input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--lms-border); border-radius: 4px; }
      @keyframes lms-slide-in-right { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes lms-fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      [data-placeholder]:empty::before { content: attr(data-placeholder); color: var(--lms-text-hint); pointer-events: none; }
    `;
    document.head.appendChild(style);
  };
})();

import {
  X, AlertCircle, Loader, ChevronLeft, ChevronRight,
  GraduationCap, Settings2, FileText, Hash, Eye, Check,
  Trash2, Copy, RotateCcw, CloudUpload, CheckCircle2,
  Edit2, Info, Bold, Italic, Underline, Table, Image,
  Code, List, Type, Link, Heading1, Upload, File,
  FileImage, Archive, Presentation, Sheet, BookOpen,
  FolderOpen, ToggleLeft, ToggleRight, BarChart3, Award,
  Paperclip, Layers
} from 'lucide-react';

import { exerciseApi } from '@/apiServices/exercise';
import { questionApi } from '@/apiServices/question';

// ─── TYPES ────────────────────────────────────────────────────────────────────
type OthersQuestionType = 'notion' | 'file-upload' | '';

type OthersBlockType = 'text' | 'image';
interface OthersContentBlock {
  id: string;
  type: OthersBlockType;
  value?: string;                              // text blocks: HTML string
  url?: string;                                // image blocks: image src
  alignment?: 'left' | 'center' | 'right';    // image alignment
  sizePercent?: number;                        // image width % (10–100)
}

interface NotionSettings {
  allowBold: boolean;
  allowItalic: boolean;
  allowUnderline: boolean;
  allowTable: boolean;
  allowImage: boolean;
  allowCode: boolean;
  allowBulletList: boolean;
  allowNumberedList: boolean;
  allowHeadings: boolean;
  allowLinks: boolean;
}

const SUPPORTED_FILE_TYPES = [
  { key: 'pdf', label: 'PDF', ext: '.pdf', icon: '📄' },
  { key: 'docx', label: 'Word (DOCX)', ext: '.docx,.doc', icon: '📝' },
  { key: 'xlsx', label: 'Excel (XLSX)', ext: '.xlsx,.xls', icon: '📊' },
  { key: 'pptx', label: 'PowerPoint', ext: '.pptx,.ppt', icon: '📑' },
  { key: 'image', label: 'Images', ext: '.jpg,.jpeg,.png,.gif,.webp', icon: '🖼️' },
  { key: 'zip', label: 'ZIP / RAR', ext: '.zip,.rar,.7z', icon: '🗜️' },
  { key: 'txt', label: 'Text', ext: '.txt', icon: '📃' },
  { key: 'mp4', label: 'Video', ext: '.mp4,.mov,.avi', icon: '🎥' },
];

interface FileUploadSettings {
  allowMultiple: boolean;
  maxFiles: number;
  maxFileSizeMB: number;
  allowedTypes: string[];
}

interface OthersAttachment {
  name: string;
  url: string;
  mimeType: string;
}

interface OthersQuestionBlock {
  id: string;
  dbId?: string;
  origin: 'db' | 'new';
  isDirty?: boolean;
  questionType: OthersQuestionType;
  title: string;
  questionContent: OthersContentBlock[];   // content blocks: text + image (like MCQ)
  difficulty: 'easy' | 'medium' | 'hard' | '';
  score?: number;
  isRequired: boolean;
  notionSettings: NotionSettings;
  fileUploadSettings: FileUploadSettings;
  attachments: OthersAttachment[];
}

interface OthersAddQuestionFormProps {
  breadcrumbs: any;
  exerciseData: any;
  tabType: string;
  initialData?: any;
  isEditing?: boolean;
  initialQuestionId?: string;
  onClose: () => void;
  onSave: (questionData: any) => void;
  isSaving?: boolean;
  saveProgress?: number;
  saveMessage?: string;
  onEditExercise?: () => void;
  sectionData?: any;
  approval?: any;
  approvalContext?: { entityType: string; entityId: string; tabType: 'We_Do' | 'You_Do'; subcategory: string; exerciseId: string; questionId: string };
  onQueryResolved?: () => void;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const generateId = (prefix = 'q') =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const defaultNotionSettings = (): NotionSettings => ({
  allowBold: true, allowItalic: true, allowUnderline: true,
  allowTable: false, allowImage: false, allowCode: false,
  allowBulletList: true, allowNumberedList: true,
  allowHeadings: false, allowLinks: false,
});

const defaultFileUploadSettings = (): FileUploadSettings => ({
  allowMultiple: false, maxFiles: 1, maxFileSizeMB: 10,
  allowedTypes: ['pdf', 'docx'],
});

const makeDefaultBlock = (difficulty: 'easy' | 'medium' | 'hard' | '' = ''): OthersQuestionBlock => ({
  id: generateId('oq'),
  origin: 'new',
  isDirty: false,
  questionType: '',
  title: '',
  questionContent: [{ id: generateId('cb-text'), type: 'text', value: '' }],
  difficulty,
  score: 0,
  isRequired: true,
  notionSettings: defaultNotionSettings(),
  fileUploadSettings: defaultFileUploadSettings(),
  attachments: [],
});

// Helper: derive plain-text description string from questionContent (for save payload + search)
const deriveDescription = (blocks: OthersContentBlock[]): string =>
  blocks.filter(b => b.type === 'text').map(b => b.value || '').join(' ').replace(/<[^>]*>/g, '').trim();

// Helper: build questionContent from legacy description string (backward compat)
const migrateDescription = (desc: string, imgUrl?: string, imgAlign?: string, imgSize?: number): OthersContentBlock[] => {
  const blocks: OthersContentBlock[] = [{ id: generateId('cb-text'), type: 'text', value: desc || '' }];
  if (imgUrl) {
    blocks.push({ id: generateId('cb-img'), type: 'image', url: imgUrl, alignment: (imgAlign || 'center') as 'left' | 'center' | 'right', sizePercent: imgSize || 60 });
    blocks.push({ id: generateId('cb-text'), type: 'text', value: '' });
  }
  return blocks;
};

const diffConfig: Record<string, { label: string; dot: string; color: string; border: string }> = {
  '': { label: 'Difficulty', dot: '#bcbccc', color: 'var(--lms-text-hint)', border: 'var(--lms-border)' },
  easy: { label: 'Easy', dot: '#16a34a', color: '#16a34a', border: '#bbf7d0' },
  medium: { label: 'Medium', dot: '#d97706', color: '#d97706', border: '#fde68a' },
  hard: { label: 'Hard', dot: '#e53e3e', color: '#e53e3e', border: '#fed7d7' },
};

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
const QuestionFormBreadcrumb: React.FC<{
  breadcrumbs: any[]; tabType: string; exerciseName?: string; actionLabel: string;
}> = ({ breadcrumbs, tabType, exerciseName, actionLabel }) => (
  <nav className="flex items-center" style={{ fontFamily: 'var(--lms-font)' }}>
    <ol className="flex items-center flex-wrap gap-y-0.5">
      {breadcrumbs.map((crumb: any, idx: number) => (
        <React.Fragment key={idx}>
          <li><span className="text-[12.5px] font-semibold" style={{ color: 'var(--lms-text-sec)' }}>{crumb.name}</span></li>
          <li><span className="lms-breadcrumb-sep">»</span></li>
        </React.Fragment>
      ))}
      {exerciseName && (
        <><li><span className="text-[12.5px] font-semibold truncate max-w-[120px]" style={{ color: 'var(--lms-text-main)' }}>{exerciseName}</span></li>
          <li><span className="lms-breadcrumb-sep">»</span></li></>
      )}
      <li>
        <span className="text-[12.5px] font-bold" style={{ color: 'var(--lms-text-main)' }}>
          {actionLabel}
        </span>
      </li>
    </ol>
  </nav>
);

// ─── TOGGLE ───────────────────────────────────────────────────────────────────
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label?: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer select-none" style={{ fontFamily: 'var(--lms-font)' }}>
    <label className="lms-toggle-track">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="lms-toggle-slider" />
    </label>
    {label && <span className="text-[12px] font-semibold" style={{ color: 'var(--lms-text-sec)' }}>{label}</span>}
  </label>
);

// ─── RIGHT PANEL ──────────────────────────────────────────────────────────────
const OthersDetailsPanel: React.FC<{
  exerciseData: any;
  blocks: OthersQuestionBlock[];
  savedQuestionIds: Set<string>;
  currentBlock: OthersQuestionBlock | null;
  scoringType: string;
  marksPerQuestion: number;
  totalQuestions: number;
  maxMarks: number;
  isSaving: boolean;
  isEditing: boolean;
  onClose: () => void;
  levelBasedCounts: Record<'easy' | 'medium' | 'hard', number>;
  selectionLevelCounts: Record<'easy' | 'medium' | 'hard', number>;
  levelBasedMarks: Record<'easy' | 'medium' | 'hard', number>;
  getDifficultyUsedCount: (d: 'easy' | 'medium' | 'hard') => number;
  onDiffSwitch?: (d: 'easy' | 'medium' | 'hard') => void;
}> = ({
  exerciseData, blocks, savedQuestionIds, currentBlock,
  scoringType, marksPerQuestion, totalQuestions, maxMarks,
  levelBasedCounts, selectionLevelCounts, levelBasedMarks, getDifficultyUsedCount,
  onDiffSwitch,
}) => {
    const info = exerciseData?.fullExerciseData?.exerciseInformation;
    const exerciseType = exerciseData?.fullExerciseData?.exerciseType || exerciseData?.exerciseType || '';
    const fmt = (n: number) => Number.isInteger(n) ? `${n}` : n.toFixed(1);

    // ── Shared helpers ─────────────────────────────────────────────────────────
    const savedBlocks = blocks.filter(b => savedQuestionIds.has(b.id) || b.origin === 'db');
    const dirtyBlocks = blocks.filter(b => b.isDirty);
    const savedCount = savedBlocks.length;

    // Current difficulty selected on the question being edited
    const currentDiff = (currentBlock?.difficulty || '') as 'easy' | 'medium' | 'hard' | '';

    // Counts object depending on scoring type
    const counts: Record<'easy' | 'medium' | 'hard', number> =
      scoringType === 'levelBased' ? levelBasedCounts : selectionLevelCounts;

    // Active difficulties (quota > 0)
    const activeDiffs = (['easy', 'medium', 'hard'] as const).filter(d => counts[d] > 0);
    const multiDiff = activeDiffs.length > 1;

    // ── Re-usable row renderer (matches Programming sidebar exactly) ───────────
    const MRow = ({
      label, value, denom, color, badge,
    }: {
      label: string; value: string; denom?: string | null; color?: string;
      badge?: React.ReactNode;
    }) => (
      <div className="lms-marks-row">
        <span className="lms-marks-label">{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="lms-marks-value" style={{ color: color || 'var(--lms-text-main)', fontSize: 12 }}>
            {value}{denom != null && (
              <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 11 }}>/{denom}</span>
            )}
          </span>
          {badge}
        </div>
      </div>
    );

    // ── Section wrapper identical to Programming sidebar ──────────────────────
    const Section = ({
      bg = 'var(--lms-orange-50)',
      borderColor = 'var(--lms-orange-100)',
      icon, title, children,
    }: {
      bg?: string; borderColor?: string;
      icon: React.ReactNode; title: React.ReactNode; children: React.ReactNode;
    }) => (
      <div style={{ padding: '14px 16px', borderBottom: `1.5px solid ${borderColor}`, background: bg }}>
        <div className="lms-sidebar-section-title">
          {icon}
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', textTransform: 'capitalize' as const }}>{title}</span>
        </div>
        {children}
      </div>
    );

    // ── equalDistribution helpers ──────────────────────────────────────────────
    const eqRemaining = Math.max(0, totalQuestions - savedCount);
    const eqUsedMarks = savedCount * marksPerQuestion;
    const eqTotalMarks = totalQuestions * marksPerQuestion;
    const eqPct = totalQuestions > 0 ? Math.min(100, (savedCount / totalQuestions) * 100) : 0;
    const eqDone = totalQuestions > 0 && savedCount >= totalQuestions;

    // ── levelBased / selectionLevel per-diff helpers ───────────────────────────
    const diffUsed = (d: 'easy' | 'medium' | 'hard') => getDifficultyUsedCount(d);
    const diffLimit = (d: 'easy' | 'medium' | 'hard') => counts[d];
    const diffRemain = (d: 'easy' | 'medium' | 'hard') => Math.max(0, diffLimit(d) - diffUsed(d));
    const diffPct = (d: 'easy' | 'medium' | 'hard') => diffLimit(d) > 0 ? Math.min(100, (diffUsed(d) / diffLimit(d)) * 100) : 0;

    // Level-based marks helpers
    const diffLevelTotal = (d: 'easy' | 'medium' | 'hard') => levelBasedMarks[d] * counts[d];
    const diffMarksUsed = (d: 'easy' | 'medium' | 'hard') => diffUsed(d) * levelBasedMarks[d];
    const diffMarksRemain = (d: 'easy' | 'medium' | 'hard') => Math.max(0, diffLevelTotal(d) - diffMarksUsed(d));
    const diffMarksPct = (d: 'easy' | 'medium' | 'hard') => diffLevelTotal(d) > 0 ? Math.min(100, (diffMarksUsed(d) / diffLevelTotal(d)) * 100) : 0;

    // All-levels totals
    const totalUsedAll = activeDiffs.reduce((s, d) => s + diffUsed(d), 0);
    const totalRemAll = activeDiffs.reduce((s, d) => s + diffRemain(d), 0);
    const totalAllPct = totalQuestions > 0 ? Math.min(100, (totalUsedAll / totalQuestions) * 100) : 0;
    const usedMarksAll = activeDiffs.reduce((s, d) => s + diffMarksUsed(d), 0);
    const remMarksAll = Math.max(0, maxMarks - usedMarksAll);
    const marksPctAll = maxMarks > 0 ? Math.min(100, (usedMarksAll / maxMarks) * 100) : 0;

    // Fixed badge (matches Programming form style)
    const FixedBadge = () => (
      <span className="lms-badge" style={{ fontSize: 10, padding: '2px 6px', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-muted)', borderColor: 'var(--lms-border)' }}>
        Fixed
      </span>
    );

    return (
      <div className="h-full flex flex-col" style={{ background: 'var(--lms-bg-white)', overflow: 'hidden' }}>
        <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>

          {/* ── Exercise Details ─────────────────────────────────────────────── */}
          <Section
            bg="var(--lms-info-bg)" borderColor="var(--lms-info-bdr)"
            icon={<FileText size={14} style={{ color: 'var(--lms-info)' }} />}
            title="Exercise Details"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {info?.exerciseId && (
                <div className="lms-detail-row">
                  <span className="lms-detail-label">Exercise ID</span>
                  <span className="lms-detail-value" style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--lms-violet)', fontSize: 12 }}>{info.exerciseId}</span>
                </div>
              )}
              {(info?.exerciseName || exerciseData?.exerciseName) && (
                <div className="lms-detail-row">
                  <span className="lms-detail-label">Exercise Name</span>
                  <span className="lms-detail-value" style={{ color: 'var(--lms-orange)', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {info?.exerciseName || exerciseData?.exerciseName}
                  </span>
                </div>
              )}
              {exerciseType && (
                <div className="lms-detail-row">
                  <span className="lms-detail-label">Exercise Type</span>
                  <span className="lms-detail-value" style={{ fontSize: 12 }}>{exerciseType}</span>
                </div>
              )}
              <div className="lms-detail-row">
                <span className="lms-detail-label">Configuration</span>
                <span className="lms-detail-value" style={{ fontSize: 12 }}>
                  {scoringType === 'equalDistribution' ? 'Equal Distribution'
                    : scoringType === 'levelBased' ? 'Level Based'
                      : scoringType === 'selectionLevel' ? 'Selection Level'
                        : scoringType}
                </span>
              </div>
              {currentDiff && (scoringType === 'levelBased' || scoringType === 'selectionLevel') && (
                <div className="lms-detail-row">
                  <span className="lms-detail-label">Current Difficulty</span>
                  <span className="lms-detail-value" style={{
                    fontSize: 12, textTransform: 'capitalize',
                    color: currentDiff === 'easy' ? '#16a34a' : currentDiff === 'medium' ? '#d97706' : '#e53e3e',
                  }}>{currentDiff}</span>
                </div>
              )}
              {dirtyBlocks.length > 0 && (
                <div className="lms-detail-row">
                  <span className="lms-detail-label">Edited Qs</span>
                  <span className="lms-detail-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>{dirtyBlocks.length} will update</span>
                </div>
              )}
            </div>
          </Section>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* EQUAL DISTRIBUTION                                                */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {scoringType === 'equalDistribution' && totalQuestions > 0 && (<>

            {/* Question Quota */}
            <Section icon={<Hash size={14} style={{ color: 'var(--lms-orange)' }} />} title="Question Quota · (General)">
              <MRow label="Total Questions" value={`${totalQuestions}`} color="var(--lms-text-main)" />
              <MRow label="Questions Created" value={`${savedCount}`} denom={`${totalQuestions}`} color="var(--lms-violet)" />
              <MRow label="Remaining Questions" value={`${eqRemaining}`} denom={`${totalQuestions}`} color={eqRemaining === 0 ? 'var(--lms-success)' : 'var(--lms-warning)'} />
              <div className="lms-progress-bar">
                <div className="lms-progress-fill" style={{ width: `${eqPct}%`, background: eqDone ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
              </div>
            </Section>

            {/* Marks Allocation */}
            {marksPerQuestion > 0 && (
              <Section icon={<Award size={14} style={{ color: 'var(--lms-orange)' }} />} title="Marks Allocation · (General)">
                <MRow label="Marks per Question" value={fmt(marksPerQuestion)} color="var(--lms-orange)" badge={<FixedBadge />} />
                <MRow label="Total Marks" value={fmt(eqTotalMarks)} color="var(--lms-text-main)" />
                <MRow label="Marks Used" value={fmt(eqUsedMarks)} denom={fmt(eqTotalMarks)} color="var(--lms-warning)" />
                <MRow label="Remaining" value={fmt(Math.max(0, eqTotalMarks - eqUsedMarks))}
                  color={eqUsedMarks >= eqTotalMarks ? 'var(--lms-success)' : 'var(--lms-violet)'} />
                {eqTotalMarks > 0 && (
                  <div className="lms-progress-bar">
                    <div className="lms-progress-fill" style={{ width: `${Math.min(100, (eqUsedMarks / eqTotalMarks) * 100)}%`, background: eqUsedMarks >= eqTotalMarks ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                  </div>
                )}
              </Section>
            )}
          </>)}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* LEVEL BASED / SELECTION LEVEL                                     */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {(scoringType === 'levelBased' || scoringType === 'selectionLevel') && totalQuestions > 0 && (<>

            {/* ── Question Quota · current difficulty ── */}
            {currentDiff && counts[currentDiff] > 0 && (
              <Section
                icon={<Hash size={14} style={{ color: 'var(--lms-orange)' }} />}
                title={`Question Quota · ${currentDiff} Level`}
              >
                <MRow label="Total Questions" value={`${diffLimit(currentDiff)}`} color="var(--lms-text-main)" />
                <MRow label="Questions Created" value={`${diffUsed(currentDiff)}`} denom={`${diffLimit(currentDiff)}`} color="var(--lms-violet)" />
                <MRow label="Remaining Questions" value={`${diffRemain(currentDiff)}`} denom={`${diffLimit(currentDiff)}`}
                  color={diffRemain(currentDiff) === 0 ? 'var(--lms-success)' : 'var(--lms-warning)'} />
                <div className="lms-progress-bar">
                  <div className="lms-progress-fill" style={{
                    width: `${diffPct(currentDiff)}%`,
                    background: diffRemain(currentDiff) === 0 ? 'var(--lms-success)' : 'var(--lms-orange)',
                  }} />
                </div>
              </Section>
            )}

            {/* ── Question Overview — all levels ── */}
            {multiDiff && (
              <Section
                bg="var(--lms-bg-surface)" borderColor="var(--lms-border)"
                icon={<BarChart3 size={14} style={{ color: 'var(--lms-text-sec)' }} />}
                title="Question Overview"
              >
                <MRow label="Total Questions" value={`${totalQuestions}`} color="var(--lms-text-main)" />
                <MRow label="Questions Created" value={`${totalUsedAll}`} denom={`${totalQuestions}`} color="var(--lms-violet)" />
                <MRow label="Remaining Questions" value={`${totalRemAll}`} denom={`${totalQuestions}`}
                  color={totalRemAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)'} />
                {/* Per-difficulty clickable rows — click to switch difficulty */}
                {activeDiffs.map(d => {
                  const isActiveDiff = d === currentDiff;
                  const dotColor = d === 'easy' ? '#16a34a' : d === 'medium' ? '#d97706' : '#e53e3e';
                  const rowBg = isActiveDiff
                    ? (d === 'easy' ? '#f0fdf4' : d === 'medium' ? '#fffbeb' : '#fff5f5')
                    : 'transparent';
                  const rowBorder = isActiveDiff
                    ? (d === 'easy' ? '1.5px solid #bbf7d0' : d === 'medium' ? '1.5px solid #fde68a' : '1.5px solid #fed7d7')
                    : '1.5px solid transparent';
                  return (
                    <div key={d}
                      onClick={() => !isActiveDiff && onDiffSwitch && diffRemain(d) > 0 && onDiffSwitch(d)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '5px 7px', borderRadius: 7, marginTop: 3,
                        background: rowBg, border: rowBorder,
                        cursor: !isActiveDiff && onDiffSwitch && diffRemain(d) > 0 ? 'pointer' : 'default',
                        transition: 'all 0.13s',
                      }}
                      title={!isActiveDiff && diffRemain(d) > 0 ? `Switch to ${d}` : undefined}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: dotColor, textTransform: 'capitalize', fontFamily: 'var(--lms-font)' }}>
                          {d}
                        </span>
                        {isActiveDiff && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: dotColor, background: rowBg, padding: '1px 5px', borderRadius: 10, border: rowBorder }}>
                            current
                          </span>
                        )}
                      </div>
                      <span className="lms-marks-value" style={{ color: diffRemain(d) === 0 ? 'var(--lms-success)' : 'var(--lms-text-sec)', fontSize: 11.5 }}>
                        {diffUsed(d)}/{diffLimit(d)}
                      </span>
                    </div>
                  );
                })}
                <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                  <div className="lms-progress-fill" style={{ width: `${totalAllPct}%`, background: totalRemAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                </div>
              </Section>
            )}

            {/* ── Marks Allocation · current difficulty (levelBased only) ── */}
            {scoringType === 'levelBased' && currentDiff && counts[currentDiff] > 0 && (
              <Section
                icon={<Award size={14} style={{ color: 'var(--lms-orange)' }} />}
                title={`Marks Allocation · ${currentDiff} Level`}
              >
                {diffLevelTotal(currentDiff) > 0 && (
                  <MRow label="Level Total" value={`${diffLevelTotal(currentDiff)}`} color="var(--lms-text-main)" />
                )}
                <MRow
                  label="Marks per Question"
                  value={fmt(levelBasedMarks[currentDiff])}
                  color="var(--lms-orange)"
                  badge={<FixedBadge />}
                />
                {diffLevelTotal(currentDiff) > 0 && (<>
                  <MRow label="Marks Used" value={fmt(diffMarksUsed(currentDiff))} denom={`${diffLevelTotal(currentDiff)}`} color="var(--lms-warning)" />
                  <MRow label="Remaining" value={fmt(diffMarksRemain(currentDiff))} color={diffMarksRemain(currentDiff) <= 0 ? 'var(--lms-success)' : 'var(--lms-violet)'} />
                  <div className="lms-progress-bar">
                    <div className="lms-progress-fill" style={{ width: `${diffMarksPct(currentDiff)}%`, background: diffMarksPct(currentDiff) >= 100 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                  </div>
                </>)}
              </Section>
            )}

            {/* ── Marks Allocation Overview — all levels (levelBased only) ── */}
            {scoringType === 'levelBased' && multiDiff && maxMarks > 0 && (
              <Section
                bg="var(--lms-bg-surface)" borderColor="var(--lms-border)"
                icon={<Award size={14} style={{ color: 'var(--lms-text-sec)' }} />}
                title="Marks Allocation Overview"
              >
                <MRow label="Total Marks" value={`${maxMarks}`} color="var(--lms-text-main)" />
                <MRow label="Marks Used" value={fmt(usedMarksAll)} denom={`${maxMarks}`} color="var(--lms-warning)" />
                <MRow label="Remaining" value={fmt(remMarksAll)} color={remMarksAll === 0 ? 'var(--lms-success)' : 'var(--lms-violet)'} />
                {/* Per-diff totals */}
                {activeDiffs.map(d => (
                  <MRow key={d} label={d.charAt(0).toUpperCase() + d.slice(1)} value={`${diffLevelTotal(d)}`} color="var(--lms-text-sec)" />
                ))}
                <div className="lms-progress-bar">
                  <div className="lms-progress-fill" style={{ width: `${marksPctAll}%`, background: marksPctAll >= 100 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                </div>
              </Section>
            )}

            {/* selectionLevel with no marks: just show a note */}
            {scoringType === 'selectionLevel' && !currentDiff && (
              <div style={{ padding: '14px 16px' }}>
                <p style={{ fontSize: 11.5, color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
                  Select a difficulty for this question to see quota details.
                </p>
              </div>
            )}
          </>)}

          {/* ── Fallback when nothing is configured ─────────────────────────── */}
          {totalQuestions === 0 && maxMarks === 0 && (
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: 11.5, color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
                No marks or question count configured. Edit the exercise settings to set them up.
              </p>
            </div>
          )}

        </div>
      </div>
    );
  };

// ─── NOTION SETTINGS PANEL ────────────────────────────────────────────────────
const NOTION_FEATURES: Array<{ key: keyof NotionSettings; label: string; icon: React.ReactNode; desc: string }> = [
  { key: 'allowBold', label: 'Bold', icon: <Bold className="h-3.5 w-3.5" />, desc: 'Allow bold text formatting' },
  { key: 'allowItalic', label: 'Italic', icon: <Italic className="h-3.5 w-3.5" />, desc: 'Allow italic text formatting' },
  { key: 'allowUnderline', label: 'Underline', icon: <Underline className="h-3.5 w-3.5" />, desc: 'Allow underline text formatting' },
  { key: 'allowHeadings', label: 'Headings', icon: <Heading1 className="h-3.5 w-3.5" />, desc: 'Allow H1, H2, H3 headings' },
  { key: 'allowBulletList', label: 'Bullet List', icon: <List className="h-3.5 w-3.5" />, desc: 'Allow unordered bullet lists' },
  { key: 'allowNumberedList', label: 'Numbered List', icon: <Hash className="h-3.5 w-3.5" />, desc: 'Allow ordered numbered lists' },
  { key: 'allowTable', label: 'Table', icon: <Table className="h-3.5 w-3.5" />, desc: 'Allow table creation and editing' },
  { key: 'allowImage', label: 'Image', icon: <Image className="h-3.5 w-3.5" />, desc: 'Allow image insertion' },
  { key: 'allowCode', label: 'Code Block', icon: <Code className="h-3.5 w-3.5" />, desc: 'Allow code block insertion' },
  { key: 'allowLinks', label: 'Links', icon: <Link className="h-3.5 w-3.5" />, desc: 'Allow hyperlink insertion' },
];

const NotionSettingsPanel: React.FC<{
  settings: NotionSettings;
  onChange: (s: NotionSettings) => void;
}> = ({ settings, onChange }) => {
  const toggle = (key: keyof NotionSettings) =>
    onChange({ ...settings, [key]: !settings[key] });

  const enabledCount = NOTION_FEATURES.filter(f => settings[f.key]).length;

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)' }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1.5px solid var(--lms-border)', background: 'var(--lms-violet-bg)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--lms-violet)', color: '#fff' }}>
            <Type className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Notion Editor Provisions</p>
            <p className="text-[11px]" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>Toggle what students can use in their response</p>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: 'var(--lms-violet)', color: '#fff', fontFamily: 'var(--lms-font)' }}>
          {enabledCount} / {NOTION_FEATURES.length}
        </span>
      </div>

      <div className="px-4 py-2.5 flex items-center gap-3" style={{ borderBottom: '1px solid var(--lms-border)', background: 'var(--lms-bg-surface)' }}>
        <button type="button" onClick={() => onChange(Object.fromEntries(NOTION_FEATURES.map(f => [f.key, true])) as NotionSettings)}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all"
          style={{ background: 'var(--lms-violet-bg)', color: 'var(--lms-violet)', border: '1px solid var(--lms-violet-bdr)', fontFamily: 'var(--lms-font)', cursor: 'pointer' }}>
          Enable All
        </button>
        <button type="button" onClick={() => onChange(Object.fromEntries(NOTION_FEATURES.map(f => [f.key, false])) as NotionSettings)}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all"
          style={{ background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', border: '1px solid var(--lms-danger-bdr)', fontFamily: 'var(--lms-font)', cursor: 'pointer' }}>
          Disable All
        </button>
      </div>

      <div className="p-4 grid grid-cols-2 gap-2">
        {NOTION_FEATURES.map(f => {
          const active = settings[f.key];
          return (
            <button key={f.key} type="button" onClick={() => toggle(f.key)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{
                border: `1.5px solid ${active ? 'var(--lms-violet-bdr)' : 'var(--lms-border)'}`,
                background: active ? 'var(--lms-violet-bg)' : 'var(--lms-bg-surface)',
                cursor: 'pointer',
              }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                style={{ background: active ? 'var(--lms-violet)' : 'var(--lms-bg-surface2)', color: active ? '#fff' : 'var(--lms-text-muted)' }}>
                {f.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-bold truncate" style={{ color: active ? 'var(--lms-violet)' : 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>{f.label}</p>
                <p className="text-[10px] truncate" style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>{f.desc}</p>
              </div>
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                style={{ borderColor: active ? 'var(--lms-violet)' : 'var(--lms-border)', background: active ? 'var(--lms-violet)' : 'transparent' }}>
                {active && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--lms-info-bg)', border: '1px solid var(--lms-info-bdr)' }}>
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--lms-info)' }} />
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--lms-info)', fontFamily: 'var(--lms-font)' }}>
            These provisions control what formatting tools are available to students when writing their answer in the Notion-style editor.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── FILE UPLOAD SETTINGS PANEL ───────────────────────────────────────────────
const FileUploadSettingsPanel: React.FC<{
  settings: FileUploadSettings;
  onChange: (s: FileUploadSettings) => void;
  error?: string;
}> = ({ settings, onChange, error }) => {
  const toggleType = (key: string) => {
    const current = settings.allowedTypes;
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    onChange({ ...settings, allowedTypes: next });
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1.5px solid var(--lms-border)', background: '#eff9f4' }}>
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: '#16a34a', color: '#fff' }}>
          <Upload className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-[13px] font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>File Upload Settings</p>
          <p className="text-[11px]" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>Configure what students can upload</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)' }}>
          <div>
            <p className="text-[12.5px] font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Allow Multiple Files</p>
            <p className="text-[11px]" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>Students can upload more than one file</p>
          </div>
          <Toggle checked={settings.allowMultiple} onChange={v => onChange({ ...settings, allowMultiple: v, maxFiles: v ? settings.maxFiles || 5 : 1 })} />
        </div>

        {settings.allowMultiple && (
          <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)' }}>
            <div>
              <p className="text-[12.5px] font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Max File Count</p>
              <p className="text-[11px]" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>Maximum number of files allowed</p>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => onChange({ ...settings, maxFiles: Math.max(1, settings.maxFiles - 1) })}
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base transition-all"
                style={{ background: 'var(--lms-bg-surface2)', border: '1.5px solid var(--lms-border)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>−</button>
              <input type="number" min={1} max={20} value={settings.maxFiles}
                onChange={e => onChange({ ...settings, maxFiles: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)) })}
                className="w-12 text-center text-[13px] font-bold rounded-lg py-1"
                style={{ border: '1.5px solid var(--lms-border)', background: '#fff', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', outline: 'none' }} />
              <button type="button" onClick={() => onChange({ ...settings, maxFiles: Math.min(20, settings.maxFiles + 1) })}
                className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base transition-all"
                style={{ background: 'var(--lms-orange)', border: '1.5px solid transparent', color: '#fff', cursor: 'pointer' }}>+</button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-2.5 px-3 rounded-xl" style={{ background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)' }}>
          <div>
            <p className="text-[12.5px] font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Max File Size</p>
            <p className="text-[11px]" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>Maximum size per file</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => onChange({ ...settings, maxFileSizeMB: Math.max(1, settings.maxFileSizeMB - 1) })}
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base transition-all"
              style={{ background: 'var(--lms-bg-surface2)', border: '1.5px solid var(--lms-border)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>−</button>
            <input type="number" min={1} max={500} value={settings.maxFileSizeMB}
              onChange={e => onChange({ ...settings, maxFileSizeMB: Math.max(1, Math.min(500, parseInt(e.target.value) || 1)) })}
              className="w-14 text-center text-[13px] font-bold rounded-lg py-1"
              style={{ border: '1.5px solid var(--lms-border)', background: '#fff', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', outline: 'none' }} />
            <span className="text-[12px] font-semibold" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>MB</span>
            <button type="button" onClick={() => onChange({ ...settings, maxFileSizeMB: Math.min(500, settings.maxFileSizeMB + 1) })}
              className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-base transition-all"
              style={{ background: 'var(--lms-orange)', border: '1.5px solid transparent', color: '#fff', cursor: 'pointer' }}>+</button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[12.5px] font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Supported File Types</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onChange({ ...settings, allowedTypes: SUPPORTED_FILE_TYPES.map(f => f.key) })}
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg"
                style={{ background: 'var(--lms-success-bg)', color: 'var(--lms-success)', border: '1px solid var(--lms-success-bdr)', fontFamily: 'var(--lms-font)', cursor: 'pointer' }}>All</button>
              <button type="button" onClick={() => onChange({ ...settings, allowedTypes: [] })}
                className="text-[10.5px] font-semibold px-2 py-0.5 rounded-lg"
                style={{ background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', border: '1px solid var(--lms-danger-bdr)', fontFamily: 'var(--lms-font)', cursor: 'pointer' }}>None</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SUPPORTED_FILE_TYPES.map(ft => {
              const active = settings.allowedTypes.includes(ft.key);
              return (
                <button key={ft.key} type="button" onClick={() => toggleType(ft.key)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-left transition-all"
                  style={{
                    border: `1.5px solid ${active ? '#16a34a' : 'var(--lms-border)'}`,
                    background: active ? '#eff9f4' : 'var(--lms-bg-surface)',
                    cursor: 'pointer',
                  }}>
                  <span className="text-base flex-shrink-0">{ft.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-bold truncate" style={{ color: active ? '#15803d' : 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>{ft.label}</p>
                    <p className="text-[10px] truncate" style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>{ft.ext}</p>
                  </div>
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ borderColor: active ? '#16a34a' : 'var(--lms-border)', background: active ? '#16a34a' : 'transparent' }}>
                    {active && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                </button>
              );
            })}
          </div>
          {error && (
            <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'var(--lms-info-bg)', border: '1px solid var(--lms-info-bdr)' }}>
          <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--lms-info)' }} />
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--lms-info)', fontFamily: 'var(--lms-font)' }}>
            Students will see a file upload area restricted to these settings. Selected types determine which files are accepted.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── MODAL PRIMITIVES ─────────────────────────────────────────────────────────
const SmallModal: React.FC<{ icon: React.ReactNode; iconBg: string; title: string; children: React.ReactNode }> = ({ icon, iconBg, title, children }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header">
        <div className={`lms-modal-icon ${iconBg}`}>{icon}</div>
        <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)' }}>{title}</h3>
      </div>
      <div className="lms-modal-body">{children}</div>
    </div>
  </div>
);

const DeleteDialog: React.FC<{ isOpen: boolean; title: string; onConfirm: () => void; onCancel: () => void; isDeleting?: boolean }> = ({ isOpen, title, onConfirm, onCancel, isDeleting }) => {
  if (!isOpen) return null;
  return (
    <SmallModal icon={<Trash2 className="h-4 w-4 text-red-600" />} iconBg="bg-red-50" title="Delete Question">
      <p className="text-xs font-medium mb-3" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
        Are you sure you want to delete <strong>"{title || 'Untitled question'}"</strong>? This cannot be undone.
      </p>
      <div className="flex gap-2">
        <button onClick={onCancel} disabled={isDeleting} className="flex-1 lms-btn lms-btn-slate justify-center">Cancel</button>
        <button onClick={onConfirm} disabled={isDeleting}
          className="flex-1 lms-btn justify-center"
          style={{ background: 'var(--lms-danger)', color: '#fff', borderColor: 'transparent' }}>
          {isDeleting ? <><Loader className="h-3.5 w-3.5 animate-spin" />Deleting…</> : <><Trash2 className="h-3.5 w-3.5" />Delete</>}
        </button>
      </div>
    </SmallModal>
  );
};

const CloseDialog: React.FC<{ isOpen: boolean; unsavedCount: number; onConfirm: () => void; onCancel: () => void }> = ({ isOpen, unsavedCount, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="lms-modal-backdrop">
      <div className="lms-modal" style={{ maxWidth: 400 }}>
        <div className="lms-modal-header">
          <div className="lms-modal-icon" style={{ background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)' }}>
            <AlertCircle style={{ width: 18, height: 18, color: '#d97706' }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)' }}>Unsaved Questions</h3>
            <p className="text-[11px] mt-0.5" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-muted)' }}>
              {unsavedCount} question{unsavedCount !== 1 ? 's' : ''} will be lost if you close now.
            </p>
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-3">
          <button onClick={onCancel} className="flex-1 lms-btn lms-btn-slate justify-center">Keep Editing</button>
          <button onClick={onConfirm} className="flex-1 lms-btn lms-btn-orange justify-center"><X className="h-3.5 w-3.5" />Close & Discard</button>
        </div>
      </div>
    </div>
  );
};

// ─── DIFFICULTY PICKER MODAL ─────────────────────────────────────────────────
const diffPickerConfig = {
  easy: { label: 'Easy', dot: '#16a34a', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', solid: '#16a34a' },
  medium: { label: 'Medium', dot: '#d97706', color: '#d97706', bg: '#fffbeb', border: '#fde68a', solid: '#d97706' },
  hard: { label: 'Hard', dot: '#e53e3e', color: '#e53e3e', bg: '#fff5f5', border: '#fed7d7', solid: '#e53e3e' },
} as const;

const DifficultyPickerModal: React.FC<{
  availableDiffs: { diff: 'easy' | 'medium' | 'hard'; remaining: number; total: number }[];
  onSelect: (d: 'easy' | 'medium' | 'hard') => void;
  onClose?: () => void;   // if omitted → mandatory mode (no Cancel)
  title?: string;
  subtitle?: string;
  disabledDiffs?: Set<'easy' | 'medium' | 'hard'>; // full diffs disabled in mandatory mode
}> = ({ availableDiffs, onSelect, onClose, title, subtitle, disabledDiffs }) => (
  <div className="lms-modal-backdrop" style={{ zIndex: 9999 }}>
    <div className="lms-modal" style={{ maxWidth: 420 }}>
      <div className="lms-modal-header">
        <div className="lms-modal-icon" style={{ background: 'var(--lms-orange-light)', border: '1.5px solid var(--lms-orange-100)' }}>
          <GraduationCap style={{ width: 18, height: 18, color: 'var(--lms-orange)' }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 15, fontWeight: 700, color: 'var(--lms-text-main)' }}>
            {title || 'Select Difficulty'}
          </h2>
          <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>
            {subtitle || 'Choose a difficulty level to continue'}
          </p>
        </div>
      </div>
      <div className="lms-modal-body">
        {availableDiffs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {availableDiffs.map(({ diff, remaining, total }) => {
              const ds = diffPickerConfig[diff];
              const used = total - remaining;
              const isDisabled = disabledDiffs?.has(diff) ?? false;
              return (
                <button key={diff}
                  onClick={() => { if (!isDisabled) onSelect(diff); }}
                  disabled={isDisabled}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 'var(--lms-radius-md)',
                    border: `2px solid ${isDisabled ? 'var(--lms-border)' : ds.border}`,
                    background: isDisabled ? 'var(--lms-bg-surface)' : ds.bg,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    opacity: isDisabled ? 0.55 : 1,
                    fontFamily: 'var(--lms-font)', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isDisabled) (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 3px ${ds.border}`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: isDisabled ? 'var(--lms-text-hint)' : ds.solid }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: isDisabled ? 'var(--lms-text-hint)' : ds.color, textTransform: 'capitalize' }}>{ds.label}</span>
                    {isDisabled && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--lms-text-hint)', background: 'var(--lms-bg-surface2)', padding: '1px 6px', borderRadius: 10, border: '1px solid var(--lms-border)' }}>
                        Full
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* progress bar */}
                    <div style={{ width: 60, height: 4, borderRadius: 4, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${total > 0 ? (used / total) * 100 : 0}%`, background: isDisabled ? 'var(--lms-text-hint)' : ds.solid, borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: isDisabled ? 'var(--lms-text-hint)' : ds.color,
                      background: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: 20,
                      border: `1px solid ${isDisabled ? 'var(--lms-border)' : ds.border}`,
                    }}>
                      {used}/{total}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <CheckCircle2 style={{ width: 32, height: 32, color: 'var(--lms-success)', margin: '0 auto 8px' }} />
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>All difficulties complete!</p>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-muted)', marginTop: 4 }}>All question slots have been filled.</p>
          </div>
        )}
        {/* Only show Cancel when not mandatory */}
        {onClose && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button onClick={onClose} className="lms-btn lms-btn-slate">Cancel</button>
          </div>
        )}
        {/* Mandatory hint */}
        {!onClose && availableDiffs.length > 0 && (
          <p style={{ textAlign: 'center', marginTop: 14, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-hint)' }}>
            You must select a difficulty to continue
          </p>
        )}
      </div>
    </div>
  </div>
);

// ─── IMAGE UPLOAD MODAL ───────────────────────────────────────────────────────
const OthersImageUploadModal: React.FC<{
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
      const res = await fetch('http://localhost:5533/upload/question-image', {
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

  const TAB = (active: boolean): React.CSSProperties => ({
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
      <div style={{ background: 'var(--lms-bg-white)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 380, margin: '0 16px', overflow: 'hidden', border: '1.5px solid var(--lms-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 0' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Insert Image</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
            <X style={{ width: 16, height: 16, color: 'var(--lms-text-muted)' }} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 16, padding: '0 18px', borderBottom: '1px solid var(--lms-border)' }}>
          <button type="button" style={TAB(tab === 'upload')} onClick={() => { setTab('upload'); setError(''); }}>Upload</button>
          <button type="button" style={TAB(tab === 'url')} onClick={() => { setTab('url'); setUrlError(''); }}>By URL</button>
        </div>
        <div style={{ padding: 18 }}>
          {tab === 'upload' ? (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) doUpload(f); }}
                onClick={() => inputRef.current?.click()}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 10, borderRadius: 10, padding: '32px 16px', cursor: 'pointer',
                  border: `2px dashed ${dragging ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                  background: dragging ? 'var(--lms-orange-light)' : 'var(--lms-bg-surface)',
                  transition: 'all 0.15s',
                }}>
                {uploading ? (
                  <>
                    <Loader style={{ width: 30, height: 30, color: 'var(--lms-orange)' }} className="animate-spin" />
                    <span style={{ fontSize: 13, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>Uploading…</span>
                  </>
                ) : (
                  <>
                    <CloudUpload style={{ width: 30, height: 30, color: dragging ? 'var(--lms-orange)' : 'var(--lms-text-hint)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Drag & drop or click to upload</p>
                      <p style={{ fontSize: 11, color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)', marginTop: 2 }}>PNG, JPG, GIF, WEBP supported</p>
                    </div>
                  </>
                )}
                <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f); }} />
              </div>
              {error && <p style={{ fontSize: 11, color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)', marginTop: 8 }}>{error}</p>}
            </>
          ) : (
            <>
              <input
                type="text" value={urlValue} onChange={e => setUrlValue(e.target.value)}
                placeholder="https://example.com/image.png"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8, fontFamily: 'var(--lms-font)',
                  fontSize: 13, border: '1.5px solid var(--lms-border)', outline: 'none',
                  color: 'var(--lms-text-main)', background: 'var(--lms-bg-surface)',
                }}
              />
              {urlError && <p style={{ fontSize: 11, color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)', marginTop: 4 }}>{urlError}</p>}
              <button type="button" onClick={() => {
                const t = urlValue.trim();
                if (!t) { setUrlError('Please enter a URL.'); return; }
                if (!/^https?:\/\/.+/i.test(t)) { setUrlError('URL must start with http:// or https://'); return; }
                setUrlError(''); onUpload(t);
              }}
                style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 600, background: 'var(--lms-orange)', color: '#fff', border: 'none' }}>
                Insert Image
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── FILE UPLOAD MODAL ────────────────────────────────────────────────────────
const OthersFileUploadModal: React.FC<{
  onUpload: (attachment: OthersAttachment) => void;
  onClose: () => void;
}> = ({ onUpload, onClose }) => {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const doUpload = async (file: File) => {
    setUploading(true); setError('');
    try {
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('http://localhost:5533/upload/question-file', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Upload failed');
      onUpload({ name: json.name || file.name, url: json.url, mimeType: json.mimeType || file.type });
    } catch (e: any) {
      setError(e.message || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(26,26,46,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: 'var(--lms-bg-white)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 380, margin: '0 16px', overflow: 'hidden', border: '1.5px solid var(--lms-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 12px' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Attach File</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6 }}>
            <X style={{ width: 16, height: 16, color: 'var(--lms-text-muted)' }} />
          </button>
        </div>
        <div style={{ padding: '0 18px 18px' }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) doUpload(f); }}
            onClick={() => inputRef.current?.click()}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, borderRadius: 10, padding: '32px 16px', cursor: 'pointer',
              border: `2px dashed ${dragging ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
              background: dragging ? 'var(--lms-orange-light)' : 'var(--lms-bg-surface)',
              transition: 'all 0.15s',
            }}>
            {uploading ? (
              <>
                <Loader style={{ width: 30, height: 30, color: 'var(--lms-orange)' }} className="animate-spin" />
                <span style={{ fontSize: 13, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>Uploading…</span>
              </>
            ) : (
              <>
                <Paperclip style={{ width: 30, height: 30, color: dragging ? 'var(--lms-orange)' : 'var(--lms-text-hint)' }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Drag & drop or click to attach</p>
                  <p style={{ fontSize: 11, color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)', marginTop: 2 }}>PDF, DOC, DOCX, XLS, XLSX, PPT, TXT, CSV (max 20 MB)</p>
                </div>
              </>
            )}
            <input ref={inputRef} type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f); }} />
          </div>
          {error && <p style={{ fontSize: 11, color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)', marginTop: 8 }}>{error}</p>}
        </div>
      </div>
    </div>
  );
};

// ─── RESIZABLE IMAGE (corner-drag handles + alignment overlay) ────────────────
const OthersResizableImage: React.FC<{
  url: string;
  alignment: 'left' | 'center' | 'right';
  sizePercent: number;
  onUpdate: (patch: { alignment?: 'left' | 'center' | 'right'; sizePercent?: number }) => void;
  onRemove: () => void;
  disabled?: boolean;
}> = ({ url, alignment, sizePercent, onUpdate, onRemove, disabled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [liveSize, setLiveSize] = useState(sizePercent);
  const startX = useRef(0);
  const startSize = useRef(0);
  const dragSide = useRef<'left' | 'right'>('right');

  useEffect(() => { setLiveSize(sizePercent); }, [sizePercent]);

  const onMouseDown = (e: React.MouseEvent, side: 'left' | 'right') => {
    if (disabled) return;
    e.preventDefault(); e.stopPropagation();
    startX.current = e.clientX;
    startSize.current = liveSize;
    dragSide.current = side;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const parentW = containerRef.current?.parentElement?.clientWidth || 600;
      const dx = ev.clientX - startX.current;
      const delta = (dx / parentW) * 100;
      const newSize = Math.min(100, Math.max(10,
        dragSide.current === 'right' ? startSize.current + delta : startSize.current - delta
      ));
      setLiveSize(Math.round(newSize));
    };
    const onUp = (ev: MouseEvent) => {
      const parentW = containerRef.current?.parentElement?.clientWidth || 600;
      const dx = ev.clientX - startX.current;
      const delta = (dx / parentW) * 100;
      const final = Math.round(Math.min(100, Math.max(10,
        dragSide.current === 'right' ? startSize.current + delta : startSize.current - delta
      )));
      setLiveSize(final);
      onUpdate({ sizePercent: final });
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const justify = alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center';

  // Diagonal double-arrow SVG for corner handles
  const DiagArrow = ({ rotate }: { rotate: number }) => (
    <svg width="10" height="10" viewBox="0 0 10 10"
      style={{ transform: `rotate(${rotate}deg)`, display: 'block', pointerEvents: 'none' }}>
      <line x1="1" y1="9" x2="9" y2="1" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" />
      <polyline points="5,1 9,1 9,5" fill="none" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="5,9 1,9 1,5" fill="none" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const cornerBase: React.CSSProperties = {
    position: 'absolute', width: 16, height: 16,
    background: 'white', border: '1.5px solid var(--lms-orange)',
    borderRadius: 3, zIndex: 10, userSelect: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: !disabled && (hovered || dragging) ? 1 : 0,
    transition: 'opacity 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex', justifyContent: justify,
        position: 'relative',
        padding: '8px 0',      // keeps -7px corner handles inside hover zone
        overflow: 'visible',   // don't clip handles
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ width: `${liveSize}%`, position: 'relative', transition: dragging ? 'none' : 'width 0.1s' }}>

        {/* Image */}
        <img src={url} alt="" className="w-full h-auto rounded-lg"
          style={{
            border: `1.5px solid ${dragging ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
            display: 'block', userSelect: 'none', pointerEvents: 'none',
          }}
          draggable={false}
        />

        {/* Corner handles */}
        {!disabled && (
          <>
            <div style={{ ...cornerBase, top: -7, left: -7, cursor: 'nwse-resize' }} onMouseDown={e => onMouseDown(e, 'left')}><DiagArrow rotate={0} /></div>
            <div style={{ ...cornerBase, top: -7, right: -7, cursor: 'nesw-resize' }} onMouseDown={e => onMouseDown(e, 'right')}><DiagArrow rotate={90} /></div>
            <div style={{ ...cornerBase, bottom: -7, left: -7, cursor: 'nesw-resize' }} onMouseDown={e => onMouseDown(e, 'left')}><DiagArrow rotate={90} /></div>
            <div style={{ ...cornerBase, bottom: -7, right: -7, cursor: 'nwse-resize' }} onMouseDown={e => onMouseDown(e, 'right')}><DiagArrow rotate={0} /></div>
          </>
        )}

        {/* Live size badge while dragging */}
        {dragging && (
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.65)', color: 'white',
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
            fontFamily: 'var(--lms-font)', pointerEvents: 'none', zIndex: 20,
          }}>
            {liveSize}%
          </div>
        )}

        {/* Alignment + Remove overlay (top-right, visible on hover) */}
        {!disabled && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            display: 'flex', alignItems: 'center', gap: 4, zIndex: 20,
            opacity: hovered || dragging ? 1 : 0, transition: 'opacity 0.15s',
          }}>
            {(['left', 'center', 'right'] as const).map(a => (
              <button key={a} type="button" onClick={() => onUpdate({ alignment: a })}
                style={{
                  width: 22, height: 22, borderRadius: 5, border: '1.5px solid',
                  fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--lms-font)',
                  background: alignment === a ? 'var(--lms-orange)' : 'white',
                  borderColor: alignment === a ? 'var(--lms-orange)' : 'var(--lms-border)',
                  color: alignment === a ? 'white' : 'var(--lms-text-muted)',
                }}>
                {a[0].toUpperCase()}
              </button>
            ))}
            <button type="button" onClick={onRemove}
              style={{
                width: 22, height: 22, borderRadius: 5,
                border: '1.5px solid var(--lms-danger-bdr)',
                background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TEXT BLOCK (single contenteditable inside the content editor) ────────────
const OthersTextBlock: React.FC<{
  cb: OthersContentBlock;
  isFirst: boolean;
  onUpdate: (html: string) => void;
  onFmtChange: () => void;
  disabled?: boolean;
}> = ({ cb, isFirst, onUpdate, onFmtChange, disabled }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const lastHtml = useRef('');

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const safeVal = typeof cb.value === 'string' ? cb.value : '';
    if (lastHtml.current === safeVal) return;
    el.innerHTML = safeVal;
    lastHtml.current = safeVal;
  });

  const handleInput = () => {
    const el = divRef.current;
    if (!el) return;
    lastHtml.current = el.innerHTML;
    onUpdate(el.innerHTML);
    onFmtChange();
  };

  return (
    <div
      ref={divRef}
      contentEditable={!disabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyUp={onFmtChange}
      onMouseUp={onFmtChange}
      style={{
        minHeight: isFirst ? 68 : 28,
        fontSize: 13.5, color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)',
        lineHeight: 1.7, outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}
      data-placeholder={isFirst ? 'Provide any additional instructions, context, or rubric for this question…' : 'Add more text…'}
    />
  );
};

// ─── CONTENT EDITOR (full-width canvas: toolbar + text/image blocks) ──────────
const OthersContentEditor: React.FC<{
  blocks: OthersContentBlock[];
  onChange: (blocks: OthersContentBlock[]) => void;
  attachments: OthersAttachment[];
  onAttachmentsChange: (attachments: OthersAttachment[]) => void;
  disabled?: boolean;
  hasError?: boolean;
}> = ({ blocks, onChange, attachments, onAttachmentsChange, disabled, hasError }) => {
  const [imgModalFor, setImgModalFor] = useState<string | null>(null);
  const [showFileModal, setShowFileModal] = useState(false);
  const [fmtState, setFmtState] = useState({ bold: false, italic: false, underline: false });

  const safeBlocks: OthersContentBlock[] = blocks.length > 0
    ? blocks
    : [{ id: generateId('cb-text'), type: 'text', value: '' }];

  const hasImage = safeBlocks.some(b => b.type === 'image');

  const updateCB = (id: string, patch: Partial<OthersContentBlock>) =>
    onChange(safeBlocks.map(b => b.id === id ? { ...b, ...patch } : b));

  const removeCB = (id: string) => {
    const next = safeBlocks.filter(b => b.id !== id);
    onChange(next.length > 0 ? next : [{ id: generateId('cb-text'), type: 'text', value: '' }]);
  };

  const addImageBlock = () => {
    if (hasImage) return;
    const cbId = generateId('cb-img');
    const afterId = generateId('cb-text');
    onChange([
      ...safeBlocks,
      { id: cbId, type: 'image', url: '', alignment: 'center', sizePercent: 60 },
      { id: afterId, type: 'text', value: '' },
    ]);
    setImgModalFor(cbId);
  };

  const trackFmt = () => setFmtState({
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
  });

  const applyFmt = (cmd: string) => { document.execCommand(cmd); trackFmt(); };

  const getFileIcon = (mime: string) => {
    if (mime.includes('pdf')) return '📄';
    if (mime.includes('word') || mime.includes('doc')) return '📝';
    if (mime.includes('excel') || mime.includes('sheet') || mime.includes('csv')) return '📊';
    if (mime.includes('powerpoint') || mime.includes('presentation')) return '📋';
    if (mime.startsWith('image/')) return '🖼️';
    return '📎';
  };

  return (
    <div style={{
      border: `1.5px solid ${hasError ? 'var(--lms-danger)' : 'var(--lms-border)'}`,
      borderRadius: 'var(--lms-radius-md)',
      background: 'var(--lms-bg-white)',
      overflow: 'visible',
    }}>
      {/* ── Toolbar ── */}
      {!disabled && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '6px 10px', borderBottom: '1.5px solid var(--lms-border)',
        }}>
          <button type="button" className="lms-fmt-btn" title="Bold"
            onMouseDown={e => { e.preventDefault(); applyFmt('bold'); }}
            style={{ fontWeight: 700, color: fmtState.bold ? 'var(--lms-orange)' : undefined, background: fmtState.bold ? 'var(--lms-orange-light)' : undefined }}>B</button>
          <button type="button" className="lms-fmt-btn" title="Italic"
            onMouseDown={e => { e.preventDefault(); applyFmt('italic'); }}
            style={{ fontStyle: 'italic', color: fmtState.italic ? 'var(--lms-orange)' : undefined, background: fmtState.italic ? 'var(--lms-orange-light)' : undefined }}>I</button>
          <button type="button" className="lms-fmt-btn" title="Underline"
            onMouseDown={e => { e.preventDefault(); applyFmt('underline'); }}
            style={{ textDecoration: 'underline', color: fmtState.underline ? 'var(--lms-orange)' : undefined, background: fmtState.underline ? 'var(--lms-orange-light)' : undefined }}>U</button>
          <div style={{ width: 1, height: 16, background: 'var(--lms-border)', margin: '0 3px' }} />
          <button type="button" className="lms-fmt-btn"
            title={hasImage ? 'Remove existing image first' : 'Insert image'}
            disabled={hasImage}
            style={{ opacity: hasImage ? 0.4 : 1, cursor: hasImage ? 'not-allowed' : 'pointer' }}
            onClick={addImageBlock}>
            <Image size={13} />
          </button>
          <button type="button" className="lms-fmt-btn" title="Attach file"
            onClick={() => setShowFileModal(true)}>
            <Paperclip size={13} />
          </button>
        </div>
      )}

      {/* ── Content block canvas ── */}
      <div style={{ padding: '10px 14px', overflow: 'visible' }}>
        {safeBlocks.map((cb, idx) => {
          if (cb.type === 'text') {
            return (
              <OthersTextBlock
                key={cb.id}
                cb={cb}
                isFirst={idx === 0}
                onUpdate={html => updateCB(cb.id, { value: html })}
                onFmtChange={trackFmt}
                disabled={disabled}
              />
            );
          }
          if (cb.type === 'image') {
            return (
              <div key={cb.id} style={{ overflow: 'visible', position: 'relative' }}>
                {cb.url ? (
                  <OthersResizableImage
                    url={cb.url}
                    alignment={cb.alignment || 'center'}
                    sizePercent={cb.sizePercent || 60}
                    disabled={disabled}
                    onUpdate={patch => updateCB(cb.id, patch)}
                    onRemove={() => removeCB(cb.id)}
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      height: 80, borderRadius: 8, margin: '8px 0',
                      border: '2px dashed var(--lms-border)', background: 'var(--lms-bg-surface)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setImgModalFor(cb.id)}
                  >
                    <span style={{ fontSize: 12, color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>
                      Click to select image
                    </span>
                  </div>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* ── Attachments ── */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 14px 10px' }}>
          {attachments.map((att, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 8px 4px 6px', borderRadius: 20,
              background: 'var(--lms-bg-surface2)', border: '1.5px solid var(--lms-border)',
              fontSize: 11, fontFamily: 'var(--lms-font)', fontWeight: 600,
              color: 'var(--lms-text-sec)', maxWidth: 200,
            }}>
              <span style={{ fontSize: 12 }}>{getFileIcon(att.mimeType)}</span>
              <a href={att.url} target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--lms-info)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
                {att.name}
              </a>
              {!disabled && (
                <button type="button" onClick={() => onAttachmentsChange(attachments.filter((_, i) => i !== idx))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', lineHeight: 1 }}>
                  <X style={{ width: 11, height: 11, color: 'var(--lms-text-hint)' }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Image upload modal ── */}
      {imgModalFor && (
        <OthersImageUploadModal
          onUpload={url => { updateCB(imgModalFor, { url }); setImgModalFor(null); }}
          onClose={() => {
            const cb = safeBlocks.find(b => b.id === imgModalFor);
            if (cb && !cb.url) removeCB(imgModalFor);
            setImgModalFor(null);
          }}
        />
      )}
      {showFileModal && (
        <OthersFileUploadModal
          onUpload={att => { onAttachmentsChange([...attachments, att]); setShowFileModal(false); }}
          onClose={() => setShowFileModal(false)}
        />
      )}
    </div>
  );
};

// ─── PREVIEW MODAL ────────────────────────────────────────────────────────────
// ─── PREVIEW MODAL ────────────────────────────────────────────────────────────
const OthersPreviewModal: React.FC<{
  isOpen: boolean;
  breadcrumbs: any;
  tabType: string;
  exerciseName: string;
  actionLabel: string;
  onClose: () => void;
  blocks: OthersQuestionBlock[];
  savedQuestionIds: Set<string>;
  currentIndex: number;
  onEdit: (idx: number) => void;
  onDeleteFromPreview: (block: OthersQuestionBlock, idx: number) => Promise<void>;
  scoringType: string;
  marksPerQuestion: number;
  maxMarks: number;
  totalQuestions: number;
  exerciseData?: any;
  levelBasedCounts: Record<'easy' | 'medium' | 'hard', number>;
  selectionLevelCounts: Record<'easy' | 'medium' | 'hard', number>;
  levelBasedMarks: Record<'easy' | 'medium' | 'hard', number>;
  sectionData?: any;
}> = ({
  isOpen,
  breadcrumbs,
  tabType,
  exerciseName,
  actionLabel,
  onClose,
  blocks,
  savedQuestionIds,
  currentIndex,
  onEdit,
  onDeleteFromPreview,
  scoringType,
  marksPerQuestion,
  maxMarks,
  totalQuestions,
  exerciseData,
  levelBasedCounts,
  selectionLevelCounts,
  levelBasedMarks,
  sectionData,
}) => {
    // Compute per-difficulty usage from the saved blocks inside the preview
    const previewGetDiffUsed = (d: 'easy' | 'medium' | 'hard') =>
      blocks.filter(b => (savedQuestionIds.has(b.id) || b.origin === 'db') && b.difficulty === d).length;
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ block: OthersQuestionBlock; idx: number } | null>(null);
    const [difficultyFilter, setDifficultyFilter] = useState<'' | 'easy' | 'medium' | 'hard'>('');
    const [sidebarTab, setSidebarTab] = useState<'details' | 'overview' | 'section' | null>(null);

    if (!isOpen) return null;

    const savedBlocks = blocks.filter(b => savedQuestionIds.has(b.id) || b.origin === 'db');
    const filteredBlocks = difficultyFilter
      ? savedBlocks.filter(b => b.difficulty === difficultyFilter)
      : savedBlocks;

    const availableDiffs = (['easy', 'medium', 'hard'] as const).filter(d =>
      savedBlocks.some(b => b.difficulty === d)
    );

    // Compute overall stats for sidebar
    const totalQAll = totalQuestions;
    const createdAll = savedBlocks.length;
    const remainingAll = Math.max(0, totalQAll - createdAll);
    const isExerciseGraded = maxMarks > 0;
    const usedMarksAll = scoringType === 'equalDistribution'
      ? savedBlocks.length * marksPerQuestion
      : (['easy', 'medium', 'hard'] as const).reduce((sum, d) =>
          sum + savedBlocks.filter(b => b.difficulty === d).length * (levelBasedMarks[d] || 0), 0);

    // Get exercise name for breadcrumb
    const displayExerciseName = exerciseData?.fullExerciseData?.exerciseInformation?.exerciseName
      || exerciseData?.exerciseName
      || exerciseName
      || 'Exercise';

    return (
      <>
      {/* Exercise Details Modal */}
      {sidebarTab === 'details' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSidebarTab(null); }}>
          <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-bg-surface)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <FileText size={14} style={{ color: 'var(--lms-text-sec)' }} />
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Details</span>
              </div>
              <button type="button" onClick={() => setSidebarTab(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                <X size={15} />
              </button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {exerciseData?.fullExerciseData?.exerciseInformation?.exerciseId && (
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Exercise ID</span>
                  <span className="lms-detail-value" style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--lms-violet)', fontSize: 11 }}>
                    {exerciseData.fullExerciseData.exerciseInformation.exerciseId}
                  </span>
                </div>
              )}
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Exercise Name</span>
                <span className="lms-detail-value" style={{ color: 'var(--lms-orange)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {displayExerciseName}
                </span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Exercise Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                  {exerciseData?.fullExerciseData?.exerciseType || 'others'}
                </span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Scoring Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11 }}>
                  {scoringType === 'equalDistribution' ? 'Equal Distribution' : scoringType === 'levelBased' ? 'Level Based' : 'Selection Level'}
                </span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Assessment Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11, fontWeight: 700, color: isExerciseGraded ? 'var(--lms-success)' : 'var(--lms-warning)' }}>
                  {isExerciseGraded ? 'Graded' : 'Non-Graded'}
                </span>
              </div>
              {(exerciseData?.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData?.fullExerciseData?.exerciseInformation?.duration) && (
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Duration</span>
                  <span className="lms-detail-value" style={{ fontSize: 11 }}>
                    {exerciseData?.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData?.fullExerciseData?.exerciseInformation?.duration} mins
                  </span>
                </div>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setSidebarTab(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                Close
              </button>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Overview</span>
              </div>
              <button type="button" onClick={() => setSidebarTab(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                <X size={15} />
              </button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '12px 16px', borderBottom: isExerciseGraded && maxMarks > 0 ? '1.5px solid var(--lms-border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Questions</span>
                </div>
                <div className="lms-marks-row">
                  <span className="lms-marks-label">Total Questions</span>
                  <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalQAll || '—'}</span>
                </div>
                <div className="lms-marks-row">
                  <span className="lms-marks-label">Created</span>
                  <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                    {createdAll}{totalQAll > 0 && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalQAll}</span>}
                  </span>
                </div>
                {totalQAll > 0 && (
                  <>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Remaining</span>
                      <span className="lms-marks-value" style={{ color: remainingAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingAll}</span>
                    </div>
                    <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                      <div className="lms-progress-fill" style={{ width: `${Math.min(100, (createdAll / totalQAll) * 100)}%`, background: remainingAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                    </div>
                  </>
                )}
                {availableDiffs.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {availableDiffs.map(d => {
                      const quota = scoringType === 'levelBased' ? levelBasedCounts[d] : (selectionLevelCounts[d] || 0);
                      const used = previewGetDiffUsed(d);
                      const rem = quota > 0 ? quota - used : 0;
                      const diffColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                      return (
                        <div key={d} className="lms-marks-row" style={{ paddingLeft: 8, borderLeft: `2px solid ${diffColor}`, marginBottom: 2 }}>
                          <span className="lms-marks-label" style={{ textTransform: 'capitalize', color: diffColor }}>{d}</span>
                          <span className="lms-marks-value" style={{ fontSize: 11 }}>
                            <span style={{ color: 'var(--lms-violet)' }}>{used}</span>
                            {quota > 0 && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }}>/{quota}</span>}
                            {quota > 0 && <span style={{ color: rem <= 0 ? 'var(--lms-success)' : 'var(--lms-text-muted)', fontSize: 10, marginLeft: 6, fontWeight: 500 }}>{rem <= 0 ? '✓' : `${rem} left`}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {isExerciseGraded && maxMarks > 0 && (
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Award size={12} style={{ color: 'var(--lms-violet)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-violet)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Marks</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total Marks</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{maxMarks}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Marks Used</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                      {usedMarksAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{maxMarks}</span>
                    </span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Remaining</span>
                    <span className="lms-marks-value" style={{ color: Math.max(0, maxMarks - usedMarksAll) === 0 ? 'var(--lms-success)' : 'var(--lms-text-main)', fontSize: 12 }}>
                      {Math.max(0, maxMarks - usedMarksAll)}
                    </span>
                  </div>
                  <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                    <div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedMarksAll / maxMarks) * 100)}%`, background: usedMarksAll >= maxMarks ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setSidebarTab(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section Details Modal */}
      {sidebarTab === 'section' && sectionData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSidebarTab(null); }}>
          <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 420, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-violet-bg)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Layers size={14} style={{ color: 'var(--lms-violet)' }} />
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Section Details</span>
              </div>
              <button type="button" onClick={() => setSidebarTab(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                <X size={15} />
              </button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--lms-text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Section</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lms-text-main)' }}>{sectionData.name || '—'}</div>
                {sectionData.description && (
                  <div style={{ fontSize: 11.5, color: 'var(--lms-text-sec)', marginTop: 4 }}>{sectionData.description}</div>
                )}
              </div>
              <div className="lms-marks-row">
                <span className="lms-marks-label">Order</span>
                <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.order || sectionData.sectionNumber || '—'}</span>
              </div>
              <div className="lms-marks-row">
                <span className="lms-marks-label">Exercise Type</span>
                <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{sectionData.exerciseType || '—'}</span>
              </div>
              <div className="lms-marks-row">
                <span className="lms-marks-label">Total Marks</span>
                <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{sectionData.totalMarks ?? '—'}</span>
              </div>
              {sectionData.difficulty && (
                <div className="lms-marks-row">
                  <span className="lms-marks-label">Difficulty</span>
                  <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12, textTransform: 'capitalize' }}>{sectionData.difficulty}</span>
                </div>
              )}
              {sectionData.mcqConfig && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px solid var(--lms-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lms-info)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>MCQ Config</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Questions</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.mcqConfig.generalQuestionCount ?? 0}</span>
                  </div>
                  {sectionData.mcqSectionMarks !== undefined && (
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">MCQ Marks</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{sectionData.mcqSectionMarks}</span>
                    </div>
                  )}
                </div>
              )}
              {sectionData.programmingConfig && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px solid var(--lms-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lms-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Programming Config</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Mode</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.programmingConfig.questionConfigType || '—'}</span>
                  </div>
                  {sectionData.programmingConfig.questionConfigType === 'general' ? (
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Questions</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.programmingConfig.generalQuestionCount ?? 0}</span>
                    </div>
                  ) : (
                    (['easy', 'medium', 'hard'] as const).map(level => (
                      <div key={level} className="lms-marks-row">
                        <span className="lms-marks-label" style={{ textTransform: 'capitalize' }}>{level}</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.programmingConfig.levelBasedCounts?.[level] || 0}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setSidebarTab(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="fixed inset-0 z-[150] flex items-center justify-center p-3"
        style={{ background: 'rgba(26,26,46,0.5)', backdropFilter: 'blur(3px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="flex flex-col overflow-hidden"
          style={{
            width: '96vw',
            maxWidth: 1300,
            height: '92vh',
            background: 'var(--lms-bg-white)',
            borderRadius: 'var(--lms-radius-lg)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            border: '1.5px solid var(--lms-border)'
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-3 flex-shrink-0"
            style={{ borderBottom: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)' }}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--lms-violet)', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}
              >
                <Eye className="h-4 w-4 text-white" />
              </div>
              <div className="h-5 w-px flex-shrink-0" style={{ background: 'var(--lms-border)' }} />
              <QuestionFormBreadcrumb
                breadcrumbs={breadcrumbs || []}
                tabType={tabType}
                exerciseName={displayExerciseName}
                actionLabel={`${actionLabel} - Preview`}
              />
              <div className="h-5 w-px flex-shrink-0 ml-2" style={{ background: 'var(--lms-border)' }} />

              {/* Difficulty Filter */}
              {availableDiffs.length > 1 && (
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <select
                    value={difficultyFilter}
                    onChange={e => setDifficultyFilter(e.target.value as any)}
                    style={{
                      fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600,
                      border: '1.5px solid var(--lms-border)', borderRadius: 20,
                      padding: '5px 28px 5px 12px', cursor: 'pointer',
                      outline: 'none', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)',
                      appearance: 'none', WebkitAppearance: 'none', minWidth: 140,
                    }}
                  >
                    <option value="">All difficulties</option>
                    {availableDiffs.map(d => (
                      <option key={d} value={d}>
                        {d.charAt(0).toUpperCase() + d.slice(1)} ({savedBlocks.filter(b => b.difficulty === d).length})
                      </option>
                    ))}
                  </select>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
                    style={{ position: 'absolute', right: 9, pointerEvents: 'none', width: 11, height: 11, color: 'var(--lms-text-sec)' }}>
                    <path d="M2 4l4 4 4-4" />
                  </svg>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 flex-shrink-0 ml-4">
              <button
                onClick={onClose}
                className="p-2 rounded-lg transition-colors"
                style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}
              >
                <X className="h-4 w-4" style={{ color: 'var(--lms-danger)' }} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 min-h-0" style={{ overflow: 'hidden' }}>
            {/* Left - Questions List */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
              {filteredBlocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20"
                  style={{ color: 'var(--lms-text-hint)' }}>
                  <Eye className="h-14 w-14 mb-4 opacity-15" />
                  <p className="text-sm font-semibold" style={{ fontFamily: 'var(--lms-font)' }}>
                    {difficultyFilter
                      ? `No ${difficultyFilter.charAt(0).toUpperCase() + difficultyFilter.slice(1)} questions`
                      : 'No saved questions yet'}
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
                    Save a question to see it here
                  </p>
                  {difficultyFilter && (
                    <button
                      onClick={() => setDifficultyFilter('')}
                      style={{
                        marginTop: 8, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', color: 'var(--lms-info)',
                        background: 'none', border: 'none',
                        fontFamily: 'var(--lms-font)',
                      }}
                    >
                      Show all
                    </button>
                  )}
                </div>
              ) : (
                filteredBlocks.map((block) => {
                  const realIdx = blocks.findIndex(b => b.id === block.id);
                  const qScore = scoringType === 'equalDistribution' ? marksPerQuestion : (Number(block.score) || 0);

                  return (
                    <div
                      key={block.id}
                      className="rounded-xl p-4 transition-all"
                      style={{
                        border: `1.5px solid ${realIdx === currentIndex ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                        background: realIdx === currentIndex ? 'var(--lms-orange-50)' : 'var(--lms-bg-white)',
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{
                            background: block.origin === 'db' ? 'var(--lms-success)' : 'var(--lms-orange)',
                            color: '#fff',
                            fontFamily: 'var(--lms-font)'
                          }}
                        >
                          {realIdx + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-sm font-bold truncate" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)' }}>
                              {block.title || 'Untitled Question'}
                            </h4>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{
                                background: block.questionType === 'notion' ? 'var(--lms-violet-bg)' : '#eff9f4',
                                color: block.questionType === 'notion' ? 'var(--lms-violet)' : '#16a34a',
                                fontFamily: 'var(--lms-font)'
                              }}
                            >
                              {block.questionType === 'notion' ? 'Notion' : 'File Upload'}
                            </span>
                            {block.difficulty && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                                style={{
                                  background: block.difficulty === 'easy' ? '#f0fdf4' :
                                    block.difficulty === 'medium' ? '#fffbeb' : '#fff5f5',
                                  color: block.difficulty === 'easy' ? '#16a34a' :
                                    block.difficulty === 'medium' ? '#d97706' : '#e53e3e',
                                  fontFamily: 'var(--lms-font)',
                                }}
                              >
                                {block.difficulty}
                              </span>
                            )}
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{
                                background: 'var(--lms-orange-50)',
                                color: 'var(--lms-orange)',
                                fontFamily: 'var(--lms-font)'
                              }}
                            >
                              {qScore} marks
                            </span>
                          </div>

                          {(() => {
                            const textCB = (block.questionContent || []).find(b => b.type === 'text' && b.value);
                            const imgCB = (block.questionContent || []).find(b => b.type === 'image' && b.url);
                            const plainText = textCB ? textCB.value!.replace(/<[^>]*>/g, '').trim() : '';
                            if (!plainText && !imgCB) return null;
                            return (
                              <div className="mb-2" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                                {plainText && (
                                  <p className="text-xs flex-1" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)', margin: 0 }}>
                                    {plainText.slice(0, 80)}{plainText.length > 80 ? '…' : ''}
                                  </p>
                                )}
                                {imgCB && (
                                  <img src={imgCB.url} alt=""
                                    style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, border: '1.5px solid var(--lms-border)', flexShrink: 0 }} />
                                )}
                              </div>
                            );
                          })()}

                          <div className="flex items-center gap-3 text-[10px]">
                            <span style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
                              Required: <strong>{block.isRequired ? 'Yes' : 'No'}</strong>
                            </span>
                            {block.questionType === 'file-upload' && (
                              <>
                                <span style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
                                  Max files: <strong>{block.fileUploadSettings.allowMultiple ? block.fileUploadSettings.maxFiles : '1'}</strong>
                                </span>
                                <span style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
                                  Max size: <strong>{block.fileUploadSettings.maxFileSizeMB} MB</strong>
                                </span>
                              </>
                            )}
                            {block.questionType === 'notion' && (
                              <span style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
                                Features: <strong>
                                  {Object.entries(block.notionSettings).filter(([, v]) => v).length} enabled
                                </strong>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <div className="lms-tooltip-wrap">
                            <button
                              onClick={() => onEdit(realIdx)}
                              className="p-2 rounded-lg transition-colors"
                              style={{ background: 'var(--lms-violet-bg)', border: '1.5px solid var(--lms-violet-bdr)' }}
                            >
                              <Edit2 className="h-3.5 w-3.5" style={{ color: 'var(--lms-violet)' }} />
                            </button>
                            <div className="lms-tooltip lms-tooltip-right">Edit question</div>
                          </div>
                          <div className="lms-tooltip-wrap">
                            <button
                              onClick={() => setDeleteConfirm({ block, idx: realIdx })}
                              className="p-2 rounded-lg transition-colors"
                              style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}
                            >
                              <Trash2 className="h-3.5 w-3.5" style={{ color: 'var(--lms-danger)' }} />
                            </button>
                            <div className="lms-tooltip lms-tooltip-right">Delete question</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Panel */}
            <div className="w-72 flex-shrink-0 flex flex-col lms-sidebar-scroll"
              style={{ borderLeft: '1.5px solid var(--lms-border)', overflow: 'hidden', minWidth: 0, background: 'var(--lms-bg-subtle)' }}>

              {/* Action buttons */}
              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1.5px solid var(--lms-border)', flexShrink: 0, background: 'var(--lms-bg-surface)' }}>
                <button
                  onClick={() => setSidebarTab('details')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-orange)'; b.style.background = 'var(--lms-orange-50)'; b.style.color = '#c85a30'; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-orange-50)', border: '1.5px solid var(--lms-orange-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={14} style={{ color: 'var(--lms-orange)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Details</div>
                    <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>ID, type, config, duration</div>
                  </div>
                  <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                </button>
                <button
                  onClick={() => setSidebarTab('overview')}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}
                  onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-info-bdr)'; b.style.background = 'var(--lms-info-bg)'; b.style.color = 'var(--lms-info)'; }}
                  onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
                >
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Overview</div>
                    <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>Quota, marks, progress</div>
                  </div>
                  <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                </button>
                {sectionData && (
                  <button
                    onClick={() => setSidebarTab('section')}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left', marginTop: 8 }}
                    onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-violet-bdr)'; b.style.background = 'var(--lms-violet-bg)'; b.style.color = 'var(--lms-violet)'; }}
                    onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
                  >
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-violet-bg)', border: '1.5px solid var(--lms-violet-bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Layers size={14} style={{ color: 'var(--lms-violet)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Section Details</div>
                      <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>{sectionData.name || 'Current section'}</div>
                    </div>
                    <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                  </button>
                )}
              </div>

              {/* Stats summary */}
              <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>
                {(() => {
                  const _isLevelBound = scoringType === 'levelBased' || scoringType === 'selectionLevel';
                  // Derive current diff from the question currently being previewed
                  const _diff = _isLevelBound
                    ? ((blocks[currentIndex]?.difficulty as 'easy' | 'medium' | 'hard') || null)
                    : null;
                  const _diffColor = _diff === 'easy' ? 'var(--lms-success)' : _diff === 'medium' ? 'var(--lms-warning)' : _diff === 'hard' ? 'var(--lms-danger)' : 'var(--lms-orange)';

                  // Questions — scoped to _diff when level-bound
                  const _quota = _isLevelBound && _diff
                    ? (scoringType === 'levelBased' ? (levelBasedCounts[_diff] || 0) : (selectionLevelCounts[_diff] || 0))
                    : totalQuestions;
                  const _created = _isLevelBound && _diff ? previewGetDiffUsed(_diff) : createdAll;
                  const _remaining = Math.max(0, _quota - _created);

                  // Marks — scoped to _diff when level-bound
                  const _mpq = _isLevelBound && _diff ? (levelBasedMarks[_diff] || 0) : marksPerQuestion;
                  const _totalMarksForScope = _isLevelBound && _diff ? _quota * _mpq : maxMarks;
                  const _usedMarks = _isLevelBound && _diff ? previewGetDiffUsed(_diff) * _mpq : usedMarksAll;
                  const _remainingMarks = Math.max(0, _totalMarksForScope - _usedMarks);
                  const _heading = _diff ? `${_diff.charAt(0).toUpperCase() + _diff.slice(1)} Questions` : 'Questions';
                  const _marksHeading = _diff ? `${_diff.charAt(0).toUpperCase() + _diff.slice(1)} Marks` : 'Marks';

                  return (
                    <>
                      {/* Questions */}
                      <div style={{ marginBottom: 14 }}>
                        <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                          <Hash size={12} style={{ color: _diff ? _diffColor : 'var(--lms-orange)' }} />
                          <span style={{ textTransform: 'capitalize', color: _diff ? _diffColor : undefined }}>{_heading}</span>
                        </div>
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Total</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{_quota}</span>
                        </div>
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Created</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                            {_created}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{_quota}</span>
                          </span>
                        </div>
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Remaining</span>
                          <span className="lms-marks-value" style={{ color: _remaining === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{_remaining}</span>
                        </div>
                        {_quota > 0 && (
                          <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                            <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_created / _quota) * 100)}%`, background: _remaining === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                          </div>
                        )}
                      </div>

                      {/* Marks */}
                      {isExerciseGraded && _totalMarksForScope > 0 && (
                        <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14 }}>
                          <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                            <Award size={12} style={{ color: _diff ? _diffColor : 'var(--lms-orange)' }} />
                            <span style={{ textTransform: 'capitalize', color: _diff ? _diffColor : undefined }}>{_marksHeading}</span>
                          </div>
                          <div className="lms-marks-row">
                            <span className="lms-marks-label">Per Question</span>
                            <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{_mpq}</span>
                          </div>
                          <div className="lms-marks-row">
                            <span className="lms-marks-label">{_diff ? 'Level Total' : 'Total'}</span>
                            <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{_totalMarksForScope}</span>
                          </div>
                          <div className="lms-marks-row">
                            <span className="lms-marks-label">Used</span>
                            <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                              {_usedMarks}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{_totalMarksForScope}</span>
                            </span>
                          </div>
                          <div className="lms-marks-row">
                            <span className="lms-marks-label">Remaining</span>
                            <span className="lms-marks-value" style={{ color: _remainingMarks <= 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>{_remainingMarks}</span>
                          </div>
                          <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                            <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_usedMarks / _totalMarksForScope) * 100)}%`, background: _usedMarks >= _totalMarksForScope ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="flex-shrink-0 px-5 py-3 flex items-center justify-between"
            style={{ borderTop: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)' }}
          >
            <span className="text-xs flex items-center gap-1.5"
              style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
              <Edit2 className="h-3 w-3" />Click the edit icon on any question to load it in the editor
            </span>
            <button onClick={onClose} className="lms-btn lms-btn-slate">Close Preview</button>
          </div>
        </div>

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div
            className="fixed inset-0 z-[210] flex items-center justify-center p-4"
            style={{ background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(2px)' }}
          >
            <div className="lms-modal" style={{ maxWidth: 400 }}>
              <div className="lms-modal-header">
                <div className="lms-modal-icon" style={{ background: 'var(--lms-danger-bg)' }}>
                  <Trash2 className="h-4 w-4" style={{ color: 'var(--lms-danger)' }} />
                </div>
                <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)' }}>
                  Delete Question
                </h3>
              </div>
              <div className="lms-modal-body">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
                  "{deleteConfirm.block.title || 'Untitled question'}"
                </p>
                <p className="text-[11px] font-medium"
                  style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                  This action cannot be undone.
                </p>
                <div className="flex items-center gap-2 pt-3">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 lms-btn lms-btn-slate justify-center"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const { block, idx } = deleteConfirm!;
                      setDeleteConfirm(null);
                      setDeletingId(block.id);
                      try {
                        await onDeleteFromPreview(block, idx);
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                    disabled={deletingId !== null}
                    className="flex-1 lms-btn justify-center"
                    style={{ background: 'var(--lms-danger)', color: '#fff', borderColor: 'transparent' }}
                  >
                    {deletingId === deleteConfirm.block.id ? (
                      <><Loader className="h-3.5 w-3.5 animate-spin" />Deleting…</>
                    ) : (
                      <><Trash2 className="h-3.5 w-3.5" />Delete</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
    );
  };

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
const OthersAddQuestionForm: React.FC<OthersAddQuestionFormProps> = ({
  breadcrumbs,
  exerciseData,
  tabType,
  initialData,
  isEditing = false,
  initialQuestionId,
  onClose,
  onSave,
  isSaving = false,
  saveProgress = 0,
  saveMessage = '',
  onEditExercise,
  sectionData,
  approval, approvalContext, onQueryResolved,
}) => {
  useEffect(() => { injectFonts(); }, []);

  const fullEx = exerciseData?.fullExerciseData;
  const progCfg = fullEx?.questionConfiguration?.othersQuestionConfiguration;
  const cfgType = progCfg?.questionConfigType || 'general';
  const info = fullEx?.exerciseInformation || {};
  const exerciseName = info?.exerciseName || exerciseData?.exerciseName || 'Exercise';
  const subcategory = fullEx?.subcategory || exerciseData?.subcategory || '';
  const exerciseDbId = fullEx?._id || exerciseData?.exerciseId || exerciseData?._id || '';
  const finishTriggeredRef = useRef(false);

  const rawScoreType = progCfg?.scoreSettings?.scoreType || 'equalDistribution';
  const scoringType: string =
    rawScoreType === 'evenMarks' || rawScoreType === 'equalDistribution'
      ? 'equalDistribution'
      : rawScoreType === 'levelBased' || rawScoreType === 'levelBasedMarks'
        ? 'levelBased'
        : rawScoreType === 'selectionLevel'
          ? 'selectionLevel'
          : 'equalDistribution';

  // ── Per-level question counts ──────────────────────────────────────────────
  const levelBasedCounts: Record<'easy' | 'medium' | 'hard', number> = {
    easy: progCfg?.levelBasedCounts?.easy || progCfg?.scoreSettings?.levelScoringConfiguration?.easy?.questionCount || 0,
    medium: progCfg?.levelBasedCounts?.medium || progCfg?.scoreSettings?.levelScoringConfiguration?.medium?.questionCount || 0,
    hard: progCfg?.levelBasedCounts?.hard || progCfg?.scoreSettings?.levelScoringConfiguration?.hard?.questionCount || 0,
  };
  const selectionLevelCounts: Record<'easy' | 'medium' | 'hard', number> = {
    easy: progCfg?.selectionLevelCounts?.easy || 0,
    medium: progCfg?.selectionLevelCounts?.medium || 0,
    hard: progCfg?.selectionLevelCounts?.hard || 0,
  };
  // Marks per difficulty — prefer levelBasedMarks, fall back to levelScoringConfiguration.marksPerQuestion
  const levelBasedMarks: Record<'easy' | 'medium' | 'hard', number> = {
    easy: progCfg?.scoreSettings?.levelBasedMarks?.easy
      || progCfg?.scoreSettings?.levelScoringConfiguration?.easy?.marksPerQuestion || 0,
    medium: progCfg?.scoreSettings?.levelBasedMarks?.medium
      || progCfg?.scoreSettings?.levelScoringConfiguration?.medium?.marksPerQuestion || 0,
    hard: progCfg?.scoreSettings?.levelBasedMarks?.hard
      || progCfg?.scoreSettings?.levelScoringConfiguration?.hard?.marksPerQuestion || 0,
  };

  const totalQuestions: number =
    scoringType === 'equalDistribution'
      ? (progCfg?.generalQuestionCount || 0)
      : scoringType === 'levelBased'
        ? (levelBasedCounts.easy + levelBasedCounts.medium + levelBasedCounts.hard)
        : scoringType === 'selectionLevel'
          ? (selectionLevelCounts.easy + selectionLevelCounts.medium + selectionLevelCounts.hard)
          : 0;

  const marksPerQuestion: number = scoringType === 'equalDistribution'
    ? (progCfg?.generalMarksPerQuestion || progCfg?.scoreSettings?.evenMarks || progCfg?.scoreSettings?.equalDistribution || 0)
    : 0;

  const maxMarks: number =
    scoringType === 'equalDistribution'
      ? totalQuestions * marksPerQuestion
      : scoringType === 'levelBased'
        ? (['easy', 'medium', 'hard'] as const).reduce((s, d) => s + levelBasedMarks[d] * levelBasedCounts[d], 0)
        : 0;

  const entityType = (() => {
    const m: Record<string, string> = {
      module: 'modules', modules: 'modules', submodule: 'submodules', submodules: 'submodules',
      topic: 'topics', topics: 'topics', subtopic: 'subtopics', subtopics: 'subtopics',
    };
    return (m[exerciseData?.nodeType?.toLowerCase()?.trim()] || 'topics') as any;
  })();

  // Safely extract a plain HTML string from a DB question's description field.
  // The field is typed as Mixed and may come back as:
  //   • a plain string  → use as-is
  //   • { html, text }  → prefer html, fallback text
  //   • undefined/null  → ''
  const extractDescriptionStr = (raw: any): string => {
    if (!raw) return '';
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object') {
      return (typeof raw.html === 'string' ? raw.html : '') ||
        (typeof raw.text === 'string' ? raw.text : '');
    }
    return '';
  };

  const [questionBlocks, setQuestionBlocks] = useState<OthersQuestionBlock[]>([makeDefaultBlock()]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedQuestionIds, setSavedQuestionIds] = useState<Set<string>>(new Set());
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const isSavingRef = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showExerciseSettings, setShowExerciseSettings] = useState(false);
  const [exerciseSettingsData, setExerciseSettingsData] = useState<any>(null);
  const [loadingExercise, setLoadingExercise] = useState(false);
  const [showDiffMenu, setShowDiffMenu] = useState(false);
  const [showDiffPicker, setShowDiffPicker] = useState(false);
  const [diffPickerMandatory, setDiffPickerMandatory] = useState(false);
  const [activeDifficulty, setActiveDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);
  const pickerShownOnMountRef = useRef(false);
  const [validationAttempted, setValidationAttempted] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, any>>({});
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [mainSidebarTab, setMainSidebarTab] = useState<'details' | 'overview' | 'section' | null>(null);

  const mainScrollRef = useRef<HTMLDivElement>(null);
  const isLevelBound = scoringType === 'levelBased' || scoringType === 'selectionLevel';

  // ── On mount: show mandatory difficulty picker for level-bound exercises ──────
  useEffect(() => {
    if (!isLevelBound || pickerShownOnMountRef.current) return;
    pickerShownOnMountRef.current = true;

    // Check if there are ANY existing saved questions with difficulty
    const existingQuestions = exerciseData?.fullExerciseData?.questions || [];
    const existingOthersQuestions = existingQuestions.filter((q: any) => q.questionType === 'others');
    const hasExistingWithDifficulty = existingOthersQuestions.some((q: any) => q.difficulty);

    // Check if current activeDifficulty is already set
    if (activeDifficulty || hasExistingWithDifficulty) {
      // Don't show popup - use existing difficulty
      return;
    }

    // Only show popup if NO questions exist and NO difficulty is set
    if (existingOthersQuestions.length === 0 && !activeDifficulty) {
      setDiffPickerMandatory(true);
      setShowDiffPicker(true);
    }
  }, []);

  useEffect(() => {
    const loadLatestData = () => {
      const existingQuestions = exerciseData?.fullExerciseData?.questions || [];
      const othersQuestions = existingQuestions.filter((q: any) => q.questionType === 'others');

      if (othersQuestions.length > 0) {
        console.log('🔄 Loading latest Others questions from exerciseData:', othersQuestions);

        const loadedBlocks: OthersQuestionBlock[] = othersQuestions.map((q: any, idx: number) => ({
          id: generateId('oq'),
          dbId: q._id,
          origin: 'db',
          isDirty: false,
          questionType: q.othersQuestionType || q.questionSubType || 'file-upload',
          title: typeof q.title === 'string' ? q.title : (q.title?.text || q.title?.html || ''),
          questionContent: Array.isArray(q.questionContent) && q.questionContent.length > 0
            ? q.questionContent
            : migrateDescription(
              extractDescriptionStr(q.othersDescription) || extractDescriptionStr(q.description),
              q.descriptionImageUrl, q.descriptionImageAlignment, q.descriptionImageSizePercent,
            ),
          difficulty: q.difficulty || '',
          score: q.score,
          isRequired: q.isRequired !== undefined ? q.isRequired : true,
          notionSettings: q.notionSettings || defaultNotionSettings(),
          fileUploadSettings: q.fileUploadSettings || defaultFileUploadSettings(),
          attachments: Array.isArray(q.attachments) ? q.attachments : [],
        }));

        if (!isEditing && !initialQuestionId) {
          const emptyBlock = makeDefaultBlock();
          loadedBlocks.push(emptyBlock);
        }

        setQuestionBlocks(loadedBlocks);
        setSavedQuestionIds(new Set(othersQuestions.map((q: any) => q._id)));

        if (initialQuestionId && isEditing) {
          const targetIndex = loadedBlocks.findIndex(b => b.dbId === initialQuestionId);
          if (targetIndex >= 0) {
            setCurrentIndex(targetIndex);
            // Set activeDifficulty from the target block
            const targetBlock = loadedBlocks[targetIndex];
            if (isLevelBound && targetBlock?.difficulty) {
              setActiveDifficulty(targetBlock.difficulty as 'easy' | 'medium' | 'hard');
            }
          }
        } else if (!isEditing && !initialQuestionId) {
          setCurrentIndex(loadedBlocks.length - 1);
          // Set activeDifficulty from the first saved question if not already set
          if (isLevelBound && !activeDifficulty) {
            const firstSaved = loadedBlocks.find(b => b.origin === 'db' && b.difficulty);
            if (firstSaved?.difficulty) {
              setActiveDifficulty(firstSaved.difficulty as 'easy' | 'medium' | 'hard');
            }
          }
        }
      }
    };

    loadLatestData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseData?.fullExerciseData?.questions, isEditing, initialQuestionId]);

  // Auto-assign scores on new blocks whenever the scoring config changes
  useEffect(() => {
    setQuestionBlocks(bs => bs.map(b => {
      if (b.origin !== 'new') return b;
      if (scoringType === 'equalDistribution' && marksPerQuestion > 0)
        return { ...b, score: marksPerQuestion };
      if (scoringType === 'levelBased' && b.difficulty) {
        const s = levelBasedMarks[b.difficulty as 'easy' | 'medium' | 'hard'] || 0;
        if (s > 0) return { ...b, score: s };
      }
      return b;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marksPerQuestion, scoringType, questionBlocks.length]);

  useEffect(() => {
    const loadExistingQuestion = () => {
      if (!isEditing) return;

      const existingQuestions = exerciseData?.fullExerciseData?.questions || [];
      const existingQuestion = existingQuestions.find(
        (q: any) => (q._id === initialQuestionId || q.id === initialQuestionId) && q.questionType === 'others'
      );

      if (existingQuestion) {
        console.log('📝 Loading from latest exerciseData.questions:', existingQuestion);

        const loadedBlock: OthersQuestionBlock = {
          id: generateId('oq'),
          dbId: existingQuestion._id || initialQuestionId,
          origin: 'db',
          isDirty: false,
          questionType: existingQuestion.othersQuestionType || existingQuestion.questionSubType || 'file-upload',
          title: typeof existingQuestion.title === 'string' ? existingQuestion.title : (existingQuestion.title?.text || existingQuestion.title?.html || ''),
          questionContent: Array.isArray(existingQuestion.questionContent) && existingQuestion.questionContent.length > 0
            ? existingQuestion.questionContent
            : migrateDescription(
              extractDescriptionStr(existingQuestion.othersDescription) || extractDescriptionStr(existingQuestion.description),
              existingQuestion.descriptionImageUrl, existingQuestion.descriptionImageAlignment, existingQuestion.descriptionImageSizePercent,
            ),
          difficulty: existingQuestion.difficulty || '',
          score: existingQuestion.score,
          isRequired: existingQuestion.isRequired !== undefined ? existingQuestion.isRequired : true,
          notionSettings: existingQuestion.notionSettings || defaultNotionSettings(),
          fileUploadSettings: existingQuestion.fileUploadSettings || defaultFileUploadSettings(),
          attachments: Array.isArray(existingQuestion.attachments) ? existingQuestion.attachments : [],
        };

        setQuestionBlocks([loadedBlock]);
        setSavedQuestionIds(new Set([loadedBlock.id]));
        setCurrentIndex(0);
        return;
      }

      if (initialData && Object.keys(initialData).length > 0) {
        console.log('📝 Loading from initialData:', initialData);

        const loadedBlock: OthersQuestionBlock = {
          id: generateId('oq'),
          dbId: initialData._id || initialQuestionId,
          origin: 'db',
          isDirty: false,
          questionType: initialData.othersQuestionType || initialData.questionSubType || 'file-upload',
          title: typeof initialData.title === 'string' ? initialData.title : (initialData.title?.text || initialData.title?.html || ''),
          questionContent: Array.isArray(initialData.questionContent) && initialData.questionContent.length > 0
            ? initialData.questionContent
            : migrateDescription(
              extractDescriptionStr(initialData.othersDescription) || extractDescriptionStr(initialData.description),
              initialData.descriptionImageUrl, initialData.descriptionImageAlignment, initialData.descriptionImageSizePercent,
            ),
          difficulty: initialData.difficulty || '',
          score: initialData.score,
          isRequired: initialData.isRequired !== undefined ? initialData.isRequired : true,
          notionSettings: initialData.notionSettings || defaultNotionSettings(),
          fileUploadSettings: initialData.fileUploadSettings || defaultFileUploadSettings(),
          attachments: Array.isArray(initialData.attachments) ? initialData.attachments : [],
        };

        setQuestionBlocks([loadedBlock]);
        setSavedQuestionIds(new Set([loadedBlock.id]));
        setCurrentIndex(0);
      }
    };

    loadExistingQuestion();
  }, [isEditing, initialData, initialQuestionId, exerciseData?.fullExerciseData?.questions]);

  const currentBlock = questionBlocks[currentIndex] ?? null;
  const isBlockSaved = useCallback((b: OthersQuestionBlock) =>
    b.origin === 'db' || savedQuestionIds.has(b.id), [savedQuestionIds]);

  const hasSavedQuestions = questionBlocks.some(b => savedQuestionIds.has(b.id) || b.origin === 'db');

  // ── Sync activeDifficulty → current new block ─────────────────────────────
  // When activeDifficulty changes and the current block is new/unsaved with no diff set,
  // auto-stamp it so the user doesn't need to manually pick it again.
  useEffect(() => {
    if (!isLevelBound || !activeDifficulty) return;
    const cb = questionBlocks[currentIndex];
    if (!cb) return;
    if (cb.origin === 'new' && !cb.difficulty) {
      setQuestionBlocks(bs => bs.map((b, i) =>
        i === currentIndex ? { ...b, difficulty: activeDifficulty } : b
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDifficulty, currentIndex]);

  // ── Per-difficulty limit helpers ───────────────────────────────────────────
  /** Returns the configured quota for a difficulty level (0 = not applicable). */
  const getDifficultyLimit = useCallback((diff: 'easy' | 'medium' | 'hard'): number => {
    if (scoringType === 'levelBased') return levelBasedCounts[diff];
    if (scoringType === 'selectionLevel') return selectionLevelCounts[diff];
    return 0; // equalDistribution has no per-diff limit
  }, [scoringType, levelBasedCounts, selectionLevelCounts]);

  /** How many saved questions exist for a given difficulty. */
  const getDifficultyUsedCount = useCallback((diff: 'easy' | 'medium' | 'hard'): number =>
    questionBlocks.filter(b => isBlockSaved(b) && b.difficulty === diff).length,
    [questionBlocks, isBlockSaved]);

  /** True when the difficulty has reached its limit and cannot accept more. */
  const isDifficultyAtLimit = useCallback((diff: 'easy' | 'medium' | 'hard'): boolean => {
    const limit = getDifficultyLimit(diff);
    if (limit <= 0) return false; // no limit configured
    return getDifficultyUsedCount(diff) >= limit;
  }, [getDifficultyLimit, getDifficultyUsedCount]);

  /**
   * Switch to a different difficulty:
   * - Reuses an existing unsaved block for that diff if one exists
   * - Otherwise creates a new block pre-set to that diff
   */

  // 🔥 Check if current block's difficulty quota is full and show popup
  // 🔥 Check if current block's difficulty quota is full and show popup

  /** Auto-score for a question based on the scoring type + difficulty. */
  const getAutoScore = useCallback((diff: 'easy' | 'medium' | 'hard' | ''): number => {
    if (scoringType === 'equalDistribution') return marksPerQuestion;
    if (scoringType === 'levelBased' && diff && diff !== '')
      return levelBasedMarks[diff as 'easy' | 'medium' | 'hard'];
    return 0;
  }, [scoringType, marksPerQuestion, levelBasedMarks]);

  const limitReached = (() => {
    if (scoringType === 'equalDistribution' && totalQuestions > 0)
      return questionBlocks.filter(isBlockSaved).length >= totalQuestions;

    if (scoringType === 'levelBased' || scoringType === 'selectionLevel') {
      return (['easy', 'medium', 'hard'] as const).every(d => {
        const limit = getDifficultyLimit(d);
        if (limit <= 0) return true; // no quota = already "full"
        return getDifficultyUsedCount(d) >= limit;
      });
    }
    return false;
  })();

  const isSaveAndFinish = (() => {
    const savedBlocks = questionBlocks.filter(isBlockSaved);
    const savedCount = savedBlocks.length;
    const currentIsSaved = currentBlock ? isBlockSaved(currentBlock) : false;

    if (scoringType === 'equalDistribution' && totalQuestions > 0) {
      return currentIsSaved
        ? savedCount >= totalQuestions
        : savedCount >= totalQuestions - 1;
    }

    if (scoringType === 'levelBased' || scoringType === 'selectionLevel') {
      const currentDiff = currentBlock?.difficulty as 'easy' | 'medium' | 'hard' | '' | undefined;
      return (['easy', 'medium', 'hard'] as const).every(d => {
        const limit = getDifficultyLimit(d);
        if (limit <= 0) return true;
        const used = getDifficultyUsedCount(d);
        // Count the current question if it will fill this diff's slot
        const addCurrent = (!currentIsSaved && currentDiff === d) ? 1 : 0;
        return used + addCurrent >= limit;
      });
    }

    return savedCount > 0;
  })();

  const updateBlock = useCallback((id: string, patch: Partial<OthersQuestionBlock>) => {
    setQuestionBlocks(bs => bs.map(b =>
      b.id === id ? { ...b, ...patch, isDirty: b.origin === 'db' ? true : b.isDirty } : b
    ));
  }, []);

  const goToIndex = useCallback((idx: number) => {
    if (idx < 0 || idx >= questionBlocks.length) return;
    const targetBlock = questionBlocks[idx];

    // Sync activeDifficulty badge to whatever difficulty the target block has
    if (isLevelBound && targetBlock?.difficulty) {
      setActiveDifficulty(targetBlock.difficulty as 'easy' | 'medium' | 'hard');
    }

    // 🔥 If target block has a difficulty that is full, clear it and show popup
    if (targetBlock && targetBlock.difficulty && targetBlock.origin !== 'db') {
      const diff = targetBlock.difficulty as 'easy' | 'medium' | 'hard';
      const limit = getDifficultyLimit(diff);
      const used = getDifficultyUsedCount(diff);

      if (limit > 0 && used >= limit) {
        // Clear the difficulty from this block
        updateBlock(targetBlock.id, { difficulty: '' });
        // Navigate to it first
        setCurrentIndex(idx);
        // Then show popup
        setTimeout(() => {
          setDiffPickerMandatory(true);
          setShowDiffPicker(true);
        }, 50);
        return;
      }
    }

    setCurrentIndex(idx);
    setShowDiffMenu(false);
    setTimeout(() => mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  }, [questionBlocks, isLevelBound, updateBlock, getDifficultyLimit, getDifficultyUsedCount]);


  useEffect(() => {
    if (!isLevelBound) return;
    if (!currentBlock) return;
    if (!currentBlock.difficulty) return;

    const diff = currentBlock.difficulty as 'easy' | 'medium' | 'hard';
    const limit = getDifficultyLimit(diff);
    const used = getDifficultyUsedCount(diff);

    // If this is a NEW/unsaved question AND its difficulty quota is already full
    if (currentBlock.origin !== 'db' && limit > 0 && used >= limit) {
      // 🔥 Clear the difficulty from current block first (so it doesn't stay as Easy)
      updateBlock(currentBlock.id, { difficulty: '' });

      // Show mandatory popup
      setDiffPickerMandatory(true);
      setShowDiffPicker(true);

      // Set error on the block
      setErrors(prev => ({
        ...prev,
        [currentBlock.id]: {
          ...prev[currentBlock.id],
          difficulty: `${diff.charAt(0).toUpperCase() + diff.slice(1)} quota is full (${used}/${limit}). Please select a different difficulty.`
        }
      }));
    }
  }, [currentBlock, isLevelBound, getDifficultyLimit, getDifficultyUsedCount, updateBlock]);


  const handlePrev = () => goToIndex(currentIndex - 1);
  const handleNext = () => goToIndex(currentIndex + 1);

  const validateBlock = useCallback((b: OthersQuestionBlock): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!b.questionType) e.questionType = 'Please select a question type';
    if (!b.title.trim()) e.title = 'Question title is required';
    if (!b.difficulty) e.difficulty = 'Please select a difficulty level';
    // Score validation only when user must supply it; auto-scored types skip this
    // (none of the three types require user-entered score currently)
    if (b.questionType === 'file-upload' && b.fileUploadSettings.allowedTypes.length === 0) {
      e.fileTypes = 'Select at least one supported file type';
    }
    // Guard: block save when difficulty is at limit (prevent over-selection)
    if ((scoringType === 'levelBased' || scoringType === 'selectionLevel') && b.difficulty) {
      const diff = b.difficulty as 'easy' | 'medium' | 'hard';
      const limit = getDifficultyLimit(diff);
      if (limit > 0) {
        // Count saved questions of this difficulty EXCLUDING this block itself
        const usedExcludingSelf = questionBlocks.filter(
          qb => isBlockSaved(qb) && qb.difficulty === diff && qb.id !== b.id
        ).length;
        if (usedExcludingSelf >= limit) {
          e.difficulty = `${diff.charAt(0).toUpperCase() + diff.slice(1)} limit reached (${limit}/${limit})`;
        }
      }
    }
    return e;
  }, [scoringType, getDifficultyLimit, questionBlocks, isBlockSaved]);
  const canCreateQuestionForDifficulty = useCallback((diff: 'easy' | 'medium' | 'hard'): boolean => {
    const limit = getDifficultyLimit(diff);
    if (limit <= 0) return true;
    const used = getDifficultyUsedCount(diff);
    return used < limit;
  }, [getDifficultyLimit, getDifficultyUsedCount]);
  const blockIsValid = useCallback((b: OthersQuestionBlock): boolean => Object.keys(validateBlock(b)).length === 0, [validateBlock]);
  const currentBlockIsValid = currentBlock ? blockIsValid(currentBlock) : false;

  const handleSaveCurrentQuestion = useCallback(async (goNext: boolean, finishAfter = false) => {
    if (isSavingRef.current || isSavingQuestion) return;
    if (finishAfter && finishTriggeredRef.current) return;
    if (!currentBlock) return;

    // 🔥 VALIDATION 1: Check if difficulty quota is already full (for NEW questions)
    if (currentBlock.difficulty && currentBlock.origin !== 'db') {
      const diff = currentBlock.difficulty as 'easy' | 'medium' | 'hard';
      const limit = getDifficultyLimit(diff);
      const used = getDifficultyUsedCount(diff);

      // If quota is full and this is a NEW question (not editing existing)
      if (limit > 0 && used >= limit) {
        // Show mandatory difficulty picker
        setDiffPickerMandatory(true);
        setShowDiffPicker(true);
        // Show error message
        setErrors(prev => ({
          ...prev,
          [currentBlock.id]: {
            ...prev[currentBlock.id],
            difficulty: `${diff.charAt(0).toUpperCase() + diff.slice(1)} quota is full (${used}/${limit}). Please select a different difficulty.`
          }
        }));
        return; // Block saving
      }
    }

    // Regular validation
    const errs = validateBlock(currentBlock);
    setValidationAttempted(prev => new Set(prev).add(currentBlock.id));
    setErrors(prev => ({ ...prev, [currentBlock.id]: errs }));
    if (Object.keys(errs).length > 0) return;

    if (finishAfter) {
      finishTriggeredRef.current = true;
    }

    isSavingRef.current = true;
    setIsSavingQuestion(true);

    try {
      // Derive authoritative score
      const diff = currentBlock.difficulty as 'easy' | 'medium' | 'hard' | '';
      const derivedScore: number =
        scoringType === 'equalDistribution'
          ? marksPerQuestion
          : scoringType === 'levelBased' && diff
            ? (levelBasedMarks[diff as 'easy' | 'medium' | 'hard'] || 0)
            : (Number(currentBlock.score) || 0);

      // Derive questionCount per level for backend consistency
      const derivedQuestionCounts =
        scoringType === 'levelBased'
          ? { easy: levelBasedCounts.easy, medium: levelBasedCounts.medium, hard: levelBasedCounts.hard }
          : scoringType === 'selectionLevel'
            ? { easy: selectionLevelCounts.easy, medium: selectionLevelCounts.medium, hard: selectionLevelCounts.hard }
            : undefined;

      const blocks = currentBlock.questionContent || [];
      const plainText = deriveDescription(blocks);
      const htmlText = blocks.filter(b => b.type === 'text').map(b => b.value || '').join('');
      // Separate image blocks (uploaded via image icon)
      const blockImages = blocks.filter(b => b.type === 'image' && b.url).map(b => ({
        url: b.url as string,
        alt: '',
        alignment: b.alignment || 'center',
        sizePercent: typeof b.sizePercent === 'number' ? b.sizePercent : 60,
      }));
      // Also extract <img src="..."> tags embedded inside text blocks (e.g. pasted images)
      const embeddedImages = blocks
        .filter(b => b.type === 'text' && b.value && b.value.includes('<img'))
        .flatMap(b => {
          try {
            const tmp = document.createElement('div');
            tmp.innerHTML = b.value || '';
            return Array.from(tmp.querySelectorAll('img'))
              .filter(img => img.src && img.src.startsWith('http'))
              .map(img => ({ url: img.src, alt: img.alt || '', alignment: 'center' as const, sizePercent: 60 }));
          } catch { return []; }
        });
      const imgUrls = [...blockImages, ...embeddedImages];
      const atts = currentBlock.attachments || [];

      const payload = {
        questionType: 'others',
        othersQuestionType: currentBlock.questionType,
        title: currentBlock.title.trim(),
        questionContent: blocks,
        description: plainText,
        // Keep othersDescription in sync so legacy readers still work
        othersDescription: {
          text: plainText,
          html: htmlText,
          images: imgUrls,
          attachments: atts,
        },
        difficulty: currentBlock.difficulty,
        score: derivedScore,
        isRequired: currentBlock.isRequired,
        notionSettings: currentBlock.questionType === 'notion' ? currentBlock.notionSettings : undefined,
        fileUploadSettings: currentBlock.questionType === 'file-upload' ? currentBlock.fileUploadSettings : undefined,
        attachments: atts,
        scoringType,
        ...(derivedQuestionCounts ? { questionCountPerLevel: derivedQuestionCounts } : {}),
        totalMarks: scoringType === 'equalDistribution'
          ? totalQuestions * marksPerQuestion
          : maxMarks,
        subcategory,
        tabType,
      };

      const exerciseId = exerciseDbId;
      let response: any;
      let savedId: string | undefined = currentBlock.dbId;

      if (currentBlock.origin === 'db' && currentBlock.dbId) {
        response = await questionApi.updateQuestion(entityType, exerciseData.nodeId, exerciseId, currentBlock.dbId, payload, tabType, subcategory);
      } else {
        response = await questionApi.addQuestion(entityType, exerciseData.nodeId, exerciseId, payload, tabType, subcategory);
        const newDbId = response?.data?.question?._id || response?.data?._id || response?._id;
        if (newDbId) {
          savedId = newDbId;
          setQuestionBlocks(bs => bs.map(b =>
            b.id === currentBlock.id ? { ...b, dbId: newDbId, origin: 'db' as const, isDirty: false } : b
          ));
        }
      }

      // 🔥 IMPORTANT: Immediately update savedQuestionIds BEFORE any navigation logic
      setSavedQuestionIds(prev => new Set(prev).add(currentBlock.id));
      setQuestionBlocks(bs => bs.map(b =>
        b.id === currentBlock.id ? { ...b, isDirty: false } : b
      ));

      if (finishAfter) {
        setTimeout(() => {
          onSave({ ...payload, _id: savedId, __skipApiCall: true });
        }, 100);
        return;
      }

      if (goNext) {
        if (isLevelBound) {
          const savedDiff = currentBlock.difficulty as 'easy' | 'medium' | 'hard' | '';
          if (savedDiff) {
            // 🔥 Calculate counts AFTER this save (including the current block)
            const diffLimit = getDifficultyLimit(savedDiff as 'easy' | 'medium' | 'hard');

            // Count saved questions of this difficulty INCLUDING this block
            const diffUsedAfterSave = questionBlocks.filter(
              qb => (savedQuestionIds.has(qb.id) || qb.id === currentBlock.id) && qb.difficulty === savedDiff
            ).length;

            const currentDiffNowFull = diffLimit > 0 && diffUsedAfterSave >= diffLimit;

            // Check other difficulties for remaining slots
            const diffs = ['easy', 'medium', 'hard'] as const;
            const remainingDiffs = diffs
              .filter(d => d !== savedDiff)
              .map(d => {
                const limit = getDifficultyLimit(d);
                const used = questionBlocks.filter(qb => savedQuestionIds.has(qb.id) && qb.difficulty === d).length;
                return { diff: d, remaining: Math.max(0, limit - used) };
              })
              .filter(({ remaining }) => remaining > 0);

            console.log('🔍 Debug Save:', {
              savedDiff,
              diffLimit,
              diffUsedAfterSave,
              currentDiffNowFull,
              remainingDiffs,
              savedQuestionIdsSize: savedQuestionIds.size,
              currentBlockId: currentBlock.id
            });

            if (currentDiffNowFull && remainingDiffs.length > 0) {
              // Show mandatory popup to pick next difficulty
              setDiffPickerMandatory(true);
              setShowDiffPicker(true);
              return; // Don't create new block or navigate
            } else if (!currentDiffNowFull) {
              // Same difficulty still has slots - add new block for same diff
              const fresh = makeDefaultBlock(savedDiff as 'easy' | 'medium' | 'hard');
              setQuestionBlocks(bs => [...bs, fresh]);
              setCurrentIndex(questionBlocks.length);
            } else {
              // currentDiffNowFull && no remaining diffs → all quotas full
              setCurrentIndex(Math.min(currentIndex + 1, questionBlocks.length - 1));
            }
          } else {
            // No difficulty set - just navigate
            if (currentIndex === questionBlocks.length - 1 && !limitReached) {
              const fresh = makeDefaultBlock();
              setQuestionBlocks(bs => [...bs, fresh]);
              setCurrentIndex(questionBlocks.length);
            } else {
              setCurrentIndex(currentIndex + 1);
            }
          }
        } else {
          // equalDistribution logic
          if (currentIndex === questionBlocks.length - 1 && !limitReached) {
            const fresh = makeDefaultBlock();
            setQuestionBlocks(bs => [...bs, fresh]);
            setCurrentIndex(questionBlocks.length);
          } else {
            setCurrentIndex(currentIndex + 1);
          }
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save';
      setErrors(prev => ({ ...prev, [currentBlock.id]: { ...prev[currentBlock.id], api: `Save failed: ${msg}` } }));
      if (finishAfter) {
        finishTriggeredRef.current = false;
      }
    } finally {
      isSavingRef.current = false;
      setIsSavingQuestion(false);
    }
  }, [currentBlock, validateBlock, currentIndex, questionBlocks, limitReached, isLevelBound,
    scoringType, marksPerQuestion, levelBasedMarks, levelBasedCounts, selectionLevelCounts,
    totalQuestions, maxMarks, exerciseDbId, entityType, exerciseData, subcategory, tabType, onSave,
    isSavingQuestion, getDifficultyLimit, getDifficultyUsedCount, savedQuestionIds,
    canCreateQuestionForDifficulty, finishTriggeredRef]);



  // mode='mandatory' → user is picking next diff after quota filled → always create new block
  // mode='switch'    → user manually switching → navigate to existing if full, else create/go to unsaved
  const handleDiffSwitch = useCallback((d: 'easy' | 'medium' | 'hard', mode: 'mandatory' | 'switch' = 'switch') => {
    setActiveDifficulty(d);
    setShowDiffPicker(false);
    setDiffPickerMandatory(false);

    const isFull = !canCreateQuestionForDifficulty(d);

    if (mode === 'mandatory') {
      // Quota can't be full here (disabled in popup), but guard anyway
      if (isFull) return;

      // Reuse any existing unsaved empty block instead of creating a duplicate
      const existingEmptyIdx = questionBlocks.findIndex(
        b => b.origin === 'new' && !savedQuestionIds.has(b.id) && !b.title.trim()
      );
      if (existingEmptyIdx >= 0) {
        // Update that block's difficulty and navigate to it
        setQuestionBlocks(bs => bs.map((b, i) =>
          i === existingEmptyIdx
            ? { ...b, difficulty: d, score: getAutoScore(d) }
            : b
        ));
        setCurrentIndex(existingEmptyIdx);
        return;
      }

      // No existing empty block — create a fresh one
      const fresh = makeDefaultBlock(d);
      const newIdx = questionBlocks.length;
      setQuestionBlocks(bs => [...bs, fresh]);
      setCurrentIndex(newIdx);
      return;
    }

    // ── Switch mode ──────────────────────────────────────────────────────────
    if (isFull) {
      // Navigate to the last existing block of this difficulty for editing
      const lastIdx = questionBlocks.reduce<number>((acc, b, i) => b.difficulty === d ? i : acc, -1);
      if (lastIdx >= 0) setCurrentIndex(lastIdx);
      return;
    }

    // Has remaining slots — reuse existing unsaved block of this diff, else create new
    const existingUnsavedIdx = questionBlocks.findIndex(
      b => b.difficulty === d && b.origin === 'new' && !savedQuestionIds.has(b.id)
    );
    if (existingUnsavedIdx >= 0) {
      setCurrentIndex(existingUnsavedIdx);
      return;
    }

    // Create new block
    const fresh = makeDefaultBlock(d);
    setQuestionBlocks(bs => [...bs, fresh]);
    setCurrentIndex(questionBlocks.length);
  }, [questionBlocks, canCreateQuestionForDifficulty, savedQuestionIds, getAutoScore]);

  const confirmDelete = useCallback(async () => {
    if (deleteTarget === null) return;
    const block = questionBlocks[deleteTarget];
    if (!block) return;
    setIsDeleting(true);
    try {
      if (block.origin === 'db' && block.dbId) {
        await questionApi.deleteQuestion(entityType, exerciseData.nodeId, exerciseDbId, block.dbId, tabType, subcategory);
      }
      const newBlocks = questionBlocks.filter((_, i) => i !== deleteTarget);
      if (newBlocks.length === 0) {
        const fresh = makeDefaultBlock();
        setQuestionBlocks([fresh]);
        setCurrentIndex(0);
      } else {
        setQuestionBlocks(newBlocks);
        setCurrentIndex(Math.min(deleteTarget, newBlocks.length - 1));
      }
      setSavedQuestionIds(prev => { const s = new Set(prev); s.delete(block.id); return s; });
    } catch (err: any) {
      console.error('Delete failed', err);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }, [deleteTarget, questionBlocks, entityType, exerciseData, exerciseDbId, tabType, subcategory]);

  const handleEditExercise = useCallback(async () => {
    // If parent (AddQuestionForm) owns the ExerciseSettings panel, delegate to it
    // so it can properly refresh exercise data and keep the form mounted.
    if (onEditExercise) { onEditExercise(); return; }

    setLoadingExercise(true);
    try {
      const res = await exerciseApi.getExerciseById(entityType, exerciseData.nodeId, exerciseDbId);
      setExerciseSettingsData(res?.data?.exercise || res?.data || fullEx);
    } catch { setExerciseSettingsData(fullEx); }
    finally { setLoadingExercise(false); setShowExerciseSettings(true); }
  }, [onEditExercise, entityType, exerciseData, exerciseDbId, fullEx]);

  const handleCloseClick = useCallback(() => {
    const unsaved = questionBlocks.filter(b => b.origin === 'new' && (b.title.trim() || deriveDescription(b.questionContent || []))).length;
    const dirty = questionBlocks.filter(b => b.isDirty).length;
    if (unsaved > 0 || dirty > 0) { setShowCloseConfirm(true); return; }
    onClose();
  }, [questionBlocks, onClose]);

  const blockErr = currentBlock ? (errors[currentBlock.id] || {}) : {};
  const isValidationAttempted = currentBlock ? validationAttempted.has(currentBlock.id) : false;

  const duplicateBlock = () => {
    if (!currentBlock) return;
    const dup: OthersQuestionBlock = { ...JSON.parse(JSON.stringify(currentBlock)), id: generateId('oq'), origin: 'new', isDirty: false, dbId: undefined };
    setQuestionBlocks(bs => { const n = [...bs]; n.splice(currentIndex + 1, 0, dup); return n; });
    setCurrentIndex(currentIndex + 1);
  };

  const clearBlock = () => {
    if (!currentBlock) return;
    const fresh = makeDefaultBlock();
    updateBlock(currentBlock.id, { questionType: fresh.questionType, title: fresh.title, questionContent: fresh.questionContent, difficulty: fresh.difficulty, score: fresh.score, notionSettings: fresh.notionSettings, fileUploadSettings: fresh.fileUploadSettings, attachments: [] });
    setErrors(prev => { const e = { ...prev }; delete e[currentBlock.id]; return e; });
    setValidationAttempted(prev => { const s = new Set(prev); s.delete(currentBlock.id); return s; });
    setSavedQuestionIds(prev => { const s = new Set(prev); s.delete(currentBlock.id); return s; });
  };

  const handlePreviewDelete = useCallback(async (block: OthersQuestionBlock, idx: number) => {
    setIsDeleting(true);
    try {
      if (block.origin === 'db' && block.dbId) {
        await questionApi.deleteQuestion(entityType, exerciseData.nodeId, exerciseDbId, block.dbId, tabType, subcategory);
      }
      const newBlocks = questionBlocks.filter((_, i) => i !== idx);
      if (newBlocks.length === 0) {
        const fresh = makeDefaultBlock();
        setQuestionBlocks([fresh]);
        setCurrentIndex(0);
      } else {
        setQuestionBlocks(newBlocks);
        setCurrentIndex(Math.min(idx, newBlocks.length - 1));
      }
      setSavedQuestionIds(prev => { const s = new Set(prev); s.delete(block.id); return s; });
    } catch (err: any) {
      console.error('Delete failed', err);
    } finally {
      setIsDeleting(false);
    }
  }, [questionBlocks, entityType, exerciseData, exerciseDbId, tabType, subcategory]);

  return (
    <div className="lms-font fixed inset-0 z-50 flex flex-col"
      style={{ background: 'var(--lms-bg-white)', fontFamily: 'var(--lms-font)' }}>

      {(() => {
        const effApproval = approval || initialData?.approval || null;
        let effContext: any = approvalContext || null;
        if (!effContext && initialData?._id && exerciseData) {
          const map: any = { module: 'modules', submodule: 'submodules', topic: 'topics', subtopic: 'subtopics' };
          const entityType = map[(exerciseData.nodeType || '').toLowerCase().trim()] || 'topics';
          const entityId = exerciseData.nodeId || '';
          const exerciseId = exerciseData.exerciseId || exerciseData.fullExerciseData?._id || exerciseData.id || '';
          const subcategory = exerciseData.subcategory || 'assignments';
          if (entityId && exerciseId) {
            effContext = {
              entityType,
              entityId: String(entityId),
              tabType: (tabType === 'We_Do' ? 'We_Do' : 'You_Do'),
              subcategory,
              exerciseId: String(exerciseId),
              questionId: String(initialData._id),
            };
          }
        }
        if (!effApproval || !effContext) return null;
        return (
          <div className="px-4 pt-2">
            <QuestionApprovalBanner
              approval={effApproval}
              context={effContext}
              onResolved={onQueryResolved || onClose}
            />
          </div>
        );
      })()}

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ background: 'var(--lms-bg-white)', borderBottom: '1.5px solid var(--lms-border)' }}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="lms-header-logo-mark">
            <FolderOpen className="h-4 w-4 text-white" />
          </div>
          <div className="h-5 w-px flex-shrink-0" style={{ background: 'var(--lms-border)' }} />
          <div className="min-w-0 flex-1">
            <QuestionFormBreadcrumb
              breadcrumbs={breadcrumbs || []} tabType={tabType}
              exerciseName={exerciseName}
              actionLabel={isEditing ? 'Edit Question' : 'Add Question'}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {loadingExercise && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg mr-2"
              style={{ color: 'var(--lms-orange)', background: 'var(--lms-orange-50)', border: '1.5px solid var(--lms-orange-100)', fontFamily: 'var(--lms-font)' }}>
              <Loader className="h-3 w-3 animate-spin" />Loading…
            </span>
          )}
          {questionBlocks.some(b => b.isDirty) && (
            <span className="lms-badge lms-badge-amber mr-2">
              <Edit2 className="h-2.5 w-2.5" />{questionBlocks.filter(b => b.isDirty).length} edited
            </span>
          )}
          <button onClick={handleEditExercise} className="lms-btn lms-btn-ghost-orange mr-2">
            <Settings2 className="h-3.5 w-3.5" />Edit Exercise
          </button>
          <button
            onClick={() => setShowPreviewModal(true)}
            disabled={!hasSavedQuestions}
            className="lms-btn lms-btn-ghost-violet mr-2"
            style={!hasSavedQuestions ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            <Eye className="h-3.5 w-3.5" />Preview
          </button>
          <button onClick={handleCloseClick}
            className="p-2 rounded-lg transition-colors cursor-pointer bg-red-100 hover:bg-red-200">
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0" style={{ overflow: 'hidden' }}>

        {/* ── EDITOR ── */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--lms-bg-white)', overflow: 'hidden' }}>
          <div ref={mainScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ scrollbarWidth: 'thin', overscrollBehavior: 'contain', background: 'var(--lms-bg-white)' }}>
            {currentBlock ? (
              <div className="flex flex-col min-h-full">

                {/* ── STICKY TOOLBAR ── */}
                <div className="px-5 pt-3 pb-2 flex-shrink-0 sticky top-0 z-50"
                  style={{ background: 'var(--lms-bg-white)', borderBottom: '1px solid var(--lms-border)' }}>
                  <div className="flex items-center gap-3 flex-wrap">

                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                      style={{ background: currentBlock.origin === 'db' ? 'var(--lms-success)' : 'var(--lms-orange)', fontFamily: 'var(--lms-font)' }}>
                      {currentIndex + 1}
                    </div>
                    {currentBlock.origin === 'db' && (
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${currentBlock.isDirty ? 'lms-badge-amber' : 'lms-badge-green'}`}
                        style={{ border: '1px solid' }}>
                        {currentBlock.isDirty ? 'edited' : 'saved'}
                      </span>
                    )}

                    <div className="flex-1" />
                    {/* 
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider flex-shrink-0" style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>Type</span>
                      {(() => {
                        const isActive = currentBlock.questionType === 'file-upload';
                        return (
                          <button type="button" onClick={() => { updateBlock(currentBlock.id, { questionType: 'file-upload' }); setErrors(prev => { const e = { ...prev }; if (e[currentBlock.id]) delete e[currentBlock.id].questionType; return e; }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                            style={{ border: `1.5px solid ${isActive ? '#bbf7d0' : 'var(--lms-border)'}`, background: isActive ? '#eff9f4' : 'var(--lms-bg-surface)', color: isActive ? '#16a34a' : 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all" style={{ borderColor: isActive ? '#16a34a' : 'var(--lms-border)', background: isActive ? '#16a34a' : 'transparent' }}>
                              {isActive && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                            </div>
                            <Upload className="h-3.5 w-3.5" />
                            <span>File Upload</span>
                          </button>
                        );
                      })()}
                      {(() => {
                        const isActive = currentBlock.questionType === 'notion';
                        return (
                          <button type="button" onClick={() => { updateBlock(currentBlock.id, { questionType: 'notion' }); setErrors(prev => { const e = { ...prev }; if (e[currentBlock.id]) delete e[currentBlock.id].questionType; return e; }); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
                            style={{ border: `1.5px solid ${isActive ? 'var(--lms-violet-bdr)' : 'var(--lms-border)'}`, background: isActive ? 'var(--lms-violet-bg)' : 'var(--lms-bg-surface)', color: isActive ? 'var(--lms-violet)' : 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all" style={{ borderColor: isActive ? 'var(--lms-violet)' : 'var(--lms-border)', background: isActive ? 'var(--lms-violet)' : 'transparent' }}>
                              {isActive && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                            </div>
                            <Type className="h-3.5 w-3.5" />
                            <span>Notion Type</span>
                          </button>
                        );
                      })()}
                    </div> */}

                    {/* ── DIFFICULTY: fixed badge (levelBound) OR dropdown (equalDistribution) ── */}
                    {isLevelBound ? (
                      /* Fixed badge showing active difficulty + Switch button */
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Fixed difficulty badge */}
                        {activeDifficulty ? (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px', borderRadius: 'var(--lms-radius-sm)',
                            background: diffConfig[activeDifficulty].bg,
                            border: `1.5px solid ${diffConfig[activeDifficulty].border}`,
                            fontFamily: 'var(--lms-font)',
                          }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: diffConfig[activeDifficulty].dot, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: diffConfig[activeDifficulty].color }}>
                              {diffConfig[activeDifficulty].label}
                            </span>
                            {/* quota mini counter */}
                            {(() => {
                              const lim = getDifficultyLimit(activeDifficulty);
                              const used = getDifficultyUsedCount(activeDifficulty);
                              return lim > 0 ? (
                                <span style={{
                                  fontSize: 10, fontWeight: 700, marginLeft: 2,
                                  color: diffConfig[activeDifficulty].color, opacity: 0.7,
                                }}>
                                  {used}/{lim}
                                </span>
                              ) : null;
                            })()}
                          </div>
                        ) : (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '4px 10px', borderRadius: 'var(--lms-radius-sm)',
                            background: 'var(--lms-bg-surface)',
                            border: `1.5px solid ${blockErr.difficulty && isValidationAttempted ? 'var(--lms-danger-bdr)' : 'var(--lms-border)'}`,
                            fontFamily: 'var(--lms-font)',
                          }}>
                            {blockErr.difficulty && isValidationAttempted
                              ? <AlertCircle style={{ width: 12, height: 12, color: 'var(--lms-danger)' }} />
                              : null}
                            <span style={{ fontSize: 12, fontWeight: 600, color: blockErr.difficulty && isValidationAttempted ? 'var(--lms-danger)' : 'var(--lms-text-hint)' }}>
                              No difficulty
                            </span>
                          </div>
                        )}
                        {/* Switch difficulty button */}
                        <button
                          type="button"
                          onClick={() => {
                            setDiffPickerMandatory(false);
                            setShowDiffPicker(true);
                          }}
                          title="Switch difficulty"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '4px 8px', borderRadius: 'var(--lms-radius-sm)',
                            border: '1.5px solid var(--lms-border)',
                            background: 'var(--lms-bg-surface)',
                            fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600,
                            color: 'var(--lms-text-sec)', cursor: 'pointer',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--lms-orange)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--lms-orange)';
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--lms-border)';
                            (e.currentTarget as HTMLElement).style.color = 'var(--lms-text-sec)';
                          }}
                        >
                          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 12, height: 12 }}>
                            <path d="M8 3v10M5 6l3-3 3 3M5 10l3 3 3-3" />
                          </svg>
                          Switch
                        </button>
                      </div>
                    ) : (
                      /* equalDistribution: keep the original editable dropdown */
                      <div className="relative flex-shrink-0">
                        <button onClick={e => { e.stopPropagation(); setShowDiffMenu(v => !v); }}
                          className={`lms-diff-underline-btn ${currentBlock.difficulty ? 'has-value' : ''}`}
                          style={{
                            color: currentBlock.difficulty ? diffConfig[currentBlock.difficulty].color
                              : blockErr.difficulty && isValidationAttempted ? 'var(--lms-danger)' : 'var(--lms-text-hint)',
                            borderBottomColor: currentBlock.difficulty ? diffConfig[currentBlock.difficulty].border
                              : blockErr.difficulty && isValidationAttempted ? 'var(--lms-danger-bdr)' : undefined,
                            minWidth: 100,
                          }}>
                          {currentBlock.difficulty ? (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: diffConfig[currentBlock.difficulty].dot, flexShrink: 0 }} />
                          ) : blockErr.difficulty && isValidationAttempted ? (
                            <AlertCircle style={{ width: 12, height: 12, color: 'var(--lms-danger)', flexShrink: 0 }} />
                          ) : null}
                          <span>{currentBlock.difficulty ? diffConfig[currentBlock.difficulty].label : 'Difficulty'}</span>
                          <svg className="diff-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6l4 4 4-4" /></svg>
                        </button>
                        {showDiffMenu && (
                          <div className="lms-diff-dropdown" onClick={e => e.stopPropagation()}>
                            {(['easy', 'medium', 'hard'] as const).map(level => {
                              const isCurrentSel = currentBlock.difficulty === level;
                              return (
                                <div
                                  key={level}
                                  onClick={() => {
                                    updateBlock(currentBlock.id, { difficulty: level });
                                    setShowDiffMenu(false);
                                    setErrors(prev => { const e = { ...prev }; if (e[currentBlock.id]) delete e[currentBlock.id].difficulty; return e; });
                                  }}
                                  className="lms-diff-dropdown-item"
                                  style={{ background: isCurrentSel ? `${diffConfig[level].border}30` : undefined }}>
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: diffConfig[level].dot, flexShrink: 0 }} />
                                  <span style={{ color: diffConfig[level].color, fontWeight: isCurrentSel ? 700 : 500, flex: 1 }}>
                                    {diffConfig[level].label}
                                  </span>
                                  {isCurrentSel && <Check style={{ width: 12, height: 12, color: diffConfig[level].color }} />}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Score display — read-only for auto-scored types */}
                    {scoringType === 'equalDistribution' && marksPerQuestion > 0 && (
                      <div className="flex items-baseline gap-1 flex-shrink-0"
                        style={{ borderBottom: '1.5px solid var(--lms-border)', padding: '4px 0' }}>
                        <span className="text-[13px] font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>{marksPerQuestion}</span>
                        <span className="text-[13px]" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>marks</span>
                      </div>
                    )}

                    {scoringType === 'levelBased' && currentBlock.difficulty && (
                      (() => {
                        const diff = currentBlock.difficulty as 'easy' | 'medium' | 'hard';
                        const m = levelBasedMarks[diff];
                        const diffCol = diffConfig[diff]?.color || 'var(--lms-text-main)';
                        return m > 0 ? (
                          <div className="flex items-baseline gap-1 flex-shrink-0"
                            style={{ borderBottom: `1.5px solid ${diffConfig[diff]?.border || 'var(--lms-border)'}`, padding: '4px 0' }}>
                            <span className="text-[13px] font-bold" style={{ color: diffCol, fontFamily: 'var(--lms-font)' }}>{m}</span>
                            <span className="text-[13px]" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>marks</span>
                          </div>
                        ) : null;
                      })()
                    )}
                  </div>
                </div>

                {/* ── CONTENT AREA ── */}
                <div className="px-5 pt-4 pb-6 flex flex-col gap-5">

                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider mb-2 block"
                      style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>
                      Question Title <span style={{ color: 'var(--lms-danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={currentBlock.title}
                      onChange={e => {
                        updateBlock(currentBlock.id, { title: e.target.value });
                        if (e.target.value.trim()) setErrors(prev => { const n = { ...prev }; if (n[currentBlock.id]) delete n[currentBlock.id].title; return n; });
                      }}
                      placeholder="Enter the question or task title…"
                      className="w-full text-[15px] font-medium"
                      style={{
                        background: 'transparent', border: 'none',
                        borderBottom: `1.5px solid ${blockErr.title && isValidationAttempted ? 'var(--lms-danger)' : 'var(--lms-border)'}`,
                        outline: 'none', padding: '4px 0 8px',
                        color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', fontWeight: 500,
                        caretColor: 'var(--lms-orange)',
                      }} />
                    {blockErr.title && isValidationAttempted && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />{blockErr.title}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider mb-2 block"
                      style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>
                      Description / Instructions
                    </label>
                    <OthersContentEditor
                      blocks={currentBlock.questionContent || []}
                      onChange={blocks => updateBlock(currentBlock.id, { questionContent: blocks })}
                      attachments={currentBlock.attachments || []}
                      onAttachmentsChange={atts => updateBlock(currentBlock.id, { attachments: atts })}
                      disabled={isSavingQuestion}
                    />
                  </div>

                  {/* ── Question Type Select ── */}
                  <div>
                    <label className="text-[10.5px] font-bold uppercase tracking-wider mb-2 block"
                      style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>
                      Question Type <span style={{ color: 'var(--lms-danger)' }}>*</span>
                    </label>
                    {(() => {
                      const [qtOpen, setQtOpen] = React.useState(false);
                      const qtRef = React.useRef<HTMLDivElement>(null);

                      React.useEffect(() => {
                        if (!qtOpen) return;
                        const handler = (e: MouseEvent) => {
                          if (qtRef.current && !qtRef.current.contains(e.target as Node)) setQtOpen(false);
                        };
                        document.addEventListener('mousedown', handler);
                        return () => document.removeEventListener('mousedown', handler);
                      }, [qtOpen]);

                      const qtOptions = [
                        {
                          value: 'file-upload',
                          label: 'File Upload',
                          icon: <Upload className="h-3 w-3" />,
                          color: '#16a34a',
                          bg: '#eff9f4',
                          border: '#bbf7d0',
                          iconBg: '#16a34a',
                        },
                        {
                          value: 'notion',
                          label: 'Notion Type',
                          icon: <Type className="h-3 w-3" />,
                          color: 'var(--lms-violet)',
                          bg: 'var(--lms-violet-bg)',
                          border: 'var(--lms-violet-bdr)',
                          iconBg: 'var(--lms-violet)',
                        },
                      ];

                      const selected = qtOptions.find(o => o.value === currentBlock.questionType);
                      const hasError = blockErr.questionType && isValidationAttempted;

                      return (
                        <div ref={qtRef} style={{ position: 'relative', display: 'inline-block', minWidth: 200 }}>
                          <button
                            type="button"
                            onClick={() => setQtOpen(v => !v)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 7,
                              padding: '5px 10px 5px 8px',
                              borderRadius: 8,
                              border: `1.5px solid ${hasError ? 'var(--lms-danger)' : qtOpen ? 'var(--lms-orange)' : selected ? selected.border : 'var(--lms-border)'}`,
                              background: qtOpen
                                ? 'var(--lms-orange-50)'
                                : selected
                                  ? selected.bg
                                  : 'var(--lms-bg-white)',
                              cursor: 'pointer',
                              fontFamily: 'var(--lms-font)',
                              transition: 'all 0.15s',
                              boxShadow: qtOpen ? '0 0 0 3px var(--lms-orange-light)' : 'none',
                              outline: 'none',
                            }}
                          >
                            {/* icon pill */}
                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 6,
                                background: selected
                                  ? selected.iconBg
                                  : hasError
                                    ? 'var(--lms-danger-bg)'
                                    : 'var(--lms-bg-surface2)',
                                color: selected ? '#fff' : hasError ? 'var(--lms-danger)' : 'var(--lms-text-hint)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {selected
                                ? selected.icon
                                : <FolderOpen style={{ width: 11, height: 11 }} />}
                            </div>

                            {/* label */}
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: selected ? 700 : 500,
                                color: hasError
                                  ? 'var(--lms-danger)'
                                  : selected
                                    ? selected.color
                                    : 'var(--lms-text-hint)',
                                fontFamily: 'var(--lms-font)',
                                flex: 1,
                                textAlign: 'left',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {selected ? selected.label : 'Select Question Type'}
                            </span>

                            {/* chevron */}
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke={hasError ? 'var(--lms-danger)' : qtOpen ? 'var(--lms-orange)' : 'var(--lms-text-hint)'}
                              strokeWidth={2.5}
                              style={{
                                width: 12,
                                height: 12,
                                flexShrink: 0,
                                transition: 'transform 0.15s',
                                transform: qtOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                              }}
                            >
                              <path d="M4 6l4 4 4-4" />
                            </svg>
                          </button>

                          {qtOpen && (
                            <div
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 5px)',
                                left: 0,
                                minWidth: '100%',
                                zIndex: 300,
                                background: 'var(--lms-bg-white)',
                                border: '1.5px solid var(--lms-border)',
                                borderRadius: 10,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
                                overflow: 'hidden',
                                animation: 'lms-fade-in 0.15s ease',
                              }}
                            >
                              {/* dropdown header hint */}
                              <div style={{
                                padding: '7px 12px 5px',
                                fontSize: 10,
                                fontWeight: 700,
                                color: 'var(--lms-text-hint)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.07em',
                                fontFamily: 'var(--lms-font)',
                                borderBottom: '1px solid var(--lms-border)',
                              }}>
                                Select Question Type
                              </div>

                              {qtOptions.map(opt => {
                                const isActive = currentBlock.questionType === opt.value;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      updateBlock(currentBlock.id, { questionType: opt.value as OthersQuestionType });
                                      setErrors(prev => {
                                        const n = { ...prev };
                                        if (n[currentBlock.id]) delete n[currentBlock.id].questionType;
                                        return n;
                                      });
                                      setQtOpen(false);
                                    }}
                                    style={{
                                      width: '100%',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '8px 12px',
                                      border: 'none',
                                      borderBottom: '1px solid var(--lms-border)',
                                      background: isActive ? opt.bg : 'transparent',
                                      cursor: 'pointer',
                                      fontFamily: 'var(--lms-font)',
                                      transition: 'background 0.1s',
                                      textAlign: 'left',
                                    }}
                                    onMouseEnter={e => {
                                      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--lms-bg-surface)';
                                    }}
                                    onMouseLeave={e => {
                                      if (!isActive) (e.currentTarget as HTMLElement).style.background = isActive ? opt.bg : 'transparent';
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 7,
                                        background: isActive ? opt.iconBg : 'var(--lms-bg-surface2)',
                                        color: isActive ? '#fff' : 'var(--lms-text-muted)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'all 0.15s',
                                      }}
                                    >
                                      {opt.icon}
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 12.5,
                                        fontWeight: isActive ? 700 : 500,
                                        color: isActive ? opt.color : 'var(--lms-text-main)',
                                        fontFamily: 'var(--lms-font)',
                                        flex: 1,
                                      }}
                                    >
                                      {opt.label}
                                    </span>
                                    {isActive && (
                                      <Check
                                        style={{ width: 13, height: 13, color: opt.color, flexShrink: 0 }}
                                        strokeWidth={3}
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {blockErr.questionType && isValidationAttempted && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                        <AlertCircle className="h-3 w-3 flex-shrink-0" />{blockErr.questionType}
                      </div>
                    )}
                  </div>

                  {currentBlock.questionType === 'file-upload' && (
                    <FileUploadSettingsPanel
                      settings={currentBlock.fileUploadSettings}
                      onChange={s => updateBlock(currentBlock.id, { fileUploadSettings: s })}
                      error={blockErr.fileTypes && isValidationAttempted ? blockErr.fileTypes : undefined}
                    />
                  )}
                  {/* {currentBlock.questionType === 'notion' && (
                    <NotionSettingsPanel
                      settings={currentBlock.notionSettings}
                      onChange={s => updateBlock(currentBlock.id, { notionSettings: s })}
                    />
                  )} */}

                  {/* {currentBlock.questionType === 'file-upload' && (
                    <FileUploadSettingsPanel
                      settings={currentBlock.fileUploadSettings}
                      onChange={s => updateBlock(currentBlock.id, { fileUploadSettings: s })}
                      error={blockErr.fileTypes && isValidationAttempted ? blockErr.fileTypes : undefined}
                    />
                  )} */}

                  <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)' }}>
                    <div>
                      <p className="text-[12.5px] font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Required Question</p>
                      <p className="text-[11px]" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>Students must answer this before submission</p>
                    </div>
                    <Toggle checked={currentBlock.isRequired} onChange={v => updateBlock(currentBlock.id, { isRequired: v })} />
                  </div>

                  {blockErr.api && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}>
                      <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--lms-danger)' }} />
                      <p className="text-[12px] font-semibold" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>{blockErr.api}</p>
                    </div>
                  )}

                  <div className="h-4 flex-shrink-0" />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-full" style={{ background: 'var(--lms-bg-white)' }}>
                <p className="text-sm" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>No question selected</p>
              </div>
            )}
          </div>

          {/* ── BOTTOM NAV ── */}
          <div className="flex-shrink-0 py-3"
            style={{ borderTop: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', paddingLeft: 32, paddingRight: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>

              <div />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <button onClick={handlePrev} disabled={currentIndex === 0} className="lms-nav-btn flex-shrink-0">
                  <ChevronLeft className="h-3.5 w-3.5" />Prev
                </button>
                <span className="text-[12px] font-medium flex-shrink-0"
                  style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--lms-orange)', fontWeight: 700 }}>{currentIndex + 1}</span>
                  <span style={{ color: 'var(--lms-text-hint)' }}> / </span>
                  {questionBlocks.length}
                </span>
                <button onClick={() => goToIndex(currentIndex + 1)}
                  disabled={currentIndex >= questionBlocks.length - 1}
                  className="lms-nav-btn flex-shrink-0">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>

                {currentBlock && !isSaveAndFinish && (
                  <button onClick={() => handleSaveCurrentQuestion(true)} disabled={isSavingQuestion}
                    className="lms-btn flex-shrink-0"
                    style={{ background: 'var(--lms-orange)', color: 'white', borderColor: 'transparent', boxShadow: '0 2px 8px var(--lms-orange-glow)', fontFamily: 'var(--lms-font)' }}>
                    {isSavingQuestion ? <><Loader className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><CloudUpload className="h-3.5 w-3.5" />Save &amp; Next</>}
                  </button>
                )}

                {/* Request Approve — only when this question has an open query */}
                {(() => {
                  const ap = approval || initialData?.approval || null;
                  const ctx = approvalContext || deriveApprovalContext(initialData, exerciseData, tabType);
                  if (!ap || !ctx) return null;
                  return (
                    <RequestApproveButton approval={ap} context={ctx} onResolved={onQueryResolved || onClose} />
                  );
                })()}

                {currentBlock && isSaveAndFinish && (
                  <>
                    <button onClick={() => handleSaveCurrentQuestion(false, false)} disabled={isSavingQuestion}
                      className="lms-btn flex-shrink-0"
                      style={{ background: 'var(--lms-orange)', color: 'white', borderColor: 'transparent', boxShadow: '0 2px 8px var(--lms-orange-glow)', fontFamily: 'var(--lms-font)' }}>
                      {isSavingQuestion ? <><Loader className="h-3.5 w-3.5 animate-spin" />Saving…</> : <><CloudUpload className="h-3.5 w-3.5" />Save</>}
                    </button>
                    <button
                      onClick={() => handleSaveCurrentQuestion(false, true)}
                      disabled={isSavingQuestion || finishTriggeredRef.current}
                      className="lms-btn flex-shrink-0"
                      style={{
                        background: 'var(--lms-success)', color: 'white',
                        borderColor: 'transparent',
                        boxShadow: '0 2px 8px rgba(22,163,74,0.25)',
                        fontFamily: 'var(--lms-font)',
                        opacity: (isSavingQuestion || finishTriggeredRef.current) ? 0.55 : 1,
                        cursor: (isSavingQuestion || finishTriggeredRef.current) ? 'not-allowed' : 'pointer',
                      }}>
                      {isSavingQuestion
                        ? <><Loader className="h-3.5 w-3.5 animate-spin" />Finishing…</>
                        : <><Check className="h-3.5 w-3.5" />Finish</>
                      }
                    </button>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>

                {currentBlock && (() => {
                  const isSaved = savedQuestionIds.has(currentBlock.id) && !currentBlock.isDirty;
                  const isDbClean = currentBlock.origin === 'db' && !currentBlock.isDirty;
                  return (isSaved || isDbClean) ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold flex-shrink-0"
                      style={{ color: 'var(--lms-success)', fontFamily: 'var(--lms-font)' }}>
                      <CheckCircle2 className="h-3.5 w-3.5" />Saved
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold flex-shrink-0"
                      style={{ color: 'var(--lms-warning)', fontFamily: 'var(--lms-font)' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lms-warning)', flexShrink: 0 }} />
                      Unsaved
                    </span>
                  );
                })()}

                <div className="w-px h-5 flex-shrink-0" style={{ background: 'var(--lms-border)' }} />

                {currentBlock && (
                  <label className="flex items-center gap-1.5 cursor-pointer select-none flex-shrink-0">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>Required</span>
                    <button type="button" onClick={() => updateBlock(currentBlock.id, { isRequired: !currentBlock.isRequired })}
                      className="relative rounded-full transition-colors flex-shrink-0"
                      style={{ width: 28, height: 16, background: currentBlock.isRequired ? 'var(--lms-orange)' : 'var(--lms-border-hover)' }}>
                      <div className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${currentBlock.isRequired ? 'translate-x-3' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                )}

                <div className="w-px h-5 flex-shrink-0" style={{ background: 'var(--lms-border)' }} />

                {currentBlock && questionBlocks.length > 1 && (
                  <div className="lms-tooltip-wrap flex-shrink-0">
                    <button onClick={() => setDeleteTarget(currentIndex)} className="lms-icon-btn lms-icon-btn-red">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="lms-tooltip lms-tooltip-right" style={{ background: 'var(--lms-danger)' }}>Delete question</div>
                  </div>
                )}

                {currentBlock && (
                  <div className="lms-tooltip-wrap flex-shrink-0">
                    <button onClick={duplicateBlock} disabled={!currentBlockIsValid}
                      className={`lms-icon-btn ${currentBlockIsValid ? 'lms-icon-btn-violet' : 'lms-icon-btn-slate'}`}
                      style={!currentBlockIsValid ? { cursor: 'not-allowed', opacity: 0.45 } : {}}>
                      <Copy className="h-4 w-4" />
                    </button>
                    <div className="lms-tooltip lms-tooltip-right">
                      {currentBlockIsValid ? 'Duplicate question' : 'Complete question first'}
                    </div>
                  </div>
                )}

                {currentBlock && (
                  <div className="lms-tooltip-wrap flex-shrink-0">
                    <button onClick={clearBlock} className="lms-icon-btn lms-icon-btn-slate">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                    <div className="lms-tooltip lms-tooltip-right">Clear question</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ width: 280, flexShrink: 0, borderLeft: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Two action buttons */}
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1.5px solid var(--lms-border)', flexShrink: 0, background: 'var(--lms-bg-surface)' }}>
            <button
              onClick={() => setMainSidebarTab('details')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-orange)'; b.style.background = 'var(--lms-orange-50)'; b.style.color = '#c85a30'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-orange-50)', border: '1.5px solid var(--lms-orange-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={14} style={{ color: 'var(--lms-orange)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Details</div>
                <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>ID, type, config, duration</div>
              </div>
              <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
            </button>
            <button
              onClick={() => setMainSidebarTab('overview')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-info-bdr)'; b.style.background = 'var(--lms-info-bg)'; b.style.color = 'var(--lms-info)'; }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
            >
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Exercise Overview</div>
                <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>Quota, marks, progress</div>
              </div>
              <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
            </button>
            {sectionData && (
              <button
                onClick={() => setMainSidebarTab('section')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left' }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-violet-bdr)'; b.style.background = 'var(--lms-violet-bg)'; b.style.color = 'var(--lms-violet)'; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = 'var(--lms-border)'; b.style.background = 'var(--lms-bg-white)'; b.style.color = 'var(--lms-text-sec)'; }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--lms-violet-bg)', border: '1.5px solid var(--lms-violet-bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Layers size={14} style={{ color: 'var(--lms-violet)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'inherit' }}>Section Details</div>
                  <div style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', marginTop: 1 }}>{sectionData.name || 'Current section'}</div>
                </div>
                <ChevronRight size={13} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
              </button>
            )}
          </div>

          {/* Stats summary */}
          {(() => {
            const _savedBlocks = questionBlocks.filter(isBlockSaved);
            const _isGraded = exerciseData?.fullExerciseData?.isGraded !== false;
            const _isLevelBound = scoringType === 'levelBased' || scoringType === 'selectionLevel';

            // For level-bound: scope to activeDifficulty only
            const _diff = _isLevelBound ? activeDifficulty : null;
            const _quota = _isLevelBound && _diff ? getDifficultyLimit(_diff) : totalQuestions;
            const _created = _isLevelBound && _diff ? getDifficultyUsedCount(_diff) : _savedBlocks.length;
            const _remaining = Math.max(0, _quota - _created);
            const _diffColor = _diff === 'easy' ? 'var(--lms-success)' : _diff === 'medium' ? 'var(--lms-warning)' : _diff === 'hard' ? 'var(--lms-danger)' : 'var(--lms-orange)';

            // Marks scoped to current diff
            const _mpq = _isLevelBound && _diff ? (levelBasedMarks[_diff] || 0) : marksPerQuestion;
            const _totalMarksForScope = _isLevelBound && _diff ? _quota * _mpq : maxMarks;
            const _usedMarks = _isLevelBound && _diff ? _created * _mpq : _savedBlocks.length * marksPerQuestion;
            const _remainingMarks = Math.max(0, _totalMarksForScope - _usedMarks);

            const _heading = _diff ? `${_diff.charAt(0).toUpperCase() + _diff.slice(1)} Questions` : 'Questions';
            const _marksHeading = _diff ? `${_diff.charAt(0).toUpperCase() + _diff.slice(1)} Marks` : 'Marks';

            return (
              <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>
                {/* Questions — scoped to current difficulty when level-bound */}
                <div style={{ marginBottom: 14 }}>
                  <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                    <Hash size={12} style={{ color: _diff ? _diffColor : 'var(--lms-orange)' }} />
                    <span style={{ textTransform: 'capitalize', color: _diff ? _diffColor : undefined }}>{_heading}</span>
                  </div>
                  {_isLevelBound && !_diff ? (
                    <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 4 }}>
                      Select a difficulty to begin
                    </p>
                  ) : (
                    <>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Total</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{_quota || '—'}</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Created</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                          {_created}{_quota > 0 && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{_quota}</span>}
                        </span>
                      </div>
                      {_quota > 0 && (
                        <>
                          <div className="lms-marks-row">
                            <span className="lms-marks-label">Remaining</span>
                            <span className="lms-marks-value" style={{ color: _remaining === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{_remaining}</span>
                          </div>
                          <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                            <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_created / _quota) * 100)}%`, background: _remaining === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Marks — scoped to current difficulty when level-bound */}
                {_isGraded && _totalMarksForScope > 0 && (!_isLevelBound || !!_diff) && (
                  <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14 }}>
                    <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                      <Award size={12} style={{ color: _diff ? _diffColor : 'var(--lms-orange)' }} />
                      <span style={{ textTransform: 'capitalize', color: _diff ? _diffColor : undefined }}>{_marksHeading}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Per Question</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{_mpq}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Total</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{_totalMarksForScope}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Used</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                        {_usedMarks}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{_totalMarksForScope}</span>
                      </span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Remaining</span>
                      <span className="lms-marks-value" style={{ color: _remainingMarks === 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>{_remainingMarks}</span>
                    </div>
                    <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                      <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_usedMarks / _totalMarksForScope) * 100)}%`, background: _usedMarks >= _totalMarksForScope ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Close button */}
          <div className="flex-shrink-0 px-3 py-2.5 flex items-center gap-2"
            style={{ borderTop: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)' }}>
            <button type="button" onClick={handleCloseClick}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all"
              style={{ background: 'var(--lms-bg-surface2)', color: 'var(--lms-text-sec)', border: '1.5px solid var(--lms-border)', fontFamily: 'var(--lms-font)' }}>
              <X className="h-3.5 w-3.5" />Close
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      <DeleteDialog
        isOpen={deleteTarget !== null}
        title={deleteTarget !== null ? (questionBlocks[deleteTarget]?.title || 'Untitled') : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
        isDeleting={isDeleting}
      />

      <CloseDialog
        isOpen={showCloseConfirm}
        unsavedCount={questionBlocks.filter(b => b.origin === 'new' && (b.title.trim() || deriveDescription(b.questionContent || []))).length + questionBlocks.filter(b => b.isDirty).length}
        onConfirm={() => { setShowCloseConfirm(false); onClose(); }}
        onCancel={() => setShowCloseConfirm(false)}
      />

      <OthersPreviewModal
        isOpen={showPreviewModal}
        breadcrumbs={breadcrumbs}
        tabType={tabType}
        exerciseName={exerciseName}
        actionLabel={isEditing ? 'Edit Question' : 'Add Question'}
        onClose={() => setShowPreviewModal(false)}
        blocks={questionBlocks}
        savedQuestionIds={savedQuestionIds}
        currentIndex={currentIndex}
        onEdit={(idx: number) => {
          setCurrentIndex(idx);
          setShowPreviewModal(false);
        }}
        onDeleteFromPreview={handlePreviewDelete}
        scoringType={scoringType}
        marksPerQuestion={marksPerQuestion}
        maxMarks={maxMarks}
        totalQuestions={totalQuestions}
        exerciseData={exerciseData}
        sectionData={sectionData}
        levelBasedCounts={levelBasedCounts}
        selectionLevelCounts={selectionLevelCounts}
        levelBasedMarks={levelBasedMarks}
      />

      {showExerciseSettings && (
        <ExerciseSettings
          hierarchyData={{
            CourseName: breadcrumbs?.[0]?.name || '', moduleName: breadcrumbs?.[1]?.name || '',
            submoduleName: breadcrumbs?.[2]?.name || '', topicName: breadcrumbs?.[3]?.name || '',
            subtopicName: breadcrumbs?.[4]?.name || '', nodeType: exerciseData?.nodeType || 'topic',
            level: breadcrumbs?.length || 0,
          }}
          nodeId={exerciseData?.nodeId || ''} nodeName={exerciseData?.nodeName || exerciseName || ''}
          nodeType={exerciseData?.nodeType || 'topic'} subcategory={subcategory}
          onSave={() => setShowExerciseSettings(false)} onClose={() => setShowExerciseSettings(false)}
          isEditing={true} tabType={tabType as 'I_Do' | 'We_Do' | 'You_Do'}
          initialData={exerciseSettingsData} exercise_Id={exerciseDbId}
        />
      )}

      {showDiffMenu && <div className="fixed inset-0 z-40" onClick={() => setShowDiffMenu(false)} />}

      {showDiffPicker && (() => {
        const diffs: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
        const allDiffs = diffs
          .map(d => {
            const total = getDifficultyLimit(d);
            // Inline count to avoid stale useCallback: directly read questionBlocks + savedQuestionIds
            const usedCount = questionBlocks.filter(
              b => (b.origin === 'db' || savedQuestionIds.has(b.id)) && b.difficulty === d
            ).length;
            return { diff: d, total, remaining: Math.max(0, total - usedCount) };
          })
          .filter(({ total }) => total > 0); // only show configured diffs

        // Mandatory mode → disable full diffs so user can only pick one with remaining slots
        // Switch mode → all diffs clickable (full ones navigate to existing for editing)
        const disabledDiffs = diffPickerMandatory
          ? new Set(allDiffs.filter(({ remaining }) => remaining === 0).map(({ diff }) => diff) as ('easy' | 'medium' | 'hard')[])
          : undefined;

        return (
          <DifficultyPickerModal
            availableDiffs={allDiffs}
            disabledDiffs={disabledDiffs}
            title={diffPickerMandatory ? 'Select Difficulty' : 'Switch Difficulty'}
            subtitle={
              diffPickerMandatory
                ? 'Current difficulty is full. Select another to continue adding questions.'
                : 'Switch to a different difficulty to edit or add questions.'
            }
            onSelect={d => {
              handleDiffSwitch(d, diffPickerMandatory ? 'mandatory' : 'switch');
            }}
            onClose={
              diffPickerMandatory
                ? undefined
                : () => {
                  setShowDiffPicker(false);
                  setDiffPickerMandatory(false);
                }
            }
          />
        );
      })()}

      {/* ── Exercise Details overlay modal ── */}
      {mainSidebarTab === 'details' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setMainSidebarTab(null); }}>
          <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-bg-surface)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <FileText size={14} style={{ color: 'var(--lms-text-sec)' }} />
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Details</span>
              </div>
              <button type="button" onClick={() => setMainSidebarTab(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                <X size={15} />
              </button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {exerciseData?.fullExerciseData?.exerciseInformation?.exerciseId && (
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Exercise ID</span>
                  <span className="lms-detail-value" style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--lms-violet)', fontSize: 11 }}>
                    {exerciseData.fullExerciseData.exerciseInformation.exerciseId}
                  </span>
                </div>
              )}
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Exercise Name</span>
                <span className="lms-detail-value" style={{ color: 'var(--lms-orange)', fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exerciseName}</span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Exercise Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                  {exerciseData?.fullExerciseData?.exerciseType || 'others'}
                </span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Scoring Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11 }}>
                  {scoringType === 'equalDistribution' ? 'Equal Distribution' : scoringType === 'levelBased' ? 'Level Based' : 'Selection Level'}
                </span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Assessment Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11, fontWeight: 700, color: exerciseData?.fullExerciseData?.isGraded !== false ? 'var(--lms-success)' : 'var(--lms-warning)' }}>
                  {exerciseData?.fullExerciseData?.isGraded !== false ? 'Graded' : 'Non-Graded'}
                </span>
              </div>
              {(exerciseData?.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData?.fullExerciseData?.exerciseInformation?.duration) && (
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Duration</span>
                  <span className="lms-detail-value" style={{ fontSize: 11 }}>
                    {exerciseData?.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData?.fullExerciseData?.exerciseInformation?.duration} mins
                  </span>
                </div>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setMainSidebarTab(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exercise Overview overlay modal ── */}
      {mainSidebarTab === 'overview' && (() => {
        const _savedBlocks = questionBlocks.filter(isBlockSaved);
        const _isGraded = exerciseData?.fullExerciseData?.isGraded !== false;
        const _isLevelBound = scoringType === 'levelBased' || scoringType === 'selectionLevel';
        const _configuredDiffs = (['easy', 'medium', 'hard'] as const).filter(d => getDifficultyLimit(d) > 0);
        const _used = scoringType === 'equalDistribution'
          ? _savedBlocks.length * marksPerQuestion
          : _configuredDiffs.reduce((s, d) => s + getDifficultyUsedCount(d) * (levelBasedMarks[d] || 0), 0);
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
            onClick={e => { if (e.target === e.currentTarget) setMainSidebarTab(null); }}>
            <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 420, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-info-bg)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Overview</span>
                </div>
                <button type="button" onClick={() => setMainSidebarTab(null)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                  <X size={15} />
                </button>
              </div>
              <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                {/* Questions */}
                <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--lms-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Questions</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalQuestions || '—'}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Created</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                      {_savedBlocks.length}{totalQuestions > 0 && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalQuestions}</span>}
                    </span>
                  </div>
                  {totalQuestions > 0 && (
                    <>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Remaining</span>
                        <span className="lms-marks-value" style={{ color: Math.max(0, totalQuestions - _savedBlocks.length) === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>
                          {Math.max(0, totalQuestions - _savedBlocks.length)}
                        </span>
                      </div>
                      <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                        <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_savedBlocks.length / totalQuestions) * 100)}%`, background: Math.max(0, totalQuestions - _savedBlocks.length) === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                      </div>
                    </>
                  )}
                  {_isLevelBound && _configuredDiffs.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {_configuredDiffs.map(d => {
                        const quota = getDifficultyLimit(d);
                        const created = getDifficultyUsedCount(d);
                        const rem = quota - created;
                        const diffColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                        return (
                          <div key={d} className="lms-marks-row" style={{ paddingLeft: 8, borderLeft: `2px solid ${diffColor}`, marginBottom: 2 }}>
                            <span className="lms-marks-label" style={{ textTransform: 'capitalize', color: diffColor }}>{d}</span>
                            <span className="lms-marks-value" style={{ fontSize: 11 }}>
                              <span style={{ color: 'var(--lms-violet)' }}>{created}</span>
                              <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }}>/{quota}</span>
                              <span style={{ color: rem <= 0 ? 'var(--lms-success)' : 'var(--lms-text-muted)', fontSize: 10, marginLeft: 6, fontWeight: 500 }}>
                                {rem <= 0 ? '✓' : `${rem} left`}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Marks */}
                {_isGraded && maxMarks > 0 && (
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Award size={12} style={{ color: 'var(--lms-violet)' }} />
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-violet)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Marks</span>
                    </div>
                    {scoringType === 'equalDistribution' && (
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Per Question</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{marksPerQuestion}</span>
                      </div>
                    )}
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Total Marks</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{maxMarks}</span>
                    </div>
                    {scoringType === 'levelBased' && _configuredDiffs.map(d => {
                      const dColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                      return (
                        <div key={d} className="lms-marks-row" style={{ paddingLeft: 8, borderLeft: `2px solid ${dColor}`, marginBottom: 2 }}>
                          <span className="lms-marks-label" style={{ textTransform: 'capitalize', color: dColor }}>{d}</span>
                          <span className="lms-marks-value" style={{ fontSize: 11, color: 'var(--lms-text-sec)' }}>{levelBasedMarks[d]} / q</span>
                        </div>
                      );
                    })}
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Marks Used</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                        {_used}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{maxMarks}</span>
                      </span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Remaining</span>
                      <span className="lms-marks-value" style={{ color: Math.max(0, maxMarks - _used) === 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>
                        {Math.max(0, maxMarks - _used)}
                      </span>
                    </div>
                    <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                      <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_used / maxMarks) * 100)}%`, background: _used >= maxMarks ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                <button type="button" onClick={() => setMainSidebarTab(null)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Section Details overlay modal (main form) ── */}
      {mainSidebarTab === 'section' && sectionData && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={e => { if (e.target === e.currentTarget) setMainSidebarTab(null); }}>
          <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 420, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-violet-bg)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Layers size={14} style={{ color: 'var(--lms-violet)' }} />
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Section Details</span>
              </div>
              <button type="button" onClick={() => setMainSidebarTab(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                <X size={15} />
              </button>
            </div>
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--lms-text-muted)', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Section</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--lms-text-main)' }}>{sectionData.name || '—'}</div>
                {sectionData.description && (
                  <div style={{ fontSize: 11.5, color: 'var(--lms-text-sec)', marginTop: 4 }}>{sectionData.description}</div>
                )}
              </div>
              <div className="lms-marks-row">
                <span className="lms-marks-label">Order</span>
                <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.order || sectionData.sectionNumber || '—'}</span>
              </div>
              <div className="lms-marks-row">
                <span className="lms-marks-label">Exercise Type</span>
                <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{sectionData.exerciseType || '—'}</span>
              </div>
              <div className="lms-marks-row">
                <span className="lms-marks-label">Total Marks</span>
                <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{sectionData.totalMarks ?? '—'}</span>
              </div>
              {sectionData.difficulty && (
                <div className="lms-marks-row">
                  <span className="lms-marks-label">Difficulty</span>
                  <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12, textTransform: 'capitalize' }}>{sectionData.difficulty}</span>
                </div>
              )}
              {sectionData.mcqConfig && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px solid var(--lms-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lms-info)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>MCQ Config</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Questions</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.mcqConfig.generalQuestionCount ?? 0}</span>
                  </div>
                </div>
              )}
              {sectionData.programmingConfig && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px solid var(--lms-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lms-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Programming Config</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Mode</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.programmingConfig.questionConfigType || '—'}</span>
                  </div>
                  {sectionData.programmingConfig.questionConfigType === 'general' ? (
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Questions</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.programmingConfig.generalQuestionCount ?? 0}</span>
                    </div>
                  ) : (
                    (['easy', 'medium', 'hard'] as const).map(level => (
                      <div key={level} className="lms-marks-row">
                        <span className="lms-marks-label" style={{ textTransform: 'capitalize' }}>{level}</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{sectionData.programmingConfig.levelBasedCounts?.[level] || 0}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <button type="button" onClick={() => setMainSidebarTab(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OthersAddQuestionForm;