"use client";

/**
 * Trainer-perspective panels for the trainer dashboard.
 *
 * These are the pieces where the L&D dashboard's perspective does not carry
 * over: an L&D Head compares clients and trainers; a trainer runs their own
 * courses and batches. Everything visual reuses the ld-dashboard atoms
 * (SectionCard / Chip / Meter / …) so the two dashboards read as one system.
 */

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  CalendarCheck,
  ChevronRight,
  FileText,
  GraduationCap,
  Library,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionJSON, SESSION_KEYS } from "@/lib/session";
import type { DashboardModel, Icon, RiskRow, Tone } from "@/features/ld-dashboard/types";
import {
  band,
  count,
  pct,
  plural,
  toneBg,
  toneFill,
  toneHex,
  toneText,
} from "@/features/ld-dashboard/lib/format";
import {
  Chip,
  Meter,
  MetricPair,
  Monogram,
  ScrollArea,
  SectionCard,
} from "@/features/ld-dashboard/components/ui-kit";
import { AllClearState, EmptyState } from "@/features/ld-dashboard/components/states";
import type { BatchToday, CoursePerfRow, TrainerCourseOpt } from "../hooks/use-trainer-dashboard";

/** Renders a Next link for page routes and a plain anchor for #-anchors. */
function SmartLink({
  href,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
}

/* ── Header — scope line + course filter ─────────────────────────────────── */

function useFirstName(): string {
  const [name, setName] = useState("");
  useEffect(() => {
    const u = getSessionJSON<{ firstName?: string }>(SESSION_KEYS.userData);
    setName(u?.firstName?.trim() || "");
  }, []);
  return name;
}

export function TrainerHeader({
  scope,
  subline,
  filtered,
  onReset,
  course,
  courseOptions,
  onCourse,
}: {
  scope: string;
  subline: string;
  filtered: boolean;
  onReset: () => void;
  course: string;
  courseOptions: TrainerCourseOpt[];
  onCourse: (id: string) => void;
}) {
  const first = useFirstName();

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-[-0.02em] text-heading sm:text-3xl">
          {scope}
        </h1>
        <p className="mt-1 text-sm text-subtle">
          {first && (
            <>
              <span className="text-body">Welcome back, {first}</span>
              <span aria-hidden className="mx-1.5 text-faint">
                ·
              </span>
            </>
          )}
          {subline}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-start">
        {courseOptions.length > 0 && (
          <select
            value={course}
            onChange={(e) => onCourse(e.target.value)}
            aria-label="Filter by course"
            className="h-9 max-w-56 rounded-control border border-hairline-strong bg-surface px-2.5 text-sm text-body shadow-xs outline-none transition-colors duration-fast hover:border-line-hover focus:border-brand-500"
          >
            <option value="all">All my courses</option>
            {courseOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {filtered && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-control border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-body shadow-xs outline-none transition-colors duration-fast hover:border-hairline-strong hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-ink-800"
          >
            <RotateCcw size={13} strokeWidth={2.2} aria-hidden />
            Clear filter
          </button>
        )}
      </div>
    </header>
  );
}

/* ── Portfolio strip — the trainer's teaching footprint ──────────────────── */

interface StripItem {
  icon: Icon;
  label: string;
  value: string;
  detail: string;
  href: string;
}

export function TrainerPortfolioStrip({
  model,
  batchesToday,
  attendanceHref,
}: {
  model: DashboardModel;
  batchesToday: BatchToday[];
  attendanceHref: string;
}) {
  const batchTotal = batchesToday.length;
  const batchMarked = batchesToday.filter((b) => b.marked).length;
  const pending = batchTotal - batchMarked;

  const items: StripItem[] = [
    {
      icon: Library,
      label: "Courses",
      value: count(model.courses),
      detail: `${model.activeCourses} with learners`,
      href: "/lms/pages/courses",
    },
    {
      icon: CalendarCheck,
      label: "Batches today",
      value: batchTotal ? `${batchMarked}/${batchTotal}` : "—",
      detail: batchTotal
        ? pending > 0
          ? `${pending} awaiting attendance`
          : "all marked"
        : "none scheduled",
      href: attendanceHref,
    },
    {
      icon: GraduationCap,
      label: "Students",
      value: count(model.students),
      detail: `${count(model.completed)} completed`,
      href: "#at-risk",
    },
    {
      icon: Building2,
      label: "Clients",
      value: count(model.clients),
      detail: "served by your courses",
      href: "#course-performance",
    },
  ];

  return (
    <section
      aria-label="Teaching scope"
      className="grid grid-cols-2 overflow-hidden rounded-tile border border-hairline bg-surface shadow-xs sm:grid-cols-4"
    >
      {items.map((it, i) => (
        <SmartLink
          key={it.label}
          href={it.href}
          className={cn(
            "group flex min-w-0 items-center gap-2.5 px-3 py-2.5 outline-none sm:px-4",
            "transition-colors duration-fast hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset dark:hover:bg-ink-800/60",
            i % 2 === 1 && "border-l border-hairline sm:border-l",
            i >= 2 && "border-t border-hairline sm:border-t-0",
            i !== 0 && "sm:border-l sm:border-hairline",
          )}
        >
          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-chip bg-ink-100 text-subtle transition-colors duration-fast group-hover:bg-brand-100 group-hover:text-brand-700 dark:bg-ink-800 dark:group-hover:bg-brand-500/15 dark:group-hover:text-brand-400">
            <it.icon size={14} strokeWidth={2.2} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="flex items-baseline gap-1.5">
              <span className="text-lg leading-none font-semibold tabular-nums text-heading">
                {it.value}
              </span>
              <span className="truncate text-xs font-medium text-body">{it.label}</span>
            </p>
            <p className="mt-0.5 truncate text-2xs text-subtle">{it.detail}</p>
          </div>
        </SmartLink>
      ))}
    </section>
  );
}

/* ── Quick actions — routed to real trainer pages ────────────────────────── */

interface Action {
  label: string;
  hint: string;
  icon: Icon;
  tone: Tone;
  href: string;
  badge?: number;
  /** Permission key that must be active for the row to show; undefined = always. */
  needs?: string;
}

export function TrainerQuickActions({
  model,
  permissionKeys,
  className,
}: {
  model: DashboardModel;
  permissionKeys: Set<string>;
  className?: string;
}) {
  const reduce = useReducedMotion();

  const allActions: Action[] = [
    {
      label: "Mark attendance",
      hint: "Today's batches and registers",
      icon: CalendarCheck,
      tone: "info",
      href: "/lms/pages/attendancemanagement",
      badge: model.pendingBatches,
      needs: "attendancemanagement",
    },
    {
      label: "At-risk students",
      hint: "Below the 50% line",
      icon: AlertTriangle,
      tone: "danger",
      href: "#at-risk",
      badge: model.atRiskCount,
    },
    {
      label: "My courses",
      hint: "Content, batches and delivery",
      icon: BookOpen,
      tone: "brand",
      href: "/lms/pages/courses",
    },
    {
      label: "Grades",
      hint: "Review and evaluate submissions",
      icon: Trophy,
      tone: "brand",
      href: "/lms/pages/grades",
      needs: "grades",
    },
    {
      label: "Question banks",
      hint: "Author and organise questions",
      icon: FileText,
      tone: "neutral",
      href: "/lms/pages/questionbanks",
      needs: "questionbanks",
    },
    {
      label: "Notifications",
      hint: "Announcements and updates",
      icon: Bell,
      tone: "neutral",
      href: "/lms/pages/notifications",
      needs: "notifications",
    },
  ];
  const actions = allActions.filter(
    (a) => !a.needs || permissionKeys.size === 0 || permissionKeys.has(a.needs),
  );

  return (
    <SectionCard title="Quick actions" className={className} bodyClassName="p-2 sm:p-2">
      <ul className="grid gap-0.5">
        {actions.map((a, i) => (
          <motion.li
            key={a.label}
            initial={reduce ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.03 }}
          >
            <SmartLink
              href={a.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-control px-2.5 py-2 outline-none",
                "transition-colors duration-fast hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-ink-800/60",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-chip",
                  toneBg[a.tone],
                  toneText[a.tone],
                )}
              >
                <a.icon size={14} strokeWidth={2.2} aria-hidden />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-heading">{a.label}</span>
                <span className="block truncate text-2xs text-subtle">{a.hint}</span>
              </span>

              {a.badge !== undefined && a.badge > 0 && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums",
                    toneBg[a.tone],
                    toneText[a.tone],
                  )}
                >
                  {a.badge.toLocaleString()}
                </span>
              )}

              <ChevronRight
                size={14}
                aria-hidden
                className="shrink-0 text-faint transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-subtle"
              />
            </SmartLink>
          </motion.li>
        ))}
      </ul>
    </SectionCard>
  );
}

