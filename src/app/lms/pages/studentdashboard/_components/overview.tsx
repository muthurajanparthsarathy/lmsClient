'use client';

// Row 1 (KPI strip) and Row 2 (Learning Journey · Today's Focus · Streak).

import React from 'react';
import {
    BookOpen, Target, CalendarCheck2, Award, Clock3, ListChecks,
    GraduationCap, Users2, ClipboardCheck, Flame, Check, Sparkles,
} from 'lucide-react';
import { Card, CardHead, HeadLink, IconBox, Bar, Tag, C, Empty } from './ui';
import { durationParts, shortDuration, type DashboardModel, type FocusItem } from '../_lib/metrics';

/* ── KPI cards ───────────────────────────────────────────────────────────── */
//
// One compact card, six times over. No rings and no per-card charts: with a
// real roster (3 courses, a handful of submissions) those visuals read as
// broken rather than premium, and they forced the card to three times the
// height it needs. What's left is icon → label → number → caption, plus a
// 4px meter where the metric genuinely has a denominator.
//
// Six across a 1440px shell leaves ~124px of inner width, so the label sits on
// its own line at 12.5px (fits every title without wrapping) and captions are
// kept short enough not to ellipsise.

const Kpi = ({
    icon, tint, title, value, unit, caption, captionColor, meter, meterColor,
}: {
    icon: React.ReactNode;
    tint: string;
    title: string;
    value: React.ReactNode;
    unit?: string;
    caption: string;
    captionColor?: string;
    /** 0–100; omit to leave the meter track out entirely. */
    meter?: number | null;
    meterColor?: string;
}) => (
    <Card className="flex flex-col p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-[2px]">
        <IconBox tint={tint} size={36}>{icon}</IconBox>

        <p className="mt-3.5 truncate text-[12.5px] font-medium text-slate-500 dark:text-slate-400" title={title}>
            {title}
        </p>

        <p className="mt-1.5 flex items-baseline gap-1 text-[30px] font-bold leading-none tracking-[-0.035em] text-slate-900 dark:text-white">
            {value}
            {unit && <span className="text-[13px] font-semibold text-slate-400">{unit}</span>}
        </p>

        <p className="mt-1.5 truncate text-[11.5px] font-medium" style={{ color: captionColor || '#94A3B8' }} title={caption}>
            {caption}
        </p>

        {meter != null && (
            <div className="mt-3.5">
                <Bar value={meter} color={meterColor || tint} height={4} />
            </div>
        )}
    </Card>
);

/* ── Row 1 ───────────────────────────────────────────────────────────────── */

