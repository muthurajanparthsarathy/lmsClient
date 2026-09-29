"use client";

import { ReactNode } from "react";

/**
 * Shared chrome for every POC console page: page title, subtitle, and the
 * three states a scoped page can be in (loading / empty / content).
 *
 * `PocEmpty` exists as its own component because for a POC the empty state is
 * the DEFAULT, not an edge case — a POC sees it until an admin enrols them into
 * a course. It must never be swapped for unscoped data as a "better than
 * nothing" fallback; that is precisely the leak the whole feature prevents.
 */

export function PocPage({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="px-6 py-6 max-md:px-4">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 pr-28">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-heading">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>
        {actions}
      </header>
      {children}
    </div>
  );
}

export function PocEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline bg-surface-sunken px-6 py-16 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted shadow-xs">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 7h18M3 12h18M3 17h10" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-heading">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>
      <p className="mt-4 text-xs text-muted">
        Need access?{" "}
        <a href="mailto:support@smartcliff.com" className="underline">
          support@smartcliff.com
        </a>
      </p>
    </div>
  );
}

export function PocLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl border border-hairline bg-surface-sunken" />
      ))}
    </div>
  );
}

export function PocError({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-sunken px-5 py-4 text-sm text-body">
      <span className="font-medium">Could not load this page.</span> {message}
    </div>
  );
}

export function PocStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-4 py-3.5 shadow-xs">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-heading">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function PocTable({
  head,
  children,
}: {
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-surface shadow-xs">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-hairline text-left">
            {head.map((h) => (
              <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
