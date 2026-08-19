import { getToken } from "@/lib/session";
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { QuestionApprovalBanner, RequestApproveButton, deriveApprovalContext } from '../QuestionApprovalBanner';
import {
  X, Code, Plus, Trash2, Save, Loader2, Loader, Check, AlertCircle,
  Eye, BookOpen, Clock, Database, Target, Award, CloudUpload,
  CheckCircle2, ArrowRight, Zap, Edit2, Info, Layers,
  ChevronLeft, ChevronRight, Flag, Sparkles, ChevronDown, ChevronUp,
  AlertTriangle, ArrowLeftRight, FileText, Settings, BarChart3,
  GraduationCap, Hash, Image, Play, Bold, Italic, Underline,


  ChevronDown as ChevronDownIcon,

  Library
} from 'lucide-react';
import QuestionBankSelector from './mcq/QuestionBankSelector';
import GenerateProgFamilyAI from './GenerateProgFamilyAI';
import DocQuestionPicker from './DocQuestionPicker';
import { parseProgrammingFile } from '@/app/lms/component/questionforms/parseQuestionsTxt';
import { toast } from 'react-toastify';
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
      /* ─── LMS DESIGN TOKENS ─────────────────────────────────────────────── */
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

      .prog-root { font-family: var(--lms-font) !important; }
      .prog-root .font-mono { font-family: ui-monospace, monospace; }

      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--lms-border); border-radius: 4px; }

      /* ─── BREADCRUMB ────────────────────────────────────────────────────── */
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

      /* ─── BUTTONS ───────────────────────────────────────────────────────── */
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
      .lms-btn-ghost-orange {
        background: var(--lms-bg-white); color: #c85a30;
        border-color: #f2b9a3;
      }
      .lms-btn-ghost-orange:hover { background: var(--lms-orange-50); }
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

      /* ─── ICON BUTTON ───────────────────────────────────────────────────── */
      .lms-icon-btn {
        width: 32px; height: 32px; border: 1.5px solid; border-radius: var(--lms-radius-sm);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.15s; background: none; flex-shrink: 0;
      }
      .lms-icon-btn-red { border-color: var(--lms-danger-bdr); background: var(--lms-danger-bg); color: var(--lms-danger); }
      .lms-icon-btn-red:hover { background: #fed7d7; }

      /* ─── HEADER LOGO ───────────────────────────────────────────────────── */
      .lms-header-logo-mark {
        width: 34px; height: 34px; background: var(--lms-orange);
        border-radius: 9px; display: flex; align-items: center;
        justify-content: center; flex-shrink: 0;
        box-shadow: 0 3px 10px var(--lms-orange-glow);
      }

      /* ─── BADGES ────────────────────────────────────────────────────────── */
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

      /* ─── PROGRESS BAR ──────────────────────────────────────────────────── */
      .lms-progress-bar { height: 6px; background: var(--lms-bg-surface2); border-radius: 3px; overflow: hidden; margin-top: 8px; }
      .lms-progress-fill { height: 100%; border-radius: 3px; background: var(--lms-orange); transition: width 0.4s; }

      /* ─── SIDEBAR ───────────────────────────────────────────────────────── */
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 3px 0;
}
  
.lms-detail-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--lms-text-sec);
  text-transform: none;
  letter-spacing: 0.01em;
  font-family: var(--lms-font);
}
    .lms-detail-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--lms-text-main);
  font-family: var(--lms-font);
}


/* ─── MODAL ─────────────────────────────────────────────────────────── */
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

      /* ─── SECTION LABEL ─────────────────────────────────────────────────── */
      .lms-section-label {
        font-size: 10.5px; font-weight: 700; color: var(--lms-text-main);
        text-transform: uppercase; letter-spacing: 0.07em;
        font-family: var(--lms-font); margin-bottom: 8px;
      }
      .lms-section-label.lms-label-err { color: var(--lms-danger) !important; }

      /* ─── DARK SIDEBAR SCROLLBAR ────────────────────────────────────────── */
      .lms-sidebar-scroll { scrollbar-width: thin; scrollbar-color: #8e8ea0 var(--lms-bg-surface2); }
      .lms-sidebar-scroll::-webkit-scrollbar { width: 6px; }
      .lms-sidebar-scroll::-webkit-scrollbar-track { background: var(--lms-bg-surface2); border-radius: 3px; }
      .lms-sidebar-scroll::-webkit-scrollbar-thumb { background: #8e8ea0; border-radius: 3px; }
      .lms-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #6b6b7e; }

      /* ─── SAVE BUTTON ───────────────────────────────────────────────────── */
      .lms-save-btn {
        flex: 1; padding: 8px 0; border-radius: var(--lms-radius-md);
        border: none; background: var(--lms-orange); color: white;
        font-family: var(--lms-font); font-size: 12.5px; font-weight: 700;
        cursor: pointer; transition: all 0.15s;
        box-shadow: 0 2px 8px var(--lms-orange-glow);
        display: flex; align-items: center; justify-content: center; gap: 6px;
      }
      .lms-save-btn:hover:not(:disabled) { background: var(--lms-orange-dark); box-shadow: 0 3px 12px rgba(242,119,87,0.35); }
      .lms-save-btn:disabled { background: #d4d4e2; box-shadow: none; cursor: not-allowed; }

      .lms-cancel-btn {
        padding: 8px 16px; border-radius: var(--lms-radius-md);
        border: 1.5px solid var(--lms-border); background: var(--lms-bg-white);
        color: var(--lms-text-sec); font-family: var(--lms-font);
        font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.15s;
      }
      .lms-cancel-btn:hover { background: var(--lms-bg-surface2); }

      /* ─── NAV BUTTONS ───────────────────────────────────────────────────── */
      .lms-nav-btn {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 7px 14px; border-radius: var(--lms-radius-md);
        font-family: var(--lms-font); font-size: 12.5px; font-weight: 600;
        border: 1.5px solid var(--lms-border); background: var(--lms-bg-white);
        color: var(--lms-text-sec); cursor: pointer; transition: all 0.15s;
      }
      .lms-nav-btn:hover:not(:disabled) { background: var(--lms-bg-surface); border-color: var(--lms-border-hover); }
      .lms-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .lms-nav-btn-primary {
        background: var(--lms-orange) !important; color: white !important;
        border-color: transparent !important;
        box-shadow: 0 2px 8px var(--lms-orange-glow);
      }
      .lms-nav-btn-primary:hover:not(:disabled) {
        background: var(--lms-orange-dark) !important;
        box-shadow: 0 3px 12px rgba(242,119,87,0.35) !important;
        transform: translateY(-1px);
      }

      /* ─── FORM INPUTS ───────────────────────────────────────────────────── */
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

      /* ─── FORMAT BUTTON ─────────────────────────────────────────────────── */
      .lms-fmt-btn {
        padding: 5px; border: none; background: none; cursor: pointer;
        color: var(--lms-text-muted); border-radius: 7px; transition: all 0.12s;
        display: flex; align-items: center; justify-content: center;
        font-size: 12px; font-family: var(--lms-font);
      }
      .lms-fmt-btn:hover { background: var(--lms-bg-surface2); color: var(--lms-text-main); }
      .lms-fmt-btn.active { background: var(--lms-orange-100); color: #c85a30; }

      /* ─── CONTENT EDITABLE PLACEHOLDER ──────────────────────────────────── */
      [data-placeholder]:empty:before {
        content: attr(data-placeholder);
        color: var(--lms-text-hint, #aaa);
        pointer-events: none;
        font-weight: 400;
      }

      /* ─── PROG CONTENT TOOLBAR ─────────────────────────────────────────────── */
      .prog-toolbar-btn {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 9px; border-radius: 6px; font-size: 11px; font-weight: 600;
        border: 1.5px solid var(--lms-border); background: var(--lms-bg-white);
        color: var(--lms-text-sec); cursor: pointer; transition: all 0.13s;
        font-family: var(--lms-font);
      }
      .prog-toolbar-btn:hover:not(:disabled) { border-color: var(--lms-orange); color: var(--lms-orange); background: var(--lms-orange-50); }
      .prog-toolbar-btn:disabled { opacity: 0.35; cursor: not-allowed; }

      /* ─── DIFF PILL (sidebar diff rows) ────────────────────────────────── */
      .lms-diff-row-active-easy   { background: #f0fdf4; border: 2px solid #bbf7d0; }
      .lms-diff-row-active-medium { background: #fffbeb; border: 2px solid #fde68a; }
      .lms-diff-row-active-hard   { background: #fff5f5; border: 2px solid #fed7d7; }
      .lms-diff-row-idle          { background: var(--lms-bg-surface); border: 1.5px solid var(--lms-border); cursor: pointer; }
      .lms-diff-row-idle:hover    { border-color: var(--lms-border-hover); background: var(--lms-bg-surface2); }

      @keyframes lms-slide-in-right {
        from { transform: translateX(110%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
      @keyframes lms-toast-slide-in {
        from { opacity: 0; transform: translateX(60px); }
        to   { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  };
})();

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProgrammingQuestionFormProps {
  exerciseData: any;
  tabType: string;
  initialData?: any;
  isEditing?: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<any>;
  onDeleteQuestion?: (questionId: string) => Promise<any>;
  isSaving: boolean;
  saveProgress: number;
  saveMessage: string;
  lockedDifficulty?: 'easy' | 'medium' | 'hard';
  onEditExercise?: () => void;
  sectionData?: any;
  // Bank questions to pre-load into the flow on open (review-then-save).
  initialBankQuestions?: any[];
  // Source tag stamped on initialBankQuestions ('scratch-bank' | 'thirdParty').
  // Set by the caller that opened the bank picker (Other Platform vs Question Bank).
  initialBankSource?: string;
  approval?: any;
  approvalContext?: { entityType: string; entityId: string; tabType: 'We_Do' | 'You_Do'; subcategory: string; exerciseId: string; questionId: string };
  onQueryResolved?: () => void;
  /**
   * When set, the form auto-opens the matching source modal on mount so the
   * teacher lands on the right authoring surface (AI generator / bank picker)
   * instead of a blank editor. 'manual' leaves the form open normally.
   *   'ai'         → opens the AI generator
   *   'bank'       → opens the Question Bank picker
   *   'thirdParty' → treated as bank for now (Third Party provider search
   *                   opens inside the bank/provider UI)
   *   'manual' | undefined → normal blank-form landing
   */
  autoOpenSource?: 'manual' | 'ai' | 'bank' | 'thirdParty';
}

interface TC {
  id: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  isSample: boolean;
  description: string;
}

interface FlowQuestion {
  __localId: string;
  _id?: string;
  title: string;                               // always plain string (server compat)
  description: any;                            // array of ProgContentBlock[] on server, or legacy object
  difficulty: string;
  score: number;
  testCases: any[];
  constraints: string[];
  hints: any[];
  timeLimit: number;
  memoryLimit: number;
  questionType: string;
  isSaved: boolean;
  isDirty?: boolean;
  isPreExisting?: boolean;
  // Per-question source tag: 'scratch-manual' | 'scratch-bank' | 'ai' | 'thirdParty:<providerId>' | null.
  // Survives to the DB via mkPayload → onSave → API.
  source?: string | null;
  // Section-based exercises: which section this question belongs to.
  sectionId?: string | null;
  // Origin id of the Question Bank doc this was imported from — null for
  // authored questions. Persisted so re-importing the same bank question is
  // rejected as a duplicate (client picker + server validateQuestionQuota).
  bankQuestionId?: string | null;
  // Per-question AI test case count (evaluationMethod 'ai' + perQuestion mode);
  // null = not set / legacy questions.
  aiTestCasesCount?: number | null;
  // Link questions: ONE external URL replaces the authored content — students
  // get the URL in an iframe instead of the question+compiler workspace.
  isLinkQuestion?: boolean;
  questionLink?: string;
}

type Diff = 'easy' | 'medium' | 'hard';

type ProgContentBlock =
  | { id: string; type: 'text'; value: string }
  | { id: string; type: 'image'; url: string; alignment: 'left' | 'center' | 'right'; sizePercent: number }
  | { id: string; type: 'code'; value: string; language: string; bgColor: string };

const mkProgTextBlock = (id?: string): ProgContentBlock => ({ id: id || `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'text', value: '' });
const mkProgCodeBlock = (id?: string): ProgContentBlock => ({ id: id || `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type: 'code', value: '', language: 'python', bgColor: '#f5f5f5' });

const descToBlocks = (description: any): ProgContentBlock[] => {
  if (!description) return [mkProgTextBlock()];

  const mkId = () =>
    `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const normalizeBlock = (b: any): ProgContentBlock => ({
    ...b,
    id: b.id || mkId(),
  });

  // 1. Pure array — ideal case (description IS the blocks array)
  if (Array.isArray(description) && description.length > 0) {
    return description.map(normalizeBlock);
  }

  // 2. contentBlocks array — standard stored shape
  if (
    description.contentBlocks &&
    Array.isArray(description.contentBlocks) &&
    description.contentBlocks.length > 0
  ) {
    return description.contentBlocks.map(normalizeBlock);
  }

  // 3. text is an array of blocks — the bug shape already in DB
  if (Array.isArray(description.text) && description.text.length > 0) {
    return description.text.map(normalizeBlock);
  }

  // 4. Legacy: text is a plain string + optional imageUrl
  const blocks: ProgContentBlock[] = [];
  const textVal =
    typeof description === 'string'
      ? description
      : typeof description.text === 'string'
        ? description.text
        : '';
  if (textVal.trim()) {
    blocks.push({ id: mkId(), type: 'text', value: textVal });
  }
  if (description.imageUrl) {
    blocks.push({
      id: `pb-img-${mkId()}`,
      type: 'image',
      url: description.imageUrl,
      alignment: description.imageAlignment || 'center',
      sizePercent: description.imageSizePercent || 60,
    });
  }
  return blocks.length > 0 ? blocks : [mkProgTextBlock()];
};

const blocksToDescription = (blocks: ProgContentBlock[]): any => {
  const textParts = blocks
    .filter(b => b.type === 'text')
    .map(b => (b as any).value)
    .join('\n')
    .trim();
  const imgBlock = blocks.find(b => b.type === 'image') as any;
  return {
    contentBlocks: blocks,          // ← always store full blocks here
    text: textParts,                // ← always a plain string, never array
    imageUrl: imgBlock?.url || null,
    imageAlignment: imgBlock?.alignment || 'left',
    imageSizePercent: imgBlock?.sizePercent || 100,
  };
};

// ─── Title blocks helpers ─────────────────────────────────────────────────────
const titleToBlocks = (title: any): ProgContentBlock[] => {
  if (Array.isArray(title) && title.length > 0) {
    return title.map((b: any) => ({ ...b, id: b.id || `tb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }));
  }
  if (typeof title === 'string' && title) {
    return [{ id: `tb-${Date.now()}`, type: 'text', value: title }];
  }
  return [mkProgTextBlock()];
};

const getTitleText = (blocks: ProgContentBlock[]): string => {
  const raw = blocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
  return raw.replace(/<[^>]*>/g, '').trim();
};

const fmtMark = (n: number): string => parseFloat(n.toFixed(2)).toString();

// ─── Difficulty Styles ──────────────────────────────────────────────────────────

const DS: Record<string, any> = {
  easy: {
    bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', dot: '#16a34a',
    bar: '#16a34a', solid: { background: '#16a34a', color: 'white' },
    pill: { background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #bbf7d0' },
    badgeBg: '#f0fdf4', badgeColor: '#16a34a', badgeBorder: '#bbf7d0',
  },
  medium: {
    bg: '#fffbeb', border: '#fde68a', text: '#d97706', dot: '#d97706',
    bar: '#d97706', solid: { background: '#d97706', color: 'white' },
    pill: { background: '#fffbeb', color: '#d97706', border: '1.5px solid #fde68a' },
    badgeBg: '#fffbeb', badgeColor: '#d97706', badgeBorder: '#fde68a',
  },
  hard: {
    bg: '#fff5f5', border: '#fed7d7', text: '#e53e3e', dot: '#e53e3e',
    bar: '#e53e3e', solid: { background: '#e53e3e', color: 'white' },
    pill: { background: '#fff5f5', color: '#e53e3e', border: '1.5px solid #fed7d7' },
    badgeBg: '#fff5f5', badgeColor: '#e53e3e', badgeBorder: '#fed7d7',
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

const mkLocalId = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const mkTC = (i: number): TC => ({
  id: `tc-${Date.now()}-${i}`,
  input: '',
  expectedOutput: '',
  isHidden: false,
  isSample: i === 0,
  description: `Test Case ${i + 1}`,
});

const dbQuestionToFlow = (q: any): FlowQuestion => {
  // Normalize description into clean ProgContentBlock[] array
  const normalizeDescription = (desc: any): ProgContentBlock[] => {
    const mkId = () => `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const normalizeBlock = (b: any): ProgContentBlock => ({ ...b, id: b.id || mkId() });

    if (!desc) return [mkProgTextBlock()];

    // Pure array
    if (Array.isArray(desc) && desc.length > 0) return desc.map(normalizeBlock);

    // contentBlocks array
    if (desc.contentBlocks && Array.isArray(desc.contentBlocks) && desc.contentBlocks.length > 0)
      return desc.contentBlocks.map(normalizeBlock);

    // text is array of blocks (bug shape in DB)
    if (Array.isArray(desc.text) && desc.text.length > 0)
      return desc.text.map(normalizeBlock);

    // Legacy: plain string + optional imageUrl
    const blocks: ProgContentBlock[] = [];
    const textVal = typeof desc === 'string' ? desc : (typeof desc.text === 'string' ? desc.text : '');
    if (textVal.trim()) blocks.push({ id: mkId(), type: 'text', value: textVal });
    if (desc.imageUrl) blocks.push({
      id: `pb-img-${mkId()}`,
      type: 'image',
      url: desc.imageUrl,
      alignment: desc.imageAlignment || 'center',
      sizePercent: desc.imageSizePercent || 60,
    });
    return blocks.length > 0 ? blocks : [mkProgTextBlock()];
  };

  return {
    __localId: q._id ? `db-${q._id}` : mkLocalId(),
    _id: q._id,
    title: Array.isArray(q.title)
      ? (q.title as any[]).filter((b: any) => b.type === 'text').map((b: any) => b.value).join(' ').trim()
      : (q.title || ''),
    description: normalizeDescription(q.description), // ← always a clean ProgContentBlock[]
    difficulty: q.difficulty || 'medium',
    score: q.score || q.points || 0,
    testCases: q.testCases || [],
    constraints: q.constraints || [],
    hints: q.hints || [],
    timeLimit: q.timeLimit || 2000,
    memoryLimit: q.memoryLimit || 256,
    questionType: 'programming',
    isSaved: true,
    isDirty: false,
    isPreExisting: true,
    isLinkQuestion: q.isLinkQuestion === true,
    questionLink: q.questionLink || '',
  };
};

// ─── Inline Inputs ─────────────────────────────────────────────────────────────

const TA: React.FC<{
  value: string; onChange: (v: string) => void; onBlur?: () => void;
  placeholder?: string; rows?: number; mono?: boolean; err?: boolean; disabled?: boolean;
}> = ({ value, onChange, onBlur, placeholder, rows = 3, mono, err, disabled }) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    onBlur={onBlur}
    placeholder={placeholder}
    rows={rows}
    disabled={disabled}
    className={`lms-textarea${mono ? ' mono' : ''}${err ? ' err' : ''}`}
  />
);

const NI: React.FC<{
  value: number; onChange: (v: number) => void; onBlur?: () => void;
  min?: number; max?: number; disabled?: boolean; cls?: string; err?: boolean;
}> = ({ value, onChange, onBlur, min = 0, max = 9999, disabled, cls = '', err }) => {
  const [v, sv] = useState(value === 0 ? '' : String(value));
  useEffect(() => { sv(value === 0 ? '' : String(value)); }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={v}
      disabled={disabled}
      onChange={e => {
        const r = e.target.value;
        if (/^\d*\.?\d*$/.test(r)) {
          sv(r);
          const n = parseFloat(r);
          if (!isNaN(n) && n >= min && n <= max) onChange(n);
          if (r === '') onChange(0);
        }
      }}
      onBlur={() => {
        const n = parseFloat(v);
        if (isNaN(n) || n < min) { sv(String(min)); onChange(min); }
        onBlur?.();
      }}
      className={`lms-input${err ? ' err' : ''} ${cls}`}
      style={{ width: cls.includes('w-') ? undefined : '100%' }}
    />
  );
};

// ─── IMAGE UPLOAD MODAL (for title image insertion) ───────────────────────────

const ProgImageUploadModal: React.FC<{
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

// ─── PROGRAMMING DESCRIPTION EDITOR ──────────────────────────────────────────

const PROG_CODE_THEMES = [
  { label: 'Light', bg: '#f5f5f5' }, { label: 'Dark', bg: '#1e1e1e' },
  { label: 'Dracula', bg: '#282a36' }, { label: 'Monokai', bg: '#272822' },
];

const ProgImageBlock: React.FC<{
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
    const onUp = (ev: MouseEvent) => {
      const parentW = containerRef.current?.parentElement?.clientWidth || 600;
      const dx = ev.clientX - startX.current;
      const delta = (dx / parentW) * 100;
      const newSize = Math.min(100, Math.max(10,
        side.current === 'right' ? startSize.current + delta : startSize.current - delta
      ));
      const final = Math.round(newSize);
      setLiveSize(final);
      onUpdate({ sizePercent: final } as any);
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const justify = block.alignment === 'left' ? 'flex-start' : block.alignment === 'right' ? 'flex-end' : 'center';

  // Same diagonal arrow as MCQ
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

        {/* Drag corner handles — exactly like MCQ */}
        {!disabled && <>
          <div style={{ ...cornerBase, top: -7, left: -7, cursor: 'nwse-resize' }} onMouseDown={e => onMouseDown(e, 'left')}><DiagArrow rotate={0} /></div>
          <div style={{ ...cornerBase, top: -7, right: -7, cursor: 'nesw-resize' }} onMouseDown={e => onMouseDown(e, 'right')}><DiagArrow rotate={90} /></div>
          <div style={{ ...cornerBase, bottom: -7, left: -7, cursor: 'nesw-resize' }} onMouseDown={e => onMouseDown(e, 'left')}><DiagArrow rotate={90} /></div>
          <div style={{ ...cornerBase, bottom: -7, right: -7, cursor: 'nwse-resize' }} onMouseDown={e => onMouseDown(e, 'right')}><DiagArrow rotate={0} /></div>
        </>}

        {/* Size badge while dragging */}
        {dragging && (
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: 'white', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, fontFamily: 'var(--lms-font)', pointerEvents: 'none', zIndex: 20 }}>
            {liveSize}%
          </div>
        )}

        {/* Alignment + remove on hover */}
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

const ProgCodeBlock: React.FC<{
  block: ProgContentBlock & { type: 'code' };
  onUpdate: (patch: Partial<ProgContentBlock>) => void;
  onRemove: () => void;
  disabled?: boolean;
}> = ({ block, onUpdate, onRemove, disabled }) => {
  const isDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(block.bgColor);
  const textColor = isDark ? '#d4d4d4' : '#1a1a2e';
  return (
    <div style={{ position: 'relative', borderRadius: 8, border: `1.5px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`, background: block.bgColor, overflow: 'hidden', margin: '4px 0' }}>
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderBottom: `1px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`, flexWrap: 'wrap' }}>
          {PROG_CODE_THEMES.map(t => (
            <button key={t.bg} type="button" onClick={() => onUpdate({ bgColor: t.bg } as any)}
              style={{ padding: '2px 8px', borderRadius: 4, border: `1.5px solid ${block.bgColor === t.bg ? 'var(--lms-orange)' : 'var(--lms-border)'}`, background: t.bg, color: ['#1e1e1e', '#282a36', '#272822'].includes(t.bg) ? '#d4d4d4' : '#1a1a2e', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>
              {t.label}
            </button>
          ))}
          <select value={block.language} onChange={e => onUpdate({ language: e.target.value } as any)}
            style={{ marginLeft: 'auto', fontFamily: 'ui-monospace,monospace', fontSize: 10, border: `1.5px solid ${isDark ? '#555' : 'var(--lms-border)'}`, borderRadius: 4, padding: '2px 6px', background: isDark ? '#2a2a2a' : 'white', color: isDark ? '#d4d4d4' : '#1a1a2e', cursor: 'pointer' }}>
            {['python', 'javascript', 'java', 'cpp', 'c', 'csharp', 'typescript', 'sql', 'bash', 'other'].map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <button type="button" onClick={onRemove}
            style={{ width: 22, height: 22, borderRadius: 4, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={11} />
          </button>
        </div>
      )}
      <textarea
        value={block.value}
        onChange={e => onUpdate({ value: e.target.value } as any)}
        disabled={disabled}
        placeholder="// Write code here…"
        rows={5}
        style={{ width: '100%', background: 'transparent', border: 'none', color: textColor, fontFamily: 'ui-monospace,monospace', fontSize: 12.5, lineHeight: 1.6, padding: '10px 12px', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
      />
    </div>
  );
};



// FIND and REPLACE entire ProgCodeBlock component with:

function highlightAutoP(code: string, bgColor: string): string {
  const dark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(bgColor);
  const kwC = dark ? '#569cd6' : '#0000ff';
  const strC = dark ? '#ce9178' : '#a31515';
  const cmtC = '#6a9955';
  const numC = dark ? '#b5cea8' : '#098658';
  const kw = [
    '#include', 'float', 'int', 'char', 'double', 'void', 'return',
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
    'function', 'let', 'const', 'var', 'class', 'import', 'export', 'default',
    'new', 'this', 'typeof', 'true', 'false', 'null', 'undefined', 'async', 'await',
    'printf', 'scanf', 'main',
  ];
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/(\/\/.*$)/gm, `<span style="color:${cmtC}">$1</span>`)
    .replace(/(\/\*[\s\S]*?\*\/)/g, `<span style="color:${cmtC}">$1</span>`)
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, `<span style="color:${strC}">$1</span>`)
    .replace(/\b(\d+\.?\d*)\b/g, `<span style="color:${numC}">$1</span>`)
    .replace(
      new RegExp(`\\b(${kw.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g'),
      `<span style="color:${kwC};font-weight:600">$1</span>`
    );
}

const PROG_CODE_THEMES_MCQ = [
  { label: 'Light', bg: '#f5f5f5' },
  { label: 'Dark', bg: '#1e1e1e' },
  { label: 'Dracula', bg: '#282a36' },
  { label: 'Monokai', bg: '#272822' },
  { label: 'Solarized', bg: '#fdf6e3' },
  { label: 'Nord', bg: '#2e3440' },
];

const ProgCodeBlockMCQ: React.FC<{
  block: ProgContentBlock & { type: 'code' };
  onUpdate: (patch: Partial<ProgContentBlock>) => void;
  onRemove: () => void;
  disabled?: boolean;
}> = ({ block, onUpdate, onRemove, disabled }) => {
  const [editing, setEditing] = React.useState(true);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const savedWidth = (block as any).width;
  const savedHeight = (block as any).height;
  const [liveWidth, setLiveWidth] = React.useState<number | undefined>(savedWidth);
  const [liveHeight, setLiveHeight] = React.useState<number | undefined>(savedHeight);
  const bg = block.bgColor || '#f5f5f5';
  const isDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(bg);
  const textColor = isDark ? '#d4d4d4' : '#1a1a2e';

  return (
    <div
      className="relative my-2 group/code"
      style={{
        borderRadius: 8,
        border: `1.5px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`,
        background: bg,
        overflow: 'visible',
        display: 'inline-block',
        width: liveWidth ? `${liveWidth}px` : 'fit-content',
        minWidth: 200,
        maxWidth: 'none',
        position: 'relative',
      }}
    >
      {/* Remove button */}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            position: 'absolute', top: 7, right: 10, zIndex: 10,
            background: isDark ? '#ffffff' : '#eb0303',
            border: `1px solid ${isDark ? '#444' : '#d0d0d0'}`,
            borderRadius: 6, padding: '3px 6px', fontSize: 10,
            color: isDark ? '#000000' : '#ffffff',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            opacity: 0, transition: 'opacity 0.15s',
          }}
          className="group-hover/code:!opacity-100"
        >
          <X size={10} />
        </button>
      )}

      {/* Code area */}
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
                const w = textareaRef.current.offsetWidth;
                const h = textareaRef.current.offsetHeight;
                setLiveWidth(w); setLiveHeight(h);
                onUpdate({ width: w, height: h } as any);
              }
              setEditing(false);
            }}
            placeholder="// Write your code here…"
            spellCheck={false}
            autoFocus
            style={{
              display: 'block',
              width: liveWidth ? `${liveWidth}px` : '400px',
              height: liveHeight ? `${liveHeight}px` : '120px',
              minWidth: 200, background: 'transparent', border: 'none',
              outline: 'none', padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
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
        <pre
          onClick={() => { if (!disabled) setEditing(true); }}
          style={{
            margin: 0, padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            color: textColor, whiteSpace: 'pre', cursor: disabled ? 'default' : 'text',
            display: 'block',
            width: savedWidth ? `${savedWidth}px` : '100%',
            height: savedHeight ? `${savedHeight}px` : undefined,
            minWidth: 200, background: 'transparent', overflowX: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: highlightAutoP(block.value || '', bg) }}
        />
      )}

      {/* Bottom toolbar */}
      {!disabled && (
        <div
          className="group-hover/code:!opacity-100"
          style={{
            opacity: 0, transition: 'opacity 0.15s',
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px',
            borderTop: `1px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`,
            background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
          }}
        >
          {PROG_CODE_THEMES_MCQ.map(theme => (
            <button
              key={theme.label}
              type="button"
              title={theme.label}
              onClick={() => onUpdate({ bgColor: theme.bg } as any)}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: theme.bg,
                border: bg === theme.bg ? '2px solid var(--lms-orange)' : `2px solid ${isDark ? '#555' : '#d0d0d0'}`,
                cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            />
          ))}
          <div style={{ width: 1, height: 12, background: isDark ? '#444' : '#e0e0e0', margin: '0 2px' }} />
          <input
            type="text"
            value={block.language || ''}
            onChange={e => onUpdate({ language: e.target.value } as any)}
            style={{
              fontSize: 10, fontFamily: 'monospace',
              color: isDark ? '#888' : '#999',
              background: 'transparent', border: 'none', outline: 'none', width: 70,
            }}
          />
        </div>
      )}
    </div>
  );
};



const ProgDescEditor: React.FC<{
  blocks: ProgContentBlock[];
  onChange: (blocks: ProgContentBlock[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  resetKey?: number;
}> = ({ blocks, onChange, disabled, hasError, resetKey }) => {
  const mkId = () => `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const [showImgModal, setShowImgModal] = React.useState(false);
  const [fmtState, setFmtState] = React.useState({ bold: false, italic: false, underline: false });
  const editRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const lastSetValues = React.useRef<Map<string, string>>(new Map());

  // Clear lastSetValues cache when question changes so stale IDs don't skip DOM updates
  React.useEffect(() => {
    lastSetValues.current.clear();
  }, [resetKey]);

  const updateBlock = (id: string, patch: Partial<ProgContentBlock>) => {
    onChange(blocks.map(b => b.id === id ? ({ ...b, ...patch } as ProgContentBlock) : b));
  };
  const removeBlock = (id: string) => {
    const next = blocks.filter(b => b.id !== id);
    onChange(next.length > 0 ? next : [{ id: mkId(), type: 'text', value: '' }]);
  };

  // Sync HTML value to contentEditable without resetting cursor
  React.useEffect(() => {
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
      {/* Toolbar — above text area */}
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 0 6px' }}>
          <button type="button" className="lms-fmt-btn" title="Bold"
            onMouseDown={e => { e.preventDefault(); applyFmt('bold'); }}
            style={{ fontWeight: 700, color: fmtState.bold ? 'var(--lms-orange)' : undefined, background: fmtState.bold ? 'rgba(255,107,53,0.08)' : undefined }}>
            B
          </button>
          <button type="button" className="lms-fmt-btn" title="Italic"
            onMouseDown={e => { e.preventDefault(); applyFmt('italic'); }}
            style={{ fontStyle: 'italic', color: fmtState.italic ? 'var(--lms-orange)' : undefined, background: fmtState.italic ? 'rgba(255,107,53,0.08)' : undefined }}>
            I
          </button>
          <button type="button" className="lms-fmt-btn" title="Underline"
            onMouseDown={e => { e.preventDefault(); applyFmt('underline'); }}
            style={{ textDecoration: 'underline', color: fmtState.underline ? 'var(--lms-orange)' : undefined, background: fmtState.underline ? 'rgba(255,107,53,0.08)' : undefined }}>
            U
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--lms-border)', margin: '0 2px' }} />
          <button type="button" className="lms-fmt-btn" title="Insert code block"
            onClick={() => onChange([...blocks, { id: mkId(), type: 'code', value: '', language: 'python', bgColor: '#f5f5f5' }])}>
            <Code size={13} />
          </button>
          <button type="button" className="lms-fmt-btn"
            title={hasImage ? 'Remove existing image first' : 'Insert image'}
            disabled={hasImage}
            style={{ opacity: hasImage ? 0.4 : 1, cursor: hasImage ? 'not-allowed' : 'pointer' }}
            onClick={() => { if (!hasImage) setShowImgModal(true); }}>
            <Image size={13} />
          </button>
        </div>
      )}
      {/* Blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {blocks.map((b) => {
          if (b.type === 'text') return (
            <div
              key={b.id}
              ref={el => { if (el) editRefs.current.set(b.id, el); else editRefs.current.delete(b.id); }}
              contentEditable={!disabled}
              suppressContentEditableWarning
              data-placeholder="Describe the problem clearly. Include input/output format and examples."
              onInput={e => {
                const html = (e.currentTarget as HTMLDivElement).innerHTML;
                lastSetValues.current.set(b.id, html);
                updateBlock(b.id, { value: html } as any);
              }}
              onKeyUp={trackFmt}
              onMouseUp={trackFmt}
              style={{
                fontFamily: 'var(--lms-font)',
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.65,
                color: 'var(--lms-text-main)',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${disabled ? 'var(--lms-border)' : 'var(--lms-text-main)'}`,
                borderRadius: 0,
                outline: 'none',
                width: '100%',
                padding: '4px 0 6px',
                minHeight: 80,
                cursor: disabled ? 'not-allowed' : 'text',
                boxSizing: 'border-box',
                wordBreak: 'break-word',
              }}
            />
          );
          if (b.type === 'image') return (
            <ProgImageBlock key={b.id} block={b as any} onUpdate={patch => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} disabled={disabled} />
          );
          if (b.type === 'code') return (
            <ProgCodeBlockMCQ key={b.id} block={b as any} onUpdate={patch => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} disabled={disabled} />
          );
          return null;
        })}
      </div>
      {showImgModal && (
        <ProgImageUploadModal
          onUpload={url => {
            onChange([...blocks, { id: mkId(), type: 'image', url, alignment: 'center', sizePercent: 70 }]);
            setShowImgModal(false);
          }}
          onClose={() => setShowImgModal(false)}
        />
      )}
    </div>
  );
};

