// components/Sidebar.tsx
// ─── SELF-CONTAINED light sidebar (SmartCliff orange theme) ────────────────

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  Search, X, ChevronDown, ChevronUp,
  GraduationCap, Home, LayoutDashboard,
  Code2, Braces, Atom, Server, Layers,
  Crown, ArrowRight, ChevronsUpDown, ChevronsDownUp,
  AlertTriangle, PanelLeftClose, FileText, FolderOpen,
} from "lucide-react"
import { FONT_PRIMARY, FONT_INTER_IMPORT } from "./types/constants"
import { hasChildItems, hasPedagogyData } from "./types/utils"
import { CourseData, SelectedItem, SelectedItemType } from "./types/types"
import { fetchAllPedagogyViews } from "../../../../../../apiServices/pedagogyAndModuleAdd/pedagogy"

/* ─── Design Tokens ──────────────────────────────────────────────────────── */
const C = {
  bg:            "#ffffff",
  surface:       "#f5f6f8",
  surfaceHover:  "rgba(15,23,42,0.04)",
  surfaceActive: "rgba(249,115,22,0.10)",
  border:        "#eef0f3",
  borderSub:     "#e5e7eb",
  accent:        "#F97316",
  accentLight:   "rgba(249,115,22,0.10)",
  text:          "#171725",
  textSub:       "#334155",
  textMuted:     "#64748b",
  textFaint:     "#94a3b8",
  textGhost:     "#94a3b8",
  gold:          "#F59E0B",
 font: FONT_PRIMARY
}

/* ─── Module icon helper ─────────────────────────────────────────────────── */
function getModuleIcon(title: string, size = 11) {
  const k = title.toLowerCase().replace(/[^a-z]/g, "")
  if (k.includes("css"))       return <Braces  size={size} strokeWidth={1.8} />
  if (k.includes("react"))     return <Atom    size={size} strokeWidth={1.8} />
  if (k.includes("node"))      return <Server  size={size} strokeWidth={1.8} />
  if (k.includes("express"))   return <Server  size={size} strokeWidth={1.8} />
  if (k.includes("bootstrap")) return <Layers  size={size} strokeWidth={1.8} />
  return                               <Code2   size={size} strokeWidth={1.8} />
}

/* ─── Pedagogy / Hours types ─────────────────────────────────────────────── */
interface PedagogyActivityItem { type: string; duration: number; _id?: any }
interface Pedagogy {
  _id: any; module: string[]; subModule: string[]; topic: string[]; subTopic: string[]
  iDo: PedagogyActivityItem[]; weDo: PedagogyActivityItem[]; youDo: PedagogyActivityItem[]
}
interface PedagogyView { _id: string; institution: string; courses: string; pedagogies: Pedagogy[] }

export function buildHoursMap(
  pedagogyViews: PedagogyView[],
  courseId?: string,
): Record<string, number> {
  const map: Record<string, number> = {}
  const views = courseId ? pedagogyViews.filter(v => v.courses === courseId) : pedagogyViews
  for (const view of views) {
    for (const ped of view.pedagogies) {
      const h = [...ped.iDo, ...ped.weDo, ...ped.youDo]
        .reduce((s, a) => s + (a.duration || 0), 0)
      if (!h) continue
      for (const id of [...ped.module, ...ped.subModule, ...ped.topic, ...ped.subTopic])
        if (id) map[id] = (map[id] || 0) + h
    }
  }
  return map
}

/* ─── Smooth collapse ────────────────────────────────────────────────────── */
const AnimCollapse: React.FC<{ open: boolean; children: React.ReactNode }> = ({ open, children }) => {
  const ref = useRef<HTMLDivElement>(null)
  const [h, setH] = useState<number | "auto">(open ? "auto" : 0)
  const [vis, setVis] = useState(open)

  useEffect(() => {
    if (open) {
      setVis(true)
      requestAnimationFrame(() => {
        if (ref.current) setH(ref.current.scrollHeight)
        setTimeout(() => setH("auto"), 270)
      })
    } else {
      if (ref.current) setH(ref.current.scrollHeight)
      requestAnimationFrame(() => requestAnimationFrame(() => setH(0)))
      setTimeout(() => setVis(false), 270)
    }
  }, [open])

  if (!vis && !open) return null
  return (
    <div style={{ overflow: "hidden", height: h, transition: "height 260ms cubic-bezier(0.4,0,0.2,1)" }}>
      <div ref={ref}>{children}</div>
    </div>
  )
}

