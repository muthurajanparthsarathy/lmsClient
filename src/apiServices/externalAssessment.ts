// External Assessment API client.
//
// Uses `lib/apiClient` rather than the hard-coded `http://localhost:5533` +
// raw axios pattern the You_Do assessment services use: apiClient reads
// NEXT_PUBLIC_API_URL, attaches the bearer token, and normalises every failure
// into an ApiError with a real `.message` — so a 409 "already a participant"
// surfaces as that sentence in a toast instead of "Request failed with status
// code 409".

import { api } from "@/app/lms/pages/clientmanagement/lib/apiClient";

const ADMIN = "/api/admin/external";

// ─── Types ────────────────────────────────────────────────────────────────

export type ExternalAssessmentStatus = "draft" | "published" | "archived";

export type ExternalQuestionType =
  | "multiple_choice"
  | "multiple_select"
  | "true_false"
  | "short_answer"
  | "essay"
  | "dropdown"
  | "matching"
  | "ordering"
  | "numeric"
  | "checkboxes";

export interface ExternalQuestionOption {
  _id?: string;
  text: string;
  isCorrect?: boolean;
  imageUrl?: string | null;
}

/** Which authoring form produced a question, and which one reopens it. */
export type ExternalQuestionKind = 'mcq' | 'programming';

/** Where a question came from — drives the per-source quota badges. */
export type ExternalQuestionOrigin = 'scratch' | 'bank' | 'ai' | 'thirdParty' | 'document';

export interface ExternalTestCase {
  _id?: string;
  input: string;
  expectedOutput: string;
  isSample?: boolean;
  isHidden?: boolean;
  points?: number;
  explanation?: string;
}

export interface ExternalQuestion {
  _id?: string;
  questionKind?: ExternalQuestionKind;
  source?: ExternalQuestionOrigin;
  mcqQuestionType: ExternalQuestionType;
  mcqQuestionTitle: string;
  mcqQuestionDescription?: string;
  mcqQuestionLevel?: "easy" | "medium" | "hard";
  mcqQuestionScore?: number;
  mcqQuestionOptions?: ExternalQuestionOption[];
  mcqQuestionCorrectAnswers?: string[];
  trueFalseAnswer?: boolean | null;
  shortAnswer?: string;
  essayAnswer?: string;
  numericAnswer?: number | null;
  numericTolerance?: number | null;
  matchingPairs?: Array<{ _id?: string; left: string; right: string }>;
  orderingItems?: Array<{ _id?: string; text: string; order: number }>;

  // ── Programming (questionKind === 'programming') ──
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  executionMode?: 'function' | 'fullProgram';
  starterMode?: 'blank' | 'custom';
  starterCode?: string;
  solutionCode?: string;
  functionName?: string;
  language?: string;
  constraints?: string[];
  hints?: string[];
  sampleInput?: string;
  sampleOutput?: string;
  testCases?: ExternalTestCase[];
  timeLimit?: number;
  memoryLimit?: number;

  sequence?: number;
}

export interface ExternalAssessmentSettings {
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  maxAttempts?: number;
  negativeMarking?: boolean;
  negativeMarkPerWrong?: number;
  showResultToParticipant?: boolean;
  autoSubmitOnTimeout?: boolean;
}

// ─── Wizard field groups ──────────────────────────────────────────────────
// Mirror the server sub-schemas one-for-one. All optional: the wizard saves
// per step, so a payload carries only the group its step owns and the server
// merges it in.

export interface ExternalQuestionConfiguration {
  scoringType?: 'equalDistribution' | 'questionSpecific';
  totalQuestions?: number;
  marksPerQuestion?: number;
  attemptLimitEnabled?: boolean;
  submissionAttempts?: number;
  questionFlow?: 'freeFlow' | 'controlled';
  levelBasedEnabled?: boolean;
  levelCounts?: { easy?: number; medium?: number; hard?: number };
}

export interface ExternalLevelCounts {
  easy?: number;
  medium?: number;
  hard?: number;
}

