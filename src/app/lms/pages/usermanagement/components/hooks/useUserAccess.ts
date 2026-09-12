"use client";

// Who is looking at User Management, and what may they do here.
//
// Reads the signed-in role, token and institution out of the session, then
// resolves the three page-level permissions the toolbar gates on. Kept apart
// from the directory itself because none of it depends on the user list — it
// settles once on mount and is then just read.

import { useState, useEffect } from "react";
import { getToken } from "@/lib/session";
import { userPermission } from "@/apiServices/tokenVerify";
import { hasPermission } from "../permissions";
import type { ApiPermission } from "../types";

export interface UserAccess {
  userRole: string | null;
  token: string | null;
  institutionId: string | null;
  basedOn: string | null;
  userPermissions: ApiPermission[];
  canAddUser: boolean;
  canBulkUpload: boolean;
  canBulkPermission: boolean;
  isLoadingPermissions: boolean;
}

export function useUserAccess(): UserAccess {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [basedOn, setBasedOn] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<ApiPermission[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [canAddUser, setCanAddUser] = useState(false);
  const [canBulkUpload, setCanBulkUpload] = useState(false);
  const [canBulkPermission, setCanBulkPermission] = useState(false);

  // Fetch user role and permissions
  useEffect(() => {
    const role = localStorage.getItem('smartcliff_roleValue');
    setUserRole(role);

    const fetchUserPermissions = async () => {
      try {
        setIsLoadingPermissions(true);
        const response = await userPermission();
        if (response.valid && response.user && response.user.permissions) {
          setUserPermissions(response.user.permissions);
          setCanAddUser(hasPermission(response.user.permissions, 'usermanagement', 'Add User'));
          setCanBulkUpload(hasPermission(response.user.permissions, 'usermanagement', 'Bulk Upload'));
          setCanBulkPermission(hasPermission(response.user.permissions, 'usermanagement', 'Bulk Permission'));
        }
      } catch (error) {
        console.error('Failed to fetch user permissions:', error);
      } finally {
        setIsLoadingPermissions(false);
      }
    };
    fetchUserPermissions();
  }, []);

  // Get token and institution info
  useEffect(() => {
    setToken(getToken());
    setInstitutionId(localStorage.getItem('smartcliff_institution'));
    setBasedOn(localStorage.getItem('smartcliff_basedOn'));
  }, []);

  return {
    userRole,
    token,
    institutionId,
    basedOn,
    userPermissions,
    canAddUser,
    canBulkUpload,
    canBulkPermission,
    isLoadingPermissions,
  };
}
