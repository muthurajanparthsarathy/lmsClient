"use client";

// Course Structure ▸ Review Submission.
//
// This route renders the SAME component as `/lms/pages/courses/
// reviewSubmission` rather than a copy of it. There used to be a second,
// hand-forked implementation here (kept as `page.legacy.tsx.bak`) and it had
// drifted badly — roughly half the size of the Courses one, with no MCQ
// review, no frontend/code review panes, no Notion answer viewer, no rerun,
// and none of the react-query caching. A trainer who opened a submission from
// Course Structure was grading in an older console than a trainer who opened
// the same submission from Courses.
//
// The only thing the fork actually needed was a different Back target, and the
// shared page now derives that from the current section (`useSectionBase`), so
// there is nothing left to fork for.
export { default } from "@/app/lms/pages/courses/reviewSubmission/page";
