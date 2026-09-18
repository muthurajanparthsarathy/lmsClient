import { superAdminApi } from '@/lib/superAdminApiClient';

export interface SystemSettings {
  platformName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  allowInstitutionSelfSignup: boolean;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  enforceStrongPassword: boolean;
  emailNotificationsEnabled: boolean;
}

export const getSystemSettings = () =>
  superAdminApi.get<{ settings: SystemSettings }>('/superadmin/settings');

export const updateSystemSettings = (data: Partial<SystemSettings>) =>
  superAdminApi.put<{ settings: SystemSettings }>('/superadmin/settings', data);
