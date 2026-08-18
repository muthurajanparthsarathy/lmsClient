"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { BookOpen, Clock, Users, Play, ChevronRight, Search, Target, DollarSign as Collaboration, Rocket, Sparkles, AlertCircle } from 'lucide-react';
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from 'framer-motion';
import {
    useCoursesQuery,
    useFilteredCourses,
    getAuthToken,
    getCurrentUserIdFromAuth,
    Course
} from '../.../../../../../apiServices/studentcoursepage';
import { StudentLayout } from '../../component/student/student-layout';

const defaultCategories = ["All", "Web Development", "Data Science", "Mobile Development", "Design", "Cloud Computing", "Marketing", "Security"];

// Interface for user data
interface Permission {
    permissionName: string;
    permissionKey: string;
    permissionFunctionality: string[];
    icon: string;
    color: string;
    description: string;
    isActive: boolean;
    order: number;
    _id: string;
    createdAt: string;
    updatedAt: string;
}

interface UserData {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: {
        _id: string;
        originalRole: string;
        renameRole: string;
        roleValue: string;
    } | string;
    permissions?: Permission[];
    [key: string]: any;
}

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.1
        }
    }
};

const circleCardVariants = {
    hidden: {
        opacity: 0,
        scale: 0.8,
        rotate: -5
    },
    visible: {
        opacity: 1,
        scale: 1,
        rotate: 0,
        transition: {
            type: "spring" as const,
            stiffness: 100,
            damping: 15,
            duration: 0.5
        }
    }
};

const headerVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring" as const,
            stiffness: 120,
            damping: 20
        }
    }
};

const filterVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            type: "spring" as const,
            stiffness: 100,
            damping: 20
        }
    }
};

// Helper function to get user data from localStorage
const getCurrentUser = (): { valid: boolean; user: UserData | null } => {
    try {
        const userDataString = localStorage.getItem("smartcliff_userData");
        if (!userDataString) {
            return { valid: false, user: null };
        }

        const userData: UserData = JSON.parse(userDataString);
        return { valid: true, user: userData };
    } catch (error) {
        console.error("Error getting user data from localStorage:", error);
        return { valid: false, user: null };
    }
};

// Helper function to determine if user is a student
const isStudentUser = (): boolean => {
    try {
        const userResult = getCurrentUser();
        if (!userResult.valid || !userResult.user) return false;

        const user = userResult.user;
        let userRole = '';

        // Get role value from user data
        if (typeof user.role === 'object' && user.role !== null) {
            userRole = (user.role as any).roleValue ||
                (user.role as any).originalRole ||
                (user.role as any).renameRole || '';
        } else if (typeof user.role === 'string') {
            userRole = user.role;
        }

        // Also check localStorage for role value
        const storedRoleValue = localStorage.getItem("smartcliff_roleValue") ||
            localStorage.getItem("smartcliff_originalRole") ||
            localStorage.getItem("smartcliff_role") || '';

        userRole = userRole || storedRoleValue;

        // Check if role contains 'student' (case-insensitive)
        const isStudent = userRole.toLowerCase().includes('student');
        console.log("User role check:", {
            roleFromUser: userRole,
            storedRoleValue,
            isStudent
        });

        return isStudent;
    } catch (error) {
        console.error("Error checking user role:", error);
        return false;
    }
};

const Breadcrumbs = () => {
    const router = useRouter();

    return (
        <div className="flex items-center gap-1 text-xs mb-3 px-1 text-gray-800 dark:text-gray-200">
            <div
                className="flex items-center gap-1 px-2 py-1 text-gray-600 dark:text-gray-300 hover:text-orange-600 dark:hover:text-orange-400 cursor-pointer rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => router.push('/lms/pages/studentdashboard')}
            >
                <BookOpen className="w-3 h-3" />
                <span className="text-xs">Dashboard</span>
            </div>
            <ChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-600 mx-1" />
            <div className="flex items-center gap-1 px-2 py-1 text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/30 rounded transition-colors">
                <BookOpen className="w-3 h-3" />
                <span className="text-xs">Courses</span>
            </div>
        </div>
    );
};

