'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Coding Analytics — ONE dashboard, five platforms behind a switcher.
//
// The layout, card positions and hierarchy never change when the platform
// changes; only the data (and adaptive metric labels) swap, with skeletons on
// the data areas during the fetch. Reports are cached per platform for the
// session, so switching back is instant. Sections a platform can't provide
// (nulls in PlatformReport) are hidden, never faked.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, Check, ExternalLink, RefreshCw, Code2, Trophy, AlertCircle,
} from 'lucide-react';
import { StudentLayout } from '../../component/student/student-layout';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSION_IDS } from '@/components/permissions';
import {
  CODING_ACCOUNTS, PLATFORM_META, fetchPlatformReport,
  type PlatformKey, type PlatformReport, type SeriesPoint, type Verdict,
} from '@/apiServices/codingAnalytics';

const PLATFORMS: PlatformKey[] = ['leetcode', 'codeforces', 'codechef', 'hackerrank', 'atcoder'];

const RANGES = [
  { key: '7D', days: 7 }, { key: '30D', days: 30 }, { key: '3M', days: 91 },
  { key: '6M', days: 183 }, { key: '1Y', days: 365 },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

const timeAgo = (ms?: number) => {
  if (!ms) return '—';
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const DIFF_TONE: Record<string, string> = {
  Easy: 'bg-emerald-50 text-emerald-700',
  Medium: 'bg-amber-50 text-amber-700',
  Hard: 'bg-rose-50 text-rose-700',
};

const VERDICT_TONE: Record<Verdict, string> = {
  AC: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  WA: 'bg-rose-50 text-rose-700 ring-rose-200',
  TLE: 'bg-amber-50 text-amber-700 ring-amber-200',
  RE: 'bg-orange-50 text-orange-700 ring-orange-200',
  CE: 'bg-slate-100 text-slate-600 ring-slate-200',
  OTHER: 'bg-slate-100 text-slate-600 ring-slate-200',
};

// ── Small building blocks ───────────────────────────────────────────────────

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${className}`}>{children}</div>
);

const CardHead = ({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
    <div>
      <h2 className="text-[13px] font-semibold text-gray-900 tracking-[-0.01em]">{title}</h2>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
    {right}
  </div>
);

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-gray-100 ${className}`} />
);

const SectionEmpty = ({ text }: { text: string }) => (
  <div className="px-5 pb-5 pt-1 text-[12px] text-gray-500">{text}</div>
);

// Windowed page list, e.g. [1, '…', 4, 5, 6, '…', 12].
const pageItems = (current: number, total: number): (number | '…')[] => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push('…');
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push('…');
  items.push(total);
  return items;
};

// ── Charts (plain SVG — print/theme safe, no libs) ──────────────────────────

function ActivityChart({ series, days }: { series: SeriesPoint[]; days: number }) {
  const { points, max, total } = useMemo(() => {
    const cutoff = Date.now() - days * 86400000;
    const byDay = new Map(series.map((s) => [s.day, s.count]));
    // Bucket to keep ≤ 60 bars regardless of range.
    const bucketDays = Math.max(1, Math.ceil(days / 60));
    const buckets: { label: string; count: number }[] = [];
    for (let t = cutoff; t <= Date.now(); t += bucketDays * 86400000) {
      let c = 0;
      for (let b = 0; b < bucketDays; b++) {
        const k = new Date(t + b * 86400000).toISOString().slice(0, 10);
        c += byDay.get(k) || 0;
      }
      buckets.push({ label: new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), count: c });
    }
    return { points: buckets, max: Math.max(1, ...buckets.map((b) => b.count)), total: buckets.reduce((s, b) => s + b.count, 0) };
  }, [series, days]);

  const W = 560, H = 150, PB = 20, PT = 8;
  const bw = W / points.length;
  return (
    <div className="px-5 pb-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label={`${total} accepted in range`}>
        <line x1="0" y1={H - PB} x2={W} y2={H - PB} stroke="#E5E7EB" strokeWidth="1" />
        {points.map((p, i) => {
          const h = ((H - PB - PT) * p.count) / max;
          return (
            <g key={i}>
              <rect
                x={i * bw + bw * 0.18} y={H - PB - h} width={bw * 0.64} height={Math.max(h, p.count > 0 ? 2 : 0)}
                rx="2" fill="#F97316" opacity={p.count > 0 ? 0.9 : 0.15}
              >
                <title>{`${p.label}: ${p.count}`}</title>
              </rect>
            </g>
          );
        })}
        {points.map((p, i) =>
          i % Math.max(1, Math.ceil(points.length / 6)) === 0 ? (
            <text key={`t${i}`} x={i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="9" fill="#9CA3AF">{p.label}</text>
          ) : null
        )}
      </svg>
      <p className="text-[11px] text-gray-500 mt-1">{total} accepted submissions in this range</p>
    </div>
  );
}

