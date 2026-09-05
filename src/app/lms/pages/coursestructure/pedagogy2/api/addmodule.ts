// moduleService.ts - React Query version
import { http as apiClient } from "@/lib/http";
import { getToken as getCurrentToken } from "@/lib/session";

// Type definitions
interface Module {
    _id: string;
    institution: string;
    courses: string;
    title: string;
    description?: string;
    duration?: number;
    level?: string;
    createdAt: Date;
    createdBy?: string;
    updatedAt: Date;
    index?: number;
    updatedBy?: string;
        testConfiguration?: any; // Add this

}

interface ModuleCreateData {
    institution: string;
    courses: string;
    title: string;
    description?: string;
    duration?: number;
    level?: string;
    index?: number;
    createdBy?: string;
        testConfiguration?: any; // Add this

}

interface ModuleUpdateData {
    title?: string;
    description?: string;
    duration?: number;
    level?: string;
    index?: number;
    updatedBy?: string;
    courses?: any;
}

// Basic fetch functions
export const fetchAllModules = async (): Promise<Module[]> => {
    const response = await apiClient.get('/module/getAll');
    return response.data.modules || [];
};

export const fetchModuleById = async (moduleId: string): Promise<Module> => {
    const response = await apiClient.get(`/module/getByid/${moduleId}`);
    return response.data;
};

export const createModule = async (moduleData: ModuleCreateData): Promise<Module> => {
    // Ensure testConfiguration is included if it exists
    const payload = {
        ...moduleData,
        testConfiguration: moduleData.testConfiguration || null
    };
    const response = await apiClient.post('/module/create', payload);
    return response.data;
};

export const updateModule = async (moduleId: string, moduleData: ModuleUpdateData): Promise<Module> => {
    const response = await apiClient.put(`/module/update/${moduleId}`, moduleData);
    return response.data;
};

export const deleteModule = async (moduleId: string): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/module/delete/${moduleId}`);
    return response.data;
};

// WebSocket connection for real-time updates
let socket: WebSocket | null = null;

export const setupModulesWebSocket = (
    onUpdate: (updatedModule: Module) => void,
    onDelete: (deletedModuleId: string) => void,
    onCreate: (newModule: Module) => void
) => {
    if (socket) return socket;

    const token = getCurrentToken();
    if (!token) {
        throw new Error('No authentication token available');
    }

    socket = new WebSocket(`ws://localhost:5533/module/updates?token=${token}`);

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'module_updated':
                onUpdate(data.module);
                break;
            case 'module_deleted':
                onDelete(data.moduleId);
                break;
            case 'module_created':
                onCreate(data.module);
                break;
        }
    };

    socket.onclose = () => {
        console.log('Modules WebSocket disconnected');
        socket = null;
    };

    return socket;
};

export const closeModulesWebSocket = () => {
    if (socket) {
        socket.close();
        socket = null;
    }
};

// React Query API configuration
export const moduleApi = {
    getAll: () => ({
        queryKey: ['modules'],
        queryFn: fetchAllModules,
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 30, // 30 seconds
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: false,
    }),
    getById: (moduleId: string) => ({
        queryKey: ['module', moduleId],
        queryFn: () => fetchModuleById(moduleId),
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 30, // 30 seconds
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: false,
    }),
    create: () => ({
        mutationFn: createModule,
    }),
    update: () => ({
        mutationFn: ({ id, data }: { id: string, data: ModuleUpdateData }) => 
            updateModule(id, data),
    }),
    delete: (moduleId: string) => ({
        mutationFn: () => deleteModule(moduleId),
    }),
};