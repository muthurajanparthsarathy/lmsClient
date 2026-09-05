import axios from 'axios';
import { Question, QuestionBankResponse, ApiResponse } from '../../../../../apiServices/type/question';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://lmsserver-yeve.onrender.com';

const questionBankApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token interceptor
questionBankApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartcliff_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Clean payload for simple question format (Programming family & Simple MCQ).
// `questionType` carries the specific type: 'mcq' | 'programming' | 'frontend' | 'database'
// (legacy capitalised values are tolerated). MCQ rich questions go through FormData instead.
const cleanSimpleQuestionPayload = (question: Partial<Question>): Partial<Question> => {
  const { questionType } = question;
  const isMcq = (questionType || '').toLowerCase() === 'mcq';

  const baseFields: Partial<Question> = {
    questionCategory: question.questionCategory || '',
    questionType,
    isActive: question.isActive ?? true,
  };

  if (isMcq) {
    // The premium Create MCQ modal builds the full `mcqQuestion*` payload
    // (mcqQuestionTitle, mcqQuestionType, mcqQuestionOptions, …); the older
    // MCQFields modal built `questionTitle` / `options` / `correctAnswer`.
    // The original cleaner picked ONLY the legacy trio, which silently threw
    // every mcqQuestion* field away — the server then rejected the request
    // with "MCQ question title text is required" even after the user typed a
    // valid title. Pass the whole authored payload through and let the server
    // build the processedQuestion from it — the server already picks only
    // what it stores.
    return { ...question, ...baseFields };
  }

  // Programming family: programming (core) / frontend / database
  const cleanedQuestion: Partial<Question> = {
    ...baseFields,
    title: question.title || '',
    description: question.description || '',
    difficulty: question.difficulty || 'medium',
    sampleInput: question.sampleInput || '',
    sampleOutput: question.sampleOutput || '',
    score: question.score || 0,
    category: question.category || 'core',
  };

  // Database-specific fields
  if (question.sampleQuery) {
    cleanedQuestion.sampleQuery = question.sampleQuery;
  }
  if (question.expectedResult) {
    cleanedQuestion.expectedResult = question.expectedResult;
  }

  // Constraints (frontend / core / database) — send a plain array of non-empty strings
  if (Array.isArray(question.constraints) && question.constraints.length > 0) {
    cleanedQuestion.constraints = question.constraints.filter(c => c && c.trim() !== '');
  }

  if (Array.isArray(question.hints) && question.hints.length > 0) {
    cleanedQuestion.hints = question.hints.filter(h => h.hintText?.trim() !== '');
  }

  if (Array.isArray(question.testCases) && question.testCases.length > 0) {
    cleanedQuestion.testCases = question.testCases.filter(t =>
      t.input?.trim() !== '' || t.expectedOutput?.trim() !== ''
    );
  }

  if (question.solutions &&
      (question.solutions.startedCode?.trim() !== '' ||
       question.solutions.functionName?.trim() !== '')) {
    cleanedQuestion.solutions = question.solutions;
  }

  return cleanedQuestion;
};

