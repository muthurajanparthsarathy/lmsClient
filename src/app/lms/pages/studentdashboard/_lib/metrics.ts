// ─────────────────────────────────────────────────────────────────────────────
// Student Dashboard — derivation layer.
//
// Everything the dashboard renders is computed here from what the platform
// actually writes:
//   · content  → analytics payload (courses → modules → subModules → topics
//                → subTopics, each carrying its own `pedagogy`)
//   · progress → user.courses[].answers.{I_Do,We_Do,You_Do} and
//                user.courses[].progress.{openedResources,visitedNodes,...}
//   · presence → StudentAttendance rows (P / A / H) for the signed-in student
//
// No metric in this file is invented. When a source is missing the model
// reports `null` / `0` with a `hasContent` flag so the UI can say "no data"
// instead of showing a confident wrong number.
// ─────────────────────────────────────────────────────────────────────────────

/* ── generic helpers ─────────────────────────────────────────────────────── */

export const idStr = (v: any): string => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
        if (typeof v.$oid === 'string') return v.$oid;
        if (v._id != null) return idStr(v._id);
    }
    return String(v);
};

export const dayKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export const pct = (part: number, whole: number) =>
    whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0;

export const timeAgo = (date: string | Date) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

export const dueLabel = (date: Date) => {
    const ms = new Date(date).getTime() - Date.now();
    const days = Math.ceil(ms / 86400000);
    if (ms < 0) {
        const over = Math.abs(Math.floor(ms / 86400000));
        return over === 0 ? 'Overdue' : `${over}d overdue`;
    }
    if (days <= 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    if (days <= 7) return `Due in ${days} days`;
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

/* ── content walking ─────────────────────────────────────────────────────── */

export type NodeKind = 'module' | 'submodule' | 'topic' | 'subtopic';
export interface ContentNode { node: any; kind: NodeKind }

/**
 * Every pedagogy-carrying entity under a course.
 *
 * Pedagogy hangs off FOUR levels in this schema — Module, SubModule, Topic and
 * SubTopic — and the staff-side analytics walks all four. Walking only topics
 * (what the old dashboard did) shrinks both numerator and denominator and makes
 * the percentages disagree with the trainer's view of the same student.
 */
export const collectNodes = (course: any): ContentNode[] => {
    const out: ContentNode[] = [];
    const pushTopic = (t: any) => {
        out.push({ node: t, kind: 'topic' });
        (t?.subTopics || []).forEach((st: any) => out.push({ node: st, kind: 'subtopic' }));
    };
    (course?.modules || []).forEach((m: any) => {
        out.push({ node: m, kind: 'module' });
        (m?.topics || []).forEach(pushTopic);
        (m?.subModules || []).forEach((sm: any) => {
            out.push({ node: sm, kind: 'submodule' });
            (sm?.topics || []).forEach(pushTopic);
        });
    });
    return out;
};

/**
 * An exercise is only a student's business once its approval workflow clears.
 * Exercises with no workflow configured (the common case) are always visible.
 */
const isVisibleExercise = (ex: any) => {
    const wf = ex?.approvalWorkflow;
    if (!wf || !Array.isArray(wf.steps) || wf.steps.length === 0) return true;
    return wf.overallStatus === 'approved' || wf.studentVisible === true;
};

/** Flatten a pedagogy bucket (subcategory → exercise[]) into visible exercises. */
const bucketExercises = (bucket: any): any[] => {
    const out: any[] = [];
    Object.entries(bucket || {}).forEach(([subcategory, arr]: [string, any]) => {
        if (!Array.isArray(arr)) return;
        arr.forEach((ex: any) => { if (ex && isVisibleExercise(ex)) out.push({ ...ex, subcategory }); });
    });
    return out;
};

/* ── I Do resources ──────────────────────────────────────────────────────── */

export type ResourceKind = 'video' | 'pdf' | 'ppt' | 'doc' | 'other';

const resourceKind = (f: any): ResourceKind => {
    if (f?.isVideo) return 'video';
    const t = String(f?.fileType || '').toLowerCase();
    const n = String(f?.fileName || '').toLowerCase();
    if (t.includes('video') || /\.(mp4|mkv|mov|webm|avi)$/.test(n)) return 'video';
    if (t.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
    if (t.includes('ppt') || t.includes('presentation') || /\.pptx?$/.test(n)) return 'ppt';
    if (t.includes('doc') || t.includes('word') || /\.(docx?|txt|md)$/.test(n)) return 'doc';
    return 'other';
};

/** Recursively pull student-visible files out of a pedagogy element. */
const collectFiles = (container: any, out: any[]) => {
    if (!container || typeof container !== 'object') return;
    (container.files || []).forEach((f: any) => {
        if (f?.fileSettings?.showToStudents !== false) out.push(f);
    });
    (container.folders || []).forEach((folder: any) => collectFiles(folder, out));
    if (Array.isArray(container.subfolders)) container.subfolders.forEach((sf: any) => collectFiles(sf, out));
};

/* ── answer scanning ─────────────────────────────────────────────────────── */

const ATTEMPTED = new Set(['attempted', 'submitted', 'evaluated', 'solved']);

const isAttempted = (q: any) =>
    ATTEMPTED.has(String(q?.status || '').toLowerCase()) || !!q?.submittedAt;

const isEvaluated = (q: any) => String(q?.status || '').toLowerCase() === 'evaluated';

const isSolved = (q: any) => {
    const st = String(q?.status || '').toLowerCase();
    return st === 'solved' || st === 'evaluated' || q?.isCorrect === true;
};

/** Student's answer documents for one pedagogy stage of one course. */
const answerExercises = (bucket: any): any[] => {
    const out: any[] = [];
    Object.values(bucket || {}).forEach((arr: any) => {
        if (Array.isArray(arr)) arr.forEach((ex: any) => { if (ex) out.push(ex); });
    });
    return out;
};

export interface StageStats {
    assigned: number;          // exercises configured in the content
    started: number;           // exercises with at least one attempted question
    submitted: number;         // exercises the student pushed a submission for
    graded: number;            // exercises carrying at least one evaluated question
    pendingReview: number;     // submitted but not yet graded
    notStarted: number;
    questionsTotal: number;
    questionsAttempted: number;
    questionsSolved: number;
    scoreObtained: number;
    scoreMax: number;
    scorePct: number | null;   // null → nothing graded yet
    onTimePct: number | null;
    lateCount: number;
    hasContent: boolean;
    completionPct: number;
}

const emptyStage = (): StageStats => ({
    assigned: 0, started: 0, submitted: 0, graded: 0, pendingReview: 0, notStarted: 0,
    questionsTotal: 0, questionsAttempted: 0, questionsSolved: 0,
    scoreObtained: 0, scoreMax: 0, scorePct: null, onTimePct: null, lateCount: 0,
    hasContent: false, completionPct: 0,
});

const buildStage = (contentExercises: any[], studentExercises: any[]): StageStats => {
    const s = emptyStage();

    s.assigned = contentExercises.length;
    s.questionsTotal = contentExercises.reduce((n, ex) => n + (ex?.questions?.length || 0), 0);

    studentExercises.forEach((ex: any) => {
        const qs = ex?.questions || [];
        const attempted = qs.filter(isAttempted);
        if (attempted.length === 0) return;

        s.started++;
        if (ex?.status === 'completed' || attempted.length === qs.length || ex?.lastTestSubmittedAt) s.submitted++;
        if (qs.some(isEvaluated)) s.graded++;
        if (ex?.lateSubmission === true) s.lateCount++;

        s.questionsAttempted += attempted.length;
        s.questionsSolved += qs.filter(isSolved).length;
        qs.forEach((q: any) => {
            const max = Number(q?.totalScore) || 0;
            if (max > 0) { s.scoreMax += max; s.scoreObtained += Number(q?.score) || 0; }
        });
    });

    // The student can hold answers for exercises the content walk missed
    // (renamed sub-categories, moved nodes) — never report more done than exists.
    s.assigned = Math.max(s.assigned, s.started);
    s.questionsTotal = Math.max(s.questionsTotal, s.questionsAttempted);
    s.submitted = Math.min(s.submitted, s.started);
    s.notStarted = Math.max(0, s.assigned - s.started);
    s.pendingReview = Math.max(0, s.submitted - s.graded);
    s.scorePct = s.scoreMax > 0 ? Math.round((s.scoreObtained / s.scoreMax) * 100) : null;
    s.onTimePct = s.submitted > 0 ? Math.round(((s.submitted - s.lateCount) / s.submitted) * 100) : null;
    s.hasContent = s.assigned > 0 || s.questionsTotal > 0;
    s.completionPct = s.assigned > 0 ? pct(s.started, s.assigned) : 0;
    return s;
};

/* ── I Do stage ──────────────────────────────────────────────────────────── */

export interface LearnStats {
    total: number;
    opened: number;
    byKind: Record<ResourceKind, { total: number; opened: number }>;
    mcqDocs: number;            // documents carrying checkpoint questions
    mcqCompleted: number;
    completionPct: number;
    hasContent: boolean;
    contentMinutes: number;
    completedMinutes: number;
}

const emptyLearn = (): LearnStats => ({
    total: 0, opened: 0,
    byKind: {
        video: { total: 0, opened: 0 }, pdf: { total: 0, opened: 0 }, ppt: { total: 0, opened: 0 },
        doc: { total: 0, opened: 0 }, other: { total: 0, opened: 0 },
    },
    mcqDocs: 0, mcqCompleted: 0, completionPct: 0, hasContent: false,
    contentMinutes: 0, completedMinutes: 0,
});

/* ── per-course model ────────────────────────────────────────────────────── */

export interface CourseModel {
    id: string;
    name: string;
    code: string;
    level: string;
    category: string;
    image: string;
    lastAccessed: Date | null;
    learn: LearnStats;
    practice: StageStats;   // We Do
    assess: StageStats;     // You Do
    progress: number;       // blended across the stages that have content
    scorePct: number | null;
    hasActivity: boolean;
}

const buildCourse = (content: any, raw: any): CourseModel => {
    const nodes = collectNodes(content);
    const answers = raw?.answers || {};
    const openedIds = new Set<string>((raw?.progress?.openedResources || []).map((r: any) => idStr(r)));

    /* I Do — resources and checkpoint documents */
    const learn = emptyLearn();
    const iDoAnswers = answers.I_Do || {};
    nodes.forEach(({ node, kind }) => {
        const files: any[] = [];
        Object.values(node?.pedagogy?.I_Do || {}).forEach((element: any) => collectFiles(element, files));

        files.forEach((f: any) => {
            const k = resourceKind(f);
            const fid = idStr(f?._id);
            const seen = openedIds.has(fid) || !!(iDoAnswers as any)[fid];
            learn.total++;
            learn.byKind[k].total++;
            if (seen) { learn.opened++; learn.byKind[k].opened++; }
            if ((f?.mcqQuestions || []).some((q: any) => q?.isActive !== false)) {
                learn.mcqDocs++;
                const rec = (iDoAnswers as any)[fid];
                if (rec && Number(rec.completionPercentage) >= 100) learn.mcqCompleted++;
            }
        });

        // Content duration lives on topics (schema default 30 min).
        if (kind === 'topic') {
            const mins = Number(node?.duration) || 0;
            learn.contentMinutes += mins;
            const topicFiles = files.length;
            const topicOpened = files.filter((f: any) => openedIds.has(idStr(f?._id))).length;
            learn.completedMinutes += topicFiles > 0 ? (mins * topicOpened) / topicFiles : 0;
        }
    });
    learn.completionPct = pct(learn.opened, learn.total);
    learn.hasContent = learn.total > 0;

    /* We Do / You Do */
    const contentWe: any[] = [];
    const contentYou: any[] = [];
    nodes.forEach(({ node }) => {
        contentWe.push(...bucketExercises(node?.pedagogy?.We_Do));
        contentYou.push(...bucketExercises(node?.pedagogy?.You_Do));
    });
    const practice = buildStage(contentWe, answerExercises(answers.We_Do));
    const assess = buildStage(contentYou, answerExercises(answers.You_Do));

    // Minutes actually spent inside submitted exercises, as configured.
    [contentWe, contentYou].forEach((list) => {
        list.forEach((ex: any) => { learn.contentMinutes += Number(ex?.exerciseInformation?.totalDuration) || 0; });
    });
    const submittedRatio = (practice.assigned + assess.assigned) > 0
        ? (practice.started + assess.started) / (practice.assigned + assess.assigned) : 0;
    learn.completedMinutes += submittedRatio * (contentWe.concat(contentYou)
        .reduce((n, ex: any) => n + (Number(ex?.exerciseInformation?.totalDuration) || 0), 0));

    /* blended progress — only stages that actually carry content count */
    const parts: number[] = [];
    if (learn.hasContent) parts.push(learn.completionPct);
    if (practice.hasContent) parts.push(practice.completionPct);
    if (assess.hasContent) parts.push(assess.completionPct);
    const progress = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;

    const scoreMax = practice.scoreMax + assess.scoreMax;
    const scoreObtained = practice.scoreObtained + assess.scoreObtained;

    return {
        id: idStr(content?._id),
        name: content?.courseName || 'Untitled course',
        code: content?.courseCode || '',
        level: content?.courseLevel || '',
        category: content?.category || content?.serviceType || '',
        image: content?.courseImage || '',
        lastAccessed: raw?.lastAccessed ? new Date(raw.lastAccessed) : null,
        learn, practice, assess, progress,
        scorePct: scoreMax > 0 ? Math.round((scoreObtained / scoreMax) * 100) : null,
        hasActivity: learn.opened > 0 || practice.started > 0 || assess.started > 0,
    };
};

/* ── deadlines & schedule ────────────────────────────────────────────────── */

export type DeadlineState = 'overdue' | 'due-today' | 'due-soon' | 'upcoming' | 'opens';

export interface DeadlineItem {
    id: string;
    title: string;
    courseName: string;
    stage: 'We Do' | 'You Do';
    kind: 'Assignment' | 'Assessment';
    date: Date;
    state: DeadlineState;
    attempted: boolean;
    inGrace: boolean;
    durationMins: number;
}

const buildDeadlines = (contentCourses: any[], rawCourses: any[]): DeadlineItem[] => {
    const now = Date.now();

    // Every exercise the student has already touched.
    const touched = new Set<string>();
    rawCourses.forEach((uc: any) => {
        (['We_Do', 'You_Do'] as const).forEach((b) => {
            answerExercises(uc?.answers?.[b]).forEach((ex: any) => {
                const id = idStr(ex?.exerciseId); if (id) touched.add(id);
            });
        });
    });

    const items: DeadlineItem[] = [];
    contentCourses.forEach((course: any) => {
        collectNodes(course).forEach(({ node }) => {
            (['We_Do', 'You_Do'] as const).forEach((bucket) => {
                bucketExercises(node?.pedagogy?.[bucket]).forEach((ex: any) => {
                    const ap = ex?.availabilityPeriod || {};
                    const start = ap.startDate ? new Date(ap.startDate) : null;
                    const end = ap.endDate ? new Date(ap.endDate) : null;
                    const cutOff = ap.cutOffEnabled && ap.cutOffDate ? new Date(ap.cutOffDate) : null;
                    const id = idStr(ex?._id) || idStr(ex?.exerciseInformation?.exerciseId);
                    const attempted = touched.has(id) || touched.has(idStr(ex?.exerciseInformation?.exerciseId));

                    const base = {
                        id,
                        title: ex?.exerciseInformation?.exerciseName || ex?.subcategory || 'Exercise',
                        courseName: course?.courseName || 'Course',
                        stage: (bucket === 'We_Do' ? 'We Do' : 'You Do') as 'We Do' | 'You Do',
                        kind: (bucket === 'We_Do' ? 'Assignment' : 'Assessment') as 'Assignment' | 'Assessment',
                        attempted,
                        durationMins: Number(ex?.exerciseInformation?.totalDuration) || 0,
                    };

                    // Not open yet — worth surfacing as "opens on".
                    if (start && start.getTime() > now) {
                        items.push({ ...base, date: start, state: 'opens', inGrace: false });
                        return;
                    }
                    if (!end || isNaN(end.getTime())) return;

                    const ms = end.getTime() - now;
                    const graceEnd = cutOff && !isNaN(cutOff.getTime()) ? cutOff.getTime() : null;
                    let state: DeadlineState;
                    if (ms < 0) state = 'overdue';
                    else if (ms < 86400000) state = 'due-today';
                    else if (ms < 3 * 86400000) state = 'due-soon';
                    else state = 'upcoming';

                    // A closed-and-submitted item is history, not an action.
                    if (state === 'overdue' && attempted) return;

                    items.push({
                        ...base,
                        date: end,
                        state,
                        inGrace: state === 'overdue' && graceEnd != null && graceEnd > now,
                    });
                });
            });
        });
    });

    return items.sort((a, b) => {
        const rank = (s: DeadlineState) => (s === 'overdue' ? 0 : s === 'due-today' ? 1 : s === 'due-soon' ? 2 : s === 'upcoming' ? 3 : 4);
        const r = rank(a.state) - rank(b.state);
        return r !== 0 ? r : a.date.getTime() - b.date.getTime();
    });
};

/* ── attendance ──────────────────────────────────────────────────────────── */

export interface AttendanceModel {
    present: number;
    absent: number;
    halfDay: number;
    totalDays: number;
    pct: number | null;              // null → nothing marked yet
    byDay: Record<string, 'P' | 'A' | 'H'>;
    recentAbsences: { date: Date; reason: string; status: 'A' | 'H' }[];
    consecutiveAbsent: number;
    hasData: boolean;
}

export const buildAttendance = (records: any[]): AttendanceModel => {
    const byDay: Record<string, 'P' | 'A' | 'H'> = {};
    const absences: { date: Date; reason: string; status: 'A' | 'H' }[] = [];
    let present = 0, absent = 0, halfDay = 0;

    [...records]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach((r: any) => {
            const d = new Date(r.date);
            if (isNaN(d.getTime())) return;
            const k = dayKey(d);
            const status = r.status as 'P' | 'A' | 'H';
            // A present mark in any course wins the day; a half-day beats an absence.
            const prev = byDay[k];
            if (prev === 'P') return;
            if (prev === 'H' && status === 'A') return;
            byDay[k] = status;
            if (status === 'A' || status === 'H') {
                absences.push({ date: d, reason: r.reason || '', status });
            }
        });

    Object.values(byDay).forEach((s) => {
        if (s === 'P') present++; else if (s === 'A') absent++; else halfDay++;
    });

    const totalDays = present + absent + halfDay;
    // Half-days count as half a presence — the same rule the grid uses.
    const attended = present + halfDay * 0.5;

    // Trailing run of absent days, most recent first.
    const orderedKeys = Object.keys(byDay).sort().reverse();
    let consecutiveAbsent = 0;
    for (const k of orderedKeys) {
        if (byDay[k] === 'A') consecutiveAbsent++; else break;
    }

    return {
        present, absent, halfDay, totalDays,
        pct: totalDays > 0 ? Math.round((attended / totalDays) * 100) : null,
        byDay,
        recentAbsences: absences.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 4),
        consecutiveAbsent,
        hasData: totalDays > 0,
    };
};

/* ── activity, streak & trend ────────────────────────────────────────────── */

export interface ActivityEvent {
    at: Date;
    kind: 'submission' | 'notification';
    title: string;
    detail: string;
    stage?: 'We Do' | 'You Do';
    scorePct?: number | null;
    solved?: boolean;
}

export interface MomentumModel {
    streak: number;
    week: { key: string; dow: string; dom: number; count: number; isToday: boolean; isFuture: boolean }[];
    weekTotal: number;
    activeDays30: number;
    hasAny: boolean;
}

export interface TrendPoint {
    label: string;
    score: number | null;
    assignments: number;
    assessments: number;
    attendance: number | null;
}

interface Submission {
    at: Date;
    stage: 'We Do' | 'You Do';
    courseName: string;
    exerciseName: string;
    score: number;
    maxScore: number;
    solved: boolean;
    evaluated: boolean;
}

const collectSubmissions = (rawCourses: any[], nameById: Record<string, string>): Submission[] => {
    const out: Submission[] = [];
    rawCourses.forEach((uc: any) => {
        const courseName = nameById[idStr(uc?.courseId)] || 'Course';
        (['We_Do', 'You_Do'] as const).forEach((bucket) => {
            answerExercises(uc?.answers?.[bucket]).forEach((ex: any) => {
                (ex?.questions || []).forEach((q: any) => {
                    if (!q?.submittedAt) return;
                    const at = new Date(q.submittedAt);
                    if (isNaN(at.getTime())) return;
                    out.push({
                        at,
                        stage: bucket === 'We_Do' ? 'We Do' : 'You Do',
                        courseName,
                        exerciseName: ex?.exerciseName || q?.questionTitle || 'Exercise',
                        score: Number(q?.score) || 0,
                        maxScore: Number(q?.totalScore) || 0,
                        solved: isSolved(q),
                        evaluated: isEvaluated(q),
                    });
                });
            });
        });
    });
    return out.sort((a, b) => b.at.getTime() - a.at.getTime());
};

const buildMomentum = (subs: Submission[]): MomentumModel => {
    const counts = new Map<string, number>();
    subs.forEach((s) => counts.set(dayKey(s.at), (counts.get(dayKey(s.at)) || 0) + 1));

    const todayKey = dayKey(new Date());
    const week: MomentumModel['week'] = [];
    // Monday-first week, matching the reference's M-T-W-T-F-S-S strip.
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const offset = (today.getDay() + 6) % 7;
    const monday = new Date(today); monday.setDate(today.getDate() - offset);
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday); d.setDate(monday.getDate() + i);
        const k = dayKey(d);
        week.push({
            key: k,
            dow: d.toLocaleDateString('en', { weekday: 'narrow' }),
            dom: d.getDate(),
            count: counts.get(k) || 0,
            isToday: k === todayKey,
            isFuture: d.getTime() > today.getTime(),
        });
    }

    let streak = 0;
    const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
    if (!counts.get(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (counts.get(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }

    const cut = Date.now() - 30 * 86400000;
    const activeDays30 = new Set(subs.filter((s) => s.at.getTime() >= cut).map((s) => dayKey(s.at))).size;

    return {
        streak,
        week,
        weekTotal: week.reduce((a, d) => a + d.count, 0),
        activeDays30,
        hasAny: counts.size > 0,
    };
};

const buildTrend = (subs: Submission[], attendance: AttendanceModel): TrendPoint[] => {
    const weeks = 8;
    const points: TrendPoint[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (let w = weeks - 1; w >= 0; w--) {
        const end = new Date(today); end.setDate(today.getDate() - w * 7);
        const start = new Date(end); start.setDate(end.getDate() - 6);
        const inRange = (d: Date) => d.getTime() >= start.getTime() && d.getTime() <= end.getTime() + 86399999;

        const bucket = subs.filter((s) => inRange(s.at));
        const graded = bucket.filter((s) => s.maxScore > 0);
        const obtained = graded.reduce((a, s) => a + s.score, 0);
        const max = graded.reduce((a, s) => a + s.maxScore, 0);

        let marked = 0, attended = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(start); d.setDate(start.getDate() + i);
            const st = attendance.byDay[dayKey(d)];
            if (!st) continue;
            marked++;
            attended += st === 'P' ? 1 : st === 'H' ? 0.5 : 0;
        }

        points.push({
            label: end.toLocaleDateString('en', { day: '2-digit', month: 'short' }),
            score: max > 0 ? Math.round((obtained / max) * 100) : null,
            assignments: bucket.filter((s) => s.stage === 'We Do').length,
            assessments: bucket.filter((s) => s.stage === 'You Do').length,
            attendance: marked > 0 ? Math.round((attended / marked) * 100) : null,
        });
    }
    return points;
};

/* ── measured study time ─────────────────────────────────────────────────── */

/** Raw shape returned by GET /activity-logs/me/learning-time. */
export interface LearningTimeInput {
    totalSeconds: number;
    rawSeconds: number;
    cappedSessions: number;
    weDo: { seconds: number; sessions: number };
    youDo: { seconds: number; sessions: number };
    content: { seconds: number; sessions: number };
    other: { seconds: number; sessions: number };
}

export interface TimeModel {
    totalSeconds: number;
    weDoSeconds: number;
    youDoSeconds: number;
    contentSeconds: number;
    exerciseSeconds: number;   // We Do + You Do
    sessions: number;
    cappedSessions: number;
    /** True only when real seconds were recorded — sessions alone aren't enough. */
    tracked: boolean;
    /**
     * Sessions were logged but every one carries a zero duration. Happens when
     * work is submitted without any prior save (the start log opens on the first
     * save, so a straight-to-submit attempt has no elapsed time to measure).
     */
    zeroDuration: boolean;
}

/** "45m" / "5.2h" — compact enough for a stat slot. */
export const shortDuration = (seconds: number): string => {
    if (!seconds || seconds < 60) return '0m';
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round((seconds / 3600) * 10) / 10}h`;
};

/** Split form for a big metric: { value, unit }. */
export const durationParts = (seconds: number): { value: string; unit: string } => {
    if (!seconds) return { value: '0', unit: 'hrs' };
    if (seconds < 3600) return { value: String(Math.round(seconds / 60)), unit: 'min' };
    return { value: String(Math.round((seconds / 3600) * 10) / 10), unit: 'hrs' };
};

const buildTime = (t: LearningTimeInput | null | undefined): TimeModel => {
    const weDoSeconds = t?.weDo?.seconds || 0;
    const youDoSeconds = t?.youDo?.seconds || 0;
    const contentSeconds = t?.content?.seconds || 0;
    const sessions =
        (t?.weDo?.sessions || 0) + (t?.youDo?.sessions || 0) +
        (t?.content?.sessions || 0) + (t?.other?.sessions || 0);
    const totalSeconds = t?.totalSeconds || 0;
    return {
        totalSeconds,
        weDoSeconds,
        youDoSeconds,
        contentSeconds,
        exerciseSeconds: weDoSeconds + youDoSeconds,
        sessions,
        cappedSessions: t?.cappedSessions || 0,
        tracked: totalSeconds > 0,
        zeroDuration: sessions > 0 && totalSeconds === 0,
    };
};

/* ── grade banding ───────────────────────────────────────────────────────── */

export const gradeOf = (scorePct: number | null): { letter: string; caption: string } => {
    if (scorePct == null) return { letter: '—', caption: 'Nothing graded yet' };
    if (scorePct >= 90) return { letter: 'A+', caption: 'Outstanding' };
    if (scorePct >= 80) return { letter: 'A', caption: 'Excellent' };
    if (scorePct >= 70) return { letter: 'B', caption: 'Good' };
    if (scorePct >= 60) return { letter: 'C', caption: 'Satisfactory' };
    if (scorePct >= 50) return { letter: 'D', caption: 'Needs work' };
    return { letter: 'E', caption: 'Needs attention' };
};

/* ── today's focus ───────────────────────────────────────────────────────── */

export interface FocusItem {
    id: string;
    label: string;
    meta: string;
    done: boolean;
    courseId?: string;
}

const buildFocus = (
    deadlines: DeadlineItem[],
    courses: CourseModel[],
    subs: Submission[],
): FocusItem[] => {
    const items: FocusItem[] = [];
    const todayKey = dayKey(new Date());
    const doneToday = subs.filter((s) => dayKey(s.at) === todayKey);

    // What's already been achieved today reads as a completed line.
    if (doneToday.length) {
        const stages = new Set(doneToday.map((s) => s.stage));
        items.push({
            id: 'done-submissions',
            label: `Submit ${[...stages].join(' / ')} work`,
            meta: `${doneToday.length} submitted today`,
            done: true,
        });
    }
    const openedToday = courses.filter((c) => c.lastAccessed && dayKey(c.lastAccessed) === todayKey);
    openedToday.slice(0, 2).forEach((c) =>
        items.push({ id: `visited-${c.id}`, label: `Open ${c.name}`, meta: 'Visited today', done: true, courseId: c.id }));

    // Then the live actions, most urgent first.
    deadlines
        .filter((d) => d.state !== 'opens' && !d.attempted)
        .slice(0, 4)
        .forEach((d) =>
            items.push({
                id: `deadline-${d.id}`,
                label: `${d.kind === 'Assessment' ? 'Complete' : 'Finish'} ${d.title}`,
                meta: `${d.courseName} · ${dueLabel(d.date)}`,
                done: false,
            }));

    // Fill the rest with the least-advanced course so the list is never thin.
    if (items.length < 6) {
        [...courses]
            .filter((c) => c.progress < 100)
            .sort((a, b) => a.progress - b.progress)
            .slice(0, 6 - items.length)
            .forEach((c) => {
                const gap = c.learn.total - c.learn.opened;
                items.push({
                    id: `study-${c.id}`,
                    label: gap > 0 ? `Study ${c.name}` : `Practice ${c.name}`,
                    meta: gap > 0
                        ? `${gap} resource${gap === 1 ? '' : 's'} left`
                        : `${c.practice.notStarted + c.assess.notStarted} exercise(s) left`,
                    done: false,
                    courseId: c.id,
                });
            });
    }
    return items.slice(0, 6);
};

/* ── insights ────────────────────────────────────────────────────────────── */

export interface Insight { tone: 'good' | 'warn' | 'info'; text: string }

const buildInsights = (
    totals: { learn: LearnStats; practice: StageStats; assess: StageStats },
    courses: CourseModel[],
    attendance: AttendanceModel,
    deadlines: DeadlineItem[],
    momentum: MomentumModel,
    scorePct: number | null,
): Insight[] => {
    const out: Insight[] = [];

    // Weakest stage first — that's the actionable one.
    const stages = [
        { key: 'lessons', label: 'learning resources (I Do)', pct: totals.learn.completionPct, has: totals.learn.hasContent },
        { key: 'practice', label: 'assignments (We Do)', pct: totals.practice.completionPct, has: totals.practice.hasContent },
        { key: 'assess', label: 'assessments (You Do)', pct: totals.assess.completionPct, has: totals.assess.hasContent },
    ].filter((s) => s.has);
    if (stages.length) {
        const lowest = stages.reduce((a, b) => (b.pct < a.pct ? b : a));
        if (stages.every((s) => s.pct >= 80)) {
            out.push({ tone: 'good', text: `You're above 80% on every stage of the cycle — keep the pace.` });
        } else if (lowest.pct === 0) {
            out.push({ tone: 'warn', text: `You haven't started your ${lowest.label} yet — that's the fastest win available.` });
        } else {
            out.push({ tone: 'info', text: `Your ${lowest.label} is furthest behind at ${lowest.pct}%. Clearing it lifts your overall progress most.` });
        }
    }

    const overdue = deadlines.filter((d) => d.state === 'overdue');
    if (overdue.length) {
        const grace = overdue.filter((d) => d.inGrace).length;
        out.push({
            tone: 'warn',
            text: grace > 0
                ? `${overdue.length} item(s) past due — ${grace} still inside the late-submission window.`
                : `${overdue.length} item(s) are past their deadline and can no longer be submitted.`,
        });
    }

    const weakest = [...courses].filter((c) => c.scorePct != null).sort((a, b) => (a.scorePct! - b.scorePct!))[0];
    if (weakest && weakest.scorePct! < 60) {
        out.push({ tone: 'warn', text: `${weakest.name} is your lowest-scoring course at ${weakest.scorePct}% — worth revisiting before the next assessment.` });
    }

    if (attendance.hasData && attendance.pct != null) {
        if (attendance.pct < 75) out.push({ tone: 'warn', text: `Attendance is ${attendance.pct}% across ${attendance.totalDays} marked days — below the usual 75% threshold.` });
        else if (attendance.pct >= 90) out.push({ tone: 'good', text: `Attendance is strong at ${attendance.pct}% over ${attendance.totalDays} marked days.` });
    }

    if (totals.assess.pendingReview > 0) {
        out.push({ tone: 'info', text: `${totals.assess.pendingReview} assessment submission(s) are waiting to be graded.` });
    }
    if (momentum.streak >= 3) {
        out.push({ tone: 'good', text: `${momentum.streak}-day submission streak — consistency is your strongest habit right now.` });
    }
    if (scorePct != null) {
        out.push({ tone: 'info', text: `On current graded work you're tracking a ${gradeOf(scorePct).letter} (${scorePct}%).` });
    }
    return out.slice(0, 5);
};

