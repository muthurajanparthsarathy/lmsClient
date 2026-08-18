"use client";

/**
 * DataTable — the console's shared list surface.
 *
 * Built on flex rows with ARIA grid roles rather than <table>, for one reason:
 * a real table cannot reflow. Its cells are locked to their column, so a narrow
 * viewport leaves you choosing between truncation and a sideways scrollbar.
 * Here each row collapses to a labelled card below `md`, so the same markup
 * reads correctly from 320px to 2560px with no horizontal scroll anywhere.
 *
 * Rows are cards, not ruled table lines: an operational list is scanned
 * row-at-a-time, and a bounded card gives the eye a target that a hairline
 * between two dense rows does not.
 *
 * Sorting, searching and filtering are all client-side and uncontrolled by
 * default — callers pass data and a column spec, nothing else.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, SlidersHorizontal, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  /** Stable id — also the sort key. */
  key: string;
  header: string;
  /** Width / growth classes. Defaults to a flexible column. */
  className?: string;
  /** Extra classes for the HEADER cell only. Use when the cell renders a
      leading element — an avatar, an icon, a checkbox — that pushes its real
      text inward: the header has no such element, so without an offset it
      lines up with the avatar rather than with the name the eye reads as the
      column's content. */
  headerClassName?: string;
  /** Desktop alignment of both the header and its values. "center" puts each
      value under the middle of its heading; "right" gives the column a shared
      right edge, which lines digits up for comparison down the column. */
  align?: "left" | "right" | "center";
  /** Renders the cell. */
  cell: (row: T) => ReactNode;
  /** Comparable value. Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  /** Hide the field label in the stacked mobile card (for the title column). */
  hideLabelOnMobile?: boolean;
}

export interface FilterDef<T> {
  key: string;
  label: string;
  options: { value: string; label: string; match: (row: T) => boolean }[];
}

export type DataTableUnit = string | { one: string; many: string };

export interface DataTableProps<T> {
  /** Heading above the table. OMIT when the page's own <h1> already names this
      list — passing "All clients" under an <h1>Clients</h1> just says the same
      word twice and costs a whole toolbar row. With no title the count chip
      moves down beside the search and the heading row disappears entirely. */
  title?: string;
  /** Accessible name for the grid. Required when `title` is omitted, since the
      grid and the search box would otherwise have nothing to be labelled by. */
  ariaLabel?: string;
  /** What the rows ARE, for the count chip: "13 clients" rather than "13". Pass
      the singular and it is pluralised, or pass both for irregulars
      ({ one: "person", many: "people" }). Omit and it is derived from
      `ariaLabel`/`title`; if that yields nothing the chip stays a bare number. */
  unit?: DataTableUnit;
  data: T[];
  columns: Column<T>[];
  getRowKey: (row: T, index: number) => string;
  /** Free-text search source. Omit to hide the search box. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: FilterDef<T>[];
  /** Rendered right of the title, e.g. a summary chip row. */
  toolbar?: ReactNode;
  emptyTitle?: string;
  emptyHint?: string;
  /** Rows per page on first render; the user can change it from the footer. */
  pageSize?: number;
  /** Offered in the rows-per-page control. `pageSize` is merged in if missing. */
  pageSizeOptions?: number[];
  /**
   * Fill the parent's height instead of growing with the rows: the toolbar and
   * the pager stay put and only the row area scrolls, with the column header
   * pinned. The parent must be a flex/grid child with a bounded height —
   * otherwise there is no height to fill and this does nothing.
   */
  fillHeight?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
}

/** Page numbers around the current one, with gaps marked `null`. */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | null)[] = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(total - 1, current + 1);
  if (from > 2) out.push(null);
  for (let p = from; p <= to; p += 1) out.push(p);
  if (to < total - 1) out.push(null);
  out.push(total);
  return out;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

/** Above this many options a filter renders as a select rather than chips. */
const CHIP_LIMIT = 5;

/* ── Naming the count ──────────────────────────────────────────────────────
   The count chip used to read as a bare "13". That was survivable while it sat
   immediately right of the <h2> title, which supplied the noun; once an
   untitled table moves the chip down beside the search it has nothing left to
   inherit and says nothing at all.

   Rather than make every caller pass a noun, derive one from the table's own
   accessible name ("Clients" → clients) and fall back to today's bare number
   whenever the guess would be a coin-flip. A WRONG noun is much worse than no
   noun, so the test is deliberately strict. */

