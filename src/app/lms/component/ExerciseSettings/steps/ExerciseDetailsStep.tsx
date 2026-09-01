import React from 'react';
import { AlertCircle, Check, Info, Plus, X } from 'lucide-react';
import { D } from '../shared/tokens';
import { InfoTooltip, OInput, ONumberInput } from '../shared/UIComponents';
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

// Mockup design tokens — hard-coded here so the redesign matches the spec
// even where the shared `D` token map uses a slightly different shade.
const MC = {
  orange:   '#FF5A12',
  orangeTint: '#FFF4EE',
  text:     '#101828',
  sub:      '#667085',
  border:   '#E4E7EC',
  readonly: '#F7F7F8',
};

// Section heading — orange label + thin horizontal divider extending to the
// right. Compacted 2026-08-30 (was 14px / 20px margin) so section headers
// don't dominate the form.
const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 10px' }}>
    <span style={{ fontSize: 12, fontWeight: 700, color: MC.orange, letterSpacing: '-.01em', whiteSpace: 'nowrap', textTransform: 'none' }}>
      {children}
    </span>
    <span aria-hidden style={{ flex: 1, height: 1, background: MC.border }} />
  </div>
);

// Field label — always above the control. Compacted to 11.5px / 500 weight.
const FieldLabel: React.FC<{ children: React.ReactNode; required?: boolean; info?: string; htmlFor?: string }> = ({
  children, required, info, htmlFor,
}) => (
  <label htmlFor={htmlFor} style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
    <span style={{ fontSize: 11.5, fontWeight: 600, color: MC.text }}>{children}</span>
    {required && <span aria-label="required" style={{ fontSize: 11.5, fontWeight: 700, color: MC.orange }}>*</span>}
    {info && <InfoTooltip content={info} />}
  </label>
);

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

  const exerciseTypeOptions = [
    { value: 'MCQ',         label: 'MCQ — Multiple Choice Questions (auto-graded)' },
    { value: 'Programming', label: 'Programming — Code challenges with test cases' },
    { value: 'Combined',    label: 'Combined — MCQ + Programming (hybrid)' },
    { value: 'Other',       label: 'Other — Custom exercise with module & language config' },
  ];

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

  const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23667085' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`;

  // Compact control styling — 40px height, 13px text, 7px radius.
  // 2026-08-30 tightened from 48px/14px to match the user's "smaller /
  // more compact" ask.
  const selectBaseStyle: React.CSSProperties = {
    width: '100%', height: 40, borderRadius: 7, padding: '0 34px 0 12px',
    fontSize: 13, color: MC.text, border: `1px solid #D0D5DD`, background: '#fff',
    appearance: 'none', WebkitAppearance: 'none', outline: 'none',
    backgroundImage: chevronBg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
  };

  return (
    // Compact workspace — 16px top padding, 32px horizontal, capped at 1200px
    // so very-wide monitors don't stretch fields across the full viewport.
    <div style={{ padding: '16px 32px 24px', maxWidth: 1200 }}>
      <style>{`
        .exd-input, .exd-select {
          width: 100%; height: 40px; border-radius: 7px; padding: 0 12px;
          font-size: 13px; color: ${MC.text}; border: 1px solid #D0D5DD;
          background: #fff; outline: none; box-sizing: border-box;
        }
        .exd-input::placeholder, .exd-select::placeholder { color: #98A2B3; font-size: 13px; }
        .exd-input:focus, .exd-select:focus {
          border-color: ${MC.orange};
          box-shadow: 0 0 0 3px rgba(255,90,18,.13);
        }
        .exd-input:disabled { background: ${MC.readonly}; color: ${MC.sub}; cursor: not-allowed; }
        .exd-input.err { border-color: #F04438; background: #FFFBFA; }
      `}</style>

      {/* Page title — compacted from 28px to 20px per user note. */}
      <h1 style={{ fontSize: 20, fontWeight: 700, color: MC.text, letterSpacing: '-.02em', margin: '0 0 14px' }}>
        Exercise setup
      </h1>

      {/* ── Identity ── */}
      <SectionHeading>Identity</SectionHeading>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 24%) minmax(0, 1fr)', gap: 20, marginBottom: 16 }}>
        <div>
          <FieldLabel htmlFor="exercise-id" info="Auto-generated unique identifier for this exercise">
            Exercise ID
          </FieldLabel>
          <input
            id="exercise-id"
            className="exd-input"
            value={formData.exerciseId || ''}
            readOnly
            style={{ background: MC.readonly, color: MC.text, fontWeight: 500 }}
          />
          <p style={{ marginTop: 6, fontSize: 12, color: MC.sub }}>Created automatically</p>
        </div>
        <div>
          <FieldLabel htmlFor="exercise-name" required info="The name displayed to students in their dashboard">
            Exercise name
          </FieldLabel>
          <input
            id="exercise-name"
            className={`exd-input${validationErrors.exerciseName && touchedFields.has('exerciseName') ? ' err' : ''}`}
            value={formData.exerciseName || ''}
            placeholder="e.g. Advanced Algorithms"
            onChange={e => {
              const v = e.target.value;
              setFormData((prev: any) => ({ ...prev, exerciseName: v }));
              if (v.trim()) setValidationErrors((prev: any) => { const n = { ...prev }; delete n.exerciseName; return n; });
            }}
            onBlur={() => markTouched('exerciseName')}
          />
          {validationErrors.exerciseName && touchedFields.has('exerciseName') && (
            <p style={{ marginTop: 6, fontSize: 12, color: '#B42318', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={12} /> {validationErrors.exerciseName}
            </p>
          )}
        </div>
      </div>

      {/* ── Format ── */}
      <SectionHeading>Format</SectionHeading>
      <div style={{
        display: 'grid',
        gridTemplateColumns: isGraded ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
        gap: 16, marginBottom: 16,
      }}>
        <div>
          <FieldLabel htmlFor="exercise-type" required info="MCQ, Programming, Combined, or Other — decides the question authoring surface">
            Exercise type
          </FieldLabel>
          <select
            id="exercise-type"
            value={formData.exerciseType || ''}
            onChange={e => {
              const v = e.target.value as any;
              handleSelectExerciseType(v);
              if (v) setValidationErrors((prev: any) => { const n = { ...prev }; delete n.exerciseType; return n; });
            }}
            onBlur={() => markTouched('exerciseType')}
            disabled={isLockedForEdit}
            style={{
              ...selectBaseStyle,
              ...(validationErrors.exerciseType && touchedFields.has('exerciseType')
                ? { borderColor: '#F04438', background: '#FFFBFA' }
                : {}),
              color: formData.exerciseType ? MC.text : '#98A2B3',
              background: isLockedForEdit ? MC.readonly : '#fff',
              cursor: isLockedForEdit ? 'not-allowed' : 'pointer',
              backgroundImage: chevronBg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center',
            }}
          >
            <option value="" disabled>Select type</option>
            {exerciseTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {isLockedForEdit && (
            <p style={{ marginTop: 6, fontSize: 12, color: MC.sub }}>Exercise type cannot be changed after creation</p>
          )}
          {validationErrors.exerciseType && touchedFields.has('exerciseType') && (
            <p style={{ marginTop: 6, fontSize: 12, color: '#B42318', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={12} /> {validationErrors.exerciseType}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="exercise-level" required info="Sets the challenge level — affects filtering and student guidance">
            Difficulty
          </FieldLabel>
          <select
            id="exercise-level"
            value={formData.exerciseLevel || ''}
            onChange={e => {
              setFormData((prev: any) => ({ ...prev, exerciseLevel: e.target.value as any }));
              if (e.target.value) setValidationErrors((prev: any) => { const n = { ...prev }; delete n.exerciseLevel; return n; });
            }}
            onBlur={() => markTouched('exerciseLevel')}
            style={{
              ...selectBaseStyle,
              ...(validationErrors.exerciseLevel && touchedFields.has('exerciseLevel')
                ? { borderColor: '#F04438', background: '#FFFBFA' }
                : {}),
              color: formData.exerciseLevel ? MC.text : '#98A2B3',
              cursor: 'pointer',
            }}
          >
            <option value="" disabled hidden>Select level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="expert">Expert</option>
          </select>
          {validationErrors.exerciseLevel && touchedFields.has('exerciseLevel') && (
            <p style={{ marginTop: 6, fontSize: 12, color: '#B42318', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={12} /> {validationErrors.exerciseLevel}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="exercise-duration" required info="Total time allowed in minutes">
            Duration
          </FieldLabel>
          {/* Number input + integrated 'min' suffix on the right, separated
              by a hairline divider — matches the mockup exactly. */}
          <div style={{
            display: 'flex', alignItems: 'stretch', height: 40, borderRadius: 7,
            border: `1px solid ${validationErrors.totalDuration && touchedFields.has('totalDuration') ? '#F04438' : '#D0D5DD'}`,
            background: '#fff', overflow: 'hidden',
          }}>
            <input
              id="exercise-duration"
              type="number"
              min={0}
              value={formData.totalDuration || ''}
              placeholder="60"
              onChange={e => {
                const v = Number(e.target.value) || 0;
                setFormData((prev: any) => ({ ...prev, totalDuration: v }));
                if (v > 0) setValidationErrors((prev: any) => { const n = { ...prev }; delete n.totalDuration; return n; });
              }}
              onBlur={() => markTouched('totalDuration')}
              style={{
                flex: 1, minWidth: 0, height: '100%', padding: '0 12px',
                fontSize: 13, color: MC.text, border: 'none', outline: 'none', background: 'transparent',
              }}
            />
            <span aria-hidden style={{
              display: 'inline-flex', alignItems: 'center', padding: '0 12px',
              borderLeft: `1px solid ${MC.border}`, background: MC.readonly,
              fontSize: 12, fontWeight: 600, color: MC.sub,
            }}>
              min
            </span>
          </div>
          {validationErrors.totalDuration && touchedFields.has('totalDuration') && (
            <p style={{ marginTop: 6, fontSize: 12, color: '#B42318', display: 'flex', alignItems: 'center', gap: 4 }}>
              <AlertCircle size={12} /> {validationErrors.totalDuration}
            </p>
          )}
        </div>

        {/* Total Marks — kept in the Format row when graded, since it's the
            same "how is this exercise shaped" question the row already asks.
            Non-graded hides the column (mockup shows only 3 columns, which
            matches the non-graded default). */}
        {isGraded && (
          <div>
            <FieldLabel required info={isCombined ? 'Allocate marks between MCQ and Programming sections' : 'Maximum marks a student can score'}>
              {isCombined ? 'Marks (MCQ + Prog.)' : 'Total marks'}
            </FieldLabel>
            {!isCombined ? (
              <ONumberInput
                value={formData.totalMarks}
                onChange={v => {
                  setFormData((prev: any) => ({ ...prev, totalMarks: v }));
                  if (v > 0) setValidationErrors((prev: any) => { const e = { ...prev }; delete e.totalMarks; return e; });
                }}
                onBlur={() => markTouched('totalMarks')}
                placeholder="Enter total marks"
                error={validationErrors.totalMarks}
                touched={touchedFields.has('totalMarks')}
                style={{ width: '100%' }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <ONumberInput
                    value={formData.totalMarksMCQ}
                    onChange={v => {
                      setFormData((prev: any) => ({ ...prev, totalMarksMCQ: v, totalMarks: v + prev.totalMarksProgramming }));
                      if (v > 0) setValidationErrors((prev: any) => { const e = { ...prev }; delete e.totalMarksMCQ; return e; });
                    }}
                    onBlur={() => markTouched('totalMarksMCQ')}
                    placeholder="MCQ"
                    error={validationErrors.totalMarksMCQ}
                    touched={touchedFields.has('totalMarksMCQ')}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <ONumberInput
                    value={formData.totalMarksProgramming}
                    onChange={v => {
                      setFormData((prev: any) => ({ ...prev, totalMarksProgramming: v, totalMarks: prev.totalMarksMCQ + v }));
                      if (v > 0) setValidationErrors((prev: any) => { const e = { ...prev }; delete e.totalMarksProgramming; return e; });
                    }}
                    onBlur={() => markTouched('totalMarksProgramming')}
                    placeholder="Prog."
                    error={validationErrors.totalMarksProgramming}
                    touched={touchedFields.has('totalMarksProgramming')}
                    style={{ width: '100%' }}
                  />
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  height: 24, marginTop: 12, padding: '0 9px', borderRadius: 999,
                  background: MC.orangeTint, border: `1px solid ${MC.orangeTint}`,
                  fontSize: 11, fontWeight: 600, color: MC.orange, whiteSpace: 'nowrap',
                }}>
                  {combinedTotal} marks
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Learning focus ── */}
      <SectionHeading>Learning focus</SectionHeading>

      {/* Grading radio cards */}
      <div style={{ marginBottom: 16 }}>
        <FieldLabel required info="Graded exercises require marks configuration; Non-graded tracks completion only">
          Grading
        </FieldLabel>
        <div
          role="radiogroup"
          aria-label="Grading"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}
        >
          {(['Non-Graded', 'Graded'] as const).map((opt) => {
            const selected = opt === 'Graded' ? isGraded : !isGraded;
            return (
              <button
                key={opt}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={gradedLocked}
                onClick={() => {
                  if (gradedLocked) return;
                  const graded = opt === 'Graded';
                  setFormData((prev: any) => ({
                    ...prev,
                    isGraded: graded,
                    ...(graded ? {} : { totalMarks: 0, totalMarksMCQ: 0, totalMarksProgramming: 0 }),
                  }));
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  minHeight: 48, padding: '10px 12px', borderRadius: 7,
                  cursor: gradedLocked ? 'not-allowed' : 'pointer',
                  border: `1.5px solid ${selected ? MC.orange : MC.border}`,
                  background: selected ? MC.orangeTint : '#fff',
                  transition: 'all 0.15s',
                  opacity: gradedLocked ? 0.5 : 1,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20, borderRadius: '50%',
                    background: selected ? MC.orange : '#fff',
                    border: selected ? `2px solid ${MC.orange}` : `2px solid #D0D5DD`,
                    flexShrink: 0,
                  }}
                >
                  {selected && <Check size={12} strokeWidth={3} style={{ color: '#fff' }} />}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: MC.text }}>
                  {opt === 'Non-Graded' ? 'Non-graded' : 'Graded'}
                </span>
              </button>
            );
          })}
        </div>
        {gradedLocked ? (
          <p style={{ marginTop: 8, fontSize: 12, color: MC.sub, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} style={{ color: MC.orange }} />
            Grading type cannot be changed after the exercise has been fully completed.
          </p>
        ) : !isGraded && (
          <p style={{ marginTop: 8, fontSize: 12, color: MC.sub, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={13} style={{ color: MC.orange }} />
            Grade settings are hidden for non-graded exercises.
          </p>
        )}
      </div>

      {/* Skills — chip input matching the mockup. Chips come from the
          topic-configured languages (existing behavior). "Add skill" is a
          dashed button; when no skill-picker exists in the current flow it
          points the user at Topic Settings where languages are configured. */}
      <div style={{ marginBottom: 24 }}>
        <FieldLabel info="Skill set configured for this topic. Add or remove languages in Topic Settings.">
          Skills
        </FieldLabel>
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
          minHeight: 44, padding: 7, borderRadius: 7,
          border: `1px solid ${MC.border}`, background: '#fff',
        }}>
          {allLangs.length === 0 && (
            <span style={{ fontSize: 13, color: MC.sub, padding: '0 4px' }}>
              No skills configured — set them in Topic Settings
            </span>
          )}
          {allLangs.map(lang => (
            <span
              key={lang.name}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 32, padding: '0 6px 0 10px', borderRadius: 999,
                background: '#F2F4F7', color: MC.text,
                fontSize: 13, fontWeight: 600,
              }}
            >
              {lang.icon && (
                <img
                  src={lang.icon} alt=""
                  style={{ width: 16, height: 16, objectFit: 'contain' }}
                  onError={e => { (e.target as any).style.display = 'none'; }}
                />
              )}
              {lang.name}
              {/* Remove icon — chip removal is topic-scoped (the topic owns
                  the language set), so the button explains that rather than
                  silently swallowing the click. */}
              <button
                type="button"
                title="Skills are configured in Topic Settings — remove from there"
                onClick={(e) => e.preventDefault()}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'transparent', border: 'none', cursor: 'not-allowed',
                  color: MC.sub, opacity: 0.7,
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => { /* topic-scoped — point at settings */ }}
            title="Skills are configured in Topic Settings"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 32, padding: '0 12px', borderRadius: 999,
              background: '#fff', color: MC.sub,
              border: `1px dashed #D0D5DD`, cursor: 'default',
              fontSize: 13, fontWeight: 600,
            }}
          >
            <Plus size={13} /> Add skill
          </button>
        </div>
      </div>

      {/* ── Description ── kept as its own section (not in the mockup, but
          it's a wired field with saved content — hiding it would silently
          drop copy the teacher wrote). */}
      <SectionHeading>Description</SectionHeading>
      <div style={{ marginBottom: 24 }}>
        <TipTapEditor
          value={formData.description}
          onChange={(v: string) => setFormData((prev: any) => ({ ...prev, description: v }))}
          placeholder="Enter a brief description shown to students before they start…"
          minHeight="150px"
          maxHeight="300px"
          showToolbar
          editable
        />
      </div>

      {/* ── Instructions ── rendered on the student pre-start page. Leaving
          this blank is fine — the pre-start page auto-generates a
          paragraph from duration / language / question count so students
          always see something useful. */}
      <SectionHeading>Instructions</SectionHeading>
      <div style={{ marginBottom: 24 }}>
        <TipTapEditor
          value={formData.instructions || ''}
          onChange={(v: string) => setFormData((prev: any) => ({ ...prev, instructions: v }))}
          placeholder="Optional: rules or guidance students see on the pre-start page. Left blank, an instruction paragraph is auto-generated from your settings."
          minHeight="150px"
          maxHeight="300px"
          showToolbar
          editable
        />
      </div>
    </div>
  );
};
