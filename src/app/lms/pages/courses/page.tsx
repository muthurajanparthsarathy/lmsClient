// app/lms/pages/courses/page.tsx

"use client";
import { Loading } from "@/components/loading-ui/loading";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen, Users, Loader2, Box, Clock, Bookmark,
  Target, LayoutGrid, List, GraduationCap, ArrowRight,
  ChevronDown, ChevronLeft, ChevronRight, MessageSquare,
  Search, Award, Activity, HeartHandshake,
} from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, AnimatePresence, cubicBezier } from 'framer-motion';
import { Poppins } from 'next/font/google';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-poppins',
});
import {
  getAuthToken,
  getCurrentUserIdFromAuth,
  Course
} from '../.../../../../../apiServices/studentcoursepage';
import {
  useCoursesListQuery,
  useFilteredCourses,
  usePrefetchCourseDetail,
} from '@/queries/courses';
import { useQueries } from '@tanstack/react-query';
import { feedbackKeys } from '../coursestructure/feedback/hooks/useFeedback';
import { fetchPublishedFeedbackFlag } from '@/apiServices/feedbackService';
import { StudentLayout } from '../../component/student/student-layout';
import DashboardLayout from '../../component/layout';
import { StaffLayout } from '../../component/stafflayout/staff-layout';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/components/permissions';

// Per-course progress comes from the student dashboard's own metrics engine —
// see the note on computeCourseProgress below for what it replaced.
import { useCurrentUserQuery } from '@/queries/auth';
import { useStudentAnalyticsQuery, getUserSpecificAnalytics } from '@/queries/studentDashboard';
import { buildDashboard, idStr as metricsIdStr } from '../studentdashboard/_lib/metrics';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  orange: '#F97316', orangeDark: '#EA580C', orangeGlow: 'rgba(249,115,22,0.20)', orangeLight: 'rgba(249,115,22,0.08)',
  textMain: '#171725', textSub: '#5b5b6b', textMuted: '#8b8b9e', textHint: '#bcbccc', border: '#eef0f3', bg: '#ffffff', pageBg: '#ffffff',
  dark: { bg: '#1a1a2e', surface: '#222240', card: '#1e1e38', border: '#2e2e4a', textMain: '#e8e8f0', textSub: '#a0a0b8', textMuted: '#7a7a92', textHint: '#4a4a66', pageBg: '#12121f' }
};

const defaultCategories = ["All", "Web Development", "Data Science", "Mobile Development", "Design", "Cloud Computing", "Marketing", "Security"];
const LEVEL_OPTIONS = ['All', 'Beginner', 'Intermediate', 'Advanced', 'Expert'] as const;
const SORT_OPTIONS = ['Recent', 'Name (A–Z)', 'Level'] as const;
const PAGE_SIZE_OPTIONS = [8, 12, 16, 24] as const;

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface UserData { _id: string; email: string; firstName: string; lastName: string; role: { _id: string; originalRole: string; renameRole: string; roleValue: string } | string; permissions?: any[]; courses?: any[];[key: string]: any }
interface RoleSwitchState { isDummyStudent: boolean; originalRole?: string; originalRenameRole?: string; switchTimestamp?: number }

// ─── Animations ───────────────────────────────────────────────────────────────
const containerV = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const cardV = { hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: cubicBezier(0.22, 1, 0.36, 1) } } };

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getUser = (): { valid: boolean; user: UserData | null } => {
  try {
    const s = localStorage.getItem("smartcliff_userData");
    if (!s) return { valid: false, user: null };
    return { valid: true, user: JSON.parse(s) }
  } catch {
    return { valid: false, user: null }
  }
};

const isDummyMode = (): boolean => {
  try {
    const s = localStorage.getItem('smartcliff_roleSwitch');
    if (s) {
      const d: RoleSwitchState = JSON.parse(s);
      return d.isDummyStudent === true
    }
    return localStorage.getItem('smartcliff_isDummyStudent') === 'true'
  } catch {
    return false
  }
};

const getUserRole = (): string | null => {
  try {
    const roleValue = localStorage.getItem('smartcliff_roleValue');
    if (roleValue) return roleValue.toLowerCase();
    const { valid, user } = getUser();
    if (valid && user) {
      if (typeof user.role === 'object' && user.role !== null) {
        const role = (user.role as any).roleValue || (user.role as any).originalRole || (user.role as any).renameRole;
        if (role) return role.toLowerCase();
      } else if (typeof user.role === 'string') {
        return user.role.toLowerCase();
      }
    }
    return null;
  } catch {
    return null;
  }
};

const getLevelCfg = (l: string) => {
  switch (l) {
    case 'Beginner': return { bg: '#ecfdf5', text: '#059669', dot: '#10b981' };
    case 'Intermediate': return { bg: '#fff7ed', text: '#ea580c', dot: '#f97316' };
    case 'Advanced': return { bg: '#eef2ff', text: '#4f46e5', dot: '#6366f1' };
    default: return { bg: '#fff1f2', text: '#e11d48', dot: '#f43f5e' };
  }
};

// Category chip colors — deterministic per category name (matches the reference's varied tags)
const CATEGORY_COLORS = [
  { bg: '#FFEDD5', text: '#EA580C' },
  { bg: '#F0EBFE', text: '#7C3AED' },
  { bg: '#E6F7F1', text: '#0EA5A0' },
  { bg: '#FDEDE4', text: '#F26522' },
  { bg: '#FCE7F0', text: '#DB2777' },
  { bg: '#FEF3E2', text: '#D97706' },
];
const categoryColor = (s: string) => {
  const key = s || '';
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i)) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[h];
};

