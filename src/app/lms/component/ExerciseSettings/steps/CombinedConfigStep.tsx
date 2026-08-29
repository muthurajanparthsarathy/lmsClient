import React from 'react';
import { List, Terminal } from 'lucide-react';
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

const segBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 27,
  padding: '0 12px',
  borderRadius: 5,
  border: 'none',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s',
  background: active ? '#fff' : 'transparent',
  color: active ? D.orangeDark : D.textMuted,
  boxShadow: active ? '0 1px 3px rgba(15,23,42,.1)' : 'none',
});

const errorDotStyle: React.CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background: D.red,
  flexShrink: 0,
};

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
      {/* Tab header — spec segmented control */}
      <div style={{ padding: '14px 22px 0' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: 3, borderRadius: 8,
          background: D.surface2,
          border: `1px solid ${D.border2}`,
        }}>
          <button
            type="button"
            onClick={() => setCombinedConfigTab('mcq')}
            aria-pressed={combinedConfigTab === 'mcq'}
            style={segBtnStyle(combinedConfigTab === 'mcq')}
          >
            <List size={11} />
            MCQ Config
            {mcqHasError && <span style={errorDotStyle} />}
          </button>
          <button
            type="button"
            onClick={() => setCombinedConfigTab('programming')}
            aria-pressed={combinedConfigTab === 'programming'}
            style={segBtnStyle(combinedConfigTab === 'programming')}
          >
            <Terminal size={11} />
            Programming Config
            {progHasError && <span style={errorDotStyle} />}
          </button>
        </div>
      </div>
      {/* Tab content (children provide their own horizontal padding) */}
      <div>
        {combinedConfigTab === 'mcq' ? mcqContent : programmingContent}
      </div>
    </div>
  );
};