/* ── achievements ────────────────────────────────────────────────────────── */

export interface Achievement { id: string; label: string; detail: string; unlocked: boolean; icon: string }

const buildAchievements = (
    courses: CourseModel[],
    totals: { learn: LearnStats; practice: StageStats; assess: StageStats },
    momentum: MomentumModel,
    attendance: AttendanceModel,
    scorePct: number | null,
): Achievement[] => {
    const completedCourses = courses.filter((c) => c.progress >= 100).length;
    const submissions = totals.practice.questionsAttempted + totals.assess.questionsAttempted;
    return [
        { id: 'first', label: 'First Steps', detail: 'First question submitted', unlocked: submissions > 0, icon: 'flag' },
        { id: 'streak7', label: '7-Day Streak', detail: 'Submit on 7 days in a row', unlocked: momentum.streak >= 7, icon: 'flame' },
        { id: 'fifty', label: 'Half Century', detail: '50 questions attempted', unlocked: submissions >= 50, icon: 'target' },
        { id: 'course', label: 'Course Complete', detail: 'Finish every stage of a course', unlocked: completedCourses > 0, icon: 'trophy' },
        { id: 'topper', label: 'Top Performer', detail: 'Average 85% or higher', unlocked: (scorePct ?? 0) >= 85, icon: 'star' },
        { id: 'present', label: 'Attendance Star', detail: '90%+ attendance', unlocked: (attendance.pct ?? 0) >= 90 && attendance.hasData, icon: 'calendar' },
    ];
};