/** Words ending in -s that are not plurals. */
const NON_PLURAL = /(ss|us|is|os)$/;
const NOT_A_UNIT = new Set(["this", "its", "yours", "hers", "news", "plus", "less", "across", "versus"]);

/** "Clients" → "clients" · "Results by course" → "results" · "Waiting on you" → null */
function nounFromLabel(label?: string): string | null {
  if (!label) return null;
  const words = label.split(/[^\p{L}]+/u).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i].toLowerCase();
    if (w.length < 4 || !w.endsWith("s") || NON_PLURAL.test(w) || NOT_A_UNIT.has(w)) continue;
    return w;
  }
  return null;
}

function pluralOf(one: string): string {
  if (/(s|x|z|ch|sh)$/.test(one)) return `${one}es`;
  if (/[^aeiou]y$/.test(one)) return `${one.slice(0, -1)}ies`;
  return `${one}s`;
}

function singularOf(many: string): string {
  if (many.endsWith("ies")) return `${many.slice(0, -3)}y`;
  if (/(ch|sh|ss|x|z)es$/.test(many)) return many.slice(0, -2);
  return many.endsWith("s") ? many.slice(0, -1) : many;
}

function resolveUnit(unit: DataTableUnit | undefined, label?: string) {
  if (typeof unit === "string") return { one: unit, many: pluralOf(unit) };
  if (unit) return unit;
  const derived = nounFromLabel(label);
  return derived ? { one: singularOf(derived), many: derived } : null;
}

