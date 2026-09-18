// components/ResourceComponents.tsx
import React, { useState } from "react"
import { File, Folder, Layout, Video, Presentation, FileText, Archive, Link, Download, ChevronUp, ChevronDown, ChevronRight, Image as ImageIcon, FileType, Eye, ExternalLink, FolderOpen, MoreVertical } from "lucide-react"
import { RES_COLOR, RES_LABEL } from "./types/constants"
import { Resource, ResourceType, SortConfig, SortField } from "./types/types"
import { fmtSize, shouldShowDownload, isResourceVisible } from "./types/utils"

// Export ResIcon so it can be used in page.tsx
export const ResIcon = ({ type, size = 14 }: { type: string; size?: number }) => {
  const p = { size, strokeWidth: 2 }
  if (type === "page") return <Layout {...p} />
  if (type === "video") return <Video {...p} />
  if (type === "ppt") return <Presentation {...p} />
  if (type === "pdf") return <FileText {...p} />
  if (type === "zip") return <Archive {...p} />
  if (type === "link") return <Link {...p} />
  if (type === "folder") return <Folder {...p} />
  if (type === "image") return <ImageIcon {...p} />
  if (type === "word") return <FileType {...p} />
  if (type === "txt") return <FileText {...p} />
  return <File {...p} />
}

// PNG icon map
const PNG_ICONS: Record<string, string> = {
  folder: '/icons/folder.png',
  pdf:    '/active-images/pdfFile.png',
  ppt:    '/icons/ppt.png',
  link:   '/icons/link.png',
  page:   '/icons/page.png',
}

const getResourceIcon = (resource: Resource): React.ReactNode => {
  const key = resource.isFolder ? 'folder' : resource.type
  const src = PNG_ICONS[key]
  if (src) {
    return (
      <img
        src={src}
        alt={key}
        style={{ width: 18, height: 18, objectFit: 'contain', display: 'block' }}
      />
    )
  }
  return <ResIcon type={resource.type} size={12} />
}

// ── Inline keyframes injected once ────────────────────────────────────────────
const ANIM_STYLE = `
@keyframes resItemIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes weDoItemIn {
  from { opacity: 0; transform: translateX(-14px) scale(0.97); }
  to   { opacity: 1; transform: translateX(0)     scale(1);    }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`

let styleInjected = false
const ensureAnimStyle = () => {
  if (styleInjected || typeof document === 'undefined') return
  const tag = document.createElement('style')
  tag.textContent = ANIM_STYLE
  document.head.appendChild(tag)
  styleInjected = true
}

