import React from 'react';
import { Plus, Database, Upload, X, ChevronRight, FileText, Sparkles } from 'lucide-react';

// Design tokens matching your UI
const T = {
  green: "#059669",
  orange: "#F27757",
  purple: "#8b5cf6",
  cyan: "#0891b2",
  textMain: "#1a1a2e",
  textSub: "#6b6b7e",
  textMuted: "#8b8b9e",
  border: "#e4e4ed",
  bg: "#ffffff",
  pageBg: "#faf9fc",
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
  if (!isOpen) return null;

  const isMCQ = exerciseType === 'MCQ';
  const title = isMCQ ? 'Add MCQ Question' : 'Add Question';
  const subtitle = isMCQ 
    ? 'Choose how you want to create questions' 
    : 'Select an option to add questions';

  return (
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ 
        background: 'rgba(26,26,46,0.55)', 
        backdropFilter: 'blur(3px)' 
      }}
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ 
          border: `1px solid ${T.border}`,
          animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${T.border}` }}>
          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center flex-wrap gap-0.5 mb-2">
              {breadcrumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {i > 0 && (
                    <span className="text-xs" style={{ color: T.orange }}>›</span>
                  )}
                  <span 
                    className="text-[11px] font-medium"
                    style={{ 
                      color: i === breadcrumbs.length - 1 ? T.orange : T.textMuted 
                    }}
                  >
                    {c.name}
                  </span>
                </span>
              ))}
            </div>
          )}
          
          <div className="flex items-center gap-2 mb-0.5">
            <div 
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: `${T.orange}10` }}
            >
              <Plus size={13} style={{ color: T.orange }} />
            </div>
            <h3 className="text-base font-bold" style={{ color: T.textMain }}>
              {title}
            </h3>
          </div>
          <p className="text-xs mt-1" style={{ color: T.textMuted }}>
            {subtitle}
          </p>
        </div>

        {/* Options */}
        <div className="p-4 space-y-3">
          {/* Create From Scratch */}
          <button
            onClick={onSelectFromScratch}
            className="group w-full text-left rounded-xl p-4 transition-all duration-200"
            style={{ 
              border: `1.5px solid ${T.border}`, 
              background: T.bg,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = T.orange;
              e.currentTarget.style.background = `${T.orange}04`;
              e.currentTarget.style.boxShadow = `0 2px 12px ${T.orange}20`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.background = T.bg;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${T.orange}10` }}
              >
                <Plus size={18} style={{ color: T.orange }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: T.textMain }}>
                  Create Question From Scratch
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                  Build from scratch with custom content
                </div>
              </div>
              <ChevronRight 
                size={15} 
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
                style={{ color: T.orange }}
              />
            </div>
          </button>

          {/* From Question Bank */}
          <button
            onClick={onSelectFromBank}
            className="group w-full text-left rounded-xl p-4 transition-all duration-200"
            style={{ 
              border: `1.5px solid ${T.border}`, 
              background: T.bg,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = T.purple;
              e.currentTarget.style.background = `${T.purple}04`;
              e.currentTarget.style.boxShadow = `0 2px 12px ${T.purple}20`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.background = T.bg;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${T.purple}10` }}
              >
                <Database size={18} style={{ color: T.purple }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: T.textMain }}>
                  Create Question From Question Bank
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                  Import from existing question repository
                </div>
              </div>
              <ChevronRight 
                size={15} 
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
                style={{ color: T.purple }}
              />
            </div>
          </button>

          {/* Generate AI — shown whenever the caller supports it (all types) */}
          {onSelectGenerateAI && (
            <button
              onClick={onSelectGenerateAI}
              className="group w-full text-left rounded-xl p-4 transition-all duration-200"
              style={{ border: `1.5px solid ${T.border}`, background: T.bg }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = T.orange;
                e.currentTarget.style.background = `${T.orange}04`;
                e.currentTarget.style.boxShadow = `0 2px 12px ${T.orange}20`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.background = T.bg;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${T.orange}10` }}>
                  <Sparkles size={18} style={{ color: T.orange }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold" style={{ color: T.textMain }}>
                    Generate Question with AI
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                    Auto-generate questions on a topic
                  </div>
                </div>
                <ChevronRight size={15} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200" style={{ color: T.orange }} />
              </div>
            </button>
          )}

          {/* From Document — now available for every exercise type (.txt import) */}
          <button
            onClick={onSelectFromDocument}
            className="group w-full text-left rounded-xl p-4 transition-all duration-200"
            style={{
              border: `1.5px solid ${T.border}`,
              background: T.bg,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = T.cyan;
              e.currentTarget.style.background = `${T.cyan}04`;
              e.currentTarget.style.boxShadow = `0 2px 12px ${T.cyan}20`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.background = T.bg;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${T.cyan}10` }}
              >
                <FileText size={18} style={{ color: T.cyan }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold" style={{ color: T.textMain }}>
                  Create Question From Document
                </div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textMuted }}>
                  Upload &amp; import from a .txt file
                </div>
              </div>
              <ChevronRight
                size={15}
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-200"
                style={{ color: T.cyan }}
              />
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
            style={{ 
              background: T.pageBg, 
              border: `1.5px solid ${T.border}`, 
              color: T.textSub 
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = T.bg;
              e.currentTarget.style.borderColor = T.border;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = T.pageBg;
              e.currentTarget.style.borderColor = T.border;
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-8px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CreateQuestionOptionModal;