"use client";

import Link from "next/link";
import { usePocSummary } from "@/features/poc/hooks/use-poc-scope";
import {
  PocPage,
  PocEmpty,
  PocLoading,
  PocError,
  PocStat,
  PocTable,
} from "@/features/poc/components/PocShell";

export default function PocDashboardPage() {
  const { loading, error, isEmpty, stats, courses, clients, attendance } = usePocSummary();

  return (
    <PocPage
      title="POC Dashboard"
      subtitle="Your assigned courses, clients and delivery activity."
    >
      {error ? (
        <PocError message={(error as Error).message} />
      ) : loading ? (
        <PocLoading rows={3} />
      ) : isEmpty ? (
        <PocEmpty
          title="No courses assigned yet"
          message="Your courses, clients, attendance and reports appear here once an administrator enrols you into a course."
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <PocStat label="Courses" value={stats.totalCourses} hint="assigned to you" />
            <PocStat label="Active" value={stats.activeCourses} hint="training in progress" />
            <PocStat label="Completed" value={stats.completedCourses} hint="window ended" />
            <PocStat label="Clients" value={stats.clients} />
            <PocStat label="Services" value={stats.services} />
            <PocStat label="Learners" value={stats.students} />
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-heading">Course-wise delivery</h2>
              <Link href="/lms/pages/coursestructure" className="text-xs text-muted underline">
                My Courses
              </Link>
            </div>
            <PocTable head={["Course", "Client", "Batches", "Learners", "Training window"]}>
              {attendance.map((c) => (
                <tr key={c._id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3 font-medium text-heading">{c.courseName || "—"}</td>
                  <td className="px-4 py-3 text-body">{c.clientName || "—"}</td>
                  <td className="px-4 py-3 tabular-nums text-body">{c.batches?.length ?? 0}</td>
                  <td className="px-4 py-3 tabular-nums text-body">{c.totalStudents ?? 0}</td>
                  <td className="px-4 py-3 text-body">
                    {c.hasSchedule ? `${c.trainingStart || "—"} → ${c.trainingEnd || "—"}` : "Not scheduled"}
                  </td>
                </tr>
              ))}
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    None of your courses has a training schedule yet.
                  </td>
                </tr>
              ) : null}
            </PocTable>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-heading">Your clients</h2>
              <PocTable head={["Client", "Model", "Status"]}>
                {clients.map((c) => (
                  <tr key={c._id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 font-medium text-heading">{c.clientCompany || "—"}</td>
                    <td className="px-4 py-3 text-body">{c.businessModel || "—"}</td>
                    <td className="px-4 py-3 text-body">{c.status || "—"}</td>
                  </tr>
                ))}
              </PocTable>
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-heading">Recently assigned</h2>
              <PocTable head={["Course", "Code", "Level"]}>
                {courses.slice(0, 6).map((c) => (
                  <tr key={c._id} className="border-b border-hairline last:border-0">
                    <td className="px-4 py-3 font-medium text-heading">{c.courseName || "—"}</td>
                    <td className="px-4 py-3 text-body">{c.courseCode || "—"}</td>
                    <td className="px-4 py-3 text-body">{c.courseLevel || "—"}</td>
                  </tr>
                ))}
              </PocTable>
            </div>
          </section>
        </div>
      )}
    </PocPage>
  );
}
