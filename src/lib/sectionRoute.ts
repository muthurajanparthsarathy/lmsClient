"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  SECTION_COURSES,
  SECTION_COURSE_STRUCTURE,
} from "@/app/lms/shared/navRoutes";

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
 * Screens still lives under `courses` only and must stay absolute; Live
 * Dashboard is now mounted under BOTH prefixes (see
 * `app/lms/pages/coursestructure/liveDashboard/page.tsx`) so it may be
 * linked through sectionHref like the other shared screens.
 */
// The two section prefixes and the list of screens mounted under both now
// live in `shared/navRoutes.ts`, because the ROUTE GATE needs them too and
// that file is the React-free one the gate and the login redirects import.
// Re-exported here so every existing `@/lib/sectionRoute` importer is
// unchanged — and so the gate and these links can never disagree about which
// screens are mirrored.
export {
  SECTION_COURSES,
  SECTION_COURSE_STRUCTURE,
  SHARED_SECTION_SCREENS,
} from "@/app/lms/shared/navRoutes";

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