/* ─── Shared primitives ──────────────────────────────────────────────────── */
const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <div style={{
    fontFamily: C.font, fontSize: 11.5, fontWeight: 600,  // Reduced from 10.5/700
    letterSpacing: "0.03em",  // Reduced from 0.04em
    color: C.textGhost, padding: "16px 16px 8px",
    marginTop: 4,
  }}>
    {label}
  </div>
)

const Divider = () => (
  <div style={{ height: 1, background: C.surface, margin: "8px 12px 6px" }} />
)

const ToolBtn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...rest }) => {
  const [hov, setHov] = useState(false)
  return (
    <button
      {...rest}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${hov ? "rgba(249,115,22,0.38)" : C.border}`,
        background: hov ? "rgba(249,115,22,0.12)" : C.surface,
        cursor: "pointer", color: hov ? C.accent : C.textFaint,
        transition: "all 0.15s", fontFamily: C.font,
      }}
    >
      {children}
    </button>
  )
}

/* ─── Flat nav item ──────────────────────────────────────────────────────── */
const NavItem: React.FC<{
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void
}> = ({ icon, label, active, onClick }) => {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px", borderRadius: 8, margin: "2px 8px",
        cursor: "pointer", userSelect: "none",
        background: active ? C.surfaceActive : hover ? C.surfaceHover : "transparent",
        transition: "background 0.12s",
      }}
    >
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: active ? C.accent : C.textFaint,
      }}>
        {icon}
      </div>
      <span style={{
        fontFamily: C.font, fontSize: 14, fontWeight: active ? 500 : 400,  // Reduced from 13.5/600/500
        color: active ? C.text : C.textMuted, flex: 1,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {label}
      </span>
    </div>
  )
}

/* ─── Collapsible tree module row ────────────────────────────────────────── */
const TreeModuleRow: React.FC<{
  icon: React.ReactNode; label: string
  isOpen: boolean; isActive?: boolean; depth?: number; badge?: string; onToggle: () => void
}> = ({ icon, label, isOpen, isActive, depth = 0, badge, onToggle }) => {
  const [hover, setHover] = useState(false)
  const pl = depth === 0 ? "8px 14px 8px 12px" : "6px 12px 6px 10px"
  const iSize = depth === 0 ? 25 : 20
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: pl, borderRadius: 10, margin: "0 8px",
        cursor: "pointer", userSelect: "none",
        // White raised pill on the flat gray rail (shell language).
        background: isActive ? "#ffffff" : (hover ? "#E9EBF0" : "transparent"),
        border: isActive ? "1px solid #E4E7EC" : "1px solid transparent",
        boxShadow: isActive ? "0 1px 2px rgba(16,24,40,0.06)" : "none",
        transition: "background 0.12s,border-color 0.12s,box-shadow 0.12s",
      }}
    >
      <div style={{
        width: iSize, height: iSize,
        borderRadius: depth === 0 ? 6 : 5, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: isActive || isOpen ? C.accentLight : C.surface,
        transition: "background 0.13s",
      }}>
        <span style={{ color: isActive || isOpen ? C.accent : C.textFaint, display: "flex" }}>
          {icon}
        </span>
      </div>
      <span style={{
        fontFamily: C.font, flex: 1,
        fontSize: depth === 0 ? 14 : 13.5, fontWeight: 400,  // Reduced from 13.5/12.5/500
        color: isOpen || isActive ? C.text : C.textMuted,
        textTransform: depth === 0 ? "uppercase" as const : "none" as const,
        letterSpacing: depth === 0 ? "0.015em" : "0",  // Reduced from 0.02em
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        transition: "color 0.13s",
      }}>
        {label}
      </span>
      {badge && (
        <span style={{
          fontFamily: C.font, fontSize: 10.5, fontWeight: 600,
          letterSpacing: "0.03em", textTransform: "uppercase" as const,
          color: C.accent, background: C.accentLight,
          padding: "2px 7px", borderRadius: 4, flexShrink: 0, whiteSpace: "nowrap",
        }}>
          {badge}
        </span>
      )}
      <span style={{ color: isOpen ? C.accent : C.textGhost, display: "flex", flexShrink: 0 }}>
        {isOpen
          ? <ChevronUp size={11} strokeWidth={2} />
          : <ChevronDown size={11} strokeWidth={2} />}
      </span>
    </div>
  )
}

/* ─── Leaf / subtopic row ────────────────────────────────────────────────── */
const SubtopicRow: React.FC<{
  title: string; isSelected: boolean; isCurrentTopic?: boolean; onClick: () => void
}> = ({ title, isSelected, isCurrentTopic, onClick }) => {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        paddingLeft: 14, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
        borderRadius: 10, margin: "0 8px 0 0",
        cursor: "pointer", userSelect: "none",
        // Selected = raised WHITE pill on the flat gray rail (matches the
        // upload-resources / shell rails), not an orange-tinted block.
        background: isSelected ? "#ffffff" : (hover ? "#E9EBF0" : "transparent"),
        border: isSelected ? "1px solid #E4E7EC" : "1px solid transparent",
        boxShadow: isSelected ? "0 1px 2px rgba(16,24,40,0.06)" : "none",
        transition: "background 0.12s,border-color 0.12s,box-shadow 0.12s",
      }}
    >
      <div style={{
        width: 5, height: 5, borderRadius: "50%", flexShrink: 0, marginLeft: 2,
        background: isSelected ? C.accent : "#cbd5e1",
        transition: "background 0.13s",
      }} />
      <span style={{
        fontFamily: C.font, fontSize: 13.5, flex: 1,  // Reduced from 12.5
        fontWeight: isSelected ? 500 : 400,  // Reduced from 600/400
        color: isSelected ? C.text : C.textFaint,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {title}
      </span>
      {isCurrentTopic && (
        <span style={{
          fontFamily: C.font, fontSize: 11, fontWeight: 500,  // Reduced from 10/600
          color: C.accent, background: C.accentLight,
          padding: "2px 7px", borderRadius: 4, flexShrink: 0, whiteSpace: "nowrap",
        }}>
          Current Topic
        </span>
      )}
    </div>
  )
}

/* ─── Course root row (the "skill set · N Modules" node, matches design) ───── */
/* ─── Course root row ("skill set · N Modules", the tree root — matches image3) ─ */
const CourseRootRow: React.FC<{
  name: string; count: number; open: boolean; onToggle: () => void
}> = ({ name, count, open, onToggle }) => {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "8px 12px", borderRadius: 8, margin: "0 8px 2px",
        cursor: "pointer", userSelect: "none",
        background: open ? C.accentLight : hover ? C.surfaceHover : "transparent",
        transition: "background 0.12s",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />
      <div style={{
        width: 24, height: 24, borderRadius: 6, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: C.accentLight,
      }}>
        <FolderOpen size={13} strokeWidth={1.9} color={C.accent} />
      </div>
      <span style={{
        fontFamily: C.font, flex: 1, fontSize: 14, fontWeight: 600,
        color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {name}
      </span>
      <span style={{
        fontFamily: C.font, fontSize: 11, fontWeight: 500,
        color: C.textFaint, background: C.surface, border: `1px solid ${C.border}`,
        padding: "2px 7px", borderRadius: 16, flexShrink: 0, whiteSpace: "nowrap",
      }}>
        {count} Module{count !== 1 ? "s" : ""}
      </span>
      <span style={{ color: open ? C.accent : C.textGhost, display: "flex", flexShrink: 0 }}>
        {open ? <ChevronUp size={11} strokeWidth={2} /> : <ChevronDown size={11} strokeWidth={2} />}
      </span>
    </div>
  )
}

/* ─── Leaf row (file-icon items like html / css — no expander) ─────────────── */
const LeafRow: React.FC<{
  title: string; isSelected: boolean; isCurrentTopic?: boolean; onClick: () => void
}> = ({ title, isSelected, isCurrentTopic, onClick }) => {
  const [hover, setHover] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 9,
        padding: "6px 10px", borderRadius: 10, margin: "0 8px",
        cursor: "pointer", userSelect: "none",
        // White raised pill on the flat gray rail (shell language).
        background: isSelected ? "#ffffff" : (hover ? "#E9EBF0" : "transparent"),
        border: isSelected ? "1px solid #E4E7EC" : "1px solid transparent",
        boxShadow: isSelected ? "0 1px 2px rgba(16,24,40,0.06)" : "none",
        transition: "background 0.12s, box-shadow 0.12s, border-color 0.12s",
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 5, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: isSelected ? C.accent : C.textFaint,
      }}>
        <FileText size={13} strokeWidth={1.8} />
      </div>
      <span style={{
        fontFamily: C.font, fontSize: 13.5, flex: 1,
        fontWeight: isSelected ? 550 : 400,
        color: isSelected ? C.text : C.textMuted,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {title}
      </span>
      {isCurrentTopic && (
        <span style={{
          fontFamily: C.font, fontSize: 10.5, fontWeight: 500,
          color: C.accent, background: C.accentLight,
          padding: "2px 6px", borderRadius: 4, flexShrink: 0, whiteSpace: "nowrap",
        }}>
          Current
        </span>
      )}
    </div>
  )
}

/* ─── Upgrade banner ─────────────────────────────────────────────────────── */
const UpgradeBanner: React.FC = () => (
  <div style={{
    margin: "6px 8px 8px",
    background: "#f8fafc",
    border: `1px solid ${C.borderSub}`,
    borderRadius: 10, padding: "12px 14px",
    fontFamily: C.font, flexShrink: 0,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
      <Crown size={13} color={C.gold} strokeWidth={2} />
      <span style={{ fontSize: 13, fontWeight: 600, color: C.gold }}>Upgrade to Pro</span>  {/* Reduced from 12/700 */}
    </div>
    <p style={{ fontSize: 11.5, color: C.textFaint, lineHeight: 1.5, margin: "0 0 10px" }}>  {/* Reduced from 10.5 */}
      Unlock advanced features and boost your learning experience.
    </p>
    <button style={{
      width: "100%",
      background: "linear-gradient(135deg,#F97316 0%,#EA580C 100%)",
      color: "#fff", fontSize: 12, fontWeight: 500,  // Reduced from 11/600
      border: "none", borderRadius: 7, padding: "8px 10px",
      cursor: "pointer", display: "flex", alignItems: "center",
      justifyContent: "center", gap: 6, fontFamily: C.font,
    }}>
      Upgrade Now <ArrowRight size={11} />
    </button>
  </div>
)

/* ═══════════════════════════════════════════════════════════════════════════
   SIDEBAR HEADER  (exported — used by page.tsx as before)
   ═══════════════════════════════════════════════════════════════════════════ */
interface SidebarHeaderProps {
  courseName: string
  modulesCount: number
  sidebarSearch: string
  onSearchChange: (v: string) => void
  onExpandAll?: () => void
  onCollapseAll?: () => void
  onClose?: () => void
}

export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  courseName, modulesCount, sidebarSearch, onSearchChange, onExpandAll, onCollapseAll, onClose,
}) => {
  const [searchOpen, setSearchOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const toggleSearch = () => {
    const next = !searchOpen
    setSearchOpen(next)
    if (!next) onSearchChange("")
    else setTimeout(() => inputRef.current?.focus(), 60)
  }

  return (
    <div style={{ background: "transparent", flexShrink: 0 }}>

      {/* Course icon + modules count */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          background: "linear-gradient(135deg,#F97316 0%,#EA580C 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 6px rgba(249,115,22,0.25)",
        }}>
          <Layers size={12} strokeWidth={2} color="#fff" />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontFamily: C.font, fontSize: 14, fontWeight: 500,  // Reduced from 13/600
            color: C.text, overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", letterSpacing: "-0.01em",
          }}>
            {courseName}
          </div>
        </div>
        <span style={{
          fontFamily: C.font, fontSize: 11, fontWeight: 500,  // Reduced from 10/500
          color: C.textFaint, background: C.surface,
          border: `1px solid ${C.border}`,
          padding: "2px 7px", borderRadius: 16, flexShrink: 0,
        }}>
          {modulesCount} Modules
        </span>
      </div>

      {/* Search + expand/collapse toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "8px 12px 8px",
      }}>
        <button
          onClick={toggleSearch}
          title="Search"
          style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `1px solid ${searchOpen ? "rgba(249,115,22,0.42)" : C.border}`,
            background: searchOpen ? C.accentLight : C.surface,
            cursor: "pointer", color: searchOpen ? C.accent : C.textFaint,
            transition: "all 0.15s",
          }}
        >
          {searchOpen
            ? <X size={12} strokeWidth={2.5} />
            : <Search size={12} strokeWidth={2.2} />}
        </button>
        <div style={{ flex: 1 }} />
        {onExpandAll && (
          <ToolBtn onClick={onExpandAll} title="Expand all">
            <ChevronsUpDown size={12} strokeWidth={2} />
          </ToolBtn>
        )}
        {onCollapseAll && (
          <ToolBtn onClick={onCollapseAll} title="Collapse all">
            <ChevronsDownUp size={12} strokeWidth={2} />
          </ToolBtn>
        )}
        {onClose && (
          <ToolBtn onClick={onClose} title="Close sidebar">
            <PanelLeftClose size={12} strokeWidth={2} />
          </ToolBtn>
        )}
      </div>

      {/* Animated search input */}
      <div style={{
        overflow: "hidden",
        maxHeight: searchOpen ? 52 : 0,
        transition: "max-height 0.24s cubic-bezier(0.4,0,0.2,1)",
        borderTop: searchOpen ? `1px solid ${C.border}` : "1px solid transparent",
        background: C.bg,
      }}>
        <div style={{ padding: "8px 12px" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={11} strokeWidth={2}
              style={{
                position: "absolute", left: 10, top: "50%",
                transform: "translateY(-50%)", color: C.textGhost, pointerEvents: "none",
              }}
            />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search topics…"
              value={sidebarSearch}
              onChange={e => onSearchChange(e.target.value)}
              style={{
                width: "100%", boxSizing: "border-box" as const,
                paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                fontFamily: C.font, fontSize: 13.5,  // Reduced from 12.5
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 9, color: C.text, outline: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = "rgba(249,115,22,0.5)"
                e.currentTarget.style.background = "#f8fafc"
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = C.border
                e.currentTarget.style.background = C.surface
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN SIDEBAR COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
interface SidebarProps {
  courseData: CourseData | null
  selectedItem: SelectedItem | null
  expandedModules: Set<string>
  expandedSubModules: Set<string>
  expandedTopics: Set<string>
  sidebarSearch: string
  onItemSelect: (
    id: string, title: string, type: SelectedItemType,
    hierarchy: string[], pedagogy?: any,
  ) => void
  onToggleModule: (id: string) => void
  onToggleSubModule: (id: string) => void
  onToggleTopic: (id: string) => void
  onSearchChange: (v: string) => void
  onLogout?: () => void
  courseId?: string
  currentTopicId?: string
  studentProgress?: { visitedNodes: string[]; openedResources: string[] } | null
}

export const Sidebar: React.FC<SidebarProps> = ({
  courseData, selectedItem,
  expandedModules, expandedSubModules, expandedTopics,
  sidebarSearch, onItemSelect,
  onToggleModule, onToggleSubModule, onToggleTopic,
  courseId, currentTopicId,
}) => {
  const [pedagogyViews, setPedagogyViews] = useState<PedagogyView[]>([])
  const [courseTreeOpen, setCourseTreeOpen] = useState(true)

  useEffect(() => {
    fetchAllPedagogyViews().then(setPedagogyViews).catch(console.error)
  }, [])

  const hoursMap = useMemo(
    () => buildHoursMap(pedagogyViews, courseId),
    [pedagogyViews, courseId],
  )

  const sel = useCallback(
    (id: string, title: string, type: SelectedItemType, hier: string[], ped?: any) =>
      onItemSelect(id, title, type, hier, ped),
    [onItemSelect],
  )

  if (!courseData?.modules) return null

  const filtered = courseData.modules.filter((m: any) =>
    !sidebarSearch ||
    m.title.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
    m.subModules?.some((sm: any) =>
      sm.title.toLowerCase().includes(sidebarSearch.toLowerCase()) ||
      sm.topics?.some((t: any) => t.title.toLowerCase().includes(sidebarSearch.toLowerCase()))
    ) ||
    m.topics?.some((t: any) => t.title.toLowerCase().includes(sidebarSearch.toLowerCase()))
  )

  // Recursive tree renderer — expandable when the node has children, file-leaf otherwise.
  const renderNode = (
    node: any,
    type: SelectedItemType,
    hierarchy: string[],
    depth: number,
  ): React.ReactNode => {
    const isSel = selectedItem?.id === node._id
    const kids: { list: any[]; childType: SelectedItemType } | null =
      node.subModules?.length ? { list: node.subModules, childType: "submodule" }
      : node.topics?.length ? { list: node.topics, childType: "topic" }
      : node.subTopics?.length ? { list: node.subTopics, childType: "subtopic" }
      : null

    if (!kids) {
      return (
        <LeafRow
          key={node._id}
          title={node.title}
          isSelected={isSel}
          isCurrentTopic={node._id === currentTopicId}
          onClick={() => sel(node._id, node.title, type, hierarchy, node.pedagogy)}
        />
      )
    }

    const isOpen =
      type === "module" ? expandedModules.has(node._id)
      : type === "submodule" ? expandedSubModules.has(node._id)
      : expandedTopics.has(node._id)

    const toggle =
      type === "module" ? onToggleModule
      : type === "submodule" ? onToggleSubModule
      : onToggleTopic

    return (
      <div key={node._id} style={{ marginBottom: depth === 1 ? 2 : 0 }}>
        <TreeModuleRow
          icon={getModuleIcon(node.title)}
          label={node.title}
          isOpen={isOpen}
          isActive={isSel}
          depth={depth}
          badge={type === "module" ? "Module" : undefined}
          onToggle={() => {
            sel(node._id, node.title, type, hierarchy, node.pedagogy)
            toggle(node._id)
          }}
        />
        <AnimCollapse open={isOpen}>
          <div style={{ marginLeft: 12, borderLeft: `1.5px solid ${C.border}` }}>
            {kids.list.map((child: any) =>
              renderNode(child, kids.childType, [...hierarchy, child._id], depth + 1),
            )}
          </div>
        </AnimCollapse>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: C.font, background: "transparent", paddingBottom: 4 }}>
      <style dangerouslySetInnerHTML={{
        __html: `
${FONT_INTER_IMPORT}          .sbd-scroll::-webkit-scrollbar{width:3px}
          .sbd-scroll::-webkit-scrollbar-track{background:transparent}
          .sbd-scroll::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:8px}
          .sbd-scroll::-webkit-scrollbar-thumb:hover{background:#9ca3af}
        `
      }} />

      {/* Course root → modules → topics (matches image3) */}
      <CourseRootRow
        name={courseData.courseName || "Course"}
        count={courseData.modules.length}
        open={courseTreeOpen}
        onToggle={() => setCourseTreeOpen(v => !v)}
      />
      <AnimCollapse open={courseTreeOpen}>
        <div style={{ marginLeft: 12, borderLeft: `1.5px solid ${C.border}`, paddingTop: 2 }}>
          {filtered.map((m: any) => renderNode(m, "module", [m._id], 1))}
        </div>
      </AnimCollapse>
      <div style={{ height: 8 }} />
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOGOUT MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
export const LogoutModal: React.FC<{
  onConfirm: () => void
  onCancel: () => void
}> = ({ onConfirm, onCancel }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 9999,
    background: "rgba(0,0,0,0.55)",
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <div style={{
      background: "#ffffff", borderRadius: 16, padding: "28px 24px",
      maxWidth: 300, width: "90%",
      border: `1px solid ${C.border}`,
      boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
      textAlign: "center", fontFamily: C.font,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: "rgba(249,115,22,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px",
      }}>
        <AlertTriangle size={20} color={C.accent} />
      </div>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 600, color: C.text, fontFamily: C.font }}>  {/* Reduced from 15/700 */}
        Logout?
      </h3>
      <p style={{ margin: "0 0 22px", fontSize: 13.5, color: C.textMuted, lineHeight: 1.65, fontFamily: C.font }}>  {/* Reduced from 12.5 */}
        Your progress is saved. You can resume anytime.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 9,
            border: `1.5px solid ${C.border}`, background: "transparent",
            color: C.textMuted, fontWeight: 500, fontSize: 14,  // Reduced from 600/13
            cursor: "pointer", fontFamily: C.font,
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            flex: 1, padding: "9px 0", borderRadius: 9, border: "none",
            background: "linear-gradient(135deg,#F97316,#EA580C)",
            color: "#fff", fontWeight: 600, fontSize: 14,  // Reduced from 700/13
            cursor: "pointer", fontFamily: C.font,
          }}
        >
          Yes, Logout
        </button>
      </div>
    </div>
  </div>
)

/* Styling intentionally kept light to match page shell. */