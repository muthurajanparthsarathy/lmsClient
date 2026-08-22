'use client';

// Rows 5 & 6 — Recent Activity · Learning Insights · Subject Mastery · Achievements.

import React from 'react';
import {
    Activity, Sparkles, BarChart3, Medal, Bell, FileCheck2, TrendingUp,
    Flag, Flame, Target, Trophy, Star, CalendarCheck2, Lock, ShieldCheck,
} from 'lucide-react';
import { Card, CardHead, HeadLink, IconBox, Bar, Tag, Empty, C } from './ui';
import type { ActivityEvent, Achievement, CourseModel, DashboardModel, Insight } from '../_lib/metrics';
import { timeAgo, gradeOf } from '../_lib/metrics';

/* ── Recent activity ─────────────────────────────────────────────────────── */

export const RecentActivity = ({
    events, onViewAll,
}: { events: ActivityEvent[]; onViewAll: () => void }) => (
    <Card className="flex flex-col">
        <CardHead
            title="Recent Activity"
            icon={<IconBox tint={C.info} size={34}><Activity size={17} strokeWidth={2.2} /></IconBox>}
            action={<HeadLink label="View All" onClick={onViewAll} />}
        />

        {events.length === 0 ? (
            <Empty icon={<Activity size={20} />} title="No activity yet" hint="Submissions and announcements land here as they happen." />
        ) : (
            <div className="relative flex flex-col">
                <span className="absolute bottom-4 left-[17px] top-4 w-px bg-[#EEF0F4] dark:bg-gray-800" aria-hidden />
                {events.map((e, i) => {
                    const isSub = e.kind === 'submission';
                    const tint = isSub ? (e.solved ? C.success : C.warning) : C.info;
                    return (
                        <div key={i} className="relative flex items-start gap-3 py-2.5">
                            <span
                                className="relative z-10 flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full border-[3px] border-white dark:border-gray-900"
                                style={{ backgroundColor: `${tint}14`, color: tint }}
                            >
                                {isSub ? <FileCheck2 size={15} strokeWidth={2.3} /> : <Bell size={15} strokeWidth={2.3} />}
                            </span>
                            <div className="min-w-0 flex-1 pt-0.5">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{e.title}</p>
                                    <span className="shrink-0 text-2xs text-slate-400">{timeAgo(e.at)}</span>
                                </div>
                                <div className="mt-0.5 flex items-center gap-2">
                                    <p className="min-w-0 flex-1 truncate text-xs text-slate-400">{e.detail}</p>
                                    {isSub && e.scorePct != null && (
                                        <Tag
                                            label={`${e.scorePct}%`}
                                            color={e.scorePct >= 70 ? C.success : e.scorePct >= 40 ? C.warning : C.danger}
                                        />
                                    )}
                                    {isSub && e.scorePct == null && <Tag label="Awaiting grade" color={C.info} soft={C.infoSoft} />}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
    </Card>
);

/* ── Learning insights ───────────────────────────────────────────────────── */

const toneStyle = (t: Insight['tone']) =>
    t === 'good' ? { color: C.success, soft: C.successSoft }
        : t === 'warn' ? { color: C.warning, soft: C.warningSoft }
            : { color: C.primary, soft: C.primarySoft };

export const LearningInsights = ({
    insights, scorePct,
}: { insights: Insight[]; scorePct: number | null }) => {
    const projected = gradeOf(scorePct);
    return (
        <Card className="flex flex-col overflow-hidden">
            <CardHead
                title="Learning Insights"
                subtitle="Generated from your own activity"
                icon={<IconBox tint={C.violet} size={34}><Sparkles size={17} strokeWidth={2.2} /></IconBox>}
            />

            {insights.length === 0 ? (
                <Empty icon={<Sparkles size={20} />} title="Not enough data yet" hint="Insights appear once you've opened lessons and submitted work." />
            ) : (
                <div className="flex flex-1 flex-col gap-2">
                    {insights.map((ins, i) => {
                        const s = toneStyle(ins.tone);
                        return (
                            <div
                                key={i}
                                className="flex items-start gap-2.5 rounded-[14px] border px-3 py-2.5"
                                style={{ backgroundColor: s.soft, borderColor: `${s.color}1F` }}
                            >
                                <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: s.color }}>
                                    <TrendingUp size={10} strokeWidth={3} color="#fff" />
                                </span>
                                <p className="text-xs font-medium leading-snug text-slate-700 dark:text-slate-200">{ins.text}</p>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-4 flex items-center justify-between rounded-[16px] border border-[#EEF0F4] bg-[#F8FAFC] px-4 py-3 dark:border-gray-800 dark:bg-gray-800/60">
                <div>
                    <p className="text-2xs font-medium text-slate-400">Tracking towards</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        {scorePct == null ? 'No graded work yet' : `${scorePct}% on graded work`}
                    </p>
                </div>
                <div
                    className="flex h-11 w-11 items-center justify-center rounded-[14px] text-[17px] font-bold"
                    style={{ backgroundColor: `${C.violet}14`, color: C.violet }}
                >
                    {projected.letter}
                </div>
            </div>
        </Card>
    );
};

/* ── Subject mastery ─────────────────────────────────────────────────────── */

export const SubjectMastery = ({ courses }: { courses: CourseModel[] }) => {
    const rows = courses
        .map((c) => ({
            name: c.name,
            score: c.scorePct,
            solved: c.practice.questionsSolved + c.assess.questionsSolved,
            attempted: c.practice.questionsAttempted + c.assess.questionsAttempted,
            progress: c.progress,
        }))
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    const graded = rows.filter((r) => r.score != null);

    return (
        <Card className="flex flex-col">
            <CardHead
                title="Subject Mastery"
                subtitle="Scored performance per course"
                icon={<IconBox tint={C.primary} size={34}><BarChart3 size={17} strokeWidth={2.2} /></IconBox>}
            />

            {rows.length === 0 ? (
                <Empty icon={<BarChart3 size={20} />} title="No courses to compare" />
            ) : (
                <div className="flex flex-1 flex-col gap-3.5">
                    {rows.slice(0, 6).map((r) => {
                        const value = r.score ?? r.progress;
                        const tint = r.score == null ? '#CBD5E1' : r.score >= 80 ? C.success : r.score >= 60 ? C.primary : r.score >= 40 ? C.warning : C.danger;
                        return (
                            <div key={r.name}>
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{r.name}</p>
                                    <span className="shrink-0 text-xs font-bold" style={{ color: tint }}>
                                        {r.score == null ? 'Not graded' : `${r.score}%`}
                                    </span>
                                </div>
                                <Bar value={value} color={tint} height={7} />
                                <p className="mt-1 text-2xs text-slate-400">
                                    {r.attempted > 0
                                        ? `${r.solved} of ${r.attempted} questions solved · ${r.progress}% course progress`
                                        : `${r.progress}% course progress · no questions attempted`}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}

            {graded.length > 0 && (
                <p className="mt-4 border-t border-[#F1F4F8] pt-3 text-2xs text-slate-400 dark:border-gray-800">
                    Strongest: <span className="font-semibold text-slate-600 dark:text-slate-300">{graded[0].name}</span>
                    {graded.length > 1 && (
                        <> · Needs work: <span className="font-semibold text-slate-600 dark:text-slate-300">{graded[graded.length - 1].name}</span></>
                    )}
                </p>
            )}
        </Card>
    );
};

/* ── Achievements ────────────────────────────────────────────────────────── */

const BADGE_ICON: Record<string, React.ReactNode> = {
    flag: <Flag size={17} strokeWidth={2.2} />,
    flame: <Flame size={17} strokeWidth={2.2} />,
    target: <Target size={17} strokeWidth={2.2} />,
    trophy: <Trophy size={17} strokeWidth={2.2} />,
    star: <Star size={17} strokeWidth={2.2} />,
    calendar: <CalendarCheck2 size={17} strokeWidth={2.2} />,
};

export const Achievements = ({
    achievements, completedCourses,
}: { achievements: Achievement[]; completedCourses: number }) => {
    const unlocked = achievements.filter((a) => a.unlocked).length;
    return (
        <Card className="flex flex-col">
            <CardHead
                title="Achievements"
                subtitle={`${unlocked} of ${achievements.length} unlocked`}
                icon={<IconBox tint={C.warning} size={34}><Medal size={17} strokeWidth={2.2} /></IconBox>}
            />

            <div className="grid grid-cols-3 gap-2.5">
                {achievements.map((a) => (
                    <div
                        key={a.id}
                        title={a.detail}
                        className="flex flex-col items-center gap-2 rounded-[16px] border px-2 py-3.5 text-center transition-colors"
                        style={{
                            borderColor: a.unlocked ? `${C.warning}2E` : '#EEF0F4',
                            backgroundColor: a.unlocked ? C.warningSoft : '#FBFCFE',
                        }}
                    >
                        <span
                            className="flex h-10 w-10 items-center justify-center rounded-[13px]"
                            style={{
                                backgroundColor: a.unlocked ? C.warning : '#EEF1F5',
                                color: a.unlocked ? '#fff' : '#B6BECB',
                            }}
                        >
                            {a.unlocked ? BADGE_ICON[a.icon] : <Lock size={15} strokeWidth={2.3} />}
                        </span>
                        <div>
                            <p className={`text-2xs font-semibold leading-tight ${a.unlocked ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}>
                                {a.label}
                            </p>
                            <p className="mt-0.5 text-2xs leading-tight text-slate-400">{a.detail}</p>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-[#EEF0F4] bg-[#F8FAFC] px-3.5 py-3 dark:border-gray-800 dark:bg-gray-800/60">
                <IconBox tint={C.info} size={32}><ShieldCheck size={16} strokeWidth={2.2} /></IconBox>
                <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Certificates</p>
                    <p className="mt-0.5 text-2xs leading-snug text-slate-400">
                        {completedCourses > 0
                            ? `${completedCourses} course(s) finished. Certificates appear here once your institution issues them.`
                            : 'Complete a full course to become eligible for a certificate.'}
                    </p>
                </div>
            </div>
        </Card>
    );
};