export default function GradePage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>(defaultCategories);
    const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
    const [isStudent, setIsStudent] = useState<boolean>(false);
    const router = useRouter();

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = getAuthToken();
                setAuthToken(token);
                let currentUserId = getCurrentUserIdFromAuth();
                setUserId(currentUserId);
                const isDark = document.documentElement.classList.contains('dark');
                setCurrentTheme(isDark ? 'dark' : 'light');

                // Check if user is a student
                const studentCheck = isStudentUser();
                setIsStudent(studentCheck);
                console.log("Is student:", studentCheck);

                // Listen for theme changes
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'class') {
                            const isDark = document.documentElement.classList.contains('dark');
                            setCurrentTheme(isDark ? 'dark' : 'light');
                        }
                    });
                });

                observer.observe(document.documentElement, { attributes: true });

                return () => observer.disconnect();
            } catch (error) {
                console.error('Error in fetchUserData:', error);
            }
        };

        fetchUserData();
    }, []);

    const filters = {
        searchTerm,
        selectedCategory,
    };

    // One request, the whole enrolled list — this endpoint does not page.
    const {
        data,
        isLoading,
        error,
        isError,
        refetch
    } = useCoursesQuery(authToken, userId);

    const allCourses = useMemo(() => data || [], [data]);

    const uniqueServiceTypes = useMemo(() => {
        if (allCourses.length === 0) return [];

        const types = Array.from(
            new Set(allCourses.map(course => course.serviceType).filter(Boolean))
        );
        return types;
    }, [allCourses]);

    useEffect(() => {
        if (uniqueServiceTypes.length > 0) {
            setCategories(["All", ...uniqueServiceTypes]);
        } else {
            setCategories(defaultCategories);
        }
    }, [uniqueServiceTypes]);

    const filteredCourses = useFilteredCourses(allCourses, filters);

    const handleStartCourse = (courseId: string) => {
        console.log("Role-based navigation check - isStudent:", isStudent);

        if (isStudent) {
            console.log(`Student navigating to detailed view for course: ${courseId}`);
            router.push(`/lms/pages/grade/overallgrade?courseId=${courseId}`);
        } else {
            console.log(`Non-student navigating to upload resources for course: ${courseId}`);
            const query = new URLSearchParams({
                courseId: courseId,
            }).toString();
            router.push(`/lms/pages/grades/overallgrade?courseId=${courseId}`);
        }
    };

    const handleRetry = () => {
        refetch();
    };

    const showCourseLoading = isLoading && !data;

    return (
        <>
            <style jsx global>{`
                .custom-scrollbar {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(251, 146, 60, 0.6) transparent;
                }
                
                .custom-scrollbar::-webkit-scrollbar {
                    width: 3px;
                    height: 3px;
                }
                
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                    border-radius: 1px;
                }
                
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: linear-gradient(45deg, #fb923c, #f97316);
                    border-radius: 1px;
                    box-shadow: 0 0 4px rgba(251, 146, 60, 0.3);
                    transition: all 0.3s ease;
                }
                
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(45deg, #f97316, #ea580c);
                    box-shadow: 0 0 8px rgba(251, 146, 60, 0.6);
                    width: 4px;
                }

                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: linear-gradient(45deg, #fdba74, #fb923c);
                    box-shadow: 0 0 4px rgba(253, 186, 116, 0.4);
                }
                
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(45deg, #fb923c, #f97316);
                    box-shadow: 0 0 8px rgba(253, 186, 116, 0.6);
                }

                .custom-scrollbar {
                    scroll-behavior: smooth;
                }

                @keyframes scrollGlow {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                }

                .custom-scrollbar::-webkit-scrollbar-thumb {
                    animation: scrollGlow 2s ease-in-out infinite;
                }

                @keyframes shimmer {
                    0% {
                        background-position: -200px 0;
                    }
                    100% {
                        background-position: 200px 0;
                    }
                }

                .animate-shimmer {
                    background: linear-gradient(
                        90deg,
                        transparent 25%,
                        rgba(255, 255, 255, 0.4) 50%,
                        transparent 75%
                    );
                    background-size: 200px 100%;
                    animation: shimmer 1.5s infinite;
                }

                .dark .animate-shimmer {
                    background: linear-gradient(
                        90deg,
                        transparent 25%,
                        rgba(255, 255, 255, 0.1) 50%,
                        transparent 75%
                    );
                    background-size: 200px 100%;
                    animation: shimmer 1.5s infinite;
                }

                .course-circle-card {
                    transform: translateZ(0);
                    backface-visibility: hidden;
                    perspective: 1000px;
                }

                * {
                    box-sizing: border-box;
                }

                .glass-header {
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }

                /* Circle card specific styles */
                .circle-image {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: 3px solid white;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                }

                .dark .circle-image {
                    border: 3px solid #1f2937;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                }
            `}</style>

            <StudentLayout>
                <div className="min-h-full flex flex-col">
                    {/* Fixed Header with Breadcrumbs and Filters */}
                    <motion.div
                        className="flex-shrink-0 border-b bg-white/80 dark:bg-gray-900/80 glass-header sticky top-0 z-10 border-gray-200 dark:border-gray-800"
                        initial="hidden"
                        animate="visible"
                        variants={headerVariants}
                    >
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
                            {/* Breadcrumbs */}
                            <motion.div
                                className="mb-3"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                            >
                                <Breadcrumbs />
                            </motion.div>

                            {/* Header with title and stats */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                                <div>
                                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Selects Course for overall grade</h1>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                        {isStudent ? 'Continue your learning journey' : 'Manage course resources'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 bg-orange-50 dark:bg-orange-900/30 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-800/50">
                                        <BookOpen className="w-3 h-3" />
                                        <span>{allCourses.length} {isStudent ? 'enrolled courses' : 'courses'}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 bg-orange-50 dark:bg-orange-900/30 px-3 py-1.5 rounded-lg border border-orange-100 dark:border-orange-800/50">
                                        <Users className="w-3 h-3" />
                                        <span>{isStudent ? 'Student' : 'Staff'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Filters Section */}
                            <motion.div
                                className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between"
                                variants={filterVariants}
                            >
                                {/* Search Bar */}
                                <motion.div
                                    className="relative flex-1 max-w-md"
                                    initial={{ opacity: 0, x: -30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
                                    <input
                                        type="text"
                                        placeholder="Search courses by name..."
                                        className="w-full text-xs pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-600 focus:border-orange-500 dark:focus:border-orange-600 transition-all bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </motion.div>

                                {/* Filter Controls */}
                                <motion.div
                                    className="flex flex-wrap gap-2 items-center"
                                    initial={{ opacity: 0, x: 30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    <select
                                        className="text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-600 focus:border-orange-500 dark:focus:border-orange-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-w-[130px]"
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                    >
                                        {categories.map(category => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                    </select>

                                    <motion.div
                                        className="text-xs text-gray-700 dark:text-gray-300 bg-orange-50 dark:bg-orange-900/30 px-2.5 py-1.5 rounded-lg border border-orange-100 dark:border-orange-800/50"
                                        key={filteredCourses.length}
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ type: "spring", stiffness: 150 }}
                                    >
                                        {showCourseLoading ? 'Loading...' : `${filteredCourses.length} ${filteredCourses.length === 1 ? 'course' : 'courses'}`}
                                    </motion.div>
                                </motion.div>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Scrollable Course Grid */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4">
                            <AnimatePresence mode="wait">
                                {showCourseLoading ? (
                                    // Loading state with circle skeletons
                                    <motion.div
                                        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="visible"
                                        key="loading"
                                    >
                                        {Array.from({ length: 12 }).map((_, index) => (
                                            <motion.div
                                                key={index}
                                                className="flex flex-col items-center"
                                                variants={circleCardVariants}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse mb-2 overflow-hidden">
                                                    <div className="absolute inset-0 animate-shimmer" />
                                                </div>
                                                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
                                                <div className="h-2 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                ) : isError ? (
                                    // Error state
                                    <motion.div
                                        className="text-center py-8"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        key="error"
                                    >
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ delay: 0.2, type: "spring", stiffness: 150 }}
                                        >
                                            <BookOpen className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" />
                                        </motion.div>
                                        <h3 className="mt-3 text-base font-medium text-gray-900 dark:text-white">
                                            Error loading courses
                                        </h3>
                                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                            {error?.message || 'Something went wrong'}
                                        </p>
                                        <div className="flex gap-2 justify-center mt-3">
                                            <motion.button
                                                onClick={handleRetry}
                                                className="text-xs bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 hover:from-orange-600 hover:to-orange-700 dark:hover:from-orange-700 dark:hover:to-orange-800 text-white px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                Try Again
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                ) : filteredCourses.length === 0 && !userId ? (
                                    // No user ID found state
                                    <motion.div
                                        className="text-center py-8"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        key="no-user"
                                    >
                                        <BookOpen className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" />
                                        <h3 className="mt-3 text-base font-medium text-gray-900 dark:text-white">
                                            User not identified
                                        </h3>
                                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                            Please log in to view your enrolled courses
                                        </p>
                                        <motion.button
                                            onClick={() => router.push('/login')}
                                            className="mt-3 text-xs bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 hover:from-orange-600 hover:to-orange-700 dark:hover:from-orange-700 dark:hover:to-orange-800 text-white px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm"
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            Go to Login
                                        </motion.button>
                                    </motion.div>
                                ) : filteredCourses.length === 0 ? (
                                    // No enrolled courses state
                                    <motion.div
                                        className="text-center py-8"
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        key="empty"
                                    >
                                        <BookOpen className="mx-auto h-10 w-10 text-gray-400 dark:text-gray-500" />
                                        <h3 className="mt-3 text-base font-medium text-gray-900 dark:text-white">
                                            No {isStudent ? 'enrolled' : 'assigned'} courses found
                                        </h3>
                                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                                            {isStudent
                                                ? 'You are not enrolled in any courses yet.'
                                                : 'You are not assigned to any courses yet.'
                                            }
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                                            Please contact your administrator {isStudent ? 'for enrollment' : 'for course assignments'}.
                                        </p>
                                        <div className="flex gap-2 justify-center mt-3">
                                            <motion.button
                                                onClick={() => router.push('/lms')}
                                                className="text-xs bg-gradient-to-r from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700 hover:from-orange-600 hover:to-orange-700 dark:hover:from-orange-700 dark:hover:to-orange-800 text-white px-3 py-1.5 rounded-lg transition-all duration-200 shadow-sm"
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                Go to Dashboard
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    // Circle course cards grid
                                    <>
                                        <motion.div
                                            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4"
                                            variants={containerVariants}
                                            initial="hidden"
                                            animate="visible"
                                            key="courses"
                                        >
                                            {filteredCourses.map((course: Course, index: number) => (
                                                <motion.div
                                                    key={course._id}
                                                    className="flex flex-col items-center course-circle-card cursor-pointer group"
                                                    variants={circleCardVariants}
                                                    whileHover={{
                                                        scale: 1.1,
                                                        transition: { type: "spring", stiffness: 300, damping: 20 }
                                                    }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => handleStartCourse(course._id)}
                                                >
                                                    {/* Circle Image Container */}
                                                    <div className="relative w-24 h-24 mb-3">
                                                        <div className="w-full h-full rounded-full circle-image overflow-hidden border-4 border-white dark:border-gray-800 shadow-lg group-hover:shadow-xl transition-all duration-300">
                                                            <img
                                                                src={course.courseImage || "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=200&h=200&fit=crop&auto=format"}
                                                                alt={course.courseName}
                                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                                                onError={(e) => {
                                                                    e.currentTarget.src = "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=200&h=200&fit=crop&auto=format";
                                                                }}
                                                            />
                                                        </div>
                                                        
                                                        {/* Badge for course level */}
                                                        <div className="absolute -top-1 -right-1">
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${course.courseLevel === 'Beginner' ? 'bg-green-500 text-white' :
                                                                    course.courseLevel === 'Intermediate' ? 'bg-yellow-500 text-white' :
                                                                    'bg-red-500 text-white'
                                                                }`}>
                                                                {course.courseLevel.charAt(0)}
                                                            </span>
                                                        </div>
                                                        
                                                        {/* Hover overlay */}
                                                        <div className="absolute inset-0 rounded-full bg-orange-600/0 group-hover:bg-orange-600/20 transition-all duration-300 flex items-center justify-center">
                                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                                <div className="bg-orange-600 text-white rounded-full p-1.5">
                                                                    <ChevronRight className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Course Title */}
                                                    <div className="text-center">
                                                        <h3 className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight mb-0.5 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors duration-200">
                                                            {course.courseName}
                                                        </h3>
                                                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                            {course.serviceType}
                                                        </span>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </motion.div>

                                        {/* End of results message */}
                                        {filteredCourses.length > 0 && (
                                            <motion.div
                                                className="text-center py-6"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                            >
                                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 dark:bg-orange-900/40 rounded-lg border border-orange-100 dark:border-orange-800">
                                                    <BookOpen className="w-4 h-4 text-orange-500 dark:text-orange-400" />
                                                    <p className="text-xs text-orange-600 dark:text-orange-400">
                                                        You've viewed all {isStudent ? 'your enrolled courses' : 'assigned courses'} ({filteredCourses.length})
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </StudentLayout>
        </>
    );
}