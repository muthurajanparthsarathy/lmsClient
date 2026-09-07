"use client"
import { getToken } from "@/lib/session";

import React, { useState, useRef, useEffect } from "react"
import FileMCQAnnotationForm from "./FileMCQAnnotationForm"
import {
  X, Download, FileText, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Printer, Maximize, Minimize, Settings, ExternalLink,
  HelpCircle, Save, Loader, AlertCircle, Plus, Trash2,
  Copy, ChevronUp, ChevronDown, List, CheckSquare, AlignLeft,
  Image, Check, SlidersHorizontal, BookOpen, Hash,
  MousePointer, Link, Zap, Share2, Sparkles,
  LayoutDashboard,
  BookMarked,
  GraduationCap,
  Layers,
} from "lucide-react"

// ─── HELPERS ──────────────────────────────────────────────────────────────────
let _uid = 0
const uid = (prefix = "id") => `${prefix}-${++_uid}-${Math.random().toString(36).slice(2, 7)}`

// ─── GENERATED LINK POPUP ────────────────────────────────────────────────────
function GeneratedLinkPopup({
  link, slideNumber, questionCount, fileName, onClose,
}: {
  link: string; slideNumber: number; questionCount: number; fileName: string; onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.createElement("textarea")
      el.value = link
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 20000,
      backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeIn 0.2s ease-out",
    }}>
      <div style={{
        backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: 16,
        padding: 32, maxWidth: 520, width: "90%",
        boxShadow: "0 25px 60px rgba(0,0,0,0.8)", animation: "slideUp 0.25s ease-out",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, backgroundColor: "rgba(245,158,11,0.15)",
              border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Share2 size={22} color="#f59e0b" />
            </div>
            {/* <div>
              <h3 style={{ color: "white", fontWeight: 700, fontSize: 16, margin: 0 }}>Live MCQ Link Generated</h3>
              <p style={{ color: "#64748b", fontSize: 12, margin: "3px 0 0" }}>
                {questionCount} question{questionCount !== 1 ? "s" : ""} · Slide {slideNumber}
              </p>
            </div> */}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#475569", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
<div style={{
  display: "flex", alignItems: "center", gap: 8,
  backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 20,
  padding: "6px 14px", fontSize: 11, color: "#9ca3af",
  border: "1px solid #374151",
}}>
          <FileText size={14} color="#64748b" />
          <span style={{ fontSize: 12, color: "#94a3b8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
          <span style={{ fontSize: 10, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", padding: "2px 8px", borderRadius: 99, fontWeight: 700 }}>
            Slide {slideNumber}
          </span>
        </div>

        <div style={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Shareable Link</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 12, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace" }}>{link}</span>
            <button onClick={handleCopy} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
              backgroundColor: copied ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
              border: `1px solid ${copied ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
              borderRadius: 6, cursor: "pointer", color: copied ? "#10b981" : "#f59e0b",
              fontSize: 11, fontWeight: 700, flexShrink: 0, transition: "all 0.2s",
            }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* <a href={link} target="_blank" rel="noopener noreferrer" style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          width: "100%", padding: "11px 0", backgroundColor: "#f59e0b", borderRadius: 8,
          color: "#0f172a", fontWeight: 700, fontSize: 13, textDecoration: "none",
          transition: "background-color 0.15s", marginBottom: 12,
        }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#d97706")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#f59e0b")}
        >
          <ExternalLink size={14} /> Open Live MCQ Page
        </a> */}

        <p style={{ fontSize: 11, color: "#475569", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
          Anyone with this link can answer the MCQ questions for slide {slideNumber}.<br />
          Share it with your students to let them respond in real time.
        </p>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}

// ─── CONTEXT MENU ─────────────────────────────────────────────────────────────
function ContextMenu({ x, y, slideNumber, onAddMcq, onLiveAddMcq, onClose }: {
  x: number; y: number; slideNumber: number
  onAddMcq: (slide: number) => void; onLiveAddMcq: (slide: number) => void; onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const out = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("mousedown", out)
    document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc) }
  }, [onClose])

  return (
    <div ref={menuRef} style={{
      position: "fixed", left: x, top: y, zIndex: 10000,
      minWidth: 240, backgroundColor: "#1f2937", border: "1px solid #374151",
      borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.6)", padding: "4px 0",
      animation: "ctxFade 0.12s ease-out",
    }}>
      <div style={{ padding: "8px 12px", borderBottom: "1px solid #374151", fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6 }}>
        <Hash size={12} color="#a78bfa" /> Slide {slideNumber}
      </div>
      <button onClick={() => { onAddMcq(slideNumber); onClose() }}
        style={{ width: "100%", padding: "10px 12px", backgroundColor: "transparent", border: "none", color: "#f3f4f6", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "background-color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#374151")}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
        <HelpCircle size={14} color="#a78bfa" />
        <span style={{ flex: 1, textAlign: "left" }}>Add MCQ Question</span>
        <span style={{ fontSize: 10, color: "#a78bfa", backgroundColor: "rgba(124,58,237,0.15)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>default</span>
      </button>
      <button onClick={() => { onLiveAddMcq(slideNumber); onClose() }}
        style={{ width: "100%", padding: "10px 12px", backgroundColor: "transparent", border: "none", color: "#f3f4f6", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, transition: "background-color 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#374151")}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}>
        <Zap size={14} color="#f59e0b" />
        <span style={{ flex: 1, textAlign: "left" }}>Live Add MCQ Question</span>
        <span style={{ fontSize: 10, color: "#f59e0b", backgroundColor: "rgba(245,158,11,0.15)", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>link</span>
      </button>
      <div style={{ padding: "8px 12px", fontSize: 10, color: "#6b7280", borderTop: "1px solid #374151", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
        <MousePointer size={10} color="#6b7280" /> Right-click any slide to add questions
      </div>
    </div>
  )
}

// ─── TYPE CONFIG ──────────────────────────────────────────────────────────────
const typeConfig = {
  "multiple-choice": { label: "Multiple Choice", icon: <List className="h-3.5 w-3.5" />, color: "text-violet-600", bg: "bg-violet-50" },
  "checkboxes": { label: "Checkboxes", icon: <CheckSquare className="h-3.5 w-3.5" />, color: "text-blue-600", bg: "bg-blue-50" },
  "short-answer": { label: "Short Answer", icon: <AlignLeft className="h-3.5 w-3.5" />, color: "text-orange-600", bg: "bg-orange-50" },
  "paragraph": { label: "Paragraph", icon: <BookOpen className="h-3.5 w-3.5" />, color: "text-teal-600", bg: "bg-teal-50" },
}

// ─── OPTIONS PER ROW PICKER ───────────────────────────────────────────────────
function OptionsPerRowPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-semibold text-slate-400">Layout:</span>
      {[1, 2, 3, 4].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${value === n ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-violet-50 hover:text-violet-600"}`}>
          {n}
        </button>
      ))}
      <span className="text-[10px] text-slate-400">per row</span>
    </div>
  )
}

// ─── SETTINGS MENU ────────────────────────────────────────────────────────────
function SettingsMenu({ isOpen, onClose, onCollapseAll, onExpandAll }: any) {
  if (!isOpen) return null
  return (
    <div className="absolute top-full right-0 mt-1.5 w-52 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50">
      <p className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">View</p>
      {([["Collapse All", <ChevronRight className="h-3.5 w-3.5 text-slate-400" />, onCollapseAll],
        ["Expand All", <ChevronDown className="h-3.5 w-3.5 text-slate-400" />, onExpandAll]] as any[]).map(([label, icon, handler]) => (
          <button key={label} onClick={() => { handler(); onClose() }}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 transition-colors text-xs text-slate-700">
            {icon}{label}
          </button>
        ))}
    </div>
  )
}

// ─── IMAGE TOOLBAR ────────────────────────────────────────────────────────────
function ImageToolbar({ alignment, sizePercent, onAlignmentChange, onSizeChange, onRemove, onClose }: any) {
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 flex items-stretch divide-x divide-slate-100" style={{ minWidth: 260 }}>
      <div className="flex flex-col items-center justify-center px-3 py-2 gap-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Align</span>
        <div className="flex gap-0.5">
          {["left", "center", "right"].map(a => (
            <button key={a} onClick={() => onAlignmentChange(a)}
              className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all ${alignment === a ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400 hover:bg-violet-50 hover:text-violet-600"}`}>
              {a[0].toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col justify-center px-3 py-2 gap-1 flex-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Size {sizePercent}%</span>
        <div className="flex items-center gap-1.5">
          <ZoomOut className="h-3 w-3 text-slate-300" />
          <input type="range" min={10} max={100} step={5} value={sizePercent} onChange={e => onSizeChange(parseInt(e.target.value))} className="flex-1 h-1.5 accent-violet-600 cursor-pointer" />
          <ZoomIn className="h-3 w-3 text-slate-300" />
        </div>
      </div>
      <div className="flex items-center gap-0.5 px-2 py-2">
        <button onClick={onRemove} className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
        <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

// ─── MCQ QUESTION FORM ────────────────────────────────────────────────────────
function MCQQuestionForm({
  onClose, onSave, initialSlideNumber = 1,
  fileId, fileName, entityType, entityId, tabType, subcategory, folderPath = [],
  apiBaseUrl = "https://lmsserver-yeve.onrender.com", mcqMode = "default", sampleLink = "",
  onLinkGenerated,
}: any) {

  const makeBlock = () => ({
    id: uid("block"), isActive: true, sequence: 0, slideNumber: initialSlideNumber,
    mcqQuestion: {
      questionTitle: "",
      options: [
        { id: uid("opt"), text: "", isCorrect: false, imageUrl: null, imageAlignment: "left", imageSizePercent: 100 },
        { id: uid("opt"), text: "", isCorrect: false, imageUrl: null, imageAlignment: "left", imageSizePercent: 100 },
      ],
      correctAnswers: [] as string[], explanation: "",
    },
    type: "multiple-choice", hasExplanation: false, explanation: "", optionsPerRow: 1, isRequired: false,
    questionImage: { imageUrl: "", alignment: "center", sizePercent: 60 }, explanationImageUrl: "",
  })

  const [blocks, setBlocks] = useState([makeBlock()])
  const [errors, setErrors] = useState<Record<string, any>>({})
  const [collapsedState, setCollapsed] = useState<Record<string, boolean>>({})
  const [showTypeMenu, setShowTypeMenu] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [activeImgToolbar, setActiveImgToolbar] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [linkValue, setLinkValue] = useState(sampleLink || "https://example.com/live-mcq-sample")
  const isLinkMode = mcqMode === "link"

  const updateBlock = (id: string, patch: any) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, ...patch } : b))
  const updateMcqQuestion = (id: string, patch: any) => setBlocks(bs => bs.map(b => b.id === id ? { ...b, mcqQuestion: { ...b.mcqQuestion, ...patch } } : b))
  const updateOption = (bid: string, oid: string, patch: any) => setBlocks(bs => bs.map(b => b.id === bid ? { ...b, mcqQuestion: { ...b.mcqQuestion, options: b.mcqQuestion.options.map((o: any) => o.id === oid ? { ...o, ...patch } : o) } } : b))
  const addBlock = () => { const nb = makeBlock(); setBlocks(bs => [...bs, nb]); setCollapsed(p => ({ ...p, [nb.id]: false })) }
  const removeBlock = (id: string) => { if (blocks.length === 1) { const nb = makeBlock(); setBlocks([nb]); setCollapsed({ [nb.id]: false }) } else { setBlocks(bs => bs.filter(b => b.id !== id)); setCollapsed(p => { const n = { ...p }; delete n[id]; return n }) } }
  const moveBlock = (id: string, dir: "up" | "down") => { const idx = blocks.findIndex(b => b.id === id); if (dir === "up" && idx === 0) return; if (dir === "down" && idx === blocks.length - 1) return; const nb = [...blocks]; const ni = dir === "up" ? idx - 1 : idx + 1; [nb[idx], nb[ni]] = [nb[ni], nb[idx]]; setBlocks(nb) }
  const duplicateBlock = (id: string) => { const src = blocks.find(b => b.id === id); if (!src) return; const nid = uid("block"); const dup = { ...src, id: nid, mcqQuestion: { ...src.mcqQuestion, options: src.mcqQuestion.options.map((o: any) => ({ ...o, id: uid("opt"), imageUrl: o.imageUrl?.startsWith("data:") ? "" : o.imageUrl })), correctAnswers: [] } }; setBlocks(bs => [...bs, dup]); setCollapsed(p => ({ ...p, [nid]: false })) }
  const collapseAll = () => { const s: any = {}; blocks.forEach(b => (s[b.id] = true)); setCollapsed(s) }
  const expandAll = () => { const s: any = {}; blocks.forEach(b => (s[b.id] = false)); setCollapsed(s) }

  const addOption = (bid: string) => setBlocks(bs => bs.map(b => b.id === bid ? { ...b, mcqQuestion: { ...b.mcqQuestion, options: [...b.mcqQuestion.options, { id: uid("opt"), text: "", isCorrect: false, imageUrl: null, imageAlignment: "left", imageSizePercent: 100 }] } } : b))
  const removeOption = (bid: string, oid: string) => setBlocks(bs => bs.map(b => { if (b.id !== bid) return b; const opt = b.mcqQuestion.options.find((o: any) => o.id === oid); const newOpts = b.mcqQuestion.options.filter((o: any) => o.id !== oid); let newCA = [...b.mcqQuestion.correctAnswers]; if (opt?.isCorrect) newCA = newCA.filter((a: string) => a !== opt.text); return { ...b, mcqQuestion: { ...b.mcqQuestion, options: newOpts, correctAnswers: newCA } } }))
  const setCorrect = (bid: string, oid: string) => setBlocks(bs => bs.map(b => { if (b.id !== bid) return b; const updated = b.mcqQuestion.options.map((o: any) => ({ ...o, isCorrect: o.id === oid })); const correct = updated.find((o: any) => o.id === oid); return { ...b, mcqQuestion: { ...b.mcqQuestion, options: updated, correctAnswers: correct?.text ? [correct.text] : [] } } }))
  const toggleCorrect = (bid: string, oid: string) => setBlocks(bs => bs.map(b => { if (b.id !== bid) return b; const updated = b.mcqQuestion.options.map((o: any) => o.id === oid ? { ...o, isCorrect: !o.isCorrect } : o); const newCA = updated.filter((o: any) => o.isCorrect).map((o: any) => o.text).filter((t: string) => t.trim()); return { ...b, mcqQuestion: { ...b.mcqQuestion, options: updated, correctAnswers: newCA } } }))
  const updateOptionText = (bid: string, oid: string, newText: string) => setBlocks(bs => bs.map(b => { if (b.id !== bid) return b; const old = b.mcqQuestion.options.find((o: any) => o.id === oid); const updated = b.mcqQuestion.options.map((o: any) => o.id === oid ? { ...o, text: newText } : o); let newCA = [...b.mcqQuestion.correctAnswers]; if (old?.isCorrect) { newCA = newCA.filter((a: string) => a !== old.text); if (newText.trim()) newCA.push(newText) } return { ...b, mcqQuestion: { ...b.mcqQuestion, options: updated, correctAnswers: newCA } } }))

  const uploadQuestionImage = (bid: string, file: File) => { const r = new FileReader(); r.onload = e => { updateBlock(bid, { questionImage: { ...blocks.find(b => b.id === bid)?.questionImage, imageUrl: (e.target as any).result } }); setActiveImgToolbar({ type: "question", blockId: bid }) }; r.readAsDataURL(file) }
  const uploadOptionImage = (bid: string, oid: string, file: File) => { const r = new FileReader(); r.onload = e => { updateOption(bid, oid, { imageUrl: (e.target as any).result }); setActiveImgToolbar({ type: "option", blockId: bid, optionId: oid }) }; r.readAsDataURL(file) }

  const isQImgActive = (bid: string) => activeImgToolbar?.type === "question" && activeImgToolbar.blockId === bid
  const isOptImgActive = (bid: string, oid: string) => activeImgToolbar?.type === "option" && activeImgToolbar.blockId === bid && activeImgToolbar.optionId === oid

  const validate = () => {
    const errs: any = {}; let valid = true
    blocks.forEach(b => {
      const be: any = {}
      const cleanTitle = b.mcqQuestion?.questionTitle?.replace(/<[^>]*>/g, "").trim() || ""
      if (!cleanTitle) { be.questionTitle = "Question title is required"; valid = false }
      if (b.mcqQuestion.options.length < 2) { be.options = "At least 2 options are required"; valid = false }
      const nonEmpty = b.mcqQuestion.options.filter((o: any) => o.text.trim())
      if (nonEmpty.length < 2) { be.options = "At least 2 non-empty options are required"; valid = false }
      if (b.mcqQuestion.correctAnswers.length === 0) { be.correctAnswer = "Mark at least one correct answer"; valid = false }
      if (Object.keys(be).length) errs[b.id] = be
    })
    setErrors(errs); return valid
  }

  const base64ToFile = (b64: string, name: string) => {
    try {
      const m = b64.match(/^data:([^;]+);base64,(.+)$/); if (!m) return null
      const bytes = atob(m[2]); const buf = new Uint8Array(bytes.length)
      for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
      return new File([buf], name, { type: m[1] })
    } catch { return null }
  }

  const handleSave = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append("tabType", tabType)
      formData.append("subcategory", subcategory)
      formData.append("folderPath", JSON.stringify(Array.isArray(folderPath) && folderPath.length > 0 ? folderPath : []))
      formData.append("fileId", fileId)
      formData.append("type", isLinkMode ? "link" : "default")
      if (isLinkMode) formData.append("link", linkValue)

      const questionsData = blocks.map((b, idx) => {
        const cleanQuestionTitle = b.mcqQuestion?.questionTitle?.replace(/<[^>]*>/g, "").trim() || ""
        const options = b.mcqQuestion.options.map((o: any, oi: number) => {
          const option: any = { text: o.text.trim(), isCorrect: o.isCorrect, imageAlignment: o.imageAlignment || "left", imageSizePercent: o.imageSizePercent || 100 }
          if (o.imageUrl?.startsWith("data:")) {
            const imageKey = `question_${idx}_option_${oi}_image`
            const file = base64ToFile(o.imageUrl, `option_${b.id}_${o.id}_${Date.now()}.jpg`)
            if (file) { formData.append(imageKey, file); option.imageUrl = imageKey }
          } else { option.imageUrl = o.imageUrl || null }
          return option
        })
        const correctAnswers = b.mcqQuestion.correctAnswers.filter((a: string) => a && a.trim())
        const questionData: any = {
          mcqQuestionTitle: cleanQuestionTitle,
          mcqQuestionType: "multiple_choice",
          mcqQuestionOptionsPerRow: b.optionsPerRow || 1,
          mcqQuestionOptions: options,
          mcqQuestionCorrectAnswers: correctAnswers,
          mcqQuestionRequired: b.isRequired || false,
          mcqQuestionDescription: b.hasExplanation ? (b.explanation || "") : "",
          isActive: true, sequence: idx,
          pageNumber: initialSlideNumber,
          timestamp: initialSlideNumber,
          type: isLinkMode ? "link" : "default",
          ...(isLinkMode ? { link: linkValue } : {}),
        }
        if (b.questionImage?.imageUrl) {
          if (b.questionImage.imageUrl.startsWith("data:")) {
            const imageKey = `question_${idx}_image`
            const file = base64ToFile(b.questionImage.imageUrl, `question_${b.id}_${Date.now()}.jpg`)
            if (file) { formData.append(imageKey, file); questionData.mcqQuestionImageUrl = imageKey; questionData.mcqQuestionImageAlignment = b.questionImage.alignment || "center"; questionData.mcqQuestionImageSizePercent = b.questionImage.sizePercent || 60 }
          } else { questionData.mcqQuestionImageUrl = b.questionImage.imageUrl; questionData.mcqQuestionImageAlignment = b.questionImage.alignment || "center"; questionData.mcqQuestionImageSizePercent = b.questionImage.sizePercent || 60 }
        }
        return questionData
      })

      formData.append("questionsData", JSON.stringify(questionsData))
      const token = typeof localStorage !== "undefined" ? getToken() : ""
      const headers: any = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await fetch(`${apiBaseUrl}/file-mcq-add/${entityType}/${entityId}`, {
        method: "POST", headers, body: formData,
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message?.[0]?.value || `API error ${response.status}`)
      }

      const savedQuestions = blocks.map(b => ({
        id: b.id, questionTitle: b.mcqQuestion?.questionTitle,
        options: b.mcqQuestion?.options, explanation: b.explanation,
        pageNumber: initialSlideNumber,
        type: isLinkMode ? "link" : "default",
        ...(isLinkMode ? { link: linkValue } : {}),
      }))

      onSave(savedQuestions)

      if (isLinkMode && onLinkGenerated) {
        const base = typeof window !== "undefined" ? window.location.origin : ""
        const params = new URLSearchParams({ fileId, entityType, entityId, page: String(initialSlideNumber), tabType, subcategory })
        const generatedUrl = `${base}/live-mcq?${params.toString()}`
        onLinkGenerated(generatedUrl, blocks.length)
        return
      }
      onClose()
    } catch (err: any) {
      console.error("Failed to save MCQ:", err)
      alert("Failed to save questions: " + err.message)
    } finally { setIsSaving(false) }
  }

  const renderOptions = (block: any) => {
    const cols = block.optionsPerRow || 1
    const gridCls = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4"][cols - 1]
    return (
      <div className={`grid ${gridCls} gap-2`}>
        {block.mcqQuestion.options.map((opt: any, idx: number) => (
          <div key={opt.id} className="group/opt relative">
            <div className={`flex flex-col rounded-lg border transition-all overflow-hidden ${opt.isCorrect ? "border-emerald-300 bg-emerald-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}>
              {opt.imageUrl && (
                <div className="px-2 pt-2 relative">
                  {isOptImgActive(block.id, opt.id) && <ImageToolbar alignment={opt.imageAlignment || "left"} sizePercent={opt.imageSizePercent || 100} onAlignmentChange={(a: string) => updateOption(block.id, opt.id, { imageAlignment: a })} onSizeChange={(v: number) => updateOption(block.id, opt.id, { imageSizePercent: v })} onRemove={() => { updateOption(block.id, opt.id, { imageUrl: null }); setActiveImgToolbar(null) }} onClose={() => setActiveImgToolbar(null)} />}
                  <div style={{ display: "flex", justifyContent: opt.imageAlignment === "left" ? "flex-start" : opt.imageAlignment === "right" ? "flex-end" : "center", marginTop: isOptImgActive(block.id, opt.id) ? 64 : 0 }}>
                    <div style={{ width: `${opt.imageSizePercent || 100}%` }} className="cursor-pointer" onClick={() => setActiveImgToolbar(isOptImgActive(block.id, opt.id) ? null : { type: "option", blockId: block.id, optionId: opt.id })}>
                      <img src={opt.imageUrl} alt="" className={`w-full h-auto rounded-md border-2 transition-all ${isOptImgActive(block.id, opt.id) ? "border-violet-400 ring-2 ring-violet-100" : "border-transparent hover:border-violet-200"}`} />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 px-2.5 py-2">
                <button type="button" className="flex-shrink-0" onClick={() => block.type === "checkboxes" ? toggleCorrect(block.id, opt.id) : setCorrect(block.id, opt.id)}>
                  {block.type === "checkboxes" ? (
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${opt.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-violet-400"}`}>{opt.isCorrect && <svg className="h-2 w-2 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 010 1.414l-8 8a1 1 01-1.414 0l-4-4a1 1 011.414-1.414L8 12.586l7.293-7.293a1 1 011.414 0z" clipRule="evenodd" /></svg>}</div>
                  ) : (
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${opt.isCorrect ? "border-emerald-500 bg-emerald-500" : "border-slate-300 hover:border-violet-400"}`}>{opt.isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white" />}</div>
                  )}
                </button>
                <input type="text" value={opt.text} onChange={e => updateOptionText(block.id, opt.id, e.target.value)} placeholder={`Option ${String.fromCharCode(65 + idx)}`} className={`flex-1 text-xs outline-none bg-transparent placeholder:text-slate-300 ${opt.isCorrect ? "text-emerald-700 font-semibold" : "text-slate-700"}`} />
                <div className="opacity-0 group-hover/opt:opacity-100 flex items-center gap-0.5 transition-opacity">
                  {!opt.imageUrl && (<label className="cursor-pointer p-1 hover:bg-slate-100 rounded-md transition-colors"><Image className="h-3 w-3 text-slate-400" /><input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadOptionImage(block.id, opt.id, f) }} /></label>)}
                  {block.mcqQuestion.options.length > 2 && (<button onClick={() => removeOption(block.id, opt.id)} className="p-1 hover:bg-red-50 rounded-md transition-colors"><X className="h-3 w-3 text-slate-300 hover:text-red-400" /></button>)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderQuestionContent = (block: any) => {
    if (collapsedState[block.id]) return null
    return (
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <OptionsPerRowPicker value={block.optionsPerRow || 1} onChange={v => updateBlock(block.id, { optionsPerRow: v })} />
          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${typeConfig[block.type as keyof typeof typeConfig]?.bg || "bg-slate-50"} ${typeConfig[block.type as keyof typeof typeConfig]?.color || "text-slate-600"}`}>
            {block.type === "multiple-choice" ? "Single correct" : block.type === "checkboxes" ? "Multiple correct" : "Dropdown"}
          </span>
        </div>
        {renderOptions(block)}
        <button onClick={() => addOption(block.id)} className="text-[11px] text-violet-500 hover:text-violet-700 font-semibold">+ Add option</button>
        {errors[block.id]?.options && <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg"><AlertCircle className="h-3.5 w-3.5" />{errors[block.id].options}</div>}
        {errors[block.id]?.correctAnswer && <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg"><AlertCircle className="h-3.5 w-3.5" />{errors[block.id].correctAnswer}</div>}
      </div>
    )
  }

  const qTypeConfig = (type: string) => typeConfig[type as keyof typeof typeConfig] || typeConfig["multiple-choice"]

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-900/60 backdrop-blur-sm">
      {/* HEADER */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${isLinkMode ? "bg-amber-500" : "bg-violet-600"}`}>
            {isLinkMode ? <Zap className="h-4 w-4 text-white" /> : <HelpCircle className="h-4 w-4 text-white" />}
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {isLinkMode ? "Live Add MCQ Questions" : "Add MCQ Questions"}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isLinkMode ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
                {isLinkMode ? "link" : "default"}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              On slide <span className="font-mono text-violet-600">#{initialSlideNumber}</span>
              &nbsp;·&nbsp;{blocks.length} question{blocks.length !== 1 ? "s" : ""}
              {fileName && <span className="ml-2">· {fileName}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <button onClick={() => setShowSettings(s => !s)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><SlidersHorizontal className="h-4 w-4 text-slate-500" /></button>
            <SettingsMenu isOpen={showSettings} onClose={() => setShowSettings(false)} onCollapseAll={collapseAll} onExpandAll={expandAll} />
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X className="h-4 w-4 text-slate-400" /></button>
        </div>
      </div>

      {/* LINK BANNER */}
      {isLinkMode && (
        <div style={{ padding: "10px 20px", backgroundColor: "#fffbeb", borderBottom: "1px solid #fcd34d", display: "flex", alignItems: "center", gap: 10 }}>
          <Link size={15} color="#d97706" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
              Live Link — sent as <code style={{ backgroundColor: "#fef3c7", padding: "0 4px", borderRadius: 3 }}>type: "link"</code> in payload
            </div>
            <input type="url" value={linkValue} onChange={e => setLinkValue(e.target.value)}
              placeholder="https://example.com/live-mcq-sample"
              style={{ width: "100%", fontSize: 12, border: "1px solid #fcd34d", borderRadius: 8, padding: "6px 10px", outline: "none", backgroundColor: "white", color: "#1f2937" }} />
          </div>
        </div>
      )}

      {/* BODY */}
      <div className="flex-1 overflow-y-auto bg-slate-50/80 px-4 py-4">
        <div className="space-y-3 max-w-3xl mx-auto">
          {blocks.map((block, idx) => {
            const collapsed = collapsedState[block.id] || false
            const hasErr = !!errors[block.id]
            const qtype = qTypeConfig(block.type)
            return (
              <div key={block.id} className={`bg-white rounded-xl border shadow-sm transition-all ${hasErr ? "border-red-300 shadow-red-100" : "border-slate-200 hover:border-slate-300"}`}>
                <div className="flex items-start gap-2.5 px-4 pt-3.5 pb-2">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-black text-white mt-0.5 ${isLinkMode ? "bg-amber-500" : "bg-violet-600"}`}>{idx + 1}</div>
                  <button onClick={() => setCollapsed(p => ({ ...p, [block.id]: !p[block.id] }))} className="flex-shrink-0 p-1 hover:bg-slate-100 rounded-md transition-colors mt-0.5">
                    {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    {collapsed ? (
                      <p className="text-xs text-slate-500 py-0.5 truncate">{block.mcqQuestion?.questionTitle?.replace(/<[^>]*>/g, "").trim() || <span className="italic text-slate-300">Empty question</span>}</p>
                    ) : (
                      <>
                        {!block.questionImage?.imageUrl && (
                          <label className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-violet-600 cursor-pointer transition-colors mb-1.5">
                            <Image className="h-2.5 w-2.5" /><span>Add image to question</span>
                            <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadQuestionImage(block.id, f) }} />
                          </label>
                        )}
                        <input type="text" value={block.mcqQuestion?.questionTitle || ""} onChange={e => updateMcqQuestion(block.id, { questionTitle: e.target.value })} placeholder="Type your question here..." className="w-full text-sm font-medium outline-none border-b-2 border-slate-200 focus:border-violet-400 pb-1.5 mb-2" />
                        {block.questionImage?.imageUrl && (
                          <div className="mt-2 relative">
                            {isQImgActive(block.id) && <ImageToolbar alignment={block.questionImage.alignment || "center"} sizePercent={block.questionImage.sizePercent || 60} onAlignmentChange={(a: string) => updateBlock(block.id, { questionImage: { ...block.questionImage, alignment: a } })} onSizeChange={(v: number) => updateBlock(block.id, { questionImage: { ...block.questionImage, sizePercent: v } })} onRemove={() => { updateBlock(block.id, { questionImage: { imageUrl: "", alignment: "center", sizePercent: 60 } }); setActiveImgToolbar(null) }} onClose={() => setActiveImgToolbar(null)} />}
                            <div style={{ display: "flex", justifyContent: block.questionImage.alignment === "left" ? "flex-start" : block.questionImage.alignment === "right" ? "flex-end" : "center", marginTop: isQImgActive(block.id) ? 64 : 0 }}>
                              <div style={{ width: `${block.questionImage.sizePercent || 60}%` }} className="cursor-pointer" onClick={() => setActiveImgToolbar(isQImgActive(block.id) ? null : { type: "question", blockId: block.id })}>
                                <img src={block.questionImage.imageUrl} alt="" className={`w-full h-auto rounded-lg border-2 transition-all ${isQImgActive(block.id) ? "border-violet-400 ring-2 ring-violet-100" : "border-transparent hover:border-violet-200"}`} />
                              </div>
                            </div>
                          </div>
                        )}
                        {hasErr && errors[block.id]?.questionTitle && <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg"><AlertCircle className="h-3.5 w-3.5" />{errors[block.id].questionTitle}</div>}
                        <div className="mt-2.5">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={block.hasExplanation} onChange={() => updateBlock(block.id, { hasExplanation: !block.hasExplanation })} className="w-3.5 h-3.5 rounded border-slate-300 accent-violet-600" />
                            <span className="text-[11px] text-slate-400 hover:text-violet-600 transition-colors flex items-center gap-1"><HelpCircle className="h-3 w-3" />Add explanation</span>
                          </label>
                          {block.hasExplanation && (
                            <div className="mt-1.5 ml-5 pl-3 border-l-2 border-violet-200">
                              <textarea value={block.explanation || ""} onChange={e => updateBlock(block.id, { explanation: e.target.value })} placeholder="Explain the correct answer…" className="w-full text-sm border border-slate-200 rounded-lg p-2 min-h-[80px] focus:outline-none focus:ring-2 focus:ring-violet-400" />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="relative flex-shrink-0">
                    <button onClick={() => setShowTypeMenu(showTypeMenu === block.id ? null : block.id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${qtype.bg} ${qtype.color} border-transparent hover:border-current/20`}>
                      {qtype.icon}<span className="max-w-[80px] truncate">{qtype.label}</span><ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                    {showTypeMenu === block.id && (
                      <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50">
                        <p className="px-3 py-1 text-[9px] font-bold text-slate-300 uppercase tracking-widest">Question Type</p>
                        {Object.entries(typeConfig).map(([t, cfg]) => (
                          <button key={t} onClick={() => { updateBlock(block.id, { type: t }); setShowTypeMenu(null) }} className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-slate-50 text-xs ${block.type === t ? `${cfg.color} font-semibold` : "text-slate-700"}`}>
                            <span className={block.type === t ? cfg.color : "text-slate-400"}>{cfg.icon}</span>{cfg.label}{block.type === t && <Check className="h-3 w-3 ml-auto" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {renderQuestionContent(block)}
                <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => duplicateBlock(block.id)} title="Duplicate" className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-slate-400 hover:text-slate-700 transition-all"><Copy className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeBlock(block.id)} title="Delete" className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                    <div className="w-px h-4 bg-slate-200 mx-1" />
                    <button onClick={() => moveBlock(block.id, "up")} disabled={idx === 0} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => moveBlock(block.id, "down")} disabled={idx === blocks.length - 1} className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-all"><ChevronDown className="h-3.5 w-3.5" /></button>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[11px] font-semibold text-slate-500">Required</span>
                    <button type="button" onClick={() => updateBlock(block.id, { isRequired: !block.isRequired })} className={`relative rounded-full transition-colors ${block.isRequired ? "bg-violet-600" : "bg-slate-200"}`} style={{ width: 32, height: 18 }}>
                      <div className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${block.isRequired ? "translate-x-3.5" : "translate-x-0.5"}`} />
                    </button>
                  </label>
                </div>
              </div>
            )
          })}
        </div>
        <div className="max-w-3xl mx-auto mt-3">
          <button onClick={addBlock} className="w-full border-2 border-dashed border-slate-300 hover:border-violet-400 py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:text-violet-700 hover:bg-violet-50 transition-all">
            <Plus className="h-5 w-5" />Add another question
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 bg-white flex-shrink-0">
        <span className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className={`w-1.5 h-1.5 rounded-full ${isLinkMode ? "bg-amber-400" : "bg-emerald-400"}`} />
          {blocks.length} question{blocks.length !== 1 ? "s" : ""} ready
          {isLinkMode && <span className="ml-1 text-amber-600 font-semibold">· will generate shareable link</span>}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-xs font-semibold transition-all">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className={`px-5 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 disabled:opacity-50 shadow-sm transition-all ${isLinkMode ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {isSaving ? <><Loader className="h-3.5 w-3.5 animate-spin" />Saving…</> : isLinkMode ? <><Share2 className="h-3.5 w-3.5" />Save & Generate Link</> : <><Save className="h-3.5 w-3.5" />Save Questions</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SINGLE SLIDE CANVAS (renders the converted slide IMAGE — must match the
//     student viewer so slide numbers stay aligned across teacher/student) ─────
/**
 * Renders the current slide as an <img> from the /api/ppt/convert output.
 * Using the same converted images as the student viewer guarantees that
 * `currentSlide` (a real 1-based image index) is identical on both sides, so an
 * MCQ saved on slide N by the teacher triggers on slide N for the student.
 */
function SlideCanvas({
  imageUrl, slideNumber, zoom, onContextMenu,
  showMcqMarker, mcqCount,
}: {
  imageUrl?: string; slideNumber: number; zoom: number;
  onContextMenu?: (e: React.MouseEvent, slide: number) => void;
  showMcqMarker?: boolean; mcqCount?: number;
}) {
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Reset load state whenever the slide image changes
  useEffect(() => { setImgLoaded(false); setImgError(false) }, [imageUrl])

  return (
    <div
      style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}
      onContextMenu={onContextMenu ? e => { e.preventDefault(); onContextMenu(e, slideNumber) } : undefined}
    >
      <div style={{
        transform: `scale(${zoom})`,
        transformOrigin: "top center",
        transition: "transform 0.2s ease",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        borderRadius: 4,
        overflow: "hidden",
        backgroundColor: "white",
        display: "inline-flex",
        position: "relative",
      }}>
        {/* Loading / error placeholder */}
        {(!imgLoaded || imgError) && (
          <div style={{ width: 720, maxWidth: "100%", aspectRatio: "16 / 9", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "white" }}>
            {imgError ? (
              <>
                <FileText size={30} style={{ color: "#ef4444" }} />
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Failed to load slide {slideNumber}</p>
              </>
            ) : (
              <>
                <div style={{ width: 38, height: 38, border: "3px solid rgba(124,58,237,0.15)", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin 0.75s linear infinite" }} />
                <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Loading slide {slideNumber}…</p>
              </>
            )}
          </div>
        )}

        {imageUrl && (
          <img
            key={imageUrl}
            src={imageUrl}
            alt={`Slide ${slideNumber}`}
            onLoad={() => { setImgLoaded(true); setImgError(false) }}
            onError={() => { setImgLoaded(true); setImgError(true) }}
            style={{
              display: imgLoaded && !imgError ? "block" : "none",
              maxWidth: "100%",
              maxHeight: "calc(100vh - 220px)",
              width: "auto",
              height: "auto",
              userSelect: "none",
            }}
            draggable={false}
          />
        )}

        {showMcqMarker && (
          <div style={{
            position: "absolute", top: 10, right: 10, zIndex: 10,
            backgroundColor: "rgba(124,58,237,0.9)", color: "white",
            borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)", pointerEvents: "none",
          }}>
            <HelpCircle size={11} /> {mcqCount || 1} MCQ{(mcqCount || 1) !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  )
}
// ─── PPT VIEWER PROPS ─────────────────────────────────────────────────────────
interface PPTViewerProps {
  isOpen: boolean
  onClose: () => void
  pptUrl: string
  title?: string
  totalSlides?: number
  fileId?: string
  entityType?: string
  entityId?: string
  tabType?: string
  subcategory?: string
  folderPath?: string[]
  apiBaseUrl?: string
  initialMcqs?: any[]
  isTeacher?: boolean
  isStudent?: boolean
  sampleLiveLink?: string
  // NEW PROPS FOR BREADCRUMB
  breadcrumbs?: BreadcrumbItem[]
  currentCourseName?: string
  currentCourseId?: string
  onNavigateToDashboard?: () => void
  onNavigateToCourses?: () => void
  onNavigateToCourse?: () => void
}


interface BreadcrumbItem {
  id: string;
  type: string;
  label: string;
  path?: string;
  onClick?: () => void;
}


// ─── MAIN PPT VIEWER ──────────────────────────────────────────────────────────
// Add this interface at the top of pptView.tsx
interface BreadcrumbItem {
  id: string;
  type: string;
  label: string;
  path?: string;
  onClick?: () => void;
}

// Update the PPTViewerProps interface
interface PPTViewerProps {
  isOpen: boolean
  onClose: () => void
  pptUrl: string
  title?: string
  totalSlides?: number
  fileId?: string
  entityType?: string
  entityId?: string
  tabType?: string
  subcategory?: string
  folderPath?: string[]
  apiBaseUrl?: string
  initialMcqs?: any[]
  isTeacher?: boolean
  isStudent?: boolean
  sampleLiveLink?: string
  // NEW PROPS FOR BREADCRUMB
  breadcrumbs?: BreadcrumbItem[]
  currentCourseName?: string
  currentCourseId?: string
  onNavigateToDashboard?: () => void
  onNavigateToCourses?: () => void
  onNavigateToCourse?: () => void
}

// Update the component to accept these props
export default function PPTViewer({
  isOpen, onClose, pptUrl,
  title = "Presentation",
  totalSlides = 20,
  fileId = "", entityType = "", entityId = "",
  tabType = "", subcategory = "", folderPath = [],
  apiBaseUrl = "https://lmsserver-yeve.onrender.com",
  initialMcqs = [],
  isTeacher = true, isStudent = false,
  sampleLiveLink = "https://example.com/live-mcq-sample",
  // NEW PROPS WITH DEFAULTS
  breadcrumbs = [],
  currentCourseName = "Course",
  currentCourseId = "",
  onNavigateToDashboard,
  onNavigateToCourses,
  onNavigateToCourse,
}: PPTViewerProps) {
  // ... rest of your existing state and functions remain the same
  const [zoom, setZoom] = useState(1)
  const [currentSlide, setCurrentSlide] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showMcqList, setShowMcqList] = useState(false)

  // MCQ state — mirrors PDFViewer exactly
  const [savedMcqs, setSavedMcqs] = useState<any[]>(initialMcqs || [])
  const [showMcqForm, setShowMcqForm] = useState(false)
  const [mcqSlideNumber, setMcqSlideNumber] = useState(1)
  const [showAnnotationModal, setShowAnnotationModal] = useState(false)
  const [annotationModalSlide, setAnnotationModalSlide] = useState(0)
  const [mcqMode, setMcqMode] = useState<"default" | "link">("default")
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slideNumber: number } | null>(null)
  const [generatedLinkData, setGeneratedLinkData] = useState<{ link: string; slideNumber: number; questionCount: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  // ── Slide-image conversion (MUST mirror the student viewer so slide indices
  //    line up exactly between teacher and student) ────────────────────────────
  const [autoSlideImages, setAutoSlideImages] = useState<string[]>([])
  const [autoConverting, setAutoConverting] = useState(false)
  const [autoConvertError, setAutoConvertError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const autoCache = useRef<Record<string, string[]>>({})

  const effectiveSlides = autoSlideImages
  const useImageMode = effectiveSlides.length > 0
  // Real slide count comes from the converted images; fall back to the prop only
  // while converting / on failure.
  const effectiveTotalSlides = useImageMode ? effectiveSlides.length : totalSlides
  const currentImageUrl = effectiveSlides[currentSlide - 1]

  useEffect(() => {
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
        const res = await fetch("https://lmsserver-yeve.onrender.com/api/ppt/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pptUrl }),
        })
        const data = await res.json()
        if (cancelled) return
        if (data.success && data.slideImages?.length > 0) {
          autoCache.current[pptUrl] = data.slideImages
          setAutoSlideImages(data.slideImages)
        } else {
          setAutoConvertError(data.error || "Conversion failed")
        }
      } catch (err: any) {
        if (!cancelled) setAutoConvertError(err.message)
      } finally {
        if (!cancelled) setAutoConverting(false)
      }
    })()

    return () => { cancelled = true }
  }, [pptUrl, retryCount])

  // Clamp current slide if the real slide count differs from the assumed prop
  useEffect(() => {
    if (useImageMode && currentSlide > effectiveTotalSlides) {
      setCurrentSlide(effectiveTotalSlides)
    }
  }, [useImageMode, effectiveTotalSlides, currentSlide])

  // Preload adjacent slide images so next/prev navigation is instant
  useEffect(() => {
    if (!useImageMode) return
    const nextUrl = effectiveSlides[currentSlide]     // currentSlide is 1-based → index of next slide
    const prevUrl = effectiveSlides[currentSlide - 2] // index of previous slide
    if (nextUrl) { new window.Image().src = nextUrl }
    if (prevUrl) { new window.Image().src = prevUrl }
  }, [useImageMode, currentSlide, effectiveSlides])

  // ── helpers ──────────────────────────────────────────────────────────────────
  const getMcqSlide = (q: any): number => {
    const raw = q.pageNumber ?? q.videoTimestamp ?? q.timestamp ?? 0
    return typeof raw === "number" ? Math.round(raw) : parseInt(String(raw)) || 0
  }

  const mcqsBySlide = React.useMemo(() => {
    const map = new Map<number, any[]>()
    savedMcqs.forEach(mcq => {
      const slide = getMcqSlide(mcq)
      if (!map.has(slide)) map.set(slide, [])
      map.get(slide)!.push(mcq)
    })
    return map
  }, [savedMcqs])

  const slidesWithMcqs = new Set(Array.from(mcqsBySlide.keys()))
  const mcqsOnCurrentSlide = mcqsBySlide.get(currentSlide) || []

  // ── navigation (click-based, no scroll — mirrors PDF) ────────────────────────
  const goToSlide = (n: number) => {
    setCurrentSlide(Math.max(1, Math.min(effectiveTotalSlides || 1, n)))
    // Scroll body back to top so the slide view is always centred
    if (bodyRef.current) bodyRef.current.scrollTop = 0
  }

  // ── MCQ handlers ─────────────────────────────────────────────────────────────
  const openMcqForm = (slide: number, mode: "default" | "link" = "default") => {
    setMcqSlideNumber(slide); setMcqMode(mode); setShowMcqForm(true)
  }

  const handleMcqSave = (questions: any[]) => {
    setSavedMcqs(prev => [...prev, ...questions.map(q => ({ ...q, savedAt: new Date() }))])
    if (mcqMode !== "link") setShowMcqForm(false)
  }

  const handleLinkGenerated = (link: string, questionCount: number) => {
    setGeneratedLinkData({ link, slideNumber: mcqSlideNumber, questionCount })
    setShowMcqForm(false)
  }

  // ── keyboard shortcuts (mirrors PDF) ─────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpen || showMcqForm || generatedLinkData) return
      if (e.key === "Escape" && isFullscreen) document.exitFullscreen?.()
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goToSlide(currentSlide + 1) }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goToSlide(currentSlide - 1) }
      if (e.key === "+" || e.key === "=") setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))
      if (e.key === "-") setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen, showMcqForm, generatedLinkData, isFullscreen, currentSlide, effectiveTotalSlides])

  useEffect(() => {
    const fn = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", fn)
    return () => document.removeEventListener("fullscreenchange", fn)
  }, [])

  const handleDownload = () => { const a = document.createElement("a"); a.href = pptUrl; a.download = title || "presentation.pptx"; a.click() }
  const handleFullscreen = async () => {
    if (!containerRef.current) return
    try { if (!isFullscreen) await containerRef.current.requestFullscreen(); else await document.exitFullscreen() } catch {}
  }

  if (!isOpen) return null

  return (
    <div ref={containerRef} style={{ position: "fixed", inset: 0, zIndex: isFullscreen ? 2000 : 1000, backgroundColor: "#111827", display: "flex", flexDirection: "column" }}>
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
      }}>
        {breadcrumbs.length > 0 ? (
          // Use passed breadcrumbs from LMSCoordinator
          breadcrumbs.map((crumb, idx) => (
            <div key={crumb.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {idx > 0 && <ChevronRight size={12} style={{ color: "#cbd5e1", flexShrink: 0 }} />}
              <button
                onClick={() => {
                  if (crumb.onClick) {
                    crumb.onClick();
                  } else if (crumb.type === "dashboard" && onNavigateToDashboard) {
                    onNavigateToDashboard();
                  } else if (crumb.type === "courses" && onNavigateToCourses) {
                    onNavigateToCourses();
                  } else if (crumb.type === "course" && onNavigateToCourse) {
                    onNavigateToCourse();
                  }
                }}
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
          // Fallback static breadcrumbs if none passed
          <>
            {/* Dashboard */}
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

            {/* Courses */}
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

            {/* Current Course (active) */}
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

    {/* Main header bar with file info and controls */}
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
        <FileText size={15} style={{ flexShrink: 0, color: "#fb923c" }} />
        <span style={{ 
          fontSize: 13, 
          fontWeight: 600, 
          color: "#1e293b",
          maxWidth: 220, 
          overflow: "hidden", 
          textOverflow: "ellipsis", 
          whiteSpace: "nowrap" 
        }} title={title}>
          {title}
        </span>
        {!isStudent && isTeacher && (
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

      {/* Right side - Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {/* Slide navigation */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 4, 
          backgroundColor: "#f8fafc", 
          borderRadius: 8, 
          padding: "4px 8px", 
          border: "1px solid #e2e8f0" 
        }}>
          <button 
            onClick={() => goToSlide(currentSlide - 1)} 
            disabled={currentSlide <= 1}
            style={{ 
              background: "none", 
              border: "none", 
              color: currentSlide <= 1 ? "#cbd5e1" : "#64748b", 
              cursor: currentSlide <= 1 ? "not-allowed" : "pointer", 
              padding: 2, 
              display: "flex",
            }}
          >
            <ChevronLeft size={14} />
          </button>
          
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {slidesWithMcqs.has(currentSlide) && (
              <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#a78bfa" }} />
            )}
            <span style={{ fontSize: 11, color: "#64748b" }}>Slide</span>
            <span style={{ 
              minWidth: 32, 
              padding: "2px 6px", 
              backgroundColor: "#ffffff", 
              border: "1px solid #e2e8f0", 
              borderRadius: 6, 
              color: "#1e293b", 
              fontSize: 12, 
              fontWeight: 600, 
              textAlign: "center" 
            }}>
              {currentSlide}
            </span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>/ {effectiveTotalSlides}</span>
          </div>

          <button
            onClick={() => goToSlide(currentSlide + 1)}
            disabled={currentSlide >= effectiveTotalSlides}
            style={{
              background: "none",
              border: "none",
              color: currentSlide >= effectiveTotalSlides ? "#cbd5e1" : "#64748b",
              cursor: currentSlide >= effectiveTotalSlides ? "not-allowed" : "pointer",
              padding: 2,
              display: "flex",
            }}
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Zoom controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <button 
            onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} 
            style={{ padding: "5px 8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", display: "flex" }}
          >
            <ZoomOut size={13} />
          </button>
          <span style={{ fontSize: 11, color: "#64748b", minWidth: 38, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button 
            onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))} 
            style={{ padding: "5px 8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", display: "flex" }}
          >
            <ZoomIn size={13} />
          </button>
        </div>

        {/* Fullscreen button */}
        <button 
          onClick={handleFullscreen} 
          style={{ padding: "5px 8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", display: "flex" }}
        >
          {isFullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
        </button>

        {/* Download button */}
        <button 
          onClick={handleDownload} 
          style={{ padding: "5px 8px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", display: "flex" }}
        >
          <Download size={13} />
        </button>
      </div>
    </div>
  </div>
)}
      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>

        {/* Main slide area — single visible slide, no scroll (mirrors PDF) */}
        <div
          ref={bodyRef}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "auto",
            backgroundColor: "#374151",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "16px 16px 24px",
            gap: 12,
          }}
        >
          {/* Teacher hint banner — mirrors PDF sticky hint */}
          {/* {!isStudent && isTeacher && (
            <div style={{
              position: "sticky", top: 10, zIndex: 10,
              backgroundColor: "rgba(0,0,0,0.7)", color: "#9ca3af",
              fontSize: 10, padding: "6px 12px", borderRadius: 20,
              border: "1px solid #374151",
              display: "flex", alignItems: "center", gap: 6,
              marginBottom: 10, pointerEvents: "none", whiteSpace: "nowrap",
            }}>
              <MousePointer size={10} color="#a78bfa" />
              Right-click: <span style={{ color: "#a78bfa" }}>Add MCQ</span> or <span style={{ color: "#f59e0b" }}>Live Add MCQ</span>
            </div>
          )} */}

          {/* Current slide canvas — ONE slide visible at a time */}
         <div style={{ width: "100%", maxWidth: 1200, flexShrink: 0, position: "relative" }}>
  {autoConverting ? (
    <div style={{ textAlign: "center", padding: "64px 24px", color: "#e5e7eb" }}>
      <div style={{ width: 56, height: 56, border: "4px solid rgba(124,58,237,0.2)", borderTopColor: "#a78bfa", borderRadius: "50%", animation: "spin 0.75s linear infinite", margin: "0 auto 20px" }} />
      <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Converting presentation…</p>
      <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>This may take 30–60 seconds on first load</p>
    </div>
  ) : autoConvertError ? (
    <div style={{ textAlign: "center", padding: "64px 24px", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <FileText size={28} style={{ color: "#ef4444" }} />
      </div>
      <p style={{ fontWeight: 700, color: "#f3f4f6", marginBottom: 8, fontSize: 15 }}>Conversion failed</p>
      <p style={{ color: "#9ca3af", fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>{autoConvertError}</p>
      <button
        onClick={() => { delete autoCache.current[pptUrl]; setAutoSlideImages([]); setAutoConvertError(null); setRetryCount(c => c + 1) }}
        style={{ marginRight: 10, padding: "10px 20px", background: "linear-gradient(135deg,#7c3aed,#6366f1)", color: "white", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 13 }}
      >
        Retry
      </button>
      <button onClick={handleDownload} style={{ padding: "10px 20px", background: "#4b5563", color: "white", border: "none", borderRadius: 10, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
        Download instead
      </button>
    </div>
  ) : (
    <SlideCanvas
      imageUrl={currentImageUrl}
      slideNumber={currentSlide}
      zoom={zoom}
      onContextMenu={!isStudent && isTeacher ? (e, slide) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, slideNumber: slide })
      } : undefined}
      showMcqMarker={mcqsOnCurrentSlide.length > 0}
      mcqCount={mcqsOnCurrentSlide.length}
    />
  )}
  {!isStudent && isTeacher && useImageMode && (
    <button
      onClick={() => { setAnnotationModalSlide(currentSlide); setShowAnnotationModal(true) }}
      style={{
        position: "absolute", top: 10, right: 10,
        padding: "4px 10px",
        backgroundColor: mcqsOnCurrentSlide.length > 0 ? "rgba(242,119,87,0.88)" : "rgba(124,58,237,0.82)",
        color: "white", border: "none", borderRadius: 6,
        cursor: "pointer", fontSize: 11, fontWeight: 700,
        display: "flex", alignItems: "center", gap: 4,
        zIndex: 15, backdropFilter: "blur(4px)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      }}
    >
      {mcqsOnCurrentSlide.length > 0 ? `✏ Edit MCQ (${mcqsOnCurrentSlide.length})` : `+ Add MCQ · Slide ${currentSlide}`}
    </button>
  )}
</div>

          {/* Prev / Next nav arrows below slide — mirrors PDF ergonomics */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
            <button
              onClick={() => goToSlide(currentSlide - 1)}
              disabled={currentSlide <= 1}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 18px", backgroundColor: currentSlide <= 1 ? "#1f2937" : "#374151",
                color: currentSlide <= 1 ? "#374151" : "#e5e7eb",
                border: "1px solid #4b5563", borderRadius: 8,
                cursor: currentSlide <= 1 ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 600, transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (currentSlide > 1) e.currentTarget.style.backgroundColor = "#4b5563" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = currentSlide <= 1 ? "#1f2937" : "#374151" }}
            >
              <ChevronLeft size={15} /> Previous
            </button>

            {/* Slide dots / jump inputs — mirrors PDF page indicator */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, backgroundColor: "#111827", borderRadius: 8, padding: "6px 12px", border: "1px solid #374151" }}>
              {slidesWithMcqs.has(currentSlide) && <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#a78bfa" }} />}
              <span style={{ fontSize: 12, color: "#9ca3af" }}>
                Slide <strong style={{ color: "white" }}>{currentSlide}</strong> / {effectiveTotalSlides}
              </span>
            </div>

            <button
              onClick={() => goToSlide(currentSlide + 1)}
              disabled={currentSlide >= effectiveTotalSlides}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 18px", backgroundColor: currentSlide >= effectiveTotalSlides ? "#1f2937" : "#374151",
                color: currentSlide >= effectiveTotalSlides ? "#374151" : "#e5e7eb",
                border: "1px solid #4b5563", borderRadius: 8,
                cursor: currentSlide >= effectiveTotalSlides ? "not-allowed" : "pointer",
                fontSize: 12, fontWeight: 600, transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (currentSlide < effectiveTotalSlides) e.currentTarget.style.backgroundColor = "#4b5563" }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = currentSlide >= effectiveTotalSlides ? "#1f2937" : "#374151" }}
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* MCQ list side panel — mirrors PDFViewer MCQ panel exactly */}
        {showMcqList && savedMcqs.length > 0 && (
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 290,
            backgroundColor: "#1f2937", borderLeft: "1px solid #374151",
            display: "flex", flexDirection: "column", zIndex: 20,
          }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #374151", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "white", fontWeight: 600, fontSize: 13 }}>All MCQs ({savedMcqs.length})</span>
              <button onClick={() => setShowMcqList(false)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: 2 }}><X size={15} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
              {savedMcqs.map((mcq, i) => {
                const slide = getMcqSlide(mcq)
                const isLink = mcq.type === "link"
                return (
                  <div key={mcq.id + i}
                    onClick={() => goToSlide(slide)}
                    style={{
                      padding: 10, borderRadius: 7,
                      border: `1px solid ${slide === currentSlide ? "#7c3aed" : "#374151"}`,
                      marginBottom: 6,
                      backgroundColor: slide === currentSlide ? "rgba(124,58,237,0.1)" : "#111827",
                      cursor: "pointer",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                      <Hash size={11} color="#a78bfa" />
                      <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700 }}>Slide {slide}</span>
                      <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700, backgroundColor: isLink ? "rgba(245,158,11,0.2)" : "rgba(124,58,237,0.2)", color: isLink ? "#f59e0b" : "#a78bfa" }}>
                        {isLink ? "link" : "default"}
                      </span>
                      {slide === currentSlide && <span style={{ marginLeft: "auto", fontSize: 9, backgroundColor: "#7c3aed", color: "white", padding: "1px 5px", borderRadius: 3 }}>current</span>}
                    </div>
                    <p style={{ fontSize: 12, color: "#e5e7eb", fontWeight: 500, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {mcq.questionTitle?.replace(/<[^>]*>/g, "").trim() || "Untitled"}
                    </p>
                    {isLink && mcq.link && <p style={{ fontSize: 9, color: "#f59e0b", margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🔗 {mcq.link}</p>}
                    <p style={{ fontSize: 9, color: "#4b5563", margin: "4px 0 0" }}>Click to jump to slide</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && !isStudent && isTeacher && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          slideNumber={contextMenu.slideNumber}
          onAddMcq={slide => { openMcqForm(slide, "default"); setContextMenu(null) }}
          onLiveAddMcq={slide => { openMcqForm(slide, "link"); setContextMenu(null) }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Fullscreen exit button */}
      {isFullscreen && (
        <button onClick={() => document.exitFullscreen?.()} style={{ position: "fixed", top: 16, right: 16, zIndex: 2100, padding: "7px 14px", backgroundColor: "rgba(0,0,0,0.7)", color: "white", border: "1px solid #374151", borderRadius: 7, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Minimize size={15} /> Exit Fullscreen
        </button>
      )}

      {/* MCQ Form */}
      {showMcqForm && (
        <MCQQuestionForm
          initialSlideNumber={mcqSlideNumber}
          onClose={() => setShowMcqForm(false)}
          onSave={handleMcqSave}
          onLinkGenerated={handleLinkGenerated}
          fileId={fileId} fileName={title}
          entityType={entityType} entityId={entityId}
          tabType={tabType} subcategory={subcategory}
          folderPath={folderPath} apiBaseUrl={apiBaseUrl}
          mcqMode={mcqMode} sampleLink={sampleLiveLink}
        />
      )}

      {/* Generated Link Popup */}
      {generatedLinkData && (
        <GeneratedLinkPopup
          link={generatedLinkData.link}
          slideNumber={generatedLinkData.slideNumber}
          questionCount={generatedLinkData.questionCount}
          fileName={title}
          onClose={() => setGeneratedLinkData(null)}
        />
      )}

      {showAnnotationModal && !isStudent && isTeacher && (
        <FileMCQAnnotationForm
          positionValue={annotationModalSlide}
          positionLabel={`Slide ${annotationModalSlide}`}
          positionField="pageNumber"
          entityType={entityType}
          entityId={entityId}
          tabType={tabType}
          subcategory={subcategory}
          folderPath={folderPath}
          fileId={fileId}
          apiBaseUrl={apiBaseUrl}
          initialQuestions={mcqsBySlide.get(annotationModalSlide) || []}
          onQuestionsChanged={updatedQs => {
            setSavedMcqs(prev => {
              const others = prev.filter(q => getMcqSlide(q) !== annotationModalSlide)
              return [...others, ...updatedQs]
            })
          }}
          onClose={() => setShowAnnotationModal(false)}
        />
      )}

      <style>{`
        @keyframes ctxFade { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}