export const ResourceItem = ({
  resource, index, onClick, onDownload, animType = "resource",
  indent = 0, isLast = false, groupChild = false,
}: {
  resource: Resource
  index: number
  onClick: (r: Resource) => void
  onDownload?: (r: Resource, e: React.MouseEvent) => void
  animType?: "resource" | "wedo" | "none"
  indent?: number
  isLast?: boolean
  groupChild?: boolean
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  ensureAnimStyle()

  if (!isResourceVisible(resource)) return null
  const isPage = resource.type === "page"
  const col = resource.isFolder ? '#64748b' : RES_COLOR[resource.type] || '#64748b'
  const hasPng = resource.isFolder || resource.type in PNG_ICONS

  const fmtDate = (d: string) => {
    if (!d) return '—'
    try {
      const dt = new Date(d)
      const yyyy = dt.getFullYear()
      const mo = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      const h24 = dt.getHours()
      const ampm = h24 >= 12 ? 'PM' : 'AM'
      const HH = String(h24 % 12 || 12).padStart(2, '0')
      const mm = String(dt.getMinutes()).padStart(2, '0')
      return `${yyyy}/${mo}/${dd} ${HH}:${mm} ${ampm}`
    }
    catch { return '—' }
  }

  const DELAY = Math.min(index * 55, 500)
  const animName = animType === "wedo" ? "weDoItemIn" : animType === "resource" ? "resItemIn" : "none"
  const animStyle: React.CSSProperties = animType !== "none"
    ? { animation: `${animName} 0.32s cubic-bezier(0.22,1,0.36,1) ${DELAY}ms both` }
    : {}

  // Always white — no alternating row colours
  const rowBg = '#ffffff'

  const actionLabel = resource.isFolder ? "Open" : "Preview"
  const showAction = true
  const category = resource.isFolder ? "Folder" : (RES_LABEL[resource.type as ResourceType] || resource.type.toUpperCase())
  const updated = fmtDate(resource.uploadedAt || "")
  const folderTotalBytes = resource.isFolder
    ? (resource.folderContents || []).reduce((sum, r) => sum + (parseInt((r as any).fileSize || "0") || 0), 0)
    : 0
  const sizeText = resource.isFolder
    ? (folderTotalBytes > 0 ? fmtSize(String(folderTotalBytes)) : '—')
    : fmtSize(resource.fileSize || "0")

  const menuItemStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '7px 10px', borderRadius: 6,
    border: 'none', background: 'transparent', cursor: 'pointer',
    color: '#334155', fontSize: '13.5px', fontWeight: 400,
    textAlign: 'left', fontFamily: 'inherit', whiteSpace: 'nowrap',
  }

  return (
    <div
      onClick={() => onClick(resource)}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '6px 20px',
        minHeight: 34,
        cursor: 'pointer',
        background: rowBg,
        borderBottom: '1px solid #eef0f4',
        transition: 'background 0.15s ease',
        fontFamily: "'Poppins','Poppins',-apple-system,BlinkMacSystemFont,sans-serif",
        WebkitFontSmoothing: 'antialiased',
        ...animStyle,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = rowBg }}
    >
      {/* Name */}
      <div style={{ width: '36%', minWidth: 0, display: 'flex', alignItems: 'center', paddingRight: 12, paddingLeft: indent, position: 'relative' }}>
        {groupChild && indent > 0 && (
          <>
            <div style={{ position: 'absolute', left: indent - 18, top: 0, height: isLast ? '50%' : '100%', width: 1.5, background: '#cbd5e1' }} />
            <div style={{ position: 'absolute', left: indent - 18, top: '50%', transform: 'translateY(-0.75px)', width: 14, height: 1.5, background: '#cbd5e1' }} />
          </>
        )}
        <div style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: resource.type === "pdf" ? 'transparent' : (hasPng ? '#f1f5f9' : `${col}15`),
          border: resource.type === "pdf" ? 'none' : (hasPng ? '1px solid #e2e8f0' : `1px solid ${col}25`),
          marginRight: 10,
        }}>
          {getResourceIcon(resource)}
        </div>
        <p title={resource.title} style={{
          margin: 0,
          flex: 1,
          minWidth: 0,
          fontSize: '14px',
          fontWeight: 500,
          color: '#0F172A',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.005em',
        }}>
          {resource.title}
        </p>
      </div>

      {/* Updated */}
      <div style={{ width: '16%', minWidth: 132, paddingRight: 12 }}>
        <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 400, letterSpacing: '-0.004em', whiteSpace: 'nowrap' }}>{updated}</span>
      </div>

      {/* Category */}
      <div style={{ width: '24%', minWidth: 100, paddingLeft: 48, paddingRight: 12 }}>
        <span style={{
          fontSize: '12.5px', fontWeight: 400,
          textTransform: 'capitalize' as const, letterSpacing: '-0.004em',
          color: '#334155', whiteSpace: 'nowrap' as const,
        }}>{category}</span>
      </div>

      {/* Size */}
      <div style={{ width: '8%', minWidth: 64, paddingRight: 12 }}>
        <span style={{ fontSize: '12.5px', fontWeight: 400, color: '#334155', letterSpacing: '-0.006em' }}>{sizeText}</span>
      </div>

      {/* Actions */}
      <div style={{ width: '16%', minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
        {showAction && (
          <>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v) }}
              style={{
                width: 28, height: 26, borderRadius: 7,
                border: '1px solid #e2e8f0', background: menuOpen ? '#f1f5f9' : '#fff',
                cursor: 'pointer', color: '#64748b',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
              <>
                <div
                  onClick={e => { e.stopPropagation(); setMenuOpen(false) }}
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  minWidth: 144, background: '#fff', borderRadius: 8,
                  border: '1px solid #e2e8f0', boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
                  padding: 4, zIndex: 50,
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setMenuOpen(false); onClick(resource) }}
                    style={menuItemStyle}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                  >
                    {resource.isFolder || resource.type === "link" ? <Layout size={13} /> : <Eye size={13} />}
                    {actionLabel}
                  </button>
                  {!resource.isFolder && !isPage && shouldShowDownload(resource) && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setMenuOpen(false); if (onDownload) onDownload(resource, e) }}
                      style={menuItemStyle}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                    >
                      <Download size={13} />
                      Download
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── ResourceGroupRow ────────────────────────────────────────────────────────
// Renders a group with chevron expand/collapse. The group's nested files are
// shown only when expanded. Files already filtered by isResourceVisible.
// Sub-groups (passed via `subGroups`) render as nested accordions below the items,
// supporting unlimited nesting depth (group inside group inside group...).
export interface ResourceSubGroup {
  groupId: string
  groupName: string
  items: Resource[]
  subGroups: ResourceSubGroup[]
}

