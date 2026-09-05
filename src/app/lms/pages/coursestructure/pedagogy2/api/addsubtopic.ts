// subTopicService.ts - React Query version
import { http as apiClient } from "@/lib/http";
import { getToken as getCurrentToken } from "@/lib/session";

// Type definitions
interface SubTopic {
  subModuleId: any;
  moduleId: any;
  _id: string;
  institution: string;
  courses: string;
  topicId: string;
  title: string;
  description?: string;
  duration?: number;
  level?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  index?: number;
  updatedBy?: string;
}

interface SubTopicCreateData {
  institution?: string;
  courses: string;
  topicId: string;
  title: string;
  description?: string;
  duration?: number;
  level?: string;
  index?: number;
  createdBy?: string;
}

interface SubTopicUpdateData {
  title?: string;
  description?: string;
  duration?: number;
  level?: string;
  updatedBy?: string;
  topicId?: any;
  index?: number;
  courses?: any;
}

// Basic fetch functions
export const fetchAllSubTopics = async (): Promise<SubTopic[]> => {
  const response = await apiClient.get('/sub-topic/getAll');
  return response.data.subTopics || [];
};

export const fetchSubTopicsByTopicId = async (topicId: string): Promise<SubTopic[]> => {
  const allSubTopics = await fetchAllSubTopics();
  return allSubTopics.filter(subTopic => subTopic.topicId === topicId);
};

export const fetchSubTopicById = async (subTopicId: string): Promise<SubTopic> => {
  const response = await apiClient.get(`/sub-topic/getByid/${subTopicId}`);
  return response.data;
};

export const createSubTopic = async (subTopicData: SubTopicCreateData): Promise<SubTopic> => {
  const response = await apiClient.post('/sub-topic/create', subTopicData);
  return response.data;
};

export const updateSubTopic = async (subTopicId: string, subTopicData: SubTopicUpdateData): Promise<SubTopic> => {
  const response = await apiClient.put(`/sub-topic/update/${subTopicId}`, subTopicData);
  return response.data;
};

export const deleteSubTopic = async (subTopicId: string): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/sub-topic/delete/${subTopicId}`);
  return response.data;
};

// WebSocket connection for real-time updates
let socket: WebSocket | null = null;

export const setupSubTopicsWebSocket = (
  onUpdate: (updatedSubTopic: SubTopic) => void,
  onDelete: (deletedSubTopicId: string) => void,
  onCreate: (newSubTopic: SubTopic) => void
) => {
  if (socket) return socket;

  const token = getCurrentToken();
  if (!token) {
    throw new Error('No authentication token available');
  }

  socket = new WebSocket(`ws://localhost:5533/sub-topic/updates?token=${token}`);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'subTopic_updated':
        onUpdate(data.subTopic);
        break;
      case 'subTopic_deleted':
        onDelete(data.subTopicId);
        break;
      case 'subTopic_created':
        onCreate(data.subTopic);
        break;
    }
  };

  socket.onclose = () => {
    console.log('SubTopics WebSocket disconnected');
    socket = null;
  };

  return socket;
};

export const closeSubTopicsWebSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};

// React Query API configuration
export const subTopicApi = {
  getAll: () => ({
    queryKey: ['subTopics'],
    queryFn: fetchAllSubTopics,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  getByTopicId: (topicId: string) => ({
    queryKey: ['subTopics', 'byTopic', topicId],
    queryFn: () => fetchSubTopicsByTopicId(topicId),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  getById: (subTopicId: string) => ({
    queryKey: ['subTopic', subTopicId],
    queryFn: () => fetchSubTopicById(subTopicId),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  create: () => ({
    mutationFn: createSubTopic,
  }),
  update: () => ({
    mutationFn: ({ id, data }: { id: string, data: SubTopicUpdateData }) => 
      updateSubTopic(id, data),
  }),
  delete: (subTopicId: string) => ({
    mutationFn: () => deleteSubTopic(subTopicId),
  }),
};