// AddCourseSettingsPopup/components/ValidationMessage.tsx
import React from 'react';
import { Info } from 'lucide-react';

interface ValidationMessageProps {
    message: string;
}

export const ValidationMessage: React.FC<ValidationMessageProps> = ({ message }) => (
    <div className="flex items-center gap-1 mt-1 text-red-600 dark:text-red-400 text-xs font-medium font-sans">
        <Info className="h-3 w-3" />
        <span>{message}</span>
    </div>
);