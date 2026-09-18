'use client';

// Programming question authoring screen for the question bank.
//
// Layout: a five-step rail on the left, a Basic Information block shared by
// every question, then an accordion of question cards. Each card carries its
// own title / difficulty / type, and THE FIELDS BELOW THE TYPE SWITCH WITH IT:
//
//   Core Programming → sample input/output · test cases · starter code
//   Frontend         → starter markup, no stdin/stdout test cases
//   Database         → sample query · expected result, no test cases
//
// Everything is local until publish. There is no bulk create endpoint and no
// authoring-draft API server-side, so "Save as Draft" writes to localStorage
// and publishing loops the existing single-question endpoint.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Plus, Trash2, ChevronUp, ChevronDown, Check, CheckCircle2, Circle, CircleDot,
  Loader2, AlertCircle, Terminal, Layout, Database, GripVertical, FileText,
  Eye, Save, ArrowRight, Lightbulb, FolderOpen, Code2, Bold, Italic, Underline,
  List as ListIcon, ListOrdered, Table as TableIcon, Link2, Image as ImageIcon,
  ClipboardList,
} from 'lucide-react';
import DOMPurify from 'dompurify';

// ─── Types ───────────────────────────────────────────────────────────────────
// Previously defined in questionbank/ProgrammingFields.tsx, which was the old
// single-question form. That component is gone; this screen owns the shapes.

/** Programming sub-type. Maps to the API's questionType. */
export type CategoryType = 'core' | 'frontend' | 'database';

export interface Hint {
  hintText: string;
  isPublic: boolean;
  sequence: number;
}

export interface TestCase {
  input: string;
  expectedOutput: string;
  isSample: boolean;
  isHidden: boolean;
  explanation?: string;
}

export interface Solution {
  startedCode?: string;
  functionName?: string;
  language?: string;
}

export interface ProgrammingDraft {
  localId: string;
  isActive: boolean;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: CategoryType;
  score: number;
  sampleInput: string;
  sampleOutput: string;
  constraints: string[];
  testCases: TestCase[];
  hints: Hint[];
  solutions: Solution;
  sampleQuery: string;
  expectedResult: string;
}

export interface PublishOutcome {
  localId: string;
  title: string;
  ok: boolean;
  error?: string;
}

interface ProgrammingWorkspaceProps {
  /** Question-bank categories for the Basic Information picker. */
  categories?: string[];
  onClose: () => void;
  onPublish: (
    drafts: ProgrammingDraft[],
    meta: { questionCategory: string; isActive: boolean },
  ) => Promise<PublishOutcome[]>;
  /** When set, edits this one saved question instead of authoring new ones. */
  editingDraft?: ProgrammingDraft | null;
}

type DraftStatus = 'complete' | 'in-progress' | 'incomplete';

const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;
const STORAGE_KEY = 'qb:programming-workspace:v1';

const STEPS = [
  { n: 1, label: 'Basic Information', hint: 'Category, type & title' },
  { n: 2, label: 'Problem Description', hint: 'Add the problem statement' },
  { n: 3, label: 'Constraints', hint: 'Set problem constraints' },
  { n: 4, label: 'Test Cases', hint: 'Add multiple test cases' },
  { n: 5, label: 'Review & Publish', hint: 'Review and publish question' },
] as const;

const TIPS = [
  'Use clear and concise language',
  'Define input/output formats',
  'Provide constraints',
  'Add multiple test cases',
  'Include sample explanation',
];

const TYPES: { value: CategoryType; label: string; icon: React.ReactNode }[] = [
  { value: 'core', label: 'Core Programming', icon: <Code2 className="h-3.5 w-3.5" /> },
  { value: 'frontend', label: 'Frontend', icon: <Layout className="h-3.5 w-3.5" /> },
  { value: 'database', label: 'Database', icon: <Database className="h-3.5 w-3.5" /> },
];

// Which fields each type actually uses. Everything that asks "does this type
// have X" goes through here, so the form, the validation and the review step
// can never disagree.
const TYPE_FIELDS: Record<
  CategoryType,
  { testCases: boolean; sampleIo: boolean; starterCode: boolean; sql: boolean; label: string }
> = {
  core: { testCases: true, sampleIo: true, starterCode: true, sql: false, label: 'Core Programming' },
  frontend: { testCases: false, sampleIo: false, starterCode: true, sql: false, label: 'Frontend' },
  database: { testCases: false, sampleIo: false, starterCode: false, sql: true, label: 'Database' },
};

// ─── Rich-text helpers ───────────────────────────────────────────────────────
// Descriptions are stored as HTML (the same way MCQ question text already is,
// see QuestionDetailDrawer/QuestionList rendering them with dangerouslySetInnerHTML).

const escapeHtml = (t: string) =>
  t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

const looksLikeHtml = (t: string) => /<[a-z][\s\S]*>/i.test(t);

/** Legacy descriptions were plain text; keep their line breaks when loading. */
const toEditorHtml = (raw: string) =>
  looksLikeHtml(raw) ? raw : escapeHtml(raw).replace(/\n/g, '<br>');

/** Text content of an HTML string — used for "is it empty" and the counter. */
const plainText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .trim();

/** DOMPurify needs a DOM; this only ever renders client-side. */
const sanitize = (html: string) => (typeof window === 'undefined' ? '' : DOMPurify.sanitize(html));

// ─── Draft helpers ───────────────────────────────────────────────────────────

let idSeed = 0;
const nextLocalId = () => `q-${++idSeed}-${Math.random().toString(36).slice(2, 8)}`;

