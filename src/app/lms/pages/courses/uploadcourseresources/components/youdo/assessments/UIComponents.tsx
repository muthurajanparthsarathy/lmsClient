// UIComponents.tsx
// ─────────────────────────────────────────────────────────────────────────────
// These controls are now a direct re-export of the ExerciseSettings shared
// palette so the Create Assessment modal reuses the same input, dropdown,
// toggle, date-row, section-label, and grade-row components as the Assignment /
// Exercise Settings modal (client/src/app/lms/component/ExerciseSettings/
// shared/UIComponents.tsx). All existing import paths keep working — the
// Assessment surface now inherits the shared visual design system verbatim.
//
// See 2026-09-01 shell redesign: CreateAssessmentModal.tsx was rebuilt to the
// Assignment setup mockup, and step files that reach into these controls
// (QuestionConfigurationSteps, ProgrammingConfiguration, ScheduleStep,
// SecuritySettings, GradeSettingsStep, NotificationsStep) now render in the
// same system font stack, 34px input rows, and orange focus rings.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { D, FONT } from './constants';

export {
  InfoTooltip,
  OInput,
  ONumberInput,
  OToggle,
  PortalDropdown,
  ODropdown,
  SpinField,
  MonthDropField,
  ExpandableSection,
  TimePicker,
  SectionLabel,
  GradeRow,
  DateRowPicker,
} from '@/app/lms/component/ExerciseSettings/shared/UIComponents';

// ─── SectionHeading ─────────────────────────────────────────────────────────
// Orange 12px/700 title with a hairline divider extending to the right —
// the same "big bar" section separator used across every ExerciseSettings step
// (ScheduleStep, NotificationsStep, GradeSettingsStep, ExerciseDetailsStep).
// Groups fields into semantic clusters like "Identity", "Format", "Availability".
export const SectionHeading: React.FC<{
  children: React.ReactNode;
  right?: React.ReactNode;
}> = ({ children, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 10px' }}>
    <span style={{
      fontSize: 12, fontWeight: 700, color: D.orange,
      letterSpacing: '-.01em', whiteSpace: 'nowrap', textTransform: 'none',
      fontFamily: FONT,
    }}>
      {children}
    </span>
    <span aria-hidden style={{ flex: 1, height: 1, background: D.border }} />
    {right}
  </div>
);

// ─── StepShell ──────────────────────────────────────────────────────────────
// Consistent step-body wrapper — the padding/max-width used by every reference
// step (NotificationsStep, GradeSettingsStep, ScheduleStep). Callers slot their
// SectionHeading + rows inside; nothing else styles the outer container.
export const StepShell: React.FC<{
  children: React.ReactNode;
  maxWidth?: number;
  style?: React.CSSProperties;
}> = ({ children, maxWidth = 1200, style }) => (
  <div style={{ padding: '16px 32px 24px', maxWidth, fontFamily: FONT, ...style }}>
    {children}
  </div>
);

