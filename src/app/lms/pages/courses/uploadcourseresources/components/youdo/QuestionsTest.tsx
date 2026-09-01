// QuestionsTest.tsx - Fixed version with Assessment.tsx-matching Add Question flow

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  ArrowLeft, Plus, MoreVertical, Edit2, Trash2,
  List, X, AlertTriangle, Code, CheckCircle,
  Layers, ChevronLeft, ChevronRight, FlaskConical,
  Database, FileText, ChevronRight as ChevronRightIcon,
  Search, Filter, Eye, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
// Unified with We_Do — the student-copy fork under
// student/YouDo/assessment/questionforms/ was a stale duplicate with zero
// unique features. Every callsite now points at the single canonical tree.
import AddQuestionForm from '@/app/lms/component/questionforms/AddQuestionForm';
import QuestionBankSelector from '@/app/lms/component/questionforms/mcq/QuestionBankSelector';
import GenerateMCQAIQuestion from '@/app/lms/component/questionforms/mcq/GenerateMCQAIQuestion';
import AddQuestionViaDocument from '@/app/lms/component/AddQuestionViaDocument';
import { exerciseApi } from '@/apiServices/exercise';
import { questionApi } from '@/apiServices/question';
// Shared app-wide loader (orange Swirling ring). Replaces two hand-rolled
// blue rings that used to sit inside this file for the "Loading assessment…"
// and "Loading questions…" states — those read off-theme and off-brand.
import { Loading } from '@/components/loading-ui/loading';
import TableFooter from '@/app/lms/shared/listing/TableFooter';

// ─── Design tokens ────────────────────────────────────────────────────────────
// See Assessment.tsx for the same rationale — keys stay `blue*`, values
// carry brand orange so the whole Manage Questions surface matches the
// app theme rather than the pre-existing indigo.
const T = {
  blue: "#f97316",          // brand-500
  blueDark: "#c2540f",      // brand-700
  blueLight: "rgba(249,115,22,0.08)",
  blueMid: "rgba(249,115,22,0.15)",
  blueGlow: "rgba(249,115,22,0.22)",
  textMain: "#1a1a2e",
  textSub: "#6b6b7e",
  textMuted: "#8b8b9e",
  textHint: "#bcbccc",
  border: "#ece9f1",
  bg: "#ffffff",
  pageBg: "#faf9fc",
  warm: "#fff7f1",
  red: "#ef4444",
  redLight: "rgba(239,68,68,0.1)",
  emerald: "#10b981",
  amber: "#f59e0b",
};

interface Question {
  _id: string;
  questionType: 'mcq' | 'programming' | 'frontend' | 'database';
  questionTitle?: string | any[];
  title?: string;
  description?: string | any[];
  difficulty?: 'easy' | 'medium' | 'hard';
  points?: number;
  score?: number;
  mcqQuestionScore?: number;
  mcqQuestionTitle?: string | any[];
  mcqQuestionDescription?: string | any[];
  sectionId?: string;
  sectionName?: string;
  isActive: boolean;
  sequence: number;
}

interface QuestionsTestProps {
  assessment: any;
  // Optional full exercise doc from the parent's already-loaded list
  // (`rawExercises` in Assessment.tsx). Carries `sectionConfigs` /
  // `questionSource` / `customSources` that the slim `assessment` view
  // record drops. When present we seed `fullExercise` from it INSTANTLY
  // — no wait for our own getExerciseById round trip — and, if that
  // round trip comes back missing `sectionConfigs` (some code paths
  // strip Map fields), we keep the preloaded values so the Section
  // Picker doesn't fall to "No sections found" for section-based
  // assessments that clearly have sections.
  preloadedExercise?: any;
  onBack: () => void;
  nodeId: string;
  nodeName: string;
  subcategory: string;
  nodeType: string;
  tabType: string;
  hierarchyData: any;
}

// Helper: Extract plain text from content blocks (rich text format)
const extractPlainText = (content: string | any[] | undefined): string => {
  if (!content) return '';
  if (typeof content === 'string') return content.replace(/<[^>]*>/g, '').trim();
  if (Array.isArray(content)) {
    return content
      .filter((block: any) => block.type === 'text' && block.value)
      .map((block: any) => (typeof block.value === 'string' ? block.value : '').replace(/<[^>]*>/g, '').trim())
      .join(' ')
      .trim();
  }
  return '';
};

