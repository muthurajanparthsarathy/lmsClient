import { superAdminApi } from '@/lib/superAdminApiClient';

export interface Institution {
  _id: string;
  inst_id: string;
  inst_name: string;
  inst_owner: string;
  phone: string;
  address?: string;
  basedOn?: string;
  createdAt: string;
  userCount: number;
  courseCount: number;
  status: 'active' | 'suspended';
  // True once the institution's permission allow-list has been set (Permission
  // Management). Gates User/Resource Management on the Clients page.
  hasPermissions?: boolean;
  subscription?: {
    plan: string;
    storageQuotaMB: number;
    maxUsers: number;
    expiryDate?: string;
  } | null;
}

export interface InstitutionInput {
  inst_name: string;
  inst_owner: string;
  phone: string;
  address?: string;
  basedOn?: string;
}

export const getAllInstitutions = () =>
  superAdminApi.get<{ institutions: Institution[] }>('/superadmin/institutions');

export const getInstitutionById = (id: string) =>
  superAdminApi.get<{ institution: Institution }>(`/superadmin/institutions/${id}`);

export const createInstitution = (data: InstitutionInput) =>
  superAdminApi.post<{ institution: Institution }>('/superadmin/institutions', data);

export const deleteInstitution = (id: string) =>
  superAdminApi.del(`/superadmin/institutions/${id}`);

export const updateInstitutionStatus = (id: string, status: 'active' | 'suspended') =>
  superAdminApi.put(`/superadmin/institutions/${id}/status`, { status });

// ── Institution permission allow-list (Clients → Permission Management) ──────
// The set of permissions each role category may use in this institution. Used
// to preselect the Permission Management modal and to limit the Add User /
// Assign Permission modals. Shape matches what the permission modal produces.
export interface InstitutionPermission {
  id?: string;
  permissionName: string;
  permissionKey: string;
  permissionFunctionality: string[];
  icon: string;
  color: string;
  description?: string;
  isActive: boolean;
  order: number;
}

export const getInstitutionPermissions = (id: string) =>
  superAdminApi.get<{ permissions: InstitutionPermission[] }>(`/superadmin/institutions/${id}/permissions`);

export const updateInstitutionPermissions = (id: string, permissions: InstitutionPermission[]) =>
  superAdminApi.put(`/superadmin/institutions/${id}/permissions`, { permissions });
