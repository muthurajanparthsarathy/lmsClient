"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Users, Search, ChevronLeft, Loader2, 
  BookOpen, CheckCircle, Clock, XCircle,
  ArrowLeft, ChevronDown, ChevronUp, Calendar, CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { getAuthToken } from '@/apiServices/studentcoursepage';
import { StudentLayout } from '../../../../component/student/student-layout';
import DashboardLayout from '../../../../component/layout';
import { StaffLayout } from '../../../../component/stafflayout/staff-layout';
import { Loading } from '@/components/loading-ui/loading';

// ─── Types ────────────────────────────────────────────────────────────────────
interface CategoryProgress {
  total: number;
  completed: number;
  percentage?: number;
}

interface ProgressData {
  total: number;
  completed: number;
  percentage: number;
  details?: Record<string, CategoryProgress>;
}

interface UserProgress {
  student: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    department?: string;
    role?: {
      renameRole: string;
      originalRole: string;
      roleValue: string;
    };
  };
  progress: {
    overall: number;
    I_Do: ProgressData;
    We_Do: ProgressData;
    You_Do: ProgressData;
  };
  lastActivity?: string;
}

interface CourseUsersData {
  course: {
    _id: string;
    courseName: string;
    courseCode: string;
    courseLevel: string;
    serviceType: string;
  };
  stats: {
    totalStudents: number;
    averageProgress: number;
    completedStudents: number;
    inProgressStudents: number;
    notStartedStudents: number;
  };
  students: UserProgress[];
  pedagogySummary?: {
    I_Do: { totalItems: number; categories: string[] };
    We_Do: { totalItems: number; categories: string[] };
    You_Do: { totalItems: number; categories: string[] };
  };
}

// ─── API Service ─────────────────────────────────────────────────────────────
const fetchCourseUsers = async (courseId: string): Promise<CourseUsersData> => {
  const token = getAuthToken();
  const response = await fetch(`https://lmsserver-yeve.onrender.com/staff/analytics/course/${courseId}/students`, {
    cache: 'no-store',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch course users');
  }

  const result = await response.json();
  
  if (result.success && result.data) {
    return result.data;
  }
  
  return result;
};

// ─── Design Tokens ──────────────────────────────────────────────────────────
const T = {
  orange: '#F27757',
  orangeDark: '#E0623F',
  orangeGlow: 'rgba(242,119,87,0.22)',
  orangeLight: 'rgba(242,119,87,0.08)',
  textMain: '#1a1a2e',
  textSub: '#6b6b7e',
  textMuted: '#8b8b9e',
  textHint: '#bcbccc',
  border: '#ecedf1',
  bg: '#ffffff',
  pageBg: '#f8f8fa',
  dark: {
    bg: '#1a1a2e',
    surface: '#222240',
    card: '#252545',
    border: '#2e2e4a',
    textMain: '#e8e8f0',
    textSub: '#a0a0b8',
    textMuted: '#6b6b88',
    textHint: '#4a4a66',
    pageBg: '#12121f'
  }
};

// ─── Status Badge ────────────────────────────────────────────────────────────
const StatusBadge = ({ progress }: { progress: number }) => {
  if (progress >= 80) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" 
        style={{ background: '#ecfdf5', color: '#059669' }}>
        <CheckCircle className="w-3 h-3" /> Completed
      </span>
    );
  } else if (progress > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" 
        style={{ background: '#fff7ed', color: '#ea580c' }}>
        <Clock className="w-3 h-3" /> In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold" 
      style={{ background: '#f1f5f9', color: '#64748b' }}>
      <XCircle className="w-3 h-3" /> Not Started
    </span>
  );
};

