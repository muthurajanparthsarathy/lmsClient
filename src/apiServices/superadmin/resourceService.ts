import { superAdminApi } from '@/lib/superAdminApiClient';

export interface ResourceTypeConfig {
  enabled: boolean;
  maxSizeMB: number;
  aiAssistant: boolean;
  aiSummary: boolean;
  // Per-type Notes toggle (ppt/pdf/videos/image only) — this upload also
  // carries its own notes, separate from the standalone "Notes" type.
  notes: boolean;
}

// I Do upload types.
export type IDoTypeKey = 'ppt' | 'pdf' | 'videos' | 'image' | 'zip' | 'url' | 'notes' | 'ai';

export interface PedagogyFeature {
  aiAssistant: boolean;
  autoQuestionGenerate: boolean;
}

// Resource Management is organised by pedagogy phase.
export interface ResourcePedagogy {
  iDo: { types: Record<IDoTypeKey, ResourceTypeConfig> };
  weDo: PedagogyFeature;
  youDo: PedagogyFeature;
}

export interface ResourceSettings {
  // Per-type / pedagogy config the screen edits.
  resourcePedagogy: ResourcePedagogy;
  // Storage Summary — alert threshold (editable) + quota (derived, read-only).
  storageAlertThresholdPercent: number;
  maxInstitutionStorageGB: number;
}

export const getResourceSettings = (institution: string) =>
  superAdminApi.get<{ settings: ResourceSettings }>(`/superadmin/resources?institution=${encodeURIComponent(institution)}`);

export const updateResourceSettings = (institution: string, data: Partial<ResourceSettings>) =>
  superAdminApi.put<{ settings: ResourceSettings }>('/superadmin/resources', { institution, ...data });
