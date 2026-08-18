"use client"
import { getToken } from "@/lib/session";

import React, { useState, useRef, useEffect } from "react"
import {
  X, Check, Trash2, Plus, Loader, AlertCircle, Image as ImageIcon,
  CloudUpload, HelpCircle, Bold, Italic, Underline as UnderlineIcon,
  GraduationCap, Hash, BookOpen, CheckCircle2, ChevronRight,
} from "lucide-react"

// ─── TYPES ──────────────────────────────────────────────────────────────────────
interface MCQOpt {
  text: string
  isCorrect: boolean
  imageUrl?: string
}

export interface FileMCQAnnotationFormProps {
  positionValue: number
  positionLabel: string
  positionField: "pageNumber" | "videoTimestamp"
  entityType: string
  entityId: string
  tabType: string
  subcategory: string
  folderPath: string[]
  fileId: string
  apiBaseUrl: string
  initialQuestions: any[]
  onQuestionsChanged: (questions: any[]) => void
  onClose: () => void
}

// ─── INJECT FULL LMS STYLES (same block as MCQQuestionForm) ─────────────────────
const injectLmsStyles = (() => {
  let done = false
  return () => {
    if (done || typeof document === "undefined") return
    done = true
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap"
    document.head.appendChild(link)
    const s = document.createElement("style")
    s.textContent = `
      :root {
        --lms-orange:#F27757; --lms-orange-dark:#e0623f;
        --lms-orange-glow:rgba(242,119,87,0.22); --lms-orange-light:rgba(242,119,87,0.08);
        --lms-orange-50:#FEF3EF; --lms-orange-100:#FDDDD4;
        --lms-text-main:#1a1a2e; --lms-text-sec:#6b6b7e;
        --lms-text-muted:#8b8b9e; --lms-text-hint:#bcbccc;
        --lms-border:#e4e4ed; --lms-border-hover:#d0d0de;
        --lms-bg-white:#ffffff; --lms-bg-surface:#f7f7fb; --lms-bg-surface2:#f0f0f7;
        --lms-success:#16a34a; --lms-success-bg:#f0fdf4; --lms-success-bdr:#bbf7d0;
        --lms-danger:#e53e3e; --lms-danger-bg:#fff5f5; --lms-danger-bdr:#fed7d7;
        --lms-info:#F97316; --lms-info-bg:#FFF7ED; --lms-info-bdr:#FED7AA;
        --lms-violet:#7c3aed; --lms-violet-bg:#f5f3ff; --lms-violet-bdr:#ddd6fe;
        --lms-warning:#d97706; --lms-warning-bg:#fffbeb; --lms-warning-bdr:#fde68a;
        --lms-teal:#0d9488;
        --lms-radius-sm:8px; --lms-radius-md:10px; --lms-radius-lg:14px;
        --lms-font:'Poppins',-apple-system,BlinkMacSystemFont,sans-serif;
        --lms-shadow-sm:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);
        --lms-shadow-md:0 4px 14px rgba(0,0,0,0.07),0 2px 4px rgba(0,0,0,0.04);
      }
      .lms-font{font-family:var(--lms-font)!important}
      select option,select optgroup{color:#1a1a2e!important;background:white!important}
      .lms-underline-select{-webkit-appearance:none;-moz-appearance:none;appearance:none;background:transparent;border:none;border-bottom:1.5px solid var(--lms-border);border-radius:0;padding:4px 24px 4px 0;font-size:13px;font-weight:600;color:var(--lms-text-main);cursor:pointer;outline:none;transition:border-color .15s;font-family:var(--lms-font)}
      .lms-underline-select:focus{border-bottom-color:var(--lms-orange)}
      .lms-underline-input{background:transparent;border:none;border-bottom:1.5px solid var(--lms-border);border-radius:0;padding:4px 4px 4px 0;font-size:13px;font-weight:600;color:var(--lms-text-main);outline:none;transition:border-color .15s;font-family:var(--lms-font)}
      .lms-underline-input:focus{border-bottom-color:var(--lms-orange)}
      .lms-q-text-editor{font-size:15px!important;font-weight:500!important;color:var(--lms-text-main)!important;line-height:1.65!important;caret-color:var(--lms-orange);font-family:var(--lms-font)!important}
      .lms-option-input{font-size:14px!important;color:var(--lms-text-main)!important;font-weight:500;font-family:var(--lms-font)!important}
      .lms-option-input::placeholder{color:var(--lms-text-sec)!important;font-weight:400}
      .lms-option-row{display:flex;align-items:center;gap:10px;padding:7px 4px 8px;border-bottom:1px solid var(--lms-border);position:relative;cursor:text;transition:padding .18s ease}
      .lms-option-row::after{content:'';position:absolute;bottom:-1px;left:50%;transform:translateX(-50%) scaleX(0);width:100%;height:2px;background:var(--lms-orange);border-radius:1px;transition:transform .22s cubic-bezier(.4,0,.2,1);transform-origin:center}
      .lms-option-row:focus-within{padding-top:9px;padding-bottom:10px}
      .lms-option-row:focus-within::after{transform:translateX(-50%) scaleX(1)}
      .lms-option-input:focus::placeholder{color:var(--lms-text-hint)!important}
      .lms-answer-key-btn{display:inline-flex;align-items:center;gap:7px;color:var(--lms-info);font-size:13.5px;font-weight:600;font-family:var(--lms-font);background:none;border:none;padding:0;cursor:pointer;transition:color .15s}
      .lms-answer-key-btn:hover{color:#EA580C}
      .lms-answer-key-checkbox{width:16px;height:16px;border:2px solid var(--lms-info);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:white;transition:background .15s;cursor:pointer}
      .lms-answer-key-btn:hover .lms-answer-key-checkbox{background:var(--lms-info-bg)}
      .lms-diff-underline-btn{display:inline-flex;align-items:center;gap:6px;background:transparent;border:none;border-bottom:1.5px solid var(--lms-border);border-radius:0;padding:4px 20px 4px 0;font-size:13px;font-weight:600;font-family:var(--lms-font);color:var(--lms-text-hint);cursor:pointer;outline:none;position:relative;transition:border-color .15s}
      .lms-diff-underline-btn.has-value{color:var(--lms-text-main)}
      .lms-diff-dropdown{position:absolute;top:calc(100% + 6px);right:0;z-index:200;background:var(--lms-bg-white);border:1.5px solid var(--lms-border);border-radius:var(--lms-radius-md);box-shadow:var(--lms-shadow-md);min-width:140px;overflow:hidden;padding:4px 0}
      .lms-diff-dropdown-item{display:flex;align-items:center;gap:8px;padding:8px 14px;font-size:13px;font-weight:500;font-family:var(--lms-font);cursor:pointer;color:var(--lms-text-main);transition:background .1s}
      .lms-diff-dropdown-item:hover{background:var(--lms-bg-surface)}
      .lms-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--lms-radius-md);font-family:var(--lms-font);font-size:12.5px;font-weight:600;border:1.5px solid;cursor:pointer;transition:all .15s;white-space:nowrap}
      .lms-btn-orange{background:var(--lms-orange);color:white;border-color:transparent;box-shadow:0 2px 8px var(--lms-orange-glow)}
      .lms-btn-orange:hover:not(:disabled){background:var(--lms-orange-dark);box-shadow:0 3px 12px rgba(242,119,87,.35);transform:translateY(-1px)}
      .lms-btn-orange:disabled{opacity:.55;cursor:not-allowed}
      .lms-btn-ghost-orange{background:var(--lms-bg-white);color:#c85a30;border-color:#f2b9a3}
      .lms-btn-ghost-orange:hover{background:var(--lms-orange-50)}
      .lms-btn-slate{background:var(--lms-bg-white);color:var(--lms-text-sec);border-color:var(--lms-border)}
      .lms-btn-slate:hover{background:var(--lms-bg-surface2)}
      .lms-nav-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border-radius:var(--lms-radius-md);font-family:var(--lms-font);font-size:12.5px;font-weight:600;border:1.5px solid var(--lms-border);background:var(--lms-bg-white);color:var(--lms-text-sec);cursor:pointer;transition:all .15s}
      .lms-nav-btn:hover:not(:disabled){background:var(--lms-bg-surface);border-color:var(--lms-border-hover)}
      .lms-nav-btn:disabled{opacity:.3;cursor:not-allowed}
      .lms-ak-option-btn{width:100%;display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--lms-radius-md);text-align:left;transition:all .12s;font-size:13.5px;font-family:var(--lms-font);font-weight:500;cursor:pointer;border:1.5px solid}
      .lms-ak-option-btn.correct{background:var(--lms-success-bg);border-color:var(--lms-success-bdr);color:#14532d}
      .lms-ak-option-btn.neutral{background:var(--lms-bg-white);border-color:var(--lms-border);color:var(--lms-text-main)}
      .lms-ak-option-btn.neutral:hover{border-color:var(--lms-border-hover);background:var(--lms-bg-surface)}
      .lms-ak-done-btn{padding:8px 22px;border-radius:var(--lms-radius-md);background:var(--lms-success);color:white;border:none;font-family:var(--lms-font);font-size:13.5px;font-weight:600;cursor:pointer;transition:background .15s}
      .lms-ak-done-btn:hover{background:#15803d}
      .lms-section-label{font-size:10.5px;font-weight:700;color:var(--lms-text-hint);text-transform:uppercase;letter-spacing:.07em;font-family:var(--lms-font);margin-bottom:8px}
      .lms-sidebar-section-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--lms-text-main);margin-bottom:10px;font-family:var(--lms-font)}
      .lms-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11.5px;font-weight:600;border:1.5px solid;font-family:var(--lms-font)}
      .lms-badge-green{background:var(--lms-success-bg);color:var(--lms-success);border-color:var(--lms-success-bdr)}
      .lms-badge-amber{background:var(--lms-warning-bg);color:var(--lms-warning);border-color:var(--lms-warning-bdr)}
      .lms-badge-orange{background:var(--lms-orange-50);color:#c85a30;border-color:var(--lms-orange-100)}
      .lms-badge-violet{background:var(--lms-violet-bg);color:var(--lms-violet);border-color:var(--lms-violet-bdr)}
      .lms-header-logo-mark{width:34px;height:34px;background:var(--lms-orange);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px var(--lms-orange-glow)}
      .lms-fmt-btn{padding:5px;border:none;background:none;cursor:pointer;color:var(--lms-text-muted);border-radius:7px;transition:all .12s;display:flex;align-items:center;justify-content:center}
      .lms-fmt-btn:hover{background:var(--lms-bg-surface2);color:var(--lms-text-main)}
      .lms-fmt-btn.active{background:var(--lms-orange-100);color:#c85a30}
      .lms-icon-btn{width:32px;height:32px;border:1.5px solid;border-radius:var(--lms-radius-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;background:none;flex-shrink:0}
      .lms-icon-btn-red{border-color:var(--lms-danger-bdr);background:var(--lms-danger-bg);color:var(--lms-danger)}
      .lms-icon-btn-red:hover{background:#fed7d7}
      .lms-icon-btn-slate{border-color:var(--lms-border);background:var(--lms-bg-surface);color:var(--lms-text-muted)}
      .lms-icon-btn-slate:hover{background:var(--lms-bg-surface2);color:var(--lms-text-main)}
      .lms-tooltip-wrap{position:relative}
      .lms-tooltip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#1a1a2e;color:white;font-size:11px;font-weight:500;font-family:var(--lms-font);padding:5px 10px;border-radius:7px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s;z-index:1000;box-shadow:0 4px 12px rgba(0,0,0,.2)}
      .lms-tooltip::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:4px solid transparent;border-top-color:#1a1a2e}
      .lms-tooltip-wrap:hover .lms-tooltip{opacity:1}
      .lms-tooltip-right{left:auto;right:0;transform:none}
      .lms-tooltip-right::after{left:auto;right:10px;transform:none}
      .lms-preview-card{background:var(--lms-bg-white);border:1.5px solid var(--lms-border);border-radius:var(--lms-radius-md);overflow:hidden;transition:border-color .15s,box-shadow .15s}
      .lms-preview-card.active{border-color:var(--lms-orange);box-shadow:0 0 0 3px var(--lms-orange-light)}
      ::-webkit-scrollbar{width:4px;height:4px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:var(--lms-border);border-radius:4px}
      input[type="checkbox"]{accent-color:var(--lms-orange)}
      @keyframes lms-spin{to{transform:rotate(360deg)}}
      @keyframes lms-fade-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
    `
    document.head.appendChild(s)
  }
})()

