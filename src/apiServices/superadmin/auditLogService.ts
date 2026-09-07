import { superAdminApi } from '@/lib/superAdminApiClient';

export interface AuditLogEntry {
  _id: string;
  actorEmail: string;
  action: string;
  method: string;
  path: string;
  statusCode: number;
  summary: string;
  ipAddress: string;
  createdAt: string;
}

export const getAuditLogs = (limit = 100) =>
  superAdminApi.get<{ logs: AuditLogEntry[] }>(`/superadmin/audit-logs?limit=${limit}`);

// ── Login logs (LMS user sign-in sessions) ─────────────────────────────────
export interface LoginLogEntry {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  status?: string;
  details: {
    ipAddress?: string;
    location?: string;
    device?: string;
    browser?: string;
    os?: string;
    userAgent?: string;
  };
  sessionDuration?: number; // seconds
  logoutTime?: string;      // ISO – set on logout
  logoutAt?: string;        // ISO – alt field name
  sessionEnd?: string;      // ISO – alt field name
  createdAt: string;
}

export const getLoginLogs = (limit = 500) =>
  superAdminApi.get<{ data: LoginLogEntry[] }>(`/superadmin/audit-logs/logins?limit=${limit}`);
