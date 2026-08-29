"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Maximize2, X } from 'lucide-react';

/**
 * Shared "Code Setup" section for the question-authoring forms.
 *
 *   Programming / SQL → single-string editors (one language)
 *   Frontend          → each editor has HTML / CSS / JS tabs
 *
 * Starter Code   → optional; shown to students as the initial editor content
 * Solution Code  → required (author-only); never sent to the learner attempt UI
 *
 * The section is intentionally hidden by the parent in "Question Link" mode —
 * this component itself does not read that flag.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FrontendCode {
  html: string;
  css: string;
  javascript: string;
}

export const EMPTY_FRONTEND: FrontendCode = { html: '', css: '', javascript: '' };

export const normalizeFrontendCode = (v: any): FrontendCode => ({
  html: typeof v?.html === 'string' ? v.html : '',
  css: typeof v?.css === 'string' ? v.css : '',
  javascript: typeof v?.javascript === 'string' ? v.javascript : (typeof v?.js === 'string' ? v.js : ''),
});

// ─── Small style tokens ─────────────────────────────────────────────────────

const CARD_BORDER = '1px solid #E2E8F0';
const CARD_RADIUS = 12;
const CARD_BG = '#ffffff';
const EDITOR_BG = '#F8FAFC';
const GUTTER_FG = '#94A3B8';
const CODE_FG = '#1a1a2e';
const MONO = 'ui-monospace, "SF Mono", "Fira Code", "Courier New", monospace';
const EDITOR_HEIGHT = 210;
const STACK_BREAKPOINT = 900;

// ─── Reusable line-numbered textarea (existing "code editor" style) ────────

const LinedTextarea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  height?: number | string;
}> = ({ value, onChange, disabled, placeholder, ariaLabel, height = EDITOR_HEIGHT }) => {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = Math.max(1, (value || '').split('\n').length);

  return (
    <div style={{ position: 'relative', height, background: EDITOR_BG, display: 'flex', overflow: 'hidden' }}>
      <div
        ref={gutterRef}
        aria-hidden
        style={{
          width: 40,
          padding: '10px 8px 10px 10px',
          background: EDITOR_BG,
          color: GUTTER_FG,
          fontFamily: MONO,
          fontSize: 12,
          lineHeight: 1.7,
          textAlign: 'right',
          userSelect: 'none',
          borderRight: '1px solid #E2E8F0',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} style={{ height: '1.7em' }}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={() => { if (gutterRef.current && taRef.current) gutterRef.current.scrollTop = taRef.current.scrollTop; }}
        onKeyDown={e => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const val = e.currentTarget.value;
            onChange(val.substring(0, start) + '  ' + val.substring(end));
            setTimeout(() => { if (taRef.current) taRef.current.selectionStart = taRef.current.selectionEnd = start + 2; }, 0);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        aria-label={ariaLabel}
        style={{
          flex: 1,
          height: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: CODE_FG,
          fontFamily: MONO,
          fontSize: 13,
          lineHeight: 1.7,
          padding: '10px 12px',
          resize: 'none',
          boxSizing: 'border-box',
          tabSize: 2,
        }}
      />
    </div>
  );
};

// ─── Pills ──────────────────────────────────────────────────────────────────

const OptionalPill: React.FC = () => (
  <span style={{
    fontFamily: 'var(--lms-font)', fontSize: 10.5, padding: '2px 8px', borderRadius: 999,
    background: '#F1F5F9', color: '#64748B', fontWeight: 700, letterSpacing: 0.2,
  }}>Optional</span>
);

const RequiredPill: React.FC = () => (
  <span style={{
    fontFamily: 'var(--lms-font)', fontSize: 10.5, padding: '2px 8px', borderRadius: 999,
    background: '#FEE2E2', color: '#DC2626', fontWeight: 700, letterSpacing: 0.2,
  }}>Required</span>
);

// ─── Card shell (title bar + editor body) ───────────────────────────────────

const CardShell: React.FC<{
  title: React.ReactNode;
  hint: string;
  onCopy: () => void;
  onExpand: () => void;
  hasError?: boolean;
  children: React.ReactNode;
  extraToolbar?: React.ReactNode;
  // Right-of-title slot for compact meta (e.g. `language:python`). Renders
  // between the title/hint block and the copy/expand icons.
  headerRight?: React.ReactNode;
}> = ({ title, hint, onCopy, onExpand, hasError, children, extraToolbar, headerRight }) => (
  <div style={{
    background: CARD_BG,
    border: hasError ? '1px solid #F87171' : CARD_BORDER,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px 8px', gap: 8,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{title}</div>
        <p style={{
          margin: '4px 0 0', fontFamily: 'var(--lms-font)', fontSize: 11,
          color: 'var(--lms-text-muted, #64748B)',
        }}>{hint}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {headerRight}
        <button
          type="button"
          onClick={onCopy}
          title="Copy"
          aria-label="Copy code"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--lms-text-muted, #64748B)', padding: 4, borderRadius: 6,
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          <Copy size={14} />
        </button>
        <button
          type="button"
          onClick={onExpand}
          title="Expand editor"
          aria-label="Expand editor"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--lms-text-muted, #64748B)', padding: 4, borderRadius: 6,
            display: 'inline-flex', alignItems: 'center',
          }}
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
    {extraToolbar}
    {children}
  </div>
);

// ─── Expand-editor modal ────────────────────────────────────────────────────

const ExpandModal: React.FC<{
  title: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  disabled?: boolean;
}> = ({ title, value, onChange, onClose, disabled }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)',
        zIndex: 100020, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: CARD_BG, border: CARD_BORDER, borderRadius: CARD_RADIUS,
          width: 'min(1100px, 100%)', height: 'min(80vh, 720px)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #E2E8F0',
        }}>
          <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <LinedTextarea value={value} onChange={onChange} disabled={disabled} height="100%" />
        </div>
      </div>
    </div>
  );
};

// ─── Layout hook ────────────────────────────────────────────────────────────

const useIsStacked = () => {
  const [stacked, setStacked] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < STACK_BREAKPOINT : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setStacked(window.innerWidth < STACK_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return stacked;
};

// ─── Section header ────────────────────────────────────────────────────────

const SectionHeader: React.FC = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <label
      className="lms-section-label"
      style={{ margin: 0, fontFamily: 'var(--lms-font)', fontSize: 12, fontWeight: 700, letterSpacing: 0.35, color: '#0F172A', textTransform: 'uppercase' }}
    >
      Code Setup
    </label>
  </div>
);

// ─── Programming / SQL variant ─────────────────────────────────────────────

export interface CodeSetupSectionProps {
  starterCode: string;
  onStarterChange: (v: string) => void;
  solutionCode: string;
  onSolutionChange: (v: string) => void;
  disabled?: boolean;
  /** Only meaningful for the programming variant. Ignored for SQL. */
  languages?: string[];
  /** Currently selected language (for programming). */
  language?: string;
  onLanguageChange?: (lang: string) => void;
  /** Language display label for SQL variant (defaults to "SQL"). */
  languageLabel?: string;
  /** External error string for Solution Code (rendered as a small inline note). */
  solutionError?: string;
  /** Called when the Solution editor blurs — parents can use this to touch. */
  onSolutionBlur?: () => void;
  /** "programming" (with selector) or "sql" (fixed label). */
  variant?: 'programming' | 'sql';
  // ── Execution-setup-aware Starter behaviour (Programming form only) ──
  // 'blank'     → hide the Starter editor and render "Students begin with an
  //               empty editor." Ignores starterCode entirely.
  // 'generated' → show `generatedStarter` in a read-only Starter editor. The
  //               parent still owns the value and can (optionally) mirror it
  //               into starterCode; the reader here does not write back.
  // 'custom'    → editable Starter editor bound to starterCode (legacy path).
  // undefined   → falls back to 'custom' so callers that don't set this prop
  //               get the pre-existing behaviour unchanged.
  startingExperience?: 'blank' | 'generated' | 'custom';
  generatedStarter?: string;
  /** Extra callout text under the section header (e.g. Function-mode notice). */
  headerNote?: React.ReactNode;
  /** Custom Starter warning (e.g. missing function name). */
  customStarterWarning?: React.ReactNode;
}

