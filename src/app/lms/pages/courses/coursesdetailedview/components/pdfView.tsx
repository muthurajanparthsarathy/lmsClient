"use client"

import React from "react"
import { X, Download, ZoomIn, ZoomOut, Maximize, Minimize, FileText } from "lucide-react"

interface PDFViewerProps {
  fileUrl: string | { base: string } // Allow both string and object types
  fileName: string
  onClose: () => void
}

export default function PDFViewer({ fileUrl, fileName, onClose }: PDFViewerProps) {
  const [zoom, setZoom] = React.useState(100)
  const [isFullscreen, setIsFullscreen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Normalize the PDF URL - FIXED VERSION
  const normalizedUrl = React.useMemo(() => {
    if (!fileUrl) return ''
    
    console.log('PDFViewer - Original fileUrl:', fileUrl, 'Type:', typeof fileUrl)
    
    // Handle different file URL structures
    let finalUrl = ''
    
    if (typeof fileUrl === 'string') {
      // If it's already a string URL
      finalUrl = fileUrl
    } else if (fileUrl && typeof fileUrl === 'object' && fileUrl.base) {
      // If it's an object with base property (your current structure)
      finalUrl = fileUrl.base
    } else if (fileUrl && typeof fileUrl === 'object') {
      // Fallback: try to extract URL from object properties
      finalUrl = Object.values(fileUrl).find(val => 
        typeof val === 'string' && val.startsWith('http')
      ) as string || ''
    }
    
    console.log('PDFViewer - Normalized URL:', finalUrl)
    
    // Ensure the URL is properly encoded
    if (finalUrl && finalUrl.startsWith('http')) {
      return finalUrl
    }
    
    return ''
  }, [fileUrl])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isFullscreen])

  const handleDownload = () => {
    try {
      if (!normalizedUrl) {
        alert('No valid PDF URL available for download')
        return
      }
      
      const a = document.createElement("a")
      a.href = normalizedUrl
      a.download = fileName
      a.target = '_blank'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
      alert('Download failed. Please try again.')
    }
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleLoad = () => {
    setIsLoading(false)
    setError(null)
  }

  const handleError = () => {
    setIsLoading(false)
    setError('Failed to load PDF. The file may be corrupted or unavailable.')
  }

  // Debug info
  React.useEffect(() => {
    console.log('PDFViewer Debug:', {
      originalFileUrl: fileUrl,
      normalizedUrl,
      fileName,
      hasValidUrl: !!normalizedUrl
    })
  }, [fileUrl, normalizedUrl, fileName])

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isFullscreen ? "rgba(0, 0, 0, 1)" : "rgba(0, 0, 0, 0.8)",
        zIndex: isFullscreen ? 2000 : 1000,
        display: "flex",
        flexDirection: "column",
        animation: "fadeIn 0.2s ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#1f2937",
          color: "white",
          padding: "12px 16px",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #374151",
          display: isFullscreen ? "none" : "flex",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <FileText size={20} />
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: "600",
                maxWidth: "400px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={fileName}
            >
              {fileName}
            </h3>
            {!normalizedUrl && (
              <p style={{ margin: 0, fontSize: "12px", color: "#ef4444" }}>
                No valid PDF URL
              </p>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <button
            onClick={() => setZoom(Math.max(50, zoom - 25))}
            style={{
              padding: "6px",
              backgroundColor: "#374151",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            disabled={isLoading || !normalizedUrl}
          >
            <ZoomOut size={16} />
          </button>

          <span style={{ fontSize: "14px", minWidth: "50px", textAlign: "center" }}>{zoom}%</span>

          <button
            onClick={() => setZoom(Math.min(200, zoom + 25))}
            style={{
              padding: "6px",
              backgroundColor: "#374151",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            disabled={isLoading || !normalizedUrl}
          >
            <ZoomIn size={16} />
          </button>

          <button
            onClick={toggleFullscreen}
            style={{
              padding: "6px",
              backgroundColor: "#fb923c",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
            title="Full View"
            disabled={isLoading || !normalizedUrl}
          >
            <Maximize size={16} />
          </button>

          <button
            onClick={handleDownload}
            style={{
              padding: "6px",
              backgroundColor: normalizedUrl ? "#10b981" : "#6b7280",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: normalizedUrl ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
            }}
            disabled={isLoading || !!error || !normalizedUrl}
            title={normalizedUrl ? "Download PDF" : "No PDF available for download"}
          >
            <Download size={16} />
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "6px",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* PDF Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: isFullscreen ? "0" : "20px",
          overflow: "auto",
          position: "relative",
        }}
      >
        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            style={{
              position: "absolute",
              top: "20px",
              right: "20px",
              padding: "8px 12px",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              zIndex: 10,
              fontSize: "14px",
              fontWeight: "500",
            }}
            title="Exit Full View (ESC)"
          >
            <Minimize size={16} />
            Exit Full View
          </button>
        )}

        {!normalizedUrl && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
              textAlign: "center",
              zIndex: 5,
              backgroundColor: "rgba(239, 68, 68, 0.9)",
              padding: "20px",
              borderRadius: "8px",
              maxWidth: "400px",
            }}
          >
            <FileText size={48} className="mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Invalid PDF URL</h3>
            <p className="text-sm mb-4">
              The PDF file URL is not available or in an unexpected format.
            </p>
            <div className="text-xs bg-black/30 p-3 rounded mb-4 text-left">
              <strong>Debug Info:</strong>
              <br />
              File URL type: {typeof fileUrl}
              <br />
              File URL: {JSON.stringify(fileUrl)}
            </div>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                backgroundColor: "white",
                color: "#ef4444",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Close Viewer
            </button>
          </div>
        )}

        {isLoading && normalizedUrl && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
              textAlign: "center",
              zIndex: 5,
            }}
          >
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading PDF...</p>
          </div>
        )}

        {error && normalizedUrl && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "white",
              textAlign: "center",
              zIndex: 5,
              backgroundColor: "rgba(239, 68, 68, 0.9)",
              padding: "20px",
              borderRadius: "8px",
              maxWidth: "400px",
            }}
          >
            <FileText size={48} className="mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to Load PDF</h3>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={handleDownload}
              style={{
                padding: "8px 16px",
                backgroundColor: "white",
                color: "#ef4444",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "600",
              }}
            >
              Try Download Instead
            </button>
          </div>
        )}

        {normalizedUrl && (
          <iframe
            src={`${normalizedUrl}#zoom=${zoom}`}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              borderRadius: isFullscreen ? "0" : "8px",
              backgroundColor: "white",
              boxShadow: isFullscreen ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              opacity: isLoading ? 0 : 1,
              transition: "opacity 0.3s ease",
            }}
            title={fileName}
            onLoad={handleLoad}
            onError={handleError}
          />
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}