"use client";

import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown, Filter, MoreHorizontal, Search, Download,
  ChevronRight, PlayCircle, Calendar, Users,
} from "lucide-react";

import { useSectionHref } from "@/lib/sectionRoute";
import { liveSessionsApi, type LiveSessionRow, type LiveSessionsCounts } from "../api/liveSessionsApi";

// ── Live Task landing page (State A / B / C of the corrected spec) ──────────
//
// One list — no tabs above it, no preselected assessment, no metadata card,
// no KPIs. Just: title, status selector, search / filters, table. Clicking
// a row is the only thing that reveals the detail experience.
//
// The status selector has exactly three options — All Status (default),
// Completed, Not Completed — and Not Completed is a *client-side* union of
// every non-completed row (Scheduled + In Progress). This lets a row keep
// its real per-row status label ("Scheduled" stays "Scheduled") while the
// filter itself speaks in the user's language.
//
// A row click sets `?assessmentId=…` on the same route; page.tsx then hands
// off to SessionDetail. Because the deep link is unchanged, callers from
// Assessment.tsx / reviewSubmission continue to land where they always did.

type UiStatus = "all" | "completed" | "not-completed";

const STATUS_OPTIONS: { value: UiStatus; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "completed", label: "Completed" },
  { value: "not-completed", label: "Not Completed" },
];

// ── Small subcomponents ─────────────────────────────────────────────────────

