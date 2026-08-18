"use client";

// Course Structure ▸ Manage Users.
//
// Same component as `/lms/pages/courses/manageUsers`, not a copy of it — see
// the note in `coursestructure/uploadcourseresources/page.tsx` for why forking
// these screens went wrong last time. Every link the page builds goes through
// `useSectionHref`, so arriving here from Course Structure keeps Reports,
// Check Answer and Back inside Course Structure.
export { default } from "@/app/lms/pages/courses/manageUsers/page";
