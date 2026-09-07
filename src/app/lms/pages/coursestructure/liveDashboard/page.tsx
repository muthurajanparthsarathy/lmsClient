"use client";

// Course Structure ▸ Live Dashboard.
//
// Passthrough that renders the SAME component as `/lms/pages/courses/
// liveDashboard`. The Live Dashboard used to live under `courses` only; a
// trainer who reached it via Course Structure (e.g. clicking Dashboard from
// the You Do Assessment kebab on `/lms/pages/coursestructure/
// uploadcourseresources`) hit a 404 because `sectionHref("liveDashboard")`
// legitimately produced `/lms/pages/coursestructure/liveDashboard`, which
// had no route. Mounting the same component here keeps the trainer inside
// the section they started in (breadcrumb, sidebar, back button all stay
// coherent) and matches the pattern already used by uploadcourseresources,
// reviewSubmission, and manageUsers.
export { default } from "@/app/lms/pages/courses/liveDashboard/page";