export const KpiRow = ({ m }: { m: DashboardModel }) => {
    const attendanceColor = m.attendance.pct != null && m.attendance.pct < 75 ? C.danger : C.success;
    const overdue = m.deadlines.filter((d) => d.state === 'overdue').length;
    const studyTime = durationParts(m.time.totalSeconds);

    return (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-6">
            <Kpi
                icon={<BookOpen size={18} strokeWidth={2.2} />}
                tint={C.primary}
                title="Active Courses"
                value={m.activeCourses}
                caption={m.activeCourses ? `${m.inProgress} in progress` : 'Not enrolled yet'}
                captionColor={C.primary}
                meter={m.activeCourses ? (m.completed / m.activeCourses) * 100 : 0}
            />

            <Kpi
                icon={<Target size={18} strokeWidth={2.2} />}
                tint={C.violet}
                title="Overall Progress"
                value={`${m.overallProgress}%`}
                caption={m.solvedThisMonth ? `${m.solvedThisMonth} solved · 30d` : 'No activity · 30d'}
                captionColor={m.solvedThisMonth ? C.success : undefined}
                meter={m.overallProgress}
                meterColor={C.violet}
            />

            <Kpi
                icon={<CalendarCheck2 size={18} strokeWidth={2.2} />}
                tint={C.success}
                title="Attendance"
                value={m.attendance.pct == null ? '—' : `${m.attendance.pct}%`}
                caption={m.attendance.hasData ? `${m.attendance.present} of ${m.attendance.totalDays} days` : 'Not marked yet'}
                captionColor={m.attendance.hasData ? attendanceColor : undefined}
                meter={m.attendance.pct}
                meterColor={attendanceColor}
            />

            <Kpi
                icon={<Award size={18} strokeWidth={2.2} />}
                tint={C.warning}
                title="Current Grade"
                value={m.grade.letter}
                caption={m.scorePct == null ? 'Nothing graded' : `${m.scorePct}% average`}
                captionColor={m.scorePct == null ? undefined : m.scorePct >= 70 ? C.success : C.warning}
                meter={m.scorePct}
                meterColor={C.warning}
            />

            <Kpi
                icon={<Clock3 size={18} strokeWidth={2.2} />}
                tint={C.info}
                title="Study Hours"
                value={studyTime.value}
                unit={studyTime.unit}
                caption={
                    m.time.tracked
                        ? `${shortDuration(m.time.exerciseSeconds)} on exercises`
                        : m.time.zeroDuration
                            ? `${m.time.sessions} sessions, untimed`
                            : 'No tracked time yet'
                }
                captionColor={m.time.tracked ? C.info : undefined}
                meter={m.time.totalSeconds > 0 ? (m.time.exerciseSeconds / m.time.totalSeconds) * 100 : 0}
                meterColor={C.info}
            />

            <Kpi
                icon={<ListChecks size={18} strokeWidth={2.2} />}
                tint={C.danger}
                title="Pending Tasks"
                value={m.pendingThisWeek}
                caption={overdue ? `${overdue} overdue` : m.pendingThisWeek ? 'Due this week' : 'All clear'}
                captionColor={overdue || m.pendingThisWeek ? C.danger : C.success}
                meter={m.pendingThisWeek ? (overdue / m.pendingThisWeek) * 100 : 0}
                meterColor={C.danger}
            />
        </div>
    );
};

/* ── Learning Journey (hero) ─────────────────────────────────────────────── */