// ─── PROGRAMMING TITLE EDITOR ─────────────────────────────────────────────────

const ProgTitleEditor: React.FC<{
  blocks: ProgContentBlock[];
  onChange: (blocks: ProgContentBlock[]) => void;
  disabled?: boolean;
  hasError?: boolean;
  titleRef?: React.RefObject<HTMLTextAreaElement | null>;
}> = ({ blocks, onChange, disabled, hasError, titleRef }) => {
  const [showImgModal, setShowImgModal] = useState(false);
  const mkId = () => `tb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const updateBlock = (id: string, patch: Partial<ProgContentBlock>) =>
    onChange(blocks.map(b => b.id === id ? ({ ...b, ...patch } as ProgContentBlock) : b));

  const removeBlock = (id: string) => {
    const next = blocks.filter(b => b.id !== id);
    onChange(next.length > 0 ? next : [{ id: mkId(), type: 'text', value: '' }]);
  };

  const addCodeBlock = () =>
    onChange([...blocks, { id: mkId(), type: 'code', value: '', language: 'python', bgColor: '#f5f5f5' }]);

  const hasImage = blocks.some(b => b.type === 'image');

  const handleInsertImage = () => {
    if (hasImage) return; // only one image allowed
    setShowImgModal(true);
  };

  const onImageUploaded = (url: string) => {
    onChange([...blocks, { id: mkId(), type: 'image', url, alignment: 'center', sizePercent: 70 }]);
    setShowImgModal(false);
  };

  return (
    <div>
      {/* Toolbar — icons above title (same style as MCQ) */}
      {!disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0.5, marginBottom: 6 }}>
          {/* Code block */}
          <button type="button" className="lms-fmt-btn" onClick={addCodeBlock} title="Insert code block">
            <Code className="h-3.5 w-3.5" />
          </button>
          {/* Image — only one allowed */}
          <button type="button" className="lms-fmt-btn" onClick={handleInsertImage}
            title={hasImage ? 'Remove existing image first' : 'Insert image'}
            style={{ opacity: hasImage ? 0.4 : 1, cursor: hasImage ? 'not-allowed' : 'pointer' }}>
            <Image className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Image upload modal */}
      {showImgModal && (
        <ProgImageUploadModal
          onUpload={onImageUploaded}
          onClose={() => setShowImgModal(false)}
        />
      )}

      {/* Blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, border: `1.5px solid ${hasError ? 'var(--lms-danger)' : 'transparent'}`, borderRadius: hasError ? 8 : 0 }}>
        {blocks.map((b) => {
          if (b.type === 'text') return (
            <textarea
              key={b.id}
              ref={blocks.indexOf(b) === 0 ? (titleRef as any) : undefined}
              value={(b as any).value}
              onChange={e => updateBlock(b.id, { value: e.target.value } as any)}
              disabled={disabled}
              placeholder="Enter a clear, descriptive question title…"
              rows={1}
              style={{
                fontFamily: 'var(--lms-font)', fontSize: 15, fontWeight: 500,
                color: 'var(--lms-text-main)',
                background: 'transparent', border: 'none',
                borderBottom: `2px solid ${disabled ? 'var(--lms-border)' : 'var(--lms-text-main)'}`,
                borderRadius: 0, outline: 'none', width: '100%', padding: '4px 0',
                opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'text',
                resize: 'none', overflow: 'hidden', lineHeight: 1.4, boxSizing: 'border-box',
              }}
              onInput={e => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
            />
          );
          if (b.type === 'image') return (
            <ProgImageBlock key={b.id} block={b as any} onUpdate={patch => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} disabled={disabled} />
          );
          if (b.type === 'code') return (
            <ProgCodeBlockMCQ key={b.id} block={b as any} onUpdate={patch => updateBlock(b.id, patch)} onRemove={() => removeBlock(b.id)} disabled={disabled} />
          );
          return null;
        })}
      </div>
    </div>
  );
};

// ─── PROGRAMMING MOCK MODAL ───────────────────────────────────────────────────

const PISTON_API_URL_MOCK = process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston/execute";

const getPistonLangMock = (lang: string): { language: string; version: string } => {
  const map: Record<string, { language: string; version: string }> = {
    javascript: { language: 'javascript', version: '18.15.0' },
    python: { language: 'python', version: '3.10.0' },
    java: { language: 'java', version: '15.0.2' },
    cpp: { language: 'cpp', version: '10.2.0' },
    c: { language: 'c', version: '10.2.0' },
    csharp: { language: 'csharp', version: '6.12.0' },
    typescript: { language: 'typescript', version: '5.0.3' },
  };
  return map[lang.toLowerCase()] || { language: 'javascript', version: '18.15.0' };
};

interface ConsoleLine {
  id: string;
  type: 'output' | 'error' | 'input' | 'system';
  text: string;
}

const ProgrammingMockModal: React.FC<{
  questions: FlowQuestion[];
  selectedLanguages: string[];
  onClose: () => void;
  exerciseIsGraded?: boolean;
}> = ({ questions, selectedLanguages, onClose, exerciseIsGraded = true }) => {
  const [idx, setIdx] = useState(0);
  const [code, setCode] = useState('');
  const [lang, setLang] = useState(selectedLanguages[0]?.toLowerCase() || 'python');
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([]);
  const [consoleInput, setConsoleInput] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const pyodideRef = useRef<any>(null);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const consoleInputRef = useRef<HTMLInputElement>(null);
  const inputResolverRef = useRef<((v: string) => void) | null>(null);

  const q = questions[idx];

  const qTitleBlocks: ProgContentBlock[] = [{ id: 'title-text', type: 'text', value: typeof q?.title === 'string' ? q.title : 'Untitled' }];

  const descBlocks: ProgContentBlock[] = q?.description && ((q.description as any).contentBlocks || (q.description as any).blocks)
    ? ((q.description as any).contentBlocks || (q.description as any).blocks)
    : [{ id: 'desc-text', type: 'text', value: typeof q?.description === 'object' ? (q?.description as any)?.text || '' : q?.description || '' }];

  const sampleTcs = q?.testCases?.filter((t: any) => t.isSample && (t.input?.trim() || t.expectedOutput?.trim())) || [];
  const hasConstraints = q?.constraints?.filter((c: string) => c.trim()).length > 0;
  const hasDescription = descBlocks.some(b => b.type !== 'text' || (b as any).value?.trim());

  useEffect(() => {
    if (lang === 'python' && !pyodideReady && !pyodideRef.current) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js';
      script.onload = async () => {
        try {
          const pyodide = await (window as any).loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/' });
          pyodideRef.current = pyodide;
          setPyodideReady(true);
        } catch (e) { console.warn('Pyodide load error:', e); }
      };
      document.head.appendChild(script);
    }
  }, [lang]);

  useEffect(() => { consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [consoleLines]);
  useEffect(() => { if (waitingForInput) consoleInputRef.current?.focus(); }, [waitingForInput]);

  useEffect(() => {
    setCode('');
    setConsoleLines([]);
    setWaitingForInput(false);
    setIsRunning(false);
    inputResolverRef.current = null;
    if (lang === 'python') setConsoleInput('');
  }, [idx, lang]);

  const mkLineId = () => `cl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const appendLine = (type: ConsoleLine['type'], text: string) => {
    setConsoleLines(prev => [...prev, { id: mkLineId(), type, text }]);
  };
  const streamText = async (text: string, type: 'output' | 'error' = 'output') => {
    if (!text) return;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== '' || i < lines.length - 1) {
        appendLine(type, lines[i]);
        await new Promise(r => setTimeout(r, 35));
      }
    }
  };
  const submitInput = () => {
    if (!waitingForInput || !inputResolverRef.current) return;
    const val = consoleInput;
    appendLine('input', val);
    setConsoleInput('');
    setWaitingForInput(false);
    const resolve = inputResolverRef.current;
    inputResolverRef.current = null;
    resolve(val);
  };

  const executeCode = async () => {
    if (!code.trim()) { appendLine('system', '⚠ Please write some code first.'); return; }
    setConsoleLines([{ id: mkLineId(), type: 'system', text: `▶ Running ${lang}…` }]);
    setIsRunning(true);
    setWaitingForInput(false);
    inputResolverRef.current = null;
    try {
      if (lang === 'python') {
        if (!pyodideReady || !pyodideRef.current) {
          appendLine('system', '⌛ Python runtime loading… Please wait and try again.');
          setIsRunning(false);
          return;
        }
        pyodideRef.current.setStdin({
          readline: () => new Promise<string>(resolve => {
            setWaitingForInput(true);
            inputResolverRef.current = (val: string) => resolve(val + '\n');
          })
        });
        const outLines: string[] = [];
        const errLines: string[] = [];
        pyodideRef.current.setStdout({ batched: (s: string) => { outLines.push(s); } });
        pyodideRef.current.setStderr({ batched: (s: string) => { errLines.push(s); } });
        try {
          const runPromise = pyodideRef.current.runPythonAsync(code);
          const flushInterval = setInterval(() => {
            if (outLines.length > 0) {
              const pending = outLines.splice(0);
              pending.forEach(s => {
                s.split('\n').forEach((line, i, arr) => {
                  if (line !== '' || i < arr.length - 1) {
                    setConsoleLines(prev => [...prev, { id: mkLineId(), type: 'output', text: line }]);
                  }
                });
              });
            }
          }, 50);
          await runPromise;
          clearInterval(flushInterval);
          const remaining = outLines.splice(0);
          for (const s of remaining) await streamText(s, 'output');
          for (const s of errLines) await streamText(s, 'error');
          appendLine('system', '✓ Process finished (exit 0)');
        } catch (e: any) {
          const remaining = outLines.splice(0);
          for (const s of remaining) await streamText(s, 'output');
          await streamText(e.message || String(e), 'error');
          appendLine('system', '✗ Process exited with error');
        }
      } else {
        const stdinVal = consoleInput;
        const pistonLang = getPistonLangMock(lang);
        const resp = await fetch(PISTON_API_URL_MOCK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: pistonLang.language, version: pistonLang.version,
            files: [{ name: 'main', content: code }],
            stdin: stdinVal, args: [],
            compile_timeout: 10000, run_timeout: 8000,
            compile_memory_limit: -1, run_memory_limit: -1,
          }),
        });
        const data = await resp.json();
        if (data.run) {
          const out = (data.run.output || '').trim();
          const err = (data.run.stderr || '').trim();
          if (out) await streamText(out, 'output');
          if (err) await streamText(err, 'error');
          if (!out && !err) appendLine('system', '(no output)');
          appendLine('system', `✓ Process finished (exit ${data.run.code ?? 0})`);
        } else {
          appendLine('error', 'Execution failed — unexpected API response');
        }
      }
    } catch (e: any) {
      appendLine('error', `Network error: ${e.message}`);
    } finally {
      setIsRunning(false);
      setWaitingForInput(false);
      inputResolverRef.current = null;
    }
  };

  const diffStyle = DS[q?.difficulty] || DS.medium;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column',
      background: '#f5f5f5', overflow: 'hidden', fontFamily: 'var(--lms-font)'
    }}>

      {/* ── TOP NAV ── */}
      <div style={{
        flexShrink: 0, height: 44, borderBottom: '1px solid #e5e5e5', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', background: '#ffffff'
      }}>
        {/* Left: logo + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 6, background: 'var(--lms-orange)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Code size={13} style={{ color: 'white' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#333', fontFamily: 'var(--lms-font)', letterSpacing: 0.2 }}>
            Mock Preview
          </span>
        </div>

        {/* Center: question pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {questions.map((qItem, i) => {
            const ds = DS[qItem.difficulty] || DS.medium;
            const isActive = i === idx;
            return (
              <button key={i} onClick={() => setIdx(i)}
                style={{
                  height: 26, minWidth: 26, padding: '0 8px', borderRadius: 6,
                  border: `1.5px solid ${isActive ? ds.border : '#e5e5e5'}`,
                  background: isActive ? ds.bg : '#f8f8f8',
                  color: isActive ? ds.text : '#666',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--lms-font)', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                {i + 1}
                {qItem.difficulty && <span style={{ fontSize: 9, opacity: 0.8, textTransform: 'capitalize' }}>{qItem.difficulty[0]}</span>}
              </button>
            );
          })}
        </div>

        {/* Right: lang select + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select value={lang} onChange={e => setLang(e.target.value)}
            style={{
              fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600,
              border: '1px solid #e5e5e5', borderRadius: 6, padding: '4px 8px',
              background: '#ffffff', color: '#333', cursor: 'pointer', outline: 'none'
            }}>
            {selectedLanguages.length > 0
              ? selectedLanguages.map(l => <option key={l} value={l.toLowerCase()}>{l}</option>)
              : ['Python', 'JavaScript', 'Java', 'C++'].map(l => <option key={l} value={l.toLowerCase()}>{l}</option>)}
          </select>
          <button onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e5e5',
              background: '#f8f8f8', color: '#666', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s'
            }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT: Problem Panel ── */}
        <div style={{
          width: '42%', flexShrink: 0, borderRight: '1px solid #e5e5e5',
          display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff'
        }}>

          {/* Panel content — all in one like LeetCode */}
          <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Title row */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 600, color: '#999' }}>
                    {idx + 1} / {questions.length}
                  </span>
                  {q?.difficulty && (
                    <span style={{ ...diffStyle.pill, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                      {q.difficulty}
                    </span>
                  )}
                  {exerciseIsGraded && q?.score > 0 && (
                    <span style={{ fontSize: 10, color: '#999', fontFamily: 'var(--lms-font)' }}>
                      {q.score} pts
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {qTitleBlocks.map((b, bi) => {
                    if (b.type === 'text' && (b as any).value?.trim()) return (
                      <h2 key={bi} dangerouslySetInnerHTML={{ __html: (b as any).value }} style={{ fontFamily: 'var(--lms-font)', fontSize: 20, fontWeight: 800, color: '#1a1a2e', lineHeight: 1.3, margin: 0 }} />
                    );
                    if (b.type === 'image') return (
                      <div key={bi} style={{ display: 'flex', justifyContent: (b as any).alignment === 'right' ? 'flex-end' : (b as any).alignment === 'center' ? 'center' : 'flex-start' }}>
                        <img src={(b as any).url} alt="" style={{ width: `${(b as any).sizePercent || 60}%`, borderRadius: 8, border: '1px solid #e5e5e5' }} />
                      </div>
                    );
                    if (b.type === 'code') {
                      const isDk = ['#1e1e1e', '#282a36', '#272822'].includes((b as any).bgColor);
                      return <pre key={bi} style={{ background: (b as any).bgColor || '#f5f5f5', color: isDk ? '#d4d4d4' : '#1a1a2e', fontFamily: 'ui-monospace,monospace', fontSize: 12, padding: '10px 14px', borderRadius: 8, margin: 0, overflowX: 'auto' }}>{(b as any).value}</pre>;
                    }
                    return null;
                  })}
                </div>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: '#e5e5e5' }} />

              {/* Description blocks */}
              {hasDescription && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {descBlocks.map((b, bi) => {
                    if (b.type === 'text') {
                      const val = (b as any).value?.trim();
                      if (!val) return null;
                      return <p key={bi} style={{ fontFamily: 'var(--lms-font)', fontSize: 13.5, lineHeight: 1.8, color: '#4a4a4a', margin: 0, whiteSpace: 'pre-wrap' }}>{val}</p>;
                    }
                    if (b.type === 'image') return (
                      <div key={bi} style={{ display: 'flex', justifyContent: (b as any).alignment === 'left' ? 'flex-start' : (b as any).alignment === 'right' ? 'flex-end' : 'center' }}>
                        <img src={(b as any).url} alt="" style={{ width: `${(b as any).sizePercent || 70}%`, borderRadius: 8, border: '1px solid #e5e5e5' }} />
                      </div>
                    );
                    if (b.type === 'code') {
                      const isDark = ['#1e1e1e', '#282a36', '#272822'].includes((b as any).bgColor);
                      return <pre key={bi} style={{ background: (b as any).bgColor || '#f5f5f5', color: isDark ? '#d4d4d4' : '#1a1a2e', fontFamily: 'ui-monospace,monospace', fontSize: 12.5, padding: '14px 16px', borderRadius: 10, overflowX: 'auto', margin: 0, lineHeight: 1.6 }}>{(b as any).value}</pre>;
                    }
                    return null;
                  })}
                </div>
              )}

              {/* Examples */}
              {sampleTcs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {sampleTcs.map((tc: any, ti: number) => (
                    <div key={ti}>
                      <p style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>
                        Example {ti + 1}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {tc.input?.trim() && (
                          <div style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e5e5' }}>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Input</p>
                            <pre style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5, color: '#1a1a2e', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{tc.input}</pre>
                          </div>
                        )}
                        {tc.expectedOutput?.trim() && (
                          <div style={{ background: '#f8f8f8', borderRadius: 8, padding: '10px 14px', border: '1px solid #e5e5e5' }}>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Output</p>
                            <pre style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5, color: '#1a1a2e', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{tc.expectedOutput}</pre>
                          </div>
                        )}
                        {tc.explanation?.trim() && (
                          <div style={{ padding: '8px 12px', borderLeft: '3px solid #e5e5e5', background: '#fafafa', borderRadius: '0 6px 6px 0' }}>
                            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: '#666', margin: 0, lineHeight: 1.6 }}>
                              <strong style={{ color: '#333' }}>Explanation: </strong>{tc.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Constraints */}
              {hasConstraints && (
                <div>
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    Constraints
                  </p>
                  <ul style={{ paddingLeft: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none' }}>
                    {q.constraints.filter((c: string) => c.trim()).map((c: string, ci: number) => (
                      <li key={ci} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ color: 'var(--lms-orange)', fontSize: 12, marginTop: 1, flexShrink: 0 }}>•</span>
                        <code style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12.5, color: '#3a3a52', lineHeight: 1.6 }}>{c}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── RIGHT: Editor + Console ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fefefe' }}>

          {/* Editor toolbar */}
          <div style={{
            flexShrink: 0, padding: '0 14px', height: 40, borderBottom: '1px solid #e5e5e5',
            display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff'
          }}>
            <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 11, color: '#999' }}>
              solution.{lang === 'python' ? 'py' : lang === 'javascript' ? 'js' : lang === 'java' ? 'java' : lang === 'cpp' ? 'cpp' : lang}
            </span>
            {lang === 'python' && !pyodideReady && (
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: '#d97706', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Loader2 size={10} className="animate-spin" /> Loading runtime…
              </span>
            )}
            {lang === 'python' && pyodideReady && (
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: '#16a34a', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> Ready
              </span>
            )}
            <button onClick={executeCode} disabled={isRunning}
              style={{
                marginLeft: lang === 'python' ? 8 : 'auto',
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 14px', borderRadius: 6, border: 'none',
                background: isRunning ? '#e5e5e5' : 'var(--lms-orange)',
                color: isRunning ? '#999' : 'white',
                fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 700,
                cursor: isRunning ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
              }}>
              {isRunning ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              {isRunning ? 'Running…' : 'Run'}
            </button>
          </div>

          {/* Code editor */}
          <textarea
            ref={codeRef}
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={`// Write your ${lang} solution here…`}
            style={{
              flex: 1, background: '#fefefe', border: 'none', outline: 'none',
              color: '#1a1a2e', fontFamily: 'ui-monospace, "Courier New", monospace',
              fontSize: 13.5, lineHeight: 1.7, padding: '16px 18px',
              resize: 'none', boxSizing: 'border-box', tabSize: 2,
              borderBottom: '1px solid #e5e5e5',
            }}
            onKeyDown={e => {
              if (e.key === 'Tab') {
                e.preventDefault();
                const start = e.currentTarget.selectionStart;
                const end = e.currentTarget.selectionEnd;
                const val = e.currentTarget.value;
                setCode(val.substring(0, start) + '  ' + val.substring(end));
                setTimeout(() => { if (codeRef.current) { codeRef.current.selectionStart = codeRef.current.selectionEnd = start + 2; } }, 0);
              }
            }}
          />

          {/* Console */}
          <div style={{ flexShrink: 0, height: 220, display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
            <div style={{
              flexShrink: 0, padding: '0 14px', height: 34, borderBottom: '1px solid #e5e5e5',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: isRunning ? '#16a34a' : waitingForInput ? '#d97706' : '#ccc',
                transition: 'background 0.2s'
              }} />
              <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 10.5, fontWeight: 600, color: '#999' }}>
                {waitingForInput ? 'stdin' : isRunning ? 'running' : 'console'}
              </span>
              {lang !== 'python' && !isRunning && (
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: '#ccc' }}>· provide stdin below then run</span>
              )}
              {consoleLines.length > 0 && (
                <button onClick={() => setConsoleLines([])}
                  style={{
                    marginLeft: 'auto', fontFamily: 'var(--lms-font)', fontSize: 10,
                    color: '#999', background: 'none', border: 'none',
                    cursor: 'pointer', padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s'
                  }}>
                  clear
                </button>
              )}
            </div>

            <div style={{
              flex: 1, overflowY: 'auto', padding: '8px 14px',
              fontFamily: 'ui-monospace, monospace', fontSize: 12,
              lineHeight: 1.7, scrollbarWidth: 'thin'
            }}>
              {consoleLines.length === 0 && !isRunning && (
                <span style={{ color: '#ccc', fontStyle: 'italic', fontSize: 11 }}>
                  {lang !== 'python' ? 'Provide stdin below, then run…' : 'Run your code to see output here…'}
                </span>
              )}
              {consoleLines.map(line => (
                <div key={line.id} style={{
                  color: line.type === 'error' ? '#dc2626' : line.type === 'input' ? '#FB923C' : line.type === 'system' ? '#999' : '#1a1a2e',
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <span style={{ flexShrink: 0, opacity: 0.6, fontSize: 10, marginTop: 2 }}>
                    {line.type === 'input' ? '›' : line.type === 'error' ? '✗' : line.type === 'system' ? '#' : '$'}
                  </span>
                  <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line.text || '\u00A0'}</span>
                </div>
              ))}
              <div ref={consoleEndRef} />
            </div>

            {/* Input area */}
            {lang === 'python' ? (
              <div style={{
                flexShrink: 0, borderTop: `1px solid ${waitingForInput ? '#FB923C' : '#e5e5e5'}`,
                background: waitingForInput ? '#FFF7ED' : '#fafafa',
                padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s'
              }}>
                <span style={{ fontFamily: 'ui-monospace,monospace', fontSize: 12, fontWeight: 700, color: waitingForInput ? '#FB923C' : '#ccc', flexShrink: 0 }}>›</span>
                <input
                  ref={consoleInputRef}
                  value={consoleInput}
                  onChange={e => setConsoleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitInput(); }}
                  placeholder={waitingForInput ? 'Type input and press Enter…' : 'Waiting for input()…'}
                  disabled={!waitingForInput}
                  style={{
                    flex: 1, fontFamily: 'ui-monospace,monospace', fontSize: 12,
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#1a1a2e', opacity: waitingForInput ? 1 : 0.3
                  }}
                />
                {waitingForInput && (
                  <button onClick={submitInput}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      padding: '3px 10px', borderRadius: 5, border: '1px solid #FB923C',
                      background: '#FB923C', color: 'white', fontFamily: 'var(--lms-font)',
                      fontSize: 11, fontWeight: 600, cursor: 'pointer'
                    }}>
                    Enter ↵
                  </button>
                )}
              </div>
            ) : (
              <div style={{ flexShrink: 0, borderTop: '1px solid #e5e5e5', background: '#fafafa', padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 9, fontWeight: 700, color: '#ccc', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Stdin</span>
                <textarea
                  value={consoleInput}
                  onChange={e => setConsoleInput(e.target.value)}
                  placeholder={'5\n3\nhello\n...'}
                  rows={2}
                  disabled={isRunning}
                  style={{
                    width: '100%', fontFamily: 'ui-monospace,monospace', fontSize: 11.5,
                    background: '#ffffff', border: '1px solid #e5e5e5', borderRadius: 5,
                    outline: 'none', color: '#1a1a2e', padding: '5px 8px',
                    resize: 'none', boxSizing: 'border-box', opacity: isRunning ? 0.4 : 1
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{
        flexShrink: 0, borderTop: '1px solid #e5e5e5', padding: '8px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff'
      }}>
        <button onClick={() => { if (idx > 0) setIdx(idx - 1); }} disabled={idx === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px',
            borderRadius: 6, border: '1px solid #e5e5e5', background: '#f8f8f8',
            color: idx === 0 ? '#ccc' : '#666', fontSize: 11, fontWeight: 600,
            cursor: idx === 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--lms-font)', transition: 'all 0.15s'
          }}>
          <ChevronLeft size={12} /> Prev
        </button>
        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: '#999' }}>
          <span style={{ color: 'var(--lms-orange)', fontWeight: 700 }}>{idx + 1}</span>
          <span style={{ margin: '0 4px' }}>/</span>
          {questions.length}
        </span>
        {idx < questions.length - 1 ? (
          <button onClick={() => setIdx(idx + 1)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px',
              borderRadius: 6, border: '1px solid #e5e5e5', background: '#f8f8f8',
              color: '#666', fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--lms-font)', transition: 'all 0.15s'
            }}>
            Next <ChevronRight size={12} />
          </button>
        ) : (
          <button onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 14px',
              borderRadius: 6, border: 'none', background: 'var(--lms-orange)',
              color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'var(--lms-font)'
            }}>
            <Check size={12} /> Done
          </button>
        )}
      </div>
    </div>
  );
};

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────

const capFirst = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

const QuestionFormBreadcrumb: React.FC<{
  hierarchyData: any; tabType: string; subcategory?: string; subcategoryLabel?: string;
  exerciseName?: string; actionLabel: string; questionLabel: string;
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
            <li>
              <span className="lms-crumb" data-tip={c.tip} style={{ color: 'var(--lms-text-sec)' }}>
                {capFirst(c.text)}
              </span>
            </li>
            <Sep />
          </React.Fragment>
        ))}
        {tabType && (
          <><li><span className="lms-crumb" data-tip="Category" style={{ color: 'var(--lms-text-sec)' }}>{capFirst(tabType.replace(/_/g, ' '))}</span></li><Sep /></>
        )}
        {(subcategoryLabel || subcategory) && (
          <><li><span className="lms-crumb" data-tip="Sub-category" style={{ color: 'var(--lms-orange)' }}>{capFirst(subcategoryLabel || subcategory || '')}</span></li><Sep /></>
        )}
        {exerciseName && (
          <><li><span className="lms-crumb" data-tip="Exercise" style={{ color: 'var(--lms-text-main)', verticalAlign: 'bottom' }}><span style={{ maxWidth: 140, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>{capFirst(exerciseName)}</span></span></li><Sep /></>
        )}
        <li>
          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 700, color: 'var(--lms-text-main)' }}>
            {capFirst(actionLabel)}
            {questionLabel && questionLabel !== actionLabel && (
              <span style={{ marginLeft: 6, fontWeight: 400, color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>· {questionLabel}</span>
            )}
          </span>
        </li>
      </ol>
    </nav>
  );
};

// ─── MODALS ───────────────────────────────────────────────────────────────────

const CloseConfirmDialog: React.FC<{
  hasUnsavedChanges: boolean; hasSavedQuestions: boolean;
  onConfirm: () => void; onCancel: () => void;
}> = ({ hasUnsavedChanges, hasSavedQuestions, onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: hasUnsavedChanges ? 'var(--lms-warning-bg)' : 'var(--lms-bg-surface)' }}>
        <div className="lms-modal-icon" style={{ background: hasUnsavedChanges ? 'var(--lms-warning-bg)' : 'var(--lms-bg-surface2)', border: `1.5px solid ${hasUnsavedChanges ? 'var(--lms-warning-bdr)' : 'var(--lms-border)'}` }}>
          <X size={16} style={{ color: hasUnsavedChanges ? 'var(--lms-warning)' : 'var(--lms-text-sec)' }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>
            {hasUnsavedChanges ? 'Unsaved Changes' : 'Close Form?'}
          </h2>
          <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>
            {hasUnsavedChanges ? 'You have unsaved changes' : 'Are you sure you want to close?'}
          </p>
        </div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6 }}>
          {hasUnsavedChanges
            ? <><span>The current question has </span><strong style={{ color: 'var(--lms-warning)' }}>unsaved changes</strong><span> that will be lost if you close now.</span>{hasSavedQuestions && <span style={{ display: 'block', marginTop: 8, color: 'var(--lms-text-muted)' }}>Previously saved questions will remain intact.</span>}</>
            : hasSavedQuestions ? <>Are you sure you want to close? Your saved questions will remain intact.</>
              : <>Are you sure you want to close this form? No questions have been saved yet.</>
          }
        </p>
        {hasUnsavedChanges && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)', borderRadius: 'var(--lms-radius-md)' }}>
            <AlertTriangle size={12} style={{ color: 'var(--lms-warning)', marginTop: 2, flexShrink: 0 }} />
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-warning)' }}>
              Tip: Click <strong>Cancel</strong> to go back and save your changes first.
            </p>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Keep Editing</button>
          <button onClick={onConfirm} className="lms-btn lms-btn-orange" style={{ flex: 1, justifyContent: 'center', background: hasUnsavedChanges ? 'var(--lms-warning)' : 'var(--lms-text-main)', boxShadow: 'none', borderColor: 'transparent' }}>
            <X size={13} />{hasUnsavedChanges ? 'Discard & Close' : 'Yes, Close'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

const EditExerciseConfirmDialog: React.FC<{
  exerciseName?: string; onConfirm: () => void; onCancel: () => void;
}> = ({ exerciseName, onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: 'var(--lms-orange-50)', borderBottom: '1.5px solid var(--lms-orange-100)' }}>
        <div className="lms-modal-icon" style={{ background: 'var(--lms-orange-100)', border: '1.5px solid var(--lms-orange-100)' }}>
          <Settings size={16} style={{ color: 'var(--lms-orange)' }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Edit Exercise Settings?</h2>
          <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This will close the question form</p>
        </div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6 }}>
          Do you want to edit the settings for <strong style={{ color: 'var(--lms-text-main)' }}>"{exerciseName || 'this exercise'}"</strong>?
          <span style={{ display: 'block', marginTop: 8, color: 'var(--lms-text-muted)' }}>The question form will be closed and you'll be taken to the exercise settings. Any unsaved question changes will be lost.</span>
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} className="lms-btn lms-btn-ghost-orange" style={{ flex: 1, justifyContent: 'center' }}>
            <Settings size={13} /> Yes, Edit Exercise
          </button>
        </div>
      </div>
    </div>
  </div>
);

const DiffSwitchDialog: React.FC<{
  fromDiff: Diff; toDiff: Diff; remainingInTo: number; onConfirm: (d: Diff) => void; onCancel: () => void;
}> = ({ fromDiff, toDiff, remainingInTo, onConfirm, onCancel }) => {
  const toDS = DS[toDiff]; const fromDS = DS[fromDiff];
  return (
    <div className="lms-modal-backdrop">
      <div className="lms-modal">
        <div className="lms-modal-header">
          <div className="lms-modal-icon" style={{ background: 'var(--lms-info-bg)', border: '1.5px solid var(--lms-info-bdr)' }}>
            <ArrowLeftRight size={16} style={{ color: 'var(--lms-info)' }} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Switch Difficulty?</h2>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>You're about to change the active difficulty</p>
          </div>
        </div>
        <div className="lms-modal-body">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--lms-radius-md)', background: fromDS.bg, border: `1.5px solid ${fromDS.border}` }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: fromDS.dot, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: fromDS.text, textTransform: 'capitalize' }}>{fromDiff}</span>
              <span style={{ fontSize: 10, color: 'var(--lms-text-muted)', marginLeft: 'auto' }}>Current</span>
            </div>
            <ArrowRight size={14} style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 'var(--lms-radius-md)', background: toDS.bg, border: `2px solid ${toDS.border}` }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: toDS.dot, flexShrink: 0 }} />
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: toDS.text, textTransform: 'capitalize' }}>{toDiff}</span>
            </div>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)' }}>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6 }}>
              Switching to <strong style={{ color: toDS.text, textTransform: 'capitalize' }}>{toDiff}</strong>{' '}
              {remainingInTo > 0
                ? <>will start adding questions for that difficulty. <span style={{ display: 'block', marginTop: 4, color: 'var(--lms-text-muted)' }}>{remainingInTo} Question{remainingInTo !== 1 ? 's' : ''} remaining.</span></>
                : <>will take you to existing <strong style={{ color: toDS.text, textTransform: 'capitalize' }}>{toDiff}</strong> questions to review or update.</>
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={() => onCancel()} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
            <button onClick={() => onConfirm(toDiff)} className="lms-btn" style={{ flex: 1, justifyContent: 'center', ...toDS.solid, border: 'none', boxShadow: 'none' }}>
              <Check size={13} /> Switch to <span style={{ textTransform: 'capitalize', marginLeft: 2 }}>{toDiff}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmDialog: React.FC<{
  questionTitle: string; onConfirm: () => void; onCancel: () => void;
}> = ({ questionTitle, onConfirm, onCancel }) => (
  <div className="lms-modal-backdrop">
    <div className="lms-modal">
      <div className="lms-modal-header" style={{ background: 'var(--lms-danger-bg)', borderBottom: '1.5px solid var(--lms-danger-bdr)' }}>
        <div className="lms-modal-icon" style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}>
          <AlertTriangle size={16} style={{ color: 'var(--lms-danger)' }} />
        </div>
        <div>
          <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Delete Question?</h2>
          <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This action cannot be undone</p>
        </div>
      </div>
      <div className="lms-modal-body">
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>
          Are you sure you want to delete <strong style={{ color: 'var(--lms-text-main)' }}>"{questionTitle || 'this question'}"</strong>?
        </p>
        <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', fontWeight: 600 }}>This will permanently remove it.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onCancel} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-danger)', color: 'white', border: 'none', boxShadow: 'none' }}>
            <Trash2 size={13} /> Yes, Delete
          </button>
        </div>
      </div>
    </div>
  </div>
);

