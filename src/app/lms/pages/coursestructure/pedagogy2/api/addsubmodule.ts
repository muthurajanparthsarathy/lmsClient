// subModuleService.ts - React Query version
import { http as apiClient } from "@/lib/http";
import { getToken as getCurrentToken } from "@/lib/session";

// Type definitions
interface SubModule {
  _id: string;
  institution: string;
  courses: string;
  moduleId: string;
  title: string;
  description?: string;
  index?: number;
  duration?: number;
  level?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
}

interface SubModuleCreateData {
  institution?: string;
  courses: string;
  moduleId: string;
  title: string;
  description?: string;
  duration?: number;
  level?: string;
  index?: number;
  createdBy?: string;
}

interface SubModuleUpdateData {
  title?: string;
  description?: string;
  duration?: number;
  level?: string;
  updatedBy?: string;
  index?: number;
  moduleId?: any;
  courses?: any;
}

// Basic fetch functions
export const fetchAllSubModules = async (): Promise<SubModule[]> => {
  const response = await apiClient.get('/sub-module/getAll');
  return response.data.subModules || [];
};

export const fetchSubModulesByModuleId = async (moduleId: string): Promise<SubModule[]> => {
  const allSubModules = await fetchAllSubModules();
  return allSubModules.filter(subModule => subModule.moduleId === moduleId);
};

export const fetchSubModuleById = async (subModuleId: string): Promise<SubModule> => {
  const response = await apiClient.get(`/sub-module/getByid/${subModuleId}`);
  return response.data;
};

export const createSubModule = async (subModuleData: SubModuleCreateData): Promise<SubModule> => {
  const response = await apiClient.post('/sub-module/create', subModuleData);
  return response.data;
};

export const updateSubModule = async (subModuleId: string, subModuleData: SubModuleUpdateData): Promise<SubModule> => {
  const response = await apiClient.put(`/sub-module/update/${subModuleId}`, subModuleData);
  return response.data;
};

export const deleteSubModule = async (subModuleId: string): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/sub-module/delete/${subModuleId}`);
  return response.data;
};

// WebSocket connection for real-time updates
let socket: WebSocket | null = null;

export const setupSubModulesWebSocket = (
  onUpdate: (updatedSubModule: SubModule) => void,
  onDelete: (deletedSubModuleId: string) => void,
  onCreate: (newSubModule: SubModule) => void
) => {
  if (socket) return socket;

  const token = getCurrentToken();
  if (!token) {
    throw new Error('No authentication token available');
  }

  socket = new WebSocket(`ws://localhost:5533/sub-module/updates?token=${token}`);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'sub_module_updated':
        onUpdate(data.subModule);
        break;
      case 'sub_module_deleted':
        onDelete(data.subModuleId);
        break;
      case 'sub_module_created':
        onCreate(data.subModule);
        break;
    }
  };

  socket.onclose = () => {
    console.log('SubModules WebSocket disconnected');
    socket = null;
  };

  return socket;
};

export const closeSubModulesWebSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};

// React Query API configuration
export const subModuleApi = {
  getAll: () => ({
    queryKey: ['subModules'],
    queryFn: fetchAllSubModules,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  getByModuleId: (moduleId: string) => ({
    queryKey: ['subModules', 'byModule', moduleId],
    queryFn: () => fetchSubModulesByModuleId(moduleId),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  getById: (subModuleId: string) => ({
    queryKey: ['subModule', subModuleId],
    queryFn: () => fetchSubModuleById(subModuleId),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  create: () => ({
    mutationFn: createSubModule,
  }),
  update: () => ({
    mutationFn: ({ id, data }: { id: string, data: SubModuleUpdateData }) => 
      updateSubModule(id, data),
  }),
  delete: (subModuleId: string) => ({
    mutationFn: () => deleteSubModule(subModuleId),
  }),
};