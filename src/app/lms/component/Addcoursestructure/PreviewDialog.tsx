// AddCourseSettingsPopup/components/PreviewDialog.tsx
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Eye, X, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { FormData } from './types';

interface PreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    formData: FormData;
}

const previewVariants = {
    hidden: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
} as const;

export const PreviewDialog: React.FC<PreviewDialogProps> = ({ isOpen, onClose, onSubmit, formData }) => {
    const tleColspan = Math.max(3,
        (formData.iDo?.length > 0 ? formData.iDo.length : 1) +
        (formData.weDo?.length > 0 ? formData.weDo.length : 1) +
        (formData.youDo?.length > 0 ? formData.youDo.length : 1)
    );

    return (
        <Dialog open={isOpen} onOpenChange={() => {}}>
            <DialogContent className="w-full max-w-[95vw] rounded-xl bg-white dark:bg-gray-900 p-4 sm:p-6 font-sans border border-gray-200 dark:border-gray-800" showCloseButton={false}>
                <DialogTitle className="sr-only">Course Layout Preview</DialogTitle>
                <motion.div
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={previewVariants}
                    className="space-y-4 font-sans"
                >
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 font-sans">
                            <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            Course Layout Preview
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 font-sans">
                        <div>
                            <div className="relative">
                                <div className="overflow-auto max-h-[60vh] w-[90vw] border border-gray-400 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900">
                                    <table className="w-full border-collapse font-sans">
                                        <thead className="bg-white dark:bg-gray-800 sticky top-0 border-b-2 border-gray-400 dark:border-gray-600">
                                            <tr>
                                                {formData.checkboxOptions?.module && (
                                                    <th rowSpan={3} className="border border-gray-400 dark:border-gray-600 p-2 text-center text-sm font-semibold text-slate-900 dark:text-white font-sans">Module</th>
                                                )}
                                                {formData.checkboxOptions?.submodule && (
                                                    <th rowSpan={3} className="border border-gray-400 dark:border-gray-600 p-2 text-center text-sm font-semibold text-slate-900 dark:text-white font-sans">Submodule</th>
                                                )}
                                                {formData.checkboxOptions?.topic && (
                                                    <th rowSpan={3} className="border border-gray-400 dark:border-gray-600 p-2 text-center text-sm font-semibold text-slate-900 dark:text-white font-sans">Topic</th>
                                                )}
                                                {formData.checkboxOptions?.subtopic && (
                                                    <th rowSpan={3} className="border border-gray-400 dark:border-gray-600 p-2 text-center text-sm font-semibold text-slate-900 dark:text-white font-sans">Subtopic</th>
                                                )}
                                                <th rowSpan={3} className="border border-gray-400 dark:border-gray-600 p-2 text-center text-sm font-semibold text-slate-900 dark:text-white font-sans">Learning Level</th>
                                                <th className="border border-gray-400 dark:border-gray-600 p-2 text-center text-sm font-semibold text-slate-900 dark:text-white font-sans" colSpan={tleColspan}>
                                                    Teaching Learning Elements
                                                </th>
                                            </tr>
                                            <tr>
                                                {formData?.iDo?.length > 0 ? (
                                                    <th className="border border-gray-400 dark:border-gray-600 p-2 text-sm font-semibold text-slate-900 dark:text-white text-center font-sans" colSpan={formData.iDo.length}>I Do</th>
                                                ) : (<th className="border border-gray-400 dark:border-gray-600 p-2 text-sm font-semibold text-slate-900 dark:text-white text-center font-sans">I Do</th>)}
                                                {formData?.weDo?.length > 0 ? (
                                                    <th className="border border-gray-400 dark:border-gray-600 p-2 text-sm font-semibold text-slate-900 dark:text-white text-center font-sans" colSpan={formData.weDo.length}>We Do</th>
                                                ) : (<th className="border border-gray-400 dark:border-gray-600 p-2 text-sm font-semibold text-slate-900 dark:text-white text-center font-sans">We Do</th>)}
                                                {formData?.youDo?.length > 0 ? (
                                                    <th className="border border-gray-400 dark:border-gray-600 p-2 text-sm font-semibold text-slate-900 dark:text-white text-center font-sans" colSpan={formData.youDo.length}>You Do</th>
                                                ) : (<th className="border border-gray-400 dark:border-gray-600 p-2 text-sm font-semibold text-slate-900 dark:text-white text-center font-sans">You Do</th>)}
                                            </tr>
                                            <tr>
                                                {formData?.iDo?.length > 0 ? (
                                                    formData.iDo.map((method, index) => (
                                                        <th key={index} className="border border-gray-400 dark:border-gray-600 p-2 text-xs font-semibold text-slate-600 dark:text-gray-400 font-sans">{method}</th>
                                                    ))
                                                ) : (<th className="border border-gray-400 dark:border-gray-600 p-2 text-xs font-semibold text-slate-600 dark:text-gray-400 font-sans"></th>)}
                                                {formData?.weDo?.length > 0 ? (
                                                    formData.weDo.map((method, index) => (
                                                        <th key={index} className="border border-gray-400 dark:border-gray-600 p-2 text-xs font-semibold text-slate-600 dark:text-gray-400 font-sans">{method}</th>
                                                    ))
                                                ) : (<th className="border border-gray-400 dark:border-gray-600 p-2 text-xs font-semibold text-slate-600 dark:text-gray-400 font-sans"></th>)}
                                                {formData?.youDo?.length > 0 ? (
                                                    formData.youDo.map((method, index) => (
                                                        <th key={index} className="border border-gray-400 dark:border-gray-600 p-2 text-xs font-semibold text-slate-600 dark:text-gray-400 font-sans">{method}</th>
                                                    ))
                                                ) : (<th className="border border-gray-400 dark:border-gray-600 p-2 text-xs font-semibold text-slate-600 dark:text-gray-400 font-sans"></th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="font-sans"></tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-200 dark:border-gray-700">
                            <Button onClick={onClose} className="h-8 px-4 text-xs gap-1 bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white transition-all duration-200 hover:scale-105 font-sans rounded-lg">
                                <X className="h-3 w-3" /> Close Preview
                            </Button>
                            <Button onClick={onSubmit} className="h-8 px-4 text-xs gap-1 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white transition-all duration-200 hover:scale-105 font-sans rounded-lg">
                                <Check className="h-3 w-3" /> Save Course Layout
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </DialogContent>
        </Dialog>
    );
};