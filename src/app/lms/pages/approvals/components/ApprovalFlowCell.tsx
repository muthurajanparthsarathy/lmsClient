"use client";

import { AlertTriangle } from "lucide-react";
import type { CourseRow } from "./approvalShared";

// Compact approval-chain readout for a course row. Renders the step chain
// (role names, or role · person when both are set) → "Students", with an
// N-level count chip beside it. Falls back to the L&D default when no
// custom hierarchy is set, and to a red "no chain" note when neither is
// present.
export default function ApprovalFlowCell({ course }: { course: CourseRow }) {
    const steps = (course.approvalHierarchy?.steps || [])
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (steps.length > 0) {
        const chain = steps
            .map((s) => s.roleName || "?")
            .concat(["Students"])
            .join(" → ");
        return (
            <div className="flex items-center gap-2 min-w-0">
                <span className="block truncate text-body" title={chain}>{chain}</span>
                <span className="inline-flex items-center h-[20px] px-1.5 rounded-chip bg-ink-100 text-ink-700 text-[10px] font-semibold tabular-nums flex-shrink-0">
                    {steps.length} level{steps.length === 1 ? "" : "s"}
                </span>
            </div>
        );
    }
    if (course.defaultApproverRole) {
        const chain = `${course.defaultApproverRole} → Students`;
        return (
            <div className="flex items-center gap-2 min-w-0">
                <span className="block truncate text-body" title={chain}>{chain}</span>
                <span className="inline-flex items-center h-[20px] px-1.5 rounded-chip bg-brand-wash text-brand-strong text-[10px] font-semibold tabular-nums flex-shrink-0">
                    1 level
                </span>
            </div>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs text-danger-700">
            <AlertTriangle size={12} /> No approval chain
        </span>
    );
}

// (StatusPill removed 2026-09-04 alongside the Status column in Approval
// Setup. The `getApprovalStatus` helper survives — the status filter
// dropdown still needs it, and the Actions menu still reads it to render
// the "no L&D default" hint on incomplete rows.)