const ProgressRing = ({ percentage, size = 40, strokeWidth = 4, showLabel = true }: { 
  percentage: number; 
  size?: number; 
  strokeWidth?: number;
  showLabel?: boolean;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const pct = Math.min(Math.max(percentage, 0), 100);
  const greenLength = (pct / 100) * circumference;
  const redLength = circumference - greenLength;
  const [isHovered, setIsHovered] = useState(false);
  const glowColor = pct >= 80 ? 'rgba(16,185,129,0.55)' : 'rgba(239,68,68,0.55)';

  return (
    <motion.div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size, cursor: 'pointer' }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{
        scale: isHovered ? 1.15 : 1,
        filter: isHovered ? `drop-shadow(0 0 6px ${glowColor})` : 'drop-shadow(0 0 0 rgba(0,0,0,0))',
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
    >
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Red portion — "not completed" share, fills the rest of the ring */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#ef4444"
          strokeWidth={strokeWidth}
          initial={{ strokeDasharray: `0 ${circumference}`, strokeDashoffset: 0 }}
          whileInView={{ strokeDasharray: `${redLength} ${circumference}`, strokeDashoffset: -greenLength }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {/* Green portion — "completed" share, starts at 12 o'clock */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          whileInView={{ strokeDasharray: `${greenLength} ${circumference}` }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      {showLabel && (
        <motion.span
          className="absolute text-[10px] font-bold"
          style={{ color: T.textMain }}
          animate={{ scale: isHovered ? 1.2 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        >
          {Math.round(pct)}%
        </motion.span>
      )}
    </motion.div>
  );
};

// ─── Category Progress Component ────────────────────────────────────────────
const CategoryProgressBar = ({ category, progress, isDark }: { 
  category: string; 
  progress: CategoryProgress;
  isDark: boolean;
}) => {
  const percentage = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[10px] font-medium w-20 truncate" style={{ color: isDark ? T.dark.textSub : T.textSub }}>
        {category}:
      </span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden flex" style={{ background: '#ef4444' }}>
        <motion.div 
          className="h-full"
          style={{ background: '#10b981' }}
          initial={{ width: '0%' }}
          whileInView={{ width: `${percentage}%` }}
          viewport={{ once: false, amount: 0.5 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[9px] font-medium min-w-[60px] text-right" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
        {progress.completed}/{progress.total}
      </span>
    </div>
  );
};

const getStatusColor = (pct: number): string => (pct >= 80 ? '#10b981' : '#ef4444');
const getStatusLabel = (pct: number): string => (pct >= 80 ? 'Completed' : 'Not Completed');

const ThresholdLegend = ({ isDark }: { isDark: boolean }) => {
  const items: { label: string; color: string }[] = [
    { label: 'Completed', color: '#10b981' },
    { label: 'Not Completed', color: '#ef4444' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: isDark ? T.dark.textSub : T.textSub }}>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
};

// ─── Monthly Overall Chart ──────────────────────────────────────────────────
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];

type TimeView = 'monthly' | 'weekly';

const TimeViewToggle = ({ view, setView, isDark }: { view: TimeView; setView: (v: TimeView) => void; isDark: boolean }) => {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: isDark ? T.dark.surface : '#f1f5f9' }}>
      <button
        onClick={() => setView('monthly')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          view === 'monthly' 
            ? 'text-white shadow-sm' 
            : ''
        }`}
        style={{
          background: view === 'monthly' ? T.orange : 'transparent',
          color: view === 'monthly' ? '#fff' : (isDark ? T.dark.textSub : T.textSub),
        }}
      >
        <Calendar className="w-3.5 h-3.5" />
        Monthly
      </button>
      <button
        onClick={() => setView('weekly')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
          view === 'weekly' 
            ? 'text-white shadow-sm' 
            : ''
        }`}
        style={{
          background: view === 'weekly' ? T.orange : 'transparent',
          color: view === 'weekly' ? '#fff' : (isDark ? T.dark.textSub : T.textSub),
        }}
      >
        <CalendarDays className="w-3.5 h-3.5" />
        Weekly
      </button>
    </div>
  );
};

// ─── Monthly Chart ──────────────────────────────────────────────────────────
const MonthlyChart = ({
  students,
  isDark,
  hovered,
  setHovered,
}: {
  students: UserProgress[];
  isDark: boolean;
  hovered: number | null;
  setHovered: (index: number | null) => void;
}) => {
  const monthlyData = useMemo(() => {
    const buckets = new Map<string, { label: string; sortKey: string; students: UserProgress[] }>();
    students.forEach((s) => {
      if (!s.lastActivity) return;
      const d = new Date(s.lastActivity);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
      if (!buckets.has(key)) buckets.set(key, { label, sortKey: key, students: [] });
      buckets.get(key)!.students.push(s);
    });
    const arr = Array.from(buckets.values()).sort((a, b) => (a.sortKey > b.sortKey ? 1 : -1));
    return arr.map((b) => ({
      label: b.label,
      value: b.students.reduce((a, s) => a + (s.progress?.overall || 0), 0) / b.students.length,
      count: b.students.length,
    }));
  }, [students]);

  const currentYear = new Date().getFullYear();
  
  const monthDataMap = useMemo(() => {
    const map = new Map<number, { value: number; count: number; label: string }>();
    monthlyData.forEach((m) => {
      const monthIndex = MONTH_LABELS.findIndex(label => m.label.startsWith(label));
      if (monthIndex !== -1) {
        map.set(monthIndex, { value: m.value, count: m.count, label: m.label });
      }
    });
    return map;
  }, [monthlyData]);

  const allMonths = useMemo(() => {
    return MONTH_LABELS.map((month, index) => {
      const data = monthDataMap.get(index);
      return {
        label: `${month} ${currentYear}`,
        value: data ? data.value : 0,
        count: data ? data.count : 0,
        hasData: !!data,
      };
    });
  }, [monthDataMap, currentYear]);

  const width = 680;
  const height = 260;
  const padding = { top: 28, right: 16, bottom: 44, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const gridLines = [0, 20, 40, 60, 80, 100];
  const yFor = (v: number) => padding.top + chartHeight - (Math.min(Math.max(v, 0), 100) / 100) * chartHeight;

  if (allMonths.length === 0) {
    return (
      <div className="w-full max-w-3xl text-center py-10">
        <p className="text-sm" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
          No activity dates available yet to build a month-by-month view.
        </p>
      </div>
    );
  }

  const groupWidth = chartWidth / allMonths.length;
  const barWidth = Math.min(56, groupWidth * 0.5);

  const monthsWithData = allMonths.map((m, i) => ({ ...m, index: i })).filter(m => m.hasData);
  const topMonth = monthsWithData.length > 0 
    ? monthsWithData.reduce((best, m) => (best === null || m.value > best.value ? m : best), monthsWithData[0])
    : null;

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold" style={{ color: isDark ? T.dark.textMain : T.textMain }}>
          Monthly Overall Progress
        </span>
        <ThresholdLegend isDark={isDark} />
      </div>
      <p className="text-[11px] mb-3" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
        Average overall completion, grouped by month of last activity
      </p>

      <div className="relative">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          {gridLines.map((g) => (
            <g key={g}>
              <line
                x1={padding.left} x2={padding.left + chartWidth}
                y1={yFor(g)} y2={yFor(g)}
                stroke={isDark ? T.dark.border : '#eef0f4'}
                strokeWidth={1}
              />
              <text
                x={padding.left - 10} y={yFor(g)}
                textAnchor="end" dominantBaseline="middle"
                fontSize="10" fill={isDark ? T.dark.textMuted : T.textMuted}
              >
                {g}%
              </text>
            </g>
          ))}

          <line
            x1={padding.left} x2={padding.left + chartWidth}
            y1={yFor(80)} y2={yFor(80)}
            stroke="#10b981" strokeWidth={1} strokeDasharray="4 4" opacity={0.4}
          />
          <text x={padding.left + chartWidth} y={yFor(80) - 6} textAnchor="end" fontSize="9" fill="#10b981" opacity={0.7}>
            80% threshold
          </text>

          {allMonths.map((m, mi) => {
            const barColor = m.hasData ? getStatusColor(m.value) : '#e5e7eb';
            const barX = padding.left + mi * groupWidth + (groupWidth - barWidth) / 2;
            const displayValue = m.hasData ? m.value : 0;
            const yPosition = yFor(displayValue);
            const heightValue = chartHeight - (yPosition - padding.top);
            
            return (
              <g key={m.label}>
                <motion.rect
                  x={barX}
                  width={barWidth}
                  rx={6}
                  fill={barColor}
                  style={{ 
                    cursor: m.hasData ? 'pointer' : 'default',
                    opacity: m.hasData ? 1 : 0.3,
                  }}
                  initial={{ y: padding.top + chartHeight, height: 0 }}
                  whileInView={{ y: yPosition, height: heightValue }}
                  whileHover={m.hasData ? { scale: 1.05, filter: `drop-shadow(0 0 8px ${barColor}99)` } : {}}
                  viewport={{ once: false, amount: 0.3 }}
                  onHoverStart={() => m.hasData && setHovered(mi)}
                  onHoverEnd={() => setHovered(null)}
                  transition={{ duration: 0.9, delay: mi * 0.04, ease: 'easeOut' }}
                />

                <text
                  x={barX + barWidth / 2}
                  y={padding.top + chartHeight + 18}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={isDark ? T.dark.textSub : T.textSub}
                >
                  {m.label.split(' ')[0]}
                </text>
                <text
                  x={barX + barWidth / 2}
                  y={padding.top + chartHeight + 32}
                  textAnchor="middle"
                  fontSize="9"
                  fill={m.hasData ? (isDark ? T.dark.textMuted : T.textMuted) : (isDark ? T.dark.textHint : T.textHint)}
                >
                  {m.hasData ? `${m.count} student${m.count !== 1 ? 's' : ''}` : 'No data'}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered !== null && allMonths[hovered]?.hasData && (
          <div
            className="absolute pointer-events-none z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-bold"
            style={{
              left: '50%',
              top: '12px',
              transform: 'translateX(-50%)',
              background: isDark ? T.dark.card : '#ffffff',
              border: `1px solid ${isDark ? T.dark.border : T.border}`,
              color: isDark ? T.dark.textMain : T.textMain,
              minWidth: '120px',
              textAlign: 'center',
              boxShadow: isDark 
                ? '0 10px 40px rgba(0,0,0,0.5)' 
                : '0 10px 40px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ color: getStatusColor(allMonths[hovered].value), fontSize: '18px' }}>
              {Math.round(allMonths[hovered].value)}%
            </div>
            <div className="text-[11px] font-medium" style={{ color: isDark ? T.dark.textSub : T.textSub }}>
              {allMonths[hovered].label}
            </div>
            <div className="text-[10px] font-normal" style={{ color: isDark ? T.dark.textHint : T.textHint }}>
              {allMonths[hovered].count} student{allMonths[hovered].count !== 1 ? 's' : ''}
            </div>
            <div 
              className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                bottom: '-8px',
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: `8px solid ${isDark ? T.dark.card : '#ffffff'}`,
              }}
            />
          </div>
        )}
      </div>

      {topMonth && (
        <p className="text-[11px] mt-2 text-center font-medium" style={{ color: isDark ? T.dark.textSub : T.textSub }}>
          Best month: <span style={{ color: T.orange, fontWeight: 700 }}>{topMonth.label}</span> at{' '}
          <span style={{ color: T.orange, fontWeight: 700 }}>{Math.round(topMonth.value)}%</span>
        </p>
      )}
    </div>
  );
};

// ─── Weekly Chart ───────────────────────────────────────────────────────────
const WeeklyChart = ({
  students,
  isDark,
  hovered,
  setHovered,
}: {
  students: UserProgress[];
  isDark: boolean;
  hovered: number | null;
  setHovered: (index: number | null) => void;
}) => {
  const weeklyData = useMemo(() => {
    const buckets = new Map<string, { label: string; sortKey: string; students: UserProgress[] }>();
    students.forEach((s) => {
      if (!s.lastActivity) return;
      const d = new Date(s.lastActivity);
      if (isNaN(d.getTime())) return;
      
      // Get the week number (1-52)
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      
      const key = `${d.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
      const label = `Week ${weekNumber} ${d.getFullYear()}`;
      
      if (!buckets.has(key)) buckets.set(key, { label, sortKey: key, students: [] });
      buckets.get(key)!.students.push(s);
    });
    
    const arr = Array.from(buckets.values()).sort((a, b) => (a.sortKey > b.sortKey ? 1 : -1));
    return arr.map((b) => ({
      label: b.label,
      value: b.students.reduce((a, s) => a + (s.progress?.overall || 0), 0) / b.students.length,
      count: b.students.length,
    }));
  }, [students]);

  const width = 680;
  const height = 260;
  const padding = { top: 28, right: 16, bottom: 44, left: 46 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const gridLines = [0, 20, 40, 60, 80, 100];
  const yFor = (v: number) => padding.top + chartHeight - (Math.min(Math.max(v, 0), 100) / 100) * chartHeight;

  if (weeklyData.length === 0) {
    return (
      <div className="w-full max-w-3xl text-center py-10">
        <p className="text-sm" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
          No activity dates available yet to build a week-by-week view.
        </p>
      </div>
    );
  }

  // Show last 12 weeks or all if less
  const displayData = weeklyData.slice(-12);
  const groupWidth = chartWidth / displayData.length;
  const barWidth = Math.min(56, groupWidth * 0.5);

  const dataWithIndex = displayData.map((m, i) => ({ ...m, index: i }));
  const topWeek = dataWithIndex.length > 0 
    ? dataWithIndex.reduce((best, m) => (best === null || m.value > best.value ? m : best), dataWithIndex[0])
    : null;

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold" style={{ color: isDark ? T.dark.textMain : T.textMain }}>
          Weekly Overall Progress
        </span>
        <ThresholdLegend isDark={isDark} />
      </div>
      <p className="text-[11px] mb-3" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
        Average overall completion, grouped by week of last activity (last 12 weeks)
      </p>

      <div className="relative">
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
          {gridLines.map((g) => (
            <g key={g}>
              <line
                x1={padding.left} x2={padding.left + chartWidth}
                y1={yFor(g)} y2={yFor(g)}
                stroke={isDark ? T.dark.border : '#eef0f4'}
                strokeWidth={1}
              />
              <text
                x={padding.left - 10} y={yFor(g)}
                textAnchor="end" dominantBaseline="middle"
                fontSize="10" fill={isDark ? T.dark.textMuted : T.textMuted}
              >
                {g}%
              </text>
            </g>
          ))}

          <line
            x1={padding.left} x2={padding.left + chartWidth}
            y1={yFor(80)} y2={yFor(80)}
            stroke="#10b981" strokeWidth={1} strokeDasharray="4 4" opacity={0.4}
          />
          <text x={padding.left + chartWidth} y={yFor(80) - 6} textAnchor="end" fontSize="9" fill="#10b981" opacity={0.7}>
            80% threshold
          </text>

          {displayData.map((m, mi) => {
            const barColor = getStatusColor(m.value);
            const barX = padding.left + mi * groupWidth + (groupWidth - barWidth) / 2;
            const yPosition = yFor(m.value);
            const heightValue = chartHeight - (yPosition - padding.top);
            
            return (
              <g key={m.label}>
                <motion.rect
                  x={barX}
                  width={barWidth}
                  rx={6}
                  fill={barColor}
                  style={{ cursor: 'pointer' }}
                  initial={{ y: padding.top + chartHeight, height: 0 }}
                  whileInView={{ y: yPosition, height: heightValue }}
                  whileHover={{ scale: 1.05, filter: `drop-shadow(0 0 8px ${barColor}99)` }}
                  viewport={{ once: false, amount: 0.3 }}
                  onHoverStart={() => setHovered(mi)}
                  onHoverEnd={() => setHovered(null)}
                  transition={{ duration: 0.9, delay: mi * 0.04, ease: 'easeOut' }}
                />

                <text
                  x={barX + barWidth / 2}
                  y={padding.top + chartHeight + 18}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill={isDark ? T.dark.textSub : T.textSub}
                >
                  {m.label.split(' ')[0]} {m.label.split(' ')[1]?.slice(2,4)}
                </text>
                <text
                  x={barX + barWidth / 2}
                  y={padding.top + chartHeight + 30}
                  textAnchor="middle"
                  fontSize="8"
                  fill={isDark ? T.dark.textMuted : T.textMuted}
                >
                  {m.count} student{m.count !== 1 ? 's' : ''}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered !== null && displayData[hovered] && (
          <div
            className="absolute pointer-events-none z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-bold"
            style={{
              left: '50%',
              top: '12px',
              transform: 'translateX(-50%)',
              background: isDark ? T.dark.card : '#ffffff',
              border: `1px solid ${isDark ? T.dark.border : T.border}`,
              color: isDark ? T.dark.textMain : T.textMain,
              minWidth: '120px',
              textAlign: 'center',
              boxShadow: isDark 
                ? '0 10px 40px rgba(0,0,0,0.5)' 
                : '0 10px 40px rgba(0,0,0,0.15)',
            }}
          >
            <div style={{ color: getStatusColor(displayData[hovered].value), fontSize: '18px' }}>
              {Math.round(displayData[hovered].value)}%
            </div>
            <div className="text-[11px] font-medium" style={{ color: isDark ? T.dark.textSub : T.textSub }}>
              {displayData[hovered].label}
            </div>
            <div className="text-[10px] font-normal" style={{ color: isDark ? T.dark.textHint : T.textHint }}>
              {displayData[hovered].count} student{displayData[hovered].count !== 1 ? 's' : ''}
            </div>
            <div 
              className="absolute left-1/2 -translate-x-1/2 w-0 h-0"
              style={{
                bottom: '-8px',
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: `8px solid ${isDark ? T.dark.card : '#ffffff'}`,
              }}
            />
          </div>
        )}
      </div>

      {topWeek && (
        <p className="text-[11px] mt-2 text-center font-medium" style={{ color: isDark ? T.dark.textSub : T.textSub }}>
          Best week: <span style={{ color: T.orange, fontWeight: 700 }}>{topWeek.label}</span> at{' '}
          <span style={{ color: T.orange, fontWeight: 700 }}>{Math.round(topWeek.value)}%</span>
        </p>
      )}
    </div>
  );
};

// ─── Category Rings Compare ──────────────────────────────────────────────────
const CategoryRingsCompare = ({
  categories,
  size = 200,
  isDark,
}: {
  categories: { label: string; percentage: number }[];
  size?: number;
  isDark: boolean;
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const thickness = 15;
  const gap = 5;
  const avg = categories.length ? categories.reduce((a, c) => a + c.percentage, 0) / categories.length : 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <motion.div
        className="relative inline-flex items-center justify-center"
        style={{ width: size, height: size, cursor: 'pointer' }}
        whileHover={{ scale: 1.05 }}
        transition={{ type: 'spring', stiffness: 250, damping: 20 }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {categories.map((c, i) => {
            const r = size / 2 - 6 - i * (thickness + gap);
            const circumference = 2 * Math.PI * r;
            const pct = Math.min(Math.max(c.percentage, 0), 100);
            const greenLength = (pct / 100) * circumference;
            const redLength = circumference - greenLength;
            return (
              <g key={c.label}>
                <motion.circle
                  cx={cx} cy={cy} r={r} fill="none"
                  stroke="#ef4444" strokeWidth={thickness}
                  initial={{ strokeDasharray: `0 ${circumference}`, strokeDashoffset: 0 }}
                  whileInView={{ strokeDasharray: `${redLength} ${circumference}`, strokeDashoffset: -greenLength }}
                  viewport={{ once: false, amount: 0.4 }}
                  transition={{ duration: 1, delay: i * 0.15, ease: 'easeOut' }}
                />
                <motion.circle
                  cx={cx} cy={cy} r={r} fill="none"
                  stroke="#10b981" strokeWidth={thickness}
                  initial={{ strokeDasharray: `0 ${circumference}` }}
                  whileInView={{ strokeDasharray: `${greenLength} ${circumference}` }}
                  viewport={{ once: false, amount: 0.4 }}
                  transition={{ duration: 1, delay: i * 0.15, ease: 'easeOut' }}
                />
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>Avg</span>
          <span className="text-xl font-bold leading-none" style={{ color: isDark ? T.dark.textMain : T.textMain }}>{Math.round(avg)}%</span>
        </div>
      </motion.div>
      <div className="flex flex-col gap-2.5">
        {categories.map((c) => (
          <div key={c.label} className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: getStatusColor(c.percentage) }} />
            <span className="text-sm font-medium w-16" style={{ color: isDark ? T.dark.textSub : T.textSub }}>{c.label}</span>
            <span className="text-sm font-bold" style={{ color: isDark ? T.dark.textMain : T.textMain }}>{Math.round(c.percentage)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CourseUsersPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.courseId as string;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [timeView, setTimeView] = useState<TimeView>('monthly');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // ─── Dark mode detection ──────────────────────────────────────────────────
  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'));
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // ─── User role detection ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const role = localStorage.getItem('smartcliff_roleValue') || 
                   localStorage.getItem('smartcliff_userRole') || 
                   'student';
      setUserRole(role.toLowerCase());
    } catch {
      setUserRole('student');
    } finally {
      setIsRoleLoading(false);
    }
  }, []);

  // ─── Toggle row expansion ──────────────────────────────────────────────────
  const toggleRow = (studentId: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(studentId)) {
      newSet.delete(studentId);
    } else {
      newSet.add(studentId);
    }
    setExpandedRows(newSet);
  };

  // ─── Fetch course users ────────────────────────────────────────────────────
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['course-users', courseId],
    queryFn: () => fetchCourseUsers(courseId),
    enabled: !!courseId,
    retry: 1,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // ─── Filter students by search ────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    if (!searchTerm.trim()) return data.students;
    
    const term = searchTerm.toLowerCase().trim();
    return data.students.filter(s => 
      s.student.firstName?.toLowerCase().includes(term) ||
      s.student.lastName?.toLowerCase().includes(term) ||
      s.student.email?.toLowerCase().includes(term)
    );
  }, [data, searchTerm]);

  const overallAvg = useMemo(
    () => (filteredStudents.length ? filteredStudents.reduce((a, s) => a + (s.progress?.overall || 0), 0) / filteredStudents.length : 0),
    [filteredStudents]
  );
  const iDoAvg = useMemo(
    () => (filteredStudents.length ? filteredStudents.reduce((a, s) => a + (s.progress?.I_Do?.percentage || 0), 0) / filteredStudents.length : 0),
    [filteredStudents]
  );
  const weDoAvg = useMemo(
    () => (filteredStudents.length ? filteredStudents.reduce((a, s) => a + (s.progress?.We_Do?.percentage || 0), 0) / filteredStudents.length : 0),
    [filteredStudents]
  );
  const youDoAvg = useMemo(
    () => (filteredStudents.length ? filteredStudents.reduce((a, s) => a + (s.progress?.You_Do?.percentage || 0), 0) / filteredStudents.length : 0),
    [filteredStudents]
  );

  // ─── Loading state ──────────────────────────────────────────────────────────
  if (isRoleLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? T.dark.pageBg : T.pageBg }}>
        <Loading size="size-8" />
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? T.dark.pageBg : T.pageBg }}>
        <div className="text-center p-8 rounded-xl" style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
          <Users className="w-12 h-12 mx-auto mb-3" style={{ color: '#e11d48' }} />
          <h3 className="text-lg font-bold mb-1" style={{ color: isDark ? T.dark.textMain : T.textMain }}>Failed to load students</h3>
          <p className="text-sm" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>{(error as any)?.message || 'Something went wrong'}</p>
          <button onClick={() => refetch()} className="mt-4 px-4 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: T.orange }}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // ─── No data state ──────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? T.dark.pageBg : T.pageBg }}>
        <div className="text-center p-8 rounded-xl" style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
          <Users className="w-12 h-12 mx-auto mb-3" style={{ color: T.orange }} />
          <h3 className="text-lg font-bold" style={{ color: isDark ? T.dark.textMain : T.textMain }}>No students found</h3>
          <p className="text-sm" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>This course has no enrolled students yet.</p>
        </div>
      </div>
    );
  }

  // ─── Content ────────────────────────────────────────────────────────────────
  const content = (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg transition-all"
          style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}
        >
          <ArrowLeft className="w-5 h-5" style={{ color: isDark ? T.dark.textSub : T.textSub }} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: isDark ? T.dark.textMain : T.textMain }}>
            {data.course?.courseName || 'Course'}
          </h1>
          <p className="text-sm" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
            {data.course?.courseCode || ''} • {data.course?.courseLevel || ''} • {data.stats?.totalStudents || 0} students
          </p>
        </div>
      </div>

      {/* ─── Performance Analytics ─── */}
      {filteredStudents.length > 0 && (
        <div className="mb-6 p-5 rounded-xl" style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <h3 className="text-sm font-bold" style={{ color: isDark ? T.dark.textMain : T.textMain }}>Performance Analytics</h3>
            <div className="flex items-center gap-3">
              <TimeViewToggle view={timeView} setView={setTimeView} isDark={isDark} />
              <ThresholdLegend isDark={isDark} />
            </div>
          </div>

          {/* Monthly/Weekly Chart - Toggle based on view */}
          <div className="flex flex-col items-center pb-6 mb-6" style={{ borderBottom: `1px solid ${isDark ? T.dark.border : T.border}` }}>
            {timeView === 'monthly' ? (
              <MonthlyChart 
                students={filteredStudents} 
                isDark={isDark} 
                hovered={hoveredIndex}
                setHovered={setHoveredIndex}
              />
            ) : (
              <WeeklyChart 
                students={filteredStudents} 
                isDark={isDark}
                hovered={hoveredIndex}
                setHovered={setHoveredIndex}
              />
            )}
          </div>

          {/* I Do / We Do / You Do — single-ring, red/green split per pedagogy stage */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-6 mb-6" style={{ borderBottom: `1px solid ${isDark ? T.dark.border : T.border}` }}>
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold mb-3" style={{ color: isDark ? T.dark.textSub : T.textSub }}>I Do</span>
              <ProgressRing percentage={iDoAvg} size={140} strokeWidth={14} showLabel={true} />
              <span className="mt-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: getStatusColor(iDoAvg) }}>{getStatusLabel(iDoAvg)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold mb-3" style={{ color: isDark ? T.dark.textSub : T.textSub }}>We Do</span>
              <ProgressRing percentage={weDoAvg} size={140} strokeWidth={14} showLabel={true} />
              <span className="mt-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: getStatusColor(weDoAvg) }}>{getStatusLabel(weDoAvg)}</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs font-semibold mb-3" style={{ color: isDark ? T.dark.textSub : T.textSub }}>You Do</span>
              <ProgressRing percentage={youDoAvg} size={140} strokeWidth={14} showLabel={true} />
              <span className="mt-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: getStatusColor(youDoAvg) }}>{getStatusLabel(youDoAvg)}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* ─── Search ─── */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: isDark ? T.dark.textMuted : T.textMuted }} />
        <input
          type="text"
          placeholder="Search students by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
          style={{
            background: isDark ? T.dark.card : T.bg,
            border: `1.5px solid ${isDark ? T.dark.border : T.border}`,
            color: isDark ? T.dark.textMain : T.textMain,
          }}
        />
      </div>

      {/* ─── Pedagogy Summary ─── */}
      {data.pedagogySummary && (
        <div className="mb-6 p-4 rounded-xl" style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
          <h3 className="text-sm font-bold mb-2" style={{ color: isDark ? T.dark.textMain : T.textMain }}>Course Content Summary</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-2 rounded-lg" style={{ background: isDark ? T.dark.surface : '#f3f4f6' }}>
              <span className="text-xs font-semibold" style={{ color: T.orange }}>I Do</span>
              <span className="text-xs ml-2" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
                {data.pedagogySummary.I_Do.totalItems} items • {data.pedagogySummary.I_Do.categories.join(', ')}
              </span>
            </div>
            <div className="p-2 rounded-lg" style={{ background: isDark ? T.dark.surface : '#f3f4f6' }}>
              <span className="text-xs font-semibold" style={{ color: T.orange }}>We Do</span>
              <span className="text-xs ml-2" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
                {data.pedagogySummary.We_Do.totalItems} items • {data.pedagogySummary.We_Do.categories.join(', ')}
              </span>
            </div>
            <div className="p-2 rounded-lg" style={{ background: isDark ? T.dark.surface : '#f3f4f6' }}>
              <span className="text-xs font-semibold" style={{ color: T.orange }}>You Do</span>
              <span className="text-xs ml-2" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
                {data.pedagogySummary.You_Do.totalItems} items • {data.pedagogySummary.You_Do.categories.join(', ')}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* ─── Student Table ─── */}
      <div className="rounded-xl overflow-hidden" style={{ background: isDark ? T.dark.card : T.bg, border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${isDark ? T.dark.border : T.border}` }}>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>Student</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>Email</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>I Do</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>We Do</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>You Do</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>Overall</th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>Status</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8">
                      <p className="text-sm" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>No students found matching your search.</p>
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student, index) => {
                    const overall = student.progress?.overall || 0;
                    const iDo = student.progress?.I_Do?.percentage || 0;
                    const weDo = student.progress?.We_Do?.percentage || 0;
                    const youDo = student.progress?.You_Do?.percentage || 0;
                    const isExpanded = expandedRows.has(student.student._id);

                    return (
                      <React.Fragment key={student.student._id}>
                        <motion.tr
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          style={{ borderBottom: index < filteredStudents.length - 1 ? `1px solid ${isDark ? T.dark.border : T.border}` : 'none' }}
                          className="cursor-pointer hover:bg-opacity-50"
                          onClick={() => toggleRow(student.student._id)}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.03)' : '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                style={{ background: `linear-gradient(135deg, ${T.orange}, ${T.orangeDark})` }}>
                                {(student.student.firstName?.[0] || 'S').toUpperCase()}
                              </div>
                              <span className="text-sm font-medium" style={{ color: isDark ? T.dark.textMain : T.textMain }}>
                                {student.student.firstName} {student.student.lastName}
                              </span>
                              <button className="ml-1 p-0.5 rounded" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm" style={{ color: isDark ? T.dark.textSub : T.textSub }}>
                              {student.student.email}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <ProgressRing percentage={iDo} size={36} strokeWidth={3} showLabel={true} />
                              <span className="text-[9px] font-medium" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
                                {student.progress?.I_Do?.completed || 0}/{student.progress?.I_Do?.total || 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <ProgressRing percentage={weDo} size={36} strokeWidth={3} showLabel={true} />
                              <span className="text-[9px] font-medium" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
                                {student.progress?.We_Do?.completed || 0}/{student.progress?.We_Do?.total || 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <ProgressRing percentage={youDo} size={36} strokeWidth={3} showLabel={true} />
                              <span className="text-[9px] font-medium" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
                                {student.progress?.You_Do?.completed || 0}/{student.progress?.You_Do?.total || 0}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <ProgressRing percentage={overall} size={40} strokeWidth={4} showLabel={true} />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <StatusBadge progress={overall} />
                          </td>
                        </motion.tr>

                        {/* ─── Expanded Row with Category Details ─── */}
                        {isExpanded && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <td colSpan={7} className="px-4 py-2">
                              <div className="p-3 rounded-lg" style={{ background: isDark ? T.dark.surface : '#f9fafb', border: `1px solid ${isDark ? T.dark.border : T.border}` }}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {/* I Do Details */}
                                  <div>
                                    <h4 className="text-xs font-bold mb-1.5" style={{ color: T.orange }}>I Do</h4>
                                    {student.progress?.I_Do?.details && Object.keys(student.progress.I_Do.details).length > 0 ? (
                                      Object.entries(student.progress.I_Do.details).map(([category, prog]) => (
                                        <CategoryProgressBar key={category} category={category} progress={prog} isDark={isDark} />
                                      ))
                                    ) : (
                                      <span className="text-[10px]" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>No items</span>
                                    )}
                                  </div>

                                  {/* We Do Details */}
                                  <div>
                                    <h4 className="text-xs font-bold mb-1.5" style={{ color: T.orange }}>We Do</h4>
                                    {student.progress?.We_Do?.details && Object.keys(student.progress.We_Do.details).length > 0 ? (
                                      Object.entries(student.progress.We_Do.details).map(([category, prog]) => (
                                        <CategoryProgressBar key={category} category={category} progress={prog} isDark={isDark} />
                                      ))
                                    ) : (
                                      <span className="text-[10px]" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>No items</span>
                                    )}
                                  </div>

                                  {/* You Do Details */}
                                  <div>
                                    <h4 className="text-xs font-bold mb-1.5" style={{ color: T.orange }}>You Do</h4>
                                    {student.progress?.You_Do?.details && Object.keys(student.progress.You_Do.details).length > 0 ? (
                                      Object.entries(student.progress.You_Do.details).map(([category, prog]) => (
                                        <CategoryProgressBar key={category} category={category} progress={prog} isDark={isDark} />
                                      ))
                                    ) : (
                                      <span className="text-[10px]" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>No items</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Footer stats ─── */}
      <div className="mt-4 flex justify-between items-center">
        <p className="text-sm" style={{ color: isDark ? T.dark.textMuted : T.textMuted }}>
          Showing {filteredStudents.length} of {data.students?.length || 0} students
        </p>
        {searchTerm && filteredStudents.length !== data.students?.length && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-sm font-semibold"
            style={{ color: T.orange }}
          >
            Clear search
          </button>
        )}
      </div>
    </div>
  );

  // ─── Layout wrapper ──────────────────────────────────────────────────────────
  if (userRole === 'admin' || userRole === 'ldhead' || userRole === 'subhead' || userRole === 'programcoordinator') {
    return <DashboardLayout>{content}</DashboardLayout>;
  }
  
  if (userRole === 'student') {
    return <StudentLayout>{content}</StudentLayout>;
  }
  
  return <StaffLayout>{content}</StaffLayout>;
}