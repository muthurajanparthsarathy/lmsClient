'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Student Dashboard
//
// Composition only — every number rendered here is derived in ./_lib/metrics
// from what the platform actually stores (pedagogy content, the student's own
// answer documents, and their attendance rows). Widgets fall back to explicit
// empty states rather than placeholder numbers when a source has no data.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, GraduationCap, Trophy } from 'lucide-react';

import { StudentLayout } from '../../component/student/student-layout';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/components/permissions';
import { useCurrentUserQuery } from '@/queries/auth';
import {
    useStudentAnalyticsQuery,
    useMyAttendanceQuery,
    useMyLearningTimeQuery,
    attendanceWindow,
    getUserSpecificAnalytics,
} from '@/queries/studentDashboard';

import { buildDashboard, idStr, type DashboardModel } from './_lib/metrics';
import { C } from './_components/ui';
import { KpiRow, LearningJourney, TodayFocus, StreakCard, MotivationCard } from './_components/overview';
import { CourseProgressTable, AssignmentAnalytics, UpcomingSchedule } from './_components/courses';
import { PerformanceTrend, AttendanceAnalytics } from './_components/analytics';
import { RecentActivity, LearningInsights, SubjectMastery, Achievements } from './_components/insights';

/* ── loading skeleton ────────────────────────────────────────────────────── */

const Shimmer = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse rounded-[20px] border border-[#E5E7EB] bg-white dark:border-gray-800 dark:bg-gray-900 ${className}`}>
        <div className="h-full w-full rounded-[20px] bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
    </div>
);

const DashboardSkeleton = () => (
    <div className="mx-auto max-w-[1440px] space-y-6">
        <Shimmer className="h-[76px]" />
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} className="h-[152px]" />)}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Shimmer className="h-[420px] xl:col-span-2" />
            <Shimmer className="h-[420px]" />
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} className="h-[320px]" />)}
        </div>
    </div>
);

/* ── header ──────────────────────────────────────────────────────────────── */

