import { useQuery, useMutation, useQueryClient, UseQueryResult } from '@tanstack/react-query';
import {
  ProgrammingQuestion,
  ProgrammingQuestionsResponse,
  createProgrammingQuestion,
  getAllProgrammingQuestions,
  getProgrammingQuestionById,
  updateProgrammingQuestion,
  deleteProgrammingQuestion,
  toggleQuestionStatus,
  executeCode
} from '../services/problemSolvingService';

// Query keys
export const problemSolvingQueryKeys = {
  all: ['problem-solving'] as const,
  lists: () => [...problemSolvingQueryKeys.all, 'list'] as const,
  list: (filters: any) => [...problemSolvingQueryKeys.lists(), filters] as const,
  details: () => [...problemSolvingQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...problemSolvingQueryKeys.details(), id] as const,
};

// Hook for fetching all programming questions
export const useProgrammingQuestions = (
  page: number = 1,
  limit: number = 10,
  filters: {
    search?: string;
    difficulty?: string;
    status?: string;
    language?: string;
  } = {}
) => {
  return useQuery({
    queryKey: problemSolvingQueryKeys.list({ page, limit, ...filters }),
    queryFn: () => getAllProgrammingQuestions(page, limit, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook for fetching a single programming question
export const useProgrammingQuestion = (id: string | undefined) => {
  return useQuery({
    queryKey: problemSolvingQueryKeys.detail(id!),
    queryFn: () => getProgrammingQuestionById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
};

// Hook for creating a programming question
export const useCreateProgrammingQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createProgrammingQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: problemSolvingQueryKeys.lists() 
      });
    },
  });
};

// Hook for updating a programming question
export const useUpdateProgrammingQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProgrammingQuestion> }) =>
      updateProgrammingQuestion(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: problemSolvingQueryKeys.lists() 
      });
      queryClient.invalidateQueries({ 
        queryKey: problemSolvingQueryKeys.detail(variables.id) 
      });
    },
  });
};

// Hook for deleting a programming question
export const useDeleteProgrammingQuestion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteProgrammingQuestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: problemSolvingQueryKeys.lists() 
      });
    },
  });
};

// Hook for toggling question status
export const useToggleQuestionStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      toggleQuestionStatus(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: problemSolvingQueryKeys.lists() 
      });
    },
  });
};

// Hook for executing code
export const useExecuteCode = () => {
  return useMutation({
    mutationFn: executeCode,
  });
};