// ────────────────────────────────────────────────────────────────────────────────
//  Unified "Generate with AI" modal for the programming-family question forms.
//  One component, three modes — `formType`:
//     "programming" → core programming questions (title, description, constraints,
//                     test cases, sample I/O, hints, time/memory limits)
//     "frontend"    → frontend questions (title, description, starter HTML/CSS/JS
//                     files, expected behaviour, hints)
//     "database"    → database/SQL questions (title, description, schema CREATE
//                     statements, seed data INSERT statements, expected query
//                     result, sample query)
//
//  UX patterned after `mcq/GenerateMCQAIQuestion.tsx`:
//   • Breadcrumb header
//   • Right-side settings sidebar (difficulty / count / per-type knobs)
//   • Default topic auto-built from the hierarchy breadcrumbs
//   • "Custom" checkbox → switch the topic field to an array of topics
//     (one question per topic) — lets the user pin specific sub-topics
//   • Per-question select / deselect with inline edit (title, description,
//     difficulty) and a "self-review" loop: Add More, Regen selected, Delete
//   • Footer "Add Selected" hands only the chosen questions back to the parent
// ────────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  X, Sparkles, Loader2, AlertCircle, CheckCircle, Edit2, RefreshCw,
  Plus, Trash2, Save, Wand2, Bot, SlidersHorizontal, Zap, ChevronDown,
  Code, Layout, Database as DatabaseIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { callGeminiJSON, GeminiError } from './geminiClient';

// ─── FONT / TOKEN INJECTION ────────────────────────────────────────────────
// Mirrors `mcq/GenerateMCQAIQuestion.tsx` — same :root tokens; safe to call
// multiple times via the guard. Namespaced classes (`pf-*`) so the two
// generators can coexist without style collisions.
const injectFonts = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    if (!document.querySelector('link[href*="Plus+Jakarta+Sans"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap';
      document.head.appendChild(link);
    }
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --pf-orange:       #F27757;
        --pf-orange-dark:  #e0623f;
        --pf-orange-glow:  rgba(242,119,87,0.22);
        --pf-orange-light: rgba(242,119,87,0.08);
        --pf-orange-50:    #FEF3EF;
        --pf-orange-100:   #FDDDD4;
        --pf-text-main:    #1a1a2e;
        --pf-text-sec:     #6b6b7e;
        --pf-text-muted:   #8b8b9e;
        --pf-text-hint:    #bcbccc;
        --pf-border:       #e4e4ed;
        --pf-border-hover: #d0d0de;
        --pf-bg-white:     #ffffff;
        --pf-bg-surface:   #f7f7fb;
        --pf-bg-surface2:  #f0f0f7;
        --pf-success:      #16a34a;
        --pf-success-bg:   #f0fdf4;
        --pf-success-bdr:  #bbf7d0;
        --pf-danger:       #e53e3e;
        --pf-danger-bg:    #fff5f5;
        --pf-danger-bdr:   #fed7d7;
        --pf-info:         #F97316;
        --pf-info-bg:      #FFF7ED;
        --pf-info-bdr:     #FED7AA;
        --pf-warning:      #d97706;
        --pf-warning-bg:   #fffbeb;
        --pf-warning-bdr:  #fde68a;
        --pf-violet:       #7c3aed;
        --pf-violet-bg:    #f5f3ff;
        --pf-violet-bdr:   #ddd6fe;
        --pf-radius-sm:    8px;
        --pf-radius-md:    10px;
        --pf-radius-lg:    14px;
        --pf-font:         'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;
        --pf-shadow-sm:    0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
        --pf-shadow-md:    0 4px 14px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
      }
      .pf-ai-root { font-family: var(--pf-font) !important; }
      .pf-sidebar-scroll::-webkit-scrollbar { width: 4px; }
      .pf-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
      .pf-sidebar-scroll::-webkit-scrollbar-thumb { background: var(--pf-border); border-radius: 4px; }
      .pf-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: var(--pf-border-hover); }
      .pf-breadcrumb-sep { color: var(--pf-orange); margin: 0 3px; font-weight: 700; font-size: 13px; }
      .pf-range { width: 100%; height: 4px; accent-color: var(--pf-orange); cursor: pointer; }
      .pf-modal-backdrop {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(26,26,46,0.45); backdrop-filter: blur(2px);
        display: flex; align-items: center; justify-content: center; padding: 16px;
      }
      .pf-toggle-track { position: relative; display: inline-block; width: 34px; height: 18px; flex-shrink: 0; }
      .pf-toggle-track input { opacity: 0; width: 0; height: 0; }
      .pf-toggle-slider {
        position: absolute; inset: 0; background: var(--pf-border-hover);
        border-radius: 18px; transition: background 0.2s; cursor: pointer;
      }
      .pf-toggle-slider::before {
        content: ''; position: absolute; width: 14px; height: 14px; border-radius: 50%;
        background: white; left: 2px; top: 2px; transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      }
      .pf-toggle-track input:checked + .pf-toggle-slider { background: var(--pf-orange); }
      .pf-toggle-track input:checked + .pf-toggle-slider::before { transform: translateX(16px); }
    `;
    document.head.appendChild(style);
  };
})();

// ─── TYPES ────────────────────────────────────────────────────────────────
export type ProgFamilyType = 'programming' | 'frontend' | 'database';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Breadcrumb { name: string; type: string; }

export interface GeneratedQuestion {
  /** Local id used for selection / edit / delete inside the modal. Stripped
   *  before handing the question off to the parent. */
  id?: string;
  selected?: boolean;
  isEditing?: boolean;

  /** Raw shape — each form's `handleBankSelectedQuestions` will map this to its
   *  own internal flow shape via the same mapper it uses for bank questions. */
  questionType: ProgFamilyType;
  title: string;
  description: string;
  difficulty: Difficulty;
  // programming / database
  constraints?: string[];
  testCases?: Array<{ input: string; expectedOutput: string; isSample?: boolean; isHidden?: boolean; points?: number; explanation?: string }>;
  sampleInput?: string;
  sampleOutput?: string;
  hints?: Array<{ hintText: string; pointsDeduction: number; isPublic: boolean; sequence: number }>;
  timeLimit?: number;
  memoryLimit?: number;
  // frontend
  files?: Array<{ filename: string; content: string; language: string; isEntryPoint?: boolean }>;
  // database
  schemaSql?: string;
  seedSql?: string;
  expectedQuery?: string;
  expectedResult?: string;
  databaseType?: string;
}

interface Props {
  formType: ProgFamilyType;
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (questions: GeneratedQuestion[]) => void;
  /** Restrict count if there's a quota — caller passes "remaining open slots". */
  maxCount?: number;
  /** Default difficulty (e.g. the difficulty the user is currently filling). */
  initialDifficulty?: Difficulty;
  /** Language hint for programming / "Available languages" for frontend / database vendor for database. */
  contextHint?: string;
  /** Hierarchy crumbs used to auto-build the default topic. */
  breadcrumbs?: Breadcrumb[];
  /** Exercise name appended to the breadcrumb chain. */
  exerciseName?: string;
  /**
   * Level-Based / Selection-Level mode: remaining slots per difficulty.
   * When present, the popup replaces the single-difficulty picker + count
   * slider with three per-difficulty sliders (Easy / Medium / Hard), each
   * capped at the respective value. The total is the sum of the three.
   * Omit for General mode (single-slider behavior).
   */
  perDifficultyQuotas?: { easy: number; medium: number; hard: number };
}

const TYPE_META: Record<ProgFamilyType, { title: string; subtitle: string; icon: React.ReactNode; pillIcon: React.ReactNode }> = {
  programming: { title: 'Generate Programming Question with AI', subtitle: 'Coding problem with constraints + test cases', icon: <Wand2 size={16} />, pillIcon: <Code size={11} /> },
  frontend:    { title: 'Generate Frontend Question with AI',    subtitle: 'HTML / CSS / JS task with starter files',     icon: <Wand2 size={16} />, pillIcon: <Layout size={11} /> },
  database:    { title: 'Generate Database Question with AI',    subtitle: 'SQL task with schema + seed + expected query', icon: <Wand2 size={16} />, pillIcon: <DatabaseIcon size={11} /> },
};

const DIFF_CFG = {
  easy:   { label: 'Easy',   color: 'var(--pf-success)', bg: 'var(--pf-success-bg)', border: 'var(--pf-success-bdr)' },
  medium: { label: 'Medium', color: 'var(--pf-warning)', bg: 'var(--pf-warning-bg)', border: 'var(--pf-warning-bdr)' },
  hard:   { label: 'Hard',   color: 'var(--pf-danger)',  bg: 'var(--pf-danger-bg)',  border: 'var(--pf-danger-bdr)'  },
};

interface GenerationSettings {
  numQuestions: number;
  difficulty: Difficulty;
  numTestCases: number;  // programming / database
  numHints: number;      // all
  includeExplanations: boolean;
}

// ─── BREADCRUMB ──────────────────────────────────────────────────────────
const AIBreadcrumb: React.FC<{ breadcrumbs: Breadcrumb[]; exerciseName?: string; title: string }> = ({
  breadcrumbs, exerciseName, title,
}) => (
  <nav style={{ fontFamily: 'var(--pf-font)' }}>
    <ol className="flex items-center flex-wrap gap-y-0.5" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex' }}>
      {breadcrumbs.map((crumb, idx) => (
        <React.Fragment key={idx}>
          <li>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pf-text-sec)', maxWidth: 100, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
              {crumb.name}
            </span>
          </li>
          <li><span className="pf-breadcrumb-sep">»</span></li>
        </React.Fragment>
      ))}
      {exerciseName && (
        <>
          <li>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--pf-text-main)', maxWidth: 120, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
              {exerciseName}
            </span>
          </li>
          <li><span className="pf-breadcrumb-sep">»</span></li>
        </>
      )}
      <li>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--pf-text-main)' }}>{title}</span>
      </li>
    </ol>
  </nav>
);

// ─── PROMPT BUILDER ──────────────────────────────────────────────────────
const buildPrompt = (
  formType: ProgFamilyType,
  topic: string,
  difficulty: Difficulty,
  count: number,
  settings: GenerationSettings,
  contextHint: string | undefined,
  mode: 'initial' | 'additional' | 'regenerate',
): string => {
  const safeCount = Math.max(1, Math.min(count, 10));
  const tcCount = Math.max(2, Math.min(settings.numTestCases, 50));
  const hintCount = Math.max(0, Math.min(settings.numHints, 10));
  const typeLabel = mode === 'additional' ? 'ADDITIONAL ' : mode === 'regenerate' ? 'NEW ' : '';
  const explNote = settings.includeExplanations
    ? 'Include a brief explanation field on each test case / hint where it fits.'
    : 'Keep explanation fields short or empty.';
  const base = `You are an expert programming-question author. Generate EXACTLY ${safeCount} ${typeLabel}UNIQUE ${difficulty} ${formType} question${safeCount === 1 ? '' : 's'} on the topic: "${topic}". ${explNote} Return ONLY a strict JSON array (no markdown, no commentary).`;

  if (formType === 'programming') {
    return `${base}
