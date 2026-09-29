"use client";

import React, { Suspense } from "react";

import CourseReport from "./CourseReport";

// Course Actions ▸ Report. Mounted under both /lms/pages/courses/courseReport
// and /lms/pages/coursestructure/courseReport (a re-export), so sectionHref
// keeps the trainer inside the section they opened it from.
export default function CourseReportPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[13px] text-gray-400">Loading…</div>}>
      <CourseReport />
    </Suspense>
  );
}
