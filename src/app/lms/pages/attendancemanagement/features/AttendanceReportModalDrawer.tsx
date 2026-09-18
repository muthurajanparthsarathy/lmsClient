"use client";

import {
    Calendar as CalendarIcon,
    ChevronDown,
    ChevronsLeft,
    ChevronsRight,
    Settings2,
    Table as TableIcon,
} from "lucide-react";
import {
    ALL_BATCHES,
    COLUMNS,
    MS_PER_DAY,
    VIEWS,
    parseKey,
    toDayKey,
} from "@/app/lms/pages/attendancemanagement/features/attendanceReportModalShared";
import type { useAttendanceReportModal } from "@/app/lms/pages/attendancemanagement/features/useAttendanceReportModal";

type ReportModalState = ReturnType<typeof useAttendanceReportModal>;

export default function AttendanceReportModalDrawer({
    today, defaultFrom, defaultTo, from, setFrom, to, setTo, cols, setCols, views, setViews,
    drawerCollapsed, setDrawerCollapsed, dateMode, setDateMode, batchSel, setBatchSel,
    studentSel, setStudentSel, studentPickerOpen, setStudentPickerOpen, setSingleDay,
    batchGroups, scopedStudents, hasBatches, toggle,
}: ReportModalState) {
    return (
                <aside className={`flex shrink-0 flex-col border-r border-hairline bg-surface-sunken/40 transition-[width] duration-150 ${drawerCollapsed ? "w-[52px]" : "w-[320px]"}`}>
                    <header className={`flex flex-shrink-0 items-center gap-2 border-b border-hairline py-3 ${drawerCollapsed ? "justify-center px-2" : "px-4"}`}>
                        {!drawerCollapsed && (
                            <>
                                <Settings2 className="h-4 w-4 text-brand-strong shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm font-semibold text-heading">Report designer</h2>
                                    <p className="mt-0.5 truncate text-[10px] text-subtle">Pick what to show — preview updates as you edit.</p>
                                </div>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => setDrawerCollapsed((v) => !v)}
                            aria-label={drawerCollapsed ? "Expand designer" : "Collapse designer"}
                            title={drawerCollapsed ? "Expand designer" : "Collapse designer"}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                        >
                            {drawerCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                        </button>
                    </header>

                    {drawerCollapsed ? (
                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1 py-3">
                            {VIEWS.map((v) => {
                                const on = views.has(v.key);
                                const Icon = v.icon;
                                return (
                                    <button
                                        key={v.key}
                                        type="button"
                                        onClick={() => toggle(views, setViews, v.key)}
                                        title={v.label}
                                        aria-label={v.label}
                                        aria-pressed={on}
                                        className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                                            on
                                                ? "border-brand-500 bg-brand-100/40 text-brand-strong dark:bg-brand-500/15"
                                                : "border-transparent text-subtle hover:bg-row-hover hover:text-body"
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </button>
                                );
                            })}
                            <div className="my-1 h-px w-6 bg-hairline" aria-hidden />
                            <button
                                type="button"
                                onClick={() => setDrawerCollapsed(false)}
                                title="Open date range / column pickers"
                                aria-label="Open date range / column pickers"
                                className="flex h-9 w-9 items-center justify-center rounded-md text-subtle hover:bg-row-hover hover:text-body transition-colors"
                            >
                                <CalendarIcon className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setDrawerCollapsed(false)}
                                title="Open table column picker"
                                aria-label="Open table column picker"
                                className="flex h-9 w-9 items-center justify-center rounded-md text-subtle hover:bg-row-hover hover:text-body transition-colors"
                            >
                                <TableIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-5">
                        {/* Date range */}
                        <section>
                            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Date range</h3>
                            {/* Single vs Range picker — radio pair. Keeps the
                                URL / query the same shape (from + to) so the
                                download and preview logic doesn't branch. */}
                            <div className="mb-2 flex items-center gap-3" role="radiogroup" aria-label="Date mode">
                                <label className="inline-flex cursor-pointer items-center gap-1.5">
                                    <input
                                        type="radio"
                                        name="date-mode"
                                        value="single"
                                        checked={dateMode === "single"}
                                        onChange={() => { setDateMode("single"); setSingleDay(to || today); }}
                                        className="size-3.5 cursor-pointer text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                    />
                                    <span className="text-[11px] font-medium text-body">Single</span>
                                </label>
                                <label className="inline-flex cursor-pointer items-center gap-1.5">
                                    <input
                                        type="radio"
                                        name="date-mode"
                                        value="range"
                                        checked={dateMode === "range"}
                                        onChange={() => {
                                            setDateMode("range");
                                            // On switch back, seed a sensible range ending on the current single day.
                                            if (from === to) {
                                                const end = to || today;
                                                const start = toDayKey(new Date(parseKey(end).getTime() - 6 * MS_PER_DAY));
                                                setFrom(start);
                                            }
                                        }}
                                        className="size-3.5 cursor-pointer text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                    />
                                    <span className="text-[11px] font-medium text-body">Range</span>
                                </label>
                            </div>
                            {dateMode === "single" ? (
                                <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-medium text-subtle">Date</span>
                                    <div className="relative">
                                        <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
                                        <input
                                            type="date"
                                            value={to}
                                            max={today}
                                            onChange={(e) => setSingleDay(e.target.value)}
                                            className="h-8 w-full rounded-md border border-hairline bg-surface pl-6 pr-1.5 text-[11px] text-body outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                        />
                                    </div>
                                </label>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex flex-col gap-1">
                                        <span className="text-[10px] font-medium text-subtle">Start date</span>
                                        <div className="relative">
                                            <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
                                            <input
                                                type="date"
                                                value={from}
                                                max={to || today}
                                                onChange={(e) => setFrom(e.target.value)}
                                                className="h-8 w-full rounded-md border border-hairline bg-surface pl-6 pr-1.5 text-[11px] text-body outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                            />
                                        </div>
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-[10px] font-medium text-subtle">End date</span>
                                        <div className="relative">
                                            <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
                                            <input
                                                type="date"
                                                value={to}
                                                min={from}
                                                max={today}
                                                onChange={(e) => setTo(e.target.value)}
                                                className="h-8 w-full rounded-md border border-hairline bg-surface pl-6 pr-1.5 text-[11px] text-body outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                            />
                                        </div>
                                    </label>
                                </div>
                            )}
                            {dateMode === "range" && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {[
                                    { label: "7d", days: 7 },
                                    { label: "14d", days: 14 },
                                    { label: "30d", days: 30 },
                                ].map((p) => (
                                    <button
                                        key={p.label}
                                        type="button"
                                        onClick={() => {
                                            const end = today;
                                            const start = toDayKey(new Date(parseKey(end).getTime() - (p.days - 1) * MS_PER_DAY));
                                            setFrom(start); setTo(end);
                                        }}
                                        className="rounded-chip border border-hairline bg-surface px-2 py-0.5 text-[10px] font-medium text-subtle hover:bg-row-hover hover:text-body transition-colors"
                                    >
                                        Last {p.label}
                                    </button>
                                ))}
                            </div>
                            )}
                        </section>

                        {/* Batch — hidden when the course has no real batch
                            split (i.e., the whole roster is one bucket). */}
                        {hasBatches && (
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Batch</h3>
                                <div className="relative">
                                    <select
                                        value={batchSel}
                                        onChange={(e) => setBatchSel(e.target.value)}
                                        className="h-8 w-full appearance-none rounded-md border border-hairline bg-surface pl-2.5 pr-7 text-[11px] font-medium text-heading outline-none cursor-pointer focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                        aria-label="Batch"
                                    >
                                        <option value={ALL_BATCHES}>All batches</option>
                                        {batchGroups.map((g) => (
                                            <option key={g.id} value={g.id}>{g.name} ({g.students.length})</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-subtle" />
                                </div>
                            </section>
                        )}

                        {/* Students — filter within the batch scope. Default is
                            "All students" (implicit); tick specific rows to
                            narrow. Header shows the current selection count. */}
                        <section>
                            <div className="mb-1.5 flex items-center justify-between">
                                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Students</h3>
                                <span className="text-[10px] tabular-nums text-subtle">
                                    {studentSel === null
                                        ? `All (${scopedStudents.length})`
                                        : `${studentSel.size} of ${scopedStudents.length}`}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStudentPickerOpen((v) => !v)}
                                className="flex h-8 w-full items-center justify-between rounded-md border border-hairline bg-surface px-2.5 text-[11px] font-medium text-heading hover:border-hairline-strong transition-colors"
                            >
                                <span className="truncate">
                                    {studentSel === null
                                        ? "All students"
                                        : studentSel.size === 0
                                            ? "No students selected"
                                            : studentSel.size === 1
                                                ? scopedStudents.find((s) => studentSel.has(s._id))?.firstName
                                                    ? `${scopedStudents.find((s) => studentSel.has(s._id))!.firstName} ${scopedStudents.find((s) => studentSel.has(s._id))!.lastName}`.trim()
                                                    : "1 student"
                                                : `${studentSel.size} students`}
                                </span>
                                <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${studentPickerOpen ? "rotate-180" : ""}`} />
                            </button>
                            {studentPickerOpen && (
                                <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-hairline bg-surface p-1.5">
                                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-row-hover">
                                        <input
                                            type="checkbox"
                                            checked={studentSel === null}
                                            onChange={(e) => setStudentSel(e.target.checked ? null : new Set())}
                                            className="size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                        />
                                        <span className="text-[11px] font-semibold text-heading">All students</span>
                                    </label>
                                    <div className="my-1 h-px bg-hairline" />
                                    {scopedStudents.length === 0 ? (
                                        <p className="px-2 py-2 text-[10px] text-subtle">No students in this batch.</p>
                                    ) : scopedStudents.map((s) => {
                                        const on = studentSel === null ? true : studentSel.has(s._id);
                                        return (
                                            <label key={s._id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-row-hover">
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => {
                                                        setStudentSel((prev) => {
                                                            // Materialise the implicit "all" set when the user starts
                                                            // ticking off individuals — that's what the checkbox is
                                                            // actually mutating.
                                                            const base = prev ?? new Set(scopedStudents.map((x) => x._id));
                                                            const next = new Set(base);
                                                            if (next.has(s._id)) next.delete(s._id); else next.add(s._id);
                                                            // If everyone is back in, collapse to null (implicit all).
                                                            if (next.size === scopedStudents.length) return null;
                                                            return next;
                                                        });
                                                    }}
                                                    className="size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[11px] font-medium text-body">
                                                        {`${s.firstName} ${s.lastName}`.trim() || "—"}
                                                    </span>
                                                    {s.userId && (
                                                        <span className="block truncate text-[10px] tabular-nums text-faint">{s.userId}</span>
                                                    )}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Views (visual representations) */}
                        <section>
                            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Views</h3>
                            <div className="grid grid-cols-2 gap-1.5">
                                {VIEWS.map((v) => {
                                    const on = views.has(v.key);
                                    const Icon = v.icon;
                                    return (
                                        <button
                                            key={v.key}
                                            type="button"
                                            onClick={() => toggle(views, setViews, v.key)}
                                            className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                                                on
                                                    ? "border-brand-500 bg-brand-100/40 text-brand-strong dark:bg-brand-500/15"
                                                    : "border-hairline bg-surface text-subtle hover:border-hairline-strong hover:text-body"
                                            }`}
                                        >
                                            <Icon className="h-3.5 w-3.5" /> {v.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-1.5 text-[10px] text-faint">Pick one or several — the canvas stacks them top-down.</p>
                        </section>

                        {/* Table columns (only relevant if Table view is on) */}
                        <section aria-disabled={!views.has("table")} className={views.has("table") ? "" : "opacity-50 pointer-events-none"}>
                            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Table columns</h3>
                            <div className="space-y-1">
                                {COLUMNS.map((c) => {
                                    const on = cols.has(c.key);
                                    return (
                                        <label key={c.key} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-row-hover" title={c.hint}>
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                onChange={() => toggle(cols, setCols, c.key)}
                                                className="mt-0.5 size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                            />
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-[11px] font-medium text-body">{c.label}</span>
                                                <span className="block truncate text-[10px] text-faint">{c.hint}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                    )}

                    {/* Reset — clear back to defaults (expanded only). */}
                    {!drawerCollapsed && (
                        <footer className="flex-shrink-0 border-t border-hairline px-4 py-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setDateMode("range");
                                    setFrom(defaultFrom); setTo(defaultTo);
                                    setBatchSel(ALL_BATCHES);
                                    setStudentSel(null);
                                    setCols(new Set(["enrollment", "present", "absent", "halfday", "attendance"]));
                                    setViews(new Set(["table", "pie"]));
                                }}
                                className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[11px] font-medium text-body hover:bg-row-hover transition-colors"
                            >
                                Reset to defaults
                            </button>
                        </footer>
                    )}
                </aside>
    );
}
