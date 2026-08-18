import { getToken } from "@/lib/session";
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ExerciseSettings from '../../ExerciseSettings';
import { QuestionApprovalBanner, RequestApproveButton, deriveApprovalContext } from '@/app/lms/component/QuestionApprovalBanner';

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

      /* ─── GLOBAL FONT OVERRIDES ─────────────────────────────────────────── */
      .lms-font { font-family: var(--lms-font) !important; }

      select option, select optgroup { color: #1a1a2e !important; background: white !important; }

      /* ─── UNDERLINE SELECT ──────────────────────────────────────────────── */
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

      /* ─── UNDERLINE INPUT ───────────────────────────────────────────────── */
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

      /* ─── SELECT WRAP ───────────────────────────────────────────────────── */
      .lms-select-wrap { position: relative; display: inline-flex; align-items: center; }
      .lms-select-wrap .chevron-icon {
        position: absolute; right: 2px; top: 50%; transform: translateY(-50%);
        pointer-events: none; color: var(--lms-text-hint); width: 13px; height: 13px;
      }

      /* ─── QUESTION TEXT EDITOR ──────────────────────────────────────────── */
      .lms-q-text-editor {
        font-size: 15px !important; font-weight: 500 !important;
        color: var(--lms-text-main) !important; line-height: 1.65 !important;
        caret-color: var(--lms-orange);
        font-family: var(--lms-font) !important;
      }

      /* ─── OPTION ROW ────────────────────────────────────────────────────── */
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
      .lms-option-input::placeholder { color: var(--lms-text-sec) !important; transition: color 0.15s; }
      .lms-option-input:focus::placeholder { color: var(--lms-text-hint) !important; }

      /* ─── ANSWER KEY BUTTON ─────────────────────────────────────────────── */
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
      .lms-answer-key-btn:hover .lms-answer-key-checkbox { background: var(--lms-info-bg); }

      /* ─── DIFF UNDERLINE BUTTON ─────────────────────────────────────────── */
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

      /* ─── DIFF DROPDOWN ─────────────────────────────────────────────────── */
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

      /* ─── SCORE UNDERLINE ───────────────────────────────────────────────── */
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
      .lms-btn-ai {
        background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
        color: white; border-color: transparent;
        box-shadow: 0 2px 8px rgba(124,58,237,0.25);
      }
      .lms-btn-ai:hover:not(:disabled) {
        box-shadow: 0 3px 12px rgba(124,58,237,0.4); transform: translateY(-1px);
      }
      .lms-btn-ai.disabled-ai {
        background: var(--lms-bg-surface2); color: var(--lms-text-hint);
        border-color: var(--lms-border); box-shadow: none;
        cursor: not-allowed; opacity: 0.7; transform: none !important;
      }
      .lms-btn-slate {
        background: var(--lms-bg-white); color: var(--lms-text-sec);
        border-color: var(--lms-border);
      }
      .lms-btn-slate:hover { background: var(--lms-bg-surface2); }

      /* Icon-only action buttons */
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

      /* Nav buttons */
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

      /* Save button */
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
        flex: 0 0 72px; padding: 8px 0; border-radius: var(--lms-radius-md);
        border: 1.5px solid var(--lms-border); background: var(--lms-bg-white);
        color: var(--lms-text-sec); font-family: var(--lms-font);
        font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.15s;
        text-align: center;
      }
      .lms-cancel-btn:hover { background: var(--lms-bg-surface2); }

      /* ─── ANSWER KEY MODE BUTTONS ───────────────────────────────────────── */
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
      .lms-ak-option-btn.neutral:hover { border-color: var(--lms-border-hover); background: var(--lms-bg-surface); }
      .lms-ak-done-btn {
        padding: 8px 22px; border-radius: var(--lms-radius-md);
        background: var(--lms-success); color: white; border: none;
        font-family: var(--lms-font); font-size: 13.5px; font-weight: 600;
        cursor: pointer; transition: background 0.15s;
      }
      .lms-ak-done-btn:hover { background: #15803d; }

      /* ─── SECTION LABEL ─────────────────────────────────────────────────── */
      .lms-section-label {
        font-size: 10.5px; font-weight: 700; color: var(--lms-text-hint);
        text-transform: uppercase; letter-spacing: 0.07em;
        font-family: var(--lms-font); margin-bottom: 8px;
      }

      /* ─── SIDEBAR ───────────────────────────────────────────────────────── */
      .lms-sidebar-section-title {
        display: flex; align-items: center; gap: 7px;
        font-size: 12px; font-weight: 700; color: var(--lms-text-main);
        margin-bottom: 10px; font-family: var(--lms-font);
      }

      .lms-marks-row {
        display: flex; align-items: center; justify-content: space-between; padding: 3.5px 0;
      }
      .lms-marks-label { font-size: 12.5px; font-weight: 600; color: var(--lms-text-sec); font-family: var(--lms-font); }
      .lms-marks-value { font-size: 12.5px; font-weight: 700; font-family: var(--lms-font); }

      .lms-progress-bar { height: 6px; background: var(--lms-bg-surface2); border-radius: 3px; overflow: hidden; margin-top: 8px; }
      .lms-progress-fill { height: 100%; border-radius: 3px; background: var(--lms-orange); transition: width 0.4s; }

      .lms-detail-row {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px; min-width: 0; padding: 3px 0;
      }
.lms-detail-label {
  font-size: 11.5px; font-weight: 600; color: var(--lms-text-sec);
  text-transform: none; letter-spacing: 0.01em; font-family: var(--lms-font);
}
.lms-detail-value { font-size: 12.5px; font-weight: 700; color: var(--lms-text-main); font-family: var(--lms-font); }
      /* ─── HEADER ────────────────────────────────────────────────────────── */
      .lms-header-logo-mark {
        width: 34px; height: 34px; background: var(--lms-orange);
        border-radius: 9px; display: flex; align-items: center;
        justify-content: center; flex-shrink: 0;
        box-shadow: 0 3px 10px var(--lms-orange-glow);
      }

      /* ─── BREADCRUMB ────────────────────────────────────────────────────── */
      .lms-breadcrumb-sep { color: var(--lms-orange); margin: 0 3px; font-weight: 700; font-size: 13px; }

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

      /* ─── TOGGLE SWITCH ─────────────────────────────────────────────────── */
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

      /* ─── FORMAT BUTTON ─────────────────────────────────────────────────── */
      .lms-fmt-btn {
        padding: 5px; border: none; background: none; cursor: pointer;
        color: var(--lms-text-muted); border-radius: 7px; transition: all 0.12s;
        display: flex; align-items: center; justify-content: center;
      }
      .lms-fmt-btn:hover { background: var(--lms-bg-surface2); color: var(--lms-text-main); }
      .lms-fmt-btn.active { background: var(--lms-orange-100); color: #c85a30; }

      /* ─── MISC ──────────────────────────────────────────────────────────── */
      input[type="checkbox"] { accent-color: var(--lms-orange); }
      input[type="number"]::-webkit-inner-spin-button,
      input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--lms-border); border-radius: 4px; }

      /* ─── TOOLTIP ───────────────────────────────────────────────────────── */
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
      .lms-tooltip-right::after { left: auto; right: 10px; transform: none; }

      /* ─── PREVIEW CARD ──────────────────────────────────────────────────── */
      .lms-preview-card {
        background: var(--lms-bg-white); border: 1.5px solid var(--lms-border);
        border-radius: var(--lms-radius-md); overflow: hidden;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .lms-preview-card.active {
        border-color: var(--lms-orange); box-shadow: 0 0 0 3px var(--lms-orange-light);
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
      .lms-modal-actions { display: flex; gap: 8px; padding-top: 12px; }

      @keyframes lms-slide-in-right {
        from { transform: translateX(110%); opacity: 0; }
        to   { transform: translateX(0);    opacity: 1; }
      }
      @keyframes lms-fade-in {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  };
})();

import {
  Plus, Trash2, AlertCircle, Loader, X, ChevronUp, ChevronDown, Sparkles,
  List, CheckSquare, AlignLeft, ChevronDown as ChevronDownIcon,
  Bold, Italic, Underline, Image, HelpCircle,
  ZoomIn, ZoomOut, Check, Hash, Save,
  BookOpen, Pencil, Type, ChevronLeft, ChevronRight,
  Info, Target, Award,
  Clock, FileText, BarChart3,
  Eye, Edit2, Database, CheckCircle2, Copy,
  ArrowUpDown, MoveVertical, Equal, Binary, ToggleLeft,
  MousePointerClick,
  Settings2,
  RotateCcw,
  GraduationCap,
  Code, Palette,
  CloudUpload,
  Grid3x3,
  CheckCircle,
  Layers
} from 'lucide-react';

import GenerateMCQAIQuestion, { GeneratedQuestion } from './GenerateMCQAIQuestion';
import QuestionBankSelector from './QuestionBankSelector';
import { parseQuestionsFile } from '@/app/lms/component/questionforms/parseQuestionsTxt';
import { exerciseApi } from '@/apiServices/exercise';
import { questionApi } from '@/apiServices/question';


// ─── CONTENT BLOCK TYPES ─────────────────────────────────────────────────────
type ContentBlockType = 'text' | 'code' | 'image';
interface ContentBlock {
  id: string;
  type: ContentBlockType;
  value?: string;          // text content or code
  url?: string;            // image src
  bgColor?: string;        // code block background
  language?: string;       // code language label
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
  id: string; dbId?: string; origin: 'db' | 'new'; isDirty?: boolean;
  type: QuestionType; questionText: string;
  questionImageUrl?: string; questionImageAlignment?: 'left' | 'center' | 'right'; questionImageSizePercent?: number;
  optionsPerRow?: 1 | 2 | 3 | 4; options: MCQOption[];
  matchingPairs?: MatchingPair[]; orderingItems?: OrderingItem[];
  trueFalseAnswer?: boolean | null; shortAnswer?: string;
  numericAnswer?: number | null; numericTolerance?: number | null;
  isRequired: boolean; hasOtherOption?: boolean; hasExplanation?: boolean; explanation?: string;
  questionContent?: ContentBlock[];
  title?: string; description?: string; score?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | '';
  timeLimit?: number; memoryLimit?: number; isActive?: boolean; sequence?: number;
  sampleInput?: string; sampleOutput?: string;
  // Question Source tag ('scratch-manual' | 'scratch-bank' | 'ai' | ...) —
  // persisted to the DB so per-source quota slices and the source badge work
  // for MCQ the same way they do for programming questions.
  source?: string | null;
  // Origin id of the Question Bank doc this block was imported from — null
  // for authored questions; persisted so duplicate imports can be rejected.
  bankQuestionId?: string | null;
}

