"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  ChevronLeft, List, ListOrdered, Heading1, Heading2, Heading3,
  Quote, Code, Table, CheckSquare, Trash2, Copy, GripVertical,
  Type, Minus, Sun, Moon, Eye, Save, Plus, Search, FileText,
  Zap, Video, Maximize2, Minimize2, Image as ImageIcon, Youtube,
  Loader2, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Underline as UnderlineIcon, Strikethrough, Link,
  Droplet, Grid3x3, MoveHorizontal,
  Type as TypeIcon, Image, X, Palette, Edit3,
  Layers, ArrowRight, PenLine, Navigation,
  Play, Undo2, Redo2, Columns, RefreshCw
} from "lucide-react"
import { entityApi } from "@/apiServices/coursesData"
import { PlainBreadcrumb } from "./PlainBreadcrumb"

// ─── Types ────────────────────────────────────────────────────────────────────
export type BlockType =
  | "text" | "heading1" | "heading2" | "heading3"
  | "bulleted_list" | "numbered_list" | "todo"
  | "quote" | "divider" | "image" | "video"
  | "table" | "callout" | "embed" | "page_link"
  | "container" | "snippet"
  | "button" | "progress" | "card_columns" | "code_playground"

export interface PageBlock {
  _uid?: string
  type: BlockType
  content: string
  metadata?: {
    checked?: boolean; language?: string
    align?: "left" | "center" | "right" | "justify"
    backgroundColor?: string; textColor?: string; url?: string; caption?: string
    rows?: number; cols?: number; data?: string[][]
    width?: string | number; height?: string | number
    borderRadius?: string; shadow?: string; padding?: string; margin?: string
    fontSize?: string; fontWeight?: string; fontFamily?: string
    lineHeight?: string; letterSpacing?: string
    textTransform?: "none" | "uppercase" | "lowercase" | "capitalize"
    textDecoration?: string; fontStyle?: string; opacity?: number
    borderWidth?: string; borderColor?: string; borderStyle?: string
    embedType?: "youtube" | "vimeo" | "custom"
    autoplay?: boolean; loop?: boolean; muted?: boolean; controls?: boolean
    spacingTop?: string; spacingBottom?: string
    linkedPageId?: string; linkedPageTitle?: string
    playgroundHtml?: string
    playgroundCss?: string
    playgroundJs?: string
    playgroundLayout?: "horizontal" | "vertical"
    playgroundActiveTab?: "html" | "css" | "js"
    playgroundPrimaryTab?: "html" | "css" | "js" | "auto"
    snippetTitle?: string
    snippetLanguage?: string
    columns?: number
    gap?: string
    direction?: "row" | "column"
    minHeight?: string
  }
}

export interface PageData { id: string; title: string; blocks: PageBlock[] }

export interface PagePayloadItem {
  id: string; name: string; html: string; blocks: PageBlock[]
}

export interface HierarchyInfo {
  courseId: string; courseName: string
  moduleId?: string; moduleName?: string
  subModuleId?: string; subModuleName?: string
  topicId?: string; topicName?: string
  subTopicId?: string; subTopicName?: string
  tabType?: "I_Do" | "We_Do" | "You_Do"
  subcategory?: string; folderPath?: string[]; folderId?: string
  nodeType?: "course" | "module" | "submodule" | "topic" | "subtopic"
  // Group context — when the resource picker was opened from a group's
  // "Add" action, these carry the group's identity so the page lands inside
  // that group instead of the activity root.
  groupId?: string
  groupName?: string
}

export interface PagesPayload {
  pages: PagePayloadItem[]
  combinedHtml: string
  hierarchyInfo?: HierarchyInfo
}

