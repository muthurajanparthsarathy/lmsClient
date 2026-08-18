import { superAdminApi } from '@/lib/superAdminApiClient';

export interface Role {
  _id: string;
  institution: string;
  originalRole: string;
  renameRole?: string;
  roleValue: string;
  createdAt: string;
}

export interface RoleInput {
  institution: string;
  originalRole: string;
  renameRole?: string;
  roleValue?: string;
}

export const getAllRoles = (institution: string) =>
  superAdminApi.get<{ roles: Role[] }>(`/superadmin/roles?institution=${institution}`);

export const createRole = (data: RoleInput) =>
  superAdminApi.post<{ role: Role }>('/superadmin/roles', data);

export const updateRole = (id: string, data: Partial<RoleInput>) =>
  superAdminApi.put<{ role: Role }>(`/superadmin/roles/${id}`, data);

export const deleteRole = (id: string) =>
  superAdminApi.del(`/superadmin/roles/${id}`);
