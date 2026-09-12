'use client';
import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Landmark, Users, BookOpen, ShieldCheck, ArrowRight, HardDrive, CreditCard,
  Ban, Activity, UserPlus, Building2, ScrollText, Bell,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { getAllInstitutions } from '@/apiServices/superadmin/institutionService';
import { getSubscriptions } from '@/apiServices/superadmin/subscriptionService';
import { getAuditLogs } from '@/apiServices/superadmin/auditLogService';
import { PageHeader, StatCard, Panel, StatusBadge } from '../../_components/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// X-axis label for the Platform Overview chart. The chart is full-width with
// angled ticks, so labels can be much longer than the old 1/3-width version;
// the untruncated name is still shown in the tooltip.
const chartLabel = (name: string) => (name.length > 18 ? name.slice(0, 17) + '…' : name);

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

// Pick an icon for an audit-log line from its HTTP method / path.
function activityIcon(path: string) {
  if (path.includes('institution')) return Building2;
  if (path.includes('user')) return UserPlus;
  if (path.includes('subscription')) return CreditCard;
  if (path.includes('notification')) return Bell;
  return ScrollText;
}

export default function SuperAdminDashboardPage() {
  const { data: instData, isLoading } = useQuery({
    queryKey: ['superadmin', 'institutions'],
    queryFn: getAllInstitutions,
  });
  const { data: subData } = useQuery({ queryKey: ['superadmin', 'subscriptions'], queryFn: getSubscriptions });
  const { data: logData } = useQuery({ queryKey: ['superadmin', 'audit-logs', 'recent'], queryFn: () => getAuditLogs(6) });

  const institutions = instData?.institutions || [];
  const subs = subData?.rows || [];
  const logs = logData?.logs || [];

  const totalUsers = institutions.reduce((s, i) => s + (i.userCount || 0), 0);
  const totalCourses = institutions.reduce((s, i) => s + (i.courseCount || 0), 0);
  const activeCount = institutions.filter((i) => i.status === 'active').length;
  const suspendedCount = institutions.length - activeCount;
  const activeSubs = subs.filter((r) => r.subscription?.status === 'active').length;
  const storageQuotaGB = subs.reduce((s, r) => s + (r.subscription?.storageQuotaMB || 0), 0) / 1024;
  const avgUsers = institutions.length ? Math.round(totalUsers / institutions.length) : 0;

  // Every institution in the database, largest tenants first so the busiest
  // clients read left-to-right instead of being buried in the tail.
  const chartData = institutions
    .map((i) => ({
      name: chartLabel(i.inst_name),
      fullName: i.inst_name,
      instId: i.inst_id,
      Users: i.userCount || 0,
      Courses: i.courseCount || 0,
    }))
    .sort((a, b) => b.Users - a.Users || b.Courses - a.Courses);

  // Full-width chart: give every client ~110px of horizontal room and let the
  // row scroll sideways once there are more tenants than the panel can fit.
  const chartMinWidth = Math.max(chartData.length * 110, 720);

  return (
    <div className="space-y-6">
      {/* One heading, no sub-text — the numbers below are the greeting. */}
      <PageHeader title="Dashboard" />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[116px] rounded-xl" />)
        ) : (
          <>
            <StatCard label="Total Institutions" value={institutions.length} icon={Landmark} hint={`${activeCount} active`} accent="bg-primary/10 text-primary" />
            <StatCard label="Total Users" value={totalUsers} icon={Users} hint="across all clients" accent="bg-chart-2/10 text-chart-2" />
            <StatCard label="Total Courses" value={totalCourses} icon={BookOpen} hint="across all clients" accent="bg-chart-4/15 text-chart-4" />
            <StatCard label="Active Tenants" value={activeCount} icon={ShieldCheck} hint={institutions.length ? `${Math.round((activeCount / institutions.length) * 100)}% active` : '—'} accent="bg-chart-3/15 text-chart-3" />
          </>
        )}
      </div>

      {/* Middle row: institutions table · recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Institutions at a glance */}
        <Panel
          title="Institutions at a glance"
          actions={<Link href="/superadmin/clients" className="text-xs font-medium text-primary hover:underline">View all</Link>}
        >
          <div className="p-2">
            {isLoading ? (
              <div className="space-y-2 p-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-md" />)}</div>
            ) : institutions.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No institutions yet.</div>
            ) : (
              <div className="divide-y divide-border">
                {institutions.slice(0, 6).map((inst) => (
                  <div key={inst._id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{inst.inst_name}</div>
                      <div className="text-[11px] text-muted-foreground">{inst.inst_id}</div>
                    </div>
                    <div className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                      <span className="font-medium text-foreground">{inst.userCount}</span> users
                    </div>
                    <StatusBadge status={inst.status === 'active' ? 'success' : 'danger'}>{inst.status}</StatusBadge>
                  </div>
                ))}
              </div>
            )}
            <Link href="/superadmin/clients" className="mt-1 flex items-center justify-center gap-1.5 border-t border-border py-2.5 text-xs font-medium text-primary hover:underline">
              View all institutions <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Panel>

        {/* Recent activity — real audit log */}
        <Panel
          title="Recent Activity"
          actions={<Link href="/superadmin/audit-logs" className="text-xs font-medium text-primary hover:underline">View all</Link>}
        >
          <div className="p-3">
            {logs.length === 0 ? (
              <div className="px-2 py-10 text-center text-sm text-muted-foreground">No recent activity.</div>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => {
                  const Icon = activityIcon(log.path || '');
                  return (
                    <div key={log._id} className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">{log.summary || log.action}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{log.actorEmail}</div>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(log.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Platform overview — full row, real users & courses for every client */}
      <Panel
        title="Platform Overview"
        actions={
          <span className="text-xs text-muted-foreground">
            All {institutions.length} client{institutions.length === 1 ? '' : 's'} · by users &amp; courses
          </span>
        }
      >
        <div className="px-4 pb-4 pt-4">
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--chart-1)' }} /> Users <span className="font-semibold text-foreground">{totalUsers}</span></span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--chart-2)' }} /> Courses <span className="font-semibold text-foreground">{totalCourses}</span></span>
            <span className="text-muted-foreground">Avg <span className="font-semibold text-foreground">{avgUsers}</span> users / client</span>
          </div>
          {isLoading ? (
            <Skeleton className="h-[340px] rounded-lg" />
          ) : chartData.length === 0 ? (
            <div className="flex h-[340px] items-center justify-center text-sm text-muted-foreground">No data yet.</div>
          ) : (
            <div className="overflow-x-auto pb-1">
              <div style={{ minWidth: chartMinWidth }}>
                <ResponsiveContainer width="100%" height={340}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gCourses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="name"
                      interval={0}
                      angle={-35}
                      textAnchor="end"
                      height={80}
                      tickMargin={8}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="Users" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gUsers)" dot={{ r: 2.5, strokeWidth: 0, fill: 'var(--chart-1)' }} activeDot={{ r: 4 }} />
                    <Area type="monotone" dataKey="Courses" stroke="var(--chart-2)" strokeWidth={2} fill="url(#gCourses)" dot={{ r: 2.5, strokeWidth: 0, fill: 'var(--chart-2)' }} activeDot={{ r: 4 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {/* Bottom stat strip — platform-wide roll-ups (all real data) */}
      <Panel>
        <div className="grid grid-cols-2 divide-border sm:grid-cols-4 sm:divide-x">
          <BottomStat icon={CreditCard} accent="bg-primary/10 text-primary" label="Active Subscriptions" value={activeSubs} sub={`of ${subs.length || institutions.length} clients`} />
          <BottomStat icon={HardDrive} accent="bg-chart-4/15 text-chart-4" label="Total Storage Quota" value={`${storageQuotaGB.toFixed(1)} GB`} sub="across all plans" />
          <BottomStat icon={Ban} accent="bg-[var(--danger-bg)] text-destructive" label="Suspended Tenants" value={suspendedCount} sub={suspendedCount === 0 ? 'all healthy' : 'need attention'} />
          <BottomStat icon={Users} accent="bg-chart-3/15 text-chart-3" label="Avg Users / Client" value={avgUsers} sub="platform average" />
        </div>
      </Panel>
    </div>
  );
}

// Tooltip for the Platform Overview chart — shows the untruncated institution
// name plus its code, so long tenant names stay readable even though the axis
// tick is clipped.
type ChartPointRow = { fullName: string; instId: string; Users: number; Courses: number };

function ChartTooltip({
  active, payload,
}: { active?: boolean; payload?: Array<{ payload: ChartPointRow }> }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-foreground">{row.fullName}</div>
      <div className="mb-1.5 text-[11px] text-muted-foreground">{row.instId}</div>
      <div className="flex items-center gap-1.5" style={{ color: 'var(--chart-1)' }}>
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--chart-1)' }} /> Users
        <span className="ml-auto font-semibold">{row.Users}</span>
      </div>
      <div className="flex items-center gap-1.5" style={{ color: 'var(--chart-2)' }}>
        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--chart-2)' }} /> Courses
        <span className="ml-auto font-semibold">{row.Courses}</span>
      </div>
    </div>
  );
}

function BottomStat({
  icon: Icon, label, value, sub, accent,
}: { icon: React.ElementType; label: string; value: React.ReactNode; sub?: string; accent: string }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-semibold leading-tight text-foreground">{value}</div>
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        {sub && <div className="truncate text-[11px] text-muted-foreground/70">{sub}</div>}
      </div>
    </div>
  );
}