export const ResourceGroupRow = ({
  groupId, groupName, items, subGroups = [], index, depth = 0, onClick, onDownload, animType = "resource", defaultExpanded = false,
}: {
  groupId: string
  groupName: string
  items: Resource[]
  subGroups?: ResourceSubGroup[]
  index: number
  depth?: number
  onClick: (r: Resource) => void
  onDownload?: (r: Resource, e: React.MouseEvent) => void
  animType?: "resource" | "wedo" | "none"
  defaultExpanded?: boolean
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded)
  ensureAnimStyle()

  // A group is empty (and should not render) only when it has NO items AND no sub-groups.
  if (!items.length && !subGroups.length) return null

  const DELAY = Math.min(index * 55, 500)
  const animName = animType === "wedo" ? "weDoItemIn" : animType === "resource" ? "resItemIn" : "none"
  const animStyle: React.CSSProperties = depth === 0 && animType !== "none"
    ? { animation: `${animName} 0.32s cubic-bezier(0.22,1,0.36,1) ${DELAY}ms both` }
    : {}

  const fmtDate = (d: string) => {
    if (!d) return '—'
    try {
      const dt = new Date(d)
      const yyyy = dt.getFullYear()
      const mo = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      const h24 = dt.getHours()
      const ampm = h24 >= 12 ? 'PM' : 'AM'
      const HH = String(h24 % 12 || 12).padStart(2, '0')
      const mm = String(dt.getMinutes()).padStart(2, '0')
      return `${yyyy}/${mo}/${dd} ${HH}:${mm} ${ampm}`
    }
    catch { return '—' }
  }
  // Recursively collect all items in this group + its nested sub-groups
  // for accurate aggregate size and "latest update" timestamps on the header.
  const collectAll = (its: Resource[], subs: ResourceSubGroup[]): Resource[] => {
    const out = [...its]
    subs.forEach(sg => out.push(...collectAll(sg.items, sg.subGroups)))
    return out
  }
  const allItems = collectAll(items, subGroups)
  const latest = allItems.reduce((acc, it) => {
    const t = it.uploadedAt ? new Date(it.uploadedAt).getTime() : 0
    return t > acc ? t : acc
  }, 0)
  const groupTotalBytes = allItems.reduce((sum, r) => sum + (parseInt((r as any).fileSize || "0") || 0), 0)
  // Each depth level indents only the name cell so the Date / Type / Size
  // columns stay aligned with the header even when a group is expanded.
  const nameIndent = depth * 28

  return (
    <>
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center',
          padding: '6px 20px',
          minHeight: 34,
          cursor: 'pointer',
          background: '#ffffff',
          borderBottom: '1px solid #eef0f4',
          transition: 'background 0.15s ease',
          fontFamily: "'Poppins','Poppins',-apple-system,BlinkMacSystemFont,sans-serif",
          WebkitFontSmoothing: 'antialiased',
          ...animStyle,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#ffffff' }}
      >
        {/* Name */}
        <div style={{ width: '36%', minWidth: 0, display: 'flex', alignItems: 'center', paddingRight: 12, paddingLeft: nameIndent, gap: 8 }}>
          {expanded
            ? <ChevronDown size={14} style={{ color: '#F97316', flexShrink: 0 }} strokeWidth={2.5} />
            : <ChevronRight size={14} style={{ color: '#F97316', flexShrink: 0 }} strokeWidth={2.5} />}
          <div style={{
            flexShrink: 0, width: 22, height: 22, borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.20)',
            marginRight: 4,
          }}>
            {expanded ? <FolderOpen size={12} style={{ color: '#F97316' }} /> : <Folder size={12} style={{ color: '#F97316' }} />}
          </div>
          <p title={groupName} style={{ margin: 0, flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 500, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.005em' }}>
            {groupName}
          </p>
          {/* <span style={{
            fontSize: '9.5px', fontWeight: 700, color: '#EA580C',
            background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)',
            padding: '2px 7px', borderRadius: 999, letterSpacing: '0.04em', flexShrink: 0,
          }}>
            GROUP · {items.length} FILE{items.length !== 1 ? 'S' : ''}
          </span> */}
        </div>
        {/* Updated */}
        <div style={{ width: '16%', minWidth: 132, paddingRight: 12 }}>
          <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: 400, letterSpacing: '-0.004em', whiteSpace: 'nowrap' }}>
            {latest ? fmtDate(new Date(latest).toISOString()) : '—'}
          </span>
        </div>
        {/* Category */}
        <div style={{ width: '24%', minWidth: 100, paddingLeft: 48, paddingRight: 12 }}>
          <span style={{
            fontSize: '12.5px', fontWeight: 400,
            textTransform: 'capitalize' as const, letterSpacing: '-0.004em',
            color: '#334155', whiteSpace: 'nowrap' as const,
          }}>Group</span>
        </div>
        {/* Size */}
        <div style={{ width: '8%', minWidth: 64, paddingRight: 12 }}>
          <span style={{ fontSize: '12.5px', fontWeight: 400, color: '#334155', letterSpacing: '-0.006em' }}>
            {groupTotalBytes > 0 ? fmtSize(String(groupTotalBytes)) : '—'}
          </span>
        </div>
        {/* Actions (empty for group row) */}
        <div style={{ width: '16%', minWidth: 130 }} />{/* keep aligned with Actions header */}
      </div>

      {expanded && items.map((r, i) => {
        const isLast = i === items.length - 1 && subGroups.length === 0
        return (
          <ResourceItem
            key={r.id}
            resource={r}
            index={i}
            onClick={onClick}
            onDownload={onDownload}
            animType="none"
            indent={(depth + 1) * 28}
            isLast={isLast}
            groupChild
          />
        )
      })}
      {/* Nested sub-groups (recursive — supports unlimited depth) */}
      {expanded && subGroups.map((sg, i) => (
        <ResourceGroupRow
          key={`sg-${sg.groupId}`}
          groupId={sg.groupId}
          groupName={sg.groupName}
          items={sg.items}
          subGroups={sg.subGroups}
          index={i}
          depth={depth + 1}
          onClick={onClick}
          onDownload={onDownload}
          animType="none"
          defaultExpanded={false}
        />
      ))}
    </>
  )
}

