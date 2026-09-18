"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

/* ── StyledSelect — portalled listbox with the same floating-label chrome as
   the rest of the L&D pickers. Local to this file so AttendanceTab stays a
   single import; API mirrors a bare <select> so existing dirty-cell guards
   and value/onChange plumbing keep working unchanged. */
export default function StyledSelect({
  label, value, options, onChange, ariaLabel, icon,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  ariaLabel?: string;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pop, setPop] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPop({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 180) });
    };
    update();
    const onDoc = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (popRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    document.addEventListener("mousedown", onDoc);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setActive(idx >= 0 ? idx : 0);
  }, [open, options, value]);

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); setOpen(true); return;
    }
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, options.length - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = options[active];
      if (opt) { onChange(opt.value); setOpen(false); }
    }
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel || label}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
        className={`relative flex h-9 min-w-[10rem] items-center rounded-md border bg-surface pl-2.5 pr-7 text-left transition-colors hover:border-hairline-strong ${open ? "border-brand-500 ring-2 ring-brand-500/15" : "border-hairline"}`}
      >
        {label && (
          <span className="pointer-events-none absolute -top-1.5 left-2 bg-surface px-1 text-[10px] font-medium leading-none text-subtle">
            {label}
          </span>
        )}
        {icon && <span className="mr-1.5 shrink-0">{icon}</span>}
        <span className="min-w-0 truncate text-xs font-semibold text-heading">{current?.label ?? "Select…"}</span>
        <ChevronDown size={12} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-subtle transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && pop && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          role="listbox"
          aria-label={ariaLabel || label}
          style={{ position: "fixed", top: pop.top, left: pop.left, minWidth: pop.width, pointerEvents: "auto" }}
          className="z-[9999] max-h-64 overflow-y-auto rounded-md border border-hairline bg-surface py-1 shadow-xl ring-1 ring-black/[0.04]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            const isActive = i === active;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActive(i)}
                onClick={(e) => { e.stopPropagation(); onChange(o.value); setOpen(false); }}
                className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                  selected
                    ? "bg-brand-100 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                    : isActive
                      ? "bg-row-hover text-heading"
                      : "text-body hover:bg-row-hover"
                }`}
              >
                <span className="truncate">{o.label}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
