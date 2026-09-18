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

export const isWeekend = (d: Date) => {
    const w = d.getUTCDay();
    return w === 0 || w === 6;
};

export const startOfMonth = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

export const todayUtcDate = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

// Show 13.5 as "13.5" but 13.0 as "13" in the present/working fractions.
export const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// ── Performance scale — attendance % → qualitative band ────────────────────
// Attendance % = (Days Present + ½ × Half-days) ÷ Total Working Days × 100.
export type Band = {
    key: string;
    label: string;
    min: number;
    range: string;
    text: string;   // text colour
    chip: string;   // badge bg + border
    dot: string;    // legend dot
    bar: string;    // distribution bar fill
    hex: string;    // for PDF export
};
export const BANDS: Band[] = [
    { key: "excellent", label: "Excellent", min: 90, range: "90–100%", text: "text-emerald-700", chip: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500", hex: "#10b981" },
    { key: "good",      label: "Good",      min: 75, range: "75–89%",  text: "text-sky-700",     chip: "bg-sky-50 border-sky-200",         dot: "bg-sky-500",     bar: "bg-sky-500",     hex: "#0ea5e9" },
    { key: "average",   label: "Average",   min: 60, range: "60–74%",  text: "text-amber-700",   chip: "bg-amber-50 border-amber-200",     dot: "bg-amber-500",   bar: "bg-amber-500",   hex: "#f59e0b" },
    { key: "poor",      label: "Poor",      min: 40, range: "40–59%",  text: "text-orange-700",  chip: "bg-orange-50 border-orange-200",   dot: "bg-orange-500",  bar: "bg-orange-500",  hex: "#f97316" },
    { key: "critical",  label: "Critical",  min: 0,  range: "Below 40%", text: "text-red-700",   chip: "bg-red-50 border-red-200",         dot: "bg-red-500",     bar: "bg-red-500",     hex: "#ef4444" },
];
export const bandOf = (pct: number): Band =>
    BANDS.find((b) => pct >= b.min) ?? BANDS[BANDS.length - 1];

// ── Types ──────────────────────────────────────────────────────────────────
export type Student = {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    userId?: string;
};

export type StatusFilter = "all" | "P" | "A" | "H" | "N"; // N = Not Marked
export type ViewMode = "daily" | "summary";
/** "all" means every student in the roster; a list of ids narrows to that
 *  subset. An empty list is treated as "all" so the report never accidentally
 *  goes blank when the picker is cleared. */
export type StudentFilter = "all" | string[];

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
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</div>
        <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-wider text-gray-500 font-medium">{label}</div>
            <div className="text-[15px] font-semibold text-gray-900 mt-0.5">
                {value}{" "}
                {sub && <span className="text-[11px] text-gray-500 font-medium">{sub}</span>}
            </div>
        </div>
    </div>
);

export const InsightTile: React.FC<{
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: string;
    sub?: string;
}> = ({ icon, iconBg, label, value, sub }) => (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
        </div>
        <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-wider text-gray-500 font-medium">{label}</div>
            <div className="text-[13px] font-semibold text-gray-900 truncate mt-0.5">{value}</div>
            {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
        </div>
    </div>
);

export const StatusPill: React.FC<{ status?: "P" | "A" | "H" }> = ({ status }) => {
    if (!status) {
        return (
            <span className="inline-block w-8 h-6 rounded-md bg-gray-50 border border-gray-200 text-gray-400 text-[11px] leading-6">
                –
            </span>
        );
    }
    const map: Record<string, string> = {
        P: "bg-emerald-50 border-emerald-200 text-emerald-700",
        A: "bg-red-50 border-red-200 text-red-700",
        H: "bg-amber-50 border-amber-200 text-amber-700",
    };
    return (
        <span className={`inline-block w-8 h-6 rounded-md border text-[11px] font-semibold leading-6 ${map[status]}`}>
            {status}
        </span>
    );
};

export const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="text-[13px] font-semibold text-gray-900 mb-3">{title}</div>
        {children}
    </div>
);

export const LegendRow: React.FC<{ color: string; label: string; value: string }> = ({ color, label, value }) => (
    <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-gray-700">
            <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
        </span>
        <span className="text-gray-600 font-medium">{value}</span>
    </div>
);

export const labelForStatus = (s: StatusFilter) => {
    if (s === "P") return "Present";
    if (s === "A") return "Absent";
    if (s === "H") return "Half-day";
    if (s === "N") return "Not Marked";
    return "All";
};
