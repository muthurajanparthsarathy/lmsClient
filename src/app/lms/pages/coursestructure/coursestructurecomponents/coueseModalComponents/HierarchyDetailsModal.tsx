// components/modals/HierarchyDetailsModal.tsx
import { AnimatePresence, motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { FolderIcon, LayersIcon, LayoutGridIcon } from 'lucide-react';
import { BaseModalProps, popupVariants } from './types';
import { ResourceTypesDisplay } from './ResourceTypesDisplay';

export const HierarchyDetailsModal: React.FC<BaseModalProps> = ({
    selectedHierarchy,
    setSelectedHierarchy
}) => {
    if (!selectedHierarchy || !setSelectedHierarchy) return null;

    return (
        <AnimatePresence>
            {selectedHierarchy && (
                <Dialog open={!!selectedHierarchy} onOpenChange={() => setSelectedHierarchy(null)}>
                    <DialogContent className="max-w-md bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 max-h-[80vh] overflow-y-auto">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            <DialogHeader className="pb-3 border-b border-gray-200 dark:border-gray-800">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                        <LayoutGridIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <DialogTitle className="text-sm font-semibold text-gray-900 dark:text-white">
                                            Course Structure Details
                                        </DialogTitle>
                                    </div>
                                </div>
                            </DialogHeader>

                            {selectedHierarchy && (
                                <div className="space-y-4 py-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                                                <FolderIcon className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                Resource Types
                                            </h4>
                                        </div>
                                        <ResourceTypesDisplay resourcesType={selectedHierarchy.resourcesType} compact />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                                <LayersIcon className="w-4 h-4" />
                                            </div>
                                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                Course Levels
                                            </h4>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {Array.isArray(selectedHierarchy.courseHierarchy) ? (
                                                selectedHierarchy.courseHierarchy.length > 0 ? (
                                                    selectedHierarchy.courseHierarchy.map((hierarchy: string, index: number) => (
                                                        <span
                                                            key={index}
                                                            className="text-xs px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1"
                                                        >
                                                            <LayersIcon className="w-3 h-3" />
                                                            {hierarchy}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">No course levels specified</p>
                                                )
                                            ) : (
                                                <span className="text-xs px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                                                    <LayersIcon className="w-3 h-3" />
                                                    {selectedHierarchy.courseHierarchy}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </DialogContent>
                </Dialog>
            )}
        </AnimatePresence>
    );
};