"use client"
import { getToken } from "@/lib/session";

import type React from "react"
import { useState, useRef, useEffect, useMemo } from "react"
import {
    ChevronRight,
    Plus,
    Trash2,
    Edit3,
    Search,
    Home,
    BookOpen,
    Brain,
    Target,
    CheckCircle2,
    ArrowLeft,
    Save,
    Eye,
    FileText,
    User,
    UserCheck,
    UsersIcon,
    Clock,
    Award,
    Settings,
    GraduationCap,
    ChevronDown,
    X,
    Grid3X3,
    List,
    Filter,
    Calendar,
    Users,
    Star,
    BookMarked,
    TrendingUp
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { courseStructureApi } from "@/apiServices/createCourseStucture";
import { useRouter } from "next/navigation";
import { courseDynamicsApi, CourseStructureResponse } from "@/apiServices/dynamicFields/courseDynamics";
import DashboardLayout from "@/app/lms/component/layout";

interface Course {
    category: string;
    courseCode: string;
    clientName: string | undefined;
    serviceType: string | undefined;
    serviceModal: string | undefined;
    courseLevel: string;
    _id: string
    courseName: string
    courseHierarchy: string[]
    I_Do: string[]
    We_Do: string[]
    You_Do: string[]
}

const FullPageLoader = () => (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="text-center">
            <motion.div
                className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto mb-2"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
            <p className="text-slate-600 text-xs font-medium">Loading course...</p>
        </div>
    </div>
);

export default function PedagogyManagement() {

    const { data: courseDynamic, isLoading, error, refetch } = useQuery<CourseStructureResponse>(courseDynamicsApi.getAll());
    const {
        data: courses = [],
        isLoading: isCoursesLoading,
        error: coursesError
    } = useQuery(courseStructureApi.getAll());
    const queryClient = useQueryClient();
    const router = useRouter();
    // State variables
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [selectedServiceType, setSelectedServiceType] = useState<string>("all");
    const [selectedServiceModal, setSelectedServiceModal] = useState<string>("all");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("")
    const [isFilterReset, setIsFilterReset] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [isFiltersVisible, setIsFiltersVisible] = useState(true)
    const [isNavigating, setIsNavigating] = useState(false)

    useEffect(() => {
        const storedToken = getToken()
        setToken(storedToken)
    }, [])

    const filterOptions = useMemo(() => {
        if (!courseDynamic?.data) {
            return {
                clients: [],
                serviceTypes: [],
                serviceModals: [],
                categories: []
            };
        }

        const clients = Array.from(new Set(courseDynamic.data.clients.map(client => client.clientCompany))).filter(Boolean);
        const serviceTypes = Array.from(new Set(courseDynamic.data.services.map(service => service.title))).filter(Boolean);

        const serviceModals = Array.from(new Set(
            courseDynamic.data.services.flatMap(service =>
                service.serviceModal?.map((modal: { title: any }) => modal.title) || []
            )
        )).filter(Boolean);

        const categories = Array.from(new Set(courseDynamic.data.categories.map(category => category.categoryName))).filter(Boolean);

        return {
            clients: ["all", ...clients],
            serviceTypes: ["all", ...serviceTypes],
            serviceModals: ["all", ...serviceModals],
            categories: ["all", ...categories]
        };
    }, [courseDynamic]);

    const filteredCourses = useMemo(() => {
        if (!courses) return [];

        let filtered = courses;

        if (selectedClient !== "all") {
            filtered = filtered.filter((course: any) => course.clientName === selectedClient);
        }

        if (selectedServiceType !== "all") {
            filtered = filtered.filter((course: any) => course.serviceType === selectedServiceType);
        }

        if (selectedServiceModal !== "all") {
            filtered = filtered.filter((course: any) => course.serviceModal === selectedServiceModal);
        }

        if (selectedCategory !== "all") {
            filtered = filtered.filter((course: any) => course.category === selectedCategory);
        }

        if (searchTerm) {
            filtered = filtered.filter((course: any) =>
                course.courseName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        return filtered;
    }, [courses, selectedClient, selectedServiceType, selectedServiceModal, selectedCategory, searchTerm]);

    const handleResetFilters = () => {
        setSelectedClient("all");
        setSelectedServiceType("all");
        setSelectedServiceModal("all");
        setSelectedCategory("all");
        setIsFilterReset(true);
        setSearchTerm("");
        setTimeout(() => setIsFilterReset(false), 100);
    };

    const handleCourseSelect = (course: Course) => {
        setSelectedCourse(course);
        const courseIdToPass = course._id;
        setIsNavigating(true);
        // Pass course data via query string
        const query = new URLSearchParams({
            courseId: courseIdToPass ?? '',
        }).toString();

        router.push(`/lms/pages/pedagogy2?${query}`);
    }

    const getCourseIcon = (category: string) => {
        switch (category.toLowerCase()) {
            case 'technical': return <Brain className="w-3 h-3" />;
            case 'business': return <TrendingUp className="w-3 h-3" />;
            case 'leadership': return <Users className="w-3 h-3" />;
            default: return <BookOpen className="w-3 h-3" />;
        }
    };

    const getCategoryColor = (category: string) => {
        switch (category.toLowerCase()) {
            case 'technical': return 'bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 border-purple-200';
            case 'business': return 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-700 border-emerald-200';
            case 'leadership': return 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border-orange-200';
            default: return 'bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 border-blue-200';
        }
    };

    const CourseCard = ({ course, isSelected }: { course: Course, isSelected: boolean }) => (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            whileHover={{
                y: -2,
                scale: 1.01,
                transition: { type: "spring", stiffness: 400, damping: 25 }
            }}
            whileTap={{
                scale: 0.98,
                transition: { type: "spring", stiffness: 400, damping: 25 }
            }}
            onClick={() => handleCourseSelect(course)}
            className={`
                relative cursor-pointer rounded-lg border transition-all duration-200 overflow-hidden group backdrop-blur-sm
                ${isSelected
                    ? 'border-violet-400 bg-gradient-to-br from-violet-50 via-indigo-50 to-purple-50 shadow-md shadow-violet-200/50'
                    : 'border-slate-200 bg-white/80 hover:border-violet-300 hover:shadow-md hover:shadow-slate-200/50'
                }
            `}
        >
            {/* Animated Background Gradient */}
            <div className={`
                absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300
                bg-gradient-to-br from-violet-50/50 via-indigo-50/50 to-purple-50/50
            `} />

            {/* Selected Indicator */}
            {isSelected && (
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    className="absolute top-2 right-2 z-10"
                >
                    <div className="bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full p-0.5 shadow-md">
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                    </div>
                </motion.div>
            )}

            {/* Course Header */}
            <div className="p-3 relative z-10">
                <div className="flex items-start gap-2">
                    <motion.div
                        className={`
                            p-2 rounded-lg transition-all duration-200 flex-shrink-0 shadow-sm
                            ${isSelected
                                ? 'bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-600 shadow-violet-200/50'
                                : 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-600 group-hover:from-violet-100 group-hover:to-indigo-100 group-hover:text-violet-600'
                            }
                        `}
                        whileHover={{ rotate: [0, -8, 8, 0], transition: { duration: 0.4 } }}
                    >
                        {getCourseIcon(course.category)}
                    </motion.div>

                    <div className="flex-1 min-w-0">
                        <h3 className={`
                            font-semibold text-xs mb-1 line-clamp-2 transition-colors leading-tight
                            ${isSelected ? 'text-slate-900' : 'text-slate-800 group-hover:text-slate-900'}
                        `}>
                            {course.courseName}
                        </h3>

                        <div className="space-y-1">
                            <div className="flex items-center gap-1 text-xs">
                                <motion.span
                                    className="bg-gradient-to-r from-slate-100 to-gray-100 px-1.5 py-0.5 rounded-md text-xs font-medium text-slate-700 shadow-sm"
                                    whileHover={{ scale: 1.03 }}
                                >
                                    {course.courseCode}
                                </motion.span>
                                <motion.span
                                    className={`px-1.5 py-0.5 rounded-md text-xs font-medium shadow-sm border ${getCategoryColor(course.category)}`}
                                    whileHover={{ scale: 1.03 }}
                                >
                                    {course.category}
                                </motion.span>
                            </div>

                            {course.clientName && (
                                <motion.div
                                    className="flex items-center gap-1 text-xs text-slate-600"
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 }}
                                >
                                    <div className="p-0.5 rounded-sm bg-slate-100">
                                        <User className="w-2.5 h-2.5" />
                                    </div>
                                    <span className="truncate font-medium">{course.clientName}</span>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Course Details */}
                <motion.div
                    className="mt-2 pt-2 border-t border-slate-200/60"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="grid grid-cols-2 gap-1 text-xs">
                        {course.serviceType && (
                            <div className="flex items-center gap-1 text-slate-600">
                                <div className="p-0.5 rounded-sm bg-emerald-100 text-emerald-600">
                                    <Target className="w-2.5 h-2.5 flex-shrink-0" />
                                </div>
                                <span className="truncate font-medium">{course.serviceType}</span>
                            </div>
                        )}

                        {course.courseLevel && (
                            <div className="flex items-center gap-1 text-slate-600">
                                <div className="p-0.5 rounded-sm bg-amber-100 text-amber-600">
                                    <Award className="w-2.5 h-2.5 flex-shrink-0" />
                                </div>
                                <span className="truncate font-medium">{course.courseLevel}</span>
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Action Button */}
                <motion.div
                    className="mt-2"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <button className={`
                        w-full px-2 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1 shadow-sm
                        ${isSelected
                            ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 shadow-violet-200/50'
                            : 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-700 hover:from-violet-500 hover:to-indigo-500 hover:text-white'
                        }
                    `}>
                        {isSelected ? 'Selected' : 'Select Course'}
                        <motion.div
                            animate={{ x: isSelected ? 0 : [0, 1, 0] }}
                            transition={{ repeat: isSelected ? 0 : Infinity, duration: 1.2 }}
                        >
                            <ChevronRight className="w-2.5 h-2.5" />
                        </motion.div>
                    </button>
                </motion.div>
            </div>
        </motion.div>
    );

    const CourseListItem = ({ course, isSelected }: { course: Course, isSelected: boolean }) => (
        <motion.div
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            whileHover={{
                scale: 1.005,
                x: 2,
                transition: { type: "spring", stiffness: 400, damping: 25 }
            }}
            whileTap={{ scale: 0.99 }}
            onClick={() => handleCourseSelect(course)}
            className={`
                cursor-pointer p-3 rounded-lg border transition-all duration-200 group backdrop-blur-sm
                ${isSelected
                    ? 'border-violet-400 bg-gradient-to-r from-violet-50 to-indigo-50 shadow-md shadow-violet-200/50'
                    : 'border-slate-200 bg-white/80 hover:border-violet-300 hover:bg-gradient-to-r hover:from-violet-50/50 hover:to-indigo-50/50 hover:shadow-md hover:shadow-slate-200/50'
                }
            `}
        >
            <div className="flex items-center gap-3">
                <motion.div
                    className={`
                        p-2 rounded-lg transition-all duration-200 flex-shrink-0 shadow-sm
                        ${isSelected
                            ? 'bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-600'
                            : 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-600 group-hover:from-violet-100 group-hover:to-indigo-100 group-hover:text-violet-600'
                        }
                    `}
                    whileHover={{ rotate: [0, -4, 4, 0], transition: { duration: 0.4 } }}
                >
                    {getCourseIcon(course.category)}
                </motion.div>

                <div className="flex-1 min-w-0">
                    <h3 className={`
                        font-semibold text-xs mb-0.5 transition-colors
                        ${isSelected ? 'text-slate-900' : 'text-slate-800 group-hover:text-slate-900'}
                    `}>
                        {course.courseName}
                    </h3>

                    <div className="flex items-center gap-2 text-xs">
                        <span className="bg-gradient-to-r from-slate-100 to-gray-100 px-1.5 py-0.5 rounded-md font-medium text-slate-700 shadow-sm">
                            {course.courseCode}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-md font-medium shadow-sm border ${getCategoryColor(course.category)}`}>
                            {course.category}
                        </span>
                        {course.clientName && (
                            <span className="flex items-center gap-1 text-slate-600 font-medium">
                                <div className="p-0.5 rounded bg-slate-100">
                                    <User className="w-2.5 h-2.5" />
                                </div>
                                {course.clientName}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isSelected && (
                        <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 500 }}
                        >
                            <CheckCircle2 className="w-3 h-3 text-violet-500" />
                        </motion.div>
                    )}
                    <motion.button
                        onClick={() => handleCourseSelect(course)}
                        className={`
                        px-2 py-1 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1 shadow-sm
                        ${isSelected
                                ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:from-violet-600 hover:to-indigo-600 shadow-violet-200/50'
                                : 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-700 hover:from-violet-500 hover:to-indigo-500 hover:text-white'
                            }
                    `}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {isSelected ? 'Selected' : 'Select Course'}
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );

    return (
        <DashboardLayout>
            <div className="h-full w-full  p-2">
                <AnimatePresence>
                    {isNavigating && <FullPageLoader />}
                </AnimatePresence>
                <div className="space-y-3">

                    {/* Header */}
                    <motion.div
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                    >
                        <div>
                            <Breadcrumb>
                                <BreadcrumbList className="text-xs">
                                    <BreadcrumbItem>
                                        <BreadcrumbLink
                                            href="/lms/pages/dashboardlms"
                                            className="text-slate-500 hover:text-violet-600 transition-colors duration-200"
                                        >
                                            Dashboard
                                        </BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator className="text-slate-400" />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage className="text-slate-700 font-medium">Pedagogy</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </Breadcrumb>

                            <motion.div
                                className="mt-1"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.1, duration: 0.4 }}
                            >
                                <h1 className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                                    Course Selection
                                </h1>
                                <p className="text-slate-600 text-xs">Choose a course to manage its pedagogy</p>
                            </motion.div>
                        </div>

                        {/* View Toggle */}
                        <motion.div
                            className="flex items-center gap-1 bg-white/70 backdrop-blur-sm rounded-lg p-0.5 shadow-md border border-white/20"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2, duration: 0.3 }}
                        >
                            <motion.button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === 'grid'
                                    ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Grid3X3 className="w-3 h-3" />
                            </motion.button>
                            <motion.button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all duration-200 ${viewMode === 'list'
                                    ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <List className="w-3 h-3" />
                            </motion.button>
                        </motion.div>
                    </motion.div>

                    {/* Search and Filters */}
                    <motion.div
                        className="bg-white/70 backdrop-blur-sm rounded-lg shadow-md border border-white/20 p-3"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                    >
                        {/* Search Bar */}
                        <div className="relative mb-3">
                            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
                            <motion.input
                                type="text"
                                placeholder="Search courses..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300/50 rounded-lg focus:ring-1 focus:ring-violet-500 focus:border-violet-500 transition-all duration-200 bg-white/50 backdrop-blur-sm"
                                whileFocus={{ scale: 1.005 }}
                            />
                        </div>

                        {/* Filter Toggle */}
                        <div className="flex items-center justify-between mb-2">
                            <motion.button
                                onClick={() => setIsFiltersVisible(!isFiltersVisible)}
                                className="flex items-center gap-1 text-slate-600 hover:text-slate-800 transition-colors text-xs font-medium"
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <Filter className="w-3 h-3" />
                                <span>
                                    {isFiltersVisible ? 'Hide Filters' : 'Show Filters'}
                                </span>
                                <motion.div
                                    animate={{ rotate: isFiltersVisible ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ChevronDown className="w-3 h-3" />
                                </motion.div>
                            </motion.button>

                            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-300 px-3 py-1 rounded-full shadow-sm hover:shadow-md transition">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                <span>
                                    {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                        </div>

                        {/* Filters */}
                        <AnimatePresence>
                            {isFiltersVisible && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3, ease: "easeInOut" }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 p-3 bg-gradient-to-r from-slate-50 to-gray-50 rounded-lg border border-slate-200/50">
                                        {/* Client Filter */}
                                        <div className="space-y-1">
                                            <label className="block text-xs font-medium text-slate-700">Client</label>
                                            <select
                                                value={selectedClient}
                                                onChange={(e) => setSelectedClient(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs border border-slate-300/50 rounded-md focus:ring-1 focus:ring-violet-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                                            >
                                                {filterOptions.clients.map(client => (
                                                    <option key={client} value={client}>
                                                        {client === "all" ? "All Clients" : client}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Service Type Filter */}
                                        <div className="space-y-1">
                                            <label className="block text-xs font-medium text-slate-700">Service Type</label>
                                            <select
                                                value={selectedServiceType}
                                                onChange={(e) => setSelectedServiceType(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs border border-slate-300/50 rounded-md focus:ring-1 focus:ring-violet-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                                            >
                                                {filterOptions.serviceTypes.map(serviceType => (
                                                    <option key={serviceType} value={serviceType}>
                                                        {serviceType === "all" ? "All Service Types" : serviceType}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Service Modal Filter */}
                                        <div className="space-y-1">
                                            <label className="block text-xs font-medium text-slate-700">Service Modal</label>
                                            <select
                                                value={selectedServiceModal}
                                                onChange={(e) => setSelectedServiceModal(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs border border-slate-300/50 rounded-md focus:ring-1 focus:ring-violet-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                                            >
                                                {filterOptions.serviceModals.map(modal => (
                                                    <option key={modal} value={modal}>
                                                        {modal === "all" ? "All Service Modals" : modal}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Category Filter */}
                                        <div className="space-y-1">
                                            <label className="block text-xs font-medium text-slate-700">Category</label>
                                            <select
                                                value={selectedCategory}
                                                onChange={(e) => setSelectedCategory(e.target.value)}
                                                className="w-full px-2 py-1.5 text-xs border border-slate-300/50 rounded-md focus:ring-1 focus:ring-violet-500 transition-all duration-200 bg-white/80 backdrop-blur-sm"
                                            >
                                                {filterOptions.categories.map(category => (
                                                    <option key={category} value={category}>
                                                        {category === "all" ? "All Categories" : category}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="flex justify-end mt-2">
                                        <motion.button
                                            onClick={handleResetFilters}
                                            className="px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors duration-200"
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            Reset Filters
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Course Grid/List */}
                    <motion.div
                        className="bg-white/70 backdrop-blur-sm rounded-lg shadow-md border border-white/20 overflow-hidden"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                    >
                        {isCoursesLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="text-center">
                                    <motion.div
                                        className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500 mx-auto mb-2"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    />
                                    <p className="text-slate-600 text-xs font-medium">Loading courses...</p>
                                </div>
                            </div>
                        ) : coursesError ? (
                            <div className="flex items-center justify-center py-8">
                                <motion.div
                                    className="text-center"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    <div className="text-red-500 text-2xl mb-2">❌</div>
                                    <p className="text-red-600 text-xs font-medium">Error loading courses</p>
                                </motion.div>
                            </div>
                        ) : filteredCourses.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <motion.div
                                    className="text-center"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    <motion.div
                                        animate={{ y: [0, -5, 0] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    >
                                        <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                    </motion.div>
                                    <p className="text-slate-600 text-xs font-medium">No courses found</p>
                                    <p className="text-slate-500 text-xs mt-0.5">Try adjusting your filters</p>
                                </motion.div>
                            </div>
                        ) : (
                            <div className="p-3 max-h-[60vh] overflow-auto">
                                {viewMode === 'grid' ? (
                                    <motion.div
                                        layout
                                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3"
                                        initial="hidden"
                                        animate="visible"
                                        variants={{
                                            visible: {
                                                transition: {
                                                    staggerChildren: 0.03
                                                }
                                            }
                                        }}
                                    >
                                        <AnimatePresence mode="popLayout">
                                            {filteredCourses.map((course: Course, index: number) => (
                                                <motion.div
                                                    key={course._id}
                                                    variants={{
                                                        hidden: { opacity: 0, scale: 0.8, y: 10 },
                                                        visible: { opacity: 1, scale: 1, y: 0 }
                                                    }}
                                                    transition={{
                                                        duration: 0.3,
                                                        delay: index * 0.03,
                                                        type: "spring",
                                                        stiffness: 300,
                                                        damping: 25
                                                    }}
                                                >
                                                    <CourseCard
                                                        course={course}
                                                        isSelected={selectedCourse?._id === course._id}
                                                    />
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        layout
                                        className="space-y-2"
                                        initial="hidden"
                                        animate="visible"
                                        variants={{
                                            visible: {
                                                transition: {
                                                    staggerChildren: 0.02
                                                }
                                            }
                                        }}
                                    >
                                        <AnimatePresence >
                                            {filteredCourses.map((course: Course, index: number) => (
                                                <motion.div
                                                    key={course._id}
                                                    variants={{
                                                        hidden: { opacity: 0, x: -20 },
                                                        visible: { opacity: 1, x: 0 }
                                                    }}
                                                    transition={{
                                                        duration: 0.3,
                                                        delay: index * 0.02,
                                                        type: "spring",
                                                        stiffness: 300,
                                                        damping: 25
                                                    }}
                                                >
                                                    <CourseListItem
                                                        course={course}
                                                        isSelected={selectedCourse?._id === course._id}
                                                    />
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </motion.div>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </DashboardLayout>
    )
}