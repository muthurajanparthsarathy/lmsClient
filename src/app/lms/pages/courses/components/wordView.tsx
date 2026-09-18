"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  X, Download, Maximize, Minimize, FileText,
  RefreshCw, ExternalLink, AlertCircle, Loader2,
  ChevronRight, LayoutDashboard, BookMarked, GraduationCap,
  Layers, BookOpen,
} from "lucide-react"

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const buildViewerUrl = (url: string, engine: "ms" | "google") => {
  const encoded = encodeURIComponent(url)
  return engine === "ms"
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`
    : `https://docs.google.com/gview?url=${encoded}&embedded=true`
}

const safeDownloadName = (name: string) => name.replace(/\.ocx$/i, ".docx")

const normalizeUrl = (fileUrl: string | { base: string } | any): string => {
  if (!fileUrl) return ""
  if (typeof fileUrl === "string") return fileUrl
  if (typeof fileUrl === "object" && fileUrl.base) return fileUrl.base
  if (typeof fileUrl === "object") {
    return (Object.values(fileUrl).find((v) => typeof v === "string" && (v as string).startsWith("http")) as string) || ""
  }
  return ""
}

// ─── BREADCRUMB INTERFACE ───────────────────────────────────────────────────
interface BreadcrumbItem {
  id: string;
  type: string;
  label: string;
  path?: string;
  onClick?: () => void;
}

// ─── PROPS ────────────────────────────────────────────────────────────────────
interface WordViewerProps {
  isOpen?: boolean
  fileUrl: string | { base: string }
  fileName: string
  fileId?: string
  entityType?: string
  entityId?: string
  tabType?: string
  subcategory?: string
  folderPath?: string[]
  apiBaseUrl?: string
  onClose: () => void
  isTeacher?: boolean
  // New props for breadcrumb
  breadcrumbs?: BreadcrumbItem[]
  currentCourseName?: string
  currentCourseId?: string
  onNavigateToDashboard?: () => void
  onNavigateToCourses?: () => void
  onNavigateToCourse?: () => void
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function WordViewer({
  fileUrl,
  fileName,
  onClose,
  isTeacher = true,
  breadcrumbs = [],
  currentCourseName = "Course",
  currentCourseId = "",
  onNavigateToDashboard,
  onNavigateToCourses,
  onNavigateToCourse,
}: WordViewerProps) {
  const [engine, setEngine] = useState<"ms" | "google">("ms")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)

  const url = normalizeUrl(fileUrl)
  const downloadName = safeDownloadName(fileName)

