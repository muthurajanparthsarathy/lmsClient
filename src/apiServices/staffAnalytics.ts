// apiServices/staffAnalytics.js
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lmsserver-yeve.onrender.com';

export const getStaffStudentAnalytics = async () => {
    const token = localStorage.getItem("smartcliff_token");
    if (!token) throw new Error('No token found');
    
    const response = await axios.get(
        `${API_BASE_URL}/analytics/staff/analytics/students`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    if (response.data.success) return response.data.data;
    throw new Error(response.data.message || 'Failed to fetch staff analytics');
};

export const getStudentCourseProgress = async (courseId, studentId) => {
    const token = localStorage.getItem("smartcliff_token");
    if (!token) throw new Error('No token found');
    
    const response = await axios.get(
        `${API_BASE_URL}/analytics/staff/analytics/student-progress/${courseId}/${studentId}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
    );
    
    if (response.data.success) return response.data;
    throw new Error(response.data.message || 'Failed to fetch student progress');
};