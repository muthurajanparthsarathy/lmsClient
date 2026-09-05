import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Film,
  FileInput,
  FileText,
  Link,
  Sparkles,
  User,
  Users,
  UserCheck,
  ChevronDown,
  Info,
  Image as ImageIcon,
  FileArchive,
  StickyNote,
  Bot,
  HelpCircle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getToken } from '@/lib/session';
import { getInstitutionResourceSettings } from '@/app/lms/pages/usermanagement/api/userService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileResource {
  enabled: boolean;
  maxSize: number;
  allowedFormats?: string[];
  aiChat?: boolean;
  aiSummary?: boolean;
  notes?: boolean;
}

interface SimpleResource {
  enabled: boolean;
}

interface ResourceConfigType {
  video?: FileResource;
  ppt?: FileResource;
  pdf?: FileResource;
  image?: FileResource;
  zip?: FileResource;
  url?: SimpleResource;
  aiChat?: SimpleResource;
  aiSummary?: SimpleResource;
  notes?: SimpleResource;
  ai?: SimpleResource;
  autoQuestionGenerate?: SimpleResource;
}

interface PedagogyResources {
  iDo: ResourceConfigType;
  weDo: ResourceConfigType;
  youDo: ResourceConfigType;
}

// A Service Mapping's Step 3 (Resources) selection. Carries the same shape as
// `resourcesType` itself (see ServiceMappingModel.resourceDefaults), but only
// the `enabled` flag is read here, and the mapping's own type declares every
// field optional — so the phases are taken as unknown and narrowed at the point
// of use rather than restated in a way the two shapes would have to keep
// agreeing on.
export type MappingResources = {
  iDo?: unknown;
  weDo?: unknown;
  youDo?: unknown;
};

// One phase of the above, reduced to the only question asked of it.
type MappingPhaseConfig = Record<string, { enabled?: boolean } | undefined>;

interface ValidationErrors {
  resourceType?: string;
}

interface ResourceTypeSectionProps {
  formData: {
    iDo: string[];
    weDo: string[];
    youDo: string[];
    resourcesType: PedagogyResources;
    aiChatGlobal: boolean;
  };
  setFormData: (updater: (prev: any) => any) => void;
  validationErrors: ValidationErrors;
  setValidationErrors: (updater: (prev: any) => any) => void;
  // Course Setup gates each tab behind "pick your pedagogy methods first" —
  // a course cannot attach resources to activities it doesn't run. The Map
  // Service wizard has no pedagogy methods at all (it's setting DEFAULTS for
  // courses created later), so it turns the guard off and shows every tab.
  requirePedagogySelection?: boolean;
  // The Step 3 (Resources) selection of the mapping this course belongs to.
  // Passed by Course Setup only: it narrows the rows below to the types that
  // mapping picked, on top of the institution's own gating. Absent (the Map
  // Service wizard itself, the legacy add-course popup) → no narrowing.
  mappingResources?: MappingResources | null;
}

type TabKey = 'iDo' | 'weDo' | 'youDo';

// ─── Small Toggle ─────────────────────────────────────────────────────────────

const Toggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  color?: string;
}> = ({ checked, onChange, color = '#7F77DD' }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    style={{
      position: 'relative',
      display: 'inline-flex',
      width: 36,
      height: 20,
      borderRadius: 10,
      background: checked ? color : '#D1D5DB',
      border: 'none',
      cursor: 'pointer',
      transition: 'background 0.15s',
      flexShrink: 0,
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: 2,
        left: checked ? 18 : 2,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.15s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }}
    />
  </button>
);

// ─── Status Pill ─────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ active: boolean }> = ({ active }) => (
  <span
    style={{
      fontSize: 10,
      fontWeight: 500,
      padding: '2px 7px',
      borderRadius: 8,
      background: active ? '#EEEDFE' : 'var(--color-background-secondary, #F5F5F5)',
      color: active ? '#534AB7' : '#9CA3AF',
      border: `0.5px solid ${active ? '#AFA9EC' : 'transparent'}`,
      transition: 'all 0.15s',
    }}
  >
    {active ? 'On' : 'Off'}
  </span>
);

// ─── AI Sub-row ───────────────────────────────────────────────────────────────

