import { superAdminApi } from '@/lib/superAdminApiClient';

export interface ModuleEntry {
  permissionKey: string;
  permissionName: string;
  permissionFunctionality: string[];
  icon: string;
  color: string;
  description: string;
  order: number;
  isActive: boolean;
  locked?: boolean;
}

export interface GetRolePermissionsResponse {
  modules: ModuleEntry[];
  affectedUserCount: number;
  lastUpdatedAt: string | null;
}

export const getRolePermissions = (institution: string, role: string) =>
  superAdminApi.get<GetRolePermissionsResponse>(
    `/superadmin/permissions?institution=${institution}&role=${role}`
  );

export const saveRolePermissions = (
  institution: string,
  role: string,
  modules: { permissionKey: string; isActive: boolean }[]
) =>
  superAdminApi.put<{ modules: ModuleEntry[]; affectedUsers: number }>('/superadmin/permissions', {
    institution,
    role,
    modules,
  });