interface MCQQuestionFormProps {
  breadcrumbs: any; exerciseData: any; tabType: string;
  initialData?: any; isEditing?: boolean;
  initialQuestionId?: string;          // ← ADD THIS
  // Bank-flow input: when the user picks questions from the Question Bank,
  // each is pre-loaded as a NEW (origin: 'new') block so the teacher reviews
  // and Save & Continues — nothing is silently inserted or skipped.
  initialBankQuestions?: any[];
  // Source tag the pre-loaded bank questions should be stamped with
  // ('scratch-bank' | 'scratch-manual' for doc imports | 'thirdParty').
  initialBankSource?: string;
  onClose: () => void; onSave: (questionData: any) => void;
  isSaving?: boolean; saveProgress?: number; saveMessage?: string;
  onEditExercise?: () => void;
  sectionData?: any;
  // Approval workflow integration — when set, the form shows a banner at the
  // top with the open query and an Approve button to mark it addressed.
  approval?: any;
  approvalContext?: { entityType: string; entityId: string; tabType: 'We_Do' | 'You_Do'; subcategory: string; exerciseId: string; questionId: string };
  onQueryResolved?: () => void;
}
// ─── TOAST ────────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: string; type: ToastType; title: string; message?: string; }

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;
  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    error: <AlertCircle className="h-4 w-4 text-red-500" />,
    warning: <AlertCircle className="h-4 w-4 text-amber-500" />,
    info: <Info className="h-4 w-4 text-orange-500" />,
  };
  const bars: Record<ToastType, string> = {
    success: 'bg-emerald-500', error: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-orange-500',
  };
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 360 }}>
      {toasts.map(t => (
        <div key={t.id}
          className="pointer-events-auto rounded-xl shadow-2xl overflow-hidden flex items-stretch"
          style={{ background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)', animation: 'lms-slide-in-right 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          <div className={`w-1 flex-shrink-0 ${bars[t.type]}`} />
          <div className="flex items-start gap-3 px-3 py-3 flex-1">
            <div className="flex-shrink-0 mt-0.5">{icons[t.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold leading-tight" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)' }}>{t.title}</p>
              {t.message && <p className="text-[11px] mt-0.5 leading-snug" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-sec)' }}>{t.message}</p>}
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

// ─── Mock Modal ───────────────────────────────────────────────────────────────
// ─── MOCK MODAL (STUDENT VIEW PREVIEW) ─────────────────────────────────────────
// ─── MOCK MODAL (STUDENT VIEW PREVIEW WITH INSTANT ANSWER CHECK) ─────────────────
const MockModal: React.FC<{
  blocks: QuestionBlock[];
  onClose: () => void;
}> = ({ blocks, onClose }) => {
  const OPTION_TYPES = ['multiple-choice', 'multiple-select', 'true-false', 'dropdown'];
  const mockBlocks = blocks.filter(b => OPTION_TYPES.includes(b.type) && b.options?.some(o => o.text.trim()));
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const block = mockBlocks[idx];

  // Calculate progress
  const answeredCount = mockBlocks.filter(b => {
    const sel = selected[b.id] || [];
    return sel.length > 0;
  }).length;
  const progressPct = mockBlocks.length > 0 ? (answeredCount / mockBlocks.length) * 100 : 0;

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

    // Auto-check answer immediately after selection
    // For multiple-select, only check if at least one option is selected
    if (!isMulti || newSelected.length > 0) {
      // Small delay to show selection then check answer
      setTimeout(() => {
        setRevealed(prev => ({ ...prev, [blockId]: true }));
      }, 100);
    }
  };

  const handleReset = (blockId: string) => {
    setSelected(prev => { const n = { ...prev }; delete n[blockId]; return n; });
    setRevealed(prev => { const n = { ...prev }; delete n[blockId]; return n; });
  };

  const handleSubmitQuiz = () => {
    setShowSubmitDialog(false);
    setQuizCompleted(true);
  };

  const handleJumpToQuestion = (jumpIdx: number) => {
    setIdx(jumpIdx);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  if (!block) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: 'rgba(26,26,46,0.55)', fontFamily: 'var(--lms-font)' }}>
        <div className="bg-white rounded-2xl p-8 text-center" style={{ border: '1px solid var(--lms-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--lms-text-sec)' }}>No option-based questions to preview.</p>
          <button onClick={onClose} className="mt-4 px-4 py-1.5 rounded-lg text-sm font-semibold"
            style={{ background: 'var(--lms-orange)', color: '#fff' }}>Close</button>
        </div>
      </div>
    );
  }

  if (quizCompleted) {
    const correctCount = mockBlocks.filter(b => {
      const sel = selected[b.id] || [];
      const correctIds = b.options.filter(o => o.isCorrect).map(o => o.id);
      return sel.length > 0 && correctIds.every(id => sel.includes(id)) && sel.every(id => correctIds.includes(id));
    }).length;
    const total = mockBlocks.length;

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: 'rgba(26,26,46,0.55)', fontFamily: 'var(--lms-font)' }}>
        <div className="bg-white rounded-2xl p-8 text-center max-w-md mx-4"
          style={{ border: '1px solid var(--lms-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center"
            style={{ background: 'var(--lms-orange-light)' }}>
            <Award className="h-10 w-10" style={{ color: 'var(--lms-orange)' }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--lms-text-main)' }}>Mock Test Complete!</h2>
          <p className="text-sm mb-2" style={{ color: 'var(--lms-text-sec)' }}>
            You got {correctCount} out of {total} correct.
          </p>
          <p className="text-xs mb-4" style={{ color: 'var(--lms-text-muted)' }}>
            {Math.round((correctCount / total) * 100)}% • {answeredCount} answered
          </p>
          <div className="w-full h-2 rounded-full mb-6 overflow-hidden" style={{ background: 'var(--lms-bg-surface2)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${(correctCount / total) * 100}%`, background: 'var(--lms-orange)' }} />
          </div>
          <button onClick={onClose}
            className="px-6 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'var(--lms-orange)', color: '#fff' }}>
            Return to Editor
          </button>
        </div>
      </div>
    );
  }

  const sel = selected[block.id] || [];
  const rev = revealed[block.id] || false;
  const correctIds = block.options.filter(o => o.isCorrect).map(o => o.id);
  const isCorrectAnswer = rev && sel.length > 0 && correctIds.every(id => sel.includes(id)) && sel.every(id => correctIds.includes(id));
  const isAnswered = sel.length > 0;
  const isLast = idx === mockBlocks.length - 1;

  // Design tokens
  const T = {
    orange: '#F27757',
    orangeDark: '#E0623F',
    orangeLight: 'rgba(242,119,87,0.08)',
    orangeMid: 'rgba(242,119,87,0.15)',
    textMain: '#1a1a2e',
    textSub: '#6b6b7e',
    textMuted: '#9b9bae',
    textHint: '#bcbccc',
    border: '#eaeaef',
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
  };

  const DIFF_CFG: Record<string, { text: string; bg: string; dot: string }> = {
    easy: { text: T.greenDark, bg: T.greenLight, dot: T.green },
    medium: { text: '#b45309', bg: T.amberLight, dot: T.amber },
    hard: { text: '#dc2626', bg: T.redLight, dot: T.red },
  };

  const QTYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
    'multiple-choice': { label: 'Single Choice', color: T.blue, bg: T.blueLight },
    'multiple-select': { label: 'Multi Select', color: T.purple, bg: T.purpleLight },
    'true-false': { label: 'True / False', color: T.green, bg: T.greenLight },
    dropdown: { label: 'Dropdown', color: T.orange, bg: T.orangeLight },
  };

  const diff = DIFF_CFG[block.difficulty || ''] || { text: T.orange, bg: T.orangeLight, dot: T.orange };
  const qtype = QTYPE_CFG[block.type] || { label: block.type, color: T.textMuted, bg: T.pageBg };
  const isMultiSelect = block.type === 'multiple-select';
  const isDropdown = block.type === 'dropdown';
  const isTrueFalse = block.type === 'true-false';

  // Filtered indices for question panel
  const filteredIndices = mockBlocks.map((_, i) => i);
  const isAnsweredForSidebar = (bIdx: number) => {
    const b = mockBlocks[bIdx];
    const s = selected[b.id] || [];
    return s.length > 0;
  };

  // Check if question is correct for sidebar indicator
  const isCorrectForSidebar = (bIdx: number) => {
    const b = mockBlocks[bIdx];
    const s = selected[b.id] || [];
    const corrects = b.options.filter(o => o.isCorrect).map(o => o.id);
    return s.length > 0 && corrects.every(id => s.includes(id)) && s.every(id => corrects.includes(id));
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: T.pageBg, fontFamily: 'var(--lms-font)' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.45;}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:translateY(0);}}
        .mock-fade{animation:fadeIn 0.2s ease;}
        .mock-scroll::-webkit-scrollbar{width:5px;}
        .mock-scroll::-webkit-scrollbar-track{background:#e4e4ed;border-radius:99px;}
        .mock-scroll::-webkit-scrollbar-thumb{background:#9b9bae;border-radius:99px;}
      `}</style>

      {(() => {
        // Auto-derive approval state + context from props + initialData when
        // the parent didn't pass them explicitly. This makes the banner show
        // automatically when a trainer opens a queried question.
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

      {/* Submit Confirmation Dialog */}
      {showSubmitDialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden"
            style={{ border: `1.5px solid ${T.border}` }}>
            <div className="p-6 border-b" style={{ borderBottomColor: T.border }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: T.orangeLight }}>
                  <AlertCircle className="h-5 w-5" style={{ color: T.orange }} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: T.textMain }}>Submit Mock Test?</h3>
                  <p className="text-xs mt-0.5" style={{ color: T.textMuted }}>
                    You've answered {answeredCount} out of {mockBlocks.length} questions.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 flex gap-3">
              <button onClick={() => setShowSubmitDialog(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ border: `1.5px solid ${T.border}`, background: 'transparent', color: T.textSub }}>
                Keep Reviewing
              </button>
              <button onClick={handleSubmitQuiz}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                style={{ background: T.orange, border: 'none' }}>
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{ borderBottom: `1.5px solid ${T.border}`, background: T.bg }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${T.orange}, ${T.orangeDark})`, boxShadow: `0 3px 10px ${T.orangeLight}` }}>
            <Eye className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: T.textMain }}>Mock Test Preview</p>
            <p className="text-[10px]" style={{ color: T.textMuted }}>Select an answer to check immediately</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: T.pageBg }}>
            <span className="text-xs font-semibold" style={{ color: T.textSub }}>Progress</span>
            <span className="text-xs font-bold" style={{ color: T.orange }}>{answeredCount}/{mockBlocks.length}</span>
            <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: T.border }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progressPct}%`, background: T.orange }} />
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" style={{ color: T.textMuted }} />
          </button>
        </div>
      </div>

      {/* Progress bar under header */}
      <div style={{ height: 2, background: T.border }}>
        <div style={{ height: '100%', width: `${progressPct}%`, background: T.orange, transition: 'width 0.3s' }} />
      </div>

      {/* Main Body */}
      <div className="flex-1 min-h-0 flex">

        {/* Left: Question content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Question meta bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-3"
            style={{ borderBottom: `1px solid ${T.border}`, background: T.bg }}>
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-0.5">
                <span className="text-xs font-bold" style={{ color: T.textHint }}>Q</span>
                <span className="text-2xl font-black" style={{ color: T.orange, lineHeight: 1 }}>{idx + 1}</span>
                <span className="text-xs" style={{ color: T.textHint }}>/{mockBlocks.length}</span>
              </div>
              <div className="w-px h-5" style={{ background: T.border }} />
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: diff.bg }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: diff.dot }} />
                <span className="text-[10px] font-semibold capitalize" style={{ color: diff.text }}>{block.difficulty || 'Not set'}</span>
              </div>
              <div className="px-2 py-1 rounded-full" style={{ background: qtype.bg }}>
                <span className="text-[10px] font-semibold" style={{ color: qtype.color }}>{qtype.label}</span>
              </div>
              {block.score && block.score > 0 && (
                <div className="px-2 py-1 rounded-full" style={{ background: T.amberLight }}>
                  <span className="text-[10px] font-semibold" style={{ color: T.amber }}>{block.score} pts</span>
                </div>
              )}
            </div>
            {rev && (
              <button onClick={() => handleReset(block.id)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1"
                style={{ background: T.orangeLight, color: T.orange, border: `1px solid ${T.orange}30` }}>
                <RotateCcw className="h-3 w-3" /> Try Again
              </button>
            )}
          </div>

          {/* Scrollable question content */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 mock-scroll">
            {/* Question title + content blocks */}
            {(() => {
              const content = block.questionContent;
              if (!content || !Array.isArray(content) || content.length === 0) {
                return (
                  <div
                    className="text-base font-semibold leading-relaxed mb-4"
                    style={{ color: T.textMain }}
                    dangerouslySetInnerHTML={{ __html: block.questionText || '<p>Question</p>' }}
                  />
                );
              }
              return (
                <div className="space-y-3 mb-4">
                  {content.map((cb: ContentBlock, ci: number) => {
                    if (cb.type === 'text') {
                      if (!cb.value?.replace(/<[^>]*>/g, '').trim()) return null;
                      return (
                        <div key={ci}
                          className="text-base font-semibold leading-relaxed [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                          style={{ color: T.textMain }}
                          dangerouslySetInnerHTML={{ __html: cb.value }}
                        />
                      );
                    }
                    if (cb.type === 'code') {
                      const cbBg = cb.bgColor || '#f5f5f5';
                      const cbIsDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(cbBg);
                      const cbText = cbIsDark ? '#d4d4d4' : '#1a1a2e';
                      return (
                        <div key={ci} style={{ borderRadius: 8, overflow: 'hidden', border: `1.5px solid ${cbIsDark ? '#3a3a3a' : '#e2e2e2'}`, margin: '4px 0' }}>
                          <pre style={{
                            margin: 0, padding: '10px 14px', fontSize: 13, lineHeight: 1.7,
                            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                            color: cbText, whiteSpace: 'pre', display: 'block',
                            background: cbBg, overflowX: 'auto',
                          }}
                            dangerouslySetInnerHTML={{ __html: (window as any).highlightAuto?.(cb.value || '', cbBg) || cb.value || '' }}
                          />
                        </div>
                      );
                    }
                    if (cb.type === 'image' && cb.url) {
                      const justify = cb.alignment === 'left' ? 'flex-start' : cb.alignment === 'right' ? 'flex-end' : 'center';
                      return (
                        <div key={ci} style={{ display: 'flex', justifyContent: justify, margin: '4px 0' }}>
                          <img src={cb.url} alt=""
                            style={{ width: `${cb.sizePercent || 60}%`, height: 'auto', borderRadius: 6, border: `1.5px solid ${T.border}` }}
                          />
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              );
            })()}

            {/* Legacy question image */}
            {block.questionImageUrl && (
              <img src={block.questionImageUrl} alt="" className="mb-4 rounded-xl max-h-48 object-contain"
                style={{ border: `1.5px solid ${T.border}` }} />
            )}

            {/* Hint text */}
            <p className="text-xs mb-4 flex items-center gap-1.5" style={{ color: T.textHint }}>
              <HelpCircle className="h-3 w-3" />
              {isTrueFalse ? 'Click to select your answer — correct answer will be shown immediately.' :
                isMultiSelect ? 'Select all that apply — answer will be checked immediately.' :
                  isDropdown ? 'Select from the dropdown — correct answer will be shown.' :
                    'Click on an option to select — correct answer will be shown immediately.'}
            </p>

            {/* Options */}
            <div className="space-y-2.5">
              {block.options.filter(o => o.text.trim()).map((opt, optIdx) => {
                const isSelected = sel.includes(opt.id);
                const isCorrect = opt.isCorrect;
                let bg = T.bg;
                let border = T.border;
                let textColor = T.textMain;
                let badge: React.ReactNode = null;

                if (rev) {
                  if (isCorrect) {
                    bg = T.greenLight;
                    border = T.green;
                    textColor = T.greenDark;
                    badge = (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: T.greenLight, color: T.greenDark }}>
                        <Check className="h-2.5 w-2.5" /> Correct
                      </span>
                    );
                  }
                  else if (isSelected && !isCorrect) {
                    bg = T.redLight;
                    border = T.red;
                    textColor = T.red;
                    badge = (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: T.redLight, color: T.red }}>
                        <X className="h-2.5 w-2.5" /> Wrong
                      </span>
                    );
                  }
                  else if (isCorrect && !isSelected) {
                    // Show correct answer even if not selected
                    bg = T.greenLight;
                    border = T.green;
                    textColor = T.greenDark;
                    badge = (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: T.greenLight, color: T.greenDark }}>
                        <Check className="h-2.5 w-2.5" /> Correct Answer
                      </span>
                    );
                  }
                } else if (isSelected) {
                  bg = T.orangeLight;
                  border = T.orange;
                  textColor = T.orange;
                }

                const letter = String.fromCharCode(65 + optIdx);

                if (isTrueFalse) {
                  const val = opt.text.toLowerCase() === 'true';
                  return (
                    <button key={opt.id} type="button"
                      onClick={() => handleSelect(block.id, opt.id)}
                      disabled={rev}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                      style={{ background: bg, border: `1.5px solid ${border}`, cursor: rev ? 'default' : 'pointer' }}>
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: rev && isCorrect ? T.green : rev && isSelected && !isCorrect ? T.red : isSelected ? T.orange : T.border, background: isSelected && !rev ? T.orange : rev && isCorrect ? T.green : 'transparent' }}>
                        {(isSelected || (rev && isCorrect)) && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-sm font-medium flex-1" style={{ color: textColor }}>{opt.text}</span>
                      {badge}
                    </button>
                  );
                }

                if (isDropdown) {
                  return (
                    <button key={opt.id} type="button"
                      onClick={() => handleSelect(block.id, opt.id)}
                      disabled={rev}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                      style={{ background: bg, border: `1.5px solid ${border}`, cursor: rev ? 'default' : 'pointer' }}>
                      <span className="text-xs font-bold w-5 flex-shrink-0" style={{ color: isSelected ? T.orange : T.textMuted }}>{letter}.</span>
                      {opt.imageUrl && <img src={opt.imageUrl} alt="" className="h-8 w-8 object-cover rounded-lg flex-shrink-0" />}
                      <span className="text-sm font-medium flex-1" style={{ color: textColor }}>{opt.text}</span>
                      {badge}
                    </button>
                  );
                }

                return (
                  <button key={opt.id} type="button"
                    onClick={() => handleSelect(block.id, opt.id)}
                    disabled={rev}
                    className="w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all"
                    style={{ background: bg, border: `1.5px solid ${border}`, cursor: rev ? 'default' : 'pointer' }}>
                    {isMultiSelect ? (
                      <div className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ borderColor: isSelected ? T.purple : T.border, background: isSelected ? T.purple : 'transparent' }}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ borderColor: isSelected ? T.orange : T.border, background: isSelected ? T.orange : 'transparent' }}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold" style={{ color: isSelected ? (isMultiSelect ? T.purple : T.orange) : T.textMuted }}>{letter}.</span>
                        <span className="text-sm font-medium" style={{ color: textColor }}>{opt.text}</span>
                        {badge}
                      </div>
                      {opt.imageUrl && (
                        <img src={opt.imageUrl} alt="" className="mt-2 h-24 object-cover rounded-lg"
                          style={{ border: `1px solid ${T.border}` }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Result banner */}
            {rev && (
              <div className="mt-6 px-4 py-3 rounded-xl flex items-center gap-2"
                style={{ background: isCorrectAnswer ? T.greenLight : T.redLight, border: `1.5px solid ${isCorrectAnswer ? T.green : T.red}` }}>
                {isCorrectAnswer
                  ? (
                    <>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: T.green }}>
                        <Check className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <span className="text-sm font-bold" style={{ color: T.green }}>Correct!</span>
                        <p className="text-xs mt-0.5" style={{ color: T.greenDark }}>Great job! Your answer is correct.</p>
                      </div>
                    </>
                  )
                  : (
                    <>
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: T.red }}>
                        <X className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <span className="text-sm font-bold" style={{ color: T.red }}>Incorrect</span>
                        <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                          The correct answer{correctIds.length > 1 ? 's are' : ' is'} highlighted in green.
                        </p>
                      </div>
                    </>
                  )}
              </div>
            )}

            {/* Explanation if available */}
            {rev && block.hasExplanation && block.explanation && (
              <div className="mt-4 px-4 py-3 rounded-xl" style={{ background: T.blueLight, border: `1.5px solid ${T.blue}30` }}>
                <div className="flex items-center gap-2 mb-1">
                  <Info className="h-3.5 w-3.5" style={{ color: T.blue }} />
                  <span className="text-xs font-bold" style={{ color: T.blue }}>Explanation</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: T.textSub }} dangerouslySetInnerHTML={{ __html: block.explanation }} />
              </div>
            )}

            <div className="h-4" />
          </div>
        </div>

        {/* Right: Question panel */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border-l mock-scroll"
          style={{ borderLeftColor: T.border, background: T.bg, padding: '16px 12px' }}>
          <div className="flex items-center justify-between mb-4 pb-2 border-b" style={{ borderBottomColor: T.borderLight }}>
            <div className="flex items-center gap-2">
              <Grid3x3 className="h-3.5 w-3.5" style={{ color: T.orange }} />
              <span className="text-xs font-bold" style={{ color: T.textMain }}>Questions</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: T.orangeLight, color: T.orange }}>{answeredCount}/{mockBlocks.length}</span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {mockBlocks.map((b, i) => {
              const isCurrent = i === idx;
              const isAnsweredFor = isAnsweredForSidebar(i);
              const isCorrectFor = isCorrectForSidebar(i);
              const isRevealedFor = revealed[b.id] || false;

              let bg = T.bg;
              let color = T.textSub;
              let border = T.border;

              if (isCurrent) {
                bg = T.orange;
                color = '#fff';
                border = T.orange;
              } else if (isRevealedFor && isCorrectFor) {
                bg = T.greenLight;
                color = T.greenDark;
                border = T.green;
              } else if (isRevealedFor && !isCorrectFor) {
                bg = T.redLight;
                color = T.red;
                border = T.red;
              } else if (isAnsweredFor) {
                bg = T.orangeLight;
                color = T.orange;
                border = T.orange + '80';
              }

              return (
                <button key={b.id} onClick={() => handleJumpToQuestion(i)}
                  className="relative aspect-square rounded-lg text-xs font-bold transition-all flex items-center justify-center"
                  style={{ background: bg, color, border: `1.5px solid ${border}`, cursor: 'pointer' }}>
                  {i + 1}
                  {isRevealedFor && isCorrectFor && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center" style={{ background: T.green }}>
                      <Check className="h-2 w-2 text-white" />
                    </span>
                  )}
                  {isRevealedFor && !isCorrectFor && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center" style={{ background: T.red }}>
                      <X className="h-2 w-2 text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-5 pt-3 border-t" style={{ borderTopColor: T.borderLight }}>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: T.orange }} /><span style={{ color: T.textSub }}>Current</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: T.green }} /><span style={{ color: T.textSub }}>Correct</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: T.red }} /><span style={{ color: T.textSub }}>Incorrect</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ background: T.orangeLight }} /><span style={{ color: T.textSub }}>Answered</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3"
        style={{ borderTop: `1.5px solid ${T.border}`, background: T.bg }}>
        <button onClick={() => { setIdx(i => Math.max(0, i - 1)); if (scrollRef.current) scrollRef.current.scrollTop = 0; }} disabled={idx === 0}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
          style={{ border: `1.5px solid ${T.border}`, color: T.textSub, background: T.bg }}>
          <ChevronLeft className="h-3.5 w-3.5" /> Previous
        </button>

        <div className="flex items-center gap-1">
          {filteredIndices.slice(Math.max(0, idx - 4), Math.min(mockBlocks.length, idx + 5)).map((i) => {
            const isCurr = i === idx;
            const isDone = isAnsweredForSidebar(i);
            const isCorrectForDot = isCorrectForSidebar(i);
            let dotColor = T.border;
            if (isCurr) dotColor = T.orange;
            else if (isDone) dotColor = isCorrectForDot ? T.green : T.orange;

            return (
              <button key={i} onClick={() => handleJumpToQuestion(i)}
                style={{ width: isCurr ? 20 : 6, height: 6, borderRadius: 99, background: dotColor, transition: 'all 0.2s' }} />
            );
          })}
        </div>

        {!isLast ? (
          <button onClick={() => { setIdx(i => Math.min(mockBlocks.length - 1, i + 1)); if (scrollRef.current) scrollRef.current.scrollTop = 0; }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: T.orange, color: '#fff', border: 'none' }}>
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button onClick={() => setShowSubmitDialog(true)} disabled={answeredCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: answeredCount === 0 ? T.border : T.green, color: answeredCount === 0 ? T.textHint : '#fff', border: 'none', cursor: answeredCount === 0 ? 'not-allowed' : 'pointer' }}>
            <CheckCircle className="h-3.5 w-3.5" /> Finish
          </button>
        )}
      </div>
    </div>
  );
};

const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = (id: string) => setToasts(p => p.filter(t => t.id !== id));
  const add = (type: ToastType, title: string, message?: string, duration = 3500) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(p => [...p, { id, type, title, message }]);
    setTimeout(() => remove(id), duration);
  };
  return {
    toasts, remove,
    success: (title: string, message?: string) => add('success', title, message),
    error: (title: string, message?: string) => add('error', title, message),
    warning: (title: string, message?: string) => add('warning', title, message),
    info: (title: string, message?: string) => add('info', title, message),
  };
};

// ─── Image Upload Modal ───────────────────────────────────────────────────────
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

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <span className="text-sm font-bold" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>Insert Image</span>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" style={{ color: 'var(--lms-text-muted)' }} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-5 px-5 border-b" style={{ borderColor: 'var(--lms-border)' }}>
          <button type="button" style={TAB_STYLE(tab === 'upload')} onClick={() => { setTab('upload'); setError(''); }}>
            Upload
          </button>
          <button type="button" style={TAB_STYLE(tab === 'url')} onClick={() => { setTab('url'); setUrlError(''); }}>
            By URL
          </button>
        </div>

        {/* Tab content */}
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getStorageKey = (exerciseId?: string) =>
  exerciseId ? `mcq_question_form_draft_${exerciseId}` : null;

const getMaxMcqMarks = (exerciseData: any): number => {
  const fullData = exerciseData?.fullExerciseData;
  const exerciseType = (fullData?.exerciseType || exerciseData?.exerciseType || '').toLowerCase();
  const info = fullData?.exerciseInformation || fullData?.exerciseInfo || {};
  if (exerciseType.includes('combined')) return Number(info.totalMarksMCQ ?? info.totalMcqMarks ?? 0);
  return Number(info.totalMarks ?? info.totalMcqMarks ?? 0);
};

function mapApiTypeToInternal(t: string): QuestionType {
  return ({
    multiple_choice: 'multiple-choice', multiple_select: 'multiple-select',
    true_false: 'true-false', checkboxes: 'multiple-select', dropdown: 'dropdown',
    short_answer: 'short-answer', essay: 'paragraph', matching: 'matching',
    ordering: 'ordering', numeric: 'numeric',
  } as any)[t] || 'multiple-choice';
}

const mapInternalTypeToApi = (t: QuestionType) =>
({
  'multiple-choice': 'multiple_choice', 'multiple-select': 'multiple_select',
  'true-false': 'true_false', dropdown: 'dropdown', 'short-answer': 'short_answer',
  paragraph: 'essay', matching: 'matching', ordering: 'ordering', numeric: 'numeric',
}[t] || 'multiple_choice');

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const diffConfig = {
  '': { label: 'Difficulty', dot: '#bcbccc', color: 'var(--lms-text-hint)', border: 'var(--lms-border)' },
  easy: { label: 'Easy', dot: '#16a34a', color: '#16a34a', border: '#bbf7d0' },
  medium: { label: 'Medium', dot: '#d97706', color: '#d97706', border: '#fde68a' },
  hard: { label: 'Hard', dot: '#e53e3e', color: '#e53e3e', border: '#fed7d7' },
};

const typeConfig: Record<string, { label: string; icon: React.ReactNode; color: string; apiType: string }> = {
  'multiple-choice': { label: 'Multiple Choice', icon: <List className="h-3.5 w-3.5" />, color: '#7c3aed', apiType: 'multiple_choice' },
  'multiple-select': { label: 'Multiple Select', icon: <CheckSquare className="h-3.5 w-3.5" />, color: '#2563eb', apiType: 'multiple_select' },
  'true-false': { label: 'True / False', icon: <ToggleLeft className="h-3.5 w-3.5" />, color: '#0d9488', apiType: 'true_false' },
  'short-answer': { label: 'Short Answer', icon: <AlignLeft className="h-3.5 w-3.5" />, color: '#ea580c', apiType: 'short_answer' },
  paragraph: { label: 'Essay', icon: <BookOpen className="h-3.5 w-3.5" />, color: '#db2777', apiType: 'essay' },
  matching: { label: 'Matching', icon: <Equal className="h-3.5 w-3.5" />, color: '#4f46e5', apiType: 'matching' },
  ordering: { label: 'Ordering / Sequence', icon: <MoveVertical className="h-3.5 w-3.5" />, color: '#0891b2', apiType: 'ordering' },
  numeric: { label: 'Numeric', icon: <Binary className="h-3.5 w-3.5" />, color: '#e11d48', apiType: 'numeric' },
  dropdown: { label: 'Dropdown', icon: <ChevronDownIcon className="h-3.5 w-3.5" />, color: '#374151', apiType: 'dropdown' },
};

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
const QuestionFormBreadcrumb: React.FC<{
  breadcrumbs: any[]; tabType: string; exerciseName?: string; actionLabel: string; questionLabel: string;
}> = ({ breadcrumbs, tabType, exerciseName, actionLabel, questionLabel }) => (
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
          {questionLabel && <span className="ml-1.5 font-normal" style={{ color: 'var(--lms-text-muted)' }}>· {questionLabel}</span>}
        </span>
      </li>
    </ol>
  </nav>
);

// ─── MODAL PRIMITIVES ──────────────────────────────────────────────────────────
const SmallModal: React.FC<{
  icon: React.ReactNode; iconBg: string; title: string; children: React.ReactNode;
}> = ({ icon, iconBg, title, children }) => (
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

const ModalActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="lms-modal-actions">{children}</div>
);

const BtnPrimary: React.FC<{ onClick: () => void; disabled?: boolean; className?: string; children: React.ReactNode; }> = ({ onClick, disabled, className = '', children }) => (
  <button onClick={onClick} disabled={disabled}
    className={`lms-btn lms-btn-orange flex-1 justify-center ${className}`}>
    {children}
  </button>
);

const BtnSecondary: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode; }> = ({ onClick, disabled, children }) => (
  <button onClick={onClick} disabled={disabled}
    className="lms-cancel-btn flex-1" style={{ flex: 1 }}>
    {children}
  </button>
);

// ─── DELETE CONFIRMATION DIALOG ───────────────────────────────────────────────
const DeleteConfirmationDialog: React.FC<{
  isOpen: boolean; questionTitle: string;
  onConfirm: () => void; onCancel: () => void; isDeleting?: boolean;
}> = ({ isOpen, questionTitle, onConfirm, onCancel, isDeleting }) => {
  if (!isOpen) return null;
  return (
    <SmallModal icon={<Trash2 className="h-4 w-4 text-red-600" />} iconBg="bg-red-50" title="Delete Question">
      <p className="text-xs font-medium mb-1" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>Are you sure you want to delete this question?</p>
      <p className="text-[11px] mb-3 px-3 py-2 rounded-lg line-clamp-2"
        style={{ background: 'var(--lms-bg-surface)', border: '1.5px solid var(--lms-border)', color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
        {questionTitle || 'Untitled question'}
      </p>
      <p className="text-[11px] font-medium mb-1" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
        This action cannot be undone.
      </p>
      <ModalActions>
        <BtnSecondary onClick={onCancel} disabled={isDeleting}>Cancel</BtnSecondary>
        <BtnPrimary onClick={onConfirm} disabled={isDeleting} className="bg-red-500 hover:bg-red-600" style={{ background: 'var(--lms-danger)' }}>
          {isDeleting ? <><Loader className="h-3.5 w-3.5 animate-spin" />Deleting…</> : <><Trash2 className="h-3.5 w-3.5" />Yes, Delete</>}
        </BtnPrimary>
      </ModalActions>
    </SmallModal>
  );
};

// ─── CLOSE CONFIRMATION DIALOG ─────────────────────────────────────────────────
const ConfirmationDialog: React.FC<{
  isOpen: boolean; onConfirm: () => void; onCancel: () => void; newCount: number; dirtyCount: number;
}> = ({ isOpen, onConfirm, onCancel, newCount, dirtyCount }) => {
  if (!isOpen) return null;
  const rows = [
    newCount > 0 && { icon: '✦', bg: 'var(--lms-info-bg)', border: 'var(--lms-info-bdr)', color: 'var(--lms-info)', label: newCount === 1 ? '1 new question not yet saved' : `${newCount} new questions not yet saved` },
    dirtyCount > 0 && { icon: '✎', bg: 'var(--lms-warning-bg)', border: 'var(--lms-warning-bdr)', color: 'var(--lms-warning)', label: dirtyCount === 1 ? '1 edited question with unsaved changes' : `${dirtyCount} edited questions with unsaved changes` },
  ].filter(Boolean) as any[];
  return (
    <div className="lms-modal-backdrop">
      <div className="lms-modal" style={{ maxWidth: 420 }}>
        <div className="lms-modal-header">
          <div className="lms-modal-icon" style={{ background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)' }}>
            <AlertCircle className="h-4.5 w-4.5 text-amber-500" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)' }}>Unsaved Questions</h3>
            <p className="text-[11px] mt-0.5" style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-muted)' }}>These will be lost if you close now</p>
          </div>
        </div>
        <div className="lms-modal-body space-y-2.5">
          {rows.map((row: any, i: number) => (
            <div key={i} className="flex items-center gap-3 px-3.5 py-3 rounded-xl"
              style={{ background: row.bg, border: `1.5px solid ${row.border}` }}>
              <span className="text-sm font-black" style={{ color: row.color }}>{row.icon}</span>
              <p className="text-[12px] font-semibold" style={{ color: row.color, fontFamily: 'var(--lms-font)' }}>{row.label}</p>
            </div>
          ))}
          <div className="flex items-start gap-2 px-1">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: 'var(--lms-danger)' }} />
            <p className="text-[11px] font-medium" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
              Closing without saving will permanently discard all changes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-5 pb-5">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all lms-btn lms-btn-slate justify-center">
            Keep Editing
          </button>
          <button onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 lms-btn lms-btn-orange">
            <X className="h-3.5 w-3.5" />Close & Discard
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── RICH TEXT EDITOR ──────────────────────────────────────────────────────────
const RichTextEditor: React.FC<{
  value: string; onChange: (v: string) => void; placeholder?: string;
  className?: string; compact?: boolean; editorRef?: React.RefObject<HTMLDivElement>;
}> = ({ value, onChange, placeholder, className = '', compact = false, editorRef: externalRef }) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const editorRef = externalRef || internalRef;
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

// ─── IMAGE TOOLBAR ─────────────────────────────────────────────────────────────
const ImageToolbar: React.FC<{
  alignment: 'left' | 'center' | 'right'; sizePercent: number;
  onAlignmentChange: (a: 'left' | 'center' | 'right') => void;
  onSizeChange: (v: number) => void; onRemove: () => void; onClose: () => void;
}> = ({ alignment, sizePercent, onAlignmentChange, onSizeChange, onRemove, onClose }) => (
  <div className="absolute bottom-[-52px] left-1/2 -translate-x-1/2 z-50 rounded-xl overflow-hidden flex items-stretch divide-x"
    style={{
      minWidth: 260, background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)',
      boxShadow: 'var(--lms-shadow-md)', divideColor: 'var(--lms-border)'
    }}>
    <div className="flex flex-col items-center justify-center px-3 py-2 gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--lms-text-hint)' }}>Align</span>
      <div className="flex gap-0.5">
        {(['left', 'center', 'right'] as const).map(a => (
          <button key={a} onClick={() => onAlignmentChange(a)}
            className="w-6 h-6 rounded-md text-[10px] font-bold transition-all"
            style={{
              background: alignment === a ? 'var(--lms-orange)' : 'var(--lms-bg-surface)',
              color: alignment === a ? 'white' : 'var(--lms-text-muted)',
            }}>
            {a[0].toUpperCase()}
          </button>
        ))}
      </div>
    </div>
    <div className="flex flex-col justify-center px-3 py-2 gap-1 flex-1">
      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--lms-text-hint)' }}>Size {sizePercent}%</span>
      <div className="flex items-center gap-1.5">
        <ZoomOut className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
        <input type="range" min={10} max={100} step={5} value={sizePercent}
          onChange={e => onSizeChange(parseInt(e.target.value))}
          className="flex-1 h-1.5 cursor-pointer" style={{ accentColor: 'var(--lms-orange)' }} />
        <ZoomIn className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
      </div>
    </div>
    <div className="flex items-center gap-0.5 px-2 py-2">
      <button onClick={onRemove} className="p-1.5 rounded-lg transition-colors hover:bg-red-50" style={{ color: 'var(--lms-text-hint)' }}>
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--lms-text-hint)' }}>
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);



// ─── CONTENT BLOCK RENDERER (for preview) ────────────────────────────────────
const PreviewContentBlocks: React.FC<{ block: QuestionBlock }> = ({ block }) => {
  const content = block.questionContent;
  if (!content || !Array.isArray(content) || content.length === 0) {
    const plain = block.questionText.replace(/<[^>]*>/g, '').trim();
    return <span>{plain || <span style={{ color: 'var(--lms-text-hint)' }} className="italic font-normal">Untitled question</span>}</span>;
  }
  return (
    <div className="space-y-1.5">
      {content.map((cb: ContentBlock, i: number) => {
        if (cb.type === 'text') {
          if (!cb.value) return null;
          const plain = cb.value.replace(/<[^>]*>/g, '').trim();
          if (!plain) return null;
          return (
            <div key={i}
              className="text-[13px] font-semibold leading-snug [&_strong]:font-bold [&_em]:italic [&_u]:underline"
              style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}
              dangerouslySetInnerHTML={{ __html: cb.value }}
            />
          );
        }
        if (cb.type === 'code') {
          const cbBg = cb.bgColor || '#f5f5f5';
          const cbIsDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(cbBg);
          const cbText = cbIsDark ? '#d4d4d4' : '#1a1a2e';
          const cbWidth = (cb as any).width;
          const cbHeight = (cb as any).height;
          return (
            <div
              key={i}
              style={{
                display: 'inline-block',
                minWidth: 120,
                maxWidth: '70vw',
                borderRadius: 8,
                overflow: 'visible',
                border: `1.5px solid ${cbIsDark ? '#3a3a3a' : '#e2e2e2'}`,
                margin: '4px 0',
                width: cbWidth ? `${cbWidth}px` : undefined,
              }}
            >
              <pre
                style={{
                  margin: 0,
                  padding: '10px 14px',
                  fontSize: 13,
                  lineHeight: 1.7,
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  color: cbText,
                  whiteSpace: 'pre',
                  display: 'block',
                  width: cbWidth ? `${cbWidth}px` : undefined,
                  height: cbHeight ? `${cbHeight}px` : undefined,
                  minWidth: 120,
                  background: cbBg,
                  overflowX: 'auto',
                }}
                dangerouslySetInnerHTML={{ __html: highlightAuto(cb.value || '', cbBg) }}
              />
            </div>
          );
        }
        if (cb.type === 'image' && cb.url) {
          const justify = cb.alignment === 'left' ? 'flex-start' : cb.alignment === 'right' ? 'flex-end' : 'center';
          return (
            <div key={i} style={{ display: 'flex', justifyContent: justify }}>
              <img src={cb.url} alt=""
                style={{
                  width: `${cb.sizePercent || 60}%`, height: 'auto',
                  borderRadius: 6, border: '1.5px solid var(--lms-border)', display: 'block',
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
// ─── PREVIEW QUESTION CARD ─────────────────────────────────────────────────────
const PreviewQuestionCard: React.FC<{
  block: QuestionBlock; globalIndex: number; isActive: boolean;
  onEdit: () => void; onDelete: () => void;
  scoringType: string; marksPerQuestion: number;
  isDeleting?: boolean; totalBlocks: number;
}> = ({ block, globalIndex, isActive, onEdit, onDelete, scoringType, marksPerQuestion, isDeleting, totalBlocks }) => {
  const [expanded, setExpanded] = useState(false);
  const plainText = block.questionText.replace(/<[^>]*>/g, '').trim();
  const diff = diffConfig[block.difficulty || ''];
  const qtype = typeConfig[block.type] || null;
  const score = scoringType === 'equalDistribution' ? marksPerQuestion : (block.score || 0);

  const renderExpandedContent = () => {
    const type = block.type;

    if (['multiple-choice', 'multiple-select', 'dropdown'].includes(type) && block.options.length > 0) {
      const isMultiSelect = type === 'multiple-select';
      return (
        <div className="px-4 pt-3 pb-2 space-y-1.5">
          <p className="lms-section-label">Answer Options</p>
          {block.options.map((opt, oi) => (
            <div key={opt.id || oi} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px]"
              style={{
                background: opt.isCorrect ? 'var(--lms-success-bg)' : 'var(--lms-bg-white)',
                border: `1.5px solid ${opt.isCorrect ? 'var(--lms-success-bdr)' : 'var(--lms-border)'}`,
                color: opt.isCorrect ? '#14532d' : 'var(--lms-text-sec)',
                fontFamily: 'var(--lms-font)',
              }}>
              {isMultiSelect ? (
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
              <span className={`flex-1 ${opt.isCorrect ? 'font-semibold' : ''}`}>
                {opt.text || <span className="italic" style={{ color: 'var(--lms-text-hint)' }}>Empty option</span>}
              </span>
              {opt.isCorrect && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ color: 'var(--lms-success)', background: 'white', border: '1px solid var(--lms-success-bdr)' }}>Correct</span>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (type === 'true-false') {
      return (
        <div className="px-4 pt-3 pb-2">
          <p className="lms-section-label">Answer</p>
          <div className="flex gap-2">
            {[true, false].map(val => (
              <div key={String(val)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold"
                style={{
                  background: block.trueFalseAnswer === val ? 'var(--lms-success-bg)' : 'var(--lms-bg-white)',
                  border: `1.5px solid ${block.trueFalseAnswer === val ? 'var(--lms-success-bdr)' : 'var(--lms-border)'}`,
                  color: block.trueFalseAnswer === val ? '#14532d' : 'var(--lms-text-sec)',
                  fontFamily: 'var(--lms-font)',
                }}>
                <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                  style={{ borderColor: block.trueFalseAnswer === val ? 'var(--lms-success)' : 'var(--lms-border-hover)', background: block.trueFalseAnswer === val ? 'var(--lms-success)' : 'transparent' }}>
                  {block.trueFalseAnswer === val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                {val ? 'True' : 'False'}
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (type === 'short-answer') {
      return (
        <div className="px-4 pt-3 pb-2">
          <p className="lms-section-label">Expected Answer</p>
          <div className="px-3 py-2 rounded-lg text-[12px]"
            style={{ background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>
            {block.shortAnswer?.trim()
              ? <span className="font-medium" style={{ color: 'var(--lms-success)' }}>{block.shortAnswer}</span>
              : <span className="italic" style={{ color: 'var(--lms-text-hint)' }}>No expected answer provided</span>}
          </div>
        </div>
      );
    }

    if (type === 'paragraph') {
      return (
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: 'var(--lms-orange-50)', border: '1.5px solid var(--lms-orange-100)' }}>
            <BookOpen className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--lms-orange)' }} />
            <span className="text-[12px] font-medium" style={{ color: '#c85a30', fontFamily: 'var(--lms-font)' }}>Essay / Long-form answer — add a sample answer for auto-correction</span>
          </div>
        </div>
      );
    }

    if (type === 'matching' && block.matchingPairs && block.matchingPairs.length > 0) {
      return (
        <div className="px-4 pt-3 pb-2">
          <p className="lms-section-label">Matching Pairs</p>
          <div className="space-y-1.5">
            {block.matchingPairs.map((pair, idx) => (
              <div key={pair.id || idx} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--lms-info-bg)', color: 'var(--lms-info)', fontFamily: 'var(--lms-font)' }}>{idx + 1}</span>
                <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[12px] truncate"
                  style={{ background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>
                  {pair.left || <span className="italic" style={{ color: 'var(--lms-text-hint)' }}>Left item</span>}
                </div>
                <Equal className="h-3 w-3 flex-shrink-0" style={{ color: 'var(--lms-text-hint)' }} />
                <div className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-[12px] truncate"
                  style={{ background: 'var(--lms-success-bg)', border: '1.5px solid var(--lms-success-bdr)', color: '#14532d', fontFamily: 'var(--lms-font)' }}>
                  {pair.right || <span className="italic" style={{ color: 'var(--lms-text-hint)' }}>Right item</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (type === 'ordering' && block.orderingItems && block.orderingItems.length > 0) {
      const sorted = [...block.orderingItems].sort((a, b) => a.order - b.order);
      return (
        <div className="px-4 pt-3 pb-2">
          <p className="lms-section-label">Correct Order</p>
          <div className="space-y-1.5">
            {sorted.map((item, idx) => (
              <div key={item.id || idx} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--lms-info-bg)', color: '#0891b2', fontFamily: 'var(--lms-font)' }}>{idx + 1}</span>
                <div className="flex-1 px-2.5 py-1.5 rounded-lg text-[12px]"
                  style={{ background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>
                  {item.text || <span className="italic" style={{ color: 'var(--lms-text-hint)' }}>Empty item</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (type === 'numeric') {
      return (
        <div className="px-4 pt-3 pb-2">
          <p className="lms-section-label">Numeric Answer</p>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)' }}>
              <span className="text-[9px] font-bold uppercase" style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>Answer</span>
              <span className="text-[13px] font-bold" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                {block.numericAnswer !== null && block.numericAnswer !== undefined ? block.numericAnswer : <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }} className="italic">Not set</span>}
              </span>
            </div>
            {block.numericTolerance !== null && block.numericTolerance !== undefined && block.numericTolerance > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'var(--lms-warning-bg)', border: '1.5px solid var(--lms-warning-bdr)' }}>
                <span className="text-[9px] font-bold" style={{ color: 'var(--lms-warning)', fontFamily: 'var(--lms-font)' }}>±</span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--lms-warning)', fontFamily: 'var(--lms-font)' }}>{block.numericTolerance}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`lms-preview-card ${isActive ? 'active' : ''}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black mt-0.5"
          style={{ background: isActive ? 'var(--lms-orange)' : 'var(--lms-bg-surface)', color: isActive ? 'white' : 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
          {globalIndex + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)' }}>
            <PreviewContentBlocks block={block} />
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {qtype && (
              <span className="lms-badge" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)', color: 'var(--lms-text-sec)' }}>
                <span style={{ color: qtype.color }}>{qtype.icon}</span>{qtype.label}
              </span>
            )}
            {block.difficulty && (
              <span className="lms-badge" style={{ fontSize: 10, padding: '2px 8px', background: `${diffConfig[block.difficulty].color}14`, border: `1.5px solid ${diffConfig[block.difficulty].border}`, color: diffConfig[block.difficulty].color }}>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: diffConfig[block.difficulty].dot }} />
                {diffConfig[block.difficulty].label}
              </span>
            )}
            {score > 0 && (
              <span className="lms-badge ml-auto" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-border)', color: 'var(--lms-text-sec)' }}>
                <Hash className="h-2.5 w-2.5" style={{ color: 'var(--lms-text-hint)' }} />{score} Mark
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
          <button onClick={onEdit} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--lms-text-muted)' }} title="Edit">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          {totalBlocks > 1 && (
            <button onClick={onDelete} disabled={isDeleting}
              className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--lms-text-hint)' }} title="Delete">
              {isDeleting ? <Loader className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--lms-danger)' }} /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--lms-text-muted)' }}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)' }}>
          {renderExpandedContent()}
          {block.hasExplanation && block.explanation && (
            <div className="mx-4 mb-3 mt-2 px-3 py-2.5 rounded-lg"
              style={{ background: 'var(--lms-bg-white)', border: '1.5px solid var(--lms-info-bdr)' }}>
              <p className="lms-section-label mb-1">Explanation</p>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
                {block.explanation.replace(/<[^>]*>/g, '')}
              </p>
            </div>
          )}
          <div className="px-4 pb-3 mt-2">
            <button onClick={onEdit}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-colors"
              style={{ border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
              <Edit2 className="h-3 w-3" />Edit this question
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── PREVIEW MODAL ─────────────────────────────────────────────────────────────
const PreviewModal: React.FC<{
  isOpen: boolean; breadcrumbs: any; tabType: string;
  exerciseName: string; actionLabel: string; questionLabel: string;
  onClose: () => void; blocks: QuestionBlock[]; currentIndex: number;
  onEdit: (idx: number) => void; onDeleteFromPreview: (block: QuestionBlock, idx: number) => Promise<void>;
  scoringType: string; marksPerQuestion: number; exerciseData?: any;
  maxMcqMarks?: number; totalMcqQuestions?: number;
  isSaving?: boolean; onSubmit?: (e: React.FormEvent) => void; isEditing?: boolean;
  blockMarksErrors?: { [k: string]: string }; saveProgress?: number; saveMessage?: string;
  saveDisabledReason?: string; isSaveDisabled?: boolean; showScoreRed?: boolean; isLimitReached?: boolean;
}> = ({
  isOpen, breadcrumbs, tabType, exerciseName, actionLabel, questionLabel, onClose, blocks, currentIndex,
  onEdit, onDeleteFromPreview, scoringType, marksPerQuestion, exerciseData, maxMcqMarks = 0,
  totalMcqQuestions = 0, isSaving = false, onSubmit, isEditing = false, blockMarksErrors = {},
  saveProgress, saveMessage, saveDisabledReason = '', isSaveDisabled = false, showScoreRed = false, isLimitReached = false,
}) => {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ block: QuestionBlock; idx: number } | null>(null);
    const [difficultyFilter, setDifficultyFilter] = useState<'' | 'easy' | 'medium' | 'hard'>('');
    const [sidebarTab, setSidebarTab] = useState<'details' | 'overview' | null>(null);

    if (!isOpen) return null;

    const filteredBlocks = difficultyFilter
      ? blocks.filter(b => b.difficulty === difficultyFilter)
      : blocks;

    const availableDiffs = (['easy', 'medium', 'hard'] as const).filter(d =>
      blocks.some(b => b.difficulty === d)
    );
    const savedCount = blocks.filter(b => b.origin === 'db').length;
    const remainingQ = totalMcqQuestions > 0 ? Math.max(0, totalMcqQuestions - savedCount) : 0;
    // In equalDistribution mode the per-question mark is derived from the exercise
    // total, so Marks Used = savedCount × marksPerQuestion. Summing each block's
    // stored score would show stale values when older questions still carry an
    // outdated per-question mark. Question Specific keeps the raw per-question sum.
    const usedMarksCalc = scoringType === 'equalDistribution'
      ? savedCount * marksPerQuestion
      : blocks.filter(b => b.origin === 'db').reduce((s, b) => s + (Number(b.score) || 0), 0);
    const isExerciseGraded = maxMcqMarks > 0;
    const mcqExerciseName = exerciseData?.fullExerciseData?.exerciseInformation?.exerciseName || exerciseData?.exerciseName || 'Exercise';

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
                    {mcqExerciseName}
                  </span>
                </div>
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Exercise Type</span>
                  <span className="lms-detail-value" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                    {exerciseData?.fullExerciseData?.exerciseType || 'mcq'}
                  </span>
                </div>
                <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                  <span className="lms-detail-label">Scoring Type</span>
                  <span className="lms-detail-value" style={{ fontSize: 11 }}>
                    {scoringType === 'equalDistribution' ? 'Equal Distribution' : scoringType === 'questionSpecific' ? 'Question Specific' : scoringType}
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
                <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--lms-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Questions</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total Questions</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalMcqQuestions || '—'}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Created</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                      {savedCount}{totalMcqQuestions > 0 && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMcqQuestions}</span>}
                    </span>
                  </div>
                  {totalMcqQuestions > 0 && (
                    <>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Remaining</span>
                        <span className="lms-marks-value" style={{ color: remainingQ === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingQ}</span>
                      </div>
                      <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                        <div className="lms-progress-fill" style={{ width: `${Math.min(100, (savedCount / totalMcqQuestions) * 100)}%`, background: remainingQ === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                      </div>
                    </>
                  )}
                </div>
                {isExerciseGraded && maxMcqMarks > 0 && (
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Award size={12} style={{ color: 'var(--lms-violet)' }} />
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-violet)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Marks</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Total Marks</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{maxMcqMarks}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Per Question</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{marksPerQuestion}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Marks Used</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                        {usedMarksCalc}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{maxMcqMarks}</span>
                      </span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Remaining</span>
                      <span className="lms-marks-value" style={{ color: Math.max(0, maxMcqMarks - usedMarksCalc) === 0 ? 'var(--lms-success)' : 'var(--lms-text-main)', fontSize: 12 }}>
                        {Math.max(0, maxMcqMarks - usedMarksCalc)}
                      </span>
                    </div>
                    <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                      <div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedMarksCalc / maxMcqMarks) * 100)}%`, background: usedMarksCalc >= maxMcqMarks ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
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

        <div className="fixed inset-0 z-[150] flex items-center justify-center p-3"
          style={{ background: 'rgba(26,26,46,0.5)', backdropFilter: 'blur(3px)' }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
          <div className="flex flex-col overflow-hidden"
            style={{
              width: '96vw', maxWidth: 1500, height: '96vh', maxHeight: '96vh',
              background: 'var(--lms-bg-white)', borderRadius: 'var(--lms-radius-lg)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)', border: '1.5px solid var(--lms-border)'
            }}>

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
              style={{ borderBottom: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)' }}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--lms-violet)', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}>
                  <Eye className="h-4 w-4 text-white" />
                </div>
                <div className="h-5 w-px flex-shrink-0" style={{ background: 'var(--lms-border)' }} />
                <QuestionFormBreadcrumb
                  breadcrumbs={breadcrumbs || []} tabType={tabType}
                  exerciseName={exerciseName} actionLabel={actionLabel} questionLabel={questionLabel}
                />
                <div className="h-5 w-px flex-shrink-0 ml-2" style={{ background: 'var(--lms-border)' }} />

                {/* Difficulty filter */}
                {/* Difficulty filter — always visible */}
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <select
                    value={difficultyFilter}
                    onChange={e => setDifficultyFilter(e.target.value as any)}
                    style={{
                      fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${difficultyFilter ? (difficultyFilter === 'easy' ? '#bbf7d0' : difficultyFilter === 'medium' ? '#fde68a' : '#fed7d7') : 'var(--lms-border)'}`,
                      borderRadius: 20, padding: '5px 28px 5px 12px', cursor: 'pointer',
                      outline: 'none',
                      background: difficultyFilter ? (difficultyFilter === 'easy' ? '#f0fdf4' : difficultyFilter === 'medium' ? '#fffbeb' : '#fff5f5') : 'var(--lms-bg-surface)',
                      color: difficultyFilter ? (difficultyFilter === 'easy' ? '#16a34a' : difficultyFilter === 'medium' ? '#d97706' : '#e53e3e') : 'var(--lms-text-sec)',
                      appearance: 'none', WebkitAppearance: 'none', minWidth: 140,
                    }}
                  >
                    <option value="">All difficulties</option>
                    <option value="easy">Easy ({blocks.filter(b => b.difficulty === 'easy').length})</option>
                    <option value="medium">Medium ({blocks.filter(b => b.difficulty === 'medium').length})</option>
                    <option value="hard">Hard ({blocks.filter(b => b.difficulty === 'hard').length})</option>
                  </select>
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
                    style={{ position: 'absolute', right: 9, pointerEvents: 'none', width: 11, height: 11, color: difficultyFilter ? (difficultyFilter === 'easy' ? '#16a34a' : difficultyFilter === 'medium' ? '#d97706' : '#e53e3e') : 'var(--lms-text-sec)' }}>
                    <path d="M2 4l4 4 4-4" />
                  </svg>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-shrink-0 ml-4">
                <button onClick={onClose}
                  className="p-2 rounded-lg transition-colors"
                  style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}>
                  <X className="h-4 w-4" style={{ color: 'var(--lms-danger)' }} />
                </button>
              </div>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 min-h-0" style={{ overflow: 'hidden' }}>
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
                {filteredBlocks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-20"
                    style={{ color: 'var(--lms-text-hint)' }}>
                    <Eye className="h-14 w-14 mb-4 opacity-15" />
                    <p className="text-sm font-semibold" style={{ fontFamily: 'var(--lms-font)' }}>
                      {difficultyFilter
                        ? `No ${difficultyFilter.charAt(0).toUpperCase() + difficultyFilter.slice(1)} questions`
                        : 'No questions yet'}
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
                ) : filteredBlocks.map(block => {
                  const realIdx = blocks.indexOf(block);
                  return (
                    <PreviewQuestionCard
                      key={block.id} block={block} globalIndex={realIdx}
                      isActive={realIdx === currentIndex}
                      onEdit={() => { onEdit(realIdx); onClose(); }}
                      onDelete={() => setDeleteConfirm({ block, idx: realIdx })}
                      scoringType={scoringType} marksPerQuestion={marksPerQuestion}
                      isDeleting={deletingId === block.id} totalBlocks={blocks.length}
                    />
                  );
                })}
              </div>
              {/* Right Sidebar */}
              <div style={{ width: 280, flexShrink: 0, borderLeft: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                {/* Two action buttons */}
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
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
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
                    <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--lms-text-hint)', flexShrink: 0 }} />
                  </button>
                </div>

                {/* Stats summary */}
                <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>
                  <div style={{ marginBottom: 14 }}>
                    <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                      <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                      <span>Questions</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Total</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalMcqQuestions || '—'}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Created</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                        {savedCount}{totalMcqQuestions > 0 && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMcqQuestions}</span>}
                      </span>
                    </div>
                    {totalMcqQuestions > 0 && (
                      <>
                        <div className="lms-marks-row">
                          <span className="lms-marks-label">Remaining</span>
                          <span className="lms-marks-value" style={{ color: remainingQ === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{remainingQ}</span>
                        </div>
                        <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                          <div className="lms-progress-fill" style={{ width: `${Math.min(100, (savedCount / totalMcqQuestions) * 100)}%`, background: remainingQ === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                        </div>
                      </>
                    )}
                  </div>

                  {isExerciseGraded && maxMcqMarks > 0 && (
                    <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14 }}>
                      <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                        <Award size={12} style={{ color: 'var(--lms-orange)' }} />
                        <span>Marks</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Per Question</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{marksPerQuestion}</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Total</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{maxMcqMarks}</span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Used</span>
                        <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                          {usedMarksCalc}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{maxMcqMarks}</span>
                        </span>
                      </div>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Remaining</span>
                        <span className="lms-marks-value" style={{ color: Math.max(0, maxMcqMarks - usedMarksCalc) === 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>
                          {Math.max(0, maxMcqMarks - usedMarksCalc)}
                        </span>
                      </div>
                      <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                        <div className="lms-progress-fill" style={{ width: `${Math.min(100, (usedMarksCalc / maxMcqMarks) * 100)}%`, background: usedMarksCalc >= maxMcqMarks ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between"
              style={{ borderTop: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)' }}>
              <span className="text-[11px] flex items-center gap-1.5"
                style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>
                <Edit2 className="h-3 w-3" />Click the edit icon on any question to load it in the editor
              </span>
              <button onClick={onClose} className="lms-btn lms-btn-slate">Close Preview</button>
            </div>
          </div>

          {/* ── Delete confirmation ── */}
          {deleteConfirm && (
            <div className="fixed inset-0 z-[210] flex items-center justify-center p-4"
              style={{ background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(2px)' }}>
              <div className="lms-modal" style={{ maxWidth: 400 }}>
                <div className="lms-modal-header">
                  <div className="lms-modal-icon" style={{ background: 'var(--lms-danger-bg)' }}>
                    <Trash2 className="h-4 w-4" style={{ color: 'var(--lms-danger)' }} />
                  </div>
                  <h3 className="text-sm font-bold"
                    style={{ fontFamily: 'var(--lms-font)', color: 'var(--lms-text-main)' }}>
                    Delete Question
                  </h3>
                </div>
                <div className="lms-modal-body">
                  <p className="text-xs font-medium mb-2"
                    style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
                    {deleteConfirm.block.questionText.replace(/<[^>]*>/g, '').trim() || 'Untitled question'}
                  </p>
                  <p className="text-[11px] font-medium"
                    style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                    This action cannot be undone.
                  </p>
                  <div className="flex items-center gap-2 pt-3">
                    <button onClick={() => setDeleteConfirm(null)} className="lms-cancel-btn flex-1">
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const { block, idx } = deleteConfirm!;
                        setDeleteConfirm(null);
                        setDeletingId(block.id);
                        try { await onDeleteFromPreview(block, idx); } finally { setDeletingId(null); }
                      }}
                      className="lms-btn lms-btn-orange flex-1 justify-center"
                      style={{ background: 'var(--lms-danger)', boxShadow: 'none' }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />Yes, Delete
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

// ─── EXERCISE DETAILS RIGHT PANEL ──────────────────────────────────────────────
const ExerciseDetailsPanel: React.FC<{
  exerciseData: any; scoringType: string; marksPerQuestion: number;
  totalMcqQuestions: number; maxMcqMarks: number; blocks: QuestionBlock[];
  sidebarBlocks?: QuestionBlock[];   // ← NEW: only saved blocks for marks
  currentBlock: QuestionBlock | null; isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void; onClose: () => void; isEditing: boolean;
  blockMarksErrors: { [k: string]: string }; saveProgress?: number; saveMessage?: string;
  saveDisabledReason: string; isSaveDisabled: boolean; showScoreRed: boolean;
  isLimitReached: boolean; hideActions?: boolean;
}> = ({
  exerciseData, scoringType, marksPerQuestion, totalMcqQuestions, maxMcqMarks,
  blocks, sidebarBlocks, currentBlock, isSaving, onSubmit, onClose, isEditing,
  blockMarksErrors, saveProgress, saveMessage, saveDisabledReason, isSaveDisabled, showScoreRed,
  isLimitReached, hideActions = false
}) => {
    const info = exerciseData?.fullExerciseData?.exerciseInformation;
    const exerciseType = exerciseData?.fullExerciseData?.exerciseType || exerciseData?.exerciseType || '';
    const dbBlocks = blocks.filter(b => b.origin === 'db');
    const newBlocks = blocks.filter(b => b.origin === 'new');
    const dirtyBlocks = blocks.filter(b => b.isDirty);

    // ─── NEW: use sidebarBlocks (saved only) for marks/count calculations ────
    const calcBlocks = sidebarBlocks ?? blocks;
    const fmt = (n: number) => Number.isInteger(n) ? `${n}` : n.toFixed(1);

    // Only exclude currentBlock if it's NOT already in calcBlocks (i.e. not yet saved)
    const currentIsAlreadySaved = currentBlock
      ? calcBlocks.some(b => b.id === currentBlock.id)
      : false;

    const totalUsed = currentIsAlreadySaved
      ? calcBlocks.length
      : calcBlocks.filter(b => b.id !== currentBlock?.id).length;

    const existingUsedMarks = currentIsAlreadySaved
      ? calcBlocks.reduce((s, b) => s + (Number(b.score) || 0), 0)
      : calcBlocks
        .filter(b => b.id !== currentBlock?.id)
        .reduce((s, b) => s + (Number(b.score) || 0), 0);

    const currentQuestionMarks = currentIsAlreadySaved
      ? 0
      : (Number(currentBlock?.score) || 0);

    const totalUsedMarksRaw = existingUsedMarks + currentQuestionMarks;
    const remainingMarks = maxMcqMarks - totalUsedMarksRaw;
    const overMarksLimit = scoringType === 'questionSpecific' && maxMcqMarks > 0 && totalUsedMarksRaw > maxMcqMarks;
    const overQuestionLimit = scoringType === 'equalDistribution' && totalMcqQuestions > 0 && totalUsed > totalMcqQuestions;
    // ─── NEW: remaining capacity for Save & Next ─────────────────────────────
    const remainingMarksForNew = maxMcqMarks > 0 && scoringType === 'questionSpecific'
      ? Math.max(0, maxMcqMarks - calcBlocks.reduce((s, b) => s + (Number(b.score) || 0), 0))
      : null;
    const progressPercent = scoringType === 'equalDistribution' && totalMcqQuestions > 0
      ? Math.min(100, (Math.min(totalUsed, totalMcqQuestions) / totalMcqQuestions) * 100)
      : maxMcqMarks > 0
        ? Math.min(100, (Math.max(0, existingUsedMarks) / maxMcqMarks) * 100)
        : 0;

    const saveLabel = () => {
      const parts = [];
      if (newBlocks.length > 0) parts.push(`${newBlocks.length} new`);
      if (dirtyBlocks.length > 0) parts.push(`${dirtyBlocks.length} updated`);
      if (parts.length === 0) return 'Nothing to Save';
      return `Save (${parts.join(', ')})`;
    };

    const remainingQuestions = totalMcqQuestions > 0 ? Math.max(0, totalMcqQuestions - totalUsed) : null;
    // const remainingMarksForNew = maxMcqMarks > 0 && scoringType === 'questionSpecific'
    //   ? Math.max(0, maxMcqMarks - (blocks.reduce((s, b) => s + (Number(b.score) || 0), 0))) : null;

    const showNoRemainingBanner = isLimitReached && (
      (scoringType === 'equalDistribution' && totalMcqQuestions > 0 && remainingQuestions === 0) ||
      (scoringType === 'questionSpecific' && maxMcqMarks > 0 && remainingMarksForNew !== null && remainingMarksForNew < 0.1)
    );

    return (
      <div className="h-full flex flex-col" style={{ background: 'var(--lms-orange-50)', overflow: 'hidden', minHeight: 0 }}>
        <div className="flex-1 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'thin' }}>
          {/* Exercise Details */}
          <div className="px-4 py-3" style={{ borderBottom: '1.5px solid var(--lms-info-bdr)', background: 'var(--lms-info-bg)' }}>
            <div className="lms-sidebar-section-title">
              <FileText className="h-3.5 w-3.5" style={{ color: 'var(--lms-info)' }} />
              Exercise Details
            </div>
            <div className="space-y-0.5">
              {[
                info?.exerciseId && { label: 'Exercise ID', value: <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{info.exerciseId}</span> },
                (info?.exerciseName || exerciseData?.exerciseName) && { label: 'Name', value: <span style={{ wordBreak: 'break-word', fontSize: 12.5 }}>{info?.exerciseName || exerciseData?.exerciseName}</span> },
                exerciseType && { label: 'Type', value: <span style={{ fontSize: 12.5 }}>{exerciseType}</span> },
                { label: 'Scoring', value: <span style={{ fontSize: 12.5 }}>{scoringType === 'equalDistribution' ? 'Equal Distribution' : 'Custom Marks'}</span> },
                dirtyBlocks.length > 0 && { label: 'Edited Qs', value: <span style={{ fontSize: 12.5, color: 'var(--lms-warning)' }}>{dirtyBlocks.length} will update</span> },
              ].filter(Boolean).map(({ label, value }: any) => (
                <div key={label} className="lms-detail-row" style={{ padding: '4px 0' }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--lms-text-sec)',
                    fontFamily: 'var(--lms-font)',
                    letterSpacing: '0.01em',
                  }}>{label}</span>
                  <span style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: 'var(--lms-text-main)',
                    fontFamily: 'var(--lms-font)',
                  }}>{value}</span>
                </div>
              ))
              }
            </div>
          </div>
          {/* Marks Allocation */}
          {/* Marks Allocation */}
          <div className="px-4 py-3" style={{ borderBottom: '1.5px solid var(--lms-orange-100)', background: 'var(--lms-orange-50)' }}>            <div className="lms-sidebar-section-title">
            <Hash className="h-3.5 w-3.5" style={{ color: 'var(--lms-orange)' }} />
            Marks Allocation
          </div>
            {scoringType === 'equalDistribution' && totalMcqQuestions > 0 ? (
              <>
                <div className="space-y-0.5">
                  {[
                    { label: 'Total Questions', value: `${totalMcqQuestions}`, denom: null, color: 'var(--lms-text-main)' },
                    { label: 'Questions Created', value: `${totalUsed}`, denom: `${totalMcqQuestions}`, color: overQuestionLimit ? 'var(--lms-danger)' : '#4f46e5' },
                    { label: 'Remaining Questions', value: `${Math.max(0, totalMcqQuestions - totalUsed)}`, denom: `${totalMcqQuestions}`, color: Math.max(0, totalMcqQuestions - totalUsed) === 0 ? 'var(--lms-danger)' : 'var(--lms-success)' },
                  ].map(({ label, value, denom, color }) => (
                    <div key={label} className="lms-marks-row">
                      <span className="lms-marks-label">{label}</span>
                      <span className="lms-marks-value" style={{ color }}>
                        {value}{denom && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 11 }}>/{denom}</span>}
                      </span>
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--lms-border)', margin: '6px 0' }} />
                  {(() => {
                    const total = totalMcqQuestions * marksPerQuestion;
                    const used = totalUsed * marksPerQuestion;
                    const rem = Math.max(0, (totalMcqQuestions - totalUsed) * marksPerQuestion);
                    return [
                      { label: 'Marks Per Question', value: fmt(marksPerQuestion), denom: null, color: 'var(--lms-text-main)' },
                      { label: 'Total Marks', value: fmt(total), denom: null, color: 'var(--lms-text-main)' },
                      { label: 'Used Marks', value: fmt(used), denom: fmt(total), color: '#7c3aed' },
                      { label: 'Remaining Marks', value: fmt(rem), denom: fmt(total), color: rem === 0 ? 'var(--lms-danger)' : 'var(--lms-success)' },
                    ].map(({ label, value, denom, color }) => (
                      <div key={label} className="lms-marks-row">
                        <span className="lms-marks-label">{label}</span>
                        <span className="lms-marks-value" style={{ color }}>
                          {value}{denom && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 11 }}>/{denom}</span>}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
                <div className="lms-progress-bar">
                  <div className="lms-progress-fill"
                    style={{ width: `${progressPercent}%`, background: overQuestionLimit ? 'var(--lms-danger)' : progressPercent >= 100 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                </div>
                {overQuestionLimit && (
                  <p className="text-[10px] font-medium mt-1" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                    ⚠ Exceeds limit by {totalUsed - totalMcqQuestions} question{totalUsed - totalMcqQuestions > 1 ? 's' : ''}
                  </p>
                )}
              </>
            ) : scoringType === 'questionSpecific' && maxMcqMarks > 0 ? (
              <>
                <div className="space-y-0.5">
                  {[
                    { label: 'Total Marks', value: `${maxMcqMarks}`, showTotal: false, color: 'var(--lms-text-main)' },
                    { label: 'Total Used Marks', value: `${existingUsedMarks.toFixed(1)}`, showTotal: true, color: '#7c3aed' },
                    { label: 'Total Questions', value: `${blocks.length}`, showTotal: false, color: '#4f46e5' },
                    { label: 'This Question Marks', value: `${overMarksLimit ? '0.0' : currentQuestionMarks.toFixed(1)}`, showTotal: false, color: !overMarksLimit && currentQuestionMarks > 0 ? '#4f46e5' : 'var(--lms-text-sec)' },
                    { label: 'Remaining Marks', value: `${Math.max(0, overMarksLimit ? maxMcqMarks - existingUsedMarks : remainingMarks).toFixed(1)}`, showTotal: false, color: Math.max(0, overMarksLimit ? maxMcqMarks - existingUsedMarks : remainingMarks) <= 0 ? 'var(--lms-danger)' : 'var(--lms-success)' },
                  ].map(({ label, value, showTotal, color }) => (
                    <div key={label} className="lms-marks-row">
                      <span className="lms-marks-label">{label}</span>
                      <span className="lms-marks-value" style={{ color }}>
                        {value}{showTotal && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400 }}> / {maxMcqMarks}</span>}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="lms-progress-bar">
                  <div className="lms-progress-fill"
                    style={{ width: `${progressPercent}%`, background: existingUsedMarks >= maxMcqMarks ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                </div>
              </>
            ) : null}
          </div>

          {/* No remaining banner */}
          {/* {showNoRemainingBanner && (
            <div className="mx-3 mt-3 px-3 py-2 rounded-lg"
              style={{ background: 'var(--lms-danger-bg)', border: '1.5px solid var(--lms-danger-bdr)' }}>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: 'var(--lms-danger)' }} />
                <p className="text-[11px] font-semibold" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                  {scoringType === 'equalDistribution' ? 'No questions remaining' : 'No remaining marks left'}
                </p>
              </div>
            </div>
          )} */}


        </div>

        {/* Footer */}
        {/* Footer — progress bar only (no Cancel / Save buttons) */}
        {isSaving && saveProgress !== undefined && (
          <div className="flex-shrink-0 px-3 py-3" style={{ borderTop: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px]" style={{ color: 'var(--lms-orange)', fontFamily: 'var(--lms-font)' }}>{saveMessage || 'Saving…'}</span>
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--lms-bg-surface2)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${saveProgress}%`, background: 'var(--lms-orange)' }} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

const ResizableImage: React.FC<{
  cb: ContentBlock;
  onUpdate: (patch: Partial<ContentBlock>) => void;
  onRemove: () => void;
}> = ({ cb, onUpdate, onRemove }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [liveSize, setLiveSize] = useState(cb.sizePercent || 60);
  const startX = useRef(0);
  const startSize = useRef(0);
  const side = useRef<'left' | 'right'>('right');

  useEffect(() => { setLiveSize(cb.sizePercent || 60); }, [cb.sizePercent]);

  const onMouseDown = (e: React.MouseEvent, s: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startSize.current = liveSize;
    side.current = s;
    setDragging(true);

    const onMove = (ev: MouseEvent) => {
      const parentW = containerRef.current?.parentElement?.clientWidth || 600;
      const dx = ev.clientX - startX.current;
      const delta = (dx / parentW) * 100;
      const newSize = Math.min(100, Math.max(10,
        side.current === 'right'
          ? startSize.current + delta
          : startSize.current - delta
      ));
      setLiveSize(Math.round(newSize));
    };

    const onUp = (ev: MouseEvent) => {
      const parentW = containerRef.current?.parentElement?.clientWidth || 600;
      const dx = ev.clientX - startX.current;
      const delta = (dx / parentW) * 100;
      const newSize = Math.min(100, Math.max(10,
        side.current === 'right'
          ? startSize.current + delta
          : startSize.current - delta
      ));
      const final = Math.round(newSize);
      setLiveSize(final);
      onUpdate({ sizePercent: final });
      setDragging(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const justify =
    cb.alignment === 'left' ? 'flex-start'
      : cb.alignment === 'right' ? 'flex-end'
        : 'center';

  // Diagonal arrow SVG — rotated per corner
  const DiagArrow = ({ rotate }: { rotate: number }) => (
    <svg
      width="10" height="10" viewBox="0 0 10 10"
      style={{ transform: `rotate(${rotate}deg)`, display: 'block', pointerEvents: 'none' }}
    >
      {/* diagonal line */}
      <line x1="1" y1="9" x2="9" y2="1" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" />
      {/* top-right arrowhead */}
      <polyline points="5,1 9,1 9,5" fill="none" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* bottom-left arrowhead */}
      <polyline points="5,9 1,9 1,5" fill="none" stroke="var(--lms-orange)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const cornerBase: React.CSSProperties = {
    position: 'absolute',
    width: 16,
    height: 16,
    background: 'white',
    border: '1.5px solid var(--lms-orange)',
    borderRadius: 3,
    zIndex: 10,
    userSelect: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: hovered || dragging ? 1 : 0,
    transition: 'opacity 0.15s',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
  };

  return (
    <div
      style={{ display: 'flex', justifyContent: justify, position: 'relative' }}
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        width: `${liveSize}%`,
        position: 'relative',
        transition: dragging ? 'none' : 'width 0.1s',
      }}>

        {/* Image */}
        <img
          src={cb.url}
          alt=""
          className="w-full h-auto rounded-lg"
          style={{
            border: `1.5px solid ${dragging ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
            display: 'block',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          draggable={false}
        />

        {/* Top-left corner ↖↘ */}
        <div
          style={{ ...cornerBase, top: -7, left: -7, cursor: 'nwse-resize' }}
          onMouseDown={e => onMouseDown(e, 'left')}
        >
          <DiagArrow rotate={0} />
        </div>

        {/* Top-right corner ↗↙ */}
        <div
          style={{ ...cornerBase, top: -7, right: -7, cursor: 'nesw-resize' }}
          onMouseDown={e => onMouseDown(e, 'right')}
        >
          <DiagArrow rotate={90} />
        </div>

        {/* Bottom-left corner ↗↙ */}
        <div
          style={{ ...cornerBase, bottom: -7, left: -7, cursor: 'nesw-resize' }}
          onMouseDown={e => onMouseDown(e, 'left')}
        >
          <DiagArrow rotate={90} />
        </div>

        {/* Bottom-right corner ↖↘ */}
        <div
          style={{ ...cornerBase, bottom: -7, right: -7, cursor: 'nwse-resize' }}
          onMouseDown={e => onMouseDown(e, 'right')}
        >
          <DiagArrow rotate={0} />
        </div>

        {/* Size badge while dragging */}
        {dragging && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.65)',
            color: 'white',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 6,
            fontFamily: 'var(--lms-font)',
            pointerEvents: 'none',
            zIndex: 20,
          }}>
            {liveSize}%
          </div>
        )}

        {/* Alignment + remove toolbar on hover */}
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          zIndex: 20,
          opacity: hovered || dragging ? 1 : 0,
          transition: 'opacity 0.15s',
        }}>
          {(['left', 'center', 'right'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => onUpdate({ alignment: a })}
              style={{
                width: 22, height: 22, borderRadius: 5, border: '1.5px solid',
                fontSize: 9, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--lms-font)',
                background: cb.alignment === a ? 'var(--lms-orange)' : 'white',
                borderColor: cb.alignment === a ? 'var(--lms-orange)' : 'var(--lms-border)',
                color: cb.alignment === a ? 'white' : 'var(--lms-text-muted)',
              }}
            >
              {a[0].toUpperCase()}
            </button>
          ))}
          <button
            type="button"
            onClick={onRemove}
            style={{
              width: 22, height: 22, borderRadius: 5,
              border: '1.5px solid var(--lms-danger-bdr)',
              background: 'var(--lms-danger-bg)',
              color: 'var(--lms-danger)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>

      </div>
    </div>
  );
};

const CodeBlock: React.FC<{
  cb: ContentBlock;
  onUpdate: (patch: Partial<ContentBlock>) => void;
  onRemove: () => void;
}> = ({ cb, onUpdate, onRemove }) => {
  const [editing, setEditing] = useState(true);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const savedWidth = (cb as any).width;
  const savedHeight = (cb as any).height;
  const [liveWidth, setLiveWidth] = useState<number | undefined>(savedWidth);
  const [liveHeight, setLiveHeight] = useState<number | undefined>(savedHeight);
  const bg = cb.bgColor || '#f5f5f5';
  const isDark = ['#1e1e1e', '#282a36', '#272822', '#2e3440'].includes(bg);
  const textColor = isDark ? '#d4d4d4' : '#1a1a2e';



  const handleCopy = () => {
    navigator.clipboard.writeText(cb.value || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Place this ABOVE the CodeBlock component definition
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
  const themes = [
    { label: 'Light', bg: '#f5f5f5' },
    { label: 'Dark', bg: '#1e1e1e' },
    { label: 'Dracula', bg: '#282a36' },
    { label: 'Monokai', bg: '#272822' },
    { label: 'Solarized', bg: '#fdf6e3' },
    { label: 'Nord', bg: '#2e3440' },
  ];

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
      {/* Copy button */}
      {/* <button
        type="button"
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: 7,
          right: 7,
          zIndex: 10,
          background: copied
            ? (isDark ? '#1b3a1b' : '#e8f5e9')
            : (isDark ? '#2a2a2a' : '#ececec'),
          border: `1px solid ${copied ? '#a5d6a7' : (isDark ? '#444' : '#d0d0d0')}`,
          borderRadius: 6,
          padding: '3px 8px',
          fontSize: 10,
          fontWeight: 600,
          color: copied ? '#4caf50' : (isDark ? '#aaa' : '#555'),
          cursor: 'pointer',
          fontFamily: 'var(--lms-font)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
        className="group-hover/code:!opacity-100"
      >
        {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button> */}

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        style={{
          position: 'absolute',
          top: 7,
          right: 10,
          zIndex: 10,
          background: isDark ? '#ffffff' : '#eb0303',
          border: `1px solid ${isDark ? '#444' : '#d0d0d0'}`,
          borderRadius: 6,
          padding: '3px 6px',
          fontSize: 10,
          color: isDark ? '#000000' : '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          opacity: 0,
          transition: 'opacity 0.15s',
        }}
        className="group-hover/code:!opacity-100"
      >
        <X className="h-2.5 w-2.5" />
      </button>

      {/* Code area */}
      {editing ? (
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <textarea
            ref={textareaRef}
            value={cb.value || ''}
            onChange={e => onUpdate({ value: e.target.value })}
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
                setLiveWidth(w);
                setLiveHeight(h);
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
              minWidth: 200,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '10px 14px',
              fontSize: 13,
              lineHeight: 1.7,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              color: textColor,
              resize: 'both',
              overflow: 'auto',
              boxSizing: 'border-box',
              whiteSpace: 'pre',
              minHeight: 42,
            }}
          />
          {/* Resize corner indicator */}
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 4,
              background: 'var(--lms-orange)',
              opacity: 0.85,
              zIndex: 10,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M9 1L1 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 5L5 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 9H5V5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          {/* Resize hint tooltip */}
          <div
            style={{
              position: 'absolute',
              bottom: 26,
              right: 4,
              pointerEvents: 'none',
              background: '#1a1a2e',
              color: 'white',
              fontSize: 9,
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              fontFamily: 'var(--lms-font)',
              opacity: 0,
              transition: 'opacity 0.15s',
            }}
            className="resize-hint"
          >
            drag to resize
          </div>
        </div>
      ) : (
        <pre
          onClick={() => setEditing(true)}
          style={{
            margin: 0,
            padding: '10px 14px',
            fontSize: 13,
            lineHeight: 1.7,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            color: textColor,
            whiteSpace: 'pre',
            cursor: 'text',
            display: 'block',
            width: savedWidth ? `${savedWidth}px` : '100%',
            height: savedHeight ? `${savedHeight}px` : undefined,
            minWidth: 200,
            background: 'transparent',
            overflowX: 'auto',
          }}
          dangerouslySetInnerHTML={{ __html: highlightAuto(cb.value || '', bg) }}
        />
      )}
      {/* Bottom toolbar — shows on hover */}
      <div
        className="group-hover/code:!opacity-100"
        style={{
          opacity: 0,
          transition: 'opacity 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          borderTop: `1px solid ${isDark ? '#3a3a3a' : '#e2e2e2'}`,
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
        }}
      >
        {/* Theme swatches */}
        {themes.map(theme => (
          <button
            key={theme.label}
            type="button"
            title={theme.label}
            onClick={() => onUpdate({ bgColor: theme.bg })}
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: theme.bg,
              border: bg === theme.bg
                ? '2px solid var(--lms-orange)'
                : `2px solid ${isDark ? '#555' : '#d0d0d0'}`,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'transform 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.3)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          />
        ))}

        <div style={{ width: 1, height: 12, background: isDark ? '#444' : '#e0e0e0', margin: '0 2px' }} />

        {/* Language input */}
        <input
          type="text"
          value={cb.language || ''}
          onChange={e => onUpdate({ language: e.target.value })}
          // placeholder="language"
          style={{
            fontSize: 10,
            fontFamily: 'monospace',
            color: isDark ? '#888' : '#999',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            width: 70,
          }}
        />
      </div>
    </div>
  );
};
// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
const MCQQuestionForm: React.FC<MCQQuestionFormProps> = ({
  breadcrumbs, exerciseData, tabType, initialData, isEditing = false,
  initialQuestionId,
  initialBankQuestions,
  initialBankSource,
  onClose, onSave, isSaving = false, saveProgress, saveMessage,
  onEditExercise,
  sectionData,
  approval, approvalContext, onQueryResolved,
}) => {
  injectFonts();
  const toast = useToast();

  // ─── Image upload modal state ─────────────────────────────────────────────
  const [imgModal, setImgModal] = useState<{ onUpload: (url: string) => void } | null>(null);

  // ─── Mock modal state ─────────────────────────────────────────────────────
  const [showMockModal, setShowMockModal] = useState(false);
  const openImgModal = (onUpload: (url: string) => void) => setImgModal({ onUpload });
  const closeImgModal = () => setImgModal(null);

  // ─── NEW: track which blocks have been individually saved ─────────────────────
  const [savedQuestionIds, setSavedQuestionIds] = useState<Set<string>>(new Set());
  // Synchronous mirror of `savedQuestionIds`. State updates don't propagate to
  // an in-flight click handler's closure, so a rapid second click on Save / Finish
  // re-runs the create-question API on a block that *was* just saved. The ref
  // is mutated synchronously inside the save success path, so the early-return
  // check below can see the just-saved state regardless of React render timing.
  const savedQuestionIdsRef = useRef<Set<string>>(new Set());
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [isSavingNext, setIsSavingNext] = useState(false);
  // Synchronous re-entry guard. React's `isSavingQuestion` state lags the click
  // event, so a rapid double-click on Save & Next would slip past `disabled={…}`
  // and fire the create-question API twice — landing duplicate rows in the DB.
  // Ref updates are immediate, so checking this at the top of the handler stops
  // the second invocation before it does any work.
  const savingInFlightRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (isEditing) return 0;
    // Bank flow: questionBlocks initially holds ONLY the bank-selected blocks
    // (DB blocks get prepended by fetchExercise later, at which point that
    // effect re-points currentIndex to dbBlocks.length so the first bank
    // question stays visible). Start at 0 so the first bank question shows
    // immediately on open.
    if (initialBankQuestions && initialBankQuestions.length > 0) return 0;
    const cached = exerciseData?.fullExerciseData?.questions;
    if (!cached?.length) return 0;
    // point straight to the new empty block slot from the very first render
    return cached.filter((q: any) => q.questionType === 'mcq').length;
  }); const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
  const [showDifficultyMenu, setShowDifficultyMenu] = useState(false);
  const [showQTypeMenu, setShowQTypeMenu] = useState(false);
  const [activeImageToolbar, setActiveImageToolbar] = useState<
    | { type: 'question'; blockId: string }
    | { type: 'option'; blockId: string; optionId: string }
    | null
  >(null);
  const [blockMarksErrors, setBlockMarksErrors] = useState<{ [blockId: string]: string }>({});
  const [errors, setErrors] = useState<{ blocks?: { [k: string]: any } }>({});
  const [deleteTarget, setDeleteTarget] = useState<{ blockIdx: number } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingExercise, setLoadingExercise] = useState(false);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);
  const [questionTextEmpty, setQuestionTextEmpty] = useState<{ [id: string]: boolean }>({});
  const [showScoreRed, setShowScoreRed] = useState(false);
  const [answerKeyOpenBlockId, setAnswerKeyOpenBlockId] = useState<string | null>(null);
  const [emptyOptWarnings, setEmptyOptWarnings] = useState<{ [blockId: string]: Set<string> }>({});
  const [validationAttempted, setValidationAttempted] = useState<Set<string>>(new Set());
  const [showExerciseSettings, setShowExerciseSettings] = useState(false);
  const [exerciseSettingsData, setExerciseSettingsData] = useState<any>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [sidebarTab, setSidebarTab] = useState<'details' | 'overview' | 'section' | null>(null);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  const mainScrollRef = useRef<HTMLDivElement>(null);
  const richTextRefs = useRef<{ [id: string]: React.RefObject<HTMLDivElement> }>({});

  const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const scoringType: string = exerciseData?.fullExerciseData?.questionConfiguration?.mcqQuestionConfiguration?.scoringType || 'equalDistribution';
  const marksPerQuestion: number = exerciseData?.fullExerciseData?.questionConfiguration?.mcqQuestionConfiguration?.marksPerQuestion || 0;
  const totalMcqQuestions: number = exerciseData?.fullExerciseData?.questionConfiguration?.mcqQuestionConfiguration?.totalMcqQuestions || 0;

  // ── Question Source enforcement (single source of truth) ─────────────────
  // Same rule as ProgrammingQuestionForm — see that file for the semantics.
  // Combined exercises may separate the MCQ part's source: questionSourceMcq
  // overrides the exercise-wide source for THIS form — but ONLY while the
  // exercise is actually Combined. A stale trio left behind by a mid-creation
  // type switch must never gate a pure-MCQ exercise.
  const _fxSrc: any = exerciseData?.fullExerciseData || {};
  const _isCombinedForSource = _fxSrc.exerciseType === 'Combined' ||
    ((exerciseData?.exerciseType || '').toString().toLowerCase() === 'combined');
  const _mcqPartSrc = _isCombinedForSource ? _fxSrc.questionSourceMcq : null;
  const questionSourceRaw = _mcqPartSrc || _fxSrc.questionSource;
  const customSourcesRaw: string[] = _mcqPartSrc
    ? (Array.isArray(_fxSrc.customSourcesMcq) ? _fxSrc.customSourcesMcq : [])
    : (Array.isArray(_fxSrc.customSources) ? _fxSrc.customSources : []);
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
  const maxMcqMarks: number = getMaxMcqMarks(exerciseData);

  const entityType = ((): 'modules' | 'submodules' | 'topics' | 'subtopics' => {
    const m: Record<string, string> = {
      module: 'modules', modules: 'modules', submodule: 'submodules', submodules: 'submodules',
      topic: 'topics', topics: 'topics', subtopic: 'subtopics', subtopics: 'subtopics',
    };
    return (m[exerciseData?.nodeType?.toLowerCase()?.trim()] || 'topics') as any;
  })();
  const entityId = exerciseData?.nodeId || '';
  const exerciseDbId = exerciseData?.exerciseId || exerciseData?.fullExerciseData?._id || exerciseData?.id || '';
  const subcategory = exerciseData?.subcategory || 'assignments';
  const currentSectionId = exerciseData?.currentSectionId || exerciseData?.fullExerciseData?.currentSectionId || null;
  const currentSectionName = exerciseData?.currentSectionName || exerciseData?.fullExerciseData?.currentSectionName || null;

  const makeDefaultBlock = (id: string, sequence: number = 0): QuestionBlock => ({
    id, origin: 'new', source: 'scratch-manual', type: 'multiple-choice', questionText: '', title: '', description: '',
    questionContent: [{ id: `${id}-txt-1`, type: 'text' as const, value: '' }],

    questionImageUrl: '', questionImageAlignment: 'center', questionImageSizePercent: 60, optionsPerRow: 1,

    options: [
      { id: `${id}-opt-1`, text: '', isCorrect: false, imageAlignment: 'center', imageSizePercent: 60 },
      { id: `${id}-opt-2`, text: '', isCorrect: false, imageAlignment: 'center', imageSizePercent: 60 },
    ],
    matchingPairs: [{ id: `${id}-pair-1`, left: '', right: '' }, { id: `${id}-pair-2`, left: '', right: '' }],
    orderingItems: [{ id: `${id}-ord-1`, text: '', order: 1 }, { id: `${id}-ord-2`, text: '', order: 2 }],
    trueFalseAnswer: null, shortAnswer: '', numericAnswer: null, numericTolerance: null,

    isRequired: false, hasOtherOption: false, hasExplanation: false, explanation: '',
    score: undefined, difficulty: '', timeLimit: 2000, memoryLimit: 256,
    isActive: true, sequence, sampleInput: '', sampleOutput: '',
  });

  // ─── NEW: only saved blocks drive the sidebar & limit checks ─────────────────
  // DB blocks that haven't been edited + any new blocks explicitly saved this session



  const handleEditExercise = useCallback(() => {
    // If parent (AddQuestionForm) owns the ExerciseSettings panel, delegate to it
    // so it can properly refresh exercise data and keep the form mounted.
    if (onEditExercise) { onEditExercise(); return; }

    const settingsData = {
      ...exerciseData?.fullExerciseData,
      exerciseInformation: {
        exerciseId: exerciseData?.fullExerciseData?.exerciseInformation?.exerciseId,
        exerciseName: exerciseData?.exerciseName || exerciseData?.fullExerciseData?.exerciseInformation?.exerciseName || '',
        description: exerciseData?.fullExerciseData?.exerciseInformation?.description || '',
        exerciseLevel: exerciseData?.fullExerciseData?.exerciseInformation?.exerciseLevel || 'intermediate',
        totalDuration: exerciseData?.fullExerciseData?.exerciseInformation?.totalDuration || 60,
        totalMarks: exerciseData?.fullExerciseData?.exerciseInformation?.totalMarks || 0,
      },
      totalMarksMCQ: exerciseData?.fullExerciseData?.totalMarksMCQ || getMaxMcqMarks(exerciseData),
      totalMarksProgramming: exerciseData?.fullExerciseData?.totalMarksProgramming || 0,
      questionConfiguration: exerciseData?.fullExerciseData?.questionConfiguration || {},
      programmingSettings: exerciseData?.fullExerciseData?.programmingSettings || { selectedModule: '', selectedLanguages: [] },
      availabilityPeriod: exerciseData?.fullExerciseData?.availabilityPeriod || { startDate: '', endDate: '', gracePeriodEnabled: false, gracePeriodAllowed: false },
      notificationSettings: exerciseData?.fullExerciseData?.notificationSettings || { notifyUsers: true, notifyGmail: false, notifyWhatsApp: false, gradeSheet: true },
    };
    setExerciseSettingsData(settingsData);
    setShowExerciseSettings(true);
  }, [exerciseData]);

  const handleExerciseSettingsSave = useCallback((updatedData: any) => {
    toast.success('Exercise settings updated successfully');
    setShowExerciseSettings(false);
  }, [toast]);

const buildBlockFromDbQuestion = (q: any): QuestionBlock => {
  const id = generateId('block-db');
  
  // Extract correct answers for short answer/essay from mcqQuestionCorrectAnswers
  let shortAnswerValue = '';
  if (q.mcqQuestionType === 'short_answer' || q.mcqQuestionType === 'essay') {
    if (q.mcqQuestionType === 'essay' && q.essayAnswer) {
      shortAnswerValue = q.essayAnswer;
    } else if (q.mcqQuestionCorrectAnswers && q.mcqQuestionCorrectAnswers.length > 0) {
      shortAnswerValue = q.mcqQuestionCorrectAnswers[0];
    } else if (q.shortAnswer) {
      shortAnswerValue = q.shortAnswer;
    }
  }

  // Normalize mcqQuestionTitle to a string regardless of how the source
  // (DB / Question Bank / legacy payload) stored it. Bank rows in particular
  // sometimes ship `{ text: '…' }` or `{ value: '…' }`, which broke
  // .replace(...) when the old code used `(q.mcqQuestionTitle || '')` directly.
  const titleRaw: any = q.mcqQuestionTitle;
  const titleAsString = (() => {
    if (typeof titleRaw === 'string') return titleRaw;
    if (Array.isArray(titleRaw)) {
      return titleRaw
        .filter((cb: any) => cb && cb.type === 'text')
        .map((cb: any) => String(cb.value ?? ''))
        .join(' ');
    }
    if (titleRaw && typeof titleRaw === 'object') {
      const fromKnown = titleRaw.text ?? titleRaw.value ?? titleRaw.title;
      if (typeof fromKnown === 'string') return fromKnown;
    }
    return '';
  })();

  return {
    ...makeDefaultBlock(id), id, dbId: q._id, origin: 'db', isDirty: false,
    // Carry the persisted source tag through — without this a later update
    // would silently wipe it (the update payload is a full replacement).
    source: q.source ?? null,
    type: mapApiTypeToInternal(q.mcqQuestionType || 'multiple_choice'),
    questionText: Array.isArray(titleRaw)
      ? titleRaw.filter((cb: any) => cb && cb.type === 'text').map((cb: any) => String(cb.value ?? '')).join(' ')
      : titleAsString,
    title: Array.isArray(titleRaw)
      ? titleRaw.filter((cb: any) => cb && cb.type === 'text').map((cb: any) => String(cb.value ?? '').replace(/<[^>]*>/g, '').trim()).filter(Boolean).join(' ') || 'Untitled Question'
      : titleAsString.replace(/<[^>]*>/g, '').trim() || 'Untitled Question',
    options: (q.mcqQuestionOptions || []).length > 0
      ? q.mcqQuestionOptions.map((o: any, oi: number) => ({
        id: o._id || `opt-${id}-${oi}`, text: o.text || '', isCorrect: o.isCorrect || false,
        imageUrl: o.imageUrl || o.image || o.optionImage || '',
        imageAlignment: (o.imageAlignment || 'center') as 'left' | 'center' | 'right',
        imageSizePercent: o.imageSizePercent || 60,
      }))
      : makeDefaultBlock(id).options,
    score: q.mcqQuestionScore ?? undefined,
    difficulty: (q.mcqQuestionDifficulty || '') as 'easy' | 'medium' | 'hard' | '',
    hasExplanation: !!(q.mcqQuestionDescription || q.explanation),
    explanation: q.mcqQuestionDescription || q.explanation || '',
    isRequired: q.mcqQuestionRequired || false,
    hasOtherOption: q.hasOtherOption || false,
    optionsPerRow: (q.mcqQuestionOptionsPerRow || 1) as 1 | 2 | 3 | 4,
    timeLimit: q.mcqQuestionTimeLimit || 2000,
    questionImageUrl: q.mcqQuestionImageUrl || q.questionImage || q.imageUrl || '',
    questionContent: (() => {
      try {
        const t = titleRaw;
        if (Array.isArray(t)) return t;
        if (typeof t === 'string' && t.trim()) {
          return [{ id: generateId('cb-text'), type: 'text' as const, value: t }];
        }
        // Object-shaped title (e.g. { text: '…' }) — use the normalized string.
        if (titleAsString.trim()) {
          return [{ id: generateId('cb-text'), type: 'text' as const, value: titleAsString }];
        }
        return [{ id: generateId('cb-text'), type: 'text' as const, value: '' }];
      } catch {
        return [{ id: generateId('cb-text'), type: 'text' as const, value: '' }];
      }
    })(),
    questionImageAlignment: (q.mcqQuestionImageAlignment || q.questionImageAlignment || 'center') as 'left' | 'center' | 'right',
    questionImageSizePercent: q.mcqQuestionImageSizePercent || q.questionImageSizePercent || 60,
    isActive: q.isActive !== undefined ? q.isActive : true, 
    sequence: q.sequence || 0,
    trueFalseAnswer: q.trueFalseAnswer ?? null, 
    shortAnswer: shortAnswerValue,  // ← Updated to load from correct answers
    numericAnswer: q.numericAnswer ?? null, 
    numericTolerance: q.numericTolerance ?? null,
    matchingPairs: (q.matchingPairs || []).length > 0
      ? q.matchingPairs.map((p: any) => ({ id: p._id || generateId(`pair-${id}`), left: p.left || '', right: p.right || '' }))
      : makeDefaultBlock(id).matchingPairs,
    orderingItems: (q.orderingItems || []).length > 0
      ? q.orderingItems.map((item: any) => ({ id: item._id || generateId(`ord-${id}`), text: item.text || '', order: item.order || 0 }))
      : makeDefaultBlock(id).orderingItems,
  };
};
  const filterQuestionsBySection = useCallback(
    (questions: any[]): any[] => {
      if (!currentSectionId && !currentSectionName) {
        return questions;
      }
      return questions.filter((q: any) => {
        if (q.sectionId && q.sectionId === currentSectionId) return true;
        if (!q.sectionId && q.sectionName && q.sectionName === currentSectionName) return true;
        return false;
      });
    },
    [currentSectionId, currentSectionName]
  );
  // Map a Question Bank record → editable QuestionBlock. Bank questions use
  // the same `mcq*` field names as DB questions, so we reuse the DB mapper
  // then overwrite origin/dbId so the save flow treats each as a NEW question
  // (POST, not PUT) — critical so nothing collides with the bank's source row.
  const buildBlockFromBankQuestion = (q: any): QuestionBlock => {
    const dbShaped = buildBlockFromDbQuestion(q);
    return {
      ...dbShaped,
      id: generateId('block-bank'),
      dbId: undefined,
      origin: 'new',
      isDirty: true,
      // Stamp provenance: the IMPORTING SURFACE's tag wins ('ai' for the AI
      // funnel, 'thirdParty' for platform imports, 'scratch-manual' for doc
      // imports) — a bank row's own historic tag must not re-bill a
      // different slice than the one the picker gated against.
      source: initialBankSource || q.source || 'scratch-bank',
      // Keep the bank origin id even though dbId is cleared — it is what the
      // server and picker use to reject a second import of the same bank doc.
      bankQuestionId: (q._id || (q as any).bankQuestionId || null) as any,
    };
  };

  const [questionBlocks, setQuestionBlocks] = useState<QuestionBlock[]>(() => {
    // When editing, start empty — fetchExercise will populate from DB
    if (isEditing) return [];

    // Bank flow: pre-load every selected question as a new editable block so
    // the teacher can review and Save & Continue without losing any of them.
    if (initialBankQuestions && initialBankQuestions.length > 0) {
      return initialBankQuestions.map((q, i) => {
        const block = buildBlockFromBankQuestion(q);
        return { ...block, sequence: i };
      });
    }

    if (initialData) {
      const arr = Array.isArray(initialData) ? initialData : [initialData];
      return arr.map((d: any, i: number) => {
        const id = d.id || `block-${i}-${Date.now()}`;
        return {
          ...makeDefaultBlock(id), id, origin: 'new' as const,
          type: mapApiTypeToInternal(d.questionType || 'multiple_choice'),
          questionText: d.questionTitle || d.questionText || d.title || '',
          options: d.options?.map((o: any, oi: number) => ({
            id: o.id || `opt-${i}-${oi}`, text: o.text || o.content || '',
            isCorrect: o.isCorrect || false, imageUrl: o.imageUrl || '',
            imageAlignment: o.imageAlignment || 'center', imageSizePercent: o.imageSizePercent || 60,
          })) || makeDefaultBlock(id).options,
          score: d.score || undefined, difficulty: d.difficulty || '',
          hasExplanation: d.hasExplanation || false, explanation: d.explanation || '',
          isRequired: d.isRequired || false, questionImageUrl: d.questionImageUrl || '',
          questionImageAlignment: d.questionImageAlignment || 'center',
          questionImageSizePercent: d.questionImageSizePercent || 60,
          optionsPerRow: d.optionsPerRow || 1,
        };
      });
    }

    return [makeDefaultBlock(generateId('block'), 0)];
  });
  const savedBlocks = questionBlocks.filter(
    b => savedQuestionIds.has(b.id) || (b.origin === 'db' && !b.isDirty)
  );
  useEffect(() => {
    const fetchExercise = async () => {
      if (!exerciseDbId) return;
      setLoadingExercise(true);
      try {
        // ── Prefer cached questions already passed via exerciseData ──────────
        const cachedQuestions = exerciseData?.fullExerciseData?.questions;
        if (cachedQuestions && cachedQuestions.length > 0) {
          const dbQuestions = filterQuestionsBySection(
            cachedQuestions.filter((q: any) => q.questionType === 'mcq')
          );
          const dbBlocks = dbQuestions.map((q: any) => buildBlockFromDbQuestion(q));
          const existingNewBlocks = questionBlocks.filter(b => b.origin === 'new');
          const nextBlocks = isEditing
            ? (dbBlocks.length > 0 ? dbBlocks : [makeDefaultBlock(generateId('block'), 0)])
            : (dbBlocks.length > 0 ? [...dbBlocks, ...existingNewBlocks] : questionBlocks);

          const nextIndex = initialQuestionId
            ? Math.max(0, dbBlocks.findIndex((b: any) => b.dbId === initialQuestionId))
            : isEditing ? 0 : dbBlocks.length; // ADD: go to new empty block at end

          // React 18 batches these automatically — no flash
          setQuestionBlocks(nextBlocks);
          setCurrentIndex(nextIndex);
          const initialSaved = new Set<string>(dbBlocks.map((b: QuestionBlock) => b.id));
          savedQuestionIdsRef.current = initialSaved;
          setSavedQuestionIds(initialSaved);
          return;
        }

        // ── Fallback: fetch from API ──────────────────────────────────────────
        const response = await exerciseApi.getExerciseById(exerciseDbId);
        const exercise = response?.data?.exercise;
        const dbQuestions = filterQuestionsBySection(
          (exercise?.questions || []).filter((q: any) => q.questionType === 'mcq')
        );
        const dbBlocks =
          dbQuestions.length > 0
            ? dbQuestions.map((q: any) => buildBlockFromDbQuestion(q))
            : [];
        setQuestionBlocks(prev => {
          const newBlocks = prev.filter(b => b.origin === 'new');
          return dbBlocks.length > 0 ? [...dbBlocks, ...newBlocks] : prev;
        });
        if (initialQuestionId) {
          const targetIdx = dbBlocks.findIndex(
            (b: any) => b.dbId === initialQuestionId
          );
          setCurrentIndex(targetIdx >= 0 ? targetIdx : 0);
        } else {
          setCurrentIndex(dbBlocks.length > 0 ? dbBlocks.length : 0);
        }
      } catch (error) {
        // ── Only toast if we have no fallback data ────────────────────────────
        const hasFallback =
          isEditing ||
          (exerciseData?.fullExerciseData?.questions?.length ?? 0) > 0;
        if (!hasFallback) {
          toast.error(
            'Failed to load questions',
            'Could not fetch existing questions from the database.'
          );
        }
      } finally {
        setLoadingExercise(false);
      }
    };
    fetchExercise();
  }, [exerciseDbId]);

  useEffect(() => {
    // Skip the localStorage hydration when bank questions are being reviewed —
    // a stale draft from a previous session would silently overwrite the
    // freshly-selected bank questions and the user would see an empty form
    // (the bug we're fixing). The bank-selected blocks are the authoritative
    // source for this flow.
    const hasBankSelection = !!(initialBankQuestions && initialBankQuestions.length > 0);
    if (hasBankSelection) {
      setHasLoadedFromStorage(true);
      return;
    }
    if (!isEditing && exerciseData?.id && !hasLoadedFromStorage) {
      const key = getStorageKey(exerciseData.id);
      if (key) {
        try {
          const saved = localStorage.getItem(key);
          if (saved) {
            const parsed: QuestionBlock[] = JSON.parse(saved);
            if (parsed?.length > 0) {
              setQuestionBlocks(prev => {
                const dbBlocks = prev.filter(b => b.origin === 'db');
                return [...dbBlocks, ...parsed.filter(b => b.origin === 'new')];
              });
            }
          }
        } catch (e) { }
      }
      setHasLoadedFromStorage(true);
    }
  }, [isEditing, exerciseData?.id, hasLoadedFromStorage, initialBankQuestions]);

  useEffect(() => {
    if (!isEditing && exerciseData?.id && hasLoadedFromStorage) {
      const key = getStorageKey(exerciseData.id);
      if (key) {
        const newBlocks = questionBlocks.filter(b => b.origin === 'new');
        if (newBlocks.some(b => b.questionText.replace(/<[^>]*>/g, '').trim() || b.options.some(o => o.text.trim()))) {
          localStorage.setItem(key, JSON.stringify(newBlocks));
        }
      }
    }
  }, [questionBlocks, isEditing, exerciseData?.id, hasLoadedFromStorage]);

  const clearDraft = () => { const key = getStorageKey(exerciseData?.id); if (key) localStorage.removeItem(key); };

  const safeIndex = Math.min(currentIndex, Math.max(0, questionBlocks.length - 1));
  const currentBlock = questionBlocks.length > 0 ? (questionBlocks[currentIndex] ?? questionBlocks[safeIndex]) : null;

  if (currentBlock && !richTextRefs.current[currentBlock.id]) {
    richTextRefs.current[currentBlock.id] = React.createRef<HTMLDivElement>();
  }

  useEffect(() => {
    if (!currentBlock) return;
    const hasText = (currentBlock.questionContent || [])
      .filter(cb => cb.type === 'text')
      .some(cb => (cb.value || '').replace(/<[^>]*>/g, '').trim().length > 0);
    setQuestionTextEmpty(prev => ({ ...prev, [currentBlock.id]: !hasText }));
  }, [currentBlock?.id]);

  useEffect(() => {
    if (!currentBlock || scoringType !== 'questionSpecific') { setShowScoreRed(false); return; }
    const hasCorrect = currentBlock.options.some(o => o.isCorrect) || currentBlock.trueFalseAnswer !== null;
    const hasScore = (Number(currentBlock.score) || 0) > 0;
    setShowScoreRed(hasCorrect && !hasScore);
  }, [currentBlock?.id, currentBlock?.options, currentBlock?.trueFalseAnswer, currentBlock?.score, scoringType]);

  // ─── CLOSE DROPDOWNS ON OUTSIDE CLICK ────────────────────────────────────────
  useEffect(() => {
    if (!showQTypeMenu && !showDifficultyMenu) return;
    const close = () => { setShowQTypeMenu(false); setShowDifficultyMenu(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showQTypeMenu, showDifficultyMenu]);

  // "Add Question via" dropdown — robust outside-click close. Uses a capture-phase
  // listener + ref containment so it fires even when the click lands on an element
  // that calls stopPropagation (option rows, the type/difficulty menus, etc.).
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

  const updateActiveFormats = () => {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    setActiveFormats(formats);
  };

  const execQuestionCommand = (cmd: string) => {
    document.execCommand(cmd, false);
    updateActiveFormats();
  };

  const updateBlock = useCallback((id: string, patch: Partial<QuestionBlock>) =>
    setQuestionBlocks(bs => bs.map(b => b.id === id
      ? { ...b, ...patch, isDirty: b.origin === 'db' ? true : b.isDirty } : b)), []);

  const updateOption = useCallback((bid: string, oid: string, patch: Partial<MCQOption>) =>
    setQuestionBlocks(bs => bs.map(b => b.id === bid
      ? { ...b, isDirty: b.origin === 'db' ? true : b.isDirty, options: b.options.map(o => o.id === oid ? { ...o, ...patch } : o) } : b)), []);

  const clearBlockError = (blockId: string, field: string) => {
    setErrors(prev => {
      const be = { ...(prev.blocks?.[blockId] || {}) };
      delete be[field];
      return { blocks: { ...prev.blocks, [blockId]: be } };
    });
  };

  const handleQuestionChange = (id: string, v: string) => {
    updateBlock(id, { questionText: v || '', title: v.replace(/<[^>]*>/g, '').trim() || 'Untitled Question' });
    const isEmpty = !v || v === '<br>' || v === '<p><br></p>' || v === '<p></p>';
    setQuestionTextEmpty(prev => ({ ...prev, [id]: isEmpty }));
    if (!isEmpty) clearBlockError(id, 'questionText');
  };

  const handleScoreChange = (blockId: string, rawValue: string) => {
    const cleaned = rawValue.replace(/[^0-9.]/g, '');
    const newScore = cleaned === '' ? undefined : (parseFloat(cleaned) || 0);
    const err = newScore !== undefined ? validateBlockScore(blockId, newScore) : null;
    setBlockMarksErrors(prev => ({ ...prev, [blockId]: err || '' }));
    updateBlock(blockId, { score: newScore });
    if (newScore && newScore > 0 && !err) clearBlockError(blockId, 'score');
  };

  const validateBlockScore = (blockId: string, newScore: number): string | null => {
    if (scoringType !== 'questionSpecific' || maxMcqMarks <= 0) return null;
    const otherMarks = questionBlocks.reduce((s, b) => b.id !== blockId ? s + (Number(b.score) || 0) : s, 0);
    if (otherMarks + newScore > maxMcqMarks) {
      const available = maxMcqMarks - otherMarks;
      return `Max allowed: ${Math.max(0, available).toFixed(1)} mark`;
    }
    return null;
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
      : b.questionText.replace(/<[^>]*>/g, '').trim().length > 0; if (!hasText || !b.type || !b.difficulty) return false;
    if (['multiple-choice', 'multiple-select', 'dropdown'].includes(b.type)) {
      if (b.options.filter(o => o.text.trim()).length < 2) return false;
      if (!b.options.some(o => o.isCorrect)) return false;
    }
    if (b.type === 'true-false' && b.trueFalseAnswer === null) return false;
    if (b.type === 'matching' && !b.matchingPairs?.every(p => p.left.trim() && p.right.trim())) return false;
    if (b.type === 'ordering' && !b.orderingItems?.every(item => item.text.trim())) return false;
    if (b.type === 'numeric' && b.numericAnswer === null) return false;
    if (scoringType === 'questionSpecific' && (Number(b.score) || 0) <= 0) return false;
    if (!isExplanationValid(b)) return false;
    return true;
  };

  const validateSingleBlock = (b: QuestionBlock): boolean => {
    const be: any = {};
    const _hasText = b.questionContent
      ? b.questionContent.filter(cb => cb.type === 'text').some(cb => (cb.value || '').replace(/<[^>]*>/g, '').trim().length > 0)
      : b.questionText.replace(/<[^>]*>/g, '').trim().length > 0;
    if (!_hasText) be.questionText = 'Question text is required'; if (!b.type) be.type = 'Select a question type';
    if (!b.difficulty) be.difficulty = 'Select a difficulty level';
    if (['multiple-choice', 'multiple-select', 'dropdown'].includes(b.type)) {
      if (b.options.filter(o => o.text.trim()).length < 2) be.options = 'At least 2 options required';
      if (!b.options.some(o => o.isCorrect)) be.correctAnswer = 'Mark at least one correct answer';
    }
    if (b.type === 'true-false' && b.trueFalseAnswer === null) be.trueFalse = 'Select True or False';
    if (b.type === 'matching' && !b.matchingPairs?.every(p => p.left.trim() && p.right.trim())) be.matching = 'Fill all matching pairs';
    if (b.type === 'ordering' && !b.orderingItems?.every(i => i.text.trim())) be.ordering = 'Fill all ordering items';
    if (b.type === 'numeric' && b.numericAnswer === null) be.numeric = 'Enter a numeric answer';
    if (scoringType === 'questionSpecific') {
      const scoreErr = validateBlockScore(b.id, Number(b.score) || 0);
      if (scoreErr) be.score = scoreErr;
      if ((Number(b.score) || 0) <= 0) be.score = be.score || 'Score required';
    }
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

  const handlePrevQuestion = () => {
    if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); mainScrollRef.current?.scrollTo({ top: 0 }); }
  };

  const handleNextQuestion = () => {
    if (!currentBlock) return;
    if (currentBlock.origin === 'db') { goToIndex(currentIndex + 1); return; }
    const valid = triggerValidationForBlock(currentBlock);
    if (!valid) return;
    goToIndex(currentIndex + 1);
  };

  // REPLACE WITH:
  const isLimitReached = (): boolean => {
    if (scoringType === 'equalDistribution') {
      if (totalMcqQuestions <= 0) return false;
      // Only count saved blocks toward the limit
      return savedBlocks.length >= totalMcqQuestions;
    }
    if (maxMcqMarks <= 0) return false;
    const usedMarks = savedBlocks.reduce((s, b) => s + (Number(b.score) || 0), 0);
    return (maxMcqMarks - usedMarks) < 0.1;
  };
  const limitReached = isLimitReached();

  // ── Per-source quota slices (Custom mix) ──────────────────────────────────
  // MCQ has no difficulty rows — its Custom split's per-source allocation is
  // the source's TOTAL across the distribution buckets (the settings UI
  // writes the single "Questions" row into the 'medium' bucket).
  // `includeStaged` (default) also bills UNSAVED blocks that carry real
  // content — so generating 2 AI questions immediately drops the AI slice to
  // 0 even before Save & Next; a blank editing slot costs nothing. Save-time
  // guards pass includeStaged=false to check committed rows only. Legacy
  // untagged rows bill no slice. Returns -1 when no slice cap applies.
  const mcqSrcRemaining = (src: 'scratch' | 'ai', includeStaged: boolean = true): number => {
    const fx: any = exerciseData?.fullExerciseData || {};
    if (scoringType !== 'equalDistribution' || totalMcqQuestions <= 0) return -1;

    const isCombinedEx = (fx.exerciseType === 'Combined') ||
      ((exerciseData?.exerciseType || '').toString().toLowerCase() === 'combined');
    let alloc: number;
    if (isCombinedEx) {
      // Combined: the exercise-wide customDistribution splits the PROGRAMMING
      // part — it must never cap MCQ adds. Only a separated MCQ source with
      // its own single-cell split (customDistributionMcq) caps this form.
      const mcqDist: any = fx.questionSourceMcq === 'custom' ? fx.customDistributionMcq : null;
      if (!mcqDist) return -1;
      const mcqDistTotal = (mcqDist.scratch || 0) + (mcqDist.ai || 0) + (mcqDist.thirdParty || 0);
      if (mcqDistTotal <= 0) return -1;
      alloc = mcqDist[src] || 0;
    } else {
      const dist: any = fx.questionSource === 'custom' ? fx.customDistribution : null;
      if (!dist) return -1;
      const buckets = ['easy', 'medium', 'hard'] as const;
      const distTotal = buckets.reduce((s, r) =>
        s + (dist[r]?.scratch || 0) + (dist[r]?.ai || 0) + (dist[r]?.thirdParty || 0), 0);
      if (distTotal <= 0) return -1; // matrix never filled — no slice caps
      alloc = buckets.reduce((s, r) => s + (dist[r]?.[src] || 0), 0);
    }
    const matchSrc = (b: QuestionBlock) => {
      const s = (b.source ?? '').toString();
      return src === 'ai' ? s === 'ai' : s.startsWith('scratch');
    };
    const committed = (b: QuestionBlock) => savedQuestionIds.has(b.id) || (b.origin === 'db' && !b.isDirty);
    const hasContent = (b: QuestionBlock) => {
      const txt = b.questionContent
        ? b.questionContent.filter(cb => cb.type === 'text').map(cb => String(cb.value ?? '')).join(' ')
        : (b.questionText || '');
      return txt.replace(/<[^>]*>/g, '').trim().length > 0;
    };
    const used = questionBlocks.filter(b =>
      matchSrc(b) && (committed(b) || (includeStaged && hasContent(b)))).length;
    return Math.max(0, alloc - used);
  };

  const markEmptyOptionsForBlock = (blockId: string) => {
    const block = questionBlocks.find(b => b.id === blockId);
    if (!block || !['multiple-choice', 'multiple-select', 'dropdown'].includes(block.type)) return;
    const emptyIds = new Set(block.options.filter(o => !o.text.trim()).map(o => o.id));
    if (emptyIds.size === 0) return;
    setEmptyOptWarnings(prev => ({ ...prev, [blockId]: new Set([...(prev[blockId] || []), ...emptyIds]) }));
  };

  const markAllEmptyOptions = () => {
    const newWarnings: { [blockId: string]: Set<string> } = {};
    questionBlocks.forEach(b => {
      if (!['multiple-choice', 'multiple-select', 'dropdown'].includes(b.type)) return;
      const emptyIds = new Set(b.options.filter(o => !o.text.trim()).map(o => o.id));
      if (emptyIds.size > 0) newWarnings[b.id] = emptyIds;
    });
    setEmptyOptWarnings(prev => {
      const merged = { ...prev };
      Object.entries(newWarnings).forEach(([bId, ids]) => { merged[bId] = new Set([...(merged[bId] || []), ...ids]); });
      return merged;
    });
  };

  const clearOptWarning = (blockId: string, optId: string) => {
    setEmptyOptWarnings(prev => {
      if (!prev[blockId]) return prev;
      const updated = new Set(prev[blockId]);
      updated.delete(optId);
      return { ...prev, [blockId]: updated };
    });
  };

  const addQuestionBlock = () => {
    if (currentBlock && currentBlock.origin !== 'db') {
      const valid = triggerValidationForBlock(currentBlock);
      if (!valid) return;
    }
    if (limitReached) {
      if (scoringType === 'equalDistribution') toast.warning('No questions remaining', 'All question slots are filled.');
      else toast.warning('No remaining marks left', 'All marks are allocated.');
      return;
    }
    const id = generateId('block');
    setQuestionBlocks(bs => {
      const newBlock = makeDefaultBlock(id, bs.length);
      setCurrentIndex(bs.length);   // ← use bs.length inside updater — always fresh
      return [...bs, newBlock];
    });
    setTimeout(() => mainScrollRef.current?.scrollTo({ top: 0 }), 50);
  };

  const duplicateQuestionBlock = () => {
    if (!currentBlock || !isBlockComplete(currentBlock)) return;
    const id = generateId('block');
    const duplicate: QuestionBlock = { ...currentBlock, id, origin: 'new', isDirty: false, dbId: undefined, sequence: questionBlocks.length };
    setQuestionBlocks(bs => [...bs, duplicate]);
    setCurrentIndex(questionBlocks.length);
    setTimeout(() => mainScrollRef.current?.scrollTo({ top: 0 }), 50);
  };

  const requestDelete = (idx: number) => setDeleteTarget({ blockIdx: idx });

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const targetIdx = deleteTarget.blockIdx;
    const block = questionBlocks[targetIdx];
    if (!block) { setDeleteTarget(null); return; }
    if (block.origin === 'db' && block.dbId) {
      setIsDeleting(true);
      try {
        await questionApi.deleteMCQQuestion(entityType, entityId, exerciseDbId, block.dbId, tabType, subcategory);
        setQuestionBlocks(prev => {
          const updated = prev.filter((_, i) => i !== targetIdx);
          const safe = updated.length > 0 ? updated : [makeDefaultBlock(generateId('block'), 0)];
          setTimeout(() => setCurrentIndex((ci: number) => Math.min(ci, Math.max(0, safe.length - 1))), 0);
          return safe;
        });
        toast.success('Question deleted', 'The question has been permanently removed.');
      } catch (err: any) {
        toast.error('Delete failed', err?.response?.data?.message?.[0]?.value || 'Could not delete the question.');
      } finally {
        setIsDeleting(false);
      }
    } else {
      setQuestionBlocks(prev => {
        const updated = prev.filter((_, i) => i !== targetIdx);
        const safe = updated.length > 0 ? updated : [makeDefaultBlock(generateId('block'), 0)];
        setTimeout(() => setCurrentIndex((ci: number) => Math.min(ci, Math.max(0, safe.length - 1))), 0);
        return safe;
      });
      toast.info('Question removed', 'The unsaved question has been discarded.');
    }
    setDeleteTarget(null);
  };

  const handleDeleteFromPreview = async (block: QuestionBlock, idx: number) => {
    if (block.origin === 'db' && block.dbId) {
      try {
        await questionApi.deleteMCQQuestion(entityType, entityId, exerciseDbId, block.dbId, tabType, subcategory);
        setQuestionBlocks(prev => {
          const updated = prev.filter(b => b.id !== block.id);
          const safe = updated.length > 0 ? updated : [makeDefaultBlock(generateId('block'), 0)];
          setCurrentIndex((ci: number) => Math.min(ci, Math.max(0, safe.length - 1)));
          return safe;
        });
        toast.success('Question deleted', 'The question has been permanently removed.');
      } catch (err: any) {
        toast.error('Delete failed', err?.response?.data?.message?.[0]?.value || 'Could not delete the question.');
        throw err;
      }
    } else {
      setQuestionBlocks(prev => {
        const updated = prev.filter(b => b.id !== block.id);
        const safe = updated.length > 0 ? updated : [makeDefaultBlock(generateId('block'), 0)];
        setCurrentIndex((ci: number) => Math.min(ci, Math.max(0, safe.length - 1)));
        return safe;
      });
      toast.info('Question removed', 'The unsaved question has been discarded.');
    }
  };

  // Option helpers
  const addOption = (bid: string) => setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
    ...b, isDirty: b.origin === 'db' ? true : b.isDirty,
    options: [...b.options, { id: generateId(`opt-${bid}`), text: '', isCorrect: false, imageAlignment: 'center' as const, imageSizePercent: 60 }]
  } : b));

  const addOtherOption = (bid: string) => setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
    ...b, isDirty: b.origin === 'db' ? true : b.isDirty, hasOtherOption: true,
    options: [...b.options, { id: generateId(`other-${bid}`), text: 'Other', isCorrect: false, imageAlignment: 'center' as const, imageSizePercent: 60 }]
  } : b));

  const removeOtherOption = (bid: string) => setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
    ...b, isDirty: b.origin === 'db' ? true : b.isDirty, hasOtherOption: false,
    options: b.options.filter(o => !o.id.includes('other-'))
  } : b));

  const updateOptionText = (bid: string, oid: string, t: string) => updateOption(bid, oid, { text: t });

  const setCorrectAnswer = (bid: string, oid: string) => {
    setQuestionBlocks(bs => bs.map(b => b.id === bid
      ? { ...b, isDirty: b.origin === 'db' ? true : b.isDirty, options: b.options.map(o => ({ ...o, isCorrect: o.id === oid })) } : b));
    clearBlockError(bid, 'correctAnswer');
  };

  const toggleCorrectAnswer = (bid: string, oid: string) => {
    setQuestionBlocks(bs => bs.map(b => b.id === bid
      ? { ...b, isDirty: b.origin === 'db' ? true : b.isDirty, options: b.options.map(o => o.id === oid ? { ...o, isCorrect: !o.isCorrect } : o) } : b));
    clearBlockError(bid, 'correctAnswer');
  };

  const removeOption = (bid: string, oid: string) => setQuestionBlocks(bs => bs.map(b =>
    b.id === bid && b.options.length > 2
      ? { ...b, isDirty: b.origin === 'db' ? true : b.isDirty, options: b.options.filter(o => o.id !== oid) } : b));

  // Matching helpers
  const addMatchingPair = (bid: string) => setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
    ...b, isDirty: b.origin === 'db' ? true : b.isDirty,
    matchingPairs: [...(b.matchingPairs || []), { id: generateId(`pair-${bid}`), left: '', right: '' }]
  } : b));
  const updateMatchingPair = (bid: string, pid: string, side: 'left' | 'right', val: string) =>
    setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
      ...b, isDirty: b.origin === 'db' ? true : b.isDirty,
      matchingPairs: (b.matchingPairs || []).map(p => p.id === pid ? { ...p, [side]: val } : p)
    } : b));
  const removeMatchingPair = (bid: string, pid: string) => setQuestionBlocks(bs => bs.map(b =>
    b.id === bid && (b.matchingPairs || []).length > 2 ? {
      ...b, isDirty: b.origin === 'db' ? true : b.isDirty,
      matchingPairs: (b.matchingPairs || []).filter(p => p.id !== pid)
    } : b));

  // Ordering helpers
  const addOrderingItem = (bid: string) => setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
    ...b, isDirty: b.origin === 'db' ? true : b.isDirty,
    orderingItems: [...(b.orderingItems || []), { id: generateId(`ord-${bid}`), text: '', order: (b.orderingItems?.length || 0) + 1 }]
  } : b));
  const updateOrderingItem = (bid: string, iid: string, val: string) =>
    setQuestionBlocks(bs => bs.map(b => b.id === bid ? {
      ...b, isDirty: b.origin === 'db' ? true : b.isDirty,
      orderingItems: (b.orderingItems || []).map(item => item.id === iid ? { ...item, text: val } : item)
    } : b));
  const removeOrderingItem = (bid: string, iid: string) => setQuestionBlocks(bs => bs.map(b =>
    b.id === bid && (b.orderingItems || []).length > 2 ? {
      ...b, isDirty: b.origin === 'db' ? true : b.isDirty,
      orderingItems: (b.orderingItems || []).filter(i => i.id !== iid).map((item, idx) => ({ ...item, order: idx + 1 }))
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
      return { ...b, isDirty: b.origin === 'db' ? true : b.isDirty, orderingItems: items.map((item, i) => ({ ...item, order: i + 1 })) };
    }));

  // Image helpers
  const handleQuestionImageUpload = (bid: string, file: File) => {
    const r = new FileReader();
    r.onload = e => { updateBlock(bid, { questionImageUrl: e.target?.result as string, questionImageAlignment: 'center', questionImageSizePercent: 60 }); setActiveImageToolbar({ type: 'question', blockId: bid }); };
    r.readAsDataURL(file);
  };
  const removeQuestionImage = (id: string) => { updateBlock(id, { questionImageUrl: '' }); setActiveImageToolbar(null); };
  const handleOptionImageUpload = (bid: string, oid: string, file: File) => {
    const r = new FileReader();
    r.onload = e => { updateOption(bid, oid, { imageUrl: e.target?.result as string, imageAlignment: 'center', imageSizePercent: 60 }); setActiveImageToolbar({ type: 'option', blockId: bid, optionId: oid }); };
    r.readAsDataURL(file);
  };
  const removeOptionImage = (bid: string, oid: string) => { updateOption(bid, oid, { imageUrl: '' }); setActiveImageToolbar(null); };
  // ─── CONTENT BLOCK HELPERS ───────────────────────────────────────────────────
  const deriveQuestionText = (content: ContentBlock[]) =>
    content.filter(cb => cb.type === 'text')
      .map(cb => (cb.value || '').replace(/<[^>]*>/g, '').trim())
      .filter(Boolean).join(' ');

  const syncQuestionText = (blockId: string, content: ContentBlock[]) => {
    const text = deriveQuestionText(content);
    updateBlock(blockId, {
      questionContent: content,
      questionText: text ? `<p>${text}</p>` : '',
      title: text || 'Untitled Question',
    });
    setQuestionTextEmpty(prev => ({ ...prev, [blockId]: !text }));
    if (text) clearBlockError(blockId, 'questionText');
  };

  const addCB = (blockId: string, type: ContentBlockType) => {
    const block = questionBlocks.find(b => b.id === blockId);
    if (!block) return;
    const newCb: ContentBlock = {
      id: generateId(`cb-${type}`),
      type,
      ...(type === 'code' ? { value: '', bgColor: '#1e1e1e' } : {}),
      ...(type === 'image' ? { url: '', alignment: 'center' as const, sizePercent: 60 } : {}),
      ...(type === 'text' ? { value: '' } : {}),
    };
    const blocks: ContentBlock[] = [...(block.questionContent || []), newCb];
    // auto-add empty text block after code or image so user can keep typing
    if (type === 'code' || type === 'image') {
      blocks.push({ id: generateId('cb-text'), type: 'text', value: '' });
    }
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
        cb.id === cbId ? { ...cb, url } : cb
      );
      const text = content.filter(cb => cb.type === 'text')
        .map(cb => (cb.value || '').replace(/<[^>]*>/g, '').trim())
        .filter(Boolean).join(' ');
      return {
        ...b,
        questionContent: content,
        questionText: text ? `<p>${text}</p>` : b.questionText,
        isDirty: b.origin === 'db' ? true : b.isDirty,
      };
    }));
  };
  // ✅ KEEP only this updated version
  const convertGeneratedToBlock = (q: GeneratedQuestion, sequence: number): Partial<QuestionBlock> => {
    const questionHtml = q.description ? `<p>${q.description}</p>` : '';

    const base: Partial<QuestionBlock> = {
      type: q.type || 'multiple-choice',
      questionText: questionHtml,
      title: q.title || `Question ${sequence + 1}`,
      questionContent: [
        {
          id: `gen-txt-${Date.now()}-${sequence}`,
          type: 'text' as const,
          value: questionHtml,
        },
      ],
      hasExplanation: !!q.explanation,
      explanation: q.explanation || '',
      difficulty: q.difficulty || '',
      score: q.points || undefined,
      optionsPerRow: 1,
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

  // sourceTag: 'ai' for the AI generator, 'scratch-manual' for .txt document
  // imports (which share this handler but bill the Manual quota slice).
  const handleAIGeneratedQuestions = (generatedQuestions: GeneratedQuestion[], sourceTag: string = 'ai') => {
    const computeScore = (): number | undefined => {
      if (scoringType === 'questionSpecific' && maxMcqMarks > 0) {
        const usedMarks = questionBlocks.reduce((s, b) => s + (Number(b.score) || 0), 0);
        const remaining = Math.max(0, maxMcqMarks - usedMarks);
        if (remaining > 0 && generatedQuestions.length > 0) return parseFloat((remaining / generatedQuestions.length).toFixed(2));
      }
      return undefined;
    };
    const autoScore = computeScore();
    const applyScore = (block: Partial<QuestionBlock>): Partial<QuestionBlock> =>
      ({ ...block, source: sourceTag, score: autoScore !== undefined ? autoScore : block.score });

    const currentIsFillable = currentBlock && currentBlock.origin !== 'db' && !isBlockComplete(currentBlock);
    if (currentIsFillable && generatedQuestions.length > 0) {
      const newFirstId = generateId('ai-fill');
      delete richTextRefs.current[currentBlock!.id];
      const filledBlock = { ...currentBlock!, ...applyScore(convertGeneratedToBlock(generatedQuestions[0], currentIndex)), id: newFirstId };
      const extra = generatedQuestions.slice(1).map((q, i) => {
        const id = generateId(`ai-extra-${i}`);
        return { ...makeDefaultBlock(id, currentIndex + i + 1), ...applyScore(convertGeneratedToBlock(q, currentIndex + i + 1)), id };
      });
      setQuestionBlocks(prev => { const before = prev.slice(0, currentIndex); const after = prev.slice(currentIndex + 1); return [...before, filledBlock, ...extra, ...after]; });
    } else {
      const blocks = generatedQuestions.map((q, i) => { const id = generateId(`ai-${i}`); return { ...makeDefaultBlock(id, questionBlocks.length + i), ...applyScore(convertGeneratedToBlock(q, questionBlocks.length + i)), id }; });
      setQuestionBlocks(prev => [...prev, ...blocks]);
      setCurrentIndex(questionBlocks.length);
    }
    toast.success(`${generatedQuestions.length} question${generatedQuestions.length > 1 ? 's' : ''} generated`, 'AI questions have been added.');
    if (autoScore !== undefined) toast.info('Marks distributed', `Each question assigned ${autoScore} mark${autoScore !== 1 ? 's' : ''} from remaining balance.`);
  };

  // ─── TRIGGER AI PANEL (from Add Options dropdown) ────────────────────────────
  const triggerAI = () => {
    setShowAddDropdown(false);
    setShowAIModal(true);
  };

  // ─── UPLOAD VIA DOCUMENT (.txt) ──────────────────────────────────────────────
  // Hidden file input is clicked from the "Add Question via" select. Parsed
  // questions are routed through the SAME handler the AI panel uses, so they
  // drop straight into the editor sorted by difficulty (Easy / Medium / Hard).
  const docInputRef = useRef<HTMLInputElement>(null);
  const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    try {
      const parsed = await parseQuestionsFile(file);
      if (!parsed.length) {
        toast.warning('No questions found', 'Could not parse any questions — check the .txt format (Q:, A) … D), Answer:, Difficulty:).');
        return;
      }
      handleAIGeneratedQuestions(parsed as unknown as GeneratedQuestion[], 'scratch-manual');
      toast.success(`${parsed.length} question${parsed.length > 1 ? 's' : ''} imported`, 'Parsed from the document and added by difficulty.');
    } catch (err: any) {
      toast.error('Upload failed', err?.message || 'Could not read the file.');
    }
  };

  // ─── BANK QUESTIONS HANDLER (Feature 2 + 3) ──────────────────────────────────
  const handleBankSelectedQuestions = (selected: any[]) => {
    if (!selected.length) return;

    // Compute fillability locally (same logic as isCurrentBlockFillable but self-contained)
    const currentIsFillable = !!(currentBlock && currentBlock.origin !== 'db' && !isBlockComplete(currentBlock));

    // Feature 2: slot / marks constraints
    // Use savedBlocks.length (committed questions only) — same baseline as isLimitReached()
    // so unsaved/empty slots don't incorrectly consume quota. Bank imports
    // bill the Manual slice, so a Custom mix further caps by that slice.
    const maxCount = (() => {
      if (scoringType !== 'equalDistribution' || totalMcqQuestions <= 0) return -1;
      const base = Math.max(currentIsFillable ? 1 : 0, totalMcqQuestions - savedBlocks.length);
      const scratchSlice = mcqSrcRemaining('scratch');
      return scratchSlice >= 0 ? Math.min(base, scratchSlice) : base;
    })();

    let toAdd = selected;
    if (maxCount === 0) {
      toast.warning('No slots available', 'All question slots are filled.');
      return;
    }
    if (maxCount > 0 && toAdd.length > maxCount) {
      toast.warning(
        `Only ${maxCount} slot${maxCount !== 1 ? 's' : ''} available`,
        `Using first ${maxCount} of ${selected.length} selected.`
      );
      toAdd = toAdd.slice(0, maxCount);
    }

    // Feature 2: distribute remaining marks for questionSpecific (same as AI)
    const computeScore = (): number | undefined => {
      if (scoringType === 'questionSpecific' && maxMcqMarks > 0) {
        const usedMarks = questionBlocks.reduce((s, b) => s + (Number(b.score) || 0), 0);
        const remaining = Math.max(0, maxMcqMarks - usedMarks);
        if (remaining > 0 && toAdd.length > 0) return parseFloat((remaining / toAdd.length).toFixed(2));
      }
      return undefined;
    };
    const autoScore = computeScore();

    // Convert bank question to editable QuestionBlock — handles all mcqQuestionTitle formats:
    // string | ContentBlock[] | legacy object {text:"..."} | undefined
    const bankToBlock = (q: any, seq: number): QuestionBlock => {
      const id = generateId('bank');

      const extractTitle = (): { text: string; contentBlocks: ContentBlock[] } => {
        const t = q.mcqQuestionTitle;
        if (!t) return { text: '', contentBlocks: [{ id: generateId('cb-text'), type: 'text' as const, value: '' }] };
        if (Array.isArray(t)) {
          const txt = t.filter((cb: any) => cb.type === 'text').map((cb: any) => cb.value || '').join(' ');
          return { text: txt, contentBlocks: t };
        }
        if (typeof t === 'string') {
          return { text: t, contentBlocks: [{ id: generateId('cb-text'), type: 'text' as const, value: t }] };
        }
        if (typeof t === 'object') {
          const txt = t.text || t.value || '';
          return { text: txt, contentBlocks: [{ id: generateId('cb-text'), type: 'text' as const, value: txt }] };
        }
        return { text: '', contentBlocks: [{ id: generateId('cb-text'), type: 'text' as const, value: '' }] };
      };
      const { text, contentBlocks } = extractTitle();

      const opts = (q.mcqQuestionOptions || []).length > 0
        ? q.mcqQuestionOptions.map((o: any, oi: number) => ({
          id: o._id || `opt-${id}-${oi}`,
          text: o.text || '',
          isCorrect: o.isCorrect || false,
          imageUrl: o.imageUrl || '',
          imageAlignment: (o.imageAlignment || 'center') as 'left' | 'center' | 'right',
          imageSizePercent: o.imageSizePercent || 60,
        }))
        : makeDefaultBlock(id).options;

      return {
        ...makeDefaultBlock(id, seq),
        id,
        origin: 'new' as const,
        isDirty: false,
        dbId: undefined,
        sequence: seq,
        // In-form bank picks always bill the Manual slice as 'scratch-bank' —
        // the import trim gates against that slice, so the billed slice must
        // match regardless of the bank row's historic tag.
        source: 'scratch-bank',
        // Bank origin id survives the dbId reset — drives duplicate-import
        // rejection on the server and in the picker.
        bankQuestionId: (q._id || (q as any).bankQuestionId || null) as any,
        type: mapApiTypeToInternal(q.mcqQuestionType || 'multiple_choice'),
        questionText: text,
        title: text.replace(/<[^>]*>/g, '').trim() || 'Untitled Question',
        questionContent: contentBlocks,
        options: opts,
        score: autoScore !== undefined ? autoScore : (q.mcqQuestionScore ?? undefined),
        difficulty: (q.mcqQuestionDifficulty || '') as 'easy' | 'medium' | 'hard' | '',
        hasExplanation: !!(q.mcqQuestionDescription || q.explanation),
        explanation: q.mcqQuestionDescription || q.explanation || '',
        isRequired: q.mcqQuestionRequired || false,
        optionsPerRow: (q.mcqQuestionOptionsPerRow || 1) as 1 | 2 | 3 | 4,
        trueFalseAnswer: q.trueFalseAnswer ?? null,
        shortAnswer: q.shortAnswer || '',
        numericAnswer: q.numericAnswer ?? null,
        numericTolerance: q.numericTolerance ?? null,
        matchingPairs: (q.matchingPairs || []).length > 0
          ? q.matchingPairs.map((p: any) => ({ id: p._id || generateId(`pair-${id}`), left: p.left || '', right: p.right || '' }))
          : makeDefaultBlock(id).matchingPairs,
        orderingItems: (q.orderingItems || []).length > 0
          ? q.orderingItems.map((item: any) => ({ id: item._id || generateId(`ord-${id}`), text: item.text || '', order: item.order || 0 }))
          : makeDefaultBlock(id).orderingItems,
      };
    };

    // Feature 3: insert questions sequentially from current position.
    // After adding, the user stays on the current question and uses Save & Next
    // to naturally flow through each pre-filled question one by one.
    if (currentIsFillable && toAdd.length > 0) {
      // Current slot is empty/incomplete → fill it with the first bank question,
      // insert the rest immediately after. User stays on this slot (now pre-filled).
      const newFirstId = generateId('bank-fill');
      delete richTextRefs.current[currentBlock!.id];
      const filledBlock = { ...currentBlock!, ...bankToBlock(toAdd[0], currentIndex), id: newFirstId };
      const extra = toAdd.slice(1).map((q, i) => bankToBlock(q, currentIndex + i + 1));
      setQuestionBlocks(prev => {
        const before = prev.slice(0, currentIndex);
        const after = prev.slice(currentIndex + 1);
        return [...before, filledBlock, ...extra, ...after];
      });
      // Stay on current index — user reviews pre-filled Q then clicks Save & Next
    } else {
      // Current slot is already saved/complete → insert ALL bank questions immediately
      // after current position. User stays here; Save & Next carries them through each one.
      const insertAt = currentIndex + 1;
      const newBlocks = toAdd.map((q, i) => bankToBlock(q, insertAt + i));
      setQuestionBlocks(prev => [
        ...prev.slice(0, insertAt),
        ...newBlocks,
        ...prev.slice(insertAt),
      ]);
      // Do NOT navigate — user stays on current question.
      // Next arrow is now enabled (new questions exist immediately after).
    }

    toast.success(
      `${toAdd.length} question${toAdd.length > 1 ? 's' : ''} added`,
      `${toAdd.length === 1 ? 'Question' : 'Questions'} inserted after Q${currentIndex + 1} — use Save & Next to review each one.`
    );
    if (autoScore !== undefined)
      toast.info('Marks distributed', `Each question assigned ${autoScore} mark${autoScore !== 1 ? 's' : ''} from remaining balance.`);
  };

  const base64ToFile = (b64: string, name: string): File | null => {
    try {
      const m = b64.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return null;
      const bytes = atob(m[2]);
      const buf = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
      return new File([buf], name, { type: m[1] });
    } catch { return null; }
  };

  const OPTION_BASED_TYPES: QuestionType[] = ['multiple-choice', 'multiple-select', 'dropdown'];

  // In equalDistribution mode the per-question mark is derived from the exercise
  // total (marksPerQuestion). CREATE already stamps this (see buildQuestionPayload),
  // but the UPDATE path sends the raw block.score — so an edited or re-saved
  // question keeps a stale per-question score and grading comes out wrong. Apply
  // the same normalization before any UPDATE so both paths agree. Question Specific
  // is left untouched (each question keeps its manually-entered marks).
  const withNormalizedScore = (b: QuestionBlock): QuestionBlock =>
    scoringType === 'equalDistribution' ? { ...b, score: marksPerQuestion } : b;

const buildQuestionPayload = (b: QuestionBlock, qi: number) => {
  const images: any[] = [];
  const html = b.questionText?.trim() || '<p></p>';
  const score = scoringType === 'equalDistribution' ? marksPerQuestion : (b.score ?? 0);

  const isOptionBased = OPTION_BASED_TYPES.includes(b.type);
  const correctOptions = isOptionBased ? b.options.filter(o => o.isCorrect) : [];
  
  // Handle correct answers based on question type
  let correctAnswers: string[] = [];
  
  if (isOptionBased) {
    // For option-based types (multiple-choice, multiple-select, dropdown)
    correctAnswers = b.type === 'multiple-select' 
      ? correctOptions.map(o => o.text.trim()) 
      : correctOptions.length ? [correctOptions[0].text.trim()] : [];
  } else if (b.type === 'short-answer') {
    // For short answer - store the expected answer
    correctAnswers = b.shortAnswer?.trim() ? [b.shortAnswer.trim()] : [];
  } else if (b.type === 'paragraph') {
    // For essay/paragraph - store the expected answer (if any)
    correctAnswers = b.shortAnswer?.trim() ? [b.shortAnswer.trim()] : [];
  } else if (b.type === 'true-false') {
    // For true/false - store as string representation
    correctAnswers = b.trueFalseAnswer !== null ? [String(b.trueFalseAnswer)] : [];
  } else if (b.type === 'numeric') {
    // For numeric - store as string
    correctAnswers = b.numericAnswer !== null ? [String(b.numericAnswer)] : [];
  } else if (b.type === 'matching') {
    // For matching - store pairs as JSON string
    correctAnswers = (b.matchingPairs || []).map(p => `${p.left}|${p.right}`);
  } else if (b.type === 'ordering') {
    // For ordering - store order as JSON string
    correctAnswers = (b.orderingItems || [])
      .sort((a, b) => a.order - b.order)
      .map(item => item.text.trim());
  }

  const opts = isOptionBased ? b.options.filter(o => o.text.trim()).map((o, oi) => {
    let imgPath = null;
    if (o.imageUrl?.startsWith('data:')) {
      const fn = `option_${b.id}_${o.id}_${Date.now()}.jpg`; imgPath = `/uploads/${fn}`;
      const f = base64ToFile(o.imageUrl, fn); if (f) images.push({ path: imgPath, file: f, type: 'option', qi, oi, blockId: b.id, optionId: o.id });
    } else if (o.imageUrl) imgPath = o.imageUrl;
    return { text: o.text.trim(), isCorrect: o.isCorrect, imageUrl: imgPath, imageAlignment: o.imageAlignment || 'left', imageSizePercent: o.imageSizePercent || 100 };
  }) : [];

  let qImgPath = null;
  if (b.questionImageUrl?.startsWith('data:')) {
    const fn = `question_${b.id}_${Date.now()}.jpg`; qImgPath = `/uploads/${fn}`;
    const f = base64ToFile(b.questionImageUrl, fn); if (f) images.push({ path: qImgPath, file: f, type: 'question', qi, blockId: b.id });
  } else if (b.questionImageUrl) qImgPath = b.questionImageUrl;

  const contentToStore = b.questionContent && b.questionContent.length > 0
    ? b.questionContent
    : [{ id: 'txt-1', type: 'text', value: html }];

  const q: any = {
    mcqQuestionTitle: contentToStore, 
    mcqQuestionType: mapInternalTypeToApi(b.type),
    mcqQuestionDifficulty: b.difficulty || undefined, 
    mcqQuestionScore: score,
    mcqQuestionTimeLimit: b.timeLimit || 0, 
    isActive: b.isActive !== undefined ? b.isActive : true,
    mcqQuestionOptionsPerRow: b.optionsPerRow || 1, 
    mcqQuestionOptions: opts,
    mcqQuestionCorrectAnswers: correctAnswers,  // ← This now works for all types
    mcqQuestionRequired: b.isRequired === true,
    hasOtherOption: b.hasOtherOption || false, 
    mcqQuestionImageUrl: qImgPath,
    mcqQuestionImageAlignment: b.questionImageAlignment || 'left',
    mcqQuestionImageSizePercent: b.questionImageSizePercent || 100,
    questionType: 'mcq',
    sequence: qi,
    hasExplanation: b.hasExplanation || false,
    questionContent: b.questionContent || [],
    sectionId: currentSectionId ?? null,
    sectionName: currentSectionName || undefined,
    // Question Source tag — drives the source badge and per-source quota
    // slices. Manually-authored blocks are stamped at makeDefaultBlock;
    // bank/AI/document ingresses stamp their own tags.
    source: b.source || 'scratch-manual',
    // Bank origin id rides to the server so duplicate imports are rejected.
    bankQuestionId: b.bankQuestionId || null,
  };
  
  // Add type-specific fields
  if (b.type === 'true-false') q.trueFalseAnswer = b.trueFalseAnswer;
  if (b.type === 'short-answer') q.shortAnswer = b.shortAnswer || '';
  if (b.type === 'paragraph') {
    // Essay: model answer used by the student-side auto-correction (word-overlap)
    q.essayAnswer = b.shortAnswer || '';
    q.shortAnswer = b.shortAnswer || '';  // legacy field kept in sync
  }
  if (b.type === 'numeric') { 
    q.numericAnswer = b.numericAnswer ?? null; 
    q.numericTolerance = b.numericTolerance ?? null; 
  }
  if (b.type === 'matching') q.matchingPairs = (b.matchingPairs || []).map(p => ({ left: p.left, right: p.right }));
  if (b.type === 'ordering') q.orderingItems = (b.orderingItems || []).map(i => ({ text: i.text, order: i.order }));
  if (b.hasExplanation && b.explanation?.trim()) { 
    q.mcqQuestionDescription = b.explanation.trim(); 
    q.explanation = b.explanation.trim(); 
  }
  
  return { question: q, images };
};

  const validateForm = (): boolean => {
    const newErrors: typeof errors = { blocks: {} };
    let valid = true;
    questionBlocks.filter(b => b.origin === 'new' || b.isDirty).forEach(b => {
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
      if (scoringType === 'questionSpecific') {
        const scoreErr = validateBlockScore(b.id, Number(b.score) || 0);
        if (scoreErr) { be.score = scoreErr; valid = false; }
        if ((Number(b.score) || 0) <= 0) { be.score = be.score || 'Score required'; valid = false; }
      }
      if (b.hasExplanation && !b.explanation?.replace(/<[^>]*>/g, '').trim()) { be.explanation = 'Explanation is required when enabled'; valid = false; }
      if (Object.keys(be).length) newErrors.blocks![b.id] = be;
    });
    setErrors(newErrors);
    return valid;
  };
  // ─── FIRST VALIDATION ERROR (for toast message) ──────────────────────────────
  const getFirstValidationError = (b: QuestionBlock): string | null => {
    const hasText = b.questionContent
      ? b.questionContent.filter(cb => cb.type === 'text').some(cb => (cb.value || '').replace(/<[^>]*>/g, '').trim().length > 0)
      : b.questionText.replace(/<[^>]*>/g, '').trim().length > 0;
    if (!hasText) return 'Question text is required';
    if (!b.type) return 'Select a question type';
    if (!b.difficulty) return 'Select a difficulty level';
    if (['multiple-choice', 'multiple-select', 'dropdown'].includes(b.type)) {
      if (b.options.filter(o => o.text.trim()).length < 2) return 'At least 2 options required';
      if (!b.options.some(o => o.isCorrect)) return 'Mark at least one correct answer';
    }
    if (b.type === 'true-false' && b.trueFalseAnswer === null) return 'Select True or False';
    if (b.type === 'matching' && !b.matchingPairs?.every(p => p.left.trim() && p.right.trim())) return 'Fill all matching pairs';
    if (b.type === 'ordering' && !b.orderingItems?.every(i => i.text.trim())) return 'Fill all ordering items';
    if (b.type === 'numeric' && b.numericAnswer === null) return 'Enter a numeric answer';
    if (scoringType === 'questionSpecific' && (Number(b.score) || 0) <= 0) return 'Score required';
    if (b.hasExplanation && !b.explanation?.replace(/<[^>]*>/g, '').trim()) return 'Explanation is required when enabled';
    return null;
  };

  // ─── PER-QUESTION SAVE ────────────────────────────────────────────────────────
  // ─── PER-QUESTION SAVE ────────────────────────────────────────────────────────
  const handleSaveCurrentQuestion = async (andNext: boolean, andFinish: boolean = false) => {
    if (!currentBlock) return;

    // Re-entry guard: blocks a rapid second click that beat React's state update
    // for `isSavingQuestion`. Without this, two clicks both pass the disabled
    // check and create duplicate DB rows. Released in the `finally` below.
    if (savingInFlightRef.current) return;
    savingInFlightRef.current = true;

    // Capture BEFORE any async state update — used later to decide navigation strategy
    const wasExistingQuestion = currentBlock.origin === 'db';

    // Per-source hard guard (Custom mix): staging more blocks than the slice
    // allows is possible (blocks are cheap to stage), but persisting them is
    // not — a NEW question whose slice is fully committed is refused here.
    if (!wasExistingQuestion) {
      const sTag = (currentBlock.source ?? '').toString();
      const sliceKey = sTag === 'ai' ? 'ai' as const : (sTag === '' || sTag.startsWith('scratch')) ? 'scratch' as const : null;
      if (sliceKey && mcqSrcRemaining(sliceKey, false) === 0) {
        toast.error(
          'Quota full',
          `All ${sliceKey === 'ai' ? 'AI' : 'Manual'} slots in the distribution are already saved. Delete a saved ${sliceKey === 'ai' ? 'AI' : 'Manual'} question to swap this one in.`,
        );
        savingInFlightRef.current = false;
        return;
      }
    }

    // ── If already saved and clean, just navigate (no API call needed) ──────
    // Exception: in equalDistribution mode the per-question mark is derived from
    // the exercise total. If a DB question's stored score doesn't match the
    // current marksPerQuestion (e.g. exercise total or question count changed
    // after the question was first saved), force a re-save through the UPDATE
    // path so the persisted mcqQuestionScore gets re-stamped — otherwise grading
    // keeps using the stale value.
    const needsScoreResync =
      currentBlock.origin === 'db' &&
      scoringType === 'equalDistribution' &&
      Number(currentBlock.score || 0) !== Number(marksPerQuestion || 0);
    // Use the ref alongside state — the ref is the only source that reflects a
    // save that just completed in a prior click whose React render hasn't yet
    // hit this closure. Without it, a fast double-click duplicates the question.
    const isAlreadySaved =
      savedQuestionIds.has(currentBlock.id) || savedQuestionIdsRef.current.has(currentBlock.id);
    const isSavedClean = isAlreadySaved && !currentBlock.isDirty && !needsScoreResync;
    const isDbClean = (currentBlock.origin === 'db' || isAlreadySaved) && !currentBlock.isDirty && !needsScoreResync;
    if (isSavedClean || isDbClean) {
      if (andNext) {
        const nextIndex = currentIndex + 1;
        if (nextIndex < questionBlocks.length) {
          goToIndex(nextIndex);
        } else {
          // No next block — check quota before deciding to create one or toast
          const usedSavedCount = savedBlocks.filter(b => b.id !== currentBlock.id).length + 1;
          const usedSavedMarks = savedBlocks
            .filter(b => b.id !== currentBlock.id)
            .reduce((s, b) => s + (Number(b.score) || 0), 0) + (Number(currentBlock.score) || 0);
          const canAddMore = scoringType === 'equalDistribution'
            ? (totalMcqQuestions <= 0 || usedSavedCount < totalMcqQuestions)
            : (maxMcqMarks <= 0 || (maxMcqMarks - usedSavedMarks) >= 0.1);
          if (canAddMore) {
            const id = generateId('block');
            setQuestionBlocks(bs => {
              const newBlock = makeDefaultBlock(id, bs.length);
              setCurrentIndex(bs.length);
              return [...bs, newBlock];
            });
            setTimeout(() => mainScrollRef.current?.scrollTo({ top: 0 }), 50);
          } else {
            toast.info('Last question', 'You are already on the last question.');
          }
        }
      } else if (andFinish) {
        // If already saved and Finish clicked, just close.
        // Intentionally DO NOT reset savingInFlightRef — onClose() runs in the
        // parent and the unmount happens on a later render, so a rapid second
        // click would otherwise slip in and fire onClose/toast again (and in
        // some closures re-enter the save path). Leaving the guard true blocks
        // any follow-up click until this component is gone.
        clearDraft();
        onClose();
        toast.success('All questions saved!', 'You can now preview the mock test.');
        return;
      }
      savingInFlightRef.current = false;
      return;
    }

    // Step 1: validate
    const valid = triggerValidationForBlock(currentBlock);
    if (!valid) {
      const firstError = getFirstValidationError(currentBlock);
      toast.error('Validation failed', firstError || 'Please fix all errors before saving.');
      savingInFlightRef.current = false;
      return;
    }
    if (blockMarksErrors[currentBlock.id]) {
      toast.error('Score error', blockMarksErrors[currentBlock.id]);
      savingInFlightRef.current = false;
      return;
    }

    setIsSavingQuestion(true);
    // When the andFinish path succeeds we call onClose() but the parent's
    // unmount lands on a later render — keep the guard locked across that gap.
    let didInitiateClose = false;
    try {
      if (currentBlock.origin === 'db' && currentBlock.dbId) {
        // ── UPDATE existing DB question ──────────────────────────────────────────
        await questionApi.updateMCQQuestion(
          entityType, entityId, exerciseDbId,
          currentBlock.dbId, withNormalizedScore(currentBlock), tabType, subcategory
        );
        setQuestionBlocks(prev =>
          prev.map(b => b.id === currentBlock.id ? { ...b, isDirty: false } : b)
        );
        savedQuestionIdsRef.current = new Set([...savedQuestionIdsRef.current, currentBlock.id]);
        setSavedQuestionIds(prev => new Set([...prev, currentBlock.id]));
        toast.success('Question updated', 'Changes have been saved.');
      } else {
        // ── CREATE new question ──────────────────────────────────────────────────
        const allImages: any[] = [];
        const { question, images } = buildQuestionPayload(currentBlock, 0);
        allImages.push(...images);

        const fd = new FormData();
        fd.append('questionsData', JSON.stringify([question]));
        fd.append('questionsData[0]', JSON.stringify(question));
        fd.append('tabType', tabType);
        fd.append('subcategory', subcategory);
        allImages.forEach(item =>
          fd.append(
            item.type === 'option' ? `question_0_option_${item.oi}_image` : `question_0_image`,
            item.file
          )
        );

        const response = await questionApi.addQuestion(
          entityType, entityId, exerciseDbId, fd, tabType, subcategory
        );
        clearDraft();

        // Try to capture the new DB ID from API response
        const newDbId = response?.data?.questions?.[0]?._id
          || response?.data?.question?._id
          || response?.data?._id
          || undefined;

        // Mark as saved in local state
        setQuestionBlocks(prev =>
          prev.map(b => b.id === currentBlock.id
            ? { ...b, origin: 'db' as const, isDirty: false, dbId: newDbId || b.dbId }
            : b
          )
        );
        savedQuestionIdsRef.current = new Set([...savedQuestionIdsRef.current, currentBlock.id]);
        setSavedQuestionIds(prev => new Set([...prev, currentBlock.id]));
        toast.success('Question saved', 'Question added to the exercise.');
      }

      // ── Save & Finish: close modal after save ─────────────────────────────
      if (andFinish) {
        didInitiateClose = true;
        clearDraft();
        onClose();
        toast.success('All questions saved!', 'Exercise is now complete.');
        return;
      }

      // Step 2: if Save & Next
      if (andNext) {
        const nextIndex = currentIndex + 1;

        // ── If a next block already exists in the list, just navigate to it ──
        if (nextIndex < questionBlocks.length) {
          goToIndex(nextIndex);
          return;
        }

        // ── No next block exists — check quota for both new and existing questions ──
        const updatedSavedMarks = savedBlocks
          .filter(b => b.id !== currentBlock.id)
          .reduce((s, b) => s + (Number(b.score) || 0), 0) + (Number(currentBlock.score) || 0);
        const updatedSavedCount = savedBlocks.filter(b => b.id !== currentBlock.id).length + 1;

        const canAdd = scoringType === 'equalDistribution'
          ? (totalMcqQuestions <= 0 || updatedSavedCount < totalMcqQuestions)
          : (maxMcqMarks <= 0 || (maxMcqMarks - updatedSavedMarks) >= 0.1);

        if (!canAdd) {
          toast.info('Last question', 'You are already on the last question.');
          return;
        }

        const id = generateId('block');
        setQuestionBlocks(bs => {
          const newBlock = makeDefaultBlock(id, bs.length);
          setCurrentIndex(bs.length);
          return [...bs, newBlock];
        });
        setTimeout(() => mainScrollRef.current?.scrollTo({ top: 0 }), 50);
      }
    } catch (err: any) {
      toast.error(
        'Save failed',
        err?.response?.data?.message?.[0]?.value || 'Could not save the question.'
      );
    } finally {
      setIsSavingQuestion(false);
      // Only release the re-entry guard if we're NOT closing the form.
      // Releasing it during the close window lets a queued double-click
      // re-enter handleSaveCurrentQuestion before unmount and duplicate
      // the close / toast (and on stale closures, the save itself).
      if (!didInitiateClose) savingInFlightRef.current = false;
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Same re-entry guard used by handleSaveCurrentQuestion — keeps a rapid
    // double-submit from sending two parallel batches of the same new blocks.
    if (savingInFlightRef.current) return;
    savingInFlightRef.current = true;
    try {
    markAllEmptyOptions();
    setValidationAttempted(prev => {
      const s = new Set(prev);
      questionBlocks.filter(b => b.origin === 'new' || b.isDirty).forEach(b => s.add(b.id));
      return s;
    });
    if (!validateForm()) {
      const firstErrorId = Object.keys(errors.blocks || {})[0];
      if (firstErrorId) { const idx = questionBlocks.findIndex(b => b.id === firstErrorId); if (idx >= 0) goToIndex(idx); }
      toast.error('Validation failed', 'Please fix all errors before saving.');
      return;
    }
    // Filter out blocks that were saved by handleSaveCurrentQuestion in the
    // same session but whose state may not yet reflect origin='db'. The ref
    // is the synchronous source of truth.
    const newBlocks = questionBlocks.filter(b => b.origin === 'new' && !savedQuestionIdsRef.current.has(b.id));
    const dirtyBlocks = questionBlocks.filter(b => b.isDirty && b.origin === 'db' && b.dbId);
    if (newBlocks.length === 0 && dirtyBlocks.length === 0) return;

    let updatedCount = 0;
    for (const b of dirtyBlocks) {
      try {
        await questionApi.updateMCQQuestion(entityType, entityId, exerciseDbId, b.dbId!, withNormalizedScore(b), tabType, subcategory);
        setQuestionBlocks(prev => prev.map(pb => pb.id === b.id ? { ...pb, isDirty: false } : pb));
        updatedCount++;
      } catch (err) { toast.error('Update failed', `Could not update question ${b.dbId?.slice(-6)}.`); }
    }
    if (updatedCount > 0) toast.success(`${updatedCount} question${updatedCount > 1 ? 's' : ''} updated`);

    if (newBlocks.length > 0) {
      try {
        const fd = new FormData();
        const allImages: any[] = [];
        const questions = newBlocks.map((b, qi) => { const { question, images } = buildQuestionPayload(b, qi); allImages.push(...images); return question; });
        fd.append('questionsData', JSON.stringify(questions));
        questions.forEach((q, i) => fd.append(`questionsData[${i}]`, JSON.stringify(q)));
        fd.append('tabType', tabType);
        fd.append('subcategory', subcategory);
        allImages.forEach(item => fd.append(item.type === 'option' ? `question_${item.qi}_option_${item.oi}_image` : `question_${item.qi}_image`, item.file));
        // ── Save directly via API — do NOT call onSave(fd) which closes the modal.
        // ── The modal must only close via "Save & Finish" (andFinish=true path).
        await questionApi.addQuestion(entityType, entityId, exerciseDbId, fd, tabType, subcategory);
        clearDraft();
        const savedIds = newBlocks.map(b => b.id);
        setQuestionBlocks(prev =>
          prev.map(b => savedIds.includes(b.id) ? { ...b, origin: 'db' as const, isDirty: false } : b)
        );
        savedQuestionIdsRef.current = new Set([...savedQuestionIdsRef.current, ...savedIds]);
        setSavedQuestionIds(prev => new Set([...prev, ...savedIds]));
        toast.success(
          `${newBlocks.length} question${newBlocks.length > 1 ? 's' : ''} saved`,
          'All questions have been saved to the exercise.'
        );
      } catch (err: any) {
        toast.error('Save failed', err?.response?.data?.message?.[0]?.value || 'Could not save questions.');
      }
    }
    } finally {
      savingInFlightRef.current = false;
    }
  };

  const handleCloseClick = () => {
    // Always confirm before closing — user explicitly wants a Yes/No prompt
    // on every X click regardless of whether there are unsaved changes.
    setShowCloseConfirmation(true);
  };

  const newBlocks = questionBlocks.filter(b => b.origin === 'new');
  const dirtyBlocks = questionBlocks.filter(b => b.isDirty);
  const allBlocksToSave = [...newBlocks, ...dirtyBlocks];
  const incompleteBlocks = allBlocksToSave.map((b, idx) => ({ block: b, idx: questionBlocks.indexOf(b) })).filter(({ block }) => !isBlockComplete(block));
  const allBlocksComplete = incompleteBlocks.length === 0;

  const getSaveDisabledReason = (): string => {
    if (allBlocksToSave.length === 0) return 'No changes to save';
    if (Object.values(blockMarksErrors).some(e => !!e)) return 'Fix score errors before saving';
    if (!allBlocksComplete) {
      const first = incompleteBlocks[0]; const b = first.block; const num = first.idx + 1;
      if (!b.questionText.replace(/<[^>]*>/g, '').trim()) return `Q${num}: Question text is empty`;
      if (!b.difficulty) return `Q${num}: Select a difficulty level`;
      if (['multiple-choice', 'multiple-select', 'dropdown'].includes(b.type)) {
        if (b.options.filter(o => o.text.trim()).length < 2) return `Q${num}: Need at least 2 options`;
        if (!b.options.some(o => o.isCorrect)) return `Q${num}: No correct answer marked`;
      }
      if (b.type === 'true-false' && b.trueFalseAnswer === null) return `Q${num}: Select True or False`;
      if (scoringType === 'questionSpecific' && (Number(b.score) || 0) <= 0) return `Q${num}: Score required`;
      if (b.hasExplanation && !b.explanation?.replace(/<[^>]*>/g, '').trim()) return `Q${num}: Explanation is required`;
    }
    return '';
  };

  const saveDisabledReason = isSaving ? '' : getSaveDisabledReason();
  const isSaveDisabled = isSaving || !!saveDisabledReason;
  const blockErr = currentBlock ? errors.blocks?.[currentBlock.id] : null;
  const blockMarksErr = currentBlock ? (blockMarksErrors[currentBlock.id] || errors.blocks?.[currentBlock.id]?.score || '') : '';
  const diff = diffConfig[currentBlock?.difficulty || ''];
  const qtype = currentBlock?.type ? typeConfig[currentBlock.type] : null;
  const exerciseName = exerciseData?.exerciseName || exerciseData?.fullExerciseData?.exerciseInformation?.exerciseName || '';
  const actionLabel = 'Add Question';
  const questionLabel = questionBlocks.length > 0 ? `Q ${currentIndex + 1} of ${questionBlocks.length}` : '';
  const isOnLastQuestion = currentIndex === questionBlocks.length - 1;
  // ── Project what limits look like AFTER saving current question ───────────
  const currentIsUnsaved = currentBlock
    ? !(savedQuestionIds.has(currentBlock.id) && !currentBlock.isDirty)
    && !(currentBlock.origin === 'db' && !currentBlock.isDirty)
    : false;

  const projectedSavedCount = savedBlocks.length + (currentIsUnsaved ? 1 : 0);
  const projectedUsedMarks = savedBlocks.reduce((s, b) => s + (Number(b.score) || 0), 0)
    + (currentIsUnsaved ? (Number(currentBlock?.score) || 0) : 0);

  // Save & Finish: scoring type determines which quota drives the button
  const isSaveAndFinish = (() => {
    // Custom Marks (questionSpecific): marks-based check takes full priority.
    // Show Save & Finish only when saving this question would use up the remaining marks.
    if (scoringType === 'questionSpecific' && maxMcqMarks > 0) {
      return projectedUsedMarks >= maxMcqMarks;
    }
    // Equal Distribution: position-based check.
    // Show Save & Finish when the current question number reaches the total required.
    if (scoringType === 'equalDistribution' && totalMcqQuestions > 0) {
      return (currentIndex + 1) >= totalMcqQuestions;
    }
    // No quota configured — fall back to last block in the list.
    return questionBlocks.length > 1 && currentIndex === questionBlocks.length - 1;
  })();

  const currentBlockIsValid = currentBlock ? isBlockComplete(currentBlock) : false;
  const isViewingDbBlock = currentBlock?.origin === 'db';
  const isCurrentValidationAttempted = validationAttempted.has(currentBlock?.id || '');
  const isCurrentBlockFillable = !!(currentBlock && currentBlock.origin !== 'db' && !isBlockComplete(currentBlock));
  const limitReachedForAI = limitReached && !isCurrentBlockFillable;

  const getAiLimitTooltip = (): string => {
    if (!limitReachedForAI) return '';
    if (scoringType === 'equalDistribution') return `All ${totalMcqQuestions} question slot${totalMcqQuestions !== 1 ? 's' : ''} are filled. Save to add more.`;
    return `No remaining marks left (${maxMcqMarks} marks fully allocated). Save to add more.`;
  };

  // ─── RENDER OPTION INPUTS ────────────────────────────────────────────────────
  const renderOptionInputs = (block: QuestionBlock) => {
    const isMultiSelect = block.type === 'multiple-select';
    const isDropdown = block.type === 'dropdown';
    const isAnswerKeyMode = answerKeyOpenBlockId === block.id;
    const filledOptions = block.options.filter(o => o.text.trim());
    const correctCount = block.options.filter(o => o.isCorrect).length;

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
                        <img src={opt.imageUrl} alt={`Option ${idx + 1}`} className="w-full h-auto rounded-lg max-h-48 object-contain"
                          style={{ border: '1.5px solid var(--lms-border)' }} />
                        {isOptionToolbarActive && (
                          <ImageToolbar alignment={opt.imageAlignment || 'center'} sizePercent={opt.imageSizePercent || 60}
                            onAlignmentChange={a => updateOption(block.id, opt.id, { imageAlignment: a })}
                            onSizeChange={v => updateOption(block.id, opt.id, { imageSizePercent: v })}
                            onRemove={() => removeOptionImage(block.id, opt.id)} onClose={() => setActiveImageToolbar(null)} />
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
                        updateOptionText(block.id, opt.id, e.target.value);
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
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--lms-success)', fontFamily: 'var(--lms-font)', whiteSpace: 'nowrap' }}>
                          Marked as correct answer
                        </span>
                      </span>
                    )}
                    <div className="flex-1" />
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/opt:opacity-100 transition-opacity">
                    {!isDropdown && (
                      <button type="button"
                        className="cursor-pointer p-1 rounded-md transition-colors hover:bg-slate-100"
                        title="Add image"
                        onClick={() => {
                          if (opt.imageUrl) {
                            toast.warning('Image exists', 'Option already has an image. Remove existing image first.');
                            return;
                          }
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
                      <button onClick={() => opt.id.includes('other-') ? removeOtherOption(block.id) : removeOption(block.id, opt.id)}
                        className="p-1 rounded-md transition-colors hover:bg-red-50">
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
          {/* {!isDropdown && !block.hasOtherOption && (
            <>
              <span style={{ color: 'var(--lms-text-hint)', fontSize: 13.5 }}>or</span>
              <button onClick={() => addOtherOption(block.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lms-text-sec)', fontSize: 13.5, fontWeight: 500, fontFamily: 'var(--lms-font)' }}>
                add "Other"
              </button>
            </>
          )} */}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={() => setAnswerKeyOpenBlockId(block.id)} className="lms-answer-key-btn">
            <div className="lms-answer-key-checkbox">
              <Check style={{ width: 10, height: 10, color: 'var(--lms-info)' }} strokeWidth={3} />
            </div>
            Answer key
          </button>
          {correctCount > 0 && (
            <span style={{ fontSize: 13, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
              ({correctCount} {correctCount === 1 ? 'answer' : 'answers'} selected)
            </span>
          )}
          {correctCount === 0 && filledOptions.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--lms-warning)', fontWeight: 500, fontFamily: 'var(--lms-font)' }}>— no correct answer set</span>
          )}
        </div>
        {blockErr?.correctAnswer && isCurrentValidationAttempted && (
          <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}>
            <AlertCircle className="h-3 w-3" />{blockErr.correctAnswer}
          </div>
        )}
      </div>
    );
  };

  // ─── RENDER ANSWER AREA ───────────────────────────────────────────────────────
  const renderAnswerArea = (block: QuestionBlock) => {
    if (!block.type) return null;

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
                {block.trueFalseAnswer !== null ? (
                  <span style={{ fontSize: 13, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>({block.trueFalseAnswer ? 'True' : 'False'} selected)</span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--lms-warning)', fontWeight: 500, fontFamily: 'var(--lms-font)' }}>— no correct answer set</span>
                )}
              </div>
              {blockErr?.trueFalse && isCurrentValidationAttempted && (
                <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}><AlertCircle className="h-3 w-3" />{blockErr.trueFalse}</div>
              )}
            </div>
          )}
        </div>
      );
    }

