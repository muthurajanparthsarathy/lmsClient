// topicService.ts - React Query version
import { http as apiClient } from "@/lib/http";
import { getToken as getCurrentToken } from "@/lib/session";

// Type definitions
interface Topic {
  _id: string;
  institution: string;
  courses: string;
  moduleId: string;
  subModuleId: string;
  title: string;
  description?: string;
  duration?: number;
  level?: string;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
  index?: number;
}

interface TopicCreateData {
  institution?: string;
  courses: string;
  moduleId: string;
  subModuleId: string;
  title: string;
  description?: string;
  duration?: number;
  level?: string;
  createdBy?: string;
}

interface TopicUpdateData {
  title?: string;
  description?: string;
  duration?: number;
  level?: string;
  updatedBy?: string;
  moduleId?: any;
  subModuleId?: any;
  courses?: any;
  index?: number;
}

// Basic fetch functions
export const fetchAllTopics = async (): Promise<Topic[]> => {
  const response = await apiClient.get('/topic/getAll');
  return response.data.topics || [];
};

export const fetchTopicsByModuleId = async (moduleId: string): Promise<Topic[]> => {
  const allTopics = await fetchAllTopics();
  return allTopics.filter(topic => topic.moduleId === moduleId);
};

export const fetchTopicsBySubModuleId = async (subModuleId: string): Promise<Topic[]> => {
  const allTopics = await fetchAllTopics();
  return allTopics.filter(topic => topic.subModuleId === subModuleId);
};

export const fetchTopicById = async (topicId: string): Promise<Topic> => {
  const response = await apiClient.get(`/topic/getByid/${topicId}`);
  return response.data;
};

export const createTopic = async (topicData: TopicCreateData): Promise<Topic> => {
  const response = await apiClient.post('/topic/create', topicData);
  return response.data;
};

export const updateTopic = async (topicId: string, topicData: TopicUpdateData): Promise<Topic> => {
  const response = await apiClient.put(`/topic/update/${topicId}`, topicData);
  return response.data;
};

export const deleteTopic = async (topicId: string): Promise<{ message: string }> => {
  const response = await apiClient.delete(`/topic/delete/${topicId}`);
  return response.data;
};

// WebSocket connection for real-time updates
let socket: WebSocket | null = null;

export const setupTopicsWebSocket = (
  onUpdate: (updatedTopic: Topic) => void,
  onDelete: (deletedTopicId: string) => void,
  onCreate: (newTopic: Topic) => void
) => {
  if (socket) return socket;

  const token = getCurrentToken();
  if (!token) {
    throw new Error('No authentication token available');
  }

  socket = new WebSocket(`ws://localhost:5533/topic/updates?token=${token}`);

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'topic_updated':
        onUpdate(data.topic);
        break;
      case 'topic_deleted':
        onDelete(data.topicId);
        break;
      case 'topic_created':
        onCreate(data.topic);
        break;
    }
  };

  socket.onclose = () => {
    console.log('Topics WebSocket disconnected');
    socket = null;
  };

  return socket;
};

export const closeTopicsWebSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};

// React Query API configuration
export const topicApi = {
  getAll: () => ({
    queryKey: ['topics'],
    queryFn: fetchAllTopics,
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  getByModuleId: (moduleId: string) => ({
    queryKey: ['topics', 'module', moduleId],
    queryFn: () => fetchTopicsByModuleId(moduleId),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  getBySubModuleId: (subModuleId: string) => ({
    queryKey: ['topics', 'subModule', subModuleId],
    queryFn: () => fetchTopicsBySubModuleId(subModuleId),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  getById: (topicId: string) => ({
    queryKey: ['topic', topicId],
    queryFn: () => fetchTopicById(topicId),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30, // 30 seconds
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  }),
  create: () => ({
    mutationFn: createTopic,
  }),
  update: () => ({
    mutationFn: ({ id, data }: { id: string, data: TopicUpdateData }) => 
      updateTopic(id, data),
  }),
  delete: (topicId: string) => ({
    mutationFn: () => deleteTopic(topicId),
  }),
};