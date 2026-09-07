"use client"

import React, { useState, useEffect, useRef } from "react"
import { 
  X, FileText, ChevronRight, LayoutDashboard, 
  BookMarked, GraduationCap, Layers, BookOpen 
} from "lucide-react"

// ─── KEYFRAME STYLES ─────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes pulse { 
    0%, 100% { opacity: 0.6; transform: scale(0.95); } 
    50% { opacity: 1; transform: scale(1.2); } 
  }

  .txt-teacher-scroll::-webkit-scrollbar { width: 6px; }
  .txt-teacher-scroll::-webkit-scrollbar-track { background: transparent; }
  .txt-teacher-scroll::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 6px; }
  .txt-teacher-scroll::-webkit-scrollbar-thumb:hover { background: #9CA3AF; }
`

// ─── BREADCRUMB INTERFACE ───────────────────────────────────────────────────
interface BreadcrumbItem {
  id: string;
  type: string;
  label: string;
  path?: string;
  onClick?: () => void;
}

// ─── PROPS ───────────────────────────────────────────────────────────────────
interface TxtViewerProps {
  fileUrl: string
  fileName?: string
  isOpen?: boolean
  onClose: () => void
  hierarchy?: string[]
  currentItemTitle?: string
  onBreadcrumbNavigate?: (crumb: string, index: number) => void
  // New props for breadcrumb
  breadcrumbs?: BreadcrumbItem[]
  currentCourseName?: string
  currentCourseId?: string
  onNavigateToDashboard?: () => void
  onNavigateToCourses?: () => void
  onNavigateToCourse?: () => void
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function TxtViewerTeacher({
  fileUrl,
  fileName = "document.txt",
  isOpen = true,
  onClose,
  hierarchy = [],
  currentItemTitle = "",
  onBreadcrumbNavigate,
  breadcrumbs = [],
  currentCourseName = "Course",
  currentCourseId = "",
  onNavigateToDashboard,
  onNavigateToCourses,
  onNavigateToCourse,
}: TxtViewerProps) {
  const [content, setContent]           = useState<string | null>(null)
  const [loading, setLoading]           = useState(true)
  const [fetchError, setFetchError]     = useState<string | null>(null)
  const [showNavConfirm, setShowNavConfirm] = useState(false)
  const [pendingNavCrumb, setPendingNavCrumb] = useState<{ crumb: string; index: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  if (!isOpen) return null

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
    } else if (onBreadcrumbNavigate && hierarchy[idx]) {
      // Legacy hierarchy navigation
      setPendingNavCrumb({ crumb: hierarchy[idx], index: idx })
      setShowNavConfirm(true)
    }
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
        {/* ── BREADCRUMB HEADER WITH CLOSE BUTTON ────────────────────────────── */}
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
              ) : hierarchy.length > 0 ? (
                // Fallback to legacy hierarchy
                <>
                  {hierarchy.map((crumb, idx) => (
                    <React.Fragment key={idx}>
                      <button
                        onClick={() => handleCrumbClick({ id: crumb, type: "module", label: crumb }, idx)}
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
                // Simple title only
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "#111827",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {displayTitle}
                </span>
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

          {/* File info bar (matches PDF/PPT viewers) */}
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
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg, #64748B, #94A3B8)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <FileText size={14} style={{ color: "white" }} />
              </div>
              <span style={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: "#1e293b",
                maxWidth: 300, 
                overflow: "hidden", 
                textOverflow: "ellipsis", 
                whiteSpace: "nowrap" 
              }} title={displayTitle}>
                {displayTitle}
              </span>
              <span style={{ 
                fontSize: 10, 
                backgroundColor: "#7c3aed", 
                padding: "2px 8px", 
                borderRadius: 999, 
                color: "white", 
                fontWeight: 600,
              }}>
                Teacher Mode
              </span>
            </div>

            {/* Right side - File type badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ 
                fontSize: 10, 
                color: "#64748b", 
                backgroundColor: "#f1f5f9", 
                padding: "4px 10px", 
                borderRadius: 6,
                fontWeight: 500,
              }}>
                TXT File
              </span>
            </div>
          </div>
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
              className="txt-teacher-scroll"
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