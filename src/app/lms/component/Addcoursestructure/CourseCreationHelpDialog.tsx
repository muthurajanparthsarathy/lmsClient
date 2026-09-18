// AddCourseSettingsPopup/components/CourseCreationHelpDialog.tsx
import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CourseCreationHelpDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CourseCreationHelpDialog: React.FC<CourseCreationHelpDialogProps> = ({ isOpen, onOpenChange }) => {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[90vw] max-h-[95vh] overflow-y-auto bg-white dark:bg-gray-900 font-sans rounded-xl border border-gray-200 dark:border-gray-800">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-gray-900 dark:text-white font-sans">
                        Course Creation Guide
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-600 dark:text-gray-400 font-sans">
                        Follow these steps to create your course successfully
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-2 text-gray-700 dark:text-gray-300 font-sans">
                    <div className="grid grid-cols-2 gap-5">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h4 className="font-bold text-base mb-3 text-gray-800 dark:text-gray-200 flex items-center gap-2 font-sans">
                                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-sans">1</span>
                                Course Basic Configuration
                            </h4>
                            <ul className="list-disc pl-6 space-y-2 text-sm font-sans">
                                <li className="text-gray-700 dark:text-gray-300">Select the appropriate client for your course from the dropdown</li>
                                <li className="text-gray-700 dark:text-gray-300">Choose the course modal that matches your delivery method</li>
                                <li className="text-gray-700 dark:text-gray-300">Pick the domain that best fits your course content</li>
                                <li className="text-gray-700 dark:text-gray-300 font-semibold">All fields in this step are required to proceed</li>
                            </ul>
                        </div>

                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <h4 className="font-bold text-base mb-3 text-gray-800 dark:text-gray-200 flex items-center gap-2 font-sans">
                                <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-sans">2</span>
                                Course Details
                            </h4>
                            <ul className="list-disc pl-6 space-y-2 text-sm font-sans">
                                <li className="text-gray-700 dark:text-gray-300">Provide a unique course ID for reference</li>
                                <li className="text-gray-700 dark:text-gray-300">Enter a clear and descriptive course name</li>
                                <li className="text-gray-700 dark:text-gray-300">Select the appropriate difficulty level for your course</li>
                                <li className="text-gray-700 dark:text-gray-300">Specify the estimated duration of the course</li>
                                <li className="text-gray-700 dark:text-gray-300">Upload an attractive image that represents your course</li>
                                <li className="text-gray-700 dark:text-gray-300">Write a detailed description covering what students will learn (Optional)</li>
                            </ul>
                        </div>
                    </div>

                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 text-base text-blue-700 dark:text-blue-300 font-sans">
                        <div className="font-semibold mb-2 font-sans">ℹ️ Important Notes:</div>
                        <ul className="space-y-1 font-sans">
                            <li>• You can navigate between steps using the Previous and Next buttons</li>
                            <li>• All changes will be saved only when you click "Create Course"</li>
                            <li>• Use the rich text editor to format your course description with headings, lists, and links</li>
                        </ul>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};