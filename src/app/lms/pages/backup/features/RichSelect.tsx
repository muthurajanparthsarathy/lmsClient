"use client";

// A two-line select for the Backup console.
//
// The shared SearchableSelect in @/app/lms/shared/ui takes SelectOption
// ({ value, label }) and renders one line — right for most pickers, but this
// screen needs each row to carry a leading icon, a title and a second line of
// context (a scope's description, a client's id and status). Rather than widen
// the shared option type for one screen — attendancemanagement uses it too —
// this is page-local and leaves the shared kit alone.
//
// Accent rather than brand: see the accent ramp note in globals.css.

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface RichOption {
  value: string;
  /** Bold first line. */
  label: string;
  /** Muted text after the label on the trigger, and the row's second line. */
  meta?: string;
  icon?: LucideIcon;
}

export interface RichSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: RichOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Leading icon on the trigger when nothing is selected. */
  icon?: LucideIcon;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  /** Rendered under the list — the mockup's "Where should it go?" hint. */
  footer?: React.ReactNode;
}

export default function RichSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  icon: FallbackIcon,
  searchable = false,
  searchPlaceholder = "Search…",
  emptyText = "No matches",
  footer,
}: RichSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selected = options.find((option) => option.value === value);
  const TriggerIcon = selected?.icon ?? FallbackIcon;

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        (option.meta || "").toLowerCase().includes(q)
    );
  }, [options, query]);

  // A stale query would silently hide rows the next time the list opens.
  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex h-11 w-full items-center gap-2.5 rounded-control border bg-surface px-3 text-left transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-accent-500/20",
            open ? "border-accent-500" : "border-hairline-strong hover:border-line-hover",
            disabled && "cursor-not-allowed bg-ink-50 text-subtle"
          )}
        >
          {TriggerIcon ? (
            <span
              aria-hidden
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-tile",
                selected ? "bg-accent-50 text-accent-600" : "bg-ink-100 text-ink-400"
              )}
            >
              <TriggerIcon className="size-3.5" />
            </span>
          ) : null}

          <span className="min-w-0 flex-1 truncate text-sm">
            {selected ? (
              <>
                <span className="font-medium text-heading">{selected.label}</span>
                {selected.meta ? (
                  <span className="text-subtle"> ({selected.meta})</span>
                ) : null}
              </>
            ) : (
              <span className="text-faint">{placeholder}</span>
            )}
          </span>

          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-ink-400 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-control border border-hairline bg-surface shadow-lg"
        >
          {searchable ? (
            <div className="border-b border-hairline p-2">
              <div className="flex h-9 items-center gap-2 rounded-control border border-hairline-strong bg-canvas px-2.5">
                <Search aria-hidden className="size-3.5 shrink-0 text-ink-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-sm text-body outline-none placeholder:text-faint"
                />
              </div>
            </div>
          ) : null}

          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-subtle">{emptyText}</p>
            ) : (
              filtered.map((option) => {
                const OptionIcon = option.icon;
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-tile px-2.5 py-2 text-left transition-colors",
                      isSelected ? "bg-accent-50" : "hover:bg-row-hover"
                    )}
                  >
                    {OptionIcon ? (
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-tile",
                          isSelected
                            ? "bg-accent-100 text-accent-600"
                            : "bg-ink-100 text-ink-500"
                        )}
                      >
                        <OptionIcon className="size-3.5" />
                      </span>
                    ) : null}

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-sm font-medium",
                          isSelected ? "text-accent-700" : "text-heading"
                        )}
                      >
                        {option.label}
                      </span>
                      {option.meta ? (
                        <span className="mt-0.5 block truncate text-[11px] text-subtle">
                          {option.meta}
                        </span>
                      ) : null}
                    </span>

                    {isSelected ? (
                      <Check aria-hidden className="size-4 shrink-0 text-accent-600" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {footer ? (
            <div className="border-t border-hairline bg-accent-50/60 px-3 py-2.5">
              {footer}
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
