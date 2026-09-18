"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Report — course-scoped read-only report with filters, stats,
// summary table (Daily/Summary view), and 3 chart cards. The Export menu
// prints or downloads (PDF / Excel) the report for the applied filters.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { Poppins } from "next/font/google";
import { toast } from "react-hot-toast";
import {
    AlertTriangle,
    CalendarDays,
    ChevronDown,
    Circle,
    Clock,
    Download,
    FileText,
    Filter,
    Loader2,
    Printer,
    RotateCcw,
    TrendingUp,
    Users,
    UserX,
    UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    FilterField,
    StatCard,
    bandOf,
    type StatusFilter,
} from "@/app/lms/pages/attendancemanagement/features/attendanceReportShared";
import { useAttendanceReport } from "@/app/lms/pages/attendancemanagement/features/useAttendanceReport";
import { createReportExports } from "@/app/lms/pages/attendancemanagement/features/attendanceReportExports";
import AttendanceReportTable from "@/app/lms/pages/attendancemanagement/features/AttendanceReportTable";
import AttendanceReportCharts, { AttendanceReportInsights } from "@/app/lms/pages/attendancemanagement/features/AttendanceReportCharts";
import AttendanceReportStudentSelect from "@/app/lms/pages/attendancemanagement/features/AttendanceReportStudentSelect";
import PrintPreviewModal from "@/app/lms/component/live-print/PrintPreviewModal";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

