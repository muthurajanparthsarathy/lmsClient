'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save, Loader2, Settings2, ChevronDown, Sparkles, Wand2, HelpCircle, ArrowLeft,
  Presentation, FileText, Image as ImageIcon, Video, FileArchive, Link as LinkIcon,
  StickyNote, Bot, BookOpen, Users, GraduationCap, Database, HardDrive, AlertTriangle, LucideIcon,
} from 'lucide-react';
import { getAllInstitutions } from '@/apiServices/superadmin/institutionService';
import {
  ResourceSettings, ResourcePedagogy, ResourceTypeConfig, IDoTypeKey, PedagogyFeature,
  getResourceSettings, updateResourceSettings,
} from '@/apiServices/superadmin/resourceService';
import { toApiError } from '@/lib/superAdminApiClient';
import { cn } from '@/lib/utils';
import { showSuccessToast, showErrorToast } from '@/components/ui/toastUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, FieldSelect, EmptyState } from '../../_components/ui';
import { useClientScope, BackToClients } from '../../_components/ClientScope';

// I Do upload types. Only `hasAI` types (ppt/pdf/videos/image) show the AI
// Assistant + AI Summary toggles. Only `hasMaxSize` types show a max file
// size input — url/notes/ai are not size-limited uploads, so none needs one.
type IDoMeta = { key: IDoTypeKey; label: string; description: string; icon: LucideIcon; iconClass: string; accent: string; hasAI: boolean; hasMaxSize: boolean };
const IDO_TYPES: IDoMeta[] = [
  { key: 'ppt', label: 'PPT', description: 'Upload presentation slides', icon: Presentation, iconClass: 'bg-red-500/10 text-red-500', accent: 'border-b-red-400/60', hasAI: true, hasMaxSize: true },
  { key: 'pdf', label: 'PDF', description: 'Upload PDF documents', icon: FileText, iconClass: 'bg-rose-500/10 text-rose-500', accent: 'border-b-rose-400/60', hasAI: true, hasMaxSize: true },
  { key: 'videos', label: 'Videos', description: 'Upload video files', icon: Video, iconClass: 'bg-violet-500/10 text-violet-500', accent: 'border-b-violet-400/60', hasAI: true, hasMaxSize: true },
  { key: 'image', label: 'Image', description: 'Upload image files', icon: ImageIcon, iconClass: 'bg-emerald-500/10 text-emerald-500', accent: 'border-b-emerald-400/60', hasAI: true, hasMaxSize: true },
  { key: 'zip', label: 'ZIP / RAR', description: 'Upload compressed files', icon: FileArchive, iconClass: 'bg-orange-500/10 text-orange-500', accent: 'border-b-orange-400/60', hasAI: false, hasMaxSize: true },
  { key: 'url', label: 'URL / Link', description: 'Add external links', icon: LinkIcon, iconClass: 'bg-teal-500/10 text-teal-500', accent: 'border-b-teal-400/60', hasAI: false, hasMaxSize: false },
];

// Shown separately below the upload types, under "Student Used Feature" —
// these aren't uploads with a size limit, they're features the student sees.
const STUDENT_FEATURE_TYPES: IDoMeta[] = [
  { key: 'notes', label: 'Notes', description: 'Downloadable study notes', icon: StickyNote, iconClass: 'bg-lime-500/10 text-lime-600', accent: 'border-b-lime-400/60', hasAI: false, hasMaxSize: false },
  { key: 'ai', label: 'AI', description: 'AI-generated content', icon: Bot, iconClass: 'bg-indigo-500/10 text-indigo-500', accent: 'border-b-indigo-400/60', hasAI: false, hasMaxSize: false },
];

