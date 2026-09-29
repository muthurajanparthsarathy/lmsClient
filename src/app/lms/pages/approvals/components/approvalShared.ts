export interface PendingApproval {
    exerciseId: string;
    exerciseName?: string;
    // The exercise's own type tag (e.g. "mcq", "programming") — used only
    // to break a tie in the Type column: we prefer the tabType-derived
    // Assessment/Assignment label below and fall back to this string for
    // exotic exercise types.
    exerciseType?: string;
    courseId?: string;
    // Enriched by the server (2026-09-04) so the Pending Approvals table can
    // render Client + Course + Submitter without a per-row lookup.
    courseName?: string;
    clientId?: string;
    clientName?: string;
    clientLogo?: string;
    submittedBy?: { userId?: string | null; name?: string; email?: string };
    tabType?: string;
    subcategory?: string;
    step?: { order?: number; roleName?: string; userId?: string | null; userName?: string };
    currentStep?: number;
    totalSteps?: number;
    initiatedAt?: string;
    // > 0 means the trainer re-requested approval after a reject.
    resubmissionCount?: number;
    approvalScope?: string;
}

export interface CourseRow {
    _id: string;
    courseName?: string;
    courseCode?: string;
    clientId?: string;
    clientName?: string;
    // Both timestamps ride the summary projection. The sort uses the
    // later of the two — so a brand-new course AND a course whose
    // approval hierarchy was just saved both float to the top. The
    // server bumps `course.updatedAt` on every hierarchy PUT.
    createdAt?: string;
    updatedAt?: string;
    approvalHierarchy?: {
        steps?: { order?: number; roleId?: string; roleName?: string; userId?: string | null; userName?: string }[];
    };
    // Name of the institution's L&D default approver role, or null when the
    // institution has none (then there is NO fallback chain to display).
    defaultApproverRole?: string | null;
}

// Approval Flow status codes. The same three the Status column pills render
// and the Status filter dropdown selects between.
//   default    — no custom hierarchy on the course; falls back to the
//                institution's L&D approver role (must exist).
//   custom     — course-specific hierarchy with every step assigned to a
//                real person.
//   incomplete — either a course-specific hierarchy with one or more steps
//                missing a person, OR no custom hierarchy AND no L&D
//                default configured on the institution (nothing to fall
//                back on, so an approval request has nowhere to go).
export type ApprovalStatus = "default" | "custom" | "incomplete";

export const fmtDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

export const tabLabel = (t?: string): string =>
    t === "You_Do" ? "Assessment" : t === "We_Do" ? "Assignment" : t || "—";

// Derive the status pill from the course's saved hierarchy. Kept as a
// standalone function (not a hook) so it can be called both inside the
// filter predicate and inside every column render without React-rules
// contortions.
export const getApprovalStatus = (c: CourseRow): ApprovalStatus => {
    const steps = c.approvalHierarchy?.steps ?? [];
    if (steps.length === 0) return c.defaultApproverRole ? "default" : "incomplete";
    const allSet = steps.every((s) => Boolean(s.userId));
    return allSet ? "custom" : "incomplete";
};
