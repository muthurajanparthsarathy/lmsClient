"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  X, Download, ZoomIn, ZoomOut, Maximize, Minimize,
  FileText, HelpCircle, Check, ChevronRight, ChevronLeft,
  Sparkles, MessageCircle, Menu, BookOpen, Book,
} from "lucide-react"
import NotesPanel from "./notes-panel"
import SummaryChat from "./summary-chat"
import AIChat from "./ai-chat"
import AnchorNoteIndicator, { hasAnchoredNotes } from "./AnchorNoteIndicator"
import { fetchNotesByResource, type Note } from "../../../../apiServices/notesPanelService"
import {
  useLessonGlossary,
  useLessonWords,
  GlossaryLayer,
  DictionaryLayer,
  GlossaryPopup,
  type GlossarySelection,
} from "./glossary-overlay"

// ─── KEYFRAME STYLES ──────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slideUp {
    from { opacity:0; transform:translateY(14px) scale(0.97); }
    to   { opacity:1; transform:translateY(0)    scale(1);    }
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.65} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }

  .pdf-viewer-resize-handle {
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
  .pdf-viewer-resize-handle::after {
    content: '';
    display: block;
    width: 2px;
    height: 48px;
    border-radius: 2px;
    background: rgba(0,0,0,0.1);
    transition: all 0.15s;
  }
  .pdf-viewer-resize-handle:hover { background: rgba(249,115,22,0.06); }
  .pdf-viewer-resize-handle:hover::after,
  .pdf-viewer-resize-handle.dragging::after {
    width: 3px;
    height: 56px;
    background: #F97316;
    box-shadow: 0 0 8px rgba(249,115,22,0.35);
  }
  .pdf-viewer-resize-handle-blue:hover { background: rgba(249,115,22,0.06); }
  .pdf-viewer-resize-handle-blue::after { background: rgba(0,0,0,0.1); }
  .pdf-viewer-resize-handle-blue:hover::after,
  .pdf-viewer-resize-handle-blue.dragging::after {
    width: 3px;
    height: 56px;
    background: #F97316;
    box-shadow: 0 0 8px rgba(249,115,22,0.35);
  }

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
  .pdf-toolbar-btn.active-purple {
    background: linear-gradient(135deg,#F97316 0%,#EA580C 100%);
    color: white;
    box-shadow: 0 3px 10px rgba(249,115,22,0.4), 0 0 0 1px rgba(249,115,22,0.2);
  }
  .pdf-toolbar-btn.active-blue {
    background: linear-gradient(135deg,#F97316 0%,#EA580C 100%);
    color: white;
    box-shadow: 0 3px 10px rgba(249,115,22,0.4), 0 0 0 1px rgba(249,115,22,0.2);
  }
  .pdf-toolbar-btn.icon-only { padding: 6px 9px; }
  .pdf-toolbar-btn.danger {
    background: #FEF2F2; color: #DC2626;
    box-shadow: 0 1px 2px rgba(220,38,38,0.08), 0 0 0 1px rgba(220,38,38,0.1);
  }
  .pdf-toolbar-btn.danger:hover { background: #FEE2E2; }

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
    background: #ffffff;
    border-bottom: 1px solid rgba(0,0,0,0.08);
  }
  .panel-header-blue {
    background: linear-gradient(135deg,#FFF7ED 0%,#FFEDD5 100%);
    border-bottom: 1px solid rgba(249,115,22,0.14);
  }
  .panel-header-neutral {
    background: linear-gradient(135deg,#FAFBFC 0%,#F3F4F6 100%);
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }

  .page-skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
  }

  .pdf-page-input {
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
  .pdf-page-input:focus { border-color: #F97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.12); }
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
          <p style={{ color:"#6b7280",fontSize:13,marginBottom:24 }}>Page {pageNumber} · {score} of {questions.length} correct</p>
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
        {/* Header */}
        <div style={{ padding:"16px 20px",background:"linear-gradient(135deg,#F97316 0%,#EA580C 100%)",color:"white",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:38,height:38,borderRadius:11,background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)" }}>
              <HelpCircle size={17} />
            </div>
            <div>
              <p style={{ fontWeight:700,fontSize:13,margin:0 }}>Quiz · Page {pageNumber}</p>
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
        {/* Progress bar */}
        <div style={{ height:3,background:"#f3f4f6",flexShrink:0 }}>
          <div style={{ height:"100%",background:"linear-gradient(90deg,#F97316,#EA580C)",transition:"width 0.4s cubic-bezier(0.4,0,0.2,1)",width:`${(currentIdx/questions.length)*100}%` }} />
        </div>
        {/* Body */}
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
        {/* Footer */}
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

// ─── SINGLE PAGE CANVAS ───────────────────────────────────────────────────────
function PdfPageCanvas({ pdfDoc, pageNum, scale, scrollRootRef, placeholderSize }: {
  pdfDoc: any
  pageNum: number
  scale: number
  scrollRootRef?: React.RefObject<HTMLDivElement | null>
  placeholderSize?: { width: number; height: number } | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placeholderRef = useRef<HTMLDivElement>(null)
  const taskRef = useRef<any>(null)
  // Lazy render: false until the page nears the viewport, then true forever.
  const [shouldRender, setShouldRender] = useState(false)

  useEffect(() => {
    if (shouldRender) return
    const el = placeholderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => { if (entries.some(e => e.isIntersecting)) setShouldRender(true) },
      { root: scrollRootRef?.current || null, rootMargin: "1500px 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [shouldRender, scrollRootRef])

  useEffect(() => {
    if (!shouldRender || !pdfDoc || !canvasRef.current) return
    let cancelled = false
    ;(async () => {
      if (taskRef.current) { try { taskRef.current.cancel() } catch {} taskRef.current = null }
      try {
        const page = await pdfDoc.getPage(pageNum)
        if (cancelled) return
        const vp = page.getViewport({ scale })
        const canvas = canvasRef.current!
        canvas.width = vp.width
        canvas.height = vp.height
        const task = page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp })
        taskRef.current = task
        await task.promise
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") console.error("page render error", e)
      }
    })()
    return () => { cancelled = true }
  }, [pdfDoc, pageNum, scale, shouldRender])

  if (!shouldRender) {
    return (
      <div
        ref={placeholderRef}
        className="page-skeleton"
        style={{
          width: placeholderSize?.width ?? 595 * scale,
          height: placeholderSize?.height ?? 842 * scale,
          maxWidth: "100%",
        }}
      />
    )
  }

  return <canvas ref={canvasRef} style={{ display:"block", maxWidth:"100%", height:"auto", borderRadius:8 }} />
}

// ─── PROPS ────────────────────────────────────────────────────────────────────
interface PDFViewerProps {
  fileUrl: string | { base: string }
  fileName: string
  fileId?: string
  entityType?: string
  entityId?: string
  tabType?: string
  subcategory?: string
  folderPath?: string[]
  apiBaseUrl?: string
  courseId?: string
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
}

// ─── TOOLBAR CHIP ─────────────────────────────────────────────────────────────
function ToolbarBtn({
  children,
  onClick,
  active,
  activeClass = "active-purple",
  className = "",
  title,
  disabled,
  style,
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  activeClass?: string
  className?: string
  title?: string
  disabled?: boolean
  style?: React.CSSProperties
}) {
  return (
    <button
      className={`pdf-toolbar-btn${active?" "+activeClass:""}${className?" "+className:""}`}
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={style}
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
export default function PDFViewer({
  fileUrl, fileName, onClose, initialMcqs = [],
  aiChatEnabled = false, aiSummaryEnabled = false, notesEnabled = false,
  hierarchy = [], currentItemTitle = "",
  onNotesClick, showNotesPanel, onNotesStateChange,
  onBreadcrumbNavigate,
  fileId, entityType, entityId, tabType, subcategory, folderPath = [],
  apiBaseUrl = "http://localhost:5533", courseId,
}: PDFViewerProps) {
  // ── Viewer state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInput, setPageInput] = useState("1")
  const [scale, setScale] = useState(1.4)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showNavConfirm, setShowNavConfirm] = useState(false)
  const [pendingNavCrumb, setPendingNavCrumb] = useState<{ crumb: string; index: number } | null>(null)

  // ── Panel visibility
  const [aiOpen, setAiOpen] = useState(false)
  const [aiTab, setAiTab] = useState<"chat"|"summary">("chat")
  const [notesOpen, setNotesOpen] = useState(false)
  const [shouldLoadSavedNote, setShouldLoadSavedNote] = useState(false)

  // ── Anchored notes (contextual notes tied to page number)
  const [resourceNotes, setResourceNotes] = useState<Note[]>([])
  const [pendingFilterNoteId, setPendingFilterNoteId] = useState<string | null>(null)
  const [notesVersion, setNotesVersion] = useState(0)   // bumped to force refetch after panel edits
  const notesResourceType: 'pdf' = 'pdf'
  useEffect(() => {
    if (!fileId) return
    const token = typeof window !== 'undefined' ? localStorage.getItem('smartcliff_token') : null
    if (!token) return
    let cancelled = false
    fetchNotesByResource(fileId, notesResourceType, token).then(list => {
      if (!cancelled) setResourceNotes(list)
    })
    return () => { cancelled = true }
  }, [fileId, notesVersion])
  // Refetch after the panel closes (user may have edited).
  const notesWasOpen = useRef(false)
  useEffect(() => {
    if (notesWasOpen.current && !notesOpen && fileId) {
      setNotesVersion(v => v + 1)
    }
    notesWasOpen.current = notesOpen
  }, [notesOpen, fileId])

  // ── Flex values for side panels
  const [aiFlex, setAiFlex] = useState(30)
  const [notesFlex, setNotesFlex] = useState(30)

  // ── Drag state
  const draggingRef = useRef<"left"|"right"|null>(null)
  const dragStartXRef = useRef(0)
  const dragStartFlexesRef = useRef<{ ai:number; notes:number }>({ ai:30, notes:30 })
  const [draggingHandle, setDraggingHandle] = useState<"left"|"right"|null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const panelsRowRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRefs = useRef<(HTMLDivElement|null)[]>([])

  const showAIButton = aiChatEnabled || aiSummaryEnabled
  const showNotesButton = notesEnabled

  // ── MCQ setup
  const mcqQuestions = React.useMemo(() => (initialMcqs||[]).filter((q:any) => q.isActive!==false), [])
  const getMcqPage = (q:any): number => {
    const raw = q.videoTimestamp ?? q.pageNumber ?? q.timestamp ?? 0
    return typeof raw==="number" ? Math.round(raw) : parseInt(String(raw))||0
  }
  const pagesWithMcqs = new Set(mcqQuestions.map((q:any) => getMcqPage(q)))
  const [activeMcqGroup, setActiveMcqGroup] = useState<{ page:number; questions:any[] }|null>(null)
  const triggeredPages = useRef<Set<number>>(new Set())

  // ── Progress tracking
  const [completionPct, setCompletionPct] = useState(0)
  const highestPageRef = useRef(0)
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const normalizedUrl = React.useMemo(() => {
    if (!fileUrl) return ""
    if (typeof fileUrl==="string") return fileUrl
    if (typeof fileUrl==="object" && (fileUrl as any).base) return (fileUrl as any).base
    if (typeof fileUrl==="object") {
      return (Object.values(fileUrl).find(v => typeof v==="string" && (v as string).startsWith("http")) as string)||""
    }
    return ""
  }, [fileUrl])

  // ── Interactive glossary / dictionary — OPT-IN via a toolbar toggle.
  // Hover-meanings while casually reading can distract, so the student turns
  // the feature on when studying; the choice persists across sessions.
  const [dictionaryOn, setDictionaryOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("lms_dictionary_on") === "1"
  })
  const toggleDictionary = () => {
    setDictionaryOn((prev) => {
      const next = !prev
      try { localStorage.setItem("lms_dictionary_on", next ? "1" : "0") } catch {}
      if (!next) setGlossarySel(null)
      return next
    })
  }

  const glossaryPages = useLessonGlossary({
    apiBaseUrl,
    courseId,
    fileUrl: normalizedUrl,
    currentPage,
    enabled: dictionaryOn && !!courseId && !!normalizedUrl,
  })
  // Dictionary mode: every word's box (definitions fetched per word on hover).
  const wordsPages = useLessonWords({
    apiBaseUrl,
    fileUrl: normalizedUrl,
    currentPage,
    enabled: dictionaryOn && !!normalizedUrl,
  })
  const [glossarySel, setGlossarySel] = useState<GlossarySelection | null>(null)

  // ── Compute actual flex values enforcing PDF minimum
  const computeLayout = useCallback(() => {
    const ai = aiOpen ? aiFlex : 0
    const notes = notesOpen ? notesFlex : 0
    const rawPdf = 100 - ai - notes
    const pdfFlex = Math.max(PDF_MIN_FLEX, rawPdf)
    if (rawPdf < PDF_MIN_FLEX && (ai > 0 || notes > 0)) {
      const available = 100 - PDF_MIN_FLEX
      const sideTotal = ai + notes
      const scale = sideTotal > 0 ? available / sideTotal : 1
      return {
        pdfFlex,
        aiFlexActual: ai * scale,
        notesFlexActual: notes * scale,
      }
    }
    return { pdfFlex, aiFlexActual: ai, notesFlexActual: notes }
  }, [aiOpen, aiFlex, notesOpen, notesFlex])

  // ── Load PDF
  useEffect(() => {
    if (!normalizedUrl) return
    let cancelled = false
    setIsLoading(true); setLoadError(null); setPdfDoc(null); setTotalPages(0)
    const load = async () => {
      try {
        if (!(window as any).pdfjsLib) {
          await new Promise<void>((res, rej) => {
            const s = document.createElement("script")
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
            s.onload = () => res(); s.onerror = () => rej(new Error("pdf.js CDN unavailable"))
            document.head.appendChild(s)
          })
        }
        const lib = (window as any).pdfjsLib
        lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
        const doc = await lib.getDocument({ url: normalizedUrl, withCredentials: false }).promise
        if (cancelled) return
        setPdfDoc(doc); setTotalPages(doc.numPages); setCurrentPage(1)
        pageRefs.current = new Array(doc.numPages).fill(null)
        setIsLoading(false)
      } catch (e:any) {
        if (!cancelled) { setLoadError(e?.message||"Failed to load"); setIsLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [normalizedUrl])

  // ── Default page dimensions (from page 1) so unrendered placeholders keep scroll geometry
  const [defaultPageSize, setDefaultPageSize] = useState<{ width:number; height:number }|null>(null)
  useEffect(() => {
    if (!pdfDoc) { setDefaultPageSize(null); return }
    let cancelled = false
    pdfDoc.getPage(1).then((page:any) => {
      if (cancelled) return
      const vp = page.getViewport({ scale })
      setDefaultPageSize({ width: vp.width, height: vp.height })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [pdfDoc, scale])

  // ── IntersectionObserver for current page
  useEffect(() => {
    if (!pdfDoc || totalPages===0) return
    const observer = new IntersectionObserver(
      entries => {
        let best = entries[0]
        entries.forEach(e => { if (e.intersectionRatio>(best?.intersectionRatio??0)) best=e })
        if (best?.isIntersecting) {
          const pg = parseInt((best.target as HTMLElement).dataset.page||"1")
          if (!isNaN(pg)) setCurrentPage(pg)
        }
      },
      { root: scrollRef.current, threshold: Array.from({length:11},(_,i)=>i/10) }
    )
    pageRefs.current.forEach(el => { if (el) observer.observe(el) })
    return () => observer.disconnect()
  }, [pdfDoc, totalPages, scale])

  // ── MCQ trigger
  useEffect(() => {
    if (activeMcqGroup) return
    const pageQuestions = mcqQuestions.filter(q => getMcqPage(q)===currentPage)
    if (pageQuestions.length>0 && !triggeredPages.current.has(currentPage)) {
      triggeredPages.current.add(currentPage)
      setActiveMcqGroup({ page:currentPage, questions:pageQuestions })
    }
  }, [currentPage])

  // ── Progress helpers
  const getAuthHeader = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("smartcliff_token") : null
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  const saveProgress = async (extra?: { attendedPageNumber?: number; answers?: FileMcqAnswer[] }) => {
    if (!fileId || !entityType || !entityId || !tabType || !subcategory) return
    try {
      const { answers: mcqAnswers, ...restExtra } = extra || {}
      const res = await fetch(`${apiBaseUrl}/student-file-progress/${entityType}/${entityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify({
          tabType, subcategory, folderPath, fileId,
          fileName,
          highestPageReached: highestPageRef.current,
          totalPages,
          courseId,
          ...(mcqAnswers?.length ? { answers: mcqAnswers } : {}),
          ...restExtra,
        }),
      })
      if (res.ok) {
        const { data } = await res.json()
        if (data?.completionPercentage !== undefined) setCompletionPct(data.completionPercentage)
      }
    } catch {}
  }

  // Load progress on mount
  useEffect(() => {
    if (!fileId || !entityType || !entityId || !tabType || !subcategory) return
    fetch(`${apiBaseUrl}/student-file-progress/${entityType}/${entityId}?tabType=${encodeURIComponent(tabType)}&subcategory=${encodeURIComponent(subcategory)}&folderPath=${encodeURIComponent(JSON.stringify(folderPath))}&fileId=${encodeURIComponent(fileId)}`, {
      headers: getAuthHeader(),
    })
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (!json?.data) return
        const { highestPageReached, attemptedPages, completionPercentage } = json.data
        if (highestPageReached) highestPageRef.current = highestPageReached
        if (attemptedPages?.length) attemptedPages.forEach((p: number) => triggeredPages.current.add(p))
        if (completionPercentage) setCompletionPct(completionPercentage)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, entityType, entityId])

  // Track highest page reached and debounce-save
  useEffect(() => {
    if (!totalPages || currentPage < 1) return
    if (currentPage > highestPageRef.current) {
      highestPageRef.current = currentPage
      if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current)
      progressSaveTimer.current = setTimeout(() => saveProgress(), 2500)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, totalPages])

  const scrollToPage = (p:number) => {
    const next = Math.max(1, Math.min(totalPages||1, p))
    if (next<currentPage) {
      triggeredPages.current.forEach(pg => { if (pg>=next) triggeredPages.current.delete(pg) })
    }
    setPageInput(String(next))
    const el = pageRefs.current[next-1]
    if (el) el.scrollIntoView({ behavior:"smooth", block:"center" })
    else setCurrentPage(next)
  }

  // Keep input in sync when page changes via scroll
  useEffect(() => { setPageInput(String(currentPage)) }, [currentPage])

  const commitPageInput = () => {
    const n = parseInt(pageInput, 10)
    if (!isNaN(n)) scrollToPage(n)
    else setPageInput(String(currentPage))
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.currentTarget.blur(); commitPageInput() }
    if (e.key === "Escape") { setPageInput(String(currentPage)); e.currentTarget.blur() }
  }

  // ── Resize logic
  const startDrag = useCallback((side: "left"|"right", e: React.MouseEvent) => {
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
        const newAi = Math.max(SIDE_MIN_FLEX, Math.min(maxAi, ai + dFlex))
        setAiFlex(newAi)
      }
      if (draggingRef.current === "right" && notesOpen) {
        const maxNotes = 100 - (aiOpen ? Math.max(SIDE_MIN_FLEX, ai) : 0) - PDF_MIN_FLEX
        const newNotes = Math.max(SIDE_MIN_FLEX, Math.min(maxNotes, notes - dFlex))
        setNotesFlex(newNotes)
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

  // ── Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (activeMcqGroup) return
      if (e.key==="Escape" && isFullscreen) document.exitFullscreen?.()
      if (e.key==="ArrowRight"||e.key==="ArrowDown") { e.preventDefault(); scrollToPage(currentPage+1) }
      if (e.key==="ArrowLeft"||e.key==="ArrowUp") { e.preventDefault(); scrollToPage(currentPage-1) }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [currentPage, totalPages, isFullscreen, activeMcqGroup])

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
      setNotesOpen(true); setAiOpen(false)
      onNotesStateChange?.(true)
      const savedNote = localStorage.getItem("lastCreatedNote")
      if (savedNote) { setShouldLoadSavedNote(true); setTimeout(()=>setShouldLoadSavedNote(false),500) }
    }
    window.addEventListener("force-open-notes-in-viewer", handleForceOpenNotes)
    return () => window.removeEventListener("force-open-notes-in-viewer", handleForceOpenNotes)
  }, [onNotesStateChange, notesEnabled])

  useEffect(() => { setNotesOpen(notesEnabled) }, [showNotesPanel, notesEnabled])

  const handleDownload = () => {
    if (!normalizedUrl) return
    const a = document.createElement("a"); a.href=normalizedUrl
    a.download=fileName; a.target="_blank"
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const handleFullscreen = async () => {
    if (!containerRef.current) return
    try {
      if (!isFullscreen) await containerRef.current.requestFullscreen()
      else await document.exitFullscreen()
      setIsFullscreen(!isFullscreen)
    } catch {}
  }

  const handleAIToggle = () => setAiOpen(prev => !prev)

  const handleAITabChange = (tab:"chat"|"summary") => {
    setAiTab(tab); setAiOpen(true)
  }

  const handleNotesToggle = () => {
    const next = !notesOpen
    setNotesOpen(next)
    onNotesClick?.()
    onNotesStateChange?.(next)
  }

  // ── Close handler - closes both AI and Notes panels
  const handleClose = () => {
    setAiOpen(false)
    setNotesOpen(false)
    onNotesStateChange?.(false)
    onClose()
  }

  const { pdfFlex, aiFlexActual, notesFlexActual } = computeLayout()

  return (
    <>
      <style>{GLOBAL_STYLES}</style>
      <div
        ref={containerRef}
        style={{
          position:"fixed", inset:0,
          background:"#E2E5EA",
          display:"flex", flexDirection:"column",
          zIndex: isFullscreen ? 2000 : 1000,
          fontFamily:"'Poppins','Google Sans','Segoe UI',system-ui,sans-serif",
        }}
      >
        {/* ── TOP TOOLBAR ──────────────────────────────────────────────────── */}
       {!isFullscreen && (
  <div style={{
    display:"flex", alignItems:"center",
    padding:"10px 12px 0 12px", gap:8, flexShrink:0,
  }}>
    {/* ── Breadcrumbs */}
    <div style={{
      display:"flex", alignItems:"center", gap:4,
      flex:1, minWidth:0, overflow:"hidden",
    }}>
      {/* File icon */}
      <div style={{ width:22,height:22,borderRadius:6,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
        <FileText size={11} style={{ color:"white" }} />
      </div>

      {/* Hierarchy breadcrumbs */}
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
          {/* File name at end */}
          <ChevronRight size={12} style={{ color:"#9ca3af", flexShrink:0 }} />
          <span style={{
            fontSize:12, fontWeight:700, color:"#111827",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            maxWidth:200, flexShrink:0,
          }}>
            {fileName}
          </span>
        </>
      ) : (
        <span style={{ fontSize:12,fontWeight:700,color:"#111827",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
          {fileName}
        </span>
      )}
    </div>

    {/* ── Right actions */}
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

      <ToolbarBtn
        onClick={toggleDictionary}
        active={dictionaryOn}
        activeClass="active-purple"
        title={dictionaryOn ? "Dictionary on — hover any word to see its meaning" : "Dictionary off — click to enable hover meanings"}
      >
        <Book size={12} /> Dictionary
      </ToolbarBtn>

      <div style={{ width:1,height:22,background:"rgba(0,0,0,0.1)" }} />

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

        {/* ── THREE-PANEL ROW ───────────────────────────────────────────────── */}
        <div
          ref={panelsRowRef}
          style={{
            flex:1, display:"flex",
            padding: GAP, gap:0,
            minHeight:0, overflow:"hidden",
            paddingTop: isFullscreen ? GAP : GAP,
          }}
        >
          {/* ─── LEFT: AI Panel ─────────────────────────────────────────── */}
          {aiOpen && showAIButton && (
            <>
              <div className="panel-card" style={{ flex: aiFlexActual, transition:"flex 0.05s" }}>
                <PanelHeader bgClass="panel-header-purple" onClose={handleAIToggle}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,flex:1 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                      <div style={{ width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(249,115,22,0.28)" }}>
                        <Sparkles size={13} style={{ color:"white" }} />
                      </div>
                      <span style={{ fontSize:13,fontWeight:700,color:"#111827",letterSpacing:"-0.01em" }}>AI Assistant</span>
                    </div>
                    {aiChatEnabled && aiSummaryEnabled && (
                      <div style={{ display:"flex",background:"#f3f4f6",borderRadius:20,padding:"2px",gap:0,marginLeft:4 }}>
                        <button
                          onClick={() => handleAITabChange("chat")}
                          style={{
                            display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,transition:"all 0.15s",
                            background:aiTab==="chat"?"white":"transparent",
                            color:aiTab==="chat"?"#111827":"#6b7280",
                            boxShadow:aiTab==="chat"?"0 1px 3px rgba(0,0,0,0.12)":"none",
                          }}
                        >
                          <MessageCircle size={10} /> Chat
                        </button>
                        <button
                          onClick={() => handleAITabChange("summary")}
                          style={{
                            display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,transition:"all 0.15s",
                            background:aiTab==="summary"?"white":"transparent",
                            color:aiTab==="summary"?"#111827":"#6b7280",
                            boxShadow:aiTab==="summary"?"0 1px 3px rgba(0,0,0,0.12)":"none",
                          }}
                        >
                          <FileText size={10} /> Summary
                        </button>
                      </div>
                    )}
                    {aiChatEnabled && !aiSummaryEnabled && (
                      <span style={{ fontSize:11,fontWeight:500,color:"#6b7280",background:"#f3f4f6",padding:"3px 10px",borderRadius:20 }}>Chat</span>
                    )}
                    {!aiChatEnabled && aiSummaryEnabled && (
                      <span style={{ fontSize:11,fontWeight:500,color:"#6b7280",background:"#f3f4f6",padding:"3px 10px",borderRadius:20 }}>Summary</span>
                    )}
                  </div>
                </PanelHeader>

                <div style={{ flex:1,overflow:"hidden",position:"relative" }}>
                  {aiTab==="chat" && aiChatEnabled && (
                    <AIChat
                      isOpen={true} embedded onClose={handleAIToggle}
                      context={{ topicTitle: currentItemTitle||fileName, fileName, fileType:"pdf", isDocumentView:true }}
                    />
                  )}
                  {aiTab==="summary" && aiSummaryEnabled && (
                    <SummaryChat
                      isOpen={true} embedded
                      onClose={() => { if (aiTab==="summary") setAiOpen(false) }}
                      context={{ topicTitle:currentItemTitle||fileName, fileName, fileType:"pdf", isDocumentView:true, hierarchy:hierarchy.length>0?hierarchy:[fileName], pdfUrl:normalizedUrl, isPDF:true }}
                    />
                  )}
                </div>
              </div>

              {/* Left resize handle */}
              <div
                className={`pdf-viewer-resize-handle${draggingHandle==="left"?" dragging":""}`}
                onMouseDown={e => startDrag("left", e)}
                style={{ margin:`0 ${GAP/2}px` }}
              />
            </>
          )}

          {/* ─── CENTER: PDF Panel ──────────────────────────────────────── */}
          <div className="panel-card" style={{ flex: pdfFlex, minWidth:0, transition:"flex 0.05s", position:"relative" }}>
            {/* Contextual notes indicator — pinned to the panel (not scrolled with content) */}
            {notesEnabled && fileId && resourceNotes.length > 0 && (
              <AnchorNoteIndicator
                notes={resourceNotes}
                mode="page"
                currentValue={currentPage}
                onOpenPanel={(noteId) => {
                  // Fallback to first note on the current page when the pill
                  // represents multiple notes.
                  const fallback = resourceNotes.find(n => n.anchor?.page === currentPage)
                  setPendingFilterNoteId(noteId || fallback?._id || null)
                  setNotesOpen(true)
                  onNotesStateChange?.(true)
                }}
              />
            )}
            {/* PDF Panel Header — 3 columns */}
            <div className="panel-header-neutral" style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",flexShrink:0,borderRadius:"14px 14px 0 0",gap:8 }}>
              {/* Left: filename */}
              <div style={{ display:"flex",alignItems:"center",gap:7,flex:1,minWidth:0 }}>
                <div style={{ width:22,height:22,borderRadius:6,background:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                  <FileText size={11} style={{ color:"#9ca3af" }} />
                </div>
                <span style={{ fontSize:12,fontWeight:600,color:"#6b7280",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{fileName}</span>
              </div>
              {/* Center: page navigation */}
              <div style={{ display:"flex",alignItems:"center",gap:6,flexShrink:0 }}>
                <button
                  onClick={() => scrollToPage(currentPage-1)}
                  disabled={currentPage<=1||!!activeMcqGroup}
                  style={{ background:"none",border:"1.5px solid currentColor",cursor:(currentPage<=1||!!activeMcqGroup)?"not-allowed":"pointer",color:currentPage<=1?"#D1D5DB":"#6b7280",display:"flex",alignItems:"center",padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,transition:"all 0.15s" }}
                >
                  Prev
                </button>
                {pagesWithMcqs.has(currentPage) && (
                  <div style={{ width:7,height:7,borderRadius:"50%",background:"#F97316",boxShadow:"0 0 0 2px rgba(249,115,22,0.25)",flexShrink:0 }} title="Quiz on this page" />
                )}
                <input
                  className="pdf-page-input"
                  type="number"
                  min={1}
                  max={totalPages||1}
                  value={pageInput}
                  onChange={e => setPageInput(e.target.value)}
                  onBlur={commitPageInput}
                  onKeyDown={handlePageInputKeyDown}
                  disabled={!!activeMcqGroup}
                />
                <span style={{ fontSize:12,color:"#9ca3af",fontWeight:500 }}>/ {totalPages||"—"}</span>
                {notesEnabled && fileId && (() => {
                  const pageNotes = resourceNotes.filter(n => n.anchor?.page === currentPage)
                  if (pageNotes.length === 0) return null
                  return (
                    <button
                      title={`${pageNotes.length} note${pageNotes.length>1?'s':''} on page ${currentPage} — click to open`}
                      onClick={() => { setPendingFilterNoteId(pageNotes[0]._id); setNotesOpen(true); onNotesStateChange?.(true) }}
                      style={{ display:"flex",alignItems:"center",gap:4,padding:"3px 8px",background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:8,fontSize:10,fontWeight:700,color:"#EA580C",cursor:"pointer",animation:"pulse 2.5s infinite" }}
                    >
                      <span style={{ width:6,height:6,borderRadius:"50%",background:"#F97316" }} />
                      {pageNotes.length} note{pageNotes.length>1?'s':''}
                    </button>
                  )
                })()}
                <button
                  onClick={() => scrollToPage(currentPage+1)}
                  disabled={currentPage>=totalPages||!!activeMcqGroup}
                  style={{ background:"none",border:"1.5px solid currentColor",cursor:(currentPage>=totalPages||!!activeMcqGroup)?"not-allowed":"pointer",color:currentPage>=totalPages?"#D1D5DB":"#6b7280",display:"flex",alignItems:"center",padding:"3px 8px",borderRadius:6,fontSize:11,fontWeight:600,transition:"all 0.15s" }}
                >
                  Next
                </button>
                {activeMcqGroup && (
                  <span style={{ display:"flex",alignItems:"center",gap:4,padding:"3px 10px",background:"#F97316",borderRadius:8,fontSize:11,fontWeight:700,color:"white",animation:"pulse 2s infinite" }}>
                    <HelpCircle size={11} /> Quiz…
                  </span>
                )}
              </div>
              {/* Right: zoom + progress */}
              <div style={{ display:"flex",alignItems:"center",gap:6,flex:1,justifyContent:"flex-end" }}>
                {completionPct > 0 && (
                  <div style={{ display:"flex",alignItems:"center",gap:5 }} title={`${Math.round(completionPct)}% complete`}>
                    <div style={{ width:44,height:4,background:"rgba(0,0,0,0.1)",borderRadius:99,overflow:"hidden" }}>
                      <div style={{ height:"100%",background:"linear-gradient(90deg,#F97316,#EA580C)",borderRadius:99,width:`${completionPct}%`,transition:"width 0.6s" }} />
                    </div>
                    <span style={{ fontSize:10,color:"#6b7280",fontWeight:700 }}>{Math.round(completionPct)}%</span>
                  </div>
                )}
                <button onClick={() => setScale(z=>Math.max(0.5,+(z-0.25).toFixed(2)))}
                  style={{ background:"none",border:"none",cursor:"pointer",color:"#6b7280",display:"flex",padding:"3px 5px",borderRadius:6,transition:"all 0.15s" }}
                  onMouseEnter={e=>(e.currentTarget.style.background="#f3f4f6")}
                  onMouseLeave={e=>(e.currentTarget.style.background="none")}
                >
                  <ZoomOut size={13} />
                </button>
                <span style={{ fontSize:12,color:"#374151",minWidth:38,textAlign:"center",fontWeight:600 }}>{Math.round(scale*100)}%</span>
                <button onClick={() => setScale(z=>Math.min(3,+(z+0.25).toFixed(2)))}
                  style={{ background:"none",border:"none",cursor:"pointer",color:"#6b7280",display:"flex",padding:"3px 5px",borderRadius:6,transition:"all 0.15s" }}
                  onMouseEnter={e=>(e.currentTarget.style.background="#f3f4f6")}
                  onMouseLeave={e=>(e.currentTarget.style.background="none")}
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              style={{
                flex:1, overflowY:"auto", overflowX:"auto",
                display:"flex", flexDirection:"column", alignItems:"center",
                gap:18, padding:"18px 16px",
                background:"#EAECF0",
                borderRadius:"0 0 14px 14px",
                position:"relative",
                scrollbarWidth:"thin",
                scrollbarColor:"rgba(0,0,0,0.15) transparent",
              }}
            >
              {/* Loading */}
              {isLoading && (
                <div style={{ position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",zIndex:10 }}>
                  <div style={{ width:42,height:42,border:"3px solid rgba(249,115,22,0.15)",borderTopColor:"#F97316",borderRadius:"50%",animation:"spin 0.75s linear infinite",margin:"0 auto 14px" }} />
                  <p style={{ fontSize:13,color:"#6b7280",margin:0,fontWeight:500 }}>Loading PDF…</p>
                </div>
              )}

              {/* Error */}
              {loadError && !isLoading && (
                <div style={{ textAlign:"center",padding:"48px 24px" }}>
                  <div style={{ width:64,height:64,borderRadius:18,background:"#FEF2F2",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px" }}>
                    <FileText size={28} style={{ color:"#ef4444" }} />
                  </div>
                  <p style={{ fontWeight:700,color:"#1f2937",marginBottom:8,fontSize:15 }}>Could not load PDF</p>
                  <p style={{ color:"#6b7280",fontSize:12,marginBottom:20,lineHeight:1.5 }}>{loadError}</p>
                  <button onClick={handleDownload}
                    style={{ padding:"10px 20px",background:"linear-gradient(135deg,#F97316,#EA580C)",color:"white",border:"none",borderRadius:10,fontWeight:600,cursor:"pointer",fontSize:13,boxShadow:"0 4px 12px rgba(249,115,22,0.3)" }}>
                    Download instead
                  </button>
                </div>
              )}

              {/* Pages - Centered properly */}
              {pdfDoc && Array.from({length:totalPages},(_,i)=>i+1).map(pg => (
                <div
                  key={pg} data-page={pg}
                  ref={el => { pageRefs.current[pg-1] = el }}
                  style={{ 
                    position:"relative",
                    flexShrink:0,
                    display:"flex",
                    justifyContent:"center",
                    width:"100%"
                  }}
                >
                  <div style={{
                    borderRadius:10,
                    overflow:"hidden",
                    boxShadow:"0 6px 24px rgba(0,0,0,0.12),0 1px 4px rgba(0,0,0,0.07)",
                    transition:"box-shadow 0.2s",
                    background:"white",
                    display:"inline-block",
                    position:"relative"
                  }}>
                    <PdfPageCanvas pdfDoc={pdfDoc} pageNum={pg} scale={scale} scrollRootRef={scrollRef} placeholderSize={defaultPageSize} />
                    {/* Glossary + dictionary hotspots, and the in-place definition
                        popup — %-positioned over the canvas, so zoom and resize
                        stay aligned. Dictionary words sit under glossary terms;
                        the trainer's definition always wins the overlap. */}
                    {dictionaryOn && wordsPages.get(pg) && (
                      <DictionaryLayer
                        data={wordsPages.get(pg)!}
                        glossaryData={glossaryPages.get(pg)}
                        apiBaseUrl={apiBaseUrl}
                        courseId={courseId}
                        onSelect={setGlossarySel}
                      />
                    )}
                    {dictionaryOn && glossaryPages.get(pg) && (
                      <GlossaryLayer data={glossaryPages.get(pg)!} onSelect={setGlossarySel} />
                    )}
                    {dictionaryOn && glossarySel?.page === pg && (glossaryPages.get(pg) || wordsPages.get(pg)) && (
                      <GlossaryPopup
                        sel={glossarySel}
                        pageData={(glossaryPages.get(pg) || wordsPages.get(pg))!}
                        onClose={() => setGlossarySel(null)}
                      />
                    )}
                  </div>
                  {/* Page number badge */}
                  <div style={{ position:"absolute",bottom:10,right:10,background:"rgba(0,0,0,0.45)",color:"rgba(255,255,255,0.92)",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,pointerEvents:"none",letterSpacing:"0.3px" }}>
                    {pg}
                  </div>
                  {/* MCQ dot */}
                  {pagesWithMcqs.has(pg) && (
                    <div style={{ position:"absolute",top:10,right:10,width:10,height:10,borderRadius:"50%",background:"#F97316",boxShadow:"0 0 0 3px rgba(249,115,22,0.25)",pointerEvents:"none" }} title="Quiz on this page" />
                  )}
                  {/* Current page indicator */}
                  {pg===currentPage && totalPages>1 && (
                    <div style={{ position:"absolute",top:10,left:10,background:"rgba(249,115,22,0.9)",color:"white",fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:99,pointerEvents:"none",letterSpacing:"0.3px" }}>
                      Current
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* MCQ overlay inside PDF panel */}
            {activeMcqGroup && (
              <MCQDisplayOverlay
                questions={activeMcqGroup.questions}
                pageNumber={activeMcqGroup.page}
                onResume={() => setActiveMcqGroup(null)}
                onDismiss={() => setActiveMcqGroup(null)}
                onComplete={(answers) => saveProgress({ attendedPageNumber: activeMcqGroup.page, answers })}
              />
            )}
          </div>

          {/* ─── RIGHT: Notes Panel ─────────────────────────────────────── */}
          {notesOpen && notesEnabled && (
            <>
              {/* Right resize handle */}
              <div
                className={`pdf-viewer-resize-handle pdf-viewer-resize-handle-blue${draggingHandle==="right"?" dragging":""}`}
                onMouseDown={e => startDrag("right", e)}
                style={{ margin:`0 ${GAP/2}px` }}
              />

              <div className="panel-card" style={{ flex: notesFlexActual, transition:"flex 0.05s" }}>
                <PanelHeader
                  bgClass="panel-header-blue"
                  onClose={() => { setNotesOpen(false); onNotesStateChange?.(false) }}
                >
                  <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                    <div style={{ width:26,height:26,borderRadius:8,background:"linear-gradient(135deg,#F97316,#EA580C)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                      <BookOpen size={12} style={{ color:"white" }} />
                    </div>
                    <span style={{ fontSize:13,fontWeight:700,color:"#9A3412" }}>Notes</span>
                  </div>
                </PanelHeader>

                <div style={{ flex:1,overflow:"hidden" }}>
                  <NotesPanel
                    isOpen={true}
                    onClose={() => { setNotesOpen(false); onNotesStateChange?.(false) }}
                    isDraggable={false}
                    initialNoteData={shouldLoadSavedNote ? localStorage.getItem("lastCreatedNote") : null}
                    resourceContext={fileId ? {
                      resourceId: fileId,
                      resourceType: 'pdf',
                      currentAnchor: { page: currentPage },
                      onJumpTo: (a) => { if (a.page != null) scrollToPage(a.page) },
                      onNotesChanged: () => setNotesVersion(v => v + 1),
                    } : null}
                    filterNoteId={pendingFilterNoteId}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Fullscreen exit button */}
        {isFullscreen && (
          <button onClick={() => document.exitFullscreen?.()}
            style={{
              position:"fixed",top:16,right:16,zIndex:2100,
              display:"flex",alignItems:"center",gap:6,
              padding:"9px 18px",background:"rgba(0,0,0,0.7)",color:"white",
              border:"1px solid rgba(255,255,255,0.15)",borderRadius:12,
              cursor:"pointer",fontSize:13,fontWeight:600,
              backdropFilter:"blur(8px)",
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