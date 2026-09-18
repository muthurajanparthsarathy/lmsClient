"use client";

/**
 * Searchable checkbox multi-select. Moved verbatim from the designer modal;
 * the only addition is `summary`, so a caller can phrase the closed state
 * ("32 learners selected") instead of the generic "Label: All".
 *
 * `sel === null` means "everything" — toggling the last unchecked option back
 * on collapses the explicit set to null again, so "all" stays one value.
 */

import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

export function MultiPickBox({
    label,
    options,
    sel,
    onChange,
    empty,
    summary,
    placeholder,
}: {
    label: string;
    options: { id: string; name: string; sub?: string }[];
    sel: Set<string> | null; // null = "all"
    onChange: (v: Set<string> | null) => void;
    empty?: string;
    summary?: (count: number, total: number) => string;
    placeholder?: string;
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const boxRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const h = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [open]);
    const t = q.trim().toLowerCase();
    const shown = t
        ? options.filter((o) => o.name.toLowerCase().includes(t) || (o.sub || "").toLowerCase().includes(t))
        : options;
    const toggle = (id: string) => {
        const next = new Set(sel === null ? options.map((o) => o.id) : sel);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange(next.size === options.length ? null : next);
    };
    const count = sel === null ? options.length : sel.size;
    const closedLabel = summary
        ? summary(count, options.length)
        : `${label}: ${sel === null ? "All" : `${count} of ${options.length}`}`;
    return (
        <div className="relative" ref={boxRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={open}
                className="flex h-9 w-full items-center justify-between rounded-control border border-hairline bg-surface px-3 text-[11.5px] font-medium text-heading transition-colors hover:border-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
            >
                <span className="flex min-w-0 items-center gap-2">
                    <Search className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                    <span className="truncate">{open ? placeholder || `Search ${label.toLowerCase()}…` : closedLabel}</span>
                </span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-subtle transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {open ? (
                <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-72 overflow-hidden rounded-control border border-hairline bg-surface p-1.5 shadow-sm">
                    <div className="relative mb-1.5">
                        <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" aria-hidden />
                        <input
                            type="search"
                            autoFocus
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={placeholder || `Search ${label.toLowerCase()}…`}
                            className="h-8 w-full rounded-chip border border-hairline bg-surface pl-6 pr-2 text-[11px] text-body outline-none focus:border-brand-500"
                        />
                    </div>
                    <div className="max-h-44 overflow-y-auto" role="listbox" aria-multiselectable>
                        {shown.length === 0 ? (
                            <div className="px-2 py-2 text-[10.5px] text-subtle">{empty || "No matches"}</div>
                        ) : (
                            shown.map((o) => (
                                <label
                                    key={o.id}
                                    className="flex cursor-pointer items-start gap-2 rounded-chip px-2 py-1 hover:bg-row-hover"
                                >
                                    <input
                                        type="checkbox"
                                        checked={sel === null || sel.has(o.id)}
                                        onChange={() => toggle(o.id)}
                                        className="mt-0.5 size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                    />
                                    <span className="flex-1 min-w-0">
                                        <span className="block truncate text-[11px] font-medium text-body">{o.name}</span>
                                        {o.sub ? (
                                            <span className="block truncate text-[10px] text-faint">{o.sub}</span>
                                        ) : null}
                                    </span>
                                </label>
                            ))
                        )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 border-t border-hairline pt-1.5">
                        <button
                            type="button"
                            onClick={() => onChange(null)}
                            className="rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-strong hover:bg-brand-wash"
                        >
                            Select all
                        </button>
                        <button
                            type="button"
                            onClick={() => onChange(new Set())}
                            className="rounded-chip px-1.5 py-0.5 text-[10.5px] font-semibold text-subtle hover:bg-row-hover"
                        >
                            Clear
                        </button>
                        <span className="ml-auto pr-1 text-[10px] tabular-nums text-faint">
                            {count} / {options.length}
                        </span>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default MultiPickBox;
