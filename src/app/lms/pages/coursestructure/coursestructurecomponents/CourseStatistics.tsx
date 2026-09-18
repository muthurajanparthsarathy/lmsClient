import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Statistics } from './types/index';

interface CourseStatisticsProps {
    statistics: Statistics;
    isLoading: boolean;
}

export const CourseStatistics: React.FC<CourseStatisticsProps> = ({ statistics, isLoading }) => {
    const stats = [
        { 
            title: "Total", 
            value: statistics.total, 
            color: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800"
        },
        { 
            title: "Recent", 
            value: statistics.recent, 
            color: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800"
        },
        { 
            title: "Active", 
            value: statistics.active, 
            color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
        }
    ];

    return (
        <div className="flex items-center gap-2">
            {stats.map((stat, index) => (
                <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.05 }}
                    className={`inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md border ${stat.color} text-xs font-medium font-sans shadow-sm`}
                >
                    {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin dark:text-gray-400" />
                    ) : (
                        <span className="font-bold text-xs">{stat.value}</span>
                    )}
                    <span className="text-xs">{stat.title}</span>
                </motion.div>
            ))}
        </div>
    );
};