export const ResourceTableHeader = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      padding: '7px 20px',
      background: '#f8fafc',
      borderBottom: '1px solid #eef0f4',
      position: 'sticky',
      top: 0,
      zIndex: 5,
      fontFamily: "'Poppins','Poppins',-apple-system,BlinkMacSystemFont,sans-serif",
    }}
  >
    <div style={{ width: '36%', minWidth: 0, fontSize: '12.5px', fontWeight: 500, color: '#0F172A', paddingRight: 12, letterSpacing: '0.04em' }}>Name</div>
    <div style={{ width: '16%', minWidth: 132, fontSize: '12.5px', fontWeight: 500, color: '#0F172A', paddingRight: 12, letterSpacing: '0.04em' }}>Date Modified</div>
    <div style={{ width: '24%', minWidth: 100, fontSize: '12.5px', fontWeight: 500, color: '#0F172A', paddingLeft: 48, paddingRight: 12, letterSpacing: '0.04em' }}>Type</div>
    <div style={{ width: '8%', minWidth: 64, fontSize: '12.5px', fontWeight: 500, color: '#0F172A', paddingRight: 12, letterSpacing: '0.04em' }}>Size</div>
    <div style={{ width: '16%', minWidth: 130, fontSize: '12.5px', fontWeight: 500, color: '#0F172A', textAlign: 'right' as const, letterSpacing: '0.04em' }}>Actions</div>
  </div>
)