// ─── Banner gradient per course level ────────────────────────────────────────
const BANNER_GRADIENTS: Record<string, string> = {
  Beginner: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  Intermediate: 'linear-gradient(135deg, #F26522 0%, #f5a623 100%)',
  Advanced: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  Expert: 'linear-gradient(135deg, #e11d48 0%, #7c3aed 100%)',
};
const fallbackGradient = (name: string) => {
  const hues = [210, 150, 270, 30, 180, 320, 60, 0];
  const h = hues[(name.charCodeAt(0) || 0) % hues.length];
  return `linear-gradient(135deg, hsl(${h},65%,45%) 0%, hsl(${(h + 40) % 360},70%,60%) 100%)`;
};
const getBanner = (course: Course) =>
  BANNER_GRADIENTS[course.courseLevel] || fallbackGradient(course.courseName || '');

// ─── Data helpers (real data only) ────────────────────────────────────────────
// Enrolled student count = unique users across all batches on the course.
const countStudents = (course: Course): number => {
  const set = new Set<string>();
  (course.batchAndParticipants || []).forEach((b: any) =>
    (b.users || []).forEach((u: any) => {
      const raw = u?.user;
      const id = typeof raw === 'string' ? raw : raw?._id || raw?.$oid;
      if (id) set.add(String(id));
    })
  );
  return set.size;
};

// FALLBACK ONLY — used for the moment before the analytics read resolves.
//
// The comment here used to claim this was "the same formula the dashboard/
// sidebar use". It was not: it reads only `answers.We_Do.practical`, ignores I
// Do and You Do entirely, and blends on an assumed 4 questions per exercise. A
// learner with resources opened and assessments attempted still scored 0% on
// this card while the dashboard showed 15% for the same course. Real progress
// now comes from buildDashboard() (see courseProgressFromMetrics below), which
// is the engine the dashboard and Profile both read.
const computeCourseProgress = (userCourse: any): number => {
  const practicals = userCourse?.answers?.We_Do?.practical;
  if (!practicals?.length) return 0;
  let attempted = 0, questions = 0;
  practicals.forEach((ex: any) => {
    if (ex.questions?.length) {
      attempted++;
      questions += ex.questions.filter((q: any) => q.status === 'attempted' || q.status === 'evaluated' || q.submittedAt).length;
    }
  });
  return Math.round(((attempted / practicals.length) * 0.4 + (attempted > 0 ? questions / (attempted * 4) : 0) * 0.6) * 100);
};

const formatCount = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return String(n);
};

