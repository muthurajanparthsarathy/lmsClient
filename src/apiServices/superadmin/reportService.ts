import { superAdminApi } from '@/lib/superAdminApiClient';

export interface Overview {
  institutions: number;
  users: number;
  courses: number;
  usersPerInstitution: { institution: string; count: number }[];
  usersByRole: { role: string; count: number }[];
}

export interface LoginRecord {
  _id: string;
  userName: string;
  userEmail: string;
  userRole: string;
  details?: { ipAddress?: string; device?: string; browser?: string };
  createdAt: string;
}

export interface InstitutionAnalyticsRow {
  _id: string;
  inst_id: string;
  inst_name: string;
  users: number;
  courses: number;
  modules: number;
  subModules: number;
  topics: number;
  subTopics: number;
  iDo: number;
  weDo: number;
  youDo: number;
}

export interface AnalyticsTotals {
  institutions: number;
  users: number;
  courses: number;
  modules: number;
  subModules: number;
  topics: number;
  subTopics: number;
  iDo: number;
  weDo: number;
  youDo: number;
}

export const getOverview = () =>
  superAdminApi.get<{ overview: Overview }>('/superadmin/reports/overview');

export const getInstitutionAnalytics = () =>
  superAdminApi.get<{ totals: AnalyticsTotals; rows: InstitutionAnalyticsRow[] }>('/superadmin/reports/analytics');

// ── Single-institution full details (click institution name) ────────────────
export interface InstitutionDetails {
  institution: { _id: string; inst_id: string; inst_name: string; inst_owner: string; phone: string; address?: string; status: string };
  subscription: { plan: string; status: string; storageQuotaMB: number; maxUsers: number; amount?: number; expiryDate?: string } | null;
  counts: {
    users: number; courses: number; modules: number; subModules: number;
    topics: number; subTopics: number; iDo: number; weDo: number; youDo: number;
  };
  roles: { _id: string; name: string; roleValue: string; userCount: number }[];
  courses: { _id: string; name: string; clientName: string; serviceType: string }[];
  permissions: { permissionName: string; permissionKey: string; functions: string[] }[];
  resources: {
    iDo?: { types?: Record<string, { enabled: boolean; maxSizeMB: number; aiAssistant: boolean; aiSummary: boolean }> };
    weDo?: { aiAssistant: boolean; autoQuestionGenerate: boolean };
    youDo?: { aiAssistant: boolean; autoQuestionGenerate: boolean };
  } | null;
}

export const getInstitutionDetails = (id: string) =>
  superAdminApi.get<InstitutionDetails>(`/superadmin/reports/institution/${id}`);

export const getLoginReport = (limit = 50) =>
  superAdminApi.get<{ logins: LoginRecord[] }>(`/superadmin/reports/logins?limit=${limit}`);
