// components/modals/FullCourseDetailsModal.tsx
import { AnimatePresence, motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    BookOpenText, 
    LayoutDashboard, 
    ListChecks, 
    Shapes, 
    Clock, 
    FileText, 
    Users, 
    User, 
    UserCheck,
    ImageIcon,
    FolderIcon,
    LayersIcon,
    Building2,
    Edit,
    UsersRound,
    Mail,
    Shield,
    Circle
} from 'lucide-react';
import { BaseModalProps, popupVariants } from './types';
import { StatusBadge } from '../StatusBadge';
import { ResourceTypesDisplay } from './ResourceTypesDisplay';
import { formatDate, hasPermission } from '../types/util';
import { useState } from 'react';

export const FullCourseDetailsModal: React.FC<BaseModalProps> = ({
    showFullDetails,
    setShowFullDetails,
    courseForDetails,
    userPermissions,
    setCourseToEdit,
    setIsPopupOpen
}) => {
    const [activeTab, setActiveTab] = useState<'details' | 'users'>('details');

    if (!showFullDetails || !courseForDetails || !setShowFullDetails) return null;

    // Extract users from every batch in batchAndParticipants
    const courseUsers = (courseForDetails.batchAndParticipants || []).flatMap(
        (b: any) => b?.users || []
    );

    return (
        <AnimatePresence>
            {showFullDetails && courseForDetails && (
                <Dialog open={showFullDetails} onOpenChange={setShowFullDetails}>
                    <DialogContent className="max-w-6xl bg-white dark:bg-gray-900 rounded-xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-800 p-0">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                            className="w-full"
                        >
                            <DialogHeader className="pb-4 border-b border-gray-200 dark:border-gray-800 p-6">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex-shrink-0">
                                            <BookOpenText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white font-sans truncate">
                                                {courseForDetails.courseName}
                                            </DialogTitle>
                                            <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 font-sans mt-0.5 flex items-center gap-2">
                                                <span className="truncate">{courseForDetails.courseCode}</span>
                                                <span className="text-gray-400 dark:text-gray-600">•</span>
                                                <span>Complete Course Details</span>
                                            </DialogDescription>
                                        </div>
                                    </div>
                                </div>
                            </DialogHeader>

                            {/* Tab Navigation */}
                            <div className="border-b border-gray-200 dark:border-gray-800 px-6">
                                <div className="flex gap-6">
                                    <button
                                        onClick={() => setActiveTab('details')}
                                        className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                                            activeTab === 'details'
                                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <LayoutDashboard className="w-4 h-4" />
                                            Course Details
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('users')}
                                        className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                                            activeTab === 'users'
                                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                                        }`}
                                    >
                                        <span className="flex items-center gap-2">
                                            <UsersRound className="w-4 h-4" />
                                            Participants ({courseUsers.length})
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className="p-6">
                                {activeTab === 'details' ? (
                                    <CourseDetailsTab courseForDetails={courseForDetails} />
                                ) : (
                                    <UsersTab users={courseUsers} />
                                )}
                            </div>

                            <DialogFooter className="pt-4 border-t border-gray-200 dark:border-gray-800 p-6">
                                <div className="flex gap-2 w-full justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowFullDetails(false)}
                                        className="text-sm h-9 font-medium border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        Close
                                    </Button>
                                    {hasPermission(userPermissions, 'coursestructure', ' Edit Course') && (
                                        <Button
                                            onClick={() => {
                                                setShowFullDetails(false);
                                                setCourseToEdit?.(courseForDetails._id);
                                                setIsPopupOpen?.(true);
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-sm h-9 font-medium"
                                        >
                                            <Edit className="w-4 h-4 mr-1" />
                                            Edit Course
                                        </Button>
                                    )}
                                </div>
                            </DialogFooter>
                        </motion.div>
                    </DialogContent>
                </Dialog>
            )}
        </AnimatePresence>
    );
};

// Course Details Tab Component
const CourseDetailsTab: React.FC<{ courseForDetails: any }> = ({ courseForDetails }) => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
        {/* Left Column - Course Information */}
        <div className="lg:col-span-2 space-y-4">
            {/* Basic Information Card */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Basic Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <InfoField label="Course Code" icon={ListChecks}>
                            {courseForDetails.courseCode}
                        </InfoField>
                        <InfoField label="Category" icon={Shapes}>
                            {courseForDetails.category}
                        </InfoField>
                        <InfoField label="Service Type" icon={LayoutDashboard}>
                            {courseForDetails.serviceType}
                        </InfoField>
                    </div>
                    <div className="space-y-3">
                        <InfoField label="Duration" icon={Clock}>
                            {courseForDetails.courseDuration || 'N/A'} {courseForDetails.courseDuration ? 'minutes' : ''}
                        </InfoField>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
                                Level
                            </label>
                            <div className="p-2">
                                <LevelBadge level={courseForDetails.courseLevel} />
                            </div>
                        </div>
                        <InfoField label="Last Updated">
                            {formatDate(courseForDetails.updatedAt)}
                        </InfoField>
                    </div>
                </div>
            </div>

            {/* Course Description */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Course Description
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600">
                    {courseForDetails.courseDescription || "No description provided."}
                </p>
            </div>

            {/* Pedagogy Details */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Pedagogy Structure
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <PedagogySection 
                        title="I Do" 
                        icon={User} 
                        items={courseForDetails.I_Do}
                        color="indigo"
                        emptyMessage="No instructor-led activities"
                    />
                    <PedagogySection 
                        title="We Do" 
                        icon={Users} 
                        items={courseForDetails.We_Do}
                        color="teal"
                        emptyMessage="No collaborative activities"
                    />
                    <PedagogySection 
                        title="You Do" 
                        icon={UserCheck} 
                        items={courseForDetails.You_Do}
                        color="amber"
                        emptyMessage="No independent activities"
                    />
                </div>
            </div>
        </div>

        {/* Right Column - Additional Information */}
        <div className="space-y-4">
            {/* Course Image */}
            <CourseImageDisplay courseImage={courseForDetails.courseImage} />

            {/* Resource Types */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <FolderIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Resource Types
                </h3>
                <ResourceTypesDisplay resourcesType={courseForDetails.resourcesType} />
            </div>

            {/* Course Hierarchy */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <LayersIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Course Levels
                </h3>
                <HierarchyList items={courseForDetails.courseHierarchy} />
            </div>

            {/* Client Information */}
            <ClientInfoCard course={courseForDetails} />
        </div>
    </div>
);

// Users Tab Component
const UsersTab: React.FC<{ users: any[] }> = ({ users }) => {
    if (!users || users.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <UsersRound className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">No Users Enrolled</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">This course doesn't have any participants yet.</p>
            </div>
        );
    }

    // Helper function to get status styling
    const getStatusStyles = (status: string) => {
        const statusMap: Record<string, { bg: string, text: string, dot: string, darkBg: string, darkText: string }> = {
            'active': {
                bg: 'bg-emerald-100',
                text: 'text-emerald-800',
                dot: 'bg-emerald-500',
                darkBg: 'dark:bg-emerald-900/30',
                darkText: 'dark:text-emerald-300'
            },
            'suspended': {
                bg: 'bg-amber-100',
                text: 'text-amber-800',
                dot: 'bg-amber-500',
                darkBg: 'dark:bg-amber-900/30',
                darkText: 'dark:text-amber-300'
            },
            'completed': {
                bg: 'bg-blue-100',
                text: 'text-blue-800',
                dot: 'bg-blue-500',
                darkBg: 'dark:bg-blue-900/30',
                darkText: 'dark:text-blue-300'
            },
            'dropped': {
                bg: 'bg-red-100',
                text: 'text-red-800',
                dot: 'bg-red-500',
                darkBg: 'dark:bg-red-900/30',
                darkText: 'dark:text-red-300'
            },
            'inactive': {
                bg: 'bg-gray-100',
                text: 'text-gray-800',
                dot: 'bg-gray-500',
                darkBg: 'dark:bg-gray-700',
                darkText: 'dark:text-gray-300'
            }
        };

        return statusMap[status?.toLowerCase()] || statusMap['inactive'];
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-800 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                        <th scope="col" className="px-6 py-3 font-semibold">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                User
                            </div>
                        </th>
                        <th scope="col" className="px-6 py-3 font-semibold">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4" />
                                Email
                            </div>
                        </th>
                        <th scope="col" className="px-6 py-3 font-semibold">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                Role
                            </div>
                        </th>
                        <th scope="col" className="px-6 py-3 font-semibold">
                            <div className="flex items-center gap-2">
                                <Circle className="w-4 h-4" />
                                Status
                            </div>
                        </th>
                       
                        <th scope="col" className="px-6 py-3 font-semibold text-right">
                            Enrolled
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((participant, index) => {
                        // Extract user data from participant
                        const userData = participant.user || participant;
                        
                        // Handle role - could be string or object
                        let roleName = 'N/A';
                        const role = userData?.role || participant.role;
                        if (role) {
                            if (typeof role === 'string') {
                                roleName = role;
                            } else if (typeof role === 'object') {
                                // Use originalRole or renameRole or fallback to _id
                                roleName = role.originalRole || role.renameRole || role._id || 'N/A';
                            }
                        }
                        
                        const userName = userData?.name || userData?.email?.split('@')[0] || 'Unknown User';
                        const userEmail = userData?.email || participant.email || 'N/A';
                        
                        // Status is at the participant level
                        const userStatus = participant.status || userData?.status || 'active';
                        
                        const userGroups = participant.groups || userData?.groups || [];
                        const enrolledDate = participant.createdAt || participant.enrolledAt || userData?.createdAt;

                        // Get status styles
                        const statusStyles = getStatusStyles(userStatus);

                        return (
                            <tr 
                                key={participant._id || index} 
                                className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                                            {userName.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="font-medium text-gray-900 dark:text-white">
                                            {userName}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                                    {userEmail}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                                        {roleName}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles.bg} ${statusStyles.text} ${statusStyles.darkBg} ${statusStyles.darkText}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusStyles.dot}`} />
                                        {userStatus.charAt(0).toUpperCase() + userStatus.slice(1)}
                                    </span>
                                </td>
                               
                                <td className="px-6 py-4 text-right text-xs text-gray-500 dark:text-gray-400">
                                    {enrolledDate ? formatDate(enrolledDate) : 'N/A'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            
            {/* Summary */}
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-800 pt-4">
                <span>Total Participants: <strong className="text-gray-900 dark:text-white">{users.length}</strong></span>
                <div className="flex gap-4 flex-wrap">
                    <span>Active: <strong className="text-emerald-600 dark:text-emerald-400">
                        {users.filter((p: any) => {
                            const status = p.status || 'active';
                            return status?.toLowerCase() === 'active';
                        }).length}
                    </strong></span>
                    <span>Suspended: <strong className="text-amber-600 dark:text-amber-400">
                        {users.filter((p: any) => {
                            const status = p.status || '';
                            return status?.toLowerCase() === 'suspended';
                        }).length}
                    </strong></span>
                    <span>Completed: <strong className="text-blue-600 dark:text-blue-400">
                        {users.filter((p: any) => {
                            const status = p.status || '';
                            return status?.toLowerCase() === 'completed';
                        }).length}
                    </strong></span>
                    <span>Dropped: <strong className="text-red-600 dark:text-red-400">
                        {users.filter((p: any) => {
                            const status = p.status || '';
                            return status?.toLowerCase() === 'dropped';
                        }).length}
                    </strong></span>
                </div>
            </div>
        </div>
    );
};

