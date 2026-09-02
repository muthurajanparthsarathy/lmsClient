"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  X, Download, ZoomIn, ZoomOut, Maximize, Minimize,
  FileText, HelpCircle, Check, ChevronRight, ChevronLeft,
  Sparkles, MessageCircle, BookOpen,
} from "lucide-react"
import NotesPanel from "./notes-panel"
import AnchorNoteIndicator, { hasAnchoredNotes } from "./AnchorNoteIndicator"
import { fetchNotesByResource, type Note } from "../../../../apiServices/notesPanelService"
import SummaryChat from "./summary-chat"
import AIChat from "./ai-chat"

// ─── KEYFRAME STYLES ──────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(14px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)    scale(1);    }
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.65} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  .ppt-viewer-resize-handle {
    width: 10px;
    flex-shrink: 0;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 6px;
    transition: background 0.15s;
    position: relative;
    z-index: 10;
  }
  .ppt-viewer-resize-handle::after {
    content: '';
    display: block;
    width: 2px;
    height: 48px;
    border-radius: 2px;
    background: rgba(0,0,0,0.1);
    transition: all 0.15s;
  }
  .ppt-viewer-resize-handle:hover { background: rgba(249,115,22,0.06); }
  .ppt-viewer-resize-handle:hover::after,
  .ppt-viewer-resize-handle.dragging::after {
    width: 3px;
    height: 56px;
    background: #F97316;
    box-shadow: 0 0 8px rgba(249,115,22,0.35);
  }
  .ppt-viewer-resize-handle-blue:hover { background: rgba(249,115,22,0.06); }
  .ppt-viewer-resize-handle-blue::after { background: rgba(0,0,0,0.1); }
  .ppt-viewer-resize-handle-blue:hover::after,
  .ppt-viewer-resize-handle-blue.dragging::after {
    width: 3px;
    height: 56px;
    background: #EA580C;
    box-shadow: 0 0 8px rgba(249,115,22,0.35);
  }

  .ppt-toolbar-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 6px 11px; border-radius: 9px; border: none; cursor: pointer;
    font-size: 12px; font-weight: 600; transition: all 0.15s;
    background: white; color: #4B5563;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.06);
    letter-spacing: 0.1px;
    white-space: nowrap;
  }
  .ppt-toolbar-btn:hover { background: #F9FAFB; box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.07); }
  .ppt-toolbar-btn:active { transform: scale(0.97); }
  .ppt-toolbar-btn.active-purple {
    background: linear-gradient(135deg,#F97316 0%,#EA580C 100%);
    color: white;
    box-shadow: 0 3px 10px rgba(249,115,22,0.4), 0 0 0 1px rgba(249,115,22,0.2);
  }
  .ppt-toolbar-btn.active-blue {
    background: linear-gradient(135deg,#F97316 0%,#EA580C 100%);
    color: white;
    box-shadow: 0 3px 10px rgba(249,115,22,0.4), 0 0 0 1px rgba(249,115,22,0.2);
  }
  .ppt-toolbar-btn.icon-only { padding: 6px 9px; }

  .panel-card {
    display: flex; flex-direction: column; overflow: hidden;
    background: white; border-radius: 14px; min-width: 0;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.05);
    animation: fadeIn 0.2s ease;
    transition: box-shadow 0.2s;
  }
  .panel-card:hover {
    box-shadow: 0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.06);
  }
  .panel-header-purple {
    background: linear-gradient(135deg,#faf5ff 0%,#f0f0ff 100%);
    border-bottom: 1px solid rgba(249,115,22,0.1);
  }
  .panel-header-blue {
    background: linear-gradient(135deg,#FFF7ED 0%,#FFEDD5 100%);
    border-bottom: 1px solid rgba(249,115,22,0.12);
  }
  .panel-header-neutral {
    background: linear-gradient(135deg,#FAFBFC 0%,#F3F4F6 100%);
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }

  .slide-page-input {
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
  .slide-page-input:focus { border-color: #F97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12); }
`

// ─── MCQ OVERLAY ──────────────────────────────────────────────────────────────
type FileMcqAnswer = {
  questionId: string
  questionTitle: string
  selectedChoice: string
  correctChoice: string
  isCorrect: boolean
}

function MCQDisplayOverlay({
  questions,
  pageNumber,
  onResume,
  onDismiss,
  onComplete,
}: {
  questions: any[]
  pageNumber: number
  onResume: () => void
  onDismiss: () => void
  onComplete?: (answers: FileMcqAnswer[]) => void
}) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(0)
  const [allDone, setAllDone] = useState(false)
  const collectedAnswers = useRef<FileMcqAnswer[]>([])

  const { questionTitle, options, explanation } = React.useMemo(() => {
    const q = questions[currentIdx]
    if (!q) return { questionTitle: "", options: [], explanation: "" }
    const inner = q.mcqQuestion || q
    const title = (inner.questionTitle || inner.mcqQuestionTitle || inner.title || "")
      .replace(/<[^>]*>/g, "").trim()
    const expl = inner.explanation || inner.mcqQuestionDescription || ""
    const raw: any[] = inner.options || inner.mcqQuestionOptions || []
    const opts = raw.map((opt: any) => {
      if (typeof opt.text === "string") return opt
      const chars = Object.entries(opt)
        .filter(([k]) => !isNaN(Number(k)))
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, v]) => v as string)
        .join("")
      return { ...opt, text: chars }
    })
    return { questionTitle: title, options: opts, explanation: expl }
  }, [questions, currentIdx])

  const isCorrect = submitted && selectedOption !== null && options[selectedOption]?.isCorrect

  const handleSubmit = () => {
    if (selectedOption === null) return
    const chosen = options[selectedOption]
    const correct = options.find((o: any) => o.isCorrect)
    collectedAnswers.current.push({
      questionId: questions[currentIdx]?._id || questions[currentIdx]?.id || '',
      questionTitle: questions[currentIdx]?.mcqQuestionTitle || questions[currentIdx]?.mcqQuestion?.mcqQuestionTitle || '',
      selectedChoice: chosen?.text || '',
      correctChoice: correct?.text || '',
      isCorrect: !!chosen?.isCorrect,
    })
    if (chosen?.isCorrect) setScore(s => s + 1)
    setSubmitted(true)
  }

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(i => i + 1)
      setSelectedOption(null)
      setSubmitted(false)
    } else {
      setAllDone(true)
      onComplete?.(collectedAnswers.current)
    }
  }

  if (!questions[currentIdx] && !allDone) return null

  if (allDone) {
    const pct = Math.round((score / questions.length) * 100)
    const passed = pct >= 60
    return (
      <div style={{ position:"absolute",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.35)",backdropFilter:"blur(6px)",borderRadius:"14px" }}>
        <div style={{ background:"white",borderRadius:"20px",width:"min(420px,92%)",padding:"40px",textAlign:"center",boxShadow:"0 24px 64px rgba(0,0,0,0.18)",border:"1px solid rgba(0,0,0,0.06)",animation:"slideUp 0.25s ease-out" }}>
          <div style={{ width:76,height:76,borderRadius:22,margin:"0 auto 20px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:34,background:passed?"#ECFDF5":"#FFFBEB",border:`2px solid ${passed?"#A7F3D0":"#FDE68A"}` }}>
            {passed ? "🎉" : "📚"}
          </div>
          <h2 style={{ fontSize:22,fontWeight:700,color:"#111827",marginBottom:6 }}>{passed ? "Great job!" : "Keep studying!"}</h2>
          <p style={{ color:"#6b7280",fontSize:13,marginBottom:24 }}>Slide {pageNumber} · {score} of {questions.length} correct</p>
          <div style={{ width:"100%",height:8,background:"#f3f4f6",borderRadius:99,marginBottom:24,overflow:"hidden" }}>
            <div style={{ height:"100%",borderRadius:99,width:`${pct}%`,background:passed?"linear-gradient(90deg,#10B981,#34D399)":"linear-gradient(90deg,#F59E0B,#FBBF24)",transition:"width 0.8s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
          <p style={{ fontSize:42,fontWeight:800,marginBottom:28,color:passed?"#059669":"#D97706" }}>{pct}%</p>
          <button onClick={onResume} style={{ width:"100%",padding:"14px",borderRadius:12,background:"linear-gradient(135deg,#F97316,#EA580C)",color:"white",border:"none",fontWeight:700,fontSize:14,cursor:"pointer",letterSpacing:"0.3px",boxShadow:"0 4px 14px rgba(249,115,22,0.35)" }}>
            Continue Reading →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position:"absolute",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.35)",backdropFilter:"blur(6px)",borderRadius:"14px" }}>
      <div style={{ background:"white",borderRadius:"20px",width:"min(540px,94%)",maxHeight:"88%",display:"flex",flexDirection:"column",boxShadow:"0 24px 64px rgba(0,0,0,0.18)",overflow:"hidden",border:"1px solid rgba(0,0,0,0.06)",animation:"slideUp 0.25s ease-out" }}>
        <div style={{ padding:"16px 20px",background:"linear-gradient(135deg,#F97316 0%,#EA580C 100%)",color:"white",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:38,height:38,borderRadius:11,background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
              <HelpCircle size={17} />
            </div>
            <div>
              <p style={{ fontWeight:700,fontSize:13,margin:0 }}>Quiz · Slide {pageNumber}</p>
              <p style={{ fontSize:11,opacity:0.75,margin:0 }}>Question {currentIdx + 1} of {questions.length}</p>
            </div>
          </div>
          <div style={{ display:"flex",gap:5,flex:1,justifyContent:"center" }}>
            {questions.map((_, i) => (
              <div key={i} style={{ borderRadius:99,transition:"all 0.3s cubic-bezier(0.4,0,0.2,1)",
                width:i===currentIdx?20:7,height:7,
                background:i===currentIdx?"white":i<currentIdx?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.3)"
              }} />
            ))}
          </div>
          <button onClick={onDismiss} style={{ background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.2)",color:"white",borderRadius:8,fontSize:11,fontWeight:600,padding:"6px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:4,backdropFilter:"blur(4px)" }}>
            Skip <X size={11} />
          </button>
        </div>
        <div style={{ height:3,background:"#f3f4f6",flexShrink:0 }}>
          <div style={{ height:"100%",background:"linear-gradient(90deg,#F97316,#EA580C)",transition:"width 0.4s cubic-bezier(0.4,0,0.2,1)",width:`${(currentIdx/questions.length)*100}%` }} />
        </div>
        <div style={{ overflowY:"auto",padding:"24px 24px 0",flex:1 }}>
          <p style={{ fontSize:15,fontWeight:700,color:"#111827",lineHeight:1.6,marginBottom:20 }}>{questionTitle || "Untitled question"}</p>
          <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
            {options.map((opt: any, oi: number) => {
              let bg="white",border="1.5px solid #E5E7EB",textColor="#374151",labelBg="#F3F4F6",labelColor="#6b7280"
              if (submitted) {
                if (opt.isCorrect) { bg="#F0FDF4";border="1.5px solid #86EFAC";textColor="#166534";labelBg="#22C55E";labelColor="white" }
                else if (oi===selectedOption) { bg="#FEF2F2";border="1.5px solid #FCA5A5";textColor="#991B1B";labelBg="#EF4444";labelColor="white" }
              } else if (oi===selectedOption) { bg="#FFF7ED";border="1.5px solid #FED7AA";textColor="#9A3412";labelBg="#F97316";labelColor="white" }
              return (
                <button key={oi} disabled={submitted} onClick={() => setSelectedOption(oi)}
                  style={{ width:"100%",textAlign:"left",padding:"12px 14px",borderRadius:12,border,background:bg,color:textColor,cursor:submitted?"default":"pointer",display:"flex",alignItems:"center",gap:12,transition:"all 0.15s" }}>
                  <span style={{ width:30,height:30,borderRadius:"50%",background:labelBg,color:labelColor,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0,transition:"all 0.15s" }}>
                    {String.fromCharCode(65+oi)}
                  </span>
                  <span style={{ fontSize:13,flex:1,fontWeight:oi===selectedOption?600:400,lineHeight:1.5 }}>{opt.text||"(empty)"}</span>
                  {submitted && opt.isCorrect && <Check size={15} style={{ color:"#22C55E",flexShrink:0 }} />}
                  {submitted && oi===selectedOption && !opt.isCorrect && <X size={15} style={{ color:"#EF4444",flexShrink:0 }} />}
                </button>
              )
            })}
          </div>
          {submitted && explanation && (
            <div style={{ marginTop:16,padding:"13px 15px",background:"#FFFBEB",borderRadius:12,border:"1px solid #FDE68A",display:"flex",gap:10,alignItems:"flex-start" }}>
              <span style={{ fontSize:16,flexShrink:0,marginTop:1 }}>💡</span>
              <p style={{ fontSize:12,color:"#92400E",lineHeight:1.6,margin:0 }}>{explanation}</p>
            </div>
          )}
          {submitted && (
            <div style={{ marginTop:12,padding:"11px 15px",borderRadius:12,display:"flex",alignItems:"center",gap:8,background:isCorrect?"#F0FDF4":"#FEF2F2",border:`1px solid ${isCorrect?"#86EFAC":"#FCA5A5"}` }}>
              <span style={{ fontSize:18 }}>{isCorrect?"✅":"❌"}</span>
              <span style={{ fontSize:13,fontWeight:700,color:isCorrect?"#166534":"#991B1B" }}>
                {isCorrect?"Correct! Well done.":"Incorrect — check the highlighted answer above."}
              </span>
            </div>
          )}
          <div style={{ height:22 }} />
        </div>
        <div style={{ padding:"14px 24px",borderTop:"1px solid #F3F4F6",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#FAFAFA",flexShrink:0 }}>
          <span style={{ fontSize:12,color:"#9ca3af",fontWeight:500 }}>Score: {score}/{currentIdx+(submitted?1:0)}</span>
          {!submitted ? (
            <button onClick={handleSubmit} disabled={selectedOption===null}
              style={{ padding:"10px 28px",borderRadius:10,fontSize:13,fontWeight:700,border:"none",cursor:selectedOption!==null?"pointer":"not-allowed",
                background:selectedOption!==null?"linear-gradient(135deg,#F97316,#EA580C)":"#E5E7EB",
                color:selectedOption!==null?"white":"#9ca3af",
                boxShadow:selectedOption!==null?"0 4px 14px rgba(249,115,22,0.3)":"none",
                transition:"all 0.18s",
              }}>
              Submit Answer
            </button>
          ) : (
            <button onClick={handleNext}
              style={{ padding:"10px 28px",borderRadius:10,fontSize:13,fontWeight:700,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#F97316,#EA580C)",color:"white",boxShadow:"0 4px 14px rgba(249,115,22,0.3)",transition:"all 0.15s" }}>
              {currentIdx<questions.length-1?"Next Question →":"See Results →"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── PROPS ────────────────────────────────────────────────────────────────────
interface PPTViewerProps {
  pptUrl: string
  slideImages?: string[]       // array of image URLs, one per slide
  title?: string
  onClose: () => void
  initialMcqs?: any[]
  aiChatEnabled?: boolean
  aiSummaryEnabled?: boolean
  notesEnabled?: boolean
  hierarchy?: string[]
  currentItemTitle?: string
  onNotesClick?: () => void
  showNotesPanel?: boolean
  onNotesStateChange?: (isOpen: boolean) => void
  onBreadcrumbNavigate?: (crumb: string, index: number) => void
  // Progress-tracking props (mirrors pdf-viewer)
  fileId?: string
  entityType?: string
  entityId?: string
  tabType?: string
  subcategory?: string
  folderPath?: string[]
  apiBaseUrl?: string
  courseId?: string
}

// ─── TOOLBAR BUTTON ───────────────────────────────────────────────────────────
function ToolbarBtn({
  children,
  onClick,
  active,
  activeClass = "active-purple",
  className = "",
  title,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  activeClass?: string
  className?: string
  title?: string
  disabled?: boolean
}) {
  return (
    <button
      className={`ppt-toolbar-btn${active ? " " + activeClass : ""}${className ? " " + className : ""}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

// ─── PANEL HEADER ─────────────────────────────────────────────────────────────
function PanelHeader({
  children,
  bgClass,
  onClose,
}: {
  children: React.ReactNode
  bgClass: string
  onClose?: () => void
}) {
  return (
    <div className={`panel-header ${bgClass}`} style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",flexShrink:0,borderRadius:"14px 14px 0 0" }}>
      {children}
      {onClose && (
        <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:"#9ca3af",display:"flex",padding:5,borderRadius:7,transition:"all 0.15s" }}
          onMouseEnter={e => { (e.currentTarget.style.background="#f3f4f6"); (e.currentTarget.style.color="#6b7280") }}
          onMouseLeave={e => { (e.currentTarget.style.background="none"); (e.currentTarget.style.color="#9ca3af") }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

// ─── LAYOUT CONSTANTS ─────────────────────────────────────────────────────────
const PDF_MIN_FLEX = 35
const SIDE_MIN_FLEX = 18
const GAP = 10

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PPTViewer({
  pptUrl,
  slideImages,
  title = "Presentation",
  onClose,
  initialMcqs = [],
  // Off by default, matching pdf-viewer: a caller that doesn't know the
  // course's Resource Type config must not surface features the course may
  // never have enabled.
  aiChatEnabled = false,
  aiSummaryEnabled = false,
  notesEnabled = false,
  hierarchy = [],
  currentItemTitle = "",
  onNotesClick,
  showNotesPanel = false,
  onNotesStateChange,
  onBreadcrumbNavigate,
  fileId = "",
  entityType = "",
  entityId = "",
  tabType = "",
  subcategory = "",
  folderPath = [],
  apiBaseUrl = "http://localhost:5533",
  courseId,
}: PPTViewerProps) {
  const [autoSlideImages, setAutoSlideImages] = useState<string[]>(slideImages ?? [])
  const [autoConverting, setAutoConverting] = useState(false)
  const [autoConvertError, setAutoConvertError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const autoCache = useRef<Record<string, string[]>>({})

  const effectiveSlides = autoSlideImages.length > 0 ? autoSlideImages : (slideImages ?? [])
  const totalSlides = effectiveSlides.length
  const safeSlideImages = effectiveSlides
  const useImageMode = totalSlides > 0

  // Auto-convert when opened with a pptUrl and no slideImages provided
  useEffect(() => {
    if ((slideImages ?? []).length > 0) return // already have images
    if (!pptUrl) return

    if (autoCache.current[pptUrl]) {
      setAutoSlideImages(autoCache.current[pptUrl])
      return
    }

    let cancelled = false
    setAutoConverting(true)
    setAutoConvertError(null)

    ;(async () => {
      try {
        const res = await fetch('http://localhost:5533/api/ppt/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pptUrl }),
        })
        const data = await res.json()
        if (cancelled) return
        if (data.success && data.slideImages?.length > 0) {
          autoCache.current[pptUrl] = data.slideImages
          setAutoSlideImages(data.slideImages)
        } else {
          setAutoConvertError(data.error || 'Conversion failed')
        }
      } catch (err: any) {
        if (!cancelled) setAutoConvertError(err.message)
      } finally {
        if (!cancelled) setAutoConverting(false)
      }
    })()

    return () => { cancelled = true }
  }, [pptUrl, retryCount])

  // ── Viewer state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(1)
  const [pageInput, setPageInput] = useState("1")
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [slideScale, setSlideScale] = useState(1.2)
  const [showNavConfirm, setShowNavConfirm] = useState(false)
  const [pendingNavCrumb, setPendingNavCrumb] = useState<{ crumb: string; index: number } | null>(null)

  // ── Iframe fallback state (used when no slideImages)
  const [iframeLoading, setIframeLoading] = useState(true)
  const [iframeError, setIframeError] = useState<string | null>(null)
  const [useGoogleViewer, setUseGoogleViewer] = useState(false)
  const isDirectPPT = /\.(ppt|pptx|pps|ppsx)$/i.test(pptUrl)
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(pptUrl)}`
  const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(pptUrl)}&embedded=true`
  const iframeUrl = useGoogleViewer ? googleViewerUrl : officeViewerUrl

  // ── Panel visibility
  const [aiOpen, setAiOpen] = useState(false)
  const [aiTab, setAiTab] = useState<"chat" | "summary">("chat")
  const [notesOpen, setNotesOpen] = useState(false)
  const [shouldLoadSavedNote, setShouldLoadSavedNote] = useState(false)

  // ── Anchored notes (contextual, per-slide)
  const [resourceNotes, setResourceNotes] = useState<Note[]>([])
  const [pendingFilterNoteId, setPendingFilterNoteId] = useState<string | null>(null)
  const [notesVersion, setNotesVersion] = useState(0)
  useEffect(() => {
    if (!fileId) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('smartcliff_token') : null
    if (!token) return
    let cancelled = false
    fetchNotesByResource(fileId, 'ppt', token).then(list => {
      if (!cancelled) setResourceNotes(list)
    })
    return () => { cancelled = true }
  }, [fileId, notesVersion])
  const notesWasOpen = useRef(false)
  useEffect(() => {
    if (notesWasOpen.current && !notesOpen && fileId) setNotesVersion(v => v + 1)
    notesWasOpen.current = notesOpen
  }, [notesOpen, fileId])

  // ── Flex values for side panels
  const [aiFlex, setAiFlex] = useState(30)
  const [notesFlex, setNotesFlex] = useState(30)

  // ── Drag state
  const draggingRef = useRef<"left" | "right" | null>(null)
  const dragStartXRef = useRef(0)
  const dragStartFlexesRef = useRef<{ ai: number; notes: number }>({ ai: 30, notes: 30 })
  const [draggingHandle, setDraggingHandle] = useState<"left" | "right" | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const panelsRowRef = useRef<HTMLDivElement>(null)

  const showAIButton = aiChatEnabled || aiSummaryEnabled
  const showNotesButton = notesEnabled

  // ── Progress saving (mirrors pdf-viewer exactly) ──────────────────────────────
  const getAuthHeader = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("smartcliff_token") : null
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const saveProgress = async (extra?: { attendedPageNumber?: number; answers?: FileMcqAnswer[] }) => {
    if (!fileId || !entityType || !entityId || !tabType || !subcategory) return
    try {
      const { answers: mcqAnswers, ...restExtra } = extra || {}
      await fetch(`${apiBaseUrl}/student-file-progress/${entityType}/${entityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          tabType, subcategory, folderPath, fileId,
          fileName: title,
          highestPageReached: currentSlide,
          totalPages: totalSlides || 0,
          courseId,
          ...(mcqAnswers?.length ? { answers: mcqAnswers } : {}),
          ...restExtra,
        }),
      })
    } catch {}
  }

  // Load attempted slides on mount so we don't re-trigger already-answered quizzes
  useEffect(() => {
    if (!fileId || !entityType || !entityId || !tabType || !subcategory) return
    fetch(
      `${apiBaseUrl}/student-file-progress/${entityType}/${entityId}?tabType=${encodeURIComponent(tabType)}&subcategory=${encodeURIComponent(subcategory)}&folderPath=${encodeURIComponent(JSON.stringify(folderPath))}&fileId=${encodeURIComponent(fileId)}`,
      { headers: getAuthHeader() }
    )
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data?.attemptedPages?.length) return
        json.data.attemptedPages.forEach((p: number) => triggeredSlides.current.add(p))
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, entityType, entityId])

  // ── MCQ setup
  const mcqQuestions = React.useMemo(() => (initialMcqs || []).filter((q: any) => q.isActive !== false), [initialMcqs])
  const getMcqSlide = (q: any): number => {
    const raw = q.videoTimestamp ?? q.pageNumber ?? q.timestamp ?? q.slideNumber ?? 0
    return typeof raw === "number" ? Math.round(raw) : parseInt(String(raw)) || 0
  }
  const slidesWithMcqs = new Set(mcqQuestions.map((q: any) => getMcqSlide(q)))
  const [activeMcqGroup, setActiveMcqGroup] = useState<{ slide: number; questions: any[] } | null>(null)
  const triggeredSlides = useRef<Set<number>>(new Set())

  // ── Compute layout
  const computeLayout = useCallback(() => {
    const ai = aiOpen ? aiFlex : 0
    const notes = notesOpen ? notesFlex : 0
    const rawPdf = 100 - ai - notes
    const pdfFlex = Math.max(PDF_MIN_FLEX, rawPdf)
    if (rawPdf < PDF_MIN_FLEX && (ai > 0 || notes > 0)) {
      const available = 100 - PDF_MIN_FLEX
      const sideTotal = ai + notes
      const scale = sideTotal > 0 ? available / sideTotal : 1
      return { pdfFlex, aiFlexActual: ai * scale, notesFlexActual: notes * scale }
    }
    return { pdfFlex, aiFlexActual: ai, notesFlexActual: notes }
  }, [aiOpen, aiFlex, notesOpen, notesFlex])

  // ── Navigate to a slide (clamped)
  const goToSlide = useCallback((n: number) => {
    const clamped = Math.max(1, Math.min(totalSlides || 1, n))
    setCurrentSlide(clamped)
    setPageInput(String(clamped))
    setImgLoaded(false)
    setImgError(false)
  }, [totalSlides])

  // ── Keep pageInput in sync when slide changes via keyboard/buttons
  useEffect(() => {
    setPageInput(String(currentSlide))
  }, [currentSlide])

  // ── Preload adjacent slides so flips are instant
  useEffect(() => {
    if (!useImageMode) return
    for (const idx of [currentSlide, currentSlide - 2]) {
      if (idx < 0 || idx >= safeSlideImages.length) continue
      const url = safeSlideImages[idx]
      if (!url) continue
      const img = new window.Image()
      img.src = url
    }
  }, [currentSlide, useImageMode, safeSlideImages])

  // ── Reset on new slideImages
  useEffect(() => {
    setCurrentSlide(1)
    setPageInput("1")
    setImgLoaded(false)
    setImgError(false)
    triggeredSlides.current.clear()
  }, [slideImages])

  // ── MCQ trigger on slide change
  useEffect(() => {
    if (activeMcqGroup) return
    const slideQuestions = mcqQuestions.filter(q => getMcqSlide(q) === currentSlide)
    if (slideQuestions.length > 0 && !triggeredSlides.current.has(currentSlide)) {
      triggeredSlides.current.add(currentSlide)
      setActiveMcqGroup({ slide: currentSlide, questions: slideQuestions })
    }
  }, [currentSlide, mcqQuestions, activeMcqGroup])

  // ── Page input handlers
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value)
  }

  const commitPageInput = () => {
    const n = parseInt(pageInput, 10)
    if (!isNaN(n)) goToSlide(n)
    else setPageInput(String(currentSlide))
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.currentTarget.blur(); commitPageInput() }
    if (e.key === "Escape") { setPageInput(String(currentSlide)); e.currentTarget.blur() }
  }

  // ── Download
  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = pptUrl
    link.download = title || "presentation.pptx"
    link.click()
  }

  // ── Fullscreen
  const handleFullscreen = async () => {
    if (!containerRef.current) return
    try {
      if (!isFullscreen) await containerRef.current.requestFullscreen()
      else await document.exitFullscreen()
      setIsFullscreen(!isFullscreen)
    } catch { }
  }

  // ── Zoom (works correctly on <img>)
  const handleZoomIn  = () => setSlideScale(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setSlideScale(prev => Math.max(prev - 0.25, 0.5))

  // ── Panel toggles
  const handleAIToggle = () => setAiOpen(prev => !prev)
  const handleAITabChange = (tab: "chat" | "summary") => { setAiTab(tab); setAiOpen(true) }
  const handleNotesToggle = () => {
    const next = !notesOpen
    setNotesOpen(next)
    onNotesClick?.()
    onNotesStateChange?.(next)
  }

  // ── Resize handles
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
        const maxAi = 100 - (notesOpen ? Math.max(SIDE_MIN_FLEX, notes) : 0) - PDF_MIN_FLEX
        setAiFlex(Math.max(SIDE_MIN_FLEX, Math.min(maxAi, ai + dFlex)))
      }
      if (draggingRef.current === "right" && notesOpen) {
        const maxNotes = 100 - (aiOpen ? Math.max(SIDE_MIN_FLEX, ai) : 0) - PDF_MIN_FLEX
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
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
  }, [aiOpen, notesOpen, aiFlex, notesFlex])

  // ── Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeMcqGroup) return
      if ((e.target as HTMLElement).tagName === "INPUT") return
      if (e.key === "Escape" && isFullscreen) document.exitFullscreen?.()
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goToSlide(currentSlide + 1) }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); goToSlide(currentSlide - 1) }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [activeMcqGroup, isFullscreen, currentSlide, goToSlide])

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", fn)
    return () => document.removeEventListener("fullscreenchange", fn)
  }, [])

  // ── Notes event
  useEffect(() => {
    const handleForceOpenNotes = () => {
      // Notes off for this resource type → the panel stays shut no matter who
      // asks. The toolbar button is already hidden; this closes the other way in.
      if (!notesEnabled) return
      setNotesOpen(true)
      onNotesStateChange?.(true)
      const savedNote = localStorage.getItem("lastCreatedNote")
      if (savedNote) { setShouldLoadSavedNote(true); setTimeout(() => setShouldLoadSavedNote(false), 500) }
    }
    window.addEventListener("force-open-notes-in-viewer", handleForceOpenNotes)
    return () => window.removeEventListener("force-open-notes-in-viewer", handleForceOpenNotes)
  }, [onNotesStateChange, notesEnabled])

  useEffect(() => { setNotesOpen(notesEnabled) }, [showNotesPanel, notesEnabled])

  const { pdfFlex, aiFlexActual, notesFlexActual } = computeLayout()
  const currentImageUrl = safeSlideImages[currentSlide - 1]

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
        {/* ── TOP TOOLBAR ──────────────────────────────────────────────────── */}
        {!isFullscreen && (
          <div style={{ display:"flex", alignItems:"center", padding:"10px 12px 0 12px", gap:8, flexShrink:0 }}>

            {/* Breadcrumbs */}
            <div style={{ display:"flex",alignItems:"center",gap:4,flex:1,minWidth:0,overflow:"hidden" }}>
              <div style={{ width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
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
                      {idx < hierarchy.length - 1 && <ChevronRight size={12} style={{ color:"#9ca3af",flexShrink:0 }} />}
                    </React.Fragment>
                  ))}
                  <ChevronRight size={12} style={{ color:"#9ca3af",flexShrink:0 }} />
                  <span style={{ fontSize:12,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:200,flexShrink:0 }}>{title}</span>
                </>
              ) : (
                <span style={{ fontSize:12,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{title}</span>
              )}
            </div>

            {/* Right actions */}
            <div style={{ display:"flex",alignItems:"center",gap:6,flexShrink:0 }}>
              {showAIButton && (
                <ToolbarBtn onClick={handleAIToggle} active={aiOpen} activeClass="active-purple">
                  <Sparkles size={12} /> AI Assistant
                </ToolbarBtn>
              )}
              {showNotesButton && (
                <ToolbarBtn onClick={handleNotesToggle} active={notesOpen} activeClass="active-blue">
                  <BookOpen size={12} /> Notes
                </ToolbarBtn>
              )}

              <div style={{ width:1,height:22,background:"rgba(0,0,0,0.1)" }} />

              {/* <ToolbarBtn onClick={handleDownload}>
                <Download size={12} /> Download
              </ToolbarBtn> */}
              <ToolbarBtn onClick={handleFullscreen} className="icon-only" title="Toggle fullscreen">
                <Maximize size={13} />
              </ToolbarBtn>
              <button
                onClick={onClose}
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
          {/* LEFT: AI Panel */}
          {aiOpen && showAIButton && (
            <>
              <div className="panel-card" style={{ flex:aiFlexActual, transition:"flex 0.05s", minWidth:180 }}>
                <PanelHeader bgClass="panel-header-purple" onClose={handleAIToggle}>
                  <div style={{ display:"flex",alignItems:"center",gap:4 }}>
                    <div style={{ width:26,height:26,borderRadius:8,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      <Sparkles size={12} style={{ color:"white" }} />
                    </div>
                    {aiChatEnabled && (
                      <button onClick={() => handleAITabChange("chat")} style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,transition:"all 0.15s",background:aiTab==="chat"?"white":"transparent",color:aiTab==="chat"?"#F97316":"#6b7280",boxShadow:aiTab==="chat"?"0 1px 4px rgba(249,115,22,0.15)":"none" }}>
                        <MessageCircle size={11} /> Chat
                      </button>
                    )}
                    {aiSummaryEnabled && (
                      <button onClick={() => handleAITabChange("summary")} style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:12,fontWeight:600,transition:"all 0.15s",background:aiTab==="summary"?"white":"transparent",color:aiTab==="summary"?"#F97316":"#6b7280",boxShadow:aiTab==="summary"?"0 1px 4px rgba(249,115,22,0.15)":"none" }}>
                        <FileText size={11} /> Summary
                      </button>
                    )}
                  </div>
                </PanelHeader>
                <div style={{ flex:1,overflow:"hidden",position:"relative" }}>
                  {aiTab === "chat" && aiChatEnabled && (
                    <AIChat isOpen={true} embedded onClose={handleAIToggle}
                      context={{ topicTitle:currentItemTitle||title, fileName:title, fileType:"ppt", isDocumentView:true }}
                    />
                  )}
                  {aiTab === "summary" && aiSummaryEnabled && (
                    <SummaryChat isOpen={true} embedded
                      onClose={() => { if (aiTab==="summary") setAiOpen(false) }}
                      context={{ topicTitle:currentItemTitle||title, fileName:title, fileType:"ppt", isDocumentView:true, hierarchy:hierarchy.length>0?hierarchy:[title], pdfUrl:pptUrl, isPDF:false }}
                    />
                  )}
                </div>
              </div>
              <div className={`ppt-viewer-resize-handle${draggingHandle==="left"?" dragging":""}`} onMouseDown={e => startDrag("left", e)} style={{ margin:`0 ${GAP/2}px` }} />
            </>
          )}

          {/* CENTER: Slide Image Panel */}
          <div className="panel-card" style={{ flex:pdfFlex, minWidth:0, transition:"flex 0.05s", position:"relative" }}>
            {/* Contextual notes indicator — pinned to panel (not scrolled with slide) */}
            {notesEnabled && fileId && resourceNotes.length > 0 && (
              <AnchorNoteIndicator
                notes={resourceNotes}
                mode="page"
                currentValue={currentSlide}
                unitLabel="slide"
                onOpenPanel={(noteId) => {
                  const fallback = resourceNotes.find(n => n.anchor?.page === currentSlide)
                  setPendingFilterNoteId(noteId || fallback?._id || null)
                  setNotesOpen(true)
                  onNotesStateChange?.(true)
                }}
              />
            )}
            {/* Panel header — 3 columns */}
            <div className="panel-header-neutral" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",flexShrink:0,borderRadius:"14px 14px 0 0",gap:8 }}>
              {/* Left: filename */}
              <div style={{ display:"flex",alignItems:"center",gap:7,flex:1,minWidth:0 }}>
                <div style={{ width:22,height:22,borderRadius:6,background:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <FileText size={11} style={{ color:"#9ca3af" }} />
                </div>
                <span style={{ fontSize:12,fontWeight:600,color:"#6b7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{title}</span>
              </div>
              {/* Center: slide navigation */}
              <div style={{ display:"flex",alignItems:"center",gap:6,flexShrink:0 }}>
                <button
                  onClick={() => goToSlide(currentSlide - 1)}
                  disabled={!useImageMode||currentSlide<=1||!!activeMcqGroup}
                  style={{ background:"none",border:"1.5px solid currentColor",cursor:(!useImageMode||currentSlide<=1||!!activeMcqGroup)?"not-allowed":"pointer",color:(!useImageMode||currentSlide<=1)?"#D1D5DB":"#6b7280",display:"flex",alignItems:"center",padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,transition:"all 0.15s" }}
                >
                  Prev
                </button>
                {useImageMode && slidesWithMcqs.has(currentSlide) && (
                  <div style={{ width:7,height:7,borderRadius:"50%",background:"#F97316",boxShadow:"0 0 0 2px rgba(249,115,22,0.25)",flexShrink:0 }} title="Quiz on this slide" />
                )}
                <input
                  className="slide-page-input"
                  type="number"
                  min={1}
                  max={totalSlides||1}
                  value={pageInput}
                  onChange={handlePageInputChange}
                  onBlur={commitPageInput}
                  onKeyDown={handlePageInputKeyDown}
                  disabled={!useImageMode||!!activeMcqGroup}
                />
                <span style={{ fontSize:12,color:"#9ca3af",fontWeight:500 }}>/ {useImageMode?(totalSlides||"—"):"—"}</span>
                {notesEnabled && fileId && (() => {
                  const slideNotes = resourceNotes.filter(n => n.anchor?.page === currentSlide)
                  if (slideNotes.length === 0) return null
                  return (
                    <button
                      title={`${slideNotes.length} note${slideNotes.length>1?'s':''} on slide ${currentSlide} — click to open`}
                      onClick={() => { setPendingFilterNoteId(slideNotes[0]._id); setNotesOpen(true); onNotesStateChange?.(true) }}
                      style={{ display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,fontSize:10,fontWeight:700,color:"#EA580C",cursor:"pointer",animation:"pulse 2.5s infinite" }}
                    >
                      <span style={{ width:6,height:6,borderRadius:"50%",background:"#F97316" }} />
                      {slideNotes.length} note{slideNotes.length>1?'s':''}
                    </button>
                  )
                })()}
                <button
                  onClick={() => goToSlide(currentSlide + 1)}
                  disabled={!useImageMode||currentSlide>=totalSlides||!!activeMcqGroup}
                  style={{ background:"none",border:"1.5px solid currentColor",cursor:(!useImageMode||currentSlide>=totalSlides||!!activeMcqGroup)?"not-allowed":"pointer",color:(!useImageMode||currentSlide>=totalSlides)?"#D1D5DB":"#6b7280",display:"flex",alignItems:"center",padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,transition:"all 0.15s" }}
                >
                  Next
                </button>
                {activeMcqGroup && (
                  <span style={{ display:"flex",alignItems:"center",gap:4,padding:"3px 10px",background:"#F97316",borderRadius:8,fontSize:11,fontWeight:700,color:"white",animation:"pulse 2s infinite" }}>
                    <HelpCircle size={11} /> Quiz…
                  </span>
                )}
              </div>
              {/* Right: zoom + Google Viewer switch */}
              <div style={{ display:"flex",alignItems:"center",gap:2,flex:1,justifyContent:"flex-end" }}>
                <button onClick={handleZoomOut} disabled={slideScale<=0.5} style={{ background:"none",border:"none",cursor:slideScale<=0.5?"not-allowed":"pointer",color:slideScale<=0.5?"#D1D5DB":"#6b7280",display:"flex",padding:"3px 5px",borderRadius:6,transition:"all 0.15s" }}>
                  <ZoomOut size={13} />
                </button>
                <span style={{ fontSize:12,color:"#374151",minWidth:38,textAlign:"center",fontWeight:600 }}>{Math.round(slideScale*100)}%</span>
                <button onClick={handleZoomIn} disabled={slideScale>=3} style={{ background:"none",border:"none",cursor:slideScale>=3?"not-allowed":"pointer",color:slideScale>=3?"#D1D5DB":"#6b7280",display:"flex",padding:"3px 5px",borderRadius:6,transition:"all 0.15s" }}>
                  <ZoomIn size={13} />
                </button>
                {!useImageMode && !useGoogleViewer && isDirectPPT && iframeError && (
                  <button onClick={() => { setUseGoogleViewer(true); setIframeLoading(true); setIframeError(null) }}
                    style={{ fontSize:11,padding:"3px 8px",background:"#FEF3C7",color:"#D97706",borderRadius:20,border:"none",cursor:"pointer",marginLeft:6 }}>
                    Google
                  </button>
                )}
              </div>
            </div>

            {/* Slide display area */}
            <div style={{ flex:1, overflow:"auto", display:"flex", alignItems:"center", justifyContent:"center", padding:"18px 16px", background:"#EAECF0", borderRadius:"0 0 14px 14px", position:"relative" }}>

              {/* Auto-converting spinner */}
              {autoConverting && (
                <div style={{ textAlign:"center",padding:"48px 24px" }}>
                  <div style={{ width:56,height:56,border:"4px solid rgba(249,115,22,0.15)",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 0.75s linear infinite",margin:"0 auto 20px" }} />
                  <p style={{ fontSize:15,fontWeight:700,color:"#1f2937",marginBottom:6 }}>Converting presentation…</p>
                  <p style={{ fontSize:12,color:"#9ca3af",margin:0 }}>This may take 30–60 seconds on first load</p>
                </div>
              )}

              {/* Auto-convert error */}
              {autoConvertError && !autoConverting && (
                <div style={{ textAlign:"center",padding:"48px 24px",maxWidth:400 }}>
                  <div style={{ width:64,height:64,borderRadius:18,background:"#FEF2F2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
                    <FileText size={28} style={{ color:"#ef4444" }} />
                  </div>
                  <p style={{ fontWeight:700,color:"#1f2937",marginBottom:8,fontSize:15 }}>Conversion failed</p>
                  <p style={{ color:"#6b7280",fontSize:12,marginBottom:20,lineHeight:1.5 }}>{autoConvertError}</p>
                  <button
                    onClick={() => {
                      delete autoCache.current[pptUrl]
                      setAutoSlideImages([])
                      setAutoConvertError(null)
                      setRetryCount(c => c + 1)
                    }}
                    style={{ marginRight:10,padding:"10px 20px",background:"linear-gradient(135deg,#F97316,#EA580C)",color:"white",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:13 }}
                  >
                    Retry
                  </button>
                  <button onClick={handleDownload} style={{ padding:"10px 20px",background:"#4B5563",color:"white",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:13 }}>
                    Download instead
                  </button>
                </div>
              )}

              {/* Iframe fallback mode — only when not auto-converting and no error and no slide images */}
              {!useImageMode && !autoConverting && !autoConvertError && (
                <>
                  {iframeLoading && (
                    <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",zIndex:10 }}>
                      <div style={{ width:42,height:42,border:"3px solid rgba(249,115,22,0.15)",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 0.75s linear infinite",margin:"0 auto 14px" }} />
                      <p style={{ fontSize:13,color:"#6b7280",margin:0,fontWeight:500 }}>Loading presentation…</p>
                    </div>
                  )}
                  {iframeError && !iframeLoading && (
                    <div style={{ textAlign:"center",padding:"48px 24px" }}>
                      <div style={{ width:64,height:64,borderRadius:18,background:"#FEF2F2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
                        <FileText size={28} style={{ color:"#ef4444" }} />
                      </div>
                      <p style={{ fontWeight:700,color:"#1f2937",marginBottom:8,fontSize:15 }}>Could not load presentation</p>
                      <p style={{ color:"#6b7280",fontSize:12,marginBottom:20,lineHeight:1.5 }}>{iframeError}</p>
                      {!useGoogleViewer && isDirectPPT && (
                        <button onClick={() => { setUseGoogleViewer(true); setIframeLoading(true); setIframeError(null) }}
                          style={{ marginRight:12,padding:"10px 20px",background:"linear-gradient(135deg,#F97316,#EA580C)",color:"white",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:13 }}>
                          Switch to Google Viewer
                        </button>
                      )}
                      <button onClick={handleDownload} style={{ padding:"10px 20px",background:"#4B5563",color:"white",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:13 }}>
                        Download instead
                      </button>
                    </div>
                  )}
                  {!iframeError && (
                    <div style={{ width:"100%",height:"100%",minHeight:400,background:"white",borderRadius:8,overflow:"hidden",boxShadow:"0 6px 24px rgba(0,0,0,0.12)" }}>
                      <iframe
                        key={iframeUrl}
                        src={iframeUrl}
                        title={title}
                        style={{ width:"100%",height:"100%",border:"none",background:"white" }}
                        allow="fullscreen"
                        onLoad={() => { setIframeLoading(false); setIframeError(null) }}
                        onError={() => {
                          setIframeLoading(false)
                          setIframeError(!useGoogleViewer && isDirectPPT
                            ? "Office Online viewer failed. Try switching to Google Viewer."
                            : "Unable to load presentation. Please download the file.")
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Slide image */}
              {totalSlides > 0 && currentImageUrl && (
                <div
                  style={{
                    display:"flex", alignItems:"center", justifyContent:"center",
                    width:"100%", height:"100%",
                  }}
                >
                  <div
                    style={{
                      transform: `scale(${slideScale})`,
                      transformOrigin: "center center",
                      transition: "transform 0.2s ease",
                      boxShadow: "0 6px 32px rgba(0,0,0,0.18)",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "white",
                      display: "inline-flex",
                    }}
                  >
                    {/* Loading spinner while image loads */}
                    {!imgLoaded && !imgError && (
                      <div style={{ width:640, height:480, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, background:"white" }}>
                        <div style={{ width:40,height:40,border:"3px solid rgba(249,115,22,0.15)",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 0.75s linear infinite" }} />
                        <p style={{ fontSize:13,color:"#6b7280",margin:0,fontWeight:500 }}>Loading slide {currentSlide}…</p>
                      </div>
                    )}

                    {/* Error state */}
                    {imgError && (
                      <div style={{ width:640,height:480,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,background:"white" }}>
                        <FileText size={32} style={{ color:"#ef4444" }} />
                        <p style={{ fontSize:13,color:"#6b7280",margin:0 }}>Failed to load slide {currentSlide}</p>
                      </div>
                    )}

                    <img
                      key={currentImageUrl}
                      src={currentImageUrl}
                      alt={`Slide ${currentSlide}`}
                      onLoad={() => { setImgLoaded(true); setImgError(false) }}
                      onError={() => { setImgLoaded(true); setImgError(true) }}
                      style={{
                        display: imgLoaded && !imgError ? "block" : "none",
                        maxWidth: "100%",
                        maxHeight: "calc(100vh - 180px)",
                        width: "auto",
                        height: "auto",
                        userSelect: "none",
                        draggable: false,
                      } as React.CSSProperties}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* MCQ overlay */}
            {activeMcqGroup && (
              <MCQDisplayOverlay
                questions={activeMcqGroup.questions}
                pageNumber={activeMcqGroup.slide}
                onResume={() => setActiveMcqGroup(null)}
                onDismiss={() => setActiveMcqGroup(null)}
                onComplete={(answers) => saveProgress({ attendedPageNumber: activeMcqGroup.slide, answers })}
              />
            )}
          </div>

          {/* RIGHT: Notes Panel */}
          {notesOpen && notesEnabled && (
            <>
              <div className={`ppt-viewer-resize-handle ppt-viewer-resize-handle-blue${draggingHandle==="right"?" dragging":""}`} onMouseDown={e => startDrag("right", e)} style={{ margin:`0 ${GAP/2}px` }} />
              <div className="panel-card" style={{ flex:notesFlexActual, transition:"flex 0.05s", minWidth:180 }}>
                <PanelHeader bgClass="panel-header-blue" onClose={() => { setNotesOpen(false); onNotesStateChange?.(false) }}>
                  <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                    <div style={{ width:26,height:26,borderRadius:8,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      <BookOpen size={12} style={{ color:"white" }} />
                    </div>
                    <span style={{ fontSize:13,fontWeight:700,color:"#9A3412" }}>Notes</span>
                  </div>
                </PanelHeader>
                <div style={{ flex:1, overflow:"hidden" }}>
                  <NotesPanel
                    isOpen={true}
                    onClose={() => { setNotesOpen(false); onNotesStateChange?.(false) }}
                    isDraggable={false}
                    initialNoteData={shouldLoadSavedNote ? localStorage.getItem("lastCreatedNote") : null}
                    resourceContext={fileId ? {
                      resourceId: fileId,
                      resourceType: 'ppt',
                      currentAnchor: { page: currentSlide },
                      onJumpTo: (a) => { if (a.page != null) goToSlide(a.page) },
                      onNotesChanged: () => setNotesVersion(v => v + 1),
                    } : null}
                    filterNoteId={pendingFilterNoteId}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Fullscreen exit */}
        {isFullscreen && (
          <button onClick={() => document.exitFullscreen?.()}
            style={{ position:"fixed",top:16,right:16,zIndex:2100,display:"flex",alignItems:"center",gap:6,padding:"9px 18px",background:"rgba(0,0,0,0.7)",color:"white",border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,cursor:"pointer",fontSize:13,fontWeight:600,backdropFilter:"blur(8px)" }}
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
                    onClose()
                  }}
                  style={{ padding:"9px 20px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#F97316,#EA580C)",color:"white",fontSize:13,fontWeight:600,cursor:"pointer",transition:"all 0.15s",boxShadow:"0 4px 12px rgba(249,115,22,0.3)" }}
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
