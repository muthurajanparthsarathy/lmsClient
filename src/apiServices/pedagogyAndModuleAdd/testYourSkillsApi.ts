// apiServices/youDoMcqApi.ts

import axios from "axios";

export interface MCQOption {
  text: string;
  isCorrect: boolean;
  imageUrl?: string | null;
  imageAlignment?: 'left' | 'center' | 'right';
  imageSizePercent?: number;
}

export interface MatchingPair {
  left: string;
  right: string;
}

export interface OrderingItem {
  text: string;
  order: number;
}

export interface YouDoQuestion {
  _id?: string;
  questionType: string;
  mcqQuestionTitle: string;
  mcqQuestionDescription?: string;
  mcqQuestionType: 'multiple_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay' | 'dropdown' | 'matching' | 'ordering' | 'numeric';
  mcqQuestionDifficulty?: 'easy' | 'medium' | 'hard';
  mcqQuestionScore: number;
  mcqQuestionTimeLimit?: number;
  mcqQuestionOptions?: MCQOption[];
  mcqQuestionCorrectAnswers?: string[];
  trueFalseAnswer?: boolean | null;
  shortAnswer?: string;
  numericAnswer?: number | null;
  numericTolerance?: number | null;
  matchingPairs?: MatchingPair[];
  orderingItems?: OrderingItem[];
  mcqQuestionOptionsPerRow?: number;
  mcqQuestionRequired?: boolean;
  hasOtherOption?: boolean;
  hasExplanation?: boolean;
  explanation?: string;
  mcqQuestionImageUrl?: string | null;
  mcqQuestionImageAlignment?: 'left' | 'center' | 'right';
  mcqQuestionImageSizePercent?: number;
  isActive?: boolean;
  sequence?: number;
}

export interface CreateYouDoTestRequest {
  title: string;
  description?: string;
  timeLimit?: number;
  passingScore?: number;
  attemptLimit?: number;
  shuffleQuestions?: boolean;
  showResults?: boolean;
  pointsPerQuestion?: number;
  questionsData: Omit<YouDoQuestion, '_id' | 'sequence'>[];
}

// Model mapping
const modelMap: Record<string, { path: string }> = {
  module: { path: "modules" },
  modules: { path: "modules" },
  submodule: { path: "submodules" },
  submodules: { path: "submodules" },
  topic: { path: "topics" },
  topics: { path: "topics" },
  subtopic: { path: "subtopics" },
  subtopics: { path: "subtopics" },
};

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5533";

const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('smartcliff_token');
  }
  return null;
};

export const getEntityTypeFromNodeType = (nodeType: string): string => {
  const mapping: Record<string, string> = {
    'module': 'modules',
    'modules': 'modules',
    'submodule': 'submodules',
    'submodules': 'submodules',
    'topic': 'topics',
    'topics': 'topics',
    'subtopic': 'subtopics',
    'subtopics': 'subtopics'
  };
  return mapping[nodeType?.toLowerCase()] || 'topics';
};

export const youDoMcqApi = {
  createTest: async (
    entityType: string,
    entityId: string,
    itemKey: string,
    testData: CreateYouDoTestRequest
  ) => {
    const token = getToken();
    const path = modelMap[entityType]?.path;
    
    if (!path) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const response = await axios.post(
      `${BASE_URL}/you-do/createquestion/${path}/${entityId}/you-do/${itemKey}/mcq`,
      testData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },


  // NEW: Get all questions across all tests
  getAllQuestions: async (entityType: string, entityId: string) => {
    const token = getToken();
    const path = modelMap[entityType]?.path;
    
    if (!path) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const response = await axios.get(
      `${BASE_URL}/you-do/getAllQuestions/${path}/${entityId}/you-do`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },

  getTest: async (entityType: string, entityId: string, itemKey: string) => {
    const token = getToken();
    const path = modelMap[entityType]?.path;
    
    if (!path) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const response = await axios.get(
      `${BASE_URL}/you-do/getQuestion/${path}/${entityId}/you-do/${itemKey}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },

  deleteTest: async (entityType: string, entityId: string, itemKey: string) => {
    const token = getToken();
    const path = modelMap[entityType]?.path;
    
    if (!path) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const response = await axios.delete(
      `${BASE_URL}/you-do/deleteQuestion/${path}/${entityId}/you-do/${itemKey}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },
// apiServices/youDoMcqApi.ts - Update the updateQuestion function

updateQuestion: async (
  entityType: string,
  entityId: string,
  itemKey: string,
  questionId: string,
  questionData: any
) => {
  const token = getToken();
  const path = modelMap[entityType]?.path;
  
  if (!path) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }
  
  const response = await axios.put(
    `${BASE_URL}/you-do/updateQuestion/${path}/${entityId}/you-do/${itemKey}/question/${questionId}`,
    questionData,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
},
  deleteQuestion: async (
    entityType: string,
    entityId: string,
    itemKey: string,
    questionId: string
  ) => {
    const token = getToken();
    const path = modelMap[entityType]?.path;
    
    if (!path) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const response = await axios.delete(
      `${BASE_URL}/you-do/deleteQuestion/${path}/${entityId}/you-do/${itemKey}/question/${questionId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.data;
  },

  submitTest: async (
    entityType: string,
    entityId: string,
    itemKey: string,
    answers: Array<{
      questionId: string;
      selectedOption?: string;
      selectedOptions?: string[];
      answerText?: string;
    }>,
    userId?: string,
    studentName?: string
  ) => {
    const token = getToken();
    const path = modelMap[entityType]?.path;
    
    if (!path) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }
    
    const response = await axios.post(
      `${BASE_URL}/you-do/submitTest/${path}/${entityId}/you-do/${itemKey}`,
      { answers, userId, studentName },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  },
};