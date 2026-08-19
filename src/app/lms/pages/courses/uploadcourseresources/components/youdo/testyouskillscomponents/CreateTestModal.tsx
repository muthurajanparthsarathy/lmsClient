import { getToken } from "@/lib/session";
import { API_BASE_URL } from "@/lib/http";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, AlertCircle, Loader, X, ChevronUp, ChevronDown, Sparkles,
  List, CheckSquare, AlignLeft, ChevronDown as ChevronDownIcon,
  Bold, Italic, Underline, Image, HelpCircle,
  ZoomIn, ZoomOut, Check, Hash, Save,
  BookOpen, Pencil, Type, ChevronLeft, ChevronRight,
  Info, Target, Award,
  Clock, FileText,
  Eye, Edit2, Database, CheckCircle2, Copy,
  ArrowUpDown, MoveVertical, Equal, Binary, ToggleLeft,
  MousePointerClick,
  Settings2,
  RotateCcw,
  GraduationCap,
  Code, Palette,
  CloudUpload,
  Grid3x3,
  CheckCircle
} from 'lucide-react';

import { youDoMcqApi, getEntityTypeFromNodeType } from '@/apiServices/pedagogyAndModuleAdd/testYourSkillsApi';
import TestYourSkillsGenerateMCQAIQuestion,  { GeneratedQuestion } from './TestYourSkillsGenerateMCQAIQuestion';

// ─── TOAST SYSTEM ───────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

const ToastContainer: React.FC<{ toasts: ToastMessage[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;
  
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    error: <AlertCircle className="h-4 w-4 text-red-500" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-500" />,
    info: <Info className="h-4 w-4 text-blue-500" />,
  };
  
  const bars: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };
  
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-xl shadow-2xl overflow-hidden flex items-stretch"
          style={{
            background: 'var(--lms-bg-white)',
            border: '1.5px solid var(--lms-border)',
            animation: 'lms-slide-in-right 0.3s cubic-bezier(0.34,1.56,0.64,1)'
          }}
        >
          <div className={`w-1 flex-shrink-0 ${bars[t.type]}`} />
          <div className="flex items-start gap-3 px-3 py-3 flex-1">
            <div className="flex-shrink-0 mt-0.5">{icons[t.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold leading-tight" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)' }}>
                {t.title}
              </p>
              {t.message && (
                <p className="text-[11px] mt-0.5 leading-snug" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-sec)' }}>
                  {t.message}
                </p>
              )}
            </div>
            <button onClick={() => onRemove(t.id)} className="flex-shrink-0 p-0.5 rounded-lg transition-colors mt-0.5 hover:bg-slate-100">
              <X className="h-3.5 w-3.5" style={{ color: 'var(--lms-text-hint)' }} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  const remove = (id: string) => setToasts(p => p.filter(t => t.id !== id));
  
  const add = (type: ToastType, title: string, message?: string, duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(p => [...p, { id, type, title, message }]);
    setTimeout(() => remove(id), duration);
  };
  
  return {
    toasts,
    remove,
    success: (title: string, message?: string) => add('success', title, message),
    error: (title: string, message?: string) => add('error', title, message),
    warning: (title: string, message?: string) => add('warning', title, message),
    info: (title: string, message?: string) => add('info', title, message),
  };
};

