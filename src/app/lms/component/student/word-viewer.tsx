"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  X, Download, Maximize, Minimize, FileText,
  ChevronRight, ChevronLeft, Sparkles, MessageCircle,
  BookOpen, RefreshCw, ExternalLink, AlertCircle, Loader2,
  ZoomIn, ZoomOut,
} from "lucide-react"
import NotesPanel from "./notes-panel"
import SummaryChat from "./summary-chat"
import AIChat from "./ai-chat"

// ─── STYLES ───────────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(14px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)    scale(1);    }
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  .wv-resize-handle {
    width: 10px; flex-shrink: 0; cursor: col-resize;
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px; transition: background 0.15s;
    position: relative; z-index: 10;
  }
  .wv-resize-handle::after {
    content: ''; display: block; width: 2px; height: 48px;
    border-radius: 2px; background: rgba(0,0,0,0.1); transition: all 0.15s;
  }
  .wv-resize-handle:hover { background: rgba(124,58,237,0.06); }
  .wv-resize-handle:hover::after, .wv-resize-handle.dragging::after {
    width: 3px; height: 56px; background: #7C3AED;
    box-shadow: 0 0 8px rgba(124,58,237,0.35);
  }
  .wv-resize-handle-blue:hover { background: rgba(251,146,60,0.06); }
  .wv-resize-handle-blue::after { background: rgba(0,0,0,0.1); }
  .wv-resize-handle-blue:hover::after, .wv-resize-handle-blue.dragging::after {
    width: 3px; height: 56px; background: #FB923C;
    box-shadow: 0 0 8px rgba(251,146,60,0.35);
  }

  .wv-toolbar-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 11px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 600; transition: all 0.15s;
    background: white; color: #4B5563;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06);
    white-space: nowrap;
  }
  .wv-toolbar-btn:hover { background: #F9FAFB; box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.07); }
  .wv-toolbar-btn:active { transform: scale(0.97); }
  .wv-toolbar-btn.active-purple {
    background: linear-gradient(135deg,#7C3AED 0%,#6366F1 100%); color: white;
    box-shadow: 0 3px 10px rgba(124,58,237,0.4), 0 0 0 1px rgba(124,58,237,0.2);
  }
  .wv-toolbar-btn.active-blue {
    background: linear-gradient(135deg,#F97316 0%,#FB923C 100%); color: white;
    box-shadow: 0 3px 10px rgba(251,146,60,0.4), 0 0 0 1px rgba(251,146,60,0.2);
  }
  .wv-toolbar-btn.icon-only { padding: 6px 9px; }

  .wv-panel-card {
    display: flex; flex-direction: column; overflow: hidden;
    background: white; border-radius: 14px; min-width: 0;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05);
    animation: fadeIn 0.2s ease;
  }
  .wv-panel-header-purple {
    background: #ffffff; border-bottom: 1px solid rgba(0,0,0,0.08);
  }
  .wv-panel-header-blue {
    background: linear-gradient(135deg,#FFF7ED 0%,#FFEDD5 100%);
    border-bottom: 1px solid rgba(251,146,60,0.12);
  }
  .wv-panel-header-neutral {
    background: linear-gradient(135deg,#FAFBFC 0%,#F3F4F6 100%);
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.65} }

  .wv-page-input {
    width: 42px;
    text-align: center;
    border: 1.5px solid #E5E7EB;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 700;
    color: #111827;
    padding: 3px 5px;
    outline: none;
    transition: border-color 0.15s;
    background: white;
  }
  .wv-page-input:focus { border-color: #F97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12); }
`

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const buildViewerUrl = (url: string, engine: "ms" | "google") => {
  const encoded = encodeURIComponent(url)
  return engine === "ms"
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`
    : `https://docs.google.com/gview?url=${encoded}&embedded=true`
}

const safeDownloadName = (name: string) => name.replace(/\.ocx$/i, ".docx")

// ─── LAYOUT CONSTANTS ─────────────────────────────────────────────────────────
const DOC_MIN_FLEX = 35
const SIDE_MIN_FLEX = 18
const GAP = 10

// ─── PROPS ────────────────────────────────────────────────────────────────────
interface WordViewerProps {
  isOpen?: boolean
  fileUrl: string
  fileName: string
  fileId?: string
  entityType?: string
  entityId?: string
  aiChatEnabled?: boolean
  aiSummaryEnabled?: boolean
  notesEnabled?: boolean
  hierarchy?: string[]
  currentItemTitle?: string
  onClose: () => void
  onNotesClick?: () => void
  showNotesPanel?: boolean
  onNotesStateChange?: (isOpen: boolean) => void
  onBreadcrumbNavigate?: (crumb: string, index: number) => void
}

// ─── TOOLBAR BUTTON ───────────────────────────────────────────────────────────
function ToolbarBtn({
  children, onClick, active, activeClass = "active-purple",
  className = "", title, style,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  activeClass?: string
  className?: string
  title?: string
  style?: React.CSSProperties
}) {
  return (
    <button
      className={`wv-toolbar-btn${active ? " " + activeClass : ""}${className ? " " + className : ""}`}
      onClick={onClick}
      title={title}
      style={style}
    >
      {children}
    </button>
  )
}

// ─── PANEL HEADER ─────────────────────────────────────────────────────────────
function PanelHeader({
  children, bgClass, onClose,
}: {
  children: React.ReactNode
  bgClass: string
  onClose?: () => void
}) {
  return (
    <div
      className={`wv-panel-header ${bgClass}`}
      style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", flexShrink:0, borderRadius:"14px 14px 0 0" }}
    >
      {children}
      {onClose && (
        <button
          onClick={onClose}
          style={{ background:"none", border:"none", cursor:"pointer", color:"#9ca3af", display:"flex", padding:5, borderRadius:7, transition:"all 0.15s" }}
          onMouseEnter={e => { (e.currentTarget.style.background="#f3f4f6"); (e.currentTarget.style.color="#6b7280") }}
          onMouseLeave={e => { (e.currentTarget.style.background="none"); (e.currentTarget.style.color="#9ca3af") }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function WordViewer({
  fileUrl, fileName, onClose,
  aiChatEnabled = true, aiSummaryEnabled = true, notesEnabled = true,
  hierarchy = [], currentItemTitle = "",
  onNotesClick, showNotesPanel, onNotesStateChange,
  onBreadcrumbNavigate,
}: WordViewerProps) {

  // ── Image-pipeline state (Word → PDF → images via backend)
  const [pageImages, setPageImages] = useState<string[]>([])
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState("1")
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [pageScale, setPageScale] = useState(1)
  const imageCache = useRef<Record<string, string[]>>({})
  const useImageMode = pageImages.length > 0
  const totalPages = pageImages.length

  // ── Iframe fallback state
  const [engine, setEngine] = useState<"ms" | "google">("ms")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showNavConfirm, setShowNavConfirm] = useState(false)
  const [pendingNavCrumb, setPendingNavCrumb] = useState<{ crumb: string; index: number } | null>(null)

  // ── Panel state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiTab, setAiTab] = useState<"chat" | "summary">("chat")
  const [notesOpen, setNotesOpen] = useState(false)
  const [shouldLoadSavedNote, setShouldLoadSavedNote] = useState(false)

  // ── Flex values
  const [aiFlex, setAiFlex] = useState(30)
  const [notesFlex, setNotesFlex] = useState(30)

  // ── Drag state
  const draggingRef = useRef<"left" | "right" | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartFlexesRef = useRef<{ ai: number; notes: number }>({ ai: 30, notes: 30 })
  const [draggingHandle, setDraggingHandle] = useState<"left" | "right" | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const panelsRowRef = useRef<HTMLDivElement>(null)

  const downloadName = safeDownloadName(fileName)
  const showAIButton = aiChatEnabled || aiSummaryEnabled

  // ── Auto-convert Word → PDF → images on open
  useEffect(() => {
    if (!fileUrl) return
    if (imageCache.current[fileUrl]) {
      setPageImages(imageCache.current[fileUrl])
      return
    }

    let cancelled = false
    setConverting(true)
    setConvertError(null)

    ;(async () => {
      try {
        const res = await fetch('http://localhost:5533/api/ppt/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pptUrl: fileUrl }),
        })
        const data = await res.json()
        if (cancelled) return
        if (data.success && data.slideImages?.length > 0) {
          imageCache.current[fileUrl] = data.slideImages
          setPageImages(data.slideImages)
        } else {
          setConvertError(data.error || 'Conversion failed')
        }
      } catch (err: any) {
        if (!cancelled) setConvertError(err.message)
      } finally {
        if (!cancelled) setConverting(false)
      }
    })()

    return () => { cancelled = true }
  }, [fileUrl, retryCount])

  // ── Page navigation helpers
  const goToPage = useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(totalPages || 1, n))
    setCurrentPage(clamped)
    setPageInput(String(clamped))
    setImgLoaded(false)
    setImgError(false)
  }, [totalPages])

  useEffect(() => { setPageInput(String(currentPage)) }, [currentPage])

  // ── Preload adjacent page images
  useEffect(() => {
    if (!useImageMode) return
    const next = pageImages[currentPage]
    const prev = pageImages[currentPage - 2]
    if (next) { new window.Image().src = next }
    if (prev) { new window.Image().src = prev }
  }, [useImageMode, currentPage, pageImages])

  const commitPageInput = () => {
    const n = parseInt(pageInput, 10)
    if (!isNaN(n)) goToPage(n)
    else setPageInput(String(currentPage))
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.currentTarget.blur(); commitPageInput() }
    if (e.key === "Escape") { setPageInput(String(currentPage)); e.currentTarget.blur() }
  }

  // ── Reset on fileUrl change
  useEffect(() => {
    setLoading(true); setLoadError(false); setEngine("ms"); setIframeKey(k => k + 1)
    setPageImages([]); setCurrentPage(1); setPageInput("1"); setConvertError(null)
  }, [fileUrl])

  // ── Show notes panel from outside
  useEffect(() => { if (showNotesPanel) setNotesOpen(true) }, [showNotesPanel])

  // ── Notes event listener
  useEffect(() => {
    const handle = () => {
      setNotesOpen(true); setAiOpen(false)
      onNotesStateChange?.(true)
      const saved = localStorage.getItem("lastCreatedNote")
      if (saved) { setShouldLoadSavedNote(true); setTimeout(() => setShouldLoadSavedNote(false), 500) }
    }
    window.addEventListener("force-open-notes-in-viewer", handle)
    return () => window.removeEventListener("force-open-notes-in-viewer", handle)
  }, [onNotesStateChange])

  // ── Fullscreen events
  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", fn)
    return () => document.removeEventListener("fullscreenchange", fn)
  }, [])

  // ── Keyboard navigation (image mode only)
  useEffect(() => {
    if (!useImageMode) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "INPUT") return
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goToPage(currentPage + 1) }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); goToPage(currentPage - 1) }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [useImageMode, currentPage, goToPage])

  // ── Compute panel layout
  const computeLayout = useCallback(() => {
    const ai = aiOpen ? aiFlex : 0
    const notes = notesOpen ? notesFlex : 0
    const rawDoc = 100 - ai - notes
    const docFlex = Math.max(DOC_MIN_FLEX, rawDoc)
    if (rawDoc < DOC_MIN_FLEX && (ai > 0 || notes > 0)) {
      const available = 100 - DOC_MIN_FLEX
      const sideTotal = ai + notes
      const s = sideTotal > 0 ? available / sideTotal : 1
      return { docFlex, aiFlexActual: ai * s, notesFlexActual: notes * s }
    }
    return { docFlex, aiFlexActual: ai, notesFlexActual: notes }
  }, [aiOpen, aiFlex, notesOpen, notesFlex])

  // ── Resize drag
  const startDrag = useCallback((side: "left" | "right", e: React.MouseEvent) => {
    e.preventDefault()
    draggingRef.current = side
    dragStartXRef.current = e.clientX
    dragStartFlexesRef.current = { ai: aiFlex, notes: notesFlex }
    setDraggingHandle(side)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [aiFlex, notesFlex])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !panelsRowRef.current) return
      const totalW = panelsRowRef.current.offsetWidth
      const dx = e.clientX - dragStartXRef.current
      const { ai, notes } = dragStartFlexesRef.current
      const dFlex = (dx / totalW) * 100
      if (draggingRef.current === "left" && aiOpen) {
        const maxAi = 100 - (notesOpen ? Math.max(SIDE_MIN_FLEX, notes) : 0) - DOC_MIN_FLEX
        setAiFlex(Math.max(SIDE_MIN_FLEX, Math.min(maxAi, ai + dFlex)))
      }
      if (draggingRef.current === "right" && notesOpen) {
        const maxNotes = 100 - (aiOpen ? Math.max(SIDE_MIN_FLEX, ai) : 0) - DOC_MIN_FLEX
        setNotesFlex(Math.max(SIDE_MIN_FLEX, Math.min(maxNotes, notes - dFlex)))
      }
    }
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = null
      setDraggingHandle(null)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
  }, [aiOpen, notesOpen, aiFlex, notesFlex])

  // ── iframe callbacks
  const handleLoad = () => setLoading(false)
  const handleError = () => {
    if (engine === "ms") { setEngine("google"); setIframeKey(k => k + 1); setLoading(true); setLoadError(false) }
    else { setLoading(false); setLoadError(true) }
  }

  const handleReload = () => {
    setLoading(true); setLoadError(false); setEngine("ms"); setIframeKey(k => k + 1)
  }

  const handleDownload = () => {
    const a = document.createElement("a")
    a.href = fileUrl; a.download = downloadName; a.target = "_blank"
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const handleFullscreen = async () => {
    if (!containerRef.current) return
    try {
      if (!isFullscreen) await containerRef.current.requestFullscreen()
      else await document.exitFullscreen()
    } catch {}
  }

  const handleClose = () => {
    setAiOpen(false); setNotesOpen(false)
    onNotesStateChange?.(false); onClose()
  }

  const handleAIToggle = () => setAiOpen(prev => !prev)
  const handleAITabChange = (tab: "chat" | "summary") => { setAiTab(tab); setAiOpen(true) }
  const handleNotesToggle = () => {
    const next = !notesOpen
    setNotesOpen(next); onNotesClick?.(); onNotesStateChange?.(next)
  }

  const { docFlex, aiFlexActual, notesFlexActual } = computeLayout()
  const viewerUrl = buildViewerUrl(fileUrl, engine)

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div
        ref={containerRef}
        style={{
          position: "fixed", inset: 0,
          background: "#E2E5EA",
          display: "flex", flexDirection: "column",
          zIndex: isFullscreen ? 2000 : 1000,
          fontFamily: "'Poppins','Google Sans','Segoe UI',system-ui,sans-serif",
        }}
      >
        {/* ── TOP TOOLBAR ────────────────────────────────────────────────────── */}
        {!isFullscreen && (
          <div style={{ display:"flex", alignItems:"center", padding:"10px 12px 0 12px", gap:8, flexShrink:0 }}>

            {/* Breadcrumb */}
            <div style={{
              display:"flex", alignItems:"center", gap:4,
              flex:1, minWidth:0, overflow:"hidden",
            }}>
              <div style={{ width:22, height:22, borderRadius:6, background:"linear-gradient(135deg,#F97316,#FB923C)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <FileText size={11} style={{ color:"white" }} />
              </div>
              {hierarchy.length > 0 ? (
                <>
                  {hierarchy.map((crumb, idx) => (
                    <React.Fragment key={idx}>
                      <button
                        onClick={() => { setPendingNavCrumb({ crumb, index: idx }); setShowNavConfirm(true) }}
                        style={{ background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:500,color:"#4B5563",padding:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:120,flexShrink:1,transition:"color 0.15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color="#111827" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color="#4B5563" }}
                      >
                        {crumb}
                      </button>
                      {idx < hierarchy.length - 1 && (
                        <ChevronRight size={12} style={{ color:"#9ca3af", flexShrink:0 }} />
                      )}
                    </React.Fragment>
                  ))}
                  <ChevronRight size={12} style={{ color:"#9ca3af", flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:700, color:"#111827", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200, flexShrink:0 }}>
                    {fileName}
                  </span>
                </>
              ) : (
                <span style={{ fontSize:12, fontWeight:700, color:"#111827", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {fileName}
                </span>
              )}
            </div>

            {/* Right actions */}
            <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>

              {/* Engine badge + reload — only in iframe fallback mode */}
              {!useImageMode && !converting && (
                <>
                  <div style={{
                    padding:"5px 10px", borderRadius:8, background:"white", fontSize:11, fontWeight:600, color:"#6b7280",
                    boxShadow:"0 1px 2px rgba(0,0,0,0.06),0 0 0 1px rgba(0,0,0,0.06)", whiteSpace:"nowrap",
                  }}>
                    {engine === "ms" ? "Office Online" : "Google Docs"}
                  </div>
                  <ToolbarBtn onClick={handleReload} className="icon-only" title="Reload document">
                    <RefreshCw size={13} />
                  </ToolbarBtn>
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" title="Open in new tab" className="wv-toolbar-btn icon-only">
                    <ExternalLink size={13} />
                  </a>
                </>
              )}

              <div style={{ width:1, height:22, background:"rgba(0,0,0,0.1)" }} />

              {showAIButton && (
                <ToolbarBtn onClick={handleAIToggle} active={aiOpen} activeClass="active-purple">
                  <Sparkles size={12} /> AI Assistant
                </ToolbarBtn>
              )}

              {notesEnabled && (
                <ToolbarBtn onClick={handleNotesToggle} active={notesOpen} activeClass="active-blue">
                  <BookOpen size={12} /> Notes
                </ToolbarBtn>
              )}

              <div style={{ width:1, height:22, background:"rgba(0,0,0,0.1)" }} />

              {/* <ToolbarBtn onClick={handleDownload}>
                <Download size={12} /> Download
              </ToolbarBtn> */}

              <ToolbarBtn onClick={handleFullscreen} className="icon-only" title="Toggle fullscreen">
                <Maximize size={13} />
              </ToolbarBtn>
              <button
                onClick={handleClose}
                style={{ display:"flex",alignItems:"center",justifyContent:"center",width:32,height:32,borderRadius:9,border:"none",cursor:"pointer",background:"#FEF2F2",color:"#DC2626",flexShrink:0,transition:"all 0.15s" }}
                title="Close"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="#FEE2E2" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="#FEF2F2" }}
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ── THREE-PANEL ROW ────────────────────────────────────────────────── */}
        <div
          ref={panelsRowRef}
          style={{ flex:1, display:"flex", padding:GAP, gap:0, minHeight:0, overflow:"hidden", paddingTop:GAP }}
        >
          {/* ─── LEFT: AI Panel ─────────────────────────────────────────── */}
          {aiOpen && showAIButton && (
            <>
              <div className="wv-panel-card" style={{ flex: aiFlexActual, transition:"flex 0.05s" }}>
                <PanelHeader bgClass="wv-panel-header-purple" onClose={handleAIToggle}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:"linear-gradient(135deg,#7C3AED,#6366F1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 2px 8px rgba(124,58,237,0.28)" }}>
                        <Sparkles size={13} style={{ color:"white" }} />
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:"#111827" }}>AI Assistant</span>
                    </div>
                    {aiChatEnabled && aiSummaryEnabled && (
                      <div style={{ display:"flex", background:"#f3f4f6", borderRadius:20, padding:"2px", gap:0, marginLeft:4 }}>
                        <button
                          onClick={() => handleAITabChange("chat")}
                          style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, border:"none", cursor:"pointer", fontSize:11, fontWeight:600, transition:"all 0.15s", background:aiTab==="chat"?"white":"transparent", color:aiTab==="chat"?"#111827":"#6b7280", boxShadow:aiTab==="chat"?"0 1px 3px rgba(0,0,0,0.12)":"none" }}
                        >
                          <MessageCircle size={10} /> Chat
                        </button>
                        <button
                          onClick={() => handleAITabChange("summary")}
                          style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20, border:"none", cursor:"pointer", fontSize:11, fontWeight:600, transition:"all 0.15s", background:aiTab==="summary"?"white":"transparent", color:aiTab==="summary"?"#111827":"#6b7280", boxShadow:aiTab==="summary"?"0 1px 3px rgba(0,0,0,0.12)":"none" }}
                        >
                          <FileText size={10} /> Summary
                        </button>
                      </div>
                    )}
                    {aiChatEnabled && !aiSummaryEnabled && (
                      <span style={{ fontSize:11, fontWeight:500, color:"#6b7280", background:"#f3f4f6", padding:"3px 10px", borderRadius:20 }}>Chat</span>
                    )}
                    {!aiChatEnabled && aiSummaryEnabled && (
                      <span style={{ fontSize:11, fontWeight:500, color:"#6b7280", background:"#f3f4f6", padding:"3px 10px", borderRadius:20 }}>Summary</span>
                    )}
                  </div>
                </PanelHeader>

                <div style={{ flex:1, overflow:"hidden", position:"relative" }}>
                  {aiTab === "chat" && aiChatEnabled && (
                    <AIChat
                      isOpen={true} embedded onClose={handleAIToggle}
                      context={{ topicTitle: currentItemTitle || fileName, fileName, fileType:"docx", isDocumentView:true }}
                    />
                  )}
                  {aiTab === "summary" && aiSummaryEnabled && (
                    <SummaryChat
                      isOpen={true} embedded
                      onClose={() => { if (aiTab === "summary") setAiOpen(false) }}
                      context={{ topicTitle: currentItemTitle || fileName, fileName, fileType:"docx", isDocumentView:true, hierarchy: hierarchy.length > 0 ? hierarchy : [fileName] }}
                    />
                  )}
                </div>
              </div>

              {/* Left resize handle */}
              <div
                className={`wv-resize-handle${draggingHandle === "left" ? " dragging" : ""}`}
                onMouseDown={e => startDrag("left", e)}
                style={{ margin:`0 ${GAP / 2}px` }}
              />
            </>
          )}

          {/* ─── CENTER: Document Panel ──────────────────────────────────── */}
          <div className="wv-panel-card" style={{ flex: docFlex, minWidth:0, transition:"flex 0.05s", position:"relative" }}>

            {/* Panel header — 3 columns */}
            <div className="wv-panel-header-neutral" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", flexShrink:0, borderRadius:"14px 14px 0 0", gap:8 }}>
              {/* Left: filename */}
              <div style={{ display:"flex", alignItems:"center", gap:7, flex:1, minWidth:0 }}>
                <div style={{ width:22, height:22, borderRadius:6, background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <FileText size={11} style={{ color:"#9ca3af" }} />
                </div>
                <span style={{ fontSize:12, fontWeight:600, color:"#6b7280", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {fileName}
                </span>
              </div>
              {/* Center: page navigation (image mode) or engine label (iframe mode) */}
              <div style={{ display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
                {useImageMode ? (
                  <>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage<=1}
                      style={{ background:"none",border:"1.5px solid currentColor",cursor:currentPage<=1?"not-allowed":"pointer",color:currentPage<=1?"#D1D5DB":"#6b7280",display:"flex",alignItems:"center",padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,transition:"all 0.15s" }}
                    >
                      Prev
                    </button>
                    <input
                      className="wv-page-input"
                      type="number"
                      min={1}
                      max={totalPages}
                      value={pageInput}
                      onChange={e => setPageInput(e.target.value)}
                      onBlur={commitPageInput}
                      onKeyDown={handlePageInputKeyDown}
                    />
                    <span style={{ fontSize:12,color:"#9ca3af",fontWeight:500 }}>/ {totalPages}</span>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage>=totalPages}
                      style={{ background:"none",border:"1.5px solid currentColor",cursor:currentPage>=totalPages?"not-allowed":"pointer",color:currentPage>=totalPages?"#D1D5DB":"#6b7280",display:"flex",alignItems:"center",padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,transition:"all 0.15s" }}
                    >
                      Next
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize:11, color:"#9ca3af", fontWeight:500 }}>
                    {converting ? "Converting…" : engine === "ms" ? "Office Online" : "Google Docs"}
                  </span>
                )}
              </div>
              {/* Right: zoom controls (image mode only) */}
              <div style={{ display:"flex", alignItems:"center", gap:2, flex:1, justifyContent:"flex-end" }}>
                {useImageMode && (
                  <>
                    <button onClick={() => setPageScale(s => Math.max(0.5, s - 0.25))} disabled={pageScale<=0.5}
                      style={{ background:"none",border:"none",cursor:pageScale<=0.5?"not-allowed":"pointer",color:pageScale<=0.5?"#D1D5DB":"#6b7280",display:"flex",padding:"3px 5px",borderRadius:6,transition:"all 0.15s" }}>
                      <ZoomOut size={13} />
                    </button>
                    <span style={{ fontSize:12,color:"#374151",minWidth:38,textAlign:"center",fontWeight:600 }}>{Math.round(pageScale*100)}%</span>
                    <button onClick={() => setPageScale(s => Math.min(3, s + 0.25))} disabled={pageScale>=3}
                      style={{ background:"none",border:"none",cursor:pageScale>=3?"not-allowed":"pointer",color:pageScale>=3?"#D1D5DB":"#6b7280",display:"flex",padding:"3px 5px",borderRadius:6,transition:"all 0.15s" }}>
                      <ZoomIn size={13} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Viewer body */}
            <div style={{ flex:1, overflow:"auto", display:"flex", alignItems:"center", justifyContent:"center", padding: useImageMode ? "18px 16px" : 0, background: useImageMode ? "#EAECF0" : "#F0F0F0", borderRadius:"0 0 14px 14px", position:"relative", minHeight:0 }}>

              {/* ── Image mode: converting spinner */}
              {converting && (
                <div style={{ textAlign:"center", padding:"48px 24px" }}>
                  <div style={{ width:56,height:56,border:"4px solid rgba(249,115,22,0.15)",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 0.75s linear infinite",margin:"0 auto 20px" }} />
                  <p style={{ fontSize:15, fontWeight:700, color:"#1f2937", marginBottom:6 }}>Converting document…</p>
                  <p style={{ fontSize:12, color:"#9ca3af", margin:0 }}>This may take 30–60 seconds on first load</p>
                </div>
              )}

              {/* ── Image mode: convert error */}
              {convertError && !converting && !useImageMode && (
                <div style={{ textAlign:"center", padding:"48px 24px", maxWidth:400 }}>
                  <div style={{ width:64,height:64,borderRadius:18,background:"#FEF2F2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
                    <FileText size={28} style={{ color:"#ef4444" }} />
                  </div>
                  <p style={{ fontWeight:700, color:"#1f2937", marginBottom:8, fontSize:15 }}>Conversion failed</p>
                  <p style={{ color:"#6b7280", fontSize:12, marginBottom:20, lineHeight:1.5 }}>{convertError}</p>
                  <button
                    onClick={() => { delete imageCache.current[fileUrl]; setConvertError(null); setRetryCount(c => c + 1) }}
                    style={{ marginRight:10, padding:"10px 20px", background:"linear-gradient(135deg,#F97316,#FB923C)", color:"white", border:"none", borderRadius:10, fontWeight:600, cursor:"pointer", fontSize:13 }}
                  >
                    Retry
                  </button>
                  <button onClick={handleDownload} style={{ padding:"10px 20px", background:"#4B5563", color:"white", border:"none", borderRadius:10, fontWeight:600, cursor:"pointer", fontSize:13 }}>
                    Download instead
                  </button>
                </div>
              )}

              {/* ── Image mode: slide image */}
              {useImageMode && !converting && (
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", width:"100%", minHeight:"100%" }}>
                  <div style={{
                    width: `${Math.round(pageScale * 100)}%`,
                    transition: "width 0.2s ease",
                    boxShadow: "0 6px 32px rgba(0,0,0,0.18)",
                    borderRadius: 8,
                    overflow: "hidden",
                    background: "white",
                  }}>
                    {!imgLoaded && !imgError && (
                      <div style={{ width:"100%", paddingBottom:"75%", position:"relative", background:"white" }}>
                        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14 }}>
                          <div style={{ width:40,height:40,border:"3px solid rgba(249,115,22,0.15)",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 0.75s linear infinite" }} />
                          <p style={{ fontSize:13, color:"#6b7280", margin:0, fontWeight:500 }}>Loading page {currentPage}…</p>
                        </div>
                      </div>
                    )}
                    {imgError && (
                      <div style={{ width:"100%", paddingBottom:"75%", position:"relative", background:"white" }}>
                        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
                          <FileText size={32} style={{ color:"#ef4444" }} />
                          <p style={{ fontSize:13, color:"#6b7280", margin:0 }}>Failed to load page {currentPage}</p>
                        </div>
                      </div>
                    )}
                    <img
                      key={pageImages[currentPage - 1]}
                      src={pageImages[currentPage - 1]}
                      alt={`Page ${currentPage}`}
                      onLoad={() => { setImgLoaded(true); setImgError(false) }}
                      onError={() => { setImgLoaded(true); setImgError(true) }}
                      style={{
                        display: imgLoaded && !imgError ? "block" : "none",
                        width: "100%",
                        height: "auto",
                        userSelect: "none",
                      } as React.CSSProperties}
                    />
                  </div>
                </div>
              )}

              {/* ── Iframe fallback: only when not yet converted and not converting */}
              {!useImageMode && !converting && !convertError && (
                <>
                  {loading && !loadError && (
                    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#F9FAFB", zIndex:2, gap:12 }}>
                      <div style={{ width:48, height:48, borderRadius:12, background:"rgba(249,115,22,0.10)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <Loader2 size={22} style={{ color:"#F97316", animation:"spin 1s linear infinite" }} />
                      </div>
                      <p style={{ fontSize:13, fontWeight:600, color:"#374151", margin:0 }}>Loading document…</p>
                      <p style={{ fontSize:11, color:"#9CA3AF", margin:0 }}>This may take a few seconds</p>
                    </div>
                  )}
                  {loadError && (
                    <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"#F9FAFB", zIndex:2, gap:16 }}>
                      <div style={{ width:56, height:56, borderRadius:16, background:"rgba(239,68,68,0.08)", border:"1.5px solid rgba(239,68,68,0.20)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <AlertCircle size={26} style={{ color:"#EF4444" }} />
                      </div>
                      <div style={{ textAlign:"center" }}>
                        <p style={{ fontSize:14, fontWeight:700, color:"#1A1A1E", margin:"0 0 4px" }}>Could not preview this document</p>
                        <p style={{ fontSize:12, color:"#8F8F9A", margin:0 }}>The file URL may not be publicly accessible for online preview.</p>
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={handleReload} style={{ padding:"8px 16px", borderRadius:10, border:"1.5px solid #E5E7EB", background:"#fff", cursor:"pointer", fontSize:12, fontWeight:700, color:"#374151" }}>
                          Try again
                        </button>
                        <button onClick={handleDownload} style={{ padding:"8px 16px", borderRadius:10, border:"none", background:"#F97316", cursor:"pointer", fontSize:12, fontWeight:700, color:"#fff", display:"flex", alignItems:"center", gap:6 }}>
                          <Download size={13} /> Download instead
                        </button>
                      </div>
                    </div>
                  )}
                  {!loadError && (
                    <iframe
                      key={iframeKey}
                      src={viewerUrl}
                      title={fileName}
                      style={{ width:"100%", height:"100%", border:"none", display:"block" }}
                      onLoad={handleLoad}
                      onError={handleError}
                      allowFullScreen
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* ─── RIGHT: Notes Panel ─────────────────────────────────────── */}
          {notesOpen && (
            <>
              {/* Right resize handle */}
              <div
                className={`wv-resize-handle wv-resize-handle-blue${draggingHandle === "right" ? " dragging" : ""}`}
                onMouseDown={e => startDrag("right", e)}
                style={{ margin:`0 ${GAP / 2}px` }}
              />

              <div className="wv-panel-card" style={{ flex: notesFlexActual, transition:"flex 0.05s" }}>
                <PanelHeader
                  bgClass="wv-panel-header-blue"
                  onClose={() => { setNotesOpen(false); onNotesStateChange?.(false) }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:7 }}>
                    <div style={{ width:26, height:26, borderRadius:8, background:"linear-gradient(135deg,#F97316,#FB923C)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <BookOpen size={12} style={{ color:"white" }} />
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color:"#C2410C" }}>Notes</span>
                  </div>
                </PanelHeader>

                <div style={{ flex:1, overflow:"hidden" }}>
                  <NotesPanel
                    isOpen={true}
                    onClose={() => { setNotesOpen(false); onNotesStateChange?.(false) }}
                    isDraggable={false}
                    initialNoteData={shouldLoadSavedNote ? localStorage.getItem("lastCreatedNote") : null}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Fullscreen exit button */}
        {isFullscreen && (
          <button
            onClick={() => document.exitFullscreen?.()}
            style={{
              position:"fixed", top:16, right:16, zIndex:2100,
              display:"flex", alignItems:"center", gap:6,
              padding:"9px 18px", background:"rgba(0,0,0,0.7)", color:"white",
              border:"1px solid rgba(255,255,255,0.15)", borderRadius:12,
              cursor:"pointer", fontSize:13, fontWeight:600, backdropFilter:"blur(8px)",
            }}
          >
            <Minimize size={15} /> Exit Fullscreen
          </button>
        )}

        {/* ── Navigation Confirmation Dialog */}
        {showNavConfirm && (
          <div style={{ position:"fixed",inset:0,zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.45)",backdropFilter:"blur(6px)" }}>
            <div style={{ background:"white",borderRadius:18,padding:"32px",width:380,boxShadow:"0 24px 64px rgba(0,0,0,0.2)",border:"1px solid rgba(0,0,0,0.06)",animation:"slideUp 0.2s ease-out" }}>
              <div style={{ width:48,height:48,borderRadius:14,background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16 }}>
                <span style={{ fontSize:22 }}>⚠️</span>
              </div>
              <h3 style={{ fontSize:16,fontWeight:700,color:"#111827",margin:"0 0 8px" }}>Navigate away?</h3>
              <p style={{ fontSize:13,color:"#6b7280",margin:"0 0 24px",lineHeight:1.6 }}>Are you sure you want to navigate away from this document?</p>
              <div style={{ display:"flex",gap:10,justifyContent:"flex-end" }}>
                <button
                  onClick={() => { setShowNavConfirm(false); setPendingNavCrumb(null) }}
                  style={{ padding:"9px 20px",borderRadius:10,border:"1.5px solid #E5E7EB",background:"white",color:"#374151",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background="#F9FAFB" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background="white" }}
                >
                  No, stay
                </button>
                <button
                  onClick={() => {
                    setShowNavConfirm(false)
                    if (pendingNavCrumb) onBreadcrumbNavigate?.(pendingNavCrumb.crumb, pendingNavCrumb.index)
                    handleClose()
                  }}
                  style={{ padding:"9px 20px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#F97316,#FB923C)",color:"white",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s",boxShadow:"0 4px 12px rgba(249,115,22,0.3)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity="0.9" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity="1" }}
                >
                  Yes, leave
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