// Helper sub-components
const InfoField: React.FC<{ label: string; icon?: any; children: React.ReactNode }> = ({ label, icon: Icon, children }) => (
    <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide">
            {label}
        </label>
        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            {Icon && <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
            <span className="text-sm font-medium text-gray-900 dark:text-white">
                {children}
            </span>
        </div>
    </div>
);

const LevelBadge: React.FC<{ level: string }> = ({ level }) => (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
        level?.toLowerCase() === 'beginner'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
            : level?.toLowerCase() === 'intermediate'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
    }`}>
        {level}
    </span>
);

const PedagogySection: React.FC<{ 
    title: string; 
    icon: any; 
    items: string[]; 
    color: string;
    emptyMessage: string;
}> = ({ title, icon: Icon, items, color, emptyMessage }) => {
    const colorClasses = {
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800',
        teal: 'bg-teal-50 dark:bg-teal-900/20 border-teal-100 dark:border-teal-800',
        amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800'
    };
    
    const textColorClasses = {
        indigo: 'text-indigo-700 dark:text-indigo-300',
        teal: 'text-teal-700 dark:text-teal-300',
        amber: 'text-amber-700 dark:text-amber-300'
    };

    return (
        <div className={`${colorClasses[color as keyof typeof colorClasses]} rounded-lg p-3 border`}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${textColorClasses[color as keyof typeof textColorClasses]}`} />
                <h4 className={`text-sm font-semibold ${textColorClasses[color as keyof typeof textColorClasses]}`}>
                    {title}
                </h4>
            </div>
            <div className="space-y-1">
                {Array.isArray(items) && items.length > 0 ? (
                    items.map((item, index) => (
                        <div key={index} className={`text-xs ${textColorClasses[color as keyof typeof textColorClasses]} bg-white dark:bg-gray-800 px-2 py-1 rounded border`}>
                            {item}
                        </div>
                    ))
                ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">{emptyMessage}</p>
                )}
            </div>
        </div>
    );
};

