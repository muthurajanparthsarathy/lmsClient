'use client';
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, BookOpen, Boxes, ListTree, ShieldCheck, KeyRound, HardDrive, Sparkles, CheckCircle2, XCircle,
} from 'lucide-react';
import { getInstitutionDetails } from '@/apiServices/superadmin/reportService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '../../_components/ui';
import { cn } from '@/lib/utils';

const RES_TYPE_LABELS: Record<string, string> = {
  ppt: 'PPT', pdf: 'PDF', videos: 'Videos', image: 'Image',
  document: 'Document', zip: 'ZIP/RAR', url: 'URL/Link', other: 'Other',
};

function Section({ icon: Icon, title, count, children }: { icon: React.ElementType; title: string; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" /> {title}
        {count != null && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs', on ? 'bg-[var(--success-bg)] text-[var(--success-fg)]' : 'bg-muted text-muted-foreground')}>
      {on ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {label}
    </span>
  );
}

export default function InstitutionDetailsModal({ institutionId, onClose }: { institutionId: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'institution-details', institutionId],
    queryFn: () => getInstitutionDetails(institutionId!),
    enabled: !!institutionId,
  });

  const c = data?.counts;
  const countTiles = c
    ? [
        { label: 'Users', value: c.users, icon: Users },
        { label: 'Courses', value: c.courses, icon: BookOpen },
        { label: 'Modules', value: c.modules, icon: Boxes },
        { label: 'Sub-modules', value: c.subModules, icon: Boxes },
        { label: 'Topics', value: c.topics, icon: ListTree },
        { label: 'Sub-topics', value: c.subTopics, icon: ListTree },
        { label: 'I Do', value: c.iDo, icon: Sparkles },
        { label: 'We Do', value: c.weDo, icon: Sparkles },
        { label: 'You Do', value: c.youDo, icon: Sparkles },
      ]
    : [];

  const iDoTypes = data?.resources?.iDo?.types || {};
  const enabledResTypes = Object.entries(iDoTypes).filter(([, v]) => v?.enabled);

  return (
    <Dialog open={!!institutionId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Institution Details</DialogTitle>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                {data.institution.inst_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-foreground">{data.institution.inst_name}</div>
                <div className="text-xs text-muted-foreground">
                  {data.institution.inst_id} · Owner: {data.institution.inst_owner || '—'} · {data.institution.phone || '—'}
                </div>
              </div>
              <StatusBadge status={data.institution.status === 'active' ? 'success' : 'danger'}>{data.institution.status}</StatusBadge>
            </div>

            {/* Count tiles */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
              {countTiles.map((t) => (
                <div key={t.label} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><t.icon className="h-3.5 w-3.5" /> {t.label}</div>
                  <div className="mt-0.5 text-lg font-semibold text-foreground">{t.value.toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* Roles */}
            <Section icon={ShieldCheck} title="Roles" count={data.roles.length}>
              {data.roles.length === 0 ? (
                <p className="text-xs text-muted-foreground">No roles created.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {data.roles.map((r) => (
                    <span key={r._id} className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs">
                      <span className="font-medium text-foreground">{r.name}</span>
                      <span className="rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">{r.userCount} users</span>
                    </span>
                  ))}
                </div>
              )}
            </Section>

            {/* Courses */}
            <Section icon={BookOpen} title="Courses" count={data.courses.length}>
              {data.courses.length === 0 ? (
                <p className="text-xs text-muted-foreground">No courses yet.</p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {data.courses.map((co) => (
                    <div key={co._id} className="flex items-center justify-between rounded-md border border-border px-2.5 py-1.5 text-xs">
                      <span className="font-medium text-foreground">{co.name}</span>
                      <span className="text-muted-foreground">{[co.clientName, co.serviceType].filter(Boolean).join(' · ') || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Permissions */}
            <Section icon={KeyRound} title="Permissions" count={data.permissions.length}>
              {data.permissions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No permission allow-list set for this institution.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.permissions.map((p) => (
                    <div key={p.permissionKey + p.permissionName} className="rounded-md border border-border px-2.5 py-1.5">
                      <div className="text-xs font-medium text-foreground">{p.permissionName}</div>
                      {p.functions.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.functions.map((f) => (
                            <span key={f} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Resources */}
            <Section icon={HardDrive} title="Resources">
              {!data.resources ? (
                <p className="text-xs text-muted-foreground">No resource configuration.</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-muted-foreground">I Do — enabled types</div>
                    {enabledResTypes.length === 0 ? (
                      <p className="text-xs text-muted-foreground">None enabled.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {enabledResTypes.map(([k]) => (
                          <span key={k} className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">{RES_TYPE_LABELS[k] || k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="mb-1 text-[11px] font-medium text-muted-foreground">We Do</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Flag on={!!data.resources.weDo?.aiAssistant} label="AI Assistant" />
                        <Flag on={!!data.resources.weDo?.autoQuestionGenerate} label="Auto Questions" />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-medium text-muted-foreground">You Do</div>
                      <div className="flex flex-wrap gap-1.5">
                        <Flag on={!!data.resources.youDo?.aiAssistant} label="AI Assistant" />
                        <Flag on={!!data.resources.youDo?.autoQuestionGenerate} label="Auto Questions" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
