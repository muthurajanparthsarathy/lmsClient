"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuestionFilterOption {
  value: string;
  label: string;
  /** Optional dot colour, used to mark the difficulty levels. */
  tone?: string;
}

interface DifficultySelectProps {
  value: string;
  options: QuestionFilterOption[];
  onChange: (value: string) => void;
  label: string;
}

/**
 * Listbox with a floating label.
 *
 * Replaces the native `<select>`, whose OS-drawn popup could not be styled and
 * read as a stray piece of 1998 in an otherwise custom console.
 */
export default function DifficultySelect({
  value,
  options,
  onChange,
  label,
}: DifficultySelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Floating label — sits on the border so it names the control without
          spending a line of rail height above it. */}
      <span
        className={cn(
          "pointer-events-none absolute -top-[7px] left-2.5 z-10 bg-white px-1 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors",
          open ? "text-[#0667F9]" : "text-[#8090AF]",
        )}
      >
        {label}
      </span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={cn(
          "flex h-[38px] w-full items-center justify-between rounded-[8px] border bg-white px-3 text-[12.5px] font-medium text-[#39496B] transition-colors",
          open
            ? "border-[#0667F9] ring-2 ring-[#0667F9]/12"
            : "border-[#E5E7EB] hover:border-[#B9CDEA]",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.tone && (
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ background: selected.tone }}
              aria-hidden
            />
          )}
          <span className="truncate">{selected?.label}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-[15px] w-[15px] shrink-0 text-[#8090AF] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-[calc(100%+5px)] z-50 overflow-hidden rounded-[9px] border border-[#E5E7EB] bg-white py-1 shadow-[0_10px_30px_rgba(11,20,55,0.12)]"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-[7px] text-left text-[12.5px] transition-colors",
                    active
                      ? "bg-[#EEF5FF] font-semibold text-[#0667F9]"
                      : "font-medium text-[#39496B] hover:bg-[#F5F9FF]",
                  )}
                >
                  {o.tone ? (
                    <span
                      className="h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ background: o.tone }}
                      aria-hidden
                    />
                  ) : (
                    <span className="h-[7px] w-[7px] shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {active && <Check className="h-[14px] w-[14px] shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