const DifficultyPopup: React.FC<{
  completedDiff: Diff; availableNext: { diff: Diff; remaining: number }[];
  onSelect: (d: Diff) => void; onClose: () => void;
}> = ({ completedDiff, availableNext, onSelect, onClose }) => {
  const s = DS[completedDiff];
  return (
    <div className="lms-modal-backdrop">
      <div className="lms-modal" style={{ maxWidth: 440 }}>
        <div className="lms-modal-header" style={{ background: s.bg, borderBottom: `1.5px solid ${s.border}` }}>
          <div className="lms-modal-icon" style={{ ...s.solid }}>
            <CheckCircle2 size={18} style={{ color: 'white' }} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 15, fontWeight: 700, color: s.text, textTransform: 'capitalize' }}>
              {completedDiff} Questions Complete! 🎉
            </h2>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>All slots for this difficulty are filled.</p>
          </div>
        </div>
        <div className="lms-modal-body">
          {availableNext.length > 0 ? (
            <>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 600, color: 'var(--lms-text-main)', marginBottom: 10 }}>Choose next difficulty to continue:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableNext.map(({ diff, remaining }) => {
                  const ds = DS[diff];
                  return (
                    <button key={diff} onClick={() => onSelect(diff)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--lms-radius-md)', border: `2px solid ${ds.border}`, background: ds.bg, cursor: 'pointer', fontFamily: 'var(--lms-font)', transition: 'all 0.15s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: ds.dot }} />
                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: ds.text, textTransform: 'capitalize' }}>{diff}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...ds.pill, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{remaining} remaining</span>
                        <ChevronRight size={13} style={{ color: ds.text }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <Sparkles size={28} style={{ color: 'var(--lms-success)', margin: '0 auto 8px' }} />
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>All difficulties complete!</p>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-muted)', marginTop: 4 }}>All question slots have been filled.</p>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} className="lms-cancel-btn">{availableNext.length === 0 ? 'Close' : 'Cancel'}</button>
            {availableNext.length === 0 && (
              <button onClick={onClose} className="lms-btn lms-btn-orange">
                <Check size={13} /> Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── PREVIEW MODAL ─────────────────────────────────────────────────────────────

const PreviewModal: React.FC<{
  questions: FlowQuestion[]; currentIndex: number; isGeneral: boolean; exerciseData: any;
  onJump: (idx: number) => void; onDelete: (localId: string) => void;
  onClose: () => void; onDone: () => void;
  hierarchyData: any; tabType: string; subcategory?: string; subcategoryLabel?: string;
  exerciseName: string; actionLabel: string; questionLabel: string;
  currentDiff: Diff; score: number; generalMPQ: number;
  totalSlots: number; createdCount: number; remainingSlots: number;
  isScoreEditable: (d: Diff) => boolean; getFixedScore: (d: Diff) => number;
  getConfiguredDiffs: () => Diff[]; getRemainingSlots: (d?: Diff, withFlow?: FlowQuestion[]) => number;
  getDbQuestionsForDiff: (d?: Diff) => any[]; getQuotaForDiff: (d: Diff) => number;
  getCreatedCount: (d?: Diff) => number;
  getTotalMarksForDiff: (d: Diff) => number; usedMarks: number;
  onDiffRowClick: (d: Diff) => void; cfgType: string;
  totalMarksAll: number; usedMarksAll: number; displayScore: number;
  remainingMarks: number; totalMarksForDiff: number;
  totalSlotsAll: number; createdCountAll: number; remainingSlotsAll: number;
}> = ({
  questions, currentIndex, isGeneral, exerciseData,
  onJump, onDelete, onClose, onDone,
  hierarchyData, tabType, subcategory, subcategoryLabel,
  exerciseName, actionLabel, questionLabel,
  currentDiff, score, generalMPQ, totalSlots, createdCount, remainingSlots,
  isScoreEditable, getFixedScore,
  cfgType, getConfiguredDiffs, getRemainingSlots, getQuotaForDiff,
  getCreatedCount, getTotalMarksForDiff, usedMarks,
  totalMarksAll, usedMarksAll, displayScore, remainingMarks, totalMarksForDiff,
  totalSlotsAll, createdCountAll, remainingSlotsAll,
}) => {
    const [expandedSet, setExpandedSet] = useState<Set<number>>(new Set());
    const [deleteTarget, setDeleteTarget] = useState<{ localId: string; title: string } | null>(null);
    const [filterDiff, setFilterDiff] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
    const [sidebarTab, setSidebarTab] = useState<'details' | 'overview' | null>(null);

    const s = DS[currentDiff] || DS.medium;
    const subIsSelectionLevel = cfgType === 'selectionLevel';
    const subExerciseIsGraded = !subIsSelectionLevel && (exerciseData?.fullExerciseData?.isGraded !== false);

    // Get unique difficulties present in saved questions
    const savedQuestions = questions.filter(q => !!(q._id || q.isSaved || q.isPreExisting));
    const availableDiffs = (['easy', 'medium', 'hard'] as const).filter(d =>
      savedQuestions.some(q => q.difficulty === d)
    );

    // Apply filter + group by difficulty. When filter is "all" and the exercise
    // is level-based (not General), display Easy → Medium → Hard so a card
    // added later still surfaces with its siblings — otherwise a bank pick or
    // manual add that happens after a different-difficulty entry sits in
    // insertion order (e.g. E1, E2, M1, E3) instead of grouped (E1, E2, E3, M1).
    // Insertion order is preserved WITHIN each difficulty via Array#sort's
    // stability guarantee. General mode keeps insertion order since it has no
    // meaningful difficulty grouping.
    const DIFF_ORDER: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
    const filteredSavedQuestions = savedQuestions
      .filter(q => filterDiff === 'all' ? true : q.difficulty === filterDiff)
      .slice()
      .sort((a, b) => {
        if (isGeneral || filterDiff !== 'all') return 0; // preserve incoming order
        const ai = DIFF_ORDER[a.difficulty ?? 'medium'] ?? 1;
        const bi = DIFF_ORDER[b.difficulty ?? 'medium'] ?? 1;
        return ai - bi;
      });

    return (
      <>
        {/* Exercise Details Modal */}
        {sidebarTab === 'details' && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
            onClick={e => { if (e.target === e.currentTarget) setSidebarTab(null as any); }}>
            <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-bg-surface)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <FileText size={14} style={{ color: 'var(--lms-text-sec)' }} />
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Details</span>
                </div>
                <button type="button" onClick={() => setSidebarTab(null as any)}
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
                    {exerciseName || 'Untitled'}
                  </span>
                </div>
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Exercise Type</span>
                  <span className="lms-detail-value" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                    {exerciseData?.fullExerciseData?.exerciseType || 'programming'}
                  </span>
                </div>
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Configuration</span>
                  <span className="lms-detail-value" style={{ fontSize: 11 }}>
                    {isGeneral ? 'General' : cfgType === 'levelBased' ? 'Level Based' : 'Selection Level'}
                  </span>
                </div>
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Assessment Type</span>
                  <span className="lms-detail-value" style={{ fontSize: 11, fontWeight: 700, color: subExerciseIsGraded ? 'var(--lms-success)' : 'var(--lms-warning)' }}>
                    {subExerciseIsGraded ? 'Graded' : 'Non-Graded'}
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
                <button type="button" onClick={() => setSidebarTab(null as any)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Exercise Overview Modal */}
        {sidebarTab === 'overview' && (() => {
          const configuredDiffs = getConfiguredDiffs();
          return (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
              onClick={e => { if (e.target === e.currentTarget) setSidebarTab(null as any); }}>
              <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 400, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-info-bg)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Overview</span>
                  </div>
                  <button type="button" onClick={() => setSidebarTab(null as any)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                    <X size={15} />
                  </button>
                </div>
                <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                  {/* Overall Questions */}
                  <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--lms-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Questions</span>
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
                      <span className="lms-marks-label">Remaining Marks</span>
                      <span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingSlotsAll}</span>
                    </div>
                    {totalSlotsAll > 0 && (
                      <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                        <div className="lms-progress-fill" style={{ width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`, background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                      </div>
                    )}
                    {/* {!isGeneral && configuredDiffs.length > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {configuredDiffs.map(d => {
                          const quota = getQuotaForDiff(d);
                          const created = getCreatedCount(d);
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
                    )} */}
                  </div>
                  {/* Overall Marks */}
                  {subExerciseIsGraded && totalMarksAll > 0 && (
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Award size={12} style={{ color: 'var(--lms-violet)' }} />
                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-violet)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Marks</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Total Marks</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{totalMarksAll}</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Marks Used</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                          {fmtMark(usedMarksAll)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMarksAll}</span>
                        </span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Remaining Marks</span>
                        <span className="lms-marks-value" style={{ color: (totalMarksAll - usedMarksAll) <= 0 ? 'var(--lms-success)' : 'var(--lms-text-main)', fontSize: 12 }}>
                          {fmtMark(Math.max(0, totalMarksAll - usedMarksAll))}
                        </span>
                      </div>
                      {totalMarksAll > 0 && (
                        <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                          <div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedMarksAll / totalMarksAll) * 100)}%`, background: usedMarksAll >= totalMarksAll ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                        </div>
                      )}
                      {configuredDiffs.length > 0 && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 0 }}>
                          {configuredDiffs.filter(d => d === currentDiff).map(d => {
                            const levelMarks = getTotalMarksForDiff(d);
                            const usedD = savedQuestions.filter(q => q.difficulty === d).reduce((acc, q) => acc + (q.score || 0), 0);
                            const perQ = getFixedScore(d);
                            const diffColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                            return (
                              <div key={d} className="lms-marks-row" style={{ paddingLeft: 8, borderLeft: `2px solid ${diffColor}`, marginBottom: 2 }}>
                                <span className="lms-marks-label" style={{ textTransform: 'capitalize', color: diffColor }}>{d}</span>
                                <span className="lms-marks-value" style={{ fontSize: 11 }}>
                                  <span style={{ color: 'var(--lms-warning)' }}>{fmtMark(usedD)}</span>
                                  <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }}>/{levelMarks || '?'}</span>
                                  {perQ > 0 && <span style={{ color: 'var(--lms-text-muted)', fontSize: 10, marginLeft: 6, fontWeight: 500 }}>{perQ} mark per question</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button type="button" onClick={() => setSidebarTab(null as any)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,26,46,0.5)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 150, padding: 12 }}>
          <div style={{ width: '96vw', maxWidth: 1400, height: '96vh', display: 'flex', flexDirection: 'column', background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', border: '1.5px solid var(--lms-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--lms-violet)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Eye size={16} style={{ color: 'white' }} />
                </div>
                <div style={{ width: 1, height: 20, background: 'var(--lms-border)', flexShrink: 0 }} />
                <QuestionFormBreadcrumb hierarchyData={hierarchyData} tabType={tabType} subcategory={subcategory} subcategoryLabel={subcategoryLabel} exerciseName={exerciseName} actionLabel="Preview" questionLabel={questionLabel} />
              </div>

              {/* Right side: filter + count + close */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                {/* Question count pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)' }}>
                  <Hash size={11} style={{ color: 'var(--lms-text-hint)' }} />
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-text-main)' }}>
                    {filteredSavedQuestions.length}{filterDiff !== 'all' ? `/${savedQuestions.length}` : ''} question{savedQuestions.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Difficulty filter — always visible for level-based */}
                {!isGeneral && (
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                    <select
                      value={filterDiff}
                      onChange={e => setFilterDiff(e.target.value as any)}
                      style={{
                        fontFamily: 'var(--lms-font)',
                        fontSize: 12,
                        fontWeight: 600,
                        border: `1.5px solid ${filterDiff !== 'all' ? (DS[filterDiff]?.border || 'var(--lms-border)') : 'var(--lms-border)'}`,
                        borderRadius: 20,
                        padding: '5px 28px 5px 12px',
                        cursor: 'pointer',
                        outline: 'none',
                        background: filterDiff !== 'all' ? (DS[filterDiff]?.bg || 'var(--lms-bg-surface)') : 'var(--lms-bg-surface)',
                        color: filterDiff !== 'all' ? (DS[filterDiff]?.text || 'var(--lms-text-sec)') : 'var(--lms-text-sec)',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        minWidth: 140,
                      }}
                    >
                      <option value="all">All difficulties</option>
                      {(['easy', 'medium', 'hard'] as const).map(d => (
                        <option key={d} value={d}>
                          {d.charAt(0).toUpperCase() + d.slice(1)} ({savedQuestions.filter(q => q.difficulty === d).length})
                        </option>
                      ))}
                    </select>
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
                      style={{ position: 'absolute', right: 9, pointerEvents: 'none', width: 11, height: 11, color: filterDiff !== 'all' ? DS[filterDiff]?.text : 'var(--lms-text-sec)' }}>
                      <path d="M2 4l4 4 4-4" />
                    </svg>
                  </div>
                )}

                {/* Close */}
                <button onClick={onClose} style={{ padding: 8, borderRadius: 8, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', cursor: 'pointer' }}>
                  <X size={15} style={{ color: 'var(--lms-danger)' }} />
                </button>
              </div>
            </div>

            {/* Preview banner */}
            <div style={{ padding: '5px 20px', background: 'var(--lms-info-bg)', borderBottom: '1.5px solid var(--lms-info-bdr)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Eye size={11} style={{ color: 'var(--lms-info)' }} />
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, fontWeight: 700, color: 'var(--lms-info)', letterSpacing: 0.4, textTransform: 'uppercase' }}>Preview</span>
              {filterDiff !== 'all' && (
                <span style={{ ...DS[filterDiff]?.pill, fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20, textTransform: 'capitalize', marginLeft: 4 }}>
                  Filtered: {filterDiff}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

              {/* Questions list */}
              <div className="lms-sidebar-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(() => {
                  if (filteredSavedQuestions.length === 0) return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--lms-text-hint)', gap: 12, paddingTop: 60 }}>
                      <Eye size={40} style={{ opacity: 0.15 }} />
                      <p style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 600 }}>
                        {filterDiff !== 'all' ? `No ${filterDiff} questions saved yet` : 'No saved questions yet'}
                      </p>
                      {filterDiff !== 'all' && (
                        <button onClick={() => setFilterDiff('all')}
                          style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, color: 'var(--lms-violet)', background: 'var(--lms-violet-bg)', border: '1.5px solid var(--lms-violet-bdr)', borderRadius: 20, padding: '4px 14px', cursor: 'pointer' }}>
                          Show all difficulties
                        </button>
                      )}
                    </div>
                  );

                  return filteredSavedQuestions.map((q, filteredIdx) => {
                    const originalIdx = questions.findIndex(x => x.__localId === q.__localId);
                    const ds = DS[q.difficulty] || DS.medium;
                    const isActive = originalIdx === currentIndex;
                    const isExpanded = expandedSet.has(filteredIdx);
                    const titleText = Array.isArray(q.title) ? getTitleText(q.title as any) || 'Untitled' : (q.title as string) || 'Untitled';
                    const qNum = (() => {
                      if (isGeneral) return filteredIdx + 1;
                      const sameD = filteredSavedQuestions.filter(x => x.difficulty === q.difficulty);
                      return sameD.findIndex(x => x.__localId === q.__localId) + 1;
                    })();

                    const tBlocks: any[] = [{ type: 'text', value: titleText }];
                    const dBlocks: any[] = Array.isArray(q.description) && (q.description as any[]).length > 0
                      ? (q.description as any[])
                      : (() => { const dObj: any = typeof q.description === 'object' && !Array.isArray(q.description) ? q.description : { text: '' }; return dObj?.contentBlocks || (dObj?.text?.trim() ? [{ type: 'text', value: dObj.text }] : []); })();
                    const hasRichTitle = tBlocks.some((b: any) => b.type === 'image' || b.type === 'code');
                    const hasDesc = dBlocks.some((b: any) => b.type !== 'text' || b.value?.trim());

                    const renderBlock = (b: any, bi: number) => {
                      if (b.type === 'text' && b.value?.trim())
                        return <p key={bi} style={{ fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 400, color: 'var(--lms-text-main)', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{b.value}</p>;
                      if (b.type === 'image')
                        return (
                          <div key={bi} style={{ display: 'flex', justifyContent: b.alignment === 'right' ? 'flex-end' : b.alignment === 'center' ? 'center' : 'flex-start' }}>
                            <img src={b.url} alt="" style={{ width: `${b.sizePercent || 70}%`, maxWidth: '100%', borderRadius: 6, border: '1px solid var(--lms-border)' }} />
                          </div>
                        );
                      if (b.type === 'code') {
                        const isDk = ['#1e1e1e', '#282a36', '#272822'].includes(b.bgColor);
                        return <pre key={bi} style={{ background: b.bgColor || '#f5f5f5', color: isDk ? '#d4d4d4' : '#1a1a2e', fontFamily: 'ui-monospace,monospace', fontSize: 11.5, padding: '10px 14px', borderRadius: 8, margin: 0, overflowX: 'auto', lineHeight: 1.6 }}>{b.value}</pre>;
                      }
                      return null;
                    };

                    return (
                      <div key={q.__localId} style={{
                        border: isActive ? `2px solid var(--lms-orange)` : '1.5px solid var(--lms-border)',
                        borderRadius: 12,
                        boxShadow: isActive ? '0 0 0 3px var(--lms-orange-light)' : '0 1px 4px rgba(0,0,0,0.05)',
                        transition: 'border-color 0.15s, box-shadow 0.15s',
                        flexShrink: 0,
                        overflow: 'visible',
                      }}>
                        <div style={{ padding: '12px 14px', background: isActive ? 'var(--lms-orange-50)' : 'var(--lms-bg-white)', borderRadius: isExpanded ? '10px 10px 0 0' : 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 30, height: 30, borderRadius: 9, fontSize: 12, fontWeight: 800,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              fontFamily: 'var(--lms-font)',
                              background: isActive ? 'var(--lms-orange)' : ds.bg,
                              color: isActive ? 'white' : ds.text,
                              border: `2px solid ${isActive ? 'transparent' : ds.border}`,
                            }}>{qNum}</span>
                            <p style={{ flex: 1, minWidth: 0, fontFamily: 'var(--lms-font)', fontSize: 13.5, fontWeight: 700, color: 'var(--lms-text-main)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titleText}</p>
                            {q._id && (
                              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 9, fontWeight: 700, color: 'var(--lms-success)', background: 'var(--lms-success-bg)', border: '1px solid var(--lms-success-bdr)', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>SAVED</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            {!isGeneral && (
                              <span style={{ ...ds.pill, fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 20, textTransform: 'capitalize' as const, flexShrink: 0 }}>{q.difficulty}</span>
                            )}
                            {subExerciseIsGraded && (
                              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', flexShrink: 0 }}>{q.score} marks</span>
                            )}
                            {subExerciseIsGraded && <span style={{ color: 'var(--lms-border)', fontSize: 11, flexShrink: 0 }}>·</span>}
                            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', flexShrink: 0 }}>{q.testCases?.length || 0} test case{(q.testCases?.length || 0) !== 1 ? 's' : ''}</span>
                            {q.isSaved && !q.isDirty && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: 'var(--lms-success)', fontWeight: 600, flexShrink: 0 }}>✓ Saved</span>}
                            {q.isDirty && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: 'var(--lms-warning)', fontWeight: 600, flexShrink: 0 }}>✎ Modified</span>}
                            <div style={{ flex: 1 }} />
                            <button onClick={() => { onJump(originalIdx); onClose(); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'var(--lms-warning-bg)', color: 'var(--lms-warning)', fontSize: 11, fontWeight: 700, border: '1.5px solid var(--lms-warning-bdr)', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--lms-font)', flexShrink: 0 }}>
                              <Edit2 size={11} /> Edit
                            </button>
                            <button onClick={() => setDeleteTarget({ localId: q.__localId, title: titleText })}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'var(--lms-danger-bg)', color: 'var(--lms-danger)', fontSize: 11, fontWeight: 700, border: '1.5px solid var(--lms-danger-bdr)', borderRadius: 7, cursor: 'pointer', fontFamily: 'var(--lms-font)', flexShrink: 0 }}>
                              <Trash2 size={11} /> Delete
                            </button>
                            <button onClick={() => setExpandedSet(prev => { const n = new Set(prev); n.has(filteredIdx) ? n.delete(filteredIdx) : n.add(filteredIdx); return n; })}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${isExpanded ? 'var(--lms-violet-bdr)' : 'var(--lms-border)'}`, background: isExpanded ? 'var(--lms-violet-bg)' : 'var(--lms-bg-surface)', cursor: 'pointer', color: isExpanded ? 'var(--lms-violet)' : 'var(--lms-text-muted)', flexShrink: 0, transition: 'all 0.15s' }}>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div style={{ borderTop: '1.5px solid var(--lms-border)', borderRadius: '0 0 10px 10px', padding: '10px 16px', display: 'flex', flexDirection: 'column' }}>
                            {hasRichTitle && (
                              <div>
                                <p className="lms-section-label">Problem Title</p>
                                <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--lms-bg-white)', padding: '0px 12px', borderRadius: 8, border: '1.5px solid var(--lms-border)' }}>
                                  {tBlocks.map(renderBlock)}
                                </div>
                              </div>
                            )}
                            {hasDesc && (
                              <div>
                                <p className="lms-section-label" style={{ marginBottom: 6 }}>Description</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--lms-bg-white)', padding: '10px 12px', borderRadius: 8, border: '1.5px solid var(--lms-border)' }}>
                                  {dBlocks.map(renderBlock)}
                                </div>
                              </div>
                            )}
                            {(q.testCases?.length || 0) > 0 && (
                              <div>
                                <p className="lms-section-label mt-5">Test Cases ({q.testCases.length})</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {q.testCases.map((tc: any, ti: number) => (
                                    <div key={ti} style={{ background: 'var(--lms-bg-white)', borderRadius: 8, border: '1.5px solid var(--lms-border)', overflow: 'hidden' }}>
                                      <div style={{ padding: '6px 10px', background: ti === 0 ? 'var(--lms-orange-50)' : 'var(--lms-bg-surface)', borderBottom: '1px solid var(--lms-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, fontWeight: 700, color: ti === 0 ? '#c85a30' : 'var(--lms-text-sec)' }}>
                                          Test Case {ti + 1}{ti === 0 ? ' · Sample' : ''}
                                        </span>
                                        {tc.isHidden && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'var(--lms-bg-surface2)', color: 'var(--lms-text-muted)' }}>Hidden</span>}
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                                        <div style={{ padding: '8px 12px', borderRight: '1px solid var(--lms-border)' }}>
                                          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 9.5, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Input</span>
                                          <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--lms-text-main)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{tc.input || <span style={{ color: 'var(--lms-text-hint)', fontStyle: 'italic' }}>empty</span>}</code>
                                        </div>
                                        <div style={{ padding: '8px 12px' }}>
                                          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 9.5, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Expected Output</span>
                                          <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--lms-text-main)', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>{tc.expectedOutput || <span style={{ color: 'var(--lms-text-hint)', fontStyle: 'italic' }}>empty</span>}</code>
                                        </div>
                                      </div>
                                      {tc.explanation && (
                                        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--lms-border)', background: 'var(--lms-bg-surface)' }}>
                                          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)' }}>{tc.explanation}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(q.constraints?.filter((c: string) => c?.trim()).length || 0) > 0 && (
                              <div>
                                <p className="lms-section-label mt-5">Constraints</p>
                                <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {q.constraints.filter((c: string) => c?.trim()).map((c: string, ci: number) => (
                                    <li key={ci} style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-main)' }}>{c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Right Sidebar */}
              <div style={{ width: 280, flexShrink: 0, borderLeft: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

                {/* Two action buttons */}
                <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1.5px solid var(--lms-border)', flexShrink: 0, background: 'var(--lms-bg-surface)' }}>
                  <button
                    onClick={() => setSidebarTab('details')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                      fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                      border: '1.5px solid var(--lms-border)',
                      background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    }}
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
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                      fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                      border: '1.5px solid var(--lms-border)',
                      background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    }}
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
                </div>

                {/* Stats */}
                <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>

                  {(() => {
                    const activeDiff = filterDiff === 'all' ? null : filterDiff as Diff;

                    // Per-difficulty computed values
                    const diffSlots = activeDiff ? getQuotaForDiff(activeDiff) : 0;
                    const diffCreated = activeDiff ? getCreatedCount(activeDiff) : 0;
                    const diffRemaining = activeDiff ? getRemainingSlots(activeDiff) : 0;
                    const diffMarksTotal = activeDiff ? getTotalMarksForDiff(activeDiff) : 0;
                    const diffMarksUsed = activeDiff ? savedQuestions.filter(q => q.difficulty === activeDiff).reduce((acc, q) => acc + (q.score || 0), 0) : 0;
                    const diffMarksRemaining = Math.max(0, diffMarksTotal - diffMarksUsed);
                    const diffFixedScore = activeDiff ? getFixedScore(activeDiff) : 0;
                    const diffDS = activeDiff ? (DS[activeDiff] || DS.medium) : null;

                    return (
                      <>
                        {/* ── Difficulty Questions (when a diff is selected) ── */}
                        {activeDiff && (
                          <div style={{ marginBottom: 14 }}>
                            <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                              <Hash size={12} style={{ color: diffDS.text }} />
                              <span style={{ textTransform: 'capitalize', color: diffDS.text }}>{activeDiff} Questions</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{diffSlots}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Created</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                                {diffCreated}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{diffSlots}</span>
                              </span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Remaining</span>
                              <span className="lms-marks-value" style={{ color: diffRemaining === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{diffRemaining}</span>
                            </div>
                            {diffSlots > 0 && (
                              <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                                <div className="lms-progress-fill" style={{
                                  width: `${Math.min(100, (diffCreated / diffSlots) * 100)}%`,
                                  background: diffRemaining === 0 ? 'var(--lms-success)' : diffDS.bar
                                }} />
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── Difficulty Marks (when a diff is selected + graded) ── */}
                        {activeDiff && subExerciseIsGraded && diffMarksTotal > 0 && (
                          <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14, marginBottom: 14 }}>
                            <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                              <Award size={12} style={{ color: diffDS.text }} />
                              <span style={{ textTransform: 'capitalize', color: diffDS.text }}>{activeDiff} Marks</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Mark</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{diffMarksTotal}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Mark Per Question</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>
                                {diffFixedScore}
                                {isScoreEditable(activeDiff)
                                  ? <span className="lms-badge lms-badge-violet" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3 }}>Custom</span>
                                  : <span className="lms-badge" style={{ fontSize: '9px', padding: '1px 5px', marginLeft: 3, background: 'var(--lms-bg-surface)', color: 'var(--lms-text-muted)', borderColor: 'var(--lms-border)' }}>Fixed</span>}
                              </span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Used Marks</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                                {fmtMark(diffMarksUsed)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{diffMarksTotal}</span>
                              </span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Remaining Marks</span>
                              <span className="lms-marks-value" style={{ color: diffMarksRemaining <= 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>{fmtMark(diffMarksRemaining)}</span>
                            </div>
                            <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                              <div className="lms-progress-fill" style={{
                                width: `${Math.min(100, (diffMarksUsed / diffMarksTotal) * 100)}%`,
                                background: diffMarksUsed >= diffMarksTotal ? 'var(--lms-success)' : diffDS.bar
                              }} />
                            </div>
                          </div>
                        )}

                        {/* ── Overall Questions (always visible) ── */}
                        <div style={{
                          borderTop: activeDiff ? '1.5px solid var(--lms-border)' : 'none',
                          paddingTop: activeDiff ? 14 : 0,
                          marginBottom: 14
                        }}>
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

                        {/* ── Overall Marks (always visible when graded) ── */}
                        {subExerciseIsGraded && totalMarksAll > 0 && (
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
                              <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{totalMarksAll}</span>
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
            <div style={{ padding: '12px 20px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'var(--lms-bg-white)' }}>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)' }}>
                {questions.filter(q => q.isSaved).length} saved · {questions.filter(q => !q.isSaved).length} unsaved
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} className="lms-cancel-btn">Continue Editing</button>
                <button onClick={onDone} className="lms-btn lms-btn-orange">
                  <Check size={13} /> Done
                </button>
              </div>
            </div>
          </div>
        </div>

        {deleteTarget && (
          <DeleteConfirmDialog questionTitle={deleteTarget.title}
            onConfirm={() => { onDelete(deleteTarget.localId); setDeleteTarget(null); }}
            onCancel={() => setDeleteTarget(null)} />
        )}
      </>
    );
  };


// ─── Move this OUTSIDE ProgrammingQuestionForm ────────────────────────────────

const TitleEditor: React.FC<{
  titleBlocks: ProgContentBlock[];
  setTitleBlocks: (blocks: ProgContentBlock[]) => void;
  isDisabled: boolean;
  hasError: boolean;
  setTouched: (fn: (prev: Set<string>) => Set<string>) => void;
  titleRef?: React.RefObject<HTMLTextAreaElement | null>;
}> = ({ titleBlocks, setTitleBlocks, isDisabled, hasError, setTouched }) => {
  const divRef = useRef<HTMLDivElement>(null);
  // Track the "source of truth" text so we can avoid re-setting
  // the DOM while the user is actively typing (which resets cursor).
  const lastSetText = useRef<string>('');

  const textBlock = titleBlocks.find(b => b.type === 'text');
  const currentText = textBlock ? (textBlock as any).value as string : '';

  // Only push value into DOM when it changes from *outside*
  // (e.g. question switch via loadQuestionIntoForm), not while typing.
  useEffect(() => {
    if (!divRef.current) return;
    if (currentText !== lastSetText.current) {
      divRef.current.innerHTML = currentText;
      lastSetText.current = currentText;
    }
  }, [currentText]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newText = e.currentTarget.innerHTML;
    lastSetText.current = newText; // keep ref in sync so effect won't overwrite
    if (textBlock) {
      setTitleBlocks(
        titleBlocks.map(b =>
          b.id === textBlock.id
            ? ({ ...b, value: newText } as ProgContentBlock)
            : b
        )
      );
    } else {
      const newTextBlock = mkProgTextBlock();
      (newTextBlock as any).value = newText;
      setTitleBlocks([newTextBlock, ...titleBlocks]);
    }
    if (newText.trim()) setTouched(p => new Set(p).add('title'));
  };

  return (
    <div
      ref={divRef}
      contentEditable={!isDisabled}
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={() => setTouched(p => new Set(p).add('title'))}
      data-placeholder="Type your question here..."
      style={{
        fontFamily: 'var(--lms-font)',
        fontSize: '15px',
        fontWeight: 500,
        color: 'var(--lms-text-main)',
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${isDisabled ? 'var(--lms-border)' : 'var(--lms-text-main)'}`,
        outline: 'none',
        width: '100%',
        padding: '4px 0',
        opacity: isDisabled ? 0.6 : 1,
        cursor: isDisabled ? 'not-allowed' : 'text',
        lineHeight: 1.65,
        minHeight: '40px',
        // Show placeholder via CSS when empty
        position: 'relative',
      }}
    />
  );
};
// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const ProgrammingQuestionForm: React.FC<ProgrammingQuestionFormProps> = ({
  exerciseData, tabType, initialData, isEditing = false,
  onClose, onSave, onDeleteQuestion, isSaving, saveProgress, saveMessage,
  lockedDifficulty, onEditExercise, sectionData, initialBankQuestions,
  initialBankSource,
  approval, approvalContext, onQueryResolved,
  autoOpenSource,
}) => {
  injectFonts();

  const [isEditMode, setIsEditMode] = useState(true); // always editable
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showEditExerciseConfirm, setShowEditExerciseConfirm] = useState(false);

  const [showTitleImgModal, setShowTitleImgModal] = useState(false);

  const returnIndexRef = useRef<number | null>(null);
  const returnDiffRef = useRef<Diff | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
const [showAddDropdown, setShowAddDropdown] = useState(false);
// Which source the teacher last picked from the + dropdown. Used as a
// fallback tag when a currently-loaded FlowQuestion has no source of its
// own (e.g. a brand-new manual question), so mkPayload can stamp the
// correct source on the save.
const pendingSourceRef = useRef<string>('scratch-manual');
const addDropdownRef = useRef<HTMLDivElement>(null);
const [showBankSelector, setShowBankSelector] = useState(false);
const [showAIModal, setShowAIModal] = useState(false);
// Auto-open source modal on mount when the caller (Add-Question popup)
// asks for a specific source. Fires once — subsequent renders don't
// re-open. Skips edit mode (teacher is editing an existing question).
const autoOpenFiredRef = useRef(false);
useEffect(() => {
  if (autoOpenFiredRef.current) return;
  if (isEditing) return;
  // Bank picks already preloaded for review — opening another source modal
  // on top would hide the review flow. Mark fired so it never opens late.
  if (initialBankQuestions && initialBankQuestions.length > 0) { autoOpenFiredRef.current = true; return; }
  if (!autoOpenSource || autoOpenSource === 'manual') return;
  autoOpenFiredRef.current = true;
  if (autoOpenSource === 'ai') {
    pendingSourceRef.current = 'ai';
    // Mark this as an auto-open so the modal's onClose knows it may cascade.
    sourceModalAutoOpenedRef.current = true;
    setShowAIModal(true);
  } else if (autoOpenSource === 'bank' || autoOpenSource === 'thirdParty') {
    pendingSourceRef.current = autoOpenSource === 'thirdParty' ? 'thirdParty' : 'scratch-bank';
    sourceModalAutoOpenedRef.current = true;
    setShowBankSelector(true);
  }
}, [autoOpenSource, isEditing, initialBankQuestions]);
// Whether the currently-open source modal (AI generator / bank picker) handed
// any questions to the flow. Set synchronously in handleBankSelectedQuestions —
// the AI modal calls onGenerated then onClose in the same tick, so React state
// is too stale to answer this at close time. Resets every time a modal opens.
const sourceModalAddedRef = useRef(false);
useEffect(() => {
  if (showAIModal || showBankSelector) sourceModalAddedRef.current = false;
}, [showAIModal, showBankSelector]);
// Distinguishes an AUTO-OPENED source modal (mounted by the auto-open effect
// or re-popped after Save & Next) from one the teacher opened by hand via the
// in-form "+" dropdown. Only auto-opened modals may cascade-close the whole
// form; a dropdown-opened modal must never tear the form down on dismiss.
const sourceModalAutoOpenedRef = useRef(false);
// Once the teacher dismisses an auto-opened modal with manual slots still to
// fill, suppress the re-pop so the AI/bank modal doesn't reappear after every
// manually-authored Save & Next. Re-armed only by explicitly re-opening the
// modal from the in-form "+" dropdown.
const autoReopenSuppressedRef = useRef(false);
// Tracks the deferred setTimeout(...) call in reopenSourceModalForBlankSlot so
// (a) dismissing the modal before the timer fires cancels it, and (b) unmount
// cannot leave a pending setState on an unmounted component.
const reopenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
useEffect(() => () => {
  if (reopenTimerRef.current) clearTimeout(reopenTimerRef.current);
}, []);
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
  const exerciseDbId = exerciseData?.exerciseId || exerciseData?.fullExerciseData?._id || exerciseData?.id || '';
  const entityId = exerciseData?.nodeId || '';

  const progCfg = exerciseData.fullExerciseData?.questionConfiguration?.programmingQuestionConfiguration;
  const cfgType = (progCfg?.questionConfigType as string) || 'general';
  const isGeneral = cfgType === 'general';

  // ── Question Source enforcement (single source of truth) ─────────────────
  // The `questionSource` field on the exercise decides which "+" dropdown items
  // are rendered. Buttons that shouldn't appear are removed from the DOM — not
  // shown-and-disabled — so the teacher never sees dimmed options they can't use.
  //   scratch     → Manual + Question Bank + Upload Document
  //   ai          → Generate AI only
  //   thirdParty  → Third-Party import only (Question Bank stands in until the
  //                 dedicated provider modal ships; provider list is in settings)
  //   custom      → all four allowed (Custom = mix any source)
  //   null/undef  → all allowed (back-compat for pre-Phase-2 exercises)
  const questionSourceRaw = exerciseData.fullExerciseData?.questionSource;
  const customSourcesRaw: string[] = Array.isArray(exerciseData.fullExerciseData?.customSources) ? exerciseData.fullExerciseData.customSources : [];
  const allowedSources = (() => {
    const s = questionSourceRaw || null;
    if (s === 'scratch') return { manual: true, bank: true, ai: false, thirdParty: false, upload: true };
    if (s === 'ai') return { manual: false, bank: false, ai: true, thirdParty: false, upload: false };
    if (s === 'thirdParty') return { manual: false, bank: true, ai: false, thirdParty: true, upload: false };
    if (s === 'custom') {
      // Custom = only the sub-sources the teacher ticked in Settings.
      const has = (x: string) => customSourcesRaw.includes(x);
      return { manual: has('scratch'), bank: has('scratch') || has('thirdParty'), ai: has('ai'), thirdParty: has('thirdParty'), upload: has('scratch') };
    }
    return { manual: true, bank: true, ai: true, thirdParty: true, upload: true };
  })();
  // Generic "Question Bank" is scratch's second entry point. Other Platform
  // (thirdParty) gets its OWN dropdown item that opens the same picker but
  // stamps imports with the thirdParty tag + its own quota slice — so the
  // generic item only shows when scratch itself is allowed.
  const bankViaScratch = (() => {
    const s = questionSourceRaw || null;
    if (!s) return true; // legacy exercises — allow all
    if (s === 'scratch') return true;
    if (s === 'custom') return customSourcesRaw.includes('scratch');
    return false;
  })();
  // isGraded: selectionLevel is always non-graded; general/levelBased respect the stored flag
  const isSelectionLevelType = cfgType === 'selectionLevel';
  const exerciseIsGraded = !isSelectionLevelType && (exerciseData.fullExerciseData?.isGraded !== false);

  const generalQuestionCount: number = progCfg?.generalQuestionCount || 0;
  const generalTotalMarks: number =
    exerciseData.fullExerciseData?.exerciseInformation?.totalMarksProgramming ||
    exerciseData.fullExerciseData?.exerciseInformation?.totalMarks || 0;
  const generalMPQ: number =
    progCfg?.generalMarksPerQuestion ||
    progCfg?.scoreSettings?.evenMarks ||
    Math.floor(generalTotalMarks / Math.max(1, generalQuestionCount));

  const getConfiguredDiffs = useCallback((): Diff[] => {
    if (isGeneral) return [];
    if (cfgType === 'levelBased') {
      const lsc = progCfg?.scoreSettings?.levelScoringConfiguration || {};
      return (['easy', 'medium', 'hard'] as Diff[]).filter(d => lsc[d]?.questionCount > 0);
    }
    if (cfgType === 'selectionLevel') {
      const sel = progCfg?.selectionLevelCounts || {};
      return (['easy', 'medium', 'hard'] as Diff[]).filter(d => (sel[d] || 0) > 0);
    }
    return [];
  }, [isGeneral, cfgType, progCfg]);
// Read from the exercise's questionSource (Phase 2). Hardcoded `true` removed.
const isAIAvailable = () => allowedSources.ai;




const getQuotaForDiff = useCallback((d: Diff): number => {
    if (cfgType === 'levelBased') {
      // levelBasedCounts is always the source of truth
      // levelScoringConfiguration.questionCount is stale — only use as last fallback
      return progCfg?.levelBasedCounts?.[d]
        || progCfg?.scoreSettings?.levelScoringConfiguration?.[d]?.questionCount
        || 0;
    }
    if (cfgType === 'selectionLevel') return progCfg?.selectionLevelCounts?.[d] || 0;
    return generalQuestionCount;
  }, [cfgType, progCfg, generalQuestionCount]);
  // AFTER (fixed)
  const getTotalMarksForDiff = useCallback((d: Diff): number => {
    const lsc = progCfg?.scoreSettings?.levelScoringConfiguration?.[d];
    const actualCount = getQuotaForDiff(d);

    if (!lsc) return 0;

    if (lsc.type === 'level_specific') {
      // DB may store totalMarks: 0 — always recalculate
      if (lsc.totalMarks && lsc.totalMarks > 0) return lsc.totalMarks;
      return (lsc.marksPerQuestion || progCfg?.scoreSettings?.levelBasedMarks?.[d] || 0) * actualCount;
    }

    if (lsc.type === 'question_specific') {
      return lsc.totalMarks || 0;
    }

    // Final fallback
    return (progCfg?.scoreSettings?.levelBasedMarks?.[d] || 0) * actualCount;
  }, [progCfg, getQuotaForDiff]);
  const getScoringType = useCallback((d: Diff): 'level_specific' | 'question_specific' | 'fixed' => {
    const lsc = progCfg?.scoreSettings?.levelScoringConfiguration?.[d];
    if (lsc?.type === 'question_specific') return 'question_specific';
    if (lsc?.type === 'level_specific') return 'level_specific';
    return 'fixed';
  }, [progCfg]);

  const getFixedScore = useCallback((d: Diff): number => {
    if (isGeneral) return generalMPQ;
    const lsc = progCfg?.scoreSettings?.levelScoringConfiguration?.[d];
    if (lsc?.type === 'level_specific') return lsc.marksPerQuestion || 0;
    return progCfg?.scoreSettings?.levelBasedMarks?.[d] || 0;
  }, [isGeneral, generalMPQ, progCfg]);

  const isScoreEditable = useCallback((d: Diff) =>
    !isGeneral && progCfg?.scoreSettings?.levelScoringConfiguration?.[d]?.type === 'question_specific',
    [isGeneral, progCfg]);

  const getDbQuestionsForDiff = useCallback((d?: Diff) => {
    const all = (exerciseData.fullExerciseData?.questions || [])
      .filter((q: any) => q.questionType === 'programming' && q.isActive !== false);
    if (!d) return all;
    return all.filter((q: any) => q.difficulty === d);
  }, [exerciseData]);

  const getDbIdSet = useCallback((d?: Diff): Set<string> => {
    const dbQs = getDbQuestionsForDiff(d);
    return new Set(dbQs.map((q: any) => q._id?.toString?.() || q._id).filter(Boolean));
  }, [getDbQuestionsForDiff]);

  const getDbMarksUsedForDiff = useCallback((d: Diff): number =>
    getDbQuestionsForDiff(d).reduce((s: number, q: any) => s + (q.score || q.points || 0), 0),
    [getDbQuestionsForDiff]);

  const getRemainingMarksForDiff = useCallback((d: Diff): number =>
    Math.max(0, getTotalMarksForDiff(d) - getDbMarksUsedForDiff(d)),
    [getTotalMarksForDiff, getDbMarksUsedForDiff]);

  const initialDiff: Diff = useMemo(() => {
    if (isEditing && initialData?.difficulty) return initialData.difficulty as Diff;
    if (lockedDifficulty) return lockedDifficulty;

    const configured = getConfiguredDiffs();
    if (configured.length === 0) return 'easy';

    // "Has open slots" = existing-in-DB count for this difficulty is below quota.
    const hasOpen = (d: Diff): boolean => {
      try {
        return getDbQuestionsForDiff(d).length < getQuotaForDiff(d);
      } catch { return false; }
    };

    // If the teacher arrived here from the Question Bank with selected questions,
    // prefer to START on a difficulty that BOTH matches one of those bank picks
    // AND still has open slots — so they aren't dumped on an "Easy Questions
    // Complete!" popup just because easy is full and the bank pick was a medium.
    // Walk in canonical order so the sequence remains easy → medium → hard.
    if (initialBankQuestions && initialBankQuestions.length > 0) {
      const bankDiffs = new Set<Diff>(
        initialBankQuestions.map((q: any) => {
          const d = String(q?.difficulty ?? 'medium').toLowerCase();
          return (d === 'easy' || d === 'hard') ? (d as Diff) : 'medium';
        })
      );
      for (const d of configured) {
        if (bankDiffs.has(d) && hasOpen(d)) return d;
      }
    }

    // Otherwise, just start on the first configured difficulty that still has
    // open slots (also walking in canonical easy → medium → hard order).
    for (const d of configured) {
      if (hasOpen(d)) return d;
    }

    // All quotas are already full — fall back to the first configured difficulty.
    return configured[0] || 'easy';
  }, [isEditing, initialData, lockedDifficulty, getConfiguredDiffs, getDbQuestionsForDiff, getQuotaForDiff, initialBankQuestions]);

  const buildInitialFlow = useCallback((): { questions: FlowQuestion[]; startIndex: number } => {
    if ((isEditing || initialData?._id) && initialData) {
      // ── Edit mode: load ALL saved questions across all difficulties ──────────
      // so that question numbering, navigation and difficulty switching all work
      let allPreExisting: FlowQuestion[] = [];
      if (isGeneral) {
        allPreExisting = getDbQuestionsForDiff().map(dbQuestionToFlow);
      } else {
        const diffs = getConfiguredDiffs();
        if (diffs.length > 0) {
          diffs.forEach(d => {
            allPreExisting.push(...getDbQuestionsForDiff(d).map(dbQuestionToFlow));
          });
        }
        // Fallback: load without difficulty filter if per-diff returned nothing
        if (allPreExisting.length === 0) {
          allPreExisting = getDbQuestionsForDiff().map(dbQuestionToFlow);
        }
      }
      // Guarantee the question being edited is present in the list
      if (allPreExisting.length === 0) {
        allPreExisting = [dbQuestionToFlow(initialData)];
      } else if (!allPreExisting.some(q => q._id === initialData._id)) {
        allPreExisting.unshift(dbQuestionToFlow(initialData));
      }
      const startIdx = Math.max(0, allPreExisting.findIndex(q => q._id === initialData._id));
      return { questions: allPreExisting, startIndex: startIdx };
    }
    if (isGeneral) {
      const preExisting: FlowQuestion[] = getDbQuestionsForDiff().map(dbQuestionToFlow);
      // Same clamp the level-based branch below has always had: when the
      // General quota is already met, land on the LAST saved question — not
      // on an out-of-quota blank slot. Without this, a plain Save on the
      // final question remounted the form (AddQuestionForm bumps refreshKey
      // after refetch) onto an empty "Question N+1" that could never be
      // saved. Reported with a 1-question exercise: save → blank Q2.
      const startIndex = (generalQuestionCount > 0 && preExisting.length >= generalQuestionCount)
        ? Math.max(0, preExisting.length - 1)
        : preExisting.length;
      return { questions: preExisting, startIndex };
    }
    // Load ALL configured difficulties so preview shows every existing question
    const allDiffs = getConfiguredDiffs();
    const preExisting: FlowQuestion[] = [];
    if (allDiffs.length > 0) {
      allDiffs.forEach(d => {
        preExisting.push(...getDbQuestionsForDiff(d).map(dbQuestionToFlow));
      });
    } else {
      const diff = lockedDifficulty || initialDiff;
      preExisting.push(...getDbQuestionsForDiff(diff).map(dbQuestionToFlow));
    }
    // startIndex = preExisting.length means "next empty slot for new question".
    // But if ALL difficulty quotas are already met, clamp to the last existing question
    // to avoid showing an empty out-of-bounds form (Q6 when quota is 5).
    const totalQuota = allDiffs.length > 0
      ? allDiffs.reduce((sum, d) => sum + getQuotaForDiff(d), 0)
      : getQuotaForDiff(lockedDifficulty || initialDiff);
    const startIndex = (totalQuota > 0 && preExisting.length >= totalQuota)
      ? Math.max(0, preExisting.length - 1)   // all full → land on last question
      : preExisting.length;                    // still room → land on next empty slot
    return { questions: preExisting, startIndex };
  }, [isEditing, initialData, isGeneral, generalQuestionCount, lockedDifficulty, initialDiff, getDbQuestionsForDiff, getConfiguredDiffs]);

  const initialFlow = useMemo(() => buildInitialFlow(), []);
  const [flowQuestions, setFlowQuestions] = useState<FlowQuestion[]>(initialFlow.questions);
  const [currentIndex, setCurrentIndex] = useState(initialFlow.startIndex);
  const [currentDiff, setCurrentDiff] = useState<Diff>(initialDiff);

  const flowQuestionsRef = useRef<FlowQuestion[]>(initialFlow.questions);
  const currentIndexRef = useRef<number>(initialFlow.startIndex);

  useEffect(() => { flowQuestionsRef.current = flowQuestions; }, [flowQuestions]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const serverIdMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    initialFlow.questions.forEach(q => {
      if (q._id && q.__localId) serverIdMap.current.set(q.__localId, q._id);
    });
  }, []);



  const getServerId = useCallback((q: FlowQuestion | null | undefined): string | undefined => {
    if (!q) return undefined;
    const mapped = serverIdMap.current.get(q.__localId);
    if (mapped) return mapped;
    if (q._id) return q._id;
    if (isEditing && initialData?._id) return initialData._id;
    return undefined;
  }, [isEditing, initialData]);

  const registerSavedId = useCallback((localId: string, serverId: string) => {
    serverIdMap.current.set(localId, serverId);
    setFlowQuestions(prev => {
      const next = prev.map(q =>
        q.__localId === localId ? { ...q, _id: serverId, isSaved: true, isDirty: false, isPreExisting: true } : q
      );
      flowQuestionsRef.current = next;
      return next;
    });
  }, []);

  // ── Form Fields ───────────────────────────────────────────────────────────
  const [titleBlocks, setTitleBlocks] = useState<ProgContentBlock[]>([mkProgTextBlock()]);
  const [desc, setDesc] = useState(''); // kept for backward compat
  const [descBlocks, setDescBlocks] = useState<ProgContentBlock[]>([mkProgTextBlock()]);
  const [constraints, setConstr] = useState<string[]>(['']);
  const [hint, setHint] = useState('');
  const [extraHints, setExtraH] = useState<Array<{ hintText: string; pointsDeduction: number; isPublic: boolean }>>([]);
  const [score, setScore] = useState(0);
  const [timeLimit, setTL] = useState(2000);
  const [memLimit, setML] = useState(256);
  const [tcs, setTcs] = useState<TC[]>([mkTC(0)]);
  // Per-question AI test case count — only relevant when the exercise's
  // evaluationMethod is 'ai' and testCasesCountMode is 'perQuestion'.
  // Otherwise stored-but-unused (harmless). null = not set (legacy questions).
  const [aiTestCasesCount, setAiTestCasesCount] = useState<number | null>(null);
  // Link-question mode: the toolbar radio switches the WHOLE form down to one
  // URL input; only that link is required to save. Students then get the URL
  // in an iframe instead of the question+compiler workspace.
  const [isLinkQuestion, setIsLinkQuestion] = useState(false);
  const [questionLink, setQuestionLink] = useState('');

  const [showPreview, setShowPreview] = useState(false);
  const [showMockModal, setShowMockModal] = useState(false);
  const [showDiffPopup, setShowDiffPopup] = useState(false);
  const [completedDiff, setCompletedDiff] = useState<Diff | null>(null);

  // On mount: if the component remounted after a plain Save and the current difficulty
  // quota is already full (startIndex is out-of-bounds), show DiffPopup immediately
  // instead of leaving the user staring at a blank Q6 form.
  useEffect(() => {
    if (isGeneral) return;
    if (lockedDifficulty) return; // user already picked a difficulty from the selector — don't re-show "complete" popup
    // If the form was opened with bank questions, the bank-preload effect will
    // place us on the right difficulty (matching the picks). Showing the
    // "Easy Questions Complete!" popup here would interrupt that flow — skip it.
    if (initialBankQuestions && initialBankQuestions.length > 0) return;
    const flow = flowQuestionsRef.current;
    const idx = currentIndexRef.current;
    if (idx < flow.length || flow.length === 0) return; // normal case — nothing to do
    const allDiffs = getConfiguredDiffs();
    for (const d of allDiffs) {
      const cnt = flow.filter(q =>
        q.difficulty === d &&
        !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
      ).length;
      if (cnt >= getQuotaForDiff(d)) {
        const remaining = allDiffs.filter(od => {
          if (od === d) return false;
          const oc = flow.filter(q =>
            q.difficulty === od &&
            !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
          ).length;
          return oc < getQuotaForDiff(od);
        });
        if (remaining.length > 0) {
          setCompletedDiff(d);
          setShowDiffPopup(true);
        }
        return;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [errs, setErrs] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [saveOk, setSaveOk] = useState(false);
  const [diffSwitchTarget, setDiffSwitchTarget] = useState<Diff | null>(null);
  const [editorState, setEditorState] = useState<{
    activeElement: HTMLElement | null;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
  }>({
    activeElement: null,
    isBold: false,
    isItalic: false,
    isUnderline: false,
  });

  // Toggle formatting functions
  const toggleBold = () => {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.getAttribute('contenteditable') === 'true')) {
      document.execCommand('bold', false);
      setEditorState(prev => ({ ...prev, isBold: !prev.isBold }));
    }
  };

  const toggleItalic = () => {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.getAttribute('contenteditable') === 'true')) {
      document.execCommand('italic', false);
      setEditorState(prev => ({ ...prev, isItalic: !prev.isItalic }));
    }
  };

  const toggleUnderline = () => {
    const activeElement = document.activeElement;
    if (activeElement && (activeElement.getAttribute('contenteditable') === 'true')) {
      document.execCommand('underline', false);
      setEditorState(prev => ({ ...prev, isUnderline: !prev.isUnderline }));
    }
  };

  // Update toolbar button states based on cursor position
  const updateFormattingState = () => {
    const activeElement = document.activeElement;
    if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
      setEditorState({
        activeElement: activeElement as HTMLElement,
        isBold: document.queryCommandState('bold'),
        isItalic: document.queryCommandState('italic'),
        isUnderline: document.queryCommandState('underline'),
      });
    }
  };

  // Handle selection change to update button states
  useEffect(() => {
    const handleSelectionChange = () => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
        updateFormattingState();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);





  const titleRef = useRef<HTMLTextAreaElement>(null);

  // ── Section refs for scroll-to-error ──────────────────────────────────────
  const scoreSectionRef = useRef<HTMLDivElement>(null);
  const titleSectionRef = useRef<HTMLDivElement>(null);
  const descSectionRef = useRef<HTMLDivElement>(null);
  const constraintsSectionRef = useRef<HTMLDivElement>(null);
  const testcasesSectionRef = useRef<HTMLDivElement>(null);
  const stickyToolbarRef = useRef<HTMLDivElement>(null);
  const formScrollRef = useRef<HTMLDivElement>(null);
  const [validationToast, setValidationToast] = useState<string[]>([]);

  const scrollToFirstError = (errors: Record<string, string>) => {
    // Score lives in the sticky toolbar (always visible) — no need to scroll to it.
    // Scroll only to content fields in top-to-bottom order.
    const order: { key: string; ref: React.RefObject<HTMLDivElement | null> }[] = [
      { key: 'title', ref: titleSectionRef },
      { key: 'description', ref: descSectionRef },
      { key: 'constraints', ref: constraintsSectionRef },
      { key: 'testcases', ref: testcasesSectionRef },
    ];
    for (const { key, ref } of order) {
      if (errors[key] && ref.current) {
        const container = formScrollRef.current;
        if (container) {
          // Offset scroll by the sticky toolbar height so the label is not hidden behind it
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
    // Show toast listing all missing fields
    const messages = Object.values(errors);
    if (messages.length > 0) {
      setValidationToast(messages);
      setTimeout(() => setValidationToast([]), 3000);
    }
  };


  const getRemainingSlots = useCallback((d?: Diff, withFlow?: FlowQuestion[]): number => {
    const flow = withFlow ?? flowQuestionsRef.current;
    if (isGeneral) {
      const quota = generalQuestionCount; if (quota <= 0) return 0;
      const dbQuestions = getDbQuestionsForDiff(); const dbIdSetAll = getDbIdSet();
      const newInSession = flow.filter(q => { const sid = serverIdMap.current.get(q.__localId) || q._id; if (!sid) return false; if (dbIdSetAll.has(sid.toString())) return false; return true; }).length;
      return Math.max(0, quota - (dbQuestions.length + newInSession));
    }
    if (!d) return 0;
    const quota = getQuotaForDiff(d); if (quota <= 0) return 0;
    const dbQsForDiff = getDbQuestionsForDiff(d); const dbIdSetForDiff = getDbIdSet(d);
    const newInSession = flow.filter(q => { if (q.difficulty !== d) return false; const sid = serverIdMap.current.get(q.__localId) || q._id; if (!sid) return false; if (dbIdSetForDiff.has(sid.toString())) return false; return true; }).length;
    return Math.max(0, quota - (dbQsForDiff.length + newInSession));
  }, [isGeneral, generalQuestionCount, getDbQuestionsForDiff, getDbIdSet, getQuotaForDiff, flowQuestions]);

  const getCreatedCount = useCallback((d?: Diff, withFlow?: FlowQuestion[]): number => {
    const quota = isGeneral ? generalQuestionCount : (d ? getQuotaForDiff(d) : 0);
    return quota - getRemainingSlots(d, withFlow);
  }, [isGeneral, generalQuestionCount, getQuotaForDiff, getRemainingSlots]);

  // ── Custom-mix quota (per-source × per-difficulty) ─────────────────────────
  // When the exercise's source is Custom with a distribution matrix, each
  // source only owns its slice of every difficulty's slots. Used counts mirror
  // getRemainingSlots: DB questions + flow entries saved this session.
  const customDist: any = exerciseData.fullExerciseData?.customDistribution;
  const useCustomDist = useMemo(() => {
    if (isGeneral) return false; // matrix only exists for level-based patterns
    if ((questionSourceRaw || null) !== 'custom' || !customDist) return false;
    const total = (['easy', 'medium', 'hard'] as const).reduce((s, r) =>
      s + (customDist[r]?.scratch || 0) + (customDist[r]?.ai || 0) + (customDist[r]?.thirdParty || 0), 0);
    return total > 0;
  }, [isGeneral, questionSourceRaw, customDist]);
  const srcOfTag = (tag: any): 'scratch' | 'ai' | 'thirdParty' | 'unknown' => {
    const s = (tag ?? '').toString();
    if (s.startsWith('scratch')) return 'scratch';
    if (s === 'ai') return 'ai';
    if (s.startsWith('thirdParty')) return 'thirdParty';
    return 'unknown';
  };
  // Staged flow entries: imported/generated but not yet saved. They already
  // hold a slot in the review queue, so quota math must count them — otherwise
  // reopening the AI modal / bank picker lets the teacher stack past the quota.
  // Blank editor placeholders (no title) are NOT staged work.
  // `excludeLocalId` drops one flow entry from the staged tally — the save-time
  // Manual gate passes the question BEING saved, whose own typed title would
  // otherwise count against `open` and block a legitimate save by one.
  const getStagedCount = useCallback((d: Diff, src?: 'scratch' | 'ai' | 'thirdParty', excludeLocalId?: string): number =>
    flowQuestionsRef.current.filter(q => {
      if (q.difficulty !== d) return false;
      if (excludeLocalId && q.__localId === excludeLocalId) return false;
      const sid = serverIdMap.current.get(q.__localId) || q._id;
      if (sid) return false; // saved / db-loaded — counted by getRemainingSlots
      const titleText = Array.isArray(q.title) ? getTitleText(q.title as any) : (q.title || '');
      if (!titleText.toString().trim()) return false;
      if (src) return srcOfTag((q as any).source) === src;
      return true;
    }).length, []);
  const getSourceRemaining = useCallback((src: 'scratch' | 'ai' | 'thirdParty', d: Diff, excludeLocalId?: string): number => {
    const open = Math.max(0, getRemainingSlots(d) - getStagedCount(d, undefined, excludeLocalId));
    if (!useCustomDist) return open;
    const quota = customDist?.[d]?.[src] || 0;
    const dbUsed = getDbQuestionsForDiff(d).filter((q: any) => srcOfTag(q.source) === src).length;
    const dbIdSetForDiff = getDbIdSet(d);
    const savedInSession = flowQuestionsRef.current.filter(q => {
      if (q.difficulty !== d) return false;
      if (srcOfTag((q as any).source) !== src) return false;
      const sid = serverIdMap.current.get(q.__localId) || q._id;
      if (!sid) return false;
      return !dbIdSetForDiff.has(sid.toString());
    }).length;
    return Math.max(0, Math.min(open, quota - (dbUsed + savedInSession + getStagedCount(d, src, excludeLocalId))));
  }, [useCustomDist, customDist, getRemainingSlots, getStagedCount, getDbQuestionsForDiff, getDbIdSet]);
  const getSourceRemainingTotal = useCallback((src: 'scratch' | 'ai' | 'thirdParty'): number => {
    if (isGeneral) return getRemainingSlots();
    return getConfiguredDiffs().reduce((s, d) => s + getSourceRemaining(src, d), 0);
  }, [isGeneral, getRemainingSlots, getConfiguredDiffs, getSourceRemaining]);

  const isExistingQuestion = useMemo(() => {
    const q = flowQuestions[currentIndex]; if (!q) return false;
    return !!(getServerId(q) || isEditing);
  }, [flowQuestions, currentIndex, isEditing, getServerId]);

  const hasUnsavedFormChanges = useMemo((): boolean => {
    const currentQ = flowQuestions[currentIndex];
    if (!currentQ || (!currentQ._id && !currentQ.isSaved && !currentQ.isPreExisting)) return !!(getTitleText(titleBlocks) || desc.trim());
    if (isEditMode && currentQ) {
      const existingDesc = typeof currentQ.description === 'object' ? currentQ.description?.text || '' : currentQ.description || '';
      return getTitleText(titleBlocks) !== (Array.isArray(currentQ.title) ? getTitleText(currentQ.title as any) : currentQ.title || '') || desc !== existingDesc || score !== (currentQ.score || 0) || timeLimit !== (currentQ.timeLimit || 2000) || memLimit !== (currentQ.memoryLimit || 256)
        || isLinkQuestion !== (currentQ.isLinkQuestion === true) || questionLink.trim() !== (currentQ.questionLink || '');
    }
    return false;
  }, [flowQuestions, currentIndex, isEditMode, titleBlocks, desc, score, timeLimit, memLimit, isLinkQuestion, questionLink]);

  const hasSavedQuestionsInSession = useMemo((): boolean =>
    flowQuestions.some(q => q.isSaved || q._id || serverIdMap.current.has(q.__localId)),
    [flowQuestions]);

  const shouldConfirmClose = useMemo((): boolean => hasUnsavedFormChanges || hasSavedQuestionsInSession, [hasUnsavedFormChanges, hasSavedQuestionsInSession]);

  const handleCloseRequest = useCallback(() => { if (shouldConfirmClose) setShowCloseConfirm(true); else onClose(); }, [shouldConfirmClose, onClose]);
  const handleCloseConfirmed = useCallback(() => { setShowCloseConfirm(false); onClose(); }, [onClose]);


  // Handle selection change to update button states
  useEffect(() => {
    const handleSelectionChange = () => {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
        updateFormattingState();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);


  useEffect(() => {
    const startQ = flowQuestions[initialFlow.startIndex];
    if (startQ) loadQuestionIntoForm(startQ);
    else resetForm(isGeneral ? generalMPQ : isScoreEditable(initialDiff) ? 0 : getFixedScore(initialDiff));
    setTimeout(() => titleRef.current?.focus(), 80);
  }, []);

  const loadQuestionIntoForm = (q: FlowQuestion) => {
    setTitleBlocks(titleToBlocks(q.title));

    // description is already a clean ProgContentBlock[] after dbQuestionToFlow normalizes it
    // but handle edge cases defensively
    let descBlocksLoaded: ProgContentBlock[];

    if (Array.isArray(q.description) && (q.description as any[]).length > 0) {
      descBlocksLoaded = (q.description as any[]).map((b: any) => ({
        ...b,
        id: b.id || `pb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }));
    } else {
      descBlocksLoaded = descToBlocks(q.description);
    }

    const plainText = descBlocksLoaded
      .filter(b => b.type === 'text')
      .map(b => (b as any).value)
      .join('\n');

    setDesc(plainText);
    setDescBlocks(descBlocksLoaded);

    setConstr(q.constraints?.length ? [...q.constraints] : ['']);
    setHint(q.hints?.[0]?.hintText || '');
    setExtraH(
      (q.hints || []).slice(1).map((h: any) => ({
        hintText: h.hintText,
        pointsDeduction: h.pointsDeduction || 0,
        isPublic: h.isPublic !== false,
      }))
    );
    setScore(q.score || 0);
    setTL(q.timeLimit || 2000);
    setML(q.memoryLimit || 256);
    setTcs(
      q.testCases?.length
        ? q.testCases.map((tc: any, i: number) => ({
          id: tc._id || `tc-${Date.now()}-${i}`,
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          isHidden: tc.isHidden || false,
          isSample: tc.isSample ?? i === 0,
          description: tc.explanation || `Test Case ${i + 1}`,
        }))
        : [mkTC(0)]
    );
    setCurrentDiff((q.difficulty as Diff) || currentDiff);
    // Per-question AI count — null if the field is absent (legacy questions).
    // The resolver falls back to the exercise's count when null; the form
    // requires a value only when the exercise is in perQuestion mode.
    const rawAiCount = (q as any)?.aiTestCasesCount;
    setAiTestCasesCount(
      typeof rawAiCount === 'number' && rawAiCount >= 0 ? Math.min(50, Math.floor(rawAiCount)) : null,
    );
    setIsLinkQuestion(q.isLinkQuestion === true);
    setQuestionLink(q.questionLink || '');
    setErrs({});
    setTouched(new Set());
    setIsEditMode(!!(getServerId(q)));
  };

  const resetForm = (defaultScore?: number) => {
    setTitleBlocks([mkProgTextBlock()]); setDesc(''); setDescBlocks([mkProgTextBlock()]); setConstr(['']); setHint(''); setExtraH([]);
    setScore(defaultScore ?? (isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)));
    setTL(2000); setML(256); setTcs([mkTC(0)]); setErrs({}); setTouched(new Set()); setIsEditMode(false);
    setAiTestCasesCount(null);
    setIsLinkQuestion(false); setQuestionLink('');
  };

  const snapshotForm = (overrides?: Partial<FlowQuestion>): FlowQuestion => {
    const existing = flowQuestionsRef.current[currentIndexRef.current];
    const allHints = hint.trim()
      ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 },
      ...extraHints.map((h, i) => ({ ...h, sequence: i + 1 }))]
      : extraHints.map((h, i) => ({ ...h, sequence: i }));
    const finalScore = isGeneral
      ? generalMPQ
      : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff);
    const serverId = getServerId(existing) || overrides?._id;

    return {
      __localId: existing?.__localId || mkLocalId(),
      _id: serverId,
      sectionId: exerciseData?.currentSectionId || null,  // ✅ ADD THIS
      title: getTitleText(titleBlocks) || '',
      description: descBlocks, // ← pure ProgContentBlock[] array, normalized on save via mkPayload
      difficulty: isGeneral ? 'medium' : currentDiff,
      score: finalScore,
      testCases: tcs.map((tc, i) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isSample: tc.isSample,
        isHidden: tc.isHidden,
        points: 1,
        explanation: tc.description || `Test Case ${i + 1}`,
        sequence: i,
      })),
      constraints: constraints.filter(c => c.trim()),
      hints: allHints,
      timeLimit,
      memoryLimit: memLimit,
      questionType: 'programming',
      isSaved: !!(serverId) || existing?.isSaved || false,
      isDirty: !!(serverId),
      isPreExisting: existing?.isPreExisting || !!(serverId) || false,
      // Per-question AI test case count — only meaningful when the exercise's
      // evaluationMethod is 'ai' + testCasesCountMode 'perQuestion'.
      aiTestCasesCount,
      isLinkQuestion,
      questionLink: questionLink.trim(),
      ...overrides,
    };
  };


  const mkPayload = () => {
    const safeTitle = getTitleText(titleBlocks) || '';
    const allHints = hint.trim()
      ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 },
      ...extraHints.map((h, i) => ({ ...h, sequence: i + 1 }))]
      : extraHints.map((h, i) => ({ ...h, sequence: i }));
    const finalScore = isGeneral
      ? generalMPQ
      : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff);

    // Source tag: prefer the FlowQuestion's own source (set when it was
    // imported from bank / AI / doc), else fall back to the last-clicked
    // source in the + dropdown (manual by default).
    const currentQ = flowQuestionsRef.current[currentIndexRef.current];
    const questionSourceTag = (currentQ as any)?.source || pendingSourceRef.current || 'scratch-manual';

    return {
      questionType: 'programming',
      sectionId: exerciseData?.currentSectionId || null,  // ✅ ADD THIS
      source: questionSourceTag,
      // Bank-origin id rides to the DB so the same bank question can't be
      // imported twice (picker disable + server duplicate rejection).
      bankQuestionId: (currentQ as any)?.bankQuestionId || null,

      title: safeTitle,
      // Always serialize as { contentBlocks, text, imageUrl, ... } for DB
      description: {
        contentBlocks: descBlocks,
        text: descBlocks
          .filter(b => b.type === 'text')
          .map(b => (b as any).value)
          .join('\n')
          .trim(),
        imageUrl: (descBlocks.find(b => b.type === 'image') as any)?.url || null,
        imageAlignment: (descBlocks.find(b => b.type === 'image') as any)?.alignment || 'left',
        imageSizePercent: (descBlocks.find(b => b.type === 'image') as any)?.sizePercent || 100,
      },
      difficulty: isGeneral ? 'medium' : currentDiff,
      score: finalScore,
      points: finalScore,
      constraints: constraints.filter(c => c.trim()),
      hints: allHints,
      testCases: tcs.map((tc, i) => ({
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isSample: tc.isSample,
        isHidden: tc.isHidden,
        points: 1,
        explanation: tc.description || `Test Case ${i + 1}`,
        sequence: i,
      })),
      solutions: { startedCode: '', functionName: 'main', language: 'python' },
      timeLimit,
      memoryLimit: memLimit,
      isActive: true,
      // Per-question AI test case count. Server persists as-is; falls back to
      // the exercise's count for legacy questions where this is null. Only
      // ENFORCED at Save-time in the form when the exercise is in
      // 'perQuestion' mode (see validate()).
      aiTestCasesCount,
      // Link questions: only these two + a title (the URL) matter; the server
      // skips title/description validation when isLinkQuestion is true.
      isLinkQuestion,
      questionLink: questionLink.trim(),
      ...(isLinkQuestion && !safeTitle ? { title: questionLink.trim() } : {}),
    };
  };
  const handleEditClick = () => setIsEditMode(true);
  const handleCancelEdit = () => { setIsEditMode(false); if (flowQuestions[currentIndex]) loadQuestionIntoForm(flowQuestions[currentIndex]); };
  const handleEditExerciseClick = () => setShowEditExerciseConfirm(true);
  const handleEditExerciseConfirm = () => { setShowEditExerciseConfirm(false); onEditExercise?.(); };
  const handleDiffRowClick = (d: Diff) => { if (d === currentDiff) return; setDiffSwitchTarget(d); };

  const confirmDiffSwitch = (overrideDiff?: Diff) => {
    // Guard: only accept a real Diff string — never a MouseEvent or other non-string value
    const d = (typeof overrideDiff === 'string' ? overrideDiff : null) ?? diffSwitchTarget;
    if (!d) return;
    setDiffSwitchTarget(null);

    // ── 1. Snapshot current form into flow synchronously (single setFlowQuestions call) ──
    const snap = snapshotForm({ isSaved: flowQuestions[currentIndex]?.isSaved || false, _id: getServerId(flowQuestions[currentIndex]) });
    const snapFlow = [...flowQuestionsRef.current];
    if (currentIndex < snapFlow.length) snapFlow[currentIndex] = snap;
    flowQuestionsRef.current = snapFlow; // keep ref in sync before using it below
    setFlowQuestions(snapFlow);

    // ── 2. Load DB questions for target diff if not yet in flow ──
    const alreadyInFlow = snapFlow.some(q => q.difficulty === d);
    let questionsToAdd: FlowQuestion[] = [];
    if (!alreadyInFlow) {
      const dbQs = getDbQuestionsForDiff(d);
      questionsToAdd = dbQs.map(dbQuestionToFlow);
      questionsToAdd.forEach(q => { if (q._id) serverIdMap.current.set(q.__localId, q._id); });
    }
    const flowAfterDbLoad = [...snapFlow, ...questionsToAdd];
    const remainingAfterLoad = getRemainingSlots(d, flowAfterDbLoad);

    // ── 3. Difficulty is full → navigate to last question of that specific difficulty ──
    if (remainingAfterLoad <= 0) {
      flowQuestionsRef.current = flowAfterDbLoad; setFlowQuestions(flowAfterDbLoad);
      const dIndices = flowAfterDbLoad.reduce<number[]>((acc, q, i) => { if (q.difficulty === d) acc.push(i); return acc; }, []);
      const lastDIdx = dIndices.length > 0 ? dIndices[dIndices.length - 1] : flowAfterDbLoad.length - 1;
      currentIndexRef.current = lastDIdx; setCurrentIndex(lastDIdx); setCurrentDiff(d);
      if (flowAfterDbLoad[lastDIdx]) loadQuestionIntoForm(flowAfterDbLoad[lastDIdx]);
      setTimeout(() => titleRef.current?.focus(), 80); return;
    }

    const defaultScore = isScoreEditable(d) ? 0 : getFixedScore(d);

    // ── 4. Reuse existing unsaved empty question for this diff rather than creating a duplicate ──
    const existingEmptyIdx = flowAfterDbLoad.findIndex(
      q => q.difficulty === d && !q.isSaved && !q._id && !serverIdMap.current.get(q.__localId)
    );
    if (existingEmptyIdx >= 0) {
      flowQuestionsRef.current = flowAfterDbLoad; setFlowQuestions(flowAfterDbLoad);
      currentIndexRef.current = existingEmptyIdx; setCurrentIndex(existingEmptyIdx); setCurrentDiff(d);
      resetForm(defaultScore); setTimeout(() => titleRef.current?.focus(), 80); return;
    }

    // ── 5. Create a new empty question for difficulty d ──
    const newQ: FlowQuestion = { __localId: mkLocalId(), _id: undefined, title: '', description: { text: '', imageUrl: null, imageAlignment: 'left', imageSizePercent: 100 }, difficulty: d, score: defaultScore, testCases: [], constraints: [], hints: [], timeLimit: 2000, memoryLimit: 256, questionType: 'programming', isSaved: false, isDirty: false };
    const newFlow = [...flowAfterDbLoad, newQ];
    flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
    const newIdx = newFlow.length - 1; currentIndexRef.current = newIdx; setCurrentIndex(newIdx); setCurrentDiff(d);
    resetForm(defaultScore); setTimeout(() => titleRef.current?.focus(), 80);
  };

  const handleDeleteQuestion = async (localId: string) => {
    const targetQ = flowQuestionsRef.current.find(q => q.__localId === localId);
    const serverId = serverIdMap.current.get(localId) || targetQ?._id;

    // If it exists in the DB, call the delete API first
    if (serverId && onDeleteQuestion) {
      try {
        await onDeleteQuestion(serverId as string);
      } catch (err) {
        console.error('Failed to delete question from DB:', err);
        return; // Don't remove from UI if DB delete failed
      }
    }

    // Remove from local flow
    setFlowQuestions(prev => { const next = prev.filter(q => q.__localId !== localId); flowQuestionsRef.current = next; return next; });
    serverIdMap.current.delete(localId);
    const deletedIdx = flowQuestionsRef.current.findIndex(q => q.__localId === localId);
    const remainingFlow = flowQuestionsRef.current.filter(q => q.__localId !== localId);
    const newIdx = Math.min(currentIndex, remainingFlow.length - 1);
    if (newIdx >= 0 && remainingFlow[newIdx]) { setCurrentIndex(newIdx); currentIndexRef.current = newIdx; loadQuestionIntoForm(remainingFlow[newIdx]); }
    else { setCurrentIndex(0); currentIndexRef.current = 0; resetForm(isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)); }
  };


  const handleDeleteCurrentQuestion = async () => {
    const currentQ = flowQuestions[currentIndex];
    if (!currentQ) return;

    const serverId = serverIdMap.current.get(currentQ.__localId) || currentQ._id;
    const currentIdx = currentIndex;

    // If it exists in the DB, call the delete API first
    if (serverId && onDeleteQuestion) {
      try {
        await onDeleteQuestion(serverId as string);
      } catch (err) {
        console.error('Failed to delete question from DB:', err);
        setShowDeleteConfirm(false);
        return;
      }
    }

    // Remove from local flow
    setFlowQuestions(prev => {
      const newFlow = prev.filter(q => q.__localId !== currentQ.__localId);
      flowQuestionsRef.current = newFlow;

      // Determine new index
      let newIndex = currentIdx;
      if (newFlow.length === 0) {
        // No questions left, create a new empty question
        const emptyQ: FlowQuestion = {
          __localId: mkLocalId(),
          _id: undefined,
          title: '',
          description: [mkProgTextBlock()],
          difficulty: isGeneral ? 'medium' : currentDiff,
          score: isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)),
          testCases: [mkTC(0)],
          constraints: [],
          hints: [],
          timeLimit: 2000,
          memoryLimit: 256,
          questionType: 'programming',
          isSaved: false,
          isDirty: false,
          isPreExisting: false,
        };
        newFlow.push(emptyQ);
        newIndex = 0;
      } else if (currentIdx >= newFlow.length) {
        newIndex = newFlow.length - 1;
      } else if (currentIdx > 0) {
        newIndex = currentIdx - 1; // Go to previous
      } else {
        newIndex = 0;
      }

      // Load the question at new index
      setTimeout(() => {
        if (newFlow[newIndex]) {
          setCurrentIndex(newIndex);
          currentIndexRef.current = newIndex;
          loadQuestionIntoForm(newFlow[newIndex]);
          if (!isGeneral && newFlow[newIndex]?.difficulty) {
            setCurrentDiff(newFlow[newIndex].difficulty as Diff);
          }
        } else {
          resetForm(isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)));
        }
        setTimeout(() => titleRef.current?.focus(), 80);
      }, 0);

      return newFlow;
    });

    serverIdMap.current.delete(currentQ.__localId);
    setShowDeleteConfirm(false);
  };

  const handleClearCurrentQuestion = () => {
    // Reset all form fields
    setTitleBlocks([mkProgTextBlock()]);
    setDesc('');
    setDescBlocks([mkProgTextBlock()]);
    setConstr(['']);
    setHint('');
    setExtraH([]);
    setScore(isGeneral ? generalMPQ : (isScoreEditable(currentDiff) ? 0 : getFixedScore(currentDiff)));
    setTL(2000);
    setML(256);
    setTcs([mkTC(0)]);
    setErrs({});
    setTouched(new Set());
    setIsEditMode(false);

    // Update the flow
    const currentQ = flowQuestions[currentIndex];
    if (currentQ) {
      const clearedQ = {
        ...currentQ,
        title: '',
        description: [mkProgTextBlock()],
        testCases: [mkTC(0)],
        constraints: [],
        hints: [],
        isDirty: false,
        isSaved: false,
      };
      setFlowQuestions(prev => {
        const newFlow = [...prev];
        newFlow[currentIndex] = clearedQ;
        flowQuestionsRef.current = newFlow;
        return newFlow;
      });
    }

    setShowClearConfirm(false);
    setTimeout(() => titleRef.current?.focus(), 80);
  };
  const handlePrevious = () => {
    const idx = currentIndexRef.current; const flow = flowQuestionsRef.current; if (idx <= 0) return;
    const existingQ = flow[idx];
    const snap = snapshotForm({ isSaved: existingQ?.isSaved || !!(getServerId(existingQ)), _id: getServerId(existingQ), isDirty: !!(getServerId(existingQ)), isPreExisting: existingQ?.isPreExisting });
    const newFlow = [...flow]; newFlow[idx] = snap; flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
    const prevIdx = idx - 1; currentIndexRef.current = prevIdx; setCurrentIndex(prevIdx);
    // Switch difficulty if the previous question lives in a different one (level mode only)
    if (!isGeneral && newFlow[prevIdx]?.difficulty) {
      setCurrentDiff(newFlow[prevIdx].difficulty as Diff);
    }
    loadQuestionIntoForm(newFlow[prevIdx]);
    setTimeout(() => titleRef.current?.focus(), 80);
  };
const handleBankSelectedQuestions = useCallback((selected: any[], sourceTag?: string) => {
  // Tag EVERY imported question with the source it came from so mkPayload
  // emits the right `source` field on save. Callers pass an explicit tag
  // (e.g. 'ai', 'scratch-bank'); default to the ref (Manual by default).
  const tag = sourceTag || pendingSourceRef.current || 'scratch-bank';
  // Accept the whole programming family — core programming, frontend and database.
  const programmingQuestions = selected.filter(q =>
    ['programming', 'frontend', 'database'].includes((q.questionType || '').toLowerCase())
  );
  
  if (!selected.length) {
    toast.info('No questions selected', 'Please select questions from the bank.');
    return;
  }
  
  if (programmingQuestions.length === 0) {
    toast.warning('No programming questions selected', 
      'Please select programming questions from the bank. Only programming questions can be added to this exercise.');
    return;
  }
  
  // Log if some questions were filtered out
  if (programmingQuestions.length < selected.length) {
    const filteredOut = selected.length - programmingQuestions.length;
    toast.info(`${filteredOut} non-programming question${filteredOut > 1 ? 's were' : ' was'} skipped`, 
      'Only programming questions can be added to this exercise.');
  }

  // Map bank question to Programming question format
  const bankToProgrammingQuestion = (q: any): Partial<FlowQuestion> => {
    // Extract title - handle different formats
    let titleText = '';
    if (typeof q.title === 'string') {
      titleText = q.title;
    } else if (q.mcqQuestionTitle) {
      if (typeof q.mcqQuestionTitle === 'string') titleText = q.mcqQuestionTitle;
      else if (Array.isArray(q.mcqQuestionTitle)) {
        titleText = q.mcqQuestionTitle.filter((b: any) => b.type === 'text').map((b: any) => b.value).join(' ').trim();
      }
    }
    
    // Extract description - handle different formats
    let descriptionBlocks: ProgContentBlock[] = [];
    let descriptionText = '';
    
    if (q.description) {
      if (typeof q.description === 'string') {
        descriptionText = q.description;
      } else if (q.description.contentBlocks) {
        descriptionBlocks = q.description.contentBlocks;
      } else if (q.description.text) {
        descriptionText = q.description.text;
      } else {
        descriptionText = q.description;
      }
    }
    
    // If no description blocks, create one from description text
    if (descriptionBlocks.length === 0 && descriptionText) {
      descriptionBlocks = [{ id: `pb-${Date.now()}`, type: 'text' as const, value: descriptionText }];
    } else if (descriptionBlocks.length === 0) {
      descriptionBlocks = [mkProgTextBlock()];
    }
    
    // Extract constraints
    let constraintsList: string[] = [];
    if (q.constraints && Array.isArray(q.constraints)) {
      constraintsList = q.constraints;
    } else if (q.constraints && typeof q.constraints === 'string') {
      constraintsList = [q.constraints];
    }
    
    // Extract test cases
    let testCasesList: any[] = [];
    if (q.testCases && Array.isArray(q.testCases)) {
      testCasesList = q.testCases.map((tc: any) => ({
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        isSample: tc.isSample || false,
        isHidden: tc.isHidden || false,
        points: tc.points || 1,
        explanation: tc.explanation || `Test Case`,
        sequence: tc.sequence || 0,
      }));
    } else if (q.sampleInput && q.sampleOutput) {
      testCasesList = [{
        input: q.sampleInput,
        expectedOutput: q.sampleOutput,
        isSample: true,
        isHidden: false,
        points: 1,
        explanation: 'Sample Test Case',
        sequence: 0,
      }];
    }
    
    // If no test cases, create a default one
    if (testCasesList.length === 0) {
      testCasesList = [mkTC(0)];
    }
    
    // Get difficulty
    let difficulty: Diff = 'medium';
    if (q.difficulty) {
      const diffLower = q.difficulty.toLowerCase();
      if (diffLower === 'easy') difficulty = 'easy';
      else if (diffLower === 'hard') difficulty = 'hard';
      else difficulty = 'medium';
    } else if (q.mcqQuestionDifficulty) {
      const diffLower = q.mcqQuestionDifficulty.toLowerCase();
      if (diffLower === 'easy') difficulty = 'easy';
      else if (diffLower === 'hard') difficulty = 'hard';
      else difficulty = 'medium';
    }
    
    // Extract hints
    let hintsList: any[] = [];
    if (q.hints && Array.isArray(q.hints)) {
      hintsList = q.hints;
    } else if (q.hint) {
      hintsList = [{ hintText: q.hint, pointsDeduction: 0, isPublic: true, sequence: 0 }];
    }
    
    // Get score
    let questionScore = 0;
    if (q.score !== undefined && q.score !== null) {
      questionScore = q.score;
    } else if (q.mcqQuestionScore !== undefined && q.mcqQuestionScore !== null) {
      questionScore = q.mcqQuestionScore;
    } else {
      // Try to get from exercise configuration
      if (isGeneral) {
        questionScore = generalMPQ;
      } else if (typeof isScoreEditable === 'function' && isScoreEditable(currentDiff as Diff)) {
        questionScore = 0;
      } else if (typeof getFixedScore === 'function') {
        questionScore = getFixedScore(currentDiff as Diff);
      }
    }
    
    return {
      title: titleText || 'Untitled Programming Question',
      description: descriptionBlocks,
      difficulty: difficulty,
      score: questionScore,
      constraints: constraintsList,
      testCases: testCasesList,
      hints: hintsList,
      timeLimit: q.timeLimit || 2000,
      memoryLimit: q.memoryLimit || 256,
    };
  };

  // Auto-distribute marks for question-specific scoring
  const autoScore = (() => {
    if (isGeneral) return undefined;
    if (typeof isScoreEditable === 'function' && !isScoreEditable(currentDiff as Diff)) return undefined;
    if (typeof getRemainingMarksForDiff === 'function') {
      const remainingMarks = getRemainingMarksForDiff(currentDiff as Diff);
      if (remainingMarks > 0 && selected.length > 0) {
        return parseFloat((remainingMarks / selected.length).toFixed(2));
      }
    }
    return undefined;
  })();

  // Add questions from bank
  const newQuestions: FlowQuestion[] = selected.map((q, i) => {
    const base = bankToProgrammingQuestion(q);
    const newId = mkLocalId();
    
    // Calculate score
    let questionScore = base.score;
    if (autoScore !== undefined) {
      questionScore = autoScore;
    } else if (isGeneral) {
      questionScore = generalMPQ;
    } else if (typeof isScoreEditable === 'function' && isScoreEditable(currentDiff as Diff)) {
      questionScore = 0;
    } else if (typeof getFixedScore === 'function') {
      questionScore = getFixedScore(currentDiff as Diff);
    }
    
    const newQ: FlowQuestion = {
      __localId: newId,
      _id: undefined,
      title: base.title || '',
      description: base.description || [mkProgTextBlock()],
      difficulty: base.difficulty || (typeof currentDiff === 'string' ? currentDiff as Diff : 'medium'),
      score: questionScore,
      testCases: base.testCases || [mkTC(0)],
      constraints: base.constraints || [],
      hints: base.hints || [],
      timeLimit: base.timeLimit || 2000,
      memoryLimit: base.memoryLimit || 256,
      questionType: 'programming',
      // Preserve the incoming question's stored source if any, else stamp
      // with the caller-provided tag ('scratch-bank' / 'ai' / …).
      source: (q as any)?.source || tag,
      // Bank imports keep their origin id (the emitted bank row's own _id);
      // AI/doc questions come through here with no id and stay null.
      bankQuestionId: (q as any)?._id || (q as any)?.bankQuestionId || null,
      isSaved: false,
      isDirty: false,
      isPreExisting: false,
    };
    return newQ;
  });

  if (newQuestions.length === 0) {
    toast.warning('No questions to add', 'No valid programming questions were selected.');
    return;
  }

  // Fill the CURRENT blank slot in place when there is one — a difficulty
  // switch materializes an empty slot (e.g. Medium #1), and unconditionally
  // appending put the imported question at #2 while #1 stayed empty forever.
  // Otherwise append and navigate to the FIRST new one. Use the live ref (not
  // the closure's stale `flowQuestions.length`) — the closure-captured value
  // can lag behind a freshly-saved Q on Save & Continue, which would otherwise
  // put currentIndex one slot AHEAD of the first new question and skip it.
  const liveFlow = flowQuestionsRef.current;
  const idxNow = currentIndexRef.current;
  const curSlot = liveFlow[idxNow];
  const curTitle = curSlot ? (Array.isArray(curSlot.title) ? getTitleText(curSlot.title as any) : (curSlot.title || '')) : '';
  const curIsBlank = !!curSlot
    && !(serverIdMap.current.get(curSlot.__localId) || curSlot._id || curSlot.isSaved || curSlot.isPreExisting)
    && !curTitle.toString().trim()
    && !(curSlot as any).source;
  const fillInPlace = curIsBlank && (isGeneral || newQuestions[0].difficulty === curSlot.difficulty);
  const merged = fillInPlace
    ? [...liveFlow.slice(0, idxNow), newQuestions[0], ...newQuestions.slice(1), ...liveFlow.slice(idxNow + 1)]
    : [...liveFlow, ...newQuestions];
  flowQuestionsRef.current = merged;
  setFlowQuestions(merged);
  sourceModalAddedRef.current = true;

  const newStartIndex = fillInPlace ? idxNow : liveFlow.length; // position of the FIRST new question
  currentIndexRef.current = newStartIndex;
  setCurrentIndex(newStartIndex);

  // Load the first new question into the form
  if (newQuestions[0]) {
    setTimeout(() => {
      loadQuestionIntoForm(newQuestions[0]);
    }, 100);
  }

  toast.success(`${newQuestions.length} programming question${newQuestions.length > 1 ? 's' : ''} added from bank`);
  
  if (autoScore !== undefined && autoScore > 0) {
    toast.info('Marks distributed', `Each question assigned ${autoScore} mark${autoScore !== 1 ? 's' : ''} from remaining balance.`);
  }
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [currentDiff, isGeneral, isScoreEditable, getFixedScore, getRemainingMarksForDiff, generalMPQ, flowQuestions.length, loadQuestionIntoForm]);

  // ─── UPLOAD VIA DOCUMENT (.txt) ──────────────────────────────────────────────
  // Programming docs carry test cases / constraints (not A–D options). Parsed
  // questions are routed through the SAME inject path the Bank + AI use, so they
  // land in the flow with their test cases by difficulty.
  const docInputRef = useRef<HTMLInputElement>(null);
  // Parsed doc questions awaiting the trainer's quota-capped selection — the
  // DocQuestionPicker sits between parse and inject so a doc with more
  // questions than open Manual slots can't flood the flow.
  const [docPickerQs, setDocPickerQs] = useState<any[] | null>(null);
  const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseProgrammingFile(file);
      if (!parsed.length) {
        toast.warning('No questions found', 'Could not parse any questions — check the .txt format (Title:, Description:, Difficulty:, Input:/Output:).');
        return;
      }
      setDocPickerQs(parsed.map((q, i) => ({ ...q, _previewId: `doc-${i}` })));
    } catch (err: any) {
      toast.error('Upload failed', err?.message || 'Could not read the file.');
    }
  };

  // Pre-load bank questions handed in from the Question Bank selector (run once on open).
  const bankPreloadedRef = useRef(false);
  useEffect(() => {
    if (!bankPreloadedRef.current && initialBankQuestions && initialBankQuestions.length > 0) {
      bankPreloadedRef.current = true;
      // Stamp with the caller's tag — Other Platform imports carry 'thirdParty'.
      handleBankSelectedQuestions(initialBankQuestions, initialBankSource || 'scratch-bank');
    }
  }, [initialBankQuestions, initialBankSource, handleBankSelectedQuestions]);
  


const executeSave = async (localId: string, payload: any, isSaveAndNext: boolean): Promise<string | undefined> => {
    const flow = flowQuestionsRef.current; const currentQ = flow.find(q => q.__localId === localId);
    const serverId = serverIdMap.current.get(localId) || currentQ?._id || (isEditing && initialData?._id ? initialData._id : undefined);
    const result = await onSave({ ...payload, __saveAndNext: isSaveAndNext, __isUpdate: !!serverId, __questionId: serverId, __editLocalId: localId });
    const savedId = result?._id || result?.data?._id || result?.questionId || result?.data?.questionId || serverId;
    if (savedId) registerSavedId(localId, savedId);
    // Update flow question with saved data so navigating back (Previous) shows updated content
    const updatedFlow = flowQuestionsRef.current.map(q =>
      q.__localId === localId
        ? { ...q, ...payload, _id: savedId || q._id, isSaved: true, isDirty: false, isPreExisting: true }
        : q
    );
    flowQuestionsRef.current = updatedFlow;
    setFlowQuestions(updatedFlow);
    return savedId;
  };

  const ensureCurrentInFlow = (): string => {
    let currentQ = flowQuestionsRef.current[currentIndexRef.current]; if (currentQ) return currentQ.__localId;
    const newQ: FlowQuestion = {
      __localId: mkLocalId(), _id: undefined, title: getTitleText(titleBlocks) || '', description: descBlocks,
      difficulty: isGeneral ? 'medium' : currentDiff, score: isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff),
      testCases: tcs.map((tc, i) => ({ input: tc.input, expectedOutput: tc.expectedOutput, isSample: tc.isSample, isHidden: tc.isHidden, points: 1, explanation: tc.description || `Test Case ${i + 1}`, sequence: i })),
      constraints: constraints.filter(c => c.trim()),
      hints: hint.trim() ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 }, ...extraHints.map((h, i) => ({ ...h, sequence: i + 1 }))] : extraHints.map((h, i) => ({ ...h, sequence: i })),
      timeLimit, memoryLimit: memLimit, questionType: 'programming', isSaved: false, isDirty: false, isPreExisting: false,
    };
    const newFlow = [...flowQuestionsRef.current, newQ]; flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
    const newIdx = newFlow.length - 1; currentIndexRef.current = newIdx; setCurrentIndex(newIdx);
    return newQ.__localId;
  };

  const handleSave = async () => {
    const { valid, errors } = validate();
    if (!valid) { scrollToFirstError(errors); return; }
    const localId = ensureCurrentInFlow(); const latestQ = flowQuestionsRef.current[currentIndexRef.current];
    const serverId = serverIdMap.current.get(localId) || latestQ?._id || (isEditing && initialData?._id ? initialData._id : undefined);
    if (serverId && !hasUnsavedFormChanges) { return; }
    // ⚡ Cell-level Manual gate — a brand-new manually-authored question may
    // only save into a cell whose Manual (scratch) slice still has room. The
    // blank editor stays mounted under a re-popped source picker, so without
    // this the teacher could type past the quota and only find out from the
    // server's 400. Staged bank/AI/doc imports carry a source tag and already
    // hold a picker-capped review slot — they pass untouched.
    if (!serverId && srcOfTag((latestQ as any)?.source) === 'unknown') {
      const dGate: Diff = isGeneral ? 'medium' : (((latestQ?.difficulty) as Diff) || currentDiff);
      if (!allowedSources.manual || getSourceRemaining('scratch', dGate, localId) <= 0) {
        const dl = isGeneral ? '' : `${dGate.charAt(0).toUpperCase()}${dGate.slice(1)} `;
        toast.error(`${dl}Manual quota is already full — this slot can't take a manually-written question. Fill it from the source picker instead.`, { toastId: 'manual-cell-full' });
        reopenSourceModalForBlankSlot();
        return;
      }
    }
    try { await executeSave(localId, { ...mkPayload(), __preventClose: true }, false); } catch (err) { console.error('handleSave error:', err); return; }
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2500);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // Helper: Check if the just-saved question completes its difficulty's quota.
  // If yes → show DiffPopup (or close if no other diffs available).
  // Returns true if a popup/close happened (caller should NOT proceed further).
  // ──────────────────────────────────────────────────────────────────────────
  const checkDiffComplete = (savedLocalId: string | undefined): boolean => {
    if (isGeneral) return false;
    const flowNow = flowQuestionsRef.current;
    const idxNow  = currentIndexRef.current;
    const savedQ  = flowNow[idxNow];
    const diff    = (savedQ?.difficulty as Diff | undefined) || currentDiff;
    if (!diff) return false;

    // Count saved/created questions for this difficulty (NOT counting blank Q6-type entries)
    const savedCount = flowNow.filter(q =>
      q.difficulty === diff &&
      !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId) || (savedLocalId && q.__localId === savedLocalId))
    ).length;
    const quota = getQuotaForDiff(diff);

    if (savedCount < quota) return false;

    // Quota met for this difficulty
    if (isEditing) { onClose(); return true; }

    // Find any OTHER difficulty that still has remaining slots
    const otherDiffs = getConfiguredDiffs().filter(d => {
      if (d === diff) return false;
      const otherSaved = flowNow.filter(q =>
        q.difficulty === d &&
        !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
      ).length;
      return otherSaved < getQuotaForDiff(d);
    });

    if (otherDiffs.length > 0) {
      setCompletedDiff(diff);
      setShowDiffPopup(true);
    } else {
      onClose();
    }
    return true; // popup or close was triggered
  };

  const handleSaveAndContinue = async () => {
    const flow = flowQuestionsRef.current;
    const idx = currentIndexRef.current;
    let currentQ = flow[idx];

    // Case 1: no current question (out-of-bounds index) — typically when initial
    // flow had quota already met and form opened on a blank slot.
    if (!currentQ) {
      if (!isGeneral) {
        const cnt = flow.filter(q => q.difficulty === currentDiff).length;
        if (cnt >= getQuotaForDiff(currentDiff)) {
          // Don't create new — show popup directly
          if (checkDiffComplete(undefined)) return;
          advanceAfterSave(undefined, undefined);
          return;
        }
      }
      const { valid: v0, errors: e0 } = validate();
      if (!v0) { scrollToFirstError(e0); return; }
      const lid = ensureCurrentInFlow();
      currentQ = flowQuestionsRef.current[currentIndexRef.current];
    }

    const latestQ = flowQuestionsRef.current[currentIndexRef.current];
    const localId = latestQ?.__localId ?? currentQ.__localId;
    const serverId = serverIdMap.current.get(localId) || latestQ?._id || (isEditing && initialData?._id ? initialData._id : undefined);

    // Case 2: already saved, no changes — skip executeSave but still check quota
    if (serverId && !isEditMode && !hasUnsavedFormChanges) {
      if (checkDiffComplete(localId)) return;
      advanceAfterSave(serverId, localId);
      return;
    }

    // ⚡ Cell-level Manual gate — same rule as handleSave: a new untagged
    // (manually-authored) question can't bill a cell whose scratch slice is
    // full. `localId` is excluded from the staged tally so the question being
    // saved never blocks itself.
    if (!serverId && srcOfTag((latestQ as any)?.source) === 'unknown') {
      const dGate: Diff = isGeneral ? 'medium' : (((latestQ?.difficulty) as Diff) || currentDiff);
      if (!allowedSources.manual || getSourceRemaining('scratch', dGate, localId) <= 0) {
        const dl = isGeneral ? '' : `${dGate.charAt(0).toUpperCase()}${dGate.slice(1)} `;
        toast.error(`${dl}Manual quota is already full — this slot can't take a manually-written question. Fill it from the source picker instead.`, { toastId: 'manual-cell-full' });
        reopenSourceModalForBlankSlot();
        return;
      }
    }

    // Case 3: validate + save
    const { valid, errors } = validate();
    if (!valid) { scrollToFirstError(errors); return; }

    let savedId: string | undefined;
    try {
      savedId = await executeSave(localId, mkPayload(), true);
    } catch (err) {
      console.error('handleSaveAndContinue error:', err);
      return;
    }

    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2500);
    setIsEditMode(false);

    // ⚡ HARD QUOTA GUARD: check immediately after save
    if (checkDiffComplete(localId)) return;

    advanceAfterSave(savedId, localId);

    // When the caller set autoOpenSource (e.g. AI-alone exercise), the teacher
    // should keep landing on the SAME source modal after every save — but ONLY
    // when the advance landed on a fresh BLANK slot. If it landed on an
    // already-staged question (e.g. the 2nd of a generated batch awaiting
    // review) or the difficulty-handover popup took over, the teacher keeps
    // reviewing; the modal returns when an empty slot opens up.
    if (!landedOnBlankSlot()) return;
    reopenSourceModalForBlankSlot();
  };

  // True when the editor's current slot is a blank placeholder (no title yet).
  // The only state in which the auto-open source modal should (re)appear.
  const landedOnBlankSlot = () => {
    const q = flowQuestionsRef.current[currentIndexRef.current];
    if (!q) return true;
    const t = Array.isArray(q.title) ? getTitleText(q.title as any) : (q.title || '');
    return !t.toString().trim();
  };

  // The blank slot the teacher lands on has a FIXED difficulty, so a source
  // must have room in THAT CELL — not merely somewhere in the matrix. With
  // Easy Manual 1/1 and Medium/Hard still open, the summed total read
  // "2 remaining" and dropped the teacher onto a second Easy manual slot the
  // configuration never allowed. Shared by the Save-&-Next re-pop and both
  // source-modal onClose handlers.
  const blankSlotDiff = (): Diff | null => {
    const q = flowQuestionsRef.current[currentIndexRef.current];
    // No flow entry = the VIRTUAL blank slot (mount lands one past the array;
    // the FlowQuestion only materializes at save time) — its difficulty is
    // whatever currentDiff was seeded to, not "unknown".
    const d = (q?.difficulty || currentDiff || '').toString().toLowerCase();
    return d === 'easy' || d === 'medium' || d === 'hard' ? (d as Diff) : null;
  };
  const srcHasRoomHere = (src: 'scratch' | 'ai' | 'thirdParty') => {
    if (isGeneral) return getSourceRemainingTotal(src) > 0;
    const d = blankSlotDiff();
    return d
      ? getSourceRemaining(src, d) > 0
      : getConfiguredDiffs().some(x => getSourceRemaining(src, x) > 0);
  };
  const manualHasRoomHere = () => allowedSources.manual && srcHasRoomHere('scratch');

  // Route the teacher after landing on a blank slot — shared by Save & Continue
  // and the difficulty-switch popup. The configuration decides the landing:
  //   manual fits this cell           → blank editor (type away, Save & Next)
  //   one other source fits           → that source's modal, directly
  //   several fit / teacher dismissed → the "+" add-source dropdown (the
  //                                     existing chooser — never a dead editor)
  //   nothing fits this cell          → stay put (review state; other cells are
  //                                     reachable via the difficulty switch)
  const reopenSourceModalForBlankSlot = () => {
    if (isEditing) return;

    // Manual can still take a question in this very cell — the blank editor is
    // the correct landing, no modal on top of it.
    if (manualHasRoomHere()) return;

    // Bank picks bill the scratch slice, so when scratch's cell is full the
    // bank can't fill this cell either — only AI / Other Platform remain.
    const usable: Array<'ai' | 'thirdParty'> = [];
    if (allowedSources.ai && srcHasRoomHere('ai')) usable.push('ai');
    if (allowedSources.thirdParty && srcHasRoomHere('thirdParty')) usable.push('thirdParty');
    const d = blankSlotDiff();
    const dl = d ? `${d.charAt(0).toUpperCase()}${d.slice(1)} ` : '';
    if (usable.length === 0) {
      toast.warning(`${dl}slots are fully allocated — switch difficulty or finish the exercise.`, { toastId: 'slot-src-repop' });
      return;
    }

    // Single legal source → its modal IS the flow: it returns on every dismiss
    // (with the toast spelling out why) until the slot is filled — trainer's
    // rule; dismiss-suppression deliberately does NOT apply here, a dead
    // editor would be worse. Several usable → the dropdown chooser.
    const preferred: 'ai' | 'thirdParty' | null =
      autoOpenSource === 'ai' && usable.includes('ai') ? 'ai'
      : autoOpenSource === 'thirdParty' && usable.includes('thirdParty') ? 'thirdParty'
      : usable.length === 1 ? usable[0]
      : null;

    if (!preferred) {
      toast.warning(`${dl}Manual questions are full — pick one of the remaining sources to fill this slot.`, { toastId: 'slot-src-repop' });
      setShowAddDropdown(true);
      return;
    }
    toast.warning(
      `${dl}Manual questions are full — this slot must be filled from ${preferred === 'ai' ? 'AI Automation' : 'Other Platform'}. The picker will reopen until it's filled.`,
      { toastId: 'slot-src-repop' },
    );

    pendingSourceRef.current = preferred === 'ai' ? 'ai' : 'thirdParty';
    sourceModalAutoOpenedRef.current = true;
    // Defer to next tick so the advance's state updates settle first
    // (otherwise the modal opens against a stale currentIndex).
    if (reopenTimerRef.current) clearTimeout(reopenTimerRef.current);
    reopenTimerRef.current = setTimeout(() => {
      reopenTimerRef.current = null;
      if (preferred === 'ai') setShowAIModal(true);
      else setShowBankSelector(true);
    }, 0);
  };

  // Mount landing: the initial blank slot may be VIRTUAL (opened straight onto
  // a difficulty whose Manual cell is already full) — route it exactly like a
  // Save-&-Next landing. Pure auto-open flows keep their own mount effect;
  // reopen no-ops when manual legitimately has room, so normal manual
  // authoring is untouched.
  useEffect(() => {
    if (isEditing) return;
    if (autoOpenSource && autoOpenSource !== 'manual') return; // their effect owns the mount
    if (!landedOnBlankSlot()) return;
    reopenSourceModalForBlankSlot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceAfterSave = (savedId: string | undefined, savedLocalId?: string) => {
    const flow = flowQuestionsRef.current;
    const idx  = currentIndexRef.current;

    // Handle Previous → Return-to-original-position case
    if (returnIndexRef.current !== null) {
      const returnIdx = returnIndexRef.current;
      const returnDiff = returnDiffRef.current;
      returnIndexRef.current = null;
      returnDiffRef.current = null;
      if (returnDiff && !isGeneral) setCurrentDiff(returnDiff);
      if (returnIdx < flow.length) {
        setCurrentIndex(returnIdx); currentIndexRef.current = returnIdx;
        loadQuestionIntoForm(flow[returnIdx]);
        if (!isGeneral && flow[returnIdx]?.difficulty) setCurrentDiff(flow[returnIdx].difficulty as Diff);
        setTimeout(() => titleRef.current?.focus(), 80);
        return;
      }
    }

    // ── PRIORITY: completed-current-difficulty handover ─────────────────────
    // If the question we just saved was the LAST open slot for its difficulty
    // AND any OTHER configured difficulty still has open slots, show the
    // DifficultyPopup so the teacher chooses where to continue. This prevents
    // the previous flat "go to nextIdx in flow" behaviour, which would silently
    // jump backward from Medium 2/2 to an empty Easy 4 slot.
    // Within the same difficulty (e.g. Medium 1 → Medium 2), this check
    // doesn't fire — the quota isn't met yet, so the form continues to the
    // next medium slot naturally.
    if (!isGeneral && !isEditing) {
      const savedQ_priority = flow[idx];
      const justDiff = (savedQ_priority?.difficulty as Diff | undefined) || currentDiff;
      if (justDiff) {
        const savedCountForJustDiff = flow.filter(q =>
          q.difficulty === justDiff &&
          !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId) || q.__localId === savedLocalId)
        ).length;
        if (savedCountForJustDiff >= getQuotaForDiff(justDiff)) {
          const otherDiffsWithOpenSlots = getConfiguredDiffs().filter(d => {
            if (d === justDiff) return false;
            const c = flow.filter(q =>
              q.difficulty === d &&
              !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
            ).length;
            return c < getQuotaForDiff(d);
          });
          if (otherDiffsWithOpenSlots.length > 0) {
            setCompletedDiff(justDiff);
            setShowDiffPopup(true);
            return;
          }
          // else: all other diffs are also full — fall through to the existing
          //       "everything done → onClose" path below.
        }
      }
    }

    // Try to navigate to the next slot in the flow (if it exists and quota allows)
    const nextIdx = idx + 1;
    if (nextIdx < flow.length) {
      const nextQ = flow[nextIdx];
      const nextDiff = nextQ?.difficulty as Diff | undefined;
      if (!isGeneral && nextDiff) {
        // Count actually-saved questions for nextDiff (not blank slots)
        const savedCountForNextDiff = flow.filter(q =>
          q.difficulty === nextDiff &&
          !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId) || q.__localId === savedLocalId)
        ).length;
        const quotaForNextDiff = getQuotaForDiff(nextDiff);
        if (savedCountForNextDiff < quotaForNextDiff) {
          setCurrentIndex(nextIdx); currentIndexRef.current = nextIdx;
          setCurrentDiff(nextDiff); loadQuestionIntoForm(nextQ);
          setTimeout(() => titleRef.current?.focus(), 80);
          return;
        }
        // else: quota met for nextDiff → fall through to popup logic
      } else {
        setCurrentIndex(nextIdx); currentIndexRef.current = nextIdx;
        if (!isGeneral && nextDiff) setCurrentDiff(nextDiff);
        loadQuestionIntoForm(nextQ);
        setTimeout(() => titleRef.current?.focus(), 80);
        return;
      }
    }

    if (isEditing) { onClose(); return; }

    if (isGeneral) {
      if (getRemainingSlots(undefined, flow) > 0) {
        const newQ: FlowQuestion = { __localId: mkLocalId(), _id: undefined, title: '', description: { text: '', imageUrl: null, imageAlignment: 'left', imageSizePercent: 100 }, difficulty: 'medium', score: generalMPQ, testCases: [], constraints: [], hints: [], timeLimit: 2000, memoryLimit: 256, questionType: 'programming', isSaved: false, isDirty: false };
        const newFlow = [...flow, newQ]; flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
        setCurrentIndex(flow.length); currentIndexRef.current = flow.length;
        resetForm(generalMPQ);
        setTimeout(() => titleRef.current?.focus(), 80);
      } else {
        onClose();
      }
      return;
    }

    // Level-based / selection-level: decide between creating new Q or showing popup
    const savedQ_inAdv = flow[idx];
    const diffToUse = (savedQ_inAdv?.difficulty as Diff | undefined) || currentDiff;

    // Count SAVED questions for this difficulty (don't include blank Q6 entries)
    const savedCountForDiff = flow.filter(q =>
      q.difficulty === diffToUse &&
      !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId) || q.__localId === savedLocalId)
    ).length;
    const diffQuota = getQuotaForDiff(diffToUse);

    if (savedCountForDiff < diffQuota) {
      // Still room → create the next blank question for this difficulty
      const newQ: FlowQuestion = { __localId: mkLocalId(), _id: undefined, title: '', description: { text: '', imageUrl: null, imageAlignment: 'left', imageSizePercent: 100 }, difficulty: diffToUse, score: isScoreEditable(diffToUse) ? 0 : getFixedScore(diffToUse), testCases: [], constraints: [], hints: [], timeLimit: 2000, memoryLimit: 256, questionType: 'programming', isSaved: false, isDirty: false };
      const newFlow = [...flow, newQ];
      flowQuestionsRef.current = newFlow;
      setFlowQuestions(newFlow);
      setCurrentIndex(flow.length); currentIndexRef.current = flow.length;
      resetForm(isScoreEditable(diffToUse) ? 0 : getFixedScore(diffToUse));
      setTimeout(() => titleRef.current?.focus(), 80);
    } else {
      // Quota met → show DiffPopup if other diffs have remaining slots, else close
      const otherDiffs = getConfiguredDiffs().filter(d => {
        if (d === diffToUse) return false;
        const otherSavedCount = flow.filter(q =>
          q.difficulty === d &&
          !!(q._id || q.isSaved || q.isPreExisting || serverIdMap.current.get(q.__localId))
        ).length;
        return otherSavedCount < getQuotaForDiff(d);
      });
      if (otherDiffs.length > 0) {
        setCompletedDiff(diffToUse);
        setShowDiffPopup(true);
      } else {
        onClose();
      }
    }
  };

  const handleJumpTo = (idx: number) => {
    const curIdx = currentIndexRef.current; const flow = flowQuestionsRef.current;
    returnIndexRef.current = curIdx; returnDiffRef.current = currentDiff;
    const snap = snapshotForm({ isSaved: flow[curIdx]?.isSaved || false, _id: getServerId(flow[curIdx]), isDirty: true, isPreExisting: flow[curIdx]?.isPreExisting });
    const newFlow = [...flow]; newFlow[curIdx] = snap; flowQuestionsRef.current = newFlow; setFlowQuestions(newFlow);
    const targetQ = newFlow[idx]; if (targetQ?.difficulty && !isGeneral) setCurrentDiff(targetQ.difficulty as Diff);
    currentIndexRef.current = idx; setCurrentIndex(idx); loadQuestionIntoForm(newFlow[idx]); setTimeout(() => titleRef.current?.focus(), 80);
  };

  const handleDiffSelect = (d: Diff) => {
    setShowDiffPopup(false); setCurrentDiff(d);
    const alreadyInFlow = flowQuestionsRef.current.some(q => q.difficulty === d);
    let questionsToAdd: FlowQuestion[] = [];
    if (!alreadyInFlow) { const dbQs = getDbQuestionsForDiff(d); questionsToAdd = dbQs.map(dbQuestionToFlow); questionsToAdd.forEach(q => { if (q._id) serverIdMap.current.set(q.__localId, q._id); }); }
    const flowWithDb = [...flowQuestionsRef.current, ...questionsToAdd];
    const remainingAfterLoad = getRemainingSlots(d, flowWithDb);
    if (remainingAfterLoad <= 0) {
      flowQuestionsRef.current = flowWithDb; setFlowQuestions(flowWithDb);
      // Navigate to the last question of difficulty d specifically
      const dIndices = flowWithDb.reduce<number[]>((acc, q, i) => { if (q.difficulty === d) acc.push(i); return acc; }, []);
      const lastDIdx = dIndices.length > 0 ? dIndices[dIndices.length - 1] : flowWithDb.length - 1;
      currentIndexRef.current = lastDIdx; setCurrentIndex(lastDIdx); setCurrentDiff(d);
      if (flowWithDb[lastDIdx]) loadQuestionIntoForm(flowWithDb[lastDIdx]); setTimeout(() => titleRef.current?.focus(), 80); return;
    }
    const defaultScore = isScoreEditable(d) ? 0 : getFixedScore(d);
    // Look for an unsaved slot for this difficulty. Two cases:
    //   • CONTENT slot — a bank / AI / third-party pick that was injected into
    //     the flow (via handleBankSelectedQuestions) but never saved. Has a
    //     title / description / test cases already populated. Must be LOADED
    //     into the form so the teacher sees what they picked — the previous
    //     code called resetForm() here, wiping the pick from the visible form
    //     and effectively discarding it on the next save.
    //   • BLANK slot — created by Save & Next when the next quota position is
    //     opened as an empty scaffold. resetForm() is correct for these.
    // Prefer the CONTENT slot so bank picks always surface first; only fall
    // back to a blank slot if there's no pending pick to review.
    const hasContent = (q: FlowQuestion): boolean => {
      const t = Array.isArray(q.title) ? getTitleText(q.title as any) : (q.title || '');
      if (t.toString().trim()) return true;
      const src = (q.source ?? '').toString();
      // Any explicit non-manual source tag means this slot came from a picker.
      return src === 'ai' || src.startsWith('scratch-bank') || src.startsWith('thirdParty');
    };
    const isUnsavedSlot = (q: FlowQuestion) =>
      q.difficulty === d && !q.isSaved && !q._id && !serverIdMap.current.get(q.__localId);
    const contentIdx = flowWithDb.findIndex(q => isUnsavedSlot(q) && hasContent(q));
    const blankIdx = contentIdx < 0
      ? flowWithDb.findIndex(q => isUnsavedSlot(q) && !hasContent(q))
      : -1;
    const existingIdx = contentIdx >= 0 ? contentIdx : blankIdx;
    if (existingIdx >= 0) {
      flowQuestionsRef.current = flowWithDb; setFlowQuestions(flowWithDb);
      currentIndexRef.current = existingIdx; setCurrentIndex(existingIdx); setCurrentDiff(d);
      if (contentIdx >= 0) {
        // Bank/AI/third-party pick waiting to be reviewed — show its content.
        loadQuestionIntoForm(flowWithDb[existingIdx]);
      } else {
        resetForm(defaultScore);
      }
      setTimeout(() => titleRef.current?.focus(), 80);
      // Only offer the source modal when the slot is genuinely empty — a
      // content slot IS the source's contribution, nothing more to fetch.
      if (contentIdx < 0 && landedOnBlankSlot()) reopenSourceModalForBlankSlot();
      return;
    }
    const newQ: FlowQuestion = { __localId: mkLocalId(), _id: undefined, title: '', description: { text: '', imageUrl: null, imageAlignment: 'left', imageSizePercent: 100 }, difficulty: d, score: defaultScore, testCases: [], constraints: [], hints: [], timeLimit: 2000, memoryLimit: 256, questionType: 'programming', isSaved: false, isDirty: false };
    const newFlow2 = [...flowWithDb, newQ]; flowQuestionsRef.current = newFlow2; setFlowQuestions(newFlow2);
    const newIdx2 = newFlow2.length - 1; currentIndexRef.current = newIdx2; setCurrentIndex(newIdx2); setCurrentDiff(d);
    resetForm(defaultScore); setTimeout(() => titleRef.current?.focus(), 80);
    if (landedOnBlankSlot()) reopenSourceModalForBlankSlot();
  };

  const validate = (): { valid: boolean; errors: Record<string, string> } => {
    const e: Record<string, string> = {};
    // Link mode: the URL is the whole question — nothing else is required.
    if (isLinkQuestion) {
      if (!/^https?:\/\/\S+$/i.test(questionLink.trim())) e.questionLink = 'Paste a valid http(s) link';
      return { valid: Object.keys(e).length === 0, errors: e };
    }
    const titleText = getTitleText(titleBlocks);
    if (!titleText && !titleBlocks.some(b => b.type === 'image' || b.type === 'code')) e.title = 'Title is required';
    const descText = descBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim();
    if (!descText && !descBlocks.some(b => b.type === 'image' || b.type === 'code')) e.description = 'Description is required';
    if (!constraints.some(c => c.trim())) e.constraints = 'At least one constraint is required';
    if (!tcs.some(tc => tc.input.trim() && tc.expectedOutput.trim())) e.testcases = 'At least one test case with input & output is required';
    const currentQ = flowQuestions[currentIndex]; const dbQsForDiff = getDbQuestionsForDiff(currentDiff);
    if (!isGeneral && isScoreEditable(currentDiff)) {
      const sType = getScoringType(currentDiff);
      if (sType === 'question_specific') {
        const totalAllowed = getTotalMarksForDiff(currentDiff); const existingServerId = getServerId(currentQ);
        const isEditingExist = !!(existingServerId || isEditing);
        const totalQuestionsForDiff = getQuotaForDiff(currentDiff);
        if (isEditingExist && existingServerId) {
          const otherQs = dbQsForDiff.filter((q: any) => q._id?.toString() !== existingServerId);
          const otherSum = otherQs.reduce((s: number, q: any) => s + (q.score || q.points || 0), 0);
          // Reserve 1 mark for each remaining question that hasn't been created yet
          const questionsWithMarks = otherQs.length + 1; // other saved + this one
          const futureQuestions = Math.max(0, totalQuestionsForDiff - questionsWithMarks);
          const rawMax = totalAllowed - otherSum - futureQuestions;
          const maxForThis = rawMax > 0 ? Math.max(1, rawMax) : 0;
          if (score > maxForThis + 0.01) e.score = `Max for this question: ${fmtMark(maxForThis)} (reserving 1 mark each for ${futureQuestions} remaining question${futureQuestions !== 1 ? 's' : ''})`;
        } else {
          const used = getDbMarksUsedForDiff(currentDiff);
          const createdSoFar = getCreatedCount(currentDiff);
          // Reserve 1 mark for each remaining question after this one
          const futureQuestions = Math.max(0, totalQuestionsForDiff - createdSoFar - 1);
          const rawMax2 = totalAllowed - used - futureQuestions;
          const maxForThis = rawMax2 > 0 ? Math.max(1, rawMax2) : 0;
          if (score > maxForThis + 0.01) e.score = `Max for this question: ${fmtMark(maxForThis)} (reserving 1 mark each for ${futureQuestions} remaining question${futureQuestions !== 1 ? 's' : ''})`;
        }
        if (!e.score && score <= 0) e.score = 'Score must be greater than 0';
      }
    }
    // ── Per-question AI test case count — required in perQuestion mode ────
    // Legacy questions with null are OK on read (resolver falls back to the
    // exercise's count) but a trainer saving in perQuestion mode must set it.
    // Zero is allowed and means "skip AI generation, only judge the question's
    // own testCases" — same semantics as the exercise-level 0.
    const exEvm: any = exerciseData?.fullExerciseData?.evaluationMethod;
    const perQuestionMode = exEvm?.method === 'ai' && exEvm?.ai?.testCasesCountMode === 'perQuestion';
    if (perQuestionMode) {
      if (aiTestCasesCount === null || aiTestCasesCount === undefined || Number.isNaN(aiTestCasesCount)) {
        e.aiTestCasesCount = 'AI test case count is required';
      } else if (aiTestCasesCount < 0 || aiTestCasesCount > 50) {
        e.aiTestCasesCount = 'AI test case count must be between 0 and 50';
      }
    }
    setErrs(e); setTouched(new Set(Object.keys(e))); return { valid: Object.keys(e).length === 0, errors: e };
  };

  const handleScoreBlur = () => {
    if (!isScoreEditable(currentDiff) || isGeneral) return;
    if (getScoringType(currentDiff) !== 'question_specific') return;
    const totalAllowed = getTotalMarksForDiff(currentDiff); const currentQ = flowQuestions[currentIndex];
    const existingServerId = getServerId(currentQ); const isEditExist = isEditing || !!existingServerId;
    const dbQsForDiff = getDbQuestionsForDiff(currentDiff); const tempErrors: Record<string, string> = {};
    const totalQuestionsForDiff = getQuotaForDiff(currentDiff);
    if (isEditExist && existingServerId) {
      const otherQs = dbQsForDiff.filter((q: any) => q._id?.toString() !== existingServerId);
      const otherSum = otherQs.reduce((s: number, q: any) => s + (q.score || q.points || 0), 0);
      const questionsWithMarks = otherQs.length + 1;
      const futureQuestions = Math.max(0, totalQuestionsForDiff - questionsWithMarks);
      const rawBlur1 = totalAllowed - otherSum - futureQuestions;
      const maxForThis = rawBlur1 > 0 ? Math.max(1, rawBlur1) : 0;
      if (score > maxForThis + 0.01) tempErrors.score = `Max allowed: ${fmtMark(maxForThis)} marks (reserving 1 each for ${futureQuestions} remaining)`;
    } else {
      const used = getDbMarksUsedForDiff(currentDiff);
      const createdSoFar = getCreatedCount(currentDiff);
      const futureQuestions = Math.max(0, totalQuestionsForDiff - createdSoFar - 1);
      const rawBlur2 = totalAllowed - used - futureQuestions;
      const maxForThis = rawBlur2 > 0 ? Math.max(1, rawBlur2) : 0;
      if (score > maxForThis + 0.01) tempErrors.score = `Max allowed: ${fmtMark(maxForThis)} marks (reserving 1 each for ${futureQuestions} remaining)`;
    }
    if (score <= 0 && !tempErrors.score) tempErrors.score = 'Score must be > 0';
    if (tempErrors.score) { setErrs(p => ({ ...p, score: tempErrors.score })); setTouched(p => new Set(p).add('score')); }
    else { setErrs(p => { const n = { ...p }; delete n.score; return n; }); }
  };

  const availableNextDiffs = useMemo((): { diff: Diff; remaining: number }[] => {
    if (isGeneral) return [];
    return getConfiguredDiffs().filter(d => d !== currentDiff && getRemainingSlots(d) > 0).map(d => ({ diff: d, remaining: getRemainingSlots(d) }));
  }, [currentDiff, getConfiguredDiffs, getRemainingSlots, isGeneral]);

  const s = DS[currentDiff] || DS.medium;
  const currentQ = flowQuestions[currentIndex];
  const isEditingExistingQ = !!(getServerId(currentQ)) || isEditing;
  const isCurrentPreExisting = !!(currentQ?.isPreExisting || (getServerId(currentQ)));
  const isFormDisabled = false; // Temporarily set to false to test typing

  const dbQsAll = getDbQuestionsForDiff();
  const totalSlots = isGeneral ? generalQuestionCount : getQuotaForDiff(currentDiff);
  const createdCount = getCreatedCount(isGeneral ? undefined : currentDiff);
  const remainingSlots = isGeneral ? getRemainingSlots() : getRemainingSlots(currentDiff);

  // ── Overall Questions (all difficulties combined) ──────────────────────────
  const totalSlotsAll = isGeneral
    ? generalQuestionCount
    : getConfiguredDiffs().reduce((s, d) => s + getQuotaForDiff(d), 0);
  const createdCountAll = isGeneral
    ? getCreatedCount()
    : getConfiguredDiffs().reduce((s, d) => s + getCreatedCount(d), 0);
  const remainingSlotsAll = Math.max(0, totalSlotsAll - createdCountAll);

  // Last question = once THIS slot is filled, no free slot remains anywhere.
  // Counted from real occupancy (saved + content-bearing entries), NOT from
  // currentIndex — pure index math broke whenever the flow carried a blank
  // placeholder or DB/staged entries interleaved out of quota order, flipping
  // Save & Continue / Save & Finish at the wrong moments.
  const isLastQuestion = useMemo((): boolean => {
    if (totalSlotsAll <= 0) return currentIndex >= flowQuestions.length - 1;
    const cur = flowQuestions[currentIndex];
    const t = cur ? (Array.isArray(cur.title) ? getTitleText(cur.title as any) : (cur.title || '')) : '';
    const curOccupies = !!cur && (
      !!(cur._id || cur.isSaved || cur.isPreExisting || serverIdMap.current.get(cur.__localId))
      || !!t.toString().trim()
    );
    const free = isGeneral
      ? Math.max(0, getRemainingSlots() - getStagedCount('medium' as Diff))
      : getConfiguredDiffs().reduce((s, d) => s + Math.max(0, getRemainingSlots(d) - getStagedCount(d)), 0);
    // Blank current slot: it is itself one of the free slots — last when it's
    // the only one. Occupied current slot: last when nothing else is free.
    return curOccupies ? free <= 0 : free <= 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, totalSlotsAll, flowQuestions, isGeneral, currentDiff]);

  // Continuous global question number across all difficulties (easy→medium→hard).
  // In level mode this is the position WITHIN the current difficulty so e.g. the
  // second medium question shows "2" not "3" (its global flow index would be 3
  // if Easy 1+2 sit before it).
  const globalQuestionNumber = useMemo((): number => {
    if (isGeneral) return currentIndex + 1;

    // Normalise difficulty comparisons — bank/AI questions sometimes arrive
    // with "Medium" or "MEDIUM" casing that wouldn't match the lowercase
    // currentDiff state, which would silently fall to the +1 branch and over-count.
    const normDiff = (d: any): string => String(d || 'medium').toLowerCase();
    const cur = normDiff(currentDiff);
    const dQuestions = flowQuestions.filter(q => normDiff(q.difficulty) === cur);
    const currentQ = flowQuestions[currentIndex];
    if (currentQ) {
      const posInDiff = dQuestions.findIndex(q => q.__localId === currentQ.__localId);
      if (posInDiff !== -1) return posInDiff + 1;
    }
    // Current index is past the end of the flow (new blank question being added)
    // → it's the slot after the last one of this difficulty.
    return dQuestions.length + 1;
  }, [isGeneral, currentDiff, currentIndex, flowQuestions]);

  const totalMarksForDiff = isGeneral ? 0 : getTotalMarksForDiff(currentDiff);
  const usedMarks = isGeneral ? 0 : getDbMarksUsedForDiff(currentDiff);
  const remainingMarks = isGeneral ? 0 : getRemainingMarksForDiff(currentDiff);
  const totalMarksAll = exerciseData.fullExerciseData?.exerciseInformation?.totalMarksProgramming > 0
    ? exerciseData.fullExerciseData.exerciseInformation.totalMarksProgramming
    : exerciseData.fullExerciseData?.exerciseInformation?.totalMarks || 0;
  const usedMarksAll = isGeneral ? 0 : getConfiguredDiffs().reduce((acc, d) => acc + getDbMarksUsedForDiff(d), 0);
  const scoringType = isGeneral ? 'fixed' : getScoringType(currentDiff);
  const displayScore = isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff);

  // Max assignable marks for the current question (question_specific mode) — reserves 1 mark per future question
  const maxAssignableForCurrentQ = useMemo((): number | null => {
    if (isGeneral || !isScoreEditable(currentDiff)) return null;
    const totalAllowed = getTotalMarksForDiff(currentDiff);
    const totalQForDiff = getQuotaForDiff(currentDiff);
    const currentQ = flowQuestions[currentIndex];
    const existingServerId = getServerId(currentQ);
    const dbQsForDiff = getDbQuestionsForDiff(currentDiff);
    if (existingServerId) {
      const otherQs = dbQsForDiff.filter((q: any) => q._id?.toString() !== existingServerId);
      const otherSum = otherQs.reduce((s: number, q: any) => s + (q.score || q.points || 0), 0);
      const futureQs = Math.max(0, totalQForDiff - otherQs.length - 1);
      const raw1 = totalAllowed - otherSum - futureQs;
      return raw1 > 0 ? Math.max(1, raw1) : 0;
    }
    const used = getDbMarksUsedForDiff(currentDiff);
    const created = getCreatedCount(currentDiff);
    const futureQs = Math.max(0, totalQForDiff - created - 1);
    const raw2 = totalAllowed - used - futureQs;
    return raw2 > 0 ? Math.max(1, raw2) : 0;
  }, [isGeneral, currentDiff, currentIndex, flowQuestions, isScoreEditable, getTotalMarksForDiff, getQuotaForDiff, getServerId, getDbQuestionsForDiff, getDbMarksUsedForDiff, getCreatedCount]);

  const hierarchyData = exerciseData.fullExerciseData?.hierarchyData || {};
  const subcategory = exerciseData.subcategory;
  const subcategoryLabel = exerciseData.subcategoryLabel;
  const exerciseName = exerciseData.exerciseName || exerciseData.fullExerciseData?.exerciseInformation?.exerciseName || '';
  const actionLabel = 'Add Question';
  const questionLabel = isEditing ? '' : getServerId(flowQuestions[currentIndex]) ? `Q#${globalQuestionNumber}` : `Question #${globalQuestionNumber}`;

  // Mock enabled logic
  const totalRequiredQuestions = isGeneral
    ? generalQuestionCount
    : getConfiguredDiffs().reduce((s, d) => s + getQuotaForDiff(d), 0);
  // Mock enabled logic

  // Current form content check — title + description + score filled
  const currentFormHasContent = (() => {
    const titleFilled = !!(getTitleText(titleBlocks) || titleBlocks.some(b => b.type === 'image' || b.type === 'code'));
    const descFilled = !!(
      descBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim() ||
      descBlocks.some(b => b.type === 'image' || b.type === 'code')
    );
    const scoreFilled = (isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff)) > 0;
    return titleFilled && descFilled && scoreFilled;
  })();

  const anyFormFieldHasContent = !!(
    getTitleText(titleBlocks) || titleBlocks.some(b => b.type === 'image' || b.type === 'code') ||
    descBlocks.filter(b => b.type === 'text').map(b => (b as any).value).join(' ').trim() ||
    descBlocks.some(b => b.type === 'image' || b.type === 'code')
  );

  // Count saved from flowQuestions
  const savedFromFlow = flowQuestions.filter(q =>
    q.isSaved || q._id || serverIdMap.current.has(q.__localId)
  ).length;

  // Count saved from DB directly (source of truth)
  const savedFromDb = getDbQuestionsForDiff().length; // all diffs, all saved in DB

  // Best count — whichever is higher
  const savedQuestionsCount = Math.max(savedFromFlow, savedFromDb);

  // Current question saved?
  const currentQ_forMock = flowQuestions[currentIndex];
  const currentAlreadySaved_forMock = !!(
    currentQ_forMock?.isSaved ||
    currentQ_forMock?._id ||
    serverIdMap.current.has(currentQ_forMock?.__localId)
  );

  // Effective filled = saved + current unsaved form if has content
  const effectiveTotalFilled = savedQuestionsCount + (
    currentFormHasContent && !currentAlreadySaved_forMock ? 1 : 0
  );

  // Mock: enabled only when ALL required questions are saved (not just filled in form)
  const isMockEnabled = (() => {
    if (totalSlotsAll <= 0) return savedQuestionsCount > 0;
    return savedQuestionsCount >= totalSlotsAll;
  })();

  const addTC = () => setTcs(p => [...p, mkTC(p.length)]);
  const updTC = (id: string, f: string, v: any) => {
    setTcs(p => {
      const updated = p.map(tc => tc.id === id ? { ...tc, [f]: v } : tc);
      if (errs.testcases && updated.some(tc => tc.input.trim() && tc.expectedOutput.trim()))
        setErrs(prev => { const n = { ...prev }; delete n.testcases; return n; });
      return updated;
    });
  };
  const delTC = (id: string) => { if (tcs.length > 1) setTcs(p => p.filter(t => t.id !== id)); };




  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !isFormDisabled) {
        const activeElement = document.activeElement;
        if (activeElement && activeElement.getAttribute('contenteditable') === 'true') {
          switch (e.key) {
            case 'b':
              e.preventDefault();
              toggleBold();
              break;
            case 'i':
              e.preventDefault();
              toggleItalic();
              break;
            case 'u':
              e.preventDefault();
              toggleUnderline();
              break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormDisabled]);


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !isFormDisabled) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            applyFormatting('bold');
            break;
          case 'i':
            e.preventDefault();
            applyFormatting('italic');
            break;
          case 'u':
            e.preventDefault();
            applyFormatting('underline');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFormDisabled, titleBlocks, descBlocks]);
  // Rich text formatting helpers
  const applyFormatting = (command: 'bold' | 'italic' | 'underline') => {
    const activeElement = document.activeElement as HTMLElement;

    // Check if we're editing a textarea/input
    if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
      const textarea = activeElement as HTMLTextAreaElement | HTMLInputElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start !== end) {
        const selectedText = textarea.value.substring(start, end);
        let wrappedText = '';

        switch (command) {
          case 'bold':
            wrappedText = `**${selectedText}**`;
            break;
          case 'italic':
            wrappedText = `*${selectedText}*`;
            break;
          case 'underline':
            wrappedText = `_${selectedText}_`;
            break;
        }

        const newValue = textarea.value.substring(0, start) + wrappedText + textarea.value.substring(end);
        textarea.value = newValue;

        // Trigger onChange for the specific field
        if (textarea.id === 'title-textarea') {
          const titleBlock = titleBlocks.find(b => b.type === 'text');
          if (titleBlock) {
            setTitleBlocks(prev => prev.map(b =>
              b.id === titleBlock.id ? { ...b, value: newValue } : b
            ));
          }
        } else if (textarea.id === 'desc-textarea') {
          const descBlock = descBlocks.find(b => b.type === 'text');
          if (descBlock) {
            setDescBlocks(prev => prev.map(b =>
              b.id === descBlock.id ? { ...b, value: newValue } : b
            ));
          }
          setDesc(newValue);
        }

        // Restore selection
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + wrappedText.length, start + wrappedText.length);
        }, 0);
      }
    }
  };
  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="prog-root" style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'rgba(26,26,46,0.55)', backdropFilter: 'blur(2px)', overflow: 'hidden', fontFamily: 'var(--lms-font)' }}>

      {/* ── Validation Toast (top-right corner) ── */}
      {validationToast.length > 0 && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          minWidth: 260, maxWidth: 340,
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#fff',
          border: '1.5px solid var(--lms-danger-bdr)',
          borderLeft: '4px solid var(--lms-danger)',
          borderRadius: 'var(--lms-radius-md)',
          padding: '12px 14px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
          animation: 'lms-toast-slide-in 0.22s cubic-bezier(.4,0,.2,1)',
        }}>
          <AlertCircle size={15} style={{ color: 'var(--lms-danger)', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-danger)', margin: '0 0 4px 0' }}>
              Please fix before saving:
            </p>
            <ul style={{ margin: 0, paddingLeft: 15 }}>
              {validationToast.map((msg, i) => (
                <li key={i} style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, color: '#555', fontWeight: 600, lineHeight: 1.6 }}>{msg}</li>
              ))}
            </ul>
          </div>
          <button onClick={() => setValidationToast([])} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#aaa', flexShrink: 0, lineHeight: 1 }}>
            <X size={13} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', flex: 1, minHeight: 0, background: 'var(--lms-bg-white)', overflow: 'hidden' }}>

        {/* ── Approval banner (inside the card so its padding is white, not the overlay) ── */}
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
      <div style={{ background: 'var(--lms-bg-white)', borderBottom: '1.5px solid var(--lms-border)', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
    {/* Logo mark */}
    <div className="lms-header-logo-mark">
      <GraduationCap size={16} style={{ color: 'white' }} />
    </div>
    <div style={{ width: 1, height: 20, background: 'var(--lms-border)', flexShrink: 0 }} />

    {/* Edit mode indicators */}
    {isCurrentPreExisting && !isEditMode && !isEditing && (
      <button onClick={handleEditClick}
        className="lms-btn lms-btn-ghost-orange"
        style={{ padding: '5px 12px', fontSize: 12 }}>
        <Edit2 size={12} /> Edit Exercise
      </button>
    )}
    <div style={{ minWidth: 0, flex: 1, overflow: 'visible' }}>
      <QuestionFormBreadcrumb hierarchyData={hierarchyData} tabType={tabType} subcategory={subcategory} subcategoryLabel={subcategoryLabel} exerciseName={exerciseName} actionLabel={actionLabel} questionLabel={questionLabel} />
    </div>
  </div>

  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
    
    {/* Preview button */}
    {(() => {
      const dbCount = getDbQuestionsForDiff().length;
      const flowSavedCount = flowQuestions.filter(q => !!(q._id || q.isSaved || q.isPreExisting)).length;
      const savedCount = Math.max(dbCount, flowSavedCount);
      return savedCount > 0 && (
        <button onClick={() => setShowPreview(true)} className="lms-btn lms-btn-ghost-violet" style={{ marginRight: 8 }}>
          <Eye size={12} /> Preview
          <span style={{ background: 'var(--lms-violet)', color: 'white', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 20 }}>
            {savedCount}
          </span>
        </button>
      );
    })()}

    {/* ADD QUESTION VIA DROPDOWN BUTTON */}
    <div ref={addDropdownRef} className="relative" style={{ marginRight: 8 }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setShowAddDropdown(v => !v)}
        className="inline-flex items-center justify-between gap-2"
        style={{ 
          minWidth: 150, 
          height: 32, 
          padding: '0 10px', 
          borderRadius: 8, 
          border: '1.5px solid #e4e4ed', 
          background: '#fff', 
          color: '#1a1a2e', 
          fontSize: 12.5, 
          fontWeight: 600, 
          fontFamily: 'var(--lms-font)', 
          cursor: 'pointer' 
        }}
      >
        Add Question via
        <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" />
      </button>
      
      {showAddDropdown && (
        <div
          className="absolute top-full right-0 mt-1.5 z-[9999] overflow-hidden"
          style={{ 
            width: 220, 
            background: '#fff', 
            borderRadius: 12, 
            border: '1px solid #e4e4ed', 
            boxShadow: '0 8px 32px rgba(26,26,46,0.14)', 
            fontFamily: 'var(--lms-font)'
          }}
        >
          {/* 2. Question Bank (scratch entry point) — hidden when scratch is not allowed */}
          {bankViaScratch && (() => {
            const quotaFull = getSourceRemainingTotal('scratch') <= 0;
            return (
          <button
            onClick={() => {
              if (quotaFull) return;
              pendingSourceRef.current = 'scratch-bank';
              setShowAddDropdown(false);
              // Dropdown-opened modal — must not cascade-close the form.
              sourceModalAutoOpenedRef.current = false;
              // Re-arm the auto-reopen guard: opening a source modal by hand
              // reflects a fresh intent, so the suppression from an earlier
              // dismiss should not carry over to the next Save & Next.
              autoReopenSuppressedRef.current = false;
              setShowBankSelector(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            style={{ background: 'none', border: 'none', cursor: quotaFull ? 'not-allowed' : 'pointer', opacity: quotaFull ? 0.5 : 1 }}
            onMouseEnter={e => { if (!quotaFull) e.currentTarget.style.background = 'rgba(168,85,247,0.06)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(168,85,247,0.1)' }}>
              <Database size={14} style={{ color: '#a855f7' }} />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Question Bank</div>
              <div className="text-[10px]" style={{ color: quotaFull ? '#dc2626' : '#8b8b9e' }}>{quotaFull ? 'Manual quota full' : 'Import from bank'}</div>
            </div>
          </button>
            );
          })()}

          {bankViaScratch && allowedSources.thirdParty && (
            <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
          )}

          {/* 3. Other Platform — bank picker that stamps imports as thirdParty */}
          {allowedSources.thirdParty && (() => {
            const quotaFull = getSourceRemainingTotal('thirdParty') <= 0;
            return (
          <button
            onClick={() => {
              if (quotaFull) return;
              pendingSourceRef.current = 'thirdParty';
              setShowAddDropdown(false);
              sourceModalAutoOpenedRef.current = false;
              autoReopenSuppressedRef.current = false;
              setShowBankSelector(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            style={{ background: 'none', border: 'none', cursor: quotaFull ? 'not-allowed' : 'pointer', opacity: quotaFull ? 0.5 : 1 }}
            onMouseEnter={e => { if (!quotaFull) e.currentTarget.style.background = 'rgba(13,148,136,0.06)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(13,148,136,0.1)' }}>
              <Database size={14} style={{ color: '#0d9488' }} />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Other Platform</div>
              <div className="text-[10px]" style={{ color: quotaFull ? '#dc2626' : '#8b8b9e' }}>{quotaFull ? 'Other Platform quota full' : 'Import platform questions'}</div>
            </div>
          </button>
            );
          })()}

          {(bankViaScratch || allowedSources.thirdParty) && allowedSources.ai && (
            <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
          )}

          {/* 4. Generate AI — hidden when questionSource forbids AI */}
          {allowedSources.ai && (() => {
            const quotaFull = getSourceRemainingTotal('ai') <= 0;
            return (
          <button
            onClick={() => {
              if (quotaFull) return;
              pendingSourceRef.current = 'ai';
              setShowAddDropdown(false);
              sourceModalAutoOpenedRef.current = false;
              autoReopenSuppressedRef.current = false;
              setShowAIModal(true);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            style={{ background: 'none', border: 'none', cursor: quotaFull ? 'not-allowed' : 'pointer', opacity: quotaFull ? 0.5 : 1 }}
            onMouseEnter={e => { if (!quotaFull) e.currentTarget.style.background = 'rgba(242,119,87,0.06)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(242,119,87,0.1)' }}>
              <Sparkles size={14} style={{ color: '#F27757' }} />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Generate AI</div>
              <div className="text-[10px]" style={{ color: quotaFull ? '#dc2626' : '#8b8b9e' }}>{quotaFull ? 'AI quota full' : 'Auto-generate'}</div>
            </div>
          </button>
            );
          })()}

          {(bankViaScratch || allowedSources.thirdParty || allowedSources.ai) && allowedSources.upload && (
            <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
          )}

          {/* 4. Upload via Document — hidden when questionSource forbids upload;
              disabled when the Manual quota slice is exhausted (uploads are
              stamped 'scratch-manual', so they bill the Manual slice). */}
          {allowedSources.upload && (() => {
            const quotaFull = getSourceRemainingTotal('scratch') <= 0;
            return (
          <button
            onClick={() => { if (quotaFull) return; pendingSourceRef.current = 'scratch-manual'; setShowAddDropdown(false); docInputRef.current?.click(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
            style={{ background: 'none', border: 'none', cursor: quotaFull ? 'not-allowed' : 'pointer', opacity: quotaFull ? 0.5 : 1 }}
            onMouseEnter={e => { if (!quotaFull) e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(8,145,178,0.1)' }}>
              <CloudUpload size={14} style={{ color: '#0891b2' }} />
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Upload via Document</div>
              <div className="text-[10px]" style={{ color: quotaFull ? '#dc2626' : '#8b8b9e' }}>{quotaFull ? 'Manual quota full' : 'Import from .txt file'}</div>
            </div>
          </button>
            );
          })()}
        </div>
      )}
      {/* Hidden file input for "Upload via Document" (.txt only) */}
      <input ref={docInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleDocumentSelected} />
      {/* Quota-capped selection step for uploaded documents — the confirmed
          subset re-enters the normal Bank/AI inject path ('scratch-manual'). */}
      {docPickerQs && (
        <DocQuestionPicker
          questions={docPickerQs}
          selectionQuota={isGeneral
            ? { mode: 'general' as const, remainingTotal: getRemainingSlots() }
            : {
                mode: 'difficulty' as const,
                remainingByDifficulty: {
                  easy: getSourceRemaining('scratch', 'easy' as Diff),
                  medium: getSourceRemaining('scratch', 'medium' as Diff),
                  hard: getSourceRemaining('scratch', 'hard' as Diff),
                },
              }}
          onClose={() => setDocPickerQs(null)}
          onConfirm={(selected) => {
            setDocPickerQs(null);
            handleBankSelectedQuestions(selected as any[], 'scratch-manual');
          }}
        />
      )}
    </div>

    {/* Edit Exercise button */}
    {onEditExercise && (
      <button onClick={handleEditExerciseClick} className="lms-btn lms-btn-ghost-orange" style={{ marginRight: 8 }}>
        <Settings size={12} /> Edit Exercise
      </button>
    )}

    {/* Close button */}
    <button onClick={handleCloseRequest} style={{ padding: 8, borderRadius: 8, border: '1.5px solid var(--lms-danger-bdr)', background: 'var(--lms-danger-bg)', cursor: 'pointer', color: 'var(--lms-danger)', transition: 'all 0.15s' }}>
      <X size={15} />
    </button>
  </div>
</div>

        {/* ── DIFFICULTY SELECT BAR ── */}
        {!isGeneral && getConfiguredDiffs().length > 0 && (
          <div style={{ background: 'var(--lms-bg-surface)', borderBottom: '1.5px solid var(--lms-border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-text-sec)', flexShrink: 0 }}>Switch Difficulty:</span>
            <div style={{ position: 'relative', minWidth: 160 }}>
              <select
                value={currentDiff}
                onChange={e => {
                  const d = e.target.value as Diff;
                  if (d === currentDiff) return;
                  // Show dialog only when current question is a new unsaved question with data
                  const cq = flowQuestions[currentIndex];
                  setDiffSwitchTarget(d);
                }}
                style={{
                  fontFamily: 'var(--lms-font)',
                  fontSize: 12,
                  fontWeight: 700,
                  border: `2px solid ${s.border}`,
                  borderRadius: 'var(--lms-radius-md)',
                  padding: '6px 32px 6px 12px',
                  cursor: 'pointer',
                  outline: 'none',
                  background: s.bg,
                  color: s.text,
                  width: '100%',
                  appearance: 'none'
                }}>
                {getConfiguredDiffs().map(d => {
                  const quota = getQuotaForDiff(d);
                  const rem = getRemainingSlots(d);
                  const used = quota - rem;
                  return <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)} ({used}/{quota}){rem <= 0 && d !== currentDiff ? ' ✓' : ''}</option>;
                })}
              </select>
              <div style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: s.text,
                fontSize: '12px'
              }}>
                ▼
              </div>
            </div>
            <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, color: remainingSlots > 0 ? s.text : 'var(--lms-success)' }}>
              {remainingSlots > 0 ? `${remainingSlots} question${remainingSlots !== 1 ? 's' : ''} remaining` : '✓ All Questions filled'}
            </span>
            {/* {totalSlots > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, maxWidth: 280 }}>
                <div style={{ flex: 1, height: 6, background: 'var(--lms-bg-surface2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: s.bar, width: `${Math.min(100, (createdCount / totalSlots) * 100)}%`, transition: 'width 0.4s' }} />
                </div>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, color: 'var(--lms-text-muted)', flexShrink: 0 }}>{createdCount}/{totalSlots}</span>
              </div>
            )} */}
            <div style={{ flex: 1 }} />
            {/* <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setShowDetailsModal(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', borderRadius: 'var(--lms-radius-md)',
          fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 600,
          border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)',
          color: 'var(--lms-text-sec)', cursor: 'pointer', transition: 'all 0.15s',
        }}>
        <FileText size={12} /> Exercise Details
      </button>
      <button
        type="button"
        onClick={() => setShowOverviewModal(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '5px 11px', borderRadius: 'var(--lms-radius-md)',
          fontFamily: 'var(--lms-font)', fontSize: 11.5, fontWeight: 600,
          border: '1.5px solid var(--lms-info-bdr)', background: 'var(--lms-info-bg)',
          color: 'var(--lms-info)', cursor: 'pointer', transition: 'all 0.15s',
        }}>
        <BarChart3 size={12} /> Exercise Overview
      </button>
    </div> */}
          </div>
        )}

        {/* ── BODY ── */}
        <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0, overflow: 'hidden' }}>

          {/* ── MAIN FORM ── */}
          <div ref={formScrollRef} className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 20, background: 'var(--lms-bg-white)' }}>

            {/* Sticky Toolbar */}
            <div ref={stickyToolbarRef} style={{
              position: 'sticky',
              top: 0,
              zIndex: 10,
              background: 'var(--lms-bg-white)',
              paddingTop: 8,
              paddingBottom: 8,
              marginTop: -8,

            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {/* Q# badge */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: isCurrentPreExisting ? 'var(--lms-success)' : 'var(--lms-orange)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 12, fontWeight: 800,
                  fontFamily: 'var(--lms-font)', flexShrink: 0,
                  boxShadow: `0 2px 8px ${isCurrentPreExisting ? 'rgba(22,163,74,0.25)' : 'var(--lms-orange-glow)'}`,
                }}>
                  {globalQuestionNumber}
                </div>

                {/* B I U format buttons — hidden in link mode (no editors to format) */}
                <div style={{ display: isLinkQuestion ? 'none' : 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      document.execCommand('bold', false);
                      updateFormattingState();
                    }}
                    className="lms-fmt-btn"
                    disabled={isCurrentPreExisting && !isEditMode}
                    style={{
                      opacity: (isCurrentPreExisting && !isEditMode) ? 0.4 : 1,
                      cursor: (isCurrentPreExisting && !isEditMode) ? 'not-allowed' : 'pointer',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: `1.5px solid ${editorState.isBold ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                      background: editorState.isBold ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)',
                      color: editorState.isBold ? 'var(--lms-orange)' : 'var(--lms-text-sec)',
                      transition: 'all 0.15s'
                    }}
                    title="Bold (Ctrl+B)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleItalic();
                    }}
                    className="lms-fmt-btn"
                    disabled={isFormDisabled}
                    style={{
                      opacity: isFormDisabled ? 0.4 : 1,
                      cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: `1.5px solid ${editorState.isItalic ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                      background: editorState.isItalic ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)',
                      color: editorState.isItalic ? 'var(--lms-orange)' : 'var(--lms-text-sec)',
                      transition: 'all 0.15s'
                    }}
                    title="Italic (Ctrl+I)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="4" x2="10" y2="4" />
                      <line x1="14" y1="20" x2="5" y2="20" />
                      <line x1="15" y1="4" x2="9" y2="20" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleUnderline();
                    }}
                    className="lms-fmt-btn"
                    disabled={isFormDisabled}
                    style={{
                      opacity: isFormDisabled ? 0.4 : 1,
                      cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: `1.5px solid ${editorState.isUnderline ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                      background: editorState.isUnderline ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)',
                      color: editorState.isUnderline ? 'var(--lms-orange)' : 'var(--lms-text-sec)',
                      transition: 'all 0.15s'
                    }}
                    title="Underline (Ctrl+U)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 4v6a6 6 0 0 0 12 0V4" />
                      <line x1="4" y1="20" x2="20" y2="20" />
                    </svg>
                  </button>
                </div>

                {/* ── Question link mode ─────────────────────────────────────
                    Radio toggle: ON = the whole form collapses to ONE URL
                    input (paste a LeetCode/HackerRank/etc. problem link) and
                    only that link is required to save. Students then get the
                    link in an iframe instead of the question + compiler.
                    Clicking the active radio switches back to the full form. */}
                <label
                  onClick={(e) => {
                    // preventDefault stops the label from forwarding a second
                    // synthetic click to the radio (which bubbles back here
                    // and would toggle the state right back — "nothing
                    // happens" from the user's seat).
                    e.preventDefault();
                    if (!isFormDisabled) { setIsLinkQuestion(v => !v); setErrs({}); }
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    marginLeft: 8, padding: '5px 10px', borderRadius: 8,
                    border: `1.5px solid ${isLinkQuestion ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                    background: isLinkQuestion ? 'var(--lms-orange-light)' : 'var(--lms-bg-white)',
                    cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                    opacity: isFormDisabled ? 0.4 : 1,
                    transition: 'all 0.15s', userSelect: 'none',
                  }}
                  title="Paste an external problem link instead of authoring the question here"
                >
                  <input
                    type="radio"
                    checked={isLinkQuestion}
                    onChange={() => { /* handled by the label onClick so re-clicking untoggles */ }}
                    disabled={isFormDisabled}
                    style={{ accentColor: 'var(--lms-orange)', width: 13, height: 13, margin: 0, pointerEvents: 'none' }}
                  />
                  <span style={{ fontSize: 11.5, fontWeight: 650, fontFamily: 'var(--lms-font)', color: isLinkQuestion ? 'var(--lms-orange)' : 'var(--lms-text-sec)', whiteSpace: 'nowrap' }}>
                    Question link
                  </span>
                </label>

                <div style={{ flex: 1 }} />

                {/* Score — graded: editable/fixed input; non-graded: label only */}
                {!exerciseIsGraded && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0,
                    padding: '4px 10px', borderRadius: 8,
                    border: '1.5px solid var(--lms-border)',
                    background: 'var(--lms-bg-surface)',
                  }}>
                    <Award size={12} style={{ color: 'var(--lms-text-muted)', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)', whiteSpace: 'nowrap' }}>Non-graded</span>
                  </div>
                )}
                {exerciseIsGraded && (
                  <span ref={scoreSectionRef} style={{
                    display: 'inline',
                    whiteSpace: 'nowrap'
                  }}>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={(() => {
                        const v = isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff);
                        return v === 0 ? '' : String(v);
                      })()}
                      placeholder="Enter the mark"
                      onChange={e => {
                        if (!isScoreEditable(currentDiff) || isGeneral || isFormDisabled) return;
                        const r = e.target.value;
                        if (/^\d*\.?\d*$/.test(r)) {
                          const n = parseFloat(r);
                          if (!isNaN(n) && n >= 0) setScore(n);
                          if (r === '') setScore(0);
                        }
                      }}
                      onBlur={handleScoreBlur}
                      disabled={isGeneral || !isScoreEditable(currentDiff) || isFormDisabled}
                      style={{
                        width: 120,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: 'inherit',
                        fontWeight: 400,
                        color: errs.score && touched.has('score') ? 'var(--lms-danger)' : 'var(--lms-text-main)',
                        fontFamily: 'var(--lms-font)',
                        textAlign: 'left',
                        padding: '0 0 2px 0',
                        margin: 0,
                        borderBottom: '1.5px solid #333',
                        lineHeight: 'inherit',
                        cursor: (isGeneral || !isScoreEditable(currentDiff) || isFormDisabled) ? 'not-allowed' : 'text',
                        borderRadius: 0,
                      }}
                    />
                    {(!isScoreEditable(currentDiff) || isGeneral) && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'var(--lms-font)',
                        padding: '1px 6px',
                        borderRadius: 20,
                        background: 'var(--lms-bg-surface2)',
                        color: 'var(--lms-text-muted)',
                        border: '1px solid var(--lms-border)',
                        marginLeft: 6,
                        verticalAlign: 'middle'
                      }}>Fixed</span>
                    )}
                  </span>
                )}
              </div>

              {/* Problem Title label */}

            </div>
            {/* ── Link mode: the ONE input that replaces the whole form ── */}
            {isLinkQuestion && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label className="lms-section-label" style={{ margin: 0 }}>
                    Question Link <span style={{ color: errs.questionLink && touched.has('questionLink') ? 'var(--lms-danger)' : 'var(--lms-text-muted)' }}>*</span>
                  </label>
                  {errs.questionLink && touched.has('questionLink') && (
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.questionLink}</span>
                  )}
                </div>
                <input
                  type="url"
                  value={questionLink}
                  onChange={e => {
                    setQuestionLink(e.target.value);
                    if (errs.questionLink && /^https?:\/\/\S+$/i.test(e.target.value.trim())) {
                      setErrs(p => { const n = { ...p }; delete n.questionLink; return n; });
                    }
                  }}
                  onBlur={() => setTouched(p => new Set(p).add('questionLink'))}
                  placeholder="https://leetcode.com/problems/add-two-numbers/description/"
                  disabled={isFormDisabled}
                  className={`lms-input${errs.questionLink && touched.has('questionLink') ? ' err' : ''}`}
                  style={{ width: '100%', fontSize: 13 }}
                  autoFocus
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', margin: 0 }}>
                    Students get an "Open the problem" button — the site opens in a new tab, they solve
                    it there and press Submit Question here. Only the link is required to save.
                  </p>
                  {/^https?:\/\/\S+$/i.test(questionLink.trim()) && (
                    <a
                      href={questionLink.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontFamily: 'var(--lms-font)', fontSize: 11.5, color: 'var(--lms-orange)', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                    >
                      Open in new tab ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            {!isLinkQuestion && (<>
            {/* Problem Title section */}
            <div ref={titleSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className={`lms-section-label`} style={{ margin: 0 }}>
                  Problem Title <span style={{ color: errs.title && touched.has('title') ? 'var(--lms-danger)' : 'var(--lms-text-muted)' }}>*</span>
                </label>
                {errs.title && touched.has('title') && (
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.title}</span>
                )}
              </div>

              {/* Title Editor - ContentEditable */}
              <div onBlur={() => setTouched(p => new Set(p).add('title'))}>
                {titleBlocks.map((b, bi) => {
                  if (b.type === 'text') {
                    return <TitleEditor
                      key={b.id}
                      titleBlocks={titleBlocks}
                      setTitleBlocks={(blocks) => {
                        setTitleBlocks(blocks);
                        if (errs.title && getTitleText(blocks)) setErrs(p => { const n = { ...p }; delete n.title; return n; });
                      }}
                      isDisabled={isCurrentPreExisting && !isEditMode}
                      hasError={!!(errs.title && touched.has('title'))}
                      setTouched={setTouched}
                    />;
                  }
                  if (b.type === 'image') {
                    return (
                      <ProgImageBlock
                        key={b.id}
                        block={b as any}
                        onUpdate={patch => setTitleBlocks(prev => prev.map(tb => tb.id === b.id ? { ...tb, ...patch } as ProgContentBlock : tb))}
                        onRemove={() => setTitleBlocks(prev => { const n = prev.filter(tb => tb.id !== b.id); return n.length ? n : [mkProgTextBlock()]; })}
                        disabled={isFormDisabled}
                      />
                    );
                  }
                  if (b.type === 'code') {
                    return (
                      <ProgCodeBlockMCQ
                        key={b.id}
                        block={b as any}
                        onUpdate={patch => setTitleBlocks(prev => prev.map(tb => tb.id === b.id ? { ...tb, ...patch } as ProgContentBlock : tb))}
                        onRemove={() => setTitleBlocks(prev => { const n = prev.filter(tb => tb.id !== b.id); return n.length ? n : [mkProgTextBlock()]; })}
                        disabled={isFormDisabled}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </div>{/* end titleSectionRef wrapper */}

            {/* ── Description ── */}
            <div ref={descSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label className="lms-section-label" style={{ margin: 0 }}>Problem Description <span style={{ color: 'var(--lms-danger)' }}>*</span></label>
                {errs.description && touched.has('description') && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.description}</span>}
              </div>
              <div onBlur={() => setTouched(p => new Set(p).add('description'))}>
                <ProgDescEditor
                  blocks={descBlocks}
                  onChange={blocks => {
                    setDescBlocks(blocks);
                    setDesc(blocks.filter(b => b.type === 'text').map(b => (b as any).value).join('\n'));
                  }}
                  disabled={isFormDisabled}
                  hasError={!!(errs.description && touched.has('description'))}
                  resetKey={currentIndex}
                />
              </div>
            </div>

            {/* ── Constraints ── */}
            <div ref={constraintsSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label className="lms-section-label" style={{ margin: 0 }}>
                    Constraints <span style={{ color: 'var(--lms-text-muted)' }}>*</span>
                  </label>
                  {errs.constraints && touched.has('constraints') && (
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.constraints}</span>
                  )}
                </div>
                <button onClick={() => setConstr(p => [...p, ''])} disabled={isFormDisabled}
                  className={`lms-btn ${isFormDisabled ? 'lms-btn-slate' : 'lms-btn-ghost-orange'}`}
                  style={{ padding: '4px 10px', fontSize: 11, opacity: isFormDisabled ? 0.5 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                  <Plus size={11} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {constraints.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8 }}>
                    <input value={c} onChange={e => { const a = [...constraints]; a[i] = e.target.value; setConstr(a); if (errs.constraints && a.some(x => x.trim())) setErrs(p => { const n = { ...p }; delete n.constraints; return n; }); }}
                      placeholder="e.g. 1 ≤ n ≤ 10⁵" disabled={isFormDisabled} className={`lms-input${errs.constraints && touched.has('constraints') ? ' err' : ''}`} style={{ flex: 1 }} />
                    {constraints.length > 1 && (
                      <button onClick={() => setConstr(p => p.filter((_, idx) => idx !== i))} disabled={isFormDisabled}
                        className="lms-icon-btn lms-icon-btn-red" style={{ opacity: isFormDisabled ? 0.4 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Test Cases ── */}
            <div ref={testcasesSectionRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <label className="lms-section-label" style={{ margin: 0 }}>
                    Test Cases <span style={{ color: 'var(--lms-text-muted)' }}>*</span>
                  </label>
                  {errs.testcases && touched.has('testcases') && (
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {errs.testcases}</span>
                  )}
                </div>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)' }}>Test Case 1 is the sample. Add hidden cases for grading.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tcs.map((tc, i) => (
                  <div key={tc.id}
                    style={{ border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)', padding: 12, background: i === 0 ? 'var(--lms-bg-white)' : 'var(--lms-bg-surface)', transition: 'all 0.15s' }}
                    className="group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: i === 0 ? 'var(--lms-orange-100)' : 'var(--lms-bg-surface2)', color: i === 0 ? '#c85a30' : 'var(--lms-text-sec)' }}>
                          Test Case {i + 1}{i === 0 ? ' · Sample' : ''}
                        </span>
                        {tc.isHidden && <span style={{ fontFamily: 'var(--lms-font)', fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'var(--lms-bg-surface2)', color: 'var(--lms-text-muted)' }}>Hidden</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {i > 0 && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)', cursor: 'pointer', userSelect: 'none' }}>
                            <input type="checkbox" checked={tc.isSample} onChange={e => updTC(tc.id, 'isSample', e.target.checked)} disabled={isFormDisabled} style={{ width: 12, height: 12, accentColor: 'var(--lms-orange)' }} />Sample
                          </label>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)', cursor: 'pointer', userSelect: 'none' }}>
                          <input type="checkbox" checked={tc.isHidden} onChange={e => updTC(tc.id, 'isHidden', e.target.checked)} disabled={isFormDisabled} style={{ width: 12, height: 12, accentColor: 'var(--lms-orange)' }} />Hidden
                        </label>
                        {i > 0 && (
                          <button onClick={() => delTC(tc.id)} disabled={isFormDisabled}
                            className="lms-icon-btn lms-icon-btn-red"
                            style={{ width: 26, height: 26, opacity: isFormDisabled ? 0.4 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label className="lms-section-label" style={{ margin: 0, marginBottom: 4, display: 'block' }}>Input (Click Enter to give multiple inputs)</label>
                        <TA value={tc.input} onChange={v => updTC(tc.id, 'input', v)} placeholder="stdin…" rows={3} mono disabled={isFormDisabled} />
                      </div>
                      <div>
                        <label className="lms-section-label" style={{ margin: 0, marginBottom: 4, display: 'block' }}>Expected Output</label>
                        <TA value={tc.expectedOutput} onChange={v => updTC(tc.id, 'expectedOutput', v)} placeholder="expected stdout…" rows={3} mono disabled={isFormDisabled} />
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label className="lms-section-label" style={{ margin: 0, marginBottom: 4, display: 'block' }}>Explanation <span style={{ fontWeight: 400, color: 'var(--lms-text-hint)', textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                      <input value={tc.description} onChange={e => updTC(tc.id, 'description', e.target.value)}
                        placeholder="Briefly explain what this test case verifies…"
                        disabled={isFormDisabled} className="lms-input" style={{ fontSize: 12 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={addTC} disabled={isFormDisabled}
                  className="lms-btn"
                  style={{ padding: '5px 12px', fontSize: 11, background: 'var(--lms-success-bg)', color: 'var(--lms-success)', borderColor: 'var(--lms-success-bdr)', opacity: isFormDisabled ? 0.5 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                  <Plus size={11} /> Add Test Case
                </button>
              </div>
            </div>

            {/* ── AI Test Cases count — visible ONLY when this exercise runs in
                AI evaluation mode with per-question count. Required in that mode
                (validate() blocks Save without a value); harmlessly hidden and
                skipped otherwise. Kept adjacent to Test Cases because that's
                where the concept lives conceptually. */}
            {(() => {
              const exEvm: any = exerciseData?.fullExerciseData?.evaluationMethod;
              const show = exEvm?.method === 'ai' && exEvm?.ai?.testCasesCountMode === 'perQuestion';
              if (!show) return null;
              const err = errs.aiTestCasesCount;
              const shown = touched.has('aiTestCasesCount') && err;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <label className="lms-section-label" style={{ margin: 0 }}>
                      AI Test Cases <span style={{ color: 'var(--lms-danger)' }}>*</span>
                    </label>
                    {shown && (
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)' }}>— {err}</span>
                    )}
                  </div>
                  <p style={{ fontFamily: 'var(--lms-font)', fontSize: 10.5, color: 'var(--lms-text-muted)', margin: 0 }}>
                    Count of NEW test cases the AI generates + evaluates for this question at Submit time.
                    Cached after the first student's Submit — every subsequent student sees the same set. Max 50.
                  </p>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={aiTestCasesCount ?? ''}
                    disabled={isFormDisabled}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '') {
                        setAiTestCasesCount(null);
                      } else {
                        const n = Math.max(0, Math.min(50, Math.floor(Number(val) || 0)));
                        setAiTestCasesCount(n);
                        setErrs(p => { const x = { ...p }; delete x.aiTestCasesCount; return x; });
                      }
                    }}
                    onBlur={() => setTouched(p => new Set(p).add('aiTestCasesCount'))}
                    placeholder="e.g. 20"
                    style={{
                      width: 160,
                      padding: '6px 10px',
                      fontFamily: 'var(--lms-font)',
                      fontSize: 13,
                      fontWeight: 600,
                      borderRadius: 'var(--lms-radius-md)',
                      border: `1.5px solid ${shown ? 'var(--lms-danger)' : 'var(--lms-border)'}`,
                      outline: 'none',
                      background: isFormDisabled ? 'var(--lms-bg-surface)' : 'var(--lms-bg-white)',
                    }}
                  />
                </div>
              );
            })()}

            {/* ── Hint ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="lms-section-label" style={{ margin: 0 }}>
                Hint <span style={{ fontWeight: 400, color: 'var(--lms-text-hint)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>(Optional)</span>
              </label>
              <TA value={hint} onChange={setHint} placeholder="Give students a helpful hint…" rows={2} disabled={isFormDisabled} />
            </div>

            {/* ── Additional Hints ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="lms-section-label" style={{ margin: 0 }}>Additional Hints</label>
                <button onClick={() => setExtraH(p => [...p, { hintText: '', pointsDeduction: 0, isPublic: true }])} disabled={isFormDisabled}
                  className={`lms-btn ${isFormDisabled ? 'lms-btn-slate' : 'lms-btn-ghost-orange'}`}
                  style={{ padding: '4px 10px', fontSize: 11, opacity: isFormDisabled ? 0.5 : 1, cursor: isFormDisabled ? 'not-allowed' : 'pointer' }}>
                  <Plus size={11} /> Add Hint
                </button>
              </div>
              {extraHints.map((h, i) => (
                <div key={i} style={{ border: '1.5px solid var(--lms-border)', borderRadius: 'var(--lms-radius-md)', padding: 12, background: 'var(--lms-bg-surface)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-text-sec)' }}>Hint {i + 2}</span>
                    <button onClick={() => setExtraH(p => p.filter((_, idx) => idx !== i))} disabled={isFormDisabled}
                      style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', background: 'none', border: 'none', cursor: isFormDisabled ? 'not-allowed' : 'pointer', opacity: isFormDisabled ? 0.4 : 1 }}>Remove</button>
                  </div>
                  <TA value={h.hintText} onChange={v => setExtraH(p => p.map((x, idx) => idx === i ? { ...x, hintText: v } : x))} placeholder="Hint text…" rows={2} disabled={isFormDisabled} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)' }}>
                      Deduction:
                      <NI value={h.pointsDeduction} onChange={v => setExtraH(p => p.map((x, idx) => idx === i ? { ...x, pointsDeduction: v } : x))}
                        min={0} max={10} disabled={isFormDisabled} cls="w-16" />
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-sec)', cursor: 'pointer', userSelect: 'none' }}>
                      <input type="checkbox" checked={h.isPublic} onChange={e => setExtraH(p => p.map((x, idx) => idx === i ? { ...x, isPublic: e.target.checked } : x))} disabled={isFormDisabled} style={{ width: 12, height: 12, accentColor: 'var(--lms-orange)' }} />
                      Public
                    </label>
                  </div>
                </div>
              ))}
            </div>
            </>)}{/* end !isLinkQuestion form sections */}

            {/* ── Validation errors ── */}
            {Object.keys(errs).length > 0 && touched.size > 0 && (
              <div style={{ padding: '12px 14px', background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)', borderRadius: 'var(--lms-radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <AlertCircle size={14} style={{ color: 'var(--lms-danger)' }} />
                  <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, color: 'var(--lms-danger)' }}>Fix before saving:</span>
                </div>
                <ul style={{ marginLeft: 16, listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {Object.values(errs).map((e, i) => <li key={i} style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-danger)' }}>{e}</li>)}
                </ul>
              </div>
            )}

            <div style={{ height: 8 }} />
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{ width: 280, flexShrink: 0, borderLeft: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

            {/* Two action buttons */}
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1.5px solid var(--lms-border)', flexShrink: 0, background: 'var(--lms-bg-surface)' }}>
              <button
                type="button"
                onClick={() => setShowDetailsModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                  fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                  border: '1.5px solid var(--lms-border)',
                  background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                }}
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

              {!isGeneral && (
                <button
                  type="button"
                  onClick={() => setShowOverviewModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                    fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                    border: '1.5px solid var(--lms-border)',
                    background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                  }}
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
              )}
              {sectionData && (
                <button
                  type="button"
                  onClick={() => setShowSectionModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '10px 14px', borderRadius: 'var(--lms-radius-md)',
                    fontFamily: 'var(--lms-font)', fontSize: 12.5, fontWeight: 600,
                    border: '1.5px solid var(--lms-border)',
                    background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                    marginTop: 8,
                  }}
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

            {/* Stats summary — Questions + Marks */}
            <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>

              {/* ── Current Difficulty Questions ── */}
              {!isGeneral && (
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
              )}

              {/* ── Overall Questions ── */}
              <div style={{ marginBottom: 14, borderTop: isGeneral ? 'none' : '1px dashed var(--lms-border)', paddingTop: isGeneral ? 0 : 14 }}>
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

              {/* ── Current Difficulty Marks ── */}
              {exerciseIsGraded && !isGeneral && totalMarksForDiff > 0 && (
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
                  {maxAssignableForCurrentQ !== null && (
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Max Assignable</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-info)', fontSize: 12 }}>
                        {fmtMark(maxAssignableForCurrentQ)}
                        {remainingSlots > 0 && (
                          <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 9, marginLeft: 4 }}>
                            (1 reserved × {remainingSlots})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
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
          {/* ── Exercise Details Modal ── */}
          {showDetailsModal && (
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
              onClick={e => { if (e.target === e.currentTarget) setShowDetailsModal(false); }}>
              <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 360, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Header */}
                <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-bg-surface)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <FileText size={14} style={{ color: 'var(--lms-text-sec)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Details</span>
                  </div>
                  <button type="button" onClick={() => setShowDetailsModal(false)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                    <X size={15} />
                  </button>
                </div>

                {/* Body — label:value rows */}
                <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                  {exerciseData.fullExerciseData?.exerciseInformation?.exerciseId && (
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
                      {exerciseName || 'Untitled'}
                    </span>
                  </div>
                  <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                    <span className="lms-detail-label">Exercise Type</span>
                    <span className="lms-detail-value" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                      {exerciseData.fullExerciseData?.exerciseType || 'programming'}
                    </span>
                  </div>
                  <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                    <span className="lms-detail-label">Configuration</span>
                    <span className="lms-detail-value" style={{ fontSize: 11 }}>
                      {isGeneral ? 'General' : cfgType === 'levelBased' ? 'Level Based' : 'Selection Level'}
                    </span>
                  </div>
                  <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                    <span className="lms-detail-label">Assessment Type</span>
                    <span className="lms-detail-value" style={{ fontSize: 11, fontWeight: 700, color: exerciseIsGraded ? 'var(--lms-success)' : 'var(--lms-warning)' }}>
                      {exerciseIsGraded ? 'Graded' : 'Non-Graded'}
                    </span>
                  </div>
                  {(exerciseData.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData.fullExerciseData?.exerciseInformation?.duration) && (
                    <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                      <span className="lms-detail-label">Duration</span>
                      <span className="lms-detail-value" style={{ fontSize: 11 }}>
                        {exerciseData.fullExerciseData?.exerciseInformation?.totalDuration || exerciseData.fullExerciseData?.exerciseInformation?.duration} mins
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button type="button" onClick={() => setShowDetailsModal(false)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Exercise Overview Modal ── */}
          {/* ── Exercise Overview Modal ── */}
          {showOverviewModal && (() => {
            // exerciseIsGraded from component level — graded = show marks, non-graded = questions only
            const configuredDiffs = getConfiguredDiffs();

            return (
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
                onClick={e => { if (e.target === e.currentTarget) setShowOverviewModal(false); }}>
                <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 400, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                  {/* Header */}
                  <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-info-bg)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <BarChart3 size={14} style={{ color: 'var(--lms-info)' }} />
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Exercise Overview</span>
                    </div>
                    <button type="button" onClick={() => setShowOverviewModal(false)}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--lms-text-muted)', display: 'flex', padding: 4, borderRadius: 6 }}>
                      <X size={15} />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto' }}>

                    {/* ── Overall Questions section ── */}
                    <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--lms-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                        <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Questions</span>
                      </div>



                      {/* Overall totals */}
                      <div style={{ marginTop: !isGeneral && configuredDiffs.length > 0 ? 12 : 0, paddingTop: !isGeneral && configuredDiffs.length > 0 ? 12 : 0, borderTop: !isGeneral && configuredDiffs.length > 0 ? '1px solid var(--lms-border)' : 'none' }}>
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Total Questions</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12, fontWeight: 700 }}>{totalSlotsAll}</span>
                        </div>
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Created</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12, fontWeight: 700 }}>
                            {createdCountAll}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalSlotsAll}</span>
                          </span>
                        </div>
                        <div className="lms-marks-row ">
                          <span className="lms-marks-label">Remaining</span>
                          <span className="lms-marks-value" style={{ color: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12, fontWeight: 700 }}>
                            {remainingSlotsAll}
                          </span>
                        </div>
                        {totalSlotsAll > 0 && (
                          <div className="lms-progress-bar" style={{ marginTop: 8, marginBottom: 15 }}>
                            <div className="lms-progress-fill mb-3" style={{ width: `${Math.min(100, (createdCountAll / totalSlotsAll) * 100)}%`, background: remainingSlotsAll === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                          </div>
                        )}
                      </div>
                      {/* Per-difficulty question breakdown — current difficulty only */}
                      {!isGeneral && configuredDiffs.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          {configuredDiffs.filter(d => d === currentDiff).map(d => {
                            const quota = getQuotaForDiff(d);
                            const created = getCreatedCount(d);
                            const diffColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                            return (
                              <div key={d} style={{ marginBottom: 8 }}>
                                <div className="lms-marks-row" style={{ marginBottom: 4 }}>
                                  <span className="lms-marks-label" style={{ textTransform: 'capitalize', color: diffColor, fontWeight: 700 }}>
                                    {d} <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--lms-text-muted)' }}>({quota} question{quota !== 1 ? 's' : ''})</span>
                                  </span>
                                  <span className="lms-marks-value" style={{ fontSize: 12 }}>
                                    <span style={{ color: 'var(--lms-violet)', fontWeight: 700 }}>{created}</span>
                                    <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }}>/{quota}</span>
                                    <span style={{
                                      color: created >= quota ? 'var(--lms-success)' : 'var(--lms-text-muted)',
                                      fontSize: 10,
                                      marginLeft: 6,
                                      fontWeight: 500
                                    }}>
                                      {created >= quota ? '✓ Complete' : `${quota - created} remaining`}
                                    </span>
                                  </span>
                                </div>
                                {quota > 0 && (
                                  <div className="lms-progress-bar" style={{ marginTop: 2 }}>
                                    <div className="lms-progress-fill" style={{
                                      width: `${Math.min(100, (created / quota) * 100)}%`,
                                      background: created >= quota ? 'var(--lms-success)' : diffColor
                                    }} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                    </div>

                    {/* ── Overall Marks section — graded only ── */}
                    {exerciseIsGraded && (isGeneral ? (generalTotalMarks > 0 || generalMPQ > 0) : totalMarksAll > 0) && (
                      <div style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          <Award size={12} style={{ color: 'var(--lms-violet)' }} />
                          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-violet)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Marks</span>
                        </div>

                        {isGeneral ? (
                          <>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Marks per Question</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{generalMPQ}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Questions</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{generalQuestionCount}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Marks</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{generalTotalMarks}</span>
                            </div>
                          </>
                        ) : (
                          // levelBased
                          <>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Total Marks</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{totalMarksAll}</span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Marks Used</span>
                              <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                                {fmtMark(usedMarksAll)}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMarksAll}</span>
                              </span>
                            </div>
                            <div className="lms-marks-row">
                              <span className="lms-marks-label">Remaining Marks</span>
                              <span className="lms-marks-value" style={{ color: (totalMarksAll - usedMarksAll) <= 0 ? 'var(--lms-success)' : 'var(--lms-text-main)', fontSize: 12 }}>
                                {fmtMark(Math.max(0, totalMarksAll - usedMarksAll))}
                              </span>
                            </div>
                            {totalMarksAll > 0 && (
                              <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                                <div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedMarksAll / totalMarksAll) * 100)}%`, background: usedMarksAll >= totalMarksAll ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                              </div>
                            )}

                            {/* Per-difficulty marks breakdown */}
                            {configuredDiffs.length > 0 && (
                              <div style={{ marginTop: 12 }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--lms-text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  By Difficulty
                                </div>
                                {configuredDiffs.filter(d => d === currentDiff).map(d => {
                                  const levelMarks = getTotalMarksForDiff(d);
                                  const usedD = getDbMarksUsedForDiff(d);
                                  const isQuestSpecific = getScoringType(d) === 'question_specific';
                                  const diffColor = d === 'easy' ? 'var(--lms-success)' : d === 'medium' ? 'var(--lms-warning)' : 'var(--lms-danger)';
                                  return (
                                    <div key={d} style={{
                                      marginBottom: 10,
                                      padding: '8px 10px',
                                      background: 'var(--lms-bg-surface)',
                                      borderRadius: 'var(--lms-radius-sm)',
                                      borderLeft: `3px solid ${diffColor}`,
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                        <span style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: 12, color: diffColor }}>
                                          {d}
                                        </span>
                                        {!isQuestSpecific && (
                                          <span style={{ fontSize: 10, color: 'var(--lms-text-muted)' }}>
                                            {getFixedScore(d)} per question
                                          </span>
                                        )}
                                        {isQuestSpecific && (
                                          <span style={{ fontSize: 10, color: 'var(--lms-violet)', fontStyle: 'italic' }}>
                                            custom per question
                                          </span>
                                        )}
                                      </div>
                                      <div className="lms-marks-row" style={{ marginBottom: 2 }}>
                                        <span className="lms-marks-label" style={{ fontSize: 11 }}>Total Marks</span>
                                        <span className="lms-marks-value" style={{ fontSize: 12, fontWeight: 700, color: 'var(--lms-violet)' }}>
                                          {levelMarks || 0}
                                        </span>
                                      </div>
                                      <div className="lms-marks-row">
                                        <span className="lms-marks-label" style={{ fontSize: 11 }}>Used Marks</span>
                                        <span className="lms-marks-value" style={{
                                          fontSize: 12,
                                          fontWeight: 700,
                                          color: usedD >= levelMarks && levelMarks > 0 ? 'var(--lms-success)' : 'var(--lms-warning)'
                                        }}>
                                          {fmtMark(usedD)}
                                        </span>
                                      </div>
                                      {levelMarks > 0 && (
                                        <div className="lms-progress-bar" style={{ marginTop: 4 }}>
                                          <div className="lms-progress-fill" style={{
                                            width: `${Math.min(100, (usedD / levelMarks) * 100)}%`,
                                            background: usedD >= levelMarks ? 'var(--lms-success)' : diffColor
                                          }} />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button type="button" onClick={() => setShowOverviewModal(false)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Section Details Modal ── */}
          {showSectionModal && sectionData && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,15,30,0.45)', backdropFilter: 'blur(2px)' }}
              onClick={e => { if (e.target === e.currentTarget) setShowSectionModal(false); }}>
              <div style={{ background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)', boxShadow: '0 20px 56px rgba(0,0,0,0.20)', width: 420, maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', borderBottom: '1.5px solid var(--lms-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--lms-violet-bg)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Layers size={14} style={{ color: 'var(--lms-violet)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: 'var(--lms-text-main)' }}>Section Details</span>
                  </div>
                  <button type="button" onClick={() => setShowSectionModal(false)}
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
                      {sectionData.programmingSectionMarks !== undefined && (
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Programming Marks</span>
                          <span className="lms-marks-value" style={{ color: 'var(--lms-success)', fontSize: 12 }}>{sectionData.programmingSectionMarks}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 16px', borderTop: '1.5px solid var(--lms-border)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                  <button type="button" onClick={() => setShowSectionModal(false)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        {/* ── FOOTER ── */}
        {/* ── FOOTER ── */}
        {/* ── FOOTER ── */}
        <div style={{ background: 'var(--lms-bg-white)', borderTop: '1.5px solid var(--lms-border)', padding: '12px 20px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 12, flexShrink: 0 }}>

          {/* Left: saving indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isSaving && (
              <>
                <Loader2 size={13} style={{ color: 'var(--lms-orange)' }} className="animate-spin" />
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-orange)' }}>{saveMessage || 'Saving…'}</span>
                <div style={{ width: 80, height: 4, background: 'var(--lms-bg-surface2)', borderRadius: 2, overflow: 'hidden', marginLeft: 4 }}>
                  <div style={{ height: '100%', background: 'var(--lms-orange)', borderRadius: 2, transition: 'width 0.3s', width: `${saveProgress}%` }} />
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Previous — show whenever there's any earlier question in the flow,
                regardless of difficulty. Clicking will auto-switch the form's
                current difficulty if the previous question lives in a different one. */}
            {currentIndex > 0 && (
              <button onClick={handlePrevious} disabled={isSaving} className="lms-nav-btn"
                style={{ opacity: isSaving ? 0.5 : 1 }}>
                <ChevronLeft size={13} /> Previous
              </button>
            )}

            {/* Next — show when not on last question in flow */}
            {currentIndex < flowQuestions.length - 1 && (
              <button onClick={() => {
                const snap = snapshotForm({
                  isSaved: flowQuestions[currentIndex]?.isSaved || false,
                  _id: getServerId(flowQuestions[currentIndex])
                });
                const newFlow = [...flowQuestionsRef.current];
                newFlow[currentIndex] = snap;
                flowQuestionsRef.current = newFlow;
                setFlowQuestions(newFlow);
                const nextIdx = currentIndex + 1;
                currentIndexRef.current = nextIdx;
                setCurrentIndex(nextIdx);
                if (!isGeneral && newFlow[nextIdx]?.difficulty) {
                  setCurrentDiff(newFlow[nextIdx].difficulty as Diff);
                }
                loadQuestionIntoForm(newFlow[nextIdx]);
                setTimeout(() => titleRef.current?.focus(), 80);
              }} disabled={isSaving} className="lms-nav-btn"
                style={{ opacity: isSaving ? 0.5 : 1 }}>
                Next <ChevronRight size={13} />
              </button>
            )}

            {/* Save — always show */}
            <button onClick={handleSave} disabled={isSaving}
              className="lms-btn lms-btn-slate"
              style={{ opacity: isSaving ? 0.5 : 1, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Save
            </button>

            {/* Save & Continue / Finish */}
            {(() => {
              const currentQ = flowQuestions[currentIndex];
              const isSaved = !!(getServerId(currentQ) || currentQ?.isSaved || currentQ?.isPreExisting);
              const isFinish = isLastQuestion;
              const hasChanges = hasUnsavedFormChanges;

              let label: string;
              if (!isSaved) {
                label = isFinish ? 'Save & Finish' : 'Save & Continue';
              } else if (isFinish) {
                label = hasChanges ? 'Update & Finish' : 'Finish';
              } else {
                label = 'Update & Continue';
              }

              const isGreen = isFinish;

              return (
                <button onClick={handleSaveAndContinue} disabled={isSaving}
                  className="lms-btn lms-btn-orange"
                  style={{
                    opacity: isSaving ? 0.6 : 1,
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    background: isGreen ? 'var(--lms-success)' : 'var(--lms-orange)',
                    boxShadow: isGreen
                      ? '0 2px 8px rgba(22,163,74,0.25)'
                      : '0 2px 8px var(--lms-orange-glow)',
                  }}>
                  {isSaving
                    ? <Loader2 size={13} className="animate-spin" />
                    : isGreen ? <CheckCircle2 size={13} /> : <Zap size={13} />}
                  {label}
                  {isGreen ? <Flag size={11} /> : <ArrowRight size={11} />}
                </button>
              );
            })()}

            {/* Request Approve — only when this question has an open query */}
            {(() => {
              const ap = approval || initialData?.approval || null;
              const ctx = approvalContext || deriveApprovalContext(initialData, exerciseData, tabType);
              if (!ap || !ctx) return null;
              return (
                <RequestApproveButton approval={ap} context={ctx} onResolved={onQueryResolved || onClose} />
              );
            })()}

            {/* Delete */}
            {flowQuestions.length > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSaving}
                className="lms-btn"
                style={{
                  background: 'var(--lms-danger-bg)',
                  color: 'var(--lms-danger)',
                  borderColor: 'var(--lms-danger-bdr)',
                  opacity: isSaving ? 0.5 : 1,
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}>
                <Trash2 size={12} /> Delete
              </button>
            )}

            {/* Clear */}
            {anyFormFieldHasContent && (
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={isSaving}
                className="lms-btn"
                style={{
                  background: 'var(--lms-warning-bg)',
                  color: 'var(--lms-warning)',
                  borderColor: 'var(--lms-warning-bdr)',
                  opacity: isSaving ? 0.5 : 1,
                  cursor: isSaving ? 'not-allowed' : 'pointer'
                }}>
                <X size={12} /> Clear
              </button>
            )}
          </div>
          {/* Right: Mock + Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setShowMockModal(true)}
              disabled={!isMockEnabled}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)',
                fontSize: 12, fontWeight: 600, cursor: isMockEnabled ? 'pointer' : 'not-allowed',
                border: `1.5px solid ${isMockEnabled ? 'var(--lms-violet-bdr)' : 'var(--lms-border)'}`,
                background: isMockEnabled ? 'var(--lms-violet-bg)' : 'var(--lms-bg-surface)',
                color: isMockEnabled ? 'var(--lms-violet)' : 'var(--lms-text-hint)',
                transition: 'all 0.15s', opacity: isMockEnabled ? 1 : 0.55,
              }}
            >
              <Eye size={13} /> Mock
            </button>
            <button
              type="button"
              onClick={handleCloseRequest}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '7px 14px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)',
                color: 'var(--lms-text-sec)', transition: 'all 0.15s',
              }}
            >
              <X size={13} /> Close
            </button>
          </div>

        </div>

      </div>
      {/* ── DIALOGS ── */}
      {/* Suppress the "All difficulties complete!" branch (see the student-
          copy for the full rationale): the popup was firing bogusly when
          another difficulty still had customDistribution slots available
          but zero programming per-difficulty quota. Only render when
          there's actually a next difficulty to jump to. */}
      {showDiffPopup && completedDiff && availableNextDiffs.length > 0 && (
        <DifficultyPopup completedDiff={completedDiff} availableNext={availableNextDiffs}
          onSelect={handleDiffSelect} onClose={() => { setShowDiffPopup(false); setCompletedDiff(null); }} />
      )}
      {diffSwitchTarget && (
        <DiffSwitchDialog fromDiff={currentDiff} toDiff={diffSwitchTarget} remainingInTo={getRemainingSlots(diffSwitchTarget)}
          onConfirm={confirmDiffSwitch} onCancel={() => setDiffSwitchTarget(null)} />
      )}
      {showPreview && (
        <PreviewModal
          questions={(() => {
            // Always start from DB as source of truth
            const dbQuestions = getDbQuestionsForDiff().map(dbQuestionToFlow);
            const dbIdSet = new Set(dbQuestions.map(q => q._id).filter(Boolean));

            // Add any newly saved questions from this session not yet in DB
            const sessionSaved = flowQuestions.filter(q => {
              const sid = serverIdMap.current.get(q.__localId) || q._id;
              return sid && !dbIdSet.has(sid);
            });

            return [...dbQuestions, ...sessionSaved];
          })()}
          currentIndex={currentIndex}
          isGeneral={isGeneral}
          exerciseData={exerciseData}
          onJump={handleJumpTo}
          onDelete={handleDeleteQuestion}
          onClose={() => setShowPreview(false)}
          onDone={handleCloseRequest}
          hierarchyData={hierarchyData}
          tabType={tabType}
          subcategory={subcategory}
          subcategoryLabel={subcategoryLabel}
          exerciseName={exerciseName}
          actionLabel="Preview"
          questionLabel={`${Math.max(getDbQuestionsForDiff().length, flowQuestions.filter(q => !!(q._id || q.isSaved || q.isPreExisting)).length)} Question${Math.max(getDbQuestionsForDiff().length, flowQuestions.filter(q => !!(q._id || q.isSaved || q.isPreExisting)).length) !== 1 ? 's' : ''}`}
          currentDiff={currentDiff}
          score={score}
          generalMPQ={generalMPQ}
          totalSlots={totalSlots}
          createdCount={createdCount}
          remainingSlots={remainingSlots}
          isScoreEditable={isScoreEditable}
          getFixedScore={getFixedScore}
          getConfiguredDiffs={getConfiguredDiffs}
          getRemainingSlots={getRemainingSlots}
          getDbQuestionsForDiff={getDbQuestionsForDiff}
          getQuotaForDiff={getQuotaForDiff}
          getCreatedCount={getCreatedCount}
          getTotalMarksForDiff={getTotalMarksForDiff}
          usedMarks={usedMarks}
          onDiffRowClick={handleDiffRowClick}
          cfgType={cfgType}
          totalMarksAll={totalMarksAll}
          usedMarksAll={usedMarksAll}
          displayScore={displayScore}
          remainingMarks={remainingMarks}
          totalMarksForDiff={totalMarksForDiff}
          totalSlotsAll={totalSlotsAll}
          createdCountAll={createdCountAll}
          remainingSlotsAll={remainingSlotsAll}
        />
      )}
      {showEditExerciseConfirm && (
        <EditExerciseConfirmDialog exerciseName={exerciseName}
          onConfirm={handleEditExerciseConfirm} onCancel={() => setShowEditExerciseConfirm(false)} />
      )}
      {showCloseConfirm && (
        <CloseConfirmDialog hasUnsavedChanges={hasUnsavedFormChanges} hasSavedQuestions={hasSavedQuestionsInSession}
          onConfirm={handleCloseConfirmed} onCancel={() => setShowCloseConfirm(false)} />
      )}
      {showMockModal && (
        <ProgrammingMockModal
          questions={(() => {
            // Get all saved questions from DB across ALL difficulties
            const allDbQuestions: FlowQuestion[] = getDbQuestionsForDiff().map(dbQuestionToFlow);

            // Get saved questions from flow that are NOT already in DB (newly saved in this session)
            const dbIds = new Set(allDbQuestions.map(q => q._id).filter(Boolean));
            const sessionSaved = flowQuestions.filter(q => {
              const sid = serverIdMap.current.get(q.__localId) || q._id;
              return sid && !dbIds.has(sid);
            }).map(q => ({
              ...q,
              _id: serverIdMap.current.get(q.__localId) || q._id,
            }));

            // Combine DB + session saved
            const allSaved = [...allDbQuestions, ...sessionSaved];

            // Check if current question is unsaved but has content — append it
            const currentQ = flowQuestions[currentIndex];
            const currentAlreadySaved = currentQ && (
              currentQ.isSaved ||
              currentQ._id ||
              serverIdMap.current.has(currentQ.__localId)
            );

            if (currentFormHasContent && !currentAlreadySaved) {
              const previewQ: FlowQuestion = {
                __localId: 'mock-preview-current',
                _id: undefined,
                title: getTitleText(titleBlocks) || '',
                description: descBlocks,
                difficulty: isGeneral ? 'medium' : currentDiff,
                score: isGeneral ? generalMPQ : isScoreEditable(currentDiff) ? score : getFixedScore(currentDiff),
                testCases: tcs.map((tc, i) => ({
                  input: tc.input,
                  expectedOutput: tc.expectedOutput,
                  isSample: tc.isSample,
                  isHidden: tc.isHidden,
                  points: 1,
                  explanation: tc.description || `Test Case ${i + 1}`,
                  sequence: i,
                })),
                constraints: constraints.filter(c => c.trim()),
                hints: hint.trim()
                  ? [{ hintText: hint.trim(), pointsDeduction: 0, isPublic: true, sequence: 0 }]
                  : [],
                timeLimit,
                memoryLimit: memLimit,
                questionType: 'programming',
                isSaved: false,
                isDirty: false,
              };
              return [...allSaved, previewQ];
            }

            return allSaved;
          })()}
          selectedLanguages={
            exerciseData.fullExerciseData?.programmingSettings?.selectedLanguages || ['Python']
          }
          exerciseIsGraded={exerciseIsGraded}
          onClose={() => setShowMockModal(false)}
        />
      )}

      {/* Delete Confirm Dialog */}
      {showDeleteConfirm && (
        <div className="lms-modal-backdrop">
          <div className="lms-modal">
            <div className="lms-modal-header" style={{ background: 'var(--lms-danger-bg)', borderBottom: '1.5px solid var(--lms-danger-bdr)' }}>
              <div className="lms-modal-icon" style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}>
                <AlertTriangle size={16} style={{ color: 'var(--lms-danger)' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Delete Question?</h2>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This action cannot be undone</p>
              </div>
            </div>
            <div className="lms-modal-body">
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>
                Are you sure you want to delete <strong style={{ color: 'var(--lms-text-main)' }}>
                  "{getTitleText(titleBlocks) || 'this question'}"</strong>?
              </p>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-danger)', fontWeight: 600 }}>
                This will permanently remove it from the exercise.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowDeleteConfirm(false)} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleDeleteCurrentQuestion} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-danger)', color: 'white', border: 'none', boxShadow: 'none' }}>
                  <Trash2 size={13} /> Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirm Dialog */}
      {showClearConfirm && (
        <div className="lms-modal-backdrop">
          <div className="lms-modal">
            <div className="lms-modal-header" style={{ background: 'var(--lms-warning-bg)', borderBottom: '1.5px solid var(--lms-warning-bdr)' }}>
              <div className="lms-modal-icon" style={{ background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)' }}>
                <AlertCircle size={16} style={{ color: 'var(--lms-warning)' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Clear All Fields?</h2>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This will reset the current question</p>
              </div>
            </div>
            <div className="lms-modal-body">
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>
                Are you sure you want to clear all fields for this question?
              </p>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-warning)', fontWeight: 600 }}>
                Any unsaved content will be lost.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowClearConfirm(false)} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleClearCurrentQuestion} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-warning)', color: 'white', border: 'none', boxShadow: 'none' }}>
                  <X size={13} /> Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Clear Confirm Dialog */}
      {showClearConfirm && (
        <div className="lms-modal-backdrop">
          <div className="lms-modal">
            <div className="lms-modal-header" style={{ background: 'var(--lms-warning-bg)', borderBottom: '1.5px solid var(--lms-warning-bdr)' }}>
              <div className="lms-modal-icon" style={{ background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)' }}>
                <AlertCircle size={16} style={{ color: 'var(--lms-warning)' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--lms-font)', fontSize: 14, fontWeight: 700, color: 'var(--lms-text-main)' }}>Clear All Fields?</h2>
                <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-text-muted)', marginTop: 2 }}>This will reset the current question</p>
              </div>
            </div>
            <div className="lms-modal-body">
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 12, color: 'var(--lms-text-sec)', lineHeight: 1.6, marginBottom: 4 }}>
                Are you sure you want to clear all fields for this question?
              </p>
              <p style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: 'var(--lms-warning)', fontWeight: 600 }}>
                Any unsaved content will be lost.
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setShowClearConfirm(false)} className="lms-cancel-btn" style={{ flex: 1 }}>Cancel</button>
                <button onClick={handleClearCurrentQuestion} className="lms-btn" style={{ flex: 1, justifyContent: 'center', background: 'var(--lms-warning)', color: 'white', border: 'none', boxShadow: 'none' }}>
                  <X size={13} /> Yes, Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
           {/* ── Question Bank Selector ── */}
{showBankSelector && (
  <div className="fixed inset-0 z-[9999]">
    <QuestionBankSelector
      exerciseData={{
        exerciseId: exerciseDbId,
        exerciseName: exerciseData?.exerciseName || exerciseData?.fullExerciseData?.exerciseInformation?.exerciseName || '',
        exerciseLevel: exerciseData?.fullExerciseData?.exerciseInformation?.exerciseLevel || 'intermediate',
        nodeId: entityId,
        nodeName: exerciseData?.nodeName || '',
        subcategory,
        nodeType: exerciseData?.nodeType || '',
        fullExerciseData: exerciseData?.fullExerciseData,
        exerciseType: exerciseData?.exerciseType || exerciseData?.fullExerciseData?.exerciseType || '',
      }}
      
      tabType={tabType}
      onClose={() => {
        setShowBankSelector(false);
        // Cancel any pending reopen timer so a dismiss can't race the re-pop.
        if (reopenTimerRef.current) { clearTimeout(reopenTimerRef.current); reopenTimerRef.current = null; }
        // Bank/Other-Platform-alone flow: closing the auto-opened picker with
        // no picks made and no manual work in progress exits the form —
        // otherwise (Custom exercise with a manual slice still to fill, or a
        // dropdown-opened picker) leave the form mounted so the teacher can
        // finish authoring the remaining slots by hand. Also suppress the
        // Save-&-Next re-pop so this picker doesn't reappear after every
        // manually-authored question.
        const isBankLike = autoOpenSource === 'bank' || autoOpenSource === 'thirdParty';
        const srcKey = autoOpenSource === 'thirdParty' ? 'thirdParty' as const : 'scratch' as const;
        // "Manual slots remain" is only computable per source when allowedSources.manual
        // is true (Custom mode with a 'scratch' sub-source). In pure-bank / pure-thirdParty
        // exercises manual is false, so the check collapses to false and the historical
        // "close the form" behaviour is preserved.
        const manualSlotsRemain = allowedSources.manual && getSourceRemainingTotal('scratch') > 0;
        if (
          isBankLike
          && sourceModalAutoOpenedRef.current
          && !sourceModalAddedRef.current
          && !hasUnsavedFormChanges
          && !manualSlotsRemain
        ) {
          onClose();
          return; // form is tearing down — no re-route on top of it
        } else if (isBankLike && sourceModalAutoOpenedRef.current) {
          // Auto-opened picker dismissed with manual work still available: keep
          // the form, suppress the re-pop loop, and hand the current blank
          // slot back to manual so the source tag it saves under is correct.
          autoReopenSuppressedRef.current = true;
          pendingSourceRef.current = 'scratch-manual';
        }
        // Whatever closed the picker: a blank slot manual can't fill must be
        // re-routed immediately — single usable source re-pops its modal
        // (trainer's rule: it returns until the slot is filled), several open
        // the dropdown. reopen no-ops when manual has room, so the legitimate
        // blank-editor landing is untouched.
        if (landedOnBlankSlot()) reopenSourceModalForBlankSlot();
      }}
      onBack={() => { setShowBankSelector(false); setShowAddDropdown(true); }}
      onSelect={(qs) => { setShowBankSelector(false); handleBankSelectedQuestions(qs); }}
      // Both the question's own id AND its bank-origin id: bank imports get a
      // fresh _id on save, so without bankQuestionId the picker's duplicate
      // check could never match a previously imported question.
      existingQuestionIds={(exerciseData?.fullExerciseData?.questions || []).flatMap((q: any) => [q._id, q.bankQuestionId]).filter(Boolean)}
      existingQuestions={exerciseData?.fullExerciseData?.questions || []}
      // ✅ ADD THIS LINE - filter to show only programming questions
      filterByType="programming"
      // Other Platform imports read the SEPARATE platform bank collection.
      bankSource={srcOfTag(pendingSourceRef.current) === 'thirdParty' ? 'otherPlatform' : 'bank'}
      // Open-slot quota — blocks over-selection at tick time. In Custom mode
      // the slots are further narrowed to the slice owned by the source that
      // opened this picker (scratch-bank vs thirdParty).
      selectionQuota={(() => {
        if (isGeneral) return { mode: 'general' as const, remainingTotal: getRemainingSlots() };
        const srcKey = srcOfTag(pendingSourceRef.current) === 'thirdParty' ? 'thirdParty' as const : 'scratch' as const;
        return {
          mode: 'difficulty' as const,
          remainingByDifficulty: {
            easy: getSourceRemaining(srcKey, 'easy' as Diff),
            medium: getSourceRemaining(srcKey, 'medium' as Diff),
            hard: getSourceRemaining(srcKey, 'hard' as Diff),
          },
        };
      })()}
    onEditQuestion={(question) => {
    setShowQuestionBank(false);
    setSelectedProgrammingQuestion(question);
    setShowProgrammingForm(true);
  }}
/>
  </div>
)}

{/* AI Generation — uses Gemini to author programming questions, then funnels
    them through the same `handleBankSelectedQuestions` path the bank uses. */}
<GenerateProgFamilyAI
  formType="programming"
  isOpen={showAIModal}
  onClose={() => {
    setShowAIModal(false);
    // Cancel any pending reopen timer so a dismiss can't race the re-pop.
    if (reopenTimerRef.current) { clearTimeout(reopenTimerRef.current); reopenTimerRef.current = null; }
    // Only an AUTO-OPENED AI modal may cascade-close the form, and only when
    // the exercise has no manual-authoring slice left to fill. Dismissing an
    // AI modal that was opened by hand from the "+" dropdown never tears down
    // the form (a real bug — teachers were losing their work). Also protects
    // the "AI generated some, manual slots remain" case: instead of unmounting
    // the whole editor, keep the blank slot mounted so the teacher can type
    // the remaining manual questions in place.
    const manualSlotsRemain = allowedSources.manual && getSourceRemainingTotal('scratch') > 0;
    if (
      autoOpenSource === 'ai'
      && sourceModalAutoOpenedRef.current
      && !sourceModalAddedRef.current
      && !hasUnsavedFormChanges
      && !manualSlotsRemain
    ) {
      onClose();
      return; // form is tearing down — no re-route on top of it
    } else if (autoOpenSource === 'ai' && sourceModalAutoOpenedRef.current) {
      // Keep the form on screen and stop re-popping. Reset the pending source
      // to scratch-manual so anything the teacher types now is stamped as a
      // manual question (mkPayload reads pendingSourceRef.current at 3878) —
      // without this the manual question would be billed to the AI slice.
      autoReopenSuppressedRef.current = true;
      pendingSourceRef.current = 'scratch-manual';
    }
    // Same re-route as the bank picker's onClose: a blank slot whose cell
    // manual can't fill re-pops the single usable source (until filled) or
    // opens the dropdown when several remain.
    if (landedOnBlankSlot()) reopenSourceModalForBlankSlot();
  }}
  initialDifficulty={(isGeneral ? 'medium' : currentDiff) as any}
  maxCount={isGeneral
    ? Math.max(1, getRemainingSlots(undefined, flowQuestionsRef.current) || 10)
    : Math.max(1, getRemainingSlots(currentDiff, flowQuestionsRef.current) || 10)}
  // Level-Based / Selection-Level → hand the popup the remaining slots per
  // difficulty so it renders three sliders (Easy/Medium/Hard) each capped at
  // the respective value. General mode omits this and keeps the single slider.
  perDifficultyQuotas={!isGeneral ? {
    // In Custom mode each slider is additionally capped by the AI column of
    // the distribution matrix (getSourceRemaining min's with open slots).
    easy: Math.max(0, getSourceRemaining('ai', 'easy' as Diff) || 0),
    medium: Math.max(0, getSourceRemaining('ai', 'medium' as Diff) || 0),
    hard: Math.max(0, getSourceRemaining('ai', 'hard' as Diff) || 0),
  } : undefined}
  contextHint={exerciseData?.selectedLanguages?.join(', ')}
  breadcrumbs={[
    hierarchyData?.courseName    && { name: hierarchyData.courseName,    type: 'course' },
    hierarchyData?.moduleName    && { name: hierarchyData.moduleName,    type: 'module' },
    hierarchyData?.submoduleName && { name: hierarchyData.submoduleName, type: 'submodule' },
    hierarchyData?.topicName     && { name: hierarchyData.topicName,     type: 'topic' },
    hierarchyData?.subtopicName  && { name: hierarchyData.subtopicName,  type: 'subtopic' },
  ].filter(Boolean) as { name: string; type: string }[]}
  exerciseName={exerciseName}
  onGenerated={(qs) => handleBankSelectedQuestions(qs as any, 'ai')}
/>

    </div>
  );
};

export default ProgrammingQuestionForm;