// ─────────────────────────────────────────────────────────────────────────────
// Shared chrome for the "Add a question" source chooser.
//
// Two surfaces show this modal and they have to stay identical:
//   • We_Do  → components/QuestionsView.tsx        (assignments)
//   • You_Do → youdo/QuestionsTest.tsx             (assessments)
//
// They drifted: You_Do kept a small pre-2026-09 popup with a plain-text
// "Topic:/Assessment:" header, no level step, no footer and no document
// import. This module is the single copy of the 2026-09-02 mockup chrome —
// header, context card, level step, source row, footer — so a change to the
// look lands on both at once.
//
// ONLY presentation lives here. Each surface keeps its own quota maths, source
// gating and step state: those read genuinely different shapes (You_Do adds a
// per-section allocation layer) and folding them together would be a rewrite,
// not a reuse.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect } from 'react';
import { ChevronRight, Plus, X } from 'lucide-react';

const JKT: React.CSSProperties = {
  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
};

/** Mockup palette (2026-09-02 "Add a programming question" rebuild). */
export const AQ = {
  coral:         '#FF704D',
  violetPrimary: '#5542DA',
  violetHover:   '#6655F4',
  violetTile1:   '#F0EDFF',
  violetTile2:   '#F4F1FF',
  violetTag:     '#EEEBFF',
  violetWash:    '#FAF9FF',
  violetAlt:     '#5C45E5',
  indigoCode:    '#5747E8',
  teal:          '#008DA8',
  tealTile:      '#EAF8FB',
  ink:           '#12162A',
  textSecondary: '#596174',
  textMuted:     '#5F667A',
  textLabel:     '#697086',
  textHint:      '#677084',
  textCancel:    '#424A60',
  textCourse:    '#61697D',
  panel:         '#F8F9FC',
  panelBorder:   '#DDE1EB',
  modalBorder:   '#E2E5ED',
  cardBorder:    '#D9DDE7',
  footerBorder:  '#E3E6ED',
  keyBorder:     '#D7DBE5',
} as const;

/** Level dot colours, shared by the level step on both surfaces. */
export const AQ_LEVEL_DOT: Record<string, string> = {
  easy: '#0F9D58', medium: '#F0A415', hard: '#E0503C',
};

