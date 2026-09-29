import { SettingsHelp } from '../SettingsHelp';
import React, { useEffect, useRef, useState } from 'react';
import styles from '../AssignmentSettings.module.css';
import TipTapEditor from '../../tiptopEditor';

// 2026-08-30 REDESIGN: matches the "Exercise setup" mockup — orange section
// titles with a hairline divider, three semantic groups (Identity, Format,
// Learning focus), radio-card Grading, chip-input Skills. Every wired field
// from the previous cards layout is preserved (Exercise ID, Name, Type,
// Difficulty, Duration, Grading, Skills, Total Marks, Description); only the
// visual chrome changed.

// Static catalogue used to render the configured-languages chips. Kept
// step-local so this file is self-contained; the parent has the same data.
const moduleLanguages: Record<string, { name: string; icon: string }[]> = {
  'Core Programming': [
    { name: 'C',      icon: '/active-images/c.png' },
    { name: 'C++',    icon: '/active-images/cpp.png' },
    { name: 'Java',   icon: '/active-images/java.png' },
    { name: 'Python', icon: '/active-images/python.png' },
    { name: 'C#',     icon: '/active-images/csharp.png' },
  ],
  Frontend: [
    { name: 'HTML',       icon: '/active-images/html.png' },
    { name: 'CSS',        icon: '/active-images/css.png' },
    { name: 'JavaScript', icon: '/active-images/javascript.png' },
    { name: 'Bootstrap',  icon: '/active-images/bootstrap.png' },
    { name: 'TypeScript', icon: '/active-images/typescript.png' },
    { name: 'React',      icon: '/active-images/react.png' },
  ],
  Database: [
    { name: 'SQL',     icon: '/active-images/sql.png' },
    { name: 'MongoDB', icon: '/active-images/mongodb.png' },
  ],
};

const MC = { orange: '#EE6A22', text: '#263746', readonly: '#eef0f2' };

function FormRow({ label, htmlFor, help, required, children, error, editor }: {
  label: string; htmlFor?: string; help?: string; required?: boolean;
  children: React.ReactNode; error?: string; editor?: boolean;
}) {
  return <div className={styles.fieldRow}>
    <div className={styles.fieldLabel}>
      <label htmlFor={htmlFor}>{label}{required && <span className={styles.required} aria-label="required">*</span>}</label>
      {help && <SettingsHelp content={help} />}
    </div>
    <div className={`${styles.fieldControl} ${editor ? styles.editorField : ''}`}>
      {children}
      {error && <p className={styles.fieldError} role="alert">{error}</p>}
    </div>
  </div>;
}

function FormSelect({ id, value, options, onChange, onBlur, disabled, width = 250 }: {
  id: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; onBlur?: () => void; disabled?: boolean; width?: number;
}) {
  return <span className={styles.selectControl} style={{ width }}>
    <select id={id} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} onBlur={onBlur}>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <span className={styles.selectArrows} aria-hidden="true" />
  </span>;
}

