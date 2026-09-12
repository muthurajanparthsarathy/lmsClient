'use client';
import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Send, Loader2, Bell } from 'lucide-react';
import { getAudience, broadcastNotification } from '@/apiServices/superadmin/notificationService';
import { toApiError } from '@/lib/superAdminApiClient';
import { showSuccessToast, showErrorToast } from '@/components/ui/toastUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader, Panel, FieldSelect, useConfirm } from '../../_components/ui';

const TYPES = ['info', 'success', 'warning', 'error'];

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [institution, setInstitution] = useState('');
  const { confirm, ConfirmHost } = useConfirm();

  const { data } = useQuery({ queryKey: ['superadmin', 'notif-audience'], queryFn: getAudience });
  const institutions = data?.institutions || [];
  const total = data?.total || 0;

  const audience = institution
    ? institutions.find((i) => i._id === institution)?.userCount || 0
    : total;

  const sendMutation = useMutation({
    mutationFn: () => broadcastNotification({ title, message, type, institution: institution || undefined }),
    onSuccess: (res) => {
      showSuccessToast(`Sent to ${res.recipients} user(s)`);
      setTitle(''); setMessage('');
    },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message) { showErrorToast('Title and message are required'); return; }
    const ok = await confirm({
      title: 'Send notification',
      description: `Send this notification to ${audience} user(s)?`,
      confirmLabel: 'Send',
    });
    if (!ok) return;
    sendMutation.mutate();
  };

  return (
    <div>
      <PageHeader title="Notification Management" description="Broadcast a notification to users across the platform." />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="p-5 lg:col-span-2">
          <form onSubmit={handleSend} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Scheduled maintenance" />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Notification body..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <FieldSelect value={type} onChange={setType} className="w-full">
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </FieldSelect>
              </div>
              <div className="space-y-1.5">
                <Label>Target</Label>
                <FieldSelect value={institution} onChange={setInstitution} className="w-full">
                  <option value="">All institutions</option>
                  {institutions.map((i) => <option key={i._id} value={i._id}>{i.inst_name}</option>)}
                </FieldSelect>
              </div>
            </div>
            <Button type="submit" disabled={sendMutation.isPending}>
              {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Notification
            </Button>
          </form>
        </Panel>

        <Panel className="flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-6 w-6" />
          </div>
          <div className="text-3xl font-semibold text-foreground">{audience}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            recipient(s) {institution ? 'in this institution' : 'across all institutions'}
          </div>
        </Panel>
      </div>

      <ConfirmHost />
    </div>
  );
}