  useEffect(() => {
    setLoading(true); setLoadError(false); setEngine("ms"); setIframeKey(k => k + 1)
  }, [url])

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", fn)
    return () => document.removeEventListener("fullscreenchange", fn)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) document.exitFullscreen?.()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isFullscreen])

  const handleLoad = () => setLoading(false)
  const handleError = () => {
    if (engine === "ms") {
      setEngine("google"); setIframeKey(k => k + 1); setLoading(true); setLoadError(false)
    } else {
      setLoading(false); setLoadError(true)
    }
  }

  const handleReload = () => {
    setLoading(true); setLoadError(false); setEngine("ms"); setIframeKey(k => k + 1)
  }

  const handleDownload = () => {
    if (!url) return
    const a = document.createElement("a")
    a.href = url; a.download = downloadName; a.target = "_blank"
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const handleFullscreen = () => {
    if (!isFullscreen) containerRef.current?.requestFullscreen?.()
    else document.exitFullscreen?.()
  }

  // ── Breadcrumb click handler ──────────────────────────────────────────────
  const handleCrumbClick = (crumb: BreadcrumbItem, idx: number) => {
    if (crumb.onClick) {
      crumb.onClick();
    } else if (crumb.type === "dashboard" && onNavigateToDashboard) {
      onNavigateToDashboard();
    } else if (crumb.type === "courses" && onNavigateToCourses) {
      onNavigateToCourses();
    } else if (crumb.type === "course" && onNavigateToCourse) {
      onNavigateToCourse();
    }
  }

  const viewerUrl = buildViewerUrl(url, engine)

  const btnStyle: React.CSSProperties = {
    padding: 5, border: "none", borderRadius: 4,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed", inset: 0,
        backgroundColor: "#111827",
        zIndex: isFullscreen ? 2000 : 1000,
        display: "flex", flexDirection: "column",
      }}
    >
      {/* ── BREADCRUMB HEADER WITH CLOSE BUTTON ────────────────────────────── */}
      {!isFullscreen && (
        <div style={{ 
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          flexShrink: 0,
          position: "relative",
          zIndex: 10,
        }}>
          
          {/* Breadcrumb row with close button */}
          <div style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            borderBottom: "1px solid #f1f5f9",
          }}>
            {/* Breadcrumbs - left side */}
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "4px", 
              flexWrap: "wrap",
              flex: 1,
              minWidth: 0,
            }}>
              {breadcrumbs.length > 0 ? (
                // Use passed breadcrumbs from LMSCoordinator
                breadcrumbs.map((crumb, idx) => (
                  <div key={crumb.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {idx > 0 && <ChevronRight size={12} style={{ color: "#cbd5e1", flexShrink: 0 }} />}
                    <button
                      onClick={() => handleCrumbClick(crumb, idx)}
                      disabled={idx === breadcrumbs.length - 1}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: idx === breadcrumbs.length - 1 ? 700 : 500,
                        color: idx === breadcrumbs.length - 1 ? "#1e293b" : "#64748b",
                        backgroundColor: idx === breadcrumbs.length - 1 ? "#f8fafc" : "transparent",
                        border: "none",
                        cursor: idx === breadcrumbs.length - 1 ? "default" : "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (idx !== breadcrumbs.length - 1) {
                          e.currentTarget.style.backgroundColor = "#f1f5f9";
                          e.currentTarget.style.color = "#fb923c";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (idx !== breadcrumbs.length - 1) {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = "#64748b";
                        }
                      }}
                    >
                      {/* Icon based on crumb type */}
                      {crumb.type === "dashboard" && <LayoutDashboard size={12} style={{ flexShrink: 0 }} />}
                      {crumb.type === "courses" && <BookMarked size={12} style={{ flexShrink: 0 }} />}
                      {crumb.type === "course" && <GraduationCap size={12} style={{ flexShrink: 0, color: "#f27757" }} />}
                      {crumb.type === "module" && <Layers size={12} style={{ flexShrink: 0 }} />}
                      {crumb.type === "topic" && <BookOpen size={12} style={{ flexShrink: 0 }} />}
                      {crumb.type === "subtopic" && <FileText size={12} style={{ flexShrink: 0 }} />}
                      
                      <span style={{ 
                        maxWidth: "180px", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis", 
                        whiteSpace: "nowrap" 
                      }}>
                        {crumb.label}
                      </span>
                    </button>
                  </div>
                ))
              ) : (
                // Fallback static breadcrumbs
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      onClick={() => onNavigateToDashboard?.()}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "#64748b",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f1f5f9";
                        e.currentTarget.style.color = "#fb923c";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#64748b";
                      }}
                    >
                      <LayoutDashboard size={12} style={{ flexShrink: 0 }} />
                      <span>Dashboard</span>
                    </button>
                  </div>

                  <ChevronRight size={12} style={{ color: "#cbd5e1", flexShrink: 0 }} />

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button
                      onClick={() => onNavigateToCourses?.()}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "#64748b",
                        backgroundColor: "transparent",
                        border: "none",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f1f5f9";
                        e.currentTarget.style.color = "#fb923c";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "#64748b";
                      }}
                    >
                      <BookMarked size={12} style={{ flexShrink: 0 }} />
                      <span>Courses</span>
                    </button>
                  </div>

                  <ChevronRight size={12} style={{ color: "#cbd5e1", flexShrink: 0 }} />

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#1e293b",
                        backgroundColor: "#f8fafc",
                        border: "none",
                      }}
                    >
                      <GraduationCap size={12} style={{ flexShrink: 0, color: "#f27757" }} />
                      <span style={{ maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {currentCourseName}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Close button - RIGHT CORNER of breadcrumb */}
            <button 
              onClick={onClose} 
              style={{ 
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                padding: "6px 12px",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none", 
                borderRadius: "8px", 
                cursor: "pointer", 
                transition: "all 0.2s ease",
                fontWeight: 600,
                flexShrink: 0,
                fontSize: "12px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#b91c1c";
                e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#dc2626";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <X size={14} strokeWidth={2.5} />
              <span>Close</span>
            </button>
          </div>

          {/* File info bar */}
          <div style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
            minHeight: 48,
            backgroundColor: "#ffffff",
          }}>
            {/* Left side - File info */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
              <FileText size={15} style={{ flexShrink: 0, color: "#fdba74" }} />
              <span style={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: "#1e293b",
                maxWidth: 280, 
                overflow: "hidden", 
                textOverflow: "ellipsis", 
                whiteSpace: "nowrap" 
              }} title={fileName}>
                {fileName}
              </span>
              {isTeacher && (
                <span style={{ 
                  fontSize: 10, 
                  backgroundColor: "#7c3aed", 
                  padding: "2px 8px", 
                  borderRadius: 999, 
                  color: "white", 
                  fontWeight: 600,
                  marginLeft: 4,
                }}>
                  Teacher Mode
                </span>
              )}
            </div>

            {/* Right side - Engine badge and controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                fontSize: 10, padding: "3px 8px", borderRadius: 4,
                backgroundColor: "#f1f5f9",
                border: "1px solid #e2e8f0",
                color: "#64748b", fontWeight: 600, whiteSpace: "nowrap",
              }}>
                {engine === "ms" ? "Microsoft Office Online" : "Google Docs Viewer"}
              </span>

              {/* Reload button */}
              <button
                onClick={handleReload}
                title="Reload"
                style={{ ...btnStyle, backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <RefreshCw size={13} />
              </button>

              {/* Open in new tab button */}
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  style={{ ...btnStyle, backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0", textDecoration: "none" }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                >
                  <ExternalLink size={13} />
                </a>
              )}

              {/* Fullscreen button */}
              <button
                onClick={handleFullscreen}
                title="Fullscreen"
                style={{ ...btnStyle, backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <Maximize size={13} />
              </button>

              {/* Download button */}
              <button
                onClick={handleDownload}
                title="Download"
                style={{ ...btnStyle, backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <Download size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEWER BODY ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#374151" }}>

        {/* Loading overlay */}
        {loading && !loadError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#1f2937", zIndex: 2, gap: 12 }}>
            <div style={{ width: 40, height: 40, border: "3px solid rgba(255,255,255,0.15)", borderTop: "3px solid #fdba74", borderRadius: "50%", animation: "wvSpin 0.8s linear infinite" }} />
            <p style={{ fontSize: 13, color: "#9ca3af", margin: 0 }}>Loading document…</p>
          </div>
        )}

        {/* Error state */}
        {loadError && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: "#1f2937", zIndex: 2, gap: 16 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", backgroundColor: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={26} style={{ color: "#ef4444" }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "white", margin: "0 0 4px" }}>Could not preview this document</p>
              <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>The file URL may not be publicly accessible for online preview.</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleReload}
                style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #374151", backgroundColor: "#374151", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "white" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#4b5563")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#374151")}
              >
                Try again
              </button>
              <button
                onClick={handleDownload}
                style={{ padding: "8px 16px", borderRadius: 6, border: "none", backgroundColor: "#10b981", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "white", display: "flex", alignItems: "center", gap: 6 }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#059669")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#10b981")}
              >
                <Download size={13} /> Download instead
              </button>
            </div>
          </div>
        )}

        {/* iframe */}
        {!loadError && url && (
          <iframe
            key={iframeKey}
            src={viewerUrl}
            title={fileName}
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            onLoad={handleLoad}
            onError={handleError}
            allowFullScreen
          />
        )}

        {!url && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9ca3af", gap: 12 }}>
            <FileText size={44} style={{ color: "#4b5563" }} />
            <p style={{ fontSize: 13, margin: 0 }}>No valid file URL provided.</p>
          </div>
        )}
      </div>

      {/* Fullscreen exit hint */}
      {isFullscreen && (
        <button
          onClick={() => document.exitFullscreen?.()}
          style={{
            position: "fixed", top: 16, right: 16, zIndex: 2100,
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", backgroundColor: "rgba(0,0,0,0.75)", color: "white",
            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8,
            cursor: "pointer", fontSize: 13, fontWeight: 600, backdropFilter: "blur(8px)",
          }}
        >
          <Minimize size={14} /> Exit Fullscreen
        </button>
      )}

      <style>{`
        @keyframes wvSpin { to { transform: rotate(360deg); } }
        @keyframes pulse { 
          0%, 100% { opacity: 0.6; transform: scale(0.95); } 
          50% { opacity: 1; transform: scale(1.2); } 
        }
      `}</style>
    </div>
  )
}