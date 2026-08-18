import { superAdminApi } from '@/lib/superAdminApiClient';

export interface SuperAdminLoginResponse {
  message: { key: string; value: string }[];
  token: string;
  superAdmin: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    status: string;
  };
}

export const superAdminLogin = (email: string, password: string) =>
  superAdminApi.post<SuperAdminLoginResponse>('/superadmin/auth/login', { email, password });

export const superAdminLogout = () =>
  superAdminApi.post('/superadmin/auth/logout');

export const superAdminChangePassword = (currentPassword: string, newPassword: string) =>
  superAdminApi.put('/superadmin/auth/change-password', { currentPassword, newPassword });