// ─── HELPERS ────────────────────────────────────────────────────────────────────
const emptyOpts = (): MCQOpt[] => [
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
]

function readQ(q: any): { title: string; expl: string; opts: MCQOpt[] } {
  const inner = q.mcqQuestion || q
  const title = (inner.questionTitle || inner.mcqQuestionTitle || inner.title || "").replace(/<[^>]*>/g, "").trim()
  const expl = (inner.explanation || inner.mcqQuestionDescription || "").replace(/<[^>]*>/g, "")
  const raw: any[] = inner.options || inner.mcqQuestionOptions || []
  const opts: MCQOpt[] = raw.map((o: any) => ({ text: o.text || "", isCorrect: !!o.isCorrect, imageUrl: o.imageUrl || "" }))
  while (opts.length < 4) opts.push({ text: "", isCorrect: false })
  return { title, expl, opts: opts.slice(0, 4) }
}

// ─── IMAGE UPLOAD MODAL (exact match to MCQQuestionForm's ImageUploadModal) ─────
const ImageUploadModal: React.FC<{ onUpload: (url: string) => void; onClose: () => void }> = ({ onUpload, onClose }) => {
  const [tab, setTab] = useState<"upload" | "url">("upload")
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState("")
  const [urlVal, setUrlVal] = useState("")
  const [urlErr, setUrlErr] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const doUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) { setErr("Please select an image file."); return }
    setUploading(true); setErr("")
    try {
      const token = typeof window !== "undefined" ? getToken() : null
      const fd = new FormData(); fd.append("image", file)
      const res = await fetch("http://localhost:5533/upload/question-image", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || "Upload failed")
      onUpload(json.url)
    } catch (e: any) { setErr(e.message || "Upload failed."); setUploading(false) }
  }

  const TAB = (active: boolean): React.CSSProperties => ({
    fontFamily: "var(--lms-font)", fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? "var(--lms-orange)" : "var(--lms-text-sec)",
    borderBottom: active ? "2px solid var(--lms-orange)" : "2px solid transparent",
    paddingBottom: 10, paddingTop: 10, paddingLeft: 4, paddingRight: 4,
    background: "none", cursor: "pointer", transition: "all 0.15s",
  })

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: "rgba(26,26,46,0.45)", backdropFilter: "blur(2px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" style={{ border: "1px solid var(--lms-border)" }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <span className="text-sm font-bold" style={{ color: "var(--lms-text-main)", fontFamily: "var(--lms-font)" }}>Insert Image</span>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" style={{ color: "var(--lms-text-muted)" }} />
          </button>
        </div>
        <div className="flex items-center gap-5 px-5 border-b" style={{ borderColor: "var(--lms-border)" }}>
          <button type="button" style={TAB(tab === "upload")} onClick={() => { setTab("upload"); setErr("") }}>Upload</button>
          <button type="button" style={TAB(tab === "url")} onClick={() => { setTab("url"); setUrlErr("") }}>By URL</button>
        </div>
        <div className="p-5">
          {tab === "upload" ? (
            <>
              <div onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) doUpload(f) }}
                className="flex flex-col items-center justify-center gap-3 rounded-xl py-9 transition-all"
                style={{ border: `2px dashed ${dragging ? "var(--lms-orange)" : "var(--lms-border)"}`, background: dragging ? "var(--lms-orange-light)" : "var(--lms-bg-surface)" }}>
                {uploading ? (
                  <><Loader className="h-8 w-8" style={{ color: "var(--lms-orange)", animation: "lms-spin 0.8s linear infinite" }} />
                  <span className="text-sm font-medium" style={{ color: "var(--lms-text-sec)", fontFamily: "var(--lms-font)" }}>Uploading…</span></>
                ) : (
                  <>
                    <CloudUpload className="h-8 w-8" style={{ color: dragging ? "var(--lms-orange)" : "var(--lms-text-hint)" }} />
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: "var(--lms-text-main)", fontFamily: "var(--lms-font)" }}>Drag & drop image here</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--lms-text-hint)", fontFamily: "var(--lms-font)" }}>PNG, JPG, GIF, WEBP supported</p>
                    </div>
                    <div className="flex items-center gap-2 w-full px-4">
                      <div className="flex-1 h-px" style={{ background: "var(--lms-border)" }} />
                      <span className="text-xs" style={{ color: "var(--lms-text-hint)", fontFamily: "var(--lms-font)" }}>or</span>
                      <div className="flex-1 h-px" style={{ background: "var(--lms-border)" }} />
                    </div>
                    <button type="button" onClick={() => inputRef.current?.click()} className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                      style={{ background: "var(--lms-orange)", color: "#fff", fontFamily: "var(--lms-font)" }}>Browse Files</button>
                    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f); e.target.value = "" }} />
                  </>
                )}
              </div>
              {err && <div className="mt-2.5 flex items-center gap-1.5 text-xs" style={{ color: "var(--lms-danger)", fontFamily: "var(--lms-font)" }}><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{err}</div>}
            </>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: "var(--lms-text-muted)", fontFamily: "var(--lms-font)" }}>Only use images that you have the license to use.</p>
              <div className="flex gap-2">
                <input type="text" value={urlVal} onChange={e => { setUrlVal(e.target.value); if (urlErr) setUrlErr("") }}
                  onKeyDown={e => { if (e.key === "Enter") { const t = urlVal.trim(); if (!t) return setUrlErr("Enter URL"); if (!/^https?:\/\/.+/i.test(t)) return setUrlErr("Invalid URL"); onUpload(t) } }}
                  placeholder="Paste URL of image..." autoFocus className="flex-1 px-3 py-2 text-sm rounded-lg border outline-none transition-all"
                  style={{ borderColor: urlErr ? "var(--lms-danger)" : "var(--lms-border)", fontFamily: "var(--lms-font)", color: "var(--lms-text-main)" }} />
              </div>
              {urlErr && <div className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--lms-danger)", fontFamily: "var(--lms-font)" }}><AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{urlErr}</div>}
              <div className="flex justify-end mt-4">
                <button type="button" onClick={() => { const t = urlVal.trim(); if (!t) { setUrlErr("Enter URL"); return } if (!/^https?:\/\/.+/i.test(t)) { setUrlErr("Invalid URL"); return } onUpload(t) }}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: urlVal.trim() ? "var(--lms-orange)" : "var(--lms-border)", color: urlVal.trim() ? "#fff" : "var(--lms-text-hint)", fontFamily: "var(--lms-font)", cursor: urlVal.trim() ? "pointer" : "default" }}>
                  Insert Image
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function FileMCQAnnotationForm({
  positionValue, positionLabel, positionField,
  entityType, entityId, tabType, subcategory, folderPath, fileId, apiBaseUrl,
  initialQuestions, onQuestionsChanged, onClose,
}: FileMCQAnnotationFormProps) {
  injectLmsStyles()

  // ── State ──
  const [localQs, setLocalQs] = useState<any[]>(initialQuestions || [])
  const [editingId, setEditingId] = useState<string | null>(null)   // null = new question
  const [formOpts, setFormOpts] = useState<MCQOpt[]>(emptyOpts())
  const [formExpl, setFormExpl] = useState("")
  const [hasExpl, setHasExpl] = useState(false)
  const [formQImageUrl, setFormQImageUrl] = useState("")
  const [showAnswerKey, setShowAnswerKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [imgModal, setImgModal] = useState<{ target: "question" | number } | null>(null)
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set())
  const [isQuestionEmpty, setIsQuestionEmpty] = useState(true)
  const [validationAttempted, setValidationAttempted] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const token = () => (typeof window !== "undefined" ? getToken() : null)
  const authHeaders = () => ({ "Content-Type": "application/json", ...(token() ? { Authorization: `Bearer ${token()}` } : {}) })

  // ── Active format tracking (Bold/Italic/Underline) ──
  const updateActiveFormats = () => {
    if (typeof document === "undefined") return
    const formats = new Set<string>()
    if (document.queryCommandState("bold")) formats.add("bold")
    if (document.queryCommandState("italic")) formats.add("italic")
    if (document.queryCommandState("underline")) formats.add("underline")
    setActiveFormats(formats)
  }

  const execFmt = (cmd: string) => {
    if (typeof document === "undefined") return
    document.execCommand(cmd, false)
    editorRef.current?.focus()
    updateActiveFormats()
  }

  const getEditorHtml = () => editorRef.current?.innerHTML || ""
  const getEditorText = () => (editorRef.current?.textContent || "").trim()

  // ── Reset form ──
  const resetForm = () => {
    if (editorRef.current) editorRef.current.innerHTML = ""
    setFormOpts(emptyOpts()); setFormExpl(""); setHasExpl(false); setFormQImageUrl("")
    setEditingId(null); setError(""); setShowAnswerKey(false)
    setValidationAttempted(false); setIsQuestionEmpty(true)
  }

  // ── Load question into form ──
  const loadQuestion = (q: any) => {
    const { title, expl, opts } = readQ(q)
    if (editorRef.current) editorRef.current.innerHTML = title ? title : ""
    setIsQuestionEmpty(!title)
    setFormOpts(opts); setFormExpl(expl); setHasExpl(!!expl)
    const inner = q.mcqQuestion || q
    setFormQImageUrl(inner.questionImageUrl || "")
    setEditingId(q._id?.toString() || q.id || null)
    setError(""); setShowAnswerKey(false); setValidationAttempted(false)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  // Focus on mount (new question)
  useEffect(() => { setTimeout(() => editorRef.current?.focus(), 80) }, [])

  // ── Auth ──
  const authFetch = (url: string, opts: RequestInit) =>
    fetch(url, { ...opts, headers: { ...authHeaders(), ...(opts.headers as any || {}) } })

  // ── Delete ──
  const handleDelete = async (q: any, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const qId = q._id?.toString() || q.id
    if (!qId) return
    setDeletingId(qId)
    try {
      const res = await authFetch(`${apiBaseUrl}/file-mcq-delete/${entityType}/${entityId}`, {
        method: "DELETE",
        body: JSON.stringify({ tabType, subcategory, folderPath, fileId, questionId: qId }),
      })
      if (!res.ok) throw new Error("Delete failed")
      const updated = localQs.filter(q2 => (q2._id?.toString() || q2.id) !== qId)
      setLocalQs(updated); onQuestionsChanged(updated)
      if (editingId === qId) resetForm()
    } catch { setError("Failed to delete. Please try again.") }
    finally { setDeletingId(null) }
  }

  // ── Save ──
  const handleSave = async (andAnother = false) => {
    setValidationAttempted(true)
    const titleText = getEditorText()
    if (!titleText) { setError("Question text is required."); editorRef.current?.focus(); return }
    const filledOpts = formOpts.filter(o => o.text.trim())
    if (filledOpts.length < 2) { setError("At least 2 options are required."); return }
    if (!formOpts.some(o => o.isCorrect)) { setError("Please mark one correct answer via Set Answer Key."); return }

    setSaving(true); setError("")
    const opts = formOpts.map(o => ({ text: o.text, isCorrect: o.isCorrect, ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}) }))
    const correctAnswers = formOpts.filter(o => o.isCorrect).map(o => o.text)
    const titleHtml = getEditorHtml()

    try {
      if (editingId) {
        const res = await authFetch(`${apiBaseUrl}/file-mcq-update/${entityType}/${entityId}`, {
          method: "PUT",
          body: JSON.stringify({
            tabType, subcategory, folderPath, fileId, questionId: editingId,
            questionData: {
              mcqQuestionTitle: titleHtml,
              mcqQuestionOptions: opts,
              mcqQuestionCorrectAnswers: correctAnswers,
              mcqQuestionDescription: formExpl.trim(),
              ...(formQImageUrl ? { questionImageUrl: formQImageUrl } : {}),
            },
          }),
        })
        if (!res.ok) throw new Error("Update failed")
        const { data } = await res.json()
        const updated = localQs.map(q => (q._id?.toString() || q.id) === editingId ? (data || q) : q)
        setLocalQs(updated); onQuestionsChanged(updated)
      } else {
        const res = await authFetch(`${apiBaseUrl}/file-mcq-add/${entityType}/${entityId}`, {
          method: "POST",
          body: JSON.stringify({
            tabType, subcategory, folderPath, fileId,
            questionsData: {
              mcqQuestionTitle: titleHtml,
              mcqQuestionOptions: opts,
              mcqQuestionCorrectAnswers: correctAnswers,
              mcqQuestionDescription: formExpl.trim(),
              [positionField]: positionValue,
              ...(formQImageUrl ? { questionImageUrl: formQImageUrl } : {}),
            },
          }),
        })
        if (!res.ok) throw new Error("Save failed")
        const { data } = await res.json()
        const newQ = data?.questions?.[0] || {
          mcqQuestion: { questionTitle: titleHtml, options: opts, explanation: formExpl.trim() },
          [positionField]: positionValue, _id: Date.now().toString(),
        }
        const updated = [...localQs, newQ]
        setLocalQs(updated); onQuestionsChanged(updated)
      }
      if (andAnother) resetForm()
      else { setEditingId(null); setError("") }
    } catch (e: any) {
      setError(e.message || (editingId ? "Failed to update." : "Failed to save."))
    } finally { setSaving(false) }
  }

  const isSaved = !saving && !error && (editingId !== null || localQs.length > 0)
  const currentQIndex = editingId ? localQs.findIndex(q => (q._id?.toString() || q.id) === editingId) : -1

  return (
    <>
      {/* ── FULL SCREEN PANEL ── */}
      <div className="fixed inset-0 flex flex-col" style={{ zIndex: 50000, background: "rgba(26,26,46,0.55)", backdropFilter: "blur(2px)", overflow: "hidden", fontFamily: "var(--lms-font)" }}>

        {/* ── IMAGE UPLOAD MODAL ── */}
        {imgModal && (
          <ImageUploadModal
            onUpload={url => {
              if (imgModal.target === "question") {
                setFormQImageUrl(url)
              } else {
                const idx = imgModal.target as number
                setFormOpts(prev => prev.map((o, i) => i === idx ? { ...o, imageUrl: url } : o))
              }
              setImgModal(null)
            }}
            onClose={() => setImgModal(null)}
          />
        )}

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
          style={{ background: "var(--lms-bg-white)", borderBottom: "1.5px solid var(--lms-border)" }}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="lms-header-logo-mark">
              <HelpCircle className="h-4 w-4 text-white" />
            </div>
            <div className="h-5 w-px flex-shrink-0" style={{ background: "var(--lms-border)" }} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-bold" style={{ color: "var(--lms-text-main)", fontFamily: "var(--lms-font)" }}>
                  MCQ Annotation
                </span>
                <span style={{ color: "var(--lms-orange)", fontWeight: 700, fontSize: 13 }}>›</span>
                <span className="text-[13px]" style={{ color: "var(--lms-text-sec)", fontFamily: "var(--lms-font)" }}>
                  {positionLabel}
                </span>
                {localQs.length > 0 && (
                  <span className="lms-badge lms-badge-orange" style={{ fontSize: 10, padding: "2px 8px" }}>
                    {localQs.length} question{localQs.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button onClick={onClose}
              className="p-2 rounded-lg transition-colors cursor-pointer bg-red-100 hover:bg-red-200"
              style={{ color: "var(--lms-text-muted)" }}>
              <X className="h-4 w-4 text-red-600" />
            </button>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="flex flex-1 min-h-0" style={{ overflow: "hidden" }}>

          {/* ── EDITOR (main/left) ── */}
          <div className="flex-1 flex flex-col min-w-0" style={{ background: "var(--lms-bg-white)", overflow: "hidden" }}>
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "thin", overscrollBehavior: "contain", background: "var(--lms-bg-white)" }}>
              <div className="flex flex-col min-h-full" style={{ background: "var(--lms-bg-white)" }}>

                {/* ── STICKY TOOLBAR ── */}
                <div className="px-5 pt-3 pb-2 flex-shrink-0 sticky top-0 z-50"
                  style={{ background: "var(--lms-bg-white)", borderBottom: "1px solid var(--lms-border)" }}>
                  <div className="flex items-center gap-3 flex-wrap">

                    {/* Q# badge */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                      style={{ background: editingId ? "var(--lms-success)" : "var(--lms-orange)", boxShadow: `0 2px 8px ${editingId ? "rgba(22,163,74,0.25)" : "var(--lms-orange-glow)"}`, fontFamily: "var(--lms-font)" }}>
                      {currentQIndex >= 0 ? currentQIndex + 1 : localQs.length + 1}
                    </div>

                    {editingId && (
                      <span className="lms-badge lms-badge-amber" style={{ fontSize: 9, padding: "2px 6px", border: "1px solid" }}>editing</span>
                    )}

                    {/* Format buttons (same as MCQQuestionForm) */}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {(["bold", "italic", "underline"] as const).map((cmd, i) => {
                        const icons = [
                          <Bold className="h-3.5 w-3.5" />,
                          <Italic className="h-3.5 w-3.5" />,
                          <UnderlineIcon className="h-3.5 w-3.5" />,
                        ]
                        return (
                          <button key={cmd} type="button"
                            onMouseDown={e => { e.preventDefault(); execFmt(cmd) }}
                            className={`lms-fmt-btn ${activeFormats.has(cmd) ? "active" : ""}`}
                            title={cmd.charAt(0).toUpperCase() + cmd.slice(1)}>
                            {icons[i]}
                          </button>
                        )
                      })}
                      <div className="w-px h-3.5 mx-1 flex-shrink-0" style={{ background: "var(--lms-border)" }} />
                      {/* Image for question */}
                      <button type="button" className="lms-fmt-btn" title="Insert image to question"
                        onClick={() => setImgModal({ target: "question" })}>
                        <ImageIcon className="h-3.5 w-3.5" style={{ color: formQImageUrl ? "var(--lms-info)" : undefined }} />
                      </button>
                    </div>

                    <div className="flex-1" />

                    {/* Position label + type badge */}
                    <span className="lms-diff-underline-btn has-value" style={{ color: "var(--lms-info)", borderBottomColor: "var(--lms-info-bdr)", paddingRight: 0, cursor: "default" }}>
                      <BookOpen style={{ width: 13, height: 13 }} />
                      Multiple Choice
                    </span>
                  </div>
                </div>

                {/* ── QUESTION CONTENT ── */}
                <div className="px-5 pt-3 pb-4">
                  {/* Question image */}
                  {formQImageUrl && (
                    <div className="mb-3 relative inline-block">
                      <img src={formQImageUrl} alt="" className="max-w-full max-h-52 rounded-lg object-contain"
                        style={{ border: "1.5px solid var(--lms-border)" }} />
                      <button type="button" onClick={() => setFormQImageUrl("")}
                        className="absolute top-1.5 right-1.5 rounded-full w-5 h-5 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", color: "white" }}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* contentEditable question text — matches MCQQuestionForm exactly */}
                  <div className="relative group/cb mb-1">
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      ref={editorRef}
                      onKeyUp={updateActiveFormats}
                      onMouseUp={updateActiveFormats}
                      onInput={e => {
                        const hasText = (e.currentTarget.textContent || "").trim().length > 0
                        setIsQuestionEmpty(!hasText)
                        if (hasText && error === "Question text is required.") setError("")
                      }}
                      className="lms-q-text-editor focus:outline-none leading-relaxed pb-1.5 [&_strong]:font-bold [&_em]:italic [&_u]:underline"
                      style={{
                        borderBottom: `2px solid ${validationAttempted && isQuestionEmpty ? "var(--lms-danger)" : "var(--lms-border)"}`,
                        minHeight: 38,
                      }}
                    />
                    {isQuestionEmpty && (
                      <div className="absolute top-0 left-0 pointer-events-none select-none"
                        style={{ fontSize: 15, color: validationAttempted ? "#fca5a5" : "var(--lms-text-hint)", fontFamily: "var(--lms-font)", fontWeight: 400 }}>
                        {validationAttempted && isQuestionEmpty ? "Question text is required…" : "Type your question here…"}
                      </div>
                    )}
                  </div>

                  {validationAttempted && isQuestionEmpty && (
                    <div className="mt-1.5 flex items-center gap-1 text-xs" style={{ color: "var(--lms-danger)", fontFamily: "var(--lms-font)" }}>
                      <AlertCircle className="h-3 w-3 flex-shrink-0" />Question text is required
                    </div>
                  )}
                </div>

                {/* ── EXPLANATION TOGGLE ── */}
                <div className="px-5 pt-2 pb-2 flex-shrink-0">
                  <label className="flex items-center gap-2 cursor-pointer group w-fit">
                    <input type="checkbox" checked={hasExpl} onChange={() => setHasExpl(v => !v)}
                      style={{ width: 15, height: 15, accentColor: "var(--lms-orange)", cursor: "pointer" }} />
                    <span className="flex items-center gap-1.5 transition-colors"
                      style={{ fontSize: 13.5, fontFamily: "var(--lms-font)", fontWeight: 500, color: "var(--lms-text-sec)" }}>
                      <HelpCircle className="h-3.5 w-3.5" />
                      Add Explanation
                      {hasExpl && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded ml-1"
                          style={{ color: "var(--lms-danger)", background: "var(--lms-danger-bg)", fontFamily: "var(--lms-font)" }}>*required</span>
                      )}
                    </span>
                  </label>
                  {hasExpl && (
                    <div className="mt-3">
                      <textarea
                        value={formExpl}
                        onChange={e => setFormExpl(e.target.value)}
                        placeholder="Explain the correct answer…"
                        rows={3}
                        className="w-full outline-none"
                        style={{
                          resize: "vertical", fontFamily: "var(--lms-font)", fontSize: 13.5, fontWeight: 400,
                          color: "var(--lms-text-main)", lineHeight: 1.6, padding: "8px 0",
                          border: "none", borderBottom: "2px solid var(--lms-border)",
                          background: "transparent", caretColor: "var(--lms-orange)",
                        }}
                        onFocus={e => { e.target.style.borderBottomColor = "var(--lms-orange)" }}
                        onBlur={e => { e.target.style.borderBottomColor = "var(--lms-border)" }}
                      />
                    </div>
                  )}
                </div>

                {/* ── OPTIONS ── */}
                <div className="px-5 py-3">
                  {showAnswerKey ? (
                    /* Answer Key Mode — exact lms-ak-option-btn */
                    <div>
                      <p style={{ fontSize: 13.5, color: "var(--lms-text-sec)", fontFamily: "var(--lms-font)", marginBottom: 10, paddingLeft: 2 }}>
                        Select the correct answer below, then click <strong style={{ color: "var(--lms-success)" }}>Done</strong>.
                      </p>
                      <div className="space-y-1.5">
                        {formOpts.map((opt, oi) => (
                          <button key={oi} type="button"
                            onClick={() => setFormOpts(prev => prev.map((o, i) => ({ ...o, isCorrect: i === oi })))}
                            className={`lms-ak-option-btn ${opt.isCorrect ? "correct" : "neutral"}`}>
                            <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: opt.isCorrect ? "var(--lms-success)" : "var(--lms-border-hover)", background: opt.isCorrect ? "var(--lms-success)" : "transparent" }}>
                              {opt.isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            {opt.imageUrl && <img src={opt.imageUrl} alt="" className="h-8 w-8 object-cover rounded flex-shrink-0" style={{ border: "1.5px solid var(--lms-border)" }} />}
                            <span className={`flex-1 ${opt.isCorrect ? "font-semibold" : ""} ${!opt.text.trim() ? "italic" : ""}`}
                              style={{ color: !opt.text.trim() ? "var(--lms-text-hint)" : undefined }}>
                              {!opt.text.trim() ? `Option ${oi + 1}` : opt.text}
                            </span>
                            {opt.isCorrect && <Check className="h-4 w-4 flex-shrink-0" style={{ color: "var(--lms-success)" }} strokeWidth={2.5} />}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-center">
                        <button type="button" onClick={() => setShowAnswerKey(false)} className="lms-ak-done-btn">Done</button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Mode — exact lms-option-row */
                    <div>
                      {validationAttempted && !formOpts.some(o => o.isCorrect) && (
                        <div className="mb-2 flex items-center gap-1 text-xs" style={{ color: "var(--lms-danger)" }}>
                          <AlertCircle className="h-3 w-3" />No correct answer marked
                        </div>
                      )}
                      <div className="space-y-0">
                        {formOpts.map((opt, oi) => (
                          <div key={oi} className="group/opt">
                            {/* Option image preview (above row) */}
                            {opt.imageUrl && (
                              <div className="mb-1 ml-8">
                                <div className="relative inline-block cursor-pointer">
                                  <img src={opt.imageUrl} alt={`Option ${String.fromCharCode(65 + oi)}`}
                                    className="max-h-48 object-contain rounded-lg"
                                    style={{ border: "1.5px solid var(--lms-border)", maxWidth: "60%" }} />
                                  <button type="button" onClick={() => setFormOpts(prev => prev.map((o, i) => i === oi ? { ...o, imageUrl: "" } : o))}
                                    className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{ background: "rgba(0,0,0,0.55)", border: "none", cursor: "pointer", color: "white" }}>
                                    <X className="h-2.5 w-2.5" />
                                  </button>
                                </div>
                              </div>
                            )}
                            {/* Option row — exact lms-option-row */}
                            <div className="lms-option-row group/opt-inner relative"
                              onClick={e => { if ((e.target as HTMLElement).tagName !== "INPUT") { const inp = (e.currentTarget as HTMLElement).querySelector("input") as HTMLInputElement; inp?.focus() } }}>
                              {/* Radio bullet (not clickable — use Answer Key mode) */}
                              <div className="flex-shrink-0 w-4 h-4 rounded-full border-2 flex-none"
                                style={{ borderColor: opt.isCorrect ? "var(--lms-success)" : "var(--lms-border-hover)", background: opt.isCorrect ? "var(--lms-success)" : "transparent" }}>
                                {opt.isCorrect && <div className="w-1.5 h-1.5 rounded-full bg-white m-auto mt-[3px]" />}
                              </div>

                              {/* Option text input */}
                              <div className="flex-1 min-w-0 flex items-center">
                                <input type="text" value={opt.text}
                                  onChange={e => setFormOpts(prev => prev.map((o, i) => i === oi ? { ...o, text: e.target.value } : o))}
                                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                  className="lms-option-input min-w-0 outline-none bg-transparent"
                                  style={{ width: opt.text ? `${opt.text.length + 1}ch` : "100%", maxWidth: "100%" }}
                                />
                                {/* Correct badge */}
                                {opt.isCorrect && (
                                  <span className="flex items-center gap-1 ml-2 flex-shrink-0 px-2 py-0.5 rounded-full"
                                    style={{ background: "var(--lms-success-bg)", border: "1.5px solid var(--lms-success-bdr)" }}>
                                    <Check className="h-4 w-4" style={{ color: "var(--lms-success)" }} strokeWidth={3} />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--lms-success)", fontFamily: "var(--lms-font)", whiteSpace: "nowrap" }}>
                                      Marked as correct answer
                                    </span>
                                  </span>
                                )}
                                <div className="flex-1" />
                              </div>

                              {/* Image button (shown on hover like MCQQuestionForm) */}
                              <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover/opt:opacity-100 transition-opacity">
                                <button type="button"
                                  className="cursor-pointer p-1 rounded-md transition-colors hover:bg-slate-100"
                                  title={opt.imageUrl ? "Change image" : "Add image"}
                                  onClick={() => setImgModal({ target: oi })}>
                                  <ImageIcon className="h-3.5 w-3.5" style={{ color: opt.imageUrl ? "var(--lms-info)" : "var(--lms-text-muted)" }} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Answer Key button — exact lms-answer-key-btn */}
                      <div className="mt-4 flex items-center">
                        <button type="button" className="lms-answer-key-btn" onClick={() => setShowAnswerKey(true)}>
                          <div className="lms-answer-key-checkbox">
                            {formOpts.some(o => o.isCorrect) && <Check className="h-2.5 w-2.5" style={{ color: "var(--lms-info)" }} />}
                          </div>
                          {formOpts.some(o => o.isCorrect) ? "Change Answer Key" : "Set Answer Key"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-4 flex-shrink-0" />
              </div>
            </div>

            {/* ── BOTTOM BAR ── */}
            <div className="flex-shrink-0 py-3"
              style={{ borderTop: "1.5px solid var(--lms-border)", background: "var(--lms-bg-white)", paddingLeft: 32, paddingRight: 32 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8 }}>

                {/* LEFT: error or empty */}
                <div>
                  {error && (
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--lms-danger)", fontFamily: "var(--lms-font)" }}>
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}
                    </div>
                  )}
                </div>

                {/* CENTER: Save buttons */}
                <div className="flex items-center gap-2">
                  {!editingId && (
                    <button onClick={() => handleSave(true)} disabled={saving}
                      className="lms-btn lms-btn-slate flex-shrink-0">
                      {saving ? <><Loader className="h-3.5 w-3.5" style={{ animation: "lms-spin 0.8s linear infinite" }} />Saving…</> : <>Save & Add Another</>}
                    </button>
                  )}
                  <button onClick={() => handleSave(false)} disabled={saving}
                    className="lms-btn flex-shrink-0"
                    style={{ background: "var(--lms-orange)", color: "white", borderColor: "transparent", boxShadow: "0 2px 8px var(--lms-orange-glow)", fontFamily: "var(--lms-font)" }}>
                    {saving
                      ? <><Loader className="h-3.5 w-3.5" style={{ animation: "lms-spin 0.8s linear infinite" }} />Saving…</>
                      : <><CloudUpload className="h-3.5 w-3.5" />{editingId ? "Update Question" : "Save Question"}</>
                    }
                  </button>
                  {editingId && (
                    <button onClick={resetForm} className="lms-icon-btn lms-icon-btn-slate" title="New question">
                      <Plus className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* RIGHT: saved status */}
                <div className="flex items-center justify-end gap-3">
                  {editingId && !saving && !error ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold flex-shrink-0"
                      style={{ color: "var(--lms-success)", fontFamily: "var(--lms-font)" }}>
                      <CheckCircle2 className="h-3.5 w-3.5" />Saved
                    </span>
                  ) : !editingId && !saving && !error && localQs.length === 0 ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold flex-shrink-0"
                      style={{ color: "var(--lms-warning)", fontFamily: "var(--lms-font)" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--lms-warning)", flexShrink: 0 }} />
                      Unsaved
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT PANEL ── */}
          <div style={{ width: 280, flexShrink: 0, borderLeft: "1.5px solid var(--lms-border)", background: "var(--lms-bg-white)", display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

            {/* Top info section */}
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 0, borderBottom: "1.5px solid var(--lms-border)", flexShrink: 0, background: "var(--lms-bg-surface)" }}>
              <div className="lms-sidebar-section-title" style={{ marginBottom: 12 }}>
                <Hash size={12} style={{ color: "var(--lms-orange)" }} />
                <span>Questions at {positionLabel}</span>
              </div>

              {/* Stats rows */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3.5px 0" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lms-text-sec)", fontFamily: "var(--lms-font)" }}>Total</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--lms-text-main)", fontFamily: "var(--lms-font)" }}>{localQs.length}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3.5px 0" }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lms-text-sec)", fontFamily: "var(--lms-font)" }}>Position</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--lms-violet)", fontFamily: "var(--lms-font)" }}>{positionLabel}</span>
              </div>

              {/* Add new question button */}
              <button onClick={resetForm}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", borderRadius: "var(--lms-radius-md)", fontFamily: "var(--lms-font)", fontSize: 12.5, fontWeight: 600, border: "1.5px solid var(--lms-border)", background: "var(--lms-bg-white)", color: "var(--lms-text-sec)", cursor: "pointer", transition: "all 0.15s", textAlign: "left", marginTop: 10 }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.borderColor = "var(--lms-orange)"; b.style.background = "var(--lms-orange-50)"; b.style.color = "#c85a30" }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.borderColor = "var(--lms-border)"; b.style.background = "var(--lms-bg-white)"; b.style.color = "var(--lms-text-sec)" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--lms-orange-50)", border: "1.5px solid var(--lms-orange-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Plus size={14} style={{ color: "var(--lms-orange)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--lms-font)", fontSize: 12.5, fontWeight: 700, color: "inherit" }}>Add New Question</div>
                  <div style={{ fontFamily: "var(--lms-font)", fontSize: 10.5, color: "var(--lms-text-muted)", marginTop: 1 }}>Multiple choice · {positionLabel}</div>
                </div>
                <ChevronRight size={13} style={{ color: "var(--lms-text-hint)", flexShrink: 0 }} />
              </button>
            </div>

            {/* Question list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", scrollbarWidth: "thin" }}>
              {localQs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <HelpCircle size={28} style={{ color: "var(--lms-text-hint)" }} />
                  <p style={{ fontFamily: "var(--lms-font)", fontSize: 12, color: "var(--lms-text-hint)", margin: 0 }}>No questions yet</p>
                  <p style={{ fontFamily: "var(--lms-font)", fontSize: 11, color: "var(--lms-text-hint)", margin: 0 }}>Save a question to see it here</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {localQs.map((q, qi) => {
                    const { title, opts } = readQ(q)
                    const qId = q._id?.toString() || q.id || String(qi)
                    const isActive = editingId === qId
                    const correctOpt = opts.find(o => o.isCorrect)
                    return (
                      <div key={qId} className={`lms-preview-card ${isActive ? "active" : ""}`}
                        onClick={() => loadQuestion(q)} style={{ cursor: "pointer" }}>
                        <div className="flex items-start gap-3 px-4 py-3">
                          {/* Index badge */}
                          <div className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black mt-0.5"
                            style={{ background: isActive ? "var(--lms-orange)" : "var(--lms-bg-surface)", color: isActive ? "white" : "var(--lms-text-sec)", fontFamily: "var(--lms-font)" }}>
                            {qi + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold leading-snug" style={{ color: "var(--lms-text-main)", fontFamily: "var(--lms-font)" }}>
                              {title || <span style={{ color: "var(--lms-text-hint)", fontWeight: 400, fontStyle: "italic" }}>Untitled question</span>}
                            </div>
                            {correctOpt && (
                              <div className="flex items-center gap-1 mt-1">
                                <Check className="h-2.5 w-2.5 flex-shrink-0" style={{ color: "var(--lms-success)" }} strokeWidth={3} />
                                <span className="text-[10px]" style={{ color: "var(--lms-success)", fontFamily: "var(--lms-font)", fontWeight: 600 }}>{correctOpt.text}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0 ml-1">
                            <button type="button" onClick={e => handleDelete(q, e)} disabled={!!deletingId}
                              className="p-1.5 rounded-lg transition-colors" style={{ color: "var(--lms-text-hint)" }} title="Delete">
                              {deletingId === qId
                                ? <Loader className="h-3.5 w-3.5" style={{ color: "var(--lms-danger)", animation: "lms-spin 0.8s linear infinite" }} />
                                : <Trash2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Close button (bottom of right panel) */}
            <div className="flex-shrink-0 px-3 py-2.5 flex items-center gap-2"
              style={{ borderTop: "1.5px solid var(--lms-border)", background: "var(--lms-bg-white)" }}>
              <button type="button" onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: "var(--lms-bg-surface2)", color: "var(--lms-text-sec)", border: "1.5px solid var(--lms-border)", fontFamily: "var(--lms-font)", height: 36 }}>
                <X className="h-3.5 w-3.5" />Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
