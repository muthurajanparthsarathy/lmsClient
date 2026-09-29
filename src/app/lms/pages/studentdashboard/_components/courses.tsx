'use client';

// Row 3 — Course Progress · Assignment Analytics · Upcoming Schedule.

import React from 'react';
import { BookOpen, PieChart, CalendarDays, Play, Clock3, AlertTriangle } from 'lucide-react';
import { Card, CardHead, HeadLink, IconBox, Bar, Donut, Tag, Dot, Empty, NameAvatar, C } from './ui';
import type { CourseModel, DeadlineItem, DashboardModel } from '../_lib/metrics';
import { timeAgo, dueLabel } from '../_lib/metrics';

/* ── Course progress table ───────────────────────────────────────────────── */

const progressTint = (p: number) => (p >= 80 ? C.success : p >= 40 ? C.primary : p > 0 ? C.warning : '#CBD5E1');

export const CourseProgressTable = ({
    courses, onOpen, onViewAll,
}: { courses: CourseModel[]; onOpen: (id: string) => void; onViewAll: () => void }) => (
    <Card className="flex flex-col">
        <CardHead
            title="Course Progress"
            subtitle={`${courses.length} enrolled`}
            icon={<IconBox tint={C.primary} size={34}><BookOpen size={17} strokeWidth={2.2} /></IconBox>}
            action={<HeadLink label="View All" onClick={onViewAll} />}
        />

        {courses.length === 0 ? (
            <Empty icon={<BookOpen size={20} />} title="No courses yet" hint="Once you're enrolled, your courses appear here." />
        ) : (
            <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse">
                    <thead>
                        <tr className="text-left">
                            {['Course', 'Track', 'Progress', 'Last Opened', ''].map((h, i) => (
                                <th
                                    key={h || i}
                                    className="border-b border-[#EEF0F4] px-1 pb-2 text-2xs font-semibold uppercase tracking-[0.05em] text-slate-400 dark:border-gray-800"
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {courses.slice(0, 5).map((c) => (
                            <tr
                                key={c.id}
                                className="group cursor-pointer border-b border-[#F4F6F9] last:border-0 dark:border-gray-800/70"
                                onClick={() => onOpen(c.id)}
                            >
                                <td className="px-1 py-3">
                                    <div className="flex items-center gap-2.5">
                                        <NameAvatar name={c.name} size={32} />
                                        <div className="min-w-0">
                                            <p className="max-w-[170px] truncate text-sm font-semibold text-slate-800 group-hover:text-indigo-600 dark:text-slate-100">
                                                {c.name}
                                            </p>
                                            <p className="truncate text-2xs text-slate-400">{c.code || 'No course code'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-1 py-3">
                                    <Tag label={c.level || c.category || 'General'} color={C.info} soft={C.infoSoft} />
                                </td>
                                <td className="px-1 py-3">
                                    <div className="w-[92px]">
                                        <p className="mb-1 text-xs font-bold" style={{ color: progressTint(c.progress) }}>{c.progress}%</p>
                                        <Bar value={c.progress} color={progressTint(c.progress)} height={5} />
                                    </div>
                                </td>
                                <td className="px-1 py-3 text-xs text-slate-400">
                                    {c.lastAccessed ? timeAgo(c.lastAccessed) : 'Not opened'}
                                </td>
                                <td className="px-1 py-3 text-right">
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/10">
                                        <Play size={11} strokeWidth={2.6} fill="currentColor" />
                                        {c.hasActivity ? 'Resume' : 'Start'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </Card>
);

/* ── Assignment analytics ────────────────────────────────────────────────── */

export const AssignmentAnalytics = ({ m, onViewAll }: { m: DashboardModel; onViewAll: () => void }) => {
    const s = m.totals.practice;
    const slices = [
        { label: 'Submitted', value: s.submitted, color: C.success },
        { label: 'Graded', value: s.graded, color: C.primary },
        { label: 'Awaiting review', value: s.pendingReview, color: C.info },
        { label: 'Not started', value: s.notStarted, color: C.warning },
    ];
    const total = s.assigned;

    return (
        <Card className="flex flex-col">
            <CardHead
                title="Assignment Analytics"
                subtitle="We Do exercises"
                icon={<IconBox tint={C.success} size={34}><PieChart size={17} strokeWidth={2.2} /></IconBox>}
                action={<HeadLink label="View All" onClick={onViewAll} />}
            />

            {!s.hasContent ? (
                <Empty icon={<PieChart size={20} />} title="No assignments yet" hint="We Do exercises show up here once your trainer publishes them." />
            ) : (
                <>
                    <div className="flex items-center justify-center py-1">
                        <Donut
                            slices={slices}
                            size={158}
                            thickness={24}
                            center={
                                <>
                                    <span className="text-[26px] font-bold leading-none tracking-[-0.03em] text-slate-900 dark:text-white">{total}</span>
                                    <span className="mt-1 text-2xs font-medium text-slate-400">Assigned</span>
                                </>
                            }
                        />
                    </div>

                    <div className="mt-3 space-y-1.5">
                        {slices.map((sl) => (
                            <div key={sl.label} className="flex items-center gap-2">
                                <Dot color={sl.color} />
                                <span className="flex-1 truncate text-xs text-slate-600 dark:text-slate-300">{sl.label}</span>
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{sl.value}</span>
                                <span className="w-[42px] text-right text-2xs text-slate-400">
                                    {total > 0 ? `${Math.round((sl.value / total) * 100)}%` : '0%'}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                        <div className="rounded-[14px] bg-[#F8FAFC] p-3 text-center dark:bg-gray-800/60">
                            <p className="text-[17px] font-bold leading-none tracking-[-0.02em]" style={{ color: C.primary }}>
                                {s.scorePct == null ? '—' : `${s.scorePct}%`}
                            </p>
                            <p className="mt-1.5 text-2xs font-medium text-slate-400">Average score</p>
                        </div>
                        <div className="rounded-[14px] bg-[#F8FAFC] p-3 text-center dark:bg-gray-800/60">
                            <p className="text-[17px] font-bold leading-none tracking-[-0.02em]" style={{ color: C.success }}>
                                {s.onTimePct == null ? '—' : `${s.onTimePct}%`}
                            </p>
                            <p className="mt-1.5 text-2xs font-medium text-slate-400">On-time submission</p>
                        </div>
                    </div>
                </>
            )}
        </Card>
    );
};

/* ── Upcoming schedule ───────────────────────────────────────────────────── */

const stateStyle = (d: DeadlineItem): { label: string; color: string; soft: string } => {
    if (d.state === 'overdue') return { label: d.inGrace ? 'Late window' : 'Missed', color: C.danger, soft: C.dangerSoft };
    if (d.state === 'due-today') return { label: 'Due today', color: C.warning, soft: C.warningSoft };
    if (d.state === 'due-soon') return { label: 'Due soon', color: C.warning, soft: C.warningSoft };
    if (d.state === 'opens') return { label: 'Opens', color: C.info, soft: C.infoSoft };
    return { label: d.kind, color: C.primary, soft: C.primarySoft };
};

export const UpcomingSchedule = ({
    deadlines, onCalendar,
}: { deadlines: DeadlineItem[]; onCalendar: () => void }) => (
    <Card className="flex flex-col">
        <CardHead
            title="Upcoming Schedule"
            subtitle={deadlines.length ? `${deadlines.length} items in your window` : undefined}
            icon={<IconBox tint={C.warning} size={34}><CalendarDays size={17} strokeWidth={2.2} /></IconBox>}
            action={<HeadLink label="Calendar" onClick={onCalendar} />}
        />

        {deadlines.length === 0 ? (
            <Empty icon={<CalendarDays size={20} />} title="Nothing scheduled" hint="Assignment and assessment windows appear here as they open." />
        ) : (
            <div className="relative flex flex-col">
                <span className="absolute bottom-3 left-[21px] top-3 w-px bg-[#EEF0F4] dark:bg-gray-800" aria-hidden />
                {deadlines.slice(0, 5).map((d, i) => {
                    const st = stateStyle(d);
                    return (
                        <div key={`${d.id}-${i}`} className="relative flex items-start gap-3 py-2.5">
                            <div
                                className="relative z-10 flex h-[43px] w-[43px] shrink-0 flex-col items-center justify-center rounded-[12px] border"
                                style={{ backgroundColor: st.soft, borderColor: `${st.color}22` }}
                            >
                                <span className="text-base font-bold leading-none" style={{ color: st.color }}>{d.date.getDate()}</span>
                                <span className="mt-0.5 text-2xs font-semibold uppercase tracking-wide text-slate-400">
                                    {d.date.toLocaleString('en', { month: 'short' })}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{d.title}</p>
                                    <Tag label={st.label} color={st.color} soft={st.soft} />
                                </div>
                                <p className="mt-1 flex items-center gap-1.5 truncate text-2xs text-slate-400">
                                    <Clock3 size={11} strokeWidth={2.3} />
                                    {d.date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                                    <span className="text-slate-300">·</span>
                                    <span className="truncate">{d.courseName}</span>
                                </p>
                                <p className="mt-1 text-2xs font-medium" style={{ color: st.color }}>
                                    {d.state === 'opens' ? `Opens ${d.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}` : dueLabel(d.date)}
                                    {d.durationMins > 0 && <span className="font-normal text-slate-400"> · {d.durationMins} min</span>}
                                </p>
                            </div>
                        </div>
                    );
                })}
                {deadlines.some((d) => d.state === 'overdue') && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50/70 px-3 py-2 dark:border-red-500/20 dark:bg-red-500/10">
                        <AlertTriangle size={14} strokeWidth={2.3} color={C.danger} />
                        <p className="text-xs font-medium text-red-600">
                            {deadlines.filter((d) => d.state === 'overdue').length} item(s) past their deadline
                        </p>
                    </div>
                )}
            </div>
        )}
    </Card>
);
