'use client';
import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Loader2, Settings2, ShieldCheck } from 'lucide-react';
import { SystemSettings, getSystemSettings, updateSystemSettings } from '@/apiServices/superadmin/settingService';
import { toApiError } from '@/lib/superAdminApiClient';
import { showSuccessToast, showErrorToast } from '@/components/ui/toastUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, Panel } from '../../_components/ui';

const TOGGLES: { key: keyof SystemSettings; label: string; hint: string }[] = [
  { key: 'maintenanceMode', label: 'Maintenance Mode', hint: 'Display a maintenance banner platform-wide' },
  { key: 'allowInstitutionSelfSignup', label: 'Institution Self-Signup', hint: 'Allow institutions to self-register' },
  { key: 'enforceStrongPassword', label: 'Enforce Strong Passwords', hint: 'Require complex passwords' },
  { key: 'emailNotificationsEnabled', label: 'Email Notifications', hint: 'Send transactional emails' },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SystemSettings | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['superadmin', 'settings'], queryFn: getSystemSettings });
  useEffect(() => { if (data?.settings) setForm(data.settings); }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => updateSystemSettings(form!),
    onSuccess: () => { showSuccessToast('System settings saved'); queryClient.invalidateQueries({ queryKey: ['superadmin', 'settings'] }); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const setField = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  if (isLoading || !form) {
    return (
      <div>
        <PageHeader title="System Settings" description="Platform-level configuration." />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="System Settings"
        description="Platform-level configuration."
        actions={
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Settings2 className="h-4 w-4 text-primary" /> General
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Platform Name</Label>
              <Input value={form.platformName} onChange={(e) => setField('platformName', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Support Email</Label>
              <Input type="email" value={form.supportEmail} onChange={(e) => setField('supportEmail', e.target.value)} />
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" /> Security
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Session Timeout (min)</Label>
              <Input type="number" min={5} value={form.sessionTimeoutMinutes} onChange={(e) => setField('sessionTimeoutMinutes', Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Password Min Length</Label>
              <Input type="number" min={4} value={form.passwordMinLength} onChange={(e) => setField('passwordMinLength', Number(e.target.value))} />
            </div>
          </div>
        </Panel>

        <Panel className="p-5 lg:col-span-2">
          <div className="mb-4 text-sm font-semibold text-foreground">Platform Toggles</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TOGGLES.map(({ key, label, hint }) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-border px-3.5 py-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </div>
                <Switch checked={form[key] as boolean} onCheckedChange={(v) => setField(key, v as never)} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