export const SortHeader = ({ onSort, cfg }: { onSort: (f: SortField) => void; cfg: SortConfig }) => {
  const ind = (f: SortField) => cfg.field !== f
    ? (
      <span style={{ display: 'inline-flex', flexDirection: 'column', marginLeft: 3, gap: 0 }}>
        <ChevronUp size={8} style={{ color: '#cbd5e1' }} />
        <ChevronDown size={8} style={{ color: '#cbd5e1' }} />
      </span>
    )
    : cfg.direction === 'asc'
      ? <ChevronUp size={11} style={{ color: '#F97316', marginLeft: 3 }} />
      : <ChevronDown size={11} style={{ color: '#F97316', marginLeft: 3 }} />

  const btn = (label: string, f: SortField, extra: React.CSSProperties = {}) => (
    <button
      onClick={() => onSort(f)}
      style={{
        display: 'flex', alignItems: 'center',
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '12.5px', fontWeight: 600,
        color: cfg.field === f ? '#F97316' : '#94a3b8',
        padding: '4px 0', letterSpacing: '0.03em',
        ...extra,
      }}
    >
      {label}{ind(f)}
    </button>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '8px 16px',
      background: '#f8fafc',
      borderBottom: '1px solid #e2e8f0',
      position: 'sticky', top: 0, zIndex: 10,
    }}>
      {btn("NAME", "name", { flex: 1 })}
      {btn("SIZE", "size", { width: 54, justifyContent: 'flex-end' })}
      {btn("DATE", "date", { width: 72, justifyContent: 'flex-end' })}
    </div>
  )
}

