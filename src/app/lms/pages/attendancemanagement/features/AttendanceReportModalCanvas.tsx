"use client";

import {
    ChevronDown,
    Download,
    FileSpreadsheet,
    FileText,
    Loader2,
    Settings2,
    X,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend as RLegend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as RTooltip,
    XAxis,
    YAxis,
} from "recharts";
import { STATUS_COLOR } from "@/app/lms/pages/attendancemanagement/features/attendanceReportModalShared";
import type { useAttendanceReportModal } from "@/app/lms/pages/attendancemanagement/features/useAttendanceReportModal";

type ReportModalState = ReturnType<typeof useAttendanceReportModal>;

export default function AttendanceReportModalCanvas({
    onClose, loading, canExport, course, from, to, workingDays, views, downloadOpen, setDownloadOpen,
    downloadRef, perStudent, totals, dailyTrend, activeCols, setChartRef, downloadExcel, downloadPdf,
}: ReportModalState & { loading: boolean; onClose: () => void }) {
    return (
                <div className="flex flex-1 min-w-0 flex-col">
                    <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface px-5 py-2.5">
                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-heading">
                                {course?.courseName || "Detailed report"}
                            </h2>
                            <p className="mt-0.5 truncate text-[10px] text-subtle tabular-nums">
                                {course?.courseCode ? `${course.courseCode} · ` : ""}{from} → {to} · {workingDays.length} working day{workingDays.length === 1 ? "" : "s"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Download dropdown — top-right, per the spec.
                                Export is admin-only, so hide the whole control
                                when the user lacks export_data. */}
                            {canExport && (
                            <div ref={downloadRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setDownloadOpen((v) => !v)}
                                    disabled={loading || perStudent.length === 0}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-brand-500 bg-brand-500 text-white text-xs font-semibold hover:bg-brand-strong disabled:opacity-50 transition-colors"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download report
                                    <ChevronDown className={`h-3 w-3 transition-transform ${downloadOpen ? "rotate-180" : ""}`} />
                                </button>
                                {downloadOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-44 overflow-hidden rounded-md border border-hairline bg-surface shadow-lg z-10">
                                        <button
                                            type="button"
                                            onClick={downloadExcel}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-body hover:bg-row-hover transition-colors"
                                        >
                                            <FileSpreadsheet className="h-3.5 w-3.5 text-success-500" /> Excel (.xlsx)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={downloadPdf}
                                            className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2 text-left text-xs font-medium text-body hover:bg-row-hover transition-colors"
                                        >
                                            <FileText className="h-3.5 w-3.5 text-danger-500" /> PDF (.pdf)
                                        </button>
                                    </div>
                                )}
                            </div>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="flex h-8 w-8 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 min-h-0 overflow-y-auto bg-surface-sunken/20 px-5 py-4 space-y-4">
                        {loading ? (
                            <div className="flex h-full items-center justify-center text-xs text-subtle">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading report…
                            </div>
                        ) : views.size === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                                <Settings2 className="h-8 w-8 text-faint" />
                                <p className="text-sm font-medium text-body">Nothing on the canvas yet</p>
                                <p className="text-xs text-subtle">Pick at least one view from the left panel.</p>
                            </div>
                        ) : perStudent.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs text-subtle">
                                No students enrolled in this course.
                            </div>
                        ) : (
                            <>
                                {/* Roster table */}
                                {views.has("table") && (
                                    <section className="rounded-tile border border-hairline bg-surface">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
                                            <h3 className="text-xs font-semibold text-heading">Roster</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">{perStudent.length} students · {activeCols.length} columns</span>
                                        </header>
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse text-xs">
                                                <thead className="bg-surface-sunken/50">
                                                    <tr>
                                                        <th className="w-10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">#</th>
                                                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">Student</th>
                                                        {activeCols.map((c) => (
                                                            <th key={c.key} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">{c.label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {perStudent.map((r, i) => (
                                                        <tr key={r.student._id} className="border-b border-hairline last:border-0 hover:bg-row-hover transition-colors">
                                                            <td className="px-3 py-2 text-[10px] tabular-nums text-faint">{String(i + 1).padStart(2, "0")}</td>
                                                            <td className="px-3 py-2">
                                                                <div className="truncate text-xs font-semibold text-heading">{`${r.student.firstName} ${r.student.lastName}`.trim() || "—"}</div>
                                                                {r.student.email && <div className="truncate text-[10px] text-subtle">{r.student.email}</div>}
                                                            </td>
                                                            {activeCols.map((c) => (
                                                                <td key={c.key} className="px-3 py-2 text-xs tabular-nums text-body">
                                                                    {c.key === "enrollment" && (r.student.userId || <span className="text-faint">—</span>)}
                                                                    {c.key === "present" && r.P}
                                                                    {c.key === "absent" && r.A}
                                                                    {c.key === "halfday" && r.H}
                                                                    {c.key === "notmarked" && r.notmarked}
                                                                    {c.key === "attendance" && (
                                                                        <span className={`font-semibold ${r.pct >= 75 ? "text-success-500" : r.pct >= 60 ? "text-warn-500" : "text-danger-500"}`}>{r.pct.toFixed(1)}%</span>
                                                                    )}
                                                                    {c.key === "performance" && r.performance}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                )}

                                {/* Status share pie */}
                                {views.has("pie") && (
                                    <section className="rounded-tile border border-hairline bg-surface">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
                                            <h3 className="text-xs font-semibold text-heading">Status share</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">Overall across the range</span>
                                        </header>
                                        <div ref={setChartRef("pie")} className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        dataKey="value"
                                                        nameKey="name"
                                                        data={[
                                                            { name: "Present",   value: totals.P, color: STATUS_COLOR.P },
                                                            { name: "Absent",    value: totals.A, color: STATUS_COLOR.A },
                                                            { name: "Half-day",  value: totals.H, color: STATUS_COLOR.H },
                                                            { name: "Not marked", value: totals.N, color: STATUS_COLOR.N },
                                                        ]}
                                                        innerRadius={55}
                                                        outerRadius={90}
                                                        paddingAngle={2}
                                                    >
                                                        {[STATUS_COLOR.P, STATUS_COLOR.A, STATUS_COLOR.H, STATUS_COLOR.N].map((c, i) => (
                                                            <Cell key={i} fill={c} />
                                                        ))}
                                                    </Pie>
                                                    <RTooltip />
                                                    <RLegend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </section>
                                )}

                                {/* Per-student attendance % bar */}
                                {views.has("bar") && (
                                    <section className="rounded-tile border border-hairline bg-surface">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
                                            <h3 className="text-xs font-semibold text-heading">Per-student attendance %</h3>
                                        </header>
                                        <div ref={setChartRef("bar")} className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={perStudent.map((r) => ({
                                                    name: `${r.student.firstName} ${r.student.lastName}`.trim() || r.student.userId || "—",
                                                    pct: Math.round(r.pct * 10) / 10,
                                                }))} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                                                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                                    <RTooltip formatter={((v: number) => `${v}%`) as any} />
                                                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                                                        {perStudent.map((r, i) => (
                                                            <Cell key={i} fill={r.pct >= 75 ? STATUS_COLOR.P : r.pct >= 60 ? STATUS_COLOR.H : STATUS_COLOR.A} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </section>
                                )}

                                {/* Daily trend line */}
                                {views.has("line") && (
                                    <section className="rounded-tile border border-hairline bg-surface">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
                                            <h3 className="text-xs font-semibold text-heading">Daily attendance trend</h3>
                                            <span className="text-[10px] text-subtle">Avg % across students, per working day</span>
                                        </header>
                                        <div ref={setChartRef("line")} className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={dailyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 12 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                                                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                                    <RTooltip formatter={((v: number) => `${v}%`) as any} />
                                                    <Line type="monotone" dataKey="pct" stroke="#F97316" strokeWidth={2} dot={{ r: 3, fill: "#F97316" }} activeDot={{ r: 5 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                </div>
    );
}
