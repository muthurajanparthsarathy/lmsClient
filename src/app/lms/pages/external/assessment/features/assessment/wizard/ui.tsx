'use client';

/**
 * Wizard input kit for the External Assessment create/edit modal.
 *
 * Deliberately mirrors the You_Do wizard's UIComponents.tsx (OInput, OToggle,
 * SectionLabel, InfoTooltip, radio cards) so the two wizards read as one
 * product surface. Rebuilt rather than imported: the You_Do kit lives inside
 * `pages/courses/uploadcourseresources/components/youdo/assessments/`, and
 * importing across that boundary would pull the whole course-pedagogy module
 * into this feature's bundle.
 */

import React, { useState } from 'react';
import { Info, Check, Circle, CheckCircle2, Grid3x3 } from 'lucide-react';

/** The dimensions the AI evaluator can score on — mirrors AI_CRITERIA_OPTIONS. */
export const AI_CRITERIA_OPTIONS = [
  { value: 'correctness', label: 'Correctness' },
  { value: 'codeQuality', label: 'Code Quality' },
  { value: 'efficiency', label: 'Efficiency' },
  { value: 'readability', label: 'Readability' },
  { value: 'edgeCases', label: 'Edge Cases' },
  { value: 'bestPractices', label: 'Best Practices' },
] as const;

// Same palette as the You_Do wizard's `D` tokens (constants.tsx).
export const D = {
  orange: '#E8640C',
  orangeLight: 'rgba(232,100,12,0.10)',
  orangeDark: '#C8520A',
  bg: '#ffffff',
  surface: '#f8fafc',
  border: '#eef0f4',
  border2: '#e5e7eb',
  textMain: '#0F172A',
  textSub: '#334155',
  textMuted: '#475569',
  textHint: '#94A3B8',
  emerald: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
};

