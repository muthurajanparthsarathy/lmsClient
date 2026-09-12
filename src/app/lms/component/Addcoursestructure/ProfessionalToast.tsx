// AddCourseSettingsPopup/components/ProfessionalToast.tsx
import React, { useState, useEffect } from 'react';
import { Check, X, Info } from 'lucide-react';
import { toast } from 'react-toastify';

interface ProfessionalToastProps {
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    closeToast?: () => void;
}

export const ProfessionalToast: React.FC<ProfessionalToastProps> = ({ message, type, closeToast }) => {
    const [progress, setProgress] = useState(100);
    
    useEffect(() => {
        const timer = setInterval(() => {
            setProgress(prev => Math.max(0, prev - 1));
        }, 30);
        
        return () => clearInterval(timer);
    }, []);

    const getToastConfig = () => {
        switch (type) {
            case 'success':
                return {
                    icon: <Check className="h-5 w-5 text-white" />,
                    bgColor: 'bg-gradient-to-r from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700',
                    borderColor: 'border-l-4 border-emerald-400 dark:border-emerald-500',
                    iconBg: 'bg-emerald-500 dark:bg-emerald-600'
                };
            case 'error':
                return {
                    icon: <X className="h-5 w-5 text-white" />,
                    bgColor: 'bg-gradient-to-r from-red-500 to-rose-600 dark:from-red-600 dark:to-rose-700',
                    borderColor: 'border-l-4 border-rose-400 dark:border-rose-500',
                    iconBg: 'bg-rose-500 dark:bg-rose-600'
                };
            case 'warning':
                return {
                    icon: <Info className="h-5 w-5 text-white" />,
                    bgColor: 'bg-gradient-to-r from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700',
                    borderColor: 'border-l-4 border-amber-400 dark:border-amber-500',
                    iconBg: 'bg-amber-500 dark:bg-amber-600'
                };
            case 'info':
            default:
                return {
                    icon: <Info className="h-5 w-5 text-white" />,
                    bgColor: 'bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700',
                    borderColor: 'border-l-4 border-indigo-400 dark:border-indigo-500',
                    iconBg: 'bg-indigo-500 dark:bg-indigo-600'
                };
        }
    };

    const config = getToastConfig();

    return (
        <div className={`relative flex items-center w-full max-w-md p-4 rounded-lg shadow-xl ${config.bgColor} ${config.borderColor} text-white font-sans transform transition-all duration-300 hover:scale-105 overflow-hidden`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-full ${config.iconBg} flex items-center justify-center mr-3 shadow-md`}>
                {config.icon}
            </div>
            <div className="flex-1">
                <div className="text-sm font-semibold leading-tight">
                    {message}
                </div>
            </div>
            <button
                onClick={closeToast}
                className="flex-shrink-0 ml-4 text-white hover:text-gray-200 dark:hover:text-gray-300 transition-colors duration-200"
            >
                <X className="h-4 w-4" />
            </button>
            
            <div 
                className="absolute bottom-0 left-0 h-1 bg-white/40 transition-all duration-100"
                style={{ width: `${progress}%` }}
            />
        </div>
    );
};

// Toast configuration
const toastConfig = {
    position: "top-right" as const,
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    className: '!p-0 !m-0 !bg-transparent !shadow-none !border-0',
    progressClassName: '!bg-white/30 !h-1',
};

// Exported showToast functions
export const showToast = {
    success: (message: string) => {
        toast(({ closeToast }) => (
            <ProfessionalToast message={message} type="success" closeToast={closeToast} />
        ), toastConfig);
    },
    error: (message: string) => {
        toast(({ closeToast }) => (
            <ProfessionalToast message={message} type="error" closeToast={closeToast} />
        ), toastConfig);
    },
    info: (message: string) => {
        toast(({ closeToast }) => (
            <ProfessionalToast message={message} type="info" closeToast={closeToast} />
        ), toastConfig);
    },
    warning: (message: string) => {
        toast(({ closeToast }) => (
            <ProfessionalToast message={message} type="warning" closeToast={closeToast} />
        ), toastConfig);
    }
};