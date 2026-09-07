// pedagogyViewService.ts - React Query version
import { http as apiClient } from "@/lib/http";
import { getToken as getCurrentToken } from "@/lib/session";
 
 
// Type definitions
interface PedagogyActivityItem {
  type: string;
  duration: number;
  _id?: any;
}
 
interface Pedagogy {
  _id: boolean;
  module: string[];
  subModule: string[];
  topic: string[];
  subTopic: string[];
  iDo: PedagogyActivityItem[];
  weDo: PedagogyActivityItem[];
  youDo: PedagogyActivityItem[];
  createdAt?: Date;
  updatedAt?: Date;
}
 
interface PedagogyView {
  _id: string;
  institution: string;
  courses: string;
  pedagogies: Pedagogy[];
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
}
 
interface PedagogyViewCreateData {
  institution?: string;
  courses: string;
  pedagogies: Pedagogy[];
  createdBy?: string;
}
 
interface PedagogyViewUpdateData {
  institution?: string;
  courses?: string;
  pedagogies?: Pedagogy[];
  updatedBy?: string;
}
 
interface DeleteDocumentResponse {
  message: string;
}
interface DuplicateCourseHierarchyData {
  duplicateCourseId: string;
  newCourseId: string;
  institutionId?: string;
  createdBy?: string;
  duplicate: ('Module' | 'SubModule' | 'Topic' | 'SubTopic' | 'LevelView' | 'PedagogyView')[];
  selectedModules?: string[];
}
 
interface DuplicateCourseHierarchyResponse {
  message: Array<{ key: string; value: string }>;
  modulesCloned: number;
  subModulesCloned: number;
  topicsCloned: number;
  subTopicsCloned: number;
  levelViewsCloned: number;
  pedagogyViewsCloned: number;
}
 
// Basic fetch functions
export const fetchAllPedagogyViews = async (): Promise<PedagogyView[]> => {
  const response = await apiClient.get('/pedagogy-view/getAll');
  return response.data.pedagogyViews || [];
};
 
export const fetchPedagogyViewById = async (id: string): Promise<PedagogyView> => {
  const response = await apiClient.get(`/pedagogy-view/getByid/${id}`);
  return response.data.pedagogyView;
};
 
export const createPedagogyView = async (pedagogyViewData: PedagogyViewCreateData): Promise<PedagogyView> => {
  const response = await apiClient.post('/pedagogy-view/create', pedagogyViewData);
  return response.data;
};
 
export const updatePedagogyView = async (id: string, pedagogyViewData: PedagogyViewUpdateData): Promise<PedagogyView> => {
  const response = await apiClient.put(`/pedagogy-view/update/${id}`, pedagogyViewData);
  return response.data;
};
 
export const deleteDocument = async (
  model: 'Module1' | 'SubModule1' | 'Topic1' | 'SubTopic1' | 'pedagogy-view' | 'PedagogyView1',
  id: string
): Promise<DeleteDocumentResponse> => {
  const response = await apiClient.delete(`/delete/${model}/${id}`, {
    timeout: 60000
  });
  return response.data;
};
 
export const deletePedagogyView = async (
  activityType: string,
  itemId: string
): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/pedagogy-view/delete/${activityType}/${itemId}`, {
    timeout: 60000
  });
  return response.data;
};
export const duplicateCourseHierarchy = async (
  duplicateData: DuplicateCourseHierarchyData
): Promise<DuplicateCourseHierarchyResponse> => {
  const response = await apiClient.post('/dupicate-date', duplicateData, {
    timeout: 60000
  });
  return response.data;
};
// WebSocket connection for real-time updates
let socket: WebSocket | null = null;
 
export const setupPedagogyViewsWebSocket = (
  onUpdate: (updatedPedagogyView: PedagogyView) => void,
  onDelete: (deletedPedagogyViewId: string) => void,
  onCreate: (newPedagogyView: PedagogyView) => void
) => {
  if (socket) return socket;
 
  const token = getCurrentToken();
  if (!token) {
    throw new Error('No authentication token available');
  }
 
  socket = new WebSocket(`ws://localhost:5533/pedagogy-view/updates?token=${token}`);
 
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'pedagogy_view_updated':
        onUpdate(data.pedagogyView);
        break;
      case 'pedagogy_view_deleted':
        onDelete(data.pedagogyViewId);
        break;
      case 'pedagogy_view_created':
        onCreate(data.pedagogyView);
        break;
    }
  };
 
  socket.onclose = () => {
    console.log('Pedagogy views WebSocket disconnected');
    socket = null;
  };
 
  return socket;
};
 
export const closePedagogyViewsWebSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};
 
// React Query API configuration
export const pedagogyViewApi = {
  getAll: () => ({
    queryKey: ['pedagogyViews'],
    queryFn: fetchAllPedagogyViews,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  getById: (id: string) => ({
    queryKey: ['pedagogyView', id],
    queryFn: () => fetchPedagogyViewById(id),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  create: () => ({
    mutationFn: createPedagogyView,
  }),
  update: (id: string) => ({
    mutationFn: (data: PedagogyViewUpdateData) => updatePedagogyView(id, data),
  }),
  delete: (activityType: string, itemId: string) => ({
    mutationFn: () => deletePedagogyView(activityType, itemId),
  }),
  deleteDocument: (model: 'Module1' | 'SubModule1' | 'Topic1' | 'SubTopic1' | 'pedagogy-view' | 'PedagogyView1', id: string) => ({
    mutationFn: () => deleteDocument(model, id),
  }),
  duplicateCourseHierarchy: () => ({
    mutationFn: duplicateCourseHierarchy,
  }),
};
 