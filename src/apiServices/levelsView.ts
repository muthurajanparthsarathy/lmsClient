// levelViewService.ts - React Query version
import { http as apiClient } from "@/lib/http";
import { getToken as getCurrentToken } from "@/lib/session";

// Basic fetch functions
export const fetchAllLevelViews = async (): Promise<any> => {
    const response = await apiClient.get('/getAll/levels');
    return response.data.levelsViews;
};

export const fetchLevelViewById = async (levelId: string): Promise<any> => {
    const response = await apiClient.get(`/getByid/levels/${levelId}`);
    return response.data.levelViewByid;
};

export const createLevelView = async (levelViewData: {
    courses: string;
    levels: Array<{
        module?: string[];
        subModule?: string[];
        topic?: string[];
        subTopic?: string[];
        level: string;
    }>;
}): Promise<any> => {
    const response = await apiClient.post('/create/levels', levelViewData);
    return response.data;
};

export const updateLevelView = async (levelId: string, updateData: {
    module?: string[];
    subModule?: string[];
    topic?: string[];
    subTopic?: string[];
    levels?: any;
}): Promise<any> => {
    const response = await apiClient.put(`/update/levels/${levelId}`, updateData);
    return response.data;
};

export const deleteLevelFromView = async (levelId: string): Promise<any> => {
    const response = await apiClient.delete(`/delete/levels/ById/${levelId}`);
    return response.data;
};

// WebSocket connection for real-time updates
let socket: WebSocket | null = null;

export const setupLevelViewsWebSocket = (
    onUpdate: (updatedLevel: any) => void,
    onDelete: (deletedLevelId: string) => void,
    onCreate: (newLevel: any) => void
) => {
    if (socket) return socket;

    const token = getCurrentToken();
    if (!token) {
        throw new Error('No authentication token available');
    }

    socket = new WebSocket(`ws://localhost:5533/levels/updates?token=${token}`);

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'level_view_updated':
                onUpdate(data.level);
                break;
            case 'level_view_deleted':
                onDelete(data.levelId);
                break;
            case 'level_view_created':
                onCreate(data.level);
                break;
        }
    };

    socket.onclose = () => {
        console.log('Level views WebSocket disconnected');
        socket = null;
    };

    return socket;
};

export const closeLevelViewsWebSocket = () => {
    if (socket) {
        socket.close();
        socket = null;
    }
};

// React Query API configuration
export const levelViewApi = {
    getAll: () => ({
        queryKey: ['levelViews'],
        queryFn: fetchAllLevelViews,
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 30, // 30 seconds
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: false,
    }),
    getById: (levelId: string) => ({
        queryKey: ['levelView', levelId],
        queryFn: () => fetchLevelViewById(levelId),
        staleTime: 1000 * 30, // 30 seconds
        refetchInterval: 1000 * 30, // 30 seconds
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: false,
    }),
    create: () => ({
        mutationFn: createLevelView,
    }),
    update: (levelId: string) => ({
        mutationFn: (data: any) => updateLevelView(levelId, data),
    }),
    delete: (levelId: string) => ({
        mutationFn: () => deleteLevelFromView(levelId),
    }),
};