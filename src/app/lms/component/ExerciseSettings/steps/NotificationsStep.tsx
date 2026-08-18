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

  return (
    <div className="px-10 pt-4 pb-6">
      {/* For Graded exercises: show all rows */}
      {formData.isGraded !== false && (
        <>
          <div className="space-y-2 mb-4">
            {graderRows.map(row => (
              <div key={row.key}>
                {/* Main toggle row */}
                <div className="flex items-start justify-between p-3 rounded-xl border"
                  style={{ borderColor: D.border, background: D.bg }}>
                  <div className="flex items-start gap-2.5 flex-1 mr-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: row.color + '12', color: row.color }}>
                      {row.icon}
                    </div>
                    <div>
                      <div className="text-xs font-semibold leading-tight"
                        style={{ color: D.textMain, fontFamily: FONT }}>
                        {row.label}
                      </div>
                      <div className="text-[10.5px] mt-0.5 leading-relaxed"
                        style={{ color: D.textMuted }}>
                        {row.description}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-bold"
                      style={{ color: row.value ? D.emerald : D.red }}>
                      {row.value ? 'Yes' : 'No'}
                    </span>
                    <button type="button" onClick={() => row.onChange(!row.value)}
                      className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
                      style={{ background: row.value ? D.emerald : '#e5e7eb' }}>
                      <span className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${row.value ? 'translate-x-[17px]' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                {/* Channel checkboxes — single row below when toggled ON */}
                {row.value && (
                  <div className="mt-1 ml-4 p-3 rounded-lg border animate-in fade-in slide-in-from-top-1 duration-150"
                    style={{ borderColor: D.border, background: D.surface }}>
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-[10px] font-medium" style={{ color: D.textMuted }}>
                        Notify via:
                      </span>
                      {channelOptions.map(ch => (
                        <label
                          key={ch.key}
                          className="flex items-center gap-2 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={row.channels[ch.key as keyof typeof row.channels]}
                            onChange={(e) => row.onChannelChange(ch.key, e.target.checked)}
                            className="w-3.5 h-3.5 rounded cursor-pointer"
                            style={{ accentColor: D.blue }}
                          />
                          <span className="flex items-center gap-1.5">
                            <span style={{ color: D.blue }}>
                              {ch.icon}
                            </span>
                            <span className="text-[10.5px] font-medium" style={{ color: D.textMain }}>
                              {ch.label}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Student notification row (for Graded) */}
            <div key={studentOnlyRow.key}>
              <div className="flex items-start justify-between p-3 rounded-xl border"
                style={{ borderColor: D.border, background: D.bg }}>
                <div className="flex items-start gap-2.5 flex-1 mr-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: studentOnlyRow.color + '12', color: studentOnlyRow.color }}>
                    {studentOnlyRow.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold leading-tight"
                      style={{ color: D.textMain, fontFamily: FONT }}>
                      {studentOnlyRow.label}
                    </div>
                    <div className="text-[10.5px] mt-0.5 leading-relaxed"
                      style={{ color: D.textMuted }}>
                      {studentOnlyRow.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-bold"
                    style={{ color: studentOnlyRow.value ? D.emerald : D.red }}>
                    {studentOnlyRow.value ? 'Yes' : 'No'}
                  </span>
                  <button type="button" onClick={() => studentOnlyRow.onChange(!studentOnlyRow.value)}
                    className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
                    style={{ background: studentOnlyRow.value ? D.emerald : '#e5e7eb' }}>
                    <span className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${studentOnlyRow.value ? 'translate-x-[17px]' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {studentOnlyRow.value && (
                <div className="mt-1 ml-4 p-3 rounded-lg border animate-in fade-in slide-in-from-top-1 duration-150"
                  style={{ borderColor: D.border, background: D.surface }}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-[10px] font-medium" style={{ color: D.textMuted }}>
                      Notify via:
                    </span>
                    {channelOptions.map(ch => (
                      <label
                        key={ch.key}
                        className="flex items-center gap-2 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={studentOnlyRow.channels[ch.key as keyof typeof studentOnlyRow.channels]}
                          onChange={(e) => studentOnlyRow.onChannelChange(ch.key, e.target.checked)}
                          className="w-3.5 h-3.5 rounded cursor-pointer"
                          style={{ accentColor: D.blue }}
                        />
                        <span className="flex items-center gap-1.5">
                          <span style={{ color: D.blue }}>
                            {ch.icon}
                          </span>
                          <span className="text-[10.5px] font-medium" style={{ color: D.textMain }}>
                            {ch.label}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* For Non-Graded exercises: show ONLY the Student row */}
      {formData.isGraded === false && (
        <>
          <p className="text-xs mb-3" style={{ color: D.textMuted }}>
            Students will be notified when the exercise becomes available.
          </p>
          <div className="space-y-2">
            <div key={studentOnlyRow.key}>
              <div className="flex items-start justify-between p-3 rounded-xl border"
                style={{ borderColor: D.border, background: D.bg }}>
                <div className="flex items-start gap-2.5 flex-1 mr-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ background: studentOnlyRow.color + '12', color: studentOnlyRow.color }}>
                    {studentOnlyRow.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold leading-tight"
                      style={{ color: D.textMain, fontFamily: FONT }}>
                      {studentOnlyRow.label}
                    </div>
                    <div className="text-[10.5px] mt-0.5 leading-relaxed"
                      style={{ color: D.textMuted }}>
                      {studentOnlyRow.description}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[10px] font-bold"
                    style={{ color: studentOnlyRow.value ? D.emerald : D.red }}>
                    {studentOnlyRow.value ? 'Yes' : 'No'}
                  </span>
                  <button type="button" onClick={() => studentOnlyRow.onChange(!studentOnlyRow.value)}
                    className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
                    style={{ background: studentOnlyRow.value ? D.emerald : '#e5e7eb' }}>
                    <span className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${studentOnlyRow.value ? 'translate-x-[17px]' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {studentOnlyRow.value && (
                <div className="mt-1 ml-4 p-3 rounded-lg border animate-in fade-in slide-in-from-top-1 duration-150"
                  style={{ borderColor: D.border, background: D.surface }}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-[10px] font-medium" style={{ color: D.textMuted }}>
                      Notify via:
                    </span>
                    {channelOptions.map(ch => (
                      <label
                        key={ch.key}
                        className="flex items-center gap-2 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          checked={studentOnlyRow.channels[ch.key as keyof typeof studentOnlyRow.channels]}
                          onChange={(e) => studentOnlyRow.onChannelChange(ch.key, e.target.checked)}
                          className="w-3.5 h-3.5 rounded cursor-pointer"
                          style={{ accentColor: D.blue }}
                        />
                        <span className="flex items-center gap-1.5">
                          <span style={{ color: D.blue }}>
                            {ch.icon}
                          </span>
                          <span className="text-[10.5px] font-medium" style={{ color: D.textMain }}>
                            {ch.label}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