const DEFAULT_PEDAGOGY: ResourcePedagogy = {
  iDo: {
    types: {
      ppt: { enabled: true, maxSizeMB: 20, aiAssistant: true, aiSummary: true, notes: false },
      pdf: { enabled: true, maxSizeMB: 25, aiAssistant: true, aiSummary: true, notes: false },
      videos: { enabled: false, maxSizeMB: 500, aiAssistant: false, aiSummary: false, notes: false },
      image: { enabled: false, maxSizeMB: 10, aiAssistant: false, aiSummary: false, notes: false },
      zip: { enabled: false, maxSizeMB: 100, aiAssistant: false, aiSummary: false, notes: false },
      url: { enabled: false, maxSizeMB: 0, aiAssistant: false, aiSummary: false, notes: false },
      notes: { enabled: false, maxSizeMB: 10, aiAssistant: false, aiSummary: false, notes: false },
      ai: { enabled: false, maxSizeMB: 0, aiAssistant: false, aiSummary: false, notes: false },
    },
  },
  weDo: { aiAssistant: false, autoQuestionGenerate: false },
  youDo: { aiAssistant: false, autoQuestionGenerate: false },
};

// Merge server config with defaults so pre-existing docs still render every type.
const mergePedagogy = (s?: Partial<ResourcePedagogy>): ResourcePedagogy => {
  const types = {} as Record<IDoTypeKey, ResourceTypeConfig>;
  (Object.keys(DEFAULT_PEDAGOGY.iDo.types) as IDoTypeKey[]).forEach((k) => {
    types[k] = { ...DEFAULT_PEDAGOGY.iDo.types[k], ...(s?.iDo?.types?.[k] || {}) };
  });
  return {
    iDo: { types },
    weDo: { ...DEFAULT_PEDAGOGY.weDo, ...(s?.weDo || {}) },
    youDo: { ...DEFAULT_PEDAGOGY.youDo, ...(s?.youDo || {}) },
  };
};

function SectionCard({
  title, description, icon: Icon, iconClass, open, onToggle, children,
}: { title: string; description: string; icon: LucideIcon; iconClass: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent/40">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', iconClass)}><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground">{title}</div>
          <div className="truncate text-[11px] text-muted-foreground">{description}</div>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  );
}

