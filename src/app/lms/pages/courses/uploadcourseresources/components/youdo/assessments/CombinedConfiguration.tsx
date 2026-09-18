// assessments/CombinedConfiguration.tsx
import React from 'react';
import { List, Terminal, Check } from 'lucide-react';
import { D } from './constants';
import { BaseConfigProps } from './types';
import { MCQConfiguration } from './QuestionConfigurationSteps';
import { ProgrammingConfiguration } from './ProgrammingConfiguration';

export const CombinedConfiguration: React.FC<BaseConfigProps> = (props) => {
  const mcqTabDone = props.formData.mcqConfig.generalQuestionCount > 0;
  const programmingTabDone = props.formData.programmingConfig.generalQuestionCount > 0 ||
    props.formData.programmingConfig.levelBasedCounts.easy > 0 ||
    props.formData.programmingConfig.selectionLevelCounts.easy > 0;

  return (
    <div>
      {/* Tab header */}
      <div className="flex items-center gap-0 px-4 pt-3 pb-0 border-b" style={{ borderColor: D.border }}>
        <button
          type="button"
          onClick={() => props.setCombinedConfigTab?.('mcq')}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px"
          style={{
            borderBottomColor: props.combinedConfigTab === 'mcq' ? D.orange : 'transparent',
            color: props.combinedConfigTab === 'mcq' ? D.orange : D.textMuted,
            background: 'transparent',
          }}
        >
          <List size={11} />
          MCQ Config
          {mcqTabDone && <span className="ml-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: D.emerald, color: '#fff' }}><Check size={7} strokeWidth={3} /></span>}
        </button>
        <button
          type="button"
          onClick={() => props.setCombinedConfigTab?.('programming')}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px"
          style={{
            borderBottomColor: props.combinedConfigTab === 'programming' ? D.orange : 'transparent',
            color: props.combinedConfigTab === 'programming' ? D.orange : D.textMuted,
            background: 'transparent',
          }}
        >
          <Terminal size={11} />
          Programming Config
          {programmingTabDone && <span className="ml-1 w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ background: D.emerald, color: '#fff' }}><Check size={7} strokeWidth={3} /></span>}
        </button>
      </div>

      {/* Tab content */}
      <div>
        {props.combinedConfigTab === 'mcq' ? (
          <MCQConfiguration {...props} />
        ) : (
          <ProgrammingConfiguration {...props} />
        )}
      </div>
    </div>
  );
};