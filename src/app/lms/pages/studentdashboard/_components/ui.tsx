'use client';

// Shared visual primitives for the Student Dashboard.
// One card shell, one ring, one bar — so every widget inherits the same
// radius, border, shadow and spacing without repeating the class soup.

import React from 'react';
import { cn } from '@/lib/utils';

/* ── design tokens ───────────────────────────────────────────────────────── */

export const C = {
    primary: '#4F46E5',
    primarySoft: '#EEF2FF',
    success: '#22C55E',
    successSoft: '#F0FDF4',
    warning: '#F97316',
    warningSoft: '#FFF7ED',
    danger: '#EF4444',
    dangerSoft: '#FEF2F2',
    info: '#0EA5E9',
    infoSoft: '#F0F9FF',
    violet: '#8B5CF6',
    violetSoft: '#F5F3FF',
    line: '#E5E7EB',
    surface: '#F8FAFC',
    ink: '#0F172A',
    muted: '#64748B',
    faint: '#94A3B8',
} as const;

/* ── card shell ──────────────────────────────────────────────────────────── */

export const Card = ({
    className, children, padded = true, ...rest
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean }) => (
    <div
        {...rest}
        className={cn(
            'rounded-[20px] border border-[#E5E7EB] bg-white',
            'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-16px_rgba(16,24,40,0.16)]',
            'transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_18px_36px_-18px_rgba(16,24,40,0.22)]',
            'dark:bg-gray-900 dark:border-gray-800',
            padded && 'p-5',
            className,
        )}
    >
        {children}
    </div>
);

export const CardHead = ({
    title, subtitle, action, icon,
}: {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    icon?: React.ReactNode;
}) => (
    <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
            {icon}
            <div className="min-w-0">
                <h3 className="truncate text-md font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">{title}</h3>
                {subtitle && <p className="mt-0.5 truncate text-xs text-slate-400">{subtitle}</p>}
            </div>
        </div>
        {action}
    </div>
);

export const HeadLink = ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button
        onClick={onClick}
        className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
    >
        {label}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
    </button>
);

/* ── icon container ──────────────────────────────────────────────────────── */

export const IconBox = ({
    children, tint, size = 40, radius,
}: { children: React.ReactNode; tint: string; size?: number; radius?: number }) => (
    <div
        className="flex shrink-0 items-center justify-center"
        style={{
            width: size,
            height: size,
            borderRadius: radius ?? Math.round(size * 0.33),
            backgroundColor: `${tint}14`,
            color: tint,
        }}
    >
        {children}
    </div>
);

/* ── linear progress ─────────────────────────────────────────────────────── */

export const Bar = ({
    value, color = C.primary, height = 6, track = '#F1F5F9',
}: { value: number; color?: string; height?: number; track?: string }) => (
    <div className="w-full overflow-hidden rounded-full dark:bg-gray-800" style={{ height, backgroundColor: track }}>
        <div
            className="h-full rounded-full"
            style={{
                width: `${Math.max(0, Math.min(100, value))}%`,
                backgroundColor: color,
                transition: 'width 900ms cubic-bezier(0.22,1,0.36,1)',
            }}
        />
    </div>
);

/* ── donut ───────────────────────────────────────────────────────────────── */

export interface DonutSlice { label: string; value: number; color: string }

export const Donut = ({
    slices, size = 168, thickness = 26, center,
}: { slices: DonutSlice[]; size?: number; thickness?: number; center?: React.ReactNode }) => {
    const total = slices.reduce((a, s) => a + s.value, 0);
    const r = (size - thickness) / 2;
    const circumference = 2 * Math.PI * r;
    let offset = 0;

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={thickness} />
                {total > 0 && slices.map((s, i) => {
                    if (s.value <= 0) return null;
                    const len = (s.value / total) * circumference;
                    const el = (
                        <circle
                            key={i}
                            cx={size / 2} cy={size / 2} r={r} fill="none"
                            stroke={s.color} strokeWidth={thickness}
                            strokeDasharray={`${Math.max(len - 2, 0)} ${circumference - Math.max(len - 2, 0)}`}
                            strokeDashoffset={-offset}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)' }}
                        />
                    );
                    offset += len;
                    return el;
                })}
            </svg>
            {center && <div className="absolute inset-0 flex flex-col items-center justify-center">{center}</div>}
        </div>
    );
};

/* ── small pieces ────────────────────────────────────────────────────────── */

export const Tag = ({
    label, color, soft,
}: { label: string; color: string; soft?: string }) => (
    <span
        className="inline-flex shrink-0 items-center rounded-full px-2 py-[3px] text-2xs font-semibold leading-none"
        style={{ backgroundColor: soft || `${color}14`, color }}
    >
        {label}
    </span>
);

export const Dot = ({ color }: { color: string }) => (
    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
);

export const Empty = ({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) => (
    <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-slate-300 dark:bg-gray-800">{icon}</div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        {hint && <p className="mt-1 max-w-[240px] text-xs text-slate-400">{hint}</p>}
    </div>
);

/* ── avatar built from a name ────────────────────────────────────────────── */

const AVATAR_TINTS = [C.primary, C.info, C.violet, C.success, C.warning];

export const NameAvatar = ({ name, size = 34 }: { name: string; size?: number }) => {
    const initials = name.split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
    const tint = AVATAR_TINTS[(name.charCodeAt(0) || 0) % AVATAR_TINTS.length];
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-[11px] font-bold"
            style={{ width: size, height: size, backgroundColor: `${tint}14`, color: tint, fontSize: size * 0.36 }}
        >
            {initials}
        </div>
    );
};
