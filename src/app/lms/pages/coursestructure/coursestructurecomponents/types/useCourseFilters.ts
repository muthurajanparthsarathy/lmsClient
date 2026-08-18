import { useState } from "react";

export const useCourseFilters = () => {
    const [showFilters, setShowFilters] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [levelFilter, setLevelFilter] = useState<string>('all');
    const [sortField, setSortField] = useState<'date' | 'courseName' | 'clientName' | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const clearFilters = () => {
        setStatusFilter('all');
        setCategoryFilter('all');
        setLevelFilter('all');
    };

    return {
        showFilters,
        setShowFilters,
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
        clearFilters
    };
};