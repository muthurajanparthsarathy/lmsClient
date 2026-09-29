'use client';

// Row 4 — Performance Analytics · Attendance Analytics.

import React, { useMemo } from 'react';
import {
    ResponsiveContainer, ComposedChart, Area, Line, Bar as RBar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { TrendingUp, CalendarCheck2, Info } from 'lucide-react';
import { Card, CardHead, IconBox, Donut, Dot, Empty, Tag, C } from './ui';
import type { AttendanceModel, TrendPoint } from '../_lib/metrics';
import { dayKey } from '../_lib/metrics';

/* ── Performance trend ───────────────────────────────────────────────────── */

const TrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <p className="mb-1 text-xs font-semibold text-slate-800 dark:text-slate-100">Week ending {label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Dot color={p.color || p.stroke || p.fill} />
                    {p.name}:
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {p.value == null ? 'no data' : `${p.value}${p.dataKey === 'submissions' ? '' : '%'}`}
                    </span>
                </p>
            ))}
        </div>
    );
};

export const PerformanceTrend = ({ trend }: { trend: TrendPoint[] }) => {
    const data = useMemo(
        () => trend.map((p) => ({ ...p, submissions: p.assignments + p.assessments })),
        [trend],
    );
    const hasAny = data.some((d) => d.score != null || d.attendance != null || d.submissions > 0);

    return (
        <Card className="flex flex-col">
            <CardHead
                title="Performance Analytics"
                subtitle="Last 8 weeks"
                icon={<IconBox tint={C.primary} size={34}><TrendingUp size={17} strokeWidth={2.2} /></IconBox>}
                action={
                    <div className="flex shrink-0 items-center gap-3 pt-1">
                        <span className="flex items-center gap-1.5 text-2xs font-medium text-slate-500"><Dot color={C.primary} /> Score</span>
                        <span className="flex items-center gap-1.5 text-2xs font-medium text-slate-500"><Dot color={C.success} /> Attendance</span>
                        <span className="flex items-center gap-1.5 text-2xs font-medium text-slate-500"><Dot color={`${C.info}66`} /> Submissions</span>
                    </div>
                }
            />

            {!hasAny ? (
                <Empty icon={<TrendingUp size={20} />} title="No trend data yet" hint="Your weekly scores and attendance appear once work is submitted and marked." />
            ) : (
                <div className="h-[248px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={data} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                            <defs>
                                <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={C.primary} stopOpacity={0.20} />
                                    <stop offset="100%" stopColor={C.primary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#EFF2F6" />
                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10.5, fill: '#94A3B8' }} dy={6} />
                            <YAxis yAxisId="pct" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 10.5, fill: '#94A3B8' }} tickFormatter={(v) => `${v}%`} />
                            <YAxis yAxisId="count" orientation="right" tickLine={false} axisLine={false} width={26} tick={{ fontSize: 10.5, fill: '#CBD5E1' }} allowDecimals={false} />
                            <Tooltip content={<TrendTooltip />} cursor={{ fill: 'rgba(79,70,229,0.04)' }} />
                            <RBar yAxisId="count" dataKey="submissions" name="Submissions" fill={`${C.info}33`} radius={[5, 5, 0, 0]} maxBarSize={26} />
                            <Area yAxisId="pct" type="monotone" dataKey="score" name="Score" stroke="none" fill="url(#scoreFill)" connectNulls />
                            <Line yAxisId="pct" type="monotone" dataKey="score" name="Score" stroke={C.primary} strokeWidth={2.4} dot={{ r: 3, strokeWidth: 2, fill: '#fff', stroke: C.primary }} activeDot={{ r: 5 }} connectNulls />
                            <Line yAxisId="pct" type="monotone" dataKey="attendance" name="Attendance" stroke={C.success} strokeWidth={2.2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} connectNulls />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </Card>
    );
};

/* ── Attendance analytics ────────────────────────────────────────────────── */