${contextHint ? `Target language(s): ${contextHint}.\n` : ''}Each item must match this exact shape:
{
  "title": "short imperative title (<=80 chars)",
  "description": "one or two paragraph problem statement; explain input/output format clearly",
  "difficulty": "${difficulty}",
  "constraints": ["bulletable constraint string", "another"],
  "sampleInput":  "stdin string for the sample test case",
  "sampleOutput": "stdout string for the sample test case",
  "testCases": [
    { "input": "stdin", "expectedOutput": "stdout", "isSample": true,  "isHidden": false, "points": 1, "explanation": "Sample" },
    { "input": "stdin", "expectedOutput": "stdout", "isSample": false, "isHidden": true,  "points": 2, "explanation": "Edge case" }
  ],
  "hints": [{ "hintText": "useful nudge", "pointsDeduction": 0, "isPublic": true, "sequence": 0 }],
  "timeLimit": 2000,
  "memoryLimit": 256
}
Use EXACTLY ${tcCount} test cases per question (at least 1 sample, at least 1 hidden). Use EXACTLY ${hintCount} hint${hintCount === 1 ? '' : 's'}. Keep inputs/outputs realistic and parseable.`;
  }

  if (formType === 'frontend') {
    return `${base}
Each item must match this exact shape:
{
  "title": "short imperative title (<=80 chars)",
  "description": "one or two paragraphs describing the visible / interactive behaviour the student must implement (DOM structure, styling, JS behaviour). Mention what is starter vs what the student must add.",
  "difficulty": "${difficulty}",
  "files": [
    { "filename": "index.html", "language": "html", "isEntryPoint": true,  "content": "<!DOCTYPE html><html>...starter HTML the student edits..." },
    { "filename": "styles.css", "language": "css",  "isEntryPoint": false, "content": "/* starter CSS, can be empty or scaffolded */" },
    { "filename": "script.js",  "language": "javascript", "isEntryPoint": false, "content": "// starter JS, mostly empty for the student" }
  ],
  "hints": [{ "hintText": "useful nudge", "pointsDeduction": 0, "isPublic": true, "sequence": 0 }]
}
Use EXACTLY ${hintCount} hint${hintCount === 1 ? '' : 's'}. The starter files must be minimal and runnable — students complete them.`;
  }

  // database
  return `${base}
${contextHint ? `Database engine: ${contextHint}.\n` : ''}Each item must match this exact shape:
{
  "title": "short imperative title (<=80 chars)",
  "description": "one or two paragraphs explaining what query the student must write and what columns / ordering are expected",
  "difficulty": "${difficulty}",
  "databaseType": "${contextHint || 'mysql'}",
  "schemaSql":  "CREATE TABLE ... statements (one or more)",
  "seedSql":    "INSERT INTO ... realistic seed rows for the schema",
  "expectedQuery":  "the canonical SQL query the student should write",
  "expectedResult": "stringified expected result rows (CSV or pipe-separated)",
  "testCases": [
    { "input": "", "expectedOutput": "stringified rows", "isSample": true,  "isHidden": false, "points": 1, "explanation": "Sample run" },
    { "input": "", "expectedOutput": "stringified rows", "isSample": false, "isHidden": true,  "points": 2, "explanation": "Hidden check" }
  ],
  "hints": [{ "hintText": "useful nudge", "pointsDeduction": 0, "isPublic": true, "sequence": 0 }]
}
Use EXACTLY ${tcCount} test cases per question. Use EXACTLY ${hintCount} hint${hintCount === 1 ? '' : 's'}.`;
};

// ─── NORMALIZE AI RESPONSE ───────────────────────────────────────────────
const normalizeOne = (q: any, formType: ProgFamilyType, fallbackDifficulty: Difficulty): GeneratedQuestion => ({
  id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
  selected: true,
  isEditing: false,
  questionType: formType,
  title: String(q?.title || '').slice(0, 200) || 'Untitled',
  description: String(q?.description || ''),
  difficulty: (['easy','medium','hard'].includes(String(q?.difficulty || '').toLowerCase())
    ? String(q.difficulty).toLowerCase() as Difficulty
    : fallbackDifficulty),
  constraints: Array.isArray(q?.constraints) ? q.constraints.map(String) : [],
  testCases: Array.isArray(q?.testCases) ? q.testCases.map((tc: any, i: number) => ({
    input: String(tc?.input || ''),
    expectedOutput: String(tc?.expectedOutput || ''),
    isSample: !!tc?.isSample,
    isHidden: !!tc?.isHidden,
    points: Number(tc?.points || 1),
    explanation: String(tc?.explanation || `Test case ${i + 1}`),
  })) : [],
  sampleInput: q?.sampleInput,
  sampleOutput: q?.sampleOutput,
  hints: Array.isArray(q?.hints) ? q.hints.map((h: any, i: number) => ({
    hintText: String(h?.hintText || h?.text || ''),
    pointsDeduction: Number(h?.pointsDeduction || 0),
    isPublic: h?.isPublic !== false,
    sequence: Number(h?.sequence ?? i),
  })) : [],
  timeLimit: q?.timeLimit || 2000,
  memoryLimit: q?.memoryLimit || 256,
  files: Array.isArray(q?.files) ? q.files.map((f: any) => ({
    filename: String(f?.filename || 'index.html'),
    content: String(f?.content || ''),
    language: String(f?.language || 'html').toLowerCase(),
    isEntryPoint: !!f?.isEntryPoint,
  })) : undefined,
  schemaSql: q?.schemaSql,
  seedSql: q?.seedSql,
  expectedQuery: q?.expectedQuery,
  expectedResult: q?.expectedResult,
  databaseType: q?.databaseType,
});

// ─── TEMPLATE FALLBACK ───────────────────────────────────────────────────
const createTemplate = (
  formType: ProgFamilyType,
  difficulty: Difficulty,
  index: number,
  topic: string,
): GeneratedQuestion => {
  const base: GeneratedQuestion = {
    id: `tpl-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
    selected: true,
    isEditing: false,
    questionType: formType,
    title: `${topic || 'Question'} - ${index}`,
    description: `Create a ${difficulty} level ${formType} question about ${topic || 'this topic'}.`,
    difficulty,
  };
  if (formType === 'programming') {
    return {
      ...base,
      constraints: ['1 <= n <= 10^5'],
      sampleInput: '5\n1 2 3 4 5',
      sampleOutput: '15',
      testCases: [
        { input: '5\n1 2 3 4 5', expectedOutput: '15', isSample: true, isHidden: false, points: 1, explanation: 'Sample' },
        { input: '3\n10 20 30', expectedOutput: '60', isSample: false, isHidden: true, points: 2, explanation: 'Hidden' },
      ],
      hints: [{ hintText: 'Think about iterating through the input once.', pointsDeduction: 0, isPublic: true, sequence: 0 }],
      timeLimit: 2000,
      memoryLimit: 256,
    };
  }
  if (formType === 'frontend') {
    return {
      ...base,
      files: [
        { filename: 'index.html', language: 'html', isEntryPoint: true, content: '<!DOCTYPE html>\n<html>\n  <head><link rel="stylesheet" href="styles.css"></head>\n  <body>\n    <!-- TODO -->\n    <script src="script.js"></script>\n  </body>\n</html>' },
        { filename: 'styles.css', language: 'css', isEntryPoint: false, content: '/* TODO */' },
        { filename: 'script.js',  language: 'javascript', isEntryPoint: false, content: '// TODO' },
      ],
      hints: [{ hintText: 'Start with the HTML structure first.', pointsDeduction: 0, isPublic: true, sequence: 0 }],
    };
  }
  return {
    ...base,
    databaseType: 'mysql',
    schemaSql: 'CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));',
    seedSql: "INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob');",
    expectedQuery: 'SELECT name FROM users ORDER BY id;',
    expectedResult: 'Alice|Bob',
    testCases: [
      { input: '', expectedOutput: 'Alice|Bob', isSample: true,  isHidden: false, points: 1, explanation: 'Sample run' },
    ],
    hints: [{ hintText: 'Remember to ORDER BY for deterministic results.', pointsDeduction: 0, isPublic: true, sequence: 0 }],
  };
};

