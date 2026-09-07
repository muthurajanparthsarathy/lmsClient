import { getAuthToken } from './hooks/useProblemSolving';

export interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
  isPublic: boolean;
  description?: string;
}

export interface Example {
  id: string;
  input: string;
  output: string;
  explanation?: string;
}

export interface Hint {
  id: string;
  text: string;
}

export interface ProgrammingQuestion {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
  memoryLimit: number;
  testCases: TestCase[];
  starterCode: string;
  solutionCode: string;
  language: string;
  tags: string[];
  functionName: string;
  parameters: string[];
  enabled: boolean;
  examples: Example[];
  hints: Hint[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ProgrammingQuestionsResponse {
  data: ProgrammingQuestion[];
  message?: { key: string; value: string }[];
  success?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SingleQuestionResponse {
  data: ProgrammingQuestion;
  message?: { key: string; value: string }[];
  success?: boolean;
}

// API service functions
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message?.[0]?.value || 
      `HTTP error! status: ${response.status}` ||
      'Request failed'
    );
  }
  return response.json();
};

// Create Programming Question
export const createProgrammingQuestion = async (question: Omit<ProgrammingQuestion, '_id' | 'id' | 'createdAt' | 'updatedAt'>): Promise<SingleQuestionResponse> => {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found');

  const response = await fetch(`${API_BASE_URL}/problem-solving/create`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(question)
  });

  return handleResponse(response);
};

// Get All Programming Questions
export const getAllProgrammingQuestions = async (
  page: number = 1,
  limit: number = 10,
  filters: {
    search?: string;
    difficulty?: string;
    status?: string;
    language?: string;
  } = {}
): Promise<ProgrammingQuestionsResponse> => {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found');

  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...filters
  });

  const response = await fetch(`${API_BASE_URL}/problem-solving/getAll?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return handleResponse(response);
};

// Get Programming Question by ID
export const getProgrammingQuestionById = async (id: string): Promise<SingleQuestionResponse> => {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found');

  const response = await fetch(`${API_BASE_URL}/problem-solving/getById/${id}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return handleResponse(response);
};

// Update Programming Question
export const updateProgrammingQuestion = async (id: string, question: Partial<ProgrammingQuestion>): Promise<SingleQuestionResponse> => {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found');

  const response = await fetch(`${API_BASE_URL}/problem-solving/update/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(question)
  });

  return handleResponse(response);
};

// Delete Programming Question
export const deleteProgrammingQuestion = async (id: string): Promise<{ message: { key: string; value: string }[] }> => {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found');

  const response = await fetch(`${API_BASE_URL}/problem-solving/delete/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return handleResponse(response);
};

// Toggle Question Status
export const toggleQuestionStatus = async (id: string, enabled: boolean): Promise<SingleQuestionResponse> => {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found');

  const response = await fetch(`${API_BASE_URL}/problem-solving/toggle-status/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ enabled })
  });

  return handleResponse(response);
};

// Execute Code
export const executeCode = async (data: {
  code: string;
  language: string;
  testCases: TestCase[];
  functionName: string;
  parameters: string[];
}): Promise<any> => {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication token not found');

  const response = await fetch(`${API_BASE_URL}/problem-solving/execute-code`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  return handleResponse(response);
};