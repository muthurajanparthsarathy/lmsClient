import { superAdminApi } from '@/lib/superAdminApiClient';

// Platform-owner (Super Admin) accounts — the users who log into this console.
// Distinct from institution users (userService.ts).
export interface SuperAdminAccount {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'active' | 'inactive';
  lastLoginAt?: string;
  createdAt: string;
}

export interface SuperAdminAccountInput {
  name: string;
  email: string;
  phone?: string;
  password?: string;
  status?: 'active' | 'inactive';
}

export const getAllSuperAdmins = () =>
  superAdminApi.get<{ admins: SuperAdminAccount[] }>('/superadmin/admins');

export const createSuperAdmin = (data: SuperAdminAccountInput) =>
  superAdminApi.post<{ admin: SuperAdminAccount }>('/superadmin/admins', data);

export const updateSuperAdmin = (id: string, data: Partial<SuperAdminAccountInput>) =>
  superAdminApi.put<{ admin: SuperAdminAccount }>(`/superadmin/admins/${id}`, data);

export const updateSuperAdminStatus = (id: string, status: 'active' | 'inactive') =>
  superAdminApi.put(`/superadmin/admins/${id}/status`, { status });

export const deleteSuperAdmin = (id: string) =>
  superAdminApi.del(`/superadmin/admins/${id}`);
