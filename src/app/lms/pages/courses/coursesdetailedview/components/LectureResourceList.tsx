"use client"

// LectureResourceList.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Student "Resources" list — I Do → Lecture surface.
//
// Redesign brief:
//   Columns: Resource | Type | Added On | Details | Action
//   Toolbar: Search | Sort (Recommended Order / Recently Added / Oldest First / A-Z) | Filter
//   Filter panel (popover): Resource Type checkboxes · Added On radios · Sort radios · Reset / Apply
//   Active-filter chips below toolbar with Clear all
//   Count line: "N resources" or "M of N resources"
//   Empty state with Clear filters CTA
//
// Design system: reuses the shared `Resource` type and open-resource handler
// from the parent page. Uses Tailwind + inline `#F97316` orange to match the
// rest of the LMS course-detail shell.

import React, { useEffect, useMemo, useRef, useState } from "react"
import {
  Search, X, ArrowUpDown, ChevronDown, ChevronRight, Filter as FilterIcon,
  FileText, FileVideo, FileImage, File as FileIco, Folder as FolderIco,
  BookOpen, Link as LinkIcon, Presentation, Archive, Type as TypeIco,
  Calendar as CalendarIcon,
} from "lucide-react"
import type { Resource, ResourceType } from "./types/types"
// Reuse the SAME table + footer primitives the We Do Assignment list uses
// so both screens share row density, hover, empty-state chrome, sticky
// header, pager styling and column-percent widths. Anything a student
// learns on one page transfers to the other.
import DataTable, { type Column as DTColumn } from "@/app/lms/shared/listing/DataTable"
import TableFooter from "@/app/lms/shared/listing/TableFooter"

// ── Types ───────────────────────────────────────────────────────────────────

export type LectureSortOption =
  | "recommended"   // teacher-defined order (falls back to array order)
  | "recent"        // Recently Added (newest first)
  | "oldest"        // Oldest First
  | "az"            // A-Z

export type LectureFilterType =
  | "video" | "reading" | "pdf" | "slides" | "folder" | "section"

// Note: "last30" was removed at the user's request — the filter offers
// Today / Last 7 days / Custom range only.
export type AddedOnFilter =
  | "any" | "today" | "last7" | "custom"

export interface LectureResourceListProps {
  /** Every resource for the current activity (files + links + pages + reference). */
  resources: Resource[]
  /** Folders for the current activity (rendered as Type = Folder rows). */
  folders?: Resource[]
  /** Optional preloaded pages (Notion / rich-text) shown as Type = Section rows. */
  pages?: Array<{ id: string; title: string; combinedCode?: string; blocks?: any; _pageCount?: number }>
  /** Open handler — page.tsx's handleResourceClick — never mutated here. */
  onOpen: (r: Resource) => void
  isLoading?: boolean
  /** Optional slot to render above the toolbar (breadcrumb, banners). */
  headerSlot?: React.ReactNode
}

// ── Type + display mapping ─────────────────────────────────────────────────
// The reference image asks for six visible type labels: Section, Reading,
// PDF, Video, Slides, Folder. Every existing `Resource.type` maps into one
// of these buckets so we can label + filter uniformly.
type UiType = "section" | "reading" | "pdf" | "video" | "slides" | "folder"

const bucketFor = (r: Resource): UiType => {
  if (r.isFolder || r.type === "folder" as any) return "folder"
  switch (r.type) {
    case "video": return "video"
    case "pdf":   return "pdf"
    case "ppt":   return "slides"
    case "page":  return "section"
    case "reference":
    case "link":
    case "word":
    case "txt":
    case "image":
    case "zip":
    default:      return "reading"
  }
}

const UI_LABEL: Record<UiType, string> = {
  section: "Section",
  reading: "Reading",
  pdf: "PDF",
  video: "Video",
  slides: "Slides",
  folder: "Folder",
}

// Subtitle per row — short "what kind of thing" description. Falls back
// to the type label if the resource doesn't carry a richer subtitle field.
const SUBTITLE: Record<UiType, string> = {
  section: "Section",
  reading: "Reading Material",
  pdf: "Study Notes",
  video: "Video Lecture",
  slides: "Lecture Slides",
  folder: "Code Examples",
}

