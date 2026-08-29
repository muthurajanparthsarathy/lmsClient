import React from 'react';
import { Bell, Clock, Home, Mail, MessageCircle, UserCheck } from 'lucide-react';
import { D, FONT } from '../shared/tokens';

// ── Props ────────────────────────────────────────────────────────────────────
// Loose `formData: any` mirrors the parent's existing typing — no behavioural
// change, no type tightening during extraction.
interface NotificationsStepProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

// ── NotificationsStep ────────────────────────────────────────────────────────
// Lifted verbatim from renderNotifications in ExerciseSettings.tsx. Same toggle
// rows, same channel checkboxes, same Graded vs Non-Graded branching.
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
    icon: <Bell size={14} />,
    color: D.orange,
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
      icon: <UserCheck size={14} />,
      color: D.blue,
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
      icon: <Clock size={14} />,
      color: D.amber,
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

  // Spec card row: title 12.6/600 ink, dynamic description 11.4 muted, green
  // switch right-aligned with On/Off state label; channel strip is a lighter
  // sub-row (wash bg, radius 8) shown under the SAME `row.value` conditional.
  // Pure markup/styling — reads and handlers are the row object's, unchanged.
  const renderNotifyRow = (row: any) => (
    <div
      key={row.key}
      style={{ border: `1px solid ${D.border2}`, borderRadius: 11, background: '#fff', padding: 13 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-2.5 flex-1 mr-3">
          <div
            className="w-7 h-7 flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: row.color + '12', color: row.color, borderRadius: 8 }}
          >
            {row.icon}
          </div>
          <div>
            <div className="leading-tight" style={{ fontSize: 12.6, fontWeight: 600, color: D.textMain, fontFamily: FONT }}>
              {row.label}
            </div>
            <div className="mt-0.5" style={{ fontSize: 11.4, lineHeight: 1.5, color: D.textMuted }}>
              {row.description}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span style={{ fontSize: 11, fontWeight: 700, color: row.value ? D.emerald : D.textHint }}>
            {row.value ? 'On' : 'Off'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={!!row.value}
            onClick={() => row.onChange(!row.value)}
            className="relative flex-shrink-0"
            style={{
              width: 35, height: 20, borderRadius: 999, padding: 0, border: 'none',
              background: row.value ? D.emerald : '#DEDAD5', cursor: 'pointer', transition: 'background .16s',
            }}
          >
            <span
              style={{
                position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
                background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
                transition: 'transform .16s', transform: row.value ? 'translateX(15px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>
      </div>

      {/* Channel checkboxes — lighter sub-row shown when toggled ON */}
      {row.value && (
        <div
          className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ background: D.surface, borderRadius: 8, padding: '8px 10px' }}
        >
          <div className="flex items-center gap-4 flex-wrap">
            <span style={{ fontSize: 11, fontWeight: 600, color: '#4B5563' }}>
              Notify via:
            </span>
            {channelOptions.map(ch => (
              <label
                key={ch.key}
                className="flex items-center cursor-pointer select-none"
                style={{ gap: 7 }}
              >
                <input
                  type="checkbox"
                  checked={row.channels[ch.key]}
                  onChange={(e) => row.onChannelChange(ch.key, e.target.checked)}
                  className="rounded cursor-pointer"
                  style={{ width: 15, height: 15, accentColor: D.orange }}
                />
                <span className="flex items-center gap-1.5">
                  <span style={{ color: D.textMuted }}>
                    {ch.icon}
                  </span>
                  <span style={{ fontSize: 12.3, color: D.textSub }}>
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
    <div className="flex flex-col" style={{ padding: '18px 22px', gap: 13 }}>
      {/* For Graded exercises: show all rows */}
      {formData.isGraded !== false && (
        <>
          {graderRows.map(row => renderNotifyRow(row))}

          {/* Student notification row (for Graded) */}
          {renderNotifyRow(studentOnlyRow)}
        </>
      )}

      {/* For Non-Graded exercises: show ONLY the Student row */}
      {formData.isGraded === false && (
        <>
          <p style={{ fontSize: 11.4, lineHeight: 1.5, color: D.textMuted, margin: 0 }}>
            Students will be notified when the exercise becomes available.
          </p>
          {renderNotifyRow(studentOnlyRow)}
        </>
      )}
    </div>
  );
};