const emptyDraft = (overrides: Partial<ProgrammingDraft> = {}): ProgrammingDraft => ({
  localId: nextLocalId(),
  isActive: true,
  title: '',
  description: '',
  difficulty: 'medium',
  category: 'core',
  score: 0,
  sampleInput: '',
  sampleOutput: '',
  constraints: [],
  testCases: [],
  hints: [],
  solutions: { startedCode: '', functionName: '', language: 'javascript' },
  sampleQuery: '',
  expectedResult: '',
  ...overrides,
});

/** What still blocks this question from publishing — type aware. */
const missingBits = (d: ProgrammingDraft): string[] => {
  const f = TYPE_FIELDS[d.category];
  const out: string[] = [];
  if (!d.title.trim()) out.push('Title');
  if (!plainText(d.description)) out.push('Description');
  else if (plainText(d.description).length > DESCRIPTION_MAX) out.push('a shorter description');
  if (f.testCases) {
    if (d.testCases.length === 0) out.push('at least one test case');
    else if (d.testCases.some((t) => !t.input.trim() || !t.expectedOutput.trim()))
      out.push('input & output on every test case');
  }
  if (f.sql) {
    if (!d.sampleQuery.trim()) out.push('Sample Query');
    if (!d.expectedResult.trim()) out.push('Expected Result');
  }
  return out;
};

const draftStatus = (d: ProgrammingDraft): DraftStatus => {
  if (missingBits(d).length === 0) return 'complete';
  const untouched =
    !d.title.trim() &&
    !plainText(d.description) &&
    d.constraints.length === 0 &&
    d.testCases.length === 0 &&
    !d.sampleQuery.trim();
  return untouched ? 'incomplete' : 'in-progress';
};

/** Accepts a saved Question or a stored draft and fills in anything missing. */
export const coerceDraft = (raw: any): ProgrammingDraft => {
  const diff = String(raw?.difficulty ?? '').toLowerCase();
  const sub = String(raw?.category ?? '').toLowerCase();
  const list = (v: any): string[] => {
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(/[|;\n]/).map((x) => x.trim()).filter(Boolean);
    return [];
  };

  return emptyDraft({
    isActive: raw?.isActive !== undefined ? !!raw.isActive : true,
    title: String(raw?.title ?? '').slice(0, TITLE_MAX),
    description: toEditorHtml(String(raw?.description ?? '')),
    difficulty: (['easy', 'medium', 'hard'].includes(diff) ? diff : 'medium') as
      | 'easy'
      | 'medium'
      | 'hard',
    category: (['core', 'frontend', 'database'].includes(sub) ? sub : 'core') as CategoryType,
    score: Number(raw?.score) || 0,
    sampleInput: String(raw?.sampleInput ?? ''),
    sampleOutput: String(raw?.sampleOutput ?? ''),
    constraints: list(raw?.constraints),
    testCases: Array.isArray(raw?.testCases)
      ? raw.testCases.map((t: any) => ({
          input: String(t?.input ?? ''),
          expectedOutput: String(t?.expectedOutput ?? t?.output ?? ''),
          isSample: !!t?.isSample,
          isHidden: !!t?.isHidden,
          explanation: String(t?.explanation ?? ''),
        }))
      : [],
    hints: Array.isArray(raw?.hints)
      ? raw.hints.map((h: any, i: number) => ({
          hintText: String(h?.hintText ?? h ?? ''),
          isPublic: !!h?.isPublic,
          sequence: Number(h?.sequence) || i + 1,
        }))
      : [],
    solutions: {
      startedCode: String(raw?.solutions?.startedCode ?? ''),
      functionName: String(raw?.solutions?.functionName ?? ''),
      language: String(raw?.solutions?.language ?? 'javascript'),
    },
    sampleQuery: String(raw?.sampleQuery ?? ''),
    expectedResult: String(raw?.expectedResult ?? ''),
  });
};

// ─── Shared bits ─────────────────────────────────────────────────────────────

const field =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 transition-colors placeholder:text-gray-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-violet-900/40';

const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({
  children,
  required,
}) => (
  <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
    {children}
    {required && <span className="ml-0.5 text-red-500">*</span>}
  </label>
);

const SectionTitle: React.FC<{
  icon: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}> = ({ icon, title, hint, action }) => (
  <div className="mb-4 flex items-start justify-between gap-3">
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300">
        {icon}
      </span>
      <div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
    </div>
    {action}
  </div>
);

const StatusDot: React.FC<{ status: DraftStatus }> = ({ status }) =>
  status === 'complete' ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
  ) : status === 'in-progress' ? (
    <CircleDot className="h-4 w-4 text-amber-500" />
  ) : (
    <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600" />
  );

// ─── Rich text editor ────────────────────────────────────────────────────────
// contentEditable + document.execCommand, matching the editor pattern already
// used by MCQFields / MCQQuestionForm / CreateTestModal so the stored markup is
// consistent with the rest of the question bank. execCommand is deprecated but
// still implemented everywhere, and it is what the existing editors rely on.

type ToolKey =
  | 'bold' | 'italic' | 'underline'
  | 'insertUnorderedList' | 'insertOrderedList'
  | 'table' | 'code' | 'link' | 'image';

const TOOLS: { key: ToolKey; icon: React.ElementType; title: string }[] = [
  { key: 'bold', icon: Bold, title: 'Bold (Ctrl+B)' },
  { key: 'italic', icon: Italic, title: 'Italic (Ctrl+I)' },
  { key: 'underline', icon: Underline, title: 'Underline (Ctrl+U)' },
  { key: 'insertUnorderedList', icon: ListIcon, title: 'Bullet list' },
  { key: 'insertOrderedList', icon: ListOrdered, title: 'Numbered list' },
  { key: 'table', icon: TableIcon, title: 'Insert table' },
  { key: 'code', icon: Code2, title: 'Inline code' },
  { key: 'link', icon: Link2, title: 'Insert link' },
  { key: 'image', icon: ImageIcon, title: 'Insert image' },
];

