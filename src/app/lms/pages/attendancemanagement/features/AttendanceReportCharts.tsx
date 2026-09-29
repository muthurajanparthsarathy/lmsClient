"use client";

import { AlertTriangle, Award, CalendarDays, TrendingUp } from "lucide-react";
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
} from "recharts";
import {
    ChartCard,
    InsightTile,
    LegendRow,
    bandOf,
    fmt,
    fmtNum,
    fmtWeekday,
} from "@/app/lms/pages/attendancemanagement/features/attendanceReportShared";
import type { useAttendanceReport } from "@/app/lms/pages/attendancemanagement/features/useAttendanceReport";

type ReportState = ReturnType<typeof useAttendanceReport>;

export default function AttendanceReportCharts({ totals, trend, filteredStudents, workingDays }: ReportState) {
    return (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <ChartCard title="Attendance Percentage">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-[160px] h-[160px]">
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
                                                    innerRadius={50}
                                                    outerRadius={72}
                                                    stroke="none"
                                                >
                                                    {[
                                                        "#10b981", "#ef4444", "#f59e0b", "#d1d5db",
                                                    ].map((c, i) => (
                                                        <Cell key={i} fill={c} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <div className="text-[18px] font-bold text-gray-900">
                                                {totals.avgAttendance.toFixed(2)}%
                                            </div>
                                            <div className="text-[10.5px] text-gray-500">Average</div>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-1.5 text-[11.5px]">
                                        <LegendRow color="bg-emerald-500" label="Present" value={`${totals.pPct.toFixed(2)}% (${totals.P})`} />
                                        <LegendRow color="bg-red-500" label="Absent" value={`${totals.aPct.toFixed(2)}% (${totals.A})`} />
                                        <LegendRow color="bg-amber-500" label="Half-day" value={`${totals.hPct.toFixed(2)}% (${totals.H})`} />
                                        <LegendRow color="bg-gray-300" label="Not Marked" value={`${totals.nPct.toFixed(2)}% (${totals.N})`} />
                                    </div>
                                </div>
                            </ChartCard>

                            <ChartCard title="Attendance Trend">
                                <div className="h-[180px]">
                                    <ResponsiveContainer>
                                        <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
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

                            <ChartCard title="Performance Scale">
                                <div className="space-y-2.5">
                                    {totals.bandCounts.map(({ band, count }) => {
                                        const share =
                                            filteredStudents.length > 0
                                                ? (count / filteredStudents.length) * 100
                                                : 0;
                                        return (
                                            <div key={band.key}>
                                                <div className="flex items-center justify-between text-[11.5px]">
                                                    <span className="inline-flex items-center gap-1.5 text-gray-700">
                                                        <span className={`h-2 w-2 rounded-full ${band.dot}`} />
                                                        <span className="font-semibold">{band.label}</span>
                                                        <span className="text-gray-400">{band.range}</span>
                                                    </span>
                                                    <span className="font-medium text-gray-700">
                                                        {count} student{count === 1 ? "" : "s"}
                                                    </span>
                                                </div>
                                                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${band.bar}`}
                                                        style={{ width: `${share}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <p className="pt-1 text-[10.5px] text-gray-400 border-t border-gray-100">
                                        Attendance % = (Days Present + ½ × Half-days) ÷ {workingDays} Working Days × 100
                                    </p>
                                </div>
                            </ChartCard>
                        </div>
    );
}

export function AttendanceReportInsights({ totals, filteredStudents, workingDays, bestDay }: ReportState) {
    return (
                        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                            <div className="text-[13px] font-semibold text-gray-900 mb-3">Key Insights</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                <InsightTile
                                    icon={<Award className="h-4 w-4" />}
                                    iconBg="bg-emerald-50 text-emerald-600"
                                    label="Top Performer"
                                    value={
                                        totals.top
                                            ? `${totals.top.s.firstName} ${totals.top.s.lastName}`.trim() || "—"
                                            : "—"
                                    }
                                    sub={
                                        totals.top
                                            ? `${totals.top.attPct.toFixed(1)}% · ${fmtNum(totals.top.effPresent)}/${workingDays} days`
                                            : "No data in range"
                                    }
                                />
                                <InsightTile
                                    icon={<AlertTriangle className="h-4 w-4" />}
                                    iconBg="bg-red-50 text-red-600"
                                    label="Needs Attention"
                                    value={
                                        totals.low
                                            ? `${totals.low.s.firstName} ${totals.low.s.lastName}`.trim() || "—"
                                            : "—"
                                    }
                                    sub={
                                        totals.low
                                            ? `${totals.low.attPct.toFixed(1)}% · ${fmtNum(totals.low.effPresent)}/${workingDays} days`
                                            : "No data in range"
                                    }
                                />
                                <InsightTile
                                    icon={<CalendarDays className="h-4 w-4" />}
                                    iconBg="bg-sky-50 text-sky-600"
                                    label="Best Day"
                                    value={bestDay ? `${fmt(bestDay.d)} (${fmtWeekday(bestDay.d)})` : "—"}
                                    sub={
                                        bestDay
                                            ? `${bestDay.pct.toFixed(1)}% of the class present`
                                            : "No marks in range"
                                    }
                                />
                                <InsightTile
                                    icon={<TrendingUp className="h-4 w-4" />}
                                    iconBg="bg-indigo-50 text-indigo-600"
                                    label="Class Standing"
                                    value={`${totals.avgAttendance.toFixed(1)}% · ${bandOf(totals.avgAttendance).label}`}
                                    sub={`${totals.atRisk} of ${filteredStudents.length} student${filteredStudents.length === 1 ? "" : "s"} below 75%`}
                                />
                            </div>
                        </div>
    );
}