const relativeTime = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff)) return '';
  const days = Math.floor(diff / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

// ─── Course Card ──────────────────────────────────────────────────────────────
const CourseCard = React.memo(function CourseCard({
  course,
  isStudent,
  progress,
  studentCount,
  lastAccessed,
  onStart,
  onPrefetch,
  onViewUsers,
  onFeedback,
  hasPublishedFeedback,
  viewMode,
  isDark,
  canStaffAccessMaterials,
  canStaffViewSchedule,
}: {
  course: Course;
  isStudent: boolean;
  progress: number;
  studentCount: number;
  lastAccessed?: string | null;
  onStart: (id: string) => void;
  onPrefetch: (id: string) => void;
  onViewUsers: (id: string) => void;
  onFeedback?: (courseId: string) => void;
  hasPublishedFeedback?: boolean;
  viewMode: 'grid' | 'list';
  isDark: boolean;
  // Staff-only button gates. For students these are ignored; for staff/trainer
  // they hide (not disable) the Analytics/Manage CTAs when the permission is
  // absent. Navigation happens ONLY through the CTA buttons — the card body
  // itself is not clickable.
  canStaffAccessMaterials: boolean;
  canStaffViewSchedule: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const lv = getLevelCfg(course.courseLevel);
  const cat = categoryColor(course.serviceType || '');
  const abbr = (course.courseName || 'C').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 3);
  const banner = getBanner(course);
  const hasImg = !!(course as any).courseImage && !imgError;
  // Real module count from the server aggregation — courseDuration is a
  // free-text duration ("", "3 months") and always parsed to 0 here.
  const modules = course.moduleCount ?? 0;
  const started = progress > 0;

  const handlePrefetch = useCallback(() => onPrefetch(course._id), [onPrefetch, course._id]);
  const handleStart = useCallback(() => onStart(course._id), [onStart, course._id]);
  const handleViewUsers = useCallback((e: React.MouseEvent) => { e.stopPropagation(); onViewUsers(course._id); }, [onViewUsers, course._id]);
  const handleFeedback = useCallback((e: React.MouseEvent) => { e.stopPropagation(); if (onFeedback) onFeedback(course._id); }, [onFeedback, course._id]);

  const showFeedbackButton = isStudent && hasPublishedFeedback && onFeedback;

  // ── LIST view ────────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    return (
      <motion.div layout variants={cardV}
        className="group flex items-center gap-4 p-3 rounded-2xl"
        style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}`, transition: 'border-color .15s, box-shadow .15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = T.orange; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 16px ${T.orangeGlow}`; handlePrefetch(); }}
        onFocus={handlePrefetch}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isDark ? T.dark.border : T.border; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
      >
        <div className="h-16 w-24 rounded-xl overflow-hidden flex-shrink-0 relative" style={{ background: hasImg ? (isDark ? T.dark.surface : '#fff') : banner, border: hasImg ? `1px solid ${isDark ? T.dark.border : T.border}` : 'none' }}>
          {hasImg
            ? <img src={(course as any).courseImage} onError={() => setImgError(true)} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-white font-extrabold text-[16px]">{abbr}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            {course.serviceType && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded max-w-[120px] truncate" style={{ background: cat.bg, color: cat.text }}>
                {course.serviceType}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: lv.bg, color: lv.text }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: lv.dot }} />{course.courseLevel}
            </span>
          </div>
          <h3 className="text-[14px] font-bold leading-snug truncate" style={{ color: isDark ? T.dark.textMain : T.textMain }}>{course.courseName}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[11px]" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
              <Box className="w-3 h-3" style={{ color: isDark ? T.dark.textMuted : T.textMuted }} />{modules} Modules
            </span>
            {/* Staff only — see the note on the grid card. */}
            {!isStudent && (
              <span className="flex items-center gap-1 text-[11px]" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
                <Users className="w-3 h-3" style={{ color: isDark ? T.dark.textMuted : T.textMuted }} />{formatCount(studentCount)}
              </span>
            )}
            {isStudent && started && (
              <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: T.orange }}>
                <Activity className="w-3 h-3" />{progress}%
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isStudent ? (
            <>
              {canStaffViewSchedule && (
                <OutlineBtn onClick={handleViewUsers} onHover={handlePrefetch}><Users className="w-3.5 h-3.5" /> Users</OutlineBtn>
              )}
              {canStaffAccessMaterials && (
                <FilledBtn onClick={e => { e.stopPropagation(); handleStart(); }} onHover={handlePrefetch}>Manage<ArrowRight className="w-3 h-3" /></FilledBtn>
              )}
            </>
          ) : (
            <>
              {showFeedbackButton && <OutlineBtn onClick={handleFeedback}><MessageSquare className="w-3.5 h-3.5" /> Feedback</OutlineBtn>}
              <FilledBtn onClick={e => { e.stopPropagation(); handleStart(); }} onHover={handlePrefetch}>{started ? 'Continue' : 'Start'}<ArrowRight className="w-3 h-3" /></FilledBtn>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  // ── GRID view ──────────────────────────────────────────────────────────────
  return (
    <motion.div layout variants={cardV}
      className="group flex flex-col rounded-2xl overflow-hidden"
      style={{
        background: isDark ? T.dark.card : T.bg,
        border: `1px solid ${isDark ? T.dark.border : T.border}`,
        boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
        transition: 'transform .18s, box-shadow .18s, border-color .18s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 14px 32px ${T.orangeGlow}`; (e.currentTarget as HTMLElement).style.borderColor = T.orange + '66'; handlePrefetch(); }}
      onFocus={handlePrefetch}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(16,24,40,0.06)'; (e.currentTarget as HTMLElement).style.borderColor = isDark ? T.dark.border : T.border }}
    >
      {/* ── Thumbnail ── */}
      {/* Neutral surface behind uploaded images so transparent PNGs (logos)
          sit clean; badges carry their own backgrounds so no dark overlay. */}
      <div className="relative h-[150px] flex-shrink-0 overflow-hidden" style={{ background: hasImg ? (isDark ? T.dark.surface : '#fff') : undefined }}>
        {hasImg ? (
          <img src={(course as any).courseImage} onError={() => setImgError(true)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: banner }}>
            <div className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 24px,rgba(255,255,255,.6) 24px,rgba(255,255,255,.6) 25px),repeating-linear-gradient(90deg,transparent,transparent 24px,rgba(255,255,255,.6) 24px,rgba(255,255,255,.6) 25px)' }} />
            <span className="relative text-white font-extrabold text-[44px] tracking-[-0.04em] leading-none select-none" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}>
              {abbr}
            </span>
          </div>
        )}

        {/* Category badge — top left */}
        {course.serviceType && (
          <div className="absolute top-2.5 left-2.5 max-w-[calc(100%-60px)]">
            <span className="text-[10px] font-bold px-2 py-1 rounded-lg block truncate" style={{ background: cat.bg, color: cat.text }}>
              {course.serviceType}
            </span>
          </div>
        )}

        {/* Bookmark — top right */}
        <button
          onClick={(e) => { e.stopPropagation(); setBookmarked(v => !v); }}
          className="absolute top-2.5 right-2.5 w-8 h-8 rounded-lg flex items-center justify-center transition-transform hover:scale-105"
          style={{ background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(4px)' }}
          aria-label="Bookmark course"
        >
          <Bookmark className="w-4 h-4" style={{ color: bookmarked ? T.orange : '#64748b', fill: bookmarked ? T.orange : 'transparent' }} />
        </button>

        {/* Level pill — bottom left */}
        <div className="absolute bottom-2.5 left-2.5">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(15,23,42,0.62)', color: '#fff', backdropFilter: 'blur(4px)' }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: lv.dot }} />
            {course.courseLevel || 'Course'}
          </span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="text-[13.5px] font-bold leading-snug line-clamp-1" style={{ color: isDark ? T.dark.textMain : T.textMain }}>
          {course.courseName}
        </h3>
        <p className="text-[11.5px] mt-0.5 line-clamp-1" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
          {course.courseDescription || course.clientName || 'Self-paced course'}
        </p>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-2.5">
          <span className="flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: isDark ? T.dark.textSub : T.textSub }}>
            <Box className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isDark ? T.dark.textSub : T.textSub }} />{modules} Modules
          </span>
          {/* Staff only. How many classmates are enrolled is a roster figure —
              it tells a learner nothing about their own course. */}
          {!isStudent && (
            <span className="flex items-center gap-1.5 text-[11.5px] font-medium" style={{ color: isDark ? T.dark.textSub : T.textSub }}>
              <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: isDark ? T.dark.textSub : T.textSub }} />{formatCount(studentCount)}
            </span>
          )}
        </div>

        {/* Progress (students only — real data) */}
        {isStudent && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11.5px] font-medium" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>Progress</span>
              <span className="text-[11.5px] font-bold" style={{ color: T.orange }}>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: isDark ? T.dark.border : '#eef0f3' }}>
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${T.orange}, ${T.orangeDark})`, transition: 'width .6s ease' }} />
            </div>
          </div>
        )}

<div className="flex gap-2 mt-3.5">
  {!isStudent ? (
    <>
      {canStaffViewSchedule && (
        <OutlineBtn className="flex-1 py-2" onClick={handleViewUsers} onHover={handlePrefetch}><Users className="w-3.5 h-3.5" /> Analytics</OutlineBtn>
      )}
      {canStaffAccessMaterials && (
        <FilledBtn className="flex-1 py-2" onClick={e => { e.stopPropagation(); handleStart(); }} onHover={handlePrefetch}>Manage<ArrowRight className="w-3.5 h-3.5" /></FilledBtn>
      )}
    </>
  ) : (
    <>
      {showFeedbackButton ? (
        <>
          <OutlineBtn className="flex-1 py-2" onClick={handleFeedback}><MessageSquare className="w-3.5 h-3.5" /> Feedback</OutlineBtn>
          <FilledBtn className="flex-1 py-2" onClick={e => { e.stopPropagation(); handleStart(); }} onHover={handlePrefetch}>
            {started ? 'Continue' : 'Start'}<ArrowRight className="w-3.5 h-3.5" />
          </FilledBtn>
        </>
      ) : (
        <FilledBtn className="flex-1 py-2" onClick={e => { e.stopPropagation(); handleStart(); }} onHover={handlePrefetch}>
          {started ? 'Continue' : 'Start'}<ArrowRight className="w-3.5 h-3.5" />
        </FilledBtn>
      )}
    </>
  )}
</div>

        {/* Footer line */}
        {isStudent && started && lastAccessed && (
          <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${isDark ? T.dark.border : T.border}` }}>
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
              <Clock className="w-3 h-3" /> Last accessed {relativeTime(lastAccessed)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ─── Small button primitives ──────────────────────────────────────────────────
const OutlineBtn = ({ children, onClick, onHover, className = 'px-4 py-2' }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; onHover?: () => void; className?: string }) => (
  <button
    onClick={onClick}
    onMouseEnter={(e) => { onHover?.(); (e.currentTarget as HTMLElement).style.background = T.orange; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = T.orange; }}
    onFocus={onHover}
    className={`flex items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold ${className}`}
    style={{ background: 'transparent', border: `1.5px solid ${T.orange}`, color: T.orange, transition: 'background .15s, color .15s' }}
  >
    {children}
  </button>
);

