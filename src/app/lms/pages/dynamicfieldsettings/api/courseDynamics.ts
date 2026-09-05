// courseDynamicsService.ts - React Query version
import { http as apiClient } from "@/lib/http";
import { getToken as getCurrentToken } from "@/lib/session";
 
 
 
// Types
export interface ServiceModal {
  _id: string;
  services: string;
  serviceDetails: Service | null;
  // Add other modal properties as needed
  [key: string]: any;
}
 
export interface Service {
  _id: string;
  // Add service properties as needed
  [key: string]: any;
}
 
export interface Category {
  _id: string;
  // Add category properties as needed
  [key: string]: any;
}
 
export interface Client {
  _id: string;
  // Add client properties as needed
  [key: string]: any;
}
 
export interface CourseStructureDynamic {
  _id: string;
  institution: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  clients: Client[];
  categories: Category[];
  services: Service[];
  serviceModals: ServiceModal[];
}
 
export interface CourseStructureResponse {
  success: boolean;
  message: string;
  data: CourseStructureDynamic;
  counts: {
    clients: number;
    categories: number;
    services: number;
    serviceModals: number;
    total: number;
  };
}
 
// Fetch function for course dynamics
export const fetchAllCourseDynamics = async (): Promise<CourseStructureResponse> => {
  const response = await apiClient.get('/getAll/course-dynamic');
  return response.data;
};
 
// React Query API configuration
export const courseDynamicsApi = {
  getAll: () => ({
    queryKey: ['courseDynamics'],
    queryFn: fetchAllCourseDynamics,
    staleTime: 1000 * 30, // 30 seconds - data becomes stale after this time
    refetchInterval: 1000 * 30, // 30 seconds - auto refetch interval
    refetchIntervalInBackground: true, // Continue refetching when tab is not active
    refetchOnWindowFocus: false, // Don't refetch on window focus (since we're polling)
  }),
};
 
// WebSocket connection for real-time updates (optional)
let socket: WebSocket | null = null;
 
export const setupCourseDynamicsWebSocket = (
  onUpdate: (updatedStructure: CourseStructureDynamic) => void,
  onDelete: (deletedStructureId: string) => void,
  onCreate: (newStructure: CourseStructureDynamic) => void
) => {
  if (socket) return socket;
 
  const token = getCurrentToken();
  if (!token) {
    throw new Error('No authentication token available');
  }
 
  socket = new WebSocket(`ws://localhost:5533/course-dynamic/updates?token=${token}`);
 
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'course_dynamic_updated':
        onUpdate(data.courseStructure);
        break;
      case 'course_dynamic_deleted':
        onDelete(data.courseStructureId);
        break;
      case 'course_dynamic_created':
        onCreate(data.courseStructure);
        break;
    }
  };
 
  socket.onclose = () => {
    console.log('Course dynamics WebSocket disconnected');
    socket = null;
  };
 
  return socket;
};
 
export const closeCourseDynamicsWebSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};
 