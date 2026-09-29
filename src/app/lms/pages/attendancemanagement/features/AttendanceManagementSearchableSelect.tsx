"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

// Compact searchable select — the modern replacement for the native <select>
// on this page's toolbar. Same h-8 size and border rhythm as the Search input
// beside it, so the four controls (Search · Client · Course · Status) read as
// one row. Opens a popover with an inline search box, keyboard-navigable list,
// and a check mark on the current row. The `value === ""` slot renders whichever
// options[0] is (typically an "All …" row).
export default function SearchableSelect({
    value,
    onChange,
    options,
    ariaLabel,
    minWidth = 160,
}: {
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    ariaLabel: string;
    minWidth?: number;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const rootRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const listRef = useRef<HTMLUListElement | null>(null);

    const current = options.find((o) => o.value === value) ?? options[0];
    const q = query.trim().toLowerCase();
    const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        setQuery("");
        const idx = options.findIndex((o) => o.value === value);
        setActive(idx < 0 ? 0 : idx);
        requestAnimationFrame(() => inputRef.current?.focus());
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!open || !listRef.current) return;
        const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
        el?.scrollIntoView({ block: "nearest" });
    }, [active, open]);

    const commit = (v: string) => { onChange(v); setOpen(false); setQuery(""); };
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filtered.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
        else if (e.key === "Home") { e.preventDefault(); setActive(0); }
        else if (e.key === "End") { e.preventDefault(); setActive(filtered.length - 1); }
        else if (e.key === "Enter") {
            e.preventDefault();
            if (filtered[active]) commit(filtered[active].value);
        }
    };

    return (
        <div ref={rootRef} className="relative" style={{ minWidth }}>
            <button
                type="button"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className={`flex h-8 w-full items-center justify-between gap-1.5 rounded-control border bg-surface pl-2.5 pr-2 text-left text-xs transition-colors duration-150 ${
                    open
                        ? "border-brand ring-2 ring-brand/15"
                        : "border-hairline-strong hover:border-brand-300"
                }`}
            >
                <span className="min-w-0 flex-1 truncate font-medium text-body">
                    {current?.label ?? "Select…"}
                </span>
                <ChevronDown
                    size={13}
                    className={`shrink-0 text-subtle transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>
            {open ? (
                <div
                    role="listbox"
                    aria-label={ariaLabel}
                    className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-control border border-hairline bg-surface shadow-lg"
                >
                    <div className="border-b border-hairline p-1.5">
                        <div className="relative">
                            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
                            <input
                                ref={inputRef}
                                type="search"
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                                onKeyDown={onKeyDown}
                                placeholder={`Search ${ariaLabel.toLowerCase()}…`}
                                className="h-7 w-full rounded-chip border border-hairline-strong bg-surface pl-7 pr-2 text-[11px] text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                            />
                        </div>
                    </div>
                    <ul ref={listRef} className="max-h-64 overflow-y-auto py-1">
                        {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-[11px] text-subtle">No matches.</li>
                        ) : (
                            filtered.map((o, i) => {
                                const isActive = i === active;
                                const isSelected = o.value === value;
                                return (
                                    <li
                                        key={o.value}
                                        data-idx={i}
                                        role="option"
                                        aria-selected={isSelected}
                                        onMouseEnter={() => setActive(i)}
                                        onClick={() => commit(o.value)}
                                        className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-[11.5px] transition-colors ${
                                            isActive ? "bg-brand-50" : ""
                                        } ${isSelected ? "font-semibold text-heading" : "font-medium text-body"}`}
                                    >
                                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                                        {isSelected ? <Check size={12} className="shrink-0 text-brand-strong" /> : null}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
