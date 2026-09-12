'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Admin Dashboard — institution-wide insight board.
// Everything on this page is derived client-side from ONE analytics call
// (/student-Dashboard/courses-data/analytics?light=1, via useAdminAnalyticsQuery):
//   Row 1  KPI stat cards — courses, learners, engagement, clients
//   Row 2  Key-insight tiles — top course, most content, newest
//   Row 3  Charts — enrollment per course, service mix, level mix, content density
//   Row 4  Course directory with a working search filter
// Every number is labelled; no decorative/dead controls.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, CartesianGrid, Legend as RechartsLegend
} from 'recharts';
import {
    Users, BookOpen, Layers, AlertCircle, TrendingUp, Trophy,
    Building2, RefreshCw, CalendarDays, X, BarChart3, PieChart as PieChartIcon,
    SearchX, Inbox
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useAdminAnalyticsQuery } from '@/queries/adminAnalytics';
import { readStoredUserData } from '../../shared/ui/navItems';
import DashboardLayout from '../../component/layout';
import {
    StatCard, StatusPill, EmptyState, Toolbar,
    pageEnter, listStagger, listItem
} from '../../shared/ui';
import DataTable, { type Column } from '../../shared/listing/DataTable';
import { CountUp } from './components/CountUp';
import { ChartTooltip, legendFormatter } from './components/ChartTooltip';
import { ChartCard } from './components/ChartCard';
import { InsightTile } from './components/InsightTile';
import { DistRow } from './components/DistRow';
import { DashboardSkeleton } from './components/DashboardSkeleton';

// Categorical chart palette drawn from the token ramps (brand / info / success /
// warn), ordered so adjacent slots stay distinguishable under CVD simulation.
// Same 8-slot modulo mechanics as before — only the values are tokenized.
const CHART_PALETTE = [
    'var(--color-brand-500)',
    'var(--color-info-700)',
    'var(--color-warn-500)',
    'var(--color-success-700)',
    'var(--color-brand-400)',
    'var(--color-brand-800)',
    'var(--color-info-500)',
    'var(--color-success-500)',
];

const fmtDate = (v?: string) => {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// Two-letter monogram from a course name — e.g. "Java Basics" → "JB",
// "Python 101" → "P1", single-word "Kubernetes" → "KU".
const courseInitials = (name?: string, fallback = 'C') => {
    if (!name || !name.trim()) return fallback;
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
};

// Shared axis tick styles (tokens via CSS variables — Recharts reads them fine).
const AXIS_TICK = { fill: 'var(--color-ink-400)', fontSize: 11 };
const AXIS_TICK_STRONG = { fill: 'var(--color-ink-500)', fontSize: 11, fontWeight: 500 };

// Page header — title, live pill, refresh. Rendered identically across the
// loading / error / loaded states so the frame never jumps between them.
function DashHeader({ isFetching, onRefresh }: { isFetching: boolean; onRefresh: () => void }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-[-0.01em] text-heading">Executive Overview</h1>
                    <StatusPill tone="success" dot>
                        Live · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </StatusPill>
                </div>
                <p className="mt-0.5 text-sm text-subtle">
                    Institution-wide analytics across courses, learners and clients.
                </p>
            </div>
            {/* mr-10 clears the shell's corner-pinned notification bell
                (absolute top-3 right-4, 38px) that overlays this row. */}
            <Button variant="outline" className="mr-10" onClick={onRefresh} disabled={isFetching}>
                <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
        </div>
    );
}

