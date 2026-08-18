// GradeSettingsStep.tsx
import React from 'react';
import { Award, List, Terminal, Layers, Shield, EyeOff, Plus, Trash2 } from 'lucide-react';
import { D } from './constants';
import { FormDataType, ValidationErrors } from './types';
import { GradeRow, ONumberInput } from './UIComponents';
import type { SectionItem } from './ExerciseDetailsStep';

type SectionPart = { id: string; name: string; totalMarks: number | null; passMark: number | null };

// Recommended performance scale shown by default (percentage of Total Mark).
// Always rendered; teachers can edit labels/percentages, add rows, or remove them.
const DEFAULT_GRADE_BANDS = [
  { id: 'band_poor', label: 'Poor', fromPercent: 0, toPercent: 40 },
  { id: 'band_average', label: 'Average', fromPercent: 40, toPercent: 60 },
  { id: 'band_good', label: 'Good', fromPercent: 60, toPercent: 80 },
  { id: 'band_excellent', label: 'Excellent', fromPercent: 80, toPercent: 100 },
];

interface GradeSettingsStepProps {
  formData: FormDataType;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  validationErrors: ValidationErrors;
  touchedFields: Set<string>;
  markTouched: (field: string) => void;
  D: any;
  GradeRow: any;
  // Section-based extras — when isSectionBased is true and exerciseSections
  // has entries, we render a pass-mark input per section (Part A / B / C …)
  // instead of the global Mark / Mark to Pass row.
  isSectionBased?: boolean;
  exerciseSections?: SectionItem[];
}