/* ── the model ───────────────────────────────────────────────────────────── */

export interface DashboardModel {
    student: {
        firstName: string; lastName: string; fullName: string;
        degree: string; department: string; semester: string; section: string;
        batch: string; rollNumber: string; profile: string;
    };
    courses: CourseModel[];
    activeCourses: number;
    inProgress: number;
    completed: number;
    totals: { learn: LearnStats; practice: StageStats; assess: StageStats };
    overallProgress: number;
    scorePct: number | null;
    grade: { letter: string; caption: string };
    /** Measured, from closed activity logs. */
    time: TimeModel;
    /** Configured syllabus hours — the assigned total, not time spent. */
    contentHours: number;
    attendance: AttendanceModel;
    momentum: MomentumModel;
    trend: TrendPoint[];
    deadlines: DeadlineItem[];
    pendingThisWeek: number;
    focus: FocusItem[];
    insights: Insight[];
    achievements: Achievement[];
    activity: ActivityEvent[];
    solvedThisMonth: number;
    /** Solved-question change vs the previous 30 days. null = no baseline. */
    monthDeltaPct: number | null;
}

export const buildDashboard = (
    user: any,
    userCourses: any[],
    attendanceRecords: any[],
    learningTime?: LearningTimeInput | null,
): DashboardModel => {
    const u = user?.user || {};
    const rawCourses: any[] = u?.courses || [];

    const rawById: Record<string, any> = {};
    rawCourses.forEach((uc: any) => { rawById[idStr(uc?.courseId)] = uc; });

    const courses = (userCourses || []).map((c: any) => buildCourse(c, rawById[idStr(c?._id)]));
    const nameById: Record<string, string> = {};
    (userCourses || []).forEach((c: any) => { nameById[idStr(c?._id)] = c?.courseName || 'Course'; });

    /* pooled stage totals */
    const learn = emptyLearn();
    const practice = emptyStage();
    const assess = emptyStage();
    courses.forEach((c) => {
        learn.total += c.learn.total; learn.opened += c.learn.opened;
        learn.mcqDocs += c.learn.mcqDocs; learn.mcqCompleted += c.learn.mcqCompleted;
        learn.contentMinutes += c.learn.contentMinutes; learn.completedMinutes += c.learn.completedMinutes;
        (Object.keys(learn.byKind) as ResourceKind[]).forEach((k) => {
            learn.byKind[k].total += c.learn.byKind[k].total;
            learn.byKind[k].opened += c.learn.byKind[k].opened;
        });
        ([['practice', practice, c.practice], ['assess', assess, c.assess]] as const).forEach(([, acc, src]) => {
            acc.assigned += src.assigned; acc.started += src.started; acc.submitted += src.submitted;
            acc.graded += src.graded; acc.notStarted += src.notStarted; acc.pendingReview += src.pendingReview;
            acc.questionsTotal += src.questionsTotal; acc.questionsAttempted += src.questionsAttempted;
            acc.questionsSolved += src.questionsSolved;
            acc.scoreObtained += src.scoreObtained; acc.scoreMax += src.scoreMax; acc.lateCount += src.lateCount;
        });
    });
    learn.completionPct = pct(learn.opened, learn.total);
    learn.hasContent = learn.total > 0;
    [practice, assess].forEach((s) => {
        s.hasContent = s.assigned > 0 || s.questionsTotal > 0;
        s.completionPct = s.assigned > 0 ? pct(s.started, s.assigned) : 0;
        s.scorePct = s.scoreMax > 0 ? Math.round((s.scoreObtained / s.scoreMax) * 100) : null;
        s.onTimePct = s.submitted > 0 ? Math.round(((s.submitted - s.lateCount) / s.submitted) * 100) : null;
    });

    const parts: number[] = [];
    if (learn.hasContent) parts.push(learn.completionPct);
    if (practice.hasContent) parts.push(practice.completionPct);
    if (assess.hasContent) parts.push(assess.completionPct);
    const overallProgress = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;

    const scoreMax = practice.scoreMax + assess.scoreMax;
    const scoreObtained = practice.scoreObtained + assess.scoreObtained;
    const scorePct = scoreMax > 0 ? Math.round((scoreObtained / scoreMax) * 100) : null;

    const attendance = buildAttendance(attendanceRecords);
    const subs = collectSubmissions(rawCourses, nameById);
    const momentum = buildMomentum(subs);
    const trend = buildTrend(subs, attendance);
    const deadlines = buildDeadlines(userCourses || [], rawCourses);

    const weekAhead = Date.now() + 7 * 86400000;
    const pendingThisWeek = deadlines.filter(
        (d) => !d.attempted && d.state !== 'opens' && d.date.getTime() <= weekAhead,
    ).length;

    const monthAgo = Date.now() - 30 * 86400000;
    const twoMonthsAgo = Date.now() - 60 * 86400000;
    const solvedThisMonth = subs.filter((s) => s.solved && s.at.getTime() >= monthAgo).length;
    const solvedPrevMonth = subs.filter(
        (s) => s.solved && s.at.getTime() >= twoMonthsAgo && s.at.getTime() < monthAgo,
    ).length;
    // Only a real baseline makes a percentage meaningful — no prior month, no chip.
    const monthDeltaPct = solvedPrevMonth > 0
        ? Math.round(((solvedThisMonth - solvedPrevMonth) / solvedPrevMonth) * 100)
        : null;

    const activity: ActivityEvent[] = [
        ...subs.slice(0, 8).map((s): ActivityEvent => ({
            at: s.at,
            kind: 'submission',
            title: `${s.stage} · ${s.exerciseName}`,
            detail: s.courseName,
            stage: s.stage,
            scorePct: s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : null,
            solved: s.solved,
        })),
        ...(u?.notifications || []).slice(0, 6).map((n: any): ActivityEvent => ({
            at: new Date(n?.createdAt || Date.now()),
            kind: 'notification',
            title: n?.title || 'Notification',
            detail: n?.message || '',
        })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8);

    return {
        student: {
            firstName: u?.firstName || 'Student',
            lastName: u?.lastName || '',
            fullName: `${u?.firstName || 'Student'} ${u?.lastName || ''}`.trim(),
            degree: u?.degree || '',
            department: u?.department || '',
            semester: u?.semester || '',
            section: u?.section || '',
            batch: u?.batch || '',
            rollNumber: u?.rollNumber || '',
            profile: u?.profile || '',
        },
        courses,
        activeCourses: courses.length,
        inProgress: courses.filter((c) => c.progress > 0 && c.progress < 100).length,
        completed: courses.filter((c) => c.progress >= 100).length,
        totals: { learn, practice, assess },
        overallProgress,
        scorePct,
        grade: gradeOf(scorePct),
        time: buildTime(learningTime),
        contentHours: Math.round(learn.contentMinutes / 60),
        attendance,
        momentum,
        trend,
        deadlines,
        pendingThisWeek,
        focus: buildFocus(deadlines, courses, subs),
        insights: buildInsights({ learn, practice, assess }, courses, attendance, deadlines, momentum, scorePct),
        achievements: buildAchievements(courses, { learn, practice, assess }, momentum, attendance, scorePct),
        activity,
        solvedThisMonth,
        monthDeltaPct,
    };
};
