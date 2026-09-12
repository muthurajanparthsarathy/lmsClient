import type { StudentProgress, TestStatus } from "../types/reports.types";

// Collapse the raw fields into the three-value status the Reports view
// renders. Kept identical to the original liveDashboard/StudentRow helper —
// same rules, same output — so the Reports table shows the same "Not Started
// / Started / Submitted" bucket a coordinator would see anywhere else.
//   submitted   → has submitted their attempt
//   started     → currently in the test live (inProgress)
//   not-started → everything else
export function deriveTestStatus(s: StudentProgress): TestStatus {
  if (s.submitted) return "submitted";
  if (s.inProgress) return "started";
  return "not-started";
}