const CourseImageDisplay: React.FC<{ courseImage?: string }> = ({ courseImage }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Course Thumbnail
        </h3>
        {courseImage ? (
            <div className="aspect-video rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-100 dark:bg-gray-700">
                <img src={courseImage} alt="Course thumbnail" className="w-full h-full object-cover" />
            </div>
        ) : (
            <div className="aspect-video rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center justify-center">
                <div className="text-center">
                    <ImageIcon className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">No thumbnail available</p>
                </div>
            </div>
        )}
    </div>
);

const HierarchyList: React.FC<{ items: string[] }> = ({ items }) => (
    <div className="flex flex-wrap gap-1">
        {Array.isArray(items) && items.length > 0 ? (
            items.map((level, index) => (
                <span
                    key={index}
                    className="text-xs px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                >
                    <LayersIcon className="w-3 h-3" />
                    {level}
                </span>
            ))
        ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">No course levels specified</p>
        )}
    </div>
);

const ClientInfoCard: React.FC<{ course: any }> = ({ course }) => (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Client Information
        </h3>
        <div className="space-y-2">
            <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Company</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {course.clientData?.clientCompany || 
                     (typeof course.clientName === 'string' ? course.clientName : 'N/A')}
                </p>
            </div>
            {course.clientData?.clientAddress && (
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Address</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{course.clientData.clientAddress}</p>
                </div>
            )}
            {course.clientData?.contactPersons && course.clientData.contactPersons.length > 0 && (
                <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Primary Contact</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                        {course.clientData.contactPersons.find((p: any) => p.isPrimary)?.name || 
                         course.clientData.contactPersons[0]?.name}
                    </p>
                </div>
            )}
        </div>
    </div>
);