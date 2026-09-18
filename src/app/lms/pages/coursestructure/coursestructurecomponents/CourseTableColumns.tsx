import { ReactNode } from 'react';
import { useRouter } from 'next/navigation'; // Correct import
import { CourseStructure, Permission } from './types';
import { formatDate } from './types/util';
import { CustomDropdown } from './CustomDropdown';
import {
    BookOpen,
    Users,
    ArrowUpDown,
    ArrowUp,
    ArrowDown
} from 'lucide-react';

interface CourseTableColumnsProps {
    sortField: 'date' | 'courseName' | 'clientName' | null;
    sortDirection: 'asc' | 'desc';
    handleSort: (field: 'date' | 'courseName' | 'clientName') => void;
    getSortIcon: (field: 'date' | 'courseName' | 'clientName') => ReactNode;
    setSelectedCourse: (course: CourseStructure | null) => void;
    setSelectedHierarchy: (hierarchy: any) => void;
    setSelectedPedagogy: (pedagogy: any) => void;
    canAddCourseStructure: boolean;
    userPermissions: Permission[];
    goToPedagogyPage: (courseId: string) => void;
    handleViewFullDetails: (course: CourseStructure) => void;
    handleEditCourse: (courseId: string) => void;
    handleDeleteCourse: (course: CourseStructure) => void;
    handleDuplicateCourse: (courseId: string) => void; // Add this
    onAddFeedback?: (courseId: string) => void; // Add this
}

export const CourseTableColumns = ({
    sortField,
    sortDirection,
    handleSort,
    getSortIcon,
    setSelectedCourse,
    setSelectedHierarchy,
    setSelectedPedagogy,
    canAddCourseStructure,
    userPermissions,
    goToPedagogyPage,
    handleViewFullDetails,
    handleEditCourse,
    handleDeleteCourse,
    handleDuplicateCourse,
    onAddFeedback
}: CourseTableColumnsProps) => {
    
    const router = useRouter(); // Use the hook here

    const columns = [
        {
            key: 'sno',
            label: 'S.No',
            width: '5%',
            align: 'center' as const,
            renderCell: (structure: CourseStructure & { sno?: number }) => (
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 font-sans">
                    {structure.sno}
                </div>
            )
        },
        {
            key: 'courseCode',
            label: 'Course ID',
            width: '9%',
            align: 'left' as const,
            renderCell: (structure: CourseStructure) => (
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 font-sans truncate">
                    {structure.courseCode}
                </div>
            )
        },
        {
            key: 'courseName',
            label: (
                <div className="flex items-center cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 transition-colors" onClick={() => handleSort('courseName')}>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Course Name</span>
                    {getSortIcon('courseName')}
                </div>
            ),
            width: '18%',
            align: 'left' as const,
            renderCell: (structure: CourseStructure) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCourse(structure);
                    }}
                    className="text-left w-full hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-1 py-1 transition-colors"
                >
                    <span className="text-sm font-semibold text-gray-900 dark:text-white font-sans truncate">{structure.courseName}</span>
                </button>
            )
        },
        {
            key: 'clientName',
            label: (
                <div className="flex items-center cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 transition-colors" onClick={() => handleSort('clientName')}>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Client</span>
                    {getSortIcon('clientName')}
                </div>
            ),
            width: '12%',
            align: 'left' as const,
            renderCell: (structure: CourseStructure) => (
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 font-sans truncate">
                    {structure.clientData?.clientCompany || (typeof structure.clientName === 'string' ? structure.clientName : structure.clientName?.$oid || '')}
                </div>
            )
        },
        {
            key: 'domain',
            label: 'Domain',
            width: '12%',
            align: 'left' as const,
            renderCell: (structure: CourseStructure) => (
                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 font-sans truncate">
                    {structure.category}
                </div>
            )
        },
        {
            key: 'courseDate',
            label: (
                <div className="flex items-center cursor-pointer hover:text-gray-900 dark:hover:text-gray-100 transition-colors" onClick={() => handleSort('date')}>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Created On</span>
                    {getSortIcon('date')}
                </div>
            ),
            width: '10%',
            align: 'left' as const,
            renderCell: (structure: CourseStructure) => (
                <div className="text-xs font-medium text-gray-900 dark:text-gray-100 font-sans">
                    {formatDate(structure.createdAt)}
                </div>
            )
        },
        {
            key: 'courseHierarchy',
            label: 'Structure',
            width: '13%',
            align: 'center' as const,
            renderCell: (structure: CourseStructure) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedHierarchy({
                            resourcesType: structure.resourcesType,
                            courseHierarchy: structure.courseHierarchy
                        });
                    }}
                    className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/40 border border-indigo-200 dark:border-indigo-800 transition-all duration-200 group w-full"
                >
                    <BookOpen className="h-3 w-3 flex-shrink-0 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300" />
                    <span className="text-xs font-medium whitespace-nowrap text-indigo-700 dark:text-indigo-300 group-hover:text-indigo-800 dark:group-hover:text-indigo-200">View Structure</span>
                </button>
            )
        },
        {
            key: 'pedagogy',
            label: 'Pedagogy',
            width: '13%',
            align: 'center' as const,
            renderCell: (structure: CourseStructure) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPedagogy({
                            I_Do: structure.I_Do,
                            We_Do: structure.We_Do,
                            You_Do: structure.You_Do
                        });
                    }}
                    className="flex items-center justify-center gap-1 px-2 py-1 rounded bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-800/40 border border-purple-200 dark:border-purple-800 transition-all duration-200 group w-full"
                >
                    <Users className="h-3 w-3 flex-shrink-0 text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300" />
                    <span className="text-xs font-medium whitespace-nowrap text-purple-700 dark:text-purple-300 group-hover:text-purple-800 dark:group-hover:text-purple-200">View Pedagogy</span>
                </button>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            width: '8%',
            align: 'center' as const,
            stopRowClick: true,
            renderCell: (structure: CourseStructure) => {
                // Define the feedback handler with default navigation
                const handleAddFeedback = (courseId: string) => {
                    if (onAddFeedback) {
                        onAddFeedback(courseId);
                    } else {
                        // Default navigation if callback not provided
                        const query = new URLSearchParams({
                            courseId: courseId ?? '',
                        }).toString();
                        router.push(`/lms/pages/coursestructure/feedback?${query}`);
                    }
                };

                return (
                    <div className="flex gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                        <CustomDropdown
                            course={structure}
                            onViewDetails={handleViewFullDetails}
                            onEdit={handleEditCourse}
                            onDuplicate={handleDuplicateCourse}
                            onDelete={handleDeleteCourse}
                            userPermissions={userPermissions}
                            onAddFeedback={handleAddFeedback}
                            onAddCourseStructure={goToPedagogyPage}
                            canAddCourseStructure={canAddCourseStructure}
                        />
                    </div>
                );
            }
        }
    ];

    return columns;
};