"use client"
// InlineAIChat.tsx — ChatGPT-style inline AI chat panel
import React, { useState, useRef, useEffect, useCallback } from "react"
import { Send, X, Loader2, Copy, Check, RotateCcw, Sparkles, StopCircle } from "lucide-react"
 
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
  context?: { topicTitle?: string; fileName?: string }
}
 
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
 
// ── Minimal markdown renderer ──────────────────────────────────────────────
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
    if (line.startsWith("```")) {
      if (inCode) flushCode(k)
      else { flushList(k); inCode = true }
      return
    }
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
 
// ── Suggestions ────────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "Explain this topic simply",
  "Give me a quick summary",
  "What are the key points?",
  "Quiz me on this topic",
]
 
// ── GPT-style AI avatar ────────────────────────────────────────────────────
function AIAvatar({ size = 28 }: { size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "#10a37f", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(16,163,127,0.30)" }}>
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 41 41" fill="none">
        <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835A9.964 9.964 0 0 0 18.306.5a10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.516 3.35 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813zM22.498 37.886a7.474 7.474 0 0 1-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.49 7.496zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103l-8.051 4.649a7.504 7.504 0 0 1-10.24-2.744zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.86a7.504 7.504 0 0 1-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.051-4.645a7.497 7.497 0 0 1 11.133 7.763zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.498v4.998l-4.331 2.5-4.331-2.5V18z" fill="currentColor" style={{ color: "#fff" }} />
      </svg>
    </div>
  )
}
 
// ── Main Component ─────────────────────────────────────────────────────────
export default function InlineAIChat({ onClose, context }: Props) {
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
 
    const history = [...msgs, userMsg].map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }))
    if (context?.topicTitle && msgs.length === 0) {
      history.unshift({ role: "user", parts: [{ text: `I'm studying: "${context.topicTitle}". Please keep responses relevant to this topic when appropriate.` }] })
      history.splice(1, 0, { role: "model", parts: [{ text: "Got it! I'll help you with that topic." }] })
    }
 
    try {
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: history, generationConfig: { temperature: 0.7, maxOutputTokens: 2048 } }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I couldn't generate a response."
      setMsgs(p => [...p, { id: uid(), role: "assistant", content: reply, ts: new Date() }])
    } catch (e: any) {
      if (e.name === "AbortError") return
      setMsgs(p => [...p, { id: uid(), role: "assistant", content: "I'm having trouble connecting. Please try again.", ts: new Date(), isError: true }])
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
        <AIAvatar size={30} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0d0d0d", letterSpacing: "-0.01em" }}>ChatGPT</div>
          <div style={{ fontSize: 10.5, color: "#10a37f", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10a37f", display: "inline-block" }} />
            Powered by Gemini
          </div>
        </div>
        {msgs.length > 0 && (
          <button onClick={() => setMsgs([])} title="New chat"
            style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #e5e5e5", background: "transparent", cursor: "pointer", color: "#6b7280", transition: "all .12s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f4f4f4" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}>
            <RotateCcw size={13} />
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "24px 20px", gap: 20 }}>
            <AIAvatar size={48} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#0d0d0d", margin: "0 0 6px", letterSpacing: "-0.015em" }}>How can I help you?</p>
              {context?.topicTitle && (
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 18px", background: "#f9f9f9", padding: "5px 12px", borderRadius: 20, border: "1px solid #e5e5e5", display: "inline-block" }}>
                  📖 {context.topicTitle}
                </p>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, width: "100%", maxWidth: 300 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  style={{ padding: "10px 14px", borderRadius: 12, fontSize: 13, fontWeight: 500, color: "#0d0d0d", background: "#f9f9f9", border: "1px solid #e5e5e5", cursor: "pointer", textAlign: "left", transition: "all .12s", lineHeight: 1.4 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#f0f0f0"; (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#f9f9f9"; (e.currentTarget as HTMLElement).style.borderColor = "#e5e5e5" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px 0 8px" }}>
            {msgs.map((msg) => (
              <div key={msg.id} style={{ padding: "6px 16px 10px", display: "flex", flexDirection: "column", gap: 0 }}>
                {msg.role === "user" ? (
                  /* ── User message ── */
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <div style={{
                      maxWidth: "82%", padding: "10px 14px", borderRadius: "18px 18px 4px 18px",
                      background: "#f4f4f4", color: "#0d0d0d",
                      fontSize: 14, lineHeight: 1.65, fontWeight: 400,
                      wordBreak: "break-word",
                    }}>
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  /* ── AI message ── */
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ paddingTop: 2, flexShrink: 0 }}>
                      <AIAvatar size={26} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ paddingTop: 1 }}>
                        {msg.isError ? (
                          <p style={{ fontSize: 14, color: "#ef4444", margin: 0, lineHeight: 1.7 }}>{msg.content}</p>
                        ) : (
                          <MD text={msg.content} />
                        )}
                      </div>
                      {/* Action row */}
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
 
            {/* Typing indicator */}
            {loading && (
              <div style={{ padding: "6px 16px 10px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ paddingTop: 2, flexShrink: 0 }}><AIAvatar size={26} /></div>
                <div style={{ paddingTop: 10 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#d1d5db", display: "inline-block", animation: "gptBounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
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
          onFocusCapture={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#000"; el.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.06)" }}
          onBlurCapture={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#d1d5db"; el.style.boxShadow = "0 1px 6px rgba(0,0,0,0.06)" }}
        >
          <textarea ref={textRef} value={input} onChange={autoGrow} onKeyDown={handleKey}
            placeholder="Message ChatGPT…"
            rows={1}
            style={{
              flex: 1, resize: "none", border: "none", outline: "none", background: "transparent",
              fontSize: 14, fontWeight: 400, color: "#0d0d0d", lineHeight: 1.6,
              fontFamily: "inherit", maxHeight: 120, overflowY: "auto", height: 24,
              scrollbarWidth: "none",
            }}
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
              style={{ width: 34, height: 34, borderRadius: 10, border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", background: input.trim() ? "#000" : "#e5e5e5", flexShrink: 0, transition: "all .18s", transform: "scale(1)" }}
              onMouseEnter={e => { if (input.trim()) (e.currentTarget as HTMLElement).style.background = "#1a1a1a" }}
              onMouseLeave={e => { if (input.trim()) (e.currentTarget as HTMLElement).style.background = "#000" }}>
              <Send size={14} style={{ color: input.trim() ? "#fff" : "#9ca3af", marginBottom: 1, marginLeft: 1 }} />
            </button>
          )}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 10.5, color: "#9ca3af", textAlign: "center" }}>
          ChatGPT can make mistakes. Verify important info.
        </p>
      </div>
 
      <style>{`
        @keyframes gptBounce { 0%,60%,100%{transform:translateY(0);opacity:.4} 30%{transform:translateY(-5px);opacity:1} }
      `}</style>
    </div>
  )
}
 
 