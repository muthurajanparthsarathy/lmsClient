"use client";

import React from "react";

// ── Helpers ────────────────────────────────────────────────────────────────
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const toDayKey = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

export const parseKey = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

export const fmt = (d: Date) => {
    const day = d.getUTCDate();
    const mon = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    const yr = d.getUTCFullYear();
    return `${String(day).padStart(2, "0")}-${mon}-${yr}`;
};

export const fmtWeekday = (d: Date) =>
    d.toLocaleString("en-GB", { weekday: "short", timeZone: "UTC" });

export const dayUtc = (v: Date | string) => {
    const d = typeof v === "string" ? new Date(v) : v;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);

export const startOfWeekMon = (input?: Date) => {
    const d = input ? new Date(input) : new Date();
    const utc = dayUtc(d);
    const dow = utc.getUTCDay();
    const shift = dow === 0 ? -6 : 1 - dow;
    return new Date(utc.getTime() + shift * MS_PER_DAY);
};

// ── Types ──────────────────────────────────────────────────────────────────
export type Student = {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    userId?: string;
};

export type StudentFilter = "all" | string;
export type TrendMode = "daily" | "cumulative";
export type DayMode = "percent" | "count";

// ── UI helpers ─────────────────────────────────────────────────────────────
export const FilterField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
        {children}
    </div>
);

export const StatCard: React.FC<{
    iconBg: string;
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
}> = ({ iconBg, icon, label, value, sub }) => (
    <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            {icon}
        </div>
        <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium truncate">{label}</div>
            <div className="text-[15px] font-semibold text-gray-900 mt-0.5 truncate">{value}</div>
            {sub && <div className="text-[10.5px] text-gray-500 truncate">{sub}</div>}
        </div>
    </div>
);

export const ChartCard: React.FC<{
    title: string;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, headerRight, children }) => (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-semibold text-gray-900">{title}</div>
            {headerRight}
        </div>
        {children}
    </div>
);

export const ToggleGroup: React.FC<{
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
    <div className="flex items-center bg-gray-100 rounded-md p-0.5 text-[11px] font-medium">
        {options.map((o) => (
            <button
                key={o.value}
                onClick={() => onChange(o.value)}
                className={`px-2.5 py-1 rounded transition ${
                    value === o.value ? "bg-white shadow text-indigo-700" : "text-gray-600"
                }`}
            >
                {o.label}
            </button>
        ))}
    </div>
);

export const DistRow: React.FC<{
    color: string;
    label: string;
    count: number;
    total: number;
}> = ({ color, label, count, total }) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-gray-700 font-medium">
                <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
            </span>
            <span className="text-gray-800 font-semibold">
                {count} <span className="text-[10.5px] text-gray-500 font-normal">({pct.toFixed(2)}%)</span>
            </span>
        </div>
    );
};
