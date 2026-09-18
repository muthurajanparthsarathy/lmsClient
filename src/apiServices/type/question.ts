export interface TitleAndDescription {
  text: string;
  imageUrl?: string | null;
  imageAlignment?: 'left' | 'center' | 'right';
  imageSizePercent?: number;
  _id?: string;
}

export interface MCQOption {
  id?: string;
  _id?: string;
  text: string;
  isCorrect: boolean;
  imageUrl?: string | null;
  imageAlignment?: 'left' | 'center' | 'right';
  imageSizePercent?: number;
}

export interface MatchingPair {
  id?: string;
  _id?: string;
  left: string;
  right: string;
}

export interface OrderingItem {
  id?: string;
  _id?: string;
  text: string;
  order: number;
}

export interface TestCase {
  _id?: string;
  input: string;
  expectedOutput: string;
  isSample?: boolean;
  isHidden?: boolean;
  points?: number;
  explanation?: string;
}

export interface Hint {
  _id?: string;
  hintText: string;
  pointsDeduction?: number;
  isPublic?: boolean;
  sequence?: number;
}

export interface Solution {
  _id?: string;
  startedCode?: string;
  functionName?: string;
  language?: string;
}

// Specific question type stored in the Question Bank.
// Lowercase values are the current convention; capitalised values exist in legacy data.
export type QuestionTypeValue =
  | 'mcq'
  | 'programming'
  | 'frontend'
  | 'database'
  | 'MCQ'
  | 'Programming';

export interface Question {
  _id?: string;
  questionCategory: string;
  questionType: QuestionTypeValue;
  isActive: boolean;
    questionTitle?: string;
options?: MCQOption[];
correctAnswer?: string;
  // MCQ fields
  mcqQuestionTitle?: string | TitleAndDescription;
  mcqQuestionDescription?: string | TitleAndDescription;
  mcqQuestionType?: string;
  mcqQuestionDifficulty?: string;
  mcqQuestionTimeLimit?: number;
  mcqQuestionOptionsPerRow?: number;
  mcqQuestionRequired?: boolean;
  mcqQuestionScore?: number;
  mcqQuestionOptions?: MCQOption[];
  mcqQuestionCorrectAnswers?: string[];
  
  // Type-specific
  trueFalseAnswer?: boolean | null;
  shortAnswer?: string;
  matchingPairs?: MatchingPair[];
  orderingItems?: OrderingItem[];
  numericAnswer?: number | null;
  numericTolerance?: number | null;
  hasExplanation?: boolean;
  explanation?: string;
  
  // Programming fields
  title?: string;
  description?: string;
  difficulty?: string;
  sampleInput?: string;
  sampleOutput?: string;
  score?: number;
  constraints?: string[];
  hints?: Hint[];
  testCases?: TestCase[];
  solutions?: Solution;
  timeLimit?: number;
  memoryLimit?: number;
  // Programming sub-type selector (UI only — questionType is the persisted discriminator)
  category?: 'core' | 'frontend' | 'database';
  // Database-specific
  sampleQuery?: string;
  expectedResult?: string;
  // Legacy sub-type flags still referenced by some assessment-flow components
  isFrontend?: boolean;
  isDatabase?: boolean;

  // Model/answer code (Create Question modal "Output Code")
  outputCode?: string;
  // Classification metadata (Create Question modal)
  problemType?: string | null;
  topics?: string[];
  tags?: string[];
  timeComplexity?: string;
  spaceComplexity?: string;
  // Question Source tag ('scratch-manual' | 'scratch-bank' | 'ai' | 'thirdParty')
  source?: string | null;

  // Metadata
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}


export interface QuestionBankResponse {
  success: boolean;
  total?: number;
  institution?: string;
  questions: Question[];
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}


export interface QuestionFormData {
  questionCategory: string;
  questionType: QuestionTypeValue;
  isActive: boolean;
  
  // MCQ Specific Fields
  questionTitle?: string;
  options?: string[];
  correctAnswer?: string;
  
  // Programming Specific Fields
  title?: string;
  description?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  sampleInput?: string;
  sampleOutput?: string;
  score?: number;
  constraints?: string[];
  hints?: Hint[];
  testCases?: TestCase[];
  solutions?: Solution;
  timeLimit?: number;
  memoryLimit?: number;
}