export const CodeSetupSection: React.FC<CodeSetupSectionProps> = ({
  starterCode, onStarterChange,
  solutionCode, onSolutionChange,
  disabled,
  languages,
  language,
  onLanguageChange,
  languageLabel,
  solutionError,
  onSolutionBlur,
  variant = 'programming',
  startingExperience,
  generatedStarter,
  headerNote,
  customStarterWarning,
}) => {
  const stacked = useIsStacked();
  const [expanded, setExpanded] = useState<null | 'starter' | 'solution'>(null);
  // Programming variant only respects startingExperience — SQL keeps legacy.
  const exp = variant === 'programming' ? (startingExperience || 'custom') : 'custom';

  const langList = useMemo(() => {
    if (variant === 'sql') return ['SQL'];
    return (languages && languages.length > 0) ? languages : ['Python', 'JavaScript', 'Java', 'C++', 'C'];
  }, [languages, variant]);

  const currentLang = variant === 'sql' ? 'SQL' : (language || langList[0] || 'Python');

  const copy = (v: string) => {
    try { navigator.clipboard?.writeText(v); } catch { /* noop */ }
  };

  // Top-right `language:xxx` chip rendered inside each CardShell's header.
  // The label uses the raw language string in lowercase so it matches the
  // language selector value (python / javascript / cpp), giving the teacher
  // a consistent "language:python" signal without an extra pill row below.
  const languageChip = (
    <span style={{
      fontFamily: MONO, fontSize: 11, color: '#475569', fontWeight: 600,
      padding: '3px 8px', borderRadius: 6, background: '#F1F5F9',
      border: '1px solid #E2E8F0', letterSpacing: 0.2,
    }}>language:{(currentLang || '').toString().toLowerCase()}</span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <SectionHeader />
        {variant === 'programming' && langList.length > 1 && onLanguageChange && (
          <select
            value={currentLang}
            onChange={e => onLanguageChange(e.target.value)}
            disabled={disabled}
            className="lms-input"
            style={{ maxWidth: 180, fontSize: 12 }}
          >
            {langList.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        {variant === 'sql' && (
          <span style={{ fontFamily: MONO, fontSize: 11, color: '#64748B', padding: '4px 10px', borderRadius: 8, background: '#F1F5F9' }}>
            {languageLabel || 'SQL'}
          </span>
        )}
      </div>

      {headerNote}

      <div style={{
        display: 'grid',
        gridTemplateColumns: stacked ? '1fr' : '1fr 1fr',
        gap: 16,
        alignItems: 'stretch',
      }}>
        {/* Starter — behaviour depends on startingExperience (programming variant) */}
        {exp === 'blank' ? (
          <div style={{
            background: CARD_BG, border: CARD_BORDER, borderRadius: CARD_RADIUS,
            padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Starter Code</span>
                <OptionalPill />
              </div>
              {languageChip}
            </div>
            <div style={{
              background: EDITOR_BG, border: '1px dashed #CBD5E1', borderRadius: 8,
              padding: '18px 14px', color: '#64748B', fontSize: 12.5, fontStyle: 'italic',
            }}>
              Students begin with an empty editor.
            </div>
          </div>
        ) : exp === 'generated' ? (
          <CardShell
            title={
              <>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Starter Code</span>
                <span style={{
                  fontFamily: 'var(--lms-font)', fontSize: 10.5, padding: '2px 8px', borderRadius: 999,
                  background: '#F0FDF4', color: '#16A34A', fontWeight: 700, letterSpacing: 0.2, border: '1px solid #BBF7D0',
                }}>Generated · Read-only</span>
              </>
            }
            hint="Auto-derived from the function contract — updates as you edit the contract"
            onCopy={() => copy(generatedStarter || '')}
            onExpand={() => setExpanded('starter')}
            headerRight={languageChip}
          >
            <LinedTextarea
              value={generatedStarter || ''}
              onChange={() => { /* read-only in generated mode */ }}
              disabled={true}
              placeholder={'// Auto-generated skeleton'}
              ariaLabel="Starter Code (generated)"
            />
          </CardShell>
        ) : (
          <CardShell
            title={
              <>
                <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Starter Code</span>
                <OptionalPill />
              </>
            }
            hint="Initial code shown to students"
            onCopy={() => copy(starterCode)}
            onExpand={() => setExpanded('starter')}
            headerRight={languageChip}
          >
            <LinedTextarea
              value={starterCode}
              onChange={onStarterChange}
              disabled={disabled}
              placeholder={variant === 'sql' ? '-- Starter query shown to students' : '// Starter code shown to students'}
              ariaLabel="Starter Code"
            />
            {customStarterWarning}
          </CardShell>
        )}

        {/* Solution */}
        <CardShell
          title={
            <>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                Solution Code <span style={{ color: '#DC2626' }}>*</span>
              </span>
              <RequiredPill />
            </>
          }
          hint="Reference solution used for validation"
          hasError={!!solutionError}
          onCopy={() => copy(solutionCode)}
          onExpand={() => setExpanded('solution')}
          headerRight={languageChip}
        >
          {solutionError && (
            <div style={{ padding: '0 14px 6px' }}>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: '#DC2626' }}>— {solutionError}</span>
            </div>
          )}
          <div onBlur={onSolutionBlur}>
            <LinedTextarea
              value={solutionCode}
              onChange={onSolutionChange}
              disabled={disabled}
              placeholder={variant === 'sql' ? '-- Reference solution (author-only)' : '// Reference solution (author-only)'}
              ariaLabel="Solution Code"
            />
          </div>
        </CardShell>
      </div>

      {expanded === 'starter' && exp === 'generated' && (
        <ExpandModal
          title="Starter Code (generated · read-only)"
          value={generatedStarter || ''}
          onChange={() => { /* read-only */ }}
          onClose={() => setExpanded(null)}
          disabled={true}
        />
      )}
      {expanded === 'starter' && exp !== 'generated' && exp !== 'blank' && (
        <ExpandModal
          title="Starter Code"
          value={starterCode}
          onChange={onStarterChange}
          onClose={() => setExpanded(null)}
          disabled={disabled}
        />
      )}
      {expanded === 'solution' && (
        <ExpandModal
          title="Solution Code"
          value={solutionCode}
          onChange={onSolutionChange}
          onClose={() => setExpanded(null)}
          disabled={disabled}
        />
      )}
    </div>
  );
};

// ─── Frontend variant (HTML / CSS / JS tabs) ────────────────────────────────

export interface FrontendCodeSetupSectionProps {
  starterCode: FrontendCode;
  onStarterChange: (v: FrontendCode) => void;
  solutionCode: FrontendCode;
  onSolutionChange: (v: FrontendCode) => void;
  disabled?: boolean;
  solutionError?: string;
  onSolutionBlur?: () => void;
}

type FeTab = keyof FrontendCode; // 'html' | 'css' | 'javascript'
const FE_TABS: { key: FeTab; label: string }[] = [
  { key: 'html', label: 'HTML' },
  { key: 'css', label: 'CSS' },
  { key: 'javascript', label: 'JS' },
];

const FrontendTabs: React.FC<{ active: FeTab; onChange: (t: FeTab) => void }> = ({ active, onChange }) => (
  <div style={{
    display: 'flex', gap: 4, padding: '0 10px 6px', borderBottom: '1px solid #E2E8F0',
  }}>
    {FE_TABS.map(t => {
      const isActive = t.key === active;
      return (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          style={{
            background: isActive ? '#FFFFFF' : 'transparent',
            border: isActive ? '1px solid #E2E8F0' : '1px solid transparent',
            borderBottom: isActive ? '1px solid #FFFFFF' : 'none',
            marginBottom: -1,
            padding: '4px 10px',
            borderTopLeftRadius: 6, borderTopRightRadius: 6,
            cursor: 'pointer',
            fontFamily: MONO,
            fontSize: 11.5,
            color: isActive ? '#0F172A' : '#64748B',
            fontWeight: isActive ? 700 : 500,
          }}
        >
          {t.label}
        </button>
      );
    })}
  </div>
);

export const FrontendCodeSetupSection: React.FC<FrontendCodeSetupSectionProps> = ({
  starterCode, onStarterChange,
  solutionCode, onSolutionChange,
  disabled,
  solutionError,
  onSolutionBlur,
}) => {
  const stacked = useIsStacked();
  const [starterTab, setStarterTab] = useState<FeTab>('html');
  const [solutionTab, setSolutionTab] = useState<FeTab>('html');
  const [expanded, setExpanded] = useState<null | { which: 'starter' | 'solution'; tab: FeTab }>(null);

  const s = normalizeFrontendCode(starterCode);
  const sol = normalizeFrontendCode(solutionCode);

  const patchStarter = (tab: FeTab, v: string) => onStarterChange({ ...s, [tab]: v });
  const patchSolution = (tab: FeTab, v: string) => onSolutionChange({ ...sol, [tab]: v });

  const copy = (v: string) => { try { navigator.clipboard?.writeText(v); } catch { /* noop */ } };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <SectionHeader />

      <div style={{
        display: 'grid',
        gridTemplateColumns: stacked ? '1fr' : '1fr 1fr',
        gap: 16,
        alignItems: 'stretch',
      }}>
        {/* Starter */}
        <CardShell
          title={
            <>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Starter Code</span>
              <OptionalPill />
            </>
          }
          hint="Initial code shown to students"
          onCopy={() => copy(s[starterTab])}
          onExpand={() => setExpanded({ which: 'starter', tab: starterTab })}
          extraToolbar={<FrontendTabs active={starterTab} onChange={setStarterTab} />}
        >
          <LinedTextarea
            value={s[starterTab]}
            onChange={v => patchStarter(starterTab, v)}
            disabled={disabled}
            placeholder={`Starter ${starterTab.toUpperCase()} shown to students`}
            ariaLabel={`Starter ${starterTab}`}
          />
        </CardShell>

        {/* Solution */}
        <CardShell
          title={
            <>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                Solution Code <span style={{ color: '#DC2626' }}>*</span>
              </span>
              <RequiredPill />
            </>
          }
          hint="Reference solution used for validation"
          hasError={!!solutionError}
          onCopy={() => copy(sol[solutionTab])}
          onExpand={() => setExpanded({ which: 'solution', tab: solutionTab })}
          extraToolbar={<FrontendTabs active={solutionTab} onChange={setSolutionTab} />}
        >
          {solutionError && (
            <div style={{ padding: '0 10px 4px' }}>
              <span style={{ fontFamily: 'var(--lms-font)', fontSize: 11, color: '#DC2626' }}>— {solutionError}</span>
            </div>
          )}
          <div onBlur={onSolutionBlur}>
            <LinedTextarea
              value={sol[solutionTab]}
              onChange={v => patchSolution(solutionTab, v)}
              disabled={disabled}
              placeholder={`Reference ${solutionTab.toUpperCase()} (author-only)`}
              ariaLabel={`Solution ${solutionTab}`}
            />
          </div>
        </CardShell>
      </div>

      {expanded && expanded.which === 'starter' && (
        <ExpandModal
          title={`Starter Code — ${expanded.tab.toUpperCase()}`}
          value={s[expanded.tab]}
          onChange={v => patchStarter(expanded.tab, v)}
          onClose={() => setExpanded(null)}
          disabled={disabled}
        />
      )}
      {expanded && expanded.which === 'solution' && (
        <ExpandModal
          title={`Solution Code — ${expanded.tab.toUpperCase()}`}
          value={sol[expanded.tab]}
          onChange={v => patchSolution(expanded.tab, v)}
          onClose={() => setExpanded(null)}
          disabled={disabled}
        />
      )}
    </div>
  );
};

// ─── Validation helpers exported for form validate() calls ─────────────────

export const isStringSolutionEmpty = (v: string | undefined | null): boolean =>
  !v || !v.toString().trim();

export const isFrontendSolutionEmpty = (v: FrontendCode | undefined | null): boolean => {
  const f = normalizeFrontendCode(v);
  return !f.html.trim() && !f.css.trim() && !f.javascript.trim();
};
