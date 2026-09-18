"use client"
// InlineSummaryChat.tsx — ChatGPT-style Summary panel
import React, { useState, useRef, useEffect, useCallback } from "react"
import { Send, X, Loader2, Copy, Check, Sparkles, RefreshCw, StopCircle, FileText, Lightbulb, ListChecks, HelpCircle } from "lucide-react"
 
// ── Gemini config ──────────────────────────────────────────────────────────
const GEMINI_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? ""
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_KEY}`
 
// ── Types ──────────────────────────────────────────────────────────────────
interface Msg {
  id: string
  role: "user" | "assistant"
  content: string
  ts: Date
  isError?: boolean
}
interface Props {
  onClose: () => void
  context?: { topicTitle?: string; fileName?: string; hierarchy?: string[] }
}
 
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
 
// ── Markdown renderer (shared logic) ──────────────────────────────────────
function MD({ text }: { text: string }) {
  const lines = text.split("\n")
  const nodes: React.ReactNode[] = []
  let listBuf: string[] = []
  let listType: "ul" | "ol" | null = null
  let codeLines: string[] = []
  let inCode = false
 
  const flushList = (key: string) => {
    if (!listBuf.length) return
    const items = listBuf.map((li, i) => (
      <li key={i} style={{ marginBottom: 3 }}><Inline text={li} /></li>
    ))
    nodes.push(
      listType === "ol"
        ? <ol key={key} style={{ margin: "6px 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.7, color: "#0d0d0d" }}>{items}</ol>
        : <ul key={key} style={{ margin: "6px 0", paddingLeft: 18, fontSize: 14, lineHeight: 1.7, color: "#0d0d0d" }}>{items}</ul>
    )
    listBuf = []; listType = null
  }
  const flushCode = (key: string) => {
    if (!codeLines.length) return
    nodes.push(
      <pre key={key} style={{ background: "#1e1e2e", borderRadius: 10, padding: "12px 14px", overflowX: "auto", margin: "8px 0", fontSize: 12.5, lineHeight: 1.6, color: "#cdd6f4", fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace" }}>
        <code>{codeLines.join("\n")}</code>
      </pre>
    )
    codeLines = []; inCode = false
  }
 
  lines.forEach((line, i) => {
    const k = String(i)
    if (line.startsWith("```")) { if (inCode) flushCode(k); else { flushList(k); inCode = true }; return }
    if (inCode) { codeLines.push(line); return }
    if (/^### /.test(line)) { flushList(k); nodes.push(<p key={k} style={{ fontWeight: 700, fontSize: 14, color: "#0d0d0d", margin: "10px 0 3px" }}><Inline text={line.slice(4)} /></p>); return }
    if (/^## /.test(line))  { flushList(k); nodes.push(<p key={k} style={{ fontWeight: 700, fontSize: 15, color: "#0d0d0d", margin: "10px 0 3px" }}><Inline text={line.slice(3)} /></p>); return }
    if (/^# /.test(line))   { flushList(k); nodes.push(<p key={k} style={{ fontWeight: 800, fontSize: 16, color: "#0d0d0d", margin: "10px 0 4px" }}><Inline text={line.slice(2)} /></p>); return }
    if (/^[-*] /.test(line)) { listType = listType ?? "ul"; listBuf.push(line.slice(2)); return }
    if (/^\d+\. /.test(line)) { listType = listType ?? "ol"; listBuf.push(line.replace(/^\d+\. /, "")); return }
    flushList(k)
    if (line.trim() === "") { nodes.push(<div key={k} style={{ height: 6 }} />); return }
    nodes.push(<p key={k} style={{ fontSize: 14, lineHeight: 1.75, color: "#0d0d0d", margin: "1px 0" }}><Inline text={line} /></p>)
  })
  flushList("end")
  if (inCode) flushCode("end-code")
  return <>{nodes}</>
}
 
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
  return <>
    {parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{ fontWeight: 700 }}>{p.slice(2, -2)}</strong>
      if (p.startsWith("*") && p.endsWith("*"))   return <em key={i}>{p.slice(1, -1)}</em>
      if (p.startsWith("`") && p.endsWith("`"))   return <code key={i} style={{ background: "#f0f0f0", color: "#c7254e", padding: "1px 5px", borderRadius: 5, fontSize: 12.5, fontFamily: "monospace" }}>{p.slice(1, -1)}</code>
      return <span key={i}>{p}</span>
    })}
  </>
}
 
// ── Summary avatar ─────────────────────────────────────────────────────────
function SummaryAvatar({ size = 28 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#7c3aed,#a855f7)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(124,58,237,0.30)" }}>
      <Sparkles size={size * 0.44} style={{ color: "#fff" }} />
    </div>
  )
}
 
