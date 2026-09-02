import React, { useEffect } from 'react';
import { Plus, Database, Sparkles, X, ChevronRight, FileText, Pencil } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// CreateQuestionOptionModal
// Rebuilt 2026-09-02 to the "Add a programming question" mockup:
// coral outlined add-icon, indigo-violet interaction path, cool teal for
// document import, physical Esc key chip in the footer. Every existing prop
// and callback contract is preserved — the parent still hands us the same
// four onSelect* handlers, the optional exerciseType, and the breadcrumbs.
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  // Accents
  coral:            '#FF704D',
  violetPrimary:    '#5542DA',
  violetHover:      '#6655F4',
  violetTile1:      '#F0EDFF',
  violetTile2:      '#F4F1FF',
  violetTag:        '#EEEBFF',
  violetWash:       '#FAF9FF',
  violetAlt:        '#5C45E5',
  indigoCode:       '#5747E8',
  teal:             '#008DA8',
  tealTile:         '#EAF8FB',
  // Text
  ink:              '#12162A',
  textSecondary:    '#596174',
  textMuted:        '#5F667A',
  textLabel:        '#697086',
  textHint:         '#677084',
  textCancel:       '#424A60',
  textCourse:       '#61697D',
  // Surfaces & lines
  white:            '#FFFFFF',
  panel:            '#F8F9FC',
  panelBorder:      '#DDE1EB',
  modalBorder:      '#E2E5ED',
  cardBorder:       '#D9DDE7',
  footerBorder:     '#E3E6ED',
  keyBorder:        '#D7DBE5',
  overlay:          'rgba(20,24,40,0.46)',
};

interface CreateQuestionOptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFromScratch: () => void;
  onSelectFromBank: () => void;
  onSelectFromDocument: () => void;
  // Optional — when provided, a "Generate AI" option is shown. Callers that
  // don't support AI generation simply omit it and the option is hidden.
  onSelectGenerateAI?: () => void;
  exerciseType?: 'MCQ' | 'Programming' | 'Combined' | 'Other';
  breadcrumbs?: Array<{ name: string; type: string }>;
}

// Derive a natural, exercise-type-specific title & subtitle so every variant
// reads like "Add a programming question / Add an MCQ question / …".
const headingCopy = (exerciseType: NonNullable<CreateQuestionOptionModalProps['exerciseType']>) => {
  switch (exerciseType) {
    case 'MCQ':
      return {
        title: 'Add an MCQ question',
        subtitle: 'Choose how you’d like to add a question to this assignment.',
      };
    case 'Programming':
      return {
        title: 'Add a programming question',
        subtitle: 'Choose how you’d like to add a question to this assignment.',
      };
    case 'Combined':
      return {
        title: 'Add a question',
        subtitle: 'Choose how you’d like to add a question to this assignment.',
      };
    case 'Other':
    default:
      return {
        title: 'Add a question',
        subtitle: 'Choose how you’d like to add a question to this assignment.',
      };
  }
};

// Card contract — one entry per selectable option. Central so the mapping,
// hover styles, and copy for each card stay easy to reason about.
interface OptionCard {
  key: 'scratch' | 'bank' | 'ai' | 'document';
  title: string;
  description: string;
  tag?: string;
  tileBg: string;
  tileColor: string;
  accent: string;    // hover border + chevron color when hovered
  wash: string;      // hovered card background
  icon: React.ReactNode;
  onClick: () => void;
}