const Header =({ m, onGrades, onCalendar, showGrades }: { m: DashboardModel; onGrades: () => void; onCalendar: () => void; showGrades: boolean }) => {
    // Academic metadata is optional on the user record — render only what exists
    // rather than a row of "not set" placeholders.
    const meta = [
        m.student.department,
        m.student.semester && `Semester ${m.student.semester}`,
        m.student.section && `Section ${m.student.section}`,
        m.student.batch && `Batch ${m.student.batch}`,
        m.student.rollNumber && `Roll ${m.student.rollNumber}`,
    ].filter(Boolean) as string[];

    return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-[26px] font-bold tracking-[-0.03em] text-slate-900 dark:text-white">
                    Welcome back, {m.student.firstName}
                    <span className="text-[22px]">👋</span>
                </h1>
                {(m.student.degree || meta.length > 0) && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {m.student.degree && (
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                                {m.student.degree}
                            </span>
                        )}
                        {meta.map((x, i) => (
                            <span key={x} className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                                {(i > 0 || m.student.degree) && <span className="h-1 w-1 rounded-full bg-slate-300" />}
                                {x}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* mr-12 clears the shell's corner-pinned notification bell so the
                My Grades button never slides underneath it. */}
            <div className="flex shrink-0 items-center gap-2.5 mr-12">
                <button
                    onClick={onCalendar}
                    className="flex h-10 items-center gap-2 rounded-[14px] border border-[#E5E7EB] bg-white px-3.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-gray-800 dark:bg-gray-900 dark:text-slate-300 dark:hover:bg-gray-800"
                >
                    <CalendarDays size={15} strokeWidth={2.2} />
                    Calendar
                </button>
                {showGrades && (
                    <button
                        onClick={onGrades}
                        className="flex h-10 items-center gap-2 rounded-[14px] px-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ backgroundColor: C.primary }}
                    >
                        <Trophy size={15} strokeWidth={2.2} />
                        My Grades
                    </button>
                )}
            </div>
        </div>
    );
};

/* ── page ────────────────────────────────────────────────────────────────── */

export default function StudentDashboardPage() {
    const router = useRouter();

    // Full-id gating against the studentdashboard permission — mirrors the
    // three functionalities defined in PermissionModal so the header/nav
    // affordances match what this account was actually granted.
    const { can } = usePermissions();
    const canViewGrades = can(PERMISSION_IDS.STUDENT_DASHBOARD, 'view_grades');

    // Three cached reads (queries/studentDashboard.ts) in place of one
    // useEffect with four useStates. The secondary two stay non-blocking, as
    // before: the dashboard renders as soon as the user + analytics resolve,
    // and attendance / study time fill in after.
    const { data: user, isLoading: userLoading, error: userError } = useCurrentUserQuery();
    const studentId = idStr((user as any)?.user?._id);

    const {
        data: analytics,
        isLoading: analyticsLoading,
        error: analyticsError,
    } = useStudentAnalyticsQuery(studentId || null);

    const userCourses = useMemo(
        () => (analytics && studentId ? getUserSpecificAnalytics(analytics, studentId)?.userCourses || [] : []),
        [analytics, studentId],
    );

    // The window is stable for the life of the page; recomputing it per render
    // would mint a new query key every time.
    const window180 = useMemo(() => attendanceWindow(), []);
    const courseIds = useMemo(() => userCourses.map((c: any) => idStr(c?._id)), [userCourses]);
    const { records: attendance } = useMyAttendanceQuery(courseIds, studentId || null, window180);
    const { data: learningTime = null } = useMyLearningTimeQuery(studentId || null);

    const loading = userLoading || (!!studentId && analyticsLoading);
    const error = userError || analyticsError
        ? ((userError || analyticsError) as Error)?.message || 'Could not load your dashboard right now.'
        : null;

    const model = useMemo(
        () => (user ? buildDashboard(user, userCourses, attendance, learningTime) : null),
        [user, userCourses, attendance, learningTime],
    );

    const goCourse = useCallback((id: string) => router.push(`/lms/pages/courses/coursesdetailedview/${id}`), [router]);
    const goCourses = useCallback(() => router.push('/lms/pages/courses'), [router]);
    // The learner's OWN calendar, not the admin holiday editor at
    // /lms/pages/calendar — that one needs the `calendar` module and answered
    // every student with Access Restricted.
    const goCalendar = useCallback(() => router.push('/lms/pages/studentcalendar'), [router]);
    const goGrades = useCallback(() => router.push('/lms/pages/grades'), [router]);
    const goNotifications = useCallback(() => router.push('/lms/pages/notifications'), [router]);

    if (loading) {
        return <StudentLayout><DashboardSkeleton /></StudentLayout>;
    }

    if (error || !model) {
        return (
            <StudentLayout>
                <div className="mx-auto flex max-w-[520px] flex-col items-center justify-center gap-3 py-24 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
                        <GraduationCap size={22} strokeWidth={2.2} />
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">We couldn&apos;t load your dashboard</h2>
                    <p className="text-sm text-slate-500">{error || 'Please try again in a moment.'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-1 h-10 rounded-[14px] px-4 text-sm font-semibold text-white"
                        style={{ backgroundColor: C.primary }}
                    >
                        Retry
                    </button>
                </div>
            </StudentLayout>
        );
    }

    return (
        <StudentLayout>
            <div className="mx-auto max-w-[1440px] space-y-6">
                <Header m={model} onGrades={goGrades} onCalendar={goCalendar} showGrades={canViewGrades} />

                {/* Row 1 — KPI strip */}
                <KpiRow m={model} />

                {/* Row 2 — Learning Journey · Focus · Streak */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                    <div className="xl:col-span-2">
                        <LearningJourney m={model} onDetails={goCourses} />
                    </div>
                    <div className="flex flex-col gap-6">
                        <TodayFocus items={model.focus} onViewPlan={goCalendar} />
                        <StreakCard m={model} />
                        <MotivationCard name={model.student.firstName} />
                    </div>
                </div>

                {/* Row 3 — Courses · Assignments · Schedule */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-12">
                    <div className="xl:col-span-5">
                        <CourseProgressTable courses={model.courses} onOpen={goCourse} onViewAll={goCourses} />
                    </div>
                    <div className="xl:col-span-3">
                        <AssignmentAnalytics m={model} onViewAll={goGrades} />
                    </div>
                    <div className="lg:col-span-2 xl:col-span-4">
                        <UpcomingSchedule deadlines={model.deadlines} onCalendar={goCalendar} />
                    </div>
                </div>

                {/* Row 4 — Performance · Attendance */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <PerformanceTrend trend={model.trend} />
                    <AttendanceAnalytics a={model.attendance} />
                </div>

                {/* Row 5 — Activity · Insights */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <RecentActivity events={model.activity} onViewAll={goNotifications} />
                    <LearningInsights insights={model.insights} scorePct={model.scorePct} />
                </div>

                {/* Row 6 — Mastery · Achievements */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <SubjectMastery courses={model.courses} />
                    <Achievements achievements={model.achievements} completedCourses={model.completed} />
                </div>
            </div>
        </StudentLayout>
    );
}
