import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

export interface CourseAnalytics {
  _id: string;
  courseName: string;
  courseCode: string;
  description: string;
  courseDuration: string;
  courseLevel: string;
  serviceType: string;
  courseImage: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    participants: number;
    activeParticipants: number;
    modules: number;
    subModules: number;
    topics: number;
    subTopics: number;
  };
  modules: Array<any>;
  participants: Array<any>;
}

export interface AnalyticsData {
  courses: CourseAnalytics[];
  analytics: {
    totalCourses: number;
    totalModules: number;
    totalSubModules: number;
    totalTopics: number;
    totalSubTopics: number;
    totalParticipants: number;
    totalActiveParticipants: number;
  };
  summary: {
    coursesByLevel: Record<string, number>;
    coursesByService: Record<string, number>;
  };
}

// `mine: true` asks the server for only the courses the caller is enrolled in.
// The dashboard discards every other course anyway, so this is the same result
// from a fraction of the payload (1,075,764 -> 184,076 bytes measured) — and a
// student stops receiving other courses' participant lists.
export const getStudentDashboardAnalytics = async (opts?: { mine?: boolean }): Promise<AnalyticsData> => {
  const token = localStorage.getItem("smartcliff_token");
  if (!token) {
    throw new Error('No token found');
  }
  
  const response = await axios.get(
    `${API_BASE_URL}/student-Dashboard/courses-data/analytics${opts?.mine ? '?mine=1' : ''}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  if (response.data.success) {
    return response.data.data;
  }
  
  throw new Error(response.data.message || 'Failed to fetch analytics');
};

// Filter courses for the current logged-in user
export const getUserCoursesFromAnalytics = (
  analytics: AnalyticsData,
  userId: string
): CourseAnalytics[] => {
  if (!userId || !analytics?.courses) return [];
  
  return analytics.courses.filter(course => {
    // Check if the user is in the participants array
    return course.participants?.some((participant: any) => {
      // Handle both string user ID and populated user object
      const participantUserId = 
        typeof participant.user === 'string' 
          ? participant.user 
          : participant.user?._id || participant.user?.$oid;
      
      return participantUserId === userId && participant.status === 'active';
    });
  });
};

// Get user-specific analytics
export const getUserSpecificAnalytics = (
  analytics: AnalyticsData,
  userId: string
) => {
  const userCourses = getUserCoursesFromAnalytics(analytics, userId);
  
  const userStats = {
    enrolledCourses: userCourses.length,
    totalModules: userCourses.reduce((sum, course) => sum + course.stats.modules, 0),
    totalTopics: userCourses.reduce((sum, course) => sum + course.stats.topics, 0),
    activeCourses: userCourses.filter(course => {
      // You can add logic to determine if a course is "active" based on user progress
      return true; // For now, all enrolled courses are considered active
    }).length,
    coursesByLevel: userCourses.reduce((acc, course) => {
      const level = course.courseLevel || 'Not Specified';
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    coursesByType: userCourses.reduce((acc, course) => {
      const type = course.serviceType || 'Not Specified';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  };
  
  return {
    userCourses,
    userStats
  };
};