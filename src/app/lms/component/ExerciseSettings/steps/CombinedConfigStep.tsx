import React from 'react';
import { AlertCircle, List, Terminal } from 'lucide-react';
import { D } from '../shared/tokens';

// Tabbed wrapper for the Combined exercise type. The actual MCQ / Programming
// renderers stay in the shell for now and are passed in as ReactNode children
// so this component can be extracted without lifting their large closures.
interface CombinedConfigStepProps {
  combinedConfigTab: 'mcq' | 'programming';
  setCombinedConfigTab: (tab: 'mcq' | 'programming') => void;
  validationErrors: any;
  mcqContent: React.ReactNode;
  programmingContent: React.ReactNode;
}

export const CombinedConfigStep: React.FC<CombinedConfigStepProps> = ({
  combinedConfigTab,
  setCombinedConfigTab,
  validationErrors,
  mcqContent,
  programmingContent,
}) => {
  const mcqHasError = Object.keys(validationErrors).some(k => k.startsWith('mcq') || k === 'mcqTotalMarks');
  const progHasError = Object.keys(validationErrors).some(k => k.startsWith('programming') || k === 'programmingTotalMarks' || k === 'programmingLevelScoring');

  return (
    <div>
      {/* Tab header */}
      <div className="flex items-center gap-0 px-10 pt-3 pb-0 border-b" style={{ borderColor: D.border }}>
        <button
          type="button"
          onClick={() => setCombinedConfigTab('mcq')}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px"
          style={{
            borderBottomColor: combinedConfigTab === 'mcq' ? D.orange : 'transparent',
            color: combinedConfigTab === 'mcq' ? D.orange : D.textMuted,
            background: 'transparent',
          }}
        >
          <List size={11} />
          MCQ Config
          {mcqHasError && (
            <span className="ml-1 w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: D.red, color: '#fff' }}>
              <AlertCircle size={8} strokeWidth={3} />
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCombinedConfigTab('programming')}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold transition-all border-b-2 -mb-px"
          style={{
            borderBottomColor: combinedConfigTab === 'programming' ? D.orange : 'transparent',
            color: combinedConfigTab === 'programming' ? D.orange : D.textMuted,
            background: 'transparent',
          }}
        >
          <Terminal size={11} />
          Programming Config
          {progHasError && (
            <span className="ml-1 w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: D.red, color: '#fff' }}>
              <AlertCircle size={8} strokeWidth={3} />
            </span>
          )}
        </button>
      </div>
      {/* Tab content (children provide their own px-10) */}
      <div>
        {combinedConfigTab === 'mcq' ? mcqContent : programmingContent}
      </div>
    </div>
  );
};