export default function AdminDashboard() {
    // The analytics payload is institution/role-scoped server-side, so the
    // query is keyed per user (see queryKeys.analytics.adminDashboard).
    const [userId] = useState<string | null>(() => readStoredUserData()?._id ?? null);
    const { data: apiResponse, isLoading, isError, refetch, isFetching } = useAdminAnalyticsQuery(userId);

    const analytics = apiResponse?.data?.analytics;
    const courses = apiResponse?.data?.courses || [];
    const summary = apiResponse?.data?.summary;

    const [search, setSearch] = useState('');

    // --- DERIVED INSIGHTS (all client-side, from the one analytics call) ---

    const totalCourses = analytics?.totalCourses || 0;
    const totalLearners = analytics?.totalParticipants || 0;
    const activeLearners = analytics?.totalActiveParticipants || 0;
    const engagementRate = pct(activeLearners, totalLearners);

    const distinctClients = useMemo(
        () => new Set(courses.map((c: any) => c.clientName).filter(Boolean)).size,
        [courses]
    );

    // Enrollment per course — top 8, total vs active, horizontal so names read.
    const enrollmentData = useMemo(() => {
        return [...courses]
            .sort((a: any, b: any) => (b.stats?.participants || 0) - (a.stats?.participants || 0))
            .slice(0, 8)
            .map((c: any) => {
                const learners = c.stats?.participants || 0;
                const active = c.stats?.activeParticipants || 0;
                const engaged = learners > 0 ? active / learners : 1;
                // Flag bars needing attention: red = has learners but none active,
                // amber = active but engagement under 40%.
                const alert: 'red' | 'yellow' | null =
                    learners > 0 && active === 0 ? 'red'
                    : learners > 0 && engaged < 0.4 ? 'yellow'
                    : null;
                return {
                    name: c.courseCode || c.courseName?.substring(0, 10) || 'CC',
                    fullName: c.courseName,
                    Learners: learners,
                    Active: active,
                    alert,
                };
            });
    }, [courses]);

    const serviceData = useMemo(() => {
        if (!summary?.coursesByService) return [];
        return Object.entries(summary.coursesByService)
            .map(([name, value], i) => ({
                name,
                value: Number(value) || 0,
                fill: CHART_PALETTE[i % CHART_PALETTE.length],
            }))
            .sort((a, b) => b.value - a.value);
    }, [summary]);

    const levelData = useMemo(() => {
        if (!summary?.coursesByLevel) return [];
        return Object.entries(summary.coursesByLevel)
            .map(([name, value], i) => ({
                name,
                value: Number(value) || 0,
                fill: CHART_PALETTE[(i + 3) % CHART_PALETTE.length],
            }))
            .sort((a, b) => b.value - a.value);
    }, [summary]);

    // Named insight picks.
    const topCourse = useMemo(() =>
        [...courses].sort((a: any, b: any) => (b.stats?.participants || 0) - (a.stats?.participants || 0))[0],
        [courses]);
    const richestCourse = useMemo(() =>
        [...courses].sort((a: any, b: any) => (b.stats?.topics || 0) - (a.stats?.topics || 0))[0],
        [courses]);
    const newestCourse = useMemo(() =>
        [...courses].sort((a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0],
        [courses]);
    const emptyCourses = useMemo(
        () => courses.filter((c: any) => !(c.stats?.participants > 0)),
        [courses]);

    // Directory — working search over name / code / client / service / level.
    const filteredCourses = useMemo(() => {
        const q = search.trim().toLowerCase();
        const base = [...courses].sort(
            (a: any, b: any) => (b.stats?.participants || 0) - (a.stats?.participants || 0)
        );
        if (!q) return base;
        return base.filter((c: any) =>
            [c.courseName, c.courseCode, c.clientName, c.serviceType, c.courseLevel]
                .some((v) => String(v || '').toLowerCase().includes(q))
        );
    }, [courses, search]);

    const hasEnrollmentAlerts = useMemo(() => enrollmentData.some((d) => d.alert), [enrollmentData]);

    // Recharts bar-label renderer: draws a pulsing red/amber alert dot at the tip
    // of the "Active" bar for any flagged course, giving at-risk bars visual context.
    const renderAlertDot = (props: any) => {
        const { x, y, width, height, index } = props;
        const d = enrollmentData[index];
        if (!d?.alert) return null;
        const color = d.alert === 'red' ? 'var(--color-danger-500)' : 'var(--color-warn-500)';
        const cx = x + width + 8;
        const cy = y + height / 2;
        return (
            <g key={`alert-${index}`} style={{ pointerEvents: 'none' }}>
                <circle cx={cx} cy={cy} r={4} fill={color} opacity={0.3}>
                    <animate attributeName="r" values="4;9;4" dur="1.6s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.35;0;0.35" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="var(--color-surface)" strokeWidth={1.5} />
            </g>
        );
    };

    // --- DIRECTORY TABLE COLUMNS ---

    const directoryColumns: Column<any>[] = [
        {
            key: 'course',
            label: 'Course',
            className: 'px-4 text-left',
            skeletonWidth: '80%',
            render: (course) => (
                <div className="flex items-center gap-3 py-1.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-tile bg-brand-wash text-xs font-semibold text-brand-strong">
                        {courseInitials(course.courseName, course.courseCode?.substring(0, 2).toUpperCase() || 'CC')}
                    </div>
                    <div className="min-w-0">
                        <div className="max-w-[280px] truncate text-sm font-medium text-heading">
                            {course.courseName}
                        </div>
                        <div className="mt-0.5 text-xs text-faint">
                            {course.courseCode || ''}{course.clientName ? ` · ${course.clientName}` : ''}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            key: 'service',
            label: 'Service',
            className: 'px-3 text-left',
            skeletonWidth: '60%',
            render: (course) => (
                <StatusPill tone="neutral">{course.serviceType || '—'}</StatusPill>
            ),
        },
        {
            key: 'level',
            label: 'Level',
            className: 'px-3 text-left',
            skeletonWidth: '50%',
            render: (course) => (
                <span className="text-sm text-body">{course.courseLevel || '—'}</span>
            ),
        },
        {
            key: 'content',
            label: 'Content',
            className: 'px-3 text-left',
            skeletonWidth: '65%',
            render: (course) => (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-2.5 py-1 text-xs font-medium text-subtle">
                    <Layers size={13} className="text-brand" aria-hidden="true" />
                    {course.stats?.modules || 0} mod · {course.stats?.topics || 0} topics
                </span>
            ),
        },
        {
            key: 'learners',
            label: 'Learners',
            className: 'px-3 text-left',
            skeletonWidth: '70%',
            render: (course) => {
                const learners = course.stats?.participants || 0;
                const active = course.stats?.activeParticipants || 0;
                const activePct = pct(active, learners);
                if (learners > 0) {
                    return (
                        <div className="w-32">
                            <div className="mb-1 flex items-center justify-between text-xs">
                                <span className="font-semibold tabular-nums text-heading">{learners}</span>
                                <span className="font-medium text-success-700">{activePct}% active</span>
                            </div>
                            <div className="h-1 overflow-hidden rounded-full bg-ink-100">
                                <div className="h-full rounded-full bg-success-500" style={{ width: `${activePct}%` }} />
                            </div>
                        </div>
                    );
                }
                return <StatusPill tone="neutral">No learners</StatusPill>;
            },
        },
        {
            key: 'created',
            label: 'Created',
            className: 'px-4 text-right',
            skeletonWidth: '55%',
            render: (course) => (
                <span className="text-xs tabular-nums text-subtle">{fmtDate(course.createdAt)}</span>
            ),
        },
    ];

    // --- RENDER STATES ---

    // `!apiResponse && !isError` also covers the idle state when the stored
    // user id hasn't been read yet (query disabled) — skeleton, not zeros.
    if (isLoading || (!apiResponse && !isError)) return (
        <DashboardLayout>
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                className="min-h-screen px-6 py-5 md:px-8 md:py-6"
            >
                <DashHeader isFetching={isFetching} onRefresh={() => refetch()} />
                <DashboardSkeleton />
            </motion.div>
        </DashboardLayout>
    );

    if (isError) return (
        <DashboardLayout>
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                className="min-h-screen px-6 py-5 md:px-8 md:py-6"
            >
                <DashHeader isFetching={isFetching} onRefresh={() => refetch()} />
                <div className="mt-6 rounded-xl border border-hairline bg-surface shadow-xs">
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-tile bg-danger-50">
                            <AlertCircle size={20} className="text-danger-700" aria-hidden="true" />
                        </div>
                        <h2 className="mt-4 text-md font-semibold text-heading">Connection failed</h2>
                        <p className="mt-1 max-w-sm text-sm text-subtle">
                            Unable to fetch live analytics data. Check that you are signed in and the analytics service is reachable.
                        </p>
                        <Button className="mt-4" onClick={() => refetch()}>Retry Connection</Button>
                    </div>
                </div>
            </motion.div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                className="min-h-screen px-6 py-5 md:px-8 md:py-6"
            >
                <DashHeader isFetching={isFetching} onRefresh={() => refetch()} />

                {/* --- KPI GRID --- */}
                <motion.div
                    variants={listStagger}
                    initial="hidden"
                    animate="visible"
                    className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
                >
                    <motion.div variants={listItem}>
                        <StatCard
                            label="Total Courses"
                            value={<CountUp end={totalCourses} />}
                            icon={BookOpen}
                            hint={`${serviceData.length} service type${serviceData.length === 1 ? '' : 's'}`}
                        />
                    </motion.div>
                    <motion.div variants={listItem}>
                        <StatCard
                            label="Total Learners"
                            value={<CountUp end={totalLearners} />}
                            icon={Users}
                            hint={`across ${totalCourses - emptyCourses.length} enrolled course${totalCourses - emptyCourses.length === 1 ? '' : 's'}`}
                        />
                    </motion.div>
                    <motion.div variants={listItem}>
                        <StatCard
                            label="Learner Engagement"
                            value={<CountUp end={engagementRate} suffix="%" />}
                            icon={TrendingUp}
                            hint={`${activeLearners.toLocaleString()} of ${totalLearners.toLocaleString()} learners active`}
                        />
                    </motion.div>
                    <motion.div variants={listItem}>
                        <StatCard
                            label="Clients"
                            value={<CountUp end={distinctClients} />}
                            icon={Building2}
                            hint="with at least one course"
                        />
                    </motion.div>
                </motion.div>

                {/* --- KEY INSIGHTS --- */}
                <div className="mt-6 rounded-xl border border-hairline bg-surface p-5 shadow-xs">
                    <h3 className="text-md font-semibold text-heading">Key insights</h3>
                    <p className="mt-0.5 text-xs text-subtle">Standout courses across the catalogue</p>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <InsightTile
                            icon={Trophy}
                            label="Highest Enrollment"
                            value={topCourse?.courseName || '—'}
                            sub={topCourse ? `${topCourse.stats?.participants || 0} learners · ${topCourse.stats?.activeParticipants || 0} active` : 'No courses yet'}
                        />
                        <InsightTile
                            icon={Layers}
                            label="Richest Content"
                            value={richestCourse?.courseName || '—'}
                            sub={richestCourse ? `${richestCourse.stats?.topics || 0} topics across ${richestCourse.stats?.modules || 0} modules` : 'No content yet'}
                        />
                        <InsightTile
                            icon={CalendarDays}
                            label="Newest Course"
                            value={newestCourse?.courseName || '—'}
                            sub={newestCourse ? `Created ${fmtDate(newestCourse.createdAt)}` : '—'}
                        />
                    </div>
                </div>

                {/* --- ANALYTICS CHARTS, ROW 1 --- */}
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <ChartCard
                        className="lg:col-span-2"
                        title="Enrollment by course"
                        description={`Top ${enrollmentData.length} courses — total learners vs currently active`}
                        meta={hasEnrollmentAlerts ? (
                            <div className="mt-1.5 flex items-center gap-3 text-2xs text-faint">
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-danger-500" /> No active learners
                                </span>
                                <span className="inline-flex items-center gap-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-warn-500" /> Low engagement (&lt;40%)
                                </span>
                            </div>
                        ) : undefined}
                    >
                        <div className="h-[320px] w-full">
                            {enrollmentData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={enrollmentData} layout="vertical" barSize={10} barGap={2} margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-line)" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={AXIS_TICK} allowDecimals={false} />
                                        <YAxis
                                            type="category"
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            width={90}
                                            tick={AXIS_TICK_STRONG}
                                        />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-ink-50)' }} />
                                        <RechartsLegend formatter={legendFormatter} iconType="circle" iconSize={8} />
                                        <Bar dataKey="Learners" fill="var(--color-ink-200)" radius={[0, 4, 4, 0]} />
                                        <Bar dataKey="Active" fill="var(--color-brand-600)" radius={[0, 4, 4, 0]} label={renderAlertDot} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <EmptyState
                                        icon={BarChart3}
                                        title="No enrollment data yet"
                                        message="Once learners enroll in courses, per-course enrollment appears here."
                                    />
                                </div>
                            )}
                        </div>
                    </ChartCard>

                    {/* Service mix — labelled donut with counts */}
                    <ChartCard title="Service mix" description="Courses per service type" className="flex flex-col">
                        <div className="relative min-h-[190px] flex-1">
                            {serviceData.length > 0 ? (
                                <>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={serviceData} cx="50%" cy="50%"
                                                innerRadius={55} outerRadius={85} paddingAngle={4}
                                                dataKey="value" stroke="none" cornerRadius={4}
                                            >
                                                {serviceData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} className="transition-opacity hover:opacity-80" />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip content={<ChartTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-3xl font-semibold tabular-nums text-heading">{totalCourses}</span>
                                        <span className="text-2xs font-semibold uppercase tracking-wider text-faint">Courses</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <EmptyState
                                        icon={PieChartIcon}
                                        title="No distribution data"
                                        message="Service mix appears once courses are mapped to services."
                                    />
                                </div>
                            )}
                        </div>
                        <div className="mt-3 space-y-2">
                            {serviceData.map((item, i) => (
                                <DistRow key={i} label={item.name} count={item.value} total={totalCourses} color={item.fill} />
                            ))}
                        </div>
                    </ChartCard>
                </div>

                {/* --- LEVEL MIX + CONTENT DENSITY --- */}
                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    <ChartCard title="Course levels" description="Difficulty spread across the catalogue">
                        {levelData.length > 0 ? (
                            <div className="space-y-3">
                                {levelData.map((item, i) => (
                                    <DistRow key={i} label={item.name} count={item.value} total={totalCourses} color={item.fill} />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon={Layers}
                                title="No level data"
                                message="Course levels appear once courses declare a difficulty."
                            />
                        )}
                    </ChartCard>

                    <ChartCard
                        className="lg:col-span-2"
                        title="Content density"
                        description={`${(analytics?.totalModules || 0).toLocaleString()} modules · ${(analytics?.totalTopics || 0).toLocaleString()} topics · ${(analytics?.totalSubTopics || 0).toLocaleString()} subtopics catalogue-wide — top courses by depth`}
                    >
                        <div className="h-[240px] w-full">
                            {courses.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={[...courses]
                                            .sort((a: any, b: any) => (b.stats?.topics || 0) - (a.stats?.topics || 0))
                                            .slice(0, 8)
                                            .map((c: any) => ({
                                                name: c.courseCode || c.courseName?.substring(0, 8) || 'CC',
                                                fullName: c.courseName,
                                                Modules: c.stats?.modules || 0,
                                                Topics: c.stats?.topics || 0,
                                            }))}
                                        barSize={22}
                                        margin={{ top: 8, right: 0, left: -20, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK_STRONG} dy={8} />
                                        <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} allowDecimals={false} />
                                        <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-ink-50)' }} />
                                        <RechartsLegend formatter={legendFormatter} iconType="circle" iconSize={8} />
                                        <Bar dataKey="Modules" fill="var(--color-ink-200)" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Topics" fill="var(--color-info-500)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center">
                                    <EmptyState
                                        icon={BarChart3}
                                        title="No content data yet"
                                        message="Module and topic depth appears once course content is authored."
                                    />
                                </div>
                            )}
                        </div>
                    </ChartCard>
                </div>

                {/* --- COURSE DIRECTORY --- */}
                <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface shadow-xs">
                    <div className="border-b border-hairline px-4 pb-4 pt-5">
                        <h3 className="text-md font-semibold text-heading">Course directory</h3>
                        <p className="mt-0.5 text-xs text-subtle">
                            Every course with enrollment, content and client context — sorted by enrollment
                        </p>
                    </div>
                    <Toolbar
                        search={{
                            value: search,
                            onChange: setSearch,
                            placeholder: 'Search course, client, service…',
                        }}
                        filters={search ? (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="inline-flex h-7 items-center gap-1 rounded-chip px-2 text-xs font-medium text-subtle transition-colors duration-150 hover:bg-ink-100 hover:text-heading"
                            >
                                <X size={13} aria-hidden="true" />
                                Clear
                            </button>
                        ) : undefined}
                        actions={
                            <span className="text-xs tabular-nums text-subtle">
                                {filteredCourses.length} of {courses.length} courses
                            </span>
                        }
                    />
                    <DataTable<any>
                        rows={filteredCourses}
                        columns={directoryColumns}
                        rowKey={(course: any) => String(course._id || course.courseCode || '')}
                        sortKey={null}
                        sortDir="desc"
                        onSort={() => undefined}
                        isLoading={false}
                        isFiltered={Boolean(search.trim())}
                        emptyTitle={search ? 'No matching courses' : 'No courses yet'}
                        emptyHint={search ? `No courses match "${search}".` : 'Courses appear here once they are created.'}
                        emptyAction="Clear search"
                        onEmptyAction={() => setSearch('')}
                        minWidth={920}
                        maxHeight="500px"
                        emptyState={search ? (
                            <EmptyState
                                icon={SearchX}
                                title="No matching courses"
                                message={`No courses match "${search}" by name, code, client, service or level.`}
                                primaryAction={
                                    <Button variant="outline" size="sm" onClick={() => setSearch('')}>
                                        Clear search
                                    </Button>
                                }
                            />
                        ) : (
                            <EmptyState
                                icon={Inbox}
                                title="No courses yet"
                                message="Once courses are created they appear here with enrollment and content stats."
                            />
                        )}
                    />
                </div>
            </motion.div>
        </DashboardLayout>
    );
}
