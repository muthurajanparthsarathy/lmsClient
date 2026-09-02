// services/feedbackService.ts

import axios from 'axios';
import {
  Feedback,
  CreateFeedbackPayload,
  UpdateFeedbackPayload,
  ToggleStatusPayload,
  FeedbackStatistics
} from '../app/lms/pages/coursestructure/feedback/types/feedback';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

// Helper to get token
const getToken = (): string | null => {
  return localStorage.getItem('smartcliff_token') || localStorage.getItem('token');
};

// Helper to get headers with token
const getHeaders = (token?: string) => {
  const authToken = token || getToken();
  return {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
  };
};

export const feedbackService = {
  // Create feedback
  createFeedback: async (data: CreateFeedbackPayload, token?: string): Promise<Feedback> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      console.log('📤 Creating feedback...');
      const response = await axios.post(
        `${API_BASE_URL}/create/feedback`,
        data,
        { headers: getHeaders(authToken) }
      );
      return response.data.data || response.data;
    } catch (error) {
      console.error('Create feedback error:', error);
      throw error;
    }
  },

  // Get all feedback
  getAllFeedback: async (courseId?: string, token?: string): Promise<Feedback[]> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      const params = courseId ? { courseId } : {};
      console.log('📤 Fetching feedback with params:', params);
      
      const response = await axios.get(
        `${API_BASE_URL}/getAll/feedback`,
        { 
          params, 
          headers: getHeaders(authToken) 
        }
      );
      
      console.log('📥 Response data:', response.data);
      
      if (response.data) {
        if (response.data.getAllFeedback) {
          return response.data.getAllFeedback;
        }
        if (response.data.data && response.data.data.getAllFeedback) {
          return response.data.data.getAllFeedback;
        }
        if (Array.isArray(response.data)) {
          return response.data;
        }
        if (response.data.feedbacks && Array.isArray(response.data.feedbacks)) {
          return response.data.feedbacks;
        }
      }
      
      console.warn('⚠️ Unexpected response format:', response.data);
      return [];
    } catch (error) {
      console.error('❌ Failed to fetch feedbacks:', error);
      throw error;
    }
  },

  // Get feedback by ID
  getFeedbackById: async (id: string, token?: string): Promise<Feedback> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      const response = await axios.get(
        `${API_BASE_URL}/getByid/feedback/${id}`,
        { headers: getHeaders(authToken) }
      );
      return response.data.feedbackById || response.data.data || response.data;
    } catch (error) {
      console.error('Get feedback by ID error:', error);
      throw error;
    }
  },

  // Get feedback by course
  getFeedbackByCourse: async (courseId: string, token?: string): Promise<Feedback[]> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      const response = await axios.get(
        `${API_BASE_URL}/getByCourse/feedback/course/${courseId}`,
        { headers: getHeaders(authToken) }
      );
      
      if (response.data && response.data.courseFeedback) {
        return response.data.courseFeedback;
      }
      if (response.data && response.data.data && response.data.data.courseFeedback) {
        return response.data.data.courseFeedback;
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Get feedback by course error:', error);
      throw error;
    }
  },

  // Update feedback
  updateFeedback: async (id: string, data: UpdateFeedbackPayload, token?: string): Promise<Feedback> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      const response = await axios.put(
        `${API_BASE_URL}/update/feedback/${id}`,
        data,
        { headers: getHeaders(authToken) }
      );
      return response.data.updated_feedback || response.data.data || response.data;
    } catch (error) {
      console.error('Update feedback error:', error);
      throw error;
    }
  },

  // Delete feedback
  deleteFeedback: async (id: string, token?: string): Promise<void> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      await axios.delete(
        `${API_BASE_URL}/feedback/delete/${id}`,
        { headers: getHeaders(authToken) }
      );
    } catch (error) {
      console.error('Delete feedback error:', error);
      throw error;
    }
  },

  // Toggle feedback status
  toggleFeedbackStatus: async (id: string, data: ToggleStatusPayload, token?: string): Promise<Feedback> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      const response = await axios.patch(
        `${API_BASE_URL}/toggle/feedback/${id}`,
        data,
        { headers: getHeaders(authToken) }
      );
      return response.data.updated_feedback || response.data.data || response.data;
    } catch (error) {
      console.error('Toggle feedback status error:', error);
      throw error;
    }
  },

  // Get feedback statistics
  getFeedbackStatistics: async (id: string, token?: string): Promise<FeedbackStatistics> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      const response = await axios.get(
        `${API_BASE_URL}/getAll/feedback/statistics/${id}`,
        { headers: getHeaders(authToken) }
      );
      return response.data.statistics || response.data.data || response.data;
    } catch (error) {
      console.error('Get feedback statistics error:', error);
      throw error;
    }
  },

  // Get course feedback statistics
  getCourseFeedbackStatistics: async (courseId: string, token?: string): Promise<any> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      const response = await axios.get(
        `${API_BASE_URL}/getAll/feedback/statistics/course/${courseId}`,
        { headers: getHeaders(authToken) }
      );
      return response.data.statistics || response.data.data || response.data;
    } catch (error) {
      console.error('Get course feedback statistics error:', error);
      throw error;
    }
  },

  // Get question responses
  getQuestionResponses: async (id: string, questionText: string, token?: string): Promise<any> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required');
      }

      const response = await axios.get(
        `${API_BASE_URL}/getAll/feedback/questions/${id}/responses`,
        { 
          params: { questionText },
          headers: getHeaders(authToken)
        }
      );
      return response.data.data || response.data;
    } catch (error) {
      console.error('Get question responses error:', error);
      throw error;
    }
  },

  // Submit student response
  submitStudentResponse: async (feedbackId: string, data: { answers: any[]; overallReason?: string }, token?: string): Promise<any> => {
    try {
      const authToken = token || getToken();
      if (!authToken) {
        throw new Error('Authentication token is required. Please login again.');
      }

      console.log('📤 Submitting student feedback response for feedbackId:', feedbackId);
      console.log('📤 Data:', data);

      const response = await axios.post(
        `${API_BASE_URL}/student/submit/feedback/${feedbackId}`,
        data,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('📥 Response:', response.data);
      return response.data.data || response.data;
    } catch (error: any) {
      console.error('❌ Submit student response error:', error);
      
      // Handle specific error cases
      if (error?.response?.status === 401) {
        throw new Error('Session expired. Please login again.');
      }
      throw error;
    }
  },
};


/**
 * Does this course have a feedback form that is both published and active?
 *
 * The student course list asks this once per course purely to decide whether
 * to show a Feedback button. It uses `?summary=1` so the server omits
 * studentResponses / questions / statistics — the full document is ~19x
 * larger and carries every student's answers, none of which this boolean
 * needs.
 */
export const fetchPublishedFeedbackFlag = async (courseId: string): Promise<boolean> => {
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('smartcliff_token') || localStorage.getItem('token')
      : null;
  if (!token) return false;
  try {
    const { data } = await axios.get(
      `${API_BASE_URL}/getAll/feedback?courseId=${courseId}&summary=1`,
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );
    const list = data?.getAllFeedback || data?.data?.getAllFeedback || [];
    return list.some((fb: any) => fb.isPublished === true && fb.isActive === true);
  } catch {
    // Unreachable feedback must not blank the course card — same swallow the
    // page's own try/catch did.
    return false;
  }
};