const FilledBtn = ({ children, onClick, onHover, className = 'px-4 py-2' }: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; onHover?: () => void; className?: string }) => (
  <button
    onClick={onClick}
    onMouseEnter={(e) => { onHover?.(); (e.currentTarget as HTMLElement).style.background = T.orangeDark; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = T.orange; }}
    onFocus={onHover}
    className={`flex items-center justify-center gap-1.5 rounded-xl text-[12.5px] font-semibold text-white ${className}`}
    style={{ background: T.orange, transition: 'background .15s' }}
  >
    {children}
  </button>
);

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skel = ({ isDark }: { isDark: boolean }) => (
  <div className="rounded-2xl overflow-hidden animate-pulse" style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
    <div className="h-[150px]" style={{ background: isDark ? T.dark.surface : '#ededf0' }} />
    <div className="p-4 space-y-2.5">
      <div className="h-4 rounded-full w-4/5" style={{ background: isDark ? T.dark.surface : '#ededf0' }} />
      <div className="h-3.5 rounded-full w-3/5" style={{ background: isDark ? T.dark.surface : '#ededf0' }} />
      <div className="flex justify-between pt-1">
        <div className="h-3 rounded-full w-1/3" style={{ background: isDark ? T.dark.surface : '#ededf0' }} />
        <div className="h-3 rounded-full w-1/5" style={{ background: isDark ? T.dark.surface : '#ededf0' }} />
      </div>
      <div className="h-1.5 rounded-full" style={{ background: isDark ? T.dark.surface : '#ededf0' }} />
      <div className="flex gap-2 pt-1">
        <div className="h-9 rounded-xl flex-1" style={{ background: isDark ? T.dark.surface : '#ededf0' }} />
        <div className="h-9 rounded-xl flex-1" style={{ background: isDark ? T.dark.surface : '#ededf0' }} />
      </div>
    </div>
  </div>
);

const Empty = ({ onClear, hasSearch, isDark }: { onClear: () => void; hasSearch: boolean; isDark: boolean }) => (
  <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 rounded-2xl"
    style={{ background: isDark ? T.dark.card : T.bg, border: `1.5px dashed ${isDark ? T.dark.border : T.border}` }}>
    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: T.orangeLight }}>
      <GraduationCap className="w-6 h-6" style={{ color: T.orange }} />
    </div>
    <h3 className="text-[14px] font-bold mb-1" style={{ color: isDark ? T.dark.textMain : T.textMain }}>No courses found</h3>
    <p className="text-[12px]" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>Try adjusting your search or filters.</p>
    {hasSearch && <button onClick={onClear} className="mt-3 text-[12px] font-bold" style={{ color: T.orange }}>Clear filters ×</button>}
  </motion.div>
);

const Err = ({ onRetry, isDark, message }: { onRetry: () => void; isDark: boolean; message?: string }) => (
  <motion.div key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 rounded-2xl"
    style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: '#fff1f2' }}>
      <Target className="w-6 h-6" style={{ color: '#e11d48' }} />
    </div>
    <h3 className="text-[14px] font-bold mb-1" style={{ color: isDark ? T.dark.textMain : T.textMain }}>Failed to load courses</h3>
    <p className="text-[12px] mb-4" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>{message || 'Something went wrong.'}</p>
    <button onClick={onRetry} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white" style={{ background: T.orange }}>Try Again</button>
  </motion.div>
);