/** Programming / Other configuration — the LMS code-question config shape. */
export interface ExternalCodeConfig {
  questionConfigType?: 'general' | 'levelBased' | 'selectionLevel';
  generalQuestionCount?: number;
  levelBasedCounts?: ExternalLevelCounts;
  selectionLevelCounts?: ExternalLevelCounts;
  levelMarks?: ExternalLevelCounts;
  questionFlow?: 'freeFlow' | 'controlled';
  attemptLimitEnabled?: boolean;
  submissionAttempts?: number;
  // No allowedLanguages — the Skill Set on Step 1 (`selectedLanguages`) is the
  // single place a paper's languages are chosen.
}

/** Manual · AI Automation · Other Platform. */
export type ExternalSourceKey = 'scratch' | 'ai' | 'thirdParty';

export type ExternalSourceCounts = Partial<Record<ExternalSourceKey, number>>;

/** Per-difficulty (or single `general`) split of the question count by source. */
export interface ExternalCustomDistribution {
  general?: ExternalSourceCounts;
  easy?: ExternalSourceCounts;
  medium?: ExternalSourceCounts;
  hard?: ExternalSourceCounts;
}

export interface ExternalEvaluationMethod {
  method?: 'manual' | 'testcase' | 'ai';
  ai?: {
    criteria?: string[];
    testCasesCountMode?: 'common' | 'perQuestion';
    testCasesCount?: number;
  };
}

export interface ExternalAdditionalOptions {
  anonymousSubmissions?: boolean;
  hideGraderIdentity?: boolean;
}

export interface ExternalScheduleExtras {
  cutOffEnabled?: boolean;
  cutOffDate?: string | null;
  cutOffTime?: string;
  gracePeriodEnabled?: boolean;
  gracePeriodMinutes?: number;
}

export interface ExternalSecuritySettings {
  preventTabSwitch?: boolean;
  maxTabSwitches?: number;
  preventCopyPaste?: boolean;
  preventBrowserClose?: boolean;
  enableFaceVerification?: boolean;
  multipleFaceDetection?: boolean;
  faceWarningLimit?: number;
  recordScreen?: boolean;
  autoSubmitOnTimeout?: boolean;
  warnBeforeTimeout?: boolean;
  warningSeconds?: number;
  requireFullscreen?: boolean;
  preventDevTools?: boolean;
  preventRightClick?: boolean;
  preventPrinting?: boolean;
  preventPageRefresh?: boolean;
  preventBackNavigation?: boolean;
}

export interface ExternalNotificationSettings {
  notifyOnInvite?: boolean;
  notifyOnSubmission?: boolean;
  notifyBeforeStart?: boolean;
  reminderHoursBefore?: number;
  notifyOnResult?: boolean;
}

export interface ExternalGradeBand {
  _id?: string;
  label: string;
  fromPercent: number;
  toPercent: number;
}

export interface ExternalGradeSettings {
  enablePassMark?: boolean;
  gradeBandsEnabled?: boolean;
  gradeBands?: ExternalGradeBand[];
}

export interface ExternalSection {
  _id?: string;
  name: string;
  description?: string;
  order?: number;
  totalMarks?: number;
  totalDuration?: number;
  questionCount?: number;
}

export interface ExternalAssessment {
  _id: string;
  /** Display reference (EX###). Read-only — stamped by the server on create. */
  assessmentCode?: string;
  assessmentName: string;
  description?: string;
  instructions?: string;

  // Step 1 — Exercise Details
  testType?: 'mock' | 'final' | 'practice';
  exerciseType?: 'MCQ' | 'Programming' | 'Combined' | 'Other' | 'SectionBased';
  exerciseLevel?: 'beginner' | 'intermediate' | 'expert';
  selectedModule?: string;
  selectedLanguages?: string[];
  isSectionBased?: boolean;
  sectionBasedDuration?: boolean;
  sections?: ExternalSection[];

