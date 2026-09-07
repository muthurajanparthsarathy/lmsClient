'use client';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LucideIcon, Search, AlertTriangle, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// Shared enterprise page primitives for the Super Admin module. Kept local to
// the module (per the zero-regression rule — no edits to shared LMS
// components), built on the same design tokens as the rest of the app, and
// layered with the console's design-system v2 (elevation, motion, semantic
// status color) from superadmin-theme.css.

export function PageHeader({
  title,
  actions,
}: {
  title: string;
  /** Accepted but no longer rendered — one heading alone, no sub-text. */
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    // Title sized like the L&D console's page headers (17px/700).
    <div className="sa-fade-in mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-[17px] font-bold tracking-[-0.02em] text-[#111827]">{title}</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, icon: Icon }: { children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
      {Icon && <Icon className="h-4 w-4 text-primary" />}
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  accent = 'bg-primary/10 text-primary',
}: {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: string;
  trend?: { value: string; direction: 'up' | 'down' | 'flat' };
  accent?: string;
}) {
  const trendColor =
    trend?.direction === 'up' ? 'text-[var(--success-fg)]' : trend?.direction === 'down' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className="sa-hover-lift sa-elevate-1 group rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight text-foreground">{value}</p>
          {(hint || trend) && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              {trend && <span className={cn('font-medium', trendColor)}>{trend.value}</span>}
              {hint}
            </p>
          )}
        </div>
        <div className={cn('sa-transition flex h-10 w-10 shrink-0 items-center justify-center rounded-lg group-hover:scale-105', accent)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// Metric card — icon in a soft tile on the left, label + big value + a small
// colored caption. The stat-card style used across the console list pages.
export function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  iconClass = 'bg-primary/10 text-primary',
  captionClass = 'text-muted-foreground',
  compact = false,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  iconClass?: string;
  captionClass?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('sa-hover-lift sa-elevate-1 flex items-center rounded-xl border border-border bg-card', compact ? 'gap-3 p-3.5' : 'gap-4 p-5')}>
      <div className={cn('flex shrink-0 items-center justify-center', compact ? 'h-9 w-9 rounded-lg' : 'h-12 w-12 rounded-xl', iconClass)}>
        <Icon className={compact ? 'h-5 w-5' : 'h-6 w-6'} />
      </div>
      <div className="min-w-0">
        <p className={cn('truncate text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>{label}</p>
        <p className={cn('font-semibold leading-tight tracking-tight text-foreground', compact ? 'text-xl' : 'text-[26px]')}>{value}</p>
        {caption != null && <p className={cn('truncate font-medium', compact ? 'text-[11px]' : 'text-xs', captionClass)}>{caption}</p>}
      </div>
    </div>
  );
}

// Table toolbar — search on the left, filter/action controls on the right.
// Sits inside a Panel, directly above the table.
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {children}
    </div>
  );
}

// Small outline icon button for toolbars (Filter, Refresh, ...).
export function ToolbarIconButton({
  icon: Icon,
  label,
  onClick,
  spinning,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  spinning?: boolean;
}) {
  return (
    <Button variant="outline" size="icon" className="h-9 w-9" title={label} aria-label={label} onClick={onClick}>
      <Icon className={cn('h-4 w-4', spinning && 'animate-spin')} />
    </Button>
  );
}

export function RefreshButton({ onClick, spinning }: { onClick?: () => void; spinning?: boolean }) {
  return <ToolbarIconButton icon={RefreshCw} label="Refresh" onClick={onClick} spinning={spinning} />;
}

// ── Column sorting ─────────────────────────────────────────────────────────
// useSort returns the sorted array plus header state. Pass an accessor map so
// the hook stays type-agnostic. Put <SortLabel/> inside each <TableHead/>.
export function useSort<T>(items: T[], accessors: Record<string, (item: T) => string | number>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = useCallback((key: string) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey || !accessors[sortKey]) return items;
    const acc = accessors[sortKey];
    const arr = [...items].sort((a, b) => {
      const av = acc(a);
      const bv = acc(b);
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    });
    return sortDir === 'asc' ? arr : arr.reverse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}

