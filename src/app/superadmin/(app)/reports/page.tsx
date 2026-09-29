'use client';
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Landmark, Users, BookOpen, LogIn, ListTree, Boxes, Sparkles,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  getOverview, getLoginReport, getInstitutionAnalytics, InstitutionAnalyticsRow,
} from '@/apiServices/superadmin/reportService';
import {
  PageHeader, Panel, MetricCard, Toolbar, SearchInput, RefreshButton,
  useSort, SortLabel, tableHeadClass, tableCellClass, tableRowClass, RowIdentity,
  usePagination, PaginationBar,
} from '../../_components/ui';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import InstitutionDetailsModal from './InstitutionDetailsModal';

const shortName = (n: string) => (n.length > 12 ? n.slice(0, 11) + '…' : n);

export default function ReportsPage() {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: analyticsData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['superadmin', 'reports', 'analytics'],
    queryFn: getInstitutionAnalytics,
  });
  const { data: ov } = useQuery({ queryKey: ['superadmin', 'reports', 'overview'], queryFn: getOverview });
  const { data: loginData } = useQuery({ queryKey: ['superadmin', 'reports', 'logins'], queryFn: () => getLoginReport(25) });

  const totals = analyticsData?.totals;
  const rows = analyticsData?.rows || [];
  const logins = loginData?.logins || [];

  const filtered = rows.filter((r) =>
    r.inst_name.toLowerCase().includes(search.toLowerCase()) ||
    r.inst_id.toLowerCase().includes(search.toLowerCase())
  );
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, {
    name: (r) => r.inst_name,
    users: (r) => r.users,
    courses: (r) => r.courses,
    modules: (r) => r.modules,
    topics: (r) => r.topics,
    resources: (r) => r.iDo + r.weDo + r.youDo,
  });
  const { pageItems, page, setPage, totalPages, rangeStart, rangeEnd, total } = usePagination(sorted, pageSize);

  // Charts
  const barData = [...rows].sort((a, b) => b.users - a.users).slice(0, 8).map((r) => ({
    name: shortName(r.inst_name), Users: r.users, Courses: r.courses,
  }));
  const pieData = totals
    ? [
        { name: 'I Do', value: totals.iDo, color: 'var(--chart-1)' },
        { name: 'We Do', value: totals.weDo, color: 'var(--chart-2)' },
        { name: 'You Do', value: totals.youDo, color: 'var(--chart-4)' },
      ]
    : [];
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Analytics" description="Institution-wise usage, course content and pedagogy resource insights." />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {isLoading || !totals ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)
        ) : (
          <>
            <MetricCard compact icon={Landmark} label="Institutions" value={totals.institutions} caption="Active clients" iconClass="bg-primary/10 text-primary" />
            <MetricCard compact icon={Users} label="Total Users" value={totals.users} caption="Across all clients" iconClass="bg-chart-2/10 text-chart-2" />
            <MetricCard compact icon={BookOpen} label="Courses" value={totals.courses} caption="All institutions" iconClass="bg-[var(--success-bg)] text-[var(--success-fg)]" captionClass="text-[var(--success-fg)]" />
            <MetricCard compact icon={Boxes} label="Modules" value={totals.modules} caption={`${totals.subModules} sub-modules`} iconClass="bg-chart-4/15 text-chart-4" />
            <MetricCard compact icon={ListTree} label="Topics" value={totals.topics} caption={`${totals.subTopics} sub-topics`} iconClass="bg-violet-500/10 text-violet-500" />
            <MetricCard compact icon={Sparkles} label="Resources" value={totals.iDo + totals.weDo + totals.youDo} caption="I/We/You Do items" iconClass="bg-orange-500/10 text-orange-500" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel title="Users & Courses by Institution" className="lg:col-span-2">
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-[260px] rounded-lg" />
            ) : barData.length === 0 ? (
              <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={barData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--foreground)' }} cursor={{ fill: 'var(--accent)', opacity: 0.4 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Users" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Courses" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel title="Pedagogy Resources">
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-[240px] rounded-lg" />
            ) : pieTotal === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">No resource data.</div>
            ) : (
              <div className="flex flex-col items-center gap-5 sm:flex-row">
                <div className="relative h-[190px] w-[190px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} stroke="none">
                        {pieData.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--foreground)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-2xl font-bold text-foreground">{pieTotal.toLocaleString()}</div>
                    <div className="text-[11px] text-muted-foreground">Total Resources</div>
                  </div>
                </div>
                <div className="w-full flex-1 space-y-2.5">
                  {pieData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                        {d.name}
                      </span>
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">{d.value}</span>{' '}
                        ({pieTotal ? Math.round((d.value / pieTotal) * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Per-institution analytics table */}
      <Panel>
        <Toolbar>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search institutions..." className="w-full sm:max-w-xs" />
          <RefreshButton onClick={() => refetch()} spinning={isFetching} />
        </Toolbar>

        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)}</div>
        ) : total === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">No institutions match.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={tableHeadClass}><SortLabel label="Institution" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={toggleSort} /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}><SortLabel label="Users" sortKey="users" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}><SortLabel label="Courses" sortKey="courses" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}><SortLabel label="Modules" sortKey="modules" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}>Sub-mod</TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}><SortLabel label="Topics" sortKey="topics" activeKey={sortKey} dir={sortDir} onSort={toggleSort} align="right" /></TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}>Sub-top</TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}>I Do</TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}>We Do</TableHead>
                  <TableHead className={cn(tableHeadClass, 'text-right')}>You Do</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((r: InstitutionAnalyticsRow) => (
                  <TableRow key={r._id} className={tableRowClass}>
                    <TableCell className={cn(tableCellClass, 'min-w-[180px]')}>
                      <button type="button" onClick={() => setDetailId(r._id)} className="text-left transition-colors hover:text-primary" title="View full details">
                        <RowIdentity initial={r.inst_name.charAt(0)} primary={r.inst_name} secondary={r.inst_id} />
                      </button>
                    </TableCell>
                    <NumCell v={r.users} strong />
                    <NumCell v={r.courses} />
                    <NumCell v={r.modules} />
                    <NumCell v={r.subModules} />
                    <NumCell v={r.topics} />
                    <NumCell v={r.subTopics} />
                    <NumCell v={r.iDo} />
                    <NumCell v={r.weDo} />
                    <NumCell v={r.youDo} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <PaginationBar
              rangeStart={rangeStart} rangeEnd={rangeEnd} total={total}
              page={page} totalPages={totalPages} onPageChange={setPage}
              pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
            />
          </div>
        )}
      </Panel>

      {/* Recent logins */}
      <Panel>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5 text-sm font-semibold text-foreground">
          <LogIn className="h-4 w-4 text-primary" /> Recent Logins
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={tableHeadClass}>User</TableHead>
                <TableHead className={tableHeadClass}>Role</TableHead>
                <TableHead className={tableHeadClass}>IP</TableHead>
                <TableHead className={tableHeadClass}>Device</TableHead>
                <TableHead className={tableHeadClass}>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logins.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-muted-foreground">No login records yet.</TableCell></TableRow>
              ) : logins.map((l) => (
                <TableRow key={l._id} className={tableRowClass}>
                  <TableCell className={tableCellClass}>
                    <div className="font-medium text-foreground">{l.userName || '—'}</div>
                    <div className="text-xs text-muted-foreground">{l.userEmail}</div>
                  </TableCell>
                  <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{l.userRole || '—'}</TableCell>
                  <TableCell className={cn(tableCellClass, 'font-mono text-[12px] text-muted-foreground')}>{l.details?.ipAddress || '—'}</TableCell>
                  <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{l.details?.device || '—'}</TableCell>
                  <TableCell className={cn(tableCellClass, 'whitespace-nowrap text-muted-foreground')}>{new Date(l.createdAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <InstitutionDetailsModal institutionId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function NumCell({ v, strong }: { v: number; strong?: boolean }) {
  return (
    <TableCell className={cn(tableCellClass, 'text-right tabular-nums', strong ? 'font-medium text-foreground' : 'text-muted-foreground')}>
      {v.toLocaleString()}
    </TableCell>
  );
}
