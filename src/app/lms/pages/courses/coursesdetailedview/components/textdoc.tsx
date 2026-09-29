"use client"

import React, { useState, useEffect, useRef } from "react"
import { X, FileText, ChevronRight, BookOpen } from "lucide-react"
import NotesPanel from "./notes-panel"

// ─── KEYFRAME STYLES ─────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes spin { to { transform: rotate(360deg) } }

  .txt-viewer-scroll::-webkit-scrollbar { width: 6px; }
  .txt-viewer-scroll::-webkit-scrollbar-track { background: transparent; }
  .txt-viewer-scroll::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 6px; }
  .txt-viewer-scroll::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }

  .pdf-toolbar-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 11px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 600; transition: all 0.15s;
    background: white; color: #4B5563;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06);
    letter-spacing: 0.1px;
    white-space: nowrap;
  }
  .pdf-toolbar-btn:hover { background: #F9FAFB; box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.07); }
  .pdf-toolbar-btn:active { transform: scale(0.97); }
  .pdf-toolbar-btn.active-blue {
    background: linear-gradient(135deg,#F97316 0%,#FB923C 100%);
    color: white;
    box-shadow: 0 3px 10px rgba(251,146,60,0.4), 0 0 0 1px rgba(251,146,60,0.2);
  }
`

// ─── PROPS ───────────────────────────────────────────────────────────────────
interface TxtViewerProps {
  fileUrl: string
  fileName?: string
  isOpen?: boolean
  onClose: () => void
  hierarchy?: string[]
  currentItemTitle?: string
  onBreadcrumbNavigate?: (crumb: string, index: number) => void
  notesEnabled?: boolean
  onNotesClick?: () => void
  showNotesPanel?: boolean
  onNotesStateChange?: (isOpen: boolean) => void
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function TxtViewer({
  fileUrl,
  fileName = "document.txt",
  isOpen = true,
  onClose,
  hierarchy = [],
  currentItemTitle = "",
  onBreadcrumbNavigate,
  notesEnabled = false,
  onNotesClick,
  showNotesPanel,
  onNotesStateChange,
}: TxtViewerProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [showNavConfirm, setShowNavConfirm] = useState(false)
  const [pendingNavCrumb, setPendingNavCrumb] = useState<{ crumb: string; index: number } | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [shouldLoadSavedNote, setShouldLoadSavedNote] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const showNotesButton = notesEnabled

  // ── Fetch text content ────────────────────────────────────────────────────
  useEffect(() => {
    if (!fileUrl || !isOpen) return
    setLoading(true)
    setFetchError(null)
    setContent(null)

    fetch(fileUrl)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load file (${res.status})`)
        return res.text()
      })
      .then(text => { setContent(text); setLoading(false) })
      .catch(err => { setFetchError(err.message || "Failed to load file"); setLoading(false) })
  }, [fileUrl, isOpen])

  // ── Notes event ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleForceOpenNotes = () => {
      setNotesOpen(true)
      onNotesStateChange?.(true)
      const savedNote = localStorage.getItem("lastCreatedNote")
      if (savedNote) { setShouldLoadSavedNote(true); setTimeout(() => setShouldLoadSavedNote(false), 500) }
    }
    window.addEventListener("force-open-notes-in-viewer", handleForceOpenNotes)
    return () => window.removeEventListener("force-open-notes-in-viewer", handleForceOpenNotes)
  }, [onNotesStateChange])

  useEffect(() => {
    if (showNotesPanel === true) {
      setNotesOpen(true)
    }
  }, [showNotesPanel])
  if (!isOpen) return null

  // ── Breadcrumb click handler ──────────────────────────────────────────────
  const handleCrumbClick = (crumb: string, idx: number) => {
    setPendingNavCrumb({ crumb, index: idx })
    setShowNavConfirm(true)
  }

  // ── Notes toggle handler ──────────────────────────────────────────────────
  const handleNotesToggle = () => {
    const next = !notesOpen
    setNotesOpen(next)
    onNotesClick?.()
    onNotesStateChange?.(next)
  }

  // ── Title to show in breadcrumb ───────────────────────────────────────────
  const displayTitle = fileName

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div
        ref={containerRef}
        style={{
          position: "fixed", inset: 0,
          background: "#E2E5EA",
          display: "flex", flexDirection: "column",
          zIndex: 1000,
          fontFamily: "'Poppins','Google Sans','Segoe UI',system-ui,sans-serif",
          animation: "fadeIn 0.18s ease",
        }}
      >
        {/* ── TOP TOOLBAR ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", padding: "10px 12px 0 12px", gap: 8, flexShrink: 0 }}>

          {/* Breadcrumbs */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, minWidth: 0, overflow: "hidden" }}>
            {/* Icon badge */}
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: "linear-gradient(135deg,#64748B,#94A3B8)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <FileText size={11} style={{ color: "white" }} />
            </div>

            {hierarchy.length > 0 ? (
              <>
                {hierarchy.map((crumb, idx) => (
                  <React.Fragment key={idx}>
                    <button
                      onClick={() => handleCrumbClick(crumb, idx)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 500, color: "#4B5563", padding: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        maxWidth: 120, flexShrink: 1, transition: "color 0.15s",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#111827" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#4B5563" }}
                    >
                      {crumb}
                    </button>
                    {idx < hierarchy.length - 1 && (
                      <ChevronRight size={12} style={{ color: "#9CA3AF", flexShrink: 0 }} />
                    )}
                  </React.Fragment>
                ))}
                <ChevronRight size={12} style={{ color: "#9CA3AF", flexShrink: 0 }} />
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "#111827",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  maxWidth: 200, flexShrink: 0,
                }}>
                  {displayTitle}
                </span>
              </>
            ) : (
              <span style={{
                fontSize: 12, fontWeight: 700, color: "#111827",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {displayTitle}
              </span>
            )}
          </div>

          {/* ── Right actions ──────────────────────────────────────────────── */}
          {showNotesButton && (
            <button
              onClick={handleNotesToggle}
              className={`pdf-toolbar-btn${notesOpen ? " active-blue" : ""}`}
            >
              <BookOpen size={12} /> Notes
            </button>
          )}

          {/* Red X close button */}
          <button
            onClick={() => {
              setNotesOpen(false)
              onNotesStateChange?.(false)
              onClose()
            }} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 32, height: 32, borderRadius: 9, border: "none", cursor: "pointer",
              background: "#FEF2F2", color: "#DC2626", flexShrink: 0, transition: "all 0.15s",
            }}
            title="Close"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FEE2E2" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#FEF2F2" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* ── CONTENT AREA ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", padding: "10px 10px 10px 10px", minHeight: 0 }}>
          <div style={{
            flex: 1, background: "white", borderRadius: 14, overflow: "hidden",
            display: "flex", flexDirection: "column",
            boxShadow: "0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)",
          }}>
            {/* Panel header */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", flexShrink: 0,
              background: "linear-gradient(135deg,#FAFBFC 0%,#F3F4F6 100%)",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              borderRadius: "14px 14px 0 0",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <FileText size={11} style={{ color: "#9CA3AF" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayTitle}
              </span>
            </div>

            {/* Text content */}
            <div
              className="txt-viewer-scroll"
              style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}
            >
              {loading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    border: "2.5px solid #E5E7EB", borderTopColor: "#64748B",
                    animation: "spin 0.75s linear infinite",
                  }} />
                  <span style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 500 }}>Loading…</span>
                </div>
              )}

              {fetchError && !loading && (
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  height: "100%", gap: 12, textAlign: "center",
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 14,
                    background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: 20 }}>⚠️</span>
                  </div>
                  <p style={{ fontSize: 13, color: "#EF4444", fontWeight: 600, margin: 0 }}>Failed to load file</p>
                  <p style={{ fontSize: 12, color: "#9CA3AF", margin: 0 }}>{fetchError}</p>
                </div>
              )}

              {content !== null && !loading && !fetchError && (
                <pre style={{
                  margin: 0, padding: 0,
                  fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code','Consolas','Courier New',monospace",
                  fontSize: 13, lineHeight: 1.75, color: "#1F2937",
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                  tabSize: 4,
                }}>
                  {content}
                </pre>
              )}
            </div>
          </div>

          {/* ── Notes Panel ────────────────────────────────────────────────── */}
          {notesOpen && showNotesButton && (
            <div style={{
              width: 340, flexShrink: 0, marginLeft: 10,
              background: "white", borderRadius: 14, overflow: "hidden",
              boxShadow: "0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)",
              display: "flex", flexDirection: "column",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 14px", flexShrink: 0,
                background: "linear-gradient(135deg,#FFF7ED 0%,#FFEDD5 100%)",
                borderBottom: "1px solid rgba(251,146,60,0.12)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 8,
                    background: "linear-gradient(135deg,#F97316,#FB923C)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <BookOpen size={12} style={{ color: "white" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#C2410C" }}>Notes</span>
                </div>
                <button
                  onClick={() => { setNotesOpen(false); onNotesStateChange?.(false) }}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#9ca3af", display: "flex", padding: 5, borderRadius: 7,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.background = "#f3f4f6"); (e.currentTarget.style.color = "#6b7280") }}
                  onMouseLeave={e => { (e.currentTarget.style.background = "none"); (e.currentTarget.style.color = "#9ca3af") }}
                >
                  <X size={13} />
                </button>
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <NotesPanel
                  isOpen={true}
                  onClose={() => { setNotesOpen(false); onNotesStateChange?.(false) }}
                  isDraggable={false}
                  initialNoteData={shouldLoadSavedNote ? localStorage.getItem("lastCreatedNote") : null}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Navigation Confirmation Dialog ──────────────────────────────── */}
        {showNavConfirm && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 4000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)",
          }}>
            <div style={{
              background: "white", borderRadius: 18, padding: "32px", width: 380,
              boxShadow: "0 24px 64px rgba(0,0,0,0.2)", border: "1px solid rgba(0,0,0,0.06)",
              animation: "slideUp 0.2s ease-out",
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16,
              }}>
                <span style={{ fontSize: 22 }}>⚠️</span>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
                Navigate away?
              </h3>
              <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 24px", lineHeight: 1.6 }}>
                Are you sure you want to navigate away from this document?
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setShowNavConfirm(false); setPendingNavCrumb(null) }}
                  style={{
                    padding: "9px 20px", borderRadius: 10, border: "1.5px solid #E5E7EB",
                    background: "white", color: "#374151", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "white" }}
                >
                  No, stay
                </button>
                <button
                  onClick={() => {
                    setShowNavConfirm(false)
                    if (pendingNavCrumb) onBreadcrumbNavigate?.(pendingNavCrumb.crumb, pendingNavCrumb.index)
                    onClose()
                  }}
                  style={{
                    padding: "9px 20px", borderRadius: 10, border: "none",
                    background: "linear-gradient(135deg,#64748B,#94A3B8)",
                    color: "white", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    boxShadow: "0 3px 10px rgba(100,116,139,0.35)",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.9" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
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