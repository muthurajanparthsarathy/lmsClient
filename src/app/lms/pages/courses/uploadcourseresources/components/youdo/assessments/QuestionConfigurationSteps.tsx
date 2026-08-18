// QuestionConfigurationSteps.tsx
import React from 'react';
import { List, AlertCircle, Calculator, Lock } from 'lucide-react';
import { D, formatDecimal, isApproximatelyEqual, mcqScoringOptions } from './constants';
import { FormDataType, ValidationErrors } from './types';
import { InfoTooltip, ODropdown, ONumberInput, OToggle } from './UIComponents';

interface BaseConfigProps {
  formData: FormDataType;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationErrors>>;
  validationErrors: ValidationErrors;
  touchedFields: Set<string>;
  markTouched: (field: string) => void;
  InfoTooltip: any;
  SectionLabel: any;
  ODropdown: any;
  ONumberInput: any;
  OToggle: any;
}

export const MCQConfiguration: React.FC<BaseConfigProps> = ({ 
  formData, setFormData, setValidationErrors, validationErrors, touchedFields, markTouched, 
  InfoTooltip, SectionLabel, ODropdown, ONumberInput, OToggle 
}) => {
  const isEqual = formData.mcqConfig.scoreSettings.scoreType === 'equalDistribution';
  const isCombined = formData.exerciseType === 'Combined';
  const totalToUse = isCombined ? formData.totalMarksMCQ : formData.totalMarks;
  const allocated = isEqual ? formData.mcqConfig.generalQuestionCount * formData.mcqConfig.scoreSettings.equalDistribution : 0;
  const isMatch = isEqual ? isApproximatelyEqual(allocated, totalToUse) : true;
  
  return (
    <div className="px-10 pt-4 pb-6">
      {isEqual && (
        <div className="flex justify-end mb-3">
          <div className="text-right">
            <div className="text-[10px] font-semibold" style={{ color: isMatch ? D.emerald : D.amber }}>Allocated</div>
            <div className="text-sm font-bold" style={{ color: isMatch ? D.emerald : D.amber, fontFamily: 'Poppins, sans-serif' }}>
              {formatDecimal(allocated)}<span className="text-xs font-normal" style={{ color: D.textMuted }}>/{totalToUse}</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        <div>
          <SectionLabel info="Equal Distribution splits marks evenly across all questions; Question Specific lets you set marks per question individually">
            Scoring Type
          </SectionLabel>
          <ODropdown
            value={formData.mcqConfig.scoreSettings.scoreType}
            options={mcqScoringOptions}
            onChange={v => {
              const tot = isCombined ? formData.totalMarksMCQ : formData.totalMarks;
              setFormData(prev => ({
                ...prev,
                mcqConfig: {
                  ...prev.mcqConfig,
                  scoreSettings: {
                    ...prev.mcqConfig.scoreSettings,
                    scoreType: v as any,
                    equalDistribution: v === 'equalDistribution' && prev.mcqConfig.generalQuestionCount > 0 ? tot / prev.mcqConfig.generalQuestionCount : 0,
                    totalMarks: tot
                  }
                }
              }));
            }}
          />
          <p className="mt-1 text-[11px]" style={{ color: D.textMuted }}>
            {isEqual ? 'All questions will have equal marks, auto-calculated from total.' : 'Set individual marks per question when creating them.'}
          </p>
        </div>
        
        {isEqual && (
          <div className="animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-3 mt-3">
             <div>
  <SectionLabel required info="Total number of MCQ questions">Total Questions</SectionLabel>
  <ONumberInput 
    value={formData.mcqConfig.generalQuestionCount} 
    onChange={v => { 
      const tot = isCombined ? formData.totalMarksMCQ : formData.totalMarks; 
      setFormData(prev => ({ 
        ...prev, 
        mcqConfig: { 
          ...prev.mcqConfig, 
          generalQuestionCount: v, 
          scoreSettings: { 
            ...prev.mcqConfig.scoreSettings, 
            equalDistribution: v > 0 && tot > 0 ? tot / v : 0 
          } 
        } 
      })); 
      if (v > 0) {
        setValidationErrors(prev => { const e = { ...prev }; delete e.mcqGeneralQuestionCount; return e; });
      } else {
        setValidationErrors(prev => ({ ...prev, mcqGeneralQuestionCount: 'Number of questions is required' }));
      }
    }} 
    onBlur={() => {
      markTouched('mcqGeneralQuestionCount');
      // Set error if field is empty on blur
      if (formData.mcqConfig.generalQuestionCount <= 0) {
        setValidationErrors(prev => ({ ...prev, mcqGeneralQuestionCount: 'Number of questions is required' }));
      }
    }} 
    min={0} 
    placeholder="e.g. 10" 
    error={validationErrors.mcqGeneralQuestionCount} 
    touched={touchedFields.has('mcqGeneralQuestionCount')} 
    required={true}
  />
  {touchedFields.has('mcqGeneralQuestionCount') && formData.mcqConfig.generalQuestionCount <= 0 && (
    <p className="text-[10px] mt-1" style={{ color: D.red }}>Please enter number of questions</p>
  )}
</div>
              <div>
                <SectionLabel info="Auto-calculated">Marks Per Question</SectionLabel>
                <div className="relative">
                  <input 
                    type="text" 
                    value={formatDecimal(formData.mcqConfig.scoreSettings.equalDistribution)} 
                    disabled readOnly 
                    className="w-full px-3 py-2 text-sm rounded-lg border" 
                    style={{ borderColor: D.border, background: D.surface, color: D.textMuted, fontFamily: 'Poppins, sans-serif' }} 
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color: D.orange }}>Auto</span>
                </div>
                {formData.mcqConfig.generalQuestionCount > 0 && formData.mcqConfig.scoreSettings.equalDistribution > 0 && (
                  <p className="mt-1 text-[11px]" style={{ color: D.textMuted }}>
                    {totalToUse} ÷ {formData.mcqConfig.generalQuestionCount} = <strong style={{ color: D.textSub }}>{formatDecimal(formData.mcqConfig.scoreSettings.equalDistribution)}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
        
        {!isEqual && (
          <div className="p-2.5 rounded-lg" style={{ background: D.blue + '08', border: `1px solid ${D.blue}20` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: D.blue }}>Question Specific Mode</p>
            <p className="text-[11px]" style={{ color: D.textMuted }}>
              Assign individual marks per question when creating them. Sum must equal <strong>{totalToUse}</strong>. Question count is not tracked in this mode.
            </p>
          </div>
        )}
        
        {validationErrors.totalMarks && touchedFields.has('totalMarks') && !isCombined && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: '#fff2f2', border: `1px solid ${D.red}25` }}>
            <AlertCircle size={13} style={{ color: D.red }} />
            <p className="text-xs" style={{ color: D.red }}>{validationErrors.totalMarks}</p>
          </div>
        )}
        
        <div className="pt-2 border-t" style={{ borderColor: D.border }}>
          <OToggle 
            enabled={formData.mcqConfig.attemptLimitEnabled} 
            onChange={v => setFormData(prev => ({ 
              ...prev, 
              mcqConfig: { 
                ...prev.mcqConfig, 
                attemptLimitEnabled: v, 
                submissionAttempts: v ? prev.mcqConfig.submissionAttempts : 1 
              } 
            }))} 
            label="Attempt Limit" 
            description="Restrict the number of submission attempts" 
          />
          {formData.mcqConfig.attemptLimitEnabled && (
            <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <SectionLabel info="Maximum number of times a student can submit their MCQ answers (1–10)">Attempts Allowed</SectionLabel>
              <div className="w-28">
                <ONumberInput 
                  value={formData.mcqConfig.submissionAttempts} 
                  onChange={v => setFormData(prev => ({ 
                    ...prev, 
                    mcqConfig: { 
                      ...prev.mcqConfig, 
                      submissionAttempts: Math.max(1, Math.min(10, v)) 
                    } 
                  }))} 
                  min={1} 
                  max={10} 
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