// ─── NumField — 40px numeric input matching the Duration field ──────────────
// Used for Total marks / MCQ marks / Programming marks so those inputs share
// the same visual weight as Duration. Debounces to blur (parses + clamps) —
// live typing is preserved so admins can enter multi-digit values without
// interruption.
const NumField: React.FC<{
  value: number;
  onChange: (v: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  min?: number;
  max?: number;
}> = ({ value, onChange, onBlur, placeholder, error, disabled, id, min = 0, max = 10000 }) => {
  const [raw, setRaw] = useState<string>(value === 0 ? '' : String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setRaw(value === 0 ? '' : String(value));
    }
  }, [value]);
  const commit = () => {
    const n = parseFloat(raw);
    const clamped = isNaN(n) ? 0 : Math.min(max, Math.max(min, n));
    if (clamped !== value) onChange(clamped);
    setRaw(clamped === 0 ? '' : (clamped % 1 === 0 ? String(clamped) : clamped.toFixed(2)));
    onBlur?.();
  };
  const bump = (delta: number) => {
    if (disabled) return;
    const parsed = parseFloat(raw);
    const base = isNaN(parsed) ? 0 : parsed;
    const next = Math.min(max, Math.max(min, base + delta));
    if (next === base) return;
    setRaw(next === 0 ? '' : (next % 1 === 0 ? String(next) : next.toFixed(2)));
    onChange(next);
  };
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="decimal"
        value={raw}
        disabled={disabled}
        placeholder={placeholder}
        onChange={e => { const v = e.target.value; if (v === '' || /^[0-9]*\.?[0-9]*$/.test(v)) { setRaw(v); onChange(Math.min(max, Math.max(min, Number(v) || 0))); } }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        onFocus={e => {
          const el = e.currentTarget;
          el.style.borderColor = MC.orange;
          el.style.boxShadow = '0 0 0 3px rgba(77,149,213,0.2)';
        }}
        onBlurCapture={e => {
          const el = e.currentTarget;
          el.style.borderColor = error ? '#F04438' : '#8f959e';
          el.style.boxShadow = 'none';
        }}
        style={{
          width: 120, height: 45, borderRadius: 4,
          padding: '0 34px 0 15px', fontSize: 18, color: MC.text,
          border: `1px solid ${error ? '#F04438' : '#D0D5DD'}`,
          background: disabled ? MC.readonly : error ? '#FFFBFA' : '#FFFFFF',
          outline: 'none', boxSizing: 'border-box', transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
      />
      <div style={{
        position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
        display: 'flex', flexDirection: 'column', lineHeight: 1,
      }}>
        <button type="button" tabIndex={-1} aria-label="Increment"
          onMouseDown={e => { e.preventDefault(); bump(1); }}
          disabled={disabled}
          style={{
            padding: 0, margin: 0, width: 14, height: 12, border: 'none', background: 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer', color: '#57606E',
          }}
          onMouseOver={e => { if (!disabled) e.currentTarget.style.color = '#EE6A22'; }}
          onMouseOut={e => { e.currentTarget.style.color = '#57606E'; }}>
          <svg width="9" height="6" viewBox="0 0 8 5" fill="currentColor"><path d="M4 0L8 5H0z" /></svg>
        </button>
        <button type="button" tabIndex={-1} aria-label="Decrement"
          onMouseDown={e => { e.preventDefault(); bump(-1); }}
          disabled={disabled}
          style={{
            padding: 0, margin: 0, width: 14, height: 12, border: 'none', background: 'transparent',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer', color: '#57606E',
          }}
          onMouseOver={e => { if (!disabled) e.currentTarget.style.color = '#EE6A22'; }}
          onMouseOut={e => { e.currentTarget.style.color = '#57606E'; }}>
          <svg width="9" height="6" viewBox="0 0 8 5" fill="currentColor"><path d="M4 5L0 0H8z" /></svg>
        </button>
      </div>
    </div>
  );
};

interface ExerciseDetailsStepProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  validationErrors: any;
  setValidationErrors: React.Dispatch<React.SetStateAction<any>>;
  touchedFields: Set<string>;
  markTouched: (field: string) => void;
  handleSelectExerciseType: (type: 'MCQ' | 'Programming' | 'Combined' | 'Other') => void;
  configuredLanguages?: { coreProgram?: string[]; frontend?: string[]; database?: string[] };
  isLockedForEdit: boolean;
  steps: Array<{ id: number; title: string }>;
  savedSteps: Set<string>;
}

