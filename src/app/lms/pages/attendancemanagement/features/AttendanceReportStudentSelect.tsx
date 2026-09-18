"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { Student, StudentFilter } from "@/app/lms/pages/attendancemanagement/features/attendanceReportShared";

/** Checkbox list of students, with an "All Students" toggle and an inline
 *  search. The value is either the literal "all" (implicit — everyone in the
 *  roster) or an explicit list of student ids. */
export default function AttendanceReportStudentSelect({
    students,
    value,
    onChange,
}: {
    students: Student[];
    value: StudentFilter;
    onChange: (next: StudentFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const rootRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Close on click-outside / Esc; refocus the search on open.
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        requestAnimationFrame(() => inputRef.current?.focus());
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // Prune ids that no longer exist in the roster (student removed from
    // the batch). "all" stays as-is.
    useEffect(() => {
        if (value === "all") return;
        const ids = new Set(students.map((s) => s._id));
        const pruned = value.filter((id) => ids.has(id));
        if (pruned.length !== value.length) onChange(pruned.length ? pruned : "all");
    }, [students, value, onChange]);

    const selectedSet = useMemo(
        () => (value === "all" ? null : new Set(value)),
        [value]
    );
    const selectedCount = value === "all" ? students.length : value.length;
    const allSelected = value === "all" || value.length === students.length;

    const label = (() => {
        if (value === "all" || allSelected) return "All Students";
        if (value.length === 0) return "All Students";
        if (value.length === 1) {
            const s = students.find((x) => x._id === value[0]);
            return s ? `${s.firstName} ${s.lastName}`.trim() || s.email : "1 student";
        }
        return `${value.length} students`;
    })();

    const q = query.trim().toLowerCase();
    const filtered = q
        ? students.filter((s) => {
              const name = `${s.firstName} ${s.lastName}`.trim().toLowerCase();
              return (
                  name.includes(q) ||
                  (s.email || "").toLowerCase().includes(q) ||
                  (s.userId || "").toLowerCase().includes(q)
              );
          })
        : students;

    const toggleOne = (id: string) => {
        const nextSet = new Set(value === "all" ? students.map((s) => s._id) : value);
        if (nextSet.has(id)) nextSet.delete(id);
        else nextSet.add(id);
        // Collapse to "all" once every student is ticked — keeps the UI
        // reading as the default instead of "N of N".
        if (nextSet.size === students.length) onChange("all");
        else onChange(Array.from(nextSet));
    };

    const toggleAll = () => {
        if (allSelected) onChange([]);
        else onChange("all");
    };

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-2.5 text-left text-[12.5px] transition-colors ${
                    open ? "border-indigo-500 ring-2 ring-indigo-500/15" : "border-gray-300 hover:border-gray-400"
                }`}
            >
                <span className="min-w-0 flex-1 truncate text-gray-800">{label}</span>
                {selectedCount > 0 && !allSelected ? (
                    <span
                        role="button"
                        aria-label="Clear student selection"
                        onClick={(e) => { e.stopPropagation(); onChange("all"); }}
                        className="inline-flex size-4 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    >
                        <X size={11} />
                    </span>
                ) : null}
                <ChevronDown
                    size={13}
                    className={`shrink-0 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>
            {open ? (
                <div
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
                >
                    <div className="border-b border-gray-100 p-1.5">
                        <div className="relative">
                            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden />
                            <input
                                ref={inputRef}
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search students…"
                                className="h-7 w-full rounded-md border border-gray-200 bg-white pl-7 pr-2 text-[11.5px] text-gray-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                            />
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={toggleAll}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-[11.5px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        <span className="inline-flex items-center gap-2">
                            <span className={`flex size-3.5 items-center justify-center rounded border ${allSelected ? "border-indigo-500 bg-indigo-500 text-white" : "border-gray-300 bg-white"}`}>
                                {allSelected ? <Check size={10} strokeWidth={3} /> : null}
                            </span>
                            All Students
                        </span>
                        <span className="text-[10px] font-medium text-gray-400 tabular-nums">
                            {selectedCount}/{students.length}
                        </span>
                    </button>
                    <div className="max-h-64 overflow-y-auto border-t border-gray-100 py-0.5">
                        {filtered.length === 0 ? (
                            <div className="px-3 py-3 text-[11px] text-gray-500">No students match.</div>
                        ) : (
                            filtered.map((s) => {
                                const on = selectedSet ? selectedSet.has(s._id) : true;
                                const name = `${s.firstName} ${s.lastName}`.trim() || s.email;
                                return (
                                    <button
                                        key={s._id}
                                        type="button"
                                        role="option"
                                        aria-selected={on}
                                        onClick={() => toggleOne(s._id)}
                                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11.5px] transition-colors ${on ? "bg-indigo-50/50" : "hover:bg-gray-50"}`}
                                    >
                                        <span className={`flex size-3.5 shrink-0 items-center justify-center rounded border ${on ? "border-indigo-500 bg-indigo-500 text-white" : "border-gray-300 bg-white"}`}>
                                            {on ? <Check size={10} strokeWidth={3} /> : null}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate">{name}</span>
                                        {s.userId ? (
                                            <span className="shrink-0 text-[10px] tabular-nums text-gray-400">{s.userId}</span>
                                        ) : null}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
