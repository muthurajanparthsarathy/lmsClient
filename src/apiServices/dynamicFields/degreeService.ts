// services/degreeService.ts
// types/degree.ts

export interface Department {
  _id?: string;
  departmentName: string;
  departmentCode: string;
  description?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface Degree {
  _id: string;
  institution: string;
  degreeName: string;
  degreeCode: string;
  numberOfSemesters: number;
  /** Degree length in years (e.g. B.Sc = 3, B.E = 4). Optional for legacy degrees. */
  duration?: number;
  description?: string;
  status: 'active' | 'inactive';
  departments: Department[];
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CreateDegreeRequest {
  degreeName: string;
  degreeCode: string;
  numberOfSemesters: number;
  duration?: number;
  description?: string;
  status?: 'active' | 'inactive';
  departments: Omit<Department, '_id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>[];
}

export interface UpdateDegreeRequest {
  degreeName?: string;
  degreeCode?: string;
  numberOfSemesters?: number;
  duration?: number;
  description?: string;
  status?: 'active' | 'inactive';
  departments?: Omit<Department, '_id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>[];
}

export interface AddDepartmentRequest {
  departmentName: string;
  departmentCode: string;
  description?: string;
  status?: 'active' | 'inactive';
}

export interface UpdateDepartmentRequest {
  departmentName?: string;
  departmentCode?: string;
  description?: string;
  status?: 'active' | 'inactive';
}

export interface ApiResponse<T = any> {
  message: Array<{ key: string; value: string }>;
  degree?: T;
  degrees?: T[];
  degreeById?: T;
  updatedDegree?: T;
  departments?: T[];
  getAllDepartments?: T[];
  departmentById?: T;
  updatedDepartment?: T;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

// Helper function to get auth token
const getAuthToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('smartcliff_token');
  }
  return null;
};

// Helper function for API calls
const apiCall = async <T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> => {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message?.[0]?.value || 'API request failed');
  }

  return response.json();
};

// ─── Degree APIs ──────────────────────────────────────────────────────────────

export const degreeService = {
  // Create Degree with departments
  createDegree: (data: CreateDegreeRequest) => {
    return apiCall<ApiResponse<Degree>>('/degrees/create', 'POST', data);
  },

  // Get all degrees
  getAllDegrees: () => {
    return apiCall<ApiResponse<Degree>>('/degrees/getAll', 'GET');
  },

  // Get degree by ID
  getDegreeById: (id: string) => {
    return apiCall<ApiResponse<Degree>>(`/degrees/getById/${id}`, 'GET');
  },

  // Update degree
  updateDegree: (id: string, data: UpdateDegreeRequest) => {
    return apiCall<ApiResponse<Degree>>(`/degrees/update/${id}`, 'PUT', data);
  },

  // Delete degree
  deleteDegree: (id: string) => {
    return apiCall<ApiResponse>(`/degrees/delete/${id}`, 'DELETE');
  },

  // ─── Department APIs ──────────────────────────────────────────────────────

  // Add department to degree
  addDepartment: (degreeId: string, data: AddDepartmentRequest) => {
    return apiCall<ApiResponse<Degree>>(
      `/degrees/${degreeId}/departments/add`,
      'POST',
      data
    );
  },

  // Get all departments of a degree
  getAllDepartments: (degreeId: string) => {
    return apiCall<ApiResponse<Department>>(
      `/degrees/${degreeId}/departments/getAll`,
      'GET'
    );
  },

  // Get department by ID
  getDepartmentById: (degreeId: string, departmentId: string) => {
    return apiCall<ApiResponse<Department>>(
      `/degrees/${degreeId}/departments/getById/${departmentId}`,
      'GET'
    );
  },

  // Update department
  updateDepartment: (
    degreeId: string,
    departmentId: string,
    data: UpdateDepartmentRequest
  ) => {
    return apiCall<ApiResponse<Department>>(
      `/degrees/${degreeId}/departments/update/${departmentId}`,
      'PUT',
      data
    );
  },

  // Remove department
  removeDepartment: (degreeId: string, departmentId: string) => {
    return apiCall<ApiResponse<Degree>>(
      `/degrees/${degreeId}/departments/remove/${departmentId}`,
      'DELETE'
    );
  },
};