// Icon + soft-tone container per type — matches the reference image's
// premium look (subtle bg, no over-saturated pastel).
const ICON_TONE: Record<UiType, { bg: string; fg: string; Icon: any }> = {
  section: { bg: "#FFF4EC", fg: "#C2410C", Icon: BookOpen },
  reading: { bg: "#ECFDF3", fg: "#027A48", Icon: FileText },
  pdf:     { bg: "#FEF3F2", fg: "#B42318", Icon: FileText },
  video:   { bg: "#F4EBFF", fg: "#6941C6", Icon: FileVideo },
  slides:  { bg: "#FEF7C3", fg: "#A15C07", Icon: Presentation },
  folder:  { bg: "#EFF8FF", fg: "#175CD3", Icon: FolderIco },
}

// Type-badge tone — restrained, no shouting.
const BADGE_TONE: Record<UiType, { bg: string; fg: string; ring: string }> = {
  section: { bg: "#FFF4EC", fg: "#C2410C", ring: "rgba(249,115,22,0.20)" },
  reading: { bg: "#ECFDF3", fg: "#027A48", ring: "rgba(18,183,106,0.20)" },
  pdf:     { bg: "#FEF3F2", fg: "#B42318", ring: "rgba(240,68,56,0.20)" },
  video:   { bg: "#F4EBFF", fg: "#6941C6", ring: "rgba(158,119,237,0.20)" },
  slides:  { bg: "#FEF7C3", fg: "#A15C07", ring: "rgba(247,144,9,0.22)" },
  folder:  { bg: "#EFF8FF", fg: "#175CD3", ring: "rgba(46,144,250,0.22)" },
}

// ── Detail-string derivation ────────────────────────────────────────────────
// The "Details" column shows a learning-friendly hint of what's inside —
// pages / min / slides / resources — NOT raw file size. Uses whatever
// metadata the resource carries, with a sensible fallback per type so the
// column is never empty.
const detailsFor = (r: Resource, folderContentsCount?: number): string => {
  const ui = bucketFor(r)
  const anyR = r as any
  if (ui === "folder") {
    const n = folderContentsCount ?? (Array.isArray(anyR.folderContents) ? anyR.folderContents.length : undefined)
    return n != null ? `${n} ${n === 1 ? "resource" : "resources"}` : "Folder"
  }
  if (ui === "pdf") {
    const p = anyR._pageCount ?? anyR.pageCount ?? anyR.pages
    if (typeof p === "number" && p > 0) return `${p} pages`
    if (r.fileSize) return r.fileSize
    return "PDF"
  }
  if (ui === "slides") {
    const p = anyR._pageCount ?? anyR.slideCount ?? anyR.pages
    if (typeof p === "number" && p > 0) return `${p} slides`
    if (r.fileSize) return r.fileSize
    return "Slides"
  }
  if (ui === "video") {
    const dur = anyR.duration ?? anyR.durationMin ?? anyR.durationMinutes
    if (typeof dur === "number" && dur > 0) return `${dur} min`
    if (typeof dur === "string" && dur) return dur
    return "Video"
  }
  if (ui === "section") {
    const n = anyR._pageCount ?? (anyR.combinedCode ? undefined : anyR.pages?.length)
    if (typeof n === "number" && n > 1) return `${n} resources`
    return "Section"
  }
  // reading / link / doc — approximate "N min read" if we can, else generic.
  const words = typeof anyR.wordCount === "number" ? anyR.wordCount : null
  if (words && words > 0) return `${Math.max(1, Math.round(words / 200))} min read`
  return "Reading"
}