// ─── Dropdown primitive ───────────────────────────────────────────────────────
const Dropdown = ({ label, value, options, onSelect, open, setOpen, isDark, width = 'w-44' }: {
  label: string; value: string; options: readonly string[]; onSelect: (v: string) => void;
  open: boolean; setOpen: (v: boolean) => void; isDark: boolean; width?: string;
}) => {
  const active = value !== 'All' && value !== options[0];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12.5px] font-semibold whitespace-nowrap"
        style={{ background: isDark ? T.dark.card : T.bg, border: `1.5px solid ${active ? T.orange : (isDark ? T.dark.border : T.border)}`, color: active ? T.orange : isDark ? T.dark.textSub : T.textSub }}
      >
        <span style={{ color: isDark ? T.dark.textMuted : T.textMuted, fontWeight: 500 }}>{label}</span>
        {value}
        <ChevronDown className="w-3 h-3 opacity-70" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      {open && (
        <div className={`absolute top-full left-0 mt-1 ${width} py-1 z-50 rounded-lg`}
          style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}`, boxShadow: '0 8px 24px rgba(16,24,40,0.10)' }}>
          {options.map(o => (
            <button key={o} onClick={() => onSelect(o)}
              className="w-full text-left px-3 py-1.5 text-[12px]"
              style={{ fontWeight: value === o ? 700 : 500, color: value === o ? T.orange : isDark ? T.dark.textSub : T.textSub, background: value === o ? (isDark ? 'rgba(249,115,22,0.12)' : T.orangeLight) : 'transparent' }}
              onMouseEnter={e => { if (value !== o) (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.04)' : '#f7f7f9' }}
              onMouseLeave={e => { if (value !== o) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
            >{o}</button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Feature strip ────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: BookOpen, color: '#0EA5A0', bg: '#E6F7F1', title: 'Learn at your pace', sub: 'Access courses anytime, anywhere' },
  { icon: Award, color: '#7C3AED', bg: '#F0EBFE', title: 'Earn certificates', sub: 'Showcase your skills' },
  { icon: Activity, color: '#F26522', bg: '#FDEDE4', title: 'Track progress', sub: 'Monitor your learning journey' },
  { icon: HeartHandshake, color: '#DB2777', bg: '#FCE7F0', title: 'Get support', sub: "We're here to help you" },
];
const FeatureStrip = ({ isDark }: { isDark: boolean }) => (
  <div className="mt-8 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
    style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
    {FEATURES.map((f, i) => {
      const Icon = f.icon;
      return (
        <div key={i} className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : f.bg }}>
            <Icon className="w-5 h-5" style={{ color: f.color }} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold truncate" style={{ color: isDark ? T.dark.textMain : T.textMain }}>{f.title}</p>
            <p className="text-[11.5px] truncate" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>{f.sub}</p>
          </div>
        </div>
      );
    })}
  </div>
);

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function CoursesPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // URL-synced filter state
  const urlSearchTerm = sp?.get('q') || '';
  const urlCategory = sp?.get('category') || 'All';
  const urlLevel = (LEVEL_OPTIONS as readonly string[]).includes(sp?.get('level') || '') ? (sp?.get('level') as string) : 'All';
  const urlPage = Math.max(1, parseInt(sp?.get('page') || '1', 10) || 1);
  const urlView = (sp?.get('view') === 'list' ? 'list' : 'grid') as 'grid' | 'list';

  const [searchTerm, setSearchTerm] = useState(urlSearchTerm);
  const [selectedCategory, setSelectedCategory] = useState(urlCategory);
  const [selectedLevel, setSelectedLevel] = useState(urlLevel);
  const [selectedSort, setSelectedSort] = useState<string>('Recent');
  const [currentPage, setCurrentPage] = useState(urlPage);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(urlView);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const [isStudent, setIsStudent] = useState(false);
  const [, setIsDummyStudent] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [showCatDrop, setShowCatDrop] = useState(false);
  const [showLevelDrop, setShowLevelDrop] = useState(false);
  const [showSortDrop, setShowSortDrop] = useState(false);
  const [showSizeDrop, setShowSizeDrop] = useState(false);
  const [, setUserName] = useState('');
  const [isRoleLoading, setIsRoleLoading] = useState(true);

  // Full-id permission checks for staff-only CTAs on each course card. Students
  // see their own set of buttons (Start/Feedback), which are unaffected.
  const { can } = usePermissions();
  const canStaffAccessMaterials = can(PERMISSION_IDS.STAFF_COURSES, 'access_materials');
  const canStaffViewSchedule = can(PERMISSION_IDS.STAFF_COURSES, 'view_schedule');

  // Per-course student progress + lastAccessed, keyed by courseId (from the signed-in user's data)
  const [progressMap, setProgressMap] = useState<Record<string, { progress: number; lastAccessed?: string | null }>>({});

  // ── Real per-course progress ──────────────────────────────────────────────
  // The same two reads the student dashboard opens with, off the same cache
  // keys — arriving here from the dashboard costs no extra requests. Attendance
  // and study time are deliberately NOT fetched: neither feeds a course's
  // `progress`, and pulling them would fire one request per enrolled course to
  // render a bar. buildDashboard tolerates both being empty.
  const { data: meUser } = useCurrentUserQuery();
  const perfStudentId = isStudent ? metricsIdStr((meUser as any)?.user?._id) : '';
  const { data: perfAnalytics } = useStudentAnalyticsQuery(perfStudentId || null);

  const perfCourses = useMemo(
    () => (perfAnalytics && perfStudentId
      ? getUserSpecificAnalytics(perfAnalytics, perfStudentId)?.userCourses || []
      : []),
    [perfAnalytics, perfStudentId],
  );

  const metricsProgress = useMemo(() => {
    if (!isStudent || !meUser || !perfCourses.length) return null;
    const model = buildDashboard(meUser, perfCourses, [], null);
    const map: Record<string, { progress: number; lastAccessed?: string | null }> = {};
    model.courses.forEach((c) => {
      map[c.id] = {
        progress: Math.max(0, Math.min(100, Math.round(c.progress))),
        lastAccessed: c.lastAccessed ? c.lastAccessed.toISOString() : null,
      };
    });
    return map;
  }, [isStudent, meUser, perfCourses]);


  useEffect(() => {
    const c = () => setIsDark(document.documentElement.classList.contains('dark'));
    c();
    const o = new MutationObserver(c);
    o.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => o.disconnect()
  }, []);

  useEffect(() => {
    try {
      const role = getUserRole();
      setUserRole(role);
      const isStudentRole = role === 'student';
      const dummyMode = isDummyMode();
      setIsDummyStudent(dummyMode);
      setIsStudent(isStudentRole || dummyMode);
      setAuthToken(getAuthToken());
      setUserId(getCurrentUserIdFromAuth());
      // Build progress map from the signed-in user's enrolled courses (answers).
      try {
        const userData = localStorage.getItem('smartcliff_userData');
        if (userData) {
          const parsed = JSON.parse(userData);
          setUserName(parsed.firstName || '');
          const map: Record<string, { progress: number; lastAccessed?: string | null }> = {};
          (parsed.courses || []).forEach((uc: any) => {
            const cid = String(uc.courseId?._id || uc.courseId || uc._id || '');
            if (cid) map[cid] = { progress: computeCourseProgress(uc), lastAccessed: uc.lastAccessed || uc.updatedAt || null };
          });
          setProgressMap(map);
        }
      } catch { /* noop */ }
      const handleStorageChange = () => {
        const newRole = getUserRole();
        const newDummyMode = isDummyMode();
        setUserRole(newRole);
        setIsStudent(newRole === 'student' || newDummyMode);
        setIsDummyStudent(newDummyMode);
      };
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    } finally {
      setIsRoleLoading(false);
    }
  }, []);

  // Keep local state in sync with URL navigation
  useEffect(() => { setSearchTerm(urlSearchTerm); }, [urlSearchTerm]);
  useEffect(() => { setSelectedCategory(urlCategory); }, [urlCategory]);
  useEffect(() => { setSelectedLevel(urlLevel); }, [urlLevel]);
  useEffect(() => { setCurrentPage(urlPage); }, [urlPage]);
  useEffect(() => { setViewMode(urlView); }, [urlView]);

  const syncUrl = useCallback((next: { q?: string; category?: string; level?: string; page?: number; view?: 'grid' | 'list' }) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (next.q !== undefined) { if (next.q) params.set('q', next.q); else params.delete('q'); }
    if (next.category !== undefined) { if (next.category && next.category !== 'All') params.set('category', next.category); else params.delete('category'); }
    if (next.level !== undefined) { if (next.level && next.level !== 'All') params.set('level', next.level); else params.delete('level'); }
    if (next.page !== undefined) { if (next.page > 1) params.set('page', String(next.page)); else params.delete('page'); }
    if (next.view !== undefined) { if (next.view !== 'grid') params.set('view', next.view); else params.delete('view'); }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [router, pathname]);

  const filters = useMemo(() => ({ searchTerm, selectedCategory, selectedLevel }), [searchTerm, selectedCategory, selectedLevel]);

  // ----- FETCH COURSES -----
  const { data: allCourses, isLoading, isError, error, isFetching, refetch } = useCoursesListQuery(userId);

  // ----- Published feedback status -----
  // One cached query per course instead of an uncached fetch-per-course on
  // every mount, and each asks for `?summary=1` — the page only needs the
  // boolean "has a published, active form", and the full document carries
  // every student's responses (71,668 -> 3,826 bytes per course).
  const feedbackQueries = useQueries({
    queries: (isStudent ? (allCourses || []) : []).map((course) => ({
      queryKey: feedbackKeys.listSummary(course._id),
      queryFn: () => fetchPublishedFeedbackFlag(course._id),
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    })),
  });

  const publishedFeedbackMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    (isStudent ? (allCourses || []) : []).forEach((course, i) => {
      map[course._id] = feedbackQueries[i]?.data === true;
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCourses, isStudent, feedbackQueries.map((q) => q.dataUpdatedAt).join(',')]);

  useEffect(() => {
    if (isError && (error as any)?.status === 401) router.push('/login');
  }, [isError, error, router]);

  const uniqueTypes = useMemo(
    () => (allCourses && allCourses.length ? Array.from(new Set(allCourses.map((c) => c.serviceType).filter(Boolean))) : []),
    [allCourses]
  );
  useEffect(() => {
    setCategories(uniqueTypes.length > 0 ? ["All", ...uniqueTypes] : defaultCategories);
  }, [uniqueTypes]);

  const filtered = useFilteredCourses(allCourses, filters);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (selectedSort === 'Name (A–Z)') arr.sort((a, b) => (a.courseName || '').localeCompare(b.courseName || ''));
    else if (selectedSort === 'Level') {
      const order: Record<string, number> = { Beginner: 0, Intermediate: 1, Advanced: 2, Expert: 3 };
      arr.sort((a, b) => (order[a.courseLevel] ?? 9) - (order[b.courseLevel] ?? 9));
    } else arr.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    return arr;
  }, [filtered, selectedSort]);

  // Reset to page 1 when filters/sort/pageSize change
  useEffect(() => {
    if (currentPage !== 1) { setCurrentPage(1); syncUrl({ page: 1 }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCategory, selectedLevel, selectedSort, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCourses = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize]
  );
  const rangeStart = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, sorted.length);

  const prefetchCourseDetail = usePrefetchCourseDetail();

  useEffect(() => {
    if (!sorted.length || safePage >= totalPages) return;
    const nextPageItems = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);
    nextPageItems.forEach((c) => prefetchCourseDetail(c._id));
  }, [sorted, safePage, totalPages, pageSize, prefetchCourseDetail]);

  const onStart = useCallback((id: string) => {
    if (isStudent) router.push(`/lms/pages/courses/coursesdetailedview/${id}`);
    else router.push(`/lms/pages/courses/uploadcourseresources?${new URLSearchParams({ courseId: id }).toString()}`);
  }, [isStudent, router]);

  const onPrefetch = useCallback((id: string) => { if (isStudent) prefetchCourseDetail(id); }, [isStudent, prefetchCourseDetail]);

  const handlePageChange = useCallback((p: number) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    setCurrentPage(clamped);
    syncUrl({ page: clamped });
  }, [totalPages, syncUrl]);

  const handleViewModeChange = useCallback((m: 'grid' | 'list') => { setViewMode(m); syncUrl({ view: m }); }, [syncUrl]);
  const handleCategoryChange = useCallback((c: string) => { setSelectedCategory(c); syncUrl({ category: c }); setShowCatDrop(false); }, [syncUrl]);
  const handleLevelChange = useCallback((l: string) => { setSelectedLevel(l); syncUrl({ level: l }); setShowLevelDrop(false); }, [syncUrl]);
  const handleSearchChange = useCallback((v: string) => { setSearchTerm(v); syncUrl({ q: v }); }, [syncUrl]);
  const handleClearFilters = useCallback(() => {
    setSearchTerm(''); setSelectedCategory('All'); setSelectedLevel('All');
    syncUrl({ q: '', category: 'All', level: 'All' });
  }, [syncUrl]);

  const handleFeedbackClick = useCallback((courseId: string) => {
    window.open(`/lms/pages/courses/feedback?courseId=${courseId}`, '_blank');
  }, []);

  const loading = isLoading && !allCourses;
  const onViewUsers = useCallback((courseId: string) => { router.push(`/lms/pages/courses/users/${courseId}`); }, [router]);

  const hasActiveFilter = selectedCategory !== 'All' || selectedLevel !== 'All' || !!searchTerm;

  // ── Content ────────────────────────────────────────────────────────────────
  const content = (
    <div className={`${poppins.variable} sc-courses-font`}>
      <style jsx global>{`
        .sc-courses-font,.sc-courses-font *{font-family:var(--font-poppins),'Poppins',-apple-system,BlinkMacSystemFont,sans-serif!important}
        .scrollbar-hide::-webkit-scrollbar{display:none}
        .scrollbar-hide{-ms-overflow-style:none;scrollbar-width:none}
      `}</style>

      {/* ── Header ── */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-bold tracking-tight" style={{ color: isDark ? T.dark.textMain : T.textMain, letterSpacing: '-0.02em' }}>
            Courses
          </h1>
          {/* {!loading && (
            <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: T.orangeLight, color: T.orange }}>
              {sorted.length}
            </span>
          )} */}
        </div>
        {/* <p className="text-[12.5px] mt-0.5" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
          Discover and continue your learning journey
        </p> */}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <Dropdown label="" value={selectedCategory === 'All' ? 'All Categories' : selectedCategory} options={categories.map(c => c === 'All' ? 'All Categories' : c)} onSelect={(v) => handleCategoryChange(v === 'All Categories' ? 'All' : v)} open={showCatDrop} setOpen={(v) => { setShowCatDrop(v); setShowLevelDrop(false); setShowSortDrop(false); }} isDark={isDark} />
        <Dropdown label="" value={selectedLevel === 'All' ? 'All Levels' : selectedLevel} options={LEVEL_OPTIONS.map(l => l === 'All' ? 'All Levels' : l)} onSelect={(v) => handleLevelChange(v === 'All Levels' ? 'All' : v)} open={showLevelDrop} setOpen={(v) => { setShowLevelDrop(v); setShowCatDrop(false); setShowSortDrop(false); }} isDark={isDark} width="w-40" />
        <Dropdown label="Sort by:" value={selectedSort} options={SORT_OPTIONS} onSelect={(v) => { setSelectedSort(v); setShowSortDrop(false); }} open={showSortDrop} setOpen={(v) => { setShowSortDrop(v); setShowCatDrop(false); setShowLevelDrop(false); }} isDark={isDark} width="w-40" />

        {hasActiveFilter && (
          <button onClick={handleClearFilters}
            className="flex items-center gap-1 h-9 px-2.5 rounded-lg text-[11.5px] font-semibold"
            style={{ background: 'transparent', color: isDark ? T.dark.textMuted : T.textMuted, border: `1px dashed ${isDark ? T.dark.border : T.border}` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = T.orange; (e.currentTarget as HTMLElement).style.borderColor = T.orange; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = isDark ? T.dark.textMuted : T.textMuted; (e.currentTarget as HTMLElement).style.borderColor = isDark ? T.dark.border : T.border; }}
          >Clear ×</button>
        )}

        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: isDark ? T.dark.textMuted : T.textMuted }} />
          <input
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search courses..."
            className="h-9 w-52 pl-9 pr-3 rounded-lg text-[12.5px] outline-none"
            style={{ background: isDark ? T.dark.card : T.bg, border: `1.5px solid ${isDark ? T.dark.border : T.border}`, color: isDark ? T.dark.textMain : T.textMain }}
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center p-0.5 rounded-lg" style={{ background: isDark ? T.dark.card : T.bg, border: `1.5px solid ${isDark ? T.dark.border : T.border}` }}>
          {(['grid', 'list'] as const).map(m => {
            const a = viewMode === m; const I = m === 'grid' ? LayoutGrid : List;
            return (
              <button key={m} onClick={() => handleViewModeChange(m)} className="p-1.5 rounded-md"
                style={{ background: a ? (isDark ? 'rgba(249,115,22,0.16)' : T.orangeLight) : 'transparent', color: a ? T.orange : isDark ? T.dark.textMuted : T.textMuted, transition: 'background .15s' }}>
                <I className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Cards ── */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" : "space-y-3"}>
            {[...Array(8)].map((_, i) => viewMode === 'grid'
              ? <Skel key={i} isDark={isDark} />
              : <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }} />
            )}
          </motion.div>
        ) : isError ? (
          <Err onRetry={() => refetch()} isDark={isDark} message={(error as any)?.message} />
        ) : sorted.length === 0 ? (
          <Empty onClear={handleClearFilters} hasSearch={hasActiveFilter} isDark={isDark} />
        ) : (
          <motion.div key={`${viewMode}-${safePage}`} variants={containerV} initial="hidden" animate="visible"
            className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" : "space-y-3"}>
            {paginatedCourses.map(c => {
              // Metrics first; the localStorage map is only the pre-analytics
              // fallback, and it under-reports (We Do practicals only).
              const p = metricsProgress?.[c._id] ?? progressMap[c._id];
              return (
                <CourseCard
                  key={c._id}
                  course={c}
                  isStudent={isStudent}
                  progress={p?.progress ?? 0}
                  studentCount={countStudents(c)}
                  lastAccessed={p?.lastAccessed}
                  onStart={onStart}
                  onPrefetch={onPrefetch}
                  onViewUsers={onViewUsers}
                  onFeedback={isStudent ? handleFeedbackClick : undefined}
                  hasPublishedFeedback={publishedFeedbackMap[c._id] || false}
                  viewMode={viewMode}
                  isDark={isDark}
                  canStaffAccessMaterials={canStaffAccessMaterials}
                  canStaffViewSchedule={canStaffViewSchedule}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background refresh indicator */}
      {isFetching && !loading && (
        <div className="flex justify-center mt-4">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
            <Loader2 className="w-3 h-3 animate-spin" style={{ color: T.orange }} />
            <span className="text-[10px] font-semibold" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>Refreshing…</span>
          </div>
        </div>
      )}

      {/* ── Pagination bar (count + pages + per-page) ── */}
      {!loading && sorted.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 mt-7">
          <span className="text-[13px]" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
            Showing <b style={{ color: isDark ? T.dark.textSub : T.textSub }}>{rangeStart}</b> to <b style={{ color: isDark ? T.dark.textSub : T.textSub }}>{rangeEnd}</b> of <b style={{ color: isDark ? T.dark.textSub : T.textSub }}>{sorted.length}</b> courses
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button onClick={() => handlePageChange(safePage - 1)} disabled={safePage === 1}
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: isDark ? T.dark.card : T.bg, border: `1.5px solid ${isDark ? T.dark.border : T.border}`, color: safePage === 1 ? (isDark ? T.dark.border : '#cbd0d8') : isDark ? T.dark.textMuted : T.textSub, cursor: safePage === 1 ? 'not-allowed' : 'pointer' }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              {(() => {
                const pages: (number | '...')[] = [];
                if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
                else {
                  pages.push(1);
                  if (safePage > 3) pages.push('...');
                  for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
                  if (safePage < totalPages - 2) pages.push('...');
                  pages.push(totalPages);
                }
                return pages.map((p, i) => p === '...'
                  ? <span key={`e${i}`} className="w-9 h-9 flex items-center justify-center text-[12px]" style={{ color: isDark ? T.dark.textHint : T.textHint }}>…</span>
                  : (
                    <button key={p} onClick={() => handlePageChange(p as number)}
                      className="min-w-9 h-9 px-2 rounded-lg text-[13px] font-bold"
                      style={{ background: safePage === p ? T.orange : isDark ? T.dark.card : T.bg, border: `1.5px solid ${safePage === p ? T.orange : isDark ? T.dark.border : T.border}`, color: safePage === p ? '#fff' : isDark ? T.dark.textSub : T.textSub, boxShadow: safePage === p ? `0 2px 8px ${T.orangeGlow}` : 'none' }}
                    >{p}</button>
                  ));
              })()}
              <button onClick={() => handlePageChange(safePage + 1)} disabled={safePage === totalPages}
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: isDark ? T.dark.card : T.bg, border: `1.5px solid ${isDark ? T.dark.border : T.border}`, color: safePage === totalPages ? (isDark ? T.dark.border : '#cbd0d8') : isDark ? T.dark.textMuted : T.textSub, cursor: safePage === totalPages ? 'not-allowed' : 'pointer' }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Per-page selector */}
          <div className="relative">
            <button onClick={() => setShowSizeDrop(v => !v)}
              className="flex items-center gap-2 h-9 px-3 rounded-lg text-[12.5px] font-semibold"
              style={{ background: isDark ? T.dark.card : T.bg, border: `1.5px solid ${isDark ? T.dark.border : T.border}`, color: isDark ? T.dark.textSub : T.textSub }}>
              {pageSize} per page
              <ChevronDown className="w-3.5 h-3.5 opacity-70" style={{ transform: showSizeDrop ? 'rotate(180deg)' : 'none' }} />
            </button>
            {showSizeDrop && (
              <div className="absolute bottom-full right-0 mb-1.5 w-32 py-1.5 z-50 rounded-xl"
                style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}`, boxShadow: '0 12px 28px rgba(16,24,40,0.12)' }}>
                {PAGE_SIZE_OPTIONS.map(s => (
                  <button key={s} onClick={() => { setPageSize(s); setShowSizeDrop(false); }}
                    className="w-full text-left px-3.5 py-2 text-[12.5px]"
                    style={{ fontWeight: pageSize === s ? 700 : 500, color: pageSize === s ? T.orange : isDark ? T.dark.textSub : T.textSub, background: pageSize === s ? (isDark ? 'rgba(249,115,22,0.12)' : T.orangeLight) : 'transparent' }}>
                    {s} per page
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Feature strip ── */}
      {/* {!loading && sorted.length > 0 && <FeatureStrip isDark={isDark} />} */}
    </div>
  );

  if (isRoleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? T.dark.pageBg : T.pageBg }}>
        <Loading size="size-8" />
      </div>
    );
  }

  if (userRole === 'admin' || userRole === 'ldhead' || userRole === 'subhead' || userRole === 'programcoordinator') {
    return <DashboardLayout>{content}</DashboardLayout>;
  }

  if (userRole === 'student' || isStudent) {
    return <StudentLayout>{content}</StudentLayout>;
  }

  return <StaffLayout>{content}</StaffLayout>;
}
