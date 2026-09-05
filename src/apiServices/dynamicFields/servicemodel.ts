// src/apiServices/dynamicFields/serviceApi.ts
import axios from 'axios';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lmsserver-yeve.onrender.com';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const getAuthConfig = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

// Service API functions
export const getAllServices = async ({ institutionId, token }: { institutionId: string; token: string }) => {
  const response = await apiClient.get(`/services/getAll/`, {
    headers: {
  
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.data;
};

export const createService = async ({ serviceData, token }: { serviceData: any; token: string }) => {
  const response = await apiClient.post('/services/create', serviceData, getAuthConfig(token));
  return response.data;
};

export const updateService = async ({ id, data, token }: { id: string; data: any; token: string }) => {
  const response = await apiClient.put(`/services/update/${id}`, data, getAuthConfig(token));
  return response.data;
};

export const deleteService = async ({ id, token }: { id: string; token: string }) => {
  const response = await apiClient.delete(`/services/delete/${id}`, getAuthConfig(token));
  return response.data;
};

// Service Modal API functions
export const getAllServiceModals = async ({ institutionId, token }: { institutionId: string; token: string }) => {
  const response = await apiClient.get(`/service-modals/getAll/${institutionId}`, {
    headers: {
      'institution': institutionId,
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.data;
};

export const createServiceModal = async ({ modalData, token }: { modalData: any; token: string }) => {
  const response = await apiClient.post('/service-modals/create', modalData, getAuthConfig(token));
  return response.data;
};

export const updateServiceModal = async ({ serviceId, modalId, data, institutionId, token }: { serviceId: string; modalId: string; data: any; institutionId: string; token: string }) => {
  const response = await apiClient.put(`/service-modals/update/${serviceId}/${modalId}`, data, {
    headers: {
      'institution': institutionId,
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.data;
};

export const deleteServiceModal = async ({ serviceId, modalId, institutionId, token }: { serviceId: string; modalId: string; institutionId: string; token: string }) => {
  const response = await apiClient.delete(`/service-modals/delete/${serviceId}/${modalId}`, {
    headers: {
      'institution': institutionId,
      'Authorization': `Bearer ${token}`,
    },
  });
  return response.data;
};

// React Query hooks
export const useServices = (institutionId: string, token: string) => {
  return useQuery({
    queryKey: ['services', institutionId],
    queryFn: () => getAllServices({ institutionId, token }),
    enabled: !!token,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    select: (data) => {
      if (!data.success) return [];
      return data.data.map((service: any) => ({
        id: service._id,
        name: service.name,
        description: service.description,
        status: 'Active',
        serviceModals: service.serviceModal ? service.serviceModal.map((modal: any) => ({
          id: modal._id,
          name: modal.title,
          description: modal.description,
        })) : [],
      }));
    },
  });
};

export const useCreateService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

export const useUpdateService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

export const useDeleteService = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
};

export const useServiceModals = (institutionId: string, token: string) => {
  return useQuery({
    queryKey: ['serviceModals', institutionId],
    queryFn: () => getAllServiceModals({ institutionId, token }),
    enabled: !!token,
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

export const useCreateServiceModal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createServiceModal,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services', variables.modalData.institutionId] });
      queryClient.invalidateQueries({ queryKey: ['serviceModals', variables.modalData.institutionId] });
    },
  });
};

export const useUpdateServiceModal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateServiceModal,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services', variables.institutionId] });
      queryClient.invalidateQueries({ queryKey: ['serviceModals', variables.institutionId] });
    },
  });
};

export const useDeleteServiceModal = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteServiceModal,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['services', variables.institutionId] });
      queryClient.invalidateQueries({ queryKey: ['serviceModals', variables.institutionId] });
    },
  });
};