const MonthHeatmap = ({ byDay }: { byDay: Record<string, 'P' | 'A' | 'H'> }) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday-first

    const tint = (s?: 'P' | 'A' | 'H') =>
        s === 'P' ? C.success : s === 'H' ? C.warning : s === 'A' ? C.danger : '#F1F5F9';

    return (
        <div>
            <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {first.toLocaleString('en', { month: 'long', year: 'numeric' })}
                </p>
                <div className="flex items-center gap-2.5">
                    {[['Present', C.success], ['Half', C.warning], ['Absent', C.danger]].map(([l, c]) => (
                        <span key={l as string} className="flex items-center gap-1 text-2xs text-slate-400">
                            <Dot color={c as string} />{l}
                        </span>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <span key={i} className="pb-0.5 text-center text-2xs font-semibold text-slate-300">{d}</span>
                ))}
                {Array.from({ length: lead }).map((_, i) => <span key={`pad-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = new Date(year, month, i + 1);
                    const status = byDay[dayKey(d)];
                    const isToday = dayKey(d) === dayKey(today);
                    const marked = !!status;
                    return (
                        <span
                            key={i}
                            title={`${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${status === 'P' ? 'Present' : status === 'H' ? 'Half day' : status === 'A' ? 'Absent' : 'Not marked'}`}
                            className="flex aspect-square items-center justify-center rounded-[7px] text-2xs font-semibold"
                            style={{
                                backgroundColor: marked ? tint(status) : '#F6F8FB',
                                color: marked ? '#fff' : '#CBD5E1',
                                boxShadow: isToday ? `0 0 0 2px ${C.primary}` : undefined,
                            }}
                        >
                            {i + 1}
                        </span>
                    );
                })}
            </div>
        </div>
    );
};

export const AttendanceAnalytics = ({ a }: { a: AttendanceModel }) => {
    const slices = [
        { label: 'Present', value: a.present, color: C.success },
        { label: 'Half day', value: a.halfDay, color: C.warning },
        { label: 'Absent', value: a.absent, color: C.danger },
    ];

    return (
        <Card className="flex flex-col">
            <CardHead
                title="Attendance Analytics"
                subtitle={a.hasData ? `${a.totalDays} marked days` : undefined}
                icon={<IconBox tint={C.success} size={34}><CalendarCheck2 size={17} strokeWidth={2.2} /></IconBox>}
                action={
                    a.pct != null
                        ? <Tag label={a.pct >= 75 ? 'On track' : 'Below 75%'} color={a.pct >= 75 ? C.success : C.danger} soft={a.pct >= 75 ? C.successSoft : C.dangerSoft} />
                        : undefined
                }
            />

            {!a.hasData ? (
                <Empty icon={<CalendarCheck2 size={20} />} title="No attendance marked yet" hint="Your daily attendance shows here once your trainer starts marking." />
            ) : (
                <>
                    <div className="flex flex-col items-center gap-5 sm:flex-row">
                        <Donut
                            slices={slices}
                            size={140}
                            thickness={22}
                            center={
                                <>
                                    <span className="text-[24px] font-bold leading-none tracking-[-0.03em] text-slate-900 dark:text-white">{a.pct}%</span>
                                    <span className="mt-1 text-2xs font-medium text-slate-400">Attendance</span>
                                </>
                            }
                        />
                        <div className="w-full flex-1 space-y-2">
                            {slices.map((s) => (
                                <div key={s.label} className="flex items-center gap-2">
                                    <Dot color={s.color} />
                                    <span className="flex-1 text-xs text-slate-600 dark:text-slate-300">{s.label}</span>
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{s.value}</span>
                                    <span className="w-[42px] text-right text-2xs text-slate-400">
                                        {a.totalDays ? `${Math.round((s.value / a.totalDays) * 100)}%` : '0%'}
                                    </span>
                                </div>
                            ))}
                            {a.consecutiveAbsent >= 2 && (
                                <div className="mt-2 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/70 px-2.5 py-2 dark:border-red-500/20 dark:bg-red-500/10">
                                    <Info size={13} strokeWidth={2.3} color={C.danger} className="mt-0.5 shrink-0" />
                                    <p className="text-2xs font-medium text-red-600">
                                        {a.consecutiveAbsent} consecutive absent days recorded
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 border-t border-[#F1F4F8] pt-4 dark:border-gray-800">
                        <MonthHeatmap byDay={a.byDay} />
                    </div>

                    {a.recentAbsences.length > 0 && (
                        <div className="mt-4 space-y-1.5">
                            <p className="text-2xs font-semibold uppercase tracking-[0.05em] text-slate-400">Recent absences</p>
                            {a.recentAbsences.map((r, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                                        {r.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                    </span>
                                    <Tag label={r.status === 'A' ? 'Absent' : 'Half day'} color={r.status === 'A' ? C.danger : C.warning} soft={r.status === 'A' ? C.dangerSoft : C.warningSoft} />
                                    <span className="truncate text-slate-400">{r.reason || 'No reason recorded'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </Card>
    );
};
