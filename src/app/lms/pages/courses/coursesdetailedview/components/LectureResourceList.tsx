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

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Search, X, ArrowUpDown, ChevronDown, Filter as FilterIcon,
  FileText, FileVideo, Folder as FolderIco, ChevronRight,
  BookOpen, Presentation, Link2, FileArchive, FileType, Bookmark,
  Image as ImageIcon,
} from "lucide-react"
import type { Resource, ResourceType } from "./types/types"
import { groupResources, type GroupRow } from "./types/utils"
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

// ── Staff-list look ─────────────────────────────────────────────────────────
// Rows are drawn the way the staff upload list draws them (uploadcourseresources
// → Coursecontent.tsx: getFileMeta, renderFileRow, the group header) — same
// file artwork, icon sizes, outlined type chip and type scale — so a trainer
// and a student looking at the same activity see the same list. A local copy:
// the staff tokens live inside that component and are not exported.
const S = {
  orange: "#E8640C",
  orangeLight: "rgba(232,100,12,0.08)",
  textMain: "#0F172A",
  textSub: "#334155",
  textMuted: "#475569",
  textHint: "#64748B",
  border: "#eef0f4",
}

const extOf = (r: Resource): string => {
  const url = typeof r.fileUrl === "string" ? r.fileUrl : r.fileUrl?.base
  for (const src of [r.fileName, r.title, url]) {
    const m = (src || "").split("?")[0].match(/\.([a-z0-9]+)$/i)
    if (m) return m[1].toLowerCase()
  }
  return ""
}

/** File artwork + type-chip label — the staff list's getFileMeta, by Resource.type. */
const fileVisual = (r: Resource): { img?: string; Icon: any; color: string; label: string } => {
  const ext = extOf(r)
  if (r.isFolder || (r.type as string) === "folder") return { img: "/icons/folder.png", Icon: FolderIco, color: S.orange, label: "Folder" }
  switch (r.type) {
    case "page":      return { img: "/icons/page.png",  Icon: BookOpen,     color: "#6366f1", label: "Page" }
    case "link":      return { img: "/icons/link.png",  Icon: Link2,        color: "#0ea5e9", label: "Link" }
    case "reference": return {                          Icon: Bookmark,     color: "#8b5cf6", label: "Ref" }
    case "pdf":       return { img: "/icons/pdf.png",   Icon: FileText,     color: "#dc2626", label: "PDF" }
    case "ppt":       return { img: "/icons/ppt.png",   Icon: Presentation, color: "#ea580c", label: ext || "ppt" }
    case "video":     return { img: "/icons/video.png", Icon: FileVideo,    color: "#8b5cf6", label: ext || "video" }
    case "zip":       return { img: "/icons/zip.png",   Icon: FileArchive,  color: "#d97706", label: ext || "zip" }
    case "word":      return {                          Icon: FileType,     color: "#2563eb", label: ext || "doc" }
    case "image":     return {                          Icon: ImageIcon,    color: "#14b8a6", label: ext || "img" }
    default:          return {                          Icon: FileText,     color: "#64748b", label: ext || "file" }
  }
}

/** 20px artwork in a 22px box at the top level; 18px in 20px inside a group — as staff. */
const FileGlyph: React.FC<{ r: Resource; nested?: boolean }> = ({ r, nested }) => {
  const v = fileVisual(r)
  const box = nested ? 20 : 22
  if (v.img) {
    return (
      <span className="flex-shrink-0 flex items-center justify-center" style={{ width: box, height: box }}>
        <img src={v.img} alt={v.label} style={{ width: box - 2, height: box - 2, objectFit: "contain", display: "block" }} />
      </span>
    )
  }
  return (
    <span
      className="flex-shrink-0 flex items-center justify-center"
      style={{
        width: box, height: box, borderRadius: nested ? 5 : 6, color: v.color,
        background: `${v.color}16`, border: `1px solid ${v.color}28`,
      }}
    >
      <v.Icon size={nested ? 11 : 12} strokeWidth={1.9} />
    </span>
  )
}

/** The staff list's outlined, upper-case type chip. */
const TypeChip: React.FC<{ label: string }> = ({ label }) => (
  <span
    style={{
      fontSize: 10.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
      textTransform: "uppercase", letterSpacing: "0.05em",
      background: "transparent", color: S.textHint, border: `1px solid ${S.border}`,
      whiteSpace: "nowrap",
    }}
  >
    {label}
  </span>
)