function DifficultyDonut({ d }: { d: { easy: number; medium: number; hard: number } }) {
  const total = d.easy + d.medium + d.hard;
  const segs = [
    { label: 'Easy', value: d.easy, color: '#10B981' },
    { label: 'Medium', value: d.medium, color: '#F59E0B' },
    { label: 'Hard', value: d.hard, color: '#EF4444' },
  ];
  const R = 40, C = 2 * Math.PI * R;
  let acc = 0;
  const gap = segs.filter((s) => s.value > 0).length > 1 ? 2.5 : 0;
  return (
    <div className="px-5 pb-5 flex items-center gap-6 flex-wrap">
      <svg viewBox="0 0 100 100" className="w-[120px] h-[120px] shrink-0" role="img" aria-label={`${total} solved`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="#F3F4F6" strokeWidth="12" />
        <g transform="rotate(-90 50 50)">
          {total > 0 && segs.map((s, i) => {
            if (s.value <= 0) return null;
            const frac = s.value / total;
            const len = Math.max(0.5, frac * C - gap);
            const el = <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc * C} />;
            acc += frac;
            return el;
          })}
        </g>
        <text x="50" y="48" textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">{total}</text>
        <text x="50" y="62" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#9CA3AF" letterSpacing="0.06em">SOLVED</text>
      </svg>
      <div className="grid gap-2 min-w-0">
        {segs.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: s.color }} />
            {s.label}
            <b className="ml-auto pl-6 tabular-nums text-gray-900">{s.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function RatingChart({ history }: { history: { label: string; rating: number; t: number }[] }) {
  if (history.length < 2) return null;
  const W = 560, H = 130, P = 10, PB = 18;
  const min = Math.min(...history.map((h) => h.rating));
  const max = Math.max(...history.map((h) => h.rating));
  const span = Math.max(1, max - min);
  const x = (i: number) => P + (i * (W - 2 * P)) / (history.length - 1);
  const y = (r: number) => P + (H - P - PB) * (1 - (r - min) / span);
  const line = history.map((h, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(h.rating).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Rating history">
      <line x1="0" y1={H - PB} x2={W} y2={H - PB} stroke="#E5E7EB" strokeWidth="1" />
      <path d={`${line} L${x(history.length - 1)},${H - PB} L${x(0)},${H - PB} Z`} fill="#F97316" opacity="0.08" />
      <path d={line} fill="none" stroke="#F97316" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {history.map((h, i) => (
        <circle key={i} cx={x(i)} cy={y(h.rating)} r="7" fill="transparent"><title>{`${h.label}: ${h.rating}`}</title></circle>
      ))}
      <circle cx={x(history.length - 1)} cy={y(history[history.length - 1].rating)} r="4" fill="#F97316" stroke="#fff" strokeWidth="2" />
      <text x={x(history.length - 1) - 6} y={y(history[history.length - 1].rating) - 8} textAnchor="end" fontSize="10" fontWeight="700" fill="#111827">
        {history[history.length - 1].rating}
      </text>
    </svg>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function CodingAnalyticsPage() {
  // Coding Analytics has no dedicated permission id in the modal, so the
  // page-level gate falls back to "any student permission" — a user with
  // either studentdashboard or student-courses can open it.
  const { canAny, isReady: permsReady } = usePermissions();
  const canOpen = canAny([PERMISSION_IDS.STUDENT_DASHBOARD, PERMISSION_IDS.STUDENT_COURSES]);

  const [platform, setPlatform] = useState<PlatformKey>('leetcode');
  const [range, setRange] = useState<RangeKey>('30D');
  const [report, setReport] = useState<PlatformReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [solvedPage, setSolvedPage] = useState(1);
  const SOLVED_PER_PAGE = 10;
  const cache = useRef<Partial<Record<PlatformKey, PlatformReport>>>({});
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSolvedPage(1); }, [platform]);

  const load = useCallback(async (p: PlatformKey, force = false) => {
    setError(null);
    if (!force && cache.current[p]) { setReport(cache.current[p]!); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await fetchPlatformReport(p);
      cache.current[p] = r;
      setReport(r);
    } catch (e: any) {
      setReport(null);
      setError(e?.message === 'NOT_CONNECTED' ? 'NOT_CONNECTED' : e?.message || 'Could not load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(platform); }, [platform, load]);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [pickerOpen]);

  const meta = PLATFORM_META[platform];
  const days = RANGES.find((r) => r.key === range)!.days;
  const notConnected = error === 'NOT_CONNECTED';

  if (!permsReady) {
    return (
      <StudentLayout>
        <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-5" />
      </StudentLayout>
    );
  }

  if (!canOpen) {
    return (
      <StudentLayout>
        <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-16">
          <Card className="py-14 text-center">
            <AlertCircle size={28} className="mx-auto text-gray-300" />
            <h2 className="mt-3 text-[15px] font-semibold text-gray-900">No access</h2>
            <p className="mt-1 text-[12.5px] text-gray-500 max-w-md mx-auto">
              You don&apos;t have permission to view Coding Analytics.
            </p>
            <p className="mt-2 text-[11px] text-gray-400">
              Contact your administrator to request access.
            </p>
          </Card>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="mx-auto max-w-[1200px] px-4 md:px-6 py-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap mb-5 pr-12">
          <div>
            <h1 className="text-[20px] font-semibold text-gray-900 tracking-[-0.02em]">Coding Analytics</h1>
            <p className="text-[12.5px] text-gray-500 mt-0.5">Track your coding activity and problem-solving progress</p>
            <div className="mt-1.5 h-5">
              {loading ? (
                <Skeleton className="h-4 w-44" />
              ) : report ? (
                <a href={report.profileUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-gray-600 hover:text-gray-900">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Connected as @{report.username}
                  <ExternalLink size={11} className="text-gray-400" />
                </a>
              ) : null}
            </div>
          </div>

          {/* Platform selector */}
          <div ref={pickerRef} className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className={`inline-flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg border bg-white text-[13px] font-semibold text-gray-900 transition-colors ${pickerOpen ? 'border-orange-400 ring-2 ring-orange-100' : 'border-gray-200 hover:border-gray-300'}`}
              aria-haspopup="listbox" aria-expanded={pickerOpen}
            >
              <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">Platform</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                {meta.name}
              </span>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {pickerOpen && (
              <div role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-50 w-52 rounded-xl border border-gray-200 bg-white shadow-lg p-1">
                {PLATFORMS.map((p) => {
                  const m = PLATFORM_META[p];
                  const on = p === platform;
                  const connected = !!CODING_ACCOUNTS[p];
                  return (
                    <button
                      key={p} type="button" role="option" aria-selected={on}
                      onClick={() => { setPickerOpen(false); if (p !== platform) setPlatform(p); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12.5px] font-medium text-left transition-colors ${on ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-50'}`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: m.color }} />
                      {m.name}
                      {!connected && <span className="ml-auto text-[10px] text-gray-400">not connected</span>}
                      {on && connected && <Check size={14} className="ml-auto text-orange-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Not-connected / error states ── */}
        {!loading && notConnected && (
          <Card className="py-14 text-center">
            <Code2 size={28} className="mx-auto text-gray-300" />
            <h2 className="mt-3 text-[15px] font-semibold text-gray-900">{meta.name} account not connected</h2>
            <p className="mt-1 text-[12.5px] text-gray-500">Connect your {meta.name} account to view your coding progress here.</p>
            <button type="button" className="mt-4 h-9 px-4 rounded-lg bg-gray-900 text-white text-[12.5px] font-semibold hover:bg-gray-800">
              Connect {meta.name}
            </button>
          </Card>
        )}
        {!loading && error && !notConnected && (
          <Card className="py-12 text-center">
            <AlertCircle size={26} className="mx-auto text-rose-400" />
            <h2 className="mt-3 text-[14px] font-semibold text-gray-900">Couldn't load {meta.name} data</h2>
            <p className="mt-1 text-[12px] text-gray-500 max-w-md mx-auto">{error}</p>
            <button type="button" onClick={() => load(platform, true)}
              className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-gray-200 text-[12.5px] font-semibold text-gray-700 hover:bg-gray-50">
              <RefreshCw size={13} /> Retry
            </button>
          </Card>
        )}

        {(loading || (!error && report)) && (
          <>
            {/* ── Metric cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
              {(loading ? Array.from({ length: 6 }) : report!.metrics).map((m: any, i) => (
                <Card key={loading ? i : m.key} className="px-4 py-3.5">
                  {loading ? (
                    <><Skeleton className="h-3 w-20 mb-2.5" /><Skeleton className="h-6 w-16" /></>
                  ) : (
                    <>
                      <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-gray-500">{m.label}</p>
                      <p className="mt-1.5 text-[20px] font-bold text-gray-900 tracking-[-0.02em] leading-none truncate" title={m.value}>{m.value}</p>
                      {m.sub && <p className="mt-1 text-[11px] font-medium text-gray-500 truncate" title={m.sub}>{m.sub}</p>}
                    </>
                  )}
                </Card>
              ))}
            </div>

            {/* ── Analytics: progress + difficulty ── */}
            <div className="grid lg:grid-cols-[1.6fr_1fr] gap-3 mb-4">
              <Card>
                <CardHead
                  title="Problem Solving Progress"
                  sub="Accepted submissions over time"
                  right={
                    <div className="inline-flex items-center rounded-lg border border-gray-200 p-0.5">
                      {RANGES.map((r) => (
                        <button key={r.key} type="button" onClick={() => setRange(r.key)}
                          className={`h-6 px-2 rounded-[6px] text-[11px] font-semibold transition-colors ${range === r.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'}`}>
                          {r.key}
                        </button>
                      ))}
                    </div>
                  }
                />
                {loading ? <div className="px-5 pb-5"><Skeleton className="h-[150px] w-full" /></div>
                  : report!.activity === null ? <SectionEmpty text={`${meta.name} doesn't expose a submission timeline.`} />
                  : report!.activity.length === 0 ? <SectionEmpty text="No submissions yet." />
                  : <ActivityChart series={report!.activity} days={days} />}
              </Card>

              <Card>
                <CardHead title="Difficulty Distribution" sub="Solved problems by difficulty" />
                {loading ? <div className="px-5 pb-5"><Skeleton className="h-[120px] w-full" /></div>
                  : report!.difficulty === null ? <SectionEmpty text={`${meta.name} doesn't categorise problems by difficulty.`} />
                  : <DifficultyDonut d={report!.difficulty} />}
              </Card>
            </div>

            {/* ── Skills ── */}
            <Card className="mb-4">
              <CardHead title="Problem Solving Skills" sub={platform === 'hackerrank' ? 'Badge tracks' : 'Most-solved problem tags'} />
              {loading ? (
                <div className="px-5 pb-5 grid md:grid-cols-2 gap-x-8 gap-y-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
                </div>
              ) : report!.topics === null ? (
                <SectionEmpty text={`${meta.name} doesn't expose per-topic tags.`} />
              ) : (
                <div className="px-5 pb-5 grid md:grid-cols-2 gap-x-8 gap-y-2.5">
                  {(() => {
                    const maxT = Math.max(1, ...report!.topics!.map((t) => t.solved));
                    return report!.topics!.map((t) => (
                      <div key={t.name} className="flex items-center gap-3">
                        <span className="w-40 shrink-0 text-[12px] font-medium text-gray-700 truncate" title={t.name}>{t.name}</span>
                        <span className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <span className="block h-full rounded-full bg-orange-500/90" style={{ width: `${(t.solved / maxT) * 100}%` }} />
                        </span>
                        <b className="w-8 text-right text-[12px] tabular-nums text-gray-900">{t.solved}</b>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </Card>

            {/* ── Recent submissions ── */}
            <Card className="mb-4">
              <CardHead title="Recent Submissions" />
              {loading ? (
                <div className="px-5 pb-5 grid gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : report!.recent === null ? (
                <SectionEmpty text={`${meta.name} doesn't expose a public submission feed.`} />
              ) : report!.recent.length === 0 ? (
                <SectionEmpty text="No submissions yet." />
              ) : (
                <div className="overflow-x-auto pb-2">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[10.5px] uppercase tracking-[0.06em] text-gray-500">
                        <th className="font-semibold px-5 py-2">Problem</th>
                        <th className="font-semibold px-3 py-2">Difficulty</th>
                        <th className="font-semibold px-3 py-2">Language</th>
                        <th className="font-semibold px-3 py-2">Verdict</th>
                        <th className="font-semibold px-3 py-2">Time</th>
                        <th className="font-semibold px-3 py-2 pr-5">Platform</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report!.recent.map((s, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/70 transition-colors">
                          <td className="px-5 py-2.5 font-medium text-gray-900 max-w-[280px] truncate">
                            {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-orange-600">{s.title}</a> : s.title}
                          </td>
                          <td className="px-3 py-2.5">
                            {s.difficulty ? <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${DIFF_TONE[s.difficulty] || 'bg-slate-100 text-slate-600'}`}>{s.difficulty}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-700">{s.lang}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ring-inset ${VERDICT_TONE[s.verdict]}`}>{s.verdictLabel}</span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-gray-600 whitespace-nowrap">{timeAgo(s.when)}</td>
                          <td className="px-3 py-2.5 pr-5 font-medium text-gray-600">{meta.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* ── Solved problems + contest ── */}
            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-3">
              <Card>
                <CardHead
                  title="Solved Problems"
                  sub={!loading && report?.solved?.length
                    ? (platform === 'leetcode'
                      ? `${report.solved.length} most recent (LeetCode exposes only recent solves publicly)`
                      : `${report.solved.length} problems`)
                    : 'Most recently solved'}
                  right={!loading && report ? (
                    <a href={report.profileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[11.5px] font-semibold text-orange-600 hover:text-orange-700 whitespace-nowrap">
                      View All Problems →
                    </a>
                  ) : undefined}
                />
                {loading ? (
                  <div className="px-5 pb-5 grid gap-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}</div>
                ) : report!.solved === null ? (
                  <SectionEmpty text={`${meta.name} doesn't expose a public solved-problems list.`} />
                ) : report!.solved.length === 0 ? (
                  <SectionEmpty text="Nothing solved yet." />
                ) : (() => {
                  const all = report!.solved!;
                  const totalPages = Math.max(1, Math.ceil(all.length / SOLVED_PER_PAGE));
                  const page = Math.min(solvedPage, totalPages);
                  const start = (page - 1) * SOLVED_PER_PAGE;
                  const shown = all.slice(start, start + SOLVED_PER_PAGE);
                  return (
                    <>
                      <div className="px-2 pb-1">
                        {shown.map((p) => (
                          <div key={p.n} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <span className="w-7 text-[11px] font-medium tabular-nums text-gray-500">{p.n}.</span>
                            <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-gray-900 truncate">
                              {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="hover:text-orange-600">{p.title}</a> : p.title}
                            </span>
                            {p.difficulty && <span className={`inline-flex px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${DIFF_TONE[p.difficulty] || 'bg-slate-100 text-slate-600'}`}>{p.difficulty}</span>}
                            {p.topic && <span className="hidden md:inline text-[11px] font-medium text-gray-500 truncate max-w-[110px]">{p.topic}</span>}
                            {p.lang && <span className="text-[11px] font-medium text-gray-600">{p.lang}</span>}
                            <span className="text-[11px] font-medium text-gray-500 whitespace-nowrap">{timeAgo(p.when)}</span>
                          </div>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-gray-100">
                          <span className="text-[11.5px] font-medium text-gray-600">
                            Showing {start + 1}–{Math.min(start + SOLVED_PER_PAGE, all.length)} of {all.length}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <button type="button" disabled={page === 1} onClick={() => setSolvedPage(page - 1)}
                              className="h-7 px-2.5 rounded-lg border border-gray-200 text-[11.5px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                              Prev
                            </button>
                            {pageItems(page, totalPages).map((p, i) => p === '…'
                              ? <span key={`e${i}`} className="w-7 text-center text-[11.5px] text-gray-500">…</span>
                              : (
                                <button key={p} type="button" onClick={() => setSolvedPage(p)}
                                  className={`h-7 w-7 rounded-lg text-[11.5px] font-semibold ${p === page ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                                  {p}
                                </button>
                              ))}
                            <button type="button" disabled={page === totalPages} onClick={() => setSolvedPage(page + 1)}
                              className="h-7 px-2.5 rounded-lg border border-gray-200 text-[11.5px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed">
                              Next
                            </button>
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </Card>

              <Card>
                <CardHead title="Contest Performance" sub="Rating and participation" />
                {loading ? (
                  <div className="px-5 pb-5"><Skeleton className="h-[130px] w-full mb-3" /><Skeleton className="h-10 w-full" /></div>
                ) : report!.contest === null ? (
                  <SectionEmpty text={`No contest data on ${meta.name} for this account.`} />
                ) : (
                  <div className="px-5 pb-5">
                    {report!.contest.history.length >= 2 && <RatingChart history={report!.contest.history} />}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3">
                      {[
                        { k: 'Current rating', v: report!.contest.rating !== null ? String(report!.contest.rating) : 'Unrated' },
                        { k: 'Maximum rating', v: report!.contest.maxRating !== null ? String(report!.contest.maxRating) : '—' },
                        { k: 'Contests', v: String(report!.contest.count) },
                        { k: 'Best rank', v: report!.contest.bestRank !== null && report!.contest.bestRank !== undefined ? `#${report!.contest.bestRank.toLocaleString('en-IN')}` : '—' },
                      ].map((s) => (
                        <div key={s.k}>
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-gray-500">{s.k}</p>
                          <p className="mt-0.5 text-[15px] font-bold text-gray-900 tabular-nums">{s.v}</p>
                        </div>
                      ))}
                    </div>
                    {report!.contest.count === 0 && (
                      <p className="mt-3 text-[11.5px] text-gray-400 flex items-center gap-1.5"><Trophy size={12} /> No contests attended yet.</p>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {!loading && report && (
              <p className="mt-4 text-[11px] font-medium text-gray-500 text-right">
                Live from {meta.name} · fetched {timeAgo(report.fetchedAt)} ·{' '}
                <button type="button" onClick={() => load(platform, true)} className="underline hover:text-gray-700">refresh</button>
              </p>
            )}
          </>
        )}
      </div>
    </StudentLayout>
  );
}
