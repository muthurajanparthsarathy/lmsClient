"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import {
    ChevronDown,
    Download,
    FileSpreadsheet,
    FileText,
    LayoutGrid,
    LayoutList,
    Loader2,
    Printer,
    Users,
} from "lucide-react";
import { Loading } from "@/components/loading-ui/loading";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    StatusPill,
    fmt,
    fmtNum,
    fmtWeekday,
    isWeekend,
    toDayKey,
} from "@/app/lms/pages/attendancemanagement/features/attendanceReportShared";
import type { useAttendanceReport } from "@/app/lms/pages/attendancemanagement/features/useAttendanceReport";

type ReportState = ReturnType<typeof useAttendanceReport>;

type TableExportKind = "print" | "pdf" | "excel";

export default function AttendanceReportTable({
    viewMode,
    setViewMode,
    canExport,
    loading,
    filteredStudents,
    workingDayList,
    rowStats,
    grid,
    workingDays,
    onExcel,
    onSummaryPdf,
    onSummaryPrint,
}: ReportState & {
    loading: boolean;
    onExcel: () => Promise<void> | void;
    onSummaryPdf: () => Promise<void> | void;
    onSummaryPrint: () => Promise<void> | void;
}) {
    const [busy, setBusy] = useState<TableExportKind | null>(null);
    const runExport = async (kind: TableExportKind) => {
        setBusy(kind);
        try {
            await (kind === "print" ? onSummaryPrint() : kind === "pdf" ? onSummaryPdf() : onExcel());
        } catch (err) {
            console.error(err);
            toast.error("Could not export the attendance summary");
        } finally {
            setBusy(null);
        }
    };
    const dailyView = viewMode === "daily";
    const exportDisabled = !!busy || loading || filteredStudents.length === 0;
    return (
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 gap-3 flex-wrap">
                                <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                                    <Users className="h-4 w-4 text-orange-600" />
                                    Attendance Summary
                                </div>
                                <div className="flex items-center gap-2 flex-wrap attm-hide-in-export">
                                    <div className="flex items-center bg-gray-100 rounded-md p-0.5 text-[11.5px] font-medium">
                                        <button
                                            onClick={() => setViewMode("daily")}
                                            className={`px-3 py-1 rounded flex items-center gap-1.5 transition ${dailyView ? "bg-white shadow text-indigo-700" : "text-gray-600"}`}
                                        >
                                            <LayoutGrid className="h-3.5 w-3.5" /> Daily View
                                        </button>
                                        <button
                                            onClick={() => setViewMode("summary")}
                                            className={`px-3 py-1 rounded flex items-center gap-1.5 transition ${!dailyView ? "bg-white shadow text-indigo-700" : "text-gray-600"}`}
                                        >
                                            <LayoutList className="h-3.5 w-3.5" /> Summary View
                                        </button>
                                    </div>
                                    {/* View-aware Export — Daily View exports the day-by-day grid
                                        (Excel only, the format that actually carries those columns);
                                        Summary View offers Print, PDF and Excel. */}
                                    {canExport && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    disabled={exportDisabled}
                                                    title={dailyView
                                                        ? "Export the day-by-day grid as Excel"
                                                        : "Export the summary table"}
                                                    className="h-8 border-indigo-200 text-indigo-700 text-[11.5px] font-semibold whitespace-nowrap"
                                                >
                                                    {busy ? (
                                                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                                    ) : (
                                                        <Download className="h-3.5 w-3.5 mr-1" />
                                                    )}
                                                    {busy ? "Preparing…" : "Export table"}
                                                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" sideOffset={4} className="w-44">
                                                {!dailyView && (
                                                    <DropdownMenuItem onClick={() => void runExport("print")} className="text-[12.5px] cursor-pointer">
                                                        <Printer className="h-3.5 w-3.5" /> Print
                                                    </DropdownMenuItem>
                                                )}
                                                {!dailyView && (
                                                    <DropdownMenuItem onClick={() => void runExport("pdf")} className="text-[12.5px] cursor-pointer">
                                                        <FileText className="h-3.5 w-3.5 text-red-600" /> PDF (.pdf)
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={() => void runExport("excel")} className="text-[12.5px] cursor-pointer">
                                                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> Excel (.xlsx)
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>

                            {loading ? (
                                <div className="py-12 flex items-center justify-center">
                                    <Loading size="size-8" />
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="py-12 text-center text-[13px] text-gray-500">
                                    No students match the current filters.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[12.5px]">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="w-10 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">#</th>
                                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Student Name</th>
                                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Roll No.</th>
                                                {viewMode === "daily" &&
                                                    workingDayList.map((d) => {
                                                        const weekend = isWeekend(d);
                                                        return (
                                                            <th
                                                                key={toDayKey(d)}
                                                                className={`px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider ${weekend ? "text-red-500" : "text-gray-500"}`}
                                                            >
                                                                <div>{fmt(d)}</div>
                                                                <div className="mt-0.5">{fmtWeekday(d)}</div>
                                                            </th>
                                                        );
                                                    })}
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Working Days</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Days Present</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Absent</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Half-day</th>
                                                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Attendance %</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Performance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredStudents.map((s, i) => {
                                                const rs = rowStats(s._id);
                                                return (
                                                    <tr key={s._id} className="border-b border-gray-100 hover:bg-gray-50/60">
                                                        <td className="px-3 py-2.5 text-[11px] text-gray-400 font-mono">
                                                            {String(i + 1).padStart(2, "0")}
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-semibold">
                                                                    {(s.firstName?.[0] || "?").toUpperCase()}
                                                                    {(s.lastName?.[0] || "").toUpperCase()}
                                                                </div>
                                                                <div className="font-medium text-gray-900">
                                                                    {`${s.firstName} ${s.lastName}`.trim() || "—"}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-gray-700">{s.userId || "—"}</td>
                                                        {viewMode === "daily" &&
                                                            workingDayList.map((d) => {
                                                                const dk = toDayKey(d);
                                                                const st = grid.get(s._id)?.get(dk);
                                                                return (
                                                                    <td key={dk} className="px-2 py-2 text-center">
                                                                        <StatusPill status={st} />
                                                                    </td>
                                                                );
                                                            })}
                                                        <td className="px-3 py-2.5 text-center text-gray-800 font-semibold">{workingDays}</td>
                                                        <td className="px-3 py-2.5 text-center text-emerald-700 font-semibold">{rs.p}</td>
                                                        <td className="px-3 py-2.5 text-center text-red-600 font-semibold">{rs.a}</td>
                                                        <td className="px-3 py-2.5 text-center text-amber-600 font-semibold">{rs.h}</td>
                                                        <td className="px-3 py-2.5 text-right">
                                                            <div className={`font-semibold ${rs.band.text}`}>
                                                                {rs.attPct.toFixed(2)}%
                                                            </div>
                                                            <div
                                                                className="text-[10px] text-gray-400"
                                                                title={`(${fmtNum(rs.effPresent)} ÷ ${workingDays}) × 100 — half-day counts as ½`}
                                                            >
                                                                {fmtNum(rs.effPresent)}/{workingDays} days
                                                            </div>
                                                            <div className="mt-1 h-1 w-20 ml-auto rounded-full bg-gray-100 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${rs.band.bar}`}
                                                                    style={{ width: `${Math.min(100, Math.max(0, rs.attPct))}%` }}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <span
                                                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${rs.band.chip} ${rs.band.text}`}
                                                                title={`${rs.band.label}: ${rs.band.range} attendance`}
                                                            >
                                                                {rs.band.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
    );
}
