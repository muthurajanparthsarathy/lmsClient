"use client";

// Courses ▸ Grades: /lms/pages/courses/grades/<courseId>
//
// A thin wrapper, NOT a re-export. The flow lives in `GradesFlow` because it
// is also embedded — the We_Do Assignment and You_Do Assessment "Grade"
// actions render it in place, passing courseId/exerciseId as props. A Next.js
// `page.tsx` default export must satisfy `PageProps` ({ params, searchParams }),
// so a component declaring its own props cannot BE the page export; rendering
// it from a prop-less page component satisfies both callers.
//
// With no props the flow reads its context from the URL and wraps itself in
// the trainer inside Courses for the rest of the drill.
import GradesFlow from "@/app/lms/pages/grades/GradesFlow";

export default function Page() {
  return <GradesFlow />;
}
