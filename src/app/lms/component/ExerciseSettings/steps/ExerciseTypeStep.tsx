import React from 'react';
import {
  AlertCircle, Check, FolderOpen, Layers, List, Settings2, Terminal,
} from 'lucide-react';
import { D, FONT } from '../shared/tokens';

interface ExerciseTypeStepProps {
  formData: any;
  validationErrors: any;
  touchedFields: Set<string>;
  onSelectType: (type: 'MCQ' | 'Programming' | 'Combined' | 'Other') => void;
}

export const ExerciseTypeStep: React.FC<ExerciseTypeStepProps> = ({
  formData, validationErrors, touchedFields, onSelectType,
}) => {
  const types = [
    { value: 'MCQ',         label: 'MCQ',         sub: 'Multiple Choice Questions', icon: <List size={22} />,       desc: 'Single or multi-select questions with automated grading',                                color: D.blue,     badge: 'Auto-graded'    },
    { value: 'Programming', label: 'Programming', sub: 'Code Challenges',           icon: <Terminal size={22} />,   desc: 'Real coding problems with test cases and language support',                              color: D.orange,   badge: 'Code editor'    },
    { value: 'Combined',    label: 'Combined',    sub: 'MCQ + Programming',         icon: <Layers size={22} />,     desc: 'Mix of multiple choice and programming questions',                                       color: D.purple,   badge: 'Hybrid'         },
    { value: 'Other',       label: 'Other',       sub: 'Other Exercise Type',       icon: <FolderOpen size={22} />, desc: 'Custom exercises with module & language configuration — same provisioning as Programming', color: '#16a34a',  badge: 'Manual grading' },
  ];

  return (
    <div className="px-10 pt-4 pb-6">
      <div className="mb-3 flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: D.orangeLight, color: D.orange }}><Settings2 size={13} /></div>
        <h3 className="text-sm font-bold" style={{ color: D.textMain, fontFamily: FONT }}>Select Exercise Type</h3>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {types.map(t => {
          const sel = formData.exerciseType === t.value;
          return (
            <button key={t.value} type="button"
              onClick={() => onSelectType(t.value as any)}
              className="group relative text-left rounded-xl p-3.5 border-2 transition-all duration-200 focus:outline-none"
              style={{
                borderColor: sel ? t.color : D.border,
                background:  sel ? t.color + '08' : D.bg,
                boxShadow:   sel ? `0 0 0 3px ${t.color}15` : '0 1px 3px rgba(0,0,0,0.04)',
                cursor: 'pointer',
              }}>
              {sel && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: t.color }}>
                  <Check size={10} className="text-white" strokeWidth={3} />
                </div>
              )}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-all duration-200"
                style={{ background: sel ? t.color : t.color + '12', color: sel ? '#fff' : t.color }}>
                {t.icon}
              </div>
              <div className="text-[10px] font-bold px-1.5 py-0.5 rounded-full mb-1.5 inline-block" style={{ background: t.color + '15', color: t.color }}>{t.badge}</div>
              <h3 className="text-sm font-bold mb-0.5" style={{ color: sel ? t.color : D.textMain, fontFamily: FONT }}>{t.label}</h3>
              <p className="text-[11px] font-semibold mb-1" style={{ color: sel ? t.color + 'cc' : D.textMuted }}>{t.sub}</p>
              <p className="text-[11px] leading-relaxed" style={{ color: D.textMuted }}>{t.desc}</p>
            </button>
          );
        })}
      </div>
      {validationErrors.exerciseType && touchedFields.has('exerciseType') && (
        <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#fff2f2', border: `1px solid ${D.red}30` }}>
          <AlertCircle size={13} style={{ color: D.red }} />
          <p className="text-xs" style={{ color: D.red }}>{validationErrors.exerciseType}</p>
        </div>
      )}
    </div>
  );
};
