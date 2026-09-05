// pedagogyStructureService.ts - React Query version
import { http as apiClient } from "@/lib/http";
import { getToken as getCurrentToken } from "@/lib/session";

// Type definitions
interface PedagogyActivityItem {
    type: string;
    duration: number;
    _id?: any;
}

interface PedagogyStructure {
    _id: string;
    institution: string;
    I_Do: PedagogyActivityItem[];
    We_Do: PedagogyActivityItem[];
    You_Do: PedagogyActivityItem[];
    createdAt: Date;
    createdBy?: string;
    updatedAt: Date;
    updatedBy?: string;
}

interface PedagogyStructureCreateData {
    I_Do?: PedagogyActivityItem[];
    We_Do?: PedagogyActivityItem[];
    You_Do?: PedagogyActivityItem[];
    createdBy?: string;
}

interface PedagogyStructureUpdateData {
    I_Do?: PedagogyActivityItem[];
    We_Do?: PedagogyActivityItem[];
    You_Do?: PedagogyActivityItem[];
    updatedBy?: string;
}

interface ArrayElementUpdateData {
    section: 'I_Do' | 'We_Do' | 'You_Do';
    // elementId: string;
    index: number;
    newValue: PedagogyActivityItem;
}

interface ArrayElementDeleteData {
    section: 'I_Do' | 'We_Do' | 'You_Do';
    index: number;
}

// Basic fetch functions
export const fetchAllPedagogyStructures = async (): Promise<PedagogyStructure[]> => {
    const response = await apiClient.get('/dynamic/pedagogy/getAll');
    return response.data.data || [];
};

export const fetchPedagogyStructureById = async (id: string): Promise<PedagogyStructure> => {
    const response = await apiClient.get(`/dynamic/pedagogy/getById/${id}`);
    return response.data.data;
};

export const createPedagogyStructure = async (pedagogyStructureData: PedagogyStructureCreateData): Promise<PedagogyStructure> => {
    const response = await apiClient.post('/dynamic/pedagogy/create', pedagogyStructureData);
    return response.data.data;
};

export const updatePedagogyStructureArrayElement = async (
    id: string,
    updateData: ArrayElementUpdateData
): Promise<PedagogyStructure> => {
    const response = await apiClient.put(`/dynamic/pedagogy/update/${id}`, updateData);
    return response.data.data;
};

export const deletePedagogyStructureArrayElement = async (
    id: string,
    deleteData: ArrayElementDeleteData
): Promise<PedagogyStructure> => {
    const response = await apiClient.delete(`/dynamic/pedagogy/delete/${id}`, {
        data: deleteData
    });
    return response.data.data;
};

// WebSocket connection for real-time updates
let socket: WebSocket | null = null;

export const setupPedagogyStructuresWebSocket = (
    onUpdate: (updatedPedagogyStructure: PedagogyStructure) => void,
    onDelete: (deletedPedagogyStructureId: string) => void,
    onCreate: (newPedagogyStructure: PedagogyStructure) => void
) => {
    if (socket) return socket;

    const token = getCurrentToken();
    if (!token) {
        throw new Error('No authentication token available');
    }

    socket = new WebSocket(`ws://localhost:5533/dynamic/pedagogy/updates?token=${token}`);

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'pedagogy_structure_updated':
                onUpdate(data.pedagogyStructure);
                break;
            case 'pedagogy_structure_deleted':
                onDelete(data.pedagogyStructureId);
                break;
            case 'pedagogy_structure_created':
                onCreate(data.pedagogyStructure);
                break;
        }
    };

    socket.onclose = () => {
        console.log('Pedagogy structures WebSocket disconnected');
        socket = null;
    };

    return socket;
};

export const closePedagogyStructuresWebSocket = () => {
    if (socket) {
        socket.close();
        socket = null;
    }
};

// React Query API configuration.
// The old 30s foreground+background poll ran while any consumer was mounted
// (7 consumers, incl. the always-mounted service-mapping wizard) — pure waste
// for a resource that changes only through the settings' own mutations, which
// already invalidate this key locally. Rely on that + a 5-minute staleTime;
// cross-tab admin edits arrive on next mount or focus.
export const pedagogyStructureApi = {
    getAll: () => ({
        queryKey: ['pedagogyStructures'],
        queryFn: fetchAllPedagogyStructures,
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    }),
    getById: (id: string) => ({
        queryKey: ['pedagogyStructure', id],
        queryFn: () => fetchPedagogyStructureById(id),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
    }),
    create: () => ({
        mutationFn: createPedagogyStructure,
    }),
    updateArrayElement: (id: string) => ({
        mutationFn: (data: ArrayElementUpdateData) => updatePedagogyStructureArrayElement(id, data),
    }),
    deleteArrayElement: (id: string) => ({
        mutationFn: (data: ArrayElementDeleteData) => deletePedagogyStructureArrayElement(id, data),
    }),
};