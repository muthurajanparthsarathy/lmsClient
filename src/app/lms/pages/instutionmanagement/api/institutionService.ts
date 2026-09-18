// institutionService.ts - React Query version
import { http as apiClient } from "@/lib/http";

// Types
export type Institution = {
    _id: string;
    inst_id: string;
    inst_name: string;
    inst_owner: string;
    phone: string;
    address?: string;
    createdBy: string;
    status: 'Active' | 'Inactive';
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
};

// Basic fetch functions
export const fetchAllInstitutions = async (): Promise<Institution[]> => {
    const response = await apiClient.get('/getAll/institution');
    return response.data.getAllInstitution || [];
};

export const fetchInstitutionById = async (institutionId: string): Promise<Institution> => {
    const response = await apiClient.get(`/getById/institution/${institutionId}`);
    return response.data.InstitutionById;
};

export const createInstitution = async (institutionData: {
    inst_name: string;
    inst_owner: string;
    phone: string;
    address?: string;
}): Promise<any> => {
    const response = await apiClient.post('/create/institution', institutionData);
    return response.data;
};

export const updateInstitution = async (institutionId: string, institutionData: {
    inst_name?: string;
    inst_owner?: string;
    phone?: string;
    address?: string;
}): Promise<any> => {
    const response = await apiClient.put(`/update/institution/${institutionId}`, institutionData);
    return response.data;
};

export const deleteInstitution = async (institutionId: string): Promise<any> => {
    const response = await apiClient.delete(`/delete/institution/${institutionId}`);
    return response.data;
};

// React Query API configuration
export const institutionApi = {
    getAll: () => ({
        queryKey: ['institutions'],
        queryFn: fetchAllInstitutions,
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 60, // 60 seconds
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
    }),
    getById: (institutionId: string) => ({
        queryKey: ['institution', institutionId],
        queryFn: () => fetchInstitutionById(institutionId),
        staleTime: 1000 * 30,
    }),
    create: () => ({
        mutationFn: createInstitution,
    }),
    update: (institutionId: string) => ({
        mutationFn: (data: any) => updateInstitution(institutionId, data),
    }),
    delete: (institutionId: string) => ({
        mutationFn: () => deleteInstitution(institutionId),
    }),
};