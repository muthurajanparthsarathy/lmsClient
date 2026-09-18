"use client";

/**
 * Canva-style Detailed Attendance Report modal.
 *
 * Left drawer = designer surface (date range, columns, view types). Right
 * canvas = live-updating preview built from those choices. Top-right =
 * download menu (Excel / PDF) that exports whatever is currently visible on
 * the canvas — nothing more, nothing less. The old AttendanceReportPage
 * stays untouched: this modal replaces the "everything at once" report with
 * a build-what-you-want tool.
 */

import AttendanceReportModalCanvas from "@/app/lms/pages/attendancemanagement/features/AttendanceReportModalCanvas";
import AttendanceReportModalDrawer from "@/app/lms/pages/attendancemanagement/features/AttendanceReportModalDrawer";
import { useAttendanceReportModal } from "@/app/lms/pages/attendancemanagement/features/useAttendanceReportModal";

export default function AttendanceReportModal({
    open, onClose, courseId, initialDayKey,
}: {
    open: boolean;
    onClose: () => void;
    courseId: string;
    initialDayKey?: string;
}) {
    const modal = useAttendanceReportModal({ open, onClose, courseId, initialDayKey });
    const { studentsLoading, recordsLoading } = modal;

    const loading = studentsLoading || recordsLoading;
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/55 backdrop-blur-[2px] p-3 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Detailed attendance report"
            onClick={onClose}
        >
            <div
                className="relative flex h-[94vh] w-[97vw] max-w-[1440px] overflow-hidden rounded-tile border border-hairline bg-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ─── LEFT DRAWER (Canva-style designer) ────────────────── */}
                <AttendanceReportModalDrawer {...modal} />

                {/* ─── RIGHT CANVAS (rendered report) ────────────────────── */}
                <AttendanceReportModalCanvas {...modal} loading={loading} onClose={onClose} />
            </div>
        </div>
    );
}
