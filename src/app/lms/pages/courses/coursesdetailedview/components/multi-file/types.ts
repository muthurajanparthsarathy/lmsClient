// Shared types for the native (code-server-free) multi-file editor.
import type { SupportedLanguage } from "@/lib/codeLanguages"

export interface FileNode {
  id: string
  filename: string // basename, e.g. "main.py"
  content: string
  language: SupportedLanguage | "text"
  path: string // full path from root, e.g. "/utils/helpers.py"
  folderPath: string // parent folder, e.g. "/" or "/utils"
  isEntryPoint?: boolean
  lastModified?: Date
}

export interface FolderNode {
  id: string
  name: string // basename, e.g. "utils"
  path: string // full path, e.g. "/utils" or "/src/utils"
  parentPath: string // "/" or "/src"
}

// Stable id helper shared across the editor modules.
export const uid = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// Normalize a path: collapse slashes, ensure a single leading slash, no trailing.
export const normPath = (p: string): string => {
  const cleaned = ("/" + (p || "")).replace(/\/+/g, "/").replace(/\/$/, "")
  return cleaned === "" ? "/" : cleaned
}

export const basename = (p: string): string => normPath(p).split("/").pop() || ""

export const parentOf = (p: string): string => {
  const n = normPath(p)
  const idx = n.lastIndexOf("/")
  return idx <= 0 ? "/" : n.slice(0, idx)
}

export const joinPath = (dir: string, name: string): string =>
  normPath(`${dir === "/" ? "" : dir}/${name}`)
