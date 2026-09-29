// components/modals/DeleteConfirmationModal.tsx
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
import { Loader2, Trash2 } from 'lucide-react';
import { BaseModalProps, popupVariants } from './types';

export const DeleteConfirmationModal: React.FC<BaseModalProps> = ({
    showDeleteModal,
    setShowDeleteModal,
    courseToDelete,
    isDeleting = false,
    confirmDelete
}) => {
    if (!showDeleteModal || !setShowDeleteModal || !confirmDelete) return null;

    return (
        <AnimatePresence>
            {showDeleteModal && (
                <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                    <DialogContent className="max-w-md bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            variants={popupVariants}
                        >
                            <DialogHeader className="text-center">
                                <div className="mx-auto w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-3">
                                    <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                                </div>
                                <DialogTitle className="text-base font-semibold text-gray-900 dark:text-white font-sans">
                                    Delete Course Structure
                                </DialogTitle>
                                <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 font-sans mt-1">
                                    This action cannot be undone. The course structure will be permanently removed.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <p className="text-sm font-semibold text-red-800 dark:text-red-300 font-sans truncate">
                                    {courseToDelete?.courseName}
                                </p>
                                <p className="text-xs text-red-600 dark:text-red-400 font-sans mt-0.5">
                                    Code: {courseToDelete?.courseCode}
                                </p>
                            </div>

                            <DialogFooter className="mt-4 gap-2 flex-col sm:flex-row">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 text-sm h-9 font-medium font-sans w-full sm:w-auto border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={confirmDelete}
                                    className="flex-1 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-sm h-9 font-medium font-sans w-full sm:w-auto"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <>
                                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                            Deleting...
                                        </>
                                    ) : (
                                        "Delete Course"
                                    )}
                                </Button>
                            </DialogFooter>
                        </motion.div>
                    </DialogContent>
                </Dialog>
            )}
        </AnimatePresence>
    );
};