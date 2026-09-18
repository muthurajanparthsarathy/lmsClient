// One-time CSS + font injection for the Programming question authoring form.
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
//
// The IIFE captures a private `injected` flag; the returned function is safe
// to call from any render pass — the second call is a no-op. Module state is
// shared across every importer, so this remains single-injection even when
// multiple components import the same helper.

// STYLE_ID: stable id on the injected <style> element so we can always find
// and REPLACE the previous copy in <head> instead of leaving a stale one
// behind. Without this, HMR would re-run the module and add a SECOND
// <style>, and depending on the browser cascade the older one could still
// win — that was the reason label caps kept "coming back" after CSS edits.
const STYLE_ID = 'lms-prog-question-form-styles';
const FONT_ID  = 'lms-prog-question-form-font';

export const injectFonts = (() => {
  return () => {
    if (typeof document === 'undefined') return;
    // Font link — insert once per document lifetime, keyed by id so
    // re-injection is safe and does not duplicate the network request.
    if (!document.getElementById(FONT_ID)) {
      const link = document.createElement('link');
      link.id = FONT_ID;
      link.rel = 'stylesheet';
      link.href =
        'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap';
      document.head.appendChild(link);
    }
    // Styles — always REPLACE the previous element so HMR / repeated
    // mounts pick up the latest tokens without leaving a stale sibling
    // in <head> that could win the cascade for identically-specific rules.
    const prev = document.getElementById(STYLE_ID);
    if (prev) prev.remove();
    const style = document.createElement('style');
    style.id = STYLE_ID;
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
      /* "/" separator between crumbs. Muted + light so it never competes
         with the crumb text; the last-crumb bold-orange styling in the
         Breadcrumb component draws the eye to "what am I doing". */
      .lms-breadcrumb-sep { color: var(--lms-text-hint); margin: 0 6px; font-weight: 400; font-size: 13px; font-family: var(--lms-font); }
      /* Regular crumbs sit at 500 (medium) so they read as secondary
         navigation, not headlines — leaves visual room for the final
         "you are here" crumb which is 700 + orange. */
      .lms-crumb {
        position: relative; font-family: var(--lms-font);
        font-size: 12.5px; font-weight: 500; cursor: default;
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
      /* Field labels for individual controls (Problem Title, Constraints,
         Test Cases, Hint, etc). 2026-08-30: dropped the small-caps look
         (10.5px uppercase 700) — that reads as dated shouty micro-headers
         and pushed the eye to labels instead of to the fields themselves.
         Now sentence-case, readable size, semibold — the numbered section
         headers (.lms-num-header) do the section-title work above them.
         SCOPED to .prog-root: the .lms-section-label class is defined by
         5 other form files that also inject into head (Database, Frontend,
         MCQ, FileMCQAnnotationForm, etc). Without the scope, whichever
         form mounted last wins the global cascade and this rule is
         silently overridden. The main form's outer div has the prog-root
         class, so the descendant selector always wins for this form and
         never touches the other forms. */
      .prog-root .lms-section-label {
        font-size: 12.5px !important; font-weight: 600 !important; color: var(--lms-text-main) !important;
        text-transform: none !important; letter-spacing: 0 !important;
        font-family: var(--lms-font); margin-bottom: 8px;
      }
      .prog-root .lms-section-label.lms-label-err { color: var(--lms-danger) !important; }

      /* ─── .prog-label — the field-label class the Programming form uses
         to sidestep the .lms-section-label multi-file cascade collision.
         Unique class name, defined nowhere else, so no !important juggling
         is needed. Every "Problem Title / Description / Constraints / Test
         Cases / Hint / Additional Hints" label in the Programming form now
         uses this instead of .lms-section-label. */
      .prog-label {
        font-family: var(--lms-font);
        font-size: 12.5px;
        font-weight: 600;
        color: var(--lms-text-main);
        text-transform: none;
        letter-spacing: 0;
        margin-bottom: 8px;
      }
      .prog-label-err { color: var(--lms-danger); }

      /* ─── NUMBERED SECTION HEADER (1. Question details, 2. Execution setup…) */
      .lms-num-header {
        display: flex; align-items: center; gap: 10px;
        font-family: var(--lms-font); font-size: 15px; font-weight: 700;
        color: var(--lms-text-main); margin: 4px 0 4px;
      }
      .lms-num-header-badge {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 24px; height: 24px; padding: 0 7px;
        border-radius: 6px; background: var(--lms-orange-50);
        color: #c85a30; border: 1.5px solid var(--lms-orange-100);
        font-family: var(--lms-font); font-size: 12px; font-weight: 800;
        line-height: 1;
      }
      .lms-num-header-sub {
        font-size: 11.5px; font-weight: 500; color: var(--lms-text-muted);
        margin-left: 4px;
      }

      /* ─── QUESTION DETAILS GRID (Title 6col + Category 3col + Marks 3col) ── */
      .lms-qdet-grid {
        display: grid; grid-template-columns: repeat(12, 1fr);
        gap: 14px; align-items: start;
      }
      .lms-qdet-col-6 { grid-column: span 6; }
      .lms-qdet-col-3 { grid-column: span 3; }
      .lms-qdet-col-12 { grid-column: span 12; }
      @media (max-width: 900px) {
        .lms-qdet-col-6, .lms-qdet-col-3 { grid-column: span 12; }
      }
      .lms-field-label {
        display: flex; align-items: center; gap: 4px;
        font-family: var(--lms-font); font-size: 12px; font-weight: 600;
        color: var(--lms-text-main); margin-bottom: 6px;
      }
      .lms-field-label-required { color: var(--lms-danger); font-weight: 700; }

      /* ─── TAGS INPUT (chips + add) ─────────────────────────────────────── */
      .lms-tags-wrap {
        display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
        width: 100%; padding: 7px 10px;
        background: var(--lms-bg-white); border: 1.5px solid var(--lms-border);
        border-radius: var(--lms-radius-md);
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .lms-tags-wrap:focus-within {
        border-color: var(--lms-orange);
        box-shadow: 0 0 0 3px var(--lms-orange-light);
      }
      .lms-tag-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 4px 3px 9px; border-radius: 6px;
        background: var(--lms-orange-50); color: #c85a30;
        border: 1px solid var(--lms-orange-100);
        font-family: var(--lms-font); font-size: 11.5px; font-weight: 600;
      }
      .lms-tag-chip-x {
        display: inline-flex; align-items: center; justify-content: center;
        width: 15px; height: 15px; border: none; background: transparent;
        color: #c85a30; cursor: pointer; border-radius: 3px;
        transition: background 0.12s;
      }
      .lms-tag-chip-x:hover { background: var(--lms-orange-100); }
      .lms-tag-input {
        flex: 1 1 90px; min-width: 90px; padding: 3px 2px;
        border: none; outline: none; background: transparent;
        font-family: var(--lms-font); font-size: 12.5px;
        color: var(--lms-text-main);
      }
      .lms-tag-input::placeholder { color: var(--lms-text-hint); }

      /* ─── CATEGORY DROPDOWN (native select styled) ─────────────────────── */
      .lms-select {
        width: 100%; padding: 9px 32px 9px 12px; font-size: 13.5px;
        border-radius: var(--lms-radius-md); border: 1.5px solid var(--lms-border);
        background: var(--lms-bg-white); color: var(--lms-text-main);
        font-family: var(--lms-font); font-weight: 500; outline: none;
        appearance: none; cursor: pointer;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2355556e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
        background-repeat: no-repeat; background-position: right 10px center;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .lms-select:focus { border-color: var(--lms-orange); box-shadow: 0 0 0 3px var(--lms-orange-light); }
      .lms-select:disabled { background-color: var(--lms-bg-surface); color: var(--lms-text-muted); cursor: not-allowed; }

      /* ─── COLLAPSIBLE (Hints & advanced settings) ─────────────────────── */
      .lms-collapsible {
        border: 1.5px solid var(--lms-border); border-radius: var(--lms-radius-md);
        background: var(--lms-bg-white); overflow: hidden;
      }
      .lms-collapsible-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 12px 14px; width: 100%;
        background: var(--lms-bg-surface); border: none; cursor: pointer;
        font-family: var(--lms-font); font-size: 13px; font-weight: 700;
        color: var(--lms-text-main); transition: background 0.13s;
      }
      .lms-collapsible-head:hover { background: var(--lms-bg-surface2); }
      .lms-collapsible-body {
        padding: 14px; display: flex; flex-direction: column; gap: 14px;
        border-top: 1.5px solid var(--lms-border);
      }

      /* ─── EDITOR META STRIP (Markdown supported · N / 5,000) ───────────── */
      .lms-editor-meta {
        display: flex; align-items: center; justify-content: space-between;
        margin-top: 6px; font-family: var(--lms-font); font-size: 11px;
        color: var(--lms-text-muted);
      }

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