interface PageCreationModalProps {
  onBack: () => void
  onConfirm: (payload: PagesPayload) => void
  initialBlocks?: PageBlock[]
  initialTitle?: string
  hierarchyInfo?: HierarchyInfo
  isEditing?: boolean
  /**
   * Plain non-clickable breadcrumb of where this page will be saved:
   * Course > Module > ... > Group > Folder > Subfolder. Display-only;
   * parent builds the labels.
   */
  pathCrumbs?: Array<{ label: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function generateUid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function updateMetaSafe(
  block: PageBlock,
  update: Partial<PageBlock["metadata"]>
): PageBlock {
  return {
    ...block,
    metadata: {
      ...JSON.parse(JSON.stringify(block.metadata ?? {})),
      ...update,
    },
  }
}

function resolveShadow(s?: string): string | undefined {
  if (!s || s === "none") return undefined
  if (s === "sm") return "0 1px 2px 0 rgb(0 0 0/0.05)"
  if (s === "md") return "0 4px 6px -1px rgb(0 0 0/0.1)"
  if (s === "lg") return "0 10px 15px -3px rgb(0 0 0/0.1)"
  if (s === "xl") return "0 20px 25px -5px rgb(0 0 0/0.1)"
  return undefined
}

function buildInlineStyle(metadata?: PageBlock["metadata"]): React.CSSProperties {
  if (!metadata) return {}
  return {
    color: metadata.textColor || undefined,
    fontSize: metadata.fontSize || undefined,
    fontFamily: metadata.fontFamily || undefined,
    fontWeight: metadata.fontWeight || undefined,
    fontStyle: metadata.fontStyle || undefined,
    textDecoration: metadata.textDecoration || undefined,
    letterSpacing: metadata.letterSpacing || undefined,
    textTransform: metadata.textTransform || undefined,
    lineHeight: metadata.lineHeight || undefined,
    textAlign: metadata.align || undefined,
    backgroundColor: metadata.backgroundColor || undefined,
    padding: metadata.padding || undefined,
    borderRadius: metadata.borderRadius || undefined,
    borderWidth: metadata.borderWidth && metadata.borderWidth !== "0px" ? metadata.borderWidth : undefined,
    borderColor: metadata.borderWidth && metadata.borderWidth !== "0px" ? metadata.borderColor : undefined,
    borderStyle: metadata.borderWidth && metadata.borderWidth !== "0px" ? (metadata.borderStyle || "solid") : undefined,
    opacity: metadata.opacity !== undefined && metadata.opacity !== 1 ? metadata.opacity : undefined,
    width: metadata.width || undefined,
    boxShadow: resolveShadow(metadata.shadow),
  }
}

function buildCSSString(metadata?: PageBlock["metadata"]): string {
  const style = buildInlineStyle(metadata)
  return Object.entries(style)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`)
    .join("; ")
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

// ─── Card Columns helpers ──────────────────────────────────────────────────────
interface CardData {
  title: string; desc: string; btnLabel: string; btnColor: string; btnUrl: string
}
interface CardColumnsData {
  left: CardData; right: CardData; orPill?: boolean
}
const defaultCardData: CardColumnsData = {
  left: { title: "HTML Tutorial", desc: "Study our HTML Tutorial for free, no registration needed.", btnLabel: "Learn HTML Now »", btnColor: "#16a34a", btnUrl: "" },
  right: { title: "HTML Course + Certificate", desc: "Upgrade your learning with our interactive HTML Course and Get Certified.", btnLabel: "Upgrade to our HTML Course", btnColor: "#7c3aed", btnUrl: "" },
  orPill: true,
}
function parseCardData(content: string): CardColumnsData {
  try { if (content) return { ...defaultCardData, ...JSON.parse(content) } } catch { }
  return defaultCardData
}

// ─── Custom Hooks ─────────────────────────────────────────────────────────────

function useUndoRedo<T>(initial: T) {
  const history = useRef<T[]>([initial])
  const pointer = useRef(0)
  const [, tick] = useState(0)

  const current = history.current[pointer.current]

  const push = useCallback((next: T) => {
    history.current = history.current.slice(0, pointer.current + 1)
    history.current.push(next)
    if (history.current.length > 60) {
      history.current = history.current.slice(history.current.length - 60)
    }
    pointer.current = history.current.length - 1
    tick(n => n + 1)
  }, [])

  const undo = useCallback(() => {
    if (pointer.current > 0) { pointer.current--; tick(n => n + 1) }
  }, [])

  const redo = useCallback(() => {
    if (pointer.current < history.current.length - 1) { pointer.current++; tick(n => n + 1) }
  }, [])

  const canUndo = pointer.current > 0
  const canRedo = pointer.current < history.current.length - 1

  return { current, push, undo, redo, canUndo, canRedo }
}

type AutoSaveStatus = "idle" | "saving" | "saved" | "error"

function useAutoSave(data: PageData[], draftKey: string, delayMs = 3500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [status, setStatus] = useState<AutoSaveStatus>("idle")
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(`pcm_draft_${draftKey}`, JSON.stringify(data))
        if (mounted.current) {
          setStatus("saved")
          setTimeout(() => { if (mounted.current) setStatus("idle") }, 2000)
        }
      } catch {
        if (mounted.current) setStatus("error")
      }
    }, delayMs)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const restoreDraft = useCallback((): PageData[] | null => {
    try {
      const stored = localStorage.getItem(`pcm_draft_${draftKey}`)
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  }, [draftKey])

  const clearDraft = useCallback(() => {
    localStorage.removeItem(`pcm_draft_${draftKey}`)
  }, [draftKey])

  return { status, restoreDraft, clearDraft }
}

// ─── Shared CSS for generated HTML ────────────────────────────────────────────

const SHARED_HTML_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; font-size: 16px; }
  html, body {
    width: 100%; min-height: calc(100vh * var(--ui-scale-inv, 1));
    font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #ffffff; color: #111827; line-height: 1.7;
  }
  .page-wrap { width: 100%; max-width: 820px; margin: 0 auto; padding: 56px 48px 100px; }
  .page-title { font-size: 2.5rem; font-weight: 800; letter-spacing: -0.04em; color: #0f172a; line-height: 1.15; margin-bottom: 2.25rem; }
  .content h2 { font-size: 1.6rem; font-weight: 700; margin: 2rem 0 0.65rem; color: #111827; letter-spacing: -0.02em; line-height: 1.3; }
  .content h3 { font-size: 1.3rem; font-weight: 600; margin: 1.75rem 0 0.5rem; color: #1f2937; line-height: 1.35; }
  .content h4 { font-size: 1.1rem; font-weight: 600; margin: 1.5rem 0 0.4rem; color: #374151; }
  .content p { font-size: 1rem; line-height: 1.85; color: #374151; margin-bottom: 1.1rem; }
  .content blockquote { border-left: 4px solid #6366f1; padding: 12px 0 12px 22px; color: #4b5563; font-style: italic; margin: 1.5rem 0; background: #f5f3ff; border-radius: 0 8px 8px 0; }
  .content ul, .content ol { padding-left: 1.75rem; margin: 0.75rem 0 1.1rem; }
  .content li { line-height: 1.8; color: #374151; margin-bottom: 0.35rem; font-size: 1rem; }
  .content pre { background: #0f172a; color: #86efac; padding: 20px 24px; border-radius: 10px; overflow-x: auto; margin: 1.5rem 0; font-family: 'Fira Code', 'Cascadia Code', 'Courier New', Consolas, monospace; font-size: 0.875rem; line-height: 1.7; }
  .content pre code { background: none; padding: 0; font-size: inherit; color: inherit; }
  .content table { border-collapse: collapse; width: 100%; margin: 1.5rem 0; font-size: 0.9375rem; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .content th { background: #f9fafb; font-weight: 700; color: #374151; padding: 11px 16px; text-align: left; border-bottom: 2px solid #e5e7eb; font-size: 0.875rem; }
  .content td { padding: 10px 16px; border-bottom: 1px solid #f3f4f6; color: #374151; vertical-align: top; }
  .content tr:last-child td { border-bottom: none; }
  .content tbody tr:hover td { background: #fafafa; }
  .content hr { border: none; border-top: 1.5px solid #e5e7eb; margin: 2rem 0; }
  .content figure { margin: 1.5rem 0; }
  .content img { max-width: 100%; border-radius: 8px; display: block; }
  .content figcaption { text-align: center; font-size: 0.82rem; color: #9ca3af; margin-top: 8px; font-style: italic; }
  .todo-item { display: flex; align-items: flex-start; gap: 12px; margin: 6px 0; padding: 4px 0; }
  .todo-item input[type=checkbox] { margin-top: 4px; width: 16px; height: 16px; flex-shrink: 0; accent-color: #6366f1; }
  .todo-item span { font-size: 1rem; line-height: 1.7; color: #374151; }
  .todo-checked { text-decoration: line-through; color: #9ca3af; }
  .callout { display: flex; gap: 14px; align-items: flex-start; padding: 16px 20px; border-radius: 10px; margin: 1.25rem 0; }
  .callout-icon { font-size: 1.25rem; flex-shrink: 0; margin-top: 2px; line-height: 1.5; }
  .video-wrapper { aspect-ratio: 16/9; border-radius: 10px; overflow: hidden; margin: 1.5rem 0; }
  .video-wrapper iframe { width: 100%; height: 100%; border: none; }
  .playground-wrapper { border-radius: 10px; overflow: hidden; margin: 1.5rem 0; border: 1px solid #e5e7eb; }
  .playground-wrapper iframe { width: 100%; border: none; display: block; }
  .container-section { margin: 1.5rem 0; border-radius: 12px; }
  .page-link-btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 20px; border-radius: 8px; border: none; cursor: pointer; background: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 600; font-family: inherit; text-decoration: none; transition: background .15s, transform .1s, box-shadow .15s; margin: 8px 0; line-height: 1; }
  .page-link-btn:hover { background: #4338ca; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(79,70,229,.35); }
  .page-nav-row { display: flex; align-items: center; justify-content: space-between; margin-top: 3rem; padding-top: 1.5rem; border-top: 1.5px solid #e5e7eb; gap: 12px; }
  .page-nav-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; border: 1.5px solid #e5e7eb; background: #f9fafb; color: #374151; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; max-width: 220px; transition: background .15s, border-color .15s, box-shadow .15s; }
  .page-nav-btn span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .page-nav-btn:hover { background: #f3f4f6; border-color: #d1d5db; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
  .page-counter { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9ca3af; background: #f3f4f6; padding: 4px 12px; border-radius: 20px; white-space: nowrap; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 2.25rem; }
  .page-header .page-title { margin: 0; }
  @media (max-width: 640px) {
    .page-wrap { padding: 32px 20px 60px; }
    .page-title { font-size: 1.9rem; }
    .content h2 { font-size: 1.35rem; }
    .content h3 { font-size: 1.15rem; }
    .content pre { padding: 14px 16px; font-size: 0.8125rem; }
    .content th, .content td { padding: 8px 10px; font-size: 0.8125rem; }
    .page-nav-btn { font-size: 12px; padding: 8px 12px; max-width: 145px; }
  }
`

// ─── HTML Block Renderer ───────────────────────────────────────────────────────

function renderBlocksToHTMLString(
  blocks: PageBlock[],
  mode: "standalone" | "combined" = "standalone",
  allPages: PageData[] = []
): string {
  return blocks
    .filter(b => b.content || ["divider", "table", "image", "video", "page_link", "code_playground", "container", "button", "progress", "card_columns"].includes(b.type))
    .map(b => {
      const css = buildCSSString(b.metadata)
      const s = css ? ` style="${css}"` : ""
      switch (b.type) {
        case "heading1": return `<h2${s}>${b.content}</h2>`
        case "heading2": return `<h3${s}>${b.content}</h3>`
        case "heading3": return `<h4${s}>${b.content}</h4>`
        case "text": return `<p${s}>${b.content}</p>`
        case "quote": return `<blockquote${s}>${b.content}</blockquote>`
        case "bulleted_list": return `<ul${s}><li>${b.content}</li></ul>`
        case "numbered_list": return `<ol${s}><li>${b.content}</li></ol>`
        case "todo":
          return `<div class="todo-item"${s}>
  <input type="checkbox"${b.metadata?.checked ? " checked" : ""} disabled />
  <span${b.metadata?.checked ? ' class="todo-checked"' : ""}>${b.content}</span>
</div>`

        case "code_playground": {
          const pgHtml = b.metadata?.playgroundHtml ?? "";
          const pgCss = b.metadata?.playgroundCss ?? "";
          const pgJs = b.metadata?.playgroundJs ?? "";
          const pgTitle = b.metadata?.snippetTitle ?? "";
          const pgPrimary = b.metadata?.playgroundPrimaryTab ?? "auto";
          const iframeDoc = `<!DOCTYPE html><html><head><style>${pgCss}<\/style><\/head><body>${pgHtml}<script>${pgJs}<\/script><\/body><\/html>`;
          return `<div class="playground-wrapper" data-primary-tab="${pgPrimary}" style="margin:1.5rem 0;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
  ${pgTitle ? `<div style="padding:8px 16px;background:#f8fafc;font-weight:700;font-size:14px;border-bottom:1px solid #e2e8f0;font-family:inherit">${escapeHtml(pgTitle)}</div>` : ""}
  <iframe srcdoc="${escapeHtml(iframeDoc)}" sandbox="allow-scripts allow-same-origin" style="width:100%;height:360px;border:none;display:block;" title="${escapeHtml(pgTitle || "playground")}"></iframe>
</div>`;
        }
        case "snippet": {
          const sTitle = b.metadata?.snippetTitle
          const sLang = b.metadata?.snippetLanguage ?? "code"
          const LCOLOR: Record<string, string> = { html: "#e34c26", css: "#264de4", javascript: "#f7df1e", typescript: "#3178c6", python: "#3776ab", java: "#ed8b00", sql: "#f29111", bash: "#4eaa25", json: "#292929", other: "#888" }
          const lc = LCOLOR[sLang] ?? "#888"
          const sLines = b.content.split("\n")
          const rows = sLines.map((line, i) =>
            `<tr>
              <td style="color:#555;text-align:right;padding:2px 16px 2px 12px;border-right:1px solid #333;user-select:none;min-width:44px;white-space:nowrap">${i + 1}</td>
              <td style="padding:2px 16px;color:#d4d4d4;white-space:pre">${escapeHtml(line) || "&nbsp;"}</td>
            </tr>`
          ).join("")
          return `<div style="border-radius:10px;overflow:hidden;margin:1.5rem 0;border:1px solid #e2e8f0;font-family:inherit">
  ${sTitle ? `<div style="padding:8px 16px;background:#f1f5f9;font-weight:700;font-size:14px;border-bottom:1px solid #e2e8f0">
    ${escapeHtml(sTitle)} <span style="margin-left:8px;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;background:${lc}18;color:${lc}">${sLang.toUpperCase()}</span>
  </div>` : ""}
  <div style="background:#1e1e1e;overflow-x:auto">
    <table style="border-collapse:collapse;width:100%;font-family:Fira Code,Courier New,monospace;font-size:13px;line-height:1.75"><tbody>${rows}</tbody></table>
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:#f8fafc;border-top:1px solid #333">
    <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${lc}">${sLang}</span>
    <span style="font-size:10px;color:#555">${sLines.length} line${sLines.length !== 1 ? "s" : ""}</span>
  </div>
</div>`
        }

        case "divider":
          return `<hr${b.metadata?.borderColor ? ` style="border-top-color:${b.metadata.borderColor}"` : ""} />`
        case "image":
          return b.content ? `<figure>
  <img src="${b.content}" alt="${escapeHtml(b.metadata?.caption || "")}"${s} />
  ${b.metadata?.caption ? `<figcaption>${escapeHtml(b.metadata.caption)}</figcaption>` : ""}
</figure>` : ""
        case "video":
          return b.content ? `<div class="video-wrapper">
  <iframe src="${b.content}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>
</div>` : ""
        case "container": {
          const cols = b.metadata?.columns ?? 1
          const gap = b.metadata?.gap ?? "16px"
          const bg = b.metadata?.backgroundColor ?? "transparent"
          const pad = b.metadata?.padding ?? "16px"
          const radius = b.metadata?.borderRadius ?? "0px"
          const minH = b.metadata?.minHeight ?? "auto"
          return `<section class="container-section" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${gap};background:${bg};padding:${pad};border-radius:${radius};min-height:${minH};">
  ${b.content}
</section>`
        }
        case "table": {
          const rows = (b.metadata?.data || []).map((row, i) => {
            const tag = i === 0 ? "th" : "td"
            return `<tr>${row.map(c => `<${tag}>${escapeHtml(c)}</${tag}>`).join("")}</tr>`
          }).join("")
          return `<table${s}><tbody>${rows}</tbody></table>`
        }
        case "callout": {
          const bg = b.metadata?.backgroundColor || "#FFF7ED"
          const bc = b.metadata?.borderColor || "#FED7AA"
          const emoji = b.metadata?.url || "💡"
          return `<div class="callout" style="background:${bg};border:1px solid ${bc};">
  <span class="callout-icon">${emoji}</span>
  <div>${b.content}</div>
</div>`
        }
        case "page_link": {
          const linkedId = b.metadata?.linkedPageId || ""
          const linkedTitle = b.metadata?.linkedPageTitle || b.content || "Go to page"
          if (mode === "combined" && linkedId) {
            return `<div style="margin:10px 0;">
  <button class="page-link-btn" type="button" onclick="showPage('${escapeHtml(linkedId)}')" title="Go to: ${escapeHtml(linkedTitle)}">
    ${escapeHtml(linkedTitle)}
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
  </button>
</div>`
          }
          return `<div style="margin:10px 0;">
  <span class="page-link-btn">${escapeHtml(linkedTitle)}</span>
</div>`
        }

        // ── NEW: Button ──────────────────────────────────────────────────────
        case "button": {
          const btnUrl = b.metadata?.url || ""
          const btnBg = b.metadata?.backgroundColor || "#4f46e5"
          const btnColor = b.metadata?.textColor || "#ffffff"
          const btnR = b.metadata?.borderRadius || "8px"
          const btnAlign = b.metadata?.align || "left"
          const label = escapeHtml(b.content || "Click Here")
          const btnStyle = `display:inline-flex;align-items:center;gap:8px;padding:10px 24px;background:${btnBg};color:${btnColor};border-radius:${btnR};border:none;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;font-family:inherit`
          const inner = btnUrl
            ? `<a href="${escapeHtml(btnUrl)}" target="_blank" rel="noopener noreferrer" style="${btnStyle}">${label}</a>`
            : `<button type="button" style="${btnStyle}">${label}</button>`
          return `<div style="text-align:${btnAlign};margin:12px 0">${inner}</div>`
        }

        // ── NEW: Progress ────────────────────────────────────────────────────
        case "progress": {
          const pVal = Math.round((b.metadata?.opacity ?? 0.7) * 100)
          const pColor = b.metadata?.backgroundColor || "#4ade80"
          const pTrack = b.metadata?.borderColor || "#e5e7eb"
          const pLabel = b.content || ""
          return `<div style="margin:16px 0">
  ${pLabel ? `<div style="font-size:13px;font-weight:600;margin-bottom:6px;color:#374151">${escapeHtml(pLabel)}</div>` : ""}
  <div style="width:100%;height:16px;background:${pTrack};border-radius:9999px;overflow:hidden">
    <div style="width:${pVal}%;height:100%;background:${pColor};border-radius:9999px"></div>
  </div>
</div>`
        }

        // ── NEW: Card Columns ────────────────────────────────────────────────
        case "card_columns": {
          const cc = parseCardData(b.content)
          const renderCard = (c: CardData, bg: string) => {
            const btnStyle = `display:inline-flex;align-items:center;gap:6px;padding:10px 22px;background:${c.btnColor};color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;text-decoration:none;font-family:inherit`
            const btnInner = c.btnUrl
              ? `<a href="${escapeHtml(c.btnUrl)}" target="_blank" rel="noopener noreferrer" style="${btnStyle}">${escapeHtml(c.btnLabel)}</a>`
              : `<button type="button" style="${btnStyle}">${escapeHtml(c.btnLabel)}</button>`
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding:28px 24px;border-radius:16px;background:${bg}">
  <h3 style="margin:0;font-size:1.1rem;font-weight:700;color:#111827">${escapeHtml(c.title)}</h3>
  <p style="margin:0;font-size:0.9rem;color:#6b7280;line-height:1.6">${escapeHtml(c.desc)}</p>
  ${btnInner}
</div>`
          }
          return `<div style="display:flex;gap:0;align-items:stretch;margin:20px 0;position:relative">
  ${renderCard(cc.left, "#f0fdf4")}
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:#fff;border:1.5px solid #e5e7eb;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#6b7280;box-shadow:0 2px 8px rgba(0,0,0,.08);z-index:1">OR</div>
  ${renderCard(cc.right, "#f5f3ff")}
</div>`
        }
case "code_playground": {
  const pgHtml  = b.metadata?.playgroundHtml  ?? ""
  const pgCss   = b.metadata?.playgroundCss   ?? ""
  const pgJs    = b.metadata?.playgroundJs    ?? ""
  const pgTitle = b.metadata?.snippetTitle    ?? ""
  const pgPrimary = b.metadata?.playgroundPrimaryTab ?? "auto"
  const iframeDoc = `<!DOCTYPE html><html><head><style>${pgCss}<\/style><\/head><body>${pgHtml}<script>${pgJs}<\/script><\/body><\/html>`
  return `<div class="playground-wrapper" data-primary-tab="${pgPrimary}" style="margin:1.5rem 0;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
  ${pgTitle ? `<div style="padding:8px 16px;background:#f8fafc;font-weight:700;font-size:14px;border-bottom:1px solid #e2e8f0;font-family:inherit">${escapeHtml(pgTitle)}</div>` : ""}
  <iframe srcdoc="${escapeHtml(iframeDoc)}" sandbox="allow-scripts allow-same-origin" style="width:100%;height:360px;border:none;display:block;" title="${escapeHtml(pgTitle || "playground")}"></iframe>
</div>`
}
        default: return `<p${s}>${b.content}</p>`
      }
    })
    .join("\n")
}

// ─── Standalone single-page HTML ──────────────────────────────────────────────

function serializeBlocksToHTML(title: string, blocks: PageBlock[]): string {
  const bodyContent = renderBlocksToHTMLString(blocks, "standalone", [])
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${SHARED_HTML_CSS}</style>
</head>
<body>
  <main class="page-wrap">
    <h1 class="page-title">${escapeHtml(title)}</h1>
    <div class="content">
      ${bodyContent}
    </div>
  </main>
</body>
</html>`
}

// ─── Combined multi-page HTML ─────────────────────────────────────────────────

function serializeCombinedHTML(pages: PageData[]): string {
  if (pages.length === 0) return ""
  const firstId = escapeHtml(pages[0].id)

  const sectionsHTML = pages.map((page, idx) => {
    const blocksHTML = renderBlocksToHTMLString(page.blocks, "combined", pages)
    const prevPage = pages[idx - 1]
    const nextPage = pages[idx + 1]

    const navRow = pages.length > 1 ? `
    <div class="page-nav-row">
      ${prevPage
        ? `<button class="page-nav-btn" onclick="showPage('${escapeHtml(prevPage.id)}')" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            <span>${escapeHtml(prevPage.title || "Previous")}</span>
          </button>`
        : `<span></span>`}
      ${nextPage
        ? `<button class="page-nav-btn" onclick="showPage('${escapeHtml(nextPage.id)}')" type="button">
            <span>${escapeHtml(nextPage.title || "Next")}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>`
        : `<span></span>`}
    </div>` : ""

    return `  <main class="page-wrap" id="pg-${escapeHtml(page.id)}" style="display:${idx === 0 ? "block" : "none"}">
    <div class="page-header">
      <h1 class="page-title">${escapeHtml(page.title)}</h1>
      ${pages.length > 1 ? `<span class="page-counter">${idx + 1} / ${pages.length}</span>` : ""}
    </div>
    <div class="content">
      ${blocksHTML}
    </div>${navRow}
  </main>`
  }).join("\n")

  const pageIdsJson = JSON.stringify(pages.map(p => p.id))

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(pages[0]?.title || "Pages")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${SHARED_HTML_CSS}</style>
</head>
<body>
${sectionsHTML}
  <script>
    var PAGE_IDS = ${pageIdsJson};
    var currentId = '${firstId}';
    function showPage(id) {
      PAGE_IDS.forEach(function(pid) {
        var el = document.getElementById('pg-' + pid);
        if (el) el.style.display = 'none';
      });
      var target = document.getElementById('pg-' + id);
      if (target) {
        target.style.display = 'block';
        currentId = id;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        try { history.pushState({ pageId: id }, '', '#' + id); } catch(e) {}
      }
    }
    window.addEventListener('popstate', function(e) {
      var id = e.state && e.state.pageId ? e.state.pageId : location.hash.replace('#', '');
      if (id && PAGE_IDS.indexOf(id) !== -1) showPage(id);
    });
    (function() {
      var hash = location.hash.replace('#', '');
      if (hash && PAGE_IDS.indexOf(hash) !== -1) showPage(hash);
    })();
  <\/script>
</body>
</html>`
}

// ─── Block Groups ─────────────────────────────────────────────────────────────

const BLOCK_GROUPS = [
  {
    label: "Text", items: [
      { type: "text" as BlockType, icon: <Type size={15} />, label: "Text", desc: "Plain paragraph" },
      { type: "heading1" as BlockType, icon: <Heading1 size={15} />, label: "Heading 1", desc: "Large title" },
      { type: "heading2" as BlockType, icon: <Heading2 size={15} />, label: "Heading 2", desc: "Section title" },
      { type: "heading3" as BlockType, icon: <Heading3 size={15} />, label: "Heading 3", desc: "Subsection" },
      { type: "quote" as BlockType, icon: <Quote size={15} />, label: "Quote", desc: "Blockquote" },
      { type: "code_playground" as BlockType, icon: <Play size={15} />, label: "Code Playground", desc: "HTML/CSS/JS live editor" },

    ]
  },
  {
    label: "Lists", items: [
      { type: "bulleted_list" as BlockType, icon: <List size={15} />, label: "Bulleted", desc: "Unordered list" },
      { type: "numbered_list" as BlockType, icon: <ListOrdered size={15} />, label: "Numbered", desc: "Ordered list" },
      { type: "todo" as BlockType, icon: <CheckSquare size={15} />, label: "To-do", desc: "Task list" },
    ]
  },
  {
    label: "Media", items: [
      { type: "image" as BlockType, icon: <Image size={15} />, label: "Image", desc: "Upload or URL" },
      { type: "video" as BlockType, icon: <Video size={15} />, label: "Video", desc: "YouTube, Vimeo" },
    ]
  },
  {
    label: "Advanced", items: [
      { type: "button" as BlockType, icon: <ArrowRight size={15} />, label: "Button", desc: "Standalone CTA button" },
      { type: "progress" as BlockType, icon: <Minus size={15} />, label: "Progress Bar", desc: "Visual progress indicator" },
      { type: "card_columns" as BlockType, icon: <Columns size={15} />, label: "Card Columns", desc: "Two-card layout with OR pill" },
      { type: "callout" as BlockType, icon: <Zap size={15} />, label: "Callout", desc: "Highlighted note" },
      { type: "table" as BlockType, icon: <Table size={15} />, label: "Table", desc: "Data table" },
      { type: "container" as BlockType, icon: <Grid3x3 size={15} />, label: "Container", desc: "Styled section with columns" },
      { type: "divider" as BlockType, icon: <Minus size={15} />, label: "Divider", desc: "Visual break" },
      { type: "code_playground" as BlockType, icon: <Play size={15} />, label: "Code Playground", desc: "HTML/CSS/JS live editor with Try it Yourself" },
    ]
  },
  {
    label: "Navigation", items: [
      { type: "page_link" as BlockType, icon: <Link size={15} />, label: "Page Link", desc: "Button linking to another page" },
    ]
  },
]

// ─── Color Picker ─────────────────────────────────────────────────────────────

const ColorPicker: React.FC<{ color: string; onChange: (c: string) => void; label?: string; isDark?: boolean }> = ({ color, onChange, label, isDark }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const presets = ["#000000", "#ffffff", "#f44336", "#e91e63", "#9c27b0", "#673ab7", "#3f51b5", "#2196f3", "#03a9f4", "#00bcd4", "#009688", "#4caf50", "#8bc34a", "#cddc39", "#ffeb3b", "#ffc107", "#ff9800", "#ff5722", "#795548", "#9e9e9e", "#607d8b", "#1e1e1e", "#d32f2f", "#7b1fa2"]
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      {label && <div className="text-xs mb-1 text-gray-500">{label}</div>}
      <button onMouseDown={e => { e.preventDefault(); setOpen(!open) }} className={`w-full flex items-center gap-2 p-1.5 rounded-lg border ${isDark ? "border-gray-600" : "border-gray-200"}`}>
        <div className="w-5 h-5 rounded-md border border-gray-300" style={{ backgroundColor: color }} />
        <span className="text-xs font-mono">{color}</span>
      </button>
      {open && (
        <div className={`absolute top-full left-0 mt-1 p-2 rounded-lg shadow-xl z-[100] grid grid-cols-6 gap-1 ${isDark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-200"}`}>
          {presets.map(c => (
            <button key={c} onMouseDown={e => { e.preventDefault(); onChange(c); setOpen(false) }} className="w-6 h-6 rounded-md hover:scale-110 transition-transform border border-gray-200" style={{ backgroundColor: c }} />
          ))}
          <input type="color" value={color} onChange={e => onChange(e.target.value)} className="w-6 h-6 rounded-md col-span-2 cursor-pointer" />
        </div>
      )}
    </div>
  )
}

// ─── Style Panel ──────────────────────────────────────────────────────────────

const StylePanel: React.FC<{ block: PageBlock; onChange: (u: Partial<PageBlock["metadata"]>) => void; isDark?: boolean }> = ({ block, onChange, isDark }) => {
  const [tab, setTab] = useState<"text" | "background" | "border" | "layout">("text")
  const tabs = [
    { id: "text" as const, icon: <TypeIcon size={13} />, label: "Text" },
    { id: "background" as const, icon: <Droplet size={13} />, label: "BG" },
    { id: "border" as const, icon: <Grid3x3 size={13} />, label: "Border" },
    { id: "layout" as const, icon: <MoveHorizontal size={13} />, label: "Layout" },
  ]
  return (
    <div className={`w-64 p-3 rounded-xl shadow-2xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
      <div className={`flex gap-1 mb-3 p-1 rounded-lg ${isDark ? "bg-gray-700" : "bg-gray-100"}`}>
        {tabs.map(t => (
          <button key={t.id} onMouseDown={e => { e.preventDefault(); setTab(t.id) }} className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] rounded-md transition-colors ${tab === t.id ? isDark ? "bg-gray-600 text-white" : "bg-white text-gray-900 shadow-sm" : isDark ? "text-gray-400" : "text-gray-600"}`}>{t.icon}{t.label}</button>
        ))}
      </div>
      {tab === "text" && (
        <div className="space-y-3">
          <ColorPicker color={block.metadata?.textColor || (isDark ? "#ffffff" : "#000000")} onChange={c => onChange({ textColor: c })} label="Text Color" isDark={isDark} />
          <div>
            <label className="text-xs block mb-1 text-gray-500">Font Size</label>
            <select value={block.metadata?.fontSize || "16px"} onChange={e => onChange({ fontSize: e.target.value })} className={`w-full text-xs p-1.5 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
              {["12px", "14px", "16px", "18px", "20px", "24px", "30px", "36px", "48px"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1 text-gray-500">Font Family</label>
            <select value={block.metadata?.fontFamily || "Poppins, sans-serif"} onChange={e => onChange({ fontFamily: e.target.value })} className={`w-full text-xs p-1.5 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
              {["Poppins, sans-serif", "Arial, sans-serif", "Georgia, serif", "Courier New, monospace", "Times New Roman, serif", "Helvetica, sans-serif"].map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f.split(",")[0]}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs block mb-1 text-gray-500">Weight</label>
              <select value={block.metadata?.fontWeight || "400"} onChange={e => onChange({ fontWeight: e.target.value })} className={`w-full text-xs p-1.5 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
                {[["300", "Light"], ["400", "Normal"], ["500", "Medium"], ["600", "SemiBold"], ["700", "Bold"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1 text-gray-500">Align</label>
              <div className="flex gap-0.5">
                {[{ icon: <AlignLeft size={11} />, v: "left" }, { icon: <AlignCenter size={11} />, v: "center" }, { icon: <AlignRight size={11} />, v: "right" }, { icon: <AlignJustify size={11} />, v: "justify" }].map(({ icon, v }) => (
                  <button key={v} onMouseDown={e => { e.preventDefault(); onChange({ align: v as any }) }} className={`p-1 rounded ${block.metadata?.align === v ? isDark ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-600" : isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-600"}`}>{icon}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {[
              { icon: <span className="text-xs font-bold">B</span>, prop: "fontWeight", val: "700", active: block.metadata?.fontWeight === "700" },
              { icon: <em className="text-xs italic">I</em>, prop: "fontStyle", val: "italic", active: block.metadata?.fontStyle === "italic" },
              { icon: <UnderlineIcon size={12} />, prop: "textDecoration", val: "underline", active: block.metadata?.textDecoration === "underline" },
              { icon: <Strikethrough size={12} />, prop: "textDecoration", val: "line-through", active: block.metadata?.textDecoration === "line-through" },
            ].map(({ icon, prop, val, active }) => (
              <button key={prop + val} onMouseDown={e => { e.preventDefault(); onChange({ [prop]: active ? undefined : val }) }} className={`p-1.5 rounded-md ${active ? isDark ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-600" : isDark ? "hover:bg-gray-700 text-gray-400" : "hover:bg-gray-100 text-gray-600"}`}>{icon}</button>
            ))}
          </div>
        </div>
      )}
      {tab === "background" && (
        <div className="space-y-3">
          <ColorPicker color={block.metadata?.backgroundColor || (isDark ? "#1f2937" : "#f3f4f6")} onChange={c => onChange({ backgroundColor: c })} label="Background Color" isDark={isDark} />
          <div>
            <label className="text-xs block mb-1 text-gray-500">Opacity ({Math.round((block.metadata?.opacity ?? 1) * 100)}%)</label>
            <input type="range" min="0" max="100" value={(block.metadata?.opacity ?? 1) * 100} onChange={e => onChange({ opacity: parseInt(e.target.value) / 100 })} className="w-full" />
          </div>
        </div>
      )}
      {tab === "border" && (
        <div className="space-y-3">
          <ColorPicker color={block.metadata?.borderColor || (isDark ? "#4b5563" : "#e5e7eb")} onChange={c => onChange({ borderColor: c })} label="Border Color" isDark={isDark} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs block mb-1 text-gray-500">Width</label>
              <select value={block.metadata?.borderWidth || "0px"} onChange={e => onChange({ borderWidth: e.target.value })} className={`w-full text-xs p-1.5 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
                {["0px", "1px", "2px", "3px", "4px", "5px"].map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1 text-gray-500">Style</label>
              <select value={block.metadata?.borderStyle || "solid"} onChange={e => onChange({ borderStyle: e.target.value })} className={`w-full text-xs p-1.5 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
                {["solid", "dashed", "dotted", "double"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs block mb-1 text-gray-500">Radius</label>
            <select value={block.metadata?.borderRadius || "0px"} onChange={e => onChange({ borderRadius: e.target.value })} className={`w-full text-xs p-1.5 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
              {["0px", "4px", "8px", "12px", "16px", "24px", "9999px"].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      )}
      {tab === "layout" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {["Top", "Bottom"].map(side => (
              <div key={side}>
                <label className="text-xs block mb-1 text-gray-500">Space {side}</label>
                <select value={side === "Top" ? block.metadata?.spacingTop || "0px" : block.metadata?.spacingBottom || "0px"} onChange={e => onChange(side === "Top" ? { spacingTop: e.target.value } : { spacingBottom: e.target.value })} className={`w-full text-xs p-1.5 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
                  {["0px", "4px", "8px", "12px", "16px", "24px", "32px", "48px", "64px"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs block mb-1 text-gray-500">Shadow</label>
            <select value={block.metadata?.shadow || "none"} onChange={e => onChange({ shadow: e.target.value })} className={`w-full text-xs p-1.5 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
              {["none", "sm", "md", "lg", "xl"].map(s => <option key={s} value={s}>{s === "none" ? "None" : s.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inline Block Menu ────────────────────────────────────────────────────────

interface InlineMenuState { blockIndex: number; mode: "add" | "convert"; anchorRect: DOMRect }

const InlineBlockMenu: React.FC<{
  state: InlineMenuState
  onSelect: (type: BlockType) => void
  onClose: () => void
  isDark: boolean
}> = ({ state, onSelect, onClose, isDark }) => {
  const [search, setSearch] = useState("")
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [onClose])

  const filtered = BLOCK_GROUPS
    .map(g => ({
      ...g,
      items: g.items.filter(
        b =>
          !search ||
          b.label.toLowerCase().includes(search.toLowerCase()) ||
          b.desc.toLowerCase().includes(search.toLowerCase())
      ),
    }))
    .filter(g => g.items.length > 0)

  const MENU_W = 288
  const MENU_H = 360
  const MARGIN = 8

  const vw = typeof window !== "undefined" ? window.innerWidth : 1200
  const vh = typeof window !== "undefined" ? window.innerHeight : 800

  const { top: anchorTop, bottom: anchorBottom, left: anchorLeft, right: anchorRight } = state.anchorRect

  const fitsRight = anchorRight + MENU_W + MARGIN <= vw
  const left = fitsRight
    ? anchorRight + 6
    : Math.max(MARGIN, anchorLeft - MENU_W - 6)

  const top = Math.min(
    Math.max(MARGIN, anchorTop),
    vh - MENU_H - MARGIN
  )

  return (
    <div
      ref={ref}
      className={`fixed z-[200] w-72 rounded-2xl shadow-2xl border overflow-hidden ${isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
        }`}
      style={{ top, left }}
    >
      <div className={`p-3 border-b ${isDark ? "border-gray-800" : "border-gray-100"}`}>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
          <Search size={13} className={isDark ? "text-gray-500" : "text-gray-400"} />
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") onClose() }}
            placeholder="Search blocks…"
            className={`flex-1 text-sm bg-transparent outline-none ${isDark ? "text-gray-200 placeholder-gray-600" : "text-gray-700 placeholder-gray-400"
              }`}
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X size={12} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto p-2 space-y-3">
        {filtered.map(group => (
          <div key={group.label}>
            <p className={`text-[10px] font-bold uppercase tracking-widest px-2 mb-1.5 ${isDark ? "text-gray-600" : "text-gray-400"
              }`}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ type, icon, label, desc }) => (
                <button
                  key={type}
                  onClick={() => { onSelect(type); onClose() }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all group/item ${isDark ? "hover:bg-gray-800 text-gray-300" : "hover:bg-gray-50 text-gray-700"
                    }`}
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDark
                    ? "bg-gray-800 group-hover/item:bg-indigo-950 group-hover/item:text-indigo-400 text-gray-500"
                    : "bg-gray-100 group-hover/item:bg-indigo-50 group-hover/item:text-indigo-600 text-gray-500"
                    }`}>
                    {icon}
                  </span>
                  <div>
                    <div className="text-xs font-semibold">{label}</div>
                    <div className={`text-[10px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className={`text-center py-6 text-sm ${isDark ? "text-gray-600" : "text-gray-400"}`}>
            No blocks found
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Direct Text Block ────────────────────────────────────────────────────────

interface DirectBlockProps { block: PageBlock; onChange: (block: PageBlock) => void; onEnter: () => void; onDeleteIfEmpty: () => void; onSlash: (rect: DOMRect) => void; isDark: boolean; autoFocus?: boolean }

const DirectBlock: React.FC<DirectBlockProps> = ({ block, onChange, onEnter, onDeleteIfEmpty, onSlash, isDark, autoFocus }) => {
  const ref = useRef<HTMLDivElement>(null)
  const isSlashing = useRef(false)
  const lastSynced = useRef(block.content)

  const blockStyles: Record<string, string> = { heading1: "text-3xl font-bold tracking-tight", heading2: "text-2xl font-semibold", heading3: "text-xl font-medium", quote: "text-base italic", text: "text-base leading-relaxed" }
  const placeholders: Record<string, string> = { heading1: "Heading 1", heading2: "Heading 2", heading3: "Heading 3", quote: "Quote…", text: "Type '/' for commands…" }

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = block.content
      lastSynced.current = block.content
    }
    if (autoFocus) {
      setTimeout(() => {
        ref.current?.focus()
        const r = document.createRange(); const s = window.getSelection()
        if (ref.current) { r.selectNodeContents(ref.current); r.collapse(false); s?.removeAllRanges(); s?.addRange(r) }
      }, 0)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (ref.current && block.content !== lastSynced.current) {
      ref.current.innerHTML = block.content
      lastSynced.current = block.content
    }
  }, [block.content])

  useEffect(() => {
    if (!ref.current || !block.metadata) return
    const s = ref.current.style
    s.color = block.metadata.textColor || ""; s.fontSize = block.metadata.fontSize || ""; s.fontFamily = block.metadata.fontFamily || ""
    s.fontWeight = block.metadata.fontWeight || ""; s.fontStyle = block.metadata.fontStyle || ""; s.textDecoration = block.metadata.textDecoration || ""
    s.letterSpacing = block.metadata.letterSpacing || ""; s.textTransform = block.metadata.textTransform || ""; s.lineHeight = block.metadata.lineHeight || ""
    s.textAlign = block.metadata.align || ""; s.backgroundColor = block.metadata.backgroundColor || ""; s.padding = block.metadata.padding || ""
    s.borderRadius = block.metadata.borderRadius || ""
    s.borderWidth = (block.metadata.borderWidth && block.metadata.borderWidth !== "0px") ? block.metadata.borderWidth : ""
    s.borderColor = (block.metadata.borderWidth && block.metadata.borderWidth !== "0px") ? (block.metadata.borderColor || "") : ""
    s.borderStyle = (block.metadata.borderWidth && block.metadata.borderWidth !== "0px") ? (block.metadata.borderStyle || "solid") : ""
    s.opacity = block.metadata.opacity !== undefined && block.metadata.opacity !== 1 ? String(block.metadata.opacity) : ""
    s.boxShadow = resolveShadow(block.metadata.shadow) || ""
  }, [block.metadata])

  const handleInput = () => {
    if (!ref.current) return
    const text = ref.current.innerText.trim()
    if (text === "/" && !isSlashing.current) { isSlashing.current = true; const rect = ref.current.getBoundingClientRect(); onSlash(rect) }
    else { isSlashing.current = false }
    const newContent = ref.current.innerHTML
    lastSynced.current = newContent
    onChange({ ...block, content: newContent })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onEnter() }
    if (e.key === "Backspace") { const text = ref.current?.innerText || ""; if (text === "") { e.preventDefault(); onDeleteIfEmpty() } }
    if (e.key === "Escape") { isSlashing.current = false }
  }

  return <div ref={ref} contentEditable suppressContentEditableWarning onInput={handleInput} onKeyDown={handleKeyDown} data-placeholder={placeholders[block.type] || "Type something…"} className={`w-full outline-none min-h-[1.5em] ${blockStyles[block.type] || "text-base"} ${isDark ? "text-gray-100" : "text-gray-900"} ${block.type === "quote" ? `border-l-4 pl-4 ${isDark ? "border-indigo-500 text-gray-300" : "border-indigo-400 text-gray-600"}` : ""}`} />
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

const ImageUpload: React.FC<{ block: PageBlock; onChange: (b: PageBlock) => void; isDark?: boolean }> = ({ block, onChange, isDark }) => {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const inlineStyle = buildInlineStyle(block.metadata)
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); const reader = new FileReader()
    reader.onload = ev => { onChange({ ...block, content: ev.target?.result as string, metadata: { ...block.metadata, caption: file.name } }); setUploading(false) }
    reader.readAsDataURL(file)
  }
  if (block.content) return (
    <div className="relative group">
      <img src={block.content} alt={block.metadata?.caption || "Image"} className="max-w-full" style={{ borderRadius: inlineStyle.borderRadius || "8px", boxShadow: inlineStyle.boxShadow, width: inlineStyle.width || "auto", opacity: inlineStyle.opacity }} />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
        <button onClick={() => fileRef.current?.click()} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"><ImageIcon size={16} /></button>
        <button onClick={() => onChange({ ...block, content: "" })} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white"><Trash2 size={16} /></button>
      </div>
      {block.metadata?.caption !== undefined && <input type="text" value={block.metadata.caption} onChange={e => onChange({ ...block, metadata: { ...block.metadata, caption: e.target.value } })} placeholder="Caption…" className={`mt-2 w-full text-sm text-center bg-transparent border-none outline-none ${isDark ? "text-gray-400" : "text-gray-500"}`} />}
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  )
  return (
    <div className={`border-2 border-dashed rounded-xl p-8 text-center ${isDark ? "border-gray-700" : "border-gray-200"}`}>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      <ImageIcon size={32} className={`mx-auto mb-2 ${isDark ? "text-gray-600" : "text-gray-400"}`} />
      <p className={`text-sm mb-3 ${isDark ? "text-gray-400" : "text-gray-600"}`}>{uploading ? "Uploading…" : "Click to upload image"}</p>
      <div className="flex gap-2 justify-center">
        <button onClick={() => fileRef.current?.click()} className="px-3 py-1.5 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600">Browse</button>
        <button onClick={() => { const u = prompt("Image URL:"); if (u) onChange({ ...block, content: u }) }} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">URL</button>
      </div>
    </div>
  )
}

// ─── Video Embed ──────────────────────────────────────────────────────────────

const VideoEmbed: React.FC<{ block: PageBlock; onChange: (b: PageBlock) => void; isDark?: boolean }> = ({ block, onChange, isDark }) => {
  const [url, setUrl] = useState(block.content || "")
  const getYT = (u: string) => { const m = u.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|&v=)([^#&?]{11})/); return m ? `https://www.youtube.com/embed/${m[1]}` : null }
  const getVi = (u: string) => { const m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/); return m ? `https://player.vimeo.com/video/${m[1]}` : null }
  const embed = () => { const yt = getYT(url), vi = getVi(url); onChange({ ...block, content: yt || vi || url, metadata: { ...block.metadata, embedType: yt ? "youtube" : vi ? "vimeo" : "custom" } }) }
  if (block.content) return (
    <div>
      <div className="relative group aspect-video">
        <iframe src={block.content} className="w-full h-full rounded-xl" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100">
          <button onClick={() => onChange({ ...block, content: "" })} className="p-2 bg-red-500/80 hover:bg-red-600 rounded-lg text-white"><Trash2 size={16} /></button>
        </div>
      </div>
    </div>
  )
  return (
    <div className={`border-2 border-dashed rounded-xl p-6 ${isDark ? "border-gray-700" : "border-gray-200"}`}>
      <Youtube size={28} className={`mx-auto mb-2 ${isDark ? "text-gray-600" : "text-gray-400"}`} />
      <p className={`text-sm text-center mb-3 ${isDark ? "text-gray-400" : "text-gray-600"}`}>YouTube, Vimeo, or embed URL</p>
      <div className="flex gap-2">
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" className={`flex-1 text-xs p-2 rounded-lg border ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`} />
        <button onClick={embed} disabled={!url} className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-sm disabled:opacity-50">Embed</button>
      </div>
    </div>
  )
}

// ─── Container Block ──────────────────────────────────────────────────────────

const ContainerBlock: React.FC<{ block: PageBlock; onChange: (b: PageBlock) => void; isDark?: boolean }> = ({ block, onChange, isDark }) => {
  const cols = block.metadata?.columns ?? 1
  const gap = block.metadata?.gap ?? "16px"
  const bg = block.metadata?.backgroundColor ?? "transparent"
  const pad = block.metadata?.padding ?? "16px"
  const radius = block.metadata?.borderRadius ?? "8px"
  const minH = block.metadata?.minHeight ?? "64px"

  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.innerHTML = block.content }, [])
  useEffect(() => {
    if (ref.current && block.content !== ref.current.innerHTML) {
      ref.current.innerHTML = block.content
    }
  }, [block.content])

  return (
    <div className="w-full relative">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-t-xl text-[10px] font-bold ${isDark ? "bg-gray-800 border border-gray-700" : "bg-gray-100 border border-gray-200"}`}>
        <Grid3x3 size={11} className={isDark ? "text-indigo-400" : "text-indigo-500"} />
        <span className={isDark ? "text-gray-400" : "text-gray-500"}>SECTION</span>
        <div className="flex gap-1 ml-2">
          {[1, 2, 3, 4].map(n => (
            <button
              key={n}
              onMouseDown={e => { e.preventDefault(); onChange(updateMetaSafe(block, { columns: n })) }}
              className="w-5 h-5 rounded text-[9px] font-bold transition-all"
              style={{
                background: cols === n ? "#6366f1" : isDark ? "#374151" : "#e5e7eb",
                color: cols === n ? "#fff" : isDark ? "#9ca3af" : "#6b7280",
              }}
            >{n}</button>
          ))}
        </div>
        <span className={isDark ? "text-gray-600" : "text-gray-400"}>col{cols !== 1 ? "s" : ""}</span>
        <div className="flex items-center gap-1 ml-auto">
          <span className={isDark ? "text-gray-600" : "text-gray-400"}>gap</span>
          <select
            value={gap}
            onChange={e => onChange(updateMetaSafe(block, { gap: e.target.value }))}
            className={`text-[9px] px-1 py-0.5 rounded border ${isDark ? "bg-gray-700 border-gray-600 text-gray-300" : "bg-white border-gray-200 text-gray-600"}`}
          >
            {["4px", "8px", "12px", "16px", "24px", "32px"].map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap,
          background: bg,
          padding: pad,
          borderRadius: `0 0 ${radius} ${radius}`,
          minHeight: minH,
          border: `1.5px dashed ${isDark ? "#374151" : "#e5e7eb"}`,
          borderTop: "none",
        }}
      >
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Type content inside container…"
          className={`col-span-full outline-none text-sm min-h-[40px] ${isDark ? "text-gray-200" : "text-gray-800"}`}
          onInput={e => onChange({ ...block, content: (e.currentTarget as HTMLDivElement).innerHTML })}
        />
      </div>
    </div>
  )
}

// ─── NEW: Button Block ────────────────────────────────────────────────────────

const ButtonBlock: React.FC<{ block: PageBlock; onChange: (b: PageBlock) => void; isDark?: boolean }> = ({ block, onChange, isDark }) => {
  const label = block.content || "Click Here"
  const url = block.metadata?.url || ""
  const bg = block.metadata?.backgroundColor || "#4f46e5"
  const color = block.metadata?.textColor || "#ffffff"
  const radius = block.metadata?.borderRadius || "8px"
  const align = block.metadata?.align || "left"

  return (
    <div className="w-full space-y-3">
      {/* Live preview */}
      <div style={{ textAlign: align as any }}>
        <span
          className="inline-flex items-center gap-2 px-5 py-2.5 font-semibold text-sm cursor-default select-none"
          style={{ background: bg, color, borderRadius: radius }}
        >
          {label}
        </span>
      </div>
      {/* Editor strip */}
      <div className={`grid grid-cols-2 gap-2 p-3 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
        <div className="col-span-2">
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Button Label</label>
          <input
            type="text"
            value={block.content}
            onChange={e => onChange({ ...block, content: e.target.value })}
            placeholder="Click Here"
            className={`w-full px-2 py-1.5 rounded-lg border outline-none text-xs ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200 text-gray-800"}`}
          />
        </div>
        <div className="col-span-2">
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>URL (optional)</label>
          <input
            type="text"
            value={url}
            onChange={e => onChange({ ...block, metadata: { ...block.metadata, url: e.target.value } })}
            placeholder="https://example.com"
            className={`w-full px-2 py-1.5 rounded-lg border outline-none text-xs ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200 text-gray-800"}`}
          />
        </div>
        <div>
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Background</label>
          <input type="color" value={bg} onChange={e => onChange({ ...block, metadata: { ...block.metadata, backgroundColor: e.target.value } })} className="w-full h-8 rounded cursor-pointer border-0" />
        </div>
        <div>
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Text Color</label>
          <input type="color" value={color} onChange={e => onChange({ ...block, metadata: { ...block.metadata, textColor: e.target.value } })} className="w-full h-8 rounded cursor-pointer border-0" />
        </div>
        <div>
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Radius</label>
          <select value={radius} onChange={e => onChange({ ...block, metadata: { ...block.metadata, borderRadius: e.target.value } })} className={`w-full px-2 py-1.5 rounded-lg border outline-none text-xs ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
            {["4px", "8px", "12px", "20px", "9999px"].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Align</label>
          <select value={align} onChange={e => onChange({ ...block, metadata: { ...block.metadata, align: e.target.value as any } })} className={`w-full px-2 py-1.5 rounded-lg border outline-none text-xs ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200"}`}>
            {["left", "center", "right"].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ─── NEW: Progress Bar Block ──────────────────────────────────────────────────

const ProgressBlock: React.FC<{ block: PageBlock; onChange: (b: PageBlock) => void; isDark?: boolean }> = ({ block, onChange, isDark }) => {
  const label = block.content || ""
  const value = Math.round((block.metadata?.opacity ?? 0.7) * 100)
  const barColor = block.metadata?.backgroundColor || "#4ade80"
  const trackColor = block.metadata?.borderColor || (isDark ? "#374151" : "#e5e7eb")

  const setValue = (v: number) => onChange({ ...block, metadata: { ...block.metadata, opacity: v / 100 } })

  return (
    <div className="w-full space-y-3">
      {/* Live preview */}
      <div className="w-full">
        {label && <div className={`text-xs font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-gray-700"}`}>{label}</div>}
        <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: trackColor }}>
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${value}%`, background: barColor }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px]" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>0%</span>
          <span className="text-[10px] font-bold" style={{ color: barColor }}>{value}%</span>
          <span className="text-[10px]" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>100%</span>
        </div>
      </div>
      {/* Controls */}
      <div className={`grid grid-cols-2 gap-2 p-3 rounded-xl border ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
        <div className="col-span-2">
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Label (optional)</label>
          <input
            type="text"
            value={label}
            onChange={e => onChange({ ...block, content: e.target.value })}
            placeholder="HTML Progress"
            className={`w-full px-2 py-1.5 rounded-lg border outline-none text-xs ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200 text-gray-800"}`}
          />
        </div>
        <div className="col-span-2">
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Progress: {value}%</label>
          <input type="range" min={0} max={100} value={value} onChange={e => setValue(Number(e.target.value))} className="w-full accent-indigo-500" />
        </div>
        <div>
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Bar Color</label>
          <input type="color" value={barColor} onChange={e => onChange({ ...block, metadata: { ...block.metadata, backgroundColor: e.target.value } })} className="w-full h-8 rounded cursor-pointer border-0" />
        </div>
        <div>
          <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Track Color</label>
          <input type="color" value={trackColor} onChange={e => onChange({ ...block, metadata: { ...block.metadata, borderColor: e.target.value } })} className="w-full h-8 rounded cursor-pointer border-0" />
        </div>
      </div>
    </div>
  )
}

// ─── NEW: Card Columns Block ──────────────────────────────────────────────────

const CardColumnsBlock: React.FC<{ block: PageBlock; onChange: (b: PageBlock) => void; isDark?: boolean }> = ({ block, onChange, isDark }) => {
  const data = parseCardData(block.content)
  const save = (next: CardColumnsData) => onChange({ ...block, content: JSON.stringify(next) })

  const CardPreview = ({ side }: { side: "left" | "right" }) => {
    const card = data[side]
    const bgMap = {
      left: isDark ? "#1a2e25" : "#f0fdf4",
      right: isDark ? "#1e1b3a" : "#f5f3ff",
    }
    return (
      <div className="flex-1 flex flex-col items-center text-center gap-3 p-5 rounded-2xl" style={{ background: bgMap[side] }}>
        <div className="font-bold text-sm" style={{ color: isDark ? "#f9fafb" : "#111827" }}>{card.title || `${side} Card Title`}</div>
        <div className="text-xs leading-relaxed" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>{card.desc || "Card description here"}</div>
        <span
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-bold cursor-default"
          style={{ background: card.btnColor }}
        >
          {side === "right" && <span>✦</span>}
          {card.btnLabel || "Button"}
        </span>
      </div>
    )
  }

  return (
    <div className="w-full space-y-4">
      {/* Live preview */}
      <div className="flex items-stretch relative gap-0">
        <CardPreview side="left" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg border ${isDark ? "bg-gray-700 text-gray-200 border-gray-600" : "bg-white text-gray-600 border-gray-200"}`}>
            OR
          </div>
        </div>
        <CardPreview side="right" />
      </div>

      {/* Editors */}
      {(["left", "right"] as const).map(side => (
        <details key={side} className={`rounded-xl border overflow-hidden ${isDark ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`} open={side === "left"}>
          <summary className={`px-3 py-2 text-xs font-bold cursor-pointer capitalize select-none ${isDark ? "text-gray-300" : "text-gray-700"}`}>
            {side === "left" ? "🟢" : "🟣"} {side} Card
          </summary>
          <div className={`p-3 space-y-2 border-t ${isDark ? "border-gray-700" : "border-gray-200"}`}>
            {[
              { field: "title", label: "Title" },
              { field: "desc", label: "Description" },
              { field: "btnLabel", label: "Button Label" },
              { field: "btnUrl", label: "Button URL" },
            ].map(({ field, label }) => (
              <div key={field}>
                <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>{label}</label>
                <input
                  type="text"
                  value={(data[side] as any)[field]}
                  onChange={e => save({ ...data, [side]: { ...data[side], [field]: e.target.value } })}
                  className={`w-full px-2 py-1.5 rounded-lg border outline-none text-xs ${isDark ? "bg-gray-700 border-gray-600 text-gray-200" : "bg-white border-gray-200 text-gray-800"}`}
                />
              </div>
            ))}
            <div>
              <label className={`block mb-1 text-[10px] font-bold ${isDark ? "text-gray-400" : "text-gray-500"}`}>Button Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={data[side].btnColor}
                  onChange={e => save({ ...data, [side]: { ...data[side], btnColor: e.target.value } })}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <span className={`text-xs font-mono ${isDark ? "text-gray-400" : "text-gray-500"}`}>{data[side].btnColor}</span>
              </div>
            </div>
          </div>
        </details>
      ))}
    </div>
  )
}

// ─── Page Link Block ──────────────────────────────────────────────────────────

interface PageLinkBlockProps {
  block: PageBlock; onChange: (b: PageBlock) => void
  allPages: PageData[]; currentPageId: string
  onNavigate: (pageId: string) => void
  isDark: boolean; isPreview: boolean
}

const PageLinkBlock: React.FC<PageLinkBlockProps> = ({ block, onChange, allPages, currentPageId, onNavigate, isDark, isPreview }) => {
  const [showPicker, setShowPicker] = useState(false)
  const [labelEditing, setLabelEditing] = useState(false)
  const [labelVal, setLabelVal] = useState(block.content || block.metadata?.linkedPageTitle || "Go to page")
  const ref = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLInputElement>(null)

  const linkedId = block.metadata?.linkedPageId
  const linkedPage = allPages.find(p => p.id === linkedId)
  const otherPages = allPages.filter(p => p.id !== currentPageId)

  useEffect(() => {
    if (showPicker) {
      const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShowPicker(false) }
      document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h)
    }
  }, [showPicker])

  const commitLabel = () => { setLabelEditing(false); onChange({ ...block, content: labelVal }) }

  const selectPage = (page: PageData) => {
    const newLabel = labelVal === "Go to page" || !labelVal ? `Go to ${page.title}` : labelVal
    setLabelVal(newLabel)
    onChange(updateMetaSafe({ ...block, content: newLabel }, { linkedPageId: page.id, linkedPageTitle: page.title }))
    setShowPicker(false)
  }

  if (isPreview) {
    return (
      <div className="my-2">
        <button onClick={() => linkedId ? onNavigate(linkedId) : undefined} className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${linkedId ? isDark ? "bg-indigo-800 text-indigo-200 hover:bg-indigo-700" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200" : isDark ? "bg-gray-800 text-gray-500 border border-dashed border-gray-700" : "bg-gray-50 text-gray-400 border border-dashed border-gray-300"}`}>
          <FileText size={14} />
          <span>{labelVal || block.metadata?.linkedPageTitle || "Go to page"}</span>
          <ArrowRight size={13} className="opacity-60" />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative my-1">
      <div className={`inline-flex items-center gap-1 rounded-xl border-2 overflow-visible ${linkedId ? isDark ? "border-indigo-700 bg-indigo-950/30" : "border-indigo-200 bg-indigo-50" : isDark ? "border-dashed border-gray-700 bg-gray-800/40" : "border-dashed border-gray-300 bg-gray-50"}`}>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-l-xl text-sm font-semibold ${linkedId ? isDark ? "text-indigo-300" : "text-indigo-700" : isDark ? "text-gray-500" : "text-gray-400"}`}>
          <FileText size={13} />
          {labelEditing ? (
            <input ref={labelRef} value={labelVal} onChange={e => setLabelVal(e.target.value)} onBlur={commitLabel} onKeyDown={e => { if (e.key === "Enter") commitLabel() }} className={`text-sm font-semibold bg-transparent outline-none border-b border-current w-36 ${isDark ? "text-indigo-300" : "text-indigo-700"}`} autoFocus />
          ) : (
            <span onDoubleClick={() => { setLabelEditing(true); setTimeout(() => labelRef.current?.select(), 0) }} className="cursor-text" title="Double-click to edit label">{labelVal || "Go to page"}</span>
          )}
          <ArrowRight size={13} className="opacity-50" />
        </div>
        <div className={`w-px self-stretch ${isDark ? "bg-indigo-800" : "bg-indigo-200"}`} />
        <div className="flex items-center gap-1 px-2">
          <button onClick={() => setShowPicker(v => !v)} title={linkedId ? "Change target page" : "Choose page to link"} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors ${showPicker ? isDark ? "bg-indigo-700 text-indigo-200" : "bg-indigo-500 text-white" : isDark ? "hover:bg-indigo-900 text-indigo-400" : "hover:bg-indigo-100 text-indigo-600"}`}>
            <Navigation size={11} />
            {linkedPage ? <span className="max-w-[80px] truncate">{linkedPage.title}</span> : <span>Link page</span>}
          </button>
          {linkedId && <button onClick={() => onChange(updateMetaSafe(block, { linkedPageId: undefined, linkedPageTitle: undefined }))} title="Remove link" className={`p-1 rounded-md ${isDark ? "hover:bg-red-950/40 text-red-500" : "hover:bg-red-50 text-red-400"}`}><X size={11} /></button>}
        </div>
      </div>
      {showPicker && (
        <div className={`absolute left-0 top-full mt-2 z-50 rounded-2xl shadow-2xl border overflow-hidden min-w-[240px] ${isDark ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
          <div className={`px-4 py-3 border-b flex items-center gap-2 ${isDark ? "border-gray-800 bg-gray-900" : "border-gray-100 bg-gray-50"}`}>
            <Link size={13} className={isDark ? "text-indigo-400" : "text-indigo-500"} />
            <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? "text-gray-400" : "text-gray-500"}`}>Choose Target Page</span>
          </div>
          <div className="p-2">
            {otherPages.length === 0
              ? <p className={`text-xs px-3 py-4 text-center ${isDark ? "text-gray-600" : "text-gray-400"}`}>No other pages yet.</p>
              : otherPages.map((page, idx) => (
                <button key={page.id} onClick={() => selectPage(page)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${page.id === linkedId ? isDark ? "bg-indigo-950/60 text-indigo-300" : "bg-indigo-50 text-indigo-700" : isDark ? "hover:bg-gray-800 text-gray-300" : "hover:bg-gray-50 text-gray-700"}`}>
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${isDark ? "bg-gray-800 text-indigo-400" : "bg-indigo-50 text-indigo-500"}`}>{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{page.title || "Untitled"}</div>
                    <div className={`text-[11px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>{page.blocks.length} block{page.blocks.length !== 1 ? "s" : ""}</div>
                  </div>
                  {page.id === linkedId && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isDark ? "bg-indigo-900 text-indigo-300" : "bg-indigo-100 text-indigo-600"}`}>linked</span>}
                </button>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

// ─── List Item ────────────────────────────────────────────────────────────────

const ListItem: React.FC<{ block: PageBlock; index: number; prefix: string; prefixClass: string; onChange: (b: PageBlock) => void; onAddBelow: () => void; onDelete: () => void; isDark: boolean }> = ({ block, index, prefix, prefixClass, onChange, onAddBelow, onDelete, isDark }) => {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ref.current) ref.current.innerHTML = block.content }, [])
  useEffect(() => {
    if (!ref.current || !block.metadata) return
    const s = ref.current.style
    s.color = block.metadata.textColor || ""; s.fontSize = block.metadata.fontSize || ""; s.fontFamily = block.metadata.fontFamily || ""
    s.fontWeight = block.metadata.fontWeight || ""; s.fontStyle = block.metadata.fontStyle || ""; s.textDecoration = block.metadata.textDecoration || ""
    s.textAlign = block.metadata.align || ""; s.lineHeight = block.metadata.lineHeight || ""; s.textTransform = block.metadata.textTransform || ""
  }, [block.metadata])
  return (
    <div className="flex items-baseline gap-3 w-full px-2 py-0.5">
      <span className={`select-none flex-shrink-0 leading-7 ${prefixClass}`}>{prefix}</span>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange({ ...block, content: ref.current.innerHTML }) }}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); onAddBelow() }
          if (e.key === "Backspace" && (ref.current?.innerText || "") === "") { e.preventDefault(); onDelete() }
          if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertHTML", false, "\u00a0\u00a0\u00a0\u00a0") }
        }}
        data-placeholder="List item…"
        className={`flex-1 outline-none text-base leading-7 min-h-[1.75rem] break-words ${isDark ? "text-gray-200" : "text-gray-800"}`}
        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
      />
    </div>
  )
}

// ─── Snippet Block ────────────────────────────────────────────────────────────

const SNIPPET_LANGUAGES = [
  "html", "css", "javascript", "typescript", "python",
  "java", "sql", "bash", "json", "other"
]

const SnippetBlock: React.FC<{
  block: PageBlock
  onChange: (b: PageBlock) => void
  isDark?: boolean
}> = ({ block, onChange, isDark }) => {
  const title = block.metadata?.snippetTitle ?? ""
  const language = block.metadata?.snippetLanguage ?? "html"
  const code = block.content ?? ""
  const lines = code.split("\n")

  const LANG_COLOR: Record<string, string> = {
    html: "#e34c26", css: "#264de4", javascript: "#f7df1e",
    typescript: "#3178c6", python: "#3776ab", java: "#ed8b00",
    sql: "#f29111", bash: "#4eaa25", json: "#292929", other: "#888"
  }
  const langColor = LANG_COLOR[language] ?? "#888"

  return (
    <div className="w-full rounded-xl overflow-hidden border"
      style={{ borderColor: isDark ? "#334155" : "#e2e8f0", fontFamily: "inherit" }}>
      <div className="flex items-center gap-3 px-3 py-2 flex-wrap"
        style={{ background: isDark ? "#1e293b" : "#f1f5f9", borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>
        <input
          type="text"
          value={title}
          onChange={e => onChange(updateMetaSafe(block, { snippetTitle: e.target.value }))}
          placeholder="Snippet title…"
          className="flex-1 min-w-[120px] text-sm font-semibold bg-transparent outline-none"
          style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}
        />
        <select
          value={language}
          onChange={e => onChange(updateMetaSafe(block, { snippetLanguage: e.target.value }))}
          className="text-[11px] font-bold px-2 py-1 rounded-lg outline-none cursor-pointer"
          style={{ background: `${langColor}18`, color: langColor, border: `1.5px solid ${langColor}40` }}>
          {SNIPPET_LANGUAGES.map(l => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </select>
      </div>
      <div style={{ background: "#1e1e1e", position: "relative", minHeight: "200px" }}>
        <div style={{
          position: "absolute", top: 0, left: 0, bottom: 0, width: "44px",
          background: "#1e1e1e", borderRight: "1px solid #333",
          paddingTop: "10px", pointerEvents: "none", zIndex: 1,
          fontFamily: "Fira Code, Cascadia Code, Courier New, monospace",
          fontSize: "13px", lineHeight: "1.75",
        }}>
          {code.split("\n").map((_, i) => (
            <div key={i} style={{ textAlign: "right", paddingRight: "10px", color: "#555", userSelect: "none", height: "22.75px" }}>
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          value={code}
          onChange={e => onChange({ ...block, content: e.target.value, metadata: { ...(block.metadata ?? {}), snippetTitle: block.metadata?.snippetTitle ?? "", snippetLanguage: block.metadata?.snippetLanguage ?? "html" } })}
          onKeyDown={e => {
            if (e.key !== "Tab") return
            e.preventDefault()
            const ta = e.currentTarget
            const start = ta.selectionStart
            const end = ta.selectionEnd
            const next = code.slice(0, start) + "  " + code.slice(end)
            onChange({ ...block, content: next, metadata: { ...(block.metadata ?? {}), snippetLanguage: block.metadata?.snippetLanguage ?? "html" } })
            requestAnimationFrame(() => { ta.selectionStart = start + 2; ta.selectionEnd = start + 2 })
          }}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          placeholder={`// ${language} code here…`}
          style={{
            display: "block", width: "100%", minHeight: "200px",
            padding: "10px 16px 10px 60px", background: "#1e1e1e", color: "#d4d4d4",
            border: "none", outline: "none", resize: "vertical",
            fontFamily: "Fira Code, Cascadia Code, Courier New, monospace",
            fontSize: "13px", lineHeight: "1.75", whiteSpace: "pre",
            overflowX: "auto", overflowWrap: "normal", wordBreak: "normal",
            tabSize: 2, caretColor: "#fff", boxSizing: "border-box",
          }}
        />
        <CopyButton code={code} />
      </div>
      <div className="flex items-center justify-between px-4 py-1.5"
        style={{ background: isDark ? "#0f172a" : "#f8fafc", borderTop: "1px solid #333" }}>
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: langColor }}>{language}</span>
        <span className="text-[10px]" style={{ color: "#555" }}>{lines.length} line{lines.length !== 1 ? "s" : ""}</span>
      </div>
    </div>
  )
}

const CopyButton: React.FC<{ code: string }> = ({ code }) => {
  const [copied, setCopied] = React.useState(false)
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }
        catch { /* silent */ }
      }}
      style={{
        position: "absolute", top: "8px", right: "10px",
        background: copied ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.08)",
        border: `1px solid ${copied ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.15)"}`,
        color: copied ? "#10b981" : "#94a3b8",
        borderRadius: "8px", padding: "4px 10px",
        fontSize: "10px", fontWeight: 700, cursor: "pointer",
        display: "flex", alignItems: "center", gap: "5px",
        transition: "all 0.15s",
      }}>
      {copied ? "✓ Copied" : "Copy"}
    </button>
  )
}

// ─── Block Component ──────────────────────────────────────────────────────────

interface BlockComponentProps {
  block: PageBlock; index: number
  onChange: (b: PageBlock) => void; onDelete: () => void; onDuplicate: () => void
  onMoveUp: () => void; onMoveDown: () => void; onAddBelow: (type: BlockType) => void
  onSlash: (rect: DOMRect, index: number) => void
  isSelected: boolean; onSelect: () => void; isDark: boolean; autoFocus?: boolean
  onOpenMenu: (rect: DOMRect) => void
  allPages: PageData[]; currentPageId: string; onNavigateToPage: (pageId: string) => void; isPreview: boolean
}
const CodePlaygroundBlock: React.FC<{
  block: PageBlock
  onChange: (b: PageBlock) => void
  isDark?: boolean
}> = ({ block, onChange, isDark }) => {
  const activeTab      = block.metadata?.playgroundActiveTab  ?? "html"
  const primaryTab     = block.metadata?.playgroundPrimaryTab ?? "auto"
  const html           = block.metadata?.playgroundHtml       ?? ""
  const css            = block.metadata?.playgroundCss        ?? ""
  const js             = block.metadata?.playgroundJs         ?? ""
  const layout         = block.metadata?.playgroundLayout     ?? "horizontal"
  const title          = block.metadata?.snippetTitle         ?? ""

  const setMeta = (patch: Partial<PageBlock["metadata"]>) =>
    onChange({ ...block, metadata: { ...block.metadata, ...patch } })

  const TAB_CONFIG = {
    html: { label: "HTML", color: "#e34c26", field: "playgroundHtml" as const, value: html },
    css:  { label: "CSS",  color: "#264de4", field: "playgroundCss"  as const, value: css  },
    js:   { label: "JS",   color: "#f7df1e", field: "playgroundJs"   as const, value: js   },
  }

  const previewDoc = `<!DOCTYPE html><html><head><style>${css}<\/style><\/head><body>${html}<script>${js}<\/script><\/body><\/html>`

  // ── Which tabs have content (for visual indicator) ──────────────────────
  const hasContent = {
    html: html.trim().length > 0,
    css:  css.trim().length  > 0,
    js:   js.trim().length   > 0,
  }

  return (
    <div
      className="w-full rounded-xl overflow-hidden border"
      style={{ borderColor: isDark ? "#334155" : "#e2e8f0" }}
    >
      {/* ── Title bar ──────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
        <Play size={12} style={{ color: "#6366f1" }} />
        <input
          type="text"
          value={title}
          onChange={e => setMeta({ snippetTitle: e.target.value })}
          placeholder="Playground title (optional)…"
          className={`flex-1 text-sm font-semibold bg-transparent outline-none ${isDark ? "text-gray-200 placeholder-gray-600" : "text-gray-800 placeholder-gray-400"}`}
        />
        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${isDark ? "bg-indigo-900 text-indigo-400" : "bg-indigo-50 text-indigo-500"}`}>
          Playground
        </span>
      </div>

      {/* ── "Students see first" pin row ───────────────────────────────── */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${isDark ? "bg-gray-900 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
        <span className={`text-[10px] font-bold uppercase tracking-widest flex-shrink-0 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
          Students see first →
        </span>
        {(["html","css","js"] as const).map(t => {
          const cfg = TAB_CONFIG[t]
          const isPinned = primaryTab === t
          return (
            <button
              key={t}
              onMouseDown={e => { e.preventDefault(); setMeta({ playgroundPrimaryTab: t }) }}
              className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1"
              style={{
                background: isPinned ? `${cfg.color}20` : "transparent",
                color:      isPinned ? cfg.color : isDark ? "#6b7280" : "#9ca3af",
                border:     isPinned ? `1.5px solid ${cfg.color}50` : `1.5px solid transparent`,
              }}
            >
              {t.toUpperCase()}
              {/* Dot shows if this tab has content */}
              {hasContent[t] && (
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: cfg.color }}
                />
              )}
            </button>
          )
        })}
        <button
          onMouseDown={e => { e.preventDefault(); setMeta({ playgroundPrimaryTab: "auto" }) }}
          className="px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
          style={{
            background: primaryTab === "auto" ? (isDark ? "#374151" : "#e5e7eb") : "transparent",
            color:      primaryTab === "auto" ? (isDark ? "#d1d5db" : "#374151") : (isDark ? "#6b7280" : "#9ca3af"),
          }}
        >
          Auto
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Layout toggle */}
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-gray-600" : "text-gray-400"}`}>
          Layout
        </span>
        {(["horizontal","vertical"] as const).map(l => (
          <button
            key={l}
            onMouseDown={e => { e.preventDefault(); setMeta({ playgroundLayout: l }) }}
            className="px-2 py-1 rounded text-[10px] font-bold transition-all"
            style={{
              background: layout === l ? (isDark ? "#374151" : "#e5e7eb") : "transparent",
              color:      layout === l ? (isDark ? "#d1d5db" : "#374151") : (isDark ? "#6b7280" : "#9ca3af"),
            }}
          >
            {l === "horizontal" ? "Side by side" : "Stacked"}
          </button>
        ))}
      </div>

      {/* ── Editor tabs ────────────────────────────────────────────────── */}
      <div className={`flex items-center gap-1 px-3 py-2 border-b ${isDark ? "bg-gray-900 border-gray-700" : "bg-gray-100 border-gray-200"}`}>
        {(["html","css","js"] as const).map(t => {
          const cfg       = TAB_CONFIG[t]
          const isActive  = activeTab === t
          return (
            <button
              key={t}
              onMouseDown={e => { e.preventDefault(); setMeta({ playgroundActiveTab: t }) }}
              className="px-3 py-1 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5"
              style={{
                background: isActive ? `${cfg.color}20` : "transparent",
                color:      isActive ? cfg.color : isDark ? "#6b7280" : "#9ca3af",
                border:     isActive ? `1.5px solid ${cfg.color}50` : "1.5px solid transparent",
              }}
            >
              {cfg.label}
              {/* Filled dot = has content */}
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: hasContent[t] ? cfg.color : "transparent", border: `1px solid ${hasContent[t] ? cfg.color : (isDark ? "#4b5563" : "#d1d5db")}` }}
              />
            </button>
          )
        })}

        {/* Character count for active tab */}
        <span className={`ml-auto text-[10px] ${isDark ? "text-gray-600" : "text-gray-400"}`}>
          {TAB_CONFIG[activeTab].value.length} chars
        </span>
      </div>

      {/* ── Main area: editor + preview ────────────────────────────────── */}
      <div
        style={{
          display:               layout === "horizontal" ? "grid" : "flex",
          gridTemplateColumns:   layout === "horizontal" ? "1fr 1fr" : undefined,
          flexDirection:         layout === "vertical"   ? "column" : undefined,
          minHeight:             280,
        }}
      >
        {/* Editor */}
        <div style={{ borderRight: layout === "horizontal" ? `1px solid ${isDark ? "#334155" : "#e2e8f0"}` : undefined, borderBottom: layout === "vertical" ? `1px solid ${isDark ? "#334155" : "#e2e8f0"}` : undefined }}>
          <textarea
            key={activeTab}
            value={TAB_CONFIG[activeTab].value}
            onChange={e => setMeta({ [TAB_CONFIG[activeTab].field]: e.target.value })}
            onKeyDown={e => {
              if (e.key !== "Tab") return
              e.preventDefault()
              const ta  = e.currentTarget
              const s   = ta.selectionStart
              const val = TAB_CONFIG[activeTab].value
              setMeta({ [TAB_CONFIG[activeTab].field]: val.slice(0, s) + "  " + val.slice(ta.selectionEnd) })
              requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2 })
            }}
            spellCheck={false}
            placeholder={`Write ${TAB_CONFIG[activeTab].label} here…`}
            className="w-full outline-none p-4 text-[13px] font-mono leading-relaxed resize-none"
            style={{
              background: isDark ? "#1e1e1e" : "#fafafa",
              color:      isDark ? "#d4d4d4" : "#1f2937",
              minHeight:  280,
              tabSize:    2,
            }}
          />
        </div>

        {/* Live preview */}
        <div className="flex flex-col">
          <div className={`flex items-center justify-between px-3 py-1.5 flex-shrink-0 border-b ${isDark ? "bg-gray-900 border-gray-700" : "bg-gray-100 border-gray-200"}`}>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-gray-500" : "text-gray-400"}`}>Live Preview</span>
            </div>
            <button
              onMouseDown={e => {
                e.preventDefault()
                const w = window.open("", "_blank")
                if (w) { w.document.write(previewDoc); w.document.close() }
              }}
              className={`text-[10px] px-2 py-0.5 rounded font-bold ${isDark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
            >
              ↗ Pop out
            </button>
          </div>
          <iframe
            key={html + css + js}
            srcDoc={previewDoc}
            sandbox="allow-scripts allow-same-origin"
            className="flex-1 w-full border-none"
            style={{ minHeight: 240, background: "#fff" }}
            title="playground-preview"
          />
        </div>
      </div>

      {/* ── Footer — what will be saved ────────────────────────────────── */}
      <div className={`flex items-center gap-3 px-3 py-2 border-t text-[10px] font-medium ${isDark ? "bg-gray-900 border-gray-700 text-gray-600" : "bg-gray-50 border-gray-200 text-gray-400"}`}>
        <span>Saving:</span>
        {(["html","css","js"] as const).map(t => (
          <span
            key={t}
            style={{ color: hasContent[t] ? TAB_CONFIG[t].color : (isDark ? "#4b5563" : "#d1d5db") }}
          >
            {t.toUpperCase()} {hasContent[t] ? "✓" : "—"}
          </span>
        ))}
        <span className="ml-auto">
          Primary tab for students: <strong>{primaryTab === "auto" ? "auto detect" : primaryTab.toUpperCase()}</strong>
        </span>
      </div>
    </div>
  )
}
const BlockComponent: React.FC<BlockComponentProps> = ({
  block, index, onChange, onDelete, onDuplicate, onMoveUp, onMoveDown,
  onAddBelow, onSlash, isSelected, onSelect, isDark, autoFocus, onOpenMenu,
  allPages, currentPageId, onNavigateToPage, isPreview
}) => {
  const [showGripMenu, setShowGripMenu] = useState(false)
  const [showStylePanel, setShowStylePanel] = useState(false)
  const plusRef = useRef<HTMLButtonElement>(null)
  const gripRef = useRef<HTMLButtonElement>(null)

  const renderContent = () => {
    switch (block.type) {
      case "text": case "heading1": case "heading2": case "heading3": case "quote":
        return <DirectBlock block={block} onChange={onChange} onEnter={() => onAddBelow("text")} onDeleteIfEmpty={onDelete} onSlash={(rect) => onSlash(rect, index)} isDark={isDark} autoFocus={autoFocus} />
      case "bulleted_list":
        return <ListItem block={block} index={index} prefix="•" prefixClass="text-lg text-indigo-400" onChange={onChange} onAddBelow={() => onAddBelow("bulleted_list")} onDelete={onDelete} isDark={isDark} />
      case "numbered_list":
        return <ListItem block={block} index={index} prefix={`${index + 1}.`} prefixClass="text-sm font-mono text-indigo-400" onChange={onChange} onAddBelow={() => onAddBelow("numbered_list")} onDelete={onDelete} isDark={isDark} />
      case "todo":
        return (
          <div className="flex items-start gap-3 w-full">
            <input type="checkbox" checked={block.metadata?.checked || false} onChange={e => onChange(updateMetaSafe(block, { checked: e.target.checked }))} className="mt-3.5 w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer" />
            <DirectBlock block={block} onChange={onChange} onEnter={() => onAddBelow("todo")} onDeleteIfEmpty={onDelete} onSlash={(rect) => onSlash(rect, index)} isDark={isDark} autoFocus={autoFocus} />
          </div>
        )
      case "snippet":
        return <SnippetBlock block={block} onChange={onChange} isDark={isDark} />
      case "container":
        return <ContainerBlock block={block} onChange={onChange} isDark={isDark} />

      // ── NEW BLOCKS ──────────────────────────────────────────────────────────
      case "button":
        return <ButtonBlock block={block} onChange={onChange} isDark={isDark} />
      case "progress":
        return <ProgressBlock block={block} onChange={onChange} isDark={isDark} />
      case "card_columns":
        return <CardColumnsBlock block={block} onChange={onChange} isDark={isDark} />
        case "code_playground":
  return <CodePlaygroundBlock block={block} onChange={onChange} isDark={isDark} />
      // ───────────────────────────────────────────────────────────────────────
      case "code_playground":
        return <CodePlaygroundBlock block={block} onChange={onChange} isDark={isDark} />;
      case "divider": {
        const divColor = block.metadata?.borderColor || "#9ca3af"
        return (
          <div className="w-full flex items-center gap-3 py-2">
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${divColor}, transparent)` }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: divColor }} />
            <div className="flex-1 h-px" style={{ background: `linear-gradient(to right, transparent, ${divColor}, transparent)` }} />
          </div>
        )
      }
      case "image": return <ImageUpload block={block} onChange={onChange} isDark={isDark} />
      case "video": return <VideoEmbed block={block} onChange={onChange} isDark={isDark} />
      case "page_link":
        return <PageLinkBlock block={block} onChange={onChange} allPages={allPages} currentPageId={currentPageId} onNavigate={onNavigateToPage} isDark={isDark} isPreview={isPreview} />
      case "table": {
        const ts = buildInlineStyle(block.metadata)
        const tableData = block.metadata?.data || [["Header 1", "Header 2"], ["", ""]]
        return (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse">
              <tbody>
                {tableData.map((row, i) => (
                  <tr key={i} style={{ backgroundColor: i === 0 ? (isDark ? "#1f2937" : "#f9fafb") : undefined }}>
                    {row.map((cell, j) => (
                      <td key={j} className={`px-3 py-2 ${i === 0 ? "font-semibold" : ""}`} style={{ border: `1px solid ${block.metadata?.borderColor || (isDark ? "#374151" : "#e5e7eb")}`, color: ts.color, fontSize: ts.fontSize }}>
                        <div contentEditable suppressContentEditableWarning className="outline-none min-w-[80px] text-sm" onBlur={e => { const nd = tableData.map(r => [...r]); nd[i][j] = e.currentTarget.textContent || ""; onChange(updateMetaSafe(block, { data: nd })) }}>{cell}</div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-3 mt-2 px-1">
              <button onClick={() => { const nd = [...tableData, Array(tableData[0]?.length || 2).fill("")]; onChange(updateMetaSafe(block, { data: nd })) }} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">+ Row</button>
              <button onClick={() => { const nd = tableData.map(r => [...r, ""]); onChange(updateMetaSafe(block, { data: nd })) }} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">+ Column</button>
              <button onClick={() => { if (tableData.length > 1) onChange(updateMetaSafe(block, { data: tableData.slice(0, -1) })) }} className="text-xs text-red-400 hover:text-red-600 font-medium">- Row</button>
            </div>
          </div>
        )
      }
      case "callout": {
        const cs = buildInlineStyle(block.metadata)
        return (
          <div className="w-full p-4 rounded-xl border flex gap-3 items-start" style={{ backgroundColor: cs.backgroundColor || (isDark ? "#1e293b" : "#FFF7ED"), borderColor: cs.borderColor || (isDark ? "#334155" : "#FED7AA"), borderWidth: "1px", borderStyle: "solid", borderRadius: "12px" }}>
            <select value={block.metadata?.url || "💡"} onChange={e => onChange(updateMetaSafe(block, { url: e.target.value }))} className="text-xl bg-transparent border-none outline-none cursor-pointer mt-1">
              {["💡", "⚠️", "✅", "❌", "🔥", "📌", "💬", "🎯", "🚀", "📝"].map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <div className="flex-1"><DirectBlock block={block} onChange={onChange} onEnter={() => onAddBelow("text")} onDeleteIfEmpty={onDelete} onSlash={(rect) => onSlash(rect, index)} isDark={isDark} /></div>
          </div>
        )
      }
      default: return <DirectBlock block={block} onChange={onChange} onEnter={() => onAddBelow("text")} onDeleteIfEmpty={onDelete} onSlash={(rect) => onSlash(rect, index)} isDark={isDark} />
    }
  }

  return (
    <div
      className={`group/block relative w-full transition-all duration-100 ${isSelected ? "ring-2 ring-inset ring-indigo-300 dark:ring-indigo-700 rounded-xl" : ""}`}
      style={{ marginTop: block.metadata?.spacingTop || "0px", marginBottom: block.metadata?.spacingBottom || "0px" }}
      onClick={onSelect}
    >
      {(showGripMenu || showStylePanel) && <div className="fixed inset-0 z-30" onMouseDown={() => { setShowGripMenu(false); setShowStylePanel(false) }} />}
      <div className="absolute -left-14 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity z-40">
        <button ref={plusRef} onClick={e => { e.stopPropagation(); const rect = plusRef.current!.getBoundingClientRect(); onOpenMenu(rect) }} className={`p-1.5 rounded-lg transition-colors ${isDark ? "hover:bg-gray-700 text-gray-500 hover:text-gray-300" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"}`} title="Add block"><Plus size={14} /></button>
        <button ref={gripRef} onClick={e => { e.stopPropagation(); setShowStylePanel(false); setShowGripMenu(v => !v) }} className={`p-1.5 rounded-lg transition-colors cursor-grab ${isDark ? "hover:bg-gray-700 text-gray-500 hover:text-gray-300" : "hover:bg-gray-100 text-gray-400 hover:text-gray-700"}`} title="Options"><GripVertical size={14} /></button>
      </div>
      {showGripMenu && (
        <div className={`absolute left-0 top-0 rounded-xl shadow-xl border py-1.5 z-40 min-w-[180px] ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-100"}`} onMouseDown={e => e.stopPropagation()}>
          <button onClick={() => { onMoveUp(); setShowGripMenu(false) }} className={`w-full px-3 py-2 text-sm text-left ${isDark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-50 text-gray-700"}`}>↑ Move up</button>
          <button onClick={() => { onMoveDown(); setShowGripMenu(false) }} className={`w-full px-3 py-2 text-sm text-left ${isDark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-50 text-gray-700"}`}>↓ Move down</button>
          <div className={`h-px my-1 ${isDark ? "bg-gray-700" : "bg-gray-100"}`} />
          <button onClick={() => { setShowGripMenu(false); setShowStylePanel(true) }} className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${isDark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-50 text-gray-700"}`}><Palette size={13} /> Style block</button>
          <button onClick={() => { onDuplicate(); setShowGripMenu(false) }} className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${isDark ? "hover:bg-gray-700 text-gray-300" : "hover:bg-gray-50 text-gray-700"}`}><Copy size={13} /> Duplicate</button>
          <div className={`h-px my-1 ${isDark ? "bg-gray-700" : "bg-gray-100"}`} />
          <button onClick={() => { onDelete(); setShowGripMenu(false) }} className="w-full px-3 py-2 text-sm text-left flex items-center gap-2 text-red-500 hover:bg-red-50"><Trash2 size={13} /> Delete block</button>
        </div>
      )}
      {showStylePanel && (
        <div className="absolute left-2 top-0 z-40" onMouseDown={e => e.stopPropagation()}>
          <StylePanel block={block} onChange={u => onChange(updateMetaSafe(block, u))} isDark={isDark} />
        </div>
      )}
      <div className="w-full px-3 py-1">{renderContent()}</div>
    </div>
  )
}

// ─── Pages Sidebar ────────────────────────────────────────────────────────────

interface PagesSidebarProps { pages: PageData[]; activePageId: string; onSelectPage: (id: string) => void; onCreatePage: () => void; onDeletePage: (id: string) => void; onRenamePage: (id: string, name: string) => void; isDark: boolean }

const PagesSidebar: React.FC<PagesSidebarProps> = ({ pages, activePageId, onSelectPage, onCreatePage, onDeletePage, onRenamePage, isDark }) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const startRename = (page: PageData) => { setEditingId(page.id); setEditingName(page.title); setTimeout(() => inputRef.current?.focus(), 50) }
  const commitRename = () => { if (editingId && editingName.trim()) onRenamePage(editingId, editingName.trim()); setEditingId(null) }
  return (
    <div className={`flex flex-col w-52 flex-shrink-0 border-r h-full ${isDark ? "bg-gray-900/80 border-gray-800" : "bg-gray-50/80 border-gray-100"}`}>
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? "border-gray-800" : "border-gray-100"}`}>
        <div className="flex items-center gap-2">
          <Layers size={13} className={isDark ? "text-indigo-400" : "text-indigo-500"} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-gray-500" : "text-gray-400"}`}>Pages</span>
        </div>
        <button onClick={onCreatePage} title="New page" className={`p-1 rounded-md transition-colors ${isDark ? "hover:bg-indigo-900/40 text-indigo-400" : "hover:bg-indigo-100 text-indigo-500"}`}><Plus size={14} /></button>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {pages.map((page, idx) => (
          <div key={page.id} className={`group/page relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all ${activePageId === page.id ? isDark ? "bg-indigo-900/40 text-indigo-300" : "bg-indigo-50 text-indigo-700" : isDark ? "hover:bg-gray-800 text-gray-400 hover:text-gray-200" : "hover:bg-white text-gray-500 hover:text-gray-800 hover:shadow-sm"}`} onClick={() => onSelectPage(page.id)}>
            {activePageId === page.id && <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full ${isDark ? "bg-indigo-400" : "bg-indigo-500"}`} />}
            <FileText size={12} className={`flex-shrink-0 ${activePageId === page.id ? isDark ? "text-indigo-400" : "text-indigo-500" : ""}`} />
            {editingId === page.id ? (
              <input ref={inputRef} value={editingName} onChange={e => setEditingName(e.target.value)} onBlur={commitRename} onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingId(null) }} onClick={e => e.stopPropagation()} className={`flex-1 text-xs bg-transparent outline-none border-none min-w-0 ${isDark ? "text-gray-200" : "text-gray-800"}`} />
            ) : (
              <span className="flex-1 text-xs font-medium truncate">{page.title || "Untitled"}</span>
            )}
            <span className={`flex-shrink-0 text-[9px] px-1 py-0.5 rounded-full font-mono ${isDark ? "bg-gray-800 text-gray-600" : "bg-gray-100 text-gray-400"}`}>{idx + 1}</span>
            <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/page:opacity-100 transition-opacity ${isDark ? "bg-gray-900" : "bg-white"} rounded-md shadow-sm`}>
              <button onClick={e => { e.stopPropagation(); startRename(page) }} className={`p-1 rounded-md ${isDark ? "hover:bg-gray-700 text-gray-500" : "hover:bg-gray-100 text-gray-400"}`} title="Rename"><PenLine size={10} /></button>
              {pages.length > 1 && <button onClick={e => { e.stopPropagation(); onDeletePage(page.id) }} className="p-1 rounded-md text-red-400 hover:bg-red-50" title="Delete"><Trash2 size={10} /></button>}
            </div>
          </div>
        ))}
      </div>
      <div className={`px-3 py-3 border-t ${isDark ? "border-gray-800" : "border-gray-100"}`}>
        <button onClick={onCreatePage} className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed text-xs font-medium transition-all ${isDark ? "border-gray-700 text-gray-600 hover:border-indigo-700 hover:text-indigo-400" : "border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500"}`}>
          <Plus size={12} />New Page
        </button>
      </div>
    </div>
  )
}

// ─── Preview Renderer ─────────────────────────────────────────────────────────
// Dedicated component so preview is clean and complete

const PreviewRenderer: React.FC<{
  blocks: PageBlock[]
  pages: PageData[]
  activePageId: string
  isDark: boolean
  onNavigate: (pageId: string) => void
  onUpdateBlock: (index: number, b: PageBlock) => void
}> = ({ blocks, pages, activePageId, isDark, onNavigate, onUpdateBlock }) => {
  return (
    <>
      {blocks.map((block, i) => {
        if (
          !block.content &&
          !["divider", "table", "image", "video", "page_link", "container", "button", "progress", "card_columns"].includes(block.type)
        ) return null

        const s = buildInlineStyle(block.metadata)

        switch (block.type) {
          case "heading1": return <h1 key={i} className="text-3xl font-bold tracking-tight mt-6 mb-3" style={s} dangerouslySetInnerHTML={{ __html: block.content }} />
          case "heading2": return <h2 key={i} className="text-2xl font-semibold mt-5 mb-2" style={s} dangerouslySetInnerHTML={{ __html: block.content }} />
          case "heading3": return <h3 key={i} className="text-xl font-medium mt-4 mb-2" style={s} dangerouslySetInnerHTML={{ __html: block.content }} />
          case "text": return <p key={i} className="text-base leading-relaxed mb-3" style={s} dangerouslySetInnerHTML={{ __html: block.content }} />
          case "bulleted_list": return <ul key={i} className="list-disc pl-6 mb-2" style={s}><li dangerouslySetInnerHTML={{ __html: block.content }} /></ul>
          case "numbered_list": return <ol key={i} className="list-decimal pl-6 mb-2" style={s}><li dangerouslySetInnerHTML={{ __html: block.content }} /></ol>
          case "todo": return (
            <div key={i} className="flex items-start gap-3 my-1.5" style={s}>
              <input type="checkbox" checked={block.metadata?.checked} readOnly className="mt-1 w-4 h-4" />
              <span className={block.metadata?.checked ? "line-through opacity-50" : ""} dangerouslySetInnerHTML={{ __html: block.content }} />
            </div>
          )
          case "quote": return (
            <blockquote key={i} className="border-l-4 pl-5 py-2 my-4 italic" style={{ borderColor: "#6366f1", background: isDark ? "#1e1b4b22" : "#f5f3ff", borderRadius: "0 8px 8px 0", ...s }} dangerouslySetInnerHTML={{ __html: block.content }} />
          )
          case "code": return (
            <pre key={i} className="rounded-xl p-4 overflow-x-auto my-4 text-sm" style={{ background: "#0f172a", color: "#86efac" }}>
              <code>{block.content}</code>
            </pre>
          )
          case "snippet": {
            const sLines = (block.content || "").split("\n")
            const sLang = block.metadata?.snippetLanguage ?? "code"
            const sTitle = block.metadata?.snippetTitle
            const LCOLOR: Record<string, string> = { html: "#e34c26", css: "#264de4", javascript: "#f7df1e", typescript: "#3178c6", python: "#3776ab", java: "#ed8b00", sql: "#f29111", bash: "#4eaa25", json: "#292929", other: "#888" }
            const lc = LCOLOR[sLang] ?? "#888"
            return (
              <div key={i} className="my-4 rounded-xl overflow-hidden border" style={{ borderColor: isDark ? "#334155" : "#e2e8f0" }}>
                {sTitle && (
                  <div className="px-4 py-2 text-sm font-bold" style={{ background: isDark ? "#1e293b" : "#f1f5f9", color: isDark ? "#f1f5f9" : "#0f172a", borderBottom: `1px solid ${isDark ? "#334155" : "#e2e8f0"}` }}>
                    {sTitle}
                    <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${lc}18`, color: lc }}>{sLang.toUpperCase()}</span>
                  </div>
                )}
                <div style={{ background: "#1e1e1e", overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "Fira Code,monospace", fontSize: "13px", lineHeight: "1.75" }}>
                    <tbody>
                      {sLines.map((line, li) => (
                        <tr key={li}>
                          <td style={{ color: "#555", textAlign: "right", padding: "2px 16px 2px 12px", borderRight: "1px solid #333", userSelect: "none", minWidth: "44px", whiteSpace: "nowrap" }}>{li + 1}</td>
                          <td style={{ padding: "2px 16px", color: "#d4d4d4", whiteSpace: "pre" }}>{line || "\u00a0"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between px-4 py-1.5" style={{ background: isDark ? "#0f172a" : "#f8fafc", borderTop: "1px solid #333" }}>
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: lc }}>{sLang}</span>
                  <span className="text-[10px]" style={{ color: "#555" }}>{sLines.length} line{sLines.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
            )
          }
          case "divider": return <hr key={i} className="my-6" style={{ borderColor: block.metadata?.borderColor || (isDark ? "#374151" : "#e5e7eb"), borderTopWidth: "1.5px" }} />
          case "image": return (
            <figure key={i} className="my-4">
              <img src={block.content} alt={block.metadata?.caption} style={{ maxWidth: "100%", borderRadius: s.borderRadius || "8px", boxShadow: s.boxShadow as string, opacity: s.opacity as number }} />
              {block.metadata?.caption && <figcaption className="text-sm text-center mt-2" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>{block.metadata.caption}</figcaption>}
            </figure>
          )
          case "video": return (
            <div key={i} className="aspect-video my-4 rounded-xl overflow-hidden">
              <iframe src={block.content} className="w-full h-full border-0" allowFullScreen />
            </div>
          )
          case "page_link": return (
            <div key={i} className="my-2">
              <PageLinkBlock block={block} onChange={u => onUpdateBlock(i, u)} allPages={pages} currentPageId={activePageId} onNavigate={onNavigate} isDark={isDark} isPreview={true} />
            </div>
          )
          case "container": return (
            <div key={i} className="my-4">
              <ContainerBlock block={block} onChange={u => onUpdateBlock(i, u)} isDark={isDark} />
            </div>
          )
          case "table": return (
            <table key={i} className="w-full border-collapse my-4">
              <tbody>
                {(block.metadata?.data || []).map((row, ri) => (
                  <tr key={ri} style={{ backgroundColor: ri === 0 ? (isDark ? "#1f2937" : "#f9fafb") : undefined }}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ border: `1px solid ${block.metadata?.borderColor || (isDark ? "#374151" : "#e5e7eb")}`, padding: "8px 12px", fontWeight: ri === 0 ? "600" : undefined }}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
          case "callout": return (
            <div key={i} className="flex gap-3 p-4 rounded-xl my-3" style={{ backgroundColor: s.backgroundColor || (isDark ? "#1e293b" : "#FFF7ED"), border: `1px solid ${s.borderColor || (isDark ? "#334155" : "#FED7AA")}`, borderRadius: "12px" }}>
              <span className="text-xl flex-shrink-0">{block.metadata?.url || "💡"}</span>
              <div dangerouslySetInnerHTML={{ __html: block.content }} />
            </div>
          )

          // ── NEW: Button preview ──────────────────────────────────────────────
          case "button": {
            const btnUrl = block.metadata?.url
            const btnBg = block.metadata?.backgroundColor || "#4f46e5"
            const btnClr = block.metadata?.textColor || "#ffffff"
            const btnR = block.metadata?.borderRadius || "8px"
            const btnAlign = (block.metadata?.align || "left") as React.CSSProperties["textAlign"]
            return (
              <div key={i} style={{ textAlign: btnAlign, margin: "12px 0" }}>
                {btnUrl ? (
                  <a
                    href={btnUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold no-underline"
                    style={{ background: btnBg, color: btnClr, borderRadius: btnR }}
                  >
                    {block.content || "Click Here"}
                  </a>
                ) : (
                  <button
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold border-0 cursor-pointer"
                    style={{ background: btnBg, color: btnClr, borderRadius: btnR }}
                  >
                    {block.content || "Click Here"}
                  </button>
                )}
              </div>
            )
          }

          // ── NEW: Progress preview ────────────────────────────────────────────
          case "progress": {
            const pVal = Math.round((block.metadata?.opacity ?? 0.7) * 100)
            const pColor = block.metadata?.backgroundColor || "#4ade80"
            const pTrack = block.metadata?.borderColor || (isDark ? "#374151" : "#e5e7eb")
            return (
              <div key={i} className="my-4">
                {block.content && (
                  <div className="text-xs font-semibold mb-1.5" style={{ color: isDark ? "#d1d5db" : "#374151" }}>
                    {block.content}
                  </div>
                )}
                <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: pTrack }}>
                  <div className="h-full rounded-full" style={{ width: `${pVal}%`, background: pColor }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px]" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>0%</span>
                  <span className="text-[10px] font-bold" style={{ color: pColor }}>{pVal}%</span>
                  <span className="text-[10px]" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>100%</span>
                </div>
              </div>
            )
          }

          // ── NEW: Card Columns preview ────────────────────────────────────────
          case "card_columns": {
            const cc = parseCardData(block.content)
            const renderCard = (side: "left" | "right") => {
              const card = cc[side]
              const bg = side === "left"
                ? (isDark ? "#1a2e25" : "#f0fdf4")
                : (isDark ? "#1e1b3a" : "#f5f3ff")
              return (
                <div key={side} className="flex-1 flex flex-col items-center text-center gap-3 p-6 rounded-2xl" style={{ background: bg }}>
                  <div className="font-bold text-base" style={{ color: isDark ? "#f9fafb" : "#111827" }}>{card.title}</div>
                  <div className="text-sm leading-relaxed" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>{card.desc}</div>
                  {card.btnUrl ? (
                    <a
                      href={card.btnUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-white text-sm font-bold no-underline"
                      style={{ background: card.btnColor }}
                    >
                      {side === "right" && <span>✦</span>}
                      {card.btnLabel}
                    </a>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-white text-sm font-bold cursor-default"
                      style={{ background: card.btnColor }}
                    >
                      {side === "right" && <span>✦</span>}
                      {card.btnLabel}
                    </span>
                  )}
                </div>
              )
            }
            return (
              <div key={i} className="flex items-stretch gap-0 relative my-4">
                {renderCard("left")}
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-lg"
                  style={{ background: isDark ? "#374151" : "#ffffff", color: isDark ? "#d1d5db" : "#6b7280", border: `1.5px solid ${isDark ? "#4b5563" : "#e5e7eb"}` }}
                >
                  OR
                </div>
                {renderCard("right")}
              </div>
            )
          }

          default: return <p key={i} style={s} dangerouslySetInnerHTML={{ __html: block.content }} />
        }
      })}
    </>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const PageCreationModal: React.FC<PageCreationModalProps> = ({
  onBack, onConfirm, initialBlocks = [], initialTitle = "Untitled", hierarchyInfo, isEditing = false, pathCrumbs,
}) => {
  const firstId = generateId()
  const draftKey = hierarchyInfo?.topicId || hierarchyInfo?.moduleId || hierarchyInfo?.courseId || "draft"

  const {
    current: pages,
    push: pushPages,
    undo: undoPages,
    redo: redoPages,
    canUndo,
    canRedo,
  } = useUndoRedo<PageData[]>([{
    id: firstId,
    title: initialTitle,
    blocks: initialBlocks.length ? initialBlocks : [{ type: "text", content: "", _uid: generateUid() }]
  }])

  const setPages = useCallback(
    (updater: PageData[] | ((prev: PageData[]) => PageData[])) => {
      const next = typeof updater === "function" ? updater(pages) : updater
      pushPages(next)
    },
    [pages, pushPages]
  )

  const [activePageId, setActivePageId] = useState<string>(firstId)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isPreview, setIsPreview] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const [inlineMenu, setInlineMenu] = useState<InlineMenuState | null>(null)
  const [autoFocusIndex, setAutoFocusIndex] = useState<number | null>(null)

  const { status: saveStatus, clearDraft } = useAutoSave(pages, draftKey, 3500)

  const activePage = pages.find(p => p.id === activePageId) || pages[0]
  const blocks = activePage.blocks
  const title = activePage.title

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && e.key === "z") { e.preventDefault(); undoPages() }
      if (mod && (e.key === "y" || (e.shiftKey && e.key === "z"))) { e.preventDefault(); redoPages() }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [undoPages, redoPages])

  useEffect(() => {
    const text = blocks.map(b => b.content.replace(/<[^>]*>/g, "")).join(" ")
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length)
  }, [blocks])

  const setTitle = useCallback((newTitle: string) => {
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, title: newTitle } : p))
  }, [activePageId, setPages])

  const setBlocks = useCallback((updater: PageBlock[] | ((prev: PageBlock[]) => PageBlock[])) => {
    setPages(prev => prev.map(p => {
      if (p.id !== activePageId) return p
      const newBlocks = typeof updater === "function" ? updater(p.blocks) : updater
      return { ...p, blocks: newBlocks }
    }))
  }, [activePageId, setPages])

  const createPage = useCallback(() => {
    const newPage: PageData = { id: generateId(), title: `Page ${pages.length + 1}`, blocks: [{ type: "text", content: "", _uid: generateUid() }] }
    setPages(prev => [...prev, newPage]); setActivePageId(newPage.id); setSelectedIndex(-1)
  }, [pages.length, setPages])

  const deletePage = useCallback((id: string) => {
    setPages(prev => {
      if (prev.length <= 1) return prev
      const remaining = prev.filter(p => p.id !== id)
      if (activePageId === id) setActivePageId(remaining[0].id)
      return remaining
    })
  }, [activePageId, setPages])

  const renamePage = useCallback((id: string, name: string) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, title: name } : p))
  }, [setPages])

  const navigateToPage = useCallback((pageId: string) => {
    setActivePageId(pageId); setIsPreview(false)
  }, [])

  const addBlock = useCallback((type: BlockType, afterIndex?: number) => {
    const newBlock: PageBlock = {
      _uid: generateUid(),
      type, content: "",
      metadata:
        type === "todo" ? { checked: false }
          : type === "table" ? { data: [["Header 1", "Header 2"], ["", ""]] }
            : type === "callout" ? { backgroundColor: isDark ? "#1e293b" : "#FFF7ED", url: "💡" }
              : type === "container" ? { columns: 2, gap: "16px", backgroundColor: isDark ? "#1e293b" : "#f9fafb", padding: "16px", borderRadius: "8px", minHeight: "80px" }
                : type === "video" ? { controls: true }
                  : type === "snippet" ? { snippetTitle: "", snippetLanguage: "html" }
                    : type === "button" ? { backgroundColor: "#4f46e5", textColor: "#ffffff", borderRadius: "8px", align: "left" }
                      : type === "progress" ? { opacity: 0.7, backgroundColor: "#4ade80", borderColor: isDark ? "#374151" : "#e5e7eb" }
                        : type === "card_columns" ? undefined
                          : type === "code_playground" ? {
                            playgroundHtml: "",
                            playgroundCss: "",
                            playgroundJs: "",
                            playgroundLayout: "horizontal" as const,
                            playgroundActiveTab: "html" as const,
                            playgroundPrimaryTab: "auto" as const,
                            snippetTitle: "",
                          }
                            : undefined
    }
    // Set default content for card_columns
    if (type === "card_columns") {
      newBlock.content = JSON.stringify(defaultCardData)
    }
    setBlocks(prev => { const at = afterIndex !== undefined ? afterIndex + 1 : prev.length; return [...prev.slice(0, at), newBlock, ...prev.slice(at)] })
    const at = afterIndex !== undefined ? afterIndex + 1 : blocks.length
    setSelectedIndex(at); setAutoFocusIndex(at); setTimeout(() => setAutoFocusIndex(null), 100)
  }, [isDark, blocks.length, setBlocks])

  const updateBlock = useCallback((index: number, updated: PageBlock) => {
    setBlocks(prev => prev.map((b, i) => i === index ? updated : b))
  }, [setBlocks])

  const deleteBlock = useCallback((index: number) => {
    setBlocks(prev => {
      if (prev.length === 1) return [{ type: "text", content: "", _uid: generateUid() }]
      return prev.filter((_, i) => i !== index)
    })
    setSelectedIndex(prev => prev > index ? prev - 1 : prev === index ? index - 1 : prev)
  }, [setBlocks])

  const duplicateBlock = useCallback((index: number) => {
    setBlocks(prev => {
      const b = prev[index]; if (!b) return prev
      const clone: PageBlock = {
        ...b,
        _uid: generateUid(),
        metadata: b.metadata ? JSON.parse(JSON.stringify(b.metadata)) : undefined,
      }
      return [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)]
    })
  }, [setBlocks])

  const moveBlock = useCallback((index: number, dir: "up" | "down") => {
    setBlocks(prev => {
      if (dir === "up" && index === 0) return prev
      if (dir === "down" && index === prev.length - 1) return prev
      const arr = [...prev]; const swap = dir === "up" ? index - 1 : index + 1
        ;[arr[index], arr[swap]] = [arr[swap], arr[index]]
      setSelectedIndex(swap); return arr
    })
  }, [setBlocks])

  const handleSlash = useCallback((rect: DOMRect, blockIndex: number) => {
    setInlineMenu({ blockIndex, mode: "convert", anchorRect: rect })
  }, [])

  const handlePlusClick = useCallback((rect: DOMRect, blockIndex: number) => {
    setInlineMenu({ blockIndex, mode: "add", anchorRect: rect })
  }, [])

  const handleMenuSelect = useCallback((type: BlockType) => {
    if (!inlineMenu) return
    if (inlineMenu.mode === "add") { addBlock(type, inlineMenu.blockIndex) }
    else {
      const b = blocks[inlineMenu.blockIndex]
      const newMeta =
        type === "todo" ? { checked: false }
          : type === "table" ? { data: [["Header 1", "Header 2"], ["", ""]] }
            : type === "callout" ? { backgroundColor: isDark ? "#1e293b" : "#FFF7ED", url: "💡" }
              : type === "container" ? { columns: 2, gap: "16px", backgroundColor: isDark ? "#1e293b" : "#f9fafb", padding: "16px", borderRadius: "8px", minHeight: "80px" }
                : type === "button" ? { backgroundColor: "#4f46e5", textColor: "#ffffff", borderRadius: "8px", align: "left" }
                  : type === "progress" ? { opacity: 0.7, backgroundColor: "#4ade80", borderColor: isDark ? "#374151" : "#e5e7eb" }
                    : b.metadata
      const newContent = type === "card_columns" ? JSON.stringify(defaultCardData)
        : b.content.replace(/\/$/, "").replace(/&#x2F;/g, "").replace(/\//g, "")
      updateBlock(inlineMenu.blockIndex, { ...b, type, content: newContent, metadata: newMeta })
    }
    setInlineMenu(null)
  }, [inlineMenu, blocks, isDark, addBlock, updateBlock])

  // Find handleConfirm and change to:
  // 3. Fix handleConfirm — replace the existing condition
  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const pageItems: PagePayloadItem[] = pages.map(page => {
        const nonEmpty = page.blocks.filter(b =>
          b.content.trim() ||
          ["divider", "table", "image", "video", "page_link", "container",
            "snippet", "button", "progress", "card_columns"].includes(b.type)
        );
        const submitBlocks = nonEmpty.length ? nonEmpty : page.blocks;
        return {
          id: page.id,
          name: page.title,
          html: serializeBlocksToHTML(page.title, submitBlocks),
          blocks: submitBlocks,
        };
      });

      const combinedHtml = serializeCombinedHTML(pages);
      const payload: PagesPayload = { pages: pageItems, combinedHtml, hierarchyInfo };

      // ── FIXED: use isEditing prop, not initialBlocks.length ──────────────────
      if (isEditing) {
        clearDraft();
        onConfirm(payload);
        return;
      }

      // Create flow (new page only)
      const entityId =
        hierarchyInfo?.subTopicId ||
        hierarchyInfo?.topicId ||
        hierarchyInfo?.subModuleId ||
        hierarchyInfo?.moduleId ||
        hierarchyInfo?.courseId;

      if (!entityId) throw new Error("No entity ID found in hierarchy info");

      const response = await entityApi.createPage(
        hierarchyInfo?.nodeType as "module" | "submodule" | "topic" | "subtopic",
        entityId,
        payload
      );
      clearDraft();
      // `entityApi.createPage` already unwraps `axiosResponse.data`, so the
      // backend body is in `response` itself. Some backends nest it again
      // under `.data` — spread both (outer last wins) so the new page id
      // surfaces in `onConfirm` regardless of shape.
      const respAny = response as any;
      onConfirm({
        ...payload,
        ...(respAny || {}),
        ...((respAny && respAny.data) || {}),
      } as PagesPayload);
    } catch (error) {
      console.error("Failed to create/update pages:", error);
      alert(error instanceof Error ? error.message : "Failed to save pages");
    } finally {
      setIsSubmitting(false);
    }
  };
  const modalSize = isFullScreen ? "w-screen h-screen m-0 rounded-none" : "w-full h-full m-3 rounded-2xl"

  const SaveStatusBadge = () => {
    if (saveStatus === "idle") return null
    return (
      <div className={`flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-lg transition-all ${saveStatus === "saving" ? isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-400"
        : saveStatus === "saved" ? isDark ? "bg-green-900/30 text-green-400" : "bg-green-50 text-green-600"
          : "bg-red-50 text-red-500"
        }`}>
        {saveStatus === "saving" && <Loader2 size={9} className="animate-spin" />}
        {saveStatus === "saved" && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
        {saveStatus === "error" && <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />}
        {saveStatus === "saving" ? "Saving draft…" : saveStatus === "saved" ? "Draft saved" : "Save error"}
      </div>
    )
  }

  return (
    <div className={`fixed inset-0 z-[70] flex ${isDark ? "dark" : ""}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onBack} />
      <div className={`relative flex flex-col ${modalSize} overflow-hidden shadow-2xl border border-white/10`} style={{ background: isDark ? "#0f1117" : "#ffffff" }} onClick={e => e.stopPropagation()}>

     {/* ── Top Bar ── */}
<div className={`flex-shrink-0 flex items-center justify-between px-5 py-3 border-b ${isDark ? "border-gray-800 bg-gray-900/60" : "border-gray-100 bg-white/80"} backdrop-blur-sm`}>
  <div className="flex items-center gap-1.5 flex-wrap">
    <button onClick={() => setIsFullScreen(v => !v)} className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>{isFullScreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>

    <div className={`w-px h-5 ${isDark ? "bg-gray-700" : "bg-gray-200"} mx-0.5`} />
    <button onClick={undoPages} disabled={!canUndo} title="Undo (Ctrl+Z)" className={`p-2 rounded-lg transition-colors disabled:opacity-25 ${isDark ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}><Undo2 size={16} /></button>
    <button onClick={redoPages} disabled={!canRedo} title="Redo (Ctrl+Y)" className={`p-2 rounded-lg transition-colors disabled:opacity-25 ${isDark ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}><Redo2 size={16} /></button>

    <div className={`w-px h-5 ${isDark ? "bg-gray-700" : "bg-gray-200"} mx-0.5`} />

    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${isDark ? "bg-gray-800" : "bg-gray-50"}`}>
      <FileText size={14} className={isDark ? "text-gray-500" : "text-gray-400"} />
      <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={`text-sm font-semibold bg-transparent border-none outline-none w-52 ${isDark ? "text-gray-100 placeholder-gray-600" : "text-gray-900 placeholder-gray-400"}`} placeholder="Untitled page…" />
    </div>

    {pages.length > 1 && (
      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${isDark ? "bg-indigo-900/40 text-indigo-300" : "bg-indigo-50 text-indigo-600"}`}>
        <Layers size={11} />{pages.length} pages
      </div>
    )}

    {hierarchyInfo && (
      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs ${isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-500"}`}>
        <span className="truncate max-w-[260px]">
          {[hierarchyInfo.courseName, hierarchyInfo.moduleName, hierarchyInfo.topicName].filter(Boolean).join(" › ")}
          {hierarchyInfo.tabType && <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${isDark ? "bg-indigo-900 text-indigo-300" : "bg-indigo-100 text-indigo-600"}`}>{hierarchyInfo.tabType}</span>}
        </span>
      </div>
    )}

    <SaveStatusBadge />
  </div>

  <div className="flex items-center gap-1.5">
    <button onClick={() => setIsDark(v => !v)} className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>{isDark ? <Sun size={17} /> : <Moon size={17} />}</button>
    <button onClick={() => setIsPreview(v => !v)} className={`p-2 rounded-lg transition-colors ${isPreview ? "bg-indigo-100 text-indigo-600" : isDark ? "hover:bg-gray-800 text-gray-400" : "hover:bg-gray-100 text-gray-500"}`}>{isPreview ? <Edit3 size={17} /> : <Eye size={17} />}</button>
    <button onClick={handleConfirm} disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-100 disabled:opacity-50 disabled:hover:scale-100">
      {isSubmitting
        ? <><Loader2 size={15} className="animate-spin" />Saving…</>
        : <><Save size={15} />{initialBlocks?.length > 0
          ? "Update Page"
          : pages.length > 1 ? `Create ${pages.length} Pages` : "Create Page"
        }</>
      }            </button>
    <button onClick={onBack} className={`p-2 rounded-lg transition-colors bg-red-500 hover:bg-red-600 text-white`}><X size={17} /></button>
  </div>
</div>

        {/* ── Plain location breadcrumb (display-only) ───────────────────
           Course > Module > … > Group > Folder > Subfolder. Tells the user
           where this page will be saved before they hit Create. */}
        {pathCrumbs && pathCrumbs.length > 0 && (
          <PlainBreadcrumb crumbs={pathCrumbs} prefix="Saving to:" />
        )}

        {/* ── Body: Sidebar + Editor ── */}
        <div className="flex flex-1 overflow-hidden">
          <PagesSidebar
            pages={pages} activePageId={activePageId}
            onSelectPage={id => { setActivePageId(id); setSelectedIndex(-1) }}
            onCreatePage={createPage} onDeletePage={deletePage} onRenamePage={renamePage}
            isDark={isDark}
          />

          {/* ── Editor Canvas ── */}
          <div className={`flex-1 overflow-y-auto ${isDark ? "bg-gray-900" : "bg-white"}`}>
            {!isPreview ? (
              // ── EDIT MODE ────────────────────────────────────────────────────
              <div className={`w-full min-h-full max-w-3xl ${isFullScreen ? "px-20 py-16" : "px-16 py-12"}`}>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className={`w-full text-4xl font-bold bg-transparent border-none outline-none mb-8 tracking-tight ${isDark ? "text-gray-100 placeholder-gray-700" : "text-gray-900 placeholder-gray-300"}`}
                  placeholder="Untitled"
                />
                <div className="w-full space-y-0.5 pl-14">
                  {blocks.map((block, index) => (
                    <BlockComponent
                      key={`${activePageId}-${block._uid ?? index}`}
                      block={block} index={index}
                      onChange={u => updateBlock(index, u)}
                      onDelete={() => deleteBlock(index)}
                      onDuplicate={() => duplicateBlock(index)}
                      onMoveUp={() => moveBlock(index, "up")}
                      onMoveDown={() => moveBlock(index, "down")}
                      onAddBelow={type => addBlock(type, index)}
                      onSlash={handleSlash}
                      isSelected={selectedIndex === index}
                      onSelect={() => setSelectedIndex(index)}
                      isDark={isDark}
                      autoFocus={autoFocusIndex === index}
                      onOpenMenu={rect => handlePlusClick(rect, index)}
                      allPages={pages}
                      currentPageId={activePageId}
                      onNavigateToPage={navigateToPage}
                      isPreview={false}
                    />
                  ))}
                  <div className="pt-3">
                    <button
                      onClick={e => { const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setInlineMenu({ blockIndex: blocks.length - 1, mode: "add", anchorRect: rect }) }}
                      className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border-2 border-dashed text-sm transition-all ${isDark ? "border-gray-800 text-gray-700 hover:border-indigo-700 hover:text-indigo-400" : "border-gray-100 text-gray-300 hover:border-indigo-200 hover:text-indigo-400"}`}
                    >
                      <Plus size={15} /><span>Click to add a block — or hover and click <kbd className={`text-xs px-1.5 py-0.5 rounded mx-1 ${isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-500"}`}>+</kbd></span>
                      <span className="ml-auto flex items-center gap-1"><kbd className={`text-xs px-1.5 py-0.5 rounded ${isDark ? "bg-gray-800 text-gray-500" : "bg-gray-100 text-gray-400"}`}>/</kbd><span className={`text-xs ${isDark ? "text-gray-600" : "text-gray-400"}`}>for commands</span></span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // ── PREVIEW MODE — uses dedicated PreviewRenderer ────────────────
              <div className={`w-full min-h-full max-w-3xl ${isFullScreen ? "px-20 py-16" : "px-16 py-12"}`}>
                <h1 className={`text-4xl font-bold mb-8 tracking-tight ${isDark ? "text-gray-100" : "text-gray-900"}`}>{title}</h1>
                <div className={isDark ? "text-gray-200" : "text-gray-800"}>
                  <PreviewRenderer
                    blocks={blocks}
                    pages={pages}
                    activePageId={activePageId}
                    isDark={isDark}
                    onNavigate={navigateToPage}
                    onUpdateBlock={updateBlock}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Status Bar ── */}
        <div className={`flex-shrink-0 flex items-center justify-between px-5 py-1.5 border-t text-[11px] ${isDark ? "border-gray-800 bg-gray-900/60 text-gray-600" : "border-gray-100 bg-gray-50/80 text-gray-400"}`}>
          <div className="flex items-center gap-4">
            <span>{blocks.length} block{blocks.length !== 1 ? "s" : ""}</span>
            <span>{wordCount} word{wordCount !== 1 ? "s" : ""}</span>
            <span className={`flex items-center gap-1 ${isDark ? "text-indigo-500" : "text-indigo-400"}`}><Layers size={10} />Page {pages.findIndex(p => p.id === activePageId) + 1} of {pages.length}</span>
            {hierarchyInfo?.courseId && <span className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${isDark ? "bg-gray-800 text-gray-600" : "bg-gray-100 text-gray-400"}`}>ID: {hierarchyInfo.topicId || hierarchyInfo.moduleId || hierarchyInfo.courseId}</span>}
          </div>
          <div className="flex items-center gap-3">
            <span>{isPreview ? "👁 Preview" : "✏️ Editing"}</span>
            <span className="flex items-center gap-1">
              <kbd className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>Ctrl+Z</kbd>
              <span>undo</span>
            </span>
            <span><kbd className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>/</kbd> commands</span>
            <span><kbd className={`px-1.5 py-0.5 rounded text-[10px] ${isDark ? "bg-gray-800" : "bg-gray-200"}`}>↵</kbd> new block</span>
          </div>
        </div>
      </div>

      {inlineMenu && (
        <InlineBlockMenu state={inlineMenu} onSelect={handleMenuSelect} onClose={() => setInlineMenu(null)} isDark={isDark} />
      )}

      <style jsx global>{`
        [contenteditable]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
        .dark [contenteditable]:empty:before { color: #4b5563; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 999px; }
        .dark ::-webkit-scrollbar-thumb { background: #374151; }
      `}</style>
    </div>
  )
}

export default PageCreationModal