export const GradeSettingsStep: React.FC<GradeSettingsStepProps> = ({
  formData,
  setFormData,
  validationErrors,
  touchedFields,
  markTouched,
  D,
  GradeRow,
  isSectionBased = false,
  exerciseSections = [],
}) => {
  const et = formData.exerciseType;
  const sep = formData.grades.separateMarks;
  const g = formData.grades;
  const ve = validationErrors;
  const tf = touchedFields;

  // ── Grade bands (performance scale by % of Total Mark) — UI + state only ──
  const gradeBands: any[] = Array.isArray((g as any).gradeBands) ? (g as any).gradeBands : DEFAULT_GRADE_BANDS;
  const updateGradeBands = (updater: (curr: any[]) => any[]) =>
    setFormData(prev => ({
      ...prev,
      grades: {
        ...prev.grades,
        gradeBands: updater(Array.isArray((prev.grades as any).gradeBands) ? (prev.grades as any).gradeBands : DEFAULT_GRADE_BANDS),
      } as any,
    }));
  const updateGradeBand = (id: string, patch: any) =>
    updateGradeBands(curr => curr.map(b => (b.id === id ? { ...b, ...patch } : b)));
  const removeGradeBand = (id: string) =>
    updateGradeBands(curr => curr.filter(b => b.id !== id));
  const addGradeBand = () =>
    updateGradeBands(curr => [...curr, { id: `band_${Date.now()}`, label: '', fromPercent: 0, toPercent: 0 }]);

  // Section Based toggle — when ON, per-part Total + Pass Mark inputs appear
  // below Mark to Pass. The toggle replaces the older Enable-Mark-to-Pass switch.
  const sectionBased = !!g.sectionBased;
  const internalSections: SectionPart[] = Array.isArray(g.sections) ? g.sections : [];

  // If the parent passed pre-defined exercise parts (via isSectionBased +
  // exerciseSections), seed the editor from them on first open so the user
  // isn't typing names that already exist.
  const seededSections: SectionPart[] =
    internalSections.length > 0
      ? internalSections
      : (isSectionBased && exerciseSections.length > 0
          ? exerciseSections.map((s, idx) => ({
              id: String((s as any).id ?? `part_${idx}`),
              name: (s as any).name ?? (s as any).title ?? `Part ${String.fromCharCode(65 + idx)}`,
              totalMarks: Number((s as any).totalMarks ?? 0) || null,
              passMark: null,
            }))
          : []);

  const updateSections = (updater: (curr: SectionPart[]) => SectionPart[]) =>
    setFormData(prev => ({
      ...prev,
      grades: {
        ...prev.grades,
        sections: updater(Array.isArray(prev.grades.sections) ? prev.grades.sections : seededSections),
      },
    }));

  const removePart = (id: string) => updateSections(curr => curr.filter(p => p.id !== id));

  const updatePart = (id: string, patch: Partial<SectionPart>) =>
    updateSections(curr => curr.map(p => (p.id === id ? { ...p, ...patch } : p)));

  const toggleSectionBased = () =>
    setFormData(prev => {
      const next = !prev.grades.sectionBased;
      const hasSections = Array.isArray(prev.grades.sections) && prev.grades.sections.length > 0;
      return {
        ...prev,
        grades: {
          ...prev.grades,
          sectionBased: next,
          // Seed from exerciseSections (defined in Exercise Details) on first enable.
          ...(next && !hasSections && seededSections.length > 0
            ? { sections: seededSections }
            : {}),
        },
      };
    });

  const renderSectionBasedToggle = (color: string) => (
    <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: D.border }}>
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: color + '12', color }}
        >
          <Layers size={13} />
        </div>
        <div>
          <span className="text-xs font-semibold" style={{ color: D.textMain, fontFamily: 'Poppins, sans-serif' }}>
            Section Based
          </span>
          <p className="text-[10.5px]" style={{ color: D.textMuted }}>
            Split this exercise into parts (Part A, Part B, …) with their own total and pass mark
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={toggleSectionBased}
        aria-pressed={sectionBased}
        className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
        style={{ background: sectionBased ? D.orange : '#e2e3e8' }}
      >
        <span
          className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${
            sectionBased ? 'translate-x-[17px]' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );

  // Renderer used when isSectionBased (from Exercise Details) is true.
  // Totals are read-only and sourced from exerciseSections; pass marks bind
  // to grades.sectionPassMarks (the shape buildFullPayload already persists).
  const renderExerciseSectionsPartsEditor = (color: string) => {
    const sections = exerciseSections || [];
    const passMarks = g.sectionPassMarks || {};
    return (
      <div className="py-2">
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color}25` }}>
          <div
            className="grid px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              background: color + '08',
              borderBottom: `1px solid ${color}20`,
              gridTemplateColumns: '140px 1fr 1fr',
              color: D.textMuted,
              gap: '8px',
            }}
          >
            <span>Part</span>
            <span className="text-center">Total Marks</span>
            <span className="text-center">Mark to Pass</span>
          </div>
          {sections.length === 0 ? (
            <div className="px-3 py-2 text-[11px]" style={{ color: D.textMuted }}>
              No sections defined. Add sections in <strong>Exercise Details</strong> first.
            </div>
          ) : (
            sections.map((s, idx) => {
              const total = Number((s as any).totalMarks ?? 0);
              const pass = passMarks[s.id] ?? null;
              const exceeded = total > 0 && (pass ?? 0) > total;
              const name = (s as any).name || `Part ${String.fromCharCode(65 + idx)}`;
              return (
                <div
                  key={s.id}
                  className="grid items-center px-3 py-2"
                  style={{
                    gridTemplateColumns: '140px 1fr 1fr',
                    gap: '8px',
                    borderTop: idx > 0 ? `1px solid ${D.border}` : 'none',
                    background: D.bg,
                  }}
                >
                  <span className="text-xs font-semibold truncate" style={{ color: D.textMain, fontFamily: 'Poppins, sans-serif' }}>
                    {name}
                  </span>
                  <div
                    className="px-2 py-1.5 text-xs rounded-lg border text-center"
                    style={{ borderColor: D.border, background: D.bgLight || D.bg, color: D.textMain }}
                  >
                    {total || 0}
                  </div>
                  <div>
                    <ONumberInput
                      value={pass ?? 0}
                      onChange={(v: number) =>
                        setFormData(prev => ({
                          ...prev,
                          grades: {
                            ...prev.grades,
                            sectionPassMarks: {
                              ...(prev.grades.sectionPassMarks || {}),
                              [s.id]: v || null,
                            },
                          },
                        }))
                      }
                      placeholder="0"
                      min={0}
                      max={total || undefined}
                    />
                    {exceeded && (
                      <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>
                        Cannot exceed {total}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p className="text-[10.5px] mt-2" style={{ color: D.textMuted }}>
          Each part's Total Marks is set in Exercise Details. Mark to Pass is optional per part.
        </p>
      </div>
    );
  };

  const renderSectionBasedEditor = (color: string) => {
    const sections = Array.isArray(g.sections) ? g.sections : seededSections;
    return (
      <div className="py-2">
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${color}25` }}>
          <div
            className="grid px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              background: color + '08',
              borderBottom: `1px solid ${color}20`,
              gridTemplateColumns: '100px 1fr 1fr 28px',
              color: D.textMuted,
              gap: '8px',
            }}
          >
            <span>Part</span>
            <span className="text-center">Total Marks</span>
            <span className="text-center">Mark to Pass</span>
            <span />
          </div>
          {sections.length === 0 ? (
            <div className="px-3 py-2 text-[11px]" style={{ color: D.textMuted }}>
              No sections yet. Add sections in <strong>Exercise Details</strong> to configure their marks here.
            </div>
          ) : (
            sections.map((p: SectionPart, idx: number) => {
              const exceeded = (p.totalMarks ?? 0) > 0 && (p.passMark ?? 0) > (p.totalMarks ?? 0);
              return (
                <div
                  key={p.id}
                  className="grid items-center px-3 py-2"
                  style={{
                    gridTemplateColumns: '100px 1fr 1fr 28px',
                    gap: '8px',
                    borderTop: idx > 0 ? `1px solid ${D.border}` : 'none',
                    background: D.bg,
                  }}
                >
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updatePart(p.id, { name: e.target.value })}
                    placeholder={`Part ${String.fromCharCode(65 + idx)}`}
                    className="px-2 py-1.5 text-xs rounded-lg border w-full"
                    style={{ borderColor: D.border, fontFamily: 'Poppins, sans-serif', color: D.textMain, background: D.bg }}
                  />
                  <ONumberInput
                    value={p.totalMarks ?? 0}
                    onChange={v => updatePart(p.id, { totalMarks: v || null })}
                    placeholder="0"
                    min={0}
                  />
                  <div>
                    <ONumberInput
                      value={p.passMark ?? 0}
                      onChange={v => updatePart(p.id, { passMark: v || null })}
                      placeholder="0"
                      min={0}
                      max={p.totalMarks ?? undefined}
                    />
                    {exceeded && (
                      <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>
                        Cannot exceed {p.totalMarks}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePart(p.id)}
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ background: D.red + '12', color: D.red }}
                    aria-label="Remove part"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>
        <p className="text-[10.5px] mt-2" style={{ color: D.textMuted }}>
          Each part's Mark to Pass is optional and is validated against that part's Total Marks.
        </p>
      </div>
    );
  };

  return (
    <div className="px-10 pt-4 pb-6">
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${D.border}` }}>
        <div className="px-3">

          {isSectionBased && (() => {
            // Aggregate Total Mark = sum of every section's totalMarks from Exercise Details.
            // Mirrors the backend rule used in validateGradeSettings (CreateAssessmentModal).
            const aggregatedTotal = (exerciseSections || []).reduce(
              (sum, s) => sum + Number((s as any).totalMarks || 0),
              0
            );
            return (
              <>
                <GradeRow
                  icon={<Layers size={13} />}
                  color={D.emerald}
                  label="Total Mark"
                  info="Auto-calculated from Total Marks across all sections"
                  autoValue={aggregatedTotal > 0 ? aggregatedTotal : 'Auto'}
                />
                <GradeRow
                  icon={<Award size={13} />}
                  color={D.emerald}
                  label="Mark to Pass"
                  info={`Overall passing marks — must be less than Total Mark${aggregatedTotal > 0 ? ` (${aggregatedTotal})` : ''} (optional)`}
                  fieldKey="combinedGradeToPass"
                  value={g.combinedGradeToPass}
                  onChange={(v: any) =>
                    setFormData(prev => ({ ...prev, grades: { ...prev.grades, combinedGradeToPass: v } }))
                  }
                  onBlur={() => markTouched('combinedGradeToPass')}
                  error={ve.combinedGradeToPass}
                  errorTouched={tf.has('combinedGradeToPass')}
                  optional
                />
                {renderSectionBasedToggle(D.emerald)}
                {sectionBased && renderExerciseSectionsPartsEditor(D.emerald)}
              </>
            );
          })()}

          {!isSectionBased && et === 'MCQ' && (
            <>
              <GradeRow
                icon={<List size={13} />}
                color={D.blue}
                label="Total Mark"
                info="Auto-calculated from MCQ total marks"
                autoValue={formData.totalMarks || 'Auto'}
              />
              <GradeRow
                icon={<Award size={13} />}
                color={D.blue}
                label="Mark to Pass"
                info="Minimum marks to pass — cannot exceed Total Mark (optional)"
                fieldKey="mcqGradeToPass"
                value={g.mcqGradeToPass}
                onChange={(v: any) =>
                  setFormData(prev => ({ ...prev, grades: { ...prev.grades, mcqGradeToPass: v } }))
                }
                onBlur={() => markTouched('mcqGradeToPass')}
                error={ve.mcqGradeToPass}
                errorTouched={tf.has('mcqGradeToPass')}
                optional
              />
              {renderSectionBasedToggle(D.blue)}
              {sectionBased && renderSectionBasedEditor(D.blue)}
            </>
          )}

          {!isSectionBased && et === 'Other' && (
            <>
              <GradeRow
                icon={<Terminal size={13} />}
                color={D.orange}
                label="Total Mark"
                info="Auto-calculated from total marks"
                autoValue={formData.totalMarks || 'Auto'}
              />
              {/* Same generic pass-mark field as the MCQ / Programming branches —
                  programmingGradeToPass was never persisted by the modal. */}
              <GradeRow
                icon={<Award size={13} />}
                color={D.orange}
                label="Mark to Pass"
                info={`Minimum marks required to pass — cannot exceed Total Mark${formData.totalMarks ? ` (${formData.totalMarks})` : ''} (optional)`}
                fieldKey="mcqGradeToPass"
                value={g.mcqGradeToPass}
                onChange={(v: any) =>
                  setFormData(prev => ({ ...prev, grades: { ...prev.grades, mcqGradeToPass: v } }))
                }
                onBlur={() => markTouched('mcqGradeToPass')}
                error={ve.mcqGradeToPass}
                errorTouched={tf.has('mcqGradeToPass')}
                optional
              />
              {renderSectionBasedToggle(D.orange)}
              {sectionBased && renderSectionBasedEditor(D.orange)}
            </>
          )}

          {!isSectionBased && et === 'Programming' && (
            <>
              {/* Total Mark is entered once in Exercise Details (formData.totalMarks,
                  persisted as exerciseInformation.totalMarks). It used to be an
                  editable field bound to grades.programmingGrade — a field that was
                  never initialized, validated, or included in the save payload, so
                  it always rendered 0 and silently dropped whatever was typed.
                  Display the Exercise Details value read-only instead, exactly like
                  the MCQ and Other branches. */}
              <GradeRow
                icon={<Terminal size={13} />}
                color={D.orange}
                label="Total Mark"
                info="Auto-filled from Total Marks in Exercise Details"
                autoValue={formData.totalMarks || 'Auto'}
              />
              {/* mcqGradeToPass is the modal's generic pass-mark field: it is the
                  one validated against formData.totalMarks and the only one sent
                  in gradeSettings — programmingGradeToPass was another dead field. */}
              <GradeRow
                icon={<Award size={13} />}
                color={D.orange}
                label="Mark to Pass"
                info={`Minimum marks required to pass — cannot exceed Total Mark${formData.totalMarks ? ` (${formData.totalMarks})` : ''} (optional)`}
                fieldKey="mcqGradeToPass"
                value={g.mcqGradeToPass}
                onChange={(v: any) =>
                  setFormData(prev => ({ ...prev, grades: { ...prev.grades, mcqGradeToPass: v } }))
                }
                onBlur={() => markTouched('mcqGradeToPass')}
                error={ve.mcqGradeToPass}
                errorTouched={tf.has('mcqGradeToPass')}
                optional
              />
              {renderSectionBasedToggle(D.orange)}
              {sectionBased && renderSectionBasedEditor(D.orange)}
            </>
          )}

          {!isSectionBased && et === 'Combined' && (
            <>
              <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: D.border }}>
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: D.purple + '12', color: D.purple }}
                  >
                    <Layers size={13} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold" style={{ color: D.textMain, fontFamily: 'Poppins, sans-serif' }}>
                      Separate Marks
                    </span>
                    <p className="text-[10.5px]" style={{ color: D.textMuted }}>
                      Mark each section (MCQ &amp; Programming) independently
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, grades: { ...prev.grades, separateMarks: !sep } }))}
                  className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
                  style={{ background: sep ? D.orange : '#e2e3e8' }}
                >
                  <span
                    className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${
                      sep ? 'translate-x-[17px]' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
              {!sep ? (
                <>
                  {(() => {
                    const ag = (formData.totalMarksMCQ || 0) + (formData.totalMarksProgramming || 0);
                    return (
                      <>
                        <GradeRow
                          icon={<Layers size={13} />}
                          color={D.emerald}
                          label="Total Mark"
                          info="Auto-calculated: MCQ total + Programming total"
                          autoValue={ag > 0 ? ag : 'Auto'}
                        />
                        <GradeRow
                          icon={<Award size={13} />}
                          color={D.emerald}
                          label="Mark to Pass"
                          info={`Overall passing marks — cannot exceed Total Mark${ag > 0 ? ` (${ag})` : ''} (optional)`}
                          fieldKey="combinedGradeToPass"
                          value={g.combinedGradeToPass}
                          onChange={(v: any) =>
                            setFormData(prev => ({ ...prev, grades: { ...prev.grades, combinedGradeToPass: v } }))
                          }
                          onBlur={() => markTouched('combinedGradeToPass')}
                          error={ve.combinedGradeToPass}
                          errorTouched={tf.has('combinedGradeToPass')}
                          optional
                        />
                      </>
                    );
                  })()}
                </>
              ) : (
                <>
                  <div className="pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: D.blue }}>
                    MCQ Section
                  </div>
                  <GradeRow
                    icon={<List size={13} />}
                    color={D.blue}
                    label="MCQ Mark"
                    info="Auto-calculated from MCQ Marks in Exercise Details"
                    autoValue={formData.totalMarksMCQ || 'Auto'}
                  />
                  <GradeRow
                    icon={<Award size={13} />}
                    color={D.blue}
                    label="MCQ Mark to Pass"
                    info={`Minimum marks to pass the MCQ section — cannot exceed MCQ Mark${
                      formData.totalMarksMCQ ? ` (${formData.totalMarksMCQ})` : ''
                    } (optional)`}
                    fieldKey="mcqGradeToPass"
                    value={g.mcqGradeToPass}
                    onChange={(v: any) =>
                      setFormData(prev => ({ ...prev, grades: { ...prev.grades, mcqGradeToPass: v } }))
                    }
                    onBlur={() => markTouched('mcqGradeToPass')}
                    error={ve.mcqGradeToPass}
                    errorTouched={tf.has('mcqGradeToPass')}
                    optional
                  />
                  <div className="pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: D.orange }}>
                    Programming Section
                  </div>
                  <GradeRow
                    icon={<Terminal size={13} />}
                    color={D.orange}
                    label="Programming Mark"
                    info="Auto-calculated from Programming Marks in Exercise Details"
                    autoValue={formData.totalMarksProgramming || 'Auto'}
                  />
                  <GradeRow
                    icon={<Award size={13} />}
                    color={D.orange}
                    label="Programming Mark to Pass"
                    info={`Minimum marks to pass the programming section — cannot exceed Prog. Mark${
                      formData.totalMarksProgramming ? ` (${formData.totalMarksProgramming})` : ''
                    } (optional)`}
                    fieldKey="programmingGradeToPass"
                    value={g.programmingGradeToPass}
                    onChange={(v: any) =>
                      setFormData(prev => ({ ...prev, grades: { ...prev.grades, programmingGradeToPass: v } }))
                    }
                    onBlur={() => markTouched('programmingGradeToPass')}
                    error={ve.programmingGradeToPass}
                    errorTouched={tf.has('programmingGradeToPass')}
                    optional
                  />
                </>
              )}
            </>
          )}

          {/* ── Grade Bands — performance scale by % of Total Mark (always shown) ── */}
          <div className="py-3 border-t" style={{ borderColor: D.border }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: D.purple + '15', color: D.purple }}>
                  <Award size={11} />
                </div>
                <div>
                  <span className="text-xs font-semibold" style={{ color: D.textMain, fontFamily: 'Poppins, sans-serif' }}>
                    Grade Bands <span className="font-normal" style={{ color: D.textMuted }}>(Optional)</span>
                  </span>
                  <p className="text-[10.5px]" style={{ color: D.textMuted }}>
                    Label performance by score percentage. Recommended values shown — edit, add or remove.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={addGradeBand}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0"
                style={{ background: D.purple + '12', color: D.purple, fontFamily: 'Poppins, sans-serif' }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${D.purple}25` }}>
              <div className="grid px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: D.purple + '08', borderBottom: `1px solid ${D.purple}20`, gridTemplateColumns: '1fr 190px 28px', gap: '8px', color: D.textMuted }}>
                <span>Grade</span>
                <span className="text-center">Score Range (%)</span>
                <span />
              </div>
              {gradeBands.length === 0 ? (
                <div className="px-3 py-2 text-[11px]" style={{ color: D.textMuted, background: D.bg }}>
                  No grade bands. Click <strong>Add</strong> to create one.
                </div>
              ) : (
                gradeBands.map((b: any, idx: number) => {
                  const from = b.fromPercent ?? 0;
                  const to = b.toPercent ?? 0;
                  const invalid = from < 0 || to > 100 || from >= to;
                  return (
                    <div key={b.id} className="grid items-center px-3 py-2"
                      style={{ gridTemplateColumns: '1fr 190px 28px', gap: '8px', borderTop: idx > 0 ? `1px solid ${D.border}` : 'none', background: D.bg }}>
                      <input
                        type="text"
                        value={b.label}
                        onChange={e => updateGradeBand(b.id, { label: e.target.value })}
                        placeholder="Grade name"
                        className="px-2 py-1.5 text-xs rounded-lg border w-full"
                        style={{ borderColor: D.border, fontFamily: 'Poppins, sans-serif', color: D.textMain, background: D.bg }}
                      />
                      <div>
                        <div className="flex items-center gap-1">
                          <ONumberInput
                            value={from}
                            onChange={(v: number) => updateGradeBand(b.id, { fromPercent: v })}
                            placeholder="0"
                            min={0}
                            max={100}
                          />
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: D.textMuted, fontFamily: 'Poppins, sans-serif' }}>–</span>
                          <ONumberInput
                            value={to}
                            onChange={(v: number) => updateGradeBand(b.id, { toPercent: v })}
                            placeholder="0"
                            min={0}
                            max={100}
                          />
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: D.textMuted, fontFamily: 'Poppins, sans-serif' }}>%</span>
                        </div>
                        {invalid && (
                          <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>From must be less than To (0–100)</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGradeBand(b.id)}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background: D.red + '12', color: D.red }}
                        aria-label="Remove grade band"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
              <div className="px-3 py-2 text-[10.5px] font-medium"
                style={{ background: D.purple + '06', borderTop: `1px solid ${D.purple}15`, color: D.textMuted }}>
                A student whose score percentage falls within a band's range earns that grade. Percentages are of the Total Mark.
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield size={13} style={{ color: D.purple }} />
          <span className="text-xs font-bold" style={{ color: D.textMain, fontFamily: 'Poppins, sans-serif' }}>
            Additional Options
          </span>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${D.border}` }}>
          {[
            {
              key: 'anonymousSubmissions',
              label: 'Anonymous Submissions',
              sub: "Enable for unbiased grading — graders won't see student names",
              icon: <EyeOff size={14} />,
              color: D.purple,
              val: formData.additionalOptions.anonymousSubmissions,
            },
            {
              key: 'hideGraderIdentity',
              label: 'Hide Grader Identity',
              sub: 'Hide evaluator details from students',
              icon: <Shield size={14} />,
              color: D.blue,
              val: formData.additionalOptions.hideGraderIdentity,
            },
          ].map((row, idx) => (
            <div
              key={row.key}
              className="flex items-center justify-between px-3 py-2.5 transition-all"
              style={{ background: D.bg, borderTop: idx > 0 ? `1px solid ${D.border}` : 'none' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: row.color + '12', color: row.color }}
                >
                  {row.icon}
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: D.textMain, fontFamily: 'Poppins, sans-serif' }}>
                    {row.label}
                  </div>
                  <div className="text-[10.5px]" style={{ color: D.textMuted }}>
                    {row.sub}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFormData(prev => ({
                    ...prev,
                    additionalOptions: { ...prev.additionalOptions, [row.key]: !row.val },
                  }))
                }
                className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
                style={{ background: row.val ? D.orange : '#e2e3e8' }}
              >
                <span
                  className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${
                    row.val ? 'translate-x-[17px]' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
