"use client"

import { useMemo, useState } from "react"
import {
  ChevronRight, ChevronDown, File as FileIcon, Folder, FolderOpen,
  FilePlus, FolderPlus, Pencil, Trash2,
} from "lucide-react"
import { LANGUAGE_CONFIG } from "@/lib/codeLanguages"
import { type FileNode, type FolderNode, normPath, joinPath } from "./types"

type DragItem = { kind: "file" | "folder"; path: string }
type Creating = { parent: string; kind: "file" | "folder" } | null
type Renaming = { id: string; kind: "file" | "folder" } | null

interface FileTreeProps {
  files: FileNode[]
  folders: FolderNode[]
  activeFileId: string | null
  busy?: boolean
  onOpenFile: (id: string) => void
  // Inline editing — these receive the typed name directly (no prompt()).
  onCreateFile: (parentFolderPath: string, name: string) => void
  onCreateFolder: (parentFolderPath: string, name: string) => void
  onRenameFile: (file: FileNode, newName: string) => void
  onRenameFolder: (folder: FolderNode, newName: string) => void
  onDeleteFile: (file: FileNode) => void
  onDeleteFolder: (folder: FolderNode) => void
  onMove: (item: DragItem, targetFolderPath: string) => void
  // Optional: parent can suggest a folder context (e.g. the folder of the
  // currently active file) so the toolbar's + buttons target the right place
  // even when the user hasn't clicked a folder yet.
  defaultTargetFolder?: string
}

const fileColor = (lang: FileNode["language"]): string =>
  lang !== "text" ? LANGUAGE_CONFIG[lang]?.color || "#6b7280" : "#6b7280"