// Per-row status pill. Uses the raw server status so a Scheduled/In Progress
// assessment keeps its actual label even when the filter says "Not Completed".
function StatusPill({ status }: { status: LiveSessionRow["status"] }) {
  const styles = status === "live"
    ? { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "In Progress" }
    : status === "scheduled"
      ? { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Scheduled" }
      : { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400", label: "Completed" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${styles.bg} ${styles.text}`}
      aria-label={`Status: ${styles.label}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} aria-hidden="true" />
      {styles.label}
    </span>
  );
}

function formatSchedule(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    const day = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return `${day}, ${time}`;
  } catch {
    return "—";
  }
}

const initialsOf = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
};

// The status selector from Screen 2 of the spec. Focus + Escape handled so
// it behaves like a real menu, not a bare <select>.
function StatusSelector({
  value,
  onChange,
  counts,
}: {
  value: UiStatus;
  onChange: (v: UiStatus) => void;
  counts: { all: number; completed: number; notCompleted: number };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const countFor = (v: UiStatus) =>
    v === "all" ? counts.all : v === "completed" ? counts.completed : counts.notCompleted;
  const label = STATUS_OPTIONS.find((o) => o.value === value)?.label || "All Status";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 bg-white text-[12.5px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className="text-gray-400 tabular-nums">({countFor(value)})</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-56 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
          <ul role="listbox" className="py-1 text-[12.5px]">
            {STATUS_OPTIONS.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                    o.value === value
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span>{o.label}</span>
                  <span className={`tabular-nums text-[11px] ${o.value === value ? "text-indigo-500" : "text-gray-400"}`}>{countFor(o.value)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Small creator chip — avatar + name. Falls back to just initials + email
// prefix when we don't have a display name.
function CreatorCell({ email }: { email: string | null | undefined }) {
  const e = String(email || "").trim();
  if (!e) return <span className="text-gray-400">—</span>;
  const name = e.includes("@") ? e.split("@")[0].replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim() : e;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-semibold flex items-center justify-center">
        {initialsOf(name)}
      </div>
      <span className="text-[12.5px] text-gray-700 truncate max-w-[180px]" title={e}>{name}</span>
    </div>
  );
}

// ── Main list component ─────────────────────────────────────────────────────

export default function SessionsList() {
  const router = useRouter();
  const sectionHref = useSectionHref();
  const params = useSearchParams();

  // Filter defaults per the spec: All Status on initial entry. Preserve the
  // previous choice when the user returns from a report (page.tsx forwards
  // `?status=` back on Back).
  const initialStatus: UiStatus = ((params.get("status") || "").toLowerCase() as UiStatus);
  const [statusFilter, setStatusFilter] = useState<UiStatus>(
    STATUS_OPTIONS.some((o) => o.value === initialStatus) ? initialStatus : "all",
  );
  const [searchQuery, setSearchQuery] = useState<string>(params.get("q") || "");

  // Fetch every row once — status filtering is a client-side split of three
  // buckets, no reason to round-trip to the server for it.
  const { data, isLoading, error } = useQuery({
    ...liveSessionsApi.list({}),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  const allRows: LiveSessionRow[] = data?.sessions || [];
  const rawCounts: LiveSessionsCounts = data?.counts || { all: 0, live: 0, scheduled: 0, completed: 0 };
  const counts = {
    all: rawCounts.all,
    completed: rawCounts.completed,
    // Everything that isn't marked completed is Not Completed.
    notCompleted: rawCounts.all - rawCounts.completed,
  };

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (statusFilter === "completed") rows = rows.filter((r) => r.status === "completed");
    else if (statusFilter === "not-completed") rows = rows.filter((r) => r.status !== "completed");

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.courseName.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [allRows, statusFilter, searchQuery]);

  const openSession = useCallback((row: LiveSessionRow) => {
    const qs = new URLSearchParams();
    qs.set("assessmentId", row.id);
    if (row.courseId) qs.set("courseId", row.courseId);
    if (row.nodeId) qs.set("nodeId", row.nodeId);
    if (row.nodeType) qs.set("nodeType", row.nodeType);
    if (row.subcategory) qs.set("subcategory", row.subcategory);
    // Preserve filter + search so Back restores exactly what the user saw.
    qs.set("returnTo", "liveTask");
    if (statusFilter !== "all") qs.set("status", statusFilter);
    if (searchQuery.trim()) qs.set("q", searchQuery.trim());
    router.push(`${sectionHref("liveDashboard")}?${qs.toString()}`);
  }, [router, sectionHref, statusFilter, searchQuery]);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Page header — plain title, no tabs. */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <h1 className="text-[20px] font-semibold text-gray-900 tracking-tight">Live Task</h1>
        <p className="text-[12.5px] text-gray-500 mt-0.5">
          Assessments assigned across your courses. Click one to open its report.
        </p>
      </div>

      {/* Toolbar: status selector + Add Filter + search + Export + overflow */}
      <div className="flex items-center gap-2 flex-wrap px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <StatusSelector value={statusFilter} onChange={setStatusFilter} counts={counts} />
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-gray-300 bg-white text-[12.5px] text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          title="Add filter (course, batch, date range…)"
          onClick={() => { /* Extra filters land in a later slice */ }}
        >
          <Filter size={13} />
          Add Filter
        </button>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-[240px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assessments…"
              className="w-full border border-gray-200 rounded-md pl-7 pr-2.5 py-1.5 text-[12.5px] text-gray-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
              aria-label="Search assessments"
            />
          </div>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            title="Export the current list"
            onClick={() => { /* Export handoff lands with the reports pipeline */ }}
          >
            <Download size={13} />
            Export
          </button>
          <button
            type="button"
            className="p-1.5 rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            aria-label="More actions"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-gray-400">
            Loading assessments…
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[13px] text-red-500">
            <div>{(error as Error).message || "Failed to load"}</div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-[12px] font-medium text-red-600 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-[13px] text-gray-400 p-8">
            <PlayCircle size={28} className="text-gray-300 mb-2" />
            <div className="font-medium text-gray-500">
              {allRows.length === 0
                ? "No assessments yet"
                : "No assessments match this filter"}
            </div>
            <div className="text-[11.5px] mt-1">
              {allRows.length === 0
                ? "Create a You Do assessment in a course and it'll appear here."
                : "Clear the search or switch the status filter."}
            </div>
          </div>
        ) : (
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 min-w-[280px]">
                    Assessment
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Students
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">
                    Start Date
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Created By
                  </th>
                  <th className="sticky top-0 z-10 bg-gray-50 px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  return (
                    <tr
                      key={r.id}
                      onClick={() => openSession(r)}
                      className="group border-b border-gray-100 hover:bg-indigo-50/40 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 align-middle">
                        <div className="text-[13px] font-medium text-gray-900 leading-tight">{r.title || "Assessment"}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5 capitalize">
                          {r.subcategory ? r.subcategory.replace(/_/g, " ") : "Assessment"}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="inline-flex items-center gap-1.5 text-[12.5px] text-gray-700 tabular-nums">
                          <Users size={13} className="text-gray-400" />
                          {r.participantCount}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-[12px] text-gray-600 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Calendar size={12} className="text-gray-400" />
                          {formatSchedule(r.startDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <CreatorCell email={r.createdBy} />
                      </td>
                      <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openSession(r)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          aria-label={`Open ${r.title}`}
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