// Modern Resource Card Component
export const ResourceCard = ({
  resource, index, onClick, onDownload, animType = "resource",
}: {
  resource: Resource
  index: number
  onClick: (r: Resource) => void
  onDownload?: (r: Resource, e: React.MouseEvent) => void
  animType?: "resource" | "wedo" | "none"
}) => {
  const [tip, setTip] = useState(false)
  ensureAnimStyle()

  if (!isResourceVisible(resource)) return null
  const isPage = resource.type === "page"
  const hasPng = resource.isFolder || resource.type in PNG_ICONS

  const fmtDate = (d: string) => {
    if (!d) return '—'
    try {
      const dt = new Date(d)
      const yyyy = dt.getFullYear()
      const mo = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      const h24 = dt.getHours()
      const ampm = h24 >= 12 ? 'PM' : 'AM'
      const HH = String(h24 % 12 || 12).padStart(2, '0')
      const mm = String(dt.getMinutes()).padStart(2, '0')
      return `${yyyy}/${mo}/${dd} ${HH}:${mm} ${ampm}`
    }
    catch { return '—' }
  }

  const DELAY = Math.min(index * 50, 300)
  const animName = animType === "wedo" ? "weDoItemIn" : animType === "resource" ? "resItemIn" : "none"
  const animStyle: React.CSSProperties = animType !== "none"
    ? { animation: `${animName} 0.32s cubic-bezier(0.22,1,0.36,1) ${DELAY}ms both` }
    : {}

  const category = resource.isFolder ? "Folder" : (RES_LABEL[resource.type as ResourceType] || resource.type.toUpperCase())
  const updated = fmtDate(resource.uploadedAt || "")
  const cardFolderBytes = resource.isFolder
    ? (resource.folderContents || []).reduce((sum, r) => sum + (parseInt((r as any).fileSize || "0") || 0), 0)
    : 0
  const sizeText = resource.isFolder
    ? (cardFolderBytes > 0 ? fmtSize(String(cardFolderBytes)) : '—')
    : fmtSize(resource.fileSize || "0")

  return (
    <div
      style={{
        display: 'inline-block',
        width: 'calc(33.333% - 12px)',
        margin: '0 6px 12px',
        verticalAlign: 'top',
        ...animStyle,
      }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          height: '100%',
          minHeight: 120,
          cursor: 'pointer',
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={() => onClick(resource)}
      >
        {/* Card Header */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid #f5f5f5',
            background: '#fafbfc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* Icon */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: resource.type === "pdf" ? 'transparent' : (hasPng ? '#f8fafc' : `${RES_COLOR[resource.type] || '#f8fafc'}15`),
                border: resource.type === "pdf" ? 'none' : (hasPng ? '1px solid #e2e8f0' : `1px solid ${RES_COLOR[resource.type] || '#e2e8f0'}25`),
                flexShrink: 0,
              }}
            >
              {getResourceIcon(resource)}
            </div>

            {/* Content Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{
                  margin: '0 0 4px',
                  fontSize: '15.5px',
                  fontWeight: 600,
                  color: '#1e293b',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {resource.title}
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <span
                  style={{
                    fontSize: '12.5px',
                    color: '#6b7280',
                    fontWeight: 500,
                    background: '#f1f5f9',
                    padding: '2px 8px',
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {category}
                </span>
                
                {updated && (
                  <span
                    style={{
                      fontSize: '11.5px',
                      color: '#9ca3af',
                      fontWeight: 400,
                    }}
                  >
                    {updated}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Card Body */}
          <div style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: '13.5px',
                  color: '#64748b',
                  fontWeight: 500,
                }}
              >
                {sizeText}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Preview/Open Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick(resource)
                  }}
                  style={{
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #d1d5db',
                    background: '#ffffff',
                    cursor: 'pointer',
                    color: '#4f46e5',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '12.5px',
                    fontWeight: 600,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc'
                    e.currentTarget.style.borderColor = '#4f46e5'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff'
                    e.currentTarget.style.borderColor = '#d1d5db'
                  }}
                >
                  {resource.isFolder || resource.type === "link" ? <ExternalLink size={14} /> : <Eye size={14} />}
                  {resource.isFolder || resource.type === "link" ? "Open" : "Preview"}
                </button>

                {/* Download Button */}
                {!resource.isFolder && !isPage && shouldShowDownload(resource) && (
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        if (onDownload) onDownload(resource, e) 
                      }}
                      onMouseEnter={() => setTip(true)}
                      onMouseLeave={() => setTip(false)}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: '1px solid #d1d5db',
                        background: '#ffffff',
                        cursor: 'pointer',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f8fafc'
                        e.currentTarget.style.borderColor = '#4f46e5'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff'
                        e.currentTarget.style.borderColor = '#d1d5db'
                      }}
                    >
                      <Download size={14} />
                    </button>
                    {tip && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: 4,
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: '#1e293b',
                          color: '#ffffff',
                          fontSize: '11.5px',
                          whiteSpace: 'nowrap',
                          zIndex: 10,
                          pointerEvents: 'none',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        }}
                      >
                        Download
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Skeleton Loader Component
export const ResourceSkeleton = () => (
  <div style={{
    display: 'inline-block',
    width: 'calc(33.333% - 12px)',
    margin: '0 6px 12px',
    verticalAlign: 'top',
  }}>
    <div
      style={{
        background: '#ffffff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        height: 120,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Shimmer effect */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%)',
          animation: 'shimmer 1.5s infinite',
        }}
      />
      
      {/* Card Header Skeleton */}
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid #f5f5f5',
          background: '#fafbfc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          {/* Icon Skeleton */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#e5e7eb',
              flexShrink: 0,
            }}
          />
          
          {/* Content Info Skeleton */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: '60%',
                height: 14,
                background: '#e5e7eb',
                borderRadius: 4,
                marginBottom: '4px',
              }}
            />
            <div
              style={{
                width: '40%',
                height: 12,
                background: '#e5e7eb',
                borderRadius: 4,
                marginBottom: '2px',
              }}
            />
          </div>
        </div>
      </div>

      {/* Card Body Skeleton */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              width: '30%',
              height: 12,
              background: '#e5e7eb',
              borderRadius: 4,
            }}
          />
          
          <div
            style={{
              width: '32px',
              height: 32,
              background: '#e5e7eb',
              borderRadius: 8,
            }}
          />
        </div>
      </div>
    </div>
  </div>
)

