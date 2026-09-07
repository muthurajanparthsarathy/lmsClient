"use client"

// Interactive Glossary overlay for image/canvas-rendered lesson pages.
//
// The server extracted every word + position once at lesson preparation
// (Lesson-Text-Map); /glossary/lesson-terms matches those words against the
// course glossary and returns per-page hotspots in the page's NATURAL
// coordinate space. Boxes are positioned as PERCENTAGES of the page, so any
// rendered size or zoom stays aligned — the canvas can shrink or scale
// freely underneath.
//
// Pages are fetched lazily in chunks around the page being read, cached for
// the session — a 700-page book never downloads its whole hotspot set.

import React, { useEffect, useRef, useState } from "react"

export interface GlossaryHotspot {
  term: string
  definition: string
  x: number
  y: number
  w: number
  h: number
  // 'glossary' (trainer's course definition) or 'dictionary' (WordNet).
  source?: "glossary" | "dictionary"
  notFound?: boolean
}

export interface LessonWord {
  t: string
  x: number
  y: number
  w: number
  h: number
}

export interface LessonWordsPageData {
  page: number
  pageWidth: number
  pageHeight: number
  words: LessonWord[]
}

export interface GlossaryPageData {
  page: number
  pageWidth: number
  pageHeight: number
  items: GlossaryHotspot[]
}

export interface GlossarySelection {
  page: number
  item: GlossaryHotspot
}

const CHUNK = 40 // pages per fetch

const getToken = (): string | null =>
  typeof window !== "undefined" ? localStorage.getItem("smartcliff_token") : null

// ── Data hook ────────────────────────────────────────────────────────────────
export function useLessonGlossary({
  apiBaseUrl,
  courseId,
  fileUrl,
  currentPage,
  enabled,
}: {
  apiBaseUrl: string
  courseId?: string
  fileUrl: string
  currentPage: number
  enabled: boolean
}) {
  const [pages, setPages] = useState<Map<number, GlossaryPageData>>(new Map())
  const fetchedChunks = useRef<Set<number>>(new Set())

  useEffect(() => {
    fetchedChunks.current.clear()
    setPages(new Map())
  }, [fileUrl, courseId])

  useEffect(() => {
    if (!enabled || !courseId || !fileUrl) return
    const chunkIndex = Math.floor((currentPage - 1) / CHUNK)
    // Prefetch the current chunk and its neighbours so scrolling never waits.
    const wanted = [chunkIndex - 1, chunkIndex, chunkIndex + 1].filter((c) => c >= 0)
    for (const c of wanted) {
      if (fetchedChunks.current.has(c)) continue
      fetchedChunks.current.add(c)
      const fromPage = c * CHUNK + 1
      const toPage = fromPage + CHUNK - 1
      const token = getToken()
      fetch(
        `${apiBaseUrl}/glossary/lesson-terms?courseId=${courseId}&fileUrl=${encodeURIComponent(
          fileUrl
        )}&fromPage=${fromPage}&toPage=${toPage}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const got: GlossaryPageData[] = json?.data?.pages || []
          if (!got.length) return
          setPages((prev) => {
            const next = new Map(prev)
            got.forEach((p) => next.set(p.page, p))
            return next
          })
        })
        .catch(() => {
          // Glossary is an enhancement — a failed fetch must never disturb
          // the lesson. The chunk can retry on a later page change.
          fetchedChunks.current.delete(c)
        })
    }
  }, [enabled, courseId, fileUrl, currentPage, apiBaseUrl])

  return pages
}

// ── All-words feed (dictionary mode) ────────────────────────────────────────
// Raw word boxes, no definitions — those are looked up per word on hover.
const WORD_CHUNK = 10

export function useLessonWords({
  apiBaseUrl,
  fileUrl,
  currentPage,
  enabled,
}: {
  apiBaseUrl: string
  fileUrl: string
  currentPage: number
  enabled: boolean
}) {
  const [pages, setPages] = useState<Map<number, LessonWordsPageData>>(new Map())
  const fetchedChunks = useRef<Set<number>>(new Set())

  useEffect(() => {
    fetchedChunks.current.clear()
    setPages(new Map())
  }, [fileUrl])

  useEffect(() => {
    if (!enabled || !fileUrl) return
    const chunkIndex = Math.floor((currentPage - 1) / WORD_CHUNK)
    const wanted = [chunkIndex, chunkIndex + 1].filter((c) => c >= 0)
    for (const c of wanted) {
      if (fetchedChunks.current.has(c)) continue
      fetchedChunks.current.add(c)
      const fromPage = c * WORD_CHUNK + 1
      const token = getToken()
      fetch(
        `${apiBaseUrl}/glossary/lesson-words?fileUrl=${encodeURIComponent(fileUrl)}&fromPage=${fromPage}&toPage=${fromPage + WORD_CHUNK - 1}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          const got: LessonWordsPageData[] = json?.data?.pages || []
          if (!got.length) return
          setPages((prev) => {
            const next = new Map(prev)
            got.forEach((p) => next.set(p.page, p))
            return next
          })
        })
        .catch(() => {
          fetchedChunks.current.delete(c)
        })
    }
  }, [enabled, fileUrl, currentPage, apiBaseUrl])

  return pages
}

