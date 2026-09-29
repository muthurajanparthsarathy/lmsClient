import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface CourseFiltersProps {
    showFilters: boolean;
    statusFilter: string;
    setStatusFilter: (value: string) => void;
    categoryFilter: string;
    setCategoryFilter: (value: string) => void;
    levelFilter: string;
    setLevelFilter: (value: string) => void;
    sortField: 'date' | 'courseName' | 'clientName' | null;
    setSortField: (field: 'date' | 'courseName' | 'clientName' | null) => void;
    sortDirection: 'asc' | 'desc';
    setSortDirection: (direction: 'asc' | 'desc') => void;
    categories: string[];
    levels: string[];
    clearFilters: () => void;
}

export const CourseFilters: React.FC<CourseFiltersProps> = ({
    showFilters,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    levelFilter,
    setLevelFilter,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    categories,
    levels,
    clearFilters
}) => {
    return (
        <AnimatePresence>
            {showFilters && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                >
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4 mt-4 border-t border-gray-200 dark:border-gray-800">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 font-sans">
                                Status
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full h-9 text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-sans bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            >
                                <option value="all">All Status</option>
                                <option value="Published">Published</option>
                                <option value="Draft">Draft</option>
                                <option value="Unpublished">Unpublished</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 font-sans">
                                Category
                            </label>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full h-9 text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-sans bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            >
                                <option value="all">All Categories</option>
                                {categories.map((category: string) => (
                                    <option key={category} value={category}>
                                        {category}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 font-sans">
                                Level
                            </label>
                            <select
                                value={levelFilter}
                                onChange={(e) => setLevelFilter(e.target.value)}
                                className="w-full h-9 text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-sans bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            >
                                <option value="all">All Levels</option>
                                {levels.map((level: string) => (
                                    <option key={level} value={level}>
                                        {level}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 font-sans">
                                Sort By
                            </label>
                            <div className="flex gap-2">
                                <select
                                    value={sortField || 'date'}
                                    onChange={(e) => setSortField(e.target.value as 'date' | 'courseName' | 'clientName' | null)}
                                    className="flex-1 h-9 text-sm border border-gray-300 dark:border-gray-700 rounded-lg px-3 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 font-sans bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                >
                                    <option value="date">Created On</option>
                                    <option value="courseName">Course</option>
                                    <option value="clientName">Client</option>
                                </select>
                                <button
                                    onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                                    className="h-9 px-3 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
                                >
                                    {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearFilters}
                                className="h-9 text-xs font-medium font-sans border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                            >
                                Clear All
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};