  // Steps 2–3
  /** The MCQ half of the configuration. */
  questionConfiguration?: ExternalQuestionConfiguration;
  programmingConfig?: ExternalCodeConfig;
  othersConfig?: ExternalCodeConfig;
  evaluationMethod?: ExternalEvaluationMethod;
  /** Combined splits the total between the two halves. */
  totalMarksMCQ?: number;
  totalMarksProgramming?: number;
  /** Manual / AI Automation / Other Platform — a set, not one choice. */
  questionSources?: ExternalSourceKey[];
  customDistribution?: ExternalCustomDistribution;
  /** Legacy scalar, mirrored from questionSources[0] server-side. */
  questionSource?: 'scratch' | 'bank' | 'ai' | 'thirdParty' | 'mixed' | null;

  // Step 4 — Schedule
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string;
  endTime?: string;
  startAt?: string | null;
  endAt?: string | null;
  durationMinutes?: number;
  scheduleExtras?: ExternalScheduleExtras;

  // Steps 5–7
  securitySettings?: ExternalSecuritySettings;
  notificationSettings?: ExternalNotificationSettings;
  gradeSettings?: ExternalGradeSettings;
  additionalOptions?: ExternalAdditionalOptions;
  totalMarks?: number;
  passingMarks?: number;

  status: ExternalAssessmentStatus;
  settings?: ExternalAssessmentSettings;
  questions?: ExternalQuestion[];
  totalQuestions?: number;
  participantCount?: number;
  /** Wizard steps already saved, by title. */
  stepsSaved?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ExternalParticipant {
  _id: string;
  assessment: string;
  firstName: string;
  lastName?: string;
  fullName?: string;
  email: string;
  phone?: string;
  source?: "form" | "bulk_upload";
  invitationStatus: "pending" | "sent" | "failed";
  invitationSentAt?: string | null;
  invitationError?: string;
  attemptStatus: "not_started" | "in_progress" | "submitted" | "expired";
  lastAttemptAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  isPassed?: boolean | null;
  createdAt?: string;
}

/** One rejected row from a bulk upload. `row` is the sheet's own row number. */
export interface BulkRowError {
  row: number | null;
  email: string;
  reason: string;
}

export interface BulkUploadResult {
  summary: { total: number; valid: number; invalid: number; imported?: number; emailed?: number };
  errors: BulkRowError[];
  preview?: Array<{ firstName: string; lastName: string; email: string; phone: string }>;
}

// Server envelope. Every endpoint in this module returns { success, message, data }.
interface Envelope<T> {
  success: boolean;
  message?: string;
  data: T;
}

// ─── Assessments ──────────────────────────────────────────────────────────

export const externalAssessmentApi = {
  list: (params: { search?: string; status?: string; page?: number; limit?: number } = {}) =>
    api
      .get<Envelope<{ assessments: ExternalAssessment[]; total: number }>>(
        `${ADMIN}/assessments`,
        { params }
      )
      .then((r) => r.data),

  get: (id: string) =>
    api.get<Envelope<ExternalAssessment>>(`${ADMIN}/assessments/${id}`).then((r) => r.data),

  create: (body: Partial<ExternalAssessment>) =>
    api.post<Envelope<ExternalAssessment>>(`${ADMIN}/assessments`, body).then((r) => r.data),

  update: (id: string, body: Partial<ExternalAssessment>) =>
    api.put<Envelope<ExternalAssessment>>(`${ADMIN}/assessments/${id}`, body).then((r) => r.data),

  remove: (id: string) => api.del<Envelope<null>>(`${ADMIN}/assessments/${id}`),

  // ─── Questions ──────────────────────────────────────────────────────────

  listQuestions: (id: string) =>
    api
      .get<Envelope<{ questions: ExternalQuestion[]; totalMarks: number; totalQuestions: number; assessmentName: string }>>(
        `${ADMIN}/assessments/${id}/questions`
      )
      .then((r) => r.data),

  addQuestion: (id: string, question: ExternalQuestion) =>
    api
      .post<Envelope<{ question: ExternalQuestion; totalQuestions: number; totalMarks: number }>>(
        `${ADMIN}/assessments/${id}/questions`,
        question
      )
      .then((r) => r.data),

  updateQuestion: (id: string, questionId: string, question: Partial<ExternalQuestion>) =>
    api
      .put<Envelope<{ question: ExternalQuestion; totalQuestions: number; totalMarks: number }>>(
        `${ADMIN}/assessments/${id}/questions/${questionId}`,
        question
      )
      .then((r) => r.data),

  deleteQuestion: (id: string, questionId: string) =>
    api.del<Envelope<{ totalQuestions: number; totalMarks: number }>>(
      `${ADMIN}/assessments/${id}/questions/${questionId}`
    ),

  // ─── Participants ───────────────────────────────────────────────────────

  listParticipants: (id: string, params: { search?: string; attemptStatus?: string } = {}) =>
    api
      .get<Envelope<{ participants: ExternalParticipant[]; total: number }>>(
        `${ADMIN}/assessments/${id}/participants`,
        { params }
      )
      .then((r) => r.data),

  addParticipant: (
    id: string,
    body: { firstName: string; lastName?: string; email: string; phone?: string }
  ) =>
    api.post<Envelope<{ participant: ExternalParticipant; emailed: boolean }>>(
      `${ADMIN}/assessments/${id}/participants`,
      body
    ),

  /**
   * Upload a participant sheet.
   *
   * `validateOnly` runs the server's dry run: every row is checked and
   * reported, nothing is written. The Participants UI always calls this first
   * so the admin approves the import before it happens.
   */
  bulkUpload: (id: string, file: File, validateOnly = false) => {
    const form = new FormData();
    form.append("file", file);
    // Not api.putForm — this is a POST, and axios sets the multipart boundary
    // itself when handed a FormData, so Content-Type is deliberately omitted.
    return api.post<Envelope<BulkUploadResult> & { message?: string }>(
      `${ADMIN}/assessments/${id}/participants/bulk-upload${validateOnly ? "?mode=validate" : ""}`,
      form,
      { headers: { "Content-Type": undefined as unknown as string } }
    );
  },

  deleteParticipant: (id: string, participantId: string) =>
    api.del<Envelope<null>>(`${ADMIN}/assessments/${id}/participants/${participantId}`),

  resendInvitation: (id: string, participantId: string) =>
    api.post<Envelope<{ participant: ExternalParticipant }>>(
      `${ADMIN}/assessments/${id}/participants/${participantId}/invite`
    ),

  sendPendingInvitations: (id: string) =>
    api.post<Envelope<{ attempted: number; emailed: number; failures: Array<{ email: string; reason: string }> }>>(
      `${ADMIN}/assessments/${id}/invitations`
    ),

  getParticipantLink: (id: string, participantId: string) =>
    api
      .get<Envelope<{ link: string; expiresAt: string }>>(
        `${ADMIN}/assessments/${id}/participants/${participantId}/link`
      )
      .then((r) => r.data),

  results: (id: string) =>
    api
      .get<Envelope<{ results: Array<ExternalParticipant & { attempt: any }>; total: number }>>(
        `${ADMIN}/assessments/${id}/results`
      )
      .then((r) => r.data),
};

// ─── Query keys ───────────────────────────────────────────────────────────
// One factory so every mutation invalidates the exact keys the screens read.
// The You_Do feature has no equivalent (it refetches by hand), which is why
// its caches go stale after a write.

export const externalAssessmentKeys = {
  all: ["externalAssessments"] as const,
  lists: () => [...externalAssessmentKeys.all, "list"] as const,
  list: (params: Record<string, unknown>) => [...externalAssessmentKeys.lists(), params] as const,
  detail: (id: string) => [...externalAssessmentKeys.all, "detail", id] as const,
  questions: (id: string) => [...externalAssessmentKeys.all, "questions", id] as const,
  participants: (id: string, params: Record<string, unknown> = {}) =>
    [...externalAssessmentKeys.all, "participants", id, params] as const,
  results: (id: string) => [...externalAssessmentKeys.all, "results", id] as const,
};
