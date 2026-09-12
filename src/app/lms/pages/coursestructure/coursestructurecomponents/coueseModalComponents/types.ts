// components/modals/types.ts

import { CourseStructure,Permission } from "../types";

export interface BaseModalProps {
    showFullDetails?: boolean;
    setShowFullDetails?: (show: boolean) => void;
    courseForDetails?: CourseStructure | null;
    selectedCourse?: CourseStructure | null;
    setSelectedCourse?: (course: CourseStructure | null) => void;
    selectedClient?: any;
    setSelectedClient?: (client: any) => void;
    selectedHierarchy?: any;
    setSelectedHierarchy?: (hierarchy: any) => void;
    selectedPedagogy?: any;
    setSelectedPedagogy?: (pedagogy: any) => void;
    showDeleteModal?: boolean;
    setShowDeleteModal?: (show: boolean) => void;
    courseToDelete?: CourseStructure | null;
    isDeleting?: boolean;
    confirmDelete?: () => void;
    userPermissions: Permission[];
    setCourseToEdit?: (courseId: string | null) => void;
    setIsPopupOpen?: (open: boolean) => void;
}

export const popupVariants = {
    hidden: {
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.15 }
    },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.2, ease: "easeOut" }
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.1 }
    }
} as const;