import React from 'react';
import { Bell, Clock, Home, Mail, MessageCircle, UserCheck } from 'lucide-react';
import { D, FONT } from '../shared/tokens';

// ── Props ────────────────────────────────────────────────────────────────────
// Loose `formData: any` mirrors the parent's existing typing — no behavioural
// change, no type tightening.
interface NotificationsStepProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

// ── SectionHeading ───────────────────────────────────────────────────────────
// Same orange-title + hairline pattern used in ScheduleStep and
// ExerciseDetailsStep so the wizard reads as one flat surface across steps.
const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 10px' }}>
    <span style={{
      fontSize: 12, fontWeight: 700, color: D.orange, letterSpacing: '-.01em',
      whiteSpace: 'nowrap', textTransform: 'none', fontFamily: FONT,
    }}>
      {children}
    </span>
    <span aria-hidden style={{ flex: 1, height: 1, background: D.border }} />
  </div>
);

// ── SpecSwitch ───────────────────────────────────────────────────────────────
// Local copy of the 35×20 emerald switch used across the settings wizard.
const SpecSwitch: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onClick}
    className="relative flex-shrink-0"
    style={{
      width: 35, height: 20, borderRadius: 999, padding: 0, border: 'none',
      background: on ? D.emerald : '#DEDAD5', cursor: 'pointer', transition: 'background .16s',
    }}
  >
    <span
      style={{
        position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        transition: 'transform .16s', transform: on ? 'translateX(15px)' : 'translateX(0)',
      }}
    />
  </button>
);

