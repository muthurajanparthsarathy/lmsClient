'use client';
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Download, RefreshCw, Filter } from 'lucide-react';
import { getLoginLogs, LoginLogEntry } from '@/apiServices/superadmin/auditLogService';
import { cn } from '@/lib/utils';
import {
  PageHeader, Panel, EmptyState, SearchInput, StatusBadge, RowIdentity,
  tableHeadClass, tableCellClass, tableRowClass, usePagination, PaginationBar,
} from '../../_components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// ── Date / duration helpers ────────────────────────────────────────────────
const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
};

const pad = (n: number) => String(n).padStart(2, '0');
const fmtDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${pad(m)}m ${pad(s)}s`;
  return `${s}s`;
};

// Resolve a logout time: explicit backend field, else login + sessionDuration.
const logoutOf = (log: LoginLogEntry): string => {
  const explicit = log.logoutTime || log.logoutAt || log.sessionEnd;
  if (explicit) return explicit;
  if (log.sessionDuration != null && log.createdAt) {
    return new Date(new Date(log.createdAt).getTime() + log.sessionDuration * 1000).toISOString();
  }
  return '';
};

// Session duration in seconds: explicit field, else logout − login.
const durationOf = (log: LoginLogEntry): number | null => {
  if (log.sessionDuration != null) return log.sessionDuration;
  const lo = logoutOf(log);
  if (lo && log.createdAt) {
    const d = Math.round((new Date(lo).getTime() - new Date(log.createdAt).getTime()) / 1000);
    return d >= 0 ? d : null;
  }
  return null;
};

const isOk = (status?: string) => {
  const s = (status || 'success').toLowerCase();
  return s === 'success' || s === '' || s === 'active';
};

export default function AuditLogsPage() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['superadmin', 'login-logs'],
    queryFn: () => getLoginLogs(500),
  });
  const logs = data?.data || [];

  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<'today' | 'week' | 'all'>('all');
  // date range — draft (bound to inputs) + applied (read by the filter)
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    let list = logs;
    if (quick === 'today') {
      const s = new Date(); s.setHours(0, 0, 0, 0);
      list = list.filter((l) => new Date(l.createdAt) >= s);
    } else if (quick === 'week') {
      list = list.filter((l) => new Date(l.createdAt) >= new Date(Date.now() - 7 * 86400000));
    }
    if (from) {
      const f = new Date(from).setHours(0, 0, 0, 0);
      list = list.filter((l) => new Date(l.createdAt).getTime() >= f);
    }
    if (to) {
      const t = new Date(to).setHours(23, 59, 59, 999);
      list = list.filter((l) => new Date(l.createdAt).getTime() <= t);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        (l.userName || '').toLowerCase().includes(q) ||
        (l.userEmail || '').toLowerCase().includes(q) ||
        (l.details?.ipAddress || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, quick, search, from, to]);

  const [pageSize, setPageSize] = useState(10);
  const { pageItems, page, setPage, totalPages, rangeStart, rangeEnd, total } = usePagination(filtered, pageSize);

  const applyRange = () => { setFrom(fromDraft); setTo(toDraft); setPage(1); };
  const clearRange = () => { setFromDraft(''); setToDraft(''); setFrom(''); setTo(''); setPage(1); };

  const exportToExcel = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const { saveAs } = await import('file-saver');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Login Logs');
    ws.columns = [
      { header: '#', key: 'num', width: 5 },
      { header: 'Name', key: 'name', width: 26 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'Role', key: 'role', width: 16 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Login Time', key: 'time', width: 26 },
      { header: 'Logout Time', key: 'logout', width: 26 },
      { header: 'IP Address', key: 'ip', width: 16 },
      { header: 'Location', key: 'location', width: 22 },
      { header: 'Device', key: 'device', width: 14 },
      { header: 'Browser', key: 'browser', width: 14 },
      { header: 'OS', key: 'os', width: 16 },
      { header: 'Session Duration', key: 'session', width: 18 },
    ];
    const hdr = ws.getRow(1);
    hdr.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    hdr.height = 22;
    filtered.forEach((log, i) => {
      const lo = logoutOf(log);
      const dur = durationOf(log);
      const row = ws.addRow({
        num: i + 1, name: log.userName || '—', email: log.userEmail || '—',
        role: log.userRole || 'user', status: isOk(log.status) ? 'Success' : 'Failed',
        time: fmtDate(log.createdAt), logout: lo ? fmtDate(lo) : 'Active',
        ip: log.details?.ipAddress || '—', location: log.details?.location || '—',
        device: log.details?.device || '—', browser: log.details?.browser || '—',
        os: log.details?.os || '—', session: dur != null ? fmtDuration(dur) : '—',
      });
      row.height = 18;
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle' };
        if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F7' } };
      });
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `login-logs-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Every user sign-in session — search, filter and export login activity."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} /> Refresh
            </Button>
            {filtered.length > 0 && (
              <Button size="sm" onClick={exportToExcel}>
                <Download className="h-4 w-4" /> Export
              </Button>
            )}
          </>
        }
      />

      {/* Toolbar — search + quick filters + date range */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search by name, email or IP..."
          className="w-full sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          {(['today', 'week', 'all'] as const).map((f) => (
            <Button
              key={f}
              variant={quick === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setQuick(f); setPage(1); }}
            >
              {f === 'week' ? 'This Week' : f === 'today' ? 'Today' : 'All Time'}
            </Button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <Input
            type="date" value={fromDraft} onChange={(e) => setFromDraft(e.target.value)}
            aria-label="From date" className="h-9 w-[9.5rem]"
          />
          <span className="text-sm text-muted-foreground">–</span>
          <Input
            type="date" value={toDraft} onChange={(e) => setToDraft(e.target.value)}
            aria-label="To date" className="h-9 w-[9.5rem]"
          />
          <Button variant="outline" size="sm" onClick={applyRange}>
            <Filter className="h-4 w-4" /> Apply
          </Button>
          {(from || to) && (
            <Button variant="ghost" size="sm" onClick={clearRange}>Clear</Button>
          )}
        </div>
      </div>

      <div>
        <Panel>
          {isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-md" />)}</div>
          ) : logs.length === 0 ? (
            <EmptyState icon={ScrollText} title="No login activity yet" description="User sign-in sessions will appear here as they happen." />
          ) : filtered.length === 0 ? (
            <EmptyState icon={ScrollText} title="No matches" description="No login sessions match the current filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className={tableHeadClass}>User</TableHead>
                      <TableHead className={tableHeadClass}>Status</TableHead>
                      <TableHead className={tableHeadClass}>Login Time</TableHead>
                      <TableHead className={tableHeadClass}>Logout Time</TableHead>
                      <TableHead className={tableHeadClass}>IP</TableHead>
                      <TableHead className={tableHeadClass}>Location</TableHead>
                      <TableHead className={tableHeadClass}>Device</TableHead>
                      <TableHead className={tableHeadClass}>Browser</TableHead>
                      <TableHead className={tableHeadClass}>OS</TableHead>
                      <TableHead className={cn(tableHeadClass, 'text-right')}>Session</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((log) => {
                      const lo = logoutOf(log);
                      const dur = durationOf(log);
                      return (
                        <TableRow key={log._id} className={tableRowClass}>
                          <TableCell className={tableCellClass}>
                            <RowIdentity
                              initial={(log.userName || log.userEmail || '?').charAt(0)}
                              primary={log.userName || '—'}
                              secondary={log.userRole || log.userEmail || 'user'}
                            />
                          </TableCell>
                          <TableCell className={tableCellClass}>
                            <StatusBadge status={isOk(log.status) ? 'success' : 'danger'}>
                              {isOk(log.status) ? 'Success' : 'Failed'}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className={cn(tableCellClass, 'whitespace-nowrap text-muted-foreground')}>{fmtDate(log.createdAt)}</TableCell>
                          <TableCell className={cn(tableCellClass, 'whitespace-nowrap')}>
                            {lo ? (
                              <span className="text-muted-foreground">{fmtDate(lo)}</span>
                            ) : (
                              <StatusBadge status="success">Active</StatusBadge>
                            )}
                          </TableCell>
                          <TableCell className={cn(tableCellClass, 'font-mono text-[12px] text-muted-foreground')}>{log.details?.ipAddress || '—'}</TableCell>
                          <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{log.details?.location || '—'}</TableCell>
                          <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{log.details?.device || '—'}</TableCell>
                          <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{log.details?.browser || '—'}</TableCell>
                          <TableCell className={cn(tableCellClass, 'text-muted-foreground')}>{log.details?.os || '—'}</TableCell>
                          <TableCell className={cn(tableCellClass, 'text-right text-muted-foreground')}>{dur != null ? fmtDuration(dur) : '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <PaginationBar
                rangeStart={rangeStart} rangeEnd={rangeEnd} total={total}
                page={page} totalPages={totalPages} onPageChange={setPage}
                pageSize={pageSize} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              />
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