export default function FileTree(props: FileTreeProps) {
  const {
    files, folders, activeFileId, busy, defaultTargetFolder,
    onOpenFile, onCreateFile, onCreateFolder,
    onRenameFile, onRenameFolder, onDeleteFile, onDeleteFolder, onMove,
  } = props

  const [expanded, setExpanded] = useState<Set<string>>(new Set(["/"]))
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [creating, setCreating] = useState<Creating>(null)
  const [renaming, setRenaming] = useState<Renaming>(null)
  const [editValue, setEditValue] = useState("")
  // Selected folder = where the toolbar's "+ file/folder" buttons create. Like
  // VS Code: click a folder to make it the target. Defaults to root, but the
  // parent can hint a sensible default (e.g. folder of the active file).
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>(defaultTargetFolder || "/")

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  const childMap = useMemo(() => {
    const map: Record<string, { folders: FolderNode[]; files: FileNode[] }> = {}
    const ensure = (p: string) => (map[p] ||= { folders: [], files: [] })
    ensure("/")
    folders.forEach((f) => { ensure(f.parentPath).folders.push(f); ensure(f.path) })
    files.forEach((f) => ensure(f.folderPath || "/").files.push(f))
    Object.values(map).forEach((g) => {
      g.folders.sort((a, b) => a.name.localeCompare(b.name))
      g.files.sort((a, b) => a.filename.localeCompare(b.filename))
    })
    return map
  }, [files, folders])

  // ── inline edit helpers ──
  const startCreate = (parent: string, kind: "file" | "folder") => {
    setRenaming(null)
    setExpanded((prev) => new Set(prev).add(parent))
    setEditValue("")
    setCreating({ parent, kind })
  }
  const startRename = (id: string, kind: "file" | "folder", current: string) => {
    setCreating(null)
    setEditValue(current)
    setRenaming({ id, kind })
  }
  const cancelEdit = () => { setCreating(null); setRenaming(null); setEditValue("") }

  const commitCreate = () => {
    if (!creating) return
    const name = editValue.trim()
    if (name) (creating.kind === "file" ? onCreateFile : onCreateFolder)(creating.parent, name)
    cancelEdit()
  }
  const commitRename = () => {
    if (!renaming) return
    const name = editValue.trim()
    if (name) {
      if (renaming.kind === "file") { const f = files.find((x) => x.id === renaming.id); if (f && name !== f.filename) onRenameFile(f, name) }
      else { const f = folders.find((x) => x.id === renaming.id); if (f && name !== f.name) onRenameFolder(f, name) }
    }
    cancelEdit()
  }

  const startDrag = (e: React.DragEvent, item: DragItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify(item))
    e.dataTransfer.effectAllowed = "move"
  }
  const handleDrop = (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(null)
    try {
      const item = JSON.parse(e.dataTransfer.getData("application/json")) as DragItem
      if (!item?.path) return
      if (item.kind === "folder" && normPath(targetFolderPath).startsWith(normPath(item.path))) return
      onMove(item, normPath(targetFolderPath))
    } catch { /* ignore */ }
  }

  const rowBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, padding: "3px 6px",
    borderRadius: 5, fontSize: 12.5, cursor: busy ? "default" : "pointer",
    userSelect: "none", whiteSpace: "nowrap",
  }

  // Inline editor row (used for both create and rename).
  const editRow = (depth: number, kind: "file" | "folder", commit: () => void) => (
    <div style={{ ...rowBase, paddingLeft: 6 + depth * 14 + (kind === "file" ? 13 : 0) }}>
      {kind === "folder"
        ? <Folder size={14} style={{ color: "#eab308", flexShrink: 0 }} />
        : <FileIcon size={13} style={{ color: "#6b7280", flexShrink: 0 }} />}
      <input
        autoFocus
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit() } else if (e.key === "Escape") { e.preventDefault(); cancelEdit() } }}
        onBlur={commit}
        placeholder={kind === "file" ? "filename.py" : "folder name"}
        className="flex-1 text-[12.5px] outline-none rounded px-1"
        style={{ border: "1px solid #6366f1", fontFamily: "inherit", minWidth: 0 }}
      />
    </div>
  )

  const renderFolder = (folder: FolderNode, depth: number) => {
    const open = expanded.has(folder.path)
    const kids = childMap[folder.path] || { folders: [], files: [] }
    const isOver = dragOver === folder.path
    const isSelected = selectedFolderPath === folder.path
    const isRenaming = renaming?.kind === "folder" && renaming.id === folder.id
    return (
      <div key={folder.id}>
        {isRenaming ? editRow(depth, "folder", commitRename) : (
          <div
            className="group hover:bg-indigo-50"
            style={{
              ...rowBase,
              paddingLeft: 6 + depth * 14,
              background: isOver ? "#e0e7ff" : isSelected ? "#eef2ff" : undefined,
              borderLeft: `2px solid ${isSelected ? "#6366f1" : "transparent"}`,
            }}
            draggable={!busy}
            onDragStart={(e) => startDrag(e, { kind: "folder", path: folder.path })}
            onDragOver={(e) => { e.preventDefault(); setDragOver(folder.path) }}
            onDragLeave={() => setDragOver((p) => (p === folder.path ? null : p))}
            onDrop={(e) => handleDrop(e, folder.path)}
            // Single click: select the folder AND toggle expand/collapse, just
            // like VS Code. The toolbar's + buttons then target this folder.
            onClick={() => { setSelectedFolderPath(folder.path); toggle(folder.path) }}
          >
            {open ? <ChevronDown size={13} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={13} className="text-gray-400 flex-shrink-0" />}
            {open ? <FolderOpen size={14} style={{ color: "#eab308", flexShrink: 0 }} /> : <Folder size={14} style={{ color: "#eab308", flexShrink: 0 }} />}
            <span className="flex-1 truncate text-gray-800 font-medium">{folder.name}</span>
            <span className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
              <button title="New file" onClick={(e) => { e.stopPropagation(); startCreate(folder.path, "file") }}><FilePlus size={12} className="text-gray-500 hover:text-indigo-600" /></button>
              <button title="New folder" onClick={(e) => { e.stopPropagation(); startCreate(folder.path, "folder") }}><FolderPlus size={12} className="text-gray-500 hover:text-indigo-600" /></button>
              <button title="Rename" onClick={(e) => { e.stopPropagation(); startRename(folder.id, "folder", folder.name) }}><Pencil size={11} className="text-gray-500 hover:text-blue-600" /></button>
              <button title="Delete" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder) }}><Trash2 size={11} className="text-gray-500 hover:text-red-600" /></button>
            </span>
          </div>
        )}
        {open && (
          <div>
            {creating?.parent === folder.path && editRow(depth + 1, creating.kind, commitCreate)}
            {kids.folders.map((f) => renderFolder(f, depth + 1))}
            {kids.files.map((f) => renderFile(f, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderFile = (file: FileNode, depth: number) => {
    const active = file.id === activeFileId
    const isRenaming = renaming?.kind === "file" && renaming.id === file.id
    if (isRenaming) return <div key={file.id}>{editRow(depth, "file", commitRename)}</div>
    return (
      <div
        key={file.id}
        className={`group ${active ? "bg-indigo-100" : "hover:bg-gray-100"}`}
        style={{ ...rowBase, paddingLeft: 6 + depth * 14 + 13 }}
        draggable={!busy}
        onDragStart={(e) => startDrag(e, { kind: "file", path: file.path })}
        // Opening a file also selects its parent folder as the "+ target" so
        // the next + click creates a sibling, which matches user intuition.
        onClick={() => { onOpenFile(file.id); setSelectedFolderPath(file.folderPath || "/") }}
        title={file.path}
      >
        <FileIcon size={13} style={{ color: fileColor(file.language), flexShrink: 0 }} />
        <span className={`flex-1 truncate ${active ? "text-indigo-900 font-semibold" : "text-gray-700"}`}>{file.filename}</span>
        {file.isEntryPoint && <span className="text-[9px] px-1 rounded bg-emerald-100 text-emerald-700 font-bold flex-shrink-0">RUN</span>}
        <span className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
          <button title="Rename" onClick={(e) => { e.stopPropagation(); startRename(file.id, "file", file.filename) }}><Pencil size={11} className="text-gray-500 hover:text-blue-600" /></button>
          <button title="Delete" onClick={(e) => { e.stopPropagation(); onDeleteFile(file) }}><Trash2 size={11} className="text-gray-500 hover:text-red-600" /></button>
        </span>
      </div>
    )
  }

  const root = childMap["/"] || { folders: [], files: [] }
  const rootOver = dragOver === "/"

  // Pretty target label for the header (e.g. "Explorer · /utils").
  const targetLabel = selectedFolderPath === "/" ? "" : ` · ${selectedFolderPath}`

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "'Poppins', sans-serif" }}>
      <div className="flex items-center justify-between px-2 py-1.5 border-b" style={{ borderColor: "#e5e7eb" }}>
        <span
          className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 truncate"
          title={`New items will be created in: ${selectedFolderPath}`}
        >
          Explorer<span className="text-indigo-500 normal-case font-mono">{targetLabel}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            title={`New file in ${selectedFolderPath}`}
            disabled={busy}
            onClick={() => startCreate(selectedFolderPath, "file")}
            className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-40"
          ><FilePlus size={14} className="text-gray-600" /></button>
          <button
            title={`New folder in ${selectedFolderPath}`}
            disabled={busy}
            onClick={() => startCreate(selectedFolderPath, "folder")}
            className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-40"
          ><FolderPlus size={14} className="text-gray-600" /></button>
        </div>
      </div>

      <div
        className="flex-1 overflow-auto py-1"
        style={{ background: rootOver ? "#eef2ff" : undefined }}
        onDragOver={(e) => { e.preventDefault(); setDragOver("/") }}
        onDragLeave={() => setDragOver((p) => (p === "/" ? null : p))}
        onDrop={(e) => handleDrop(e, "/")}
        // Click on empty space resets the target to root, matching VS Code.
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedFolderPath("/") }}
      >
        {creating?.parent === "/" && editRow(0, creating.kind, commitCreate)}
        {root.folders.length === 0 && root.files.length === 0 && !creating ? (
          <div className="px-3 py-6 text-center text-[11px] text-gray-400">No files yet. Use the + buttons above.</div>
        ) : (
          <>
            {root.folders.map((f) => renderFolder(f, 0))}
            {root.files.map((f) => renderFile(f, 0))}
          </>
        )}
      </div>
    </div>
  )
}

export type { DragItem }
export { joinPath }
