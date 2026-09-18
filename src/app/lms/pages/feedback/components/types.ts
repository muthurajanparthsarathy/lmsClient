// Shared row/sort types for the student Feedback listing — the same
// components/types.ts split User Management uses, so page.tsx and the table
// agree on one shape.

export type SortDir = "asc" | "desc";

export type SortKey = "title" | "course" | "trainer" | "start" | "end" | "status";

export type FeedbackRow = {
  id: string;
  title: string;
  course: string;
  courseId: string;
  trainer: string;
  batch: string;
  startISO: string;
  endISO: string;
  /** The form's own window — drives the Open / Closed pill. */
  active: boolean;
  /** This student already has a response document on the form. */
  submitted: boolean;
};
