'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2, RefreshCw, FileText, Download, Clock, CalendarDays,
  BookOpen, PenLine, GraduationCap, Printer, X,
} from 'lucide-react';
import { AdminOrStaffLayout } from '@/app/lms/component/AdminOrStaffLayout';
import {
  ReportSession, CourseOption, ReportFilters, fetchCourseReportAll,
} from '@/apiServices/activityLog';
import { courseStructureApi } from '@/apiServices/createCourseStucture';
import {
  useCourseReportPageQuery, useCourseReportFacetsQuery,
  useCourseReportStatsQuery, useCourseReportAllQuery, COURSE_PAGE_SIZE,
} from '@/queries/activityLogs';
import { userPermission } from '@/apiServices/tokenVerify';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/components/permissions';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  orange: '#F27757', orangeDark: '#E0623F', orangeLight: 'rgba(242,119,87,0.08)',
  textMain: '#1f2937', textSub: '#374151', textMuted: '#6b7280', textHint: '#9ca3af',
  border: '#e5e7eb', borderLight: '#f3f4f6', bg: '#ffffff',
  iDo: '#6366f1', weDo: '#10b981', youDo: '#f59e0b',
};
const FONT = "'Poppins',-apple-system,BlinkMacSystemFont,sans-serif";
const PAGE_SIZE = COURSE_PAGE_SIZE;

const PEDAGOGY_LABEL: Record<string, string> = { I_Do: 'I Do', We_Do: 'We Do', You_Do: 'You Do' };
const PEDAGOGY_COLOR: Record<string, string> = { I_Do: T.iDo, We_Do: T.weDo, You_Do: T.youDo };
const NODE_TYPE_LABEL: Record<string, string> = { module: 'Module', submodule: 'Sub Module', topic: 'Topic', subtopic: 'Sub Topic' };

const pad = (n: number) => String(n).padStart(2, '0');

const fmtDateTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(h)}:${pad(d.getMinutes())} ${ap}`;
};

const fmtDayShort = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
};

const fmtHM = (seconds: number) => {
  if (!seconds || seconds < 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

const initials = (name: string) =>
  name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '??';

const typeBadge = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('pdf'))        return { bg: 'rgba(225,29,72,0.10)',  col: '#e11d48' };
  if (t.includes('video'))      return { bg: 'rgba(147,51,234,0.10)', col: '#9333ea' };
  if (t.includes('ppt'))        return { bg: 'rgba(217,119,6,0.12)',  col: '#d97706' };
  if (t.includes('link'))       return { bg: 'rgba(79,70,229,0.08)',  col: '#4f46e5' };
  if (t.includes('image'))      return { bg: 'rgba(8,145,178,0.10)',  col: '#0891b2' };
  if (t.includes('word'))       return { bg: 'rgba(37,99,235,0.10)',  col: '#2563eb' };
  if (t.includes('assignment')) return { bg: 'rgba(16,185,129,0.10)', col: '#059669' };
  if (t.includes('assessment')) return { bg: 'rgba(245,158,11,0.12)', col: '#d97706' };
  return { bg: 'rgba(100,116,139,0.10)', col: '#475569' };
};

const nodeLabel = (s: ReportSession) => {
  if (!s.nodeName && !s.nodeType) return '—';
  const t = NODE_TYPE_LABEL[String(s.nodeType || '').toLowerCase()] || (s.nodeType ? String(s.nodeType) : '');
  return t ? `${t} - ${s.nodeName || '—'}` : (s.nodeName || '—');
};

// ── Field label + select ────────────────────────────────────────────────────────
const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label style={{ fontSize: 10.5, fontWeight: 600, color: T.textMuted, letterSpacing: '0.02em', marginBottom: 4, display: 'block' }}>{children}</label>
);

const FilterSelect = ({ label, value, onChange, options, placeholder, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; disabled?: boolean;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
    <FieldLabel>{label}</FieldLabel>
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className="rpt-select"
      style={{
        height: 34, width: '100%', padding: '0 26px 0 10px', fontSize: 12, fontWeight: 500,
        borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg,
        color: disabled ? T.textHint : T.textSub, fontFamily: FONT,
        cursor: disabled ? 'not-allowed' : 'pointer', appearance: 'none', minWidth: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center', opacity: disabled ? 0.6 : 1,
      } as React.CSSProperties}>
      {placeholder && <option value="all">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  let start = Math.max(2, current - 1), end = Math.min(total - 1, current + 1);
  if (current <= 3) { start = 2; end = 4; }
  if (current >= total - 2) { start = total - 3; end = total - 1; }
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('…');
  pages.push(total);
  return pages;
}

// ── Stat card ────────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, iconBg, iconCol, label, value, sub }: {
  icon: React.ElementType; iconBg: string; iconCol: string; label: string; value: string; sub?: string;
}) => (
  <div style={{ flex: 1, minWidth: 0, background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={17} style={{ color: iconCol }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 500, marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.textMain, lineHeight: 1 }}>{value}</div>
        {sub && <div style={{ fontSize: 10.5, color: T.textMuted, marginTop: 4, fontWeight: 500 }}>{sub}</div>}
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════════════════
export default function CourseLogReportPage() {
  const sp = useSearchParams();
  const router = useRouter();

  // Full-id permission checks — mirrors PermissionModal.PERMISSION_DATA
  // entries for admin-auditlogs so a button appears only when the signed-in
  // user was actually granted that functionality.
  const { can } = usePermissions();
  // 'Export' functionality was never registered on the Audit Logs node in
  // permissions.tree.ts, so this check always returned false — the Print
  // Report button (line 515) and the Export button (line 637) stayed hidden
  // for every user, matching the same bug already fixed on LogsPage. Reduced
  // to a page-level check: whoever holds Audit Logs or Staff Log Activity
  // gets both buttons.
  const canExport = can(PERMISSION_IDS.ADMIN_AUDIT_LOGS) || can(PERMISSION_IDS.STAFF_LOG_ACTIVITY);

  // Same shared cache/key as LogsPage — clicking "Generate Report" there
  // navigates here with the course id already loaded, so this paints from
  // cache instead of re-fetching the whole session list a second time.
  const { data: allCourses = [] } = useQuery(courseStructureApi.getAll());
  const courses = useMemo(() => {
    const all = (allCourses as CourseOption[]) || [];
    const { user } = userPermission();
    if (!user) return all;
    const role = ((user.role as any)?.roleValue || (user.role as any)?.originalRole || (user.role as any)?.renameRole || '').toLowerCase().replace(/\s+/g, '_');
    const isAdmin = role === 'admin' || role === 'super_admin' || role === 'superadmin';
    if (isAdmin) return all;
    const uid = user._id?.toString();
    return all.filter(c => {
      const ps: any[] = (c.batchAndParticipants || []).flatMap((b: any) => b?.users || []);
      return ps.some(p => { const pid = typeof p.user === 'object' ? p.user?._id?.toString() : p.user?.toString(); return pid === uid && (!p.status || p.status === 'active'); });
    });
  }, [allCourses]);

  const [selectedCourseId, setSelectedCourseId] = useState(sp?.get('courseId') || '');
  const [dPedagogy, setDPedagogy] = useState<'all' | 'I_Do' | 'We_Do' | 'You_Do'>((sp?.get('pedagogy') as any) || 'all');
  const [dSubCat, setDSubCat]     = useState(sp?.get('subCat') || 'all');
  const [dStudent, setDStudent]   = useState(sp?.get('student') || 'all');
  const [dFrom, setDFrom]         = useState(sp?.get('from') || '');
  const [dTo, setDTo]             = useState(sp?.get('to') || '');

  const [aPedagogy, setAPedagogy] = useState<'all' | 'I_Do' | 'We_Do' | 'You_Do'>((sp?.get('pedagogy') as any) || 'all');
  const [aSubCat, setASubCat]     = useState(sp?.get('subCat') || 'all');
  const [aStudent, setAStudent]   = useState(sp?.get('student') || 'all');
  const [aFrom, setAFrom]         = useState(sp?.get('from') || '');
  const [aTo, setATo]             = useState(sp?.get('to') || '');

  const [page, setPage] = useState(1);
  const [hoverPed, setHoverPed] = useState<string | null>(null);

  // ── The report's three server reads ────────────────────────────────────────
  // This page used to pull every measured session for the course — 443 rows /
  // 161 KB on the busiest one — and then filter, total, chart and slice it in
  // the browser. Each of those jobs now asks for exactly what it needs:
  //   · the detail table  → one page of ten rows
  //   · the dropdowns     → the whole course, once
  //   · the cards, donut and trend → sums computed in Mongo
  //
  // The aggregates are the reason the table is safe to paginate at all: they
  // are sums over every matching row, so a page could never have produced them.
  const filters: ReportFilters = useMemo(() => ({
    student: aStudent, pedagogy: aPedagogy, subCat: aSubCat, from: aFrom, to: aTo,
  }), [aStudent, aPedagogy, aSubCat, aFrom, aTo]);

  // Page 1 on any change of course or filter — adjusted DURING render against a
  // signature. In an effect this would first fire a request for the old page.
  const sig = JSON.stringify([selectedCourseId, filters]);
  const [lastSig, setLastSig] = useState(sig);
  if (lastSig !== sig) { setLastSig(sig); setPage(1); }

  const { data: pageData, isLoading: loading, error: errorObj } =
    useCourseReportPageQuery(selectedCourseId, filters, page);
  const { data: facets } = useCourseReportFacetsQuery(selectedCourseId);
  const { data: statsData } = useCourseReportStatsQuery(selectedCourseId, filters);
  const error = errorObj ? ((errorObj as Error).message || 'Failed to load') : null;

  const matchedTotal = pageData?.total ?? 0;
  // Whole-COURSE count — kept outside the filter so "this course has nothing"
  // stays distinct from "this filter matched nothing".
  const courseTotal = pageData?.unfilteredTotal ?? 0;

  useEffect(() => { setDSubCat('all'); }, [dPedagogy]);

  // Student + sub-category options derived from the actual measured sessions
  // Built over the whole course by the server: a student filtered out of the
  // current view must stay selectable, or the filter could not be undone.
  const studentOptions = facets?.students ?? [];

  const subCatOptions = useMemo(() => {
    if (dPedagogy === 'all') return [];
    return (facets?.subCategories?.[dPedagogy] ?? []).map(v => ({ value: v, label: v }));
  }, [facets, dPedagogy]);

  // The rows on screen. The filter chain that used to live here — student,
  // pedagogy, sub-category and the "From with no To means that one day" rule —
  // now runs in Mongo; the date boundaries are still resolved in the browser
  // with local-time setHours, so the selection is unchanged.
  const pageRows = pageData?.data ?? [];

  const isSingleStudent = aStudent !== 'all';
  const selectedCourse = courses.find(c => c._id === selectedCourseId);

  // ── Time stats ─────────────────────────────────────────────────────────────
  // Sums over the whole selection, computed in Mongo. `spanDays` and the two
  // averages stay here: they are arithmetic on the totals, not another pass
  // over the rows.
  const stats = useMemo(() => {
    const s0 = statsData?.stats;
    const total = s0?.total || 0;
    const count = s0?.count || 0;
    const activeDays = s0?.activeDays || 0;
    const firstActivity = s0?.firstActivity || '';
    const lastActivity = s0?.lastActivity || '';
    const firstTs = firstActivity ? new Date(firstActivity).getTime() : Infinity;
    const lastTs = lastActivity ? new Date(lastActivity).getTime() : -Infinity;
    return {
      total,
      byPed: { I_Do: 0, We_Do: 0, You_Do: 0, ...(s0?.byPed || {}) } as Record<string, number>,
      cntPed: { I_Do: 0, We_Do: 0, You_Do: 0, ...(s0?.cntPed || {}) } as Record<string, number>,
      count,
      activeDays,
      spanDays: firstTs !== Infinity ? Math.max(activeDays, Math.round((lastTs - firstTs) / 86400000) + 1) : 0,
      avgPerSession: count > 0 ? Math.round(total / count) : 0,
      avgPerDay: activeDays > 0 ? Math.round(total / activeDays) : 0,
      students: s0?.students || 0,
      firstActivity,
      lastActivity,
    };
  }, [statsData]);

  // ── Donut: time by pedagogy ──────────────────────────────────────────────────────
  const donut = useMemo(() => {
    const segs = (['I_Do', 'We_Do', 'You_Do'] as const).map(p => ({
      ped: p, label: PEDAGOGY_LABEL[p], col: PEDAGOGY_COLOR[p],
      value: stats.byPed[p] || 0, count: stats.cntPed[p] || 0,
    }));
    const sum = segs.reduce((s, x) => s + x.value, 0) || 1;
    const R = 62, C = 2 * Math.PI * R;
    let off = 0;
    const arcs = segs.map(s => {
      const frac = s.value / sum, dash = frac * C;
      const arc = { ...s, pct: (s.value / sum) * 100, dash, gap: C - dash, offset: -off * C };
      off += frac; return arc;
    });
    return { arcs, R, C };
  }, [stats]);

  // ── Daily time series (by pedagogy) ────────────────────────────────────────
  // Bucketed by Mongo in the BROWSER's timezone (the request carries it), which
  // is what the local-time getFullYear/getMonth/getDate keys here did.
  const daily = useMemo(() => (statsData?.perDay ?? []).slice(-10).map(d => ({
    key: d.key,
    I_Do: d.byPed?.I_Do || 0,
    We_Do: d.byPed?.We_Do || 0,
    You_Do: d.byPed?.You_Do || 0,
  })), [statsData]);

  // ── Print / custom report ─────────────────────────────────────────────────────
  const [showPrint, setShowPrint] = useState(false);
  const [pTitle, setPTitle] = useState('Course Log Report');
  const [pShowSummary, setPShowSummary] = useState(true);
  const [pShowCharts, setPShowCharts] = useState(true);
  const [pShowDetails, setPShowDetails] = useState(true);
  const [pPieMode, setPPieMode] = useState<'overall' | 'perday'>('overall');
  const [pDetailFormat, setPDetailFormat] = useState<'table' | 'paragraph'>('table');
  const [pGroupBy, setPGroupBy] = useState<'none' | 'student' | 'pedagogy' | 'day'>('none');
  const [pPedagogy, setPPedagogy] = useState<'all' | 'I_Do' | 'We_Do' | 'You_Do'>('all');
  const [pStudent, setPStudent] = useState('all');
  const [pFrom, setPFrom] = useState('');
  const [pTo, setPTo] = useState('');

  const openPrint = () => {
    setPPedagogy(aPedagogy); setPStudent(aStudent); setPFrom(aFrom); setPTo(aTo);
    setPTitle(`Course Log Report${selectedCourse ? ' — ' + selectedCourse.courseName : ''}`);
    setShowPrint(true);
  };

  // The print view lists every session it covers, so this is the one read that
  // still asks for a whole selection — gated on the modal actually being open,
  // and filtered in Mongo rather than here. Note it carries no sub-category:
  // the print filters were always their own set, and that is preserved.
  const printFilters: ReportFilters = useMemo(
    () => ({ student: pStudent, pedagogy: pPedagogy, from: pFrom, to: pTo }),
    [pStudent, pPedagogy, pFrom, pTo],
  );
  const { data: printRows = [], isFetching: printLoading } =
    useCourseReportAllQuery(selectedCourseId, printFilters, showPrint);

  // Ascending, as the printed order has always been.
  const printSessions = useMemo(
    () => [...printRows].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [printRows],
  );

  const printStats = useMemo(() => {
    const total = printSessions.reduce((s, r) => s + (r.durationSec || 0), 0);
    const byPed: Record<string, number> = { I_Do: 0, We_Do: 0, You_Do: 0 };
    const cntPed: Record<string, number> = { I_Do: 0, We_Do: 0, You_Do: 0 };
    const dayKeys = new Set<string>();
    let firstTs = Infinity, lastTs = -Infinity;
    printSessions.forEach(r => {
      byPed[r.pedagogy] += (r.durationSec || 0); cntPed[r.pedagogy] += 1;
      const d = new Date(r.startTime); if (isNaN(d.getTime())) return;
      dayKeys.add(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`);
      const t = d.getTime(); if (t < firstTs) firstTs = t; if (t > lastTs) lastTs = t;
    });
    return { total, byPed, cntPed, count: printSessions.length, activeDays: dayKeys.size,
      students: new Set(printSessions.map(s => s.studentId)).size,
      firstActivity: firstTs !== Infinity ? new Date(firstTs).toISOString() : '',
      lastActivity: lastTs !== -Infinity ? new Date(lastTs).toISOString() : '' };
  }, [printSessions]);

  const printPerDay = useMemo(() => {
    const m: Record<string, { key: string; ts: number; total: number; byPed: Record<string, number>; count: number }> = {};
    printSessions.forEach(s => {
      const d = new Date(s.startTime); if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      if (!m[key]) m[key] = { key, ts: new Date(key).getTime(), total: 0, byPed: { I_Do: 0, We_Do: 0, You_Do: 0 }, count: 0 };
      m[key].byPed[s.pedagogy] += (s.durationSec || 0); m[key].total += (s.durationSec || 0); m[key].count += 1;
    });
    return Object.values(m).sort((a, b) => a.ts - b.ts);
  }, [printSessions]);

  const printGroups = useMemo(() => {
    if (pGroupBy === 'none') return [{ label: '', rows: printSessions }];
    const m = new Map<string, ReportSession[]>();
    printSessions.forEach(s => {
      let k = '';
      if (pGroupBy === 'student') k = s.studentName || s.studentEmail || s.studentId;
      else if (pGroupBy === 'pedagogy') k = PEDAGOGY_LABEL[s.pedagogy] || s.pedagogy;
      else { const d = new Date(s.startTime); k = isNaN(d.getTime()) ? '—' : `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()}`; }
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    });
    return Array.from(m, ([label, rows]) => ({ label, rows }));
  }, [printSessions, pGroupBy]);

  // ── URL sync (keeps navbar title in sync) ─────────────────────────────────────────
  const syncUrl = (next: { pedagogy: string; subCat: string; student: string; from: string; to: string }) => {
    const params = new URLSearchParams();
    if (selectedCourseId) params.set('courseId', selectedCourseId);
    if (selectedCourse) params.set('courseName', selectedCourse.courseName);
    if (next.pedagogy !== 'all') params.set('pedagogy', next.pedagogy);
    if (next.subCat !== 'all') params.set('subCat', next.subCat);
    if (next.student !== 'all') params.set('student', next.student);
    if (next.from) params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    router.replace('/lms/pages/logs/report?' + params.toString(), { scroll: false } as any);
  };

  const applyFilters = () => {
    setAPedagogy(dPedagogy); setASubCat(dSubCat); setAStudent(dStudent); setAFrom(dFrom); setATo(dTo); setPage(1);
    syncUrl({ pedagogy: dPedagogy, subCat: dSubCat, student: dStudent, from: dFrom, to: dTo });
  };
  const resetFilters = () => {
    setDPedagogy('all'); setDSubCat('all'); setDStudent('all'); setDFrom(''); setDTo('');
    setAPedagogy('all'); setASubCat('all'); setAStudent('all'); setAFrom(''); setATo(''); setPage(1);
    syncUrl({ pedagogy: 'all', subCat: 'all', student: 'all', from: '', to: '' });
  };

  const totalPages = pageData?.totalPages ?? 1;
  const startEntry = matchedTotal === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endEntry = Math.min(page * PAGE_SIZE, matchedTotal);

  // ── Excel export ──────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const exportToExcel = async () => {
    if (exporting) return;
    const ExcelJS = (await import('exceljs')).default;
    // file-saver's export shape differs between CJS/ESM interop — the function
    // can be the named export, live under default, or BE the default itself.
    // Destructuring `{ saveAs }` alone yields undefined here and every Export
    // button in this feature threw "saveAs is not a function" on click.
    const fileSaverMod: any = await import('file-saver');
    const saveAs: (blob: Blob, name: string) => void =
      fileSaverMod.saveAs || fileSaverMod.default?.saveAs || fileSaverMod.default;
    // Covers every row matching the current filters, not the ten on screen.
    let exportRows: ReportSession[];
    setExporting(true);
    try {
      exportRows = await fetchCourseReportAll(selectedCourseId, filters);
    } catch {
      setExporting(false);
      return;
    }
    setExporting(false);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Session Details');
    ws.columns = [
      { header: '#',             key: 'num',    width: 5  },
      { header: 'Student Name',  key: 'student', width: 24 },
      { header: 'Type',          key: 'type',   width: 14 },
      { header: 'Title',         key: 'title',  width: 30 },
      { header: 'Node Type',     key: 'node',   width: 24 },
      { header: 'Start',         key: 'start',  width: 22 },
      { header: 'End',           key: 'end',    width: 22 },
      { header: 'Duration',      key: 'dur',    width: 12 },
    ];
    const hdr = ws.getRow(1);
    hdr.eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF27757' } }; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
    hdr.height = 22;
    exportRows.forEach((r, i) => {
      const row = ws.addRow({
        num: i + 1, student: r.studentName || '—', type: r.type || '—', title: r.title || '—',
        node: nodeLabel(r), start: fmtDateTime(r.startTime), end: fmtDateTime(r.endTime),
        dur: fmtHM(r.durationSec),
      });
      row.height = 18;
      row.eachCell(cell => { cell.alignment = { vertical: 'middle' }; if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF9F8' } }; });
    });
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `course-log-report-${(selectedCourse?.courseName || 'course').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const selStudentEmail = isSingleStudent ? (studentOptions.find(o => o.value === aStudent)?.email || '') : '';
  const selStudentName = isSingleStudent ? (studentOptions.find(o => o.value === aStudent)?.label || 'Student') : '';
  const bannerName  = isSingleStudent ? selStudentName : (selectedCourse?.courseName || 'All Students');
  const bannerEmail = isSingleStudent ? selStudentEmail : `${stats.students} student${stats.students !== 1 ? 's' : ''}`;

  return (
    <AdminOrStaffLayout fullBleed>
      <style jsx global>{`
        .rpt-page * { font-family: ${FONT}; }
        .rpt-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .rpt-scroll::-webkit-scrollbar-thumb { background: #e4e4ed; border-radius: 99px; }
        .rpt-scroll::-webkit-scrollbar-thumb:hover { background: ${T.orange}; }
        .rpt-select:focus, .rpt-input:focus { border-color: ${T.orange} !important; outline: none; box-shadow: 0 0 0 3px rgba(242,119,87,0.12); }
        .rpt-tr:hover td { background: #fafbfc !important; }
        .rpt-apply-btn:hover { background: ${T.orangeDark} !important; }
        .rpt-ghost-btn:hover { border-color: ${T.orange} !important; color: ${T.orange} !important; }
        .rpt-export-btn:hover { background: rgba(16,185,129,0.12) !important; }
        .rpt-arc { cursor: pointer; transition: opacity 0.15s; }
        .print-break { break-inside: avoid; page-break-inside: avoid; }
        @media print {
          body * { visibility: hidden !important; }
          #print-paper, #print-paper * { visibility: visible !important; }
          #print-paper {
            position: absolute !important; left: 0; top: 0; width: 100% !important;
            max-height: none !important; height: auto !important; overflow: visible !important;
            box-shadow: none !important; margin: 0 !important; border: none !important; border-radius: 0 !important;
            padding: 0 !important;
          }
          .no-print { display: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      {/* Background transparent (was gray #f6f7f9) so the shell's white
          panel shows through instead of a gray inner surface behind the
          report — matches the LogsPage fix. Horizontal padding widened so
          the filter card and body have proper breathing room on the edges. */}
      <div className="rpt-page rpt-scroll" style={{ height: '100%', overflowY: 'auto', background: 'transparent', padding: '10px 24px' }}>

        {/* ── Filter box ── */}
        <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 12 }}>
            <FilterSelect label="Course" value={selectedCourseId || 'all'} onChange={v => setSelectedCourseId(v === 'all' ? '' : v)}
              options={courses.map(c => ({ value: c._id, label: c.courseName }))} placeholder="Select Course" />
            <FilterSelect label="Pedagogy" value={dPedagogy} onChange={v => setDPedagogy(v as any)}
              options={[{ value: 'I_Do', label: 'I Do' }, { value: 'We_Do', label: 'We Do' }, { value: 'You_Do', label: 'You Do' }]} placeholder="All Pedagogy" disabled={!selectedCourseId} />
            <FilterSelect label="Sub Category" value={dSubCat} onChange={setDSubCat} options={subCatOptions}
              placeholder={dPedagogy === 'all' ? 'Sub Category' : 'All Sub Categories'} disabled={!selectedCourseId || dPedagogy === 'all'} />
            <FilterSelect label="Student" value={dStudent} onChange={setDStudent} options={studentOptions} placeholder="All Students" disabled={!selectedCourseId || studentOptions.length === 0} />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <FieldLabel>Date Range</FieldLabel>
              <div style={{ display: 'flex', gap: 5 }}>
                <input type="date" value={dFrom} onChange={e => setDFrom(e.target.value)} disabled={!selectedCourseId} className="rpt-input"
                  style={{ height: 34, flex: 1, minWidth: 0, padding: '0 7px', fontSize: 11, borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.textSub, fontFamily: FONT, opacity: !selectedCourseId ? 0.6 : 1 }} />
                <input type="date" value={dTo} onChange={e => setDTo(e.target.value)} disabled={!selectedCourseId} className="rpt-input"
                  style={{ height: 34, flex: 1, minWidth: 0, padding: '0 7px', fontSize: 11, borderRadius: 8, border: `1px solid ${T.border}`, background: T.bg, color: T.textSub, fontFamily: FONT, opacity: !selectedCourseId ? 0.6 : 1 }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="rpt-apply-btn" onClick={applyFilters} disabled={!selectedCourseId}
              style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 16px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: !selectedCourseId ? 'not-allowed' : 'pointer', border: 'none', background: T.orange, color: '#fff', transition: 'background 0.15s', opacity: !selectedCourseId ? 0.6 : 1 }}>
              <FileText size={13} /> Generate Report
            </button>
            {canExport && (
              <button className="rpt-ghost-btn" onClick={openPrint} disabled={!selectedCourseId || courseTotal === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: (!selectedCourseId || courseTotal === 0) ? 'not-allowed' : 'pointer', border: `1px solid ${T.border}`, background: '#fff', color: T.textSub, transition: 'all 0.15s', opacity: (!selectedCourseId || courseTotal === 0) ? 0.6 : 1 }}>
                <Printer size={13} /> Print Report
              </button>
            )}
            <button className="rpt-ghost-btn" onClick={resetFilters} disabled={!selectedCourseId}
              style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: !selectedCourseId ? 'not-allowed' : 'pointer', border: `1px solid ${T.border}`, background: '#fff', color: T.textMuted, transition: 'all 0.15s', opacity: !selectedCourseId ? 0.6 : 1 }}>
              <RefreshCw size={12} /> Reset
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {!selectedCourseId ? (
          <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '70px 0', textAlign: 'center' }}>
            <FileText size={36} style={{ color: T.textHint, marginBottom: 10 }} />
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0 }}>Select a course and click <strong>Generate Report</strong> to view the report</p>
          </div>
        ) : loading ? (
          <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '70px 0', display: 'flex', justifyContent: 'center' }}>
            <Loader2 size={26} className="animate-spin" style={{ color: T.orange }} />
          </div>
        ) : error ? (
          <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '70px 0', textAlign: 'center', fontSize: 13, color: T.textMuted }}>{error}</div>
        ) : (
          <>
            {/* ── Banner ── */}
            <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 200, flex: '0 0 auto' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: isSingleStudent ? 'rgba(99,102,241,0.14)' : T.orangeLight, color: isSingleStudent ? T.iDo : T.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  {initials(bannerName)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textMain, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bannerName}</div>
                  <div style={{ fontSize: 11, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bannerEmail}</div>
                </div>
              </div>
              {[
                { label: 'Total Time', value: fmtHM(stats.total) },
                { label: isSingleStudent ? 'Sessions' : 'Students', value: isSingleStudent ? String(stats.count) : String(stats.students) },
                { label: 'First Activity', value: stats.firstActivity ? fmtDateTime(stats.firstActivity) : '—' },
                { label: 'Last Activity',  value: stats.lastActivity ? fmtDateTime(stats.lastActivity) : '—' },
                { label: 'Active Days',    value: `${stats.activeDays} of ${stats.spanDays}` },
              ].map(it => (
                <div key={it.label} style={{ minWidth: 100 }}>
                  <div style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 500, marginBottom: 3 }}>{it.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.textMain, whiteSpace: 'nowrap' }}>{it.value}</div>
                </div>
              ))}
            </div>

            {/* ── Stat cards (time) ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <StatCard icon={Clock} iconBg="rgba(242,119,87,0.10)" iconCol={T.orange} label="Total Time" value={fmtHM(stats.total)} sub={`${stats.count} session${stats.count !== 1 ? 's' : ''}`} />
              <StatCard icon={BookOpen} iconBg="rgba(99,102,241,0.10)" iconCol={T.iDo} label="I Do Time" value={fmtHM(stats.byPed.I_Do)} sub={`${stats.cntPed.I_Do} resource${stats.cntPed.I_Do !== 1 ? 's' : ''}`} />
              <StatCard icon={PenLine} iconBg="rgba(16,185,129,0.10)" iconCol={T.weDo} label="We Do Time" value={fmtHM(stats.byPed.We_Do)} sub={`${stats.cntPed.We_Do} assignment${stats.cntPed.We_Do !== 1 ? 's' : ''}`} />
              <StatCard icon={GraduationCap} iconBg="rgba(245,158,11,0.12)" iconCol={T.youDo} label="You Do Time" value={fmtHM(stats.byPed.You_Do)} sub={`${stats.cntPed.You_Do} assessment${stats.cntPed.You_Do !== 1 ? 's' : ''}`} />
              <StatCard icon={CalendarDays} iconBg="rgba(59,130,246,0.10)" iconCol="#3b82f6" label="Avg / Session" value={fmtHM(stats.avgPerSession)} sub={`Avg ${fmtHM(stats.avgPerDay)} / day`} />
            </div>

            {/* ── Charts row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 10, marginBottom: 10 }}>

              {/* Time trend (line) */}
              <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '13px 15px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textMain, marginBottom: 8 }}>Time Spent per Day</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 6 }}>
                  {(['I_Do', 'We_Do', 'You_Do'] as const).map(p => (
                    <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: T.textMuted }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: PEDAGOGY_COLOR[p] }} /> {PEDAGOGY_LABEL[p]}
                    </span>
                  ))}
                </div>
                <DailyBars daily={daily} />
              </div>

              {/* Time by pedagogy (donut, hover) */}
              <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, padding: '13px 15px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.textMain, marginBottom: 10 }}>Time by Pedagogy</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
                    <svg width={150} height={150} viewBox="0 0 150 150">
                      <circle cx={75} cy={75} r={donut.R} fill="none" stroke={T.borderLight} strokeWidth={17} />
                      {donut.arcs.map((a) => a.value > 0 && (
                        <circle key={a.ped} className="rpt-arc" cx={75} cy={75} r={donut.R} fill="none" stroke={a.col} strokeWidth={17}
                          strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={a.offset} transform="rotate(-90 75 75)" strokeLinecap="butt"
                          opacity={hoverPed && hoverPed !== a.ped ? 0.35 : 1}
                          onMouseEnter={() => setHoverPed(a.ped)} onMouseLeave={() => setHoverPed(null)}>
                          <title>{PEDAGOGY_LABEL[a.ped]}: {fmtHM(a.value)} ({a.pct.toFixed(1)}%)</title>
                        </circle>
                      ))}
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: T.textMain, lineHeight: 1.1 }}>
                        {hoverPed ? fmtHM(stats.byPed[hoverPed] || 0) : fmtHM(stats.total)}
                      </div>
                      <div style={{ fontSize: 10, color: T.textMuted }}>{hoverPed ? PEDAGOGY_LABEL[hoverPed] : 'Total'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: 1 }}>
                    {donut.arcs.map((a) => (
                      <div key={a.ped}
                        onMouseEnter={() => setHoverPed(a.ped)} onMouseLeave={() => setHoverPed(null)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', borderRadius: 7, cursor: 'default', background: hoverPed === a.ped ? T.borderLight : 'transparent' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: a.col, flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 11.5, color: T.textSub, fontWeight: 600 }}>{a.label}</div>
                          <div style={{ fontSize: 10, color: T.textMuted }}>{a.count} item{a.count !== 1 ? 's' : ''} · {a.pct.toFixed(1)}%</div>
                        </div>
                        <span style={{ fontSize: 11.5, color: T.textMain, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtHM(a.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Session Details ── */}
            <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: T.textMain }}>Session Details</span>
                {matchedTotal > 0 && canExport && (
                  <button className="rpt-export-btn" onClick={exportToExcel}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 11px', fontSize: 11.5, fontWeight: 600, borderRadius: 7, cursor: 'pointer', border: '1px solid #bbf7d0', background: 'rgba(16,185,129,0.06)', color: '#059669', transition: 'background 0.15s' }}>
                    <Download size={12} /> Export
                  </button>
                )}
              </div>
              <div className="rpt-scroll" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                  <thead><tr>
                    {['#', 'Student Name', 'Type', 'Title', 'Node Type', 'Start Date-Time', 'End Date-Time', 'Duration'].map((h, i) => (
                      <th key={h} style={{ fontSize: 10, fontWeight: 600, color: T.textMuted, textAlign: 'left', padding: '10px 10px', paddingLeft: i === 0 ? 16 : 10, background: '#fafbfc', borderBottom: `1px solid ${T.border}`, whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {pageRows.map((r, i) => {
                      const tb = typeBadge(r.type);
                      return (
                        <tr key={r._id || `${r.studentId}-${i}-${r.startTime}`} className="rpt-tr" style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                          <td style={{ padding: '9px 10px 9px 16px', fontSize: 11, color: T.textHint, fontFamily: 'ui-monospace,monospace' }}>{startEntry + i}</td>
                          <td style={{ padding: '9px 10px', fontSize: 11.5, color: T.textMain, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{r.studentName || '—'}</td>
                          <td style={{ padding: '9px 10px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600, background: tb.bg, color: tb.col, whiteSpace: 'nowrap' }}>{r.type}</span>
                          </td>
                          <td style={{ padding: '9px 10px', fontSize: 11.5, fontWeight: 600, color: T.textMain, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{r.title}</td>
                          <td style={{ padding: '9px 10px', fontSize: 11, color: T.textSub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{nodeLabel(r)}</td>
                          <td style={{ padding: '9px 10px', fontSize: 10.5, color: T.textSub, whiteSpace: 'nowrap' }}>{fmtDateTime(r.startTime)}</td>
                          <td style={{ padding: '9px 10px', fontSize: 10.5, color: T.textSub, whiteSpace: 'nowrap' }}>{fmtDateTime(r.endTime)}</td>
                          <td style={{ padding: '9px 10px', fontSize: 11.5, color: T.textMain, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtHM(r.durationSec)}</td>
                        </tr>
                      );
                    })}
                    {pageRows.length === 0 && (
                      <tr><td colSpan={8} style={{ padding: '50px 0', textAlign: 'center', fontSize: 13, color: T.textMuted }}>No measured activity matches the selected filters</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '10px 16px', borderTop: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 11.5, color: T.textMuted }}>Showing {startEntry} to {endEntry} of {matchedTotal.toLocaleString()} entries</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <button className="rpt-ghost-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ height: 28, padding: '0 10px', fontSize: 11.5, fontWeight: 500, borderRadius: 7, border: `1px solid ${T.border}`, background: '#fff', color: page === 1 ? T.textHint : T.textSub, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
                  {pageList(page, totalPages).map((p, idx) => p === '…' ? (
                    <span key={`e${idx}`} style={{ padding: '0 4px', fontSize: 11.5, color: T.textHint }}>…</span>
                  ) : (
                    <button key={p} className={p === page ? '' : 'rpt-ghost-btn'} onClick={() => setPage(p as number)}
                      style={{ minWidth: 28, height: 28, padding: '0 7px', fontSize: 11.5, fontWeight: 600, borderRadius: 7, border: p === page ? 'none' : `1px solid ${T.border}`, background: p === page ? T.orange : '#fff', color: p === page ? '#fff' : T.textSub, cursor: 'pointer' }}>{p}</button>
                  ))}
                  <button className="rpt-ghost-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ height: 28, padding: '0 10px', fontSize: 11.5, fontWeight: 500, borderRadius: 7, border: `1px solid ${T.border}`, background: '#fff', color: page === totalPages ? T.textHint : T.textSub, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ════════════════ PRINT / CUSTOM REPORT MODAL ════════════════ */}
      {showPrint && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowPrint(false)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '90vw', maxWidth: 1200, height: '88vh', background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: T.textMain }}>
                <Printer size={17} style={{ color: T.orange }} /> Print Report
              </div>
              <button onClick={() => setShowPrint(false)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
            </div>

            {/* Body: left paper · right controls */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>

              {/* ── LEFT: paper preview ── */}
              <div className="rpt-scroll" style={{ flex: 1, minWidth: 0, overflowY: 'auto', background: '#eef0f3', padding: '20px 24px' }}>
                <div id="print-paper" style={{ width: 760, maxWidth: '100%', margin: '0 auto', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', borderRadius: 4, padding: 32, color: '#1f2937', fontSize: 12 }}>

                  {/* Report header */}
                  <div style={{ borderBottom: `2px solid ${T.orange}`, paddingBottom: 12, marginBottom: 16 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>{pTitle || 'Course Log Report'}</div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                      <span><strong>Course:</strong> {selectedCourse?.courseName || '—'}</span>
                      {pStudent !== 'all' && <span><strong>Student:</strong> {studentOptions.find(o => o.value === pStudent)?.label || '—'}</span>}
                      {pPedagogy !== 'all' && <span><strong>Pedagogy:</strong> {PEDAGOGY_LABEL[pPedagogy]}</span>}
                      <span><strong>Period:</strong> {pFrom && pTo ? `${new Date(pFrom).toLocaleDateString('en-GB')} – ${new Date(pTo).toLocaleDateString('en-GB')}` : pFrom ? new Date(pFrom).toLocaleDateString('en-GB') : pTo ? `up to ${new Date(pTo).toLocaleDateString('en-GB')}` : 'All time'}</span>
                      <span><strong>Generated:</strong> {new Date().toLocaleString('en-GB')}</span>
                    </div>
                  </div>

                  {printLoading && printSessions.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Loading report…</div>
                  ) : printSessions.length === 0 ? (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No measured activity for the selected filters.</div>
                  ) : (
                    <>
                      {/* Summary */}
                      {pShowSummary && (
                        <div className="print-break" style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Summary</div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                            {[
                              { l: 'Total Time', v: fmtHM(printStats.total) },
                              { l: 'Sessions', v: String(printStats.count) },
                              { l: 'Students', v: String(printStats.students) },
                              { l: 'I Do Time', v: fmtHM(printStats.byPed.I_Do) },
                              { l: 'We Do Time', v: fmtHM(printStats.byPed.We_Do) },
                              { l: 'You Do Time', v: fmtHM(printStats.byPed.You_Do) },
                              { l: 'Active Days', v: String(printStats.activeDays) },
                              { l: 'First Activity', v: printStats.firstActivity ? fmtDateTime(printStats.firstActivity) : '—' },
                              { l: 'Last Activity', v: printStats.lastActivity ? fmtDateTime(printStats.lastActivity) : '—' },
                            ].map(it => (
                              <div key={it.l} style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: '7px 10px' }}>
                                <div style={{ fontSize: 9.5, color: '#6b7280' }}>{it.l}</div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{it.v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Charts */}
                      {pShowCharts && (
                        <div className="print-break" style={{ marginBottom: 18 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                            {pPieMode === 'overall' ? 'Time by Pedagogy' : 'Time by Pedagogy — per day'}
                          </div>
                          {pPieMode === 'overall' ? (
                            <PaperDonut byPed={printStats.byPed} total={printStats.total} size={150} />
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                              {printPerDay.map(d => (
                                <div key={d.key} className="print-break" style={{ border: `1px solid ${T.border}`, borderRadius: 6, padding: 10 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{new Date(d.key).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {fmtHM(d.total)}</div>
                                  <PaperDonut byPed={d.byPed} total={d.total} size={110} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Details */}
                      {pShowDetails && (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Session Details</div>
                          {printGroups.map((g, gi) => (
                            <div key={gi} className="print-break" style={{ marginBottom: 14 }}>
                              {g.label && <div style={{ fontSize: 11.5, fontWeight: 700, color: T.orange, margin: '6px 0 5px' }}>{g.label} <span style={{ color: '#9ca3af', fontWeight: 500 }}>({g.rows.length})</span></div>}

                              {pDetailFormat === 'table' ? (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                  <thead><tr>
                                    {['#', 'Student', 'Type', 'Title', 'Node Type', 'Start', 'End', 'Duration'].map(h => (
                                      <th key={h} style={{ textAlign: 'left', fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280', borderBottom: `1px solid ${T.border}`, padding: '5px 6px' }}>{h}</th>
                                    ))}
                                  </tr></thead>
                                  <tbody>
                                    {g.rows.map((r, i) => (
                                      <tr key={i} style={{ borderBottom: `1px solid ${T.borderLight}` }}>
                                        <td style={{ padding: '4px 6px', fontSize: 9.5, color: '#9ca3af' }}>{i + 1}</td>
                                        <td style={{ padding: '4px 6px', fontSize: 10 }}>{r.studentName || '—'}</td>
                                        <td style={{ padding: '4px 6px', fontSize: 10 }}>{r.type}</td>
                                        <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600 }}>{r.title}</td>
                                        <td style={{ padding: '4px 6px', fontSize: 9.5, color: '#374151' }}>{nodeLabel(r)}</td>
                                        <td style={{ padding: '4px 6px', fontSize: 9, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDateTime(r.startTime)}</td>
                                        <td style={{ padding: '4px 6px', fontSize: 9, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDateTime(r.endTime)}</td>
                                        <td style={{ padding: '4px 6px', fontSize: 10, fontWeight: 600 }}>{fmtHM(r.durationSec)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p style={{ fontSize: 11, lineHeight: 1.7, color: '#374151', margin: 0, textAlign: 'justify' }}>
                                  {g.rows.map((r, i) => (
                                    <span key={i}>
                                      <strong>{r.studentName || 'Student'}</strong> spent <strong>{fmtHM(r.durationSec)}</strong> on the {r.type.toLowerCase()} “{r.title}”{(r.nodeName || r.nodeType) ? ` (under ${nodeLabel(r)})` : ''}, from {fmtDateTime(r.startTime)} to {fmtDateTime(r.endTime)}. {' '}
                                    </span>
                                  ))}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── RIGHT: customization controls ── */}
              <div className="rpt-scroll no-print" style={{ width: 280, flexShrink: 0, borderLeft: `1px solid ${T.border}`, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>

                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Report Title</div>
                  <input value={pTitle} onChange={e => setPTitle(e.target.value)} className="rpt-input"
                    style={{ width: '100%', height: 32, padding: '0 9px', fontSize: 12, borderRadius: 7, border: `1px solid ${T.border}`, fontFamily: FONT, color: T.textMain }} />
                </div>

                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Sections</div>
                  {[
                    { l: 'Summary', v: pShowSummary, set: setPShowSummary },
                    { l: 'Charts', v: pShowCharts, set: setPShowCharts },
                    { l: 'Details', v: pShowDetails, set: setPShowDetails },
                  ].map(s => (
                    <label key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12.5, color: T.textSub, cursor: 'pointer' }}>
                      <input type="checkbox" checked={s.v} onChange={e => s.set(e.target.checked)} style={{ accentColor: T.orange, width: 15, height: 15 }} /> {s.l}
                    </label>
                  ))}
                </div>

                {pShowCharts && (
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Pie Chart</div>
                    <Segmented value={pPieMode} onChange={v => setPPieMode(v as any)} options={[{ v: 'overall', l: 'Overall' }, { v: 'perday', l: 'Per day' }]} />
                  </div>
                )}

                {pShowDetails && (
                  <>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Details Format</div>
                      <Segmented value={pDetailFormat} onChange={v => setPDetailFormat(v as any)} options={[{ v: 'table', l: 'Table' }, { v: 'paragraph', l: 'Paragraph' }]} />
                    </div>
                    <div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Group By</div>
                      <select value={pGroupBy} onChange={e => setPGroupBy(e.target.value as any)} className="rpt-select"
                        style={{ width: '100%', height: 32, padding: '0 9px', fontSize: 12, borderRadius: 7, border: `1px solid ${T.border}`, fontFamily: FONT, color: T.textSub, background: '#fff' }}>
                        <option value="none">None</option>
                        <option value="student">Student</option>
                        <option value="pedagogy">Pedagogy</option>
                        <option value="day">Day</option>
                      </select>
                    </div>
                  </>
                )}

                <div style={{ height: 1, background: T.border }} />

                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Filters</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select value={pPedagogy} onChange={e => setPPedagogy(e.target.value as any)} className="rpt-select"
                      style={{ width: '100%', height: 32, padding: '0 9px', fontSize: 12, borderRadius: 7, border: `1px solid ${T.border}`, fontFamily: FONT, color: T.textSub, background: '#fff' }}>
                      <option value="all">All Pedagogy</option>
                      <option value="I_Do">I Do</option>
                      <option value="We_Do">We Do</option>
                      <option value="You_Do">You Do</option>
                    </select>
                    <select value={pStudent} onChange={e => setPStudent(e.target.value)} className="rpt-select"
                      style={{ width: '100%', height: 32, padding: '0 9px', fontSize: 12, borderRadius: 7, border: `1px solid ${T.border}`, fontFamily: FONT, color: T.textSub, background: '#fff' }}>
                      <option value="all">All Students</option>
                      {studentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="date" value={pFrom} onChange={e => setPFrom(e.target.value)} className="rpt-input"
                        style={{ flex: 1, minWidth: 0, height: 32, padding: '0 7px', fontSize: 11, borderRadius: 7, border: `1px solid ${T.border}`, fontFamily: FONT, color: T.textSub }} />
                      <input type="date" value={pTo} onChange={e => setPTo(e.target.value)} className="rpt-input"
                        style={{ flex: 1, minWidth: 0, height: 32, padding: '0 7px', fontSize: 11, borderRadius: 7, border: `1px solid ${T.border}`, fontFamily: FONT, color: T.textSub }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
              <span style={{ fontSize: 11.5, color: T.textMuted }}>{printSessions.length} record{printSessions.length !== 1 ? 's' : ''} in this report</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => window.print()} title="Use 'Save as PDF' in the dialog to download"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 16px', fontSize: 12.5, fontWeight: 600, borderRadius: 8, cursor: 'pointer', border: `1px solid ${T.border}`, background: '#fff', color: T.textSub }}>
                  <Download size={14} /> Download PDF
                </button>
                <button onClick={() => window.print()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 18px', fontSize: 12.5, fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: 'none', background: T.orange, color: '#fff' }}>
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminOrStaffLayout>
  );
}

// ── Segmented control ──────────────────────────────────────────────────────────────
function Segmented({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
      {options.map((o, i) => {
        const active = value === o.v;
        return (
          <button key={o.v} onClick={() => onChange(o.v)}
            style={{ flex: 1, height: 32, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', borderLeft: i ? `1px solid ${T.border}` : 'none', background: active ? T.orange : '#fff', color: active ? '#fff' : T.textSub, fontFamily: FONT }}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

// ── Compact donut for the printed report (SVG arc paths — always contiguous) ───────
function PaperDonut({ byPed, size = 130, showLegend = true }: { byPed: Record<string, number>; total?: number; size?: number; showLegend?: boolean }) {
  const PED = [['I_Do', '#6366f1'], ['We_Do', '#10b981'], ['You_Do', '#f59e0b']] as const;
  const LABEL: Record<string, string> = { I_Do: 'I Do', We_Do: 'We Do', You_Do: 'You Do' };
  const sw = Math.max(11, Math.round(size * 0.13));
  const r = size / 2 - sw / 2 - 1, cx = size / 2;
  const vals = PED.map(([p, col]) => ({ p, col, v: byPed[p] || 0 }));
  const sum = vals.reduce((s, x) => s + x.v, 0);

  // Build contiguous segments
  let cum = 0;
  const segs = vals.filter(x => x.v > 0).map(x => {
    const frac = sum > 0 ? x.v / sum : 0;
    const s = { ...x, frac, start: cum, end: cum + frac };
    cum += frac; return s;
  });
  const onlyOne = segs.length === 1;

  const arcD = (startFrac: number, endFrac: number) => {
    const a0 = startFrac * 2 * Math.PI - Math.PI / 2;
    const a1 = endFrac * 2 * Math.PI - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0), y0 = cx + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cx + r * Math.sin(a1);
    const large = (endFrac - startFrac) > 0.5 ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#f3f4f6" strokeWidth={sw} />
        {sum > 0 && (onlyOne
          ? <circle cx={cx} cy={cx} r={r} fill="none" stroke={segs[0].col} strokeWidth={sw} />
          : segs.map(s => <path key={s.p} d={arcD(s.start, s.end)} fill="none" stroke={s.col} strokeWidth={sw} strokeLinecap="butt" />)
        )}
        <text x={cx} y={cx - 1} textAnchor="middle" fontSize={12} fontWeight={800} fill="#1f2937">{fmtHM(sum)}</text>
        <text x={cx} y={cx + 11} textAnchor="middle" fontSize={7.5} fill="#6b7280">Total</text>
      </svg>
      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {PED.map(([p, col]) => {
            const v = byPed[p] || 0;
            const pct = sum > 0 ? (v / sum) * 100 : 0;
            return (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, flexShrink: 0 }} />
                <span style={{ color: '#374151', minWidth: 38 }}>{LABEL[p]}</span>
                <span style={{ color: '#1f2937', fontWeight: 600 }}>{fmtHM(v)}</span>
                <span style={{ color: '#9ca3af' }}>({pct.toFixed(0)}%)</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Daily grouped bar chart — time (minutes) per day, by pedagogy ──────────────────
function DailyBars({ daily }: { daily: { key: string; I_Do: number; We_Do: number; You_Do: number }[] }) {
  const W = 520, H = 170, padL = 30, padB = 24, padT = 8, padR = 8;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  if (daily.length === 0) return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#9ca3af' }}>No data</div>;
  const maxSec = Math.max(60, ...daily.map(d => Math.max(d.I_Do, d.We_Do, d.You_Do)));
  const maxMin = Math.ceil(maxSec / 60);
  const n = daily.length;
  const groupW = plotW / n;
  const barW = Math.min(11, (groupW - 8) / 3);
  const y = (sec: number) => padT + plotH - (sec / (maxMin * 60)) * plotH;
  const ticks = 4;
  const cols = { I_Do: '#6366f1', We_Do: '#10b981', You_Do: '#f59e0b' };
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const minVal = Math.round((maxMin / ticks) * (ticks - i));
        const yy = padT + (plotH / ticks) * i;
        return (<g key={i}><line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#f1f2f4" strokeWidth={1} /><text x={padL - 6} y={yy + 3} textAnchor="end" fontSize={9} fill="#9ca3af">{minVal}m</text></g>);
      })}
      {daily.map((d, i) => {
        const gx = padL + groupW * i + groupW / 2;
        const items: [keyof typeof cols, number][] = [['I_Do', d.I_Do], ['We_Do', d.We_Do], ['You_Do', d.You_Do]];
        return (
          <g key={d.key}>
            {items.map(([k, sec], bi) => {
              const x = gx - (barW * 1.5 + 2) + bi * (barW + 1);
              const top = y(sec);
              return <rect key={k} x={x} y={top} width={barW} height={Math.max(0, padT + plotH - top)} rx={2} fill={cols[k]}><title>{`${d.key} · ${k.replace('_', ' ')}: ${Math.round(sec / 60)}m`}</title></rect>;
            })}
            <text x={gx} y={H - 7} textAnchor="middle" fontSize={9} fill="#9ca3af">{fmtDayShort(d.key)}</text>
          </g>
        );
      })}
    </svg>
  );
}
