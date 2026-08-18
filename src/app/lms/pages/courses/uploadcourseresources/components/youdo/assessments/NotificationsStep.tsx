// NotificationsStep.tsx
import React from 'react';
import { Bell, UserCheck, Clock } from 'lucide-react';
import { D } from './constants';
import { FormDataType } from './types';

interface NotificationsStepProps {
  formData: FormDataType;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  D: any;
}

export const NotificationsStep: React.FC<NotificationsStepProps> = ({ formData, setFormData, D }) => {
  const rows = [
    { key: 'notifyGradersSubmissions', label: 'Notify Graders about Submissions', description: formData.notifications.notifyGradersSubmissions ? 'Graders will receive alerts when students submit.' : 'Graders will not receive alerts when students submit.', icon: <UserCheck size={14} />, color: D.blue, value: formData.notifications.notifyGradersSubmissions, onChange: (v: boolean) => setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, notifyGradersSubmissions: v } })) },
    { key: 'notifyGradersLateSubmissions', label: 'Notify Graders about Late Submissions', description: formData.notifications.notifyGradersLateSubmissions ? 'Graders will receive alerts for late submissions.' : 'No alerts for late submissions.', icon: <Clock size={14} />, color: D.amber, value: formData.notifications.notifyGradersLateSubmissions, onChange: (v: boolean) => setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, notifyGradersLateSubmissions: v } })) },
    { key: 'notifyStudent', label: 'Notify Student', description: formData.notifications.notifyStudent ? 'Students will be notified when grades/feedback are released.' : 'Students will not be notified about grades or feedback.', icon: <Bell size={14} />, color: D.orange, value: formData.notifications.notifyStudent, onChange: (v: boolean) => setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, notifyStudent: v } })) },
  ];

  return (
    <div className="px-10 pt-4 pb-6">
      <div>
        <div className="space-y-2">{rows.map(row => (<div key={row.key} className="flex items-start gap-2.5 p-3 rounded-xl border" style={{ borderColor: D.border, background: D.bg }}><div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: row.color + '12', color: row.color }}>{row.icon}</div><div className="flex-1"><div className="flex items-center gap-2"><div className="text-xs font-semibold leading-tight" style={{ color: D.textMain, fontFamily: 'Poppins, sans-serif' }}>{row.label}</div><button type="button" onClick={() => row.onChange(!row.value)} className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]" style={{ background: row.value ? D.emerald : '#e2e3e8' }}><span className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${row.value ? 'translate-x-[17px]' : 'translate-x-0'}`} /></button><span className="text-[10px] font-bold" style={{ color: row.value ? D.emerald : D.red }}>{row.value ? 'Yes' : 'No'}</span></div><div className="text-[10.5px] mt-0.5 leading-relaxed" style={{ color: D.textMuted }}>{row.description}</div></div></div>))}</div></div></div>);
};