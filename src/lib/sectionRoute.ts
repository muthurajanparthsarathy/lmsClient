"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";

/**
 * Which SECTION of the LMS the user is working inside.
 *
 * Several screens are reachable from two places and are mounted by two routes
 * that render the same component:
 *
 *   /lms/pages/courses/<screen>          ← reached from the Courses list
 *   /lms/pages/coursestructure/<screen>  ← reached from Course Structure
 *
 * Hard-coding `/lms/pages/courses/...` in those screens' navigation throws a
 * user who came in through Course Structure over to Courses mid-task — the
 * breadcrumb, the sidebar and the back button all suddenly describe a section
 * they never opened. Building links off `sectionBase()` keeps a journey inside
 * the section it started in.
 *
 * Only screens that EXIST under both prefixes may be linked this way. Live
 * Dashboard and Live Screens, for example, live under `courses` only, so they
 * stay absolute.
 */
export const SECTION_COURSES = "/lms/pages/courses";
export const SECTION_COURSE_STRUCTURE = "/lms/pages/coursestructure";

/** Screens that have a route under BOTH section prefixes. */
export const SHARED_SECTION_SCREENS = [
  "uploadcourseresources",
  "reviewSubmission",
  "manageUsers",
  "manageUsers/reports",
] as const;

export const sectionBaseFor = (pathname: string | null | undefined): string =>
  (pathname || "").startsWith(SECTION_COURSE_STRUCTURE)
    ? SECTION_COURSE_STRUCTURE
    : SECTION_COURSES;

/**
 * The current section's base path, e.g. "/lms/pages/coursestructure".
 * Anything outside Course Structure — including screens reached directly —
 * falls back to Courses, which is what every link did before this existed.
 */
export const useSectionBase = (): string => sectionBaseFor(usePathname());

/**
 * `sectionHref("manageUsers")` → "/lms/pages/coursestructure/manageUsers".
 *
 * Stable across renders while the section does not change, so callers can list
 * it in `useCallback`/`useMemo` deps without re-creating their handlers.
 */
export const useSectionHref = (): ((screen: string) => string) => {
  const base = useSectionBase();
  return useCallback((screen: string) => `${base}/${screen.replace(/^\/+/, "")}`, [base]);
};
