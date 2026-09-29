// components/modals/ResourceTypesDisplay.tsx
import { Bot, FolderIcon, Sparkles } from 'lucide-react';
import { extractResourceDetails } from './helpers';

interface ResourceTypesDisplayProps {
    resourcesType: any;
    compact?: boolean;
}

export const ResourceTypesDisplay: React.FC<ResourceTypesDisplayProps> = ({ resourcesType, compact = false }) => {
    const resourceDetails = extractResourceDetails(resourcesType);
    
    if (resourceDetails.length === 0) {
        return (
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                No resource types enabled
            </p>
        );
    }

    const groupedBySection: Record<string, typeof resourceDetails> = {};
    resourceDetails.forEach((detail) => {
        if (!groupedBySection[detail.section]) {
            groupedBySection[detail.section] = [];
        }
        groupedBySection[detail.section].push(detail);
    });

    return (
        <div className={compact ? "space-y-2" : "space-y-3"}>
            {Object.entries(groupedBySection).map(([section, details]) => {
                const firstDetail = details[0];
                return (
                    <div key={section} className={`${compact ? 'p-2.5' : 'p-3'} rounded-lg border ${firstDetail.sectionColor}`}>
                        <h5 className={`${compact ? 'text-xs' : 'text-xs'} font-semibold mb-2 text-gray-700 dark:text-gray-300`}>
                            {section} Section
                        </h5>
                        <div className="flex flex-wrap gap-1.5">
                            {details.map((detail, idx) => {
                                const IconComponent = detail.typeIcon;
                                return (
                                    <div 
                                        key={idx}
                                        className={`flex items-center gap-1 ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${!compact && 'shadow-sm'}`}
                                    >
                                        <IconComponent className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-gray-600 dark:text-gray-400`} />
                                        <span className={`${compact ? 'text-xs' : 'text-xs'} font-medium text-gray-700 dark:text-gray-300`}>
                                            {detail.type}
                                        </span>
                                        {detail.config.maxSize && (
                                            <span className="text-[10px] text-gray-500 dark:text-gray-500">
                                                ({detail.config.maxSize}MB)
                                            </span>
                                        )}
                                        {(detail.config.aiChat || detail.config.aiSummary) && (
                                            <div className="flex items-center gap-0.5 ml-0.5">
                                                {detail.config.aiChat && (
                                                    <Bot className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                                                )}
                                                {detail.config.aiSummary && (
                                                    <Sparkles className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};