// ─── FONT INJECTION ───────────────────────────────────────────────────────────
const injectFonts = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap';
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
        --lms-text-sec:      #6b6b7e;
        --lms-text-muted:    #8b8b9e;
        --lms-text-hint:     #bcbccc;
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
      .lms-font { font-family: var(--lms-font) !important; }
      select option, select optgroup { color: #1a1a2e !important; background: white !important; }
      .lms-underline-select {
        -webkit-appearance: none; -moz-appearance: none; appearance: none;
        background: transparent; border: none;
        border-bottom: 1.5px solid var(--lms-border); border-radius: 0;
        padding: 4px 24px 4px 0; font-size: 13px; font-weight: 600;
        color: var(--lms-text-main); cursor: pointer; outline: none;
        transition: border-color 0.15s; font-family: var(--lms-font);
      }
      .lms-underline-select:focus { border-bottom-color: var(--lms-orange); }
      .lms-underline-select:hover { border-bottom-color: var(--lms-border-hover); }
      .lms-underline-select.placeholder-select { color: var(--lms-text-hint); }
      .lms-underline-input {
        background: transparent; border: none;
        border-bottom: 1.5px solid var(--lms-border); border-radius: 0;
        padding: 4px 4px 4px 0; font-size: 13px; font-weight: 600;
        color: var(--lms-text-main); outline: none;
        transition: border-color 0.15s; font-family: var(--lms-font);
        -moz-appearance: textfield;
      }
      .lms-underline-input:focus { border-bottom-color: var(--lms-orange); }
      .lms-underline-input::placeholder { color: var(--lms-text-hint); font-weight: 400; }
      .lms-underline-input.score-error { border-bottom-color: var(--lms-danger); color: var(--lms-danger); }
      .lms-select-wrap { position: relative; display: inline-flex; align-items: center; }
      .lms-select-wrap .chevron-icon {
        position: absolute; right: 2px; top: 50%; transform: translateY(-50%);
        pointer-events: none; color: var(--lms-text-hint); width: 13px; height: 13px;
      }
      .lms-q-text-editor {
        font-size: 15px !important; font-weight: 500 !important;
        color: var(--lms-text-main) !important; line-height: 1.65 !important;
        caret-color: var(--lms-orange);
        font-family: var(--lms-font) !important;
      }
      .lms-option-input {
        font-size: 14px !important; color: var(--lms-text-main) !important;
        font-weight: 500; font-family: var(--lms-font) !important;
      }
      .lms-option-input::placeholder { color: var(--lms-text-sec) !important; font-weight: 400; }
      .lms-option-row {
        display: flex; align-items: center; gap: 10px;
        padding: 7px 4px 8px; border-bottom: 1px solid var(--lms-border);
        position: relative; cursor: text; transition: padding 0.18s ease;
      }
      .lms-option-row::after {
        content: ''; position: absolute; bottom: -1px; left: 50%;
        transform: translateX(-50%) scaleX(0);
        width: 100%; height: 2px; background: var(--lms-orange); border-radius: 1px;
        transition: transform 0.22s cubic-bezier(0.4,0,0.2,1); transform-origin: center;
      }
      .lms-option-row:focus-within { padding-top: 9px; padding-bottom: 10px; }
      .lms-option-row:focus-within::after { transform: translateX(-50%) scaleX(1); }
      .lms-answer-key-btn {
        display: inline-flex; align-items: center; gap: 7px;
        color: var(--lms-info); font-size: 13.5px; font-weight: 600;
        font-family: var(--lms-font); background: none; border: none;
        padding: 0; cursor: pointer; transition: color 0.15s;
      }
      .lms-answer-key-btn:hover { color: #EA580C; }
      .lms-answer-key-checkbox {
        width: 16px; height: 16px; border: 2px solid var(--lms-info);
        border-radius: 4px; display: flex; align-items: center;
        justify-content: center; flex-shrink: 0; background: white;
        transition: background 0.15s; cursor: pointer;
      }
      .lms-diff-underline-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: transparent; border: none;
        border-bottom: 1.5px solid var(--lms-border); border-radius: 0;
        padding: 4px 20px 4px 0; font-size: 13px; font-weight: 600;
        font-family: var(--lms-font); color: var(--lms-text-hint);
        cursor: pointer; outline: none; position: relative;
        transition: border-color 0.15s;
      }
      .lms-diff-underline-btn:hover { border-bottom-color: var(--lms-border-hover); }
      .lms-diff-underline-btn.has-value { color: var(--lms-text-main); }
      .lms-diff-underline-btn .diff-chevron {
        position: absolute; right: 0; top: 50%;
        transform: translateY(-50%); color: var(--lms-text-hint);
        width: 13px; height: 13px;
      }
      .lms-diff-dropdown {
        position: absolute; top: calc(100% + 6px); right: 0; z-index: 200;
        background: var(--lms-bg-white); border: 1.5px solid var(--lms-border);
        border-radius: var(--lms-radius-md); box-shadow: var(--lms-shadow-md);
        min-width: 140px; overflow: hidden; padding: 4px 0;
      }
      .lms-diff-dropdown-item {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 14px; font-size: 13px; font-weight: 500;
        font-family: var(--lms-font); cursor: pointer; color: var(--lms-text-main);
        transition: background 0.1s;
      }
      .lms-diff-dropdown-item:hover { background: var(--lms-bg-surface); }
      .lms-score-wrap {
        display: inline-flex; align-items: baseline; gap: 4px;
        border-bottom: 1.5px solid var(--lms-border); padding: 4px 0;
        transition: border-color 0.15s;
      }
      .lms-score-wrap:focus-within { border-bottom-color: var(--lms-orange); }
      .lms-score-wrap.score-err { border-bottom-color: var(--lms-danger); }
      .lms-score-input {
        width: 44px; background: transparent; border: none; outline: none;
        font-size: 13px; font-weight: 600; color: var(--lms-text-main);
        font-family: var(--lms-font); text-align: right;
        -moz-appearance: textfield; line-height: 1; padding: 0; margin: 0;
      }
      .lms-score-input::placeholder { color: var(--lms-text-hint); font-weight: 400; }
      .lms-score-input.score-err { color: var(--lms-danger); }
      .lms-score-label { font-size: 13px; color: var(--lms-text-sec); font-family: var(--lms-font); white-space: nowrap; line-height: 1; }
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
      .lms-btn-ai {
        background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
        color: white; border-color: transparent;
        box-shadow: 0 2px 8px rgba(124,58,237,0.25);
      }
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
      .lms-icon-btn-violet { border-color: var(--lms-violet-bdr); background: var(--lms-violet-bg); color: var(--lms-violet); }
      .lms-icon-btn-violet:hover { background: #ede9fe; }
      .lms-icon-btn-slate { border-color: var(--lms-border); background: var(--lms-bg-surface); color: var(--lms-text-muted); }
      .lms-icon-btn-red { border-color: var(--lms-danger-bdr); background: var(--lms-danger-bg); color: var(--lms-danger); }
      .lms-nav-btn {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 7px 14px; border-radius: var(--lms-radius-md);
        font-family: var(--lms-font); font-size: 12.5px; font-weight: 600;
        border: 1.5px solid var(--lms-border); background: var(--lms-bg-white);
        color: var(--lms-text-sec); cursor: pointer; transition: all 0.15s;
      }
      .lms-nav-btn:hover:not(:disabled) { background: var(--lms-bg-surface); border-color: var(--lms-border-hover); }
      .lms-nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
      .lms-save-btn {
        flex: 1; padding: 8px 0; border-radius: var(--lms-radius-md);
        border: none; background: var(--lms-orange); color: white;
        font-family: var(--lms-font); font-size: 12.5px; font-weight: 700;
        cursor: pointer; transition: all 0.15s;
        box-shadow: 0 2px 8px var(--lms-orange-glow);
        display: flex; align-items: center; justify-content: center; gap: 6px;
      }
      .lms-save-btn:hover:not(:disabled) { background: var(--lms-orange-dark); }
      .lms-ak-option-btn {
        width: 100%; display: flex; align-items: center; gap: 10px;
        padding: 9px 12px; border-radius: var(--lms-radius-md);
        text-align: left; transition: all 0.12s; font-size: 13.5px;
        font-family: var(--lms-font); font-weight: 500; cursor: pointer;
        border: 1.5px solid;
      }
      .lms-ak-option-btn.correct {
        background: var(--lms-success-bg); border-color: var(--lms-success-bdr); color: #14532d;
      }
      .lms-ak-option-btn.neutral {
        background: var(--lms-bg-white); border-color: var(--lms-border); color: var(--lms-text-main);
      }
      .lms-ak-done-btn {
        padding: 8px 22px; border-radius: var(--lms-radius-md);
        background: var(--lms-success); color: white; border: none;
        font-family: var(--lms-font); font-size: 13.5px; font-weight: 600;
        cursor: pointer; transition: background 0.15s;
      }
      .lms-section-label {
        font-size: 10.5px; font-weight: 700; color: var(--lms-text-hint);
        text-transform: uppercase; letter-spacing: 0.07em;
        font-family: var(--lms-font); margin-bottom: 8px;
      }
      .lms-header-logo-mark {
        width: 34px; height: 34px; background: var(--lms-orange);
        border-radius: 9px; display: flex; align-items: center;
        justify-content: center; flex-shrink: 0;
        box-shadow: 0 3px 10px var(--lms-orange-glow);
      }
      .lms-breadcrumb-sep { color: var(--lms-orange); margin: 0 3px; font-weight: 700; font-size: 13px; }
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
      .lms-toggle-track {
        position: relative; display: inline-block;
        width: 30px; height: 17px; flex-shrink: 0;
      }
      .lms-toggle-track input { opacity: 0; width: 0; height: 0; }
      .lms-toggle-slider {
        position: absolute; inset: 0;
        background: var(--lms-border-hover); border-radius: 17px;
        transition: background 0.2s; cursor: pointer;
      }
      .lms-toggle-slider::before {
        content: ''; position: absolute;
        width: 13px; height: 13px; border-radius: 50%; background: white;
        left: 2px; top: 2px; transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      }
      .lms-toggle-track input:checked + .lms-toggle-slider { background: var(--lms-orange); }
      .lms-toggle-track input:checked + .lms-toggle-slider::before { transform: translateX(13px); }
      .lms-fmt-btn {
        padding: 5px; border: none; background: none; cursor: pointer;
        color: var(--lms-text-muted); border-radius: 7px; transition: all 0.12s;
        display: flex; align-items: center; justify-content: center;
      }
      .lms-fmt-btn:hover { background: var(--lms-bg-surface2); color: var(--lms-text-main); }
      .lms-fmt-btn.active { background: var(--lms-orange-100); color: #c85a30; }
      input[type="checkbox"] { accent-color: var(--lms-orange); }
      input[type="number"]::-webkit-inner-spin-button,
      input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--lms-border); border-radius: 4px; }
      .lms-tooltip-wrap { position: relative; }
      .lms-tooltip {
        position: absolute; bottom: calc(100% + 8px); left: 50%;
        transform: translateX(-50%);
        background: #1a1a2e; color: white; font-size: 11px; font-weight: 500;
        font-family: var(--lms-font); padding: 5px 10px; border-radius: 7px;
        white-space: nowrap; pointer-events: none;
        opacity: 0; transition: opacity 0.15s; z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
      .lms-tooltip::after {
        content: ''; position: absolute; top: 100%; left: 50%;
        transform: translateX(-50%);
        border: 4px solid transparent; border-top-color: #1a1a2e;
      }
      .lms-tooltip-wrap:hover .lms-tooltip { opacity: 1; }
      .lms-tooltip-right {
        left: auto; right: 0; transform: none;
      }
      .lms-preview-card {
        background: var(--lms-bg-white); border: 1.5px solid var(--lms-border);
        border-radius: var(--lms-radius-md); overflow: hidden;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .lms-preview-card.active {
        border-color: var(--lms-orange); box-shadow: 0 0 0 3px var(--lms-orange-light);
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
      .lms-modal-actions { display: flex; gap: 8px; padding-top: 12px; }
      @keyframes lms-slide-in-right {
        from { transform: translateX(110%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
      @keyframes lms-fade-in {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
        .animate-fade-in {
  animation: lms-fade-in 0.2s ease-out forwards;
}
    `;
    document.head.appendChild(style);
  };
})();


// ─── CONTENT BLOCK TYPES ─────────────────────────────────────────────────────
type ContentBlockType = 'text' | 'code' | 'image';
interface ContentBlock {
  id: string;
  type: ContentBlockType;
  value?: string;
  url?: string;
  bgColor?: string;
  language?: string;
  alignment?: 'left' | 'center' | 'right';
  sizePercent?: number;
}

const CODE_BG_COLORS = [
  { label: 'Dark', value: '#1e1e1e', dark: true },
  { label: 'Light', value: '#f6f8fa', dark: false },
  { label: 'Monokai', value: '#272822', dark: true },
  { label: 'Dracula', value: '#282a36', dark: true },
  { label: 'Solarized', value: '#fdf6e3', dark: false },
  { label: 'Nord', value: '#2e3440', dark: true },
];

function highlightAuto(code: string, bgColor: string): string {
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
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(\/\/.*$)/gm, `<span style="color:${cmtC}">$1</span>`)
    .replace(/(\/\*[\s\S]*?\*\/)/g, `<span style="color:${cmtC}">$1</span>`)
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, `<span style="color:${strC}">$1</span>`)
    .replace(/\b(\d+\.?\d*)\b/g, `<span style="color:${numC}">$1</span>`)
    .replace(
      new RegExp(`\\b(${kw.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g'),
      `<span style="color:${kwC};font-weight:600">$1</span>`
    );
}

// ─── TYPES ────────────────────────────────────────────────────────────────────
type QuestionType =
  | '' | 'multiple-choice' | 'multiple-select' | 'true-false'
  | 'short-answer' | 'paragraph' | 'matching' | 'ordering' | 'numeric' | 'dropdown';

interface MCQOption {
  id: string; text: string; isCorrect: boolean;
  imageUrl?: string; imageAlignment?: 'left' | 'center' | 'right'; imageSizePercent?: number;
}
interface MatchingPair { id: string; left: string; right: string; }
interface OrderingItem { id: string; text: string; order: number; }

interface QuestionBlock {
  id: string;
  type: QuestionType;
  questionText: string;
  questionContent?: ContentBlock[];
  questionImageUrl?: string;
  questionImageAlignment?: 'left' | 'center' | 'right';
  questionImageSizePercent?: number;
  optionsPerRow?: 1 | 2 | 3 | 4;
  options: MCQOption[];
  matchingPairs?: MatchingPair[];
  orderingItems?: OrderingItem[];
  trueFalseAnswer?: boolean | null;
  shortAnswer?: string;
  numericAnswer?: number | null;
  numericTolerance?: number | null;
  isRequired: boolean;
  hasOtherOption?: boolean;
  hasExplanation?: boolean;
  explanation?: string;
  title?: string;
  description?: string;
  score?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | '';
  timeLimit?: number;
  memoryLimit?: number;
  isActive?: boolean;
  sequence?: number;
  origin?: string;
  dbId?: string;
  isDirty?: boolean;
}

interface TestRecord {
  id: string;
  itemKey: string;
  name: string;
  type: string;
  duration: number;
  totalMarks: number;
  questions: number;
  level: string;
  status: string;
  startDate: string;
  endDate?: string;
  attempts: number;
  bestScore: number | null;
  createdAt: string;
}

interface CreateTestModalProps {
  breadcrumbs: any[];
  onClose: () => void;
  onSave: (questions: QuestionBlock[]) => void;
  initialQuestions?: QuestionBlock[];
  testName?: string;
  testDescription?: string;
  defaultTopic?: string;
  nodeId: string;
  nodeType: string;
  editingTest?: TestRecord | null;
  isLoading?: boolean;
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const diffConfig = {
  '': { label: 'Difficulty', dot: '#bcbccc', color: 'var(--lms-text-hint)', border: 'var(--lms-border)' },
  easy: { label: 'Easy', dot: '#16a34a', color: '#16a34a', border: '#bbf7d0' },
  medium: { label: 'Medium', dot: '#d97706', color: '#d97706', border: '#fde68a' },
  hard: { label: 'Hard', dot: '#e53e3e', color: '#e53e3e', border: '#fed7d7' },
};

const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'multiple-choice': { label: 'Multiple Choice', icon: <List className="h-3.5 w-3.5" />, color: '#7c3aed' },
  'multiple-select': { label: 'Multiple Select', icon: <CheckSquare className="h-3.5 w-3.5" />, color: '#F97316' },
  'true-false': { label: 'True / False', icon: <ToggleLeft className="h-3.5 w-3.5" />, color: '#0d9488' },
  'short-answer': { label: 'Short Answer', icon: <AlignLeft className="h-3.5 w-3.5" />, color: '#ea580c' },
  paragraph: { label: 'Essay', icon: <BookOpen className="h-3.5 w-3.5" />, color: '#db2777' },
  matching: { label: 'Matching', icon: <Equal className="h-3.5 w-3.5" />, color: '#4f46e5' },
  ordering: { label: 'Ordering / Sequence', icon: <MoveVertical className="h-3.5 w-3.5" />, color: '#0891b2' },
  numeric: { label: 'Numeric', icon: <Binary className="h-3.5 w-3.5" />, color: '#e11d48' },
  dropdown: { label: 'Dropdown', icon: <ChevronDownIcon className="h-3.5 w-3.5" />, color: '#374151' },
};

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
const QuestionFormBreadcrumb: React.FC<{
  breadcrumbs: any[]; actionLabel: string; questionLabel: string;
}> = ({ breadcrumbs, actionLabel, questionLabel }) => {
  const courseName = breadcrumbs?.[0]?.name;
  const exerciseName = breadcrumbs && breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 1]?.name : '';
  return (
    <nav className="flex items-center" style={{ fontFamily: 'var(--lms-font)' }}>
      <ol className="flex items-center flex-wrap gap-y-0.5">
        {courseName && (
          <><li><span className="text-[12.5px] font-semibold" style={{ color: 'var(--lms-text-sec)' }}>{courseName}</span></li>
            <li><span className="lms-breadcrumb-sep">»</span></li></>
        )}
        {exerciseName && exerciseName !== courseName && (
          <><li><span className="text-[12.5px] font-semibold truncate max-w-[140px]" style={{ color: 'var(--lms-text-main)' }}>{exerciseName}</span></li>
            <li><span className="lms-breadcrumb-sep">»</span></li></>
        )}
        <li>
          <span className="text-[12.5px] font-bold" style={{ color: 'var(--lms-text-main)' }}>
            {actionLabel}
            {questionLabel && <span className="ml-1.5 font-normal" style={{ color: 'var(--lms-text-muted)' }}>· {questionLabel}</span>}
          </span>
        </li>
      </ol>
    </nav>
  );
};

// ─── RICH TEXT EDITOR COMPONENT ──────────────────────────────────────────────
const RichTextEditor: React.FC<{
  value: string; onChange: (v: string) => void; placeholder?: string;
  className?: string; compact?: boolean;
}> = ({ value, onChange, placeholder, className = '', compact = false }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(!value || value === '<br>' || value === '<p><br></p>');

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== (value || ''))
      editorRef.current.innerHTML = value || '';
    setIsEmpty(!value || value === '<br>' || value === '<div><br></div>' || value === '<p></p>' || value === '<p><br></p>');
  }, [value]);

  const execCommand = (cmd: string) => {
    document.execCommand(cmd, false);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  };

  return (
    <div className={`group ${className}`}>
      <div className={`flex items-center gap-0.5 ${compact ? 'mb-1' : 'mb-2'}`}>
        {(['bold', 'italic', 'underline'] as const).map((cmd, i) => {
          const icons = [<Bold className="h-3 w-3" />, <Italic className="h-3 w-3" />, <Underline className="h-3 w-3" />];
          return (
            <button key={cmd} type="button" onMouseDown={e => { e.preventDefault(); execCommand(cmd); }}
              className="lms-fmt-btn">{icons[i]}</button>
          );
        })}
      </div>
      <div className="relative">
        <div ref={editorRef} contentEditable suppressContentEditableWarning
          onInput={e => {
            const content = e.currentTarget.innerHTML;
            onChange(content);
            setIsEmpty(!content || content === '<br>');
          }}
          className="focus:outline-none leading-relaxed min-h-[36px] pb-1.5 transition-colors [&_strong]:font-bold [&_em]:italic [&_u]:underline"
          style={{
            fontSize: 13.5, fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)', fontWeight: 400,
            borderBottom: '1.5px solid var(--lms-border)'
          }}
        />
        {isEmpty && placeholder && (
          <div className="absolute top-0 left-0 pointer-events-none select-none text-sm"
            style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>{placeholder}</div>
        )}
      </div>
    </div>
  );
};

// ─── IMAGE UPLOAD MODAL ───────────────────────────────────────────────────────
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
      const res = await fetch(`${API_BASE_URL}/upload/question-image`, {
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
    if (!/^https?:\/\/.+/i.test(trimmed)) { setUrlError('The URL is not valid. Make sure it starts with http:// or https://.'); return; }
    setUrlError('');
    onUpload(trimmed);
  };

  const TAB_STYLE = (active: boolean): React.CSSProperties => ({
    fontFamily: 'var(--lms-font)',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? 'var(--lms-orange)' : 'var(--lms-text-sec)',
    borderBottom: active ? '2px solid var(--lms-orange)' : '2px solid transparent',
    paddingBottom: 10,
    paddingTop: 10,
    paddingLeft: 4,
    paddingRight: 4,
    background: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
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
          <button type="button" style={TAB_STYLE(tab === 'upload')} onClick={() => { setTab('upload'); setError(''); }}>
            Upload
          </button>
          <button type="button" style={TAB_STYLE(tab === 'url')} onClick={() => { setTab('url'); setUrlError(''); }}>
            By URL
          </button>
        </div>
        <div className="p-5">
          {tab === 'upload' ? (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className="flex flex-col items-center justify-center gap-3 rounded-xl py-9 transition-all"
                style={{
                  border: `2px dashed ${dragging ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                  background: dragging ? 'var(--lms-orange-light)' : 'var(--lms-bg-surface)',
                }}>
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
                <input
                  type="text"
                  value={urlValue}
                  onChange={e => { setUrlValue(e.target.value); if (urlError) setUrlError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleInsertUrl(); }}
                  placeholder="Paste URL of image..."
                  autoFocus
                  className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-all"
                  style={{
                    borderColor: urlError ? 'var(--lms-danger)' : 'var(--lms-border)',
                    fontFamily: 'var(--lms-font)',
                    color: 'var(--lms-text-main)',
                  }}
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

// ─── CONTENT EDITABLE BLOCK (KEY FIX: mount-only innerHTML, no re-render conflicts) ──
const ContentEditableBlock: React.FC<{
  blockId: string;
  cbId: string;
  initialValue: string;
  isFirst: boolean;
  showError: boolean;
  arrLength: number;
  onInput: (blockId: string, cbId: string, val: string) => void;
  onRemove: (blockId: string, cbId: string) => void;
  onUpdateFormats: () => void;
}> = ({ blockId, cbId, initialValue, isFirst, showError, arrLength, onInput, onRemove, onUpdateFormats }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [localEmpty, setLocalEmpty] = useState(!initialValue || !initialValue.replace(/<[^>]*>/g, '').trim());

  // ✅ THE KEY FIX: Set innerHTML ONLY on mount — never update it from React state.
  // This prevents the cursor-jump / reversed-text bug caused by React re-rendering
  // the contentEditable DOM and resetting cursor position to the start.
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = initialValue || '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty deps array: runs ONCE on mount only

  return (
    <div className="relative group/cb mb-1">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onKeyUp={onUpdateFormats}
        onMouseUp={onUpdateFormats}
        onInput={e => {
          let val = e.currentTarget.innerHTML;
          if (val === '<br>' || val === '<div><br></div>' || val === '<p><br></p>' || val === '') {
            val = '';
          } else {
            if (val.startsWith('<p>') && val.endsWith('</p>') && !val.includes('<p>', 1)) {
              val = val.slice(3, -4);
            }
            val = val.replace(/<div>/g, '<br>').replace(/<\/div>/g, '');
            val = val.replace(/<\/?p>/g, '');
          }
          const hasText = val.replace(/<[^>]*>/g, '').trim().length > 0;
          setLocalEmpty(!hasText);
          onInput(blockId, cbId, val);
        }}
        onBlur={e => {
          let val = e.currentTarget.innerHTML;
          if (val === '<br>' || val === '<div><br></div>' || val === '<p><br></p>') {
            e.currentTarget.innerHTML = '';
          }
        }}
        className="lms-q-text-editor focus:outline-none leading-relaxed pb-1.5 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
        style={{
          borderBottom: showError ? '2px solid var(--lms-danger)' : '2px solid var(--lms-border)',
          minHeight: 38,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      />
      {localEmpty && (
        <div
          className="absolute top-0 left-0 pointer-events-none select-none text-[15px]"
          style={{ color: showError ? '#fca5a5' : 'var(--lms-text-hint)' }}
        >
          {showError
            ? 'Question text is required…'
            : isFirst
            ? 'Type your question here…'
            : 'Continue typing…'}
        </div>
      )}
      {arrLength > 1 && (
        <button
          onClick={() => onRemove(blockId, cbId)}
          className="absolute top-0 right-0 p-1 rounded opacity-0 group-hover/cb:opacity-100 transition-opacity text-gray-400"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const CreateTestModal: React.FC<CreateTestModalProps> = ({
  breadcrumbs,
  onClose,
  onSave,
  initialQuestions = [],
  testName = '',
  testDescription = '',
  defaultTopic = '',
  nodeId,
  nodeType,
  editingTest,
  isLoading: isLoadingProp = false,
}) => {
  injectFonts();

  const { toasts, remove, success, error, warning, info } = useToast();

  const [imgModal, setImgModal] = useState<{ onUpload: (url: string) => void } | null>(null);
  const [showMockModal, setShowMockModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [showDifficultyMenu, setShowDifficultyMenu] = useState(false);
  const [showQTypeMenu, setShowQTypeMenu] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(isLoadingProp);
  const [activeImageToolbar, setActiveImageToolbar] = useState<
    | { type: 'question'; blockId: string; cbId?: string }
    | { type: 'option'; blockId: string; optionId: string }
    | null
  >(null);
  const [errors, setErrors] = useState<{ blocks?: { [k: string]: any } }>({});
  const [deleteTarget, setDeleteTarget] = useState<{ blockIdx: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [questionTextEmpty, setQuestionTextEmpty] = useState<{ [id: string]: boolean }>({});
  const [answerKeyOpenBlockId, setAnswerKeyOpenBlockId] = useState<string | null>(null);
  const [emptyOptWarnings, setEmptyOptWarnings] = useState<{ [blockId: string]: Set<string> }>({});
  const [validationAttempted, setValidationAttempted] = useState<Set<string>>(new Set());
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());

  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const makeDefaultBlock = (id: string, sequence: number = 0): QuestionBlock => ({
    id,
    type: 'multiple-choice',
    questionText: '',
    questionContent: [{ id: `${id}-txt-1`, type: 'text' as const, value: '' }],
    questionImageUrl: '', questionImageAlignment: 'center', questionImageSizePercent: 60,
    optionsPerRow: 1,
    options: [
      { id: `${id}-opt-1`, text: '', isCorrect: false, imageAlignment: 'center', imageSizePercent: 60 },
      { id: `${id}-opt-2`, text: '', isCorrect: false, imageAlignment: 'center', imageSizePercent: 60 },
    ],
    matchingPairs: [{ id: `${id}-pair-1`, left: '', right: '' }, { id: `${id}-pair-2`, left: '', right: '' }],
    orderingItems: [{ id: `${id}-ord-1`, text: '', order: 1 }, { id: `${id}-ord-2`, text: '', order: 2 }],
    trueFalseAnswer: null, shortAnswer: '', numericAnswer: null, numericTolerance: null,
    isRequired: false, hasOtherOption: false, hasExplanation: false, explanation: '',
    score: 0, difficulty: '', timeLimit: 2000, memoryLimit: 256, isActive: true, sequence,
    origin: 'new',
  });

  const [questionBlocks, setQuestionBlocks] = useState<QuestionBlock[]>(() => {
    if (initialQuestions.length > 0) return initialQuestions;
    return [makeDefaultBlock(generateId('block'), 0)];
  });

  useEffect(() => {
    if (initialQuestions.length > 0) {
      setQuestionBlocks(initialQuestions);
      setCurrentIndex(0);
    }
  }, [initialQuestions]);

  useEffect(() => {
    if (initialQuestions.length > 0) {
      setQuestionBlocks(initialQuestions);
      setCurrentIndex(0);
      return;
    }

    const initializeFromEditingTest = async () => {
      if (editingTest && nodeId) {
        setIsLoading(true);
        try {
          const entityType = getEntityTypeFromNodeType(nodeType);
          const response = await youDoMcqApi.getAllQuestions(entityType, nodeId);
          const questionsData = response.data || [];

          if (questionsData.length > 0) {
            const mapType = (type: string): any => {
              const m: Record<string, any> = {
                multiple_choice: 'multiple-choice', multiple_select: 'multiple-select',
                true_false: 'true-false', short_answer: 'short-answer', essay: 'paragraph',
                matching: 'matching', ordering: 'ordering', numeric: 'numeric', dropdown: 'dropdown'
              };
              return m[type] || 'multiple-choice';
            };

         // In the initializeFromEditingTest function, update the mapping for essay questions:
const blocks = questionsData.map((q: any, idx: number) => {
  const id = generateId('block');
  let questionContent = [];
  if (q.mcqQuestionTitle) {
    if (typeof q.mcqQuestionTitle === 'string') {
      questionContent = [{ id: `${id}-txt`, type: 'text', value: q.mcqQuestionTitle }];
    } else if (Array.isArray(q.mcqQuestionTitle)) {
      questionContent = q.mcqQuestionTitle;
    }
  }
  
  // Extract shortAnswer/essay answer from correctAnswers if available
  let shortAnswerValue = '';
  if (q.mcqQuestionCorrectAnswers && q.mcqQuestionCorrectAnswers.length > 0) {
    // For essay questions, the first item in correctAnswers is the sample answer/rubric
    if (q.mcqQuestionType === 'essay' || q.mcqQuestionType === 'short_answer') {
      shortAnswerValue = q.mcqQuestionCorrectAnswers[0];
    }
  }
  
  const options = (q.mcqQuestionOptions || []).map((opt: any, oi: number) => ({
    id: `${id}-opt-${oi}`, text: opt.text || '', isCorrect: opt.isCorrect || false,
    imageUrl: opt.imageUrl || '', imageAlignment: opt.imageAlignment || 'center',
    imageSizePercent: opt.imageSizePercent || 60,
  }));
  
  return {
    id, origin: 'db', dbId: q._id, type: mapType(q.mcqQuestionType),
    questionText: q.mcqQuestionTitle, title: q.mcqQuestionTitle || 'Untitled Question',
    questionContent, options, score: q.mcqQuestionScore || 0,
    difficulty: q.mcqQuestionDifficulty || 'medium',
    hasExplanation: !!(q.explanation || q.mcqQuestionDescription),
    explanation: q.explanation || q.mcqQuestionDescription || '',
    isRequired: q.mcqQuestionRequired || false, hasOtherOption: q.hasOtherOption || false,
    optionsPerRow: q.mcqQuestionOptionsPerRow || 1,
    questionImageUrl: q.mcqQuestionImageUrl || '',
    questionImageAlignment: q.mcqQuestionImageAlignment || 'center',
    questionImageSizePercent: q.mcqQuestionImageSizePercent || 60,
    trueFalseAnswer: q.trueFalseAnswer ?? null, 
    shortAnswer: shortAnswerValue || q.shortAnswer || '', // Use value from correctAnswers if available
    numericAnswer: q.numericAnswer ?? null, numericTolerance: q.numericTolerance ?? null,
    matchingPairs: (q.matchingPairs || []).map((p: any, pi: number) => ({ id: `${id}-pair-${pi}`, left: p.left || '', right: p.right || '' })),
    orderingItems: (q.orderingItems || []).map((item: any, oi: number) => ({ id: `${id}-ord-${oi}`, text: item.text || '', order: item.order || oi + 1 })),
    isActive: true, sequence: idx, isDirty: false,
  };
});
            setQuestionBlocks(blocks);
            setCurrentIndex(0);
          } else {
            setQuestionBlocks([makeDefaultBlock(generateId('block'), 0)]);
          }
        } catch (err) {
          console.error('Failed to load editing test:', err);
          error('Failed to load test', 'Could not load existing questions.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    if (editingTest?.itemKey && initialQuestions.length === 0) {
      initializeFromEditingTest();
    }
  }, [editingTest?.itemKey, nodeId, nodeType, initialQuestions.length]);

  const updateBlock = useCallback((id: string, patch: Partial<QuestionBlock>) =>
    setQuestionBlocks(bs => bs.map(b => b.id === id ? { ...b, ...patch, isDirty: true } : b)), []);

  const updateOption = useCallback((bid: string, oid: string, patch: Partial<MCQOption>) =>
    setQuestionBlocks(bs => bs.map(b => b.id === bid
      ? { ...b, options: b.options.map(o => o.id === oid ? { ...o, ...patch } : o) } : b)), []);

  const clearBlockError = (blockId: string, field: string) => {
    setErrors(prev => {
      const be = { ...(prev.blocks?.[blockId] || {}) };
      delete be[field];
      return { blocks: { ...prev.blocks, [blockId]: be } };
    });
  };

  const goToIndex = (idx: number) => {
    if (idx >= 0 && idx < questionBlocks.length) {
      setCurrentIndex(idx);
      mainScrollRef.current?.scrollTo({ top: 0 });
    }
  };

  const isExplanationValid = (b: QuestionBlock) => !b.hasExplanation || !!(b.explanation?.replace(/<[^>]*>/g, '').trim());

const isBlockComplete = (b: QuestionBlock): boolean => {
  const hasText = b.questionContent
    ? b.questionContent.filter(cb => cb.type === 'text').some(cb => (cb.value || '').replace(/<[^>]*>/g, '').trim().length > 0)
    : b.questionText.replace(/<[^>]*>/g, '').trim().length > 0;
  if (!hasText || !b.type || !b.difficulty) return false;
  
  if (['multiple-choice', 'multiple-select', 'dropdown'].includes(b.type)) {
    if (b.options.filter(o => o.text.trim()).length < 2) return false;
    if (!b.options.some(o => o.isCorrect)) return false;
  }
  if (b.type === 'true-false' && b.trueFalseAnswer === null) return false;
  if (b.type === 'matching' && !b.matchingPairs?.every(p => p.left.trim() && p.right.trim())) return false;
  if (b.type === 'ordering' && !b.orderingItems?.every(item => item.text.trim())) return false;
  if (b.type === 'numeric' && b.numericAnswer === null) return false;
  

  
  if (!isExplanationValid(b)) return false;
  return true;
};

  const validateSingleBlock = (b: QuestionBlock): boolean => {
    const be: any = {};
    const _hasText = b.questionContent
      ? b.questionContent.filter(cb => cb.type === 'text').some(cb => (cb.value || '').replace(/<[^>]*>/g, '').trim().length > 0)
      : b.questionText.replace(/<[^>]*>/g, '').trim().length > 0;
    if (!_hasText) be.questionText = 'Question text is required';
    if (!b.type) be.type = 'Select a question type';
    if (!b.difficulty) be.difficulty = 'Select a difficulty level';
    if (['multiple-choice', 'multiple-select', 'dropdown'].includes(b.type)) {
      if (b.options.filter(o => o.text.trim()).length < 2) be.options = 'At least 2 options required';
      if (!b.options.some(o => o.isCorrect)) be.correctAnswer = 'Mark at least one correct answer';
    }
    if (b.type === 'true-false' && b.trueFalseAnswer === null) be.trueFalse = 'Select True or False';
    if (b.type === 'matching' && !b.matchingPairs?.every(p => p.left.trim() && p.right.trim())) be.matching = 'Fill all matching pairs';
    if (b.type === 'ordering' && !b.orderingItems?.every(i => i.text.trim())) be.ordering = 'Fill all ordering items';
    if (b.type === 'numeric' && b.numericAnswer === null) be.numeric = 'Enter a numeric answer';
    if (b.hasExplanation && !b.explanation?.replace(/<[^>]*>/g, '').trim()) be.explanation = 'Explanation is required when enabled';
    if (Object.keys(be).length > 0) { setErrors(prev => ({ blocks: { ...prev.blocks, [b.id]: be } })); return false; }
    setErrors(prev => { const nb = { ...(prev.blocks || {}) }; delete nb[b.id]; return { blocks: nb }; });
    return true;
  };

  const triggerValidationForBlock = (block: QuestionBlock) => {
    setValidationAttempted(prev => { const s = new Set(prev); s.add(block.id); return s; });
    markEmptyOptionsForBlock(block.id);
    return validateSingleBlock(block);
  };

  const getValidQuestionsCount = useCallback(() => questionBlocks.filter(b => isBlockComplete(b)).length, [questionBlocks]);
  const isPreviewEnabled = useCallback(() => getValidQuestionsCount() > 0, [getValidQuestionsCount]);
  const isMockTestEnabled = useCallback(() => questionBlocks.length > 0 && questionBlocks.every(b => isBlockComplete(b)), [questionBlocks]);

  const addQuestionBlock = () => {
    if (currentBlock && !isBlockComplete(currentBlock)) {
      const completeCount = getValidQuestionsCount();
      warning('Cannot Add Question', `Please complete the current question first. ${completeCount} of ${questionBlocks.length} questions are complete.`);
      return;
    }
    const id = generateId('block');
    setQuestionBlocks(bs => {
      const newBlock = { ...makeDefaultBlock(id, bs.length), origin: 'new', isDirty: false };
      setCurrentIndex(bs.length);
      return [...bs, newBlock];
    });
    success('Question Added', 'New question block has been added');
    setTimeout(() => mainScrollRef.current?.scrollTo({ top: 0 }), 50);
  };

  const handlePrevQuestion = () => {
    if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); mainScrollRef.current?.scrollTo({ top: 0 }); }
  };

  const handleNextQuestion = () => {
    if (!currentBlock) return;
    const valid = triggerValidationForBlock(currentBlock);
    if (!valid) { warning('Validation Failed', 'Please fill in all required fields before proceeding'); return; }
    goToIndex(currentIndex + 1);
  };

  const markEmptyOptionsForBlock = (blockId: string) => {
    const block = questionBlocks.find(b => b.id === blockId);
    if (!block || !['multiple-choice', 'multiple-select', 'dropdown'].includes(block.type)) return;
    const emptyIds = new Set(block.options.filter(o => !o.text.trim()).map(o => o.id));
    if (emptyIds.size === 0) return;
    setEmptyOptWarnings(prev => ({ ...prev, [blockId]: new Set([...(prev[blockId] || []), ...emptyIds]) }));
  };

  const clearOptWarning = (blockId: string, optId: string) => {
    setEmptyOptWarnings(prev => {
      if (!prev[blockId]) return prev;
      const updated = new Set(prev[blockId]);
      updated.delete(optId);
      return { ...prev, [blockId]: updated };
    });
  };

  const duplicateQuestionBlock = () => {
    if (!currentBlock || !isBlockComplete(currentBlock)) {
      warning('Cannot Duplicate', 'Please complete the question before duplicating'); return;
    }
    const id = generateId('block');
    const duplicate: QuestionBlock = { ...currentBlock, id, sequence: questionBlocks.length, origin: 'new', isDirty: false, dbId: undefined };
    setQuestionBlocks(bs => [...bs, duplicate]);
    setCurrentIndex(questionBlocks.length);
    success('Question Duplicated', 'A copy has been added to your test');
    setTimeout(() => mainScrollRef.current?.scrollTo({ top: 0 }), 50);
  };

  const requestDelete = (idx: number) => setDeleteTarget({ blockIdx: idx });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const targetIdx = deleteTarget.blockIdx;
    const block = questionBlocks[targetIdx];
    if (!block) { setDeleteTarget(null); return; }
    setIsDeleting(true);
    try {
      if (block.origin === 'db' && block.dbId) {
        const entityType = getEntityTypeFromNodeType(nodeType);
        await youDoMcqApi.deleteQuestion(entityType, nodeId, "test_your_skills", block.dbId);
        success('Question deleted successfully!', 'The question has been removed from the database.');
      }
      setQuestionBlocks(prev => {
        const updated = prev.filter((_, i) => i !== targetIdx);
        const safe = updated.length > 0 ? updated : [makeDefaultBlock(generateId('block'), 0)];
        setTimeout(() => setCurrentIndex((ci: number) => Math.min(ci, Math.max(0, safe.length - 1))), 0);
        return safe;
      });
    } catch (err: any) {
      error('Delete Failed', err.message || 'Could not delete the question. Please try again.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteFromPreview = async (block: QuestionBlock, idx: number) => {
    setIsDeleting(true);
    try {
      if (block.origin === 'db' && block.dbId) {
        const entityType = getEntityTypeFromNodeType(nodeType);
        await youDoMcqApi.deleteQuestion(entityType, nodeId, "test_your_skills", block.dbId);
        success('Question deleted successfully!', 'The question has been removed from the database.');
      }
      setQuestionBlocks(prev => {
        const updated = prev.filter(b => b.id !== block.id);
        const safe = updated.length > 0 ? updated : [makeDefaultBlock(generateId('block'), 0)];
        setCurrentIndex((ci: number) => Math.min(ci, Math.max(0, safe.length - 1)));
        return safe;
      });
    } catch (err: any) {
      error('Delete Failed', err.message || 'Could not delete the question.');
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePreviewClick = useCallback(() => {
    if (!isPreviewEnabled()) {
      warning('No Complete Questions', `Please complete at least one question to preview. ${getValidQuestionsCount()} of ${questionBlocks.length} questions are ready.`);
      return;
    }
    setShowPreviewModal(true);
  }, [isPreviewEnabled, questionBlocks.length, getValidQuestionsCount]);

  const handleMockTestClick = useCallback(() => {
    if (!isMockTestEnabled()) {
      const completed = getValidQuestionsCount();
      warning('Incomplete Test', `${completed} of ${questionBlocks.length} questions are complete. Please complete all questions before taking the mock test.`);
      return;
    }
    setShowMockModal(true);
  }, [isMockTestEnabled, questionBlocks.length, getValidQuestionsCount]);

  const addOption = (bid: string) => setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
    ...b, options: [...b.options, { id: generateId(`opt-${bid}`), text: '', isCorrect: false, imageAlignment: 'center' as const, imageSizePercent: 60 }]
  } : b));

  const setCorrectAnswer = (bid: string, oid: string) => {
    setQuestionBlocks(bs => bs.map(b => b.id === bid ? { ...b, options: b.options.map(o => ({ ...o, isCorrect: o.id === oid })) } : b));
    clearBlockError(bid, 'correctAnswer');
  };

  const toggleCorrectAnswer = (bid: string, oid: string) => {
    setQuestionBlocks(bs => bs.map(b => b.id === bid ? { ...b, options: b.options.map(o => o.id === oid ? { ...o, isCorrect: !o.isCorrect } : o) } : b));
    clearBlockError(bid, 'correctAnswer');
  };

  const removeOption = (bid: string, oid: string) => setQuestionBlocks(bs => bs.map(b =>
    b.id === bid && b.options.length > 2 ? { ...b, options: b.options.filter(o => o.id !== oid) } : b));

  const addMatchingPair = (bid: string) => setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
    ...b, matchingPairs: [...(b.matchingPairs || []), { id: generateId(`pair-${bid}`), left: '', right: '' }]
  } : b));

  const updateMatchingPair = (bid: string, pid: string, side: 'left' | 'right', val: string) =>
    setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
      ...b, matchingPairs: (b.matchingPairs || []).map(p => p.id === pid ? { ...p, [side]: val } : p)
    } : b));

  const removeMatchingPair = (bid: string, pid: string) => setQuestionBlocks(bs => bs.map(b =>
    b.id === bid && (b.matchingPairs || []).length > 2 ? {
      ...b, matchingPairs: (b.matchingPairs || []).filter(p => p.id !== pid)
    } : b));

  const addOrderingItem = (bid: string) => setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
    ...b, orderingItems: [...(b.orderingItems || []), { id: generateId(`ord-${bid}`), text: '', order: (b.orderingItems?.length || 0) + 1 }]
  } : b));

  const updateOrderingItem = (bid: string, iid: string, val: string) =>
    setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
      ...b, orderingItems: (b.orderingItems || []).map(item => item.id === iid ? { ...item, text: val } : item)
    } : b));

  const removeOrderingItem = (bid: string, iid: string) => setQuestionBlocks(bs => bs.map(b =>
    b.id === bid && (b.orderingItems || []).length > 2 ? {
      ...b, orderingItems: (b.orderingItems || []).filter(i => i.id !== iid).map((item, idx) => ({ ...item, order: idx + 1 }))
    } : b));

  const moveOrderingItem = (bid: string, iid: string, dir: 'up' | 'down') =>
    setQuestionBlocks(bs => bs.map(b => {
      if (b.id !== bid) return b;
      const items = [...(b.orderingItems || [])];
      const idx = items.findIndex(i => i.id === iid);
      if (idx < 0) return b;
      const newIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= items.length) return b;
      [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
      return { ...b, orderingItems: items.map((item, i) => ({ ...item, order: i + 1 })) };
    }));

  const removeQuestionImage = (id: string) => { updateBlock(id, { questionImageUrl: '' }); setActiveImageToolbar(null); };
  const removeOptionImage = (bid: string, oid: string) => { updateOption(bid, oid, { imageUrl: '' }); setActiveImageToolbar(null); };

  const syncQuestionText = (blockId: string, content: ContentBlock[]) => {
    const plainText = content.filter(cb => cb.type === 'text')
      .map(cb => (cb.value || '').replace(/<[^>]*>/g, '').trim())
      .filter(Boolean).join(' ');
    updateBlock(blockId, { questionContent: content, questionText: plainText, title: plainText || 'Untitled Question' });
    setQuestionTextEmpty(prev => ({ ...prev, [blockId]: !plainText }));
    if (plainText) clearBlockError(blockId, 'questionText');
  };

  const addCB = (blockId: string, type: ContentBlockType) => {
    const block = questionBlocks.find(b => b.id === blockId);
    if (!block) return;
    const newCb: ContentBlock = {
      id: generateId(`cb-${type}`), type,
      ...(type === 'code' ? { value: '', bgColor: '#1e1e1e' } : {}),
      ...(type === 'image' ? { url: '', alignment: 'center' as const, sizePercent: 60 } : {}),
      ...(type === 'text' ? { value: '' } : {}),
    };
    const blocks: ContentBlock[] = [...(block.questionContent || []), newCb];
    if (type === 'code' || type === 'image') blocks.push({ id: generateId('cb-text'), type: 'text', value: '' });
    syncQuestionText(blockId, blocks);
  };

  const updateCB = (blockId: string, cbId: string, patch: Partial<ContentBlock>) => {
    const block = questionBlocks.find(b => b.id === blockId);
    if (!block) return;
    const content = (block.questionContent || []).map(cb => cb.id === cbId ? { ...cb, ...patch } : cb);
    syncQuestionText(blockId, content);
  };

  const removeCB = (blockId: string, cbId: string) => {
    const block = questionBlocks.find(b => b.id === blockId);
    if (!block) return;
    let content = (block.questionContent || []).filter(cb => cb.id !== cbId);
    if (content.length === 0) content = [{ id: generateId('cb-text'), type: 'text', value: '' }];
    syncQuestionText(blockId, content);
  };

  const setImageCBUrl = (blockId: string, cbId: string, url: string) => {
    setQuestionBlocks(bs => bs.map(b => {
      if (b.id !== blockId) return b;
      const content = (b.questionContent || []).map(cb =>
        cb.id === cbId ? { ...cb, url, sizePercent: cb.sizePercent || 60, alignment: cb.alignment || 'center' } : cb
      );
      return { ...b, questionContent: content };
    }));
  };

  const updateImageBlockSize = (blockId: string, cbId: string, sizePercent: number) => {
    setQuestionBlocks(bs => bs.map(b => {
      if (b.id !== blockId) return b;
      const content = (b.questionContent || []).map(cb => cb.id === cbId ? { ...cb, sizePercent } : cb);
      return { ...b, questionContent: content };
    }));
  };

  // ─── HANDLE CONTENT EDITABLE INPUT (called from ContentEditableBlock) ──────
  const handleCBInput = useCallback((blockId: string, cbId: string, val: string) => {
    setQuestionBlocks(bs => bs.map(b => {
      if (b.id !== blockId) return b;
      const content = (b.questionContent || []).map(c => c.id === cbId ? { ...c, value: val } : c);
      const plainText = content.filter(c => c.type === 'text')
        .map(c => (c.value || '').replace(/<[^>]*>/g, '').trim())
        .filter(Boolean).join(' ');
      return { ...b, questionContent: content, questionText: plainText, title: plainText || 'Untitled Question', isDirty: true };
    }));
    const hasText = val.replace(/<[^>]*>/g, '').trim().length > 0;
    setQuestionTextEmpty(prev => ({ ...prev, [blockId]: !hasText }));
    if (hasText) clearBlockError(blockId, 'questionText');
  }, []);

  const convertGeneratedToBlock = (q: GeneratedQuestion, sequence: number): Partial<QuestionBlock> => {
    const questionHtml = q.description ? `<p>${q.description}</p>` : '';
    const base: Partial<QuestionBlock> = {
      type: q.type || 'multiple-choice',
      questionText: questionHtml,
      title: q.title || `Question ${sequence + 1}`,
      questionContent: [{ id: `gen-txt-${Date.now()}-${sequence}`, type: 'text' as const, value: questionHtml }],
      hasExplanation: !!q.explanation, explanation: q.explanation || '',
      difficulty: q.difficulty || '', score: q.points || 0, optionsPerRow: 1, origin: 'ai-generated',
    };
    switch (q.type) {
      case 'multiple-choice': case 'multiple-select': case 'dropdown':
        return { ...base, options: q.options && q.options.length > 0 ? q.options.map((opt, oi) => ({ id: opt.id || `opt-${Date.now()}-${oi}`, text: opt.text || '', isCorrect: opt.isCorrect || false, imageAlignment: 'center' as const, imageSizePercent: 60 })) : makeDefaultBlock('temp', sequence).options };
      case 'true-false': return { ...base, options: [], trueFalseAnswer: typeof q.trueFalseAnswer === 'boolean' ? q.trueFalseAnswer : null };
      case 'short-answer': case 'paragraph': return { ...base, options: [], shortAnswer: q.correctAnswer || '' };
      case 'matching': {
        const pairs = q.matchingPairs && q.matchingPairs.length > 0
          ? q.matchingPairs.map((p: any, i: number) => ({ id: generateId(`pair-${i}`), left: p.prompt || p.left || `Prompt ${i + 1}`, right: p.answer || p.right || `Answer ${i + 1}` }))
          : makeDefaultBlock('temp', sequence).matchingPairs;
        return { ...base, options: [], matchingPairs: pairs };
      }
      case 'ordering': {
        const items = q.orderingItems && q.orderingItems.length > 0
          ? q.orderingItems.map((item: any, i: number) => ({ id: generateId(`ord-${i}`), text: typeof item === 'string' ? item : (item.text || `Step ${i + 1}`), order: i + 1 }))
          : makeDefaultBlock('temp', sequence).orderingItems;
        return { ...base, options: [], orderingItems: items };
      }
      case 'numeric': return { ...base, options: [], numericAnswer: typeof q.numericAnswer === 'number' ? q.numericAnswer : null, numericTolerance: typeof q.numericTolerance === 'number' ? q.numericTolerance : null };
      default: return { ...base, options: q.options && q.options.length > 0 ? q.options.map((opt, oi) => ({ id: opt.id || `opt-${Date.now()}-${oi}`, text: opt.text || '', isCorrect: opt.isCorrect || false, imageAlignment: 'center' as const, imageSizePercent: 60 })) : makeDefaultBlock('temp', sequence).options };
    }
  };

  const handleAIGeneratedQuestions = (generatedQuestions: GeneratedQuestion[]) => {
    const currentIsFillable = currentBlock && !isBlockComplete(currentBlock);
    if (currentIsFillable && generatedQuestions.length > 0) {
      const newFirstId = generateId('ai-fill');
      const filledBlock = { ...currentBlock, ...convertGeneratedToBlock(generatedQuestions[0], currentIndex), id: newFirstId };
      const extra = generatedQuestions.slice(1).map((q, i) => {
        const id = generateId(`ai-extra-${i}`);
        return { ...makeDefaultBlock(id, currentIndex + i + 1), ...convertGeneratedToBlock(q, currentIndex + i + 1), id };
      });
      setQuestionBlocks(prev => { const before = prev.slice(0, currentIndex); const after = prev.slice(currentIndex + 1); return [...before, filledBlock, ...extra, ...after]; });
      success('Questions Generated', `${generatedQuestions.length} question${generatedQuestions.length > 1 ? 's' : ''} added to your test`);
    } else {
      const blocks = generatedQuestions.map((q, i) => { const id = generateId(`ai-${i}`); return { ...makeDefaultBlock(id, questionBlocks.length + i), ...convertGeneratedToBlock(q, questionBlocks.length + i), id }; });
      setQuestionBlocks(prev => [...prev, ...blocks]);
      setCurrentIndex(questionBlocks.length);
      success('Questions Generated', `${generatedQuestions.length} question${generatedQuestions.length > 1 ? 's' : ''} have been added`);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: typeof errors = { blocks: {} };
    let valid = true;
    questionBlocks.forEach(b => {
      const be: any = {};
      if (!b.questionText.replace(/<[^>]*>/g, '').trim()) { be.questionText = 'Question text is required'; valid = false; }
      if (!b.type) { be.type = 'Select a question type'; valid = false; }
      if (!b.difficulty) { be.difficulty = 'Select a difficulty level'; valid = false; }
      if (['multiple-choice', 'multiple-select', 'dropdown'].includes(b.type)) {
        if (b.options.filter(o => o.text.trim()).length < 2) { be.options = 'At least 2 options required'; valid = false; }
        if (!b.options.some(o => o.isCorrect)) { be.correctAnswer = 'Mark at least one correct answer'; valid = false; }
      }
      if (b.type === 'true-false' && b.trueFalseAnswer === null) { be.trueFalse = 'Select True or False'; valid = false; }
      if (b.type === 'numeric' && b.numericAnswer === null) { be.numeric = 'Enter a numeric answer'; valid = false; }
      if (b.hasExplanation && !b.explanation?.replace(/<[^>]*>/g, '').trim()) { be.explanation = 'Explanation is required when enabled'; valid = false; }
      if (Object.keys(be).length) newErrors.blocks![b.id] = be;
    });
    setErrors(newErrors);
    return valid;
  };

const buildQuestionPayload = (question: QuestionBlock) => {
  let mcqQuestionTitle: any = question.questionContent && question.questionContent.length > 0
    ? question.questionContent : question.questionText || question.title || 'Untitled Question';

  let correctAnswers: string[] = [];
  
  if (question.type === 'multiple-choice' || question.type === 'dropdown') {
    const correct = question.options.find(opt => opt.isCorrect);
    correctAnswers = correct ? [correct.text] : [];
  } else if (question.type === 'multiple-select') {
    correctAnswers = question.options.filter(opt => opt.isCorrect).map(opt => opt.text);
  } else if (question.type === 'true-false') {
    correctAnswers = [question.trueFalseAnswer ? 'true' : 'false'];
  } else if (question.type === 'short-answer') {
    // Store short answer in correctAnswers
    correctAnswers = question.shortAnswer ? [question.shortAnswer] : [];
  } else if (question.type === 'paragraph') {
    // ✅ FIX: For essay questions, store the sample answer/rubric in correctAnswers
    // This allows instructors to reference the expected answer/key points when grading
    correctAnswers = question.shortAnswer ? [question.shortAnswer] : [];
  } else if (question.type === 'numeric') {
    correctAnswers = question.numericAnswer !== null ? [question.numericAnswer!.toString()] : [];
  } else if (question.type === 'matching') {
    // For matching, store as JSON string in correctAnswers
    if (question.matchingPairs && question.matchingPairs.length > 0) {
      correctAnswers = [JSON.stringify(question.matchingPairs.map(p => ({ left: p.left, right: p.right })))];
    }
  } else if (question.type === 'ordering') {
    // For ordering, store as JSON string in correctAnswers
    if (question.orderingItems && question.orderingItems.length > 0) {
      const sortedItems = [...question.orderingItems].sort((a, b) => a.order - b.order);
      correctAnswers = [JSON.stringify(sortedItems.map(item => item.text))];
    }
  }

  const typeMapping: Record<string, string> = {
    'multiple-choice': 'multiple_choice',
    'multiple-select': 'multiple_select',
    'true-false': 'true_false',
    'short-answer': 'short_answer',
    'paragraph': 'essay',
    'matching': 'matching',
    'ordering': 'ordering',
    'numeric': 'numeric',
    'dropdown': 'dropdown'
  };
  
  return {
    mcqQuestionTitle, 
    mcqQuestionDescription: question.explanation || '',
    mcqQuestionType: typeMapping[question.type],
    mcqQuestionDifficulty: question.difficulty || 'medium', 
    mcqQuestionScore: question.score || 1,
    mcqQuestionOptions: question.options.map(opt => ({ 
      text: opt.text, 
      isCorrect: opt.isCorrect, 
      imageUrl: opt.imageUrl || null, 
      imageAlignment: opt.imageAlignment || 'left', 
      imageSizePercent: opt.imageSizePercent || 100 
    })),
    mcqQuestionCorrectAnswers: correctAnswers, // ✅ Now includes essay answers
    mcqQuestionOptionsPerRow: question.optionsPerRow || 1,
    mcqQuestionRequired: question.isRequired !== false, 
    hasOtherOption: question.hasOtherOption || false,
    hasExplanation: question.hasExplanation || false, 
    explanation: question.explanation || '', 
    isActive: true,
    trueFalseAnswer: question.trueFalseAnswer, 
    shortAnswer: question.shortAnswer || '', // Keep for backward compatibility
    numericAnswer: question.numericAnswer, 
    numericTolerance: question.numericTolerance,
    matchingPairs: question.matchingPairs || [], 
    orderingItems: question.orderingItems || [],
  };
};

  const buildNewQuestionPayload = (question: QuestionBlock) => {
    const base = buildQuestionPayload(question);
    return {
      ...base,
      ...(question.type === 'matching' && { matchingPairs: question.matchingPairs?.map(p => ({ left: p.left, right: p.right })) }),
      ...(question.type === 'ordering' && { orderingItems: question.orderingItems?.map(item => ({ text: item.text, order: item.order })) }),
    };
  };

  const handleSave = async () => {
    if (!validateForm()) {
      const firstErrorId = Object.keys(errors.blocks || {})[0];
      if (firstErrorId) { const idx = questionBlocks.findIndex(b => b.id === firstErrorId); if (idx >= 0) goToIndex(idx); }
      error('Validation Failed', 'Please fix all errors before saving.');
      return;
    }
    setIsSaving(true);
    try {
      const entityType = getEntityTypeFromNodeType(nodeType);
      const itemKey = "test_your_skills";
      const questionsToUpdate = questionBlocks.filter(b => b.dbId && (b.origin === 'db' || b.isDirty === true));
      const questionsToCreate = questionBlocks.filter(b => !b.dbId && b.origin === 'new');

      if (questionsToUpdate.length > 0) {
        for (const question of questionsToUpdate) {
          if (question.dbId) {
            await youDoMcqApi.updateQuestion(entityType, nodeId, itemKey, question.dbId, buildQuestionPayload(question));
          }
        }
        success(`${questionsToUpdate.length} question(s) updated successfully!`);
      }
      if (questionsToCreate.length > 0) {
        const testData = {
          title: testName || questionBlocks[0]?.title || 'Test Your Skills',
          description: testDescription || '', timeLimit: 60, passingScore: 70,
          attemptLimit: 1, shuffleQuestions: false, showResults: true, pointsPerQuestion: 1,
          questionsData: questionsToCreate.map(q => buildNewQuestionPayload(q))
        };
        await youDoMcqApi.createTest(entityType, nodeId, itemKey, testData);
        success(`${questionsToCreate.length} new question(s) added successfully!`);
      }
      if (questionsToCreate.length === 0 && questionsToUpdate.length === 0) {
        info('No Changes', 'No new or edited questions to save.');
      }
      setQuestionBlocks(prev => prev.map(b => ({ ...b, isDirty: false })));
      onSave(questionBlocks);
      onClose();
    } catch (err: any) {
      error('Save Failed', err.response?.data?.message?.[0]?.value || err.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseClick = () => {
    const hasContent = questionBlocks.some(b => b.questionText.replace(/<[^>]*>/g, '').trim() || b.options.some(o => o.text.trim()));
    if (hasContent) setShowCloseConfirmation(true);
    else onClose();
  };

  const currentBlock = questionBlocks[currentIndex];
  const actionLabel = editingTest ? 'Edit Test' : 'Create Test';
  const questionLabel = questionBlocks.length > 0 ? `Q ${currentIndex + 1} of ${questionBlocks.length}` : '';

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    setActiveFormats(formats);
  };

  const execQuestionCommand = (cmd: string) => { document.execCommand(cmd, false); updateActiveFormats(); };

  const renderOptionInputs = (block: QuestionBlock) => {
    const isMultiSelect = block.type === 'multiple-select';
    const isDropdown = block.type === 'dropdown';
    const isAnswerKeyMode = answerKeyOpenBlockId === block.id;

    if (isAnswerKeyMode) {
      return (
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)', marginBottom: 10, paddingLeft: 2 }}>
            Select the correct answer{isMultiSelect ? 's' : ''} below, then click <strong style={{ color: 'var(--lms-success)' }}>Done</strong>.
          </p>
          <div className="space-y-1.5">
            {block.options.map((opt, idx) => (
              <button key={opt.id} type="button"
                onClick={() => { if (isMultiSelect) toggleCorrectAnswer(block.id, opt.id); else setCorrectAnswer(block.id, opt.id); }}
                className={`lms-ak-option-btn ${opt.isCorrect ? 'correct' : 'neutral'}`}>
                {isDropdown ? (
                  <span className="text-[13px] font-semibold w-5 flex-shrink-0" style={{ fontFamily: 'var(--lms-font)', color: opt.isCorrect ? 'var(--lms-success)' : 'var(--lms-text-muted)' }}>{idx + 1}.</span>
                ) : isMultiSelect ? (
                  <div className="w-4 h-4 border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: opt.isCorrect ? 'var(--lms-success)' : 'var(--lms-border-hover)', background: opt.isCorrect ? 'var(--lms-success)' : 'transparent' }}>
                    {opt.isCorrect && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </div>
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: opt.isCorrect ? 'var(--lms-success)' : 'var(--lms-border-hover)', background: opt.isCorrect ? 'var(--lms-success)' : 'transparent' }}>
                    {opt.isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                )}
                {opt.imageUrl && <img src={opt.imageUrl} alt="" className="h-8 w-8 object-cover rounded flex-shrink-0" style={{ border: '1.5px solid var(--lms-border)' }} />}
                <span className={`flex-1 ${opt.isCorrect ? 'font-semibold' : ''} ${!opt.text.trim() ? 'italic' : ''}`}
                  style={{ color: !opt.text.trim() ? 'var(--lms-text-hint)' : undefined }}>
                  {!opt.text.trim() ? `Option ${idx + 1}` : opt.text}
                </span>
                {opt.isCorrect && <Check className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--lms-success)' }} strokeWidth={2.5} />}
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-center">
            <button type="button" onClick={() => setAnswerKeyOpenBlockId(null)} className="lms-ak-done-btn">Done</button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div className="space-y-0">
          {block.options.map((opt, idx) => {
            const isOptionToolbarActive = activeImageToolbar?.type === 'option' && activeImageToolbar.blockId === block.id && activeImageToolbar.optionId === opt.id;
            const isEmptyWarned = !opt.text.trim() && !!(emptyOptWarnings[block.id]?.has(opt.id));
            return (
              <div key={opt.id} className="group/opt">
                {opt.imageUrl && (
                  <div className="mb-1 ml-8">
                    <div style={{ display: 'flex', justifyContent: opt.imageAlignment === 'left' ? 'flex-start' : opt.imageAlignment === 'right' ? 'flex-end' : 'center', marginTop: 4 }}>
                      <div style={{ width: `${opt.imageSizePercent || 60}%` }} className="cursor-pointer relative"
                        onClick={() => setActiveImageToolbar(isOptionToolbarActive ? null : { type: 'option', blockId: block.id, optionId: opt.id })}>
                        <img src={opt.imageUrl} alt={`Option ${idx + 1}`} className="w-full h-auto rounded-lg max-h-48 object-contain" style={{ border: '1.5px solid var(--lms-border)' }} />
                        {isOptionToolbarActive && (
                          <div className="absolute bottom-[-52px] left-1/2 -translate-x-1/2 z-50 rounded-xl overflow-hidden flex items-stretch divide-x"
                            style={{ minWidth: 260, background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)', boxShadow: 'var(--lms-shadow-md)' }}>
                            <div className="flex flex-col items-center justify-center px-3 py-2 gap-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--lms-text-hint)' }}>Align</span>
                              <div className="flex gap-0.5">
                                {(['left', 'center', 'right'] as const).map(a => (
                                  <button key={a} onClick={() => updateOption(block.id, opt.id, { imageAlignment: a })}
                                    className="w-6 h-6 rounded-md text-[10px] font-bold transition-all"
                                    style={{ background: opt.imageAlignment === a ? 'var(--lms-orange)' : 'var(--lms-bg-surface)', color: opt.imageAlignment === a ? 'white' : 'var(--lms-text-muted)' }}>
                                    {a[0].toUpperCase()}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="flex flex-col justify-center px-3 py-2 gap-1 flex-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--lms-text-hint)' }}>Size {opt.imageSizePercent || 60}%</span>
                              <div className="flex items-center gap-1.5">
                                <ZoomOut className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
                                <input type="range" min={10} max={100} step={5} value={opt.imageSizePercent || 60}
                                  onChange={e => updateOption(block.id, opt.id, { imageSizePercent: parseInt(e.target.value) })}
                                  className="flex-1 h-1.5 cursor-pointer" style={{ accentColor: 'var(--lms-orange)' }} />
                                <ZoomIn className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 px-2 py-2">
                              <button onClick={() => removeOptionImage(block.id, opt.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-50" style={{ color: 'var(--lms-text-hint)' }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => setActiveImageToolbar(null)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--lms-text-hint)' }}>
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="lms-option-row group/opt-inner relative"
                  style={isEmptyWarned ? { borderBottomColor: 'var(--lms-danger)' } : {}}
                  onClick={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') { const inp = (e.currentTarget as HTMLElement).querySelector('input'); inp?.focus(); } }}>
                  {isEmptyWarned && (
                    <div className="absolute -top-7 left-0 z-50 text-white text-[10px] font-semibold px-2 py-1 rounded shadow-md whitespace-nowrap pointer-events-none opacity-0 group-hover/opt-inner:opacity-100 transition-opacity"
                      style={{ background: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                      Option {idx + 1} must be filled
                      <div className="absolute bottom-[-4px] left-3 w-2 h-2 rotate-45" style={{ background: 'var(--lms-danger)' }} />
                    </div>
                  )}
                  {isDropdown ? (
                    <span className="flex-shrink-0 text-[11px] font-semibold w-5 text-right" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>{idx + 1}.</span>
                  ) : isMultiSelect ? (
                    <div className="flex-shrink-0 w-4 h-4 border-2 flex-none" style={{ borderColor: 'var(--lms-border-hover)' }} />
                  ) : (
                    <div className="flex-shrink-0 w-4 h-4 rounded-full border-2 flex-none" style={{ borderColor: 'var(--lms-border-hover)' }} />
                  )}
                  <div className="flex-1 min-w-0 flex items-center">
                    <input type="text" value={opt.text}
                      onChange={e => {
                        updateOption(block.id, opt.id, { text: e.target.value });
                        if (e.target.value.trim()) { clearOptWarning(block.id, opt.id); clearBlockError(block.id, 'options'); }
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="lms-option-input min-w-0 outline-none bg-transparent"
                      style={{ width: opt.text ? `${opt.text.length + 1}ch` : '100%', maxWidth: '100%' }}
                    />
                    {opt.isCorrect && (
                      <span className="flex items-center gap-1 ml-2 flex-shrink-0 px-2 py-0.5 rounded-full"
                        style={{ background: 'var(--lms-success-bg)', border: '1.5px solid var(--lms-success-bdr)' }}>
                        <Check className="h-4 w-4" style={{ color: 'var(--lms-success)' }} strokeWidth={3} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lms-success)', fontFamily: 'var(--lms-font)', whiteSpace: 'nowrap' }}>Marked as correct answer</span>
                      </span>
                    )}
                    <div className="flex-1" />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/opt:opacity-100 transition-opacity">
                    {!isDropdown && (
                      <button type="button" className="cursor-pointer p-1 rounded-md transition-colors hover:bg-slate-100" title="Add image"
                        onClick={() => {
                          if (opt.imageUrl) { warning('Image Exists', 'Option already has an image. Remove existing image first.'); return; }
                          openImgModal(url => {
                            updateOption(block.id, opt.id, { imageUrl: url, imageAlignment: 'center', imageSizePercent: 60 });
                            setActiveImageToolbar({ type: 'option', blockId: block.id, optionId: opt.id });
                            closeImgModal();
                          });
                        }}>
                        <Image className="h-3.5 w-3.5" style={{ color: opt.imageUrl ? 'var(--lms-info)' : 'var(--lms-text-muted)' }} />
                      </button>
                    )}
                    {block.options.length > 2 && (
                      <button onClick={() => removeOption(block.id, opt.id)} className="p-1 rounded-md transition-colors hover:bg-red-50">
                        <X className="h-3.5 w-3.5" style={{ color: 'var(--lms-text-hint)' }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-3 py-2 px-1 mt-1">
          <button onClick={() => addOption(block.id)}
            className="flex items-center gap-1 text-[13.5px] font-medium transition-colors"
            style={{ color: 'var(--lms-info)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>
            <Plus className="h-3.5 w-3.5" />Add option
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setAnswerKeyOpenBlockId(block.id)} className="lms-answer-key-btn">
            <div className="lms-answer-key-checkbox">
              <Check style={{ width: 10, height: 10, color: 'var(--lms-info)' }} strokeWidth={3} />
            </div>
            Answer key
          </button>
          {block.options.filter(o => o.isCorrect).length > 0 && (
            <span style={{ fontSize: 13, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
              ({block.options.filter(o => o.isCorrect).length} {block.options.filter(o => o.isCorrect).length === 1 ? 'answer' : 'answers'} selected)
            </span>
          )}
        </div>
        {errors.blocks?.[block.id]?.correctAnswer && validationAttempted.has(block.id) && (
          <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}>
            <AlertCircle className="h-3 w-3" />{errors.blocks[block.id].correctAnswer}
          </div>
        )}
      </div>
    );
  };

const renderAnswerArea = (block: QuestionBlock) => {
  if (!block.type) return null;

  // --- TRUE/FALSE (unchanged) ---
  if (block.type === 'true-false') {
    const isTFAnswerKeyMode = answerKeyOpenBlockId === block.id;
    return (
      <div className="px-5 py-4 flex-shrink-0">
        {isTFAnswerKeyMode ? (
          <div>
            <p style={{ fontSize: 13.5, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)', marginBottom: 10 }}>
              Select the correct answer below, then click <strong style={{ color: 'var(--lms-success)' }}>Done</strong>.
            </p>
            <div className="space-y-1.5">
              {[true, false].map(val => (
                <button key={String(val)} type="button"
                  onClick={() => { updateBlock(block.id, { trueFalseAnswer: val }); clearBlockError(block.id, 'trueFalse'); }}
                  className={`lms-ak-option-btn ${block.trueFalseAnswer === val ? 'correct' : 'neutral'}`}>
                  <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: block.trueFalseAnswer === val ? 'var(--lms-success)' : 'var(--lms-border-hover)', background: block.trueFalseAnswer === val ? 'var(--lms-success)' : 'transparent' }}>
                    {block.trueFalseAnswer === val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="flex-1 font-semibold">{val ? 'True' : 'False'}</span>
                  {block.trueFalseAnswer === val && <Check className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--lms-success)' }} strokeWidth={2.5} />}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setAnswerKeyOpenBlockId(null)} className="lms-ak-done-btn">Done</button>
            </div>
          </div>
        ) : (
          <div>
            <div className="space-y-0">
              {[true, false].map(val => (
                <div key={String(val)} className="flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-none transition-all"
                    style={{ borderColor: block.trueFalseAnswer === val ? 'var(--lms-success)' : 'var(--lms-border-hover)', background: block.trueFalseAnswer === val ? 'var(--lms-success)' : 'transparent' }}>
                    {block.trueFalseAnswer === val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm font-medium" style={{ fontFamily: 'var(--lms-font)', color: block.trueFalseAnswer === val ? '#14532d' : 'var(--lms-text-main)' }}>
                    {val ? 'True' : 'False'}
                  </span>
                  {block.trueFalseAnswer === val && <Check className="h-3.5 w-3.5 ml-0.5" style={{ color: 'var(--lms-success)' }} strokeWidth={2.5} />}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => setAnswerKeyOpenBlockId(block.id)} className="lms-answer-key-btn">
                <div className="lms-answer-key-checkbox">
                  <Check style={{ width: 10, height: 10, color: 'var(--lms-info)' }} strokeWidth={3} />
                </div>
                Answer key
              </button>
              {block.trueFalseAnswer !== null && (
                <span style={{ fontSize: 13, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>({block.trueFalseAnswer ? 'True' : 'False'} selected)</span>
              )}
            </div>
            {errors.blocks?.[block.id]?.trueFalse && validationAttempted.has(block.id) && (
              <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}><AlertCircle className="h-3 w-3" />{errors.blocks[block.id].trueFalse}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- SHORT ANSWER (Enhanced) ---
  if (block.type === 'short-answer') {
    const isShortAnswerKeyMode = answerKeyOpenBlockId === block.id;
    
    return (
      <div className="px-5 py-4 flex-shrink-0">
        {isShortAnswerKeyMode ? (
          // Answer Key Mode
          <div>
            <p style={{ fontSize: 13.5, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)', marginBottom: 12 }}>
              Enter the correct answer(s) for this short answer question.
            </p>
            <div className="mb-4">
              <label className="lms-section-label block mb-1">Expected Answer</label>
              <input 
                type="text" 
                value={block.shortAnswer || ''} 
                onChange={e => updateBlock(block.id, { shortAnswer: e.target.value })}
                placeholder="e.g., Paris, or 42, or JavaScript..."
                className="w-full text-sm outline-none pb-1.5 transition-colors"
                style={{ 
                  borderBottom: '1.5px solid var(--lms-border)', 
                  color: 'var(--lms-text-main)', 
                  fontFamily: 'var(--lms-font)', 
                  background: 'transparent',
                  padding: '6px 4px'
                }}
                autoFocus
              />
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--lms-text-hint)' }}>
                This answer will be used to auto-grade student responses.
              </p>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setAnswerKeyOpenBlockId(null)} className="lms-ak-done-btn">Done</button>
            </div>
          </div>
        ) : (
          // Normal View Mode
          <div>
            <div className="mt-1">
              <div 
                className="px-3 py-2.5 rounded-lg transition-colors"
                style={{ 
                  border: '1.5px solid var(--lms-border)',
                  background: 'var(--lms-bg-surface)',
                  color: 'var(--lms-text-sec)',
                  fontFamily: 'var(--lms-font)',
                  fontSize: 13,
                  fontStyle: 'italic'
                }}
              >
                Student will type a short answer here...
              </div>
            </div>
            
            {/* Answer Key Section */}
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAnswerKeyOpenBlockId(block.id)} className="lms-answer-key-btn">
                  <div className="lms-answer-key-checkbox">
                    <Check style={{ width: 10, height: 10, color: 'var(--lms-info)' }} strokeWidth={3} />
                  </div>
                  Answer key
                </button>
                {block.shortAnswer && (
                  <span className="text-xs" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
                    Expected: <strong className="text-green-600">{block.shortAnswer}</strong>
                  </span>
                )}
              </div>
            </div>
            
            {errors.blocks?.[block.id]?.shortAnswer && validationAttempted.has(block.id) && (
              <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}>
                <AlertCircle className="h-3 w-3" />{errors.blocks[block.id].shortAnswer}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // --- ESSAY / PARAGRAPH (Enhanced) ---
  if (block.type === 'paragraph') {
    const isEssayKeyMode = answerKeyOpenBlockId === block.id;
    
    return (
      <div className="px-5 py-4 flex-shrink-0">
        {isEssayKeyMode ? (
          // Answer Key Mode - Essay can have a sample answer or rubric
          <div>
            <p style={{ fontSize: 13.5, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)', marginBottom: 12 }}>
              Provide a sample answer or grading rubric for this essay question.
            </p>
            <div className="mb-4">
              <label className="lms-section-label block mb-1">Sample Answer / Rubric (Optional)</label>
              <textarea 
                value={block.shortAnswer || ''} 
                onChange={e => updateBlock(block.id, { shortAnswer: e.target.value })}
                placeholder="Enter key points, sample answer, or grading criteria..."
                rows={4}
                className="w-full text-sm outline-none p-2 transition-colors rounded-lg"
                style={{ 
                  border: '1.5px solid var(--lms-border)',
                  color: 'var(--lms-text-main)', 
                  fontFamily: 'var(--lms-font)', 
                  background: 'var(--lms-bg-surface)',
                  resize: 'vertical'
                }}
              />
              <p className="text-[10px] mt-1.5" style={{ color: 'var(--lms-text-hint)' }}>
                This will help instructors grade consistently.
              </p>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setAnswerKeyOpenBlockId(null)} className="lms-ak-done-btn">Done</button>
            </div>
          </div>
        ) : (
          // Normal View Mode
          <div>
            <div className="mt-1">
              <div 
                className="px-3 py-2.5 rounded-lg"
                style={{ 
                  border: '1.5px solid var(--lms-border)',
                  background: 'var(--lms-bg-surface)',
                  color: 'var(--lms-text-sec)',
                  fontFamily: 'var(--lms-font)',
                  fontSize: 13,
                  fontStyle: 'italic',
                  minHeight: 100
                }}
              >
                Student will write a detailed response here...
              </div>
            </div>
            
            {/* Sample Answer / Rubric Section */}
            <div className="mt-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAnswerKeyOpenBlockId(block.id)} className="lms-answer-key-btn">
                  <div className="lms-answer-key-checkbox">
                    <Check style={{ width: 10, height: 10, color: 'var(--lms-info)' }} strokeWidth={3} />
                  </div>
                  Sample Answer / Rubric
                </button>
                {block.shortAnswer && (
                  <span className="text-xs text-green-600">
                    Has sample answer
                  </span>
                )}
              </div>
              {block.shortAnswer && (
                <div className="mt-2 p-2 rounded-lg" style={{ background: 'var(--lms-info-bg)', border: '1px solid var(--lms-info-bdr)' }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--lms-info)' }}>Sample Answer Preview:</p>
                  <p className="text-[11px]" style={{ color: 'var(--lms-text-main)' }}>
                    {block.shortAnswer.length > 100 ? block.shortAnswer.substring(0, 100) + '...' : block.shortAnswer}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- MATCHING (unchanged) ---
  if (block.type === 'matching') {
    return (
      <div className="px-5 py-4 flex-shrink-0">
        <p className="lms-section-label">Matching Pairs</p>
        <div className="flex items-center gap-2 mb-2 pl-7">
          <div className="flex-1 text-center text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--lms-info)', fontFamily: 'var(--lms-font)' }}>Left Column</div>
          <div className="w-6 flex-shrink-0" />
          <div className="flex-1 text-center text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--lms-info)', fontFamily: 'var(--lms-font)' }}>Right Column</div>
          <div className="w-7 flex-shrink-0" />
        </div>
        <div className="space-y-2">
          {(block.matchingPairs || []).map((pair, idx) => (
            <div key={pair.id} className="flex items-center gap-2 group/pair">
              <span className="w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--lms-info-bg)', color: 'var(--lms-info)', fontFamily: 'var(--lms-font)' }}>{idx + 1}</span>
              <input type="text" value={pair.left} onChange={e => updateMatchingPair(block.id, pair.id, 'left', e.target.value)}
                placeholder="Left item…" className="flex-1 min-w-0 text-sm outline-none pb-0.5 transition-colors"
                style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }} />
              <div className="flex-shrink-0 w-6 flex items-center justify-center">
                <Equal className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
              </div>
              <input type="text" value={pair.right} onChange={e => updateMatchingPair(block.id, pair.id, 'right', e.target.value)}
                placeholder="Right item…" className="flex-1 min-w-0 text-sm outline-none pb-0.5 transition-colors"
                style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }} />
              <div className="w-7 flex-shrink-0 flex items-center justify-center">
                {(block.matchingPairs || []).length > 2 && (
                  <button onClick={() => removeMatchingPair(block.id, pair.id)} className="p-1.5 rounded-lg transition-colors opacity-0 group-hover/pair:opacity-100">
                    <X className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => addMatchingPair(block.id)}
          className="mt-2 flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: 'var(--lms-info)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>
          <Plus className="h-3 w-3" />Add Pair
        </button>
        {errors.blocks?.[block.id]?.matching && validationAttempted.has(block.id) && (
          <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}><AlertCircle className="h-3 w-3" />{errors.blocks[block.id].matching}</div>
        )}
      </div>
    );
  }

  // --- ORDERING (unchanged) ---
  if (block.type === 'ordering') {
    return (
      <div className="px-5 py-4 flex-shrink-0">
        <p className="lms-section-label">Correct Order (top = first)</p>
        <div className="space-y-1.5">
          {(block.orderingItems || []).map((item, idx) => (
            <div key={item.id} className="flex items-center gap-2 group/item">
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button onClick={() => moveOrderingItem(block.id, item.id, 'up')} disabled={idx === 0} className="p-0.5 rounded disabled:opacity-20 transition-colors hover:bg-slate-100">
                  <ChevronUp className="h-3 w-3" style={{ color: 'var(--lms-text-muted)' }} />
                </button>
                <button onClick={() => moveOrderingItem(block.id, item.id, 'down')} disabled={idx === (block.orderingItems?.length || 0) - 1} className="p-0.5 rounded disabled:opacity-20 transition-colors hover:bg-slate-100">
                  <ChevronDown className="h-3 w-3" style={{ color: 'var(--lms-text-muted)' }} />
                </button>
              </div>
              <span className="w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--lms-info-bg)', color: '#0891b2', fontFamily: 'var(--lms-font)' }}>{idx + 1}</span>
              <input type="text" value={item.text} onChange={e => updateOrderingItem(block.id, item.id, e.target.value)}
                placeholder={`Item ${idx + 1}…`} className="flex-1 min-w-0 text-sm outline-none pb-0.5 transition-colors"
                style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }} />
              {(block.orderingItems || []).length > 2 && (
                <button onClick={() => removeOrderingItem(block.id, item.id)} className="p-1.5 rounded-lg transition-colors opacity-0 group-hover/item:opacity-100 flex-shrink-0">
                  <X className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button onClick={() => addOrderingItem(block.id)}
          className="mt-2 flex items-center gap-1 text-[11px] font-semibold"
          style={{ color: '#0891b2', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--lms-font)' }}>
          <Plus className="h-3 w-3" />Add Item
        </button>
        {errors.blocks?.[block.id]?.ordering && validationAttempted.has(block.id) && (
          <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}><AlertCircle className="h-3 w-3" />{errors.blocks[block.id].ordering}</div>
        )}
      </div>
    );
  }

  // --- NUMERIC (unchanged) ---
  if (block.type === 'numeric') {
    return (
      <div className="px-5 py-4 flex-shrink-0">
        <p className="lms-section-label">Numeric Answer</p>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="lms-section-label block mb-1">Correct Answer</label>
            <input type="number" value={block.numericAnswer ?? ''}
              onChange={e => { updateBlock(block.id, { numericAnswer: e.target.value === '' ? null : parseFloat(e.target.value) }); if (e.target.value !== '') clearBlockError(block.id, 'numeric'); }}
              placeholder="0" className="w-full text-sm outline-none pb-0.5 transition-colors"
              style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }} />
          </div>
          <div className="flex-1">
            <label className="lms-section-label block mb-1">Tolerance (±, optional)</label>
            <input type="number" value={block.numericTolerance ?? ''}
              onChange={e => updateBlock(block.id, { numericTolerance: e.target.value === '' ? null : parseFloat(e.target.value) })}
              placeholder="0" className="w-full text-sm outline-none pb-0.5 transition-colors"
              style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }} />
          </div>
        </div>
        {block.numericAnswer !== null && block.numericTolerance !== null && block.numericTolerance > 0 && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
            Accepted range: <span className="font-bold" style={{ color: 'var(--lms-text-main)' }}>{(block.numericAnswer! - block.numericTolerance!).toFixed(2)}</span>
            {' '}to{' '}
            <span className="font-bold" style={{ color: 'var(--lms-text-main)' }}>{(block.numericAnswer! + block.numericTolerance!).toFixed(2)}</span>
          </p>
        )}
        {errors.blocks?.[block.id]?.numeric && validationAttempted.has(block.id) && (
          <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}><AlertCircle className="h-3 w-3" />{errors.blocks[block.id].numeric}</div>
        )}
      </div>
    );
  }

  // --- MULTIPLE CHOICE / MULTIPLE SELECT / DROPDOWN (unchanged) ---
  if (['multiple-choice', 'multiple-select', 'dropdown'].includes(block.type)) {
    return (
      <div className="px-5 py-3 flex-shrink-0">
        {errors.blocks?.[block.id]?.options && validationAttempted.has(block.id) && (
          <div className="mb-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}>
            <AlertCircle className="h-3 w-3" />{errors.blocks[block.id].options}
          </div>
        )}
        {renderOptionInputs(block)}
      </div>
    );
  }
  
  return null;
};

  const openImgModal = (onUpload: (url: string) => void) => setImgModal({ onUpload });
  const closeImgModal = () => setImgModal(null);

  // Mock Modal Component
  const MockModal: React.FC<{ blocks: QuestionBlock[]; onClose: () => void }> = ({ blocks, onClose }) => {
    const OPTION_TYPES = ['multiple-choice', 'multiple-select', 'true-false', 'dropdown'];
    const mockBlocks = blocks.filter(b => OPTION_TYPES.includes(b.type) && b.options?.some(o => o.text.trim()));
    const [idx, setIdx] = useState(0);
    const [selected, setSelected] = useState<Record<string, string[]>>({});
    const [revealed, setRevealed] = useState<Record<string, boolean>>({});
    const scrollRef = useRef<HTMLDivElement>(null);

    const block = mockBlocks[idx];
    const answeredCount = mockBlocks.filter(b => (selected[b.id] || []).length > 0).length;
    const progressPct = mockBlocks.length > 0 ? (answeredCount / mockBlocks.length) * 100 : 0;

    const renderContentBlocks = (content: ContentBlock[] | undefined) => {
      if (!content || content.length === 0) return null;
      return content.map(block => {
        if (block.type === 'text') return <div key={block.id} dangerouslySetInnerHTML={{ __html: block.value || '' }} />;
        if (block.type === 'image' && block.url) {
          return (
            <div key={block.id} className="my-4" style={{ display: 'flex', justifyContent: block.alignment === 'left' ? 'flex-start' : block.alignment === 'right' ? 'flex-end' : 'center' }}>
              <img src={block.url} alt="Question" style={{ width: `${block.sizePercent || 60}%`, maxWidth: '100%', height: 'auto', borderRadius: '12px', border: '1.5px solid var(--lms-border)' }} />
            </div>
          );
        }
        if (block.type === 'code') {
          return (
            <pre key={block.id} className="p-3 rounded-lg my-2 overflow-x-auto" style={{ background: block.bgColor || '#1e1e1e' }}>
              <code style={{ color: '#d4d4d4', fontFamily: 'monospace' }}>{block.value}</code>
            </pre>
          );
        }
        return null;
      });
    };

    const handleSelect = (blockId: string, optId: string) => {
      if (revealed[blockId]) return;
      const b = mockBlocks.find(x => x.id === blockId);
      if (!b) return;
      const isMulti = b.type === 'multiple-select';
      let newSelected: string[];
      if (isMulti) {
        const cur = selected[blockId] || [];
        newSelected = cur.includes(optId) ? cur.filter(x => x !== optId) : [...cur, optId];
      } else {
        newSelected = [optId];
      }
      setSelected(prev => ({ ...prev, [blockId]: newSelected }));
      if (!isMulti || newSelected.length > 0) {
        setTimeout(() => setRevealed(prev => ({ ...prev, [blockId]: true })), 100);
      }
    };

    const handleReset = (blockId: string) => {
      setSelected(prev => { const n = { ...prev }; delete n[blockId]; return n; });
      setRevealed(prev => { const n = { ...prev }; delete n[blockId]; return n; });
    };

const handleSubmitQuiz = () => {
  let correctCount = 0;
  let totalQuestions = mockBlocks.length;
  
  mockBlocks.forEach(b => {
    if (b.type === 'short-answer') {
      const sel = selected[b.id] || [];
      // For short answer, we need exact match comparison
      const userAnswer = sel[0] || '';
      const expectedAnswer = b.shortAnswer || '';
      const isCorrect = userAnswer.toLowerCase().trim() === expectedAnswer.toLowerCase().trim();
      if (isCorrect) correctCount++;
    } 
    else if (b.type === 'paragraph') {
      // For essay questions, we don't auto-grade
      // Just mark as "submitted" for review
      const sel = selected[b.id] || [];
      if (sel.length > 0) correctCount++; // Just count as "completed"
    }
    else {
      const sel = selected[b.id] || [];
      const correctIds = b.options.filter(o => o.isCorrect).map(o => o.id);
      if (sel.length > 0 && correctIds.every(id => sel.includes(id)) && sel.every(id => correctIds.includes(id))) {
        correctCount++;
      }
    }
  });
  
  alert(`Quiz Complete!\n\nYou got ${correctCount} out of ${totalQuestions} correct.`);
  onClose();
};

    if (!block) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(26,26,46,0.55)' }}>
          <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1px solid var(--lms-border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--lms-text-sec)' }}>No option-based questions to preview.</p>
            <button onClick={onClose} className="mt-4 px-4 py-1.5 rounded-lg text-sm font-semibold bg-orange-500 text-white">Close</button>
          </div>
        </div>
      );
    }

    const sel = selected[block.id] || [];
    const rev = revealed[block.id] || false;
    const correctIds = block.options.filter(o => o.isCorrect).map(o => o.id);
    const isCorrectAnswer = rev && sel.length > 0 && correctIds.every(id => sel.includes(id)) && sel.every(id => correctIds.includes(id));
    const isMultiSelect = block.type === 'multiple-select';
    const isDropdown = block.type === 'dropdown';
    const isTrueFalse = block.type === 'true-false';
    const isLast = idx === mockBlocks.length - 1;

    return (
      <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: '#f9f9fb', fontFamily: 'var(--lms-font)' }}>
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3" style={{ borderBottom: '1.5px solid #eaeaef', background: '#fff' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500">
              <Eye className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: '#1a1a2e' }}>Mock Test Preview</p>
              <p className="text-[10px]" style={{ color: '#9b9bae' }}>Select an answer to check immediately</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50">
              <span className="text-xs font-semibold text-gray-500">Progress</span>
              <span className="text-xs font-bold text-orange-500">{answeredCount}/{mockBlocks.length}</span>
              <div className="w-12 h-1.5 rounded-full overflow-hidden bg-gray-200">
                <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: '#F27757' }} />
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="h-4 w-4 text-gray-400" /></button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex">
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white">
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xs font-bold text-gray-400">Q</span>
                  <span className="text-2xl font-black text-orange-500">{idx + 1}</span>
                  <span className="text-xs text-gray-400">/{mockBlocks.length}</span>
                </div>
                <div className="w-px h-5 bg-gray-200" />
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: '#f0fdf4' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: diffConfig[block.difficulty || '']?.dot || '#16a34a' }} />
                  <span className="text-[10px] font-semibold capitalize" style={{ color: diffConfig[block.difficulty || '']?.color || '#16a34a' }}>{block.difficulty || 'Not set'}</span>
                </div>
              </div>
              {rev && (
                <button onClick={() => handleReset(block.id)} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 bg-orange-50 text-orange-500 border border-orange-200">
                  <RotateCcw className="h-3 w-3" /> Try Again
                </button>
              )}
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
              {block.questionContent && block.questionContent.length > 0 ? renderContentBlocks(block.questionContent) : (
                <div className="text-base font-semibold leading-relaxed mb-4" style={{ color: '#1a1a2e' }} dangerouslySetInnerHTML={{ __html: block.questionText || '<p>Question</p>' }} />
              )}
              <p className="text-xs mb-4 flex items-center gap-1.5 text-gray-400">
                <HelpCircle className="h-3 w-3" />
                {isTrueFalse ? 'Click to select your answer — correct answer will be shown immediately.' : isMultiSelect ? 'Select all that apply.' : 'Click on an option to select.'}
              </p>
              <div className="space-y-2.5">
                {block.options.filter(o => o.text.trim()).map((opt, optIdx) => {
                  const isSelected = sel.includes(opt.id);
                  const isCorrect = opt.isCorrect;
                  let bg = '#fff', border = '#eaeaef', textColor = '#1a1a2e';
                  let badge = null;
                  if (rev) {
                    if (isCorrect) { bg = '#f0fdf4'; border = '#16a34a'; textColor = '#16a34a'; badge = <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700"><Check className="h-2.5 w-2.5" /> Correct</span>; }
                    else if (isSelected && !isCorrect) { bg = '#fff5f5'; border = '#ef4444'; textColor = '#ef4444'; badge = <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700"><X className="h-2.5 w-2.5" /> Wrong</span>; }
                  } else if (isSelected) { bg = '#FEF3EF'; border = '#F27757'; textColor = '#F27757'; }
                  const letter = String.fromCharCode(65 + optIdx);
                  return (
                    <button key={opt.id} type="button" onClick={() => handleSelect(block.id, opt.id)} disabled={rev}
                      className="w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all"
                      style={{ background: bg, border: `1.5px solid ${border}`, cursor: rev ? 'default' : 'pointer' }}>
                      {isMultiSelect ? (
                        <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ borderColor: isSelected ? '#8b5cf6' : '#eaeaef', background: isSelected ? '#8b5cf6' : 'transparent' }}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ borderColor: isSelected ? '#F27757' : '#eaeaef', background: isSelected ? '#F27757' : 'transparent' }}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold" style={{ color: isSelected ? '#F27757' : '#9b9bae' }}>{letter}.</span>
                          <span className="text-sm font-medium" style={{ color: textColor }}>{opt.text}</span>
                          {badge}
                        </div>
                        {opt.imageUrl && <img src={opt.imageUrl} alt="" className="mt-2 h-24 object-cover rounded-lg border border-gray-200" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {rev && (
                <div className="mt-6 px-4 py-3 rounded-xl flex items-center gap-2"
                  style={{ background: isCorrectAnswer ? '#f0fdf4' : '#fff5f5', border: `1.5px solid ${isCorrectAnswer ? '#16a34a' : '#ef4444'}` }}>
                  {isCorrectAnswer ? (
                    <><div className="w-6 h-6 rounded-full flex items-center justify-center bg-green-500"><Check className="h-3.5 w-3.5 text-white" /></div><div><span className="text-sm font-bold text-green-600">Correct!</span></div></>
                  ) : (
                    <><div className="w-6 h-6 rounded-full flex items-center justify-center bg-red-500"><X className="h-3.5 w-3.5 text-white" /></div><div><span className="text-sm font-bold text-red-600">Incorrect</span></div></>
                  )}
                </div>
              )}
              {rev && block.hasExplanation && block.explanation && (
                <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA' }}>
                  <div className="flex items-center gap-2 mb-1"><Info className="h-3.5 w-3.5 text-blue-500" /><span className="text-xs font-bold text-blue-600">Explanation</span></div>
                  <p className="text-xs leading-relaxed text-gray-600" dangerouslySetInnerHTML={{ __html: block.explanation }} />
                </div>
              )}
            </div>
          </div>
          <div className="w-72 flex-shrink-0 overflow-y-auto border-l border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2"><Grid3x3 className="h-3.5 w-3.5 text-orange-500" /><span className="text-xs font-bold text-gray-700">Questions</span></div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">{answeredCount}/{mockBlocks.length}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {mockBlocks.map((b, i) => {
                const isCurrent = i === idx;
                const isAnswered = (selected[b.id] || []).length > 0;
                const isCorrect = isAnswered && (() => { const s = selected[b.id] || []; const corrects = b.options.filter(o => o.isCorrect).map(o => o.id); return corrects.every(id => s.includes(id)) && s.every(id => corrects.includes(id)); })();
                let bg = '#fff', color = '#6b6b7e', border = '#eaeaef';
                if (isCurrent) { bg = '#F27757'; color = '#fff'; border = '#F27757'; }
                else if (isCorrect) { bg = '#f0fdf4'; color = '#16a34a'; border = '#16a34a'; }
                else if (isAnswered) { bg = '#FEF3EF'; color = '#F27757'; border = '#F27757'; }
                return (
                  <button key={b.id} onClick={() => { setIdx(i); scrollRef.current?.scrollTo({ top: 0 }); }}
                    className="relative aspect-square rounded-lg text-xs font-bold transition-all flex items-center justify-center"
                    style={{ background: bg, color, border: `1.5px solid ${border}`, cursor: 'pointer' }}>
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-white">
          <button onClick={() => { setIdx(i => Math.max(0, i - 1)); scrollRef.current?.scrollTo({ top: 0 }); }} disabled={idx === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40 border border-gray-200 bg-white text-gray-600">
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          {!isLast ? (
            <button onClick={() => { setIdx(i => Math.min(mockBlocks.length - 1, i + 1)); scrollRef.current?.scrollTo({ top: 0 }); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-orange-500">
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button onClick={handleSubmitQuiz} disabled={answeredCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: answeredCount === 0 ? '#e4e4ed' : '#16a34a', color: answeredCount === 0 ? '#9b9bae' : '#fff', border: 'none', cursor: answeredCount === 0 ? 'not-allowed' : 'pointer' }}>
              <CheckCircle className="h-3.5 w-3.5" /> Finish
            </button>
          )}
        </div>
      </div>
    );
  };

// Preview Modal Component - Enhanced with dropdown for options
const PreviewModal: React.FC<{
  isOpen: boolean; blocks: QuestionBlock[]; onClose: () => void; onEdit: (idx: number) => void;
  onDeleteFromPreview: (block: QuestionBlock, idx: number) => Promise<void>;
}> = ({ isOpen, blocks, onClose, onEdit, onDeleteFromPreview }) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ block: QuestionBlock; idx: number } | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<{ [key: string]: boolean }>({});
  
  if (!isOpen) return null;
  const completedCount = blocks.filter(b => isBlockComplete(b)).length;

  const toggleDetails = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDetails(prev => ({ ...prev, [blockId]: !prev[blockId] }));
  };

  // Helper to render rich content for preview
  const renderRichContent = (block: QuestionBlock) => {
    if (block.questionContent && block.questionContent.length > 0) {
      return block.questionContent.map((cb, idx) => {
        if (cb.type === 'text') {
          return <div key={idx} dangerouslySetInnerHTML={{ __html: cb.value || '' }} />;
        }
        if (cb.type === 'code') {
          return (
            <pre key={idx} className="p-3 rounded-lg my-2 overflow-x-auto" style={{ background: cb.bgColor || '#1e1e1e' }}>
              <code style={{ color: '#d4d4d4', fontFamily: 'monospace' }}>{cb.value}</code>
            </pre>
          );
        }
        if (cb.type === 'image' && cb.url) {
          return (
            <div key={idx} className="my-4" style={{ display: 'flex', justifyContent: cb.alignment === 'left' ? 'flex-start' : cb.alignment === 'right' ? 'flex-end' : 'center' }}>
              <img src={cb.url} alt="Question" style={{ width: `${cb.sizePercent || 60}%`, maxWidth: '100%', height: 'auto', borderRadius: '12px', border: '1.5px solid var(--lms-border)' }} />
            </div>
          );
        }
        return null;
      });
    }
    return <div dangerouslySetInnerHTML={{ __html: block.questionText || '<p>Question</p>' }} />;
  };

  // Helper to render options with details
  const renderOptionsDetails = (block: QuestionBlock) => {
    if (!block.options || block.options.length === 0) return null;
    
    const isMultiSelect = block.type === 'multiple-select';
    const isDropdown = block.type === 'dropdown';
    const isTrueFalse = block.type === 'true-false';
    
    if (isTrueFalse) {
      return (
        <div className="mt-3">
          <div className="text-xs font-bold text-gray-500 mb-2">Correct Answer:</div>
          <div className="flex gap-3">
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${block.trueFalseAnswer === true ? 'bg-green-100 border border-green-500' : 'bg-gray-100'}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${block.trueFalseAnswer === true ? 'border-green-500 bg-green-500' : 'border-gray-400'}`}>
                {block.trueFalseAnswer === true && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium">True</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${block.trueFalseAnswer === false ? 'bg-green-100 border border-green-500' : 'bg-gray-100'}`}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${block.trueFalseAnswer === false ? 'border-green-500 bg-green-500' : 'border-gray-400'}`}>
                {block.trueFalseAnswer === false && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-sm font-medium">False</span>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="mt-3 space-y-2">
        <div className="text-xs font-bold text-gray-500 mb-2">
          Options ({isMultiSelect ? 'Select all that apply' : isDropdown ? 'Dropdown selection' : 'Single choice'}):
        </div>
        {block.options.map((opt, optIdx) => {
          const letter = String.fromCharCode(65 + optIdx);
          return (
            <div key={opt.id} className={`flex items-start gap-3 p-2 rounded-lg ${opt.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
              {isDropdown ? (
                <span className="text-xs font-bold w-5 flex-shrink-0" style={{ color: opt.isCorrect ? '#16a34a' : '#9b9bae' }}>{optIdx + 1}.</span>
              ) : isMultiSelect ? (
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${opt.isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                  {opt.isCorrect && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
              ) : (
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${opt.isCorrect ? 'border-green-500 bg-green-500' : 'border-gray-300'}`}>
                  {opt.isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold" style={{ color: opt.isCorrect ? '#16a34a' : '#6b6b7e' }}>{letter}.</span>
                  <span className="text-sm" style={{ color: opt.isCorrect ? '#14532d' : '#1a1a2e' }}>{opt.text || `Option ${optIdx + 1}`}</span>
                  {opt.isCorrect && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      <Check className="h-2.5 w-2.5 inline mr-0.5" /> Correct Answer
                    </span>
                  )}
                </div>
                {opt.imageUrl && (
                  <div className="mt-2" style={{ display: 'flex', justifyContent: opt.imageAlignment === 'left' ? 'flex-start' : opt.imageAlignment === 'right' ? 'flex-end' : 'center' }}>
                    <img src={opt.imageUrl} alt={`Option ${optIdx + 1}`} className="max-h-24 object-contain rounded-lg border border-gray-200" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper to render answer key for non-option types
  const renderAnswerKey = (block: QuestionBlock) => {
  if (block.type === 'short-answer') {
  const currentAnswer = (selected[block.id] || [])[0] || '';
  const rev = revealed[block.id] || false;
  
  return (
    <div className="space-y-3">
      <textarea
        value={currentAnswer}
        onChange={(e) => {
          if (!rev) {
            setSelected(prev => ({ ...prev, [block.id]: [e.target.value] }));
          }
        }}
        disabled={rev}
        placeholder="Type your answer here..."
        rows={3}
        className="w-full p-3 text-sm rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
        style={{ fontFamily: 'var(--lms-font)' }}
      />
      {rev && (
        <div className={`mt-3 p-3 rounded-lg ${currentAnswer.toLowerCase().trim() === (block.shortAnswer || '').toLowerCase().trim() ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {currentAnswer.toLowerCase().trim() === (block.shortAnswer || '').toLowerCase().trim() ? (
              <><Check className="h-4 w-4 text-green-500" /><span className="text-sm font-medium text-green-700">Correct!</span></>
            ) : (
              <><X className="h-4 w-4 text-red-500" /><span className="text-sm font-medium text-red-700">Incorrect</span></>
            )}
          </div>
          <div className="mt-2 text-xs text-gray-600">
            <span className="font-semibold">Expected answer:</span> {block.shortAnswer}
          </div>
        </div>
      )}
    </div>
  );
}

if (block.type === 'paragraph') {
  const currentAnswer = (selected[block.id] || [])[0] || '';
  const rev = revealed[block.id] || false;
  
  return (
    <div className="space-y-3">
      <textarea
        value={currentAnswer}
        onChange={(e) => {
          if (!rev) {
            setSelected(prev => ({ ...prev, [block.id]: [e.target.value] }));
          }
        }}
        disabled={rev}
        placeholder="Write your essay response here..."
        rows={6}
        className="w-full p-3 text-sm rounded-lg border border-gray-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all"
        style={{ fontFamily: 'var(--lms-font)' }}
      />
      {rev && block.shortAnswer && (
        <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700">Sample Answer / Key Points</span>
          </div>
          <p className="text-xs text-gray-600">{block.shortAnswer}</p>
          <p className="mt-2 text-xs text-amber-600">Note: Essay answers require manual grading</p>
        </div>
      )}
    </div>
  );
}

  
    if (block.type === 'numeric') {
      return (
        <div className="mt-3">
          <div className="text-xs font-bold text-gray-500 mb-1">Answer Key:</div>
          <div className="p-2 rounded-lg bg-gray-50">
            <span className="text-sm font-medium">{block.numericAnswer}</span>
            {block.numericTolerance && block.numericTolerance > 0 && (
              <span className="text-xs text-gray-500 ml-2">(±{block.numericTolerance})</span>
            )}
          </div>
        </div>
      );
    }
    
    if (block.type === 'matching' && block.matchingPairs && block.matchingPairs.length > 0) {
      return (
        <div className="mt-3">
          <div className="text-xs font-bold text-gray-500 mb-1">Matching Pairs:</div>
          <div className="space-y-1 p-2 rounded-lg bg-gray-50">
            {block.matchingPairs.map((pair, idx) => (
              <div key={pair.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{idx + 1}.</span>
                <span>{pair.left}</span>
                <span className="text-gray-400">→</span>
                <span className="font-medium">{pair.right}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    if (block.type === 'ordering' && block.orderingItems && block.orderingItems.length > 0) {
      const sortedItems = [...block.orderingItems].sort((a, b) => a.order - b.order);
      return (
        <div className="mt-3">
          <div className="text-xs font-bold text-gray-500 mb-1">Correct Order:</div>
          <div className="space-y-1 p-2 rounded-lg bg-gray-50">
            {sortedItems.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex flex-col overflow-hidden w-[96vw] max-w-[1500px] h-[96vh] max-h-[96vh] bg-white rounded-xl shadow-2xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center"><Eye className="h-4 w-4 text-white" /></div>
            <div className="h-5 w-px bg-gray-200" />
            <QuestionFormBreadcrumb breadcrumbs={breadcrumbs} actionLabel="Preview" questionLabel={`${blocks.length} questions (${completedCount} complete)`} />
          </div>
          <button onClick={onClose} className="p-2 rounded-lg bg-red-50 border border-red-200"><X className="h-4 w-4 text-red-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {blocks.map((block, idx) => {
            const isComplete = isBlockComplete(block);
            const isExpanded = expandedDetails[block.id] || false;
            
            return (
              <div key={block.id} className={`lms-preview-card p-4 ${isComplete ? '' : 'opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black ${isComplete ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] font-semibold leading-snug text-gray-900">{block.title || 'Untitled Question'}</div>
                      <button 
                        onClick={(e) => toggleDetails(block.id, e)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        title={isExpanded ? "Hide details" : "Show details"}
                      >
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{typeConfig[block.type]?.label}</span>
                      {block.difficulty && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: `${diffConfig[block.difficulty].color}14`, color: diffConfig[block.difficulty].color }}>
                          {diffConfig[block.difficulty].label}
                        </span>
                      )}
                      {block.score && block.score > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-600">
                          {block.score} pts
                        </span>
                      )}
                      {!isComplete && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-600">Incomplete</span>
                      )}
                    </div>
                    
                    {/* Question preview (always visible) */}
                    <div className="mt-3 p-3 rounded-lg bg-gray-50 max-h-40 overflow-y-auto">
                      <div className="text-sm" style={{ color: '#1a1a2e' }}>
                        {renderRichContent(block)}
                      </div>
                    </div>
                    
                    {/* Expandable details section */}
                    {isExpanded && (
                      <div className="mt-4 pt-3 border-t border-gray-200 animate-fade-in">
                        {/* Options section */}
                        {renderOptionsDetails(block)}
                        
                        {/* Answer key section */}
                        {renderAnswerKey(block)}
                        
                        {/* Explanation section */}
                        {block.hasExplanation && block.explanation && (
                          <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                            <div className="flex items-center gap-2 mb-1">
                              <Info className="h-3.5 w-3.5 text-blue-500" />
                              <span className="text-xs font-bold text-blue-600">Explanation</span>
                            </div>
                            <div className="text-xs leading-relaxed text-gray-600" dangerouslySetInnerHTML={{ __html: block.explanation }} />
                          </div>
                        )}
                        
                        {/* Metadata */}
                        <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-400">
                          <span>Type: {typeConfig[block.type]?.label}</span>
                          {block.difficulty && <span>Difficulty: {diffConfig[block.difficulty].label}</span>}
                          {block.score && <span>Score: {block.score} points</span>}
                          {block.isRequired && <span>Required</span>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onEdit(idx)} className="p-1.5 rounded-lg hover:bg-gray-100">
                      <Edit2 className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ block, idx })} className="p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><Trash2 className="h-4 w-4 text-red-500" /></div>
              <h3 className="text-sm font-bold text-gray-900">Delete Question</h3>
            </div>
            <div className="p-5">
              <p className="text-xs font-medium text-gray-500 mb-2">Are you sure you want to delete this question?</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold">Cancel</button>
                <button onClick={async () => {
                  const { block, idx } = deleteConfirm;
                  setDeleteConfirm(null);
                  setDeletingId(block.id);
                  try { await onDeleteFromPreview(block, idx); } finally { setDeletingId(null); }
                }} className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

  const isOnLastQuestion = currentIndex === questionBlocks.length - 1;
  const currentBlockIsValid = currentBlock ? isBlockComplete(currentBlock) : false;

  // ─── RENDER QUESTION EDITOR CONTENT ─────────────────────────────────────────
  // ✅ KEY FIX: Uses ContentEditableBlock component for text blocks.
  // This isolates the contentEditable DOM from React re-renders, fixing the
  // reversed/cursor-jumping text input bug.
  const renderQuestionEditorContent = () => {
    if (!currentBlock) return null;

    const contentBlocks = currentBlock.questionContent || [{ id: `${currentBlock.id}-txt-1`, type: 'text' as const, value: '' }];

    return contentBlocks.map((cb, cbIdx, arr) => {
      if (cb.type === 'text') {
        const isEmpty = !(cb.value || '').replace(/<[^>]*>/g, '').trim();
        const isFirst = cbIdx === 0;
        const showError = !!(errors.blocks?.[currentBlock.id]?.questionText && validationAttempted.has(currentBlock.id) && isFirst && isEmpty);

        // Strip wrapping <p> tags for cleaner display in contentEditable
        const getRawText = (html: string) => {
          if (!html) return '';
          let cleaned = html;
          if (cleaned.startsWith('<p>')) cleaned = cleaned.substring(3);
          if (cleaned.endsWith('</p>')) cleaned = cleaned.substring(0, cleaned.length - 4);
          cleaned = cleaned.replace(/<\/?p>/g, '');
          return cleaned;
        };

        return (
          <ContentEditableBlock
            key={cb.id}
            blockId={currentBlock.id}
            cbId={cb.id}
            initialValue={getRawText(cb.value || '')}
            isFirst={isFirst}
            showError={showError}
            arrLength={arr.length}
            onUpdateFormats={updateActiveFormats}
            onInput={handleCBInput}
            onRemove={removeCB}
          />
        );
      }

      if (cb.type === 'code') {
        return (
          <div key={cb.id} className="relative my-2 group/cb">
            <div className="relative rounded-lg overflow-hidden border border-gray-200">
              <textarea
                value={cb.value || ''}
                onChange={e => updateCB(currentBlock.id, cb.id, { value: e.target.value })}
                placeholder="// Write your code here…"
                className="w-full p-3 font-mono text-sm outline-none resize-y"
                style={{ background: cb.bgColor || '#1e1e1e', color: '#d4d4d4', minHeight: 100 }}
              />
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/cb:opacity-100 transition-opacity">
                <button onClick={() => removeCB(currentBlock.id, cb.id)} className="p-1 rounded bg-white/10"><X className="h-3 w-3 text-white" /></button>
              </div>
              <div className="px-2 py-1 border-t border-gray-200 bg-gray-50 flex gap-2">
                {CODE_BG_COLORS.map(theme => (
                  <button key={theme.label} onClick={() => updateCB(currentBlock.id, cb.id, { bgColor: theme.value })}
                    className="w-4 h-4 rounded-full border-2" style={{ background: theme.value, borderColor: cb.bgColor === theme.value ? '#F27757' : '#e4e4ed' }} />
                ))}
                <input type="text" value={cb.language || ''} onChange={e => updateCB(currentBlock.id, cb.id, { language: e.target.value })}
                  placeholder="lang" className="text-[10px] ml-2 bg-transparent border-none outline-none w-16" />
              </div>
            </div>
          </div>
        );
      }

      if (cb.type === 'image') {
        const isImageToolbarActive = activeImageToolbar?.type === 'question' && activeImageToolbar.blockId === currentBlock.id && activeImageToolbar.cbId === cb.id;
        return (
          <div key={cb.id} className="relative my-2 group/cb">
            {cb.url ? (
              <div>
                <div style={{ display: 'flex', justifyContent: cb.alignment === 'left' ? 'flex-start' : cb.alignment === 'right' ? 'flex-end' : 'center' }}>
                  <div style={{ width: `${cb.sizePercent || 60}%` }} className="cursor-pointer relative"
                    onClick={() => setActiveImageToolbar(isImageToolbarActive ? null : { type: 'question', blockId: currentBlock.id, cbId: cb.id })}>
                    <img src={cb.url} alt="Question" className="w-full h-auto rounded-lg max-h-64 object-contain" style={{ border: '1.5px solid var(--lms-border)' }} />
                    {isImageToolbarActive && (
                      <div className="absolute bottom-[-52px] left-1/2 -translate-x-1/2 z-50 rounded-xl overflow-hidden flex items-stretch divide-x"
                        style={{ minWidth: 260, background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)', boxShadow: 'var(--lms-shadow-md)' }}>
                        <div className="flex flex-col items-center justify-center px-3 py-2 gap-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--lms-text-hint)' }}>Align</span>
                          <div className="flex gap-0.5">
                            {(['left', 'center', 'right'] as const).map(a => (
                              <button key={a} onClick={() => updateCB(currentBlock.id, cb.id, { alignment: a })}
                                className="w-6 h-6 rounded-md text-[10px] font-bold transition-all"
                                style={{ background: cb.alignment === a ? 'var(--lms-orange)' : 'var(--lms-bg-surface)', color: cb.alignment === a ? 'white' : 'var(--lms-text-muted)' }}>
                                {a[0].toUpperCase()}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col justify-center px-3 py-2 gap-1 flex-1">
                          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--lms-text-hint)' }}>Size {cb.sizePercent || 60}%</span>
                          <div className="flex items-center gap-1.5">
                            <ZoomOut className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
                            <input type="range" min={10} max={100} step={5} value={cb.sizePercent || 60}
                              onChange={e => updateImageBlockSize(currentBlock.id, cb.id, parseInt(e.target.value))}
                              className="flex-1 h-1.5 cursor-pointer" style={{ accentColor: 'var(--lms-orange)' }} />
                            <ZoomIn className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 px-2 py-2">
                          <button onClick={() => removeCB(currentBlock.id, cb.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-50" style={{ color: 'var(--lms-text-hint)' }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setActiveImageToolbar(null)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--lms-text-hint)' }}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => openImgModal(url => { setImageCBUrl(currentBlock.id, cb.id, url); closeImgModal(); })}
                className="flex items-center justify-center gap-2 py-6 rounded-lg w-full transition-colors hover:bg-gray-50 border-2 border-dashed border-gray-200 text-gray-400">
                <Image className="h-4 w-4" /> Click to upload image
              </button>
            )}
          </div>
        );
      }
      return null;
    });
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm">
        <div className="bg-white rounded-xl p-8 flex flex-col items-center gap-4">
          <Loader className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm font-medium text-gray-600">Loading existing questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/55 backdrop-blur-sm overflow-hidden" style={{ fontFamily: 'var(--lms-font)' }}>
      <ToastContainer toasts={toasts} onRemove={remove} />
      {imgModal && <ImageUploadModal onUpload={imgModal.onUpload} onClose={closeImgModal} />}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="lms-header-logo-mark"><GraduationCap className="h-4 w-4 text-white" /></div>
          <div className="h-5 w-px bg-gray-200 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <QuestionFormBreadcrumb breadcrumbs={breadcrumbs} actionLabel={actionLabel} questionLabel={questionLabel} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <button onClick={handlePreviewClick} disabled={questionBlocks.length === 0 || !isPreviewEnabled()}
            className="lms-btn lms-btn-ghost-violet mr-2" style={(questionBlocks.length === 0 || !isPreviewEnabled()) ? { opacity: 0.45, cursor: 'not-allowed' } : {}}>
            <Eye className="h-3.5 w-3.5" />Preview ({questionBlocks.length})
          </button>
          <TestYourSkillsGenerateMCQAIQuestion
            breadcrumbs={breadcrumbs} exerciseData={undefined} onClose={() => {}} onSave={handleAIGeneratedQuestions}
            buttonClassName="lms-btn lms-btn-orange mr-2"
            buttonText={<span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" />Generate AI</span>}
            defaultTopic={defaultTopic}
          />
          <button onClick={handleCloseClick} className="p-2 rounded-lg transition-colors cursor-pointer bg-red-100 hover:bg-red-200">
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0" style={{ overflow: 'hidden' }}>
        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
          <div ref={mainScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin' }}>
            {currentBlock ? (
              <div className="flex flex-col min-h-full bg-white">
                {/* Top toolbar */}
                <div className="px-5 pt-3 pb-2 flex-shrink-0 sticky top-0 z-50 bg-white border-b border-gray-200">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0 bg-orange-500 shadow-md">
                      {currentIndex + 1}
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {(['bold', 'italic', 'underline'] as const).map((cmd) => {
                        const icons = [<Bold className="h-3.5 w-3.5" />, <Italic className="h-3.5 w-3.5" />, <Underline className="h-3.5 w-3.5" />];
                        const i = ['bold', 'italic', 'underline'].indexOf(cmd);
                        return (
                          <button key={cmd} type="button" onMouseDown={e => { e.preventDefault(); execQuestionCommand(cmd); }}
                            className={`lms-fmt-btn ${activeFormats.has(cmd) ? 'active' : ''}`}>{icons[i]}</button>
                        );
                      })}
                      <div className="w-px h-3.5 mx-1 bg-gray-200 flex-shrink-0" />
                      <button type="button" onClick={() => currentBlock && addCB(currentBlock.id, 'code')} className="lms-fmt-btn"><Code className="h-3.5 w-3.5" /></button>
                      <button type="button" className="lms-fmt-btn" onClick={() => {
                        if (!currentBlock) return;
                        openImgModal(url => {
                          const cbId = generateId('cb-img');
                          const txtId = generateId('cb-text');
                          const newBlocks: ContentBlock[] = [
                            ...(currentBlock.questionContent || []),
                            { id: cbId, type: 'image' as const, url, alignment: 'center' as const, sizePercent: 60 },
                            { id: txtId, type: 'text' as const, value: '' },
                          ];
                          syncQuestionText(currentBlock.id, newBlocks);
                          closeImgModal();
                        });
                      }}><Image className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="flex-1" />

                    {/* Question Type Dropdown */}
                    <div className="relative flex-shrink-0">
                      <button onClick={e => { e.stopPropagation(); setShowQTypeMenu(v => !v); }}
                        className={`lms-diff-underline-btn ${currentBlock.type ? 'has-value' : ''}`}
                        style={{ minWidth: 130, color: currentBlock.type ? typeConfig[currentBlock.type]?.color : 'var(--lms-text-hint)' }}>
                        {currentBlock.type && typeConfig[currentBlock.type] && (
                          <span style={{ color: typeConfig[currentBlock.type].color, display: 'flex', alignItems: 'center' }}>{typeConfig[currentBlock.type].icon}</span>
                        )}
                        <span style={{ fontWeight: currentBlock.type ? 600 : 400, color: currentBlock.type ? 'var(--lms-text-main)' : 'var(--lms-text-hint)' }}>
                          {currentBlock.type ? typeConfig[currentBlock.type]?.label : 'Question type…'}
                        </span>
                        <svg className="diff-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6l4 4 4-4" /></svg>
                      </button>
                      {showQTypeMenu && (
                        <div className="lms-diff-dropdown" style={{ minWidth: 180, maxHeight: 260, overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                          {[
                            { group: 'Choice', types: ['multiple-choice', 'multiple-select', 'true-false', 'dropdown'] },
                            { group: 'Text', types: ['short-answer', 'paragraph'] },
                            { group: 'Complex', types: ['matching', 'ordering', 'numeric'] },
                          ].map(({ group, types }) => (
                            <div key={group}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 14px 2px' }}>{group}</div>
                              {types.map(t => (
                                <div key={t} onClick={() => { updateBlock(currentBlock.id, { type: t as QuestionType }); setShowQTypeMenu(false); }} className="lms-diff-dropdown-item">
                                  <span style={{ color: typeConfig[t].color }}>{typeConfig[t].icon}</span>
                                  <span style={{ color: 'var(--lms-text-main)', fontWeight: currentBlock.type === t ? 700 : 400 }}>{typeConfig[t].label}</span>
                                  {currentBlock.type === t && <Check style={{ width: 12, height: 12, color: 'var(--lms-orange)', marginLeft: 'auto' }} />}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Difficulty Dropdown */}
                    <div className="relative flex-shrink-0 group">
                      <button onClick={e => { e.stopPropagation(); setShowDifficultyMenu(v => !v); }}
                        className={`lms-diff-underline-btn ${currentBlock.difficulty ? 'has-value' : ''}`} style={{ minWidth: 100 }}>
                        {currentBlock.difficulty ? (<div style={{ width: 8, height: 8, borderRadius: '50%', background: diffConfig[currentBlock.difficulty].dot, flexShrink: 0 }} />) : null}
                        <span>{currentBlock.difficulty ? diffConfig[currentBlock.difficulty].label : 'Difficulty'}</span>
                        <svg className="diff-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6l4 4 4-4" /></svg>
                      </button>
                      {showDifficultyMenu && (
                        <div className="lms-diff-dropdown" onClick={e => e.stopPropagation()}>
                          {(['easy', 'medium', 'hard'] as const).map(level => (
                            <div key={level} onClick={() => { updateBlock(currentBlock.id, { difficulty: level }); setShowDifficultyMenu(false); }} className="lms-diff-dropdown-item">
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: diffConfig[level].dot, flexShrink: 0 }} />
                              <span style={{ color: diffConfig[level].color, fontWeight: currentBlock.difficulty === level ? 700 : 500 }}>{diffConfig[level].label}</span>
                              {currentBlock.difficulty === level && <Check style={{ width: 12, height: 12, color: diffConfig[level].color, marginLeft: 'auto' }} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Question content area */}
                <div className="px-5 pt-3 pb-4">
                  {currentBlock.type ? (
                    <div>
                      {renderQuestionEditorContent()}
                      {errors.blocks?.[currentBlock.id]?.questionText && validationAttempted.has(currentBlock.id) && (
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle className="h-3 w-3 flex-shrink-0" />{errors.blocks[currentBlock.id].questionText}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 gap-1.5 text-center">
                      <p className="text-sm font-medium text-orange-500">Select a question type to get started</p>
                      <p className="text-sm text-gray-500">Choose a type from the dropdown above to begin.</p>
                    </div>
                  )}
                </div>

                {/* Explanation toggle */}
                {currentBlock.type && (
                  <div className="px-5 pt-2 pb-2 flex-shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer group w-fit">
                      <input type="checkbox" checked={currentBlock.hasExplanation}
                        onChange={() => updateBlock(currentBlock.id, { hasExplanation: !currentBlock.hasExplanation })}
                        className="w-3.5 h-3.5 accent-orange-500 cursor-pointer" />
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500">
                        <HelpCircle className="h-3.5 w-3.5" />Add Explanation
                      </span>
                    </label>
                    {currentBlock.hasExplanation && (
                      <div className="mt-3">
                        <RichTextEditor value={currentBlock.explanation || ''}
                          onChange={v => updateBlock(currentBlock.id, { explanation: v })}
                          placeholder="Explain the correct answer…" compact />
                        {errors.blocks?.[currentBlock.id]?.explanation && validationAttempted.has(currentBlock.id) && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                            <AlertCircle className="h-3 w-3" />{errors.blocks[currentBlock.id].explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {renderAnswerArea(currentBlock)}
                <div className="h-4 flex-shrink-0" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400">No question selected</p>
              </div>
            )}
          </div>

          {/* Footer navigation */}
          <div className="flex-shrink-0 py-3 border-t border-gray-200 bg-white" style={{ paddingLeft: 20, paddingRight: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>
              <div />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <button onClick={handlePrevQuestion} disabled={currentIndex === 0} className="lms-nav-btn">
                  <ChevronLeft className="h-3.5 w-3.5" />Prev
                </button>
                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                  <span style={{ color: '#F27757', fontWeight: 700 }}>{currentIndex + 1}</span>
                  <span className="text-gray-400"> / </span>{questionBlocks.length}
                </span>
                <button onClick={handleNextQuestion} disabled={currentIndex >= questionBlocks.length - 1} className="lms-nav-btn">
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button onClick={addQuestionBlock} className="lms-btn lms-btn-ghost-violet">
                  <Plus className="h-3.5 w-3.5" />Add
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                <div className="flex items-center gap-2">
                  <div className="lms-tooltip-wrap">
                    <button onClick={duplicateQuestionBlock} disabled={!currentBlockIsValid}
                      className={`lms-icon-btn ${currentBlockIsValid ? 'lms-icon-btn-violet' : 'lms-icon-btn-slate'}`}
                      style={!currentBlockIsValid ? { cursor: 'not-allowed', opacity: 0.45 } : {}}>
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  {questionBlocks.length > 1 && (
                    <div className="lms-tooltip-wrap">
                      <button onClick={() => requestDelete(currentIndex)} className="lms-icon-btn lms-icon-btn-red">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="lms-tooltip-wrap">
                    <button onClick={() => {
                      const defaultBlock = makeDefaultBlock(currentBlock.id, currentIndex);
                      updateBlock(currentBlock.id, {
                        questionText: defaultBlock.questionText, questionContent: defaultBlock.questionContent,
                        options: defaultBlock.options, matchingPairs: defaultBlock.matchingPairs,
                        orderingItems: defaultBlock.orderingItems, trueFalseAnswer: defaultBlock.trueFalseAnswer,
                        shortAnswer: defaultBlock.shortAnswer, numericAnswer: defaultBlock.numericAnswer,
                        numericTolerance: defaultBlock.numericTolerance, hasExplanation: defaultBlock.hasExplanation,
                        explanation: defaultBlock.explanation, questionImageUrl: defaultBlock.questionImageUrl,
                      });
                    }} className="lms-icon-btn lms-icon-btn-slate">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Summary */}
        <div className="w-80 flex-shrink-0 flex flex-col border-l border-gray-200 bg-white">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4 pb-2 border-b border-gray-200">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <FileText className="h-3.5 w-3.5 text-orange-500" />Test Summary
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-gray-500">Total Questions</span>
                <span className="text-sm font-bold text-gray-800">{questionBlocks.length}</span>
              </div>
              <div className="space-y-1 mt-3">
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Question Types</p>
                {Object.entries(questionBlocks.reduce((acc, b) => {
                  acc[b.type || 'unspecified'] = (acc[b.type || 'unspecified'] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-xs">
                    <span style={{ color: typeConfig[type]?.color || '#6b6b7e' }}>{typeConfig[type]?.label || type}</span>
                    <span className="font-semibold text-gray-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 p-3 border-t border-gray-200 flex gap-2">
            <button onClick={handleMockTestClick} disabled={!isMockTestEnabled()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all text-white bg-orange-500 disabled:opacity-40">
              <Eye className="h-3.5 w-3.5" />Mock Test
            </button>
            <button onClick={handleSave} disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all text-white bg-green-500 disabled:opacity-50">
              {isSaving ? (<><Loader className="h-3.5 w-3.5 animate-spin" />Saving...</>) : (<><Check className="h-3.5 w-3.5" />{editingTest ? 'Update Test' : 'Save Test'}</>)}
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center"><Trash2 className="h-4 w-4 text-red-500" /></div>
              <h3 className="text-sm font-bold text-gray-900">Delete Question</h3>
            </div>
            <div className="p-5">
              <p className="text-xs font-medium text-gray-500 mb-2">Are you sure you want to delete this question?</p>
              <p className="text-[11px] text-red-500 mb-4">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-semibold">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close confirmation modal */}
      {showCloseConfirmation && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 p-4 border-b border-gray-200">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><AlertCircle className="h-4 w-4 text-amber-500" /></div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Unsaved Changes</h3>
                <p className="text-[11px] mt-0.5 text-gray-500">You have unsaved questions that will be lost.</p>
              </div>
            </div>
            <div className="p-5">
              <p className="text-[11px] font-medium text-red-600 mb-4">Closing without saving will permanently discard all changes.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowCloseConfirmation(false)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-semibold">Keep Editing</button>
                <button onClick={() => { setShowCloseConfirmation(false); onClose(); }} className="flex-1 px-3 py-2 rounded-lg bg-orange-500 text-white text-xs font-semibold">Close & Discard</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showMockModal && <MockModal blocks={questionBlocks} onClose={() => setShowMockModal(false)} />}
      <PreviewModal isOpen={showPreviewModal} blocks={questionBlocks} onClose={() => setShowPreviewModal(false)}
        onEdit={(idx) => { goToIndex(idx); setShowPreviewModal(false); }}
        onDeleteFromPreview={handleDeleteFromPreview} />

      {showDifficultyMenu && <div className="fixed inset-0 z-40" onClick={() => setShowDifficultyMenu(false)} />}
      {showQTypeMenu && <div className="fixed inset-0 z-40" onClick={() => setShowQTypeMenu(false)} />}
    </div>
  );
};

export default CreateTestModal;