export const questionBankService = {
  // Get all questions with filters
  // Passing `page` switches the endpoint into its paginated mode: the server
  // applies the Question Bank page's own filter predicate and sort and returns
  // one slice, plus the facets that page derives from the full bank. Without
  // `page` the response is the original full questions[] array, unchanged —
  // the authoring picker still reads it that way.
  //
  // `questionType` means different things on the two paths: an exact match on
  // the stored discriminator without `page`, and the page's broad MCQ /
  // Programming bucket with it. Same for `difficulty` (`mcqQuestionDifficulty`
  // vs `difficulty`). See the controller for why.
  getAllQuestions: async (filters?: {
    questionType?: string;
    category?: string;
    difficulty?: string;
    isActive?: boolean | string;
    page?: number;
    limit?: number;
    search?: string;
    createdBy?: string;
    marks?: string;
    // Epoch ms. Computed in the browser because the Created-Date presets are
    // derived from the user's local clock.
    createdAfter?: number;
    // When set, restrict results to questions pinned to this course (Course
    // Specific tab → Manage). Absent → General bank.
    courseId?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString());
        }
      });
    }
    
    const token = localStorage.getItem("smartcliff_token");
    const response = await questionBankApi.get<QuestionBankResponse>(
      `/getAll/question-bank${params.toString() ? `?${params.toString()}` : ''}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );
    return response.data;
  },

  // Other Platform bank — separate collection, same response shape.
  //
  // Passing `page` switches the endpoint into its paginated mode: the server
  // applies the picker's own filters, returns ONE page plus the filter rail's
  // facets counted over the whole type-scoped set, and reports `total`.
  // Without `page` it returns every question exactly as it always did.
  getAllOtherPlatformQuestions: async (filters?: {
    questionType?: string;
    category?: string;
    difficulty?: string;
    // Accept both — the picker passes a boolean (always true), the admin
    // External page passes the dropdown's string value ('' | 'true' | 'false').
    // The server treats it as `isActive === 'true'` either way.
    isActive?: boolean | string;
    page?: number;
    limit?: number;
    search?: string;
    problemTypes?: string;
    railDifficulty?: string;
    topic?: string;
    tag?: string;
    sort?: string;
    // Admin External-page-only filter — the picker never sends it.
    createdBy?: string;
    // 'admin' tells the endpoint this caller renders none of the picker's
    // filter-rail facets, which is what lets it serve the page as an indexed
    // skip/limit instead of reading the whole collection to count them.
    facets?: 'admin';
  }) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, value.toString());
        }
      });
    }
    const token = localStorage.getItem("smartcliff_token");
    const response = await questionBankApi.get<QuestionBankResponse>(
      `/getAll/other-platform-bank${params.toString() ? `?${params.toString()}` : ''}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );
    return response.data;
  },

  // Get single question by ID
  getQuestionById: async (id: string) => {
    const token = localStorage.getItem("smartcliff_token");
    const response = await questionBankApi.get<ApiResponse<Question>>(
      `/getById/question-bank/${id}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );
    return response.data;
  },

  // ✅ NEW: Create MCQ question with FormData (Rich Editor)
  createMCQQuestionWithImages: async (formData: FormData) => {
    try {
      const token = localStorage.getItem("smartcliff_token");
      
      console.log('📤 Sending MCQ FormData to backend...');
      
      const response = await axios.post(
        `${API_BASE_URL}/create/question-bank`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          timeout: 60000, // 60 seconds for image uploads
        }
      );
      
      console.log('✅ MCQ question created successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error creating MCQ question with images:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  },

  // ✅ NEW: Update MCQ question with FormData (Rich Editor)
  updateMCQQuestionWithImages: async (id: string, formData: FormData) => {
    try {
      const token = localStorage.getItem("smartcliff_token");
      
      console.log(`📤 Updating MCQ question ${id} with FormData...`);
      
      const response = await axios.put(
        `${API_BASE_URL}/update/question-bank/${id}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
          timeout: 60000,
        }
      );
      
      console.log('✅ MCQ question updated successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Error updating MCQ question with images:', error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      throw error;
    }
  },

  // ✅ Create question (Handles both simple JSON and FormData)
  createQuestion: async (question: Partial<Question> | FormData) => {
    // Check if it's FormData (coming from MCQFields)
    if (question instanceof FormData) {
      return questionBankService.createMCQQuestionWithImages(question);
    }
    
    // Otherwise, it's a simple JSON payload (Programming or Simple MCQ)
    const token = localStorage.getItem("smartcliff_token");
    
    // Clean the payload before sending
    const cleanedQuestion = cleanSimpleQuestionPayload(question);
    
    console.log('📤 Sending simple question payload:', cleanedQuestion);
    
    const response = await questionBankApi.post<ApiResponse<Question>>(
      '/create/question-bank',
      cleanedQuestion,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );
    return response.data;
  },

  // ✅ Update question (Handles both simple JSON and FormData)
  updateQuestion: async (id: string, question: Partial<Question> | FormData) => {
    // Check if it's FormData (coming from MCQFields)
    if (question instanceof FormData) {
      return questionBankService.updateMCQQuestionWithImages(id, question);
    }
    
    // Otherwise, it's a simple JSON payload
    const token = localStorage.getItem("smartcliff_token");
    
    // Clean the payload before sending
    const cleanedQuestion = cleanSimpleQuestionPayload(question);
    
    console.log(`📤 Updating question ${id} with simple payload:`, cleanedQuestion);
    
    const response = await questionBankApi.put<ApiResponse<Question>>(
      `/update/question-bank/${id}`,
      cleanedQuestion,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );
    return response.data;
  },

  // Toggle question status
  toggleQuestionStatus: async (id: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem("smartcliff_token");
      
      const response = await questionBankApi.put<ApiResponse<Question>>(
        `/toggle-status/question-bank/${id}`,
        { isActive },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        }
      );
      
      return response.data;
    } catch (error: any) {
      console.error('Error in toggleQuestionStatus:', error.response?.data || error.message);
      throw error;
    }
  },

  // Delete question (soft delete)
  deleteQuestion: async (id: string) => {
    const token = localStorage.getItem("smartcliff_token");
    const response = await questionBankApi.delete<ApiResponse<void>>(
      `/deletes/question-bank/${id}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      }
    );
    return response.data;
  },

  // ── Other Platform (External) bank — Create / Update / Delete / Toggle ─────
  // JSON-only. The External bank has no image-upload path yet (its imports are
  // Programming questions — Exercism, competitive programming — none of which
  // carry option / description images). MCQ image uploads on External are
  // blocked at the modal layer, not here.
  createOtherPlatformQuestion: async (question: Partial<Question>) => {
    const token = localStorage.getItem("smartcliff_token");
    const cleaned = cleanSimpleQuestionPayload(question);
    const response = await questionBankApi.post<ApiResponse<Question>>(
      '/create/other-platform-bank',
      cleaned,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return response.data;
  },

  updateOtherPlatformQuestion: async (id: string, question: Partial<Question>) => {
    const token = localStorage.getItem("smartcliff_token");
    const cleaned = cleanSimpleQuestionPayload(question);
    const response = await questionBankApi.put<ApiResponse<Question>>(
      `/update/other-platform-bank/${id}`,
      cleaned,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return response.data;
  },

  deleteOtherPlatformQuestion: async (id: string) => {
    const token = localStorage.getItem("smartcliff_token");
    const response = await questionBankApi.delete<ApiResponse<void>>(
      `/deletes/other-platform-bank/${id}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return response.data;
  },

  toggleOtherPlatformQuestionStatus: async (id: string, isActive: boolean) => {
    const token = localStorage.getItem("smartcliff_token");
    const response = await questionBankApi.put<ApiResponse<Question>>(
      `/toggle-status/other-platform-bank/${id}`,
      { isActive },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      },
    );
    return response.data;
  },
};