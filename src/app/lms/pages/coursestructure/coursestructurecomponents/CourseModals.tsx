// components/CourseModals.tsx
import { CourseStructure, Permission } from './types/index';
import { FullCourseDetailsModal } from './coueseModalComponents/FullCourseDetailsModal';
import { BasicCourseDetailsModal } from './coueseModalComponents/BasicCourseDetailsModal';
import { ClientDetailsModal } from './coueseModalComponents/ClientDetailsModal';
import { HierarchyDetailsModal } from './coueseModalComponents/HierarchyDetailsModal';
import { PedagogyDetailsModal } from './coueseModalComponents/PedagogyDetailsModal';
import { DeleteConfirmationModal } from './coueseModalComponents/DeleteConfirmationModal';

interface CourseModalsProps {
    showFullDetails: boolean;
    setShowFullDetails: (show: boolean) => void;
    courseForDetails: CourseStructure | null;
    selectedCourse: CourseStructure | null;
    setSelectedCourse: (course: CourseStructure | null) => void;
    selectedClient: any;
    setSelectedClient: (client: any) => void;
    selectedHierarchy: any;
    setSelectedHierarchy: (hierarchy: any) => void;
    selectedPedagogy: any;
    setSelectedPedagogy: (pedagogy: any) => void;
    showDeleteModal: boolean;
    setShowDeleteModal: (show: boolean) => void;
    courseToDelete: CourseStructure | null;
    isDeleting: boolean;
    confirmDelete: () => void;
    userPermissions: Permission[];
    setCourseToEdit: (courseId: string | null) => void;
    setIsPopupOpen: (open: boolean) => void;
}

export const CourseModals: React.FC<CourseModalsProps> = (props) => {
    return (
        <>
            <FullCourseDetailsModal {...props} />
            <BasicCourseDetailsModal {...props} />
            <ClientDetailsModal {...props} />
            <HierarchyDetailsModal {...props} />
            <PedagogyDetailsModal {...props} />
            <DeleteConfirmationModal {...props} />
        </>
    );
};