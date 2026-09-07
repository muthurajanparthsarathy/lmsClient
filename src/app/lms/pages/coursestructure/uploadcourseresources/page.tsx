"use client";

// Course Structure ▸ Upload Resources.
//
// This route renders the SAME component as `/lms/pages/courses/
// uploadcourseresources` rather than a copy of it. There used to be a second,
// hand-forked implementation here (kept as `page.legacy.tsx.bak`); it drifted
// behind the courses one and never learned Resources-by-Batch, so a trainer who
// arrived through Course Structure uploaded into the shared course-level
// container while a trainer who arrived through Courses uploaded into the batch.
// Two screens, same job, silently different results.
//
// Sharing the component means both routes get identical UI, identical
// create / update / delete behaviour, and the batch strip (I Do / We Do / You Do
// filed per batch) automatically. The only thing that differs is the back
// breadcrumb, which the component derives from the pathname — see
// `useParentSection` in the shared page.
export { default } from "@/app/lms/pages/courses/uploadcourseresources/page";