const AISubRow: React.FC<{
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon?: React.ReactNode;
  color?: string;
}> = ({ label, description, checked, onChange, icon, color = '#EF9F27' }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderTop: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
    }}
  >
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        {icon ?? <Sparkles size={11} color={color} />}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{description}</span>
    </div>
    <Toggle checked={checked} onChange={onChange} color={color} />
  </div>
);

// ─── File Resource Row (Video / PPT / PDF) ────────────────────────────────────

const FileResourceRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  iconBg: string;
  resource: FileResource | undefined;
  onToggle: () => void;
  onMaxSizeChange: (val: number) => void;
  onAiChatToggle: () => void;
  onAiSummaryToggle: () => void;
  onNotesToggle: () => void;
  // Super Admin-granted ceiling/gates for this specific type. undefined →
  // no restriction (settings still loading).
  maxSizeLimit?: number;
  allowAiChat?: boolean;
  allowAiSummary?: boolean;
  allowNotes?: boolean;
}> = ({
  icon, label, description, iconBg,
  resource,
  onToggle, onMaxSizeChange, onAiChatToggle, onAiSummaryToggle, onNotesToggle,
  maxSizeLimit, allowAiChat = true, allowAiSummary = true, allowNotes = true,
}) => {
  const enabled = resource?.enabled ?? false;
  const [expanded, setExpanded] = useState(false);

  // Auto-open when enabled, auto-close when disabled
  const prevEnabled = React.useRef(enabled);
  React.useEffect(() => {
    if (enabled && !prevEnabled.current) {
      setExpanded(true);
    }
    if (!enabled && prevEnabled.current) {
      setExpanded(false);
    }
    prevEnabled.current = enabled;
  }, [enabled]);

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (enabled) setExpanded(v => !v);
  };

  return (
    <div style={{ borderBottom: '0.5px solid var(--color-border-tertiary, #E5E7EB)' }}>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          cursor: enabled ? 'pointer' : 'default',
          transition: 'background 0.1s',
          background: expanded ? 'var(--color-background-secondary, #F9FAFB)' : 'transparent',
        }}
        onClick={handleExpandClick}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 30, height: 30, borderRadius: 7,
              background: iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{description}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusPill active={enabled} />
          <Toggle checked={enabled} onChange={onToggle} />
          {enabled && (
            <ChevronDown
              size={14}
              style={{
                color: 'var(--color-text-secondary)',
                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            />
          )}
        </div>
      </div>

      {/* Expanded config */}
      {enabled && expanded && (
        <div
          style={{
            padding: '10px 14px 10px 54px',
            background: 'var(--color-background-secondary, #F9FAFB)',
            borderTop: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
          }}
        >
          {/* File size — capped at what the Super Admin allowed for this type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', minWidth: 90 }}>Max file size</span>
            <Input
              type="number"
              min={0.5}
              max={maxSizeLimit ?? 100}
              step={0.5}
              value={resource?.maxSize ?? 10}
              onChange={e => {
                const val = parseFloat(e.target.value) || 10;
                onMaxSizeChange(maxSizeLimit ? Math.min(val, maxSizeLimit) : val);
              }}
              style={{ width: 70, height: 28, fontSize: 12, padding: '0 8px' }}
            />
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              MB{maxSizeLimit ? ` (max ${maxSizeLimit})` : ''}
            </span>
          </div>

          {allowAiChat && (
            <AISubRow
              label="AI Chat"
              description={`Enable AI assistant for ${label}`}
              checked={resource?.aiChat ?? false}
              onChange={onAiChatToggle}
            />
          )}
          {allowAiSummary && (
            <AISubRow
              label="AI Summary"
              description={`Auto-generate summaries for ${label}`}
              checked={resource?.aiSummary ?? false}
              onChange={onAiSummaryToggle}
            />
          )}
          {allowNotes && (
            <AISubRow
              label="Notes"
              description={`Attach notes alongside ${label}`}
              checked={resource?.notes ?? false}
              onChange={onNotesToggle}
              icon={<StickyNote size={11} color="#639922" />}
              color="#639922"
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Simple Resource Row (URL / Notes / AI Chat / AI Summary) ─────────────────

const SimpleResourceRow: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}> = ({ icon, iconBg, label, description, enabled, onToggle }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      borderBottom: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 30, height: 30, borderRadius: 7,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{description}</div>
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <StatusPill active={enabled} />
      <Toggle checked={enabled} onChange={onToggle} />
    </div>
  </div>
);

// ─── Student Feature Card (Notes / AI) ─────────────────────────────────────────
// Compact, individually-bordered card — mirrors the Super Admin's Resource
// Management "Student Used Feature" cards so course setup reads the same way.

const StudentFeatureCard: React.FC<{
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  accent: string;
}> = ({ icon, iconBg, label, description, enabled, onToggle, accent }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      padding: '12px 14px',
      border: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
      borderBottom: `2px solid ${accent}`,
      borderRadius: 10,
      background: 'var(--color-background-primary, #fff)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <div
        style={{
          width: 30, height: 30, borderRadius: 7,
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 1 }}>{description}</div>
      </div>
    </div>
    <Toggle checked={enabled} onChange={onToggle} />
  </div>
);

// ─── Tab Badge ────────────────────────────────────────────────────────────────

const TabBadge: React.FC<{ count: number }> = ({ count }) => (
  <span
    style={{
      fontSize: 10,
      padding: '2px 6px',
      borderRadius: 8,
      fontWeight: 500,
      background: count > 0 ? '#EEEDFE' : 'var(--color-background-secondary, #F5F5F5)',
      color: count > 0 ? '#534AB7' : '#9CA3AF',
      border: `0.5px solid ${count > 0 ? '#AFA9EC' : 'transparent'}`,
      transition: 'all 0.15s',
    }}
  >
    {count} active
  </span>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countActive(cfg: ResourceConfigType): number {
  return Object.values(cfg).filter(v => v?.enabled).length;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ResourceTypeSection: React.FC<ResourceTypeSectionProps> = ({
  formData,
  setFormData,
  validationErrors,
  setValidationErrors,
  requirePedagogySelection = true,
  mappingResources = null,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('iDo');
  // Whether this tab's "pick pedagogy methods first" empty state applies.
  const needsPedagogy = (list: string[]) => requirePedagogySelection && list.length === 0;

  const rt = formData.resourcesType;

  // This institution's Resource Management config (set by the Super Admin).
  // Every row below is derived from it — a course can only offer a resource
  // the Super Admin enabled. undefined while loading (→ show everything, so
  // the form never looks empty mid-fetch).
  const institutionId = typeof window !== 'undefined' ? localStorage.getItem('smartcliff_institution') : null;
  const { data: resourceSettings } = useQuery({
    queryKey: ['institution-resource-settings', institutionId],
    queryFn: () => getInstitutionResourceSettings(institutionId as string, getToken() || ''),
    enabled: !!institutionId,
    // Super-admin config that changes rarely. This section unmounts whenever
    // its collapsible closes, and the old staleTime 0 + refetchOnMount
    // 'always' refired the request on EVERY expand (with a flash of
    // "everything allowed" rows mid-fetch). One minute of freshness kills the
    // per-expand refires; refetchOnMount true still revalidates once stale.
    staleTime: 60_000,
    refetchOnMount: true,
  });
  const iDoTypes = resourceSettings?.iDo?.types;
  // `videos` is the Super Admin's key; the course form stores it as `video`.
  const allowIDo = (superAdminKey: string) =>
    iDoTypes ? !!iDoTypes[superAdminKey]?.enabled : true;
  // The Super Admin's per-type config (max size + which AI toggles it grants).
  // undefined while loading → rows fall back to "everything allowed".
  const adminCfgFor = (superAdminKey: string) => iDoTypes?.[superAdminKey];

  // ─── Mapping narrowing ───
  // Two gates stack: the institution decides what MAY be offered at all, then
  // the course's mapping decides which of those this course actually gets.
  //
  // A phase whose mapping config has nothing enabled counts as "never
  // configured" and is left unnarrowed. The server normaliser writes every key
  // out as `enabled: false`, so without this every mapping saved before Step 3
  // existed — or simply skipped past it — would hand its courses an empty form
  // with no way to fill it.
  const mappingCfgFor = (phase: TabKey): MappingPhaseConfig | null => {
    const cfg = mappingResources?.[phase];
    if (!cfg || typeof cfg !== 'object') return null;
    const phaseCfg = cfg as MappingPhaseConfig;
    return Object.values(phaseCfg).some((v) => v?.enabled) ? phaseCfg : null;
  };
  // A row survives when the mapping picked it — or when this course already has
  // it switched on, so a type the mapping dropped after the course was set up
  // stays visible and can be turned off, rather than lingering enabled behind a
  // row that no longer renders.
  const enabledHere = (phase: TabKey, key: string) =>
    Boolean((rt[phase] as Record<string, { enabled?: boolean } | undefined>)?.[key]?.enabled);
  const mappingAllows = (phase: TabKey, key: string) => {
    const cfg = mappingCfgFor(phase);
    if (!cfg) return true;
    return Boolean(cfg[key]?.enabled) || enabledHere(phase, key);
  };
  // Which gate emptied the list decides where the user has to go to fix it, so
  // the empty state must not blame the institution for the mapping's choice.
  const emptyMessage = (phase: TabKey) =>
    mappingCfgFor(phase)
      ? 'No resource types are enabled for this course in its service mapping'
      : 'No resource types are enabled for this institution';

  // ─── I Do upload rows, in Super Admin catalog order ───
  // `kind: 'file'` rows get max-size + AI Chat/AI Summary sub-config, each
  // capped/gated by what the Super Admin granted for that specific type.
  // `kind: 'simple'` rows are a bare on/off toggle.
  const I_DO_ROWS = [
    { key: 'video', adminKey: 'videos', kind: 'file', label: 'Video', description: 'Upload lecture or tutorial videos', icon: <Film size={14} color="#7F77DD" />, iconBg: '#EEEDFE' },
    { key: 'ppt', adminKey: 'ppt', kind: 'file', label: 'PPT', description: 'Upload presentation slides', icon: <FileInput size={14} color="#E24B4A" />, iconBg: '#FCEBEB' },
    { key: 'pdf', adminKey: 'pdf', kind: 'file', label: 'PDF', description: 'Upload PDF documents', icon: <FileText size={14} color="#378ADD" />, iconBg: '#E6F1FB' },
    { key: 'image', adminKey: 'image', kind: 'file', label: 'Image', description: 'Upload image files', icon: <ImageIcon size={14} color="#1D9E75" />, iconBg: '#E1F5EE' },
    { key: 'zip', adminKey: 'zip', kind: 'file', label: 'ZIP / RAR', description: 'Upload compressed files', icon: <FileArchive size={14} color="#EF9F27" />, iconBg: '#FAEEDA' },
    { key: 'url', adminKey: 'url', kind: 'simple', label: 'URL / Link', description: 'Share external web resources', icon: <Link size={14} color="#1D9E75" />, iconBg: '#E1F5EE' },
  ]
    .filter((r) => allowIDo(r.adminKey) && mappingAllows('iDo', r.key))
    .map((r) => ({ ...r, adminCfg: adminCfgFor(r.adminKey) }));

  // ─── Student Used Feature — Notes / AI ───
  // Shown as their own compact-card section, mirroring the Super Admin's
  // Resource Management "Student Used Feature" grouping, instead of sitting
  // inline with the upload types above.
  const I_DO_STUDENT_FEATURE_ROWS = [
    { key: 'notes', adminKey: 'notes', label: 'Notes', description: 'Downloadable study notes for students', icon: <StickyNote size={14} color="#639922" />, iconBg: '#EAF3DE', accent: '#84cc16' },
    { key: 'ai', adminKey: 'ai', label: 'AI', description: 'AI-generated content for students', icon: <Bot size={14} color="#534AB7" />, iconBg: '#EEEDFE', accent: '#7F77DD' },
  ].filter((r) => allowIDo(r.adminKey) && mappingAllows('iDo', r.key));

  // ─── We Do / You Do rows ───
  // The Super Admin exposes exactly two per-phase features, so these panels
  // mirror them one-for-one rather than carrying their own type list.
  const phaseRows = (phase: 'weDo' | 'youDo') => {
    const cfg = resourceSettings?.[phase];
    const label = phase === 'weDo' ? 'guided practice' : 'independent practice';
    return [
      { key: 'aiChat', allowed: cfg ? !!cfg.aiAssistant : true, label: 'AI Assistant', description: `AI-powered assistant for ${label}`, icon: <Sparkles size={14} color="#EF9F27" />, iconBg: '#FAEEDA' },
      { key: 'autoQuestionGenerate', allowed: cfg ? !!cfg.autoQuestionGenerate : true, label: 'Auto Question Generate', description: `Auto-generate questions for ${label}`, icon: <HelpCircle size={14} color="#1D9E75" />, iconBg: '#E1F5EE' },
    ].filter((r) => r.allowed && mappingAllows(phase, r.key));
  };
  const WE_DO_ROWS = phaseRows('weDo');
  const YOU_DO_ROWS = phaseRows('youDo');

  // Generic updater for iDo file resources
  const updateIDoFile = (
    key: 'video' | 'ppt' | 'pdf' | 'image' | 'zip',
    patch: Partial<FileResource>
  ) => {
    setFormData((prev: any) => ({
      ...prev,
      resourcesType: {
        ...prev.resourcesType,
        iDo: {
          ...prev.resourcesType.iDo,
          [key]: { ...prev.resourcesType.iDo[key], ...patch },
        },
      },
    }));
    setValidationErrors((prev: any) => ({ ...prev, resourceType: undefined }));
  };

  // Generic updater for simple resources
  const updateSimple = (
    section: 'iDo' | 'weDo' | 'youDo',
    key: 'url' | 'notes' | 'aiChat' | 'aiSummary' | 'ai' | 'autoQuestionGenerate',
    enabled: boolean
  ) => {
    setFormData((prev: any) => ({
      ...prev,
      resourcesType: {
        ...prev.resourcesType,
        [section]: {
          ...prev.resourcesType[section],
          [key]: { enabled },
        },
      },
    }));
    setValidationErrors((prev: any) => ({ ...prev, resourceType: undefined }));
  };

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; color: string; dotColor: string }[] = [
    { key: 'iDo', label: 'I Do', icon: <User size={13} />, color: '#378ADD', dotColor: '#378ADD' },
    { key: 'weDo', label: 'We Do', icon: <Users size={13} />, color: '#1D9E75', dotColor: '#1D9E75' },
    { key: 'youDo', label: 'You Do', icon: <UserCheck size={13} />, color: '#7F77DD', dotColor: '#7F77DD' },
  ];

  const idoCount = countActive(rt.iDo);
  const wedoCount = countActive(rt.weDo);
  const youdoCount = countActive(rt.youDo);
  const counts: Record<TabKey, number> = { iDo: idoCount, weDo: wedoCount, youDo: youdoCount };

  return (
    <div
      style={{
        background: 'var(--color-background-primary, #fff)',
        border: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Section Title Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
          background: 'var(--color-background-secondary, #F9FAFB)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <FileText size={15} color="#7F77DD" />
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Resource Type
          </span>
          <span
            style={{
              fontSize: 10,
              background: '#FCEBEB',
              color: '#A32D2D',
              padding: '2px 6px',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            Required
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            background: 'var(--color-background-primary, #fff)',
            border: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
            borderRadius: 6,
            padding: '4px 9px',
          }}
        >
          <Info size={11} />
          Configure resources per pedagogy section
        </div>
      </div>

      {/* Tab Bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
          background: 'var(--color-background-primary, #fff)',
        }}
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${isActive ? tab.dotColor : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: isActive ? tab.dotColor : 'var(--color-border-tertiary, #D1D5DB)',
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
              />
              {tab.label}
              <TabBadge count={counts[tab.key]} />
            </button>
          );
        })}
      </div>

      {/* Panel Content */}
      <div style={{ padding: 14 }}>

        {/* ── I DO PANEL ─────────────────────────────────────── */}
        {activeTab === 'iDo' && (
          <>
            {needsPedagogy(formData.iDo) ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                <User size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div>Select I Do pedagogy methods first to configure resources</div>
              </div>
            ) : I_DO_ROWS.length === 0 && I_DO_STUDENT_FEATURE_ROWS.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                <Info size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div>{emptyMessage('iDo')}</div>
              </div>
            ) : (
              <>
                {I_DO_ROWS.length > 0 && (
                  <div
                    style={{
                      border: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
                      borderRadius: 10,
                      overflow: 'hidden',
                    }}
                  >
                    {I_DO_ROWS.map(row => {
                      const fileKey = row.key as 'video' | 'ppt' | 'pdf' | 'image' | 'zip';
                      const simpleKey = row.key as 'url';
                      return row.kind === 'file' ? (
                        <FileResourceRow
                          key={row.key}
                          icon={row.icon}
                          iconBg={row.iconBg}
                          label={row.label}
                          description={row.description}
                          resource={rt.iDo[fileKey]}
                          onToggle={() => updateIDoFile(fileKey, { enabled: !rt.iDo[fileKey]?.enabled })}
                          onMaxSizeChange={val => updateIDoFile(fileKey, { maxSize: val })}
                          onAiChatToggle={() => updateIDoFile(fileKey, { aiChat: !rt.iDo[fileKey]?.aiChat })}
                          onAiSummaryToggle={() => updateIDoFile(fileKey, { aiSummary: !rt.iDo[fileKey]?.aiSummary })}
                          onNotesToggle={() => updateIDoFile(fileKey, { notes: !rt.iDo[fileKey]?.notes })}
                          maxSizeLimit={row.adminCfg?.maxSizeMB}
                          allowAiChat={row.adminCfg ? !!row.adminCfg.aiAssistant : true}
                          allowAiSummary={row.adminCfg ? !!row.adminCfg.aiSummary : true}
                          allowNotes={row.adminCfg ? !!row.adminCfg.notes : true}
                        />
                      ) : (
                        <SimpleResourceRow
                          key={row.key}
                          icon={row.icon}
                          iconBg={row.iconBg}
                          label={row.label}
                          description={row.description}
                          enabled={rt.iDo[simpleKey]?.enabled ?? false}
                          onToggle={() => updateSimple('iDo', simpleKey, !rt.iDo[simpleKey]?.enabled)}
                        />
                      );
                    })}
                  </div>
                )}

                {/* ── Student Used Feature (Notes / AI) ─────────────────
                    Mirrors the Super Admin's Resource Management grouping —
                    shown as small standalone cards, not inline with uploads. */}
                {I_DO_STUDENT_FEATURE_ROWS.length > 0 && (
                  <div style={{ marginTop: I_DO_ROWS.length > 0 ? 16 : 0 }}>
                    <div style={{
                      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em',
                      textTransform: 'uppercase', color: 'var(--color-text-secondary)',
                      marginBottom: 8,
                    }}>
                      Student Used Feature
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                      {I_DO_STUDENT_FEATURE_ROWS.map(row => {
                        const key = row.key as 'notes' | 'ai';
                        return (
                          <StudentFeatureCard
                            key={row.key}
                            icon={row.icon}
                            iconBg={row.iconBg}
                            label={row.label}
                            description={row.description}
                            accent={row.accent}
                            enabled={rt.iDo[key]?.enabled ?? false}
                            onToggle={() => updateSimple('iDo', key, !rt.iDo[key]?.enabled)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── WE DO PANEL ────────────────────────────────────── */}
        {activeTab === 'weDo' && (
          <>
            {needsPedagogy(formData.weDo) ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                <Users size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div>Select We Do pedagogy methods first to configure resources</div>
              </div>
            ) : WE_DO_ROWS.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                <Info size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div>{emptyMessage('weDo')}</div>
              </div>
            ) : (
              <div
                style={{
                  border: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {WE_DO_ROWS.map(row => {
                  const key = row.key as 'aiChat' | 'autoQuestionGenerate';
                  return (
                    <SimpleResourceRow
                      key={row.key}
                      icon={row.icon}
                      iconBg={row.iconBg}
                      label={row.label}
                      description={row.description}
                      enabled={rt.weDo[key]?.enabled ?? false}
                      onToggle={() => updateSimple('weDo', key, !rt.weDo[key]?.enabled)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── YOU DO PANEL ────────────────────────────────────── */}
        {activeTab === 'youDo' && (
          <>
            {needsPedagogy(formData.youDo) ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                <UserCheck size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div>Select You Do pedagogy methods first to configure resources</div>
              </div>
            ) : YOU_DO_ROWS.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                <Info size={24} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                <div>{emptyMessage('youDo')}</div>
              </div>
            ) : (
              <div
                style={{
                  border: '0.5px solid var(--color-border-tertiary, #E5E7EB)',
                  borderRadius: 10,
                  overflow: 'hidden',
                }}
              >
                {YOU_DO_ROWS.map(row => {
                  const key = row.key as 'aiChat' | 'autoQuestionGenerate';
                  return (
                    <SimpleResourceRow
                      key={row.key}
                      icon={row.icon}
                      iconBg={row.iconBg}
                      label={row.label}
                      description={row.description}
                      enabled={rt.youDo[key]?.enabled ?? false}
                      onToggle={() => updateSimple('youDo', key, !rt.youDo[key]?.enabled)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Validation message */}
        {validationErrors.resourceType && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#A32D2D', fontSize: 12, marginTop: 8 }}>
            <Info size={12} />
            {validationErrors.resourceType}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourceTypeSection;