// Rerun API — batches re-scoring of stored submissions against the CURRENT
// question test cases / AI prompt. All heavy work (code execution, AI eval)
// happens client-side in the batch runner; this file is just the thin fetch
// binding for the two server endpoints.

import axios from 'axios';
import { getToken } from '@/lib/session';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5533';

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  'Content-Type': 'application/json',
});

// ── Types mirror the server contract in answer.js:rerunSubmissions ─────────
export interface RerunTestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  points?: number;
}

export interface RerunQuestion {
  _id: string;
  title: string;
  difficulty?: string | null;
  testCases: RerunTestCase[];
  sampleInput?: string;
  sampleOutput?: string;
  constraints?: string[];
  score?: number;
  lastEditedAfterSubmissionAt?: string | null;
  submissionCount: number;
}

export interface RerunSubmission {
  userId: string;
  userName: string;
  userEmail: string;
  questionId: string;
  codeAnswer: string;
  language: string;
  currentScore: number;
  currentStatus: string;
  hasBreakdown: boolean;
  currentBreakdownMethod: 'testcase' | 'ai' | 'manual' | null;
}

export interface RerunContext {
  success: boolean;
  exerciseId: string;
  evaluationMethod: { method: 'testcase' | 'ai' | 'manual'; [k: string]: unknown } | null;
  questions: RerunQuestion[];
  submissions: RerunSubmission[];
}

export interface RerunUpdate {
  userId: string;
  questionId: string;
  score: number;
  status: 'solved' | 'attempted' | 'submitted' | 'evaluated';
  // Same shape submitAnswer accepts; see UserModel.evaluationBreakdownSchema.
  evaluationBreakdown?: {
    method: 'testcase' | 'ai';
    testcase?: {
      passed: number;
      total: number;
      // Per-case results so Review can show which cases failed.
      cases?: Array<{ index: number; passed: boolean; hidden: boolean; input: string; expectedOutput: string; actualOutput: string }>;
    };
    ai?: unknown;
  };
  note?: string;
}

export interface RerunBatchRequest {
  courseId: string;
  exerciseId: string;
  category: 'I_Do' | 'We_Do' | 'You_Do';
  subcategory: string;
  nodeId: string;
  nodeType: string;
  updates: RerunUpdate[];
  clearFlagsForQuestionIds?: string[];
}

export interface RerunBatchResponse {
  success: boolean;
  updated: number;
  failed: Array<{ userId: string; questionId: string; reason: string }>;
  flagsCleared: number;
}

export const rerunApi = {
  async getContext(params: {
    exerciseId: string;
    courseId: string;
    category: string;
    subcategory: string;
    nodeId: string;
    nodeType: string;
  }): Promise<RerunContext> {
    const { exerciseId, ...query } = params;
    const res = await axios.get<RerunContext>(
      `${BASE_URL}/courses/exercises/${exerciseId}/rerun-context`,
      { params: query, headers: authHeaders() }
    );
    return res.data;
  },

  async submit(batch: RerunBatchRequest): Promise<RerunBatchResponse> {
    const res = await axios.post<RerunBatchResponse>(
      `${BASE_URL}/courses/answers/rerun`,
      batch,
      { headers: authHeaders() }
    );
    return res.data;
  },
};
