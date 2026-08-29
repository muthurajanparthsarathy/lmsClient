import React from 'react';
import { AlertCircle } from 'lucide-react';
import { D } from '../shared/tokens';
import { InfoTooltip, OInput, ONumberInput } from '../shared/UIComponents';
import TipTapEditor from '../../tiptopEditor';

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

// ─── Demo-spec card + pill styles (styling only) ─────────────────────────────
const cardStyle: React.CSSProperties = {
  border: `1px solid ${D.border2}`,
  borderRadius: 11,
  background: D.bg,
};
const cardHStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 9,
  padding: '9px 13px',
  background: D.surface,
  borderBottom: `1px solid ${D.border}`,
  borderRadius: '11px 11px 0 0',
};
const cardTStyle: React.CSSProperties = {
  fontSize: 11.2,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: D.textSub,
};
const cardBStyle: React.CSSProperties = { padding: 13 };
const greyPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 23,
  padding: '0 9px',
  borderRadius: 999,
  border: '1px solid #E7E5E4',
  background: '#F4F4F5',
  color: '#57606E',
  fontSize: 10.8,
  fontWeight: 600,
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

  const exerciseTypeOptions = [
    { value: 'MCQ',         label: 'MCQ — Multiple Choice Questions (auto-graded)' },
    { value: 'Programming', label: 'Programming — Code challenges with test cases' },
    { value: 'Combined',    label: 'Combined — MCQ + Programming (hybrid)' },
    { value: 'Other',       label: 'Other — Custom exercise with module & language config' },
  ];

  // Build the chip list for the Skill Set row
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

  const fieldLabel = (label: string, required?: boolean, info?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#4B5563' }}>{label}</span>
      {required && <span style={{ fontSize: 11, fontWeight: 600, color: D.orange }}>*</span>}
      {info && <InfoTooltip content={info} />}
    </div>
  );

  const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`;

  const allStepsSaved = steps.length > 0 && steps.every(s => savedSteps.has(s.title));
  const gradedLocked = allStepsSaved;

  return (
    <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 13 }}>
      <style>{`
        .exd-sel{
          width:100%; height:34px; border-radius:8px; padding:0 28px 0 11px;
          font-size:12.6px; color:#1D2433; border:1px solid #E9E5E1;
          background-color:#fff; appearance:none; -webkit-appearance:none;
          outline:none; cursor:pointer;
        }
        .exd-sel:focus{ border-color:#EE6A22; box-shadow:0 0 0 3px rgba(238,106,34,.13); }
        .exd-sel:disabled{ background-color:#FAF9F8; color:#6B7280; cursor:not-allowed; }
      `}</style>

      {/* ── Card: Basics ── */}
      <div style={cardStyle}>
        <div style={cardHStyle}>
          <span style={cardTStyle}>Basics</span>
        </div>
        <div style={{ ...cardBStyle, display: 'flex', flexDirection: 'column', gap: 13 }}>

          {/* Row 1: Exercise ID + Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Exercise ID', false, 'Auto-generated unique identifier for this exercise')}
              <OInput value={formData.exerciseId} onChange={() => { }} readOnly />
            </div>
            <div>
              {fieldLabel('Exercise Name', true, 'The name displayed to students in their dashboard')}
              <OInput
                value={formData.exerciseName}
                onChange={v => {
                  setFormData((prev: any) => ({ ...prev, exerciseName: v }));
                  if (v.trim()) setValidationErrors((prev: any) => { const e = { ...prev }; delete e.exerciseName; return e; });
                }}
                onBlur={() => markTouched('exerciseName')}
                placeholder="e.g. Advanced Algorithms"
                error={validationErrors.exerciseName}
                touched={touchedFields.has('exerciseName')}
              />
            </div>
          </div>

          {/* Row 2: Exercise Type + Graded Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              {fieldLabel('Exercise Type', true, 'MCQ for multiple-choice, Programming for code challenges, or Combined for both')}
              <select
                value={formData.exerciseType || ''}
                onChange={e => {
                  const v = e.target.value as any;
                  handleSelectExerciseType(v);
                  if (v) setValidationErrors((prev: any) => { const n = { ...prev }; delete n.exerciseType; return n; });
                }}
                onBlur={() => markTouched('exerciseType')}
                disabled={isLockedForEdit}
                className="exd-sel"
                style={{
                  ...(validationErrors.exerciseType && touchedFields.has('exerciseType')
                    ? { borderColor: '#FBD3CE', backgroundColor: '#FFFCFC' }
                    : {}),
                  color: formData.exerciseType ? (isLockedForEdit ? D.textMuted : D.textMain) : D.textMuted,
                  backgroundImage: chevronBg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                }}
              >
                <option value="" disabled>Select exercise type…</option>
                {exerciseTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {isLockedForEdit && (
                <p style={{ marginTop: 4, fontSize: 11, color: D.textMuted }}>
                  Exercise type cannot be changed after creation
                </p>
              )}
              {validationErrors.exerciseType && touchedFields.has('exerciseType') && (
                <p style={{ marginTop: 4, fontSize: 11, color: D.red, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <AlertCircle size={11} /> {validationErrors.exerciseType}
                </p>
              )}
            </div>

            <div>
              {fieldLabel('Graded Type', true, 'Graded exercises require marks configuration; Non-Graded tracks completion only')}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                padding: 3, borderRadius: 8,
                background: D.surface2,
                border: `1px solid ${D.border2}`,
                opacity: gradedLocked ? 0.45 : 1,
                cursor: gradedLocked ? 'not-allowed' : 'auto',
              }}>
                {(['Graded', 'Non-Graded'] as const).map(opt => {
                  const active = opt === 'Graded' ? formData.isGraded !== false : formData.isGraded === false;
                  return (
                    <button
                      key={opt}
                      type="button"
                      disabled={gradedLocked}
                      aria-pressed={active}
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
                        height: 27, padding: '0 12px', borderRadius: 5, border: 'none',
                        fontSize: 12, fontWeight: 600,
                        cursor: gradedLocked ? 'not-allowed' : 'pointer',
                        transition: 'background 0.15s, color 0.15s',
                        background: active ? '#fff' : 'transparent',
                        color: active ? D.orangeDark : D.textMuted,
                        boxShadow: active ? '0 1px 3px rgba(15,23,42,.1)' : 'none',
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {gradedLocked && (
                <p style={{ marginTop: 4, fontSize: 11, color: D.textMuted }}>
                  Graded type cannot be changed after the exercise has been fully completed
                </p>
              )}
            </div>
          </div>

          {/* Row 3: Difficulty + Duration + Total Marks */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: formData.isGraded !== false ? 'repeat(3,1fr)' : '1fr 1fr',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <div>
              {fieldLabel('Difficulty Level', true, 'Sets the challenge level — affects filtering and student guidance')}
              <select
                value={formData.exerciseLevel || ''}
                onChange={e => {
                  setFormData((prev: any) => ({ ...prev, exerciseLevel: e.target.value as any }));
                  if (e.target.value) setValidationErrors((prev: any) => { const n = { ...prev }; delete n.exerciseLevel; return n; });
                }}
                className="exd-sel"
                style={{
                  ...(validationErrors.exerciseLevel && touchedFields.has('exerciseLevel')
                    ? { borderColor: '#FBD3CE', backgroundColor: '#FFFCFC' }
                    : {}),
                  color: formData.exerciseLevel ? D.textMain : D.textMuted,
                  backgroundImage: chevronBg, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                }}
              >
                <option value="" disabled hidden>Select difficulty…</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="expert">Expert</option>
              </select>
              {validationErrors.exerciseLevel && touchedFields.has('exerciseLevel') && (
                <p style={{ marginTop: 4, fontSize: 11, color: D.red, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <AlertCircle size={11} /> {validationErrors.exerciseLevel}
                </p>
              )}
            </div>

            <div>
              {fieldLabel('Duration (minutes)', true, 'Total time allowed in minutes')}
              <ONumberInput
                value={formData.totalDuration}
                onChange={v => {
                  setFormData((prev: any) => ({ ...prev, totalDuration: v }));
                  if (v > 0) setValidationErrors((prev: any) => { const e = { ...prev }; delete e.totalDuration; return e; });
                }}
                onBlur={() => markTouched('totalDuration')}
                placeholder="60"
                error={validationErrors.totalDuration}
                touched={touchedFields.has('totalDuration')}
                style={{ width: '100%' }}
              />
            </div>

            {formData.isGraded !== false && (
              <div>
                {fieldLabel(
                  isCombined ? 'Marks (MCQ + Prog.)' : 'Total Marks',
                  true,
                  isCombined ? 'Allocate marks between MCQ and Programming sections' : 'Maximum marks a student can score',
                )}
                {!isCombined ? (
                  <ONumberInput
                    value={formData.totalMarks}
                    onChange={v => {
                      setFormData((prev: any) => ({ ...prev, totalMarks: v }));
                      if (v > 0) setValidationErrors((prev: any) => { const e = { ...prev }; delete e.totalMarks; return e; });
                    }}
                    onBlur={() => markTouched('totalMarks')}
                    placeholder="Enter Total Marks"
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
                      height: 23, marginTop: 5, padding: '0 9px', borderRadius: 999,
                      background: '#FFF2E8', border: '1px solid #FBD8BE',
                      fontSize: 10.8, fontWeight: 600, color: D.orangeDark,
                      whiteSpace: 'nowrap',
                    }}>
                      {combinedTotal} marks
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Card: Skill Set ── */}
      <div style={cardStyle}>
        <div style={cardHStyle}>
          <span style={cardTStyle}>Skill Set</span>
          <InfoTooltip content="Skill set configured for this topic" />
        </div>
        <div style={cardBStyle}>
          {allLangs.length === 0 ? (
            <span style={{ fontSize: 11.5, color: D.textMuted }}>No languages configured</span>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {allLangs.map(lang => (
                <span key={lang.name} style={greyPillStyle}>
                  {lang.icon && (
                    <img src={lang.icon} alt={lang.name}
                      style={{ width: 13, height: 13, objectFit: 'contain' }}
                      onError={e => { (e.target as any).style.display = 'none'; }} />
                  )}
                  {lang.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Card: Description ── */}
      <div style={cardStyle}>
        <div style={cardHStyle}>
          <span style={cardTStyle}>Description</span>
          <InfoTooltip content="A brief overview shown to students before they start" />
        </div>
        <div style={cardBStyle}>
          <TipTapEditor
            value={formData.description}
            onChange={(v: string) => setFormData((prev: any) => ({ ...prev, description: v }))}
            placeholder="Enter a brief description..."
            minHeight="150px"
            maxHeight="300px"
            showToolbar
            editable
          />
        </div>
      </div>

    </div>
  );
};