// ── Size derivation ─────────────────────────────────────────────────────────
// A resource's size arrives as bytes ("128737") or already formatted
// ("125.7 KB"); both are read back to bytes so a group can total them.
const parseBytes = (raw: unknown): number => {
  if (raw == null) return 0
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? raw : 0
  if (typeof raw !== 'string') return 0
  const s = raw.trim()
  if (!s || s === '-' || s === '0') return 0
  // Numeric string ("128737") — already bytes.
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  // Human string ("125.7 KB", "1.4 MB", "500B") — convert to bytes.
  const m = s.toLowerCase().match(/^([\d.]+)\s*(kb|mb|gb|b)?$/)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (!Number.isFinite(n) || n <= 0) return 0
  const unit = m[2] || 'b'
  if (unit === 'gb') return n * 1024 * 1024 * 1024
  if (unit === 'mb') return n * 1024 * 1024
  if (unit === 'kb') return n * 1024
  return n
}

// Staff list formats: a file's size ("43.6 KB", "—" when there is none) and a
// group's total ("92 KB", never blank).
const fmtSize = (b: number): string => {
  if (!b) return "—"
  const k = 1024, s = ["B", "KB", "MB", "GB"], i = Math.floor(Math.log(b) / Math.log(k))
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${s[i]}`
}
const fmtFolderSize = (b: number): string => {
  if (!b || b <= 0) return "0 KB"
  const kb = b / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`
  const gb = mb / 1024
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`
}

// Folders, pages and links have no byte count of their own; every uploaded
// file does — zip, image and Word included, as on the staff list.
const bytesFor = (r: Resource): number => {
  if (r.isFolder || (r.type as string) === 'folder') return 0
  if (r.type === 'page' || r.type === 'link' || r.type === 'reference') return 0
  const anyR = r as any
  return parseBytes(r.fileSize ?? anyR.size ?? anyR.bytes)
}

// ── Date helpers ────────────────────────────────────────────────────────────
// Staff list format: "2026-09-28 12:04".
const formatDateTime = (input?: string | number | null): string => {
  if (!input) return "—"
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const timestampOf = (r: Resource): number => {
  const iso = r.uploadedAt as string | undefined
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

// ── Groups ──────────────────────────────────────────────────────────────────
// Staff upload several files at once as a GROUP ("foundation" → two decks),
// and the upload screen shows it as one expandable row with the files nested
// under it. Students see the same shape here, rather than the group's files
// scattered through the list as unrelated rows.
type GroupStats = { count: number; bytes: number; latest: number }

const groupStats = (g: GroupRow): GroupStats => {
  let count = 0, bytes = 0, latest = 0
  const walk = (x: GroupRow) => {
    for (const r of x.items) {
      count++
      bytes += bytesFor(r)
      latest = Math.max(latest, timestampOf(r))
    }
    x.subGroups.forEach(walk)
  }
  walk(g)
  return { count, bytes, latest }
}

type GroupDisplayRow = {
  kind: "group"; key: string; group: GroupRow; stats: GroupStats
  depth: number; num?: number; expanded: boolean
  /** A repeat of the header at the top of a page that opens mid-group. */
  continued?: boolean
  ancestors: GroupDisplayRow[]
}
type ItemDisplayRow = {
  kind: "item"; key: string; resource: Resource
  depth: number; num?: number
  /** Last child of its group — draws "└" instead of "├". */
  last?: boolean
  ancestors: GroupDisplayRow[]
}
type DisplayRow = GroupDisplayRow | ItemDisplayRow

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
          r.groupName?.toLowerCase().includes(q) ||
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

  // ── Group → display rows ──────────────────────────────────────────────────
  // groupResources keeps the sorted order: a group sits where its first
  // (best-ranked) file would, and its files keep the chosen sort inside it.
  // Groups open by default, like the staff upload list. While searching or
  // filtering every group is forced open — a match tucked inside a collapsed
  // group would read as "no results".
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleGroup = (id: string) => setCollapsed(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })
  const forceOpen = query.trim().length > 0 || typeFilters.size > 0 || addedOn !== "any"

  const displayRows: DisplayRow[] = useMemo(() => {
    const out: DisplayRow[] = []
    const addGroup = (g: GroupRow, depth: number, ancestors: GroupDisplayRow[], num?: number) => {
      const expanded = forceOpen || !collapsed.has(g.groupId)
      const head: GroupDisplayRow = {
        kind: "group", key: `g:${g.groupId}`, group: g, stats: groupStats(g),
        depth, num, expanded, ancestors,
      }
      out.push(head)
      if (!expanded) return
      const chain = [...ancestors, head]
      const childCount = g.items.length + g.subGroups.length
      g.items.forEach((r, i) => out.push({
        kind: "item", key: `i:${r.id}`, resource: r,
        depth: depth + 1, last: i === childCount - 1, ancestors: chain,
      }))
      g.subGroups.forEach(sg => addGroup(sg, depth + 1, chain))
    }
    let num = 0
    for (const row of groupResources(sorted)) {
      num++
      if (row.kind === "group") addGroup(row, 0, [], num)
      else out.push({ kind: "item", key: `i:${row.resource.id}`, resource: row.resource, depth: 0, num, ancestors: [] })
    }
    return out
  }, [sorted, collapsed, forceOpen])

  const totalCount = merged.length
  const showingCount = displayRows.length

  // ── Pagination — rows per page = what this screen can show ──────────────
  // How many rows fit is MEASURED on screen, not assumed: the table area's
  // height, less the header and the pager as they actually render, divided by
  // a real row's height. A laptop with room for 7 shows 7, a monitor with room
  // for 10 shows 10, and resizing the window re-fits. (The old fixed numbers
  // assumed 48px rows and held back half a row "to be safe" — the rows are
  // 40px, so a screen with room for 8 got 6 and a band of empty space.)
  // Every number is read in the same CSS pixels, so the app's html zoom
  // cancels out. Search, sort or filter change snaps back to page 1.
  const FALLBACK_ROW_H = 41   // h-10 body row + hairline, until a real row exists
  const [pageSize, setPageSize] = useState(8)
  const [currentPage, setCurrentPage] = useState(1)
  const tableAreaRef = useRef<HTMLDivElement | null>(null)
  const fitRows = useCallback(() => {
    const el = tableAreaRef.current
    if (!el) return
    const head = el.querySelector("thead") as HTMLElement | null
    // Clickable rows only: the empty-state row and loading skeletons are
    // different heights and would skew the count.
    const row = el.querySelector('tbody tr[role="button"]') as HTMLElement | null
    const footer = el.lastElementChild as HTMLElement | null
    const available = el.clientHeight - (head?.offsetHeight ?? 40) - (footer?.offsetHeight ?? 44)
    const rowH = row?.offsetHeight || FALLBACK_ROW_H
    // 1px of slack for sub-pixel rounding, so the last row is never clipped
    // into a scrollbar.
    setPageSize(Math.max(3, Math.min(50, Math.floor((available - 1) / rowH))))
  }, [])
  useEffect(() => {
    const el = tableAreaRef.current
    if (!el) return
    fitRows()
    const ro = new ResizeObserver(fitRows)
    ro.observe(el)
    // The footer grows when the pager appears (more than one page), which
    // takes room from the rows — watch it too.
    if (el.lastElementChild) ro.observe(el.lastElementChild)
    return () => ro.disconnect()
  }, [fitRows])
  // First real rows → re-measure with an actual row height.
  const hasRows = displayRows.length > 0
  useEffect(() => { if (hasRows) fitRows() }, [hasRows, fitRows])
  // Pages are cut from the display rows, so an open group's files count toward
  // the page like any row. A page that opens mid-group repeats that group's
  // header (and its parents') first, so the files at the top still say which
  // group they belong to; the repeat takes a row of the budget, so the page
  // never grows past what fits.
  const pageSlices = useMemo(() => {
    const out: { rows: DisplayRow[]; from: number; to: number }[] = []
    let cur: DisplayRow[] = []
    let from = 0
    displayRows.forEach((row, idx) => {
      if (cur.length >= pageSize) { out.push({ rows: cur, from, to: idx }); cur = [] }
      if (cur.length === 0) {
        from = idx + 1
        for (const a of row.ancestors) {
          cur.push({ ...a, key: `${a.key}:cont`, num: undefined, continued: true })
        }
      }
      cur.push(row)
    })
    if (cur.length) out.push({ rows: cur, from, to: displayRows.length })
    return out
  }, [displayRows, pageSize])
  const totalPages = Math.max(1, pageSlices.length)
  const safePage = Math.min(currentPage, totalPages)
  const page = pageSlices[safePage - 1] ?? { rows: [] as DisplayRow[], from: 0, to: 0 }
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
  // Columns: # | Resource | Type | Added On | Size
  // The Details + Action columns were removed — the whole row is now the
  // Open action (wired via DataTable's onRowClick below). Widths sum to
  // 100% and give the filename the most room. Size sits at the right
  // because it's the shortest cell and reads best as a trailing metric.
  const columns: DTColumn<DisplayRow>[] = [
    {
      key: 'num',
      label: '#',
      // Same shape as the We Do Assignment list's row-number column so
      // both tables read identically at a glance. Numbers count top-level
      // entries — a group is one entry; the files inside it are not numbered.
      className: 'w-[4%] pl-4 pr-2 text-left text-[13px] text-faint tabular-nums align-middle whitespace-nowrap',
      skeletonWidth: '20px',
      render: (row) => row.num ?? '',
    },
    {
      key: 'name',
      label: 'Resource',
      sortKey: 'name',
      className: 'w-[55%] px-3 text-left align-middle text-[13.5px]',
      skeletonWidth: '80%',
      render: (row) => {
        // Group header, as on the staff list: a small orange folder tile, then
        // the chevron and the name — both orange while the group is open.
        if (row.kind === 'group') {
          const { groupName } = row.group
          const open = row.expanded
          return (
            <div className="flex items-center gap-2.5 min-w-0" style={{ paddingLeft: row.depth * 28 }}>
              <span
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: 22, height: 22, borderRadius: 6, background: S.orangeLight, border: `1px solid ${S.orange}30` }}
              >
                <FolderIco size={12} strokeWidth={1.8} style={{ color: S.orange }} />
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                <ChevronRight
                  size={14}
                  strokeWidth={2.2}
                  className="flex-shrink-0"
                  style={{
                    color: open ? S.orange : S.textHint,
                    transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s cubic-bezier(0.4,0,0.2,1)',
                  }}
                />
                <span
                  className="truncate"
                  title={groupName}
                  style={{ fontSize: 12.5, fontWeight: 600, color: open ? S.orange : S.textMain, letterSpacing: '-0.005em', lineHeight: 1.3 }}
                >
                  {groupName}
                </span>
                {row.continued && (
                  <span className="flex-shrink-0" style={{ fontSize: 10.5, fontWeight: 500, color: S.textHint }}>
                    (continued)
                  </span>
                )}
              </div>
            </div>
          )
        }
        const r = row.resource
        const title = r.title || 'Untitled'
        const nested = row.depth > 0
        return (
          // Inside a group: indented with the staff list's tree connector and
          // its slightly smaller (18px) artwork.
          <div className="flex items-center gap-2.5 min-w-0" style={{ paddingLeft: nested ? row.depth * 28 + 4 : 0 }}>
            {nested && (
              <span aria-hidden style={{ fontSize: 9, color: S.textHint, flexShrink: 0, marginRight: -4 }}>
                {row.last ? '└' : '├'}
              </span>
            )}
            <FileGlyph r={r} nested={nested} />
            <span
              className="min-w-0 flex-1 truncate"
              title={title}
              style={{ fontSize: 12.5, fontWeight: 600, color: S.textMain, letterSpacing: '-0.005em', lineHeight: 1.3 }}
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
      className: 'w-[13%] px-3 text-left align-middle',
      render: (row) => <TypeChip label={row.kind === 'group' ? 'Group' : fileVisual(row.resource).label} />,
    },
    {
      key: 'date',
      label: 'Added On',
      sortKey: 'date',
      className: 'w-[18%] px-3 text-left align-middle whitespace-nowrap',
      // A group shows when it last changed: its newest file's date.
      render: (row) => (
        <span style={{ fontSize: 11.5, fontWeight: 600, color: S.textMuted, letterSpacing: '-0.004em' }}>
          {formatDateTime(row.kind === 'group' ? row.stats.latest : row.resource.uploadedAt)}
        </span>
      ),
    },
    {
      key: 'size',
      label: 'Size',
      className: 'w-[10%] px-3 pr-4 text-left align-middle whitespace-nowrap tabular-nums',
      // A group's size is the total of the files in it.
      render: (row) => row.kind === 'group' ? (
        <span style={{ fontSize: 12, fontWeight: 600, color: S.textMuted }}>{fmtFolderSize(row.stats.bytes)}</span>
      ) : (
        <span style={{ fontSize: 12.5, fontWeight: 700, color: S.textSub, letterSpacing: '-0.006em' }}>
          {fmtSize(bytesFor(row.resource))}
        </span>
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
        <DataTable<DisplayRow>
          rows={page.rows}
          columns={columns}
          rowKey={(row) => row.key}
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
          // Whole row is the Open action — the Action column and its per-row
          // Open button were removed. Reuses the SAME onOpen handler the
          // parent already provides (handleResourceClick), so folder /
          // file / reading / link routing stays identical to before.
          // A group row opens/closes the group; a file row opens the file.
          onRowClick={(row) => (row.kind === 'group' ? toggleGroup(row.group.groupId) : onOpen(row.resource))}
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
          from={page.from}
          to={page.to}
          total={showingCount}
          pageSize={pageSize}
          onPageSize={() => { /* fixed — no size selector; pageSize adapts to viewport */ }}
        />
      </div>
    </div>
  )
}

export default LectureResourceList