// ── NotificationsStep ────────────────────────────────────────────────────────
// Rows share the ScheduleStep layout — flat white surface, 36px pale icon tile,
// 11px/600/#101828 label with an inline description, right-aligned toggle +
// On/Off status. When a row is ON its channel checkboxes fan out below,
// indented under the label so they align with the row above.
export const NotificationsStep: React.FC<NotificationsStepProps> = ({
  formData,
  setFormData,
}) => {
  // Channel options definition
  const channelOptions = [
    { key: 'dashboard', label: 'Dashboard', icon: <Home size={12} />, color: D.blue },
    { key: 'gmail', label: 'Gmail', icon: <Mail size={12} />, color: D.blue },
    { key: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={12} />, color: D.blue },
  ];

  // Student-only row for Non-Graded exercises
  const studentOnlyRow = {
    key: 'notifyStudent',
    label: 'Notify Student',
    description: formData.notifications.notifyStudent
      ? 'Students will be notified when the exercise is available.'
      : 'Students will not be notified about this exercise.',
    icon: <Bell size={16} />,
    iconColor: D.orange,
    iconBg: 'rgba(255,90,18,0.10)',
    value: formData.notifications.notifyStudent,
    onChange: (v: boolean) => setFormData((prev: any) => ({ ...prev, notifications: { ...prev.notifications, notifyStudent: v } })),
    channels: {
      dashboard: formData.notifications.notifyStudentChannels?.dashboard ?? false,
      gmail: formData.notifications.notifyStudentChannels?.gmail ?? false,
      whatsapp: formData.notifications.notifyStudentChannels?.whatsapp ?? false,
    },
    onChannelChange: (channelKey: string, value: boolean) => {
      setFormData((prev: any) => ({
        ...prev,
        notifications: {
          ...prev.notifications,
          notifyStudentChannels: {
            ...prev.notifications.notifyStudentChannels,
            [channelKey]: value,
          },
        },
      }));
    },
  };

  // Grader rows - only for Graded exercises
  const graderRows = [
    {
      key: 'notifyGradersSubmissions',
      label: 'Notify Graders about Submissions',
      description: formData.notifications.notifyGradersSubmissions
        ? 'Graders will receive alerts when students submit.'
        : 'Graders will not receive alerts when students submit.',
      icon: <UserCheck size={16} />,
      iconColor: D.blue,
      iconBg: 'rgba(59,130,246,0.10)',
      value: formData.notifications.notifyGradersSubmissions,
      onChange: (v: boolean) => setFormData((prev: any) => ({ ...prev, notifications: { ...prev.notifications, notifyGradersSubmissions: v } })),
      channels: {
        dashboard: formData.notifications.notifyGradersSubmissionsChannels?.dashboard ?? false,
        gmail: formData.notifications.notifyGradersSubmissionsChannels?.gmail ?? false,
        whatsapp: formData.notifications.notifyGradersSubmissionsChannels?.whatsapp ?? false,
      },
      onChannelChange: (channelKey: string, value: boolean) => {
        setFormData((prev: any) => ({
          ...prev,
          notifications: {
            ...prev.notifications,
            notifyGradersSubmissionsChannels: {
              ...prev.notifications.notifyGradersSubmissionsChannels,
              [channelKey]: value,
            },
          },
        }));
      },
    },
    {
      key: 'notifyGradersLateSubmissions',
      label: 'Notify Graders about Late Submissions',
      description: formData.notifications.notifyGradersLateSubmissions
        ? 'Graders will receive alerts for late submissions.'
        : 'No alerts for late submissions.',
      icon: <Clock size={16} />,
      iconColor: D.amber,
      iconBg: 'rgba(245,158,11,0.10)',
      value: formData.notifications.notifyGradersLateSubmissions,
      onChange: (v: boolean) => setFormData((prev: any) => ({ ...prev, notifications: { ...prev.notifications, notifyGradersLateSubmissions: v } })),
      channels: {
        dashboard: formData.notifications.notifyGradersLateSubmissionsChannels?.dashboard ?? false,
        gmail: formData.notifications.notifyGradersLateSubmissionsChannels?.gmail ?? false,
        whatsapp: formData.notifications.notifyGradersLateSubmissionsChannels?.whatsapp ?? false,
      },
      onChannelChange: (channelKey: string, value: boolean) => {
        setFormData((prev: any) => ({
          ...prev,
          notifications: {
            ...prev.notifications,
            notifyGradersLateSubmissionsChannels: {
              ...prev.notifications.notifyGradersLateSubmissionsChannels,
              [channelKey]: value,
            },
          },
        }));
      },
    },
  ];

  // Flat row matching the ScheduleStep field row: icon tile + label +
  // description + toggle + On/Off. Divider under every row except the last
  // in its section (the parent list applies `isLast`).
  const renderNotifyRow = (row: any, isLast: boolean) => (
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
        {/* Icon tile */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{ width: 36, height: 36, background: row.iconBg, color: row.iconColor, borderRadius: 8 }}
        >
          {row.icon}
        </div>

        {/* Label + description */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 240, flex: 1, gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: FONT, lineHeight: 1.25 }}>
            {row.label}
          </span>
          <span style={{ fontSize: 11.4, color: D.textMuted, lineHeight: 1.4, fontFamily: FONT }}>
            {row.description}
          </span>
        </div>

        {/* Toggle + status */}
        <div className="flex items-center" style={{ gap: 8 }}>
          <SpecSwitch on={!!row.value} onClick={() => row.onChange(!row.value)} />
          <span style={{ fontSize: 11, fontWeight: 700, color: row.value ? D.emerald : D.textHint }}>
            {row.value ? 'On' : 'Off'}
          </span>
        </div>
      </div>

      {/* Channel checkboxes — indented under the label column when ON. */}
      {row.value && (
        <div style={{ paddingLeft: 48 }}>
          <div
            className="flex items-center flex-wrap"
            style={{
              gap: 16,
              padding: '8px 12px',
              borderRadius: 8,
              background: D.surface,
              border: `1px solid ${D.border}`,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: FONT }}>
              Notify via:
            </span>
            {channelOptions.map(ch => (
              <label
                key={ch.key}
                className="flex items-center cursor-pointer select-none"
                style={{ gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={row.channels[ch.key]}
                  onChange={(e) => row.onChannelChange(ch.key, e.target.checked)}
                  className="rounded cursor-pointer"
                  style={{ width: 14, height: 14, accentColor: D.orange }}
                />
                <span className="flex items-center" style={{ gap: 5 }}>
                  <span style={{ color: D.textMuted }}>{ch.icon}</span>
                  <span style={{ fontSize: 12, color: D.textSub, fontFamily: FONT }}>
                    {ch.label}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: '16px 32px 24px', maxWidth: 1200, fontFamily: FONT }}>
      {/* Page heading is rendered by the parent wizard from STEP_META so we
          don't stack a duplicate here — same pattern as ScheduleStep. */}

      {formData.isGraded !== false ? (
        <>
          {/* ── GRADERS ─────────────────────────────────────────────── */}
          <SectionHeading>Graders</SectionHeading>
          <div>
            {graderRows.map((row, i) => renderNotifyRow(row, i === graderRows.length - 1))}
          </div>

          {/* ── STUDENTS ────────────────────────────────────────────── */}
          <div style={{ marginTop: 20 }}>
            <SectionHeading>Students</SectionHeading>
            <div>
              {renderNotifyRow(studentOnlyRow, true)}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ── STUDENTS (Non-graded — only surface) ────────────────── */}
          <SectionHeading>Students</SectionHeading>
          <div>
            {renderNotifyRow(studentOnlyRow, true)}
          </div>
        </>
      )}
    </div>
  );
};
