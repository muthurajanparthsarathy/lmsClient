import axios from 'axios';

const BASE_URL = 'http://localhost:5533';

const getToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('smartcliff_token') : null;

const authHeaders = () => {
  const token = getToken();
  if (!token) throw new Error('No authentication token found. Please log in again.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
};

export interface RetestRequestRecord {
  _id: string;
  courseId: string;
  exerciseId: string;
  exerciseName?: string;
  subcategory?: string;
  nodeId?: string;
  nodeType?: string;
  studentId: string;
  studentName?: string;
  studentEmail?: string;
  message: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  retestStart?: string | null;
  retestEnd?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateRetestPayload {
  courseId: string;
  exerciseId: string;
  exerciseName?: string;
  subcategory?: string;
  nodeId?: string;
  nodeType?: string;
  message: string;
}

export interface UnlockPayload {
  targetUserId: string;
  courseId: string;
  exerciseId: string;
  subcategory: string;
  category?: string;
  exerciseName?: string;
  retestStart?: string | null;
  retestEnd?: string | null;
  requestId?: string;
}

export interface EnrolledStudent {
  _id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profile?: string;
  role?: string;
  status?: string;
  exerciseProgress?: {
    status: string;
    overallScore?: number;
    submittedAt?: string;
    questionsAttempted?: number;
    questionsTotal?: number;
  } | null;
}

export const retestApi = {
  // Student → create a retest request
  createRequest: async (payload: CreateRetestPayload) => {
    const res = await axios.post(`${BASE_URL}/retest/request`, payload, {
      headers: authHeaders(),
      timeout: 30000,
    });
    return res.data;
  },

  // Coordinator → all requests for an assessment (Request List tab)
  getRequests: async (courseId: string, exerciseId: string, status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await axios.get(
      `${BASE_URL}/retest/requests/${courseId}/${exerciseId}${q}`,
      { headers: authHeaders(), timeout: 30000 }
    );
    return res.data;
  },

  // Student → their own requests for a course (to disable duplicates)
  getMyRequests: async (courseId: string, exerciseId?: string) => {
    const q = exerciseId ? `?exerciseId=${encodeURIComponent(exerciseId)}` : '';
    const res = await axios.get(`${BASE_URL}/retest/my-requests/${courseId}${q}`, {
      headers: authHeaders(),
      timeout: 30000,
    });
    return res.data;
  },

  // Coordinator → unlock an assessment for a student (reset + per-student window)
  unlock: async (payload: UnlockPayload) => {
    const res = await axios.post(`${BASE_URL}/retest/unlock`, payload, {
      headers: authHeaders(),
      timeout: 30000,
    });
    return res.data;
  },

  // Coordinator → all students enrolled for an exercise (Users List tab)
  getEnrolledStudents: async (
    courseId: string,
    exerciseId: string,
    params?: { search?: string; page?: number; limit?: number }
  ) => {
    const sp = new URLSearchParams();
    sp.append('includeProgress', 'true');
    if (params?.search) sp.append('search', params.search);
    sp.append('page', String(params?.page ?? 1));
    sp.append('limit', String(params?.limit ?? 100));
    const res = await axios.get(
      `${BASE_URL}/exercises/${courseId}/${exerciseId}/students?${sp.toString()}`,
      { headers: authHeaders(), timeout: 30000 }
    );
    return res.data;
  },
};
