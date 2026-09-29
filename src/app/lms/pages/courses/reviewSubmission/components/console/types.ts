// Shared prop contracts for the Grading Console shell.
//
// Every component under `components/console` is PRESENTATIONAL: it receives
// already-derived view data plus callbacks and renders pixels. All the fetching,
// scoring and persistence still lives in `reviewSubmission/page.tsx`, which is
// what keeps the console from re-forking into a second, drifting grading screen
// the way `coursestructure/reviewSubmission` once did.

import type { ReactNode } from "react";

export type QuestionKind = "CODE" | "MCQ" | "FRONTEND" | "OTHERS";
export type Difficulty = "easy" | "medium" | "hard" | "";

/** One row of the left-hand Assessment Questions list. */
export interface ConsoleQuestion {
  id: string;
  /** 0-based position inside the *unfiltered* exercise question list — this is
   *  what `handleQuestionClick` expects, so it must survive filtering. */
  index: number;
  /** 1-based number shown in the row ("1.", "2." …). */
  number: number;
  title: string;
  kind: QuestionKind;
  difficulty: Difficulty;
  score: number;
  maxScore: number;
  hasSubmission: boolean;
}

export interface ConsoleBreadcrumb {
  label: string;
  /** Tooltip text — used by the collapsed "…" crumb to list what it hides. */
  title?: string;
  icon?: ReactNode;
  onClick?: () => void;
}

export interface ConsoleStudent {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  initials: string;
}

/** One row of the Submission History table. */
export interface SubmissionAttempt {
  attempt: number;
  submittedOn: string;
  status: string;
  testCasesPassed: number | null;
  testCasesTotal: number | null;
  mark: number;
  maxMark: number;
}

export type CodeTabId = "editor" | "problem" | "testcases" | "solution";

/** One file of a submission. `path` is the student's real path — the file
 *  explorer builds its folder tree from these, never from invented folders. */
export interface ConsoleFile {
  /** Full path as submitted, e.g. "src/services/UserService.java". */
  path: string;
  /** Last path segment, e.g. "UserService.java". */
  name: string;
  language: string;
  content: string;
  isEntryPoint?: boolean;
}

export interface ConsoleTestCase {
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  explanation?: string;
}