// ── Component ──────────────────────────────────────────────────────────────
export default function AttendanceReportPage() {
    const report = useAttendanceReport();
    const {
        courseId, todayKey,
        pendingMode, setPendingMode, pendingDate, setPendingDate, pendingFrom, setPendingFrom, pendingTo, setPendingTo,
        pendingStudent, setPendingStudent, pendingStatus, setPendingStatus,
        canExport, filteredStudents,
        students, studentsLoading, summaryLoading,
        workingDays, totals, totalStudents,
        applyFilters, resetFilters,
    } = report;
    const exports = createReportExports(report);
    const [overallBusy, setOverallBusy] = useState<"print" | "pdf" | null>(null);
    // Print runs through the "pick a saved layout, tweak, then print" modal.
    // The report body is a plain-HTML rebuild of the report (scope, stat
    // cards, summary table, trend, insights) — text only, no page-UI
    // snapshot — so the printed sheet stays crisp and doesn't depend on
    // html2canvas.
    const [printModalOpen, setPrintModalOpen] = useState(false);
    const [printBodyHtml, setPrintBodyHtml] = useState<string>("");
    const runOverall = async (kind: "print" | "pdf") => {
        setOverallBusy(kind);
        try {
            if (kind === "print") {
                setPrintBodyHtml(exports.buildReportBodyHtml());
                setPrintModalOpen(true);
            } else {
                await exports.handleOverallPdf();
            }
        } catch (err) {
            console.error(err);
            toast.error("Could not export the attendance report");
        } finally {
            setOverallBusy(null);
        }
    };

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
                            {/* col spans sum to 12: Date=3, Student=3, Status=2, Buttons=4.
                                Buttons column carries two side-by-side buttons — at col-span-3
                                and a narrow embedding pane (e.g. inside the L&D dashboard's
                                Attendance tab), Reset overflowed. col-span-4 fits both here
                                and on the standalone /attendancemanagement/report page. */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                                <div className="lg:col-span-3">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="text-[11px] font-medium text-gray-600">Date</span>
                                        <label className="inline-flex items-center gap-1 text-[11px] text-gray-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="report-date-mode"
                                                checked={pendingMode === "single"}
                                                onChange={() => setPendingMode("single")}
                                                className="h-3 w-3 accent-indigo-600 cursor-pointer"
                                            />
                                            Single Date
                                        </label>
                                        <label className="inline-flex items-center gap-1 text-[11px] text-gray-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="report-date-mode"
                                                checked={pendingMode === "range"}
                                                onChange={() => setPendingMode("range")}
                                                className="h-3 w-3 accent-indigo-600 cursor-pointer"
                                            />
                                            Date Range
                                        </label>
                                    </div>
                                    {pendingMode === "single" ? (
                                        <input
                                            type="date"
                                            value={pendingDate}
                                            max={todayKey}
                                            onChange={(e) => e.target.value && setPendingDate(e.target.value)}
                                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="date"
                                                value={pendingFrom}
                                                max={todayKey}
                                                onChange={(e) => e.target.value && setPendingFrom(e.target.value)}
                                                className="h-9 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                                title="Start date"
                                            />
                                            <span className="text-gray-400 shrink-0">–</span>
                                            <input
                                                type="date"
                                                value={pendingTo}
                                                max={todayKey}
                                                onChange={(e) => e.target.value && setPendingTo(e.target.value)}
                                                className="h-9 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                                title="End date"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="lg:col-span-3">
                                    <FilterField label="Student">
                                        <AttendanceReportStudentSelect
                                            students={students}
                                            value={pendingStudent}
                                            onChange={setPendingStudent}
                                        />
                                    </FilterField>
                                </div>
                                <div className="lg:col-span-2">
                                    <FilterField label="Status">
                                        <select
                                            value={pendingStatus}
                                            onChange={(e) => setPendingStatus(e.target.value as StatusFilter)}
                                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12.5px]"
                                        >
                                            <option value="all">All</option>
                                            <option value="P">Present</option>
                                            <option value="A">Absent</option>
                                            <option value="H">Half-day</option>
                                            <option value="N">Not Marked</option>
                                        </select>
                                    </FilterField>
                                </div>
                                <div className="lg:col-span-4 flex items-center gap-2 min-w-0 attm-hide-in-export">
                                    <Button
                                        onClick={applyFilters}
                                        className="h-9 flex-1 min-w-0 bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold whitespace-nowrap"
                                    >
                                        <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" /> Apply Filters
                                    </Button>
                                    <Button
                                        onClick={resetFilters}
                                        variant="outline"
                                        className="h-9 shrink-0 border-gray-300 text-gray-700 text-[12.5px] font-semibold whitespace-nowrap"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5 shrink-0" /> Reset
                                    </Button>
                                </div>
                            </div>
                            {canExport && (
                                <div className="mt-3 flex justify-end border-t border-gray-100 pt-3 attm-hide-in-export">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="outline"
                                                disabled={!!overallBusy || loading || filteredStudents.length === 0}
                                                title="Export the whole report — filters, stats, table, charts and insights"
                                                className="h-9 border-indigo-200 text-indigo-700 text-[12.5px] font-semibold whitespace-nowrap"
                                            >
                                                {overallBusy ? (
                                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                                ) : (
                                                    <Download className="h-3.5 w-3.5 mr-1.5" />
                                                )}
                                                {overallBusy ? "Preparing…" : "Export report"}
                                                <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" sideOffset={4} className="w-48">
                                            <DropdownMenuItem onClick={() => void runOverall("print")} className="text-[12.5px] cursor-pointer">
                                                <Printer className="h-3.5 w-3.5" /> Print
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => void runOverall("pdf")}
                                                title="Download the report as a PDF that matches the page UI"
                                                className="text-[12.5px] cursor-pointer"
                                            >
                                                <FileText className="h-3.5 w-3.5 text-red-600" /> Download PDF
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            )}
                        </div>


                        {/* Stat cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard
                                iconBg="bg-indigo-50 text-indigo-600"
                                icon={<Users className="h-5 w-5" />}
                                label="Total Students"
                                value={String(totalStudents)}
                            />
                            <StatCard
                                iconBg="bg-violet-50 text-violet-600"
                                icon={<CalendarDays className="h-5 w-5" />}
                                label="Total Working Days"
                                value={String(workingDays)}
                                sub="(excl. weekends)"
                            />
                            <StatCard
                                iconBg="bg-emerald-50 text-emerald-600"
                                icon={<TrendingUp className="h-5 w-5" />}
                                label="Class Average"
                                value={`${totals.avgAttendance.toFixed(2)}%`}
                                sub={bandOf(totals.avgAttendance).label}
                            />
                            <StatCard
                                iconBg="bg-rose-50 text-rose-600"
                                icon={<AlertTriangle className="h-5 w-5" />}
                                label="At Risk (< 75%)"
                                value={String(totals.atRisk)}
                                sub={totals.atRisk === 1 ? "student" : "students"}
                            />
                            <StatCard
                                iconBg="bg-emerald-50 text-emerald-600"
                                icon={<UserCheck className="h-5 w-5" />}
                                label="Present"
                                value={String(totals.P)}
                                sub={`(${totals.pPct.toFixed(2)}%)`}
                            />
                            <StatCard
                                iconBg="bg-red-50 text-red-600"
                                icon={<UserX className="h-5 w-5" />}
                                label="Absent"
                                value={String(totals.A)}
                                sub={`(${totals.aPct.toFixed(2)}%)`}
                            />
                            <StatCard
                                iconBg="bg-amber-50 text-amber-600"
                                icon={<Clock className="h-5 w-5" />}
                                label="Half-day"
                                value={String(totals.H)}
                                sub={`(${totals.hPct.toFixed(2)}%)`}
                            />
                            <StatCard
                                iconBg="bg-gray-100 text-gray-500"
                                icon={<Circle className="h-5 w-5" />}
                                label="Not Marked"
                                value={String(totals.N)}
                                sub={`(${totals.nPct.toFixed(2)}%)`}
                            />
                        </div>

                        {/* Attendance Summary */}
                        <AttendanceReportTable
                            {...report}
                            loading={loading}
                            onExcel={exports.handleExcel}
                            onSummaryPdf={exports.handlePdf}
                            onSummaryPrint={() => {
                                setPrintBodyHtml(exports.buildSummaryBodyHtml());
                                setPrintModalOpen(true);
                            }}
                        />

                        {/* Bottom charts */}
                        <AttendanceReportCharts {...report} />

                        {/* Key insights */}
                        <AttendanceReportInsights {...report} />
            </div>

            <PrintPreviewModal
                open={printModalOpen}
                onClose={() => setPrintModalOpen(false)}
                title={exports.printJobTitle()}
                heading="Attendance Report"
                bodyHtml={printBodyHtml}
                onPrint={(setting) => exports.printWithSetting(setting, printBodyHtml)}
            />
        </div>
    );
}
