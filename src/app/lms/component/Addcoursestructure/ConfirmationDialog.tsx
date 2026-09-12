// AddCourseSettingsPopup/components/ConfirmationDialog.tsx
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

interface ConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onLater: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ isOpen, onClose, onConfirm, onLater }) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 font-sans rounded-xl border border-gray-200 dark:border-gray-800" showCloseButton={false}>
                <DialogTitle className="sr-only">Confirmation</DialogTitle>
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white font-sans">
                        Add Course Structure?
                    </DialogTitle>
                    <DialogDescription className="text-sm text-slate-600 dark:text-gray-400 font-sans">
                        Would you like to add detailed Course Structure information now, or would you prefer to do it later?
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800 mb-4">
                    <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-700 dark:text-blue-300 font-sans">
                            Adding Course Structure details now will help you structure your teaching methods and learning activities more effectively.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button
                        variant="outline"
                        onClick={onLater}
                        className="h-9 px-4 text-sm border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-sans rounded-lg"
                    >
                        Later
                    </Button>
                    <Button
                        onClick={onConfirm}
                        className="h-9 px-4 text-sm bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-sans rounded-lg"
                    >
                        Yes, Add Now
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};