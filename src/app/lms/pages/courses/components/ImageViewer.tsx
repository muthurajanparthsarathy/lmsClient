import React, { useState, useEffect, useRef } from "react";
import { 
  X, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, 
  ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon,
  LayoutDashboard, BookMarked, GraduationCap, Layers, BookOpen, FileText 
} from "lucide-react";

// ─── BREADCRUMB INTERFACE ───────────────────────────────────────────────────
interface BreadcrumbItem {
  id: string;
  type: string;
  label: string;
  path?: string;
  onClick?: () => void;
}

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
  // New props for breadcrumb
  breadcrumbs?: BreadcrumbItem[];
  currentCourseName?: string;
  currentCourseId?: string;
  onNavigateToDashboard?: () => void;
  onNavigateToCourses?: () => void;
  onNavigateToCourse?: () => void;
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
  isTeacher = true,
  breadcrumbs = [],
  currentCourseName = "Course",
  currentCourseId = "",
  onNavigateToDashboard,
  onNavigateToCourses,
  onNavigateToCourse,
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
  };

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

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed", inset: 0,
        zIndex: 1000,
        background: "#0a0a14",
        display: "flex", flexDirection: "column",
        fontFamily: "'Poppins','Google Sans','Segoe UI',system-ui,sans-serif",
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
                    {idx > 0 && <ChevronRightIcon size={12} style={{ color: "#cbd5e1", flexShrink: 0 }} />}
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

                  <ChevronRightIcon size={12} style={{ color: "#cbd5e1", flexShrink: 0 }} />

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

                  <ChevronRightIcon size={12} style={{ color: "#cbd5e1", flexShrink: 0 }} />

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
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "linear-gradient(135deg, #64748B, #94A3B8)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <rect x="2" y="2" width="20" height="20" rx="2" />
                  <circle cx="8.5" cy="8.5" r="2.5" />
                  <path d="M21 15L16 10L5 21" />
                </svg>
              </div>
              <span style={{ 
                fontSize: 13, 
                fontWeight: 600, 
                color: "#1e293b",
                maxWidth: 280, 
                overflow: "hidden", 
                textOverflow: "ellipsis", 
                whiteSpace: "nowrap" 
              }} title={title}>
                {title}
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
              {hasMultipleImages && (
                <span style={{ 
                  fontSize: 10, 
                  backgroundColor: "#f1f5f9", 
                  padding: "2px 8px", 
                  borderRadius: 999, 
                  color: "#64748b", 
                  fontWeight: 500,
                  marginLeft: 4,
                }}>
                  {currentImageIndex + 1} / {allImages.length}
                </span>
              )}
            </div>

            {/* Right side - Image controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* Zoom Out */}
              <button
                onClick={handleZoomOut}
                title="Zoom Out"
                style={{ ...btnStyle, backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <ZoomIn size={14} />
              </button>

              {/* Zoom percentage */}
              <span style={{ 
                fontSize: 11, 
                fontFamily: "monospace", 
                color: "#64748b", 
                minWidth: 45, 
                textAlign: "center",
                fontWeight: 500,
              }}>
                {Math.round(zoom * 100)}%
              </span>

              {/* Zoom In */}
              <button
                onClick={handleZoomIn}
                title="Zoom In"
                style={{ ...btnStyle, backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <ZoomOut size={14} />
              </button>

              <div style={{ width: 1, height: 24, background: "#e2e8f0", margin: "0 4px" }} />

              {/* Rotate */}
              <button
                onClick={handleRotate}
                title="Rotate"
                style={{ ...btnStyle, backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <RotateCw size={14} />
              </button>

              {/* Reset */}
              <button
                onClick={handleReset}
                title="Reset view"
                style={{ ...btnStyle, backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </button>

              <div style={{ width: 1, height: 24, background: "#e2e8f0", margin: "0 4px" }} />

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                style={{ ...btnStyle, backgroundColor: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE CONTENT ────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1, position: "relative", overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0a0a14",
          cursor: zoom > 1 ? "grab" : "default",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isLoading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.8)", animation: "ivSpin 0.8s linear infinite" }} />
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0 }}>Loading image…</p>
          </div>
        )}

        {error && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
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
            width: "100%", height: "100%",
          }}
          onLoad={() => { setIsLoading(false); setError(null); }}
          onError={() => { setIsLoading(false); setError("Failed to load image. The file may be corrupted or unsupported."); }}
          draggable={false}
        />
      </div>

      {/* ── NAVIGATION ARROWS ─────────────────────────────────────────────────── */}
      {hasMultipleImages && (
        <>
          {canGoPrevious && (
            <button
              onClick={handlePrevious}
              style={{
                position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)",
                padding: 12, borderRadius: "50%", border: "none", cursor: "pointer",
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
                color: "white", opacity: 0.7, transition: "all 0.2s", display: "flex",
                zIndex: 20,
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
                color: "white", opacity: 0.7, transition: "all 0.2s", display: "flex",
                zIndex: 20,
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
              padding: "6px 14px", borderRadius: 99, zIndex: 20,
              background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
              color: "white", fontSize: 11, fontWeight: 600,
            }}
          >
            {currentImageIndex + 1} / {allImages.length}
          </div>
        </>
      )}

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
          <Minimize2 size={14} /> Exit Fullscreen
        </button>
      )}

      <style>{`
        @keyframes ivSpin { to { transform: rotate(360deg); } }
        @keyframes pulse { 
          0%, 100% { opacity: 0.6; transform: scale(0.95); } 
          50% { opacity: 1; transform: scale(1.2); } 
        }
      `}</style>
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  padding: 8, borderRadius: 8, border: "none", cursor: "pointer",
  background: "transparent", color: "rgba(255,255,255,0.7)",
  display: "flex", alignItems: "center", justifyContent: "center",
  transition: "all 0.15s",
};

export default ImageViewer;