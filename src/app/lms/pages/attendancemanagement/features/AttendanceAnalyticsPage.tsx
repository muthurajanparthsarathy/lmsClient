"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Analytics — course-scoped analytical view with filters, stat
// cards, three charts (trend, distribution, by-day), and a Top Performers
// table. Includes a Download Analytics button (Excel / PDF).
// ─────────────────────────────────────────────────────────────────────────────

import { Poppins } from "next/font/google";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock,
    Download,
    FileSpreadsheet,
    FileText,
    Filter,
    RotateCcw,
    Trophy,
    UserCheck,
    UserX,
    TrendingDown,
    Circle,
    X,
} from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RTooltip,
    Legend as RLegend,
    BarChart,
    Bar,
} from "recharts";
import { Loading } from "@/components/loading-ui/loading";
import { Button } from "@/components/ui/button";
import {
    ChartCard,
    DistRow,
    FilterField,
    StatCard,
    ToggleGroup,
    type DayMode,
    type TrendMode,
} from "@/app/lms/pages/attendancemanagement/features/attendanceAnalyticsShared";
import { useAttendanceAnalytics } from "@/app/lms/pages/attendancemanagement/features/useAttendanceAnalytics";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

// ── Component ──────────────────────────────────────────────────────────────
export default function AttendanceAnalyticsPage() {
    const {
        courseId,
        pendingFrom, setPendingFrom, pendingTo, setPendingTo, pendingStudent, setPendingStudent,
        trendMode, setTrendMode, dayMode, setDayMode,
        downloadOpen, setDownloadOpen,
        students, studentsLoading, summaryLoading,
        totals, highLow, topPerformers, trend, byDay,
        applyFilters, resetFilters, goToReport, handleExcel, handlePdf,
    } = useAttendanceAnalytics();

    // ── Render ───────────────────────────────────────────────────────────
    if (!courseId) {
        return (
            <div className="p-8 text-center text-sm text-gray-600">
                No course selected.{" "}
                <a href="/lms/pages/attendancemanagement" className="text-indigo-600 hover:underline">
                    Go back
                </a>.
            </div>
        );
    }

    const loading = studentsLoading || summaryLoading;

    return (
        <div className={`${poppins.className} h-full overflow-y-auto px-6 py-4 space-y-4`}>
            <div className="space-y-4">
                        {/* Filters */}
                        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                                <div className="lg:col-span-4">
                                    <FilterField label="Date Range">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="date"
                                                value={pendingFrom}
                                                onChange={(e) => setPendingFrom(e.target.value)}
                                                className="h-9 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                            />
                                            <span className="text-gray-400 shrink-0">–</span>
                                            <input
                                                type="date"
                                                value={pendingTo}
                                                onChange={(e) => setPendingTo(e.target.value)}
                                                className="h-9 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                            />
                                        </div>
                                    </FilterField>
                                </div>
                                <div className="lg:col-span-5">
                                    <FilterField label="Student">
                                        <select
                                            value={pendingStudent}
                                            onChange={(e) => setPendingStudent(e.target.value)}
                                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12.5px]"
                                        >
                                            <option value="all">All Students</option>
                                            {students.map((s) => (
                                                <option key={s._id} value={s._id}>
                                                    {`${s.firstName} ${s.lastName}`.trim() || s.email}
                                                </option>
                                            ))}
                                        </select>
                                    </FilterField>
                                </div>
                                <div className="lg:col-span-3 flex items-center gap-2">
                                    <Button
                                        onClick={applyFilters}
                                        className="h-9 flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold"
                                    >
                                        <Filter className="h-3.5 w-3.5 mr-1.5" /> Apply Filters
                                    </Button>
                                    <Button
                                        onClick={resetFilters}
                                        variant="outline"
                                        className="h-9 border-gray-300 text-gray-700 text-[12.5px] font-semibold"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Stat cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                            <StatCard
                                iconBg="bg-emerald-50 text-emerald-600"
                                icon={<UserCheck className="h-5 w-5" />}
                                label="Average Attendance"
                                value={`${totals.avgAttendance.toFixed(2)}%`}
                            />
                            <StatCard
                                iconBg="bg-indigo-50 text-indigo-600"
                                icon={<Trophy className="h-5 w-5" />}
                                label="Highest Attendance"
                                value={highLow.hi ? `${highLow.hi.attPct.toFixed(2)}%` : "—"}
                                sub={highLow.hi ? `${highLow.hi.student.firstName} ${highLow.hi.student.lastName}`.trim() : ""}
                            />
                            <StatCard
                                iconBg="bg-red-50 text-red-600"
                                icon={<TrendingDown className="h-5 w-5" />}
                                label="Lowest Attendance"
                                value={highLow.lo ? `${highLow.lo.attPct.toFixed(2)}%` : "—"}
                                sub={highLow.lo ? `${highLow.lo.student.firstName} ${highLow.lo.student.lastName}`.trim() : ""}
                            />
                            <StatCard
                                iconBg="bg-emerald-50 text-emerald-600"
                                icon={<UserCheck className="h-5 w-5" />}
                                label="Total Present"
                                value={String(totals.P)}
                            />
                            <StatCard
                                iconBg="bg-red-50 text-red-600"
                                icon={<UserX className="h-5 w-5" />}
                                label="Total Absent"
                                value={String(totals.A)}
                            />
                            <StatCard
                                iconBg="bg-amber-50 text-amber-600"
                                icon={<Clock className="h-5 w-5" />}
                                label="Total Half-day"
                                value={String(totals.H)}
                            />
                            <StatCard
                                iconBg="bg-gray-100 text-gray-500"
                                icon={<Circle className="h-5 w-5" />}
                                label="Not Marked"
                                value={String(totals.N)}
                            />
                        </div>

                        {/* Charts row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <ChartCard
                                title="Attendance Trend"
                                headerRight={
                                    <ToggleGroup
                                        options={[
                                            { value: "daily", label: "Daily View" },
                                            { value: "cumulative", label: "Cumulative" },
                                        ]}
                                        value={trendMode}
                                        onChange={(v) => setTrendMode(v as TrendMode)}
                                    />
                                }
                            >
                                <div className="h-[220px]">
                                    <ResponsiveContainer>
                                        <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                                            <CartesianGrid stroke="#f3f4f6" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                                            <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                                            <RTooltip contentStyle={{ fontSize: 11 }} />
                                            <RLegend wrapperStyle={{ fontSize: 11 }} />
                                            <Line type="monotone" dataKey="Present" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                                            <Line type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                                            <Line type="monotone" dataKey="Half-day" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>

                            <ChartCard title="Attendance Distribution">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-[190px] h-[190px]">
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: "Present", value: totals.P, color: "#10b981" },
                                                        { name: "Absent", value: totals.A, color: "#ef4444" },
                                                        { name: "Half-day", value: totals.H, color: "#f59e0b" },
                                                        { name: "Not Marked", value: totals.N, color: "#d1d5db" },
                                                    ]}
                                                    dataKey="value"
                                                    innerRadius={58}
                                                    outerRadius={84}
                                                    stroke="none"
                                                >
                                                    {["#10b981", "#ef4444", "#f59e0b", "#d1d5db"].map((c, i) => (
                                                        <Cell key={i} fill={c} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <div className="text-[20px] font-bold text-gray-900">
                                                {totals.avgAttendance.toFixed(2)}%
                                            </div>
                                            <div className="text-[10.5px] text-gray-500">Average</div>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-2 text-[11.5px]">
                                        <DistRow color="bg-emerald-500" label="Present" count={totals.P} total={totals.totalCells} />
                                        <DistRow color="bg-red-500" label="Absent" count={totals.A} total={totals.totalCells} />
                                        <DistRow color="bg-amber-500" label="Half-day" count={totals.H} total={totals.totalCells} />
                                        <DistRow color="bg-gray-300" label="Not Marked" count={totals.N} total={totals.totalCells} />
                                    </div>
                                </div>
                            </ChartCard>

                            <ChartCard
                                title="Attendance by Day"
                                headerRight={
                                    <ToggleGroup
                                        options={[
                                            { value: "percent", label: "By Percentage" },
                                            { value: "count", label: "By Count" },
                                        ]}
                                        value={dayMode}
                                        onChange={(v) => setDayMode(v as DayMode)}
                                    />
                                }
                            >
                                <div className="h-[220px]">
                                    <ResponsiveContainer>
                                        <BarChart data={byDay} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                                            <CartesianGrid stroke="#f3f4f6" vertical={false} />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 10 }}
                                                stroke="#9ca3af"
                                            />
                                            <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                                            <RTooltip contentStyle={{ fontSize: 11 }} />
                                            <RLegend wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="Present" stackId="s" fill="#10b981" />
                                            <Bar dataKey="Absent" stackId="s" fill="#ef4444" />
                                            <Bar dataKey="Half-day" stackId="s" fill="#f59e0b" />
                                            <Bar dataKey="Not Marked" stackId="s" fill="#d1d5db" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        </div>

                        {/* Top performers table */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                                <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                                    <Trophy className="h-4 w-4 text-amber-500" />
                                    Top Performers
                                </div>
                                <button
                                    onClick={goToReport}
                                    className="text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-700"
                                >
                                    View All Students →
                                </button>
                            </div>

                            {loading ? (
                                <div className="py-12 flex items-center justify-center">
                                    <Loading size="size-8" />
                                </div>
                            ) : topPerformers.length === 0 ? (
                                <div className="py-12 text-center text-[13px] text-gray-500">
                                    No data for the current filters.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[12.5px]">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="w-10 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">#</th>
                                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Student Name</th>
                                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Roll No.</th>
                                                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Attendance %</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Present</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Absent</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Half-day</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topPerformers.map((rs, i) => (
                                                <tr key={rs.student._id} className="border-b border-gray-100 hover:bg-gray-50/60">
                                                    <td className="px-3 py-2.5 text-[11px] text-gray-400 font-mono">
                                                        {String(i + 1).padStart(2, "0")}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-semibold">
                                                                {(rs.student.firstName?.[0] || "?").toUpperCase()}
                                                                {(rs.student.lastName?.[0] || "").toUpperCase()}
                                                            </div>
                                                            <div className="font-medium text-gray-900">
                                                                {`${rs.student.firstName} ${rs.student.lastName}`.trim() || "—"}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-gray-700">{rs.student.userId || "—"}</td>
                                                    <td className={`px-3 py-2.5 text-right font-semibold ${
                                                        rs.attPct >= 75 ? "text-emerald-600" : rs.attPct >= 50 ? "text-amber-600" : "text-red-600"
                                                    }`}>
                                                        {rs.attPct.toFixed(2)}%
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center text-gray-800 font-semibold">{rs.p}</td>
                                                    <td className="px-3 py-2.5 text-center text-gray-800 font-semibold">{rs.a}</td>
                                                    <td className="px-3 py-2.5 text-center text-gray-800 font-semibold">{rs.h}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
            </div>

            {/* Download modal */}
            <AnimatePresence>
                    {downloadOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                            onClick={() => setDownloadOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 12 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 12 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl"
                            >
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <Download className="h-4 w-4 text-indigo-600" />
                                        <h3 className="text-[14px] font-semibold text-gray-900">Download Analytics</h3>
                                    </div>
                                    <button
                                        onClick={() => setDownloadOpen(false)}
                                        className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="px-5 py-4 space-y-3">
                                    <p className="text-[12.5px] text-gray-600">
                                        Choose an export format. Excel includes filter dropdowns pre-applied and a summary sheet.
                                    </p>
                                    <button
                                        onClick={handleExcel}
                                        className="w-full flex items-center gap-3 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40 px-4 py-3 text-left transition"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <FileSpreadsheet className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[13px] font-semibold text-gray-900">Excel (.xlsx)</div>
                                            <div className="text-[11px] text-gray-500">Summary + Top Performers + By Day sheets, filterable</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={handlePdf}
                                        className="w-full flex items-center gap-3 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50/40 px-4 py-3 text-left transition"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[13px] font-semibold text-gray-900">PDF (.pdf)</div>
                                            <div className="text-[11px] text-gray-500">Portrait, printable overview + top performers</div>
                                        </div>
                                    </button>
                                </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