function ToggleRow({
  icon: Icon, iconClass, title, description, checked, onChange,
}: { icon: LucideIcon; iconClass: string; title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', iconClass)}><Icon className="h-3.5 w-3.5" /></span>
        <div>
          <div className="text-[13px] font-medium text-foreground">{title}</div>
          <div className="text-[11px] text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function IDoTypeCard({
  t, cfg, onSetField,
}: { t: IDoMeta; cfg: ResourceTypeConfig; onSetField: (key: IDoTypeKey, field: keyof ResourceTypeConfig, value: ResourceTypeConfig[keyof ResourceTypeConfig]) => void }) {
  const Icon = t.icon;
  return (
    <div className={cn('rounded-lg border border-border border-b-2 bg-card p-3', t.accent)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', t.iconClass)}><Icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold leading-tight text-foreground">{t.label}</div>
            <div className="truncate text-[11px] text-muted-foreground">{t.description}</div>
          </div>
        </div>
        <Switch checked={cfg.enabled} onCheckedChange={(v) => onSetField(t.key, 'enabled', v)} />
      </div>

      {(t.hasMaxSize || t.hasAI) && (
        <div className={cn('mt-2.5 space-y-2 transition-opacity', !cfg.enabled && 'opacity-45')}>
          {t.hasMaxSize && (
            <div className="flex items-center gap-2">
              <Label className="w-14 shrink-0 text-[11px] text-muted-foreground">Max Size</Label>
              <Input
                type="number" min={0} disabled={!cfg.enabled} placeholder="—"
                value={cfg.enabled ? cfg.maxSizeMB : ''}
                onChange={(e) => onSetField(t.key, 'maxSizeMB', Number(e.target.value))}
                className="h-8 text-sm"
              />
              <span className="text-[11px] text-muted-foreground">MB</span>
            </div>
          )}

          {t.hasAI && (
            <>
              <div className={cn('flex items-center justify-between gap-2', t.hasMaxSize && 'border-t border-border pt-2')}>
                <div className="flex min-w-0 items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium leading-tight text-foreground">AI Assistant</div>
                    <div className="truncate text-[10px] text-muted-foreground">Enable AI for {t.label}</div>
                  </div>
                </div>
                <Switch checked={cfg.aiAssistant} disabled={!cfg.enabled} onCheckedChange={(v) => onSetField(t.key, 'aiAssistant', v)} />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5 shrink-0 text-orange-500" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium leading-tight text-foreground">AI Summary</div>
                    <div className="truncate text-[10px] text-muted-foreground">Auto-summaries for {t.label}</div>
                  </div>
                </div>
                <Switch checked={cfg.aiSummary} disabled={!cfg.enabled} onCheckedChange={(v) => onSetField(t.key, 'aiSummary', v)} />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <StickyNote className="h-3.5 w-3.5 shrink-0 text-lime-600" />
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium leading-tight text-foreground">Notes</div>
                    <div className="truncate text-[10px] text-muted-foreground">Allow notes alongside {t.label}</div>
                  </div>
                </div>
                <Switch checked={cfg.notes} disabled={!cfg.enabled} onCheckedChange={(v) => onSetField(t.key, 'notes', v)} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ResourcesPageInner() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { institutionId: scopedId, name: scopedName, scoped } = useClientScope();
  const [institutionId, setInstitutionId] = useState(scopedId);
  const [form, setForm] = useState<ResourceSettings | null>(null);
  const [open, setOpen] = useState({ iDo: true, weDo: true, youDo: true });

  const { data: instData } = useQuery({ queryKey: ['superadmin', 'institutions'], queryFn: getAllInstitutions });
  const institutions = instData?.institutions || [];

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'resources', institutionId],
    queryFn: () => getResourceSettings(institutionId),
    enabled: !!institutionId,
  });
  useEffect(() => {
    if (data?.settings) setForm({ ...data.settings, resourcePedagogy: mergePedagogy(data.settings.resourcePedagogy) });
    else setForm(null);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => updateResourceSettings(institutionId, {
      resourcePedagogy: form!.resourcePedagogy,
      storageAlertThresholdPercent: form!.storageAlertThresholdPercent,
    }),
    onSuccess: () => { showSuccessToast('Resource settings saved'); queryClient.invalidateQueries({ queryKey: ['superadmin', 'resources', institutionId] }); },
    onError: (err) => showErrorToast(toApiError(err).message),
  });

  const setIDo = (key: IDoTypeKey, field: keyof ResourceTypeConfig, value: ResourceTypeConfig[keyof ResourceTypeConfig]) =>
    setForm((prev) => (prev ? {
      ...prev,
      resourcePedagogy: {
        ...prev.resourcePedagogy,
        iDo: { types: { ...prev.resourcePedagogy.iDo.types, [key]: { ...prev.resourcePedagogy.iDo.types[key], [field]: value } } },
      },
    } : prev));

  const setPed = (phase: 'weDo' | 'youDo', field: keyof PedagogyFeature, value: boolean) =>
    setForm((prev) => (prev ? {
      ...prev,
      resourcePedagogy: { ...prev.resourcePedagogy, [phase]: { ...prev.resourcePedagogy[phase], [field]: value } },
    } : prev));

  const quotaGB = form?.maxInstitutionStorageGB ?? 0;

  return (
    <div className="space-y-4">
      {scoped && <BackToClients name={scopedName} />}
      <PageHeader
        title="Resource Management"
        description={scoped ? `Configure I Do / We Do / You Do resources for ${scopedName || 'this client'}.` : 'Configure resources by pedagogy phase — I Do, We Do, You Do.'}
        actions={!scoped ? (
          <FieldSelect value={institutionId} onChange={setInstitutionId} className="w-full sm:w-56">
            <option value="">Select client...</option>
            {institutions.map((inst) => <option key={inst._id} value={inst._id}>{inst.inst_name}</option>)}
          </FieldSelect>
        ) : undefined}
      />

      {!institutionId ? (
        <EmptyState icon={Settings2} title="Select a client" description="Choose a client above to configure its resource settings." />
      ) : isLoading || !form ? (
        <div className="space-y-4"><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
      ) : (
        <>
          {/* I Do — per-type config */}
          <SectionCard
            title="I Do" description="Upload types, file size limits and AI features"
            icon={BookOpen} iconClass="bg-primary/10 text-primary"
            open={open.iDo} onToggle={() => setOpen((o) => ({ ...o, iDo: !o.iDo }))}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IDO_TYPES.map((t) => (
                <IDoTypeCard key={t.key} t={t} cfg={form.resourcePedagogy.iDo.types[t.key]} onSetField={setIDo} />
              ))}
            </div>

            {/* Student Used Feature — Notes / AI aren't size-limited uploads,
                they're features shown to the student, so they're grouped and
                displayed separately from the upload types above. */}
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Student Used Feature</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {STUDENT_FEATURE_TYPES.map((t) => (
                  <IDoTypeCard key={t.key} t={t} cfg={form.resourcePedagogy.iDo.types[t.key]} onSetField={setIDo} />
                ))}
              </div>
            </div>
          </SectionCard>

          {/* We Do */}
          <SectionCard
            title="We Do" description="AI features for guided practice"
            icon={Users} iconClass="bg-chart-2/10 text-chart-2"
            open={open.weDo} onToggle={() => setOpen((o) => ({ ...o, weDo: !o.weDo }))}
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ToggleRow icon={Sparkles} iconClass="bg-indigo-500/10 text-indigo-500" title="AI Assistant" description="Enable AI assistant for We Do" checked={form.resourcePedagogy.weDo.aiAssistant} onChange={(v) => setPed('weDo', 'aiAssistant', v)} />
              <ToggleRow icon={HelpCircle} iconClass="bg-emerald-500/10 text-emerald-500" title="Auto Question Generate" description="Auto-generate questions for We Do" checked={form.resourcePedagogy.weDo.autoQuestionGenerate} onChange={(v) => setPed('weDo', 'autoQuestionGenerate', v)} />
            </div>
          </SectionCard>

          {/* You Do */}
          <SectionCard
            title="You Do" description="AI features for independent practice"
            icon={GraduationCap} iconClass="bg-chart-4/15 text-chart-4"
            open={open.youDo} onToggle={() => setOpen((o) => ({ ...o, youDo: !o.youDo }))}
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              <ToggleRow icon={Sparkles} iconClass="bg-indigo-500/10 text-indigo-500" title="AI Assistant" description="Enable AI assistant for You Do" checked={form.resourcePedagogy.youDo.aiAssistant} onChange={(v) => setPed('youDo', 'aiAssistant', v)} />
              <ToggleRow icon={HelpCircle} iconClass="bg-emerald-500/10 text-emerald-500" title="Auto Question Generate" description="Auto-generate questions for You Do" checked={form.resourcePedagogy.youDo.autoQuestionGenerate} onChange={(v) => setPed('youDo', 'autoQuestionGenerate', v)} />
            </div>
          </SectionCard>

          {/* Storage summary */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StorageTile icon={Database} iconClass="bg-primary/10 text-primary" label="Total Quota" value={`${quotaGB.toFixed(1)} GB`} hint="From subscription plan" />
            <StorageTile icon={HardDrive} iconClass="bg-[var(--success-bg)] text-[var(--success-fg)]" label="Remaining" value={`${quotaGB.toFixed(1)} GB`} hint="Usage not tracked" />
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500/10 text-orange-500"><AlertTriangle className="h-4 w-4" /></span>
                <div className="text-[13px] text-muted-foreground">Storage Alert</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Input type="number" min={1} max={100} value={form.storageAlertThresholdPercent}
                  onChange={(e) => setForm((prev) => (prev ? { ...prev, storageAlertThresholdPercent: Number(e.target.value) } : prev))}
                  className="h-8 max-w-[5rem] text-sm" />
                <span className="text-[11px] text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Button variant="outline" onClick={() => (scoped ? router.push('/superadmin/clients') : router.back())}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function StorageTile({ icon: Icon, label, value, hint, iconClass }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: string; iconClass: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-md', iconClass)}><Icon className="h-4 w-4" /></span>
        <div className="text-[13px] text-muted-foreground">{label}</div>
      </div>
      <div className="mt-1.5 text-lg font-semibold text-foreground">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export default function ResourcesPage() {
  return (
    <Suspense fallback={null}>
      <ResourcesPageInner />
    </Suspense>
  );
}