// Sidebar Skeleton for loading state
export const SidebarSkeleton = () => {
  const items = Array.from({ length: 6 })
  return (
    <div style={{ padding: '12px', background: '#111827' }}>
      {/* Search skeleton */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          height: 36,
          borderRadius: 8,
          background: '#1e2430',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)',
            animation: 'shimmer 1.5s infinite',
          }} />
        </div>
      </div>

      {/* Module items skeleton */}
      {items.map((_, i) => (
        <div key={i} style={{ marginBottom: 8 }}>
          <div style={{
            height: i % 3 === 0 ? 40 : 32,
            borderRadius: 6,
            background: i % 3 === 0 ? '#1a2234' : '#161d2a',
            marginLeft: i % 3 === 0 ? 0 : 16,
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)',
              animation: `shimmer 1.5s infinite`,
              animationDelay: `${i * 0.1}s`,
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Table Skeleton for hierarchy loading
export const TableSkeleton = () => {
  const rows = Array.from({ length: 5 })
  return (
    <div style={{ borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        padding: '12px 16px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        gap: 12,
      }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            flex: i === 0 ? 2 : 1,
            height: 12,
            borderRadius: 4,
            background: '#e2e8f0',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
              animation: 'shimmer 1.5s infinite',
            }} />
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((_, rowIdx) => (
        <div key={rowIdx} style={{
          display: 'flex',
          padding: '14px 16px',
          borderBottom: rowIdx < rows.length - 1 ? '1px solid #f1f5f9' : 'none',
          gap: 12,
          background: '#fff',
        }}>
          {Array.from({ length: 6 }).map((_, colIdx) => (
            <div key={colIdx} style={{
              flex: colIdx === 0 ? 2 : 1,
              height: colIdx === 0 ? 14 : 10,
              borderRadius: 4,
              background: '#f1f5f9',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                animation: `shimmer 1.5s infinite`,
                animationDelay: `${rowIdx * 0.1}s`,
              }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export const EmptyCard = ({
  icon: Icon,
  title,
  sub,
  action,
  onAction,
  color = "blue"
}: {
  icon: React.ComponentType<any>
  title: string
  sub: string
  action?: string
  onAction?: () => void
  color?: "blue" | "orange" | "green" | "gray"
}) => {
  const colorMap = {
    blue: { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.15)', icon: '#F97316', button: '#F97316' },
    orange: { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', icon: '#F97316', button: '#F97316' },
    green: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.15)', icon: '#22c55e', button: '#22c55e' },
    gray: { bg: 'rgba(100,116,139,0.08)', border: 'rgba(100,116,139,0.15)', icon: '#64748b', button: '#64748b' },
  }
  const c = colorMap[color]

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{
        textAlign: 'center', padding: '36px 44px', borderRadius: 24,
        background: 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
        border: '1.5px solid #e2e8f0',
        maxWidth: 320,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          background: `linear-gradient(135deg, ${c.bg} 0%, ${c.border} 100%)`,
          border: `1px solid ${c.border}`,
          boxShadow: `0 2px 8px ${c.bg}`,
        }}>
          <Icon size={24} style={{ color: c.icon }} />
        </div>
        <p style={{ fontWeight: 700, fontSize: '15.5px', color: '#1e293b', margin: '0 0 6px' }}>{title}</p>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 16px', lineHeight: 1.6 }}>{sub}</p>
        {action && onAction && (
          <button
            onClick={onAction}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: 'none',
              background: c.button,
              color: '#fff',
              fontSize: '13.5px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: `0 2px 8px ${c.bg}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = `0 4px 12px ${c.border}`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = `0 2px 8px ${c.bg}`
            }}
          >
            {action}
          </button>
        )}
      </div>
    </div>
  )
}