// Per-word definition lookup, cached for the session.
const defineCache = new Map<string, Promise<any>>()
const lookupDefinition = (apiBaseUrl: string, courseId: string | undefined, word: string) => {
  const key = `${courseId || ""}::${word.toLowerCase()}`
  if (!defineCache.has(key)) {
    const token = getToken()
    defineCache.set(
      key,
      fetch(
        `${apiBaseUrl}/glossary/define?word=${encodeURIComponent(word)}${courseId ? `&courseId=${courseId}` : ""}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => json?.data || { found: false })
        .catch(() => {
          defineCache.delete(key)
          return { found: false }
        })
    )
  }
  return defineCache.get(key)!
}

// ── Dictionary layer — EVERY word is quietly hoverable ─────────────────────
// Rendered under the glossary layer; words that overlap a glossary hotspot
// are skipped so the trainer's definition always wins the hover.
export function DictionaryLayer({
  data,
  glossaryData,
  apiBaseUrl,
  courseId,
  onSelect,
}: {
  data: LessonWordsPageData
  glossaryData?: GlossaryPageData
  apiBaseUrl: string
  courseId?: string
  onSelect: (sel: GlossarySelection) => void
}) {
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }, [])

  if (!data.pageWidth || !data.pageHeight) return null

  const gItems = glossaryData?.items || []
  const overlapsGlossary = (w: LessonWord) =>
    gItems.some(
      (g) => w.x < g.x + g.w && g.x < w.x + w.w && w.y < g.y + g.h && g.y < w.y + w.h
    )

  const trigger = (w: LessonWord) => {
    const word = w.t.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "")
    if (!word) return
    lookupDefinition(apiBaseUrl, courseId, word).then((def) => {
      onSelect({
        page: data.page,
        item: {
          term: def.found ? def.term : word,
          definition: def.found ? def.definition : "",
          source: def.found ? def.source : "dictionary",
          notFound: !def.found,
          x: w.x, y: w.y, w: w.w, h: w.h,
        },
      })
    })
  }

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {data.words.filter((w) => !overlapsGlossary(w)).map((w, i) => (
        <span
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
            trigger(w)
          }}
          style={{
            position: "absolute",
            left: `${(w.x / data.pageWidth) * 100}%`,
            top: `${(w.y / data.pageHeight) * 100}%`,
            width: `${(w.w / data.pageWidth) * 100}%`,
            height: `${(w.h / data.pageHeight) * 100}%`,
            pointerEvents: "auto",
            cursor: "pointer",
            background: "transparent",
            borderRadius: 2,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(249,115,22,0.12)"
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
            hoverTimer.current = setTimeout(() => trigger(w), 350)
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent"
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
          }}
        />
      ))}
    </div>
  )
}

// ── Hotspot layer (rendered over one page) ──────────────────────────────────
export function GlossaryLayer({
  data,
  onSelect,
}: {
  data: GlossaryPageData
  onSelect: (sel: GlossarySelection) => void
}) {
  // Hovering a term IS asking for its meaning — open the definition popup
  // after a short dwell (so sweeping the mouse across a page doesn't strobe
  // popups). Click/tap does the same immediately (touch devices have no
  // hover). No native `title`: echoing the word back is noise.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current) }, [])

  if (!data.pageWidth || !data.pageHeight) return null
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {data.items.map((item, i) => (
        <span
          key={i}
          onClick={(e) => {
            e.stopPropagation()
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
            onSelect({ page: data.page, item })
          }}
          style={{
            position: "absolute",
            left: `${(item.x / data.pageWidth) * 100}%`,
            top: `${(item.y / data.pageHeight) * 100}%`,
            width: `${(item.w / data.pageWidth) * 100}%`,
            height: `${(item.h / data.pageHeight) * 100}%`,
            pointerEvents: "auto",
            cursor: "pointer",
            // Invisible at rest — frequent terms ("compiler" ×6 on one page)
            // would otherwise paint the page orange. The highlight is a hover
            // affordance, not a permanent marking.
            background: "transparent",
            borderRadius: 2,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(249,115,22,0.18)"
            e.currentTarget.style.borderBottom = "2px dotted rgba(249,115,22,0.85)"
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
            hoverTimer.current = setTimeout(() => onSelect({ page: data.page, item }), 250)
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.borderBottom = "none"
            if (hoverTimer.current) clearTimeout(hoverTimer.current)
          }}
        />
      ))}
    </div>
  )
}

// ── Definition popup ────────────────────────────────────────────────────────
export function GlossaryPopup({
  sel,
  pageData,
  onClose,
}: {
  sel: GlossarySelection
  pageData: { pageWidth: number; pageHeight: number }
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onEsc)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onEsc)
    }
  }, [onClose])

  const { item } = sel
  const cxPct = ((item.x + item.w / 2) / pageData.pageWidth) * 100
  const belowPct = ((item.y + item.h) / pageData.pageHeight) * 100
  // Clamp horizontally so the card never leaves the page.
  const leftPct = Math.min(Math.max(cxPct, 18), 82)

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: `${leftPct}%`,
        top: `calc(${belowPct}% + 6px)`,
        transform: "translateX(-50%)",
        zIndex: 40,
        width: 280,
        maxWidth: "86%",
        background: "#fff",
        border: "1px solid #FED7AA",
        borderRadius: 12,
        boxShadow: "0 12px 32px rgba(124,45,18,0.18), 0 2px 8px rgba(0,0,0,0.08)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "#FFF7ED",
          borderBottom: "1px solid #FFEDD5",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 13, color: "#C2410C" }}>
          {item.term}
          <span style={{ marginLeft: 8, fontWeight: 600, fontSize: 9.5, color: "#9A3412", background: "#FFEDD5", borderRadius: 999, padding: "2px 7px", verticalAlign: "middle" }}>
            {item.source === "dictionary" ? "Dictionary" : "Course glossary"}
          </span>
        </span>
        <button
          onClick={onClose}
          aria-label="Close definition"
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "#9CA3AF",
            fontSize: 14,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ✕
        </button>
      </div>
      <p style={{ margin: 0, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.55, color: item.notFound ? "#9CA3AF" : "#374151", whiteSpace: "pre-line", fontStyle: item.notFound ? "italic" : "normal" }}>
        {item.notFound ? "No definition available for this word." : item.definition}
      </p>
    </div>
  )
}
