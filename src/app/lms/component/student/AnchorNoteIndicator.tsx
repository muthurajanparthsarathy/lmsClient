"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { StickyNote, X } from "lucide-react"
import type { Note } from "../../../../apiServices/notesPanelService"

// Format seconds → "m:ss" or "h:mm:ss"
export const formatTs = (s: number): string => {
  if (!isFinite(s) || s < 0) s = 0
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

interface Props {
  notes: Note[]                       // notes for this resource (already filtered by resourceId)
  mode: "page" | "timestamp"          // page → PDF/PPT, timestamp → Video
  currentValue: number                // current page number OR current time (seconds)
  onOpenPanel: (noteId?: string) => void
  // Video-only: window for auto-fire (seconds). Default 1.
  windowSec?: number
  // Optional label prefix for the pill ("page" | "slide"). Default "page".
  unitLabel?: string
}

/**
 * In-viewer notification for context-anchored notes.
 * - Page mode (PDF/PPT): shows a floating pill (auto-dismiss 4s) whenever
 *   currentValue changes to a page that has notes; also renders a persistent
 *   dot the parent can position via the returned indicator.
 * - Timestamp mode (Video): fires a toast once per note per session when
 *   playback enters ±windowSec of the note timestamp.
 */
export default function AnchorNoteIndicator({
  notes,
  mode,
  currentValue,
  onOpenPanel,
  windowSec = 1,
  unitLabel = "page",
}: Props) {
  const [visible, setVisible] = useState(false)
  const [activeNotes, setActiveNotes] = useState<Note[]>([])
  const dismissTimer = useRef<number | null>(null)
  const settleTimer = useRef<number | null>(null)
  const triggeredIds = useRef<Set<string>>(new Set())
  const lastPage = useRef<number | null>(null)
  const lastFiredPage = useRef<number | null>(null)
  const lastFiredAt = useRef<number>(0)
  // Time the page must stay stable before we fire the pill.
  // Prevents scroll-boundary jitter (currentPage bouncing between 4 and 5)
  // from firing the notification while the user is still transitioning.
  const SETTLE_MS = 600
  // Cooldown between two consecutive fires for the same page.
  const REFIRE_MS = 10000

  // Group notes by their anchor value for O(1) lookup
  const notesByKey = useMemo(() => {
    const map = new Map<number, Note[]>()
    for (const n of notes) {
      if (!n.anchor) continue
      const key = mode === "page" ? n.anchor.page : n.anchor.timestamp
      if (key == null) continue
      const bucket = map.get(key) || []
      bucket.push(n)
      map.set(key, bucket)
    }
    return map
  }, [notes, mode])

  // Reset the "already-shown-on-this-page" guard whenever the notes for this
  // resource change — otherwise a note created while sitting on page N would
  // never show its indicator because lastPage still equals N.
  useEffect(() => {
    lastPage.current = null
    lastFiredPage.current = null
  }, [notesByKey])

  // PAGE MODE — debounced. currentValue jitter from IntersectionObserver
  // during scroll (e.g. 4↔5 at page boundary) is common; we only fire the
  // pill after the page has stayed the same for SETTLE_MS.
  useEffect(() => {
    if (mode !== "page") return
    const p = Math.floor(currentValue)

    // Reset any pending "settle" evaluation whenever the value changes.
    if (settleTimer.current) {
      window.clearTimeout(settleTimer.current)
      settleTimer.current = null
    }

    // If the user is transitioning between pages, hide any pill that
    // belonged to a different page so it doesn't hover incorrectly.
    if (visible && lastFiredPage.current !== null && lastFiredPage.current !== p) {
      setVisible(false)
    }

    lastPage.current = p

    settleTimer.current = window.setTimeout(() => {
      // Guard against re-firing the same page in quick succession.
      const now = Date.now()
      if (lastFiredPage.current === p && now - lastFiredAt.current < REFIRE_MS) return

      const matches = notesByKey.get(p) || []
      if (matches.length === 0) return

      lastFiredPage.current = p
      lastFiredAt.current = now
      setActiveNotes(matches)
      setVisible(true)
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current)
      dismissTimer.current = window.setTimeout(() => setVisible(false), 8000)
    }, SETTLE_MS)

    return () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current)
    }
    // `visible` intentionally omitted — we only want fire logic driven by
    // page/notes changes, not by our own visibility toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue, notesByKey, mode])

  // TIMESTAMP MODE — fire when currentTime enters ±windowSec of any note ts,
  // once per note per component life (guard against scrub re-fires).
  useEffect(() => {
    if (mode !== "timestamp") return
    const t = currentValue
    for (const [key, bucket] of notesByKey) {
      if (Math.abs(t - key) <= windowSec) {
        const unfired = bucket.filter(n => !triggeredIds.current.has(n._id))
        if (unfired.length === 0) continue
        unfired.forEach(n => triggeredIds.current.add(n._id))
        setActiveNotes(unfired)
        setVisible(true)
        if (dismissTimer.current) window.clearTimeout(dismissTimer.current)
        dismissTimer.current = window.setTimeout(() => setVisible(false), 5000)
        return
      }
    }
  }, [currentValue, notesByKey, mode, windowSec])

  // Reset session guard when the note set itself changes
  useEffect(() => {
    triggeredIds.current.clear()
  }, [notes.length])

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current)
      if (settleTimer.current) window.clearTimeout(settleTimer.current)
    }
  }, [])

  if (!visible || activeNotes.length === 0) return null

  const primary = activeNotes[0]
  const label =
    mode === "page"
      ? `${activeNotes.length} note${activeNotes.length > 1 ? "s" : ""} on this ${unitLabel}`
      : `Note at ${formatTs(primary.anchor?.timestamp ?? 0)} — "${primary.title || "Untitled"}"`

  return (
    <div
      style={{
        position: "absolute",
        right: 18,
        bottom: 18,
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 12,
        background: "linear-gradient(135deg,#F97316 0%,#EA580C 100%)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        boxShadow: "0 10px 30px rgba(249,115,22,0.35), 0 2px 8px rgba(0,0,0,0.08)",
        cursor: "pointer",
        animation: "anchorNoteSlide 0.28s cubic-bezier(0.16,1,0.3,1)",
        maxWidth: 340,
      }}
      onClick={() => {
        setVisible(false)
        onOpenPanel(activeNotes.length === 1 ? primary._id : undefined)
      }}
      role="button"
      aria-label="Open notes for this location"
    >
      <StickyNote size={16} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <button
        onClick={e => {
          e.stopPropagation()
          setVisible(false)
        }}
        style={{
          background: "rgba(255,255,255,0.18)",
          border: "none",
          color: "#fff",
          borderRadius: 6,
          padding: 3,
          display: "flex",
          cursor: "pointer",
          flexShrink: 0,
        }}
        aria-label="Dismiss"
      >
        <X size={12} />
      </button>
      <style>{`
        @keyframes anchorNoteSlide {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>
  )
}

/**
 * Small utility: does a given page/timestamp have any anchored notes?
 * Parent viewers use this to render the persistent dot indicator.
 */
export function hasAnchoredNotes(
  notes: Note[],
  mode: "page" | "timestamp",
  value: number,
  windowSec = 1
): boolean {
  for (const n of notes) {
    if (!n.anchor) continue
    if (mode === "page" && n.anchor.page === Math.floor(value)) return true
    if (mode === "timestamp" && n.anchor.timestamp != null && Math.abs(value - n.anchor.timestamp) <= windowSec) return true
  }
  return false
}

/**
 * Return anchored timestamps for a video (used to render seek-bar ticks).
 */
export function getTimestampAnchors(notes: Note[]): { note: Note; timestamp: number }[] {
  return notes
    .filter(n => n.anchor?.timestamp != null)
    .map(n => ({ note: n, timestamp: n.anchor!.timestamp! }))
}
