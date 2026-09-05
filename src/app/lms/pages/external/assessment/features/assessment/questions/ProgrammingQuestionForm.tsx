'use client';

/**
 * Programming question authoring — the External counterpart of the You_Do
 * ProgrammingQuestionForm.
 *
 * Sections mirror that form's numbered layout:
 *   1. Question details  — title, category, tags, description
 *   2. Execution setup   — Function / Full Program, Blank / Custom starter
 *   3. Code              — starter (optional) and solution (required)
 *   4. Test cases        — input / expected output, sample vs hidden
 *   5. Limits            — time and memory ceilings
 *
 * Code is edited in plain <textarea>s rather than CodeMirror: the LMS form
 * pulls in the full editor stack, and an external paper's authoring screen
 * does not need syntax highlighting badly enough to ship that bundle here.
 */

import React, { useState } from 'react';
import {
  Plus, X, Trash2, Eye, EyeOff, Code2, ListChecks, Settings2, FileCode2,
} from 'lucide-react';
import { D, SectionLabel, OInput, OSelect, InfoTooltip, Notice } from '../wizard/ui';
import type { ExternalQuestion, ExternalTestCase } from '@/apiServices/externalAssessment';

const LANGUAGES = ['C', 'C++', 'Java', 'Python', 'C#', 'JavaScript', 'SQL'];

const CATEGORIES = [
  '', 'Algorithm Design', 'Data Structures', 'Mathematical Reasoning',
  'Logic & Reasoning', 'System Design', 'Debugging', 'Optimization',
];

const codeArea =
  'w-full px-3 py-2.5 rounded-lg border bg-slate-50 text-[12.5px] leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none resize-y';

/** Numbered section heading — the "1 Question details" strip. */
function Step({ n, title, hint, children }: {
  n: number; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-6 items-center justify-center rounded-md text-[11px] font-bold shrink-0"
          style={{ background: D.orangeLight, color: D.orange }}
        >
          {n}
        </span>
        <div className="min-w-0">
          <h4 className="text-[13.5px] font-bold" style={{ color: D.textMain }}>{title}</h4>
          {hint && <p className="text-[11px]" style={{ color: D.textMuted }}>{hint}</p>}
        </div>
      </div>
      <div className="pl-8 space-y-3">{children}</div>
    </section>
  );
}