export const CreateQuestionOptionModal: React.FC<CreateQuestionOptionModalProps> = ({
  isOpen,
  onClose,
  onSelectFromScratch,
  onSelectFromBank,
  onSelectFromDocument,
  onSelectGenerateAI,
  exerciseType = 'MCQ',
  breadcrumbs = [],
}) => {
  // Esc to close — mirrors the AddQuestionModal contract and matches the
  // "Esc to close" footer hint the mockup carries.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { title, subtitle } = headingCopy(exerciseType);

  // Assignment-context panel content — derived from breadcrumbs. The LAST
  // crumb is the deepest node (typically the topic/subtopic being added to);
  // the FIRST crumb is the course. Both are optional — the panel only
  // renders when at least a leaf is available.
  const leafCrumb = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1] : null;
  const rootCrumb =
    breadcrumbs.length > 1 ? breadcrumbs[0] : null;

  // Build the option cards in the order the mockup dictates:
  // Start from scratch (violet) → Question bank (violet-alt) → Import doc (teal)
  // Generate AI slots in as an extra violet card when the caller supports it.
  const options: OptionCard[] = [
    {
      key: 'scratch',
      title: 'Start from scratch',
      description:
        exerciseType === 'Programming'
          ? 'Write a new programming question and configure test cases.'
          : 'Write a new question and configure the answer.',
      tag: 'Most flexible',
      tileBg: T.violetTile1,
      tileColor: T.violetPrimary,
      accent: T.violetHover,
      wash: T.violetWash,
      icon: <Pencil size={30} strokeWidth={2} />,
      onClick: onSelectFromScratch,
    },
    {
      key: 'bank',
      title: 'Choose from question bank',
      description: 'Reuse a reviewed question from your shared library.',
      tileBg: T.violetTile2,
      tileColor: T.violetAlt,
      accent: T.violetHover,
      wash: T.violetWash,
      icon: <Database size={30} strokeWidth={2} />,
      onClick: onSelectFromBank,
    },
  ];

  if (onSelectGenerateAI) {
    options.push({
      key: 'ai',
      title: 'Generate with AI',
      description: 'Draft a first question from a topic prompt.',
      tileBg: T.violetTile1,
      tileColor: T.violetPrimary,
      accent: T.violetHover,
      wash: T.violetWash,
      icon: <Sparkles size={30} strokeWidth={2} />,
      onClick: onSelectGenerateAI,
    });
  }

  options.push({
    key: 'document',
    title: 'Import from document',
    description: 'Upload a .txt file and review the questions we detect.',
    tileBg: T.tealTile,
    tileColor: T.teal,
    accent: T.teal,
    wash: '#F5FBFC',
    icon: <FileText size={30} strokeWidth={2} />,
    onClick: onSelectFromDocument,
  });

  return (
    <div
      className="cqm-scrim"
      onClick={onClose}
      role="presentation"
    >
      <style>{`
        @keyframes cqm-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes cqm-modal-in {
          from { opacity: 0; transform: translateY(8px) scale(.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        .cqm-scrim {
          position: fixed; inset: 0; z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          background: ${T.overlay};
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          animation: cqm-fade-in .18s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .cqm-modal {
          width: 100%; max-width: 720px;
          background: ${T.white};
          border: 1px solid ${T.modalBorder};
          border-radius: 20px;
          box-shadow: 0 28px 70px rgba(18,23,38,0.22);
          overflow: hidden;
          animation: cqm-modal-in .22s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex; flex-direction: column;
          max-height: calc(100vh - 48px);
        }
        .cqm-body { padding: 0 28px; overflow-y: auto; flex: 1; }
        .cqm-header {
          display: flex; align-items: flex-start; gap: 16px;
          padding: 28px 0 22px;
        }
        .cqm-header-icon {
          width: 48px; height: 48px;
          border: 2px solid ${T.coral};
          border-radius: 999px;
          display: grid; place-items: center;
          flex-shrink: 0; margin-top: 2px;
        }
        .cqm-header-text { flex: 1; min-width: 0; }
        .cqm-header-title {
          margin: 0;
          font-size: 22px; font-weight: 700; line-height: 28px;
          color: ${T.ink}; letter-spacing: -0.01em;
        }
        .cqm-header-desc {
          margin: 4px 0 0;
          font-size: 14px; font-weight: 400; line-height: 20px;
          color: ${T.textMuted};
        }
        .cqm-close {
          width: 40px; height: 40px;
          border: 1px solid ${T.footerBorder};
          background: ${T.white};
          border-radius: 999px;
          display: grid; place-items: center;
          cursor: pointer; flex-shrink: 0;
          color: ${T.textSecondary};
          transition: background 150ms ease, border-color 150ms ease;
        }
        .cqm-close:hover { background: #F5F6FA; border-color: #D5DAE3; }
        .cqm-close:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(102,85,244,0.28); }

        .cqm-context {
          background: ${T.panel};
          border: 1px solid ${T.panelBorder};
          border-radius: 12px;
          padding: 18px 20px;
          display: flex; align-items: center; gap: 16px;
        }
        .cqm-context-tile {
          width: 56px; height: 56px;
          background: ${T.white};
          border: 1px solid ${T.panelBorder};
          border-radius: 12px;
          display: grid; place-items: center;
          color: ${T.indigoCode};
          flex-shrink: 0;
        }
        .cqm-context-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .cqm-context-label {
          font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.5px;
          color: ${T.textLabel};
          line-height: 1; margin: 0 0 4px;
        }
        .cqm-context-id {
          font-size: 16px; font-weight: 700; color: ${T.ink};
          line-height: 1.2; margin: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .cqm-context-course {
          font-size: 13px; font-weight: 400; color: ${T.textCourse};
          line-height: 1.35; margin: 0;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .cqm-options {
          margin-top: 20px;
          display: flex; flex-direction: column; gap: 14px;
          padding-bottom: 24px;
        }
        .cqm-option {
          --accent: ${T.violetHover};
          --wash: ${T.violetWash};
          all: unset;
          box-sizing: border-box; cursor: pointer;
          display: flex; align-items: center; gap: 18px;
          padding: 16px 20px;
          background: ${T.white};
          border: 1px solid ${T.cardBorder};
          border-radius: 12px;
          transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
        }
        .cqm-option:hover {
          background: var(--wash);
          border-color: var(--accent);
          border-width: 2px;
          padding: 15px 19px; /* keep internal geometry stable with 1→2px border */
        }
        .cqm-option:focus-visible {
          outline: none;
          border-color: var(--accent);
          border-width: 2px;
          padding: 15px 19px;
          box-shadow: 0 0 0 3px rgba(102,85,244,0.20);
        }
        .cqm-option-tile {
          width: 56px; height: 56px;
          border-radius: 12px;
          display: grid; place-items: center;
          flex-shrink: 0;
        }
        .cqm-option-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
        .cqm-option-title-row {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .cqm-option-title {
          margin: 0;
          font-size: 17px; font-weight: 700; line-height: 22px;
          color: ${T.ink}; letter-spacing: -0.005em;
        }
        .cqm-option-desc {
          margin: 0;
          font-size: 13.5px; font-weight: 400; line-height: 20px;
          color: ${T.textSecondary};
        }
        .cqm-option-tag {
          display: inline-flex; align-items: center;
          font-size: 11px; font-weight: 600;
          background: ${T.violetTag};
          color: ${T.violetPrimary};
          padding: 3px 10px;
          border-radius: 999px;
          line-height: 1.3;
        }
        .cqm-option-chev {
          flex-shrink: 0;
          color: ${T.textSecondary};
          transition: color 150ms ease, transform 150ms ease;
        }
        .cqm-option:hover .cqm-option-chev,
        .cqm-option:focus-visible .cqm-option-chev {
          color: var(--accent);
          transform: translateX(2px);
        }

        .cqm-footer {
          height: 68px;
          padding: 0 28px;
          border-top: 1px solid ${T.footerBorder};
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0;
          background: ${T.white};
        }
        .cqm-esc-hint {
          display: flex; align-items: center; gap: 8px;
          font-size: 12.5px; color: ${T.textHint}; line-height: 1;
        }
        .cqm-kbd {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 34px; height: 24px; padding: 0 8px;
          background: ${T.white};
          border: 1px solid ${T.keyBorder};
          border-bottom-width: 2px;
          border-radius: 5px;
          font-family: 'Inter', sans-serif;
          font-size: 11.5px; font-weight: 500;
          color: ${T.textCancel}; line-height: 1;
        }
        .cqm-cancel {
          all: unset;
          box-sizing: border-box;
          min-height: 40px; padding: 0 16px;
          font-size: 15px; font-weight: 600;
          color: ${T.textCancel};
          border-radius: 8px;
          cursor: pointer;
          transition: background 150ms ease;
        }
        .cqm-cancel:hover { background: #F1F2F6; }
        .cqm-cancel:focus-visible {
          outline: none;
          box-shadow: 0 0 0 3px rgba(102,85,244,0.22);
        }

        @media (prefers-reduced-motion: reduce) {
          .cqm-scrim, .cqm-modal, .cqm-option, .cqm-close, .cqm-cancel, .cqm-option-chev {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      <div
        className="cqm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cqm-title"
        aria-describedby="cqm-desc"
        onClick={e => e.stopPropagation()}
      >
        <div className="cqm-body">
          <header className="cqm-header">
            <div className="cqm-header-icon" aria-hidden="true">
              <Plus size={22} strokeWidth={2.4} style={{ color: T.coral }} />
            </div>
            <div className="cqm-header-text">
              <h2 id="cqm-title" className="cqm-header-title">{title}</h2>
              <p id="cqm-desc" className="cqm-header-desc">{subtitle}</p>
            </div>
            <button className="cqm-close" type="button" onClick={onClose} aria-label="Close dialog">
              <X size={16} strokeWidth={2} />
            </button>
          </header>

          {leafCrumb && (
            <div className="cqm-context">
              <div className="cqm-context-tile" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                  <line x1="14" y1="4" x2="10" y2="20" />
                </svg>
              </div>
              <div className="cqm-context-body">
                <span className="cqm-context-label">Adding to</span>
                <div className="cqm-context-id" title={leafCrumb.name}>{leafCrumb.name}</div>
                {rootCrumb && (
                  <div className="cqm-context-course" title={rootCrumb.name}>{rootCrumb.name}</div>
                )}
              </div>
            </div>
          )}

          <div className="cqm-options" role="list">
            {options.map(opt => (
              <button
                key={opt.key}
                className="cqm-option"
                type="button"
                role="listitem"
                onClick={opt.onClick}
                style={{
                  ['--accent' as any]: opt.accent,
                  ['--wash' as any]: opt.wash,
                } as React.CSSProperties}
              >
                <div
                  className="cqm-option-tile"
                  style={{ background: opt.tileBg, color: opt.tileColor }}
                  aria-hidden="true"
                >
                  {opt.icon}
                </div>
                <div className="cqm-option-body">
                  <div className="cqm-option-title-row">
                    <h3 className="cqm-option-title">{opt.title}</h3>
                    {opt.tag && <span className="cqm-option-tag">{opt.tag}</span>}
                  </div>
                  <p className="cqm-option-desc">{opt.description}</p>
                </div>
                <ChevronRight className="cqm-option-chev" size={20} strokeWidth={2} />
              </button>
            ))}
          </div>
        </div>

        <footer className="cqm-footer">
          <div className="cqm-esc-hint">
            <kbd className="cqm-kbd">Esc</kbd>
            <span>to close</span>
          </div>
          <button className="cqm-cancel" type="button" onClick={onClose}>Cancel</button>
        </footer>
      </div>
    </div>
  );
};

export default CreateQuestionOptionModal;