/** Small amber marker rendered on quota-exhausted options. */
export const QuotaFullChip: React.FC = () => (
  <span className="inline-flex items-center shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
    style={{ ...JKT, color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', letterSpacing: '0.03em' }}>
    Quota full
  </span>
);

// ─── Source row ──────────────────────────────────────────────────────────────

/**
 * Option row — 34px icon tile, title (with optional tag/badge), description,
 * chevron. Hover applies the row's own accent to the border + wash so each
 * option keeps its identity. Full-quota rows dim in place and swallow the
 * click, preserving the caller's gate.
 */
export const AddQuestionSourceRow: React.FC<{
  full?: boolean;
  onClick: () => void;
  tileBg: string;
  tileColor: string;
  accent: string;
  wash: string;
  icon: React.ReactNode;
  title: React.ReactNode;
  sub: React.ReactNode;
  badge?: React.ReactNode;
  tag?: React.ReactNode;
  /** Tooltip for a disabled row — says which slice is exhausted. */
  fullTitle?: string;
}> = ({ full, onClick, tileBg, tileColor, accent, wash, icon, title, sub, badge, tag, fullTitle }) => (
  <button onClick={() => { if (full) return; onClick(); }}
    disabled={full}
    title={full ? (fullTitle || '') : ''}
    className="group w-full text-left transition-all flex items-center gap-3.5"
    style={{
      border: `1px solid ${AQ.cardBorder}`,
      borderRadius: 14,
      padding: '15px 16px',
      background: full ? '#FAFBFD' : '#fff',
      cursor: full ? 'not-allowed' : 'pointer',
      opacity: full ? 0.72 : 1,
      boxShadow: '0 1px 2px rgba(18,23,38,0.04)',
    }}
    // Hover used to swap border 1px->2px and shave a pixel off the padding
    // to compensate. The arithmetic worked but the row twitched. An inset
    // ring thickens the edge without touching layout, so the card lifts
    // instead of jittering.
    onMouseEnter={e => {
      if (full) return;
      e.currentTarget.style.borderColor = accent;
      e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${accent}, 0 6px 16px rgba(18,23,38,0.09)`;
      e.currentTarget.style.transform = 'translateY(-1px)';
      e.currentTarget.style.background = wash;
    }}
    onMouseLeave={e => {
      if (full) return;
      e.currentTarget.style.borderColor = AQ.cardBorder;
      e.currentTarget.style.boxShadow = '0 1px 2px rgba(18,23,38,0.04)';
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.background = '#fff';
    }}>
    <div className="flex items-center justify-center flex-shrink-0"
      style={{ width: 46, height: 46, background: tileBg, color: tileColor, borderRadius: 12 }}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 3 }}>
        <span className="font-semibold" style={{ fontSize: 15, color: AQ.ink, letterSpacing: '-.008em', lineHeight: 1.3 }}>{title}</span>
        {tag}
        {badge}
      </div>
      <div style={{ fontSize: 12.5, color: full ? '#D97706' : AQ.textSecondary, lineHeight: 1.45 }}>{sub}</div>
    </div>
    {!full && (
      <ChevronRight size={18} className="flex-shrink-0 transition-transform"
        style={{ color: AQ.textSecondary, marginLeft: 4 }} />
    )}
  </button>
);

// ─── Level step ──────────────────────────────────────────────────────────────

export interface AddQuestionLevel {
  level: 'easy' | 'medium' | 'hard';
  rem: number;
  open: boolean;
}

/**
 * Step 1 — which difficulty? Shown only when the exercise carries a level-based
 * distribution; which sources are legal depends on the level, so it comes
 * before the source rows.
 */
export const AddQuestionLevelStep: React.FC<{
  levels: AddQuestionLevel[];
  onPick: (level: 'easy' | 'medium' | 'hard') => void;
}> = ({ levels, onPick }) => (
  <div className="space-y-2.5" style={{ padding: '6px 0 20px' }}>
    <p className="text-[12.5px] px-0.5" style={{ color: '#8b8b9e', marginBottom: 10 }}>
      Pick the difficulty first — the ways you can add a question depend on it.
    </p>
    {levels.map(({ level, rem, open }) => (
      <button key={level} disabled={!open}
        onClick={() => { if (open) onPick(level); }}
        className="group w-full text-left rounded-xl px-4 py-3.5 transition-all flex items-center gap-3"
        style={{
          border: '1px solid #e4e4ed', background: open ? '#fff' : '#fafafa',
          cursor: open ? 'pointer' : 'not-allowed', opacity: open ? 1 : 0.6,
        }}
        onMouseEnter={e => { if (open) { e.currentTarget.style.borderColor = '#F27757'; e.currentTarget.style.background = 'rgba(242,119,87,0.03)'; } }}
        onMouseLeave={e => { if (open) { e.currentTarget.style.borderColor = '#e4e4ed'; e.currentTarget.style.background = '#fff'; } }}>
        <span className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ background: open ? AQ_LEVEL_DOT[level] : '#d1d5db' }} />
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold capitalize" style={{ color: open ? '#1a1a2e' : '#9ca3af' }}>{level}</div>
          <div className="text-[12px] truncate" style={{ color: open ? '#8b8b9e' : '#d97706', marginTop: 1 }}>
            {open ? `${rem} slot${rem === 1 ? '' : 's'} still open` : 'All slots filled for this level'}
          </div>
        </div>
        {open && <ChevronRight size={17} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all" style={{ color: '#F27757' }} />}
      </button>
    ))}
  </div>
);

/** "Adding an <level> question · Change level" strip above the source rows. */
export const AddQuestionLevelBar: React.FC<{
  level: string;
  onChange: () => void;
}> = ({ level, onChange }) => (
  <div className="flex items-center justify-between gap-2 px-0.5" style={{ paddingTop: 2, paddingBottom: 10 }}>
    <span className="text-[13px]" style={{ color: '#8b8b9e' }}>
      Adding an <span className="font-semibold capitalize" style={{ color: '#1a1a2e' }}>{level}</span> question
    </span>
    <button onClick={onChange}
      className="text-[13px] font-semibold" style={{ color: '#F27757', cursor: 'pointer' }}>
      Change level
    </button>
  </div>
);

// ─── Modal shell ─────────────────────────────────────────────────────────────

/**
 * Backdrop + panel + header + context card + scrolling body + footer.
 *
 * `contextName` is the exercise's own name, so the card reads "Technical
 * Assessment 06" on You_Do and "Technical Assignment 05" on We_Do without
 * either surface hard-coding the noun.
 *
 * Esc closes. Both surfaces advertised "Esc to close" in the footer without
 * anything listening for the key; the handler lives here so the promise is
 * true on both.
 */
export const AddQuestionModalShell: React.FC<{
  title: string;
  subtitle?: string;
  contextName?: string | null;
  contextSub?: string | null;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle = 'Choose how you’d like to add a question.', contextName, contextSub, onClose, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0" style={{ zIndex: 100, background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(4px)' }} />
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
        <div className="bg-white overflow-hidden flex flex-col"
          style={{
            ...JKT,
            // 620, not 460. At 460 the source rows wrapped their own
            // one-line descriptions onto two lines and the allocation
            // figures crowded their labels — the modal read as cramped
            // because it genuinely was.
            width: '100%', maxWidth: 620,
            maxHeight: 'calc(100vh - 48px)',
            border: `1px solid ${AQ.modalBorder}`,
            borderRadius: 20,
            boxShadow: '0 24px 64px rgba(18,23,38,0.20)',
            pointerEvents: 'auto',
          }}>

          {/* ── Header — coral outlined + icon, title + one-line description,
              circular close. */}
          <div style={{ padding: '24px 26px 18px', flexShrink: 0 }}>
            <div className="flex items-start gap-3.5">
              <div className="flex-shrink-0"
                style={{
                  width: 42, height: 42, borderRadius: 999,
                  border: `2px solid ${AQ.coral}`,
                  background: '#FFF4F1',
                  display: 'grid', placeItems: 'center', marginTop: 1,
                }}>
                <Plus size={20} strokeWidth={2.4} style={{ color: AQ.coral }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 style={{ fontSize: 20, fontWeight: 700, color: AQ.ink, letterSpacing: '-.015em', lineHeight: 1.25, margin: 0 }}>
                  {title}
                </h2>
                <p style={{ fontSize: 13.5, color: AQ.textMuted, lineHeight: 1.5, margin: '5px 0 0' }}>
                  {subtitle}
                </p>
              </div>
              <button onClick={onClose}
                aria-label="Close"
                style={{
                  width: 34, height: 34, borderRadius: 999,
                  border: `1px solid ${AQ.footerBorder}`, background: '#fff',
                  color: AQ.textSecondary,
                  cursor: 'pointer', display: 'grid', placeItems: 'center',
                  transition: 'background 150ms ease, border-color 150ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#F5F6FA'; e.currentTarget.style.borderColor = '#D5DAE3'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = AQ.footerBorder; }}>
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ── Context panel — compact identity card (F8F9FC, indigo code
              tile, "Adding to" label + exercise name + topic). */}
          {(contextName || contextSub) && (
            <div style={{ padding: '0 26px 14px', flexShrink: 0 }}>
              <div style={{
                background: AQ.panel, border: `1px solid ${AQ.panelBorder}`,
                borderRadius: 14, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 13,
              }}>
                <div className="flex-shrink-0"
                  style={{
                    width: 44, height: 44, background: '#fff',
                    border: `1px solid ${AQ.panelBorder}`, borderRadius: 11,
                    display: 'grid', placeItems: 'center', color: AQ.indigoCode,
                  }}>
                  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                    <line x1="14" y1="4" x2="10" y2="20" />
                  </svg>
                </div>
                <div className="min-w-0" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px',
                    color: AQ.textLabel, lineHeight: 1,
                  }}>
                    Adding to
                  </span>
                  <div style={{
                    fontSize: 15.5, fontWeight: 700, color: AQ.ink, lineHeight: 1.3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }} title={contextName || contextSub || ''}>
                    {contextName || contextSub || '—'}
                  </div>
                  {contextName && contextSub && (
                    <div style={{
                      fontSize: 12.5, color: AQ.textCourse, lineHeight: 1.4,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }} title={contextSub}>
                      {contextSub}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Scrollable body — the only scrolling region, so header and
              footer stay pinned on short laptop viewports. */}
          <div className="flex-1 overflow-y-auto" style={{ padding: '0 26px' }}>
            {children}
          </div>

          {/* ── Footer: physical Esc key chip + compact Cancel ────────── */}
          <div className="flex-shrink-0" style={{
            height: 62, padding: '0 26px',
            borderTop: `1px solid ${AQ.footerBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fff',
          }}>
            <div className="flex items-center" style={{ gap: 7, fontSize: 12.5, color: AQ.textHint, lineHeight: 1 }}>
              <kbd style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 30, height: 23, padding: '0 7px',
                background: '#fff', border: `1px solid ${AQ.keyBorder}`,
                borderBottomWidth: 2, borderRadius: 4,
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 500,
                color: AQ.textCancel, lineHeight: 1,
              }}>Esc</kbd>
              <span>to close</span>
            </div>
            <button onClick={onClose}
              style={{
                minHeight: 38, padding: '0 18px',
                fontSize: 13.5, fontWeight: 600, color: AQ.textCancel,
                background: 'transparent', border: 'none',
                borderRadius: 9, cursor: 'pointer',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F1F2F6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Source-row icons ────────────────────────────────────────────────────────
// Inline SVGs so both surfaces show the same glyph per source.

export const AQIconScratch = (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const AQIconDocument = (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <line x1="8" y1="9" x2="10" y2="9" />
  </svg>
);

export const AQIconAI = (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l2.39 5.7L20 9.27l-4.5 4.07L17 20l-5-3-5 3 1.5-6.66L4 9.27l5.61-1.57L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="none" />
  </svg>
);

/** "Most flexible" tag shown on the Start-from-scratch row. */
export const AQMostFlexibleTag = (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    fontSize: 11, fontWeight: 600,
    background: AQ.violetTag, color: AQ.violetPrimary,
    padding: '3px 9px', borderRadius: 999, lineHeight: 1.3,
  }}>Most flexible</span>
);

/** Gradient NEW badge on the AI row. */
export const AQNewBadge = (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    fontSize: 11, fontWeight: 700, color: '#fff',
    padding: '3px 10px', borderRadius: 999,
    background: `linear-gradient(135deg, ${AQ.violetPrimary}, #a855f7)`,
    letterSpacing: '.02em',
  }}>NEW</span>
);