const StageRow = ({
    tint, soft, title, caption, icon, value, stats, empty,
}: {
    tint: string; soft: string; title: string; caption: string; icon: React.ReactNode;
    value: number; stats: { label: string; value: string }[]; empty: boolean;
}) => (
    <div className="flex flex-col gap-3 rounded-[16px] border border-[#EEF0F4] p-3 md:flex-row md:items-center dark:border-gray-800">
        <div
            className="flex shrink-0 items-center gap-3 rounded-[13px] px-3 py-2.5 md:w-[186px]"
            style={{ backgroundColor: soft }}
        >
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px] text-white" style={{ backgroundColor: tint }}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-[13px] font-bold tracking-[-0.01em] text-slate-900">{title}</p>
                <p className="truncate text-[11px] text-slate-500">{caption}</p>
            </div>
        </div>

        <div className="min-w-0 flex-1">
            {empty ? (
                <p className="py-2 text-[12px] text-slate-400">No content configured for this stage yet.</p>
            ) : (
                <>
                    <div className="flex items-center gap-3">
                        <span className="w-[46px] shrink-0 text-[19px] font-bold leading-none tracking-[-0.02em]" style={{ color: tint }}>
                            {value}%
                        </span>
                        <div className="flex-1"><Bar value={value} color={tint} height={7} /></div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-5">
                        {stats.map((s) => (
                            <div key={s.label} className="min-w-0">
                                <p className="truncate text-[13px] font-bold text-slate-800 dark:text-slate-100">{s.value}</p>
                                <p className="truncate text-[10.5px] text-slate-400">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    </div>
);

export const LearningJourney = ({ m, onDetails }: { m: DashboardModel; onDetails: () => void }) => {
    const { learn, practice, assess } = m.totals;
    return (
        <Card className="flex flex-col">
            <CardHead
                title="Learning Journey"
                subtitle="Learn → Practice → Assess, pooled across your courses"
                icon={<IconBox tint={C.primary} size={34}><GraduationCap size={17} strokeWidth={2.2} /></IconBox>}
                action={<HeadLink label="View Details" onClick={onDetails} />}
            />

            <div className="flex flex-col gap-3">
                <StageRow
                    tint={C.violet} soft={C.violetSoft}
                    title="I DO" caption="Learning Resources"
                    icon={<BookOpen size={17} strokeWidth={2.3} />}
                    value={learn.completionPct}
                    empty={!learn.hasContent}
                    stats={[
                        { label: 'Resources', value: `${learn.opened} / ${learn.total}` },
                        { label: 'Videos', value: `${learn.byKind.video.opened} / ${learn.byKind.video.total}` },
                        { label: 'PDFs', value: `${learn.byKind.pdf.opened} / ${learn.byKind.pdf.total}` },
                        { label: 'Slides', value: `${learn.byKind.ppt.opened} / ${learn.byKind.ppt.total}` },
                        { label: 'Time spent', value: m.time.tracked ? shortDuration(m.time.contentSeconds) : '—' },
                    ]}
                />
                <StageRow
                    tint={C.success} soft={C.successSoft}
                    title="WE DO" caption="Assignments"
                    icon={<Users2 size={17} strokeWidth={2.3} />}
                    value={practice.completionPct}
                    empty={!practice.hasContent}
                    stats={[
                        { label: 'Assigned', value: `${practice.started} / ${practice.assigned}` },
                        { label: 'Submitted', value: `${practice.submitted}` },
                        { label: 'Graded', value: `${practice.graded}` },
                        { label: 'Awaiting review', value: `${practice.pendingReview}` },
                        { label: 'Time spent', value: m.time.tracked ? shortDuration(m.time.weDoSeconds) : '—' },
                    ]}
                />
                <StageRow
                    tint={C.warning} soft={C.warningSoft}
                    title="YOU DO" caption="Assessments"
                    icon={<ClipboardCheck size={17} strokeWidth={2.3} />}
                    value={assess.completionPct}
                    empty={!assess.hasContent}
                    stats={[
                        { label: 'Assessments', value: `${assess.started} / ${assess.assigned}` },
                        { label: 'Completed', value: `${assess.submitted}` },
                        { label: 'Average score', value: assess.scorePct == null ? '—' : `${assess.scorePct}%` },
                        { label: 'Not started', value: `${assess.notStarted}` },
                        { label: 'Time spent', value: m.time.tracked ? shortDuration(m.time.youDoSeconds) : '—' },
                    ]}
                />
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-indigo-100 bg-indigo-50/60 px-3.5 py-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                <IconBox tint={C.primary} size={32}><Sparkles size={16} strokeWidth={2.2} /></IconBox>
                <p className="text-[12.5px] font-medium leading-snug text-slate-700 dark:text-slate-200">
                    {m.insights[0]?.text || 'Open a lesson to start your learning cycle.'}
                </p>
            </div>
        </Card>
    );
};

/* ── Today's Focus ───────────────────────────────────────────────────────── */

export const TodayFocus = ({
    items, onViewPlan,
}: { items: FocusItem[]; onViewPlan: () => void }) => {
    const done = items.filter((i) => i.done).length;
    return (
        <Card className="flex flex-col">
            <CardHead
                title="Today's Focus"
                icon={<IconBox tint={C.success} size={34}><Target size={17} strokeWidth={2.2} /></IconBox>}
                action={
                    <span className="shrink-0 pt-1 text-[12px] font-semibold text-slate-400">
                        {done} of {items.length} done
                    </span>
                }
            />

            {items.length === 0 ? (
                <Empty icon={<Target size={20} />} title="Nothing queued" hint="New assignments and assessments appear here automatically." />
            ) : (
                <div className="flex flex-1 flex-col gap-0.5">
                    {items.map((i) => (
                        <div key={i.id} className="flex items-center gap-3 rounded-xl px-1 py-[9px] transition-colors hover:bg-slate-50 dark:hover:bg-gray-800/60">
                            <span
                                className="flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                                style={{
                                    borderColor: i.done ? C.success : '#D9DEE7',
                                    backgroundColor: i.done ? C.success : 'transparent',
                                }}
                            >
                                {i.done && <Check size={11} strokeWidth={3.4} color="#fff" />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className={`truncate text-[12.5px] font-medium ${i.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {i.label}
                                </p>
                            </div>
                            <span className="shrink-0 text-[11px] text-slate-400">{i.meta}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-3">
                <Bar value={items.length ? (done / items.length) * 100 : 0} color={C.success} height={5} />
            </div>
            <button
                onClick={onViewPlan}
                className="mt-3.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#E5E7EB] text-[12.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-gray-800 dark:text-slate-300 dark:hover:bg-gray-800"
            >
                View full plan
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
            </button>
        </Card>
    );
};

/* ── Streak ──────────────────────────────────────────────────────────────── */

export const StreakCard = ({ m }: { m: DashboardModel }) => (
    <Card>
        <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
                <IconBox tint={C.warning} size={34}><Flame size={17} strokeWidth={2.2} /></IconBox>
                <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">Streak</h3>
            </div>
            <Tag label={`${m.momentum.activeDays30} active days / 30`} color={C.warning} soft={C.warningSoft} />
        </div>

        <div className="mt-3 text-center">
            <p className="text-[30px] font-bold leading-none tracking-[-0.03em] text-slate-900 dark:text-white">
                {m.momentum.streak} <span className="text-[15px] font-semibold text-slate-400">day{m.momentum.streak === 1 ? '' : 's'}</span>
            </p>
            <p className="mt-1.5 text-[11.5px] text-slate-400">
                {m.momentum.hasAny
                    ? `${m.momentum.weekTotal} submission${m.momentum.weekTotal === 1 ? '' : 's'} this week`
                    : 'Submit an answer to start your streak'}
            </p>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5">
            {m.momentum.week.map((d) => {
                const active = d.count > 0;
                return (
                    <div key={d.key} className="flex flex-col items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-400">{d.dow}</span>
                        <span
                            className="flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-bold"
                            style={{
                                backgroundColor: active ? C.success : 'transparent',
                                borderColor: d.isToday ? C.warning : active ? C.success : '#E5E7EB',
                                borderWidth: d.isToday ? 2 : 1,
                                color: active ? '#fff' : d.isFuture ? '#CBD5E1' : '#94A3B8',
                            }}
                            title={`${d.count} submission${d.count === 1 ? '' : 's'}`}
                        >
                            {active ? <Check size={12} strokeWidth={3.2} /> : d.dom}
                        </span>
                    </div>
                );
            })}
        </div>
    </Card>
);

/* ── Motivation ──────────────────────────────────────────────────────────── */

export const MotivationCard = ({ name }: { name: string }) => (
    <Card className="relative overflow-hidden border-transparent bg-gradient-to-br from-indigo-50 via-white to-violet-50 dark:from-indigo-500/10 dark:via-gray-900 dark:to-violet-500/10">
        <div className="relative z-10 max-w-[76%]">
            <p className="text-[13.5px] font-semibold leading-snug tracking-[-0.01em] text-slate-800 dark:text-slate-100">
                “The best investment you can make is in yourself.”
            </p>
            <p className="mt-2 text-[11.5px] text-slate-500 dark:text-slate-400">
                Keep going, {name} — small daily progress compounds.
            </p>
        </div>
        <svg className="absolute -bottom-3 -right-2 h-[104px] w-[104px] opacity-90" viewBox="0 0 120 120" fill="none" aria-hidden>
            <circle cx="78" cy="52" r="34" fill={C.primary} opacity="0.10" />
            <rect x="30" y="72" width="62" height="8" rx="4" fill={C.primary} opacity="0.22" />
            <rect x="44" y="40" width="34" height="30" rx="5" fill={C.primary} opacity="0.34" />
            <rect x="50" y="47" width="22" height="4" rx="2" fill="#fff" opacity="0.85" />
            <rect x="50" y="55" width="14" height="4" rx="2" fill="#fff" opacity="0.7" />
            <circle cx="36" cy="46" r="9" fill={C.warning} opacity="0.5" />
        </svg>
    </Card>
);