// ─── Section Picker Modal (ported from Assessment.tsx) ────────────────────────
const SectionPickerModal: React.FC<{
  exercise: any;
  onClose: () => void;
  onPick: (sectionCfg: any, sectionMeta: any) => void;
}> = ({ exercise, onClose, onPick }) => {
  const sectionConfigs = exercise?.sectionConfigs || {};
  const allQuestions: any[] = exercise?.questions || [];

  const countBySectionId: Record<string, { mcq: number; programming: number }> = {};
  allQuestions.forEach((q: any) => {
    if (q.sectionId) {
      if (!countBySectionId[q.sectionId]) countBySectionId[q.sectionId] = { mcq: 0, programming: 0 };
      if (q.questionType === 'mcq') countBySectionId[q.sectionId].mcq++;
      if (q.questionType === 'programming') countBySectionId[q.sectionId].programming++;
    }
  });

  const sections: any[] = Object.keys(sectionConfigs)
    .map((key) => {
      const cfg = sectionConfigs[key] || {};
      const sectionId = cfg.id || key;
      const exerciseType: string = cfg.exerciseType || 'MCQ';
      const counts = countBySectionId[sectionId] || { mcq: 0, programming: 0 };

      const mcqLimit = cfg.mcqConfig?.generalQuestionCount || 0;
      const mcqCount = counts.mcq;
      const mcqFull = mcqLimit > 0 && mcqCount >= mcqLimit;

      const pc = cfg.programmingConfig || {};
      let progLimit = 0;
      if (pc.questionConfigType === 'general') {
        progLimit = pc.generalQuestionCount || 0;
      } else {
        const lb = pc.levelBasedCounts || {};
        progLimit = (lb.easy || 0) + (lb.medium || 0) + (lb.hard || 0);
      }
      const progCount = counts.programming;
      const progFull = progLimit > 0 && progCount >= progLimit;

      let isFull = false;
      if (exerciseType === 'MCQ') isFull = mcqFull;
      if (exerciseType === 'Programming') isFull = progFull;
      if (exerciseType === 'Combined') isFull = mcqFull && progFull;

      // Recompute totalMarks from counts × marksPerQuestion instead of trusting
      // the stored `cfg.totalMarks`. That stored field is only refreshed inside
      // SectionConfiguration when the trainer actively touches controls — if a
      // later marks bump happened without triggering the recalc, the stored
      // value goes stale (e.g. shows 32 when the level-based math actually adds
      // up to 50). Recomputing here is the authoritative source of truth.
      const _mcqMarks = (() => {
        const m = cfg.mcqConfig;
        if (!m) return 0;
        if (m.scoreSettings?.scoreType === 'equalDistribution') {
          return (m.generalQuestionCount || 0) * (m.scoreSettings?.equalDistribution || 0);
        }
        return 0;
      })();
      const _progMarks = (() => {
        const p = cfg.programmingConfig;
        if (!p) return 0;
        const cfgType = p.questionConfigType || 'general';
        if (cfgType === 'general') {
          return (p.generalQuestionCount || 0) * (p.scoreSettings?.equalDistribution || 0);
        }
        // levelBased / selectionLevel — sum counts × per-level marksPerQuestion.
        const counts = (cfgType === 'selectionLevel' ? p.selectionLevelCounts : p.levelBasedCounts) || {};
        const scoring = p.levelScoring || {};
        return (['easy', 'medium', 'hard'] as const).reduce((s, d) => {
          const c = counts[d] || 0;
          const sc = scoring[d] || {};
          if (c <= 0) return s;
          if (sc.type === 'level_specific') return s + c * (sc.marksPerQuestion || 0);
          // total-based scoring for the diff — take the level's stored total.
          return s + (sc.totalMarks || 0);
        }, 0);
      })();
      const _computedTotalMarks =
        exerciseType === 'MCQ' ? _mcqMarks
        : exerciseType === 'Programming' ? _progMarks
        : exerciseType === 'Combined' ? (_mcqMarks + _progMarks)
        : 0;
      // Prefer the computed value; fall back to the stored one only when the
      // computed math yields 0 (config incomplete). Keeps stale saves from
      // masquerading as the truth in the section picker.
      const _finalTotalMarks = _computedTotalMarks > 0 ? _computedTotalMarks : (cfg.totalMarks ?? 0);

      return {
        id: sectionId, name: cfg.name || key, order: cfg.sectionNumber ?? 0,
        totalMarks: _finalTotalMarks, description: cfg.description || '',
        exerciseType, mcqLimit, mcqCount, mcqFull, progLimit, progCount, progFull, isFull,
        _cfg: cfg,
      };
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  const typeMeta: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    MCQ: { label: "MCQ", color: "#6366f1", bg: "rgba(99,102,241,0.10)", icon: <List size={11} /> },
    Programming: { label: "Programming", color: "#059669", bg: "rgba(5,150,105,0.10)", icon: <Code size={11} /> },
    Combined: { label: "Combined", color: "#8b5cf6", bg: "rgba(139,92,246,0.10)", icon: <Layers size={11} /> },
    Other: { label: "Other", color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: <FlaskConical size={11} /> },
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,15,30,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg overflow-hidden"
        style={{ boxShadow: '0 20px 56px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: T.border, background: T.blueLight }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: T.bg }}>
              <Layers size={15} style={{ color: T.blue }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: T.textMain }}>Select Section</h3>
              <p className="text-[10.5px]" style={{ color: T.textMuted }}>
                {exercise?.exerciseInformation?.exerciseName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white">
            <X size={15} style={{ color: T.textMuted }} />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto" style={{ background: T.pageBg }}>
          {sections.length === 0 ? (
            <div className="text-center py-10 text-xs" style={{ color: T.textMuted }}>No sections found.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {sections.map((sec: any, idx: number) => {
                const tm = typeMeta[sec.exerciseType] || typeMeta.MCQ;
                return (
                  <button
                    key={sec.id || idx}
                    onClick={() => !sec.isFull && onPick(sec._cfg, sec)}
                    disabled={sec.isFull}
                    className="text-left p-3 rounded-xl flex items-center gap-3 transition-all"
                    style={{
                      background: sec.isFull ? '#f9f9fb' : T.bg,
                      border: `1px solid ${sec.isFull ? '#e0e0e0' : T.border}`,
                      cursor: sec.isFull ? 'not-allowed' : 'pointer',
                      opacity: sec.isFull ? 0.65 : 1,
                    }}
                    onMouseEnter={e => {
                      if (!sec.isFull) {
                        (e.currentTarget as HTMLElement).style.borderColor = T.blue;
                        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${T.blueGlow}`;
                      }
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = sec.isFull ? '#e0e0e0' : T.border;
                      (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                    }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold"
                      style={{ background: sec.isFull ? '#efefef' : T.blueLight, color: sec.isFull ? T.textMuted : T.blue }}>
                      {sec.order || idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12.5px] font-bold truncate" style={{ color: sec.isFull ? T.textMuted : T.textMain }}>
                          {sec.name}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide flex-shrink-0"
                          style={{ background: tm.bg, color: tm.color }}>
                          {tm.icon}{tm.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {sec.mcqLimit > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{ background: sec.mcqFull ? '#fee2e2' : 'rgba(99,102,241,0.08)', color: sec.mcqFull ? T.red : '#6366f1' }}>
                            <List size={8} />MCQ {sec.mcqCount}/{sec.mcqLimit}{sec.mcqFull && ' ✓'}
                          </span>
                        )}
                        {sec.progLimit > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold"
                            style={{ background: sec.progFull ? '#fee2e2' : 'rgba(5,150,105,0.08)', color: sec.progFull ? T.red : '#059669' }}>
                            <Code size={8} />Prog {sec.progCount}/{sec.progLimit}{sec.progFull && ' ✓'}
                          </span>
                        )}
                        <span className="text-[9px]" style={{ color: T.textMuted }}>{sec.totalMarks} marks</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {sec.isFull ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black"
                          style={{ background: '#fee2e2', color: T.red }}>Full</span>
                      ) : (
                        <ChevronRight size={14} style={{ color: T.textHint }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Type Picker Modal (ported from Assessment.tsx) ───────────────────────────
const TypePickerModal: React.FC<{
  section: any;
  onClose: () => void;
  onBack: () => void;
  onPick: (type: 'MCQ' | 'Programming') => void;
}> = ({ section, onClose, onBack, onPick }) => {
  const mcqFull = section?.mcqFull || false;
  const progFull = section?.progFull || false;
  const mcqCount = section?.mcqCount || 0;
  const mcqLimit = section?.mcqLimit || 0;
  const progCount = section?.progCount || 0;
  const progLimit = section?.progLimit || 0;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,15,30,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
        style={{ boxShadow: '0 20px 56px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: T.border, background: 'rgba(139,92,246,0.10)' }}>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-1 rounded-lg hover:bg-white" title="Back">
              <ChevronLeft size={14} style={{ color: T.textMuted }} />
            </button>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: T.bg }}>
              <Layers size={15} style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: T.textMain }}>Question Type</h3>
              <p className="text-[10.5px]" style={{ color: T.textMuted }}>Section: {section?.name} (Combined)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white">
            <X size={15} style={{ color: T.textMuted }} />
          </button>
        </div>

        <div className="p-4 grid grid-cols-2 gap-3" style={{ background: T.pageBg }}>
          {/* MCQ */}
          <button
            onClick={() => !mcqFull && onPick('MCQ')}
            disabled={mcqFull}
            className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all relative"
            style={{
              background: mcqFull ? '#f9f9fb' : T.bg,
              border: `1px solid ${mcqFull ? '#e0e0e0' : T.border}`,
              cursor: mcqFull ? 'not-allowed' : 'pointer',
              opacity: mcqFull ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!mcqFull) { (e.currentTarget as HTMLElement).style.borderColor = '#6366f1'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(99,102,241,0.22)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = mcqFull ? '#e0e0e0' : T.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            {mcqFull && (
              <span className="absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: '#fee2e2', color: T.red }}>Full</span>
            )}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: mcqFull ? '#efefef' : 'rgba(99,102,241,0.10)' }}>
              <List size={22} style={{ color: mcqFull ? T.textMuted : '#6366f1' }} />
            </div>
            <div className="text-[12px] font-bold" style={{ color: mcqFull ? T.textMuted : T.textMain }}>MCQ Question</div>
            <div className="text-[10px] font-semibold" style={{ color: mcqFull ? T.red : T.textMuted }}>
              {mcqLimit > 0 ? `${mcqCount} / ${mcqLimit} added` : `${mcqCount} added`}
            </div>
            {mcqLimit > 0 && (
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#e4e4ed' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (mcqCount / mcqLimit) * 100)}%`, background: mcqFull ? T.red : '#6366f1' }} />
              </div>
            )}
          </button>

          {/* Programming */}
          <button
            onClick={() => !progFull && onPick('Programming')}
            disabled={progFull}
            className="p-4 rounded-xl flex flex-col items-center gap-2 transition-all relative"
            style={{
              background: progFull ? '#f9f9fb' : T.bg,
              border: `1px solid ${progFull ? '#e0e0e0' : T.border}`,
              cursor: progFull ? 'not-allowed' : 'pointer',
              opacity: progFull ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!progFull) { (e.currentTarget as HTMLElement).style.borderColor = '#059669'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(5,150,105,0.22)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = progFull ? '#e0e0e0' : T.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
          >
            {progFull && (
              <span className="absolute top-2 right-2 text-[8px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: '#fee2e2', color: T.red }}>Full</span>
            )}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: progFull ? '#efefef' : 'rgba(5,150,105,0.10)' }}>
              <Code size={22} style={{ color: progFull ? T.textMuted : '#059669' }} />
            </div>
            <div className="text-[12px] font-bold" style={{ color: progFull ? T.textMuted : T.textMain }}>Programming</div>
            <div className="text-[10px] font-semibold" style={{ color: progFull ? T.red : T.textMuted }}>
              {progLimit > 0 ? `${progCount} / ${progLimit} added` : `${progCount} added`}
            </div>
            {progLimit > 0 && (
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#e4e4ed' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${Math.min(100, (progCount / progLimit) * 100)}%`, background: progFull ? T.red : '#059669' }} />
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Portal Dropdown ──────────────────────────────────────────────────────────
const PortalDropMenu: React.FC<{
  anchorEl: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ anchorEl, onClose, children }) => {
  const [style, setStyle] = React.useState<React.CSSProperties>({ visibility: 'hidden', position: 'fixed' });
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Estimated menu height (Preview + Edit + Delete = 3 rows × ~32px + padding).
  // We use an estimate up-front so the first paint doesn't flash below the
  // anchor before flipping — measurement below refines it when the DOM lands.
  const ESTIMATED_MENU_HEIGHT = 110;

  const positionMenu = React.useCallback((height: number) => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 120;
    const GAP = 4;
    const SAFE = 8;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 0;

    // Prefer opening downward. Flip up when there isn't enough room below,
    // and up has more room — so the menu never clips at the viewport edge.
    // Bottom-of-list rows (screenshot case) trigger the flip.
    const spaceBelow = viewportH - rect.bottom - GAP;
    const spaceAbove = rect.top - GAP;
    const openUp = height > spaceBelow && spaceAbove > spaceBelow;

    let top = openUp ? rect.top - height - GAP : rect.bottom + GAP;
    // Clamp against the viewport if the menu is taller than the viewport.
    top = Math.max(SAFE, Math.min(top, viewportH - height - SAFE));

    let left = rect.right - menuWidth;
    if (left < SAFE) left = SAFE;

    setStyle({
      position: 'fixed',
      top,
      left,
      width: menuWidth,
      zIndex: 9999,
      background: T.bg,
      border: `1px solid ${T.border}`,
      borderRadius: 8,
      boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
      visibility: 'visible',
    });
  }, [anchorEl]);

  // First pass: position with the estimated height so the menu never appears
  // in the wrong spot even on the first paint. Second pass: measure and
  // re-position with the true height. Re-runs on window resize/scroll so the
  // menu stays anchored when the viewport changes mid-open.
  React.useEffect(() => {
    if (!anchorEl) return;
    positionMenu(ESTIMATED_MENU_HEIGHT);
    // requestAnimationFrame lets the portal children mount so measurement lands
    // on the real DOM node, not zero.
    const rafId = requestAnimationFrame(() => {
      const measured = menuRef.current?.getBoundingClientRect().height || ESTIMATED_MENU_HEIGHT;
      positionMenu(measured);
    });
    const onResize = () => {
      const h = menuRef.current?.getBoundingClientRect().height || ESTIMATED_MENU_HEIGHT;
      positionMenu(h);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [anchorEl, positionMenu]);

  // Outside-click closes the menu — but the ⋮ button that opens it must NOT
  // count as "outside", otherwise a second click on the same button would fire
  // mousedown → onClose (menu closes) then onClick → toggle (menu re-opens),
  // and the user perceives the button as "not hiding". Ignore any mousedown
  // whose target lives inside the anchor element or inside the menu itself.
  React.useEffect(() => {
    const handleClose = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target && anchorEl && anchorEl.contains(target)) return;
      if (target && menuRef.current && menuRef.current.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClose);
    return () => document.removeEventListener('mousedown', handleClose);
  }, [onClose, anchorEl]);

  if (!anchorEl || typeof window === 'undefined') return null;
  return ReactDOM.createPortal(
    <div ref={menuRef} style={style} onMouseDown={e => e.stopPropagation()}>
      {children}
    </div>,
    document.body
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const QuestionsTest: React.FC<QuestionsTestProps> = ({
  assessment,
  preloadedExercise,
  onBack,
  nodeId,
  nodeName,
  subcategory,
  nodeType,
  tabType,
  hierarchyData,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSubType, setSelectedSubType] = useState<'mcq' | 'programming' | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [openDrop, setOpenDrop] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [showSlotTip, setShowSlotTip] = useState(false); // hover tooltip on the "Add Question" button

  // ── Add-Question flow state (mirrors Assessment.tsx) ──────────────────────
  // Extended with a 'source' step so the trainer picks Manual / Bank / AI / Doc
  // (based on the exercise's questionSource + customSources) BEFORE the form
  // mounts — matching the We_Do QuestionsView flow.
  const [addQ, setAddQ] = useState<{
    step: 'section' | 'type' | 'source' | 'form' | null;
    exercise?: any;
    section?: any;
    questionType?: 'MCQ' | 'Programming';
    // Which chooser option the trainer picked. Drives autoOpenSource on the
    // form and which sibling modal (bank / AI / doc) is mounted instead.
    sourceChoice?: 'manual' | 'bank' | 'ai' | 'thirdParty' | 'doc';
  }>({ step: null });

  // Sibling flows opened from the source chooser. Each finishes by either
  // returning bank-preloaded questions into the form (setBankPreload + open
  // form) or closing the whole Add flow.
  const [showQBank, setShowQBank] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [bankPreload, setBankPreload] = useState<{ questions: any[]; source: string } | null>(null);

  // ── AI / Other Platform close-trap ─────────────────────────────────────────
  // A slot's designated source (AI or Other Platform) must not be silently
  // bypassed by closing an empty dialog. Both refs flip to `true` the moment
  // the dialog produces content (AI onSave, Bank onSelect); onClose reads the
  // ref and, if false + sourceChoice is 'ai' or 'thirdParty', refuses to close
  // — instead flashing a red viewport ring, playing a Windows-style ding, and
  // firing a toast that names the reason + offers "Change source" as the
  // explicit escape. Manual / Bank (internal) close freely — only the two
  // sources that CAN'T be silently switched to something else are trapped.
  const aiHasContentRef = useRef(false);
  const qbHasContentRef = useRef(false);
  const [trapFlash, setTrapFlash] = useState(0);
  const trapDingRef = useRef<AudioContext | null>(null);
  const playTrapDing = useCallback(() => {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      if (!trapDingRef.current) trapDingRef.current = new Ctx();
      const ctx = trapDingRef.current!;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      // Fast down-chirp for that Windows "error" feel.
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch { /* audio blocked — silent fail is fine */ }
  }, []);
  const flashViewport = useCallback(() => {
    setTrapFlash((n) => n + 1);
    // The overlay auto-hides via its own timer — see the render at the bottom.
  }, []);
  const trapCloseAttempt = useCallback((source: 'ai' | 'thirdParty') => {
    playTrapDing();
    flashViewport();
    const isAI = source === 'ai';
    const label = isAI ? 'AI' : 'Other Platform';
    const action = isAI ? 'generate a question' : 'pick a question';
    toast.custom((t) => (
      <div
        style={{
          background: '#fef2f2',
          border: '1.5px solid #ef4444',
          borderRadius: 10,
          padding: '10px 14px',
          minWidth: 340,
          maxWidth: 460,
          boxShadow: '0 8px 24px rgba(239,68,68,0.18)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          fontSize: 13,
          color: '#7f1d1d',
          fontWeight: 500,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>Cannot close — slot is designated for {label}</div>
          <div style={{ fontSize: 12, color: '#991b1b' }}>
            This slot must be filled from {label}. {isAI ? 'Generate a question' : 'Pick a question'} or use&nbsp;
            <b>Change source</b> to switch away from {label}.
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => {
                // Explicit source change — allowed. Reset the flag so we don't
                // trap again, close the sibling modal, and drop the trainer
                // back at the source-picker step so they can re-choose.
                aiHasContentRef.current = true;
                qbHasContentRef.current = true;
                setShowAIModal(false);
                setShowQBank(false);
                setAddQ((prev) => ({ ...prev, sourceChoice: undefined, step: 'source' }));
                toast.dismiss(t.id);
              }}
              style={{
                height: 26, padding: '0 10px', borderRadius: 6,
                border: '1px solid #b91c1c', background: '#ffffff',
                color: '#991b1b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Change source
            </button>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              style={{
                height: 26, padding: '0 10px', borderRadius: 6,
                border: '1px solid #ef4444', background: '#ef4444',
                color: '#ffffff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {action}
            </button>
          </div>
        </div>
      </div>
    ), { duration: 5000, position: 'top-center' });
  }, [playTrapDing, flashViewport]);

  // ── List filters + preview (parity with QuestionsView.tsx list toolbar) ──
  // Trainer needs to narrow long question lists by name / difficulty / type
  // without exiting the page. Preview lets them view a saved question without
  // going through the edit form's blank-heavy layout.
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [filterType, setFilterType] = useState<'all' | 'mcq' | 'programming' | 'frontend' | 'database'>('all');
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  // Pagination — page size auto-fits the visible list area (see the
  // ResizeObserver effect below) so the list never scrolls: rows past
  // the fit spill onto the next page, and the TableFooter stays pinned
  // at the workspace's bottom edge. Manual pick pins the size.
  const [pageSize, setPageSize] = useState(10);
  const [autoFitPageSize, setAutoFitPageSize] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const tableBodyRef = useRef<HTMLDivElement | null>(null);
  // Guard so the "auto-skip" branch (0 or 1 usable source) never fires twice in
  // a single addQ.step === 'source' visit (StrictMode double-render safe).
  const autoSkipAppliedRef = useRef<string | null>(null);

  // Full exercise doc — the `assessment` prop we receive from Assessment.tsx is
  // a slim view record (id, name, testType, questions, etc.); it does NOT carry
  // exerciseType / questionSource / customSources / sectionConfigs which the
  // source-chooser and section pickers need. `fetchQuestions` populates this
  // on mount (and on every refetch); every code path that reads exercise shape
  // must prefer this over `assessment`. State (not ref) so section tab / config
  // derivations below the state declarations re-render when it lands.
  // Seed from the parent's already-loaded exercise so section-based
  // assessments have real `sectionConfigs` on frame one — otherwise the
  // Section Picker opens showing "No sections found" the moment the user
  // hits Add Question before our own fetch lands (or if the fetch response
  // comes back without sectionConfigs).
  const [fullExercise, setFullExercise] = useState<any>(preloadedExercise ?? null);
  const fullExerciseRef = useRef<any>(preloadedExercise ?? null);

  // Get section configs from the full exercise doc (the slim `assessment` prop
  // does NOT carry sectionConfigs). Fallback to the prop only until the fetch
  // lands. Also drives isSectionBased / sections / the section tab strip below.
  const configSource = fullExercise || assessment;
  const sectionConfigs = configSource?.sectionConfigs || {};
  const isSectionBased = configSource?.isSectionBased || Object.keys(sectionConfigs).length > 0;

  const sections = Object.keys(sectionConfigs).map(key => ({
    id: sectionConfigs[key].id || key,
    name: sectionConfigs[key].name || key,
    order: sectionConfigs[key].sectionNumber || 0,
    exerciseType: sectionConfigs[key].exerciseType,
  })).sort((a, b) => a.order - b.order);

  // Default is "All Sections" (selectedSection = null). The earlier
  // auto-pick-first-section effect was removed so a fresh mount now
  // shows every section's questions in one flat list — same behaviour
  // as picking `All difficulty` or `All types` in the other selects.

  // When section changes, set default sub-type for Combined sections;
  // clear the sub-type when "All Sections" is chosen (Combined only
  // makes sense inside one specific section).
  useEffect(() => {
    if (selectedSection) {
      const cfg = sectionConfigs[selectedSection];
      if (cfg?.exerciseType === 'Combined') {
        setSelectedSubType('mcq');
      } else {
        setSelectedSubType(null);
      }
    } else {
      setSelectedSubType(null);
    }
  }, [selectedSection]);

  // Fetch questions
  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await exerciseApi.getExerciseById(assessment._id);
      // API shape varies — try every wrapper Assessment.tsx handles, and fall
      // back to the raw response as a last resort. Without the `|| response`
      // fallback, endpoints that return the exercise directly left fullExercise
      // undefined → Add Question stayed perpetually disabled.
      const fetched = response?.data?.exercise
        || response?.exercise
        || (response?.data && !Array.isArray(response.data) ? response.data : null)
        || response;
      // If the fresh fetch strips `sectionConfigs` (some code paths that
      // touch Mongoose Maps drop them) but the preloaded copy from the
      // parent had them, merge the fetched fields on top of the preloaded
      // ones — that way we never REGRESS the section picker from a
      // populated state to an empty one. Same rescue for `isSectionBased`.
      const fullExercise = (() => {
        const base = preloadedExercise || fullExerciseRef.current || null;
        if (!fetched) return base;
        const merged: any = { ...(base || {}), ...fetched };
        const preSecs = base?.sectionConfigs;
        const fetSecs = fetched?.sectionConfigs;
        if ((!fetSecs || Object.keys(fetSecs).length === 0) && preSecs && Object.keys(preSecs).length > 0) {
          merged.sectionConfigs = preSecs;
        }
        if (fetched.isSectionBased === undefined && base?.isSectionBased !== undefined) {
          merged.isSectionBased = base.isSectionBased;
        }
        return merged;
      })();
      if (fullExercise && (fullExercise._id || fullExercise.exerciseInformation || fullExercise.questions)) {
        // Cache the full exercise so handleOpenAddQuestion / handleEdit /
        // buildAddQExerciseData all read a doc that has the real exerciseType,
        // questionSource, sectionConfigs — not the slim view record we get in props.
        fullExerciseRef.current = fullExercise;
        setFullExercise(fullExercise);
        if (fullExercise.questions) {
          setQuestions(fullExercise.questions);
          setAddQ(prev => prev.step ? { ...prev, exercise: fullExercise } : prev);
        } else {
          setQuestions([]);
        }
      } else {
        // The API returned something we couldn't parse — fall back to the
        // preloaded full exercise if the parent sent one (has real
        // sectionConfigs / questionSource), otherwise the slim assessment
        // prop as a last resort. Slim data is enough to open the form in
        // Manual mode; source-chooser logic degrades to allow-all.
        const fb = preloadedExercise || assessment;
        fullExerciseRef.current = fb;
        setFullExercise(fb);
        setQuestions([]);
      }
    } catch (err) {
      console.error('Failed to fetch questions:', err);
      // Only toast when there's no preloaded fallback to hand over — if
      // the parent handed us a full exercise with real sectionConfigs
      // and a questions array, we can still render the whole screen from
      // that copy, so the network failure is not user-visible. The toast
      // used to fire every time and made "manage questions" look broken
      // even when the on-screen data was still correct.
      const fb = preloadedExercise || assessment;
      const preloadedHasEnough = !!preloadedExercise && (
        !!preloadedExercise.exerciseInformation
        || Array.isArray(preloadedExercise.questions)
        || (preloadedExercise.sectionConfigs && Object.keys(preloadedExercise.sectionConfigs).length > 0)
      );
      if (!preloadedHasEnough) toast.error('Failed to load questions');
      fullExerciseRef.current = fb;
      setFullExercise(fb);
      // If preloaded has questions, keep them on screen; else empty list.
      const pq = Array.isArray(preloadedExercise?.questions) ? preloadedExercise.questions : [];
      setQuestions(pq);
    } finally {
      setLoading(false);
    }
  }, [assessment]);

  useEffect(() => { fetchQuestions(); }, [fetchQuestions]);

  // ── Add-Question routing helpers ──────────────────────────────────────────
  // Derives which "add question" sources are allowed for the exercise, using the
  // same questionSource / customSources fields the CreateAssessmentModal writes
  // (parity with QuestionsView.tsx's `allowedSources`). Combined exercises with
  // a separated MCQ source (questionSourceMcq) fall back to the whole-exercise
  // source at this outer layer — per-part gating happens inside the form itself.
  const deriveAllowedSources = (ex: any) => {
    const s: string | null = ex?.questionSource || null;
    const cs: string[] = Array.isArray(ex?.customSources) ? ex.customSources : [];
    if (s === 'scratch') return { manual: true, bank: true, ai: false, thirdParty: false, upload: true };
    if (s === 'ai') return { manual: false, bank: false, ai: true, thirdParty: false, upload: false };
    if (s === 'thirdParty') return { manual: false, bank: true, ai: false, thirdParty: true, upload: false };
    if (s === 'custom') {
      const has = (x: string) => cs.includes(x);
      return {
        manual: has('scratch'), bank: has('scratch') || has('thirdParty'),
        ai: has('ai'), thirdParty: has('thirdParty'), upload: has('scratch'),
      };
    }
    // Unset (legacy pre-Phase-2 exercises) → allow all so nothing regresses.
    return { manual: true, bank: true, ai: true, thirdParty: true, upload: true };
  };

  // "Bank" (scratch's second entry point) shows only when scratch itself is
  // allowed — thirdParty gets its OWN separate button that stamps imports with
  // the thirdParty tag. Matches the We_Do popup's bankViaScratch check.
  const canBankViaScratch = (ex: any) => {
    const s: string | null = ex?.questionSource || null;
    if (!s) return true;
    if (s === 'scratch') return true;
    if (s === 'custom') return Array.isArray(ex?.customSources) && ex.customSources.includes('scratch');
    return false;
  };

  // Move to the appropriate next step after (optional) section/type picking.
  // For pure MCQ exercises, always show the chooser so trainers see AI/Bank/Doc
  // when their source config allows them. Manual-only sources auto-skip to form.
  const proceedFromSectionOrRoot = (nextExercise: any, nextSection?: any, nextQuestionType?: 'MCQ' | 'Programming') => {
    setAddQ({ step: 'source', exercise: nextExercise, section: nextSection, questionType: nextQuestionType });
  };

  // ── Open Add Question flow ────────────────────────────────────────────────
  // Root entry — decides whether we need Section → (Type) → Source → Form or
  // just Source → Form. Prefers the full exercise cached by fetchQuestions()
  // (has exerciseType / questionSource / sectionConfigs); falls back to the
  // slim `assessment` prop only if the initial fetch hasn't landed yet.
  const handleOpenAddQuestion = () => {
    // Reset the auto-skip guard at every fresh Add Question press. Without
    // this, an AI-only (or Bank-only, etc.) exercise auto-skipped once — its
    // guardKey stayed set for the component's lifetime — so the second press
    // saw the ref already matching and short-circuited, rendering nothing:
    // no chooser, no AI modal. The guard's job is only to prevent StrictMode
    // double-render from firing applySourceChoice twice within a single visit.
    autoSkipAppliedRef.current = null;
    const base = fullExerciseRef.current || assessment;
    const exerciseWithQuestions = { ...base, questions };
    if (
      exerciseWithQuestions.isSectionBased ||
      Object.keys(exerciseWithQuestions.sectionConfigs || {}).length > 0
    ) {
      setAddQ({ step: 'section', exercise: exerciseWithQuestions });
    } else {
      proceedFromSectionOrRoot(exerciseWithQuestions);
    }
  };

  const closeAddQ = () => {
    setAddQ({ step: null });
    setEditingQuestion(null);
    setShowQBank(false);
    setShowAIModal(false);
    setShowDocUpload(false);
    setBankPreload(null);
    autoSkipAppliedRef.current = null;
  };

  // Once the trainer picks a source in the chooser, decide where to go:
  //   manual         → open form as blank editor
  //   bank / thirdParty → open QuestionBankSelector; picks feed the form on close
  //   ai (MCQ)       → open GenerateMCQAIQuestion; generated Qs feed the form
  //   ai (Programming) → open form with autoOpenSource='ai' (form pops its own AI modal)
  //   doc (MCQ)      → open AddQuestionViaDocument (own selection stage)
  //   doc (Programming) → open form as manual (client-side .txt path not wired here)
  const applySourceChoice = (choice: 'manual' | 'bank' | 'ai' | 'thirdParty' | 'doc') => {
    const ex = addQ.exercise || { ...(fullExerciseRef.current || assessment), questions };
    const effType: string = (addQ.section?.exerciseType || ex.exerciseType || '').toLowerCase();
    const isMCQ = effType === 'mcq' || addQ.questionType === 'MCQ';
    const isProg = effType === 'programming' || addQ.questionType === 'Programming' ||
                   effType === 'frontend' || effType === 'database';

    // Close the chooser at pick time — parity with QuestionsView.tsx line 1227
    // (setShowAddOption(false) before opening AI). If we left step='source', the
    // chooser stayed mounted behind the sibling modal; cancelling the sibling
    // then re-showed the chooser as a full-screen overlay that ate every click
    // on the Manage-Questions header (including a second Add Question press).
    // For form paths (manual / AI-programming / doc-fallback) we jump straight
    // to 'form'; for sibling paths (bank / AI-MCQ / doc-MCQ) we set step to
    // null so a cancel returns cleanly to the list. Bank's Back button
    // explicitly re-opens the chooser via step:'source'.
    if (choice === 'manual') {
      setAddQ(prev => ({ ...prev, sourceChoice: choice, step: 'form' }));
      return;
    }
    if (choice === 'bank' || choice === 'thirdParty') {
      // Reset the close-trap content flag every time the picker opens.
      // `thirdParty` is the trapped source; `bank` is internal + free to close.
      qbHasContentRef.current = false;
      setAddQ(prev => ({ ...prev, sourceChoice: choice, step: null }));
      setShowQBank(true);
      return;
    }
    if (choice === 'ai') {
      if (isMCQ) {
        // Reset the close-trap content flag every time the AI modal opens.
        aiHasContentRef.current = false;
        setAddQ(prev => ({ ...prev, sourceChoice: choice, step: null }));
        setShowAIModal(true);
        return;
      }
      // Programming AI — the form handles its own AI modal via autoOpenSource='ai'.
      setAddQ(prev => ({ ...prev, sourceChoice: choice, step: 'form' }));
      return;
    }
    if (choice === 'doc') {
      if (isMCQ) {
        setAddQ(prev => ({ ...prev, sourceChoice: choice, step: null }));
        setShowDocUpload(true);
        return;
      }
      // Programming doc-upload not yet wired at this parent — fall back to the
      // manual editor so the trainer is never left with a dead-end click.
      setAddQ(prev => ({ ...prev, sourceChoice: choice, step: 'form' }));
      return;
    }
  };

  // ── Build exerciseData for AddQuestionForm (mirrors Assessment.tsx buildAddQExerciseData) ──
  const buildAddQExerciseData = () => {
    const ex = addQ.exercise || assessment;
    if (!ex) return null;

    let effectiveExerciseType: string = ex.exerciseType;
    if (addQ.section) {
      if (addQ.section.exerciseType === 'Combined' && addQ.questionType) {
        effectiveExerciseType = addQ.questionType;
      } else {
        effectiveExerciseType = addQ.section.exerciseType;
      }
    }

    const currentSectionId = addQ.section?.id || null;
    const currentSectionName = addQ.section?.name || null;

    const allQuestions: any[] = ex.questions || [];
    const sectionQuestions = currentSectionId
      ? allQuestions.filter((q: any) => {
          if (q.sectionId && q.sectionId === currentSectionId) return true;
          if (!q.sectionId && q.sectionName && q.sectionName === currentSectionName) return true;
          return false;
        })
      : allQuestions;

    let fullExerciseData: any = {
      ...ex,
      exerciseType: effectiveExerciseType,
      hierarchyData,
      questions: sectionQuestions,
      currentSectionId,
      currentSectionName,
    };

    if (addQ.section) {
      const sec = addQ.section;
      const mcqCfg = sec.mcqConfig || {};
      const progCfg = sec.programmingConfig || {};

      // mcqSectionMarks = TOTAL marks for the MCQ part of this section
      // Note: mcqCfg.scoreSettings.equalDistribution = marks PER QUESTION (not total),
      //       so we must NOT use it as a stand-in for the total section marks.
      const mcqSectionMarks =
        sec.mcqSectionMarks ??
        (sec.exerciseType === 'MCQ' ? sec.totalMarks : 0) ?? 0;
      const progSectionMarks =
        sec.programmingSectionMarks ?? (sec.exerciseType === 'Programming' ? sec.totalMarks : 0) ?? 0;

      const mcqGenCount = mcqCfg.generalQuestionCount || 0;
      const mcqScoringType = mcqCfg?.scoreSettings?.scoreType || 'equalDistribution';
      // equalDistribution in sectionConfig.mcqConfig = marks per question directly
      const mcqMarksPerQ: number =
        mcqCfg?.scoreSettings?.equalDistribution ||
        (mcqGenCount > 0 ? Math.floor(mcqSectionMarks / mcqGenCount) : 0);

      const mcqQuestionConfiguration = {
        scoringType: mcqScoringType,
        marksPerQuestion: mcqMarksPerQ,
        totalMcqQuestions: mcqGenCount,
        attemptLimitEnabled: mcqCfg.attemptLimitEnabled,
        submissionAttempts: mcqCfg.submissionAttempts,
      };

      // ── Programming config — only relevant when section exerciseType is Programming or Combined ──
      const pc = progCfg;
      const cfgType = pc.questionConfigType || 'general';

      const lvlCounts    = pc.levelBasedCounts    || { easy: 0, medium: 0, hard: 0 };
      const selCounts    = pc.selectionLevelCounts || { easy: 0, medium: 0, hard: 0 };
      const lvlScoring   = pc.levelScoring || {};

      // level-based: read marksPerQuestion directly from levelScoring (already per-question)
      const levelScoringConfiguration: any = {};
      const levelBasedMarks: any = {};
      (['easy', 'medium', 'hard'] as const).forEach((d) => {
        const s     = lvlScoring[d] || {};
        const count = (cfgType === 'selectionLevel' ? selCounts[d] : lvlCounts[d]) || 0;
        const mpq   = s.marksPerQuestion || 0;
        levelScoringConfiguration[d] = {
          type: s.type || 'level_specific',
          marksPerQuestion: mpq,
          questionCount: count,
          totalMarks: mpq * count,
        };
        levelBasedMarks[d] = mpq;
      });

      // general: scoreSettings.equalDistribution = marks PER QUESTION (same pattern as MCQ)
      const progGenCount: number = pc.generalQuestionCount || 0;
      const generalMarksPerQuestion: number =
        pc.scoreSettings?.equalDistribution ||
        (progGenCount > 0 ? Math.floor(progSectionMarks / progGenCount) : 0);

      const programmingQuestionConfiguration = {
        questionConfigType: cfgType,
        generalQuestionCount: progGenCount,
        generalMarksPerQuestion,
        levelBasedCounts: lvlCounts,
        selectionLevelCounts: selCounts,
        questionFlow: pc.questionFlow || 'freeFlow',
        attemptLimitEnabled: pc.attemptLimitEnabled,
        submissionAttempts: pc.submissionAttempts,
        scoreSettings: {
          ...(pc.scoreSettings || {}),
          levelScoringConfiguration,
          levelBasedMarks,
          evenMarks: generalMarksPerQuestion,  // same value, used as fallback in form
        },
      };

      const effTotalMarks =
        effectiveExerciseType === 'MCQ' ? mcqSectionMarks :
        effectiveExerciseType === 'Programming' ? progSectionMarks :
        sec.totalMarks || 0;

      fullExerciseData = {
        ...fullExerciseData,
        questionConfiguration: {
          ...(ex.questionConfiguration || {}),
          mcqQuestionConfiguration,
          programmingQuestionConfiguration,
        },
        exerciseInformation: {
          ...(ex.exerciseInformation || {}),
          totalMarks: effTotalMarks,
          totalMarksMCQ: mcqSectionMarks,
          totalMarksProgramming: progSectionMarks,
        },
        totalMarksMCQ: mcqSectionMarks,
        totalMarksProgramming: progSectionMarks,
      };
    }

    return {
      exerciseId: ex._id,
      _id: ex._id,
      exerciseName: ex.exerciseInformation?.exerciseName,
      exerciseLevel: ex.exerciseInformation?.exerciseLevel || 'intermediate',
      selectedLanguages: ex.exerciseInformation?.selectedLanguages || [],
      nodeId, nodeName, subcategory, nodeType,
      fullExerciseData,
      exerciseType: effectiveExerciseType,
      programmingSettings: ex.programmingSettings,
      subcategoryLabel: subcategory,
      currentSectionId,
      currentSectionName,
    };
  };

  // ── View-table helpers ────────────────────────────────────────────────────
  const currentSectionConfig = selectedSection ? sectionConfigs[selectedSection] : null;
  const isCurrentSectionCombined = currentSectionConfig?.exerciseType === 'Combined';

  // Extractors declared BEFORE the filter that uses them — `const`s are in the
  // Temporal Dead Zone until their declaration line, so referencing them from
  // filteredQuestions when they were defined below produced a ReferenceError
  // ("Cannot access 'getQuestionTitle' before initialization").
  const getQuestionTitle = (q: Question): string => {
    if (q.questionType === 'mcq') {
      if (q.mcqQuestionTitle) return extractPlainText(q.mcqQuestionTitle);
      if (q.questionTitle) return extractPlainText(q.questionTitle);
    }
    return extractPlainText(q.title) || extractPlainText(q.questionTitle) || 'Untitled Question';
  };

  const getQuestionDesc = (q: Question): string => {
    if (q.questionType === 'mcq') return extractPlainText(q.mcqQuestionDescription) || 'MCQ Question';
    return extractPlainText(q.description) || 'No description';
  };

  const getDifficulty = (q: Question): string => q.difficulty || 'medium';

  const getScore = (q: Question): number => {
    if (q.questionType === 'mcq') return q.mcqQuestionScore || q.score || q.points || 0;
    return q.score || q.points || 0;
  };

  const filteredQuestions = questions.filter(q => {
    if (selectedSection) {
      const matchesSection = q.sectionId === selectedSection || q.sectionName === selectedSection;
      if (!matchesSection) return false;
      if (isCurrentSectionCombined && selectedSubType && q.questionType !== selectedSubType) return false;
    }
    // Text search — matches title / description text (rich content extracted).
    if (searchQuery.trim()) {
      const q_ = searchQuery.toLowerCase();
      const title = getQuestionTitle(q).toLowerCase();
      const desc = getQuestionDesc(q).toLowerCase();
      if (!title.includes(q_) && !desc.includes(q_)) return false;
    }
    // Difficulty filter.
    if (filterDifficulty !== 'all') {
      const d = getDifficulty(q);
      if (d !== filterDifficulty) return false;
    }
    // Type filter (mcq / programming / frontend / database).
    if (filterType !== 'all') {
      if ((q.questionType || '').toLowerCase() !== filterType) return false;
    }
    return true;
  });

  const sortedQuestions = [...filteredQuestions].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  // Pagination derivations — always safe against filter/search churn.
  const totalPages = Math.max(1, Math.ceil(sortedQuestions.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, sortedQuestions.length);
  const paginatedQuestions = sortedQuestions.slice(pageStart, pageEnd);
  // Reset to page 1 when filters/search/section/subtype/list-size change so
  // the trainer never lands on a stale empty page.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDifficulty, filterType, selectedSection, selectedSubType, questions.length]);

  // Auto-fit page size to the visible tbody region — measures its
  // clientHeight and picks the largest itemsPerPage whose h-11 rows all
  // fit above the pagination footer with a half-row safety margin. Rows
  // past the fit spill onto the next page (no scroll bar surfaces on
  // this list). Turns off the moment the user picks a size manually.
  useEffect(() => {
    if (!autoFitPageSize) return;
    const el = tableBodyRef.current;
    if (!el) return;
    const ROW_H = 44;
    const SAFETY = Math.round(ROW_H / 2);
    const compute = () => {
      const budget = Math.max(0, el.clientHeight - SAFETY);
      const fits = Math.max(3, Math.min(50, Math.floor(budget / ROW_H)));
      setPageSize(prev => (prev === fits ? prev : fits));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFitPageSize, loading]);

  const mcqCount = questions.filter(q =>
    (q.sectionId === selectedSection || q.sectionName === selectedSection) && q.questionType === 'mcq'
  ).length;
  const programmingCount = questions.filter(q =>
    (q.sectionId === selectedSection || q.sectionName === selectedSection) && q.questionType === 'programming'
  ).length;

  // ── Slot fill — drives the disabled "Add Question" button + its hover tooltip ──
  // Counts saved questions against the configured quota for a given context. For
  // programming it honours the per-level (easy/medium/hard) quota the form really
  // enforces; for MCQ a single total. A context is "full" when no slot remains.
  const computeFill = useCallback((cfg: any, sectionId: string | null) => {
    // Read exercise shape from the full doc when it's landed; fall back to the
    // slim prop only until then (used to always fall back — meant tooltip
    // showed default 'Programming' slot rows for MCQ exercises pre-fetch).
    const cs: any = fullExercise || assessment;
    const exType: string = cfg?.exerciseType || cs?.exerciseType || 'Programming';
    const ctxQs = sectionId
      ? questions.filter(q => q.sectionId === sectionId || q.sectionName === sectionId)
      : questions;

    const mc = cfg?.mcqConfig || {};
    const mcqQuota = mc.generalQuestionCount || mc.totalMcqQuestions || 0;
    const mcqFilled = ctxQs.filter(q => q.questionType === 'mcq').length;
    const mcqFull = mcqQuota > 0 && mcqFilled >= mcqQuota;

    const pc = cfg?.programmingConfig || {};
    const progGeneral = (pc.questionConfigType || 'general') === 'general';
    const lvlCounts = (pc.questionConfigType === 'selectionLevel' ? pc.selectionLevelCounts : pc.levelBasedCounts) || {};
    const progQs = ctxQs.filter(q => q.questionType === 'programming');
    const levels = (['easy', 'medium', 'hard'] as const)
      .filter(d => (lvlCounts[d] || 0) > 0)
      .map(d => ({ d, quota: lvlCounts[d] || 0, filled: progQs.filter(q => (q.difficulty || 'medium') === d).length }));
    const progGenQuota = pc.generalQuestionCount || 0;
    const progFilled = progQs.length;
    const progFull = progGeneral
      ? (progGenQuota > 0 && progFilled >= progGenQuota)
      : (levels.length > 0 && levels.every(l => l.filled >= l.quota));

    let full = false;
    if (exType === 'MCQ') full = mcqFull;
    else if (exType === 'Programming') full = progFull;
    else if (exType === 'Combined') full = mcqFull && progFull;

    return { exType, mcqQuota, mcqFilled, mcqFull, progGeneral, progGenQuota, progFilled, progFull, levels, full };
  }, [questions, assessment, fullExercise]);

  // Config for a section id (sectionConfigs is keyed by an arbitrary key whose
  // entry may carry its own `id`), falling back to the synthesized exercise config.
  // Prefer the full-exercise doc — the slim `assessment` prop has no
  // questionConfiguration, which would leave the tooltip showing 0 slots.
  const cfgForSectionId = (sid: string | null): any => {
    if (sid) {
      for (const key of Object.keys(sectionConfigs)) {
        const c = sectionConfigs[key];
        if ((c.id || key) === sid) return c;
      }
    }
    const cs: any = fullExercise || assessment;
    return {
      exerciseType: cs?.exerciseType,
      mcqConfig: {
        generalQuestionCount: cs?.questionConfiguration?.mcqQuestionConfiguration?.totalMcqQuestions
          || cs?.questionConfiguration?.mcqQuestionConfiguration?.generalQuestionCount || 0,
        totalMcqQuestions: cs?.questionConfiguration?.mcqQuestionConfiguration?.totalMcqQuestions || 0,
      },
      programmingConfig: cs?.questionConfiguration?.programmingQuestionConfiguration || {},
    };
  };

  // Tooltip reflects the section currently being viewed (or the whole exercise).
  const slotCtx = computeFill(cfgForSectionId(selectedSection), (isSectionBased && selectedSection) ? selectedSection : null);

  // Disable when there is genuinely nowhere left to add a question: every
  // section full (section-based), or the single exercise full (non-section).
  // ALSO disable while the initial exercise fetch is still in flight — before
  // that, `assessment` is the slim view record with no exerciseType /
  // questionSource / sectionConfigs, so handleOpenAddQuestion would compute
  // an empty allowed-sources set, auto-skip the chooser, and drop the trainer
  // straight into a blank Manual form. Waiting one round-trip (~100ms) fixes
  // the race the user hit by clicking during the loading spinner.
  const addQuestionDisabled = loading || fullExercise === null
    || (isSectionBased
        ? Object.keys(sectionConfigs).length > 0 &&
          Object.keys(sectionConfigs).every(key => computeFill(sectionConfigs[key], sectionConfigs[key].id || key).full)
        : slotCtx.full);

  // Badges
  const TYPE_CFG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    mcq: { label: 'MCQ', color: '#7c3aed', bg: '#f5f3ff', dot: '#a78bfa' },
    programming: { label: 'Coding', color: '#e0623f', bg: 'rgba(242,119,87,0.08)', dot: '#F27757' },
    frontend: { label: 'Frontend', color: '#d97706', bg: '#fffbeb', dot: '#f59e0b' },
    database: { label: 'Database', color: '#16a34a', bg: '#f0fdf4', dot: '#22c55e' },
  };

  const TypeBadge = ({ type }: { type: string }) => {
    const c = TYPE_CFG[type] || TYPE_CFG.programming;
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}20` }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
        {c.label}
      </span>
    );
  };

  const DIFF_CFG: Record<string, { bg: string; color: string }> = {
    easy: { bg: '#f0fdf4', color: '#16a34a' },
    medium: { bg: '#fffbeb', color: '#d97706' },
    hard: { bg: '#fff1f2', color: '#e11d48' },
  };

  const DiffBadge = ({ level }: { level: string }) => {
    const c = DIFF_CFG[level] || DIFF_CFG.medium;
    return (
      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.color }}>
        {level}
      </span>
    );
  };

  // Approval-status pill — trainer-actionable states only. 'pending' is the
  // server-default for every workflow-enabled question, and 'approved' is the
  // benign steady state — surfacing either would just add noise on every row.
  // Only 'queried' (approver asked a question — trainer needs to reply) and
  // 'rejected' (must be edited + resubmitted) render a pill, matching the
  // approver-attention model We_Do uses at the exercise level.
  const ApprovalPill = ({ status }: { status?: string }) => {
    if (!status) return null;
    const key = status.toLowerCase();
    if (key !== 'queried' && key !== 'rejected') return null;
    const cfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
      queried:  { label: 'Queried',  color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
      rejected: { label: 'Rejected', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    };
    const c = cfg[key];
    return (
      <span className="inline-flex items-center shrink-0 text-[9px] font-bold uppercase px-1.5 py-[1px] rounded-full ml-1.5"
        style={{ letterSpacing: '0.03em', color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
        title={`Approval: ${c.label}`}>
        {c.label}
      </span>
    );
  };

  // Source pill — shows AI / Manual / Other Platform next to the question
  // title. Bank picks bill the Manual quota slice (both come out of the
  // scratch allocation), so 'scratch-bank' coalesces into 'Manual' — no
  // separate Bank badge. The only distinctions worth surfacing are the ones
  // that map to different quota slices: AI ('ai') and Other Platform
  // ('thirdParty'). Legacy questions with no source render nothing.
  const SourceBadge = ({ source }: { source?: string | null }) => {
    const s = (source ?? '').toString();
    if (!s) return null;
    const key = s === 'ai' ? 'ai'
      : s.startsWith('thirdParty') ? 'thirdParty'
      : s.startsWith('scratch') ? 'manual'
      : null;
    if (!key) return null;
    const cfg: Record<string, { label: string; color: string; bg: string; border: string }> = {
      manual:     { label: 'Manual',         color: '#475569', bg: 'rgba(100,116,139,0.08)', border: '#e2e8f0' },
      ai:         { label: 'AI',             color: '#6366f1', bg: 'rgba(99,102,241,0.08)',  border: '#c7d2fe' },
      thirdParty: { label: 'Other Platform', color: '#0d9488', bg: 'rgba(13,148,136,0.08)',  border: '#99f6e4' },
    };
    const c = cfg[key];
    return (
      <span className="inline-flex items-center shrink-0 text-[9px] font-bold uppercase px-1.5 py-[1px] rounded-full ml-1.5"
        style={{ letterSpacing: '0.03em', color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
        title={`Question source: ${c.label}`}>
        {c.label}
      </span>
    );
  };

  // Edit — go straight to form with existing question data
  const handleEdit = (q: Question) => {
    setEditingQuestion(q);
    // For edit: skip section picker, go straight to form using current view-tab context
    const currentSection = sections.find(s => s.id === (q.sectionId || selectedSection));
    let questionType: 'MCQ' | 'Programming' | undefined;
    if (q.questionType === 'mcq') questionType = 'MCQ';
    else if (q.questionType === 'programming') questionType = 'Programming';

    // Prefer the cached full exercise (has real exerciseType / questionSource /
    // sectionConfigs) so buildAddQExerciseData produces a fullExerciseData the
    // form can trust — otherwise editing populates from a slim shell and fields
    // stay blank.
    const base = fullExerciseRef.current || assessment;

    setAddQ({
      step: 'form',
      exercise: base,
      section: currentSection
        ? { ...currentSection, ...(sectionConfigs[currentSection.id] || {}) }
        : undefined,
      questionType,
    });
  };

  // Delete
  const handleDelete = (q: Question) => { setQuestionToDelete(q); setShowDeleteModal(true); };

  const confirmDelete = async () => {
    if (!questionToDelete) return;
    setDeleting(true);
    try {
      const entityTypeMap: Record<string, any> = {
        module: 'modules', submodule: 'submodules', topic: 'topics', subtopic: 'subtopics',
      };
      await questionApi.deleteQuestion(
        entityTypeMap[nodeType] || 'topics',
        nodeId, assessment._id, questionToDelete._id, tabType, subcategory
      );
      await fetchQuestions();
      toast.success('Question deleted');
      setShowDeleteModal(false);
      setQuestionToDelete(null);
    } catch (err) {
      toast.error('Failed to delete question');
    } finally {
      setDeleting(false);
    }
  };

  // Delete Modal
  const DeleteConfirmModal = () => (
    <div className="fixed inset-0 flex items-center justify-center z-[1000]" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: T.redLight }}>
              <AlertTriangle size={16} style={{ color: T.red }} />
            </div>
            <h3 className="text-base font-bold" style={{ color: T.textMain }}>Delete Question</h3>
          </div>
          <button onClick={() => setShowDeleteModal(false)} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={16} style={{ color: T.textMuted }} />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm" style={{ color: T.textSub }}>
            Are you sure you want to delete{' '}
            <span className="font-semibold" style={{ color: T.textMain }}>
              "{questionToDelete ? getQuestionTitle(questionToDelete) : ''}"
            </span>?
          </p>
          <p className="text-xs mt-2" style={{ color: T.textMuted }}>This action cannot be undone.</p>
        </div>
        <div className="flex items-center justify-end gap-3 p-4 border-t" style={{ borderColor: T.border, background: T.pageBg }}>
          <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ color: T.textSub, background: T.bg, border: `1px solid ${T.border}` }}>
            Cancel
          </button>
          <button onClick={confirmDelete} disabled={deleting}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{ background: T.red }}>
            {deleting
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting...</>
              : <><Trash2 size={14} />Delete</>}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Initial-load overlay ───────────────────────────────────────────────
  // While the initial fetch is in flight, the header (title + disabled Add
  // Question button) rendered on top of an empty content area — trainer sees
  // a partial UI that reads as "half-loaded". A full-panel loader covering
  // everything until data lands feels more like a single, deliberate loading
  // moment. Only shown for the very first fetch (before `fullExercise` lands);
  // subsequent refetches (e.g. after adding a question) don't blank the page.
  if (loading && fullExercise === null) {
    // Whole-panel first-load state — uses the app-wide <Loading /> (Swirling
    // brand ring) so the moment reads as the same loading UX every other
    // route uses, not a bespoke blue ring specific to Manage Questions. The
    // header row inside the page is suppressed while this shows, so no
    // controls are actionable during first fetch.
    return (
      <div className="flex flex-col h-full items-center justify-center" style={{ background: T.bg, fontFamily: "'Poppins', sans-serif" }}>
        <Loading label="Loading assessment…" size="size-14" />
        <p className="text-[12px] mt-1.5 max-w-xs text-center" style={{ color: T.textMuted }}>
          Fetching the exercise configuration and its saved questions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: T.bg, fontFamily: "'Poppins', sans-serif" }}>
      {/* Header — Back + title on the left, Add Question primary on the
          right. Repainted onto the Client Management / Assessment button
          rhythm: h-8 pill buttons on design system tokens (brand-strong
          for the primary, subtle for the icon-only Back). Left/right
          gutter matches the toolbar and list below. */}
      <div className="flex-shrink-0 bg-surface px-3 sm:px-4 md:px-6 pt-3 pb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            title="Back"
            className="inline-flex items-center justify-center h-8 w-8 rounded-control border border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
          >
            <ArrowLeft size={14} />
          </button>
          {/* Title carries the assessment's name so the trainer always
              knows WHICH assessment they're managing — the previous
              subtitle read `assessment?.exerciseInformation?.exerciseName`
              which is undefined on the slim `assessment` view record
              handed in from the list (that field only exists on the full
              exercise doc). Falls back through the full doc / preloaded
              copy / slim record so it's never blank. */}
          {(() => {
            const asmName = assessment?.name
              || fullExercise?.exerciseInformation?.exerciseName
              || preloadedExercise?.exerciseInformation?.exerciseName
              || 'Untitled Assessment';
            const asmId = assessment?.id
              || fullExercise?.exerciseInformation?.exerciseId
              || preloadedExercise?.exerciseInformation?.exerciseId
              || '';
            return (
              <div className="min-w-0">
                <p className="text-2xs font-semibold uppercase tracking-wider text-faint">Manage Questions</p>
                <h2 className="text-sm font-semibold text-heading tracking-[-0.01em] truncate flex items-center gap-2">
                  <span className="truncate" title={asmName}>{asmName}</span>
                  {asmId && (
                    <span
                      className="inline-flex items-center h-4 px-1.5 rounded-full bg-brand-wash text-brand-strong text-2xs font-semibold tabular-nums flex-shrink-0"
                      title={`Exercise ID · ${asmId}`}
                    >
                      {asmId}
                    </span>
                  )}
                </h2>
              </div>
            );
          })()}
        </div>
        <div className="relative flex-shrink-0" onMouseEnter={() => setShowSlotTip(true)} onMouseLeave={() => setShowSlotTip(false)}>
          <button
            type="button"
            onClick={() => { if (!addQuestionDisabled) handleOpenAddQuestion(); }}
            disabled={addQuestionDisabled}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} strokeWidth={2.4} /> <span className="text-xs font-semibold">Add Question</span>
          </button>

          {/* Slot-status tooltip (hover) — MCQ count and/or programming per-level / total */}
          {showSlotTip && (
            <div className="absolute top-full right-0 mt-2 z-[1100]" style={{ background: '#1a1a2e', color: '#fff', borderRadius: 8, padding: '9px 12px', boxShadow: '0 10px 28px rgba(0,0,0,0.28)', fontFamily: "'Poppins', sans-serif", whiteSpace: 'nowrap', minWidth: 168 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 7 }}>
                {loading || fullExercise === null
                  ? 'Loading exercise…'
                  : addQuestionDisabled ? 'All slots filled — delete to add' : 'Question slots'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {(slotCtx.exType === 'MCQ' || slotCtx.exType === 'Combined') && slotCtx.mcqQuota > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, fontSize: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#a5b4fc' }} />MCQ
                    </span>
                    <span style={{ fontWeight: 700, color: slotCtx.mcqFull ? '#fca5a5' : '#fff' }}>{slotCtx.mcqFilled}/{slotCtx.mcqQuota}</span>
                  </div>
                )}
                {(slotCtx.exType === 'Programming' || slotCtx.exType === 'Combined') && (
                  slotCtx.progGeneral ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, fontSize: 12 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fdba74' }} />Programming
                      </span>
                      <span style={{ fontWeight: 700, color: slotCtx.progFull ? '#fca5a5' : '#fff' }}>{slotCtx.progFilled}/{slotCtx.progGenQuota}</span>
                    </div>
                  ) : slotCtx.levels.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>No levels configured</div>
                  ) : (
                    slotCtx.levels.map(l => {
                      const dot = l.d === 'easy' ? '#86efac' : l.d === 'medium' ? '#fcd34d' : '#fca5a5';
                      return (
                        <div key={l.d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, fontSize: 12 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'capitalize' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />{l.d}
                          </span>
                          <span style={{ fontWeight: 700, color: l.filled >= l.quota ? dot : '#fff' }}>{l.filled}/{l.quota}</span>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar — one row: Search (flex-grows on the left) · Difficulty ·
          Type · Section · (optional Combined MCQ/Programming Type when a
          specific section is picked) · filter-count chip. Section sits
          alongside the other filter selects and adopts the same neutral
          shape (border-hairline-strong bg-surface) — only lighting up
          brand-wash when a specific section is chosen, so the default
          "All sections" reads identical to "All types" instead of
          shouting for attention on the left. */}
      {(sections.length > 0 || (!loading && questions.length > 0)) && (
        <div className="flex-shrink-0 px-3 sm:px-4 md:px-6 pt-3 pb-2 flex items-center gap-2 flex-wrap min-w-0 bg-surface">
          {!loading && questions.length > 0 && (
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint pointer-events-none" />
              <input
                placeholder="Search questions…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 w-full pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {!loading && questions.length > 0 && (
            <>
              <select
                value={filterDifficulty}
                onChange={e => setFilterDifficulty(e.target.value as any)}
                className={`h-8 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150 ${filterDifficulty !== 'all' ? 'border-brand bg-brand-wash text-brand-strong' : ''}`}
                style={{ minWidth: 130 }}
              >
                <option value="all">All difficulty</option>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <select
                value={filterType}
                onChange={e => setFilterType(e.target.value as any)}
                className={`h-8 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150 ${filterType !== 'all' ? 'border-brand bg-brand-wash text-brand-strong' : ''}`}
                style={{ minWidth: 120 }}
              >
                <option value="all">All types</option>
                <option value="mcq">MCQ</option>
                <option value="programming">Programming</option>
                <option value="frontend">Frontend</option>
                <option value="database">Database</option>
              </select>
            </>
          )}

          {sections.length > 0 && (
            <>
              <select
                value={selectedSection || ''}
                onChange={e => setSelectedSection(e.target.value || null)}
                title="Section"
                className={`h-8 rounded-control border border-hairline-strong bg-surface px-2.5 text-xs font-medium text-body focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150 ${selectedSection ? 'border-brand bg-brand-wash text-brand-strong' : ''}`}
                style={{ minWidth: 120 }}
              >
                <option value="">All sections</option>
                {sections.map(section => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                    {section.exerciseType === 'Combined' ? ' · Combined' : ''}
                  </option>
                ))}
              </select>

              {isCurrentSectionCombined && selectedSection && (
                <select
                  value={selectedSubType || 'mcq'}
                  onChange={e => setSelectedSubType(e.target.value as 'mcq' | 'programming')}
                  title="Type"
                  className="h-8 rounded-control border border-brand bg-brand-wash text-brand-strong px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                  style={{ minWidth: 120 }}
                >
                  <option value="mcq">MCQ ({mcqCount})</option>
                  <option value="programming">Programming ({programmingCount})</option>
                </select>
              )}
            </>
          )}

          {!loading && questions.length > 0 && (searchQuery || filterDifficulty !== 'all' || filterType !== 'all' || selectedSection) && (
            <span className="ml-auto inline-flex items-center h-6 px-2 rounded-full border border-brand-500/30 bg-brand-wash text-2xs font-medium text-brand-strong tabular-nums">
              {sortedQuestions.length} / {questions.length}
            </span>
          )}
        </div>
      )}

      {/* Question Table + Pagination
          Split into two flex children of the parent flex-col so the pagination
          footer stays pinned at the bottom of the panel (flex-shrink-0) while
          the row list scrolls independently (flex-1 overflow-auto). Before this,
          the footer lived INSIDE the overflow-auto container and scrolled with
          the content, so on long lists the trainer had to scroll all the way
          down to reach it. Horizontal gutter matches the header / toolbar
          above so nothing steps out of the workspace's alignment. */}
      <div ref={tableBodyRef} className="flex-1 min-h-0 overflow-hidden px-3 sm:px-4 md:px-6">
        {loading ? (
          // Full-panel loading state — same shared <Loading /> the first-load
          // block above uses. Takes the whole content area so it reads as a
          // page-level "waiting for data" moment instead of a tiny custom
          // spinner. Add Question is separately gated on `loading` at the
          // header, so nothing is actionable here.
          <div className="flex flex-col items-center justify-center h-full min-h-[360px]" style={{ background: T.bg }}>
            <Loading label="Loading questions…" size="size-12" />
            <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>Fetching the exercise and its saved questions.</p>
          </div>
        ) : sortedQuestions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: T.blueLight }}>
              <List size={20} style={{ color: T.blue }} />
            </div>
            <p className="text-sm font-medium" style={{ color: T.textSub }}>
              {isCurrentSectionCombined && selectedSubType
                ? `No ${selectedSubType === 'mcq' ? 'MCQ' : 'Programming'} questions in this section`
                : 'No questions in this section'}
            </p>
            <p className="text-[11px] mt-1" style={{ color: T.textMuted }}>Click "Add Question" to create one</p>
          </div>
        ) : (
          // Flat list — no card chrome / rounded border, so the list
          // matches Assessment's flat panel. Rows are separated by the
          // hairline tokens the shared DataTable rhythm uses.
          <div className="bg-surface">
            {/* Table Header — h-8 bg-canvas, uppercase text-subtle labels,
                matching the DataTable / Assessment header rhythm. */}
            <div className="grid grid-cols-12 gap-3 h-8 items-center bg-canvas border-b border-hairline">
              {['#', 'Question', '', '', '', 'Type', '', 'Difficulty', '', 'Marks', 'Actions'].map((h, i) => (
                i === 0 ? <div key={i} className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">{h}</div> :
                i === 1 ? <div key={i} className="col-span-5 text-[10px] font-semibold uppercase tracking-wider text-subtle">{h}</div> :
                i === 5 ? <div key={i} className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">{h}</div> :
                i === 7 ? <div key={i} className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">{h}</div> :
                i === 9 ? <div key={i} className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-subtle text-center">{h}</div> :
                i === 10 ? <div key={i} className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-subtle text-center">{h}</div> :
                null
              ))}
            </div>

            {/* Rows — h-11 hairline-bounded, text-[12px] text-body, no
                font-bold. Hover uses bg-row-hover; no coloured left
                border since we're dropping the coloured accent for CM
                parity. */}
            {paginatedQuestions.map((q, i) => {
              // Preserve the global row number across pages so the # column
              // stays consistent when the trainer navigates page-by-page.
              const idx = pageStart + i;
              const isHovered = hoveredRow === q._id;
              const diff = getDifficulty(q);

              return (
                <div
                  key={q._id}
                  className={`grid grid-cols-12 gap-3 h-11 items-center px-0 transition-colors duration-150 ${i === paginatedQuestions.length - 1 ? '' : 'border-b border-hairline'} bg-surface hover:bg-row-hover`}
                  onMouseEnter={() => setHoveredRow(q._id)}
                  onMouseLeave={() => setHoveredRow(null)}>
                  <div className="col-span-1 flex items-center">
                    <span className="text-[12px] text-faint tabular-nums">{idx + 1}</span>
                  </div>
                  <div className="col-span-5 flex flex-col justify-center min-w-0">
                    <div className="flex items-center min-w-0">
                      <span className="text-[12px] text-body truncate" title={getQuestionTitle(q)}>{getQuestionTitle(q)}</span>
                      <SourceBadge source={(q as any).source} />
                      <ApprovalPill status={(q as any).approval?.status} />
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center"><TypeBadge type={q.questionType} /></div>
                  <div className="col-span-2 flex items-center"><DiffBadge level={diff} /></div>
                  <div className="col-span-1 flex items-center justify-center">
                    <span className="text-[12px] text-body tabular-nums">{getScore(q)}</span>
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const el = e.currentTarget as HTMLElement;
                        setOpenDrop(prev =>
                          prev?.id === q._id ? null : { id: q._id, el }
                        );
                      }}
                      className="p-1.5 rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                    >
                      <MoreVertical size={13} />
                    </button>
                    {openDrop?.id === q._id && (
                      <PortalDropMenu anchorEl={openDrop.el} onClose={() => setOpenDrop(null)}>
                        <button
                          onClick={() => { setPreviewQuestion(q); setOpenDrop(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[11px] hover:bg-gray-50 rounded-t-lg"
                          style={{ color: T.textSub }}>
                          <Eye size={11} /> Preview
                        </button>
                        <button
                          onClick={() => { handleEdit(q); setOpenDrop(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[11px] hover:bg-gray-50"
                          style={{ color: T.textSub }}>
                          <Edit2 size={11} /> Edit
                        </button>
                        <button
                          onClick={() => { handleDelete(q); setOpenDrop(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[11px] hover:bg-gray-50 rounded-b-lg"
                          style={{ color: T.red }}>
                          <Trash2 size={11} /> Delete
                        </button>
                      </PortalDropMenu>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination — the shared TableFooter Client Management, User
          Management, Service Mapping and Assessment use. Pinned at the
          bottom of the workspace as a flex-shrink-0 sibling of the
          scroll region above; the pager stays centred regardless of
          data. */}
      {!loading && sortedQuestions.length > 0 && (
        <div className="flex-shrink-0 border-t border-hairline bg-surface px-3 sm:px-4 md:px-6">
          <TableFooter
            from={sortedQuestions.length === 0 ? 0 : pageStart + 1}
            to={pageEnd}
            total={sortedQuestions.length}
            pageSize={pageSize}
            onPageSize={(n) => {
              setAutoFitPageSize(false);
              setPageSize(n);
              setCurrentPage(1);
            }}
            currentPage={safePage}
            totalPages={totalPages || 1}
            onPage={(p) => setCurrentPage(Math.min(Math.max(1, p), totalPages || 1))}
          />
        </div>
      )}

      {/* ── Section Picker ── */}
      {addQ.step === 'section' && addQ.exercise && (
        <SectionPickerModal
          exercise={addQ.exercise}
          onClose={closeAddQ}
          onPick={(sectionCfg, sectionMeta) => {
            const merged = { ...sectionCfg, ...sectionMeta };
            if ((sectionCfg.exerciseType || '').toLowerCase() === 'combined') {
              setAddQ(prev => ({ ...prev, step: 'type', section: merged }));
            } else {
              // Section picked → go to source chooser (not straight to the form),
              // so trainers still see AI/Bank/Doc options for the section.
              proceedFromSectionOrRoot(addQ.exercise!, merged);
            }
          }}
        />
      )}

      {/* ── Type Picker (Combined sections) ── */}
      {addQ.step === 'type' && addQ.section && (
        <TypePickerModal
          section={addQ.section}
          onClose={closeAddQ}
          onBack={() => setAddQ(prev => ({ ...prev, step: 'section', section: undefined, questionType: undefined }))}
          onPick={(type) => proceedFromSectionOrRoot(addQ.exercise!, addQ.section, type)}
        />
      )}

      {/* ── Source Chooser — Manual / Bank / AI / Doc, filtered by questionSource ── */}
      {/* Hidden while a sibling flow (Bank / AI / Doc) is on top — otherwise the */}
      {/* chooser card kept floating over the picker modal after the trainer clicked */}
      {/* through it. Coming back via the picker's Back returns step to 'source' */}
      {/* which remounts this. */}
      {addQ.step === 'source' && addQ.exercise && !showQBank && !showAIModal && !showDocUpload && (() => {
        const ex = addQ.exercise;
        const allowed = deriveAllowedSources(ex);
        const bankViaScratch = canBankViaScratch(ex);
        const effType: string = (addQ.section?.exerciseType || ex.exerciseType || '').toLowerCase();
        const isMCQ = effType === 'mcq' || addQ.questionType === 'MCQ';
        const isProg = effType === 'programming' || addQ.questionType === 'Programming'
                       || effType === 'frontend' || effType === 'database';
        // Doc upload is wired for MCQ here; programming .txt path deferred.
        const canDoc = allowed.upload && isMCQ;
        const showScratch = allowed.manual;
        const showBank = bankViaScratch && (isMCQ || isProg);
        const showAI = allowed.ai && (isMCQ || isProg);
        const showOther = allowed.thirdParty && (isMCQ || isProg);

        // ── Per-source quota-fullness (MCQ only, mirrors QuestionsView.tsx
        // srcQuotaFull / mcqSrcRemaining). MCQ questions carry a `source` tag
        // ('ai' / 'scratch-*' / 'thirdParty-*'); the exercise's customDistribution
        // splits the total quota into per-source slices. Once a slice is used up
        // its row goes disabled + shows "Quota full", exactly like the We_Do
        // dropdown does. Programming quota narrowing is deferred — programming
        // rows always allow click here for now.
        const exDataForQuota = buildAddQExerciseData();
        const mcqCfg: any = (exDataForQuota?.fullExerciseData as any)?.questionConfiguration?.mcqQuestionConfiguration || {};
        const scoringType: string = mcqCfg.scoringType || 'equalDistribution';
        const ctxQs: any[] = ((exDataForQuota?.fullExerciseData as any)?.questions || []);
        const existingMcqAll: any[] = ctxQs.filter((q: any) => (q.questionType || '').toLowerCase() === 'mcq');
        const srcMatch = (q: any, k: 'scratch' | 'ai' | 'thirdParty') => {
          const s = ((q as any).source ?? '').toString();
          return k === 'ai' ? s === 'ai' : k === 'thirdParty' ? s.startsWith('thirdParty') : s.startsWith('scratch');
        };
        // Section-based Custom mix stores its allocation per section. Two
        // scenarios matter for the source chooser:
        //  A) Legacy exercise saved BEFORE the per-section field existed on the
        //     server — `customDistributionBySection` is `undefined` on the doc.
        //     Fall back to the aggregate `customDistribution` so we don't
        //     silently block on data that predates the feature.
        //  B) Modern exercise WITH the field present but nothing set for THIS
        //     section — trainer skipped the allocation panel for this part.
        //     Block with the "allocate first" banner.
        const _bySectionMap: any = (ex && Object.prototype.hasOwnProperty.call(ex, 'customDistributionBySection'))
          ? (ex.customDistributionBySection || {})
          : null; // null = legacy exercise, field never existed
        const _sectionKey: string | null = addQ.section?.id || null;
        const _sectionDist: any = (_bySectionMap && _sectionKey) ? _bySectionMap[_sectionKey] : null;
        const _isSectionCustom = !!(addQ.section && ex.questionSource === 'custom'
          && Array.isArray(ex.customSources) && ex.customSources.length >= 2);
        // Modern flow: use the section entry; if missing, DON'T fall back to
        // aggregate (the trainer really needs to allocate for this section).
        // Legacy flow: no per-section field ever existed, so aggregate is the
        // only source of truth we have.
        const dist: any = ex.questionSource === 'custom'
          ? (_isSectionCustom
              ? (_bySectionMap === null ? ex.customDistribution : _sectionDist)
              : ex.customDistribution)
          : null;
        const distTotal = dist
          ? (['easy', 'medium', 'hard'] as const).reduce(
              (s, r) => s + (dist[r]?.scratch || 0) + (dist[r]?.ai || 0) + (dist[r]?.thirdParty || 0), 0)
          : 0;
        const allocFor = (k: 'scratch' | 'ai' | 'thirdParty') =>
          (dist?.easy?.[k] || 0) + (dist?.medium?.[k] || 0) + (dist?.hard?.[k] || 0);
        const overall = Math.max(0, (mcqCfg.totalMcqQuestions || 0) - existingMcqAll.length);
        // Only block when the exercise is modern (has the field) AND this
        // section wasn't allocated. Legacy exercises without the field flow
        // through the aggregate customDistribution instead.
        const _sectionNeedsAllocation = _isSectionCustom
          && _bySectionMap !== null
          && (!dist || distTotal <= 0);
        const remainingFor = (k: 'scratch' | 'ai' | 'thirdParty') => {
          if (_sectionNeedsAllocation) return 0;
          if (isMCQ) {
            if (scoringType !== 'equalDistribution' || (mcqCfg.totalMcqQuestions || 0) <= 0) return null;
            if (!dist || distTotal <= 0) return overall;
            const usedSrc = existingMcqAll.filter((q: any) => srcMatch(q, k)).length;
            return Math.min(overall, Math.max(0, allocFor(k) - usedSrc));
          }
          // ── Programming per-source slice (parity with MCQ narrowing) ──
          // Reads the same dist (section-scoped or aggregate) but against the
          // programming question pool, so filling AI to 1 easy actually locks
          // the AI row until a manual/bank is deleted.
          if (isProg) {
            const progCfg: any = (exDataForQuota?.fullExerciseData as any)?.questionConfiguration?.programmingQuestionConfiguration || {};
            const family = ['programming', 'frontend', 'database'];
            const existingProg: any[] = ctxQs.filter((q: any) => family.includes((q.questionType || '').toLowerCase()));
            const progCfgType = progCfg.questionConfigType || 'general';
            const perDiffQuota: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 0, hard: 0 };
            let progOverall = 0;
            if (progCfgType === 'general') {
              progOverall = Math.max(0, (progCfg.generalQuestionCount || 0) - existingProg.length);
            } else {
              (['easy', 'medium', 'hard'] as const).forEach(d => {
                const quotaD = progCfgType === 'selectionLevel'
                  ? (progCfg.selectionLevelCounts?.[d] || 0)
                  : (progCfg.levelBasedCounts?.[d] || 0);
                const usedD = existingProg.filter((x: any) =>
                  ((x?.difficulty || 'medium').toString().toLowerCase() === d)).length;
                perDiffQuota[d] = Math.max(0, quotaD - usedD);
                progOverall += perDiffQuota[d];
              });
            }
            if (progOverall <= 0 && progCfgType === 'general' && (progCfg.generalQuestionCount || 0) <= 0) return null;
            if (!dist || distTotal <= 0) return progOverall;
            if (progCfgType === 'general') {
              const usedSrc = existingProg.filter((q: any) => srcMatch(q, k)).length;
              return Math.min(progOverall, Math.max(0, allocFor(k) - usedSrc));
            }
            // level-based / selectionLevel: sum per-difficulty allocation slices
            // minus per-difficulty used-for-source counts, then clamp by open.
            let sum = 0;
            (['easy', 'medium', 'hard'] as const).forEach(d => {
              const usedSrcD = existingProg.filter((q: any) =>
                (q?.difficulty || 'medium').toString().toLowerCase() === d && srcMatch(q, k)).length;
              const perD = (dist?.[d]?.[k] || 0);
              sum += Math.min(perDiffQuota[d], Math.max(0, perD - usedSrcD));
            });
            return sum;
          }
          return null;
        };
        const remScratch = remainingFor('scratch');
        const remAI = remainingFor('ai');
        const remThird = remainingFor('thirdParty');
        const isFull = (r: number | null) => r !== null && r <= 0;
        // Row → its governing slice. Bank + Doc bill the Manual (scratch) slice.
        const rowFull = {
          manual: isFull(remScratch),
          bank: isFull(remScratch),
          ai: isFull(remAI),
          thirdParty: isFull(remThird),
          doc: isFull(remScratch),
        };

        type RowKey = 'manual' | 'bank' | 'ai' | 'thirdParty' | 'doc';
        // When the trainer hasn't allocated per-section counts yet, use a
        // different disabled-row message so they know to fix it upstream in
        // the Question Source step (not by deleting saved questions).
        const _needsAllocMsg = 'Allocate counts for this section in Question Source first';
        const _mkNote = (defaultMsg: string) => _sectionNeedsAllocation ? _needsAllocMsg : defaultMsg;
        // Per-difficulty breakdown text for a source — reads `dist` directly so
        // the row can say "1 Easy · 1 Medium remaining" instead of a bare "2".
        // Only meaningful under Custom distribution; falls back to the total
        // number otherwise. Used in the row's slot-label chip.
        const _breakdownFor = (k: 'scratch' | 'ai' | 'thirdParty'): string => {
          if (!dist || distTotal <= 0) return '';
          const parts: string[] = [];
          const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
          (['easy', 'medium', 'hard'] as const).forEach(d => {
            const n = dist?.[d]?.[k] || 0;
            if (n > 0) parts.push(`${n} ${cap(d)}`);
          });
          return parts.join(' · ');
        };
        // Slot-label chip text: "N remaining · Easy / Medium / Hard breakdown"
        // when >0, empty string when the row is not applicable to the current
        // exercise's quota model. Rendered as a chip next to the row title so
        // trainers see EXACTLY which slots each source is going to fill.
        const _slotLabel = (rem: number | null, k: 'scratch' | 'ai' | 'thirdParty'): string => {
          if (rem === null || rem <= 0) return '';
          const bd = _breakdownFor(k);
          return bd ? `${rem} left · ${bd}` : `${rem} left`;
        };
        const rows: Array<{ key: RowKey; title: string; sub: string; Icon: any; accent: string; iconBg: string; full: boolean; fullNote: string; slotLabel: string }> = [];
        if (showScratch) rows.push({ key: 'manual', title: 'Create Question From Scratch', sub: isProg ? 'Build a programming question from scratch' : 'Build from scratch with custom content', Icon: Plus, accent: '#F27757', iconBg: 'rgba(242,119,87,0.1)', full: rowFull.manual, fullNote: _mkNote('All Manual slots in the distribution are used'), slotLabel: _slotLabel(remScratch, 'scratch') });
        if (showBank) rows.push({ key: 'bank', title: 'Create Question From Question Bank', sub: 'Import from existing question repository', Icon: Database, accent: '#a855f7', iconBg: 'rgba(168,85,247,0.08)', full: rowFull.bank, fullNote: _mkNote('All Manual slots in the distribution are used'), slotLabel: _slotLabel(remScratch, 'scratch') });
        if (showOther) rows.push({ key: 'thirdParty', title: 'Import From Other Platform', sub: 'Pick platform-imported questions — counted against Other Platform quota', Icon: Database, accent: '#0d9488', iconBg: 'rgba(13,148,136,0.08)', full: rowFull.thirdParty, fullNote: _mkNote('All Other Platform slots in the distribution are used'), slotLabel: _slotLabel(remThird, 'thirdParty') });
        if (showAI) rows.push({ key: 'ai', title: 'Generate with AI', sub: 'Let AI draft questions from your topic', Icon: FlaskConical, accent: '#6366f1', iconBg: 'rgba(99,102,241,0.12)', full: rowFull.ai, fullNote: _mkNote('All AI slots in the distribution are used'), slotLabel: _slotLabel(remAI, 'ai') });
        if (canDoc) rows.push({ key: 'doc', title: 'Add Questions via Document', sub: 'Bulk import from JSON · CSV · TXT', Icon: FileText, accent: '#0891b2', iconBg: 'rgba(8,145,178,0.08)', full: rowFull.doc, fullNote: _mkNote('All Manual slots in the distribution are used'), slotLabel: _slotLabel(remScratch, 'scratch') });

        // Auto-skip when the chooser would be redundant: exactly one USABLE
        // option — jump straight into that option. Zero usable rows means EVERY
        // slice quota is exhausted; we DO NOT auto-skip in that case (that would
        // open a manual form with no room). Instead we render the chooser with
        // every row disabled + "Quota full" so the trainer clearly sees why
        // they can't add. StrictMode double-render safe via guardKey.
        const usableRows = rows.filter(r => !r.full);
        if (usableRows.length === 1) {
          const only = usableRows[0].key as RowKey;
          const guardKey = `${ex._id || ex.exerciseId || ''}-${addQ.section?.id || 'none'}-${addQ.questionType || 'none'}-${only}`;
          if (autoSkipAppliedRef.current !== guardKey) {
            autoSkipAppliedRef.current = guardKey;
            Promise.resolve().then(() => applySourceChoice(only));
          }
          return null;
        }
        // rows.length === 0 (source config allows nothing) also falls through to
        // render — user sees the "no matching source" state in the chooser body.

        return (
          <>
            <div className="fixed inset-0" style={{ zIndex: 100, background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(4px)' }} />
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
              <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
                style={{ fontFamily: "'Poppins', sans-serif", border: '1px solid #e4e4ed', pointerEvents: 'auto', boxShadow: '0 20px 60px rgba(26,26,46,0.18), 0 4px 16px rgba(242,119,87,0.08)' }}>
                <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: '1px solid #e4e4ed' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="mb-1.5 space-y-0.5">
                        <div className="text-[10px]" style={{ color: '#6b6b7e' }}>Topic: <span className="font-semibold" style={{ color: '#1a1a2e' }}>{nodeName || '—'}</span></div>
                        <div className="text-[10px]" style={{ color: '#6b6b7e' }}>Assessment: <span className="font-semibold" style={{ color: '#F27757' }}>{ex?.exerciseInformation?.exerciseName || '—'}</span></div>
                      </div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(242,119,87,0.1)' }}>
                          <Plus size={11} style={{ color: '#F27757' }} />
                        </div>
                        <h2 className="text-[13.5px] font-bold" style={{ color: '#1a1a2e' }}>Add Question</h2>
                      </div>
                      <p className="text-[10.5px]" style={{ color: '#8b8b9e' }}>
                        {isMCQ ? 'Add MCQ to this exercise' : isProg ? 'Add Programming question to this exercise' : 'Choose how to add questions'}
                      </p>
                    </div>
                    <button onClick={closeAddQ}
                      style={{ cursor: 'pointer', color: '#bcbccc', padding: 4, borderRadius: 8, lineHeight: 0, background: 'transparent', border: 'none' }}>
                      <X size={15} />
                    </button>
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  {/* Empty-state / all-full banners — surface the reason the */}
                  {/* trainer can't proceed instead of leaving them staring at */}
                  {/* an all-disabled row list wondering why. */}
                  {rows.length === 0 && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11.5px]" style={{ color: '#92400e' }}>
                      <p className="font-semibold mb-1">No matching add-question option for this exercise.</p>
                      <p className="text-[10.5px]">
                        The exercise's Question Source (in Settings) doesn't map to any button here. Change the Source in Exercise Settings.
                      </p>
                    </div>
                  )}
                  {rows.length > 0 && usableRows.length === 0 && _sectionNeedsAllocation && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11.5px] mb-1" style={{ color: '#92400e' }}>
                      <p className="font-semibold mb-1">Per-section allocation missing.</p>
                      <p className="text-[10.5px]">
                        This section uses Custom source but no counts are allocated to Manual / AI / Other Platform. Open the assessment's Question Source step and set this section's per-difficulty allocation before adding questions.
                      </p>
                    </div>
                  )}
                  {rows.length > 0 && usableRows.length === 0 && !_sectionNeedsAllocation && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11.5px] mb-1" style={{ color: '#92400e' }}>
                      <p className="font-semibold mb-1">All question slots are filled.</p>
                      <p className="text-[10.5px]">
                        Every source's quota is used up. Delete an existing question first, or increase the exercise's total in Settings.
                      </p>
                    </div>
                  )}
                  {/* Source-rule hint — surfaces the difficulty rules that
                      constrain AI + Other Platform so the trainer knows why
                      certain rows show only certain difficulties in their
                      slot label. Suppressed when no rows show remaining
                      counts (nothing to explain). */}
                  {rows.some(r => !r.full && r.slotLabel) && (dist && distTotal > 0) && (
                    <div className="mb-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-[10px]"
                      style={{ color: '#1e3a8a' }}>
                      <span className="font-semibold">Source rules:</span>{' '}
                      Other Platform fills <span className="font-semibold">Easy</span> slots · AI fills <span className="font-semibold">Medium</span> slots · Manual can fill any difficulty.
                    </div>
                  )}
                  {rows.map(r => {
                    const Icon = r.Icon;
                    // Quota-full rows stay visible (parity with We_Do) but go
                    // disabled + faded + carry a "Quota full" pill and the
                    // subtitle explains which slice is exhausted. Prevents the
                    // "why can't I click AI even though it's shown?" confusion.
                    return (
                      <button key={r.key}
                        onClick={() => { if (!r.full) applySourceChoice(r.key); }}
                        disabled={r.full}
                        title={r.full ? r.fullNote : ''}
                        className="group w-full text-left rounded-lg px-3 py-2 transition-all flex items-center gap-2.5"
                        style={{
                          border: '1px solid #e4e4ed',
                          cursor: r.full ? 'not-allowed' : 'pointer',
                          background: r.full ? '#fafafa' : '#fff',
                          opacity: r.full ? 0.6 : 1,
                        }}
                        onMouseEnter={e => { if (r.full) return; e.currentTarget.style.borderColor = r.accent; e.currentTarget.style.background = `${r.accent}08`; }}
                        onMouseLeave={e => { if (r.full) return; e.currentTarget.style.borderColor = '#e4e4ed'; e.currentTarget.style.background = '#fff'; }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: r.iconBg }}>
                          <Icon size={14} style={{ color: r.accent }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold flex items-center gap-1.5" style={{ color: '#1a1a2e' }}>
                            {r.title}
                            {r.full && (
                              <span className="inline-flex items-center shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                                style={{ color: '#d97706', background: '#fffbeb', border: '1px solid #fde68a', letterSpacing: '0.03em' }}>
                                Quota full
                              </span>
                            )}
                            {/* Slot label — shows the user exactly what this
                                source is going to fill ("2 left · 1 Easy · 1
                                Medium"), so choosing a source stops feeling
                                like guesswork. Hidden when the row is full
                                (the Quota-full pill already says why). */}
                            {!r.full && r.slotLabel && (
                              <span className="inline-flex items-center shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ color: r.accent, background: r.iconBg, border: `1px solid ${r.accent}33`, letterSpacing: '0.02em' }}>
                                {r.slotLabel}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] truncate" style={{ color: r.full ? '#d97706' : '#8b8b9e' }}>
                            {r.full ? r.fullNote : r.sub}
                          </div>
                        </div>
                        {!r.full && <ChevronRightIcon size={13} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all" style={{ color: r.accent }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Sibling flow: Question Bank picker ── */}
      {showQBank && addQ.exercise && (() => {
        const exData = buildAddQExerciseData();
        if (!exData) return null;
        const existingQs: any[] = (addQ.exercise?.questions) || [];

        // Filter the picker to the exercise's question flavor so trainers
        // don't scroll past irrelevant rows. Combined shows all types.
        const effType: string = (exData.exerciseType || '').toLowerCase();
        const filterByType: 'mcq' | 'programming' | 'frontend' | 'database' | 'all' =
          effType === 'mcq' ? 'mcq'
          : effType === 'programming' ? 'programming'
          : effType === 'frontend' ? 'frontend'
          : effType === 'database' ? 'database'
          : 'all';

        // Route to the correct backing collection. 'thirdParty' → the Global
        // Other Platform bank (Exercism + questions.txt imports); anything else
        // → the institution's own scratch bank. Same UI, different data source.
        const bankSource: 'bank' | 'otherPlatform' =
          addQ.sourceChoice === 'thirdParty' ? 'otherPlatform' : 'bank';

        // Selection quota — blocks over-selection at tick time and renders
        // full difficulties disabled with a "quota full" badge.
        const mcqCfg: any = (exData.fullExerciseData as any)?.questionConfiguration?.mcqQuestionConfiguration || {};
        const ctxQuestions: any[] = ((exData.fullExerciseData as any)?.questions || []);
        const existingMcqCount = ctxQuestions.filter((q: any) => (q.questionType || '').toLowerCase() === 'mcq' && q.isActive !== false).length;
        const selectionQuota = (() => {
          if (filterByType === 'mcq') {
            return ((mcqCfg.totalMcqQuestions || 0) > 0 && (mcqCfg.scoringType || 'equalDistribution') === 'equalDistribution')
              ? { mode: 'general' as const, remainingTotal: Math.max(0, (mcqCfg.totalMcqQuestions || 0) - existingMcqCount) }
              : undefined;
          }
          if (!['programming', 'frontend', 'database'].includes(filterByType)) return undefined;
          // Programming family — per-difficulty caps, narrowed to the slice
          // owned by the source that opened this picker. Previously deferred:
          // the picker was uncapped here, so a section with easy = {Manual 1,
          // Other Platform 1} let the trainer tick any difficulty, any count.
          // ctxQuestions is already section-narrowed by buildAddQExerciseData.
          const pc: any = (addQ.section as any)?.programmingConfig
            || (exData.fullExerciseData as any)?.questionConfiguration?.programmingQuestionConfiguration
            || null;
          if (!pc) return undefined;
          const fam = ['programming', 'frontend', 'database'];
          const existing = ctxQuestions.filter((q: any) => fam.includes((q.questionType || '').toLowerCase()) && q.isActive !== false);
          const diffOf = (q: any) => { const dd = (q?.difficulty || '').toString().toLowerCase(); return dd === 'easy' || dd === 'hard' ? dd : 'medium'; };
          const srcKey: 'scratch' | 'thirdParty' = addQ.sourceChoice === 'thirdParty' ? 'thirdParty' : 'scratch';
          const srcMatch = (q: any) => { const s = (q?.source ?? '').toString(); return srcKey === 'thirdParty' ? s.startsWith('thirdParty') : s.startsWith('scratch'); };
          // Per-section slice for section-based Custom exercises; aggregate
          // distribution for non-section Custom; no slice narrowing otherwise.
          const bySec: any = (exData.fullExerciseData as any)?.customDistributionBySection;
          const secId: any = (exData as any).currentSectionId || addQ.section?.id || null;
          const dist: any = (exData.fullExerciseData as any)?.questionSource === 'custom'
            ? ((bySec && secId && bySec[secId]) || (exData.fullExerciseData as any)?.customDistribution || null)
            : null;
          const distTotal = dist ? (['easy', 'medium', 'hard'] as const).reduce((s, r) =>
            s + (dist[r]?.scratch || 0) + (dist[r]?.ai || 0) + (dist[r]?.thirdParty || 0), 0) : 0;
          if ((pc.questionConfigType || 'general') === 'general') {
            const total = pc.generalQuestionCount || 0;
            if (total <= 0) return undefined;
            let remaining = Math.max(0, total - existing.length);
            if (dist && distTotal > 0) {
              const alloc = (['easy', 'medium', 'hard'] as const).reduce((s, r) => s + (dist[r]?.[srcKey] || 0), 0);
              remaining = Math.min(remaining, Math.max(0, alloc - existing.filter(srcMatch).length));
            }
            return { mode: 'general' as const, remainingTotal: remaining };
          }
          const counts: any = (pc.questionConfigType === 'selectionLevel' ? pc.selectionLevelCounts : pc.levelBasedCounts) || {};
          if (((counts.easy || 0) + (counts.medium || 0) + (counts.hard || 0)) <= 0) return undefined;
          const remFor = (dd: 'easy' | 'medium' | 'hard') => {
            let rem = Math.max(0, (counts[dd] || 0) - existing.filter((q: any) => diffOf(q) === dd).length);
            if (dist && distTotal > 0) {
              const usedSrcD = existing.filter((q: any) => diffOf(q) === dd && srcMatch(q)).length;
              rem = Math.min(rem, Math.max(0, (dist[dd]?.[srcKey] || 0) - usedSrcD));
            }
            return rem;
          };
          return {
            mode: 'difficulty' as const,
            remainingByDifficulty: { easy: remFor('easy'), medium: remFor('medium'), hard: remFor('hard') },
          };
        })();
        // When exactly one difficulty still has room, start the picker
        // focused on it — e.g. only Easy carries an Other Platform slot, so
        // the trainer lands straight on the Easy list.
        const openDiffs = (selectionQuota && (selectionQuota as any).mode === 'difficulty')
          ? (['easy', 'medium', 'hard'] as const).filter(dd => (selectionQuota as any).remainingByDifficulty[dd] > 0)
          : [];
        const initialDiffFilter = openDiffs.length === 1 ? openDiffs[0] : undefined;

        return (
          <QuestionBankSelector
            exerciseData={{
              exerciseId: exData.exerciseId,
              exerciseName: exData.exerciseName,
              exerciseLevel: exData.exerciseLevel || 'intermediate',
              nodeId: exData.nodeId, nodeName: exData.nodeName,
              subcategory: (exData as any).subcategory || (exData as any).subcategoryLabel || '',
              nodeType: exData.nodeType, fullExerciseData: exData.fullExerciseData,
              exerciseType: exData.exerciseType,
            }}
            tabType={tabType}
            filterByType={filterByType}
            bankSource={bankSource}
            selectionQuota={selectionQuota}
            initialDifficultyFilter={initialDiffFilter}
            onBack={() => {
              // Back is an explicit "change source" — allowed even when empty.
              qbHasContentRef.current = true;
              setShowQBank(false);
              setAddQ(prev => ({ ...prev, step: 'source' }));
            }}
            onClose={() => {
              // Other Platform slot cannot be silently bypassed — if the
              // trainer picked "Other Platform" as the source and hits X
              // without selecting anything, refuse to close, run the trap.
              if (addQ.sourceChoice === 'thirdParty' && !qbHasContentRef.current) {
                trapCloseAttempt('thirdParty');
                return;
              }
              setShowQBank(false);
              closeAddQ();
            }}
            onSelect={(qs) => {
              // Content has been picked — the trap flag flips so the natural
              // close-after-select path passes through cleanly.
              qbHasContentRef.current = (qs?.length || 0) > 0;
              // Hand the picked bank questions to the form for review-then-save.
              const src = addQ.sourceChoice === 'thirdParty' ? 'thirdParty' : 'scratch-bank';
              setBankPreload({ questions: qs || [], source: src });
              setShowQBank(false);
              setAddQ(prev => ({ ...prev, step: 'form' }));
            }}
            existingQuestionIds={existingQs.flatMap((q: any) => [q._id, q.bankQuestionId]).filter(Boolean)}
            existingQuestions={existingQs}
          />
        );
      })()}

      {/* ── Sibling flow: AI MCQ generator ── */}
      {showAIModal && addQ.exercise && (() => {
        const exData = buildAddQExerciseData();
        if (!exData) return null;
        // ── Quota gates (parity with QuestionsView.tsx onSave for GenerateMCQAI) ──
        // The AI modal reads these to cap the # of questions the trainer can tick
        // at generate-time. Without them the trainer could over-generate and blow
        // past the MCQ slot / marks budget the exercise was configured with.
        const mcqCfg: any = (exData.fullExerciseData as any)?.questionConfiguration?.mcqQuestionConfiguration || {};
        const scoringType: 'equalDistribution' | 'questionSpecific' =
          (mcqCfg.scoringType as any) || 'equalDistribution';
        // Existing-count MUST come from the section-narrowed question list
        // (fullExerciseData.questions), not the whole exercise — otherwise a
        // section configured for 2 MCQs whose sister section already has 3
        // would compute maxSelectableCount = totalSlots - 3 (wrong section).
        // buildAddQExerciseData already narrows to the current section for us.
        const ctxQuestions: any[] = ((exData.fullExerciseData as any)?.questions || []);
        const existingMcq = ctxQuestions.filter(
          (q: any) => (q.questionType || '').toLowerCase() === 'mcq'
        );
        const existingMcqCount = existingMcq.length;
        const existingMcqMarks = existingMcq.reduce(
          (s: number, q: any) => s + (q.mcqQuestionScore || 0), 0
        );
        const totalSlots = mcqCfg.totalMcqQuestions || 0;
        const marksPerQ = mcqCfg.marksPerQuestion || (
          totalSlots > 0 && mcqCfg.mcqTotalMarks ? Math.floor(mcqCfg.mcqTotalMarks / totalSlots) : 1
        );
        // ── AI-slice narrowing (Custom-mix) ────────────────────────────────
        // When the exercise's Question Source is 'custom', each source (scratch
        // / ai / thirdParty) owns a slice of the total quota via customDistribution.
        // A total quota of 5 with an AI slice of 2 means AI can only ADD 2, not 5.
        // Sum across easy/medium/hard buckets — MCQ configs put everything in the
        // 'medium' neutral bucket, so the sum equals medium.ai in practice; we
        // still iterate all three for safety. Parity with QuestionsView.tsx
        // sourceRemaining()'s bySrcMcq branch (lines 754-768).
        const srcDoc: any = (exData.fullExerciseData as any) || {};
        // Prefer the section-scoped allocation when we have one — same
        // fallback ladder as the source-chooser popup.
        const _bySection: any = srcDoc.customDistributionBySection || null;
        const _secKey: string | null = addQ.section?.id || null;
        const _secDist: any = (_bySection && _secKey) ? _bySection[_secKey] : null;
        const dist: any = srcDoc.questionSource === 'custom'
          ? (_secDist || srcDoc.customDistribution)
          : null;
        const distTotal = dist
          ? (['easy', 'medium', 'hard'] as const).reduce(
              (s, r) => s + (dist[r]?.scratch || 0) + (dist[r]?.ai || 0) + (dist[r]?.thirdParty || 0),
              0
            )
          : 0;
        const allocForAI = (dist?.easy?.ai || 0) + (dist?.medium?.ai || 0) + (dist?.hard?.ai || 0);
        // usedAI reads the per-question `source` tag we (and the CreateAssessmentModal)
        // stamp at save time — AI-provenance questions are tagged 'ai'.
        const usedAI = existingMcq.filter((q: any) => ((q.source ?? '').toString()) === 'ai').length;
        const overall = Math.max(0, totalSlots - existingMcqCount);
        const aiSliceRemaining = (dist && distTotal > 0)
          ? Math.min(overall, Math.max(0, allocForAI - usedAI))
          : overall;
        const maxSelectableCount = scoringType === 'questionSpecific'
          ? -1
          : aiSliceRemaining;
        const remainingMarks = scoringType === 'questionSpecific'
          ? Math.max(0, (mcqCfg.mcqTotalMarks || 0) - existingMcqMarks)
          : -1;

        // Preserve the full exercise doc under the AI modal's fullExerciseData
        // so it can read questionConfiguration etc.; buildAddQExerciseData's
        // section-narrowed shape would strip fields the modal needs.
        const rawFull = fullExerciseRef.current || addQ.exercise;

        return (
          <GenerateMCQAIQuestion
            breadcrumbs={[]}
            exerciseData={{
              exerciseId: exData.exerciseId,
              exerciseName: exData.exerciseName,
              exerciseLevel: exData.exerciseLevel,
              selectedLanguages: (exData as any).selectedLanguages || [],
              nodeId: exData.nodeId, nodeName: exData.nodeName,
              subcategory: (exData as any).subcategory || (exData as any).subcategoryLabel || '',
              nodeType: exData.nodeType,
              exerciseType: exData.exerciseType || 'MCQ',
              topic: exData.nodeName,
              fullExerciseData: { ...rawFull, questions: addQ.exercise?.questions || [] } as any,
            }}
            // The trigger button lives in our source-chooser row; hide the default
            // button and open the modal programmatically via externalOpen.
            buttonText={null as any}
            externalOpen={true}
            onExternalOpenHandled={() => { /* opened — no-op */ }}
            scoringType={scoringType}
            maxSelectableCount={maxSelectableCount}
            marksPerQuestion={marksPerQ}
            remainingMarks={remainingMarks}
            // IMPORTANT: the modal fires onClose right AFTER onSave (see
            // GenerateMCQAIQuestion.handleSave line 845). If this handler tore
            // down the whole Add flow, it would wipe the bankPreload we just
            // set and the form would never mount. Only dismiss the modal here;
            // the source-chooser reappears under it and the user can pick again
            // or X out of that to fully cancel. Parity with QuestionsView.tsx
            // which does `setShowGenerateAI(false)` only.
            //
            // Close-trap: an AI slot cannot be silently bypassed. If the
            // trainer picked "AI" and hits X without generating anything, we
            // refuse the close and run the trap (flash + ding + toast with
            // "Change source"). The natural onSave→onClose path flips the
            // flag first (see onSave below), so a real save closes cleanly.
            onClose={() => {
              if (addQ.sourceChoice === 'ai' && !aiHasContentRef.current) {
                trapCloseAttempt('ai');
                return;
              }
              setShowAIModal(false);
            }}
            onSave={(aiQuestions: any[]) => {
              // Content produced — flip the trap flag so the subsequent
              // onClose fired by the AI modal passes through unchallenged.
              aiHasContentRef.current = (aiQuestions?.length || 0) > 0;
              // The AI generator emits its own shape (title/options/trueFalseAnswer/type='multiple-choice').
              // MCQQuestionForm's seeding path expects the persisted MCQ shape
              // (mcqQuestionTitle / mcqQuestionOptions / mcqQuestionCorrectAnswers /
              // mcqQuestionType='multiple_choice'). Field-by-field remap here —
              // parity with QuestionsView.tsx (We_Do), which is the reference.
              const existing = addQ.exercise?.questions || [];
              const mapped = (aiQuestions || []).map((q: any, i: number) => {
                // true-false has no `options` array — synthesize the two picks
                // from `trueFalseAnswer` so the form doesn't render 0 options.
                let rawOptions: { text: string; isCorrect: boolean; id?: string }[] = [];
                if (q.type === 'true-false') {
                  rawOptions = [
                    { text: 'True', isCorrect: q.trueFalseAnswer === true },
                    { text: 'False', isCorrect: q.trueFalseAnswer === false },
                  ];
                } else if (Array.isArray(q.options)) {
                  rawOptions = q.options.map((o: any) => ({
                    text: String(o.text ?? ''), isCorrect: !!o.isCorrect, id: o.id,
                  }));
                }
                const mcqOpts = rawOptions.map((o, idx) => ({
                  text: o.text,
                  isCorrect: o.isCorrect,
                  imageUrl: null,
                  imageAlignment: '',
                  imageSizePercent: 0,
                  _id: o.id || `ai-opt-${i}-${idx}`,
                }));
                const correctAnswers = mcqOpts.filter(o => o.isCorrect).map(o => o.text);
                const mcqType =
                  q.type === 'multiple-select' ? 'multiple_select'
                  : q.type === 'true-false' ? 'true_false'
                  : q.type === 'dropdown' ? 'dropdown'
                  : 'multiple_choice';
                return {
                  _id: q.id || `ai-${i}-${existing.length + i + 1}`,
                  questionType: 'mcq',
                  // Provenance tag persisted with the question. Downstream quota
                  // accounting (Custom-mix AI slice) counts on this.
                  source: 'ai',
                  mcqQuestionTitle: String(q.title || ''),
                  mcqQuestionDescription: String(q.description || q.explanation || ''),
                  mcqQuestionType: mcqType,
                  mcqQuestionDifficulty: (q.difficulty as any) || 'medium',
                  mcqQuestionScore: Number(q.points) || marksPerQ || 1,
                  mcqQuestionTimeLimit: 2000,
                  mcqQuestionOptions: mcqOpts,
                  mcqQuestionCorrectAnswers: correctAnswers,
                  mcqQuestionOptionsPerRow: q.optionsPerRow || 1,
                  mcqQuestionRequired: false,
                  isActive: true,
                  sequence: existing.length + i + 1,
                };
              });

              setShowAIModal(false);
              if (mapped.length === 0) {
                toast('No questions selected.', { icon: 'ℹ️' });
                return;
              }
              setBankPreload({ questions: mapped, source: 'ai' });
              setAddQ(prev => ({ ...prev, step: 'form' }));
              toast.success(
                `${mapped.length} AI question${mapped.length > 1 ? 's' : ''} ready — review and save each into its slot.`
              );
            }}
          />
        );
      })()}

      {/* ── Sibling flow: Document upload (MCQ) ── */}
      {showDocUpload && addQ.exercise && (() => {
        const exData = buildAddQExerciseData();
        if (!exData) return null;
        return (
          <AddQuestionViaDocument
            exerciseData={{
              exerciseId: exData.exerciseId,
              exerciseName: exData.exerciseName || '',
              exerciseLevel: exData.exerciseLevel || 'intermediate',
              nodeId: exData.nodeId, nodeName: exData.nodeName,
              subcategory: (exData as any).subcategory || (exData as any).subcategoryLabel || '',
              nodeType: exData.nodeType,
              fullExerciseData: exData.fullExerciseData as any,
            }}
            tabType={tabType as any}
            onClose={async () => { setShowDocUpload(false); closeAddQ(); await fetchQuestions(); }}
            onInserted={async (_count: number) => { setShowDocUpload(false); closeAddQ(); await fetchQuestions(); }}
          />
        );
      })()}

      {/* ── Add / Edit Question Form ── */}
      {addQ.step === 'form' && (() => {
        const exData = buildAddQExerciseData();
        if (!exData) return null;
        // Map the trainer's chooser pick to the form's autoOpenSource prop so
        // Programming-AI opens the AI modal on mount instead of the blank editor.
        // Bank/thirdParty land here with initialBankQuestions preloaded and skip
        // the form's own difficulty-popup default.
        const autoOpen: 'manual' | 'ai' | 'bank' | 'thirdParty' | undefined =
          addQ.sourceChoice === 'ai' ? 'ai'
          : addQ.sourceChoice === 'bank' ? 'bank'
          : addQ.sourceChoice === 'thirdParty' ? 'thirdParty'
          : addQ.sourceChoice === 'manual' ? 'manual'
          : undefined;
        return (
          <AddQuestionForm
            key={`addq-${exData.exerciseId}-${addQ.section?.id || 'no-section'}-${addQ.questionType || ''}-${editingQuestion?._id || 'new'}-${bankPreload ? 'preload' : 'blank'}`}
            exerciseData={exData}
            tabType={tabType}
            sectionData={addQ.section}
            initialData={editingQuestion || undefined}
            isEditing={!!editingQuestion}
            onClose={async () => { closeAddQ(); await fetchQuestions(); }}
            onSave={async () => { await fetchQuestions(); }}
            showTypeSelector={(exData.exerciseType || '').toLowerCase() === 'combined'}
            shouldRefreshOnMount={true}
            // Guard bank/AI preload against the edit path — editingQuestion
            // means we came in via handleEdit, not the source chooser, and the
            // form should populate from initialData instead of seeding bank Qs.
            autoOpenSource={editingQuestion ? undefined : autoOpen}
            initialBankQuestions={editingQuestion ? undefined : bankPreload?.questions}
            initialBankSource={editingQuestion ? undefined : bankPreload?.source}
          />
        );
      })()}

      {/* Delete Modal */}
      {showDeleteModal && <DeleteConfirmModal />}

      {/* ── Preview modal (parity with QuestionsView.tsx Eye action) ── */}
      {/* Read-only view of a saved question — title, description, MCQ options with */}
      {/* correct answers highlighted, or Programming test cases. Skips the form's */}
      {/* edit UI so trainers can quickly verify content without a Save/Cancel cycle. */}
      {previewQuestion && (() => {
        const q = previewQuestion as any;
        const isMcq = (q.questionType || '').toLowerCase() === 'mcq';
        const title = getQuestionTitle(q);
        const desc = getQuestionDesc(q);
        const opts: any[] = isMcq ? (q.mcqQuestionOptions || []) : [];
        const correctSet = new Set((q.mcqQuestionCorrectAnswers || []).map((s: string) => s.toString()));
        const tcs: any[] = !isMcq ? (q.testCases || []) : [];
        const constraints: any[] = !isMcq ? (q.constraints || []) : [];
        const source = (q.source ?? '').toString();
        const diff = getDifficulty(q);
        return (
          <>
            <div className="fixed inset-0" style={{ zIndex: 100, background: 'rgba(15,15,30,0.55)', backdropFilter: 'blur(2px)' }} onClick={() => setPreviewQuestion(null)} />
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
              <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col overflow-hidden"
                style={{ maxWidth: 640, maxHeight: '85vh', pointerEvents: 'auto', fontFamily: "'Poppins', sans-serif", border: `1px solid ${T.border}` }}>
                <div className="flex-shrink-0 px-5 py-4 flex items-start justify-between gap-3" style={{ borderBottom: `1px solid ${T.border}`, background: T.pageBg }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <TypeBadge type={q.questionType} />
                      <DiffBadge level={diff} />
                      <SourceBadge source={source} />
                      <ApprovalPill status={q.approval?.status} />
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: T.blueLight, color: T.blue }}>
                        {getScore(q)} {getScore(q) === 1 ? 'mark' : 'marks'}
                      </span>
                    </div>
                    <h3 className="text-[14px] font-bold" style={{ color: T.textMain }}>{title || 'Untitled Question'}</h3>
                  </div>
                  <button onClick={() => setPreviewQuestion(null)}
                    className="p-1.5 rounded-lg" style={{ color: T.textMuted, background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <X size={15} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {desc && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: T.textMuted }}>Description</div>
                      <p className="text-[12px] whitespace-pre-wrap" style={{ color: T.textSub }}>{desc}</p>
                    </div>
                  )}
                  {isMcq && opts.length > 0 && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: T.textMuted }}>Options</div>
                      <div className="space-y-1.5">
                        {opts.map((o: any, i: number) => {
                          const text = String(o.text ?? '');
                          const isRight = correctSet.has(text) || o.isCorrect === true;
                          return (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg text-[12px]"
                              style={{ background: isRight ? 'rgba(16,185,129,0.08)' : T.pageBg, border: `1px solid ${isRight ? T.emerald + '40' : T.border}`, color: isRight ? '#059669' : T.textSub }}>
                              <span className="font-bold flex-shrink-0">{String.fromCharCode(65 + i)}.</span>
                              <span className="flex-1">{text || <em style={{ color: T.textHint }}>Empty option</em>}</span>
                              {isRight && <CheckCircle size={12} className="flex-shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {!isMcq && constraints.length > 0 && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: T.textMuted }}>Constraints</div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {constraints.map((c: any, i: number) => (
                          <li key={i} className="text-[12px]" style={{ color: T.textSub }}>{String(c)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!isMcq && tcs.length > 0 && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: T.textMuted }}>Test cases ({tcs.length})</div>
                      <div className="space-y-2">
                        {tcs.map((tc: any, i: number) => (
                          <div key={i} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${T.border}` }}>
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase flex items-center justify-between" style={{ background: T.pageBg, color: T.textMuted }}>
                              <span>Case {i + 1}</span>
                              {tc.isHidden && <span className="px-1.5 py-0.5 rounded-full" style={{ background: T.warm, color: T.blue }}>Hidden</span>}
                            </div>
                            <div className="px-3 py-2 space-y-1 text-[11px]">
                              <div><span className="font-bold" style={{ color: T.textMuted }}>Input:</span> <code style={{ color: T.textMain }}>{tc.input || '—'}</code></div>
                              <div><span className="font-bold" style={{ color: T.textMuted }}>Expected:</span> <code style={{ color: T.textMain }}>{tc.expectedOutput || '—'}</code></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: `1px solid ${T.border}`, background: T.pageBg }}>
                  <button onClick={() => { setPreviewQuestion(null); handleEdit(q); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
                    style={{ background: T.bg, color: T.textSub, border: `1px solid ${T.border}`, cursor: 'pointer' }}>
                    <Edit2 size={11} /> Edit
                  </button>
                  <button onClick={() => setPreviewQuestion(null)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white"
                    style={{ background: T.blue, cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Close-trap viewport flash ─────────────────────────────────────────
          Painted whenever `trapFlash` bumps (see `flashViewport`); a keyed
          div forces a fresh mount + a fresh CSS animation on each attempt,
          so mashing X keeps firing the flash. Pointer-events-none keeps the
          modal underneath fully interactive. */}
      {trapFlash > 0 && (
        <div
          key={trapFlash}
          aria-hidden
          className="qtest-trap-flash"
          style={{
            position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 2147483000,
            boxShadow: 'inset 0 0 0 4px rgba(239,68,68,0.75), inset 0 0 40px rgba(239,68,68,0.35)',
            animation: 'qtestTrapFlash 480ms ease-out forwards',
          }}
        />
      )}
      <style>{`
        @keyframes qtestTrapFlash {
          0%   { opacity: 0; }
          15%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default QuestionsTest;