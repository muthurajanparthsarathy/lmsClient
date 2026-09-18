'use client';

// ─────────────────────────────────────────────────────────────────────────────
// POC Dashboard — mirror of the Admin Dashboard, restricted to the courses,
// clients and services this POC is enrolled in.
//
// The layout, tokens, cards, charts and directory table match the admin
// version 1:1 — the only difference is the data source. Everything is derived
// client-side from the four POC-scoped endpoints already used elsewhere in the
// console (see features/poc/hooks/use-poc-scope.ts), so this page can never
// disagree with the sibling pages about counts.
//
// One admin-only concept, "total sub-topics", is omitted because the scoped
// courses endpoint doesn't ship the nested pedagogy tree — the density card
// falls back to a top-N-by-module bar chart, which reads from `moduleCount`.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, CartesianGrid, Legend as RechartsLegend,
} from 'recharts';
import {
    Users, BookOpen, Layers, AlertCircle, TrendingUp, Trophy,
    Building2, RefreshCw, CalendarDays, X, BarChart3, PieChart as PieChartIcon,
    SearchX, Inbox,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { usePocSummary, type PocCourse } from '@/features/poc/hooks/use-poc-scope';
import {
    StatCard, StatusPill, EmptyState, Toolbar,
    pageEnter, listStagger, listItem,
} from '../../../shared/ui';
import DataTable, { type Column } from '../../../shared/listing/DataTable';
import { CountUp } from '../../admindashboard/components/CountUp';
import { ChartTooltip, legendFormatter } from '../../admindashboard/components/ChartTooltip';
import { ChartCard } from '../../admindashboard/components/ChartCard';
import { InsightTile } from '../../admindashboard/components/InsightTile';
import { DistRow } from '../../admindashboard/components/DistRow';
import { DashboardSkeleton } from '../../admindashboard/components/DashboardSkeleton';

// Same palette / axis tokens / helpers as the admin page — kept in-file so
// this dashboard can be lifted or diverged without cross-file coupling.
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

const AXIS_TICK = { fill: 'var(--color-ink-400)', fontSize: 11 };
const AXIS_TICK_STRONG = { fill: 'var(--color-ink-500)', fontSize: 11, fontWeight: 500 };

const fmtDate = (v?: string) => {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

const courseInitials = (name?: string, fallback = 'C') => {
    if (!name || !name.trim()) return fallback;
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
};

// Per-course participant count — distinct users across every batch. Derived
// from the roster (not the server's `participantCount`) so it shares its
// denominator with `activeLearnersOf` and the two can never disagree, which
// is what caused active > total in an earlier revision.
const learnersOf = (c: PocCourse) => {
    const seen = new Set<string>();
    (c.batchAndParticipants ?? []).forEach((b) => {
        (b.users ?? []).forEach((entry) => {
            const ref = entry?.user;
            const id = !ref ? null : typeof ref === 'string' ? ref : ref._id ?? null;
            if (id) seen.add(String(id));
        });
    });
    return seen.size;
};

const activeLearnersOf = (c: PocCourse) => {
    const seen = new Set<string>();
    (c.batchAndParticipants ?? []).forEach((b) => {
        (b.users ?? []).forEach((entry) => {
            const ref = entry?.user;
            const id = !ref ? null : typeof ref === 'string' ? ref : ref._id ?? null;
            const status =
                typeof ref === 'object' && ref?.status ? ref.status : entry?.status;
            if (id && String(status || '').toLowerCase() === 'active') seen.add(String(id));
        });
    });
    return seen.size;
};

// Header stays identical across loading / error / loaded / empty states so
// the frame never jumps.
function DashHeader({ isFetching, onRefresh }: { isFetching: boolean; onRefresh: () => void }) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-[-0.01em] text-heading">
                        My Executive Overview
                    </h1>
                    <StatusPill tone="success" dot>
                        Live · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </StatusPill>
                </div>
                <p className="mt-0.5 text-sm text-subtle">
                    Your assigned courses, clients and delivery activity.
                </p>
            </div>
            {/* mr-10 clears the shell's corner-pinned notification bell. */}
            <Button variant="outline" className="mr-10" onClick={onRefresh} disabled={isFetching}>
                <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
                {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
        </div>
    );
}

export default function PocDashboardPage() {
    const {
        loading, error, isEmpty, isFetching, refetch,
        courses, attendance, stats,
    } = usePocSummary();

    const [search, setSearch] = useState('');

    // Attendance rows carry the training window; the dashboard needs it per
    // course id so directory rows show status without a second lookup.
    const attendanceByCourse = useMemo(() => {
        const map = new Map<string, (typeof attendance)[number]>();
        (attendance || []).forEach((row) => {
            if (row?._id) map.set(String(row._id), row);
        });
        return map;
    }, [attendance]);

    // --- DERIVED INSIGHTS -----------------------------------------------------

    const totalCourses = stats.totalCourses;
    const totalLearners = stats.students;
    const activeLearners = stats.activeStudents;
    const engagementRate = pct(activeLearners, totalLearners);
    const distinctClients = stats.clients;

    const enrollmentData = useMemo(() => {
        return [...courses]
            .map((c) => ({
                _id: c._id,
                learners: learnersOf(c),
                active: activeLearnersOf(c),
                name: c.courseCode || (c.courseName || '').substring(0, 10) || 'CC',
                fullName: c.courseName || '',
            }))
            .sort((a, b) => b.learners - a.learners)
            .slice(0, 8)
            .map((c) => {
                const engaged = c.learners > 0 ? c.active / c.learners : 1;
                const alert: 'red' | 'yellow' | null =
                    c.learners > 0 && c.active === 0 ? 'red'
                    : c.learners > 0 && engaged < 0.4 ? 'yellow'
                    : null;
                return {
                    name: c.name,
                    fullName: c.fullName,
                    Learners: c.learners,
                    Active: c.active,
                    alert,
                };
            });
    }, [courses]);

    const serviceData = useMemo(() => {
        const byService = new Map<string, number>();
        courses.forEach((c) => {
            const key = c.serviceType || 'Unassigned';
            byService.set(key, (byService.get(key) || 0) + 1);
        });
        return [...byService.entries()]
            .map(([name, value], i) => ({
                name,
                value,
                fill: CHART_PALETTE[i % CHART_PALETTE.length],
            }))
            .sort((a, b) => b.value - a.value);
    }, [courses]);

    const levelData = useMemo(() => {
        const byLevel = new Map<string, number>();
        courses.forEach((c) => {
            const key = c.courseLevel || 'Unspecified';
            byLevel.set(key, (byLevel.get(key) || 0) + 1);
        });
        return [...byLevel.entries()]
            .map(([name, value], i) => ({
                name,
                value,
                fill: CHART_PALETTE[(i + 3) % CHART_PALETTE.length],
            }))
            .sort((a, b) => b.value - a.value);
    }, [courses]);

    const topCourse = useMemo(
        () => [...courses].map((c) => ({ c, n: learnersOf(c) })).sort((a, b) => b.n - a.n)[0],
        [courses]
    );
    const richestCourse = useMemo(
        () => [...courses].sort((a, b) => (b.moduleCount || 0) - (a.moduleCount || 0))[0],
        [courses]
    );
    const newestCourse = useMemo(
        () => [...courses].sort((a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0],
        [courses]
    );
    const emptyCourses = useMemo(
        () => courses.filter((c) => learnersOf(c) === 0),
        [courses]
    );

    const filteredCourses = useMemo(() => {
        const q = search.trim().toLowerCase();
        const base = [...courses].sort((a, b) => learnersOf(b) - learnersOf(a));
        if (!q) return base;
        return base.filter((c) =>
            [c.courseName, c.courseCode, c.clientName, c.serviceType, c.courseLevel]
                .some((v) => String(v || '').toLowerCase().includes(q))
        );
    }, [courses, search]);

    const hasEnrollmentAlerts = useMemo(
        () => enrollmentData.some((d) => d.alert),
        [enrollmentData]
    );

    // Pulsing alert dot renderer for the enrollment bars — same visual
    // vocabulary as the admin dashboard.
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

    // --- DIRECTORY TABLE COLUMNS --------------------------------------------

    const directoryColumns: Column<PocCourse>[] = [
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
                    {course.moduleCount || 0} mod
                </span>
            ),
        },
        {
            key: 'learners',
            label: 'Learners',
            className: 'px-3 text-left',
            skeletonWidth: '70%',
            render: (course) => {
                const learners = learnersOf(course);
                const active = activeLearnersOf(course);
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
            key: 'schedule',
            label: 'Training window',
            className: 'px-3 text-left',
            skeletonWidth: '75%',
            render: (course) => {
                const row = attendanceByCourse.get(String(course._id));
                if (!row?.hasSchedule) return <StatusPill tone="neutral">Not scheduled</StatusPill>;
                return (
                    <span className="text-xs tabular-nums text-subtle">
                        {fmtDate(row.trainingStart)} → {fmtDate(row.trainingEnd)}
                    </span>
                );
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

    // --- RENDER STATES -------------------------------------------------------

    if (loading) {
        return (
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                className="min-h-screen px-6 py-5 md:px-8 md:py-6"
            >
                <DashHeader isFetching={isFetching} onRefresh={refetch} />
                <DashboardSkeleton />
            </motion.div>
        );
    }

    if (error) {
        return (
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                className="min-h-screen px-6 py-5 md:px-8 md:py-6"
            >
                <DashHeader isFetching={isFetching} onRefresh={refetch} />
                <div className="mt-6 rounded-xl border border-hairline bg-surface shadow-xs">
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-tile bg-danger-50">
                            <AlertCircle size={20} className="text-danger-700" aria-hidden="true" />
                        </div>
                        <h2 className="mt-4 text-md font-semibold text-heading">Connection failed</h2>
                        <p className="mt-1 max-w-sm text-sm text-subtle">
                            Unable to fetch your assigned courses. Check that you are signed in and try again.
                        </p>
                        <Button className="mt-4" onClick={refetch}>Retry Connection</Button>
                    </div>
                </div>
            </motion.div>
        );
    }

    // Empty state — the CURRENT default for a POC that hasn't been enrolled
    // into anything. Kept full-width so the message isn't lost inside the
    // dashboard chrome, but shares the header so the frame is identical.
    if (isEmpty) {
        return (
            <motion.div
                variants={pageEnter}
                initial="hidden"
                animate="visible"
                className="min-h-screen px-6 py-5 md:px-8 md:py-6"
            >
                <DashHeader isFetching={isFetching} onRefresh={refetch} />
                <div className="mt-6 rounded-xl border border-hairline bg-surface shadow-xs">
                    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-tile bg-brand-wash">
                            <Inbox size={20} className="text-brand-strong" aria-hidden="true" />
                        </div>
                        <h2 className="mt-4 text-md font-semibold text-heading">No courses assigned yet</h2>
                        <p className="mt-1 max-w-md text-sm text-subtle">
                            Your courses, clients, attendance and reports appear here once an
                            administrator enrols you into a course. Need access?{' '}
                            <a href="mailto:support@smartcliff.com" className="underline">
                                support@smartcliff.com
                            </a>
                        </p>
                    </div>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            variants={pageEnter}
            initial="hidden"
            animate="visible"
            className="min-h-screen px-6 py-5 md:px-8 md:py-6"
        >
            <DashHeader isFetching={isFetching} onRefresh={refetch} />

            {/* --- KPI GRID --- */}
            <motion.div
                variants={listStagger}
                initial="hidden"
                animate="visible"
                className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
                <motion.div variants={listItem}>
                    <StatCard
                        label="My Courses"
                        value={<CountUp end={totalCourses} />}
                        icon={BookOpen}
                        hint={`${serviceData.length} service type${serviceData.length === 1 ? '' : 's'}`}
                    />
                </motion.div>
                <motion.div variants={listItem}>
                    <StatCard
                        label="My Learners"
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
                        label="My Clients"
                        value={<CountUp end={distinctClients} />}
                        icon={Building2}
                        hint={distinctClients === 1 ? 'with at least one course' : 'with at least one course'}
                    />
                </motion.div>
            </motion.div>

            {/* --- KEY INSIGHTS --- */}
            <div className="mt-6 rounded-xl border border-hairline bg-surface p-5 shadow-xs">
                <h3 className="text-md font-semibold text-heading">Key insights</h3>
                <p className="mt-0.5 text-xs text-subtle">Standout courses in your assigned catalogue</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <InsightTile
                        icon={Trophy}
                        label="Highest Enrollment"
                        value={topCourse?.c?.courseName || '—'}
                        sub={topCourse?.c
                            ? `${topCourse.n} learners · ${activeLearnersOf(topCourse.c)} active`
                            : 'No courses yet'}
                    />
                    <InsightTile
                        icon={Layers}
                        label="Richest Content"
                        value={richestCourse?.courseName || '—'}
                        sub={richestCourse
                            ? `${richestCourse.moduleCount || 0} module${(richestCourse.moduleCount || 0) === 1 ? '' : 's'}${richestCourse.courseLevel ? ` · ${richestCourse.courseLevel}` : ''}`
                            : 'No content yet'}
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
                    description={`Top ${enrollmentData.length} of your course${enrollmentData.length === 1 ? '' : 's'} — total learners vs currently active`}
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
                                    message="Once learners enroll in your courses, per-course enrollment appears here."
                                />
                            </div>
                        )}
                    </div>
                </ChartCard>

                {/* Service mix — labelled donut with counts */}
                <ChartCard title="Service mix" description="Your courses per service type" className="flex flex-col">
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
                                    message="Service mix appears once your courses are mapped to services."
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
                <ChartCard title="Course levels" description="Difficulty spread across your catalogue">
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
                            message="Course levels appear once your courses declare a difficulty."
                        />
                    )}
                </ChartCard>

                <ChartCard
                    className="lg:col-span-2"
                    title="Content density"
                    description={`${stats.modules.toLocaleString()} module${stats.modules === 1 ? '' : 's'} across your ${totalCourses} course${totalCourses === 1 ? '' : 's'} — top courses by depth`}
                >
                    <div className="h-[240px] w-full">
                        {courses.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={[...courses]
                                        .sort((a, b) => (b.moduleCount || 0) - (a.moduleCount || 0))
                                        .slice(0, 8)
                                        .map((c) => ({
                                            name: c.courseCode || (c.courseName || '').substring(0, 8) || 'CC',
                                            fullName: c.courseName || '',
                                            Modules: c.moduleCount || 0,
                                            Learners: learnersOf(c),
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
                                    <Bar dataKey="Learners" fill="var(--color-info-500)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <EmptyState
                                    icon={BarChart3}
                                    title="No content data yet"
                                    message="Module depth appears once course content is authored."
                                />
                            </div>
                        )}
                    </div>
                </ChartCard>
            </div>

            {/* --- COURSE DIRECTORY --- */}
            <div className="mt-6 overflow-hidden rounded-xl border border-hairline bg-surface shadow-xs">
                <div className="border-b border-hairline px-4 pb-4 pt-5">
                    <h3 className="text-md font-semibold text-heading">My course directory</h3>
                    <p className="mt-0.5 text-xs text-subtle">
                        Every course you own with enrollment, content and client context — sorted by enrollment
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
                            {filteredCourses.length} of {courses.length} course{courses.length === 1 ? '' : 's'}
                        </span>
                    }
                />
                <DataTable<PocCourse>
                    rows={filteredCourses}
                    columns={directoryColumns}
                    rowKey={(course) => String(course._id || course.courseCode || '')}
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
    );
}