export function SortLabel({
  label,
  sortKey: key,
  activeKey,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: string;
  activeKey: string | null;
  dir: 'asc' | 'desc';
  onSort: (key: string) => void;
  align?: 'left' | 'right';
}) {
  const active = activeKey === key;
  const Icon = !active ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(key)}
      className={cn(
        'inline-flex select-none items-center gap-1 transition-colors hover:text-foreground',
        align === 'right' && 'flex-row-reverse'
      )}
    >
      {label}
      <Icon className={cn('h-3 w-3', active ? 'text-foreground' : 'text-muted-foreground/40')} />
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sa-fade-in flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Panel({
  className,
  children,
  title,
  actions,
}: {
  className?: string;
  children: React.ReactNode;
  title?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={cn('sa-elevate-1 sa-fade-in overflow-hidden rounded-xl border border-border bg-card', className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

// Branded native select — lightweight, keyboard-friendly, styled with the
// console tokens. Used for the Institution/Role pickers.
export function FieldSelect({
  value,
  onChange,
  disabled,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        'sa-transition h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none',
        'hover:border-ring/40',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    >
      {children}
    </select>
  );
}

// Status badge — meaning is never color-only: each status also gets a small
// dot + label text (WCAG: don't rely on hue alone).
type Status = 'success' | 'warning' | 'info' | 'danger' | 'neutral';
const STATUS_STYLES: Record<Status, string> = {
  success: 'bg-[var(--success-bg)] text-[var(--success-fg)]',
  warning: 'bg-[var(--warning-bg)] text-[var(--warning-fg)]',
  info: 'bg-[var(--info-bg)] text-[var(--info-fg)]',
  danger: 'bg-[var(--danger-bg)] text-[var(--danger-fg)]',
  neutral: 'bg-muted text-muted-foreground',
};
const STATUS_DOT: Record<Status, string> = {
  success: 'bg-[var(--success)]',
  warning: 'bg-[var(--warning)]',
  info: 'bg-[var(--info)]',
  danger: 'bg-destructive',
  neutral: 'bg-muted-foreground',
};

export function StatusBadge({ status, children }: { status: Status; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLES[status])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {children}
    </span>
  );
}

// Toolbar search input — client-side filter, no API changes. Pages own the
// filtering logic; this is purely presentational + debounced-free (small
// datasets) input.
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}

// ── Dense "list" table styling — small tracked-uppercase headers, tighter
// rows. Pages pass these as className on the shadcn Table primitives instead
// of the default (larger, unstyled-header) look, which read as a generic bare
// HTML table rather than a refined list.
export const tableHeadClass = 'h-8 bg-muted/40 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:rounded-tl-xl';
export const tableCellClass = 'px-3 py-1.5 text-[13px] leading-tight';
export const tableRowClass = 'group';

// Compact identity chip used in the first column of most tables — replaces
// the previous 8x8 avatar + two stacked lines with generous padding, which
// alone was ~40% of each row's height.
export function RowIdentity({ initial, primary, secondary }: { initial: string; primary: React.ReactNode; secondary?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
        {initial.toUpperCase()}
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate font-medium text-foreground">{primary}</div>
        {secondary && <div className="truncate text-[11px] text-muted-foreground">{secondary}</div>}
      </div>
    </div>
  );
}

// Actions stay visible at all times — hiding admin actions (deactivate/
// delete) until hover made them undiscoverable and broke entirely on touch
// devices. Ghost-button styling already keeps them visually quiet without
// hiding them outright.
export function RowActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex justify-end gap-0.5 [&_button]:h-7 [&_button]:w-7', className)}>
      {children}
    </div>
  );
}

// ── Density-aware page size — measures the space between the table's top and
// the bottom of the viewport, then fits exactly as many rows as will show
// without scrolling. Big monitors fill up (no wasted space); small screens
// shrink (no page scroll). Overflow rows go to page 2+. Attach `anchorRef` to
// the table's wrapper so we know where the rows start.
export function useFitPageSize({ rowHeight = 41, reservedBelow = 108, min = 4, max = 100 } = {}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // reservedBelow covers the sticky table header + pagination bar + margin.
      const available = window.innerHeight - top - reservedBelow;
      const fit = Math.floor(available / rowHeight);
      setPageSize(Math.max(min, Math.min(max, fit)));
    };
    compute();
    window.addEventListener('resize', compute);
    const t = setTimeout(compute, 150); // after fonts/layout settle
    return () => { window.removeEventListener('resize', compute); clearTimeout(t); };
  }, [rowHeight, reservedBelow, min, max]);

  return { anchorRef, pageSize };
}

// ── Client-side pagination — no API changes, just slices an already-fetched
// array. Small SaaS admin lists (tens to a few hundred rows) don't need
// server-side paging; this keeps every table's UX consistent.
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  return {
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    rangeStart: items.length === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, items.length),
    total: items.length,
  };
}

// Windowed page-number list with ellipses, e.g. [1, '…', 4, 5, 6, '…', 20].
function pageList(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push('…');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push('…');
  pages.push(totalPages);
  return pages;
}

export function PaginationBar({
  rangeStart,
  rangeEnd,
  total,
  page,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: {
  rangeStart: number;
  rangeEnd: number;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}) {
  if (total === 0) return null;
  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{rangeStart}</span> to{' '}
        <span className="font-medium text-foreground">{rangeEnd}</span> of{' '}
        <span className="font-medium text-foreground">{total}</span> entries
      </p>

      <div className="flex items-center gap-2">
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pageList(page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'outline'}
                  size="icon"
                  className="h-8 w-8 text-xs"
                  onClick={() => onPageChange(p)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </Button>
              )
            )}
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {pageSize != null && onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="sa-transition h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none hover:border-ring/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

// ── Branded confirmation dialog — replaces window.confirm() ────────────────
// Native confirm() is jarring, unbranded, and not screen-reader friendly.
// useConfirm() gives the same simple async ergonomics
// (`if (await confirm('...')) { doIt() }`) but renders an accessible,
// on-brand dialog. Mount <ConfirmHost/> once per page that calls confirm().
interface ConfirmOptions {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const opts: ConfirmOptions = typeof options === 'string' ? { description: options } : options;
    setState({ ...opts, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handle = (result: boolean) => {
    setState((s) => (s ? { ...s, open: false } : s));
    resolver.current?.(result);
  };

  const ConfirmHost = () => (
    <Dialog open={!!state?.open} onOpenChange={(o) => !o && handle(false)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div
            className={cn(
              'mb-1 flex h-10 w-10 items-center justify-center rounded-full',
              state?.destructive ? 'bg-[var(--danger-bg)] text-destructive' : 'bg-primary/10 text-primary'
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>{state?.title || 'Are you sure?'}</DialogTitle>
          <DialogDescription>{state?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => handle(false)}>{state?.cancelLabel || 'Cancel'}</Button>
          <Button variant={state?.destructive ? 'destructive' : 'default'} onClick={() => handle(true)}>
            {state?.confirmLabel || 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, ConfirmHost };
}
