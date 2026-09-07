import { superAdminApi } from '@/lib/superAdminApiClient';

export interface SuperAdminUserRow {
  _id: string;
  userId?: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  institution: string;
  role: { _id: string; originalRole: string; renameRole?: string; roleValue: string } | null;
  createdAt: string;
}

// Embedded per-user permission entry — the exact shape UserModel stores and
// the shared PermissionModal produces.
export interface EmbeddedPermission {
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

export interface UserInput {
  institution: string;
  role: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  password: string;
  status?: 'active' | 'inactive';
  // Rich per-user permissions collected in the Add User permission modal.
  // Omitted → backend applies the always-on base permission set.
  permissions?: EmbeddedPermission[];
}

export const getAllUsers = (institution: string) =>
  superAdminApi.get<{ users: SuperAdminUserRow[] }>(`/superadmin/users?institution=${institution}`);

export const createUser = (data: UserInput) =>
  superAdminApi.post<{ user: SuperAdminUserRow }>('/superadmin/users', data);

export const updateUser = (id: string, data: Partial<UserInput>) =>
  superAdminApi.put<{ user: SuperAdminUserRow }>(`/superadmin/users/${id}`, data);

export const deleteUser = (id: string) =>
  superAdminApi.del(`/superadmin/users/${id}`);

export const updateUserStatus = (id: string, status: 'active' | 'inactive') =>
  superAdminApi.put(`/superadmin/users/${id}/status`, { status });

// Per-user permissions — read/overwrite a user's embedded permissions[] via the
// superadmin-authenticated endpoints (used by the shared PermissionModal).
export const getUserPermissions = (id: string) =>
  superAdminApi.get<{ permissions: EmbeddedPermission[] }>(`/superadmin/users/${id}/permissions`);

export const updateUserPermissions = (id: string, permissions: EmbeddedPermission[]) =>
  superAdminApi.put(`/superadmin/users/${id}/permissions`, { permissions });
