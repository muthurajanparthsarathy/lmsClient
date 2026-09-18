// NotificationsStep.tsx
// Restyled 2026-09-01 to match the ExerciseSettings design system —
// flat SectionHeading groups, StepShell wrapper, description subtitles removed
// (per the design pass rule; the "Yes/No" restatement carried no information).
// Field keys, values, and setFormData shapes are unchanged.
import React from 'react';
import { Bell, UserCheck, Clock } from 'lucide-react';
import { FONT } from './constants';
import { FormDataType } from './types';
import { SectionHeading, StepShell, OToggle } from './UIComponents';

interface NotificationsStepProps {
  formData: FormDataType;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  D: any;
}

export const NotificationsStep: React.FC<NotificationsStepProps> = ({ formData, setFormData, D }) => {
  // Grader-side notifications — surfaced under the "Graders" section.
  const graderRows = [
    {
      key: 'notifyGradersSubmissions',
      label: 'Notify Graders about Submissions',
      icon: <UserCheck size={16} />,
      color: D.blue,
      value: formData.notifications.notifyGradersSubmissions,
      onChange: (v: boolean) =>
        setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, notifyGradersSubmissions: v } })),
    },
    {
      key: 'notifyGradersLateSubmissions',
      label: 'Notify Graders about Late Submissions',
      icon: <Clock size={16} />,
      color: D.amber,
      value: formData.notifications.notifyGradersLateSubmissions,
      onChange: (v: boolean) =>
        setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, notifyGradersLateSubmissions: v } })),
    },
  ];

  // Student-side notification — surfaced under the "Students" section.
  const studentRow = {
    key: 'notifyStudent',
    label: 'Notify Student',
    icon: <Bell size={16} />,
    color: D.orange,
    value: formData.notifications.notifyStudent,
    onChange: (v: boolean) =>
      setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, notifyStudent: v } })),
  };

  // Row layout is the ExerciseSettings NotificationsStep reference — icon tile,
  // label, right-aligned OToggle with its inline On/Off status.
  const renderRow = (row: any, isLast: boolean) => (
    <div
      key={row.key}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        paddingTop: 14,
        paddingBottom: 14,
        borderBottom: isLast ? 'none' : `1px solid ${D.border}`,
      }}
    >
      <div className="flex items-center flex-wrap" style={{ gap: 12, minHeight: 40 }}>
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 36, height: 36, background: row.color + '18', color: row.color, borderRadius: 8 }}
        >
          {row.icon}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 240, flex: 1, gap: 2 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#101828',
              fontFamily: FONT,
              lineHeight: 1.25,
            }}
          >
            {row.label}
          </span>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          <OToggle enabled={!!row.value} onChange={row.onChange} inline />
        </div>
      </div>
    </div>
  );

  return (
    <StepShell>
      <SectionHeading>Graders</SectionHeading>
      <div>{graderRows.map((row, i) => renderRow(row, i === graderRows.length - 1))}</div>
      <div style={{ marginTop: 20 }}>
        <SectionHeading>Students</SectionHeading>
        <div>{renderRow(studentRow, true)}</div>
      </div>
    </StepShell>
  );
};
