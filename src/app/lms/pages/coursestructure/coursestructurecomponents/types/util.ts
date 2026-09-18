import { Permission, UserData } from ".";
import { getFlatPages, storedListMatches } from "@/app/lms/pages/usermanagement/config/permissions.helpers";

const USER_DATA_KEY = "smartcliff_userData";

export const getCurrentUser = (): { valid: boolean; user: UserData | null } => {
    try {
        const userDataString = localStorage.getItem(USER_DATA_KEY);
        if (!userDataString) {
            return { valid: false, user: null };
        }
        
        const userData: UserData = JSON.parse(userDataString);
        return { valid: true, user: userData };
    } catch (error) {
        console.error("Error getting user data from localStorage:", error);
        return { valid: false, user: null };
    }
};

export const getUserRole = (): string => {
    try {
        const storedRoleValue = localStorage.getItem("smartcliff_roleValue");
        if (storedRoleValue) {
            return storedRoleValue.toLowerCase();
        }

        const userResult = getCurrentUser();
        if (!userResult.valid || !userResult.user) return '';
        
        const user = userResult.user;
        if (typeof user.role === 'object' && user.role !== null) {
            return (user.role as any).roleValue?.toLowerCase() || 
                   (user.role as any).originalRole?.toLowerCase() || 
                   (user.role as any).renameRole?.toLowerCase() || '';
        } else if (typeof user.role === 'string') {
            return (user.role as string).toLowerCase();
        }
        return '';
    } catch {
        return '';
    }
};

// Alias-aware — see usermanagement/components/permissions.ts for the
// motivation. Old call-sites pass legacy functionality labels; the tree may
// have renamed them, and storage now writes the new names. Delegating through
// storedListMatches makes both directions resolve.
export const hasPermission = (
    permissions: Permission[],
    permissionKey: string,
    functionality?: string
): boolean => {
    const permission = permissions.find(p => p.permissionKey === permissionKey);
    if (!permission || !permission.isActive) return false;
    if (!functionality) return true;
    const stored = permission.permissionFunctionality || [];
    const pageIds = getFlatPages()
        .filter((p) => p.key === permissionKey)
        .map((p) => p.id);
    if (pageIds.some((id) => storedListMatches(id, functionality, stored))) return true;
    return stored.some((f) => f.trim().toLowerCase() === functionality.trim().toLowerCase());
};

export const getPermission = (
    permissions: Permission[],
    permissionKey: string
): Permission | undefined => {
    return permissions.find(p => p.permissionKey === permissionKey && p.isActive);
};

export const formatDate = (d: string): string => new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
});