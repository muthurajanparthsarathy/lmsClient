import { SettingsHelp } from '../SettingsHelp';
import React from 'react';
import { Home, Mail, MessageCircle } from 'lucide-react';
import { D as sharedColors, FONT } from '../../../pages/courses/uploadcourseresources/components/youdo/assessments/shared/tokens';
const D = { ...sharedColors, orange: '#EE6A22', orangeDark: '#D65A16', orangeLight: '#FDF0E9', orangeMed: '#FADFCE', orangeGlow: '#FADFCE', border: '#e0e5eb', border2: '#b6c0cb', surface: '#f7f9fc', surface2: '#f1f5f9' };
import styles from '../AssignmentSettings.module.css';

// ── Props ────────────────────────────────────────────────────────────────────
// Loose `formData: any` mirrors the parent's existing typing — no behavioural
// change, no type tightening.
interface NotificationsStepProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
}

// ── FormRow ──────────────────────────────────────────────────────────────────
// Same 306px-label + control shape as ExerciseDetailsStep. Keeps every step
// visually consistent (label on the left, teal ? tooltip, control on the
// right, helper text under the control).
function FormRow({ label, help, required, children, note }: {
  label: string;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldLabel}>
        <label>{label}{required && <span className={styles.required} aria-label="required">*</span>}</label>
        {help && <SettingsHelp content={help} />}
      </div>
      <div className={styles.fieldControl}>
        {children}
        {note && <p className={styles.fieldNote}>{note}</p>}
      </div>
    </div>
  );
}

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

// ── Section title — matches ExerciseDetailsStep's group titles: orange band
// with a hairline. Used to separate Graders / Students groups.
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    margin: '4px 0 10px', padding: '0 12px',
  }}>
    <span style={{
      fontSize: 13, fontWeight: 600, color: D.textMain,
      letterSpacing: '-.005em', whiteSpace: 'nowrap',
      fontFamily: FONT,
    }}>{children}</span>
    <span aria-hidden style={{ flex: 1, height: 1, background: D.border }} />
  </div>
);

// ── NotificationsStep ────────────────────────────────────────────────────────
// Restyled to match the ExerciseDetailsStep field-row layout: 306px label
// column on the left with a teal ? tooltip, control column on the right with
// the toggle + channels. Business logic (formData shape, setters, isGraded
// branching, channel keys) is unchanged.
export const NotificationsStep: React.FC<NotificationsStepProps> = ({
  formData,
  setFormData,
}) => {
  const channelOptions = [
    { key: 'dashboard', label: 'Dashboard', icon: <Home size={12} /> },
    { key: 'gmail',     label: 'Gmail',     icon: <Mail size={12} /> },
    { key: 'whatsapp',  label: 'WhatsApp',  icon: <MessageCircle size={12} /> },
  ];

  const studentOnlyRow = {
    key: 'notifyStudent',
    label: 'Notify Student',
    help: 'Send alerts to students when the exercise becomes available.',
    onDesc: 'Students will be notified when the exercise is available.',
    offDesc: 'Students will not be notified about this exercise.',
    value: formData.notifications.notifyStudent,
    onChange: (v: boolean) => setFormData((prev: any) => ({ ...prev, notifications: { ...prev.notifications, notifyStudent: v } })),
    channels: {
      dashboard: formData.notifications.notifyStudentChannels?.dashboard ?? false,
      gmail:     formData.notifications.notifyStudentChannels?.gmail ?? false,
      whatsapp:  formData.notifications.notifyStudentChannels?.whatsapp ?? false,
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

  const graderRows = [
    {
      key: 'notifyGradersSubmissions',
      label: 'Notify Graders about Submissions',
      help: 'Send an alert to graders each time a student submits.',
      onDesc: 'Graders will receive alerts when students submit.',
      offDesc: 'Graders will not receive alerts when students submit.',
      value: formData.notifications.notifyGradersSubmissions,
      onChange: (v: boolean) => setFormData((prev: any) => ({ ...prev, notifications: { ...prev.notifications, notifyGradersSubmissions: v } })),
      channels: {
        dashboard: formData.notifications.notifyGradersSubmissionsChannels?.dashboard ?? false,
        gmail:     formData.notifications.notifyGradersSubmissionsChannels?.gmail ?? false,
        whatsapp:  formData.notifications.notifyGradersSubmissionsChannels?.whatsapp ?? false,
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
      help: 'Only send alerts when a submission arrives during the grace period.',
      onDesc: 'Graders will receive alerts for late submissions.',
      offDesc: 'No alerts for late submissions.',
      value: formData.notifications.notifyGradersLateSubmissions,
      onChange: (v: boolean) => setFormData((prev: any) => ({ ...prev, notifications: { ...prev.notifications, notifyGradersLateSubmissions: v } })),
      channels: {
        dashboard: formData.notifications.notifyGradersLateSubmissionsChannels?.dashboard ?? false,
        gmail:     formData.notifications.notifyGradersLateSubmissionsChannels?.gmail ?? false,
        whatsapp:  formData.notifications.notifyGradersLateSubmissionsChannels?.whatsapp ?? false,
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

  const renderNotifyRow = (row: any) => (
    <FormRow
      key={row.key}
      label={row.label}
      help={row.help}
      note={row.value ? row.onDesc : row.offDesc}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 32 }}>
        <SpecSwitch on={!!row.value} onClick={() => row.onChange(!row.value)} />
        <span style={{
          fontSize: 15, fontWeight: 700,
          color: row.value ? D.emerald : D.textHint,
          fontFamily: FONT,
        }}>
          {row.value ? 'On' : 'Off'}
        </span>
      </div>

      {/* Channel picker — indented block that appears only when the row is On. */}
      {row.value && (
        <div style={{
          marginTop: 12, padding: '10px 14px',
          borderRadius: 8, background: D.surface,
          border: `1px solid ${D.border}`,
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 18,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#101828', fontFamily: FONT }}>
            Notify via:
          </span>
          {channelOptions.map(ch => (
            <label key={ch.key}
              className="flex items-center cursor-pointer select-none"
              style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={row.channels[ch.key]}
                onChange={(e) => row.onChannelChange(ch.key, e.target.checked)}
                style={{ width: 16, height: 16, accentColor: D.orange, cursor: 'pointer' }}
              />
              <span className="flex items-center" style={{ gap: 6 }}>
                <span style={{ color: D.textMuted }}>{ch.icon}</span>
                <span style={{ fontSize: 14, color: D.textSub, fontFamily: FONT }}>
                  {ch.label}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </FormRow>
  );

  return (
    <div style={{ fontFamily: FONT }}>
      {formData.isGraded !== false ? (
        <>
          <SectionTitle>Graders</SectionTitle>
          <div className={styles.generalFields}>
            {graderRows.map(row => renderNotifyRow(row))}
          </div>
          <SectionTitle>Students</SectionTitle>
          <div className={styles.generalFields}>
            {renderNotifyRow(studentOnlyRow)}
          </div>
        </>
      ) : (
        <>
          <SectionTitle>Students</SectionTitle>
          <div className={styles.generalFields}>
            {renderNotifyRow(studentOnlyRow)}
          </div>
        </>
      )}
    </div>
  );
};
