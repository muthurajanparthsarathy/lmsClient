// imageViewer.tsx
import React, { useState, useEffect, useRef } from "react";
import { X, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, ChevronLeft, ChevronRight, BookOpen, FileImage } from "lucide-react";
import NotesPanel from "./notes-panel";

// ─── KEYFRAME STYLES ─────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes ivSpin { to { transform: rotate(360deg) } }
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(14px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .iv-toolbar-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 11px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 600; transition: all 0.15s;
    background: white; color: #4B5563;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06);
    letter-spacing: 0.1px;
    white-space: nowrap;
  }
  .iv-toolbar-btn:hover { background: #F9FAFB; box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.07); }
  .iv-toolbar-btn:active { transform: scale(0.97); }
  .iv-toolbar-btn.active-blue {
    background: linear-gradient(135deg,#F97316 0%,#FB923C 100%);
    color: white;
    box-shadow: 0 3px 10px rgba(251,146,60,0.4), 0 0 0 1px rgba(251,146,60,0.2);
  }
  .iv-toolbar-btn.icon-only { padding: 6px 9px; }
  .iv-toolbar-btn.danger {
    background: #FEF2F2; color: #DC2626;
    box-shadow: 0 1px 2px rgba(220,38,38,0.08), 0 0 0 1px rgba(220,38,38,0.1);
  }
  .iv-toolbar-btn.danger:hover { background: #FEE2E2; }
`

interface ImageViewerProps {
  isOpen: boolean;
  imageUrl: string;
  title: string;
  fileId: string;
  entityType?: string;
  entityId?: string;
  tabType?: string;
  subcategory?: string;
  folderPath?: string[];
  onClose: () => void;
  apiBaseUrl?: string;
  isTeacher?: boolean;
  allImages?: Array<{
    id: string;
    title: string;
    fileUrl: string;
  }>;
  currentImageIndex?: number;
  onImageChange?: (index: number) => void;
  hierarchy?: string[];
  currentItemTitle?: string;
  onBreadcrumbNavigate?: (crumb: string, index: number) => void;
  notesEnabled?: boolean;
  onNotesClick?: () => void;
  showNotesPanel?: boolean;
  onNotesStateChange?: (isOpen: boolean) => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  isOpen,
  imageUrl,
  title,
  fileId,
  onClose,
  allImages = [],
  currentImageIndex = 0,
  onImageChange,
  hierarchy = [],
  currentItemTitle = "",
  onBreadcrumbNavigate,
  notesEnabled = false,
  onNotesClick,
  showNotesPanel,
  onNotesStateChange,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [notesOpen, setNotesOpen] = useState(false);
  const [shouldLoadSavedNote, setShouldLoadSavedNote] = useState(false);
  const [showNavConfirm, setShowNavConfirm] = useState(false);
  const [pendingNavCrumb, setPendingNavCrumb] = useState<{ crumb: string; index: number } | null>(null);

  const showNotesButton = notesEnabled;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setZoom(1); setRotation(0); setIsFullscreen(false);
      setIsLoading(true); setError(null); setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  useEffect(() => {
    setIsLoading(true); setError(null); setZoom(1); setRotation(0); setPosition({ x: 0, y: 0 });
  }, [imageUrl]);

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  // ── Notes event ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleForceOpenNotes = () => {
      setNotesOpen(true);
      onNotesStateChange?.(true);
      const savedNote = localStorage.getItem("lastCreatedNote");
      if (savedNote) { setShouldLoadSavedNote(true); setTimeout(() => setShouldLoadSavedNote(false), 500); }
    };
    window.addEventListener("force-open-notes-in-viewer", handleForceOpenNotes);
    return () => window.removeEventListener("force-open-notes-in-viewer", handleForceOpenNotes);
  }, [onNotesStateChange]);

  useEffect(() => { setNotesOpen(true) }, [showNotesPanel]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => { setZoom(1); setRotation(0); setPosition({ x: 0, y: 0 }); };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };
  const handleMouseUp = () => setIsDragging(false);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) containerRef.current.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const hasMultipleImages = allImages.length > 1;
  const canGoPrevious = hasMultipleImages && currentImageIndex > 0;
  const canGoNext = hasMultipleImages && currentImageIndex < allImages.length - 1;

  const handlePrevious = () => {
    if (canGoPrevious && onImageChange) { handleReset(); onImageChange(currentImageIndex - 1); }
  };
  const handleNext = () => {
    if (canGoNext && onImageChange) { handleReset(); onImageChange(currentImageIndex + 1); }
  };

  const handleNotesToggle = () => {
    const next = !notesOpen;
    setNotesOpen(next);
    onNotesClick?.();
    onNotesStateChange?.(next);
  };

  const handleCrumbClick = (crumb: string, idx: number) => {
    setPendingNavCrumb({ crumb, index: idx });
    setShowNavConfirm(true);
  };

  const displayTitle = title || currentItemTitle || "Image";

  if (!isOpen) return null;

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div
        ref={containerRef}
        style={{
          position: "fixed", inset: 0,
          zIndex: 1000,
          background: "#E2E5EA",  // ← Changed to light gray like PDF/TXT viewers
          display: "flex", flexDirection: "column",
          fontFamily: "'Poppins','Google Sans','Segoe UI',system-ui,sans-serif",
          animation: "fadeIn 0.18s ease",
        }}
      >
        {/* ── TOP TOOLBAR (now visible on light background) ────────────────── */}
        <div style={{
          display: "flex", alignItems: "center",
          padding: "10px 12px 0 12px", gap: 8, flexShrink: 0,
        }}>
          {/* Breadcrumbs */}
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            flex: 1, minWidth: 0, overflow: "hidden",
          }}>
            {/* Image icon */}
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: "linear-gradient(135deg,#F27757,#F9A03F)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <FileImage size={11} style={{ color: "white" }} />
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Zoom controls */}
            <button onClick={handleZoomOut} className="iv-toolbar-btn icon-only" title="Zoom Out">
              <ZoomOut size={14} />
            </button>
            <span style={{
              fontSize: 12, fontWeight: 600, color: "#374151",
              minWidth: 38, textAlign: "center",
            }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={handleZoomIn} className="iv-toolbar-btn icon-only" title="Zoom In">
              <ZoomIn size={14} />
            </button>

            {/* Rotate */}
            <button onClick={handleRotate} className="iv-toolbar-btn icon-only" title="Rotate">
              <RotateCw size={14} />
            </button>

            {/* Reset */}
            <button onClick={handleReset} className="iv-toolbar-btn icon-only" title="Reset view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="iv-toolbar-btn icon-only" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>

            <div style={{ width: 1, height: 22, background: "rgba(0,0,0,0.1)" }} />

            {/* Notes Button */}
            {showNotesButton && (
              <button
                onClick={handleNotesToggle}
                className={`iv-toolbar-btn${notesOpen ? " active-blue" : ""}`}
              >
                <BookOpen size={12} /> Notes
              </button>
            )}

            {/* Close Button */}
            <button
              onClick={onClose}
              className="iv-toolbar-btn danger icon-only"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── CONTENT AREA ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", padding: "10px 10px 10px 10px", minHeight: 0 }}>
          {/* Image content card */}
          <div style={{
            flex: 1, borderRadius: 14, overflow: "hidden",
            background: "#0a0a14",
            boxShadow: "0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05)",
            display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative",
          }}>
            {/* Panel header */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", zIndex: 5,
              background: "linear-gradient(135deg,#FAFBFC 0%,#F3F4F6 100%)",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
              borderRadius: "14px 14px 0 0",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                background: "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <FileImage size={11} style={{ color: "#9CA3AF" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {displayTitle}
              </span>
              {allImages.length > 0 && (
                <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>
                  {currentImageIndex + 1} of {allImages.length}
                </span>
              )}
            </div>

            {/* Image area */}
            <div
              style={{
                flex: 1, width: "100%", height: "100%",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: zoom > 1 ? "grab" : "default",
                marginTop: 42, // offset for header
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {isLoading && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.8)", animation: "ivSpin 0.8s linear infinite" }} />
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0 }}>Loading image…</p>
                </div>
              )}

              {error && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", margin: 0 }}>{error}</p>
                </div>
              )}

              <img
                ref={imageRef}
                src={imageUrl}
                alt={title}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                  cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
                  maxWidth: "100%", maxHeight: "100%", objectFit: "contain",
                  opacity: isLoading ? 0 : 1,
                  transition: isDragging ? "none" : "transform 0.2s ease-out",
                  userSelect: "none",
                }}
                onLoad={() => { setIsLoading(false); setError(null); }}
                onError={() => { setIsLoading(false); setError("Failed to load image. The file may be corrupted or unsupported."); }}
                draggable={false}
              />
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#c2410c" }}>Notes</span>
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

        {/* ── Navigation arrows ────────────────────────────────────────────── */}
        {hasMultipleImages && (
          <>
            {canGoPrevious && (
              <button
                onClick={handlePrevious}
                style={{
                  position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                  padding: 12, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                  color: "white", opacity: 0.7, transition: "all 0.2s", display: "flex", zIndex: 10,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.background = "rgba(242,119,87,0.8)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.6)"; }}
              >
                <ChevronLeft size={24} />
              </button>
            )}
            {canGoNext && (
              <button
                onClick={handleNext}
                style={{
                  position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                  padding: 12, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                  color: "white", opacity: 0.7, transition: "all 0.2s", display: "flex", zIndex: 10,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.background = "rgba(242,119,87,0.8)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7"; (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.6)"; }}
              >
                <ChevronRight size={24} />
              </button>
            )}

            {/* Counter */}
            <div
              style={{
                position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                padding: "6px 14px", borderRadius: 99, zIndex: 10,
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                color: "white", fontSize: 11, fontWeight: 600,
              }}
            >
              {currentImageIndex + 1} / {allImages.length}
            </div>
          </>
        )}

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
                Are you sure you want to navigate away from this image?
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
                    background: "linear-gradient(135deg,#F27757,#F9A03F)",
                    color: "white", fontSize: 13, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.15s",
                    boxShadow: "0 3px 10px rgba(242,119,87,0.35)",
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
  );
};

export default ImageViewer;