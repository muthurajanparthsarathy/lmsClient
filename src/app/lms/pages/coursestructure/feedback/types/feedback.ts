// types/feedback.ts
export type QuestionType = 'text' | 'rating';

// Visual style of a rating answer — chosen by the admin per question,
// rendered identically by the student-facing modal so what's picked here is
// what students see. Stored value is still 1..maxRating regardless of style.
export type RatingStyle = 'number' | 'star' | 'emoji';

export interface RatingConfig {
  minRating: number;
  maxRating: number;
  ratingLabels?: string[];
  // Form-level rating type — number / star / emoji. Rating questions default
  // to this style.
  ratingStyle?: RatingStyle;
  // 'single': every rating question uses ratingStyle. 'custom': each question
  // picks its style from allowedRatingStyles.
  ratingMode?: 'single' | 'custom';
  allowedRatingStyles?: RatingStyle[];
}

export interface FeedbackQuestion {
  questionText: string;
  questionType: QuestionType;
  isRequired: boolean;
  order?: number;
  ratingConfig?: RatingConfig;
  ratingStyle?: RatingStyle;
  placeholder?: string;
  maxLength?: number;
  category?: string;
}

export interface Feedback {
  _id: string;
  courseId: string;
  // Batch of the course this form belongs to — picked (mandatory) when the
  // form is created; the list page groups forms under it.
  batchId?: string | null;
  batchName?: string;
  trainerId?: string | null;
  trainerName?: string;
  trainerEmail?: string;
  feedbackTitle: string;
  feedbackDescription: string;
  questions: FeedbackQuestion[];
  // Form-level rating scale set at creation; rating questions inherit it.
  ratingScale?: RatingConfig;
  studentResponses: any[];
  statistics: {
    totalStudents: number;
    averageRating: number;
    responseRate: number;
    questionStats: any[];
  };
  isActive: boolean;
  isPublished: boolean;
  startDate: string;
  endDate: string | null;
  // Extra submission window after endDate — students can still respond
  // until this date; gracePeriodDays is the day count between the two.
  gracePeriodEndDate?: string | null;
  gracePeriodDays?: number;
  isAnonymousAllowed: boolean;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CreateFeedbackPayload {
  courseId: string;
  batchId?: string | null;
  batchName: string;
  trainerId?: string | null;
  trainerName?: string;
  trainerEmail?: string;
  feedbackTitle: string;
  feedbackDescription?: string;
  questions: FeedbackQuestion[];
  ratingScale?: RatingConfig;
  isPublished?: boolean;
  startDate?: string;
  endDate?: string;
  gracePeriodEndDate?: string;
  gracePeriodDays?: number;
  isAnonymousAllowed?: boolean;
  maxAttempts?: number;
}

export interface UpdateFeedbackPayload {
  batchId?: string | null;
  batchName?: string;
  trainerId?: string | null;
  trainerName?: string;
  trainerEmail?: string;
  feedbackTitle?: string;
  feedbackDescription?: string;
  questions?: FeedbackQuestion[];
  ratingScale?: RatingConfig;
  isPublished?: boolean;
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  gracePeriodEndDate?: string;
  gracePeriodDays?: number;
  isAnonymousAllowed?: boolean;
  maxAttempts?: number;
}

export interface ToggleStatusPayload {
  isActive?: boolean;
  isPublished?: boolean;
}

export interface FeedbackResponse {
  message: Array<{ key: string; value: string }>;
  data?: Feedback;
  getAllFeedback?: Feedback[];
  feedbackById?: Feedback;
  updated_feedback?: Feedback;
}

export interface FeedbackStatistics {
  _id: string;
  feedbackTitle: string;
  totalStudents: number;
  averageRating: number;
  responseRate: number;
  questionStats: Array<{
    questionId: string;
    questionText: string;
    totalResponses: number;
    responses: string[];
  }>;
  summary: any;
}