if (block.type === 'short-answer') {
  const isShortAnswerKeyMode = answerKeyOpenBlockId === block.id;
  
  return (
    <div className="px-5 py-4 flex-shrink-0">
      {isShortAnswerKeyMode ? (
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)', marginBottom: 10 }}>
            Enter the expected answer for this short answer question below, then click <strong style={{ color: 'var(--lms-success)' }}>Done</strong>.
          </p>
          <div className="space-y-2">
            <input
              type="text"
              value={block.shortAnswer || ''}
              onChange={e => {
                updateBlock(block.id, { shortAnswer: e.target.value });
                if (e.target.value.trim()) clearBlockError(block.id, 'shortAnswer');
              }}
              placeholder="Type the expected answer key here..."
              className="w-full text-sm outline-none p-3 rounded-lg transition-colors"
              style={{
                border: '1.5px solid var(--lms-border)',
                color: 'var(--lms-text-main)',
                fontFamily: 'var(--lms-font)',
                background: 'var(--lms-bg-white)',
              }}
            />
            {block.shortAnswer?.trim() && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--lms-success)', fontFamily: 'var(--lms-font)' }}>
                <Check className="h-3 w-3" />
                <span>Answer key saved</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button 
              type="button" 
              onClick={() => setAnswerKeyOpenBlockId(null)} 
              className="lms-ak-done-btn"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mt-1 px-1 py-1.5 flex items-center" style={{ borderBottom: '1.5px solid var(--lms-border)' }}>
            <span className="text-sm italic" style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>Short answer text</span>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => setAnswerKeyOpenBlockId(block.id)} 
                className="lms-answer-key-btn"
              >
                <div className="lms-answer-key-checkbox">
                  <Check style={{ width: 10, height: 10, color: 'var(--lms-info)' }} strokeWidth={3} />
                </div>
                Answer key
              </button>
              {block.shortAnswer?.trim() && (
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--lms-success)', fontFamily: 'var(--lms-font)' }}>
                  <Check className="h-3 w-3" />
                  Answer key set
                </span>
              )}
            </div>
            
            {block.shortAnswer?.trim() && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--lms-success-bg)', border: '1.5px solid var(--lms-success-bdr)' }}>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--lms-success)', fontFamily: 'var(--lms-font)' }}>Expected Answer</p>
                <p className="text-sm font-medium" style={{ color: '#14532d', fontFamily: 'var(--lms-font)' }}>
                  {block.shortAnswer}
                </p>
              </div>
            )}
            
            <p className="text-[11px] mt-3 italic" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
              {block.shortAnswer?.trim() 
                ? 'Click Answer key to edit the expected answer' 
                : 'Set an expected answer to help with grading'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

   if (block.type === 'paragraph') {
  const isEssayAnswerKeyMode = answerKeyOpenBlockId === block.id;
  
  return (
    <div className="px-5 py-4 flex-shrink-0">
      {isEssayAnswerKeyMode ? (
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)', marginBottom: 10 }}>
            Enter the expected answer for this essay question below, then click <strong style={{ color: 'var(--lms-success)' }}>Done</strong>.
          </p>
          <div className="space-y-2">
            <textarea
              value={block.shortAnswer || ''}
              onChange={e => {
                updateBlock(block.id, { shortAnswer: e.target.value });
                if (e.target.value.trim()) clearBlockError(block.id, 'shortAnswer');
              }}
              placeholder="Type the expected answer key here..."
              rows={5}
              className="w-full text-sm outline-none p-3 rounded-lg transition-colors"
              style={{
                border: '1.5px solid var(--lms-border)',
                color: 'var(--lms-text-main)',
                fontFamily: 'var(--lms-font)',
                background: 'var(--lms-bg-white)',
                resize: 'vertical'
              }}
            />
            {block.shortAnswer?.trim() && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--lms-success)', fontFamily: 'var(--lms-font)' }}>
                <Check className="h-3 w-3" />
                <span>Answer key saved</span>
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <button 
              type="button" 
              onClick={() => setAnswerKeyOpenBlockId(null)} 
              className="lms-ak-done-btn"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mt-1 px-1 py-1.5 flex items-center" style={{ borderBottom: '1.5px solid var(--lms-border)' }}>
            <span className="text-sm italic" style={{ color: 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)' }}>Long answer text</span>
          </div>
          
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => setAnswerKeyOpenBlockId(block.id)} 
                className="lms-answer-key-btn"
              >
                <div className="lms-answer-key-checkbox">
                  <Check style={{ width: 10, height: 10, color: 'var(--lms-info)' }} strokeWidth={3} />
                </div>
                Answer key
              </button>
              {block.shortAnswer?.trim() && (
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--lms-success)', fontFamily: 'var(--lms-font)' }}>
                  <Check className="h-3 w-3" />
                  Answer key set
                </span>
              )}
            </div>
            
            {block.shortAnswer?.trim() && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: 'var(--lms-success-bg)', border: '1.5px solid var(--lms-success-bdr)' }}>
                <p className="text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--lms-success)', fontFamily: 'var(--lms-font)' }}>Expected Answer</p>
                <p className="text-sm" style={{ color: '#14532d', fontFamily: 'var(--lms-font)', whiteSpace: 'pre-wrap' }}>
                  {block.shortAnswer}
                </p>
              </div>
            )}
            
            <p className="text-[11px] mt-3 italic" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
              {block.shortAnswer?.trim() 
                ? 'Click Answer key to edit the expected answer' 
                : 'Set an expected answer to help with grading'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

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
                  placeholder="Left item…"
                  className="flex-1 min-w-0 text-sm outline-none pb-0.5 transition-colors"
                  style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }}
                />
                <div className="flex-shrink-0 w-6 flex items-center justify-center">
                  <Equal className="h-3 w-3" style={{ color: 'var(--lms-text-hint)' }} />
                </div>
                <input type="text" value={pair.right} onChange={e => updateMatchingPair(block.id, pair.id, 'right', e.target.value)}
                  placeholder="Right item…"
                  className="flex-1 min-w-0 text-sm outline-none pb-0.5 transition-colors"
                  style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }}
                />
                <div className="w-7 flex-shrink-0 flex items-center justify-center">
                  {(block.matchingPairs || []).length > 2 && (
                    <button onClick={() => removeMatchingPair(block.id, pair.id)}
                      className="p-1.5 rounded-lg transition-colors opacity-0 group-hover/pair:opacity-100">
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
          {blockErr?.matching && isCurrentValidationAttempted && (
            <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}><AlertCircle className="h-3 w-3" />{blockErr.matching}</div>
          )}
        </div>
      );
    }

    if (block.type === 'ordering') {
      return (
        <div className="px-5 py-4 flex-shrink-0">
          <p className="lms-section-label">Correct Order (top = first)</p>
          <div className="space-y-1.5">
            {(block.orderingItems || []).map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2 group/item">
                <div className="flex flex-col gap-0.5 flex-shrink-0">
                  <button onClick={() => moveOrderingItem(block.id, item.id, 'up')} disabled={idx === 0}
                    className="p-0.5 rounded disabled:opacity-20 transition-colors hover:bg-slate-100">
                    <ChevronUp className="h-3 w-3" style={{ color: 'var(--lms-text-muted)' }} />
                  </button>
                  <button onClick={() => moveOrderingItem(block.id, item.id, 'down')} disabled={idx === (block.orderingItems?.length || 0) - 1}
                    className="p-0.5 rounded disabled:opacity-20 transition-colors hover:bg-slate-100">
                    <ChevronDown className="h-3 w-3" style={{ color: 'var(--lms-text-muted)' }} />
                  </button>
                </div>
                <span className="w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--lms-info-bg)', color: '#0891b2', fontFamily: 'var(--lms-font)' }}>{idx + 1}</span>
                <input type="text" value={item.text} onChange={e => updateOrderingItem(block.id, item.id, e.target.value)}
                  placeholder={`Item ${idx + 1}…`}
                  className="flex-1 min-w-0 text-sm outline-none pb-0.5 transition-colors"
                  style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }}
                />
                {(block.orderingItems || []).length > 2 && (
                  <button onClick={() => removeOrderingItem(block.id, item.id)}
                    className="p-1.5 rounded-lg transition-colors opacity-0 group-hover/item:opacity-100 flex-shrink-0">
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
          {blockErr?.ordering && isCurrentValidationAttempted && (
            <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}><AlertCircle className="h-3 w-3" />{blockErr.ordering}</div>
          )}
        </div>
      );
    }

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
                style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }}
              />
            </div>
            <div className="flex-1">
              <label className="lms-section-label block mb-1">Tolerance (±, optional)</label>
              <input type="number" value={block.numericTolerance ?? ''}
                onChange={e => updateBlock(block.id, { numericTolerance: e.target.value === '' ? null : parseFloat(e.target.value) })}
                placeholder="0" className="w-full text-sm outline-none pb-0.5 transition-colors"
                style={{ borderBottom: '1.5px solid var(--lms-border)', color: 'var(--lms-text-main)', fontFamily: 'var(--lms-font)', background: 'transparent' }}
              />
            </div>
          </div>
          {block.numericAnswer !== null && block.numericTolerance !== null && block.numericTolerance > 0 && (
            <p className="mt-2 text-[11px]" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>
              Accepted range: <span className="font-bold" style={{ color: 'var(--lms-text-main)' }}>{(block.numericAnswer! - block.numericTolerance!).toFixed(2)}</span>
              {' '}to{' '}
              <span className="font-bold" style={{ color: 'var(--lms-text-main)' }}>{(block.numericAnswer! + block.numericTolerance!).toFixed(2)}</span>
            </p>
          )}
          {blockErr?.numeric && isCurrentValidationAttempted && (
            <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}><AlertCircle className="h-3 w-3" />{blockErr.numeric}</div>
          )}
        </div>
      );
    }

    if (['multiple-choice', 'multiple-select', 'dropdown'].includes(block.type)) {
      return (
        <div className="px-5 py-3 flex-shrink-0">
          {blockErr?.options && isCurrentValidationAttempted && (
            <div className="mb-2 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)' }}>
              <AlertCircle className="h-3 w-3" />{blockErr.options}
            </div>
          )}
          {renderOptionInputs(block)}
        </div>
      );
    }
    return null;
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(26,26,46,0.55)', backdropFilter: 'blur(2px)', overflow: 'hidden', fontFamily: 'var(--lms-font)' }}>
      <ToastContainer toasts={toast.toasts} onRemove={toast.remove} />

      {/* ── Image Upload Modal ── */}
      {imgModal && (
        <ImageUploadModal
          onUpload={imgModal.onUpload}
          onClose={closeImgModal}
        />
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
            onClose={() => setShowBankSelector(false)}
            onBack={() => { setShowBankSelector(false); setShowAddDropdown(true); }}
            onSelect={(qs) => { setShowBankSelector(false); handleBankSelectedQuestions(qs); }}
            existingQuestionIds={(exerciseData?.fullExerciseData?.questions || []).flatMap((q: any) => [q._id, q.bankQuestionId]).filter(Boolean)}
            existingQuestions={exerciseData?.fullExerciseData?.questions || []}
          />
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
        style={{ background: 'var(--lms-bg-white)', borderBottom: '1.5px solid var(--lms-border)' }}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="lms-header-logo-mark">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <div className="h-5 w-px flex-shrink-0" style={{ background: 'var(--lms-border)' }} />
          <div className="min-w-0 flex-1">
            <QuestionFormBreadcrumb breadcrumbs={breadcrumbs || []} tabType={tabType} exerciseName={exerciseName} actionLabel={actionLabel} questionLabel={questionLabel} />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          {loadingExercise && (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-lg mr-2"
              style={{ color: 'var(--lms-orange)', background: 'var(--lms-orange-50)', border: '1.5px solid var(--lms-orange-100)', fontFamily: 'var(--lms-font)' }}>
              <Loader className="h-3 w-3 animate-spin" />Loading…
            </span>
          )}
          {dirtyBlocks.length > 0 && (
            <span className="lms-badge lms-badge-amber mr-2">
              <Edit2 className="h-2.5 w-2.5" />{dirtyBlocks.length} edited
            </span>
          )}

          <button
            onClick={() => setShowPreviewModal(true)}
            disabled={savedBlocks.length === 0}
            className="lms-btn lms-btn-ghost-violet mr-2"
            style={savedBlocks.length === 0 ? { opacity: 0.45, cursor: 'not-allowed' } : {}}
          >
            <Eye className="h-3.5 w-3.5" />Preview
            {savedBlocks.length > 0 && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'var(--lms-violet)', color: 'white' }}>
                {savedBlocks.length}
              </span>
            )}
          </button>

          {/* ── Add Question — simple select: pick Question Bank or Generate AI ── */}
          {!isEditing && <div ref={addDropdownRef} className="relative mr-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowAddDropdown(v => !v)}
              className="inline-flex items-center justify-between gap-2"
              style={{ minWidth: 150, height: 32, padding: '0 10px', borderRadius: 8, border: '1.5px solid #e4e4ed', background: '#fff', color: '#1a1a2e', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--lms-font)', cursor: 'pointer' }}
            >
              Add Question via
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
            {showAddDropdown && (
              <div
                className="absolute top-full right-0 mt-1.5 z-[9999] overflow-hidden"
                style={{ width: 220, background: '#fff', borderRadius: 12, border: '1px solid #e4e4ed', boxShadow: '0 8px 32px rgba(26,26,46,0.14)', fontFamily: 'var(--lms-font)' }}
              >
                {/* 2. Question Bank — hidden when questionSource forbids bank browse;
                    disabled when total slots OR the Manual quota slice is used up. */}
                {allowedSources.bank && (() => { const full = limitReachedForAI || mcqSrcRemaining('scratch') === 0; return (
                <button
                  onClick={() => { setShowAddDropdown(false); if (!full) setShowBankSelector(true); }}
                  disabled={full}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'none', border: 'none', cursor: full ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (!full) e.currentTarget.style.background = 'rgba(168,85,247,0.06)'; }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  title={full ? (limitReachedForAI ? getAiLimitTooltip() : 'All Manual slots in the distribution are used') : ''}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(168,85,247,0.1)' }}>
                    <Database size={14} style={{ color: '#a855f7' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Question Bank</div>
                    <div className="text-[10px]" style={{ color: full ? '#d97706' : '#8b8b9e' }}>
                      {full ? (limitReachedForAI ? 'Limit reached' : 'Manual quota full') : 'Import from bank'}
                    </div>
                  </div>
                </button>
                ); })()}

                {allowedSources.bank && allowedSources.ai && (
                  <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
                )}

                {/* 2. Generate AI — hidden when questionSource forbids AI;
                    disabled when total slots OR the AI quota slice is used up. */}
                {allowedSources.ai && (() => { const full = limitReachedForAI || mcqSrcRemaining('ai') === 0; return (
                <button
                  onClick={() => { if (!full) triggerAI(); else setShowAddDropdown(false); }}
                  disabled={full}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'none', border: 'none', cursor: full ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (!full) e.currentTarget.style.background = 'rgba(242,119,87,0.06)'; }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  title={full ? (limitReachedForAI ? getAiLimitTooltip() : 'All AI slots in the distribution are used') : ''}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(242,119,87,0.1)' }}>
                    <Sparkles size={14} style={{ color: '#F27757' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Generate AI</div>
                    <div className="text-[10px]" style={{ color: full ? '#d97706' : '#8b8b9e' }}>
                      {full ? (limitReachedForAI ? 'Limit reached' : 'AI quota full') : 'Auto-generate'}
                    </div>
                  </div>
                </button>
                ); })()}

                {(allowedSources.bank || allowedSources.ai) && allowedSources.upload && (
                  <div style={{ height: 1, background: '#f0f0f7', margin: '0 12px' }} />
                )}

                {/* 4. Upload via Document — hidden when questionSource forbids upload;
                    uploads bill the Manual slice, so it shares that full-state. */}
                {allowedSources.upload && (() => { const full = limitReachedForAI || mcqSrcRemaining('scratch') === 0; return (
                <button
                  onClick={() => { setShowAddDropdown(false); if (!full) docInputRef.current?.click(); }}
                  disabled={full}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'none', border: 'none', cursor: full ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={e => { if (!full) e.currentTarget.style.background = 'rgba(8,145,178,0.06)'; }}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  title={full ? (limitReachedForAI ? getAiLimitTooltip() : 'All Manual slots in the distribution are used') : ''}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(8,145,178,0.1)' }}>
                    <CloudUpload size={14} style={{ color: '#0891b2' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold" style={{ color: '#1a1a2e' }}>Upload via Document</div>
                    <div className="text-[10px]" style={{ color: full ? '#d97706' : '#8b8b9e' }}>
                      {full ? (limitReachedForAI ? 'Limit reached' : 'Manual quota full') : 'Import from .txt file'}
                    </div>
                  </div>
                </button>
                ); })()}
              </div>
            )}
            {/* Hidden file input for "Upload via Document" (.txt only) */}
            <input ref={docInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleDocumentSelected} />
          </div>}
          {/* AI modal — externalOpen drives visibility; z-index handled inside GenerateMCQAIQuestion */}
          {!limitReachedForAI && (
            <GenerateMCQAIQuestion
              breadcrumbs={breadcrumbs} exerciseData={exerciseData}
              onClose={() => setShowAIModal(false)}
              onSave={handleAIGeneratedQuestions}
              buttonText={null}
              externalOpen={showAIModal}
              onExternalOpenHandled={() => setShowAIModal(false)}
              scoringType={scoringType} marksPerQuestion={marksPerQuestion}
              maxSelectableCount={(() => {
                if (scoringType !== 'equalDistribution' || totalMcqQuestions <= 0) return -1;
                const base = Math.max(isCurrentBlockFillable ? 1 : 0, totalMcqQuestions - savedBlocks.length);
                // Custom mix: AI picks are further capped by the AI slice.
                const aiSlice = mcqSrcRemaining('ai');
                return aiSlice >= 0 ? Math.min(base, aiSlice) : base;
              })()}
              remainingMarks={scoringType === 'questionSpecific' && maxMcqMarks > 0
                ? Math.max(0, maxMcqMarks - questionBlocks.reduce((s, b) => s + (Number(b.score) || 0), 0))
                : undefined}
            />
          )}

          {!isEditing && exerciseData?.id && (
            <span className="text-[10px] font-semibold px-1.5 py-1 rounded-lg hidden sm:block mr-2"
              style={{ background: 'var(--lms-orange-50)', color: '#c85a30', border: '1.5px solid var(--lms-orange-100)', fontFamily: 'var(--lms-font)' }}>Auto-saved</span>
          )}

          <button onClick={handleEditExercise} className="lms-btn lms-btn-ghost-orange mr-2">
            <Settings2 className="h-3.5 w-3.5" />Edit Exercise
          </button>
          <button
            onClick={handleCloseClick}
            className="p-2 rounded-lg transition-colors cursor-pointer bg-red-100 hover:bg-red-200"
            style={{ color: 'var(--lms-text-muted)' }}
          >
            <X className="h-4 w-4 text-red-600" />
          </button>
        </div>
      </div>
      {/* ── BODY ── */}
      <div className="flex flex-1 min-h-0" style={{ overflow: 'hidden' }}>

        {/* ── EDITOR ── */}
        <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--lms-bg-white)', overflow: 'hidden' }}>
          <div ref={mainScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin', overscrollBehavior: 'contain', background: 'var(--lms-bg-white)' }}>
            {currentBlock ? (
              <div className="flex flex-col min-h-full" style={{ background: 'var(--lms-bg-white)' }}>

                {/* ── TOP STICKY ROW ── */}
                {(() => {
                  const isCurrentValidationAttempted2 = validationAttempted.has(currentBlock.id);
                  const needsDifficulty = isCurrentValidationAttempted2 && !currentBlock.difficulty;
                  const needsScore = isCurrentValidationAttempted2 && scoringType === 'questionSpecific' && !(Number(currentBlock.score) > 0);
                  return (
                    <>
                      {/* ── STICKY TOOLBAR ONLY ── */}
                      <div className="px-5 pt-3 pb-2 flex-shrink-0 sticky top-0 z-50" style={{ background: 'var(--lms-bg-white)', borderBottom: '1px solid var(--lms-border)' }}>
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Q# badge */}
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                            style={{ background: isViewingDbBlock ? 'var(--lms-success)' : 'var(--lms-orange)', boxShadow: `0 2px 8px ${isViewingDbBlock ? 'rgba(22,163,74,0.25)' : 'var(--lms-orange-glow)'}`, fontFamily: 'var(--lms-font)' }}>
                            {currentIndex + 1}
                          </div>
                          {currentBlock.origin === 'db' && (
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${currentBlock.isDirty ? 'lms-badge-amber' : 'lms-badge-green'}`}
                              style={{ border: '1px solid' }}>
                              {currentBlock.isDirty ? 'edited' : 'saved'}
                            </span>
                          )}

                          {/* Format buttons */}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            {(['bold', 'italic', 'underline'] as const).map((cmd, i) => {
                              const icons = [<Bold className="h-3.5 w-3.5" />, <Italic className="h-3.5 w-3.5" />, <Underline className="h-3.5 w-3.5" />];
                              return (
                                <button key={cmd} type="button" onMouseDown={e => { e.preventDefault(); execQuestionCommand(cmd); }}
                                  className={`lms-fmt-btn ${activeFormats.has(cmd) ? 'active' : ''}`} title={cmd.charAt(0).toUpperCase() + cmd.slice(1)}>
                                  {icons[i]}
                                </button>
                              );
                            })}
                            <div className="w-px h-3.5 mx-1 flex-shrink-0" style={{ background: 'var(--lms-border)' }} />
                            <button type="button" onClick={() => currentBlock && addCB(currentBlock.id, 'code')}
                              className="lms-fmt-btn" title="Insert code block">
                              <Code className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="lms-fmt-btn" title="Insert image block"
                              onClick={() => {
                                if (!currentBlock) return;
                                const hasImg = (currentBlock.questionContent || []).some(cb => cb.type === 'image');
                                if (hasImg) {
                                  toast.warning('Image exists', 'Question already has an image. Remove existing image first.');
                                  return;
                                }
                                const cbId = generateId('cb-img');
                                const txtId = generateId('cb-text');
                                const newBlocks: ContentBlock[] = [
                                  ...(currentBlock.questionContent || []),
                                  { id: cbId, type: 'image' as const, url: '', alignment: 'center' as const, sizePercent: 60 },
                                  { id: txtId, type: 'text' as const, value: '' },
                                ];
                                syncQuestionText(currentBlock.id, newBlocks);
                                openImgModal(url => {
                                  setImageCBUrl(currentBlock.id, cbId, url);
                                  closeImgModal();
                                });
                              }}>
                              <Image className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="flex-1" />

                          {/* Question Type */}
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
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--lms-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '6px 14px 2px', fontFamily: 'var(--lms-font)' }}>{group}</div>
                                    {types.map(t => (
                                      <div key={t}
                                        onClick={e => { e.stopPropagation(); updateBlock(currentBlock.id, { type: t as QuestionType }); setShowQTypeMenu(false); clearBlockError(currentBlock.id, 'type'); }}
                                        className="lms-diff-dropdown-item">
                                        <span style={{ color: typeConfig[t].color, display: 'flex', alignItems: 'center' }}>{typeConfig[t].icon}</span>
                                        <span style={{ color: 'var(--lms-text-main)', fontWeight: currentBlock.type === t ? 700 : 400 }}>{typeConfig[t].label}</span>
                                        {currentBlock.type === t && <Check style={{ width: 12, height: 12, color: 'var(--lms-orange)', marginLeft: 'auto' }} />}
                                      </div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Difficulty */}
                          {currentBlock.type && (
                            <div className="relative flex-shrink-0 group">
                              <button onClick={e => { e.stopPropagation(); setShowDifficultyMenu(v => !v); }}
                                className={`lms-diff-underline-btn ${currentBlock.difficulty ? 'has-value' : ''}`}
                                style={{
                                  color: currentBlock.difficulty ? diffConfig[currentBlock.difficulty].color : (needsDifficulty ? 'var(--lms-danger)' : 'var(--lms-text-hint)'),
                                  borderBottomColor: currentBlock.difficulty ? diffConfig[currentBlock.difficulty].color : (needsDifficulty ? 'var(--lms-danger-bdr)' : 'var(--lms-border)'),
                                  minWidth: 100,
                                }}>
                                {currentBlock.difficulty ? (
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: diffConfig[currentBlock.difficulty].dot, flexShrink: 0 }} />
                                ) : needsDifficulty ? (
                                  <AlertCircle style={{ width: 12, height: 12, color: 'var(--lms-danger)', flexShrink: 0 }} />
                                ) : null}
                                <span>{currentBlock.difficulty ? diffConfig[currentBlock.difficulty].label : 'Difficulty'}</span>
                                <svg className="diff-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6l4 4 4-4" /></svg>
                              </button>
                              {showDifficultyMenu && (
                                <div className="lms-diff-dropdown" onClick={e => e.stopPropagation()}>
                                  {(['easy', 'medium', 'hard'] as const).map(level => (
                                    <div key={level}
                                      onClick={e => { e.stopPropagation(); updateBlock(currentBlock.id, { difficulty: level }); setShowDifficultyMenu(false); clearBlockError(currentBlock.id, 'difficulty'); }}
                                      className="lms-diff-dropdown-item">
                                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: diffConfig[level].dot, flexShrink: 0 }} />
                                      <span style={{ color: diffConfig[level].color, fontWeight: currentBlock.difficulty === level ? 700 : 500 }}>{diffConfig[level].label}</span>
                                      {currentBlock.difficulty === level && <Check style={{ width: 12, height: 12, color: diffConfig[level].color, marginLeft: 'auto' }} />}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Score */}
                          {currentBlock.type && scoringType === 'questionSpecific' && (
                            <div className="relative flex-shrink-0 group mt-[3px]">
                              <div className={`lms-score-wrap ${(blockMarksErr || needsScore) ? 'score-err' : ''}`}>
                                <input type="number" min={0} step={0.5}
                                  value={currentBlock.score !== undefined ? currentBlock.score : ''}
                                  placeholder="0"
                                  onChange={e => handleScoreChange(currentBlock.id, e.target.value)}
                                  className={`lms-score-input ${(blockMarksErr || needsScore) ? 'score-err' : ''}`}
                                />
                                <span className={`lms-score-label ${(blockMarksErr || needsScore) ? '!text-red-400' : ''}`}>marks</span>
                              </div>
                              {(blockMarksErr || needsScore) && (
                                <div className="absolute top-full left-0 mt-1 z-50 whitespace-nowrap text-white text-[9px] font-semibold px-2 py-0.5 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                                  style={{ background: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                                  {blockMarksErr || 'Score required'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* ── CONTENT (non-sticky, scrolls naturally) ── */}
                      <div className="px-5 pt-3 pb-4">

                        {/* Question content blocks */}
                        {currentBlock.type ? (
                          <div>
                            {(currentBlock.questionContent || [{ id: `${currentBlock.id}-txt-1`, type: 'text' as const, value: '' }]).map((cb, cbIdx, arr) => {
                              if (cb.type === 'text') {
                                const isEmpty = !(cb.value || '').replace(/<[^>]*>/g, '').trim();
                                const isFirst = cbIdx === 0;
                                const showError = blockErr?.questionText && isCurrentValidationAttempted && isFirst && isEmpty;
                                return (
                                  <div key={cb.id} className="relative group/cb mb-1">
                                    <div
                                      contentEditable suppressContentEditableWarning
                                      onKeyUp={updateActiveFormats} onMouseUp={updateActiveFormats}
                                      onInput={e => {
                                        const val = e.currentTarget.innerHTML;
                                        const cbIdCaptured = cb.id;
                                        const blockIdCaptured = currentBlock.id;
                                        setQuestionBlocks(bs => bs.map(b => {
                                          if (b.id !== blockIdCaptured) return b;
                                          const content = (b.questionContent || []).map(c =>
                                            c.id === cbIdCaptured ? { ...c, value: val } : c
                                          );
                                          const text = content
                                            .filter(c => c.type === 'text')
                                            .map(c => (c.value || '').replace(/<[^>]*>/g, '').trim())
                                            .filter(Boolean).join(' ');
                                          return {
                                            ...b,
                                            questionContent: content,
                                            questionText: text ? `<p>${text}</p>` : '',
                                            title: text || 'Untitled Question',
                                            isDirty: b.origin === 'db' ? true : b.isDirty,
                                          };
                                        }));
                                        const hasText = val.replace(/<[^>]*>/g, '').trim().length > 0;
                                        setQuestionTextEmpty(prev => ({ ...prev, [blockIdCaptured]: !hasText }));
                                        if (hasText) clearBlockError(blockIdCaptured, 'questionText');
                                      }}
                                      ref={el => {
                                        if (!el) return;
                                        // sync DOM when value is empty (cleared) or on first mount
                                        if (el.innerHTML !== (cb.value || '')) {
                                          if (!cb.value || cb.value === '') {
                                            el.innerHTML = '';
                                          } else if (el.innerHTML === '') {
                                            el.innerHTML = cb.value;
                                          }
                                        }
                                      }}
                                      className="lms-q-text-editor focus:outline-none leading-relaxed pb-1.5 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                                      style={{
                                        borderBottom: showError ? '2px solid var(--lms-danger)' : '2px solid var(--lms-border)',
                                        minHeight: 38,
                                      }}
                                    />
                                    {isEmpty && (
                                      <div className="absolute top-0 left-0 pointer-events-none select-none"
                                        style={{ fontSize: 15, color: showError ? '#fca5a5' : 'var(--lms-text-hint)', fontFamily: 'var(--lms-font)', fontWeight: 400 }}>
                                        {showError ? 'Question text is required…' : isFirst ? 'Type your question here…' : 'Continue typing…'}
                                      </div>
                                    )}
                                    {arr.length > 1 && (
                                      <button onClick={() => removeCB(currentBlock.id, cb.id)}
                                        className="absolute top-0 right-0 p-1 rounded opacity-0 group-hover/cb:opacity-100 transition-opacity"
                                        style={{ color: 'var(--lms-text-hint)' }}>
                                        <X className="h-3 w-3" />
                                      </button>
                                    )}
                                  </div>
                                );
                              }

                              if (cb.type === 'code') {
                                return (
                                  <CodeBlock key={cb.id} cb={cb}
                                    onUpdate={patch => updateCB(currentBlock.id, cb.id, patch)}
                                    onRemove={() => removeCB(currentBlock.id, cb.id)}
                                  />
                                );
                              }

                              if (cb.type === 'image') {
                                return (
                                  <div key={cb.id} className="relative group/cb my-2">
                                    {cb.url ? (
                                      <ResizableImage
                                        cb={cb}
                                        onUpdate={patch => updateCB(currentBlock.id, cb.id, patch)}
                                        onRemove={() => removeCB(currentBlock.id, cb.id)}
                                      />
                                    ) : (
                                      <button type="button"
                                        onClick={() => openImgModal(url => { setImageCBUrl(currentBlock.id, cb.id, url); closeImgModal(); })}
                                        className="flex items-center justify-center gap-2 py-6 rounded-lg w-full transition-colors hover:bg-gray-50"
                                        style={{ border: '2px dashed var(--lms-border)', color: 'var(--lms-text-hint)' }}>
                                        <Image className="h-4 w-4" />
                                        <span className="text-sm" style={{ fontFamily: 'var(--lms-font)' }}>Click to upload image</span>
                                      </button>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            })}

                            {blockErr?.questionText && isCurrentValidationAttempted && (
                              <div className="mt-1.5 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                                <AlertCircle className="h-3 w-3 flex-shrink-0" />{blockErr.questionText}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 gap-1.5 text-center">
                            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--lms-orange)', fontFamily: 'var(--lms-font)' }}>Select a question type to get started</p>
                            <p style={{ fontSize: 14, color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)' }}>Choose a type from the dropdown above to begin.</p>
                          </div>
                        )}

                        {/* Question image (legacy) */}
                        {currentBlock.questionImageUrl && (
                          <div className="mt-3">
                            <div style={{ display: 'flex', justifyContent: currentBlock.questionImageAlignment === 'left' ? 'flex-start' : currentBlock.questionImageAlignment === 'right' ? 'flex-end' : 'center' }}>
                              <div style={{ width: `${currentBlock.questionImageSizePercent || 60}%` }} className="cursor-pointer relative"
                                onClick={() => setActiveImageToolbar(activeImageToolbar?.type === 'question' && activeImageToolbar.blockId === currentBlock.id ? null : { type: 'question', blockId: currentBlock.id })}>
                                <img src={currentBlock.questionImageUrl} alt="" className="w-full h-auto rounded-lg"
                                  style={{ border: '1.5px solid var(--lms-border)' }} />
                                {activeImageToolbar?.type === 'question' && activeImageToolbar.blockId === currentBlock.id && (
                                  <ImageToolbar
                                    alignment={currentBlock.questionImageAlignment || 'center'}
                                    sizePercent={currentBlock.questionImageSizePercent || 60}
                                    onAlignmentChange={a => updateBlock(currentBlock.id, { questionImageAlignment: a })}
                                    onSizeChange={v => updateBlock(currentBlock.id, { questionImageSizePercent: v })}
                                    onRemove={() => removeQuestionImage(currentBlock.id)}
                                    onClose={() => setActiveImageToolbar(null)} />
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* Explanation toggle */}
                {currentBlock.type && (
                  <div className="px-5 pt-2 pb-2 flex-shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer group w-fit">
                      <input type="checkbox" checked={currentBlock.hasExplanation}
                        onChange={() => updateBlock(currentBlock.id, { hasExplanation: !currentBlock.hasExplanation })}
                        style={{ width: 15, height: 15, accentColor: 'var(--lms-orange)', cursor: 'pointer' }}
                      />
                      <span className="flex items-center gap-1.5 transition-colors"
                        style={{ fontSize: 13.5, fontFamily: 'var(--lms-font)', fontWeight: 500, color: 'var(--lms-text-sec)' }}>
                        <HelpCircle className="h-3.5 w-3.5" />
                        Add Explanation
                        {currentBlock.hasExplanation && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded ml-1"
                            style={{ color: 'var(--lms-danger)', background: 'var(--lms-danger-bg)', fontFamily: 'var(--lms-font)' }}>*required</span>
                        )}
                      </span>
                    </label>
                    {currentBlock.hasExplanation && (
                      <div className="mt-3">
                        <RichTextEditor
                          value={currentBlock.explanation || ''}
                          onChange={v => { updateBlock(currentBlock.id, { explanation: v }); if (v.replace(/<[^>]*>/g, '').trim()) clearBlockError(currentBlock.id, 'explanation'); }}
                          placeholder="Explain the correct answer…" compact
                        />
                        {blockErr?.explanation && isCurrentValidationAttempted && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs" style={{ color: 'var(--lms-danger)', fontFamily: 'var(--lms-font)' }}>
                            <AlertCircle className="h-3 w-3 flex-shrink-0" />{blockErr.explanation}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic answer area */}
                {renderAnswerArea(currentBlock)}
                <div className="h-4 flex-shrink-0" />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-full" style={{ background: 'var(--lms-bg-white)' }}>
                <p className="text-sm" style={{ color: 'var(--lms-text-muted)', fontFamily: 'var(--lms-font)' }}>No question selected</p>
              </div>
            )}
          </div>
          <div className="flex-shrink-0 py-3" style={{ borderTop: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)', paddingLeft: 32, paddingRight: 32 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8 }}>

              {/* LEFT: empty spacer */}
              <div />

              {/* CENTER: Prev · counter · Next · Save&Next/Finish */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <button onClick={handlePrevQuestion} disabled={currentIndex === 0} className="lms-nav-btn flex-shrink-0">
                  <ChevronLeft className="h-3.5 w-3.5" />Prev
                </button>

                <span className="text-[12px] font-medium flex-shrink-0" style={{ color: 'var(--lms-text-sec)', fontFamily: 'var(--lms-font)', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--lms-orange)', fontWeight: 700 }}>{currentIndex + 1}</span>
                  <span style={{ color: 'var(--lms-text-hint)' }}> / </span>
                  {questionBlocks.length}
                </span>

                <button
                  onClick={() => goToIndex(currentIndex + 1)}
                  disabled={currentIndex >= questionBlocks.length - 1 || currentBlock?.origin === 'new'}
                  className="lms-nav-btn flex-shrink-0"
                  title={currentBlock?.origin === 'new' ? 'Save this question first before moving to the next' : undefined}
                >
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>

                {currentBlock && !isSaveAndFinish && (
                  <button
                    onClick={() => handleSaveCurrentQuestion(true)}
                    disabled={isSavingQuestion}
                    className="lms-btn flex-shrink-0"
                    style={{
                      background: 'var(--lms-orange)', color: 'white',
                      borderColor: 'transparent',
                      boxShadow: '0 2px 8px var(--lms-orange-glow)',
                      fontFamily: 'var(--lms-font)',
                    }}
                  >
                    {isSavingQuestion
                      ? <><Loader className="h-3.5 w-3.5 animate-spin" />Saving…</>
                      : <><CloudUpload className="h-3.5 w-3.5" />Save &amp; Next</>
                    }
                  </button>
                )}

                {/* Request Approve — only shows when this question has an open query */}
                {(() => {
                  const ap = approval || initialData?.approval || null;
                  const ctx = approvalContext || deriveApprovalContext(initialData, exerciseData, tabType);
                  if (!ap || !ctx) return null;
                  return (
                    <RequestApproveButton
                      approval={ap}
                      context={ctx}
                      onResolved={onQueryResolved || onClose}
                    />
                  );
                })()}

                {currentBlock && isSaveAndFinish && (
                  <>
                    <button
                      onClick={() => handleSaveCurrentQuestion(false, false)}
                      disabled={isSavingQuestion}
                      className="lms-btn flex-shrink-0"
                      style={{
                        background: 'var(--lms-orange)', color: 'white',
                        borderColor: 'transparent',
                        boxShadow: '0 2px 8px var(--lms-orange-glow)',
                        fontFamily: 'var(--lms-font)',
                      }}
                    >
                      {isSavingQuestion
                        ? <><Loader className="h-3.5 w-3.5 animate-spin" />Saving…</>
                        : <><CloudUpload className="h-3.5 w-3.5" />Save</>
                      }
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (savingInFlightRef.current || isSavingQuestion) return;
                        handleSaveCurrentQuestion(false, true);
                      }}
                      disabled={isSavingQuestion}
                      aria-busy={isSavingQuestion}
                      className="lms-btn flex-shrink-0"
                      style={{
                        background: isSavingQuestion ? 'var(--lms-bg-surface2)' : 'var(--lms-success)',
                        color: isSavingQuestion ? 'var(--lms-text-muted)' : 'white',
                        borderColor: 'transparent',
                        boxShadow: isSavingQuestion ? 'none' : '0 2px 8px rgba(22,163,74,0.25)',
                        fontFamily: 'var(--lms-font)',
                        cursor: isSavingQuestion ? 'not-allowed' : 'pointer',
                        opacity: isSavingQuestion ? 0.7 : 1,
                        transition: 'background .15s, opacity .15s',
                      }}
                    >
                      {isSavingQuestion
                        ? <><Loader className="h-3.5 w-3.5 animate-spin" />Finishing…</>
                        : <><Check className="h-3.5 w-3.5" />Finish</>
                      }
                    </button>
                    {(() => {
                      const ap = approval || initialData?.approval || null;
                      const ctx = approvalContext || deriveApprovalContext(initialData, exerciseData, tabType);
                      if (!ap || !ctx) return null;
                      return (
                        <RequestApproveButton
                          approval={ap}
                          context={ctx}
                          onResolved={onQueryResolved || onClose}
                        />
                      );
                    })()}
                  </>
                )}
              </div>

              {/* RIGHT: Saved indicator + Required + Delete + Duplicate + Clear */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>

                {currentBlock && (() => {
                  const isSavedClean = savedQuestionIds.has(currentBlock.id) && !currentBlock.isDirty;
                  const isDbClean = currentBlock.origin === 'db' && !currentBlock.isDirty;
                  const alreadySaved = isSavedClean || isDbClean;
                  return alreadySaved ? (
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
                    <button onClick={() => requestDelete(currentIndex)} className="lms-icon-btn lms-icon-btn-red">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="lms-tooltip lms-tooltip-right" style={{ background: 'var(--lms-danger)' }}>
                      Delete question
                      <div style={{ borderTopColor: 'var(--lms-danger)' }} />
                    </div>
                  </div>
                )}

                {currentBlock && (
                  <div className="lms-tooltip-wrap flex-shrink-0">
                    <button onClick={duplicateQuestionBlock} disabled={!currentBlockIsValid}
                      className={`lms-icon-btn ${currentBlockIsValid ? 'lms-icon-btn-violet' : 'lms-icon-btn-slate'}`}
                      style={!currentBlockIsValid ? { cursor: 'not-allowed', opacity: 0.45 } : {}}>
                      <Copy className="h-4 w-4" />
                    </button>
                    <div className="lms-tooltip lms-tooltip-right">{currentBlockIsValid ? 'Duplicate question' : 'Complete question first'}</div>
                  </div>
                )}

                {currentBlock && (
                  <div className="lms-tooltip-wrap flex-shrink-0">
                    <button onClick={() => {
                      const defaultBlock = makeDefaultBlock(currentBlock.id, currentIndex);
                      updateBlock(currentBlock.id, {
                        questionText: defaultBlock.questionText, questionContent: defaultBlock.questionContent,
                        options: defaultBlock.options, matchingPairs: defaultBlock.matchingPairs,
                        orderingItems: defaultBlock.orderingItems, trueFalseAnswer: defaultBlock.trueFalseAnswer,
                        shortAnswer: defaultBlock.shortAnswer, numericAnswer: defaultBlock.numericAnswer,
                        numericTolerance: defaultBlock.numericTolerance, hasExplanation: defaultBlock.hasExplanation,
                        explanation: defaultBlock.explanation, questionImageUrl: defaultBlock.questionImageUrl,
                        optionsPerRow: defaultBlock.optionsPerRow,
                      });
                      const ref = richTextRefs.current[currentBlock.id]?.current;
                      if (ref) ref.innerHTML = '';
                      setQuestionTextEmpty(prev => ({ ...prev, [currentBlock.id]: true }));
                      setErrors(prev => { const nb = { ...(prev.blocks || {}) }; delete nb[currentBlock.id]; return { blocks: nb }; });
                      setValidationAttempted(prev => { const s = new Set(prev); s.delete(currentBlock.id); return s; });
                      setEmptyOptWarnings(prev => { const n = { ...prev }; delete n[currentBlock.id]; return n; });
                      savedQuestionIdsRef.current = (() => { const s = new Set(savedQuestionIdsRef.current); s.delete(currentBlock.id); return s; })();
                      setSavedQuestionIds(prev => { const s = new Set(prev); s.delete(currentBlock.id); return s; });
                    }} className="lms-icon-btn lms-icon-btn-slate">
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
          {(() => {
            const _savedCount = savedBlocks.length;
            const _remainingQ = Math.max(0, totalMcqQuestions - _savedCount);
            const _usedMarks = scoringType === 'equalDistribution'
              ? _savedCount * marksPerQuestion
              : savedBlocks.reduce((s, b) => s + (Number(b.score) || 0), 0);
            const _isGraded = exerciseData?.fullExerciseData?.isGraded !== false;
            return (
              <div className="lms-sidebar-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 14px' }}>
                {/* Questions */}
                <div style={{ marginBottom: 14 }}>
                  <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                    <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                    <span>Questions</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalMcqQuestions || '—'}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Created</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                      {_savedCount}{totalMcqQuestions > 0 && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMcqQuestions}</span>}
                    </span>
                  </div>
                  {totalMcqQuestions > 0 && (
                    <>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Remaining</span>
                        <span className="lms-marks-value" style={{ color: _remainingQ === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{_remainingQ}</span>
                      </div>
                      <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                        <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_savedCount / totalMcqQuestions) * 100)}%`, background: _remainingQ === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                      </div>
                    </>
                  )}
                </div>
                {/* Marks */}
                {_isGraded && maxMcqMarks > 0 && (
                  <div style={{ borderTop: '1.5px solid var(--lms-border)', paddingTop: 14 }}>
                    <div className="lms-sidebar-section-title" style={{ fontSize: 11 }}>
                      <Award size={12} style={{ color: 'var(--lms-orange)' }} />
                      <span>Marks</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Per Question</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{marksPerQuestion}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Total</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{maxMcqMarks}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Used</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                        {_usedMarks}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{maxMcqMarks}</span>
                      </span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Remaining</span>
                      <span className="lms-marks-value" style={{ color: Math.max(0, maxMcqMarks - _usedMarks) === 0 ? 'var(--lms-success)' : 'var(--lms-violet)', fontSize: 12 }}>
                        {Math.max(0, maxMcqMarks - _usedMarks)}
                      </span>
                    </div>
                    <div className="lms-progress-bar" style={{ marginTop: 6 }}>
                      <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_usedMarks / maxMcqMarks) * 100)}%`, background: _usedMarks >= maxMcqMarks ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Mock + Close buttons */}
          <div className="flex-shrink-0 px-3 py-2.5 flex items-center gap-2"
            style={{ borderTop: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-white)' }}>
            <button
              type="button"
              onClick={() => setShowMockModal(true)}
              disabled={!isSaveAndFinish || !currentBlockIsValid || !savedQuestionIds.has(currentBlock?.id || '') && currentBlock?.origin !== 'db'}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isSaveAndFinish && currentBlockIsValid ? 'var(--lms-orange)' : 'var(--lms-bg-surface2)',
                color: isSaveAndFinish && currentBlockIsValid ? '#fff' : 'var(--lms-text-muted)',
                border: `1.5px solid ${isSaveAndFinish && currentBlockIsValid ? 'var(--lms-orange)' : 'var(--lms-border)'}`,
                fontFamily: 'var(--lms-font)',
                minWidth: '120px', // Add minimum width
                height: '36px', // Set fixed height
              }}
              title={!isSaveAndFinish ? 'Complete all required questions to enable Mock' : !currentBlockIsValid ? 'Fill in all fields for the last question first' : 'Preview all questions as a mock test'}>
              <Eye className="h-3.5 w-3.5" />
              Mock Preview
            </button>
            <button
              type="button"
              onClick={handleCloseClick}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: 'var(--lms-bg-surface2)',
                color: 'var(--lms-text-sec)',
                border: '1.5px solid var(--lms-border)',
                fontFamily: 'var(--lms-font)',
                minWidth: '120px', // Add same minimum width
                height: '36px', // Set same fixed height
              }}>
              <X className="h-3.5 w-3.5" />
              Close
            </button>
          </div>
        </div>
      </div>

      {/* ── Mock Modal ── */}
      {showMockModal && (
        <MockModal
          blocks={questionBlocks}
          onClose={() => setShowMockModal(false)}
        />
      )}

      {/* ── MODALS ── */}
      <PreviewModal
        isOpen={showPreviewModal} breadcrumbs={breadcrumbs} tabType={tabType}
        exerciseName={exerciseName} actionLabel="Preview" questionLabel={questionLabel}
        onClose={() => setShowPreviewModal(false)} blocks={savedBlocks} currentIndex={Math.min(currentIndex, Math.max(0, savedBlocks.length - 1))}
        onEdit={(idx) => { goToIndex(idx); }} onDeleteFromPreview={handleDeleteFromPreview}
        scoringType={scoringType} marksPerQuestion={marksPerQuestion} exerciseData={exerciseData}
        maxMcqMarks={maxMcqMarks} totalMcqQuestions={totalMcqQuestions} isSaving={isSaving}
        onSubmit={handleSubmit} isEditing={isEditing} blockMarksErrors={blockMarksErrors}
        saveProgress={saveProgress} saveMessage={saveMessage} saveDisabledReason={saveDisabledReason}
        isSaveDisabled={isSaveDisabled} showScoreRed={showScoreRed} isLimitReached={limitReached}
      />

      <DeleteConfirmationDialog
        isOpen={!!deleteTarget}
        questionTitle={deleteTarget ? (questionBlocks[deleteTarget.blockIdx]?.questionText?.replace(/<[^>]*>/g, '').trim() || 'Untitled question') : ''}
        onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} isDeleting={isDeleting}
      />

      <ConfirmationDialog
        isOpen={showCloseConfirmation}
        onConfirm={() => { setShowCloseConfirmation(false); clearDraft(); onClose(); }}
        onCancel={() => setShowCloseConfirmation(false)}
        newCount={questionBlocks.filter(b => b.origin === 'new' && (b.questionText.replace(/<[^>]*>/g, '').trim() || b.options.some(o => o.text.trim()))).length}
        dirtyCount={questionBlocks.filter(b => b.isDirty).length}
      />

      {/* Exercise Settings Modal */}
      {showExerciseSettings && (
        <ExerciseSettings
          hierarchyData={{
            CourseName: breadcrumbs?.[0]?.name || '', moduleName: breadcrumbs?.[1]?.name || '',
            submoduleName: breadcrumbs?.[2]?.name || '', topicName: breadcrumbs?.[3]?.name || '',
            subtopicName: breadcrumbs?.[4]?.name || '', nodeType: exerciseData?.nodeType || 'topic',
            level: breadcrumbs?.length || 0
          }}
          nodeId={exerciseData?.nodeId || ''} nodeName={exerciseData?.nodeName || exerciseName || ''}
          nodeType={exerciseData?.nodeType || 'topic'} subcategory={subcategory}
          onSave={handleExerciseSettingsSave} onClose={() => setShowExerciseSettings(false)}
          isEditing={true} tabType={tabType as 'I_Do' | 'We_Do' | 'You_Do'}
          initialData={exerciseSettingsData} exercise_Id={exerciseDbId}
        />
      )}

      {showDifficultyMenu && <div className="fixed inset-0 z-40" onClick={() => setShowDifficultyMenu(false)} />}
      {showQTypeMenu && <div className="fixed inset-0 z-40" onClick={() => setShowQTypeMenu(false)} />}

      {/* ── Exercise Details overlay modal ── */}
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
                  {exerciseName}
                </span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Exercise Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                  {exerciseData?.fullExerciseData?.exerciseType || 'mcq'}
                </span>
              </div>
              <div className="lms-detail-row" style={{ padding: '8px 16px' }}>
                <span className="lms-detail-label">Scoring Type</span>
                <span className="lms-detail-value" style={{ fontSize: 11 }}>
                  {scoringType === 'equalDistribution' ? 'Equal Distribution' : scoringType === 'questionSpecific' ? 'Question Specific' : scoringType}
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
              <button type="button" onClick={() => setSidebarTab(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 16px', borderRadius: 'var(--lms-radius-md)', fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 600, border: '1.5px solid var(--lms-border)', background: 'var(--lms-bg-surface)', color: 'var(--lms-text-sec)', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exercise Overview overlay modal ── */}
      {sidebarTab === 'overview' && (() => {
        const _savedCount = savedBlocks.length;
        const _remainingQ = Math.max(0, totalMcqQuestions - _savedCount);
        const _usedMarks = savedBlocks.reduce((s, b) => s + (Number(b.score) || 0), 0);
        const _isGraded = exerciseData?.fullExerciseData?.isGraded !== false;
        return (
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
                <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--lms-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Hash size={12} style={{ color: 'var(--lms-orange)' }} />
                    <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-orange)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Questions</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Total Questions</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-text-main)', fontSize: 12 }}>{totalMcqQuestions || '—'}</span>
                  </div>
                  <div className="lms-marks-row">
                    <span className="lms-marks-label">Created</span>
                    <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>
                      {_savedCount}{totalMcqQuestions > 0 && <span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{totalMcqQuestions}</span>}
                    </span>
                  </div>
                  {totalMcqQuestions > 0 && (
                    <>
                      <div className="lms-marks-row">
                        <span className="lms-marks-label">Remaining</span>
                        <span className="lms-marks-value" style={{ color: _remainingQ === 0 ? 'var(--lms-success)' : 'var(--lms-warning)', fontSize: 12 }}>{_remainingQ}</span>
                      </div>
                      <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                        <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_savedCount / totalMcqQuestions) * 100)}%`, background: _remainingQ === 0 ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
                      </div>
                    </>
                  )}
                </div>
                {_isGraded && maxMcqMarks > 0 && (
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Award size={12} style={{ color: 'var(--lms-violet)' }} />
                      <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, fontWeight: 700, color: 'var(--lms-violet)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall Marks</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Total Marks</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-violet)', fontSize: 12 }}>{maxMcqMarks}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Per Question</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-orange)', fontSize: 12 }}>{marksPerQuestion}</span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Marks Used</span>
                      <span className="lms-marks-value" style={{ color: 'var(--lms-warning)', fontSize: 12 }}>
                        {_usedMarks}<span style={{ color: 'var(--lms-text-hint)', fontWeight: 400, fontSize: 10 }}>/{maxMcqMarks}</span>
                      </span>
                    </div>
                    <div className="lms-marks-row">
                      <span className="lms-marks-label">Remaining</span>
                      <span className="lms-marks-value" style={{ color: Math.max(0, maxMcqMarks - _usedMarks) === 0 ? 'var(--lms-success)' : 'var(--lms-text-main)', fontSize: 12 }}>
                        {Math.max(0, maxMcqMarks - _usedMarks)}
                      </span>
                    </div>
                    <div className="lms-progress-bar" style={{ marginTop: 8 }}>
                      <div className="lms-progress-fill" style={{ width: `${Math.min(100, (_usedMarks / maxMcqMarks) * 100)}%`, background: _usedMarks >= maxMcqMarks ? 'var(--lms-success)' : 'var(--lms-orange)' }} />
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
        );
      })()}

      {/* ── Section Details overlay modal ── */}
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
              <button type="button" onClick={() => setSidebarTab(null)}
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

export default MCQQuestionForm;