// ── Date helpers ────────────────────────────────────────────────────────────
const monthShort = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
const formatAddedOn = (iso?: string): string => {
  if (!iso) return "—"
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "—"
  return `${d.getDate()} ${monthShort[d.getMonth()]} ${d.getFullYear()}`
}
const timestampOf = (r: Resource): number => {
  const iso = r.uploadedAt as string | undefined
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

// ── Component ───────────────────────────────────────────────────────────────

export const LectureResourceList: React.FC<LectureResourceListProps> = ({
  resources, folders = [], pages = [], onOpen, isLoading, headerSlot,
}) => {
  // ── Search / sort / filters (URL-free local state) ────────────────────────
  const [query, setQuery] = useState("")
  const [sort, setSort] = useState<LectureSortOption>("recommended")
  const [showSort, setShowSort] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [typeFilters, setTypeFilters] = useState<Set<LectureFilterType>>(new Set())
  const [addedOn, setAddedOn] = useState<AddedOnFilter>("any")
  const [customFrom, setCustomFrom] = useState<string>("")
  const [customTo, setCustomTo] = useState<string>("")

  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const filterBtnRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)

  // Close menus on outside click
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      const t = e.target as Node
      if (sortMenuRef.current && !sortMenuRef.current.contains(t) && !sortBtnRef.current?.contains(t)) setShowSort(false)
      if (filterPanelRef.current && !filterPanelRef.current.contains(t) && !filterBtnRef.current?.contains(t)) setShowFilter(false)
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [])

  // ── Merge resources + folders + pages into one uniform list ───────────────
  // Sections (pages) get their own row so students see them alongside PDFs
  // + folders instead of hidden behind a type-tab.
  const merged: Resource[] = useMemo(() => {
    const asPageResource = (p: any): Resource => ({
      id: p.id,
      title: p.title,
      type: "page" as ResourceType,
      _pageCount: p._pageCount ?? (Array.isArray(p.pagesData) ? p.pagesData.length : undefined),
      uploadedAt: p.createdAt || p.updatedAt,
      _combinedCode: p.combinedCode,
    }) as any
    return [...folders, ...resources, ...pages.map(asPageResource)]
  }, [resources, folders, pages])

  // ── Filter → search → sort pipeline ───────────────────────────────────────
  const filtered = useMemo(() => {
    let out = merged
    // Type multi-select filter
    if (typeFilters.size > 0) {
      out = out.filter(r => typeFilters.has(bucketFor(r) as LectureFilterType))
    }
    // Added-on filter (based on uploadedAt)
    if (addedOn !== "any") {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      let from = 0, to = Date.now() + 1
      if (addedOn === "today")    { from = startOfDay; to = startOfDay + 24*60*60*1000 }
      else if (addedOn === "last7")  { from = startOfDay - 6 * 24*60*60*1000 }
      else if (addedOn === "custom") {
        if (customFrom) from = new Date(customFrom + "T00:00:00").getTime()
        if (customTo)   to   = new Date(customTo   + "T23:59:59").getTime()
      }
      out = out.filter(r => {
        const t = timestampOf(r)
        return t >= from && t <= to
      })
    }
    // Search — title + type-label + subtitle
    const q = query.trim().toLowerCase()
    if (q) {
      out = out.filter(r => {
        const ui = bucketFor(r)
        return (
          r.title?.toLowerCase().includes(q) ||
          UI_LABEL[ui].toLowerCase().includes(q) ||
          SUBTITLE[ui].toLowerCase().includes(q)
        )
      })
    }
    return out
  }, [merged, typeFilters, addedOn, customFrom, customTo, query])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sort) {
      case "recent":
        arr.sort((a, b) => timestampOf(b) - timestampOf(a)); break
      case "oldest":
        arr.sort((a, b) => timestampOf(a) - timestampOf(b)); break
      case "az":
        arr.sort((a, b) => (a.title || "").localeCompare(b.title || "")); break
      case "recommended":
      default:
        // Teacher-defined order = insertion order. Do nothing; `merged`
        // preserves the order the parent handed us (folders first, then
        // files, then pages), which is what the CMS delivers.
        break
    }
    return arr
  }, [filtered, sort])

  const totalCount = merged.length
  const showingCount = sorted.length

  // ── Pagination — dynamic rows/page matching the Assignment list ────────
  // A ResizeObserver on the table container computes how many rows fit
  // (viewport height minus header + footer, divided by row height), so
  // the last row of each page always sits flush with the pager and no
  // scrollbar ever appears — identical to the We Do Assignment table.
  // Search, sort or filter change snaps back to page 1 so the current
  // view is always showing the newest slice.
  const HEAD_H  = 40   // DataTable's h-10 header
  const FOOT_H  = 44   // TableFooter row
  const ROW_H   = 48   // DataTable body cell h-12
  const SAFETY  = Math.round(ROW_H / 2)   // never clip the last row
  const [pageSize, setPageSize] = useState(5)
  const [currentPage, setCurrentPage] = useState(1)
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return
    const compute = () => {
      const budget = Math.max(0, el.clientHeight - HEAD_H - FOOT_H - SAFETY)
      setPageSize(Math.max(3, Math.min(50, Math.floor(budget / ROW_H))))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const totalPages = Math.max(1, Math.ceil(showingCount / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const pagedResources = useMemo(
    () => sorted.slice(startIdx, startIdx + pageSize),
    [sorted, startIdx, pageSize],
  )
  useEffect(() => { setCurrentPage(1) }, [query, sort, typeFilters, addedOn, customFrom, customTo])

  // Dynamic Resource-Type filter set — only show checkboxes for types that
  // actually appear in this activity's resources. If the list has only PDFs
  // and slides, the filter offers PDF and Slides only (no Video/Reading
  // etc. that would produce empty results).
  const presentTypes: LectureFilterType[] = useMemo(() => {
    const seen = new Set<LectureFilterType>()
    for (const r of merged) seen.add(bucketFor(r) as LectureFilterType)
    // Preserve the canonical display order regardless of insertion order
    // so the checkbox column stays stable across renders.
    const order: LectureFilterType[] = ["video","reading","pdf","slides","folder","section"]
    return order.filter(t => seen.has(t))
  }, [merged])

  // ── Chip helpers ──────────────────────────────────────────────────────────
  const hasChips = typeFilters.size > 0 || addedOn !== "any"
  const removeType = (t: LectureFilterType) => {
    setTypeFilters(prev => { const n = new Set(prev); n.delete(t); return n })
  }
  const clearAll = () => { setTypeFilters(new Set()); setAddedOn("any"); setCustomFrom(""); setCustomTo("") }

  const sortLabel = ({
    recommended: "Recommended Order",
    recent: "Recently Added",
    oldest: "Oldest First",
    az: "A–Z",
  } as const)[sort]

  // ── Columns for the shared DataTable ────────────────────────────────────
  // Column widths mirror the We Do Assignment table (48/10/13/14/15) so
  // the two lists sit at the same rhythm. Filename gets the most room;
  // Action stays right-aligned so the Open button lands in a predictable
  // click zone. NO secondary description ("Study Notes", "Video Lecture"…)
  // per the user's ask — the icon + type badge already tell the story.
  const columns: DTColumn<Resource>[] = [
    {
      key: 'num',
      label: '#',
      // Same shape as the We Do Assignment list's row-number column so
      // both tables read identically at a glance.
      className: 'w-[4%] pl-4 pr-2 text-left text-[13px] text-faint tabular-nums align-middle whitespace-nowrap',
      skeletonWidth: '20px',
      render: (_r, i) => startIdx + i + 1,
    },
    {
      key: 'name',
      label: 'Resource',
      sortKey: 'name',
      className: 'w-[46%] px-3 text-left align-middle text-[13.5px]',
      skeletonWidth: '80%',
      render: (r) => {
        const ui = bucketFor(r)
        const tone = ICON_TONE[ui]
        const title = r.title || 'Untitled'
        return (
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex-shrink-0 inline-flex items-center justify-center rounded-lg"
              style={{ width: 32, height: 32, background: tone.bg, color: tone.fg }}
            >
              <tone.Icon size={16} />
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[14px] font-medium text-heading"
              title={title}
            >
              {title}
            </span>
          </div>
        )
      },
    },
    {
      key: 'type',
      label: 'Type',
      className: 'w-[10%] px-3 text-left align-middle text-[13px] text-body',
      render: (r) => {
        const ui = bucketFor(r)
        const b = BADGE_TONE[ui]
        return (
          <span
            className="inline-flex items-center rounded-full text-[12px] font-semibold whitespace-nowrap"
            style={{
              background: b.bg,
              color: b.fg,
              boxShadow: `inset 0 0 0 1px ${b.ring}`,
              height: 24,
              padding: '0 10px',
            }}
          >
            {UI_LABEL[ui]}
          </span>
        )
      },
    },
    {
      key: 'date',
      label: 'Added On',
      sortKey: 'date',
      className: 'w-[13%] px-3 text-left align-middle text-[13px] text-body whitespace-nowrap',
      render: (r) => (
        <span className="text-[13px] text-body">
          {formatAddedOn(r.uploadedAt as any)}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Details',
      className: 'w-[12%] px-3 text-left align-middle text-[13px] text-body whitespace-nowrap',
      render: (r) => {
        const folderCount = Array.isArray((r as any).folderContents) ? (r as any).folderContents.length : undefined
        return <span className="text-[13px] text-body">{detailsFor(r, folderCount)}</span>
      },
    },
    {
      key: 'action',
      label: 'Action',
      className: 'w-[15%] pl-3 pr-4 text-center align-middle whitespace-nowrap',
      render: (r) => (
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(r) }}
            className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded-control text-[13px] font-semibold transition-colors"
            style={{ border: '1px solid #F97316', color: '#F97316', background: '#FFFFFF' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FFF7ED' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF' }}
          >
            Open
            <ChevronRight size={13} />
          </button>
        </div>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // Root is a flex column that fills its parent's remaining height —
    // required so the ResizeObserver below can measure a real height and
    // compute rows/page dynamically. Horizontal padding gives the list
    // room to breathe on the left + right edge, matching the We Do
    // Assignment page shell (no full-bleed table).
    <div className="flex flex-col flex-1 min-h-0 gap-2.5 relative px-4 sm:px-5">
      {headerSlot}

      {/* Toolbar: search / sort / filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 h-9 px-3 flex-1 min-w-[200px] rounded-lg border border-gray-200 bg-white focus-within:border-gray-400 transition-colors">
          <Search size={14} className="flex-shrink-0 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search resources..."
            className="w-full bg-transparent border-none outline-none text-[13.5px] text-gray-700 placeholder:text-gray-400"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X size={11} className="text-gray-500" />
            </button>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <button
            ref={sortBtnRef}
            type="button"
            onClick={() => { setShowSort(v => !v); setShowFilter(false) }}
            className="h-9 px-3 rounded-lg border border-[#E4E7EC] bg-white flex items-center gap-1.5 text-[12.5px] font-medium hover:bg-gray-50 transition-colors"
            style={{ color: showSort ? "#F97316" : "#475569" }}
          >
            <ArrowUpDown size={13} />
            <span className="text-[#667085]">Sort by:</span>
            <span className="font-semibold text-[#101828]">{sortLabel}</span>
            <ChevronDown size={12} className={`transition-transform ${showSort ? "rotate-180" : ""}`} />
          </button>
          {showSort && (
            <div
              ref={sortMenuRef}
              className="absolute top-full right-0 mt-1 w-[200px] rounded-lg border border-[#E4E7EC] bg-white z-50 overflow-hidden"
              style={{ boxShadow: "0 8px 24px rgba(15,23,42,0.10)" }}
            >
              {([
                { v: "recommended", l: "Recommended Order" },
                { v: "recent",      l: "Recently Added" },
                { v: "oldest",      l: "Oldest First" },
                { v: "az",          l: "A–Z" },
              ] as { v: LectureSortOption; l: string }[]).map(({ v, l }) => {
                const sel = sort === v
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => { setSort(v); setShowSort(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] text-left hover:bg-gray-50 transition-colors"
                    style={{ color: sel ? "#F97316" : "#101828", background: sel ? "#FFF7ED" : undefined, fontWeight: sel ? 600 : 500 }}
                  >
                    {l}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Filter button (orange outlined) */}
        <button
          ref={filterBtnRef}
          type="button"
          onClick={() => { setShowFilter(v => !v); setShowSort(false) }}
          className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-[12.5px] font-semibold transition-colors"
          style={{
            border: "1px solid #F97316",
            background: showFilter ? "#FFF7ED" : "#FFFFFF",
            color: "#F97316",
          }}
        >
          <FilterIcon size={13} />
          Filter
          {hasChips && (
            <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10.5px] font-bold text-white" style={{ background: "#F97316" }}>
              {typeFilters.size + (addedOn !== "any" ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Filter popover — anchored to the right, per reference image.
          Widened to 400 px so the two-column Resource Type grid never
          wraps a label under its checkbox. On narrow viewports the
          `max-w` guard shrinks it to what actually fits so the popover
          never clips off the right edge. */}
      {showFilter && (
        <div
          ref={filterPanelRef}
          className="absolute mt-1 z-40 rounded-xl border border-[#E4E7EC] bg-white"
          style={{
            top: 0, right: 0, marginTop: 44,
            width: 400,
            maxWidth: 'calc(100vw - 48px)',
            boxShadow: "0 20px 48px rgba(15,23,42,0.14)",
            position: "absolute",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EEF0F3]">
            <span className="text-[14px] font-bold text-[#101828]">Filter</span>
            <button
              type="button"
              aria-label="Close filter"
              onClick={() => setShowFilter(false)}
              className="w-6 h-6 inline-flex items-center justify-center rounded-md hover:bg-gray-100"
            >
              <X size={14} className="text-[#667085]" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Resource Type multi-select — DYNAMIC: only types present in
                the current activity's resource list are offered. A list of
                only PDFs + slides shows only PDF + Slides here; the empty
                types aren't listed so the student can't run a filter that
                is guaranteed to return zero rows. */}
            <div>
              <div className="text-[11px] font-bold tracking-wider text-[#667085] uppercase mb-2">Resource Type</div>
              {presentTypes.length === 0 ? (
                <div className="text-[12px] text-[#98A2B3] italic">No resources to filter yet.</div>
              ) : (
                // Two-column grid at the popover's new 400 px width — each
                // column is roughly 175 px wide so even the longest label
                // ("Reading", "Section", "Folder" + icon) sits on one line
                // without wrapping. `whitespace-nowrap` on the label span
                // enforces the single-line rule so a longer future label
                // still can't push the checkbox into a second row.
                <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
                  {presentTypes.map(t => {
                    const checked = typeFilters.has(t)
                    const tone = ICON_TONE[t]
                    return (
                      <label key={t} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-[#F97316] shrink-0"
                          checked={checked}
                          onChange={() => {
                            setTypeFilters(prev => {
                              const n = new Set(prev)
                              if (n.has(t)) n.delete(t); else n.add(t)
                              return n
                            })
                          }}
                        />
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-[#101828] whitespace-nowrap">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded shrink-0" style={{ background: tone.bg, color: tone.fg }}>
                            <tone.Icon size={11} />
                          </span>
                          {UI_LABEL[t]}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Added On radios */}
            <div>
              <div className="text-[11px] font-bold tracking-wider text-[#667085] uppercase mb-2">Added On</div>
              <div className="space-y-2">
                {([
                  { v: "today",  l: "Today" },
                  { v: "last7",  l: "Last 7 days" },
                  { v: "custom", l: "Custom range" },
                ] as { v: AddedOnFilter; l: string }[]).map(({ v, l }) => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="lecture-added-on"
                      className="w-4 h-4 accent-[#F97316]"
                      checked={addedOn === v}
                      onChange={() => setAddedOn(v)}
                    />
                    <span className="text-[13px] text-[#101828]">{l}</span>
                  </label>
                ))}
                {addedOn === "custom" && (
                  // Wider popover leaves room for both date pickers to sit
                  // comfortably side-by-side without the input squishing.
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <label className="text-[11px] font-medium text-[#667085]">From
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-md border border-[#D0D5DD] text-[12.5px] text-[#101828] focus:border-[#F97316] focus:outline-none" />
                    </label>
                    <label className="text-[11px] font-medium text-[#667085]">To
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                        className="mt-1 w-full h-9 px-2.5 rounded-md border border-[#D0D5DD] text-[12.5px] text-[#101828] focus:border-[#F97316] focus:outline-none" />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Sort radios removed from the filter popover — the toolbar's
                own Sort dropdown is the single source of truth for sort. */}
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-[#EEF0F3]">
            <button
              type="button"
              onClick={clearAll}
              className="h-9 px-4 rounded-lg border border-[#D0D5DD] bg-white text-[13px] font-semibold text-[#344054] hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => setShowFilter(false)}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white"
              style={{ background: "#F97316" }}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Active-filter chips row — the plain "N resources" count is
          intentionally hidden per the user's ask (the pager's
          "Showing X–Y of Z" already carries that information). The row
          only renders when at least one chip is active. */}
      {hasChips && (
        <div className="flex items-center gap-2 flex-wrap min-h-[24px]">
            <span className="text-[#E4E7EC]">·</span>
            {[...typeFilters].map(t => (
              <span key={t} className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full text-[11.5px] font-semibold" style={{ background: "#FFF4EC", color: "#C2410C", border: "1px solid rgba(249,115,22,0.20)" }}>
                {UI_LABEL[t]}
                <button
                  type="button"
                  aria-label={`Remove ${UI_LABEL[t]} filter`}
                  onClick={() => removeType(t)}
                  className="w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-white/70"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {addedOn !== "any" && (
              <span className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full text-[11.5px] font-semibold" style={{ background: "#EFF8FF", color: "#175CD3", border: "1px solid rgba(46,144,250,0.22)" }}>
                {addedOn === "today" ? "Today" : addedOn === "last7" ? "Last 7 days" : "Custom range"}
                <button
                  type="button"
                  aria-label="Remove date filter"
                  onClick={() => { setAddedOn("any"); setCustomFrom(""); setCustomTo("") }}
                  className="w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-white/70"
                >
                  <X size={10} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="text-[12px] font-semibold text-[#F97316] hover:underline ml-1"
            >
              Clear all
            </button>
        </div>
      )}

      {/* Table — reuses the DataTable primitive so density, hover, sort-header
          arrow, sticky header, empty-state chrome and pager styling match the
          We Do Assignment list exactly. Columns are widths-as-percentages so
          the layout can never overflow horizontally (fixedLayout + minWidth). */}
      {/* Assignment-list styling: no outer border, no rounded corners, no
          left/right sidewalls. DataTable brings its own gray sticky thead
          and hairline row separators; wrapper just gives the ResizeObserver
          a real height to measure so pageSize adapts to the viewport. */}
      <div ref={tableAreaRef} className="bg-white flex flex-1 min-h-0 flex-col">
        <DataTable<Resource>
          rows={pagedResources}
          columns={columns}
          rowKey={(r) => r.id}
          sortKey={sort === 'az' ? 'name' : sort === 'recent' || sort === 'oldest' ? 'date' : null}
          sortDir={sort === 'oldest' || sort === 'az' ? 'asc' : 'desc'}
          onSort={(key) => {
            // Header-click sort: name toggles A-Z, date toggles recent/oldest.
            if (key === 'name') setSort('az')
            else if (key === 'date') setSort(sort === 'recent' ? 'oldest' : 'recent')
          }}
          isLoading={!!isLoading}
          isFiltered={query.trim().length > 0 || hasChips}
          fixedLayout
          fillHeight
          emptyTitle={merged.length === 0 ? 'No resources yet' : 'No matching resources'}
          emptyHint={merged.length === 0
            ? 'This activity has no content yet.'
            : 'Try adjusting your search or filters.'}
          emptyAction={(query || hasChips) ? 'Clear filters' : undefined}
          onEmptyAction={() => { setQuery(''); clearAll() }}
        />
        <TableFooter
          currentPage={safePage}
          totalPages={totalPages}
          onPage={setCurrentPage}
          from={showingCount === 0 ? 0 : startIdx + 1}
          to={Math.min(startIdx + pageSize, showingCount)}
          total={showingCount}
          pageSize={pageSize}
          onPageSize={() => { /* fixed — no size selector; pageSize adapts to viewport */ }}
        />
      </div>
    </div>
  )
}

export default LectureResourceList
