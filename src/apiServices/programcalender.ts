// programCalendar.ts - API service for program calendar functionality
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

// Configure axios instance
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 10000,
});

// Interface for Course data
export interface Course {
    _id: string;
    courseName: string;
    courseCode: string;
    courseLevel: string;
    courseDuration: string;
    clientName: string;
    serviceType: string;
    courseDescription: string;
    createdAt?: string;
    updatedAt?: string;
}

// Interface for API response when fetching courses
export interface GetCoursesResponse {
    message: Array<{ key: string; value: string }>;
    data: Course[];
    success?: boolean;
}

// Interface for calendar generation data
export interface CalendarGenerationData {
    courseId: string;
    type: 'manual' | 'auto';
    startDate?: string;
    endDate?: string;
    customSettings?: {
        workingDays?: string[];
        holidays?: string[];
        dailyHours?: number;
    };
}

// Interface for calendar response
export interface CalendarResponse {
    success: boolean;
    message: string;
    data: {
        calendarId: string;
        courseId: string;
        schedule: Array<{
            date: string;
            sessions: Array<{
                startTime: string;
                endTime: string;
                topic: string;
                module?: string;
            }>;
        }>;
        totalDays: number;
        totalHours: number;
    };
}

// Function to fetch all courses
export const fetchCourses = async (authToken: string): Promise<GetCoursesResponse> => {
    try {
        const response = await apiClient.get('/courses-structure/getAll', {
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorMessage = error.response?.data?.message || 'Failed to fetch courses';
            throw new Error(errorMessage);
        }
        throw new Error('Network error occurred while fetching courses');
    }
};

// Function to fetch course by ID
export const fetchCourseById = async (courseId: string, authToken: string): Promise<Course> => {
    try {
        const response = await apiClient.get(`/courses-structure/${courseId}`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });
        return response.data.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorMessage = error.response?.data?.message || 'Failed to fetch course details';
            throw new Error(errorMessage);
        }
        throw new Error('Network error occurred while fetching course details');
    }
};

// Function to generate calendar (manual or auto)
export const generateCalendar = async (
    calendarData: CalendarGenerationData, 
    authToken: string
): Promise<CalendarResponse> => {
    try {
        const response = await apiClient.post('/program-calendar/generate', calendarData, {
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorMessage = error.response?.data?.message || 'Failed to generate calendar';
            throw new Error(errorMessage);
        }
        throw new Error('Network error occurred while generating calendar');
    }
};

// Function to fetch existing calendar for a course
export const fetchCalendarByCourse = async (courseId: string, authToken: string): Promise<CalendarResponse> => {
    try {
        const response = await apiClient.get(`/program-calendar/course/${courseId}`, {
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            const errorMessage = error.response?.data?.message || 'Failed to fetch calendar';
            throw new Error(errorMessage);
        }
        throw new Error('Network error occurred while fetching calendar');
    }
};

// Function to validate if user is authenticated (checks if token exists)
export const isAuthenticated = (token: string | null): boolean => {
    return !!token;
};

// Helper function to get auth token from localStorage
export const getAuthToken = (): string | null => {
    return localStorage.getItem('smartcliff_token');
};

// Helper function to format date
export const formatDate = (dateString: string): string => {
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch (error) {
        return 'Invalid Date';
    }
};

// Helper function to format date with time
export const formatDateTime = (dateString: string): string => {
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Invalid Date';
    }
};

// Helper function to get course level badge color
export const getCourseLevelBadgeColor = (level: string): string => {
    const levelLower = level.toLowerCase();
    if (levelLower.includes('beginner') || levelLower.includes('basic') || levelLower.includes('foundation')) {
        return 'bg-green-100 text-green-700 border-green-200';
    }
    if (levelLower.includes('intermediate') || levelLower.includes('medium')) {
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
    if (levelLower.includes('advanced') || levelLower.includes('expert') || levelLower.includes('professional')) {
        return 'bg-red-100 text-red-700 border-red-200';
    }
    return 'bg-blue-100 text-blue-700 border-blue-200';
};

// Helper function to calculate course end date based on start date and duration
export const calculateCourseEndDate = (startDate: string, durationInDays: string): string => {
    try {
        const start = new Date(startDate);
        const duration = parseInt(durationInDays);
        const endDate = new Date(start);
        endDate.setDate(start.getDate() + duration - 1); // -1 because duration includes start date
        return endDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    } catch (error) {
        return '';
    }
};

// Helper function to validate course selection
export const validateCourseSelection = (courseId: string, courses: Course[]): Course | null => {
    return courses.find(course => course._id === courseId) || null;
};

// Helper function to get service type badge color
export const getServiceTypeBadgeColor = (serviceType: string): string => {
    const typeLower = serviceType.toLowerCase();
    if (typeLower.includes('online') || typeLower.includes('virtual')) {
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (typeLower.includes('offline') || typeLower.includes('classroom') || typeLower.includes('in-person')) {
        return 'bg-purple-100 text-purple-700 border-purple-200';
    }
    if (typeLower.includes('hybrid') || typeLower.includes('blended')) {
        return 'bg-orange-100 text-orange-700 border-orange-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
};

// Error handling utility
export const handleApiError = (error: any): string => {
    if (axios.isAxiosError(error)) {
        // Check if response exists (server responded with an error)
        if (error.response) {
            const status = error.response.status;
            
            if (status === 401) {
                return 'Authentication failed. Please login again.';
            }
            if (status === 403) {
                return 'You do not have permission to perform this action.';
            }
            if (status === 404) {
                return 'Requested resource not found.';
            }
            if (status >= 500) {
                return 'Server error occurred. Please try again later.';
            }
            
            // Return server error message if available
            return error.response.data?.message || `Request failed with status ${status}`;
        }
        
        // Handle cases where no response was received (network issues)
        if (error.request) {
            return 'No response from server. Please check your internet connection.';
        }
        
        // Handle other axios errors (request setup issues)
        return error.message || 'Request configuration error occurred';
    }
    
    // Handle non-axios errors
    return error instanceof Error ? error.message : 'An unexpected error occurred';
};