/* ── At-risk students (no L&D drill-view link) ───────────────────────────── */

const MAX_RISK_ROWS = 6;

export function TrainerAtRiskPanel({ rows, className }: { rows: RiskRow[]; className?: string }) {
  const reduce = useReducedMotion();
  const shown = rows.slice(0, MAX_RISK_ROWS);

  return (
    <SectionCard
      title="At-risk students"
      badge={rows.length}
      className={className}
      bodyClassName={rows.length ? "p-2 sm:p-2" : undefined}
    >
      {rows.length === 0 ? (
        <AllClearState
          title="Everyone on track"
          hint="No active learner is below the 50% line in this view."
        />
      ) : (
        <>
          <ScrollArea>
            <ul className="grid gap-0.5">
              {shown.map((r, i) => (
                <motion.li
                  key={`${r.name}-${r.course}-${i}`}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.03 }}
                  className="rounded-control px-2.5 py-2 transition-colors duration-fast hover:bg-row-hover dark:hover:bg-ink-800/60"
                >
                  <div className="flex items-center gap-2.5">
                    <Monogram name={r.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-heading">{r.name}</p>
                      <p className="truncate text-2xs text-subtle">{r.course}</p>
                    </div>
                    <Chip tone={r.tone}>{r.level}</Chip>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 pl-[38px]">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <span
                        className={cn("block h-full rounded-full", toneFill[r.tone])}
                        style={{ width: `${Math.max(3, r.overall)}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-2xs font-semibold tabular-nums text-body">
                      {pct(r.overall)}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </ScrollArea>

          {rows.length > MAX_RISK_ROWS && (
            <p className="border-t border-hairline px-2.5 pt-2.5 text-2xs text-subtle">
              Showing {MAX_RISK_ROWS} of {rows.length.toLocaleString()}, worst first.
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}

/* ── My courses — per-course rollup (replaces the L&D client panel) ──────── */

function CourseBlock({ c, index }: { c: CoursePerfRow; index: number }) {
  const reduce = useReducedMotion();
  const health = band(c.avg);
  const spark = c.sparks.length > 1 ? c.sparks.map((v, i) => ({ i, v })) : null;
  const gid = `crs-${index}`;

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : index * 0.04 }}
      className="rounded-control border border-hairline bg-surface-sunken p-3 transition-colors duration-fast hover:border-hairline-strong dark:bg-ink-800/40"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-chip bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
          <BookOpen size={13} strokeWidth={2.2} aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-heading" title={c.name}>
          {c.name}
        </p>
        {spark && (
          <span className="h-6 w-14 shrink-0" aria-hidden title="Per-student completion, low → high">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={toneHex.brand} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={toneHex.brand} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={[0, 100]} />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={toneHex.brand}
                  strokeWidth={1.5}
                  fill={`url(#${gid})`}
                  dot={false}
                  isAnimationActive={!reduce}
                />
              </AreaChart>
            </ResponsiveContainer>
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <Meter value={c.avg} tone={health.tone} className="flex-1" label={`${c.name} completion`} />
        <span
          className={cn(
            "shrink-0 text-xs font-semibold tabular-nums",
            c.avg === null ? "text-faint" : "text-heading",
          )}
        >
          {pct(c.avg)}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-hairline pt-2.5">
        <MetricPair label="Students" value={count(c.students)} />
        <MetricPair label="Avg score" value={pct(c.score)} />
        <MetricPair
          label="Att. today"
          value={c.attendance && c.attendance.total ? `${c.attendance.marked}/${c.attendance.total}` : "—"}
          title="In-delivery batches with attendance marked today"
        />
        <MetricPair label="At risk" value={count(c.risk)} tone={c.risk ? "danger" : undefined} />
      </dl>
    </motion.li>
  );
}

export function CoursePerformancePanel({
  rows,
  className,
}: {
  rows: CoursePerfRow[];
  className?: string;
}) {
  return (
    <SectionCard
      title="My courses"
      meta={rows.length ? plural(rows.length, "course") : undefined}
      className={className}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses in this view"
          hint="Courses appear once you are on a batch roster."
        />
      ) : (
        <ScrollArea>
          <ul className="grid gap-2.5">
            {rows.map((c, i) => (
              <CourseBlock key={c.id} c={c} index={i} />
            ))}
          </ul>
        </ScrollArea>
      )}
    </SectionCard>
  );
}

/* ── Today's batches — attendance marking status ─────────────────────────── */

export function TodaysBatchesPanel({
  batches,
  loading,
  attendanceHref,
  className,
}: {
  batches: BatchToday[];
  loading?: boolean;
  attendanceHref: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const pending = batches.filter((b) => !b.marked).length;

  return (
    <SectionCard
      title="Today's batches"
      badge={pending}
      action={
        batches.length && attendanceHref.startsWith("/")
          ? { label: "Open register", href: attendanceHref }
          : undefined
      }
      className={className}
      bodyClassName={batches.length ? "p-2 sm:p-2" : undefined}
    >
      {loading ? (
        <div className="grid gap-2 p-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-control bg-ink-100 dark:bg-ink-800" />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No batches scheduled today"
          hint="Batches appear here on days their course calendar is running."
        />
      ) : (
        <ScrollArea>
          <ul className="grid gap-0.5">
            {batches.map((b, i) => (
              <motion.li
                key={b.key}
                initial={reduce ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.03 }}
                className="flex items-center gap-2.5 rounded-control px-2.5 py-2 transition-colors duration-fast hover:bg-row-hover dark:hover:bg-ink-800/60"
              >
                <span
                  className={cn(
                    "inline-flex size-7 shrink-0 items-center justify-center rounded-chip",
                    b.marked ? toneBg.success : toneBg.warning,
                    b.marked ? toneText.success : toneText.warning,
                  )}
                >
                  <CalendarCheck size={14} strokeWidth={2.2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-heading">{b.batchName}</p>
                  <p className="truncate text-2xs text-subtle">
                    {b.courseName}
                    {b.students ? ` · ${plural(b.students, "student")}` : ""}
                  </p>
                </div>
                <Chip tone={b.marked ? "success" : "warning"}>
                  {b.marked ? "Marked" : "Pending"}
                </Chip>
              </motion.li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </SectionCard>
  );
}
