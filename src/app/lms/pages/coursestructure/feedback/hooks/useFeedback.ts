// hooks/useFeedback.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreateFeedbackPayload, UpdateFeedbackPayload, ToggleStatusPayload } from '../types/feedback';
import toast from 'react-hot-toast';
import { feedbackService } from '@/app/lms/pages/coursestructure/feedback/api/feedbackService';

// Query Keys
export const feedbackKeys = {
  all: ['feedback'] as const,
  lists: () => [...feedbackKeys.all, 'list'] as const,
  list: (courseId?: string) => [...feedbackKeys.lists(), { courseId }] as const,
  details: () => [...feedbackKeys.all, 'detail'] as const,
  detail: (id: string) => [...feedbackKeys.details(), id] as const,
  statistics: (id: string) => [...feedbackKeys.all, 'statistics', id] as const,
  courseStatistics: (courseId: string) => [...feedbackKeys.all, 'course-statistics', courseId] as const,
  // `?summary=1` — the same list minus studentResponses/questions/statistics.
  // Its own entry (the payload shape differs from list()) but under the same
  // 'feedback' root, so the mutations below still invalidate it.
  listSummary: (courseId: string) => [...feedbackKeys.lists(), { courseId }, 'summary'] as const,
};

// Helper to get token
const getToken = (): string | null => {
  return localStorage.getItem('smartcliff_token') || localStorage.getItem('token');
};

// Get all feedback
export const useGetAllFeedback = (courseId?: string) => {
  return useQuery({
    queryKey: feedbackKeys.list(courseId),
    queryFn: () => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      return feedbackService.getAllFeedback(courseId, token);
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    onError: (error: any) => {
      console.error('Error fetching feedback:', error);
      const message = error?.response?.data?.message?.[0]?.value || error?.message || 'Failed to load feedback';
      toast.error(message);
    },
  });
};

// Get feedback by ID
export const useGetFeedbackById = (id: string) => {
  return useQuery({
    queryKey: feedbackKeys.detail(id),
    queryFn: () => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      return feedbackService.getFeedbackById(id, token);
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// Get feedback by course
export const useGetFeedbackByCourse = (courseId: string) => {
  return useQuery({
    queryKey: feedbackKeys.list(courseId),
    queryFn: () => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      return feedbackService.getFeedbackByCourse(courseId, token);
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });
};

// Get feedback statistics
export const useGetFeedbackStatistics = (id: string) => {
  return useQuery({
    queryKey: feedbackKeys.statistics(id),
    queryFn: () => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      return feedbackService.getFeedbackStatistics(id, token);
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  });
};

// Get course feedback statistics
export const useGetCourseFeedbackStatistics = (courseId: string) => {
  return useQuery({
    queryKey: feedbackKeys.courseStatistics(courseId),
    queryFn: () => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      return feedbackService.getCourseFeedbackStatistics(courseId, token);
    },
    enabled: !!courseId,
    staleTime: 2 * 60 * 1000,
  });
};

// Create feedback mutation
export const useCreateFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFeedbackPayload) => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      return feedbackService.createFeedback(data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.lists() });
      toast.success('Feedback created successfully!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message?.[0]?.value || error?.message || 'Failed to create feedback';
      toast.error(message);
    },
  });
};

// Update feedback mutation
export const useUpdateFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFeedbackPayload }) => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      return feedbackService.updateFeedback(id, data, token);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.lists() });
      queryClient.invalidateQueries({ queryKey: feedbackKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: feedbackKeys.statistics(variables.id) });
      toast.success('Feedback updated successfully!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message?.[0]?.value || error?.message || 'Failed to update feedback';
      toast.error(message);
    },
  });
};

// Delete feedback mutation
export const useDeleteFeedback = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      return feedbackService.deleteFeedback(id, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.lists() });
      toast.success('Feedback deleted successfully!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message?.[0]?.value || error?.message || 'Failed to delete feedback';
      toast.error(message);
    },
  });
};

// Toggle feedback status mutation
export const useToggleFeedbackStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ToggleStatusPayload }) => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      return feedbackService.toggleFeedbackStatus(id, data, token);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.lists() });
      queryClient.invalidateQueries({ queryKey: feedbackKeys.detail(variables.id) });
      toast.success('Feedback status updated successfully!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message?.[0]?.value || error?.message || 'Failed to update status';
      toast.error(message);
    },
  });
};

// Submit student response mutation
export const useSubmitStudentResponse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, data }: { feedbackId: string; data: { answers: any[]; overallReason?: string } }) => {
      const token = getToken();
      if (!token) {
        throw new Error('Authentication required. Please login again.');
      }
      return feedbackService.submitStudentResponse(feedbackId, data, token);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: feedbackKeys.all });
      toast.success('Feedback submitted successfully!');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message?.[0]?.value || error?.message || 'Failed to submit feedback';
      toast.error(message);
    },
  });
};