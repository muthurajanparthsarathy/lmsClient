// components/modals/helpers.tsx
import { Video, FileText as PPTIcon, File, Link, Bot, Sparkles, PenTool, FolderIcon } from 'lucide-react';

export const typeIcons: Record<string, any> = {
    video: Video,
    ppt: PPTIcon,
    pdf: File,
    url: Link,
    aiChat: Bot,
    aiSummary: Sparkles,
    notes: PenTool
};

export const sectionConfig = {
    iDo: { label: 'I Do', color: 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20' },
    weDo: { label: 'We Do', color: 'border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-900/20' },
    youDo: { label: 'You Do', color: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20' }
};

export const extractResourceDetails = (resourcesType: any) => {
    const details: Array<{
        section: string;
        type: string;
        config: any;
        sectionColor: string;
        typeIcon: any;
    }> = [];

    if (!resourcesType || typeof resourcesType !== 'object') {
        return details;
    }

    ['iDo', 'weDo', 'youDo'].forEach((section) => {
        const sectionData = resourcesType[section];
        if (sectionData) {
            Object.keys(sectionData).forEach((type) => {
                const config = sectionData[type];
                if (config?.enabled === true) {
                    details.push({
                        section: sectionConfig[section as keyof typeof sectionConfig].label,
                        type: type.toUpperCase(),
                        config: config,
                        sectionColor: sectionConfig[section as keyof typeof sectionConfig].color,
                        typeIcon: typeIcons[type] || FolderIcon
                    });
                }
            });
        }
    });

    return details;
};