/** Hover hint. Plain CSS positioning — no portal, no popper dependency. */
export function InfoTooltip({ content }: { content: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        tabIndex={-1}
        aria-label="More information"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="inline-flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Info size={12} />
      </button>
      {show && (
        <span
          role="tooltip"
          className="absolute left-1/2 bottom-full z-50 mb-1.5 w-56 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-[11px] leading-snug text-white shadow-lg"
          style={{ background: '#1e293b' }}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/** Field label with the optional required star and info hint. */
export function SectionLabel({
  children, required, info,
}: { children: React.ReactNode; required?: boolean; info?: string }) {
  return (
    <div className="flex items-center gap-1 mb-2">
      <span className="text-xs font-semibold" style={{ color: D.textSub }}>{children}</span>
      {required && <span className="text-xs font-bold" style={{ color: D.orange }}>*</span>}
      {info && <InfoTooltip content={info} />}
    </div>
  );
}

const baseField =
  'w-full h-10 px-3 rounded-lg border bg-white text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none transition-colors';

/** Text / number input with the wizard's error+touched treatment. */
export function OInput({
  value, onChange, placeholder, type = 'text', disabled, readOnly,
  error, min, max, step, className = '',
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseField} ${className}`}
        style={{
          borderColor: error ? D.red : D.border2,
          boxShadow: error ? `0 0 0 3px ${D.red}18` : undefined,
        }}
        onFocus={(e) => {
          if (error) return;
          e.currentTarget.style.borderColor = D.orange;
          e.currentTarget.style.boxShadow = `0 0 0 3px ${D.orange}1f`;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? D.red : D.border2;
          e.currentTarget.style.boxShadow = error ? `0 0 0 3px ${D.red}18` : 'none';
        }}
      />
      {error && <p className="mt-1 text-[10px] font-medium" style={{ color: D.red }}>{error}</p>}
    </>
  );
}

/** Native select, styled to match OInput. */
export function OSelect({
  value, onChange, options, disabled, error,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseField} ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
        style={{ borderColor: error ? D.red : D.border2 }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-[10px] font-medium" style={{ color: D.red }}>{error}</p>}
    </>
  );
}

/** Pill switch. Same geometry as the You_Do step toggles (h-6 w-11). */
export function OToggle({
  on, onChange, label, disabled,
}: { on: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{ background: on ? D.orange : '#d1d5db' }}
      >
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-200"
          style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
        />
      </button>
      {label !== undefined && (
        <span className="text-xs font-medium" style={{ color: D.textSub }}>
          {label || (on ? 'Enabled' : 'Disabled')}
        </span>
      )}
    </div>
  );
}

/** One row of the toggle lists used by Security and Notifications. */
export function ToggleRow({
  title, hint, on, onChange, children,
}: {
  title: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: D.border2 }}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold" style={{ color: D.textSub }}>{title}</p>
          {hint && <p className="text-[10px] mt-0.5 leading-snug" style={{ color: D.textMuted }}>{hint}</p>}
        </div>
        <OToggle on={on} onChange={onChange} label="" />
      </div>
      {on && children && <div className="mt-3 pl-1">{children}</div>}
    </div>
  );
}

/** Big selectable card — the Test Type / Question Source pattern. */
export function RadioCard({
  selected, onClick, icon: Icon, title, description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all w-full"
      style={{ borderColor: selected ? D.orange : D.border, background: selected ? D.orangeLight : D.bg }}
    >
      <span
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: selected ? D.orangeLight : D.surface, color: selected ? D.orange : D.textMuted }}
      >
        <Icon size={18} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold" style={{ color: selected ? '#1a1a2e' : D.textSub }}>{title}</span>
        <span className="block text-[11px] mt-0.5" style={{ color: D.textMuted }}>{description}</span>
      </span>
      {selected
        ? <CheckCircle2 size={20} style={{ color: D.orange }} className="flex-shrink-0" />
        : <Circle size={20} style={{ color: '#d1d5db' }} className="flex-shrink-0" />}
    </button>
  );
}

/** Toggleable chip — the Skill Set language picker. */
export function Chip({
  on, onClick, children,
}: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-semibold transition-all"
      style={{
        borderColor: on ? D.orange : D.border2,
        background: on ? D.orangeLight : D.bg,
        color: on ? D.orange : D.textMuted,
      }}
    >
      {on && <Check size={12} strokeWidth={3} />}
      {children}
    </button>
  );
}

/** Step section heading — the divider between field groups inside one step. */
export function StepGroup({
  title, hint, children,
}: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h4 className="text-[13px] font-bold" style={{ color: D.textMain }}>{title}</h4>
        {hint && <p className="text-[11px] mt-0.5" style={{ color: D.textMuted }}>{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Inline notice strip — info (blue) or error (red). */
export function Notice({
  tone = 'info', children,
}: { tone?: 'info' | 'error'; children: React.ReactNode }) {
  const palette = tone === 'error'
    ? { bg: 'rgba(239,68,68,0.07)', border: 'rgba(239,68,68,0.22)', fg: '#b91c1c' }
    : { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.18)', fg: '#1d4ed8' };
  return (
    <div
      className="flex items-start gap-2 rounded-lg px-3 py-2.5"
      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
    >
      <Info size={14} className="mt-px shrink-0" style={{ color: palette.fg }} />
      <p className="text-[12px]" style={{ color: palette.fg }}>{children}</p>
    </div>
  );
}

/** Two-or-more segment switch — the "Common / Per Question" control. */
export function SegmentedControl({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div
      className="inline-flex rounded-lg p-1 w-full"
      style={{ border: `1px solid ${D.border2}`, background: D.surface }}
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex-1 px-3 py-2 rounded-md text-[12.5px] font-semibold transition-colors"
            style={{
              background: on ? '#fff' : 'transparent',
              color: on ? D.orange : D.textMuted,
              boxShadow: on ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Compact pill toggle — the Question Flow control. */
export function PillChoice({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; icon?: React.ElementType }>;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {options.map((o) => {
        const on = value === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-[12.5px] font-semibold transition-all"
            style={{
              borderColor: on ? D.orange : D.border2,
              background: on ? D.orangeLight : '#fff',
              color: on ? D.orange : D.textSub,
            }}
          >
            {Icon && <Icon size={13} />}
            {o.label}
            {on && <Check size={13} strokeWidth={3} />}
          </button>
        );
      })}
    </div>
  );
}

// ─── Code-config arithmetic ───────────────────────────────────────────────
// Exported so the wizard's VALIDATION and this file's DISPLAY compute marks
// the same way. Two copies of this sum is how a step shows "Allocated 100/100"
// in green and then refuses to advance.

const LEVELS = ['easy', 'medium', 'hard'] as const;

/** Which per-level counts a strategy reads. */
const countsFor = (config: any) =>
  (config?.questionConfigType === 'selectionLevel'
    ? config?.selectionLevelCounts
    : config?.levelBasedCounts) || {};

/**
 * What one difficulty level is worth.
 *
 *   level_specific    → marks is PER QUESTION, so total = count × marks
 *   question_specific → marks IS the level total, entered directly
 */
export function levelTotal(config: any, level: (typeof LEVELS)[number]): number {
  const counts = countsFor(config);
  const entry = config?.levelScoring?.[level] || {};
  // Fall back to the pre-grid `levelMarks` so an older config still totals.
  const marks = Number(entry.marks ?? config?.levelMarks?.[level] ?? 0);
  const count = Number(counts?.[level] || 0);
  return entry.scoreType === 'question_specific'
    ? marks
    : Math.round(count * marks * 100) / 100;
}

/** Total questions a code config describes, across every strategy. */
export function codeQuestionCount(config: any): number {
  if (!config) return 0;
  if ((config.questionConfigType || 'general') === 'general') {
    return Number(config.generalQuestionCount || 0);
  }
  const counts = countsFor(config);
  return LEVELS.reduce((sum, l) => sum + Number(counts?.[l] || 0), 0);
}

/**
 * Marks a code config accounts for.
 *
 * General config derives its per-question mark from the paper total, so it is
 * balanced by construction — it reports the full total once it has any
 * questions at all, and 0 when it has none (an empty paper allocates nothing).
 */
export function codeAllocatedMarks(config: any, totalMarks = 0): number {
  if (!config) return 0;
  if ((config.questionConfigType || 'general') === 'general') {
    return Number(config.generalQuestionCount || 0) > 0 ? totalMarks : 0;
  }
  return Math.round(LEVELS.reduce((sum, l) => sum + levelTotal(config, l), 0) * 100) / 100;
}

/** Small marks-allocation readout — the You_Do "Allocated 40/40" chip. */
export function AllocatedBadge({ allocated, total }: { allocated: number; total: number }) {
  if (!total) return null;
  const match = Math.abs(allocated - total) < 0.01;
  const color = match ? D.emerald : D.red;
  return (
    <div className="text-right">
      <div className="text-[10px] font-semibold" style={{ color }}>Allocated</div>
      <div className="text-sm font-bold" style={{ color }}>
        {allocated}
        <span className="text-xs font-normal" style={{ color: D.textMuted }}>/{total}</span>
      </div>
    </div>
  );
}

/**
 * Evaluation Method — the dropdown plus everything AI Based reveals.
 *
 * Mirrors the You_Do EvaluationMethodConfig: picking "AI Based" opens the
 * criteria chips, the Common / Per Question count mode, and the test-case
 * count. `Manual` is offered here (unlike You_Do, which forbids it) because an
 * external paper of essays genuinely is marked by hand — the grader already
 * returns `needsManualReview` for those.
 */
export function EvaluationMethodBlock({
  value, onChange, error, allowManual = true,
}: {
  value: { method: string; ai: { criteria: string[]; testCasesCountMode: string; testCasesCount: number } };
  onChange: (patch: Partial<{ method: string; ai: any }>) => void;
  error?: string;
  allowManual?: boolean;
}) {
  const ai = value.ai || { criteria: [], testCasesCountMode: 'common', testCasesCount: 20 };

  const toggleCriterion = (c: string) => {
    const has = ai.criteria.includes(c);
    onChange({ ai: { ...ai, criteria: has ? ai.criteria.filter((x: string) => x !== c) : [...ai.criteria, c] } });
  };

  const methods = [
    { value: 'testcase', label: 'Test Case Based' },
    { value: 'ai', label: 'AI Based' },
    ...(allowManual ? [{ value: 'manual', label: 'Manual (marked by hand)' }] : []),
  ];

  return (
    <div className="space-y-3">
      <div>
        <SectionLabel required info="How submissions are judged. Test Case Based runs the answer against expected outputs; AI Based scores it against the criteria you pick.">
          Evaluation Method
        </SectionLabel>
        <OSelect value={value.method} onChange={(v) => onChange({ method: v })} options={methods} />
      </div>

      {value.method === 'ai' && (
        <>
          <div>
            <SectionLabel required info="What the AI evaluator should judge submissions on. Tick one or more.">
              Evaluation Criteria
            </SectionLabel>
            <div className="flex flex-wrap gap-2">
              {AI_CRITERIA_OPTIONS.map((c) => (
                <Chip key={c.value} on={ai.criteria.includes(c.value)} onClick={() => toggleCriterion(c.value)}>
                  {c.label}
                </Chip>
              ))}
            </div>
            {/* The You_Do form shows this the moment AI is picked with nothing
                ticked, rather than waiting for a Next — an empty criteria list
                is the one way an AI-graded paper cannot be scored at all. */}
            {ai.criteria.length === 0 && (
              <div className="mt-2">
                <Notice tone="error">Select at least one criterion for the AI evaluator.</Notice>
              </div>
            )}
          </div>

          <div>
            <SectionLabel required info="Whether one test-case count covers the whole exercise, or each question sets its own.">
              AI Test Cases Count
            </SectionLabel>
            <SegmentedControl
              value={ai.testCasesCountMode}
              onChange={(v) => onChange({ ai: { ...ai, testCasesCountMode: v } })}
              options={[
                { value: 'common', label: 'Common (one for the exercise)' },
                { value: 'perQuestion', label: "Per Question (each question's own count)" },
              ]}
            />
          </div>

          {ai.testCasesCountMode === 'common' && (
            <div>
              <SectionLabel info="How many cases the AI generates and judges against.">AI Test Cases</SectionLabel>
              <div className="max-w-[240px]">
                <OInput
                  type="number" min={0} max={50}
                  value={ai.testCasesCount ?? 20}
                  // Clamp on the way in — the server caps at 50 and a rejected
                  // save four steps later is a poor way to learn that.
                  onChange={(v) => onChange({ ai: { ...ai, testCasesCount: Math.min(50, Math.max(0, Number(v) || 0)) } })}
                />
              </div>
              <div className="mt-2">
                <Notice>Judged alongside any test cases already on the question. Max 50.</Notice>
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="text-[10px] font-medium" style={{ color: D.red }}>{error}</p>}
    </div>
  );
}

/**
 * Programming / Other question configuration.
 *
 * One component for both, because the LMS ships two near-identical files
 * (ProgrammingConfiguration.tsx and OthersConfiguration.tsx) that differ only
 * in their heading and which formData key they write. Parameterising the
 * heading and the value/onChange pair collapses that duplication.
 */
export function CodeConfigBlock({
  title, icon: Icon, config, onChange, totalMarks, errors = {},
}: {
  title: string;
  icon: React.ElementType;
  config: any;
  onChange: (key: string, value: any) => void;
  totalMarks: number;
  errors?: Record<string, string>;
}) {
  const type = config.questionConfigType || 'general';
  const counts = type === 'selectionLevel' ? (config.selectionLevelCounts || {}) : (config.levelBasedCounts || {});
  const countsKey = type === 'selectionLevel' ? 'selectionLevelCounts' : 'levelBasedCounts';
  const scoring = config.levelScoring || {};

  const questionCount = codeQuestionCount(config);
  const allocated = codeAllocatedMarks(config, totalMarks);
  // General config derives its per-question mark from the paper total, so it
  // is balanced by construction; the level grid is where marks can drift.
  const autoPerQuestion = questionCount > 0 && totalMarks > 0
    ? Math.round((totalMarks / questionCount) * 100) / 100
    : 0;
  const mismatch = type !== 'general' && totalMarks > 0 && Math.abs(allocated - totalMarks) > 0.01;

  const levelTone: Record<string, string> = { easy: D.emerald, medium: D.amber, hard: D.red };
  const levelBg: Record<string, string> = {
    easy: 'rgba(16,185,129,0.07)',
    medium: 'rgba(245,158,11,0.09)',
    hard: 'rgba(239,68,68,0.07)',
  };

  return (
    <div className="rounded-xl border bg-white" style={{ borderColor: D.border, padding: '16px 18px' }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: D.orangeLight, color: D.orange }}
          >
            <Icon size={16} />
          </span>
          <h4 className="text-[15px] font-bold leading-tight" style={{ color: D.textMain }}>{title}</h4>
        </div>
        {/* Shown for EVERY strategy, not just the level grid — an author on
            General still wants to see that the paper adds up. */}
        <AllocatedBadge allocated={allocated} total={totalMarks} />
      </div>

      {mismatch && (
        <div className="mb-3">
          <Notice tone="error">
            Level totals sum to <strong>{allocated}</strong> but total is <strong>{totalMarks}</strong>.
          </Notice>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <SectionLabel info="General: one flat question count. Level Based: split across Easy/Medium/Hard. Selection Level: pick which levels are in play.">
            Config Strategy
          </SectionLabel>
          <OSelect
            value={type}
            onChange={(v) => onChange('questionConfigType', v)}
            options={[
              { value: 'general', label: 'General Configuration' },
              { value: 'levelBased', label: 'Level Based Configuration' },
              { value: 'selectionLevel', label: 'Selection Level Configuration' },
            ]}
          />
        </div>

        {type === 'general' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SectionLabel required info="Total number of questions of this kind.">Total Questions</SectionLabel>
              <OInput
                type="number" min={0}
                value={config.generalQuestionCount ?? 0}
                onChange={(v) => onChange('generalQuestionCount', Number(v))}
                error={errors.generalQuestionCount}
              />
            </div>
            <div>
              <SectionLabel info="Derived from the paper's total marks and the question count.">
                Marks Per Question
              </SectionLabel>
              <div className="relative">
                <OInput value={autoPerQuestion} onChange={() => {}} readOnly disabled
                  className="cursor-not-allowed bg-slate-50 pr-16" />
                <span
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-[11px] font-bold pointer-events-none"
                  style={{ color: D.orange }}
                >
                  Auto
                </span>
              </div>
              {totalMarks > 0 && questionCount > 0 && (
                <p className="text-[11px] mt-1" style={{ color: D.textMuted }}>
                  {totalMarks} ÷ {questionCount} = <strong style={{ color: D.textMain }}>{autoPerQuestion}</strong>
                </p>
              )}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Grid3x3 size={13} style={{ color: D.textMuted }} />
              <span className="text-xs font-semibold" style={{ color: D.textSub }}>
                Questions and Scoring Configuration
              </span>
              <InfoTooltip content="How many questions at each difficulty and what they are worth. Level-specific means the Marks figure is per question; Question-specific means it is the level's total." />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr>
                    <th className="text-left text-[10.5px] font-semibold pb-2 pr-3" style={{ color: D.textMuted }} />
                    {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                      <th key={lvl} className="text-left text-[11px] font-bold pb-2 px-1 capitalize"
                        style={{ color: levelTone[lvl] }}>
                        {lvl}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="text-[11px] font-semibold py-1 pr-3 whitespace-nowrap" style={{ color: D.textSub }}>
                      Questions
                    </td>
                    {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                      <td key={lvl} className="py-1 px-1">
                        <OInput type="number" min={0} value={counts?.[lvl] ?? 0}
                          onChange={(v) => onChange(countsKey, { ...counts, [lvl]: Number(v) })} />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-[11px] font-semibold py-1 pr-3 whitespace-nowrap" style={{ color: D.textSub }}>
                      Score Type
                    </td>
                    {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                      <td key={lvl} className="py-1 px-1">
                        <OSelect
                          value={scoring?.[lvl]?.scoreType || 'level_specific'}
                          onChange={(v) => onChange('levelScoring', {
                            ...scoring, [lvl]: { ...(scoring?.[lvl] || {}), scoreType: v },
                          })}
                          options={[
                            { value: 'level_specific', label: 'Level-specific' },
                            { value: 'question_specific', label: 'Question-specific' },
                          ]}
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-[11px] font-semibold py-1 pr-3 whitespace-nowrap" style={{ color: D.textSub }}>
                      Marks
                    </td>
                    {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                      <td key={lvl} className="py-1 px-1">
                        <OInput
                          type="number" min={0} step={0.5}
                          value={scoring?.[lvl]?.marks ?? config.levelMarks?.[lvl] ?? 0}
                          onChange={(v) => onChange('levelScoring', {
                            ...scoring, [lvl]: { ...(scoring?.[lvl] || {}), marks: Number(v) },
                          })}
                        />
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="text-[11px] font-semibold py-1 pr-3 whitespace-nowrap" style={{ color: D.textSub }}>
                      Total
                    </td>
                    {(['easy', 'medium', 'hard'] as const).map((lvl) => (
                      <td key={lvl} className="py-1 px-1">
                        <div
                          className="h-9 rounded-lg flex items-center justify-center text-[12px] font-bold"
                          style={{ background: levelBg[lvl], color: levelTone[lvl] }}
                        >
                          {levelTotal(config, lvl)} marks
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {errors.levelCounts && (
              <p className="mt-1.5 text-[10px] font-medium" style={{ color: D.red }}>{errors.levelCounts}</p>
            )}
          </div>
        )}

        {/* Allowed Languages was here. Removed on request: the languages a
            paper covers are already picked once as the Skill Set on Step 1,
            and asking again per config block only invited the two to disagree. */}

        <div>
          <SectionLabel info="Free Flow lets participants jump around; Controlled forces a sequence.">
            Question Flow
          </SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: 'freeFlow', t: 'Free Flow', d: 'Any order' },
              { v: 'controlled', t: 'Controlled Flow', d: 'Set sequence' },
            ]).map((o) => {
              const on = (config.questionFlow || 'freeFlow') === o.v;
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => onChange('questionFlow', o.v)}
                  className="px-3 py-2.5 rounded-lg border-2 text-left transition-all"
                  style={{ borderColor: on ? D.orange : D.border, background: on ? D.orangeLight : '#fff' }}
                >
                  <span className="block text-xs font-bold" style={{ color: on ? D.orange : D.textSub }}>{o.t}</span>
                  <span className="block text-[10px] mt-0.5" style={{ color: D.textMuted }}>{o.d}</span>
                </button>
              );
            })}
          </div>
        </div>

        <ToggleRow
          title="Attempt limit"
          hint="Cap how many times a participant may submit this half."
          on={!!config.attemptLimitEnabled}
          onChange={(v) => onChange('attemptLimitEnabled', v)}
        >
          <div className="max-w-[180px]">
            <SectionLabel>Attempts allowed</SectionLabel>
            <OInput
              type="number" min={1} max={10}
              value={config.submissionAttempts ?? 1}
              onChange={(v) => onChange('submissionAttempts', Number(v))}
            />
          </div>
        </ToggleRow>
      </div>
    </div>
  );
}
