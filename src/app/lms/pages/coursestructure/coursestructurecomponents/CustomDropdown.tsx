import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MoreVertical,
    Eye,
    UserPlus,
    UploadIcon,
    Edit,
    Copy,
    Trash2,
    CalendarDays,
    MessageSquarePlus,  // Add this import for feedback icon
    ListChecks,
    Lock
} from 'lucide-react';
import { CourseStructure, Permission } from './types/index';
import { hasPermission, getPermission } from './types/util';
 
interface CustomDropdownProps {
    course: CourseStructure;
    onViewDetails: (course: CourseStructure) => void;
    onEdit: (courseId: string) => void;
    onDuplicate: (courseId: string) => void;
    onDelete: (course: CourseStructure) => void;
    userPermissions: Permission[];
    onAddFeedback?: (courseId: string) => void; // Optional callback for feedback
    onAddCourseStructure?: (courseId: string) => void;
    canAddCourseStructure?: boolean;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
    course,
    onViewDetails,
    onEdit,
    onDuplicate,
    onDelete,
    userPermissions,
    onAddFeedback,
    onAddCourseStructure,
    canAddCourseStructure
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const dropdownRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Menu renders in a portal (document.body), so the table's overflow
    // clipping can't hide it. Position is computed from the trigger button.
    const MENU_WIDTH = 192; // matches w-48
    const EST_MENU_HEIGHT = 300; // 9 compact rows + 2 dividers + padding

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isOpen) {
            setIsOpen(false);
            return;
        }
        const rect = dropdownRef.current?.getBoundingClientRect();
        if (rect) {
            const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
            const spaceBelow = window.innerHeight - rect.bottom;
            // Open on whichever side has more room, and cap the menu height
            // to the space actually available so it never runs off-screen —
            // when it can't fully fit, it scrolls internally instead.
            if (spaceBelow < EST_MENU_HEIGHT && rect.top > spaceBelow) {
                setMenuStyle({
                    left,
                    bottom: window.innerHeight - rect.top + 4,
                    maxHeight: Math.max(120, rect.top - 12),
                });
            } else {
                setMenuStyle({
                    left,
                    top: rect.bottom + 4,
                    maxHeight: Math.max(120, spaceBelow - 12),
                });
            }
        }
        setIsOpen(true);
    };
   
    // Check permissions - Use exact functionality names from your data
    const canViewDetails = hasPermission(userPermissions, 'coursestructure', 'View Full Details');
    const canAddParticipants = hasPermission(userPermissions, 'coursestructure', 'Add Participants');
    const canEditCourse = hasPermission(userPermissions, 'coursestructure', 'Edit Course');
    const canDuplicateCourse = hasPermission(userPermissions, 'coursestructure', 'Dublicate');
    const canDeleteCourse = hasPermission(userPermissions, 'coursestructure', 'Delete Course');
    const canUploadResources = hasPermission(userPermissions, 'coursestructure', 'Upload Resourses');
    const canViewProgramCalendar = hasPermission(userPermissions, 'coursestructure', 'Program Calendar');
    const canAddFeedback = hasPermission(userPermissions, 'coursestructure', 'Add Feedback');
 
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (!dropdownRef.current?.contains(target) && !menuRef.current?.contains(target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Close the floating menu when the page scrolls or resizes so it
    // never drifts away from its trigger button. Scrolls that originate
    // INSIDE the menu (it scrolls internally when space is tight) must
    // not close it.
    useEffect(() => {
        if (!isOpen) return;
        const closeOnScroll = (e: Event) => {
            if (e.target instanceof Node && menuRef.current?.contains(e.target)) return;
            setIsOpen(false);
        };
        const closeOnResize = () => setIsOpen(false);
        window.addEventListener('scroll', closeOnScroll, true);
        window.addEventListener('resize', closeOnResize);
        return () => {
            window.removeEventListener('scroll', closeOnScroll, true);
            window.removeEventListener('resize', closeOnResize);
        };
    }, [isOpen]);
 
    const handleAction = (action: string) => {
        setIsOpen(false);
        switch (action) {
            case 'view':
                onViewDetails(course);
                break;
            case 'edit':
                onEdit(course._id);
                break;
            case 'duplicate':
                onDuplicate(course._id);
                break;
            case 'delete':
                onDelete(course);
                break;
            case 'participants':
                goToParticipantsPage(course._id);
                break;
            case 'programCalendar':
                goToProgramCalendar(course._id);
                break;
            case 'feedback':
                goToFeedbackPage(course._id);
                break;
            case 'resources':
                goToUploadResources(course._id);
                break;
            case 'addStructure':
                onAddCourseStructure?.(course._id);
                break;
        }
    };
   
    const goToUploadResources = (courseId: string) => {
        const query = new URLSearchParams({
            courseId: courseId ?? '',
        }).toString();
        router.push(`/lms/pages/coursestructure/view-resources?${query}`);
    };
   
    const goToParticipantsPage = (courseId: string) => {
        // Batches come first: participants are always added inside a batch,
        // so this lands on the Batches page; each batch's "Manage
        // Participants" action then opens course-participants with the
        // batch context.
        const query = new URLSearchParams({
            courseId: courseId ?? '',
        }).toString();
        router.push(`/lms/pages/coursestructure/course-batches?${query}`);
    };
   
    const goToProgramCalendar = (courseId: string) => {
        const query = new URLSearchParams({
            courseId: courseId ?? '',
        }).toString();
        router.push(`/lms/pages/coursestructure/programcalendar?${query}`);
    };
   
    const goToFeedbackPage = (courseId: string) => {
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
   
    // Get course management permission
    const coursePermission = getPermission(userPermissions, 'coursestructure');
    const hasCourseManagementAccess = coursePermission?.isActive || false;

    // Structure-dependent actions (Program Calendar, View Resources, Add
    // Feedback) are pointless on a fresh course with no modules — they stay
    // visible but greyed out with a hint. moduleCount comes from
    // /courses-structure/getAll; if a cached response predates the field,
    // don't gate anything (behave as before).
    const hasStructure = typeof course.moduleCount === 'number' ? course.moduleCount > 0 : true;
    // Enrolled-user count from the same listing response. Only the Program
    // Calendar is unlocked by participants (see unlockedByParticipants below):
    // View Resources and Add Feedback still genuinely need modules, so they stay
    // gated on structure alone.
    const hasParticipants = typeof course.participantCount === 'number' ? course.participantCount > 0 : false;
    const STRUCTURE_HINT = 'Create course structure first';
    const CALENDAR_HINT = 'Add course structure or enrol a user first';
    
    // Build dynamic permission list for better maintainability
    // Ordered by course lifecycle and split into groups (a divider renders
    // between groups): build the course → run it day-to-day → manage the
    // course record → danger zone. The three structure-locked actions sit
    // together so a fresh course shows one contiguous locked block.
    const permissionItems = [
        { key: 'addCourseStructure', group: 'build', permission: !!(canAddCourseStructure && onAddCourseStructure), label: 'Add Course Structure', icon: ListChecks, color: 'green', action: 'addStructure' },
        { key: 'viewDetails', group: 'build', permission: canViewDetails, label: 'View Full Details', icon: Eye, color: 'orange', action: 'view' },
        { key: 'addParticipants', group: 'run', permission: canAddParticipants, label: 'Add Participants', icon: UserPlus, color: 'green', action: 'participants' },
        { key: 'programCalendar', group: 'run', permission: canViewProgramCalendar, label: 'Program Calendar', icon: CalendarDays, color: 'indigo', action: 'programCalendar', requiresStructure: true, unlockedByParticipants: true },
        { key: 'uploadResources', group: 'run', permission: canUploadResources, label: 'View Resources', icon: UploadIcon, color: 'orange', action: 'resources', requiresStructure: true },
        { key: 'addFeedback', group: 'run', permission: canAddFeedback, label: 'Add Feedback', icon: MessageSquarePlus, color: 'orange', action: 'feedback', requiresStructure: true },
        { key: 'editCourse', group: 'record', permission: canEditCourse, label: 'Edit Course', icon: Edit, color: 'orange', action: 'edit' },
        { key: 'duplicateCourse', group: 'record', permission: canDuplicateCourse, label: 'Duplicate', icon: Copy, color: 'purple', action: 'duplicate' },
        { key: 'deleteCourse', group: 'danger', permission: canDeleteCourse, label: 'Delete Course', icon: Trash2, color: 'red', action: 'delete' }
    ];
 
    const hasAnyPermission = permissionItems.some(item => item.permission);
 
    if (!hasCourseManagementAccess) {
        return (
            <button
                className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all duration-200 group opacity-50 cursor-not-allowed"
                disabled
            >
                <MoreVertical className="h-3 w-3 text-gray-400 dark:text-gray-500" />
            </button>
        );
    }
 
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={toggleMenu}
                className="flex items-center gap-1 px-2 py-1 rounded bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all duration-200 group"
                disabled={!hasAnyPermission}
            >
                <MoreVertical className="h-3 w-3 text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
            </button>

            {typeof document !== 'undefined' && createPortal(
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, scale: 0.95, y: -5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -5 }}
                        transition={{ duration: 0.15 }}
                        style={menuStyle}
                        className="fixed w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 z-[9999] py-1 overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Render permission items dynamically */}
                        {permissionItems.map((item, index) => {
                            if (!item.permission) return null;

                            // Divider whenever the lifecycle group changes
                            // between two VISIBLE items (build | run |
                            // record | danger).
                            const prevVisible = permissionItems
                                .slice(0, index)
                                .filter(i => i.permission)
                                .pop();
                            const showDividerBefore = !!prevVisible && prevVisible.group !== item.group;

                            return (
                                <div key={item.key}>
                                    {/* Render divider if needed */}
                                    {showDividerBefore && (
                                        <div className="border-t border-gray-200 dark:border-gray-800 my-1"></div>
                                    )}
                                    
                                    {/* Render the button. Structure-dependent
                                        actions are greyed out (not hidden) on
                                        courses without modules — the tooltip
                                        says what unlocks them. */}
                                    {(() => {
                                        // Program Calendar (unlockedByParticipants)
                                        // also opens once the course has enrolled
                                        // users, so an auto-enrolled cohort can be
                                        // scheduled before its structure exists.
                                        const unlocked = hasStructure || (item.unlockedByParticipants && hasParticipants);
                                        const locked = !!item.requiresStructure && !unlocked;
                                        return (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (locked) return;
                                                    handleAction(item.action);
                                                }}
                                                title={locked ? (item.unlockedByParticipants ? CALENDAR_HINT : STRUCTURE_HINT) : undefined}
                                                aria-disabled={locked}
                                                className={`flex items-center gap-2 px-3 py-1.5 text-xs w-full text-left whitespace-nowrap transition-colors ${
                                                    locked
                                                        ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                                                        : item.action === 'delete'
                                                            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                            >
                                                <item.icon className={`h-3.5 w-3.5 shrink-0 ${locked ? 'text-gray-300 dark:text-gray-700' : `text-${item.color}-600 dark:text-${item.color}-400`}`} />
                                                <span className="flex-1 truncate">{item.label}</span>
                                                {locked && (
                                                    <Lock className="h-3 w-3 text-gray-300 dark:text-gray-600 shrink-0" />
                                                )}
                                            </button>
                                        );
                                    })()}
                                </div>
                            );
                        })}
                        
                        {/* If no permissions show message */}
                        {!hasAnyPermission && (
                            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 text-center italic">
                                No actions available
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body
            )}
        </div>
    );
};