// ── Quick action cards ─────────────────────────────────────────────────────
const ACTIONS = [
  { icon: FileText,    label: "Summarize topic",      prompt: (t?: string) => t ? `Give me a concise summary of "${t}"` : "Give me a concise summary of this topic" },
  { icon: Lightbulb,  label: "Key concepts",          prompt: (t?: string) => t ? `List the key concepts in "${t}" with brief explanations` : "List the key concepts of this topic" },
  { icon: ListChecks, label: "Study checklist",       prompt: (t?: string) => t ? `Create a study checklist for mastering "${t}"` : "Create a study checklist for this topic" },
  { icon: HelpCircle, label: "Common questions",      prompt: (t?: string) => t ? `What are the most common exam questions about "${t}"?` : "What are common exam questions for this topic?" },
]
 
// ── Component ──────────────────────────────────────────────────────────────
export default function InlineSummaryChat({ onClose, context }: Props) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
 
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [msgs, loading])
  useEffect(() => { setTimeout(() => textRef.current?.focus(), 80) }, [])
 
  const send = useCallback(async (text: string) => {
    const t = text.trim(); if (!t || loading) return
    setInput("")
    if (textRef.current) { textRef.current.style.height = "24px" }
    const userMsg: Msg = { id: uid(), role: "user", content: t, ts: new Date() }
    setMsgs(p => [...p, userMsg])
    setLoading(true)
 
    const systemHint = context?.topicTitle
      ? `You are a helpful study assistant. The student is studying "${context.topicTitle}". Provide clear, structured, educational responses.`
      : "You are a helpful study assistant. Provide clear, structured, educational responses."
 
    const history = [...msgs, userMsg].map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }))
    if (msgs.length === 0) {
      history.unshift({ role: "user", parts: [{ text: systemHint }] })
      history.splice(1, 0, { role: "model", parts: [{ text: "Understood! I'll help you with clear, educational responses." }] })
    }
 
    try {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: history, generationConfig: { temperature: 0.5, maxOutputTokens: 2048 } }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I couldn't generate a response."
      setMsgs(p => [...p, { id: uid(), role: "assistant", content: reply, ts: new Date() }])
    } catch (e: any) {
      if (e.name === "AbortError") return
      setMsgs(p => [...p, { id: uid(), role: "assistant", content: "Connection issue. Please try again.", ts: new Date(), isError: true }])
    } finally { setLoading(false) }
  }, [msgs, loading, context])
 
  const copyMsg = async (id: string, txt: string) => {
    await navigator.clipboard.writeText(txt).catch(() => {})
    setCopied(id); setTimeout(() => setCopied(null), 1600)
  }
 
  const stopGen = () => { abortRef.current?.abort(); setLoading(false) }
 
  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target; el.style.height = "24px"
    el.style.height = Math.min(el.scrollHeight, 120) + "px"
  }
 
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) }
  }
 
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#fff", fontFamily: "'Poppins','Poppins',system-ui,-apple-system,sans-serif", WebkitFontSmoothing: "antialiased" }}>
 
      {/* ── Header ── */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 10, padding: "0 16px", height: 52, borderBottom: "1px solid #e5e5e5", background: "#fff" }}>
        <SummaryAvatar size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0d0d0d", letterSpacing: "-0.01em" }}>Summary AI</div>
          <div style={{ fontSize: 10.5, color: "#7c3aed", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7c3aed", display: "inline-block" }} />
            Powered by Gemini
          </div>
        </div>
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} title="Clear"
            style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e5e5e5", background: "transparent", cursor: "pointer", color: "#6b7280", transition: "all .12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f4f4f4" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}>
            <RefreshCw size={12} />
          </button>
        )}
        <button onClick={onClose} title="Close"
          style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e5e5e5", background: "transparent", cursor: "pointer", color: "#6b7280", transition: "all .12s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fef2f2"; (e.currentTarget as HTMLElement).style.color = "#ef4444"; (e.currentTarget as HTMLElement).style.borderColor = "#fca5a5" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#6b7280"; (e.currentTarget as HTMLElement).style.borderColor = "#e5e5e5" }}>
          <X size={13} />
        </button>
      </div>
 
      {/* ── Messages ── */}
      <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "#e0e0e0 transparent" }}>
        {msgs.length === 0 ? (
          /* ── Welcome / empty state ── */
          <div style={{ display: "flex", flexDirection: "column", padding: "20px 16px", gap: 16 }}>
            <div style={{ textAlign: "center", padding: "10px 0 6px" }}>
              <SummaryAvatar size={44} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "#0d0d0d", margin: "12px 0 4px", letterSpacing: "-0.015em" }}>AI Study Assistant</p>
              {context?.topicTitle
                ? <p style={{ fontSize: 12.5, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Studying: <strong style={{ color: "#7c3aed" }}>{context.topicTitle}</strong></p>
                : <p style={{ fontSize: 12.5, color: "#6b7280", margin: 0 }}>What would you like to know?</p>
              }
            </div>
 
            {/* Action cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>Quick Actions</p>
              {ACTIONS.map(({ icon: Icon, label, prompt }) => (
                <button key={label} onClick={() => send(prompt(context?.topicTitle))}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, border: "1px solid #e5e5e5", background: "#fafafa", cursor: "pointer", textAlign: "left", transition: "all .12s" }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#f5f3ff"; el.style.borderColor = "#c4b5fd" }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#fafafa"; el.style.borderColor = "#e5e5e5" }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#ede9fe,#ddd6fe)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon size={15} style={{ color: "#7c3aed" }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px 0 8px" }}>
            {msgs.map((msg) => (
              <div key={msg.id} style={{ padding: "6px 16px 10px" }}>
                {msg.role === "user" ? (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{ maxWidth: "82%", padding: "10px 14px", borderRadius: "18px 18px 4px 18px", background: "#f4f4f4", color: "#0d0d0d", fontSize: 14, lineHeight: 1.65, wordBreak: "break-word" }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ paddingTop: 2, flexShrink: 0 }}><SummaryAvatar size={26} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ paddingTop: 1 }}>
                        {msg.isError
                          ? <p style={{ fontSize: 14, color: "#ef4444", margin: 0, lineHeight: 1.7 }}>{msg.content}</p>
                          : <MD text={msg.content} />
                        }
                      </div>
                      <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
                        <button onClick={() => copyMsg(msg.id, msg.content)}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 7, border: "none", background: "transparent", cursor: "pointer", color: "#9ca3af", fontSize: 11.5, fontWeight: 500, transition: "all .12s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f4f4f4"; (e.currentTarget as HTMLElement).style.color = "#374151" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#9ca3af" }}>
                          {copied === msg.id ? <Check size={12} /> : <Copy size={12} />}
                          {copied === msg.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
 
            {loading && (
              <div style={{ padding: "6px 16px 10px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ paddingTop: 2, flexShrink: 0 }}><SummaryAvatar size={26} /></div>
                <div style={{ paddingTop: 10 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#c4b5fd", display: "inline-block", animation: "gptBounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
 
      {/* ── Input area ── */}
      <div style={{ flexShrink: 0, padding: "10px 12px 14px", background: "#fff", borderTop: "1px solid #e5e5e5" }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 8,
          background: "#fff", border: "1.5px solid #d1d5db",
          borderRadius: 16, padding: "10px 10px 10px 14px",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          transition: "border-color .15s, box-shadow .15s",
        }}
          onFocusCapture={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#7c3aed"; el.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.10)" }}
          onBlurCapture={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#d1d5db"; el.style.boxShadow = "0 1px 6px rgba(0,0,0,0.06)" }}>
          <textarea ref={textRef} value={input} onChange={autoGrow} onKeyDown={handleKey}
            placeholder="Ask for a summary, key points…"
            rows={1}
            style={{ flex: 1, resize: "none", border: "none", outline: "none", background: "transparent", fontSize: 14, fontWeight: 400, color: "#0d0d0d", lineHeight: 1.6, fontFamily: "inherit", maxHeight: 120, overflowY: "auto", height: 24, scrollbarWidth: "none" }}
          />
          {loading ? (
            <button onClick={stopGen}
              style={{ width: 34, height: 34, borderRadius: 10, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f4", flexShrink: 0, transition: "all .15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#e5e5e5" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#f4f4f4" }}>
              <StopCircle size={16} style={{ color: "#374151" }} />
            </button>
          ) : (
            <button onClick={() => send(input)} disabled={!input.trim()}
              style={{ width: 34, height: 34, borderRadius: 10, border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "#e5e5e5", flexShrink: 0, transition: "all .18s", boxShadow: input.trim() ? "0 2px 6px rgba(124,58,237,0.30)" : "none" }}
              onMouseEnter={e => { if (input.trim()) (e.currentTarget as HTMLElement).style.opacity = "0.85" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1" }}>
              <Send size={14} style={{ color: input.trim() ? "#fff" : "#9ca3af", marginBottom: 1, marginLeft: 1 }} />
            </button>
          )}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "#9ca3af", textAlign: "center" }}>
          AI summaries may be incomplete. Use as a study aid.
        </p>
      </div>
 
      <style>{`
        @keyframes gptBounce { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-5px);opacity:1} }
      `}</style>
    </div>
  )
}
 
 