// ─── COMPONENT ────────────────────────────────────────────────────────────
const GenerateProgFamilyAI: React.FC<Props> = ({
  formType, isOpen, onClose, onGenerated,
  maxCount, initialDifficulty = 'medium', contextHint,
  breadcrumbs = [], exerciseName, perDifficultyQuotas,
}) => {
  injectFonts();

  const meta = TYPE_META[formType];

  // ── State ──
  const [topicInput, setTopicInput] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customTopicsText, setCustomTopicsText] = useState(''); // newline / comma separated
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [editing, setEditing] = useState<GeneratedQuestion | null>(null);
  const [selectAll, setSelectAll] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [settings, setSettings] = useState<GenerationSettings>({
    numQuestions: 1,
    difficulty: initialDifficulty,
    numTestCases: 2,
    numHints: 1,
    includeExplanations: true,
  });

  // Per-difficulty counts — only used when perDifficultyQuotas is provided
  // (Level-Based / Selection-Level modes). Starts at 0 for each.
  // IMPORTANT: stay in level mode even when every quota is 0 — falling back to
  // the single-slider UI would let the teacher generate past a filled quota
  // (sliders disabled at 0 + the runs guard block that here).
  const isLevelMode = !!perDifficultyQuotas;
  const levelQuotaTotal = perDifficultyQuotas
    ? (perDifficultyQuotas.easy + perDifficultyQuotas.medium + perDifficultyQuotas.hard)
    : null;
  const [perDiffCounts, setPerDiffCounts] = useState<{ easy: number; medium: number; hard: number }>({ easy: 0, medium: 0, hard: 0 });
  const totalPerDiff = perDiffCounts.easy + perDiffCounts.medium + perDiffCounts.hard;
  // When the caller changes the quotas (e.g. after questions get added
  // elsewhere), clamp our chosen counts down.
  useEffect(() => {
    if (!perDifficultyQuotas) return;
    setPerDiffCounts(prev => ({
      easy: Math.min(prev.easy, perDifficultyQuotas.easy),
      medium: Math.min(prev.medium, perDifficultyQuotas.medium),
      hard: Math.min(prev.hard, perDifficultyQuotas.hard),
    }));
  }, [perDifficultyQuotas?.easy, perDifficultyQuotas?.medium, perDifficultyQuotas?.hard]);

  const abortRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // ── Helpers ──
  const effectiveMaxCount = maxCount && maxCount > 0 ? Math.min(maxCount, 5) : 5;

  const defaultTopicFromHierarchy = (): string => {
    const course = breadcrumbs.find(b => b.type === 'course')?.name || '';
    const module = breadcrumbs.find(b => b.type === 'module')?.name || '';
    const topic = breadcrumbs.find(b => b.type === 'topic' || b.type === 'subtopic')?.name || exerciseName || '';
    return [course, module, topic].filter(Boolean).join(' - ');
  };

  const parseCustomTopics = (): string[] =>
    customTopicsText
      .split(/[\n,]/)
      .map(s => s.trim())
      .filter(Boolean);

  // ── Reset / effects ──
  const resetToInitial = () => {
    setGeneratedQuestions([]);
    setEditing(null);
    setError(null);
    setSelectAll(true);
    setTopicInput(defaultTopicFromHierarchy());
    setSettings(prev => ({ ...prev, difficulty: initialDifficulty, numQuestions: 1 }));
    setCustomMode(false);
    setCustomTopicsText('');
  };

  useEffect(() => {
    if (isOpen) {
      resetToInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (settings.numQuestions > effectiveMaxCount) {
      setSettings(prev => ({ ...prev, numQuestions: effectiveMaxCount }));
    }
  }, [effectiveMaxCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Click outside → confirm-close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        if (!loading) handleCloseWithConfirm();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, loading, generatedQuestions.length, topicInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep selectAll in sync
  useEffect(() => {
    if (generatedQuestions.length === 0) return;
    setSelectAll(generatedQuestions.every(q => q.selected));
  }, [generatedQuestions]);

  if (!isOpen) return null;

  // ── Generation ──
  // `difficultyOverride` — when the caller runs a multi-difficulty batch
  // (Level-Based mode), pass the target difficulty for THIS call so prompt +
  // normalization tag questions correctly. Falls back to settings.difficulty.
  const callGenerate = async (
    topic: string,
    count: number,
    mode: 'initial' | 'additional' | 'regenerate',
    difficultyOverride?: Difficulty,
  ): Promise<GeneratedQuestion[]> => {
    const diff: Difficulty = difficultyOverride || settings.difficulty;
    const prompt = buildPrompt(formType, topic, diff, count, settings, contextHint, mode);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const data = await callGeminiJSON<any>({ prompt, signal: abortRef.current.signal, temperature: 0.8 });
    const arr: any[] = Array.isArray(data) ? data : (Array.isArray(data?.questions) ? data.questions : []);
    return arr.slice(0, count).map((q): GeneratedQuestion => normalizeOne(q, formType, diff));
  };

  const handleGenerate = async () => {
    setError(null);

    // Level-Based mode → multi-difficulty batch. Runs one API call per
    // difficulty with count > 0 and merges the results into a single review
    // list. Custom-topic mode falls through to the topic-driven branch below.
    if (isLevelMode && !customMode) {
      const runs = (['easy', 'medium', 'hard'] as const).filter(d => perDiffCounts[d] > 0);
      if (runs.length === 0) {
        toast('Set at least one difficulty count above 0.', { icon: 'ℹ️' });
        return;
      }
      const topic = topicInput.trim();
      if (!topic) {
        toast('Enter a topic first.', { icon: 'ℹ️' });
        return;
      }
      setLoading(true);
      setGeneratedQuestions([]);
      try {
        const batches = await Promise.all(
          runs.map(d => callGenerate(topic, perDiffCounts[d], 'initial', d).catch(() => [] as GeneratedQuestion[]))
        );
        const merged = batches.flat();
        if (merged.length === 0) {
          setError('The AI returned no questions. Try a more specific topic.');
          return;
        }
        // Fill any per-difficulty shortfalls with templates so the review list
        // matches the requested count exactly.
        const withFill: GeneratedQuestion[] = [];
        runs.forEach((d, i) => {
          const got = batches[i] || [];
          withFill.push(...got);
          const shortfall = perDiffCounts[d] - got.length;
          if (shortfall > 0) {
            for (let k = 0; k < shortfall; k++) {
              withFill.push(createTemplate(formType, d, withFill.length + 1, topic));
            }
          }
        });
        if (withFill.length !== totalPerDiff) {
          toast(`Filled ${withFill.length}/${totalPerDiff} — some difficulties fell back to templates.`, { icon: '⚠️', duration: 5000 });
        }
        setGeneratedQuestions(withFill.map(q => ({ ...q, selected: true })));
      } catch (e: any) {
        handleGenError(e);
      } finally {
        setLoading(false);
      }
      return;
    }

    // Custom mode → one question per topic in the array.
    if (customMode) {
      const topics = parseCustomTopics();
      if (topics.length === 0) {
        toast('Add at least one topic (one per line, or comma-separated).', { icon: 'ℹ️' });
        return;
      }
      // Level mode caps custom topics by the REAL remaining quota total —
      // effectiveMaxCount is the single-slider cap and lies in level mode.
      const customCap = levelQuotaTotal !== null ? levelQuotaTotal : effectiveMaxCount;
      if (customCap <= 0) {
        toast('No open AI slots remain for this exercise.', { icon: '⚠️', duration: 5000 });
        return;
      }
      if (topics.length > customCap) {
        toast(`Only ${customCap} slot${customCap === 1 ? '' : 's'} remaining. Trim your list.`, { icon: '⚠️', duration: 5000 });
        return;
      }
      setLoading(true);
      setGeneratedQuestions([]);
      try {
        // Ask Gemini for one question per topic in a single call — keeps it
        // cheap and lets the model see all topics at once for variety.
        const joined = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');
        let final = await callGenerate(`Generate ONE question for EACH of these distinct sub-topics (return them in order):\n${joined}`, topics.length, 'initial');
        if (final.length < topics.length) {
          toast(`Gemini returned ${final.length} of ${topics.length} requested — filling remainder with templates.`, { icon: '⚠️', duration: 5000 });
          final = [...final, ...topics.slice(final.length).map((t, i) => createTemplate(formType, settings.difficulty, final.length + i + 1, t))];
        }
        setGeneratedQuestions(final);
      } catch (e: any) {
        handleGenError(e);
        setGeneratedQuestions(topics.map((t, i) => createTemplate(formType, settings.difficulty, i + 1, t)));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Default / hierarchy-driven mode.
    const topic = topicInput.trim();
    if (!topic) {
      toast('Enter a topic first.', { icon: 'ℹ️' });
      return;
    }
    setLoading(true);
    setGeneratedQuestions([]);
    try {
      let final = await callGenerate(topic, settings.numQuestions, 'initial');
      if (final.length === 0) {
        setError('The AI returned no questions. Try a more specific topic.');
        return;
      }
      if (final.length < settings.numQuestions) {
        toast(`Asked Gemini for ${settings.numQuestions} but got ${final.length}. Filling the rest with templates.`, { icon: '⚠️', duration: 5000 });
        final = [...final, ...Array.from({ length: settings.numQuestions - final.length }, (_, i) => createTemplate(formType, settings.difficulty, final.length + i + 1, topic))];
      }
      setGeneratedQuestions(final);
    } catch (e: any) {
      handleGenError(e);
      setGeneratedQuestions(Array.from({ length: settings.numQuestions }, (_, i) => createTemplate(formType, settings.difficulty, i + 1, topic)));
    } finally {
      setLoading(false);
    }
  };

  const handleAddMore = async () => {
    setError(null);
    const remaining = effectiveMaxCount - generatedQuestions.length;
    if (remaining <= 0) {
      toast(`Already at the cap of ${effectiveMaxCount} questions.`, { icon: 'ℹ️' });
      return;
    }
    const askFor = Math.min(settings.numQuestions, remaining);
    const topic = customMode ? (parseCustomTopics().join(', ') || 'mixed') : topicInput.trim();
    if (!topic) {
      toast('Enter a topic first.', { icon: 'ℹ️' });
      return;
    }
    setLoading(true);
    try {
      let extra = await callGenerate(topic, askFor, 'additional');
      if (extra.length === 0) {
        extra = Array.from({ length: askFor }, (_, i) => createTemplate(formType, settings.difficulty, generatedQuestions.length + i + 1, topic));
      }
      setGeneratedQuestions(prev => [...prev, ...extra.map(q => ({ ...q, selected: false }))]);
    } catch (e: any) {
      handleGenError(e);
      setGeneratedQuestions(prev => [...prev, ...Array.from({ length: askFor }, (_, i) => ({ ...createTemplate(formType, settings.difficulty, prev.length + i + 1, topic), selected: false }))]);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSelected = async () => {
    setError(null);
    const selected = generatedQuestions.filter(q => q.selected);
    if (selected.length === 0) {
      toast('Select at least one question to regenerate.', { icon: 'ℹ️' });
      return;
    }
    const topic = customMode ? (parseCustomTopics().join(', ') || 'mixed') : topicInput.trim();
    if (!topic) {
      toast('Enter a topic first.', { icon: 'ℹ️' });
      return;
    }
    setLoading(true);
    try {
      let fresh = await callGenerate(topic, selected.length, 'regenerate');
      if (fresh.length === 0) {
        fresh = Array.from({ length: selected.length }, (_, i) => createTemplate(formType, settings.difficulty, i + 1, topic));
      }
      const selectedIds = new Set(selected.map(q => q.id));
      setGeneratedQuestions(prev => [...prev.filter(q => !selectedIds.has(q.id)), ...fresh.map(q => ({ ...q, selected: true }))]);
    } catch (e: any) {
      handleGenError(e);
    } finally {
      setLoading(false);
    }
  };

  const handleGenError = (e: any) => {
    if (e?.name === 'AbortError') return;
    const msg = e instanceof GeminiError
      ? `${e.message}${e.status ? ` (HTTP ${e.status})` : ''}`
      : (e?.message || 'AI generation failed.');
    setError(msg);
  };

  // ── Editing ──
  const startEditing = (q: GeneratedQuestion) => setEditing({ ...q, isEditing: true });
  const cancelEditing = () => setEditing(null);
  const saveEditing = () => {
    if (!editing) return;
    setGeneratedQuestions(prev => prev.map(q => q.id === editing.id ? { ...editing, isEditing: false } : q));
    setEditing(null);
  };
  const updateEditing = (field: keyof GeneratedQuestion, value: any) => {
    if (!editing) return;
    setEditing({ ...editing, [field]: value });
  };

  // ── Selection ──
  const toggleQuestionSelection = (id?: string) => {
    if (!id) return;
    setGeneratedQuestions(prev => prev.map(q => q.id === id ? { ...q, selected: !q.selected } : q));
  };

  const toggleSelectAll = () => {
    const next = !selectAll;
    setSelectAll(next);
    setGeneratedQuestions(prev => prev.map(q => ({ ...q, selected: next })));
  };

  const deleteQuestion = (id?: string) => {
    if (!id) return;
    setGeneratedQuestions(prev => prev.filter(q => q.id !== id));
  };

  const addCustomQuestion = () => {
    const topic = topicInput.trim() || (parseCustomTopics()[0] || 'Question');
    const tpl = createTemplate(formType, settings.difficulty, generatedQuestions.length + 1, topic);
    const q: GeneratedQuestion = { ...tpl, id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, selected: true, isEditing: true };
    setGeneratedQuestions(prev => [...prev, q]);
    setEditing(q);
  };

  // ── Save / close ──
  const handleSave = () => {
    const selected = generatedQuestions.filter(q => q.selected);
    if (selected.length === 0) {
      setError('Please select at least one question to add.');
      return;
    }
    // Level mode → enforce each difficulty's own quota on the final handoff.
    if (perDifficultyQuotas) {
      const selBy: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 0, hard: 0 };
      selected.forEach(q => { const d = (q.difficulty || 'medium') as 'easy' | 'medium' | 'hard'; selBy[d] += 1; });
      const over = (['easy', 'medium', 'hard'] as const).find(d => selBy[d] > (perDifficultyQuotas[d] || 0));
      if (over) {
        const cap = perDifficultyQuotas[over] || 0;
        setError(`Only ${cap} ${over} slot${cap === 1 ? '' : 's'} remaining — deselect ${selBy[over] - cap} ${over} question${selBy[over] - cap === 1 ? '' : 's'}.`);
        return;
      }
    } else if (selected.length > effectiveMaxCount) {
      setError(`Only ${effectiveMaxCount} slot${effectiveMaxCount === 1 ? '' : 's'} remaining. Please deselect ${selected.length - effectiveMaxCount}.`);
      return;
    }
    // Strip modal-local fields before handoff.
    const cleaned = selected.map(({ id, selected: _s, isEditing: _e, ...rest }) => rest as GeneratedQuestion);
    onGenerated(cleaned);
    onClose();
  };

  const handleCloseWithConfirm = () => {
    if (generatedQuestions.length > 0 || topicInput || customTopicsText) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  // ── Derived ──
  const selectedCount = generatedQuestions.filter(q => q.selected).length;
  const overLimit = selectedCount > effectiveMaxCount;

  // ── Styles ──
  const inputStyle: React.CSSProperties = {
    fontFamily: 'var(--pf-font)', fontSize: 12, border: '1.5px solid var(--pf-border)',
    borderRadius: 'var(--pf-radius-sm)', padding: '6px 10px', outline: 'none',
    background: 'var(--pf-bg-white)', color: 'var(--pf-text-main)', width: '100%',
    transition: 'border-color 0.15s',
  };
  const textareaStyle: React.CSSProperties = { ...inputStyle, resize: 'none', lineHeight: 1.55 };

  // ── Question preview ──
  const renderQuestionPreview = (question: GeneratedQuestion) => {
    const diff = DIFF_CFG[question.difficulty];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--pf-font)', fontSize: 12.5, fontWeight: 600, color: 'var(--pf-text-main)', flex: 1, lineHeight: 1.5 }}>
            {question.title}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={{ fontFamily: 'var(--pf-font)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--pf-violet-bg)', color: 'var(--pf-violet)', border: '1px solid var(--pf-violet-bdr)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {meta.pillIcon} {formType}
            </span>
            <span style={{ fontFamily: 'var(--pf-font)', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: diff.bg, color: diff.color, border: `1px solid ${diff.border}` }}>
              {diff.label}
            </span>
          </div>
        </div>

        <p style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, color: 'var(--pf-text-sec)', lineHeight: 1.55, maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
          {question.description}
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {formType === 'programming' && (
            <>
              {question.constraints && question.constraints.length > 0 && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--pf-info-bg)', color: 'var(--pf-info)' }}>
                  {question.constraints.length} constraint{question.constraints.length === 1 ? '' : 's'}
                </span>
              )}
              {question.testCases && question.testCases.length > 0 && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--pf-success-bg)', color: 'var(--pf-success)' }}>
                  {question.testCases.length} test case{question.testCases.length === 1 ? '' : 's'}
                </span>
              )}
              {question.hints && question.hints.length > 0 && (
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--pf-orange-50)', color: 'var(--pf-orange)' }}>
                  {question.hints.length} hint{question.hints.length === 1 ? '' : 's'}
                </span>
              )}
            </>
          )}
          {formType === 'frontend' && question.files && question.files.length > 0 && (
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--pf-success-bg)', color: 'var(--pf-success)' }}>
              {question.files.length} file{question.files.length === 1 ? '' : 's'}: {question.files.map(f => f.filename).join(', ')}
            </span>
          )}
          {formType === 'database' && (
            <>
              {question.schemaSql && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--pf-info-bg)', color: 'var(--pf-info)' }}>schema</span>}
              {question.seedSql && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--pf-success-bg)', color: 'var(--pf-success)' }}>seed</span>}
              {question.expectedQuery && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--pf-violet-bg)', color: 'var(--pf-violet)' }}>expected query</span>}
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Question editor (lightweight — deep editing happens in the form) ──
  const renderQuestionEditor = (question: GeneratedQuestion) => {
    const isEditing = editing?.id === question.id;
    if (!isEditing || !editing) return renderQuestionPreview(question);
    const eq = editing;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, background: 'var(--pf-violet-bg)', borderRadius: 'var(--pf-radius-md)', border: '1.5px solid var(--pf-violet-bdr)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--pf-violet)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Edit2 size={12} /> Editing
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveEditing} style={{ padding: '4px 12px', background: 'var(--pf-violet)', color: 'white', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--pf-font)' }}>Save</button>
            <button onClick={cancelEditing} style={{ padding: '4px 12px', background: 'var(--pf-bg-white)', color: 'var(--pf-text-sec)', fontSize: 11, fontWeight: 600, border: '1.5px solid var(--pf-border)', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--pf-font)' }}>Cancel</button>
          </div>
        </div>

        <input type="text" value={eq.title} onChange={e => updateEditing('title', e.target.value)} placeholder="Question title…" style={inputStyle} />
        <textarea value={eq.description} onChange={e => updateEditing('description', e.target.value)} rows={3} placeholder="Description / problem statement…" style={textareaStyle} />

        <div>
          <label style={{ fontFamily: 'var(--pf-font)', fontSize: 10, fontWeight: 700, color: 'var(--pf-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>Difficulty</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {(['easy','medium','hard'] as const).map(d => {
              const cfg = DIFF_CFG[d];
              const active = eq.difficulty === d;
              return (
                <button key={d} onClick={() => updateEditing('difficulty', d)}
                  style={{ padding: '6px 0', borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: 'capitalize', border: `1.5px solid ${active ? cfg.border : 'var(--pf-border)'}`, background: active ? cfg.bg : 'var(--pf-bg-white)', color: active ? cfg.color : 'var(--pf-text-muted)', cursor: 'pointer', fontFamily: 'var(--pf-font)' }}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {formType === 'programming' && (
          <div>
            <label style={{ fontFamily: 'var(--pf-font)', fontSize: 10, fontWeight: 700, color: 'var(--pf-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>Constraints (one per line)</label>
            <textarea
              value={(eq.constraints || []).join('\n')}
              onChange={e => updateEditing('constraints', e.target.value.split('\n').map(s => s).filter(s => s.length > 0 || s === ''))}
              rows={3} placeholder="1 <= n <= 10^5" style={textareaStyle}
            />
          </div>
        )}

        {formType === 'database' && (
          <>
            <div>
              <label style={{ fontFamily: 'var(--pf-font)', fontSize: 10, fontWeight: 700, color: 'var(--pf-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>Schema SQL</label>
              <textarea value={eq.schemaSql || ''} onChange={e => updateEditing('schemaSql', e.target.value)} rows={3} style={{ ...textareaStyle, fontFamily: 'ui-monospace, monospace', fontSize: 11 }} />
            </div>
            <div>
              <label style={{ fontFamily: 'var(--pf-font)', fontSize: 10, fontWeight: 700, color: 'var(--pf-text-hint)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 4 }}>Expected Query</label>
              <textarea value={eq.expectedQuery || ''} onChange={e => updateEditing('expectedQuery', e.target.value)} rows={2} style={{ ...textareaStyle, fontFamily: 'ui-monospace, monospace', fontSize: 11 }} />
            </div>
          </>
        )}

        <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-text-muted)' }}>
          Deeper edits (test cases, files, hints) happen in the question form after you click "Add Selected".
        </p>
      </div>
    );
  };

  // ── Settings sidebar ──
  const renderSettingsSidebar = () => (
    <div className="pf-sidebar-scroll"
      style={{ flexShrink: 0, overflowY: 'auto', borderLeft: '1.5px solid var(--pf-border)', background: 'var(--pf-bg-white)', transition: 'width 0.2s', width: showRightSidebar ? 256 : 0, overflow: showRightSidebar ? 'auto' : 'hidden' }}>
      {showRightSidebar && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--pf-font)', fontSize: 10, fontWeight: 700, color: 'var(--pf-text-hint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Settings</span>
            <button onClick={() => setShowRightSidebar(false)} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--pf-text-muted)' }}>
              <X size={14} />
            </button>
          </div>

          {/* Question Type pill (read-only — set by formType) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--pf-text-main)' }}>Question Type</label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 'var(--pf-radius-md)', border: '1.5px solid var(--pf-border)', background: 'var(--pf-bg-surface)' }}>
              <span style={{ color: 'var(--pf-orange)' }}>{meta.pillIcon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pf-text-main)', textTransform: 'capitalize' }}>{formType}</span>
            </div>
            {contextHint && (
              <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-text-muted)' }}>
                Context: <strong>{contextHint}</strong>
              </p>
            )}
          </div>

          {/* Level-Based mode: three per-difficulty sliders (E/M/H), each capped
              at the caller's per-difficulty remaining quota. Replaces the single
              Questions-to-Generate + Difficulty picker below. */}
          {isLevelMode ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--pf-text-main)' }}>How Many per Difficulty</label>
                <span style={{ fontFamily: 'var(--pf-font)', fontSize: 11, fontWeight: 700, color: 'var(--pf-orange)', background: 'var(--pf-orange-50)', padding: '2px 8px', borderRadius: 8 }}>Total: {totalPerDiff}</span>
              </div>
              {/* Only difficulties the exercise actually configured. A level
                  with no quota isn't "temporarily unavailable" — it is not
                  part of this exercise at all, so a disabled slider just adds
                  noise and invites the teacher to wonder what unlocks it. */}
              {(['easy', 'medium', 'hard'] as const)
                .filter(d => (perDifficultyQuotas![d] || 0) > 0)
                .map(d => {
                const cfg = DIFF_CFG[d];
                const cap = perDifficultyQuotas![d] || 0;
                const val = perDiffCounts[d];
                // cap > 0 is guaranteed by the filter, so only custom mode
                // (counts come from the topic list) can disable a slider now.
                const disabled = customMode;
                return (
                  <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'var(--pf-font)', fontSize: 11, fontWeight: 700, color: cfg.color, textTransform: 'capitalize' }}>{d}</span>
                      <span style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '2px 8px', borderRadius: 8 }}>
                        {val} / {cap}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, cap)}
                      value={Math.min(val, cap)}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 0;
                        setPerDiffCounts(prev => ({ ...prev, [d]: Math.max(0, Math.min(v, cap)) }));
                      }}
                      disabled={disabled}
                      className="pf-range"
                    />
                  </div>
                );
              })}
              {(levelQuotaTotal ?? 0) === 0 && (
                <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-text-muted)' }}>
                  Every difficulty in this exercise is already filled — there are no AI slots left to generate into.
                </p>
              )}
              {(levelQuotaTotal ?? 0) > 0 && (
                <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-text-muted)' }}>
                  Slots remaining per difficulty. Drag each slider up to its cap; you can generate any mix in one shot.
                </p>
              )}
              {customMode && (
                <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-info)', fontWeight: 600 }}>
                  Sliders disabled — count comes from your custom topic list.
                </p>
              )}
            </>
          ) : (
          <>
          {/* Questions to Generate — General mode */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--pf-text-main)' }}>Questions to Generate</label>
              <span style={{ fontFamily: 'var(--pf-font)', fontSize: 11, fontWeight: 700, color: 'var(--pf-orange)', background: 'var(--pf-orange-50)', padding: '2px 8px', borderRadius: 8 }}>{settings.numQuestions}</span>
            </div>
            <input type="range" min="1" max={effectiveMaxCount} value={Math.min(settings.numQuestions, effectiveMaxCount)}
              onChange={e => setSettings(prev => ({ ...prev, numQuestions: parseInt(e.target.value) }))}
              className="pf-range"
              disabled={customMode}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--pf-font)', fontSize: 9.5, color: 'var(--pf-text-hint)' }}>
              <span>1</span>
              {effectiveMaxCount >= 3 && <span>{Math.ceil(effectiveMaxCount / 2)}</span>}
              <span>{effectiveMaxCount}</span>
            </div>
            {customMode ? (
              <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-info)', fontWeight: 600 }}>
                Count is driven by your custom topic list.
              </p>
            ) : (
              <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-text-muted)' }}>
                {maxCount && maxCount > 0 ? `${maxCount} slot${maxCount !== 1 ? 's' : ''} remaining` : 'No quota'} — select what fits when adding.
              </p>
            )}
          </div>

          {/* Difficulty — General mode only (Level mode has 3 sliders above) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--pf-text-main)' }}>Difficulty</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
              {(['easy','medium','hard'] as const).map(d => {
                const cfg = DIFF_CFG[d];
                const active = settings.difficulty === d;
                return (
                  <button key={d} onClick={() => setSettings(prev => ({ ...prev, difficulty: d }))}
                    style={{ padding: '6px 0', borderRadius: 8, fontSize: 10.5, fontWeight: 700, textTransform: 'capitalize', border: `1.5px solid ${active ? cfg.border : 'var(--pf-border)'}`, background: active ? cfg.bg : 'var(--pf-bg-surface)', color: active ? cfg.color : 'var(--pf-text-muted)', cursor: 'pointer', fontFamily: 'var(--pf-font)' }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          </>
          )}

          {/* Number of test cases — programming / database */}
          {(formType === 'programming' || formType === 'database') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--pf-text-main)' }}>Test Cases</label>
                <span style={{ fontFamily: 'var(--pf-font)', fontSize: 11, fontWeight: 700, color: 'var(--pf-orange)', background: 'var(--pf-orange-50)', padding: '2px 8px', borderRadius: 8 }}>{settings.numTestCases}</span>
              </div>
              <input type="range" min="2" max="50" value={settings.numTestCases}
                onChange={e => setSettings(prev => ({ ...prev, numTestCases: parseInt(e.target.value) }))} className="pf-range" />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--pf-font)', fontSize: 9.5, color: 'var(--pf-text-hint)' }}>
                <span>2</span><span>25</span><span>50</span>
              </div>
            </div>
          )}

          {/* Number of hints */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--pf-text-main)' }}>Hints</label>
              <span style={{ fontFamily: 'var(--pf-font)', fontSize: 11, fontWeight: 700, color: 'var(--pf-orange)', background: 'var(--pf-orange-50)', padding: '2px 8px', borderRadius: 8 }}>{settings.numHints}</span>
            </div>
            <input type="range" min="0" max="10" value={settings.numHints}
              onChange={e => setSettings(prev => ({ ...prev, numHints: parseInt(e.target.value) }))} className="pf-range" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--pf-font)', fontSize: 9.5, color: 'var(--pf-text-hint)' }}>
              <span>0</span><span>5</span><span>10</span>
            </div>
          </div>

          {/* Explanations toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
            <div>
              <p style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, fontWeight: 700, color: 'var(--pf-text-main)' }}>Explanations</p>
              <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-text-muted)' }}>Add test-case explanations</p>
            </div>
            <label className="pf-toggle-track">
              <input type="checkbox" checked={settings.includeExplanations} onChange={() => setSettings(prev => ({ ...prev, includeExplanations: !prev.includeExplanations }))} />
              <span className="pf-toggle-slider" />
            </label>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render ──
  return (
    <div className="pf-ai-root">
      <div className="pf-modal-backdrop">
        <div ref={modalRef}
          style={{
            background: 'var(--pf-bg-white)', borderRadius: 'var(--pf-radius-lg)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)', width: '100%', maxWidth: 960,
            border: '1.5px solid var(--pf-border)', maxHeight: '92vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column', position: 'relative',
          }}>
          {/* HEADER */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'var(--pf-bg-white)', borderBottom: '1.5px solid var(--pf-border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--pf-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px var(--pf-orange-glow)' }}>
                <Sparkles size={16} style={{ color: 'white' }} />
              </div>
              <div style={{ width: 1, height: 20, background: 'var(--pf-border)', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <AIBreadcrumb breadcrumbs={breadcrumbs} exerciseName={exerciseName} title={meta.title} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 12 }}>
              <button onClick={resetToInitial} title="Reset"
                style={{ padding: 8, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--pf-text-muted)' }}>
                <RefreshCw size={14} />
              </button>
              <button onClick={() => setShowRightSidebar(!showRightSidebar)} title="Toggle settings"
                style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', background: showRightSidebar ? 'var(--pf-orange-50)' : 'none', color: showRightSidebar ? 'var(--pf-orange)' : 'var(--pf-text-muted)' }}>
                <SlidersHorizontal size={14} />
              </button>
              <button onClick={handleCloseWithConfirm} disabled={loading}
                style={{ padding: 8, borderRadius: 8, border: 'none', background: 'none', cursor: loading ? 'not-allowed' : 'pointer', color: 'var(--pf-text-muted)', opacity: loading ? 0.5 : 1 }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* CANCEL CONFIRM OVERLAY */}
          {showCancelConfirm && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 110, background: 'rgba(26,26,46,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--pf-radius-lg)' }}>
              <div style={{ background: 'var(--pf-bg-white)', borderRadius: 'var(--pf-radius-lg)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 20, maxWidth: 360, margin: 16, border: '1.5px solid var(--pf-border)' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--pf-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AlertCircle size={16} style={{ color: 'var(--pf-warning)' }} />
                  </div>
                  <div>
                    <h4 style={{ fontFamily: 'var(--pf-font)', fontSize: 14, fontWeight: 700, color: 'var(--pf-text-main)', marginBottom: 4 }}>Discard changes?</h4>
                    <p style={{ fontFamily: 'var(--pf-font)', fontSize: 12, color: 'var(--pf-text-sec)', marginBottom: 14, lineHeight: 1.6 }}>
                      {generatedQuestions.length > 0
                        ? `You have ${generatedQuestions.length} generated question${generatedQuestions.length !== 1 ? 's' : ''} that will be lost.`
                        : 'Your unsaved changes will be lost.'}
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setShowCancelConfirm(false)} style={{ flex: 1, padding: '7px 0', border: '1.5px solid var(--pf-border)', background: 'var(--pf-bg-white)', color: 'var(--pf-text-sec)', borderRadius: 10, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--pf-font)' }}>Keep Editing</button>
                      <button onClick={() => { setShowCancelConfirm(false); onClose(); }} style={{ flex: 1, padding: '7px 0', border: 'none', background: 'var(--pf-danger)', color: 'white', borderRadius: 10, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--pf-font)' }}>Discard</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BODY */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--pf-bg-white)' }}>
              {generatedQuestions.length === 0 ? (
                /* Empty / generate prompt */
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: 32 }}>
                  <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {error && (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--pf-danger-bg)', border: '1.5px solid var(--pf-danger-bdr)', borderRadius: 'var(--pf-radius-md)', padding: '10px 14px' }}>
                        <AlertCircle size={14} style={{ color: 'var(--pf-danger)', flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontFamily: 'var(--pf-font)', fontSize: 12, fontWeight: 600, color: 'var(--pf-danger)' }}>{error}</p>
                      </div>
                    )}

                    {/* Hero */}
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--pf-orange)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 4px 16px var(--pf-orange-glow)' }}>
                        <Zap size={24} style={{ color: 'white' }} />
                      </div>
                      <div>
                        <h2 style={{ fontFamily: 'var(--pf-font)', fontSize: 16, fontWeight: 800, color: 'var(--pf-text-main)' }}>Generate {formType[0].toUpperCase() + formType.slice(1)} Questions</h2>
                        <p style={{ fontFamily: 'var(--pf-font)', fontSize: 12, color: 'var(--pf-text-muted)' }}>{meta.subtitle}</p>
                      </div>
                    </div>

                    {/* Topic — auto-built from hierarchy, editable */}
                    {!customMode && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontFamily: 'var(--pf-font)', fontSize: 11, fontWeight: 700, color: 'var(--pf-text-sec)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Topic <span style={{ color: 'var(--pf-danger)' }}>*</span>
                        </label>
                        <input type="text" value={topicInput} onChange={e => setTopicInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && !loading && topicInput.trim() && handleGenerate()}
                          placeholder={
                            formType === 'programming' ? 'e.g. binary search, dynamic programming, two pointers'
                            : formType === 'frontend' ? 'e.g. responsive navbar with flexbox, modal with focus trap'
                            : 'e.g. JOIN with aggregation, window functions, GROUP BY HAVING'
                          }
                          disabled={loading} autoFocus
                          style={{ fontFamily: 'var(--pf-font)', fontSize: 13, padding: '10px 14px', border: '1.5px solid var(--pf-border)', borderRadius: 'var(--pf-radius-md)', outline: 'none', background: 'var(--pf-bg-surface)', color: 'var(--pf-text-main)', width: '100%', opacity: loading ? 0.6 : 1 }}
                          onFocus={e => { e.target.style.borderColor = 'var(--pf-orange)'; e.target.style.boxShadow = '0 0 0 3px var(--pf-orange-light)'; e.target.style.background = 'var(--pf-bg-white)'; }}
                          onBlur={e => { e.target.style.borderColor = 'var(--pf-border)'; e.target.style.boxShadow = 'none'; e.target.style.background = 'var(--pf-bg-surface)'; }}
                        />
                        {breadcrumbs.length > 0 && (
                          <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-text-muted)' }}>
                            Pre-filled from your course → module → topic hierarchy. Edit freely.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Custom topics array */}
                    {customMode && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontFamily: 'var(--pf-font)', fontSize: 11, fontWeight: 700, color: 'var(--pf-text-sec)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Custom Topics <span style={{ color: 'var(--pf-danger)' }}>*</span>
                        </label>
                        <textarea
                          value={customTopicsText}
                          onChange={e => setCustomTopicsText(e.target.value)}
                          rows={5}
                          placeholder={
                            formType === 'programming'
                              ? 'One topic per line, e.g.\nbinary search\nsliding window\ngreedy intervals'
                              : formType === 'frontend'
                              ? 'One topic per line, e.g.\nflexbox navbar\ncss grid gallery\nmodal with focus trap'
                              : 'One topic per line, e.g.\nINNER JOIN basics\nGROUP BY with HAVING\nwindow functions'
                          }
                          disabled={loading}
                          style={{ fontFamily: 'var(--pf-font)', fontSize: 13, padding: '10px 14px', border: '1.5px solid var(--pf-border)', borderRadius: 'var(--pf-radius-md)', outline: 'none', background: 'var(--pf-bg-surface)', color: 'var(--pf-text-main)', width: '100%', resize: 'vertical', lineHeight: 1.5 }}
                        />
                        <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-text-muted)' }}>
                          One topic per line (or comma-separated). One question is generated per topic — up to {effectiveMaxCount}.
                        </p>
                      </div>
                    )}

                    {/* Custom checkbox toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: customMode ? 'var(--pf-orange-50)' : 'var(--pf-bg-surface)', border: `1.5px solid ${customMode ? 'var(--pf-orange-100)' : 'var(--pf-border)'}`, borderRadius: 'var(--pf-radius-md)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={customMode} onChange={() => setCustomMode(v => !v)} style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--pf-orange)' }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, fontWeight: 700, color: customMode ? '#c85a30' : 'var(--pf-text-main)' }}>
                          Custom topic list
                        </p>
                        <p style={{ fontFamily: 'var(--pf-font)', fontSize: 10.5, color: 'var(--pf-text-muted)', lineHeight: 1.4 }}>
                          Provide an array of topics — one question per topic.
                        </p>
                      </div>
                    </label>

                    {/* Generate button — in level mode, count = sum of per-difficulty sliders */}
                    {(() => {
                      const plannedCount = isLevelMode && !customMode
                        ? totalPerDiff
                        : (customMode ? parseCustomTopics().length : settings.numQuestions);
                      const disabled = loading
                        || (customMode ? parseCustomTopics().length === 0 : !topicInput.trim())
                        || (isLevelMode && !customMode && totalPerDiff === 0);
                      return (
                        <button onClick={handleGenerate} disabled={disabled}
                          style={{
                            width: '100%', padding: '11px 0', background: 'var(--pf-orange)', color: 'white',
                            border: 'none', borderRadius: 'var(--pf-radius-md)', fontFamily: 'var(--pf-font)',
                            fontSize: 13.5, fontWeight: 700,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            boxShadow: '0 2px 8px var(--pf-orange-glow)',
                            opacity: disabled ? 0.6 : 1,
                          }}>
                          {loading ? (
                            <><Loader2 size={15} className="animate-spin" />Generating…</>
                          ) : (
                            <><Sparkles size={15} />Generate {plannedCount || ''} {formType} question{plannedCount === 1 ? '' : 's'}</>
                          )}
                        </button>
                      );
                    })()}

                    {/* Summary pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--pf-bg-surface)', border: '1.5px solid var(--pf-border)', borderRadius: 'var(--pf-radius-md)', padding: '8px 12px' }}>
                      <Bot size={13} style={{ color: 'var(--pf-text-muted)', flexShrink: 0 }} />
                      <p style={{ fontFamily: 'var(--pf-font)', fontSize: 11, color: 'var(--pf-text-sec)' }}>
                        <strong style={{ color: 'var(--pf-text-main)' }}>{isLevelMode && !customMode ? totalPerDiff : (customMode ? parseCustomTopics().length || '—' : settings.numQuestions)}</strong> to generate ·{' '}
                        <strong style={{ color: 'var(--pf-text-main)', textTransform: 'capitalize' }}>{formType}</strong> ·{' '}
                        <strong style={{ color: 'var(--pf-text-main)', textTransform: 'capitalize' }}>
                          {isLevelMode && !customMode
                            ? `${perDiffCounts.easy}E · ${perDiffCounts.medium}M · ${perDiffCounts.hard}H`
                            : settings.difficulty}
                        </strong>
                        {(formType === 'programming' || formType === 'database') && (
                          <> · <strong style={{ color: 'var(--pf-text-main)' }}>{settings.numTestCases} test cases</strong></>
                        )}
                        {settings.numHints > 0 && <> · <strong style={{ color: 'var(--pf-text-main)' }}>{settings.numHints} hints</strong></>}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Generated questions list */
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {error && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--pf-danger-bg)', border: '1.5px solid var(--pf-danger-bdr)', borderRadius: 'var(--pf-radius-md)', padding: '10px 14px' }}>
                      <AlertCircle size={14} style={{ color: 'var(--pf-danger)', flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontFamily: 'var(--pf-font)', fontSize: 12, fontWeight: 600, color: 'var(--pf-danger)' }}>{error}</p>
                    </div>
                  )}

                  {generatedQuestions.map((question, index) => (
                    <div key={question.id} style={{
                      borderRadius: 'var(--pf-radius-md)',
                      border: editing?.id === question.id
                        ? '1.5px solid var(--pf-violet-bdr)'
                        : question.selected
                          ? '1.5px solid var(--pf-success-bdr)'
                          : '1.5px solid var(--pf-border)',
                      background: editing?.id === question.id ? 'var(--pf-violet-bg)' : question.selected ? 'var(--pf-success-bg)' : 'var(--pf-bg-white)',
                      overflow: 'hidden', transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 2 }}>
                          <input type="checkbox" checked={!!question.selected} onChange={() => toggleQuestionSelection(question.id)}
                            style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--pf-orange)' }} />
                          <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, color: 'var(--pf-text-hint)', width: 20 }}>Q{index + 1}</span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>{renderQuestionEditor(question)}</div>
                        {editing?.id !== question.id && (
                          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 2 }}>
                            <button onClick={() => startEditing(question)} title="Edit"
                              style={{ padding: 5, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--pf-text-muted)' }}>
                              <Edit2 size={12} />
                            </button>
                            <button onClick={() => deleteQuestion(question.id)} title="Delete"
                              style={{ padding: 5, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--pf-text-muted)' }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            {renderSettingsSidebar()}
          </div>

          {/* FOOTER */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 20px', borderTop: '1.5px solid var(--pf-border)', background: 'var(--pf-bg-surface)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {generatedQuestions.length > 0 && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll}
                    style={{ width: 14, height: 14, cursor: 'pointer', accentColor: 'var(--pf-orange)' }} />
                  <span style={{ fontFamily: 'var(--pf-font)', fontSize: 12, fontWeight: 600, color: 'var(--pf-text-main)' }}>
                    All
                    <span style={{ fontFamily: 'var(--pf-font)', fontWeight: 400, color: 'var(--pf-text-muted)', marginLeft: 4 }}>
                      ({selectedCount}/{generatedQuestions.length})
                    </span>
                  </span>
                </label>
              )}
              {generatedQuestions.length > 0 ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--pf-font)', fontSize: 11.5, color: 'var(--pf-text-muted)' }}>
                  <CheckCircle size={12} style={{ color: 'var(--pf-success)' }} />{generatedQuestions.length} generated
                </span>
              ) : (
                <span style={{ fontFamily: 'var(--pf-font)', fontSize: 11.5, color: 'var(--pf-text-muted)' }}>Configure settings and generate</span>
              )}
              {overLimit && (
                <span style={{ fontFamily: 'var(--pf-font)', fontSize: 11, fontWeight: 700, color: 'var(--pf-danger)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertCircle size={12} />Deselect {selectedCount - effectiveMaxCount} — only {effectiveMaxCount} slot{effectiveMaxCount !== 1 ? 's' : ''} left
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {generatedQuestions.length > 0 && (
                <>
                  <button onClick={addCustomQuestion}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1.5px solid var(--pf-border)', background: 'var(--pf-bg-white)', color: 'var(--pf-text-sec)', borderRadius: 'var(--pf-radius-md)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--pf-font)' }}>
                    <Plus size={12} /> Custom
                  </button>
                  <button onClick={handleAddMore} disabled={loading || generatedQuestions.length >= effectiveMaxCount}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1.5px solid var(--pf-violet-bdr)', background: 'var(--pf-violet-bg)', color: 'var(--pf-violet)', borderRadius: 'var(--pf-radius-md)', fontSize: 12, fontWeight: 600, cursor: loading || generatedQuestions.length >= effectiveMaxCount ? 'not-allowed' : 'pointer', fontFamily: 'var(--pf-font)', opacity: loading || generatedQuestions.length >= effectiveMaxCount ? 0.5 : 1 }}>
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    Add More
                  </button>
                  <button onClick={handleRegenerateSelected} disabled={loading || selectedCount === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1.5px solid var(--pf-warning-bdr)', background: 'var(--pf-warning-bg)', color: 'var(--pf-warning)', borderRadius: 'var(--pf-radius-md)', fontSize: 12, fontWeight: 600, cursor: loading || selectedCount === 0 ? 'not-allowed' : 'pointer', fontFamily: 'var(--pf-font)', opacity: loading || selectedCount === 0 ? 0.5 : 1 }}>
                    {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Regen ({selectedCount})
                  </button>
                </>
              )}
              <button onClick={handleCloseWithConfirm} disabled={loading}
                style={{ padding: '6px 12px', border: '1.5px solid var(--pf-border)', background: 'var(--pf-bg-white)', color: 'var(--pf-text-sec)', borderRadius: 'var(--pf-radius-md)', fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--pf-font)' }}>
                Cancel
              </button>
              {generatedQuestions.length > 0 && (
                <button onClick={handleSave} disabled={selectedCount === 0 || overLimit}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', border: 'none', background: 'var(--pf-orange)', color: 'white', borderRadius: 'var(--pf-radius-md)', fontSize: 12, fontWeight: 700, cursor: selectedCount === 0 || overLimit ? 'not-allowed' : 'pointer', fontFamily: 'var(--pf-font)', opacity: selectedCount === 0 || overLimit ? 0.5 : 1, boxShadow: '0 2px 8px var(--pf-orange-glow)' }}>
                  <Save size={12} />
                  Add {selectedCount > 0 ? selectedCount : ''} Selected
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateProgFamilyAI;