export function DataTable<T>({
  title,
  ariaLabel,
  unit,
  data,
  columns,
  getRowKey,
  searchText,
  searchPlaceholder = "Search…",
  filters = [],
  toolbar,
  emptyTitle = "Nothing to show",
  emptyHint,
  pageSize = 20,
  pageSizeOptions = [10, 20, 50],
  fillHeight = false,
  onRowClick,
  className,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<SortState>(null);
  const [size, setSize] = useState(pageSize);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let out = data;

    const q = query.trim().toLowerCase();
    if (q && searchText) {
      out = out.filter((r) => searchText(r).toLowerCase().includes(q));
    }

    filters.forEach((f) => {
      const chosen = active[f.key];
      if (!chosen || chosen === "all") return;
      const opt = f.options.find((o) => o.value === chosen);
      if (opt) out = out.filter(opt.match);
    });

    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        const get = col.sortValue;
        out = [...out].sort((a, b) => {
          const av = get(a);
          const bv = get(b);
          const cmp =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv), undefined, { numeric: true });
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }

    return out;
  }, [data, query, active, sort, filters, columns, searchText]);

  // Narrowing the set can strand the viewer on a page that no longer exists —
  // go back to the first page whenever the result set or page size changes.
  useEffect(() => {
    setPage(1);
  }, [query, active, size, data.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * size;
  const visible = filtered.slice(start, start + size);

  const sizes = useMemo(
    () => Array.from(new Set([...pageSizeOptions, pageSize])).sort((a, b) => a - b),
    [pageSizeOptions, pageSize],
  );

  const hasFilters = filters.length > 0 || !!searchText;
  const isNarrowed = query.trim() !== "" || Object.values(active).some((v) => v && v !== "all");

  const toggleSort = (key: string) => {
    setSort((s) =>
      s?.key !== key ? { key, dir: "desc" } : s.dir === "desc" ? { key, dir: "asc" } : null,
    );
  };

  const clearAll = () => {
    setQuery("");
    setActive({});
  };

  // Rendered either beside the heading or, when there is no heading, beside the
  // search — same chip, one definition.
  // The noun agrees with data.length, not filtered.length: "1 of 13 clients"
  // reads correctly, "1 of 13 client" does not.
  const units = resolveUnit(unit, ariaLabel ?? title);
  const noun = units ? ` ${data.length === 1 ? units.one : units.many}` : "";
  const countChip = (
    <span className="rounded-chip bg-ink-100 px-1.5 py-0.5 text-2xs font-semibold whitespace-nowrap tabular-nums text-subtle dark:bg-ink-800">
      {isNarrowed
        ? `${filtered.length.toLocaleString()} of ${data.length.toLocaleString()}${noun}`
        : data.length === 0 && units
          ? `No ${units.many}`
          : `${data.length.toLocaleString()}${noun}`}
    </span>
  );

  // Falls back so an untitled table still has an accessible name.
  const gridLabel = title ?? ariaLabel ?? "Results";

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-tile border border-hairline bg-surface shadow-xs",
        fillHeight && "h-full min-h-0",
        className,
      )}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <header className="flex shrink-0 flex-col gap-3 border-b border-hairline p-3 sm:p-4">
        {(title || toolbar) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {title && (
              <>
                <h2 className="text-md font-semibold tracking-[-0.01em] text-heading">{title}</h2>
                {countChip}
              </>
            )}
            {toolbar && <div className="ml-auto flex flex-wrap items-center gap-1.5">{toolbar}</div>}
          </div>
        )}

        {hasFilters && (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            {/* No count chip here. An untitled table has no heading for it to
                belong to, so beside the search it reads as a floating number
                with nothing to attach to — and the pager below already states
                the total ("Showing 1–10 of 13"). The chip stays only where it
                has an anchor: immediately right of a title. */}
            {searchText && (
              <div className="relative min-w-0 lg:max-w-xs lg:flex-1">
                <Search
                  size={14}
                  strokeWidth={2.2}
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={`Search ${gridLabel.toLowerCase()}`}
                  className="w-full rounded-control border border-hairline bg-surface-sunken py-1.5 pr-7 pl-8 text-sm text-body outline-none transition-colors duration-fast placeholder:text-faint hover:border-hairline-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:bg-ink-800/40"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-chip p-0.5 text-faint outline-none transition-colors duration-fast hover:text-body focus-visible:ring-2 focus-visible:ring-brand-500/40"
                  >
                    <X size={13} strokeWidth={2.4} aria-hidden />
                  </button>
                )}
              </div>
            )}

            {filters.map((f) => {
              // Chips are only legible up to a handful of options. A dimension
              // with many values (clients, statuses pulled from live data)
              // becomes a select instead — 11 chips wrapping over two rows is
              // noise, not a control.
              const asSelect = f.options.length > CHIP_LIMIT;
              const chosen = active[f.key] || "all";

              if (asSelect) {
                return (
                  <label key={f.key} className="flex min-w-0 items-center gap-1.5">
                    <span className="sr-only">{f.label}</span>
                    <SlidersHorizontal size={13} aria-hidden className="shrink-0 text-faint" />
                    <select
                      value={chosen}
                      onChange={(e) => setActive((s) => ({ ...s, [f.key]: e.target.value }))}
                      className={cn(
                        "min-w-0 max-w-56 flex-1 truncate rounded-control border py-1.5 pr-7 pl-2.5 text-xs font-medium outline-none",
                        "cursor-pointer transition-colors duration-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25",
                        chosen !== "all"
                          ? "border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                          : "border-hairline bg-surface-sunken text-body hover:border-hairline-strong dark:bg-ink-800/40",
                      )}
                    >
                      <option value="all">{f.label}</option>
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              return (
                <div key={f.key} className="flex min-w-0 items-center gap-1.5">
                  <SlidersHorizontal size={13} aria-hidden className="shrink-0 text-faint lg:hidden" />
                  <div
                    role="group"
                    aria-label={f.label}
                    className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {[{ value: "all", label: f.label }, ...f.options].map((o) => {
                      const on = chosen === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setActive((s) => ({ ...s, [f.key]: o.value }))}
                          className={cn(
                            "shrink-0 rounded-chip border px-2.5 py-1 text-xs font-medium whitespace-nowrap outline-none",
                            "transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-brand-500/40",
                            on
                              ? "border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                              : "border-hairline bg-surface-sunken text-subtle hover:border-hairline-strong hover:text-body dark:bg-ink-800/40",
                          )}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {isNarrowed && (
              <button
                type="button"
                onClick={clearAll}
                className="shrink-0 self-start rounded-chip px-1.5 py-1 text-xs font-medium text-brand-700 outline-none transition-colors duration-fast hover:underline focus-visible:ring-2 focus-visible:ring-brand-500/40 lg:ml-auto lg:self-auto dark:text-brand-400"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </header>

      {/* ── Grid ────────────────────────────────────────────────────────── */}
      {/* role=grid only when rows are focus stops. A `table` whose rows carry
          tabIndex is invalid — static content cannot be a tab target — but
          promoting a read-only list to `grid` would over-promise interaction
          it does not have. So the role follows the behaviour. */}
      <div
        role={onRowClick ? "grid" : "table"}
        aria-label={gridLabel}
        aria-rowcount={filtered.length}
        className={cn("min-w-0", fillHeight && "min-h-0 flex-1 overflow-y-auto")}
      >
        {/* Column headers — desktop only; below md each cell carries its label.
            Pinned when the row area scrolls, so the columns stay readable. */}
        <div
          role="row"
          className={cn(
            "hidden items-center gap-4 border-b border-hairline px-4 py-2 md:flex",
            fillHeight && "sticky top-0 z-[1] bg-surface",
          )}
        >
          {columns.map((c) => {
            const sortable = !!c.sortValue;
            const activeSort = sort?.key === c.key;
            const Ico = !activeSort ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
            return (
              <div
                key={c.key}
                role="columnheader"
                aria-sort={activeSort ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                className={cn(
                  "min-w-0 flex-1",
                  c.className,
                  c.align === "right" && "text-right",
                  c.align === "center" && "text-center",
                  c.headerClassName,
                )}
              >
                {sortable ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className={cn(
                      // nowrap: callers pin numeric columns to a fixed width, and
                      // a header that wraps there ("STUDENTS" over two lines)
                      // silently changes the height of the whole header row.
                      "group inline-flex items-center gap-1 rounded-chip text-2xs font-semibold tracking-wide whitespace-nowrap uppercase outline-none",
                      "transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-brand-500/40",
                      activeSort ? "text-brand-700 dark:text-brand-400" : "text-subtle hover:text-body",
                      c.align === "right" && "flex-row-reverse",
                      // Centred columns take the sort icon OUT of flow (below).
                      // In flow it still occupies 11px + gap-1 even at
                      // opacity-0, which would shift the label ~7px off centre
                      // and leave the value below it visibly not lined up.
                      c.align === "center" && "relative",
                    )}
                  >
                    {c.header}
                    <Ico
                      size={11}
                      strokeWidth={2.4}
                      aria-hidden
                      className={cn(
                        "shrink-0 transition-opacity duration-fast",
                        activeSort ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                        c.align === "center" && "absolute top-1/2 left-full ml-0.5 -translate-y-1/2",
                      )}
                    />
                  </button>
                ) : (
                  <span className="text-2xs font-semibold tracking-wide whitespace-nowrap text-subtle uppercase">
                    {c.header}
                  </span>
                )}
              </div>
            );
          })}
          {/* Reserves the width the rows' chevron occupies. Without it the
              header's flexible column is 14px + gap wider than the rows', and
              every right-aligned column below drifts out of register. */}
          {onRowClick && <span aria-hidden className="w-3.5 shrink-0" />}
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <span className="mb-2 inline-flex size-9 items-center justify-center rounded-full bg-ink-100 text-subtle dark:bg-ink-800">
              <Search size={16} strokeWidth={2} aria-hidden />
            </span>
            <p className="text-sm font-medium text-body">
              {isNarrowed ? "No matches" : emptyTitle}
            </p>
            <p className="mt-1 max-w-[42ch] text-xs text-subtle">
              {isNarrowed
                ? "Try a different search term or clear the filters."
                : emptyHint}
            </p>
            {isNarrowed && (
              <button
                type="button"
                onClick={clearAll}
                className="mt-3 rounded-control border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-body outline-none transition-colors duration-fast hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          // md:px-0 — the container drops its horizontal padding from md so each
          // row's own px-4 lines up exactly with the px-4 on the header row.
          // With padding on both, rows sat 8px right of their column headers.
          <div className="flex flex-col gap-2 p-2 sm:gap-1.5 sm:p-3 md:gap-0.5 md:px-0 md:py-2">
            {visible.map((row, i) => {
              const interactive = !!onRowClick;
              return (
                <div
                  key={getRowKey(row, i)}
                  role="row"
                  {...(interactive
                    ? {
                        tabIndex: 0,
                        onClick: () => onRowClick(row),
                        onKeyDown: (e: React.KeyboardEvent) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        },
                      }
                    : {})}
                  className={cn(
                    // Card row below md; flat hover row from md up, where the
                    // column headers already give the eye its structure.
                    "flex flex-col gap-2 rounded-control border border-hairline bg-surface-sunken p-3",
                    "md:flex-row md:items-center md:gap-4 md:border-transparent md:bg-transparent md:px-4 md:py-2.5",
                    "outline-none transition-colors duration-fast",
                    "dark:bg-ink-800/30 dark:md:bg-transparent",
                    // Hover belongs ONLY to rows that actually do something. It
                    // used to be unconditional, so the app's read-only tables lit
                    // up under the cursor exactly like the clickable ones — which
                    // made the highlight meaningless on both. ring-inset because
                    // fillHeight puts the rows in an overflow-y-auto box that
                    // clips an outset ring at the left and right edges.
                    interactive &&
                      "group/row cursor-pointer hover:border-hairline-strong focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset md:hover:border-transparent md:hover:bg-row-hover dark:md:hover:bg-ink-800/50",
                  )}
                >
                  {columns.map((c) => (
                    <div
                      key={c.key}
                      role="cell"
                      className={cn(
                        "flex min-w-0 items-center justify-between gap-3 md:block md:flex-1",
                        c.className,
                        c.align === "right" && "md:text-right",
                        c.align === "center" && "md:text-center",
                      )}
                    >
                      {!c.hideLabelOnMobile && (
                        <span className="shrink-0 text-2xs font-medium text-subtle md:hidden">
                          {c.header}
                        </span>
                      )}
                      {/* Below md the value sits right of its label, so it is
                          right-aligned. From md the cell becomes a column and
                          must follow the column's own alignment.
                          NB: `text-inherit` does NOT reset this — it is a COLOR
                          utility in Tailwind, not text-align. */}
                      <div
                        className={cn(
                          "min-w-0 text-right",
                          c.align === "right"
                            ? "md:text-right"
                            : c.align === "center"
                              ? "md:text-center"
                              : "md:text-left",
                        )}
                      >
                        {c.cell(row)}
                      </div>
                    </div>
                  ))}
                  {/* Says "this row goes somewhere". Desktop only — the mobile
                      card is already tappable at full width. */}
                  {interactive && (
                    <ChevronRight
                      size={14}
                      strokeWidth={2.4}
                      aria-hidden
                      className="hidden shrink-0 text-faint transition-colors duration-fast group-focus-visible/row:text-brand-700 group-hover/row:text-brand-700 md:block dark:group-focus-visible/row:text-brand-400 dark:group-hover/row:text-brand-400"
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pager ───────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <footer className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline px-3 py-2.5 sm:px-4">
          <p className="text-2xs text-subtle">
            Showing{" "}
            <b className="font-semibold tabular-nums text-body">
              {(start + 1).toLocaleString()}–{(start + visible.length).toLocaleString()}
            </b>{" "}
            of <b className="font-semibold tabular-nums text-body">{filtered.length.toLocaleString()}</b>
          </p>

          <label className="flex items-center gap-1.5 text-2xs text-subtle">
            <span className="hidden sm:inline">Rows</span>
            <select
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="cursor-pointer rounded-control border border-hairline bg-surface-sunken py-1 pr-6 pl-2 text-xs font-medium text-body outline-none transition-colors duration-fast hover:border-hairline-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 dark:bg-ink-800/40"
            >
              {sizes.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          {totalPages > 1 && (
            <nav aria-label="Pagination" className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(current - 1)}
                disabled={current <= 1}
                aria-label="Previous page"
                className="inline-flex size-7 items-center justify-center rounded-control border border-hairline text-subtle outline-none transition-colors duration-fast hover:bg-row-hover hover:text-body focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft size={14} strokeWidth={2.4} aria-hidden />
              </button>

              {pageWindow(current, totalPages).map((p, i) =>
                p === null ? (
                  <span key={`gap-${i}`} aria-hidden className="px-1 text-2xs text-faint">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={p === current ? "page" : undefined}
                    className={cn(
                      "inline-flex size-7 items-center justify-center rounded-control border text-xs font-medium tabular-nums outline-none",
                      "transition-colors duration-fast focus-visible:ring-2 focus-visible:ring-brand-500/40",
                      p === current
                        ? "border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                        : "border-hairline text-subtle hover:bg-row-hover hover:text-body",
                    )}
                  >
                    {p}
                  </button>
                ),
              )}

              <button
                type="button"
                onClick={() => setPage(current + 1)}
                disabled={current >= totalPages}
                aria-label="Next page"
                className="inline-flex size-7 items-center justify-center rounded-control border border-hairline text-subtle outline-none transition-colors duration-fast hover:bg-row-hover hover:text-body focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight size={14} strokeWidth={2.4} aria-hidden />
              </button>
            </nav>
          )}
        </footer>
      )}
    </section>
  );
}
