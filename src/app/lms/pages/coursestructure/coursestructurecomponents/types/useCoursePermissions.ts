import { useState, useEffect } from "react";
import { Permission, UserData } from ".";
import { getCurrentUser, hasPermission, getPermission } from "./util";

export const useCoursePermissions = () => {
    const [userPermissions, setUserPermissions] = useState<Permission[]>([]);
    const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
    const [canAddCourse, setCanAddCourse] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [canAddCourseStructure, setCanAddCourseStructure] = useState(false);

    useEffect(() => {
        const loadUserPermissions = () => {
            try {
                setIsLoadingPermissions(true);
                const response = getCurrentUser();
                
                if (response.valid && response.user) {
                    setUserData(response.user);
                    
                    if (response.user.permissions && Array.isArray(response.user.permissions)) {
                        setUserPermissions(response.user.permissions);
                        
                        const canAdd = hasPermission(response.user.permissions, 'coursestructure', 'Add Course');
                        setCanAddCourse(canAdd);
                        
                        const canAddStructure = hasPermission(response.user.permissions, 'coursestructure', 'Add Course Structure');
                        setCanAddCourseStructure(canAddStructure);
                    } else {
                        setUserPermissions([]);
                    }
                }
            } catch (error) {
                console.error('Failed to load user permissions from localStorage:', error);
            } finally {
                setIsLoadingPermissions(false);
            }
        };

        loadUserPermissions();
    }, []);

    const hasAnyCoursePermission = userPermissions.some(p => p.permissionKey === 'coursestructure' && p.isActive);

    return {
        userPermissions,
        isLoadingPermissions,
        canAddCourse,
        userData,
        canAddCourseStructure,
        hasAnyCoursePermission
    };
};