export default function ProgrammingQuestionForm({
  draft, onChange, errors = {},
}: {
  draft: ExternalQuestion;
  onChange: (patch: Partial<ExternalQuestion>) => void;
  errors?: Record<string, string>;
}) {
  const [tagInput, setTagInput] = useState('');

  const cases: ExternalTestCase[] = draft.testCases || [];
  const setCase = (i: number, patch: Partial<ExternalTestCase>) =>
    onChange({ testCases: cases.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) });

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    if (!(draft.tags || []).includes(t)) onChange({ tags: [...(draft.tags || []), t] });
    setTagInput('');
  };

  return (
    <div className="space-y-6">
      {/* ── 1. Question details ── */}
      <Step n={1} title="Question details" hint="Title, category, tags, and description">
        <div>
          <SectionLabel required>Problem Title</SectionLabel>
          <OInput
            value={draft.title || ''}
            onChange={(v) => onChange({ title: v })}
            placeholder="Type your question here…"
            error={errors.title}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <SectionLabel>Category</SectionLabel>
            <OSelect
              value={draft.category || ''}
              onChange={(v) => onChange({ category: v })}
              options={CATEGORIES.map((c) => ({ value: c, label: c || '— Uncategorised —' }))}
            />
          </div>
          <div>
            <SectionLabel info="Press Enter to add a tag; click × to remove one.">Tags</SectionLabel>
            <OInput
              value={tagInput}
              onChange={setTagInput}
              placeholder="Type a tag and press Enter…"
            />
            {(draft.tags || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {(draft.tags || []).map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold"
                    style={{ background: D.orangeLight, color: D.orange }}
                  >
                    {t}
                    <button
                      type="button"
                      onClick={() => onChange({ tags: (draft.tags || []).filter((x) => x !== t) })}
                      aria-label={`Remove ${t}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <SectionLabel required info="Include the input/output format and at least one worked example.">
            Problem Description
          </SectionLabel>
          <textarea
            rows={6}
            maxLength={5000}
            value={draft.description || ''}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Describe the problem clearly. Include input/output format and examples."
            className="w-full px-3 py-2 rounded-lg border bg-white text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none resize-y"
            style={{ borderColor: errors.description ? D.red : D.border2 }}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px]" style={{ color: D.textMuted }}>Markdown supported</span>
            <span className="text-[10px] tabular-nums" style={{ color: D.textMuted }}>
              {(draft.description || '').length} / 5,000
            </span>
          </div>
          {errors.description && (
            <p className="mt-1 text-[10px] font-medium" style={{ color: D.red }}>{errors.description}</p>
          )}
        </div>
      </Step>

      {/* ── 2. Execution setup ── */}
      <Step n={2} title="Execution setup" hint="Choose how participant submissions are executed and evaluated">
        <div className="inline-flex rounded-lg p-1" style={{ border: `1px solid ${D.border2}`, background: D.surface }}>
          {([
            { v: 'function', label: 'Function' },
            { v: 'fullProgram', label: 'Full Program' },
          ] as const).map((o) => {
            const on = (draft.executionMode || 'fullProgram') === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onChange({ executionMode: o.v })}
                className="px-5 py-1.5 rounded-md text-[12.5px] font-semibold transition-colors"
                style={{
                  background: on ? '#fff' : 'transparent',
                  color: on ? D.textMain : D.textMuted,
                  boxShadow: on ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>

        {draft.executionMode === 'function' && (
          <div className="max-w-sm">
            <SectionLabel required info="The function participants must implement.">Function name</SectionLabel>
            <OInput
              value={draft.functionName || ''}
              onChange={(v) => onChange({ functionName: v })}
              placeholder="e.g. reverseString"
              error={errors.functionName}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {([
            { v: 'blank', label: 'Blank Editor', hint: 'Participants start from nothing' },
            { v: 'custom', label: 'Custom Starter', hint: 'Pre-fill the editor with your code' },
          ] as const).map((o) => {
            const on = (draft.starterMode || 'blank') === o.v;
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onChange({ starterMode: o.v })}
                className="flex items-center gap-2.5 p-3 rounded-lg border-2 text-left transition-all"
                style={{ borderColor: on ? D.orange : D.border2, background: on ? D.orangeLight : '#fff' }}
              >
                <span
                  className="inline-flex size-4 items-center justify-center rounded-full border-2 shrink-0"
                  style={{ borderColor: on ? D.orange : '#cbd5e1' }}
                >
                  {on && <span className="size-2 rounded-full" style={{ background: D.orange }} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold" style={{ color: on ? D.orange : D.textSub }}>
                    {o.label}
                  </span>
                  <span className="block text-[10.5px]" style={{ color: D.textMuted }}>{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="max-w-xs">
          <SectionLabel info="Leave blank to allow any language the assessment permits.">Language</SectionLabel>
          <OSelect
            value={draft.language || ''}
            onChange={(v) => onChange({ language: v })}
            options={[{ value: '', label: 'Any' }, ...LANGUAGES.map((l) => ({ value: l, label: l }))]}
          />
        </div>
      </Step>

      {/* ── 3. Code ── */}
      <Step n={3} title="Code" hint="Starter code (optional) and solution code (required)">
        {draft.starterMode === 'custom' && (
          <div>
            <SectionLabel info="What the editor is pre-filled with when the participant opens the question.">
              Starter Code
            </SectionLabel>
            <textarea
              rows={6} spellCheck={false}
              value={draft.starterCode || ''}
              onChange={(e) => onChange({ starterCode: e.target.value })}
              placeholder="// Code the participant starts from"
              className={codeArea}
              style={{ borderColor: D.border2, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
            />
          </div>
        )}
        <div>
          <SectionLabel required info="A working answer. Used as the reference when grading.">
            Solution Code
          </SectionLabel>
          <textarea
            rows={8} spellCheck={false}
            value={draft.solutionCode || ''}
            onChange={(e) => onChange({ solutionCode: e.target.value })}
            placeholder="// A correct, working solution"
            className={codeArea}
            style={{
              borderColor: errors.solutionCode ? D.red : D.border2,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          />
          {errors.solutionCode && (
            <p className="mt-1 text-[10px] font-medium" style={{ color: D.red }}>{errors.solutionCode}</p>
          )}
        </div>
      </Step>

      {/* ── 4. Test cases ── */}
      <Step n={4} title="Test cases" hint="What the submission is judged against">
        {cases.length === 0 ? (
          <Notice>
            No test cases yet. Add at least one, or the question can only be graded against your
            solution code.
          </Notice>
        ) : (
          <div className="space-y-2">
            {cases.map((c, i) => (
              <div key={i} className="rounded-lg border p-3" style={{ borderColor: D.border2 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold" style={{ color: D.textSub }}>
                    Case {i + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Sample cases are shown to the participant; hidden ones
                        only judge. A case can be neither, which simply means
                        it judges without being advertised. */}
                    <button
                      type="button"
                      onClick={() => setCase(i, { isSample: !c.isSample })}
                      title={c.isSample ? 'Shown to the participant' : 'Not shown'}
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold transition-colors"
                      style={
                        c.isSample
                          ? { background: 'rgba(16,185,129,0.12)', color: D.emerald }
                          : { background: '#f1f5f9', color: D.textMuted }
                      }
                    >
                      {c.isSample ? <Eye size={10} /> : <EyeOff size={10} />} Sample
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ testCases: cases.filter((_, idx) => idx !== i) })}
                      className="inline-flex size-6 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      aria-label={`Remove case ${i + 1}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: D.textMuted }}>Input</label>
                    <textarea
                      rows={2} spellCheck={false} value={c.input}
                      onChange={(e) => setCase(i, { input: e.target.value })}
                      className={codeArea}
                      style={{ borderColor: D.border2, fontFamily: 'ui-monospace, monospace' }}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] mb-1" style={{ color: D.textMuted }}>Expected Output</label>
                    <textarea
                      rows={2} spellCheck={false} value={c.expectedOutput}
                      onChange={(e) => setCase(i, { expectedOutput: e.target.value })}
                      className={codeArea}
                      style={{ borderColor: D.border2, fontFamily: 'ui-monospace, monospace' }}
                    />
                  </div>
                </div>
                <div className="mt-2 max-w-[140px]">
                  <label className="block text-[10px] mb-1" style={{ color: D.textMuted }}>Points</label>
                  <OInput
                    type="number" min={0} step={0.5} value={c.points ?? 0}
                    onChange={(v) => setCase(i, { points: Number(v) })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => onChange({
            testCases: [...cases, { input: '', expectedOutput: '', isSample: cases.length === 0, points: 0 }],
          })}
          className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border text-[11.5px] font-semibold transition-colors"
          style={{ borderColor: D.border2, color: D.textSub }}
        >
          <Plus size={13} /> Add test case
        </button>
        {errors.testCases && (
          <p className="text-[10px] font-medium" style={{ color: D.red }}>{errors.testCases}</p>
        )}
      </Step>

      {/* ── 5. Limits ── */}
      <Step n={5} title="Limits" hint="Ceilings applied to each run">
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <div>
            <SectionLabel info="Seconds one run may take before it is killed.">Time limit (s)</SectionLabel>
            <OInput
              type="number" min={0} max={10000} step={0.5}
              value={draft.timeLimit ?? 2}
              onChange={(v) => onChange({ timeLimit: Number(v) })}
            />
          </div>
          <div>
            <SectionLabel info="Megabytes one run may allocate.">Memory limit (MB)</SectionLabel>
            <OInput
              type="number" min={0} max={1024}
              value={draft.memoryLimit ?? 256}
              onChange={(v) => onChange({ memoryLimit: Number(v) })}
            />
          </div>
        </div>
      </Step>
    </div>
  );
}
