// components/modals/BasicCourseDetailsModal.tsx
import { AnimatePresence, motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { 
    BookOpenText, 
    LayoutDashboard, 
    ListChecks, 
    Shapes, 
    Clock, 
    ImageIcon
} from 'lucide-react';
import { BaseModalProps, popupVariants } from './types';
import { StatusBadge } from '../StatusBadge';

export const BasicCourseDetailsModal: React.FC<BaseModalProps> = ({
    selectedCourse,
    setSelectedCourse
}) => {
    if (!selectedCourse || !setSelectedCourse) return null;

    return (
        <AnimatePresence>
            {selectedCourse && (
                <Dialog open={!!selectedCourse} onOpenChange={() => setSelectedCourse(null)}>
                    <DialogContent className="max-w-4xl bg-white dark:bg-gray-900 rounded-xl w-[95vw] max-h-[85vh] overflow-y-auto border border-gray-200 dark:border-gray-800">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                            className="w-full"
                        >
                            <DialogHeader className="pb-3 border-b border-gray-200 dark:border-gray-800">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex-shrink-0">
                                            <BookOpenText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white font-sans truncate">
                                                {selectedCourse.courseName}
                                            </DialogTitle>
                                            <DialogDescription className="text-xs text-gray-600 dark:text-gray-400 font-sans mt-0.5 truncate">
                                                Complete information about {selectedCourse.courseName}
                                            </DialogDescription>
                                        </div>
                                    </div>
                                    <StatusBadge status={selectedCourse.status} />
                                </div>
                            </DialogHeader>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 py-3 w-full">
                                <div className="lg:col-span-2 space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
                                        <div className="space-y-2">
                                            <InfoCard label="Course Code" icon={ListChecks}>
                                                {selectedCourse.courseCode}
                                            </InfoCard>
                                            <InfoCard label="Category" icon={Shapes}>
                                                {selectedCourse.category}
                                            </InfoCard>
                                        </div>
                                        <div className="space-y-2">
                                            <InfoCard label="Service Type" icon={LayoutDashboard}>
                                                {selectedCourse.serviceType}
                                            </InfoCard>
                                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 w-full">
                                                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide font-sans">
                                                    Duration & Level
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex-shrink-0">
                                                        <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-sm font-medium text-gray-900 dark:text-white font-sans block truncate">
                                                            {selectedCourse.courseDuration || 'N/A'} {selectedCourse.courseDuration ? 'minutes' : ''}
                                                        </span>
                                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full inline-block mt-0.5 ${
                                                            selectedCourse.courseLevel?.toLowerCase() === 'beginner'
                                                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                                : selectedCourse.courseLevel?.toLowerCase() === 'intermediate'
                                                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                                                    : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                                        }`}>
                                                            {selectedCourse.courseLevel}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 w-full">
                                        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide font-sans">
                                            Course Description
                                        </label>
                                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-sans whitespace-pre-line max-h-24 overflow-y-auto">
                                            {selectedCourse.courseDescription}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {selectedCourse.courseImage ? (
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 w-full">
                                            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide font-sans">
                                                Course Thumbnail
                                            </label>
                                            <div className="aspect-video rounded border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 w-full">
                                                <img
                                                    src={selectedCourse.courseImage}
                                                    alt="Course thumbnail"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 w-full h-full flex items-center justify-center min-h-[120px]">
                                            <div className="text-center">
                                                <ImageIcon className="w-6 h-6 text-gray-400 dark:text-gray-500 mx-auto mb-1" />
                                                <p className="text-xs text-gray-500 dark:text-gray-400 font-sans">No thumbnail available</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </DialogContent>
                </Dialog>
            )}
        </AnimatePresence>
    );
};

const InfoCard: React.FC<{ label: string; icon: any; children: React.ReactNode }> = ({ label, icon: Icon, children }) => (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 w-full">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wide font-sans">
            {label}
        </label>
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex-shrink-0">
                <Icon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white font-sans truncate">
                {children}
            </span>
        </div>
    </div>
);