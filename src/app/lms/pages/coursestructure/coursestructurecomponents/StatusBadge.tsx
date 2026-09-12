import { Badge } from "@/components/ui/badge";
import { CheckCircle, FileText, XCircle } from "lucide-react";

interface StatusBadgeProps {
    status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const statusConfig = {
        Published: { 
            color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', 
            icon: CheckCircle 
        },
        Draft: { 
            color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800', 
            icon: FileText 
        },
        Unpublished: { 
            color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700', 
            icon: XCircle 
        }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.Draft;
    const IconComponent = config.icon;

    return (
        <Badge variant="outline" className={`${config.color} border px-2 py-0.5 rounded-full text-xs font-medium`}>
            <IconComponent className="h-3 w-3 mr-1" />
            {status}
        </Badge>
    );
};