export const ExerciseDetailsStep: React.FC<ExerciseDetailsStepProps> = ({
  formData,
  setFormData,
  validationErrors,
  setValidationErrors,
  touchedFields,
  markTouched,
  handleSelectExerciseType,
  configuredLanguages,
  isLockedForEdit,
  steps,
  savedSteps,
}) => {
  const isCombined = formData.exerciseType === 'Combined';
  const combinedTotal = formData.totalMarksMCQ + formData.totalMarksProgramming;
  const isGraded = formData.isGraded !== false;

  // Build the chip list for the Skills row from configuredLanguages. Preserved
  // verbatim from the previous impl — the alias table catches lowercase / short
  // forms so old data still resolves an icon.
  const buildConfiguredLangList = () => {
    if (!configuredLanguages) return [];
    const allIconEntries = [
      ...moduleLanguages['Core Programming'],
      ...moduleLanguages['Frontend'],
      ...moduleLanguages['Database'],
    ];
    const langAliases: Record<string, string> = {
      js: 'JavaScript', ts: 'TypeScript', css: 'CSS', html: 'HTML',
      react: 'React', bootstrap: 'Bootstrap', sql: 'SQL',
      mongodb: 'MongoDB', c: 'C', 'c++': 'C++', java: 'Java',
      python: 'Python', 'c#': 'C#',
    };
    const findIcon = (name: string) => {
      const searchName = langAliases[name.toLowerCase()] || name;
      return allIconEntries.find(l => l.name.toLowerCase() === searchName.toLowerCase())?.icon || '';
    };
    const result: { name: string; icon: string; category: string }[] = [];
    for (const [category, key] of [['Core Programming', 'coreProgram'], ['Frontend', 'frontend'], ['Database', 'database']] as [string, string][]) {
      const names: string[] = (configuredLanguages as any)[key] || [];
      for (const name of names) result.push({ name, icon: findIcon(name), category });
    }
    return result;
  };
  const allLangs = buildConfiguredLangList();

  const allStepsSaved = steps.length > 0 && steps.every(s => savedSteps.has(s.title));
  const gradedLocked = allStepsSaved;

  const errorFor = (field: string) => touchedFields.has(field) ? validationErrors[field] : undefined;
  const clearError = (field: string) => setValidationErrors((previous: any) => {
    const next = { ...previous }; delete next[field]; return next;
  });

  return <div className={styles.generalFields}>
    <FormRow label="Assignment ID" htmlFor="exercise-id" help="Auto-generated unique identifier for this assignment">
      <input id="exercise-id" className={styles.shortInput} value={formData.exerciseId || ''} readOnly />
      <p className={styles.fieldNote}>Created automatically</p>
    </FormRow>
    <FormRow label="Assignment name" required htmlFor="exercise-name"
      help="The name displayed to students in their dashboard" error={errorFor('exerciseName')}>
      <input id="exercise-name" className={styles.textInput} value={formData.exerciseName || ''}
        placeholder="e.g. Advanced Algorithms" aria-invalid={!!errorFor('exerciseName')}
        onChange={event => {
          const value = event.target.value;
          setFormData((previous: any) => ({ ...previous, exerciseName: value }));
          if (value.trim()) clearError('exerciseName');
        }} onBlur={() => markTouched('exerciseName')} />
    </FormRow>
    <FormRow label="Assignment type" required htmlFor="exercise-type"
      help="Choose multiple choice, programming, combined, or a custom assignment" error={errorFor('exerciseType')}>
      <FormSelect id="exercise-type" value={formData.exerciseType || ''} disabled={isLockedForEdit} width={280}
        options={[{ value: '', label: 'Select type' }, { value: 'MCQ', label: 'Multiple choice (MCQ)' },
          { value: 'Programming', label: 'Programming' }, { value: 'Combined', label: 'Combined' }, { value: 'Other', label: 'Other' }]}
        onChange={value => { handleSelectExerciseType(value as 'MCQ' | 'Programming' | 'Combined' | 'Other'); if (value) clearError('exerciseType'); }}
        onBlur={() => markTouched('exerciseType')} />
    </FormRow>
    <FormRow label="Difficulty" required htmlFor="exercise-level" help="The challenge level of this assignment" error={errorFor('exerciseLevel')}>
      <FormSelect id="exercise-level" value={formData.exerciseLevel || ''} width={200}
        options={[{ value: '', label: 'Select level' }, { value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'expert', label: 'Expert' }]}
        onChange={value => { setFormData((previous: any) => ({ ...previous, exerciseLevel: value })); if (value) clearError('exerciseLevel'); }}
        onBlur={() => markTouched('exerciseLevel')} />
    </FormRow>
    <FormRow label="Duration" required htmlFor="exercise-duration" help="Total time allowed in minutes" error={errorFor('totalDuration')}>
      <div className={styles.inlineControls}>
        <input id="exercise-duration" type="number" className={styles.numberInput} min={0} value={formData.totalDuration || ''}
          onChange={event => {
            const value = Number(event.target.value) || 0;
            setFormData((previous: any) => ({ ...previous, totalDuration: value }));
            if (value > 0) clearError('totalDuration');
          }} onBlur={() => markTouched('totalDuration')} />
        <span>minutes</span>
      </div>
    </FormRow>
    <FormRow label="Grading" htmlFor="exercise-grading" help="Graded assignments record marks; non-graded assignments track completion">
      <FormSelect id="exercise-grading" value={isGraded ? 'graded' : 'non-graded'} disabled={gradedLocked} width={190}
        options={[{ value: 'non-graded', label: 'Non-graded' }, { value: 'graded', label: 'Graded' }]}
        onChange={value => {
          const graded = value === 'graded';
          setFormData((previous: any) => ({ ...previous, isGraded: graded,
            ...(graded ? {} : { totalMarks: 0, totalMarksMCQ: 0, totalMarksProgramming: 0 }) }));
        }} />
      {gradedLocked && <p className={styles.fieldNote}>Grading type cannot be changed after the assignment has been fully completed.</p>}
      {!gradedLocked && !isGraded && <p className={styles.fieldNote}>Grade settings are hidden for non-graded assignments.</p>}
    </FormRow>
    {isGraded && <FormRow label={isCombined ? 'Marks (MCQ + Programming)' : 'Total marks'} required
      htmlFor={isCombined ? 'exercise-mcq-marks' : 'exercise-total-marks'}
      help="Maximum marks a student can score" error={errorFor('totalMarks') || errorFor('totalMarksMCQ') || errorFor('totalMarksProgramming')}>
      {!isCombined ? <NumField id="exercise-total-marks" value={formData.totalMarks}
        onChange={value => { setFormData((previous: any) => ({ ...previous, totalMarks: value })); if (value > 0) clearError('totalMarks'); }}
        onBlur={() => markTouched('totalMarks')} placeholder="100" error={!!errorFor('totalMarks')} /> :
        <div className={styles.inlineControls}>
          <label htmlFor="exercise-mcq-marks">MCQ</label>
          <NumField id="exercise-mcq-marks" value={formData.totalMarksMCQ}
            onChange={value => { setFormData((previous: any) => ({ ...previous, totalMarksMCQ: value, totalMarks: value + previous.totalMarksProgramming })); if (value > 0) clearError('totalMarksMCQ'); }}
            onBlur={() => markTouched('totalMarksMCQ')} error={!!errorFor('totalMarksMCQ')} />
          <label htmlFor="exercise-programming-marks">Programming</label>
          <NumField id="exercise-programming-marks" value={formData.totalMarksProgramming}
            onChange={value => { setFormData((previous: any) => ({ ...previous, totalMarksProgramming: value, totalMarks: previous.totalMarksMCQ + value })); if (value > 0) clearError('totalMarksProgramming'); }}
            onBlur={() => markTouched('totalMarksProgramming')} error={!!errorFor('totalMarksProgramming')} />
          <span>{combinedTotal} marks total</span>
        </div>}
    </FormRow>}
    <FormRow label="Skills" help="Skills are configured in Topic Settings">
      <div className={styles.inlineControls}>
        {allLangs.length === 0 && <span className={styles.fieldNote}>No skills configured. Set them in Topic Settings.</span>}
        {allLangs.map(language => <span key={language.name} className={styles.skill}>
          {language.icon && <img src={language.icon} alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />}
          {language.name}
        </span>)}
      </div>
    </FormRow>
    <FormRow label="Description" help="Description shown to students before they start" editor>
      <TipTapEditor value={formData.description}
        onChange={(value: string) => setFormData((previous: any) => ({ ...previous, description: value }))}
        placeholder="Enter a brief description…" minHeight="150px" maxHeight="300px" showToolbar editable />
    </FormRow>
    <FormRow label="Instructions" help="Optional guidance shown on the student pre-start page" editor>
      <TipTapEditor value={formData.instructions || ''}
        onChange={(value: string) => setFormData((previous: any) => ({ ...previous, instructions: value }))}
        placeholder="Enter assignment instructions…" minHeight="150px" maxHeight="300px" showToolbar editable />
    </FormRow>
  </div>;
};
