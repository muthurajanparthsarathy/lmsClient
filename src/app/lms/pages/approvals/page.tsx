"use client";

/**
 * Admin-side Approvals — two tabs:
 *
 *   • Queue           — approvals waiting on the signed-in user (unchanged).
 *   • Approval Chains — one flat table of every client's course, with filters
 *                       and per-row actions to open the Set-Approval modal.
 *
 * Chains redesign (2026-09-04):
 *   The old design was a three-step drill-down (Clients → Courses → Modal).
 *   With ~50-200 courses across a handful of clients the two clicks to reach
 *   the useful screen felt like busywork, so the tab is now a single
 *   Client Management-style table. All the state — search text, client
 *   filter, course filter, status filter, page — lives on the flat table.
 *
 * Data sources — the same ones the old design used:
 *   • useClients()                        — institution's clients (for the
 *                                            Client filter and the row avatar/
 *                                            name/logo lookup)
 *   • courseStructuresSummaryQuery()      — every course, with the
 *                                            approvalHierarchy and
 *                                            defaultApproverRole scalars
 *                                            already on the summary projection
 *   • GET /approvals/pending              — the queue
 *   • PUT /courses/:id/approval-hierarchy — save (or clear, on empty steps)
 *
 * Layout: the shared "non-scrolling shell + inner scrollable table body +
 * sticky pager footer" recipe (as used by Client Management / Service
 * Mapping). Auto-fit page size measures the card + footer at runtime so
 * the visible row count matches the viewport height and rows never spill
 * behind an internal scrollbar.
 */

import { useState } from "react";
import { Info } from "lucide-react";
import DashboardLayout from "../../component/layout";
import ChainsPanel from "./components/ChainsPanel";
import PendingPanel from "./components/PendingPanel";

type Tab = "queue" | "chains";

export default function ApprovalsPage() {
    const [tab, setTab] = useState<Tab>("queue");

    const tabBtn = (id: Tab, label: string, hint?: string) => (
        <button
            type="button"
            onClick={() => setTab(id)}
            // Native `title` on the whole tab so a hover anywhere on the
            // label — not just the info icon beside it — surfaces the
            // meaning as a tooltip. Screen readers announce the same string
            // through `aria-label` on the icon.
            title={hint}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors ${
                tab === id
                    ? "border-orange-500 text-orange-700 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
        >
            {label}
            {hint && (
                <span
                    role="img"
                    aria-label={hint}
                    title={hint}
                    className="inline-flex items-center text-gray-400 hover:text-gray-600 cursor-help"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Info size={13} />
                </span>
            )}
        </button>
    );

    return (
        <DashboardLayout>
            {/* Root flex column — consumes <main>'s bounded height so children
                can share it. h-full/min-h-0/flex-col are all load-bearing. */}
            <div className="flex flex-col h-full min-h-0 min-w-0 p-6 max-w-6xl">
                {/* Title header — single heading, Client Management size. */}
                <div className="shrink-0 mb-4">
                    <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">
                        Approvals
                    </h1>
                </div>

                {/* Tab strip — natural height. Labels renamed 2026-09-04
                    from "Queue" / "Approval chains" so each tab's purpose
                    reads off the label alone; the info icon (and the tab's
                    own hover tooltip) still surface the fuller meaning for
                    anyone who wants it. */}
                <div className="shrink-0 flex gap-1 border-b border-gray-200 mb-4">
                    {tabBtn(
                        "queue",
                        "Pending Approvals",
                        "Review requests waiting for approval.",
                    )}
                    {tabBtn(
                        "chains",
                        "Approval Setup",
                        "Configure approvers and approval levels for each course.",
                    )}
                </div>

                {/* ── Pending Approvals: flat table (redesigned 2026-09-04) ── */}
                {tab === "queue" && <PendingPanel />}

                {/* ── Chains: flat table (redesigned 2026-09-04) ── */}
                {tab === "chains" && <ChainsPanel />}
            </div>
        </DashboardLayout>
    );
}