// Commands whose on/off state the toolbar can reflect.
const STATEFUL: ToolKey[] = [
  'bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList',
];

const TABLE_HTML =
  '<table style="border-collapse:collapse;width:100%"><tbody>' +
  '<tr><td style="border:1px solid #d1d5db;padding:6px">&nbsp;</td>' +
  '<td style="border:1px solid #d1d5db;padding:6px">&nbsp;</td></tr>' +
  '<tr><td style="border:1px solid #d1d5db;padding:6px">&nbsp;</td>' +
  '<td style="border:1px solid #d1d5db;padding:6px">&nbsp;</td></tr>' +
  '</tbody></table><p><br></p>';

const RichTextEditor: React.FC<{
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Partial<Record<ToolKey, boolean>>>({});
  const [focused, setFocused] = useState(false);

  // Only write to the DOM when it genuinely differs, otherwise every keystroke
  // would reset the node and send the caret back to the start.
  useEffect(() => {
    const el = ref.current;
    if (el && el.innerHTML !== (value || '')) el.innerHTML = value || '';
  }, [value]);

  const refreshActive = useCallback(() => {
    const next: Partial<Record<ToolKey, boolean>> = {};
    STATEFUL.forEach((c) => {
      try {
        next[c] = document.queryCommandState(c);
      } catch {
        next[c] = false;
      }
    });
    setActive(next);
  }, []);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    onChange(el.innerHTML);
    refreshActive();
  }, [onChange, refreshActive]);

  const run = (key: ToolKey) => {
    const el = ref.current;
    if (!el) return;
    el.focus();

    if (key === 'link') {
      const url = window.prompt('Link URL (https://…)');
      if (url) document.execCommand('createLink', false, url);
    } else if (key === 'image') {
      const url = window.prompt('Image URL (https://…)');
      if (url) document.execCommand('insertImage', false, url);
    } else if (key === 'code') {
      const picked = window.getSelection()?.toString() || '';
      document.execCommand(
        'insertHTML',
        false,
        `<code style="background:#f3f4f6;padding:1px 4px;border-radius:4px">${
          escapeHtml(picked) || '&nbsp;'
        }</code>&nbsp;`,
      );
    } else if (key === 'table') {
      document.execCommand('insertHTML', false, TABLE_HTML);
    } else {
      document.execCommand(key, false);
    }
    sync();
  };

  const chars = plainText(value || '').length;
  const over = chars > DESCRIPTION_MAX;
  const isEmpty = !plainText(value || '');

  return (
    <div
      className={`overflow-hidden rounded-lg border transition-colors ${
        focused
          ? 'border-violet-400 ring-2 ring-violet-100 dark:ring-violet-900/40'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50/70 px-2 py-1.5 dark:border-gray-700 dark:bg-gray-800/60">
        {TOOLS.map(({ key, icon: Icon, title }) => (
          <button
            key={key}
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={!!active[key]}
            // mouseDown + preventDefault keeps the selection alive; a plain
            // onClick would blur the editor first and the command would no-op.
            onMouseDown={(e) => {
              e.preventDefault();
              run(key);
            }}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
              active[key]
                ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
                : 'text-gray-500 hover:bg-violet-50 hover:text-violet-600 dark:text-gray-400 dark:hover:bg-violet-900/30'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={sync}
          onBlur={() => {
            setFocused(false);
            sync();
          }}
          onFocus={() => {
            setFocused(true);
            refreshActive();
          }}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          // Paste as plain text so copied styling from Word/pages doesn't
          // smuggle arbitrary markup into the stored description.
          onPaste={(e) => {
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            sync();
          }}
          className="prose prose-sm dark:prose-invert min-h-[132px] max-w-none resize-y overflow-y-auto bg-white px-3 py-2.5 text-sm text-gray-800 focus:outline-none dark:bg-gray-900 dark:text-gray-100"
        />
        {isEmpty && placeholder && (
          <p className="pointer-events-none absolute left-3 top-2.5 select-none text-sm text-gray-400">
            {placeholder}
          </p>
        )}
      </div>

      <div className="flex justify-end border-t border-gray-100 bg-gray-50/60 px-3 py-1 text-[11px] dark:border-gray-800 dark:bg-gray-800/40">
        <span className={over ? 'font-semibold text-red-500' : 'text-gray-400'}>
          {chars} / {DESCRIPTION_MAX}
        </span>
      </div>
    </div>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────

const ProgrammingWorkspace: React.FC<ProgrammingWorkspaceProps> = ({
  categories = [],
  onClose,
  onPublish,
  editingDraft = null,
}) => {
  const isEditing = !!editingDraft;

  const [step, setStep] = useState(1);
  const [questionCategory, setQuestionCategory] = useState('Programming');
  const [bankActive, setBankActive] = useState(true);
  const [showBrowse, setShowBrowse] = useState(false);

  const [drafts, setDrafts] = useState<ProgrammingDraft[]>(() =>
    editingDraft ? [editingDraft] : [emptyDraft()],
  );
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const [testCaseFor, setTestCaseFor] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [constraintInput, setConstraintInput] = useState<Record<string, string>>({});

  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [outcomes, setOutcomes] = useState<PublishOutcome[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // True once the author has typed/changed anything this session. Drives the
  // confirm-before-close prompt; cleared by an explicit save or a publish.
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const hydrated = useRef(false);

  // ── Draft persistence (create mode only; editing must not touch the store) ──
  useEffect(() => {
    if (isEditing) {
      hydrated.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const list: ProgrammingDraft[] = (parsed?.questions ?? []).map(coerceDraft);
        if (list.length) {
          setDrafts(list);
          setQuestionCategory(String(parsed?.questionCategory || 'Programming'));
          setBankActive(parsed?.isActive !== undefined ? !!parsed.isActive : true);
          setSavedAt(Number(parsed?.savedAt) || null);
        }
      }
    } catch {
      /* corrupt draft — start clean rather than block the screen */
    }
    hydrated.current = true;
  }, [isEditing]);

  const persist = useCallback(
    (silent: boolean) => {
      if (isEditing) {
        if (!silent) setNotice('Use Save & Continue to save your changes.');
        return;
      }
      try {
        const now = Date.now();
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            version: 2,
            savedAt: now,
            questionCategory,
            isActive: bankActive,
            questions: drafts,
          }),
        );
        setSavedAt(now);
        if (!silent) {
          setDirty(false);
          setNotice('Draft saved on this device.');
        }
      } catch {
        if (!silent) setNotice('Could not save — browser storage is full.');
      }
    },
    [drafts, questionCategory, bankActive, isEditing],
  );

  useEffect(() => {
    if (!hydrated.current || isEditing) return;
    const t = window.setTimeout(() => persist(true), 900);
    return () => window.clearTimeout(t);
  }, [drafts, questionCategory, bankActive, isEditing, persist]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  // ── Mutations ──
  const patch = (localId: string, changes: Partial<ProgrammingDraft>) => {
    setDirty(true);
    setDrafts((list) => list.map((d) => (d.localId === localId ? { ...d, ...changes } : d)));
  };

  const addQuestion = () => {
    const d = emptyDraft();
    setDirty(true);
    setDrafts((list) => [...list, d]);
    setOpenCards((o) => ({ ...o, [d.localId]: true }));
  };

  const removeQuestion = (localId: string) => {
    setDirty(true);
    return setDrafts((list) => {
      const next = list.filter((d) => d.localId !== localId);
      return next.length ? next : [emptyDraft()];
    });
  };

  const move = (localId: string, dir: -1 | 1) => {
    setDirty(true);
    return setDrafts((list) => {
      const i = list.findIndex((d) => d.localId === localId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const addConstraint = (d: ProgrammingDraft) => {
    const v = (constraintInput[d.localId] || '').trim();
    if (!v) return;
    patch(d.localId, { constraints: [...d.constraints, v] });
    setConstraintInput((s) => ({ ...s, [d.localId]: '' }));
  };

  const counts = useMemo(() => {
    const c: Record<DraftStatus, number> = { complete: 0, 'in-progress': 0, incomplete: 0 };
    drafts.forEach((d) => c[draftStatus(d)]++);
    return c;
  }, [drafts]);

  // ── Publish ──
  const publish = async () => {
    const ready = drafts.filter((d) => draftStatus(d) === 'complete');
    if (!ready.length) {
      setNotice(
        isEditing
          ? 'Fill in the required fields before saving.'
          : 'No question is complete yet — check the Review & Publish step.',
      );
      setStep(5);
      return;
    }
    setPublishing(true);
    setOutcomes(null);
    try {
      const results = await onPublish(ready, { questionCategory, isActive: bankActive });
      setOutcomes(results);
      if (results.some((r) => r.ok)) setDirty(false);
      if (isEditing) return; // the caller closes the screen on success
      const okIds = new Set(results.filter((r) => r.ok).map((r) => r.localId));
      if (okIds.size) {
        setDrafts((list) => {
          const next = list.filter((d) => !okIds.has(d.localId));
          return next.length ? next : [emptyDraft()];
        });
      }
    } catch (e: any) {
      setNotice(e?.message || 'Publishing failed.');
    } finally {
      setPublishing(false);
    }
  };

  const savedLabel = (() => {
    if (isEditing) return 'Editing a saved question';
    if (!savedAt) return 'Not saved yet';
    const secs = Math.floor((Date.now() - savedAt) / 1000);
    if (secs < 10) return 'Saved just now';
    if (secs < 60) return `Saved ${secs}s ago`;
    const mins = Math.floor(secs / 60);
    return mins < 60 ? `Saved ${mins} min ago` : 'Saved earlier';
  })();

  // Closing with unsaved work asks first; a untouched session just closes.
  const requestClose = useCallback(() => {
    if (dirty) setConfirmClose(true);
    else onClose();
  }, [dirty, onClose]);

  const discardAndClose = () => {
    if (!isEditing) {
      // Otherwise the abandoned draft would be restored on the next open.
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* nothing to clean up */
      }
    }
    setConfirmClose(false);
    onClose();
  };

  const saveAndClose = () => {
    if (isEditing) {
      // Publishing an edit updates the record; the caller closes on success.
      setConfirmClose(false);
      publish();
      return;
    }
    persist(false);
    setConfirmClose(false);
    onClose();
  };

  // Esc closes, through the same guard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Let the inner modals handle their own Esc first.
      if (testCaseFor || previewFor || showBrowse || confirmClose) return;
      requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose, testCaseFor, previewFor, showBrowse, confirmClose]);

  const previewDraft = drafts.find((d) => d.localId === previewFor) || null;
  const testCaseDraft = drafts.find((d) => d.localId === testCaseFor) || null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-gray-950"
    >
      {/* ── Header ── */}
      <header className="flex flex-shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-5 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 dark:bg-orange-900/30">
            <Terminal className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight text-gray-900 dark:text-gray-100">
              {isEditing ? 'Edit Programming Question' : 'Add Programming Question'}
            </h2>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              Create high-quality programming questions for students
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewFor(drafts[0]?.localId ?? null)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <Eye className="h-4 w-4" /> Preview
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={() => persist(false)}
              className="flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3.5 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
            >
              <Save className="h-4 w-4" /> Save as Draft
            </button>
          )}
          <button
            type="button"
            onClick={requestClose}
            title="Close"
            className="rounded-lg border border-gray-200 p-2 text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {notice && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-violet-100 bg-violet-50 px-5 py-2 text-xs font-medium text-violet-800 dark:border-violet-900 dark:bg-violet-900/20 dark:text-violet-200">
          <AlertCircle className="h-3.5 w-3.5" /> {notice}
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* Step rail */}
        <aside className="hidden w-[228px] flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-gray-200 bg-white px-3 py-4 dark:border-gray-800 dark:bg-gray-900 lg:flex">
          <ol className="relative">
            {STEPS.map((s, i) => {
              const activeStep = s.n === step;
              const done = s.n < step;
              return (
                <li key={s.n} className="relative pb-2">
                  {i < STEPS.length - 1 && (
                    <span className="absolute left-[22px] top-8 h-[calc(100%-1.75rem)] w-px bg-gray-200 dark:bg-gray-700" />
                  )}
                  <button
                    type="button"
                    onClick={() => setStep(s.n)}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      activeStep
                        ? 'bg-violet-50 dark:bg-violet-900/25'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span
                      className={`relative z-10 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        activeStep
                          ? 'bg-violet-600 text-white'
                          : done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {done ? <Check className="h-3 w-3" /> : s.n}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-[13px] font-semibold leading-tight ${
                          activeStep
                            ? 'text-violet-700 dark:text-violet-300'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {s.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">
                        {s.hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="rounded-xl bg-violet-50/70 p-3 dark:bg-violet-900/15">
            <div className="mb-2.5 flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 text-violet-600 dark:text-violet-400" />
              <h4 className="text-[13px] font-bold leading-tight text-violet-900 dark:text-violet-200">
                Tips for a good question
              </h4>
            </div>
            <ul className="space-y-2">
              {TIPS.map((t) => (
                <li key={t} className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-violet-500" />
                  <span className="text-[11px] leading-snug text-gray-700 dark:text-gray-300">{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {step === 5 ? (
            <ReviewStep
              drafts={drafts}
              counts={counts}
              outcomes={outcomes}
              questionCategory={questionCategory}
              onJump={(id) => {
                setOpenCards((o) => ({ ...o, [id]: true }));
                setStep(1);
              }}
            />
          ) : (
            <>
              {/* Basic Information */}
              <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                <SectionTitle
                  icon={<ClipboardList className="h-4 w-4" />}
                  title="Basic Information"
                />

                <FieldLabel required>Category</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Database className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
                    <input
                      value={questionCategory}
                      onChange={(e) => {
                        setQuestionCategory(e.target.value);
                        setDirty(true);
                      }}
                      list="qb-prog-categories"
                      placeholder="Programming"
                      className={`${field} pl-9 pr-8 font-medium`}
                    />
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <datalist id="qb-prog-categories">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBrowse(true)}
                    className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-800 dark:bg-gray-800 dark:text-violet-300"
                  >
                    <FolderOpen className="h-4 w-4" /> Browse Categories
                  </button>
                </div>

                <label className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bankActive}
                    onChange={(e) => {
                      setBankActive(e.target.checked);
                      setDirty(true);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Active Question
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Enable this question to make it available for students
                  </span>
                </label>
              </section>

              {/* Questions */}
              <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
                <SectionTitle
                  icon={<Terminal className="h-4 w-4" />}
                  title="Questions"
                  hint="Add one or more questions with all details"
                  action={
                    !isEditing ? (
                      <button
                        type="button"
                        onClick={addQuestion}
                        className="flex flex-shrink-0 items-center gap-2 rounded-lg border border-violet-300 bg-white px-3.5 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-700 dark:bg-gray-800 dark:text-violet-300"
                      >
                        <Plus className="h-4 w-4" /> Add New Question
                      </button>
                    ) : undefined
                  }
                />

                <div className="space-y-4">
                  {drafts.map((d, i) => {
                    const open = openCards[d.localId] ?? true;
                    const f = TYPE_FIELDS[d.category];
                    const gaps = missingBits(d);
                    return (
                      <div
                        key={d.localId}
                        className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
                      >
                        {/* Card header */}
                        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/60">
                          {!isEditing && (
                            <span className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => move(d.localId, -1)}
                                disabled={i === 0}
                                title="Move up"
                                className="text-gray-300 hover:text-violet-600 disabled:opacity-30 dark:text-gray-600"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => move(d.localId, 1)}
                                disabled={i === drafts.length - 1}
                                title="Move down"
                                className="text-gray-300 hover:text-violet-600 disabled:opacity-30 dark:text-gray-600"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                          <GripVertical className="h-4 w-4 flex-shrink-0 text-gray-300 dark:text-gray-600" />
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            Question {i + 1}
                          </span>
                          {d.isActive && (
                            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Active
                            </span>
                          )}
                          <StatusDot status={draftStatus(d)} />
                          <span className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setPreviewFor(d.localId)}
                              title="Preview this question"
                              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-violet-600 dark:hover:bg-gray-700"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setOpenCards((o) => ({ ...o, [d.localId]: !open }))}
                              title={open ? 'Collapse' : 'Expand'}
                              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-violet-600 dark:hover:bg-gray-700"
                            >
                              {open ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            {!isEditing && (
                              <button
                                type="button"
                                onClick={() => removeQuestion(d.localId)}
                                title="Delete question"
                                className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </span>
                        </div>

                        {open && (
                          <div className="space-y-4 p-4">
                            {/* Type sits first and on its own row — it decides
                                which fields appear further down, and the three
                                options need the full width to stay readable. */}
                            <div>
                              <FieldLabel required>Type</FieldLabel>
                              <div className="flex flex-wrap gap-2">
                                {TYPES.map((t) => {
                                  const on = d.category === t.value;
                                  return (
                                    <button
                                      key={t.value}
                                      type="button"
                                      onClick={() => patch(d.localId, { category: t.value })}
                                      aria-pressed={on}
                                      className={`flex min-w-[140px] flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all ${
                                        on
                                          ? 'border-orange-300 bg-orange-50 text-orange-600 dark:border-orange-700 dark:bg-orange-900/25 dark:text-orange-300'
                                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                      }`}
                                    >
                                      {t.icon}
                                      <span>{t.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Title · Difficulty */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                              <div>
                                <FieldLabel required>Title</FieldLabel>
                                <input
                                  value={d.title}
                                  maxLength={TITLE_MAX}
                                  onChange={(e) => patch(d.localId, { title: e.target.value })}
                                  placeholder="Enter problem title"
                                  className={field}
                                />
                              </div>
                              <div>
                                <FieldLabel required>Difficulty</FieldLabel>
                                <select
                                  value={d.difficulty}
                                  onChange={(e) =>
                                    patch(d.localId, {
                                      difficulty: e.target.value as ProgrammingDraft['difficulty'],
                                    })
                                  }
                                  className={`${field} cursor-pointer font-medium`}
                                >
                                  <option value="easy">Easy</option>
                                  <option value="medium">Medium</option>
                                  <option value="hard">Hard</option>
                                </select>
                              </div>
                            </div>

                            {/* Description · Constraints */}
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                              <div>
                                <FieldLabel required>Description</FieldLabel>
                                <RichTextEditor
                                  value={d.description}
                                  onChange={(html) => patch(d.localId, { description: html })}
                                  placeholder="Describe the problem clearly. Include input/output format, constraints, and examples."
                                />
                              </div>

                              <div>
                                <FieldLabel>Constraints</FieldLabel>
                                <div className="flex gap-2">
                                  <input
                                    value={constraintInput[d.localId] || ''}
                                    onChange={(e) =>
                                      setConstraintInput((s) => ({
                                        ...s,
                                        [d.localId]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addConstraint(d);
                                      }
                                    }}
                                    placeholder="Enter constraint and press Enter"
                                    className={field}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addConstraint(d)}
                                    className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-semibold text-orange-600 transition-colors hover:bg-orange-50 dark:border-orange-700 dark:bg-gray-800 dark:text-orange-300"
                                  >
                                    <Plus className="h-3.5 w-3.5" /> Add
                                  </button>
                                </div>

                                {d.constraints.length > 0 && (
                                  <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
                                    {d.constraints.map((c, ci) => (
                                      <li key={ci} className="flex items-center gap-2 px-3 py-2">
                                        <span className="text-gray-400">•</span>
                                        <input
                                          value={c}
                                          onChange={(e) => {
                                            const next = [...d.constraints];
                                            next[ci] = e.target.value;
                                            patch(d.localId, { constraints: next });
                                          }}
                                          className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none dark:text-gray-200"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            patch(d.localId, {
                                              constraints: d.constraints.filter((_, x) => x !== ci),
                                            })
                                          }
                                          title="Remove"
                                          className="text-gray-400 transition-colors hover:text-red-500"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>

                            {/* ── Type-specific fields ── */}
                            {f.sampleIo && (
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                  <FieldLabel>Sample Input</FieldLabel>
                                  <textarea
                                    value={d.sampleInput}
                                    onChange={(e) =>
                                      patch(d.localId, { sampleInput: e.target.value })
                                    }
                                    rows={3}
                                    placeholder="Enter sample input..."
                                    className={`${field} resize-y font-mono text-xs`}
                                  />
                                </div>
                                <div>
                                  <FieldLabel>Sample Output</FieldLabel>
                                  <textarea
                                    value={d.sampleOutput}
                                    onChange={(e) =>
                                      patch(d.localId, { sampleOutput: e.target.value })
                                    }
                                    rows={3}
                                    placeholder="Enter sample output..."
                                    className={`${field} resize-y font-mono text-xs`}
                                  />
                                </div>
                              </div>
                            )}

                            {f.sql && (
                              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div>
                                  <FieldLabel required>Sample Query</FieldLabel>
                                  <textarea
                                    value={d.sampleQuery}
                                    onChange={(e) =>
                                      patch(d.localId, { sampleQuery: e.target.value })
                                    }
                                    rows={5}
                                    placeholder="SELECT name FROM employees WHERE salary > 50000;"
                                    className="w-full resize-y rounded-lg border border-gray-700 bg-slate-900 px-3 py-2.5 font-mono text-xs text-emerald-200 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <FieldLabel required>Expected Result</FieldLabel>
                                  <textarea
                                    value={d.expectedResult}
                                    onChange={(e) =>
                                      patch(d.localId, { expectedResult: e.target.value })
                                    }
                                    rows={5}
                                    placeholder="Describe the expected result set, or paste the expected rows."
                                    className={`${field} resize-y`}
                                  />
                                </div>
                              </div>
                            )}

                            {f.starterCode && (
                              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
                                <div>
                                  <FieldLabel>
                                    {d.category === 'frontend' ? 'Starter markup' : 'Starter code'}
                                  </FieldLabel>
                                  <textarea
                                    value={d.solutions.startedCode || ''}
                                    onChange={(e) =>
                                      patch(d.localId, {
                                        solutions: { ...d.solutions, startedCode: e.target.value },
                                      })
                                    }
                                    rows={4}
                                    placeholder={
                                      d.category === 'frontend'
                                        ? '<div class="card">…</div>'
                                        : 'function solve(input) { … }'
                                    }
                                    className={`${field} resize-y font-mono text-xs`}
                                  />
                                </div>
                                <div>
                                  <FieldLabel>Language</FieldLabel>
                                  <input
                                    value={d.solutions.language || ''}
                                    onChange={(e) =>
                                      patch(d.localId, {
                                        solutions: { ...d.solutions, language: e.target.value },
                                      })
                                    }
                                    placeholder={d.category === 'frontend' ? 'html' : 'javascript'}
                                    className={field}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Test cases live in a modal, as in the design */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {f.testCases
                                  ? 'Test cases are graded automatically against stdin/stdout.'
                                  : `${f.label} questions are not graded with stdin/stdout test cases.`}
                              </p>
                              {f.testCases && (
                                <button
                                  type="button"
                                  onClick={() => setTestCaseFor(d.localId)}
                                  className="flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-3.5 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 dark:border-violet-700 dark:bg-gray-800 dark:text-violet-300"
                                >
                                  <ClipboardList className="h-4 w-4" /> Manage Test Cases (
                                  {d.testCases.length})
                                </button>
                              )}
                            </div>

                            {gaps.length > 0 && (
                              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                <span>Still needed: {gaps.join(', ')}.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="flex flex-shrink-0 items-center justify-between gap-4 border-t border-gray-200 bg-white px-5 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white dark:bg-gray-700">
            {drafts.length}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-gray-800 dark:text-gray-200">
              {savedLabel}
            </p>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              {counts.complete} of {drafts.length} ready to publish
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => (step < 5 ? setStep(step + 1) : publish())}
            disabled={publishing}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
          >
            {publishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {isEditing ? 'Saving…' : 'Publishing…'}
              </>
            ) : step < 5 ? (
              <>
                Save &amp; Continue <ArrowRight className="h-4 w-4" />
              </>
            ) : isEditing ? (
              <>
                <Check className="h-4 w-4" /> Update Question
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Publish
                {counts.complete > 0 && ` (${counts.complete})`}
              </>
            )}
          </button>
        </div>
      </footer>

      {testCaseDraft && (
        <TestCasesModal
          draft={testCaseDraft}
          onChange={(testCases) => patch(testCaseDraft.localId, { testCases })}
          onClose={() => setTestCaseFor(null)}
        />
      )}

      {previewDraft && (
        <PreviewModal
          draft={previewDraft}
          category={questionCategory}
          onClose={() => setPreviewFor(null)}
        />
      )}

      {/* Unsaved-changes prompt. Save keeps the work (a draft when authoring, an
          update when editing); Discard throws it away and also clears the stored
          draft so it is not restored next time; Keep editing dismisses. */}
      {confirmClose && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setConfirmClose(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Save changes before closing?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {isEditing
                ? 'You have unsaved changes to this question. Save them now, or discard them and close.'
                : 'You have unsaved changes. Save them as a draft now, or discard the draft and close.'}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClose(false)}
                disabled={publishing}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Keep editing
              </button>
              <button
                type="button"
                onClick={discardAndClose}
                disabled={publishing}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={saveAndClose}
                disabled={publishing}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {publishing ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBrowse && (
        <BrowseCategoriesModal
          categories={categories}
          selected={questionCategory}
          onSelect={(c) => {
            setQuestionCategory(c);
            setDirty(true);
            setShowBrowse(false);
          }}
          onClose={() => setShowBrowse(false)}
        />
      )}
    </motion.div>
  );
};

// ─── Review & Publish step ───────────────────────────────────────────────────

const ReviewStep: React.FC<{
  drafts: ProgrammingDraft[];
  counts: Record<DraftStatus, number>;
  outcomes: PublishOutcome[] | null;
  questionCategory: string;
  onJump: (localId: string) => void;
}> = ({ drafts, counts, outcomes, questionCategory, onJump }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
    <SectionTitle
      icon={<CheckCircle2 className="h-4 w-4" />}
      title="Review & Publish"
      hint={`Filed under "${questionCategory}" · ${counts.complete} ready · ${counts['in-progress']} in progress · ${counts.incomplete} not started`}
    />

    <ul className="space-y-2">
      {drafts.map((d, i) => {
        const gaps = missingBits(d);
        return (
          <li
            key={d.localId}
            className="flex items-start gap-3 rounded-xl border border-gray-200 px-3.5 py-3 dark:border-gray-700"
          >
            <StatusDot status={draftStatus(d)} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {i + 1}. {d.title.trim() || 'Untitled question'}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {TYPE_FIELDS[d.category].label} · {d.difficulty}
                {TYPE_FIELDS[d.category].testCases && ` · ${d.testCases.length} test case(s)`}
                {d.constraints.length > 0 && ` · ${d.constraints.length} constraint(s)`}
              </p>
              {gaps.length > 0 && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Still needed: {gaps.join(', ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onJump(d.localId)}
              className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Edit
            </button>
          </li>
        );
      })}
    </ul>

    {outcomes && outcomes.length > 0 && (
      <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
        <h4 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">Publish results</h4>
        <ul className="space-y-1.5">
          {outcomes.map((o) => (
            <li key={o.localId} className="flex items-start gap-2 text-xs">
              {o.ok ? (
                <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
              ) : (
                <X className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-red-500" />
              )}
              <span className="text-gray-700 dark:text-gray-200">
                <b>{o.title || 'Untitled question'}</b>
                {o.ok ? ' — published' : ` — failed: ${o.error || 'unknown error'}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

// ─── Modals ──────────────────────────────────────────────────────────────────

const ModalShell: React.FC<{
  title: string;
  hint?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}> = ({ title, hint, onClose, children, footer, wide }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4">
    <div
      className={`flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900 ${
        wide ? 'max-w-4xl' : 'max-w-2xl'
      }`}
    >
      <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-gray-200 px-5 py-3.5 dark:border-gray-800">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          {hint && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      {footer && (
        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-800">
          {footer}
        </div>
      )}
    </div>
  </div>
);

const TestCasesModal: React.FC<{
  draft: ProgrammingDraft;
  onChange: (testCases: TestCase[]) => void;
  onClose: () => void;
}> = ({ draft, onChange, onClose }) => {
  const update = (i: number, changes: Partial<TestCase>) =>
    onChange(draft.testCases.map((t, x) => (x === i ? { ...t, ...changes } : t)));

  return (
    <ModalShell
      wide
      title={`Test Cases — ${draft.title.trim() || 'Untitled question'}`}
      hint="The first case is usually the visible sample; mark the rest hidden for grading."
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={() =>
              onChange([
                ...draft.testCases,
                {
                  input: '',
                  expectedOutput: '',
                  isSample: draft.testCases.length === 0,
                  isHidden: draft.testCases.length !== 0,
                  explanation: '',
                },
              ])
            }
            className="flex items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3.5 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50 dark:border-violet-700 dark:bg-gray-800 dark:text-violet-300"
          >
            <Plus className="h-4 w-4" /> Add Test Case
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Done
          </button>
        </>
      }
    >
      {draft.testCases.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-sm text-gray-400">
          <FileText className="h-6 w-6" />
          No test cases added yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {draft.testCases.map((tc, i) => (
            <li key={i} className="rounded-xl border border-gray-200 p-3.5 dark:border-gray-700">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  Test Case {i + 1}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={tc.isSample}
                    onChange={(e) => update(i, { isSample: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600"
                  />
                  Sample
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={tc.isHidden}
                    onChange={(e) => update(i, { isHidden: e.target.checked })}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600"
                  />
                  Hidden
                </label>
                <button
                  type="button"
                  onClick={() => onChange(draft.testCases.filter((_, x) => x !== i))}
                  title="Remove"
                  className="ml-auto rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel required>Input</FieldLabel>
                  <textarea
                    value={tc.input}
                    onChange={(e) => update(i, { input: e.target.value })}
                    rows={3}
                    placeholder="stdin…"
                    className={`${field} resize-y font-mono text-xs`}
                  />
                </div>
                <div>
                  <FieldLabel required>Expected Output</FieldLabel>
                  <textarea
                    value={tc.expectedOutput}
                    onChange={(e) => update(i, { expectedOutput: e.target.value })}
                    rows={3}
                    placeholder="expected stdout…"
                    className={`${field} resize-y font-mono text-xs`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FieldLabel>Explanation (Optional)</FieldLabel>
                  <input
                    value={tc.explanation || ''}
                    onChange={(e) => update(i, { explanation: e.target.value })}
                    placeholder="Explain this case…"
                    className={field}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
};

const PreviewModal: React.FC<{
  draft: ProgrammingDraft;
  category: string;
  onClose: () => void;
}> = ({ draft, category, onClose }) => {
  const f = TYPE_FIELDS[draft.category];
  const samples = draft.testCases.filter((t) => t.isSample && !t.isHidden);
  return (
    <ModalShell
      wide
      title={draft.title.trim() || 'Untitled question'}
      hint={`${category} · ${f.label} · ${draft.difficulty}`}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Close
        </button>
      }
    >
      <div className="space-y-5 text-sm">
        <section>
          <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">Problem</h4>
          {plainText(draft.description) ? (
            // Authored HTML from the description editor, sanitised before render.
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"
              dangerouslySetInnerHTML={{ __html: sanitize(draft.description) }}
            />
          ) : (
            <p className="text-gray-400">No description yet.</p>
          )}
        </section>

        {draft.constraints.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
              Constraints
            </h4>
            <ul className="list-inside list-disc space-y-1 text-gray-800 dark:text-gray-200">
              {draft.constraints.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </section>
        )}

        {f.sampleIo && (draft.sampleInput || draft.sampleOutput) && (
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                Sample Input
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
                {draft.sampleInput || '—'}
              </pre>
            </div>
            <div>
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
                Sample Output
              </h4>
              <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100">
                {draft.sampleOutput || '—'}
              </pre>
            </div>
          </section>
        )}

        {f.sql && (
          <section>
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
              Expected Result
            </h4>
            <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">
              {draft.expectedResult.trim() || '—'}
            </p>
          </section>
        )}

        {f.testCases && samples.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500">
              Examples
            </h4>
            <ul className="space-y-2">
              {samples.map((t, i) => (
                <li key={i} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <pre className="overflow-x-auto rounded bg-slate-900 p-2 font-mono text-xs text-slate-100">
                      {t.input || '—'}
                    </pre>
                    <pre className="overflow-x-auto rounded bg-slate-900 p-2 font-mono text-xs text-slate-100">
                      {t.expectedOutput || '—'}
                    </pre>
                  </div>
                  {t.explanation && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t.explanation}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </ModalShell>
  );
};

const BrowseCategoriesModal: React.FC<{
  categories: string[];
  selected: string;
  onSelect: (c: string) => void;
  onClose: () => void;
}> = ({ categories, selected, onSelect, onClose }) => {
  const [q, setQ] = useState('');
  const shown = categories.filter((c) => c.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <ModalShell title="Browse Categories" hint="Choose an existing category" onClose={onClose}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search categories…"
        className={`${field} mb-3`}
        autoFocus
      />
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No categories found.</p>
      ) : (
        <ul className="space-y-1">
          {shown.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  c === selected
                    ? 'bg-violet-50 font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                    : 'text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                <FolderOpen className="h-4 w-4 text-gray-400" />
                {c}
                {c === selected && <Check className="ml-auto h-4 w-4 text-violet-600" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
};

export default ProgrammingWorkspace;
